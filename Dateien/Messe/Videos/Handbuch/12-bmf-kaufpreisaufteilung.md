# 12 · BMF-Kaufpreisaufteilung — wie viel vom Kaufpreis ist Gebäude?

> Stand 20.10.2026 (Staging bis v2544). Zahlen vor der Messe live gegenprüfen.
> Video: Modul 10b „BMF-Kaufpreisaufteilung" (`DREHBUECHER`-Schlüssel `reihe-bmf`, Studio `?modul=10b`) ·
> Messe-Geschichten: 4 Westerfeldstr. (zweite Hebelstelle), 3b Parkstr., 12 Am Markt 18, 15 Steuerberater
> (design/Messe/demo-geschichten.md)

## 1 · Wozu

Abgeschrieben wird nur das Gebäude, nie der Boden. Wie groß der Gebäudeanteil ist, entscheidet über die AfA-Basis für
Jahrzehnte. Das Finanzamt prüft mit der Arbeitshilfe des Bundesfinanzministeriums. DealPilot rechnet genau diese
Arbeitshilfe nach, zeigt die amtliche Zahl und daneben begründbare Varianten — und liefert die Klausel für den
Notarvertrag. Das ist die Vorbereitung, bevor der Kaufvertrag in die Startbahn rollt.

## 2 · Wo in der App

- **Reiter Steuer → Karte AfA-Konfiguration → Knopf „BMF-Rechner"** öffnet „Anschaffungskosten &
  BMF-Kaufpreisaufteilung" (BMF-Arbeitshilfe, Juni 2023), vier Reiter:
  1. **Anschaffungskosten** — übernimmt Kaufpreis, Grunderwerbsteuer, Notar, Grundbuchamt, Makler aus dem Reiter
     Investition; dazu Erwerbskosten (Fahrten mit Fahrtkosten-Helfer, Verpflegung, Unterkunft, Gutachten, Anwalt).
     Herstellungskosten (§ 255 Abs. 2 HGB) zählen zu 100 % zum Gebäude.
  2. **BMF-Aufteilung** — Grundstücksart, Baujahr, Flächen, Bodenrichtwert, Miete, Modernisierungen; alle drei
     Verfahren werden gerechnet. Ein KI-Vorschlag schlägt Werte des Gutachterausschusses vor, übernommen erst mit
     „BRW → BMF" bzw. „Lzs → BMF". Mit amtlichem Zinssatz steht die Aufteilung **nach Jacoby** zum Vergleich darunter.
  3. **AfA-Vorschau** — AfA-Basis und jährliche AfA, Vergleich mit der Pauschale 80/20.
  4. **AfA-Hebel** — vier Varianten: **Amtlich** (× 1,00, vorausgewählt), **Konservativ** (Boden −15 %),
     **Optimiert** (−20 %), **Aggressiv** (−25 %), je mit Risiko-Score; 15-%-Grenze mit Status Puffer / Knapp /
     Überschritten; **Notarvertrag-Klausel** zum Kopieren; **Bodenabschlag** als Szenario mit Begründung.
- Die Reiter 2–4 öffnen erst, wenn die Pflichtangaben vollständig sind.
- **„✓ Übernehmen"** schreibt Gebäudeanteil und AfA-Satz in den Reiter Steuer. Ausgaben: **Kaufpreisaufteilung als PDF**,
  **BMF-Arbeitshilfe als PDF**, **BMF-Original als XLSX**; außerdem Deal-Aktion → „Kaufpreisaufteilung (Finanzamt)".
- Belege der Anschaffungskosten: Deal-Aktion → Kaufpreisaufteilung → Belege (siehe 13).

## 3 · Schritt für Schritt — Beispiel Ravensberger Weg 38, Bielefeld (MFH, 8 WE) — wie in Modul 10b

| Feld | Wert |
|---|---|
| Anschaffungskosten (Basis der Aufteilung) | 1.233.000 € |
| Sanierung (Reiter Investition) | 87.000 € |
| Übrige Angaben | aus dem Objekt (Bodenrichtwert, Flächen, Miete — live zeigen) |

**Was der Rechner zeigt:**

- **Amtlich (BMF): 74,82 % Gebäude** → Gebäude 922.531 €, AfA **18.451 €** im Jahr.
- **Jacoby** (Vergleich mit amtlichem Zins): 79,82 %.
- **Varianten**: AfA zwischen 18.451 € (amtlich) und 20.003 € (aggressiv); **Optimiert 79,86 % / 19.692 €**.
- **Notarklausel** (Optimiert): Grund und Boden **248.375,52 €**, Gebäude **984.624,48 €** — zusammen 1.233.000 €.

**Der Extremfall — Westerfeldstr. 140, Bielefeld:** 1.570 m² × 450 €/m² Bodenrichtwert = 706.500 € Bodenwert, mehr als
der Kaufpreis (545.000 €). Die Arbeitshilfe gibt nur **14,6 % Gebäude**; die Varianten liegen bei 27–36 %. Hier lohnt
ein Gutachten zur Kaufpreisaufteilung doppelt.

