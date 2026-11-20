@echo off
REM Start only the application-origin workspace. See START_HERE.md for staging.
cd /d "%~dp0app"
if not exist node_modules call npm ci
if errorlevel 1 exit /b 1
if not defined PORT set PORT=3000
if not defined CLOUD_NAME set CLOUD_NAME=local
echo Starting Aegis at http://localhost:%PORT%/dashboard
echo This workspace probes configured remote origins. Ctrl+C stops it.
echo See START_HERE.md for the portal, API, monitor, and deployment.
node index.js
