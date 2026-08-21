// Aegis multi-tenant API — Month 5
// Validates an API key (hashed in Supabase api_keys) before serving data.
// Swagger UI at /api-docs. Zero WebSocket dependency — works on Node 18/20/22.
//
// Run:  cd api && npm install && node index.js      →  http://localhost:4000/api-docs
// Demo (no Supabase):  ALLOWED_KEYS=abc node index.js  →  use "abc" as x-api-key
const express = require('express');
const crypto = require('crypto');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const {
  estimateAegisSavings,
  estimateSingleCloudCost,
  FREE_TIER_LIMITS,
} = require('../intelligence/cost');

const app = express();
app.use(express.json());

// CORS (so the React dashboard / showcase can call the API from the browser)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://kagjbxxmdyaypfcqemem.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  'sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti';
const DEMO_KEYS = (process.env.ALLOWED_KEYS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Supabase REST helper (plain fetch, no client dependency). */
async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function keyValid(key) {
  const rows = await sb(
    `/rest/v1/api_keys?select=id&key_hash=eq.${encodeURIComponent(sha256(key))}&limit=1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

/** API-key auth middleware. */
async function requireApiKey(req, res, next) {
  const key = (req.headers['x-api-key'] || '').toString().trim();
  if (!key) return res.status(401).json({ error: 'missing x-api-key header' });
  try {
    if (DEMO_KEYS.length && DEMO_KEYS.includes(key)) return next();
    if (await keyValid(key)) return next();
  } catch {
    return res.status(502).json({ error: 'could not reach auth backend (Supabase)' });
  }
  return res.status(403).json({ error: 'invalid api key' });
}

// Swagger --------------------------------------------------------------------
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Aegis API',
      version: '1.0.0',
      description:
        'Multi-tenant API for the Aegis self-healing multi-cloud platform. ' +
        'Get an API key with `node generate-key.js`, then pass it in the `x-api-key` header.',
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

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Public health check (no key required)
 *     security: []
 *     responses: { 200: { description: ok } }
 */
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'aegis-api', timestamp: Date.now() })
);

/**
 * @openapi
 * /api/status:
 *   get:
 *     summary: Latest cloud health + uptime (last 300 checks)
 *     responses:
 *       200: { description: per-cloud status }
 *       401: { description: missing key }
 *       403: { description: invalid key }
 */
app.get('/api/status', requireApiKey, async (req, res) => {
  try {
    const rows = await sb(
      '/rest/v1/health_checks?select=cloud_name,healthy,latency,checked_at&order=id.desc&limit=300'
    );
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
    res.json({ clouds, lastCheck: rows.length ? rows[0].checked_at : null });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/**
 * @openapi
 * /api/cost-report:
 *   get:
 *     summary: Estimated monthly savings vs a single paid cloud
 *     parameters:
 *       - in: query
 *         name: requests
 *         schema: { type: integer }
 *         description: monthly requests (default 1000000)
 *     responses:
 *       200: { description: cost breakdown }
 */
app.get('/api/cost-report', requireApiKey, (req, res) => {
  const requests = Number(req.query.requests || 1000000);
  const { singleCloud, aegisCost, saved } = estimateAegisSavings(requests);
  res.json({
    monthlyRequests: requests,
    freeTierLimits: FREE_TIER_LIMITS,
    singleCloudCostUsd: singleCloud,
    aegisCostUsd: aegisCost,
    savedUsd: saved,
  });
});

/**
 * @openapi
 * /api/risk:
 *   get:
 *     summary: Clouds flagged as at-risk by the ML model (Isolation Forest)
 *     responses:
 *       200: { description: risk flags }
 */
app.get('/api/risk', requireApiKey, async (req, res) => {
  try {
    const rows = await sb(
      '/rest/v1/risk_flags?select=cloud_name,flagged_at&order=id.desc&limit=100'
    );
    const latest = {};
    for (const r of rows) if (!latest[r.cloud_name]) latest[r.cloud_name] = r;
    res.json({ atRisk: Object.values(latest) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/**
 * @openapi
 * /api/security-score:
 *   get:
 *     summary: Security scan summary (Trivy + Checkov + OPA from CI)
 *     responses:
 *       200: { description: security summary }
 */
app.get('/api/security-score', requireApiKey, (req, res) => {
  res.json({
    trivy: process.env.TRIVY_SUMMARY || 'runs in CI on every push',
    checkov: process.env.CHECKOV_SUMMARY || 'runs in CI on every push',
    opa: 'policy checks gate deployments (intelligence/policy/)',
  });
});

app.get('/', (req, res) => res.redirect('/api-docs'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aegis API on http://localhost:${PORT}`);
  console.log(`Swagger UI:  http://localhost:${PORT}/api-docs`);
  if (!DEMO_KEYS.length) console.log('Key check against Supabase api_keys table');
});
