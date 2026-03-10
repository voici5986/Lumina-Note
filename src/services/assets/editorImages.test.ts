import { describe, expect, it } from "vitest";

import { buildPastedImageTarget, getImageMimeType, resolveEditorImagePath } from "./editorImages";

describe("resolveEditorImagePath", () => {
  it("resolves note-relative image paths", () => {
    expect(
      resolveEditorImagePath({
        src: "../assets/hero.png",
        notePath: "/vault/notes/daily.md",
        vaultPath: "/vault",
      }),
    ).toBe("/vault/assets/hero.png");
  });

  it("falls back to vault-relative paths without a note path", () => {
    expect(
      resolveEditorImagePath({
        src: "images/hero.png",
        vaultPath: "/vault",
      }),
    ).toBe("/vault/images/hero.png");
  });

  it("ignores remote image urls", () => {
    expect(
      resolveEditorImagePath({
        src: "https://example.com/hero.png",
        notePath: "/vault/notes/daily.md",
        vaultPath: "/vault",
      }),
    ).toBeNull();
  });
});

describe("buildPastedImageTarget", () => {
  it("creates note-adjacent asset paths and relative references", () => {
    const target = buildPastedImageTarget({
      notePath: "/vault/notes/Daily Note.md",
      vaultPath: "/vault",
      mimeType: "image/png",
      timestamp: new Date("2026-03-11T02:50:12.345Z").getTime(),
    });

    expect(target.directoryPath).toBe("/vault/notes/assets");
    expect(target.fileName).toBe("daily-note-20260311-025012-345.png");
    expect(target.filePath).toBe("/vault/notes/assets/daily-note-20260311-025012-345.png");
    expect(target.referencePath).toBe("assets/daily-note-20260311-025012-345.png");
  });

  it("falls back to the vault assets directory without a note path", () => {
    const target = buildPastedImageTarget({
      vaultPath: "/vault",
      mimeType: "image/jpeg",
      timestamp: new Date("2026-03-11T02:50:12.345Z").getTime(),
    });

    expect(target.directoryPath).toBe("/vault/assets");
    expect(target.fileName).toBe("pasted-image-20260311-025012-345.jpg");
    expect(target.referencePath).toBe("assets/pasted-image-20260311-025012-345.jpg");
  });
});

describe("getImageMimeType", () => {
  it("maps local file extensions to mime types", () => {
    expect(getImageMimeType("/vault/assets/hero.jpg")).toBe("image/jpeg");
    expect(getImageMimeType("/vault/assets/hero.svg")).toBe("image/svg+xml");
    expect(getImageMimeType("/vault/assets/hero.bin")).toBe("image/png");
  });
});
