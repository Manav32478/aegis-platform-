const { normalizeSupabaseUrl } = require('../packages/common/config');

test('normalizes project URL', () => {
  expect(normalizeSupabaseUrl('https://abc.supabase.co')).toBe('https://abc.supabase.co');
});

test('strips copied REST API suffix to prevent duplicate /rest/v1', () => {
  expect(normalizeSupabaseUrl('https://abc.supabase.co/rest/v1')).toBe('https://abc.supabase.co');
  expect(normalizeSupabaseUrl('https://abc.supabase.co/rest/v1/')).toBe('https://abc.supabase.co');
});

test('strips trailing slashes and whitespace', () => {
  expect(normalizeSupabaseUrl(' https://abc.supabase.co/// ')).toBe('https://abc.supabase.co');
});
