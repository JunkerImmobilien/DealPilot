# Niedersachsen — Arbeitsliste der Sachwertfaktor-Workbooks

**Stand 15.09.2026.** Diese Datei ist eine **Arbeitsliste**, keine Chronik: sie
wächst mit jeder Sitzung, bis alle Gebiete erfasst sind. Danach ist die Ernte
reine Messarbeit.

---

## Das Namensmuster

```
https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/
  Sachwertfaktor/<teilmarktseite>/<workbook>

workbook = 2026_sw_<teilmarkt>_<gag><region>
```

**Die Kürzel sind Kfz-Kennzeichen** — und zwar **zwei hintereinander**: erst
der Gutachterausschuss, dann die Region innerhalb seines Bereichs.

| Workbook | GAG | Region |
|---|---|---|
| `…_bsbs` | **BS** Braunschweig | **BS** Braunschweig |
| `…_bswf` | **BS** Braunschweig | **WF** Wolfenbüttel |
| `…_nomnom` | **NOM** Northeim | **NOM** Northeim |
| `…_lgdan` | **LG** Lüneburg | **DAN** Lüchow-Dannenberg |

> ### Zwei Rücknahmen, beide aus dieser Sitzung
>
> **① „`bswf` ist der Landkreis Wolfenbüttel"** — so stand es seit dem 13.09.
> in der Erntekarte. Genauer ist: **GAG Braunschweig, Region Wolfenbüttel.**
> Der Ausschuss ist Braunschweig, Wolfenbüttel nur eine seiner Regionen.
>
> **② „`2026_sw_efh_bswf` gibt es nicht, also führt Braunschweig kein EFH"** —
> die erste Hälfte stimmt, die Schlussfolgerung war falsch. Es gibt
> **`2026_sw_efh_bsbs`**: Braunschweig führt Ein- und Zweifamilienhäuser sehr
> wohl, nur für die Region Braunschweig statt Wolfenbüttel. Aus einer
> fehlenden URL auf ein fehlendes Angebot zu schließen, war zu schnell.

---

## Gefunden und an der Workbook-API bestätigt

| Workbook | GAG + Region | aktualisiert | Aufrufe | Stand |
|---|---|---|---:|---|
| `2026_sw_rh_bswf` | BS · Wolfenbüttel | 19.02.2026 | 231 | **geerntet** (13.09., Stufe B) |
| `2026_sw_efh_bsbs` | BS · Braunschweig | 19.02.2026 | 674 | offen |
| `2026_sw_rh_bsbs` | BS · Braunschweig | 19.02.2026 | 219 | offen |
| `2026_sw_efh_osmep_osmepnoh` | OS+MEP · OS+MEP+NOH | 20.03.2026 | 799 | offen |
| `2026_sw_efh_hmhhsg` | HM… · … | 10.02.2026 | 725 | offen |
| `2026_sw_efh_sulverniostni` | … · … | 12.05.2026 | 411 | offen |
| `2026_sw_efh_nomnom` | NOM · Northeim | 24.03.2026 | 446 | offen |
| `2026_sw_rh_nomnom` | NOM · Northeim | 07.04.2026 | 135 | offen |
| `2026_sw_efh_lgdan` | LG · Lüchow-Dannenberg | 05.02.2026 | 264 | offen |

**Sieben Gebiete, neun Workbooks.** Die Auflösung der längeren Kürzel
(`hmhhsg`, `sulverniostni`) steht noch aus — sie ergibt sich aus dem Titelblatt
des jeweiligen Dashboards (`<pfx>_titel`).

---

## Der Hebel: Teilmärkte sind ableitbar

**Ein Klick liefert das Gebiet, die API die übrigen Teilmärkte.** Geprüft an
zwei Gebieten: zu jedem gefundenen `efh_<gebiet>` existiert auch
`rh_<gebiet>` — ohne einen zweiten Klick.

Am Gebiet `bsbs` durchprobiert, welche Teilmarkt-Kürzel es gibt:

| | |
|---|---|
| vorhanden | `efh` · `rh` |
| **nicht** vorhanden | `dhh` · `reh` · `mfh` · `whs` · `wh` · `zfh` · `etw` |

