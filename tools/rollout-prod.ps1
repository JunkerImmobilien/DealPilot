# =====================================================================
#  rollout-prod.ps1   (v1)
#  Rollt den Staging-Stand auf die DealPilot-PRODUKTION.
#
#  Ablage : <Repo>\tools\rollout-prod.ps1
#  Aufruf : .\tools\rollout-prod.ps1
#
#  NUR ASCII in dieser Datei. Windows PowerShell 5.1 liest eine .ps1 ohne
#  BOM als ANSI, nicht als UTF-8 - ein Umlaut kaeme verstuemmelt an.
#  (Dieselbe Regel wie in deploy-staging.ps1.)
#
# ---------------------------------------------------------------------
#  WARUM ES DIESE DATEI GIBT
# ---------------------------------------------------------------------
#
#  Der Merge staging -> main ist die einzige Stelle im ganzen Ablauf, an
#  der Produktion angefasst wird. Sie gehoert zu Marcel, nicht zu einem
#  Automaten - genau deshalb steht in CLAUDE.md "Produktion wird nur nach
#  ausdruecklicher Freigabe angefasst".
#
#  Dieses Skript nimmt ihm die sechs Schritte danach ab, nicht die
#  Entscheidung davor. Es fragt einmal nach, und erst ein getipptes JA
#  startet den Rollout.
#
# ---------------------------------------------------------------------
#  WAS ES TUT, IN DIESER REIHENFOLGE
# ---------------------------------------------------------------------
#
#   1. Pruefen: lokaler Zweig sauber, staging aktuell
#   2. Beide Prod-Datenbanken sichern UND HINEINSEHEN
#      (eine Sicherung, die man nicht ansieht, ist keine - am 08.09.2026
#       lief ein pg_dump ins Nichts und erzeugte 20 Byte, die wie eine
#       Sicherung aussahen)
#   3. Gold-Audit auf Staging
#   4. Nachfrage - erst JA startet
#   5. Merge staging -> main, push
#   6. Auf Prod: git pull, beide Backends neu bauen
#   7. Nachmessen: Serverstand == lokal, Container laufen, HTTP 200
#
#  Jeder Schritt bricht bei Fehler ab. Nach Schritt 5 ist ein Abbruch
#  ueber "git checkout --" bzw. den Prod-Stand a21fe9c rueckholbar; die
#  Sicherungen aus Schritt 2 liegen in /root/backups/.
# =====================================================================

# ---------------------------------------------------------------------
#  -Freigabe   ueberspringt die Nachfrage in Schritt 4.
#
#  NUR benutzen, wenn die Freigabe schon ausgesprochen ist - etwa weil
#  Marcel den Rollout im Auftrag genannt hat. Die Pruefungen 1 bis 3
#  laufen trotzdem alle, und jede von ihnen bricht weiter ab: ohne
#  sauberen Zweig, ohne lesbare Sicherung und ohne gruenen Gold-Audit
#  geht nichts nach Produktion, mit oder ohne diesen Schalter.
# ---------------------------------------------------------------------
param([switch]$Freigabe)

$ErrorActionPreference = 'Continue'

$ZWEIG_QUELLE = 'staging'
$ZWEIG_ZIEL   = 'main'
$PROD_HOST    = 'root@157.90.117.167'
$PROD_PFAD    = '/opt/dealpilot'
$STAGING_HOST = 'root@116.203.214.11'
$PROD_URL     = 'https://app.dealpilot.immo/'

function Schritt($text) { Write-Host "`n-> $text" -ForegroundColor Cyan }
function Gut($text)     { Write-Host "   [ok] $text" -ForegroundColor Green }
function Schlecht($text){ Write-Host "   [FEHLER] $text" -ForegroundColor Red }
function Hinweis($text) { Write-Host "   [i]  $text" -ForegroundColor Yellow }

Write-Host "== rollout-prod (v1) ==" -ForegroundColor White

# ---- 1. Vorbedingungen -----------------------------------------------
Schritt "Vorbedingungen"

$jetzigerZweig = (git rev-parse --abbrev-ref HEAD).Trim()
if ($jetzigerZweig -ne $ZWEIG_QUELLE) {
  Schlecht "Du stehst auf '$jetzigerZweig', erwartet wird '$ZWEIG_QUELLE'."
  Write-Host "   Wechsle mit:  git checkout $ZWEIG_QUELLE"
  exit 1
}
Gut "lokaler Zweig: $jetzigerZweig"

