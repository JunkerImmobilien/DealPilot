# Fallen — teuer bezahlt, damit sie nicht zweimal kosten

Diese Datei sammelt Befunde, die **nicht** aus dem Code ablesbar sind: Fallen
in den Werkzeugen, im Messen und im Ausrollen. Jede hat mindestens einen
halben Bauabschnitt gekostet.

`CLAUDE.md` sagt, **wie gearbeitet wird**. `BACKLOG.md` sagt, **was ansteht**.
Diese Datei sagt, **wo schon jemand hingefallen ist**.

---

## 1 · Das Deploy-Skript lügt in beide Richtungen

`tools/deploy-staging.ps1` hat drei Defekte, alle offen. Die Datei liegt per
`.gitignore` **nur lokal** unter `E:\DealPilot\repo\tools\` — sie taucht in
keinem Repo-Stand auf.

- **BOM vor `set -e`.** Der Server meldet
  `bash: line 1: ﻿set: command not found`, das `set -e` wird verschluckt. Ohne
  Fehlerabbruch gibt ein gescheiterter Deploy trotzdem `AUSGEROLLT: <sha>`
  aus. **Fehlschlag sieht aus wie Erfolg.**
- **Abbruch an gits stderr.** `$ErrorActionPreference = "Stop"` plus PowerShell
  5.1: `git push` schreibt seinen Fortschritt nach stderr, daraus wird ein
  `NativeCommandError`, das Skript bricht in Zeile 68 ab — **obwohl der Push
  lief**. Schritt 6, der `git pull` auf dem Server, läuft dann nie. GitHub hat
  den Stand, der Server nicht. **Erfolg sieht aus wie Fehlschlag.**
- **Abbruch an fremden Serveränderungen.** Das Skript bricht ab, sobald auf dem
  Server eine verfolgte Datei geändert ist — auch wenn der eigene Commit sie
  nicht anfasst. Auf Staging ist das der Dauerzustand:
  `marktbericht/backend/src/connectors/boris/registry.js` trägt 319 Zeilen aus
  zwei alten Paketen, die nie zurückflossen.

**Deshalb nach jedem Lauf den echten Stand prüfen, nie der Ausgabe glauben:**

```
ssh root@116.203.214.11 'cd /opt/dealpilot && git rev-parse --short HEAD'
```

gegen den lokalen `HEAD`. Bricht das Skript nach dem Push ab, den Server-Pull
von Hand nachziehen (`git pull --ff-only` in `/opt/dealpilot`).

### Der Hash allein genügt nicht — den ZWEIG mitlesen

Am 12.08. abends stand der Staging-Server plötzlich auf **`main`** statt
`staging`, und damit auf `65ca0b0` — einem Stand von morgens. Alle
Frontend-Pakete des Tages (`v1148` bis `v1153b`) waren nicht mehr
ausgeliefert, obwohl jeder einzelne Deploy vorher den richtigen Hash gemeldet
hatte. Aufgefallen ist es nur, weil der Prüfbefehl einen Hash zeigte, der
nicht zum eben gepushten passte.

**Ein `git pull --ff-only` auf dem falschen Zweig meldet Erfolg** — es holt
brav `origin/main`, das sich nie bewegt. Der Prüfbefehl gehört deshalb
erweitert:

```
ssh root@116.203.214.11 'cd /opt/dealpilot && git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD'
```

**Erwartet wird `staging` UND der eben gepushte Hash.** Stimmt der Zweig
nicht, ist der Hash bedeutungslos.

### Der Parallel-Chat committet auf dem Server

Beim Zurückholen auf `staging` war der Zweig **divergiert**: auf dem Server
lag ein fremder Commit `0a55ee4` — **920 Zeilen in 15 Dateien**, das
v1083-Paket (Ausschuss-Register NRW, 493 LZS-Sätze, acht Auswerter für
Sachwertfaktoren). Ein anderer Arbeitsstrang hatte direkt auf dem Server
gearbeitet, committet und das mb-Backend neu gebaut.

**Das ist die zweite Wiederholung.** `545d069` trägt denselben Fall („die 319
Zeilen sind im Repo, Server wieder auf staging"), und die Projektanweisung
warnt seit dem 12.08.: *„Nur EIN Chat fasst git an."*

**Was in dieser Lage gilt:**
- **Nichts wegwerfen.** `git reset --hard origin/staging` hätte 920 Zeilen
  fremder Arbeit gelöscht. Erst `git log origin/staging..HEAD --stat` lesen.
- **Prüfen, ob die Basis passt:** `git merge-base --is-ancestor <mein-commit>
  <fremder-commit>`. Hier war es so — der fremde Strang hatte auf meinem
  Stand aufgebaut, also war ein Merge gefahrlos.
- **Konfliktrisiko an den Dateilisten ablesen**, nicht am Bauchgefühl. Hier
  berührte der fremde Commit **keine** `.md`-Datei, mein letzter nur
  Dokumentation → konfliktfreier Merge.
- **Danach zurückpushen**, sonst liegt die fremde Arbeit weiter nur auf dem
  Server und stirbt beim nächsten `--ff-only`-Abbruch.
- **Und prüfen, ob ihr Container-Rebuild lief** — Code im Repo heißt nicht
  Code im Container. Hier war er schon gebaut
  (`docker exec dealpilot-mb-backend ls /app/src/lib/…`).

---

## 2 · Welche CSS-Regel gewinnt, sagt nur der Kaskaden-Walker

`element.matches(selektor)` **findet** Regeln, sagt aber nichts darüber, welche
**gewinnt**. Zwei Sitzungen sind daran hängengeblieben: eine Regel als
gewinnend erklärt, die tatsächlich verlor, und dann am Symptom weitergepatcht.

In `style.css` (35.000 Zeilen, 4.198 `!important`) steht zu fast jedem Element
mehr als eine Farbregel. Häufigster blinder Fleck: das Element trägt **Klasse
und ID** (`<div class="hdr-obj-name" id="hdr-obj">`), die Gegenregel selektiert
über die ID. `!important` auf beiden Seiten hebt sich auf, es entscheidet die
Spezifität.

Der Walker läuft alle `document.styleSheets` rekursiv (auch `@media`), matcht
je **Teilselektor** einer Kommaliste und sortiert nach `!important` →
Spezifität → Reihenfolge. Zwei eigene blinde Flecken:

- **Kurzschriften.** CSSOM expandiert `background:` nicht zu
  `background-color`. Wer nur das Longhand abfragt, findet null Treffer und
  hält die Stelle für ungeregelt. Immer **beide** abfragen. Gleiches beim
  Schreiben: wer `background:` überbieten will, muss selbst `background:`
  setzen.
- **Pseudoelemente.** Das Goldband der Stapel-Karte ist `.sbc-top::before`.
  Ein Grund-Leser, der nur die Elternkette abklappert, rechnet Text gegen die
  dunkle Karte darunter und meldet k=1,08, wo real k=8,01 steht.

---

## 3 · Inline-`!important` schlägt alles

Mehrere JS-Dateien setzen Stile **inline mit `!important`**, ausdrücklich um
jede CSS-Regel zu schlagen — `js/dp-band-fix.js` (v863, Schließen-Knopf) und
`js/deal-action-boarding.js` (v857, `min-height:0` auf `.dab-chip`).

Der Kaskaden-Walker findet den Setzer **nicht**: er läuft `document.styleSheets`,
und die Inline-Regel steht dort nicht drin.

**Wirkt eine Regel nicht, obwohl die Spezifität passt:** zuerst
`el.getAttribute('style')` lesen. Steht der Wert dort, wird **in der JS-Datei**
geändert, nicht im CSS. Ein zweiter CSS-Versuch mit höherer Spezifität ist
verlorene Zeit.

---

## 4 · Messen im Browser: die Kabine

`resize_window` ändert `innerWidth` nicht — es blieb bei 1920, egal was
angefordert wurde. Responsive messen geht nur über ein **gleich-Origin-iframe**
mit gesetzter `style.width/height`; Media-Queries richten sich danach.

- **Die Kabine braucht einen Träger, auf dem die App nicht schon läuft.** Ein
  Renderer-Einfrieren (CDP-Timeout nach 45 s) kam nicht vom iframe, sondern
  davon, dass dieselbe App zweimal im selben Renderer startete. Träger ist
  `/impressum.html` (7 KB), Inhalt gelöscht, iframe 390 × 844.
- **Eine unbekannte URL taugt nicht als leerer Träger** — der SPA-Fallback
  liefert die volle App zurück (159 Skripte).
- **Eingefrorene Transitions.** Der gedrosselte Tab lässt CSS-Transitions bei
  Offset 0 stehen; der Drawer sah geschlossen aus, obwohl `.sb-mobile-open`
  gesetzt war. `*{transition:none!important}` hilft **nicht**. Was hilft:
  `document.getAnimations().forEach(a => a.finish())` nach jeder Änderung.
  Transitions stehen in der Kaskade **über** allem, auch über
  Inline-`!important`.
- **Faustregel:** Sieht eine Messung physikalisch unmöglich aus, liegt es am
  Messwerkzeug, nicht an der App.
- **Ein Überlauftest prüft gegen den klippenden Vorfahren, nicht gegen den
  Viewport.** Fünf abgeschnittene Tabellenzellen blieben unentdeckt, weil sie
  innerhalb des Fensters lagen. Vorfahren mit `overflow-x:auto` zählen dabei
  **nicht** als Befund — dort ist der Inhalt erwischbar.

---

## 5 · Zustände über den Bedienweg herstellen, nie per Attribut

Wer `data-ui-theme` per `setAttribute` setzt, misst **nicht** denselben Zustand
wie ein Klick im Panel: der Klick löst zusätzlich `skinNachziehen()` (v1085)
aus. Ein Paket sah über `setAttribute` sauber aus und färbte über den echten
Weg Kopf und Tab-Leiste in **allen vier hellen Vorlagen schwarz**.

Ursache war ein Tokenname mit **zwei Bedeutungen**: `--dp-header-bg` ist der
Nutzerwert des Reglers *und* eine Interna des Hell-Skins. Bevor ein fremdes
Token als „Nutzerwert" gelesen wird: prüfen, wer es sonst noch setzt. Dem
eigenen Zweck gehört ein **eigener Namensraum**.

---

## 6 · Hell und Obsidian nie im laufenden Tab umschalten

`_dpDispSkin('hell'|'obsidian')` hinterlässt Inline-CSS-Variablen am `<body>`,
die nach dem Zurückschalten stehen bleiben — die zweite Messung misst eine
Mischfassung, die es im Betrieb nicht gibt. Und `styleElement.disabled = true`
setzt den berechneten Stil nicht sauber zurück.

**Teuer dazu:** `_dpDispSkin` ändert Nutzereinstellungen. Es ruft
`vorlageNachziehen()`; steht die aktive Vorlage der neuen Helligkeit entgegen,
wird `dp_user_settings.ui_theme` auf `''` gesetzt — **die Vorlage ist weg.**

Zum Messen deshalb den Merker `dp_chrome_hell` setzen und neu laden. Fassung A:
Merker, `reload()`, messen. Fassung B: genauso. **Nie A→B→A in einem Tab.**

---

## 7 · Markenverlust wird über den Farbton gemessen

Um zu prüfen, wo eine Vorlage die Markenfarbe totsetzt: Akzent setzen,
Momentaufnahme **ohne** Vorlage, dann je Vorlage erneut, je Element vergleichen.
Zählen oder Regex über die CSS-Datei taugt nicht. Vier Fallen:

1. **„Neutral" ist nicht „grau".** Mit dem Kriterium max − min ≤ 8 meldete die
   Vorlage `panel` null Treffer — ihr Neutralton ist `rgb(21,26,32)`
   (Blaustich), `boarding` ist cremefarben. Richtig ist der **Farbton**.
2. **Nie mit rotem Testakzent messen.** Rot ist von Status-Rot nicht zu
   trennen, Grün genauso wenig. **Violett** (`#7C5CBF`) hält beide eindeutig.
