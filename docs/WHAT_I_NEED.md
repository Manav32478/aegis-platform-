# What I need from you — PROGRESS TRACKER

| # | Item | Status | Value |
|---|------|--------|-------|
| 1 | GitHub repo | ✅ DONE | `https://github.com/Manav32478/aegis-platform-` |
| 2 | Supabase URL | ✅ DONE | `https://kagjbxxmdyaypfcqemem.supabase.co` |
| 3 | Supabase anon key | ✅ DONE | `sb_publishable_cwauqX8...` (in `.env`) |
| 4 | Supabase tables | ✅ DONE | 4 tables created (health_checks, organizations, api_keys, risk_flags) |
| 5 | Render URL | ✅ LIVE | `https://aegis-platform-pomf.onrender.com` — `/health` returns ok |
| 6 | Vercel URL | ✅ LIVE | `https://aegis-platform-lyart.vercel.app` — `/health` returns ok |
| 7 | Cloudflare account | ✅ LIVE | router deployed at `https://aegis-router.manav32478.workers.dev` |
| 8 | GCP / Oracle | ⏳ PENDING | optional — cardless path is fine |
| 9 | Electricity Maps | ⏳ PENDING | optional, Month 4 |

## GitHub Actions secrets (add these NOW — monitoring + CI need them)
Go to repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|-------------|-------|
| `SUPABASE_URL` | `https://kagjbxxmdyaypfcqemem.supabase.co` |
| `SUPABASE_KEY` | `sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti` |
| `TARGETS` | `[{"name":"render","url":"https://aegis-platform-pomf.onrender.com/health"},{"name":"vercel","url":"https://aegis-platform-lyart.vercel.app/health"}]` |
| `GCP_SA_KEY` | (only if you do GCP later) |
| `SELF_HEAL_TOKEN` | (Month 3, optional) |

> ⚠️ The anon/publishable key is meant to be shared. NEVER put the `sb_secret_...` /
> `service_role` key anywhere — it has full database access.
