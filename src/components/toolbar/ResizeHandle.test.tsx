import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResizeHandle } from "./ResizeHandle";

describe("ResizeHandle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses latest pointer position within the same animation frame", () => {
    const onResize = vi.fn();
    let rafCallback: FrameRequestCallback | null = null;

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const { container } = render(<ResizeHandle direction="left" onResize={onResize} />);
    const hitArea = container.querySelector(".z-30") as HTMLDivElement;

    fireEvent.mouseDown(hitArea, { clientX: 100 });

    fireEvent.mouseMove(document, { clientX: 110 });
    fireEvent.mouseMove(document, { clientX: 130 });

    expect(rafCallback).not.toBeNull();
    rafCallback?.(16);

    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenLastCalledWith(30);
  });
});
