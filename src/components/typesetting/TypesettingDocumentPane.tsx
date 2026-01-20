import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { exists, writeFile } from "@tauri-apps/plugin-fs";
import { join, tempDir } from "@tauri-apps/api/path";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import { useTypesettingDocStore } from "@/stores/useTypesettingDocStore";
import { useFileStore } from "@/stores/useFileStore";
import {
  getTypesettingExportPdfBase64,
  getTypesettingFixtureFontPath,
  getTypesettingLayoutText,
  getTypesettingPreviewPageMm,
  TypesettingPreviewBoxMm,
  TypesettingPreviewPageMm,
  TypesettingTextLine,
} from "@/lib/tauri";
import { decodeBase64ToBytes, encodeBytesToBase64 } from "@/typesetting/base64";
import { docxBlocksToHtml, docxHtmlToBlocks } from "@/typesetting/docxHtml";
import {
  docxBlocksToFontSizePx,
  docxBlocksToLineHeightPx,
  docxBlocksToLayoutTextOptions,
  docxBlocksToPlainText,
  DOCX_IMAGE_PLACEHOLDER,
} from "@/typesetting/docxText";
import { getDefaultPreviewPageMm } from "@/typesetting/previewDefaults";
import { docOpFromBeforeInput } from "@/typesetting/docOps";
import { sliceUtf8 } from "@/typesetting/utf8";
import type { TypesettingDoc } from "@/stores/useTypesettingDocStore";
import type { DocxBlock, DocxImageBlock, DocxListBlock, DocxParagraphStyle, DocxRun, DocxTableBlock } from "@/typesetting/docxImport";

type TypesettingDocumentPaneProps = {
  path: string;
  onExportReady?: ((exporter: (() => Promise<Uint8Array>) | null) => void) | null;
  autoOpen?: boolean;
};

const DEFAULT_DPI = 96;
const DEFAULT_FONT_SIZE_PX = 16;
const DEFAULT_LINE_HEIGHT_PX = 20;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const EMU_PER_INCH = 914400;
const WINDOWS_FONT_DIR = "C:\\Windows\\Fonts";

const FONT_FAMILY_FILES: Record<string, string[]> = {
  "simsun": ["simsun.ttc"],
  "宋体": ["simsun.ttc"],
  "simhei": ["simhei.ttf"],
  "黑体": ["simhei.ttf"],
  "microsoft yahei": ["msyh.ttc", "msyh.ttf"],
  "微软雅黑": ["msyh.ttc", "msyh.ttf"],
  "times new roman": ["times.ttf", "timesbd.ttf"],
  "arial": ["arial.ttf"],
  "calibri": ["calibri.ttf"],
  "cambria": ["cambria.ttc"],
};

type LayoutRender = {
  text: string;
  fontSizePx: number;
  lineHeightPx: number;
  lines: TypesettingTextLine[];
};

type RenderedLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSizePx?: number;
  lineHeightPx?: number;
};

type RenderedImage = {
  src: string;
  alt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  embedId: string;
};

const mmToPx = (mm: number, dpi = DEFAULT_DPI) =>
  Math.round((Math.max(0, mm) * dpi) / 25.4);

const boxToPx = (box: TypesettingPreviewBoxMm) => ({
  left: mmToPx(box.x_mm),
  top: mmToPx(box.y_mm),
  width: mmToPx(box.width_mm),
  height: mmToPx(box.height_mm),
});

