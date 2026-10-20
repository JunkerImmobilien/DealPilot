# 14 · Steuerverlauf mit Wendepunkt — wann das Objekt steuerlich positiv wird

> Stand 20.10.2026 (Staging bis v2544, NEU in v2544, Commit `47322445`). Zahlen vor der Messe live gegenprüfen.
> Video: noch keins (Vorschlag: Ergänzung zu Modul 15 `reihe-steuer-bestand` oder eigenes Kurzvideo) ·
> Messe-Geschichten: 3 Gohliser „Im Jahr 6 investieren", 15 Steuerberater (design/Messe/demo-geschichten.md) ·
> Vorlage: design/Vorschläge/steuerverlauf-demo.html

## 1 · Wozu

Jedes vermietete Objekt fliegt steuerlich eine Kurve: In den ersten Jahren drücken Zinsen, Abschreibung und Sanierung
das Ergebnis ins Minus — das Finanzamt erstattet. Mit steigender Miete und sinkenden Zinsen dreht das Ergebnis ins Plus,
und ab dann zahlst du Steuern auf dieses Objekt. Diesen **Wendepunkt** zeigt DealPilot jetzt auf einen Blick, über die
ganze Haltedauer. Marcel: „Das ist ja der Punkt, wo ich investiere" — dort gleicht ein weiteres Investment mit
Anfangsverlusten die Steuerlast wieder aus.

## 2 · Wo in der App

- **Reiter Steuer** → Karte **„Steuerverlauf · wann das Objekt steuerlich positiv wird"**: die Grafik steht **über der
  Kärtchen-Reihe** der Jahre (`frontend/js/tax.js:982–995`, Modul `frontend/js/steuer-verlauf.js`).
- **Pilot-Analyse → Unterreiter „Steuer"**: dieselbe Grafik als Karte „STEUERVERLAUF · WANN DAS OBJEKT STEUERLICH
  POSITIV WIRD" (`frontend/js/ui.js:2146–2148`).
- Inhalt:
  - vier Kennzahlen: **Steuerlich positiv ab** · **Erstattungen bis dahin** · **Steuern ab dem Wendepunkt** ·
    **Ergebnis V+V im letzten Jahr**;
  - ein Satz, der das Bild in Worte fasst;
  - Balken je Jahr (Ergebnis aus V+V: Verlust grün, Gewinn gold), Linie **Cashflow nach Steuern**, gestrichelte Linie
    **„Wendepunkt <Jahr>: ab hier Steuern"**;
  - Ereignislinien: **„Zinsbindung endet"** (Kaufjahr + Zinsbindung) und **„Verkauf steuerfrei (§ 23 EStG)"**
    (Kaufjahr + 10, **nur im Privatvermögen**, nicht bei GmbH/UG);
  - Tooltip je Jahr: Einnahmen, Werbungskosten, Ergebnis V+V, Erstattung/Steuer, Cashflow nach Steuern.
- **Rechnet nichts selbst:** Die Jahreswerte kommen aus derselben Rechnung wie Steuerformular und Jahres-Kärtchen
  (`_computeYearTotal`), der Cashflow aus der Cashflow-Tabelle. Werbungskosten im Detail (13) wirken also sofort.

## 3 · Schritt für Schritt — Beispiel Bismarckstr. 27, Detmold (MFH, KP 1.150.000 €, Kauf 07/2023, Grenzsteuersatz 42 %)

Eingaben: keine neuen — das Objekt muss gerechnet sein (Kaufdatum, Miete, Finanzierung mit Zinsbindung, Steuer).
Reiter Steuer öffnen.

**Zahlen der Vorlage** (design/Vorschläge/steuerverlauf-demo.html, dort als echte Zahlen des Objekts geführt; in der App
live gegenprüfen):

| Jahr | Ergebnis V+V | Erstattung (+) / Steuer (−) |
|---|---:|---:|
| 2023 (halbes Jahr) | −8.187 € | +3.270 € |
| 2024 | −18.968 € | +7.220 € |
| 2025 | −18.980 € | +7.225 € |
| 2026 | −18.598 € | +7.092 € |
| **2027** | **+10.569 €** | **−4.439 €** |

**Was die App zeigt:** „Steuerlich positiv ab **2027**, nach vier Verlustjahren". Erstattungen bis dahin zusammen rund
24.800 €. Der Satz: „Bis 2026 senkt das Objekt deine Steuer … Ab 2027 wird das Ergebnis positiv — ab hier zahlst du auf
dieses Objekt Steuern." Die Linie „Zinsbindung endet" liegt laut Vorlage 2033; die § 23-Linie zehn Jahre nach dem Kauf.

**Gegenbild — Westerfeldstr. 140, Bielefeld (Kauf 2025):** vom ersten Jahr an positiv — 2025 Ergebnis +4.663 €,
Steuer 1.952 €; 2026 Steuer 2.346 €. Die App sagt: „vom ersten Jahr an steuerlich positiv … Ein Objekt mit
Anfangsverlusten daneben würde die Last senken."

