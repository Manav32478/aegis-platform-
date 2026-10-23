# Deploy SPARSH Store on 3 Clouds + Protect with Aegis — Exact Steps

> Your store: `https://yoursparshstore.vercel.app` (static React/Vite SPA)
> Goal: 3 copies on 3 free clouds, Aegis in front, failover proven.

---

## The plan in one line

**Deploy the same static build to 3 clouds → give each copy a `health.json` →
register all 3 in Aegis → point the Aegis router at them → verify failover.**

Since SPARSH is a **static SPA**, it cannot run server code. That's fine: Aegis
only needs a static JSON file at a known URL. A `health.json` file does the job
on every static host (Vercel, Render Static, Cloudflare Pages, Netlify all serve
it instantly).

---

## Step 1 — Add a `health.json` to your repo (30 seconds)

Create this file in your project **root** (where `index.html` lives after build):

```json
{
  "status": "ok",
  "service": "sparsh-store"
}
```

After rebuild, it's reachable at `https://yoursparshstore.vercel.app/health.json`.
Test it in the browser — you should see the JSON, not the app.

> Optional upgrade (later): replace the static file with a tiny serverless
> function `api/health.js` on Vercel that returns a **live request counter**:
>
> ```js
> export default function handler(req, res) {
>   res.status(200).json({ status: 'ok', cloud: 'vercel', timestamp: Date.now() });
> }
> ```
>
> This gives the dashboard live "requests served" counters. The static file is
> enough to start — do this upgrade in week 2.

---

## Step 2 — Deploy the SAME build to 2 more clouds (free)

### Cloud #2 — Render (free Static Site, ~5 min)
1. render.com → **New → Static Site** → connect the SPARSH GitHub repo
2. Build command: `npm run build` · Publish directory: `dist` (or `build`)
3. Deploy → note the URL, e.g. `https://sparsh-store.onrender.com`
4. Verify `https://sparsh-store.onrender.com/health.json` shows the JSON ✅

### Cloud #3 — Cloudflare Pages (free, ~5 min)
1. dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**
2. Import the SPARSH repo · build `npm run build` · output `dist`
3. Deploy → URL like `https://sparsh-store.pages.dev`
4. Verify `.../health.json` ✅

*(Alternative free 3rd host: Netlify — same steps.)*

You now have **three independent copies**:
| Copy | URL |
|---|---|
| Vercel | `https://yoursparshstore.vercel.app` |
| Render | `https://sparsh-store.onrender.com` |
| Cloudflare Pages | `https://sparsh-store.pages.dev` |

> ⚠️ One design note for the viva: hosting a *copy* on Cloudflare Pages while
> the *router* also runs on Cloudflare Workers is acceptable (different product,
> different region), but if you want true vendor diversity, use **Netlify** as
> cloud #3 instead. Say this and you'll sound like a real SRE.

---

## Step 3 — Register all 3 copies in Aegis

Open your Aegis portal → **Admin** → type `aegis-demo` → **Save token** → **Add target**:

| cloud name | URL |
|---|---|
| `sparsh-vercel` | `https://yoursparshstore.vercel.app/health.json` |
| `sparsh-render` | `https://sparsh-store.onrender.com/health.json` |
| `sparsh-pages` | `https://sparsh-store.pages.dev/health.json` |

Takes effect immediately — the monitor starts probing all 3 every 5 minutes.

---

## Step 4 — Point the Aegis router at your store

Edit `orchestration/router/src/worker.js` — replace the demo TARGETS with yours:

```js
const TARGETS = [
  { name: 'sparsh-vercel', url: 'https://yoursparshstore.vercel.app' },
  { name: 'sparsh-render', url: 'https://sparsh-store.onrender.com' },
  { name: 'sparsh-pages', url: 'https://sparsh-store.pages.dev' },
];
```

Then redeploy the router:

```bash
cd ~/Desktop/aegis-platform/orchestration/router
npx wrangler deploy
```

Your store now has ONE front door: `https://aegis-router.manav32478.workers.dev`
— but Aegis is now routing to YOUR store, not the demo app.

---

## Step 5 — PROVE it works (do this in the evaluation)

1. Open dashboard → **Real-time probes** → your 3 SPARSH copies with latency ✅
2. Open **Failover proof** card → note which copy the router serves.
3. Go to Render → **suspend** `sparsh-store` (or disconnect it).
4. Click **↻ Re-run proof** → router now answers a different copy.
5. **Open the store URL through the router — it STILL LOADS.** The customer
   never noticed. That's the failover, live.
6. Show Supabase → `incidents` + `alerts` — the outage is recorded with duration.

---

## The "what about checkout / cart / DB?" answer (memorise)

> "The static storefront is redundant across 3 clouds, but customer data must be
> one shared source of truth. I'd point all three copies at the SAME Supabase
> Postgres (or the store's existing backend) for cart, orders and inventory —
> that's why failover is seamless: compute fails over, data doesn't fork."

---

## ⚠️ The private-repo gotcha (important)

Your SPARSH repo appears to be **private**. Two consequences:

1. **GitHub Actions on a private repo** get only **2,000 free minutes/month**.
   A `*/5` monitor would burn those in ~7 days. → Keep the monitor on the
   **Cloudflare Worker cron** (free, unlimited), and run GitHub Actions only
   on-demand. (Your Aegis repo is public, so that one is fine.)
2. Render/Vercel/Pages deploys from a private repo need you to **authorise**
   the repo during setup — just click through the GitHub permission screen.
