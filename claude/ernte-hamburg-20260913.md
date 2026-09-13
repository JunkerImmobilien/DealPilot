# Ernte Hamburg — Sachwertfaktor für Einfamilienhäuser (Jahrgang 2026)

**Geerntet am 13.09.2026.** Quelle: Immobilienmarktbericht Hamburg 2026,
Kapitel 7.2.3, Seiten 117–123. Herausgeber: Gutachterausschuss für
Grundstückswerte in Hamburg, © 2026. Berichtszeitraum 01.01.–31.12.2025.

**Alle Zahlen stammen aus dem Dokument. Nichts ergänzt, nichts interpoliert,
nichts fortgesetzt.**

---

## Warum das hier steht

Das Backlog führte Hamburg als **Platz 1 der Ernte-Reihenfolge** (1,9 Mio.
Einwohner, **ein** Ausschuss, Lizenz frei) mit dem Vermerk *„reine
Zugriffsfrage — `hamburg.de` gibt 403"*.

> **Das war überholt.** Die geprüften URLs geben heute **404, nicht 403** —
> die Adressen hatten sich geändert, gesperrt war nichts. Der
> Immobilienmarktbericht 2026 ist als PDF frei abrufbar (27 MB, 214 Seiten)
> und mit `pdftotext -layout` vollständig lesbar.

## Die Lizenz — wörtlich aus dem Impressum

> „Verwendung und Weiterverbreitung der in diesem Immobilienmarktbericht
> enthaltenen Daten **unter Angabe der Quelle gestattet**."

Keine Einschränkung auf nicht-kommerzielle Nutzung, keine Rückfrage nötig.
**Quellenangabe ist Pflicht** — der Quellenblock aus A2 gilt also auch hier.

---

## Das Modell

**Anzuwendendes Modell zur Ermittlung des vorläufigen Sachwertes:**

| | |
|---|---|
| Besondere Bauteile | kein gesonderter Ansatz — im üblichen Umfang enthalten |
| Garagen | 9.000 €/Stück (Kostenstand 2010) |
| Carports | 3.000 €/Stück (Kostenstand 2010) |
| Außenanlagen | kein gesonderter Ansatz — im üblichen Umfang enthalten |
| Baupreisindex | interpoliert zum Modellstichtag |
| Baujahr | ursprüngliches Baujahr |
| **Gesamtnutzungsdauer** | **80 Jahre** |
| Restnutzungsdauer | GND abzüglich Alter bzw. modifiziert nach ImmoWertV, entsprechend der Modernisierungspunktzahl |
| **Alterswertminderung** | **linear** |
| Bodenwert | objektspezifischer Bodenwert zum Modellstichtag |
| Standardstufe | gemäß Anlage 4 ImmoWertV (IMB S. 201) |
| **Regionalfaktor** | **1,75 für ganz Hamburg** |

**Sachlicher Geltungsbereich:** Einfamilienhäuser — in diesem Abschnitt
definiert als Ein- und Zweifamilienhäuser mit bis zu zwei Wohneinheiten.
**Räumlicher Geltungsbereich:** ganz Hamburg **ohne Neuwerk**.

### Das Normobjekt

- Mittlere Lage (Median der normierten EFH-Bodenrichtwerte)
- Grundstücksgröße **750 m²**, freistehend in Frontlage
- Bodenwert zum Modellstichtag
- 1-geschossig mit voll ausgebautem Dachgeschoss, **ohne Keller**
- Bruttogrundfläche (A+B) **225 m²**
- Standardstufe **3,0**, NHK 2010 **1.005 €/m² BGF**
- Regionalfaktor **1,75**, Außenanlagen im üblichen Umfang
- Restnutzungsdauer **50 Jahre**

### Die Formel

