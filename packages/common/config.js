// Aegis v2 — shared configuration.
// Every microservice (monitor, api, web) requires this so there is ONE source
// of truth for targets, regions and defaults.

const DEFAULT_SUPABASE_URL = 'https://kagjbxxmdyaypfcqemem.supabase.co';

/**
 * Normalize either a Supabase Project URL or a copied REST API base URL to the
 * project root. The REST helper appends /rest/v1 itself. This avoids the
 * common Vercel setting mistake of storing ...supabase.co/rest/v1 and then
 * requesting .../rest/v1/rest/v1/... (PostgREST PGRST125).
 */
function normalizeSupabaseUrl(value) {
  return String(value || DEFAULT_SUPABASE_URL)
    .trim()
    .replace(/\/(?:rest\/v1|auth\/v1|storage\/v1)\/?$/i, '')
    .replace(/\/+$/, '');
}

if (process.env.AEGIS_MODE && !['staging', 'legacy'].includes(process.env.AEGIS_MODE))
  throw new Error('Invalid AEGIS_MODE; use staging or legacy');
const STAGING = process.env.AEGIS_MODE === 'staging';
if (STAGING) validateStagingConfig(process.env);
const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL);

// Publishable (anon) key — safe to ship in client code by design.
const SUPABASE_KEY = process.env.SUPABASE_KEY ||
  'sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti';

// Default targets. `enabled:false` means "planned / not yet deployed" — the
// monitor skips them until the user deploys to GCP / Oracle and flips them on
// (via env TARGETS, or the admin page).
const DEFAULT_TARGETS = [
  { name: 'render',           url: 'https://aegis-platform-pomf.onrender.com/health', region: 'oregon',      enabled: true  },
  { name: 'vercel',           url: 'https://aegis-platform-11f7.vercel.app/health',  region: 'global edge', enabled: true  },
  { name: 'google-cloud-run', url: 'https://aegis-app-gcp.a.run.app/health',          region: 'us-central1', enabled: false },
  { name: 'oracle-cloud',     url: 'http://YOUR_ORACLE_VM_IP/health',                 region: 'ap-mumbai-1', enabled: false },
];

// Staging must be explicit and must never silently fall back to the known live demo.
// This is an operator safety guard, not proof of isolation from every possible resource.
function validateStagingConfig(env) {
  const forbidden = new Set(['kagjbxxmdyaypfcqemem.supabase.co', 'aegis-platform-pomf.onrender.com',
    'aegis-platform-11f7.vercel.app', 'aegis-router.manav32478.workers.dev', 'aegis-platform-iota.vercel.app']);
  function url(value, label) {
    let u;
    try { u = new URL(value); } catch { throw new Error(`Staging: ${label} must be an explicit HTTPS URL`); }
    if (u.protocol !== 'https:' || u.username || u.password || forbidden.has(u.hostname.toLowerCase()))
      throw new Error(`Staging: ${label} must be a separate HTTPS resource, not a known live demo resource`);
    return u;
  }
  const db = url(env.SUPABASE_URL, 'SUPABASE_URL');
  if (!db.hostname.endsWith('.supabase.co')) throw new Error('Staging: SUPABASE_URL must be a Supabase project URL');
  if (!env.SUPABASE_KEY || env.SUPABASE_KEY === 'sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti')
    throw new Error('Staging: set the separate staging SUPABASE_KEY');
  url(env.AEGIS_ROUTER_URL, 'AEGIS_ROUTER_URL');
  let list;
  try { list = JSON.parse(env.TARGETS); } catch { throw new Error('Staging: TARGETS must be a JSON array'); }
  if (!Array.isArray(list) || !list.length) throw new Error('Staging: TARGETS must be a nonempty JSON array');
  for (const t of list) {
    if (!t || typeof t.name !== 'string' || !t.name.trim() || typeof t.url !== 'string')
      throw new Error('Staging: each target needs a name and health URL');
    const u = url(t.url, 'target URL');
    if (u.pathname !== '/health' || u.search || u.hash) throw new Error('Staging: target URLs must end in /health');
  }
  return true;
}

/**
 * Which vantage point is this runner checking from?
 *  - GitHub Actions cron  → 'github-actions'
 *  - Cloudflare Worker    → 'cloudflare-edge'
 *  - Oracle Always-Free VM→ 'oracle-vm'
 * Storing this gives us real multi-region monitoring evidence.
 */
const MONITOR_REGION = process.env.MONITOR_REGION || 'local-runner';

/**
 * Build the active target list.
 *  1) If TARGETS env is set (GitHub secret), use it verbatim.
 *  2) Otherwise use DEFAULT_TARGETS filtered to enabled ones.
 */
function getTargets() {
  if (STAGING) return JSON.parse(process.env.TARGETS).filter(t => t.enabled !== false);
  if (process.env.TARGETS) {
    try {
      return JSON.parse(process.env.TARGETS);
    } catch {
      /* fall through to defaults */
    }
  }
  return DEFAULT_TARGETS.filter((t) => t.enabled !== false);
}

module.exports = {
  SUPABASE_URL,
  normalizeSupabaseUrl,
  SUPABASE_KEY,
  DEFAULT_TARGETS,
  MONITOR_REGION,
  STAGING,
  validateStagingConfig,
  getTargets,
};
