# 05 · Investition — Kaufpreis, Kaufnebenkosten, Sanierung, Inventar

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen"). Video: Modul 06 (`reihe-investition`), Modul 23 (`reihe-15pct`), Überblick 2 Kapitel 3 (`reihe-ueberblick2`) · Messe-Geschichte(n): 3b (Parkstr. 9, Sanierung unter der 15-%-Grenze), 15 (Steuerberater-Rundgang) (design/Messe/demo-geschichten.md).

## 1 · Wozu

Bevor du startest, steht die Ladeliste: Was kostet der Flug wirklich? Im Reiter Investition trägst du den Kaufpreis ein — DealPilot setzt Makler, Notar, Grundbuch, Grunderwerbsteuer und sonstige Kosten aus deinen Standardwerten daneben, in Prozent und in Euro. Die Grunderwerbsteuer kommt aus der Postleitzahl, denn jedes Land hat seinen eigenen Satz. Dazu kommen Sanierung und Inventar. Am Ende steht die Gesamtinvestition — die Grundlage für Finanzierung, Rendite und Steuer.

## 2 · Wo in der App

| Was | Wo |
|---|---|
| Kaufpreis | Reiter **Investition** → Feld Kaufpreis (`kp`) |
| Kaufnebenkosten | darunter je Position Prozent und Euro: **Makler** (`makler_p/_e`), **Notar** (`notar_p/_e`), **Grundbuchamt** (`gba_p/_e`), **Grunderwerbsteuer** (`gest_p/_e`, aus der PLZ), **Sonstige** (`ji_p/_e`: Bausachverständiger, Anfahrt, Gutachten) |
| Summen | Summe Nebenkosten, **Gesamtinvestition**, Gesamtinvestition je m², Markt-Faktor |
| Sanierung | Karte **Sanierung**: Gewerke anhaken (z. B. Bäder, Elektrik), Beträge änderbar, Summe → Sanierungskosten; brutto/netto wählen; Haken **In Steuer-Werbungskosten übernehmen** mit Verteilung (Automatisch nach 15-%-Regel, 1–5 Jahre, über die AfA-Nutzungsdauer); 15-%-Prüfung mit Grenze netto und brutto |
| Inventar | Küche, Möbel, Geräte … (`inv_kueche`, `inv_moebel`), Summe, eigene Abschreibungsdauer |
| Vorbelegung ändern | **Einstellungen** → **Standardwerte** → Standort & Nebenkosten (Bundesland, Notar & Grundbuch, Maklergebühr) |

## 3 · Schritt für Schritt — Beispiel Modul 06: Sachsenstraße 18, Herford (ETW)

| Feld | Wert |
|---|---|
| Kaufpreis | 180.000 € (Inventar darin enthalten) |
| Makler, Notar, Grundbuch, Sonstige | aus den Standardwerten (3,57 % · 1,7 % · 0,5 % · 1,5 %) |
| Grunderwerbsteuer | aus der PLZ → Nordrhein-Westfalen 6,5 % |
| Sanierung | Bäder und Elektrik angehakt |
| Inventar | Küche 6.000 € + Möbel 2.500 € = 8.500 € |

Was die App zeigt:

| Anzeige | Wert | Warum |
|---|---|---|
| Summe Nebenkosten | 24.786 € (13,8 %) | 6,5 + 1,7 + 0,5 + 3,57 + 1,5 = 13,77 % von 180.000 € |
| Sanierungskosten | Summe der Gewerke (rechnerisch 16.000 €, aus 220.786 − 180.000 − 24.786) | erhöht die Gesamtinvestition |
| Inventar | 8.500 €, eigene Abschreibung, zählt **nicht** zur 15-%-Grenze | bewegliche Wirtschaftsgüter |
| Gesamtinvestition | **220.786 €** | Kaufpreis (mit Inventar) + Nebenkosten + Sanierung — das Inventar zählt nicht doppelt |

## 3b · Beispiel Westerfeldstr. 140, Bielefeld (wie im Bank-PDF)

Kaufpreis **545.000 €** mit jeder Nebenkostenzeile → Gesamtinvestition **592.415 €**; finanziert mit 120.000 € Eigenkapital und 472.415 € Darlehen zu 4,00 %. Die 15-%-Grenze liegt hier rechnerisch bei rund 13.400 € netto, weil der Gebäudeanteil nur 14,6 % beträgt — eine einzige Wohnungssanierung für 16.000 € (Bad 11.000 € + Böden 5.000 €, so im Zielbild von WE 1, 3 und 4 eingetragen) würde sie in den ersten drei Jahren reißen.

