$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

$linkFile = Join-Path $PSScriptRoot "lien-public-emotiometre.txt"
$cloudflaredPath = Join-Path $env:TEMP "cloudflared-emotiometre.exe"
$cloudflaredUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
$localUrl = "http://127.0.0.1:3000"

function Get-NodePath {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue

  if ($nodeCommand) {
    return $nodeCommand.Source
  }

  $codexNode = "C:\Users\leand\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

  if (Test-Path -LiteralPath $codexNode) {
    return $codexNode
  }

  return $null
}

function Ensure-Cloudflared {
  if (Test-Path -LiteralPath $cloudflaredPath) {
    return $cloudflaredPath
  }

  Write-Host "Telechargement du tunnel public Cloudflare..."
  Invoke-WebRequest -Uri $cloudflaredUrl -OutFile $cloudflaredPath
  Unblock-File -LiteralPath $cloudflaredPath
  return $cloudflaredPath
}

function Start-LocalServer {
  param(
    [Parameter(Mandatory = $true)]
    [string] $NodePath
  )

  $serverPath = Join-Path $PSScriptRoot "server.js"
  $command = "Set-Location -LiteralPath '$PSScriptRoot'; & '$NodePath' '$serverPath'"

  Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $command `
    -WindowStyle Normal | Out-Null
}

function Wait-ForLocalServer {
  param(
    [int] $Attempts = 15
  )

  for ($index = 0; $index -lt $Attempts; $index += 1) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $localUrl -TimeoutSec 3

      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  return $false
}

try {
  $nodePath = Get-NodePath

  if (-not $nodePath) {
    Write-Host ""
    Write-Host "Node.js est introuvable sur cet ordinateur."
    Write-Host "Installe Node.js puis relance ce fichier."
    Write-Host ""
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
  }

  Ensure-Cloudflared | Out-Null

  if (Test-Path -LiteralPath $linkFile) {
    Remove-Item -LiteralPath $linkFile -Force
  }

  Write-Host ""

  if (Wait-ForLocalServer -Attempts 1) {
    Write-Host "Serveur local deja actif sur $localUrl"
  } else {
    Write-Host "Demarrage du serveur partage..."
    Start-LocalServer -NodePath $nodePath

    if (Wait-ForLocalServer) {
      Write-Host "Serveur local pret sur $localUrl"
    } else {
      Write-Host "Le serveur local ne repond pas encore, mais le tunnel va quand meme essayer."
    }
  }

  Write-Host ""
  Write-Host "Le lien public va apparaitre dans cette fenetre."
  Write-Host "Il sera aussi enregistre dans le fichier :"
  Write-Host $linkFile
  Write-Host ""
  Write-Host "Garde cette fenetre ouverte pour que le lien continue de marcher partout."
  Write-Host ""

  $publicUrl = $null

  $tunnelCommand = '"' + $cloudflaredPath + '" tunnel --url ' + $localUrl + ' --no-autoupdate 2>&1'

  & cmd.exe /d /c $tunnelCommand | ForEach-Object {
    $line = $_.ToString()
    Write-Host $line

    if (-not $publicUrl) {
      $match = [regex]::Match($line, "https://[a-z0-9-]+\.trycloudflare\.com")

      if ($match.Success) {
        $publicUrl = $match.Value
        Set-Content -LiteralPath $linkFile -Value $publicUrl -Encoding utf8

        try {
          Set-Clipboard -Value $publicUrl
        } catch {
        }

        Write-Host ""
        Write-Host "Lien public detecte : $publicUrl"
        Write-Host "Le lien a ete copie dans le fichier lien-public-emotiometre.txt"
        Write-Host "Tu peux maintenant l'envoyer et l'ouvrir sur les telephones."
        Write-Host ""

        try {
          Start-Process $publicUrl | Out-Null
        } catch {
        }
      }
    }
  }

  Write-Host ""

  if (-not $publicUrl) {
    Write-Host "Aucun lien public n'a ete detecte."
    Write-Host "Ferme cette fenetre puis relance le fichier."
  } else {
    Write-Host "Le tunnel public est termine."
  }
} catch {
  Write-Host ""
  Write-Host "Le lancement a rencontre un probleme."
  Write-Host $_.Exception.Message
}

Write-Host ""
Read-Host "Appuie sur Entree pour fermer"
