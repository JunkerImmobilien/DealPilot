# 06 · Miete — Mietstruktur, Warmmiete, Mietentwicklung, Marktmiete, Pilot-Mietpreis-Analyse

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen"). Video: Modul 07 (`reihe-miete`; Szenen 3 und 5 warten noch auf die seit v2500 entfernten Zensus-Kästen — Drehbuch anpassen), Überblick 2 Kapitel 4 (`reihe-ueberblick2`), Modul 26 (`reihe-zielbild`) für „Aus Wohnungen" · Messe-Geschichte(n): 1 (Ravensberger Weg 38, Miete +12 %), 8 (Westerfeldstr. 140) (design/Messe/demo-geschichten.md).

## 1 · Wozu

Die Miete ist der Treibstoff jedes Investments. Im Reiter Miete trägst du ein, was heute fließt — Nettokaltmiete, Stellplätze und Garagen, die Nebenkostenvorauszahlungen der Mieter. DealPilot rechnet daraus Warmmiete und Jahreswerte und vergleicht deine Ist-Miete mit der Marktmiete. Die Mietentwicklung legt fest, wie die Miete über die Jahre steigt: pauschal, mit einzelnen Erhöhungen oder Wohnung für Wohnung. Auf Wunsch recherchiert der Pilot die marktübliche Miete — gestützt auf belegte Vergleichswerte.

## 2 · Wo in der App

| Was | Wo |
|---|---|
| Mietstruktur | Reiter **Miete** → Karte „Mietstruktur, Nettokaltmiete und Warmmiete": **Nettokaltmiete / Monat**, **Zusätzliche Einnahmen / Monat** (Stellplatz, Garage), **Umlagefähige Kosten / Monat** (Nebenkostenvorauszahlungen der Mieter) → „= Warmmiete / Monat", „= Warmmiete / Jahr" |
| Marktmiete | Karte **Marktmiete + Mietausfall**: Marktmiete (€/m²), **Mietausfall-Risiko**, Knopf **Mietpreis recherchieren** (Pilot-Mietpreis-Analyse) |
| Mietvertrag | „Mietverhältnis seit", Vertragsart |
| Mietentwicklung | Umschalter **Prognose** · **Detail** · **Aus Wohnungen**; „Mietsteigerung p.a." |
| Prognose-Annahmen | Wertsteigerung, Kostensteigerung, Leerstand, Betrachtungszeitraum, Exit-Rendite (bei neuen Objekten aus den Einstellungen) |
| MFH | „Aus Wohnungen" liest die Wohnungen aus dem MFH-Konfigurator (siehe [07](07-mfh-konfigurator.md)) |

**Warmmiete (seit v2484 festgelegt):** Nettokaltmiete + Nebenkostenvorauszahlungen der Mieter. Zusatzeinnahmen (Stellplatz, Garage) stehen getrennt. Dieselbe Kette in App, Bank-PDF und Investment-PDF.

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH, DEMO-BI1, 6 WE laut Gutachten)

| Feld | Wert |
|---|---|
| Nettokaltmiete / Monat | 3.195 € (Wohnungen 590 / 600 / 585 / 585 / 415 / 420 €; 4 × 70 m² + 2 × 55 m²) |
| Zusätzliche Einnahmen / Monat | 90 € (4 Garagen à 30 €, drei vermietet) |
| Soll-Miete je Wohnung (Konfigurator) | **leer** — DealPilot rechnet selbst bis Marktmiete/Kappungsgrenze |
| Zielbild | 9,50 €/m² für WE 1, 3, 4, 5; fertig 2030 |
| Mietentwicklung | **Aus Wohnungen** |

Was die App zeigt:

| Anzeige | Wert | Warum |
|---|---|---|
| Mieteinnahmen im Jahr (NKM + Zusatz) | 39.420 € = (3.195 + 90) × 12 | Zusatzeinnahmen stehen in Ist und Soll |
| nach der Mieterhöhung | Zahl live zeigen | die vom Gesetz gedeckelte Soll-Miete je Wohnung; danach läuft die Mietsteigerung weiter |
| Freigabe „Aus Wohnungen" | Zahl live zeigen (6 Wohnungen, alle vermietet) | eine vermietete Wohnung mit Ist-Miete genügt (v2410) |
| Warmmiete / Jahr | Zahl live zeigen — rechnerisch (3.195 + 976) × 12 = 50.052 € | eine Definition in App, Bank- und Investment-PDF (v2484); NK-Vorauszahlungen seit 20.10. 976 €/Monat statt 143,92 € |
| Bruttomietrendite Ist (MFH-Tafel) | 7,23 % auf den Kaufpreis; Soll live zeigen | gleiche Basis für den Vergleich |

## 3b · Beispiel Pilot-Mietpreis-Analyse: Hermannstr. 9, Hüllhorst (ETW)

Knopf **Mietpreis recherchieren**. Der Pilot bekommt zuerst die belegten Vergleichswerte aus DealPilots Daten:

| Vergleichswert | Wert | Herkunft in der Tabelle |
|---|---|---|
| Amtliche Vergleichsmiete (Mietpreisübersicht des Gutachterausschusses) | 4,83 €/m² | amtlich |
| Aktueller Marktdurchschnitt (Angebotsmieten) | 8,06 €/m², Spanne 6,69–8,88, 20 Angebote, 5 km | Markt |
| Marktüblichkeitsband (Wertermittlung) | 3,38–10,48 €/m² | Wertermittlung |
| Leerstand laut Zensus 2022 (Stichtag 15.05.2022), Gemeinde | marktaktiv 1,2 % | amtlich |
| Bevölkerung (Kreis) | +0,3 % im Jahr | amtlich |

Ergebnis eines echten Laufs: Marktmiete **7,66 €/m²** — „5 % unter dem Marktdurchschnitt 8,06, 59 % über der amtlichen 4,83"; ein Häkchen markiert, worauf sich die KI stützt. Den Zensus-Anhalt beim Mietausfall-Risiko übernimmst du mit „Zensus-Anhalt übernehmen".

Belegt: Westerfeld-Mieten je Wohnung, Garagen, NK 976 €, leeres Soll, Zielbild demo-geschichten D (Befüllung 20.10.2026); 39.420 € = (3.195 + 90) × 12 und 7,23 % = 39.420 / 545.000 nachgerechnet (Ist-Summe und Zusatz unverändert); Definition Warmmiete Journal v2483–v2485; Hüllhorst-Vergleichswerte und 7,66 €/m² Journal v2500–v2501 (Container-Nachweis, Lauf 2). „Mietsteigerung läuft nach dem Soll weiter" Journal Prod-Rollout (54) v2422.

## 4 · Was man daraus liest — Fragen am Stand

**Was ist bei DealPilot die Warmmiete?** Nettokaltmiete plus Nebenkostenvorauszahlungen der Mieter. Stellplätze und Garagen stehen als Zusatzeinnahmen daneben.

**Prognose, Detail oder Aus Wohnungen — was nehme ich?** Prognose für eine gleichmäßige Steigerung, Detail für geplante Erhöhungen nach Mietspiegel, Aus Wohnungen beim Mehrfamilienhaus, wenn du je Wohnung eine Soll-Miete oder Staffel hast.

**Woher kommt die Marktmiete?** Aus der Marktbewertung oder der Pilot-Mietpreis-Analyse. Sie wird mit deiner Ist-Miete verglichen und geht in den Investor Deal Score.

**Wo ist der Zensus geblieben?** Aus dem Reiter Miete genommen — die Bestandsmiete des Zensus hat mit der Marktmiete nichts zu tun. Den Leerstand nutzt die Pilot-Mietpreis-Analyse weiter beim Mietausfall-Risiko.

**Wie aktuell ist der Zensus?** Zensus 2022, Stichtag 15.05.2022. Einen jüngeren amtlichen Leerstand je Gemeinde gibt es nicht; der nächste Zensus ist 2031.

## 5 · Grenzen und Kennzeichnung

