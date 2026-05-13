# DealPilot — Portfolio-Strategieanalyse-Modul · Funktionsumfang

**Stand:** V139 (10.05.2026)
**Aktivierung:** Settings → Info → roter Punkt (Hidden-Gate)
**Plan-Gating:** Volltzugriff Pro/Business, eingeschränkte Vorschau Free

---

## 1. Setup-Bereich (Eingaben)

### 1.1 Investorprofil
Vier Profile, jedes mit eigenen LTV-Toleranzen, Cashflow-Gewichtungen:
- **Sicherheit** — niedrige LTV, hoher Cashflow-Fokus
- **Cashflow** — Standard-Setup
- **Wachstum** — höhere LTV, EK-Hebel
- **Aufbau aggressiv** — bis 110 % LTV, Skalierung über GmbH

### 1.2 Anlage-Ziel (V135)
Sechs Ziele mit eigenen Empfehlungs-Tags und LTV-Anpassungen:
- **Altersvorsorge** — entschuldetes Portfolio bis Renteneintritt
- **Langfristig halten** — Buy-and-Hold, kein Verkauf
- **Wachstum / Skalierung** — Bestand vergrößern, EK-Hebel
- **Cashflow jetzt** — max. laufender Überschuss
- **Vermögen aufbauen** — Wertsteigerung primär
- **Erbschafts-Planung** — Übertragung an die nächste Generation

Plus Horizont-Slider 3-40 J.

### 1.3 Kauf-Präferenz + Zukauf-Plan (V135-136)
- **Objekttyp** — ETW / MFH / WGH / Gemischt / Egal
- **Objekte (Käufe) pro Jahr** — Anzahl Kaufverträge
- **Wohneinheiten pro Objekt** — 1 (ETW) bis 10+ (großes MFH)
- **Kaufpreis-Korridor** Min/Max
- **Sparquote** % vom Netto-Einkommen
- **Marktzins** (Default 3,9 % Stand 05/2026, Quellen Interhyp/Dr. Klein/baufi24)
- **Mietsteigerungs-Erwartung** % p.a.

### 1.4 Beleihungswert-Konfiguration (V137)
- **Beleihungswert-Abschlag** vom Verkehrswert (Standard 10 %, Banken oft 15-25 %)
- **Beleihungs-Auslauf** vom Beleihungswert (Standard 80 %, bis 85 %)
- Live-Anzeige des effektiv nutzbaren Anteils vom VW

### 1.5 Eigenheim-Schaukel-Eingaben (V138)
- **Familienheim vorhanden?** Ja/Nein
- **Verkehrswert Familienheim** in €
- **Ehe / Lebenspartnerschaft?** Ja/Nein

### 1.6 Stiftungs-Erwägung (V138)
- Toggle "Familienstiftung erwägen" — aktiviert Stiftungs-Vergleichs-Karte

### 1.7 Objekt-Auswahl-Karte (V137)
Toggle-Chips für jedes Bestandsobjekt — ermöglicht Strategie-Berechnung nur für ausgewählte Objekte. "Alle einbeziehen"-Reset-Button.

---

## 2. Diagnose-Karten (oben in der Strategie-Ansicht)

### 2.1 Portfolio-Bewertung (V137)
- **Score 0-100** mit Farb-Badge (Exzellent / Gut / Solide / Verbesserungs-Bedarf / Kritisch)
- **Charakter-Beschreibung** (Einsteiger / klein / mittelgroß / groß / Profi-Niveau)
- **Stärken-Liste** mit konkreten Hebeln (LTV, Reserve, Lage, DSCR, §23-frei, etc.)
- **Schwächen-Liste** (Mietlücke, Klumpen, Energie-Risiko, etc.)

