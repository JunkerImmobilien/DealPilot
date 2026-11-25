# Kontrast kleiner Schrift (v4850, 25.11.2026)

Messung: Staging, per Skript in der App, alle Haupt-Reiter und im Objekt-Cockpit jeder Unterreiter in Einfach und Detail.
Gezählt wird jede sichtbare Textstelle bis 13,5 px. Kontrast nach WCAG gegen den tatsächlich gemischten Hintergrund
(Elemente mit Hintergrundbild/Verlauf ausgenommen). Grenze 4,5 : 1.

## Ergebnis

| Objekt | Textstellen | unter 4,5 : 1 vorher | nachher |
|---|---:|---:|---:|
| Westerfeldstr. 146 | 5.986 / 6.026 | 623 | 104 |
| Hauptstr. 51 | 4.724 | nicht sauber gemessen (Zwischenstand mit Teilwirkung: 331) | 86 |

Status-Grün, Status-Rot und gedämpfte Grautöne in kleiner Schrift: nachher **0** Stellen unter 4,5 : 1 auf hellem Grund.

## Vorher, die großen Gruppen (Westerfeldstr. 146)

| Farbe | Grund | Kontrast | Stellen |
|---|---|---:|---:|
| Status-Grün #3FA56C | Weiß | 3,08 | 141 |
| Status-Rot #B8625C | Weiß | 4,25 | 117 |
| Grau #6E675C | Obsidian (Seitenleiste) | 3,48 | 66 |
| Gold #C9A84C (Augenbrauen der Grafiken) | Creme | 2,12 | 46 |
| Grau #938B7F | Weiß | 3,37 | 42 |
| Grau #8A8272 | Weiß | 3,81 | 37 |
| Grün / Rot in der Steuer-Jahrestabelle | Creme | 2,86 / 3,94 | 20 / 19 |

## Lösung

`js/kontrast-text.js` (eine Stelle statt hunderter Literale): Text bis 13,5 px in Status-Grün, Status-Rot oder gedämpftem
Grau, der auf seinem Grund unter 4,5 : 1 liegt, bekommt eine feste Textvariante (Klasse, `css/style.css`):

| Klasse | Farbe | Kontrast |
|---|---|---|
| dp-kt-gruen | #27704A | 6,00 Weiß · 5,55 Creme · 5,04 Hellgrau |
| dp-kt-rot | #9E4943 | 6,02 Weiß · 5,57 Creme · 5,06 Hellgrau |
| dp-kt-grau | #6B655C | 5,77 Weiß · 5,34 Creme · 4,85 Hellgrau |
| dp-kt-gruen-d (dunkler Grund) | #6FCF97 | 10,2 Obsidian · 7,8 #2A2727 |
| dp-kt-rot-d | #EE9A93 | 8,95 Obsidian · 6,83 #2A2727 |
| dp-kt-grau-d | #B3ACA2 | 8,64 Obsidian · 6,59 #2A2727 |

Flächen, Balken, Ampeln, Ränder und große Zahlen behalten die Markenfarben. Die Varianten sind feste Ableitungen, keine
Whitelabel-Tokens. Der Beobachter reagiert auf neue Inhalte und auf Reiterwechsel (class/style/hidden), merkt sich
beurteilte Elemente (zweiter Lauf 22 ms statt 244 ms) und stuft ein Element neu ein, wenn die App seine Klasse ändert.

## Bewusst offen (nachher, Westerfeldstr. 146: 104 Stellen)

- **Gold als Textfarbe** (Augenbrauen „Verlauf mit Steuern“, „wichtig“, „Genau“-Kennzeichen, ca. 80 Stellen, 2,1 bis 2,9 : 1):
  Gold ist der Akzent und folgt der Partnerfarbe. Eine dunklere Textvariante müsste je Partnerfarbe abgeleitet werden.
  Entscheidung offen.
- **Weiße Schrift auf Gold-/Grünflächen** (Etiketten, 2,3 bis 3,1 : 1): Etikett-Gestaltung, nicht angefasst.
- **Blau #1F7AAD auf Hellblau** („info-tag“, 4,04 : 1), Einzelstellen.
- **„253,252,250 auf 248,246,241“** (k 1,05): unsichtbare Platzhalter-Texte, kein Befund.
