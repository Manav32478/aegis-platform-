# Aegis — Self-Healing Multi-Cloud Resilience Prototype

## 🏷️ Product Overview

**Aegis** is a multi-cloud resilience control-plane prototype. It provides a
health-check contract, scheduled monitoring, Supabase history, a Cloudflare
edge router, an operations dashboard, and advisory analytics. It is designed to
support applications deployed on multiple providers, but each origin must be
deployed and configured separately.

**Current stage:** pilot/prototype, not a production availability guarantee.
Render is the currently responding protected-app origin; the configured Vercel
origin URL is stale and must be replaced with a live deployment before a genuine
two-origin failover demonstration. Cloud Run and Oracle are planned targets.

**Tagline:** *"One app, multiple origins, observable recovery paths"*

---

## 🎯 Value Proposition

| Problem | Aegis Solution |
|---|---|
| Single cloud = single point of failure | Deploy app copies to independent providers and monitor them |
| Free-tier origins can be unreliable | Health checks, history, and a configurable alternate-origin route |
| Commercial multi-cloud tools can be expensive | Prototype can be evaluated on free tiers; usage costs still depend on provider limits |
| Vendor lock-in | App contract and container approach are provider-agnostic |
| No visibility into cloud health | Dashboard, incident history, and advisory anomaly signals |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AEGIS CONTROL PLANE                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   Portal    │  │    API      │  │  Monitor    │  │   Reports       │   │
│  │  (web:3100) │  │  (api:4000) │  │ (orchestra) │  │   (daily/week)  │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │
└─────────┼────────────────┼────────────────┼─────────────────┼─────────────┘
          │                │                │                 │
          ▼                ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE POSTGRES (FREE)                             │
│  health_checks • incidents • alerts • monitor_targets • failover_events    │
│  audit_log • health_reports • api_keys • organizations • risk_flags        │
└─────────────────────────────────────────────────────────────────────────────┘
          ▲                ▲                ▲                 ▲
          │                │                │                 │
    ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
    │ Cloudflare│   │  GitHub   │   │   Oracle  │   │  Cloud    │
    │  Worker   │   │  Actions  │   │    VM     │   │  Vantage  │
    │ (cron */5)│   │ (cron */5)│   │  (24/7)   │   │           │
    └───────────┘   └───────────┘   └───────────┘   └───────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA PLANE (PROTECTED APPS)                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ Render  │  │ Vercel  │  │Cloud Run│  │ Oracle  │  │  Cloud-   │         │
│  │ (Free)  │  │ Hobby   │  │ (Free)  │  │ VM (Free)│  │  flare    │         │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         │
│       │            │            │            │            │               │
│       └────────────┴────────────┴────────────┴────────────┘               │
│                           SAME APP (Dockerized)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Core Capabilities

### 1. Multi-Cloud Orchestration
- **Repeatable deployment** — deploy the same app image/build separately to each provider.
- **Cloudflare Worker Router** — checks configured origins and tries healthy origins in configured order; the dashboard score is advisory and is not currently the Worker's routing algorithm.
- **Health contract** — each application origin must expose a reliable `/health` endpoint.

### 2. Monitoring & Health Indicators
- **10-second portal probes** for the dashboard view (serverless hosts may not keep long-lived workers alive).
- **Scheduled checks** through Cloudflare Worker cron and GitHub Actions; Oracle monitoring is planned, not active.
- **Health score (0–100)** = project-defined 50% uptime + 30% latency + 20% error-rate weighting.
- **SLA comparison** — compares observed history with a configurable target; it is not a provider SLA or guarantee.
- **Latency percentiles** — p50, p90, p95, p99 from collected observations.

### 3. Incidents, Alerts & Recovery
- Incident open/close records and downtime duration are supported.
- Alert records are supported; Slack/webhook delivery requires secrets/configuration.
- Optional GitHub redeploy dispatch requires a token, workflow permission, and provider deploy hooks; it must be configured and tested before being described as enabled.
- Failover decisions should be proven with a staging outage test before a production commitment.

