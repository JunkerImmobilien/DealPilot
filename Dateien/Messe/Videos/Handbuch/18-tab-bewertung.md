# 18 · Tab Bewertung

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 12 „Bewertung und KPIs" (`DREHBUECHER`-Schlüssel `reihe-bewertung`), Modul 26 „Mieterhöhung und Zielbild" (`reihe-zielbild`), Überblick 2 Kapitel 8–9 (`reihe-ueberblick2`) ·
> Messe-Geschichten: 8 Westerfeld (Schritt 4–5), 13 Musterstr. (design/Messe/demo-geschichten.md)

## 1 · Wozu

Der Tab Bewertung ist das **Cockpit-Instrumentenbrett** deines Objekts: Hier gibst du nichts ein, hier liest du ab.
Score-Dial, alle Kennzahlen mit Ampel, der Rechenweg vom Mieteingang bis zum Cashflow nach Steuern, die Grafiken für
Bank und Vermögensaufbau — und, wenn du Mieterhöhung oder Zielbild geplant hast, die **Wertüberleitung**: was das Haus
heute, nach der Mieterhöhung und nach deinem Umbau wert sein kann.

## 2 · Wo in der App

**Reiter Bewertung** (Reiterleiste oben, Symbol Balkendiagramm). Von oben nach unten:

- **DealPilot Score** und **Investor Deal Score** (siehe [15](15-deal-score-und-investor-deal-score.md)).
- **Kennzahlen** mit Ampel und deinen Mindest-Schwellen als Marker.
- **Cashflow – Korrekte Berechnung**: jede Zeile von der Warmmiete bis zum Cashflow nach Steuern, heute · Ende Zinsbindung · Anschluss.
- **Grafiken:** Equity-Build (Vermögensaufbau), Bank-Cockpit (DSCR & LTV), Waterfall (Vermögenszuwachs), Stress-Test.
- **Marktwert-Verlauf** aus den gespeicherten Marktberichten.
- Karte **„Mieterhöhung und Zielbild · Wertpotenzial"** (nur wenn Soll-Miete oder Zielbild eingetragen ist): Wohnungsliste, Ertragswert-Kacheln,
  **Wertüberleitung**, Kennzahlen je Stufe, Aufteilung vor/nach, Kaufpreis, Fußnote mit Kennzeichnung.

**Die Kennzahlen und ihre Formeln** (aus der Hilfe der App):

| Kennzahl | Formel |
|---|---|
| Bruttomietrendite | Jahres-Nettokaltmiete ÷ Kaufpreis |
| Nettomietrendite | (Jahresmiete − nicht umlagefähige Kosten) ÷ Gesamtinvestition |
| Faktor | Kaufpreis ÷ Jahresmiete |
| LTV | Darlehen ÷ Verkehrswert; ohne Verkehrswert ÷ Bankbewertung (wenn höher als Kaufpreis), sonst ÷ Kaufpreis |
| DSCR | wie oft die Miete den Kapitaldienst deckt (bei Bausparvertrag mit Sparrate) |
| Cashflow | Warmmiete − umlagefähige Kosten − nicht umlagefähige Kosten − Zins − Tilgung ± Steuer |

**Die Grafiken:** Equity-Build — grün Marktwert, rot Restschuld, dazwischen dein Eigenkapital. Bank-Cockpit — DSCR (Ziel ≥ 1,2)
und LTV (soll sinken). Waterfall — Gewinn aus Tilgung, Cashflow, Steuer, Wertsteigerung. Stress-Test — 5 × 5 Felder Zins
(−2 bis +5 Prozentpunkte) gegen Miete (−20 % bis +20 %), jede Zelle der DSCR; bleibt er bei −10 % Miete und +1 Punkt Zins ≥ 1,0, gilt das Objekt als bank-tauglich.

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH)

| Feld | Wert |
|---|---|
| Kaufpreis | 545.000 € |
| Wohnungen | im MFH-Konfigurator: 6 WE, Soll von DealPilot gerechnet, Zielbild 9,50 €/m² fertig 2030 |
| Marktbericht | Stufe 3 liegt vor (Bericht 326 vom 20.10.2026, Liegenschaftszins 2,5 % Stufe A, RND 25,7 J.) |
| Abruf „Marktpreise" | Nr. 6 vom 20.10.2026 |

