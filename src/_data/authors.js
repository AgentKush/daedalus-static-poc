// Builds the per-author dataset for /authors/<slug>/ pages.
// Includes both curated mods (mods.json) and Nexus mods so every author
// linked from a mod card resolves to a real profile page.
const mods = require("../../public/data/mods.json");
const nexus = require("../../public/data/nexus_mods.json");

function slug(s) {
  return (s || "unknown").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const all = [
  ...mods.map(m => ({ ...m, _is_nexus: false })),
  ...nexus.map(m => ({ ...m, _is_nexus: true })),
];

// Group mods by author (case-insensitive)
const byAuthor = new Map();
for (const m of all) {
  if (!m.author) continue;
  const key = m.author.trim();
  const arr = byAuthor.get(key) || [];
  arr.push(m);
  byAuthor.set(key, arr);
}

// Sort authors alphabetically (case-insensitive)
const sorted = [...byAuthor.entries()].sort((a, b) =>
  a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
);

function nexusUrl(m) {
  return m.mod_page_url || (m.nexus_id ? `https://www.nexusmods.com/icarus/mods/${m.nexus_id}` : null);
}

module.exports = sorted.map(([author, list]) => {
  const fileTypeCounts = {};
  for (const m of list) {
    if (m._is_nexus) {
      fileTypeCounts.nexus = (fileTypeCounts.nexus || 0) + 1;
      continue;
    }
    for (const t of Object.keys(m.files || {})) {
      if (m.files[t]) fileTypeCounts[t] = (fileTypeCounts[t] || 0) + 1;
    }
  }
  // Newest mod (by latest derived game-week, fallback to mod name)
  const weekNum = m => {
    const x = (m.compatibility || "").match(/^w(\d+)$/i);
    return x ? parseInt(x[1], 10) : -1;
  };
  const sortedMods = [...list].sort((a, b) => weekNum(b) - weekNum(a) || (a.name || "").localeCompare(b.name || ""));
  const newest = sortedMods[0];
  return {
    author,
    slug: slug(author),
    mods: sortedMods.map(m => ({
      name: m.name,
      description: m.description,
      version: m.version,
      compatibility: m.compatibility,
      author_slug: slug(m.author),
      slug: (m.id && typeof m.id === "string" && m.id.includes("--") ? m.id.split("--")[1] : slug(m.name)),
      file_types: m._is_nexus ? ["nexus"] : Object.keys(m.files || {}).filter(k => m.files[k]),
      image_url: m.image_url || m.imageURL || null,
      is_nexus: m._is_nexus,
      mod_page_url: m._is_nexus ? nexusUrl(m) : null,
    })),
    mod_count: list.length,
    file_type_counts: fileTypeCounts,
    newest_mod: newest ? {
      name: newest.name,
      author_slug: slug(newest.author),
      slug: (newest.id && typeof newest.id === "string" && newest.id.includes("--") ? newest.id.split("--")[1] : slug(newest.name)),
      compatibility: newest.compatibility,
      is_nexus: newest._is_nexus,
      mod_page_url: newest._is_nexus ? nexusUrl(newest) : null,
    } : null
  };
});