```
Sachwertfaktor = 0,788
   × Lagefaktor              × Sachwerthöhenfaktor    × Bodenwertanteilsfaktor
   × Grundstücksgrößenfaktor × Baujahrsfaktor         × Restnutzungsdauerfaktor
   × Kellerfaktor            × Wohnflächenfaktor      × Modernisierungsfaktor
   × Ecklagefaktor           × Wohnungszahlfaktor     × Einbauküchenfaktor
   × Dachfaktor              × Fußbodenheizungsfaktor × Solarenergiefaktor
   × Wärmepumpenfaktor       × Stellungsfaktor        × Stadtteilfaktor
   × Aktualisierungsfaktor
```

**19 Faktoren, jeder mit ausdrücklich genanntem Normwert 1.** Das macht das
Modell geschlossen rechenbar — kein Ablesen aus Kurven, keine Interpolation.

---

## Die Faktoren

### Stetige Funktionen

| Faktor | Formel | Normfall = 1 |
|---|---|---|
| **Lage** | `(NormBRW20 / 630) ^ 0,1902` | mittlere Lage; Median der auf 1.000 m² normierten BRW für Ein-/Zweifamilienhäuser zum 31.12.2020 = **630 €/m²** |
| **Sachwerthöhe** | `(vorl. Sachwert / Normsachwert) ^ -0,3558`<br>wenn Verhältnis ≥ 1,87: **0,8** | vorl. Sachwert = Normsachwert |
| **Bodenwertanteil** | `0,67318 + 0,5447 × Bodenwertanteil` | bei Bodenwertanteil 60 % |
| **Grundstücksgröße** | `(Grundstücksfläche / 600 m²) ^ -0,1138` | bei 600 m² |
| **Wohnfläche** | `(Wohnfläche / 120 m²) ^ 0,3881`<br>wenn ≥ 300 m²: **1,427** | bei 120 m² |
| **Restnutzungsdauer** | ≤ 15 J.: **1,016**<br>16–50 J.: `-0,0013 × RND + 1,065`<br>> 50 J.: **1,000** | bei 50 Jahren |
| **Modernisierung** | `1 + 0,0076 × (tatsächliche Punktzahl − Mittel der Baujahrsklasse)`<br>Baujahr > 2009: **1,000** | bei baujahrstypischer Punktzahl |

**Baujahrstypische Modernisierungspunktzahl** (Anlage 2 ImmoWertV):

| bis 1919 | 1920–39 | 1940–59 | 1960–69 | 1970–79 | 1980–89 | 1990–99 | 2000–09 |
|---|---|---|---|---|---|---|---|
| 5,74 | 5,25 | 5,23 | 4,70 | 4,10 | 3,53 | 2,32 | 1,79 |

### Stufen und Schalter

| Faktor | Werte | Normfall = 1 |
|---|---|---|
| **Baujahr** | bis 1919 **1,007** · 1920–39 **0,997** · 1940–59 **0,934** · 1960–79 **0,961** · 1980–89 **1,000** · ab 1990 **1,018** | 1980–1989 |
| **Keller** | **1,054** | ohne Keller |
| **Ecklage** | **0,976** | keine Ecklage |
| **Wohnungszahl** | 2 Wohnungen **0,895** | 1 Wohnung |
| **Einbauküche** | **1,049** | keine Einbauküche |
| **Fußbodenheizung** | **1,068** | keine |
| **Solarenergie** | **1,043** (Fotovoltaik *oder* Solarthermie) | ohne |
| **Wärmepumpe** | **1,020** ohne Solarenergie · **1,000** mit Solarenergie¹ | ohne Wärmepumpe |
| **Stellung** | Doppelhaushälfte **0,977** · Mittelreihenhaus **0,998** · Endreihenhaus **0,981** | freistehend |
| **Dach** | Bungalow oder 1-gesch. mit Flachdach-Staffelgeschoss **0,985**<br>1-gesch. mit nicht ausgebautem DG **0,942**<br>2-gesch. mit Flachdach / Flachdach-Staffelgeschoss **1,020**<br>2-gesch. mit nicht ausgebautem DG **0,990**<br>2-gesch. mit ausgebautem DG **1,015**<br>sonst **1,000** | 1-geschossig mit Dachgeschossausbau |

