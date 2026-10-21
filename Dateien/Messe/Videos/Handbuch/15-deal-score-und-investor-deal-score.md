# 15 · Deal Score und Investor Deal Score

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 12 „Bewertung und KPIs" (`DREHBUECHER`-Schlüssel `reihe-bewertung`), Modul 25 „Die geführte Eingabe" (`reihe-gefuehrt`), Überblick 2 (`reihe-ueberblick2`) ·
> Messe-Geschichten: 8 Westerfeld, 9 Lindenhof, 3b Parkstr. (design/Messe/demo-geschichten.md)

## 1 · Wozu

Der **Score-Dial** ist der schnelle Blick aus dem Cockpit: eine Zahl von 0 bis 100 und ein Wort,
das sagt, wie das Objekt fliegt. DealPilot führt **zwei** Scores, und das ist gewollt.
Der **DealPilot Score** (derselbe wie im Quick Boarding) fragt nur: trägt sich die Zahlenseite? Cashflow,
Rendite, Beleihung, Risiko, Potenzial. Der **Investor Deal Score** schaut breiter: 24 Kennzahlen,
dazu Lage, Substanz und Upside. Die Stufen sind überall dieselben:

| Score | Stufe |
|---|---|
| ab 85 | **Sehr gut** |
| ab 70 | **Gut** |
| ab 50 | **Solide** |
| ab 35 | **Schwach** |
| unter 35 | **Kritisch** |

## 2 · Wo in der App

- **Reiter Bewertung** (Reiterleiste oben, Symbol Balkendiagramm): DealPilot Score mit Ring und Pille, darunter der Investor Deal Score.
- **Objektkarte in der Seitenleiste:** Ring oben auf der Karte mit Stufenpille (SEHR GUT · GUT · SOLIDE · SCHWACH · KRITISCH).
- **Quick Boarding:** derselbe DealPilot Score mit fünf Kennzahlen auf der Karte (Cashflow/Mo, Nettomietrendite, LTV, DSCR, Wertpuffer).
- **Einstellungen → Deal Score:** fünf Regler des DealPilot Scores (Summe 100 %, „↺ Standard wiederherstellen" = 30/25/15/15/15),
  darunter der Investor Deal Score mit **Bewertungsprofil** und Grenzwerten im Format `Wert:Punkte`.
- **Einstellungen → Standardwerte → Persönliche Mindest-Schwellen:** Mindest-DSCR, Mindest-Cashflow / Monat, Maximaler LTV — erscheinen als farbige Marker an den Kennzahlen.
- Fehlen Kennzahlen für den Investor Deal Score: Knopf **„📋 Welche KPIs fehlen noch?"**.

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH)

**Wie der DealPilot Score rechnet** (Profil „Ausgewogen", aus der Hilfe der App):

| Teilnote | Gewicht | Skala |
|---|---:|---|
| Cashflow | 30 % | −200 €/Monat = 0 · 0 € = 50 · +200 € = 100 Punkte |
| Rendite (Nettomietrendite) | 25 % | 2 % = 0 · 3,5 % = 50 · 5 % = 100 |
| LTV | 15 % | 70 % = 100 · 90 % = 50 · 110 % = 0 |
| Risiko (DSCR) | 15 % | bis 0,9 = 0 · 1,0 = 60 · 1,2 = 80 · ab 1,5 = 100 |
| Potenzial (Wertpuffer) | 15 % | ohne Puffer 30 Punkte, je Prozent Puffer 3 mehr, höchstens 90 |

Beim **Barkauf** entfallen LTV und Risiko — sie werden nicht schlecht bewertet, sondern aus der Rechnung genommen.

**Investor Deal Score:** fünf Kategorien — Rendite 35 %, Finanzierung 25 %, Risiko 20 %, Lage 10 %, Upside 10 % —
mit 24 Unterkennzahlen. Er erscheint erst ab **70 % ausgefüllten Kennzahlen**. Fehlt eine Unterkennzahl, fällt sie aus der
Gewichtung; fehlt eine ganze Kategorie, zählt sie neutral mit 60 Punkten. Sechs Profile: Ausgewogen, Konservativ,
Optimistisch, Lage-Fokus, Cashflow-Fokus, Sicherheit.

**Vorführung:**

| Schritt | Was du tust | Was die App zeigt |
|---|---|---|
| 1 | Westerfeldstr. 140 in der Seitenleiste öffnen | Karte mit Ring |
| 2 | Reiter **Bewertung** | DealPilot Score **78 · Gut**, Investor Deal Score **74 · Gut** |
| 3 | Zum Vergleich Lindenhof 14, Castrop-Rauxel öffnen | **20 · Kritisch** / **39 · Schwach** — DSCR 0,74, Cashflow n. St. −13.431 €/Jahr, Beleihung 94 % |
| 4 | Parkstr. 9, Bad Oeynhausen öffnen | **28 · Kritisch** / **58 · Solide** — hier gehen die Scores weit auseinander |
| 5 | Einstellungen → Deal Score → Profil „Konservativ" wählen, zurück in Bewertung | Zahl live zeigen (Profil danach zurück auf „Ausgewogen") |

**Warum Parkstr. so auseinanderliegt:** Der DealPilot Score sieht nur die Zahlen des Altbaus (Bj 1905, Beleihung auf den
Marktwert hoch); der Investor Deal Score nimmt Lage, Mietsteigerung und Upside dazu. „DealScore 59" in Geschichte 3b
ist der Investor Deal Score (heute 58), nicht der DealPilot Score.

**Zweites Beispiel aus Modul 25 (geführte Eingabe, Bayern):** Zwischenstand vor der Finanzierung 39 · Schwach
(Cashflow −742 €/Mon), Investor Deal Score Zwischenstand 73 · Gut; am Ende im Reiter Bewertung
**Deal Score 60 · Solide, Investor Deal Score 79 · Gut**.

