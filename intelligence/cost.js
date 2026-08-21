// Cost intelligence module — Month 4.1
// Update these numbers from each provider's current pricing page and cite
// your source in the final report.

const FREE_TIER_LIMITS = {
  'google-cloud-run': { freeRequests: 2000000, unit: 'requests/month' },
  'oracle-cloud': {
    freeCompute: 'Always Free — up to 4 OCPU + 24 GB RAM (A1.Flex)',
    unit: 'always free',
  },
  'render': {
    freeHours: 750,
    unit: 'instance-hours/month',
    note: 'free web services sleep after ~15 min idle',
  },
};

// Illustrative reference rate if the workload ran on ONE paid single-cloud
// instance. Replace with a real cited rate in the report.
const PAID_RATE_PER_MILLION_REQUESTS = 40; // USD

function estimateSingleCloudCost(monthlyRequests) {
  return (monthlyRequests / 1000000) * PAID_RATE_PER_MILLION_REQUESTS;
}

/**
 * Aegis cost = $0 (all three free tiers).
 * Saving = the avoided single-cloud bill.
 */
function estimateAegisSavings(monthlyRequests) {
  const singleCloud = estimateSingleCloudCost(monthlyRequests);
  const aegisCost = 0;
  return {
    singleCloud,
    aegisCost,
    saved: Math.max(0, singleCloud - aegisCost),
  };
}

module.exports = {
  FREE_TIER_LIMITS,
  PAID_RATE_PER_MILLION_REQUESTS,
  estimateSingleCloudCost,
  estimateAegisSavings,
};