¹ Fußnote im Bericht: *„Keine Doppelberücksichtigung von Wärmepumpe und Fotovoltaik."*

### Aktualisierungsfaktor

| Untersuchungszeitraum | Stichtag | Aktualisierungsfaktor | Normsachwert [€] | Bodenwertanteil vom Normsachwert | Baupreisindex (Mai 2010 = 1) |
|---|---|---|---|---|---|
| 1.1.2021–1.1.2022 | 01.01.2022 | 1,000 | 970.665 | 62 % | 1,502 |
| 1.1.2022–1.1.2023 | 01.07.2022 | 0,993 | 1.043.850 | 61 % | 1,657 |
| 1.1.2022–1.1.2023 | 01.01.2023 | 0,932 | 995.826 | 57 % | 1,742 |
| 1.1.2023–1.1.2024 | 01.07.2023 | 0,947 | 936.338 | 53 % | 1,782 |
| 1.1.2023–1.1.2024 | 01.01.2024 | 0,971 | 940.707 | 52 % | 1,808 |
| 1.1.2024–1.1.2025 | 01.07.2024 | 0,939 | 948.127 | 52 % | 1,838 |
| 1.1.2024–1.1.2025 | 01.01.2025 | 0,933 | 952.249 | 52 % | 1,854 |
| 1.1.2025–1.1.2026 | 01.07.2025 | 0,957 | 947.263 | 51 % | 1,892 |
| **1.1.2025–1.1.2026** | **01.01.2026** | **0,973** | **939.645** | **50 %** | **1,911** |

> **Nebenbefund für Backlog B1②:** Hamburg nennt den Baupreisindex zum
> 01.01.2026 mit **1,911** (Basis Mai 2010 = 1). Der GMB Dortmund 2026 sagt
> **1,906**. Unser `CrossCheckService.js` rechnet mit der Konstanten
> **2,02** — **zwei unabhängige amtliche Quellen** liegen rund 6 % darunter.

### Stadtteilfaktor

Rund 100 Stadtteile, Werte von **0,914** (Billbrook, Billstedt) bis **1,193**
(Alsterdorf, Groß Borstel, Ohlsdorf). Normfall 1,000 trifft die
Innenstadt-Stadtteile (Altona-Altstadt, Eimsbüttel, Winterhude, St. Pauli …).

**Neuwerk trägt keinen Wert** — konsistent zum räumlichen Geltungsbereich
„ganz Hamburg ohne Neuwerk".

Vollständige Tabelle: Immobilienmarktbericht 2026, S. 121–122.

