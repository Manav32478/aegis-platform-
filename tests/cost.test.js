// Unit tests — Month 6.1. Focus on the *intelligence* modules (the parts a
// committee cares about), not trivial getters.
const {
  estimateSingleCloudCost,
  estimateAegisSavings,
  FREE_TIER_LIMITS,
} = require('../intelligence/cost');

test('single-cloud cost scales linearly with requests', () => {
  expect(estimateSingleCloudCost(2000000)).toBeCloseTo(80);
  expect(estimateSingleCloudCost(0)).toBe(0);
});

test('all three clouds have defined free-tier limits', () => {
  for (const name of ['google-cloud-run', 'oracle-cloud', 'render']) {
    expect(FREE_TIER_LIMITS[name]).toBeDefined();
  }
});

test('Aegis savings equals the avoided single-cloud bill', () => {
  const r = estimateAegisSavings(1000000);
  expect(r.aegisCost).toBe(0);
  expect(r.saved).toBeCloseTo(40);
});

test('savings are never negative', () => {
  expect(estimateAegisSavings(0).saved).toBe(0);
});
