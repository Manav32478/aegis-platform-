# ⚔️ Aegis — Self-Healing Multi-Cloud Platform

A 6-month college major project: a platform that runs one app across **3 cloud free tiers**, monitors their health, **fails over automatically** when one dies, and layers on cost, carbon, policy, security and predictive (ML) intelligence.

**The whole thing runs on free tiers — $0 cost.**

> 🎛️ **ONE thing to run — `dashboard.html`.** Double-click it and EVERYTHING is there:
> live status, monitoring charts, cost/carbon/security intelligence, a **failover demo**,
> a **live ML Lab** (a real in-browser Isolation Forest), an **API explorer**, the
> **test suite running live (6/6)**, architecture and roadmap. No terminals, no installs.
> Optional: `./start.sh` (or `start.bat`) also boots the API + app servers so the API
> section answers live. Live on the web at
> `https://aegis-router.manav32478.workers.dev/dashboard`.

---

## Try the demo right now (no accounts, no install)

```bash
node demo/server.js
# open http://localhost:8080
```

This spins up 3 simulated clouds + the failover router + health monitor + a live dashboard, all in one process. Click **"Run chaos test"** to watch failover happen live. This is exactly what you show at **Evaluation 1**.

> The demo is 100% self-contained (plain Node, no `npm install`). The "real" deployable pieces live in the folders below and mirror the same contracts.

---

## Repo structure

```
aegis-platform/
├── app/                  # core app (Express) — deployed to 3 clouds   [Month 2]
├── infra/                # OpenTofu IaC (Cloudflare)                    [Month 2]
├── orchestration/        # health monitor + failover router (Worker)   [Month 3]
├── intelligence/         # cost, carbon, policy, security, ML           [Month 4]
├── api/                  # multi-tenant API + Swagger docs              [Month 5]
├── dashboard/            # React frontend (Vite)                        [Month 5]
├── tests/                # Jest unit tests + k6 load test               [Month 6]
├── docs/                 # SRS, architecture, final report, eval plan
├── demo/                 # zero-account local demo harness
└── .github/workflows/    # CI/CD pipelines
```

---

## Quickstart (real deployments, in order)

| Month | What | Where |
|-------|------|-------|
| 1 | Accounts + repo + SRS + board | `docs/SRS.md`, `docs/architecture.md` |
| 2 | App + Docker + 3 cloud deploys + IaC + CI/CD | `app/`, `infra/`, `.github/workflows/deploy.yml` |
| 3 | Health monitor + failover router + self-heal | `orchestration/` |
| 4 | Cost / carbon / policy / security / ML | `intelligence/` |
| 5 | Auth + API keys + Swagger + status page + load test | `api/`, `dashboard/`, `tests/load-test.js` |
| 6 | Tests + final report + demo video + viva prep | `tests/`, `docs/final-report.md` |

**Local dev quickstart:**

```bash
cd app && npm install && CLOUD_NAME=local node index.js      # core app on :3000
cd orchestration && npm install && node monitor.js           # monitor (prints JSON w/o Supabase)
cd dashboard && npm install && npm run dev                   # React dashboard
cd tests && npm install && npm test                          # unit tests
```

---

## The two college evaluations

Everything is mapped to your 2 reviews in **`docs/EVALUATION_PLAN.md`** — including demo scripts, evidence lists, and likely viva questions with answers. Read that file first.

## What I still need from you

Accounts, keys and URLs I cannot create for you (they need your email/phone/card) — full checklist in **`docs/WHAT_I_NEED.md`**.

## Free-tier gotchas (read before Month 2)

See **`docs/free-tier-notes.md`**. The big ones:
- **GCP & Oracle need a card for verification** (you are *not charged* inside free limits). If you can't use a card, I included a cardless 3-cloud fallback (Render + Vercel + Netlify).
- **GitHub Actions 5-min cron** can burn your free 2,000 min/month on a *private* repo. Fix: keep the repo **public** (free, unlimited), or use the included **Cloudflare Worker cron** (`orchestration/router/src/worker.js`).
- **Render free web services sleep after ~15 min idle** — your own monitor will keep waking it, but expect a ~50s cold start sometimes. Good for failover demos, annoying for uptime charts.
