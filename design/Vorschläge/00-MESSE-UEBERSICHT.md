# Messe-Pop-up für die Landing Page — vier Entwürfe

**Stand 07.10.2026.** Alles hier sind **Mockups**. Nichts ist ausgerollt,
nichts angefasst am Produktionscode.

Marcel: *„auf der Landing Page vielleicht noch irgendwie so ein Pop-up, was
sich öffnet dieses Jahr, dass wir auf der Ocation Festival Messe in Leipzig
sind … Also wir sollten nicht den Code nennen, weil ich möchte gerne, dass die
kommen."*

---

## Die Messedaten — belegt, nicht geraten

| | |
|---|---|
| **Messe** | immocation FESTIVAL 2026 |
| **Datum** | 31.10. – 01.11.2026 |
| **Ort** | Messe Leipzig |
| **Platz** | **Halle 3 · Stand 106** |

**Zwei unabhängige Quellen**, beide im Repo:

1. `Dateien/Messe/dealpilot-erstflug-karte-DRUCK-DINlang-212x100mm.pdf`
   (Druckdatei vom 22.09.2026) — Kopfzeile *„HALLE 3 · STAND 106"*,
   *„BOARDING 31.10.–01.11.26"*, *„ORT Leipziger Messe"*
2. `Dateien/Messe/Instagram Post - personalisierbar.png` (Veranstalter) —
   *„Du findest uns an Stand 106 Halle 3"*, *„31.10. & 01.11.2026"*

> **⚠ Ein Widerspruch, den du entscheiden musst.** Zwei ältere Stellen führen
> noch **Stand 23**:
> - `design/Messe/dealpilot-faltdisplay-151x225.html:454`
> - `claude/projektanweisung-hauptapp.md:1583`
> - `design/Vorschläge/messeplakat-2026-11.html:194` und `:246`
>
> Die Entwürfe hier tragen **Stand 106 · Halle 3**, weil das die jüngere und
> doppelt belegte Angabe ist — und weil der Veranstalter-Post ausdrücklich
> *„Du findest uns an …"* sagt. **Sobald du es bestätigst, gehören die drei
> Stellen oben nachgezogen.** An jeder Stelle im Markup steht ein Kommentar
> dazu.

---

## Die zwei Rabatte — das Wichtigste an der ganzen Sache

| | darf genannt werden? | Wirkung |
|---|---|---|
| **`dealpilot15` / `dealpilot10`** | **Ja** — sie stehen öffentlich auf dem Instagram-Post | Ticket fürs Festival · bringt Leute **hin** |
| **Der Code auf der Erstflug-Karte** | **Nein** | Vorteil am Stand · bringt Leute **zu uns** |

