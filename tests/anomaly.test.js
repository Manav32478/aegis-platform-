// Tests the anomaly detector (Month 4 / v2).
const { median, detectAnomalies, analyzeSeries } = require('../intelligence/anomaly');

test('median is correct', () => {
  expect(median([1, 2, 3, 4, 5])).toBe(3);
  expect(median([1, 2, 3, 4])).toBe(2.5);
  expect(median([])).toBe(0);
});

test('stable series → no anomaly', () => {
  const stable = Array.from({ length: 30 }, (_, i) => 50 + (i % 3));
  expect(detectAnomalies(stable)).toBe(false);
});

test('sudden spike → anomaly', () => {
  const series = Array.from({ length: 27 }, () => 50).concat([980, 990, 1000]);
  expect(detectAnomalies(series)).toBe(true);
});

test('needs enough data before flagging (cold start)', () => {
  expect(detectAnomalies([50, 60, 70])).toBe(false);
});

test('analyzeSeries reports a z-score', () => {
  const series = Array.from({ length: 27 }, () => 50).concat([980]);
  const r = analyzeSeries(series);
  expect(r.baseline).toBe(50);
  expect(r.atRisk).toBe(true);
});
