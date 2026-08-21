# 🟢 Aegis — LIVE SYSTEM STATUS

**As of:** August 20, 2026

## Production URLs (all live, all free)
| Layer | URL | Status |
|-------|-----|--------|
| **Failover router** | https://aegis-router.manav32478.workers.dev | ✅ LIVE (routes to healthiest cloud) |
| Cloud #1 (Render) | https://aegis-platform-pomf.onrender.com | ✅ `/health` → `cloud: render` |
| Cloud #2 (Vercel) | https://aegis-platform-lyart.vercel.app | ✅ `/health` → `cloud: vercel` |
| Database (Supabase) | https://kagjbxxmdyaypfcqemem.supabase.co | ✅ 4 tables + live data |
| Live status page | https://aegis-router.manav32478.workers.dev/status | ✅ real data from Supabase |
| GitHub repo | https://github.com/Manav32478/aegis-platform- | ✅ CI/CD + monitor cron |

## How to demo failover (the wow moment)
1. Open **https://aegis-router.manav32478.workers.dev/health** → shows one cloud.
2. Go to **Render → your service → Suspend service**.
3. Refresh the router URL → it now returns the **Vercel** cloud. Traffic never stopped.
4. Resume Render when done.

## Automatic monitoring
- GitHub Action "Health monitor" runs **every 5 min** → writes to `health_checks`.
- Cloudflare Worker also has a cron trigger (`*/5 * * * *`) → same.

## Done (Months 1–3)
✅ SRS + architecture · repo + CI/CD · app + Docker · 2 clouds · Supabase schema ·
health monitor · live status page · Cloudflare failover router

## Month 4 — intelligence layer (built & verified)
✅ Cost module — shown on /status ($40/mo savings)
✅ Carbon module — fallback data shown on /status (live needs Electricity Maps key)
✅ Policy-as-code (OPA/Rego) — `intelligence/policy/`
✅ Security scanning — Trivy + Checkov run in CI on every push
✅ ML predictive failover — `intelligence/ml/predict.py` (Isolation Forest)
   · `--demo` mode verified: flags a degrading cloud, keeps stable ones healthy
   · real mode verified: reads your health_checks, defers until ≥10 rows
   · runs daily via GitHub Action "Predictive risk (ML)"

## Month 5 — product layer (done ✅)
✅ Multi-tenant API (`api/index.js`) — verified live: 401 / 403 / 200 with real data
✅ API key generated + stored as SHA-256 hash (hash match verified against Supabase)
✅ Swagger UI at `/api-docs`
✅ React dashboard scaffold (`dashboard/`) + k6 load test (`tests/load-test.js`)

## Month 6 — tests, report, viva (in progress)
✅ Jest test suite — 6/6 passing (`cd tests && npm test`)
✅ Final report template with real numbers — `docs/final-report.md`
✅ Demo video script — `docs/DEMO_VIDEO_SCRIPT.md`
✅ Viva Q&A bank — `docs/VIVA_QA.md`
⏳ To finish: run k6 load test (record p95), record the demo video, screenshot evidence.

## Live metrics (real, from Supabase)
- 10 health checks recorded · vercel 100% uptime @ 393 ms avg · render 80% @ 479 ms
  (render's 80% = its free tier sleeping when idle — the system stays up via failover)

## Next (Month 5 → 6)
- Let health_checks accumulate (~1 week) so the ML model has real history to learn from.
- Optional: Electricity Maps key for live carbon.
- Month 6: Jest test suite pass, final report, demo video, viva prep.

## Notes
- Render free tier sleeps after ~15 min idle; the 5-min monitor keeps waking it.
- GCP/Oracle optional (card verification) — not needed for a strong submission.
