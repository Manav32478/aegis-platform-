# 🎤 Evaluation Q&A — The Complete Bank (as an evaluator would ask)

Practice these out loud. Answers are written the way you should say them — confident,
specific, and honest. The ⭐ questions are near-guaranteed in any panel.

---

## ROUND 1 — Opening (they always start here)

### ⭐ Q1. "Tell me about your project."
> "Aegis is a self-healing multi-cloud platform. It runs one application across multiple
> cloud free tiers — Render and Vercel are live right now — monitors each cloud's health
> every five minutes, and fails over automatically through a Cloudflare Worker the moment
> one cloud degrades. On top of that I built an intelligence layer: cost estimation,
> carbon-aware routing, OPA policy checks, security scanning in CI, and ML-based
> predictive failover using Isolation Forest. It's also multi-tenant — the API requires a
> hashed key. The entire system runs at zero cost."

### Q2. "Why did you choose this topic?"
> "Because every developer defaults to one cloud provider, and that's a single point of
> failure. I noticed free tiers are everywhere but each one alone is unreliable — for
> example Render's free services sleep after 15 minutes idle. The interesting engineering
> problem is: can I combine several unreliable free tiers into one system that's more
> reliable than any single paid instance? That's what Aegis answers."

### Q3. "What did YOU personally build here?"
> "Everything in the repo: the app, the Docker setup, the deployments on Render and
> Vercel, the health monitor, the Cloudflare Worker router, the Supabase schema, the cost
> and carbon modules, the OPA policies, the ML model, the multi-tenant API, and the
> dashboards. I used open-source tools — OPA, scikit-learn, Trivy — but the integration,
> the failover logic, and the intelligence layer are all my own code."

### Q4. "Is this actually working, or just a simulation?"
> "It's live. Two real clouds are running the same app on free tiers, the monitor writes
> real health data to Supabase every five minutes, the API returns real data with real
> key auth, and the router serves real traffic. I also have a local simulation for the
> failover demo, but the production path is real. Here are the live URLs…"

---

## ROUND 2 — Architecture

### ⭐ Q5. "Draw and explain your architecture."
Draw the 5 layers:
> "Layer 1 is clients. Layer 2 is the Cloudflare Worker at the edge — it's both the
> failover router and a cron monitor. Layer 3 is compute — the same Dockerized app on
> multiple clouds. Layer 4 is Supabase — health history, orgs, API keys, risk flags.
> Layer 5 is intelligence and access — cost, carbon, policy, security, ML, the API and
> the dashboards. Data flows: every request hits the Worker, the Worker health-checks the
> clouds, and the monitor records results every 5 minutes into Supabase."

### ⭐ Q6. "Why a Cloudflare Worker for routing instead of DNS failover?"
> "DNS failover is bound by TTL — clients cache the old IP, so failover can take minutes.
> A Worker runs at the edge, health-checks the backends itself, and retries the next
> healthy cloud in milliseconds. It can also inspect and modify requests, which DNS
> simply can't do."

### Q7. "Why not a traditional load balancer?"
> "A load balancer distributes load across healthy servers, but typically within one
> provider. Aegis works across providers, adds self-healing, and layers cost, carbon,
> security and ML intelligence on top. It's a platform, not just a proxy. Also, running a
> managed load balancer costs money — Aegis is $0."

### Q8. "How does the Worker know a cloud is healthy?"
> "It keeps an in-memory health cache with a 10-second TTL. Before routing it fetches
> each cloud's /health endpoint with a 2-second timeout. It sorts healthy clouds by
> latency and routes to the fastest. If the proxy call fails anyway, it retries the next
> cloud in the same request."

### Q9. "What happens if ALL clouds are down?"
> "The router returns HTTP 503 'All clouds are down'. The monitor keeps checking, and the
> self-healing step can trigger a redeploy via the GitHub API after a cloud fails three
> checks in a row."

