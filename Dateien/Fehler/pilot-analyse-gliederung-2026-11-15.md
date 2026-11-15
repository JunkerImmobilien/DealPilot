# Pilot-Analyse · Gliederung je Unterreiter (Staging v3420, 15.11.2026)

Gemessen auf app.staging.dealpilot.immo, Commit e16d1123, eigene Headless-Chrome-Instanz bei **1280 px** (innerWidth 1264).
Ausgelesen im DOM, nur sichtbare Elemente, in Dokumentreihenfolge. Titel = `.dp-pa-sec` (sonst `.dp-pa-lbl`), `.dp-wz-h`, `.abw-kopf`, `h2`–`h5`,
`.dp-ja-kk > b`, `.dp-ja-urteil`, `.dp-ja-satz`; Navigation = `[data-dp-si-sprung]`; Kacheln = Beschriftungen aus `.dp-pa4-z > span`, `.dp-pa4-wk > small`, `span.t`.
**Höhe** = Höhe des umgebenden Blocks (`.dp-pa-card`, `.abw-tafel-host`, `.dp-ja-karte` …, sonst Elternelement) bzw. der Tabelle; „Reiter gesamt“ = Höhe des aktiven Panels.
Einfach/Detail = Umschalter `[data-dp-pa-modus-knopf]` der Pilot-Analyse. **Einfach/Genau in „Ankauf · … · Zielbild“ folgt diesem Umschalter**: der eigene Umschalter `.dp-si-um` ist in beiden Modi ausgeblendet (gemessen `display` 0×0); Einfach zeigt die Einfach-Fassung (`data-dp-si-modus="einfach"`), Detail die Genau-Fassung mit der Sprungleiste.
Hinweis: steht ein Titel zweimal mit gleicher Blockhöhe direkt untereinander (z. B. „Ankauf gegen Bestand“ 974 px), ist es eine verschachtelte Überschrift (`.abw-kopf` mit Titel darin), sichtbar einmal.
Zahlen der Testobjekte nur dort, wo sie zur Zuordnung nötig sind. Keine Anschriften.

## Bestandsobjekt (MFH, 6 Wohnungen, gewonnen, Ankauf-Stand 01.01.2025, Testkonto Partnerplatz)

### Einfach

#### Jahresabgleich · Reiter gesamt 1839 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | 2025: 1 von 4 Schritten erledigt | 45 |  |
| 2 | Titel | Miete −1.220 € unter dem Plan vom Kauf. Offen: Steuer, Wert, Haus. | 45 |  |
| 3 | Titel | Miete 2025 | 222 |  |
| 4 | Titel | Steuer 2025 | 222 |  |
| 5 | Titel | Wert 2025 | 204 |  |
| 6 | Titel | Haus 2025 | 204 |  |
| 7 | Titel | Kauf gegen heute · 2025 | 283 |  |
| 8 | Tabelle | Spalten: Kennzahl · Plan vom Kauf · Ist · Abweichung<br>Zeilen: Kaltmiete im Jahr · Cashflow vor Steuer mit der Ist-Miete gerechnet · Ergebnis V+V · Sonderumlage · Wert laut Marktbericht · Restschuld | 193 |  |
| 9 | Titel | JAHR FÜR JAHR: PLAN GEGEN IST | 923 |  |
| 10 | Tabelle | Spalten: Jahr · Kaltmiete Plan · Kaltmiete Ist · Cashflow v. St. Plan · Restschuld Plan · Ist · Steuer V+V · Ziel · Wert · <br>Zeilen: 2026laufend · In der Anlage V steht für 2026 noch der Vorschlag (39.420 €) · 2025 | 236 |  |

#### Übersicht · Reiter gesamt 867 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Kacheln | Kaufpreis (Ankauf) · Cashflow vor Steuer · volles Jahr · DSCR · Investor Deal Score |  |  |
| 2 | Titel | Was du jetzt tun kannst | 216 |  |
| 3 | Titel | Wohin es läuft · Vermögen aus dem Objekt | 356 |  |
| 4 | Kacheln | Risiken & Szenarien · Lage & Markt · Potenzialanalyse |  |  |