1. **Reiter Bewertung öffnen.** Score-Dial 78 · Gut (DealPilot Score), Investor Deal Score 74 · Gut.
2. **Kennzahlen lesen.** Bruttomietrendite 7,23 %, DSCR 1,67, Beleihung 83,3 % (Objektliste 20.10.2026); Nettomietrendite am 16.10. 5,36 % — nach der Befüllung (Nebenkosten neu) live zeigen.
3. **Karte Wertpotenzial.** Die Wertüberleitung läuft Bestand → Mieterhöhung → Zielbild, jede Stufe in Markenfarbe (Bestand Obsidian, Mieterhöhung helles Gold,
   Zielbild dunkles Gold, Maßnahmenkosten gedämpftes Rot; Grün und Rot nur fürs Ergebnis).
4. **Kennzahlen je Stufe** (Abruf 6 vom 20.10.2026, nach der Befüllung):

| | Bestand | Mieterhöhung | Zielbild |
|---|---:|---:|---:|
| Ertragswert | 745.000 € | 815.000 € | 915.000 € |
| Marktpreisindikation (Angebotspreise) | 820.000 € | 820.000 € | 895.000 € |
| Rohertragsfaktor × Miete | Zahl live zeigen | Zahl live zeigen | Zahl live zeigen |

   Maßnahmenkosten bis zum Zielbild 62.000 €, Modernisierungspunkte 3 → 5,7.

5. **Aufteilung:** je Wohnung als Eigentumswohnung mit dem Zins für **vermietete** ETW (Bielefeld 2,9 %, Gutachterausschuss Stadt Bielefeld).
   Je Wohnung Ertragswert und Marktpreisindikation, z. B. WE 1: 126.000 € / 180.000 € (Abruf 6). Ob nach den Kosten je Wohnung Potenzial bleibt,
   live zeigen — die Begründung steht dabei (ETW-Zins 2,9 % gegen 2,5 % fürs Mehrfamilienhaus, höhere Verwaltungskosten je Einheit).

**Achtung, zwei Zahlenstände:** Am 20.10. vormittags (v2460) zeigte der Tab an Westerfeld **780.000 / 865.000 / 1.105.000 €** und
„Potenzial netto +257.000 € nach 68.000 € Maßnahmen" — gemessen mit einem Zielbild, das nur im Prüf-Tab gesetzt war.
Mit **v2541** wurde nachgerechnet und vier echte Fehler behoben (unter anderem rechnete der Bestand die Restnutzungsdauer linear, das Zielbild nach Anlage 2 —
das erzeugte ein scheinbares Potenzial). Der Zwischenstand 740.000 / 755.000 / 755.000 € (v2543, 4 WE, ohne Zielmiete) ist ebenfalls überholt. **Es gilt Abruf 6 nach der Befüllung:
745.000 / 815.000 / 915.000 €** (6 WE, Zielmiete 9,50 €/m², fertig 2030).

Belegt: Scores, DSCR, Beleihung — Objektliste Staging 20.10.2026 (`dealpilot_score` 78, `ds2_score_persist` 74, `dscr` 1,669, `ltv` 83,3); Bruttomietrendite
`bmy` 7,233; Nettomietrendite — Videoreihe.md Modul 19 (16.10.); Stufenwerte — Geschichte 8 Schritt 4 (Abruf 6), alter Stand Journal v2541–v2543d; Liegenschaftszins 2,5 % A — Geschichte 8 Schritt 6; Zins ETW 2,9 % und Begründung — Journal v2431/v2432; alter Stand — Journal v2460–v2466a.

## 4 · Was man daraus liest — Fragen am Stand

- **„Was ist der Unterschied zwischen Ertragswert und Marktpreisindikation?"** — Der Ertragswert rechnet nach ImmoWertV mit dem amtlichen Liegenschaftszins;
  die Marktpreisindikation kommt aus Angebotspreisen. „Dann hat man beides" — weichen sie stark ab, lohnt der zweite Blick.
- **„Was heißt Rohertragsfaktor × Miete?"** — Der amtliche Rohertragsfaktor des Registers mal die Jahresmiete der Stufe: eine dritte, einfache Gegenprobe.
- **„Warum steigt der Ertragswert bei der Mieterhöhung so wenig?"** — Weil die Kappungsgrenze (in Bielefeld 15 % in drei Jahren) und die Vergleichsmiete die Soll-Miete bremsen.
- **„Warum ist Aufteilen hier kein Gewinn?"** — Der amtliche Zins für vermietete Wohnungen liegt über dem fürs Haus; verkauft man an Selbstnutzer, wäre ein anderer Satz maßgeblich (fachlich offen).
- **„Hält mein Objekt einen Zinsanstieg aus?"** — Stress-Test lesen: Zelle −10 % Miete / +1 Punkt Zins.

