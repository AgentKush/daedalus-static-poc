const mods = require("../../public/data/mods.json");
const modTags = require("./modTags.js");
const details = require("../../public/data/mod_details.json");

// GitHub /blob/ URLs return HTML, not the binary. raw.githubusercontent.com
// serves the actual file with the right Content-Type. Convert in case modders
// committed a /blob/ link as their imageURL or readmeURL.
function rawifyGithubUrl(url) {
  if (!url) return url;
  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:raw|blob)\/(.+)$/);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  return url;
}

function slug(s) {
  return (s || "unknown").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Sort mods alphabetically by name (matches Rails Mod.fetch_all sort)
const sortedMods = [...mods].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

// Pre-compute per-author groupings for the Analytics panel
const byAuthor = {};
for (const m of sortedMods) {
  if (!m.author) continue;
  (byAuthor[m.author] = byAuthor[m.author] || []).push(m);
}

module.exports = sortedMods.map((m, i) => {
  const author_slug = (m.id && m.id.includes("--") ? m.id.split("--")[0] : slug(m.author));
  const name_slug = (m.id && m.id.includes("--") ? m.id.split("--")[1] : slug(m.name));
  const detail = details[m.id];
  const fileTypes = Object.keys(m.files || {}).filter(k => m.files[k]);
  const downloads = fileTypes.map(t => ({
    type: t,
    url: m.files[t],
    filename: m.files[t].split("/").pop().split("?")[0]
  }));

  const prev = i > 0 ? sortedMods[i - 1] : null;
  const next = i < sortedMods.length - 1 ? sortedMods[i + 1] : null;

  const otherByAuthor = sortedMods
    .filter(o => o.id !== m.id && o.author === m.author)
    .slice(0, 6)
    .map(o => ({
      name: o.name,
      description: o.description,
      author_slug: (o.id && o.id.includes("--") ? o.id.split("--")[0] : slug(o.author)),
      slug: (o.id && o.id.includes("--") ? o.id.split("--")[1] : slug(o.name)),
      file_types: Object.keys(o.files || {}).filter(k => o.files[k])
    }));

  const myTags = modTags[m.id] || [];
  const tagSet = new Set(myTags);
  let similar = [];
  if (myTags.length) {
    similar = sortedMods
      .filter(o => o.id !== m.id)
      .map(o => {
        const tags = modTags[o.id] || [];
        let score = 0;
        for (const t of tags) if (tagSet.has(t)) score += 1;
        if (o.author === m.author) score += 0.5;
        return { mod: o, score };
      })
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(e => ({
        name: e.mod.name,
        description: e.mod.description,
        author: e.mod.author,
        author_slug: (e.mod.id && e.mod.id.includes("--") ? e.mod.id.split("--")[0] : slug(e.mod.author)),
        slug: (e.mod.id && e.mod.id.includes("--") ? e.mod.id.split("--")[1] : slug(e.mod.name)),
        file_types: Object.keys(e.mod.files || {}).filter(k => e.mod.files[k]),
        compatibility: e.mod.compatibility
      }));
  }

  return {
    id: m.id,
    author_slug,
    slug: name_slug,
    name: m.name,
    author: m.author,
    version: m.version,
    version_string: m.version ? (m.compatibility ? `v${m.version} / ${m.compatibility}` : `v${m.version}`) : (m.compatibility || ""),
    compatibility: m.compatibility,
    description: m.description,
    readme_url: rawifyGithubUrl(m.readme_url || m.readmeURL) || null,
    image_url: detail?.image_url || rawifyGithubUrl(m.image_url || m.imageURL) || null,
    video_url: m.video_url || m.videoURL || null,
    donate_url: m.donate_url || m.donate || m.donateURL || null,
    readme_html: detail?.readme_html || `<p>${(m.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    has_full_readme: Boolean(detail?.readme_html),
    file_types: fileTypes,
    download_types: fileTypes,
    downloads,
    has_exmodz: fileTypes.includes("exmodz") || fileTypes.includes("exmod"),
    updated_string: detail?.updated_string || "",
    prev: prev ? { name: prev.name, author_slug: (prev.id && prev.id.includes("--") ? prev.id.split("--")[0] : slug(prev.author)), slug: (prev.id && prev.id.includes("--") ? prev.id.split("--")[1] : slug(prev.name)) } : null,
    next: next ? { name: next.name, author_slug: (next.id && next.id.includes("--") ? next.id.split("--")[0] : slug(next.author)), slug: (next.id && next.id.includes("--") ? next.id.split("--")[1] : slug(next.name)) } : null,
    other_by_author: otherByAuthor,
    similar,
    author_stats: (() => {
      const all = byAuthor[m.author] || [];
      const fileTypeCounts = {};
      for (const om of all) {
        for (const t of Object.keys(om.files || {})) {
          if (!om.files[t]) continue;
          fileTypeCounts[t] = (fileTypeCounts[t] || 0) + 1;
        }
      }
      return {
        total_mods: all.length,
        file_type_counts: Object.entries(fileTypeCounts).sort((a, b) => b[1] - a[1])
      };
    })()
  };
});
