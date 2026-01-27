import type { PublishIndex, PublishPostIndex } from "./index";
import { buildPublishIndexFromNotes } from "./index";
import type { PublishNoteSource } from "./notes";
import { buildAssetManifest, createAssetUrlMapper } from "./assetManifest";
import { defaultTheme, buildThemeCss, ThemeTokens } from "./theme";
import { renderPublishHtml } from "./render";
import { renderIndexPage, renderPostPage } from "./templates";

export interface PublishPlanOptions {
  postsBasePath?: string;
  assetsBasePath?: string;
  theme?: ThemeTokens;
  generatedAt?: string;
}

export interface PublishPlanFile {
  path: string;
  content: string;
}

export interface PublishPlan {
  index: PublishIndex;
  theme: ThemeTokens;
  assetManifest: ReturnType<typeof buildAssetManifest>;
  files: PublishPlanFile[];
}

const buildSiteData = (index: PublishIndex, generatedAt: string) => {
  return {
    ...index,
    generatedAt,
  };
};

const buildPostHtml = (post: PublishPostIndex, note: PublishNoteSource, manifest: ReturnType<typeof buildAssetManifest>) => {
  const mapper = createAssetUrlMapper(note.path, manifest);
  const html = renderPublishHtml(note.content || "", { mapAssetUrl: mapper });
  return renderPostPage(post, html);
};

export const buildPublishPlan = (
  notes: PublishNoteSource[],
  profile: PublishIndex["profile"],
  options?: PublishPlanOptions
): PublishPlan => {
  const theme = options?.theme ?? defaultTheme;
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const index = buildPublishIndexFromNotes(notes, profile, {
    postsBasePath: options?.postsBasePath,
  });
  const assetManifest = buildAssetManifest(notes, { assetsBasePath: options?.assetsBasePath });

  const files: PublishPlanFile[] = [];

  files.push({ path: "index.html", content: renderIndexPage(index) });
  files.push({ path: "theme.json", content: JSON.stringify(theme, null, 2) });
  files.push({ path: "theme.css", content: buildThemeCss(theme) });
  files.push({ path: "data/site.json", content: JSON.stringify(buildSiteData(index, generatedAt), null, 2) });

  for (const post of index.posts) {
    const note = notes.find((candidate) => candidate.path === post.path);
    if (!note) continue;
    const html = buildPostHtml(post, note, assetManifest);
    const relativePath = `${post.url.replace(/^\//, "")}index.html`;
    files.push({ path: relativePath, content: html });
  }

  return {
    index,
    theme,
    assetManifest,
    files,
  };
};
