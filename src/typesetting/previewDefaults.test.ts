import { describe, expect, it } from "vitest";
import { getDefaultPreviewPageMm } from "./previewDefaults";

describe("getDefaultPreviewPageMm", () => {
  it("matches the A4 defaults used by the typesetting backend", () => {
    const page = getDefaultPreviewPageMm();

    expect(page.page).toEqual({
      x_mm: 0,
      y_mm: 0,
      width_mm: 210,
      height_mm: 297,
    });
    expect(page.body).toEqual({
      x_mm: 25,
      y_mm: 37,
      width_mm: 160,
      height_mm: 223,
    });
    expect(page.header).toEqual({
      x_mm: 25,
      y_mm: 25,
      width_mm: 160,
      height_mm: 12,
    });
    expect(page.footer).toEqual({
      x_mm: 25,
      y_mm: 260,
      width_mm: 160,
      height_mm: 12,
    });
  });
});