const clampZoom = (value: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

const roundZoom = (value: number) => Math.round(value * 100) / 100;

const scalePx = (value: number, zoom: number) => Math.round(value * zoom);

const scaleBoxPx = (
  box: ReturnType<typeof boxToPx>,
  zoom: number,
) => ({
  left: scalePx(box.left, zoom),
  top: scalePx(box.top, zoom),
  width: scalePx(box.width, zoom),
  height: scalePx(box.height, zoom),
});

const defaultLineHeightForFont = (fontSizePx: number) =>
  Math.max(1, Math.round(fontSizePx * 1.2));

const stripImagePlaceholder = (value: string) =>
  value.replaceAll(DOCX_IMAGE_PLACEHOLDER, "");

const buildRenderedLines = (
  text: string,
  lines: TypesettingTextLine[],
  lineStyles?: Array<{ fontSizePx: number; lineHeightPx: number }>,
): RenderedLine[] => {
  if (!text || lines.length === 0) return [];
  const rendered: RenderedLine[] = [];
  for (const [index, line] of lines.entries()) {
    const raw = sliceUtf8(text, line.start_byte, line.end_byte);
    if (!raw) continue;
    const cleaned = stripImagePlaceholder(raw);
    if (!cleaned && raw.includes(DOCX_IMAGE_PLACEHOLDER)) {
      continue;
    }
    const style = lineStyles?.[index];
    rendered.push({
      text: cleaned,
      x: line.x_offset,
      y: line.y_offset,
      width: line.width,
      fontSizePx: style?.fontSizePx,
      lineHeightPx: style?.lineHeightPx,
    });
  }
  return rendered;
};

const collectImageBlocks = (blocks: DocxBlock[]): DocxImageBlock[] => {
  const images: DocxImageBlock[] = [];
  for (const block of blocks) {
    if (block.type === "image") {
      images.push(block);
      continue;
    }
    if (block.type === "table") {
      for (const row of block.rows) {
        for (const cell of row.cells) {
          images.push(...collectImageBlocks(cell.blocks));
        }
      }
    }
  }
  return images;
};

const emuToPx = (emu: number, dpi = DEFAULT_DPI): number => {
  if (!Number.isFinite(emu) || emu <= 0) return 0;
  const px = (emu / EMU_PER_INCH) * dpi;
  return Math.max(1, Math.round(px));
};

const imageBlockSizePx = (
  block: DocxImageBlock,
  fallbackPx: number,
): { width: number; height: number } => {
  const width = block.widthEmu ? emuToPx(block.widthEmu) : 0;
  const height = block.heightEmu ? emuToPx(block.heightEmu) : 0;
  return {
    width: width > 0 ? width : Math.max(1, fallbackPx),
    height: height > 0 ? height : Math.max(1, fallbackPx),
  };
};

const buildRenderedImages = (
  layout: LayoutRender | null,
  blocks: DocxBlock[],
  resolveImage?: (embedId: string) => { src: string; alt?: string } | null,
): RenderedImage[] => {
  if (!layout || !resolveImage) return [];
  const images = collectImageBlocks(blocks);
  if (images.length === 0) return [];
  let imageIndex = 0;
  const rendered: RenderedImage[] = [];
  for (const line of layout.lines) {
    if (imageIndex >= images.length) break;
    const lineText = sliceUtf8(layout.text, line.start_byte, line.end_byte);
    if (!lineText.includes(DOCX_IMAGE_PLACEHOLDER)) {
      continue;
    }
    const image = images[imageIndex];
    imageIndex += 1;
    const resolved = resolveImage(image.embedId);
    if (!resolved?.src) {
      continue;
    }
    const size = imageBlockSizePx(image, layout.lineHeightPx);
    rendered.push({
      src: resolved.src,
      alt: resolved.alt ?? image.description ?? image.embedId,
      x: line.x_offset,
      y: line.y_offset,
      width: size.width,
      height: size.height,
      embedId: image.embedId,
    });
  }
  return rendered;
};

const imageMimeType = (path: string): string | null => {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    default:
      return null;
  }
};

const normalizeFontFamily = (value: string): string =>
  value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();

const fontCandidatesForFamily = (family: string): string[] => {
  const normalized = normalizeFontFamily(family);
  const direct = FONT_FAMILY_FILES[normalized];
  if (direct) return direct;
  const noSpaces = normalized.replace(/\s+/g, "");
  const alias = FONT_FAMILY_FILES[noSpaces];
  return alias ?? [];
};

const resolveDocxImage = (
  doc: TypesettingDoc,
  embedId: string,
): { src: string; alt?: string } | null => {
  const target = doc.relationships[embedId];
  if (!target) return null;
  const normalized = target
    .replace(/^[\\/]+/, "")
    .replace(/^(\.\.\/)+/, "");
  const mediaPath = normalized.startsWith("word/")
    ? normalized
    : `word/${normalized}`;
  const bytes = doc.media[mediaPath];
  if (!bytes) return null;
  const mime = imageMimeType(mediaPath);
  if (!mime) return null;
  const base64 = encodeBytesToBase64(bytes);
  return { src: `data:${mime};base64,${base64}`, alt: embedId };
};

const getUtf8ByteLength = (value: string): number =>
  new TextEncoder().encode(value).length;

type ParagraphSegment = {
  text: string;
  options: ReturnType<typeof docxBlocksToLayoutTextOptions>;
  lineHeightPx: number;
  fontSizePx: number;
  fontFamily?: string;
};

const joinRunsText = (runs: DocxRun[]) => runs.map((run) => run.text).join("");

const firstRunFontFamilyFromRuns = (runs: DocxRun[]): string | undefined =>
  runs.find((run) => run.style?.font)?.style?.font;

const firstRunFontFamilyFromBlocks = (blocks: DocxBlock[]): string | undefined => {
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
      case "heading": {
        const font = firstRunFontFamilyFromRuns(block.runs);
        if (font) return font;
        break;
      }
      case "list": {
        for (const item of block.items) {
          const font = firstRunFontFamilyFromRuns(item.runs);
          if (font) return font;
        }
        break;
      }
      case "table":
        for (const row of block.rows) {
          for (const cell of row.cells) {
            const font = firstRunFontFamilyFromBlocks(cell.blocks);
            if (font) return font;
          }
        }
        break;
      default:
        break;
    }
  }
  return undefined;
};

const buildParagraphSegment = (
  runs: DocxRun[],
  paragraphStyle: DocxParagraphStyle | undefined,
  defaultFontSizePx: number,
  defaultLineHeightPx: number,
  dpi: number,
): ParagraphSegment => {
  const block: DocxBlock = {
    type: "paragraph",
    runs,
    paragraphStyle,
  };
  const text = joinRunsText(runs) || " ";
  return {
    text,
    options: docxBlocksToLayoutTextOptions([block], dpi),
    lineHeightPx: docxBlocksToLineHeightPx([block], defaultLineHeightPx, dpi),
    fontSizePx: docxBlocksToFontSizePx([block], defaultFontSizePx, dpi),
    fontFamily: firstRunFontFamilyFromRuns(runs),
  };
};

const buildSegmentsFromList = (
  block: DocxListBlock,
  defaultFontSizePx: number,
  defaultLineHeightPx: number,
  dpi: number,
): ParagraphSegment[] =>
  block.items.map((item) =>
    buildParagraphSegment(
      item.runs,
      item.paragraphStyle,
      defaultFontSizePx,
      defaultLineHeightPx,
      dpi,
    ),
  );

