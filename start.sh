#!/usr/bin/env bash
# Aegis v2 — start the ENTIRE platform with one command (Mac/Linux, no Docker).
#   ./start.sh
#
# Boots:  web portal (:3100) · API + Swagger (:4000) · monitor (one-shot loop)
# Then opens the portal in your browser.
# Prefer Docker?  `docker compose up --build`
cd "$(dirname "$0")"

echo "============================================"
echo " Aegis v2 — starting the whole platform..."
echo "============================================"

# 1. Web portal (landing + dashboard + status + admin)
if [ -d web ]; then
  (cd web && [ -d node_modules ] || npm install --silent; node server.js) &
  echo "  • Portal       → http://localhost:3100"
fi

# 2. Multi-tenant API + Swagger
if [ -d api ]; then
  (cd api && [ -d node_modules ] || npm install --silent; node index.js) &
  echo "  • API + Swagger→ http://localhost:4000/api-docs"
fi

# 3. Health monitor — one cycle now, then every 5 min
if [ -d orchestration ]; then
  (cd orchestration && while true; do node monitor.js; sleep 300; done) &
  echo "  • Monitor      → writes checks to Supabase every 5 min"
fi

# 4. Optional local chaos demo (failover sandbox)
if [ -f demo/server.js ]; then
  (node demo/server.js) &
  echo "  • Failover demo→ http://localhost:8080"
fi

sleep 2
open http://localhost:3100 2>/dev/null || xdg-open http://localhost:3100 2>/dev/null || echo "Open http://localhost:3100 in your browser"
echo ""
echo "  Portal opened. Press Ctrl+C to stop everything."
wait
