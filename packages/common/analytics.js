// Aegis v2 — analytics: uptime, percentiles, health scores, SLA, trends.
// Pure functions (no network) so they are trivially unit-testable and reused
// by the monitor, API, web portal and the embeddable badge renderer.

/** Aggregates raw check results (used by monitor + tests). */
function summarize(results) {
  const per = {};
  for (const r of results) {
    per[r.name] = per[r.name] || { checks: 0, healthy: 0, totalLatency: 0 };
    per[r.name].checks += 1;
    if (r.healthy) {
      per[r.name].healthy += 1;
      per[r.name].totalLatency += r.latency || 0;
    }
  }
  return Object.entries(per).map(([name, s]) => ({
    name,
    uptimePct: Math.round((s.healthy / s.checks) * 100),
    avgLatencyMs: s.healthy ? Math.round(s.totalLatency / s.healthy) : null,
  }));
}

/** Percentiles from an array of latency numbers (p50, p90, p95, p99). */
function percentiles(values) {
  if (!values || values.length === 0) {
    return { p50: null, p90: null, p95: null, p99: null, count: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p) => sorted[Math.max(0, Math.min(sorted.length, Math.ceil((p / 100) * sorted.length)) - 1)];
  return {
    p50: q(50),
    p90: q(90),
    p95: q(95),
    p99: q(99),
    count: sorted.length,
  };
}

/**
 * Composite health score 0–100 per cloud.
 *   uptime (0-100)              weight 0.5
 *   latency score (0-100)       weight 0.3  (fast = 100, slow = 0)
 *   error rate inverse          weight 0.2
 */
function healthScore({ uptimePct, avgLatencyMs, errorRate }) {
  const latencyScore =
    avgLatencyMs == null
      ? 100
      : Math.max(0, Math.min(100, 100 - avgLatencyMs / 10)); // 0 ms→100, 1000 ms→0
  const errorScore = Math.max(0, Math.min(100, 100 - errorRate * 100));
  const score = Math.round(uptimePct * 0.5 + latencyScore * 0.3 + errorScore * 0.2);
  let grade = 'Critical';
  if (score >= 90) grade = 'Excellent';
  else if (score >= 70) grade = 'Good';
  else if (score >= 50) grade = 'At risk';
  return { score, grade };
}

/** Full per-cloud analysis from a chronologically-ordered array of check rows. */
function analyzeCloud(rows) {
  if (!rows || rows.length === 0) {
    return { checks: 0, healthy: 0, uptimePct: null, avgLatencyMs: null, errorRate: null, percentiles: { p50: null, p90: null, p95: null, p99: null, count: 0 }, score: null, grade: 'No data', last: null };
  }
  const healthy = rows.filter((r) => r.healthy).length;
  const latencies = rows.filter((r) => r.healthy && r.latency != null).map((r) => r.latency);
  const uptimePct = Math.round((healthy / rows.length) * 100);
  const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const errorRate = Number((1 - healthy / rows.length).toFixed(4));
  const score = healthScore({ uptimePct, avgLatencyMs, errorRate });
  return {
    checks: rows.length,
    healthy,
    uptimePct,
    avgLatencyMs,
    errorRate,
    percentiles: percentiles(latencies),
    score: score.score,
    grade: score.grade,
    last: rows[rows.length - 1],
  };
}

/**
 * SLA compliance vs a target uptime (default 99.9%).
 * Returns { target, actual, delta, status } where status ∈ Met|Near|At risk.
 */
function slaStatus(uptimePct, target = 99.9) {
  const actual = uptimePct == null ? 0 : uptimePct;
  const delta = Math.round((actual - target) * 100) / 100;
  if (actual >= target) return { target, actual, delta, status: 'Met' };
  if (actual >= target - 0.5) return { target, actual, delta, status: 'Near' };
  return { target, actual, delta, status: 'At risk' };
}

/**
 * Short-term latency trend: mean latency of the last `windowMs` vs the
 * `windowMs` before that. Positive delta = latency rising (bad).
 */
function trendLatency(ascRows, windowMs = 3600000) {
  const now = Date.now();
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const inWin = [];
  const prev = [];
  for (const r of ascRows) {
    if (!r.healthy || r.latency == null) continue;
    const t = new Date(r.checked_at).getTime();
    if (t >= now - windowMs) inWin.push(r.latency);
    else if (t >= now - 2 * windowMs) prev.push(r.latency);
  }
  const current = avg(inWin);
  const previous = avg(prev);
  if (current == null || previous == null) return { current, previous, deltaMs: null, dir: 'flat' };
  const deltaMs = current - previous;
  const dir = deltaMs > 10 ? 'up' : deltaMs < -10 ? 'down' : 'flat';
  return { current, previous, deltaMs, dir };
}

/** Compress a cloud's history into a compact {t,y} series (for charts/sparklines). */
function seriesOf(ascRows, maxPoints = 150) {
  const pts = ascRows.slice(-maxPoints);
  return {
    t: pts.map((r) => r.checked_at),
    y: pts.map((r) => (r.healthy ? r.latency : null)),
  };
}

module.exports = {
  summarize,
  percentiles,
  healthScore,
  analyzeCloud,
  slaStatus,
  trendLatency,
  seriesOf,
};