#### Ankauf · Bestand · Zielbild (Einfach-Fassung) · Reiter gesamt 938 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Wohin es läuft · Miete und Cashflow je Monat | 259 |  |
| 2 | Kacheln | Kaltmiete im Jahr · Zielbild 2030 · Bruttomietrendite · Zielbild 2030 · Ertragswert · Zielbild 2030 · Maßnahmen · Wertzuwachs nach Kosten · Marktpreisindikation heute |  |  |

#### Wert & Lage · Reiter gesamt 809 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Wert im Jahresabgleich | 121 |  |
| 2 | Kacheln | Plan-Wert 2026 · Restschuld 2026 |  |  |
| 3 | Titel | LAGE & MARKT | 155 |  |

#### Steuer · Reiter gesamt 1045 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Steuerverlauf · wann das Objekt steuerlich positiv wird | 588 |  |
| 2 | Titel | Steuerliche Zusammenfassung | 112 |  |
| 3 | Titel | Steuerlich: Ankauf gegen heute | 126 |  |
| 4 | Titel | Belege | 178 |  |

#### Haus & Unterlagen · Reiter gesamt 175 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Unterlagen & WEG | 175 |  |

#### Potenzial & Exit · Reiter gesamt 2693 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Was in dem Objekt steckt · Kaltmiete je Monat | 193 |  |
| 2 | Titel | Deine Hebel | 187 |  |
| 3 | Titel | Was rechtlich gilt | 128 |  |
| 4 | Titel | Was der Pilot dazu sagt | 134 |  |
| 5 | Titel | STÄRKEN | 295 |  |
| 6 | Titel | RISIKEN | 295 |  |
| 7 | Titel | Szenarien · Worst · Plan · Best | 217 |  |
| 8 | Titel | Worst Case | 217 |  |
| 9 | Titel | PlanVorschlag | 217 |  |
| 10 | Titel | Best Case | 217 |  |
| 11 | Titel | ANSCHLUSSFINANZIERUNG | 1234 |  |
| 12 | Tabelle | Spalten: Anschlusszins · Rate/Monat · Mehr/Monat · Cashflow v. St./Monat · DSCR<br>Zeilen: 3,00 % · 4,00 % · 4,18 %Marktzins heute (indikativ) · 5,00 %deine Annahme im Reiter Finanzierung | 176 |  |
| 13 | Titel | PILOT: FRAGEN ZUR ANSCHLUSSFINANZIERUNG | 125 |  |
| 14 | Titel | ARGUMENTE FÜR DIE BANK | 189 |  |
| 15 | Titel | EXIT-STRATEGIEN | 1234 |  |
| 16 | Tabelle | Spalten: Kaufdatum · 01.01.2025<br>Zeilen: Kaufdatum · Ende der Zehnjahresfrist (§ 23 EStG) · Marktpreisindikation · Gesamtinvestition (Kaufpreis 545.000 € + Nebenkosten) · Wertzuwachs gegen Gesamtinvestition · Restschuld Ende 2026 laut Projektion · Netto-Erlös vor Steuer (Marktpreis − Restschuld) · Beleihungsspielraum bei 80 % des Marktpreises | 237 |  |
| 17 | Titel | PILOT: FRAGEN ZUM EXIT | 125 |  |

### Detail

#### Jahresabgleich · Reiter gesamt 1844 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | 2025: 1 von 4 Schritten erledigt | 45 |  |
| 2 | Titel | Miete −1.220 € unter dem Plan vom Kauf. Offen: Steuer, Wert, Haus. | 45 |  |
| 3 | Titel | Miete 2025 | 222 |  |
| 4 | Titel | Steuer 2025 | 222 |  |
| 5 | Titel | Wert 2025 | 204 |  |
| 6 | Titel | Haus 2025 | 204 |  |
| 7 | Titel | Kauf gegen heute · 2025 | 283 |  |
| 8 | Tabelle | Spalten: Kennzahl · Plan vom Kauf · Ist · Abweichung<br>Zeilen: Kaltmiete im Jahr · Cashflow vor Steuer mit der Ist-Miete gerechnet · Ergebnis V+V · Sonderumlage · Wert laut Marktbericht · Restschuld | 193 |  |
| 9 | Titel | JAHR FÜR JAHR: PLAN GEGEN IST | 928 |  |
| 10 | Tabelle | Spalten: Jahr · Kaltmiete Plan · Kaltmiete Ist · Cashflow v. St. Plan · Restschuld Plan · Ist · Steuer V+V · Ziel · Wert · <br>Zeilen: 2026laufend · In der Anlage V steht für 2026 noch der Vorschlag (39.420 €) · 2025 | 249 |  |