### 2.2 Zukauf-Plan-Karte (V135)
Konkrete Plausibilitäts-Rechnung mit:
- **EK-Bedarf in 3 Stufen**: nur Nebenkosten / NK + 10 % / NK + 20 %
- **Nebenkosten-Aufschlüsselung**: GrESt nach Bundesland, Notar+Grundbuch, Makler
- **Annuität bei aktuellem Marktzins** für 80 % und 100 % LTV
- **EK-Zufluss** aus Sparquote + Beleihungs-Reserve / 5 J.
- **Sparquoten-Status**: ausreichend / knapp / unzureichend
- **Belastungsquoten-Bewertung** gegen 35 %-Banken-Faustregel
- **Empfohlene Sparquote** bei Unter-Deckung

### 2.3 Modellrechnungs-Karte (V136)
Drei Finanzierungsmodelle pro Zukauf:
| Modell | EK | LTV | Bindung | Tilgung |
|---|---|---|---|---|
| Standard 80/20 | 20 % | 80 % | 10 J. | 2 % |
| Minimal-EK 90/10 | 5 % | 100 % | 10 J. | 2 % |
| Lange Bindung | 20 % | 80 % | 20 J. | 2 % |

Jedes Modell zeigt EK / Darlehen / Annuität / Restschuld nach 10 J. Das zum Anlage-Ziel passende Modell wird gold markiert.

**5-Jahres-Prognose**: Objekte / WE / Investitions-Volumen / EK-Einsatz / neue Mieten/J / neue Annuität/J.

### 2.4 Steuerhebel-Karte (V136)
- **Standard-AfA (2 %)** vs. **RND-AfA (~3,5 %)** Vergleich über 5 Jahre
- **Mehrwert RND in Eurobeträgen**
- Liste weiterer Hebel mit Beispielrechnungen: §35c, §82b, §6 Abs. 1 Nr. 1a, §7h/§7i, §23, §6b

