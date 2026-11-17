# How to Explain the Aegis Project to Faculty

> A plain-English guide for **you, the student**, to confidently explain the
> whole project in a viva / demo — from a 1-line answer up to a 10-minute
> deep-dive. Practice the short versions out loud until they're natural.
>
> Important: do not quote old sample metrics as current. On 2026-11-12 the
> deployed portal reported Supabase URL errors and the configured Vercel origin
> returned 404. Use `/api/diagnostics` and direct `/health` responses for fresh,
> verified values before presenting.

---

## 1 · The whole project in ONE line

> **"Aegis is a multi-cloud resilience prototype: it monitors application
> origins from outside the app fleet, records health history, provides an edge
> routing path and a dashboard, and helps operators investigate failures."**

Then describe which origins are actually deployed and which behaviours have
been tested. Do not promise zero downtime, score-aware routing, or zero cost.

---

## 2 · The 30-second version (opening question: "What is your project?")

> "A single hosting provider can become a single point of failure. Aegis is my
> multi-cloud resilience prototype. It has a Render application origin, a
> Cloudflare Worker router, a Supabase health-history database, a monitoring
> workflow, and a dashboard with health and anomaly indicators. The system is
> designed to support a second application origin and failover; I distinguish
> the design from what I have currently deployed and verified. Today the
> configured Vercel app origin is returning 404, and I am correcting that before
> claiming two-origin failover. The cost and ML panels are estimates/signals,
> not service-level guarantees."

---

## 3 · The 2-minute version (the structured walkthrough)

Use this 5-part story — it follows the slides in `EVAL2_PRESENTATION.pptx`:

**1) The problem** — one cloud = a single point of failure. Free tiers are
individually unreliable. Commercial multi-cloud tools are expensive.

**2) The idea** — run one app on three free clouds; monitor them from the
outside; route to the healthiest; heal the broken one.

**3) How it measures health** — scheduled checks call each configured `/health`
endpoint and record latency/status in Supabase. The portal can also perform
on-demand probes. From collected rows it calculates uptime, latency percentiles,
error rate, and a project-defined health score. These values are indicators, not
an external SLA.

**4) How failover is designed** — the Worker checks configured origins and
proxies to an available one. The current Worker uses configured order among
healthy targets; the dashboard score is not yet connected to Worker routing.
Incident alerts and automatic redeploy dispatch require their secrets/hooks to
be configured and tested. Describe those as integration paths until verified.

**5) What else makes it a platform** — advisory anomaly detection, estimated
cost/carbon views, security-workflow examples, an API, reports, and a portal.
Be clear that data and features depend on correctly configured Supabase access
and active origin URLs.

---

## 4 · A truthful 5-minute walkthrough

1. Start locally: `bash start.sh`; open `http://localhost:3100/dashboard.html`.
2. Show **Diagnostics** first. It reports the Supabase row count, target source,
   and unhealthy target URLs. Explain any warning rather than hiding it.
3. Show **Real-time probes**. These are portal-originated probes; compare their
   URLs/status with direct browser tabs for each origin.
4. Show Supabase `health_checks` and GitHub Actions `Health monitor` runs as
   evidence of scheduled checks.
5. Show scores and charts as calculations over recorded history. State that the
   displayed SLA target is a comparison, not a service guarantee.
6. Show `/api/serving` or the Worker `/router/health` endpoint for router state.
7. Show incidents/alerts only as actual records; do not invent a failure event.
8. Show GitHub Actions and report actual run status. The latest CI state may not
   be green; local tests currently pass 37/37.

---

## 5 · How to demonstrate failover safely

**Do not suspend the live Render service during a client demo without approval.**
First deploy the same protected app to a live Vercel origin, update the database
and Worker targets, and verify both `/health` endpoints return HTTP 200.

Then use a staging copy:
1. Query `https://aegis-router.manav32478.workers.dev/router/health` and record
   each target's health.
