# ⚡ 4-Day Sprint → Evaluation 1

Your first review is in ~4 days. Here's the exact plan. The demo + SRS + deck are
**already done** — your 4 days are about (a) getting ≥1 real cloud live, (b) pushing to
GitHub, and (c) rehearsing. Do these in order.

> **Minimum bar for Eval 1:** working failover demo (done) + 1 real cloud + repo + SRS + deck.
> **Nice-to-have:** 2–3 real clouds, CI green, Supabase collecting data.

---

## Day 0 — TODAY (30 min, no accounts needed)
- [ ] Install **Node.js 20+** (https://nodejs.org) if you don't have it.
- [ ] Double-click `run-demo.bat` (or `./run-demo.sh`) → open **http://localhost:8080**.
- [ ] Click **"Run chaos test"** — watch a cloud go red and traffic fail over. That's your demo.
- [ ] (Optional, 2 min) `cd app` → `npm install` → `CLOUD_NAME=local node index.js` → see the real app on :3000.

## Day 1 — GitHub + Supabase (~1 hour)
- [ ] Create a repo at **github.com** named `aegis-platform` — set it **PUBLIC** (free Actions minutes).
- [ ] Push this folder:
  ```bash
  cd aegis-platform
  git init
  git add .
  git commit -m "Aegis platform — initial build"
  git branch -M main
  git remote add origin https://github.com/<YOU>/aegis-platform.git
  git push -u origin main
  ```
- [ ] Create a **Supabase** project (supabase.com → free) → open **SQL Editor** → paste & run **`infra/schema.sql`**.
- [ ] Copy Supabase **URL + anon key** (Settings → API).
- [ ] In GitHub → Settings → Secrets → Actions → add `SUPABASE_URL` and `SUPABASE_KEY`.

## Day 2 — Real cloud #1: Render (cardless, ~20 min) ⭐ do this first
- [ ] **render.com** → New → **Web Service** → connect your repo.
- [ ] Settings: Runtime = **Docker** · Build context = `app` · Dockerfile path = `app/Dockerfile`.
- [ ] Environment variable: `CLOUD_NAME` = `render`.
- [ ] Deploy → wait ~3 min → open `https://<your-app>.onrender.com/health` → should show `"cloud":"render"`.
- [ ] **Save that URL.** Note: free Render sleeps after ~15 min idle (your monitor will wake it).

## Day 3 — Real cloud #2: Vercel (cardless, ~15 min) OR GCP/Oracle
**Option A — Vercel (no card):**
- [ ] **vercel.com** → New Project → import repo → Framework Preset = **Other** → Root Directory = **`app`**.
- [ ] Environment variable: `CLOUD_NAME` = `vercel`.
- [ ] Deploy → open `https://<your-app>.vercel.app/health` → `"cloud":"vercel"`.

**Option B — Google Cloud Run (needs card verification, $0 spend):**
- [ ] console.cloud.google.com → enable billing (verification only) → **Cloud Run** → **Deploy from source** (point at the repo or upload the `app/` folder).
- [ ] Region `us-central1` · allow unauthenticated · env `CLOUD_NAME=google-cloud-run`.

**Option C — Oracle Always Free (needs card verification, $0 spend):**
- [ ] cloud.oracle.com → Compute → Create Instance → **VM.Standard.A1.Flex** → Ubuntu 22.04 → download SSH key.
- [ ] On the VM: `sudo apt update && sudo apt install -y docker.io git && git clone <repo> && cd aegis-platform/app && sudo docker build -t aegis-app . && sudo docker run -d -p 80:3000 -e CLOUD_NAME=oracle-cloud --restart unless-stopped aegis-app`
- [ ] In the console, open **port 80** in the Security List → test `http://<vm-ip>/health`.

> If you can't do any card verification in 4 days: **Render + Vercel = 2 real clouds**, plus the
> local demo shows all 3. That's a perfectly strong Eval 1. GCP/Oracle can land before Eval 2.

## Day 4 — Wire up + rehearse (1 hour)
- [ ] Update the 3 URLs in `orchestration/monitor.js` (`DEFAULT_TARGETS`) and `orchestration/router/src/worker.js` (`TARGETS`).
- [ ] Push → watch the **deploy + security scan** workflows run green on GitHub (Actions tab).
- [ ] Rehearse the **demo script** (`docs/DEMO_SCRIPT.md`) out loud, timed to ~4 minutes.
- [ ] Open `docs/EVAL1_presentation.pptx`, replace `[Your Name]`, check the images render.
- [ ] Print or open `docs/SRS.md` — reviewers will ask for it.

## What to bring
Laptop + charger · the deck · SRS · demo already running (or `run-demo.bat` ready) · a browser tab on GitHub Actions.

## The one honest line to memorize
> *"GCP and Oracle are pending free-tier verification; Render and Vercel are live now, and the
> failover logic is identical on all of them."*

Reviewers reward a working demo + honesty over inflated claims.

---

## After Eval 1 (the other 4.5 months)
Follow `README.md` months 3→6 and `docs/EVALUATION_PLAN.md` → Evaluation 2 section. The
intelligence layer, API, dashboard and ML are already scaffolded in this repo.
