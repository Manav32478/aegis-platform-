// Tests the health-check parsing/aggregation logic used by the monitor.
const { summarize } = require('../orchestration/monitor');

test('summarize computes uptime % and average latency per cloud', () => {
  const rows = [
    { name: 'a', healthy: true, latency: 100 },
    { name: 'a', healthy: false, latency: null },
    { name: 'a', healthy: true, latency: 200 },
    { name: 'b', healthy: true, latency: 50 },
  ];
  const out = summarize(rows);
  const a = out.find((x) => x.name === 'a');
  const b = out.find((x) => x.name === 'b');

  expect(a.uptimePct).toBe(67);       // 2 of 3 healthy
  expect(a.avgLatencyMs).toBe(150);   // (100 + 200) / 2
  expect(b.uptimePct).toBe(100);
});

test('summarize handles empty input', () => {
  expect(summarize([])).toEqual([]);
});
