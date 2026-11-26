# Aegis staging upgrade — setup and verification

This guide is for **staging only**. Do not enter live-service credentials or point staging configuration at your existing Aegis demo resources. Never paste keys, tokens, passwords, deploy hooks or environment-variable screenshots into chat. The staging portal is not a production-secure or multi-tenant service: use dummy/public data only.

## What this update does and does not do

- Adds explicit `AEGIS_MODE=staging` validation for the Node portal and monitor: Supabase URL/key, router URL and monitor `TARGETS` must be supplied, and known live demo hosts are rejected. This guard blocks known live addresses; it cannot prove every resource is isolated. Legacy mode (when unset) retains existing behavior, including live-demo defaults.
- Staging monitor and portal use explicit `TARGETS`, ignoring database-managed targets. Automatic self-healing, alert writes/delivery and staging admin APIs are disabled. The new GitHub staging monitor is manual only.
- Adds a **separate experimental staging Worker** (`orchestration/router/src/staging-worker.js`), with no defaults, database or scheduler. Default is fixed priority; optional `latency` mode measures health-check round-trip times per Worker isolate, applies an EWMA and requires a 30 ms or 20% margin (whichever is greater) for three consecutive refreshes before switching. These are rough per-edge measurements, not guaranteed real-user performance. GET/HEAD requests retry an alternate healthy origin on 5xx or a fetch exception; other methods are sent at most once, including on exceptions. GET/HEAD must still be side-effect-free in your application. A 2-second health timeout and 10-second per-isolate cache apply.
- Adds a portal Services → Add an application helper. It produces configuration locally in the browser; it does not deploy, save configuration, create accounts, or implement multi-tenant authorization.
- Adds a clean-database staging SQL schema. No anonymous table access is granted; server-side monitor/portal use a staging-only service-role key. The legacy production/demo schema remains unchanged and is permissive.
- Local tests use simulated/mocked providers. Cloudflare, Supabase SQL, database permission behavior, Vercel builds, browser behavior and actual failover still need live verification. Existing deployment workflows can trigger production hooks when main changes; see GitHub before pushing.

## 1. First perform the existing staging router's simulated failover

On Cloudflare, open `aegis-staging-1795701019` (NOT the live `aegis-router`). Temporarily set its `TARGETS` to:

```json
[{"name":"render","url":"https://aegis-unavailable.invalid"},{"name":"vercel","url":"https://aegis-staging-sample.vercel.app"}]
```

Save/deploy if prompted. Wait at least 10 seconds and visit `/router/health` (expect Render false, Vercel true) and `/health` (expect `cloud: vercel`). Save evidence with timestamps. This is a misconfigured/unreachable endpoint simulation, not a real outage. Always restore:

```json
[{"name":"render","url":"https://aegis-staging-sample.onrender.com"},{"name":"vercel","url":"https://aegis-staging-sample.vercel.app"}]
```

Confirm both healthy. Different edges have separate caches; observations can lag or differ.

## 2. Push code and verify CI

The ZIP is based on main commit `33dd05144f69c8ef7b13726d2777caaa9289d7d6`. Use the accompanying chat's guarded commands. Review the staged diff before committing. A main push may trigger Vercel and GitHub deployment hooks for existing services; push only when ready. Check both GitHub security and deployment workflows. A successful trigger job does not prove provider deployment completion.

## 3. Deploy a NEW experimental staging Worker

In a terminal in the new project checkout (not the sample site checkout), authenticate to the intended Cloudflare account and deploy a new unique Worker name; do not overwrite either existing Worker:

```sh
npx wrangler login
npx wrangler deploy --config orchestration/router/wrangler.staging.toml --name "aegis-stage-v2-$(date +%s)"
```

Follow Wrangler prompts; save the new `workers.dev` URL. It returns 503 until configured. In **that new Worker's** Settings → Variables and Secrets add text variable `TARGETS`:

```json
[{"name":"render","url":"https://aegis-staging-sample.onrender.com"},{"name":"vercel","url":"https://aegis-staging-sample.vercel.app"}]
```

Add `ROUTING_MODE=priority`, save/deploy, then inspect `/router/health`, `/health`, and `/`. Both targets should be healthy; `/health` should ordinarily return Render while healthy. Later, only after verifying basic routing, try `ROUTING_MODE=latency` and inspect `mode`, `selected`, and the measured latency values on `/router/health`. Three qualifying samples require separate refreshes, normally over at least 30 seconds of traffic. Health round-trip time is not a full application performance metric. Metadata and selection may vary across edge isolates. No real-user latency improvement or global consistency is guaranteed.

## 4. Create an isolated staging Supabase project

