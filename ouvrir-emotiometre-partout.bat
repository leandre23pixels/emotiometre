@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"

if not defined NODE_EXE (
  if exist "C:\Users\leand\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "NODE_EXE=C:\Users\leand\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  )
)

if not defined NODE_EXE (
  echo Node.js est introuvable.
  echo Installe Node.js ou ouvre d'abord Codex sur cet ordinateur, puis relance ce fichier.
  echo.
  pause
  exit /b 1
)

set "CLOUDFLARED_EXE=%TEMP%\cloudflared-emotiometre.exe"

if not exist "%CLOUDFLARED_EXE%" (
  echo Telechargement du tunnel public Cloudflare...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CLOUDFLARED_EXE%'"

  if errorlevel 1 (
    echo.
    echo Impossible de telecharger cloudflared.
    echo Verifie la connexion Internet puis relance ce fichier.
    echo.
    pause
    exit /b 1
  )
)

echo Demarrage du serveur partage...
start "Emotiometre serveur" cmd /k "cd /d \"%~dp0\" && \"%NODE_EXE%\" \"%~dp0server.js\""

timeout /t 3 >nul

echo.
echo Le lien public va apparaitre dans cette fenetre.
echo Garde cette fenetre ouverte pour que le lien continue de marcher partout.
echo Quand tu veux arreter le lien public, ferme juste cette fenetre.
echo.

"%CLOUDFLARED_EXE%" tunnel --url http://127.0.0.1:3000 --no-autoupdate