### Q10. "What happens if the Worker itself fails?"
> "Cloudflare Workers run on Cloudflare's global edge network — it's a managed,
> replicated platform, so a single Worker failure doesn't take it down. The clouds behind
> it are the variable part, and that's what I designed around."

---

## ROUND 3 — Failover & reliability

### ⭐ Q11. "Walk me through a failover, step by step."
> "A user hits the router. The Worker checks its health cache, picks the healthiest cloud
> — say Render — and proxies the request. Now Render goes down. The next health check
> marks it unhealthy. The Worker immediately routes new requests to Vercel instead.
> Meanwhile the monitor records Render's failure into Supabase, and after three
> consecutive failures it dispatches a redeploy. When Render recovers, it rejoins the
> pool automatically."

### Q12. "How fast is your failover, really?"
> "At the Worker layer it's bounded by the health-cache TTL and the per-request timeout —
> in the order of milliseconds to a couple of seconds. That's the whole reason I used an
> edge router instead of DNS."

### Q13. "How do you prove failover works?"
> "Chaos tests. I suspend a cloud in Render, refresh the router URL, and it serves the
> other cloud immediately. I can show it live, and the health history in Supabase shows
> the outage window. The status page even showed Render at 80% uptime because its free
> tier sleeps when idle — the system stayed available by failing over."

### Q14. "What about session state? If a user's session is on one cloud…"
> "My app is stateless — /health and the pages don't hold server-side session state, so
> switching clouds is safe. For stateful apps, the future work is sticky sessions or a
> shared session store. I'd mention that as a limitation and a planned improvement."

---

## ROUND 4 — Monitoring & data

### Q15. "How does monitoring work, and why every 5 minutes?"
> "The monitor fetches /health from every cloud and inserts the result into Supabase. It
> runs two ways: a GitHub Action on a cron, and the Cloudflare Worker's own cron trigger.
> Five minutes is frequent enough to catch outages early but cheap enough to stay inside
> free-tier limits."

### Q16. "Why Supabase and not some other database?"
> "It's free hosted Postgres with a REST API and auth built in. The REST API meant my
> monitor didn't need a heavy client — it uses plain fetch, which avoided a Node-version
> incompatibility I actually hit and fixed. The health history also doubles as training
> data for the ML model."

### Q17. "What's in your schema?"
> "Four tables: health_checks for monitoring history, organizations and api_keys for
> multi-tenancy — keys stored as SHA-256 hashes — and risk_flags where the ML model
> writes predictions. Row-level security is enabled with policies that allow the monitor
> to write and the dashboard to read."

### Q18. "Why store latency, not just up/down?"
> "Because latency trends are the early-warning signal. A cloud that's slowing down is
> about to fail — that's exactly what the Isolation Forest model learns from."

---

## ROUND 5 — Machine learning

### ⭐ Q19. "Explain your ML model."
> "I use Isolation Forest, an unsupervised anomaly detector. For each cloud I build a
> rolling average latency feature, so each cloud is judged against its own normal
> behaviour rather than one fixed threshold. The model scores each check; anomalous
> checks get risk_score -1. If a cloud's last three checks contain an anomaly, it's
> flagged at-risk and written to risk_flags, which the dashboard displays."

### ⭐ Q20. "Why Isolation Forest and not a simple threshold?"
> "A fixed threshold is wrong for heterogeneous clouds — Render and Vercel have different
> network baselines. Isolation Forest learns each cloud's normal latency distribution and
> flags deviations. It's unsupervised, so I don't need labelled failure data, which I
> wouldn't have as a student."

### Q21. "How do you know the model works?"
> "Two ways. A demo mode with synthetic data where one cloud degrades at the end — the
> model flags exactly that cloud and keeps the stable ones healthy. And the real mode
> reads my live Supabase data. Right now it's still collecting history, so it correctly
> defers until there's enough data — which is honest behaviour, not a failure."

### Q22. "What features would improve the model?"
> "Error rate, uptime windows, and latency trend over time. I'd also consider a
> forecasting model to predict load. Right now latency is the feature, but the pipeline
> is built to accept more."

