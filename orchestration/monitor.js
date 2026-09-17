// ============================================================================
// Aegis v2 — health monitor + self-healing + alerting (Month 3, upgraded).
//
// One Node process that:
//   1. probes every cloud's /health from a vantage point (region)
//   2. writes raw results to Supabase  → health_checks (with region + status)
//   3. aggregates history → uptime %, latency percentiles, health score
//   4. opens/closes incidents (downtime timeline)      → incidents
//   5. pushes alerts on down/recovered/degraded events  → alerts (+ webhook)
//   6. self-heals: redeploys a cloud that failed N times in a row
//
// Zero runtime dependencies (plain fetch). Configured entirely via env vars —
// see .env.example. Also imported by web/app for analytics (pure helpers).
// ============================================================================

const { getTargets, MONITOR_REGION } = require('../packages/common/config');
const { summarize, analyzeCloud } = require('../packages/common/analytics');
const { insert, insertReturning, sb, update, insertChecks } = require('../packages/common/supabase');

// ---- config ---------------------------------------------------------------
const SELF_HEAL_AFTER = Number(process.env.SELF_HEAL_AFTER || 3);
const CONCURRENCY = Number(process.env.CHECK_CONCURRENCY || 4);
const LATENCY_SLOW_MS = Number(process.env.LATENCY_SLOW_MS || 800); // > this = degraded

// ---- helpers --------------------------------------------------------------

async function withLimit(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** Probe one target. Returns {name, region, healthy, latency, httpStatus, timestamp}. */
async function checkTarget(t) {
  const start = Date.now();
  try {
    const res = await fetch(t.url, { signal: AbortSignal.timeout(5000) });
    const healthy = res.ok && res.status < 500;
    return {
      name: t.name,
      region: t.region || MONITOR_REGION,
      healthy,
      latency: res.ok ? Date.now() - start : null,
      httpStatus: res.status,
      timestamp: Date.now(),
    };
  } catch {
    return {
      name: t.name,
      region: t.region || MONITOR_REGION,
      healthy: false,
      latency: null,
      httpStatus: 0,
      timestamp: Date.now(),
    };
  }
}

/** Aggregate raw health_checks rows → per-cloud analytics (pure). */
function analyzeHistory(rows) {
  const byCloud = {};
  for (const r of rows) {
    byCloud[r.cloud_name] = byCloud[r.cloud_name] || [];
    byCloud[r.cloud_name].push(r);
  }
  const analytics = {};
  for (const [name, list] of Object.entries(byCloud)) {
    list.sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at));
    analytics[name] = analyzeCloud(list);
  }
  return analytics;
}

/** Detect a downtime/degradation event from the day's most recent state. */
function detectEvent(results) {
  const down = results.filter((r) => !r.healthy).map((r) => r.name);
  const degraded = results.filter(
    (r) => r.healthy && r.latency != null && r.latency > LATENCY_SLOW_MS
  ).map((r) => r.name);
  return { down, degraded };
}

/**
 * Maintain incidents in Supabase:
 *   - cloud is down + no open incident   → open one
 *   - cloud is up   + open incident      → close it (record duration)
 * Returns a list of {type:'open'|'close', ...} transitions.
 * Offline-safe: skips silently when tables/keys are absent.
 */
async function maintainIncidents({ down }) {
  const transitions = [];
  try {
    const openRows = await sb('/rest/v1/incidents?select=*&ended_at=is.null&order=id.asc');
    const open = Array.isArray(openRows) ? openRows : [];

    // close incidents for clouds that are now healthy
    for (const inc of open) {
      if (!down.includes(inc.cloud_name)) {
        const ended = new Date().toISOString();
        const started = new Date(inc.started_at).getTime();
        const duration = Math.max(0, Math.round((Date.now() - started) / 1000));
        await update('incidents', inc.id, { ended_at: ended, duration_seconds: duration });
        transitions.push({ type: 'close', cloud: inc.cloud_name, durationSeconds: duration });
      }
    }

    // open incidents for newly-down clouds
    const openNames = open.map((o) => o.cloud_name);
    for (const name of down) {
      if (!openNames.includes(name)) {
        await insertReturning('incidents', { cloud_name: name, kind: 'downtime' });
        transitions.push({ type: 'open', cloud: name });
      }
    }
  } catch {
    /* offline / not yet migrated — ignore */
  }
  return transitions;
}

/**
 * Deliver alerts on transitions (down / recovered / degraded).
 * Writes to the alerts table and optionally POSTs to a Slack webhook and a
 * generic webhook (monitoring platforms, ntfy, etc.).
 */
