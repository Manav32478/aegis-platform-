// Carbon-awareness module — Month 4.2
//
// Live mode:  set ELECTRICITYMAP_KEY (free tier at api.electricitymap.org).
// Fallback:   published average grid intensities (gCO2e/kWh) so the module
//             still returns something useful without a key. Cite sources in
//             the report (Electricity Maps / Ember yearly averages).

const FALLBACK_INTENSITY = {
  'IN-WE': 727,        // Western India
  'IN-SO': 780,        // Southern India
  'us-central1': 429,  // Iowa, USA (GCP region)
  'eu-central-1': 250, // Frankfurt (GCP / Oracle region)
  'ap-mumbai-1': 727,  // Oracle Mumbai
};

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
    carbonIntensity: FALLBACK_INTENSITY[zone] ?? 400,
    source: 'fallback',
  };
}

/** Returns the region with the lowest carbon intensity (for green routing). */
async function getGreenestRegion(regions) {
  const results = await Promise.all(
    regions.map(async (r) => ({ region: r.name, ...(await getCarbonIntensity(r.zone)) }))
  );
  results.sort((a, b) => a.carbonIntensity - b.carbonIntensity);
  return results[0];
}

module.exports = { getCarbonIntensity, getGreenestRegion, FALLBACK_INTENSITY };
