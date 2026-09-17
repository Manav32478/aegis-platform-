# 📘 AEGIS — Master Guide
**Everything in one place: How to Run · What We Built · Future Scope · Evaluator Q&A**

---

# PART 1 — HOW TO RUN THE WHOLE PROJECT

## 0. Prerequisites (install once)
| Tool | Check | Get it from |
|------|-------|-------------|
| Node.js 20+ | `node -v` | https://nodejs.org (LTS) |
| Git | `git --version` | built into macOS |
| Python 3 | `python3 -V` | built into macOS |
| Wrangler | `wrangler -V` | `npm install -g wrangler` |
| Docker (optional) | `docker -v` | https://docs.docker.com/desktop |

---

## 1. The main dashboard ⭐ (your showcase — ONE page, no server needed)
```bash
cd ~/Desktop/aegis-platform
open dashboard.html
```
- Light theme by default · 🌙/☀️ toggle top-right.
- Sidebar: **Overview · Live monitoring · Intelligence · Failover demo · Developer API · Architecture · Roadmap**.
- Online → reads **live Supabase data** (uptime, latency chart, ML risk).
- The **Failover demo works fully offline** → click "Run chaos test".
- Live on the web too:
  - `https://aegis-router.manav32478.workers.dev/dashboard`
  - `https://aegis-platform-pomf.onrender.com/dashboard`

## 2. Local chaos demo (real server on :8080)
```bash
cd ~/Desktop/aegis-platform
chmod +x run-demo.sh      # first time only
./run-demo.sh             # or: bash run-demo.sh
# open http://localhost:8080
```

## 3. Core app locally
```bash
cd ~/Desktop/aegis-platform/app
npm install
CLOUD_NAME=local node index.js
# http://localhost:3000  ·  /health  ·  /status  ·  /dashboard
```

## 4. Health monitor
```bash
cd ~/Desktop/aegis-platform/orchestration
npm install
node monitor.js        # prints JSON of both clouds
# with Supabase (writes real data):
SUPABASE_URL=https://kagjbxxmdyaypfcqemem.supabase.co \
SUPABASE_KEY=sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti \
node monitor.js
```
> In production this runs automatically every 5 min (GitHub Action + Worker cron).

## 5. Multi-tenant API + Swagger
```bash
cd ~/Desktop/aegis-platform/api
npm install
node generate-key.js   # prints an ak_... key (save it)
node index.js          # http://localhost:4000
# open http://localhost:4000/api-docs
```
Auth test:
```bash
curl http://localhost:4000/api/status                                # 401
curl -H "x-api-key: WRONG" http://localhost:4000/api/status          # 403
curl -H "x-api-key: ak_..." http://localhost:4000/api/status         # 200
```

## 6. Intelligence modules
```bash
# Cost
cd ~/Desktop/aegis-platform/intelligence
node -e "console.log(require('./cost').estimateAegisSavings(1000000))"

# ML — demo (no data needed)
cd ~/Desktop/aegis-platform/intelligence/ml
pip3 install pandas scikit-learn
python3 predict.py --demo

# ML — real (reads your Supabase)
SUPABASE_URL=https://kagjbxxmdyaypfcqemem.supabase.co \
SUPABASE_KEY=sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti \
python3 predict.py
```

## 7. Tests
```bash
cd ~/Desktop/aegis-platform/tests
npm install && npm test    # 6/6 passing
```

## 8. Deploy changes
```bash
cd ~/Desktop/aegis-platform
git add . && git commit -m "update" && git push   # Render+Vercel auto-redeploy
# if router changed:
cd ~/Desktop/aegis-platform/orchestration/router && wrangler deploy
```

## 9. Live production URLs
| Thing | URL |
|-------|-----|
| Failover router | https://aegis-router.manav32478.workers.dev |
| Cloud #1 (Render) | https://aegis-platform-pomf.onrender.com |
| Cloud #2 (Vercel) | https://aegis-platform-lyart.vercel.app |
| Live status page | https://aegis-router.manav32478.workers.dev/status |
| Dashboard | https://aegis-router.manav32478.workers.dev/dashboard |
| GitHub repo | https://github.com/Manav32478/aegis-platform- |