async function deliverAlerts({ down, degraded }, transitions, results) {
  const events = [];

  for (const t of transitions) {
    if (t.type === 'open') {
      events.push({ cloud: t.cloud, severity: 'critical', kind: 'down',
        message: `${t.cloud} is DOWN — probe failed` });
    } else {
      events.push({ cloud: t.cloud, severity: 'info', kind: 'recovered',
        message: `${t.cloud} recovered after ${t.durationSeconds}s of downtime` });
    }
  }
  for (const name of degraded) {
    const r = results.find((x) => x.name === name);
    events.push({ cloud: name, severity: 'warning', kind: 'degraded',
      message: `${name} latency high (${r && r.latency} ms > ${LATENCY_SLOW_MS} ms)` });
  }

  const rows = events.map((e) => ({
    cloud_name: e.cloud, severity: e.severity, kind: e.kind,
    message: e.message, channel: 'none', delivered: false,
  }));

  // persist to Supabase (if reachable)
  try { await insert('alerts', rows); } catch { /* ignore */ }

  // push out-of-band notifications (best effort)
  const delivered = [];
  await Promise.all(
    events.map(async (e) => {
      const payload = {
        text: `[Aegis] ${e.kind.toUpperCase()} — ${e.cloud}: ${e.message}`,
        severity: e.severity,
        at: new Date().toISOString(),
      };
      const out = [];
      if (process.env.SLACK_WEBHOOK_URL) {
        try {
          const res = await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: payload.text }),
          });
          if (res.ok) out.push('slack');
        } catch { /* ignore */ }
      }
      if (process.env.ALERT_WEBHOOK_URL) {
        try {
          const res = await fetch(process.env.ALERT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) out.push('webhook');
        } catch { /* ignore */ }
      }
      if (out.length) delivered.push({ cloud: e.cloud, channels: out });
    })
  );

  return { events, delivered };
}

/** Self-heal: if a cloud failed N checks in a row, dispatch a GitHub redeploy. */
async function maybeSelfHeal(results) {
  const repaired = [];
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) return repaired;

  for (const r of results.filter((x) => !x.healthy)) {
    const rows = await sb(
      `/rest/v1/health_checks?select=healthy&cloud_name=eq.${encodeURIComponent(r.name)}&order=id.desc&limit=${SELF_HEAL_AFTER}`
    ).catch(() => null);
    const allDown =
      Array.isArray(rows) &&
      rows.length === SELF_HEAL_AFTER &&
      rows.every((row) => row.healthy === false);
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
    console.log(`self-heal: ${r.name} failed ${SELF_HEAL_AFTER}x in a row → redeploy dispatched (HTTP ${gh.status})`);
    if (gh.status === 204) {
      try {
        await insertReturning('failover_events', {
          from_cloud: r.name, to_cloud: 'any-healthy', reason: `auto self-heal after ${SELF_HEAL_AFTER} consecutive failures`,
        });
      } catch { /* ignore */ }
      repaired.push(r.name);
    }
  }
  return repaired;
}

/** Save raw probe results to Supabase (region + http status included). */
async function saveResults(results) {
  const rows = results.map((r) => ({
    cloud_name: r.name,
    region: r.region,
    healthy: r.healthy,
    latency: r.latency,
    http_status: r.httpStatus,
  }));
  try {
    await insertChecks(rows);
    return `saved ${rows.length} checks`;
  } catch (e) {
    return `supabase save skipped (${e.message.slice(0, 80)})`;
  }
}

// ---- main -----------------------------------------------------------------

async function main() {
  const targets = getTargets();
  const results = [];
  await withLimit(targets, CONCURRENCY, async (t) => {
    results.push(await checkTarget(t));
  });

  console.log(`[monitor] region=${MONITOR_REGION} targets=${results.length}`);
  for (const r of results) {
    console.log(
      `  ${r.name.padEnd(18)} ${r.healthy ? 'UP ' : 'DOWN'} ${r.latency != null ? r.latency + ' ms' : '  -  '} http=${r.httpStatus}`
    );
  }

  const saveMsg = await saveResults(results);
  console.log(`[monitor] ${saveMsg}`);

  const { down, degraded } = detectEvent(results);
  const transitions = await maintainIncidents({ down });
  for (const t of transitions) {
    console.log(`[incident] ${t.type} ${t.cloud}${t.durationSeconds ? ` (${t.durationSeconds}s)` : ''}`);
  }

  const alerts = await deliverAlerts({ down, degraded }, transitions, results);
  for (const e of alerts.events) console.log(`[alert] ${e.severity} ${e.cloud}: ${e.message}`);

  const repaired = await maybeSelfHeal(results);
  if (repaired.length) console.log(`[self-heal] repaired: ${repaired.join(', ')}`);

  console.log(`[monitor] done. summary=${JSON.stringify(summarize(results))}`);
  return { results, transitions, alerts, repaired };
}

if (require.main === module) {
  main().catch((e) => {
    console.error('monitor failed:', e.message);
    process.exit(1);
  });
}

module.exports = {
  checkTarget,
  summarize,
  analyzeHistory,
  detectEvent,
  maintainIncidents,
  deliverAlerts,
  maybeSelfHeal,
  main,
};
