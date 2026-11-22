---
name: tagesproduktion
description: Tägliche Social-Media-Produktion für DealPilot nach Redaktionsplan - nimmt den Plan aus Dateien/Social-Media/Strategie-2026-11-22/Wachstumsplan.md, baut zwei Tage im Voraus das Tagespaket (Skript, Hooks, Captions je Plattform, Bild oder Schnitt, Untertitel), lässt die Freigabe-Prüfung laufen und legt FREIGABE.md für Marcel ab. Dazu Drehvorbereitung für Marcels Drehtage, Klonstimme und Higgsfield nur mit Kostenschätzung, und die wöchentliche Auswertung mit Kennzahlen. Einsetzen für „mach das Paket für morgen“, „Tagesproduktion“, „bereite den Drehtag vor“, „werte die Woche aus“. Veröffentlicht nie selbst.
---

# Tagesproduktion

Ziel: Jeden Abend liegt das Paket für **übermorgen** fertig geprüft bereit. Marcel
braucht zehn Minuten zum Freigeben. So bleibt ein Puffertag, falls er etwas
ändern will.

## Ablage

```
Dateien/Social-Media/Tagesproduktion/
  plan-laufend.md              <- Redaktionsplan der aktuellen 4 Wochen (Kopie aus dem Wachstumsplan, wird fortgeschrieben)
  auswertung.md                <- Wochenzahlen, eine Zeile je Beitrag
  einsendungen/                <- Zuschauer-Exposés mit Einwilligung (nie ins Repo committen)
  JJJJ-MM-TT-<thema>/
    FREIGABE.md                <- das Einzige, was Marcel liest
    skript.md                  <- Sprechtext, Szenen, Bildschirm-Stellen
    01-<plattform>.md          <- Hook und Caption als ```kunde```-Blöcke
    01-reel-9x16.mp4 / .srt    <- Schnitt und Untertitel
    01-feed.png …              <- Bilder
    quelle/                    <- Rohmaterial, Werkbank, Rechnung zu jeder Beispielzahl
```

`einsendungen/` enthält personenbezogene Daten. **Nie stagen, nie committen.**

## Ablauf je Tag

1. **Plan lesen.** Tag, Format, Thema, Hook-Vorschlag aus `plan-laufend.md`.
   Wochenrhythmus: Mo Exposé-Check · Di Karussell · Mi Gutachter-Wissen · Do App ·
   Fr Bauchgefühl gegen Rechnung · Sa Bildpost · So Gründer-Text.
2. **Fakten holen.** Jede Funktion, jeder Preis, jede Zahl aus dem Repo
   (`CLAUDE.md`, `frontend/js/config.js`, `frontend/landing/index.html`,
   `claude/projektanweisung-hauptapp.md`). Beispielrechnungen am echten Rechenkern
   oder in der App auf Staging, nie im Kopf. Die Rechnung liegt in `quelle/`.
3. **Hooks schreiben.** Skill `hook-formeln`: fünf Hooks, bewerten, A und B wählen.
4. **Skript schreiben** nach dem passenden Gerüst aus `hook-formeln`.
5. **Material bauen.**
   - Bild oder Karussell: Skill `anzeigen-bild-baukasten`.
   - App-Video: vorhandene Aufnahmen zuerst (`Dateien/Messe/Videos/`,
     Videothek `Videoreihe-Sprecher/`, `Dateien/Social-Media/*/app-aufnahme`).
     Neue Aufnahmen über den Skill `messe-video` (echte App, Drehbuch, Staging).
   - Marcel-Clip: aus dem Rohmaterial des Drehtags schneiden (ffmpeg), Untertitel
     als `.srt` erzeugen und einbrennen.
6. **Captions je Plattform** eigenständig, nicht fünfmal derselbe Text.
7. **Prüfen.** `node .claude/skills/freigabe-pruefung/pruefe-text.mjs <paket>`,
   dann die Prüfliste aus `freigabe-pruefung`. Jedes PNG und ein Standbild je
   Video mit Read ansehen.
