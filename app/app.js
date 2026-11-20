'use strict';

const express = require('express');
const path = require('path');
const { getPlatformSummary } = require('./platform-data');

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');
const CLOUD_NAME = process.env.CLOUD_NAME || 'unknown';
const START_TIME = Date.now();
let requestCount = 0;

app.disable('x-powered-by');
app.use((req, res, next) => {
  requestCount += 1;
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(PUBLIC_DIR, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    cloud: CLOUD_NAME,
    uptimeSeconds: Math.round((Date.now() - START_TIME) / 1000),
    requests: requestCount,
    timestamp: Date.now(),
  });
});

app.get('/api/platform/summary', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await getPlatformSummary());
  } catch (error) {
    res.status(502).json({ error: 'Unable to build the live platform snapshot.' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

const shell = (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'app-shell.html'));
app.get([
  '/dashboard', '/dashboard/:section',
  '/services', '/monitoring', '/incidents', '/routing', '/insights', '/developers', '/settings',
  '/status',
], shell);

app.get('/dashboard.html', (req, res) => res.redirect(302, '/dashboard'));
app.get('/status.html', (req, res) => res.redirect(302, '/status'));

app.use((req, res) => res.status(404).type('text').send('Aegis page not found. Return to /dashboard.'));

module.exports = app;
