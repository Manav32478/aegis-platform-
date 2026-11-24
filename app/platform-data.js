'use strict';

const DEFAULT_TARGETS = [
  { name: 'render', url: 'https://aegis-platform-pomf.onrender.com', region: 'Oregon', enabled: true },
  { name: 'vercel', url: 'https://aegis-platform-11f7.vercel.app', region: 'Global edge', enabled: true },
  { name: 'google-cloud-run', url: 'https://aegis-app-gcp.a.run.app', region: 'us-central1', enabled: false },
  { name: 'oracle-cloud', url: '', region: 'ap-mumbai-1', enabled: false },
];

const CACHE_MS = Math.max(5000, Number(process.env.AEGIS_PROBE_CACHE_MS || 15000));
let cache = null;
let cacheUntil = 0;

function healthUrl(value) {
  const base = String(value || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  return /\/health$/i.test(base) ? base : base + '/health';
}

function normalizeTarget(target) {
  return {
    name: String(target.cloud_name || target.name || 'unnamed-target'),
    url: String(target.url || ''),
    region: String(target.region || 'Not specified'),
    enabled: target.enabled !== false,
  };
}

function getTargets(env = process.env) {
  const raw = env.AEGIS_TARGETS || env.TARGETS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizeTarget);
    } catch (_) {
      // Invalid optional target configuration falls back to safe defaults.
    }
  }
  return DEFAULT_TARGETS.map(normalizeTarget);
}

async function probeTarget(target, fetchImpl = global.fetch) {
  const normalized = normalizeTarget(target);
  const endpoint = healthUrl(normalized.url);
  if (!normalized.enabled || !endpoint) {
    return {
      ...normalized,
      url: endpoint,
      healthy: false,
      state: 'planned',
      latency: null,
      latencyMs: null,
      status: null,
      httpStatus: null,
      checkedAt: null,
      reason: 'Target is disabled or has no deployed URL.',
    };
  }

  const started = Date.now();
  try {
    const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(3500), headers: { Accept: 'application/json' } });
    const latency = Date.now() - started;
    let body = {};
    try { body = await response.json(); } catch (_) { body = {}; }
    const healthy = response.ok && response.status < 500;
    const state = !healthy ? 'down' : latency > 800 ? 'degraded' : 'operational';
    return {
      ...normalized,
      url: endpoint,
      healthy,
      state,
      latency,
      latencyMs: latency,
      status: response.status,
      httpStatus: response.status,
      cloud: body.cloud || normalized.name,
      uptimeSeconds: Number.isFinite(body.uptimeSeconds) ? body.uptimeSeconds : null,
      checkedAt: new Date().toISOString(),
      reason: healthy ? null : 'Health endpoint returned an unsuccessful status.',
    };
  } catch (_) {
    return {
      ...normalized,
      url: endpoint,
      healthy: false,
      state: 'down',
      latency: null,
      latencyMs: null,
      status: 0,
      httpStatus: 0,
      checkedAt: new Date().toISOString(),
      reason: 'Health endpoint could not be reached within the probe timeout.',
    };
  }
}

async function getRouterStatus(fetchImpl = global.fetch) {
  const base = String(process.env.AEGIS_ROUTER_URL || 'https://aegis-router.manav32478.workers.dev').replace(/\/+$/, '');
  try {
    const response = await fetchImpl(base + '/router/health', { signal: AbortSignal.timeout(3500), headers: { Accept: 'application/json' } });
    if (!response.ok) return { available: false, status: response.status, checkedAt: new Date().toISOString(), targets: [] };
    const body = await response.json();
    return { ...body, available: true, status: response.status, checkedAt: new Date().toISOString() };
  } catch (_) {
    return { available: false, status: 0, checkedAt: new Date().toISOString(), targets: [] };
  }
}

async function getPlatformSummary({ fetchImpl = global.fetch, force = false } = {}) {
  if (!force && cache && Date.now() < cacheUntil) return cache;
  const targets = getTargets();
  const [origins, routerStatus] = await Promise.all([
    Promise.all(targets.map(target => probeTarget(target, fetchImpl))),
    getRouterStatus(fetchImpl),
  ]);
  const checkedAt = new Date().toISOString();
  cache = {
    checkedAt,
    origins,
    routerStatus,
    incidents: [],
    openIncidents: [],
    historyRows: 0,
    historyAvailable: false,
    portalUrl: process.env.AEGIS_PORTAL_URL || 'https://aegis-platform-iota.vercel.app',
    diagnostics: {
      source: 'direct-origin-probes',
      historyRows: 0,
      warnings: ['This application origin provides live probes only. Connect the control-plane portal for stored history and incident records.'],
    },
  };
  cacheUntil = Date.now() + CACHE_MS;
  return cache;
}

function clearCache() {
  cache = null;
  cacheUntil = 0;
}

module.exports = { DEFAULT_TARGETS, healthUrl, normalizeTarget, getTargets, probeTarget, getRouterStatus, getPlatformSummary, clearCache };
