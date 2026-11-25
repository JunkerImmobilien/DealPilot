# Portfolio-Cockpit · Befunde und Behebung v4830 (25.11.2026)

Gemessen auf Staging (Demokonto, 18 Bestand-Objekte) in einem iframe bei 1440, 1024 und 390 px, Schreibaufrufe abgefangen.

| Befund vorher | Ursache | Nachher |
|---|---|---|
| Investment- und Finanzierungs-Score als große Karten (572 px hoch, Ringe 104 px, Kennzahlen je Gruppe ausgeschrieben) | Reiter-Bewertung-Optik 1:1 im Cockpit | kompakt wie Demo 07: Ring 44 px, Gruppen zweispaltig, Kennzahlen im Tooltip, Handy einspaltig (~120 px je Karte) |
| Kennzahl-Leiste: 4 große Karten, 5. Karte allein über die volle Breite | zwei Raster (gross 4 + klein auto-fit) | alle gewählten Kennzahlen in EINER Leiste, gleich breit (1440: 7 nebeneinander wie Demo 07, Handy 2 Spalten), Beschriftung ohne Umbruch |
| Filter „Art“: Beschriftung über einem 45 px schmalen Feld | globale Label-Regel der App | Art / Objekt / Projektion in einer Zeile, Feld ≥ 96 px |
| Diagramme in halber Breite (Restschuld und Wert, Zinsbindung): Achsen- und Beschriftungstext rund 4 px hoch | Modul vor dem Halbbreit-Layout mit 1156 px gezeichnet, danach auf 571 px gestaucht | ResizeObserver je Modul zeichnet neu, sobald sich die Breite ändert: 0 Texte unter 7,5 px bei 1440, 1024, 390 in allen neun Vorlagen |
| Kacheln unter den Diagrammen: „2,91 Mio €“ bricht um | 24 px Schrift in halber Breite | ohne Umbruch, halbe Breite 18 px |

Alle neun Vorlagen bei 1440 und 390 durchgeschaltet: kein seitliches Scrollen, keine Mini-Schrift. Rest: Tabellenhülle `dptk-huelle` 4 px breiter als ihre Karte (Risiko-Radar, Bank-Mappe) – gewollter Scrollrahmen, sichtbar nicht störend.
Vorher-Bilder wurden nur angesehen, nicht abgelegt.
