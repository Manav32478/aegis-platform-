// ============================================================================
// Aegis v2 — live data provider.
//
// Combines stored Supabase history, live origin probes, router evidence and
// computed intelligence. Diagnostics are returned with every snapshot so a
// misconfigured Supabase key or stale origin is visible instead of silently
// rendering an empty dashboard.
// ============================================================================

const { analyzeHistory } = require('../orchestration/monitor');
const { getHealthChecks, sb } = require('../packages/common/supabase');
const { getTargets, MONITOR_REGION } = require('../packages/common/config');
const { detectAnomalies, analyzeSeries } = require('../intelligence/anomaly');
const { estimateAegisSavings, estimateCloudRunOverage, forecastAnnual, FREE_TIER_LIMITS } = require('../intelligence/cost');
const { rankRegions } = require('../intelligence/carbon');
const { decideRoute } = require('../intelligence/failover');
const { slaStatus, trendLatency, seriesOf } = require('../packages/common/analytics');

function healthUrl(url) {
  if (!url) return '';
  const clean = url.replace(/\/+$/, '');
  return /\/health$/i.test(clean) ? clean : clean + '/health';
}

function safeError(error) {
  const text = String(error && error.message ? error.message : error);
  return text
    .replace(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, '[key redacted]')
    .slice(0, 180);
}

/** Accept both Supabase rows (`cloud_name`) and built-in config (`name`). */
function normalizeTarget(t) {
  return {
    name: t.cloud_name || t.name || 'unnamed-target',
    url: t.url || '',
    region: t.region || 'unknown',
    enabled: t.enabled !== false,
  };
}

/**
 * Database-managed targets are preferred. If the request fails or the table is
 * empty, defaults are used; both shapes ({cloud_name} and {name}) are accepted.
 */
async function resolveTargets() {
  try {
    const rows = await sb('/rest/v1/monitor_targets?select=*&order=id.asc');
    if (Array.isArray(rows) && rows.length) {
      const targets = rows.map(normalizeTarget);
      return { targets, source: 'supabase.monitor_targets', warning: null };
    }
    return {
      targets: getTargets().map(normalizeTarget),
      source: 'defaults',
      warning: 'monitor_targets returned no rows; using built-in targets',
    };
  } catch (e) {
    return {
      targets: getTargets().map(normalizeTarget),
      source: 'defaults',
      warning: 'Could not read Supabase monitor_targets: ' + safeError(e),
    };
  }
}