**Gohliser Str. 42, Leipzig — gesteuerter Knick:** Die gespeicherte Zeitreihe steigt bis 2028 auf 15.290 € Steuer; 2029
macht die geplante Fassade/Dach (40.000 € Erhaltung) das Jahr zur Erstattung (**−553 €**), 2030 wieder 17.224 €. In der
Grafik sieht man genau, wo eine Maßnahme die Kurve umdreht.

Belegt: Bismarckstr.-Reihe und Westerfeld-Reihe design/Vorschläge/steuerverlauf-demo.html Z. 95–100 (Summe 24.807 €
nachgerechnet); Westerfeld 2026 = Korrektur zu Geschichte 4; Gohliser Korrektur zu Geschichte 3; Kennzahlen, Satz,
Ereignisse `steuer-verlauf.js:40–100`.

## 4 · Was man daraus liest — Fragen am Stand

- **„Wann muss ich mit Steuern auf mein Objekt rechnen?"** — Ab dem Wendepunkt. Das Jahr steht oben links.
- **„Und was mache ich dann?"** — Genau dort lohnt der Blick nach vorn: Erhaltungsaufwand planen (nach der
  15-%-Grenze, siehe 13) oder ein weiteres Objekt mit Anfangsverlusten. Was davon passt, entscheidest du mit deinem
  Steuerberater.
- **„Warum ist der Cashflow trotzdem positiv, wenn ich Steuern zahle?"** — Ergebnis und Cashflow sind zwei Dinge: Die
  AfA mindert die Steuer, kostet aber kein Geld; die Tilgung kostet Geld, mindert aber die Steuer nicht.
- **„Was bedeutet die Linie § 23?"** — Nach zehn Jahren im Privatvermögen ist ein Verkaufsgewinn steuerfrei. Bei einer
  GmbH gibt es diese Linie nicht.

## 5 · Grenzen und Kennzeichnung

- **Keine Steuerberatung.** Fußzeile der Grafik: „Ergebnis aus V+V = Einnahmen minus Werbungskosten … Steuerwirkung mit
  deinem Grenzsteuersatz. Keine Steuerberatung."
- Die Grafik ist nur so gut wie die Eingaben: ohne Werbungskosten im Detail rechnen die Vorschlagswerte.
- Die Reihe läuft über den Betrachtungszeitraum des Objekts; liegt der Wendepunkt dahinter, steht „nicht im Zeitraum".

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Steuer, Grafik oben | Reiter Steuer | Der Steuerverlauf über die ganze Haltedauer — ein Balken je Jahr: grün Erstattung, gold Steuern. |
| 2 | Kennzahl „Steuerlich positiv ab 2027" | — | Nach vier Verlustjahren dreht das Ergebnis ins Plus. Ab hier zahlst du auf dieses Objekt Steuern. |
| 3 | Kennzahl „Erstattungen bis dahin" | — | Bis dahin hat das Objekt deine Steuer gesenkt — zusammen rund 24.800 Euro. |
| 4 | Tooltip über 2027 | Maus auf 2027 | Je Jahr Einnahmen, Werbungskosten, Ergebnis, Steuer und Cashflow nach Steuern — dieselbe Rechnung wie das Steuerformular. |
| 5 | Ereignislinien | — | Ende der Zinsbindung und zehn Jahre Haltedauer: danach ist ein Verkauf im Privatvermögen steuerfrei. |
| 6 | Westerfeldstr. 140 | Objekt wechseln | Dieses Haus ist vom ersten Jahr an positiv. Ein Objekt mit Anfangsverlusten daneben würde die Last senken. |
| 7 | Pilot-Analyse, Unterreiter Steuer | Reiter „Steuer" | Dieselbe Grafik steht in der Pilot-Analyse. Keine Steuerberatung — aber die Frage für deinen Steuerberater. |

### Sprechertext (Entwurf, ca. 90 Sekunden)

Jedes vermietete Haus fliegt steuerlich eine Kurve. In den ersten Jahren drücken Zinsen, Abschreibung und Sanierung das
Ergebnis ins Minus — das Finanzamt erstattet. Irgendwann dreht es ins Plus, und ab dann zahlst du Steuern.
Genau diesen Wendepunkt zeigt DealPilot jetzt im Reiter Steuer. Ein Balken je Jahr: grün, solange das Objekt deine Steuer
senkt, gold, sobald es Steuern kostet. In unserem Beispiel in Detmold kommen nach vier Verlustjahren rund
vierundzwanzigtausend Euro Erstattung zusammen — ab 2027 wird das Ergebnis positiv.
Darüber liegen die Ereignisse: das Ende der Zinsbindung und die zehn Jahre, nach denen ein Verkauf im Privatvermögen
steuerfrei ist.
Warum ist das wichtig? Weil der Wendepunkt der Moment ist, an dem man investiert — mit Erhaltungsaufwand oder einem
weiteren Objekt, dessen Anfangsverluste die Last wieder ausgleichen. DealPilot zeigt dir den Zeitpunkt. Was du daraus
machst, besprichst du mit deinem Steuerberater.

## Querverweise

10 Steuer-Grundlagen · 13 Werbungskosten und 15-%-Grenze · 16 Pilot-Analyse (Unterreiter Steuer) · 22 Bestand ·
23 Portfolio-Cockpit (Steuer über alle Objekte).
