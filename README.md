> **Redesign handoff:** Start with [START_HERE.md](START_HERE.md) for current setup, testing, deployment and Git instructions. Older content below may be outdated. This remains a prototype; the supplied database policies are not safe for production.

# Aegis — Self-Healing Multi-Cloud Resilience Platform

**Monitor application copies across cloud providers, understand origin health, and demonstrate controlled failover.**

Aegis is a multi-cloud resilience prototype with a live control-plane dashboard,
health-check history, an edge router, incident/alert records, and advisory
intelligence. **Render is the currently active protected origin. A working Vercel
origin must be deployed and registered before demonstrating two-origin failover;
Cloud Run and Oracle are optional planned targets.**

The demo is designed to fit within free tiers at low traffic, but provider limits
and overages can change. It is not an unconditional ₹0 or zero-downtime guarantee.

> 🎓 Major project · See [`docs/`](docs/) for the architecture, deployment,
> client explanation, evaluation guide, and production-readiness notes.

---

## ✨ What it does (feature map)

| Layer | Feature | Where |
|---|---|---|
| **Monitoring** | 5-min multi-region probes, latency percentiles (p50/p90/p95/p99), error rate, HTTP status, **live 10s on-demand probes** | Cloudflare cron + GitHub Actions + Oracle VM |
| **Real-time** | Server-Sent Events push (`/api/stream`), live event feed, SLA tracking (99.9%), latency trends, sparklines | `web/realtime.js` + `web/data.js` |
| **Intelligence** | Composite health score (0–100), rolling-statistics anomaly detection + Isolation Forest (ML), cost forecast, carbon-aware routing | `intelligence/` |
| **Failover** | Worker orders configured origins by health and proxies to the first healthy one; dashboard score is advisory and separate | `orchestration/router/` |
| **Self-heal** | Optional GitHub redeploy dispatch; requires token, deploy workflow and provider hooks to be configured and tested | `orchestration/monitor.js` |
| **Alerting** | Down / recovered / degraded records; Slack/webhook delivery when secrets are configured | `orchestration/monitor.js` |
| **Reporting** | Daily/weekly report generator and CSV/JSON exports | `orchestration/report.js`, `/api/export.*` |
| **API** | Prototype API-key auth, in-memory rate limiting, audit records, Swagger UI; tenant isolation needs production hardening | `api/` |
| **Web portal** | Landing page, live dashboard, public status, admin console, uptime badges, dark/light theme | `web/` |
| **Security** | Trivy, Checkov and OPA policy examples in CI; scan status must be checked per run | `.github/workflows/` |
| **Testing** | 37 unit tests across analytics, anomaly, failover, config, dashboard script, realtime and monitor | `tests/` |

---

## 🧩 Architecture (microservices)

```
                    ┌──────────────────────────────────────────────┐
                    │              CONTROL PLANE                    │
                    │  (runs on Oracle Always-Free VM / locally)    │
                    │                                               │
                    │   web/      portal · dashboard · status · admin │
                    │   api/      multi-tenant API + Swagger        │
                    │   monitor   probe → score → heal → alert      │
                    │   report    daily/weekly health reports       │
                    └──────────────┬───────────────────────────────┘
                                   │ writes / reads
                    ┌──────────────▼───────────────┐
                    │   Supabase Postgres (free)    │
                    │  health_checks · incidents    │
                    │  alerts · keys · audit · …    │
                    └──────────────▲───────────────┘
      probes (every 5 min)         │ reads
   ┌───────────────┬───────────────┴───────────────┐
   │ Cloudflare    │ GitHub Actions │ Oracle VM     │  ← independent vantage points
   │ edge cron     │ cron (public)  │ (always-on)   │
   └───────────────┴───────────────┬───────────────┘
                                   │ /health on each
                    ┌──────────────▼───────────────┐
                    │     DATA PLANE (protected)    │
                    │  Render · Vercel · Cloud Run  │
                    │  (same app, 3 clouds)         │
                    │  Cloudflare Worker = router   │
                    └──────────────────────────────┘
```

**Key rule:** the tracker always lives OUTSIDE the clouds it watches, so one
provider's outage never blinds the monitoring system itself.

---

## 🚀 Quick start

### Option A — Docker Compose (recommended, everything in one command)

```bash
cd aegis-platform
cp .env.example .env        # fill in SUPABASE_URL / SUPABASE_KEY (publishable key)
docker compose up --build
```

