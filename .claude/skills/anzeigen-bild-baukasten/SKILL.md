---
name: anzeigen-bild-baukasten
description: Baukasten für DealPilot-Bildwerbung und Anzeigenmotive (Instagram-Feed, Karussell, Story, LinkedIn, Meta-Anzeigen) - sechs Vorlagen mit festen Maßen, Marke und Textregeln, gebaut als HTML-Werkbank und per Chrome-Bildschirmfoto als PNG gerendert, dazu Regeln für KI-Motive aus Higgsfield (nur mit Kostenschätzung und Freigabe) und die Variantenlogik für Meta-Tests. Einsetzen für „mach ein Anzeigenbild“, „Karussell zu …“, „Bildpost für Samstag“, „fünf Anzeigenvarianten“. Nicht für Videos und Reels (dafür messe-video bzw. den Schnitt im Agenten).
---

# Anzeigen-Bild-Baukasten

Bilder werden **gebaut, nicht generiert**: eine HTML-Seite in Markenfarben, echte
App-Bildschirme als Material, gerendert als PNG. KI-Bilder nur als Hintergrund
oder Stimmung und nur mit Freigabe.

## Die Werkbank (schon vorhanden, wiederverwenden)

Vorlage und Renderer liegen in
`Dateien/Social-Media/Mehr-als-ein-Score-2026-11-16/quelle/`:

- `wb.html` · Werkbank mit Rahmen, Schriften (`frontend/fonts/dp-fonts.css`),
  Farben als Variablen, Logo-Fuß
- `ideen.js` · je Motiv eine Funktion, Aufruf über `?i=<idee>&f=<format>`
- `render.mjs` · steuert Chrome über den Debug-Port 9333 und speichert PNGs:
  `node render.mjs <ziel-ordner> idee:format:datei.png …`
- `anschrift-verwischen.mjs` · Anschrift auf Exposé-Bildern unkenntlich
- `material/` · App-Bildschirme und Exposé-Beispiele

Für ein neues Paket: Ordner `quelle/` ins neue Paket kopieren, in `ideen.js` neue
Motive anlegen, rendern. Chrome vorher mit `--remote-debugging-port=9333` starten
(eigenes Profil, nicht Marcels Sitzung). Prüfen, ob eine andere Claude-Sitzung
Chrome gerade nutzt, sonst stören sich die Aufnahmen.

## Formate

| Name | Maß | wofür |
|---|---|---|
| `feed` | 1080×1350 | Instagram- und Facebook-Feed, Meta-Anzeige Feed (Standard) |
| `quad` | 1080×1080 | Karussell, LinkedIn-Bild |
| `story` | 1080×1920 | Story, Reel-Titelbild, Meta-Anzeige Story und Reels |
| `li` | 1200×627 | LinkedIn-Linkbild |

Bei `story`: oben 250 px und unten 340 px frei von Text halten (dort liegen
Profilzeile und Bedienelemente).

## Sechs Vorlagen

| # | Vorlage | Aufbau | gut für |
|---|---|---|---|
| 1 | **Eine Zahl** | Kicker, riesige Zahl, ein Satz darunter, Logo | Irrtum, Gutachter-Wissen, Anzeige kalt |
| 2 | **Bauchgefühl gegen Rechnung** | geteilt: links Behauptung (grau), rechts Rechnung (Gold) | Freitags-Format, Anzeige |
| 3 | **App im Rahmen** | echter App-Bildschirm schräg auf Obsidian, Hook darüber | Donnerstags-Format, Retargeting |
| 4 | **Exposé markiert** | Exposé-Ausschnitt (Anschrift verwischt), Gold-Kreis um die Stelle, Satz | Montags-Begleitbild |
| 5 | **Checkliste** | Titel, 5 Punkte mit Häkchen, „Speichern“ | Samstag, zum Speichern |
| 6 | **Marcel** | Foto von Marcel (nur echtes Foto, nie KI-Gesicht), Zitat, Name und Titel | LinkedIn, Vertrauen, Anzeige |

**Karussell (Dienstag):** Seite 1 = Hook (Vorlage 1 oder 2), Seiten 2 bis 6 = je ein
Gedanke mit großer Schrift, letzte Seite = Handlung plus Logo. Einheitlicher
Kicker auf jeder Seite (`KENNZAHL · 2/7`).

## Text im Bild

- Höchstens **12 Wörter Überschrift**, höchstens **20 Wörter** insgesamt bei Anzeigen.
- Überschrift Space Grotesk 700, Fließtext Inter, Kicker JetBrains Mono in Versalien.
- Hervorhebung nur mit dem Runway-Verlauf (`linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f)`), nicht mit Rot.
- Gold ist Akzent, nicht Textfarbe für Fließtext. Fließtext Creme auf Obsidian.
- Statusfarben bleiben fest: Grün `#3FA56C`, Rot `#B8625C`.
- Kein Gedankenstrich, kein Semikolon, keine Datenquelle, kein Bankname.
- Alle Zahlen sind Beispielwerte an einem fiktiven Objekt, und das steht klein
  unten im Bild („Beispielrechnung“).
- Score-Pille nur mit den echten Stufen: SEHR GUT, GUT, SOLIDE, SCHWACH, KRITISCH.

## KI-Motive (Higgsfield)

Für Stimmungsbilder (Haus im Abendlicht, Cockpit, Schreibtisch mit Plänen):

1. **Erst schätzen:** `estimate_image_cost` bzw. `balance`, Credits in die FREIGABE.md.
2. **Erst nach Marcels Ja erzeugen.** Kein Credit ohne Freigabe.
3. **Nie** ein KI-Gesicht, das wie Marcel oder ein echter Kunde aussieht. Keine
   erkennbaren echten Gebäude mit Anschrift, keine Logos fremder Marken.
4. Prompt immer mit: obsidian black, warm gold accents, cinematic, no text, no logos.
   Text kommt danach in der Werkbank darüber, nie von der KI.
5. Fotorealistische KI-Bilder in der Plattform als KI-Inhalt kennzeichnen.
6. Vorhandene Motive zuerst nutzen: `Dateien/Social-Media/Ertragswert-ImmoWertV-2026-10-28/ki-motive/`.

## Varianten für Meta-Tests

Meta wertet nur echte Unterschiede als neue Anzeige. Deshalb je Thema **3 bis 5
Konzepte**, nicht 5 Farben:

| Variante | was sich ändert |
|---|---|
| A | Vorlage 1 (Zahl) |
| B | Vorlage 6 (Marcel) |
| C | Vorlage 3 (App) |
| D | Vorlage 2 (Gegenüber) |
| E | Video statt Bild (bestes Reel der Woche) |

Dateiname: `<nr>-<thema>-<variante>-<format>.png`, zum Beispiel
`03-liegenschaftszins-B-feed.png`. Jede Variante bekommt einen eigenen
`utm_content`-Wert, damit die Auswertung sie trennen kann.

## Abgabe

- PNGs ins Paket, daneben `bilder.md` mit Alt-Text je Bild als ```` ```kunde alt ```` Block.
- Ein Blick auf jedes PNG mit dem Read-Werkzeug, bevor es in die FREIGABE.md
  kommt: abgeschnittener Text, falsche Schrift, Logo fehlt.
- Danach Skill `freigabe-pruefung`.
