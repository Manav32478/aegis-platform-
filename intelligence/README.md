# Intelligence layer — Month 4

| Module | File | Free tool | How to run |
|--------|------|-----------|------------|
| Cost | `cost.js` | none (hardcoded limits) | `node cost.js` exports helpers |
| Carbon | `carbon.js` | Electricity Maps free tier (optional) | `ELECTRICITYMAP_KEY=... node -e "require('./carbon').getGreenestRegion([...]).then(console.log)"` |
| Policy | `policy/no-public-buckets.rego` | OPA (free, open source) | `opa eval -i policy/input.example.json -d policy/no-public-buckets.rego "data.aegis.policy.deny"` |
| Security | (CI workflows) | Trivy + Checkov (free, open source) | `.github/workflows/security-scan.yml` |
| Predictive ML | `ml/predict.py` | scikit-learn (free) | `SUPABASE_URL=... SUPABASE_KEY=... python predict.py` |

Policy check output for the example input (public=true, no team tag) will show two
`deny` messages — wire this into CI so a failing `opa eval` blocks `tofu apply`.
