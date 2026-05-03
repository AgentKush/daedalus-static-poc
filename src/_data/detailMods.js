const mods = require("../../public/data/mods.json");
const details = require("../../public/data/mod_details.json");

function slug(s) {
  return (s || "unknown").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Generate a detail entry for every mod in mods.json. Use the full README from
// mod_details.json when we have one; otherwise fall back to the truncated
// description, version, author, etc.
module.exports = mods.map(m => {
  const author_slug = m.id?.split("--")[0] || slug(m.author);
  const name_slug = m.id?.split("--")[1] || slug(m.name);
  const detail = details[m.id];

  // Build downloads from the simple files map
  const downloads = [];
  for (const [type, url] of Object.entries(m.files || {})) {
    if (url) downloads.push({
      type: type.toUpperCase(),
      url,
      filename: url.split("/").pop().split("?")[0]
    });
  }

  return {
    id: m.id,
    author_slug,
    slug: name_slug,
    name: m.name,
    author: m.author,
    version: m.version,
    compatibility: m.compatibility || "All",
    image_url: detail?.image_url || null,
    readme_html: detail?.readme_html || `<p>${(m.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    has_full_readme: Boolean(detail?.readme_html),
    downloads: detail?.downloads || downloads,
    updated_string: detail?.updated_string || ""
  };
});
