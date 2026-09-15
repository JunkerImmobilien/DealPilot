# Niedersachsen — Arbeitsliste der Sachwertfaktor-Workbooks

**Stand 15.09.2026, nachmittags.** Diese Datei ist eine **Arbeitsliste**, keine
Chronik: sie wächst mit jeder Sitzung, bis alle Gebiete erfasst sind.

---

## ERLEDIGT: die Gebietsliste ist vollständig — 81 Datensätze, ohne einen Klick

> **Hier stand: „Sieben Gebiete, neun Workbooks. Was fehlt, ist die Liste der
> Dashboard-Kürzel."** Das war der Blocker des ganzen Landes, und er hing an
> der Annahme, die Kürzel seien nur über die Navigationskarte im Browser zu
> bekommen — vier bis fünf Klicks, dann friert der Renderer ein.
>
> **Die Annahme war falsch.** Tableau Public hat eine Profilsuche, und sie
> liefert alle Workbooks eines Autors auf einmal:
>
> ```
> GET /public/apis/bff/v2/search/query-workbooks
>     ?count=100&query=2026_sw&start=<n>&type=vizzes
> ```
>
> **Der Endpunkt ist GELESEN, nicht geraten.** Fünf geratene Namen hatten
> vorher fünf 404 ergeben — und ein 404 auf einen geratenen Namen ist kein
> Befund, er sagt nur, dass man den Namen nicht kennt. Also die Profilseite
> geholt, ihr Bundle `assets/search-*.js` gelesen und dort sowohl den Pfad
> als auch die Parameterreihenfolge abgeschrieben.

**Ergebnis: 86 Workbooks, davon 81 mit Daten** (fünf sind Navigationskarten).
Stabil über fünf verschiedene Suchbegriffe — die Liste ist vollständig.

| Teilmarkt | Kürzel | Gebiete |
|---|---|---:|
| Ein- und Zweifamilienhäuser | `efh` | 42 |
| Reihenhäuser und Doppelhaushälften | `rh` | 35 |
| **Bauernhäuser und Resthofstellen** | **`hof`** | 3 |
| beide zusammen in einem Workbook | `efhrh` | 1 |

> **Das Kürzel `hof` war eine der beiden offenen Fragen** und ist damit
> beantwortet — nicht erraten (zehn Versuche wie `bh`, `brh`, `rhf` waren
> vorher erfolglos), sondern in der Liste vorgefunden. Für **Wochenendhäuser**
> gibt es eine Navigationskarte (`2026_sw_navi_WEH`), aber **kein einziges
> Daten-Workbook** — der Teilmarkt wird 2026 offenbar nicht geführt.

Die Liste liegt als `tools/swf-register/ni-workbooks.txt` im Repo.

---

## ERLEDIGT: die Landesseite wird gar nicht mehr gebraucht

`ni-kalkulator-abtasten.sh` rief bisher zuerst `gag.niedersachsen.de` auf —
**einzig, um den View-Namen zu erfahren**, der je Region mal `Dash` und mal
`dash` heißt. Genau den nennt aber die Workbook-API selbst als
`defaultViewName`. Damit fällt der Abruf bei der Landesseite weg, die nach
rund zwanzig Abrufen für Minuten mit 503 drosselt.

```
1. GET public.tableau.com/profile/api/workbook/<wb>   -> defaultViewName
2. GET public.tableau.com/views/<wb>/<view>.pdf       -> der Kopf
```

**Die Ernte läuft damit vollständig ohne Browser.**

---

## Die Kopfdaten aller 81 Gebiete

`tools/swf-register/ni-kopfdaten.sh` → `ni-kopfdaten.csv`. Ein Lauf, zwei
Abrufe je Gebiet, rund vier Minuten.

| | |
|---|---:|
| Gebiete | **81** |
| mit Klarname des Ausschusses | 80 |
| mit Stichprobengröße | **81** |
| mit Normobjekt-Faktor | 76 |
| mit Standardabweichung | 78 |
| Kauffälle insgesamt | **44.593** |
| Normfaktoren | 0,72 bis 2,25 · **Median 0,99** |

**Die fünf offenen Faktoren sind bewusst offen.** Sie stehen in Dashboards,
deren Layout der Ausleser nicht eindeutig lesen kann, und werden beim
Rezeptbau von Hand am PDF abgelesen — einmal je Ausschuss, was ohnehin nötig
ist, weil das Normobjekt der Prüfmaßstab ist.

---

## Drei Fallen, die dieser Lauf aufgedeckt hat

### ① Ein Workbook rechnet auf Englisch

**Landkreis Uelzen** liefert `1/1/2026`, `170,000` und `± 0.29` — Punkt und
Komma vertauscht. **`:language=de-DE` in der URL ändert daran nichts**, das
Format steckt im Workbook.