---

# PART 2 — WHAT WE MADE & WHAT IT DOES

## One-line pitch
> Aegis runs **one app on multiple cloud free tiers**, monitors their health every
> 5 minutes, and **fails over automatically** when one dies — with cost, carbon,
> security and ML intelligence on top. **Total running cost: $0.**

## The problem it solves
A single cloud is a single point of failure. Free tiers are individually unreliable
(Render sleeps after 15 min idle), but together they're robust. Aegis treats clouds
as disposable and interchangeable resources.

## The 5 layers
| Layer | What | Where |
|-------|------|-------|
| 1. Clients | browsers, curl, apps hit ONE URL | — |
| 2. Edge | **Cloudflare Worker router** — health cache (10s), routes to healthiest cloud, retries in ms, 503 if all down; also a free cron monitor | `orchestration/router/` |
| 3. Compute | same Dockerized Express app on **Render + Vercel** (GCP/Oracle-ready); `/health`, `/status`, `/dashboard` | `app/` |
| 4. Data | **Supabase** — `health_checks`, `organizations`, `api_keys` (hashed), `risk_flags` | `infra/schema.sql` |
| 5. Intelligence & Access | cost, carbon, OPA policy, Trivy/Checkov, ML Isolation Forest, REST API + Swagger, dashboards | `intelligence/`, `api/`, `dashboard.html` |

## Key design decisions (defend these)
| Decision | Why |
|----------|-----|
| Cloudflare Workers, not DNS | DNS TTL = minutes; Worker retries in milliseconds |
| Isolation Forest, not a threshold | Learns each cloud's own normal latency; needs no labels |
| OPA, not if-statements | Policy is data, decoupled from code, auditable |
| Supabase | Free Postgres + auth; doubles as ML training data |
| Zero-dependency monitor | Plain fetch → works on Node 18/20/22 + GitHub Actions |

---

# PART 3 — FUTURE SCOPE

## 1. More clouds
- Add **Google Cloud Run** (2M req/mo free) + **Oracle Always Free** (4 OCPU/24 GB) — code is ready, just deploy `app/` and add URLs to the router.
- Add **Fly.io** / **Koyeb** free tiers for 4th/5th cloud.

## 2. Better failover & healing
- Sticky sessions; canary deployments; circuit breakers with backoff.
- Auto-redeploy on *latency*, not just failures.

## 3. Smarter intelligence
- Train on error-rate + uptime windows, not just latency.
- Forecasting (Prophet/ARIMA) to pre-warm clouds.
- Live carbon routing (Electricity Maps key — already scaffolded).
- Alerting (email/WhatsApp/webhook) on outage or risk flags.

## 4. Product / SaaS
- User dashboard, sign-up, per-tenant quotas, billing tiers.
- Custom-domain public status page (marketing asset).
- SOC 2 hardening: key creation behind a service_role Edge Function, rate limiting, audit logs.

## 5. Engineering maturity
- Full multi-cloud Terraform/OpenTofu; e2e tests (Playwright); Grafana observability; k6 in CI.

## 6. Research-flavoured (impress the panel)
- Scheduled chaos tests → monthly **"resilience score"**.
- **Cost vs carbon trade-off chart** (Pareto front).
- **SLA modelling**: predicted vs measured uptime.

---

# PART 4 — EVALUATOR Q&A (42 questions + rapid fire)

## Round 1 — Opening
**Q1. Tell me about your project.**
> Aegis is a self-healing multi-cloud platform. One app runs on multiple free-tier
> clouds — Render and Vercel live — monitored every 5 minutes, with automatic failover
> through a Cloudflare Worker. On top sits an intelligence layer: cost, carbon, OPA
> policy, security scanning, and ML predictive failover. It's multi-tenant with a hashed
> API-key auth. Total cost: $0.

**Q2. Why this topic?**
> Every developer defaults to one cloud — a single point of failure. Free tiers are
> plentiful but each is unreliable alone. The engineering question: can I combine
> unreliable free tiers into one system more reliable than a single paid instance?

**Q3. What did YOU build?**
> Everything: app, Docker, deployments, monitor, Worker router, schema, cost/carbon/OPA
> modules, ML model, API, dashboards. Tools are open source; the integration and
> failover logic are my own.

