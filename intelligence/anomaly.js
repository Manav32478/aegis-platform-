// Aegis v2 — anomaly detection (Month 4.4, upgraded).
// Pure-JS rolling-statistics detector: flags a cloud whose latest latency sits
// far beyond its own recent baseline. Robust z-score (median + MAD) with a
// std-dev fallback and a relative floor, so it also works on perfectly-flat
// synthetic data. Mirrors the Python Isolation Forest that runs in CI, but this
// runs in the monitor process AND in the browser with zero dependencies.

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function average(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values) {
  if (values.length < 2) return 0;
  const m = average(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) * (b - m), 0) / values.length);
}

/** Robust spread of a sample: 1.4826 × MAD, falling back to stddev then a floor. */
function spreadOf(sample) {
  const med = median(sample);
  if (sample.length === 0) return 1;
  const mad = median(sample.map((x) => Math.abs(x - med)));
  if (mad > 0) return 1.4826 * mad;
  const sd = stddev(sample);
  if (sd > 0) return sd;
  // all identical (or single value): give spread a relative floor
  return Math.max(1, Math.abs(med) * 0.05);
}

/**
 * detectAnomalies(series, {window, tail, threshold}) → boolean
 * Baseline = median of the last `window` values BEFORE the most recent `tail`.
 * Anomalous if any tail value deviates from baseline by > threshold×spread.
 */
function detectAnomalies(series, { window = 10, tail = 3, threshold = 3.5 } = {}) {
  const values = series.filter((v) => v != null && !Number.isNaN(v));
  if (values.length < window + tail) return false;
  const tailVals = values.slice(-tail);
  const baseline = values.slice(0, -tail).slice(-window);
  const base = median(baseline);
  const spread = spreadOf(baseline);
  return tailVals.some((x) => Math.abs(x - base) / spread > threshold);
}

/**
 * analyzeSeries(series) → { atRisk, zScore, baseline, spread, latest, reason }
 * For UI display.
 */
function analyzeSeries(series, { window = 10, tail = 3, threshold = 3.5 } = {}) {
  const values = series.filter((v) => v != null && !Number.isNaN(v));
  if (values.length < window + tail) {
    return {
      atRisk: false,
      reason: `need ≥${window + tail} checks (have ${values.length})`,
      baseline: null,
      spread: null,
      latest: null,
      zScore: null,
    };
  }
  const tailVals = values.slice(-tail);
  const baseline = values.slice(0, -tail).slice(-window);
  const base = Math.round(median(baseline));
  const spread = Math.round(spreadOf(baseline) * 100) / 100;
  const latest = tailVals[tailVals.length - 1];
  const z = ((latest - base) / spread);
  return {
    atRisk: Math.abs(z) > threshold,
    zScore: Math.round(z * 100) / 100,
    baseline: base,
    spread,
    latest,
    reason: null,
  };
}

module.exports = { median, detectAnomalies, analyzeSeries, spreadOf };
