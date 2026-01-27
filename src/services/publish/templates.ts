import type { PublishIndex, PublishPostIndex } from "./index";

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderPostCard = (post: PublishPostIndex): string => {
  const summary = escapeHtml(post.summary || "");
  const title = escapeHtml(post.title || "Untitled");
  const publishAt = post.publishAt ? escapeHtml(post.publishAt) : "";
  const tags = post.tags || [];
  const tagsHtml = tags.length
    ? `<div class="meta">${tags.slice(0, 4).map((tag) => `#${escapeHtml(tag)}`).join(" ")}</div>`
    : "";

  return `
    <article class="card">
      <h3><a href="${post.url}">${title}</a></h3>
      ${publishAt ? `<div class="meta">${publishAt}</div>` : ""}
      <p>${summary}</p>
      ${tagsHtml}
    </article>
  `;
};

export const renderIndexPage = (index: PublishIndex): string => {
  const profile = index.profile;
  const displayName = escapeHtml(profile.displayName || "Untitled");
  const bio = escapeHtml(profile.bio || "");
  const pinnedPosts = index.pinned
    .map((slug) => index.posts.find((post) => post.slug === slug))
    .filter((post): post is PublishPostIndex => Boolean(post));

  const pinnedHtml = pinnedPosts.length
    ? `<div class="card-grid">${pinnedPosts.map(renderPostCard).join("\n")}</div>`
    : `<div class="card">No pinned notes yet.</div>`;

  const recentHtml = index.posts.length
    ? `<div class="card-grid">${index.posts.map(renderPostCard).join("\n")}</div>`
    : `<div class="card">No published notes yet.</div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${displayName}</title>
    <link rel="stylesheet" href="/theme.css" />
  </head>
  <body>
    <main class="site-shell">
      <section class="hero">
        <h1>${displayName}</h1>
        <p class="bio">${bio}</p>
      </section>

      <section class="section">
        <h2>Pinned</h2>
        ${pinnedHtml}
      </section>

      <section class="section">
        <h2>Latest</h2>
        ${recentHtml}
      </section>
    </main>
  </body>
</html>`;
};

export const renderPostPage = (post: PublishPostIndex, html: string): string => {
  const title = escapeHtml(post.title || "Untitled");
  const publishAt = post.publishAt ? escapeHtml(post.publishAt) : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="/theme.css" />
  </head>
  <body>
    <main class="site-shell">
      <div class="post-header">
        <a href="/">Back to home</a>
        <div class="post-title">${title}</div>
        ${publishAt ? `<div class="post-meta">${publishAt}</div>` : ""}
      </div>
      <article class="post-content">${html}</article>
    </main>
  </body>
</html>`;
};