3. **Rahmenfarbe nur zählen bei `border-width > 0`** und Stil ≠ `none`.
4. **`color` nur zählen bei eigenem Textknoten** — sonst zählt jede
   Vererbungsstufe mit, und aus 13 Elementen werden scheinbar 33.

Die Trennlinie: Gold bei 10–55 % Deckung ist ein **Neutralton**, den die
Vorlage bestimmen darf. Vollton auf Text oder Bedienelement ist **Marke** und
muss mitfärben. Und **beide Bedienwege** prüfen —
`DealPilotWhitelabel.apply()` setzt `--gold-d` und die `--wl-*`, der Regler
`_dpDispAccent()` nicht.

---

## 8 · Werkzeugfallen

- **Heredocs halbieren Backslashes — auch mit gequotetem Delimiter.**
  Beim Einsetzen der `u`-Escapes in die Testphasen-Mails (v1185f) kamen
  zwei Anläufe still verstümmelt an: aus einem `\` wurde ein `\`, aus
  einer Escape-Sequenz ein gewöhnliches `u`. Ein Ersetzungslauf, der das
  reparieren sollte, hat dabei **doppelt kodiert** — aus `ä` wurde `Ã¤`,
  die alte Falle in neuem Gewand. Zurückgenommen über
  `git checkout --`, nicht über ein Backup.
  **Konsequenz: Escape-Sequenzen nie tippen, immer generieren.** Der
  deutsche Text liegt als reine Textdatei
  (`backend/src/services/testphase-mailtexte.txt`),
  `tools/baue-mailtexte.js` erzeugt daraus den JS-Block —
  **das Skript selbst enthält keinen einzigen Backslash**, es setzt sie
  über `String.fromCharCode(92)` zusammen. Wer einen Anker mit `\n` oder
  `\u` braucht, holt ihn mit `sed` aus der Datei, statt ihn zu schreiben.
- **Umlaute: `ae/oe/ue` gehört in Kommentare, NIE in Nutztext.** Der
  Fehler steht zweimal in der Chronik — v1183b („Datumsformat und
  Umlaute im Nutztext") und v1185, wo die Testphasen-Mails „die Haelfte
  deiner Testphase" an einen echten Empfänger schickten. **Gemessen:
  kein einziger Service unter `backend/src/services` trägt einen echten
  Umlaut im Quelltext** — dort gilt durchgehend die `u`-Escape-Form.
  Wer eine neue Vorlage schreibt, sieht sich die Nachbarvorlage an.
- **`Set-Content` zerstört Dateien mit Umlauten.** Ein
  `(Get-Content x -Raw) -replace … | Set-Content x -Encoding UTF8` hat
  `index.html` komplett neu geschrieben: jedes Nicht-ASCII-Zeichen doppelt
  kodiert, BOM vorangestellt — **711 geänderte Zeilen statt einer**. Immer
  `[System.IO.File]::ReadAllText` / `WriteAllText`. Nach jeder
  Buster-Änderung `git diff --stat` gegenlesen.
- **PowerShell 5.1 behandelt typografische Anführungszeichen wie echte
  Quotes.** Eine Commit-Nachricht mit „…" sprengt das Here-String und git
  liest die Bruchstücke als Dateinamen. Nachricht in eine Datei schreiben und
  `git commit -F` nutzen.
- **`DPC` gibt es im Seiten-Scope nicht.** In `config.js:852` steht
  `var DPC = window.DealPilotConfig;` — ein modul-interner Alias. Nach außen
  heißt alles `window.DealPilotConfig.branding.*`. Ein `try/catch` mit
  stillem Rückfall auf den Rohwert ließ eine Korrektur **nie** laufen, bei
  gemessenem Kontrast 1,00. **Fehlende Module laut melden**, nicht im `catch`
  verschwinden lassen.
- **`window.confirm` blockiert jede Browser-Automation.** Der
  Marktbericht-Abruf fragt vor dem kostenpflichtigen Lauf nach
  (`marktbericht-app/app.js:224`, v647-cost). Ein modaler Dialog friert den
  Renderer ein: CDP läuft in einen Timeout, Screenshots scheitern, der Tab
  ist tot und muss geschlossen werden. Das sah wie ein Produktfehler aus und
  war keiner — **der Dialog ist der Kostenschutz und gehört dahin.** Wer den
  Weg automatisiert prüfen will, ersetzt ihn vorher:
  `window.confirm = () => true` (und den Text mitschreiben, er nennt den
  Preis). Gilt genauso für `alert` und `prompt`.
- **`#app` gibt es in der App nicht.** `CLAUDE.md` nennt `#app[...]` als
  Beispiel für „lieber Spezifität erhöhen" — als Muster, nicht als
  vorhandenes Element. `document.getElementById('app')` liefert `null`.
  Eine CSS-Regel mit diesem Anker greift **nirgends** und sieht dabei
  völlig plausibel aus. Kostete in `v1147` einen ganzen Ausrollzyklus.
  **Jeden Anker vor dem Schreiben im Browser auslesen** — auch den aus der
  eigenen Dokumentation.
- **`WriteAllLines` rettet nicht vor der Umlaut-Falle, wenn das Skript
  selbst falsch gelesen wird.** PowerShell 5.1 liest eine `.ps1` **ohne
  BOM als ANSI**: jedes „—" und jeder Umlaut im Skript-Literal ist damit
  schon beim Einlesen kaputt und wird sauber als Doppelkodierung
  geschrieben. Betrifft nur die **eigenen Literale**, nicht die
  eingelesenen Zeilen — deshalb sieht die Datei zu 99 % richtig aus.
  Auch Suchmuster trifft es: `-Pattern '^## Später'` findet nichts.
  **In Skripten ASCII-Muster benutzen** (`'^## Sp.ter'`) und Texte mit
  Umlauten aus einer UTF-8-Datei einlesen, nie als Literal.
- **CDP bricht nach 45 s ab.** Ein `await new Promise(r=>setTimeout(r,60000))`
  im selben `javascript_tool`-Aufruf läuft in den Timeout und meldet
  „renderer may be frozen" — die Seite ist völlig in Ordnung. Wartezeiten
  auf mehrere Aufrufe verteilen, höchstens ~40 s pro Aufruf.
