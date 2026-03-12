import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSidebarFileOperations } from "./useSidebarFileOperations";

function HookProbe() {
  const ops = useSidebarFileOperations();
  return <div>{ops.vaultPath ?? "no-vault"}</div>;
}

describe("useSidebarFileOperations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not trigger unstable getSnapshot warnings in StrictMode", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <StrictMode>
        <HookProbe />
      </StrictMode>,
    );

    expect(screen.getByText("no-vault")).toBeInTheDocument();
    expect(
      errorSpy.mock.calls.some((args) =>
        String(args[0]).includes("The result of getSnapshot should be cached"),
      ),
    ).toBe(false);
  });
});
