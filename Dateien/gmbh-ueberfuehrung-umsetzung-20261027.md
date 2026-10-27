# Umsetzung: Objekt in eine Kapitalgesellschaft überführen (v2984)

Stand 27.10.2026, Zweig `staging`. Grundlage: Prüfbericht
`Dateien/gmbh-ueberfuehrung-pruefung-20261027.md`. Prüfer: `node tools/ueberfuehrung-pruefen.mjs`
(105 Punkte, RC=0). DealPilot rechnet, es berät nicht — die Aussagen unten sind die Grundlage der
Rechnung, keine Steuerberatung.

## Rechtsgrundlagen

| # | Frage | Ergebnis | Norm / Beleg |
|---|---|---|---|
| a | Veräußerung an die eigene GmbH | Kauf = Anschaffung/Veräußerung; **verdeckte Einlage in eine Kapitalgesellschaft gilt als Veräußerung**; Veräußerungspreis bei verdeckter Einlage = **gemeiner Wert**; Gewinn = Preis − (AK − AfA) − WK; **Freigrenze: steuerfrei, wenn der Gesamtgewinn im Jahr < 1.000 €** (ab VZ 2024); Frist: „nicht mehr als zehn Jahre“ (taggenau, Fristende = Kaufdatum + 10 Jahre noch steuerbar) | § 23 Abs. 1 S. 1 Nr. 1, S. 5 Nr. 2, Abs. 3 S. 1, 2, 4, 5 EStG — https://www.gesetze-im-internet.de/estg/__23.html |
| a | teilentgeltlich | Aufteilung in entgeltlichen Teil (Preis) und verdeckte Einlage (VW − Preis) → in Summe zählt der gemeine Wert | § 23 Abs. 3 S. 2 EStG (wie oben) |
| a | Sacheinlage gegen Anteile | tauschähnlich: Veräußerungspreis = gemeiner Wert der Anteile (≈ VW) | § 23 Abs. 1 S. 1 Nr. 1, Abs. 3 S. 1 EStG |
| b | GrESt Kauf | Gegenleistung inkl. übernommener Schulden | § 8 Abs. 1, § 9 Abs. 1 Nr. 1 GrEStG — https://www.gesetze-im-internet.de/grestg_1983/ |
| b | GrESt Einlage / Sacheinlage | Grundbesitzwert (keine Gegenleistung bzw. gesellschaftsvertragliche Grundlage), festgestellt vom Finanzamt | § 8 Abs. 2 S. 1 Nr. 1/2 GrEStG i. V. m. §§ 151, 157 ff. BewG |
| b | Kaufvertrag Gesellschaft ↔ Gesellschafter | Bemessung nach der **Gegenleistung**, nicht nach dem Grundbesitzwert (GbR-Fall, Tendenz übertragbar) | BFH 20.02.2019, II R 28/15 — https://blogs.pwc.de/de/steuern-und-recht/article/227484/grundstueckskaufvertrag-zwischen-gesellschaft-und-gesellschafter/ |
| b | Befreiung | keine für Kapitalgesellschaften (§§ 5, 6 GrEStG nur Gesamthand/Personengesellschaft) | §§ 5, 6 GrEStG |
| b | Landessätze | BW 5,0 · BY 3,5 · BE 6,0 · BB 6,5 · HB 5,5 (seit 01.07.2025) · HH 5,5 · HE 6,0 · MV 6,0 · NI 5,0 · NW 6,5 · RP 5,0 · SL 6,5 · SN 5,5 · ST 5,0 · SH 6,5 · TH 5,0 (seit 01.01.2024) — keine Änderung 2026 gefunden. **Die App hat die Tabelle schon** (`grest-plz-lookup.js`, `DealPilotGrest.forPlz`) und der Assistent nutzt sie | § 11 GrEStG, Art. 105 Abs. 2a GG; Übersicht https://www.finanz-tools.de/grunderwerbsteuer/bundeslaender-tabelle |
| c | Wertansatz in der GmbH | verdeckte Einlage zum **Teilwert**; Einlage erhöht das Einkommen nicht, Zugang Einlagekonto | § 8 Abs. 1, Abs. 3 S. 3 KStG i. V. m. § 6 Abs. 1 Nr. 5 EStG; § 27 KStG |
| c | Dreijahresgrenze § 6 Abs. 1 Nr. 5 S. 1 Buchst. a | **greift nicht** bei verdeckter Einlage in eine Kapitalgesellschaft, die nach § 23 Abs. 1 S. 5 Nr. 2 als Veräußerung gilt — stille Reserven werden schon beim Gesellschafter besteuert → Teilwert (betrifft „Am Markt 9“, Kauf 07/2024, Einlage 01/2026) | R 8.9 Abs. 4 KStR — https://www.steuerschroeder.de/steuergesetze/kstr/8.9 ; Wortlaut § 6: https://www.gesetze-im-internet.de/estg/__6.html |
| c | AK der Gesellschaft | Ansatz + GrESt + Notar + Grundbuch, kein Makler; Aufteilung Boden/Gebäude zum Erwerbszeitpunkt der Gesellschaft | § 255 Abs. 1 HGB |
| c | AfA | linear § 7 Abs. 4: 2 % (fertiggestellt 1925–2022), 2,5 % (vor 1925), 3 % (nach 31.12.2022, Wohnzwecke), 3 % Betriebsgebäude nicht Wohnzwecken; **degressive AfA § 7 Abs. 5a und § 7b nur bei Anschaffung bis Ende des Fertigstellungsjahres** → nach einer Überführung ausgeschlossen | § 7 Abs. 4, 5a, § 7b EStG |
| c | anschaffungsnahe HK | 15 % der Gebäude-AK, **drei Jahre ab Anschaffung durch die Gesellschaft** — beginnt neu | § 6 Abs. 1 Nr. 1a EStG |
| d | Übergang Nutzen/Lasten | Einkünfte stehen ab Übergang der Gesellschaft zu; die App rechnet monatsgenau: privat (Monat − 1)/12, Gesellschaft (13 − Monat)/12; Stichtag mitten im Monat → Monat zur Gesellschaft (Hinweis, Empfehlung Monatserster) | § 446 BGB |
| e | Gewerbesteuer | Kapitalgesellschaft = Gewerbebetrieb kraft Rechtsform, **kein Freibetrag**; Messzahl 3,5 %; Gewerbeertrag auf volle 100 € abgerundet | § 2 Abs. 2, § 11 Abs. 1 S. 3, Abs. 2 GewStG |
| e | **einfache Kürzung** | **seit EZ 2025: „die im Erhebungszeitraum als Betriebsausgabe erfasste Grundsteuer“** (Fassung JStG 2024, BGBl. 2024 I Nr. 387; Anwendung § 36 Abs. 4b GewStG). Die im Auftrag genannten „0,11 % des Grundsteuerwerts“ standen in der Grundsteuerreform 2019, wurden vor Inkrafttreten ersetzt. Vorher 1,2 % von 140 % des Einheitswerts | § 9 Nr. 1 S. 1 GewStG — https://www.gesetze-im-internet.de/gewstg/__9.html ; https://www.gesetze-im-internet.de/gewstg/__36.html |
| e | erweiterte Kürzung | auf **Antrag**; nur bei **ausschließlich** eigenem Grundbesitz (+ erlaubte Nebentätigkeiten), ganzes Jahr. Bagatellgrenzen: Strom aus erneuerbaren Energien/Ladestationen **≤ 20 %** (Wachstumschancengesetz, ab EZ 2023), sonstige Leistungen an Mieter **≤ 5 %** der Mieteinnahmen. Schädlich: Grundbesitz dient dem Gewerbebetrieb eines Gesellschafters (S. 5 Nr. 1), Betriebsvorrichtungen, gewerblicher Grundstückshandel | § 9 Nr. 1 S. 2–6 GewStG (wie oben) |
| e | GewSt-Verlustvortrag | 1 Mio. + 60 % | § 10a GewStG |
| f | KSt | 15 % + Soli 5,5 % = 15,825 % | § 23 Abs. 1 KStG, §§ 3, 4 SolZG |
| f | Verlustvortrag | Sockel 1 Mio. voll, darüber 70 % (VZ 2024–2027), sonst 60 % | § 10d Abs. 2 EStG i. V. m. § 8 Abs. 1 KStG |
| f | Ausschüttung | 25 % + Soli = 26,375 %; Teileinkünfteverfahren auf Antrag (≥ 25 % oder ≥ 1 % + beruflich tätig) | § 20 Abs. 1 Nr. 1, § 32d Abs. 1, Abs. 2 Nr. 3 EStG |
| g | Gesellschafterdarlehen | Zins Betriebsausgabe (fremdüblich, Mehrzins vGA § 8 Abs. 3 S. 2 KStG); beim Gesellschafter mit **≥ 10 % Beteiligung Tarif statt Abgeltung** | § 32d Abs. 2 Nr. 1 S. 1 Buchst. b EStG |
| h | UG | 25 % des (um Verlustvortrag geminderten) Jahresüberschusses in die gesetzliche Rücklage; **Sacheinlagen ausgeschlossen** | § 5a Abs. 3, Abs. 2 S. 2 GmbHG — https://www.gesetze-im-internet.de/gmbhg/__5a.html |
| i | „BFH 2023“ im Assistenten | **keine Entscheidung auffindbar** (Suche nach BFH 2023, II R, Verkauf an eigene GmbH unter Verkehrswert, GrESt) → **gestrichen**, ersetzt durch BFH II R 28/15 (Gegenleistung) und den Hinweis auf die verbindliche Auskunft | — |