$schmutzig = git status --porcelain --untracked-files=no
if ($schmutzig) {
  Schlecht "Arbeitsverzeichnis nicht sauber:"
  $schmutzig | Select-Object -First 5 | ForEach-Object { Write-Host "     $_" }
  exit 1
}
Gut "Arbeitsverzeichnis sauber"

git fetch origin --quiet
$lokalKopf = (git rev-parse $ZWEIG_QUELLE).Trim()
$fernKopf  = (git rev-parse "origin/$ZWEIG_QUELLE").Trim()
if ($lokalKopf -ne $fernKopf) {
  Schlecht "staging lokal ($($lokalKopf.Substring(0,7))) weicht von origin/staging ($($fernKopf.Substring(0,7))) ab."
  Write-Host "   Erst ausrollen:  .\tools\deploy-staging.ps1"
  exit 1
}
Gut "staging ist mit GitHub gleich: $($lokalKopf.Substring(0,7))"

$prodKopfVorher = (git rev-parse "origin/$ZWEIG_ZIEL").Trim()
$anzahl = (git rev-list --count "$ZWEIG_ZIEL..$ZWEIG_QUELLE").Trim()
$dateien = (git diff --name-only "$ZWEIG_ZIEL" "$ZWEIG_QUELLE" | Measure-Object).Count
Hinweis "$anzahl Commit(s), $dateien Datei(en) gehen nach Produktion"
Hinweis "Prod steht heute auf: $($prodKopfVorher.Substring(0,7))"

$migrationen = git diff --name-only "$ZWEIG_ZIEL" "$ZWEIG_QUELLE" | Select-String -Pattern 'migration|\.sql$'
if ($migrationen) {
  Hinweis "ACHTUNG - Datenbank-Aenderungen dabei:"
  $migrationen | ForEach-Object { Write-Host "     $_" }
} else {
  Gut "keine Migrationen, keine SQL-Aenderungen"
}

# ---- 2. Sicherungen ---------------------------------------------------
Schritt "Beide Prod-Datenbanken sichern"

$stempel = Get-Date -Format 'yyyyMMdd-HHmm'
$sicherBefehl = @"
mkdir -p /root/backups
docker exec dealpilot-postgres pg_dump -U dealpilot dealpilot_db 2>/dev/null | gzip > /root/backups/haupt-$stempel.sql.gz
docker exec dealpilot-mb-db pg_dump -U mb marktbericht | gzip > /root/backups/mb-$stempel.sql.gz
ls -lh /root/backups/haupt-$stempel.sql.gz /root/backups/mb-$stempel.sql.gz
echo '--- Kopf der Haupt-DB ---'
zcat /root/backups/haupt-$stempel.sql.gz | head -2
echo '--- Kopf der MB-DB ---'
zcat /root/backups/mb-$stempel.sql.gz | head -2
"@
$sicherung = ssh $PROD_HOST $sicherBefehl 2>&1
$sicherung | ForEach-Object { Write-Host "     $_" }

# Eine Sicherung, die man nicht ansieht, ist keine.
if (($sicherung -join "`n") -notmatch 'PostgreSQL database dump') {
  Schlecht "Die Sicherungen tragen keinen PostgreSQL-Kopf - Rollout abgebrochen."
  exit 1
}
Gut "beide Sicherungen gepruefet (Kopf gelesen, nicht nur gelistet)"

# ---- 3. Gold-Audit ----------------------------------------------------
Schritt "Gold-Audit auf Staging"
$audit = ssh $STAGING_HOST "cd /opt/dealpilot && python3 tools/gold-audit.py /opt/dealpilot/frontend 2>&1 | tail -3"
$audit | ForEach-Object { Write-Host "     $_" }
if (($audit -join "`n") -notmatch 'Kein neues Hartgold') {
  Schlecht "Gold-Audit nicht sauber - Rollout abgebrochen."
  exit 1
}
Gut "Gold-Audit auf der Basislinie"

