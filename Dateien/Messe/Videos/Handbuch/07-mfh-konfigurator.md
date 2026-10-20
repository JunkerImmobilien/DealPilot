# 07 · MFH-Konfigurator — Wohnung für Wohnung

> Stand 20.10.2026 (Staging bis v2544). Zahlen vor der Messe live gegenprüfen.
> Video: Modul 26 „Mieterhöhung und Zielbild" (`DREHBUECHER`-Schlüssel `reihe-zielbild`, Studio `?modul=26`) ·
> Messe-Geschichten: 2 Bismarckstr. (Leerstand), 8 Westerfeldstr. „Ein Haus, alle Hebel", 10 Hauptstr. (Gewerbe) (design/Messe/demo-geschichten.md)

## 1 · Wozu

Ein Mehrfamilienhaus ist kein großes Apartment — jede Wohnung hat ihren eigenen Mietvertrag, ihren eigenen
Zustand und ihren eigenen Hebel. Im MFH-Konfigurator erfasst du das Haus Wohnung für Wohnung, bevor du an den
Start rollst: was heute gezahlt wird (Ist), was der jetzige Mieter nach normalen Mieterhöhungen zahlt (Soll-Miete)
und was nach deinem Umbau oder bei Neuvermietung drin ist (Zielbild). Daraus rechnet DealPilot die Miete des
Hauses, die Modernisierungspunkte nach Anlage 2 und — wenn du willst — den Wert jeder Wohnung als
Eigentumswohnung. Das ist dein Flugplan für das Haus, nicht nur die Momentaufnahme.

## 2 · Wo in der App

- **Reiter Objekt** → Objektart „Mehrfamilienhaus" → unter der Wohnfläche der Knopf **„Einheiten erfassen"**
  (`frontend/index.html:1436`, Knopf `#mfh-oeffnen`). Er öffnet den Konfigurator in vier Schritten
  (`frontend/js/mfh-einheiten.js`):
  1. **Schritt 1 · Gebäude** — die vier gemeinsamen Gewerke nach Anlage 2 (Dach, Außenwand, Leitungen, Heizung),
     der Haken **„aufgeteilt"** (in Wohnungseigentum aufgeteilt) mit **Kosten der Aufteilung** (Vorbelegung
     1.800 € je Wohnung, eigene Angabe möglich) und das Feld **„Zielbild fertig (Jahr)"** (gespiegelt nach
     `zb_fertig_jahr` im Reiter Objekt).
  2. **Schritt 2 · Einheiten** — die schlanke Liste: Nr., Lage, m², Zimmer, Ist-Miete, Status; je Zeile
     **„Details · Plan"**.
  3. **Schritt 3 · Zustand je Einheit** — Fenster, Bäder, Innenausbau, Grundriss je Wohnung.
  4. **Schritt 4 · Ergebnis** — Punkte des Hauses (flächengewichtet) und die **Restnutzungsdauer des Gebäudes**
     (Anlage 2, indikativ), dazu **„Übernehmen"** ins Objekt.
- **Wohnungsfenster** („Details"): Blöcke Stammdaten · Mietvertrag · Ist · **Soll-Miete (Mieter bleibt)** ·
  **Zielbild** (Maßnahmen-Chips mit Kosten, Zielmiete, wann) · **Ertragswert dieser Wohnung** (als Eigentumswohnung
  bzw. Anteil am Haus).
- Folgen außerhalb des Konfigurators:
  - Reiter **Miete** → Mietentwicklung **„Aus Wohnungen"** (Soll-Miete je Wohnung ab „erreichbar").
  - Reiter **Objekt** → Zeile **Modernisierungspunkte** in „Parameter der Verkehrswertermittlung" mit dem
    Umschalter **„Punkte aus: den Einheiten (Konfigurator) | den acht Feldern"** (seit v2540b, Feld `mod_quelle`).
  - Reiter **Objekt** → Karte „Mieterhöhung und Zielbild (optional)" zeigt beim MFH nur die Summe aus den Wohnungen.
  - **Pilot-Analyse** → „Ankauf · Bestand · Zielbild", **Tab Bewertung** → Karte Wertpotenzial, beide PDFs → Seite
    „Wertpotenzial" und Mieterliste (siehe 16, 18, 20).

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH, Bj ca. 1967, KP 545.000 €)

**Stand im Konto (gespeichert):** vier Wohnungen. Das Nutzungsdauergutachten nennt sechs — die Eintragsliste B.1
in demo-geschichten.md ist ein **Vorschlag**, nicht eingetragen. Gezeigt wird deshalb der gespeicherte Stand.

| Schritt | Feld | Wert (gespeichert) |
|---|---|---|
| 2 | Wohnungen | 4 |
| 2 | Ist-Miete je Wohnung | 799 · 799 · 799 · 798 € |
| 2 | Summe Ist (Haus) | 3.195 €/Monat |
| Details | Mietvertrag | unbefristet (kein Staffel-/Index-Haken) |
| Details | eigene Soll-Miete | im gespeicherten Stand 950 · 850 · 880 · 840 € (Summe 3.520 €) |
| 1 | Gebäude-Gewerke | Dach 0 · Heizung „teilweise" · Leitungen 0 · Außenwand „teilweise" |

