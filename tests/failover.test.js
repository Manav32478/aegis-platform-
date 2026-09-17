// Tests failover scoring (Month 4.6 / v2).
const { rankClouds, decideRoute } = require('../intelligence/failover');

const analytics = {
  render: { region: 'oregon', score: 92, uptimePct: 99, avgLatencyMs: 120 },
  vercel: { region: 'global', score: 95, uptimePct: 100, avgLatencyMs: 90 },
  oracle: { region: 'ap-mumbai-1', score: 40, uptimePct: 55, avgLatencyMs: 900 },
};

test('rankClouds orders by health score desc', () => {
  const ranked = rankClouds(analytics, {});
  expect(ranked[0].name).toBe('vercel');
  expect(ranked[1].name).toBe('render');
  expect(ranked[2].name).toBe('oracle');
});

test('ties broken by latency', () => {
  const tied = {
    a: { region: 'x', score: 90, uptimePct: 100, avgLatencyMs: 200 },
    b: { region: 'y', score: 90, uptimePct: 100, avgLatencyMs: 50 },
  };
  expect(rankClouds(tied, {})[0].name).toBe('b');
});

test('greenest wins a full tie', () => {
  const tied = {
    a: { region: 'x', score: 90, uptimePct: 100, avgLatencyMs: 100 },
    b: { region: 'y', score: 90, uptimePct: 100, avgLatencyMs: 100 },
  };
  const carbon = { a: { carbonIntensity: 727 }, b: { carbonIntensity: 250 } };
  expect(rankClouds(tied, carbon)[0].name).toBe('b');
});

test('decideRoute picks primary + fallback', () => {
  const r = decideRoute(analytics, {});
  expect(r.route).toBe('vercel');
  expect(r.fallback).toBe('render');
});

test('decideRoute refuses an all-down fleet', () => {
  const allDown = {
    a: { region: 'x', score: 10, uptimePct: 20, avgLatencyMs: 2000 },
    b: { region: 'y', score: 5, uptimePct: 10, avgLatencyMs: 3000 },
  };
  expect(decideRoute(allDown, {}).route).toBeNull();
});
