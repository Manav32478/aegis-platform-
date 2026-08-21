#!/usr/bin/env bash
# Aegis — start EVERYTHING with one command (Mac/Linux).
#   ./start.sh        → boots API + app + demo, opens the dashboard
#
# You don't NEED this for the dashboard (dashboard.html works alone by double-click),
# but this also starts the live API + app so the "Developer API" section responds too.
cd "$(dirname "$0")"

echo "============================================"
echo " Aegis — starting everything..."
echo "============================================"

# 1. Core app (port 3000)
if [ -d app ]; then
  (cd app && [ -d node_modules ] || npm install --silent; CLOUD_NAME=local node index.js) &
  echo "  • Core app      → http://localhost:3000"
fi

# 2. Multi-tenant API + Swagger (port 4000)
if [ -d api ]; then
  (cd api && [ -d node_modules ] || npm install --silent; node index.js) &
  echo "  • API + Swagger → http://localhost:4000/api-docs"
fi

# 3. Local chaos demo (port 8080)
node demo/server.js &
echo "  • Failover demo → http://localhost:8080"

sleep 2
open dashboard.html 2>/dev/null || xdg-open dashboard.html 2>/dev/null || echo "Open dashboard.html in your browser"
echo ""
echo "  Dashboard opened. Press Ctrl+C to stop everything."
wait
