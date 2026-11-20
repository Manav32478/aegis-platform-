> **Live-service repair:** Read `LIVE_TROUBLESHOOTING.md` first for the observed Vercel 404, intermittent database history failures, deployment and validation steps. This ZIP cannot repair provider accounts by itself.

# Aegis — redesigned workspace: setup, testing and deployment

This is the current guide for the redesigned version. Older README and files under `docs/` describe earlier versions and may contain outdated routes, pricing, deployments or claims; use this guide when they conflict.

## 1. What you have

- `app/`: the protected application/origin, including the redesigned workspace, `/health` and `/api/platform/summary`. It probes configured origins directly; it does **not** provide stored incident history.
- `web/`: the control-plane portal, with the same workspace and the existing Supabase-backed `/api/live`, diagnostics and admin page. It can display history, incidents and alerts if its database is working.
- `api/`: separate API service with Swagger at `/api-docs` and API-key checks.
- `orchestration/monitor.js`: probes targets and can write checks, incidents and alerts; optional self-healing and webhooks can cause real actions.
- `orchestration/router/`: Cloudflare Worker, which probes and proxies requests to healthy targets in configured order. It is a separate deployment from the portal and app.
- `infra/schema.sql`: original demonstration database schema. Read the security warning below before running it.
- `tests/`: automated tests. This package's latest local run passed 13 suites / 73 tests; this is not an end-to-end production validation.

The workspace has separate pages for overview, services, monitoring, incidents, alerts, routing, insights, developers, settings and status. Services is a **read-only inventory**. The portal's legacy `/admin.html` can manage database targets when configured; it is not a full application-deployment interface. There is no implemented customer sign-in, billing, tenant isolation, one-click deployment of arbitrary apps, or production SLA. The cost model assumes $0 and is not connected to bills. Historical rows are a limited sample, not a guaranteed uptime measurement. Routing and redeployment must be tested separately.

### Security: important before you begin

This is a prototype, not a production-ready SaaS. The existing `infra/schema.sql` includes permissive anonymous read/write/delete policies, including on target and API-key tables. An admin token on the web server does **not** prevent direct Supabase access under permissive policies. Do not use the supplied schema with real customer data, sensitive API keys or a production database. Use a separate disposable/staging Supabase project and redesign RLS, identity, server-side authorization and key management before production. The existing admin page saves its token in browser localStorage; use only a trusted browser. The API rate limit is in memory per process, not a distributed protection. Disable scheduled jobs and real webhooks while experimenting.

Existing source contains fallback addresses and a publishable Supabase key for the original project. Set **your own** staging `SUPABASE_URL` and `SUPABASE_KEY` explicitly before running the portal, monitor or API. Otherwise they can contact the original project. `monitor.js`, key generation, admin operations and scheduled jobs can **write** to the configured database; do not run them until you have checked their target. Never put service-role keys, GitHub tokens or `.env` files in Git, ZIPs, browser code or screenshots.

## 2. Run and test on your computer

Prerequisites: Node.js 20 or newer, npm and Git. Install from nodejs.org and git-scm.com. Unzip the archive. In Terminal, change to the extracted project folder. Example if extracted to Desktop:

```bash
cd ~/Desktop/aegis-platform
node -v
npm -v
```

### A. Application origin (no database required)

In terminal 1:

```bash
cd ~/Desktop/aegis-platform/app
npm ci
CLOUD_NAME=local PORT=3000 npm start
```

Open <http://localhost:3000/dashboard>. Click every sidebar item, refresh, and check mobile sizing. The app currently probes its built-in remote demo target URLs unless `AEGIS_TARGETS` is set. `AEGIS_TARGETS` is a JSON array, e.g. `[{"name":"local-app","url":"http://localhost:3000","region":"local","enabled":true}]`; a `/health` suffix is added if needed. Set it in the application environment before starting. Router metadata uses `AEGIS_ROUTER_URL` if set, otherwise an existing Worker URL. This view intentionally reports history as unavailable.

