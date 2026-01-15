import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MainAIChatShell } from "./MainAIChatShell";
import { useUIStore } from "@/stores/useUIStore";
import { useFileStore } from "@/stores/useFileStore";

vi.mock("@/components/codex/CodexPanel", () => ({
  CodexPanel: ({ visible }: { visible: boolean }) => (
    <div data-testid="codex-panel" data-visible={visible ? "true" : "false"} />
  ),
}));

describe("MainAIChatShell", () => {
  beforeEach(() => {
    useUIStore.setState({ chatMode: "chat" });
    useFileStore.setState({ vaultPath: "/tmp" });
  });

  it("renders CodexPanel and hides chat input when in codex mode", () => {
    useUIStore.setState({ chatMode: "codex" });

    const { queryByRole } = render(<MainAIChatShell />);

    expect(screen.getByTestId("codex-panel")).toBeInTheDocument();
    expect(queryByRole("textbox")).toBeNull();
  });

  it("does not render CodexPanel in chat mode", () => {
    useUIStore.setState({ chatMode: "chat" });

    render(<MainAIChatShell />);

    expect(screen.queryByTestId("codex-panel")).toBeNull();
  });
});