#### Übersicht · Reiter gesamt 1486 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Kacheln | Kaufpreis (Ankauf) · Cashflow vor Steuer · volles Jahr · DSCR · Investor Deal Score |  |  |
| 2 | Titel | Einordnung und Strategie | 1026 |  |
| 3 | Titel | Einordnung | 1026 |  |
| 4 | Titel | Investmentbewertung | 1026 |  |
| 5 | Titel | Bestandsstrategie · was du jetzt tun kannst | 1026 |  |
| 6 | Titel | DealPilot-Insight | 1026 |  |
| 7 | Kacheln | Risiken & Szenarien · Lage & Markt · Potenzialanalyse |  |  |

#### Ankauf · Bestand · Zielbild (Genau-Fassung) · Reiter gesamt 3156 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Sprung | Ist · Mieterhöhung · Zielbild |  |  |
| 2 | Sprung | Marktpreise |  |  |
| 3 | Sprung | Ankauf gegen Bestand |  |  |
| 4 | Sprung | Pilot beim Ankauf |  |  |
| 5 | Titel | ANKAUF · BESTAND · ZIELBILD | 740 |  |
| 6 | Tabelle | Spalten: Kennzahl · Ankauf 2025 · Bestand heute · Zielbild 2030 · nach Umbau<br>Zeilen: Miete & Rendite · Kaltmiete p. a. · Bruttomietrenditeauf Kaufpreis + Maßnahmen · Cashflow / Monatvor Steuer · DSCR · Maßnahmenkosten · ModernisierungspunkteAnlage 2 ImmoWertV | 324 |  |
| 7 | Titel | ZIELERREICHUNG | 943 |  |
| 8 | Titel | Jahresstände | 943 |  |
| 9 | Tabelle | Spalten: Kennzahl · Ankauf01.01.2025 · Stand ? · 202615.11.2026 · v3401 · heutelive · v3401<br>Zeilen: Nettokaltmiete / Monat · Jahresmiete · Cashflow v. Steuer p. a. · Cashflow n. Steuer p. a. · DSCR · LTV · DealScore · Restschuld (Projektion) · · Darlehen 1 · · Darlehen 2 · Ziel: Kaltmiete / Monat · Zielbild | 402 |  |
| 10 | Titel | Ankauf gegen Bestand eingefrorener Stand gegen heuteAnkauf-Stand vom 01.01.2025 | 974 |  |
| 11 | Titel | Ankauf gegen Bestand eingefrorener Stand gegen heute | 974 |  |
| 12 | Tabelle | Spalten: Kennzahl · Ankauf · Bestand · Abweichung<br>Zeilen: Ertrag · Nettokaltmiete · Miete je m² · Leere Einheiten · Kosten · Nicht umlagefähige Kosten p. a. · Instandhaltung p. a. · Finanzierung · Kaufpreis · DSCR · LTV · Zinssatz · Steuer · Steuerwirkung p. a. · Gebäudeanteil (AfA-Basis) · AfA-Satz · Ergebnis · Bruttomietrendite · Cashflow n. Steuer · DealScore · Cashflow v. Steuer | 646 |  |
| 13 | Titel | PILOT BEIM ANKAUF | 349 |  |

#### Wert & Lage · Reiter gesamt 2239 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Wert im Jahresabgleich | 143 |  |
| 2 | Kacheln | Plan-Wert 2026 · Restschuld 2026 |  |  |
| 3 | Titel | LAGE & MARKT | 1478 |  |
| 4 | Titel | GEGENÜBERSTELLUNG | 993 |  |

#### Steuer · Reiter gesamt 1980 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Steuerverlauf · wann das Objekt steuerlich positiv wird | 731 |  |
| 2 | Titel | Steuerliche Zusammenfassung | 314 |  |
| 3 | Titel | Steuerlich: Ankauf gegen heute | 126 |  |
| 4 | Titel | Belege | 228 |  |
| 5 | Titel | Einnahmen und Werbungskosten nach Gruppen | 525 |  |
| 6 | Tabelle | Spalten: Jahr · 2025 · 2026 · 2027 · 2028 · 2029 · 2036Wendepunkt · 2044<br>Zeilen: Einnahmen · Kaltmiete · umgelegte Nebenkosten · Werbungskosten · Finanzierung · Betriebskosten · Verwaltung · Sonstiges · AfA · Erhaltung und anschaffungsnah · Ergebnis Anlage V · Steuerwirkung | 371 |  |

