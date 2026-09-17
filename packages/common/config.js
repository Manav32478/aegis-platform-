// Aegis v2 — shared configuration.
// Every microservice (monitor, api, web) requires this so there is ONE source
// of truth for targets, regions and defaults.

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://kagjbxxmdyaypfcqemem.supabase.co';

// Publishable (anon) key — safe to ship in client code by design.
const SUPABASE_KEY = process.env.SUPABASE_KEY ||
  'sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti';

// Default targets. `enabled:false` means "planned / not yet deployed" — the
// monitor skips them until the user deploys to GCP / Oracle and flips them on
// (via env TARGETS, or the admin page).
const DEFAULT_TARGETS = [
  { name: 'render',           url: 'https://aegis-platform-pomf.onrender.com/health', region: 'oregon',      enabled: true  },
  { name: 'vercel',           url: 'https://aegis-platform-lyart.vercel.app/health',  region: 'global edge', enabled: true  },
  { name: 'google-cloud-run', url: 'https://aegis-app-gcp.a.run.app/health',          region: 'us-central1', enabled: false },
  { name: 'oracle-cloud',     url: 'http://YOUR_ORACLE_VM_IP/health',                 region: 'ap-mumbai-1', enabled: false },
];

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
  SUPABASE_KEY,
  DEFAULT_TARGETS,
  MONITOR_REGION,
  getTargets,
};
