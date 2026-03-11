import { RefreshCw } from "lucide-react";
import { useLocaleStore } from "@/stores/useLocaleStore";
import { useFileStore } from "@/stores/useFileStore";
import { useOpenClawWorkspaceStore } from "@/stores/useOpenClawWorkspaceStore";
import {
  ensureOpenClawTodayMemoryNote,
  type OpenClawWorkspaceSnapshot,
} from "@/services/openclaw/workspace";
import { join } from "@/lib/path";
import { exists } from "@/lib/tauri";

function formatCheckedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

async function openIfExists(
  snapshot: OpenClawWorkspaceSnapshot | null,
  path: string,
  openFile: (path: string) => Promise<void>,
): Promise<void> {
  if (!snapshot || !(await exists(path))) return;
  await openFile(path);
}

export function OpenClawWorkspaceSection() {
  const { t } = useLocaleStore();
  const vaultPath = useFileStore((state) => state.vaultPath);
  const openFile = useFileStore((state) => state.openFile);
  const {
    getSnapshot,
    getAttachment,
    refreshWorkspace,
    attachWorkspace,
    detachWorkspace,
    refreshAttachmentScan,
    isRefreshing,
  } = useOpenClawWorkspaceStore((state) => ({
    getSnapshot: state.getSnapshot,
    getAttachment: state.getAttachment,
    refreshWorkspace: state.refreshWorkspace,
    attachWorkspace: state.attachWorkspace,
    detachWorkspace: state.detachWorkspace,
    refreshAttachmentScan: state.refreshAttachmentScan,
    isRefreshing: state.isRefreshing,
  }));

  const snapshot = getSnapshot(vaultPath);
  const attachment = getAttachment(vaultPath);

  const handleOpenAgents = async () => {
    if (!snapshot) return;
    await openIfExists(snapshot, join(snapshot.workspacePath, "AGENTS.md"), openFile);
  };

  const handleOpenTodayMemory = async () => {
    if (!vaultPath) return;
    const path = await ensureOpenClawTodayMemoryNote(vaultPath);
    await openFile(path);
    void refreshWorkspace(vaultPath);
  };

  const handleAttach = () => {
    if (!vaultPath) return;
    attachWorkspace({ workspacePath: vaultPath });
    refreshAttachmentScan(vaultPath);
  };

  const handleDetach = () => {
    if (!vaultPath) return;
    detachWorkspace(vaultPath);
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t.settingsModal.openClawTitle}
          </h3>
          <p className="text-sm text-muted-foreground">{t.settingsModal.openClawDesc}</p>
        </div>
        <button
          type="button"
          onClick={() => void refreshWorkspace(vaultPath)}
          disabled={!vaultPath || isRefreshing}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRefreshing ? "animate-spin" : undefined} />
          {t.settingsModal.openClawRescan}
        </button>
      </div>

      {!vaultPath && (
        <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          {t.settingsModal.openClawNoWorkspace}
        </div>
      )}

      {vaultPath && snapshot && (
        <div className="space-y-3 rounded-lg border border-border bg-background/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                snapshot.status === "detected"
                  ? "bg-emerald-500/15 text-emerald-700"
                  : snapshot.status === "error"
                    ? "bg-red-500/10 text-red-600"
                    : "bg-amber-500/15 text-amber-700"
              }`}
            >
              {snapshot.status === "detected"
                ? t.settingsModal.openClawDetected
                : snapshot.status === "error"
                  ? t.settingsModal.openClawError
                  : t.settingsModal.openClawNotDetected}
            </span>
            {attachment && (
              <span className="rounded-full bg-sky-500/15 px-2 py-1 text-[11px] font-medium text-sky-700">
                {t.settingsModal.openClawAttached}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {t.settingsModal.openClawCheckedAt.replace("{time}", formatCheckedAt(snapshot.checkedAt))}
            </span>
          </div>

          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium">{t.settingsModal.openClawWorkspacePath}</span>
              <p className="break-all text-muted-foreground">{snapshot.workspacePath}</p>
            </div>

            <div>
              <span className="font-medium">{t.settingsModal.openClawMatchedFiles}</span>
              <p className="text-muted-foreground">
                {snapshot.editablePriorityFiles.length > 0
                  ? snapshot.editablePriorityFiles.join(", ")
                  : t.common.empty}
              </p>
            </div>

            {snapshot.missingRequiredFiles.length > 0 && (
              <div>
                <span className="font-medium">{t.settingsModal.openClawMissingFiles}</span>
                <p className="text-muted-foreground">{snapshot.missingRequiredFiles.join(", ")}</p>
              </div>
            )}

            {snapshot.artifactDirectoryPaths.length > 0 && (
              <div>
                <span className="font-medium">{t.settingsModal.openClawArtifactDirs}</span>
                <p className="break-all text-muted-foreground">
                  {snapshot.artifactDirectoryPaths.join(", ")}
                </p>
              </div>
            )}

            <div>
              <span className="font-medium">{t.settingsModal.openClawBoundary}</span>
              <p className="text-muted-foreground">{t.settingsModal.openClawBoundaryHint}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!attachment && snapshot.status === "detected" && (
              <button
                type="button"
                onClick={handleAttach}
                className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                {t.settingsModal.openClawAttach}
              </button>
            )}
            {attachment && (
              <button
                type="button"
                onClick={handleDetach}
                className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                {t.settingsModal.openClawDetach}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleOpenAgents()}
              disabled={snapshot.status !== "detected"}
              className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {t.settingsModal.openClawOpenAgents}
            </button>
            <button
              type="button"
              onClick={() => void handleOpenTodayMemory()}
              disabled={snapshot.status === "error"}
              className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {t.settingsModal.openClawOpenTodayMemory}
            </button>
          </div>

          {snapshot.error && <p className="text-xs text-red-600">{snapshot.error}</p>}
        </div>
      )}
    </section>
  );
}
