---
name: messe-video
description: Messe-Videos für DealPilot bauen und aufnehmen — ein Drehbuch in frontend/js/messe-drehbuch.js schreiben oder ändern, auf Staging prüfen und mit ffmpeg als MP4 nach Dateien/Messe/Videos aufnehmen. Einsetzen, wenn Marcel ein neues Video, eine neue Szene oder eine Neuaufnahme will.
---

# Messe-Videos: Drehbuch bauen, prüfen, aufnehmen

Die Videos sind **keine Animationen**, sondern die echte App. Ein Drehbuch in
`frontend/js/messe-drehbuch.js` bedient die Oberfläche, ein Lichtkegel zeigt
auf die Stelle, unten läuft eine Untertitelzeile. Aufgenommen wird der
Bildschirm mit ffmpeg.

Start eines Drehbuchs: `https://app.staging.dealpilot.immo/?messe=<name>`
(`&schleife` für den Messebildschirm, `&tempo=1.6` für langsamer).
Vorhandene Drehbücher: `parkstrasse`, `quickcheck`, `quickcheck-tippen`,
`immometrica`, `sprache`. Liste mit Inhalt: `Dateien/Messe/Videos/Drehbuecher.txt`.

## Die Regeln (alle gemessen, alle teuer bezahlt)

1. **Jede Zahl im Untertitel wird live aus der App gelesen** (`qcText`,
   `qcScore`, Felder). Nie eine Zahl in den Text schreiben, die die App
   anders rechnen könnte. Fehlt sie, fällt der Satzteil weg.
2. **Kein kostenpflichtiger Abruf je Durchgang.** In der Messeschleife läuft
   ein Drehbuch über tausend Mal am Tag. Alles, was KI, Marktbericht,
   ImmoMetrica oder Sprache kostet, wird **einmal echt erzeugt** und als
   Mitschnitt abgespielt:
   - PDF-Import: `ObjectActions._voice.mitschnitt()` / `.wiedergabe(m)`
   - Marktbewertung: `#_mb_state` mit der echten Karte füllen, dann `_oabFeedTrigger()`
   - KI-Analyse: `_kiFrei = KI_ANALYSE`, die Brücke gibt sie über `DealPilotMesse.kiAntwort()` zurück
   - ImmoMetrica und Sprache: `_fetchAn(antwortFn)` ersetzt `fetch` nur im Lauf; `_mikroAn()` ersetzt das Mikrofon durch einen stummen Ton
   Gesperrt sind im Lauf außerdem die automatische KI-Bewertung und der Boarding-Pass (`laeuft()`).
3. **Der Mitschnitt muss zum Endstand passen.** Eine KI-Antwort gilt nur für genau die Eingaben, mit denen sie erzeugt wurde.
4. **Aufräumen ist Pflicht** (`aufraeumen` je Drehbuch, läuft auch bei Esc):
   - Fenster schließen, `fetch` und Mikrofon zurück
   - `qc_span_config` zurückschreiben, zweimal (der Quick-Check schreibt nach)
   - „Neuer Vorgang“ (`qcAufraeumen`), Reiter `s0`
5. **Objekte nicht verändern.** Ein Drehbuch ist ein Schreibweg, auch wenn es nur klickt. Vor jedem Lauf an einem echten Objekt die Zeile sichern (`/root/backups/…json`) und danach gegen die DB prüfen.
6. **Tempo für Zuschauer:** `TEMPO` (Vorgabe 1,4) streckt alle Wartezeiten ab 600 ms. Faustregel je Untertitel: mindestens 4 s plus 1 s je 15 Zeichen. Zahlenwechsel (Score) erst zeigen, wenn der Kegel steht.
7. **Die Pilot-Hilfe ist im Lauf ausgeblendet** (`html.dpm-laeuft #dp-pilot, #dp-tower`). Neue störende Einblendungen dort ergänzen.
8. **Kegel:** `zeige(ziel)` nimmt ein Element, einen Selektor oder eine Funktion (bei Elementen, die neu gerendert werden, immer eine Funktion). Ziele im Quick-Check-iframe gehen über `qcEl`/`qcGruppe`/`qcSel`; `rect()` rechnet den Rahmen dazu. Gescrollt wird sofort, nie `smooth` (kam nie an).
9. **Die Zeile ist eine Karte am Feld** (seit v2234): `s.zeile()` nach `zeige(ziel)`. Die Karte setzt sich selbst neben das Ziel, mit Linie und Pfeil. Ohne Ziel steht sie unten, `?zeile=unten` erzwingt den alten Untertitel. Kurze Texte wirken besser, die Karte ist höchstens 440 px breit. Prüft man die Überdeckung, dann gegen das ZIEL-Element, nicht gegen `#dpm-kegel`: Der Kegel zieht bis 0,6 s nach.
10. **Messen gegen `innerHeight`, nie gegen den Bildrahmen** (Zoom 90 %: 987 CSS-px Höhe, Screenshot 726).

