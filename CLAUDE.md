# DealPilot — Arbeitsregeln

DealPilot ist eine deutsche PropTech-SaaS für Immobilien-Investitionsanalyse
(DACH). Betreiber: Marcel Junker, **Junker Solution** — Einzelunternehmen,
Kleinunternehmer § 19 UStG. **Keine UG.** Junker Immobilien, DealPilot und
Junker Digital sind Marken darunter.

Antworte auf **Deutsch**, im Du.

## Die vier Dateien, die die Arbeit steuern

| Datei | sagt |
|---|---|
| `CLAUDE.md` (diese) | **wie** gearbeitet wird — die Kurzfassung |
| `BACKLOG.md` | **was** ansteht |
| `FALLEN.md` | **wo** schon jemand hingefallen ist |
| `claude/projektanweisung-*.md` | **der Gesamtstand** — Produkt, Architektur, Geld, Daten, Server, Chronik |

Die Langfassung und Quelle für die Projektanweisung in der Claude-App liegt
in **`claude/`**. **Sie wird nach jedem Rollout fortgeschrieben** — Eintrag im
Rollout-Journal: Was · Commit · Nachweis · Rest. Neue Erkenntnisse in den
passenden Teil, **keine neue Datei mit neuem Datum** — nebeneinander erzeugen
sie Widersprüche.

**Es sind derzeit DREI Stände, weil zwei Chats parallel arbeiten:**

| Datei | Strang | Nummern |
|---|---|---|
| `claude/projektanweisung-hauptapp.md` | Haupt-App | v1148–v1172 |
| `claude/projektanweisung-marktbericht-20260812-abend.md` | Marktbericht | v1077–v1083b |
| `claude/projektanweisung-nachtrag-20260814.md` | Marktbericht | v1084–v1096a |

**Ein „Widerspruch" zwischen ihnen ist meist nur der andere Strang** — sechs
bekannte Scheinwidersprüche stehen am Ende des Nachtrags tabelliert. Das Rezept
zum Zusammenführen steht dort in Abschnitt 6.

> **Warum keine im Wurzelverzeichnis liegt:** Dort lagen am 14.08. zwei Dateien
> namens `PROJEKTANWEISUNG.md` — eine im Wurzel, eine in `claude/`. Eine Kopie
> ins Wurzelverzeichnis hat den Haupt-App-Stand überschrieben, und `cat >>`
> hängte stundenlang klaglos an die falsche Datei an. Wiederherstellbar war es
> nur, weil jeder Rollout committet wurde. **Alle Stände liegen jetzt in
> `claude/` mit sprechendem Namen.**

## Backlog und Vorlagen

**Backlog:** `BACKLOG.md`. Der oberste offene Punkt wird bearbeitet. Nach
Abschluss selbst nach "Fertig" verschieben, mit Datum und Commit-Hash,
und committen.

**Vorlagen:** `design/mockups/` zeigt den Zielzustand. Bei Layoutfragen dort
nachsehen statt raten. `design/logo/` enthaelt die Logo-Varianten.
Uebernommen wird die Gestaltung, nicht der Code — die Mockups sind Neubauten.
---

## Die fünf Regeln, die immer gelten

**1 · Erst messen, dann bauen.**
Struktur wird **nie angenommen, immer ausgelesen**. DOM per `outerHTML`,
Klassen aus `index.html`, Farbwerte per `getComputedStyle`, Marker per `grep`.
Zählen ist keine Messung: „das Token hat 133 Verwendungen" sagt nichts
darüber, *wo* es greift.

**2 · Ursache statt Symptom.**
Nach zwei bis drei Fehlversuchen: **STOPP**, Diagnose. Nicht weiterpatchen.
`getComputedStyle`, `getBoundingClientRect`, `elementFromPoint`.

**3 · Staging-first. Immer.**
Produktion wird nie direkt angefasst.

