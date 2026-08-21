# 🎬 Demo Video Script (3–5 minutes)

Record this with the showcase page + live URLs. Timing shown per segment.

---

## 0:00–0:30 — The problem (30 s)
> "Clouds go down. If your app lives on one cloud, you go down with it. Free tiers are
> everywhere — but each one alone is unreliable. My project, Aegis, asks: what if one
> app ran on several free tiers at once, and healed itself when any one failed — at zero
> cost?"

*On screen: title slide of the showcase page.*

## 0:30–1:30 — Architecture (60 s)
> "Aegis deploys the same app to multiple clouds' free tiers. A Cloudflare Worker sits at
> the edge and routes every request to the healthiest cloud. A monitor polls every cloud
> every five minutes and stores history in Supabase. An intelligence layer adds cost,
> carbon, policy, security, and ML-based predictive failover. Total cost: zero dollars."

*On screen: the architecture diagram section of showcase.html.*

## 1:30–3:00 — Live failover demo (90 s)
> "Here's the live system. The router currently serves Render. Watch what happens when I
> suspend Render…"

1. Open `https://aegis-router.manav32478.workers.dev/health` → shows `render`.
2. Render dashboard → Suspend service.
3. Refresh the router URL → now shows `vercel`. **Traffic never stopped.**
4. Resume Render.
> "That failover happens at the edge, in milliseconds — not the minutes DNS would take."

## 3:00–4:00 — Dashboard + intelligence (60 s)
*On screen: `showcase.html` status grid + intelligence cards, then the API.*
> "The dashboard shows live uptime and latency per cloud, the $40-a-month cost saving,
> and ML risk flags — an Isolation Forest model that learns each cloud's normal latency
> and flags it *before* it fails. And the platform is multi-tenant: the API requires a
> hashed key and serves interactive Swagger docs."

*Optional live bit: curl the API 401 → 403 → 200.*

## 4:00–4:30 — What's next (30 s)
> "Next: the startup path — paid tiers, more clouds, and enterprise carbon reporting.
> Thank you."

---

## Recording tips
- Record the screen at 1080p; keep the terminal window next to the browser.
- Do the failover take twice and use the cleaner one.
- Keep the API key hidden on camera (or use the `abc` demo key).
- Export as MP4, ≤ 5 min.
