# Aegis — Project Status (v2.1)

> Updated 2026-09-17 · This file is a single-page "where are we?" for evaluations.

## Live right now ✅

| Component | Technology | URL / where |
|---|---|---|
| Cloud #1 (protected app) | Node + Express on Render (free) | https://aegis-platform-pomf.onrender.com |
| Cloud #2 (protected app) | Node + Express on Vercel (Hobby) | https://aegis-platform-lyart.vercel.app |
| Failover router + edge monitor | Cloudflare Worker (cron */5) | https://aegis-router.manav32478.workers.dev |
| Database | Supabase Postgres (free) | 10 tables, incl. incidents/alerts/audit |
| Second monitor | GitHub Actions cron */5 | repo → Actions → "Health monitor" |
| ML risk prediction | Python Isolation Forest (daily CI) | repo → Actions → "Predictive risk (ML)" |
| CI/CD | GitHub Actions (test → scan → deploy) | .github/workflows |

## v2.1 — the real-time upgrade

- **Server-Sent Events** (`/api/stream`): the dashboard updates itself every
  10 s as the monitor/prober runs — no refresh, no client polling.
- **Live on-demand probes**: the platform itself hits every cloud's `/health`
  every 10 s and shows the result + latency in a pulse panel.
- **Live event feed**: a terminal-style log of probes, routing decisions and
  incident changes.
- **SLA tracking**: each cloud's uptime vs a 99.9% target with Met/Near/At-risk.
- **Latency trend**: 24h delta per cloud (rising ▲ / falling ▼).
- **Sparklines**: per-cloud latency history drawn in the cards.
- **Embeddable uptime badges**: `/badge/{cloud}.svg` for the GitHub README.
- **CSV/JSON export**: `/api/export.csv`, `/api/export.json`.
- **Dark/light theme toggle** on every page.
- Test suite grew to **30 tests / 7 suites**.

## Live routing decision (verified 2026-09-17)

`vercel` (health score 93, 100% uptime) → `render` (score 85, ~98% uptime).
The anomaly detector has flagged Render's cold-start latency spikes in
history — stable clouds are scored Excellent, degrading ones drop to Good/At-risk.

## New in v2 (what this "professional rebuild" added)

- **Control-plane portal** in `web/`: landing page + live dashboard + public
  status page + admin console (targets, keys, audit, reports).
- **Health scoring** per cloud (0–100 composite of uptime + latency + error rate)
  with percentiles p50/p90/p95/p99.
- **Incidents** (open/close with downtime duration) + **alerting** (Slack /
  webhook / email).
- **Report generator** with daily/weekly snapshots stored in Supabase.
- **API v2**: rate limiting per key, audit log, cost forecast endpoint, Swagger.
- **Anomaly detection** running live in the monitor (rolling-statistics) in
  addition to the CI Isolation Forest.
- **Deployment playbooks**: `docs/DEPLOYMENT.md`, `docs/ORACLE_VM_SETUP.md`.
- **Docker Compose** — whole platform in one command.
- **26 unit tests** (was 6).

## Verified during the rebuild

- Portal `/api/aggregate` returns real Supabase data: ~850 checks, 2 clouds.
- Live routing decision: `vercel` (score 93) over `render` (score 85).
- Live anomaly flag: render's cold-start latency spikes detected.
- API auth: 401 without key, 200 with key; forecast endpoint returns 12-mo rows.
- 26/26 tests passing.

## Not yet done (honest — say this in the viva)

1. **Apply `infra/schema.sql` v2** in the Supabase SQL Editor (adds the new
   tables + `region`/`http_status` columns + delete policy). The platform
   already works without it via graceful fallbacks, but v2 columns unlock the
   full multi-region + incidents + alerts story.
2. **Cloud #3** (Cloud Run or Oracle VM) — guides ready, not yet deployed.
3. **Alert delivery** — wired in code; add a Slack webhook / Resend key in
   secrets to see real outbound alerts.
4. **Production hardening** — move writes behind a Supabase Edge Function with
   `service_role` (documented in docs/free-tier-notes.md); demo mode uses anon
   key + RLS for the project scope.

## Next 3 concrete steps

```bash
# 1. Apply the new schema (paste into Supabase SQL Editor, then Run)
open infra/schema.sql

# 2. Re-run the test suite
cd tests && npm install && npm test

# 3. Run the whole platform locally
#    Option A: docker compose up --build
#    Option B: ./start.sh
```