Then open:
- **Portal** → http://localhost:3100
- **Dashboard** → http://localhost:3100/dashboard.html
- **API docs** → http://localhost:4000/api-docs

### Option B — plain Node (no Docker)

```bash
cd web   && npm install && ADMIN_TOKEN=admin node server.js     # terminal 1
cd api   && npm install && node index.js                        # terminal 2
cd orchestration && node monitor.js                             # terminal 3 (one-shot)
cd tests && npm install && npm test                             # run the test suite
```

### Option C — macOS one-liner

```bash
bash start.sh
```

---

## ☁️ Where the app is deployed (and how Aegis tracks health)

| # | Cloud | URL | Health tracked? |
|---|---|---|---|
| 1 | Render (free) | `https://aegis-platform-pomf.onrender.com` | ✅ live |
| 2 | Vercel (Hobby) | `https://aegis-platform-qrhr.vercel.app` | ✅ live |
| 3 | Cloud Run (free tier) / Oracle VM | planned — see `docs/DEPLOYMENT.md` | ➕ next |

The **router** at `https://aegis-router.manav32478.workers.dev` is live and
currently proxies to Render. Its current code tries configured healthy origins
in configured order; the dashboard's composite health score is an advisory
comparison, not the Worker's routing algorithm.

The dashboard shows the current configured origins and recorded Supabase
history. Full deployment playbook: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
For the exact current Vercel/Supabase fixes, see
[`docs/VERCEL_DASHBOARD_FIX.md`](docs/VERCEL_DASHBOARD_FIX.md).

---

## 📁 Repo layout

```
aegis-platform/
├── web/                # control plane: portal + dashboard + status + admin
├── api/                # multi-tenant API + Swagger + keys + rate limiting
├── orchestration/      # monitor, self-heal, alerts, reports, Cloudflare router
├── intelligence/       # cost, carbon, anomaly, failover scoring, OPA policy
├── packages/common/    # shared config + Supabase REST + analytics (zero deps)
├── app/                # the protected demo app (identical on every cloud)
├── infra/              # schema.sql + Terraform (optional)
├── tests/              # 37 unit tests (Jest)
├── docs/               # SRS, architecture, evaluation, guides, final report
├── .github/workflows/  # CI: deploy, monitor, ML, security scans
└── docker-compose.yml  # run the whole platform with one command
```

---

## 🔐 Security notes (read me)

- Only the **publishable (anon)** Supabase key ever appears in code. The
  `service_role` key must stay secret and is only mentioned for the documented
  production-hardening path (Edge Functions).
- Never commit `.env`; use the GitHub **Secrets** settings for CI variables.
- API keys are stored **hashed only** (SHA-256); the plaintext is shown once.
- Writes use RLS policies in demo mode for the college-project scope; the
  production hardening path is documented in `docs/free-tier-notes.md`.

---

## 📚 Documentation

| Doc | Purpose |
|---|---|
| [`docs/PROJECT_EXPLAINED.md`](docs/PROJECT_EXPLAINED.md) | Plain-English explanation of the whole project |
| [`docs/SRS.md`](docs/SRS.md) | Software Requirements Specification |
| [`docs/architecture.md`](docs/architecture.md) | Architecture + design decisions |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Full deployment playbook (all free tiers) |
| [`docs/ORACLE_VM_SETUP.md`](docs/ORACLE_VM_SETUP.md) | Zero-cost 24/7 VM step-by-step |
| [`docs/FUTURE_SCOPE.md`](docs/FUTURE_SCOPE.md) | Future scope + roadmap for viva |
| [`docs/VIVA_QA.md`](docs/VIVA_QA.md) | Likely viva questions + answers |
| [`docs/final-report.md`](docs/final-report.md) | Final project report |

---

## 🧪 Current verified status (2026-11-12)

- ✅ Render protected-app origin responds to `/health`.
- ✅ Vercel protected-app origin `https://aegis-platform-qrhr.vercel.app/health` now responds; monitor target updated in Supabase. Deploy the router update to use this origin.
- ✅ Cloudflare Worker router is live and serving Render; verify alternative-origin failover after configuring a live second app origin.
- ⚠️ The public Vercel portal reports Supabase `PGRST125` (invalid REST URL path) until its `SUPABASE_URL` environment variable is corrected to the project root and redeployed.
- ✅ Local test suite: 37/37 passing.
- ⚠️ GitHub Actions latest security/deploy runs had failures; inspect Actions and rerun after updating the workflow.
- ➕ Cloud Run and Oracle remain optional targets; neither is currently deployed.
