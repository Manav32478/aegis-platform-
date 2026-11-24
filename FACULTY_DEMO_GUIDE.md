# Aegis — faculty demonstration guide

## A truthful project summary

Aegis is a **multi-cloud resilience prototype**. A web portal reports the health of application instances deployed on Render and Vercel. A Node monitor probes their `/health` endpoints and, when configured and permitted, stores check records, incidents and alerts in Supabase. A Cloudflare Worker checks origins and proxies traffic to a healthy one. A separate API service provides authenticated endpoints. The interface separates overview, service inventory, monitoring, incidents, alerts, routing, insights, developers, settings and public status.

The real Worker in this version prefers healthy origins in **configured order**; it does not dynamically select the lowest-latency origin or use the dashboard's advisory score. Actual multi-origin failover and automatic redeployment have not been verified end to end. Do not describe the prototype as production-ready, zero-downtime, free under all usage, a fully automatic application-deployment platform or a multi-tenant commercial SaaS.

## Demonstration links (check them again on demonstration day)

- Control-plane workspace: https://aegis-platform-iota.vercel.app/dashboard
- Diagnostics: https://aegis-platform-iota.vercel.app/api/diagnostics
- Render origin: https://aegis-platform-pomf.onrender.com/health
- Vercel origin: https://aegis-platform-11f7.vercel.app/health
- Worker metadata: https://aegis-router.manav32478.workers.dev/router/health
- Request routed by the Worker: https://aegis-router.manav32478.workers.dev/health
- Monitoring workflow: https://github.com/Manav32478/aegis-platform-/actions/workflows/monitor.yml

GCP and Oracle are currently disabled placeholders, not verified active deployments. The previous `aegis-platform-qrhr.vercel.app` address is obsolete. The dashboard shows a limited recent history sample; `1000` displayed checks does not mean there are exactly 1000 in the database.

## Before the presentation

1. Check internet and prepare the seven links above in tabs. Don't display keys, access tokens, or browser developer secrets.
2. Verify both direct health links return HTTP 200 and `status: ok`. Check portal diagnostics for `historyAvailable`, probe statuses and warnings; verify Worker metadata shows the intended targets. Each is only a point-in-time observation.
3. In GitHub Actions, inspect the last Health monitor run and whether it was triggered by `schedule` or manually. Expand `Run node monitor.js`: look for saved checks and actual error messages. A green job alone does not guarantee a database write, because some failures are handled by the code. If a schedule has not run, say so; GitHub scheduled workflows can be delayed.
4. Check the open incident count and relevant monitor records. Historical incident durations spanning a change from the old Vercel target to the new target are not proof of uninterrupted downtime.
5. Keep screenshots of the known-good pages as a backup, dated and explicitly labelled as screenshots, if network access is unreliable. Don't display screenshots as if they are live.
6. Do not stop production services, delete records, expose admin tokens, run migrations or dispatch deploy hooks during a faculty demonstration. A failover drill should use separate staging origins and authorization.
7. If you have prepared a separate API service, verify it is actually reachable and authenticated before opening its Swagger. The portal does not host that service at its own `/api-docs`.

## Suggested live demo (8–12 minutes)

**1. Introduction (one minute).**
“We built Aegis as a prototype for observing application origins across clouds and routing through healthy instances. The aim is to reduce the operational burden of spotting failures. It is an evaluation prototype, not a production SLA.”

**2. Show architecture (one minute).**
Explain the flow: clients → Cloudflare Worker → Render or Vercel copy of the app. Separately, a monitor probes health endpoints → Supabase stores history/incidents → the web portal reads and presents those records. The Worker target list and Supabase target table are configured independently. The API service is a separate process.

**3. Show overview and services (two minutes).**
Open the workspace. Point out active origins, latest probe status, mean latency and recent stored-check sample. Explain that GCP/Oracle entries are planned, not healthy running clouds. Visit Services and show the URLs. Explain that a health request represents a point in time, not continuous availability.

