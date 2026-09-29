# =====================================================================
#  nachziehen-prod.ps1   (v1)
#  Holt EINEN bereits auf `main` liegenden Stand nach Produktion.
#
#  Ablage : <Repo>\tools\nachziehen-prod.ps1
#  Aufruf : .\tools\nachziehen-prod.ps1
#
#  NUR ASCII in dieser Datei - Windows PowerShell 5.1 liest eine .ps1
#  ohne BOM als ANSI. Dieselbe Regel wie in deploy-staging.ps1.
#
# ---------------------------------------------------------------------
#  WARUM ES DIESE DATEI NEBEN rollout-prod.ps1 GIBT
# ---------------------------------------------------------------------
#
#  `rollout-prod.ps1` MERGED staging -> main. Das ist richtig fuer den
#  grossen Rollout und falsch fuer ein einzelnes Paket: zwischen main
#  und staging liegen Hunderte Commits samt Migrationen, die dabei ALLE
#  mitkaemen. Genau deshalb steht in den Notizen "fuer ein einzelnes
#  Paket ist Cherry-Pick der Weg".
#
#  Der Cherry-Pick passiert lokal:
#
#      git checkout main
#      git cherry-pick <commit> [<commit> ...]
#      git push origin main
#
#  Danach fehlt nur noch, was dieses Skript tut: Prod holt sich den
#  Stand und baut neu. Es MERGED nichts und entscheidet nichts.
#
# ---------------------------------------------------------------------
#  WAS ES TUT
# ---------------------------------------------------------------------
#   1. Pruefen: main lokal == origin/main, Arbeitsverzeichnis sauber
#   2. Zeigen, WAS sich auf Prod aendert - Dateien und Commits
#   3. Warnen, wenn Migrationen dabei sind (dann ist es kein Paket mehr)
#   4. Beide Prod-Datenbanken sichern UND HINEINSEHEN
#      (am 08.09.2026 erzeugte ein pg_dump 20 Byte, die wie eine
#       Sicherung aussahen - seitdem wird jede angesehen)
#   5. Nachfrage - erst ein getipptes JA startet
#   6. Auf Prod: git pull --ff-only, Backend nur wenn noetig
#   7. Nachmessen: Serverstand == origin/main, Container laufen
#
#  -Freigabe ueberspringt NUR die Nachfrage in Schritt 5. Alle
#  Pruefungen laufen weiter, und jede bricht weiter ab.
# =====================================================================
param([switch]$Freigabe)

$ErrorActionPreference = 'Continue'

$ZWEIG     = 'main'
$PROD_HOST = 'root@157.90.117.167'
$PROD_PFAD = '/opt/dealpilot'

function Schritt($t) { Write-Host "`n-> $t" -ForegroundColor Cyan }
function Gut($t)     { Write-Host "   [ok] $t" -ForegroundColor Green }
function Schlecht($t){ Write-Host "   [FEHLER] $t" -ForegroundColor Red }
function Hinweis($t) { Write-Host "   [i]  $t" -ForegroundColor Yellow }

Write-Host "== nachziehen-prod (v1) ==" -ForegroundColor White

# ---- 1. Vorbedingungen ----------------------------------------------
Schritt "Vorbedingungen"

$schmutzig = git status --porcelain --untracked-files=no
if ($schmutzig) {
  Schlecht "Arbeitsverzeichnis nicht sauber:"
  $schmutzig | Select-Object -First 5 | ForEach-Object { Write-Host "     $_" }
  exit 1
}
Gut "Arbeitsverzeichnis sauber"

git fetch origin --quiet
$lokal = (git rev-parse $ZWEIG).Trim()
$fern  = (git rev-parse "origin/$ZWEIG").Trim()
if ($lokal -ne $fern) {
  Schlecht "$ZWEIG lokal weicht von origin/$ZWEIG ab."
  Write-Host "   lokal:  $($lokal.Substring(0,7))"
  Write-Host "   GitHub: $($fern.Substring(0,7))"
  Write-Host "   Erst pushen:  git push origin $ZWEIG"
  exit 1
}
Gut "$ZWEIG ist mit GitHub gleich: $($lokal.Substring(0,7))"

# ---- 2. Was aendert sich dort? --------------------------------------
Schritt "Was auf Produktion ankommt"

$prodStand = ssh -o ConnectTimeout=20 $PROD_HOST "cd $PROD_PFAD && git rev-parse HEAD"
if (-not $prodStand) { Schlecht "Prod-Stand nicht lesbar - SSH pruefen."; exit 1 }
$prodStand = $prodStand.Trim()
Hinweis "Prod steht auf: $($prodStand.Substring(0,7))"

if ($prodStand -eq $lokal) {
  Gut "Prod ist bereits auf diesem Stand - nichts zu tun."
  exit 0
}

$dateien = git diff --name-only $prodStand $lokal
$anzahl  = ($dateien | Measure-Object).Count
Hinweis "$anzahl Datei(en):"
$dateien | Select-Object -First 20 | ForEach-Object { Write-Host "     $_" }

git log --oneline "$prodStand..$lokal" | ForEach-Object {
  Write-Host "     $_" -ForegroundColor DarkGray
}

