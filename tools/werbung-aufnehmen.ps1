# ══════════════════════════════════════════════════════════════════════
#  werbung-aufnehmen.ps1   (v1952)
#
#  Nimmt ein animiertes Werbemittel aus design/Vorschlaege als echte
#  Einzelbilder auf - in voller Zielaufloesung, ohne Fremdpakete.
#
#  WARUM SO UMSTAENDLICH: auf diesem Rechner gibt es kein ffmpeg und kein
#  Playwright/Puppeteer. Chrome ist da und kann headless fotografieren.
#  Mehr braucht es nicht, solange die Vorlage ihre Animation anhalten laesst.
#
#  AUFRUF:
#    .\tools\werbung-aufnehmen.ps1 -Vorlage "design\Vorschlaege\werbung-01-riss-reel.html"
#    .\tools\werbung-aufnehmen.ps1 -Vorlage "..." -Breite 1080 -Hoehe 1920 -Takt 7000 -Bilder 70
#
#  ERGEBNIS: <Ausgabe>\bilder\f###.png  und  <Ausgabe>\folge\  (entdoppelt,
#  mit folge.json fuer den GIF-Bau). Das MP4 braucht ffmpeg:
#    ffmpeg -framerate 10 -i bilder\f%03d.png -c:v libx264 -pix_fmt yuv420p -vf "scale=1080:1920" werbung.mp4
#
#  ── ZWEI FALLEN, BEIDE TEUER GELERNT ─────────────────────────────────
#  1. Chrome schreibt seine ERFOLGSmeldung ("... bytes written to file ...")
#     auf STDERR. PowerShell 5.1 macht daraus einen ErrorRecord; mit
#     $ErrorActionPreference='Stop' bricht der Lauf nach dem ERSTEN Bild ab,
#     obwohl alles geklappt hat. Deshalb 'Continue' und: die Erfolgskontrolle
#     ist die DATEI, nicht der Rueckgabewert.
#  2. Ohne --user-data-dir entsteht gar kein Screenshot, lautlos.
# ══════════════════════════════════════════════════════════════════════
param(
  [Parameter(Mandatory = $true)][string]$Vorlage,
  [string]$Ausgabe = "$env:TEMP\dp-werbung",
  [int]$Breite = 1080,
  [int]$Hoehe = 1920,
  [int]$Takt = 7000,
  [int]$Bilder = 70,
  [string]$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
)
$ErrorActionPreference = 'Continue'

if (-not (Test-Path $Vorlage)) { Write-Host "Vorlage fehlt: $Vorlage"; exit 1 }
if (-not (Test-Path $Chrome))  { Write-Host "Chrome fehlt: $Chrome"; exit 1 }

New-Item -ItemType Directory -Path $Ausgabe -Force | Out-Null
$bilderDir = Join-Path $Ausgabe 'bilder'
$folgeDir  = Join-Path $Ausgabe 'folge'
New-Item -ItemType Directory -Path $bilderDir -Force | Out-Null

# ── 1 · Aufnahmekopie: Animationen anhalten, Buehne unskaliert ──────────
$kopie = Join-Path $Ausgabe 'aufnahme.html'
$src = Get-Content $Vorlage -Raw -Encoding UTF8
if ($src -notmatch '</body>') { Write-Host "kein </body> in der Vorlage"; exit 1 }

$einschub = @'
<script>
(function () {
  var p = new URLSearchParams(location.search);
  var t = parseFloat(p.get('t') || '0');
  function stell() {
    var b = document.querySelector('.buehne') || document.querySelector('[data-buehne]');
    if (b) {
      var r = b.parentElement;
      if (r) { r.style.transform = 'none'; r.style.margin = '0'; r.style.boxShadow = 'none'; }
      b.style.transform = 'none';
      document.documentElement.style.cssText = 'margin:0;padding:0;background:#050505;overflow:hidden';
      document.body.style.cssText = 'margin:0;padding:0;background:#050505;overflow:hidden;display:block';
      [].slice.call(document.body.children).forEach(function (c) { if (c !== r && c !== b) c.style.display = 'none'; });
    }
    var an = document.getAnimations();
    an.forEach(function (a) { try { a.pause(); a.currentTime = t; } catch (e) {} });
    document.title = 'bereit t=' + t + ' an=' + an.length;
  }
  if (document.readyState === 'complete') stell(); else window.addEventListener('load', stell);
})();
</script>
'@
Set-Content -Path $kopie -Value ($src -replace '</body>', ($einschub + "`n</body>")) -Encoding UTF8
Write-Host "Aufnahmekopie: $kopie"

