import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { CodexPanel } from "./CodexPanel";

vi.mock("@/components/codex/CodexEmbeddedWebview", () => ({
  CodexEmbeddedWebview: ({ url }: { url?: string | null }) => (
    <div data-testid="codex-native" data-url={url ?? ""} />
  ),
}));

const invokeMock = invoke as unknown as ReturnType<typeof vi.fn>;

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => "token" },
  });
}

if (!globalThis.fetch) {
  Object.defineProperty(globalThis, "fetch", {
    value: vi.fn(),
  });
}

describe("CodexPanel", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("renders an iframe when using iframe mode", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "codex_extension_get_status") {
        return Promise.resolve({
          installed: true,
          version: "0.5.60",
          extensionPath: "C:\\\\ext",
          latestVersion: "0.5.60",
        });
      }
      if (cmd === "codex_vscode_host_start") {
        return Promise.resolve({ origin: "http://127.0.0.1:1234", port: 1234 });
      }
      return Promise.resolve(null);
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true } as Response);
    const cryptoSpy = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("token");

    render(<CodexPanel visible workspacePath="C:\\\\workspace" renderMode="iframe" />);

    await waitFor(() => {
      const iframe = document.querySelector("iframe");
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute("src") ?? "").toContain("/view/chatgpt.sidebarView");
    });

    expect(document.querySelector("[data-testid=\"codex-native\"]")).toBeNull();

    fetchSpy.mockRestore();
    cryptoSpy.mockRestore();
  });

  it("renders the native webview when using native mode", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "codex_extension_get_status") {
        return Promise.resolve({
          installed: true,
          version: "0.5.60",
          extensionPath: "C:\\\\ext",
          latestVersion: "0.5.60",
        });
      }
      if (cmd === "codex_vscode_host_start") {
        return Promise.resolve({ origin: "http://127.0.0.1:1234", port: 1234 });
      }
      return Promise.resolve(null);
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true } as Response);
    const cryptoSpy = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("token");

    render(<CodexPanel visible workspacePath="C:\\\\workspace" renderMode="native" />);

    await waitFor(() => {
      expect(document.querySelector("[data-testid=\"codex-native\"]")).not.toBeNull();
    });

    expect(document.querySelector("iframe")).toBeNull();

    fetchSpy.mockRestore();
    cryptoSpy.mockRestore();
  });
});
