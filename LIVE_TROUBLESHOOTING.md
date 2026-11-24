> **Update:** The QRHR URL discussed below is historical. The user deployed `https://aegis-platform-11f7.vercel.app` and updated the Supabase target and Worker dashboard variable. Re-check live status before relying on it.

# Aegis live diagnosis and repair guide

## What was observed

The live control-plane portal at `https://aegis-platform-iota.vercel.app/dashboard` returned data, and Render `/health` responded HTTP 200. At the time of the check, `https://aegis-platform-qrhr.vercel.app/health` returned Vercel HTTP 404 `DEPLOYMENT_NOT_FOUND`; the Worker health endpoint also showed that Vercel target as unhealthy. Your screenshot showed an intermittent Supabase `fetch failed` while reading history. A later diagnostics request returned history successfully. This indicates an intermittent read failure, not proof that records were deleted.

These are observations at one point in time, not an availability guarantee. The ZIP cannot restore a deleted/missing Vercel deployment, assign a domain, edit provider settings, repair Supabase network access, or deploy a Worker. Those actions require access to your accounts and verification. Do not hide an actual down service or fabricate green status.

## Code improvements in this ZIP

- The portal distinguishes an unreadable history query from an empty result and shows `Unavailable` rather than a misleading zero. It labels the check count as a limited returned sample, not the database total. A warning links to diagnostics.
- Supabase network reads have a bounded timeout and one retry; writes are never automatically retried. This may reduce transient network failures but cannot fix invalid credentials, permissions, a paused project or provider outages.
- Snapshot caching has a 30-second maximum age and concurrent requests share the same build; the Vercel runtime does not depend on a background timer for the portal snapshot.
- The app-origin dashboard links directly to the configured control-plane portal, since it does not read stored history itself.
- The monitor and Worker source close an incident only when the affected origin has a successful probe. Previously, an unmonitored/disabled origin could have been incorrectly marked recovered. The Worker source filters disabled entries in its environment target list.
- Open incidents no longer imply that failover actually occurred in the portal snapshot. An actual controlled test is still required.

Changes take effect only after the relevant portal, application, monitor and/or Worker are deployed. Existing records are not automatically corrected retroactively. Tests do not prove production readiness or real-world failover.

## Step 1 — restore the Vercel application origin

1. In Vercel, find the project that owns the `aegis-platform-qrhr.vercel.app` domain. Under **Deployments**, inspect the latest production deployment and build/function logs. Under **Settings → Domains**, confirm that domain is assigned to the correct project. A 404 `DEPLOYMENT_NOT_FOUND` points to a deployment/domain problem, but the account is needed to identify the exact cause.
2. If you need to redeploy the application, ensure the project uses this GitHub repository and the **Root Directory is `app`**. Use the project's `app/vercel.json`, Node 20 or newer, and `CLOUD_NAME=vercel`. Deploy from the intended Git branch. A successful local test does not validate this cloud build.
3. Open `https://aegis-platform-qrhr.vercel.app/health`. It must return HTTP 200 and JSON such as `{"status":"ok", ...}`. Also check `/dashboard` and `/assets/saas.css`. Do not continue claiming both origins are operational if this URL fails.
4. If a different Vercel domain was assigned, test its `/health` first. Then update the Vercel target in the portal's Supabase `monitor_targets` table through the portal `/admin.html` or Supabase Table Editor, as permitted by your staging database policy. The old admin page can add/toggle/delete targets but does not provide a general URL-edit form; review all rows before changing anything. Avoid duplicate enabled entries. **This update alone does not change the Worker.**
5. Update the Worker's configured `TARGETS` JSON separately (base URLs, not `/health`) and redeploy only after verifying the account, intended Worker and route. See `START_HERE.md` section 5. If `TARGETS` is unset, the Worker uses its code defaults and a new URL requires updating config/source. Do not use the portal's own domain as the second application copy just to make the card green.

## Step 2 — investigate intermittent Supabase history reads

1. Open `https://aegis-platform-iota.vercel.app/api/diagnostics` and check `diagnostics.historyAvailable`, `historyRows`, `targetSource` and `warnings`. The new `historyAvailable` field appears only after this version of the portal is deployed.
2. In Supabase, confirm the intended project is active, reachable and has the `health_checks`, `incidents`, `alerts`, and `monitor_targets` tables. Inspect the monitor's logs and the table timestamps; the dashboard's count is only a limited recent sample. A read error cannot prove the table is empty.
3. In the Vercel **portal project** environment settings, check `SUPABASE_URL` is the correct project root URL without `/rest/v1`, and `SUPABASE_KEY` is the appropriate staging key. Confirm RLS permissions, network reachability and whether the project is paused or quota-limited. Check Vercel function logs at the failure time. Do not send keys in screenshots or chat.
4. If settings are changed, redeploy that portal and recheck diagnostics. Brief failures can still happen; retry does not guarantee connectivity. A persistent `fetch failed` needs provider-side investigation.
5. Verify the selected monitoring scheduler is actually running and writing to the intended database. Check its logs and recent `health_checks` timestamps. Do not run an unreviewed monitor against a real database, especially with GitHub self-heal tokens or alert webhooks set: it writes data and may trigger actions.

## Step 3 — verify incidents and failover

- The incident may remain open until the monitor runs again and successfully probes the affected origin. Confirm the configured monitor is active and has the required write permissions. Do not manually close an incident before investigating why it is open.
- `https://aegis-router.manav32478.workers.dev/router/health` shows the Worker's own target health, which can differ from portal probes and refreshes. Verify both. A successful metadata call does not prove traffic failover.
- For end-to-end failover, use two equivalent staging copies, then follow `START_HERE.md` section 6. The router chooses healthy targets in configured order; it does not use the dashboard's health score. Failure, recovery, alert delivery and automatic redeployment have not been verified end-to-end.

## Security and limitations

This is an evaluation prototype, not a production-ready multi-tenant SaaS. `infra/schema.sql` has permissive anonymous policies, including data modification and deletion. An admin token in the portal does not protect direct Supabase access under those policies. Use disposable staging data and redesign authentication, authorization, RLS, key handling and logging before real customer use. Avoid committing keys, `.env` files or private tokens.

Automated tests and local HTTP smoke checks passed; cloud deploy, browser/device behavior, alert delivery, scheduler permissions, failover and account-level settings were not verified. Cost values are assumptions rather than bills. Existing documentation predating this guide may contain outdated claims.
