# Aegis — Self-Healing Multi-Cloud Platform

**Keep an application alive across three clouds automatically — on ₹0/month free tiers.**

Aegis continuously monitors your app running on **Render, Vercel and Cloud Run**,
detects failures before users notice, reroutes traffic to the healthiest cloud,
and redeploys the broken one — all automatically, all inside free tiers.

> 🎓 Major project · 6 months · 2 evaluations · See [`docs/`](docs/) for SRS,
> architecture, evaluation plan, viva Q&A and the final report.

---

## ✨ What it does (feature map)

| Layer | Feature | Where |
|---|---|---|
| **Monitoring** | 5-min multi-region probes, latency percentiles (p50/p90/p95/p99), error rate, HTTP status, **live 10s on-demand probes** | Cloudflare cron + GitHub Actions + Oracle VM |
| **Real-time** | Server-Sent Events push (`/api/stream`), live event feed, SLA tracking (99.9%), latency trends, sparklines | `web/realtime.js` + `web/data.js` |
| **Intelligence** | Composite health score (0–100), rolling-statistics anomaly detection + Isolation Forest (ML), cost forecast, carbon-aware routing | `intelligence/` |
| **Failover** | Edge router sends traffic to the healthiest cloud; automated redeploy ("self-heal") of a broken cloud | `orchestration/router/` |
| **Alerting** | Down / recovered / degraded events → Slack, any webhook, or email (Resend free tier) | `orchestration/monitor.js` |
| **Reporting** | Automated daily/weekly health reports stored in Supabase, CSV/JSON export | `orchestration/report.js`, `/api/export.*` |
| **API** | Multi-tenant API with key auth, rate limiting, audit log, Swagger UI | `api/` |
| **Web portal** | Landing page, live dashboard, public status page, admin console, **embeddable uptime badges**, dark/light theme | `web/` |
| **Security** | Trivy (container), Checkov (IaC), OPA/Rego (policy) in CI | `.github/workflows/` |
| **Testing** | 30 unit tests across analytics, anomaly, failover, cost, realtime, monitor | `tests/` |

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
./start.sh
```

---

## ☁️ Where the app is deployed (and how Aegis tracks health)

| # | Cloud | URL | Health tracked? |
|---|---|---|---|
| 1 | Render (free) | `https://aegis-platform-pomf.onrender.com` | ✅ live |
| 2 | Vercel (Hobby) | `https://aegis-platform-lyart.vercel.app` | ✅ live |
| 3 | Cloud Run (free tier) / Oracle VM | planned — see `docs/DEPLOYMENT.md` | ➕ next |

The **router** at `https://aegis-router.manav32478.workers.dev` always sends
traffic to the healthiest cloud and records every decision.

To see **which of the 3 clouds is healthiest right now**, open the dashboard —
it computes a composite score per cloud from live Supabase data and shows the
routing decision. Full deployment playbook: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
Zero-cost Oracle VM guide: [`docs/ORACLE_VM_SETUP.md`](docs/ORACLE_VM_SETUP.md).

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
├── tests/              # 26 unit tests (Jest)
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

## 🧪 Status

- ✅ 2 clouds live (Render + Vercel), monitored every 5 min from Cloudflare edge + GitHub
- ✅ Router live, failover decisions recorded
- ✅ 26/26 unit tests passing
- ✅ API v2 with rate limiting + audit log + Swagger
- ✅ Professional portal (dashboard + status + admin)
- ➕ Next: Oracle Always-Free VM for 24/7 control plane (guide included)
