#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# ni-steckbrief.sh (v1417) — was ein Gitterlauf über ein Gebiet wissen muss
#
# Vor jedem Abtasten stehen dieselben vier Fragen, und alle vier beantwortet
# der Kopf des Dashboards:
#
#   1. Welche Korrekturkurven führt das Gebiet?   (bestimmt die Rezeptform)
#   2. Wo liegt das Normobjekt?                   (der Prüfmassstab)
#   3. Welche Spannen deckt die Stichprobe ab?    (die Gittergrenzen)
#   4. Greifen `Brw` und `Sach`?                  (sonst geht es gar nicht)
#
# DIE DRITTE FRAGE IST DIE WICHTIGE. "Wo die Quelle endet, endet die
# Rechnung" ist keine Floskel: der Kalkulator gibt auch weit ausserhalb
# seiner Stichprobe noch Zahlen aus, und die sehen genauso aus wie die
# belegten. Bei der Stadt Braunschweig beginnt der Bodenrichtwert erst bei
# 210 EUR/qm — ein Gitter ab 30 haette dort sechs Zeilen erfunden.
#
# Kostet zwei Abrufe je Gebiet. Ein Gitterlauf kostet siebzig.
#
# Aufruf:  ./ni-steckbrief.sh <workbook> [<workbook> ...]
# ══════════════════════════════════════════════════════════════════════════
set -u
UA="Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)"
LESER="${LESER:-$(dirname "$0")/ni-wert-lesen.py}"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

for WB in "$@"; do
  V=$(curl -s -m 25 -A "$UA" "https://public.tableau.com/profile/api/workbook/$WB" \
      | grep -o '"defaultViewName":"[^"]*"' | sed 's/.*:"//;s/"//')
  [ -z "$V" ] && { echo "── $WB : KEIN WORKBOOK"; continue; }

  curl -s -m 60 -A "$UA" -o "$TMP/k.pdf" \
    "https://public.tableau.com/views/$WB/$V.pdf?:showVizHome=no&:embed=true"
  T=$(pdftotext -layout "$TMP/k.pdf" - 2>/dev/null)
  pdftotext -bbox-layout "$TMP/k.pdf" "$TMP/k.xml" 2>/dev/null

  echo "════════════════════════════════════════════════════════════════"
  echo "── $WB   (view=$V)"
  echo "   Gebiet    : $(echo "$T" | sed -n '2p' | sed 's/^ *//;s/ *$//')"
  echo "   Stichprobe: $(echo "$T" | grep -o 'chprobe: *[0-9][0-9.,]*' \
                          | grep -oE '[0-9][0-9.,]*' | head -1) Kauffaelle"
  echo "   Normobjekt: $(python3 "$LESER" "$TMP/k.xml" 2>/dev/null)  (Faktor;Streuung)"
  echo "   Kurven    :"
  echo "$T" | grep -o 'Umrechnungskoe[^ ]* für abweichende[^|]\{0,55\}' \
            | sed 's/Umrechnungskoe[^ ]* für abweichende */      - /' | sort -u
  echo "   Spannen der Stichprobe (das sind die Gittergrenzen):"
  echo "$T" | grep -E 'Sachwert \[|Bodenrichtwert \[|Wohnﬂäche \[|Wohnfläche \[|Standardstufe|Restnutzungsdauer|Bru' \
            | grep -E '[0-9]' | sed 's/^ */      /' | cut -c1-108
  # Greifen die Parameter? Zwei Proben genuegen: aendert sich der Faktor?
  pr() { curl -s -m 60 -A "$UA" -o "$TMP/p.pdf" \
           "https://public.tableau.com/views/$WB/$V.pdf?:showVizHome=no&:embed=true&$1"
         pdftotext -bbox-layout "$TMP/p.pdf" "$TMP/p.xml" 2>/dev/null
         python3 "$LESER" "$TMP/p.xml" 2>/dev/null | cut -d';' -f1; }
  A=$(pr "Sach=250000"); B=$(pr "Sach=600000")
  if [ -n "$A" ] && [ -n "$B" ] && [ "$A" != "$B" ]; then
    echo "   Parameter : Sach greift ($A -> $B)"
  else
    echo "   Parameter : >>> Sach greift NICHT ($A / $B) — nicht abtastbar <<<"
  fi
  sleep 1
done
