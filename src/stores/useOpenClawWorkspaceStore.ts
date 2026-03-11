import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  inspectOpenClawWorkspace,
  inspectOpenClawWorkspaceTree,
  type OpenClawWorkspaceSnapshot,
} from "@/services/openclaw/workspace";
import type { FileEntry } from "@/lib/tauri";
import type { OpenClawWorkspaceAttachment } from "@/types/openclaw";

type AttachWorkspaceInput = {
  workspacePath: string;
  gateway?: Partial<OpenClawWorkspaceAttachment["gateway"]>;
};

interface OpenClawWorkspaceState {
  snapshotsByPath: Record<string, OpenClawWorkspaceSnapshot>;
  attachmentsByPath: Record<string, OpenClawWorkspaceAttachment>;
  activeWorkspacePath: string | null;
  isRefreshing: boolean;
  lastError: string | null;
  refreshWorkspace: (path?: string | null) => Promise<OpenClawWorkspaceSnapshot | null>;
  getSnapshot: (path?: string | null) => OpenClawWorkspaceSnapshot | null;
  clearSnapshot: (path: string) => void;
  getAttachment: (path?: string | null) => OpenClawWorkspaceAttachment | null;
  attachWorkspace: (input: AttachWorkspaceInput) => OpenClawWorkspaceAttachment;
  detachWorkspace: (path: string) => void;
  refreshAttachmentScan: (
    workspacePath: string,
    fileTree?: FileEntry[],
  ) => OpenClawWorkspaceAttachment | null;
  markUnavailable: (path: string) => void;
}

function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function applySnapshotToAttachment(
  attachment: OpenClawWorkspaceAttachment,
  snapshot: OpenClawWorkspaceSnapshot,
): OpenClawWorkspaceAttachment {
  return {
    ...attachment,
    status: snapshot.status === "error" ? "unavailable" : "attached",
    lastValidatedAt: toIsoString(snapshot.checkedAt),
    detectedFiles: snapshot.editablePriorityFiles,
    detectedFolders: snapshot.matchedDirectories,
  };
}

export const useOpenClawWorkspaceStore = create<OpenClawWorkspaceState>()(
  persist(
    (set, get) => ({
      snapshotsByPath: {},
      attachmentsByPath: {},
      activeWorkspacePath: null,
      isRefreshing: false,
      lastError: null,
      refreshWorkspace: async (path) => {
        if (!path) {
          set({ activeWorkspacePath: null, isRefreshing: false, lastError: null });
          return null;
        }

        set({ activeWorkspacePath: path, isRefreshing: true, lastError: null });
        const snapshot = await inspectOpenClawWorkspace(path);
        set((state) => ({
          snapshotsByPath: {
            ...state.snapshotsByPath,
            [path]: snapshot,
          },
          attachmentsByPath: state.attachmentsByPath[path]
            ? {
                ...state.attachmentsByPath,
                [path]: applySnapshotToAttachment(state.attachmentsByPath[path], snapshot),
              }
            : state.attachmentsByPath,
          activeWorkspacePath: path,
          isRefreshing: false,
          lastError: snapshot.status === "error" ? snapshot.error : null,
        }));
        return snapshot;
      },
      getSnapshot: (path) => {
        const targetPath = path ?? get().activeWorkspacePath;
        if (!targetPath) return null;
        return get().snapshotsByPath[targetPath] ?? null;
      },
      clearSnapshot: (path) =>
        set((state) => {
          const next = { ...state.snapshotsByPath };
          delete next[path];
          return {
            snapshotsByPath: next,
            activeWorkspacePath: state.activeWorkspacePath === path ? null : state.activeWorkspacePath,
          };
        }),
      getAttachment: (path) => {
        const targetPath = path ?? get().activeWorkspacePath;
        if (!targetPath) return null;
        return get().attachmentsByPath[targetPath] ?? null;
      },
      attachWorkspace: ({ workspacePath, gateway }) => {
        const nowIso = new Date().toISOString();
        const existing = get().attachmentsByPath[workspacePath];
        const attachment: OpenClawWorkspaceAttachment = existing
          ? {
              ...existing,
              gateway: {
                ...existing.gateway,
                ...gateway,
              },
            }
          : {
              kind: "openclaw",
              workspacePath,
              status: "attached",
              attachedAt: nowIso,
              lastValidatedAt: null,
              detectedFiles: [],
              detectedFolders: [],
              gateway: {
                enabled: gateway?.enabled ?? false,
                endpoint: gateway?.endpoint ?? null,
              },
            };
        set((state) => ({
          attachmentsByPath: {
            ...state.attachmentsByPath,
            [workspacePath]: attachment,
          },
          activeWorkspacePath: workspacePath,
        }));
        return attachment;
      },
      detachWorkspace: (path) =>
        set((state) => {
          const next = { ...state.attachmentsByPath };
          delete next[path];
          return { attachmentsByPath: next };
        }),
      refreshAttachmentScan: (workspacePath, fileTree) => {
        const snapshot = fileTree
          ? inspectOpenClawWorkspaceTree(workspacePath, fileTree)
          : get().getSnapshot(workspacePath);
        if (!snapshot) {
          return get().getAttachment(workspacePath);
        }
        const existingAttachment = get().attachmentsByPath[workspacePath];
        set((state) => ({
          snapshotsByPath: {
            ...state.snapshotsByPath,
            [workspacePath]: snapshot,
          },
          attachmentsByPath: existingAttachment
            ? {
                ...state.attachmentsByPath,
                [workspacePath]: applySnapshotToAttachment(existingAttachment, snapshot),
              }
            : state.attachmentsByPath,
          activeWorkspacePath: workspacePath,
          lastError: snapshot.status === "error" ? snapshot.error : null,
        }));
        return existingAttachment
          ? applySnapshotToAttachment(existingAttachment, snapshot)
          : null;
      },
      markUnavailable: (path) =>
        set((state) => ({
          attachmentsByPath: state.attachmentsByPath[path]
            ? {
                ...state.attachmentsByPath,
                [path]: {
                  ...state.attachmentsByPath[path],
                  status: "unavailable",
                  lastValidatedAt: new Date().toISOString(),
                },
              }
            : state.attachmentsByPath,
        })),
    }),
    {
      name: "lumina-openclaw-workspaces",
      partialize: (state) => ({
        snapshotsByPath: state.snapshotsByPath,
        attachmentsByPath: state.attachmentsByPath,
        activeWorkspacePath: state.activeWorkspacePath,
      }),
    },
  ),
);