> Unbemerkt hätte der Gitterlauf dort entweder nichts gefunden oder `170,000`
> als 170,00 gelesen — eine Zahl, die niemand nachrechnet, weil sie plausibel
> aussieht. Erkannt wird es jetzt am **Stichtag**: `1/1/2026` gegen
> `01.01.2026`. Der Tausendertrenner taugt als Merkmal nicht — Uelzen hat 657
> Kauffälle und damit gar keinen.

**Genau eines von 81.** Beim nächsten Jahrgang neu prüfen, nicht annehmen.

### ② Ligaturen fehlen im Textstrom

`ft` `tf` `fh` `ti` `tt` haben kein ToUnicode-Mapping; pdftotext setzt ein
**Leerzeichen**, in jedem Modus gleich. „Landkreis Gi orn" ist Gifhorn,
„Os riesland" ist Ostfriesland, „Sachwer aktor" ist der Sachwertfaktor.

Die Namen werden deshalb **roh** ausgegeben und beim Rezeptbau gegen die
amtliche Kreisliste aufgelöst. Die Lücke zu raten wäre genau die Sorte Zahl,
die wir nicht erfinden.

### ③ Der Wert steht nicht dort, wo seine Beschriftung steht

Das war die teuerste Erkenntnis, und sie hat **drei Anläufe** gekostet:

| Gebiet | was der Ausleser las | was dort steht |
|---|---|---|
| **Stadt Nienburg** | 1,30 | **0,87** — acht Zeilen unter der Beschriftung |
| **Stadt Osnabrück** | 0,21 | **kein Wert** — 0,21 war die Standardabweichung der Folgezeile |
| **Landkreis Northeim** | Stichprobe 1 | **1.737** — der Tausenderpunkt |

> **81 Dashboards haben nicht ein Layout, sondern viele.** Nach der dritten
> Layoutregel habe ich aufgehört, eine vierte zu bauen, und stattdessen eine
> Eigenschaft der Sache selbst geprüft: **ein Sachwertfaktor und seine
> Standardabweichung sind zwei verschiedene Größen.** Stimmen sie auf zwei
> Nachkommastellen überein, ist es derselbe Fund zweimal gelesen — dann
> bleibt das Feld offen. Das fängt auch Layouts, die ich nie gesehen habe.
>
> **Die Regel dahinter ist die Erntedoktrin selbst:** wo die Quelle nicht
> eindeutig ist, gibt es keinen Wert. Fünf offene Felder sind kein Mangel
> dieses Laufs — eine still falsche Zahl wäre einer.

---

## Geerntet: neun Sätze — und einer wieder zurückgezogen

| AGS | Gebiet | Faktor am Normobjekt | Stichprobe | Version |
|---|---|---:|---:|---|
| 03101 | Stadt Braunschweig | 1,25 | 304 | v1416 |
| 03103 | Stadt Wolfsburg | 0,92 | 245 | v1417 |
| 03151 | Landkreis Gifhorn | 0,89 | **854** | v1419 |
| 03351 | Landkreis Celle | 0,97 | 415 | v1419 |
| 03241 | **Region Hannover** | 1,00 | **1.005** | v1420 |
| 03254 | Landkreis Hildesheim | 0,73 | 370 | v1420 |
| 03257 | Landkreis Schaumburg | 1,02 | 474 | v1420 |
| 03256 | Stadt Nienburg | 0,87 | 249 | v1414 |
| 03361 | Landkreis Verden | 0,92 | 549 | v1412 |

**Jeder Satz trifft sein Anwendungsbeispiel zeichengleich**, und jede
Korrektur ist einzeln nachgerechnet. Niedersachsen steht bei **14
Registersätzen** (vorher 5), die Regressionsstrecke bei 392 Sätzen ohne
technischen Fehler.

> ### Die Rücknahme: Stadt Salzgitter (v1417 → v1418)
>
> Der Satz war gebaut, geprüft, ausgerollt — und gehörte nicht ins
> Register. Das Dashboard führt ein eigenes Eingabefeld **„Lage im
> Landkreis: Bruchmachtersen, Engelns.."**; mein Gitter galt damit für eine
> unbenannte Teillage, nicht für die Stadt.
>
> Durchgekommen ist er, weil `ni-lageachse.sh` nach `Lage:` mit direktem
> Doppelpunkt suchte. **Von 71 vermeintlich erntbaren Gebieten sind es
> tatsächlich 55.** Ausführlich in `FALLEN.md`.

---

## Was der Weg inzwischen kann

```
ni-steckbrief.sh   Normobjekt, Kurven, Spannen, Parameterprobe  (2 Abrufe)
ni-lageachse.sh    ist das Gebiet ueberhaupt vollstaendig erfassbar?
gitter2.sh         das Gitter abtasten                         (~70 Abrufe)
ni-kurven-lesen.py die Korrekturkurven ueber die x-Position
ni-wert-lesen.py   eine Zahl ueber ihre LAGE statt ueber die Zeile
```

