@echo off
cd /d "%~dp0"
docker info >nul 2>&1
if errorlevel 1 (
  echo Start Docker Desktop, wait until it is ready, then run start.cmd again.
  pause
  exit /b 1
)
docker compose up --build -d
if errorlevel 1 (
  echo Startup failed. The error is shown above.
  pause
  exit /b 1
)
echo.
echo SignFlow is starting. Open http://localhost:3000
echo Email: tony@signflow.local
echo Password: SignFlow-Demo-2026!
echo Custom values in .env take precedence over these defaults.
pause
