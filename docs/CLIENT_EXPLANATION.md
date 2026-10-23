# Aegis — Client Explanation & Demo Guide

This guide helps you explain the product clearly to a non-technical client while
staying accurate about what is implemented today and what needs configuration
before a production rollout.

---

## 1. One-sentence explanation

> **Aegis is a cloud-resilience control plane that monitors copies of an
> application across independent hosting providers and can route traffic away
> from an unhealthy copy, while giving the operator a live view of health,
> incidents, latency, and recovery evidence.**

Aegis does not automatically turn one deployment into three. The application
is deployed to each provider; Aegis monitors and coordinates those deployments.

---

## 2. A 30-second client pitch

> “Aegis helps reduce the risk of a single hosting provider taking an application
> offline. We deploy the same application to multiple providers, give each copy a
> small health-check endpoint, and monitor those copies independently. Aegis
> stores the check history, shows response time and availability in a dashboard,
> and its edge router can send requests to an available origin if another origin
> is unhealthy. The result is better visibility, portability, and a practical
> failover path without tying the application to one cloud vendor.”

If they ask whether this is a production guarantee, say:

> “The current Aegis build is a working prototype/pilot. We validate the client’s
> application, data layer, traffic patterns, and recovery requirements before
> making a production availability commitment.”

---

## 3. A simple way to draw it

```text
                           Customers
                               │
                               ▼
                    Aegis edge router
                     (Cloudflare Worker)
                    /          │          \
                   ▼           ▼           ▼
          App copy on     App copy on    App copy on
           Provider A     Provider B     Provider C
                   \           │           /
                    └───────────┼─────────┘
                                ▼
               Health history and incidents in Supabase
                                │
                                ▼
                   Aegis monitoring dashboard
```

The monitor should run independently of the application origins. That way, a
failure at one provider does not also take down the only system watching it.

---

## 4. What happens during normal operation

1. **Deploy the application copies.** Each provider runs a copy of the same app.
2. **Expose a health endpoint.** Aegis sends a small HTTP request to the agreed
   health-check URL and measures whether it responds and how long it takes.
3. **Record observations.** The monitor records timestamps, health status,
   latency, HTTP status, and monitoring region in Supabase.
4. **Calculate and show indicators.** The portal calculates uptime, latency
   percentiles, error rate, a health score, and an anomaly indicator from the
   available history.
5. **Route requests.** The Cloudflare Worker chooses an eligible origin using
   the health information available to it and proxies the request.
6. **Record incidents and recovery.** Monitor events can open or close an
   incident and create an alert record. Recovery duration can be calculated
   from those timestamps.

There are two cadences in the current project: the Cloudflare cron is scheduled
for every five minutes, and the local portal performs on-demand probes about
every ten seconds for its live display. These are different checks and should
not be described as the cron running every ten seconds.

---

## 5. What the dashboard means

- **Real-time probes:** the portal server is currently checking configured
  origins and showing response time/status.
- **Health history:** previously stored checks from Supabase. Historical charts
  are only as complete and as recent as the monitor data in the database.
- **Health score:** a project-defined comparison indicator based on uptime,
  latency, and error rate. It is useful for ranking and visualizing; it is not a
  provider SLA or an independently certified availability score.
- **SLA panel:** compares observed uptime in the selected history window with a
  target such as 99.9%. It does not mean Aegis guarantees 99.9% availability.
- **Anomaly score:** flags latency that differs from recent behaviour. This is
  an advisory signal, not a validated promise that an outage will be predicted.
- **Cost forecast:** a modelled estimate using configured assumptions and, where
  available, app request counters. It is not a provider invoice or guaranteed
  saving.
- **Carbon view:** uses fallback regional estimates unless a live carbon-data
  provider/API key is configured.
- **Security CI:** displays CI workflow results; a green workflow only means the
  configured checks passed for that run, not that the system is vulnerability-free.

---

## 6. A 2-minute client demo

### Before the meeting

- Start the local portal with `bash start.sh` from the project root.
- Open `http://localhost:3100/dashboard.html`.
- Keep the Cloudflare router URL and the direct origin health URLs ready.
- Check the origins are awake and that the dashboard has recent Supabase data.
- Do not pause a live customer-facing service without permission.

### Demo narration

**1. Dashboard — visibility**

> “This screen combines current probes with stored health history. Here you can
> compare the provider copies, see latency and uptime, and review incident data.”

**2. Direct health checks — independent origins**

Open each configured origin’s health URL.