**Q4. Is it real or a simulation?**
> Real. Two live clouds, real data in Supabase every 5 min, real API auth, real router.
> There's also a local simulation for the failover demo, but production is live.

## Round 2 — Architecture
**Q5. Draw and explain the architecture.**
> 5 layers: clients → Cloudflare Worker (router + monitor) → clouds (same app) →
> Supabase → intelligence/access. Every request hits the Worker; the Worker health-checks
> clouds; the monitor records results every 5 min.

**⭐ Q6. Why Workers, not DNS failover?**
> DNS is TTL-bound — clients cache old IPs, failover takes minutes. A Worker retries the
> next healthy cloud in milliseconds and can inspect/modify requests.

**Q7. Why not a load balancer?**
> An LB works within one provider. Aegis works across providers, self-heals, and adds
> intelligence + multi-tenant API. It's a platform, not a proxy — and it's $0.

**Q8. How does the Worker know a cloud is healthy?**
> In-memory health cache (10s TTL), fetched via /health with 2s timeouts. Routes to the
> fastest healthy cloud; retries next on failure.

**Q9. All clouds down?**
> Router returns 503. Monitor keeps checking; self-heal redeploys a cloud after 3 failures.

**Q10. Worker itself fails?**
> Workers run on Cloudflare's replicated global edge — the clouds behind it are the
> variable part, which is what I designed around.

## Round 3 — Failover
**⭐ Q11. Walk me through a failover.**
> User hits router → router picks healthiest (Render) → proxies. Render dies → next
> health check marks it unhealthy → new requests go to Vercel instantly → monitor logs
> the failure → after 3 failures it auto-redeploys → Render rejoins when healthy.

**Q12. How fast?**
> Milliseconds to ~2s — bounded by cache TTL and timeout. That's the edge-router advantage.

**Q13. Proof?**
> Chaos tests: suspend Render → router serves Vercel immediately. Live history shows the
> outage window. Render even showed 80% uptime due to idle sleep — the system stayed up.

**Q14. Session state?**
> My app is stateless, so switching is safe. For stateful apps: sticky sessions or shared
> store — noted as future work.

## Round 4 — Monitoring & data
**Q15. Why monitor every 5 min?**
> Frequent enough to catch outages early, cheap enough for free tiers.

**Q16. Why Supabase?**
> Free hosted Postgres + REST + auth. REST meant my monitor used plain fetch — which
> avoided a Node-version crash I actually hit and fixed. History doubles as ML data.

**Q17. Schema?**
> health_checks, organizations, api_keys (SHA-256 hashes), risk_flags. RLS policies allow
> monitor writes + dashboard reads.

**Q18. Why store latency, not just up/down?**
> Latency trends are the early-warning signal — a slowing cloud is about to fail.

## Round 5 — ML
**⭐ Q19. Explain your ML model.**
> Isolation Forest, unsupervised. Rolling average latency per cloud as the feature, so
> each cloud is judged against its own normal. Anomalous checks get risk_score −1; a
> cloud with an anomaly in its last 3 checks is flagged → risk_flags → dashboard.

**⭐ Q20. Why Isolation Forest, not a threshold?**
> A fixed threshold is wrong for heterogeneous clouds. Isolation Forest learns each
> cloud's distribution and flags deviations — and it's unsupervised, so no labelled
> failure data needed.

**Q21. How do you know it works?**
> Demo mode: one degrading cloud is flagged, stable ones stay healthy. Real mode reads my
> live Supabase; it defers until enough history — honest behaviour, not a failure.

**Q22. Better features?**
> Error rate, uptime windows, latency trend. Forecasting next.

**Q23. What's contamination=0.05?**
> The prior for the expected fraction of anomalies (5%) — controls model aggressiveness.

## Round 6 — Security & policy
**Q24. Security measures?**
> Trivy (container) + Checkov (IaC) in CI on every push; OPA policy gates; API keys
> stored as SHA-256 hashes.

**Q25. Why OPA not if-statements?**
> Policy is data, decoupled from code, versioned, auditable; CI fails builds on violation.

