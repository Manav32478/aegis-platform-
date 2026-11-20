#!/usr/bin/env bash
# Start only the read-only application-origin workspace. See START_HERE.md
# before starting the control plane, API, monitor, or cloud deployments.
set -e
cd "$(dirname "$0")/app"
if [ ! -d node_modules ]; then npm ci; fi
echo 'Starting Aegis at http://localhost:3000/dashboard'
echo 'This workspace probes configured remote origins. Ctrl+C stops it.'
echo 'For staging database, API, monitoring and deployment, read START_HERE.md.'
PORT=${PORT:-3000} CLOUD_NAME=${CLOUD_NAME:-local} node index.js
