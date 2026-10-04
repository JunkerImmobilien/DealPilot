# Zeitsteuerung für den Ernte-Wächter — Vorschlag, nicht eingerichtet

**Stand 02.10.2026 · gehört zu `marktbericht/backend/tools/ernte-waechter.mjs` (Backlog E5)**

Hier steht **kein** crontab-Eintrag und **kein** systemd-Timer zum Kopieren.
Eine Zeitsteuerung einzurichten ist ein Eingriff auf dem Server, und
Server-Eingriffe gehören vorgelegt, nicht nebenbei getan. Dieses Papier sagt
nur, **wann** der Wächter sinnvollerweise laufen würde und **was** er dabei
melden soll.

---

## Warum ein Zeitplan überhaupt — und nicht einfach „bei Bedarf"

Gutachterausschüsse veröffentlichen jährlich, aber nicht gleichzeitig. Der
Jahrgang eines Ausschusses erscheint irgendwann zwischen Februar und
November, ohne Ankündigung und ohne dass sich an der URL etwas ändert, über
die man es merken könnte. Gemessen am Register (02.10.2026):

| Jüngster erfasster Jahrgang | Ausschüsse / Quellgruppen |
|---|---:|
| 2026 | 55 |
| 2025 | 35 |
| 2024 | 74 |
| 2022 | 2 |
| 2019 | 1 |
| 2018 | 1 |

Wer „bei Bedarf" nachsieht, sieht bei 168 Gruppen nie nach. Deshalb braucht
es einen Takt — und genau deshalb **keinen** Automaten, der dabei Werte
übernimmt: der Takt soll die Recherche ersparen, nicht das Nachrechnen.

---

## Vorschlag: zwei Takte, ein Werkzeug

### A · Der Jahrestakt — die eigentliche Nachernte

**Einmal im Monat, von Februar bis Juni, am ersten Werktag, morgens.**

In diesem Fenster erscheinen die meisten Grundstücksmarktberichte zum
Stichtag 01.01. Fünf Läufe pro Jahr reichen, um jeden neuen Jahrgang
innerhalb eines Monats zu bemerken.

Aufruf:

    node tools/ernte-waechter.mjs --md

Ergebnis ist eine Markdown-Tabelle, die direkt unter
„MARKTBERICHT / ERNTE — Workstream (D)" in `BACKLOG.md` passt.

### B · Der Totfund-Takt — die Quellen, auf die der Bericht sich beruft

**Einmal im Quartal, oder vor jedem Prod-Rollout, der den Marktbericht
anfasst.**

Das ist der dringlichere der beiden Takte, und zwar aus einem anderen Grund:
eine veraltete Zahl trägt immerhin ihren richtigen Jahrgang. Ein **Link, der
ins Leere zeigt**, zerstört dagegen den Quellennachweis, den der Bericht
ausdruckt — und das ist bei `dl-de/by-2-0` eine Lizenzpflicht, keine Zierde.

Gemessen am 02.10.2026: **9 von 105 Quellen** sind defekt — ein Totfund
(HTTP 200 mit `text/html`, wo ein PDF stehen soll), acht nicht erreichbar
(404, 403, 503, ein ungültiges Zertifikat).

Aufruf:

    node tools/ernte-waechter.mjs --alle

Der Rückgabewert ist hier der Punkt: **1 bei defekter Quelle, 0 sonst.** Ein
fälliger Jahrgang allein färbt den Lauf absichtlich **nicht** rot — er ist
der Normalfall jedes Frühjahrs, und ein Wächter, der immer rot ist, wird
genauso wenig gelesen wie einer, der immer grün ist.

---

## Wo der Lauf hingehört

**Im Container, nicht auf dem Host.** Der Wächter liest optional
`mb.param_lauf` und `mb.etl_runs` über `src/lib/db.js`; auf dem Host fehlt
`pg`, und Prod hat kein Node auf dem Host. Gemessen im Container auf Staging
läuft er durch:

    docker exec dealpilot-mb-backend node /app/tools/ernte-waechter.mjs --md --db

Für den HTTP-Teil braucht der Container ausgehenden Zugang auf Port 443.
Das ist zu prüfen, bevor ein Zeitplan daraus wird — sonst meldet der Wächter
105 unerreichbare Quellen und beschreibt damit seine eigene Netzsperre, nicht
den Zustand der Ämter. **Ein Werkzeug, das sich selbst misst, ist der teure
Fehler.** Der Gegentest ist ein einziger Lauf von Hand, bevor irgendein Timer
entsteht.

---

## Wie die Meldung ankommen soll

Ein Lauf, dessen Ausgabe im Server-Log stirbt, ist kein Wächter. Drei Wege,
in dieser Reihenfolge der Mühe:

1. **Ausgabe in eine Datei im Repo-Ordner**, die Marcel öffnen kann —
   billigster Weg, braucht keine Zugangsdaten.
2. **Telegram** — der Bot existiert laut `Dateien/Anleitung Google Drive und
   Telegram-Bot …` schon. Eine Zeile bei Rückgabewert 1, sonst Schweigen.
3. **Admin-Ansicht** — die Tabelle `mb.param_probe` ist dafür schon gebaut
   („damit sie im Admin sichtbar wird statt nur im Terminal zu stehen",
   Migration 013). Der Wächter schreibt heute bewusst nichts; wenn er einmal
   dorthin schreiben soll, ist das ein eigener Auftrag mit eigener Abnahme.

---

## Was ausdrücklich NICHT vorgeschlagen wird

- **Kein automatischer Download.** Ein PDF zu holen ist das Billigste am
  ganzen Vorgang und erspart nichts.
- **Kein automatisches Auslesen von Werten.** Der Prüfmaßstab ist das
  Anwendungsbeispiel des amtlichen Dokuments. Ein Automat hat es nicht
  nachgerechnet und würde eine Herkunft behaupten, die er nicht geprüft hat.
- **Kein Schreiben ins Register und keines in die Datenbank.** Beides würde
  eine Prüfung vortäuschen.
- **Kein kürzerer Takt als monatlich.** 105 Quellen täglich anzufragen ist
  gegenüber den Ämtern unhöflich und bringt keine zusätzliche Erkenntnis:
  ein Jahresbericht erscheint nicht zweimal in einer Woche.