# ── 2 · Einzelbilder ────────────────────────────────────────────────────
$basis = "file:///" + ((Resolve-Path $kopie).Path -replace '\\','/')
$profil = Join-Path $Ausgabe 'chromeprofil'
for ($i = 0; $i -lt $Bilder; $i++) {
  $t = [int]([math]::Round($i * $Takt / $Bilder))
  $datei = Join-Path $bilderDir ("f{0:d3}.png" -f $i)
  if ((Test-Path $datei) -and (Get-Item $datei).Length -gt 20000) { continue }
  try {
    & $Chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars `
      --force-device-scale-factor=1 --window-size=$Breite,$Hoehe `
      --screenshot="$datei" --virtual-time-budget=3000 `
      --user-data-dir="$profil" "$basis`?t=$t" | Out-Null
  } catch { }
}
$alle = @(Get-ChildItem "$bilderDir\f*.png" -ErrorAction SilentlyContinue)
Write-Host ("Einzelbilder: {0} von {1}" -f $alle.Count, $Bilder)
if ($alle.Count -lt $Bilder) { Write-Host "ACHTUNG: unvollstaendig - das Ergebnis ist nichts wert." }

# ── 3 · Entdoppeln: gleiche Bilder zu einem mit Haltezeit ───────────────
# Die Vorlagen halten lange still (gemessen: 70 Bilder, 21 verschiedene).
if (Test-Path $folgeDir) { Remove-Item "$folgeDir\*" -Force -ErrorAction SilentlyContinue }
else { New-Item -ItemType Directory -Path $folgeDir -Force | Out-Null }
$msJeBild = [int]($Takt / $Bilder)
$h = $alle | Sort-Object Name | ForEach-Object {
  [PSCustomObject]@{ Pfad = $_.FullName; Hash = (Get-FileHash $_.FullName -Algorithm MD5).Hash }
}
$folge = @(); $start = 0
for ($i = 1; $i -le $h.Count; $i++) {
  if ($i -eq $h.Count -or $h[$i].Hash -ne $h[$start].Hash) {
    $folge += [PSCustomObject]@{ Quelle = $h[$start].Pfad; Dauer = ($i - $start) * $msJeBild }
    $start = $i
  }
}
$liste = @()
for ($i = 0; $i -lt $folge.Count; $i++) {
  $name = "b{0:d2}.png" -f $i
  Copy-Item $folge[$i].Quelle (Join-Path $folgeDir $name) -Force
  $liste += [PSCustomObject]@{ datei = $name; dauer = $folge[$i].Dauer }
}
# OHNE BOM - JSON.parse im Browser faellt ueber einen BOM.
[System.IO.File]::WriteAllText((Join-Path $folgeDir 'folge.json'),
  ($liste | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding $false))

$summe = ($liste | Measure-Object -Property dauer -Sum).Sum
Write-Host ("Folge: {0} Bilder, {1} ms gesamt" -f $liste.Count, $summe)
if ($summe -ne $Takt) { Write-Host "WARNUNG: Gesamtdauer $summe ms statt $Takt ms - die Schleife springt." }
Write-Host ""
Write-Host "Weiter: GIF ueber tools/werbung-gif.html (Folge daneben legen), oder MP4 mit ffmpeg:"
Write-Host "  ffmpeg -framerate $([int]($Bilder/($Takt/1000))) -i `"$bilderDir\f%03d.png`" -c:v libx264 -pix_fmt yuv420p werbung.mp4"
