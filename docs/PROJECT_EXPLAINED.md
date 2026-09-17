# 📘 Aegis — Complete Project Explanation
**What we built, how it works, and why — in detail.**

---

## 1. The one-sentence summary

**Aegis is a self-healing multi-cloud platform** that runs *one* application across
*multiple cloud free tiers*, watches their health every 5 minutes, and **automatically
fails over** to a healthy cloud the moment one fails — with cost, carbon, security and
machine-learning intelligence on top. **The whole thing runs at $0.**

---

## 2. The problem we're solving

Most applications run on **one** cloud provider. That's a **single point of failure** —
if that provider has an outage (and they do, regularly), the app goes down and the
developer can do nothing but wait.

Meanwhile, **free tiers are everywhere** — Render, Vercel, Google Cloud Run, Oracle
Always Free — but each one alone is **unreliable**:
- Render's free service **sleeps after ~15 minutes of idle** (takes ~50s to wake),
- free instances throttle and rate-limit,
- any single provider can have a bad day.

The insight: **no single free tier is trustworthy, but several together are.**
Aegis turns that insight into a working system.

> In our own live data this literally happened: Render showed **80% uptime** because its
> free tier sleeps when idle — but the system stayed available by failing over to Vercel.

---

## 3. The core idea

Treat clouds as **disposable, interchangeable resources**:

1. Deploy the **same app** to multiple clouds' free tiers.
2. **Monitor** every cloud's health continuously.
3. **Route** traffic through one smart entry point that always picks the healthiest cloud.
4. Add an **intelligence layer** that predicts failures, tracks cost, carbon and security.
5. Pay **$0** because every component is a free tier.

---

## 4. The architecture (5 layers)

```
 LAYER 1  CLIENTS ──► one URL (browsers, curl, other apps)
                       │
 LAYER 2  EDGE     ──► Cloudflare Worker (failover router + cron monitor)
                       │  health-checks every backend
        ┌──────────────┼────────────────┐
 LAYER 3 COMPUTE  ──► Render          Vercel        (GCP/Oracle ready)
        │  same app    aegis-app       aegis-app
        └──────────────┼────────────────┘
                       │  every 5 min → health_checks
 LAYER 4  DATA     ──► Supabase (Postgres)
                       health_checks · organizations · api_keys · risk_flags
                       │
 LAYER 5  INTELLIGENCE & ACCESS ──► cost · carbon · OPA policy · Trivy/Checkov
                                     · Isolation Forest (ML)
                                     · REST API + Swagger · dashboards
```

### Layer 1 — Clients
Users hit **one URL** — the router. They never know which cloud actually serves them.

### Layer 2 — Edge (Cloudflare Worker) — `orchestration/router/src/worker.js`
This is the brain of failover:
- Keeps an **in-memory health cache** (refreshed every 10 s) of which clouds are healthy.
- Every request: pick the **healthiest** cloud and proxy the request to it.
- If the proxy fails, **retry the next cloud in the same request** — failover in milliseconds.
- If **all** clouds are down → return HTTP **503** "All clouds are down".
- Also runs a **cron trigger every 5 minutes** that monitors all clouds *for free*
  (no GitHub Actions minutes consumed).

### Layer 3 — Compute (the clouds) — `app/`
The **same Express app** (Dockerized) runs on every cloud. It exposes:
- `GET /health` → `{status, cloud, uptimeSeconds, requests, timestamp}` — identical contract everywhere.
- `GET /status` → a live status page reading real data from Supabase.
- `GET /dashboard` → the unified control center.

Live deployments:
| Cloud | URL | How |
|-------|-----|-----|
| Render (free) | `aegis-platform-pomf.onrender.com` | Docker build |
| Vercel (free) | `aegis-platform-lyart.vercel.app` | serverless (`app/api/index.js` + `vercel.json`) |
| GCP / Oracle | ready | code already supports them |

### Layer 4 — Data (Supabase) — `infra/schema.sql`
Four tables:
- **`health_checks`** — every monitor result (cloud_name, healthy, latency, checked_at). This is the system's memory *and* the ML training data.
- **`organizations`** + **`api_keys`** — multi-tenancy. Keys stored as **SHA-256 hashes**, never plaintext.
- **`risk_flags`** — where the ML model writes "this cloud looks risky".

Row-Level Security (RLS) is enabled with policies so the monitor can write and the
dashboards can read — safely.

### Layer 5 — Intelligence & Access
| Module | File | What it does |
|--------|------|--------------|
| 💸 Cost | `intelligence/cost.js` | proves ~$40/mo saved vs one paid cloud, transparent calculation |
| 🌱 Carbon | `intelligence/carbon.js` | picks the region with the lowest grid carbon intensity (live via Electricity Maps, fallback to published averages) |
| 📜 Policy | `intelligence/policy/*.rego` | OPA rules; a violation fails the CI pipeline |
| 🛡️ Security | `.github/workflows/security-scan.yml` | Trivy (container) + Checkov (IaC) scan every push |
| 🔮 ML | `intelligence/ml/predict.py` | Isolation Forest flags clouds *before* they fail |
| ⌨️ API | `api/` | multi-tenant REST API + Swagger, hashed-key auth |
| 🎛️ UI | `dashboard.html` | ONE file containing the whole demo |