#### Haus & Unterlagen · Reiter gesamt 175 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Unterlagen & WEG | 175 |  |

#### Potenzial & Exit · Reiter gesamt 5470 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Was in dem Objekt steckt · Kaltmiete je Monat | 193 |  |
| 2 | Titel | Deine Hebel | 187 |  |
| 3 | Titel | Was rechtlich gilt | 147 |  |
| 4 | Titel | Was der Pilot dazu sagt | 213 |  |
| 5 | Titel | So ist gerechnet | 459 |  |
| 6 | Titel | Je Wohnung | 259 |  |
| 7 | Tabelle | Spalten: Wohnung · Fläche · Ist · nach § 558 · Zielbild · Maßnahmen · Wann<br>Zeilen: Nr. 1 · EG links · Nr. 2 · EG rechts · Nr. 3 · 1. OG links · Nr. 4 · 1. OG rechts · Nr. 5 · DG links · Nr. 6 · DG rechts | 197 |  |
| 8 | Titel | STÄRKEN | 477 |  |
| 9 | Titel | RISIKEN | 477 |  |
| 10 | Titel | Risikoanalyse | 578 |  |
| 11 | Titel | Szenarien · Worst · Plan · Best | 557 |  |
| 12 | Titel | Worst Case | 557 |  |
| 13 | Titel | PlanVorschlag | 557 |  |
| 14 | Titel | Best Case | 557 |  |
| 15 | Titel | ANSCHLUSSFINANZIERUNG | 2054 |  |
| 16 | Tabelle | Spalten: Anschlusszins · Rate/Monat · Mehr/Monat · Cashflow v. St./Monat · DSCR<br>Zeilen: 3,00 % · 4,00 % · 4,18 %Marktzins heute (indikativ) · 5,00 %deine Annahme im Reiter Finanzierung | 176 |  |
| 17 | Titel | PILOT: FRAGEN ZUR ANSCHLUSSFINANZIERUNG | 538 |  |
| 18 | Titel | ARGUMENTE FÜR DIE BANK | 257 |  |
| 19 | Titel | EXIT-STRATEGIEN | 2054 |  |
| 20 | Tabelle | Spalten: Kaufdatum · 01.01.2025<br>Zeilen: Kaufdatum · Ende der Zehnjahresfrist (§ 23 EStG) · Marktpreisindikation · Gesamtinvestition (Kaufpreis 545.000 € + Nebenkosten) · Wertzuwachs gegen Gesamtinvestition · Restschuld Ende 2026 laut Projektion · Netto-Erlös vor Steuer (Marktpreis − Restschuld) · Beleihungsspielraum bei 80 % des Marktpreises | 237 |  |
| 21 | Titel | PILOT: FRAGEN ZUM EXIT | 464 |  |

## Ankauf-Objekt (MFH, 8 Wohnungen, nicht gewonnen, Testkonto Partnerplatz)

### Einfach

#### Übersicht · Reiter gesamt 699 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Kacheln | Kaufpreis · Cashflow vor Steuer · volles Jahr · DSCR · Investor Deal Score |  |  |
| 2 | Titel | Wohin es läuft · Vermögen aus dem Objekt | 356 |  |
| 3 | Kacheln | Risiken & Szenarien · Lage & Markt · Potenzialanalyse |  |  |

#### Ankauf · Soll · Zielbild (Einfach-Fassung) · Reiter gesamt 765 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Wohin es läuft · Miete und Cashflow je Monat | 259 |  |
| 2 | Kacheln | Kaltmiete im Jahr · Zielbild · Bruttomietrendite · Zielbild · Ertragswert · Zielbild · Maßnahmen · Wertzuwachs nach Kosten · Marktpreisindikation heute |  |  |

#### Wert & Lage · Reiter gesamt 945 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Was ist das Objekt wert? | 143 |  |
| 2 | Kacheln | Plan-Wert 2026 · Restschuld 2026 |  |  |
| 3 | Titel | Wohin es läuft · Lage laut Marktbewertung | 58 |  |
| 4 | Titel | LAGE & MARKT | 268 |  |

