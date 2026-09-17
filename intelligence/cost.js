// Aegis v2 — cost intelligence (Month 4.1, upgraded).
// Numbers cite each provider's published free tier / pricing (checked ~Sep 2026).
//
// Sources:
//   - Google Cloud Run: 2,000,000 requests/mo free; $0.40 per million beyond
//     (https://cloud.google.com/run/pricing)
//   - Oracle Cloud Always Free (post Aug-18-2026): 2× E2.1.Micro (1/8 OCPU, 1GB)
//     + Ampere A1 pool 2 OCPU / 12 GB RAM, 200 GB block storage, 10 TB egress
//     (https://www.oracle.com/cloud/free/)
//   - Render: 750 instance-hours/mo per free web service
//     (https://render.com/docs/free)
//   - Vercel: Hobby — 100 GB bandwidth, serverless functions included
//     (https://vercel.com/docs/pricing)

const FREE_TIER_LIMITS = {
  'google-cloud-run': {
    freeRequests: 2000000,
    beyondTierPerMillion: 0.4,
    unit: 'requests/month',
    source: 'cloud.google.com/run/pricing',
  },
  'oracle-cloud': {
    freeCompute:
      'Always Free — Ampere A1 2 OCPU + 12 GB RAM, 2× E2.1.Micro, 200 GB storage, 10 TB egress',
    unit: 'always free',
    source: 'oracle.com/cloud/free',
  },
  'render': {
    freeHours: 750,
    unit: 'instance-hours/month',
    note: 'free web services sleep after ~15 min idle',
    source: 'render.com/docs/free',
  },
  'vercel': {
    freeBandwidthGb: 100,
    freeFunctions: 'serverless functions included (Hobby)',
    unit: 'bandwidth GB / month',
    source: 'vercel.com/docs/pricing',
  },
};

// Reference rate if this exact workload ran on ONE paid, always-on instance
// of comparable quality. Used only to quantify the "saving" of the Aegis
// multi-cloud design. Clearly labelled as an illustrative baseline.
const PAID_RATE_PER_MILLION_REQUESTS = 40; // USD / million

function estimateSingleCloudCost(monthlyRequests) {
  return (monthlyRequests / 1000000) * PAID_RATE_PER_MILLION_REQUESTS;
}

/** What Cloud Run would bill beyond its free tier for a given request volume. */
function estimateCloudRunOverage(monthlyRequests) {
  const over = Math.max(0, monthlyRequests - FREE_TIER_LIMITS['google-cloud-run'].freeRequests);
  return {
    freeTierRequests: FREE_TIER_LIMITS['google-cloud-run'].freeRequests,
    overageRequests: over,
    overageCostUsd: round2((over / 1000000) * FREE_TIER_LIMITS['google-cloud-run'].beyondTierPerMillion),
  };
}

/** Aegis runs entirely inside free tiers → cost is $0. Saving = avoided bill. */
function estimateAegisSavings(monthlyRequests) {
  const singleCloud = estimateSingleCloudCost(monthlyRequests);
  const aegisCost = 0;
  const saved = Math.max(0, singleCloud - aegisCost);
  return { singleCloud, aegisCost, saved, savedUsd: saved };
}

/**
 * 12-month projection: single paid cloud vs Aegis free-tier, with an optional
 * assumed monthly growth rate (default 10%).
 */
function forecastAnnual(monthlyRequests, growthPct = 10, months = 12) {
  const rows = [];
  let reqs = monthlyRequests;
  let singleCumulative = 0;
  let aegisCumulative = 0;
  for (let m = 1; m <= months; m++) {
    const single = estimateSingleCloudCost(reqs);
    const aegis = 0;
    singleCumulative += single;
    aegisCumulative += aegis;
    rows.push({
      month: m,
      requests: Math.round(reqs),
      singleCloudUsd: round2(single),
      aegisUsd: round2(aegis),
      savedUsd: round2(single - aegis),
    });
    reqs *= 1 + growthPct / 100;
  }
  return {
    rows,
    totalSingleCloudUsd: round2(singleCumulative),
    totalAegisUsd: round2(aegisCumulative),
    totalSavedUsd: round2(singleCumulative - aegisCumulative),
    growthPct,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  FREE_TIER_LIMITS,
  PAID_RATE_PER_MILLION_REQUESTS,
  estimateSingleCloudCost,
  estimateCloudRunOverage,
  estimateAegisSavings,
  forecastAnnual,
};
