import type { TypesettingPreviewPageMm } from "@/lib/tauri";

export function getDefaultPreviewPageMm(): TypesettingPreviewPageMm {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 25;
  const headerHeight = 12;
  const footerHeight = 12;
  const bodyWidth = pageWidth - margin * 2;
  const bodyHeight = pageHeight - margin * 2 - headerHeight - footerHeight;

  return {
    page: {
      x_mm: 0,
      y_mm: 0,
      width_mm: pageWidth,
      height_mm: pageHeight,
    },
    body: {
      x_mm: margin,
      y_mm: margin + headerHeight,
      width_mm: bodyWidth,
      height_mm: bodyHeight,
    },
    header: {
      x_mm: margin,
      y_mm: margin,
      width_mm: bodyWidth,
      height_mm: headerHeight,
    },
    footer: {
      x_mm: margin,
      y_mm: margin + headerHeight + bodyHeight,
      width_mm: bodyWidth,
      height_mm: footerHeight,
    },
  };
}
