// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("flashcard router prompt wiring repro", () => {
  it("repro: ai system prompt builder only uses chat/edit prompts, not router prompt", () => {
    const aiServicePath = path.join(process.cwd(), "src/services/ai/ai.ts");
    const content = fs.readFileSync(aiServicePath, "utf8");

    expect(content).toContain("const chatPrompt = t.prompts.chat");
    expect(content).toContain("const editPrompt = t.prompts.edit");
    expect(content).not.toContain("t.prompts.router");
  });
});
