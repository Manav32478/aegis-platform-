(function () {
  'use strict';

  const mode = document.body.dataset.mode || 'origin';
  const content = document.getElementById('page-content');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  const pageNames = {
    dashboard: ['Workspace overview', 'A concise view of the configured application origins and their latest observed health.'],
    services: ['Services', 'Review the application origins Aegis is configured to observe.'],
    monitoring: ['Monitoring', 'Separate live probes from persisted history so each metric has a clear source.'],
    incidents: ['Incidents', 'Review recorded downtime and recovery events.'],
    alerts: ['Alerts', 'Review recorded notifications and delivery status.'],
    routing: ['Traffic routing', 'Inspect router health and the current source-level routing policy.'],
    insights: ['Insights', 'Review operational indicators and their assumptions.'],
    developers: ['Developers', 'API references, integration points and local verification guidance.'],
    settings: ['Settings', 'Review configuration readiness and prototype security boundaries.'],
    status: ['Public status', 'A shareable view of current application-origin probes.']
  };
  const navItems = [
    ['dashboard', 'Overview', '◫', '/dashboard'],
    ['services', 'Services', '◇', '/dashboard/services'],
    ['monitoring', 'Monitoring', '⌁', '/dashboard/monitoring'],
    ['incidents', 'Incidents', '◷', '/dashboard/incidents'],
    ['routing', 'Traffic routing', '⇄', '/dashboard/routing'],
    ['insights', 'Insights', '◒', '/dashboard/insights'],
    ['developers', 'Developers', '⌘', '/dashboard/developers'],
    ['settings', 'Settings', '⚙', '/dashboard/settings'],
    ['status', 'Public status', '◉', '/status']
  ];
  let snapshot = null;
  let lastError = '';
  let sessionSamples = [];
  let refreshTimer = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function pageFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'status') return 'status';
    if (parts[0] === 'dashboard') return parts[1] || 'dashboard';
    return pageNames[parts[0]] ? parts[0] : 'dashboard';
  }

  function formatTime(value) {
    if (!value) return 'Not available';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Not available';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function safeLink(url) {
    if (!url) return '#';
    try {
      const parsed = new URL(url, window.location.origin);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '#';
    } catch (_) { return '#'; }
  }

  function pageMeta(page) {
    return pageNames[page] || pageNames.dashboard;
  }

  function normalize(raw) {
    if (mode === 'portal') {
      const probes = Array.isArray(raw.probes) ? raw.probes : [];
      const analytics = raw.analytics || {};
      // Historical checks are not current probes; never label them live.
      const origins = probes;
      return {
        checkedAt: raw.generatedAt,
        origins: origins,
        analytics: analytics,
        series: raw.series || {},
        incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
        openIncidents: Array.isArray(raw.openIncidents) ? raw.openIncidents : [],
        alerts: Array.isArray(raw.alerts) ? raw.alerts : [],
        diagnostics: raw.diagnostics || {},
        monthlyRequests: raw.monthlyRequests,
        historyRows: Number(raw.diagnostics && raw.diagnostics.historyRows || raw.totalChecks || 0),
        historyAvailable: raw.diagnostics && typeof raw.diagnostics.historyAvailable === 'boolean' ? raw.diagnostics.historyAvailable : null,
        router: raw.router || null,
        routerStatus: raw.routerStatus || null,
        route: raw.route || null,
        cost: raw.cost || null,
        carbon: raw.carbon || [],
        riskMap: raw.riskMap || {},
        riskFlags: raw.riskFlags || [],
        mode: 'portal'
      };
    }
    return {
      checkedAt: raw.checkedAt,
      origins: Array.isArray(raw.origins) ? raw.origins : [],
      incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
      openIncidents: Array.isArray(raw.openIncidents) ? raw.openIncidents : [],
      alerts: [],
      diagnostics: raw.diagnostics || {},
      historyRows: Number(raw.historyRows || 0),
      historyAvailable: false,
      router: raw.router || null,
      routerStatus: raw.routerStatus || null,
      route: null,
      cost: null,
      carbon: [],
      riskMap: {},
      riskFlags: [],
      mode: 'origin',
      portalUrl: raw.portalUrl || ''
    };
  }

  async function fetchSnapshot() {
    const url = mode === 'portal' ? '/api/live' : '/api/platform/summary';
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Data request returned HTTP ' + response.status);
    return normalize(await response.json());
  }

  function isOnline(origin) {
    return origin.enabled !== false && origin.healthy === true;
  }

  function activeOrigins(model) {
    return (model.origins || []).filter(function (o) { return o.enabled !== false; });
  }

  function openIncidents(model) {
    if (model.openIncidents && model.openIncidents.length) return model.openIncidents;
    return (model.incidents || []).filter(function (i) { return !i.ended_at; });
  }

  function healthLabel(origin) {
    if (origin.enabled === false) return ['Planned', 'neutral', 'planned'];
    if (!origin.healthy) return ['Unavailable', 'down', 'down'];
    if (Number(origin.latency != null ? origin.latency : origin.latencyMs) > 800) return ['Degraded', 'neutral', 'planned'];
    return ['Operational', 'up', 'up'];
  }

  function healthPill(origin) {
    const state = healthLabel(origin);
    return '<span class="status-pill ' + (state[1] === 'up' ? '' : state[1]) + '"><i class="state-dot ' + state[2] + '"></i>' + state[0] + '</span>';
  }

  function header(page, action) {
    const meta = pageMeta(page);
    return '<div class="page-head"><div><div class="eyebrow">Aegis operations</div><h1>' + escapeHtml(meta[0]) + '</h1><p>' + escapeHtml(meta[1]) + '</p></div>' +
      '<div class="head-actions">' + (action || '') + '</div></div>';
  }

  function metricCard(icon, label, value, note) {
    return '<article class="kpi-card"><div class="kpi-top"><span>' + escapeHtml(label) + '</span><span class="kpi-icon">' + icon + '</span></div><div class="kpi-value">' + escapeHtml(value) + '</div><div class="kpi-note">' + escapeHtml(note) + '</div></article>';
  }

  function originTable(origins, limit) {
    const list = (limit ? origins.slice(0, limit) : origins);
    if (!list.length) return '<div class="empty-state"><strong>No origin data</strong>Configure an enabled application target to begin health checks.</div>';
    return '<div class="table-wrap"><table class="data-table"><thead><tr><th>Service</th><th>State</th><th>Latency</th><th class="hide-mid">Region</th><th>Last response</th><th></th></tr></thead><tbody>' + list.map(function (o) {
      const state = healthLabel(o);
      const latency = o.latency != null ? o.latency : o.latencyMs;
      const status = o.status != null ? o.status : o.httpStatus;
      const url = safeLink(o.url || '');
      return '<tr><td><div class="origin-name">' + escapeHtml(o.name || 'Unnamed origin') + '</div><div class="origin-sub">' + escapeHtml(o.url || 'No health URL configured') + '</div></td>' +
        '<td>' + healthPill(o) + '</td><td>' + (latency != null ? escapeHtml(latency) + ' ms' : '—') + '</td>' +
        '<td class="muted hide-mid">' + escapeHtml(o.region || '—') + '</td><td class="muted">' + (status > 0 ? 'HTTP ' + escapeHtml(status) : (o.enabled === false ? 'Not probed' : 'No response')) + '</td>' +
        '<td>' + (url !== '#' && o.enabled !== false ? '<a class="button small" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Open ↗</a>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  function originsCards(origins) {
    if (!origins.length) return '<div class="empty-state"><strong>No origins configured</strong>Add an application origin to the monitor configuration.</div>';
    return '<div class="grid three-grid">' + origins.map(function (o) {
      const latency = o.latency != null ? o.latency : o.latencyMs;
      const status = o.status != null ? o.status : o.httpStatus;
      return '<article class="origin-card"><div class="origin-card-head"><div><h3><i class="state-dot ' + (o.enabled === false ? 'planned' : (o.healthy ? 'up' : 'down')) + '"></i>' + escapeHtml(o.name || 'Unnamed origin') + '</h3><p>' + escapeHtml(o.region || 'Region not specified') + '</p></div>' + healthPill(o) + '</div>' +
        '<p>' + escapeHtml(o.url || 'This target is not deployed or has no URL configured.') + '</p><div class="origin-card-metrics"><div><div class="metric-label">Response</div><div class="metric-value">' + (latency != null ? escapeHtml(latency) + ' ms' : '—') + '</div></div><div><div class="metric-label">HTTP status</div><div class="metric-value">' + (status > 0 ? 'HTTP ' + escapeHtml(status) : (o.enabled === false ? 'Not probed' : 'No response')) + '</div></div></div></article>';
    }).join('') + '</div>';
  }

  function noHistoryNote(model) {
    if (mode === 'portal' && model.historyAvailable === false) return '<div class="notice"><strong>History could not be read.</strong> The number of stored checks is unknown. Live probes and incident queries are separate. <a href="/api/diagnostics"><strong>Open diagnostics ↗</strong></a></div>';
    if (mode === 'portal' && model.historyRows > 0) return '';
    if (mode === 'portal') return '<div class="notice info"><strong>No history rows were returned.</strong> Check the monitor, database and <a href="/api/diagnostics"><strong>diagnostics</strong></a>. This does not prove no checks exist.</div>';
    const portal = safeLink(model.portalUrl);
    return '<div class="notice info"><strong>Live probes only.</strong> This application origin does not provide stored history or incidents. ' + (portal !== '#' ? '<a href="' + escapeHtml(portal.replace(/\/+$/, '') + '/dashboard') + '"><strong>Open the control-plane portal ↗</strong></a>' : 'Open the control-plane portal to view stored history.') + '</div>'; 
  }

  function renderOverview(model) {
    const active = activeOrigins(model);
    const online = active.filter(isOnline).length;
    const latencies = active.filter(isOnline).map(o => o.latency != null ? o.latency : o.latencyMs).filter(n => n != null && Number.isFinite(Number(n))).map(Number);
    const avg = latencies.length ? Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length) + ' ms' : '—';
    const open = openIncidents(model).length;
    const countText = mode === 'portal' ? (model.historyAvailable === false ? 'Unavailable' : String(model.historyRows || 0)) : 'Not connected';
    let html = header('dashboard', '<a class="button" href="/status">Public status ↗</a>') + noHistoryNote(model);
    html += '<section class="grid kpi-grid">' +
      metricCard('◇', 'Origins operational', online + ' / ' + active.length, 'Based on latest direct probes') +
      metricCard('⌁', 'Mean live latency', avg, latencies.length ? 'Successful enabled-origin probes' : 'No successful probe available') +
      metricCard('▤', 'Recorded checks', countText, mode === 'portal' ? (model.historyAvailable === false ? 'Could not read stored checks' : 'Recent rows returned; not necessarily total') : 'History service not connected here') +
      metricCard('◷', 'Open incidents', mode === 'portal' && model.diagnostics.incidentsAvailable ? String(open) : 'Unavailable', mode === 'portal' && model.diagnostics.incidentsAvailable ? 'From incident records' : 'Incident records could not be verified') +
      '</section>';
    html += '<section class="grid two-grid"><div class="panel"><div class="panel-head"><div><h2>Application origins</h2><p>Latest health result by configured target</p></div><a class="button small" href="/dashboard/services">View services →</a></div>' + originTable(model.origins, 5) + '</div>';
    html += '<div class="panel"><div class="panel-head"><div><h2>Operational notes</h2><p>What the current data can and cannot tell you</p></div></div>' +
      '<div class="setting-row"><div><strong>Last refresh</strong><p>' + escapeHtml(formatTime(model.checkedAt)) + '</p></div><span class="subtle-pill">' + (lastError ? 'Stale' : 'Snapshot') + '</span></div>' +
      '<div class="setting-row"><div><strong>Routing mode</strong><p>Worker source: healthy origins in configured order; verify deployed Worker.</p></div></div>' +
      '<div class="setting-row"><div><strong>Availability target</strong><p>For comparison only; no SLA is configured.</p></div></div>' +
      (mode === 'portal' && (model.diagnostics.warnings || []).length ? '<div class="notice" style="margin-top:14px">' + escapeHtml(model.diagnostics.warnings.join(' · ')) + ' <a href="/api/diagnostics"><strong>Diagnostics ↗</strong></a></div>' : '<div class="callout" style="margin-top:14px">Aegis is an evaluation prototype. Run a controlled staging test before making a failover or availability claim.</div>') +
      '</div></section>';
    html += '<div class="footer-note">Snapshot timestamp: ' + escapeHtml(formatTime(model.checkedAt)) + ' · History shows a limited recent sample, not necessarily all recorded checks.</div>';
    return html;
  }

  function renderServices(model) {
    let html = header('services', '<button class="button" data-refresh>↻ Refresh probes</button>') + noHistoryNote(model);
    html += '<div class="panel"><div class="panel-head"><div><h2>Configured origins</h2><p>Disabled entries are shown as planned and are not included in the live health count.</p></div><span class="subtle-pill">' + activeOrigins(model).length + ' enabled</span></div>' + originsCards(model.origins) + '</div>';
    html += '<div class="panel"><div class="panel-head"><div><h2>Health contract</h2><p>Read-only inventory. In the portal use Settings → administration to edit database-managed targets; the Worker has separate target configuration.</p></div></div><div class="codebox">GET /health<br>Accept: application/json<br><br>{ "status": "ok", "cloud": "origin-name", "timestamp": "..." }</div></div>';
    return html;
  }

  function chartSvg(model) {
    const colors = ['#4f66e8','#11a27e','#d58a24','#ca5252','#8c5fd3'];
    const names = Object.keys(model.series || {});
    let series = [];
    if (mode === 'portal' && names.length) {
      series = names.map(function (name) { return { name:name, values:(model.series[name].y || []).filter(n => n != null && Number.isFinite(Number(n))).map(Number) }; });
    } else {
      const namesNow = Array.from(new Set(sessionSamples.flatMap(s => s.origins.map(o => o.name))));
      series = namesNow.map(function (name) { return { name:name, values:sessionSamples.map(s => { const o=s.origins.find(x=>x.name===name); const n=o && (o.latency != null ? o.latency : o.latencyMs); return n == null ? null : Number(n); }).filter(n=>Number.isFinite(n)) }; });
    }
    const vals = series.flatMap(s=>s.values).filter(n=>n>=0);
    if (!vals.length) return '<div class="empty-state"><strong>No latency series yet</strong>Open this page again after live probes have returned. Persisted chart history requires the monitoring database.</div>';
    const max = Math.max(100, ...vals) * 1.12;
    const width=720, height=220, left=42, right=10, top=12, bottom=27;
    let grid='';
    for(let i=0;i<4;i++){
      const y=top+(height-top-bottom)*i/3;
      grid += '<line class="chart-grid" x1="'+left+'" y1="'+y+'" x2="'+(width-right)+'" y2="'+y+'"/><text class="chart-axis" x="3" y="'+(y+3)+'">'+Math.round(max*(1-i/3))+'ms</text>';
    }
    let paths='';
    series.forEach(function(s,index){
      const points=s.values.slice(-40).map(function(v,i,arr){
        const x=left+(arr.length<=1?0:i/(arr.length-1))*(width-left-right);
        const y=top+(height-top-bottom)*(1-Math.max(0,v)/max);
        return (i===0?'M':'L')+x.toFixed(1)+' '+y.toFixed(1);
      }).join(' ');
      if(points) paths += '<path class="chart-line" stroke="'+colors[index%colors.length]+'" d="'+points+'"/><circle cx="'+(width-right)+'" cy="'+(top+(height-top-bottom)*(1-Math.max(0,s.values[s.values.length-1])/max))+'" r="3.5" fill="'+colors[index%colors.length]+'"/>';
    });
    const legend=series.map((s,i)=>'<span><i style="background:'+colors[i%colors.length]+'"></i>'+escapeHtml(s.name)+'</span>').join('');
    return '<div class="chart-box"><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Latency trend chart">'+grid+paths+'</svg></div><div class="legend">'+legend+'</div>';
  }

  function renderMonitoring(model) {
    let html = header('monitoring', '<button class="button" data-refresh>↻ Run live probe</button>') + noHistoryNote(model);
    html += '<div class="grid two-grid"><div class="panel"><div class="panel-head"><div><h2>Response time</h2><p>' + (mode === 'portal' && model.historyRows ? 'Persisted checks from the control plane' : 'Recent samples in this browser session only') + '</p></div><span class="subtle-pill">Milliseconds</span></div>' + chartSvg(model) + '</div>';
    html += '<div class="panel"><div class="panel-head"><div><h2>Current probe window</h2><p>Most recent results returned by the origin check.</p></div></div>' + originTable(model.origins) + '</div></div>';
    html += '<div class="callout">A live probe measures a single request. Uptime percentages require a defined observation window and a complete history of checks.</div>';
    return html;
  }

  function renderIncidents(model) {
    const list = (model.incidents || []).slice().sort((a,b)=>new Date(b.started_at||0)-new Date(a.started_at||0));
    let html = header('incidents', mode === 'portal' ? '<a class="button" href="/api/diagnostics">View diagnostics ↗</a>' : '<a class="button" href="/status">Public status ↗</a>');
    if (mode !== 'portal' || !model.diagnostics.incidentsAvailable) return html + '<div class="panel"><div class="empty-state"><strong>Incident history is unavailable on this deployment.</strong>This page needs the Aegis control-plane database. The absence of records here does not mean there have been no incidents.</div></div>';
    html += noHistoryNote(model);
    if (!list.length) return html + '<div class="panel"><div class="empty-state"><strong>No incident records were returned</strong>Check that the monitor is writing incident transitions and that the data source is reachable.</div></div>';
    html += '<div class="panel"><div class="panel-head"><div><h2>Incident timeline</h2><p>Records returned by the connected control plane.</p></div><span class="subtle-pill">' + list.length + ' records</span></div><div class="timeline">' + list.map(function(i){
      const open=!i.ended_at; const kind=i.kind|| (open?'down':'recovered');
      return '<div class="timeline-item"><div class="timeline-date">'+escapeHtml(formatTime(i.started_at))+'</div><div><div class="timeline-title">'+escapeHtml(i.cloud_name||'Origin')+' · '+escapeHtml(kind)+'</div><div class="timeline-desc">'+(open?'No recovery time recorded yet.':('Recovered '+escapeHtml(formatTime(i.ended_at))+(i.duration_seconds!=null?' · '+escapeHtml(i.duration_seconds)+' seconds':'') ))+'</div></div><span class="tag '+(open?'critical':'info')+'">'+(open?'OPEN':'CLOSED')+'</span></div>';
    }).join('')+'</div></div>';
    return html;
  }

  function renderAlerts(model) {
    let html = header('alerts');
    if (mode !== 'portal' || !model.diagnostics.alertsAvailable) return html + '<div class="panel"><div class="empty-state"><strong>Alert records are unavailable</strong>Connect and verify the control-plane database. This does not confirm that alerts were delivered.</div></div>';
    const alerts = model.alerts || [];
    if (!alerts.length) return html + '<div class="panel"><div class="empty-state"><strong>No alert records were returned</strong>Delivery depends on the configured monitor and webhook settings.</div></div>';
    return html + '<div class="panel"><div class="panel-head"><div><h2>Recent alerts</h2><p>Database records; delivery is not guaranteed.</p></div></div><div class="timeline">' + alerts.map(a => '<div class="timeline-item"><div class="timeline-date">' + escapeHtml(formatTime(a.created_at)) + '</div><div><div class="timeline-title">' + escapeHtml(a.cloud_name || 'Origin') + ' · ' + escapeHtml(a.kind || 'alert') + '</div><div class="timeline-desc">' + escapeHtml(a.message || '') + '</div></div><span class="tag">' + (a.delivered ? 'DELIVERED' : 'NOT CONFIRMED') + '</span></div>').join('') + '</div></div>';
  }

  function renderRouting(model) {
    const router = model.routerStatus || model.router || {};
    const routerTargets = Array.isArray(router.targets) ? router.targets : [];
    let html = header('routing');
    html += '<div class="notice"><strong>Routing policy:</strong> the current Worker source prefers healthy origins in configured order. The dashboard’s composite health ranking is advisory and is not the Worker’s selection algorithm.</div>';
    html += '<div class="grid two-grid"><div class="panel"><div class="panel-head"><div><h2>Origin eligibility</h2><p>Eligibility is based on the latest probe data available to this page.</p></div></div>'+originTable(model.origins)+'</div>';
    html += '<div class="panel"><div class="panel-head"><div><h2>Router diagnostics</h2><p>Worker metadata, when reachable.</p></div></div>';
    if (routerTargets.length) {
      html += '<div class="origin-list">'+routerTargets.map(t=>'<div class="setting-row"><div><strong>'+escapeHtml(t.name)+'</strong><p>Cached router health</p></div><span class="tag '+(t.healthy?'info':'critical')+'">'+(t.healthy?'HEALTHY':'UNHEALTHY')+'</span></div>').join('')+'</div>';
    } else {
      html += '<div class="empty-state"><strong>Router metadata unavailable</strong>Open the Worker health route and verify that the deployed Worker matches the current source.</div>';
    }
    html += '<div class="callout" style="margin-top:14px">A multi-origin failover test has not been confirmed for the current deployment. Test only against staging origins before changing a live route.</div></div></div>';
    return html;
  }

  function renderInsights(model) {
    let html = header('insights');
    html += '<div class="notice info"><strong>Estimates, not billing data.</strong> Cost and carbon values depend on assumptions, provider limits and data sources. Compare estimates with actual provider usage before using them in a proposal.</div>';
    const cost=model.cost;
    if (mode==='portal' && cost) {
      html += '<div class="grid three-grid"><div class="kpi-card"><div class="kpi-top">Estimated monthly requests</div><div class="kpi-value">'+escapeHtml(model.monthlyRequests != null ? model.monthlyRequests : '—')+'</div><div class="kpi-note">Derived from current counters or a configured default</div></div><div class="kpi-card"><div class="kpi-top">Illustrative single-host model</div><div class="kpi-value">$'+escapeHtml(cost.singleCloud||0)+'</div><div class="kpi-note">Assumption in the project cost module</div></div><div class="kpi-card"><div class="kpi-top">Zero-cost assumption</div><div class="kpi-value">$'+escapeHtml(cost.aegisCost||0)+'</div><div class="kpi-note">Hard-coded model input; not a billing estimate</div></div></div>';
    } else {
      html += '<div class="panel"><div class="empty-state"><strong>No billing data is connected</strong>The cost model can be reviewed in the code, but this deployment has no provider billing integration.</div></div>';
    }
    const carbon=Array.isArray(model.carbon)?model.carbon:[];
    if(carbon.length){html+='<div class="panel"><div class="panel-head"><div><h2>Regional carbon reference</h2><p>Source values are labelled live or fallback where provided by the data service.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Region</th><th>Zone</th><th>Intensity gCO₂/kWh</th><th>Source</th></tr></thead><tbody>'+carbon.map(c=>'<tr><td>'+escapeHtml(c.region)+'</td><td>'+escapeHtml(c.zone)+'</td><td>'+escapeHtml(c.carbonIntensity)+'</td><td>'+escapeHtml(c.source||'unknown')+'</td></tr>').join('')+'</tbody></table></div></div>';}else{html+='<div class="panel"><div class="empty-state"><strong>No live carbon source is connected</strong>The project may use documented fallback estimates; they should not be described as real-time measurements.</div></div>';}
    return html;
  }

  function renderDevelopers() {
    const apiDocs = '<span class="subtle-pill">Separate API service</span>';
    let html=header('developers',apiDocs);
    html+='<div class="grid two-grid"><div class="panel"><div class="panel-head"><div><h2>Health endpoint</h2><p>Public contract implemented by the protected app.</p></div></div><div class="codebox">GET /health<br>Accept: application/json</div></div><div class="panel"><div class="panel-head"><div><h2>Local API service</h2><p>Run the API service separately in development.</p></div></div><div class="codebox">cd api<br>npm ci<br>node index.js<br><br>http://localhost:4000/api-docs</div></div></div>';
    html+='<div class="panel"><div class="panel-head"><div><h2>Example authenticated request</h2><p>Never place a real API key in screenshots, source code or a public repository.</p></div></div><div class="codebox">curl -H "x-api-key: YOUR_API_KEY" \\\n  http://localhost:4000/api/status</div></div>';
    html+='<div class="panel"><div class="panel-head"><div><h2>API capability groups</h2><p>Routes are documented in the API service; availability depends on that service and database configuration.</p></div></div><div class="grid three-grid"><article class="feature-card"><h3>Monitoring</h3><p>/api/status · /api/monitoring · /api/incidents</p></article><article class="feature-card"><h3>Operations</h3><p>/api/alerts · /api/reports · /api/failover</p></article><article class="feature-card"><h3>Advisory data</h3><p>/api/cost-report · /api/forecast · /api/risk</p></article></div></div>';
    return html;
  }

  function renderSettings(model) {
    let html=header('settings');
    html+='<div class="notice"><strong>Prototype boundary:</strong> this workspace does not currently implement production user accounts, billing, organisation-level data isolation or a customer-facing control for editing deployment secrets.</div>';
    html+='<div class="panel"><div class="panel-head"><div><h2>Connection status</h2><p>Safe summary only. Secret values are never displayed.</p></div></div>';
    html+='<div class="setting-row"><div><strong>Live origin probes</strong><p>Checked at '+escapeHtml(formatTime(model.checkedAt))+'</p></div><span class="status-pill">'+activeOrigins(model).length+' configured</span></div>';
    html+='<div class="setting-row"><div><strong>Persistent history</strong><p>'+(model.historyAvailable === false ? 'Could not read history' : model.historyRows>0?escapeHtml(model.historyRows)+' recent rows returned':'No stored check rows returned by this view')+'</p></div><span class="status-pill '+(model.historyRows>0?'':'neutral')+'">'+(model.historyAvailable === false ? 'Unavailable' : model.historyRows>0?'Connected':'Needs verification')+'</span></div>';
    html+='<div class="setting-row"><div><strong>Router metadata</strong><p>Verify the Worker health endpoint and deployed target list.</p></div><span class="status-pill '+(model.routerStatus && model.routerStatus.available !== false?'':'neutral')+'">'+(model.routerStatus && model.routerStatus.available !== false?'Available':'Not confirmed')+'</span></div>';
    html+='<div class="setting-row"><div><strong>Authentication</strong><p>Admin token and API-key mechanisms are prototype-grade; secure configuration is required.</p></div><span class="status-pill neutral">Prototype</span></div>';
    html+='</div>' + (mode === 'portal' ? '<div class="callout">Target administration is available separately at <a href="/admin.html"><strong>/admin.html</strong></a> after setting a strong ADMIN_TOKEN. Changes require database permissions and do not automatically change Worker targets.</div>' : '') + '<div class="panel"><div class="panel-head"><div><h2>Deployment checklist</h2><p>Use the project guide for provider-specific configuration.</p></div></div><ol class="muted"><li>Set environment values in the hosting provider’s settings, never in the ZIP.</li><li>Deploy the portal and protected app as separate projects with the correct root directories.</li><li>Deploy the Worker after updating its origins and secret bindings.</li><li>Run health, diagnostics and staging failover checks before presenting the platform.</li></ol></div>';
    return html;
  }

  function renderStatus(model) {
    const active=activeOrigins(model);
    let html=header('status', '<span class="subtle-pill">Shareable · live probe snapshot</span>')+noHistoryNote(model);
    html+='<div class="panel"><div class="panel-head"><div><h2>Application components</h2><p>Latest response from each enabled health endpoint.</p></div><span class="subtle-pill">Updated '+escapeHtml(formatTime(model.checkedAt))+'</span></div>'+originsCards(model.origins)+'</div>';
    const inc=(model.incidents||[]).slice(0,8);
    html+='<div class="panel"><div class="panel-head"><div><h2>Recent incidents</h2><p>Incident records are shown only when the connected control plane returns them.</p></div></div>';
    if(mode!=='portal' || !model.diagnostics.incidentsAvailable) html+='<div class="empty-state"><strong>Incident history is not connected on this origin.</strong>Current health checks do not provide persisted incident history.</div>';
    else if(!inc.length) html+='<div class="empty-state"><strong>No incident records were returned</strong>This is not a guarantee that no failures occurred.</div>';
    else html+='<div class="timeline">'+inc.map(i=>'<div class="timeline-item"><div class="timeline-date">'+escapeHtml(formatTime(i.started_at))+'</div><div><div class="timeline-title">'+escapeHtml(i.cloud_name)+' · '+escapeHtml(i.kind)+'</div><div class="timeline-desc">'+(i.ended_at?'Recovered '+escapeHtml(formatTime(i.ended_at)):'Open incident')+'</div></div><span class="tag '+(i.ended_at?'info':'critical')+'">'+(i.ended_at?'CLOSED':'OPEN')+'</span></div>').join('')+'</div>';
    html+='</div><div class="footer-note">Public status is an observation at the time shown. It is not an availability commitment.</div>';
    return html;
  }

  function render(page, model) {
    const valid = Object.prototype.hasOwnProperty.call(pageNames,page) ? page : 'dashboard';
    document.title = pageMeta(valid)[0] + ' | Aegis';
    document.getElementById('crumb-current').textContent = pageMeta(valid)[0];
    document.querySelectorAll('.nav-link').forEach(function(a){a.classList.toggle('active',a.dataset.page===valid);});
    if(valid==='dashboard') content.innerHTML=renderOverview(model);
    else if(valid==='services') content.innerHTML=renderServices(model);
    else if(valid==='monitoring') content.innerHTML=renderMonitoring(model);
    else if(valid==='incidents') content.innerHTML=renderIncidents(model);
    else if(valid==='alerts') content.innerHTML=renderAlerts(model);
    else if(valid==='routing') content.innerHTML=renderRouting(model);
    else if(valid==='insights') content.innerHTML=renderInsights(model);
    else if(valid==='developers') content.innerHTML=renderDevelopers();
    else if(valid==='settings') content.innerHTML=renderSettings(model);
    else if(valid==='status') content.innerHTML=renderStatus(model);
    document.querySelectorAll('[data-refresh]').forEach(b=>b.addEventListener('click', refresh));
  }

  function recordSession(model) {
    sessionSamples.push({ at:model.checkedAt || new Date().toISOString(), origins:(model.origins||[]).filter(o=>o.enabled!==false) });
    if(sessionSamples.length>40) sessionSamples=sessionSamples.slice(-40);
  }

  async function refresh() {
    try {
      snapshot = await fetchSnapshot();
      lastError = '';
      recordSession(snapshot);
      render(pageFromPath(), snapshot);
    } catch (e) {
      lastError = e.message || 'Unable to load current data';
      if (snapshot) {
        render(pageFromPath(), snapshot);
        const n=document.createElement('div');
        n.className='notice';
        n.textContent='Refresh failed: '+lastError+'. Showing the last snapshot received.';
        content.prepend(n);
      } else {
        content.innerHTML='<div class="page-head"><div><div class="eyebrow">Aegis operations</div><h1>Workspace data unavailable</h1><p>The interface loaded, but the configured data endpoint did not return a valid response.</p></div></div><div class="panel"><div class="empty-state"><strong>Could not load the current snapshot</strong>'+escapeHtml(lastError)+'<br><br>Check the application deployment, the /api/platform/summary route and origin network access.</div><button class="button primary" data-refresh style="margin-top:14px">Try again</button></div>';
        document.querySelectorAll('[data-refresh]').forEach(b=>b.addEventListener('click',refresh));
      }
    }
  }

  const menuButton=document.getElementById('menu-button');
  if(menuButton) menuButton.addEventListener('click',function(){sidebar.classList.add('open');overlay.classList.add('show');});
  if(overlay) overlay.addEventListener('click',function(){sidebar.classList.remove('open');overlay.classList.remove('show');});
  document.querySelectorAll('.nav-link').forEach(function(a){a.addEventListener('click',function(){sidebar.classList.remove('open');overlay.classList.remove('show');});});
  const refreshButton=document.getElementById('refresh-button');
  if(refreshButton) refreshButton.addEventListener('click',refresh);

  refresh();
  refreshTimer=setInterval(function(){if(!document.hidden) refresh();},15000);
  window.addEventListener('pagehide',function(){if(refreshTimer) clearInterval(refreshTimer);});
})();