**4. Demonstrate direct health (one minute).**
Open both `/health` links. Point out `status`, `cloud` and timestamp. Explain that these are independently hosted application instances. `uptimeSeconds` and request counters may be per process/instance; serverless instances restart and they are not provider-wide uptime or billing metrics.

**5. Show monitoring and incidents (two minutes).**
Open Monitoring, Incidents and Alerts. Explain the difference between a live probe and a stored observation. Show a historical incident as a database record, not as a current outage. The historical Vercel event spans a target change; do not use its computed duration as proof of continuous outage. For alerts, show records and explain that a record is not proof of webhook/email delivery.

**6. Show router metadata (one minute).**
Open `/router/health` to show the Worker's cached target status. Open `/health` through the Worker to see which origin served that request. Say “The current code tries healthy origins in configured order. We haven't confirmed an end-to-end alternate-origin failover in a controlled staging drill.” Do not present the faster latency as the router's selection reason.

**7. Show monitor evidence (one minute).**
Open the Health monitor job and expand `Run node monitor.js`. Point out the HTTP status for each origin and the “saved checks” line. Explain that a manually triggered run demonstrates that run only; show a recent `schedule` run only if it exists. Don't run the monitor or expose its environment variables without permission.

**8. Insights and limitations (one minute).**
The cost model contains assumptions and is not linked to actual invoices; carbon data may be a fallback. Explain missing production authentication/tenant isolation, permissive demonstration RLS policies, need for stronger key management, monitoring reliability, and safe end-to-end failover testing. Share next steps: latency-aware selection with hysteresis, secure identity/RLS, production-grade observability, and managed deployment workflows.

## Questions and simple answers

**What problem does this solve?** It centralizes cross-provider health visibility and demonstrates routing to an available configured origin, rather than relying on one deployment and manual checks.

**Why multiple providers?** Independent deployments can reduce dependence on one provider, provided the application and its state are designed to work across them. Two URLs do not by themselves guarantee independence or reliability.

**Does it pick the fastest cloud?** No. It currently tries healthy origins in configured order. Latency-aware routing is future work.

**How do you detect failure?** A monitor and the Worker make HTTP requests to `/health`. A failed status or timeout is recorded as unhealthy by the respective component. The Worker has a short per-isolate cache; different observers can disagree temporarily.

**How are checks stored?** The Node monitor writes results to Supabase when connected and authorized. The portal reads them. The UI's displayed sample is not necessarily the full database history.

**How is an incident opened or closed?** The monitor tracks down/recovery transitions in the database when writes are authorized. The corrected monitor source only closes on a successful probe; verify the deployed scheduler uses that code. Logs and database records are evidence; a green workflow icon alone is not enough.

**Does it deploy a customer's application automatically?** No. An operator deploys compatible copies using cloud-provider tools, then configures health endpoints and targets. The existing self-healing dispatch is conditional and not independently verified end to end.

**Is it secure for real customers?** Not yet. The demo schema has permissive anonymous policies, the workspace lacks production user identity and tenant isolation, the API rate limit is per process, and the admin interface is prototype-grade. Use isolated staging data and redesign security first.

**Is it free / zero downtime?** Neither is guaranteed. Providers can change pricing, quotas or availability. The cost page uses illustrative assumptions.

**What is next?** Build and test a robust routing policy, use shared state/session strategy, harden authentication and database RLS, verify alerts and automated deployments, and run a controlled staging failover drill.

## Test and deployment notes

See `START_HERE.md` and `LIVE_TROUBLESHOOTING.md`. As of the local review, `cd tests && npm ci && npm test -- --runInBand` passed 17 suites and 87 tests. UI routes and APIs were smoke checked; this does not cover real provider configuration or end-to-end failover. The latest live monitor run shown in the user-provided evidence was manually triggered. The security/deploy GitHub workflows had failed jobs; inspect their actual run logs rather than claiming CI is entirely green.