> **Ich hatte das selbst falsch.** Im ersten Wurf von Entwurf 01 stand
> `ERSTFLUG` als Zierwort auf dem Abriss — übernommen von der Druckkarte, wo
> es richtig ist. Auf der Website ist es falsch: **das IST der Rabattcode.**
> Marcel hat es sofort gesehen (*„dort jetzt bitte nichts mit ERSTFLUG drauf
> weil das ja unser Rabattcode ist"*). Behoben; dort steht jetzt
> **„CODE AM STAND"**. Aus demselben Grund heißt die Karte in allen Texten
> **„Bordkarte"** und nicht mehr „Erstflug-Karte" — der Code heißt wie sie.

---

## Die vier Entwürfe

Alle liegen als eigenständige HTML-Dateien hier im Ordner und laufen allein
(kein CDN, keine Bibliothek). Jede zeigt den Entwurf **vor einer Attrappe der
Landing Page**, damit du siehst, ob er dazu passt. Unten links sitzt ein
kleines schwarzes Steuerpult — das gehört **nicht** zum Entwurf, damit kannst
du die Animation nochmal abspielen.

### 01 · Der Abriss — `messe-popup-01-abriss.html` ⭐

Ein Boarding-Pass in der Bildmitte; den goldenen Abriss reißt man mit der Maus
weg (oder per Klick), und darunter kommt zum Vorschein, wo er wirklich liegt:
*Halle 3 · Stand 106*, dazu der Stempel **NUR AM STAND**.
**Für wen:** alle. Das ist die Variante, die die Botschaft nicht sagt, sondern
spielt — man bekommt den Abriss hier eben *nicht*.

> **Marcel hat diese gewählt:** *„das abriss 01 ist mega gut."*

### 02 · Der Gepäckanhänger — `messe-popup-02-gepaeckanhaenger.html`

Kein Fenster, das die Seite blockiert: ein Gepäckanhänger hängt an einer
Schnur unten rechts und schwingt leise. Wer ihn anklickt, klappt die Einladung
auf; wer ihn ignoriert, liest weiter.
**Für wen:** Besucher, die zum Lesen gekommen sind. Die höflichste Variante —
und die mit der geringsten Reichweite.

### 03 · Die Anzeigetafel — `messe-popup-03-anzeigetafel.html`

Eine Abflugtafel schiebt sich unter die Navigation, die Buchstaben klappen um
(Split-Flap): `ZIEL LEIPZIG · GATE HALLE 3 · PLATZ 106 · STATUS BOARDING`.
Klappt man sie ein, bleibt eine schmale Zeile stehen.
**Für wen:** alle, besonders am Schreibtisch. Sie verdeckt nichts und ist die
einzige Variante, die **dauerhaft** sichtbar bleiben kann.

### 04 · Zwei Gates — `messe-popup-04-zwei-gates.html`

Die ganze Geschichte in einem Fenster: **Gate 1 · Eintritt** nennt offen die
Ticket-Codes des Veranstalters, **Gate 2 · Unser Stand** zeigt den Abriss —
ohne Code. Der Riss funktioniert wie in 01.
**Für wen:** die, die noch gar kein Ticket haben. Das ist die einzige
Variante, die den **ganzen Weg** zeigt: erst rein, dann zu uns.

---

## Der echte Abriss — wie er gebaut ist

Marcel: *„könne wir einen echten abriss simulieren?"* — Ja. In **01** und
**04**, und zwar so:

1. **Zwei getrennte Elemente**, nicht eins. `.stamm` und `.abriss` bewegen
   sich verschieden — eine einzige Bewegung auf einem Element liest sich als
   *Schieben*, nicht als *Reißen*.
2. **Die Risskante ist unregelmäßig und komplementär.** Beide Teile tragen ein
   `clip-path`-Polygon mit derselben Zackenfolge; die Tiefen ergänzen sich auf
   9 px (Stamm `calc(100% - D px)`, Abriss `(9 − D) px` bei `margin-left:-9px`).
   Vorher greifen sie zahnlückengenau ineinander, nachher hat jedes Teil eine
   echte Risskante. Die X-Tiefen stehen in px, die Y-Stufen in Prozent —
   so bleibt die Zacken-Amplitude gleich, egal wie breit die Karte ist.
3. **Der Riss sitzt auf der Lochung.** Die Perforationsreihe liegt in
   derselben 9-px-Zone und verschwindet im Moment des Risses.
4. **Der Ton stimmt:** erst ein harter Ruck (110 ms, linear) — das Trennen —,
   dann fällt der Abriss *beschleunigt* weg (`cubic-bezier(.5,.02,.9,.4)`).
   Nichts federt zurück. Reißen ruckt, es schwingt nicht.
5. **Auslöser:** ziehen (Maus oder Finger) **oder** klicken. Unter 54 px Weg
   geht der Abriss zurück an seinen Platz. Am Schreibtisch reißt man nach
   rechts, auf dem Handy nach unten — der Hinweistext wechselt mit.
6. **`prefers-reduced-motion`**: wer Bewegung abbestellt hat, bekommt den
   Endzustand ohne jede Animation.

---

## Das Vertrauensband unten

Wörtlich aus `frontend/landing/index.html` (`.tband`, ab Z. 160), Gestaltung
übernommen, nicht der Code. Im Pop-up kleiner und leiser — dort ist es
Fußzeile, nicht Hauptsache. Das Siegel liegt als `bsfz-siegel-2026.svg` neben
den Entwürfen, damit jede Datei allein läuft.

**Auf 390 px tragen die Entwürfe nur drei der fünf Einträge:**

| bleibt | fällt weg |
|---|---|
| Server in Deutschland | Aus der Gutachtenpraxis |
| Ihre Daten bleiben Ihre | Made in Germany |
| FuE-Siegel 2026 | |

**Warum genau diese drei:** Sie sind dieselben, die auch auf der schon
gebauten Boarding-Pass-Leiste stehen
(`Dateien/Messe/dealpilot-leiste-boardingpass.png`: *SERVER · DATENSCHUTZ ·
FORSCHUNG*). Die Leiste ist die engere, am Stand erprobte Fassung — wenn auf
dem Handy etwas weichen muss, dann das, was dort auch schon weichen musste.
Entwurf 03 und 04 führen die Dreier-Form auf **allen** Breiten.

---

## Für die Landing Page: `messe-popup.js`

Entwurf 01 ist als **einbaufertiges Modul** abgelegt — `messe-popup.js` in
diesem Ordner. Zwei Handgriffe, dann ist es live:

1. Datei nach `frontend/landing/messe-popup.js` kopieren
2. In `frontend/landing/index.html` direkt nach der Zeile
   `<script src="erstflug-popup.js?v=v1595d"></script>` einfügen:
   `<script src="messe-popup.js?v=v1944"></script>`

Mehr nicht — das Modul bringt Stil und Markup selbst mit und nutzt das
`assets/bsfz-siegel-2026.svg`, das dort schon liegt.

> **Ich habe es nicht selbst eingebaut**, obwohl Marcel darum gebeten hat:
> der Schreibzugriff auf `frontend/` ist für diesen Lauf gesperrt. Die Arbeit
> ist aber getan — es fehlt nur der Kopierbefehl.

**Was das Modul von sich aus richtig macht:**

- **„In den Kalender" trägt wirklich ein.** Ein Klick erzeugt eine
  `.ics`-Datei (Ganztags-Termin über beide Messetage, Ort *Leipziger Messe,
  Halle 3, Stand 106*, Erinnerung einen Tag vorher) und lädt sie herunter.
  Jedes Kalenderprogramm versteht sie. Für alte iOS-Fassungen ohne
  Blob-Download gibt es einen zweiten Weg.
- **Es schaltet sich selbst ab.** Nach dem 01.11.2026 geht es nicht mehr auf.
  Eine Messeeinladung, die im Dezember noch erscheint, ist schlimmer als keine
  — und im Dezember denkt niemand mehr daran, sie abzuschalten.
- **Es weicht dem Flyer-Fenster.** Wer über `/erstflug` hereinkommt, bekommt
  `erstflug-popup.js`. Zwei Fenster übereinander wären beides kaputt.
- **Einmal je Sitzung**, dann Ruhe.

---

## Was gemessen wurde — und was dabei herauskam

Jeder Entwurf wurde bei **390 px** und **1180 px** im Browser angesehen, nicht
nur gebaut. Gemessen wurde im gleich-Origin-iframe; die Fenstergröße allein
wirkt nicht. Drei Fehler kamen dabei heraus, die am Code nicht zu sehen waren:

| Befund | Ursache | behoben |
|---|---|---|
| Die Lochung saß **5 px neben** der Risskante (gemessen: Risszone 1114–1123, Lochung 1109–1119) | `right:201px` war geschätzt. Richtig ist **196** — gerechnet aus 206 px Abriss und 10 px Lochbreite | ✓ |
| Auf 390 px stand *„Halle 3 · Stand 106"* **schon vor dem Riss** da — die Pointe war verraten | der Abriss lag im normalen Fluss *über* dem Text statt *darauf*. Jetzt liegt er auch auf dem Handy absolut darüber | ✓ |
| Entwurf 03 zeigte auf 390 px die Buchstaben **senkrecht** in einer 40-px-Spalte | nicht die Breite: `flex:1` bedeutet `flex:1 1 0%`, und die `flex-basis:0%` schlägt `width:100%` — die Zeile brach nie um. `flex:1 1 100%` erzwingt es | ✓ |

Alle vier Entwürfe laufen auf 390 px **ohne waagerechten Überlauf**
(`scrollWidth == innerWidth`).

---

## Offene Punkte — das brauchst du zu entscheiden

1. **Stand 106 oder Stand 23?** Siehe oben. Drei Stellen im Repo müssen danach
   nachgezogen werden. **Das ist der einzige harte offene Punkt.**
2. **Darf `−15 %` auf der offenen Seite stehen?** Auf der Druckkarte steht es.
   Auf der Website war ein Dauerrabatt bisher bewusst **nicht** beworben
   (`promo-erstflug.js: ANZEIGE_AKTIV = false`, Entscheidung vom 07.09.2026).
   Mein Argument dafür: hier ist es ein Messeangebot **mit Enddatum**, kein
   Dauerbanner. Falls du anders entscheidest — im Modul steht dafür eine
   einzige Zeile (`ZEIGE_PROZENT = false`); dann steht dort *„Dein Vorteil"*
   statt einer Zahl, und sonst ändert sich nichts.
3. **Sollen die Ticket-Codes mit aufs Pop-up?** Entwurf 04 zeigt, wie es
   aussähe. Entwurf 01 (deine Wahl) hat sie bewusst nicht — er bleibt dadurch
   ruhiger, verschenkt aber die Leute, die noch kein Ticket haben.
4. **Schriften.** Die Mockups laden bewusst **nichts** von außen, damit jede
   Datei allein läuft. Wenn du Space Grotesk / Inter / JetBrains Mono nicht
   lokal installiert hast, siehst du sie in der Systemschrift — auf der echten
   Landing Page stimmt die Typografie, dort kommen die Schriften von Google
   Fonts.

---

## Dazu passend

- **`messe-video-ideen.md`** — fünf Ideen für kurze Werbevideos auf LinkedIn
  und Instagram, wie von dir angefragt. Noch nichts produziert.
- `design/Messe/dealpilot-faltdisplay-151x225.html` und
  `dealpilot-zipperwall-2x2.5m_6.html` — die Displays, die am Stand stehen.
  Die Entwürfe hier sind bewusst in derselben Bildsprache gehalten.