**4 · Fehler offen zugeben, besonders die eigenen.**
Eine falsche Diagnose wird **ausdrücklich zurückgenommen**, nicht
stillschweigend ersetzt. Wenn zwei gleiche Fehler hintereinander passieren,
ist die Sitzung zu lang — abschließen, übergeben, Schluss.

**5 · Große Pakete, keine Kleinstschritte.**
Ein Feature = ein Paket. Neuer Inhalt heißt **neue Versionsnummer** — nie
geänderten Inhalt unter altem Namen ausliefern, sonst halten Marker und
Cache-Buster den neuen Stand für den alten.

---

## Arbeitsweise

Marcel ist **nicht-technisch** und schreibt oft per Spracheingabe mit
Tippfehlern — **Intent parsen, nicht Wortlaut**. „ja weiter", „hau rein",
„ok los" heißt: ohne Rückfrage fortfahren.

Er ist **DESAG-zertifizierter Sachverständiger**. Bei Bewertungsfragen weiß er
es besser, bei Code nicht. Sagt er „das ist für mich Quatsch", genau hinsehen.

Optik, Produkt, Geld, Preise → **Demo-first oder nachfragen, nie raten.**

Terminal-Ausgaben unter ~40 Zeilen halten: filtern, zählen, kürzen.

---

## Deploy

- Frontend ist **volume-mounted** → `git pull` = sofort live, kein Rebuild
- Backend-Änderung → `docker compose -f docker-compose.prod.yml up -d --build`
- Neue Migration → Rebuild (Migrationen sind ins Image gebacken)
- Ausrollen auf Staging: `.\tools\deploy-staging.ps1`
- **Nach jeder JS/CSS-Änderung den Cache-Buster hochziehen**, sonst kommt sie
  im Browser nicht an
- **NIE** `git add -A` oder `git add .` — Dateien einzeln stagen
- **Nie committen:** `auto-save.js`, `docker-compose.prod.yml`, `Caddyfile`,
  `*.pre-*`, `patchesold/`
- Vor dem Commit: `git diff --cached --name-only` gegenlesen

## Server

| | |
|---|---|
| Staging | `root@116.203.214.11` · `/opt/dealpilot` · Zweig `staging` |
| Produktion | `root@157.90.117.167` (`DealPilot-Prod-neu`) · Zweig `main` · SSH mit **Schreibrecht** |

> **Hier stand bis zum 31.08.2026 „SSH read-only". Das stimmt nicht** —
> gemessen beim Prod-Rollout v1186: `git pull`, `docker compose build` und
> `pg_dump` laufen dort alle. Die Zeile hat eine falsche Sicherheit
> vermittelt: wer sie liest, hält einen Fehlgriff auf Prod für technisch
> unmöglich. **Er ist es nicht.** Der Schutz ist die Regel, nicht der
> Zugang: Produktion wird nur nach ausdrücklicher Freigabe angefasst, und
> vorher wird gesichert (`/root/backups/`, beide Datenbanken).

Getaggt wird **nur auf Staging**.
Host-Node ist 18, Container-Node 22.

**Zwei Datenbanken:**
- `dealpilot-postgres` (Haupt-DB), Migrationstabelle `schema_migrations`
- `dealpilot-mb-db` (Marktbericht, Schema `mb.`), Migrationstabelle
  `public._mb_migrations` — führt **Dateinamen**, keine Versionsnummern.
  **Steht in keinem Backup-Skript** → vor jedem Eingriff eigener `pg_dump`.

---

## Nicht anfassen

- **`frontend/dp-mobile-sw.js` und `frontend/mobile-demo.html`** — die
  Selbstabmeldung des alten Mobile-Service-Workers (v1118). Ein registrierter
  Service Worker liegt auf dem **Gerät**; er wird nur abgeräumt, wenn das Gerät
  die Seite noch erreicht. **Beide fallen zusammen oder gar nicht**, und erst,
  wenn jedes Gerät sie einmal gesehen hat.
