#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# ni-ernte2.sh - Gitter abtasten, aber NUR INNERHALB DER STICHPROBE
#
# Der erste Anlauf (ni-ernte.sh) tastete mit dem eingebauten Standard-
# gitter ab: Bodenrichtwert 40/130/200/280. Gemessen an der Stadt
# Braunschweig war das falsch - dort beginnt die Stichprobe laut
# Dashboard erst bei 210 EUR/qm und endet bei 520. Drei von vier Zeilen
# waeren damit erfunden gewesen, und sie haetten genauso ausgesehen wie
# die belegten.
#
#   "Wo die Quelle endet, endet die Rechnung."
#
# Deshalb in zwei Schritten: erst die Spannen AUS DEM DASHBOARD lesen,
# dann das Gitter darauf legen. Ein Gebiet ohne lesbare Spannen wird
# NICHT abgetastet - lieber kein Satz als ein erfundener.
#
# Wiederaufnehmbar: was als Datei liegt, wird uebersprungen.
# ══════════════════════════════════════════════════════════════════════
set -u
AUS=/tmp/ni-gitter
mkdir -p "$AUS"
PROT="$AUS/_protokoll.txt"
UA="Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

teilmarkt() {
  case "$1" in
    *_sw_efh_*|*_sw_efhrh_*) echo einundzweifamilienhaeuser ;;
    *_sw_rh_*)               echo reihenhausdoppelhaushaelfte ;;
    *_sw_hof_*)              echo hoefe ;;
    *)                       echo '' ;;
  esac
}

# Stuetzstellen zwischen min und max, gerundet, aber NIE ausserhalb.
stufen() {
  python3 -c "
import sys
lo, hi, n, r = float(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
if hi <= lo: sys.exit(1)
out = []
for i in range(n):
    v = lo + (hi - lo) * i / (n - 1)
    v = round(v / r) * r
    v = max(lo, min(hi, v))          # niemals aus der Stichprobe heraus
    v = int(v // r * r) if v > lo else int(-(-lo // r) * r)
    if v < lo: v = int(-(-lo // r) * r)
    if v > hi: v = int(hi // r * r)
    if v not in out and lo <= v <= hi: out.append(v)
print(' '.join(str(v) for v in out))
" "$1" "$2" "$3" "$4" 2>/dev/null
}

gesamt=0; neu=0; schon=0; ohne=0; leer=0
while IFS=';' read -r wb rohname ags amt befund; do
  [ "$wb" = 'workbook' ] && continue
  [ -z "${ags:-}" ] && continue
  tm=$(teilmarkt "$wb")
  [ -z "$tm" ] && { echo "KEIN TEILMARKT: $wb" >> "$PROT"; continue; }
  gesamt=$((gesamt+1))
  ziel="$AUS/$wb.csv"
  [ -s "$ziel" ] && { schon=$((schon+1)); continue; }

  # ── Schritt 1: die Spannen aus dem Dashboard ────────────────────────
  curl -s -m 60 -A "$UA" -o "$TMP/k.pdf" \
    "https://public.tableau.com/views/$wb/dash.pdf?:showVizHome=no&:embed=true"
  pdftotext -layout "$TMP/k.pdf" "$TMP/k.txt" 2>/dev/null
  BZ=$(grep -a 'Bodenrichtwert \[' "$TMP/k.txt" 2>/dev/null \
       | grep -aoE '[0-9]+ +[0-9]+ +[0-9]+' | head -1)
  SZ=$(grep -aiE 'sachwert \[' "$TMP/k.txt" 2>/dev/null \
       | grep -aoE '[0-9]{5,} +[0-9]{5,} +[0-9]{5,}' | head -1)
  if [ -z "$BZ" ] || [ -z "$SZ" ]; then
    ohne=$((ohne+1))
    echo "$(date +%H:%M:%S) OHNE-SPANNE $wb ($ags $amt) - nicht abgetastet" >> "$PROT"
    sleep 4; continue
  fi
  bmin=$(echo "$BZ" | awk '{print $1}'); bmax=$(echo "$BZ" | awk '{print $2}')
  smin=$(echo "$SZ" | awk '{print $1}'); smax=$(echo "$SZ" | awk '{print $2}')
  BRWS=$(stufen "$bmin" "$bmax" 6 10)
  SACHS=$(stufen "$smin" "$smax" 9 10000)
  if [ -z "$BRWS" ] || [ -z "$SACHS" ]; then
    ohne=$((ohne+1))
    echo "$(date +%H:%M:%S) SPANNE-UNBRAUCHBAR $wb ($bmin-$bmax / $smin-$smax)" >> "$PROT"
    sleep 4; continue
  fi

  # ── Schritt 2: abtasten, nur innerhalb ──────────────────────────────
  timeout 260 bash /tmp/ni-kalkulator-abtasten.sh "$tm" "$wb" "$BRWS" "$SACHS" \
    > "$TMP/roh.csv" 2>/dev/null
  n=$(grep -cE '^[0-9]+;[0-9]+;' "$TMP/roh.csv" 2>/dev/null || true)
  n=${n:-0}
  if [ "$n" -gt 0 ]; then
    grep -E '^[0-9]+;[0-9]+;' "$TMP/roh.csv" > "$ziel"
    echo "# spanne_brw=$bmin-$bmax spanne_sachwert=$smin-$smax" > "$ziel.meta"
    echo "# gitter_brw=$BRWS" >> "$ziel.meta"
    echo "# gitter_sachwert=$SACHS" >> "$ziel.meta"
    neu=$((neu+1))
    echo "$(date +%H:%M:%S) OK $wb ($ags $amt) $n Zellen, BRW $bmin-$bmax, SW $smin-$smax" >> "$PROT"
  else
    leer=$((leer+1))
    echo "$(date +%H:%M:%S) LEER $wb ($ags $amt)" >> "$PROT"
  fi
  sleep 8
done < /tmp/ni-ags.csv

echo "FERTIG: $gesamt mit AGS | $neu neu | $schon lagen | $ohne ohne Spanne | $leer leer" >> "$PROT"
