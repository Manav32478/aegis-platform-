# Vercel serverless health probe for SPARSH store.
# Put this at:  api/health.js   (next to your Vite app; directory "api" at root)
# It returns LIVE JSON with a request counter — better than a static file
# because the dashboard can show "requests served" per cloud.
#
# Deploy: just push to GitHub (if Vercel auto-deploys) — then open
#   https://yoursparshstore.vercel.app/api/health
# You should see JSON like:  {"status":"ok","cloud":"vercel","requests":12,"uptimeSeconds":340}

let requests = 0;
const started = Date.now();

export default function handler(req, res) {
  requests += 1;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    cloud: 'vercel',
    requests,
    uptimeSeconds: Math.round((Date.now() - started) / 1000),
    timestamp: Date.now(),
  });
}
