# Aegis — Software Requirements Specification (SRS)

**Project:** Aegis — Self-Healing, Carbon-Aware Multi-Cloud Platform
**Course:** Major Project (B.E./B.Tech final year)
**Author(s):** [Your name(s)] · **Date:** August 2026
**Version:** 1.0

---

## 1. Introduction & Purpose

Cloud outages cost money. A single cloud provider is a single point of failure, and most
developers pick one vendor based on habit, not evidence. Aegis is a platform that runs one
application across **three cloud providers' free tiers**, continuously monitors their health,
**fails over automatically** when one becomes unhealthy, and adds an intelligence layer
(cost, carbon, policy compliance, security scanning, and ML-based *predictive* failover) on
top. The entire platform runs at **zero cost** using free tiers.

## 2. Scope

The system covers:
1. **Multi-cloud deployment** — the same containerized app on Google Cloud Run, Oracle Cloud (Always Free VM) and Render.
2. **Orchestration** — a health monitor, a global failover router (Cloudflare Worker), and self-healing (auto-redeploy).
3. **Intelligence** — cost estimation, carbon-aware region selection, policy-as-code (OPA), security scanning (Trivy/Checkov), and predictive failover (Isolation Forest).
4. **Multi-tenancy** — API-key-authenticated REST API + Swagger docs for third-party developers.
5. **Observability** — a React dashboard + a public status page with a live chaos-test button.

Out of scope: billing/payment processing, SLA guarantees, and running on paid tiers.

## 3. Functional Requirements

| ID | Module | Requirement |
|----|--------|-------------|
| FR-1 | App | The system shall expose a `GET /health` endpoint returning `{status, cloud, timestamp}` on every cloud. |
| FR-2 | Deployment | The same Docker image shall be deployable to all three clouds with no code changes (cloud name via env). |
| FR-3 | Monitoring | The system shall poll every cloud's `/health` at most every 5 minutes and store results historically. |
| FR-4 | Failover | The router shall route traffic to a healthy cloud and switch within one health-check when the active cloud fails. |
| FR-5 | Failover | If all clouds are unhealthy, the router shall return HTTP 503 with a clear message. |
| FR-6 | Self-healing | The system shall detect a cloud that fails 3 consecutive checks and trigger an automatic redeploy. |
| FR-7 | Cost | The system shall estimate monthly savings vs. a single paid cloud and display the calculation. |
| FR-8 | Carbon | The system shall retrieve (or fall back to) grid carbon intensity per region and identify the greenest region. |
| FR-9 | Policy | The system shall evaluate infrastructure plans against OPA policies and block violations in CI. |
| FR-10 | Security | The system shall scan the Docker image (Trivy) and IaC (Checkov) on every deployment. |
| FR-11 | Predictive | The system shall flag clouds whose latency pattern is anomalous (Isolation Forest) as "at-risk". |
| FR-12 | Auth | The API shall reject requests without a valid API key (hashed in storage). |
| FR-13 | Docs | The API shall serve interactive Swagger documentation at `/api-docs`. |
| FR-14 | Chaos | An authenticated user shall be able to trigger a controlled outage to demonstrate failover. |

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | Availability | Target ≥ 99.9% logical uptime across the three clouds combined. |
| NFR-2 | Failover speed | Router failover < 10 s (ideally < 1 s at the Worker layer). |
| NFR-3 | Cost | Total running cost = $0 (free tiers only). |
| NFR-4 | Security | Secrets never in code; least-privilege tokens; API keys stored as hashes. |
| NFR-5 | Maintainability | Modules independent (app, orchestration, intelligence, api, dashboard) and unit-tested. |
| NFR-6 | Observability | Health, latency, uptime, cost, and risk visible on a single dashboard. |

## 5. System Architecture

See `docs/architecture.md` for the 5-layer diagram and the ER diagram of the Supabase schema.

## 6. Assumptions & Constraints

- Free-tier limits of the three providers are respected; usage stays within them.
- Google Cloud and Oracle require card verification once (no charge within limits); a
  cardless fallback (Vercel/Netlify/Render) is documented in `docs/free-tier-notes.md`.
- GitHub repo is public so Actions minutes are free.

## 7. Acceptance Criteria

1. All three clouds serve `/health` with their own `cloud` name.
2. Killing one cloud does not interrupt traffic through the router.
3. Supabase accumulates health history; the ML job flags anomalies.
4. Dashboard shows live status, latency chart, cost savings, and risk flags.
5. `npm test` passes; load test produces latency/throughput numbers.
