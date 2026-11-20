const fs = require('fs');
const path = require('path');

const appRoot = path.join(__dirname, '../app');
const appUi = path.join(appRoot, 'public');
const webUi = path.join(__dirname, '../web/public');

test.each([
  ['app', path.join(appUi, 'assets/saas.js')],
  ['portal', path.join(webUi, 'assets/saas.js')],
])('%s SaaS workspace script parses', (_name, file) => {
  const source = fs.readFileSync(file, 'utf8');
  expect(() => new Function(source)).not.toThrow();
});

test('both workspaces provide separate navigation destinations', () => {
  for (const shell of [path.join(appUi, 'app-shell.html'), path.join(webUi, 'app-shell.html')]) {
    const html = fs.readFileSync(shell, 'utf8');
    for (const route of ['/dashboard/services', '/dashboard/monitoring', '/dashboard/incidents', '/dashboard/routing', '/dashboard/insights', '/dashboard/developers', '/dashboard/settings', '/status']) {
      expect(html).toContain(route);
    }
  }
});

test('marketing pages disclose the prototype boundary without guaranteed zero downtime claims', () => {
  for (const page of [path.join(appUi, 'index.html'), path.join(webUi, 'index.html')]) {
    const html = fs.readFileSync(page, 'utf8');
    expect(html).toContain('prototype');
    expect(html).toContain('zero downtime');
    expect(html).not.toContain('₹0/month');
    expect(html).not.toContain('routes traffic to the healthiest cloud');
  }
});
