/**
 * Aegis health monitor — Month 3.1 / 3.2 / 3.5
 *
 * Polls every cloud's /health endpoint and writes the result to Supabase via its
 * REST API using plain fetch (no WebSocket dependency — works on Node 18/20/22
 * and in GitHub Actions). Prints JSON if no Supabase keys are set (local dev).
 *
 * Run:
 *   TARGETS='[...]' SUPABASE_URL=... SUPABASE_KEY=... node monitor.js
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const DEFAULT_TARGETS = JSON.stringify([
  { name: 'render', url: 'https://aegis-platform-pomf.onrender.com/health' },
  { name: 'vercel', url: 'https://aegis-platform-lyart.vercel.app/health' },
]);

const TARGETS = JSON.parse(process.env.TARGETS || DEFAULT_TARGETS);
const SELF_HEAL_AFTER = Number(process.env.SELF_HEAL_AFTER || 3);

/** Check one target. Returns {name, healthy, latency, timestamp}. */
async function checkTarget(t) {
  const start = Date.now();
  try {
    const res = await fetch(t.url, { signal: AbortSignal.timeout(5000) });
    const healthy = res.ok;
    return {
      name: t.name,
      healthy,
      latency: healthy ? Date.now() - start : null,
      timestamp: Date.now(),
    };
  } catch {
    return { name: t.name, healthy: false, latency: null, timestamp: Date.now() };
  }
}

/** Pure helper — aggregates raw checks (unit-tested in tests/monitor.test.js). */
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

async function saveResults(results) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log(JSON.stringify({ at: new Date().toISOString(), results }));
    return;
  }
  const rows = results.map((r) => ({
    cloud_name: r.name,
    healthy: r.healthy,
    latency: r.latency,
  }));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/health_checks`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error('supabase insert failed:', res.status, await res.text());
  } else {
    console.log(`saved ${rows.length} checks to Supabase`);
  }
}

/**
 * Self-healing — Month 3.5.
 * If a cloud failed N checks in a row, dispatch a redeploy of that cloud via the
 * GitHub API (workflow_dispatch). Reads history from Supabase REST.
 */
async function maybeSelfHeal(results) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) return;

  for (const r of results.filter((x) => !x.healthy)) {
    const q = `${SUPABASE_URL}/rest/v1/health_checks?select=healthy&cloud_name=eq.${encodeURIComponent(
      r.name
    )}&order=id.desc&limit=${SELF_HEAL_AFTER}`;
    const res = await fetch(q, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const data = await res.json();
    const allDown =
      Array.isArray(data) &&
      data.length === SELF_HEAL_AFTER &&
      data.every((row) => row.healthy === false);
    if (!allDown) continue;

    const gh = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/deploy.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );
    console.log(
      `self-heal: ${r.name} failed ${SELF_HEAL_AFTER}x in a row -> redeploy dispatched (HTTP ${gh.status})`
    );
  }
}

async function main() {
  const results = await Promise.all(TARGETS.map(checkTarget));
  await saveResults(results);
  await maybeSelfHeal(results);
}

if (require.main === module) main();

module.exports = { checkTarget, summarize };
