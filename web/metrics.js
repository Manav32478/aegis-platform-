// Aegis v2 — public health metrics endpoint used by the status page (and the
// router). Kept intentionally tiny and cache-friendly: no key required, shows
// only what a public visitor needs, heavy ETL stays in /api/aggregate.
const { getHealthChecks } = require('../packages/common/supabase');
const { analyzeCloud } = require('../packages/common/analytics');

async function latestChecks(limit = 300) {
  const rows = await getHealthChecks(limit);
  return rows.filter((r) => r.cloud_name !== 'test-probe');
}

async function publicMetrics() {
  const rows = await latestChecks(300).catch(() => []);
  const by = {};
  for (const r of rows) {
    by[r.cloud_name] = by[r.cloud_name] || [];
    by[r.cloud_name].push(r);
  }
  const clouds = {};
  for (const [name, list] of Object.entries(by)) {
    list.sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at));
    const a = analyzeCloud(list);
    clouds[name] = {
      up: a.last ? a.last.healthy : false,
      uptimePct: a.uptimePct,
      avgLatencyMs: a.avgLatencyMs,
      checks: a.checks,
      lastCheckedAt: a.last ? a.last.checked_at : null,
    };
  }
  return { clouds, checkedAt: new Date().toISOString(), source: 'supabase' };
}

module.exports = { publicMetrics, latestChecks };
