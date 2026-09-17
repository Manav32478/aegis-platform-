// Aegis v2 — carbon-awareness (Month 4.2, upgraded).
//
// FALLBACK values are yearly-average grid intensities (gCO₂e/kWh) from public
// sources (Ember / Electricity Maps): India ≈ 700+, Iowa ≈ 400+, Frankfurt ≈ 250.
// Live mode: set ELECTRICITYMAP_KEY (they have a free tier) and values come
// from api.electricitymap.org in real time.

const FALLBACK_INTENSITY = {
  'IN-WE': 727,        // Western India (fallback average)
  'IN-SO': 780,        // Southern India
  'us-central1': 429,  // Iowa, USA (GCP region)
  'us-west1': 350,     // Oregon, USA (Render region)
  'eu-central-1': 250, // Frankfurt (GCP / Oracle region)
  'ap-mumbai-1': 727,  // Oracle Mumbai
  'global': 436,       // world average (Ember, ~2024)
};

const SOURCE_DOC = 'docs/final-report.md — carbon section cites Electricity Maps / Ember';

async function getCarbonIntensity(zone) {
  if (process.env.ELECTRICITYMAP_KEY) {
    try {
      const res = await fetch(
        `https://api.electricitymap.org/v3/carbon-intensity/latest?zone=${zone}`,
        { headers: { 'auth-token': process.env.ELECTRICITYMAP_KEY } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.carbonIntensity != null) {
          return { zone, carbonIntensity: data.carbonIntensity, source: 'live' };
        }
      }
    } catch {
      /* fall through to fallback */
    }
  }
  return {
    zone,
    carbonIntensity: FALLBACK_INTENSITY[zone] ?? FALLBACK_INTENSITY.global,
    source: 'fallback',
  };
}

/** Returns all regions sorted greenest-first (for green routing decisions). */
async function rankRegions(regions) {
  const results = await Promise.all(
    regions.map(async (r) => {
      const { zone, carbonIntensity, source } = await getCarbonIntensity(r.zone);
      return { region: r.name, zone, carbonIntensity, source };
    })
  );
  results.sort((a, b) => a.carbonIntensity - b.carbonIntensity);
  return results;
}

/** Every vCPU-second the Aegis monitor saves by NOT running its own paid fleet. */
function estimateAvoidedEmissions(monthlyRequests, avgRequestKwh = 0.0000005) {
  return { gramsPerMonth: Math.round(monthlyRequests * avgRequestKwh * 436) };
}

module.exports = {
  getCarbonIntensity,
  rankRegions,
  estimateAvoidedEmissions,
  FALLBACK_INTENSITY,
  SOURCE_DOC,
};
