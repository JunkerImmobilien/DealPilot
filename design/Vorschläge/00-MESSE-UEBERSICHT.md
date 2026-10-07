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

> **✓ Erledigt — Marcel hat Stand 106 · Halle 3 bestätigt (07.10.2026).**
> Alle Entwürfe und Werbemittel tragen diese Angabe ohne Vorbehalt.
>
> Drei ältere Stellen führten noch **Stand 23** und werden nachgezogen:
> - `design/Messe/dealpilot-faltdisplay-151x225.html:454`
> - `claude/projektanweisung-hauptapp.md:1583`
> - `design/Vorschläge/messeplakat-2026-11.html:194` und `:246`

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

1. ~~**Stand 106 oder Stand 23?**~~ **Erledigt am 07.10.2026:** Stand 106 ·
   Halle 3 ist bestätigt. Drei Stellen im Repo werden nachgezogen.
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

---

# Werbemittel für Instagram und LinkedIn — vier laufende Animationen

Marcel: *„und wo sind die video ideen? die sollen umgesetzt werden das ich die
direkt sehen kann und auch die werbung für Insta und Linked In aus dem
Abrissticket"*

**Alle vier laufen im Browser.** Datei öffnen, zusehen. Unten sitzt eine
schwarze Leiste mit Knöpfen (**VON VORN**, **PAUSE**) — die gehört nicht zum
Beitrag, damit kannst du die Bewegung beliebig oft ansehen.

**So wird ein Video daraus:** Fenster aufziehen, Bildschirmaufnahme starten,
eine Schleife mitschneiden, zuschneiden, fertig. Die Flächen sind in echten
Zielpixeln gebaut (1080 × 1920 usw.) und hier nur zum Ansehen kleingerechnet —
auf dem Bildschirm aufgenommen stimmt das Format.

| Datei | Format | wohin | Länge |
|---|---|---|---|
| `werbung-01-riss-reel.html` | **1080 × 1920** (9:16) | Instagram Reel / Story | 7 s Schleife |
| `werbung-02-abflugtafel-linkedin.html` | **1920 × 1080** (16:9) | LinkedIn-Beitrag | 9 s Schleife |
| `werbung-03-bauchgefuehl-reel.html` | **1080 × 1920** (9:16) | Instagram Reel / Story | 11 s Schleife |
| `werbung-04-countdown-feed.html` | **1080 × 1080** (1:1) | Feed · beide Netzwerke | 5 Stufen |

### 01 · Der Riss — aus dem Abrissticket, das dir gefallen hat

Die Bordkarte groß im Bild, der goldene Abriss wird weggerissen, darunter
steht *Halle 3 · Stand 106* und der Stempel **NUR AM STAND** knallt rein.
**Für wen:** alle. Das ist der Beitrag, der die Botschaft nicht sagt, sondern
spielt — den Abriss bekommt man hier eben nicht. **Wenn nur einer gebaut wird,
dann dieser.**

### 02 · Die Abflugtafel — der sachliche für LinkedIn

Eine Fallblattanzeige würfelt sich Zeile für Zeile durch: `ZIEL LEIPZIG ·
DATUM 31.10-01.11 · GATE HALLE 3 · PLATZ STAND 106 · STATUS BOARDING` (das
letzte in Grün, als Pointe). **Für wen:** LinkedIn, wo nüchtern gelesen wird.
Quer, weil eine Tafel breit ist — hochkant wäre sie eine Liste, keine Tafel.
Mit anderem Status (`CHECK-IN OFFEN`, `LETZTER TAG`) wird eine Serie daraus.

### 03 · Bauchgefühl → Daten — die Marken-Variante

`GUT / BAUCHGEFÜHL` links, ein Flugzeug zieht hinüber, `DAT / DATEN &
KLARHEIT` rastet ein, darunter schreibt sich `RÜCKFLUG: ENTFÄLLT`. Dann zieht
die Runway-Kurve hoch und der Claim kommt. **Für wen:** die, die DealPilot noch
nicht kennen. Sie verkauft die Haltung und nimmt die Messe als Anlass mit —
**die einzige der vier, die nach dem Festival weiterlebt**: letzte Einstellung
austauschen, fertig.

### 04 · Der Countdown — eine Vorlage, fünf Beiträge

