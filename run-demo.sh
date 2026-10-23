#!/usr/bin/env bash
# One-command demo launcher (Mac/Linux).
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Download it free from https://nodejs.org"
  exit 1
fi
echo "============================================"
echo " Aegis demo starting..."
echo " Open http://localhost:8080 in your browser"
echo " Press Ctrl+C to stop"
echo "============================================"
node demo/server.js