- `calc.js` BSV `startMonth`/`startYear` ~Z.440 (V267-05-Crash)
- § 7b Sonder-AfA Wfl-Cap 4.000 €/m² (V227.1)
- `avm-section.js`, `qc-bridge.js` `qcpm`-Overlay
- `js/bmf-modal-v292.js` — die UI-Schicht des BMF-Modals. Wurde einmal
  fälschlich als „Leiche" gelöscht. **Nie wieder.**

**Handy-Sperre entfernt (v1118).** `js/mobile-redirect.js` (v970,
„MB1-hardblock") und MA35 sind weg, die normale Ansicht trägt das Handy
allein. `?nomobileblock` gibt es nicht mehr — bei 390 px wird direkt geprüft.
Die Vorlage der alten Mobile-Fassung liegt als
`design/mockups/dp-handy-mockup-ma.html`. **`dp_wl_cache` liest weiterhin
`ui-varianten.js`** für die Whitelabel-Sperre der Mandanten (v1111) — das ist
ein anderer Zweck, es darf nicht mitfallen.

## Rechenkerne — nie duplizieren

- **DSCR** → `window.Dscr.compute()` (BSV-Sparrate in ALLEN Callern)
- **KPI** → `DealKpis.compute()`
- **Score** → `DealScore.computeFromKpis()`
- **Sachwertfaktor** → nur über `lib/gutachterausschuss.js`, nie ein Modul direkt

## Namensräume nie mischen

`vNNN` Haupt-App · `MA` Mobile · `vNNN` Marktbericht · `P-NN`/`W-NN`
Reseller/Whitelabel · Landing nach Feature-Name · Admin `vNNN`

---

## Bekannte Fallen (teuer bezahlt)

### CSS
- **Die aktive Datei ist `frontend/css/style.css`** (36.929 Zeilen, 4.198
  `!important`, 226 Media-Queries auf 25 Breakpoints) — `index.html:38` lädt
  sie. **`frontend/style.css` wird von keiner Seite geladen und ist eine
  Leiche.** Token-Überschreibungen reichen **nicht** — farbtragende Flächen
  müssen **einzeln benannt** werden.
- Die dunkle Fassung hängt **nicht** an `--surface`/`--border`, sondern an
  später gesetzten, harten Regeln. `header.hdr`, `nav.tabs`, `aside.sidebar`.
- Ein heller Skin existiert bereits: `body.dp-chrome-hell`, 103 Regeln,
  API `window._dpDispSkin('hell'|'obsidian')`, Merker `dp_chrome_hell`.
- **Bei gleicher Spezifität gewinnt die spätere Regel.** Lieber Spezifität
  erhöhen als auf Ladereihenfolge bauen — aber **jeden Anker vorher im Browser
  auslesen**. `#app` gibt es in dieser App **nicht**; eine Regel mit diesem
  Anker greift nirgends und sieht dabei plausibel aus (kostete v1147 einen
  ganzen Ausrollzyklus).
- **Welche Regel gewinnt, sagt nur der Kaskaden-Walker**, nicht `matches()`.
  Blinde Flecken: ID-Selektoren, Kurzschriften (`background:` wird nicht zu
  `background-color` expandiert), Pseudoelemente. Details in `FALLEN.md`.
- **`:not(#id)` erbt ID-Spezifität** — nie Sammelregeln auf Container-Kinder.
- **Flex-Kinder in `overflow:auto`-Containern schrumpfen, statt zu scrollen.**
  Der Inhalt wird dann still abgeschnitten → `flex:0 0 auto` setzen.
- **`align-items:center` lässt leere `::before`-Pseudoelemente auf null Höhe
  schrumpfen** → `align-self:stretch`, sonst ist der Verlauf unsichtbar.
- `var()` funktioniert **nicht** in: SVG-Präsentationsattributen, Canvas,
  Leaflet, jsPDF, Data-URIs.

### JavaScript
- **`_euro(null)` ergibt `"–"` und ist damit truthy** — nie `||`-Fallback.
- **`Number(null)` ist 0 und besteht `Number.isFinite`** — erst auf
  Abwesenheit prüfen, dann rechnen.
- Baujahr und Jahreszahlen nie durch `Intl.NumberFormat`.
- `window._currentObjKey` ist die einzige verlässliche Objektreferenz.
- `Auth.apiCall` stringifiziert selbst; `getApiBase()` enthält `/api/v1`.
- **Nacktes `fetch` umgeht den zentralen 401-Handler.**
- `dp:plan-ready` (`subscription.js:154`) statt Timer oder Polling.
- **Unbekannter Feature-Schlüssel = für jeden `false`**, auch für Pro.

### Struktur der Objektkarte (gemessen, nicht angenommen)
```
.sb-card
  .sbc-score-overlay          <- DIREKTES Kind der Karte
    .sbc-mini-score (Ring-SVG + .sbc-mini-score-num)
    .sbc-score-label
  .sbc-top
    .sbc-thumb (.sbc-thumb-empty > .sbc-thumb-icon | .sbc-thumb-photo)
    .sbc-top-body
      .sbc-top-line1 (.sbc-seq .sbc-ai-badge .sbc-ds2-hint .sbc-arrow)
      .sbc-address
      .sbc-halter
      .sbc-kp-row > .sbc-kp   <- der PREIS
  .sbc-mini-grid              <- BEHÄLTER der drei Kacheln
    .sbcm[data-mode] x3       <- die Kacheln
  .sbc-actions                position:absolute
```
Gebaut wird sie in `js/storage.js` von `_renderRichCard()` ab Z.866.

### Bash und Node
- `grep -q X && { exit 1; }` bricht unter `set -e` ab, wenn grep **nichts**
  findet — also im guten Fall. Die if-Form tut das nicht.
- `grep -c` mit null Treffern gibt Rückgabewert 1 → `|| true`.
- **`grep -q` in einer Pipe kappt die Pipe** — der Sender stirbt an
  `BrokenPipeError`. Ausgabe erst in eine Datei, dann zählen.
- Marktbericht-Backend ist **ESM** → `package.json` mit `{"type":"module"}`
  in jede Arbeitskopie unter `/tmp`.
- `node --check` prüft nur Syntax. **Verträge prüft nur ein echter Lauf.**
- `.env` lässt sich **nicht** mit `source` einlesen. `$` im Wert → `$$`.
- `docker compose up -d` erzeugt den Container **nicht** neu, wenn sich die
  Konfiguration nicht geändert hat → `--force-recreate`. `printenv` **im**
  Container ist die Wahrheit.
- Kein `#` in Einzeiler-Pastes, kein `!` in doppelten Quotes.

---

## Marke und Design

**Farben:** Obsidian `#050505` · Gold `#C9A84C` mit `#E8CC7A` hell und
`#b8932f` dunkel · Grün `#3FA56C` · Rot `#B8625C` / `#D8564C` ·
Creme `#FDFCFA` · Karte `#FBF6E9`.
Runway: `linear-gradient(110deg, #E8CC7A, #C9A84C 55%, #b8932f)`.
**`--ch=#2A2727` nie auf Obsidian.**

**Schriften:** Space Grotesk (Display) · JetBrains Mono (Mono/Labels) ·
Inter (Body) · Cormorant Garamond (Serif).

**Bildsprache Luftfahrt durchgehend:** Kerosin (KI-Guthaben) · Cockpit ·
Boarding / QuickBoarding · Co-Pilot · Runway · Pre-Flight · Score-Dial.

**Score-Stufen — die Kette der Objektkarte gilt** (`js/dashboard.js:390`):

| Score | Stufe |
|---|---|
| ≥ 85 | **TOP** |
| ≥ 70 | **GUT** |
| ≥ 50 | **SOLIDE** |
| ≥ 35 | **SCHWACH** |
| < 35 | **KRITISCH** |

Auf der Karte als Versalien-Pille, in Fließtext und Überschriften in
Kamelschrift (`Top`, `Gut`, …). **Die Schwellen sind überall dieselben** —
auch die Farbketten (`top` / `green` / `gold` / `red`) brechen bei
85 / 70 / 50.

> **Hier stand bis zum 02.09.2026 „STARK / SOLIDE / SCHWACH bei ≥ 70 /
> ≥ 50 / < 50".** Das war weder die Karte noch sonst eine Stelle im Code:
> „STARK" kommt als Score-Stufe nirgends vor, und die vierte und fünfte
> Stufe fehlten ganz. Gefunden, als der Marktbericht am selben Score
> zweimal ein anderes Wort zeigte (`v1203`). **Marcels Entscheidung: es
> gilt, was die Haupt-App tut.**
>
> **Zwei Abweichungen sind gemessen und noch offen:**
> `js/dashboard.js:1283` sagt `Sehr gut / Gut / Solide / Schwach` (vier
> Stufen, „Sehr gut" statt „TOP"), und der Marktbericht-Backend
> (`ScoringService`) führt ein eigenes Vokabular `Sehr attraktiv /
> Attraktiv / Durchschnittlich / Unterdurchschnittlich`, das seit `v1203`
> **nicht mehr angezeigt** wird. Beide gehören noch angeglichen.

### Whitelabel-Pflicht
Jedes Gold-Literal steht als `var(--wl-<hex>, #<hex>)`. Tokens stehen in
**keinem** `:root`; nur `whitelabel-override.js` setzt sie.
`DealPilotWhitelabel.apply()` setzt `--gold`, `--gold-hi/-lo/-l/-2/-3/-bg/-d/-soft`,
`--obsidian` und 25 `--wl-<hex>`-Tokens am `<html>`.
Vor jedem Rollout: `python3 tools/gold-audit.py`, RC=0 ist sauber.
**Statusfarben nie tokenisieren** — Grün und Rot bleiben in jeder Marke gleich.

**Anbieter-Neutralität:** Sprengnetter und PriceHubble nie namentlich nach
außen — „unabhängige Bewertungspartner". ImmoMetrica darf genannt werden.

---

## Wertermittlung (Marktbericht)

**Modellkonformität ist das Leitprinzip** (§ 10 ImmoWertV). Jeder Parameter
trägt einen Modellvermerk.

**Der Prüfmaßstab ist das Anwendungsbeispiel des amtlichen Dokuments** — nie
eine selbst ausgerechnete Zahl.

- **Kein Verfahren rechnet halb.** Fehlt eine Pflichtangabe, erscheint das
  Verfahren nicht.
- **Wo die Quelle endet, endet die Rechnung.**
- **Kein Treffer heißt kein Wert** — nie ein Nachbarkreis, nie ein Landesmittel.
- Jede Zahl trägt Herkunft: Stufe A–E, Modellvermerk, `indikativ`, Ausschuss.
- Eine Restnutzungsdauer für alle Verfahren.
- BWK-Quoten stehen auf dem **gesamten** Rohertrag inklusive Stellplätzen.
- Verwaltungskosten je **bewerteter** Einheit.
- ETW ohne Miteigentumsanteil: **kein** Bodenwert.
- Nur der **rentierliche** Bodenwert wird verzinst (§ 41).

**Testobjekte für jede Prüfstrecke:**
- **Hüllhorst**, Hermannstr. 9, 32609, ETW 165 m², Bj 1968 — Sachwert
  305.937 / 348.687 €, Zinsanpassung 2,56 %, Miete 4,83 €/m²
- **Löhner Str. 278**, 32120 Hiddenhausen, ZFH 233 m², Bj 1964 —
  Verkehrswert 350.094,36 €, BGF 346,62 m², Bodenwert 144.840 €

> **Der Prüfmaßstab ist der DATENSATZ, nicht die Adresse.** Das Objekt
> `2026-001` in der App trägt dieselbe Anschrift wie das Testobjekt Hüllhorst,
> aber **andere Werte**: ETW **100 m²**, Bj **1962**, Grundstück 950 m² plus
> 828 m² Hinterland, MEA 50 %. Gemessen am 03.09.2026 rechnet es Sachwert
> **242.274 €** und amtliche Miete **4,89 €/m²** — beides korrekt für *diese*
> Angaben, beides weit weg von den Zahlen oben. Wer `2026-001` lädt und gegen
> die Zeile darüber prüft, findet eine Abweichung, die keine ist. **Die
> Mietpreisübersicht staffelt nach Fläche und Baujahr** — 4,83 gegen 4,89 ist
> genau dieser Effekt, kein Fehler.
>
> Nachgerechnet und in Ordnung (Bericht 83, Stufe 3): der Ertragswert-
> Rechenweg Zeile für Zeile bis 193.940 €, der Sachwert-Rechenweg bis
> 242.274 €, der Bodenwert 950 × 90 + 828 × 5, −10 % Lärm, × 50 % MEA
> = 40.338 €. Die BWK-Quote steht auf dem **gesamten** Rohertrag inklusive
> Stellplätzen, wie es sein muss.

---

## Auslieferung von Paketen

- **`apply.sh` = alles oder nichts:** Kopien unter `/tmp` patchen, alle
  Prüfungen, dann tauschen.
- **Anker:** Python `str_replace` mit `count == 1` — Fehltreffer bricht ab,
  nichts wird geschrieben. **Pfadbasiert routen, nicht per basename.**
- **Marker sagen „hier war ich", nicht „hier ist alles gut."** Marker gehören
  in Kommentare, **nie in Nutztext**.
- **Backups `.pre-<paket>` nur anlegen, wenn keins existiert** — nie
  überschreiben.
- **Rollback über `git checkout --`**, nicht über die Backups.
- **Prüfstrecke vor jeder Auslieferung:** `node --check`, Doppellauf muss
  `skip` melden, echter Funktionslauf gegen das Anwendungsbeispiel,
  Kettenprüfung (kommt der Wert an?), Klammerbilanz.
- **Beweisen statt behaupten.** Untestbares ehrlich als Staging-Abnahmepunkt
  kennzeichnen.

## Arbeitsmodus — durchziehen statt nachfragen

**Standard ist: machen.** Nicht fragen, ob gebaut werden soll — bauen,
ausrollen, prüfen, nachbessern, bis es steht.

Der Kreislauf pro Aufgabe:
1. Messen (DOM, Konsole, getBoundingClientRect) und den Befund nennen
2. Ändern
3. `.\tools\deploy-staging.ps1`
4. Im Browser nachmessen, ob es wirklich wirkt
5. Bei Abweichung: zurück zu 1 — **nicht** fragen, ob weitergemacht werden soll

Erst melden, wenn es **funktioniert** oder wenn du **nicht weiterkommst**.
Zwischenstände nur, wenn ein Befund die Richtung ändert.

**Nachfragen nur bei:**
- Produktion, Datenbank-Eingriffen, Geld, Preisen, Kündigungen
- Optik und Produktentscheidungen ohne klare Vorgabe → Demo bauen und zeigen
- Etwas aus „Nicht anfassen" müsste angefasst werden
- Nach drei erfolglosen Anläufen: STOPP, Diagnose, melden

**Nicht nachfragen bei:** Datei-Änderungen im Repo, Commits, Ausrollen auf
Staging, Messen im Browser, Zwischenversionen. Das ist der Auftrag.

Staging darf kaputtgehen. Dafür ist es da.
