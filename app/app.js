// Aegis core app (Express) — shared by every cloud.
// Contract (identical across clouds): GET /health -> {status, cloud, ...}
const express = require('express');
const path = require('path');
const { statusPage } = require('./status-page');

const app = express();
const CLOUD_NAME = process.env.CLOUD_NAME || 'unknown';
const START_TIME = Date.now();
let requestCount = 0;

app.use((req, res, next) => {
  requestCount += 1;
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    cloud: CLOUD_NAME,
    uptimeSeconds: Math.round((Date.now() - START_TIME) / 1000),
    requests: requestCount,
    timestamp: Date.now(),
  });
});

app.get('/', (req, res) => {
  res.type('html').send(`
    <h1>Aegis — hello from ${CLOUD_NAME}</h1>
    <p>Uptime: ${Math.round((Date.now() - START_TIME) / 1000)}s · Requests served: ${requestCount}</p>
    <p><a href="/dashboard">/dashboard (control center)</a> · <a href="/status">/status (live status)</a> · <a href="/health">/health</a></p>
  `);
});

// Live status page — reads real health history from Supabase (Month 3/5).
app.get('/status', (req, res) => {
  res.type('html').send(statusPage());
});

// Unified control-center dashboard (Month 5) — served from every cloud.
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

module.exports = app;