- Angebotsmieten sind „aktueller Marktdurchschnitt" — die Quelle wird nach außen nicht genannt; ein Abschlag für Mieten ist nicht gemessen.
- Die Pilot-Mietpreis-Analyse ist eine **KI-Einschätzung**; jede Zeile der Vergleichstabelle trägt ihre Herkunft (amtlich, Markt, Wertermittlung, KI, deine Angabe).
- Im Modus „Aus Wohnungen" zählt das Zielbild nicht mit, nur die Soll-Miete (Mieter bleibt).
- Soll-Miete nach § 558 BGB ist eine Rechenhilfe, keine Rechtsberatung — Kappungsgrenze und Fristen siehe [07](07-mfh-konfigurator.md).

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Karte Mietstruktur | Nettokaltmiete eintragen | Nettokaltmiete, Stellplätze, Nebenkostenvorauszahlungen — DealPilot rechnet Warmmiete und Jahreswerte. |
| 2 | „= Warmmiete / Jahr" | — | Warmmiete heißt: Nettokaltmiete plus Vorauszahlungen der Mieter. Überall dieselbe Rechnung. |
| 3 | Mietentwicklung | Aus Wohnungen | Beim Mehrfamilienhaus rechnet jede Wohnung ihre eigene Soll-Miete. |
| 4 | Tabelle Mietentwicklung | — | 39.420 € heute — danach steigt die Miete mit jeder erlaubten Erhöhung bis zum Zielbild 2030. |
| 5 | Karte Marktmiete + Mietausfall | Mietpreis recherchieren | Der Pilot recherchiert die Marktmiete — gestützt auf belegte Vergleichswerte. |
| 6 | Tabelle Vergleichswerte | — | Amtlich, Markt, Wertermittlung: jede Zeile mit Herkunft. Ein Häkchen zeigt, worauf sich der Pilot stützt. |

### Sprechertext (Entwurf, ca. 95 Sekunden)

Miete ist der Treibstoff jedes Investments. Im Reiter Miete trägst du ein, was heute fließt: die Nettokaltmiete, Einnahmen aus Garagen und Stellplätzen und die Nebenkostenvorauszahlungen deiner Mieter. Daraus rechnet DealPilot die Warmmiete — und zwar überall gleich, in der App wie in beiden PDFs.

Darunter legst du fest, wie sich die Miete entwickelt. Mit Prognose steigt sie gleichmäßig. Mit Detail planst du einzelne Erhöhungen. Beim Mehrfamilienhaus wählst du „Aus Wohnungen". In der Westerfeldstraße bringen sechs Wohnungen und die Garagen heute neununddreißigtausendvierhundertzwanzig Euro im Jahr. Danach rechnet DealPilot jede erlaubte Mieterhöhung selbst — bis zum Zielbild im Jahr zweitausenddreißig.

Und was ist marktüblich? Ein Klick auf „Mietpreis recherchieren" startet die Pilot-Mietpreis-Analyse. Der Pilot bekommt zuerst die belegten Werte aus DealPilots Daten: die amtliche Vergleichsmiete des Gutachterausschusses, den aktuellen Marktdurchschnitt der Angebotsmieten und das Marktüblichkeitsband aus der Wertermittlung. Jede Zeile trägt ihre Herkunft, und ein Häkchen zeigt, worauf sich die Einschätzung stützt. So weißt du, ob deine Miete Luft nach oben hat.

## Querverweise

- [04 · Reiter Objekt](04-reiter-objekt.md) — Karte Mieterhöhung und Zielbild (ETW/EFH)
- [07 · MFH-Konfigurator](07-mfh-konfigurator.md) — Soll-Miete, Kappung, Zielbild
- [09 · Bewirtschaftung](09-bewirtschaftung.md) — umlagefähige Kosten
- [15 · Deal Score und Investor Deal Score](15-deal-score-und-investor-deal-score.md)
- [16 · Pilot-Analyse](16-pilot-analyse.md)
- [20 · Bank-PDF und Investment-PDF](20-bank-pdf-und-investment-pdf.md) — Warmmiete-Kette
