@echo off
cd /d "%~dp0"
powershell -NoLogo -ExecutionPolicy Bypass -File "%~dp0ouvrir-emotiometre-partout.ps1"
echo.
pause
