@echo off
REM Aegis v2 — start the ENTIRE platform (Windows, no Docker).
cd /d %~dp0

echo ============================================
echo  Aegis v2 - starting the whole platform...
echo ============================================

start "Aegis Portal" cmd /k "cd web && (if not exist node_modules npm install) && node server.js"
start "Aegis API"    cmd /k "cd api && (if not exist node_modules npm install) && node index.js"
start "Aegis Monitor" cmd /k "cd orchestration && node monitor.js"
start "Aegis Demo"   cmd /k "node demo/server.js"

timeout /t 3 >nul
start http://localhost:3100
echo Portal opened. Close the windows to stop everything.
