# Aegis — Plan for Your 2 College Evaluations

Two reviews are standard for a 6-month major project. Here's exactly what to have ready,
what to demo, and what you'll likely be asked — for each evaluation.

---

## 🟢 EVALUATION 1 — "Foundations working" (typically end of Month 2–3)

**Goal of this review:** prove the core idea is real — 3 clouds, monitoring, failover —
and that you have proper engineering process (SRS, repo, CI/CD).

### Must have ready
- [ ] `docs/SRS.md` (printed or opened) + `docs/architecture.md`
- [ ] GitHub repo with the full folder structure + a Projects board (6 columns = 6 months)
- [ ] Live `/health` on **at least 1–2 clouds** (more is better)
- [ ] Docker image builds (`docker build` log screenshot)
- [ ] CI/CD pipeline passing (deploy.yml green on GitHub)
- [ ] **Working failover demo** — this is the wow moment
- [ ] Health monitor running, history accumulating in Supabase

### What to demo (3–4 minutes)
1. **The demo** (`node demo/server.js`, open :8080) — show 3 clouds UP, live latency chart.
2. Hit **"Run chaos test"** — one cloud goes red, the router instantly routes to another,
   traffic never stops. *This single demo sells the whole project.*
3. Show the **real cloud URLs** in the browser (each `/health` returns its own `cloud` name).
4. Show Supabase `health_checks` filling up + GitHub Actions monitor run history.
5. Show the SRS + architecture diagram (30 seconds, don't dwell).

### Likely questions (and quick answers)
- **"What is this project?"** → A self-healing multi-cloud platform: one app on 3 free tiers
  that fails over automatically when a cloud dies.
- **"Why 3 clouds?"** → Each free tier is individually unreliable; combined they give high
  availability at $0. Redundancy is the whole point.
- **"What have you actually built vs planned?"** → (Be honest.) "Month 1–3 is done: repo,
  SRS, the app, Docker, deployments, monitor, router. Months 4–6 (intelligence, API,
  dashboard) are scaffolded and next."
- **"Which cloud is the primary?"** → None — all three are equal; the router picks the
  healthiest one at any moment.

### If you're behind schedule (e.g. cloud accounts pending)
Demo the **local harness** (it's indistinguishable in spirit) + show the real Docker image
and 1 real cloud if you have it. Be upfront: "accounts are verified, deployments scheduled."
Reviewers reward honesty + the demo working.

---

## 🔴 EVALUATION 2 — "Full platform" (final review, end of Month 5–6)

**Goal of this review:** show a finished *product*, not a project — auth, API, docs,
intelligence, real numbers — and defend every decision.

### Must have ready
- [ ] All 3 clouds live + failover via the **Cloudflare Worker URL**
- [ ] Dashboard showing: status, latency, uptime, **cost**, **carbon**, **security score**, **risk flags**
- [ ] Auth + API keys working (demo: create a key, call `/api/status` with/without it)
- [ ] Live Swagger docs at `/api-docs`
- [ ] `npm test` passing (show the output)
- [ ] k6 load-test numbers (p95 latency, RPS)
- [ ] Security scans in CI (Trivy/Checkov green)
- [ ] ML job output: `risk_flags` written to Supabase
- [ ] `docs/final-report.md` (full) + demo video (3–5 min) + slides

### What to demo (5–6 minutes)
1. 30 s — problem statement (single cloud = single point of failure).
2. 60 s — architecture diagram walkthrough.
3. 90 s — **live chaos-button failover** through the real Worker URL.
4. 60 s — dashboard: cost savings math, carbon region picker, security score, ML risk flags.
5. 30 s — API: `curl` with/without key + Swagger UI.
6. 30 s — future scope (startup plan) → shows ambition.

### Viva / defense prep — questions you WILL get (with answers)

| Question | Answer |
|----------|--------|
| Why Cloudflare Workers, not DNS failover? | DNS TTL means failover takes minutes; a Worker retries other backends in **milliseconds** and can inspect health itself. |
| Why Isolation Forest, not a threshold? | A fixed latency threshold is wrong for all 3 clouds (different networks). Isolation Forest learns each cloud's *normal* pattern and flags deviations — it adapts. |
| Why OPA instead of if-statements? | Policies are decoupled from code — a non-developer can add a policy without touching the app; also auditable and versionable. |
| How do you know failover works? | Chaos tests: I force a cloud down and measure switch time + zero failed requests (show the logs/numbers). |
| What happens if ALL clouds are down? | Router returns 503 "All clouds are down" — graceful, monitored, and self-healing kicks in to redeploy. |
| How is this different from Kubernetes multi-cluster? | Kubernetes federation is heavy and *not free-tier friendly*; Aegis is app-level routing over serverless/VMs at $0. |
| Where's the ML value? | It flags clouds *before* they fail (rolling-latency anomalies), enabling proactive failover, not just reactive. |
| How do you keep it free? | Respect free-tier limits (documented), public repo for free Actions minutes, Worker cron instead of Actions cron. |
| What would you do with a budget? | [Blueprint Section 7: startup plan] |

### Common review-panel criticisms → your defense
- **"It's just a load balancer."** → No: a load balancer distributes load across healthy
  servers; Aegis adds *cross-provider* failover, *self-healing*, cost/carbon/policy/security
  *intelligence*, ML *prediction*, and a *multi-tenant API*. It's a platform, not a proxy.
- **"Free tiers are unreliable."** → Correct — and that's the insight: the *system* is
  reliable even though each *part* isn't. That's the engineering contribution.
- **"Why not use a real cloud provider's DR?"** → Vendor lock-in + cost. Aegis is portable
  across providers and costs $0, which matters for students/startups.

---

## Timeline summary

```
Month 1 ── accounts, repo, SRS, board
Month 2 ── app + Docker + 3 deploys + IaC + CI/CD        ┐
Month 3 ── monitor + router + self-heal                   ┘ → 🟢 EVAL 1
Month 4 ── cost, carbon, policy, security, ML
Month 5 ── auth, API, swagger, status page, load test     ┐
Month 6 ── tests, report, video, viva prep                ┘ → 🔴 EVAL 2
```
