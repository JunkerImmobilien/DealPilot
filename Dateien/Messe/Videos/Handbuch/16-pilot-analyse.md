# 16 · Pilot-Analyse

> Stand 20.10.2026 (Staging bis v2544). Zahlen vor der Messe live gegenprüfen.
> Video: Modul 11 „Pilot-Analyse im Detail" (`DREHBUECHER`-Schlüssel `reihe-pilot`), Modul 26 „Mieterhöhung und Zielbild" (`reihe-zielbild`, Reiter Ankauf · Bestand · Zielbild) ·
> Messe-Geschichten: 8 Westerfeld (Schritt 3–4), 10 Hauptstr. (Gewerberisiko), 1 Ravensberger (Soll/Ist) (design/Messe/demo-geschichten.md)

## 1 · Wozu

Die Pilot-Analyse ist dein **Co-Pilot** auf dem Weg zum Kauf: Er liest alle Zahlen des Objekts und schreibt dir eine
Einschätzung in Worten — Gesamturteil, Stärken und Risiken, Szenarien, Lage, eine Verhandlungsempfehlung mit konkreter
Kaufpreis-Offerte, Argumente für die Bank und die Steuerseite. Er rechnet nichts neu: die Zahlen kommen aus denselben
Rechenkernen wie der Rest der App, der Pilot ordnet sie ein. Die Analyse ist im Plan enthalten und **kostet kein Kontingent**.

## 2 · Wo in der App

- **Reiter Pilot-Analyse** (Reiterleiste oben, Symbol Gehirn) → Knopf **„Pilot-Analyse starten"**. Voraussetzung: mindestens der Kaufpreis.
- Oben steht der **Stand**: „Stand … — die Zahlen haben sich seitdem nicht geändert" oder „seitdem hat sich **Kaufpreis, Nettokaltmiete …** geändert. Die Texte unten können überholt sein — neu abrufen."
- **Unterreiter** (linke Leiste): Briefing · Stärken & Risiken · Risiko & Szenarien · Lage & Markt · Verhandlung & Offerte · Bank · Steuer ·
  **Ankauf · Bestand · Zielbild** (nur mit Ankauf-Stand oder Mieterhöhung/Zielbild) · **Marktbericht-Verlauf** (ab zwei Berichten mit Marktwert).
- Reiter **Steuer** zeigt seit v2544 auch den **Steuerverlauf mit Wendepunkt**.
- Unten sitzt der **Co-Pilot** mit **Pillen**: Fragen wie „welche Felder fehlen?" beantwortet die App sofort selbst (gekennzeichnet „DealPilot",
  kostenlos, mit Sprung-Chips); andere Pillen setzen nur eine Frage ins Eingabefeld, gesendet wird von Hand.
- Ins PDF: Schalter „Pilot-Analyse im PDF-Export einschließen" und **Bausteine im PDF** (Gesamtbewertung, Stärken, Risiken, Szenario-Analyse,
  Verhandlungsempfehlung, Kaufpreis-Offerte, Bankargumente).
- Ton und Tiefe stellst du unter **Einstellungen → Co-Pilot (KI)** ein (kurz/mittel/ausführlich; sachlich/beratend/kritisch; eigenes Wissen).

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH, 4 WE, Bj 1967)

| Feld | Wert |
|---|---|
| Kaufpreis | 545.000 € |
| Objektart | Mehrfamilienhaus, 4 Wohneinheiten (Stand im Konto), Baujahr ca. 1967 |
| Gekauft | 01.01.2025 (Ankauf-Stand liegt vor) |
| Marktbericht | Stufe 3 vom 19.10.2026, Abruf „Marktpreise" vom 20.10.2026 |

1. **Pilot-Analyse starten.** Die Analyse liest Investition, Miete, Finanzierung, Bewirtschaftung, Steuer, den Marktwert und den Ankauf-Stand.
2. **Briefing:** Gesamturteil und Empfehlung (Kaufen / Prüfen / Nicht kaufen) — Text live zeigen.
3. **Verhandlung & Offerte:** In der Analyse für Modul 11 (Kopie der Westerfeldstr. 140, 15.10.2026) lag die **Offerte bei 530.000 €**
   gegenüber 545.000 € Kaufpreis. Die Offerte begründet der Pilot aus Zielrendite, Cashflow-Grenze und Marktwert.
4. **Bank:** Argumente für das Bankgespräch (DSCR, Beleihung, Wertpuffer).
5. **Steuer:** AfA mit Gutachten (6,25 %), Steuerverlauf, Hinweis auf die 15-%-Grenze bis Ende 2027.
6. **Ankauf · Bestand · Zielbild:** Spalten mit Jahr je Stufe. Gemessen am 20.10.2026 (v2543):

| | Ankauf 2025 | Mieterhöhung 2026 | Zielbild (Jahr offen) |
|---|---:|---:|---:|
| Ertragswert | 740.000 € | 755.000 € | 755.000 € |
| Marktpreisindikation | 805.000 € | 805.000 € | 880.000 € |
| Rohertragsfaktor × Miete | 730.000 € | 745.000 € | 745.000 € |

   Warum das Zielbild beim Ertragswert gleich bleibt: die Zielmiete (`zb_ziel_qm`) ist noch nicht eingetragen, „Jahr offen" heißt,
   das Fertigjahr fehlt. Nach dem Eintrag (Vorschlag 9,50 €/m², fertig 2030, Geschichte 8 / B.1) **live zeigen**.
   Darunter der Abschnitt **Marktpreise** (siehe [17](17-abruf-marktpreise.md)).
7. **Co-Pilot-Pille „Welche Felder fehlen?"** — Antwort sofort aus der App, ohne KI.

