# Tablet-Fassung feinziehen

**Stand:** 2026-08-10 · Vorschlag zu Backlog-Punkt „Tablet-Fassung
feinziehen" · **gemessen bei 820 px im gleich-Origin-iframe**, angemeldet,
Partner-Konto, Objekt geladen

---

## Kurzfassung

**Das Tablet bekommt heute die Handy-Fassung, nur breiter.** Das ist der
eigentliche Befund — nicht einzelne Abstände. Gemessen:

| Was | bei 820 × 1180 |
|---|---|
| Sidebar | `position:fixed`, `left:-380px`, `translateX(-380px)` — **off-canvas**, wie auf dem Handy |
| `.main-col` | **820 px**, also die volle Breite für eine Spalte |
| Kopfleiste `header.hdr` | **348 px** hoch |
| davon `hdr-v61-row2` (der Score) | **251 px** |
| Tab-Leiste | 56 px |
| **Bleibt für den Inhalt** | **776 px von 1180 — 66 %** |
| Querlauf | 820/820, **keiner** |

**Die Kopfleiste frisst 29,5 % des Schirms**, bevor eine einzige Zahl des
Objekts zu sehen ist.

---

## 1 · Zwei Angaben des Backlog-Punktes sind überholt

Der Punkt trug einen gemessenen Befund von damals (W43). Beide Teile
stimmen heute nicht mehr — die Arbeit aus v1112 bis v1117 hat sie
überholt:

| Punkt sagt | gemessen 2026-08-10 |
|---|---|
| Kopfleiste **589 px** | **348 px** — 41 % weniger |
| `#hdr-badges` **492 px** | **251 px** |
| „die fünf KPI-Pillen brechen zu je zwei um" | **falsch.** `.scores` ist ein `grid` mit `flex-wrap:nowrap`; die fünf Pillen stehen **nebeneinander**, je 149 × 103 px, in **einer** Reihe |

Der Umbruch ist also weg. Was bleibt, ist etwas anderes: **`.sc-main`
belegt allein 771 × 121 px**, und darunter kommen noch einmal 103 px
Pillen. Das ist kein Umbruchfehler, das ist eine Größenfrage.

---

## 2 · Was auf einem Tablet anders ist als auf einem Handy

Drei Unterschiede, die die heutige Fassung nicht ausnutzt:

1. **Breite ist da, Höhe nicht.** 820 × 1180 im Hochformat, 1180 × 820 im
   Querformat. Eine Spalte über 820 px macht Formularzeilen unnötig lang;
   die Höhe ist dagegen knapp, sobald die Kopfleiste 348 px nimmt.
2. **Der Zeiger ist grob, aber die Hand ruht.** 44-px-Trefferflächen
   bleiben Pflicht, aber ein Blatt-von-unten ist unnötig — es gibt Platz
   für ein Popover neben dem Auslöser.
3. **Der Drawer kostet einen Griff.** Bei 820 px passen Sidebar (380) und
   Inhalt (440) nebeneinander — knapp. Im Querformat (1180) locker.

---

## 3 · Vier Stellschrauben, einzeln entscheidbar

### A · Die Sidebar andocken statt ausfahren

**Vorschlag: ab 900 px angedockt, darunter Drawer.**

820 px im Hochformat ist die Grenze: 380 + 440 geht, ist aber eng für ein
Formular. Im Querformat (1180) ist es selbstverständlich.

- **Dafür:** kein Griff mehr für den Objektwechsel; das ist die häufigste
  Bewegung überhaupt.
- **Dagegen:** die Schwelle 900 ist eine neue Zahl in einer App mit
  **25 Breakpoints**. Sie sollte auf einer bestehenden liegen.
- **Zu klären:** welche der 25 Schwellen kommt 900 am nächsten? Das gehört
  gezählt, bevor eine 26. entsteht.

### B · Den Score flacher legen — **aber nicht wegnehmen**

Marcels Vorgabe steht im Punkt: **der Score bleibt auf dem Tablet.** Es
geht nur um die 251 px.

Gemessen sind es zwei Reihen: `.sc-main` (771 × 121) und fünf `.sc-pill`
(je 149 × 103). Drei Wege, ohne etwas zu entfernen:

| | Höhe danach | wie |
|---|---|---|
| **B1** Pillen neben den Hauptblock | **213 px** | `.sc-main` in Spalte 1 über zwei Reihen, fünf Pillen rechts daneben (3 + 2) |
| **B2** Pillen niedriger | ~190 px | Pillen von 103 auf ~60 px; Label und Wert nebeneinander statt untereinander |
| **B1 + B2** zusammen | **~121 px** | beides — die Pillen passen dann in zwei Reihen neben den Hauptblock |
| **B3** Zweite Reihe einklappbar | 121 px zu, 251 px auf | Pillen hinter einem Aufklapper, Zustand gemerkt |