async function probe(t) {
  const target = healthUrl(t.url);
  if (t.enabled === false) {
    return { name: t.name || 'unnamed-target', healthy: false, latency: null, status: null,
      url: target, enabled: false, reason: 'not deployed (disabled)' };
  }
  const start = Date.now();
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(6000) });
    const healthy = res.ok && res.status < 500;
    let info = {};
    if (healthy) {
      try { info = await res.json(); } catch { /* health response can be non-JSON */ }
    }
    return {
      name: t.name || 'unnamed-target', healthy,
      latency: healthy ? Date.now() - start : null,
      status: res.status, url: target, enabled: true,
      requests: info.requests, uptimeSeconds: info.uptimeSeconds, cloud: info.cloud,
      reason: healthy ? null : `health endpoint returned HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      name: t.name || 'unnamed-target', healthy: false, latency: null, status: 0,
      url: target, enabled: true, requests: null, uptimeSeconds: null,
      reason: safeError(e),
    };
  }
}

async function probeAll(targetConfig) {
  const config = targetConfig || await resolveTargets();
  return Promise.all(config.targets.map((t) => probe(normalizeTarget(t))));
}

async function provideSnapshot() {
  const warnings = [];
  let rows = [];
  try {
    rows = await getHealthChecks(2000);
  } catch (e) {
    warnings.push('Supabase health history could not be read: ' + safeError(e));
  }

  const filtered = rows.filter((r) => r.cloud_name !== 'test-probe');
  if (!filtered.length && warnings.length === 0) {
    warnings.push('Supabase is reachable, but health_checks returned no rows yet. Run the monitor or check RLS read policies.');
  }
  const analytics = analyzeHistory(filtered);

  const riskMap = {};
  const mlScores = {};
  const series = {};
  for (const [name, a] of Object.entries(analytics)) {
    const asc = filtered.filter((r) => r.cloud_name === name).sort(
      (x, y) => new Date(x.checked_at) - new Date(y.checked_at)
    );
    const latencies = asc.map((r) => r.latency);
    riskMap[name] = detectAnomalies(latencies);
    mlScores[name] = analyzeSeries(latencies);
    a.sla = slaStatus(a.uptimePct);
    a.trend = trendLatency(asc);
    analytics[name] = { ...a, sla: a.sla, trend: a.trend };
    series[name] = seriesOf(asc, 200);
  }

  const targetConfig = await resolveTargets();
  if (targetConfig.warning) warnings.push(targetConfig.warning);
  const probes = await probeAll(targetConfig);
  for (const p of probes) {
    if (p.enabled !== false && !p.healthy) {
      warnings.push(`${p.name} probe failed (${p.status || 'network error'}) at ${p.url}`);
    }
  }

  let router = null;
  try {
    const res = await fetch('https://aegis-router.manav32478.workers.dev/health', {
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const j = await res.json();
      router = {
        serving: j.cloud || 'unknown', uptimeSeconds: j.uptimeSeconds,
        requests: j.requests, timestamp: j.timestamp,
        checkedAt: new Date().toISOString(),
      };
    } else {
      warnings.push(`Cloudflare router health check returned HTTP ${res.status}`);
    }
  } catch (e) {
    router = null;
    warnings.push('Cloudflare router could not be reached: ' + safeError(e));
  }

  const openIncidents = await sb('/rest/v1/incidents?select=*&ended_at=is.null&order=id.asc').catch(() => []);
  const proxy = {
    currentCloud: router ? router.serving : null,
    routerAlive: !!router,
    failoverActive: Array.isArray(openIncidents) && openIncidents.length > 0,
    failedClouds: Array.isArray(openIncidents) ? openIncidents.map((i) => i.cloud_name) : [],
  };

  const [incidents, alerts, riskFlags, failover, reports] = await Promise.all([
    sb('/rest/v1/incidents?select=*&order=id.desc&limit=50').catch(() => []),
    sb('/rest/v1/alerts?select=*&order=id.desc&limit=50').catch(() => []),
    sb('/rest/v1/risk_flags?select=*&order=id.desc&limit=50').catch(() => []),
    sb('/rest/v1/failover_events?select=*&order=id.desc&limit=50').catch(() => []),
    sb('/rest/v1/health_reports?select=*&order=id.desc&limit=10').catch(() => []),
  ]);

  let monthlyRequests = 1000000;
  const liveCounters = probes
    .filter((p) => p.requests != null && p.uptimeSeconds > 60)
    .map((p) => ({ cloud: p.name, requests: p.requests, perHour: (p.requests / p.uptimeSeconds) * 3600 }));
  if (liveCounters.length) {
    const totalPerHour = liveCounters.reduce((sum, x) => sum + x.perHour, 0);
    monthlyRequests = Math.round(totalPerHour * 24 * 30);
  }
  const cost = estimateAegisSavings(monthlyRequests);
  const cloudRun = estimateCloudRunOverage(monthlyRequests);

  const carbon = await rankRegions([
    { name: 'oregon', zone: 'us-west1' },
    { name: 'global edge', zone: 'global' },
    { name: 'us-central1', zone: 'us-central1' },
    { name: 'ap-mumbai-1', zone: 'ap-mumbai-1' },
    { name: 'eu-central-1', zone: 'eu-central-1' },
  ]).catch(() => []);

  const carbonByName = {};
  const regionNames = { render: 'oregon', vercel: 'global edge', 'google-cloud-run': 'us-central1', 'oracle-cloud': 'ap-mumbai-1' };
  for (const c of carbon) {
    for (const [cloud, region] of Object.entries(regionNames)) if (region === c.region) carbonByName[cloud] = c;
  }

  return {
    generatedAt: new Date().toISOString(),
    vantage: MONITOR_REGION,
    diagnostics: {
      historyRows: filtered.length,
      targetSource: targetConfig.source,
      targetCount: targetConfig.targets.length,
      warnings,
    },
    analytics, riskMap, mlScores, series, probes, router, proxy,
    incidents, openIncidents, alerts, riskFlags, failover, reports, carbon,
    route: decideRoute(analytics, carbonByName), cost, liveCounters,
    monthlyRequests, cloudRunOverage: cloudRun,
    forecast: forecastAnnual(monthlyRequests, 10, 12),
    freeTierLimits: FREE_TIER_LIMITS,
    totalChecks: filtered.length,
    slaTarget: 99.9,
  };
}

module.exports = { provideSnapshot, probeAll, resolveTargets, healthUrl, normalizeTarget };