Belegt: Offerte 530.000 € — Videoreihe.md (Modul 11, Mitschnitt vom 15.10.2026); Pilot-Tafel — Journal v2541–v2543d (Nachweis Browser, Westerfeld);
AfA 6,25 % — demo-geschichten.md Geschichte 4; Reiternamen — `frontend/js/ui.js` (`dp-pa-rail`). Urteil, Texte: live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Erfindet die KI Zahlen?"** — Nein. Rechnen tun die Rechenkerne (Kennzahlen, Score, Finanzierung, Steuer), der Pilot bekommt die Ergebnisse
  und schreibt die Einordnung. Was die App selbst weiß (fehlende Felder), beantwortet sie ohne KI.
- **„Woher weiß der Pilot, ob die Analyse noch stimmt?"** — Sie merkt sich Datum und Zahlen. Ändert sich etwas, nennt der Kopf die Felder.
- **„Kostet das?"** — Die Pilot-Analyse ist im Plan enthalten, kein Kontingent. Der Abruf „Marktpreise" im Reiter Ankauf · Bestand · Zielbild kostet 1 × erweiterte Marktpreisindikation.
- **„Kann ich den Ton einstellen?"** — Ja, unter Einstellungen → Co-Pilot (KI), zum Beispiel „kritisch (Risiken zuerst)".
- **„Ich habe ein Gewerbe im Haus."** — Im Reiter Stärken & Risiken nachfragen (Geschichte 10, Hauptstr. 51: 50 % der Miete an einem Mieter). Antwort live.

## 5 · Grenzen und Kennzeichnung

- KI-gestützte Einschätzung, keine Beratung und kein Gutachten; maßgeblich sind die Zahlen mit Herkunft.
- Ertragswerte je Stufe sind **Potenzialwerte, keine Verkehrswertermittlung**, und erscheinen nur mit Freigabe Stufe 3 (Tarif mit Wertermittlung oder Stufe-3-Bericht für dieses Objekt).
- Quellen werden neutral benannt („aktueller Marktdurchschnitt"), Portal- und Anbieternamen nicht.
- Für die KI werden Objekt- und Berechnungsdaten übermittelt (siehe [32](32-datenschutz-und-server.md)).

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Pilot-Analyse, leer | „Pilot-Analyse starten" | Der Co-Pilot liest alle Zahlen des Objekts und schreibt dir die Einschätzung — im Plan enthalten, kein Kontingent. |
| 2 | Stand-Kopf | — | Oben steht, von wann die Analyse ist und ob sich die Zahlen seitdem geändert haben. |
| 3 | Briefing | — | Erst das Gesamturteil: kaufen, prüfen oder nicht kaufen — mit Begründung. |
| 4 | Verhandlung & Offerte | Unterreiter | Eine konkrete Offerte: hier 530.000 € statt 545.000 € — begründet aus Rendite, Cashflow und Marktwert. |
| 5 | Bank | Unterreiter | Die Argumente für das Bankgespräch: Kapitaldienst, Beleihung, Wertpuffer. |
| 6 | Ankauf · Bestand · Zielbild | Unterreiter | Drei Stufen mit Jahr: Ankauf, Mieterhöhung, Zielbild — Ertragswert und Marktpreisindikation nebeneinander. |
| 7 | Co-Pilot-Pillen | „Welche Felder fehlen?" | Was die App selbst weiß, beantwortet sie sofort — ohne KI, mit Sprung zum Feld. |

### Sprechertext (Entwurf, ca. 95 Sekunden)

Im Reiter Pilot-Analyse sitzt dein Co-Pilot. Ein Klick auf „Pilot-Analyse starten", und er liest alles, was du zum Objekt
eingetragen hast: Kaufpreis, Miete, Finanzierung, Kosten, Steuer und den Marktwert.
Oben steht der Stand. Hat sich seit der Analyse eine Zahl geändert, sagt DealPilot dir, welche.
Das Briefing gibt das Gesamturteil. Danach Stärken und Risiken, Szenarien, Lage und Markt.
Unter Verhandlung und Offerte steht ein konkreter Preis. Für die Westerfeldstraße in Bielefeld waren es fünfhundertdreißigtausend
Euro bei einem Kaufpreis von fünfhundertfünfundvierzigtausend — begründet aus Zielrendite, Cashflow und Marktwert.
Im Reiter Bank stehen die Argumente für dein Finanzierungsgespräch, im Reiter Steuer die Abschreibung und der Steuerverlauf.
Und unter Ankauf, Bestand und Zielbild siehst du, was das Haus nach einer Mieterhöhung und nach deinem Umbau wert sein kann —
jede Stufe mit Jahr.
Wichtig: Gerechnet wird in DealPilot. Der Co-Pilot ordnet ein, er erfindet keine Zahl. Und die Pilot-Analyse ist in deinem Plan
enthalten — sie kostet kein Kontingent.

## Querverweise

- [17 · Abruf „Marktpreise"](17-abruf-marktpreise.md) — der Abschnitt im Reiter Ankauf · Bestand · Zielbild
- [18 · Tab Bewertung](18-tab-bewertung.md) — Wertüberleitung derselben Zahlen
- [07 · MFH-Konfigurator](07-mfh-konfigurator.md) — woher Soll-Miete und Zielbild kommen
- [14 · Steuerverlauf und Wendepunkt](14-steuerverlauf-wendepunkt.md)
- [22 · Bestand: Soll und Ist](22-bestand-soll-ist.md)
- [28 · Pilot-Hilfe und Prozess-Atlas](28-pilot-hilfe-und-prozess-atlas.md) — der Pilot auf F1 (Hilfe, nicht Analyse)
