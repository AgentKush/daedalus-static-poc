const details = require("../../public/data/mod_details.json");

module.exports = Object.entries(details).map(([id, m]) => {
  const [author_slug, slug] = id.split("--");
  return {
    id,
    author_slug,
    slug,
    name: m.name,
    author: m.author,
    version: m.version,
    compatibility: m.compatibility,
    image_url: m.image_url,
    readme_html: m.readme_html,
    downloads: m.downloads,
    updated_string: m.updated_string
  };
});
