// Per-tool data for /tools/<author-slug>/<name-slug>/ pages.
// Parses owner/repo from the download URL so the detail page can fetch
// GitHub Releases at runtime.
const tools = require("../../public/data/tools.json");

function slug(s) {
  return (s || "unknown").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseOwnerRepo(url) {
  if (!url) return null;
  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)/);
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, "") } : null;
}

const sortedTools = [...tools].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

module.exports = sortedTools.map((t, i) => {
  const author_slug = slug(t.author);
  const name_slug = slug(t.name);
  const repo = parseOwnerRepo(t.url);
  const prev = i > 0 ? sortedTools[i - 1] : null;
  const next = i < sortedTools.length - 1 ? sortedTools[i + 1] : null;
  const sibling = (s) => s ? { name: s.name, author_slug: slug(s.author), slug: slug(s.name) } : null;
  return {
    id: t.id,
    author_slug,
    slug: name_slug,
    name: t.name,
    author: t.author,
    version: t.version,
    url: t.url,
    filename: t.filename,
    body_html: t.body_html,
    updated_string: t.updated_string || "",
    github_owner: repo?.owner || null,
    github_repo: repo?.repo || null,
    github_url: repo ? `https://github.com/${repo.owner}/${repo.repo}` : null,
    prev: sibling(prev),
    next: sibling(next),
    other_tools: sortedTools.filter(o => o.id !== t.id).slice(0, 6).map(o => ({
      name: o.name, author: o.author,
      author_slug: slug(o.author), slug: slug(o.name),
      version: o.version,
      body_html: o.body_html
    }))
  };
});