- **Aufklapper sind Umschalter.** `feldhilfe.js` entfernt den Kasten, wenn
  er schon da ist. Ein Prüflauf, der alle Zeichen durchklickt, **schließt**
  die aus einem abgebrochenen Lauf noch offenen — und meldet sie als „ohne
  Text". Vor der Messung `.fh-box` abräumen, sonst misst man den eigenen
  Vorlauf.
- **Zustand aus dem vorigen Prüflauf verfälscht die nächste Messung.** Ein
  selbst gesetztes `body.hdr-collapsed` überlebte den Reload (localStorage)
  und ließ einen Spalt von 49 px melden, den es nicht gab. Vor jeder Messung
  `document.body.className` und die einschlägigen Merker mitlesen — und im
  Befund nennen.

---

## 9 · „Das fehlt" ist die teuerste Vermutung — zweimal an einem Tag

Am 12.08. zweimal derselbe Fehler: eine Lücke behauptet, die es nicht gab.

- **Tablet-Punkt.** Der Backlog verlangte drei Dinge zu bauen (Sidebar
  andocken, zweispaltige Formulare, Popover statt Blatt). **Alle drei waren
  gebaut** — das Andocken seit `v648`, das Blatt seit `V46` per
  `display:none!important` stillgelegt. Der zugrunde liegende Entwurf hatte
  nur bei **820 px** gemessen, unterhalb der 901er-Schwelle.
- **Sachwertfaktor.** Ich meldete, ein manuell eingegebener Faktor trage
  **keine Herkunft**, weil in `CrossCheckService.js` alle sieben
  `sachwertfaktor_*`-Felder am Tabellenweg hängen. Das stimmte — und war
  trotzdem der falsche Schluss. Die Herkunft läuft über einen **anderen**
  Weg: `WertParameterService.sachwertfaktor()` gibt beim eigenen Wert
  `{wert, stufe:'E', quelle:'eigene Angabe'}`, `nhk2010.js:897` setzt daraus
  `out.sachwertfaktor = {wert, stufe, quelle}`, und die Karte druckt
  „· Faktor 1,15 · Stufe E". **Genau das hatte `v1144` hergestellt.**

**Das Muster ist dasselbe:** ein Feld ist an der erwarteten Stelle leer, und
daraus wird „die Funktion fehlt" — statt „ich habe den Weg noch nicht
gefunden".

**Woran es zu erkennen ist:** die Behauptung lautet „X wird nicht gesetzt",
belegt durch **eine** Stelle. Ein Negativbefund über eine ganze Funktion
lässt sich an einer Stelle aber nicht belegen.

**Was hilft, in dieser Reihenfolge:**
1. **Vom Verbraucher her suchen, nicht vom Erzeuger.** Wer stellt den Wert
   dar? Die Anzeige (`app.js:592 ff.`) las die Stufe längst und beherrschte
   sogar zwei Formen (Zahl **und** Objekt). Das allein hätte die Fehldiagnose
   verhindert.
2. **Nach dem Vokabular greppen, nicht nach dem Feldnamen.** `STUFEN_ETIKETT`
   mit A–E steht in `WertParameterService.js` und beschreibt E als „eigene
   Angabe, vom Nutzer gesetzt". Ein `grep -rn "'E'"` wäre schneller gewesen
   als jede Weichenanalyse.
3. **Die Commit-Historie nach dem Thema fragen.** `git log --oneline -S`
   findet, wer den Weg gebaut hat. `v1144` trug es im Titel: „Der
   Sachwertfaktor wurde nie angewandt — falscher Feldname an zwei Stellen."
4. **Erst dann urteilen.** Und wenn geurteilt wurde: die Rücknahme
   ausdrücklich, nicht stillschweigend.

**Und die Konsequenz aus der Wiederholung:** `CLAUDE.md` sagt, zwei gleiche
Fehler hintereinander heißen, die Sitzung ist zu lang — abschließen,
übergeben, Schluss. **Das gilt auch dann, wenn der nächste Schritt klein und
verlockend aussieht.** Genau dann irrt man weiter.

## 10 · Farbparser, die nur `rgb()` kennen, sind seit `color-mix` blind

**Verschachteltes `color-mix` gibt `getComputedStyle().color` als
`color(srgb 0.488784 0.395529 0.109333)` zurück — nicht als `rgb()`.**

Ein Parser mit `(s.match(/[\d.]+/g)).slice(0,3)` zieht daraus `0.48, 0.39, 0.10`
und liest sie als 0–255. Ergebnis: fast Schwarz, Kontrast **19,24** gegen einen
hellen Grund. Das sieht aus wie ein glänzend behobener Befund und ist eine
Messung, die nie stattgefunden hat.

```js
const rgb = s => { const n = (s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
                   return /color\(/.test(s) ? n.map(v => v*255) : n; };
```

**Zwei Folgefallen aus demselben Lauf (`v1164`):**

- **Der Grund-Leser muss `background-image` auswerten.** Die Kopfleiste trägt
  einen Verlauf, keine Farbe — ein Leser, der die Vorfahren nach der ersten
  `background-color` ≠ transparent absucht, überspringt sie und meldet Weiß.
- **Und er darf nicht am eigenen Schleier hängenbleiben.** Nachdem der Regex um
  `color(...)` erweitert war, fand er den **halbtransparenten Eigenhintergrund**
  des gemessenen Elements (20 % Gold) und rechnete dagegen — Kontrast 2,46 statt
  5,16. **Gemessen wird gegen die Fläche darunter**, nicht gegen den eigenen
  Verlauf. Beim Aufsteigen also das Element selbst überspringen, wenn sein
  Hintergrund halbtransparent ist.

**Merksatz:** Ein Kontrastwert, der sich zwischen zwei Läufen um mehr als eine
Stufe bewegt, ohne dass die Farbe sich geändert hat, ist ein Werkzeugbefund —
nicht ein Ergebnis.

## 11 · Die kuratierte Anzeige ist nicht der Umfang

**`voice-import.js` hat ZWEI Feldkataloge**, und nur einer ist sichtbar:

| | |
|---|---|
| `buildCatalog()` (v510) | **kuratierte Whitelist** — baut die Chip-Wolke. Interne und kryptische Felder fehlen bewusst |
| `buildFullCatalog()` (v519) | **alle `window.FIELDS`** — geht an die Auswertung. Auch Investment-These, Risiken, Bauspar-, Bank-Felder |

Wer die Chips zählt, hält die **Anzeige** für den **Funktionsumfang** und
schreibt einen Backlog-Punkt über etwas, das seit v519 gebaut ist. Genau das
ist mit Punkt 7 passiert.

**Allgemein:** Wenn eine Oberfläche eine kuratierte Auswahl zeigt, ist die
Frage nie „was steht in der Liste", sondern **„gibt es einen zweiten Weg, der
mehr kann"**. Vor jedem „das fehlt": nach einem zweiten Katalog, einer
`*Full*`-Variante oder einem Fallback-Zweig suchen.

**Zählstand dieser Sitzung: sechsmal „das gibt es nicht" gesagt, sechsmal gab
es das.** Tablet-Fassung, Sachwertfaktor-Stufe E, BEDARF-Doppelliste, die
sieben Pro-Tage, die Restlaufzeit-Anzeige, der volle Sprach-Katalog.

## 12 · Der Kreuzabgleich muss BEIDE Seiten prüfen — Code UND Datenbank

`hasFeature` fragt **zuerst** `Sub.hasCachedFeature` (die DB) und nimmt
`config.js` nur bei `null`. Ein Schlüssel, den `config.js` kennt und
`plans.features` **nicht**, ist damit für **jeden** zu — auch für Pro und
Partner. Und zwar **still**: die Datei behauptet, die Funktion sei offen.

Gefunden beim Punkt-6-Prüflauf: `beleg_import` und `theme_palette` stehen in
`config.js`, aber in **keinem** DB-Plan. Am echten Partner-Konto sind beide
`false`.

**Der Abgleich Frontend-Schlüssel gegen Frontend-Pläne reicht nicht.** Er hatte
kurz vorher „alles sauber" gemeldet — richtig, aber auf der falschen Achse.
Die dritte Liste ist `plans.features` in der Datenbank:

```sql
SELECT id, jsonb_object_keys(features) FROM plans WHERE id IN (...);
```

**Und die Messfalle gleich dazu:** Im Prüfmodus (`v1163`) lesen die
simulierten Stufen den **`config.js`-Fallback**, das echte Konto liest die
**DB**. Weicht die „partner"-Zeile von den anderen ab, ist das zuerst ein
Hinweis auf die **Quelle**, nicht auf den Plan. Erst der DB-Abgleich macht
daraus einen Befund.

## 13 · Ein Feature-Schlüssel auf `false` heißt nicht, dass die Funktion gesperrt ist

Sie kann an einem **zweiten Weg** hängen. Beim Punkt-6-Prüflauf standen zwei
Schlüssel gleich aussehend auf `false` — der eine war ein echter Ausfall, der
andere völlig in Ordnung:

| Schlüssel | Aufrufstelle | Urteil |
|---|---|---|
| `beleg_import` | `beleg-import.js:66` — **allein** an `hasFeature` | echter Ausfall, Funktion war für jeden zu |
| `theme_palette` | `_isPalette()` prüft **zuerst** `isProOrAbove()` | kein Fehler; hängt am **Plan-Schlüssel** |

Beide waren am echten Konto `false`. **Die Messung war in beiden Fällen
richtig; der Schluss nur in einem.**

**Vor jeder Behebung die Aufrufstelle lesen, nicht nur den Schlüssel.** Sonst
wird ein bewusst gesetzter Platzhalter gelöscht — die `theme_palette`-Zeile
trägt den Kommentar „später, wenn Backend es kennt" und ist ein Vorgriff, kein
Versehen.

**Gegenprobe, die beide Fälle trennt:** *Gibt es die Funktion überhaupt, und
hängt sie ausschließlich an diesem Schlüssel?* Ein `grep` auf den Schlüssel
ohne `config.js` beantwortet beides in einem Schritt.

## 14 · Eine Sonderbreite ist fast immer die falsche Antwort auf „zu schmal"

`v1151` gab der Reiterleiste des Marktberichts eine eigene `max-width` von
960 px, weil sie bei 760 px umbrach. Die Begründung war richtig — Navigation
ist keine Formularzeile. **Das Ergebnis war eine zweite Kante auf derselben
Seite, und die fiel sofort auf** (`v1172`).

**Wenn ein Element mehr Platz braucht als seine Nachbarn, ist die Frage, ob
nicht alle mehr brauchen.** Erst dann eine Ausnahme, und nur wenn sie nicht
in derselben Blickachse liegt.

### Und die Cache-Kette dazu: ein `sed`, das nichts findet, meldet nichts

Die Marktbericht-Kette hat **drei** Glieder:

```
frontend/index.html            marktbericht-view.js?v=N
frontend/js/marktbericht-view.js   /marktbericht-app/index.html?v=N   <- IM Skript
frontend/marktbericht-app/index.html   mb-wizard.js?v=N  (bzw. app.js, wertermittlung.js)
```

Beim Ausrollen von `v1172` traf das Muster nur eins davon: es suchte `v=1165`,
dort stand längst `v=1166`. **Der Browser hätte das iframe-Dokument aus dem
Cache geladen — mit dem alten Skriptverweis — und die Änderung wäre nie
angekommen, obwohl auf dem Server alles richtig lag.**

**Nach jedem Ziehen alle drei Glieder nebeneinander ausgeben lassen.** Nicht
das Ersetzen prüfen, sondern das Ergebnis.

---

## Die Migrationstabelle beweist keine Schema-Gleichheit

Gemessen am 04.09.2026, beim Spiegeln eines Nutzers von Staging nach Prod:
beide Datenbanken führten **exakt dieselben 69 Migrationen** — die Differenz
in beide Richtungen war leer. Trotzdem hatte `tax_snapshots` auf Staging eine
Spalte, die es auf Prod nicht gibt: **`bmf_advanced`**, mit 9 belegten Zeilen.

Sie ist also **von Hand** angelegt worden, an den Migrationen vorbei. Ein
`\copy` mit der Staging-Spaltenliste wäre auf Prod mitten im Import gestorben
— und zwar erst nach den grossen Tabellen.

**Vor jedem Datentransfer zwischen zwei Umgebungen die Spaltenlisten der
beteiligten Tabellen direkt vergleichen**, nicht die Migrationstabelle. Zwei
Abfragen auf `information_schema.columns`, `comm -23`/`comm -13` dagegen,
fertig. Und importiert wird mit der Spaltenliste des **Ziels**, nie der der
Quelle.

## Was im Browser liegt, wandert nicht mit der Datenbank

Beim selben Vorgang: die **Mandanten** — Gesellschaften, Rechtsform,
Buchhaltungs-Stammdaten und die Kosten der Gesellschaft je Jahr — liegen
**nicht** in Postgres. `js/mandanten.js:14` legt alles unter einem einzigen
`localStorage`-Schlüssel `dp_mandanten` ab.

Eine vollständige DB-Spiegelung hätte auf Prod eine Bilanz ohne Gesellschaft
ergeben: das Objekt trägt den Halter als **Verweis** auf eine Mandanten-ID,
und der Verweis wäre ins Leere gelaufen. **Der Schlüssel gehört pro Origin
mitkopiert** — `app.staging.dealpilot.immo` und `app.dealpilot.immo` sind
zwei getrennte Speicher.

Dasselbe gilt für den Zähler der Objektnummern, `ji_u_<user-id>_seq_<jahr>`:
er trägt die **Nutzer-ID im Namen**, und die ist in der anderen Umgebung eine
andere. Wer ihn stumpf kopiert, legt ihn unter dem alten Namen ab, wo ihn
niemand liest.

## Ein Auswahlfeld ohne leere erste Option ist keine Pflichtangabe

Gemessen am 04.09.2026 im Marktbericht-Wizard, frisch geladen: `ptype` stand
ohne jede Eingabe auf `ETW`, `baustatus` auf `bestand` — beide sind als
Pflicht geführt. Alle übrigen Auswahlfelder öffnen mit „– keine Angabe –"
und sind leer.

**Ein `<select>` ohne leere erste Option ist immer ausgefüllt.** Damit fällt
das Feld aus jeder Vollständigkeitsprüfung heraus: es fehlt nie, also fordert
es niemand ein, also merkt auch niemand, wenn zwei Listen es auf verschiedenen
Stufen führen. Genau so blieb ein Widerspruch zwischen `BEDARF` (Ampel) und
`VERFAHREN[].pflicht` (Knopf) jahrelang unsichtbar.

Schlimmer als die Logik ist die Fachlichkeit: an `ptype` hängt
`istWohnung()`, und daran hängt, **ob das Sachwertverfahren überhaupt
erscheint**. Ein von Hand erfasstes Haus lief still als Eigentumswohnung, und
das führende Verfahren verschwand mit einer plausibel klingenden Begründung.

**Beim Prüfen einer Pflichtangabe nie den Code lesen, sondern das Feld im
Browser auslesen** — `value` UND `options[0].value`. `pflicht: true` im
Feldschema sagt nichts darüber, ob die Pflicht je greifen kann.

## Ein Wert, den das Auswahlfeld nicht kennt, wird still verworfen

Im selben Durchgang: `fillInputsFromDpkt()` schrieb `'haus'` bzw. `'wohnung'`
in ein `<select>`, dessen Optionen `ETW/EFH/MFH/DHH/…` heißen. Gemessen:

```
s.value = 'haus'  ->  value ''  selectedIndex -1
s.value = 'EFH'   ->  value 'EFH'
```

**Kein Fehler, keine Ausnahme, keine Konsolenmeldung** — die Zuweisung setzt
`selectedIndex` auf −1 und der Wert ist leer. Der Import hat die Objektart
also nie gesetzt, in keinem einzigen Fall, und niemand hat es gesehen.

**Nach jedem `select.value = …` aus einer fremden Quelle gegenlesen**, ob der
Wert angekommen ist. Und Zuordnungstabellen nicht zweimal führen: die richtige
stand längst als `mapPtype()` in `mb-objektwahl.js`.

## Skriptgesteuertes Füllen feuert kein `change`

Direkt danach gefunden: nach dem `.dpkt`-Import stand „fehlt: Objektart",
obwohl `EFH` im Feld stand. Wer Formularfelder per Skript setzt, muss die
Ereignisse selbst auslösen — sonst ziehen Ampel, Pflichtfeld-Sperre und alle
abhängigen Blöcke nicht nach.

Der zweite Füllweg derselben Datei machte es längst richtig. **Solche
Nachzieh-Listen gehören an EINE Stelle**: zwei Aufrufer mit je eigener Liste
laufen auseinander, und hier hätte der zweite `address` gebraucht, der erste
nicht.

## Der Prüfmodus liest die Datei, der Kunde die Datenbank

`dp_plan_override` stuft die Oberfläche herab und überspringt dabei bewusst
die Datenbank (`config.js`, `v1163`) — sonst zeigte die Oberfläche den
simulierten Plan, die Funktionen blieben aber die des echten Abos.

**Der Preis dafür:** was der Prüfmodus zeigt, ist der `config.js`-Fallback,
nicht die Plan-Zeile aus der Datenbank. Wo beide auseinanderlaufen, **beschei-
nigt ein bestandener Prüflauf eine Funktion, die der echte Nutzer nicht hat.**

Gemessen am 04.09.2026: `track_record_pdf` steht in `config.js` für Free auf
`true`, in der Datenbank auf `false` — in beiden Umgebungen. Der Prüfmodus
meldet `true`, der echte Free-Nutzer bekommt nichts.

**Ein Prüflauf über die Pläne ist erst vollständig, wenn beide Quellen
nebeneinander liegen.** Die Datenbank kommt über `GET /plans`, die Datei über
`DealPilotConfig.pricing.plans` — Schlüssel für Schlüssel vergleichen, und
dabei so normalisieren, wie `hasFeature()` liest: ein nicht-leerer String
(`'demo'`, `'simplified'`) ist **true**.

## Ein Kommentar ist keine Messung — auch nicht drei gleichlautende