> **Nachgerechnet, und dabei den eigenen ersten Entwurf widerlegt.** Ich
> hatte für **B1** allein „~121 px" geschätzt. Falsch: der heutige Aufbau
> ist `121 + 7 + 103 = 231`. Stehen die fünf Pillen (je **103 px**) in zwei
> Reihen neben dem Hauptblock, ist die Reihe `2 × 103 + 7 = 213` hoch —
> **höher als die 121 px des Hauptblocks**. B1 allein spart also **18 px**,
> nicht 130. Der Gewinn kommt erst, wenn die Pille selbst flacher wird.
> **Die Höhe des Blocks bestimmt die Pille, nicht der Hauptblock.**

**Empfehlung: B1 + B2 zusammen** — und genau deshalb ist es **eine**
Entscheidung, nicht zwei. B3 versteckt Information hinter einem Klick, den
es auf dem Desktop nicht gibt; das ist eine zweite Bedienlogik für dieselbe
Ansicht.

**Was B2 an der Pille ändert**, damit die Entscheidung nicht blind fällt:
Label und Wert stehen heute untereinander. Nebeneinander werden aus 103 px
etwa 57 — bei 149 px Pillenbreite ist das eng, aber die Pillen wachsen in
dieser Anordnung auf rund 200 px, weil sie nur noch drei Spalten teilen
statt fünf. **Das gehört als Bild gezeigt, bevor es gebaut wird** — es ist
die auffälligste Fläche der App.

### C · Zweispaltige Formulare

Bei 820 px Inhaltsbreite (bzw. 440 mit angedockter Sidebar) ist eine
Formularzeile über die volle Breite zu lang zum Lesen und zu kurz für zwei
Spalten — **je nachdem, wie A entschieden wird.**

**Deshalb hängt C an A** und ist keine eigenständige Entscheidung:

- Sidebar angedockt → 440 px Inhalt → **eine** Spalte, aber mit Maßhalten
  (`max-width` auf der Zeile).
- Sidebar als Drawer → 820 px Inhalt → **zwei** Spalten sinnvoll.

### D · Aktionen als Popover statt Blatt von unten

Das Blatt (`bsheet`) ist die Handy-Lösung. Auf dem Tablet verdeckt es
zwei Drittel des Schirms für sechs Einträge.

- **Vorschlag:** dieselben Einträge, aber als Popover am Auslöser, ab
  derselben Schwelle wie A.
- **Achtung:** die Einträge sind heute `.bsheet-tile` mit eigener
  Gestaltung. Ein Popover darf sie **nicht** neu bauen — sonst gibt es
  zwei Listen, die auseinanderlaufen (die Lehre aus v1096b und v1112b).
  Derselbe Baum, andere Hülle.

---

## 4 · Die Admin-Oberfläche

Der Punkt verlangt sie ausdrücklich mit. **Nicht gemessen** — sie hängt an
einem Admin-Konto, das dieser Prüflauf nicht hatte. Ehrlich offen.

**Was dort zu erwarten ist:** dasselbe Muster wie beim Partner-Portal in
`v1112b` — eine Oberfläche, die nie für schmale Schirme gebaut wurde.
Dort war es messbar an **null Media-Queries in der ganzen Datei**. Das ist
die erste Zahl, die für die Admin-Oberfläche zu erheben ist, bevor
irgendetwas entworfen wird.

---

## 5 · Was zuerst

| # | Schritt | hängt ab von |
|---|---|---|
| 1 | Die 25 vorhandenen Breakpoints zählen und die passende Schwelle wählen | — |
| 2 | **A** entscheiden (Sidebar angedockt ab welcher Breite) | 1 |
| 3 | **B1 + B2** entscheiden und bauen — der Score kostet die meiste Höhe und ist unabhängig von A | Bild der flacheren Pille |
| 4 | **C** entscheiden | 2 |
| 5 | **D** bauen, mit demselben Baum wie das Blatt | 2 |
| 6 | Admin-Oberfläche messen (Media-Queries zählen), dann erst entwerfen | — |

**Schritt 3 ist der wirksamste** — er holt rund **110 px** zurück, also ein
Siebtel der heute sichtbaren Inhaltshöhe, und hängt an keiner der anderen
Entscheidungen.

**Er ist trotzdem nicht ohne Rückfrage baubar.** Die Score-Kachel ist die
auffälligste Fläche der App, und B2 ändert die Pille selbst. „Optik und
Produktentscheidungen ohne klare Vorgabe → Demo bauen und zeigen" — das
gilt hier. Was fehlt, ist ein Bild der flacheren Pille, kein Messwert.

---

## 6 · Was zu entscheiden ist

| # | Frage | Vorschlag |
|---|---|---|
| **A** | Ab welcher Breite dockt die Sidebar an? | Auf einer **bestehenden** Schwelle nahe 900 px — welche, sagt erst das Zählen. |
| **B** | Wie wird der Score flacher? | **B1 + B2 zusammen** — Pillen neben den Hauptblock **und** flacher. Nimmt nichts weg, spart ~110 px. B1 allein bringt nur 18 px. |
| **C** | Zweispaltige Formulare? | Folgt aus A, keine eigene Entscheidung. |
| **D** | Popover statt Blatt? | Ja, aber **derselbe Baum** wie das Blatt. |

**Nichts davon wird gebaut, bevor A und B entschieden sind.** B ist
unabhängig von A und kann zuerst kommen — es braucht aber ein Bild der
flacheren Pille, weil es die auffälligste Fläche der App betrifft.
