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

# ── Fertig ist nur, was das Siegel traegt ─────────────────────────────
# Bis zum 26.09.2026 galt "Datei da = fertig". Das war falsch: Goslar
# fuehrt 24 Lageklassen, der Ernter kam in 900 Sekunden ueber die erste
# kaum hinaus, und der naechste Lauf uebersprang das Gebiet trotzdem
# nicht - er fing bei null an und starb an derselben Stelle. Zweimal
# dasselbe Ergebnis ist kein Zufall, sondern ein Verfahrensfehler.
#
# Jetzt schreibt der Ernter nach JEDER Lage und setzt `vollstaendig`
# erst, wenn alle drin sind. Hier wird genau danach gefragt - und ein
# Gebiet bekommt ueber mehrere RUNDEN so viele Anlaeufe, wie es braucht.
fertig() {
  [ -s "$ARB/ernte/$1.json" ] || return 1
  node -e 'const d=require(process.argv[1]);process.exit(d.vollstaendig||d.gesperrt?0:1)' \
       "$ARB/ernte/$1.json" 2>/dev/null
}

RUNDEN=${RUNDEN:-1}
echo "Gebiete: ${#WBS[@]}  ·  Grenze ${GRENZE}s  ·  Gitter ${PUNKTE}  ·  Runden ${RUNDEN}"
for runde in $(seq 1 "$RUNDEN"); do
  offen=0
  [ "$RUNDEN" -gt 1 ] && echo "══ Runde $runde von $RUNDEN"
  for wb in "${WBS[@]}"; do
    if fertig "$wb"; then
      [ "$runde" = 1 ] && echo "  schon da: $wb"
      continue
    fi
    offen=$((offen + 1))
    echo "── $wb  ($(date +%H:%M:%S))"
    timeout --signal=KILL "$GRENZE" \
      docker run --rm --name "ernter-$wb" \
        -v "$ARB":/arb -w /arb --shm-size=1g --memory=1600m "$BILD" \
        node ni-ernter.mjs --nur "$wb" --punkte "$PUNKTE" 2>&1 \
      | grep -E '^\s+(\+|Lage|Teilstand|GESPERRT|FEHLER)' || true
    rc=${PIPESTATUS[0]}
    if [ "$rc" = "137" ] || [ "$rc" = "124" ]; then
      echo "  ABGEBROCHEN nach ${GRENZE}s - Teilstand bleibt, naechste Runde macht weiter"
      docker rm -f "ernter-$wb" >/dev/null 2>&1 || true
    fi
  done
  if [ "$offen" = 0 ]; then echo "  nichts mehr offen"; break; fi
done
echo "FERTIG $(date +%H:%M:%S)"
ls "$ARB"/ernte/*.json 2>/dev/null | grep -vc FEHLER || true