Weitere Hinweise im Assistenten (ohne Rechnung): Bankzustimmung zur Schuldübernahme (§§ 414, 415 BGB),
Drei-Objekt-Grenze (gewerblicher Grundstückshandel), Schenkungsteuer bei Mitgesellschaftern (§ 7 Abs. 8 ErbStG).

## Umgesetzt

| Datei | was |
|---|---|
| `frontend/js/ueberfuehrung-kern.js` (neu) | Kern ohne DOM/Einstellungen: `grest`, `wertAnsatz`, `akGesellschaft`, `afaSatzGesellschaft`, `frist23`, `afaBisStichtag`, `paragraph23`, `steuer23`, `stichtagAnteile`, `erwKuerzungStatus`, `steuerReihe` (KSt + GewSt mit Vortrag), `tracker`, `ausschuettung` (UG), `gesellschafterdarlehen` |
| `ueberfuehrung-wizard.js` | Art der Übertragung (Sacheinlage bei UG gesperrt), Verkehrswert (Vorbelegung Verkehrswert vor Bankbewertung, sonst „bitte eintragen“), Kaufpreis bzw. Grundbesitzwert, GrESt-Satz aus PLZ, Notar+Grundbuch 2 %, Bodenwert aus BRW × Fläche × MEA, Restschuld zum Stichtag aus der Projektion, Zins ungerundet, Gesellschafterdarlehen, Beteiligung, weitere § 23-Gewinne; Ergebnisseite mit AK, AfA, 15-%-Grenze, § 23-Gewinn, Freigrenze, indikativer Steuer (Steuerlast mit/ohne aus dem Steuerprofil, sonst Grenzsatz + Soli); falsche Texte (§ 23-Formel, GrESt, BFH 2023, „+ m/12“) ersetzt. Gesellschaftsobjekt: kp = Ansatz, Makler 0, GrESt effektiv, Notar/Grundbuch neu, Gebäudeanteil zum Stichtag, AfA linear, § 7b aus, `san` = 0, ein Darlehen = Restschuld (Rate gleich), `d2` aus, **`ueberf_ende` nicht geerbt**, Ergebnis im neuen Feld `ueberf_daten` (JSON). Rück-Link-PUT schreibt Ende und Daten mit (Schutz gegen veralteten GET) |
| `calc.js` | Privat-Schnitt (Monat − 1)/12, relativ im Kaufjahr, keine Nullzeile; Schnitt auch in der Projektion (`cfRows`); `_mtxYear` ohne ESt-Split im Gesellschaftsobjekt; Gesellschaftssteuer über Kern-Tracker (Vortrag, GewSt, Grundsteuer-Kürzung, Gesellschafterdarlehenszins); alte AfA-Skalierung nur noch für Überführungen vor v2984 |
| `tax.js` | `_kstMitVortrag` → Kern; Stichtagsjahr des Privatobjekts zeitanteilig; Aufschlüsselung KSt/GewSt, Kürzungsstatus, Hebesatz fehlt, Möblierung als Prüfpunkt, Gesellschafterdarlehen mit § 32d-Regel; Betriebseinnahmen/-ausgaben statt V+V; UG-Rücklage in der Ausschüttung |
| `mandanten.js` | erweiterte Kürzung: Vorgabe aus, aktiv nur mit allen vier Prüfpunkten — Anzeige, `effRate`, Abschluss gleich; `steuerParameter()`; Badge am Gesellschaftsobjekt „hält seit“ statt „läuft bis“; § 23 am Privatobjekt; Hinweis bei verknüpftem Privatobjekt ohne Ende und bei verwaistem Privatobjekt (Gesellschaftsobjekt zeigt darauf); Altobjekte „bitte ergänzen“ |
| `gesellschaft-abschluss.js` | Steuer aus dem Kern mit Vortrag über die Vorjahre, Gewinnvortrag mit derselben Steuer, Gesellschafterdarlehenszins als Aufwand, Grundsteuer-Kürzung, AK aus `ueberf_daten`, Restschuld alter Überführungen aus `ueberf_restschuld`, UG-Rücklage im PDF-Hinweis, Kürzungstext einheitlich |
| `storage.js`, `index.html` | Feld `ueberf_daten` (gespeichert, beim Objektwechsel geleert), Kern eingebunden, Buster |
| `pdf-investment-bank.js` | „Privat-Ende“-Grund nicht beim Gesellschaftsobjekt |
| `tools/ueberfuehrung-pruefen.mjs` (neu) | 105 Punkte an den echten Dateien |

