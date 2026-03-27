/**
 * Minimal Jest transform for TypeScript files.
 * Uses Node.js built-in module.stripTypeScriptTypes() (available Node 22+)
 * to strip TypeScript types before Jest processes the file.
 */

const { stripTypeScriptTypes } = require('node:module');

module.exports = {
  process(sourceText, sourcePath) {
    // Only transform TypeScript files
    if (!sourcePath.endsWith('.ts') && !sourcePath.endsWith('.tsx')) {
      return { code: sourceText };
    }
    const stripped = stripTypeScriptTypes(sourceText, { mode: 'strip' });
    return { code: stripped };
  },
};