In another terminal:

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/api/platform/summary
curl -I http://localhost:3000/assets/saas.css
```

Expect a JSON `status` of `ok` from `/health`, and a summary containing `origins`. A 200 summary response does not mean every target is healthy: check each origin's `healthy`, `status`, URL and timestamp.

### B. Control-plane portal (requires your staging database for history)

In terminal 2, from the root of your extracted project:

```bash
cd ~/Desktop/aegis-platform/web
npm ci
# Replace both values with the project URL (without /rest/v1) and key for YOUR staging project.
export SUPABASE_URL='https://YOUR-STAGING-PROJECT.supabase.co'
export SUPABASE_KEY='YOUR_STAGING_PUBLISHABLE_KEY'
export ADMIN_TOKEN='REPLACE_WITH_A_LONG_RANDOM_TOKEN'
PORT=3100 npm start
```

Open <http://localhost:3100/dashboard> and <http://localhost:3100/status>. Review `/dashboard/services`, `/dashboard/monitoring`, `/dashboard/incidents`, `/dashboard/alerts`, `/dashboard/routing`, `/dashboard/insights`, `/dashboard/developers`, `/dashboard/settings`. Open <http://localhost:3100/api/diagnostics> to see target source, endpoints, HTTP codes and warnings. A fresh or inaccessible database can show empty history; this does **not** prove there have been no incidents.

For an isolated staging experiment, create a disposable Supabase project, review `infra/schema.sql` and its permissive policies, and run it **only after understanding the risks**. Check the SQL editor actually reports success and confirm the expected tables exist. Set the variables above; restart the portal. Database target rows take precedence in the portal and Node monitor. Changes in `/admin.html` affect those rows, not the Worker's configuration. Admin endpoints are disabled unless `ADMIN_TOKEN` is explicitly set. Store the token outside Git, and never reuse it for production.

### C. API service

In terminal 3, with the same staging Supabase variables exported in that terminal:

```bash
cd ~/Desktop/aegis-platform/api
npm ci
# Demo key is only for local testing; never use this example key in production.
ALLOWED_KEYS=local-test-key PORT=4000 npm start
```

Open <http://localhost:4000/api-docs>. In a fourth terminal:

```bash
curl -i http://localhost:4000/health
curl -i http://localhost:4000/api/status
curl -i -H 'x-api-key: local-test-key' 'http://localhost:4000/api/cost-report?requests=1000000'
```

The health route should return 200, the missing-key call 401, and the authorized cost route 200. It returns a model, **not** an actual bill. History endpoints also require the configured staging database to have rows and permissions. API keys created by `node generate-key.js` write to Supabase; only run it against a disposable staging database and keep the printed key private. The API's demo key authentication bypass does not create a real organization or tenant boundary.

### D. Automated tests

```bash
cd ~/Desktop/aegis-platform/tests
npm ci
npm test -- --runInBand
```

Tests include logic, UI script syntax and simulated page rendering. They do not verify a real browser, database writes, cloud deployments, provider account configuration, real alerts or actual failover. Also manually inspect the pages on desktop and phone. Stop each local server with Ctrl+C.

### E. Optional: test the monitor against staging

Set `SUPABASE_URL` and `SUPABASE_KEY` to a **disposable staging database** and ensure no deployment tokens/webhooks are set. `TARGETS` is JSON containing full health URLs. If the staging `monitor_targets` table contains enabled rows, the monitor uses those instead of `TARGETS`; inspect `/api/diagnostics` and the table first.

```bash
cd ~/Desktop/aegis-platform
export SUPABASE_URL='https://YOUR-STAGING-PROJECT.supabase.co'
export SUPABASE_KEY='YOUR_STAGING_PUBLISHABLE_KEY'
export TARGETS='[{"name":"staging-app","url":"https://YOUR-STAGING-APP/health","region":"test","enabled":true}]'
node orchestration/monitor.js
```

This is **not** read-only: it can write checks, incidents and alerts. Confirm the logs and staging table records, then refresh portal monitoring, incidents and alerts. If the database rejects a write, inspect table schema and RLS. Monitor self-healing requires configuration such as `GITHUB_TOKEN`; keep it unset while testing.

## 3. Deploy your application as an origin

Aegis does not upload or install an arbitrary application for you. First deploy your own application using your provider's normal process. It must expose a publicly reachable `GET /health` endpoint that returns HTTP 200 when healthy. For routing multiple copies, deploy the **same application** to at least two origins and ensure compatible routes, persistent storage, sessions, secrets and databases. Aegis does not synchronize state for you. Do not put an untrusted URL or an internal/private service in the monitor/Worker target list.

Example: deploy this repository's sample `app/` to Render as a web service. Connect the GitHub repository; set root directory `app`, runtime Node, build command `npm ci`, start command `npm start`, and environment variable `CLOUD_NAME=render`. Render supplies `PORT`. When the service is ready, open `https://YOUR-RENDER-APP.onrender.com/health` and confirm HTTP 200. Free-plan availability, sleep behavior, quotas and costs vary; check the provider.

