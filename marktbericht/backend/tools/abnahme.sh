#!/usr/bin/env bash
# abnahme.sh — die Abnahme des Registers, per Befehl, AM LAUFENDEN SERVER.
#
# Fragt den Prozess, der das Register wirklich haelt. Ein frisch gestarteter
# Node liest nur die Saatdatei und meldet Zahlen, die es im Betrieb nicht
# gibt — am 14.08. waren das 2150 gegen tatsaechliche 1565.
#
# Aufruf auf dem Server:   bash /tmp/v1096/tools/abnahme.sh
set -uo pipefail
C=${MB_CONTAINER:-dealpilot-mb-backend}
B="http://localhost:4000/api/v1/marktbericht"
fehler=0

frag() {  # frag <pfad-mit-query>
  docker exec "$C" node -e "
    fetch('$B$1').then(r=>r.text()).then(t=>console.log(t))
      .catch(e=>{console.log(JSON.stringify({fehler:e.message}));process.exit(1)})" 2>/dev/null
}

pruefe() {  # pruefe <name> <json> <jq-artiger-node-ausdruck> <sollwert>
  local name="$1" json="$2" ausdruck="$3" soll="$4"
  local ist
  ist=$(node -e "
    let d; try { d = JSON.parse(process.argv[1]); } catch { console.log('KEIN JSON'); process.exit(0); }
    const v = (($ausdruck));
    console.log(v === undefined ? 'undefined' : String(v));" "$json" 2>/dev/null)
  if [ "$ist" = "$soll" ]; then
    printf '  OK    %-52s %s\n' "$name" "$ist"
  else
    printf '  FEHL  %-52s ist %s  soll %s\n' "$name" "$ist" "$soll"
    fehler=$((fehler+1))
  fi
}

echo "=== Abnahme des Registers am laufenden Server ($C) ==="

echo
echo "1 · Registerstand"
ST=$(frag "/register/stand")
node -e "const d=JSON.parse(process.argv[1]);
  console.log('  '+d.saetze+' Saetze · '+d.gebiete+' Gebiete · Herkunft '+d.herkunft);
  console.log('  aus param_modell '+d.aus_db+' · aus der Saatdatei '+d.aus_saat+' · ersetzt '+d.ersetzt);
  console.log('  '+Object.entries(d.je_kennzahl||{}).map(([k,n])=>k+'='+n).join(' '));
  if((d.vermisst||[]).length) console.log('  VERMISST: '+d.vermisst.join(' '));" "$ST" 2>/dev/null
pruefe "Register vollstaendig geladen" "$ST" "d.saetze" "2150"
pruefe "keine Saatdatei vermisst"      "$ST" "(d.vermisst||[]).length" "0"
pruefe "Herkunft ist die Zusammenfuehrung" "$ST" "d.herkunft" "param_modell+saatdatei"

echo
echo "2 · Die neuen Laender sind erreichbar"
W=$(frag "/register/probe?ags=06414000&kennzahl=liegenschaftszinssatz&zweig=efh")
pruefe "Wiesbaden (HE): Liegenschaftszins"  "$W" "d.ergebnis.wert_pct" "1.7"
pruefe "  Stufe"                            "$W" "d.ergebnis.stufe"    "A"

A=$(frag "/register/probe?ags=03452&kennzahl=liegenschaftszinssatz&zweig=ezfh")
pruefe "Aurich (NI): verfuegbar"            "$A" "d.ergebnis.verfuegbar" "true"

P=$(frag "/register/probe?ags=12054&kennzahl=sachwertfaktor&objektart=Einfamilienhaus&sachwert=300000")
pruefe "Potsdam (BB): Sachwertfaktor"       "$P" "d.ergebnis.wert" "1.06"

O=$(frag "/register/probe?ags=05966&kennzahl=sachwertfaktor&objektart=Einfamilienhaus&sachwert=160000")
pruefe "Kreis Olpe (NW): rund 1,00 bei 160.000 EUR" "$O" \
  "(Math.abs(d.ergebnis.wert-1)<0.01)" "true"

echo
echo "3 · KEIN TREFFER HEISST KEIN WERT — der wichtigste Fall"
R=$(frag "/register/probe?ags=13003000&kennzahl=liegenschaftszinssatz&zweig=efh")
pruefe "Rostock (MV): kein Wert"            "$R" "d.ergebnis.verfuegbar" "false"
pruefe "  und der Grund steht dabei"        "$R" "d.ergebnis.grund" "kein_ausschuss_hinterlegt"

M=$(frag "/register/probe?ags=09162000&kennzahl=liegenschaftszinssatz&zweig=efh")
pruefe "Muenchen: kein Liegenschaftszins hinterlegt" "$M" "d.ergebnis.verfuegbar" "false"

echo
echo "4 · Die Regression aus NRW"
H=$(frag "/register/probe?ags=05770016&kennzahl=liegenschaftszinssatz&zweig=we_v")
pruefe "Huellhorst: kreisscharf aufgeloest" "$H" "d.ergebnis.verfuegbar" "true"
pruefe "  Stufe A"                          "$H" "d.ergebnis.stufe" "A"

echo
if [ "$fehler" -eq 0 ]; then
  echo "=== Abnahme bestanden ==="
else
  echo "=== $fehler Pruefung(en) FEHLGESCHLAGEN ==="
fi
exit "$fehler"
