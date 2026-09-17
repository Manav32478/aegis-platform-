// ============================================================================
// Aegis v2 — report generator (Month 6, upgraded).
//
// Generates a daily or weekly health report from Supabase history and stores it
// in health_reports (payload jsonb) so the web app + API can show it. Can also
// email it via Resend (free tier) or POST it to a webhook (Slack/Teams).
//
// Run manually:      node orchestration/report.js
// On a schedule:     GitHub Actions cron  +  Cloudflare Worker cron
// ============================================================================

const { sb, insertReturning, getHealthChecks } = require('../packages/common/supabase');
const { analyzeHistory } = require('./monitor');

const PERIOD = process.env.REPORT_PERIOD || 'daily'; // daily | weekly
const LOOKBACK_HOURS = PERIOD === 'weekly' ? 24 * 7 : 24;

function periodRange() {
  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_HOURS * 3600 * 1000);
  return { start, end };
}

async function buildReport() {
  const { start, end } = periodRange();
  const allRows = await getHealthChecks(5000);
  const rows = allRows
    .filter((r) => r.cloud_name !== 'test-probe')
    .filter((r) => new Date(r.checked_at) >= new Date(start) && new Date(r.checked_at) <= new Date(end));
  const analytics = analyzeHistory(rows);
  const incidents = await sb(
    `/rest/v1/incidents?select=*&started_at=gte.${start.toISOString()}&order=id.desc&limit=100`
  ).catch(() => []);
  const alerts = await sb(
    `/rest/v1/alerts?select=*&created_at=gte.${start.toISOString()}&order=id.desc&limit=100`
  ).catch(() => []);

  const top = Object.entries(analytics)
    .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0))
    .map(([name, a]) => ({
      cloud: name,
      healthScore: a.score,
      grade: a.grade,
      uptimePct: a.uptimePct,
      avgLatencyMs: a.avgLatencyMs,
      checks: a.checks,
    }));

  const report = {
    period: PERIOD,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    generatedAt: new Date().toISOString(),
    totalChecks: rows.length,
    clouds: top,
    incidentCount: incidents.length,
    alertCount: alerts.length,
    headline:
      top.length === 0
        ? 'No checks recorded in this window.'
        : top[0].uptimePct === 100
          ? `All monitored clouds stayed up (best: ${top[0].cloud}).`
          : `${top[0].cloud} led with ${top[0].uptimePct}% uptime.`,
  };

  const saved = await insertReturning('health_reports', {
    period: PERIOD,
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
    payload: report,
  }).catch(() => null);

  return { report, savedId: saved && saved[0] && saved[0].id };
}

async function dispatch(report) {
  const body = JSON.stringify({ report }, null, 2);
  if (process.env.RESEND_API_KEY && process.env.REPORT_TO_EMAIL) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Aegis Reports <reports@aegis.local>',
          to: [process.env.REPORT_TO_EMAIL],
          subject: `[Aegis] ${PERIOD} health report — ${report.headline}`,
          text: body,
        }),
      });
      if (res.ok) console.log('[report] emailed via Resend');
      else console.log('[report] email failed:', res.status);
    } catch (e) {
      console.log('[report] email error:', e.message);
    }
  }
  if (process.env.REPORT_WEBHOOK_URL) {
    try {
      await fetch(process.env.REPORT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      console.log('[report] pushed to webhook');
    } catch (e) {
      console.log('[report] webhook error:', e.message);
    }
  }
}

async function main() {
  console.log(`[report] building ${PERIOD} report…`);
  const { report, savedId } = await buildReport();
  console.log(`[report] ${report.headline}`);
  console.log(`[report] ${report.totalChecks} checks · ${report.clouds.length} clouds`);
  if (savedId) console.log(`[report] saved as id=${savedId}`);
  await dispatch(report);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('report failed:', e.message);
    process.exit(1);
  });
}

module.exports = { buildReport, dispatch, periodRange };
