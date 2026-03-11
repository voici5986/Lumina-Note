module.exports = function setup(api) {
  const OVERVIEW_TAB_TYPE = "openclaw-workspace-overview";
  const KEY_FILES = ["AGENTS.md", "SOUL.md", "USER.md", "HEARTBEAT.md", "MEMORY.md"];
  const ARTIFACT_PREFIXES = ["output/", "artifacts/", "tmp/docs/"];
  const PLAN_PREFIXES = ["plans/", "docs/plans/", ".openclaw/plans/", "output/plans/"];

  let cachedSnapshot = null;
  let disposeUi = () => {};

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const normalizeRelativePath = (workspacePath, path) => {
    const normalizedWorkspace = String(workspacePath || "").replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedPath = String(path || "").replace(/\\/g, "/");
    if (!normalizedWorkspace) {
      return normalizedPath.replace(/^\/+/, "");
    }
    if (normalizedPath === normalizedWorkspace) {
      return "";
    }
    if (normalizedPath.startsWith(`${normalizedWorkspace}/`)) {
      return normalizedPath.slice(normalizedWorkspace.length + 1);
    }
    return normalizedPath.replace(/^\/+/, "");
  };

  const inspectWorkspace = async ({ force = false } = {}) => {
    const hostWorkspacePath = api.workspace.getPath();
    const openClawAttachment = api.workspace.getOpenClawAttachment();
    const workspacePath = api.workspace.getOpenClawWorkspacePath() || hostWorkspacePath;
    const detectedAttachment =
      openClawAttachment && openClawAttachment.status === "attached" ? openClawAttachment : null;
    if (!workspacePath) {
      cachedSnapshot = {
        hostWorkspacePath: null,
        workspacePath: null,
        attached: false,
        attachment: null,
        keyFiles: KEY_FILES.map((path) => ({ path, exists: false })),
        memoryFiles: [],
        planFiles: [],
        artifactFiles: [],
        bridgeNotes: [],
        conflictState: null,
      };
      return cachedSnapshot;
    }

    if (!force && cachedSnapshot && cachedSnapshot.workspacePath === workspacePath) {
      return cachedSnapshot;
    }

    const files = detectedAttachment
      ? await api.workspace.listOpenClawWorkspaceFiles()
      : await api.vault.listFiles();
    const normalized = Array.from(
      new Set(
        files
          .map((path) => normalizeRelativePath(workspacePath, path))
          .filter((path) => path.length > 0),
      ),
    ).sort((left, right) => left.localeCompare(right));
    const fileSet = new Set(normalized);
    const memoryFiles = normalized
      .filter((path) => path.startsWith("memory/") && path.toLowerCase().endsWith(".md"))
      .sort((left, right) => right.localeCompare(left));
    const planFiles = normalized.filter((path) =>
      PLAN_PREFIXES.some((prefix) => path.startsWith(prefix)),
    );
    const artifactFiles = normalized.filter((path) =>
      ARTIFACT_PREFIXES.some((prefix) => path.startsWith(prefix)) &&
      !PLAN_PREFIXES.some((prefix) => path.startsWith(prefix)),
    );
    const bridgeNotes = normalized.filter((path) =>
      path.startsWith(".lumina/openclaw-bridge-") && path.toLowerCase().endsWith(".md"),
    );
    const conflictState = api.workspace.getOpenClawConflictState();

    cachedSnapshot = {
      hostWorkspacePath,
      workspacePath,
      attached: Boolean(detectedAttachment),
      attachment: detectedAttachment,
      conflictState,
      keyFiles: KEY_FILES.map((path) => ({
        path,
        exists: fileSet.has(path),
      })),
      memoryFiles,
      planFiles,
      artifactFiles,
      bridgeNotes,
    };

    return cachedSnapshot;
  };

  const notifyNeedsAttachment = () => {
    api.ui.notify("Current workspace is not recognized as an OpenClaw workspace.");
    return false;
  };

  const openKnownFile = async (label, path) => {
    const snapshot = await inspectWorkspace({ force: true });
    if (!snapshot.attached) {
      return notifyNeedsAttachment();
    }
    if (!snapshot.keyFiles.some((entry) => entry.path === path && entry.exists)) {
      api.ui.notify(`${label} not found: ${path}`);
      return false;
    }
    await api.workspace.openOpenClawWorkspaceFile(path);
    return true;
  };

  const openLatestMemory = async () => {
    const snapshot = await inspectWorkspace({ force: true });
    if (!snapshot.attached) {
      return notifyNeedsAttachment();
    }
    const latest = snapshot.memoryFiles[0];
    if (!latest) {
      api.ui.notify("No OpenClaw daily memory files found.");
      return false;
    }
    await api.workspace.openOpenClawWorkspaceFile(latest);
    return true;
  };

  const buildBridgePath = (kind) =>
    `.lumina/openclaw-bridge-${kind}-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;

  const stageBridgeNote = async (kind, content, metadata) => {
    const workspacePath = api.workspace.getOpenClawWorkspacePath();
    if (!workspacePath) {
      api.ui.notify("Attach an OpenClaw workspace first.");
      return false;
    }
    const attachment = api.workspace.getOpenClawAttachment();
    if (!attachment) {
      api.ui.notify("Attach the current workspace as OpenClaw first.");
      return false;
    }
    const body = [
      "---",
      "source: lumina-openclaw-bridge",
      `kind: ${kind}`,
      `created_at: ${new Date().toISOString()}`,
      ...Object.entries(metadata || {}).map(([key, value]) => `${key}: ${String(value)}`),
      "---",
      "",
      content,
      "",
    ].join("\n");
    const path = buildBridgePath(kind);
    await api.workspace.writeOpenClawWorkspaceFile(path, body);
    await api.workspace.openOpenClawWorkspaceFile(path);
    api.ui.notify(`Staged ${kind} into ${path}`);
    return true;
  };

  const stageCurrentNote = async () => {
    const activePath = api.workspace.getActiveFile();
    if (!activePath) {
      api.ui.notify("No active note to stage.");
      return false;
    }
    const content = await api.workspace.readFile(activePath);
    return stageBridgeNote("note", content, { source_file: activePath });
  };

  const stageSelection = async () => {
    const selection = api.editor.getSelection();
    const activePath = api.workspace.getActiveFile();
    if (!selection || !selection.text) {
      api.ui.notify("No editor selection to stage.");
      return false;
    }
    return stageBridgeNote("selection", selection.text, {
      source_file: activePath || "",
      selection_from: selection.from,
      selection_to: selection.to,
    });
  };

  const refreshAttachment = async () => {
    if (!api.workspace.getPath()) {
      api.ui.notify("Open a workspace first.");
      return false;
    }
    const attachment = await api.workspace.refreshOpenClawWorkspace();
    cachedSnapshot = null;
    api.ui.notify(
      attachment
        ? "Refreshed OpenClaw workspace metadata."
        : "Refreshed workspace detection, but no attachment exists yet.",
    );
    await rebuildUi();
    return Boolean(attachment);
  };

  const renderOverview = (snapshot) => {
    const keyFileItems = snapshot.keyFiles
      .map(
        (entry) =>
          `<li><code>${escapeHtml(entry.path)}</code> <strong>${entry.exists ? "present" : "missing"}</strong></li>`,
      )
      .join("");
    const memoryItems = snapshot.memoryFiles
      .slice(0, 8)
      .map((path) => `<li><code>${escapeHtml(path)}</code></li>`)
      .join("");
    const artifactItems = snapshot.artifactFiles
      .slice(0, 8)
      .map((path) => `<li><code>${escapeHtml(path)}</code></li>`)
      .join("");
    const planItems = snapshot.planFiles
      .slice(0, 8)
      .map((path) => `<li><code>${escapeHtml(path)}</code></li>`)
      .join("");
    const bridgeItems = snapshot.bridgeNotes
      .slice(0, 4)
      .map((path) => `<li><code>${escapeHtml(path)}</code></li>`)
      .join("");

    if (!snapshot.workspacePath) {
      return [
        "<p>No workspace is currently open.</p>",
        "<p>Open the real OpenClaw workspace folder in Lumina to use this integration.</p>",
      ].join("");
    }

    const status = snapshot.attached ? "Attached" : "Not attached";
    const guidance = snapshot.attached
      ? "<p>These remain the real files OpenClaw reads. Edit them from the normal file tree, not from a copy.</p>"
      : "<p>Open the real OpenClaw workspace folder in Lumina, then use <code>Attach current workspace</code> to opt into the shared workspace binding.</p>";

    return [
      `<p><strong>Status:</strong> ${status}</p>`,
      `<p><strong>Host workspace:</strong> <code>${escapeHtml(snapshot.hostWorkspacePath || "")}</code></p>`,
      `<p><strong>OpenClaw workspace:</strong> <code>${escapeHtml(snapshot.workspacePath)}</code></p>`,
      snapshot.attachment
        ? `<p><strong>Last validated:</strong> <code>${escapeHtml(
            snapshot.attachment.lastValidatedAt || "",
          )}</code></p>`
        : "",
      snapshot.attachment && snapshot.attachment.gateway && snapshot.attachment.gateway.enabled
        ? `<p><strong>Gateway:</strong> <code>${escapeHtml(snapshot.attachment.gateway.endpoint || "")}</code></p>`
        : "<p><strong>Gateway:</strong> not configured</p>",
      snapshot.conflictState && snapshot.conflictState.status === "warning"
        ? `<p><strong>Conflict:</strong> ${escapeHtml(snapshot.conflictState.message || "warning")}</p>`
        : "<p><strong>Conflict:</strong> none</p>",
      guidance,
      "<h3>Key memory files</h3>",
      `<ul>${keyFileItems || "<li>No key files found.</li>"}</ul>`,
      `<p><strong>Daily memory files:</strong> ${snapshot.memoryFiles.length}</p>`,
      memoryItems ? `<ul>${memoryItems}</ul>` : "<p>No daily memory files found.</p>",
      `<p><strong>Plan files:</strong> ${snapshot.planFiles.length}</p>`,
      planItems ? `<ul>${planItems}</ul>` : "<p>No plan files found under known plan folders.</p>",
      `<p><strong>Artifacts under known folders:</strong> ${snapshot.artifactFiles.length}</p>`,
      artifactItems ? `<ul>${artifactItems}</ul>` : "<p>No files found under output/, artifacts/, or tmp/docs/.</p>",
      `<p><strong>Bridge notes:</strong> ${snapshot.bridgeNotes.length}</p>`,
      bridgeItems ? `<ul>${bridgeItems}</ul>` : "<p>No Lumina bridge notes have been staged yet.</p>",
      "<p>Quick actions are available from the command palette group <code>OpenClaw Workspace</code>.</p>",
    ].join("");
  };

  const openOverview = async () => {
    const snapshot = await inspectWorkspace({ force: true });
    api.workspace.openRegisteredTab(OVERVIEW_TAB_TYPE, {
      html: renderOverview(snapshot),
      attached: snapshot.attached,
      workspacePath: snapshot.workspacePath,
    });
  };

  const cleanupUi = () => {
    disposeUi();
    disposeUi = () => {};
  };

  const attachWorkspace = async () => {
    if (!api.workspace.getPath()) {
      api.ui.notify("Open a workspace first.");
      return;
    }
    let snapshot;
    try {
      snapshot = await api.workspace.attachOpenClawWorkspace();
    } catch (error) {
      api.ui.notify(String(error));
      return;
    }
    cachedSnapshot = null;
    api.ui.notify(
      snapshot.detectedFiles.length > 0
        ? "Attached current workspace as an OpenClaw workspace."
        : "Attached current workspace, but no OpenClaw markers were validated yet.",
    );
    await rebuildUi();
  };

  const detachWorkspace = async () => {
    if (!api.workspace.getPath()) {
      api.ui.notify("Open a workspace first.");
      return;
    }
    api.workspace.detachOpenClawWorkspace();
    cachedSnapshot = null;
    api.ui.notify("Cleared cached OpenClaw workspace state.");
    await rebuildUi();
  };

  const rebuildUi = async () => {
    cleanupUi();
    const snapshot = await inspectWorkspace({ force: true });
    const disposers = [];

    if (snapshot.attached) {
      disposers.push(
        api.ui.registerStatusBarItem({
          id: "openclaw-workspace-status",
          text:
            snapshot.attachment && snapshot.attachment.gateway && snapshot.attachment.gateway.enabled
              ? "OpenClaw: attached + gateway"
              : "OpenClaw: attached",
          align: "left",
          order: 260,
          run: () => {
            void openOverview();
          },
        }),
      );
      disposers.push(
        api.ui.registerRibbonItem({
          id: "open-openclaw-workspace",
          title: "OpenClaw",
          icon: "OC",
          section: "top",
          order: 290,
          run: () => {
            void openOverview();
          },
        }),
      );
    }

    disposers.push(
      api.ui.registerCommandPaletteGroup({
        id: "openclaw-workspace",
        title: "OpenClaw Workspace",
        commands: [
          {
            id: "attach-current-workspace",
            title: "Attach current workspace",
            description: snapshot.attached
              ? "Refresh the current OpenClaw workspace attachment."
              : "Attach the current Lumina workspace as an OpenClaw workspace.",
            run: () => {
              void attachWorkspace();
            },
          },
          {
            id: "detach-current-workspace",
            title: "Clear cached workspace state",
            description: "Clear the current workspace's cached OpenClaw detection state.",
            run: () => {
              void detachWorkspace();
            },
          },
          {
            id: "open-overview",
            title: "Open overview",
            description: "Inspect the current workspace for OpenClaw memory files and artifacts.",
            run: () => {
              void openOverview();
            },
          },
          {
            id: "refresh-workspace-state",
            title: "Refresh workspace state",
            description: "Refresh OpenClaw attachment metadata from the current workspace files.",
            run: () => {
              void refreshAttachment();
            },
          },
          {
            id: "open-agents",
            title: "Open AGENTS.md",
            description: "Open the workspace instructions file.",
            run: () => {
              void openKnownFile("OpenClaw instructions", "AGENTS.md");
            },
          },
          {
            id: "open-soul",
            title: "Open SOUL.md",
            description: "Open the OpenClaw soul document.",
            run: () => {
              void openKnownFile("OpenClaw soul document", "SOUL.md");
            },
          },
          {
            id: "open-user",
            title: "Open USER.md",
            description: "Open the OpenClaw user profile document.",
            run: () => {
              void openKnownFile("OpenClaw user document", "USER.md");
            },
          },
          {
            id: "open-heartbeat",
            title: "Open HEARTBEAT.md",
            description: "Open the OpenClaw heartbeat instructions file.",
            run: () => {
              void openKnownFile("OpenClaw heartbeat document", "HEARTBEAT.md");
            },
          },
          {
            id: "open-memory-index",
            title: "Open MEMORY.md",
            description: "Open the OpenClaw long-term memory index.",
            run: () => {
              void openKnownFile("OpenClaw memory index", "MEMORY.md");
            },
          },
          {
            id: "open-latest-daily-memory",
            title: "Open latest daily memory",
            description: "Open the newest memory/YYYY-MM-DD.md file.",
            run: () => {
              void openLatestMemory();
            },
          },
          {
            id: "stage-current-note",
            title: "Stage current note for OpenClaw",
            description: "Write the current note into a Lumina bridge note inside the workspace.",
            run: () => {
              void stageCurrentNote();
            },
          },
          {
            id: "stage-selection",
            title: "Stage selection for OpenClaw",
            description: "Write the current editor selection into a Lumina bridge note inside the workspace.",
            run: () => {
              void stageSelection();
            },
          },
        ],
      }),
    );

    disposeUi = () => {
      for (const dispose of disposers.reverse()) {
        dispose();
      }
    };
  };

  const unregisterView = api.workspace.registerTabType({
    type: OVERVIEW_TAB_TYPE,
    title: "OpenClaw Workspace",
    render: (payload) =>
      String(payload.html || "<p>OpenClaw workspace overview is unavailable.</p>"),
  });

  const offWorkspaceChanged = api.events.on("workspace:changed", () => {
    cachedSnapshot = null;
    void rebuildUi();
  });

  void rebuildUi();

  return () => {
    offWorkspaceChanged();
    cleanupUi();
    unregisterView();
  };
};