### Q23. "What's contamination=0.05?"
> "It tells the Isolation Forest roughly what fraction of points are expected to be
> anomalous — 5% in my case. It's a prior that controls how aggressive the model is."

---

## ROUND 6 — Security & policy

### Q24. "What security measures do you have?"
> "Four layers. Container scanning with Trivy, infrastructure-as-code scanning with
> Checkov, both running automatically in CI on every push. Policy-as-code with OPA that
> blocks deployments violating rules. And the API stores keys as SHA-256 hashes, never
> plaintext."

### Q25. "Why OPA instead of if-statements?"
> "Policies are decoupled from code — they're data. A non-developer can add a policy
> without touching the app, policies are versioned and auditable, and CI evaluates them
> so a violation fails the pipeline before anything deploys."

### Q26. "Your anon key is in the frontend code — isn't that a security hole?"
> "The anon/publishable key is designed to be public — it's restricted by row-level
> security policies. The dangerous key is service_role, which I never use in the
> frontend. For production, key creation should move to a Supabase Edge Function using
> service_role, and I'd add rate limiting. I'm aware of the trade-off and can explain it."

### Q27. "How do you store API keys?"
> "Only as SHA-256 hashes in the api_keys table. The plaintext key is shown once when
> generated. When a request comes in, I hash the provided key and compare it to the
> stored hash."

---

## ROUND 7 — Multi-tenancy & API

### Q28. "Why is the API multi-tenant?"
> "Because the goal is that other developers can query the platform's status, cost and
> risk data — not just me. Each tenant gets an organization and API keys. That's the
> step from project to product."

### Q29. "Show me your API."
> "There's Swagger at /api-docs. Endpoints: /api/status for per-cloud uptime,
> /api/cost-report for savings, /api/risk for ML flags, /api/security-score. All but
> /health require an x-api-key header. Without a key you get 401, wrong key 403, valid
> key 200."

### Q30. "How would another developer use this?"
> "They'd call generate-key.js to get a key, then hit the endpoints. It's the same
> pattern as Stripe or GitHub's API — a hashed key in a header. The Swagger docs make it
> self-serve."

---

## ROUND 8 — Cost & free tier

### ⭐ Q31. "You claim $0. Is that really true, and how do you stay free?"
> "Yes — Render and Vercel are free tiers, Supabase is free, Cloudflare Workers are free,
> GitHub Actions is free on a public repo. To stay free I keep the repo public so Actions
> minutes are unlimited, and the Worker's cron avoids Actions minutes anyway. The only
> things needing a card are Google Cloud and Oracle — verification only, still $0 inside
> limits — and those are optional."

### Q32. "Where does the $40/month figure come from?"
> "It's an illustrative reference rate — $40 per million requests on a single paid cloud
> — hardcoded in cost.js. The calculation is transparent and shown on the dashboard. For
> the final report I can swap in a real cited rate from a provider's pricing page."

### Q33. "Is free-tier-only a real engineering approach, or a gimmick?"
> "It's a real constraint that shaped the design. Free tiers sleep, throttle, and limit
> you — engineering reliability around those limits is the core challenge. The monitor
> doubling as a keep-alive for Render is a direct example. For production you'd add paid
> tiers, but the architecture doesn't change."

---

## ROUND 9 — Testing & quality

### Q34. "What testing have you done?"
> "Unit tests with Jest — 6 passing, covering the cost math and the monitor's
> aggregation logic. Integration: I verified the API's 401/403/200 behaviour and the
> hash-match against Supabase. Live: the monitor and failover are tested against real
> clouds. Security scanning runs in CI. And there's a k6 load-test script for throughput
> numbers."

### Q35. "Why did you test the intelligence modules and not trivial getters?"
> "Because a committee cares whether the business logic is correct, not whether a getter
> works. The cost calculation and the monitor's uptime/latency aggregation are where bugs
> would actually matter."

