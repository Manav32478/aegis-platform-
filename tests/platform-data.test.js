const {
  healthUrl,
  normalizeTarget,
  getTargets,
  probeTarget,
  getPlatformSummary,
  clearCache,
} = require('../app/platform-data');

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('healthUrl appends one health path and preserves an existing one', () => {
  expect(healthUrl('https://service.example')).toBe('https://service.example/health');
  expect(healthUrl('https://service.example/health/')).toBe('https://service.example/health');
});

test('normalizes target rows without exposing arbitrary fields', () => {
  expect(normalizeTarget({ cloud_name: 'render', url: 'https://render.example', region: 'oregon', enabled: true, secret: 'ignored' })).toEqual({
    name: 'render', url: 'https://render.example', region: 'oregon', enabled: true,
  });
});

test('uses active demo origins and keeps planned origins disabled', () => {
  const targets = getTargets({});
  expect(targets.find(t => t.name === 'render').enabled).toBe(true);
  expect(targets.find(t => t.name === 'vercel').enabled).toBe(true);
  expect(targets.filter(t => t.enabled === false).map(t => t.name)).toEqual(['google-cloud-run', 'oracle-cloud']);
});

test('reports an HTTP 200 health probe as operational', async () => {
  const result = await probeTarget({ name: 'test', url: 'https://test.example', enabled: true }, async () => response(200, { cloud: 'test' }));
  expect(result.healthy).toBe(true);
  expect(result.state).toBe('operational');
  expect(result.status).toBe(200);
  expect(result.url).toBe('https://test.example/health');
});

test('does not call disabled targets', async () => {
  const fetcher = jest.fn();
  const result = await probeTarget({ name: 'planned', url: '', enabled: false }, fetcher);
  expect(result.state).toBe('planned');
  expect(fetcher).not.toHaveBeenCalled();
});

test('returns a safe down result when a probe throws', async () => {
  const result = await probeTarget({ name: 'test', url: 'https://test.example', enabled: true }, async () => { throw new Error('private network detail'); });
  expect(result.healthy).toBe(false);
  expect(result.state).toBe('down');
  expect(result.reason).not.toContain('private network detail');
});

test('builds a summary with live targets and router status', async () => {
  clearCache();
  const fetcher = jest.fn(async (url) => {
    if (String(url).includes('/router/health')) return response(200, { service: 'aegis-router', targets: [{ name: 'render', healthy: true }] });
    return response(200, { status: 'ok', cloud: String(url).includes('onrender') ? 'render' : 'vercel', uptimeSeconds: 20 });
  });
  const result = await getPlatformSummary({ fetchImpl: fetcher, force: true });
  expect(result.origins).toHaveLength(4);
  expect(result.origins.filter(o => o.enabled && o.healthy)).toHaveLength(2);
  expect(result.routerStatus.available).toBe(true);
  expect(result.historyAvailable).toBe(false);
});

test('app fallback targets use the replacement Vercel origin', () => {
  expect(getTargets({}).find(t => t.name === 'vercel').url).toBe('https://aegis-platform-11f7.vercel.app');
});
