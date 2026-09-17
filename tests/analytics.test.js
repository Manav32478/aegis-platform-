// Tests the analytics layer used by monitor + API + web (Month 6 / v2).
const {
  summarize,
  percentiles,
  healthScore,
  analyzeCloud,
  slaStatus,
  trendLatency,
  seriesOf,
} = require('../packages/common/analytics');

test('summarize computes uptime % and average latency per cloud', () => {
  const rows = [
    { name: 'a', healthy: true, latency: 100 },
    { name: 'a', healthy: false, latency: null },
    { name: 'a', healthy: true, latency: 200 },
    { name: 'b', healthy: true, latency: 50 },
  ];
  const out = summarize(rows);
  expect(out.find((x) => x.name === 'a').uptimePct).toBe(67);
  expect(out.find((x) => x.name === 'a').avgLatencyMs).toBe(150);
  expect(out.find((x) => x.name === 'b').uptimePct).toBe(100);
});

test('summarize handles empty input', () => {
  expect(summarize([])).toEqual([]);
});

test('percentiles are correct', () => {
  const p = percentiles([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  expect(p.count).toBe(10);
  expect(p.p50).toBe(50);
  expect(p.p95).toBe(100);
  expect(p.p99).toBe(100);
});

test('healthScore grades correctly', () => {
  const excellent = healthScore({ uptimePct: 100, avgLatencyMs: 50, errorRate: 0 });
  expect(excellent.score).toBeGreaterThanOrEqual(90);
  expect(excellent.grade).toBe('Excellent');

  const critical = healthScore({ uptimePct: 40, avgLatencyMs: 900, errorRate: 0.5 });
  expect(critical.grade).toBe('Critical');
});

test('analyzeCloud builds a full profile', () => {
  const rows = [
    { healthy: true, latency: 100 },
    { healthy: true, latency: 200 },
    { healthy: false, latency: null },
    { healthy: true, latency: 300 },
  ];
  const a = analyzeCloud(rows);
  expect(a.checks).toBe(4);
  expect(a.uptimePct).toBe(75);
  expect(a.avgLatencyMs).toBe(200);
  expect(a.errorRate).toBeCloseTo(0.25);
  expect(a.grade).toBeDefined();
});

test('analyzeCloud handles empty input', () => {
  const a = analyzeCloud([]);
  expect(a.checks).toBe(0);
  expect(a.grade).toBe('No data');
});

test('slaStatus marks Met / Near / At risk vs target', () => {
  expect(slaStatus(100).status).toBe('Met');
  expect(slaStatus(99.9).status).toBe('Met');
  expect(slaStatus(99.5).status).toBe('Near');
  expect(slaStatus(97).status).toBe('At risk');
  expect(slaStatus(null).status).toBe('At risk');
});

test('trendLatency detects rising vs falling latency', () => {
  const now = Date.now();
  const mk = (agoMs, lat) => ({ healthy: true, latency: lat, checked_at: new Date(now - agoMs).toISOString() });
  const rising = [mk(110 * 60000, 100), mk(100 * 60000, 100), mk(10 * 60000, 400)];
  const falling = [mk(110 * 60000, 400), mk(100 * 60000, 400), mk(10 * 60000, 100)];
  expect(trendLatency(rising).dir).toBe('up');
  expect(trendLatency(falling).dir).toBe('down');
});

test('seriesOf compresses history into {t,y}', () => {
  const rows = [{ healthy: true, latency: 50, checked_at: new Date().toISOString() }];
  const s = seriesOf(rows);
  expect(Array.isArray(s.t)).toBe(true);
  expect(Array.isArray(s.y)).toBe(true);
  expect(s.y[0]).toBe(50);
});