Drei Stellen sagten „Testphase 7 Tage": zwei Backend-Kommentare und der
Backlog. Eine vierte sagte „vier Wochen". **Gerechnet wird mit
`TESTPHASE_TAGE = 28`** — die Landing wirbt mit vier Wochen, und der Code
hält das ein.

Der Name der Sache (`TR7-trial`) stammte aus der ersten Fassung mit sieben
Tagen und hat die Kommentare überlebt, die Zahl nicht. **Bei jeder Frage nach
einer Frist, einem Limit oder einem Preis die rechnende Zeile suchen**, nicht
die Beschreibung — und danach an echten Daten gegenprüfen (hier:
`plan_trials`, Spanne bis 28 Tage).

## `hasCachedFeature` liefert nie `null` — der `config.js`-Rückfall ist tot

`hasFeature()` fragt die Datenbank und greift **nur bei `null`** auf
`config.js` zurück (`config.js:728`). Gemessen am 04.09.2026 an einem
laufenden Konto:

```
Sub.hasCachedFeature('gibt_es_nicht_xyz')  ->  false     (nicht null)
```

Sobald das Abo geladen ist, antwortet der Cache auf **jeden** Schlüssel mit
`true` oder `false`. Der Zweig darunter ist damit unerreichbar: **was in der
Plan-Zeile der Datenbank fehlt, ist für jeden `false` — auch für Pro und
Partner.** Ein Schlüssel in `config.js` zu vergeben, den die Datenbank nicht
kennt, wirkt nichts.

**Wer ein neues Feature einführt, trägt es in die Datenbank ein**, nicht nur
in `config.js`. Und wer einen Verdacht prüft, misst am laufenden Konto gegen
`Sub.hasCachedFeature`, nicht gegen die Datei.

## Zwei Wege zum Plan, und nur einer kennt die Testphase

`subscriptionService.getEffectivePlan()` liest `plan_trials` mit — sechs
Stellen benutzen sie. **Zwei Routen lesen die Tabelle `subscriptions`
direkt** (`ai.js`, `avm.js`) und sehen die Testphase deshalb nicht.

Gemessen: **fünf** Staging-Nutzer mit aktivem `pro`-Test und **ohne**
Subscription-Zeile — für die liefert die Direktabfrage `free`, während
`getEffectivePlan()` `pro` sagt. Drei weitere haben einen aktiven Test
**und** ein bezahltes `starter`-Abo; bei ihnen sagen beide Wege `starter`,
denn **ein bezahltes Abo schlägt die Testphase** (Abweichung 1 im Kommentar
von `getEffectivePlan`). Das ist Absicht, kein Fehler — wer den Unterschied
nicht kennt, hält den Befund für dreimal größer, als er ist.

**Der Plan eines Nutzers wird nie aus `subscriptions` gelesen.** Es gibt eine
Funktion dafür, und sie ist die einzige, die alle Quellen kennt. Eine
Direktabfrage ist eine zweite Wahrheit — und sie fällt erst auf, wenn ein
Kunde in der Testphase steckt.

## Wer den Feldkatalog ohne geladenes Objekt zählt, misst zu wenig

`buildFullCatalog()` in `voice-import.js` geht `window.FIELDS` durch und
überspringt jedes Feld, dessen DOM-Element gerade fehlt (`if (!el) return;`).
Ohne geladenes Objekt sind ganze Reiter nicht gebaut — **gezählt wird dann die
Abwesenheit von Reitern, nicht die von Feldern**, und nichts protokolliert es.

Gemessen am 04.09.2026 mit geladenem Objekt: `FIELDS` führt **203** Einträge,
im Formular stehen **235** Felder, und **60** davon kennt `FIELDS` nicht.

**Und `FIELDS` ist keine verlässliche Liste dessen, was der Nutzer eingeben
kann:** vier Einträge (`bspar_zuteil`, `mietspiegel`, `erwerbsart`,
`anbietertyp`) haben **gar kein Formularfeld** — `storage.js` liest und
schreibt sie, ein `id="…"` gibt es nirgends. Die Liste ist ein
Datenschlüssel-Verzeichnis, kein Feldverzeichnis. Wer beides gleichsetzt,
zählt in beide Richtungen falsch.

## Ein Kasten, den niemand erzeugt — die Funktion steigt still aus

`_renderQcCalcInfo()` (`quick-check.js:761`) baut die Berechnungs-Info des
Quick-Check: Kaufpreis, Nebenkosten, Gesamtinvestition, Eigenkapital,
Darlehen, Renditen, DSCR, LTV. Sie sucht `#qc-calc-info` und
`#qc-calc-info-body` — und **kehrt in Zeile 1 zurück, wenn es sie nicht
gibt**:

```js
if (!box || !body) return;
```

Gemessen am 04.09.2026: die beiden Ids stehen **in keiner HTML-Datei**, nur
im CSS (drei Regeln) und in dieser Abfrage. Zur Laufzeit, nach dem Öffnen
des Quick Boarding und dem Füllen von Kaufpreis, Miete und Eigenkapital:
`document.getElementById('qc-calc-info')` → **null**. **Der Kasten wurde nie
erzeugt, seit `V63.23`.**

**Ein `return` bei fehlendem Element ist eine gute Schutzregel und ein
schlechtes Protokoll.** Nichts in der Konsole, nichts im Bild — nur eine
Funktion, die 45 Zeilen lang etwas baut, das niemand sieht, und ein
Stylesheet, das darauf wartet.

**Wer etwas an eine bestehende Anzeige hängt, prüft zuerst im Browser, ob
diese Anzeige überhaupt erscheint** — nicht, ob der Code sie erzeugt. Mich
hat genau das eine Version gekostet (`v1232`, sofort zurückgenommen): der
Text war richtig, der Träger existierte nicht.

**Und die Gegenprobe gehört dazu:** `grep` auf die Id über *alle* Dateitypen,
nicht nur über `js/`. Steht sie ausschließlich im Stylesheet und in der
lesenden Zeile, gibt es sie nicht.

## Eine Bilanz, die aufgeht, beweist ihren Inhalt nicht

Gemessen am 04.09.2026: die Bilanz der Test UG ging auf — Summe Aktiva =
Summe Passiva, Differenz null. Sie führte trotzdem **dasselbe Objekt
zweimal**: Umsatz 24.960 € statt 12.480 €, Bilanzsumme 557.025 €.

Ursache war ein Doppellauf des Überführungs-Assistenten. Er prüfte nur, ob
überhaupt eine Gesellschaft existiert — **nicht, ob das offene Objekt
überhaupt in Frage kommt.** So wurde ein Gesellschafts-Objekt ein zweites Mal
überführt, mit Ringschluss in `_ueberf_link`.

**Das Aufgehen ist eine Prüfung der Mechanik, keine der Menge.** Wer eine
Bilanz abnimmt, zählt zusätzlich, **welche** Objekte darin stehen — die Liste
der Namen, nicht nur die Summe. Ein Duplikat verschiebt beide Seiten um
denselben Betrag und fällt deshalb nie durch die Bilanzprobe.

**Und jeder Vorgang, der ein Objekt umschreibt, prüft vorher den
Ausgangszustand** — nicht nur die Verfügbarkeit des Ziels.

## Eine ID ist keine Anzeige

Die Objektkarten zeigten `mmtlt8yq2fq` — die Mandanten-ID aus
`dp_mandanten`. Aufgefallen ist es erst nach einer Überführung, obwohl der
Fehler immer da war: bei `privat` ist die ID zufällig lesbar, und deshalb sah
die Zeile jahrelang richtig aus.

**Wo eine Kennung in die Oberfläche durchgereicht wird, gehört sie
aufgelöst** — über die Stelle, die die Liste führt, nicht über eine zweite
Zuordnung. Und wenn das Auflösen fehlschlägt: **lieber leer als kryptisch.**

> Nebenfalle: `DealPilotMandanten.get(id)` liefert als Rückfall den **ersten**
> Mandanten, nicht `null`. Wer nicht gegenprüft, ob die zurückgegebene ID auch
> die gesuchte ist, zeigt bei jeder unbekannten Kennung „Privat" an.

## Ein Jahresabschluss ohne Vortrag ist eine Momentaufnahme, keine Bilanz

Gemessen am 04.09.2026 über vier Jahre: Abschreibung und Tilgung wanderten
korrekt mit — kumulierte AfA 0 → 6.153 → 12.305 → 18.458 €, Buchwert und
Darlehen entsprechend fallend. **Das Ergebnis des Vorjahres wanderte nicht.**
Jedes Jahr stand für sich, der Vortrag blieb der Eröffnungswert.

§ 252 Abs. 1 Nr. 1 HGB verlangt Bilanzidentität: die Eröffnungsbilanz eines
Jahres **ist** die Schlussbilanz des Vorjahres. § 266 Abs. 3 A. IV HGB führt
dafür einen eigenen Posten.

**Und die Bilanz ging trotzdem jedes Jahr auf**, weil die Differenz still im
Verrechnungskonto landete — dem Posten, der per Bauart alles auffängt.

