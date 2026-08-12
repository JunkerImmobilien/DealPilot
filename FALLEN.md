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