```
Allermöhe 1,035 · Alsterdorf 1,193 · Altengamme 1,035 · Altenwerder 0,915
Altona-Altstadt 1,000 · Altona-Nord 1,000 · Bahrenfeld 1,063
Barmbek-Nord 1,000 · Barmbek-Süd 1,000 · Bergedorf 1,053 · Bergstedt 1,002
Billbrook 0,914 · Billstedt 0,914 · Billwerder 1,035 · Blankenese 1,063
Borgfelde 0,952 · Bramfeld 0,956 · Cranz 0,915 · Curslack 1,035
Dulsberg 1,000 · Duvenstedt 1,002 · Eidelstedt 1,018 · Eilbek 1,000
Eimsbüttel 1,000 · Eißendorf 0,915 · Eppendorf 1,000 · Farmsen-Berne 0,956
Finkenwerder 1,147 · Francop 0,915 · Fuhlsbüttel 0,978 · Groß Borstel 1,193
Groß Flottbek 1,063 · Gut Moor 0,915 · HafenCity 1,000
Hamburg-Altstadt 1,000 · Hamm 0,952 · Hammerbrook 0,952 · Harburg 0,915
Harvestehude 1,000 · Hausbruch 0,915 · Heimfeld 0,915 · Hoheluft-Ost 1,000
Hoheluft-West 1,000 · Hohenfelde 1,000 · Horn 0,952 · Hummelsbüttel 0,978
Iserbrook 1,063 · Jenfeld 0,956 · Kirchwerder 1,035 · Kleiner Grasbrook 1,000
Langenbek 0,915 · Langenhorn 0,978 · Lemsahl-Mellingstedt 1,002
Lohbrügge 0,951 · Lokstedt 1,018 · Lurup 1,018 · Marienthal 0,956
Marmstorf 0,915 · Moorburg 0,915 · Moorfleet 1,035 · Neuallermöhe 1,035
Neuenfelde 0,915 · Neuengamme 1,035 · Neugraben-Fischbek 0,915
Neuland 0,915 · Neustadt 1,000 · Neuwerk — · Niendorf 1,018
Nienstedten 1,063 · Ochsenwerder 1,035 · Ohlsdorf 1,193 · Osdorf 1,063
Othmarschen 1,063 · Ottensen 1,000 · Poppenbüttel 0,978 · Rahlstedt 0,948
Reitbrook 1,035 · Rissen 1,063 · Rönneburg 0,915 · Rothenburgsort 0,952
Rotherbaum 1,000 · St. Georg 1,000 · St. Pauli 1,000 · Sasel 1,002
Schnelsen 1,018 · Sinstorf 0,915 · Spadenland 1,035 · Steilshoop 0,956
Steinwerder 1,000 · Stellingen 1,018 · Sternschanze 1,000 · Sülldorf 1,063
Tatenberg 1,035 · Tonndorf 0,956 · Uhlenhorst 1,000 · Veddel 1,000
Volksdorf 1,002 · Waltershof 1,000 · Wandsbek 0,956 · Wellingsbüttel 0,978
Wilhelmsburg 1,093 · Wilstorf 0,915 · Winterhude 1,000
Wohldorf-Ohlstedt 1,002
```

---

## Anwendungsrahmen

**Stichprobe: 3.556 Kauffälle** (Modernisierungspunktzahl: 3.179).

| Merkmal | Minimum | Maximum | Mittelwert |
|---|---|---|---|
| NormBRW20 [€/m²] | 250 | 7.000 | 699 |
| Sachwerthöhe [€] | 54.000 | 5.300.000 | 590.000 |
| Bodenwertanteil | 0,14 | 0,97 | 0,53 |
| Grundstücksgröße [m²] | 60 | 8.740 | 620 |
| Baujahr | 1645 | 2022 | 1970 |
| Restnutzungsdauer | 12 | 80 | 44 |
| Wohnfläche [m²] | 50 | 940 | 142 |
| Modernisierungspunktzahl | 0,00 | 20,00 | 3,98 |

Keller: 2.884 mit / 672 ohne. Ecklage: 295 mit / 2.948 ohne / 313 ohne Angabe.

**Selektionskriterien:** Verkäufe von Einfamilienhäusern ohne gewerblichen
Anteil aus den Jahren **2013 bis 2020**, keine Erbbaurechte, keine
ungewöhnlichen Verhältnisse, kein sozialer Wohnungsbau.

**Ohne Einfluss auf den Sachwertfaktor** (ausdrücklich benannt): Alter
(Kalenderjahr des Wertermittlungsstichtages − Baujahr) · Standardstufe ·
Wohnfläche/Bruttogrundfläche · Garage · Carport · Stellplatz · Pfeifenstiel ·
Wegerecht · Endenergiebedarf · Rechtsform.

---

## Der Prüfstand

**Der Bericht enthält kein Anwendungsbeispiel mit Zahlen.** Das Modell liefert
aber selbst einen Prüfmaßstab, weil **jeder Faktor seinen Normwert
ausdrücklich nennt** („bei 120 m² Wohnfläche: 1", „freistehend: 1", …).

**Prüffall 1 — das Normobjekt zum 01.01.2026:**

