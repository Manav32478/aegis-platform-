const { sb } = require('../packages/common/supabase');
afterEach(() => jest.restoreAllMocks());
function okResponse() { return { ok: true, text: async () => '[]' }; }

test('a transient network failure on a read is retried once', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(okResponse());
  await expect(sb('/rest/v1/health_checks')).resolves.toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('writes are not retried after network failure', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));
  await expect(sb('/rest/v1/health_checks', { method: 'POST', body: '[]' })).rejects.toThrow('network');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('HTTP authorization failures are not retried', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
  await expect(sb('/rest/v1/health_checks')).rejects.toThrow('supabase 401');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
