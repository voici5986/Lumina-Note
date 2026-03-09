import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(path.resolve(__dirname, "globals.css"), "utf8");

const extractBlock = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = globalsCss.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n  \\}`, "m"));
  return match?.[1] ?? "";
};

describe("ui-app-bg", () => {
  it("does not include primary blue glow layers in light or dark mode", () => {
    const lightBlock = extractBlock(".ui-app-bg");
    const darkBlock = extractBlock(".dark .ui-app-bg");

    expect(lightBlock).not.toContain("--primary");
    expect(darkBlock).not.toContain("--primary");
  });
});
