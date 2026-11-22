---
name: freigabe-pruefung
description: Qualitäts-, Marken- und Rechtsprüfung für jeden DealPilot-Social-Media-Beitrag, bevor er Marcel zur Freigabe vorgelegt wird. Prüfskript für Gedankenstriche, Semikolons, Datenquellen, Banknamen, falsche Score-Wörter, Garantien und unbelegte Beträge, dazu die Prüfliste für Inhalt, Zahlen, Recht und KI-Kennzeichnung, und das Format der FREIGABE.md. Einsetzen vor jeder Abgabe eines Posts, Reels, Anzeigenbilds oder Untertitels, und wenn Marcel fragt „kann das so raus?“. Nicht für App-Texte im Code oder für interne Doku.
---

# Freigabe-Prüfung vor dem Veröffentlichen

Kein Beitrag geht an Marcel, der diese Prüfung nicht bestanden hat. Marcel gibt
frei, nicht der Agent. Die Prüfung sorgt dafür, dass er nur noch über Inhalt
und Geschmack entscheiden muss, nicht über Fehler.

## Schritt 1 · Kundentext markieren

In jeder Paketdatei steht der Text, der veröffentlicht wird, in einem Block mit
der Kennung `kunde`:

````
```kunde hook
Dieses Exposé verspricht 7 Prozent. Ich habe nachgerechnet.
```

```kunde instagram
…Caption…
```
````

Erlaubte Kennungen: `kunde hook`, `kunde bild` (Text im Bild), `kunde instagram`,
`kunde tiktok`, `kunde shorts`, `kunde linkedin`, `kunde facebook`,
`kunde youtube`, `kunde alt` (Alt-Text), `kunde anzeige`. Interne Notizen stehen
außerhalb der Blöcke und werden nicht geprüft. Untertitel als `.srt` werden ganz
geprüft.

## Schritt 2 · Prüfskript laufen lassen

```
node .claude/skills/freigabe-pruefung/pruefe-text.mjs <paket-ordner>
```

- **ROT** (RC 1): darf so nicht raus. Beheben und neu prüfen.
- **GELB**: hinsehen. Entweder beheben oder in der FREIGABE.md begründen, warum es
  so bleibt (zum Beispiel „178.000 € ist der Kaufpreis im Beispiel-Exposé“).
- Die gültigen Preise stehen in `preise.json`. **Bei jeder Preisänderung erst in
  `frontend/js/config.js` nachmessen, dann die Liste nachziehen.**

Das Skript ersetzt das Lesen nicht. Es fängt nur, was beim Lesen durchrutscht.

## Schritt 3 · Prüfliste von Hand

**Sprache**
- [ ] Du-Form, Deutsch, keine Fachkürzel ohne Erklärung (DSCR, LTV, AfA nur mit Klartext)
- [ ] Kein Gedankenstrich, kein Semikolon (Marcel 17.11.2026). Punkt oder Komma.
- [ ] Hook höchstens 12 Wörter, steht gesprochen **und** als Text im Bild
- [ ] Eine Handlung am Ende, nicht drei

**Marke**
- [ ] Bildsprache Luftfahrt passt (Cockpit, Boarding, Co-Pilot, Runway, Pre-Flight), nicht übertrieben
- [ ] Score-Wörter genau: Sehr gut (ab 85), Gut (ab 70), Solide (ab 50), Schwach (ab 35), Kritisch
- [ ] Es heißt Kontingent, nie Kerosin oder Liter
- [ ] Farben Obsidian `#050505`, Gold `#C9A84C`, Creme `#FDFCFA`, Schriften Space Grotesk, Inter, JetBrains Mono
- [ ] Logo aus `design/logo/`, nie nachgebaut

**Zahlen und Aussagen**
- [ ] Jeder Preis aus `config.js` (siehe `preise.json`), jede Funktion in App oder Landing belegt
- [ ] Nutzerzahlen nur, wie sie auf der Startseite stehen (dort „> 870“), nie hochgerundet
- [ ] Beispielzahlen als Beispiel gekennzeichnet, die Rechnung dahinter liegt im Paket
- [ ] Keine Rendite- oder Wertsteigerungsversprechen, keine Garantie
- [ ] Bewertung heißt Indikation oder Wertermittlung nach ImmoWertV, nie Verkehrswertgutachten

**Daten und Namen**
- [ ] Keine Datenquelle beim Namen (kein Bundesbank, BORIS, Zensus, ImmoScout, Sprengnetter, PriceHubble). Es heißt „amtliche Daten“, „aktueller Marktdurchschnitt“, „unabhängige Bewertungspartner“
- [ ] Keine echten Banknamen, es heißt „Bankpartner“ oder „deine Bank“
- [ ] Kein Wettbewerber beim Namen
- [ ] Echte Exposés: Anschrift, Makler, Gesichter, Kennzeichen unkenntlich (`Dateien/Social-Media/Mehr-als-ein-Score-2026-11-16/quelle/anschrift-verwischen.mjs`). Keine echten Namen aus Unterlagen
- [ ] Zuschauer-Exposé: Einwilligung des Einsenders liegt vor (Nachricht als Bildschirmfoto im Paket)

**Recht**
- [ ] Steuerthema: Satz „Allgemeine Information, keine Steuerberatung.“
- [ ] KI-Inhalt (Klonstimme, Higgsfield-Bild oder -Video mit echt wirkenden Menschen oder Orten): in der Plattform als KI-Inhalt markieren und im Text „Stimme KI-erzeugt“ oder „Bild KI-erzeugt“. Gilt seit 02.08.2026 (EU AI Act Art. 50)
- [ ] Keine erfundenen Kundenstimmen, keine gekauften Bewertungen
- [ ] Rabattcode nur, wenn Marcel ihn im Auftrag genannt hat
- [ ] Musik: keine im Paket, Marcel legt lizenzierte Musik in der Plattform darunter
- [ ] Forschungsprojekt nur so: „als Forschung und Entwicklung nach dem Forschungszulagengesetz bescheinigt“. Nie „staatlich geprüft“ oder „staatlich gefördert“

**Technik**
- [ ] Format stimmt: 1080×1920 (Reel, TikTok, Shorts), 1080×1350 (Feed), 1080×1080, 1200×627 (LinkedIn)
- [ ] Untertitel eingebrannt, wichtige Inhalte nicht in den unteren 20 % (dort liegen Bedienelemente)
- [ ] Hook in den ersten 2 Sekunden im Bild
- [ ] Link mit UTM-Zusatz: `?utm_source=<plattform>&utm_campaign=<thema>`

## Schritt 4 · FREIGABE.md schreiben

Eine Datei pro Tagespaket, oben im Paketordner. Marcel liest nur diese Datei.

```
# Freigabe · <Datum> · <Thema>

Prüfskript: 0 ROT, 2 GELB (begründet unten)
Kosten: keine | Higgsfield ca. X Credits (Freigabe nötig)

| Nr | Plattform | Format | Datei | Hook | Marcel |
|----|-----------|--------|-------|------|--------|
| 1 | Instagram Reel | 9:16, 42 s | 01-reel.mp4 | „…“ | [ ] ja  [ ] ändern: |
| 2 | LinkedIn | Text | 02-linkedin.md | „…“ | [ ] ja  [ ] ändern: |

GELB begründet:
- Z.12 „178.000 €“: Kaufpreis im Beispiel-Exposé

Braucht deine Entscheidung:
- …
```

Nichts wird veröffentlicht, bevor Marcel „ja“ gesetzt oder im Chat geantwortet
hat. Ein „ändern“ heißt: ändern, neu prüfen, neu vorlegen.
