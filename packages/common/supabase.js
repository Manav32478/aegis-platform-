// Aegis v2 — thin Supabase REST client (plain fetch, zero dependencies).
// Works on Node 18/20/22 and inside GitHub Actions / Cloudflare-adjacent Node.

const { SUPABASE_URL, SUPABASE_KEY } = require('./config');

/** supabase(`/rest/v1/health_checks?...`, {method, body}) → parsed JSON */
async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Insert JSON rows into a table (handles the Prefer header). */
async function insert(table, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return sb(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  });
}

/** Insert a single row and return the representation (e.g. to get its id). */
async function insertReturning(table, row) {
  return sb(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
}

/** PATCH rows by id. */
async function update(table, id, patch) {
  return sb(`/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

// ---- schema-aware health_checks access ------------------------------------
// v2 adds `region` + `http_status` columns. If the DB hasn't been migrated
// yet (schema.sql v2), these queries gracefully fall back to the v1 columns.

const HEALTH_COLUMNS_FULL = 'cloud_name,healthy,latency,region,http_status,checked_at';
const HEALTH_COLUMNS_BASE = 'cloud_name,healthy,latency,checked_at';

function isColumnError(e) {
  return /code":"42703|code":"PGRST204|column .* does not exist|could not find the .* column/i.test(
    String(e && e.message)
  );
}

async function getHealthChecks(limit = 2000) {
  try {
    return await sb(
      `/rest/v1/health_checks?select=${HEALTH_COLUMNS_FULL}&order=id.desc&limit=${limit}`
    );
  } catch (e) {
    if (isColumnError(e)) {
      return sb(`/rest/v1/health_checks?select=${HEALTH_COLUMNS_BASE}&order=id.desc&limit=${limit}`);
    }
    throw e;
  }
}

/** Insert checks; fall back to base columns if v2 columns are absent. */
async function insertChecks(rows) {
  try {
    return await insert('health_checks', rows);
  } catch (e) {
    if (isColumnError(e)) {
      const base = rows.map(({ cloud_name, healthy, latency }) => ({ cloud_name, healthy, latency }));
      return insert('health_checks', base);
    }
    throw e;
  }
}

module.exports = { sb, insert, insertReturning, update, getHealthChecks, insertChecks };
