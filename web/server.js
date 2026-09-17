// ============================================================================
// Aegis v2 — web portal server (professional front door).
//
// Pages:      /               landing
//             /dashboard.html live dashboard (SSE real-time + on-demand probes)
//             /status.html    public status (no login)
//             /admin.html     targets, keys, audit, reports
//
// Real-time:  /api/stream     Server-Sent Events feed for live dashboard updates
// Badges:     /badge/:cloud.svg   embeddable uptime badge (GitHub README etc.)
// Export:     /api/export.csv     download the raw / derived data
// API:        /api/aggregate      one-shot snapshot (legacy + fallback)
// ============================================================================

const express = require('express');
const path = require('path');
const { sb, insertReturning } = require('../packages/common/supabase');
const { getTargets, DEFAULT_TARGETS } = require('../packages/common/config');
const { provideSnapshot } = require('./data');
const realtime = require('./realtime');
const { publicMetrics } = require('./metrics');

const app = express();
app.use(express.json());
app.disable('x-powered-by');

const PORT = process.env.PORT || 3100;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---- start the realtime hub (10s tick: probe clouds + broadcast) ----------
realtime.start(provideSnapshot);

// ---- real-time stream (SSE) ------------------------------------------------
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');

  // send current snapshot immediately if available
  const cached = realtime.getCache();
  if (cached) {
    res.write(`data: ${JSON.stringify({ type: 'update', at: new Date().toISOString(), ...cached })}\n\n`);
  } else {
    provideSnapshot()
      .then((snap) => res.write(`data: ${JSON.stringify({ type: 'update', at: new Date().toISOString(), ...snap })}\n\n`))
      .catch(() => {});
  }

  const onUpdate = (msg) => res.write(`data: ${msg}\n\n`);
  const unsubscribe = realtime.subscribe(onUpdate);

  req.on('close', () => unsubscribe());
});

