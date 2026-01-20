import type {
  DocxBlock,
  DocxListBlock,
  DocxParagraphStyle,
  DocxTableBlock,
} from "./docxImport";

export function docxBlocksToPlainText(blocks: DocxBlock[]): string {
  return blocks
    .map((block) => blockToText(block))
    .filter((value) => value !== null)
    .join("\n");
}

export function docxBlocksToLineHeightPx(
  blocks: DocxBlock[],
  defaultLineHeightPx: number,
  dpi = 96,
): number {
  const style = findFirstParagraphStyle(blocks);
  if (!style || style.lineHeight === undefined) {
    return clampLineHeight(defaultLineHeightPx);
  }

  const lineHeight = style.lineHeight;
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    return clampLineHeight(defaultLineHeightPx);
  }

  switch (style.lineHeightRule ?? "auto") {
    case "exact":
      return clampLineHeight(pointsToPx(lineHeight, dpi));
    case "atLeast":
      return clampLineHeight(
        Math.max(defaultLineHeightPx, pointsToPx(lineHeight, dpi)),
      );
    case "auto":
    default:
      return clampLineHeight(defaultLineHeightPx * lineHeight);
  }
}

function blockToText(block: DocxBlock): string | null {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return block.runs.map((run) => run.text).join("");
    case "list":
      return listToText(block);
    case "table":
      return tableToText(block);
    case "image":
      return "[image]";
    default:
      return null;
  }
}

function listToText(block: DocxListBlock): string {
  return block.items
    .map((item) => item.runs.map((run) => run.text).join(""))
    .join("\n");
}

function tableToText(block: DocxTableBlock): string {
  return block.rows
    .map((row) =>
      row.cells
        .map((cell) =>
          cell.blocks
            .map((inner) => blockToText(inner))
            .filter((value): value is string => value !== null)
            .join(" "),
        )
        .join("\t"),
    )
    .join("\n");
}

function findFirstParagraphStyle(
  blocks: DocxBlock[],
): DocxParagraphStyle | undefined {
  for (const block of blocks) {
    if (block.type === "paragraph" || block.type === "heading") {
      if (block.paragraphStyle) {
        return block.paragraphStyle;
      }
      continue;
    }

    if (block.type === "list") {
      for (const item of block.items) {
        if (item.paragraphStyle) {
          return item.paragraphStyle;
        }
      }
      continue;
    }

    if (block.type === "table") {
      for (const row of block.rows) {
        for (const cell of row.cells) {
          const style = findFirstParagraphStyle(cell.blocks);
          if (style) {
            return style;
          }
        }
      }
    }
  }
  return undefined;
}

function pointsToPx(points: number, dpi: number): number {
  return (points * dpi) / 72;
}

function clampLineHeight(value: number): number {
  return Math.max(1, Math.round(value));
}
