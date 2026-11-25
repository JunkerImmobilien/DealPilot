# Rendite-Grundlage der Scores: EK-Rendite statt Cash-on-Cash (v4760, nur Staging)

Stand 25.11.2026. Wartet auf Marcels Freigabe, nicht auf Prod.

## Befund vorab

- **Deal Score** (`dealscore.js`, auch Quick-Check und Deal-Check über `qc-score-weg.js`) hat **keine** Kennzahl für Cash-on-Cash oder EK-Rendite. Er rechnet mit Cashflow, Nettomietrendite, LTV, DSCR und Potenzial. Die Aussage vom 25.11. „der Deal Score rechnet mit Cash-on-Cash“ war falsch: das tut nur der Investor Deal Score. Am Deal Score ändert sich deshalb nichts.
- **Investor Deal Score** (`dealscore2.js`, Kennzahl `cashOnCash`, Rendite-Gruppe 20 % bzw. Gruppe „Cashflow & EK-Rendite“ im Finanzierungs-Score) bekam bisher Cash-on-Cash vor Steuer (`State.kpis.ekr`). Der Sprach-Import rechnete dieselbe Kennzahl schon nach Steuer (`cf_ns / EK`), also anders als die App.

## Was v4760 ändert

| Stelle | vorher | nachher |
|---|---|---|
| Investor Deal Score, Eingabe | Cash-on-Cash vor Steuer | EK-Rendite **Stufe 2** „nach Steuer“ aus `DpEkRendite` (Überschuss nach Steuer + Tilgung, durch EK) |
| Investor Deal Score, Name der Kennzahl | Cash-on-Cash | EK-Rendite nach Steuer (Schlüssel bleibt `cashOnCash`, gespeicherte Gewichte gelten weiter) |
| Sprach-Import | `cf_ns / EK` | dieselbe Stufe 2 über `DpEkRendite` |
| Landing „Fächer“ | Cash-on-Cash | Stufe 2 (ohne Steuerangaben ist die Steuer 0, also Überschuss + Tilgung) |
| Deal Score | unverändert | unverändert |

Stufe 3 und 4 (mit Vermögensdelta) gehen in **keinen** Score: Die Wertsteigerung ist eine Annahme, steckt über den Wertpuffer schon im Score, und der Hebel würde sie vervielfachen.

## Schwellen je Profil (Punkte 0 bis 100, linear dazwischen)

| Profil | vorher (Cash-on-Cash) | nachher (Stufe 2) |
|---|---|---|
| Ausgewogen (auch Lage-Fokus, Cashflow-Fokus, Sicherheit) | 0 % → 0 · 3 → 40 · 6 → 70 · 10 → 100 | 2 % → 0 · 6 → 40 · 10 → 70 · 15 → 100 |
| Vorsichtig | 0 → 0 · 4 → 40 · 8 → 70 · 12 → 100 | 3 → 0 · 7 → 40 · 12 → 70 · 16 → 100 |
| Renditeorientiert | −2 → 0 · 2 → 50 · 5 → 80 · 9 → 100 | 0 → 0 · 5 → 50 · 9 → 80 · 13 → 100 |

**Herleitung:** Stufe 2 liegt über Cash-on-Cash, weil Tilgung und Steuerwirkung dazukommen. An 34 Staging-Objekten mit Eigenkapital lag der Abstand im Median bei 5,6 Prozentpunkten, mit großer Streuung (−6 bis +28, groß bei wenig Eigenkapital und hoher Erstattung). Eine reine Quantil-Angleichung hätte 5 % Stufe 2 mit 0 Punkten bewertet; das würde die Tilgung wieder bestrafen, also genau das, was die Umstellung beheben soll. Gewählt ist deshalb eine Verschiebung um 2 bis 5 Punkte mit breiterer Spitze. Prüfung über alle Profile an denselben Objekten: Gesamtscore im Mittel +0,1 bis +0,5, Median 0, Ausreißer −3 bis +8.

## Gemessen auf Staging (Demokonto, 44 Objekte, Profil Lage-Fokus, live mit v4760)

Nichts gespeichert: alle Schreibaufrufe im Messtab abgefangen (71), in der Datenbank kein `updated_at` der gemessenen Objekte verändert.

Gesamt: Investor Deal Score im Mittel **+0,2**, kleinster Wert −2, größter +4, **kein Stufenwechsel**, Deal Score bei allen 44 unverändert.

