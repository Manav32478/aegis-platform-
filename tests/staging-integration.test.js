const { execFileSync } = require('child_process');
const path = require('path');
test('staging monitor and portal share explicitly isolated mock resources', () => {
  expect(execFileSync(process.execPath, [path.join(__dirname,'staging-integration.cjs')], {timeout:10000, encoding:'utf8'})).toContain('mock integration passed');
});
