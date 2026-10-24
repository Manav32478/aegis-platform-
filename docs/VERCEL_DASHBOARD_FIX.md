# Fix the deployed Aegis dashboard on Vercel

## What the deployed page showed

The dashboard at `aegis-platform-iota.vercel.app` rendered, but showed 0 checks,
no cloud cards, and an unnamed Vercel probe. Two separate configuration/code
issues caused that:

1. The Vercel portal function was returning an empty Supabase history result.
   The older code hid the Supabase request error and displayed an empty dashboard.
   The updated code adds a safe `/api/diagnostics` endpoint and a visible warning
   banner so this is no longer silent.
2. The default Vercel target still pointed at the retired
   `aegis-platform-lyart.vercel.app` deployment, which currently returns 404.
   The fallback target-name mapper also expected database-shaped `cloud_name`
   fields, although built-in config uses `name`. The updated code normalizes both.

## A. Update the portal's Vercel environment

In Vercel → project `aegis-platform-iota` → **Settings → Environment Variables**,
add or correct these for **Production**:

- `SUPABASE_URL` = `https://kagjbxxmdyaypfcqemem.supabase.co`
- `SUPABASE_KEY` = the Supabase **publishable/anon** key
- `ADMIN_TOKEN` = a new strong token you create; do not use `aegis-demo` publicly

Never use the Supabase `service_role` / secret key in this project’s browser-facing
portal. Save and redeploy the latest GitHub commit.

After redeploy, open:

- `https://aegis-platform-iota.vercel.app/api/diagnostics`
- `https://aegis-platform-iota.vercel.app/api/live`

`/api/diagnostics` should show `historyRows` greater than zero, `targetSource`
`supabase.monitor_targets`, and probe names `render`, `vercel`, etc. It will show
warnings when Supabase or an origin is still misconfigured.

## B. Restore a real Vercel application origin

The old origin `https://aegis-platform-lyart.vercel.app` currently returns a
Vercel `DEPLOYMENT_NOT_FOUND` 404. The dashboard cannot mark that as healthy.
The current `aegis-platform-iota` project is the **control-plane dashboard**, not
necessarily the protected application copy.

Deploy the protected application as a separate Vercel project:

1. Vercel → Add New Project → import `Manav32478/aegis-platform-`.
2. Set **Root Directory** to `app` (not `web` and not `examples/ecommerce`).
3. Keep the Vercel/Node preset as detected by `app/vercel.json`.
4. Add `CLOUD_NAME=vercel` for Production and deploy.
5. Confirm the new URL plus `/health` returns JSON with `"cloud":"vercel"`.

Then update the Aegis `monitor_targets` table to that new URL:

```sql
update monitor_targets
set url = 'https://YOUR-NEW-APP-URL.vercel.app/health', enabled = true
where cloud_name = 'vercel';
```

Also update the Vercel base URL in `orchestration/router/src/worker.js`, commit and
push, then deploy the Worker from `orchestration/router` with `npx wrangler deploy`.

## C. Verify in this order

1. `https://YOUR-NEW-APP-URL.vercel.app/health` → JSON, `cloud: vercel`, HTTP 200.
2. `https://aegis-platform-pomf.onrender.com/health` → JSON, `cloud: render`, HTTP 200.
3. `https://aegis-platform-iota.vercel.app/api/diagnostics` → Supabase history count > 0; targets named, not `undefined`.
4. Dashboard → live probes show Render and Vercel with correct names and URLs.
5. Worker `https://aegis-router.manav32478.workers.dev/router/health` reports both origins healthy when both are available.

Do not call it a completed multi-cloud application failover until both origins
run the same application and an authorized staging failover test confirms the
router actually serves the alternate copy.
