#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# lauf.sh · Die Ernte gebietsweise, mit harter Zeitgrenze
#
# WARUM NICHT EIN LAUF FUER ALLE: am 26.09.2026 blieb der Ernter mitten
# in Goslar stehen - nach der ersten Lage kam kein Bild mehr, CPU bei
# zwei Prozent, anderthalb Stunden lang. Playwright wartet dann ohne
# Ende, und die uebrigen elf Gebiete warten mit.
#
# Jedes Gebiet bekommt deshalb einen EIGENEN Container und eine harte
# Grenze. Wer haengt, stirbt nach der Frist; der Rest laeuft weiter. Die
# Ernte ist wiederaufnehmbar - was als Datei liegt, wird nicht neu
# geholt -, also kostet ein Abbruch nur dieses eine Gebiet.
# ══════════════════════════════════════════════════════════════════════
set -u
ARB=/opt/ernter
GRENZE=${GRENZE:-900}          # Sekunden je Gebiet
PUNKTE=${PUNKTE:-4x5}
BILD=mcr.microsoft.com/playwright:v1.49.0-noble

mapfile -t WBS < <(node -e '
  const g=require("'"$ARB"'/gebiete.json");
  g.forEach(x=>console.log(x.workbook));' 2>/dev/null)

echo "Gebiete: ${#WBS[@]}  ·  Grenze ${GRENZE}s  ·  Gitter ${PUNKTE}"
for wb in "${WBS[@]}"; do
  if [ -s "$ARB/ernte/$wb.json" ]; then
    echo "  schon da: $wb"; continue
  fi
  echo "── $wb  ($(date +%H:%M:%S))"
  timeout --signal=KILL "$GRENZE" \
    docker run --rm --name "ernter-$wb" \
      -v "$ARB":/arb -w /arb --shm-size=1g --memory=1600m "$BILD" \
      node ni-ernter.mjs --nur "$wb" --punkte "$PUNKTE" 2>&1 \
    | grep -E '^\s+(\+|Lage|GESPERRT|FEHLER)' || true
  rc=${PIPESTATUS[0]}
  if [ "$rc" = "137" ] || [ "$rc" = "124" ]; then
    echo "  ABGEBROCHEN nach ${GRENZE}s - Gebiet uebersprungen"
    docker rm -f "ernter-$wb" >/dev/null 2>&1 || true
  fi
done
echo "FERTIG $(date +%H:%M:%S)"
ls "$ARB"/ernte/*.json 2>/dev/null | grep -vc FEHLER || true