**Wer einen mehrjährigen Abschluss prüft, rechnet zwei Jahre nacheinander und
hält das Ergebnis des ersten gegen den Vortrag des zweiten.** Eine einzelne
Jahresbilanz kann diesen Fehler nicht zeigen.

> Und eine zweite Lücke, die erst die Gegenprobe zeigte: das Startjahr der
> Fortschreibung darf nicht nur aus den **Objekt**-Steuersätzen kommen. Ein
> Jahr, in dem die Gesellschaft nur Kosten hatte, ist ebenso ein
> Geschäftsjahr — sonst verschwindet sein Verlust lautlos.

## Ein Rück-Link auf sich selbst ist ein Löschknopf

`undoUeberfuehrungFromPrivat()` schickt `DELETE` auf den verknüpften
Schlüssel. Gemessen am 04.09.2026: ein Privat-Objekt trug in
`_ueberf_link` seine **eigene** Id — ein Klick auf „Überführung aufheben"
hätte es selbst gelöscht.

Entstanden ist der Selbstbezug beim Anlegen: der Rück-Link wird aus
`_currentObjKey` gebildet, und wenn der nach dem Speichern des neuen Objekts
noch nicht umgesprungen ist, steht dort der alte Schlüssel.

**Wer eine Id in ein anderes Objekt schreibt, prüft vorher, dass sie nicht
die eigene ist.** Und wer auf einer Id löscht, prüft es noch einmal —
**lieber kein Link als ein falscher**: ohne Link lässt sich der Zustand
sauber auflösen, mit falschem zerstört er sich.

## Eine Sperre, die einen Fehler sichtbar macht, ist mehr wert als eine, die ihn verhindert

Die Vorprüfung aus `v1234` verweigerte eine Überführung mit „bereits
überführt und zum 01.01.2026 eingefroren" — obwohl die Datenbank sauber war.
Der Wert stand nur im **Formular**, übernommen vom zuvor geladenen Objekt,
weil `loadData()` diese Felder nicht zurücksetzt.

**Ohne die Sperre wäre der falsche Stichtag stillschweigend mitgespeichert
worden** — und war es an anderer Stelle bereits: der Auto-Save hatte die
Werte des Vorgängers in ein fremdes Objekt geschrieben.

**Wenn eine neue Prüfung etwas ablehnt, das richtig aussieht, ist das ein
Befund und keine Fehlfunktion.** Erst messen, was die Prüfung sieht — und
woher der Wert kommt, den sie sieht.

## Der Cache-Buster schützt die Datei, nicht das Dokument

Gemessen am 07.09.2026: nach dem Ausrollen von `v1240` lud der Browser
weiterhin `mietentwicklung.js?v=166`. Server und Platte trugen längst
`v1240` — `curl` auf `index.html` bewies es.

**Im Cache lag `index.html` selbst.** Der Buster steht *in* diesem Dokument;
solange das Dokument alt ist, ist auch der Buster alt. Ein `location.href`
auf dieselbe Adresse holt das Dokument nicht neu.

**Wer nach einem Rollout misst, prüft zuerst, welche Fassung der Browser
wirklich geladen hat** — `[...document.querySelectorAll('script[src]')]` —
und nicht nur, was der Server ausliefert. Weichen sie ab, hilft ein eigener
Zufallsparameter an der Seitenadresse (oder Strg+Shift+R beim Menschen).

> Das ist die Umkehrung der bekannten Falle: sonst ist der Buster zu alt,
> hier war das Dokument zu alt, das ihn trägt.

## Das letzte Beispiel im Prompt schlägt jede Anweisung darüber

`v1242` verlangte an drei Stellen mehrere Quellen und einen amtlichen
Mietspiegel. Der erste echte Lauf gegen Bielefeld brachte trotzdem:

```
"reasoning": "Mietspiegel Bielefeld 2024"
"sources":   [ { "label": "Mietspiegel Bielefeld 2024" } ]
```

Genau eine Quelle — und ein `reasoning`, das keins war, sondern ein
Quellenname. **Beides stand so im Beispiel-JSON am Ende des Prompts.** Das
Beispiel zeigte gar kein `sources` und trug in `reasoning` „Mietspiegel
Herford 2024".

**Ein Modell kopiert das Beispiel, nicht die Regel.** Wer einen Prompt
ändert, ändert das Beispiel mit — sonst hat er zwei Prompts geschrieben,
die sich widersprechen, und der letzte gewinnt. Nach der Korrektur des
Beispiels kamen im selben Lauf zwei bis drei Quellen und echte
Begründungen.

## `node --check` sieht keinen Scope-Fehler

`_renderQuellen` und `_renderSrcLink` in `ki-miete.js` benutzten `_esc`.
`_esc` war **innerhalb** von `runKiMiete()` definiert, die neuen Funktionen
standen daneben auf Modulebene. `node --check` meldete `OK`.

Syntaktisch war die Datei tadellos; zur Laufzeit hätte die erste Quelle
einen `ReferenceError` geworfen. Die Datei hat kein IIFE, also sieht man
den Unterschied nicht an der Einrückung allein — man muss die Klammern
zählen.

**`node --check` beweist, dass die Datei geparst werden kann, sonst
nichts.** Wer eine Hilfsfunktion aus einer bestehenden Funktion
mitbenutzt, prüft zuerst, wo sie definiert ist.

## Eine Sperrliste von Portalen kann man nicht fertigschreiben

Die KI-Mietrecherche lieferte eine kommerzielle Preisstatistik unter dem
Namen „Mietspiegel Hüllhorst 2026". `v1242c` sperrte `immoportal`; der
nächste Lauf brachte `immobilienscout24`, der übernächste
`miete-aktuell.de`, der dritte `ohne-makler.net`.

**Es gibt beliebig viele Portale und je Ort genau eine amtliche Stelle.**
`v1242e` dreht die Frage um: nicht „ist das ein bekanntes Portal?",
sondern „*kann* dieser Host überhaupt amtlich sein?" — trägt er den
Ortsnamen (`huellhorst.de`, `kreis-minden-luebbecke.de`) oder gehört er zu
einer amtlichen Stelle (IHK, `bund.de`, destatis, IT.NRW)? Elf Testfälle,
elf Treffer.

> Fachlich dahinter: ein Mietspiegel ist nach §§ 558c/558d BGB eine
> Übersicht der ortsüblichen Vergleichsmiete, erstellt von der Gemeinde
> oder gemeinsam von den Interessenvertretern. Eine Portal-Preisstatistik
> ist das nicht, egal wie ihre Seite heißt.

## Ein Skript-Klick auf eine Objektkarte legt ein neues Objekt an

Gemessen am 07.09.2026: `document.querySelectorAll('.sb-card')[0].click()`
lud die Daten von `2026-001` in das leere Startformular, und der Auto-Save
speicherte sie als **neues** Objekt `2026-1011` (Version 1, DSCR 0).

Der Gegentest mit einem echten Mausklick auf dieselbe Karte: die Anzahl
blieb bei zehn, kein neues Objekt. **Kein Produktfehler, ein
Messartefakt** — dieselbe Familie wie „script-getriebenes Füllen feuert
kein `change`".

**Wer im Browser misst, klickt echt.** Und wer per Skript geklickt hat,
zählt hinterher die Objekte, bevor er einen Fehler meldet — oder
Testdaten hinterlässt.

## Ein Häkchen, das „gefüllt" heißt, liest sich als „geprüft"

`workflow.js` setzte den Haken am Reiter, sobald alle Pflichtfelder der
Gruppe einen Wert hatten. Beim Steuer-Reiter besteht die Gruppe aus einem
einzigen Feld — `grenz`, vorbelegt mit 42 %. Der Kommentar sagt es seit
V63.29 selbst: *„hat einen Default-Wert der schon beim Init steht"*.

**Der Bereich war also abgehakt, bevor jemand hingesehen hatte** — und
genau das hat der Tester gefragt: „Warum sind hier oben schon Haken,
obwohl ich in den Bereichen noch nicht war?"

**Eine Zustandsanzeige muss sagen, was sie meint.** `v1243` trennt beides:
hohler Haken = gefüllt, aber nie geöffnet; voller Haken = geöffnet. Der
Merker liegt je Objekt im `localStorage` — fällt er weg, stehen die Haken
wieder hohl. **Die Richtung des Zweifels gehört auf die vorsichtige
Seite.**

## Zwei DOM-Felder, in die seit V258-07 niemand schreiben konnte

`calc.js:2165–2186` befüllt bei jedem Lauf `cr-wk-other` und
`cr-zve-ohne`. Beide gibt es in **keiner** HTML-Datei, und
`getElementById` liefert im laufenden Browser `null`.

Der Hook wirft nichts — `if (wkEl)` fängt es ab. Er tut nur nichts. Die
Absicht (Werbungskosten der anderen Objekte anzeigen) ist nie angekommen,
und der `try/catch` drumherum hätte es auch dann verdeckt.

**Ein `if (el)` vor dem Schreiben schützt vor dem Absturz, nicht vor der
Wirkungslosigkeit.** Wer eine Anzeige baut, prüft im Browser, ob das Ziel
existiert — `grep` über die HTML-Dateien genügt schon.

