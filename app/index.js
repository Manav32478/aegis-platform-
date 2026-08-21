// Local / Docker / Cloud Run entrypoint — binds and listens.
const app = require('./app');
const PORT = process.env.PORT || 3000;
const CLOUD_NAME = process.env.CLOUD_NAME || 'unknown';

// 0.0.0.0 so Docker/GCE/Oracle can reach it
app.listen(PORT, '0.0.0.0', () =>
  console.log(`[${CLOUD_NAME}] listening on port ${PORT}`)
);
