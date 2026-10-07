@echo off
rem Reading Forest - new PC setup. Double-click to run scripts\setup-new-pc.ps1 (installs tools, logs in, pulls .env.local).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-new-pc.ps1" %*
echo.
pause
