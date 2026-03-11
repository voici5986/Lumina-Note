import { beforeEach, describe, expect, it, vi } from "vitest";

const existsMock = vi.hoisted(() => vi.fn<[string], Promise<boolean>>());
const createDirMock = vi.hoisted(() => vi.fn<[string, { recursive?: boolean }?], Promise<void>>());
const saveFileMock = vi.hoisted(() => vi.fn<[string, string], Promise<void>>());

vi.mock("@/lib/tauri", () => ({
  exists: existsMock,
  createDir: createDirMock,
  saveFile: saveFileMock,
}));

import {
  buildOpenClawTodayMemoryPath,
  ensureOpenClawTodayMemoryNote,
  inspectOpenClawWorkspace,
} from "./workspace";

describe("openclaw workspace helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T10:00:00Z"));
    existsMock.mockReset();
    createDirMock.mockReset();
    saveFileMock.mockReset();
    createDirMock.mockResolvedValue(undefined);
    saveFileMock.mockResolvedValue(undefined);
  });

  it("detects a workspace when required markers exist", async () => {
    const existingPaths = new Set([
      "/tmp/openclaw/AGENTS.md",
      "/tmp/openclaw/SOUL.md",
      "/tmp/openclaw/USER.md",
      "/tmp/openclaw/memory",
      "/tmp/openclaw/canvas",
    ]);
    existsMock.mockImplementation(async (path: string) => existingPaths.has(path));

    const snapshot = await inspectOpenClawWorkspace("/tmp/openclaw");

    expect(snapshot.status).toBe("detected");
    expect(snapshot.matchedRequiredFiles).toEqual(["AGENTS.md", "SOUL.md", "USER.md"]);
    expect(snapshot.matchedDirectories).toEqual(expect.arrayContaining(["memory", "canvas"]));
    expect(snapshot.artifactDirectoryPaths).toEqual(["/tmp/openclaw/canvas"]);
  });

  it("marks workspace as not detected when required markers are missing", async () => {
    existsMock.mockResolvedValue(false);

    const snapshot = await inspectOpenClawWorkspace("/tmp/not-openclaw");

    expect(snapshot.status).toBe("not-detected");
    expect(snapshot.missingRequiredFiles).toEqual(["AGENTS.md", "SOUL.md", "USER.md"]);
  });

  it("creates today's memory note when the daily file is missing", async () => {
    const expectedPath = buildOpenClawTodayMemoryPath("/tmp/openclaw", new Date("2026-03-11T10:00:00Z"));
    existsMock.mockImplementation(async (path: string) => path !== expectedPath);

    const notePath = await ensureOpenClawTodayMemoryNote(
      "/tmp/openclaw",
      new Date("2026-03-11T10:00:00Z"),
    );

    expect(notePath).toBe(expectedPath);
    expect(createDirMock).toHaveBeenCalledWith("/tmp/openclaw/memory", { recursive: true });
    expect(saveFileMock).toHaveBeenCalledWith(expectedPath, "# 2026-03-11\n\n");
  });
});
