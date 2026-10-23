// Regression test: embedded dashboard JavaScript must parse before release.
const fs = require('fs');
const path = require('path');

test('dashboard inline JavaScript parses without syntax errors', () => {
  const html = fs.readFileSync(path.join(__dirname, '../web/public/dashboard.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  expect(scripts.length).toBeGreaterThan(0);
  for (const source of scripts) expect(() => new Function(source)).not.toThrow();
});