Belegt: Westerfeld 78/74, Gohliser 79/78, Lindenhof 20/39, Parkstr. 28/58 — Objektliste Staging nach der Befüllung
(`dealpilot_score` / `ds2_score_persist`, gemessen 20.10.2026); Lindenhof-Kennzahlen Geschichte 9 und Objektliste (`cf_ns` −13.431, `ltv` 94,5); Parkstr.-Hinweis „Korrekturen an den Geschichten 1–7";
Modul 25 — Videoreihe.md „Modul 25"; Gewichte und Skalen — `frontend/js/help.js` (Kennzahlen verstehen, Quick-Check).
Profilwechsel: Zahl live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Warum zwei Scores?"** — Der DealPilot Score ist der schnelle Zahlencheck (gleich im Quick Boarding und im Objekt). Der Investor
  Deal Score ist genauer, weil er mehr Kennzahlen und die Lage einbezieht. Marcels Entscheidung: beide bleiben getrennt.
- **„Was drückt den Score?"** — Die Teilnoten zeigen es. Im Quick Boarding nennt DealPilot die schwächsten Teilnoten mit Punkten
  („Punkte kosten vor allem Wertpuffer … und LTV …").
- **„Kann ich meine Maßstäbe einstellen?"** — Ja: Gewichte, Profile, Grenzwerte, Mindest-Schwellen, Zielrendite je Lageklasse.
- **„Ich sehe keinen Investor Deal Score."** — Unter 70 % Deckung zeigt die App, welche Kennzahlen fehlen, statt eine Zahl zu raten.
- **„Ist 50 gut?"** — 50 ist **Solide**: trägt sich, aber ohne Reserve. Gut beginnt bei 70.

## 5 · Grenzen und Kennzeichnung

- Der Score ist ein Modell mit festen, offengelegten Skalen — keine Kaufempfehlung und keine Bankentscheidung.
- Ohne Marktwert-Abruf zählt das Potenzial nur 30 von 100 Punkten (kein Wertpuffer belegt).
- Der Investor Deal Score gehört zum Investor- und Pro-Plan (im Free-Plan als Demo, im Starter nicht enthalten).
- Score, Verkehrswert und Marktbericht bleiben beim **Bestand** — Mieterhöhung und Zielbild ändern den Score nicht.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Seitenleiste, Objektkarten mit Ringen | Westerfeldstr. 140 | Jedes Objekt trägt seinen Score-Dial: eine Zahl von 0 bis 100 und ein Wort. |
| 2 | Reiter Bewertung, Ring 78 · Gut | — | Der DealPilot Score: Cashflow, Rendite, Beleihung, Risiko, Potenzial — dieselbe Zahl wie im Quick Boarding. |
| 3 | Teilnoten aufgeklappt | Teilnote Cashflow | Jede Teilnote hat eine feste Skala. Cashflow −200 € sind null Punkte, +200 € sind hundert. |
| 4 | Investor Deal Score 74 · Gut | — | Der Investor Deal Score bewertet 24 Kennzahlen — mit Lage, Substanz und Upside. |
| 5 | Parkstr. 9: 28 gegen 58 | Objekt wechseln | Zwei Scores, zwei Blickwinkel: Der Altbau trägt sich heute knapp — die Lage und das Potenzial sehen besser aus. |
| 6 | Einstellungen → Deal Score | Profil-Liste | Sechs Profile oder eigene Gewichte: du bestimmst, was dir wichtig ist. |
| 7 | Stufenleiste 85/70/50/35 | — | Sehr gut ab 85, Gut ab 70, Solide ab 50, Schwach ab 35 — überall dieselben Stufen. |

### Sprechertext (Entwurf, ca. 85 Sekunden)

Jedes Objekt in DealPilot trägt seinen Score-Dial. Eine Zahl von null bis hundert — und ein Wort dazu.
Die Westerfeldstraße in Bielefeld steht bei achtundsiebzig: Gut.
Der DealPilot Score ist der Zahlencheck. Er setzt sich aus fünf Teilnoten zusammen: Cashflow, Rendite, Beleihung, Risiko
und Potenzial. Jede Teilnote hat eine feste Skala, die du in der Hilfe nachlesen kannst — nichts daran ist Bauchgefühl.
Daneben steht der Investor Deal Score. Er bewertet vierundzwanzig Kennzahlen und nimmt Lage, Substanz und Upside dazu.
Dass beide Zahlen abweichen dürfen, ist Absicht. Die Parkstraße in Bad Oeynhausen zeigt es: Zahlenseite kritisch,
Gesamtbild solide. Genau dieser Abstand ist die Frage, die du dir vor dem Kauf stellen solltest.
In den Einstellungen wählst du ein Profil — konservativ, ausgewogen, auf Cashflow oder auf Lage ausgerichtet — oder setzt
deine eigenen Gewichte und Mindestwerte. Die Stufen bleiben überall gleich: Sehr gut ab fünfundachtzig, Gut ab siebzig,
Solide ab fünfzig, Schwach ab fünfunddreißig. Darunter: Kritisch.

## Querverweise

- [03 · Quick Boarding](03-quick-boarding.md) — derselbe DealPilot Score in einer Minute
- [18 · Tab Bewertung](18-tab-bewertung.md) — die Kennzahlen hinter den Teilnoten
- [26 · Einstellungen, Standardwerte, Investmentprofil](26-einstellungen-standardwerte-investmentprofil.md) — Gewichte, Profile, Schwellen
- [16 · Pilot-Analyse](16-pilot-analyse.md) — die Einschätzung in Worten