#### Kaufpreis & Offerte · Reiter gesamt 495 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | VERHANDLUNG & OFFERTE | 495 |  |
| 2 | Titel | VERHANDLUNGSEMPFEHLUNG | 118 |  |
| 3 | Titel | KAUFPREIS-OFFERTE | 331 |  |

#### Finanzierung & Bank · Reiter gesamt 242 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | BANK | 242 |  |
| 2 | Titel | BANKARGUMENTE | 210 |  |

#### Steuer · Reiter gesamt 872 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Steuerverlauf · wann das Objekt steuerlich positiv wird | 588 |  |
| 2 | Titel | Steuerliche Zusammenfassung | 112 |  |
| 3 | Titel | Belege | 145 |  |

#### Haus & Unterlagen · Reiter gesamt 858 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Was absehbar Geld kostet | 700 |  |
| 2 | Titel | Investitionsthese | 700 |  |
| 3 | Titel | Begrenzte Mietsteigerungsmöglichkeiten durch unbefristete Verträge | 700 |  |
| 4 | Titel | Bestandsmieten meist unter Marktniveau | 700 |  |
| 5 | Titel | Energieeffizienzklasse D | 700 |  |
| 6 | Titel | Neue Unterlagen | 145 |  |

#### Potenzial & Risiken · Reiter gesamt 1177 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Was in dem Objekt steckt · Kaltmiete je Monat | 169 |  |
| 2 | Titel | Was rechtlich gilt | 128 |  |
| 3 | Titel | Was der Pilot dazu sagt | 134 |  |
| 4 | Titel | STÄRKEN | 274 |  |
| 5 | Titel | RISIKEN | 274 |  |
| 6 | Titel | Szenarien · Worst · Plan · Best | 217 |  |
| 7 | Titel | Worst Case | 217 |  |
| 8 | Titel | PlanVorschlag | 217 |  |
| 9 | Titel | Best Case | 217 |  |

### Detail

#### Übersicht · Reiter gesamt 1416 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Kacheln | Kaufpreis · Cashflow vor Steuer · volles Jahr · DSCR · Investor Deal Score |  |  |
| 2 | Titel | Begründung und Einordnung | 977 |  |
| 3 | Titel | Begründung des Urteils | 977 |  |
| 4 | Titel | Investmentbewertung | 977 |  |
| 5 | Titel | Zu welchem Anleger der Kauf passt | 977 |  |
| 6 | Titel | DealPilot-Insight | 977 |  |
| 7 | Kacheln | Risiken & Szenarien · Lage & Markt · Potenzialanalyse |  |  |

#### Ankauf · Soll · Zielbild (Genau-Fassung) · Reiter gesamt 725 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Sprung | Ist · Mieterhöhung · Zielbild |  |  |
| 2 | Sprung | Marktpreise |  |  |
| 3 | Titel | ANKAUF · BESTAND · ZIELBILD | 659 |  |
| 4 | Tabelle | Spalten: Kennzahl · Bestand 2025 · Zielbild Jahr offen · nach Umbau<br>Zeilen: Miete & Rendite · Kaltmiete p. a. · Bruttomietrenditeauf Kaufpreis + Maßnahmen · Cashflow / Monatvor Steuer · DSCR | 244 |  |

#### Wert & Lage · Reiter gesamt 2308 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Was ist das Objekt wert? | 143 |  |
| 2 | Kacheln | Plan-Wert 2026 · Restschuld 2026 |  |  |
| 3 | Titel | LAGE & MARKT | 1546 |  |
| 4 | Titel | GEGENÜBERSTELLUNG | 1019 |  |

#### Kaufpreis & Offerte · Reiter gesamt 795 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | VERHANDLUNG & OFFERTE | 795 |  |
| 2 | Titel | VERHANDLUNGSEMPFEHLUNG | 241 |  |
| 3 | Titel | KAUFPREIS-OFFERTE | 508 |  |

#### Finanzierung & Bank · Reiter gesamt 310 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | BANK | 310 |  |
| 2 | Titel | BANKARGUMENTE | 278 |  |

