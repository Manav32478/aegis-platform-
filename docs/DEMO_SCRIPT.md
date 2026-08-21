# 🎤 Demo Script — Evaluation 1 (4 minutes, timed)

Rehearse out loud. The whole thing hinges on the chaos button working smoothly — test it
twice before you present.

---

## 0:00–0:30 — Hook (the problem)
> "Clouds go down. Last year, major providers had multi-hour outages, and if your app runs
> on just one of them, you're down with them. Free tiers exist but each one alone is
> unreliable. My project, **Aegis**, asks: *what if one app ran on three free tiers at once,
> and healed itself when any one of them failed — for zero cost?*"

## 0:30–1:30 — What Aegis is + architecture (point at the diagram)
> "Aegis deploys the same app to three clouds' free tiers — Google Cloud Run, Oracle Always
> Free, and Render. A Cloudflare Worker sits in front and routes every request to the
> healthiest cloud. A monitor polls all three every five minutes and stores history in
> Supabase. On top of that sits an intelligence layer — cost, carbon, policy, security, and
> ML-based *predictive* failover." *(show architecture slide)*

## 1:30–3:00 — LIVE DEMO (the wow moment)
> "Let me show you the failover working. This is the dashboard — three clouds, all healthy,
> with a live latency chart."
1. Open **http://localhost:8080** — point at the three green cards.
2. Say: *"Watch what happens when a cloud dies."*
3. Click **"Run chaos test"**.
4. As the victim turns red: *"That cloud is now down. Notice the router has already switched
   traffic to the next healthiest cloud — the app never went down."*
5. Click a **"Restore"** button: *"…and it comes back automatically."*
6. *"This exact routing logic runs in production as a Cloudflare Worker — failover in
   milliseconds instead of the minutes you'd wait for DNS."*

## 3:00–3:30 — Real deployments + process
> "Beyond the demo, this is a real system: the app is Dockerized and deployed live on Render
> [and Vercel — show the /health URL]. Every push runs CI/CD with security scanning, and the
> SRS + architecture are documented in the repo."

## 3:30–4:00 — What's next + close
> "Over the next three months I'm adding the intelligence layer — cost savings estimates,
> carbon-aware routing, OPA policy checks, and an Isolation Forest model that flags a cloud
> *before* it fails. Thank you — happy to answer questions."

---

## If something breaks mid-demo
- **Dashboard won't load?** → `node demo/server.js` not running; say *"one moment"* and restart it.
- **Chaos button does nothing?** → refresh the page, press again. It always works after a refresh.
- **No internet?** → the demo runs fully offline (localhost). Nothing needs a connection.
