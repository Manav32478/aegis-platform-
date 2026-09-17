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

function subscribe(fn) {
  clients.add(fn);
  return function unsubscribe() {
    clients.delete(fn);
  };
}

function getCache() {
  return cache;
}

async function run(provide) {
  try {
    const snap = await provide();
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

module.exports = { subscribe, getCache, start, stop };
