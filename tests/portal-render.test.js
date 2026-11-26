const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require('path').join(__dirname, '../web/public/assets/saas.js'), 'utf8');
const routes = {
  '/dashboard': 'Workspace overview',
  '/dashboard/services': 'Configured origins',
  '/dashboard/monitoring': 'Response time',
  '/dashboard/incidents': 'Incident timeline',
  '/dashboard/alerts': 'Recent alerts',
  '/dashboard/routing': 'Origin eligibility',
  '/dashboard/insights': 'Regional carbon reference',
  '/dashboard/developers': 'Health endpoint',
  '/dashboard/settings': 'Connection status',
  '/status': 'Application components',
};

const origin = { name: 'sample', enabled: true, healthy: true, url: 'https://example.test/health', latency: 25, status: 200 };
const portalData = {
  generatedAt: '2026-08-13T00:00:00Z', probes: [origin],
  diagnostics: { historyRows: 1, incidentsAvailable: true, alertsAvailable: true },
  series: { sample: { y: [25] } },
  incidents: [{ cloud_name: 'sample', kind: 'downtime', started_at: '2026-08-13T00:00:00Z' }],
  alerts: [{ cloud_name: 'sample', kind: 'down', message: '<script>unsafe</script>' }],
  cost: { singleCloud: 40, aegisCost: 0 }, carbon: [{ region: 'example', zone: 'X', carbonIntensity: 100 }],
};
const originData = { checkedAt: portalData.generatedAt, origins: [origin], diagnostics: {}, routerStatus: { available: false }, historyRows: 0 };

async function render(route, mode, override) {
  const elements = {};
  for (const id of ['page-content', 'sidebar', 'mobile-overlay', 'crumb-current', 'menu-button', 'refresh-button']) {
    elements[id] = { innerHTML: '', textContent: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, prepend() {} };
  }
  const context = {
    document: { body: { dataset: { mode } }, getElementById: id => elements[id], querySelectorAll: () => [], hidden: false, createElement: () => ({}) },
    window: { location: { pathname: route, origin: 'http://localhost' }, addEventListener() {} },
    URL, Date, Number, String, Array, Object, Math,
    fetch: async () => ({ ok: true, json: async () => override || (mode === 'portal' ? portalData : originData) }),
    setInterval: () => 1, clearInterval() {},
  };
  vm.runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return elements['page-content'].innerHTML;
}

test.each(Object.entries(routes))('portal renders %s without a script error', async (route, expected) => {
  expect(await render(route, 'portal')).toContain(expected);
});

test.each(Object.keys(routes))('origin renders %s without a script error', async route => {
  const html = await render(route, 'origin');
  expect(html).toContain('page-head');
  expect(html).not.toContain('Workspace data unavailable');
});

test('escapes messages from the database', async () => {
  const html = await render('/dashboard/alerts', 'portal');
  expect(html).toContain('&lt;script&gt;unsafe&lt;/script&gt;');
  expect(html).not.toContain('<script>unsafe</script>');
});


test('a history read failure is displayed as unavailable rather than zero', async () => {
  const html = await render('/dashboard', 'portal', { ...portalData, diagnostics: { historyRows: 0, historyAvailable: false, incidentsAvailable: true, alertsAvailable: true } });
  expect(html).toContain('History could not be read');
  expect(html).toContain('Could not read stored checks');
  expect(html).toContain('Unavailable');
});

test('origin workspace provides a link to the configured portal', async () => {
  const html = await render('/dashboard', 'origin', { ...originData, portalUrl: 'https://portal.example' });
  expect(html).toContain('https://portal.example/dashboard');
});
test('portal services includes the manual setup helper', async () => {
  expect(await render('/dashboard/services', 'portal')).toContain('/onboarding.html');
});
test('portal routing shows experimental mode only when Worker reports it', async () => {
  const html = await render('/dashboard/routing', 'portal', { ...portalData, routerStatus: { mode: 'latency', targets: [] } });
  expect(html).toContain('Worker reports latency mode');
});