## 5 · Grenzen und Kennzeichnung

- Alles in der Karte Wertpotenzial ist ein **Potenzialwert nach Mieterhöhung bzw. Zielbild, keine Verkehrswertermittlung**.
- Ertragswerte je Stufe nur mit **Freigabe Stufe 3**; sonst Hinweis „Ertragswert je Stufe mit DealPilot Stufe 3" und Knopf „Stufe 3 im Tab Objekt".
- Die Marktpreisindikation ist **aus Angebotspreisen, kein Gutachten nach § 194 BauGB**.
- Score, Verkehrswert und Marktbericht bleiben beim Bestand; Mieterhöhung und Zielbild ändern sie nicht.
- Die Karte rechnet beim Öffnen einmal je Stand selbst (ohne Kontingent); ändert sich ein Feld, ist das Ergebnis neu zu rechnen.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Bewertung, Score-Dial oben | Reiter Bewertung | Hier gibst du nichts ein — hier liest du ab. Score, Kennzahlen, Rechenweg und Grafiken. |
| 2 | Kennzahlen mit Ampeln | — | Jede Kennzahl mit Ampel und deinem Mindestwert als Marker. |
| 3 | Cashflow – Korrekte Berechnung | aufklappen | Jede Zeile von der Warmmiete bis zum Cashflow nach Steuern — heute, nach der Zinsbindung, im Anschluss. |
| 4 | Stress-Test | — | Zins rauf, Miete runter: jede Zelle zeigt, ob die Miete den Kapitaldienst noch trägt. |
| 5 | Karte Wertpotenzial, Wertüberleitung | scrollen | Bestand, Mieterhöhung, Zielbild — die Wertüberleitung zeigt, was dein Plan am Wert ändert. |
| 6 | Kennzahlen je Stufe | — | Ertragswert, Marktpreisindikation und Rohertragsfaktor nebeneinander: drei Blickwinkel auf denselben Plan. |
| 7 | Aufteilung „kein Potenzial" | Zeile Aufteilung | Auch ein Nein wird begründet: In Bielefeld lohnt die Aufteilung im Ertragswert nicht. |

### Sprechertext (Entwurf, ca. 100 Sekunden)

Im Reiter Bewertung gibst du nichts mehr ein. Hier liest du ab, wie dein Objekt fliegt.
Oben der Score-Dial. Darunter die Kennzahlen, jede mit Ampel: Bruttomietrendite, Nettomietrendite, Faktor, Beleihung, DSCR, Cashflow.
Deine eigenen Mindestwerte stehen als Marker daneben.
Der Rechenweg zeigt jede Zeile von der Warmmiete bis zum Cashflow nach Steuern — heute, am Ende der Zinsbindung und in der Anschlussfinanzierung.
Der Stress-Test spielt durch, was passiert, wenn die Zinsen steigen und die Miete sinkt.
Hast du eine Mieterhöhung oder ein Zielbild geplant, erscheint die Karte Wertpotenzial. Für die Westerfeldstraße in Bielefeld: Ertragswert heute
siebenhundertfünfundvierzigtausend Euro, nach der Mieterhöhung achthundertfünfzehntausend, nach dem Umbau neunhundertfünfzehntausend. Daneben die Marktpreisindikation aus Angebotspreisen
und der amtliche Rohertragsfaktor mal Miete — drei Blickwinkel auf denselben Plan.
Und die Aufteilung steht daneben: jede Wohnung als Eigentumswohnung, mit Ertragswert und Marktpreis — und mit Grund, wenn sie sich nicht lohnt,
etwa weil der amtliche Zins für vermietete Wohnungen höher liegt als der fürs ganze Haus.
Wichtig: Das sind Potenzialwerte. Eine Verkehrswertermittlung ersetzen sie nicht.

## Querverweise

- [15 · Deal Score und Investor Deal Score](15-deal-score-und-investor-deal-score.md)
- [17 · Abruf „Marktpreise"](17-abruf-marktpreise.md) — Marktpreisindikation je Stufe und je Wohnung
- [07 · MFH-Konfigurator](07-mfh-konfigurator.md) — Soll-Miete, Kappung § 558, § 559, Aufteilung
- [19 · Marktbericht](19-marktbericht.md) — Ertragswert Stufe 3 als Bestandsbasis
- [20 · Bank-PDF und Investment-PDF](20-bank-pdf-und-investment-pdf.md) — Seite „Wertpotenzial"
- [08 · Finanzierung](08-finanzierung.md) — Zinsbindung, Anschluss, Zinsänderungsrisiko