## Ablauf für ein neues oder geändertes Drehbuch

1. Den echten Weg einmal von Hand gehen (Browser-Werkzeuge) und messen, welche Abrufe passieren (`Auth.apiCall` und `fetch` mitschreiben, nur Nicht-GET).
2. Die Mitschnitte einmal echt erzeugen und ins Drehbuch kopieren. Große Listen kürzen auf das, was die Oberfläche zeigt.
3. Das Drehbuch als Eintrag in `DREHBUECHER` schreiben: `titel`, `unterzeile`, `objekt` (Regex oder `null`), `szenen` (async-Funktionen), `abspann` (Karten, letzte meist `ABSPANN_LOGO`), `aufraeumen`.
4. Buster `messe-drehbuch.js` in `frontend/index.html` hochziehen, `node tools/buster-ebenen-pruefen.mjs`, `node tools/frontend-konstanten.mjs`, `.\tools\deploy-staging.ps1`.
5. **Prüflauf mit Protokoll:** Alle 300 ms Untertitel, Kegel-Rechteck und Schreibaufrufe mitschreiben. Abnahme:
   - Jede Zeile hat ihren Kegel im Bild.
   - Kein kostenpflichtiger Aufruf.
   - Danach sind `fetch` und das Mikrofon wieder echt.
   - Die Spannen-Vorgabe steht wieder auf dem alten Wert.
6. Stichbilder ansehen (Screenshot), nicht nur das Protokoll lesen.

## Studio: App im Rahmen, Kapitelband unten (seit v2235, die Vorgabe für neue Videos)

- `https://app.staging.dealpilot.immo/messe-studio.html?messe=<drehbuch>&intro=<id>&outro=<id>&qr=<url>`. Der Start kommt per Knopf, per Leertaste oder per JS mit `DPM_STUDIO.los()`. Fertig ist es, sobald `window.DPM_STUDIO_FERTIG` gesetzt ist (dann läuft das Outro).
- Jede `s.zeile(titel, text)` wird ein Kapitel: Nummer = Szene, der Titel steht groß, der Text darunter (höchstens 2 Zeilen, kurz halten). Die Intro- und Outro-Texte je Drehbuch stehen in `TEXTE` im Studio.
- Die App bekommt einen Viewport von 1.700 px (`&breite=`) und wird auf den Rahmen gestreckt. Die Pilot-Figur ist im Studio aus.
- **Rahmen-Rechnung:** `rect()`/`scroller()` rechnen nur bis zum eigenen Dokument hoch. Nie über `frameElement` bis ganz nach oben, sonst kommt die Lage des Studio-Rahmens doppelt dazu (v2235e).
- **Aufnahme:** ffmpeg starten, 1 s warten, `DPM_STUDIO.los()`, dann NUR in PowerShell auf das Ende von ffmpeg warten. Browser-Abfragen während der Aufnahme rissen die Verbindung ab, und das Video zeigte 7 s den Desktop. Danach die erste Sekunde abschneiden (`-ss 1.2`). Fenster: `tools/messe-fenster.ps1 -Was vor|zurueck` (sucht per Titel „Messe-Studio“ - der Studio-Tab muss der AKTIVE Tab seines Fensters sein; neuer Tab per tabs_create_mcp macht ihn aktiv, zeigt aber kurz das Hinweisfeld der Erweiterung), Aufnahme: `tools/messe-aufnahme.ps1 -Name <datei>.mp4 -Sekunden <s>`.
- Der Chrome-Hinweisbalken nimmt im Vollbild Platz ein, er liegt nicht über der Seite. Kein `oben=`, der Zuschnitt `crop=1920:1022:0:58` reicht.

## Baukasten: Intros, Info-Karten, Outros

`design/Vorschläge/messe-video/messe-effekte.js` stellt 30 Stücke bereit: 10 Intros, 10 Info-Karten und 10 Outros. Die Vorschau mit Textfeldern liegt unter https://claude.ai/artifact/BANFkS1maT5MhjhGGNooLe.