**Der Abgleich — Am Markt 18, Kabelsketal (ETW):** DealPilot nach BMF-Arbeitshilfe **95,1 %**, die echte
Kaufpreisaufteilung (Gutachten im Repo) **94,35 %** — praktisch deckungsgleich. Im Objekt steht noch 95,14 %;
der Gutachtenwert ist nicht eingetragen.

**Altbau — Parkstr. 9, Bad Oeynhausen:** Gebäudeanteil nach BMF-Arbeitshilfe **54,3 %**.

Belegt: Ravensberger-Zahlen Videoreihe.md „Stand v2268" und „Aufgenommen 16.10.2026" (10b); Varianten/Reiter help.js
(„BMF-Rechner", „Varianten, Bodenabschlag und Ausgabe"); Westerfeld Geschichte 4; Am Markt 18 Geschichten 5, 12 und C.8;
Parkstr. Geschichte 3b.

## 4 · Was man daraus liest — Fragen am Stand

- **„Ist die amtliche Zahl verbindlich?"** — Sie ist das, womit das Finanzamt prüft. Eine Aufteilung im Kaufvertrag wird
  anerkannt, wenn sie nicht unplausibel ist — die Varianten zeigen den begründbaren Rahmen.
- **„Wann brauche ich ein Gutachten?"** — Wenn du mehr als rund 25 % vom BMF-Standard abweichen willst, oder wenn der
  Boden — wie an der Westerfeldstr. — den Kaufpreis fast frisst.
- **„Was bringt der Bodenabschlag?"** — Ein Szenario neben der amtlichen Zahl, die unangetastet bleibt. Ohne Begründung
  bleibt er angreifbar; DealPilot fragt die Begründung für den Vertragstext ab.
- **„Was nehme ich zum Notar mit?"** — Die Klausel aus Reiter 4 mit den Euro-Beträgen.

## 5 · Grenzen und Kennzeichnung

- **Keine Steuerberatung.** Die Varianten tragen einen Risiko-Score; welche du wählst, klärst du mit dem Steuerberater.
- Der KI-Vorschlag für Bodenrichtwert und Zinssatz ist ein Vorschlag — übernommen wird nur per Klick, geprüft am
  amtlichen Portal.
- Die BMF-Arbeitshilfe ist ein typisierendes Verfahren; ein Gutachten geht ihr vor.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | AfA-Konfiguration | „BMF-Rechner" | Abgeschrieben wird nur das Gebäude. Wie groß sein Anteil ist, rechnet die Arbeitshilfe des Finanzministeriums. |
| 2 | Reiter 1 Anschaffungskosten | — | Kaufpreis und Nebenkosten kommen aus der Investition, dazu Fahrten, Gutachten, Anwalt. |
| 3 | Reiter 2 BMF-Aufteilung | Bodenrichtwert prüfen | Bodenrichtwert, Flächen, Miete: alle drei Verfahren werden gerechnet. Amtlich: 74,82 Prozent Gebäude. |
| 4 | Jacoby-Vergleich | — | Mit amtlichem Zinssatz steht die Aufteilung nach Jacoby daneben — 79,82 Prozent. |
| 5 | Reiter 4 AfA-Hebel | Variante „Optimiert" | Vier Varianten mit Risiko-Score. Optimiert: 79,86 Prozent Gebäude, AfA 19.692 Euro im Jahr. |
| 6 | Notarklausel | Kopieren | Die Klausel für den Kaufvertrag — Boden und Gebäude in Euro, zum Kopieren. |
| 7 | Reiter Steuer | „✓ Übernehmen" | Übernehmen schreibt Gebäudeanteil und AfA-Satz in die Steuer. Dazu PDF und Original-Arbeitshilfe. |

### Sprechertext (Entwurf, ca. 95 Sekunden)

Abgeschrieben wird nur das Gebäude, nie der Boden. Wie groß der Gebäudeanteil ist, entscheidet über deine AfA für
Jahrzehnte. Das Finanzamt prüft das mit der Arbeitshilfe des Bundesfinanzministeriums — und genau diese Arbeitshilfe
rechnet DealPilot nach.
Kaufpreis und Nebenkosten kommen aus dem Reiter Investition. Dann Bodenrichtwert, Flächen und Miete — und DealPilot
rechnet alle drei Verfahren. In unserem Beispiel ergibt die amtliche Rechnung 74,82 Prozent Gebäude.
Im Reiter AfA-Hebel stehen vier Varianten daneben, jede mit einem Risiko-Score. Die optimierte Variante kommt auf
79,86 Prozent. Für den Notarvertrag liefert DealPilot die Klausel gleich mit — Boden und Gebäude in Euro.
Ein Klick auf Übernehmen, und Gebäudeanteil und AfA-Satz stehen im Reiter Steuer. Welche Variante du wählst, besprichst
du mit deinem Steuerberater. DealPilot ist eine Rechenhilfe, keine Steuerberatung.

## Querverweise

05 Investition (Kaufnebenkosten, Sanierung) · 10 Steuer-Grundlagen · 11 Restnutzungsdauer · 13 15-%-Grenze ·
04 Reiter Objekt (Bodenrichtwert/BORIS) · 21 Deal-Aktion (Kaufpreisaufteilung-PDF, Belege).
