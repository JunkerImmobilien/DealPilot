# =====================================================================
#  deploy-staging.ps1   (v3)
#  Rollt den aktuellen Stand des Repos auf den DealPilot-Staging-Server.
#
#  Ablage : <Repo>\tools\deploy-staging.ps1
#  Aufruf : .\tools\deploy-staging.ps1
#
#  NUR ASCII in dieser Datei. Windows PowerShell 5.1 liest eine .ps1 ohne
#  BOM als ANSI, nicht als UTF-8 - ein Umlaut kaeme dann verstuemmelt an.
#
# ---------------------------------------------------------------------
#  WAS AN v2 KAPUTT WAR (gemessen am 01.09.2026, nicht vermutet)
# ---------------------------------------------------------------------
#
#  1) DAS REMOTE-SKRIPT BEKAM EIN BOM VORGESETZT -> "set -e" LIEF NIE.
#
#     v2 schickte den Here-String per Pipe an  ssh "bash -s".  Gemessen,
#     was auf dem Server ankam:
#
#         0000000  357 273 277   s   e   t       -   e  \n
#                  ^^^^^^^^^^^ = EF BB BF = UTF-8-BOM
#
#     bash las also <BOM>set -e und meldete
#     "bash: line 1: set: command not found". Das war KEIN Schoenheits-
#     fehler: damit war der Abbruch-bei-Fehler auf dem Server nie aktiv.
#     Waere  cd /opt/dealpilot  fehlgeschlagen, haette das Skript
#     froehlich im falschen Verzeichnis weitergemacht.
#
#     Weder $OutputEncoding noch [Console]::OutputEncoding auf
#     UTF8Encoding($false) zu setzen hat geholfen - beides gemessen, das
#     BOM blieb. Deshalb geht das Skript jetzt NICHT mehr durch die
#     PowerShell-Pipe: es wird mit .NET byteweise geschrieben (kein BOM,
#     nur LF), per scp uebertragen und dort ausgefuehrt. Gegenprobe auf
#     dem Server:  od -c  zeigt   s   e   t       -   e  \n
#
#     Zusaetzlich ist die erste Zeile des Remote-Skripts ein Kommentar.
#     Sollte je wieder ein BOM davorrutschen, verdirbt es nur den
#     Kommentar und nicht die Zeile "set -e".
#
#  2) DAS SKRIPT STARB NACH DEM PUSH - UND DER SERVER-PULL FIEL AUS.
#
#     v2 hatte $ErrorActionPreference = "Stop". In Windows PowerShell
#     5.1 verpackt der Konsolen-Host die stderr-Ausgabe eines nativen
#     Programms in einen NativeCommandError. Mit "Stop" wird daraus ein
#     ABBRECHENDER Fehler - und  git push  schreibt seinen Fortschritt
#     ("To https://github.com/...") IMMER auf stderr, auch im Erfolgsfall.
#
#     Beobachtet am 01.09.2026 beim Rollout von v1194:
#         git : To https://github.com/JunkerImmobilien/DealPilot.git
#         + CategoryInfo : NotSpecified: (...) [], RemoteException
#     Der Push war durch, das Skript ging mit Exit 1 raus, und Schritt 6
#     - der Pull auf dem Server - lief nie. Das Skript meldete also
#     FEHLER BEI ERFOLG, und der Server blieb still auf dem alten Stand.
#
#     Jetzt: "Continue" statt "Stop", und nach JEDEM nativen Aufruf wird
#     $LASTEXITCODE geprueft. Das ist die Groesse, die wirklich sagt, ob
#     ein Programm gescheitert ist - stderr sagt es nicht.
#
#  3) "FERTIG" WAR EINE BEHAUPTUNG, KEIN BEWEIS.
#
#     Weil (1) und (2) sich gegenseitig verdeckten, musste der Serverstand
#     bisher jedes Mal von Hand nachgeprueft werden. Schritt 7 tut das
#     jetzt selbst: er liest den HEAD des Servers und vergleicht ihn mit
#     dem lokalen. Stimmen sie nicht ueberein, ist es ein ABBRUCH - egal
#     wie freundlich alles davor ausgesehen hat.
# =====================================================================

# ABSICHTLICH NICHT "Stop" - siehe Punkt 2 im Kopf. Native Programme
# melden Fehler ueber ihren Rueckgabewert, nicht ueber stderr.
$ErrorActionPreference = "Continue"

$SERVER = "root@116.203.214.11"
$REMOTE = "/opt/dealpilot"
$BRANCH = "staging"
$FERN   = "/tmp/dp-deploy-staging.sh"

