jest.mock('../packages/common/supabase', () => ({ getHealthChecks: jest.fn(), sb: jest.fn() }));
const { getHealthChecks, sb } = require('../packages/common/supabase');
const { provideSnapshot } = require('../web/data');

afterEach(() => { jest.restoreAllMocks(); jest.resetAllMocks(); });

function setup() {
  sb.mockImplementation(async path => path.includes('monitor_targets') ? [{ cloud_name: 'example', url: 'https://example.test/health', enabled: true }] : []);
  jest.spyOn(global, 'fetch').mockImplementation(async url => ({ ok: true, status: 200, json: async () => String(url).includes('/router/health') ? { targets: [] } : { status: 'ok', cloud: 'example' } }));
}

test('history failure is not reported as an empty successful query', async () => {
  setup();
  getHealthChecks.mockRejectedValue(new Error('fetch failed'));
  const snap = await provideSnapshot();
  expect(snap.diagnostics.historyAvailable).toBe(false);
  expect(snap.diagnostics.historyRows).toBe(0);
  expect(snap.diagnostics.warnings.join(' ')).toContain('history could not be read');
  expect(snap.probes[0].healthy).toBe(true);
  expect(snap.proxy.failoverActive).toBeNull();
});

test('successful empty history is explicitly distinguished from failure', async () => {
  setup();
  getHealthChecks.mockResolvedValue([]);
  const snap = await provideSnapshot();
  expect(snap.diagnostics.historyAvailable).toBe(true);
  expect(snap.diagnostics.historyRows).toBe(0);
  expect(snap.diagnostics.warnings.join(' ')).toContain('returned no rows');
});