**Was die App zeigt:**

1. **Summenzeile Soll.** Mit den eigenen Soll-Mieten 3.520 €/Monat. Lässt du die eigene Soll leer, rechnet DealPilot
   selbst: bis zur ortsüblichen Vergleichsmiete (§ 558 BGB), frühestens 15 Monate nach der letzten Erhöhung,
   höchstens um die **Kappungsgrenze — in Bielefeld 15 % in drei Jahren** (Mieterschutzverordnung NRW, aus
   `js/data/kappungsgrenzen.json`). Gemessen ergab das **4 × 880,43 € = 3.521,72 €** — dieselbe Zahl in Summenzeile,
   Wohnungsfenster, „Ist gegen Soll" im Bank-PDF und Ist/Soll-Karte.
2. **Schritt 4 · Restnutzungsdauer des Hauses:** Punkte des Hauses = flächengewichtete Punkte der Einheiten, auf
   ganze Punkte gerundet → **7 Punkte, RND 35 Jahre (GND 80)**. Dieselbe Zahl steht in der Zinssatz-Zeile des
   Reiters Objekt, im Wertpotenzial und in der Mieterliste des Bank-PDF.
3. **„Übernehmen"** schreibt die Summe ins Objekt und stellt die Mietentwicklung auf **„Aus Wohnungen"** (Toast
   nennt das). Ab dem Soll-Jahr steigt die Miete in der Tabelle von 39.420 € auf 43.320 € im Jahr (inkl.
   Zusatzeinnahmen).
4. **Zielbild** je Wohnung: Maßnahme als Chip (Bad, Fenster, Böden/Innenausbau, Grundriss tragen Punkte nach
   Anlage 2, höchstens bis zum Maximum des Gewerks; Dach, Fassade, Heizung, Leitungen gehören dem Haus) mit Kosten
   und Zielmiete. Eine Maßnahme mit Haken **„bewohnt (§ 559)"** erhöht die Soll-Miete um 8 % der Kosten im Jahr,
   gedeckelt auf 3 €/m² (2 €/m² unter 7 €/m² Ausgangsmiete) in sechs Jahren.
5. **Haken „aufgeteilt"**: jede Wohnung erscheint zusätzlich als Eigentumswohnung mit dem Zins für vermietetes
   Wohnungseigentum (Bielefeld 2,9 %, Ausschuss Stadt Bielefeld, gegen 2,5 % für das MFH). An der Westerfeldstr.
   ergibt das „kein Potenzial" — mit Begründung (höherer ETW-Zins, höhere Verwaltung je Einheit).

**Gegenbild — Bismarckstr. 27, Detmold (6 WE, Bj 1908):** zwei Wohnungen „leer". Seit v2520 rechnet der Ertragswert
die Ist-Miete nur auf der **vermieteten** Fläche und setzt leere Wohnungen mit der marktüblichen Miete an; seit
v2540 wird jede Wohnung einzeln gegen das Marktüblichkeitsband geprüft. Achtung im Datensatz: WE 2 steht „leer",
trägt aber Ist 836 € (Widerspruch, A.1) — vor dem Zeigen klären.

**Gegenbild — Hauptstr. 51, Ibbenbüren (WGH):** Ladenlokal 240 m² mit 2.640 € von 5.242 € Monatsmiete = 50 % an
einem Vertrag; WE 5 leer (Komplettrenovierung 28.000 €). Gewerbe rechnet der Ertragswert getrennt.

