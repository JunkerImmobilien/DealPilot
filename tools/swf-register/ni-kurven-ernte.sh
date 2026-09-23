#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# ni-kurven-ernte.sh (v1584) — die Korrekturkurven UND das Normobjekt
#                              eines Gebiets bestimmen
#
# Ein Rezept besteht aus zwei Teilen, und beide beziehen sich auf denselben
# Punkt: dem GITTER (Faktor über Bodenrichtwert und vorläufigem Sachwert,
# abgetastet von ni-ernte.sh) und den KORREKTUREN für abweichende Merkmale.
#
# DAS NORMOBJEKT IST DIESER PUNKT — und es ist je Gebiet ein anderes.
# Gemessen am 23.09.2026: Braunschweig liegt bei Standardstufe 3,0, Gifhorn
# bei 2,5. Der Kopfkommentar in ni-kalkulator-abtasten.sh nennt feste Werte
# (120 m² / 40 Jahre / 2,5); das stimmt nicht. Ablesbar ist das Normobjekt
# aber ohne zu raten: an der Stelle, wo jede Kurve auf 1,00 steht.
# Ausführlich in NI-BEFUND-normobjekt.md.
#
# AUCH DIE KURVENTYPEN SIND JE GEBIET VERSCHIEDEN. Gemessen:
#   Braunschweig  Wohnflächen · Restnutzungsdauer · Standardstufen
#   Gifhorn       Wohnflächen · Standardstufen          (keine RND)
#   Emsland       modifiziertes Baujahr                 (nur diese eine)
#   Osnabrück     gar keine
# Deshalb werden sie aus den Diagramm-ÜBERSCHRIFTEN gelesen, nicht geraten.
#
# LIGATUREN: die Überschriften enthalten ﬀ ﬁ ﬂ ﬃ als einzelne Zeichen
# ("Wohnﬂächen"). Ein Muster mit [a-zäöüß] trifft sie nicht. Sie werden
# deshalb vor dem Lesen zurückübersetzt. (Anderswo im selben Dashboard
# fallen dieselben Ligaturen als LEERZEICHEN aus — siehe ni-kopfdaten.sh.
# Beide Fälle kommen vor, je nach eingebetteter Schrift.)
#
# Aufruf:  ./ni-kurven-ernte.sh <workbook> [<workbook> ...]
#          ./ni-kurven-ernte.sh --alle          (alle aus /tmp/ni-gitter)
# Ausgabe: /tmp/ni-kurven/<workbook>.json
# ══════════════════════════════════════════════════════════════════════════
set -u
AUS=/tmp/ni-kurven
mkdir -p "$AUS"
UA="Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)"
LESER="${LESER:-/tmp/ni-kurven-lesen.py}"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

entligatur() {
  sed 's/\xef\xac\x80/ff/g;s/\xef\xac\x81/fi/g;s/\xef\xac\x82/fl/g;s/\xef\xac\x83/ffi/g;s/\xef\xac\x84/ffl/g;s/\xef\xac\x85/ft/g'
}

# Welches x-Muster gehoert zu welcher Kurve? Die Achsenbeschriftungen
# unterscheiden sich in der Form, nicht nur im Inhalt.
muster_fuer() {
  case "$1" in
    *Wohnfläche*|*Wohnflächen*)      echo '^[0-9]{2,3}$' ;;
    *Restnutzungsdauer*)             echo '^(1[0-9]|[2-9][05])$' ;;
    *Standardstufe*|*Standardstufen*) echo '^[1-5],[0-9]$' ;;
    *Baujahr*)                       echo '^(19|20)[0-9]{2}$' ;;
    *Bruttogrundfläche*|*BGF*)       echo '^[1-5],[0-9]$' ;;
    *Lage*)                          echo '^[1-9]$' ;;
    *)                               echo '' ;;
  esac
}

