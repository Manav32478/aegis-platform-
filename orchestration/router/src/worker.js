/**
 * Aegis v2 — Cloudflare edge router + free-tier cron monitor.
 *
 *  fetch():      failover router — proxies each request to the healthiest
 *                cloud (in-memory health cache; refresh every 10s so we do
 *                not pay a health round-trip per request).
 *  scheduled():  health monitor — fires every 5 min (cron trigger) and writes
 *                region-tagged checks, incidents and alerts to Supabase.
 *
 * Deploy:  cd orchestration/router && wrangler deploy
 */

const DEFAULT_TARGETS = [
  { name: 'render', url: 'https://aegis-platform-pomf.onrender.com' },
  { name: 'vercel', url: 'https://aegis-platform-lyart.vercel.app' },
  { name: 'google-cloud-run', url: 'https://aegis-app-gcp.a.run.app', enabled: false },
];

function targets(env) {
  if (env && env.TARGETS) {
    try {
      return JSON.parse(env.TARGETS);
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_TARGETS.filter((t) => t.enabled !== false);
}

const CACHE_TTL_MS = 10000;
let healthCache = { ts: 0, healthy: new Set() };

async function check(target) {
  const start = Date.now();
  try {
    const res = await fetch(target.url + '/health', {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    const ok = res.ok && res.status < 500;
    return { target, ok, latency: ok ? Date.now() - start : null, status: res.status };
  } catch {
    return { target, ok: false, latency: null, status: 0 };
  }
}

async function refreshHealth(env) {
  const results = await Promise.all(targets(env).map(check));
  healthCache = {
    ts: Date.now(),
    healthy: new Set(results.filter((r) => r.ok).map((r) => r.target.url)),
  };
  return results;
}

async function supabasePost(env, table, rows) {
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) return null;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  return res.status;
}

async function supabaseGet(env, path) {
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) return [];
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export default {
  async fetch(request, env) {
    if (Date.now() - healthCache.ts > CACHE_TTL_MS) await refreshHealth(env);

    const url = new URL(request.url);

    // Small metadata endpoint for the router itself.
    if (url.pathname === '/router/health') {
      const list = targets(env).map((t) => ({
        name: t.name,
        healthy: healthCache.healthy.has(t.url),
      }));
      return Response.json({ service: 'aegis-router', cachedTs: healthCache.ts, targets: list });
    }

    // Try healthy clouds first; fall through if a proxy fails.
    const ordered = [...targets(env)].sort(
      (a, b) => (healthCache.healthy.has(a.url) ? 0 : 1) - (healthCache.healthy.has(b.url) ? 0 : 1)
    );

    for (const target of ordered) {
      if (!healthCache.healthy.has(target.url)) continue;
      try {
        const res = await fetch(target.url + url.pathname + url.search, request);
        const headers = new Headers(res.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(res.body, { status: res.status, headers });
      } catch {
        continue;
      }
    }

    return new Response('All clouds are down', {
      status: 503,
      headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' },
    });
  },

  async scheduled(event, env, ctx) {
    const results = await refreshHealth(env);
    console.log(JSON.stringify(results));

    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) return;

    // 1. write region-tagged checks
    const rows = results.map((r) => ({
      cloud_name: r.target.name,
      region: 'cloudflare-edge',
      healthy: r.ok,
      latency: r.latency,
      http_status: r.status,
    }));
    const st = await supabasePost(env, 'health_checks', rows);
    console.log('health_checks insert → HTTP', st);

    // 2. incidents: open if down, close if recovered
    const openIncidents = await supabaseGet(
      env,
      '/rest/v1/incidents?select=*&ended_at=is.null&order=id.asc'
    );
    const downNames = results.filter((r) => !r.ok).map((r) => r.target.name);
    for (const inc of Array.isArray(openIncidents) ? openIncidents : []) {
      if (!downNames.includes(inc.cloud_name)) {
        const started = new Date(inc.started_at).getTime();
        const duration = Math.max(0, Math.round((Date.now() - started) / 1000));
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/incidents?id=eq.${inc.id}`,
          {
            method: 'PATCH',
            headers: {
              apikey: env.SUPABASE_KEY,
              Authorization: `Bearer ${env.SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ ended_at: new Date().toISOString(), duration_seconds: duration }),
          }
        );
        // recovered alert
        await supabasePost(env, 'alerts', [
          { cloud_name: inc.cloud_name, severity: 'info', kind: 'recovered',
            message: `${inc.cloud_name} recovered after ${duration}s of downtime`, channel: 'none', delivered: false },
        ]);
      }
    }
    const openNames = (openIncidents || []).map((o) => o.cloud_name);
    for (const name of downNames) {
      if (!openNames.includes(name)) {
        await supabasePost(env, 'incidents', [
          { cloud_name: name, kind: 'downtime' },
        ]);
        await supabasePost(env, 'alerts', [
          { cloud_name: name, severity: 'critical', kind: 'down',
            message: `${name} is DOWN — probe failed (edge)`, channel: 'none', delivered: false },
        ]);
      }
    }
  },
};