### 4. Intelligence (advisory; assumptions are visible)
| Feature | Current behaviour |
|---|---|
| **Anomaly signal** | Rolling median/MAD z-score calculated from history; advisory, not validated outage prediction |
| **Isolation Forest** | Python workflow can run on stored history when its dependencies/secrets are available |
| **Cost** | Projection from request counters and an illustrative baseline; not a provider invoice |
| **Carbon** | Fallback region estimates unless a live provider/API key is configured |
| **Security CI** | Trivy/Checkov workflows are examples; review each actual run and findings |

### 5. API and tenant readiness
- API-key hashing, a rate-limit example, audit records, and Swagger documentation are implemented.
- Current Supabase demo RLS policies are permissive; this is **not production tenant isolation**.
- Before customer data: add real authentication/organization-scoped RLS, server-side secrets, key rotation/revocation, distributed rate limiting, and security review.
- Endpoints include `/api/status`, `/api/monitoring`, `/api/incidents`, `/api/alerts`, `/api/failover`, `/api/cost-report`, `/api/forecast`, `/api/risk`, `/api/security`, and `/api/serving`.

### 6. Professional Portal (4 Pages)
| Page | Purpose |
|---|---|
| **Landing** | Product overview, live stats, architecture |
| **Dashboard** | Real-time health, ML scores, cost forecast, failover proof, security CI |
| **Public Status** | No-login status page for customers |
| **Admin Console** | Target management, API key generation, audit log, report generation |

---

## 📦 What's in the Box (Project Structure)

```
aegis-platform/
├── 🌐 web/                          # Control Plane Portal (Express)
│   ├── server.js                    # Main server with all endpoints
│   ├── data.js                      # Live data provider (SSE + probes)
│   ├── realtime.js                  # Server-Sent Events broadcaster
│   ├── metrics.js                   # Public metrics endpoint
│   ├── api/                         # Vercel serverless entrypoint
│   └── public/                      # Frontend (HTML/CSS/JS)
│       ├── dashboard.html           # Main dashboard
│       ├── admin.html               # Admin console
│       ├── status.html              # Public status page
│       ├── index.html               # Landing page
│       └── assets/                  # CSS + JS
│
├── 🔌 api/                          # Multi-Tenant API Service
│   ├── server.js                    # Express server with auth/rate-limit
│   ├── generate-key.js              # API key generation
│   └── api/                         # Vercel serverless entrypoint
│
├── 📡 orchestration/                # Monitoring & Self-Healing
│   ├── monitor.js                   # Core monitor (probes, incidents, alerts)
│   ├── report.js                    # Daily/weekly report generator
│   ├── data.js                      # Shared data access
│   └── router/                      # Cloudflare Worker Router
│       ├── src/worker.js            # Edge router + cron monitor
│       └── wrangler.toml            # Cloudflare config
│
├── 🧠 intelligence/                 # Intelligence Layer
│   ├── cost.js                      # Cost forecasting & forecasting
│   ├── carbon.js                    # Carbon intensity & green routing
│   ├── anomaly.js                   # Rolling z-score anomaly detector
│   ├── failover.js                  # Deterministic failover scoring
│   ├── policy/                      # OPA/Rego policies
│   └── ml/                          # ML predictive failover
│       ├── predict.py               # Isolation Forest predictor
│       └── requirements.txt
│
├── 📦 packages/                     # Shared Packages
│   └── common/
│       ├── config.js                # Shared configuration
│       ├── supabase.js              # Supabase REST client
│       └── analytics.js             # Health scoring, percentiles, SLA
│
├── 🐳 app/                          # Protected App Template
│   ├── server.js                    # Express app with /health
│   ├── Dockerfile                   # Container for any cloud
│   └── api/                         # Vercel serverless entrypoint
│
├── 🛍️ examples/ecommerce/           # Demo E-commerce App
│   ├── server.js                    # Mini store with /health
│   ├── Dockerfile                   # Container
│   ├── api/                         # Vercel entrypoint
│   └── vercel.json                  # Vercel config
│
├── 🗄️ infra/                        # Infrastructure
│   └── schema.sql                   # Complete Supabase schema (10 tables)
│
├── 🧪 tests/                        # Test Suite (37 tests, 10 suites)
│   ├── analytics.test.js
│   ├── anomaly.test.js
│   ├── failover.test.js
│   ├── cost.test.js
│   ├── cost-v2.test.js
│   ├── monitor.test.js
│   └── realtime.test.js
│
├── 📚 docs/                         # Complete Documentation
│   ├── AEGIS_SAAS_OVERVIEW.md       # This file
│   ├── DEPLOYMENT.md                # Full deployment playbook
│   ├── ORACLE_VM_SETUP.md           # Oracle Always-Free VM guide
│   ├── ECOMMERCE_GUIDE.md           # Deploy any e-commerce app
│   ├── SPARSH_INTEGRATION.md        # Your SPARSH store integration
│   ├── ADMIN_GUIDE.md               # Admin console usage
│   ├── EXPLAIN_TO_FACULTY.md        # Faculty explanation guide
│   ├── EVAL2_CHECKLIST.md           # Evaluation day checklist
│   ├── EVAL2_PRESENTATION.pptx      # 10-slide presentation
│   ├── VIVA_QA.md                   # 10 likely viva questions
│   ├── FUTURE_SCOPE.md              # Roadmap
│   ├── ADMIN_GUIDE.md               # Admin console guide
│   ├── EXPLAIN_TO_FACULTY.md        # How to explain to faculty
│   ├── FINAL_REPORT.md              # Final project report
│   ├── ARCHITECTURE.md              # Architecture decisions
│   ├── SRS.md                       # Software Requirements Spec
│   ├── PROJECT_EXPLAINED.md         # Project explanation
│   ├── STATUS.md                    # Current status
│   └── README.md                    # Quick start
│
├── 🔧 scripts/                      # Utility scripts
├── 📜 .github/workflows/            # GitHub Actions CI/CD
│   ├── deploy.yml                   # Deploy + security scan
│   ├── monitor.yml                  # Health monitor cron
│   ├── ml-predict.yml               # ML predictor daily
│   └── security-scan.yml            # Trivy + Checkov
│
├── 🐳 docker-compose.yml            # One-command local run
├── 📋 .env.example                  # Environment template
├── 📋 README.md                     # Quick start
└── 📋 .gitignore
```

