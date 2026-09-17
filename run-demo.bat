@echo off
REM One-click demo launcher (Windows). Double-click this file.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed. Download it free from https://nodejs.org
    pause
    exit /b 1
)
echo.
echo  ============================================
echo   Aegis demo starting...
echo   Open http://localhost:8080 in your browser
echo   Press Ctrl+C to stop
echo  ============================================
echo.
node demo\server.js
pause
