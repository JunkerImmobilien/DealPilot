#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# ni-kalkulator-abtasten.sh  (v1120b)
#
# NIEDERSACHSENS SACHWERTFAKTOREN STEHEN IN EINEM RECHNER, NICHT IN EINER
# TABELLE.
#
# Die Gutachterausschüsse veröffentlichen sie als Tableau-Dashboard: ein
# Kalkulator mit fünf Eingaben (Bodenrichtwert, vorläufiger Sachwert,
# Wohnfläche, Restnutzungsdauer, Standardstufe), daneben die
# Stichprobenübersicht und drei Umrechnungskurven.
#
# DER SCHLÜSSEL: dasselbe Dashboard gibt es als PDF-Export, und die
# Parameter stehen in der URL. Damit ist die amtliche Auskunft
# maschinenlesbar — man tastet das Gitter ab, statt eine Kurve abzulesen.
# Eine abgelesene Kurve ist geraten; ein abgefragter Rechner ist die
# Auskunft selbst.
#
# DIE KETTE:
#   1. Region in der Navigationskarte anklicken (einmal, von Hand) →
#      .../2026/Sachwertfaktor/<teilmarkt>/<regionsname>
#   2. Dieses Skript liest von DIESER Seite die eingebettete Tableau-URL —
#      der View heisst je Region mal `Dash`, mal `dash`, das ist nicht
#      ratbar und wird deshalb GELESEN.
#   3. Dann tastet es das Gitter ab.
#
# GETASTET WIRD AM NORMOBJEKT. Wohnfläche, Restnutzungsdauer und
# Standardstufe bleiben auf ihren Vorgaben (120 m² · 40 Jahre · 2,5) —
# dort stehen alle drei Umrechnungskurven auf 1,00. Ihre Stützstellen
# stehen als ZAHLEN im selben PDF und werden als Korrekturen ins Rezept
# übernommen, nicht abgetastet.
#
# WO DIE QUELLE ENDET, ENDET DIE RECHNUNG: der Rechner liefert auch
# ausserhalb der abgedruckten Kurven noch Zahlen. Die Modellbeschreibung
# sagt dazu, die Diagramm-Wertebereiche gäben "den Rahmen für die
# Verwendbarkeit des zugrunde liegenden Modells" wieder. Zellen ausserhalb
# des abgedruckten Kurvenverlaufs gehören deshalb NICHT ins Rezept.
#
# Aufruf:
#   ./ni-kalkulator-abtasten.sh <teilmarkt> <regionsname> [brw] [sachwerte]
#   ./ni-kalkulator-abtasten.sh reihenhausdoppelhaushaelfte 2026_sw_rh_ott_row
#
# Teilmärkte: einundzweifamilienhaeuser · reihenhausdoppelhaushaelfte ·
#             hoefe · wochenendhaeuser
#
# Braucht curl und pdftotext (auf dem Staging-Server vorhanden, lokal nicht).
#
# HÖFLICHKEIT: gag.niedersachsen.de drosselt nach rund zwanzig Abrufen in
# Folge mit 503 — fuer Minuten und fuer den ganzen Host. Dieses Skript
# fragt die Seite genau EINMAL; das Gitter kommt von Tableau.
# ══════════════════════════════════════════════════════════════════════════
set -u
TM="${1:?Teilmarkt fehlt, z. B. reihenhausdoppelhaushaelfte}"
REG="${2:?Regionsname fehlt, z. B. 2026_sw_rh_ott_row}"
BRWS="${3:-40 130 200 280}"
SACHS="${4:-100000 150000 200000 250000 300000 350000 400000 450000 500000 550000}"
UA="Mozilla/5.0 (DealPilot Registerpflege; ein Abruf je Region)"

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

SEITE="https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/Sachwertfaktor/$TM/$REG"
curl -s --max-time 40 -A "$UA" -o "$TMP/seite.html" "$SEITE"
PFAD=$(grep -oE 'public\.tableau\.com/views/[A-Za-z0-9_]+/[A-Za-z0-9_]+' "$TMP/seite.html" | head -1)
if [ -z "$PFAD" ]; then
  echo "ABBRUCH: auf $SEITE steht keine Tableau-Einbettung." >&2
  echo "         (Bei 503 hat der Server gedrosselt - ein paar Minuten warten.)" >&2
  exit 1
fi
echo "# Quelle: $SEITE"
echo "# Dashboard: https://$PFAD"

curl -s --max-time 60 -A "$UA" -o "$TMP/kopf.pdf" \
  "https://$PFAD.pdf?:showVizHome=no&:embed=true"
echo "### Kopf, Stichprobe und Umrechnungskurven"
pdftotext -layout "$TMP/kopf.pdf" - 2>/dev/null | sed 's/Sachwer aktor/Sachwertfaktor/g'
echo
echo "### Gitter am Normobjekt"
echo "brw;sachwert;faktor;stdabw"
for B in $BRWS; do
  for S in $SACHS; do
    curl -s --max-time 60 -A "$UA" -o "$TMP/t.pdf" \
      "https://$PFAD.pdf?:showVizHome=no&:embed=true&Brw=$B&Sach=$S"
    T=$(pdftotext -layout "$TMP/t.pdf" - 2>/dev/null)
    # Die Ligatur "ft" faellt im Textstrom aus: "Sachwer aktor".
    F=$(echo "$T" | grep -A1 'Sachwer aktor:'    | grep -oE '[0-9],[0-9]{2}' | head -1)
    A=$(echo "$T" | grep -A1 'Standardabweichung:' | grep -oE '[0-9],[0-9]{2}' | head -1)
    echo "$B;$S;${F:-LEER};${A:-LEER}"
  done
done
