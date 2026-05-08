const authors = require("./authors.js");
module.exports = [...authors].sort((a, b) => b.mod_count - a.mod_count);