### Q36. "Show me a test run."
> "cd tests && npm test — six tests pass in under a second."

---

## ROUND 10 — Critical / comparison (the hard ones)

### ⭐ Q37. "This is just a load balancer with extra steps, isn't it?"
> "A load balancer distributes load across healthy servers on one platform. Aegis adds
> cross-provider failover, self-healing, cost/carbon/policy/security intelligence, ML
> prediction, and a multi-tenant API. It's the intelligence layer and the multi-cloud
> portability that make it a platform rather than a proxy."

### Q38. "Why not just use a managed DR product from one cloud vendor?"
> "Cost and lock-in. Managed DR is expensive and ties you to one vendor's tooling. Aegis
> is portable across providers and costs nothing, which matters for students and early
> startups."

### Q39. "Why not Kubernetes multi-cluster?"
> "Kubernetes federation is heavy — a control plane, networking, and enough resources to
> run it — and it's not free-tier friendly. Aegis is app-level routing over serverless
> and VMs. For this scale and budget, edge routing is the right tool."

### Q40. "What's the single biggest weakness of your system?"
> "Free-tier limits themselves — Render sleeping when idle, cold starts, and the fact
> that I'm depending on providers' goodwill for the free tiers. That's an operational
> reality I've mitigated with the keep-alive monitor, but for real production you'd move
> to paid instances and the architecture stays the same."

### Q41. "If I gave you money and a month, what would you do?"
> "Add Google Cloud Run and Oracle as a third and fourth cloud, move API-key creation to
> a secure Edge Function, add alerting, and run continuous chaos tests that produce a
> monthly resilience score. Then start the SaaS layer — user accounts, billing, a public
> status page on my own domain."

### Q42. "What would you have done differently?"
> "I'd have started collecting health data earlier — the ML model needs history. And I'd
> have put key generation behind a service_role function from the start instead of using
> the anon key for it."

---

## ROUND 11 — Rapid fire (short answers)

- **"What's your failover SLA?"** → Sub-5-second detection window; sub-second routing.
- **"How many requests can it handle?"** → Bounded by free tiers: Render ~750 h/mo, Vercel serverless generous limits, Worker 100k req/day. k6 will give exact numbers.
- **"Is the data encrypted?"** → In transit via HTTPS everywhere; Supabase encrypts at rest. API keys hashed at rest.
- **"What if Supabase goes down?"** → Monitoring stops, but routing keeps working — the Worker health cache is independent of Supabase. That's a deliberate decoupling.
- **"Which cloud is primary?"** → None. All clouds are equal; the router picks the healthiest at any moment.
- **"Why Express and not Fastify/Go?"** → Express is ubiquitous, well-understood, and my app is thin — the value is in the orchestration, not the web framework.
- **"Is it production-ready?"** → Not yet — it needs paid tiers, rate limiting, and hardened auth. It's a working prototype that demonstrates the full architecture.

---

## ROUND 12 — Demo commands (they may say "show me")

| If they say… | You do… |
|--------------|---------|
| "Show me failover" | Open `dashboard.html` → Failover demo → Run chaos test |
| "Show me the live clouds" | Open `aegis-platform-pomf.onrender.com/health` and the Vercel one |
| "Show me the API" | `cd api && node index.js` → open `localhost:4000/api-docs` |
| "Show me the ML" | `cd intelligence/ml && python3 predict.py --demo` |
| "Show me the tests" | `cd tests && npm test` |
| "Show me the data" | Open Supabase → Table Editor → health_checks |
| "Show me security" | GitHub repo → Actions → Security scan run |

---

## The 5 answers to have PERFECT (memorize these)
1. **What is it:** one app, multiple free-tier clouds, automatic failover, $0.
2. **Why Workers not DNS:** milliseconds vs minutes.
3. **Why Isolation Forest:** adapts per cloud, no labels needed.
4. **Why OPA:** policy decoupled from code.
5. **Is it real:** yes — two live clouds, real data, real auth, here are the URLs.