To deploy the app on Vercel, create a **separate** Vercel project linked to the repository, set the project Root Directory to `app`, use its `app/vercel.json`, and set `CLOUD_NAME=vercel`. Deploy and check `https://YOUR-VERCEL-APP.vercel.app/health`, then `/dashboard`, a nested page such as `/dashboard/services`, and `/assets/saas.css`. The app's source includes the required static files in its Vercel configuration. Actual Vercel builds and deployment have not been verified in this handoff; use the provider build and function logs to troubleshoot.

On both app deployments, configure `AEGIS_TARGETS` with the base URLs you want the app workspace to probe, and `AEGIS_ROUTER_URL` if you have your own Worker. These settings affect **this application workspace only**; they do not configure the portal database or the Worker. Use provider environment settings, not a committed file.

## 4. Deploy the control-plane portal

Create a **different** Vercel project linked to the same GitHub repo. Set its Root Directory to the repository root (`.`), so the portal can access `packages/`, `intelligence/` and `orchestration/`. The root `vercel.json` routes to `web/api/index.js` and includes `web/public/**`. Configure your staging `SUPABASE_URL`, `SUPABASE_KEY`, a strong `ADMIN_TOKEN`, and optionally `AEGIS_ROUTER_URL` in Vercel project environment settings. Deploy and check `/dashboard`, `/dashboard/services`, `/assets/saas.js`, `/api/diagnostics` and `/health`. This root configuration is separate from the origin project's `app/vercel.json`.

These Vercel configurations are provided for deployment but have not been tested on Vercel. If deployment fails, inspect build/function logs, verify Node 20+, project root and function file inclusion; don't assume a successful local server means the cloud build works. Serverless instances can be short-lived, so the existing background realtime hub/SSE is not a durable scheduler. The workspace uses HTTP snapshot polling; use an independently scheduled monitor for history.

Alternatively deploy the portal as a Docker web service using repository root as build context and `web/Dockerfile`. Deploy the API separately using root context and `api/Dockerfile`, port 4000. Their server code depends on folders outside `web/` and `api/`, so a build context restricted to only those folders will fail. Configure the staging environment variables on each service. Existing `docker-compose.yml` is an optional local setup and starts a monitor that writes to the configured database; review it and set staging values first.

## 5. Deploy and configure the Worker (optional)

Only after both staging origins have working health endpoints:

```bash
cd ~/Desktop/aegis-platform/orchestration/router
npx wrangler login
npx wrangler whoami
```

If browser login fails or times out, resolve Cloudflare authentication first; do not assume it deployed. The checked-in `wrangler.toml` defines the Worker name and a five-minute cron. Review the Cloudflare account, Worker name, routes, cron and any existing production impact before deploying.

```bash
npx wrangler secret put TARGETS
```

When prompted, paste one line with **base** URLs, without `/health` or trailing slashes, e.g.:

```json
[{"name":"render","url":"https://YOUR-RENDER-APP.onrender.com"},{"name":"vercel","url":"https://YOUR-VERCEL-APP.vercel.app"}]
```