# ---- 3. Migrationen? ------------------------------------------------
$migrationen = $dateien | Select-String -Pattern 'migration|\.sql$'
if ($migrationen) {
  Hinweis "ACHTUNG - Datenbank-Aenderungen dabei:"
  $migrationen | ForEach-Object { Write-Host "     $_" -ForegroundColor Yellow }
  Hinweis "Ein Paket mit Migrationen ist kein Paket mehr - lieber abbrechen."
}

$brauchtBackend  = $dateien | Select-String -Pattern '^backend/'
$brauchtFrontend = $dateien | Select-String -Pattern '^frontend/'
if ($brauchtBackend)  { Hinweis "Backend betroffen  -> Neubau noetig" }
if ($brauchtFrontend) { Hinweis "Frontend betroffen -> volume-mounted, kein Neubau" }

# ---- 4. Sicherung, und hineinsehen ----------------------------------
Schritt "Beide Datenbanken sichern"

$ts = Get-Date -Format 'yyyyMMdd-HHmm'
$zeilen = @()
$zeilen += 'set -e'
$zeilen += 'mkdir -p /root/backups'
$zeilen += "docker exec dealpilot-postgres pg_dump -U dealpilot dealpilot_db | gzip > /root/backups/prod-haupt-$ts.sql.gz"
$zeilen += "docker exec dealpilot-mb-db pg_dump -U mb marktbericht | gzip > /root/backups/prod-mb-$ts.sql.gz"
$zeilen += "ls -lh /root/backups/prod-haupt-$ts.sql.gz /root/backups/prod-mb-$ts.sql.gz"
# Ab hier KEIN set -e mehr: das Hineinsehen darf den Lauf nicht kippen.
#
# `zcat ... | head -2` kappt die Pipe - head geht nach zwei Zeilen, zcat
# bekommt SIGPIPE und endet mit Exit != 0. Unter `set -e` bricht der
# ganze Block genau dann ab, wenn die Sicherung GUT ist. Beim ersten
# Lauf ging es zufaellig durch (Puffergroesse), beim zweiten nicht.
#
# Dieselbe Falle steht in den Notizen fuer `grep -q` in einer Pipe.
# `sed -n '1,2p'` liest bis zum Ende und kappt deshalb nichts.
$zeilen += 'set +e'
$zeilen += "echo '--- Anfang Haupt-DB:'"
$zeilen += "zcat /root/backups/prod-haupt-$ts.sql.gz 2>/dev/null | sed -n '1,2p'"
$zeilen += "echo '--- Anfang MB-DB:'"
$zeilen += "zcat /root/backups/prod-mb-$ts.sql.gz 2>/dev/null | sed -n '1,2p'"
$zeilen += 'exit 0'
$sicherung = ($zeilen -join "`n")

$ausgabe = $sicherung | ssh -o ConnectTimeout=25 $PROD_HOST "bash -s"
$ausgabe | ForEach-Object { Write-Host "     $_" }

$gesehen = ($ausgabe | Select-String -Pattern 'PostgreSQL database dump' | Measure-Object).Count
if ($gesehen -lt 2) {
  Schlecht "Nicht beide Sicherungen zeigen 'PostgreSQL database dump'."
  Write-Host "   Eine Sicherung, die man nicht ansieht, ist keine. Abbruch."
  exit 1
}
Gut "beide Sicherungen geschrieben UND angesehen"

# ---- 5. Nachfrage ---------------------------------------------------
if (-not $Freigabe) {
  Schritt "Freigabe"
  Write-Host "   Prod $($prodStand.Substring(0,7))  ->  $($lokal.Substring(0,7))   ($anzahl Datei(en))"
  $antwort = Read-Host "   Tippe JA zum Ausrollen"
  if ($antwort -ne 'JA') { Hinweis "Abgebrochen - nichts veraendert."; exit 0 }
}

# ---- 6. Ausrollen ---------------------------------------------------
Schritt "Auf Produktion holen"

$roll = @()
$roll += 'set -e'
$roll += "cd $PROD_PFAD"
$roll += "git pull --ff-only origin $ZWEIG"
if ($brauchtBackend) {
  $roll += 'docker compose -f docker-compose.prod.yml up -d --build backend'
}
$roll += 'git rev-parse HEAD'
$befehle = ($roll -join "`n")

$erg = $befehle | ssh -o ConnectTimeout=30 $PROD_HOST "bash -s"
$erg | Select-Object -Last 12 | ForEach-Object { Write-Host "     $_" }

# ---- 7. Nachmessen --------------------------------------------------
Schritt "Nachmessen"

$neu = ssh -o ConnectTimeout=20 $PROD_HOST "cd $PROD_PFAD && git rev-parse HEAD"
if (-not $neu) { Schlecht "Stand nicht lesbar."; exit 1 }
$neu = $neu.Trim()
if ($neu -ne $lokal) {
  Schlecht "Serverstand $($neu.Substring(0,7)) != lokal $($lokal.Substring(0,7))"
  exit 1
}
Gut "Serverstand geprueft: $($neu.Substring(0,7)) == lokal"

ssh -o ConnectTimeout=20 $PROD_HOST "docker ps --format '{{.Names}}  {{.Status}}'" |
  Select-Object -First 6 | ForEach-Object { Write-Host "     $_" }

Write-Host "`nFertig." -ForegroundColor Green
