import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../orchestration/router/src/worker.js', import.meta.url), 'utf8');
const worker = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  calls.push({ url, method: init.method || 'GET' });
  if (url === 'https://healthy.test/health') return new Response('{}', { status: 200 });
  if (url.startsWith('https://db.test/rest/v1/incidents?') && !init.method) {
    return Response.json([{ id: 1, cloud_name: 'healthy', started_at: new Date().toISOString() }, { id: 2, cloud_name: 'not-monitored', started_at: new Date().toISOString() }]);
  }
  if (url.startsWith('https://db.test/')) return new Response(null, { status: 204 });
  throw new Error('Unexpected URL ' + url);
};
const env = {
  SUPABASE_URL: 'https://db.test', SUPABASE_KEY: 'local-test',
  TARGETS: JSON.stringify([{ name: 'healthy', url: 'https://healthy.test' }, { name: 'disabled', url: 'https://disabled.test', enabled: false }]),
};
const response = await worker.fetch(new Request('https://router.test/router/health'), env);
const result = await response.json();
assert.deepEqual(result.targets.map(x => x.name), ['healthy']);
await worker.scheduled({}, env, {});
assert(calls.some(c => c.method === 'PATCH' && c.url.includes('incidents?id=eq.1')));
assert(!calls.some(c => c.method === 'PATCH' && c.url.includes('incidents?id=eq.2')));
assert(!calls.some(c => c.url.includes('disabled.test')));
