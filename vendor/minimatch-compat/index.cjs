// Minimatch 11's callable already exposes the legacy match/filter/defaults/
// Minimatch/braceExpand API. Old tools require the callable as the module itself.
const { minimatch } = require('minimatch-modern');
module.exports = minimatch;
// Explicit assignments let Node expose named ESM imports as well as require().
module.exports.minimatch = minimatch;
module.exports.Minimatch = minimatch.Minimatch;
module.exports.match = minimatch.match;
module.exports.filter = minimatch.filter;
module.exports.defaults = minimatch.defaults;
module.exports.braceExpand = minimatch.braceExpand;
module.exports.makeRe = minimatch.makeRe;
module.exports.GLOBSTAR = minimatch.GLOBSTAR;
module.exports.sep = minimatch.sep;
module.exports.escape = minimatch.escape;
module.exports.unescape = minimatch.unescape;
