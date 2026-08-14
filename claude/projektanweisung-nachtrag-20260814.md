# PROJEKTANWEISUNG — NACHTRAG VOM 14.08.2026 (Marktbericht-Strang)

**Herkunft:** Marcel, aus dem Marktbericht-Chat. Wortgetreu übernommen, damit
der Stand nicht in einem Chatverlauf hängt.

> **Diese Datei ersetzt die Gesamtfassung vom 12.08. NICHT.** Sie ist ein
> Nachtrag und benennt für jeden Punkt, **welchen Abschnitt der Gesamtfassung
> er ändert**. Beide zusammen sind der gültige Stand.
>
> **Warum kein neuer Gesamtstand:** die Fassung vom 12.08. ist rund 2.700
> Zeilen. Sie neu zu schreiben hieße, sie aus dem Gedächtnis zu
> rekonstruieren — und genau davor warnt sie selbst („rekonstruierte
> Arbeitskopien gegen die Marker prüfen").

---

## WICHTIG ZUM VERSTÄNDNIS DER DREI DATEIEN

**Es gibt zwei Dokumentationsstränge, und sie beschreiben verschiedene Dinge.**
Das ist kein Versehen, sondern folgt den Namensräumen aus Teil II:

| Datei | Strang | Nummern | Inhalt |
|---|---|---|---|
| `claude/projektanweisung-marktbericht-20260812-abend.md` (2.605 Z.) | Marktbericht | v1077–v1083b | Register, Wertermittlung, Ernte, amtliche Daten |
| **diese Datei** | Marktbericht | v1084–v1096a | Fortschreibung dazu |
| `PROJEKTANWEISUNG.md` (im Repo) | **Haupt-App** | **v1148–v1172** | Darstellung, Profile, Plan-Gate, Spracheingabe, Marktbericht-**Oberfläche** |

**Der Nachtrag nennt den anderen Strang ausdrücklich:** *„der Parallel-Chat
v1158–v1171 (Hell/Dunkel, Spracheingabe, Plan-Gate, Beleg-Import)"* — das ist
`PROJEKTANWEISUNG.md`. **Beide sind mit `74ae2e3` auf Prod.**

**Wer konsolidiert, führt drei Quellen zusammen, nicht zwei.** Das Rezept in
Abschnitt 6 nennt nur die ersten beiden — es ist um `PROJEKTANWEISUNG.md` zu
ergänzen.

---

# 1 · WAS SICH AM STAND GEÄNDERT HAT

## ersetzt TEIL II, Tabelle „WORKSTREAMS / NAMESPACES"

| | Namespace | Prod-Stand **14.08.2026** |
|---|---|---|
| **(D) Marktbericht** | `vNNN` | **`74ae2e3`**, Tags `rollout-20260814` · `marktbericht-v1096a-20260814` · **Prod-Anker `2165738`** |

Alle übrigen Zeilen unverändert.

**Die zwei Nummernkreise laufen weiter:** der Marktbericht-Chat vergibt
v1084–v1096a (Register, Auswerter, Abnahme), der Haupt-App-Chat v1158–v1171
(Hell/Dunkel, Spracheingabe, Plan-Gate, Beleg-Import) — **inzwischen bis v1172**,
siehe `PROJEKTANWEISUNG.md`. **Beide sind mit `74ae2e3` auf Prod.**

## ersetzt TEIL I, Regel 1 — die Marker-Übersicht

Die Erwartungsliste vom 12.08. ist überholt. Neuer Sollstand:

```
swf_modelle.js          v1083-WMOD v1084-WEIN v1085-WBND v1085-WZUO v1085-WOFF
                        v1088-WKAT v1088-WREG v1089-WBND1
                        v1093-WLOG v1093-WSPN v1093-WMUL
                        v1094-WEUR v1094-WKAB
gutachterausschuss.js   v1083-WKAS v1084-WSWF v1084-WFELD v1084-WZWG
                        v1085-WKAS v1085-WVOL v1085-WLFN v1086-WBPN v1087-WMKT
                        v1088-WBJ v1089-WART v1089-WART2
                        v1093-WSPN2 v1093-WJG v1094-WKZ v1096a-WVOK
ausschuss_register.js   v1083-WREG v1083a-WLAZ v1084-WSAAT v1084a-WMRG
                        v1093-WSTD v1095-WMRG2   + 11 Saatdateien
nrw_modell.js           v1083b-WSTU v1090-WSCH
routes/api.js           v1096-WPRB
server.js               v1084a-WBOOT v1095-WMRG2
```

**Neu und wichtiger als die Marker-Liste: die Abnahme läuft per Befehl.**
Siehe Abschnitt 3.

## ersetzt TEIL III, „DAS AUSSCHUSS-REGISTER"

**Aus „493 Datensätze, eine Kennzahl, ein Land" sind 2.150 Datensätze,
sieben Kennzahlen und acht Bundesländer geworden.**

```
[register] 2150 Saetze, 525 Gebiete, Herkunft param_modell+saatdatei
liegenschaftszinssatz 1078 · bodenpreisniveau 403 · durchschnittspreis 386
preisentwicklung 215 · sachwertfaktor 52 · erbbauzinssatz 15 · bodenpreisindex 1
NW 1109 · NI 41 · BE 2 · ST 2 · TH 2 · HE 2 · BB 2 · BY 1   (Schlüssel)
```

Der vollständige Abdeckungsbericht steht in
**`claude/abdeckung-laender-kreise-20260814.md`**.

## ersetzt TEIL III, „Neun Modellformen, acht Auswerter"

Es sind **zwölf Modellformen**. Neu seit dem 12.08.:

| Form | Ausschuss | Besonderheit |
|---|---|---|
| `stufen_kategorial` | Erfurt, Hameln-Hannover | Kategorienachse statt stetiger Achse |
| `regression_additiv` | Kreis Olpe, Halle | Intercept + Terme mit Koeffizient und Exponent |
| `baender_1d` | München, Wiesbaden, Krefeld | eine Achse in Klassen, **ohne** Interpolation |
| `log_1d` | Worms | `Y = a·ln(x) + b`, eine Achse, ein Logarithmus |
| `spanne_kategorial` | Saarbrücken | liefert **absichtlich keinen Wert**, nur die Spanne |

**`spanne_kategorial` ist kein Widerspruch, sondern die Umsetzung der
Projektregel.** Ohne sie meldete der Auswerter `form_unbekannt` — eine Aussage
über sich selbst. Mit ihr meldet er `nur_spanne` — eine Aussage über die Quelle.

**Korrekturen können jetzt multiplikativ wirken.** Kiel druckt `× 0,89 × 1,16`
statt `+`. Das Feld heißt **`wirkung`**, nicht `art` — `art` ist seit v1083 mit
der FORM der Korrekturtabelle belegt (`band` gegen Stufentabelle). Zwei
verschiedene Dinge, ein Name; der Wandler trennt sie.

**Euro-Beträge bekommen ihre Korrekturen** (`v1094-WEUR`). Bis v1093 sprang
`auswerten()` bei `liefert: 'wert_eur'` sofort zurück.

---

# 2 · NEUE REGELN — ergänzt TEIL I

## Regel 6 · Eine Auskunft, die einen anderen Weg nimmt als der Rechenweg, misst sich selbst

Zweimal an einem Tag gestolpert:

```
swf-abfrage --stand      meldete 2150      der Server führte 1565
registerStand() im       meldete 2150      derselbe Fehler, anderer Weg
docker exec node -e
```

Beide starten einen **eigenen** Node-Prozess, lesen nur die Saatdatei und rufen
`ladeAusDb()` nie auf. **Die ehrliche Zahl steht im Startlog oder kommt aus dem
Endpunkt** (Abschnitt 3).

Dieselbe Klasse wie die Kettenprüfung aus v1083, die ihre Vorbedingung selbst
herstellte. **Wer eine Auskunft baut, prüft zuerst, ob sie denselben Weg nimmt
wie die Rechnung.**

## Regel 7 · Ein Prüfwerkzeug mit einer Abhängigkeit, die der geprüften Maschine fehlt, prüft die Maschine nicht

`abnahme.sh` wertete die Antworten mit `node -e` auf dem **Host** aus. Staging
hat Node 18, **Prod hat kein node auf dem Host**. Ergebnis: dreizehn Zeilen
„FEHL … ist (leer)", während das Serverlog daneben sauber 2150 meldete.

Auf Staging gebaut, auf Staging abgenommen, auf Prod Fehlalarm. **Der
Unterschied zwischen den beiden Servern steht in der Projektanweisung** — er
wurde beim Bauen nicht mitgedacht.

Konsequenz: Prüfwerkzeuge laufen **im Container**, nicht auf dem Host.

## Regel 8 · Vor dem Merge nach main klären, wessen Rollout es ist

Am 14.08. standen 41 Commits in `main..staging` — **alle aus dem
Parallel-Strang**, keiner aus dem Marktbericht-Chat. Der Merge war damit sein
Release, nicht dessen.

Zwei Folgen, die man vorher wissen muss:

- **`backend` braucht einen Rebuild**, sobald `backend/src/*` mit im Merge ist.
  Nicht nur `mb-backend`.
- **Die Buster-Kette gehört dem, der zuletzt bumpt.** Der Parallel-Strang hat
  alle vier Glieder angefasst; Stand nach dem Rollout **1166** — inzwischen
  **1172** (siehe `PROJEKTANWEISUNG.md`, `v1172b`: das `sed`-Muster traf nur
  eins von drei Gliedern).

Und: der Push nach `origin/staging` wurde abgelehnt, weil der Parallel-Chat
während des Rollouts vier Commits geschoben hatte. Kein Schaden — main und Prod
standen —, aber `git pull --rebase` gehört **abgesprochen**, es ist sein
Zweig-Stand.

---

# 3 · DIE ABNAHME PER BEFEHL — neuer Abschnitt zu TEIL V, „ROLLOUT"

Seit v1096 hat das mb-Backend zwei **Leseendpunkte**. Sie schreiben nichts,
nehmen keine Objektdaten, hängen **nicht** im Proxy des Haupt-Backends und sind
von außen nicht erreichbar. Angefragt werden sie im Container.

```
docker exec dealpilot-mb-backend node -e "fetch('http://localhost:4000/api/v1/marktbericht/register/stand').then(r=>r.json()).then(d=>console.log(d.saetze,d.herkunft,JSON.stringify(d.laender)))"
```

```
docker exec dealpilot-mb-backend node -e "fetch('http://localhost:4000/api/v1/marktbericht/register/probe?ags=05758016&kennzahl=sachwertfaktor&objektart=Zweifamilienhaus&sachwert=326649&brw=145&rnd=18&bgf=347').then(r=>r.json()).then(d=>console.log(JSON.stringify(d.ergebnis,null,1)))"
```

`kennzahl` kennt `liegenschaftszinssatz` · `sachwertfaktor` · `bodenpreisniveau`
· `vergleichsfaktor` · `bodenpreisindex`. Weitere Parameter je Modellform:
`zweig`, `objektart`, `sachwert`, `brw`, `rnd`, `bgf`, `flaeche`, `wfl`,
`baujahr`. **Ohne Treffer kommt der Grund zurück, nicht ein leeres Objekt.**

Die vollständige Abnahme (14 Prüfungen) liegt als `abnahme.mjs` vor:

```
docker cp /tmp/abnahme.mjs dealpilot-mb-backend:/tmp/abnahme.mjs
docker exec dealpilot-mb-backend node /tmp/abnahme.mjs
```

**Die zwei wichtigsten Prüfungen sind die negativen:** Rostock (MV) und München
dürfen **keinen** Wert liefern. München ist der feinere Fall — dort liegt ein
Sachwertfaktor, aber kein Zinssatz. Ein Ausschuss, der die eine Kennzahl führt,
darf die andere nicht miterfinden.

**Offener Punkt:** die committete `tools/abnahme.sh` ist die kaputte
Host-Fassung. Sie gehört durch `abnahme.mjs` ersetzt.

---

# 4 · NEUE DIAGNOSE-LEHREN — ergänzt TEIL V

**Die Zusammenführung von Tabelle und Saat läuft je DATENSATZ, nicht je
Kennzahl** (`v1095-WMRG2`). v1084a führte sie je Kennzahl zusammen — und weil
in `mb.param_modell` 493 Liegenschaftszinssätze aus dem Saatlauf vom 12.08.
lagen (nur NRW, nur Berichtsjahr 2024), gewann die Tabelle für die **ganze**
Kennzahl. 585 neuere Sätze fielen still heraus: `2150 − 1078 + 493 = 1565`, die
Rechnung ging exakt auf.

Dieselbe Fehlerklasse wie v1084a, eine Ebene tiefer: damals fing die Wache die
**leere** Tabelle, aber nicht die halb gefüllte; danach fing sie die halb
gefüllte, aber nicht die **veraltete**. Beide Male lag dieselbe Annahme
darunter — dass die Tabelle mindestens so aktuell ist wie die Datei. **Sie
stimmt nicht: die Datei ist versioniert und fährt mit dem Code mit, die Tabelle
wird von Hand nachgezogen.**

**Ein multiplikativer Faktor 0 wäre still verschwunden**, weil `0` falsy ist und
`if (t && t.wert)` ihn übersprungen hätte — der Wächter zwei Zeilen tiefer wäre
nie erreicht worden. Für einen **additiven** Zuschlag ist 0 ein Nichts (Herford
druckt so eine Zeile ab), für einen **Faktor** ist es eine Katastrophe.
Aufgefallen nur, weil die Prüfstrecke den Wächter selbst geprüft hat.

**Zwei Jahrgänge desselben Zweigs machten die Objektart unerreichbar**
(`v1093-WJG`). `waehleAusGruppe()` hielt sie für zwei Baujahrsgruppen und gab
`null` — Potsdam meldete „objektart_nicht_abgeleitet", obwohl es sie führt. Die
Zeitreihe, die eine Stärke sein sollte, war ein Fehler. **Zuerst der Jahrgang
(der jüngste gewinnt), dann die Baujahrsgruppe.**

**`registerStand()` löste die Saat nicht aus** und meldete „0 Sätze, Herkunft
leer" bei intaktem Register. Genau der umgekehrte Fehler wie bei
`swf-abfrage --stand`: dort grün und wertlos, hier rot und falsch.

**Ein Vokabular, nicht zwei** (`v1096a-WVOK`). `sachwertfaktor()` hat zwei Wege:
das Register versteht über `eingabeBruecke()` sowohl `sachwert` als auch
`sachwert_eur`; die zwei handgeschriebenen Module bekamen das Objekt **roh** und
lasen nur die langen Namen. Betroffen waren ausgerechnet Herford und
Minden-Lübbecke — die Ausschüsse, an denen die Regressionswerte hängen. Die
Asymmetrie lag still da und wartete auf den ersten neuen Leser.

**`land_code` war fest verdrahtet.** Der Umsetzer trug `'NW'` ein, seit das
Register nur NRW führte — 86 Sätze aus vier Ländern trugen es. Funktional
unkritisch (die Auflösung geht über den AGS), aber die Spalte lügt, sie steht im
eindeutigen Schlüssel, und eine Auswertung nach Bundesland bekäme für Bayern
null Zeilen. **Wo ein Fehler ausgeliefert wurde, braucht es einen Schritt, der
den SCHADEN sucht** — nicht nur einen, der die Quelle schließt.

**17 Dublettensätze über zwei Pakete hinweg**: v1090 hatte Rezepte aus v1089
mitgebaut. Der **jüngere** Satz gewinnt — beim überarbeiteten Aurich-Rezept ist
das wesentlich, denn dort war ein zu weiter Kreisschlüssel entfernt worden.

**Zwei Modelle mit demselben `zweig` unter demselben AGS und demselben
Berichtsjahr kollidieren** im eindeutigen Schlüssel; eines würde still
überschrieben. Trennen sie sich nach **Gebiet** → verschiedene AGS, die Kaskade
löst es. Trennen sie sich nach einem **Merkmal** innerhalb desselben Gebiets →
EIN Modell mit Kategorienachse. Gefunden bei Hameln-Hannover (2×) und Kreis
Olpe (2×).

## Bash und Node — Nachträge

- **`grep … | cat || echo` kann nie anschlagen.** Der Rückgabewert einer
  Pipeline ist der des letzten Glieds. Richtig: erst in eine Datei, dann
  `grep -c … || true`.
- **`python3 patch.py | grep -q SKIP` tötet den Doppellauf.** `grep -q` beendet
  sich beim ersten Treffer, schließt die Pipe, Python stirbt an SIGPIPE — die
  Prüfung meldet „kein SKIP", obwohl eines kam. Erst in eine Datei, dann greppen.
- **Auf Prod gibt es kein node auf dem Host.** Nur im Container.
- **Ein großer Paste-Block braucht eine Zählprüfung.** `wc -l` gegen die
  erwartete Zeilenzahl, direkt nach dem Heredoc.

## Ernte — Nachträge

- **Die WebFetch-Grenze ist eine Textmenge, keine Seitenzahl.** Gemessen über
  zehn Läufe: Abbruch zwischen Seite **21 und 55**, unabhängig davon, ob das
  Dokument 56 oder 157 Seiten hat.
- **„Ältere Jahrgänge sind kürzer" ist widerlegt** (NRW-Landesbericht 2016
  bricht früher ab als 2025). **Aber Abbruchseite und Kapitelseite bewegen sich
  unabhängig** — in Niedersachsen und Brandenburg hat der Jahrgangswechsel je
  zwei Rezepte gerettet, in NRW keinen einzigen (dort ist die Kapitelfolge fest).
