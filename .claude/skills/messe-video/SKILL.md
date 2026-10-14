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
9. **Messen gegen `innerHeight`, nie gegen den Bildrahmen** (Zoom 90 %: 987 CSS-px Höhe, Screenshot 726).

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
