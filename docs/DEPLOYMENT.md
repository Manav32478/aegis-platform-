# Aegis — Full Deployment Playbook (100% free tier / ₹0)

This is the complete, beginner-friendly guide to deploying **every** part of
Aegis for free. Follow top-to-bottom. Copy-paste the commands.

> ✅ = you have already done this (live).  ➕ = the next step to do.

---

## 0. The golden rule

**The health tracker must NOT live on the clouds it monitors.**

If your monitor lived on Render and Render died, you would lose monitoring at
exactly the moment you need it. That's why Aegis watches Render + Vercel from:

1. a **Cloudflare Worker** (runs on Cloudflare's global edge) — ✅ live
2. **GitHub Actions** (runs on GitHub's runners) — ✅ live
3. an **Oracle Always-Free VM** (your own always-on server) — ➕ recommended

Three vantage points, all outside the protected clouds → honest, independent
evidence of which cloud is healthier.

---

## 1. Supabase (database) — ✅ DONE

| Project URL | `https://kagjbxxmdyaypfcqemem.supabase.co` |
|---|---|

1. Log in at https://supabase.com → your project → **SQL Editor**.
2. Open `infra/schema.sql`, copy the whole thing, paste it in, **Run**.
   (It's safe to re-run — every table uses `if not exists`.)
3. This creates: `health_checks`, `incidents`, `alerts`, `monitor_targets`,
   `failover_events`, `audit_log`, `health_reports`, `api_keys`, `organizations`,
   `risk_flags`.

> 🔒 Only use the **publishable (anon)** key in code/CI. Never paste the
> `service_role` key anywhere public.

---

## 2. The protected app on each cloud

The same tiny app (`app/`) runs on every cloud so Aegis has something to protect.
Each cloud simply runs it with a different `CLOUD_NAME`.

### 2a. Render (cloud #1) — ✅ DONE
`https://aegis-platform-pomf.onrender.com`
- Render dashboard → New Web Service → connect the GitHub repo.
- Build: `npm install` · Start: `node index.js` · Env: `CLOUD_NAME=render`.
- Free tier note: the service **sleeps after ~15 min idle** — Aegis treats that
  as a real failover event (cold start) and reroutes traffic. Good for demos.

### 2b. Vercel (cloud #2) — ✅ DONE
`https://aegis-platform-lyart.vercel.app`
- Vercel uses `app/vercel.json` → the serverless wrapper `app/api/index.js`.
- Env: `CLOUD_NAME=vercel`. No sleep-on-idle here.

### 2c. Cloud Run (cloud #3) — optional / future
- Free tier: 2,000,000 requests/month, then $0.40/million.
- Deploy: `cd app && gcloud run deploy aegis-app --source . --region us-central1 --allow-unauthenticated --set-env-vars CLOUD_NAME=google-cloud-run`
- (Or see `docs/ORACLE_VM_SETUP.md` to use an Oracle VM as cloud #3 + tracker.)

After each deploy, check `https://…/health` returns `{"status":"ok",…}`.

---

## 3. Cloudflare Worker = router + edge monitor — ✅ DONE

This is the failover router **and** a free 5-minute monitor.

```bash
cd orchestration/router
npx wrangler login          # once — authorise in the browser
npx wrangler secret put SUPABASE_URL    # → paste Supabase URL
npx wrangler secret put SUPABASE_KEY    # → paste publishable key
npx wrangler deploy
```

Result: `https://aegis-router.manav32478.workers.dev`

- It proxies requests to the **healthiest** cloud.
- Its cron (`*/5 * * * *`) writes `region='cloudflare-edge'` checks to Supabase.
- `/router/health` shows the router's own view of the fleet.

> If cron doesn't write to Supabase, the **secrets are missing** — run the two
> `wrangler secret put` commands above again, then `wrangler deploy`.

---

## 4. GitHub Actions = CI + second monitor — ✅ DONE

In the repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | your Supabase URL |
| `SUPABASE_KEY` | your **publishable** key |
| `TARGETS` | JSON array of `{name,url,region}` |
| `SELF_HEAL_TOKEN` | GitHub PAT with `workflow` scope (for self-healing) |
| `SLACK_WEBHOOK_URL` | (optional) for alerts |

Workflows included:
- `monitor.yml` — runs the health monitor every 5 min (public repo = free).
- `deploy.yml` — tests + security scan + deploy gate.
- `ml-predict.yml` — Isolation Forest risk prediction daily.
- `security-scan.yml` — Trivy + Checkov on demand.

> If the repo is **private**, a `*/5` cron can burn GitHub's free 2,000
> minutes/month fast. Keep the repo **public**, or rely on the Cloudflare cron.

---

## 5. Oracle Always-Free VM = 24/7 control plane — ➕ NEXT

This is the "professional" upgrade: run web + api + monitor on a real, always-on
Linux server, forever free (card needed once for identity; ₹0 charged).

**Full step-by-step: [`ORACLE_VM_SETUP.md`](ORACLE_VM_SETUP.md).** Short version:

```bash
ssh ubuntu@YOUR_VM_IP                     # after creating the VM in the OCI console
sudo apt update && sudo apt install -y git docker.io docker-compose-v2
git clone https://github.com/Manav32478/aegis-platform-.git
cd aegis-platform-
cp .env.example .env && nano .env        # fill in Supabase + ADMIN_TOKEN
sudo docker compose up -d --build
```

Then the portal is live at `http://YOUR_VM_IP:3100` — dashboard, status, admin,
API — plus a **third** monitor vantage point (`MONITOR_REGION=oracle-vm`).

---

## 6. Local development

```bash
cd aegis-platform
docker compose up --build        # one command, whole platform
# or without Docker:
cd web && npm install && ADMIN_TOKEN=admin node server.js
cd api && npm install && node index.js
cd orchestration && node monitor.js
cd tests && npm install && npm test
```

---

## 7. How to answer "which of the 3 clouds is healthier?"

Open the **dashboard** (portal → Dashboard). It shows per cloud:
- composite **health score** (0–100) + grade
- uptime %, p50/p95 latency, error rate
- anomaly flags + the **routing decision** ("traffic → X because highest score")

The answer is computed from real Supabase history by
`packages/common/analytics.js` + `intelligence/failover.js`.

---

## 8. What could go wrong (and the fix)

| Symptom | Fix |
|---|---|
| Dashboard shows "no data" | Run `node orchestration/monitor.js` once; check Supabase has `health_checks` rows |
| Cloudflare cron not writing | Secrets missing → `wrangler secret put SUPABASE_URL/KEY`, redeploy |
| `[object Object]` latency on old dashboard | Old build cached — redeploy Render/Vercel, or use the new portal |
| Render "DOWN" in the morning | Render free tier sleeps — that's a *real* failover demo, not a bug |
| API returns 401/403 | Generate a key (`node api/generate-key.js`) or set `ALLOWED_KEYS=abc node index.js` |
| `column region does not exist` | You haven't applied `infra/schema.sql` v2 yet — run it in SQL Editor |
