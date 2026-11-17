# Vercel Dashboard + App-Origin Fix (current)

## Current live observations

- The portal is deployed at `https://aegis-platform-iota.vercel.app`.
- Its `/api/diagnostics` reports Supabase error `PGRST125: Invalid path specified in request URL` and therefore `historyRows: 0` / default targets.
- The protected Vercel app is now deployed at `https://aegis-platform-qrhr.vercel.app`; its `/health` endpoint returns HTTP 200 with `cloud: vercel`.
- Supabase `monitor_targets` has been updated to `https://aegis-platform-qrhr.vercel.app/health`.
- The live Cloudflare Worker still reports the old Vercel target as unhealthy; redeploy the updated Worker source (or update its `TARGETS` setting).

## 1. Fix the portal’s Supabase URL

In Vercel → project **`aegis-platform-iota`** → **Settings → Environment Variables**,
set these for Production:

- `SUPABASE_URL` = `https://kagjbxxmdyaypfcqemem.supabase.co`
  - Use the project root only: no `/rest/v1` suffix or extra path.
- `SUPABASE_KEY` = Supabase **publishable/anon** key, not `service_role`.
- `ADMIN_TOKEN` = a strong private value (optional for public status, needed for admin actions).

Save and redeploy. The code in this package also normalizes an accidental
`/rest/v1` suffix, but set the canonical root URL in Vercel as well.

Verify after redeploy:

- `https://aegis-platform-iota.vercel.app/api/diagnostics`
- Expected: `historyRows` > 0 and `targetSource` = `supabase.monitor_targets`.

## 2. Redeploy the Worker with the new live Vercel origin

The checked-in Worker target has been updated to:

- Render: `https://aegis-platform-pomf.onrender.com`
- Vercel: `https://aegis-platform-qrhr.vercel.app`

From the Git clone after pushing/pulling the updated code:

```bash
cd orchestration/router
npx wrangler deploy
```

If a Cloudflare `TARGETS` secret overrides defaults, replace it with the same
JSON target list before deploying. To inspect the Worker’s current view:

```text
https://aegis-router.manav32478.workers.dev/router/health
```

Expected when both app origins are reachable: both target entries show
`"healthy":true`. The routed `/health` endpoint reports which origin answered.

## 3. Verify the portal end to end

1. `https://aegis-platform-qrhr.vercel.app/health` → HTTP 200, `cloud: vercel`.
2. `https://aegis-platform-pomf.onrender.com/health` → HTTP 200, `cloud: render`.
3. `https://aegis-platform-iota.vercel.app/api/diagnostics` → nonzero `historyRows`; target names are not undefined.
4. `https://aegis-platform-iota.vercel.app/status.html` → status cards appear.
5. Worker `/router/health` → Render and Vercel health state is visible.

The current Worker tries healthy origins in configured order; it does not yet
route according to the dashboard’s composite health score. Perform a controlled
staging failover test before claiming failover is verified.
