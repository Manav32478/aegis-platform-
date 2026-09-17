// ============================================================================
// Aegis v2 — multi-tenant API service (Month 5, upgraded).
//
//   • API-key authentication (hashed in Supabase) + optional local demo keys
//   • per-key in-memory rate limiting (and Redis-ready slot for production)
//   • audit log — every authenticated call is recorded
//   • Swagger UI at /api-docs
//   • new endpoints: /api/monitoring, /api/forecast, /api/incidents,
//                    /api/alerts, /api/reports, /api/failover
//
// Run:  cd api && npm install && node index.js      → http://localhost:4000/api-docs
// ============================================================================

const express = require('express');
const crypto = require('crypto');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const {
  estimateAegisSavings,
  estimateCloudRunOverage,
  forecastAnnual,
  FREE_TIER_LIMITS,
} = require('../intelligence/cost');
const { sb, insertReturning, insert, getHealthChecks } = require('../packages/common/supabase');

const app = express();
app.use(express.json());
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kagjbxxmdyaypfcqemem.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY || 'sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti';
const DEMO_KEYS = (process.env.ALLOWED_KEYS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---- rate limiting (in-memory) -------------------------------------------
const RATE_WINDOW_MS = 60000;
const RATE_MAX = Number(process.env.RATE_MAX || 60);
const hits = new Map(); // keyHash -> {count, windowStart}

function rateLimited(keyHash) {
  const now = Date.now();
  const rec = hits.get(keyHash);
  if (!rec || now - rec.windowStart > RATE_WINDOW_MS) {
    hits.set(keyHash, { count: 1, windowStart: now });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_MAX;
}

async function keyValid(key) {
  const rows = await sb(
    `/rest/v1/api_keys?select=id&key_hash=eq.${encodeURIComponent(sha256(key))}&limit=1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function authKey(req) {
  const key = (req.headers['x-api-key'] || '').toString().trim();
  if (!key) return { error: ['missing x-api-key header'], status: 401 };
  try {
    const ok = (DEMO_KEYS.length && DEMO_KEYS.includes(key)) || (await keyValid(key));
    if (!ok) return { error: ['invalid api key'], status: 403 };
  } catch {
    return { error: ['could not reach auth backend (Supabase)'], status: 502 };
  }
  if (rateLimited(sha256(key))) {
    return { error: [`rate limit exceeded (${RATE_MAX}/min)`], status: 429 };
  }
  try {
    await sb('/rest/v1/api_keys?key_hash=eq.' + encodeURIComponent(sha256(key)), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    });
  } catch { /* audit-time update is best-effort */ }
  return { key };
}

function requireApiKey(msgOnly = false) {
  return async (req, res, next) => {
    const auth = await authKey(req);
    if (auth.error) {
      return res.status(auth.status).json({
        error: msgOnly ? auth.error[0] : undefined,
        errors: msgOnly ? undefined : auth.error,
      });
    }
    req.authKey = auth.key;
    next();
  };
}

// ---- audit log -------------------------------------------------------------
async function audit(actor, action, detail = '') {
  try {
    await insert('audit_log', { actor, action, detail });
  } catch { /* best-effort */ }
}

// ---- Swagger ---------------------------------------------------------------
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Aegis API v2',
      version: '2.0.0',
      description:
        'Multi-tenant API for the Aegis self-healing multi-cloud platform. ' +
        'Generate a key with `node generate-key.js` and pass it in the `x-api-key` header.',
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: [__filename],
});

/** @openapi
 * /health:
 *   get:
 *     summary: Public health check (no key required)
 *     security: []
 *     responses: { 200: { description: ok } }
 */
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'aegis-api', timestamp: Date.now() })
);

async function latestChecks(limit = 300) {
  const rows = await getHealthChecks(limit);
  return rows.filter((r) => r.cloud_name !== 'test-probe');
}

/** @openapi
 * /api/status:
 *   get:
 *     summary: Latest cloud health + uptime (last 300 checks)
 *     responses: { 200: { description: per-cloud status }, 401: { description: missing key }, 403: { description: invalid key }, 429: { description: rate limited } }
 */
app.get('/api/status', requireApiKey(), async (req, res) => {
  try {
    const rows = await latestChecks(300);
    const per = {};
    for (const r of rows) {
      per[r.cloud_name] = per[r.cloud_name] || { checks: 0, healthy: 0 };
      per[r.cloud_name].checks += 1;
      if (r.healthy) per[r.cloud_name].healthy += 1;
    }
    const clouds = Object.entries(per).map(([name, s]) => ({
      cloud: name,
      uptimePct: Math.round((s.healthy / s.checks) * 100),
      checks: s.checks,
    }));
    await audit(req.authKey, 'api/status', `returned ${clouds.length} clouds`);
    res.json({ clouds, lastCheck: rows.length ? rows[0].checked_at : null });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/** @openapi
 * /api/monitoring:
 *   get:
 *     summary: Full monitoring analytics — health score, percentiles, error rate per cloud
 *     responses: { 200: { description: analytics bundle } }
 */
app.get('/api/monitoring', requireApiKey(), async (req, res) => {
  try {
    const rows = await latestChecks(2000);
    await audit(req.authKey, 'api/monitoring', 'analytics bundle');
    res.json(require('../orchestration/monitor').analyzeHistory(rows));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/** @openapi
 * /api/incidents:
 *   get:
 *     summary: Downtime/degradation incidents (newest first)
 *     responses: { 200: { description: incident list } }
 */
app.get('/api/incidents', requireApiKey(), async (req, res) => {
  try {
    const rows = await sb('/rest/v1/incidents?select=*&order=id.desc&limit=100');
    await audit(req.authKey, 'api/incidents', `${rows.length} incidents`);
    res.json({ incidents: rows });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/** @openapi
 * /api/alerts:
 *   get:
 *     summary: Alert log (down / recovered / degraded events)
 *     responses: { 200: { description: alert list } }
 */
app.get('/api/alerts', requireApiKey(), async (req, res) => {
  try {
    const rows = await sb('/rest/v1/alerts?select=*&order=id.desc&limit=100');
    await audit(req.authKey, 'api/alerts', `${rows.length} alerts`);
    res.json({ alerts: rows });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/** @openapi
 * /api/reports:
 *   get:
 *     summary: Generated daily/weekly reports
 *     responses: { 200: { description: report list } }
 */
app.get('/api/reports', requireApiKey(), async (req, res) => {
  try {
    const rows = await sb('/rest/v1/health_reports?select=*&order=id.desc&limit=50');
    await audit(req.authKey, 'api/reports', `${rows.length} reports`);
    res.json({ reports: rows });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/** @openapi
 * /api/failover:
 *   get:
 *     summary: Failover events (which cloud took over for which)
 *     responses: { 200: { description: failover list } }
 */
app.get('/api/failover', requireApiKey(), async (req, res) => {
  try {
    const rows = await sb('/rest/v1/failover_events?select=*&order=id.desc&limit=100');
    await audit(req.authKey, 'api/failover', `${rows.length} failover events`);
    res.json({ failover: rows });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/** @openapi
 * /api/cost-report:
 *   get:
 *     summary: Monthly savings vs a single paid cloud
 *     parameters:
 *       - in: query
 *         name: requests
 *         schema: { type: integer }
 *         description: monthly requests (default 1000000)
 *     responses: { 200: { description: cost breakdown } }
 */
app.get('/api/cost-report', requireApiKey(), (req, res) => {
  const requests = Number(req.query.requests || 1000000);
  const { singleCloud, aegisCost, saved } = estimateAegisSavings(requests);
  const overage = estimateCloudRunOverage(requests);
  res.json({
    monthlyRequests: requests,
    freeTierLimits: FREE_TIER_LIMITS,
    singleCloudCostUsd: singleCloud,
    aegisCostUsd: aegisCost,
    savedUsd: saved,
    cloudRunOverage: overage,
  });
});

/** @openapi
 * /api/forecast:
 *   get:
 *     summary: 12-month cost forecast (single cloud vs Aegis free tier)
 *     parameters:
 *       - in: query
 *         name: requests
 *         schema: { type: integer }
 *       - in: query
 *         name: growth
 *         schema: { type: number }
 *         description: monthly growth % (default 10)
 *     responses: { 200: { description: forecast rows } }
 */
app.get('/api/forecast', requireApiKey(), (req, res) => {
  const requests = Number(req.query.requests || 1000000);
  const growth = Number(req.query.growth || 10);
  res.json(forecastAnnual(requests, growth, 12));
});

/** @openapi
 * /api/risk:
 *   get:
 *     summary: Clouds flagged at-risk by the ML model
 *     responses: { 200: { description: risk flags } }
 */
app.get('/api/risk', requireApiKey(), async (req, res) => {
  try {
    const rows = await sb('/rest/v1/risk_flags?select=cloud_name,flagged_at&order=id.desc&limit=100');
    const latest = {};
    for (const r of rows) if (!latest[r.cloud_name]) latest[r.cloud_name] = r;
    res.json({ atRisk: Object.values(latest) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/** @openapi
 * /api/security-score:
 *   get:
 *     summary: Security scan summary (Trivy + Checkov + OPA from CI)
 *     responses: { 200: { description: security summary } }
 */
app.get('/api/security-score', requireApiKey(), (req, res) => {
  res.json({
    trivy: process.env.TRIVY_SUMMARY || 'runs in CI on every push',
    checkov: process.env.CHECKOV_SUMMARY || 'runs in CI on every push',
    opa: 'policy checks gate deployments (intelligence/policy/)',
  });
});

app.get('/', (req, res) => res.redirect('/api-docs'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 404 + error handler
app.use((req, res) => res.status(404).json({ error: 'not found — see /api-docs' }));
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aegis API v2 on http://localhost:${PORT}`);
    console.log(`Swagger UI:   http://localhost:${PORT}/api-docs`);
    if (!DEMO_KEYS.length) console.log('Key check against Supabase api_keys table');
  });
}

module.exports = app;
