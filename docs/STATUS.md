# Aegis — Current Project Status

> Audited 2026-11-12. This document records observed deployment state; recheck
> live URLs and workflow runs before a presentation.

## Live verification

| Component | Current observation |
|---|---|
| Render protected app | `/health` returns HTTP 200 |
| Cloudflare Worker | Deployed; router `/health` currently proxies Render |
| Vercel control-plane portal | `https://aegis-platform-iota.vercel.app` loads; `/health` identifies `aegis-web` |
| Supabase database | Direct API returns health history and monitor targets |
| Vercel portal → Supabase | `/api/diagnostics` reports `PGRST125 Invalid path specified`; correct the Vercel `SUPABASE_URL` and redeploy |
| Vercel protected app origin | ✅ `aegis-platform-qrhr.vercel.app/health` returns HTTP 200; Supabase target updated. Worker source must be redeployed with this origin. |
| Cloudflare cron → Supabase | No `cloudflare-edge` rows observed; configure Worker secrets and verify a scheduled write |
| GitHub Actions | Recent Health monitor runs succeeded; most recent deploy/security status has failures that need review |
| Local tests | 37 tests / 10 suites pass in the workspace |

## Code fixes in the current package

- Supabase base URL normalization strips a mistakenly copied `/rest/v1` suffix.
- Dashboard probes normalize both Supabase target rows (`cloud_name`) and defaults (`name`) so labels aren’t undefined.
- Disabled origins are skipped; active probe failures display their status/reason.
- Dashboard displays Supabase/target diagnostics; `/api/diagnostics` returns safe status/count information without secrets.
- Deploy workflow no longer puts GitHub secrets directly in job-level `if` expressions.

## Remaining production-pilot tasks

1. Push this package from a Git clone and wait for the Vercel portal deployment.
2. In Vercel `aegis-platform-iota`, set `SUPABASE_URL` to the project root
   `https://kagjbxxmdyaypfcqemem.supabase.co` (no `/rest/v1`) and `SUPABASE_KEY`
   to the publishable/anon key; redeploy.
3. Confirm `/api/diagnostics` returns a positive `historyRows` count and
   `targetSource: supabase.monitor_targets`.
4. Deploy a protected app copy to Vercel from root directory `app/`, with
   `CLOUD_NAME=vercel`; verify its `/health` JSON.
5. Update Supabase `monitor_targets` and Cloudflare Worker `TARGETS` to the new
   Vercel app URL; redeploy the Worker.
6. Add Worker secrets `SUPABASE_URL` and `SUPABASE_KEY`; verify a scheduled
   `cloudflare-edge` check appears in Supabase.
7. Run a controlled staging failover and document the actual result before
   presenting two-origin failover as verified.

## Claims to avoid until verified

- Do not say three app origins are active: Render responds; the configured
  Vercel app target is stale; Cloud Run and Oracle are disabled/planned.
- Do not say the Worker selects the highest dashboard score: it currently tries
  healthy origins in configured order.
- Do not guarantee automatic redeployment or zero downtime: redeploy depends on
  tokens/hooks and no production SLA has been established.
- Do not promise unconditional ₹0 operation: free-tier limits and overages vary.
- Do not describe the demo API as production tenant-isolated: RLS and
  in-memory rate limiting need hardening before customer data is used.