```
alle 18 Objektfaktoren = 1 (Normobjekt)
Aktualisierungsfaktor (01.01.2026) = 0,973

Sachwertfaktor = 0,788 × 0,973 = 0,7667
```

**Prüffall 2 — Einzelfaktoren an ihrer Normstelle:**

```
Lage:              (630 / 630) ^ 0,1902   = 1,0000
Grundstücksgröße:  (600 / 600) ^ -0,1138  = 1,0000
Wohnfläche:        (120 / 120) ^ 0,3881   = 1,0000
Bodenwertanteil:   0,67318 + 0,5447 × 0,60 = 1,00000   ← trifft auf 5 Stellen
Restnutzungsdauer: -0,0013 × 50 + 1,065   = 1,0000
```

Der Bodenwertanteilsfaktor ist die schärfste dieser Proben: die beiden
Konstanten sind so gewählt, dass sie bei genau 60 % auf **1,00000**
zusammenlaufen. Ein Tippfehler in einer der beiden Ziffern fiele sofort auf.

---

## Was zum Registereintrag noch fehlt

**Die Modellform `produkt_faktoren` gibt es im Rezeptformat noch nicht.**
Bekannt sind `matrix_kategorial`, `matrix_interp`, `matrix_band`,
`doppel_log`, `linear_sachwert`, `stufen_1d`, `konstante`,
`basiswert_additiv`, `potenz`.

Hamburg braucht ein **Produkt aus 19 Faktoren**, von denen jeder eine eigene
kleine Form hat (Potenz, Linear, Stufentabelle, Schalter, Nachschlagetabelle).
Das ist keine Variante einer bestehenden Form, sondern eine neue —
und sie wäre **die allgemeinste von allen**: die anderen Formen lassen sich
als Sonderfälle darin ausdrücken.

**Empfehlung:** `produkt_faktoren` einführen mit je Faktor einem der
Untertypen `potenz` · `linear` · `stufen` · `schalter` · `tabelle`. Dann
trägt das Format Hamburg **und** die drei Niedersachsen-Korrekturkurven mit
derselben Mechanik.

**Nicht vergessen:** Der Quellenvermerk gehört in denselben Arbeitsgang (A2).
Ohne ihn darf keine dieser Zahlen in einen Kundenbericht.

---

## Prüfergebnis (gerechnet, nicht behauptet)

Gefahren im Container (`node:22-alpine`), 13.09.2026:

```
NORMPROBEN — jeder Faktor an seiner Normstelle muss 1 ergeben
  Lagefaktor              (630/630)^0,1902     = 1,00000   OK
  Grundstücksgrößenfaktor (600/600)^-0,1138    = 1,00000   OK
  Wohnflächenfaktor       (120/120)^0,3881     = 1,00000   OK
  Bodenwertanteilsfaktor  0,67318+0,5447×0,60  = 1,00000   OK
  Restnutzungsdauerfaktor -0,0013×50+1,065     = 1,00000   OK

GEGENPROBEN — abseits der Normstelle muss es abweichen, und zwar richtig herum
  Lage bei BRW 1.000 €/m²                      = 1,0919    (bessere Lage, höher)
  Wohnfläche 200 m²                            = 1,2193    (größer, höher)
  Grundstück 1.000 m²                          = 0,9435    (größer, niedriger)
  Restnutzungsdauer 20 Jahre                   = 1,0390    (kürzer, höher)
  Bodenwertanteil 30 %                         = 0,8366    (weniger Boden, niedriger)

NORMOBJEKT zum 01.01.2026
  0,788 × 0,973 (Aktualisierungsfaktor)        = 0,7667
```

**Alle fünf Normproben treffen 1,00000 auf fünf Stellen.** Der
Bodenwertanteilsfaktor ist dabei der schärfste Beleg: seine beiden Konstanten
laufen nur dann exakt auf 1 zusammen, wenn beide richtig abgelesen sind.

Die Gegenproben gehen alle in die fachlich richtige Richtung — das schließt
Vorzeichenfehler in den Exponenten aus.
