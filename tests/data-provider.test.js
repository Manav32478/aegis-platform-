// Regression tests for the dashboard data provider's default/DB target shapes.
const { healthUrl, normalizeTarget } = require('../web/data');

test('normalizes Supabase target rows', () => {
  expect(normalizeTarget({ cloud_name: 'render', url: 'https://render.example/health', enabled: true })).toEqual({
    name: 'render', url: 'https://render.example/health', region: 'unknown', enabled: true,
  });
});

test('normalizes built-in target config without producing undefined names', () => {
  expect(normalizeTarget({ name: 'vercel', url: 'https://vercel.example/health', enabled: true }).name).toBe('vercel');
});

test('healthUrl does not append /health twice', () => {
  expect(healthUrl('https://example.com')).toBe('https://example.com/health');
  expect(healthUrl('https://example.com/health')).toBe('https://example.com/health');
  expect(healthUrl('https://example.com/health/')).toBe('https://example.com/health');
});