> “Each deployment exposes the same health-check contract. Aegis can compare
> the copies independently rather than assuming one provider is healthy because
> another is.”

**3. Router — traffic path**

Open the router’s diagnostic or routed endpoint and inspect the response.

> “The edge router is the customer entry point. It checks origin health and
> forwards a request to an eligible origin. We verify the actual response and
> serving origin rather than relying on a dashboard label alone.”

**4. Monitoring evidence**

Show recent `health_checks` rows in Supabase and the GitHub Actions monitor run.

> “These timestamps are the evidence of checks being recorded. The dashboard
> visualizes those observations.”

**5. Failover rehearsal (staging only)**

If the client approves, disable one test origin. Re-run the router check and
request the app through the router. Verify the response comes from another
origin and that an incident/alert is recorded. Restore the origin afterwards.

> “This is a controlled staging test. We measure the detection and recovery time
> and confirm that the app still responds through the alternate origin.”

---

## 7. Explaining the intelligence features without overselling

### Health scoring

> “The score is a configurable operational indicator built from observed uptime,
> response time, and errors. It helps an operator compare origins in one view.”

### Anomaly detection

> “Aegis compares recent latency with a cloud’s own recent baseline and flags
> unusual behaviour. We treat that as an early-warning signal for an operator;
> its predictive accuracy needs to be evaluated against more production history.”

### Cost and carbon

> “The platform can estimate cost and compare regional carbon-intensity data.
> Estimates depend on workload assumptions and data sources; the client should
> validate them against actual provider billing and current carbon data.”

### Failover

> “The design provides a routing path to alternate origins. The precise recovery
> time depends on probe intervals, router cache, provider cold starts, and the
> application’s data architecture. We demonstrate and measure that behaviour in
> a controlled test rather than promise zero downtime.”

---

## 8. Important application and data-layer questions

### “Will it work with my e-commerce application?”

> “Usually, if we can deploy compatible copies and add a health endpoint. We
> first assess its framework, build process, runtime, secrets, payment provider,
> database, storage, and background jobs. We then run a staging integration test.”

### “What happens to carts and orders if traffic moves?”

> “Failover of application compute does not replicate business data by itself.
> All app copies must use a shared, suitably available database and shared object
> storage, or another deliberate data-replication design. Payments and order
> writes need idempotency and consistency safeguards.”

### “Does Aegis automatically deploy my app to three providers?”

> “No. The application must be deployed and configured on each provider first.
> Aegis monitors those deployments and provides routing/operations features.”

### “Is it guaranteed to cost zero?”

> “The prototype is designed to fit within free tiers at low traffic. Provider
> free-tier limits and policies can change; production traffic, egress, database
> usage, or overages may incur charges. We would estimate cost from the client’s
> real workload before deployment.”

---

## 9. Honest project status — what to say today

The currently verified Aegis demo has **Render and Vercel** origins active, a
Cloudflare Worker router, a Supabase health-history database, a GitHub Actions
monitor workflow, a local control-plane portal, and an e-commerce example.
Cloud Run and Oracle entries are present as planned/disabled targets until the
client actually deploys copies there.

The project contains a Node monitor with an optional GitHub redeploy-dispatch
path. That path only operates when the required GitHub token, deploy workflow,
and provider deploy hooks/secrets are configured and tested. Do not say
“automatic redeploy is enabled in production” unless you have demonstrated that
configuration.

The Worker currently prioritizes healthy origins in its configured target
order. The dashboard separately computes a health score. Do not claim that the
Worker presently selects the highest dashboard score unless that behaviour has
been implemented and verified end-to-end.

The current admin authentication/RLS setup is prototype-grade. Before serving
real customers, Aegis needs hardened authentication and tenant isolation,
server-side secret handling, robust origin health checks, request-body-safe
proxy retries, operational alert delivery, staged failover tests, and reviewed
cost limits.

---

## 10. Client hand-off / next project phase

For a real client, propose a **staged pilot**:

1. Inventory the app, dependencies, data stores, secrets, and traffic.
2. Deploy a non-production copy to each agreed provider.
3. Configure the health contract and register origin URLs.
4. Test routing for success, timeout, HTTP 5xx, and cold-start cases.
5. Test shared database behavior, duplicate writes, sessions, and payments.
6. Test failover and recovery; measure observed time and record evidence.
7. Add authentication, tenant isolation, monitoring alerts, backup and restore,
   cost controls, and provider-specific deployment automation.
8. Only then agree a production rollout and service objectives.

This is a credible client conversation: it explains the value while showing
that you understand the difference between a working prototype and an
operational production service.
