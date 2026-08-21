# Step 1 — Create Your Accounts (click-by-click guide)

This is the FIRST thing to do for Aegis. Everything later (repo, databases, clouds,
router) plugs into these accounts. All of them are **free**. Only Google Cloud and Oracle
ask for a card — for *verification only*, you are **not charged** if you stay inside the
free tier. If you don't want to use a card at all, the **cardless path** at the bottom
covers you completely.

---

## ⚡ The short answer (do these 4 first — all cardless, ~1 hour total)

| # | Account | Go here | Card? | What you'll copy at the end |
|---|---------|---------|-------|------------------------------|
| 1 | **GitHub** | https://github.com/signup | ❌ No | username + repo URL |
| 2 | **Supabase** | https://supabase.com/dashboard/sign-up | ❌ No | project URL + anon key |
| 3 | **Render** | https://render.com/register | ❌ No | app URL (`https://x.onrender.com`) |
| 4 | **Vercel** | https://vercel.com/signup | ❌ No | app URL (`https://x.vercel.app`) |

These four are **enough for Evaluation 1**. The rest below are for the full 6-month build.

| # | Account | Go here | Card? | Needed for |
|---|---------|---------|-------|------------|
| 5 | **Cloudflare** | https://dash.cloudflare.com/sign-up | ❌ No | failover router (Month 3) |
| 6 | **Google Cloud** | https://console.cloud.google.com | ⚠️ Yes (verify only) | cloud #1 (Month 2) |
| 7 | **Oracle Cloud** | https://signup.cloud.oracle.com | ⚠️ Yes (verify only) | cloud #2 (Month 2) |
| 8 | **Electricity Maps** | https://api-portal.electricitymaps.com | ❌ No | carbon module (Month 4, optional) |

---

