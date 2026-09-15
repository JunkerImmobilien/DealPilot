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
  # ═══ DER AUSLESER DARF NICHT RATEN ═════════════════════════════════════
  # GEMESSEN an Nienburg: zwischen "Sachwer aktor:" und seinem Wert 0,87
  # liegen acht Zeilen mit fremden Zahlen. Wer "die naechste Zahl im
  # Faktorband" nimmt, bekommt dort 1,30 — eine Zahl, die plausibel
  # aussieht, durch jede Bandpruefung geht und FALSCH ist.
  #
  # Deshalb gilt hier dieselbe Regel wie im Register: WO DIE QUELLE NICHT
  # EINDEUTIG IST, GIBT ES KEINEN WERT. Uebernommen wird nur, was in
  # DERSELBEN Zeile wie seine Beschriftung steht oder in der direkt
  # folgenden. Alles andere wird als `?` gemeldet und beim Rezeptbau von
  # Hand am PDF abgelesen — einmal je Ausschuss, das ist ohnehin noetig,
  # weil das Normobjekt der Pruefmassstab ist.
  #
  # 21 offene Felder sind kein Mangel dieses Laufs. Eine still falsche
  # Zahl waere einer.
  zahl_ab() {                       # $1 Muster  $2 Untergrenze  $3 Obergrenze
    echo "$T" | grep -A1 "$1"       | { if [ "$FMT" = en ]; then grep -oE '[0-9]+\.[0-9]{2}'
          else grep -oE '[0-9]+,[0-9]{2}'; fi; }       | tr ',' '.'       | awk -v u="$2" -v o="$3" '$1+0 >= u && $1+0 <= o { print; exit }'
  }
  FAK=$(zahl_ab 'Sachwer aktor:'      0.20 4.00)
  ABW=$(zahl_ab 'Standardabweichung:' 0.01 1.00)

  # ═══ WENN BEIDE ZAHLEN GLEICH SIND, IST EINE DAVON GELIEHEN ═══════════
  # Nach drei Layoutregeln hielt sich die Stadt Osnabrueck weiter: Faktor
  # 0,21 UND Streuung 0,21. Statt eine vierte Regel zu bauen, greift hier
  # eine Eigenschaft der Sache selbst — ein Sachwertfaktor und seine
  # Standardabweichung sind zwei verschiedene Groessen, und dass sie auf
  # zwei Nachkommastellen genau uebereinstimmen, ist kein Zufall, sondern
  # derselbe Fund zweimal gelesen.
  #
  # Das ist die allgemeinere Pruefung: nicht "wo steht die Zahl", sondern
  # "kann das ueberhaupt stimmen". Sie faengt auch Layouts, die ich nie
  # gesehen habe. Im Zweifel bleibt das Feld offen.
  if [ -n "$FAK" ] && [ "$FAK" = "$ABW" ]; then FAK=""; fi

  TM=$(echo "$WB" | sed 's/^2026_sw_//;s/_.*//')

  echo "$WB;${NAME:-?};${TAG:-?};${STP:-?};${FAK:-?};${ABW:-?};$TM;$FMT"
  sleep 1          # Hoeflichkeit: ein Abrufpaar je Sekunde, nicht mehr.
done < "$LISTE"
