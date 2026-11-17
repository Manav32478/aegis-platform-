// Regression tests: embedded portal JavaScript must parse before release.
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../web/public');
const htmlFiles = fs.readdirSync(publicDir).filter((name) => name.endsWith('.html'));

test.each(htmlFiles)('%s inline JavaScript parses without syntax errors', (name) => {
  const html = fs.readFileSync(path.join(publicDir, name), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  for (const source of scripts) expect(() => new Function(source)).not.toThrow();
});