- **Aufruf:** `DealPilotMesseFX.spiele(buehne, art, id, texte)`. `art` ist `intro`, `karte` oder `outro`. Zurück kommt `{ebene, dauer, weg()}`. `DealPilotMesseFX.liste()` nennt je Stück die Felder mit Vorgabe.
- **Intros:** `runway` `cockpit` `boardingpass` `radar` `abflugtafel` `checkliste` `wolken` `blaupause` `flugroute` `kinetik`.
- **Karten:** `scorering` `urteil` `zahl` `spanne` `checkliste` `vergleich` `callout` `pilot` `band` `raster`. Karten sind durchsichtig auf das, was dahinter läuft, und fangen keine Klicks. `pos:{x,y,w}` legt die Lage fest (x und y in %, w in cqw). `ziel:{x,y,w,h}` (in %) legt einen pulsierenden Rahmen um eine Stelle der App.
- **Outros:** `startbahn` `amstand` `landung` `gate` `stempel` `kennzahlen` `splitflap` `visitenkarte` `horizont` `countdown`. Sechs davon tragen einen QR-Code im Feld `url`: amstand, gate, stempel, splitflap, visitenkarte, countdown. Der Code ist echt (qrcodejs 1.0.0 von cdnjs, Fehlerkorrektur M). Alle sechs wurden am 14.10.2026 mit jsQR zurückgelesen und trafen die URL genau.
- **Texte passt der Agent an.** Überschrieben wird nur, was nötig ist. **Zahlen auf Karten liest er live aus der App ab** (Regel 1), nie die Vorgabe stehen lassen.
- `buehne` braucht `position:relative` (oder `fixed; inset:0`). Gemessen wird in `cqw` der Bühne, deshalb sieht es in jeder Größe gleich aus.
- **Einen Frame prüfen:** spielen, dann `document.getAnimations()` pausieren und `currentTime = ms` setzen. Bildschirmfotos kommen verzögert, über eine Wartezeit getroffene Zeitpunkte stimmen nicht. Zahlen, die per JS hochzählen (Ring, Marktwert, Countdown, Abflugtafel), laufen in Echtzeit weiter.
- Für ein Drehbuch liegt die Datei noch nicht unter `frontend/`. Zum Einbau nach `frontend/js/` kopieren, im Drehbuch laden, Buster setzen und den Gold-Audit laufen lassen. Die Farben stehen schon als `var(--wl-…)`.

## Aufnahme mit ffmpeg

- ffmpeg: `C:\Users\ThinkPad\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe`
- **Vorher Marcel fragen:** Das Chrome-Fenster muss vorne liegen, und während der Aufnahme darf niemand Maus oder Tastatur benutzen.
- Fenster holen (PowerShell, user32): `ShowWindow(h, 9)`, `SetWindowPos(h, 0, 0, 0, 1920, 1040)`, `SetForegroundWindow(h)`, dann `SendKeys "{F11}"` für Vollbild. Das F11 des Browser-Werkzeugs erreicht das Fenster nicht.
- Mauszeiger mit `hover` an den Rand schieben.
- Aufnahme (im Hintergrund starten, dann das Drehbuch aufrufen):
  `ffmpeg -f gdigrab -framerate 30 -offset_x 0 -offset_y 0 -video_size 1920x1080 -draw_mouse 0 -t <s> -i desktop -vf "crop=1920:1022:0:58" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart <ziel>`
  Der Zuschnitt entfernt die Chrome-Leiste „Claude hat die Fehlerbehebung gestartet“, die sich nicht wegklicken lässt, ohne die Verbindung zu kappen.
- Dauer = gemessene Laufzeit × Tempo + 10 s.
- Ziel: `Dateien/Messe/Videos/<drehbuch>_<JJJJ-MM-TT>.mp4`. Danach Stichbilder mit `ffmpeg -ss <t> -frames:v 1` ziehen und ansehen.
- Am Ende: F11 zurück, Fenster minimieren (`ShowWindow(h, 6)`) und Marcels Zustand wiederherstellen.
- Videos liegen nicht im Repo (`Dateien/` ist untracked).

## Nach der Arbeit

Journal in `claude/projektanweisung-hauptapp.md` (Was · Commit · Nachweis · Rest), `Drehbuecher.txt` aktualisieren.
