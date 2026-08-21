# Free-tier gotchas (read before Month 2 — this is what keeps it $0)

## 1. GitHub Actions — the biggest hidden trap
- Free plan = **2,000 minutes/month for PRIVATE repos** (unlimited for **public** repos).
- A `*/5 * * * *` cron runs ~8,640 times/month. Even at 30s/run that's **4,300+ minutes —
  it blows the free limit**.
- **Fix (pick one):**
  1. Keep the repo **public** (free + unlimited minutes). Recommended for a college project.
  2. Use the **Cloudflare Worker cron** I included (`orchestration/router/src/worker.js`
     `scheduled()` + `[triggers] crons` in `wrangler.toml`) — free, no minute limits.
  3. Reduce the cron to `*/15 * * * *`.

## 2. Render free tier sleeps
- Free web services **spin down after ~15 minutes idle** and take ~50s to wake.
- Your own 5-min monitor will mostly keep it awake, but expect occasional slow checks.
- **Consequence:** Render will sometimes look "down" to the monitor → actually great for
  demoing failover, slightly annoying for uptime charts. Mention this honestly in the report.

## 3. GCP + Oracle need a card (verification only)
- Google Cloud Run free tier: 2M requests/month + 360k GB-seconds/month — **$0**.
- Oracle Always Free: A1.Flex up to 4 OCPU / 24 GB RAM total — **$0**.
- They ask for a card to verify you're human. **You are not charged inside limits**, but
  double-check you haven't enabled anything paid. Set a billing alert anyway.
- If a card is impossible: **Vercel + Netlify** are cardless alternatives (documented).

## 4. Supabase free tier
- 2 projects, 500 MB database. Projects **pause after ~1 week of inactivity** — your
  5-min monitor keeps it active, so fine. Enable "restore on traffic" anyway.

## 5. Electricity Maps free tier
- The free API is limited. The `carbon.js` module **falls back to published averages**
  when no key is set, so the carbon feature works in the report/demo regardless.

## 6. Cloudflare Workers free tier
- 100,000 requests/day — far beyond a college project's needs. Cron Triggers are free.

## 7. General "stay free" rules
- Respect request/GB limits; don't store big files in Supabase; don't leave test VMs running.
- Never put real card details anywhere except the provider consoles.
- Set spending alerts on GCP/Oracle even if you stay in free tiers.