`NOCH 14 TAGE → 7 → 3 → MORGEN → HEUTE`, immer dasselbe Bild, nur die Zahl
klappt um. **Für wen:** den Vorlauf. Nach dem ersten Mal kostet jeder weitere
Beitrag keine Arbeit mehr. **Ab Stufe 3 trägt jede Stufe einen eigenen Satz** —
fünf fast gleiche Beiträge wären sonst Tapete. Für die Aufnahme eines
einzelnen: *SCHLEIFE AUS*, mit *NÄCHSTE STUFE* einstellen, *KLAPPEN* drücken.

### Was die vier richtig machen

- **Kein Vorspann.** In allen vieren beginnt die Bewegung in der ersten
  Sekunde — kein Logo, das erst wegblendet. Wer scrollt, entscheidet vorher.
- **Ohne Ton verständlich.** Beide Netzwerke spielen stumm vor. Nichts hier
  braucht Erklärung aus dem Lautsprecher; das Klappern der Tafel ist ein
  **Bild**, kein Geräusch.
- **Echte Schleifen.** Jede endet so, dass der Anfang wieder passt — wer
  zweimal hinsieht, starrt nicht auf ein Standbild.
- **`prefers-reduced-motion`** wird überall respektiert: wer Bewegung
  abbestellt hat, sieht gleich das Ergebnis.

### Die Ticket-Codes

Nur in **04, Stufe 2** (*„Noch kein Ticket? Mit dealpilot15 kommst du günstiger
rein."*). In 01, 02 und 03 bewusst nicht: diese drei sollen an den **Stand**
führen, nicht in den Ticketshop. Der Code auf der Bordkarte kommt in keinem
der vier vor.

### Gemessen, nicht angenommen

| Befund | Ursache | behoben |
|---|---|---|
| In 01 lag der Kopf **96 px** von oben, das Vertrauensband **92 px** von unten | Genau dort legt Instagram bei Reels Profilzeile, Beschriftung und Knöpfe darüber — beides wäre **verdeckt** gewesen. Jetzt bleiben oben 150 px und unten 260 px frei | ✓ |
| In 03 war die Runway-Kurve so gut wie **unsichtbar** | Sie lag in einem Kasten am unteren Rand und hatte auf Obsidian zu wenig Deckkraft. Zieht jetzt über die ganze Fläche, hinter der Schrift hindurch | ✓ |
| In 03 klaffte zwischen Marke und Mitte **ein halber Meter Schwarz** | Die Mitte saß auf 50 %. Jetzt 41 %, und die Wörter sind von 122 auf 146 px gewachsen — auf einem Handy ist 122 px kleiner, als es am Schreibtisch aussieht | ✓ |
| In 02 las sich die Datumszeile `31.10+01.11` technisch | Das Pluszeichen. Jetzt `31.10-01.11`, der Bindestrich gehört dafür in den Zeichensatz | ✓ |

Formate nachgemessen: 01/03 = 0,562 (9:16), 02 = 1,778 (16:9), 04 = 1,000 (1:1).
Keine Überläufe, keine Überlappungen zwischen Kopf, Mitte und Fuß.

### Eine Idee habe ich NICHT gebaut

In `messe-video-ideen.md` steht als Idee 4 **„Acht Sekunden Cockpit"** — eine
Bildschirmaufnahme aus der echten App: Objekt rein, Deal Score springt hoch,
Kennzahlen laufen ein. **Die habe ich bewusst weggelassen.**

Ich hätte sie nur nachbauen können, mit erfundenen Zahlen. Ein Werbevideo, das
einen Deal Score und Kennzahlen zeigt, die so nie gerechnet wurden, ist eine
Produktbehauptung — und das ist genau das, was wir sonst nirgends tun. **Diese
Idee braucht eine echte Aufnahme aus der laufenden App**, mit einem sauberen
Demo-Objekt und ohne Kundendaten im Bild. Das kann ich nicht herstellen, du
schon. Vier, die tragen, sind besser als fünf, von denen eine schwindelt.

---

## Dazu passend

- **`messe-video-ideen.md`** — die Gedanken hinter den fünf Ideen, inklusive
  der nicht gebauten, und wann welcher Beitrag gepostet werden sollte.
- `design/Messe/dealpilot-faltdisplay-151x225.html` und
  `dealpilot-zipperwall-2x2.5m_6.html` — die Displays, die am Stand stehen.
  Die Entwürfe hier sind bewusst in derselben Bildsprache gehalten.