## Beispiele vorher / nachher

| | App vorher | jetzt |
|---|---:|---:|
| A GrESt der Überführung | keine (im Objekt 8.580 auf alten KP) | 9.425 € |
| A AK der GmbH | 143.220 € | 157.325 € |
| A AfA (A′ privat mit Makler) | 2.600 € | 2.517 € |
| A § 23-Gewinn / Steuer 42 % + Soli | keine Zahl | 5.217 € / 2.312 € |
| A′ § 23 | keine Zahl | 618 € → Freigrenze, 0 € |
| A Jahr 2026 | privat 1/12 bzw. 12/12 + GmbH 12/12 | nur GmbH 12/12 |
| B GrESt (Einlage, Grundbesitzwert fehlt) | „auf den Überführungspreis“ (≈ 0) | 32.500 € vorläufig |
| B AfA | 7.385 € | 7.560 € |
| C mit erw. Kürzung | 1.223 € | 907 € (nur mit bestätigten Prüfpunkten) |
| C ohne Kürzung (Grundsteuer 275 €) | 2.441 € | 1.757 € |
| C Verlust −4.000/+3.000/+3.000 (Projektion) | 0 / 475 / 475 € | 0 / 0 / 317 € |

## Offen

- **Taggenaue Abgrenzung** im Stichtagsmonat: die App rechnet monatsgenau; ein Stichtag am 15. gibt den Monat ganz der Gesellschaft (Hinweis im Assistenten). Tagesgenau hieße anteilig.js für alle Objekte umbauen.
- **§ 82b EStDV**: noch nicht verteilter Erhaltungsaufwand des Privatobjekts wäre im Jahr der Veräußerung voll abziehbar — nicht abgebildet, im Stichtagsjahr wird zeitanteilig gekürzt.
- **Sanierung/anschaffungsnahe HK privat** gehen nicht in die fortgeführten AK des § 23 ein (Hinweis im Assistenten).
- **Grundsteuer-Kürzung auf Gesellschaftsebene** im Steuer-Reiter („Mandanten-Steuerakte“): nur die Grundsteuer des geöffneten Objekts; im Jahresabschluss die Summe aller Objekte.
- Hinzurechnung § 8 Nr. 1 GewStG (25 % der Entgelte für Schulden über 200.000 €) nicht gerechnet.
- Gesellschafterdarlehen mindert die Steuer der Gesellschaft, nicht ihren Cashflow in der Projektion; die Steuer beim Gesellschafter wird als Regel genannt, nicht beziffert.
- Kosten der Gesellschaft (Steuerberatung, IHK …) weiter nur im Jahresabschluss, nicht in der Objektansicht.
- Portfolio-Strategie zeigt die Spekulationsfrist auch für Gesellschaftsobjekte (`portfolio-strategie.js:68–71`) — nicht angefasst.
- Bestehende Überführungen (z. B. „Am Markt 9“ 2026-1002 → 2026-1007) rechnen unverändert mit dem alten Verfahren weiter und zeigen „bitte ergänzen“; neu angelegt über „Überführung aufheben“ + Assistent.