// ---- live snapshot (alias of aggregate; also used as poll fallback) --------
app.get('/api/aggregate', async (req, res) => {
  try {
    res.json(await provideSnapshot());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/live', async (req, res) => {
  try {
    // cached if fresh, else build
    res.json(realtime.getCache() || (await provideSnapshot()));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---- uptime badge -----------------------------------------------------------
function badgeSvg(label, status, color, pct, extra) {
  const L = label.length * 6.5 + 11;
  const W = 72 + extra.length * 6.5 + 4;
  const X = L + 56;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${X}" height="20" role="img" aria-label="${label}: ${pct}">
  <linearGradient id="a" x2="0" y2="100%"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#2b5fc9"/></linearGradient>
  <clipPath id="r"><rect width="${X}" height="20" rx="4"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${L}" height="20" fill="url(#a)"/>
    <rect x="${L}" width="${X - L}" height="20" fill="#121a2a"/>
    <rect width="${X}" height="20" fill="none" stroke="#22304a"/>
  </g>
  <g font-family="system-ui,sans-serif" font-size="11" text-anchor="middle" font-weight="600">
    <text x="${L / 2}" y="14" fill="#e7edf7">${label}</text>
    <text x="${X - (X - L) / 2 - 8}" y="14" fill="${color}" font-size="10">${pct}</text>
  </g>
</svg>`;
}

app.get('/badge/:cloud.svg', async (req, res) => {
  try {
    const snap = realtime.getCache() || (await provideSnapshot());
    const a = snap.analytics && snap.analytics[req.params.cloud];
    if (!a) return res.status(404).send('unknown cloud');
    const pct = a.uptimePct == null ? '0%' : a.uptimePct + '%';
    const color = a.uptimePct >= 99.9 ? '#2fd57a' : a.uptimePct >= 99 ? '#ffb454' : '#ff5d6c';
    const status = a.last && a.last.healthy ? 'up' : 'down';
    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'no-cache');
    res.send(badgeSvg(`aegis:${req.params.cloud} ${status}`, status, color, pct, ''));
  } catch (e) {
    res.status(502).send('error');
  }
});

// ---- export (CSV) -----------------------------------------------------------
function csv(rows, cols) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

app.get('/api/export.csv', async (req, res) => {
  try {
    const snap = await provideSnapshot();
    const rows = [];
    for (const [name, a] of Object.entries(snap.analytics || {})) {
      rows.push({
        cloud: name,
        health_score: a.score,
        grade: a.grade,
        uptime_pct: a.uptimePct,
        avg_latency_ms: a.avgLatencyMs,
        p50: a.percentiles.p50,
        p95: a.percentiles.p95,
        p99: a.percentiles.p99,
        error_rate: a.errorRate,
        checks: a.checks,
      });
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="aegis-health.csv"');
    res.send(csv(rows, ['cloud', 'health_score', 'grade', 'uptime_pct', 'avg_latency_ms', 'p50', 'p95', 'p99', 'error_rate', 'checks']));
  } catch (e) {
    res.status(502).send('error: ' + e.message);
  }
});

app.get('/api/export.json', async (req, res) => {
  try {
    const snap = await provideSnapshot();
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="aegis-health.json"');
    res.send(JSON.stringify(
      {
        generatedAt: snap.generatedAt,
        clouds: snap.analytics,
        route: snap.route,
        cost: snap.cost,
        incidents: snap.incidents,
      },
      null,
      2
    ));
  } catch (e) {
    res.status(502).send('{"error":"' + e.message + '"}');
  }
});

// ---- admin (targets, keys, audit, reports) ----------------------------------

function requireAdmin(req, res, next) {
  const tok = (req.headers['x-admin-token'] || '').toString();
  if (!ADMIN_TOKEN || tok !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'admin token required (set ADMIN_TOKEN)' });
  }
  next();
}

app.get('/api/admin/targets', requireAdmin, async (req, res) => {
  const rows = await sb('/rest/v1/monitor_targets?select=*&order=id.asc').catch(() => []);
  res.json({ targets: Array.isArray(rows) ? rows : [] });
});

app.post('/api/admin/targets', requireAdmin, async (req, res) => {
  const { cloud_name, url, region } = req.body || {};
  if (!cloud_name || !url) return res.status(400).json({ error: 'cloud_name + url required' });
  const created = await insertReturning('monitor_targets', { cloud_name, url, region: region || 'unknown', enabled: true });
  res.json({ created: created && created[0] });
});

app.patch('/api/admin/targets/:id', requireAdmin, async (req, res) => {
  const { enabled } = req.body || {};
  try {
    await sb(`/rest/v1/monitor_targets?id=eq.${req.params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ enabled: !!enabled }),
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.delete('/api/admin/targets/:id', requireAdmin, async (req, res) => {
  try {
    await sb(`/rest/v1/monitor_targets?id=eq.${req.params.id}`, { method: 'DELETE' });
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/admin/audit', requireAdmin, async (req, res) => {
  const rows = await sb('/rest/v1/audit_log?select=*&order=id.desc&limit=100').catch(() => []);
  res.json({ events: Array.isArray(rows) ? rows : [] });
});

app.post('/api/admin/reports', requireAdmin, async (req, res) => {
  try {
    const { buildReport } = require('../orchestration/report');
    const { report, savedId } = await buildReport();
    res.json({ savedId, headline: report.headline, totalChecks: report.totalChecks });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/admin/keys', requireAdmin, async (req, res) => {
  try {
    const crypto = require('crypto');
    const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
    const orgName = (req.body && req.body.org) || 'default';
    const org = await insertReturning('organizations', { name: orgName });
    const orgId = org && org[0] && org[0].id;
    const key = 'ak_' + crypto.randomBytes(24).toString('hex');
    await insertReturning('api_keys', { org_id: orgId, key_hash: sha256(key), label: (req.body && req.body.label) || '' });
    res.json({ key });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---- static + health ---------------------------------------------------------

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'aegis-web' }));

app.get('/metrics', async (req, res) => {
  try {
    res.json(await publicMetrics());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aegis web portal on http://localhost:${PORT}`);
    console.log(`  Landing / · Dashboard /dashboard.html · Status /status.html · Admin /admin.html`);
    console.log(`  Realtime /api/stream · Badges /badge/:cloud.svg · Export /api/export.csv`);
  });
}

module.exports = app;
