# 09 · Bewirtschaftung — was das Objekt im Betrieb kostet

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 09 „Bewirtschaftung" (`DREHBUECHER`-Schlüssel `reihe-bewirtschaftung`, Studio `?modul=09`) ·
> Messe-Geschichten: 2 Bismarckstr. (Instandhaltung +40 %), 9 Lindenhof (Vorgabewerte bei 24 WE) (design/Messe/demo-geschichten.md)

## 1 · Wozu

Miete ist nicht gleich Ertrag. Bevor du den Cashflow im Cockpit ablesen kannst, gehen die laufenden Kosten von Bord:
Hausgeld, Grundsteuer, Verwaltung, Instandhaltung, Rücklage, Mietausfall. Im Reiter Bewirtschaftung trennt DealPilot,
was du an die Mieter weitergibst (umlagefähig), von dem, was du selbst trägst (nicht umlagefähig) — nur Letzteres
mindert deinen Cashflow. Wo du noch keine eigenen Zahlen hast, schlägt DealPilot Startwerte je Objektart vor.

## 2 · Wo in der App

- **Reiter Bewirtschaftung** (`data-target-sec="s4"`): zwei Eingabe-Modi — **Detailliert** oder **% der NKM**
  (Schnellweg; überzeichnet bei hohen Mieten).
  - **Umlagefähige Kosten / Jahr**: Hausgeld umlagefähig, Grundsteuer.
  - **Nicht umlagefähige Kosten / Jahr**: Hausgeld nicht umlagefähig, eigene Instandhaltungsrücklage,
    kalkulatorischer Mietausfall, Sonderverwaltung.
- **Standardwerte je Objektart** (füllen leere Felder, sobald Objektart und Wohnfläche stehen):
  - Eigentumswohnung: Hausgeld 4,00 €/m² im Monat, davon 30 % nicht umlagefähig; eigene Rücklage 0,50 €/m².
  - Ein-/Zweifamilienhaus: Betriebskosten 2,20 €/m², Verwaltung 230 €, Instandhaltung 9,00 €/m² im Jahr.
  - Mehrfamilienhaus: Betriebskosten 2,50 €/m², Verwaltung 230 € je Wohnung, Instandhaltung 9,00 €/m².
  - Verwaltung und Instandhaltung sind Basiswerte der **ImmoWertV Anlage 3**, fortgeschrieben mit dem
    **Fortschreibungsfaktor 1,60** (Stichtage ab 01.01.2026), jährlich zum 1. Januar anzupassen.
- **Einstellungen → Standardwerte → Bewirtschaftung je Objektart** (Startwerte), **Bewirtschaftung** in % der NKM,
  kalkulatorischer Mietausfall, Hausgeld-Anteil. Eigene Eingaben am Objekt gehen immer vor.
