#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# ni-lageachse.sh (v1415) — welche Gebiete lassen sich VOLLSTÄNDIG ernten?
#
# Sieben der neun niedersächsischen Ausschüsse wählen über eine LAGEGRUPPE
# zwischen mehreren Sachwertkurven aus. In der URL greifen `Brw` und
# `Sach`, ein Parameter für die Lage ist nicht bekannt — sein Name steht in
# der Workbook-Definition und nicht in der URL.
#
# OHNE IHN WÄRE EIN SATZ HALB: das Gitter käme dann für die Vorgabe-Lage
# heraus, ohne dass im Satz stünde, für welche. Kein Verfahren rechnet
# halb, also werden zuerst die Gebiete geerntet, die ohne diesen Parameter
# vollständig sind.
#
# Dieses Skript sagt, welche das sind — aus dem KOPF des Dashboards, zwei
# Abrufe je Gebiet statt der vierzig eines Gitterlaufs.
#
# Aufruf:  ./ni-lageachse.sh [datei-mit-workbooknamen]
# ══════════════════════════════════════════════════════════════════════════
set -u
LISTE="${1:-$(dirname "$0")/ni-workbooks.txt}"
UA="Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

echo "workbook;gebiet;lageachse;erntbar"

while read -r WB; do
  case "$WB" in ''|\#*|*_navi*) continue ;; esac

  V=$(curl -s -m 25 -A "$UA" "https://public.tableau.com/profile/api/workbook/$WB" \
      | grep -o '"defaultViewName":"[^"]*"' | sed 's/.*:"//;s/"//')
  [ -z "$V" ] && { echo "$WB;;;KEIN_WORKBOOK"; continue; }

  curl -s -m 60 -A "$UA" -o "$TMP/k.pdf" \
    "https://public.tableau.com/views/$WB/$V.pdf?:showVizHome=no&:embed=true"
  T=$(pdftotext -layout "$TMP/k.pdf" - 2>/dev/null)

  NAME=$(echo "$T" | sed -n '2p' | sed 's/^ *//;s/ *$//;s/;/,/g')

  # Zwei Merkmale, und BEIDE müssen stimmen: ein Eingabefeld "Lage:" und
  # eine Sachwertkurve, die ausdrücklich "und Regionen" führt. Nur eines
  # von beiden käme auch bei einem blossen Hinweistext vor.
  L1=$(echo "$T" | grep -c '^Lage:\|Lage:' || true)
  L2=$(echo "$T" | grep -c 'Sachwerte und Regionen' || true)
  if [ "$L1" -gt 0 ] && [ "$L2" -gt 0 ]; then
    echo "$WB;${NAME:-?};ja;nein - Lage-Parameter fehlt"
  else
    echo "$WB;${NAME:-?};nein;JA"
  fi
  sleep 1
done < "$LISTE"
