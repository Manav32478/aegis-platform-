# Aegis — Final Project Report

**Project:** Aegis — Self-Healing, Carbon-Aware Multi-Cloud Platform
**Author:** Manav Sarvaiya · **Course:** B.E. Final Year Major Project
**Date:** August 2026 · **Status:** Months 1–5 complete, Month 6 in progress

---

## 1. Abstract

Cloud outages are a single point of failure for most applications, yet free-tier
clouds — while individually unreliable — are plentiful. Aegis is a self-healing
multi-cloud platform that runs one application across multiple cloud free tiers
(Google Cloud Run-ready, Oracle-ready, Render, Vercel), monitors each cloud every five
minutes, and fails over automatically via a Cloudflare Worker the moment one cloud
degrades. On top of this, an intelligence layer adds cost estimation (an estimated
**$40/month saved** vs. a single paid instance), carbon-aware region selection,
policy-as-code (OPA), continuous security scanning (Trivy/Checkov), and **ML-based
predictive failover** (Isolation Forest). The platform is multi-tenant (hashed API-key
auth + Swagger docs) and runs at a **total cost of $0**.

---

## 2. Introduction & Problem Statement

A single cloud provider is a single point of failure: one regional outage takes an
application down with no recovery path. Free tiers (Render, Vercel, Cloud Run, Oracle
Always Free) are individually unreliable — Render's free services sleep after ~15
minutes of idle, for example — so no single free tier can serve production traffic
alone. Commercial multi-cloud and DR products are expensive and lock you into one
vendor's tooling.

**Problem:** there is no simple, zero-cost way to combine several free tiers into one
system that is *more* reliable than any single paid instance.

**Solution:** Aegis treats clouds as interchangeable, disposable resources. It runs one
Dockerized app on several free tiers, monitors health continuously, and routes traffic
to the healthiest cloud at the edge — achieving high logical availability at $0.

---

## 3. Literature / Market Survey

| Approach | Failover speed | Cost | Notes |
|----------|----------------|------|-------|
| DNS-based failover | minutes (TTL-bound) | low | slow, clients cache old IPs |
| Kubernetes multi-cluster | seconds | high | heavy, not free-tier friendly |
| Commercial multi-cloud (e.g. managed DR) | fast | high | vendor lock-in |
| **Aegis (edge routing + health)** | **milliseconds** | **$0** | app-level, provider-agnostic |

Key technologies surveyed: Cloudflare Workers (edge compute), Supabase (managed
Postgres + auth), Open Policy Agent (policy-as-code), scikit-learn Isolation Forest
(unsupervised anomaly detection), Trivy/Checkov (IaC + container scanning), k6
(load testing).

---

## 4. System Requirements

See `docs/SRS.md`. Highlights:
- **FR-4:** the router shall fail over within one health-check when the active cloud fails.
- **NFR-1:** ≥ 99.9% logical uptime across clouds.
- **NFR-3:** total running cost $0.
- **FR-12:** API rejects requests without a valid (hashed) API key.

---

## 5. System Design

Five layers (see `docs/architecture.md` for the diagram + ER model):

```
Clients → Cloudflare Worker (failover router + cron monitor)
        → Clouds (Render, Vercel, GCP/Oracle-ready)
        → Supabase (health_checks, organizations, api_keys, risk_flags)
        → Intelligence (cost, carbon, OPA, Trivy/Checkov, Isolation Forest)
        → Access (status page, REST API + Swagger, React dashboard)
```

**Supabase schema:** `health_checks` (id, cloud_name, healthy, latency, checked_at) ·
`organizations` (id, name) · `api_keys` (id, org_id, key_hash) · `risk_flags`
(id, cloud_name, flagged_at).

---

## 6. Implementation (module by module)

- **Core app** (`app/`) — Express, identical across clouds; `GET /health` returns
  `{status, cloud, uptimeSeconds, requests, timestamp}`. Dockerized; a Vercel
  serverless wrapper (`api/index.js` + `vercel.json`) lets the same code run on Vercel.
- **Deployments** — Render (Docker) + Vercel (serverless) live; GCP/Oracle-ready.
- **Monitor** (`orchestration/monitor.js`) — zero-dependency fetch, writes to Supabase
  REST; self-healing dispatches a GitHub redeploy after 3 consecutive failures.
- **Router** (`orchestration/router/`) — Cloudflare Worker: health-cache (10 s TTL),
  failover proxy, plus a cron trigger that runs the monitor every 5 min for free.
- **Intelligence** — `cost.js` (savings math), `carbon.js` (region intensity with
  live/fallback), `policy/no-public-buckets.rego` (OPA), CI security scans
  (Trivy + Checkov), `ml/predict.py` (Isolation Forest → `risk_flags`).
- **API** (`api/`) — multi-tenant REST API, SHA-256-hashed key auth, Swagger UI.
- **Frontend** — `showcase.html` (live one-page dashboard), `/status` page, React
  scaffold (`dashboard/`).

---

## 7. Testing

- **Unit tests** (`tests/`) — **6/6 passing** (cost math + monitor aggregation).
- **Integration** — API auth verified: 401 (no key), 403 (wrong key), 200 (valid key).
- **Monitoring (live)** — 10 health checks recorded; vercel 100% uptime @ 393 ms avg,
  render 80% @ 479 ms avg (the 80% reflects Render's free-tier idle sleep — the system
  stayed available by failing over, which is the point).
- **Security** — Trivy + Checkov run in CI on every push.
- **Load test** — `k6 run tests/load-test.js` (run against the router URL; record p95).
- **Chaos** — suspend a cloud → router reroutes within one check; verify via
  `aegis-router.manav32478.workers.dev/health`.

---

## 8. Results & Screenshots

*(Insert: showcase.html hero + status grid, live /status page, Swagger UI with
Authorize, Supabase table rows, GitHub Actions green runs, chaos-test before/after.)*

Live URLs:
- Router: `https://aegis-router.manav32478.workers.dev`
- Render: `https://aegis-platform-pomf.onrender.com`
- Vercel: `https://aegis-platform-lyart.vercel.app`
- Status: `https://aegis-router.manav32478.workers.dev/status`

---

## 9. Future Scope

From the blueprint Section 7: expose the platform as a paid SaaS (per-tenant pricing,
tiered plans), add SOC 2 compliance, offer carbon reporting to enterprise customers,
and expand the cloud pool beyond free tiers. The live platform + historical data are
the startup's first assets.

---

## 10. References

- Cloudflare Workers docs · Supabase docs · Open Policy Agent docs ·
  scikit-learn (IsolationForest) docs · Trivy & Checkov docs · k6 docs ·
  Provider pricing pages (Render, Vercel, Google Cloud Run, Oracle Cloud).
