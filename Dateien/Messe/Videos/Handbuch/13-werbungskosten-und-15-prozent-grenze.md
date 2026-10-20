# 13 · Werbungskosten im Detail, Belege, Finanzamt-PDF und die 15-%-Grenze

> Stand 20.10.2026 (Staging bis v2544). Zahlen vor der Messe live gegenprüfen.
> Video: Modul 15 „Steuer im Bestand" (`DREHBUECHER`-Schlüssel `reihe-steuer-bestand`, Studio `?modul=15`), Modul 23
> „Die 15-%-Grenze" (`reihe-15pct`, `?modul=23`) · Messe-Geschichten: 3 Gohliser (im Jahr 6 investieren), 3b Parkstr.,
> 7 Werbungskosten im Detail, 15 „Die Mappe für den Steuerberater" (design/Messe/demo-geschichten.md)

## 1 · Wozu

Im Bestand zählt nicht die Planung, sondern das Steuerjahr: Was hast du wirklich ausgegeben, was setzt du ab, und wann?
DealPilot schlägt je Jahr Werte aus deinen Eingaben vor; du überschreibst sie mit den echten Zahlen, Beleg für Beleg.
Daraus entsteht die Mappe für den Steuerberater — mit Anlage-V-Zeilen. Und DealPilot wacht über die wichtigste Grenze
der ersten drei Jahre nach dem Kauf: die 15-%-Grenze für anschaffungsnahe Herstellungskosten. Wer sie reißt, schreibt
die Sanierung über Jahrzehnte ab statt sofort.

## 2 · Wo in der App

- **Reiter Steuer → Karte „Steuerformular pro Jahr · individuelle Werte"**:
  - **Quick-Modus** — eine Zeile je Jahr: Einnahmen V+V, Schuldzinsen, AfA, Bewirtschaftung, Sonstige WK,
    Verlust/Überschuss, Steuer-Effekt. Feld anklicken zum Ändern, ↺ setzt zurück.
  - **Detail-Modus** — ein Veranlagungsjahr, gegliedert in Finanzierungs-, Betriebs-, Verwaltungs- und sonstige Kosten,
    AfA Gebäude und bewegliche Wirtschaftsgüter; je Zeile eine **Bemerkung**.
  - **„↺ Vorschläge wiederherstellen"** setzt alles zurück; Änderungen fließen in Cashflow und Steuerverlauf.
  - **Finanzamt-PDF**: unter Steuerjahr ein Jahr oder „Alle Jahre", optional Haken **Anlage V** (zweite Seite je Jahr
    nach den Zeilen der amtlichen Anlage V, Formular 2025). Auch im Reiter Deal-Aktion.
- **Reiter Steuer → „Belege & Abrechnungen einlesen (KI)"**: Ordner oder einzelne Dateien (PDF, Fotos, CSV, Excel), bis
  zu 40 Belege je Lauf; die KI liest Datum, Betrag, USt, Aussteller, Kategorie; jede Zeile bestätigen; Zeilen ohne Jahr
  werden übersprungen. CSV-Auswertung zum Herunterladen.
- **Reiter Investition → Karte Sanierung**: Gewerke schätzen, brutto oder netto wählen, Prüfung der **15-%-Grenze**
  (§ 6 Abs. 1 Nr. 1a EStG, gemessen netto); Haken **„In Steuer-Werbungskosten übernehmen"** mit Verteilung
  Automatisch (15%-Regel), 1 bis 5 Jahre (§ 82b EStDV) oder über die AfA-Nutzungsdauer. Inventar zählt nicht zur Grenze.
- **BMF-Rechner → Reiter 4 AfA-Hebel**: 15-%-Grenze mit Status Puffer / Knapp / Überschritten (siehe 12).
- **Portfolio-Cockpit → Steuer-Mappe erstellen** für alle Objekte eines Jahres (siehe 23).

## 3 · Schritt für Schritt — drei Beispiele

### a) Werbungskosten im Detail — Westerfeldstr. 140, Bielefeld, Jahr 2025

| Feld (Detail-Modus) | Wert | Bemerkung |
|---|---:|---|
| Kontoführung | 96 € | Mietkonto 8 €/Monat |
| Steuerberatung | 450 € | Anlage V anteilig |
| Porto | 35 € | |
| Telefon | 120 € | |
| Verwaltung sonstiges | 60 € | Büromaterial, Kopien |
| Fahrtkosten | 360 € | 20 Fahrten × 60 km × 0,30 € |
| Erhaltungsaufwand | 1.200 € | |
| **Summe** | **2.321 €** | ohne bewegliche Wirtschaftsgüter (250 €) |

