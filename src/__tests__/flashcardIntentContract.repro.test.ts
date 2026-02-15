// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("flashcard intent contract bug repro", () => {
  it("repro: frontend intent type includes flashcard while rust TaskIntent does not", () => {
    const root = process.cwd();
    const tsIntentPath = path.join(root, "src/services/llm/types.ts");
    const rustIntentPath = path.join(root, "src-tauri/src/agent/types.rs");

    const tsIntent = fs.readFileSync(tsIntentPath, "utf8");
    const rustIntent = fs.readFileSync(rustIntentPath, "utf8");

    expect(tsIntent).toContain('"flashcard"');
    expect(rustIntent).toContain("pub enum TaskIntent");
    expect(rustIntent).not.toContain("Flashcard");
  });
});
