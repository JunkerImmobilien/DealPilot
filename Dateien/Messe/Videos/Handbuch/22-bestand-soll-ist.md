# 22 · Bestand gegen Ankauf — Soll und Ist

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 14 · Vom Ankauf in den Bestand (`reihe-bestand`, `?modul=14`, 2:39) und Modul 15 · Steuer im Bestand (`reihe-steuer-bestand`, `?modul=15`, 4:34) ·
> Messe-Geschichten: 1 (Ravensberger Weg 38), 2 (Bismarckstr. 27), 3b (Parkstr. 9) — mit den Korrekturen vom 20.10.2026 (design/Messe/demo-geschichten.md)

## 1 · Wozu

Beim Kauf rechnest du einen Plan. Im Reiseflug zeigt sich, ob das Objekt liefert. DealPilot hält den Plan vom Kauftag fest — den **Ankauf-Stand** — und stellt ihn jedes Jahr neben das **Ist**. So siehst du nicht nur, *dass* etwas besser oder schlechter läuft, sondern **wo**: Miete, Kosten, Finanzierung, Steuer, Ergebnis.

## 2 · Wo in der App

- **Gewonnen setzen:** Reiter Deal-Aktion → Deal-Status „Gewonnen". Steht im Reiter Objekt der Nutzen-/Lastenwechsel („Wirtsch. Übergang"), schreibt DealPilot den ganzen Datensatz zu diesem Tag fest. Fehlt das Datum, wird nichts eingefroren, und DealPilot sagt, was fehlt.
- **Umschalter oben im Objekt:** „Ist · heute" (frei zu pflegen) | „Soll · Ankauf-Stand" (gesperrt; Korrektur nur über „zum nachträglichen Bearbeiten freigeben", mit Nachweis).
- **Abweichungstafel** im Reiter Objekt (`abweichung.js`): Zeilen in den Gruppen **Ertrag · Kosten · Finanzierung · Steuer · Ergebnis**, je Kennzahl mit Richtung (mehr Miete ist besser, mehr Kaufpreis nicht). Eine fehlende Zahl erzeugt keine Zeile; die Tafel sagt, wie viele von wie vielen vergleichbar sind.
- **Seitenleiste → „Stand"**: Bestand (gewonnene Objekte) | Ankauf (Akquise). Verlorene bleiben ausgegraut am Ende der Ankauf-Liste. Die Karte lässt sich umdrehen und zeigt den Ankauf-Stand.
- **Pilot-Analyse → Reiter „Soll/Ist"** (Pille des Co-Piloten) und der Reiter „Ankauf · Bestand · Zielbild" (Handbuch 16).

## 3 · Schritt für Schritt — drei Bestandsobjekte

### a) „Über Plan" — Ravensberger Weg 38, Bielefeld (MFH, 8 WE, Bj 1978, gekauft 01.04.2020)

| | Plan beim Kauf 2020 | Ist heute |
|---|---:|---:|
| Nettokaltmiete / Monat | 4.910 € | **5.500 €** (+12 %) |
| DSCR | 1,22 | **1,37** |
| Cashflow nach Steuern / Jahr | 5.577 € | **10.739 €** |
| Steuerwirkung / Jahr | 2.257 € | **−721 €** |

Warum sinkt die Steuerwirkung? Mehr Miete heißt mehr zu versteuerndes Ergebnis. Genau dort beginnt die Frage „Wo investiere ich?" → Handbuch 14 (Wendepunkt). Zusatz: seit 20.10. ist das eigene Soll der Wohnungen leer (vorher 703 € unter Ist 717 €) — DealPilot rechnet die Mieterhöhung selbst bis Marktmiete/Kappungsgrenze. Was sie jetzt zeigt: live zeigen.

### b) „Unter Plan" — Bismarckstr. 27, Detmold (MFH, 6 WE, Bj 1908, gekauft 01.07.2023)

| | Plan 2023 | Ist heute |
|---|---:|---:|
| Nettokaltmiete / Monat | 4.506 € | **3.670 €** (zwei Einheiten leer) |
| Instandhaltung / Jahr | 8.402 € | **11.763 €** (+40 %, Dachreparatur) |
| DSCR | 1,18 | **0,97** |
| Cashflow nach Steuern / Jahr | −1.644 € | **−9.627 €** |

DSCR unter 1: die Miete trägt den Kapitaldienst nicht mehr. Die Tafel zeigt die zwei Ursachen — Leerstand und Instandhaltung; welche Wohnung leer steht, zeigt der MFH-Konfigurator (Handbuch 07).

### c) „Altbau mit Hebel" — Parkstr. 9, Bad Oeynhausen (MFH 1905, 5 WE, gekauft 23.12.2024 für 780.000 €)

| | Plan beim Kauf | Ist heute |
|---|---:|---:|
| Nettokaltmiete / Monat | 2.321 € | **3.195 €** (+38 %) |
| Miete je m² | 5,44 € | **7,48 €** |
| Leere Einheiten | 1 | **0** |
| DSCR | 0,90 | **1,23** |
| Cashflow nach Steuern / Jahr | −6.193 € | **+873 €** |

Steuer 2025: Sanierung der leeren Wohnung als Erhaltungsaufwand sofort abgesetzt — **Erstattung 16.458 €** (unter der 15-%-Grenze, Handbuch 13). **Achtung Score:** heute Investor Deal Score **58**, DealPilot-Score **28** — beim Zeigen die richtige Zahl nennen.

**Belegt:** Tabellen a–c aus demo-geschichten.md Geschichten 1, 2, 3b, korrigiert nach „Korrekturen an den Geschichten 1–7 (gemessen 20.10.2026)" (Ravensberger Steuerwirkung −721 €, Soll seit 20.10. leer; Parkstr. Erstattung 16.458 €, Scores 58/28); Cashflow n. St. Ravensberger 10.739 €, Bismarck −9.627 €, Parkstr. 873 € und DSCR 1,37 / 0,97 / 1,23 aus der Objektliste Staging nach der Befüllung (gemessen 20.10.2026). Ablauf aus `help.js` Abschnitt „Bestand: Soll und Ist", Gruppen aus `abweichung.js` Z. 104. Modul 15 maß am 16.10. an der Kopie Parkstr. 9 die Steuerwirkung geplant 4.555 € / heute 1.008 € und CF n. St. 748 € — der aktuelle Stand ist 873 €.

## 4 · Was man daraus liest — Fragen am Stand

- **„Warum eingefroren? Ich will doch aktualisieren."** — Das Ist pflegst du frei. Eingefroren ist nur der Maßstab. Wer den Plan mitwachsen lässt, misst am Ende nur sich selbst.
- **„Ich habe meine Objekte schon Jahre — geht das nachträglich?"** — Ja: Objekt mit Kaufdaten anlegen, auf Gewonnen setzen, Datum „Wirtsch. Übergang" eintragen. Der Ankauf-Stand zeigt dann deine damalige Rechnung, so gut du sie einträgst.
- **„Was sieht die Bank?"** — Den DSCR heute gegen den beim Kauf. Bismarck 0,97 ist ein Gesprächsthema, Ravensberger 1,37 ein Argument.

## 5 · Grenzen und Kennzeichnung

- Die Tafel rechnet **nichts neu**: sie vergleicht zwei Sätze gespeicherter Kennzahlen, jeder von den echten Rechenkernen zu seiner Zeit gerechnet.
- Fehlt eine Zahl im Plan oder im Ist, erscheint die Zeile nicht (keine „0 %").
- Steuerzahlen sind Rechenhilfe, **keine Steuerberatung**.
- Demo-Zahlen in den Objekten des Messe-Kontos sind teils Demo-Annahmen (siehe Inventur in demo-geschichten.md) — am Stand als Beispiel kennzeichnen.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Deal-Aktion, Status „Gewonnen" | Status setzen (Kopie) | Gewonnen: DealPilot friert den Plan zum Nutzen-/Lastenwechsel ein — das Soll. |
| 2 | Seitenleiste, Filter „Stand" | Bestand | Bestand und Ankauf getrennt. Die Karte dreht sich um und zeigt den Ankauf-Stand. |
| 3 | Umschalter Ist · heute / Soll · Ankauf-Stand | Soll | Das Soll ist gesperrt. Gepflegt wird das Ist — der Maßstab bleibt. |
| 4 | Abweichungstafel | Gruppe Ertrag | Ertrag, Kosten, Finanzierung, Steuer, Ergebnis: DealPilot zeigt, wo das Objekt vom Plan abweicht. |
| 5 | Parkstr. 9: Miete 2.321 → 3.195 € | — | Leere Wohnung saniert und neu vermietet: plus 38 Prozent Miete, DSCR von 0,90 auf 1,23. |
| 6 | Pilot-Analyse, Reiter Soll/Ist | — | Der Pilot erklärt die Abweichung in Worten und nennt die Hebel. |

### Sprechertext (Entwurf, ca. 85 Sekunden)

Ein Objekt ist gekauft — jetzt beginnt der Reiseflug. In der Deal-Aktion setzt du es auf gewonnen. DealPilot friert dann den Plan vom Tag des Nutzen- und Lastenwechsels ein. Das ist dein Soll.

Oben im Objekt schaltest du zwischen Ist und Soll. Das Ist pflegst du frei, das Soll bleibt stehen. Warum? Damit die Abweichung nach zehn Jahren noch etwas bedeutet.

Die Abweichungstafel zeigt, wo das Objekt anders läuft als geplant — beim Ertrag, bei den Kosten, bei Finanzierung, Steuer und Ergebnis. Ein Beispiel, die Parkstraße in Bad Oeynhausen: Beim Kauf stand eine Wohnung leer, die Miete trug den Kredit nicht. Heute ist die Wohnung saniert und vermietet, die Miete liegt achtunddreißig Prozent höher, und der DSCR ist von null Komma neun auf eins Komma zwei drei gestiegen.

Und wo es schlechter läuft, sagt DealPilot das genauso deutlich — mit dem Grund. Leerstand, Instandhaltung, Zins. Du siehst, wo du ansetzen musst.

## Querverweise

- Handbuch 21 (Deal-Aktion), 07 (MFH-Konfigurator), 13 (Werbungskosten, 15-%-Grenze), 14 (Steuerverlauf), 16 (Pilot-Analyse), 23 (Portfolio-Cockpit, Kachel „Seit Ankauf")
- Videoreihe.md Module 14, 15 · `messe-drehbuch.js` `DREHBUECHER['reihe-bestand']` (Z. 3270), `DREHBUECHER['reihe-steuer-bestand']` (Z. 3563)
