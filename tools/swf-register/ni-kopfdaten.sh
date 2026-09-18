#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# ni-kopfdaten.sh  (v1411)
#
# NIEDERSACHSEN OHNE BROWSER UND OHNE DIE LANDESSEITE.
#
# Bis v1120b lief die Ernte so: Navigationskarte im Browser öffnen, eine
# Region anklicken, aus der Ziel-URL das Workbook ablesen — vier bis fünf
# Klicks, dann fror der Renderer ein. Vierzig Gebiete hätten viele Sitzungen
# gekostet, und `gag.niedersachsen.de` drosselt nach rund zwanzig Abrufen.
#
# DER KURZSCHLUSS: die Landesseite wurde nur gebraucht, um den View-Namen
# zu erfahren — er heisst je Region mal `Dash`, mal `dash`. Genau den nennt
# aber die Workbook-API selbst als `defaultViewName`. Damit ist die
# PDF-URL ohne einen einzigen Abruf bei gag.niedersachsen.de vollständig:
#
#   1. GET public.tableau.com/profile/api/workbook/<wb>  -> defaultViewName
#   2. GET public.tableau.com/views/<wb>/<view>.pdf      -> der Kopf
#
# Und die Liste der Gebiete kommt aus der Profilsuche, statt aus Klicks:
#   GET /public/apis/bff/v2/search/query-workbooks?count=100&query=2026_sw
#       &start=<n>&type=vizzes
# Der Endpunkt ist aus dem Seitenbundle GELESEN (`search-*.js`), nicht
# geraten — fünf geratene Namen hatten vorher fünf 404 ergeben, und ein
# 404 auf einen geratenen Namen ist kein Befund.
#
# WAS DIESES SKRIPT HOLT: nur den KOPF je Gebiet — Klarname des
# Ausschusses, Wertermittlungsstichtag, Stichprobengrösse und das
# Normobjekt mit seinem Referenzergebnis. Das ist die Arbeitsliste und
# zugleich der Prüfmassstab: jedes Dashboard trägt sein eigenes
# Anwendungsbeispiel, und damit genügt EINE Gegenprobe je Ausschuss.
#
# Das GITTER holt weiterhin `ni-kalkulator-abtasten.sh`. Die Trennung ist
# Absicht: der Kopf kostet zwei Abrufe, das Gitter vierzig.
#
# Aufruf:   ./ni-kopfdaten.sh [datei-mit-workbooknamen]
#           (Vorgabe: ni-workbooks.txt neben diesem Skript)
# Braucht:  curl und pdftotext (auf dem Staging-Server vorhanden)
# ══════════════════════════════════════════════════════════════════════════
set -u
LISTE="${1:-$(dirname "$0")/ni-workbooks.txt}"
UA="Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)"
LESER="${LESER:-$(dirname "$0")/ni-wert-lesen.py}"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

[ -r "$LISTE" ] || { echo "Liste nicht lesbar: $LISTE" >&2; exit 1; }

echo "workbook;ausschuss;stichtag;stichprobe;norm_faktor;norm_stdabw;teilmarkt;format"

