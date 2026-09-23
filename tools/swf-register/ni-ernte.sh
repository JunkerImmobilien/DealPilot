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
  # ZUERST WEGRAEUMEN. Gemessen am 23.09.2026: Wolfsburg und die Region
  # Hannover meldeten identische Spannen (BRW 145-275, SW 156254-817047)
  # - unmoeglich bei zwei so verschiedenen Gebieten. Ursache war, dass
  # ein fehlgeschlagener Abruf die Datei des VORGAENGERS liegen liess
  # und sie erneut gelesen wurde. Ein Zustand aus dem vorigen Durchlauf
  # verfaelscht die naechste Messung, und man sieht es dem Ergebnis
  # nicht an.
  rm -f "$TMP/k.pdf" "$TMP/k.txt"
  # DEN VIEW-NAMEN LESEN, NICHT ANNEHMEN. ni-kopfdaten.sh sagt es
  # ausdruecklich: "der View heisst je Region mal `Dash`, mal `dash`,
  # das ist nicht ratbar und wird deshalb GELESEN." Mit festem
  # "dash.pdf" kamen am 23.09.2026 vier Gebiete der Region Hameln-
  # Hannover hintereinander ohne PDF zurueck.
  V=$(curl -s -m 25 -A "$UA" "https://public.tableau.com/profile/api/workbook/$wb" \
      | grep -o '"defaultViewName":"[^"]*"' | sed 's/.*:"//;s/"//')
  if [ -z "$V" ]; then
    ohne=$((ohne+1))
    echo "$(date +%H:%M:%S) KEIN-VIEW $wb ($ags $amt)" >> "$PROT"
    sleep 6; continue
  fi
  curl -s -m 60 -A "$UA" -o "$TMP/k.pdf" \
    "https://public.tableau.com/views/$wb/$V.pdf?:showVizHome=no&:embed=true"
  # Und nachsehen, ob wirklich ein PDF kam - nicht nur, ob curl
  # zufrieden war. Eine Fehlerseite ist auch eine Antwort.
  if [ ! -s "$TMP/k.pdf" ] || [ "$(head -c 4 "$TMP/k.pdf")" != '%PDF' ]; then
    ohne=$((ohne+1))
    echo "$(date +%H:%M:%S) KEIN-PDF $wb ($ags $amt)" >> "$PROT"
    sleep 6; continue
  fi
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

  # Gegenprobe: zwei Gebiete mit exakt derselben Stichprobenspanne gibt
  # es nicht. Wenn doch, ist eine alte Messung durchgerutscht - dann
  # lieber ueberspringen als einen Satz bauen, den niemand nachprueft.
  SIG="$bmin-$bmax/$smin-$smax"
  if [ "$SIG" = "${LETZTE_SIG:-}" ]; then
    ohne=$((ohne+1))
    echo "$(date +%H:%M:%S) SPANNE-WIE-VORGAENGER $wb ($ags $amt) $SIG - uebersprungen" >> "$PROT"
    LETZTE_SIG=''
    sleep 6; continue
  fi
  LETZTE_SIG="$SIG"
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
  # NUR ZEILEN MIT ECHTEN ZAHLEN ZAEHLEN.
  # Gemessen am 23.09.2026: fuenf Gebiete lieferten 54 Zeilen der Form
  # "20;60000;LEER;LEER" - das Muster ^[0-9]+;[0-9]+; passte, also hat
  # das Protokoll brav "OK, 54 Zellen" gemeldet. Eine Datei ohne einen
  # einzigen Wert galt damit als geerntet.
  # Ein Pruefer, der gruen wird, ist schlimmer als keiner: niemand
  # sieht mehr nach.
  # (Die betroffenen Gebiete sind die Regionen lg und nom. Ihre
  # Dashboards fuehren eine zusaetzliche Lage-Achse - "Entfernung zum
  # Marktplatz von Lueneburg" - die der Standardaufruf nicht setzt.
  # Ohne sie rechnet der Kalkulator nicht. Das ist ein eigener Bau.)
  n=$(grep -cE '^[0-9]+;[0-9]+;[0-9]' "$TMP/roh.csv" 2>/dev/null || true)
  n=${n:-0}
  leerz=$(grep -c 'LEER' "$TMP/roh.csv" 2>/dev/null || true)
  leerz=${leerz:-0}
  if [ "$n" -eq 0 ] && [ "$leerz" -gt 0 ]; then
    leer=$((leer+1))
    echo "$(date +%H:%M:%S) NUR-LEER $wb ($ags $amt) $leerz Zeilen ohne Wert - Lage-Achse?" >> "$PROT"
    sleep 8; continue
  fi
  if [ "$n" -gt 0 ]; then
    grep -E '^[0-9]+;[0-9]+;[0-9]' "$TMP/roh.csv" > "$ziel"
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