For the Worker's optional scheduled monitor, also set `SUPABASE_URL` and `SUPABASE_KEY` using `npx wrangler secret put ...`, pointing to staging. The cron can write checks/incidents/alerts; remove or disable the cron and omit database credentials if you only want routing. Then deploy:

```bash
npx wrangler deploy
```

Visit `https://YOUR-WORKER.workers.dev/router/health`. The target list and cached health should match your intended Worker configuration. Visit `/health` through the Worker too. Do not confuse the Worker base-URL `TARGETS` secret with the Node monitor `TARGETS` variable, which expects full health URLs. Configure the portal database, app `AEGIS_TARGETS`, and Worker targets independently, then compare them. The updated Worker source filters entries marked enabled:false; deployed Worker behavior changes only after a successful deployment.

## 6. Safe failover test

Use two disposable staging origins serving the same app and avoid production traffic. Check both direct `/health` endpoints and the Worker `/router/health`. Record which origin the Worker serves (the app health response includes `cloud`). Make the *first staging origin* unavailable using your hosting provider; wait longer than the Worker's 10-second health-cache TTL, then request `/router/health` and `/health` via the Worker. Confirm the second origin actually serves requests and check the logs and timestamps. Restore the first origin and verify recovery. If all targets are unhealthy, expect Worker HTTP 503. The code tries a second healthy target when proxy fetch throws; it does not generally retry merely because an origin returns an application HTTP error. Test ordinary application routes, not only `/health`. Do not claim failover succeeded unless you observed it.

## 7. GitHub push

The ZIP does not contain `.git`. Do not run `git push` inside the extracted ZIP. Clone the existing repository, copy the ZIP contents into the clone, inspect changes, commit, then push. The copy command below preserves existing repo files that are not in the ZIP (no destructive `--delete`).

```bash
cd ~/Desktop
git clone https://github.com/Manav32478/aegis-platform-.git aegis-platform-git
# If your extracted folder is elsewhere, replace the SOURCE path below.
rsync -av --exclude='.git/' --exclude='.env' --exclude='.env.*' --exclude='node_modules/' --exclude='.DS_Store' ~/Desktop/aegis-platform/ ~/Desktop/aegis-platform-git/
cd ~/Desktop/aegis-platform-git
git status
git diff --stat
git diff
# Confirm no secrets or unrelated changes before staging.
git add -A
git status
git diff --cached --stat
git commit -m "Redesign Aegis as a multi-page SaaS workspace"
git branch --show-current
git push origin HEAD
```

If the destination folder already exists, choose a new clone directory; do not delete your existing work. If your clone's current branch is not the branch you intend, stop and switch/create the appropriate branch before committing. If GitHub requests authentication, use a configured credential helper/personal access token or SSH; do not paste credentials into the command or repository. `git push origin HEAD` pushes the current branch, not necessarily `main`. The workflow can run on a push to `main`; it may run security checks or trigger configured deployment hooks, so review GitHub Actions and provider integrations **before** pushing. Deployment jobs may skip when secrets are absent and a successful push is not proof of a successful deployment.

## 8. Troubleshooting

- **Port in use:** stop the other process or choose a different `PORT` and use that port in the browser.
- **CSS or nested page 404:** check project root, server route and Vercel build logs; verify `/assets/saas.css` directly.
- **Empty history:** check `/api/diagnostics`, staging table contents, monitor logs, RLS and environment settings; live probes and history are different sources.
- **Health 404/down:** directly check the exact configured `/health` URL, then compare database rows, app `AEGIS_TARGETS` and Worker target base URLs. Disabled targets are not proof of running instances.
- **Admin 401:** set `ADMIN_TOKEN` in the server environment, restart, and use the same token in `/admin.html`. Database RLS is a separate security concern.
- **API 401/403/502:** use the `x-api-key` header; verify the local demo key or database connectivity and key permissions. Never print a real key in shared logs.
- **Worker login timeout / deployed targets stale:** fix Cloudflare authentication, inspect `wrangler whoami`, re-check Worker secrets and redeploy. Never infer deployment success from local code.