## Eine CSS-Regel, die nicht greift, gehört raus statt durchgedrückt

`v1243` setzte `.tab.tab-wf-done-ungeprueft .tab-lbl { color: … }`. Der
Kaskaden-Walker zeigte: `nav.tabs .tab .tab-lbl` setzt die Goldfarbe
**dreimal mit `!important`**. Ein eigenes `!important` hätte gewonnen.

**Es wäre trotzdem falsch gewesen.** Der Reiter-Text ist bei *jedem*
Reiter gold, auch bei den hakenlosen — ein blasserer Text hätte nicht
„ungeprüft" bedeutet, sondern nur Unruhe in die Leiste gebracht. Die
Regel fiel weg, der Unterschied blieb am Haken.

**Bevor man Spezifität erhöht, prüft man, ob die Regel überhaupt das
Richtige aussagt.**

## Eine `function` im Prüfskript überschreibt die App

Teuerste Falle des `v1244`-Zyklus, und sie kostete eine falsche
Fehlermeldung. Meine Messskripte enthielten mehrfach diese Bequemlichkeit:

```js
function v(id){ var e=document.getElementById(id); return e? e.value : null; }
```

**Eine Funktionsdeklaration auf oberster Ebene des Prüfskripts ist
global** — und `calc.js:59` heißt ebenfalls `v()`. Ab dem ersten solchen
Skript lieferte `v('kp')` einen String statt einer Zahl. In `calc.js:756`
steht `var gi = kp + nk + …`, also wurde aus 200000 + 20400 die
Verkettung `"20000020400"`. `State.gi` war ein String, `calc()` warf
später `n.toFixed is not a function` und brach mitten im Lauf ab.

**Ich habe das als Produktfehler diagnostiziert.** Mit
wiederhergestellter `v()` steht dort 220400 als Zahl — es war keiner.
Ausdrücklich zurückgenommen.

**In Prüfskripten nie `function name(){}` auf oberster Ebene.** Entweder
alles in ein `(function(){ … })()` packen oder Namen wählen, die die App
nicht kennt. Die App hat kurze globale Helfer: `v`, `g`, `el`, `st`,
`sv`, `fE`, `fP`, `calc`. Jeder davon ist mit einem Einzeiler zerstörbar.

> Dieselbe Familie wie „ein Prüfer, der nicht dieselben Quellen lädt wie
> die laufende Maschine, misst sich selbst" — hier hat der Prüfer die
> Maschine nicht nur gemessen, sondern verstellt.

## Ein Wrapper, der fremde Marker verschluckt, lädt zum Doppelwrappen ein

`window.calc` ist in DealPilot **zweimal** umhüllt: `financing.js:576`
(zieht `dpFinancingRefresh` nach) und `deal-action-readycheck.js:208`
(v450). Das zweite prüft an seinem Marker `_v450Wrapped`, ob es schon
gewrappt hat — und **kopiert die Eigenschaften der alten Funktion auf die
neue**, damit fremde Marker erhalten bleiben.

Mein `v1244`-Wrapper tat das nicht. Er hätte `_v450Wrapped` unsichtbar
gemacht; der nächste Lauf von `wrapGlobal` hätte ein zweites Mal gewrappt
und `refresh()` doppelt gefeuert.

**Wer eine globale Funktion umhüllt, überträgt ihre Eigenschaften mit.**
`deal-action-readycheck.js` zeigt das Muster.

> Und ein `grep` nach `window.calc = function` findet diese Wrapper
> nicht: beide schreiben `var alt = window.calc; window.calc = function`
> über mehrere Zeilen. Wer wissen will, wie oft etwas umhüllt ist, liest
> den Stack einer echten Exception.

## Wenn das Klick-Werkzeug nichts mehr zustellt, meldet es trotzdem Erfolg

Vier Klicks hintereinander luden kein Objekt. Ich habe zuerst die
Koordinaten verdächtigt (`devicePixelRatio` war 0,9) und umgerechnet —
ohne Wirkung.

**Die Diagnose kam erst aus einem Protokoll in der Seite:**

```js
document.addEventListener('click', function(e){ window._klickLog.push({x:e.clientX,y:e.clientY}); }, true);
```

Das Protokoll blieb **leer**. Die Klicks kamen gar nicht an, obwohl das
Werkzeug jedes Mal „Clicked at (166, 219)" meldete. Ein neuer Tab half
nicht. Vorher war schon ein `zoom` mit „renderer may be frozen"
gescheitert — das war das erste Anzeichen.

**„Clicked at …" heißt: der Befehl wurde abgesetzt, nicht: die Seite hat
ihn bekommen.** Wer im Browser über Koordinaten bedient und keine Wirkung
sieht, protokolliert zuerst im DOM, ob der Klick ankommt — bevor er
Koordinaten, Zoomfaktoren oder Layout verdächtigt.

## Eigenkapital und Darlehen waren zwei unabhängige Zahlen

Gemessen am 07.09.2026 im Finanzierungs-Tab:

| | EK | Darlehen |
|---|---|---|
| vorher | 20.000 | 180.000 |
| EK auf 99.000 gesetzt | 99.000 | **180.000** (unverändert) |
| Darlehen auf 150.000 | **20.000** (unverändert) | 150.000 |

Und im gespeicherten Zustand von `2026-001`: Gesamtinvestition 220.400 €,
Eigenkapital plus Darlehen 200.000 €. **Die Erwerbsnebenkosten waren
weder finanziert noch als Eigenkapital eingetragen** — und nichts sagte
es. Die EK-Rendite rechnete weiter auf 20.000 € statt auf 40.400 € und
sah deshalb zu gut aus.

`v1244` zeigt die Deckung offen und schließt sie auf Wunsch über das
Eigenkapital oder über das Darlehen.

**Zwei Eingabefelder, die zusammen eine dritte Größe ergeben müssen,
brauchen eine Gegenprobe.** Sonst ist jede Kennzahl darüber
unwidersprochen falsch.

## Einen Zahlen-Parser gibt es schon — `parseDe()`

`v1244` baute sich in `financing.js` einen eigenen:

```js
String(e.value).split('.').join('').replace(',', '.')
```

Der behandelt **jeden** Punkt als Tausendertrenner. `"180.000"` wird
richtig zu 180000, `"0.75"` aber zu **75** — dem Hundertfachen.
Aufgefallen erst beim Messen der Bewirtschaftungsquoten, wo `bwk_kp_pct`
auf `0.75` steht.

Für Eigenkapital und Darlehen wäre es nie aufgefallen, weil dort ganze
Eurobeträge stehen. **Genau deshalb ist es gefährlich: unsichtbar bis zum
ersten Dezimalpunkt.**

`parseDe()` aus `calc.js:9` unterscheidet richtig — ein Punkt mit exakt
drei Folgeziffern ist ein Tausendertrenner, sonst ein Dezimaltrenner —
und kennt deutsche wie amerikanische Schreibweise. Sie ist global
verfügbar.

**„Rechenkerne nie duplizieren" gilt auch für Parser.** Vor jeder eigenen
Zahlenumwandlung nachsehen, ob die App schon eine hat.

## Der Auto-Save schreibt jeden Moduswechsel mit

Ein `switchBwkMode('percent')` zum Prüfen einer Anzeige genügte, damit
der Auto-Save neun Sekunden später das Objekt speicherte — mit der
Prozentquote statt den Detailpositionen. Der Score fiel von 84 auf 83,
weil die Quote 3.960 € BWK ergibt und die Detailpositionen 4.940 €.

Zurückgestellt und erneut gespeichert, dann stand wieder 84.

**Wer an einem fremden Objekt misst, zählt vorher, was sich ändern kann,
und stellt es hinterher nachweislich zurück** — in der Datenbank, nicht
nur im Formular. Der Auto-Save unterscheidet nicht zwischen einer
Messung und einer Eingabe.

## Der Zweig wird vor dem Commit geprüft, nicht erst beim Ausrollen

Nach einem Prod-Rollout blieb das Arbeitsverzeichnis auf `main` stehen.
Die nächsten zwei Änderungen landeten dort statt auf `staging`.

**Gefangen hat es `deploy-staging.ps1`** mit „ABBRUCH: Lokaler Zweig ist
'main', erwartet 'staging'". Der Commit war noch nicht gepusht;
`git cherry-pick` auf `staging` und `git branch -f main <letzter
gepushter Stand>` haben es geradegezogen, Inhalt bitgleich geprüft
(`git diff --stat` leer).

**Nach jedem Prod-Rollout zurück auf `staging` wechseln.** Und: die
Zweig-Sperre im Deploy-Skript ist seit `v3b` wirklich aktiv — sie hat
hier zum ersten Mal etwas verhindert.

## Eine Datei, zwei Kopien — `promo-erstflug.js`

Der Kopfkommentar sagt „EINE Datei, zwei Ansichten". Tatsächlich liegt sie
**zweimal**: `frontend/js/promo-erstflug.js` und
`frontend/landing/promo-erstflug.js`, bitgleich bis auf die Zeilenenden.

