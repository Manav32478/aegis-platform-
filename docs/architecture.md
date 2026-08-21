# Aegis — System Architecture

## 5-layer architecture

```
                        ┌──────────────────────────────┐
                        │        Clients / Users       │
                        └───────────────┬──────────────┘
                                        │  HTTPS
                        ┌───────────────▼──────────────┐
    LAYER 1 — EDGE      │   Cloudflare Worker router   │  failover (ms) + cron monitor
                        └───┬──────────┬──────────┬────┘
                            │          │          │
              ┌─────────────▼──┐  ┌────▼───────┐  ┌────▼──────────┐
   LAYER 2 —  │  Google Cloud  │  │  Oracle    │  │    Render     │
   COMPUTE    │  Run (GCP)     │  │  Always    │  │  (web service)│
   (3 clouds) │  aegis-app     │  │  Free VM   │  │  aegis-app    │
              └──────┬─────────┘  └─────┬──────┘  └──────┬────────┘
                     └──────────┬───────┴─────────────────┘
                                │  health_checks history
              ┌─────────────────▼──────────────────────────┐
   LAYER 3 —  │  Supabase (Postgres)                       │
   DATA       │  health_checks · organizations · api_keys  │
              │  risk_flags                                │
              └─────────────────┬──────────────────────────┘
                                │
   LAYER 4 —   ┌────────────────▼──────────────────────────┐
   INTELLIGENCE│  cost.js · carbon.js · policy/*.rego      │
               │  Trivy/Checkov (CI) · ml/predict.py       │
               └────────────────┬──────────────────────────┘
                                │
   LAYER 5 —   ┌────────────────▼──────────────────────────┐
   ACCESS      │  React dashboard · REST API + Swagger     │
               │  public status page + chaos button        │
               └──────────────────────────────────────────┘
```

## Data flow (one user request)

1. Request → Cloudflare Worker router.
2. Worker consults its health cache (refreshed every 10 s).
3. Worker proxies to the healthiest cloud's `/health`/app endpoint.
4. In parallel, the monitor (Worker cron / GitHub Action) polls all clouds every 5 min → Supabase.
5. Intelligence jobs (daily ML, CI security scans, carbon lookups) enrich Supabase.
6. Dashboard + API read Supabase and render status/cost/risk.

## ER diagram (Supabase schema)

```
 organizations 1 ────< api_keys          (org owns many API keys)
 organizations 1 ────< (nothing else yet)

 health_checks          risk_flags
 ┌──────────────┐       ┌──────────────┐
 │ id (PK)      │       │ id (PK)      │
 │ cloud_name   │       │ cloud_name   │
 │ healthy      │       │ flagged_at   │
 │ latency      │       └──────────────┘
 │ checked_at   │
 └──────────────┘
```

```mermaid
erDiagram
  ORGANIZATIONS ||--o{ API_KEYS : owns
  ORGANIZATIONS { uuid id PK; text name; timestamptz created_at }
  API_KEYS { uuid id PK; uuid org_id FK; text key_hash; timestamptz created_at }
  HEALTH_CHECKS { bigint id PK; text cloud_name; boolean healthy; int latency; timestamptz checked_at }
  RISK_FLAGS { bigint id PK; text cloud_name; timestamptz flagged_at }
```

## Key design decisions (be ready to defend these — see viva prep)

| Decision | Why |
|----------|-----|
| Cloudflare Workers for routing, not DNS failover | DNS TTL means failover takes minutes; a Worker can retry other backends in milliseconds. |
| Isolation Forest, not a fixed threshold | Each cloud has its own normal latency profile; a fixed number would misfire. The model adapts. |
| OPA/Rego, not hardcoded if-statements | Policies are data, decoupled from code; a new policy needs no app change. |
| Supabase for state | Free hosted Postgres + REST + auth; doubles as ML training data. |
