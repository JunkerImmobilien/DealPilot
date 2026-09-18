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

  # ═══ GESUCHT IST DAS EINGABEFELD, NICHT DER GRAFIKTITEL ════════════════
  # Erster Versuch war: Feld "Lage:" UND Kurve "Sachwerte und Regionen".
  # Beides zu eng, und der Fehler ging in BEIDE Richtungen:
  #
  #   Peine      "Lage im Kreis [Umrechnungskoef.]: Gemeinde Edemissen"
  #   Salzgitter "Lage im Landkreis: Bruchmachtersen, Engelns.."
  #     -> kein "Lage:" mit direktem Doppelpunkt, keine Kurve "und
  #        Regionen" — beide galten als erntbar und sind es NICHT.
  #        Der Salzgitter-Satz war deshalb schon gebaut und ausgerollt,
  #        bevor es auffiel: er galt nur fuer eine unbenannte Teillage.
  #
  #   Braunschweig / Wolfsburg  Grafiktitel "in Abhaengigkeit von Lage und
  #     Sachwert", aber KEIN Eingabefeld — "Lage" meint dort den
  #     Bodenrichtwert. Wer auf den Titel filtert, sperrt sie zu Unrecht.
  #
  # Das eine verlaessliche Merkmal ist eine ZEILE AM ANFANG (die
  # Eingabemaske), die mit "Lage" beginnt. Grafiktitel stehen weiter
  # unten und beginnen mit "Sachwer aktoren".
  L1=$(echo "$T" | sed -n '1,26p' | grep -c '^Lage' || true)
  if [ "$L1" -gt 0 ]; then
    echo "$WB;${NAME:-?};ja;nein - Lage-Parameter fehlt"
  else
    echo "$WB;${NAME:-?};nein;JA"
  fi
  sleep 1
done < "$LISTE"