- **Die Lizenz ist jahrgangsgebunden.** Derselbe NRW-Landesbericht trägt 2016
  `by-2-0` und 2025 `zero-2-0`. Brandenburg trägt `by-2-0` erst ab Berichtsjahr
  2018.
- **Lizenz und Inhaltsverzeichnis im ERSTEN Abruf zusammen lesen.** Spart einen
  Abruf und verhindert vergebliche Ernte.
- **Viele Ausschüsse veröffentlichen dieselben Daten zweimal** — das separate
  Blatt ist oft erreichbar, wo das Kapitel es nicht ist (Kiel). In NRW sind diese
  Blätter allerdings häufig Bild-PDF ohne Textlayer.
- **Der größte Hebel ist nicht der Landesbericht, sondern die
  Verwaltungsvorschrift.** Brandenburgs **VV EW-SW** ist landesweit bindend für
  alle 18 Gebietskörperschaften und liegt als **HTML** vor — HTML kennt keine
  Abbruchseite. NRW hat dieselbe Struktur, aber schwächer: die AGVGA-Modelle
  haben „den Charakter einer Richtlinie". **Deshalb je Bericht messen, ob er
  sich beruft** — von vier NRW-Ausschüssen tat es einer.

---

# 5 · WAS AN TEIL III ZU KORRIGIEREN IST