---

## 🔧 Technology Stack

| Layer | Technologies |
|---|---|
| **Runtime** | Node.js 20, Python 3.11 |
| **Web Framework** | Express.js |
| **Database** | Supabase (PostgreSQL) |
| **Edge Runtime** | Cloudflare Workers |
| **CI/CD** | GitHub Actions |
| **Container** | Docker |
| **Frontend** | Vanilla HTML/CSS/JS (no framework) |
| **ML** | Python, scikit-learn (Isolation Forest) |
| **Security** | Trivy, Checkov, OPA/Rego |
| **Monitoring** | Server-Sent Events, native fetch |

---

## 🎯 Positioning (honest current scope)

| Area | Current prototype | Production requirement |
|---|---|---|
| **Provider coverage** | Render responds; Vercel protected-app target is currently stale/404; Cloud Run/Oracle disabled | Deploy the same app to each origin and test it |
| **Routing** | Worker uses configured target health and priority order | Add score-aware selection, 5xx retry, body-safe retries, health-cache safeguards, and staging failover tests |
| **Availability** | A failover path exists; no measured client SLA | Establish measurable recovery objectives and test under client workloads |
| **Cost** | Free-tier usage model / illustrative projection | Validate against provider bills, egress, and quota changes |
| **Intelligence** | Health scoring and anomaly indicators; carbon fallback data | Backtest ML and use validated live data before making predictive claims |
| **Tenant/security** | API-key prototype, permissive demo RLS, in-memory limits | Organization-scoped RLS, managed auth, key rotation, distributed rate limits, independent security review |

---

## 📊 Verification snapshot (do not reuse old sample metrics)

Health values change continuously; fetch them from the live dashboard and verify
with `/api/diagnostics` before a client demo. In the latest audit of the public
portal, Supabase reads failed with `PGRST125` (invalid URL path), Render returned
HTTP 200, and the configured Vercel app URL returned 404. The database itself
contains health history; the deployed portal is not currently reading it.

Local automated tests: **37 tests across 10 suites passed** in the workspace.
The current remote GitHub Actions page has reported failed test/security runs;
inspect the actual Actions logs and rerun before claiming CI is green.

---

## 🛡️ Security & compliance status