WBS="$@"
if [ "${1:-}" = '--alle' ]; then
  WBS=$(ls /tmp/ni-gitter/*.csv 2>/dev/null | sed 's|.*/||;s|\.csv$||')
fi

for WB in $WBS; do
  ZIEL="$AUS/$WB.json"
  [ -s "$ZIEL" ] && { echo "$WB: liegt schon"; continue; }

  # Den View-Namen lesen, nicht annehmen - er heisst mal Dash, mal dash.
  V=$(curl -s -m 25 -A "$UA" "https://public.tableau.com/profile/api/workbook/$WB" \
      | grep -o '"defaultViewName":"[^"]*"' | sed 's/.*:"//;s/"//')
  if [ -z "$V" ]; then echo "$WB: KEIN VIEW"; sleep 4; continue; fi

  rm -f "$TMP/k.pdf" "$TMP/k.xml" "$TMP/k.txt"
  curl -s -m 60 -A "$UA" -o "$TMP/k.pdf" \
    "https://public.tableau.com/views/$WB/$V.pdf?:showVizHome=no&:embed=true"
  if [ ! -s "$TMP/k.pdf" ] || [ "$(head -c 4 "$TMP/k.pdf")" != '%PDF' ]; then
    echo "$WB: KEIN PDF"; sleep 5; continue
  fi
  pdftotext -layout      "$TMP/k.pdf" "$TMP/k.txt" 2>/dev/null
  pdftotext -bbox-layout "$TMP/k.pdf" "$TMP/k.xml" 2>/dev/null

  # Die Ueberschriften nennen die Kurven. Ohne Ueberschrift keine Kurve -
  # Osnabrueck-Stadt fuehrt zum Beispiel gar keine.
  TITEL=$(entligatur < "$TMP/k.txt" \
    | grep -aoE 'Umrechnungskoeffizienten für abweichende[a-zäöüßA-ZÄÖÜ/ ]{0,40}' \
    | sed 's/Umrechnungskoeffizienten für abweichende[s]* //;s/  */ /g;s/ $//' \
    | sort -u)

  if [ -z "$TITEL" ]; then
    printf '{"workbook":"%s","view":"%s","kurven":[],"hinweis":"keine Korrekturkurve in diesem Dashboard"}\n' \
      "$WB" "$V" > "$ZIEL"
    echo "$WB: keine Kurve"
    sleep 6; continue
  fi

  {
    printf '{\n  "workbook": "%s",\n  "view": "%s",\n  "kurven": [\n' "$WB" "$V"
    ERSTE=1
    while IFS= read -r T; do
      [ -z "$T" ] && continue
      M=$(muster_fuer "$T")
      if [ -z "$M" ]; then
        echo "  UNBEKANNTER KURVENTYP: $T" >&2
        continue
      fi
      PAARE=$(python3 "$LESER" "$TMP/k.xml" "$M" 2>/dev/null)
      [ -z "$PAARE" ] && continue
      # Das Normobjekt: der x-Wert, an dem der Koeffizient 1,00 ist.
      NORM=$(echo "$PAARE" | awk -F';' '$2==1 || $2=="1.0" || $2=="1.00" {print $1; exit}')

      # Liegt die 1,00 ZWISCHEN zwei Stuetzstellen, wird linear
      # interpoliert - aber in einem EIGENEN Feld. Das ist eine
      # Rechnung und keine Messung, und der Unterschied muss sichtbar
      # bleiben. Braunschweig: 140 -> 0,99 und 160 -> 1,01 ergibt 150,
      # und genau 150 steht auch im vorhandenen Rezept.
      # Bei Merkmalen mit Komma-Achse (Standardstufe, BGF-Verhaeltnis)
      # wird nicht interpoliert - dort sind die Stufen der Wert selbst.
      NORMI=''
      if [ -z "$NORM" ] && ! echo "$PAARE" | head -1 | grep -q ','; then
        NORMI=$(echo "$PAARE" | awk -F';' '
          { x[NR]=$1+0; y[NR]=$2+0; n=NR }
          END { for (i=1;i<n;i++)
                  if ((y[i]<1 && y[i+1]>1) || (y[i]>1 && y[i+1]<1)) {
                    printf "%g", x[i] + (1-y[i])*(x[i+1]-x[i])/(y[i+1]-y[i]); exit } }')
      fi
      [ $ERSTE -eq 0 ] && printf ',\n'
      ERSTE=0
      printf '    { "merkmal": "%s", "normobjekt": "%s"' "$T" "$NORM"
      [ -n "$NORMI" ] && printf ', "normobjekt_interpoliert": "%s"' "$NORMI"
      printf ', "stuetzstellen": {'
      echo "$PAARE" | awk -F';' 'BEGIN{c=0} {if(c++)printf ", "; printf "\"%s\": %s", $1, $2}'
      printf '} }'
    done <<< "$TITEL"
    printf '\n  ]\n}\n'
  } > "$ZIEL"

  ANZ=$(grep -o '"merkmal"' "$ZIEL" | wc -l)
  OHNE=$(grep -o '"normobjekt": ""' "$ZIEL" | wc -l)
  echo "$WB: $ANZ Kurve(n)$([ "$OHNE" -gt 0 ] && echo ", $OHNE ohne klares Normobjekt")"
  sleep 7
done
