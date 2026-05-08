const mods = require("../../public/data/mods.json");
function slug(s) { return (s || "").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

const byWeek = new Map();
for (const m of mods) {
  const x = (m.compatibility || "").match(/^w(\d+)$/i);
  if (!x) continue;
  const w = parseInt(x[1], 10);
  const arr = byWeek.get(w) || [];
  arr.push(m);
  byWeek.set(w, arr);
}

const sorted = [...byWeek.entries()].sort((a, b) => b[0] - a[0]); // newest first

module.exports = sorted.map(([week, list]) => ({
  week,
  count: list.length,
  mods: list.sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(m => ({
    name: m.name,
    description: m.description,
    author: m.author,
    author_slug: (m.id && m.id.includes("--") ? m.id.split("--")[0] : slug(m.author)),
    slug: (m.id && m.id.includes("--") ? m.id.split("--")[1] : slug(m.name)),
    version: m.version,
    compatibility: m.compatibility,
    file_types: Object.keys(m.files || {}).filter(k => m.files[k])
  }))
}));
