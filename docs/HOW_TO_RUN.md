# ⚙️ Aegis — How to Run (ONE command)

> **You do NOT need the table of 8 commands anymore.**
> Everything now lives inside **one file**: `dashboard.html`.

---

## ✅ THE ONLY THING YOU RUN

**Double-click `dashboard.html`** (or `open dashboard.html`).

That's it. That single page contains the ENTIRE project demo:

| # | Section | What you see |
|---|---------|--------------|
| 1 | 📊 Overview | KPI cards + live system + how it works |
| 2 | 📈 Live monitoring | real cloud uptime/latency from Supabase |
| 3 | 🧠 Intelligence | cost ($40/mo saved) · carbon · security |
| 4 | 🧪 **ML Lab** | a real **Isolation Forest running in the browser** — flags the degrading cloud |
| 5 | 🔥 **Failover demo** | click "Run chaos test" — watch the router reroute (works offline) |
| 6 | ⌨️ Developer API | live API explorer + endpoint table |
| 7 | ✅ **Testing** | the **real 6 unit tests running live in the browser** (6/6 passing) |
| 8 | 🏗️ Architecture | 5-layer diagram + tech stack |
| 9 | 🗓️ Roadmap | 6-month plan |

Light theme by default · 🌙/☀️ toggle top-right.

---

## (Optional) ONE more double-click — only if you want the API section to answer live

Double-click **`start.sh`** (Mac/Linux) or **`start.bat`** (Windows).
This boots the API + app + local demo servers and opens the dashboard.
Not needed for the demo — only if you want to hit the *real* local API.

---

## 🌐 It's also live on the internet (no running anything)
- Dashboard: `https://aegis-router.manav32478.workers.dev/dashboard`
- Status page: `https://aegis-router.manav32478.workers.dev/status`

---

# For reference only (the "how it works under the hood" parts)

These are the *real* production components — they already run automatically on your
clouds/GitHub, so you never run them for a demo. Kept here for your understanding:

| Component | Where it runs automatically |
|-----------|-----------------------------|
| Health monitor (5 min) | GitHub Actions + Cloudflare Worker cron |
| Core app `/health` | Render + Vercel (live) |
| Failover router | Cloudflare Worker (live) |
| ML daily prediction | GitHub Actions `ml-predict.yml` |
| Security scans (Trivy/Checkov) | GitHub Actions on every push |
| API + Swagger | `cd api && node index.js` (local, when you want it) |

## Pushing updates (only when you change code)
```bash
cd ~/Desktop/aegis-platform
git add . && git commit -m "update" && git push
```
