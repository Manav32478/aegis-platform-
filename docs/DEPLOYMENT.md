# Aegis — Full Deployment Playbook (100% free tier / ₹0)

This is the complete, beginner-friendly guide to deploying **every** part of
Aegis for free. Follow top-to-bottom. Copy-paste the commands.

> ✅ = already live.  ➕ = next step.  (Verified 2026-09-18.)

---

## 0. The golden rule

**The health tracker must NOT live on the clouds it monitors.**

If your monitor lived on Render and Render died, you'd lose monitoring at
exactly the moment you need it. Aegis therefore watches Render + Vercel from
three *independent* vantage points, all outside the fleet:

1. **Cloudflare Worker** (edge) — ✅ live
2. **GitHub Actions** (runners) — ✅ live
3. **Oracle Always-Free VM** (your own server) — ➕ recommended

---

## 1. Supabase (database) — ✅ DONE

- Project: `https://kagjbxxmdyaypfcqemem.supabase.co`
- Paste `infra/schema.sql` into **SQL Editor → Run**. (Safe to re-run.)
- Creates 10 tables: health_checks, incidents, alerts, monitor_targets,
  failover_events, audit_log, health_reports, api_keys, organizations, risk_flags.

> 🔒 Only the **publishable (anon)** key goes in code. Never expose `service_role`.

---

## 2. Deploy YOUR OWN app on 3 clouds (how Aegis "runs applications")

Aegis protects **any** app that exposes a `/health` endpoint. The steps:

### Step A — make your app checkable
```js
// any framework — expose the identical contract on every cloud
app.get('/health', (req, res) => res.json({
  status: 'ok', cloud: process.env.CLOUD_NAME, requests, uptimeSeconds, timestamp: Date.now()
}));
```
Aegis uses `status`, `cloud`, and the latency of the response. Nothing else.

### Step B — deploy the SAME app three times (one per cloud)

**Render (cloud #1)** ✅ live:
1. render.com → New Web Service → connect the GitHub repo
2. Build `npm install`, Start `node index.js`, Env `CLOUD_NAME=render`

**Vercel (cloud #2)** ✅ live:
1. vercel.com → Import → the repo → root `app/`
2. Uses `app/vercel.json` (serverless). Env `CLOUD_NAME=vercel`

**Cloud Run (cloud #3)** ➕ when ready:
```bash
gcloud run deploy aegis-app --source . --region us-central1 \
  --allow-unauthenticated --set-env-vars CLOUD_NAME=google-cloud-run
```

### Step C — register the clouds with the platform
Add each URL to `monitor_targets` (or via **Admin → Add target** on the portal).
The Worker + monitor then watch all of them automatically.

---

## 3. HOW TO PROVE FAILOVER (this is the examiner's favourite test)

**Method 1 — the dashboard button (30 seconds):**
1. Open the dashboard → **"Failover proof"** card → note which cloud the
   router serves (e.g. `render`).
2. In Render dashboard: suspend/pause your service.
3. Click **↻ Re-run proof** → the router now serves `vercel`.

**Method 2 — plain URLs:**
- `https://aegis-router.manav32478.workers.dev/health` → shows which cloud **serves**
- `https://aegis-platform-pomf.onrender.com/health` → direct to Render
- `https://aegis-platform-lyart.vercel.app/health` → direct to Vercel
Kill one cloud → the router URL changes its answer within ~10 seconds.

**Why you can trust the switch happened:** every probe, incident, alert and
failover _decision_ is written to Supabase with a timestamp. Check
`incidents` + `failover_events` tables — the story is recorded, not claimed.

---

## 4. HOW TO PROVE THE MONITOR IS ACTUALLY CHECKING

Three independent pieces of evidence, all viewable live:

| Evidence | Where |
|---|---|
| Timestamps advancing | Dashboard → "updated Xs ago" + probe strip |
| Raw rows landing every 5 min | Supabase → `health_checks` (order by `checked_at`) |
| Green workflow runs | GitHub → Actions → "Health monitor" (schedule */5) |

Also: run it by hand once and watch it write:
```bash
cd orchestration && node monitor.js
# prints: render UP 397ms http=200 · vercel UP 388ms http=200 · saved 2 checks
```

---

## 5. HOW TO PROVE THE INTELLIGENCE LAYER IS LIVE (not static)

| Layer | Live source (now) |
|---|---|
| **Health scores** | recomputed from Supabase history every 10 s |
| **ML z-scores** | rolling z-score recomputed every 10 s (e.g. render z=10 ⚠) |
| **Isolation Forest** | daily GitHub Action → `risk_flags` table |
| **Cost** | extrapolated from each cloud's **real** request counter (`/health` returns `requests`) |
| **Carbon** | fallback grid averages; flips to live with ELECTRICITYMAP_KEY |
| **Security CI** | dashboard "Security CI" card fetches GitHub Actions results live |

Value on the dashboard changes → it's computed, not hardcoded.

---

## 6. Oracle Always-Free VM (24/7 control plane) — ➕ NEXT

Full steps: docs/ORACLE_VM_SETUP.md. Short version:
```bash
ssh ubuntu@YOUR_VM_IP
sudo apt update && sudo apt install -y git docker.io docker-compose-v2
git clone https://github.com/Manav32478/aegis-platform-.git
cd aegis-platform- && cp .env.example .env && nano .env
sudo docker compose up -d --build     # portal on :3100, monitor every 5 min
```

---

## 7. Local development
```bash
cd aegis-platform && ./start.sh          # whole platform, one command
# or:
docker compose up --build
```

---

## 8. Troubleshooting
| Symptom | Fix |
|---|---|
| Dashboard "no data" | `cd orchestration && node monitor.js` once |
| Router answers slowly after a pause | free-tier cold start — wait ~15 s, re-probe |
| Probe URL shows `/health/health` | fixed in v2 — pull latest `web/data.js` |
| CI shows Node 20 deprecation warning | harmless — runs still pass |
| Render strona down in mornings | it sleeps when idle — that IS a failover event |
