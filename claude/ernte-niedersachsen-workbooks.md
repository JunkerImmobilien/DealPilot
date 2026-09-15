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

## Was als Nächstes ansteht

1. **Die Kürzel gegen die amtliche Kreisliste auflösen** — die Präfixe sind
   Kfz-Kennzeichen in zwei Lagen (GAG, dann Region): `bs*` Braunschweig,
   `lg*` Lüneburg, `nom*`/`nomak*` Northeim, `olclp*` Oldenburg-Cloppenburg,
   `osmep*` Osnabrück-Meppen, `ott_*` Otterndorf, `sulver*` Sulingen-Verden,
   `aur*` Aurich, `hmhh*` Hameln-Holzminden. Rund **neun Ausschüsse**.
2. **Je Ausschuss eine Messsitzung** mit `ni-kalkulator-abtasten.sh` — das
   Gitter kostet rund vierzig Abrufe, der Kopf nur zwei. Die Trennung ist
   Absicht.
3. **Die fünf offenen Normfaktoren** beim Rezeptbau am PDF ablesen.
4. Lizenz `dl-de/by-2-0`: kommerzielle Verwertung erlaubt, **Namensnennung
   Pflicht** — sie steht seit v1402 im Bericht.

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