Wer nur eine ändert, schaltet den Rabatt auf der Landing ab und lässt ihn
in der App stehen — oder umgekehrt. Der Vergleich braucht
`diff --strip-trailing-cr`; ein normales `diff` meldet **jede** Zeile als
verschieden, weil die eine Fassung CRLF trägt und die andere LF, und
`md5sum` sagt dasselbe.

**Vor jeder Änderung an einer Datei, die „für Landing und App" im Kopf
trägt: nachsehen, ob es sie zweimal gibt.**

## Ein Limit, das nichts begrenzt, ist eine Behauptung

`max_saves: 3` stand seit V63 in `config.js`, wurde in den Einstellungen
als „Max. 3 Speicherungen" angezeigt und auf allen Preiskarten genannt.
**Kein einziger Prüfcode liest den Wert** — `grep` findet nur die
Definition, die Anzeige und eine Zuweisung im Reseller-Portal.

Aufgefallen ist es nicht beim Zählen, sondern weil Marcel sich nichts
mehr darunter vorstellen konnte: *„Da kann ich mir gerade gar nichts mehr
darunter vorstellen."*

**Wenn ein Leistungsversprechen niemandem mehr erklärbar ist, ist die
erste Frage nicht wie man es erklärt, sondern ob es überhaupt etwas
tut.**

## `if(!x) return;` am Anfang kappt alles danach

Der Landing-Block „Flugklassen" begann mit
`var g=document.getElementById('fkGrid'); if(!g) return;`. `#fkGrid` gibt
es im HTML nicht mehr — der Block war also tot. **Und mit ihm alles, was
danach im selben IIFE stand:** der Feature-Phasen-Wechsel darunter lief
nie, `#luFeat` hatte vier Phasen und keine trug die Klasse `d`. Nach dem
Entfernen sind es zwei.

**Ein früher `return` in einem gemeinsamen IIFE ist ein stiller
Abschalter für alle folgenden Aufgaben.** Wer eine Aufgabe aus einem
solchen Block entfernt, prüft, was hinter ihr steht.

> Dazu die zweite Hälfte: der tote Block trug einen **vollständigen
> Preis-Datensatz** (29/290, Kerosin-Liter) — eine zweite Wahrheit, die
> beim nächsten Wiedereinbau falsche Zahlen zurückgebracht hätte. Deshalb
> entfernt statt stehengelassen.

## Was ein Kauf gutschreibt, steht am Stripe-Preis — nicht im Code

`bewertungsKatalog.js` sagt es im Kopf: die Mengen stehen als
**Metadaten am Preis** (`dp_kind=bewertung_paket`, `dp_pack_sku`, `mpi`,
`mpi_plus`, `wev`). Der Grund ist gut — eine Price-ID gilt je Konto, ein
`lookup_key` heißt in Sandbox und Live gleich.

**Beim Anlegen neuer Preise wird das leicht vergessen.** Meine drei
Nachkauf-Preise (`v1246c`) hatten zunächst keine Metadaten. Der Kauf wäre
sauber durchgelaufen, hätte abgebucht — und **nichts gutgeschrieben**.
Kein Fehler, keine Meldung; `paketAusMeta()` gibt bei unbekanntem
`dp_kind` korrekt `null` zurück, und der Aufrufer bucht dann nichts.

**Ein neuer Stripe-Preis ist erst fertig, wenn seine Metadaten stehen.**
Die Gegenprobe ist der Katalog-Endpunkt, nicht die Preisliste:
`GET /api/v1/credits/bewertungen` muss `paket` mit den erwarteten Mengen
zeigen.

## Ein Türsteher, der drei Listen kennt, kennt die vierte nicht

`_buyCreditPack()` sucht den Schlüssel in `bewertungsPakete`,
`einzelkauf` und `aiCreditPackages`. `v1246` hat den Nachkauf **abgeleitet**
statt ihn in eine Liste zu schreiben — er stand in keiner der drei, und
jeder Klick wäre dort herausgefallen, **ohne dass je ein Netzwerkaufruf
entsteht**.

Genau das beschreibt `v1184` schon einmal für die Pakete. Die Falle war
noch da, nur an anderer Stelle: **wer eine neue Bezugsquelle einführt,
sucht alle Stellen, die die alten Quellen aufzählen.** `grep` nach dem
Namen der bekannten Liste findet sie.

## Die Billing-Portal-Konfiguration führt gar keine Preise

Notiert war: „ein Preis steht an DREI Stellen — `config.js` (Anzeige),
`plans` (Abbuchung), Billing-Portal (was der Kunde im Kundenportal
sieht)."

**Gemessen am 07.09.2026: die Portal-Konfiguration führt keine
`products`.** Stripe nimmt das Feld auch nicht an (drei Versuche, kein
Fehler, kein Effekt). Der Plan-Wechsel läuft in DealPilot über die eigene
Oberfläche mit `lookup_key`; das Portal zeigt nur Rechnungen,
Zahlungsmittel und Kündigung.

**Es sind also zwei Stellen, die gepflegt werden müssen** — plus das
Portal, *wenn* dort je ein Plan-Wechsel angeboten wird. Die alte Notiz
war nicht falsch, aber sie hat eine Pflicht behauptet, die es heute nicht
gibt.

## Eine neue SKU-Familie fällt durch jede Weiche, die SKUs aufzählt

`v1246` führte `nachkauf_starter|_investor|_pro` ein. In **einem** Paket
sind daran **zwei** Türsteher gescheitert:

1. **Frontend** — `_buyCreditPack()` sucht den Schlüssel in
   `bewertungsPakete`, `einzelkauf`, `aiCreditPackages`. Der Nachkauf
   wird abgeleitet und steht in keiner davon: jeder Klick wäre
   herausgefallen, **ohne dass je ein Netzwerkaufruf entsteht**.
2. **Backend** — `istBewertungsSku()` prüft gegen
   `^(paket_[a-z]+|mpi|mpi_plus|wev|avm_a|avm_b)$`. `nachkauf_starter`
   fiel durch, landete beim alten Kerosin-Weg und kam als
   `invalid_pack` mit HTTP 400 zurück.

Beide erst **nach** dem Anlegen der Stripe-Preise aufgefallen — Stripe
hatte sie, der Katalog führte sie, und der Kauf wäre trotzdem gescheitert.

**Wer eine neue SKU-Familie einführt, sucht alle Stellen, die SKUs
aufzählen** — Regexe, Listen, `switch`. `grep` nach einem *bestehenden*
SKU-Namen (`paket_kurz`) findet sie zuverlässiger als die Suche nach dem
neuen.

> `v1184` beschreibt genau diese Falle schon einmal, für die Pakete. Sie
> war nicht weg, sie stand nur eine Ebene tiefer.

## Ein Stripe-Testmodus ist kein zweites Konto

Die Kontoliste zeigt drei Einträge, es sind aber **zwei Konten**: das
Hauptkonto erscheint zweimal (live und Testmodus), dazu die separate
Sandbox.

Gemessen am 07.09.2026: im **Testmodus des Hauptkontos** liegen zwölf
Preise, **keiner mit `lookup_key`**. Der Code sucht ausschließlich über
Lookup-Keys — diese Umgebung kann er gar nicht bedienen. Sie ist echt
verwaist.

**Löschen lässt sie sich trotzdem nicht:** ein Testmodus gehört
untrennbar zum Konto. Löschbar wäre nur eine Sandbox — und die ist die,
die Staging benutzt.

**Wer „ein Konto zu viel" sieht, prüft erst, ob es eines ist.**

## Ein Kürzel ohne Titel erklärt nichts — auch nicht dem Fachmann

Sechs Felder trugen das Etikett `DS2`. Gemessen am 07.09.2026: **keines
hatte einen `title`.** Der Tester, DESAG-zertifizierter
Sachverständiger, fragte: *„DS2? Kein Informationsgehalt – muss das da
rein?"*

**Wenn der Fachmann an einer Stelle stutzt, versteht sie sonst
niemand.** Ein Kürzel im Interface ist eine Abkürzung für den, der es
gebaut hat — für alle anderen ist es Rauschen, bis es sich erklärt.

## Eine Überschrift, die ausschließen soll, muss die Ausnahme benennen

Der NHK-Block hieß *„Gebäudeart nach NHK 2010 · nur Häuser"*. Die
Auswahl darunter kennt nur freistehendes Ein-/Zweifamilienhaus,
Doppelhaus und Reihenmittelhaus — **kein Mehrfamilienhaus**.

Fachlich ist das richtig: die NHK 2010 kennen die Hausform nur bei Ein-
und Zweifamilienhäusern. **Aber „nur Häuser" schließt das
Mehrfamilienhaus gerade nicht aus** — es lädt dazu ein, es dort zu
suchen. Jetzt: „nur Ein- und Zweifamilienhäuser", mit einem Satz, der
sagt warum, und ausdrücklich, dass hier kein Feld fehlt.

> **Nebenbefund, gemessen über die Elternkette:** der Block hängt gar
> nicht an der Objektart. Er steckt allein in einem zugeklappten Bereich
> (`.v212-collapse-body`) und erscheint bei einer Eigentumswohnung
> genauso, sobald man aufklappt. Wer eine Fläche „nur für X" nennt, sollte
> sie auch nur bei X zeigen.
