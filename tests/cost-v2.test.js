// Tests cost forecasting (Month 4.1 / v2).
const {
  estimateAegisSavings,
  estimateCloudRunOverage,
  forecastAnnual,
} = require('../intelligence/cost');

test('Cloud Run stays free below 2M requests', () => {
  const o = estimateCloudRunOverage(1000000);
  expect(o.overageRequests).toBe(0);
  expect(o.overageCostUsd).toBe(0);
});

test('Cloud Run overage at 3M requests = $0.40', () => {
  const o = estimateCloudRunOverage(3000000);
  expect(o.overageRequests).toBe(1000000);
  expect(o.overageCostUsd).toBeCloseTo(0.4);
});

test('Aegis cost is always zero', () => {
  expect(estimateAegisSavings(5000000).aegisCost).toBe(0);
});

test('12-month forecast grows and saves money every month', () => {
  const f = forecastAnnual(1000000, 10, 12);
  expect(f.rows.length).toBe(12);
  expect(f.totalAegisUsd).toBe(0);
  expect(f.totalSavedUsd).toBeGreaterThan(0);
  expect(f.rows[11].savedUsd).toBeGreaterThan(f.rows[0].savedUsd);
});
