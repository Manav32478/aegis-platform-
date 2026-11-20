// ============================================================================
// Aegis v2 — realtime hub (Server-Sent Events broadcaster).
//
// A single background loop:
//   1. builds a fresh aggregate snapshot (Supabase history + live cloud probes)
//   2. caches it (so /badge/:cloud.svg and fast reads never touch Supabase)
//   3. broadcasts it to every connected SSE client
//
// The dashboard subscribes once and updates in place as data changes — no
// page reloads, no client polling (polling is only a silent fallback when a
// proxy blocks EventSource).
// ============================================================================

const clients = new Set();
let timer = null;
let cache = null;
let cacheTime = 0;
let inFlight = null;
const CACHE_MAX_AGE_MS = 30000;

function subscribe(fn) {
  clients.add(fn);
  return function unsubscribe() {
    clients.delete(fn);
  };
}

function getCache() {
  return cache && Date.now() - cacheTime <= CACHE_MAX_AGE_MS ? cache : null;
}

async function getSnapshot(provide) {
  const fresh = getCache();
  if (fresh) return fresh;
  if (!inFlight) {
    inFlight = Promise.resolve().then(provide).then(snap => {
      if (snap) { cache = snap; cacheTime = Date.now(); }
      return snap;
    }).finally(() => { inFlight = null; });
  }
  return inFlight;
}

async function run(provide) {
  try {
    const snap = await getSnapshot(provide);
    if (!snap) return;
    cache = snap;
    const msg = JSON.stringify({ type: 'update', at: new Date().toISOString(), ...snap });
    for (const fn of clients) {
      try {
        fn(msg);
      } catch {
        /* a broken client must not kill the loop */
      }
    }
  } catch (e) {
    // Never crash the loop on transient Supabase/network errors — retry next tick.
    if (process.env.REALTIME_DEBUG) console.error('[realtime]', e.message);
  }
}

function start(provide) {
  if (timer) return;
  const interval = Number(process.env.REALTIME_INTERVAL_MS || 10000);
  run(provide);
  timer = setInterval(() => run(provide), interval);
  if (timer.unref) timer.unref(); // don't keep the process alive just for this
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  clients.clear();
}

module.exports = { subscribe, getCache, getSnapshot, start, stop };