- Die Nebenkosten-Vorauszahlung der Mieter (Feld „Umlagefähige Kosten / Monat") steht im **Reiter Miete** und bildet
  dort die Warmmiete (siehe 06).

## 3 · Schritt für Schritt — Beispiel Bismarckstr. 27, Detmold (MFH, 6 WE, eigene Werte)

Die Bismarckstr. ist das Demo-MFH mit den vollständigsten **eigenen** Bewirtschaftungswerten (seit 20.10. ohne Tausenderpunkt gespeichert).

| Feld | Wert |
|---|---|
| Hausgeld / Betriebskosten umlagefähig (`hg_ul`) | 16.380 €/Jahr |
| nicht umlagefähig (`hg_nul`) | 2.442 €/Jahr |
| eigene Instandhaltung (`eigen_r`) | 11.763 €/Jahr |

**Was die App zeigt:** Die 16.380 € laufen durch (Mieter zahlen sie über die Vorauszahlung), der Cashflow sieht nur
2.442 + 11.763 €. Die Instandhaltung liegt **40 % über dem Plan vom Kauf (8.402 €)** — die Dachreparatur. Zusammen mit
zwei leeren Wohnungen drückt das den DSCR auf **0,97** und den Cashflow nach Steuern auf **−9.627 €/Jahr**.

**Zum Vergleich — Westerfeldstr. 140 (seit 20.10. nachgetragen):** umlagefähig `hg_ul` 11.376 €/Jahr, Vorauszahlung der
Mieter 976 €/Monat (Summe der Nebenkosten der 6 Wohnungen; die App koppelt (11.376 + Grundsteuer 336) / 12 = 976),
nicht umlagefähig 7.680 €/Jahr (Vorgabe). In den übrigen Demo-Objekten stehen weiter die Vorgaben; bei
Lindenhof 14 (24 WE, 1.696 m²) wirken 143,92 €/Monat Vorauszahlung sichtbar zu niedrig — dort **nicht** über die
Warmmiete sprechen.

Erledigt 20.10.: In der Bismarckstr. standen die Werte mit Tausenderpunkt („16.380") im Feld; seit der Befüllung werden
`hg_nul` 2.442 und `eigen_r` 11.763 ohne Punkt gelesen — daher der Cashflow −9.627 € statt −9.205 €.

Belegt: Bismarckstr.-Werte demo-geschichten A.1 und C.3; Plan/Ist Instandhaltung Geschichte 2; DSCR 0,97 und
−9.627 € Korrektur zu Geschichte 2 und Objektliste Staging 20.10.2026; Westerfeld `hg_ul`/`umlagef` demo-geschichten D; Lindenhof-Vorgaben A.2; Standardwerte und Faktor 1,60 help.js
(„Bewirtschaftung — Kosten je Objektart", „Lageklassen A · B · C und Bewirtschaftung je Objektart").

## 4 · Was man daraus liest — Fragen am Stand

- **„Warum zählen nur die nicht umlagefähigen Kosten?"** — Umlagefähiges zahlt der Mieter über die Vorauszahlung, es
  ist ein durchlaufender Posten.
- **„Woher kommen die Vorschläge?"** — Verwaltung und Instandhaltung aus Anlage 3 ImmoWertV, fortgeschrieben zum
  Stichtag. Betriebskosten und Hausgeld sind Erfahrungswerte, die du in den Einstellungen anpasst.
- **„Ist die Prozent-Methode schlecht?"** — Sie ist schnell, überzeichnet aber bei hohen Mieten. Für die Bank lieber
  detailliert.
- **„Wo sehe ich, ob mein Haus teurer läuft als geplant?"** — Im Bestand in der Soll/Ist-Tafel, Gruppe Kosten (22).

## 5 · Grenzen und Kennzeichnung

- Vorschläge sind Startwerte, keine Abrechnung. Für ein echtes Objekt gehören Hausgeldabrechnung, Grundsteuerbescheid
  und Wirtschaftsplan hinein — die Belege liest Reiter Steuer → „Belege & Abrechnungen einlesen (KI)" (siehe 13).
- Die Zuführung zur Erhaltungsrücklage einer WEG wird beim Beleg-Einlesen erkannt, aber bewusst nicht als
  Werbungskosten übernommen.
- Im Ertragswert (Marktbericht Stufe 3) rechnet DealPilot nicht mit deinen Kosten, sondern mit den Modellansätzen des
  Gutachterausschusses bzw. Anlage 3 — zwei Zwecke, zwei Rechnungen.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Bewirtschaftung, Modus | „Detailliert" | Zwei Wege: detailliert oder als Prozent der Nettokaltmiete. Für die Bank lieber detailliert. |
| 2 | Umlagefähig-Block | — | Umlagefähiges zahlt der Mieter über die Vorauszahlung — ein durchlaufender Posten. |
| 3 | Nicht-umlagefähig-Block | — | Nur was du selbst trägst, mindert den Cashflow: Verwaltung, Instandhaltung, Rücklage, Mietausfall. |
| 4 | Vorgeschlagene Werte | Objektart + Fläche gesetzt | Sobald Objektart und Fläche stehen, schlägt DealPilot Startwerte vor — Verwaltung und Instandhaltung nach Anlage 3. |
| 5 | Einstellungen → Standardwerte | Karte Bewirtschaftung | Deine eigenen Startwerte je Objektart. Eigene Eingaben am Objekt gehen immer vor. |
| 6 | Reiter Bewertung, Cashflow-Rechenweg | Tab wechseln | Von der Warmmiete bis zum Cashflow nach Steuern — jede Zeile sichtbar. |

### Sprechertext (Entwurf, ca. 75 Sekunden)

Miete ist noch kein Ertrag. Im Reiter Bewirtschaftung gehen die laufenden Kosten von Bord. DealPilot trennt dabei
sauber: Was umlagefähig ist, zahlt der Mieter über seine Vorauszahlung — das läuft nur durch. Was nicht umlagefähig
ist, trägst du selbst: Verwaltung, Instandhaltung, die eigene Rücklage, ein kalkulierter Mietausfall. Nur diese Kosten
mindern deinen Cashflow.
Hast du noch keine eigenen Zahlen, schlägt DealPilot Startwerte vor, sobald Objektart und Wohnfläche feststehen —
Verwaltung und Instandhaltung nach Anlage 3 der Immobilienwertermittlungsverordnung, fortgeschrieben auf heute.
Deine eigenen Startwerte hinterlegst du einmal in den Einstellungen. Und sobald die Hausgeldabrechnung da ist,
gehören deren Zahlen hinein — dann rechnet das Cockpit mit der Wirklichkeit statt mit Annahmen.

## Querverweise

06 Miete (Warmmiete, Vorauszahlung) · 08 Finanzierung (DSCR aus NOI) · 13 Belege einlesen · 18 Tab Bewertung
(Cashflow-Rechenweg) · 22 Bestand Soll/Ist · 26 Einstellungen (Standardwerte).