**Q26. Anon key in frontend — a hole?**
> The anon key is designed to be public and is RLS-restricted. service_role is never in
> the frontend. Production would move key creation to an Edge Function + rate limiting.

**Q27. How are keys stored?**
> SHA-256 hashed in api_keys; plaintext shown once; incoming keys hashed and compared.

## Round 7 — Multi-tenancy & API
**Q28. Why multi-tenant?**
> So other developers can query status/cost/risk — that's the step from project to product.

**Q29. Show the API.**
> Swagger at /api-docs: /api/status, /api/cost-report, /api/risk, /api/security-score.
> All need x-api-key: 401 without, 403 wrong, 200 valid.

**Q30. How would another dev use it?**
> generate-key.js → get a key → hit endpoints. Same pattern as Stripe/GitHub.

## Round 8 — Cost & free tier
**⭐ Q31. Really $0? How?**
> Render/Vercel/Supabase/Workers/Actions all free. Public repo → unlimited Actions
> minutes; Worker cron avoids Actions minutes entirely. GCP/Oracle need card verification
> only (still $0) and are optional.

**Q32. Where's $40 from?**
> Illustrative reference ($40/1M requests) hardcoded in cost.js, shown transparently.
> I can swap a real cited rate for the report.

**Q33. Free-tier-only: gimmick?**
> A real constraint that shaped the design — engineering around sleeps/limits is the
> challenge. The monitor doubling as Render's keep-alive is a concrete example.

## Round 9 — Testing
**Q34. What testing?**
> Jest 6/6 (cost math + monitor aggregation); API 401/403/200 verified; hash-match
> verified; live monitor + failover tested; security scans in CI; k6 load script ready.

**Q35. Why test intelligence, not getters?**
> Bugs matter in business logic, not trivial getters — that's what a committee cares about.

**Q36. Show a test run.**
> cd tests && npm test — 6 passing.

## Round 10 — Critical / comparison
**⭐ Q37. "It's just a load balancer."**
> An LB spreads load within one platform. Aegis adds cross-provider failover,
> self-healing, cost/carbon/policy/security intelligence, ML prediction, and a
> multi-tenant API — that's a platform.

**Q38. Why not managed DR?**
> Cost + lock-in. Aegis is portable and $0.

**Q39. Why not Kubernetes multi-cluster?**
> Heavy, not free-tier friendly. App-level edge routing fits this scale.

**Q40. Biggest weakness?**
> Free-tier limits themselves (sleeps, cold starts) — mitigated with keep-alive, but
> production needs paid instances; architecture unchanged.

**Q41. Money + a month?**
> Add GCP+Oracle clouds, secure Edge Function for keys, alerting, continuous chaos tests
> → resilience score, then SaaS layer.

**Q42. What would you do differently?**
> Start collecting health data earlier (ML needs history); put key generation behind
> service_role from day one.

## Round 11 — Rapid fire
- **Failover SLA?** sub-5s detection, sub-second routing.
- **Capacity?** bounded by free tiers; k6 will give exact numbers.
- **Encrypted?** HTTPS everywhere; Supabase at rest; keys hashed.
- **Supabase down?** monitoring stops, routing keeps working — decoupled by design.
- **Primary cloud?** none — all equal, router picks healthiest.
- **Why Express?** ubiquitous, thin app; the value is orchestration, not the framework.
- **Production-ready?** a working prototype; needs paid tiers, rate limiting, hardened auth.

## Round 12 — "Show me"
| They say | You do |
|----------|--------|
| failover | dashboard.html → Failover demo → chaos |
| live clouds | open the two /health URLs |
| API | cd api && node index.js → /api-docs |
| ML | predict.py --demo |
| tests | npm test |
| data | Supabase → Table Editor → health_checks |
| security | GitHub → Actions → Security scan |

## The 5 answers to memorize
1. **What:** one app, multiple free-tier clouds, automatic failover, $0.
2. **Why Workers:** milliseconds, not DNS minutes.
3. **Why Isolation Forest:** adapts per cloud, no labels.
4. **Why OPA:** policy decoupled from code.
5. **Is it real:** yes — two live clouds, real data, real auth, here are the URLs.
