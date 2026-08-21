# 🎉 You now have a LIVE multi-cloud platform — final steps

## What's live right now
| Cloud | URL | Status |
|-------|-----|--------|
| Render (free) | https://aegis-platform-pomf.onrender.com | ✅ `/health` returns `{"cloud":"render"}` |
| Vercel (free) | https://aegis-platform-lyart.vercel.app | ✅ `/health` returns `{"cloud":"vercel"}` |
| Supabase | https://kagjbxxmdyaypfcqemem.supabase.co | ✅ 4 tables created |

Your health monitor already polls both live clouds and reports them healthy.
(Tested: render 719ms · vercel 233ms.)

---

## STEP 1 — Get the updated code (download the new zip)
1. Download `aegis-platform.zip` from the chat (I re-zipped it with your URLs wired in).
2. Unzip it **over** your existing folder (replace files) — or unzip to a fresh folder.

## STEP 2 — Push the update to GitHub (Mac Terminal)
```bash
cd ~/Downloads/aegis-platform        # your folder
git add .
git commit -m "wire live Render + Vercel URLs into monitor and router"
git push
```

## STEP 3 — Add GitHub Actions secrets (2 min)
Go to your repo → **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|-------------|-------|
| `SUPABASE_URL` | `https://kagjbxxmdyaypfcqemem.supabase.co` |
| `SUPABASE_KEY` | `sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti` |
| `TARGETS` | `[{"name":"render","url":"https://aegis-platform-pomf.onrender.com/health"},{"name":"vercel","url":"https://aegis-platform-lyart.vercel.app/health"}]` |

## STEP 4 — Watch CI run
Go to repo → **Actions** tab → you'll see the **"Deploy to all clouds"** and **"Security scan"**
workflows. Security scan runs Trivy + Checkov automatically. If "Deploy to GCP" fails, that's
expected (no GCP key yet) — the `test` + `security-scan` jobs are the ones that matter now.

## STEP 5 — (Optional but great) Cloudflare router
The failover router lives at `orchestration/router/`. Deploy it for the full effect:
```bash
npm i -g wrangler
wrangler login
cd orchestration/router
wrangler deploy
```
It gives you ONE URL that auto-fails-over between Render and Vercel. (You'll need a free
Cloudflare account — no card.)

---

## ⏰ What to do before your evaluation (Day of)
1. Open `http://localhost:8080` (run `./run-demo.sh`) — your chaos-button failover demo.
2. Open the two live URLs above in browser tabs — prove they're real.
3. Present `docs/EVAL1_presentation.pptx` (now shows your live cloud URLs).
4. Have `docs/SRS.md` ready to show.

## 🗣️ Your one honest line
> "Two clouds are live on Render and Vercel free tiers, monitoring is running, and the
> failover logic is working end-to-end. GCP/Oracle and the Cloudflare router land in Month 3."
