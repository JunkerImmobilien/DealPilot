# Demo-Mehrfamilienhaus · Gerberstraße 27 · gemessen am 24.09.2026

Marcel wollte ein zweites Demo-Objekt: Mehrfamilienhaus, sechziger oder
siebziger Jahre, sechs Einheiten, Kaufpreis um 743.000 €, und einen
**deutlich sichtbaren Sprung bei der Abschreibung** statt der zahmen
50 → 44 Jahre der Lindenallee.

Das Objekt ist auf Staging angelegt (`2026-1037`) und **komplett
durchgerechnet** — alle Zahlen hier stammen aus der App, keine ist von
Hand gesetzt.

## Das Objekt

| | |
|---|---|
| Adresse | Gerberstraße 27, 32105 Musterstadt (erfunden) |
| Art | Mehrfamilienhaus, 6 Einheiten, 3 Vollgeschosse |
| Baujahr | 1968 · Massiv, vollunterkellert, Satteldach Betonziegel |
| Wohnfläche | 432 m² (6 × 72 m²) |
| Kaufpreis | 743.000 € = 1.720 €/m² |
| Miete | 3.456 €/Monat = 8,00 €/m² |
| Grundstück | 780 m², BRW 240 €/m² → **Bodenwert 187.200 €** |
| Zustand | normal, Energieklasse E, Fenster und Heizung vor 10–20 J. erneuert |
| Finanzierung | 250.000 € EK, 579.000 € Darlehen, 3,62 % / 2,0 %, 10 J. |

## Was die App rechnet

| Kennzahl | Wert |
|---|---:|
| Bruttorendite | 5,58 % |
| Nettorendite | 4,91 % |
| Kaufpreisfaktor | 17,9 |
| **DSCR** | **1,275** |
| LTV | 77,9 % |
| Cashflow vor Steuer | +744 €/Monat |
| Cashflow nach Steuer | +5.310 €/Jahr |
| Break-Even | Jahr 1 |
| **DealPilot Score** | **88 / 100 · Top Deal** |
| **Investor Deal Score** | **76 / 100 · Gut** |

Teilnoten des Investor Deal Score: Rendite 72 (40 %) · Finanzierung 90
(25 %) · Risiko 75 (20 %) · Lage & Markt 68 (8 %) · Upside 56 (7 %).

> **Damit ist die 76 endlich verdient.** Die Lindenallee zeigte 76
> „Gut", gerechnet waren es 39 „Schwach" — die Zahl war gesetzt. Hier
> kommt sie aus dem Programm.

## Der Abschreibungssprung — darum ging es

Baujahr 1968, Stichtag 2026 → Alter 58 Jahre. Gesamtnutzungsdauer MFH
70 Jahre. Modernisierungspunkte nach Anlage 2 ImmoWertV: **2 von 20**
(nur Fenster und Heizung, vor 10–20 Jahren).

Der Assistent rechnet drei Verfahren:

| Verfahren | Restnutzungsdauer |
|---|---:|
| Linear | 22,0 Jahre (72,50 % AWM) |
| Punktraster | 24,3 Jahre (69,61 % AWM) |
| Technisch (vorrangig) | 14,3 Jahre (82,13 % AWM) |
| **Geschätzte RND** | **14–24 Jahre** |

Bei angesetzten **14 Jahren**:

| | Regelfall | mit Nachweis |
|---|---:|---:|
| AfA-Satz | 2,0 % | **7,14 %** |
| AfA pro Jahr | 11.888 € | **42.440 €** |
| Mehr-Abschreibung | — | **+30.552 €** |
| Steuerersparnis (42 %) | — | **+12.832 €/Jahr** |

**50 → 14 Jahre.** Das ist der Sprung, der in die Demo gehört.

## Drei Fehler, die dabei gefunden wurden

Alle drei betreffen den Restnutzungsdauer-Assistenten, alle drei sind
behoben und auf Staging ausgerollt.

**1 · Das achte Bauteil war das falsche** (v1597). Schritt 5 fragte
„Technische Ausstattung"; die Punktvergabe bewertet aber
`grundriss` — wie Anlage 2 ImmoWertV es vorschreibt. Die Antwort auf die
achte Frage fiel ersatzlos weg, erreichbar waren 18 statt 20 Punkte.

**2 · Die „Live-Anzeige" war nicht live** (v1597). Der Kommentar sagte
es, der Code tat es nicht: die Punktzahl stand auf „0 / 20", bis man
den Schritt verließ und wieder betrat.

**3 · Der Steuervorteil rechnete auf 200.000 €** (v1598 / v1598b) —
egal wie teuer das Objekt war.

| | vorher | jetzt |
|---|---:|---:|
| Standard-AfA | 4.000 € | **11.888 €** |
| Reduzierte AfA | 13.986 € | **41.566 €** |
| Mehr-AfA pro Jahr | +9.986 € | **+29.678 €** |
| Steuerersparnis/Jahr | 4.194 € | **12.465 €** |
| **Netto-Vorteil** | 50.718 € | **152.702 €** |

Der Kunde bekam **gut 100.000 € zu wenig** angezeigt — neben dem Wort
„Netto-Vorteil", also genau an der Stelle, an der jemand entscheidet,
ob sich ein Gutachten lohnt.

Die Ursache lag in drei Bausteinen, jeder für sich richtig, keiner mit
dem nächsten verbunden: `prefillFromDealPilot()` rechnet den
Gebäudeanteil korrekt aus und **wird von niemandem aufgerufen**;
`computeAfaEstimate()` liest ihn korrekt aus dem State; `computeRND()`
hatte 200.000 € fest verdrahtet — und füllt den Ergebnisschirm.

## Noch offen

- Unter „AfA / Jahr (berechnet)" steht weiter **„2,0 % linear"**,
  während der Betrag schon 42.440 € (7,14 %) zeigt. Die Beschriftung
  zieht nicht nach.

## Die Bilder

| Datei | zeigt |
|---|---|
| `00-objektfoto.webp` | das Gebäude (erzeugt, 1968er Typ, 6 Einheiten) |
| `01-rnd-ergebnis.jpg` | RND 14–24 Jahre, Netto-Vorteil 152.702 € |
| `02-uebersicht-score.jpg` | Score 76 „Gute Bewertung" mit allen fünf Teilnoten |
| `03-steuer-progression.jpg` | Steuer-Modul, echte Progression 2026 |
| `04-afa-regelfall-11888.jpg` | Regelfall 2,0 % → 11.888 € |
| `05-afa-nachweis-42440.jpg` | Nachweis 7,14 % → 42.440 € |
