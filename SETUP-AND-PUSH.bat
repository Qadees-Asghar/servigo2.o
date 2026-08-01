@echo off
REM ============================================================
REM  SERVIGO 2.0 - install, build, and push to GitHub
REM  Double-click this file, or run it from any folder.
REM  The /d switch is what makes the drive change actually work.
REM ============================================================

cd /d "%~dp0"

echo.
echo ====================================================
echo   SERVIGO 2.0
echo   Working folder: %CD%
echo ====================================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found on your PATH.
    echo Install Node.js 20 or newer from https://nodejs.org
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. Read the message above.
    pause
    exit /b 1
)

echo.
echo [2/4] Building the project...
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] The build failed. Fix the errors above before pushing.
    pause
    exit /b 1
)

echo.
echo [3/4] Build succeeded.
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] git was not found on your PATH.
    echo Install Git from https://git-scm.com
    pause
    exit /b 1
)

echo [4/4] Pushing to GitHub...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0push.ps1"

echo.
echo Done. Next: import the repo at https://vercel.com/new
pause