2. Suspend the staging origin that the router is currently using.
3. Re-query router diagnostics and request the app through the Worker.
4. Confirm the response identifies the alternate origin and the application
   page still loads; inspect the incident/alert rows.
5. Restore the staging origin and verify recovery.

Until this controlled test passes, describe the Worker as a deployed routing
prototype—not as verified zero-downtime failover. The local chaos demo is a
simulation and should be labeled as such.

---

## 6 · The 10 most likely questions (with answers)

Give short answers first, expand only if they nod for more.

| Q | Answer |
|---|---|
| **Why three clouds?** | No single point of failure. Free tiers are individually unreliable, but three together are more reliable than one paid instance — cheap redundancy. |
| **How does routing decide where traffic goes?** | Health score first (uptime·0.5 + latency·0.3 + error·0.2), ties broken by lowest latency, then by lowest carbon intensity. |
| **Why can't the monitor live on the same cloud it watches?** | It would go blind exactly when that cloud dies. The monitor must live *outside* — that's why I use Cloudflare, GitHub, and an Oracle VM as three independent vantage points. |
| **What is the health score, exactly?** | 0–100 composite: 50% uptime, 30% latency score, 20% error-rate inverse. ≥90 Excellent, ≥70 Good, ≥50 At-risk, below Critical. |
| **How does self-healing actually work?** | Monitor detects N consecutive failures → opens an incident in Supabase → sends an alert → calls the GitHub deploy API (deploy hook) to redeploy the cloud → re-probes and closes the incident with downtime duration. |
| **Where's the ML?** | Two detectors: Isolation Forest in Python (runs daily in CI on Supabase history) and a rolling median+z-score detector in JS (runs live in the dashboard). Both flag a cloud whose latency deviates from its own normal pattern — before it fails. |
| **How is it secured?** | API keys stored hashed (SHA-256), per-key rate limiting, audit log of every call, Trivy + Checkov + OPA/Rego scans in CI. Demo mode uses Supabase RLS; production hardening documented. |
| **How do you know it costs ₹0?** | Render free (750 instance-hours), Vercel Hobby (100 GB), Cloud Run free (2M requests/mo), Cloudflare Workers free tier, Supabase free, GitHub Actions free on public repos. All within limits. |
| **What are the limitations?** | Two of three clouds deployed so far (GCP/Oracle are provisioned as optional); demo-grade auth; in-memory rate limiting; the $40/million baseline is illustrative. |
| **What would you improve next?** | Move writes behind a Supabase Edge Function using the service_role key; Supabase Auth login; synthetic transaction checks; k6 chaos rehearsal; publish it as open source. |

---

## 7 · Phrases that score points (use them)

- "The monitor lives **outside** the fleet it watches — that's the key design decision."
- "Empty incident log is the **good** outcome — it means everything is healthy."
- "I measure in **percentiles**, not averages, so one slow request doesn't hide in the mean."
- "The whole platform is **free-tier native** — it's designed to fit the free limits, not just living on them."
- "I store the **decision**, not just the data — every failover and heal is recorded for audit."

## 8 · What to avoid saying

- ❌ "It's just a monitoring dashboard." → it's **monitoring + routing + healing + ML + API + security**.
- ❌ "Render is down sometimes" (complain) → say **"Render's free tier sleeps when idle — I treat that as a real failover event, which is actually the proof the system works."**
- ❌ Over-claiming "production-ready SaaS." → say **"it's a complete prototype with documented production hardening steps."**
- ❌ Mentioning the DB password / service_role key anywhere. Never.

---

## 9 · The 3 numbers to memorise (fall back on these under pressure)

1. **5 minutes** — scheduled monitoring interval (plus portal on-demand probes)
2. **0–100** — project-defined health indicator (uptime·0.5 + latency·0.3 + error·0.2)
3. **37 tests** — current local suite across 10 suites

Describe free-tier cost as a target/estimate, not a guaranteed ₹0 bill. If a
question surprises you, state what you verified and what remains to configure.
