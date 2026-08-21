@echo off
REM Aegis — start EVERYTHING with one double-click (Windows).
REM You don't NEED this for the dashboard (dashboard.html works alone),
REM but this also starts the live API + app for the "Developer API" section.
cd /d "%~dp0"

echo ============================================
echo  Aegis — starting everything...
echo ============================================

start "Aegis App" cmd /c "cd app && (if not exist node_modules npm install) && set CLOUD_NAME=local && node index.js"
start "Aegis API" cmd /c "cd api && (if not exist node_modules npm install) && node index.js"
start "Aegis Demo" cmd /c "node demo\server.js"

start "" "dashboard.html"
echo  Dashboard opened. Close the three windows to stop.
