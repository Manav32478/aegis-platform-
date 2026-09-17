# ⚙️ Aegis v2 — How to Run

> v2 is a full, **real-time** platform, but it still starts with **one command**.

---

## ✅ THE ONE COMMAND (no Docker)

```bash
cd ~/Desktop/aegis-platform
./start.sh
```

Boots **everything**:
- 🌐 **Portal** (landing + dashboard + status + admin) → http://localhost:3100
- 🔑 **API + Swagger** → http://localhost:4000/api-docs
- 📡 **Monitor** → writes health checks to Supabase every 5 min

Then it opens the portal in your browser. Done.

---

## ✅ OR the one command with Docker (most professional)

```bash
cd ~/Desktop/aegis-platform
cp .env.example .env      # fill in SUPABASE_URL + SUPABASE_KEY (publishable)
docker compose up --build
```

---

## 🕒 What "real-time" means (v2.1)

The dashboard is **not a static page**. The server:

1. **probes every cloud live every 10 seconds** (platform → Render/Vercel `/health`),
2. merges it with Supabase history (uptime %, p50–p99, health score, SLA, trend),
3. **pushes** the result to every open dashboard over **Server-Sent Events** (`/api/stream`).

Open two browser windows side by side and kill a cloud — the dashboard updates
by itself within 10 seconds, no refresh. If a browser/proxy blocks event
streams, it silently falls back to 10s polling (same result).

---

## What each page shows (for the evaluation)

| Page | URL | Shows |
|---|---|---|
| Overview | `:3100/` | live summary, feature map, architecture, services (auto-updates) |
| Dashboard | `:3100/dashboard.html` | KPI strip, **real-time probe panel**, **live event feed**, health scores with sparklines, **SLA vs 99.9%**, latency trends, latency/uptime charts, anomaly flags, routing decision, cost forecast, carbon, incidents, alerts, failover log, **embeddable status badges**, CSV/JSON export |
| Public status | `:3100/status.html` | no-login status cards + incident timeline (auto-updates) |
| Admin | `:3100/admin.html` | add/toggle monitor targets, generate API keys, audit log, run reports (needs `ADMIN_TOKEN`) |
| API docs | `:4000/api-docs` | Swagger UI — every endpoint with auth |

---

## Extra endpoints you can show off

| Endpoint | What it does |
|---|---|
| `GET /api/stream` | Server-Sent Events — live push channel for the dashboard |
| `GET /badge/{cloud}.svg` | Uptime badge you can embed in your GitHub README |
| `GET /api/export.csv` | Download the derived health table |
| `GET /api/export.json` | Download the full snapshot (for the report appendix) |
| `GET /api/aggregate` | One-shot snapshot (fallback / integration) |

---

## Run just the tests

```bash
cd tests && npm install && npm test     # 30 tests, all passing
```

## Run one monitor cycle manually

```bash
cd orchestration && node monitor.js
```

## Regenerate a report

```bash
cd orchestration && node report.js
```

---

## Still want the old single file?

The v1 one-file dashboard is kept at `dashboard.html` (repo root) and
`app/dashboard.html` for backward compatibility. The v2 portal replaces it —
use the portal for the professional demo.
