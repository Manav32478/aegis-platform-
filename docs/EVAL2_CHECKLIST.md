# Aegis — Evaluation Day Checklist (final review)

> One page. Follow top-to-bottom on the day of your evaluation.
> Everything below is already built and verified — these are just the "show it"
> steps. Nothing here costs money.

---

## THE NIGHT BEFORE (10 min)

- [ ] **Charge the Mac**, plug it in during the demo.
- [ ] Open Terminal once: `cd ~/Desktop/aegis-platform && ./start.sh`
  → portal opens. Keep it running; it auto-refreshes every 10 s.
- [ ] Open 2 tabs kept ready:
  - `http://localhost:3100/dashboard.html`  ← the live dashboard
  - `https://aegis-router.manav32478.workers.dev/health`  ← live failover router
- [ ] Make sure Render is AWAKE: open
  `https://aegis-platform-pomf.onrender.com/health` once (free tier sleeps after ~15 min idle).
- [ ] Print / keep handy: `docs/final-report.md` and `docs/EVAL2_PRESENTATION.pptx`.
- [ ] 📵 Do NOT redeploy or change anything after this — leave the system stable.

---

## 45 MIN BEFORE

- [ ] Open `docs/VIVA_QA.md` and skim the first 10 Q&As.
- [ ] Practice the **60-second pitch** (below) out loud twice.
- [ ] Practice the **3 numbers** you must know cold:
  - **5 min** — how often the platform probes each cloud
  - **0–100** — the health score scale (uptime + latency + error rate)
  - **₹0/month** — total running cost

---

## DURING THE DEMO (show these screens, in order)

1. **Live dashboard** → KPI strip + real-time probes (clouds being checked live)
2. **Health scores** → "Render 85/Good vs Vercel 93/Excellent → traffic routes to Vercel"
3. **Live event feed** → "this updates every 10 seconds without refreshing — Server-Sent Events"
4. **Incidents + Alerts** → "if a cloud goes down, it gets logged and alerted here"
5. **Failover proof** → router `/health` + explain:
   *"kill Render now and the router reroutes within seconds"*
   (only do this if the external is comfortable with a 30-second hiccup)
6. **GitHub** → Actions tab → show the green test run (30/30) + deploy pipeline
7. **Supabase** → SQL Editor → show the 10 tables (evidence the data is real)
8. **Cost + carbon** → "₹0/month vs ~$40 for one paid cloud + 12-month forecast"

---

## THE 60-SECOND PITCH (memorize this)

> "Aegis is a self-healing multi-cloud platform. It runs the same application
> on three free-tier clouds — Render, Vercel, and Cloud Run — and continuously
> monitors each one every five minutes from outside, using Cloudflare Workers,
> GitHub Actions, and an Oracle VM. It gives every cloud a health score from
> zero to a hundred based on uptime, latency, and error rate, then routes all
> traffic to the healthiest cloud. If a cloud fails, Aegis logs an incident,
> sends an alert, and redeploys the broken cloud automatically. On top of that
> there's predictive anomaly detection, cost forecasting, carbon-aware routing,
> security scanning, and a multi-tenant API with keys and rate limiting.
> The whole platform runs at a cost of zero rupees per month."

---

## LIKELY VIVA QUESTIONS (answers live in VIVA_QA.md, short versions here)

| Question | 1-line answer |
|---|---|
| Why three clouds? | No single point of failure; free tiers are individually unreliable |
| How does routing decide? | Health score (uptime·0.5 + latency·0.3 + error·0.2), ties → latency → carbon |
| Why can't the monitor live on one of the clouds? | It would go blind exactly when that cloud dies — monitors live OUTSIDE |
| What's the health score math? | 0.5·uptime + 0.3·latency-score + 0.2·(1−error-rate) |
| How does self-healing work? | N consecutive failures → GitHub Actions redeploys via deploy hook |
| How is the API secured? | Hashed keys (SHA-256), rate limiting, audit log |
| ML part? | Isolation Forest (Python) + rolling z-score detector (JS) flag degrading clouds |
| Cost proof? | All three free tiers cover the load; Cloud Run would be $0.40/million beyond 2M |
| What would you do differently? | Move writes behind Supabase Edge Functions (service_role), add Redis rate limiting |

---

## AFTER THE DEMO

- [ ] Push any last screenshots into `docs/` if you added them.
- [ ] If evaluators asked anything you couldn't answer, note it — fix + redeploy.
- [ ] Celebrate. 🎉

---

## EMERGENCY FIXES (only if something breaks)

| Symptom | Fix |
|---|---|
| Dashboard shows "no data" | `cd ~/Desktop/aegis-platform/orchestration && node monitor.js` |
| Render DOWN (morning) | It's the free-tier sleep — open `/health` once to wake it, then explain it as a real failover demo |
| `./start.sh` permission denied | `bash start.sh` |
| Portal shows offline | restart: `cd ~/Desktop/aegis-platform/web && node server.js` |
| Need internet-free backup demo | Open `demo/server.js` → `localhost:8080` (offline chaos demo) |