8. **FREIGABE.md** schreiben (Format im Skill `freigabe-pruefung`).
9. **Melden:** ein Satz an Marcel, welches Paket bereitliegt und was seine
   Entscheidung braucht.

## Stimme und Higgsfield

- **Klonstimme Marcel:** Higgsfield, voice_id und Hinweise in
  `Dateien/Messe/Videos/Sprecher-Demo/LIESMICH-Stimme-Marcel.txt` (rund 0,3 Credits
  je Zeile). Nur für App-Videos und Erklärstücke, **nie** für Aussagen, die Marcel
  nicht selbst so freigegeben hat. Jede Zeile steht vorher wörtlich in
  `skript.md`, und Marcel gibt den Wortlaut frei.
- **Jeder Higgsfield-Aufruf kostet.** Vorher `balance` und die passende
  `estimate_*_cost`-Abfrage, Summe in die FREIGABE.md, erst nach Marcels Ja
  erzeugen. Kein Stapel „auf Verdacht“.
- KI-Video mit echt wirkenden Menschen oder Orten und jede Klonstimme werden in
  der Plattform als KI-Inhalt markiert. Hinweis dazu in die FREIGABE.md.
- Musik nie im Paket. Marcel legt lizenzierte Musik in der Plattform darunter.

## Drehtag vorbereiten (zweimal im Monat)

Zwei Tage vorher legt der Agent `Tagesproduktion/drehtag-JJJJ-MM-TT.md` ab:

- 8 bis 12 Clips, je Clip: Format, Hook A (groß gedruckt), drei Stichpunkte,
  Handlung am Ende, welches Exposé oder welcher Bildschirm daneben läuft.
- Reihenfolge: zuerst die Exposé-Checks (brauchen Bildschirm), dann die kurzen
  Stücke frontal.
- Technik-Zettel: Handy hochkant auf Stativ, Augenhöhe, Fenster seitlich als
  Licht, Ansteckmikrofon, Flugmodus, jeden Hook zweimal sprechen (A und B).
- Exposés vorher anonymisieren und ausdrucken oder auf dem zweiten Bildschirm.

Marcel spricht frei nach Stichpunkten, nicht vom Blatt. Echt schlägt perfekt.

## Gründer-Text (Sonntag)

Marcel schickt eine Sprachnachricht oder ein paar Sätze. Der Agent schreibt daraus
150 bis 250 Wörter in Marcels Ich-Form, ohne etwas hinzuzuerfinden. Jede Aussage,
die nicht in Marcels Vorlage steht, wird in der FREIGABE.md markiert.

## Wöchentliche Auswertung (montags)

Marcel trägt die Zahlen aus den Plattform-Statistiken ein oder schickt
Bildschirmfotos. Der Agent pflegt `auswertung.md`:

| Datum | Plattform | Format | Hook | Reichweite | Hook-Rate | Ø Wiedergabe | Sendungen/1.000 | Speicherungen/1.000 | Link-Klicks | Registrierungen (UTM) |
|---|---|---|---|---|---|---|---|---|---|---|

Danach drei Sätze:
1. **Gewinner der Woche** (meiste Sendungen pro Reichweite) wird nächste Woche
   Anzeige in der Testspur und bekommt einen Nachfolger mit gleichem Muster.
2. **Verlierer** (Hook-Rate unter 20 %): Hook-Muster eine Woche aussetzen.
3. **Anpassung** am Plan der nächsten Woche, in `plan-laufend.md` eintragen.

Registrierungen je Kampagne liest der Agent nur, wenn Marcel sie liefert oder ein
lesender Weg freigegeben ist. Er fasst dafür keine Produktionsdatenbank an.

## Was nie passiert

- Nichts wird veröffentlicht, geplant oder an Dritte geschickt.
- Kein Geld, keine Credits ohne Freigabe.
- Keine echten Namen, Anschriften oder Unterlagen im Repo (Muster und erfundene
  Namen in Tests und Doku).
- Kein `git add -A`. Pakete werden nur auf Marcels Wunsch committet, einzeln
  gestaged, `einsendungen/` nie.
