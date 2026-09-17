# Aegis — Future Scope & Roadmap

This is the "where can this go next?" document for the final report and viva.
Everything here is realistic, free-tier-first, and buildable by the same person
who built the current platform.

---

## 1 · Already shipped (v2)

- Multi-region monitoring (Cloudflare edge + GitHub + Oracle VM vantage points)
- Health scoring, latency percentiles (p50–p99), error rates
- Predictive anomaly detection (rolling-statistics + Isolation Forest)
- Smart routing + automated self-healing (redeploy via GitHub Actions)
- Alerting (Slack/webhook/email) + daily/weekly reports
- Multi-tenant API (key auth, rate limiting, audit log, Swagger)
- Professional portal (landing, dashboard, public status, admin)
- Security scans in CI (Trivy, Checkov, OPA/Rego)
- 26 unit tests + provisioning docs + Oracle VM guide

---

## 2 · Short-term enhancements (next 1–2 months)

| Feature | Why | Free path |
|---|---|---|
| Supabase Auth login for the admin page | real users + roles instead of a shared token | Supabase free (50k MAU) |
| Synthetic transaction checks (login → dashboard → write) | catches "up but broken" clouds | extend `monitor.js` |
| TLS expiry + certificate monitoring for each cloud | proactive, not reactive | Node `tls` module, no deps |
| CSV/PDF report export | shareable evidence for evaluators | pdfkit / node CSV libs |
| Grafana or a self-hosted chart on the Oracle VM | a "real observability" story | Grafana OSS on the VM |

---

## 3 · Medium-term (next 3–6 months)

| Feature | Why | Notes |
|---|---|---|
| Move all Supabase writes behind an **Edge Function** with `service_role` | close the demo-mode RLS gap (real tenancy) | free edge-function invocations |
| **Auto-scaling rehearsal** — simulate load (k6) and watch failover | performance evidence | k6 OSS on the VM |
| **Cost-per-request telemetry** — measure real egress/CPU on each cloud | turn the $ estimate into measured data | provider billing APIs |
| **Multi-tenant dashboards** — each API customer sees only their clouds | make it a SaaS | per-org RLS policies |
| **Chaos engineering button** — click to kill a cloud and watch it recover | killer demo + report chapter | exists as `demo/`; wire it to real redeploy |

---

## 4 · Long-term "wow" scope

| Idea | One-line pitch |
|---|---|
| **ML-first failover** | Train a model on *all* tenants' history; predict outages, pre-warm the backup cloud *before* the failure |
| **Global anycast shadow routing** | Every request mirrored to a shadow cloud; response compared for correctness, not just liveness |
| **Carbon-aware auto-scaling** | Shift batch jobs to the greenest region hour-by-hour using live grid data (Electricity Maps) |
| **Compliance pack** | SOC2-style control mapping + evidence export (logs, incidents, change history) from the audit log |
| **Open-source release** | Publish as a self-hostable OSS with a one-command installer |

---

## 5 · Honest limitations (say these in the viva — it scores points)

1. **Free tiers sleep** — Render sleeps after idle; the platform treats cold
   starts as real failover events. That's acceptable for a project demo.
2. **Single-tenant, demo-grade auth** — production would move key creation
   behind a Supabase Edge Function with `service_role` + add refresh/revoke.
3. **In-memory rate limiting** — resets per process; production would use
   Redis/Upstash (has a free tier).
4. **Illustrative cost baseline** ($40/million) — measured provider APIs would
   replace the estimate.
5. **Two of three clouds deployed** — GCP Cloud Run / Oracle are documented and
   provisioned-as-optional; adding them is a follow-the-guide task.