Belegt: Ist-Mieten und Soll 950/850/880/840 Journal v2410; 3.520 / 3.521,72 / 4 × 880,43 Journal v2486;
7 Punkte / 35 J. / GND 80 Journal v2483; 39.420 → 43.320 € Journal v2410; Kappung Bielefeld 15 % Journal v2430 und
demo-geschichten B Punkt 4; § 559 8 % / 3 bzw. 2 €/m² help.js („Wie DealPilot die Soll-Miete vorrechnet");
1.800 €/WE help.js; Zins 2,9/2,5 % Journal v2432; Leerstand Journal v2520/v2540; Bismarckstr. A.1;
Hauptstr. Geschichte 10.

## 4 · Was man daraus liest — Fragen am Stand

- **„Woher weiß DealPilot, wie viel ich erhöhen darf?"** — § 558 bis zur Vergleichsmiete, 15 Monate Sperrfrist ab
  der letzten Erhöhung, Kappungsgrenze der Gemeinde aus der Landesverordnung (821 Gemeinden hinterlegt). Ist die
  Verordnung ausgelaufen oder die Gemeinde unbekannt, rechnet DealPilot mit 20 % und sagt „bitte prüfen".
- **„Und wenn ich schon weiß, was ich verlange?"** — Deine eigene Soll-Miete überschreibt immer.
- **„Lohnt sich die Aufteilung?"** — DealPilot zeigt es je Wohnung mit dem amtlichen ETW-Zins. In NRW ist sie oft
  negativ; der Grund steht dabei. Kein Bauchgefühl, eine Rechnung.
- **„Warum ändert sich die Restnutzungsdauer, wenn ich ein Bad eintrage?"** — Anlage 2 bewertet das Gebäude; Bäder
  zählen je Wohnung anteilig nach Fläche, so wie ein Sachverständiger teilmodernisierte Häuser ansetzt.
- **„Muss ich jede Wohnung eintragen?"** — Nein. Ohne Einheiten gelten die acht Felder im Reiter Objekt.

## 5 · Grenzen und Kennzeichnung

- Soll-Miete und Zielbild sind **Planwerte**; der Ertragswert je Stufe ist ein **Potenzialwert, keine
  Verkehrswertermittlung**. Er erscheint nur mit Freigabe Stufe 3 (Tarif oder vorhandener Stufe-3-Bericht).
- Mietrecht: DealPilot rechnet die gesetzlichen Grenzen nach, ersetzt aber **keine Rechtsberatung**
  (Mietspiegel, Begründung des Erhöhungsverlangens, Härtefälle bleiben beim Vermieter).
- Die RND aus dem Konfigurator ist **indikativ** (Anlage 2, Stichtag heute) — fürs Finanzamt zählt der
  Anschaffungsstichtag und ein Gutachten (siehe 11).
- Score, Verkehrswert und Marktbericht bleiben beim Bestand; das Zielbild verschiebt den Score nicht.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Objekt, MFH, Wohnfläche | — | Beim Mehrfamilienhaus erscheint unter der Wohnfläche „Einheiten erfassen" — jede Wohnung einzeln. |
| 2 | Schritt 1 · Gebäude | Haken „aufgeteilt", Jahr Zielbild | Dach, Fassade, Leitungen, Heizung gehören dem Haus. Ein Haken zeigt jede Wohnung zusätzlich als Eigentumswohnung. |
| 3 | Schritt 2 · Liste | Wohnungen tippen | Nummer, Lage, Fläche, Zimmer, Ist-Miete, Status — nur das Nötigste. Alles Weitere steht in den Details. |
| 4 | Wohnungsfenster · Soll-Miete | „Details" | Ohne eigene Angabe rechnet DealPilot bis zur Vergleichsmiete, mit Sperrfrist und Kappungsgrenze der Gemeinde. |
| 5 | Wohnungsfenster · Zielbild | Chip „Bad" mit Kosten | Maßnahmen als Chips mit Kosten. Bad, Fenster, Böden, Grundriss bringen Modernisierungspunkte nach Anlage 2. |
| 6 | Schritt 4 · Ergebnis | — | Die Punkte des Hauses kommen flächengewichtet aus den Wohnungen — eine Punktzahl, eine Restnutzungsdauer. |
| 7 | Reiter Miete · Mietentwicklung | „Übernehmen" | Übernehmen schreibt die Summe ins Objekt. Die Mietentwicklung rechnet jetzt „Aus Wohnungen". |

### Sprechertext (Entwurf, ca. 95 Sekunden)

Ein Mehrfamilienhaus besteht aus Wohnungen — und jede hat ihre eigene Geschichte. Deshalb erfasst DealPilot sie
einzeln. Im Reiter Objekt öffnest du „Einheiten erfassen". Zuerst das Haus: Dach, Fassade, Leitungen und Heizung
gelten für alle. Ein Haken sagt, ob das Haus in Wohnungseigentum aufgeteilt werden soll.
Dann die Liste: Lage, Fläche, Zimmer, Ist-Miete. In den Details jeder Wohnung steht der Mietvertrag — und die
Soll-Miete. Trägst du nichts ein, rechnet DealPilot sie nach dem Gesetz: bis zur Vergleichsmiete, frühestens
fünfzehn Monate nach der letzten Erhöhung, höchstens bis zur Kappungsgrenze deiner Gemeinde. In Bielefeld sind das
fünfzehn Prozent in drei Jahren.
Im Zielbild planst du den Umbau: ein neues Bad, neue Böden, mit Kosten und Zielmiete. Jede Maßnahme bringt
Modernisierungspunkte — und damit eine längere Restnutzungsdauer für das ganze Haus.
Ein Klick auf „Übernehmen", und die Wohnungen tragen dein Objekt: Miete, Mietentwicklung, Bewertung.
Wichtig: Soll und Zielbild sind dein Plan. Was daraus an Wert entsteht, ist ein Potenzialwert — keine
Verkehrswertermittlung.

## Querverweise

04 Reiter Objekt (Modernisierungspunkte, Zinssatz-Zeile) · 06 Miete („Aus Wohnungen") · 11 Restnutzungsdauer ·
16 Pilot-Analyse („Ankauf · Bestand · Zielbild") · 17 Abruf „Marktpreise" · 18 Tab Bewertung (Wertüberleitung) ·
20 Bank-PDF (Mieterliste, Wertpotenzial) · Hilfe: help.js „Mieterhöhung und Zielbild".
