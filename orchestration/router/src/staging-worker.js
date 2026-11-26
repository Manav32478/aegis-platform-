// Isolated experimental staging router. No production defaults, scheduler, database writes or deploy hooks.
// Priority is default. Latency mode uses per-isolate health latency EWMA with hysteresis.
const TTL = 10000;
const MARGIN_MS = 30;
const RELATIVE_MARGIN = 0.20;
const SWITCH_SAMPLES = 3;
const KNOWN_LIVE_HOSTS = new Set(['aegis-platform-pomf.onrender.com', 'aegis-platform-11f7.vercel.app', 'aegis-router.manav32478.workers.dev', 'aegis-platform-iota.vercel.app']);
let cache = { at: 0, signature: '', states: new Map(), selected: null, candidate: null, streak: 0 };
let inflight = null;

function readTargets(env) {
  let rows;
  try { rows = JSON.parse(env.TARGETS); } catch { return null; }
  if (!Array.isArray(rows) || !rows.length || rows.length > 8) return null;
  const names = new Set(), urls = new Set(), result = [];
  for (const t of rows) {
    if (!t || t.enabled === false) continue;
    if (typeof t.name !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(t.name) || typeof t.url !== 'string') return null;
    let u; try { u = new URL(t.url); } catch { return null; }
    if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash || KNOWN_LIVE_HOSTS.has(u.hostname.toLowerCase())) return null;
    const base = u.origin;
    if (names.has(t.name) || urls.has(base)) return null;
    names.add(t.name); urls.add(base); result.push({ name: t.name, url: base });
  }
  return result.length ? result : null;
}

async function probe(target) {
  const start = Date.now();
  try {
    const r = await fetch(target.url + '/health', { method: 'GET', signal: AbortSignal.timeout(2000) });
    return { ok: r.ok, latency: r.ok ? Date.now() - start : null };
  } catch { return { ok: false, latency: null }; }
}
async function refresh(targets, signature, mode) {
  const old = cache.signature === signature ? cache : { states: new Map(), selected: null, candidate: null, streak: 0 };
  const probes = await Promise.all(targets.map(probe));
  const states = new Map();
  targets.forEach((t, i) => {
    const p = probes[i], prev = old.states.get(t.url);
    const ewma = p.ok ? (prev && prev.ewma != null ? 0.3 * p.latency + 0.7 * prev.ewma : p.latency) : null;
    states.set(t.url, { ok: p.ok, latency: p.latency, ewma });
  });
  const healthy = targets.filter(t => states.get(t.url).ok);
  let selected = old.selected, candidate = null, streak = 0;
  if (!healthy.some(t => t.url === selected)) selected = healthy.length ? healthy[0].url : null;
  if (mode === 'latency' && healthy.length && selected) {
    const fastest = healthy.reduce((a,b) => states.get(a.url).ewma <= states.get(b.url).ewma ? a : b);
    const current = states.get(selected).ewma, best = states.get(fastest.url).ewma;
    if (fastest.url !== selected && current - best >= Math.max(MARGIN_MS, current * RELATIVE_MARGIN)) {
      candidate = fastest.url;
      streak = old.candidate === candidate ? old.streak + 1 : 1;
      if (streak >= SWITCH_SAMPLES) { selected = candidate; candidate = null; streak = 0; }
    }
  } else if (mode !== 'latency') selected = healthy.length ? healthy[0].url : null;
  cache = { at: Date.now(), signature, states, selected, candidate, streak };
}
async function ensureHealth(targets, signature, mode) {
  if (cache.signature !== signature || Date.now() - cache.at > TTL) {
    // One refresh per isolate at a time. Configuration changes trigger another refresh if needed.
    if (inflight) await inflight;
    if (cache.signature !== signature || Date.now() - cache.at > TTL) {
      inflight = refresh(targets, signature, mode);
      try { await inflight; } finally { inflight = null; }
    }
  }
}
export default {
  async fetch(request, env) {
    const targets = readTargets(env);
    if (!targets) return new Response('Staging router: invalid or missing TARGETS', { status: 503 });
    const mode = env.ROUTING_MODE === 'latency' ? 'latency' : 'priority';
    const signature = JSON.stringify(targets) + ':' + mode;
    await ensureHealth(targets, signature, mode);
    const url = new URL(request.url);
    if (url.pathname === '/router/health') {
      return Response.json({ service: 'aegis-staging-router', mode, cachedTs: cache.at,
        selected: targets.find(t => t.url === cache.selected)?.name || null,
        targets: targets.map(t => { const s = cache.states.get(t.url); return { name: t.name, healthy: !!s?.ok, latencyMs: s?.latency ?? null, smoothedLatencyMs: s?.ewma == null ? null : Math.round(s.ewma) }; }) },
        { headers: { 'Cache-Control': 'no-store' } });
    }
    const healthy = targets.filter(t => cache.states.get(t.url)?.ok);
    const ordered = [...healthy].sort((a,b) => (a.url === cache.selected ? -1 : b.url === cache.selected ? 1 : 0));
    if (!ordered.length) return new Response('All staging origins are unhealthy', { status: 503 });
    const safeToRetry = request.method === 'GET' || request.method === 'HEAD';
    let firstFailure = null;
    for (const target of ordered) {
      try {
        const res = await fetch(target.url + url.pathname + url.search, request.clone());
        if (safeToRetry && res.status >= 500 && res.status <= 599) { if (!firstFailure) firstFailure = res; else if (res.body) await res.body.cancel().catch(() => {}); continue; }
        if (firstFailure?.body) await firstFailure.body.cancel().catch(() => {});
        return res;
      } catch {
        if (!safeToRetry) return new Response('Origin request failed; not retried', { status: 502 });
      }
      if (!safeToRetry) break;
    }
    return firstFailure || new Response('All staging origin requests failed', { status: 502 });
  },
};