while read -r WB; do
  case "$WB" in ''|\#*|*_navi*) continue ;; esac

  V=$(curl -s -m 25 -A "$UA" "https://public.tableau.com/profile/api/workbook/$WB" \
      | grep -o '"defaultViewName":"[^"]*"' | sed 's/.*:"//;s/"//')
  if [ -z "$V" ]; then echo "$WB;;;;;;;KEIN_WORKBOOK"; sleep 1; continue; fi

  curl -s -m 60 -A "$UA" -o "$TMP/k.pdf" \
    "https://public.tableau.com/views/$WB/$V.pdf?:showVizHome=no&:embed=true"

  # Die Ligaturen "ft" "tf" "fh" "ti" "tt" fallen im Textstrom aus:
  # "Sachwer aktor", "S chprobe", "Wertermi lungss chtag", "Gi orn".
  # Sie haben kein ToUnicode-Mapping; pdftotext setzt ein LEERZEICHEN, in
  # jedem Modus gleich (-layout, -raw, ohne). Der Ausschussname wird
  # deshalb ROH ausgegeben und beim Rezeptbau gegen die amtliche
  # Kreisliste aufgeloest — die Luecke zu raten waere genau die Sorte
  # Zahl, die wir nicht erfinden.
  T=$(pdftotext -layout "$TMP/k.pdf" - 2>/dev/null)

  # ═══ NICHT JEDES DASHBOARD RECHNET AUF DEUTSCH ═════════════════════════
  # GEMESSEN an Uelzen: dort steht "1/1/2026", "170,000" und "± 0.29".
  # Punkt und Komma sind VERTAUSCHT. `:language=de-DE` in der URL aendert
  # daran NICHTS — das Format steckt im Workbook, nicht im Abruf.
  #
  # Waere das unbemerkt geblieben, haette der Gitterlauf dort entweder
  # nichts gefunden oder "170,000" als 170,00 gelesen. Eine Zahl, die kein
  # Mensch nachrechnet, weil sie plausibel aussieht.
  #
  # Erkannt wird es an der Stichprobenzeile: "1.737 Kauffaelle" ist
  # deutsch, "1,737 Kauffaelle" englisch.
  # Erkannt wird es am STICHTAG: "1/1/2026" ist englisch, "01.01.2026"
  # deutsch. Der Tausendertrenner taugt nicht dafuer — Uelzen hat 657
  # Kauffaelle und damit gar keinen, und genau Uelzen ist das englische.
  if echo "$T" | grep -i 'chtag' | grep -q '[0-9]/[0-9]'; then FMT=en; else FMT=de; fi

  NAME=$(echo "$T" | sed -n '2p' | sed 's/^ *//;s/ *$//;s/;/,/g')

  # Stichtag AUS SEINER ZEILE, nicht das erste Datum im Dokument — sonst
  # gewinnt der aelteste Kaufzeitpunkt der Stichprobe (Uelzen: 15.01.2020).
  TAG=$(echo "$T" | grep -i 'chtag' | grep -oE '[0-9]{1,2}[./][0-9]{1,2}[./][0-9]{4}' | head -1)

  # Stichprobe MIT Tausendertrenner. Ohne ihn wurde aus "1.737 Kauffaelle"
  # eine Stichprobe von 1 — bei sieben Gebieten, und alle sahen aus wie
  # ein Ausschuss, der kaum Faelle hat.
  STP=$(echo "$T" | grep -o 'chprobe: *[0-9][0-9.,]*' | grep -oE '[0-9][0-9.,]*' | head -1 | tr -d '.,')

  # DER WERT STEHT NICHT VERLAESSLICH IN DER FOLGEZEILE. Bei Nienburg
  # liegen acht Zeilen zwischen "Sachwer aktor:" und der 0,87; `grep -A1`
  # holte dort eine fremde 0,15. Also: ab der Beschriftung vorwaerts die
  # ERSTE Zahl nehmen, die als Faktor ueberhaupt in Frage kommt.
  # ═══ DER WERT WIRD UEBER SEINE LAGE GEHOLT, NICHT UEBER DIE ZEILE ═════
  # Drei Layoutregeln haben nicht gereicht — 81 Dashboards haben nicht ein
  # Layout, sondern viele, und jede weitere Regel traf das naechste nicht:
  #
  #   Nienburg    Wert ACHT Zeilen unter der Beschriftung  -> las 1,30
  #   Osnabrueck  Wert von -layout in eine andere Zeile     -> las die 0,21
  #               geschoben                                    der Streuung
  #   Northeim    Stichprobe "1.737"                        -> las 1
  #
  # ni-wert-lesen.py stellt die Frage gar nicht: es sucht die Zahl, die auf
  # DERSELBEN HOEHE steht wie ihre Beschriftung, rechts davon. Findet sich
  # keine, gibt es keinen Wert — die Erntedoktrin auf einen Textstrom
  # angewandt.
  pdftotext -bbox-layout "$TMP/k.pdf" "$TMP/k.xml" 2>/dev/null
  FA=$(python3 "$LESER" "$TMP/k.xml" 2>/dev/null)
  FAK="${FA%%;*}"; ABW="${FA##*;}"

  TM=$(echo "$WB" | sed 's/^2026_sw_//;s/_.*//')

  echo "$WB;${NAME:-?};${TAG:-?};${STP:-?};${FAK:-?};${ABW:-?};$TM;$FMT"
  sleep 1          # Hoeflichkeit: ein Abrufpaar je Sekunde, nicht mehr.
done < "$LISTE"