const buildSegmentsFromTable = (
  block: DocxTableBlock,
  defaultFontSizePx: number,
  defaultLineHeightPx: number,
  dpi: number,
): ParagraphSegment[] => {
  const styleBlock: DocxBlock = block;
  const options = docxBlocksToLayoutTextOptions([styleBlock], dpi);
  const lineHeightPx = docxBlocksToLineHeightPx(
    [styleBlock],
    defaultLineHeightPx,
    dpi,
  );
  const fontSizePx = docxBlocksToFontSizePx([styleBlock], defaultFontSizePx, dpi);
  const fontFamily = firstRunFontFamilyFromBlocks([block]);
  return block.rows.map((row) => {
    const rowText = row.cells
      .map((cell) => docxBlocksToPlainText(cell.blocks).replace(/\n+/g, " ").trim())
      .join("\t");
    return {
      text: rowText || " ",
      options,
      lineHeightPx,
      fontSizePx,
      fontFamily,
    };
  });
};

const buildSegmentsFromBlocks = (
  blocks: DocxBlock[],
  defaultFontSizePx: number,
  defaultLineHeightPx: number,
  dpi: number,
): ParagraphSegment[] => {
  const segments: ParagraphSegment[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
      case "heading":
        segments.push(
          buildParagraphSegment(
            block.runs,
            block.paragraphStyle,
            defaultFontSizePx,
            defaultLineHeightPx,
            dpi,
          ),
        );
        break;
      case "list":
        segments.push(
          ...buildSegmentsFromList(
            block,
            defaultFontSizePx,
            defaultLineHeightPx,
            dpi,
          ),
        );
        break;
      case "table":
        segments.push(
          ...buildSegmentsFromTable(
            block,
            defaultFontSizePx,
            defaultLineHeightPx,
            dpi,
          ),
        );
        break;
      case "image": {
        const size = imageBlockSizePx(block, defaultLineHeightPx);
        segments.push({
          text: DOCX_IMAGE_PLACEHOLDER,
          options: { align: "left", firstLineIndentPx: 0, spaceBeforePx: 0, spaceAfterPx: 0 },
          lineHeightPx: Math.max(defaultLineHeightPx, size.height),
          fontSizePx: defaultFontSizePx,
        });
        break;
      }
      default:
        break;
    }
  }
  return segments;
};