Create a **new** Supabase project, separate from the existing Aegis one. Check plan limits and possible charges first. Confirm its project reference and URL are not the existing project's. Never run the following SQL against a live database or any database with real data.

In the new project's SQL Editor, paste and run the contents of `infra/staging-schema.sql`. It checks for existing similarly named tables and aborts if found; that alone cannot guarantee you chose the right project. No target rows are seeded. The schema has RLS with no anonymous table policies and expects server-side `service_role` access. The SQL has not been exercised against a live Supabase project yet; if it errors, stop and capture the error without secrets.

Retrieve the **new staging** project's URL and legacy service-role JWT key from its API settings. Store the key only in server-side secret settings; it bypasses RLS and must never be exposed to browser code or committed. This prototype's REST client passes it as a Bearer token; compatibility with newer `sb_secret_` key formats has not been verified. Use only dummy staging data. Do not use the original project's keys.

For monitoring configuration, use this JSON (these URLs include `/health`, unlike the Worker's base URLs):

```json
[{"name":"render","url":"https://aegis-staging-sample.onrender.com/health","region":"staging","enabled":true},{"name":"vercel","url":"https://aegis-staging-sample.vercel.app/health","region":"staging","enabled":true}]
```

## 5. Set up a separate staging portal on Vercel

Create a **new Vercel project** from the updated Aegis GitHub repository, not the existing Vercel project. Use repository root and the existing root `vercel.json`. Add server-side environment variables before deploying:

- `AEGIS_MODE`: `staging`
- `SUPABASE_URL`: new staging Supabase project URL
- `SUPABASE_KEY`: new staging project's **server-side** service-role JWT key; mark sensitive if supported
- `AEGIS_ROUTER_URL`: the new staging Worker base URL, no trailing slash
- `TARGETS`: the monitoring JSON above

Do not add `GITHUB_TOKEN`, deploy hooks, webhooks, or alert credentials. The staging admin APIs are disabled. Deploy, then open `/api/diagnostics`: check target source is `environment.staging`, both probes are the sample site, and router metadata describes your staging Worker. Before running the monitor, history may be empty. If deploy fails, examine logs without sharing environment values. The staging portal's dashboard and API responses are publicly accessible; use only disposable test data.

## 6. Manually run the staging monitor

In the Aegis GitHub repository, Settings → Environments → create `aegis-staging`. Add these environment secrets:

- `STAGING_SUPABASE_URL`: new staging Supabase URL
- `STAGING_SUPABASE_KEY`: same new staging server-side service-role JWT key
- `STAGING_ROUTER_URL`: new staging Worker URL
- `STAGING_TARGETS`: the monitoring JSON above

Then go to Actions → **Staging monitor (manual only)** → Run workflow on main. Confirm the logs show the sample targets and `saved 2 checks`. A failure to save should fail the staging job. Refresh the staging portal `/api/diagnostics`; verify historyAvailable and historyRows, then inspect monitoring. Do not rely only on a green check: confirm actual rows. Alerts, external webhooks and self-healing dispatch are disabled in staging; the incident code can still create/close staging database incidents.

## 7. Test actual staging-only outage and recovery

Only use the disposable **Northstar staging** Render service. Ensure you can reverse the provider action before taking it. Do not affect the existing Aegis Render service. If Render offers a reversible suspend/pause with a clear resume action, take the staging Render origin offline, then allow health caches to refresh. Verify directly that Render is unavailable, the staging Worker reports it unhealthy and `/health` reports Vercel. Run the staging monitor manually and verify an open staging incident. Restore/resume the staging origin promptly, verify direct health and Worker health, run the monitor again, then verify the incident closed. Record timestamps and screenshots. Do not use a delete action; if there is no clear reversible pause/resume option, stop and ask for help instead.

An experimental retry of a GET/HEAD with a simulated 5xx was tested locally only; a health failure test does not prove HTTP 5xx retry. A thrown network failure may occur after the origin performed work, so non-idempotent methods are not retried. Alerts/delivery and auto-redeploy remain disabled and unverified.

## 8. Shared data and application onboarding

Both origins must serve compatible app versions. For stateful apps, use a deliberately designed shared database, consistent migrations, centralized sessions and shared object storage; local disk and in-memory sessions won't sync between cloud instances. Add transactional/idempotency protection, access control and provider-specific build adaptations. `GET /health` should represent readiness accurately and respond within the Worker timeout. The setup helper only generates JSON and cannot automatically deploy arbitrary repositories.

Do not deploy this prototype for customer workloads without authenticated tenancy, RLS redesign, secret management, origin restrictions, safe retry semantics, abuse controls, observability and end-to-end testing. No zero-downtime, cost, automatic redeploy or latency-SLA guarantee is made.