- API keys are hashed with SHA-256; plaintext keys are shown once.
- Rate limiting is in-memory and resets with the process; it is not a distributed SaaS limiter.
- The demo Supabase RLS policies allow broad access. They are not suitable for real customer data or tenant isolation.
- Trivy, Checkov and OPA examples exist, but a configured scanner is not proof that the product is compliant or vulnerability-free.
- Before a client production deployment, move privileged writes behind a server-side boundary, use strict tenant-scoped RLS, rotate secrets, and perform a security review.

---

## 🚀 Quick Start (3 Commands)

```bash
# 1. Clone & configure
git clone https://github.com/Manav32478/aegis-platform-.git
cd aegis-platform
cp .env.example .env
# Edit .env with your Supabase URL + anon key

# 2. Run everything locally (one command)
bash start.sh
# Opens portal at http://localhost:3100
# API at http://localhost:4000/api-docs

# 3. Or with Docker (production-like)
docker compose up --build
```

---

## 📚 Documentation Index

| Document | Purpose |
|---|---|
| `README.md` | Quick start |
| `DEPLOYMENT.md` | Full deployment playbook |
| `ORACLE_VM_SETUP.md` | Oracle Always-Free VM guide |
| `ECOMMERCE_GUIDE.md` | Deploy any e-commerce app |
| `SPARSH_INTEGRATION.md` | Your SPARSH store integration |
| `ADMIN_GUIDE.md` | Admin console usage |
| `EXPLAIN_TO_FACULTY.md` | Faculty explanation guide |
| `EVAL2_CHECKLIST.md` | Evaluation day checklist |
| `EVAL2_PRESENTATION.pptx` | 10-slide presentation |
| `VIVA_QA.md` | 10 likely viva questions |
| `FUTURE_SCOPE.md` | Roadmap |
| `FINAL_REPORT.md` | Final project report |
| `ARCHITECTURE.md` | Architecture decisions |
| `SRS.md` | Software Requirements Spec |
| `PROJECT_EXPLAINED.md` | Project explanation |

---

## 🎓 Demo readiness checklist (verify on demo day)

- [x] Dashboard and router endpoints load.
- [x] Render `/health` responds.
- [ ] Correct Supabase base URL in the Vercel Production environment; `/api/diagnostics` reports history rows.
- [ ] Deploy a current Vercel protected-app origin (the configured `lyart` URL currently returns 404).
- [ ] Confirm Supabase `monitor_targets` points to the live Render and Vercel app origins.
- [ ] Update and deploy the Cloudflare Worker targets to those same app origins.
- [ ] Confirm Cloudflare cron writes checks (`region='cloudflare-edge'`) and GitHub monitor runs are recent/successful.
- [ ] Run a controlled staging failover and record the observed result before claiming failover is proven.
- [x] Local test suite passes: 37 tests across 10 suites.
- [x] Documentation and evaluation materials are included.

---

## 🚀 Production Deployment Checklist

| Item | Status | Command |
|---|---|---|
| Supabase schema applied | ⬜ Run `infra/schema.sql` in SQL Editor | - |
| GitHub secrets added | ⬜ Settings → Secrets → Actions | - |
| Render deploy hook | ⬜ Settings → Deploy Hook | - |
| Vercel deploy hook | ⬜ Settings → Git → Deploy Hooks | - |
| Oracle VM provisioned | ⬜ Follow `ORACLE_VM_SETUP.md` | - |
| Router deployed | ⬜ `cd orchestration/router && wrangler deploy` | - |
| E-commerce example deployed | ⬜ Deploy `examples/ecommerce` to 3 clouds | - |

---

## 📞 Handoff & production path

This is a substantial **working prototype/pilot**, not yet a production-ready
commercial SaaS. It includes the portal, API, Worker, monitor, schema,
e-commerce example, documentation, and a locally passing 37-test suite.

For a local demo: configure `.env` and run `bash start.sh`. For a production
pilot, first resolve the Vercel/Supabase configuration and stale origin listed
in `docs/VERCEL_DASHBOARD_FIX.md`, then test a second identical app origin and
controlled failover. Production tenant isolation, authentication, retries,
alert delivery, security controls, backups, cost limits, and operational support
must be completed and reviewed before serving real customer workloads.

---

**Built with ❤️ for the Aegis Self-Healing Multi-Cloud Platform**  
*Author: Manav Sarvaiya · B.E. Final Year · 2026*