# QA Punkt 19 — fachliche Plausibilität der Kennzahlen (Teil 1: Rechenkern)

**18.09.2026** · gerechnet mit dem echten `DealKpis.compute()` (Node, ohne
Browser). Der Browser-Teil (Durchlauf aller Abläufe, Marktbericht je Stufe im
Dokument, Mobile/Punkt 20) steht aus — die Chrome-Erweiterung war in dieser
Sitzung nicht verbunden.

## Testobjekte

| Objekt | GI | BMY | NMY | LTV | EK-Anzeige | DSCR | CF/Monat | EK-Rendite |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ETW Bestand (250 T€, 100 % KP finanziert) | 275.000 | 4,56 % | 3,75 % | 100,0 % | 0 % | 0,79 | −350 € | −16,8 % |
| EFH vermietet | 477.000 | 4,71 % | 3,67 % | 90,5 % | 10 % | 0,91 | −347 € | −4,3 % |
| MFH Bestand 8 WE | 935.000 | 7,34 % | 5,84 % | 94,1 % | 6 % | 1,32 | +617 € | 5,5 % |
| **MFH Value-Add** (400 T€ + 600 T€ Sanierung) | 1.040.000 | 6,00 % | 1,81 % | **250,0 %** | **−150 %** | 0,39 | −3.517 € | −105,5 % |
| **Vollfinanzierung, EK 0** | 220.000 | 4,80 % | 3,95 % | 110,0 % | **−10 %** | 0,74 | −357 € | **0,0 %** |

Die Gesamtinvestition stimmt in allen fünf Fällen (KP + NK + Sanierung).

## Befunde

1. **EK-Anzeige negativ** — Value-Add −150 %, Vollfinanzierung −10 %. Der Tab
   Finanzierung zeigt `100 − LTV` (`calc.js:1437`). Das ist keine EK-Quote,
   sobald das Darlehen über der LTV-Bezugsgröße liegt — also bei **jeder**
   Finanzierung über 100 % des Kaufpreises, nicht nur bei Sanierung.
   *Vorschlag steht in `ltv-sanierung-value-add.md` (EK ÷ Gesamtinvestition).*

2. **LTV 250 % beim Value-Add** — Nenner ist der Kaufpreis, das Darlehen deckt
   die Sanierung mit. *Punkt 5, Vorschlag steht.*

3. **Bruttomietrendite auf Kaufpreis** beim Value-Add 6,00 %, auf die
   Gesamtinvestition 2,31 %. Mit Soll-Miete wird die Lücke größer
   (Beispiel in Punkt 5: 18 % gegen 6,9 %). *Punkt 5.*

4. **EK-Rendite 0 % bei 0 € Eigenkapital** — `deal-kpis.js`: `ekr = ek > 0 ?
   … : 0`. Eine nicht bestimmbare Größe erscheint als Messwert Null
   (CLAUDE.md: „Number(null) ist 0 …"). **Nicht blind geändert:** Score und
   Anzeigen verarbeiten `ekr` weiter; ein `null` muss an jeder Stelle geprüft
   werden, bevor es eingeführt wird. → Browser-QA.

5. **Doppelte Kennzahlenrechnung** — `calc.js` rechnet alle Kennzahlen neben
   `DealKpis` her (Punkt 5). Für die Abschluss-QA gehört ein Vergleich beider
   an denselben Objekten dazu, sobald der Browser verfügbar ist.

## Noch offen (braucht den Browser)

- Jede Marktbericht-Stufe als Dokument prüfen (Web + PDF) — der Rechenkern ist
  auf Staging gemessen (v1435), das Dokument nicht.
- Konsistenz: Eingabe ändern → alle Tabs, Score, PDF ziehen nach.
- Regression der zentralen Abläufe, Sichtabnahmen v1428–v1439.
- Punkt 20 (Mobile/Tablet) vollständig.

---

## Teil 2 — im Browser, am echten Objekt (18.09.2026, abends)

**Beide Rechenkerne am selben Objekt** (Staging, geladenes Objekt, Bezug
Verkehrswert 214.600 €): `calc.js` (Haupt-App) gegen `DealKpis.compute()`
(Quick Check, Sprechlauf, Dashboard) mit denselben Eingaben.

| Kennzahl | calc.js | DealKpis | |
|---|---:|---:|---|
| Gesamtinvestition | 220.400 | 220.400 | gleich |
| Bruttomietrendite | 6,60 % | 6,60 % | gleich |
| Nettomietrendite | 5,957 % | 5,957 % | gleich |
| LTV | 83,877 % | 83,877 % | gleich |
| DSCR | 1,833 | 1,833 | gleich |
| **EK-Rendite** | **20,58 %** | **29,65 %** | **verschieden** |

**Ursache — zwei Definitionen unter einem Namen:**
- `calc.js:2079`: `ekr = cf_ns / ekv` — Cashflow **nach** Steuern.
- `deal-kpis.js:169`: `ekr = cf_banker_j / ek` — Cashflow **vor** Steuern.

Beide gehen als „Cash-on-Cash" in den Deal Score (`dealscore2-ui.js:54`,
`quick-check.js:541`). **Der Quick Check bewertet dasselbe Objekt deshalb
anders als die Haupt-App.** Nicht geändert — welche Definition gilt, ist
Marcels Entscheidung. Vorschlag: im Score **vor Steuern** (vergleichbar
zwischen Anlegern mit verschiedenem Steuersatz), nach Steuern als eigene,
anders benannte Kennzahl („EK-Rendite nach Steuern").

**Konsistenz (Eingabe ändern → alles zieht nach):** Kaufpreis 200.000 →
250.000 € am geladenen Objekt: Gesamtinvestition 220.400 → 275.500, BMY
6,60 → 5,28 %, Score 87 → 82; LTV (Bezug Verkehrswert) und DSCR (gleiches
Darlehen) richtig unverändert. Zurückgesetzt → alle Werte wie vorher. Ohne
Reiterwechsel gemessen (der speichert das Objekt).
