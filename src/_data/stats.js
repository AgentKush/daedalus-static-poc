const mods = require("../../public/data/mods.json");
const tagsData = require("./tags.js");

function slug(s) { return (s || "").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

const total = mods.length;

// Authors histogram
const authorMap = new Map();
for (const m of mods) {
  if (!m.author) continue;
  authorMap.set(m.author, (authorMap.get(m.author) || 0) + 1);
}
const topAuthors = [...authorMap.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([author, count]) => ({ author, slug: slug(author), count }));

// File-type breakdown
const fileTypes = {};
for (const m of mods) {
  for (const t of Object.keys(m.files || {})) if (m.files[t]) fileTypes[t] = (fileTypes[t] || 0) + 1;
}

// Mods per game-week histogram
const weekMap = new Map();
for (const m of mods) {
  const x = (m.compatibility || "").match(/^w(\d+)$/i);
  if (x) {
    const w = parseInt(x[1], 10);
    weekMap.set(w, (weekMap.get(w) || 0) + 1);
  }
}
const weeks = [...weekMap.entries()].sort((a, b) => a[0] - b[0]).map(([w, c]) => ({ week: w, count: c }));

// Compatibility coverage
const compatible = mods.filter(m => m.compatibility).length;

module.exports = {
  total,
  authors_total: authorMap.size,
  compatible_count: compatible,
  compatible_pct: total ? Math.round((compatible / total) * 100) : 0,
  top_authors: topAuthors,
  file_types: Object.entries(fileTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
  weeks,
  tag_count: tagsData.length,
  generated_at: new Date().toISOString()
};