### Die vier Teilmärkte — aus dem Dropdown gelesen

| Teilmarkt | Kürzel |
|---|---|
| Ein- und Zweifamilienhäuser | `efh` |
| Reihenhäuser und Doppelhaushälften | `rh` |
| **Bauernhäuser und Resthofstellen** | **offen** |
| **Wochenendhäuser** | **offen** |

Die Namen stammen aus der Parametersteuerung der Navigationsseite — sie liegt
als DOM-Element vor (`.tabComboBox`), nicht im Canvas, und lässt sich per
JavaScript öffnen und auslesen.

**Die beiden fehlenden Kürzel sind nicht erraten worden** — an zwei Gebieten
durchprobiert (`bh`, `brh`, `bauh`, `rhf`, `bhrh`, `weh`, `woh`, `wehs`,
`bhr`, `wo`), kein Treffer. Sie ergeben sich aus der Ziel-URL, sobald im
Dropdown ein anderer Teilmarkt gewählt und dann auf die Karte geklickt wird.

> **Warum das offen blieb:** Das Dropdown schließt sich zwischen zwei
> Werkzeugaufrufen wieder; Öffnen und Auswählen müssen in *einem* Schritt
> passieren. Drei Anläufe, dann abgebrochen — die Regel gilt auch hier.

### Eine Messfalle, die Zeit gekostet hat

Das Kombifeld liegt bei **(763, 194)** in CSS-Pixeln — geklickt hatte ich nach
Screenshot-Koordinaten bei (748, 166). **Screenshot-Pixel sind nicht
CSS-Pixel**, und der Versatz ist nicht einmal ein einheitlicher Faktor. Wer
ein Tableau-Bedienelement treffen will, liest seine Lage vorher per
`getBoundingClientRect()` aus, statt sie aus dem Bild zu schätzen.

---

## Das Verfahren zum Weitersammeln

1. Navigationskarte öffnen:
   `public.tableau.com/views/2026_sw_navi_EFH/Story?Typ=EFH&:showVizHome=no&:embed=true&:language=de-DE`
2. **Neun Sekunden warten**, bis die Karte steht.
3. Auf eine Region klicken → es öffnet sich **ein** Zieltab, dessen URL das
   Workbook nennt. **Tableau verwendet denselben Zieltab wieder** — mehrere
   Klicks in einem Rutsch liefern deshalb nur das letzte Ergebnis. **Ein Klick
   je Aufruf**, dann die URL im Tab-Kontext ablesen.
4. **Nach etwa vier bis fünf Klicks friert der Renderer ein**
   (`Page.captureScreenshot` läuft in den Timeout). Dann die Karte neu laden
   und weitermachen. Das ist derselbe Befund wie bei den Messreihen — er gilt
   auch fürs Navigieren.
5. Jedes gefundene Gebiet gegen die API prüfen und gleich die anderen
   Teilmärkte mitnehmen.

### Prüfen, ohne zu rendern

```
GET https://public.tableau.com/profile/api/workbook/<workbook>
→ lastUpdateDate · viewCount · viewInfos[]
```

Antwortet die API nicht, gibt es das Workbook nicht. **Vor jeder Nachernte
`lastUpdateDate` gegen das `berichtsjahr` des Registersatzes halten** — ein
HTTP-Aufruf spart eine ganze Messsitzung.

### Die Blattstruktur eines Ziel-Workbooks

```
<pfx>_titel · <pfx>_berech · <pfx>_stanzahl · <pfx>_stübersicht
<pfx>_diavortext · <pfx>_dia_brw · <pfx>_dia_bgwf · <pfx>_dia_stst
<pfx>_tab · <pfx>_tooltipp
```

`_titel` trägt den Klarnamen des Ausschusses, `_berech` ist der Kalkulator,
`_dia_brw` / `_dia_bgwf` / `_dia_stst` sind die drei Stützpunkt-Diagramme
(Bodenrichtwert, Bodenwertanteil, Standardstufe). Der Präfix trägt eine
laufende Regionsnummer (`ni2_`), die sich **nicht** aus dem Workbook-Namen
ableiten lässt.

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
