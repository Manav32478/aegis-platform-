'use strict';
/**
 * Aegis local demo harness — ZERO dependencies, ZERO accounts, ZERO cost.
 *
 *   node demo/server.js   ->   open http://localhost:8080
 *
 * What it simulates (mirroring the real production architecture):
 *   1. Three clouds, each running the same app (GET /health -> {status, cloud, ...})
 *   2. A failover router that always routes to the healthiest cloud
 *   3. A health monitor that polls every 5s and records history
 *   4. A live dashboard with latency chart + chaos-test button
 *
 * The router logic here is a direct port of the production Cloudflare Worker
 * (orchestration/router/src/worker.js), and the /health contract matches app/index.js.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.DEMO_PORT || 8080);
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS || 5000);
const CHAOS_SECONDS = Number(process.env.CHAOS_SECONDS || 20);

// --- Simulated clouds (same contract as app/index.js) -----------------------
const BACKENDS = [
  { name: 'google-cloud-run', port: 3001, label: 'Google Cloud Run' },
  { name: 'oracle-cloud',     port: 3002, label: 'Oracle Cloud (Always Free)' },
  { name: 'render',           port: 3003, label: 'Render' },
];

const state = {
  startedAt: Date.now(),
  forcedDown: {},            // name -> timestamp when a chaos test "killed" it
  stats: {},                 // name -> {checks, healthy, totalLatency}
  history: [],               // [{name, ts, latency, healthy, forced}]
};

// --- Simulated cloud app -----------------------------------------------------
function makeBackend(b) {
  return http.createServer((req, res) => {
    if (req.url.startsWith('/health')) {
      // Small random latency (+ occasional spike) so the chart looks alive.
      const delay = 15 + Math.random() * 40 + (Math.random() < 0.05 ? 250 : 0);
      const body = JSON.stringify({
        status: 'ok',
        cloud: b.name,
        uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
        timestamp: Date.now(),
      });
      return setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(body);
      }, delay);
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<h1>Aegis demo — hello from ${b.label}</h1><p>cloud: ${b.name}</p>`);
  });
}

// --- Health monitor ----------------------------------------------------------
function checkBackend(b) {
  const forced = !!state.forcedDown[b.name];
  return new Promise((resolve) => {
    if (forced) {
      return resolve({ name: b.name, healthy: false, latency: null, ts: Date.now(), forced: true });
    }
    const start = Date.now();
    const req = http.get(
      { host: '127.0.0.1', port: b.port, path: '/health', timeout: 2500 },
      (res) => {
        res.resume();
        resolve({ name: b.name, healthy: res.statusCode === 200, latency: Date.now() - start, ts: Date.now(), forced: false });
      }
    );
    req.on('timeout', () => { req.destroy(); resolve({ name: b.name, healthy: false, latency: null, ts: Date.now(), forced: false }); });
    req.on('error', () => resolve({ name: b.name, healthy: false, latency: null, ts: Date.now(), forced: false }));
  });
}

function record(result) {
  const s = state.stats[result.name] || (state.stats[result.name] = { checks: 0, healthy: 0, totalLatency: 0 });
  s.checks += 1;
  if (result.healthy) { s.healthy += 1; s.totalLatency += result.latency || 0; }
  state.history.push(result);
  if (state.history.length > 300) state.history.shift();
}

async function tick() {
  const results = await Promise.all(BACKENDS.map(checkBackend));
  results.forEach(record);
  try {
    fs.appendFileSync(path.join(__dirname, 'history.jsonl'), JSON.stringify({ ts: Date.now(), results }) + '\n');
  } catch {}
  return results;
}

// --- Failover router (port of the Cloudflare Worker logic) -------------------
function latestFor(name) {
  for (let i = state.history.length - 1; i >= 0; i--) {
    if (state.history[i].name === name) return state.history[i];
  }
  return null;
}

function pickActive() {
  const healthy = BACKENDS.filter((b) => {
    const latest = latestFor(b.name);
    return latest && latest.healthy && !state.forcedDown[b.name];
  });
  if (!healthy.length) return null;
  healthy.sort((a, b) => (latestFor(a.name)?.latency ?? 9999) - (latestFor(b.name)?.latency ?? 9999));
  return healthy[0];
}

function proxy(req, res, backend) {
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: backend.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${backend.name}:${backend.port}`, connection: 'close' },
    },
    (up) => {
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
    }
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end('upstream error');
  });
  req.pipe(upstream);
}

// --- HTTP API + dashboard ----------------------------------------------------
function sendJson(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function costReport() {
  const RATE = 40; // illustrative USD per million requests (see intelligence/cost.js)
  const REQUESTS = 1000000;
  const singleCloud = (REQUESTS / 1e6) * RATE;
  return {
    monthlyRequests: REQUESTS,
    freeTierLimits: {
      'google-cloud-run': '2,000,000 requests/month free',
      'oracle-cloud': 'Always Free — up to 4 OCPU / 24 GB RAM',
      'render': '750 instance-hours/month free',
    },
    paidRatePerMillion: RATE,
    singleCloudCostUsd: singleCloud,
    aegisCostUsd: 0,
    savedUsd: singleCloud,
    note: 'Illustrative reference rate — replace with a cited figure in the report.',
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  if (p === '/') {
    const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(html);
  }

  if (p === '/api/status') {
    const clouds = BACKENDS.map((b) => {
      const s = state.stats[b.name] || { checks: 0, healthy: 0, totalLatency: 0 };
      const latest = latestFor(b.name);
      return {
        name: b.name,
        label: b.label,
        healthy: latest ? latest.healthy && !state.forcedDown[b.name] : false,
        latency: latest ? latest.latency : null,
        forcedDown: !!state.forcedDown[b.name],
        uptimePct: s.checks ? Math.round((s.healthy / s.checks) * 100) : 100,
        checks: s.checks,
      };
    });
    const active = pickActive();
    return sendJson(res, 200, { active: active ? active.name : null, clouds, since: state.startedAt, now: Date.now() });
  }

  if (p === '/api/history') {
    return sendJson(res, 200, { history: state.history.slice(-180) });
  }

  if (p === '/api/cost') {
    return sendJson(res, 200, costReport());
  }

  if (p === '/api/chaos' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        if (payload.mode === 'auto') {
          const candidates = BACKENDS.filter((b) => !state.forcedDown[b.name]);
          const victim = candidates[Math.floor(Math.random() * candidates.length)];
          state.forcedDown[victim.name] = Date.now();
          await tick(); // fail over immediately
          setTimeout(() => { delete state.forcedDown[victim.name]; tick(); }, CHAOS_SECONDS * 1000);
          return sendJson(res, 200, { chaosStarted: true, victim: victim.name, restoresInSeconds: CHAOS_SECONDS });
        }
        const { cloud, down } = payload;
        if (!cloud || typeof down !== 'boolean') {
          return sendJson(res, 400, { error: 'send {"cloud","down"} or {"mode":"auto"}' });
        }
        if (down) state.forcedDown[cloud] = Date.now();
        else delete state.forcedDown[cloud];
        await tick();
        return sendJson(res, 200, { ok: true, cloud, down: !!state.forcedDown[cloud] });
      } catch {
        return sendJson(res, 400, { error: 'bad JSON body' });
      }
    });
    return;
  }

  // Everything else (/health, /, etc.) -> failover proxy to the active cloud.
  const active = pickActive();
  if (!active) {
    return sendJson(res, 503, { status: 'down', message: 'All clouds are down — no healthy backend.' });
  }
  return proxy(req, res, active);
});

// --- Boot --------------------------------------------------------------------
(async () => {
  BACKENDS.forEach((b) =>
    makeBackend(b).listen(b.port, '127.0.0.1', () => console.log(`[backend] ${b.name} on :${b.port}`))
  );
  await tick();
  server.listen(PORT, '0.0.0.0', () =>
    console.log(`Aegis demo router + dashboard listening on 0.0.0.0:${PORT}`)
  );
  setInterval(tick, CHECK_INTERVAL_MS);
})();