export function TypesettingDocumentPane({ path, onExportReady, autoOpen = true }: TypesettingDocumentPaneProps) {
  const { save: saveActiveFile, markTypesettingTabDirty } = useFileStore();
  const {
    docs,
    openDoc,
    updateDocBlocks,
    updateLayoutSummary,
    updateLayoutCache,
    recordDocOp,
    exportDocx,
  } = useTypesettingDocStore();
  const doc = docs[path];
  const [error, setError] = useState<string | null>(null);
  const [pageMm, setPageMm] = useState<TypesettingPreviewPageMm | null>(null);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportDocxError, setExportDocxError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [bodyLayout, setBodyLayout] = useState<LayoutRender | null>(null);
  const [headerLayout, setHeaderLayout] = useState<LayoutRender | null>(null);
  const [footerLayout, setFooterLayout] = useState<LayoutRender | null>(null);
  const [bodyLineStyles, setBodyLineStyles] = useState<Array<{ fontSizePx: number; lineHeightPx: number }>>([]);
  const [fallbackContentHeightPx, setFallbackContentHeightPx] = useState<number | null>(null);
  const [pageMounted, setPageMounted] = useState(false);
  const editableRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const fontPathCache = useRef(new Map<string, string>());
  const layoutRunRef = useRef(0);
  const exportReady = Boolean(pageMm && pageMounted);

  const handlePageRef = useCallback((node: HTMLDivElement | null) => {
    pageRef.current = node;
    setPageMounted(Boolean(node));
  }, []);

  useEffect(() => {
    if (!autoOpen) return;
    if (doc) return;
    openDoc(path).catch((err) => setError(String(err)));
  }, [autoOpen, doc, openDoc, path]);

  useEffect(() => {
    if (doc && error) {
      setError(null);
    }
  }, [doc, error]);

  useEffect(() => {
    let active = true;
    getTypesettingPreviewPageMm()
      .then((data) => {
        if (active) {
          setPageMm(data);
        }
      })
      .catch((err) => {
        if (active) {
          console.warn("Typesetting preview fallback:", err);
          setPageMm(getDefaultPreviewPageMm());
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const resolveFontPath = async (
    family: string | undefined,
    fallbackPath: string,
  ): Promise<string> => {
    if (!family) return fallbackPath;
    const normalized = normalizeFontFamily(family);
    const cached = fontPathCache.current.get(normalized);
    if (cached) {
      return cached;
    }
    const candidates = fontCandidatesForFamily(family);
    for (const fileName of candidates) {
      const candidatePath = `${WINDOWS_FONT_DIR}\\${fileName}`;
      try {
        if (await exists(candidatePath)) {
          fontPathCache.current.set(normalized, candidatePath);
          return candidatePath;
        }
      } catch {
        // Ignore permission errors and fall back to fixture font.
      }
    }
    fontPathCache.current.set(normalized, fallbackPath);
    return fallbackPath;
  };

  useEffect(() => {
    if (!doc || !pageMm) {
      setBodyLayout(null);
      setHeaderLayout(null);
      setFooterLayout(null);
      setBodyLineStyles([]);
      return;
    }
    setLayoutError(null);

    const segments = buildSegmentsFromBlocks(
      doc.blocks,
      DEFAULT_FONT_SIZE_PX,
      DEFAULT_LINE_HEIGHT_PX,
      DEFAULT_DPI,
    );
    const headerText = docxBlocksToPlainText(doc.headerBlocks);
    const footerText = docxBlocksToPlainText(doc.footerBlocks);
    const headerUsesEngine = headerText.trim().length > 0;
    const footerUsesEngine = footerText.trim().length > 0;

    if (!headerUsesEngine) {
      setHeaderLayout(null);
    }
    if (!footerUsesEngine) {
      setFooterLayout(null);
    }

    const runId = ++layoutRunRef.current;
    const handler = setTimeout(async () => {
      let fontPath: string | null = null;
      try {
        fontPath = await getTypesettingFixtureFontPath();
      } catch (err) {
        setLayoutError(String(err));
        updateLayoutSummary(path, "Layout unavailable");
        setBodyLayout(null);
        setHeaderLayout(null);
        setFooterLayout(null);
        setBodyLineStyles([]);
        return;
      }
      if (layoutRunRef.current !== runId) return;
      if (!fontPath) {
        setLayoutError("missing fixture font");
        updateLayoutSummary(path, "Layout unavailable");
        setBodyLayout(null);
        setHeaderLayout(null);
        setFooterLayout(null);
        setBodyLineStyles([]);
        return;
      }
      try {
        const headerFontFamily = firstRunFontFamilyFromBlocks(doc.headerBlocks);
        const footerFontFamily = firstRunFontFamilyFromBlocks(doc.footerBlocks);
        const resolvedHeaderFontPath = await resolveFontPath(headerFontFamily, fontPath);
        const resolvedFooterFontPath = await resolveFontPath(footerFontFamily, fontPath);

        const buildHeaderFooterLayout = async (
          blocks: DocxBlock[],
          content: string,
          maxWidthMm: number,
          fontPathOverride: string,
        ): Promise<LayoutRender> => {
          const fontSize = docxBlocksToFontSizePx(
            blocks,
            DEFAULT_FONT_SIZE_PX,
            DEFAULT_DPI,
          );
          const lineHeight = docxBlocksToLineHeightPx(
            blocks,
            defaultLineHeightForFont(fontSize),
            DEFAULT_DPI,
          );
          const options = docxBlocksToLayoutTextOptions(blocks, DEFAULT_DPI);
          const layout = await getTypesettingLayoutText({
            text: content,
            fontPath: fontPathOverride,
            maxWidth: mmToPx(maxWidthMm),
            lineHeight,
            fontSize,
            align: options.align,
            firstLineIndent: options.firstLineIndentPx,
            spaceBefore: options.spaceBeforePx,
            spaceAfter: options.spaceAfterPx,
          });
          return {
            text: content,
            fontSizePx: fontSize,
            lineHeightPx: lineHeight,
            lines: layout.lines,
          };
        };

        const maxWidth = mmToPx(pageMm.body.width_mm);
        const combinedLines: TypesettingTextLine[] = [];
        const lineStyles: Array<{ fontSizePx: number; lineHeightPx: number }> = [];
        const textParts: string[] = [];
        let yOffset = 0;
        let byteOffset = 0;

        for (const segment of segments) {
          const segmentFontPath = await resolveFontPath(segment.fontFamily, fontPath);
          const layoutData = await getTypesettingLayoutText({
            text: segment.text,
            fontPath: segmentFontPath,
            maxWidth,
            lineHeight: segment.lineHeightPx,
            fontSize: segment.fontSizePx,
            align: segment.options.align,
            firstLineIndent: segment.options.firstLineIndentPx,
            spaceBefore: segment.options.spaceBeforePx,
            spaceAfter: segment.options.spaceAfterPx,
          });
          if (layoutRunRef.current !== runId) return;

          for (const line of layoutData.lines) {
            combinedLines.push({
              ...line,
              y_offset: line.y_offset + yOffset,
              start_byte: line.start_byte + byteOffset,
              end_byte: line.end_byte + byteOffset,
            });
            lineStyles.push({
              fontSizePx: segment.fontSizePx,
              lineHeightPx: segment.lineHeightPx,
            });
          }

          const paragraphHeight = layoutData.lines.length > 0
            ? layoutData.lines[layoutData.lines.length - 1].y_offset
              + segment.lineHeightPx
              + segment.options.spaceAfterPx
            : segment.options.spaceBeforePx
              + segment.lineHeightPx
              + segment.options.spaceAfterPx;
          yOffset += paragraphHeight;

          textParts.push(segment.text);
          textParts.push("\n");
          byteOffset += getUtf8ByteLength(segment.text) + getUtf8ByteLength("\n");
        }

        const text = textParts.join("");
        const layoutData = { lines: combinedLines };
        const defaultFontSize = segments[0]?.fontSizePx ?? DEFAULT_FONT_SIZE_PX;
        const defaultLineHeight = segments[0]?.lineHeightPx ?? DEFAULT_LINE_HEIGHT_PX;
        if (layoutRunRef.current !== runId) return;
        setBodyLayout({
          text,
          fontSizePx: defaultFontSize,
          lineHeightPx: defaultLineHeight,
          lines: layoutData.lines,
        });
        setBodyLineStyles(lineStyles);
        const contentHeightPx = Math.max(0, yOffset);
        updateLayoutSummary(path, `Layout: ${layoutData.lines.length} lines`);
        updateLayoutCache(path, {
          lineCount: layoutData.lines.length,
          contentHeightPx,
          updatedAt: new Date().toISOString(),
        });

        const safeLayout = async (
          blocks: DocxBlock[],
          content: string,
          widthMm: number,
          enabled: boolean,
          fontPathOverride: string,
        ): Promise<LayoutRender | null> => {
          if (!enabled) return null;
          try {
            return await buildHeaderFooterLayout(blocks, content, widthMm, fontPathOverride);
          } catch {
            return null;
          }
        };

        const [nextHeaderLayout, nextFooterLayout] = await Promise.all([
          safeLayout(
            doc.headerBlocks,
            headerText,
            pageMm.header.width_mm,
            headerUsesEngine,
            resolvedHeaderFontPath,
          ),
          safeLayout(
            doc.footerBlocks,
            footerText,
            pageMm.footer.width_mm,
            footerUsesEngine,
            resolvedFooterFontPath,
          ),
        ]);
        if (layoutRunRef.current !== runId) return;
        setHeaderLayout(nextHeaderLayout);
        setFooterLayout(nextFooterLayout);
      } catch (err) {
        if (layoutRunRef.current !== runId) return;
        setLayoutError(String(err));
        updateLayoutSummary(path, "Layout unavailable");
        setBodyLayout(null);
        setHeaderLayout(null);
        setFooterLayout(null);
        setBodyLineStyles([]);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [doc, pageMm, path, updateLayoutSummary, updateLayoutCache]);

  const imageResolver = useMemo(() => {
    if (!doc) return undefined;
    return (embedId: string) => resolveDocxImage(doc, embedId);
  }, [doc]);

  const html = useMemo(() => {
    if (!doc) return "";
    return docxBlocksToHtml(doc.blocks, { imageResolver });
  }, [doc, imageResolver]);

  const headerHtml = useMemo(() => {
    if (!doc) return "";
    return docxBlocksToHtml(doc.headerBlocks, { imageResolver });
  }, [doc, imageResolver]);

  const footerHtml = useMemo(() => {
    if (!doc) return "";
    return docxBlocksToHtml(doc.footerBlocks, { imageResolver });
  }, [doc, imageResolver]);

  const headerLines = useMemo(() => {
    if (!headerLayout) return [];
    return buildRenderedLines(headerLayout.text, headerLayout.lines);
  }, [headerLayout]);

  const footerLines = useMemo(() => {
    if (!footerLayout) return [];
    return buildRenderedLines(footerLayout.text, footerLayout.lines);
  }, [footerLayout]);

  const bodyLines = useMemo(() => {
    if (!bodyLayout) return [];
    return buildRenderedLines(bodyLayout.text, bodyLayout.lines, bodyLineStyles);
  }, [bodyLayout, bodyLineStyles]);

  const bodyPageHeightPx = useMemo(() => {
    if (!pageMm) return null;
    return mmToPx(pageMm.body.height_mm);
  }, [pageMm]);

  const pagedBodyLines = useMemo(() => {
    if (!bodyLayout || !bodyPageHeightPx) return bodyLines;
    const pageStart = (currentPage - 1) * bodyPageHeightPx;
    const pageEnd = pageStart + bodyPageHeightPx;
    return bodyLines
      .filter(
        (line) => {
          const lineHeight = line.lineHeightPx ?? bodyLayout.lineHeightPx;
          return line.y + lineHeight > pageStart && line.y < pageEnd;
        },
      )
      .map((line) => ({
        ...line,
        y: line.y - pageStart,
      }));
  }, [bodyLines, bodyLayout, bodyPageHeightPx, currentPage]);

  const bodyImages = useMemo(() => {
    if (!doc) return [];
    return buildRenderedImages(bodyLayout, doc.blocks, imageResolver);
  }, [bodyLayout, doc, imageResolver]);

  const pagedBodyImages = useMemo(() => {
    if (!bodyPageHeightPx) return bodyImages;
    const pageStart = (currentPage - 1) * bodyPageHeightPx;
    const pageEnd = pageStart + bodyPageHeightPx;
    return bodyImages
      .filter(
        (image) =>
          image.y + image.height > pageStart && image.y < pageEnd,
      )
      .map((image) => ({
        ...image,
        y: image.y - pageStart,
      }));
  }, [bodyImages, bodyPageHeightPx, currentPage]);

  const headerImages = useMemo(() => {
    if (!doc) return [];
    return buildRenderedImages(headerLayout, doc.headerBlocks, imageResolver);
  }, [doc, headerLayout, imageResolver]);

  const footerImages = useMemo(() => {
    if (!doc) return [];
    return buildRenderedImages(footerLayout, doc.footerBlocks, imageResolver);
  }, [doc, footerLayout, imageResolver]);

  const bodyUsesEngine = !!doc
    && !isEditing
    && (bodyLines.length > 0 || bodyImages.length > 0);

  const headerUsesEngine = headerLines.length > 0 || headerImages.length > 0;
  const footerUsesEngine = footerLines.length > 0 || footerImages.length > 0;

  useEffect(() => {
    if (bodyUsesEngine) return;
    if (!editableRef.current || !bodyPageHeightPx) return;
    editableRef.current.scrollTop = (currentPage - 1) * bodyPageHeightPx;
  }, [bodyUsesEngine, bodyPageHeightPx, currentPage]);

  const measureFallbackHeight = () => {
    const el = editableRef.current;
    if (!el) return;
    const height = el.scrollHeight;
    if (Number.isFinite(height) && height > 0) {
      setFallbackContentHeightPx(height);
    }
  };

  useEffect(() => {
    if (!editableRef.current || isEditing) return;
    editableRef.current.innerHTML = html;
    requestAnimationFrame(() => measureFallbackHeight());
  }, [html, isEditing]);

  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    const measure = () => {
      const height = el.scrollHeight;
      if (Number.isFinite(height) && height > 0) {
        setFallbackContentHeightPx(height);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [html, isEditing]);

  const pagePx = useMemo(() => {
    if (!pageMm) return null;
    const base = {
      page: boxToPx(pageMm.page),
      body: boxToPx(pageMm.body),
      header: boxToPx(pageMm.header),
      footer: boxToPx(pageMm.footer),
    };
    if (zoom === 1) return base;
    return {
      page: scaleBoxPx(base.page, zoom),
      body: scaleBoxPx(base.body, zoom),
      header: scaleBoxPx(base.header, zoom),
      footer: scaleBoxPx(base.footer, zoom),
    };
  }, [pageMm, zoom]);

  const layoutSummary = doc?.layoutSummary
    ?? (layoutError ? `Layout unavailable: ${layoutError}` : "Layout: idle");

  const totalPages = useMemo(() => {
    if (!pageMm) return 1;
    const bodyHeightPx = Math.max(1, mmToPx(pageMm.body.height_mm));
    if (!bodyUsesEngine) {
      if (Number.isFinite(fallbackContentHeightPx) && fallbackContentHeightPx && fallbackContentHeightPx > 0) {
        return Math.max(1, Math.ceil(fallbackContentHeightPx / bodyHeightPx));
      }
      return 1;
    }
    const contentHeightPx = doc?.layoutCache?.contentHeightPx;
    if (Number.isFinite(contentHeightPx) && contentHeightPx && contentHeightPx > 0) {
      return Math.max(1, Math.ceil(contentHeightPx / bodyHeightPx));
    }
    const lineCount = doc?.layoutCache?.lineCount ?? 0;
    const linesPerPage = Math.max(
      1,
      Math.floor(bodyHeightPx / DEFAULT_LINE_HEIGHT_PX),
    );
    const safeLineCount = Math.max(1, lineCount);
    return Math.max(1, Math.ceil(safeLineCount / linesPerPage));
  }, [
    bodyUsesEngine,
    doc?.layoutCache?.contentHeightPx,
    doc?.layoutCache?.lineCount,
    fallbackContentHeightPx,
    pageMm,
  ]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);

  const handleInput = () => {
    if (!editableRef.current) return;
    const blocks = docxHtmlToBlocks(editableRef.current);
    updateDocBlocks(path, blocks);
    markTypesettingTabDirty(path, true);
    measureFallbackHeight();
  };

  const startEditing = () => {
    setIsEditing(true);
    setTimeout(() => editableRef.current?.focus(), 0);
  };

  const handleBeforeInput = (event: React.FormEvent<HTMLDivElement>) => {
    const inputEvent = event.nativeEvent as InputEvent;
    const op = docOpFromBeforeInput(inputEvent);
    if (op) {
      recordDocOp(path, op);
    }
  };

  const handleEditableScroll = () => {
    if (bodyUsesEngine || !editableRef.current || !bodyPageHeightPx) return;
    const top = editableRef.current.scrollTop;
    const page = Math.max(1, Math.floor(top / bodyPageHeightPx) + 1);
    setCurrentPage((prev) => (prev === page ? prev : page));
    measureFallbackHeight();
  };

  const waitForNextPaint = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

  const renderPagesToPdfBytes = useCallback(async (): Promise<Uint8Array | null> => {
    if (!pageRef.current || !pageMm) return null;
    if (isEditing) {
      editableRef.current?.blur();
      setIsEditing(false);
      await waitForNextPaint();
    }
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const pageWidthMm = pageMm.page.width_mm;
    const pageHeightMm = pageMm.page.height_mm;
    const orientation = pageWidthMm > pageHeightMm ? "landscape" : "portrait";
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: [pageWidthMm, pageHeightMm],
      compress: true,
    });
    const originalPage = currentPage;
    const originalScrollTop = editableRef.current?.scrollTop ?? 0;
    const bodyHeightPx = bodyPageHeightPx ?? mmToPx(pageMm.body.height_mm);
    for (let page = 1; page <= totalPages; page += 1) {
      if (!pageRef.current) break;
      if (page !== currentPage) {
        setCurrentPage(page);
        await waitForNextPaint();
      }
      if (!bodyUsesEngine && editableRef.current && bodyHeightPx > 0) {
        editableRef.current.scrollTop = (page - 1) * bodyHeightPx;
        await waitForNextPaint();
      }
      const canvas = await html2canvas(pageRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      if (page > 1) {
        pdf.addPage();
      }
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, pageHeightMm);
    }
    if (!bodyUsesEngine && editableRef.current) {
      editableRef.current.scrollTop = originalScrollTop;
      await waitForNextPaint();
    }
    if (originalPage !== currentPage) {
      setCurrentPage(originalPage);
      await waitForNextPaint();
    }
    return new Uint8Array(pdf.output("arraybuffer"));
  }, [bodyPageHeightPx, bodyUsesEngine, currentPage, isEditing, pageMm, totalPages]);

  const getExportPdfBytes = useCallback(async (): Promise<Uint8Array> => {
    const rendered = await renderPagesToPdfBytes();
    if (rendered) return rendered;
    const payload = await getTypesettingExportPdfBase64();
    return decodeBase64ToBytes(payload);
  }, [renderPagesToPdfBytes]);

  useEffect(() => {
    if (!onExportReady) return;
    if (!exportReady) {
      onExportReady(null);
      return;
    }
    onExportReady(() => getExportPdfBytes);
    return () => {
      onExportReady(null);
    };
  }, [exportReady, getExportPdfBytes, onExportReady]);

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const filePath = await save({
        defaultPath: "typesetting-export.pdf",
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!filePath) return;
      const bytes = await getExportPdfBytes();
      await writeFile(filePath, bytes);
    } catch (err) {
      console.error("Typesetting PDF export failed:", err);
      setExportError("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportDocx = async () => {
    setExportDocxError(null);
    setExportingDocx(true);
    try {
      const defaultPath = doc?.path
        ? doc.path.replace(/\.docx$/i, "-export.docx")
        : "typesetting-export.docx";
      const filePath = await save({
        defaultPath,
        filters: [{ name: "Word Document", extensions: ["docx"] }],
      });
      if (!filePath) return;
      await exportDocx(path, filePath);
    } catch (err) {
      console.error("Typesetting DOCX export failed:", err);
      setExportDocxError("Export failed.");
    } finally {
      setExportingDocx(false);
    }
  };

  const handlePrint = async () => {
    setPrintError(null);
    setPrinting(true);
    try {
      const tempRoot = await tempDir();
      const filePath = await join(
        tempRoot,
        `lumina-typesetting-print-${Date.now()}.pdf`,
      );
      const bytes = await getExportPdfBytes();
      await writeFile(filePath, bytes);
      await openExternal(filePath);
    } catch (err) {
      console.error("Typesetting print failed:", err);
      setPrintError("Print failed.");
    } finally {
      setPrinting(false);
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-sm text-destructive">Failed to open docx: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-center bg-background/80 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground shadow-sm">
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-sm disabled:opacity-50"
              aria-label="Zoom out"
              onClick={() =>
                setZoom((current) => clampZoom(roundZoom(current - ZOOM_STEP)))
              }
              disabled={zoom <= MIN_ZOOM}
            >
              -
            </button>
            <span className="min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-sm disabled:opacity-50"
              aria-label="Zoom in"
              onClick={() =>
                setZoom((current) => clampZoom(roundZoom(current + ZOOM_STEP)))
              }
              disabled={zoom >= MAX_ZOOM}
            >
              +
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground shadow-sm">
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-50"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              Prev
            </button>
            <span className="min-w-[5rem] text-center">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-50"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
          <button
            type="button"
            className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
            onClick={() => saveActiveFile()}
            disabled={!doc?.isDirty}
          >
            Save
          </button>
          <div className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground shadow-sm">
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-xs"
              onClick={() => {
                editableRef.current?.focus();
                document.execCommand("bold");
              }}
              aria-label="Bold"
            >
              B
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-xs"
              onClick={() => {
                editableRef.current?.focus();
                document.execCommand("italic");
              }}
              aria-label="Italic"
            >
              I
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-xs"
              onClick={() => {
                editableRef.current?.focus();
                document.execCommand("underline");
              }}
              aria-label="Underline"
            >
              U
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-xs"
              onClick={() => {
                editableRef.current?.focus();
                document.execCommand("insertUnorderedList");
              }}
              aria-label="Bulleted list"
            >
              •
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-xs"
              onClick={() => {
                editableRef.current?.focus();
                document.execCommand("insertOrderedList");
              }}
              aria-label="Numbered list"
            >
              1.
            </button>
          </div>
          <button
            type="button"
            className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exporting..." : "Export PDF"}
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
            onClick={handlePrint}
            disabled={printing}
          >
            {printing ? "Printing..." : "Print"}
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground shadow-sm disabled:opacity-50"
            onClick={handleExportDocx}
            disabled={exportingDocx}
          >
            {exportingDocx ? "Exporting DOCX..." : "Export DOCX"}
          </button>
          {exportError ? (
            <span className="text-xs text-destructive">{exportError}</span>
          ) : null}
          {printError ? (
            <span className="text-xs text-destructive">{printError}</span>
          ) : null}
          {exportDocxError ? (
            <span className="text-xs text-destructive">{exportDocxError}</span>
          ) : null}
          <span className="text-xs text-muted-foreground">{layoutSummary}</span>
        </div>
      </div>
      <div className="flex min-h-full items-center justify-center px-6 py-10">
        {!pagePx ? (
          <div className="text-center space-y-2">
            <div className="text-lg font-semibold text-foreground">
              Typesetting Document
            </div>
            <p className="text-sm text-muted-foreground">
              Loading preview metrics...
            </p>
          </div>
        ) : (
          <div
            ref={handlePageRef}
            className="relative rounded-lg border border-border bg-white shadow-sm"
            style={{ width: pagePx.page.width, height: pagePx.page.height }}
          >
            <div
              className="absolute border border-dashed border-muted-foreground/40"
              style={{
                left: pagePx.body.left,
                top: pagePx.body.top,
                width: pagePx.body.width,
                height: pagePx.body.height,
              }}
            >
              {bodyUsesEngine && bodyLayout ? (
                <div
                  className="relative h-full w-full overflow-hidden px-4 py-2 text-foreground"
                  style={{
                    fontSize: bodyLayout.fontSizePx,
                    lineHeight: `${bodyLayout.lineHeightPx}px`,
                  }}
                  data-testid="typesetting-body-engine"
                  onClick={startEditing}
                >
                  {pagedBodyLines.map((line, index) => (
                    <div
                      key={`${index}-${line.x}-${line.y}`}
                      style={{
                        position: "absolute",
                        left: line.x,
                        top: line.y,
                        width: line.width,
                        whiteSpace: "pre",
                        fontSize: line.fontSizePx ?? bodyLayout.fontSizePx,
                        lineHeight: `${line.lineHeightPx ?? bodyLayout.lineHeightPx}px`,
                      }}
                    >
                      {line.text}
                    </div>
                  ))}
                  {pagedBodyImages.map((image) => (
                    <img
                      key={`body-${image.embedId}-${image.x}-${image.y}`}
                      src={image.src}
                      alt={image.alt}
                      data-embed-id={image.embedId}
                      data-testid="typesetting-body-image"
                      style={{
                        position: "absolute",
                        left: image.x,
                        top: image.y,
                        width: image.width,
                        height: image.height,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div
                  ref={editableRef}
                  className="h-full w-full overflow-auto p-4 text-sm text-foreground outline-none"
                  contentEditable
                  suppressContentEditableWarning
                  onBeforeInput={handleBeforeInput}
                  onInput={handleInput}
                  onScroll={handleEditableScroll}
                  onFocus={() => setIsEditing(true)}
                  onBlur={() => {
                    setIsEditing(false);
                    handleInput();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Tab") {
                      event.preventDefault();
                      document.execCommand("insertText", false, "\t");
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )}
            </div>
            <div
              className="absolute border border-dotted border-muted-foreground/30"
              style={{
                left: pagePx.header.left,
                top: pagePx.header.top,
                width: pagePx.header.width,
                height: pagePx.header.height,
              }}
            >
              {headerUsesEngine && headerLayout ? (
                <div
                  className="relative h-full w-full overflow-hidden px-4 py-1 text-foreground"
                  style={{
                    fontSize: headerLayout.fontSizePx,
                    lineHeight: `${headerLayout.lineHeightPx}px`,
                  }}
                  data-testid="typesetting-header"
                >
                  {headerLines.map((line, index) => (
                    <div
                      key={`${index}-${line.x}-${line.y}`}
                      style={{
                        position: "absolute",
                        left: line.x,
                        top: line.y,
                        width: line.width,
                        whiteSpace: "pre",
                      }}
                    >
                      {line.text}
                    </div>
                  ))}
                  {headerImages.map((image) => (
                    <img
                      key={`header-${image.embedId}-${image.x}-${image.y}`}
                      src={image.src}
                      alt={image.alt}
                      data-embed-id={image.embedId}
                      data-testid="typesetting-header-image"
                      style={{
                        position: "absolute",
                        left: image.x,
                        top: image.y,
                        width: image.width,
                        height: image.height,
                      }}
                    />
                  ))}
                </div>
              ) : headerHtml ? (
                <div
                  className="h-full w-full overflow-hidden px-4 py-1 text-[10px] leading-tight text-foreground"
                  data-testid="typesetting-header"
                  dangerouslySetInnerHTML={{ __html: headerHtml }}
                />
              ) : null}
            </div>
            <div
              className="absolute border border-dotted border-muted-foreground/30"
              style={{
                left: pagePx.footer.left,
                top: pagePx.footer.top,
                width: pagePx.footer.width,
                height: pagePx.footer.height,
              }}
            >
              {footerUsesEngine && footerLayout ? (
                <div
                  className="relative h-full w-full overflow-hidden px-4 py-1 text-foreground"
                  style={{
                    fontSize: footerLayout.fontSizePx,
                    lineHeight: `${footerLayout.lineHeightPx}px`,
                  }}
                  data-testid="typesetting-footer"
                >
                  {footerLines.map((line, index) => (
                    <div
                      key={`${index}-${line.x}-${line.y}`}
                      style={{
                        position: "absolute",
                        left: line.x,
                        top: line.y,
                        width: line.width,
                        whiteSpace: "pre",
                      }}
                    >
                      {line.text}
                    </div>
                  ))}
                  {footerImages.map((image) => (
                    <img
                      key={`footer-${image.embedId}-${image.x}-${image.y}`}
                      src={image.src}
                      alt={image.alt}
                      data-embed-id={image.embedId}
                      data-testid="typesetting-footer-image"
                      style={{
                        position: "absolute",
                        left: image.x,
                        top: image.y,
                        width: image.width,
                        height: image.height,
                      }}
                    />
                  ))}
                </div>
              ) : footerHtml ? (
                <div
                  className="h-full w-full overflow-hidden px-4 py-1 text-[10px] leading-tight text-foreground"
                  data-testid="typesetting-footer"
                  dangerouslySetInnerHTML={{ __html: footerHtml }}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
