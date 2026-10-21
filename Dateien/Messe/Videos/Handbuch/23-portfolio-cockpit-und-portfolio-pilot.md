# 23 · Portfolio-Cockpit, Portfolio-Pilot, Bankexport und Track Record

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 21 · Portfolio-Cockpit und Pilot (`reihe-cockpit`, `?modul=21`, 2:55) und Modul 20 · Bankexport Portfolio (`reihe-bankexport`, `?modul=20`, 1:38) ·
> Messe-Geschichten: Übersicht „Welche Geschichte für welchen Besucher" — Kapitalanleger mit Bestand (design/Messe/demo-geschichten.md)

## 1 · Wozu

Das Cockpit ist der Blick auf die ganze Flotte: ein **Portfolio Score**, Mieteinnahmen, Investition, Cashflow, Steuer über alle Objekte und eine Projektion über 10, 20 oder 30 Jahre. Der **Portfolio-Pilot** beantwortet Fragen über alle Objekte — „Wo steckt das meiste Potenzial?" —, ohne selbst etwas nachzurechnen. Für die Bank gibt der **Bankexport** alle Darlehen auf einen Blick aus, der **Track Record** zeigt deine gewonnenen Deals als Nachweis.

## 2 · Wo in der App

- **Seitenleiste → Aktionen → Ansichten → Portfolio-Cockpit.** Abschnitte (seit v2410 ohne Kanban-Board): **01 Portfolio Score · 02 Kennzahlen · 03 Geteilte Objekte · 04 Steuer über alle Objekte · 05 Projektion & Verlauf · 06 Gesamt-Projektion · 07 Steuer-Mappe · 08 Jahresabschluss** (nur mit angelegter GmbH/UG). Oben rechts „Objekt": „Alle Objekte" oder ein einzelnes gewonnenes Objekt; im Pro-Plan Filter je Halter.
  > Hinweis: Die Hilfe (`help.js`) nummeriert die Texte innen teils noch mit 05–09 (vor v2410). Am Stand die Überschriften im Bild vorlesen.
- **Portfolio-Pilot:** im Cockpit (Block `#dp-pp`), mit und ohne Web-Recherche; Werkzeug `potenzial_lesen` liefert die Rangliste nach Wertzuwachs.
- **Bankexport:** Aktionen → Ausgeben → **Bankexport** — alle Darlehen im Format „AuswertungBank" (Bank, Darlehenssumme, Zins, Tilgung, Zinsbindung, aktuelle Restschuld …), je Darlehen per Häkchen abwählbar; Ausgabe CSV, Excel oder PDF.
- **Track Record:** Aktionen → Ausgeben → **Track Record** (oder Deal-Aktion → PDFs). Ohne Haken „Alle Objekte anzeigen" nur gewonnene Deals; Karte anklicken = Einzel-PDF, unten Sammel-PDF.

## 3 · Schritt für Schritt — Beispiel Demo-Konto (11 Objekte)

| Schritt | Klick | Was die App zeigt (gemessen im Modul 21/20 am 16.10. — vor der Befüllung vom 20.10.; Portfolio-Zahlen live zeigen) |
|---|---|---|
| 1 | Aktionen → Portfolio-Cockpit | **01 Portfolio Score 69 · Solide**, 11 Objekte, Kaufpreise **6,38 Mio. €** |
| 2 | 02 Kennzahlen, Kachel Bestand ⇄ | Mieteinnahmen **28.675 € / Monat** (netto kalt) |
| 3 | Kachel Cashflow ⇄ | **+1.920 € / Monat** |
| 4 | Zweite Reihe (ab Investor) | DSCR **1,28** — derselbe Wert wie in der Portfolio-Analyse (v2352; vorher 0,87) |
| 5 | 04 Steuer über alle Objekte | Je Objekt Ergebnis V+V, Basis vorher/nachher, Steuerwirkung, Grenzsatz davor → danach; in Kaufreihenfolge. Zahl live zeigen |
| 6 | 05 Projektion & Verlauf, 10/20/30 J. | Sieben Grafiken: Cashflow-Verlauf, Vermögens-Schere, Vermögensbilanz, Mittelverwendung, Wealth-Stacks, Klumpenrisiko, Steuer-Verlauf |
| 7 | 07 Steuer-Mappe | Jahr wählen, „Anlage-V-Zuordnung anhängen", Steuer-Mappe erstellen (PDF über alle Objekte) |
| 8 | Portfolio-Pilot: „Wo steckt das meiste Potenzial?" | Rangliste der Objekte mit Plan nach Wertzuwachs (aus den gespeicherten Wertpotenzialen). Antwort live zeigen |
| 9 | Aktionen → Bankexport | **11 / 11 Objekte mit Darlehen, 11 Darlehen**, Kaufpreise **6.382.000 €**, Restschuld **5.238.404 €** |

So rechnet der Portfolio Score: nur Objekte mit Status Gewonnen und gespeichertem Score; je Objekt zählt der Investor Deal Score, sonst der DealPilot Score; der Gesamtwert ist **nach Kaufpreis gewichtet** — ein großes Objekt zählt mehr. Die fünf Balken darunter (Rendite, Finanzierung, Risiko & Vermietung, Lage & Diversifikation, Upside-Potenzial) entstehen genauso.

