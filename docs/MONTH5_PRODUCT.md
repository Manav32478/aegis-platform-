# 🛠️ Month 5 — Product Layer

This is where Aegis stops being "a project" and starts being "a product": auth,
API keys, documentation, and load testing.

## What's done this month
| Piece | Where | Status |
|-------|-------|--------|
| Multi-tenant API | `api/index.js` | ✅ built + tested (auth 401/403/200, Swagger) |
| Key generation | `api/generate-key.js` | ✅ built (hashed keys in Supabase) |
| Swagger docs | `/api-docs` | ✅ interactive UI |
| React dashboard | `dashboard/` | ✅ scaffolded (Vite + React) |
| k6 load test | `tests/load-test.js` | ✅ written (needs k6 install) |

## Steps for you (after re-running the schema)
1. Supabase → **SQL Editor** → paste `infra/schema.sql` → **Run**  (adds the api_keys policies)
2. `cd ~/Desktop/aegis-platform/api && npm install`
3. `node generate-key.js` → save the printed key
4. `node index.js` → open http://localhost:4000/api-docs
5. Try the 3 curl calls (401 / 403 / 200) — this is a great live demo of real auth.

## Load testing (k6)
```bash
# install k6: https://k6.io/docs/get-started/installation  (brew install k6)
k6 run tests/load-test.js
```
Edit `tests/load-test.js` → point `http.get(...)` at your router URL:
`https://aegis-router.manav32478.workers.dev/health`. Output gives real p95
latency + throughput numbers for your report.

## React dashboard (local)
```bash
cd ~/Desktop/aegis-platform/dashboard
npm install
npm run dev        # open http://localhost:5173
```
It proxies `/api` to localhost:8080 (the demo) — run `node demo/server.js` too.
(For the evaluation, `showcase.html` is the polished one-page dashboard; the React
app demonstrates the real frontend stack.)

## Deploying the API (optional, later)
- **Vercel** (serverless): the Express app works as a serverless function if you add an
  `api/vercel.json` mirroring `app/vercel.json`. Swagger UI needs its static assets —
  test locally first.
- **Render** (2nd free service): note Render's free tier is ~750 instance-hours/month,
  so a 2nd always-on service may exceed it. Run the API locally for demos instead.

## Why this matters for your defense
- Real **API keys** (hashed, not plaintext) + **401/403/200** behavior = real auth.
- **Swagger** = professional API documentation, a genuine product touch.
- **k6 numbers** = quantitative performance evidence for the report.