#### Steuer · Reiter gesamt 1785 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Steuerverlauf · wann das Objekt steuerlich positiv wird | 731 |  |
| 2 | Titel | Steuerliche Zusammenfassung | 292 |  |
| 3 | Titel | Belege | 195 |  |
| 4 | Titel | Einnahmen und Werbungskosten nach Gruppen | 525 |  |
| 5 | Tabelle | Spalten: Jahr · 2025 · 2026 · 2027Wendepunkt · 2028 · 2029 · 2039<br>Zeilen: Einnahmen · Kaltmiete · umgelegte Nebenkosten · Werbungskosten · Finanzierung · Betriebskosten · Verwaltung · Sonstiges · AfA · Erhaltung und anschaffungsnah · Ergebnis Anlage V · Steuerwirkung | 371 |  |

#### Haus & Unterlagen · Reiter gesamt 1189 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Neue Unterlagen | 145 |  |

#### Potenzial & Risiken · Reiter gesamt 3181 px

| # | Art | Inhalt | Höhe px | auch in |
|---|---|---|---|---|
| 1 | Titel | Was in dem Objekt steckt · Kaltmiete je Monat | 169 |  |
| 2 | Titel | Was rechtlich gilt | 147 |  |
| 3 | Titel | Was der Pilot dazu sagt | 191 |  |
| 4 | Titel | So ist gerechnet | 219 |  |
| 5 | Titel | Je Wohnung | 315 |  |
| 6 | Tabelle | Spalten: Wohnung · Fläche · Ist · nach § 558 · Zielbild · Maßnahmen · Wann<br>Zeilen: Nr. 1 · EG links · Nr. 2 · EG rechts · Nr. 3 · 1. OG links · Nr. 4 · 1. OG rechts · Nr. 5 · 2. OG links · Nr. 6 · 2. OG rechts · Nr. 7 · DG links · Nr. 8 · DG rechts | 253 |  |
| 7 | Titel | STÄRKEN | 539 |  |
| 8 | Titel | RISIKEN | 539 |  |
| 9 | Titel | Risikoanalyse | 556 |  |
| 10 | Titel | Szenarien · Worst · Plan · Best | 557 |  |
| 11 | Titel | Worst Case | 557 |  |
| 12 | Titel | PlanVorschlag | 557 |  |
| 13 | Titel | Best Case | 557 |  |
| 14 | Titel | ANSCHLUSSFINANZIERUNG | 175 |  |


## Was an mehreren Stellen steht (von Hand zusammengefasst)

Die Spalte „auch in“ oben markiert nur wortgleiche Titel, Kachelbeschriftungen und Tabellen mit mindestens zwei gleichen Zeilen. Inhaltlich gleiche Zahlen unter anderem Namen stehen hier. Gemessen am Bestandsobjekt, Detail, wenn nicht anders gesagt.