function Fail($msg) {
    Write-Host ""
    Write-Host "ABBRUCH: $msg" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Nach jedem nativen Aufruf. $LASTEXITCODE ist die Wahrheit, nicht stderr.
function PruefeExit($was) {
    if ($LASTEXITCODE -ne 0) { Fail "$was fehlgeschlagen (Exit $LASTEXITCODE)." }
}

Write-Host ""
Write-Host "== deploy-staging (v3) ==" -ForegroundColor Cyan

# --- 1) Stehe ich in einem Repo? -------------------------------------
git rev-parse --is-inside-work-tree | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Kein git-Repo. Bitte im Repo-Ordner ausfuehren." }

# --- 2) Richtiger Zweig? ---------------------------------------------
$branch = git rev-parse --abbrev-ref HEAD
PruefeExit "git rev-parse HEAD"
$branch = "$branch".Trim()
if ($branch -ne $BRANCH) {
    Fail "Lokaler Zweig ist '$branch', erwartet '$BRANCH'. Wechseln mit:  git checkout $BRANCH"
}
Write-Host "   [ok] lokaler Zweig: $branch"

# --- 3) Nichts Uncommittetes (verfolgte Dateien) ---------------------
#     Unbekannte Dateien werden bewusst ignoriert: auto-save.js und
#     patchesold/ liegen dauerhaft herum und duerfen nicht blockieren.
$dirty = git status --porcelain --untracked-files=no
PruefeExit "git status"
if ($dirty) {
    Write-Host ""
    Write-Host "ABBRUCH: es liegen ungespeicherte Aenderungen vor:" -ForegroundColor Red
    git status -s
    Write-Host ""
    Write-Host "         Erst committen, dann erneut ausrollen." -ForegroundColor Yellow
    exit 1
}
Write-Host "   [ok] Arbeitsverzeichnis sauber"

# --- 4) Was geht raus? ------------------------------------------------
git fetch origin $BRANCH --quiet
PruefeExit "git fetch"
$ahead = git rev-list --count "origin/$BRANCH..HEAD"
PruefeExit "git rev-list"
$ahead = "$ahead".Trim()
if ($ahead -eq "0") {
    Write-Host "   [i]  Nichts Neues zu pushen - rolle nur den Server nach." -ForegroundColor Yellow
} else {
    Write-Host "   [i]  $ahead Commit(s) gehen raus:"
    git --no-pager log --oneline "origin/$BRANCH..HEAD"
}

$lokal = git rev-parse --short HEAD
PruefeExit "git rev-parse --short HEAD"
$lokal = "$lokal".Trim()

# --- 5) Push ----------------------------------------------------------
Write-Host ""
Write-Host "-> push nach GitHub" -ForegroundColor Cyan
git push origin $BRANCH
PruefeExit "git push"

# --- 6) Pull auf dem Server ------------------------------------------
Write-Host ""
Write-Host "-> pull auf Staging" -ForegroundColor Cyan

# Erste Zeile ABSICHTLICH ein Kommentar - Begruendung: Punkt 1 im Kopf.
$remote = @'
# dp-deploy-staging - erzeugt von tools/deploy-staging.ps1, nicht von Hand aendern
set -e
cd /opt/dealpilot

B=$(git rev-parse --abbrev-ref HEAD)
echo "   Server-Zweig: $B"
if [ "$B" != "staging" ]; then
  echo "   ABBRUCH: Server steht auf $B, erwartet staging."
  exit 1
fi

# Nur VERFOLGTE Aenderungen zaehlen. auto-save.js und patchesold/ sind
# dauerhaft unbekannt und duerfen den Deploy nicht blockieren.
DIRTY=$(git status --porcelain --untracked-files=no | wc -l)
if [ "$DIRTY" -gt 0 ]; then
  echo "   ABBRUCH: Server hat lokale Aenderungen an verfolgten Dateien:"
  git status --porcelain --untracked-files=no
  exit 1
fi

git pull --ff-only
echo "   AUSGEROLLT: $(git rev-parse --short HEAD)"
'@

# NICHT durch die PowerShell-Pipe - siehe Punkt 1 im Kopf.
# WriteAllText mit UTF8Encoding($false) schreibt die Bytes ohne BOM.
# Das -replace raeumt CR weg, falls die Datei je auf CRLF umgestellt wird:
# bash stolpert sonst ueber ein "then\r".
$tmp  = Join-Path $env:TEMP "dp-deploy-staging.sh"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmp, ($remote -replace "`r", ""), $utf8)

scp -q $tmp "${SERVER}:$FERN"
PruefeExit "scp des Remote-Skripts"

# Out-Host, NICHT bloss "ssh ...": ein nackter Aufruf schreibt in den
# Erfolgs-Stream. Beim ersten Lauf von v3 hat Schritt 7 dadurch die
# Ausgabe DIESES Aufrufs mitgelesen und verglich
#   "Server-Zweig: staging Already up to date. AUSGEROLLT: 38d819d 38d819d"
# mit "38d819d" - ein Fehlalarm bei einem Rollout, der sauber durchlief.
# Alles, was nur angezeigt werden soll, geht deshalb direkt an den Host.
ssh $SERVER "bash $FERN" | Out-Host
PruefeExit "Ausrollen auf dem Server"

# --- 7) BEWEIS statt Behauptung --------------------------------------
#     Punkt 3 im Kopf: bis v2 musste der Serverstand von Hand nachgeprueft
#     werden. Das macht das Skript jetzt selbst.
#
#     Select-Object -Last 1: der Rueckgabewert ist die LETZTE Zeile. Ein
#     Login-Banner, eine motd oder eine Warnung des ssh-Clients wuerden
#     sonst mit im Vergleich landen.
$fern = ssh $SERVER "cd $REMOTE && git rev-parse --short HEAD" | Select-Object -Last 1
PruefeExit "Serverstand lesen"
$fern = "$fern".Trim()
if ($fern -ne $lokal) {
    Fail "Serverstand ist '$fern', lokal steht '$lokal'. Der Server hat NICHT uebernommen."
}
Write-Host "   [ok] Serverstand geprueft: $fern == lokal $lokal" -ForegroundColor Green

Write-Host ""
Write-Host "Fertig. Im Browser Strg+Shift+R." -ForegroundColor Green
Write-Host ""
