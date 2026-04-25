@echo off
cd /d "%~dp0"
powershell -NoLogo -ExecutionPolicy Bypass -File "%~dp0script-lien-public.ps1"
echo.
pause