Belegt: Modul-06-Eingaben `frontend/js/messe-drehbuch.js:2254ff` (`reihe-investition`: kp 180000, inv_kueche 6000, inv_moebel 2500), 24.786 € / 13,8 % Videoreihe.md „Aufgenommen 16.10.2026" (Modul 02/08), 220.786 € Videoreihe.md Module 06–10, Zusammensetzung 13,77 % Journal qc-v2420a; Westerfeld Videoreihe.md Modul 19; 15-%-Grenze demo-geschichten B.1 („rechnerisch, ohne Gewähr"). Sanierungssumme 16.000 € je Wohnung demo-geschichten D (Zielbild WE 1, 3, 4, eingetragen 20.10.2026).

## 4 · Was man daraus liest — Fragen am Stand

**Woher weiß DealPilot die Grunderwerbsteuer?** Aus der Postleitzahl: sie bestimmt das Bundesland und damit den Satz (z. B. Bayern 3,5 %, NRW 6,5 %).

**Kann ich Prozent oder Euro eintragen?** Beides. Änderst du eins, rechnet DealPilot das andere nach.

**Warum ist Inventar getrennt?** Küche und Möbel sind bewegliche Wirtschaftsgüter mit eigener, kürzerer Abschreibung — und sie zählen nicht zur 15-%-Grenze der Sanierung.

**Was ist die 15-%-Grenze?** Wer in den ersten drei Jahren nach dem Kauf mehr als 15 % der Gebäude-Anschaffungskosten (netto) saniert, muss das als Herstellungskosten über die AfA abschreiben statt sofort. DealPilot zeigt Puffer, knapp oder überschritten.

## 5 · Grenzen und Kennzeichnung

- Neu vorbelegt mit 6,5 % Grunderwerbsteuer, solange keine PLZ da ist — Satz des Bundeslands prüfen.
- Die 15-%-Grenze rechnet netto; brutto eingetragene Kosten werden um 19 % USt bereinigt. Rechenhilfe, **keine Steuerberatung** — der Steuerberater prüft.
- Die Sanierungsbeträge der Gewerke sind Vorschläge, keine Angebote.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Investition, Kaufpreis | 180.000 tippen | Kaufpreis eintragen — die Nebenkosten stehen sofort da, in Prozent und in Euro. |
| 2 | Grunderwerbsteuer | — | Aus der Postleitzahl ermittelt: jedes Bundesland hat seinen eigenen Satz. |
| 3 | Summe Nebenkosten | — | 24.786 € Nebenkosten, 13,8 % — alles aus deinen Standardwerten, jederzeit änderbar. |
| 4 | Karte Sanierung | Bäder, Elektrik anhaken | Gewerke anhaken, Beträge anpassen — die Summe geht in die Gesamtinvestition. |
| 5 | 15-%-Prüfung | — | DealPilot prüft die 15-%-Grenze der ersten drei Jahre gleich mit — netto. |
| 6 | Inventar | Küche, Möbel | Inventar schreibst du separat ab — es zählt nicht zur 15-%-Grenze. |
| 7 | Gesamtinvestition | — | 220.786 € — die Grundlage für Finanzierung und Steuer. |

### Sprechertext (Entwurf, ca. 85 Sekunden)

Was kostet ein Objekt wirklich? Im Reiter Investition steht die vollständige Ladeliste. Du trägst den Kaufpreis ein, hier hundertachtzigtausend Euro. Sofort erscheinen daneben Makler, Notar, Grundbuch und sonstige Kosten — in Prozent und in Euro, aus deinen Standardwerten.

Die Grunderwerbsteuer ermittelt DealPilot aus der Postleitzahl. Für Herford gilt der Satz von Nordrhein-Westfalen: sechs Komma fünf Prozent. Zusammen ergeben sich vierundzwanzigtausendsiebenhundertsechsundachtzig Euro Nebenkosten.

Darunter planst du die Sanierung. Du hakst die Gewerke an, passt die Beträge an und übernimmst die Summe. Gleichzeitig prüft DealPilot die Fünfzehn-Prozent-Grenze der ersten drei Jahre — damit du weißt, ob die Kosten sofort absetzbar sind.

Küche und Möbel trägst du als Inventar ein. Sie haben eine eigene Abschreibung und zählen nicht zur Grenze.

Am Ende steht die Gesamtinvestition: zweihundertzwanzigtausendsiebenhundertsechsundachtzig Euro. Mit dieser Zahl rechnen Finanzierung, Rendite und Steuer weiter.

## Querverweise

- [08 · Finanzierung](08-finanzierung.md)
- [10 · Steuer-Grundlagen](10-steuer-grundlagen.md)
- [12 · BMF-Kaufpreisaufteilung](12-bmf-kaufpreisaufteilung.md)
- [13 · Werbungskosten und 15-%-Grenze](13-werbungskosten-und-15-prozent-grenze.md)
- [26 · Einstellungen, Standardwerte, Investmentprofil](26-einstellungen-standardwerte-investmentprofil.md)
