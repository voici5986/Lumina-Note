import { describe, expect, it } from "vitest";
import type { DocxBlock } from "./docxImport";
import { docxBlocksToLineHeightPx } from "./docxText";

describe("docxBlocksToLineHeightPx", () => {
  it("returns the default when no paragraph style is present", () => {
    const blocks: DocxBlock[] = [
      { type: "paragraph", runs: [{ text: "Hello" }] },
    ];

    expect(docxBlocksToLineHeightPx(blocks, 20)).toBe(20);
  });

  it("uses auto line height as a multiplier", () => {
    const blocks: DocxBlock[] = [
      {
        type: "paragraph",
        runs: [{ text: "Hello" }],
        paragraphStyle: { lineHeight: 1.5, lineHeightRule: "auto" },
      },
    ];

    expect(docxBlocksToLineHeightPx(blocks, 20)).toBe(30);
  });

  it("uses exact line height in points", () => {
    const blocks: DocxBlock[] = [
      {
        type: "paragraph",
        runs: [{ text: "Hello" }],
        paragraphStyle: { lineHeight: 14, lineHeightRule: "exact" },
      },
    ];

    expect(docxBlocksToLineHeightPx(blocks, 20)).toBe(19);
  });

  it("keeps atLeast line height above the default", () => {
    const blocks: DocxBlock[] = [
      {
        type: "paragraph",
        runs: [{ text: "Hello" }],
        paragraphStyle: { lineHeight: 10, lineHeightRule: "atLeast" },
      },
    ];

    expect(docxBlocksToLineHeightPx(blocks, 20)).toBe(20);
  });

  it("reads line height from list items", () => {
    const blocks: DocxBlock[] = [
      {
        type: "list",
        ordered: false,
        items: [
          {
            runs: [{ text: "Item" }],
            paragraphStyle: { lineHeight: 2, lineHeightRule: "auto" },
          },
        ],
      },
    ];

    expect(docxBlocksToLineHeightPx(blocks, 20)).toBe(40);
  });
});