# ---- 4. Nachfrage -----------------------------------------------------
Schritt "Freigabe"
Write-Host ""
Write-Host "   Das geht jetzt auf PRODUKTION: $PROD_URL" -ForegroundColor White
Write-Host "   $anzahl Commits, $dateien Dateien. Sicherungen liegen in /root/backups/." -ForegroundColor White
Write-Host ""
if ($Freigabe) {
  Hinweis "Freigabe liegt vor (-Freigabe) - keine Nachfrage."
  $antwort = 'JA'
} else {
  $antwort = Read-Host "   Rollout starten? Tippe JA"
}
if ($antwort -ne 'JA') {
  Hinweis "Abgebrochen - nichts veraendert."
  exit 0
}

# ---- 5. Merge und Push ------------------------------------------------
Schritt "Merge $ZWEIG_QUELLE -> $ZWEIG_ZIEL"
$datum = Get-Date -Format 'dd.MM.yyyy'
git checkout $ZWEIG_ZIEL --quiet
if ($LASTEXITCODE -ne 0) { Schlecht "checkout $ZWEIG_ZIEL fehlgeschlagen"; exit 1 }

git merge $ZWEIG_QUELLE --no-edit -m "Prod-Rollout $datum"
if ($LASTEXITCODE -ne 0) {
  Schlecht "Merge fehlgeschlagen - bitte von Hand aufloesen."
  git checkout $ZWEIG_QUELLE --quiet
  exit 1
}
$neuerKopf = (git rev-parse HEAD).Trim()
Gut "gemergt: $($neuerKopf.Substring(0,7))"

git push origin $ZWEIG_ZIEL
if ($LASTEXITCODE -ne 0) { Schlecht "push fehlgeschlagen"; git checkout $ZWEIG_QUELLE --quiet; exit 1 }
Gut "nach GitHub gepusht"

git checkout $ZWEIG_QUELLE --quiet
Gut "zurueck auf $ZWEIG_QUELLE"

# ---- 6. Auf Prod ziehen und bauen -------------------------------------
Schritt "Auf Produktion ziehen"
$zieh = ssh $PROD_HOST "cd $PROD_PFAD && git fetch origin --quiet && git checkout $ZWEIG_ZIEL --quiet && git pull --ff-only origin $ZWEIG_ZIEL 2>&1 | tail -5 && echo 'STAND:' && git rev-parse HEAD"
$zieh | ForEach-Object { Write-Host "     $_" }

$prodStand = ($zieh | Select-String -Pattern '^[0-9a-f]{40}$' | Select-Object -Last 1).ToString().Trim()
if ($prodStand -ne $neuerKopf) {
  Schlecht "Prod steht auf $prodStand, erwartet $neuerKopf"
  exit 1
}
Gut "Serverstand geprueft: $($prodStand.Substring(0,7)) == lokal $($neuerKopf.Substring(0,7))"

Schritt "Beide Backends neu bauen (dauert einige Minuten)"
$bau = ssh $PROD_HOST "cd $PROD_PFAD && docker compose -f docker-compose.prod.yml up -d --build backend mb-backend 2>&1 | tail -6"
$bau | ForEach-Object { Write-Host "     $_" }

# ---- 7. Nachmessen ----------------------------------------------------
Schritt "Nachmessen"
Start-Sleep -Seconds 8
$pruef = ssh $PROD_HOST "docker ps --format '{{.Names}} {{.Status}}' | head -6; echo '--- HTTP ---'; curl -s -o /dev/null -w '%{http_code}' $PROD_URL"
$pruef | ForEach-Object { Write-Host "     $_" }

if (($pruef -join "`n") -match '200\s*$') {
  Gut "Produktion antwortet mit 200"
} else {
  Schlecht "Produktion antwortet NICHT mit 200 - bitte nachsehen."
  Write-Host "   Zuruecksetzen:  ssh $PROD_HOST `"cd $PROD_PFAD && git reset --hard $prodKopfVorher && docker compose -f docker-compose.prod.yml up -d --build backend mb-backend`"" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "Fertig. Produktion steht auf $($neuerKopf.Substring(0,7))." -ForegroundColor Green
Write-Host "Im Browser Strg+Shift+R." -ForegroundColor Green
Write-Host ""
Write-Host "Falls doch etwas klemmt - zurueck auf den alten Stand:" -ForegroundColor Yellow
Write-Host "  ssh $PROD_HOST `"cd $PROD_PFAD && git reset --hard $prodKopfVorher && docker compose -f docker-compose.prod.yml up -d --build backend mb-backend`"" -ForegroundColor Yellow