Jede Zeile trägt ihre Herkunft. **Bewusst nicht eingetragen:** Hausverwaltung — sie steckt schon in der Bewirtschaftung.
Die Rechnung des Nutzungsdauergutachtens gehört als sonstige Kosten hinein (Betrag aus der Rechnung, nicht schätzen —
noch nicht erfasst).

### b) Die 15-%-Grenze — Ravensberger Weg 38, Bielefeld (wie in Modul 23)

| Eingabe | Wert |
|---|---|
| Sanierung | 87.000 € brutto |

**Was die App zeigt:** Grenze **138.380 € netto** (brutto 164.672 €). Die 87.000 € brutto werden um 19 % USt bereinigt →
**73.109 € maßgeblich = 52,8 %** der Grenze, Status Puffer. Mit 180.000 € läge die Sanierung bei **130,1 %** — über der
Grenze. Mit dem BMF-optimierten Gebäudeanteil (74,82 → 79,86 %) steigt die Grenze auf **147.701 €**.

### c) Im richtigen Jahr investieren — Parkstr. 9 und Gohliser Str. 42

- **Parkstr. 9, Bad Oeynhausen** (Kauf 23.12.2024): 45.000 € Sanierung 2025 (Bad, Böden, Elektro) **unter** der Grenze →
  als Erhaltungsaufwand sofort abgesetzt, Erstattung 2025 **16.458 €**. Im Modul 15 (Steuerformular 2025, Quick):
  Einnahmen 39.652 €, Schuldzinsen 25.344 €, AfA 8.947 €, Ergebnis −49.847 €, Steuer-Effekt +16.311 € (Stand der
  Aufnahme); zwei eingelesene Beispielbelege (Dachrinne 2.189,60 €, Wohngebäudeversicherung 1.386,40 €) heben die
  Bewirtschaftung von 7.757 auf 11.333 € und den Steuer-Effekt auf +17.073 €.
- **Gohliser Str. 42, Leipzig** (Kauf 23.12.2024): die Steuer aus dem Objekt steigt 2025 6.052 € · 2026 6.919 € ·
  2027 14.355 € · 2028 15.290 € — 2029 werden 40.000 € Fassade und Dach als Erhaltungsaufwand geplant → **−553 €
  (Erstattung)**; 2030 wieder 17.224 €. Deshalb 2029, nicht 2025: in den ersten drei Jahren gilt die 15-%-Grenze.
- **Westerfeldstr. 140** (Kauf 01.01.2025): Grenze rechnerisch rund **13.400 € netto** (545.000 € × 1,1227 × 14,64 % ×
  15 %) — eine einzige Wohnungssanierung für 16.000 € würde sie reißen. Deshalb Modernisierung erst ab 2028.
  **Rechnerisch, ohne Gewähr — der Steuerberater prüft.**

