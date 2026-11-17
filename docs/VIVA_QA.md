# Aegis — Accurate Viva & Client Q&A

> **Use this current-status version.** Do not quote older sample numbers or claim
> that all three origins, automatic redeployment, or score-aware routing are live.
> See `docs/STATUS.md`, `docs/CLIENT_EXPLANATION.md`, and
> `docs/VERCEL_DASHBOARD_FIX.md` for current operational status.

---

## Project overview

### 1. What is Aegis?

> “Aegis is a multi-cloud resilience prototype. It monitors configured copies of
> a web application through health endpoints, records observations in Supabase,
> shows operational indicators in a dashboard, and provides a Cloudflare edge
> routing path to configured origins.”

### 2. What problem does it address?

A single hosting origin can become a single point of failure. Aegis explores how
independent app deployments, external monitoring, health history, and routing
can improve visibility and provide a controlled recovery path.

### 3. What is actually live today?

Render's protected-app origin responds. The Cloudflare Worker is deployed and
currently serves Render. The public portal is deployed separately at the Vercel
`iota` URL. The Vercel protected-app target still points to a retired `lyart`
deployment and returns 404; a new Vercel deployment of `app/` is required before
claiming two-origin app failover. Cloud Run and Oracle remain planned targets.

### 4. Does Aegis deploy my application automatically to three providers?

No. Each app copy is deployed and configured on its provider. Aegis monitors
those origins and provides the router and operations view.

---

## Architecture and monitoring

### 5. Why does the monitor live outside the app origins?

> “If the monitor runs only on the origin it watches, that origin's outage can
> take down both the app and its monitoring. Independent monitoring locations
> reduce that blind spot.”

### 6. What does the health endpoint return?

A small HTTP endpoint such as `GET /health` that returns success when the app is
ready. Aegis records the response status and latency. Production applications
should also check critical dependencies, not merely return success unconditionally.

### 7. How often are checks performed?

The Cloudflare Worker is configured with a five-minute cron, and GitHub Actions
also has a scheduled monitor workflow. The portal performs on-demand probes for
its live display. The portal's live display interval is not the cron interval.
The database currently has no `cloudflare-edge` rows, so the Worker-to-Supabase
scheduled-write path still needs its secrets/configuration verified.

### 8. What is the health score?

A project-defined 0–100 indicator using uptime, latency, and error rate. It
summarizes history; it is not a provider SLA or an externally certified
availability measurement.

### 9. Does the Worker route to the highest health score?

Not currently. The dashboard computes a score for comparison. The Worker checks
its configured origins and tries healthy origins in configured order. Connecting
the score to routing is future work unless separately implemented and tested.

### 10. How do you prove a failover?

Deploy the same app on two live origins, check each directly, then conduct an
authorized staging outage test. Verify the Worker diagnostics change and that a
request through the Worker is served by the remaining origin. Inspect timestamped
incident records. Do not claim the failover is proven until this test succeeds.

### 11. Is automatic redeployment enabled?

The Node monitor has an optional GitHub redeploy-dispatch path. It requires a
GitHub token, workflow permissions, and provider deploy hooks, and must be tested
end-to-end. Do not describe it as active until those conditions are verified.

---

## Intelligence and data

### 12. Where is the ML?

There is a live rolling anomaly indicator and a Python Isolation Forest workflow
that can analyze recorded latency history. These are advisory risk signals; they
are not validated predictions or automatic guarantees of outage prevention.

### 13. Is the cost figure an actual bill or saving?

No. It is a modelled estimate based on counters and assumptions. Actual costs
depend on provider pricing, storage, egress, traffic, and free-tier limits.

### 14. Is carbon routing live?

The project can display regional carbon-intensity values, but fallback averages
are used unless a live provider/API key is configured. Do not claim the Worker
currently routes traffic by carbon intensity.

### 15. Why Supabase?

It provides hosted PostgreSQL and a REST API for checks, targets, incidents,
alerts, and reports. For production, access policies and tenant scoping need a
security review.

---

## SaaS and production readiness

### 16. Is the API fully multi-tenant and production secure?

It demonstrates API-key hashing, rate limiting, audit records, and API docs.
However, current rate limiting is in-memory and demo RLS policies are broad;
production requires organization-scoped authorization/RLS, key rotation,
server-side secret handling, distributed rate limiting, and security review.

### 17. Does the platform guarantee zero downtime or zero cost?

No. It demonstrates failover mechanisms and a free-tier-oriented prototype.
Failover time depends on detection, provider behaviour, routing, and shared data.
Free-tier quotas can change and overages may cost money. No SLA is promised.

### 18. What about carts, orders, sessions, or databases?

Replicating compute does not replicate business data. All app copies need a
shared, appropriately available data store and consistent handling for sessions,
payments, retries, and duplicate writes. That integration is application-specific.

### 19. What did you fix in the current Vercel dashboard?

The live diagnostic reported Supabase `PGRST125` (invalid URL path), so the
Supabase URL was not normalized correctly in the deployed configuration. The
code now strips an accidentally appended `/rest/v1` suffix and reports safe
diagnostics. The portal must be redeployed with the updated code and correct
Production environment variables. The configured Vercel app origin is also
stale and must be replaced.

### 20. What are the next production steps?

Correct the Vercel Supabase environment, deploy a fresh protected app from the
`app/` directory, update the monitor and Worker origins, verify Worker cron
writes, test failover in staging, then harden auth/tenant isolation, delivery
alerts, backups, cost controls, and CI.
