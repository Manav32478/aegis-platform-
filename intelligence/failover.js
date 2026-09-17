// Aegis v2 — failover scoring (Month 4.6, upgraded).
// Given the latest per-cloud analytics, decides WHICH cloud should serve
// traffic next. Deterministic + unit-testable: pick the healthiest; break ties
// with latency, then carbon intensity (green routing).

/**
 * rankClouds(analytics, carbon)
 *   analytics : { [cloudName]: { region, score, avgLatencyMs, uptimePct } }
 *   carbon    : { [cloudName]: { carbonIntensity } } (optional)
 * Returns an ordered array of candidate objects.
 */
function rankClouds(analytics, carbon = {}) {
  const entries = Object.entries(analytics)
    .filter(([, a]) => a && a.score != null)
    .map(([name, a]) => {
      const cz = carbon[name];
      return {
        name,
        score: a.score,
        uptimePct: a.uptimePct,
        avgLatencyMs: a.avgLatencyMs ?? Infinity,
        carbonIntensity: cz ? cz.carbonIntensity : Infinity,
        healthy: (a.uptimePct ?? 0) >= 90,
      };
    });

  entries.sort((x, y) => {
    if (x.score !== y.score) return y.score - x.score;                 // healthiest first
    if (x.avgLatencyMs !== y.avgLatencyMs) return x.avgLatencyMs - y.avgLatencyMs; // then fastest
    return x.carbonIntensity - y.carbonIntensity;                      // then greenest
  });

  return entries;
}

/**
 * decideRoute(analytics, carbon) → { route, reason, fallback }
 * Picks the best cloud to route traffic to, plus the runner-up for failover.
 */
function decideRoute(analytics, carbon = {}) {
  const ranked = rankClouds(analytics, carbon);
  const primary = ranked[0];
  const fallback = ranked[1] || null;
  if (!primary) return { route: null, reason: 'no healthy candidates', fallback: null };
  if (!primary.healthy) {
    return {
      route: null,
      reason: 'all clouds degraded — routing to error page',
      fallback,
    };
  }
  return {
    route: primary.name,
    reason: `highest health score (${primary.score}/100)`,
    fallback: fallback ? fallback.name : null,
  };
}

module.exports = { rankClouds, decideRoute };
