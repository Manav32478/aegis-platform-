# 🧠 Month 4 — Intelligence Layer

This is the layer that makes Aegis *smart*, not just redundant. Five modules. Four of
them are already built and wired; one (ML) just needs a few days of data to become
meaningful.

## Module map
| Module | File | Status |
|--------|------|--------|
| 💸 Cost | `intelligence/cost.js` | ✅ shown on /status ($40/mo savings) |
| 🌱 Carbon | `intelligence/carbon.js` | ✅ built (fallback data shown; live needs a key) |
| 📜 Policy | `intelligence/policy/no-public-buckets.rego` | ✅ built (OPA) |
| 🛡️ Security | `.github/workflows/security-scan.yml` | ✅ runs in CI on every push (Trivy + Checkov) |
| 🔮 ML predictive | `intelligence/ml/predict.py` | ✅ built + tested (needs ~1 week of data) |

---

## 🔮 ML predictive failover — how it works (and how to show it)
- Reads your real `health_checks` from Supabase.
- Builds a **rolling average latency** feature *per cloud* (so each cloud is judged
  against its own normal behaviour, not one fixed threshold).
- Trains **Isolation Forest** (`contamination=0.05`) → flags anomalous checks.
- A cloud is marked **at risk** if any of its **last 3 checks** are anomalous → written
  to `risk_flags` → your `/status` page shows a ⚠ badge.

### Run it yourself (2 options)
**Option A — GitHub Action (runs daily automatically):**
- Repo → **Actions → "Predictive risk (ML)" → Run workflow**
- It already has the Supabase secrets; it runs `predict.py` and writes `risk_flags`.
- It also runs daily at 02:00 (cron) for free.

**Option B — local demo (no data needed, great for the evaluation):**
```bash
cd ~/Desktop/aegis-platform/intelligence/ml
pip3 install pandas scikit-learn
python3 predict.py --demo
```
Output:
```
  oracle     -> AT RISK ⚠
  render     -> healthy
  vercel     -> healthy
```
This proves the model can spot a *degrading* cloud before it fully fails — the
differentiator for your project. I verified both modes work.

### Note on data
The model is live now, but meaningful flags need ~1 week of `health_checks` history
(your monitor adds 2 rows every 5 min). Until then it prints
`only N checks so far — model is live; collecting history` — which is honest and
correct, and a good thing to say in your viva.

---

## 📜 Policy-as-code (OPA) — quick demo
Install OPA once (free): https://www.openpolicyagent.org/docs/latest/#running-opa
```bash
cd ~/Desktop/aegis-platform
opa eval -i intelligence/policy/input.example.json \
  -d intelligence/policy/no-public-buckets.rego "data.aegis.policy.deny"
```
Shows two `deny` messages (public bucket + missing team tag). In CI this gate blocks
`tofu apply` when a policy is violated.

## 🛡️ Security scanning
Already automatic: push to GitHub → **Actions → Security scan** → Trivy (container scan)
+ Checkov (IaC scan). View the results in the Actions tab and screenshot them for your
report.

## 🌱 Carbon — optional upgrade
1. Create a free token at https://api-portal.electricitymaps.com
2. Add it as a GitHub secret `ELECTRICITYMAP_KEY` (and locally to `.env`)
3. `intelligence/carbon.js` then returns live grid intensity and picks the greenest
   region for routing. Without a key it falls back to published averages (already
   shown on /status).

---

## After Month 4 → Month 5 (product layer)
- `api/` — multi-tenant REST API + Swagger docs (already built; deploy later).
- `dashboard/` — the full React dashboard (already built; `npm run dev` locally).
- `tests/load-test.js` — k6 load test for real latency/throughput numbers.
