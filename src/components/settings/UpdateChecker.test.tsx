import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateChecker } from "./UpdateChecker";
import { useUpdateStore } from "@/stores/useUpdateStore";

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("UpdateChecker", () => {
  beforeEach(() => {
    useUpdateStore.setState({
      lastCheckTime: 0,
      skippedVersions: [],
      checkCooldownHours: 24,
      availableUpdate: {
        version: "9.9.9",
        body: "test notes",
        date: "2026-03-05",
      },
      updateHandle: null,
      hasUnreadUpdate: false,
      isChecking: false,
    });
  });

  it("keeps update flow running after unmount and records observable install state", async () => {
    const deferred = createDeferred<void>();
    let completed = false;

    const downloadAndInstall = vi.fn(async (onEvent?: (event: any) => void) => {
      onEvent?.({ event: "Started", data: { contentLength: 100 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 30 } });
      await deferred.promise;
      onEvent?.({ event: "Progress", data: { chunkLength: 70 } });
      onEvent?.({ event: "Finished" });
      completed = true;
    });

    useUpdateStore.setState({
      updateHandle: {
        downloadAndInstall,
      } as any,
    });

    const view = render(<UpdateChecker />);

    fireEvent.click(screen.getByRole("button", { name: /下载并安装/i }));

    await waitFor(() => {
      expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    });

    view.unmount();

    await act(async () => {
      deferred.resolve();
      await Promise.resolve();
    });

    expect(completed).toBe(true);

    const telemetry = (useUpdateStore.getState() as any).installTelemetry;
    expect(telemetry.phase).toBe("ready");
    expect(telemetry.progress).toBe(100);
  });

  it("does not surface stale ready telemetry when there is no current update", () => {
    useUpdateStore.setState({
      availableUpdate: null,
      hasUnreadUpdate: false,
      installTelemetry: {
        sessionId: 3,
        taskId: "task-stale",
        phase: "ready",
        attempt: 1,
        progress: 100,
        downloadedBytes: 42,
        contentLength: 42,
        startedAt: 1,
        updatedAt: 1,
        finishedAt: 1,
        error: null,
        errorCode: null,
        resumable: true,
        retryDelayMs: null,
        lastHttpStatus: 200,
        canResumeAfterRestart: true,
        capability: "supported",
      },
    });

    render(<UpdateChecker />);

    expect(screen.getByRole("button", { name: "检查更新" })).toBeInTheDocument();
    expect(screen.queryByText("重启应用")).not.toBeInTheDocument();
    expect(screen.queryByText("Update telemetry")).not.toBeInTheDocument();
  });
});
