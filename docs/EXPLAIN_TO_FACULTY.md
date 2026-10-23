# How to Explain the Aegis Project to Faculty

> A plain-English guide for **you, the student**, to confidently explain the
> whole project in a viva / demo — from a 1-line answer up to a 10-minute
> deep-dive. Practice the short versions out loud until they're natural.
>
> Your real numbers today (to quote): **882 health checks**, **Vercel 100%
> uptime / 257 ms**, **Render 98% uptime / 457 ms**, total cost **₹0/month**.

---

## 1 · The whole project in ONE line

> **"Aegis is a self-healing multi-cloud platform: it runs one small app on
> three free-tier clouds, watches all of them every 5 minutes from outside,
> scores each one's health, sends traffic to the healthiest, and automatically
> re-deploys any cloud that fails — all at zero cost."**

Memorise this. Every other explanation is just expanding it.

---

## 2 · The 30-second version (opening question: "What is your project?")

> "Most apps run on a single cloud. If that cloud has an outage, the app goes
> down and there's nothing you can do. Free clouds are cheap but unreliable —
> Render sleeps after 15 minutes of no traffic, for example.
>
> My project, Aegis, treats clouds as **interchangeable and disposable**. I run
> the same small app on Render, Vercel, and Cloud Run. A monitoring system that
> lives **outside** these clouds — on Cloudflare Workers, GitHub Actions, and an
> Oracle VM — checks each cloud every 5 minutes. It converts uptime, latency,
> and error rate into a single health score from 0 to 100, and a router always
> sends traffic to the highest-scoring cloud. If a cloud fails several checks in
> a row, Aegis logs an incident, sends an alert, and **redeploys that cloud
> automatically**. The entire system runs inside free tiers — zero rupees."

---

## 3 · The 2-minute version (the structured walkthrough)

Use this 5-part story — it follows the slides in `EVAL2_PRESENTATION.pptx`:

**1) The problem** — one cloud = a single point of failure. Free tiers are
individually unreliable. Commercial multi-cloud tools are expensive.

**2) The idea** — run one app on three free clouds; monitor them from the
outside; route to the healthiest; heal the broken one.

**3) How it measures health** — every 5 minutes each cloud's `/health`
endpoint is called (with latency timing). History lands in Supabase (Postgres).
From that, I compute per cloud:
- **uptime %**
- **latency percentiles** (p50 / p90 / p95 / p99)
- **error rate**
- a single **health score = 0.5 × uptime + 0.3 × latency-score + 0.2 × (1 − error-rate)**

**4) How it heals** — the score decides routing. If a cloud fails 3 checks in
a row, the monitor opens an incident, sends an alert (Slack/webhook), and
dispatches a GitHub Actions redeploy of that cloud. When it recovers, the
incident is closed with its downtime duration recorded.

**5) What else makes it a "platform"** — predictive anomaly detection (ML),
cost forecasting, carbon-aware routing, security scanning in CI, a multi-tenant
API with API keys + rate limiting + audit log, automated health reports, and a
real-time dashboard that updates every 10 seconds over Server-Sent Events.

---

## 4 · The 10-minute deep-dive (if they ask "show me everything")

Walk through these **in this order** and you cannot get lost:

1. **Open the live dashboard** (`./start.sh` → `http://localhost:3100/dashboard.html`)
   - KPI strip → explain the 4 headline numbers.
   - **Real-time probes** → "this is the platform checking each cloud *right
     now*, every 10 seconds — it's not a screenshot."
   - **Live event feed** → "probes and routing decisions scrolling in real
     time via Server-Sent Events, no page refresh."
2. **Health score cards** → point at Vercel (93/Excellent) vs Render (85/Good)
   and say: *"so right now traffic would go to Vercel."*
3. **Latency + uptime charts** → the 99.9% SLA line; Render's slightly lower
   uptime is the free-tier cold-start doing its thing.
4. **Intelligence cards** → predictive risk, routing decision, SLA compliance.
5. **Cost + carbon** → ₹0/month vs a paid single cloud; carbon table.
6. **Incidents / alerts / failover** → even if empty, say *"these stay empty
   because both clouds are healthy — empty is the good outcome; here's what it
   looks like when something fails…"* (then explain the flow).
7. **Status badges + export** → show the embeddable SVG badge + CSV export.
8. **GitHub** → Actions tab: the green test run (30/30) and the deploy pipeline.
9. **Supabase** → SQL Editor: show the real tables holding the 882 checks.

---

## 5 · How to demo the "self-healing" live

The most convincing thing in the whole project. Two options:

**Safe (recommended):** explain it, then show the *evidence* — the failover
events table, the incidents table, and the router's `/health`. No risk.

**Dramatic (only if you've rehearsed and have time):**
1. Open `https://aegis-platform-pomf.onrender.com` in a tab.
2. In Render dashboard, **pause/suspend** the service (or just wait for a free
   sleep), or temporarily stop the Render service.
3. Watch the dashboard: within ~10 seconds the probe for Render flips to **DOWN**,
   an incident opens, and the event feed logs it.
4. Say: *"the router has already moved traffic to Vercel — users never noticed."*
5. Re-enable Render → watch it flip back to UP and the incident close with a
   recorded downtime duration.

> If you don't want to touch Render: the offline chaos demo at
> `node demo/server.js` → `localhost:8080` simulates the same failover safely.

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

1. **5 minutes** — probe interval (plus 10-second live probes in the UI)
2. **0–100** — the health score (uptime·0.5 + latency·0.3 + error·0.2)
3. **₹0/month** — total running cost

If a question scares you, return to one of these three and build outward.
