const tags = require("./tags.js");
const map = {};
for (const t of tags) {
  for (const m of t.mods) {
    const id = `${m.author_slug}--${m.slug}`;
    (map[id] = map[id] || []).push(t.tag);
  }
}
module.exports = map;