### 2.5 RND-Bewertung pro Objekt (V137)
Tabelle für jedes Bestandsobjekt:
- Standard-AfA-Satz vs. RND-AfA-Satz
- AfA-Steigerung in % (z.B. „+1011 %")
- Mehr Steuer/J bei Grenzsteuersatz
- Gutachter-Kosten
- **Amortisationsdauer in Jahren**
- Empfehlungs-Status (grün/gold/rot)

### 2.6 GmbH-Verkauf-Karte / 7-%-Methode (V137)
Konkrete Pro-Objekt-Tabelle für die verdeckte Einlage nach §8 Abs. 3 S. 3 KStG:
- Verkehrswert / Kaufpreis an GmbH (z.B. 7 %) / GrESt Standard / GrESt 7 % / Ersparnis / Verdeckte Einlage / Halte­dauer
- Konfigurierbarer % vom VW (4-15 %)
- Aktiva/Passiva-Visualisierung des Bilanz-Effekts
- Nicht-geeignete Objekte (Spekfrist offen) separat ausgewiesen

### 2.7 KP-Aufteilung-Karte (V138) — Grund/Boden vs. Gebäude
- Slider: aktueller Gebäudeanteil → optimierter Anteil (typisch 75 → 85 %)
- Hebel-Berechnung: mehr AfA-Basis pro Objekt, mehr Steuer/J, über 50 J., 5J-Hebel bei allen geplanten Käufen

### 2.8 Eigenheim-Schaukel-Karte (V138)
- Berechnet Hebel des Sylter Modells: §13 Abs. 1 Nr. 4a ErbStG + §3 Nr. 4 GrEStG + §23 Abs. 1 Nr. 1 S. 3 EStG
- Schenkungssteuer-Ersparnis + GrESt-Ersparnis = Gesamt-Hebel
- Schamfrist-Hinweis (6+ Monate)

### 2.9 Familienstiftung vs. Holding (V138)
30-Jahres-Vergleich beider Strukturen mit:
- Setup-Kosten + Errichtungssteuer
- Steuer auf laufende Erträge
- Verwaltungskosten
- Ersatz-ErbSt nach 30 Jahren
- Pro/Contra-Liste
- Automatische Empfehlung je nach Volumen

### 2.10 Lage- & Markt-Diagnose (V134)
- Ø Lage-Score, Mietlücke gesamt, Hotspot-Objekte
- Klumpen-Risiko, Energie-Risiko (GEG bis 2028)

### 2.11 GmbH-Stufenmodell (V133)
5-Stufen-Treppe (Privat → VV-GmbH → Holding → Op-GmbH → Stiftung) mit "DU BIST HIER"-Markierung und dynamischer Wirtschaftlichkeits-Rechnung.

### 2.12 Strategie-Aufbau visuell (V137)
SVG-Diagramm in 3 Spalten: **Bestand** → **EK-Quellen** (Sparquote + Beleihung) → **Strategie-Outcome** (Modell + 5J-Prognose + GrESt-Bonus).

---

## 3. Strategien (17 total)

| # | Key | Name |
|---|---|---|
| A | steuern_senken | Steuern senken |
| B | wachstum | Wachstum durch Hebel |
| C | sicherheit | Konsolidieren & Sichern |
| D | gmbh_aufbau | GmbH-Strukturen aufbauen |
| E | energetisch | Energetisch sanieren |
| F | lage_optimierung | Lage-Optimierung |
| G | entschuldung | Entschuldungs-Sprint |
| H | mietkonvergenz | Mietkonvergenz |
| I | diversifikation | Standort-Diversifikation |
| J | faktor_arbitrage | Faktor-Arbitrage |
| K | wachstumskorridor | Wachstums-Korridor |
| L | energie_pflicht | Energie-Pflicht (GEG) |
| M | altersvorsorge | Altersvorsorge — entschuldetes Portfolio |
| N | gmbh_verkauf | Verkauf an eigene GmbH (7-%-Methode) |
| **O** | eigenheim_schaukel | **Eigenheimschaukel — Vermögen steuerfrei zwischen Ehegatten** |
| **P** | share_deal | **Share Deal & 7-Jahres-Regel — GmbH-Verkauf zu 1,5 % Steuer** |
| **Q** | familienstiftung | **Familienstiftung — Generationenvermögen** |

---

## 4. Glossar — alle abgedeckten Paragraphen & Konzepte

### 4.1 EStG (Einkommensteuergesetz)
- **§7 Abs. 4 EStG** — Standard-AfA 2-3 %
- **§7 Abs. 4 Satz 2 EStG** — RND-Gutachten (kürzere Restnutzungsdauer)
- **§7h EStG** — Sanierungsgebiet-AfA 9 % über 8 J. + 7 % über 4 J.
- **§7i EStG** — Denkmal-AfA (gleicher Satz)
- **§6 Abs. 1 Nr. 1 EStG** — KP-Aufteilung Grund/Boden vs. Gebäude
- **§6 Abs. 1 Nr. 1a EStG** — 15-%-Regel für anschaffungsnahe Sanierungen
- **§6 Abs. 1 Nr. 5 EStG** — Teilwert-Aktivierung bei verdeckter Einlage
- **§6 Abs. 6 S. 2 EStG** — Anschaffungskosten der GmbH-Beteiligung
- **§6b EStG** — Reinvestitions-Rücklage (stille Reserven übertragen)
- **§23 EStG** — 10-Jahres-Spekulationsfrist (privates Veräußerungsgeschäft)
- **§23 Abs. 1 Nr. 1 S. 3 EStG** — Eigennutzungs-Befreiung (Verkauf bei Nutzung 2 Vorjahre + Verkaufsjahr sofort steuerfrei)
- **§35c EStG** — Energetische Sanierung (20 % der Kosten über 3 J., max. 40k)
- **§82b EStDV** — Erhaltungsaufwand auf 2-5 J. verteilen

### 4.2 KStG (Körperschaftsteuergesetz)
- **§8 Abs. 1 KStG** — Anwendbarkeit der EStG-Regeln auf KSt
- **§8 Abs. 3 S. 3 KStG** — Verdeckte Einlage (Vermögensvorteil ohne Gewinnerhöhung)
- **§8b KStG** — Beteiligungsertragsbefreiung (95 % der Dividenden steuerfrei in Holding)
- **§22 UmwStG** — Sperrfrist 7 Jahre nach Anteils-Einbringung
- **§27 KStG** — Steuerliches Einlagekonto (verdeckte Einlagen ausgewiesen)
- **§27 Abs. 1 S. 5 KStG** — Reihenfolge: zuerst Gewinn, dann Einlagekonto

### 4.3 GrEStG (Grunderwerbsteuergesetz)
- **§1 Abs. 3 GrEStG** — Share Deal (90-%-Schwelle seit 1.7.2021)
- **§3 Nr. 4 GrEStG** — GrESt-Befreiung Ehegatten/Lebenspartner
- **§6a GrEStG** — Konzernklausel (steuerfreie Umstrukturierung bei 95 %-Beteiligung)
- **§8 Abs. 2 Nr. 1 GrEStG** — Bemessungsgrundlage Grundbesitzwert bei symbolischem KP
- **§9 GrEStG** — Bemessungsgrundlage = vereinbarter Kaufpreis

### 4.4 ErbStG (Erbschaft- und Schenkungssteuergesetz)
- **§13 Abs. 1 Nr. 4a ErbStG** — Familienheim-Schenkung steuerfrei zwischen Ehegatten (wertmäßig unbegrenzt, kein Objektverbrauch)
- **§13 Abs. 1 Nr. 4b ErbStG** — Familienheim-Erwerb von Todes wegen (10 J. Behaltensfrist)
- **§13 Abs. 1 Nr. 4c ErbStG** — Familienheim-Erwerb durch Kinder (200 m² Wohnflächen-Grenze)
- **§13a/§13b ErbStG** — Verschonung Betriebsvermögen 85 % / 100 %
- **§15 Abs. 2 ErbStG** — Günstigste Steuerklasse bei Familienstiftungen
- **§16 ErbStG** — Persönliche Freibeträge (500k Ehegatten, 400k Kinder)
- **§42 AO** — Gestaltungsmissbrauch (Schamfrist-Pflicht bei Schaukeln)

### 4.5 GewStG (Gewerbesteuergesetz)
- **§9 Nr. 1 S. 2 GewStG** — Erweiterte Grundbesitzkürzung (VV-GmbH gewerbesteuerfrei)

### 4.6 BGB (Bürgerliches Gesetzbuch)
- **§558 BGB** — Mieterhöhung bis zur ortsüblichen Vergleichsmiete
- **§558a BGB** — Begründung der Mieterhöhung
- **§559 BGB** — Modernisierungsumlage (8 % der Sanierungskosten)
- **§489 BGB** — Sonderkündigungsrecht nach 10 Jahren

### 4.7 Sonstige Konzepte
- **GmbH-Tier-Schwellen** (5-Stufen-Modell mit konkreten EK-Werten je Stufe)
- **DSCR-Schwellen** (<1,0 rot, 1,0-1,2 gelb, ≥1,2 grün)
- **LTV-Schwellen** (<85 % grün, 85-100 % gold, >100 % rot)
- **Bank-Faustregel** (max. 35 % vom Netto für Gesamt-Annuität)
- **BMF-Aufteilungs-Hilfe** für Grund/Boden vs. Gebäude
- **BFH-Untergrenze** 4-5 % vom Buchwert (verdeckte Einlage)
- **89,9 %-Schwelle** Share Deal seit 2021 (vorher 95 %)
- **6-Monats-Schamfrist** Eigenheim-Schaukel (§42 AO-Schutz)
- **7-Jahres-Regel** beim GmbH-Verkauf (Holding-Aufbau-Vorlauf)
- **3-Objekt-Rahmen** gewerblicher Grundstückshandel
- **§22 UmwStG-Sperrfrist** (7 Jahre nach Einbringung)

---

## 5. Steuer-Hacks — strategische Hebel

| Hack | Hebel | Strategie |
|---|---|---|
| **RND-Gutachten** | AfA-Steigerung +50 % bis +1000 % | A, M |
| **Sondertilgung 5 % p.a.** | Standard-Recht in fast jedem Vertrag | M |
| **§23-Verkauf zur Entschuldung** | 10+ J. → Verkauf einkommensteuerfrei | M |
| **Eigennutzung 2 Vorjahre + Verkaufsjahr** | Verkauf sofort steuerfrei (§23 Abs. 1 Nr. 1 S. 3 EStG) | — |
| **Sanierung VOR Nutzen-Lasten-Wechsel** | Umgeht 15-%-Regel (§6 Abs. 1 Nr. 1a EStG) | B |
| **KP-Aufteilung Notarvertrag** | 75 → 85 % Geb-Anteil = +10 Pp AfA-Basis | KP-Aufteilung-Karte |
| **Beleihungs-Reserve nutzen** | EK-Hebel statt neuer EK-Aufbau | B (Nachbeleihung) |
| **VV-GmbH erweiterte Kürzung** | Effektive Steuer ~15,8 % statt ~30 % | D |
| **Holding §8b KStG** | 95 % steuerfreie Dividende | D |
| **7-%-Methode (verdeckte Einlage)** | GrESt nur auf 7 % vom VW | N |
| **Share Deal 89,9 %** | Keine GrESt bei späterem Verkauf | P |
| **7-Jahres-Regel GmbH-Verkauf** | ~1,5 % statt ~30 % auf Veräußerungsgewinn | P |
| **Eigenheim-Schaukel** | Vermögen unbegrenzt steuerfrei zwischen Ehegatten | O |
| **§6a GrEStG-Konzernklausel** | Umstrukturierung GrESt-frei | P |
| **Familienstiftung** | Pflichtteils-Schutz, Generationen-Plan | Q |
| **§6b-Reinvestitions-Rücklage** | 100 % Steuer-Stundung in der GmbH | — |
| **§35c-Energetik** | 20 % der Sanierungskosten über 3 J. (max. 40k) | E |
| **§7h/§7i Sanierung/Denkmal** | 100 % Sanierungs-AfA in 12 J. | E |
| **§82b EStDV-Verteilung** | Erhaltungsaufwand auf 2-5 J. glätten | — |
| **Lange Zinsbindung (20 J.)** | +0,4 Pp, dafür Zinsrisiko ausgeschlossen | M |
| **§13a/§13b ErbStG-Verschonung** | 85 % bis 100 % Betriebsvermögen-Befreiung | Q |

---

## 6. Outputs

### 6.1 Strategie-PDF (1-25 Seiten)
- Cover mit Anlage-Ziel + Investorprofil
- Narrative (Diagnose des Bestands)
- Zukauf-Plan-Seite (V135)
- Modellvergleich + 5J-Prognose (V136)
- Steuerhebel-Seite (V136)
- Lage- & Markt-Diagnose (V134)
- GmbH-Tier-Schema (V133)
- 17 Strategie-Seiten (eine pro Strategie)
- Peer-Vergleich
- Glossar mit allen referenzierten Paragraphen

### 6.2 Bank-Verhandlungs-PDF (V132)
Investorenbroschüre für die Bank — Bestand, KPIs, Argumentation, Reserve-Vorschlag.

### 6.3 SVG-Visualisierung
Strategie-Aufbau in 3 Spalten — direkt im UI eingebettet.

---

## 7. Integrationen mit Deal-Aktion-Tab

### 7.1 RND-Banner (V138-Empfehlung)
Zeigt sich automatisch im Deal-Aktion-Tab, wenn das aktuelle Objekt einen lohnenden RND-Hebel hat:
- AfA-Steigerung in %
- Steuer-Ersparnis pro Jahr
- Gutachter-Kosten
- Amortisations-Dauer
- Barwert gesamt
- **Direkt-Button "Gutachten direkt anfragen"** → springt in Expert-Anfrage-Maske mit RND-Gutachten vorausgewählt
- Bei Pro/Business-Plan: öffnet automatisch das **RND-Modul V3** mit den Objektdaten vorausgefüllt

### 7.2 KP-Aufteilung-Banner (V139)
Zeigt sich, wenn der Gebäudeanteil suboptimal ist (<85 %):
- Differenz AfA-Basis bei Optimierung
- Mehr Steuer pro Jahr
- Über 50 Jahre kumuliert
- **Direkt-Button "Gutachten zur Aufteilung anfragen"** → springt in Verkehrswert-Gutachten-Anfrage mit vorbelegtem Text
- Hinweis mit Sprung zum Objekt-Tab, wenn Bodenrichtwert/Grundstücksfläche fehlen

### 7.3 RND-Modul V3 Integration (V139)
- 6 Berechnungsverfahren (Linear, Vogels, Ross, Parabel, Punktraster, Technisch)
- 27 Gebäudetypen (GND-Tabelle nach Anlage 22 BewG)
- 177 Bauteile mit Lebensdauern (BTE-Katalog)
- Schadenserfassung mit Toggle
- PDF-Export im Original-Layout des Sachverständigen-Gutachtens
- BFH IX R 25/19-Anerkennung (Anlage)
- **Automatischer Daten-Import** aus DealPilot-Objekt (rate_*, ds2_*, geb_ant)

---

## 8. Technische Implementierung

| Datei | Inhalt | Größe |
|---|---|---|
| `portfolio-strategy.js` | Engine — 17 Strategien, alle Helper, Glossar | ~310 KB |
| `portfolio-strategy-ui.js` | UI-Karten, Setter, Visualisierung | ~115 KB |
| `portfolio-strategy-pdf.js` | PDF-Export | ~56 KB |
| `bank-negotiation-pdf.js` | Bank-PDF | ~18 KB |
| `portfolio-strategy.css` | Styles | ~62 KB |
| `deal-action.js` | RND-Banner + KP-Aufteilung-Banner + Sprünge | ~73 KB |
| `rnd-calc.js` (V3) | Kern-Berechnung 6 Verfahren | ~22 KB |
| `rnd-ui.js` (V3) | RND-Modul-UI | ~35 KB |
| `rnd-pdf.js` (V3) | PDF im Original-Layout | ~20 KB |
| `rnd-gnd-table.js` | 27 Gebäudetypen | ~6 KB |
| `rnd-bte-katalog.js` | 177 Bauteile | ~12 KB |
| `rnd-styles.css` | RND-Styles | ~8 KB |

---

## 9. Plan-Gating

| Feature | Free | Investor (Pro) | Business |
|---|---|---|---|
| Portfolio-Strategie-Modul | nein | ja | ja |
| RND-Banner in Deal-Aktion | ja | ja | ja |
| RND-Modul V3 (Voll-UI) | nein (Anfrage-Modal) | ja | ja |
| KP-Aufteilung-Banner | ja | ja | ja |
| Bank-Verhandlungs-PDF | nein | ja | ja |
| Strategie-PDF | nein | ja | ja |
| Watermark "DealPilot Free" | ja | nein | nein |

---

## 10. Disclaimer

Alle Modellrechnungen mit BFH/EStG/KStG/ErbStG/GrEStG-konformen Annahmen.
Konkrete Umsetzung erfordert immer Steuerberater + ggf. Notar.

**Quellen für die Rechtsgrundlagen:**
- Bundesministerium der Finanzen (BMF-Aufteilungs-Hilfe)
- BFH-Rechtsprechung (IX R 25/19, IX R 26/19, II R 35/11, II R 39/13)
- Heckschen & Salomon (Eigenheimschaukel)
- JUHN Partner (§13 Abs. 1 Nr. 4a ErbStG)
- MR.STEUER® (verdeckte Einlage, 7-Jahres-Regel, Fix-&-Flip-Strukturierung)
- Immocation Steuerclass (Holding-Strategie)
- Haufe (Immobilien-GmbH §6a GrEStG, §1 Abs. 3 GrEStG)
- Steuernsteuern.de (KP-Aufteilung Grund/Boden, BFH 4-5 % Buchwert-Untergrenze)
- Kleutgens Advisors (Anschaffungskosten-Erhöhung der Beteiligung)
- juhn.com / smartsteuer.de (verdeckte Einlage §8 Abs. 3 KStG, §27 KStG)
- Interhyp / Dr. Klein / baufi24 (Marktzins-Anker 05/2026)