---

## 5. How failover works — step by step

1. A user requests `aegis-router.manav32478.workers.dev/health`.
2. The Worker checks its health cache (≤10 s old) → picks **Render** (healthiest).
3. It proxies the request to Render → user gets `{"cloud":"render"}`.
4. Now Render goes down (or its free tier sleeps).
5. The next health check marks Render **unhealthy**.
6. New requests are instantly routed to **Vercel** instead — the user never notices.
7. The monitor records Render's failure in `health_checks`.
8. **Self-healing:** after **3 consecutive failures**, the monitor calls the GitHub API
   to **auto-redeploy** that cloud.
9. When Render recovers, it rejoins the pool automatically.

**Why the Worker and not DNS?** DNS failover is bound by TTL — clients cache the old IP,
so failover takes **minutes**. A Worker retries in **milliseconds**.

---

## 6. How monitoring works

- A monitor (`orchestration/monitor.js`) fetches `/health` from every cloud.
- It runs **two ways** (redundancy!):
  1. A **GitHub Action** on a `*/5` cron.
  2. The **Cloudflare Worker's own cron** trigger.
- Results are written to Supabase `health_checks` via its REST API (plain `fetch` — no
  heavy client, which also fixed a Node-20 WebSocket incompatibility we hit).
- Over time this history becomes the **training data** for the ML model.

---

## 7. How the ML (predictive failover) works

**Model:** Isolation Forest (unsupervised anomaly detection).

**Feature:** a **rolling average latency per cloud** — so each cloud is judged against
its *own* normal behaviour, not one fixed threshold (Render and Vercel have different
baselines; a single number would misfire).

**Process:**
1. Pull `health_checks` history.
2. Build the rolling-latency feature per cloud.
3. Train Isolation Forest → each check gets a risk score; `-1` = anomalous.
4. A cloud is flagged **at risk** if any of its **last 3 checks** is anomalous.
5. Flags are written to `risk_flags` → shown on the dashboard as ⚠.

**Why it matters:** it flags a cloud *before* it fully fails — proactive failover, not
reactive. In the dashboard's **ML Lab**, a real in-browser Isolation Forest correctly
flags the degrading "oracle" cloud while keeping stable clouds healthy.

---

## 8. How the API (multi-tenancy) works

- `api/generate-key.js` creates an API key and stores **only its SHA-256 hash** in
  `api_keys` (plaintext shown once).
- The API (`api/index.js`) requires an `x-api-key` header:
  - no key → **401**,
  - wrong key → **403**,
  - valid key → **200** with real data.
- Endpoints: `/api/status`, `/api/cost-report`, `/api/risk`, `/api/security-score`.
- **Swagger UI** at `/api-docs` documents everything interactively.

---

## 9. How the dashboard is "one file"

`dashboard.html` is a self-contained page (no external scripts, no build step) with
9 sidebar sections, including things that used to need separate terminals:
- **ML Lab** — a genuine 1-D Isolation Forest running *in the browser*.
- **Testing** — the 6 real unit tests executing live in the page ("6/6 passing").
- **Failover demo** — client-side simulation with a chaos button.
- **API explorer** — calls the API (with a graceful demo fallback).

Light/dark theme toggle, remembered across visits.

---

## 10. Why these technology choices (the defensible decisions)

| Decision | Reason |
|----------|--------|
| Cloudflare Workers (not DNS failover) | milliseconds vs minutes (TTL) |
| Isolation Forest (not a threshold) | adapts to each cloud's own latency; unsupervised |
| OPA/Rego (not if-statements) | policy is data, decoupled from code, auditable |
| Supabase (not a self-hosted DB) | free Postgres + REST + auth; doubles as ML data |
| Zero-dependency monitor (plain fetch) | reliable on Node 18/20/22 + GitHub Actions |
| Docker + CI/CD | identical image on every cloud; every push scanned & deployed |

---

## 11. What runs automatically (you never touch these)

| Thing | Runs on | Schedule |
|-------|---------|----------|
| Health monitor | GitHub Actions + Worker cron | every 5 min |
| ML prediction | GitHub Actions | daily 02:00 |
| Security scans (Trivy/Checkov) | GitHub Actions | every push |
| Deploys | Render + Vercel | every push to `main` |

---

## 12. What's proven working (real, live)

- Two clouds live + healthy via the router (`render` / `vercel`).
- 80+ real health checks in Supabase, growing every 5 minutes.
- API auth verified end-to-end (401/403/200, hash match confirmed).
- 6/6 unit tests passing (live in the dashboard *and* via `npm test`).
- ML demo flags the degrading cloud; real model collects history.
- Chaos/failover demo works offline and in production (suspend Render → router serves Vercel).
