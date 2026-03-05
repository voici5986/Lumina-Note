/**
 * 更新管理 Store
 * 负责自动检查更新、记录检查时间、管理跳过版本等
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { check, Update } from "@tauri-apps/plugin-updater";
import { reportOperationError } from "@/lib/reportError";
import { retryWithExponentialBackoff } from "@/lib/retry";

export const UPDATE_CHECK_TIMEOUT_MS = 15_000;
const UPDATE_CHECK_MAX_ATTEMPTS = 3;
const UPDATE_CHECK_BASE_DELAY_MS = 1_000;
const UPDATE_CHECK_MAX_DELAY_MS = 8_000;

export interface UpdateInfo {
  version: string;
  body: string | null;
  date: string | null;
}

export type UpdateInstallPhase = "idle" | "downloading" | "installing" | "ready" | "error";

export interface UpdateInstallTelemetry {
  sessionId: number;
  phase: UpdateInstallPhase;
  attempt: number;
  progress: number;
  downloadedBytes: number;
  contentLength: number;
  startedAt: number | null;
  updatedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

const createInitialInstallTelemetry = (): UpdateInstallTelemetry => ({
  sessionId: 0,
  phase: "idle",
  attempt: 0,
  progress: 0,
  downloadedBytes: 0,
  contentLength: 0,
  startedAt: null,
  updatedAt: null,
  finishedAt: null,
  error: null,
});

interface UpdateState {
  // 持久化数据
  lastCheckTime: number;
  skippedVersions: string[];
  checkCooldownHours: number;

  // 运行时状态
  availableUpdate: UpdateInfo | null;
  updateHandle: Update | null;
  hasUnreadUpdate: boolean;
  isChecking: boolean;
  installTelemetry: UpdateInstallTelemetry;

  // Actions
  setLastCheckTime: (time: number) => void;
  setAvailableUpdate: (update: UpdateInfo | null, handle?: Update | null) => void;
  setHasUnreadUpdate: (hasUnread: boolean) => void;
  setIsChecking: (checking: boolean) => void;
  skipVersion: (version: string) => void;
  clearSkippedVersion: (version: string) => void;
  setCheckCooldownHours: (hours: number) => void;
  isVersionSkipped: (version: string) => boolean;
  markUpdateAsRead: () => void;
  clearUpdate: () => void;
  beginInstallTelemetry: () => number;
  recordInstallStarted: (contentLength?: number) => void;
  recordInstallProgress: (chunkLength: number) => void;
  recordInstallInstalling: () => void;
  recordInstallRetry: (nextAttempt: number) => void;
  recordInstallReady: () => void;
  recordInstallError: (message: string) => void;
  resetInstallTelemetry: () => void;
}

export const useUpdateStore = create<UpdateState>()(
  persist(
    (set, get) => ({
      // 持久化数据
      lastCheckTime: 0,
      skippedVersions: [],
      checkCooldownHours: 24,

      // 运行时状态（不持久化）
      availableUpdate: null,
      updateHandle: null,
      hasUnreadUpdate: false,
      isChecking: false,
      installTelemetry: createInitialInstallTelemetry(),

      setLastCheckTime: (time) => set({ lastCheckTime: time }),

      setAvailableUpdate: (update, handle = null) =>
        set({
          availableUpdate: update,
          updateHandle: handle,
          hasUnreadUpdate: update !== null,
        }),

      setHasUnreadUpdate: (hasUnread) => set({ hasUnreadUpdate: hasUnread }),

      setIsChecking: (checking) => set({ isChecking: checking }),

      skipVersion: (version) =>
        set((state) => ({
          skippedVersions: state.skippedVersions.includes(version)
            ? state.skippedVersions
            : [...state.skippedVersions, version],
          hasUnreadUpdate: false,
          availableUpdate: null,
          updateHandle: null,
        })),

      clearSkippedVersion: (version) =>
        set((state) => ({
          skippedVersions: state.skippedVersions.filter((v) => v !== version),
        })),

      setCheckCooldownHours: (hours) => set({ checkCooldownHours: hours }),

      isVersionSkipped: (version) => get().skippedVersions.includes(version),

      markUpdateAsRead: () => set({ hasUnreadUpdate: false }),

      clearUpdate: () =>
        set({
          availableUpdate: null,
          updateHandle: null,
          hasUnreadUpdate: false,
        }),

      beginInstallTelemetry: () => {
        const nextSessionId = get().installTelemetry.sessionId + 1;
        const now = Date.now();
        set({
          installTelemetry: {
            sessionId: nextSessionId,
            phase: "downloading",
            attempt: 1,
            progress: 0,
            downloadedBytes: 0,
            contentLength: 0,
            startedAt: now,
            updatedAt: now,
            finishedAt: null,
            error: null,
          },
        });
        return nextSessionId;
      },

      recordInstallStarted: (contentLength = 0) =>
        set((state) => ({
          installTelemetry: {
            ...state.installTelemetry,
            phase: "downloading",
            contentLength: Number.isFinite(contentLength) && contentLength > 0 ? contentLength : state.installTelemetry.contentLength,
            updatedAt: Date.now(),
            error: null,
          },
        })),

      recordInstallProgress: (chunkLength) =>
        set((state) => {
          const delta = Number.isFinite(chunkLength) && chunkLength > 0 ? chunkLength : 0;
          const downloadedBytes = state.installTelemetry.downloadedBytes + delta;
          const contentLength = state.installTelemetry.contentLength;
          const progress =
            contentLength > 0 ? Math.min(100, (downloadedBytes / contentLength) * 100) : state.installTelemetry.progress;
          return {
            installTelemetry: {
              ...state.installTelemetry,
              phase: "downloading",
              downloadedBytes,
              progress,
              updatedAt: Date.now(),
              error: null,
            },
          };
        }),

      recordInstallInstalling: () =>
        set((state) => ({
          installTelemetry: {
            ...state.installTelemetry,
            phase: "installing",
            updatedAt: Date.now(),
            error: null,
          },
        })),

      recordInstallRetry: (nextAttempt) =>
        set((state) => ({
          installTelemetry: {
            ...state.installTelemetry,
            phase: "downloading",
            attempt: Math.max(1, nextAttempt),
            progress: 0,
            downloadedBytes: 0,
            contentLength: 0,
            updatedAt: Date.now(),
            error: null,
          },
        })),

      recordInstallReady: () =>
        set((state) => {
          const now = Date.now();
          return {
            installTelemetry: {
              ...state.installTelemetry,
              phase: "ready",
              progress: 100,
              updatedAt: now,
              finishedAt: now,
              error: null,
            },
          };
        }),

      recordInstallError: (message) =>
        set((state) => {
          const now = Date.now();
          return {
            installTelemetry: {
              ...state.installTelemetry,
              phase: "error",
              updatedAt: now,
              finishedAt: now,
              error: message,
            },
          };
        }),

      resetInstallTelemetry: () =>
        set((state) => ({
          installTelemetry: {
            ...createInitialInstallTelemetry(),
            sessionId: state.installTelemetry.sessionId,
          },
        })),
    }),
    {
      name: "lumina-update",
      partialize: (state) => ({
        lastCheckTime: state.lastCheckTime,
        skippedVersions: state.skippedVersions,
        checkCooldownHours: state.checkCooldownHours,
      }),
    }
  )
);

/**
 * 检查是否应该执行更新检查
 */
