const { execFileSync } = require('child_process');
const path = require('path');
test('staging router handles safe retries and latency hysteresis', () => {
  expect(execFileSync(process.execPath, [path.join(__dirname,'staging-router.mjs')], { timeout:10000, encoding:'utf8' })).toContain('tests passed');
});
