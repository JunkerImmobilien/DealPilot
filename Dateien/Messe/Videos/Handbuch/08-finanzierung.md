# 08 · Finanzierung — Darlehen, Marktzins, Bausparvertrag, DSCR

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 08 „Finanzierung" (`DREHBUECHER`-Schlüssel `reihe-finanzierung`, Studio `?modul=08`), Modul 19 Bank-PDF
> (`reihe-bankpdf`) · Messe-Geschichten: 2 Bismarckstr. (DSCR unter 1), 9 Lindenhof, 13 Musterstr. (DSCR 1,04)
> (design/Messe/demo-geschichten.md)

## 1 · Wozu

Die Finanzierung entscheidet, ob ein Objekt fliegt oder am Boden bleibt. Im Reiter Finanzierung legst du fest, wie
viel Eigenkapital an Bord geht, wie groß das Darlehen ist, zu welchem Zins und wie lange gebunden. DealPilot rechnet
daraus Rate, Restschuld und den DSCR — die Kennzahl, auf die eine Bank zuerst schaut: trägt die Miete den
Kapitaldienst? Den Zins musst du nicht raten: DealPilot schlägt einen indikativen Marktzins vor, aus der
Bundesanleihe, dem Aufschlag der Banken und deiner Beleihung.

## 2 · Wo in der App

- **Reiter Finanzierung** (`data-target-sec="s3"`):
  - Karte **Darlehen I – Hauptdarlehen**: Eigenkapital, Anfängl. Darlehenssumme, Zinssatz nominal, Tilgung,
    Zinsbindung (Jahre); Knöpfe **„Eigenkapital passend setzen"** / **„Darlehen passend setzen"**, wenn beides nicht
    zur Gesamtinvestition passt.
  - **Indikativer Zins / Marktdaten**: Bauzinsen nach Zinsbindung, Zuschlag nach Beleihung, Verlauf des
    Bankaufschlags (Fenster „Marktdaten"; Karten lassen sich unter Einstellungen → Darstellung standardmäßig
    zuklappen).
  - Haken **„Eigene Anschlussfinanzierung"** für Darlehen 1 (vorbelegt 5,0 % Zins, 1,0 % Tilgung).
  - **„Art des Darlehens"** → Tilgungsaussetzungsdarlehen (mit Bausparvertrag) → Karte **Bausparvertrag
    Tilgungsaussetzung** (Bausparsumme, Sparrate, Mindestsparquote, Konditionen des Bauspardarlehens).
  - **Darlehen II – Zusatzdarlehen** über „Hinzufügen", auch als KfW-Darlehen.
- **Einstellungen → Standardwerte**: Standard-Tilgung, Zinsbindung (5/10/15/20 J.), eigener Zinssatz (leer =
  indikativer Satz der Bindung), Zins-Stufe (Bonität/LTV), Standard-Eigenkapital in % vom Kaufpreis; Sets
  „Vorsichtig" und „Renditeorientiert".
- Ergebnisse: Reiter **Bewertung** (DSCR, LTV, Cashflow in drei Phasen, Zinsänderungsrisiko, Stress-Test),
  Bank-PDF Seite 1–2.

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH, KP 545.000 €)

| Feld | Wert |
|---|---|
| Kaufpreis (Reiter Investition) | 545.000 € |
| Gesamtinvestition (inkl. Nebenkosten) | 592.415 € |
| Eigenkapital | 120.000 € |
| Darlehen I | 472.415 € |
| Zinssatz nominal | 4,00 % |
| Tilgung, Zinsbindung | Zahl live zeigen |

**Was die App (und das Bank-PDF) zeigt:**

- DSCR **1,67** — die Miete deckt den Kapitaldienst 1,67-mal. Ab 1,2 gilt das als bankseitig solide, ab 1,5 als sehr
  solide.
- Beleihung **83,3 %** — im DealPilot-Rahmen „solide" (unter 85 %).
- Cashflow nach Steuern seit der Befüllung **8.119 €/Jahr** (vorher 6.234 €); Cashflow je Monat und die drei Phasen
  (heute / Ende Zinsbindung / Anschluss): Zahl live zeigen.
- Darlehen = Gesamtinvestition − Eigenkapital (592.415 − 120.000 = 472.415 €) — passt es nicht, gleicht einer der
  beiden Knöpfe aus.

**Der Marktzins — Beispiel aus Modul 08 (ETW Sachsenstraße 18, Herford, KP 180.000 €, Video-Objekt):**
Bundesanleihe 3,45 %, Aufschlag der Banken dazu, Staffel nach Beleihung 4,08 / 4,50 / 4,73 % — im Darlehen
**4,28 %**, Rate **899,69 €/Monat**, Restschuld am Ende der Zinsbindung **152.707 €**.

**Bausparvertrag:** In der Sparphase zahlst du nur Zinsen aufs Hauptdarlehen plus die Sparrate. **Die Sparrate
rechnet DealPilot im DSCR mit** — wirtschaftlich ist sie Tilgung. Sonst wäre der DSCR künstlich hoch und die
Anschlusslücke unsichtbar. Kommt die Zuteilung erst nach Bindungsende, zeigt die Karte einen gelben Hinweis.

**Gegenbild — Bismarckstr. 27, Detmold:** DSCR heute **0,97** — unter 1: die Miete trägt den Kapitaldienst nicht.
**Musterstr. 12, Leipzig (ETW):** DSCR **1,04** — trägt gerade so.