| Objekt | EK € | CoC % | Stufe 2 % | Deal Score | Investor vorher | Investor nachher | Stufe |
|---|---:|---:|---:|---:|---:|---:|---|
| Westerfeldstr. 146 Bielefeld | 74.592 | 5,6 | 13,3 | 84 | 68 | 69 | Solide |
| Westerfeldstr. 140 Bielefeld | 74.592 | 0,0 | 12,1 | 64 | 60 | **64** | Solide |
| Demostraße 5 Herford | 35.000 | −2,0 | 5,8 | 29 | 65 | 67 | Solide |
| Hauptstr. 51 Ibbenbüren (Ankauf) | 491.403 | 0,4 | 3,6 | 60 | 58 | 58 | Solide |
| Musterhof 8 Herford | 149.125 | 8,2 | 10,5 | 75 | 76 | 75 | Gut |
| Am Markt 18 Kabelsketal | 60.623 | 1,8 | 5,4 | 54 | 65 | 65 | Solide |
| Gohliser Str. 42 Leipzig | 474.536 | 3,5 | 5,2 | 87 | 77 | 76 | Gut |
| Musterstraße 12 Leipzig | 13.135 | −9,4 | 19,0 | 47 | 55 | **59** | Solide |
| Parkstr. 9 Bad Oeynhausen | 262.392 | 5,9 | 4,9 | 75 | 77 | **75** | Gut |
| Alexanderstraße 11 Bielefeld | 51.540 | 2,1 | 3,9 | 81 | 67 | 66 | Solide |
| Am Markt 9 Kabelsketal | 16.196 | 6,7 | 18,9 | 81 | 81 | 82 | Gut |
| Löhner Str. 278 Hiddenhausen | 118.195 | 1,2 | 5,7 | 73 | 65 | 66 | Solide |
| Hermannstraße 9 Hüllhorst | 47.540 | 13,6 | 13,8 | 63 | 75 | 75 | Gut |
| Musterallee 12 Herford | 258.441 | −0,2 | 4,1 | 48 | 61 | 62 | Solide |
| Musterweg 7 Bielefeld | 32.000 | −3,2 | 6,1 | 36 | 63 | 65 | Solide |
| Wilhelm-Busch-Straße 10 | 222.663 | 9,0 | 10,1 | 82 | 69 | 68 | Solide |
| Sachsenstraße 18 Herford (Vollfinanzierung) | ≤ 100 | – | – | 71 | 73 | 73 | Gut |
| Lindenallee 14 Herford | 123.497 | −29,4 | −5,3 | 11 | 49 | 49 | Schwach |

**Größte Sprünge und Ursache:**
- Westerfeldstr. 140 (+4): Cash-on-Cash 0 %, aber 12,1 % nach Steuer und Tilgung; die Tilgung auf wenig Eigenkapital zählt jetzt.
- Musterstraße 12 Leipzig (+4): 13.135 € Eigenkapital, Cash-on-Cash −9,4 %, mit Tilgung und Steuererstattung +19 %.
- Parkstr. 9 (−2): Steuernachzahlung, Stufe 2 liegt unter Cash-on-Cash (4,9 gegen 5,9) und die Schwelle ist höher.

Objekte mit 0 € Eigenkapital (Vollfinanzierung) behalten die bisherige Sonderregel (positiver Cashflow volle Punkte, negativer niedrige).

**Herford-Deal-Check (Sachsenstraße 18):** Der Deal-Check zeigt seit einzelcheck-6 den Deal Score (66, Solide) und keinen Investor Deal Score mehr. Die Umstellung ändert dort nichts.

## Prüfer

score-ketten 216 gleich, rechenkerne-spiegeln aktuell (kein gespiegelter Kern geändert), einzelcheck-pruefen grün, flow-berechnen grün (Basislinie unverändert, der Flow rechnet den Deal Score), ek-rendite-pruefen 51/51, vorschau sauber, buster-ebenen sauber. zwei-scores-pruefen: Vertrag V1 („Score bitgleich mit dem Stand vor v3076“) gibt dem alten Stand jetzt die neuen cashOnCash-Schwellen mit und prüft so, dass sich sonst nichts verschoben hat; danach grün. Benchmark-Bänder: Finanzierung Fall E 45 → 51, Fall G 72 → 76.

## Offen bei Freigabe

- Kachel-Erklärung im Portfolio-Cockpit (`dashboard.js` `_renditeTip`) nennt noch „Cash-on-Cash“; dort arbeitet gerade CC4, Umbenennung beim Prod-Rollout mitnehmen.
- Eigene (custom) Schwellen eines Nutzers für `cashOnCash` bleiben auf dem alten Maßstab, bis er sie neu setzt.
- Gespeicherte Investor-Scores (`_ds2_score`) ändern sich erst beim nächsten Speichern eines Objekts.
