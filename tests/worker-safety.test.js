const { execFileSync } = require('child_process');
const path = require('path');

test('worker skips disabled targets and does not resolve unmonitored incidents', () => {
  expect(() => execFileSync(process.execPath, [path.join(__dirname, 'worker-safety.mjs')], { timeout: 10000, stdio: 'pipe' })).not.toThrow();
});
