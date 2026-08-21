/**
 * Aegis router + monitor — one Cloudflare Worker (Month 3.4 + free cron monitor).
 *
 *  - fetch():     failover router. Proxies every request to the first healthy
 *                 cloud, with an in-memory health cache so we don't pay a
 *                 health round-trip on every single request.
 *  - scheduled(): health monitor. Fires every 5 min via the Cron Trigger in
 *                 wrangler.toml and writes results to Supabase (free — avoids
 *                 GitHub Actions minute limits).
 *
 * Deploy:  npm i -g wrangler && wrangler login && wrangler deploy
 */

const TARGETS = [
  'https://aegis-platform-pomf.onrender.com',
  'https://aegis-platform-lyart.vercel.app',
];

const CACHE_TTL_MS = 10000; // refresh health cache every 10s

let healthCache = { ts: 0, healthy: new Set() };

async function check(target) {
  const start = Date.now();
  try {
    const res = await fetch(target + '/health', {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    const ok = res.ok;
    return { target, ok, latency: ok ? Date.now() - start : null };
  } catch {
    return { target, ok: false, latency: null };
  }
}

async function refreshHealth() {
  const results = await Promise.all(TARGETS.map(check));
  healthCache = {
    ts: Date.now(),
    healthy: new Set(results.filter((r) => r.ok).map((r) => r.target)),
  };
  return results;
}

export default {
  async fetch(request) {
    if (Date.now() - healthCache.ts > CACHE_TTL_MS) await refreshHealth();

    const url = new URL(request.url);
    // Try healthy clouds first; fall through to the others if a proxy fails.
    const ordered = [...TARGETS].sort(
      (a, b) => (healthCache.healthy.has(a) ? 0 : 1) - (healthCache.healthy.has(b) ? 0 : 1)
    );

    for (const target of ordered) {
      if (!healthCache.healthy.has(target)) continue;
      try {
        const res = await fetch(target + url.pathname + url.search, request);
        const headers = new Headers(res.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(res.body, { status: res.status, headers });
      } catch {
        continue;
      }
    }

    return new Response('All clouds are down', {
      status: 503,
      headers: {
        'content-type': 'text/plain',
        'access-control-allow-origin': '*',
      },
    });
  },

  async scheduled(event, env, ctx) {
    const results = await refreshHealth();
    console.log(JSON.stringify(results));

    if (env.SUPABASE_URL && env.SUPABASE_KEY) {
      const rows = results.map((r) => ({
        cloud_name: r.target.replace(/^https?:\/\//, ''),
        healthy: r.ok,
        latency: r.latency,
      }));
      await fetch(`${env.SUPABASE_URL}/rest/v1/health_checks`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_KEY,
          Authorization: `Bearer ${env.SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(rows),
      });
    }
  },
};
