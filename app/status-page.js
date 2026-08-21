// Live public status page — served at GET /status on every cloud.
// Reads health_checks + risk_flags straight from Supabase (the publishable key
// is safe to expose in the browser — that is exactly what it is for).
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://kagjbxxmdyaypfcqemem.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  'sb_publishable_cwauqX8Hq9ORgefEDU38cA_H4I-4qti';

function statusPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aegis — Live Status</title>
<style>
  :root { --bg:#0b0f1a; --panel:#131a2b; --border:#243047; --text:#e6ebf5; --muted:#8b96ad; --green:#3ddc84; --red:#ff5d5d; --amber:#ffb454; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--text); }
  header { padding:16px 22px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  header h1 { font-size:17px; margin:0; }
  .badge { font-size:12px; padding:3px 10px; border-radius:999px; background:#1c2a4a; color:#9db4ff; border:1px solid #2c3d66; }
  main { max-width:1000px; margin:0 auto; padding:20px; display:grid; gap:16px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:16px; }
  .top { display:flex; justify-content:space-between; align-items:center; }
  .dot { width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:8px; background:var(--muted); }
  .dot.up { background:var(--green); box-shadow:0 0 8px rgba(61,220,132,.6); }
  .dot.down { background:var(--red); box-shadow:0 0 8px rgba(255,93,93,.6); }
  .latency { font-size:24px; font-weight:600; margin:8px 0 2px; }
  .muted { color:var(--muted); font-size:12px; }
  .pill { font-size:11px; padding:2px 8px; border-radius:999px; }
  .pill.up { background:rgba(61,220,132,.12); color:var(--green); }
  .pill.down { background:rgba(255,93,93,.14); color:var(--red); }
  .pill.warn { background:rgba(255,180,84,.14); color:var(--amber); }
  canvas { width:100%; height:220px; display:block; }
  .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:space-between; }
  .big { font-size:28px; font-weight:700; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  td { padding:6px 8px; border-bottom:1px solid var(--border); }
  .okline { color:var(--green); }
</style>
</head>
<body>
<header>
  <h1>⚔️ Aegis — Live Status</h1>
  <span class="badge">real data from Supabase</span>
  <span class="badge" id="lastUpdate">updating…</span>
</header>
<main>
  <div class="grid" id="clouds"></div>
  <div class="grid" style="grid-template-columns:2fr 1fr;">
    <div class="card">
      <div class="row"><strong>Latency (ms)</strong><span class="muted">last 300 checks per cloud</span></div>
      <canvas id="chart" width="900" height="220"></canvas>
    </div>
    <div class="card">
      <strong>💸 Cost intelligence</strong>
      <div class="muted" style="margin:8px 0">vs one paid single-cloud instance</div>
      <div class="big" style="color:var(--green)">$40/mo saved</div>
      <table>
        <tr><td>Monthly requests</td><td>1,000,000</td></tr>
        <tr><td>Single paid cloud</td><td>$40/mo</td></tr>
        <tr><td>Aegis (free tiers)</td><td>$0/mo</td></tr>
      </table>
      <div class="muted" style="margin-top:8px">Illustrative rate — see intelligence/cost.js</div>
    </div>
  </div>
  <div class="grid">
    <div class="card">
      <strong>🔮 Predictive risk (ML)</strong>
      <div id="risk" class="muted" style="margin-top:8px">loading…</div>
      <div class="muted" style="margin-top:10px">Isolation Forest · flags clouds before they fail</div>
    </div>
    <div class="card">
      <strong>🌱 Carbon awareness</strong>
      <div class="muted" style="margin:8px 0">Grid intensity (gCO₂/kWh) — fallback data</div>
      <table>
        <tr><td>eu-central-1</td><td class="okline">250 ← greenest</td></tr>
        <tr><td>us-central1</td><td>429</td></tr>
        <tr><td>IN-WE (India)</td><td>727</td></tr>
      </table>
      <div class="muted" style="margin-top:8px">Add ELECTRICITYMAP_KEY for live values</div>
    </div>
    <div class="card">
      <strong>🛡️ Security + policy</strong>
      <div class="muted" style="margin:8px 0">Runs in CI on every push</div>
      <table>
        <tr><td>Trivy</td><td>container/image scan</td></tr>
        <tr><td>Checkov</td><td>IaC misconfig scan</td></tr>
        <tr><td>OPA/Rego</td><td>policy-as-code</td></tr>
      </table>
      <div class="muted" style="margin-top:8px">See repo → Actions → Security scan</div>
    </div>
  </div>
</main>
<script>
var SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};
var SUPABASE_KEY = ${JSON.stringify(SUPABASE_KEY)};
var colors = ['#3ddc84', '#4285f4', '#ffb454', '#c74634', '#a06bff'];
var colorOf = {};

function fmtAgo(iso) {
  if (!iso) return 'never';
  var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

function headers() {
  return { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
}

async function load() {
  try {
    var res = await fetch(SUPABASE_URL + '/rest/v1/health_checks?select=*&order=id.desc&limit=300', { headers: headers() });
    var rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('bad response');
    render(rows);
  } catch (e) {
    document.getElementById('lastUpdate').textContent = 'error loading data';
  }
}

async function loadRisk() {
  try {
    var res = await fetch(SUPABASE_URL + '/rest/v1/risk_flags?select=*&order=id.desc&limit=50', { headers: headers() });
    var rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('bad response');
    var latest = {};
    rows.forEach(function (r) {
      if (!latest[r.cloud_name]) latest[r.cloud_name] = r;
    });
    var names = Object.keys(latest);
    var el = document.getElementById('risk');
    if (!names.length) {
      el.innerHTML = '<span class="okline">No clouds flagged — all healthy.</span>';
    } else {
      el.innerHTML = names.map(function (n) {
        return '<div style="display:flex;justify-content:space-between;margin:4px 0">'
          + '<span class="pill warn">⚠ ' + n + '</span>'
          + '<span class="muted">' + fmtAgo(latest[n].flagged_at) + '</span></div>';
      }).join('');
    }
  } catch (e) {
    document.getElementById('risk').textContent = 'no risk data yet';
  }
}

function render(rows) {
  var by = {};           // cloud -> rows (ascending time)
  var order = [];
  rows.forEach(function (r) {
    if (!by[r.cloud_name]) { by[r.cloud_name] = []; order.push(r.cloud_name); }
    by[r.cloud_name].push(r);
  });
  order.forEach(function (name, i) { colorOf[name] = colors[i % colors.length]; });

  var cards = order.map(function (name) {
    var latest = by[name][0];
    var healthyCount = 0, latencySum = 0, latencyCount = 0;
    by[name].forEach(function (r) {
      if (r.healthy) healthyCount++;
      if (r.latency != null) { latencySum += r.latency; latencyCount++; }
    });
    var up = latest && latest.healthy;
    var uptime = Math.round((healthyCount / by[name].length) * 100);
    var avg = latencyCount ? Math.round(latencySum / latencyCount) : null;
    return '<div class="card">'
      + '<div class="top"><span><span class="dot ' + (up ? 'up' : 'down') + '"></span>' + name + '</span>'
      + '<span class="pill ' + (up ? 'up' : 'down') + '">' + (up ? 'UP' : 'DOWN') + '</span></div>'
      + '<div class="latency">' + (latest && latest.latency != null ? latest.latency + ' ms' : '—') + '</div>'
      + '<div class="muted">last check ' + (latest ? fmtAgo(latest.checked_at) : 'never') + '</div>'
      + '<div class="muted">avg ' + (avg != null ? avg + ' ms' : '—') + ' · uptime ' + uptime + '% · ' + by[name].length + ' checks</div>'
      + '</div>';
  }).join('');
  document.getElementById('clouds').innerHTML = cards || '<div class="card muted">No checks yet — the monitor will populate this.</div>';
  document.getElementById('lastUpdate').textContent = 'updated ' + fmtAgo(rows.length ? rows[0].checked_at : null);
  drawChart(by, order);
}

function drawChart(by, order) {
  var cv = document.getElementById('chart');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height, pad = 34;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#243047'; ctx.fillStyle = '#8b96ad'; ctx.font = '11px system-ui';
  for (var yv = 0; yv <= 300; yv += 100) {
    var y = H - pad - (yv/300) * (H - pad*2);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - 8, y); ctx.stroke();
    ctx.fillText(String(yv), 4, y + 4);
  }
  var allTs = [];
  order.forEach(function (n) { by[n].forEach(function (r) { allTs.push(new Date(r.checked_at).getTime()); }); });
  if (!allTs.length) return;
  var tMin = Math.min.apply(null, allTs), tMax = Math.max.apply(null, allTs);
  if (tMax === tMin) tMax = tMin + 1;
  order.forEach(function (name) {
    ctx.strokeStyle = colorOf[name]; ctx.lineWidth = 2; ctx.beginPath();
    var started = false;
    by[name].slice().reverse().forEach(function (r) {
      var t = new Date(r.checked_at).getTime();
      var x = pad + ((t - tMin) / (tMax - tMin)) * (W - pad - 10);
      var y = (r.latency == null) ? H - pad : H - pad - (Math.min(r.latency, 300)/300) * (H - pad*2);
      if (r.latency == null) { started = false; return; }
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = colorOf[name];
    ctx.fillText(name, W - 8 - ctx.measureText(name).width, 14 + order.indexOf(name) * 14);
  });
}

load();
loadRisk();
setInterval(load, 15000);
setInterval(loadRisk, 60000);
</script>
</body>
</html>`;
}

module.exports = { statusPage };
