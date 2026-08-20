@echo off
setlocal
title Opening SWAMI Hostel Ledger
cd /d "%~dp0"

set "NODE_EXE=node"
where node >nul 2>&1
if errorlevel 1 set "NODE_EXE=C:\Users\jayha\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%NODE_EXE%" (
  where node >nul 2>&1
  if errorlevel 1 (
    echo.
    echo Node.js was not found. Please install Node.js 20 or later.
    echo.
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo.
  echo Website packages are missing. Run pnpm install first.
  echo.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo.
  echo The website build is missing. Run pnpm build first.
  echo.
  pause
  exit /b 1
)

echo Starting SWAMI Hostel Ledger...
start "SWAMI Hostel Server" /min "%NODE_EXE%" "server\serve.js"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"
exit /b 0
