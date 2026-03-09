import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MacLeftPaneTopBar } from "./MacLeftPaneTopBar";

const toggleLeftSidebar = vi.fn();

vi.mock("@/stores/useUIStore", () => ({
  useUIStore: (selector: (state: unknown) => unknown) =>
    selector({
      toggleLeftSidebar,
    }),
}));

vi.mock("@/stores/useLocaleStore", () => ({
  useLocaleStore: () => ({
    t: {
      sidebar: {
        files: "Files",
      },
    },
  }),
}));

describe("MacLeftPaneTopBar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toggleLeftSidebar.mockReset();
  });

  it("reserves a dedicated traffic-light safe area and keeps the collapse control interactive", () => {
    render(<MacLeftPaneTopBar />);

    expect(screen.getByTestId("mac-left-pane-traffic-lights-safe-area")).toHaveAttribute(
      "data-tauri-drag-region",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Files" }));

    expect(toggleLeftSidebar).toHaveBeenCalledTimes(1);
  });

  it("uses a full-height control row so left controls align like the right top bar", () => {
    const { container } = render(<MacLeftPaneTopBar />);

    expect(container.firstElementChild).toHaveClass("h-11");
    expect(container.firstElementChild).toHaveClass("items-stretch");
    expect(screen.getByTestId("mac-left-pane-controls")).toHaveClass("h-full");
    expect(screen.getByTestId("mac-left-pane-controls")).toHaveClass("items-center");
    expect(screen.getByTestId("mac-left-pane-controls")).toHaveClass("pl-2");
  });

  it("keeps the custom controls vertically centered within the 44px top bar", () => {
    render(<MacLeftPaneTopBar />);

    expect(screen.getByTestId("mac-left-pane-controls")).not.toHaveClass("-translate-y-[6px]");
  });
});