**„Sachwertfaktoren: 21 Ausschüsse erfasst"** — im Register sind es **16
Zuständigkeitsgebiete plus 2 handgeschriebene Module**. Die Differenz sind
Rezepte, die zurückgehalten wurden.

**„Liegenschaftszinssätze NRW: vollständig"** gilt weiter und jetzt für **zwei
Jahrgänge** (2024 und 2023).

**Die Kennzahlen sind nicht mehr zwei.** `ladeAusDb()` liest sieben:
`liegenschaftszinssatz` · `sachwertfaktor` · `bodenpreisniveau` ·
`durchschnittspreis` · `preisentwicklung` · `erbbauzinssatz` · `bodenpreisindex`
· dazu `vergleichsfaktor` (im Auflöser vorhanden, noch ohne freigegebenen Satz).

**Die Streuungsschwelle steht auf 1,55**, nicht 1,5 (`v1090-WSCH`). Grund: der
Ausschuss Osnabrück-Meppen weist eine Standardabweichung von exakt 1,5
Prozentpunkten aus und traf die alte Schwelle punktgenau — an dieser Stelle
widersprachen sich Prosa („ab 1,5") und Code (`stabw > 1.5`). **Eine Schwelle,
die genau auf einem abgedruckten Wert sitzt, ist keine Schwelle.**

**`ebene = 'gaa'` und `'land'`** kommen im Bestand vor (49 Sätze) und sind gegen
`param_modell_ebene_check` **nicht gemessen**. Im Speicher unkritisch, vor einem
Saatlauf in die Datenbank zu klären.

**Ein Saatlauf ist nicht mehr nötig**, um eine neue Ernte wirken zu lassen —
seit v1095 ergänzen sich Tabelle und Saat je Datensatz. Er wäre nur nötig, um
eine Ernte **ohne Deploy** wirksam zu machen.

---

# 6 · REZEPT FÜR DIE KONSOLIDIERUNG

*(Marcels Fassung, um den dritten Strang ergänzt — siehe Kopf dieser Datei.)*

Am Anfang der nächsten Sitzung, mit dem Originaltext im Zugriff:

1. `claude/projektanweisung-marktbericht-20260812-abend.md` lesen — **sie liegt
   im Repo** (2.605 Zeilen). Marcels Rezept nennt sie
   `projektanweisung-gesamt-20260812-abend.md`; der tatsaechliche Name ist der
   obige. Sie hiess zuvor `claude/PROJEKTANWEISUNG.md` und war damit vom
   Haupt-App-Stand `PROJEKTANWEISUNG.md` im Wurzelverzeichnis nur am Ordner zu
   unterscheiden — deshalb umbenannt.
2. Diese Datei Abschnitt für Abschnitt einarbeiten — jeder Punkt nennt seinen
   Zielabschnitt.
3. **NEU: `PROJEKTANWEISUNG.md` (Haupt-App-Strang, v1148–v1172) einarbeiten.**
   Sie ist der dritte Stand und im Rezept vom 14.08. nicht vorgesehen. Ihr
   Rollout-Journal führt jede Version mit Was · Commit · Nachweis · Rest.
4. Den Abdeckungsbericht `claude/abdeckung-laender-kreise-20260814.md` als
   eigenen Abschnitt in Teil III **einhängen, nicht hineinkopieren**; er ändert
   sich mit jeder Ernte.
5. Die neue Gesamtfassung schreiben, **danach beide Vorgänger löschen** —
   nebeneinander erzeugen sie Widersprüche.
6. Marker-Übersicht aus Abschnitt 1 als Erwartungsliste übernehmen.

**Nicht vergessen:** die Fassung vom 12.08. enthält Aussagen, die inzwischen
falsch sind (493 Sätze, neun Modellformen, zwei Kennzahlen, Schwelle 1,5,
Prod-Stand `99c1097`). Sie stehen oben mit ihrer Berichtigung. Wer nur die alte
Fassung liest, arbeitet mit überholten Zahlen.

---

## WIDERSPRÜCHE ZWISCHEN DEN STRÄNGEN — beim Konsolidieren auflösen

Beim Ablegen dieser Datei aufgefallen. **Keiner davon ist gefährlich, aber jeder
kostet Zeit, wenn ihn jemand für einen Befund hält:**

| Aussage im Marktbericht-Strang | Stand im Haupt-App-Strang |
|---|---|
| „**ZWEI `style.css`:** `index.html` lädt `frontend/style.css`" | **Falsch für die Haupt-App.** `index.html:38` lädt `frontend/css/style.css` (36.929 Zeilen). `frontend/style.css` wird von **keiner** Seite geladen und ist eine Leiche. Steht so in `CLAUDE.md` |
| „**HANDY-SPERRE bewusst AKTIV** (v970 + MA35)" | **Aufgehoben mit v1118.** `js/mobile-redirect.js` und MA35 sind entfernt, die normale Ansicht trägt das Handy allein. `dp_wl_cache` liest weiter `ui-varianten.js` — anderer Zweck, darf nicht mitfallen |
| „Buster-Kette (4 Glieder) … Stand **1154b**" bzw. **1166** | Stand **1172**. Und: die Kette hat in der Praxis **drei** greifende Glieder (`index.html` → `marktbericht-view.js` → `marktbericht-app/index.html`); `v1172b` zeigt, dass ein `sed` nur eins traf und die Änderung nie ankam |
| „Bankexport-Free-Leck (Gate blockt nur `starter`)" | **Geschlossen mit `v1161`:** `bankExportPlans: ['investor','pro']` |
| „`business`/`enterprise`" in Plan-Listen | **Gelöscht mit `v1161`** — vier Code-Stellen und die DB-Zeilen |
| „Plan-Naming-Konsistenz offen" | unverändert offen |
