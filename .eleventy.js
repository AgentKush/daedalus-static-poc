module.exports = function (eleventyConfig) {
  // Copy public/* to the root of _site/ (not as _site/public/)
  eleventyConfig.addPassthroughCopy({ "public/assets": "assets", "public/data": "data" });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"]
  };
};