## 1. GitHub — repo + free CI/CD (~5 min)
1. Go to **https://github.com/signup**
2. Email → password → username → verify email.
3. Click **New repository** (the green button, top-right ➜ or at https://github.com/new).
4. Name it **`aegis-platform`** · **Public** (public = free unlimited Actions minutes — important!) · no README (we already have one) · **Create repository**.
5. Leave that page open — you'll paste the push commands there later.

✅ **Copy & save:** your username + the repo URL (`https://github.com/<you>/aegis-platform`).

---

## 2. Supabase — free database (health history, auth, ML) (~5 min)
1. Go to **https://supabase.com/dashboard/sign-up** → sign up with **GitHub** (easiest).
2. Click **New project**.
3. Organization: pick the default · Name: **`aegis`** · Database password: **generate one and SAVE it** (button) · Region: **Mumbai (ap-south-1)** or any close to you · **Create project** (takes ~1 min).
4. In the left menu click **SQL Editor** → **New query** → paste the contents of **`infra/schema.sql`** from this project → **Run**.
   - This creates the 4 tables (health_checks, organizations, api_keys, risk_flags) + access rules.
5. In the left menu click **Project Settings** (gear icon) → **API**.
6. Copy these two values:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public key** (a long string starting with `eyJ...`)

✅ **Copy & save:** Project URL + anon key.

> ⚠️ Never share the *service_role* key. We only ever use the **anon** key.

---

## 3. Render — cloud #1, cardless, runs Docker (~15 min)
1. Go to **https://render.com/register** → sign up with **GitHub**.
2. Click **New** ➜ **Web Service**.
3. Connect your GitHub account ➜ pick the **`aegis-platform`** repo.
4. On the settings page set:
   - **Runtime:** Docker
   - **Root directory:** `app`
   - **Dockerfile path:** `./Dockerfile`
   - **Name:** anything (e.g. `aegis-app`)
5. Scroll to **Environment Variables** ➜ add: `CLOUD_NAME` = `render`.
6. **Deploy Web Service** (choose the **Free** instance type if asked) → wait ~3 min.
7. Open **`https://<your-name>.onrender.com/health`** in your browser.

✅ **Copy & save:** that URL. If it returns `{"status":"ok","cloud":"render",...}` — you have a live cloud! 🎉

> ⚠️ Free Render **sleeps after ~15 min idle** (wakes in ~50 s). Normal — your monitor keeps waking it.

---

## 4. Vercel — cloud #2, cardless (already wired in the code!) (~10 min)
1. Go to **https://vercel.com/signup** → sign up with **GitHub**.
2. Click **Add New** ➜ **Project** → import **`aegis-platform`**.
3. Configure:
   - **Framework Preset:** `Other`
   - **Root Directory:** `app`
4. **Environment Variables** ➜ add: `CLOUD_NAME` = `vercel`.
5. Click **Deploy** → wait ~1 min.
6. Open **`https://<your-project>.vercel.app/health`**.

✅ **Copy & save:** that URL. `{"status":"ok","cloud":"vercel",...}` = second live cloud! 🎉

> I already added `app/vercel.json` + `app/api/index.js` to the repo so this deploys
> with zero extra setup. That's why Vercel is the fastest cloud to get live.

---

## 5. Cloudflare — failover router (free, ~5 min) *(for Month 3, optional now)*
1. Go to **https://dash.cloudflare.com/sign-up** → create account → **Add a site** (you can skip adding a domain for now — you don't need to buy one).
2. This is where the **Worker router** lives later (`orchestration/router/`). Skip the rest for Eval 1.

✅ **Copy & save:** nothing yet — just have the account.

---

## 6. Google Cloud — cloud #1 alternative (⚠️ card for verification only, $0 spend)
> Do this only if you're comfortable using a card once for verification. **Skip it if not —
> Render + Vercel are enough.**
1. Go to **https://console.cloud.google.com** → **Sign in** with a Google account.
2. Click **"Get started for free"**. You'll be offered a **$300 / 90-day trial** — it asks for a card. Inside the trial you spend **$0**; Cloud Run's permanent free tier (2M requests/month) also stays free after.
   - 💡 Tip: you can enable billing without spending the trial, but the card step is the same.
3. After activation, search **"Cloud Run"** → **Create service** → **"Deploy from source"** → point at your GitHub repo (or upload the `app/` folder).
4. Region: **us-central1** · allow unauthenticated · env `CLOUD_NAME=google-cloud-run`.

✅ **Copy & save:** the `https://...run.app` URL.

---

## 7. Oracle Cloud — cloud #2 alternative (⚠️ card for verification only, $0 spend)
> The cardless equivalent of this is Vercel. Oracle's signup is the most tedious —
> only do it if you want the "real 3-cloud" story for your report.
1. Go to **https://signup.cloud.oracle.com** → fill in details → **Verify** with a card (no charge, it just checks the card is real).
2. Console ➜ **Compute** ➜ **Instances** ➜ **Create instance**:
   - Shape: **VM.Standard.A1.Flex** (Always Free) · Image: **Ubuntu 22.04**
   - Download the **SSH key** it generates (or upload yours) — keep it safe.
3. Connect: `ssh -i your-key.key ubuntu@<public-ip>`
4. On the VM:
   ```bash
   sudo apt update && sudo apt install -y docker.io git
   git clone <your-repo-url> && cd aegis-platform/app
   sudo docker build -t aegis-app .
   sudo docker run -d -p 80:3000 -e CLOUD_NAME=oracle-cloud --restart unless-stopped aegis-app
   ```
5. In the console, open **port 80** inbound (Networking ➜ Security List ➜ Add Ingress Rule, source `0.0.0.0/0`, TCP 80).
6. Test `http://<public-ip>/health`.

✅ **Copy & save:** the VM's public IP.

---

## 8. Electricity Maps — carbon intensity (optional, Month 4)
1. Go to **https://api-portal.electricitymaps.com** → create a free account → get an API token.
2. (Not needed now — the `intelligence/carbon.js` module falls back to published averages without a key.)

---

## 🛡️ The cardless path (if you never want to enter a card)
**Clouds become: Render + Vercel + Cloudflare Worker** instead of GCP/Oracle. The app code
doesn't change at all — only the URLs in the monitor/router config change. For a college
project this is a perfectly legitimate "multi-cloud" setup: two platforms + a serverless
edge router.

---

## 📋 When you're done — send me this
| Account | Send me |
|---------|---------|
| GitHub | username + repo URL |
| Supabase | Project URL + anon key |
| Render | `https://....onrender.com` URL |
| Vercel | `https://....vercel.app` URL |
| Cloudflare | (just confirm it exists) |
| GCP / Oracle | the URLs / IP if you did them |

Once you paste these, I'll wire the real URLs into the monitor + router, update the
presentation with live screenshots, and give you the Day-by-Day plan for the rest.

## ⏱️ Time check
- **Eval-1 minimum (cardless):** GitHub + Supabase + Render + Vercel ≈ **1 hour**.
- **Full 6-month setup:** add Cloudflare + GCP + Oracle ≈ **+1 day** (card verification + waiting).