Belegt: DSCR 1,67 und Cashflow n. St. 8.119 € Objektliste Staging nach der Befüllung (gemessen 20.10.2026, `dscr` 1,669, `cf_ns` 8.119,25, `ltv` 83,3); übrige Westerfeld-Zahlen Videoreihe.md „15 · … 19 · Das Bank-PDF" (Prüflauf 16.10.2026); Marktzins/Rate/Restschuld
Videoreihe.md „Aufgenommen 16.10.2026", Modul 08; Schwellen DSCR/LTV help.js („DSCR", „LTV"); BSV im DSCR help.js
und CLAUDE.md (Rechenkern `Dscr.compute`); Bismarckstr. 0,97 und Musterstr. 1,04 Objektliste Staging 20.10.2026 (`dscr` 0,965 / 1,040), Korrektur Geschichte 2 und Geschichte 13.

## 4 · Was man daraus liest — Fragen am Stand

- **„Woher kommt der Zins?"** — Indikativ aus der Bundesanleihe plus dem Aufschlag der Banken, gestaffelt nach
  Beleihung und Zinsbindung, täglich aktualisiert. Hast du ein Angebot, trägst du deinen Zins ein.
- **„Was passiert nach der Zinsbindung?"** — Mit „Eigene Anschlussfinanzierung" rechnest du bewusst mit Puffer
  (vorbelegt 5,0 %). Das Zinsänderungsrisiko — Mehrbelastung pro Monat auf die Restschuld — rechnet DealPilot immer.
- **„Was ist ein guter DSCR?"** — Unter 1,0 kritisch, 1,0–1,2 knapp, ab 1,2 Standard der Banken, ab 1,5 sehr solide.
- **„Kann ich KfW dazunehmen?"** — Ja, als Darlehen II.
- **„Rechnet ihr die Bausparrate mit?"** — Ja, im DSCR überall gleich (Kennzahlenkarte und Grafik).

## 5 · Grenzen und Kennzeichnung

- Der Marktzins ist **indikativ**, kein Finanzierungsangebot. Bonität, Objekt und Bank entscheiden.
- Die LTV-Skala (unter 85 % solide, 85–100 % erhöht, über 100 % kritisch) ist eine **DealPilot-Skala**, an der Praxis
  deutscher Banken orientiert — keine Bankvorgabe.
- DealPilot vermittelt keine Darlehen und berät nicht zur Finanzierung.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Finanzierung, Darlehen I | — | Eigenkapital, Darlehen, Zins, Tilgung, Zinsbindung — daraus rechnet DealPilot Rate, Restschuld und DSCR. |
| 2 | Marktdaten-Fenster | Marktdaten öffnen | Der indikative Zins: Bundesanleihe plus Aufschlag der Banken, gestaffelt nach Beleihung und Zinsbindung. |
| 3 | Darlehen I mit Zins | Zins übernehmen | Im Darlehen 4,28 Prozent — Rate und Restschuld am Ende der Zinsbindung stehen sofort darunter. |
| 4 | EK/Darlehen-Hinweis | „Darlehen passend setzen" | Passen Eigenkapital und Darlehen nicht zur Gesamtinvestition, gleicht ein Klick aus. |
| 5 | Anschlussfinanzierung | Haken setzen | Nach der Zinsbindung bewusst mit Puffer rechnen: vorbelegt 5 Prozent Zins und 1 Prozent Tilgung. |
| 6 | Bausparvertrag-Karte | Art des Darlehens wählen | Tilgungsaussetzung mit Bausparvertrag: die Sparrate zählt im DSCR mit — sie ist wirtschaftlich Tilgung. |
| 7 | Reiter Bewertung, DSCR/LTV | Tab wechseln | DSCR ab 1,2 ist Banken-Standard. Darunter wird es knapp, unter 1 trägt die Miete den Kapitaldienst nicht. |

### Sprechertext (Entwurf, ca. 90 Sekunden)

Jetzt geht es um den Treibstoff des Investments: das Geld. Im Reiter Finanzierung trägst du Eigenkapital, Darlehen,
Zins, Tilgung und Zinsbindung ein. Den Zins musst du nicht raten. DealPilot schlägt einen indikativen Marktzins vor —
aus der Bundesanleihe, dem Aufschlag der Banken und deiner Beleihung. In unserem Beispiel sind das 4,28 Prozent.
Darunter stehen sofort die monatliche Rate und die Restschuld am Ende der Zinsbindung.
Passen Eigenkapital und Darlehen nicht zusammen, gleicht ein Klick aus. Für die Zeit nach der Zinsbindung hakst du die
Anschlussfinanzierung an und rechnest mit Puffer. Und wer mit Bausparvertrag tilgt, sieht die Sparrate ehrlich im
DSCR — denn sie ist wirtschaftlich Tilgung.
Der DSCR ist die Kennzahl der Bank: Wie oft deckt die Miete Zins und Tilgung? Ab 1,2 ist das solide. Unter 1 musst du
zuschießen. Wichtig: Der Marktzins ist eine Indikation, kein Angebot. Das macht deine Bank.

## Querverweise

05 Investition (Gesamtinvestition) · 09 Bewirtschaftung (NOI) · 15 Deal Score (Teilnoten LTV, DSCR) ·
18 Tab Bewertung (Stress-Test, Bank-Cockpit) · 20 Bank-PDF · 23 Bankexport Portfolio · 26 Einstellungen
(Standardwerte, Sets).
