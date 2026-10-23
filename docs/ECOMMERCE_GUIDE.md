# Deploy YOUR OWN E-commerce (or any) app on Aegis — End to End

This is the answer to: *"I have an e-commerce website. How do I deploy it in
Aegis so it runs on 3 clouds, and how do I check Aegis is actually protecting
it?"*

> **The one idea to internalise:** Aegis does NOT host your app. You deploy your
> app **three times** (one copy per cloud). Aegis sits in front, watches all
> three copies every 5 minutes, and sends customers to the healthiest copy.
> If one copy dies, customers instantly flow to another — that's the failover.

There is a complete working example in `examples/ecommerce/` you can copy from.

---

## The mental model (draw this for the examiner)

```
                        Cloudflare Worker (Aegis router)
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
       your store on        your store on       your store on
         RENDER               VERCEL             CLOUD RUN
       (copy #1)             (copy #2)            (copy #3)
              │                   │                   │
              └───────────► Supabase ◄───────────────┘
                    (Aegis stores every health check)
```

The only requirement: **each copy exposes `GET /health`** returning:
```json
{"status":"ok","cloud":"render","requests":123,"uptimeSeconds":456,"timestamp":1234567890}
```

---

## Step 1 — Make sure your store has a /health endpoint

Your real e-commerce app (React/Node/Java/PHP — anything) needs ONE extra
route. It's ~5 lines:

```js
app.get('/health', (req, res) => res.json({
  status: 'ok',
  cloud: process.env.CLOUD_NAME || 'unknown',
  requests: totalRequests,
  uptimeSeconds: process.uptime(),
  timestamp: Date.now(),
}));
```

Aegis will call this every 5 minutes and time how long it takes. Nothing else
changes in your app — no Aegis library, no lock-in.

*(The example in `examples/ecommerce/server.js` already has this. Test it:*

```bash
cd examples/ecommerce && npm install && CLOUD_NAME=local node server.js
open http://localhost:3000        # the store
open http://localhost:3000/health # what Aegis watches
```

*)**

---

## Step 2 — Deploy the SAME app to 3 clouds

Deploy the identical code 3 times. Each copy gets a different `CLOUD_NAME`.

### Cloud #1 — Render (free)
1. render.com → New → Web Service → point at your GitHub repo (subfolder `examples/ecommerce`).
2. Build: `npm install` · Start: `node server.js`
3. Environment: `CLOUD_NAME=render`
4. Note the URL: `https://my-store.onrender.com`

### Cloud #2 — Vercel (free, cardless)
1. vercel.com → Add New → Project → import repo → **Root Directory = `examples/ecommerce`**
2. Framework **Other** (it uses `vercel.json`).
3. Environment: `CLOUD_NAME=vercel`
4. Note the URL: `https://my-store.vercel.app`

### Cloud #3 — Cloud Run (free tier)
```bash
cd examples/ecommerce
gcloud run deploy my-store --source . --region us-central1 \
  --allow-unauthenticated --set-env-vars CLOUD_NAME=google-cloud-run
```

Now you have **three copies**. Test each: open the URL → the store loads and the
blue badge says `served by render` / `vercel` / `google-cloud-run`.

---

## Step 3 — Register the 3 copies with Aegis

Option A (dashboard): **Admin** page → **Add target** — add each `https://.../health` URL.

Option B (database): 
```sql
insert into monitor_targets (cloud_name, url, region, enabled) values
  ('my-store-render',  'https://my-store.onrender.com/health', 'oregon', true),
  ('my-store-vercel',  'https://my-store.vercel.app/health', 'global', true),
  ('my-store-cloudrun','https://my-store.a.run.app/health', 'us-central1', true)
on conflict (cloud_name) do nothing;
```

**From this moment, Aegis monitors your store every 5 minutes** and records to
Supabase. (We hardcoded the demo's router to Render/Vercel; in your own setup
you update `orchestration/router/src/worker.js` TARGETS to your 3 URLs and
`wrangler deploy`.)

---

## Step 4 — Point the router at your store (the failover switch)

Edit `orchestration/router/src/worker.js`:
```js
const TARGETS = [
  { name: 'my-store-render',   url: 'https://my-store.onrender.com' },
  { name: 'my-store-vercel',   url: 'https://my-store.vercel.app' },
  { name: 'my-store-cloudrun', url: 'https://my-store.a.run.app' },
];
```
Then:
```bash
cd orchestration/router && npx wrangler deploy
```
Your shop now has ONE front door: `https://aegis-router.YOURNAME.workers.dev` —
customers always hit the healthiest copy.

---

## Step 5 — CHECK Aegis is really working (the verification checklist)

### ✅ 1. Is it being monitored?
- Open the dashboard → your store's 3 copies appear in **Real-time probes** with
  live latency + request counters.
- Supabase → `health_checks` → rows for your clouds with fresh `checked_at`.
- GitHub → Actions → "Health monitor" → green runs.

### ✅ 2. Is failover real? (THE test — do it in the demo)
1. Dashboard → **Failover proof** card → note which cloud the router serves.
2. In **Render**, suspend your store's service.
3. Click **↻ Re-run proof** on the dashboard.
4. The router now names **Vercel** — and, crucially, **open your store URL again:
   it STILL LOADS.** The customer never sees a difference.

### ✅ 3. Is it recorded?
- Supabase → `incidents` shows the Render copy down + recovered with duration.
- Supabase → `alerts` shows "DOWN" then "recovered".
- `failover_events` shows the re-route.

### ✅ 4. Are the numbers honest?
- Dashboard **Cost** card recomputes savings from your store's real request
  counters every 10 s.
- **ML z-scores** recompute live — watch one cloud's latency spike and its z-score
  rise toward a flag.

---

## "What if my store has a DATABASE?" (the important follow-up)

The example uses in-memory data for simplicity. A real store uses a shared
database. The honest answer:

> "The **compute** is redundant across 3 clouds, but the **database** must be a
> single shared source of truth — otherwise customers would see different carts
> depending on which cloud served them. My project stores all state in Supabase
> Postgres, which is itself hosted outside the three clouds, so all three copies
> read and write the same data. That's why the failover is seamless."

That one answer will impress an examiner more than anything else in this guide.