| Thema | Stellen | Unterschied |
|---|---|---|
| **Plan vom Kauf gegen Ist je Jahr** | (1) Jahresabgleich › „Kauf gegen heute · 2025“ (Kennzahl · Plan vom Kauf · Ist · Abweichung; Kaltmiete im Jahr, Cashflow vor Steuer, Ergebnis V+V, Sonderumlage, Wert laut Marktbericht, Restschuld) · (2) Jahresabgleich › „Jahr für Jahr: Plan gegen Ist“ (Jahr · Kaltmiete Plan/Ist · Cashflow v. St. Plan · Restschuld Plan·Ist · Steuer V+V · Ziel·Wert; Zeilen 2026 laufend, 2025) · (3) Ankauf · Bestand · Zielbild (Genau) › „Jahresstände“ (Kennzahl · Ankauf 01.01.2025 · Stand 2026 · heute live; Nettokaltmiete/Monat, Jahresmiete, Cashflow v./n. Steuer, DSCR, LTV, DealScore, Restschuld je Darlehen, Ziel-Kaltmiete) | (1) und (2) zeigen dasselbe Jahr 2025 einmal als Zeile, einmal als Spalte; (3) dieselben Größen als Spalten je Stand. Kaltmiete und Restschuld stehen damit dreimal im Bestand. |
| **Ankauf gegen heute** | (1) Jahresabgleich › „Kauf gegen heute“ · (2) Ankauf · Bestand · Zielbild (Genau) › „Ankauf gegen Bestand · eingefrorener Stand gegen heute“ (Kennzahl · Ankauf · Bestand · Abweichung; 21 Zeilen: Ertrag, Kosten, Finanzierung, Steuer, Ergebnis) · (3) Steuer › „Steuerlich: Ankauf gegen heute“ | (2) ist die vollständige Fassung; (1) ist ein Auszug je Jahr; (3) wiederholt den Steuerteil von (2). |
| **Ist · Mieterhöhung · Zielbild** | (1) Ankauf · Bestand · Zielbild (Einfach) › Kacheln „Kaltmiete im Jahr · Zielbild 2030“, „Bruttomietrendite · Zielbild 2030“, „Maßnahmen“ · (2) dort (Genau) › Tafel „Ankauf · Bestand · Zielbild“ (Kennzahl · Ankauf 2025 · Bestand heute · Zielbild 2030 · nach Umbau; Kaltmiete p. a., Bruttomietrendite, Cashflow/Monat, DSCR, Maßnahmenkosten, Modernisierungspunkte) und Sprung „Ist · Mieterhöhung · Zielbild“ (`[data-dp-pot-wirt]`) · (3) Potenzial & Exit › „Was in dem Objekt steckt · Kaltmiete je Monat“ (Heute · nach Mieterhöhung · im Zielbild) und Tafel „Je Wohnung“ (Wohnung · Fläche · Ist · nach § 558 · Zielbild · Maßnahmen · Wann) | Dieselbe Kaltmiete heute/Zielbild in drei Fassungen (Jahr, Monat, je Wohnung). Die Mieterhöhungsstufe (§ 558) steht nur in (3). |
| **Marktpreis und Restschuld** | (1) Ankauf · … · Zielbild (Einfach) › Kachel „Marktpreisindikation heute“ · (2) Wert & Lage › Kacheln „Plan-Wert 2026“, „Restschuld 2026“ · (3) Potenzial & Exit › Exit-Tafel „Marktpreisindikation“, „Restschuld Ende 2026 laut Projektion“, „Netto-Erlös vor Steuer“ · (4) Jahresabgleich › „Wert laut Marktbericht“, „Restschuld“ | Restschuld 2026 viermal, Marktpreis dreimal. |
| **Steuer je Jahr** | (1) Steuer › „Einnahmen und Werbungskosten nach Gruppen“ (Jahr 2025 … 2044, Wendepunkt 2036) · (2) Jahresabgleich › Spalte „Steuer V+V“ und Zeile „Ergebnis V+V“ | (2) ist der Ausschnitt des laufenden Jahres aus (1). |
| **Aufteilung (Gebäudeanteil/AfA)** | nur Ankauf · Bestand · Zielbild (Genau) › „Ankauf gegen Bestand“ › Zeilen „Gebäudeanteil (AfA-Basis)“, „AfA-Satz“; Steuer › Zeile „AfA“ | Keine eigene Aufteilungs-Tafel in der Pilot-Analyse gefunden. |
| **Wegweiser der Übersicht** | Übersicht › Karten „Risiken & Szenarien“, „Lage & Markt“, „Potenzialanalyse“ | Verweise, keine Doppelung; sie springen in Potenzial & Exit (`#dp-pa-risk`, `#dp-pa-pot`) und Wert & Lage (`#dp-pa-loc`). Hausverlauf-Karte erscheint nicht (kein Hausverlauf im Testobjekt). |

## Auffälligkeiten beim Auslesen

- **Ankauf-Objekt:** der Reiter heißt „Ankauf · Soll · Zielbild“, die Überschrift darin „ANKAUF · BESTAND · ZIELBILD“, die erste Spalte der Tafel „Bestand 2025“, die zweite „Zielbild Jahr offen“.
- **Sprungleiste (Genau):** alle vier Ziele sind im Reiter vorhanden. „Ist · Mieterhöhung · Zielbild“ (Ziel y −2294 → 179), „Ankauf gegen Bestand“ (1839 → 130) und „Pilot beim Ankauf“ (1116 → 352) rollen; „Marktpreise“ blieb bei y 740, es wurde nicht gerollt.
- **Haus & Unterlagen** ist in beiden Objekten nur 175 px hoch (eine Karte „Unterlagen & WEG“ bzw. im Ankauf „Neue Unterlagen“/„Was absehbar Geld kostet“).
- **Potenzial & Exit** ist der längste Reiter: 2.693 px Einfach, 5.470 px Detail.
