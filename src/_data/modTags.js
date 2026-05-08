const tags = require("./tags.js");
function slug(s) { return (s || "").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
const map = {};
for (const t of tags) {
  for (const m of t.mods) {
    // Use the same key shape as the listing: slug(author)--slug(name)
    const key = `${m.author_slug || slug(m.author)}--${m.slug || slug(m.name)}`;
    (map[key] = map[key] || []).push(t.tag);
  }
}
module.exports = map;