**Belegt:** Schritte 1–4 aus Videoreihe.md, Abschnitt „Stand 16.10.2026 nachmittags" (Modul 21: 69 · Solide, 11 Objekte, 6,38 Mio €, +1.920 €/Monat, Mieten 28.675 €/Monat) und „Neu aufgenommen 16.10.2026 spät" (DSCR 1,28); Schritt 9 aus Modul 20 ebendort. Abschnitte aus `help.js` („Aufbau", „Portfolio Score", „Kennzahlen", „Steuer über alle Objekte", „Projektion", „Steuer-Mappe") und Journal v2410 (Kanban raus). Rangliste: Journal v2430 (`potenzial_lesen`, „13 Objekte mit Plan" im Container). Seit der Befüllung vom 20.10. haben sich Objekte geändert (Am Markt 18 und Alexanderstr. jetzt Bestand, neue Werbungskosten, Westerfeld 6 WE) — Portfolio-Zahlen live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Warum 69 und nicht der Durchschnitt meiner Scores?"** — Gewichtet nach Kaufpreis. Ein Haus für 1,15 Mio. € prägt das Portfolio mehr als eine Wohnung für 110.000 €.
- **„Rechnet der Portfolio-Pilot selbst?"** — Nein. Er liest die Zahlen, die die Rechenkerne gespeichert haben, und erklärt sie. So widerspricht er nie der App.
- **„Was nehme ich mit zur Bank?"** — Den Bankexport (alle Darlehen, Restschulden) und den Track Record als Sammel-PDF.
- **„Wie genau ist die Projektion?"** — Sie ist als **Modellprojektion (vereinfacht)** gekennzeichnet: pauschal +1,5 % Miete, +2,0 % Bewirtschaftung, +2,0 % Wert, AfA 2 % bei 80 % Gebäudeanteil. Die genaue Rechnung steht im einzelnen Objekt.

## 5 · Grenzen und Kennzeichnung

- Portfolio Score und Kennzahlen nur über **gewonnene** Objekte; ohne gespeicherten Score: „Noch kein gewonnenes Objekt mit berechnetem Score."
- Projektion & Verlauf / Gesamt-Projektion: Modellannahmen, nicht die Objektrechnung.
- Steuer-Mappe und Jahresabschluss: Zahlen und Gliederung, **keine Steuerberatung** und **kein aufgestellter Jahresabschluss nach §§ 242 ff. HGB**.
- Portfolio-Analyse des Piloten ist KI-gestützt; maßgeblich sind die Zahlen der App.
- Bankexport zeigt, was in den Objekten steht — keine Bankauskunft.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Seitenleiste, Aktionen | Portfolio-Cockpit | Das Cockpit: alle gewonnenen Objekte in einer Ansicht. |
| 2 | 01 Portfolio Score, Ring | — | Ein Score fürs ganze Portfolio — nach Kaufpreis gewichtet, mit fünf Teilbalken. |
| 3 | 02 Kennzahlen | Kachel Cashflow ⇄ | Kacheln mit Umschalter: vor oder nach Steuer, mit oder ohne Nebenkosten. |
| 4 | 04 Steuer über alle Objekte | — | Jedes Objekt trifft auf das Einkommen, das die vorherigen schon verschoben haben. |
| 5 | 05 Projektion, 20 J. | Zeitraum 20 J. | Vermögens-Schere, Klumpenrisiko, Steuer-Verlauf — als vereinfachte Modellprojektion gekennzeichnet. |
| 6 | Portfolio-Pilot | Frage „Wo steckt das meiste Potenzial?" | Der Portfolio-Pilot kennt alle Objekte und rechnet nichts nach — er liest die gespeicherten Zahlen. |
| 7 | Bankexport | Liste, Häkchen | Alle Darlehen für die Bank: Summe, Zins, Bindung, Restschuld — als CSV, Excel oder PDF. |

### Sprechertext (Entwurf, ca. 95 Sekunden)

Ein Objekt ist ein Flug. Das Portfolio ist die Flotte — und dafür gibt es das Cockpit.

Ganz oben der Portfolio Score. Er fasst alle gewonnenen Objekte zusammen, gewichtet nach Kaufpreis: Ein großes Haus zählt mehr als eine kleine Wohnung. Im Demo-Konto stehen elf Objekte für zusammen sechs Komma vier Millionen Euro, mit einem Score von neunundsechzig — solide.

Darunter die Kennzahlen: Mieteinnahmen, Investition, Rendite und Cashflow, jeweils per Klick vor oder nach Steuer. Die Steuer rechnet DealPilot über alle Objekte in der Reihenfolge ihres Kaufs — jedes trifft auf das Einkommen, das die anderen schon verschoben haben.

Die Projektion zeigt Trend und Größenordnung über zehn, zwanzig oder dreißig Jahre. Sie ist ausdrücklich vereinfacht; genau gerechnet wird im einzelnen Objekt.

Und dann der Portfolio-Pilot. Frag ihn: Wo steckt das meiste Potenzial? Er kennt jedes Objekt — und rechnet nichts nach. Er liest, was die Rechenkerne gespeichert haben.

Für die Bank gibt es den Bankexport: alle Darlehen, Zinsen, Bindungen und Restschulden auf einer Liste.

## Querverweise

- Handbuch 22 (Bestand Soll/Ist), 15 (Deal Score), 16 (Pilot-Analyse), 13 (Steuer-Mappe/Anlage V), 29 (Jahresabschluss GmbH), 20 (PDFs), 27 (Export, Portfolio-CSV)
- Videoreihe.md Module 20, 21 · `messe-drehbuch.js` `DREHBUECHER['reihe-cockpit']` (Z. 4606), `DREHBUECHER['reihe-bankexport']` (Z. 4559)
