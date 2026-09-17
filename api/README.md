# Aegis API — Month 5 (multi-tenant + Swagger)

A REST API that lets *other developers* query your platform's status, cost, risk and
security data — secured by API keys (stored as SHA-256 hashes in Supabase).

## Quickstart (on your Mac)
```bash
cd ~/Desktop/aegis-platform/api
npm install
```

### 1. Create a real API key (writes to your Supabase)
```bash
node generate-key.js            # org "default"
# ORG_NAME=acme node generate-key.js   # named org
```
It prints the key **once** — save it.

### 2. Start the API
```bash
node index.js
```
- Swagger UI: **http://localhost:4000/api-docs**
- Health:     **http://localhost:4000/health** (public)

### 3. Call it
```bash
curl http://localhost:4000/api/status                 # 401 (no key)
curl -H "x-api-key: WRONG" http://localhost:4000/api/status   # 403
curl -H "x-api-key: <your-key>" http://localhost:4000/api/status   # 200
curl -H "x-api-key: <your-key>" "http://localhost:4000/api/cost-report?requests=1000000"
```

### Endpoints
| Endpoint | Auth | Returns |
|----------|------|---------|
| `GET /health` | public | service status |
| `GET /api/status` | key | per-cloud uptime (last 300 checks) |
| `GET /api/cost-report?requests=N` | key | savings vs single paid cloud |
| `GET /api/risk` | key | ML risk flags |
| `GET /api/security-score` | key | Trivy/Checkov/OPA summary |
| `GET /api-docs` | public | interactive Swagger UI |

### Demo mode (no Supabase)
```bash
ALLOWED_KEYS=abc node index.js   # then use "abc" as x-api-key
```

### Demo mode (no Supabase, one-liner)
`ALLOWED_KEYS=abc node index.js` — then use `x-api-key: abc`.

## Notes
- Keys are stored **hashed** (`key_hash`); the API hashes incoming keys and compares.
- The key lookup uses Supabase's **anon** key — fine for this project. A production
  version would move key creation behind a Supabase Edge Function (`service_role`).
- Deploying the API to a cloud (Vercel serverless) is documented in `docs/MONTH5_PRODUCT.md`.
