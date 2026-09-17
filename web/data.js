// ============================================================================
// Aegis v2 — live data provider.
//
// provideSnapshot() builds the full platform snapshot used by:
//   - the realtime broadcaster (SSE push to every dashboard)
//   - the /badge/:cloud.svg renderer
//   - the /api/export downloader
//
// It merges:
//   1. LIVE on-demand probes of every vector cloud (Render/Vercel now, plus
//      GCP/Oracle the moment they're enabled) — this makes the dashboard a
//      real-time screen, not just a history viewer
//   2. Supabase history → uptime %, percentiles, health scores, SLA, trends
//   3. intelligence → routing decision, carbon, cost forecast
// ============================================================================

const { analyzeHistory } = require('../orchestration/monitor');
const { getHealthChecks, sb } = require('../packages/common/supabase');
const { getTargets, DEFAULT_TARGETS, MONITOR_REGION } = require('../packages/common/config');
const { detectAnomalies } = require('../intelligence/anomaly');
const { estimateAegisSavings, forecastAnnual, FREE_TIER_LIMITS } = require('../intelligence/cost');
const { rankRegions } = require('../intelligence/carbon');
const { decideRoute } = require('../intelligence/failover');
const { slaStatus, trendLatency, seriesOf } = require('../packages/common/analytics');

// ---- live probe of one vector cloud ---------------------------------------
async function probe(t) {
  const start = Date.now();
  try {
    const res = await fetch(t.url + '/health', { signal: AbortSignal.timeout(4000) });
    const healthy = res.ok && res.status < 500;
    return { name: t.name, healthy, latency: healthy ? Date.now() - start : null, status: res.status, url: t.url, enabled: t.enabled };
  } catch {
    return {
      name: t.name,
      healthy: false,
      latency: null,
      status: 0,
      url: t.url,
      enabled: t.enabled,
      reason: t.enabled === false ? 'not deployed (disabled)' : 'probe failed',
    };
  }
}

async function probeAll() {
  // favour the DB-configured targets, fall back to defaults
  let targets = [];
  try {
    const rows = await sb('/rest/v1/monitor_targets?select=*&order=id.asc');
    targets = Array.isArray(rows) && rows.length ? rows : null;
  } catch {
    targets = null;
  }
  if (!targets) targets = getTargets();
  return Promise.all(targets.map((t) => probe({ name: t.cloud_name, url: t.url, enabled: t.enabled !== false })));
}

async function provideSnapshot() {
  const rows = await getHealthChecks(2000).catch(() => []);
  const filtered = rows.filter((r) => r.cloud_name !== 'test-probe');
  const analytics = analyzeHistory(filtered);

  // per-cloud extras: anomaly, SLA, trend, sparkline series
  const riskMap = {};
  const series = {};
  for (const [name, a] of Object.entries(analytics)) {
    const asc = filtered.filter((r) => r.cloud_name === name).sort(
      (x, y) => new Date(x.checked_at) - new Date(y.checked_at)
    );
    const lats = asc.map((r) => r.latency);
    riskMap[name] = detectAnomalies(lats);
    a.sla = slaStatus(a.uptimePct);
    a.trend = trendLatency(asc);
    if (a.sla) analytics[name] = { ...a, sla: a.sla, trend: a.trend };
    series[name] = seriesOf(asc, 200);
  }

  // live vector probes — the "real-time" heartbeat
  const probes = await probeAll();

  const [incidents, alerts, riskFlags, failover, reports] = await Promise.all([
    sb('/rest/v1/incidents?select=*&order=id.desc&limit=50').catch(() => []),
    sb('/rest/v1/alerts?select=*&order=id.desc&limit=50').catch(() => []),
    sb('/rest/v1/risk_flags?select=*&order=id.desc&limit=50').catch(() => []),
    sb('/rest/v1/failover_events?select=*&order=id.desc&limit=50').catch(() => []),
    sb('/rest/v1/health_reports?select=*&order=id.desc&limit=10').catch(() => []),
  ]);

  // open incidents (currently down) — the live state
  const openIncidents = await sb('/rest/v1/incidents?select=*&ended_at=is.null&order=id.asc').catch(() => []);

  const carbon = await rankRegions([
    { name: 'oregon', zone: 'us-west1' },
    { name: 'global edge', zone: 'global' },
    { name: 'us-central1', zone: 'us-central1' },
    { name: 'ap-mumbai-1', zone: 'ap-mumbai-1' },
    { name: 'eu-central-1', zone: 'eu-central-1' },
  ]).catch(() => []);

  const carbonByName = {};
  const regionNames = {
    render: 'oregon',
    vercel: 'global edge',
    'google-cloud-run': 'us-central1',
    'oracle-cloud': 'ap-mumbai-1',
  };
  for (const c of carbon) {
    for (const [cloud, reg] of Object.entries(regionNames)) if (reg === c.region) carbonByName[cloud] = c;
  }

  const route = decideRoute(analytics, carbonByName);
  const cost = estimateAegisSavings(1000000);

  return {
    generatedAt: new Date().toISOString(),
    vantage: MONITOR_REGION,
    analytics,
    riskMap,
    series,
    probes,
    incidents,
    openIncidents,
    alerts,
    riskFlags,
    failover,
    reports,
    carbon,
    route,
    cost,
    forecast: forecastAnnual(1000000, 10, 12),
    freeTierLimits: FREE_TIER_LIMITS,
    totalChecks: filtered.length,
    slaTarget: 99.9,
  };
}

module.exports = { provideSnapshot, probeAll };
