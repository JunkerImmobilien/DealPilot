#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# ni-kalkulator-abtasten.sh  (v1120)
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
#   https://public.tableau.com/views/<WB>/<VIEW>.pdf?:showVizHome=no
#       &:embed=true&Brw=<bodenrichtwert>&Sach=<sachwert>
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
# des abgedruckten Kurvenverlaufs gehören deshalb NICHT ins Rezept —
# sie bleiben leer.
#
# Aufruf:
#   ./ni-kalkulator-abtasten.sh <workbook> [view] [brw-liste] [sachwert-liste]
#   ./ni-kalkulator-abtasten.sh 2026_sw_rh_bswf dash "40 130 200 280" \
#        "100000 150000 200000 250000 300000 350000 400000 450000 500000 550000"
#
# Braucht curl und pdftotext (auf dem Staging-Server vorhanden, lokal nicht).
# ══════════════════════════════════════════════════════════════════════════
set -u
WB="${1:?workbook fehlt, z. B. 2026_sw_rh_bswf}"
VIEW="${2:-dash}"
BRWS="${3:-40 130 200 280}"
SACHS="${4:-100000 150000 200000 250000 300000 350000 400000 450000 500000 550000}"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Einmal ohne Parameter: Kopfdaten, Stichprobe und die drei Umrechnungskurven.
curl -s -A "Mozilla/5.0" -o "$TMP/kopf.pdf" \
  "https://public.tableau.com/views/$WB/$VIEW.pdf?:showVizHome=no&:embed=true"
echo "### Kopf, Stichprobe und Umrechnungskurven"
pdftotext -layout "$TMP/kopf.pdf" - 2>/dev/null | sed 's/\bSachwer aktor/Sachwertfaktor/g'
echo
echo "### Gitter am Normobjekt"
echo "brw;sachwert;faktor;stdabw"
for B in $BRWS; do
  for S in $SACHS; do
    curl -s -A "Mozilla/5.0" -o "$TMP/t.pdf" \
      "https://public.tableau.com/views/$WB/$VIEW.pdf?:showVizHome=no&:embed=true&Brw=$B&Sach=$S"
    T=$(pdftotext -layout "$TMP/t.pdf" - 2>/dev/null)
    # Die Ligaturen "ft" fallen im Textstrom aus: "Sachwer aktor".
    F=$(echo "$T" | grep -A1 'Sachwer aktor:'    | grep -oE '[0-9],[0-9]{2}' | head -1)
    A=$(echo "$T" | grep -A1 'Standardabweichung:' | grep -oE '[0-9],[0-9]{2}' | head -1)
    echo "$B;$S;${F:-LEER};${A:-LEER}"
  done
done