Rund zehn Minuten je Gebiet, davon die Hälfte Wartezeit.

**Vier Regeln, die sich beim Ernten herausgestellt haben:**

1. **Das Normobjekt muss auf einer Gitterachse liegen.** Sonst ist die
   Gegenprobe interpoliert — und eine Rechnung mit sich selbst ist kein
   Beweis. Bei Gifhorn wurde die Zeile Brw 120 eigens nachgetastet.
2. **Die Freigaben des Filters von Hand gegenlesen**, nicht nur die
   Sperrungen. Die Sperrungen erklären sich selbst.
3. **Das Modell hängt am GEBIET, nicht am Ausschuss.** Wolfsburg führt
   keine RND-Korrektur, Braunschweig und Salzgitter schon — derselbe
   Ausschuss. Schaumburg keine, Region Hannover und Hildesheim schon —
   derselbe Ausschuss. Und die Teilmärkte eines Gebiets unterscheiden sich
   auch: Verden EFH ohne Lage-Achse, Verden Reihenhaus mit.
4. **Stichtag und Baujahrsgrenze je Ausschuss prüfen.** Braunschweig-
   Wolfsburg rechnet zum 01.01.2026, Hameln-Hannover zum **01.10.2025**
   und **nur für Baujahre ab 1950** — für ältere Gebäude gibt es dort
   eigene Kalkulatoren, die noch nicht erfasst sind.

## Was als Nächstes ansteht

**Der eine Blocker: der Lage-Parameter.** Sieben der neun Ausschüsse wählen
über eine Lagegruppe zwischen mehreren Sachwertkurven aus. `Brw` und `Sach`
greifen in der URL, ein Parameter für die Lage ist nicht bekannt — vier
Namen durchprobiert, keiner wirkt, und Raten hilft hier so wenig wie beim
Suchendpunkt. Der Name steht in der Workbook-Definition; der Weg dorthin
führt über die Tableau-Session (`bootstrapSession`), nicht über die URL.

**Solange er fehlt, sind erfassbar:** die Gebiete ohne Lage-Achse. Geprüft
ist das für den GAG Sulingen-Verden; bei den übrigen sagt ein Blick in den
Kopf des Dashboards, ob eine Zeile `Lage:` vorkommt — das kostet zwei
Abrufe je Gebiet, nicht vierzig.

**Erledigt und hier nur noch zur Kenntnis:**

- ~~Die Kürzel gegen die amtliche Kreisliste auflösen~~ — **bestätigt aus
  dem eigenen Register**, nicht aus einer getippten Liste: die 39
  niedersächsischen AGS dort führen ihren Ausschuss im Klartext, und die
  Zuordnung deckt sich mit den Präfixen (`bs*` Braunschweig-Wolfsburg,
  `lg*` Lüneburg, `nom*`/`nomak*` Northeim, `olclp*` Oldenburg-Cloppenburg,
  `osmep*` Osnabrück-Meppen, `ott_*` Otterndorf, `sulver*` Sulingen-Verden,
  `aur*` Aurich, `hmhh*` Hameln-Hannover).
- ~~Die fünf offenen Normfaktoren am PDF ablesen~~ — mit dem
  positionsbasierten Leser sind es **81 von 81** (v1413).

**Sieben Landkreise fehlen im Register, obwohl es Faktoren gibt:**
Göttingen (03152), Goslar (03153), Northeim (03155), Osterode (03156),
Holzminden (03255), ~~Nienburg (03256)~~ ✓, ~~Verden (03361)~~ ✓. Die
verbleibenden fünf gehören alle zum GAG Northeim — und der führt eine
Lage-Achse. Sie hängen damit am Blocker oben.

**Lizenz** `dl-de/by-2-0`: kommerzielle Verwertung erlaubt, **Namensnennung
Pflicht** — sie steht seit v1402 im Bericht und in jedem Rezept unter
`quellenvermerk`.

---
## Was beim Messen gilt (aus der Wolfenbüttel-Ernte)

- Frische URL mit `?Brw=…&Sach=…`, **sieben Sekunden warten**, dann den
  Ergebnisbereich zoomen — vier Messungen je Durchgang.
- Messreihen im selben Tab scheitern am Renderer-Timeout.
- **Jedes Dashboard trägt ein Normobjekt mit Referenzergebnis und
  Standardabweichung** — das ist der Prüfmaßstab nach der Erntedoktrin, und
  damit genügt **eine** Gegenprobe je Ausschuss.
- Lizenz `dl-de/by-2-0`: kommerzielle Verwertung erlaubt, **Namensnennung
  Pflicht** — sie steht seit v1402 im Bericht.
