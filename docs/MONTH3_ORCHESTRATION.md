# 🚀 Month 3 — Orchestration Layer (what to do now)

You've completed Month 1–2. Month 3 is the **orchestration** that makes Aegis actually
"self-healing": monitoring → data → failover. Here's the exact order.

## ✅ Already done (I built + verified this)
- **Health monitor** (`orchestration/monitor.js`) — polls your 2 live clouds, **zero
  dependencies** (plain fetch), writes to Supabase. I tested it: it saved real checks
  (`render` + `vercel`) to your `health_checks` table.
- **Live status page** — added `GET /status` to your app. It reads your real health
  history from Supabase and draws the latency chart in the browser. After you redeploy,
  both of these work:
  - `https://aegis-platform-pomf.onrender.com/status`
  - `https://aegis-platform-lyart.vercel.app/status`
- **Self-healing** (`monitor.js` `maybeSelfHeal`) — auto-redeploys a cloud that fails
  3 checks in a row (needs a GitHub PAT — optional, Month 3.5).

---

## STEP 1 — Push the new code (so /status + fixes go live)
On your Mac:
```bash
cd ~/Downloads/aegis-platform
git add .
git commit -m "add live status page + zero-dep monitor + CI fixes"
git push
```
- **Render** auto-redeploys on push (wait ~3 min).
- **Vercel** auto-redeploys on push (wait ~1 min).

## STEP 2 — Turn on automatic monitoring (2 min)
Your repo already has the `monitor.yml` workflow and your 3 secrets are set, so:
1. Go to your repo → **Actions** tab → click **"Health monitor"** on the left.
2. Click **"Run workflow"** → **Run workflow** (green button).
3. Wait ~1 min → it goes green ✅. Open the run → you'll see the log line
   `saved 2 checks to Supabase`.
4. Open **https://aegis-platform-pomf.onrender.com/status** → you should see the chart
   start filling with real data.

> The workflow also runs automatically every 5 minutes (`*/5` cron) on your **public**
> repo — free. Every 5 min, 2 new rows land in Supabase.

## STEP 3 — Deploy the failover router (Cloudflare Worker) — the star of the project
This gives you ONE URL that automatically fails over between Render and Vercel.

1. Create a free account: **https://dash.cloudflare.com/sign-up** (email, no card).
2. On your Mac terminal:
   ```bash
   npm install -g wrangler
   wrangler login                      # opens browser → authorize
   cd ~/Downloads/aegis-platform/orchestration/router
   wrangler deploy
   ```
3. It prints a URL like **`https://aegis-router.<your-subdomain>.workers.dev`**.
4. Test it: open `https://<router>.workers.dev/health` → returns whichever cloud is
   healthiest. If you stop Render's service, the router instantly sends traffic to Vercel.
5. Add Supabase secrets to the Worker (so its cron monitor also records data):
   ```bash
   wrangler secret put SUPABASE_URL     # paste https://kagjbxxmdyaypfcqemem.supabase.co
   wrangler secret put SUPABASE_KEY     # paste sb_publishable_cwauqX8...
   ```
6. **Paste me the `*.workers.dev` URL** and I'll wire it into the dashboard + presentation.

> 💡 The Worker does double duty: it's the **failover router** (every request) AND the
> **monitor** (cron every 5 min, free — no GitHub Actions minutes used).

---

## What you'll be able to show after this
1. Two live clouds + a **live status page** with real uptime/latency data.
2. A **single failover URL** — kill one cloud, watch traffic route to the other.
3. **Supabase accumulating history** every 5 minutes (this feeds the ML in Month 4).

## Next (Month 4 — intelligence): when you're ready
- `intelligence/cost.js` → already shows the $40/mo savings math on /status.
- `intelligence/carbon.js` → needs an Electricity Maps key (optional; falls back to averages).
- `intelligence/ml/predict.py` → Isolation Forest on your accumulating health_checks
  (run daily via `ml-predict.yml` once you have a week+ of data).
