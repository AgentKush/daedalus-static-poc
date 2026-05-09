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

// Pick the distinguishing word from a tool's name so we can filter the repo's
// release feed when several tools share one repo (e.g. Jimk72's Mod Editor and
// Mod Manager both come out of Jimk72/Icarus_Software).
function releaseKeyword(name) {
  const tokens = (name || "").toLowerCase().split(/[\s_-]+/).filter(Boolean);
  // Tokens commonly shared across tools in the same repo
  const noise = new Set(["icarus", "mod", "tool", "the", "for", "and", "v", "v1", "v2", "v3", "v4", "v5",
                          "full", "free", "release", "patch", "beta", "alpha", "1", "2", "3", "4", "5",
                          "loader"]);
  // Anchor words we know distinguish — prefer these if present
  const anchors = ["editor", "manager", "loader", "creator", "builder", "validator", "viewer", "extractor"];
  for (const a of anchors) if (tokens.includes(a)) return a;
  // Otherwise pick the first non-noise token
  for (const t of tokens) if (!noise.has(t)) return t;
  return null;
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
    release_keyword: releaseKeyword(t.name),
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