Belegt: a) demo-geschichten B.1 Tabelle Werbungskosten und Geschichte 7; b) Videoreihe.md „Stand 16.10.2026
nachmittags", Modul 23; c) Parkstr. Korrektur 3b und Videoreihe.md Modul 15 (Prüflauf 16.10.); Gohliser Korrektur zu
Geschichte 3 (`tax_records`); Westerfeld-Grenze demo-geschichten B.1 („Warum erst ab 2028"); Bedienung help.js
(„Werbungskosten je Jahr und Sanierung verteilen", „Finanzamt-PDF und Anlage V", „Belege einlesen (KI)").

## 4 · Was man daraus liest — Fragen am Stand

- **„Wie viel Kilometergeld setzt ihr an?"** — 0,30 € je gefahrenem Kilometer, Verpflegung 14 € ab 8 Stunden
  Abwesenheit, Hotel nur mit Beleg — so steht es in den Bemerkungen.
- **„Was ist die 15-%-Grenze?"** — Instandsetzung in den ersten drei Jahren nach dem Kauf, die netto 15 % der
  Gebäude-Anschaffungskosten übersteigt, wird zu Herstellungskosten und nur über die AfA abgeschrieben.
- **„Brutto oder netto?"** — Gemessen wird netto; trägst du brutto ein, bereinigt DealPilot die 19 % USt.
- **„Was bekommt mein Steuerberater?"** — Das Finanzamt-PDF je Jahr, auf Wunsch mit Anlage-V-Zeilen, oder die
  Steuer-Mappe über alle Objekte.
- **„Und eine Küche?"** — Als bewegliches Wirtschaftsgut über zehn Jahre, getrennt vom Gebäude.

## 5 · Grenzen und Kennzeichnung

- **DealPilot ist eine Rechenhilfe, keine Steuerberatung** (§ 6 StBerG).
- Die Anlage-V-Zeilen stammen aus dem Formular 2025; für spätere Jahre nimmt DealPilot das jüngste vorhandene Formular
  und sagt das in Rot auf der Seite. Eine GmbH hat keine Anlage V.
- Belege liest eine KI; jede Zeile wird von dir bestätigt. Die WEG-Rücklagenzuführung wird erkannt, aber nicht als
  Werbungskosten übernommen.
- Einige Demo-Jahre sind noch unplausibel (Gohliser, Parkstr., Musterstr. 2024 mit vollen Jahreswerten bei Kauf am
  23.12.2024) — am Stand 2025 ff. zeigen.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Steuerformular, Quick | Jahr 2025 | Eine Zeile je Jahr: Einnahmen, Zinsen, AfA, Bewirtschaftung — DealPilot schlägt vor, du überschreibst mit dem Bescheid. |
| 2 | Detail-Modus | Modus „Detail" | Jede Kostenart einzeln, mit Bemerkung: zwanzig Fahrten mal sechzig Kilometer mal dreißig Cent. |
| 3 | Belege einlesen | Beispielbelege wählen | Rechnungen und Abrechnungen einlesen — die KI liest Betrag und Kategorie, du bestätigst jede Zeile. |
| 4 | Ergebnis nach Übernahme | „Übernehmen" | Bewirtschaftung und Steuer-Effekt ändern sich sofort — hier von 16.311 auf 17.073 Euro. |
| 5 | Reiter Investition, Sanierung | Betrag brutto | Die 15-%-Grenze der ersten drei Jahre, gemessen netto. Hier 52,8 Prozent — Puffer. |
| 6 | Sanierung 180.000 € | Betrag ändern | 130 Prozent: über der Grenze. Dann wird die Sanierung über die AfA abgeschrieben, nicht sofort. |
| 7 | Finanzamt-PDF | Haken Anlage V, PDF | Das Finanzamt-PDF je Jahr, auf Wunsch mit den Zeilen der Anlage V — die Mappe für den Steuerberater. |

### Sprechertext (Entwurf, ca. 110 Sekunden)

Im Bestand zählt das echte Steuerjahr. Im Steuerformular schlägt DealPilot für jedes Jahr Werte aus deinen Eingaben
vor: Einnahmen, Zinsen, Abschreibung, Bewirtschaftung. Du überschreibst sie mit den Zahlen aus dem Bescheid.
Im Detail-Modus steht jede Kostenart einzeln — und jede Zeile hat eine Bemerkung, woher sie kommt. Zum Beispiel:
zwanzig Fahrten, sechzig Kilometer, dreißig Cent. Belege musst du nicht abtippen. DealPilot liest Rechnungen und
Abrechnungen ein, du bestätigst jede Zeile — und Bewirtschaftung und Steuer-Effekt ändern sich sofort.
Dann die wichtigste Grenze der ersten drei Jahre: fünfzehn Prozent. Wer in dieser Zeit mehr saniert, schreibt die Kosten
über Jahrzehnte ab statt sofort. DealPilot misst das netto und zeigt, wie viel Luft bleibt. Deshalb plant man große
Maßnahmen oft bewusst nach dem dritten Jahr — genau dann, wenn die Steuerlast steigt.
Am Ende steht das Finanzamt-PDF, auf Wunsch mit den Zeilen der Anlage V. Das ist die Mappe, die dein Steuerberater haben
will. Die Beratung selbst bleibt bei ihm.

## Querverweise

05 Investition (Sanierung) · 10 Steuer-Grundlagen · 12 BMF-Kaufpreisaufteilung · 14 Steuerverlauf mit Wendepunkt ·
22 Bestand Soll/Ist · 23 Portfolio-Cockpit (Steuer-Mappe) · 27 Import (Dokument einlesen).
