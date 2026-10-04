# tools/handbuch-pdf.ps1 — erzeugt das Telegram-Bot-Handbuch als PDF (v1797)
#
# Die Quelle ist docs/telegram-bot-handbuch.html. Aendert sich, was der Bot
# kann, wird DORT geaendert und dieses Skript erneut gefahren — das PDF ist
# eine Ableitung, keine zweite Fassung.
#
#   > Zwei Fassungen derselben Anleitung laufen auseinander, und die
#   > gedruckte ist die, die der Kunde in der Hand haelt.
#
# Gedruckt wird mit Chrome im Headless-Modus: kein zusaetzliches Paket, und
# es ist genau die Druckausgabe, die auch Strg+P im Browser erzeugt.

$ErrorActionPreference = 'Stop'
$wurzel = Split-Path -Parent $PSScriptRoot
$quelle = Join-Path $wurzel 'docs\telegram-bot-handbuch.html'
$ziel   = Join-Path $wurzel 'docs\DealPilot-Telegram-Bot-Handbuch.pdf'

if (-not (Test-Path $quelle)) { Write-Host "Quelle fehlt: $quelle" -ForegroundColor Red; exit 1 }

# Chrome suchen — der Pfad ist je nach Installation verschieden.
$kandidaten = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$chrome = $kandidaten | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) {
  Write-Host "Weder Chrome noch Edge gefunden. Notfalls die HTML im Browser oeffnen und mit Strg+P als PDF speichern." -ForegroundColor Yellow
  exit 1
}

if (Test-Path $ziel) { Remove-Item $ziel -Force }
$url = 'file:///' + ($quelle -replace '\\','/')
& $chrome --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$ziel" $url 2>$null
Start-Sleep -Seconds 3

# Ein Skript, das "fertig" meldet, ohne nachzusehen, ist kein Nachweis.
if (-not (Test-Path $ziel)) { Write-Host "FEHLGESCHLAGEN - kein PDF entstanden." -ForegroundColor Red; exit 1 }
$f = Get-Item $ziel
if ($f.Length -lt 20000) {
  Write-Host "VERDAECHTIG KLEIN ($($f.Length) Bytes) - bitte ansehen." -ForegroundColor Red
  exit 1
}
Write-Host "PDF: $($f.FullName)" -ForegroundColor Green
Write-Host "     $([math]::Round($f.Length/1KB,1)) KB"
