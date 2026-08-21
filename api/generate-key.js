// Generate an API key (Month 5) — writes an organization + hashed key to Supabase.
// The plaintext key is printed ONCE — store it somewhere safe.
//
// Run:  cd api && node generate-key.js           # org "default"
//       ORG_NAME=acme node generate-key.js       # named org
const crypto = require('crypto');

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://kagjbxxmdyaypfcqemem.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  'sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti';
const ORG_NAME = process.env.ORG_NAME || 'default';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  // 1. find or create the organization
  let orgId;
  const existing = await sb(
    `/rest/v1/organizations?name=eq.${encodeURIComponent(ORG_NAME)}&select=id&limit=1`
  );
  if (Array.isArray(existing) && existing.length) {
    orgId = existing[0].id;
    console.log(`using existing organization "${ORG_NAME}" (${orgId})`);
  } else {
    const created = await sb('/rest/v1/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ name: ORG_NAME }),
    });
    orgId = created[0].id;
    console.log(`created organization "${ORG_NAME}" (${orgId})`);
  }

  // 2. create the API key (store only its hash)
  const key = 'ak_' + crypto.randomBytes(24).toString('hex');
  const hash = sha256(key);
  await sb('/rest/v1/api_keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ org_id: orgId, key_hash: hash }),
  });

  console.log('\n✅ API key created. SAVE THIS (shown only once):\n');
  console.log('   ' + key + '\n');
  console.log('Try it:');
  console.log('   node index.js   (in another terminal)');
  console.log(`   curl -H "x-api-key: ${key}" http://localhost:4000/api/status`);
}

main().catch((e) => {
  console.error('failed:', e.message);
  process.exit(1);
});