export function shouldCheckForUpdate(): boolean {
  const { lastCheckTime, checkCooldownHours } = useUpdateStore.getState();
  const now = Date.now();
  const cooldownMs = checkCooldownHours * 60 * 60 * 1000;
  return now - lastCheckTime > cooldownMs;
}

/**
 * 执行更新检查
 * @param force 强制检查，忽略冷却时间
 * @returns 是否有可用更新
 */
export async function checkForUpdate(force = false): Promise<boolean> {
  const store = useUpdateStore.getState();

  // 检查冷却时间
  if (!force && !shouldCheckForUpdate()) {
    return store.availableUpdate !== null;
  }

  // 防止并发检查
  if (store.isChecking) {
    return false;
  }

  store.setIsChecking(true);

  try {
    const updateResult = await retryWithExponentialBackoff(
      () => check({ timeout: UPDATE_CHECK_TIMEOUT_MS }),
      {
        maxAttempts: UPDATE_CHECK_MAX_ATTEMPTS,
        baseDelayMs: UPDATE_CHECK_BASE_DELAY_MS,
        maxDelayMs: UPDATE_CHECK_MAX_DELAY_MS,
        onRetry: ({ attempt, maxAttempts, nextDelayMs, error }) => {
          console.warn("[Update] check failed, retrying", {
            attempt,
            maxAttempts,
            nextDelayMs,
            timeoutMs: UPDATE_CHECK_TIMEOUT_MS,
            error,
          });
        },
      }
    );
    store.setLastCheckTime(Date.now());

    if (updateResult?.available) {
      const version = updateResult.version;

      // 检查是否被跳过
      if (store.isVersionSkipped(version)) {
        store.setAvailableUpdate(null);
        return false;
      }

      const updateInfo: UpdateInfo = {
        version,
        body: updateResult.body ?? null,
        date: updateResult.date ?? null,
      };

      store.setAvailableUpdate(updateInfo, updateResult);
      return true;
    } else {
      store.setAvailableUpdate(null);
      return false;
    }
  } catch (err) {
    reportOperationError({
      source: "useUpdateStore.checkForUpdate",
      action: "Auto check for updates",
      error: err,
      level: "warning",
    });
    return false;
  } finally {
    store.setIsChecking(false);
  }
}

/**
 * 初始化自动更新检查
 * 应在 App 启动时调用，会延迟执行以避免影响启动性能
 */
export function initAutoUpdateCheck(delayMs = 5000): void {
  setTimeout(async () => {
    const hasUpdate = await checkForUpdate();
    if (hasUpdate) {
      console.log(
        "[Update] New version available:",
        useUpdateStore.getState().availableUpdate?.version
      );
    }
  }, delayMs);
}

/**
 * 获取 Update handle 用于下载安装
 */
export function getUpdateHandle(): Update | null {
  return useUpdateStore.getState().updateHandle;
}
