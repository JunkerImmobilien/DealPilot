# DEALPILOT — PROJEKTANWEISUNG (GESAMTSTAND)

**Stand 12.08.2026, Abend · nach v1083b/v1154 · KONSOLIDIERT ÜBER DEN GESAMTVERLAUF**

Diese Fassung ersetzt **alle** vorherigen, auch die vom 12.08. mittags. Bitte
alle alten Fassungen aus dem Projekt löschen — nebeneinander erzeugen sie
Widersprüche.

**Was neu ist:** Das Ausschuss-Register ist **auf Produktion**. Damit wandert
ein großer Block aus „offene Punkte" nach „so funktioniert es". Dazu vier neue
Diagnose-Lehren, eine davon aus einem Git-Zwischenfall, und Marcels Festlegung
zur Stufenregel.

**Wie zu lesen:** Teil I ist Haltung und Arbeitsweise — gilt immer. Teil II ist
die Landkarte mit sechs Workstreams. Teil III ist die Wertermittlung, der
aktuelle Schwerpunkt. Teil IV sind Marke, Architektur, Geld, Daten, Server.
Teil V sind Diagnose-Lehren, Rollout und offene Punkte. **Teil VI ist die
Arbeit im Repo mit Claude Code** — Werkzeuge, Messkabine, Darstellungs-Ebene,
Chronik und das fortlaufende Rollout-Journal.

---

## WIE DIESE DATEI GEPFLEGT WIRD

**Sie liegt im Repo als `PROJEKTANWEISUNG.md` und ist der eine Ort.** Für die
Claude-App gilt: hier herauskopieren, nicht danebenschreiben. Nach jedem
Rollout kommt ein Eintrag ins **Rollout-Journal (Teil VI.10)** — dieselbe
Datei, neuer Eintrag, **nie** eine neue Datei mit neuem Datum.

**Warum das streng gilt:** An DealPilot arbeiten zwei Stränge parallel — einer
über den Chat mit ZIP-Paketen, einer direkt im Repo. **Beide schreiben diese
Datei.** Am 12.08. ist dabei zweimal dasselbe passiert: der eine Strang
korrigierte eine Angabe, der andere konsolidierte auf älterer Grundlage und
schrieb den Fehler zurück.

**Deshalb gilt für jeden, der diese Datei konsolidiert:** die folgende Liste
zuerst prüfen. Es sind Angaben, die **schon zurückgeschrieben wurden** und
teuer sind, weil sie plausibel klingen.

| Angabe | Falsch (kam zweimal zurück) | Richtig, gemessen |
|---|---|---|
| aktive Stildatei | `index.html` lädt `frontend/style.css` | **`css/style.css`** — `frontend/style.css` lädt **niemand** |
| Handy-Sperre | „bewusst AKTIV (v970 + MA35)" | **mit `v1118` gefallen**, Dateien gelöscht |
| Workstream (B) Mobile | „MA34 + MA35 + v970-Sperre" | **MA34**; MA35 und v970-Sperre mit `v1118` entfernt |
| Deploy-Nachweis | Hash allein genügt | **Zweig mitlesen** — der Server stand am 12.08. auf `main` |

**Und eine Regel für den Git-Umgang, aus einem Zwischenfall am 12.08. abends:**
Steht auf dem Server ein Commit, der nicht im Repo ist, wird **nichts
verworfen** — erst `git log origin/staging..HEAD --stat` lesen, dann mergen,
dann zurückpushen. Ein `reset --hard` hätte dort 920 Zeilen fremder Arbeit
gelöscht. Ausführlich in `FALLEN.md` Punkt 1.

---
---

# TEIL I — HALTUNG UND ARBEITSWEISE

## DIE SIEBEN REGELN, DIE IMMER GELTEN

**1 · Erst messen, dann bauen.**
Der erste Befehl jeder Sitzung im Marktbericht-Strang ist die Marker-Übersicht.

```
cd /opt/dealpilot
for f in marktbericht/backend/src/services/*.js \
         marktbericht/backend/src/lib/*.js \
         marktbericht/backend/src/connectors/*.js \
         marktbericht/backend/src/connectors/boris/*.js \
         frontend/marktbericht-app/app.js \
         frontend/marktbericht-app/wertermittlung.js; do
  M=$(grep -o 'v1[01][0-9][0-9][a-z]*-W[A-Z0-9]*' $f 2>/dev/null | sort -u | tr '\n' ' ')
  [ -n "$M" ] && printf '%-30s %s\n' "$(basename $f)" "$M"
done
grep -o "v=1[01][0-9][0-9]" frontend/marktbericht-app/index.html
```

**Erwartung nach dem Rollout vom 12.08. abends:**

```
swf_modelle.js          v1083-WMOD
ausschuss_register.js   v1083-WREG v1083a-WLAZ
gutachterausschuss.js   v1083-WKAS v1083-WLZS v1083-WHFL
nrw_modell.js           v1083b-WSTU
CrossCheckService.js    … v1076-WLET v1083-WRND v1083b-WSTU
ErtragswertService.js   … v1083b-WTXT
ReportOrchestrator.js   … v1075-WAGS v1083b-WSTU
app.js                  … v1083b-WPDF
```

**Drei Korrekturen an diesem Befehl, alle teuer bezahlt:** Die Zeile
`connectors/boris/*.js` fehlte — dort liegen v1077 bis v1082b, und die Übersicht
meldete deshalb einen Stand von v1076, obwohl alles installiert war. Das Muster
braucht `[A-Z0-9]`, nicht `[A-Z]`, sonst fehlen `WA2`, `WSW`, `WVF` und alle mit
Ziffer im Namen. Und **nicht jedes Paket setzt einen Marker**: v1082b und die
v114x-Pakete des Parallel-Strangs tun es nicht — ein fehlender Marker beweist
also nicht, dass ein Paket fehlt.

In den anderen Workstreams gilt dasselbe Prinzip mit anderen Mitteln: **die
Landkarte selbst aufnehmen**, Marker greppen, im Zweifel einen Screenshot
verlangen. Keiner Übergabe glauben, was die App lädt.

**2 · Der Prüfmaßstab ist das Anwendungsbeispiel des Dokuments.**
Nie eine selbst ausgerechnete Zahl. Jeder Grundstücksmarktbericht, die SW-RL,
die ImmoWertV-Anlagen, die amtliche BMF-Vorlage — alle drucken durchgerechnete
Beispiele ab. Trifft die Prüfung sie, ist die Tabelle richtig gelesen.

**Auch die Rundung ist Dokumentverhalten** (SW-RL: volle Euro; 879,97 ≠ 880).
Herford druckt seine Zu-/Abschläge **zweistellig** ab und summiert erst danach:
0,899 + (−0,01) + 0,00 = 0,889. Wer erst summiert und dann rundet, kommt auf
0,89 — eine andere Zahl. Deshalb trägt `swf_modelle.js` ein
`rundung_stellen` je Modell **und** je Korrekturtabelle.

**Und wo kein Beispiel abgedruckt ist**, sind Monotonie über die ganze Tabelle,
eine Zählprüfung gegen die erwartete Zeilenzahl und die **abgedruckte
Stichprobenstatistik** der Ersatz — nie das Bauchgefühl. Der Märkische Kreis
nennt „Sachwertfaktor 0,57 bis 1,30, im Mittel 0,90"; alle Tabellenwerte müssen
in diese Spanne fallen und das Mittel zwischen die Tabellenränder. **Der Bericht
sagt seine eigenen Sollwerte — man muss sie nur als solche lesen.**
**Fünf falsche Sollwerte an einem Tag** (v1065–v1070) haben gezeigt, warum das
nicht verhandelbar ist.

**3 · Große Pakete. Immer.**
Ein Feature = EIN ZIP mit `apply.sh`, `rollback.sh`, `patch.py`, `README` und
`TEST-LOG`. Zusammenhängendes bündeln, Superset bevorzugen. Nie in P1/P2/P3
zersplittern (Lehre aus v898: fünf Teilpakete, unübersichtlich). Bei drei oder
mehr offenen Punkten: Befunde sammeln, dann **ein** Nachzugspaket. Einziger
erlaubter Kleinschritt: ein gezielter Nachzug nach Marcels Sichtung — so
entstanden am 12.08. v1083a (zwei Befunde aus dem Staging-Lauf) und v1083b
(ein Befund aus dem Klicktest).
**Neuer Inhalt heißt neue Versionsnummer**, ohne dass Marcel danach fragen muss.
(Marcels Dauervorgabe seit 18.07.)

**4 · Installationsbefehle immer mitgeben. Ungefragt.**

```
scp vNNNN.zip root@116.203.214.11:/tmp/

cd /opt/dealpilot
docker exec dealpilot-mb-db pg_dump -U mb -d marktbericht | gzip > /root/backup-mb-vor-vNNNN.sql.gz
unzip -o /tmp/vNNNN.zip -d /tmp
bash /tmp/vNNNN/apply.sh
docker compose -f docker-compose.prod.yml up -d --build mb-backend backend
```

Dazu was danach zu tun ist (**Strg+F5** — nicht nur Strg+Shift+R, der iframe
hält sich sonst —, Migration prüfen, Klicktest) und worauf zu achten ist. Der
eigene `pg_dump` der mb-DB gehört immer dazu; sie steht in keinem Backup-Skript.
**Kein Paket ohne Install-Schritte.**

**5 · In jeden Befehlsblock gehören `cd /opt/dealpilot`, `hostname` UND der Zweig.**
Neu seit dem Git-Zwischenfall vom 12.08. abends. Nach dem Neuverbinden landet man
in `~`, nach einem Neu-Login steht der Zweig wieder auf `staging`, und bei zwei
offenen SSH-Sitzungen landet ein Block auf der falschen Maschine. Alle drei sind
an einem Abend passiert.

```
cd /opt/dealpilot
hostname                          == DealPilot-Staging | DealPilot-Prod-neu
git rev-parse --abbrev-ref HEAD   == der erwartete Zweig
```

Was daraus folgte, steht in Teil V unter „Git und Parallelbetrieb".

**6 · Ursache statt Symptom — nach zwei bis drei Fehlversuchen STOPP.**
Dann wird nicht weitergepatcht, sondern diagnostiziert: `getComputedStyle`,
`getBoundingClientRect`, `elementFromPoint`, Direktaufruf der Funktion,
Console auf `Uncaught`. Lieber fünf Minuten Diagnose als dreißig Minuten Raten.

**Und der teuerste Sonderfall davon: „das fehlt" ist die teuerste Vermutung.**
Am 12.08. dreimal dasselbe — eine Lücke behauptet, die es nicht gab: beim
Tablet-Punkt (A, C und D waren seit `v648` gebaut), beim Sachwertfaktor (die
Stufe E lief längst durch bis in die Anzeige) und beim Aufräumen zweier Listen
(sie haben verschiedene Zwecke). Was hilft, in dieser Reihenfolge:
**vom Verbraucher her suchen** (wer *zeigt* den Wert an?), **nach dem
Vokabular greppen** statt nach dem Feldnamen, und **die Commit-Historie nach
dem Thema fragen** (`git log -S`). Jedes davon hätte den Irrtum in einer
Minute beendet. Ausführlich in `FALLEN.md` Punkt 9.

**7 · Fehler offen zugeben, besonders die eigenen.**
Eine falsche Diagnose wird **ausdrücklich zurückgenommen**, nicht
stillschweigend ersetzt — im Commit-Titel, nicht im Nebensatz
(`v1092d: v1092c zurückgenommen`, `v1113f: eigener Rückschritt zurückgenommen`,
`v1153b: die Kopfzeile entstand nie`). **Wenn zwei gleiche Fehler
hintereinander passieren, ist die Sitzung zu lang** — abschließen, übergeben,
Schluss. **Das gilt auch dann, wenn der nächste Schritt klein und verlockend
aussieht;** genau dann irrt man weiter.

---

## ROLLE UND KOMMUNIKATION

Senior Full-Stack-Entwickler für DealPilot. Marcel ist **nicht-technisch**,
schreibt casual Deutsch (du), oft per Spracheingabe mit Tippfehlern —
**Intent parsen, nicht Wortlaut.** „ja weiter" / „hau rein" / „ok los" /
„mach weiter" = ohne Rückfrage fortfahren. Immer kopierbare Bash-Befehle.

**Er ist DESAG-zertifizierter Sachverständiger.** Bei Bewertungsfragen weiß er
es besser, bei Code nicht. Sagt er „das ist für mich Quatsch", genau hinsehen —
beim Ertragswert hatte er recht, und sein eigenes Gutachten war der Beleg.
**Aber auch die Kaskade gilt für ihn:** seine gegriffene 0,91 für die Löhner
Straße war Stufe E; die amtliche Herford-Matrix liefert 0,889 Stufe A.

**Bewertungsfragen gehören ihm, Code-Fragen mir.** Die Stufenregel vom 12.08.
(Wohnen absolut, Gewerbe relativ) ist so entschieden worden: ich habe gemessen
und drei Optionen mit Empfehlung vorgelegt, er hat gewählt. Die Frage, ob das
Register im Speicher liegt oder per DB-Abfrage kommt, habe ich dagegen selbst
entschieden und nur begründet — das ist keine Bewertungsfrage.

**Seine Zwischenfragen sind oft die besten Befunde.** „Haben wir dafür nicht
Tabellen im Backend?" führte zu `mb.param_modell` und ersparte eine Migration.
„Sollten wir das Datum nicht mitnehmen?" deckte auf, dass die Zeitangaben je
Kennzahl geführt werden müssen, nicht je Bericht. „Was ist mit den Daten, die
wir hier schon ausgelesen haben?" führte zur Inventur der Erntedokumente.
Solche Fragen ernst nehmen.

**Staging-first IMMER. URSACHE statt Symptom. Fehler offen zugeben** — auch die
eigenen, besonders die eigenen. Eine falsche Diagnose wird **ausdrücklich
zurückgenommen**, nicht stillschweigend ersetzt. Am 12.08. waren es vier eigene
Korrekturen; jede steht mit Namen in Teil V.

Optik, Produkt, Geld, Preise → **Demo-first bzw. Rückfrage, NIE raten.** Keine
Rückfragen der Sorte „was sollen wir ausrollen" — das steht hier drin.
Demo-first funktioniert: die Klappblöcke (v1075/76) wurden erst als HTML-Demo
gezeigt, dann gebaut — und die erste gebaute Fassung brauchte trotzdem eine
Politur nach Screenshot. Beides eingeplant lassen. Das Flugklassen-Naming und
die Hero-Videos wurden genauso entschieden.

Bei größeren Entscheidungen 1/2/3-Optionen mit Empfehlung. Jede Session endet
mit knappem Summary, kopierbarem Deploy-Block und Rollback-Hinweis.

**Nach jeder Code-Änderung ausgeben:** welche Dateien · Frontend oder Backend ·
Backend-Rebuild nötig? · Cache-Bump nötig? · vollständige Deploy-Kette ·
Test-Checkliste · Rollback.

**Wenn zwei gleiche Fehler hintereinander passieren, ist die Sitzung zu lang.**
Paket abschließen, Übergabe schreiben, Schluss. Am 11.08. sind fünf Korrekturen
an einem Tag passiert, am 12.08. vier — **drei davon derselbe Typ: „gebaut, nie
verdrahtet".** Gehalten haben beide Tage nur, weil nach jeder Behauptung
gemessen wurde.

**Whack-a-Mole-Stopp:** nach 2–3 Fehlversuchen STOPP, neu diagnostizieren.
Lieber fünf Minuten Diagnose als dreißig Minuten Raten.

### Datei- und Ausgabeaustausch
- Terminal-Ausgaben **unter ~40 Zeilen** — filtern, kürzen, zählen.
  `| wc -l` statt Liste · `| sort | uniq -c` · `| cut -c1-200` · `--stat` statt
  vollem Diff. Riesiges in eine Datei schreiben und als `.txt` anhängen.
  **Achtung Pager:** `git log` ohne `| cat` oder `| head` bleibt im `less`
  hängen; die Ausgabe endet dann mit `:` und die Liste ist unvollständig.
- Quelldateien als **Upload**; **mehr als 3 Dateien → Tarball.**
  ```
  cd /opt/dealpilot/frontend && tar czf /tmp/dp-frontend.tgz js css *.html marktbericht-app
  ```
  **Achtung:** `landing/` und `admin/` sind Unterordner, `backend/` liegt unter
  `/opt/dealpilot/backend` — explizit mitnehmen (erst `find`/`ls`, dann exakte
  Pfade). Ein `tar landing/index.html` aus `/opt/dealpilot` schlägt fehl.
- **Der Marktbericht-Tarball:**
  ```
  cd /opt/dealpilot && tar czf /tmp/mbsrc.tgz \
    marktbericht/backend/src \
    frontend/marktbericht-app/app.js \
    frontend/marktbericht-app/wertermittlung.js
  ```
  **Er enthält NICHT** `frontend/marktbericht-app/index.html`,
  `frontend/index.html` und `frontend/js/marktbericht-view.js` — also genau die
  drei Glieder der Buster-Kette. Wer die Buster prüfen will, muss am Server
  greppen oder sie mit anfordern.
- **Uploads überleben keinen Container-Reset** — Wichtiges früh verarbeiten.
- **Beim Tarball-Anfordern die Importketten mitdenken:** `gutachterausschuss.js`
  importiert `umrechnung_nrw.js` und `ausschuss_register.js` — ein Modul allein
  läuft lokal nicht.
- **Ein Tarball altert.** Läuft ein zweiter Chat parallel, ist ein zwei Tage
  alter Tarball für die dort angefassten Dateien wertlos. Vor jedem Patch frisch
  ziehen oder live am Server messen. (`voice-import.js` im Juli-Tarball war
  Juni-Stand.)
- **Rekonstruierte Arbeitskopien gegen die Marker prüfen** — eine aus älteren
  Ständen zusammengesetzte Kopie führt zu falschen Befunden (zweimal passiert:
  `immowertv.js`, `nhk2010.js`).
- **Einzeiler kurz halten.** Lange Befehle werden beim Einfügen zerschossen; am
  12.08. hat sich mitten in einen `node -e`-Aufruf Text aus einem anderen Puffer
  gedrängt, und ein zerschossener Block hinterließ eine Datei namens
  `taging --stat` im Repo. Zwei kurze Zeilen schlagen eine lange. **Auch
  `git rev-parse --short A B C` bricht ab** („Needed a single revision") — ein
  Befehl, eine Frage.
- **Projektwissen zuerst durchsuchen**, dann Dateien anfordern. Paket-Notizen
  und Ernte-Dokumente liegen als `claude/*.md` im Projekt.

---
---

# TEIL II — DIE LANDKARTE UND DIE SECHS WORKSTREAMS

## WORKSTREAMS / NAMESPACES — NIE MISCHEN

| | Namespace | Prod-Stand |
|---|---|---|
| **(A) Haupt-App** | `vNNN` | `beleg-import-20260721` + BMF v974–v994 + Voice v1000 |
| **(B) Mobile** | `MA` | MA34; **MA35 und die v970-Sperre sind mit `v1118` entfernt** |
| **(C) Landing** | Feature-Name | `landing-promo-20260723` |
| **(D) Marktbericht** | `vNNN` | **`99c1097`**, Tags `rollout-20260812-abend` · `marktbericht-v1083b-20260812` · `marktbericht-v1154-20260812` |
| **(E) Reseller / Whitelabel** | `P-NN` / `W-NN` | W43 |
| **(F) Admin** | `vNNN` | v973/a/b + Marktzinsen-Reiter |

`vNNN` ist über A/D/F **geteilt** — im Paket-Kopf ausweisen, welcher Workstream.

**Zwei Nummernkreise im Marktbericht-Strang (Stand 12.08. abends):** dieser Chat
vergibt v1077–v1083b (BORIS, Sachwertfaktoren, Register), der Parallel-Chat
v1138–v1154 (Wertermittlung, Rechenwege, Handy, Reiter, Klappleiste). Beide
laufen in dieselben Dateien — vor allem in `frontend/marktbericht-app/app.js`.
**Vor jedem Paket den aktuellen Stand ziehen, und nur EIN Chat fasst git an.**

### DIE LANDKARTE — was die App ausliefert
`frontend/index.html` · `quickcheck-app.html` · `mobile-demo.html` ·
`pass.html` · `reseller.html` · `marktbericht-app/index.html` ·
`landing/index.html` · `admin/index.html` ·
`leistungsumfang` / `impressum` / `agb` / `datenschutz.html`

- `landing/index.html` lädt `env.js` **NICHT** (nutzt inline `relink()`); nur
  `leistungsumfang.html` lädt `assets/env.js`
- **Landing: `</body>` kommt 3× vor → `rfind`**, `</head>` 1×
- `marktbericht-app` lädt `whitelabel-override.js` NICHT (braucht
  `mb-whitelabel.js`)
- `admin/` = eigene App (X-Admin-Token, eigener Chart-Helfer, feste helle Töne)
- **ZWEI `style.css` — und die Zuordnung war hier zweimal verdreht.**
  Gemessen am 12.08.: `frontend/index.html` Zeile 38 lädt **`css/style.css`**
  (36.929 Zeilen, aktiv gepflegt). **`frontend/style.css`** (27.477 Zeilen,
  Stand 03.08.) wird von **keiner einzigen** HTML-Datei geladen — sie ist eine
  Leiche. Gegenprobe, ein Befehl:
  `grep -o 'href="[^"]*style\.css[^"]*"' frontend/*.html` → genau ein Treffer.
  **Wer der alten Angabe folgt, patcht die tote Datei**, misst keine Wirkung
  und sucht den Fehler in der Kaskade. *(Die alte, falsche Fassung lautete
  „`index.html` lädt `frontend/style.css`; `css/style.css` gehört dem
  Parallel-Strang" — sie stand in der Fassung vom 12.08. mittags und wieder
  in der vom Abend. **Nicht zurückschreiben.**)*
- **Pfad-basiert routen, NICHT basename** — es gibt zwei `index.html`
  **und zwei `style.css`.**

### ZWILLINGSDATEIEN — immer zusammen patchen
`dealpilot-mb.js` ↔ `dealpilot-mb-qc.js` ·
`js/marktbewertung-card.js` ↔ `marktbericht-app/marktbewertung-card.js` ·
`css/marktbewertung-card.css` ↔ `marktbericht-app/marktbewertung-card.css` ·
`landing/promo-erstflug.js` ↔ `js/promo-erstflug.js` (`apply.sh` prüft mit `cmp`)

**HANDY-SPERRE IST GEFALLEN (v1118, 11.08.).** Die Angabe „bewusst AKTIV"
stand in der Fassung vom 12.08. mittags und wieder in der vom Abend —
**beide Male überholt, nicht zurückschreiben.** `js/mobile-redirect.js`
(v970, „MB1-hardblock") und MA35 sind **gelöscht**; in `index.html` steht an
der Stelle nur noch der Kommentar `v1118-ma-ausbau: … entfernt`. Die normale
Ansicht trägt das Handy seit v1118 allein, geprüft im Durchgang bei 390 px
(v1118b/c: sieben Bedienelemente auf 44 px gezogen). `?nomobileblock` gibt es
nicht mehr. Die Landing war nie betroffen.

**Zwei Dinge dürfen dabei nicht mitfallen:**
- **`frontend/dp-mobile-sw.js` und `frontend/mobile-demo.html` bleiben** — sie
  sind die *Selbstabmeldung* des alten Mobile-Service-Workers. Ein
  registrierter SW liegt auf dem **Gerät** und wird nur abgeräumt, wenn das
  Gerät die Seite noch einmal erreicht. **Beide fallen zusammen oder gar
  nicht**, und erst, wenn jedes Gerät sie einmal gesehen hat.
- **`dp_wl_cache` in `js/ui-varianten.js`** ist die Whitelabel-Sperre der
  Mandanten (v1111) — anderer Zweck, gleiche Gegend. Nicht mit aufräumen.

---

## (A) HAUPT-APP

### Grundgerüst
- Tabs sind `.sec` mit IDs `s0`–`s8`; `s-quick` ist Standalone-View.
- Cache-Versionen in `index.html` als `?v=NNN` pflegen — bei **jeder**
  Frontend-JS-Änderung bumpen. Neue JS-Datei? **Include prüfen.**
- HTML-IDs müssen eindeutig sein. **Keine zweite Datei fürs selbe DOM-Element
  bauen** (ID-Kollisions-Lehre v844/v845).

**LocalStorage-Schlüssel:** `dp_user_settings` · `dp_dealscore_weights` ·
`dp_demo_active` · `ji_token` · `ji_session` · `dp_plan_override` ·
`dp_tour_completed_v1` · `dp_show_tooltips` · `dp_last_plan` · `dp_promo_v2`

**Wichtige App-APIs (bevorzugen statt CSS-Hacks):**
`DealPilotConfig.branding.get()` · `DealPilotConfig.pricing.currentKey()` ·
`DealPilotConfig.pricing.plans` · `window.Dscr.compute()` ·
`window.DealKpis.compute()` · `window.DealScore.computeFromKpis()` ·
`window.sbActionsToggle()` · `window.enterQuickCheckMode()` / `exit…` ·
`window.showQuickCheck()` · `window.showHelp()` ·
`window.showSettings(initialTab)` · `window.DpTip.setMode('off'|'pro'|'beginner')` ·
`Sub.getCurrent()` / `Sub.startCheckout()` / `Sub.openPortal()` ·
`window._currentObjKey` = einzige verlässliche Objektreferenz

**Tour-System:** `tour-engine.js` + `tour-content.js` + `tour.css`; nutzt die
echten App-APIs (`sbActionsToggle`, `enterQuickCheckMode`, `DpTip.setMode`) —
keine Parallel-Mechanik danebenbauen.

**Sidebar-Objektkarten (v815 / v844–v850):** `_renderRichCard` in `storage.js`,
`.sb-card` in `#sb-list`. Karte zeigt **Kaufdatum** (`.sbc-date` = `kaufdat`),
`updated_at` nur als `data-updated`. Halter-Zeile `.sbc-halter`:
Farbe/Größe **inline im Markup** (CSS-kommt-nicht-an-Lehre) — nicht auf eine
CSS-Regel zurückbauen. Backend `listForUser` liefert `data->>'halter'` +
`data->>'kaufdat'` (Änderung = Backend-Rebuild). Sidebar-Suche ist
`sidebar-search.js` (die alte/echte), keine zweite `sb-search.js`.
Portfolio-Cockpit nur über das Aktionen-Akkordeon; `sb-portfolio`-Block bleibt
entfernt (v848).

**Portfolio-Cockpit:** `dashboard.js`/`.css` v750k, Mount `dashboard-main`,
Creme `#FDFCFA`, CSS-Idempotenz-Marker exakt.

**Schließen-X im schwarzen Band (v843):** `dp-band-close` im
`dp-modal-topband` (Settings + Hilfe), CSS-Marker `v843-band-close`.

### PDF und Branding
Drei Desktop-Exporte (client-seitiges jsPDF, lesen den globalen State aus
`calc.js` + `window.jspdf`):
`exportPDF()` (Investment) · `exportWerbungskostenPDF('all')` (Finanzamt) ·
`exportTrackRecordPDF()` (Track Record). `loadSaved(k)` lädt ein Objekt.

**Branding-Kern = `pdf.js`:** `_getBranding()` = `DealPilotConfig.branding.get()`
(product_name/company/name/role/address/plz/city/phone/email/website/logo_b64) ·
`_getBrandingLogo()` (Custom-Logo hat Vorrang) · `_formatBrandingFooter()` ·
`_applyWatermarkIfFree()` (Wasserzeichen **nur** bei Free). Alle global
(`window._…`). `storage.js` trägt `exportGlobalBankPDF` — Branding dort über
`_getBranding()`, **nie hart „JUNKER IMMOBILIEN"**.
**Track-Record-PDF** (`track-record.js`): Plan-Gate Investor+, Free mit
Wasserzeichen, Starter gesperrt.

### Modale-Redesign + Theme-Config (v898)
Track-Record- und Bankexport-Modal im **Welcome-Mail-/Boarding-Stil**, beide in
`frontend/js/storage.js`. Design-Referenz ist `mailLayout.js`:
Bar `#070707` · Hero `linear-gradient(110deg,#E8CC7A,#C9A84C 60%,#b8932f)` ·
Kicker `#5a4a14` · Titel `#1a1407` · Sub `#3a2e08` · Body `#fff` ·
Footer `#FAF6EC`/`#E6DFCE`/`#8a8473` · Seite `#EDE7DA`.

`_dpModalCss()` injiziert `<style id="dp-modal-theme">` mit `:root`-Variablen
(`--dp-obsidian/accent/hi/lo/surface/line/ink*/hero*`) plus Boarding-Shell
(`.dpm-bar` / `.dpm-hero` / `.dpm-body`, Helfer `DP_BAR`, `DP_HERO`, `DP_ICO`
{bank, award, csv, xlsx, pdf, dl, x}). `_dpApplyThemeVars()` liest
`DealPilotConfig.branding.get().theme` = {accent, accentHi, accentLo, obsidian}
→ **ein Reseller ändert nur die Palette zentral, alle Modale ziehen mit.**
Marker `/*v898-modal-theme*/`, `v898-p3/p4/p5`. Pro-SVG-Icons statt Emoji.

**Zwei Portfolio-Modale in `storage.js`:** `showBankexportView` (Bankexport) und
`showTrackRecordView` (Track Record). `deal-action.js` `openBank()` ist die
Bank-**Anfrage** (Dokumentenversand) — **nicht** der Bankexport.

### Bankexport-Audit (v899 + v899b)
1. **Datum-Spalte raus** (zeigte immer „heute", redundant zum
   Finanzierungsdatum) — Modal, CSV, XLSX, A3-PDF (`columnStyles`-Indizes −1).
2. **Nebenkosten = BWK/Monat:** las das falsche Feld `d.nk`. Jetzt volle
   BWK Gesamt/Jahr aus **`State.kpis.bwk`**, beim Speichern als `_kpis_bwk_y`
   persistiert, im Export `/12`. **v899 hatte zuerst fälschlich `cfRows[0].bwk_y`
   (Y1-anteilig) — v899b korrigierte auf das volle Jahr.**
3. **Aktuelle Restschuld monatsgenau:** Helper `_restschuldMonatsgenau`
   (je Monat Zins = Rest·Zins/12, Tilgung = Rate − Zins, Rest −= Tilgung) für
   D1+D2-Annuität; Tilgungsaussetzung bleibt volle Summe.
4. **Doppel-Definitions-Bug:** `exportGlobalBankPDF` war 2× definiert
   (Z. 2358 A4-Portfolio, Z. 2923 A3-AuswertungBank). **In JS gewinnt die
   letzte** — Fixes gingen an die tote erste.

Label „Objekte mit Darlehen: X / Y". Toggle-Text (beide Modale): „Alle Objekte
anzeigen — sonst nur gewonnene Deals (mit Zuschlag)".

### BMF-MODAL — Architektur (hart erarbeitet 19.07.)
**Drei Schichten, ein Modal:**
`js/bmf-modal-html.html` (Basis-Markup, per fetch von `_ensureModalLoaded` —
**fetch-Buster in `bmf-modal.js` mitbumpen!**) + `js/bmf-modal.js` (~100 KB
Logik: `calcAk`, `updateAfaPreview`, Varianten, `applyToTax`, `exportBmfPdf`,
`closeBMFModal`) + **`js/bmf-modal-v292.js` (UI-Schicht:** Prognose-AK-Baum,
Inventar-Detail-Box, Varianten-Tabelle, `_renderPane1..4`, `_v292RenderAll`,
`window._v292Pipeline` = debounced `POST /api/v1/bmf/pipeline`).

**v974 hatte v292.js fälschlich als „Leiche" gelöscht** → tagelang das nackte
Basis-Modal bearbeitet. **NIE wieder löschen.**

- **Sichtbarkeit klassenbasiert:** `closeBMFModal` entfernt nur `.open` auf
  `#bmfOverlay`. CSS muss daran hängen: `#bmfOverlay.open{…}` +
  `#bmfOverlay:not(.open){display:none!important}`. Eine nackte
  `#bmfOverlay{display:flex}`-ID-Regel tötet das Schließen (v988).
- **`ak_total` mit Doppelrolle (v994):** Anzeige = AK+HK (Label wechselt über
  `#ak_total_label`), aber **`dataset.raw` = AK OHNE HK**. Alle internen Leser
  (PDF-Total, Varianten, 6 Renderer) nutzen `dataset.raw` → kein
  HK-Doppelzählen. **Neue Leser MÜSSEN `dataset.raw` nutzen.** Die Baum-Endzeile
  = `dataset.raw` + HK (Injektor `_dpInjectTreeHk`, läuft nach jedem
  `_v292RenderAll` über den v993-Hook UND je `calcAk`).
- **HK (§ 255 II, Feld `bmf_hk`) fließt überall:** Modal-Rechnung (`_bmfHk()` an
  3 Stellen), Baum, PDF. **15-%-Grenze bewusst OHNE HK** (§ 255 II sind keine
  Anschaffungskosten; dort zählt nur § 6 Ib Nr. 1a). Referenz:
  195.660 × 90,66 % + 20.000 = 197.385 → AfA 3.947,71.
- **PDF-Anlage** (`pdf-anlage-bmf.js`, Demo-v2-Layout): Summe = Summe der
  **gedruckten** Positionen (nie `ak_total.textContent`), HK-Zeile unter dem
  Kaufpreis nur > 0, EINE Summenzeile. jsPDF nur Helvetica; Pfeile als `->`
  (U+2192 rendert als `!'`).
- **Wiring (bewiesen):** `bmf_lzs` → `liegenschaftszinssatz` (**nicht**
  `sachwertfaktor`, der kommt aus `gaa_swf`) · `mod_*` mitsenden (fiktives
  Baujahr) · `bmf_vergl` + `vergleichsfaktor_vorhanden` dynamisch ·
  `vergleichswert` kommt bei inaktivem Zweig als Formel-Objekt zurück →
  defensiv lesen.
- **Die Rechnung ist korrekt** (LibreOffice-Sandwich: Inputs in die amtliche
  BMF-Vorlage Juni 2023 als Engine, Zellen gelesen).
- **Buster-Disziplin:** Includes in `index.html` (`bmf-modal.js`,
  `bmf-modal-v292.js`, `pdf-anlage-bmf.js`, `bmf-modal-v292.css`) **und** der
  fetch-Buster für `bmf-modal-html.html` in `bmf-modal.js`.

### KI-Beleg-Import (live seit 21.07.)
`frontend/js/beleg-import.js` (neu) + `backend/src/routes/ai.js` +
`backend/src/services/openaiService.js` + `bmf-modal.js`/`-html.html` +
`config.js` + `index.html`. **Hängt am BMF-Rechner.**
Ordner-Auswahl über `<input webkitdirectory>`; **Vision-Extraktion über die
Responses-API** (gpt-4o-mini / 4.1-mini, **kein separates OCR**) →
Datum/Betrag/USt/Aussteller/Kategorie; **Review-Liste, der Nutzer bestätigt vor
der Übernahme** (Steuer!); Auto-Kategorisierung AK/HK
(Herstellungskosten/Makler/Notar/Grundbuch/Fahrt/Verpflegung/Sonstiges);
15-%-Ampel. Kerosin-metered, Plan-Gate Investor+/Pro, DSGVO, von Anfang an
`--wl-*`.

### Voice-Import (Endstand v1000)
Original-Feldumfang, **5 Kategorien** (Stammdaten · Kauf & Nebenkosten · Miete ·
Finanzierung · Lage & Bewertung), `runQuickMatch`-Debounce **600 ms**.
`buildCatalog` = kuratierte Whitelist (Orbit) · **`buildFullCatalog` = ALLE
`window.FIELDS` für die Auswertung** — längere Transkripte füllen dadurch alle
Tabs, das ist gewollt. QC-Kontext filtert auf `QC_IDS`.
Guide-/KI-Stimme-/Schnell-Detail-Modi sind **komplett zurückgebaut**;
`backend/routes/ai.js` hat **keine TTS-Route**. Thema Guide/TTS zu den Akten,
bis Marcel es anders will.

### QuickCheck und AVM-Vorwahl
- QC-Iframe: `qc-bridge.js` `IFRAME_SRC='quickcheck-app.html?v=NNN'` bei **jeder**
  QC-Änderung bumpen **und** `qc-bridge.js` selbst bustern.
- **QC-Ring = echter DealPilot-Score** (`DealScore.computeFromKpis`, nicht DS2) —
  v969n. Spanne → Live-Wert bei Einzelquelle (v969b), AVM-Vorwahl von der
  Objektseite (v969c).
- **ZWEI AVM-Render-Stellen, nie verwechseln:**
  1. **Objekt-Tab Pre-Flight** = `object-actions.js` (`pfTileLogo`,
     Lead „BOARDING PASS")
  2. **QuickCheck** = `quickcheck-app.html` (statische `qc7-src`-Chips,
     „QUICKBOARDING PASS"; das Script `#qc-ph-enable` reaktivierte PriceHubble
     zur **Laufzeit** → ersetzen + Intervall-Re-Apply, 10 s, gegen Boot-Races)
- Flag: `AVM_PREFLIGHT_SOON = window.DP_AVM_PREFLIGHT_SOON ?? !/staging/i.test(location.hostname)`
  — Staging aus, Prod an.
- **NICHT anfassen:** `avm-section.js` (Ergebniskarten nach dem Abruf) ·
  `qc-bridge.js` `qcpm`-Overlay (Ergebnis-Picker).
- `object-actions.js` trägt die Feldnamen des Hauptformulars — dort nachsehen,
  nicht raten (`objart`, `eigen_r`, `leerstand`, `gsfl`).

### Weitere Module
`DpQr` clientseitig · Shared Pass (Mig 035) · ImmoMetrica (Mig 034,
AES-256-GCM, `IMMOMETRICA_MODE=stub`, 428 = kein Zugang) ·
API-Keys (Mig 047): `dpk_live_`, SHA-256, max. 5, nur Pro, Verwaltung nur per
JWT (nie per Key) · Steuer-Snapshot nur in `tax.js` (v732), `tax_snapshots`
(Mig 026), Debounce-POST über `window._scheduleTaxSnapshotPost`.

### Vertagt — nicht ohne neue Diagnose anfassen
**Logo-Saga:** V202–V207 alle erfolglos. Das PNG hat einen eingebrannten Rand →
CSS-only-Lösungen greifen nicht. Eine transparente Fassung existiert
(`dp-logo-clean-cropped.png`, 477×123), wurde aber nie zufriedenstellend
ausgerollt. **Vor jedem weiteren Logo-Patch: DevTools-Inspect der Live-Sidebar.**

---

## (B) MOBILE — `frontend/mobile-demo.html`

Same-origin zur Haupt-App, git-getrackt. **Superset-Prinzip: ein ZIP = volle
Datei.** Testen: echtes Mobil-Login im Gate (MA21) oder vorher im Cockpit
einloggen (same-origin `ji_token`). Am Handy Strg+Shift+R.

**MA-Historie (Kurzform):**

| | |
|---|---|
| MA01–13 | PWA-Infra · Prototyp · Data-Layer · KPIs/Login/Flotte/Detail/Kerosin · Quick-Boarding · AVM · Hub-Ehrlichkeit |
| MA14 | PDF-/Exposé-Import (PDF.js → `/ai/extract-expose`) |
| MA15/20 | Voice (`/ai/extract-voice`, 1 L) am echten Chip-Screen |
| MA21 | Mobil-Login im Gate (`Auth.login` → `ji_token` → boot) |
| MA22 | Lifecycle: Bearbeiten (PUT) · Löschen · Deal-Status (`data._deal_*`) · Foto (1600 px + Thumb 240 px) |
| MA23 | ImmoMetrica mobil (`GET /immometrica/*`) |
| MA24 | **Kombinierter QuickCheck-Flow:** Hub-Kacheln wählbar, „Abrufen (N)", sequenzielle Orchestrierung (expose → voice → immo → `POST /avm/dealpilot`), Auto-Boarding |
| MA25 | Wechselkarten im Detail: Score Investor↔Deal · Rendite brutto↔netto · Cashflow n.St.↔v.St. |
| MA26 | Boarding-Pass teilen + QR: `/passes` → `pass.html?c=code` |
| MA27 | Objekt-PDFs über die **echte Desktop-Engine** (offscreen iframe `/index.html` → `loadSaved` → `exportPDF`) — nur am Gerät testbar |
| MA28 | Fix-Batch: Wasserzeichen-Timing · PDF-Sheet · QC-LEDs · Kategorie-Bars-Flip |
| MA29 | **Anbieter-Neutralität:** SN/PH im Markt-Screen ausgeblendet |
| MA30 | Erweiterte Bearbeitung: klappbare Abschnitte + Notizen (4b iframe-Editor verworfen) |
| MA31 | Profil-Einstellungen: „Externe Anbieter" · „Tarif & Rechnungen" → Cockpit |
| MA32 | ImmoMetrica-Zugang mobil · DealPilot-Markt persistent (`data._dp_markt`) · Notizen im Detail |
| MA33 | **PWA-Installierbarkeit:** `dp-mobile.webmanifest` + `dp-mobile-sw.js` + Icons; SW **eng gescoped** auf `/mobile-demo.html` (network-first Shell) |
| MA34 | Gerätefixes: QC-LEDs über `data-goqc`/`_qcTileKey` statt `data-go` · **generisches** `_catBarsHtml(raw)` statt geratener Keys · „Tarif & Rechnungen" per `window.open(origin+'/')`, weil `location.href='/'` den PWA-Scope verlässt |
| MA35 | Direktaufruf-Sperre für `mobile-demo.html` |

**API-Verträge (Mobile):** `Auth.apiCall(path,{method,body})` — body als
**Objekt** (wird selbst stringifiziert), Bearer `ji_token` ·
`GET /objects?limit=100` (Listen-KPIs `cf_ns` = CENT/Jahr, `kaufpreis` = CENT) ·
`GET /objects/:id` → `{data, photos[], ai_analysis}` ·
**`PUT` ERSETZT `data` + `photos`** → vor jedem Update das volle Objekt holen und
`photos` durchreichen · `POST /avm/:provider` → `{result, cost, mode}` ·
`/ai/extract-voice` (1 L) · `/ai/credits`.
**SSoT gilt auch mobil:** `DealKpis` / `DealScore` / `Dscr`.
Cashflow = `_kpis_cf_ns/12`.

**Mobile Boarding-IDs → Objektfelder:** `hg_ul`↔`mb_hg` · `hg_nul`↔`mb_hgsplit` ·
`d1z`↔`mb_zins` · `d1t`↔`mb_tilg` · `ji_p`↔`mb_knk` · `baujahr`↔`mb_bj`.

---

## (C) LANDING — `frontend/landing/index.html`

Getrackt, **self-contained** (~1 MB, keine eigenen externen JS/CSS außer Google
Fonts). Deploy = eine Datei committen → main → Prod-Pull.

### Aufbau (seit v851-landing)
**Views** über `data-view` (kein Routing): `view-landing` · `view-api` ·
`view-lu` (Leistungsumfang). Nav-Links `data-scroll` (Anker) bzw. `data-view`.

- **Cockpit-Intro `#dp-intro`** (23.07.): 4,0 s, Klick **irgendwo** überspringt,
  Esc, 1×/Session, kein Ton-Button. Das alte Licht-Intro (`intro-kerosin`,
  `#dpi-css`) ist per CSS **stillgelegt, nicht gelöscht** —
  `#intro{display:none!important}`, Rollback holt es zurück.
- **Hero:** `dp-hero-flug.mp4`, altes COMING-SOON-Standbild per CSS aus.
  DealScore-Karte als **echte HTML-Karte** animiert (Ring, Zahl, 5 Balken),
  Wiederholung alle 10 s bei Sichtbarkeit.
- **Pricing:** echte Sektion ist `id="pricing"` mit Boarding-Pass-Tickets `.tk`
  (Abrisskante `.tk-rip`, Perforation, Barcode, „Boarding Pass · DP-0N",
  Business-Karte `scale 1.045` + Gold-Glow + Sheen). Ticket-Mitten **pur weiß**.
  Jahres-Toggle. Flugklassen-Naming (Economy / Premium Economy / Business /
  First) war eine bewusste Marcel-Entscheidung; technisch bleibt
  `?plan=free/starter/investor/pro`. **Konsistenz-Punkt offen:** App, Stripe,
  Settings und Mails sagen weiter Free/Starter/Investor/Pro.
- **Kerosin-Nachtanken:** weißer umschaltbarer Boarding-Pass, Kauf-Link
  `?register=1&kerosin=N`. Reichweite nur DealPilot-attribuiert.
- **Cockpit-Matrix:** 31 Zeilen Feature-Vergleich.
- **Trust-Band:** Made in Germany · Server in Deutschland (Hetzner) ·
  DSGVO-konform · SSL · Sachverständigen-Methodik (DESAG).
  **„ImmoWertV-konform" wird bewusst NICHT behauptet** — DealPilot ist ein
  Analyse-Tool, kein Verkehrswertgutachten.
- **Modulkarten** (19): Partnernetzwerk statt RND-Gutachten, Spracheingabe,
  ImmoMetrica (namentlich ok), Marktbewertung **anbieterneutral**
  („zwei professionelle Bewertungspartner"), Werbungskosten mit BMF-Rechner.
- **Live-Marktzinsen:** `GET /api/v1/market-rates/pfandbrief?maturities=5,10,15,20`;
  Badge steht auf „Indikativ" und wird **nur bei echtem Fetch-Erfolg** auf
  „Live" gesetzt (Ehrlichkeitsprinzip). Beide Renderer sind domain-aware.
- **Leistungsumfang-View:** Hero + Inhaltsverzeichnis mit 18 Sprunglinks +
  18 Abschnitte alternierend hell/dunkel; RND-Abschnitt mit gutachten.org.
- **API-View:** 7 Sektionen inkl. **vollständiger Feldreferenz** (alle
  `FIELDS`-IDs aus `storage.js`, gegen die Live-FIELDS verifiziert, 0 fehlend)
  und einem ehrlichen Abschnitt „Grenzen & Roadmap" (Daten-API; keine
  On-Demand-Berechnungen, kein KI/AVM per Key, kein PDF-Trigger, keine Webhooks).
- **Partnerlogo CareTech Thiel** (v1136i/j) — Zuschnitt war das Problem, nicht
  die Größenregel.

**Zeiten-Regel für Texte (konsistent halten):** händische Eingabe ca. 1 Minute ·
Import/Schnittstelle 30 Sekunden · Vollanalyse 10 Minuten · Boarding 30 Sekunden.

### Promo-Layer (23.07.) — eine Logik, zwei Ansichten
Landing und App rendern dasselbe Markup
`<div class="tk-price" data-m="29" data-y="290">`, deshalb genügt ein Layer.

| | Landing | App |
|---|---|---|
| Datei | `landing/promo-erstflug.js` | `js/promo-erstflug.js` |
| Grid | `.tkg` | `.ppg` in `#pricing-plugin-host` |
| Umschalter | `#ptoggle` | `.dp-toggle-btn` |
| Aufbau | statisch | dynamisch → MutationObserver + rAF-Warteschleife |

**Drei Zustände:** `promo` (Landing immer, App nur ohne bezahlten Plan) ·
`founding` („Du fliegst als Founding Member — 16 % dauerhaft") · `off`.
**Die Wahrheit kommt aus Stripe, nicht aus der DB** — kein Feld, keine
Migration; der Founding-Status wird an der Subscription gelesen
(`discount.coupon.percent_off`), serverseitiger Cache 5 min.
**Fail closed:** kein Stripe, kein Code, Fehler → `active:false` → nichts wird
angezeigt. Vorschaumodi `?promo=demo` · `?promo=founding` · `?promo=fresh`.
Endpunkte: `GET /plans/promo` (öffentlich) · `GET /subscription/promo`
(eingeloggt).

**Parallel laufende Renderer:** beide Seiten setzen `<b>` selbst
(`setP()` bzw. `_updatePpgPrices()` in `pricing-modal.js`). Der Promo-Layer
schreibt **nach** ihnen (`setTimeout 0`) und räumt vor jedem Zeichnen seine
eigenen Elemente ab.

### Landing-Analytics (v973)
Tabelle **`landing_events`** (Migration 063, Haupt-DB): `session_id`,
`event_type` (pageview | scroll | section | cta | exit | heartbeat), `path`,
`section`, `value`, `referrer`, `device`, `utm_*`, `created_at`.
**Keine IP, keine PII, kein Cookie** — `session_id` ist Zufall aus
`sessionStorage` und verfällt beim Tab-Schließen. Anonym by design.

`POST /api/v1/track`: **öffentlich** (die Landing hat keinen Login),
rate-limited beim Mount (60 s / 120), Event-Whitelist, Größen-Cap,
**immer 204** (fire-and-forget).
`GET /api/v1/admin/landing-analytics?days=N` aggregiert Besucher, Pageviews,
Verweildauer, Bounce, Zeitverlauf, Funnel, Absprung, CTA, Geräte, Referrer.
Client: `navigator.sendBeacon`, sonst `fetch keepalive`; Scroll 25/50/75/100,
IntersectionObserver auf `section[id]`, Exit über `pagehide`/`visibilitychange`.

**Die Caddy-405-Falle:** Die Landing-Domain liefert per `file_server` aus, und
`file_server` erlaubt nur GET/HEAD → jeder POST auf `/api/v1/track` kam als
**405** zurück (nicht 404). Fix: ein eigener `handle`-Block für `/api/v1/track*`
→ `reverse_proxy backend:3001`, **vor** den `file_server`-Handles. Die
Caddyfile ist repo-gepflegt. **Nie die ganze `/api` auf die Landing-Domain
hängen** — Auth-Routen haben dort nichts verloren.

---

## (E) RESELLER / WHITELABEL — die `--wl-`Ebene

Jedes Gold-Literal in der App steht als `var(--wl-<hex>, #<hex>)`, z. B.
`var(--wl-c9a84c, #C9A84C)`. Die Tokens sind in **keinem** `:root` definiert;
nur `whitelabel-override.js` setzt sie (`setWlTokens()` in `apply()`).

- **Standard-DealPilot:** der Fallback greift immer = exakt das Literal.
- **Whitelabel:** alle 66 Töne folgen dem Akzent (`recolor` überträgt
  Farbwinkel-, Sättigungs- und Helligkeitsversatz relativ zum Basisgold);
  `recolor('#C9A84C', acc) === acc`.
- **`WL_TINTS` ist DIE Liste.** Neuer Ton nötig? Dort eintragen, sonst bleibt
  die Stelle stumm gold.

**NICHT in WL_TINTS, mit Absicht:** Rottöne (`#B8625C` `#B86250` `#8C4843`
`#D98579` `#B94F3A` `#D9685F` `#F0D4CC`) · Statusfarben (`#E89B2F` `#E0A030`
`#A16207` `#E8B84F` `#d9a441` `#d9655b` + Ampelmitten im Marktbericht-PDF) ·
warme Grautöne (`#F2ECDC` `#CDBF9A` `#A89F8C` `#ECE4D2` `#E8E2D4` …) ·
`--dp-card #FBF6E9`. `rgba(201,168,76,0)` bleibt (Alpha 0).

**Wo `var()` NICHT funktioniert — die fünf Fallen:**
1. SVG-Präsentationsattribute (`stroke`/`fill`/`stop-color`) → `window._wlc('#hex')`
2. Canvas `fillStyle`/`strokeStyle` → `window._wlrgbaH('#hex', a)`
3. Leaflet `L.circleMarker` (setzt intern SVG-Attribute)
4. jsPDF `setFillColor(RGB-Tripel)` → `_pdfGold()` / `_wlRgb` / `GOLD_D/M/L`
5. Data-URIs `url("data:…%23C9A84C")` — geht **nie** (4 Icons in `style.css`)

**Die richtige Frage lautet: „landet ein `var()`-String, wo `var()` nicht
gilt?"** — nicht „ist noch rohes Gold da?". W36 hat so die Charts zerschossen,
W40 hat repariert.

**Wächter:** `python3 /opt/dealpilot/tools/gold-audit.py [--alle]` — read-only,
RC=0 sauber. **Vor jedem Rollout.** ~489 bekannte Fundstellen = Backlog, kein
Blocker. Blinde Flecken: RGB-Tripel (jsPDF) und `var()`-Strings in
Trägervariablen. **Nicht anfassen:** `config.js` · `branding-darstellung.js` ·
`darstellung-reseller.js` (der Farb-Editor **muss** Literale tragen) ·
4 Data-URI-Icons. **Kein blinder Sweep** (~118 Statusfarben-Resttöne).

**Reseller-Regeln:** Kontext immer über `getResellerForUser` ·
`subscriptions`-INSERT **mit** `billing_interval` · Objektzugriff nur bei
aktiver `object_shares` · Seat → Mandant wird INVESTOR ·
**Kerosin-Kaufbestätigung bleibt DealPilot** · Track Record nicht für den
Partner · **ungepflegte Reseller-Felder werden GELEERT, nie auf Junker
zurückgesetzt** · SN/PH-Logos nicht vom Sweeper überschreiben (W23).

---

## (F) ADMIN — `frontend/admin/`, eigene App

- `admin-api.js`: `const API` (IIFE), `call()`, `X-Admin-Token`.
  `admin-app.js`: `switchView`-Kette, `requireAdmin`/`requireRole`, Views
  dashboard / users / audit / credits / support / satisfaction / invoices /
  retention / landing / Marktzinsen.
- **Zusatzmodule additiv NACH `admin-app.js`:** `admin-extras.js`,
  `admin-retention.js`, `admin-stats.js`, `admin-audit-tools.js`,
  `admin-landing.js`. Backend-Routen in `admin.js` vor `module.exports`.
- **Der Admin-API-Wrapper exportiert KEIN `call()`** — nur benannte Methoden.
  Eigene Module machen ihr **eigenes** `fetch(BASE + path)` mit
  `BASE='/api/v1/admin'` + `X-Admin-Token`. (v973a-Fix; einmal geraten,
  einmal bezahlt.)
- **Admin-Charts = eigener SVG-Helfer, nicht Chart.js:**
  `Charts.renderLineChart(container, data, opts)` + `Charts.renderDonut`.
- **Admin-Textfarben:** `var(--text)`/`var(--text-muted)` lösen im Admin
  **dunkel** auf → auf dunklen Karten unlesbar. Feste helle Töne nehmen
  (`#F2ECDC` Werte/Überschriften, `#A89F8E` Labels, `#E8E2D4` Balken). Bei
  eingebetteten Panels die **echte** Kartenhelligkeit messen
  (`getComputedStyle`), nicht den Skin raten.
- **Retention:** `retention_settings`/`_log` (045) + templates/background (046),
  Scheduler v799 (+60 s, 24 h, Auto-Versand default AUS).
  `dp-rich-editor.js` ist mehrfach instanziierbar und muss **vor**
  `admin-retention.js` geladen werden.
- `statsService` liest nur Bestandstabellen (`ai_credits_log`: user_id,
  endpoint, cost, source, meta).
- **Admin-Login geht gegen `admin_users` (bcrypt).**
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` in der `.env` sind **nur Erst-Seed** — eine
  `.env`-Änderung ändert einen bestehenden Admin **nicht**.

---
---

# TEIL III — (D) MARKTBERICHT UND WERTERMITTLUNG

## MARKTBERICHT — ARCHITEKTUR

- **App** `/opt/dealpilot/frontend/marktbericht-app/` (`app.js` ~4400 Zeilen,
  `wertermittlung.js`, dazu `mb-wizard.js`, `mb-stufen.js`, `mb-objektwahl.js`,
  `feldhilfe.js` aus dem Parallel-Strang), läuft als **iframe** über
  `frontend/js/marktbericht-view.js` (`#mbv-frame`). **IMMER HELL** — keine
  Dunkelfarben in neuen Bausteinen (Feldrahmen `rgba(255,255,255,…)` sind dort
  unsichtbar). Tachos gold.
- **Eigenes mb-Backend:** `/opt/dealpilot/marktbericht/backend/` (Node, **ESM!**
  `node --check` nur als `.mjs`-Kopie). Container `dealpilot-mb-backend`,
  Compose-Service `mb-backend`, Port 4000 **nur im Docker-Netz** (Caddy kennt
  ihn nicht). Deploy = Image-Rebuild. Abhängigkeiten bewusst nur `cors`,
  `express`, `pg` — ZIP über eingebautes `zlib`, HTTP über `fetch`.
  **`backend/tools/` liegt mit im Image** (gemessen 12.08.) — dort steht
  `register-saat.mjs` und läuft per `docker exec … node /app/tools/…`.
- **Eigene mb-DB:** `dealpilot-mb-db` (PostGIS), Schema `mb.` —
  **STEHT IN KEINEM BACKUP-SKRIPT** (die sichern nur `dealpilot-postgres`) →
  vor jedem Eingriff eigener `pg_dump`.
- **Proxy** `backend/src/routes/marktbericht.js` → `mb-backend:4000`.
  **KEIN Catch-all**, jede Route einzeln, `forward(method, path, opts)`
  (query + body zusammen).
  **`qstrUser()` setzt `user_id` IMMER aus `req.user.id` — jede neue Route MUSS
  da durch**, sonst Datenleck beim Lesen bzw. ein Löschknopf für fremde
  Berichte (v942-userbind).
  **Dieser Proxy liegt im HAUPT-Backend** — Änderungen daran brauchen einen
  Rebuild von `backend`, nicht nur `mb-backend`.
- **`DELETE /reports/:id`** (v966): Besitz-Nachweis **zuerst** am Snapshot
  (keine Zeile → 404), dann Transaktion Kinder zuerst: `object_snapshots` →
  `market_reports` → `valuation_results` → `deal_scores` → `micro_locations` →
  `properties`. `marktbericht_cost_log` (Haupt-DB!) bleibt.
- **mb-Schema ohne `ON DELETE CASCADE`:** `properties → addresses`
  (**geteilter Geocoding-Cache, NIE löschen**); `market_reports` /
  `valuation_results` / `deal_scores` / `micro_locations` → `properties`;
  `object_snapshots` → beides. Nur `market_reports` und `object_snapshots`
  tragen `user_id`. `properties` wird je Lauf neu angelegt → 1:1:1.
- **Buster-Kette (4 Glieder):** `frontend/index.html` →
  `marktbericht-view.js?v=N` → iframe `marktbericht-app/index.html?v=N` →
  `app.js?v=N` **und** `wertermittlung.js?v=N`. `apply.sh` zieht sie automatisch
  mit; **das sed-Muster generisch halten** (`\?v=1[01][0-9]{2}`), nicht auf
  Dekaden festnageln. Das oberste Glied kann keinen Buster tragen → **Strg+F5**.
  Diese Kette wurde **viermal** vergessen; die Änderung war jedes Mal richtig
  und kam nie an.
  **Der Buster muss sich nur ÄNDERN, nicht steigen** — aber steigen ist
  sicherer. `apply.sh` von v1083b liest deshalb den höchsten vorhandenen Wert
  und setzt alle Glieder eins darüber. Stand nach dem Rollout: **1154b**.
  In `marktbericht-app/index.html` hängen inzwischen mehr als vier Skripte mit
  eigenem Buster (`mb-wizard.js`, `mb-stufen.js`, `feldhilfe.js` …) — die Liste
  aus `grep -o "v=1[01][0-9][0-9]"` enthält also mehrere verschiedene Werte.
  **Nicht die Liste prüfen, sondern die Zuordnung** (`grep -n "app\.js"`).
- **`app.js` sammelt den Wertermittlungsblock nicht selbst ein** — es übernimmt
  `window.Wertermittlung.payload()` als Ganzes. **ABER `_mbBuildObjData()`
  schon**, und zwar über DOM-Ids. Das ist der Rückweg ins Portfolio: **neue
  Felder müssen dort MIT eingetragen werden**, sonst rechnet der Bericht damit
  und das gespeicherte Objekt verliert sie (v1072-Befund).
- **`ref` im Orchestrator ist eine ausdrückliche Feldliste.** Was dort nicht
  steht, kommt nicht an. **Und `ref.ags` wird direkt nach der AGS-Auflösung
  zurückgeschrieben** (`ref.ags = ref.ags || _agsWert`, v1075-WAGS) — alle
  nachgelagerten `ags:`-Leser hängen daran. **Diese Zeile NIE entfernen.**
- **Formular-Rendering:** jedes Feld hat einen Wrapper `wm-w-<id>`
  (`feld()`/`block()` in `wertermittlung.js`). Die Klappblöcke
  („Feinjustierung nach Gewerken", „Sonstige Bauteile", v1075/76-WUI) sind reine
  Darstellung: ein MutationObserver verschiebt die Wrapper in Kästen mit
  Zustands-Chip; `payload()` liest weiter über die Ids. Zugeklappt gilt die
  glatte Stufe. **Felder mit `wenn:`-Bedingung** (`garagenStufe`,
  `hinterlandRent`) erscheinen nur nach echter Nutzereingabe — programmatisches
  Setzen rendert sie nicht nach (unkritisch: das Backend hat Rückfallwerte).
- **PDF wird im Browser frisch gemalt** (`exportPdf()`, NICHT in `render()`).
  Alter Bericht + neuer Code = neue Optik; nur `report_md` (die KI-Kapitel) ist
  in `mb.market_reports` eingefroren. **jsPDF kann nur Helvetica**
  (kein Font-Embedding), **kein U+2212**, Pfeile als `->`, `charSpace`
  zurücksetzen (wirkt über den Aufruf hinaus), Kapitelumbruch über
  `sectionTitle(t, reserve)`. Block „Sachwertverfahren — Rechenweg" steht vor
  dem Ertragswert-Block. PDF-Gold über **eine** Quelle: `window._pdfGold()` /
  `_wlRgb` / `GOLD_D/M/L` (v963); verbleibende Gold-RGB sind Ampelmitten und
  bleiben hart.
- **KI-Bericht:** `ReportGenerationService.js`, `CHAPTER_GROUPS` (3 parallel),
  `rawCompletion(messages, {maxTok, effort, isNewModel})` über `httpJson` +
  `cfg.ai.model`. `keepOnlyChapters()` verwirft fremde Kapitel (v960).
  `generateVerlaufText` (v972b) nutzt dieselbe `rawCompletion`.
- **Marktbericht-Verlauf** (v972, Tab in der Pilot-Analyse): nutzt die
  **bestehende** Route `/api/v1/marktbericht/objects/history?key=dp:<objId>` —
  kein neues Backend nötig. Erscheint erst ab **≥ 2 Berichten**. Chart im
  Cockpit-Stil (`window.Chart`), indexiert, Metrik-Chips, Delta-Tabelle,
  **theme-aware** (`_dpVIsLight()` misst die echte Kartenhelligkeit).
  Daten-Abgleich neuester Snapshot vs. aktuelle Objektfelder
  („basiert auf aktuellen Daten" / „weicht ab" / „nicht vergleichbar");
  `property_type`/Adresse bewusst **nicht** (Vokabular `geo: 'wohnung'` ≠
  `objart 'Eigentumswohnung'`). **KI-Trend-Text 1 L**, ehrlicher Prompt
  („sagt STEIGT/FÄLLT/SCHWANKT/STABIL, erfinde keinen Trend"), nicht eingefroren.
- **Migrationen mb-Track:** 001–014 vergeben, **nächste 015**. v1083 kam ohne
  neue Migration aus — `mb.param_modell` aus Migration 014 passte unverändert.
  `marktbericht_cost_log` liegt in der **HAUPT-DB**.
- **Die Migrationstabelle der mb-DB heißt `public._mb_migrations`** — nicht
  `schema_migrations`, nicht im Schema `mb.`. Sie führt **Dateinamen**, keine
  Versionsnummern (zweimal falsch geraten):
  ```
  docker exec dealpilot-mb-db psql -U mb -d marktbericht \
    -c "select * from public._mb_migrations order by applied_at desc limit 3;"
  ```
  Ob eine Tabelle wirklich da ist, sagt `select to_regclass('mb.<name>');`
- **Leiche:** `marktbericht/frontend/app.js` liegt unerreichbar im mb-Image.
  Aufräumen = eigenes Paket, nie am Rollout-Tag.

---

## AMTLICHE DATEN — WOHER SIE KOMMEN

**Alle NRW-Grundstücksmarktberichte liegen kostenfrei bei `gars.nrw` und
`boris.nrw`, Datenlizenz Deutschland Zero 2.0.** 73 Ausschüsse.

### Die Beschaffung, gemessen am 11./12.08.

**`boris.nrw.de/robots.txt` sperrt `/borisfachdaten/` vollständig** (einzige
Ausnahme `/borisfachdaten/standardmodelleAGVGA/`). Dort liegen ALLE NRW-GMB-PDF.
Das ist keine Schutzgebühr, sondern eine robots-Sperre — derselbe Fall wie
seinerzeit `gis.nrw.de`. **Ein Anfragetext an den Oberen Gutachterausschuss
liegt vor** (`claude/`), noch nicht abgeschickt. Bis zur Klärung lädt Marcel
diese PDF selbst im Browser; das ist der vorgesehene Fall. **Automatisiert wird
dort nicht zugegriffen — auch nicht über einen ferngesteuerten Browser.**

**`gars.nrw` und die Kreisseiten sind frei** und dürfen automatisiert geladen
werden.

**`opengeodata.nrw.de` ist der offene Verteilserver und NICHT gesperrt.** Dort
liegen die `GMDNRW_*_CSV.zip` — das ist der Weg zu den Liegenschaftszinssätzen
für ganz NRW, ohne die robots-Sperre zu berühren. Der CKAN-Eintrag dazu:
`open.nrw/dataset/ad760913-eb7b-4843-b3b7-dc9100b788ca`.

**Chrome-Downloads über die Fernsteuerung:** Chrome blockt mehrere automatische
Downloads je Seitenaufruf **stumm**. Zwei je Aufruf gehen durch, danach ist
Schluss; die Seite muss neu geladen werden. Steht die Domain einmal in der
Blockieren-Liste unter `chrome://settings/content/automaticDownloads`, hilft nur
das Entfernen des Eintrags. Der `download`-Attribut-Trick wirkt nur
**same-origin** — für `gars.nrw` also von `gars.nrw` aus auslösen.
**Zwei Dateien in einem Aufruf gehen zuverlässig** (am 12.08. belegt: beide
GMD-Archive in einem Zug).

### Die Verarbeitung — die Leiter hat drei Stufen

1. **`pdftotext -layout`** löst den Löwenanteil. **458 Seiten am Stück ohne
   Abbruch; am 12.08. zusätzlich belegt mit 158 (Höxter) und 110 Seiten
   (Märkischer Kreis).** Die Grenze der Web-Extraktion (Abbruch nach 45–57
   Seiten) existiert hier nicht — sie war nie eine Grenze des PDF.
   Gegenprobe: Seitenzahl aus `pdfinfo` gegen die Zahl der Seitenumbrüche
   (`tr -cd '\f' | wc -c`) im Text.
2. **Die Seite als Bild lesen**, wenn `pdftotext` nur eine Bildunterschrift und
   darunter nichts liefert — dann steckt die Tabelle als Grafik im PDF
   (der Bochum-Fall).
3. **Immer gegen das Anwendungsbeispiel rechnen.** Ohne diesen Schritt wäre am
   10.08. eine **frei erfundene** Sachwertfaktor-Matrix ins Modul gewandert;
   dieselbe Extraktion hatte auch die Fallzahl verdreht (847 statt 747).

### Zwei Lizenzen aus demselben Haus, nicht verwechseln

| | |
|---|---|
| Grundstücksmarktberichte | `dl-de/zero-2-0` — keine Bedingungen |
| Grundstücksmarktdaten NRW (CSV) | `dl-de/zero-2-0` |
| **Bodenrichtwerte BORIS-NRW** | **`dl-de/by-2-0`** — Namensnennung, Quellenvermerk pflichtig |

Einzelne Berichte sind in sich widersprüchlich (Märkischer Kreis führt
Lizenztext Zero 2.0 **und** Quellenvermerk by-2-0). Vor der Übernahme am
Dokument prüfen. Quellenvermerk wörtlich: *„Der obere Gutachterausschuss für
Grundstückswerte im Land Nordrhein-Westfalen (www.boris.nrw.de), dl-de/by-2-0"*

**Grenzen, die nicht verschoben werden:** kostenpflichtige Berichte NIE abrufen
(Meißen 20 €, Sachsen-Anhalt ~30 €, RLP 150 €) · Captcha = Ansage, nicht Hürde
(Thüringen) · robots-Sperre = Ansage · ein Abruf je Sekunde, eigene Kennung mit
Kontakt. **Ausnahme BORIS-D:** `gis.nrw.de` weist Anfragen ohne Browser-Kennung
mit 403 ab; Marcel hat das mit der Stelle geklärt (Aktennotiz), Kennung über
`BORISD_USER_AGENT`.

**Nicht crawlen, wo eine Datei existiert.** Behördenportale sind Weboberflächen
für Menschen (`boris.nrw.de` = 9.440 Bytes JavaScript, null Links). CKAN
abfragen und die Datei ziehen.

**Konnektoren:** `BorisConnector` (Bodenrichtwerte, ArcGIS, 16 Länder) ·
`IrwConnector` (Immobilienrichtwerte § 20 über WMS, Jahrgänge ab 2011) ·
`OpenDataConnector` (NRW CKAN) · `opendata/` (AK-OGA bundesweit, Parser P1).

### Grundstücksmarktdaten NRW — die maschinenlesbare Quelle

`GMDNRW_CSV.zip` von `opengeodata.nrw.de/produkte/infrastruktur_bauen_wohnen/boris/GMD/`,
8,5 MB, dl-de/zero-2-0, Herausgeber Oberer Gutachterausschuss c/o
Bezirksregierung Köln. Sechs Dateien:

| Datei | Inhalt |
|---|---|
| `lzs.csv` | **73 Zeilen × 181 Spalten** = 5 Kopffelder + 11 Objektarten × 16 Kennzahlen |
| `schluessel.csv` | 428 Gemeinden mit Zuordnung zu Kreis, Ausschuss und Region |
| `baulandpreise.csv` | Bodenrichtwertniveaus je Lage und Nutzungsart |
| `efh.csv` / `we.csv` | Durchschnittspreise je Altersklasse |
| `umsatz.csv` | Kauffälle, Flächen-/Geldumsatz, Preisentwicklung, Erbbauzinssätze |
| `allgemein_erlaeuterung.xlsx` | **die amtliche Feldbeschreibung** |

**Wichtig für die Zeitangabe:** die Ausgabe **2025** trägt das Berichtsjahr
**2024** (Berichtszeitraum 01.01.–31.12.2024). Die von Hand geernteten GMB sind
Jahrgang **2026** (Berichtsjahr 2025) — das CSV ist also **einen Jahrgang
älter**. Bei Konflikt gewinnt der jüngere Jahrgang, nicht die Quelle.

**Die Marker-Semantik steht in der xlsx, nicht im Kopf:**
`-` keine Angabe · `*` Anzahl kleiner 3 bzw. 5 · `.` kein Markt →
alle drei ergeben `None`, **nie 0**.
Dazu die dokumentierte Ausgaberegel: *„lzs: Ausgabe je Gutachterausschuss,
Ausgabe nur wenn Anzahl gleich oder größer 5"* — das ist eine Prüfung, die man
geschenkt bekommt.

**Die elf Zweige:** `efh` freistehend · `zfh` · `rhdhh` Reihen-/Doppelhäuser ·
`dreifh` · `mfh` (gew. Anteil ≤ 20 %) · `ggg` gemischt genutzt · `handel` ·
`buero` · `gegi` Gewerbe/Industrie · `we_s` Wohnungseigentum selbstgenutzt ·
`we_v` Wohnungseigentum vermietet.

**Je Zweig 16 Kennzahlen:** Unsicherheitsvermerk · Zinssatz · Standardabweichung ·
Fallzahl · **Anzahl ausgewerteter Geschäftsjahre** · Objektgröße (± s) ·
Kaufpreis €/m² (± s) · Marktmiete €/m² (± s) · **Bewirtschaftungskostenquote**
(± s) · Restnutzungsdauer (± s) · **Gesamtnutzungsdauer**.

**Encoding cp1252, Trenner `;`, Dezimalkomma.**

### `gaa_kennz` ist NICHT der Ausschussschlüssel — eine scharfe Falle

Gemessen: `schluessel.csv` hat 428 Zeilen mit **428 verschiedenen** `gaa_kennz`.
Es ist ein Schlüssel **je Gemeinde**, nicht je Ausschuss.

```
05758000  Herford, Kreis   gaa 31000   <- dieser traegt die LZS-Zeile
05758016  Hiddenhausen     gaa 31003   <- keine LZS-Zeile
05770024  Minden           gaa 26100   <- eigener Ausschuss MITTEN im Kreis
        (leer)             gaa 22200   <- Verbund Dorsten/Gladbeck/Marl, KEIN eigener AGS
```

**14 NRW-Kreise tragen mehr als einen Gutachterausschuss:** Wesel vier (Kreis,
Dinslaken, Moers, Wesel), Mettmann und Märkischer Kreis je drei, dazu Düren,
Rheinisch-Bergischer Kreis, Borken, Recklinghausen, Steinfurt, Minden-Lübbecke,
Paderborn, Hochsauerland, Siegen-Wittgenstein, Soest, Unna.
**20 Städte haben einen eigenen Ausschuss innerhalb ihres Kreises** — darunter
Iserlohn, Lüdenscheid, Minden und Stadt Paderborn, also genau die, für die
eigene GMB existieren.

Die richtige Auflösung ist die Kaskade, und die Daten tragen sie nativ:
**Gemeinde (8 Stellen) zuerst, dann Kreis (5 Stellen).** Damit werden 420 von
428 Gemeinden abgedeckt.

---

### Bundesweit: es gibt KEINE Sachwertfaktor-Quelle

Recherchiert und belegt am 10.08.:

- Der **Immobilienmarktbericht Deutschland** des AK OGA schließt die
  erforderlichen Daten ausdrücklich aus: *„Die hier veröffentlichten Daten
  eignen sich grundsätzlich nicht zur Ermittlung von Verkehrswerten … sind den
  Marktberichten der jeweils zuständigen Gutachterausschüsse zu entnehmen."*
- **BORIS-D** transportiert nach dem VBORIS-/BRM-Modell nur Bodenrichtwerte.
- **Kein Open-Data-Datensatz** „Sachwertfaktoren" in GovData, open.NRW, Berlin,
  Schleswig-Holstein.
- **Kommerziell** führt sie einzig Sprengnetter bundesweit — nach eigenem
  Hilfe-Center im **Fünf-Jahres-Rhythmus** fortgeschrieben und vor Gebrauch
  lokal zu kalibrieren. Also abgeleitet, nicht amtlich.

**Maschinenlesbar gibt es nur:** Liegenschaftszinssätze für NRW aus
`Grundstücksmarktdaten NRW` (CSV, Zero 2.0) und Immobilienrichtwerte NRW als
Shapefile (§ 20, nicht § 21 Abs. 3).
**Landesweit gebündelt, aber als PDF:** Rheinland-Pfalz (150 €),
Sachsen-Anhalt (kostenfrei, ein einziger Ausschuss fürs ganze Land seit 2014),
Berlin (kostenfrei; Sachwertfaktor-PDF Jahrgang 2025, Stand 04.02.2026, frei bei
berlin.de). Bayern und Schleswig-Holstein sagen in ihren Landesberichten
ausdrücklich, dass sie diese Daten **nicht** enthalten.

**Das ist der Burggraben.** Wer amtliche kreisscharfe Sachwertfaktoren will,
muss dieselbe Handarbeit leisten — es gibt keine Datei, die man einmal zieht.
**Für Liegenschaftszinssätze gilt das in NRW nicht mehr:** die stehen seit dem
12.08. flächendeckend im Register.

### Zum Wettbewerb (beide vermessen am 10./11.08.)

**immobilien-wertermittlung.de (ImmoInvent GmbH)** — Tooltip wörtlich:
*„Der angegebene Sachwertfaktor wird über einen internen Algorithmus ermittelt.
Dieser deckt sich aber nicht zwangsläufig mit den Sachwertfaktoren der
Gutachterausschüsse…"* An der Löhner Straße schlägt der Assistent **1,13** vor,
wo die amtliche Herford-Matrix rund 0,87 liefert. Das Formular hat genau ein
Textfeld `sachwertfaktor` — kein Feld für Ausschuss, Stichtag, Quelle oder
Stufe. Liegenschaftszinssätze für Wohnen und Gewerbe werden dagegen geführt.
**Ihr Baupreisindex ist stichtagsfähig** (jedes Quartal seit 2000 wählbar).

**ImmoAnalyse.Pro** — Deal-Pipeline mit angehängter Bewertung. Im Code stehen
`sachwertfaktor_efh: null` und `sachwertfaktor_mfh: null`;
`liegenschaftszinssatz_whg` und `_gew` sind dagegen gefüllt. Die Schnellanalyse
kam an der Löhner Straße auf **507.390 €** gegen 350.094 € Gutachten, weil sie
den Bodenrichtwert auf die **volle** Grundstücksfläche legt — ohne
Umrechnungskoeffizient, ohne Gartenlandansatz.
**Was sie besser können:** Suchagenten, Pipeline, Due Diligence, Fix & Flip,
**Ankauf-Widget zum Einbetten**. Das ist die Sourcing-Seite, die bei uns als
Deal Tracker auf der Liste steht.

Beim Wohnrecht sieht deren Rechnung nach **Doppel-Abzinsung** aus (Faktor 2 zu
niedrig). Falls wir je ein BOG/Wohnrecht-Modul bauen: klassische
Leibrentenmethode, gegen Handrechnung belegt, **NICHT abschauen**.

---

## DAS AUSSCHUSS-REGISTER — SEIT 12.08. AUF PRODUKTION

### Die drei Bausteine

| Datei | Marker | Rolle |
|---|---|---|
| `lib/swf_modelle.js` | `v1083-WMOD` | **acht Auswerter, ein Vertrag** — rechnet |
| `lib/ausschuss_register.js` | `v1083-WREG` `v1083a-WLAZ` | hält das Register, löst die Zuständigkeit auf |
| `lib/register/lzs-nrw.json` | — | **493 Datensätze**, versionierte Saatdatei (663 KB) |
| `lib/gutachterausschuss.js` | `v1083-WKAS` `v1083-WLZS` `v1083-WHFL` | **der Auflöser** — einzige Stelle nach außen |
| `tools/register-saat.mjs` | `v1083-WSAAT` | schreibt die Saat nach `mb.param_modell` |

### Neun Modellformen, acht Auswerter

**Jeder Ausschuss veröffentlicht in eigener Struktur.** Gemessen an 21 Berichten
des Jahrgangs 2026 gibt es nicht drei Formen, sondern **neun**:

| Form | Ausschüsse |
|---|---|
| `matrix_interp` Matrix, zwei stetige Achsen, Kreuzinterpolation | Minden-Lübbecke (SW × RND), Herford (SW × BRW), Höxter (SW × BRW), Kreis Paderborn (SW × Lagewert) |
| `matrix_kategorial` x stetig, y kategorial | Bielefeld (SW × Wohnlage mittel/gut/sehr gut) |
| `matrix_band` beide Achsen Bänder, KEINE Interpolation | Düsseldorf (Baulandfläche × Baujahresgruppe) |
| `stufen_1d` eine stetige Achse | Iserlohn, Märkischer Kreis, Lüdenscheid (Tabellenfassung) |
| `potenz` Y = a · X^b | Lüdenscheid, Rhein-Erft (Formelfassung) |
| `linear_sachwert` liefert den WERT, nicht den Faktor | Stadt Paderborn (drei Objektarten) |
| `doppel_log` SF[%] = c + a·ln(F) + b·ln(X) | Kreis Lippe |
| `konstante` ein Faktor je Objektart | Essen, Duisburg |
| `basiswert_additiv` Basiswert + Bandkorrekturen | Bochum |
| `zuschlag_prozent` Zu-/Abschläge in % nach Gebiet | Dortmund |

**Bochum und `zuschlag_prozent` brauchen keinen eigenen Auswerter** — Bochum ist
eine `konstante` plus vier `band`-Korrekturen.

**Neue Eigenschaft, kein neuer Auswerter:** Iserlohn und Märkischer Kreis führen
**Zeitreihen** über sechs Berichtsjahre. Der jüngste Jahrgang gilt, die älteren
sind Dokumentation.

**Drei Regeln, die `swf_modelle.js` hart durchsetzt:**
1. **Wo die Quelle endet, endet die Rechnung** — keine Extrapolation über die
   Tabelle hinaus.
2. **Eine leere Zelle ist kein Wert** — kein Nachbar, kein Mittelwert.
3. **Jede Zahl trägt ihre Herkunft** — Tabellenwert, jede Korrektur einzeln,
   und die Rechenkette als Text (`rechenweg`).

**Prüfstrecke 36 von 36**, jeder Sollwert aus einem Anwendungsbeispiel oder einer
abgedruckten Tabelle. **Kernbeleg:** die Regression Löhner Straße läuft durch den
**generischen** Auswerter und liefert Tabellenwert **0,899**, Faktor **0,889**
und marktangepasst **290.391 €** — exakt die Zahlen des v1076-Klicktests aus dem
handgeschriebenen Herford-Modul.

### Die Kaskade — 8 → 5 → 3 → 2

`zustaendig()` verglich bis v1083 **nur den fünfstelligen Kreisschlüssel**. Das
konnte die 14 Mehrfach-Kreise nicht auseinanderhalten: ein Registereintrag für
Lüdenscheid hätte still den Märkischen Kreis getroffen — die v1060-Fehlerklasse,
eine Ebene tiefer.

Seit `v1083-WKAS` läuft die Auflösung über `kaskadeSchluessel(ags)`:
**8 → 5 → 3 → 2**, feinste Ebene zuerst. Jeder Ausschuss liegt auf der Ebene, auf
der er zuständig ist — gemeindescharf achtstellig, kreisscharf fünfstellig — und
die feinere gewinnt von selbst. Dieselbe Reihenfolge wie in
`connectors/opendata/param-repository.js`, **bewusst identisch**.

Belegt gegen:

| Adresse | trifft | Ausschuss |
|---|---|---|
| 05758016 Hiddenhausen | `05758` | Kreis Herford |
| 05770016 Hüllhorst | `05770` | Kreis Minden-Lübbecke |
| 05962024 **Iserlohn** | `05962024` | Stadt Iserlohn |
| 05962032 **Lüdenscheid** | `05962032` | Stadt Lüdenscheid |
| 05962004 Altena | `05962` | Märkischer Kreis |
| 05562012/14/24 Dorsten/Gladbeck/Marl | 8-stellig | Verbund-Ausschuss |
| 05111000 Düsseldorf | `05111` | Landeshauptstadt |

### Warum das Register im Speicher liegt

`CrossCheckService.compute()` ist **synchron**, `holeModelle()` aus dem
param-repository ist async. Ein DB-Lesevorgang im Auflöser hätte `compute()`
async gemacht und damit die ganze Aufrufkette. 493 Sätze sind nichts — einmal
laden, danach synchron fragen.

**Zwei Ladewege, in dieser Reihenfolge:**
1. `ladeSaat()` — die versionierte Datei im Repo. **Lädt sich beim ersten
   Zugriff selbst** (`v1083a-WLAZ`), kann also nie vergessen werden.
2. `ladeAusDb(q)` — beim Serverstart aus `mb.param_modell` (`v1083a-WBOOT`,
   in `server.js` neben dem Taktgeber, nie im Anfragepfad). Überschreibt die
   Saat **nur bei Erfolg und nur, wenn die Tabelle etwas liefert** — eine leere
   Tabelle darf ein gefülltes Register nicht löschen.

Damit wirkt eine spätere Ernte **ohne Deploy**, und ein vergessener Saatlauf
führt nicht zu einem stillen „kein Ausschuss hinterlegt".

**Nach jedem Saatlauf muss das mb-Backend neu starten** — der Node-Prozess hält
das Register im Speicher. Ohne `docker restart dealpilot-mb-backend` wirkt die
frische Ernte erst beim nächsten Neustart. Dieselbe Klasse wie der Stripe-Cache.

### Kein zweites Repository

`connectors/opendata/param-repository.js` (OD-02, aus v1066) hat
`schreibeModelle()` und `holeModelle()` samt dem richtigen ON-CONFLICT-Schlüssel
und einer Belegprüfung vor dem Insert **schon lange**. v1083 nutzt es.
*Bevor ein zweites Werkzeug gebaut wird, nachsehen, ob es das erste schon gibt.*

**`m.ags` ist dort ein SKALAR, keine Liste.** Eine Gemeindeliste je Ausschuss
hätte `schreibeModelle()` klaglos geschrieben und `holeModelle()` hätte nie
etwas gefunden, weil dort `ags = $2` exakt vergleicht.

**`param_modell_ebene_check` erlaubt `gemeinde` und `kreis`** — `gemeinde_verbund`
fiel durch und kostete 24 Sätze. Der vollständige erlaubte Wertebereich ist
**noch nicht gemessen**:
```
docker exec dealpilot-mb-db psql -U mb -d marktbericht -c "select pg_get_constraintdef(oid) from pg_constraint where conname = 'param_modell_ebene_check';"
```

### Zuständigkeit bleibt an einer Stelle

**`lib/gutachterausschuss.js` bleibt die einzige Stelle**, die nach dem
Gemeindeschlüssel entscheidet, und gibt immer dieselbe Form zurück.
**Sachwertfaktor nur über den Auflöser, nie ein Modul direkt.**
Die zwei handgeschriebenen Module (Minden-Lübbecke, Herford) bleiben stehen —
sie tragen Umrechnungskoeffizienten und Gartenland, die im Register noch nicht
abgebildet sind. Gefragt wird **erst das Modul, dann das Register**.

Neu seit v1083: `liegenschaftszinssatz({ ags, zweig })` — kommt aus dem Register,
deckt alle 73 NRW-Ausschüsse ab und **liefert den Modellvermerk mit** (GND, RND,
BWK-Quote, Marktmiete). Ohne den darf der Zinssatz nicht verwendet werden
(§ 10 ImmoWertV).

**KEIN TREFFER HEISST KEIN WERT.** Nie ein Nachbarkreis, nie ein Landesmittel.
Genau so ist in v1060 ein Vergleichsfaktor aus Minden-Lübbecke in einen Bericht
für Hiddenhausen geraten: die Kreisprüfung lag in den Modulen, in einem fehlte sie.

**Neuen Ausschuss aufnehmen:** Bericht holen → Rezept nach dem Muster von
`312-hoexter.json` → Prüfstand → Registerdatensatz → über den Saatlauf in
`param_modell`.

---

## DAS ERNTEWERKZEUG

**Je Ausschuss ein Rezept, für alle derselbe Prüfstand.** Ein generischer Parser
ist unmöglich, aus demselben Grund, aus dem es kein generisches Sachwertmodell
gibt. Die Prüfungen dagegen sind für alle gleich.

```
tools/gmb-ernte.py          der Pruefstand fuer PDF-Berichte
tools/rezepte/<gaa>.json    je Ausschuss ein Rezept
tools/lzs-ernte/            Parser + Pruefstand + Saat fuer die NRW-CSV
tools/swf-ernte/            Parser + Pruefstand Hoexter / Maerkischer Kreis
```

**Das Rezept** sagt: wo die Tabelle steht (Anker/Anker-Ende), welches Muster die
Zeilen haben, wie die Achsen heißen, wie viele Zeilen zu erwarten sind, welchen
Sollwert das Anwendungsbeispiel liefert, welche Korrekturen es gibt, und die
vollständigen Zeitangaben.

**Der Prüfstand** prüft für jeden dasselbe: Zeitangaben vollständig ·
Zeilenzahl gegen die Erwartung · Monotonie je Achse · Wertebereich ·
Tabellenwert des Anwendungsbeispiels. Fällt eine durch, entsteht **kein
Registerdatensatz** (Rückgabewert 1).

**Grenze bewusst gezogen:** Das Werkzeug **rechnet keinen Sachwertfaktor**, es
schlägt nur nach. Gerechnet wird ausschließlich in `swf_modelle.js` — ein
zweiter Auswerter wäre eine Dublette, und Dubletten laufen auseinander.

**Klammerwerte** wie `(67)` markieren viele Ausschüsse als dünn belegt. Das ist
ein **Wert mit Vorbehalt**, kein fehlender Wert — der Vorbehalt gehört in den
Bericht, nicht in den Papierkorb. `-` und leer ergeben `None`.

**Der Negativtest ist Teil des Werkzeugs.** Mit dem fehlerhaften Suchmuster vom
11.08. findet der Parser 54 statt 56 Zeilen (die Zeilen 50.000 und 60.000 enden
auf `1,00`, das Muster verlangte `0,\d\d`) — Monotonie, Wertebereich und
Anwendungsbeispiel gehen **alle durch**, nur das Nachzählen fängt es. Die
Zählprüfung ist deshalb nicht verhandelbar.

**Bildtabellen** (Bochum) bekommen kein Rezept mit Suchmuster, sondern die Werte
im Rezept (`werte_inline`) — und laufen durch denselben Prüfstand.

**Spaltenzuordnung nach Zeichenposition, nicht nach Reihenfolge.** Zeitreihen
haben Lücken am Zeilenanfang (Märkischer Kreis: 400.000 € trägt erst ab 2022
einen Wert). Wer die Zahlen der Reihe nach den Jahren zuordnet, verschiebt die
Zeile. Der Parser misst die Position der Jahreszahl in der Kopfzeile. Dieselbe
Fehlerklasse wie die vertauschte Spaltenzuordnung bei Bielefeld am 11.08.

### Zeitangaben sind Pflicht, und zwar je Kennzahl

Die Ausschüsse meinen mit „Datum" Verschiedenes: Höxter normiert „zum Stichtag
01.01.2026" aus Kauffällen 2023–2025, Dortmund „auf das Berichtsjahr 2025" aus
mehreren Jahren, Bochum auf „die vergangenen zwei Berichtszeiträume".
**Bielefeld führt im selben Heft Sachwertfaktoren auf Datengrundlage 2025 und
Liegenschaftszinssätze auf Kauffällen 2024.**

Deshalb je Kennzahl, nicht je Bericht: `stichtag` · `berichtsjahr` ·
`auswertezeitraum` · `beschlossen` · `veroeffentlicht`. Bielefeld schreibt selbst
dazu, dass eine Anpassung bei aktuellen Stichtagen sachverständig zu
berücksichtigen ist — mit dem Stichtag im Datensatz kann der Bericht warnen,
wenn er altert.

---

## WERTERMITTLUNG — DER RECHENKERN

**Modellkonformität ist das Leitprinzip** (§ 10 ImmoWertV). Jeder Parameter
trägt einen Modellvermerk (`modellversion`), und der entscheidet, mit welchen
Ansätzen er gerechnet werden darf. Wer einen amtlichen Zinssatz mit fremden
Bewirtschaftungskosten oder fremden Mieten kombiniert, bekommt ein Ergebnis, das
amtlich aussieht und es nicht ist.

**Das ist keine Theorie:** aus der NRW-Ernte gemessen rechnet die **Bundesstadt
Bonn** (GAA 10400, AGS 05314000) Dreifamilien- und Mehrfamilienhäuser mit
**GND 60**, nicht 80. Wer diesen Zinssatz mit `GND_JAHRE = 80` kapitalisiert,
rechnet gegen ein anderes Modell als das, aus dem er stammt. Deshalb steht die
GND im Registerdatensatz unter `modellansaetze` und muss dort gelesen werden.

**Module (`marktbericht/backend/src/lib/`):**

| Datei | Inhalt | Belegt gegen |
|---|---|---|
| `immowertv.js` | Bodenwert, Ertragswert, GND-Tabelle, Anlage 3 | Verordnungstext |
| `anlage2.js` | Restnutzungsdauer bei Modernisierung (Export heißt **`restnutzungsdauer`**!) | Verordnungsformel, am Server gemessen |
| `nhk2010.js` | **NHK vollständig: 36 Gebäudearten 1.–3., 180 Kennwerte · gewogener Ausstattungsgrad · Bauteile vor AWM · Garage 14.1 · Außenanlagen-%** | SW-RL 2012 Anlagen 1+2 |
| `nrw_modell.js` | AGVGA-NRW, BWK-Ansätze, RND, **Stufenregel nach Teilmarkt** | Modell selbst (230 → 280) |
| `mietmodell_nrw.js` | Mietpreisübersicht Minden-Lübbecke | 5,64 €/m² · 507,60 € |
| `vergleichsfaktoren_nrw.js` | Vergleichsfaktoren § 20 | 150.100 / 253.750 € |
| `verfahrenswahl.js` | Führendes Verfahren, Zinsanpassung § 33 | § 6 Abs. 1 |
| `sachwertfaktoren_nrw.js` | Sachwertfaktoren Minden-Lübbecke | Monotonie beidseitig |
| `sachwertfaktoren_herford.js` | Sachwertfaktoren + UK + LZS + BWK Kreis Herford | 0,89 + 0,02 − 0,03 = 0,88 |
| `umrechnung_nrw.js` | UK Grundstücksgröße, Hinterland § 41 | 0,881 / 0,988 / 58 €/m² |
| `gutachterausschuss.js` | **Auflöser** (importiert `umrechnung_nrw` + `ausschuss_register`) | Zuständigkeit |
| `swf_modelle.js` | **Acht Auswerter für die neun Modellformen** | 36 Prüfungen |
| `ausschuss_register.js` | Register im Speicher, Kaskade | 30 Kettenprüfungen |

### Das AGVGA-NRW-Modell — andere Ansätze als Anlage 3

| | ImmoWertV Anlage 3 | AGVGA.NRW |
|---|---|---|
| Verwaltung ETW | 275 / 357 € | 275 / 335 € |
| Instandhaltung | 9,00 / 11,70 €/m² | 9,00 / 11,00 €/m² |
| Garage | 68 / 88 € | 65 € |
| Stellplatz | nicht getrennt | 25 € |

**Zwei Indexbasen, die nicht vermischt werden dürfen:** ImmoWertV rechnet gegen
Oktober 2001 = **77,1**, das NRW-Modell gegen **87,5**. Dasselbe Datum, zwei
Reihen — wer sie mischt, verrechnet sich um zwölf Prozent.
Index Oktober 2025 = 123 (ImmoWertV-Basis) bzw. 139,6 (NRW-Basis).

### Der Rechenkern ist geprüft — Stand 11./12.08.

Anlass war eine Differenz von rund 72.000 € im Gebäudesachwert gegenüber dem
Werkzeug, mit dem das Gutachten zur Löhner Straße erstellt wurde.
**Ergebnis nach sechs Messungen am Server: kein Befund im Code.**

| geprüft | Ergebnis |
|---|---|
| `anlage2.js` bei GND 80, Alter 62, 3 Punkte | **24 Jahre**, Formel Anlage 2 (a = 0,9033 · b = 1,9263 · c = 1,2505) |
| Staffel 0/1/2/3/5 Punkte | 19,3 · 19,3 · 21,7 · 24 · 28,7 — Bänder wie in der Verordnung |
| `nhkSachwert()`-Aufrufe (Z. 137, 189) | beide mit `rnd_jahre: _rndEinheitlich()`, seit v1056-WRND-1 |
| Kette `modGrad` → `mod_punkte` | heil: `wertermittlung.js:740` · `app.js:1380` · `ReportOrchestrator:136` |

**Die alte Notiz „RND 18 statt 24" ist erledigt.** Die 18 kam daher, dass im
Klicktest kein Modernisierungsgrad ausgewählt war; dann greift der beabsichtigte
Rückfall auf GND − Alter.

### Der stille Rückfall meldet sich — v1083-WRND / v1083b-WPDF

**Gerechnet wird weiter genau wie vorher.** Neu ist nur, dass der Rückfall seine
Herkunft mitträgt:

```js
out.sachwert.restnutzungsdauer_herkunft = { quelle, grund, rnd_jahre, gnd_jahre, hinweis }
out.restnutzungsdauer_herkunft          = dasselbe, auf oberster Ebene
```

`quelle` ist `'anlage2'` oder `'geschaetzt'`. Drei Rückfallgründe werden
unterschieden: `kein_modernisierungsgrad` · `kein_baujahr` ·
`anlage2_ohne_ergebnis`.

Im PDF steht seit `v1083b-WPDF` in der Sachwert-Karte „RND 18 J. / GND 80 J.
**· geschätzt**" und am Rechenweg der volle Wortlaut. **Der Warnfall ist im
Echtbetrieb noch nie sichtbar gewesen** — am Testobjekt Hüllhorst greift
Anlage 2 (RND 49,6). Ein Gegentest mit einem Bericht ohne Modernisierungsgrad
steht aus.

Ebenfalls neu im PDF: der **Grund** für „ohne Sachwertfaktor". Bei einer
Eigentumswohnung leitet der Ausschuss gar keinen ab; das stand bisher nur auf
dem Bildschirm.

### Drei Konstanten im CrossCheckService

- **`BAUPREISINDEX = 2.02`** (Z. 22), kommentiert als „2010 → 2026 (Destatis,
  gerundet)". Das **Berechnungsbeispiel des GMB Dortmund 2026** rechnet dagegen
  mit *Index 2010 = 100 · Bundesindex = 190,6*, also Faktor **1,906** zum
  Stichtag 01.01.2026 — unsere Konstante liegt rund **6 % darüber**. Und sie hat
  **keinen Stichtagsbezug**: bei einem Wertermittlungsstichtag in der
  Vergangenheit rechnet sie zwangsläufig falsch.
- **`GND_JAHRE = 80`** (Z. 24), obwohl `immowertv.js` eine GND-Tabelle führt.
  Für Wohngebäude richtig, für Gewerbe falsch — und für Bonn auch bei Wohnen.
- **`RND_MIN = 10`** (Z. 25), eine selbstgesetzte Untergrenze vor der
  Anlage-2-Kurve.

### Der gewogene Ausstattungsgrad (v1074, SW-RL Anlage 2)

Neun Gewerke mit amtlichen Wägungsanteilen — **Summe exakt 100**:

```
Außenwände 23 · Dach 15 · Fenster/Außentüren 11 · Innenwände 11 ·
Decken/Treppen 11 · Fußböden 5 · Sanitär 9 · Heizung 9 · sonst. Technik 6
```

Je Gewerk eine Stufe 1–5, halbe Stufen linear interpoliert; Kennwert =
gewichtete Summe, **auf volle Euro gerundet** (Dokumentverhalten).
- **Alle neun oder gar nicht:** fehlt ein Gewerk, rechnet die glatte
  Standardstufe und der Bericht weist es aus. Kein halber Weg.
- **Nur Gebäudearten 1.–3.** — die Verordnung gibt die Anteile nur für
  Ein-/Zweifamilienhäuser. MFH bleibt gesperrt (Datenlücke).
- Invariante der Prüfstrecke: alle neun auf Stufe 3 == glatte Stufe 3.

### Sonstige Bauteile (v1074)

Gauben, Balkone, Vordächer, Terrassen, Weitere — **Herstellungskosten zum
heutigen Stichtag, OHNE erneute Indexierung, VOR der Alterswertminderung**
(sie altern mit dem Gebäude). Das bestehende Feld `besBauteile` bleibt der
**Zeitwert-Weg NACH der AWM** (Aufzug u. ä.) — zwei verschiedene Dinge, nicht
zusammenlegen. Referenz Löhner Straße: 95.000 € (51+13+10+18+3).

### Die Parameter-Kaskade

```
A  amtlich, gemeinde- oder gutachterausschussscharf   nicht indikativ
B  amtlich, aber breit gestreut oder nur regional     nicht indikativ
C  marktabgeleitet, objektspezifisch                  indikativ
D  § 256 BewG                                         indikativ
E  eigene Angabe                                      schlägt alles
```

Kette: **gemeinde (8) → kreis (5) → bezirk (3) → land (2) → bund**
**Eigene Angabe (E) schlägt A, wird aber als eigene Angabe gekennzeichnet.**

**Die Herabstufung A → B misst seit v1083b nach Teilmarkt** — siehe nächster
Abschnitt.

### Die Stufenregel — Marcels Festlegung vom 12.08.2026

Gemessen an 471 NRW-Sätzen mit Streuungsangabe: die Standardabweichung ist
**absolut** ziemlich konstant (Median 1,1 Prozentpunkte). Wo der Zinssatz klein
ist, explodiert die relative Quote, ohne dass die Datenlage schlechter wäre:

| Zweig | LZS-Median | rel. Streuung (Median) |
|---|---|---|
| handel | 5,6 % | 30 % |
| buero | 4,7 % | 35 % |
| mfh | 3,2 % | 37 % |
| dreifh | 2,6 % | 47 % |
| **efh** | **1,4 %** | **55 %** |
| **we_s** | **1,8 %** | **62 %** |

Mit der alten 25-Prozent-Regel wären **85 % aller Sätze** herabgestuft worden —
und zwar die Wohn-Teilmärkte am härtesten, nicht wegen schlechterer Daten,
sondern weil ihr Zinssatz kleiner ist.

**Die Regel lautet jetzt:**

```
Wohnen  (efh zfh rhdhh dreifh mfh we_s we_v etw dhh rh)  absolut, ab 1,5 Punkten
Gewerbe (ggg handel buero gegi)                          relativ, ab 25 % des Wertes
in beiden Faellen stuft der amtliche Unsicherheitsvermerk der Quelle herab
```

Umgesetzt in `nrw_modell.js` (`v1083b-WSTU`), Konstanten `STREUUNG_SCHWELLE_PP`
(1,5) und `STREUUNG_SCHWELLE_PCT` (25), Umgebungsvariablen
`LZS_STREUUNG_SCHWELLE_PP` und `LZS_STREUUNG_SCHWELLE`.

**Fehlt die Objektart, bleibt das alte relative Verhalten** — eine unbekannte
Art darf die Regel nicht stillschweigend lockern.

Wirkung im Jahrgang 2024: Wohnen **81 % Stufe A** (vorher 15 %), Gewerbe 24 %.
Am Testobjekt Hüllhorst: Belastbarkeit **80 → 92 %**, Herkunft „amtlich,
kreisscharf" statt „amtlich, regional" — **ohne dass sich eine einzige
gerechnete Zahl ändert**.

**Der Abzugstext war falsch beschriftet.** „Liegenschaftszinssatz regional statt
kreisscharf (−12)" behauptete etwas über die Herkunft, was nicht stimmte: der
Wert war kreisscharf und nur breit gestreut. Seit `v1083b-WTXT` sagt der Abzug,
was er meint, und `stufeNachStreuung` reicht `grund`, `streuung_pp` und
`massstab` durch bis ins PDF.

**Median-Liegenschaftszins NRW, Berichtsjahr 2024** (aus der Quelle
reproduzierbar): efh 1,4 % · rhdhh 1,4 % · zfh 1,8 % · we_s 1,8 % ·
we_v 2,2 % · dreifh 2,6 % · mfh 3,2 % · ggg 4,1 % · gegi 4,6 % · buero 4,7 % ·
handel 5,5 %. Monoton nach Risiko.
Der § 256-Auffangwert (3,0 / 2,5) liegt für Wohnen **um mehr als das Doppelte**
zu hoch.

**Ein Liegenschaftszinssatz ≤ 0 wird verworfen.** Der Hochsauerlandkreis führt
zum Berichtsjahr 2023 für EFH **−0,2 %** aus 121 Fällen, ohne
Unsicherheitsvermerk. Fachlich ehrlich, rechnerisch unbrauchbar — der
Barwertfaktor ist nicht definiert. Kein Wert ist besser als ein Wert, mit dem
nicht gerechnet werden darf.

**Offene Entscheidung (Marcel):** Für Gebiete ohne hinterlegten Ausschuss steht
heute „kein Ausschuss hinterlegt". Denkbare Ersatzebenen: **ImmoWertA Nr. 9(3)**
erlaubt Daten anderer Ausschüsse bei nachgewiesener Modellgleichheit und mit
besonderer Begründung. Und **Anlage 25 BewG** wäre eine bundesweite gesetzliche
Wertzahl — allerdings steuerlich, nicht für den Verkehrswert. Noch nicht
entschieden.

### Die Verfahrenswahl (§ 6 Abs. 1)

- Wohnungseigentum mit höchstens zwei WE, Ein- und Zweifamilienhäuser →
  **Sachwert führt**
- Mehrfamilienhäuser ab drei Einheiten, Gewerbe → **Ertragswert führt**
- typisches Wohnungseigentum → **Vergleichswert führt**

Begründet aus dem Grundstücksmarktbericht: *„Ein- und Zweifamilienhäuser werden
normalerweise nicht unter Renditegesichtspunkten gehandelt … folglich wird der
Verkehrswert im Allgemeinen auf Grundlage des Sachwertverfahrens ermittelt."*
Der Ertragswert bleibt Kontrollrechnung. **Aber:** bei Ein- und
Zweifamilienhäusern **ohne erfasste Miete erscheint keine Zahl** (v1072). Das
Verkehrswertgutachten zur Löhner Straße sagt es wörtlich: „Ein stützendes
Wertermittlungsverfahren wurde nicht angewandt."

### Die Zinsanpassung (§ 33)

Fünf Merkmale, Gewichte summieren auf 1,00 → die Anpassung kann eine
Standardabweichung konstruktionsbedingt nicht überschreiten. Ergebnis ist
**Stufe C**, nie A. Jedes Merkmal wird einzeln ausgewiesen.

| Merkmal | Gewicht |
|---|---|
| Gebäudealter | 0,30 |
| Wohnlage (Mikrolage-Score) | 0,25 |
| Nutzung | 0,20 |
| Wohneinheiten | 0,15 |
| Objektgröße gegen Normobjekt | 0,10 |

**Die Gewichte sind eine Festlegung von DealPilot, nicht des Ausschusses.**
Er nennt die Richtungen, nicht ihre Stärke. Das gehört so in den Bericht —
genauso wie der Maßstab der Streuungsschwelle.

### Nicht aufweichen

- **Kein Verfahren rechnet halb.** Fehlt eine Pflichtangabe, erscheint das
  Verfahren nicht — statt mit einem stillen Standardwert zu rechnen.
- **Wo die Quelle endet, endet die Rechnung.** Tabelle bis 1.600 m²? Darüber
  wird ausgewiesen, nicht gerechnet. Extrapolation ist in mehreren Berichten
  ausdrücklich untersagt.
- **Jede Zahl trägt ihre Herkunft.** Stufe A–E, Modellvermerk, `indikativ`,
  **den Ausschuss und den Stichtag**. Seit v1083b auch: **den Maßstab, an dem
  eine Herabstufung gemessen wurde**, und **die Herkunft der Restnutzungsdauer**.
- **ETW ohne Miteigentumsanteil: KEIN Bodenwert.** Der volle Grundstückswert ist
  immer falsch (Coswig: 160.300 € für eine 50-m²-Wohnung).
- **Verwaltungskosten je BEWERTETER Einheit**, nicht je Gebäude-WE.
- **BWK-Quoten stehen auf dem GESAMTEN Rohertrag** einschließlich Stellplätzen.
- **Sonstige Erträge mit eigener Laufzeit**, Vorgabe 15 Jahre. Über den
  Gebäude-Barwertfaktor kapitalisiert wäre eine Küche dreißigmal bezahlt.
- **Eine Restnutzungsdauer für alle Verfahren.**
- **Kernsanierung nur bei mindestens 18 Modernisierungspunkten.**
- **Nur der rentierliche Bodenwert wird verzinst** (v1072). Hinterland geht in
  den Bodenwert ein, nicht in die Bodenwertverzinsung (§ 41).
- Marktüblich erzielbare Miete, nicht Ist-Miete; die Abweichung ist als
  besonderes objektspezifisches Merkmal auszuweisen (§ 31 Abs. 2, § 8).
- **`Number(null)` ist 0 und besteht `Number.isFinite`.** Erst auf Abwesenheit
  prüfen, dann rechnen — sonst wird aus „keine Streuung" ein „Streuung 0 Prozent"
  und aus fehlendem Baujahr ein Neubau.

### Kerosin

```
schnell / fast          2 L
Stufe 1 und 2           5 L
Stufe 3 Wertermittlung 12 L
```

Preis 0,156–0,20 €/L (10 L = 2 € bis 160 L = 25 €).
Monatstank: Free 2 · Starter 10 · Investor 40 · Pro 100.
Marktbericht im Proxy: fast = 2 L · full = 5 L · Verlauf-Text = 1 L ·
Löschen = 0 L. **Die Wertermittlung löst kaum Zusatzkosten aus** — nach WERT
bepreist, nicht nach Kosten. **Das Register kostet gar nichts** — es liegt im
Speicher.
Die Kerosin-Anzeige oben aktualisiert erst nach Reload — Buchung im Zweifel im
`marktbericht_cost_log` prüfen (Haupt-DB; die Spalte heißt **nicht**
`created_at` — erst `\d marktbericht_cost_log`).
`aiCreditsService`: `consume(userId, amount, 'grund')` **direkt in try/catch**
versuchen, statt Feldnamen von `getStatus` zu raten (402 = Feldnamen).

---
---

# TEIL IV — MARKE, ARCHITEKTUR, GELD, DATEN, SERVER

## PRODUKT

DealPilot = deutsche PropTech-SaaS für Immobilien-Investitionsanalyse (DACH).
Zielgruppen: Privatinvestoren, aktive Kapitalanleger, Sachverständige,
Asset-Manager.

Marcel Junker, **Junker Solution (Einzelunternehmen, Kleinunternehmer § 19
UStG)** — **KEINE UG.** Junker Immobilien / DealPilot / Junker Digital sind
Marken darunter. (Die älteren Fassungen nannten „Junker Group UG" — das war
falsch.) Rechtsformentwicklung Richtung UG/GmbH ist Ziel, nicht Ist-Stand.

Claim: „Immobilienentscheidungen sind zu groß für ein Bauchgefühl."
WZ-Klassifikation: **IT 62.01 / 63.11**, nicht 68 (Immobilien).
immocation Festival 01.11.2026, Leipzig, **Stand 23**.
Instagram `@dealpilot.app` / `@getdealpilot`.

**Domains (alle vier parallel live):**
`dealpilot.immo` · `app.dealpilot.immo` (Staging: `staging.` / `app.staging.`)
`dealpilot.junker-immobilien.io` · `app.dealpilot.junker-immobilien.io`
Regel: **App-Host = `app.` + Landing-Host**

**Mail-Adressen folgen der Marke** (`@dealpilot.immo`); Website-URLs und
PDF-Fußzeilen (`junker-immobilien.io` als Link) bleiben bis zur bewussten
Umstellung.

---

## MARKE & DESIGN-DNA

**Farben:** Obsidian `#050505` / `#070707` · Gold `#C9A84C` mit `#E8CC7A` (hell)
und `#b8932f` (dunkel) · Grün `#3FA56C` · Rot `#B8625C` / `#D8564C` ·
Creme `#FDFCFA` · Karte `#FBF6E9`.
Runway/Hero: `linear-gradient(110deg, #E8CC7A, #C9A84C 55–60%, #b8932f)`.
Landing: Ticket-/Pass-Mitten **pur weiß** `#fff` (kein Creme).
**`--ch=#2A2727` NIE auf Obsidian.**

**Schriften:** Space Grotesk (Display) · JetBrains Mono (Mono/Labels) ·
Inter (Body) · Cormorant Garamond (Serif).

**Bildsprache — Luftfahrt durchgehend:** Kerosin (KI-Guthaben) · Cockpit
(Dashboard) · Boarding / QuickBoarding · Co-Pilot (KI-Agent) · Runway ·
Boarding-Pass-Karten · Score-Dial · Pre-Flight.

**Score-Tier:** STARK / SOLIDE / SCHWACH → grün / gold / rot bei
≥ 70 / ≥ 50 / < 50.

**Mail:** Design-Referenz ist `mailLayout.wrap` — alle Systemmails laufen
darüber. **Keine Vorlage danebenbauen.**

---

## ARCHITEKTUR-INTEGRITÄT (nicht aufweichen)

### Rechenkerne — nie duplizieren
- **DSCR** SSoT `window.Dscr.compute()` = (nkm+ze)·12 / (Zins+Tilgung) brutto,
  **BSV-Sparrate als Tilgungsersatz in ALLEN Callern**
- **KPI** `DealKpis.compute()` · **Score** `DealScore.computeFromKpis()`
  (der QC-Ring nutzt **den**, nicht DS2)
- **Gesamt-Kaltmiete = `nkm + ze`** (nie nur `nkm`)
- **§ 7b Wfl-Cap 4.000 €/m²** (V227.1) — nicht anfassen
- `calc.js` BSV `startMonth/startYear` ~Z. 440 **NIE** ändern (V267-05-Crash)
- **Y1-Anteilig-Kaskade:** AfA/Mieten/BWK ab Wirtschaftsübergang, Finanzierung
  ab `d1_auszahl`
- BWK Gesamt/Jahr = `State.kpis.bwk` (Bankexport `/12`)
- **KPI/BWK werden beim Speichern eingefroren** → nach Modul-Änderung Objekte
  einmal öffnen und neu speichern
- Neue Input-Felder → `FIELDS`-Array in `storage.js`; `saveObj()` ~Z. 352
- Steuer-Snapshot nur in `tax.js`; Sidebar-Portfolio nur aus der Liste
- **Sachwertfaktor** nur über `gutachterausschuss.js`, nie ein Modul direkt
- **Sachwertfaktor-Auswertung** nur über `swf_modelle.js`, nie ein zweiter
  Auswerter in einer anderen Sprache
- **Zuständigkeit** nur über `kaskadeSchluessel()`, nie ein eigener
  AGS-Vergleich
- **Stufenvergabe** nur über `stufeNachStreuung()`, nie eine zweite Schwelle

### Allgemein
- `_euro(null)` == „–" (**truthy!**) → nie `||`-Fallback
- Baujahr/Jahre nie durch `Intl.NumberFormat`
- `window._currentObjKey` = einzige verlässliche Objektreferenz
- `Auth.apiCall` stringifiziert selbst; `getApiBase()` enthält `/api/v1`
- **Nacktes `fetch` umgeht den zentralen 401-Handler** (der wrappt nur
  `Auth.apiCall`) → Init-Calls über `Auth.apiCall`. Ausnahme: öffentliche
  Endpoints ohne 401.
- `parseAddr` splittet Straße/Hausnummer auch ohne Komma
- CSS `url()` ist relativ zur CSS-Datei. Neue JS-Dateien: Include prüfen.
- **Öffentliche Endpoints:** kein Auth, aber rate-limit + Whitelist + Cap +
  kein PII + immer 204
- **Anbieter-Neutralität:** Sprengnetter/PriceHubble **nie namentlich nach
  außen** (Landing, Marketing, Mobile-Kundenansicht, Marktbericht-Kundenansicht)
  — extern nur „DealPilot Markteinschätzung". ImmoMetrica darf genannt werden.
- Ungepflegte Reseller-Felder GELEERT, nie auf Junker zurück
- **Marktbericht-App hat eigene Statuslogik** — die Cashflow-Regeln der
  Haupt-App gelten dort nicht.

---

## PLAN-SYSTEM + `dp:plan-ready`

**Drei Wahrheiten, von Hand gepflegt:** `config.js` (Gate) · `pricing-modal.js`
(2 Matrizen, Z. 264 + 508) · `landing/index.html` (Z. 2850).

`hasFeature`: **DB zuerst** (`Sub.hasCachedFeature`), `config.js` nur bei `null`.
**Ein Schlüssel, den keiner kennt, ist für JEDEN false — auch Pro** (W41
`bmf_advanced`). Stand: free/starter `calc=false adv=false` · investor
`calc=true adv=false` · pro + partner beides.
**Partner = Pro-Klon** (`reseller-portal.js:552`) + `reseller` /
`reseller_whitelabel` / `custom_logo`. Neue Pro-Features immer in `config.js`.

`dp:plan-ready` (`subscription.js:154`) feuert, sobald der Plan bekannt ist:
```js
window.addEventListener('dp:plan-ready', e => e.detail.plan);
// schon geladen? window.DealPilotPlanReady
```
**Neue Module hören darauf — kein `setTimeout`, kein Polling.**
`getCurrentPlanKey()` darf NIE wortlos auf `'free'` fallen; `dp_last_plan` ist
der Merker.

**Pläne:** Free · Starter 29 € · Investor 59 € ★ · Pro 99 €.
**Kerosin-Pakete:** 10 L / 2 € · 28 L / 5 € · 90 L / 15 € (beliebt) ·
160 L / 25 €.

---

## STRIPE

### Zwei Konten, nie verwechseln

| Umgebung | Konto | Key |
|---|---|---|
| **LIVE / Prod** | `acct_1TWXFdGefFev8arz` | `sk_live_` |
| **TEST / Staging** | `acct_1TWXFqKEjyPDo0wo` | `sk_test_` |

**Der Claude-Connector hängt am LIVE-Konto** und folgt dessen Modus-Schalter.
Was dort angelegt wird, landet **nicht** automatisch im Staging-Konto. Für
Staging-Objekte den Befehl **im Container** ausführen — der hat den Testkey.
LIVE-Preis-IDs tragen `GefFev8arz`, TEST-IDs `KEjyPDo0wo`.

### ERSTFLUG — Founding Member

| | LIVE | TEST |
|---|---|---|
| Coupon | `ndnM8B6F` | `ykjOGjxy` |
| Wirkung | **16 %**, `duration:forever`, max. 100 | identisch |

Prozentual gewählt, weil ein Code so monatlich **und** jährlich abdeckt.
16 % statt 15 %, damit Investor unter 50 € fällt.
**Preise mit Rabatt:** Starter 24,36 · Investor **49,56** · Pro 83,16 ·
Investor-Jahr **495,60**.
Gelöscht: `4nrzLjZ2` (15 %), `V6pwFwEP` (EINSTIEG10), `diBpk6um` (EINSTIEG30).
**`percent_off` ist an einem Coupon unveränderlich** → Prozentwechsel = neuer
Coupon + neuer Code (den alten Coupon löschen gibt den Code-String wieder frei).

**Partner** `prod_Ut8G0Zt5bgSMQj`: 149 €/Monat
(`price_1TtM0CGefFev8arzACdni0a9`) bzw. 1.490 €/Jahr (`…ixIUNCYo`).
**Seat** `prod_Ut8Gi6OPw3FdtF`, Volume-Staffel 35 / 29 / 24 € monatlich
(`price_1TtM0DGefFev8arzBopJ0ESC`), 350 / 290 / 240 € jährlich. Die früher
notierten 249 € sind **falsch**.
**Tiered-Checkout nie mit echter Staffel getestet** — der erste Pool-Kauf ist der
Test; `adjustable_quantity` ist bei Tiered **nicht erlaubt**. Die Landing bewirbt
Partner, der Direktkauf ist ausgegraut (mailto).

`allow_promotion_codes: true` steht in `stripeService.js` — der Kerosin-Checkout
(`credits.js`) und der Seat-Checkout (`resellerPortal.js`) haben ihn bewusst
**nicht**.

**⚠ Die Staging-`plans`-Tabelle trägt beim Partner eine LIVE-Preis-ID** →
Partner-Checkout ist auf Staging nicht testbar („No such price"). Kein
Geldrisiko (Testkey), aber vor dem ersten echten Partner-Verkauf geradeziehen.

Backend-Endpunkte: `POST /api/v1/subscription/checkout` · `…/portal` ·
`POST /api/v1/webhooks/stripe`.

---

## DATEN / SCHEMA

**OBJEKT (`objects`, Haupt-DB):** `id`, `user_id`, `name`, `kuerzel`, `ort`,
`kaufpreis` (**CENT**), `bmy`, `cf_ns` (**CENT/Jahr**), `dscr`, `seq_no`,
`data` (jsonb), `ai_analysis`, `photos`, `version`, timestamps.
Rohfelder in `data`: `plz, ort, str, hnr, objart, wfl, baujahr, kp, nkm, ze,
umlagef, ek, d1, d1z, d1t, d1_bindj, hg_ul, grundsteuer, ul_sonst, hg_nul,
weg_r, eigen_r, mietausfall, nul_sonst, bankval, svwert, kaufdat, notizen,
kuerzel` + `_kpis_*` (**EURO**). **`kp`/`nkm` = rohe EURO.**
Weitere Formularfelder: `mea, brw, brw_stichtag, gsfl, einheiten, bgf,
standardstufe, baustatus, leerstand, zimmer, etage, ds2_energie, ds2_zustand,
eq_*, ji_p`.

**BWK:** Umlagefähig = `hg_ul + grundsteuer + ul_sonst` ·
Nicht-umlagefähig = `hg_nul + eigen_r + mietausfall + nul_sonst`.
**WEG-Rücklage (`weg_r`) ist nur Info, NICHT in der BWK.**

**Wertermittlungsfelder im Marktbericht-Formular:** `mea`, `bgf`, `spMiete`,
`sonstEinnahmen`, `standardstufe`, `grundriss`, `modGrad`, `nhkHaus`,
`nhkGeschosse`, `nhkDach`, `hinterlandFlaeche`, `hinterlandWert`,
`hinterlandRent`, `garagenBgf`, `garagenStufe`, `aussenPct`, **und die 14
Feinjustierungsfelder** `ausstAussenwaende`, `ausstDach`, `ausstFenster`,
`ausstInnenwaende`, `ausstDecken`, `ausstFussboeden`, `ausstSanitaer`,
`ausstHeizung`, `ausstTechnik`, `btlGauben`, `btlBalkone`, `btlVordach`,
`btlTerrassen`, `btlSonstige` — alle über `payload()` in `wertermittlung.js`
(als `ausstattung`-Objekt mit 9 Schlüsseln, `bauteile_hk`-Summe und
`bauteile_detail`) **und** über `_mbBuildObjData()` in `app.js`
(als `ausst_*`/`btl_*`).

**RESELLER (Migrationen 055–062):** `resellers` (brand_*, inkl.
`brand_mail_accent` 059, `brand_pdf_light` 060, `brand_display` 062) ·
`reseller_members` · `reseller_clients` · `licenses`
(`uq_license_active_per_client`) · `object_shares`
(UNIQUE `object_id, reseller_id`) · `share_audit` · `reseller_invites`.

**mb-DB (Schema `mb.`, PostGIS):** `properties` · `addresses` (geteilter Cache) ·
`market_reports` · `valuation_results` · `deal_scores` · `micro_locations` ·
`object_snapshots` (`object_key='dp:<id>'`, alle Trend-Felder) ·
`param_modell` · `param_werte` · `param_lauf` · `param_probe` ·
`gaa_sources` · `gaa_documents` · `valuation_inputs`.

**Sonstiges:** `landing_events` (063, anonym) · `tax_snapshots` (026) ·
`ai_credits_log` · `api_keys` (047) · `pro_test_override` (048) ·
`network_cards`/`network_leads` (049) · `JWT_EXPIRES_IN=30d` ·
Token `ji_token` · `subscriptions` UNIQUE(user_id) → UPSERT ·
Admin: eigene `admin_users` / `admin_audit_log` / `admin_login_attempts`,
Token `dp_admin_token` (`X-Admin-Token`), `requireAdmin`.
`marktbericht_cost_log` liegt in der **HAUPT-DB** (Abrechnung, nie löschen).

**Migrationshistorie Haupt-DB (Auszug):** 026 tax_snapshots · 034 ImmoMetrica ·
035 Shared Pass · 036 AVM-Historie · 037 email_change_requests · 038 invoices ·
039 support_tickets · 040 broadcasts · 041 lifecycle ·
042 ticket_object_snapshot · 043 ticket_attachments · 044 mail_layouts ·
045 retention · 046 retention_templates · 047 api_keys · 048 pro_test_override ·
049 network_cards/network_leads · 055–062 Reseller · 063 landing_events.
**Stand 63, nächste 064.** `schema_migrations.version` ist INTEGER.

### `mb.param_modell` — das Register, seit 12.08. befüllt

Die Tabelle aus Migration 014 passte **ohne Änderung**. Sie ist besser
zugeschnitten, als ein Neuentwurf geworden wäre:

| Spalte | nimmt auf |
|---|---|
| `land_code · ags · ebene · gebiet_name · gaa_name` | Zuständigkeit |
| `kennzahl · zweig` | Sachwertfaktor / Liegenschaftszins, je Objektart |
| `formel` jsonb | Modellform samt Tabelle oder Koeffizienten |
| `korrekturen` jsonb | additive Zu-/Abschläge oder Bänder |
| `modellansaetze` jsonb | Modellvermerk für die Modelltreue |
| `geltungsbereich` jsonb | Spannen, Extrapolationsverbot |
| `belege` jsonb | Anwendungsbeispiel mit Fundstelle |
| `stufe · fallzahl · stichtag · berichtsjahr · modellversion` | eigene Spalten |
| `quelle_url · quelle_parser · quellenvermerk · lizenz` | Herkunft |

Zwei Entwurfsentscheidungen, die zur Doktrin passen:

```
CHECK (jsonb_array_length(belege) > 0)
CHECK (ebene IN (…))                    <- 'gemeinde' und 'kreis' belegt
UNIQUE (land_code, ags, kennzahl, zweig, COALESCE(berichtsjahr,-1), quelle_url)
```

**Kein Datensatz ohne Beleg** — als Constraint. Und das `berichtsjahr` im
Schlüssel ist die **Zeitreihe**: Iserlohn und Märkischer Kreis passen mit sechs
Jahrgängen nativ hinein, und zwei Jahrgänge desselben Ausschusses stehen
konfliktfrei nebeneinander.

**Stand auf Prod (12.08. abends):** 493 Datensätze, Kennzahl
`liegenschaftszinssatz`, 74 Zuständigkeitsschlüssel (356 kreisscharf,
137 gemeindescharf), Berichtsjahr 2024, `quelle_parser = v1083-WLZS`.

### Die Erntestrecke

| Tabelle | Stand 12.08. abends |
|---|---|
| `param_modell` | **493 Zeilen auf Prod und Staging** |
| `param_lauf` | Zähler + `protokoll` jsonb — der Saatlauf schreibt dort hinein |
| `gaa_sources` → `gaa_documents` | 67 Dokumente, alle `status = neu` — nie extrahiert |
| `param_probe` | **Quellenwächter** (http_status, content_type, urteil) — NICHT das Prüfprotokoll |
| `param_werte` | Open-Data-Sätze (28.827 auf Staging, **0 auf Prod**) |

Der `sha256` in `gaa_documents` trägt mehr, als er aussieht: ändert ein
Ausschuss seinen Bericht, ändert sich der Hash, und das Dokument fällt
automatisch zurück in die Warteschlange. **Die Jahrgangspflege läuft von selbst**
— sobald der Schritt `gaa_documents → param_modell` gebaut ist.

---

## SERVER / STACK

Vanilla-JS-Frontend (**kein Build**, volume-mounted → `git pull` = live),
Node/Express **:3001**, mb-backend **:4000** (beide nur im Docker-Netz),
PostgreSQL 16 + PostGIS, Docker Compose, Caddy, Hetzner.

**STAGING** `root@116.203.214.11` (`DealPilot-Staging`) ·
**PROD** `root@157.90.117.167` (`DealPilot-Prod-neu`) · beide `/opt/dealpilot` ·
GitHub `JunkerImmobilien/DealPilot` (privat).
Container: `dealpilot-backend` · `-postgres` · `-caddy` · `-mb-backend` ·
`-mb-db`. Compose-Projektname `dealpilot-v124`.

- **Prod-SSH-Key read-only** → Push unmöglich. **Getaggt wird NUR auf Staging.**
- `skip-worktree` nur `docker-compose.prod.yml` (**die Caddyfile ist
  repo-gepflegt**, seit 19.07.)
- **Migrationen sind ins Backend-Image gebacken** (ENTRYPOINT migriert beim
  Start) → neue Migration = **Rebuild**. Haupt-DB nächste **064**,
  mb-DB nächste **015**. Stand prüfen: Haupt-DB `schema_migrations`, mb-DB
  `public._mb_migrations` (**zwei verschiedene Namen**, zweimal falsch geraten).
- **Host-Node ist 18, Container-Node 22.**
- **E-Mail:** alfahosting `host160.alfahosting-server.de` **Port 587** (465 ist
  von Hetzner geblockt), `BETA_SMTP_SECURE=false`, Absender
  `info@dealpilot.immo`, **DKIM-Selektor `cloudpit`**
  (`cloudpit._domainkey.dealpilot.immo`). Header-Check bestanden: dkim=pass ·
  spf=pass · dmarc=pass.
- **Im Container liegt `pdftotext` nicht standardmäßig** — für die Ernte auf dem
  Server `poppler-utils` nachrüsten. **In der Arbeitsumgebung des Chats ist es
  vorhanden** — dort läuft die Extraktion ohnehin schneller und ohne Serverlast.
- Bash-Aliase auf beiden Servern: `dp`, `dplogs`, `dpps`.

### Die `.env` — die Fallen, die Geld gekostet haben
- **Compose `environment:` schlägt `env_file:`** bei gleichem Key →
  `${VAR:-fallback}` nutzen. `docker-compose.prod.yml` Z. 52/53 sind so
  gehärtet: `CORS_ORIGINS: ${CORS_ORIGINS:-…}`.
- **Domain-Variablen (`LANDING_DOMAIN`/`APP_DOMAIN`) tragen LEERZEICHEN**
  (Caddy splittet daran in mehrere Site-Adressen),
  **`CORS_ORIGINS` trägt KOMMAS** — nie dieselbe Variable.
- **Variablennamen gegen den Code prüfen:** `CORS_ORIGINS` **mit S**;
  `CORS_ORIGIN` ohne S war monatelang tot.
- **`$` in `.env`-Werten → `$$`**, sonst zerlegt Compose das Passwort (ein `$`
  im SMTP-Passwort führte zu 535).
- **Die `.env` lässt sich nicht mit `source` einlesen** — sie ist eine
  Compose-Datei.
- **`docker compose up -d` erzeugt den Container nicht neu**, wenn sich die
  Konfiguration nicht geändert hat (`Running` statt `Started`). Neue
  Umgebungsvariablen brauchen `--force-recreate`.
  **`printenv` IM Container ist die Wahrheit.**

### Umgebungsvariablen (Wertermittlung)

```
MARKET_CACHE_TTL_MIN        720 (12 h) — zum Testen auf 5
KI_GEGENRECHNUNG            0 = aus, 1 = Zweitmeinung
HARVEST_SCHEDULER           1 = an
NACHBARWERT                 1 = an (greift erst nach der vollen Kaskade)
OPENDATA_KASKADE            1 = an (OD-Ebene in der Parameterkaskade)
LZS_STREUUNG_SCHWELLE       25  (Prozent, GEWERBE: ab da A → B)
LZS_STREUUNG_SCHWELLE_PP    1.5 (Prozentpunkte, WOHNEN: ab da A → B)   NEU v1083b
IRW_JAHRE_ZURUECK           3
BORISD_USER_AGENT           Browser-Kennung für gis.nrw.de
OPENDATA_USER_AGENT         eigene Kennung mit Kontakt
MB_BODY_LIMIT               80mb
```

**`mb-backend` hat einen `environment:`-Block ohne `env_file:`** — zehn
Variablen aus der `.env` kommen dort nicht an. `compose-env.sh` aus v1064 trägt
sie ein, danach `--force-recreate`. **`LZS_STREUUNG_SCHWELLE_PP` ist noch nicht
eingetragen** — die Vorgabe 1,5 gilt im Code, eine Änderung per `.env` wirkt erst
nach `compose-env.sh`.

### AVM & Betriebsschalter

**DealPilot ruft IMMER den Marktbericht-Microservice** (2 L). Sprengnetter
(20 L) und PriceHubble (40 L) hängen an `AVM_MODE`
(`AVM_LIVE_PROVIDERS=sprengnetter,pricehubble`). `MB_DEMO=1` bzw. `market=seed`
→ Seed-Zahlen. ImmoMetrica `IMMOMETRICA_MODE=stub`, 428 = kein Zugang.

**⚠ Prod läuft weiterhin mit `market=seed`** (720 erzeugte Angebote im Log) —
Kunden sehen Seed-Vergleichsdaten. Bekannt, nicht erledigt. Blockiert auch die
Spread-Prüfung (Ertragswert vs. Vergleichswert 48,1 %).

**In der App-internen Pre-Flight-Leiste sind SN/PH-Logos sichtbar** (ausgegraut,
„Coming soon") — eingeloggte Ansicht, kein Verstoß gegen die
Anbieter-Neutralität nach außen.
**NICHT anfassen:** `avm-section.js` · `qc-bridge.js` `qcpm`-Overlay.

---
---

# TEIL V — DIAGNOSE-LEHREN, ROLLOUT, OFFENE PUNKTE

## DIAGNOSE-LEHREN (kumuliert über den Gesamtverlauf)

**DIE FALSCHE FRAGE STELLEN = GRÜN UND WERTLOS.** Marker statt Prosa prüfen;
codegebundene Marker, nicht Kommentare. Widersprüche im Harness ernst nehmen
(Zähler gegen Label → der Harness ist kaputt, nicht der Code).

### Die teuersten Lehren

**Eine Prüfung darf ihre Vorbedingung nicht selbst herstellen.**
Die Kettenprüfung von v1083 rief `ladeSaat()` selbst auf — und deckte damit zu,
dass es im Serverbetrieb **niemand** tat. Das Register blieb leer, jede Adresse
bekam „kein Ausschuss hinterlegt", und die Prüfung war grün.
**Seit v1083b misst `pruefstrecke-kette.mjs` am AUSGABEOBJEKT und an seinem
LESER**, nicht am Rückgabewert: für jedes Feld wird geprüft, dass es gesetzt
**und** gelesen wird. Sie schlug beim ersten Lauf prompt an und fand die
Umkehrung: gelesen, nie gesetzt.

**Drei von vier Fehlern eines Tages waren derselbe Typ: „gebaut, nie
verdrahtet".** `ladeSaat()` rief niemand auf · `liegenschaftszinssatz()` rief
niemand auf · `lzs_herabgestuft` reichte der CrossCheckService nicht durch.
Alle drei liefen an grünen Funktionsprüfungen vorbei, weil die Funktion stimmte
und nur die Kette fehlte. **Eine neue Funktion ohne einen Test, der ihren
Aufrufer misst, ist nicht fertig.**

**Ein nie betretener Zweig ist ungetestet — ein Fix, der ihn freischaltet,
zündet dort Altfehler.** `const _sw` + `_sw = _sw2` lag seit v1069 im
Übernahmezweig des amtlichen Sachwertfaktors; der Zweig lief nie, weil `ref.ags`
nie gesetzt war. Die ags-Rückschreibung (v1075) schaltete ihn scharf →
„Assignment to constant variable" in Produktion. **Wer eine Kette heilt, führt
den frisch freigeschalteten Zweig im `apply.sh` echt aus.**

**`node --check` prüft Syntax, die Prüfstrecke prüft Verträge, und
Laufzeit-TypeErrors findet nur der echte Lauf.** Alle drei braucht es. Von zehn
Fehlern eines Tages hat `node --check` keinen gefunden: `bericht` und `p` vor
ihrer Deklaration, leeres `ref.ags`, `optionen` statt `opt`, ein fehlender
Import, eine nicht durchgereichte Modellkennung, ein nie betretener Zweig, drei
Felder im falschen Objekt, ein doppeltes Pluszeichen, eine Quote auf der
falschen Bezugsgröße.

**Die Kette prüfen, nicht die Funktion.** Mehrfach war ein Modul richtig und der
Aufrufer reichte den Parameter nicht durch. Höhepunkt: `ref.ags` wurde
**nirgends** gesetzt — fünf `ags: ref.ags`-Stellen liefen seit ihrer Einführung
mit `null`. `grep "ref.ags ="` hätte es sofort gezeigt: **nach der Variable
suchen, die angeblich gefüllt ist.**
Zweiter Fall am 12.08.: der Orchestrator setzte `lzs_herabgestuft` seit v1050,
der CrossCheckService reichte es nie durch — der Ertragswert bekam also nur
DASS der Wert auf B stand, nie WARUM.

**Aber: die Kette kann auch heil sein.** Am 11.08. wurden drei Diagnosen zur
Restnutzungsdauer gestellt und alle drei widerlegt. Am 12.08. lautete meine
erste Diagnose zum Liegenschaftszins „das Register wird nicht gelesen" — auch
falsch: der Wert kam längst kreisscharf und wurde nur wegen seiner Streuung
herabgestuft. **Bevor ein Befund behauptet wird, muss er gemessen sein, nicht
plausibel.** Und: die Messung macht den Fix oft kleiner und besser.

**Der Sollwert kommt aus dem Dokument, nicht aus dem Kopf** — einschließlich der
Rundung. Fünf falsche Sollwerte an einem Tag (v1065–v1070). Am 12.08. noch
einer: ich prüfte eine Interpolation gegen 0,905, obwohl der Bericht
zweistellig abdruckt — 0,905 gibt es dort nicht. **Ein selbst gerechneter
Sollwert ist kein Sollwert, auch wenn die Rechnung stimmt.**

**Ein Extraktionsmodell erfindet Tabellen.** Bei Bochum kam eine perfekt
gestaffelte Sachwertfaktor-Matrix zurück, die es im Dokument nicht gibt, dazu
eine verdrehte Fallzahl. **Jede Tabelle aus einem PDF braucht die Nachrechnung
gegen das Anwendungsbeispiel oder mindestens eine Zählprüfung.**

**Die kluge Prüfung fängt weniger als die dumme.** Beim fehlerhaften Suchmuster
gingen Monotonie, Wertebereich und Anwendungsbeispiel alle durch — nur das
Nachzählen der Zeilen fand die Lücke. Am 12.08. dasselbe Muster: die
Zählprüfung „428 Zeilen, 428 verschiedene `gaa_kennz`" entlarvte eine
Verknüpfung, die inhaltlich plausibel aussah.

**Ein Schlüssel ist kein Name.** GAA 10400 sah nach der Ruhrgebietsreihe aus und
ist die **Bundesstadt Bonn**. Ich hatte den Namen aus der Nummer geschlossen
statt ihn nachzuschlagen, und der Fehler stand fett in einem Projektdokument,
bevor die Kettenprüfung ihn fand. **Amtliche Kennziffern werden nachgeschlagen.**

**Proben über die ganze Tabelle statt Stichproben.** Monotonie in beide
Richtungen fängt vertauschte Blöcke und Zahlendreher.

**Wo eine Rückfall-Regel steht, prüfen, wofür sie gilt.**
`HAUS_TABELLE['_kreis']` galt für jeden Ort in Deutschland.

**Ein stiller Rückfall ist schlimmer als ein Fehler.** Er liefert eine Zahl, die
aussieht wie die richtige. Jeder Rückfall muss sich im Bericht melden — seit
v1083b tut es der RND-Rückfall.

**Ein falsch beschrifteter Hinweis ist auch ein stiller Fehler.**
„Liegenschaftszinssatz regional statt kreisscharf (−12)" behauptete etwas über
die Herkunft, was nicht stimmte, und verdeckte den wahren Grund. Wer einen
Abzug oder eine Warnung schreibt, muss den Grund führen, nicht raten.

**Die erste Erklärung ist nicht die ganze.** Beim leeren `ref.ags` lagen DREI
unabhängige Ursachen übereinander — die vierte zündete erst nach dem Fix der
ersten drei. Beim Promo waren es ebenfalls drei. **Bei mehrschichtigen Ketten
einmal komplett durchmessen.**

**Es gibt nur EIN Modal und Schichten.** „Falsches Modal"-Eindrücke erst per
`grep -rln` über `js/` klären. Gelöschte „Leichen" können aktive UI-Schichten
sein (`bmf-modal-v292.js`).

**Bevor ein zweites Werkzeug gebaut wird, nachsehen, ob es das erste schon
gibt.** `gaa_documents`, `param_lauf` und `param-repository.js` standen längst
da — letzteres mit fertigem `schreibeModelle()`/`holeModelle()` samt
Belegprüfung. v1083 wurde dadurch erheblich kleiner.

### Git und Parallelbetrieb

- **Nur EIN Chat fasst git an.** Am 12.08. haben beide Chats am selben Abend auf
  `staging` committet. Es ist gutgegangen — aber nur, weil der Parallel-Chat den
  Zwischenfall bemerkt und selbst zusammengeführt hat. **Vor jedem Rollout
  absprechen, wer drückt.**
- **In jeden Befehlsblock gehören `hostname` UND `git rev-parse --abbrev-ref
  HEAD`.** Am 12.08. abends lief `git merge --no-ff staging` ins Leere
  („Already up to date"), weil nach dem Neu-Einloggen der Zweig wieder `staging`
  war und der `git checkout main` in einem früheren Block stand. Danach setzte
  `git push origin main --tags` zwei Tags auf einen Commit, den es nur auf
  staging gab, **ohne main zu bewegen**. Zwei Blöcke später liefen Befehle auf
  Prod, obwohl sie für Staging gedacht waren — zwei offene SSH-Sitzungen.
- **Vor dem Merge `git pull --ff-only` auf main.** Lokales main auf Staging war
  einmal **190 Commits zurück**. **Der Anker ist der Hash NACH dem Pull.**
- **`main..staging` vor dem Merge zählen.** Erwartet wurde ein Commit, es waren
  über fünfzig aus zwei Arbeitssträngen. Am Abend des 12.08. waren es 31.
- **`git log` ohne `| cat` bleibt im Pager hängen.** Die Ausgabe endet mit `:`
  und die Liste ist unvollständig — das sieht aus wie ein Ergebnis und ist keins.
- **`git diff main...staging --name-only` vor dem Rollout lesen** — vor allem auf
  Migrationen. Keine Migration heißt: sauberer Rückweg per
  `git reset --hard <Anker>` + Rebuild.
- **Ein Fremd-Commit kann uncommittete Working-Tree-Dateien mit-committen** —
  nur eigene Dateien EINZELN stagen, zeitnah committen.
- **`git log main..staging` kann LEER sein trotz vieler Änderungen** (alles
  uncommittet) → immer zusätzlich `git status -s`.
- **`git status -sb` ohne `[ahead/behind]` heißt: in sync.** Das ist die
  schnellste ehrliche Auskunft über den Zustand eines Zweigs.
- **Die ehrlichste Frage ist nicht an die Historie, sondern an die Datei:**
  `grep -c "<marker>" <datei>`. Sie sagt, ob die Arbeit da ist — egal was git
  erzählt.
- **Vor dem Prod-Pull `git fetch`** — Prods `origin/main` ist bis dahin alt.
- Nach dem Neuverbinden landet man in `~`, nicht im Repo. **`cd /opt/dealpilot`
  gehört in jeden Befehlsblock.**
- **Rückroll statt Verheddern:** Features, die auf Infrastruktur warten, nicht im
  selben Commit mitschleppen.

### Patch-Disziplin

1. **Ein Marker sagt „hier war ich", nicht „hier ist alles gut."** Viermal hat
   ein gesetzter Marker seine eigene Reparatur blockiert (`if marker in s: skip`).
   Wo ein Fehler ausgeliefert wurde, braucht es einen Block, der den **Schaden**
   sucht. **Marker gehören in Kommentare, NIE in Nutztext.**
   **Und ein Marker in einem Kommentar taucht auch im Marker-Zähler auf:**
   `v1083-WRND` steht in `CrossCheckService.js` (der Setzer) **und** in `app.js`
   (weil mein Kommentar dort darauf verweist). Zwei Treffer, ein Setzer.
2. **Ein Patch darf keinen Marker löschen, den seine eigene Vorbedingung
   braucht** — sonst läuft er genau einmal.
3. **Ein Löschschritt hinterlässt keinen Marker** — Zeilen werden durch einen
   Kommentar ERSETZT, der zugleich als Marker dient.
4. **Ein Anker ohne Zeilenende ist eine Wette.** `newPage(); // …Seitenende`
   ließ ` lassen` stehen → `lassen is not defined`, syntaktisch gültig,
   `node --check` winkt durch, Absturz erst zur Laufzeit.
5. **Echte UTF-8-Zeichen in Ankern, aus dem Live-Grep, nicht getippt.**
   `cat -A` zeigt, was wirklich dasteht: `M-BM-7` ist ein echtes `·`.
   **In `app.js` stehen echte Zeichen, in `wertermittlung.js` stehen
   `\u`-Escapes literal im Quelltext** — die Ausnahme gilt nur dort. Am 12.08.
   habe ich sie auf die falsche Datei angewandt; der Anker traf null Mal, und
   `apply.sh` brach korrekt ab, ohne etwas zu schreiben.
6. **Eine Datei, zwei Stellen.** Nach jedem `ersetze` prüfen, ob dasselbe Muster
   nochmal vorkommt.
7. **Reihenfolge prüfen:** eingefügter Code muss NACH dem Aufbau der Objekte
   stehen, auf die er zugreift.
8. **Vorbedingungen auf Marker prüfen, die es gibt** — und in den Dateien, die im
   Arbeitsverzeichnis LIEGEN. Eine neu angelegte Datei trägt keinen Marker ihres
   eigenen Pakets.
9. **Jede Datei auf ihren EIGENEN Marker prüfen, nicht global.** Ein
   `patch.py`, das oben auf einen fremden Marker prüft und dann `sys.exit(0)`
   macht, blockiert alle folgenden Dateien. In v1083b prüft `patch()` je Datei.
10. **Variablennamen in derselben Funktion können kollidieren** — vor neuen Namen
    `grep` im Zielscope (`_pt` war schon vergeben).
11. **Eine Datei, die das Paket NEBEN das Original legt, ist nicht installiert.**
    **Beipackdateien gehören ins `apply.sh` wie Code**, mit Prüfung auf Inhalt
    und Umfang — v1083a prüft die Saatdatei auf Satzzahl, erlaubte Ebenen und
    die 24 Verbund-Sätze, bevor irgendetwas getauscht wird.
12. **Ein doppelt zugewiesener Shell-Wert überschreibt still.**
13. **Anker auf Ausdrucks-Ebene**, wenn Zeilen mehrfach vorkommen — mit
    count-Ausgabe; Index-Span statt Escape-Raterei.
14. **Regex-Block-Ersatz zwischen zwei kurzen, sonderzeichenfreien Ankern**
    (`.*?` + `re.DOTALL`), beide vorher `count()==1`.
15. **Backups nie überschreiben:** `.pre-<paket>` nur anlegen, wenn keins da ist
    (v999: ein Doppellauf hatte das saubere Backup mit dem gepatchten Stand
    überschrieben).
16. **Der Mock muss die echte Schnittstelle abbilden.** `q()` liefert `res.rows`
    direkt — ein Stub mit `{rows:[]}` verdeckte neun `.rows`-Zugriffe.
17. **Cache-Buster attributgebunden ersetzen:**
    `(\b(?:src|href)\s*=\s*)(["'])(…)NAME(?:\?v=[^"']*)?\2`
18. **Marker-Kollision:** Idempotenz-Marker nicht auf Strings ankern, die das
    angehängte Modul selbst enthält.
19. **`VNNN`-Variable prüfen:** `apply.sh` lädt aus `/tmp/${VNNN}/` — gegen den
    ZIP-Namen prüfen, `rm -rf /tmp/vNNN` vor dem `unzip`.
20. **JSON-Schlüssel sind Strings.** `json.dump` mit float-Keys erzeugt
    `"50000.0"`, der Leser sucht `"50000"` → KeyError. Beim Schreiben
    normalisieren, nicht beim Lesen raten.

### Bash und Node

- **`grep -q X && { exit 1; }` bricht unter `set -e` ab, wenn grep NICHTS
  findet** — also im guten Fall. Die if-Form tut das nicht.
- **`grep -c` / `grep -rl` mit null Treffern gibt Rückgabewert 1** → `|| true`.
  Am 12.08. starb `rollback.sh` genau daran — **nachdem er erfolgreich war**.
  Und `grep -c` zählt **Zeilen, nicht Treffer**.
- **Node 18 auf dem Host erkennt ESM nicht von selbst**, Node 22 seit 22.7 schon.
  `package.json` mit `{"type":"module"}` gehört in **jede** Arbeitskopie.
- **`node --check` ist als `.js` und `.mjs` unterschiedlich streng.**
  Browser-Scripts als `.cjs` prüfen; ESM meldet dort fälschlich
  Doppel-Deklarationen — **das aber als Hinweis auf echte Doppel-Funktionen
  nutzen.**
- **Doppel-Definition: in JS gewinnt die LETZTE.** Vor dem Patch prüfen, welche
  aktiv ist, sonst editiert man toten Code.
- **Fließkomma sichtbar machen:** `(3.3 - 1.1) / 2` ergibt
  `1.0999999999999999`. Wo eine Zahl in einen Bericht geht, gehört sie gerundet.
- kein `#` in Einzeiler-Pastes · **kein `!` in doppelten Quotes** ·
  `>`/`<` ausschreiben · verschachtelte `$()` vermeiden · HEREDOC fragil →
  `create_file`/ZIP · `docker compose` nur aus `/opt/dealpilot` · Umlaute und
  `·` quoten · **lange Einzeiler werden beim Einfügen zerschossen** ·
  mehrzeilige Pastes können als Befehle interpretiert werden ·
  **`git rev-parse --short A B C` bricht ab** („Needed a single revision").
- **„CACHED" beim Build ist nicht immer ein Fehler.** Wurde `backend/src` nicht
  geändert, ist die Zwischenspeicherung richtig. **Ein Build, der komplett
  CACHED durchläuft, ist aber ein Hinweis: dann hat der Pull nichts gebracht.**
- **BOM in Mockdateien prüfen.**

### CSS / Frontend

- **`:not(#id)` erbt ID-Spezifität.** `.hero > *:not(#dpm-flug)` hat 110, nicht
  10 — beide Orbs rutschten in den Fluss und schoben den Hero um **exakt
  760 px**. **Nie Sammelregeln auf Container-Kinder.**
- **Element-zuerst bei Optik:** `getComputedStyle` + Element-HTML in der Console;
  prüfen, ob die Regel überhaupt geparst ankommt (`[...document.styleSheets]`).
  **`rules: Array(0)` trotz geladener Datei = das CSS kommt NICHT an.**
- **CSS kommt partout nicht an → Style INLINE ins JS-Markup.** Garantie-Lösung
  (v850, `.sbc-halter`).
- **`insertBefore` nur, wenn `ref` ein DIREKTES Kind ist** — sonst
  `NotFoundError` und der ganze IIFE ist tot.
- **Parallel laufende Renderer:** eine Quelle festlegen, Alt-Render entfernen,
  Hook an den zentralen Render.
- **Klick-Diagnose vor Patch-Serien.** Nach 2–3 Fehlversuchen STOPP →
  `getComputedStyle`, `getBoundingClientRect`, `elementFromPoint`,
  Direktaufruf der Funktion.
- **Accordion-Lehre:** alten `vNNN`-Block per Marker-Regex ENTFERNEN und EINEN
  sauberen schreiben.
- **Die Buster-Kette hat vier Glieder.** Sie wurde viermal vergessen.
- **SVG ohne Größe füllt den Container.** Browser normalisiert Hex zu `rgb()`,
  Custom Properties nicht.
- **Hochformat-Video formatfüllend = Upscale = Pixel** → vorab ins Zielformat
  rendern, nie den Browser skalieren lassen.
- **Autoplay mit Ton ist ohne Klick verboten.** Richtig: mit Ton **versuchen**,
  bei `NotAllowedError` stumm neu starten.
- **Layout rechnerisch absichern** (Breitensumme gegen Platz).
- **Bild-Retusche:** Farb-Schlüssel-Maske + MaxFilter-Dilation + **harte
  Schutzzonen-Rechtecke** statt Feder-Maske. Den Farbdetektor an echten Pixeln
  **kalibrieren**, Ergebnis per Zoom-Crops abnehmen.

### Backend / Ops

- **Status lesen, nicht raten.** 405 auf einen POST an eine statische Domain =
  `file_server` (nur GET/HEAD). 402 = consume / Feldnamen. `printenv` für
  Container-Env. **Aufrufer immer lesen — alle.**
- **Fremde API? Die echte Signatur und einen echten Aufrufer lesen**, bevor man
  sie nutzt. `laufEnde(id, zahlen, protokoll)` nimmt das Protokoll als
  **drittes** Argument, nicht als Feld in `zahlen` — am Code gelesen, nicht
  geraten.
- **Ein In-Memory-Register braucht nach jeder Datenänderung einen Neustart.**
  Der Saatlauf schrieb 493 Sätze, das Log meldete weiter 469 — der Boot-Hook
  hatte vor dem Saatlauf gelesen. `docker restart dealpilot-mb-backend`.
  Dieselbe Klasse wie der Stripe-Cache.
- **Theme-Farben messen, nicht annehmen** (`getComputedStyle`).
- **NXDOMAIN ≠ „propagiert noch"** — der Record existiert gar nicht.
- **Zertifikat rot im Browser, grün auf dem Server:** erst messen —
  ```
  echo | openssl s_client -connect HOST:443 -servername HOST 2>/dev/null | openssl x509 -noout -issuer -subject -dates
  ```
- **Vor einer Migration, die bestehende Zeilen anfasst:**
  ```
  docker exec dealpilot-mb-db psql -U mb -d marktbericht -c "BEGIN; <UPDATE>; ROLLBACK;"
  ```
  Migration 012 lief in den Eindeutigkeitsindex und hängte den Container in eine
  Neustartschleife.
- **Ein CHECK-Constraint sagt nicht, was er erlaubt — er sagt nur nein.**
  `param_modell_ebene_check` verwarf 24 Sätze mit `ebene='gemeinde_verbund'`,
  und der Saatlauf meldete es korrekt als „verworfen 24". **Vor dem ersten
  Schreiben `pg_get_constraintdef` lesen.**
- **Verify-Mail fehlt = SPAM (SPF/DKIM/DMARC), kein Bug.**
- **Direkt-Patch auf Prod** → Cleanup `git checkout -- <files>` + `git pull`.

### Stripe

- **`promotion_code.coupon` gibt es so nicht mehr.** Die API liefert
  `"promotion": {"coupon": "id", "type": "coupon"}` — je nach API-Version auch
  als eingebettetes Objekt oder unter `pc.coupon`. **Alle drei Formen abdecken.**
- **Negative Antworten NIE cachen.** `{active:false}` landete für 10 min im
  `sessionStorage` — **das überlebt Strg+Shift+R** und stirbt erst beim
  Tab-Schließen. Nur positive Antworten cachen; Cache-Key bei Bugfixes
  hochziehen.
- **In-Memory-Cache nach Stripe-Änderung:** 5 Minuten im Node-Prozess →
  `docker restart dealpilot-backend` leert ihn sofort.
- `percent_off` ist unveränderlich → Prozentwechsel = neuer Coupon + Code.

### Browser-Klicktests (Cowork/Chrome)

- **`generate()` ruft `window.confirm()`** (Kostenhinweis). Ein nativer Dialog
  friert JEDE CDP-Automatisierung ein — der Tab wirkt tot, nichts ist kaputt.
  Vor automatisierten Läufen `w.confirm = () => true` im iframe setzen.
- Der Marktbericht-iframe ist same-origin: `contentDocument` / `payload()` direkt
  ansprechbar. Ergebnisobjekt: `window._lastOut.data.cross_check`.
- Formular neu zeichnen nach programmatischem ptype-Wechsel:
  `window.Wertermittlung.neuZeichnen()`.
- **Die Erweiterung fotografiert nur den Seiteninhalt, nicht die Adressleiste.**
  Berechtigungshinweise und Download-Symbole sieht nur Marcel.
- **Passwörter werden nicht eingegeben.**
- **Der beste Klicktest ist ein PDF.** Marcel lädt den fertigen Bericht hoch,
  `pdftotext -layout` macht ihn messbar, und dann wird gegen die
  Regressionswerte geprüft — nicht gegen den Eindruck.

### Wächter

**Ein Wächter, der Unfug meldet, wird überlesen.** Der Taktgeber meldete 38
frisch geprüfte Quellen als „seit 18 Monaten stumm", und das TDZ-Werkzeug hätte
einen Rollout blockiert, ohne dass ein Fehler vorlag.
`tools/tdz-pruefung.py` **meldet, bricht aber nicht ab** — es kennt keine
Gültigkeitsbereiche.

**Ein Prüfstand, der nur bestätigt, ist keiner.** Der LZS-Prüfstand fing am
12.08. **mich**: mein GND-Band „nur 40/60/80" war erfunden, der Bestand führt
40 bis 82. Ein Prüfstand, der nie anschlägt, prüft die falschen Dinge.

### Grundsätzlich

- **Die Landkarte selbst aufnehmen** — keiner Übergabe glauben, was die App lädt.
  Bei UI-Fragen schlägt ein Screenshot von Marcel jede Grep-Runde.
- **Feldnamen amtlicher APIs messen, nicht annehmen**
  (`Gemeindekennzeichen` ≠ `Gemeindeschlüssel`, `f.opt` ≠ `f.optionen`,
  `gaa_kennz` ≠ Ausschussschlüssel). Auch eigene Exporte: `anlage2.js`
  exportiert `restnutzungsdauer`, nicht `anlage2Rnd`.
- **Behauptungen aus alten Übergaben nachmessen.** „Kapitel 11 fehlt im PDF" und
  „Vergleichsobjekte zeigen 9 Zeilen bei (10)" — beides existierte nicht.
  **Aber auch: „HF_STAND.lzs steht auf 1,7"** — es stand längst auf 1,8 und war
  nur nicht verdrahtet.
- **Stale-Baseline:** Basis per Marker + md5 + Lead-Text verifizieren, nicht am
  Dateinamen. Prod und Staging können auseinanderlaufen.
- **Erst die Adressen prüfen, dann das Werkzeug abschreiben.** Der Crawler galt
  als untauglich, weil er auf Startseiten statt auf Verteilerseiten geschickt
  wurde. Dieselbe Klasse: die „Extraktionsgrenze" bei 45–57 Seiten war eine
  Grenze des Weges, nicht des PDF.
- **Auslöser entschärfen statt Konsumenten patchen** (Performance, v729–v734).
  Trace first.

---

## AUSLIEFERUNG

- **`apply.sh` = alles oder nichts:** Kopien in `/tmp` patchen, ALLE Prüfungen,
  dann tauschen. Anker- oder Syntaxfehler → nichts geschrieben. **Am 12.08.
  belegt:** ein Paketlauf brach an einem falschen Pfad in der Prüfstrecke ab,
  und `md5sum -c` bestätigte, dass die Zieldateien unverändert blieben.
  `package.json` MIT anlegen (ESM!). Vorbedingungen über **Marker**, nicht über
  Annahmen. Wenn ein Funktionslauf Modul-Importe braucht: die **ganze** `src/` in
  die Arbeitskopie kopieren, nicht einzelne Dateien (Importketten!).
  `DP_ROOT`/`ROOT`-Override für den e2e-Lauf gegen einen Fake-ROOT.
- **Ein Paket, das ein anderes voraussetzt, prüft dessen Marker als
  Vorbedingung** und lässt es beim Rollback stehen. v1083a/v1083b tun das;
  ihr `rollback.sh` fasst v1083 nicht an.
- **ZIP-Konvention:** Wrapper `NAME.zip` → `NAME/`, nie mit Präfix.
  `unzip -o paket.zip -d /tmp` (nicht `-d /tmp/paket`). `apply.sh` macht kein
  `cd` heraus.
- **Anker:** Python `str_replace` mit `count==1`. Marker codegebunden UND im
  Ersatztext (der Doppellauf prüft es). **Pfad-basiert routen, NICHT basename.**
- **Prüfstrecke vor JEDER Auslieferung:** `node --check` (ESM als `.mjs`,
  Browser-Scripts als `.cjs`) + **Doppellauf** (muss SKIP melden) + **echter
  Funktionslauf gegen das Anwendungsbeispiel des Dokuments** + **Kettenprüfung
  am Ausgabeobjekt UND an seinem Leser** + **Funktionslauf jedes Zweigs, den der
  Patch neu freischaltet** + Struktur-Endprüfung (Klammern-Balance) +
  **Regression gegen Hüllhorst und Löhner Straße** + Rollback-Test
  (byte-identisch) + **Buster-Kette prüfen, wenn das Frontend angefasst wurde**.
- **Beweisen statt behaupten:** echte Funktionen in node laufen lassen.
  Untestbares (OpenAI, echter Mailversand, Live-DNS/Certs, jsPDF-Darstellung,
  der Schreibpfad in die echte DB) **ehrlich** als Staging-Abnahmepunkt
  kennzeichnen.
- **Server sauber — erst NACH dem Test:**
  ```
  find /opt/dealpilot -name "*.pre-v10*" -type f -print -delete
  ```
  (ohne `-maxdepth`, sonst wird das mb-Backend nicht erreicht). Entpackte
  Paket-Ordner und `/tmp/*-check`-Verzeichnisse ebenfalls wegräumen.
  `auto-save.js` bleibt untracked; `patchesold/` gehört dem Parallel-Chat.
- **scp im LOKALEN Terminal**, Ziel `/tmp`.

---

## ROLLOUT

### Mehrere Pakete auf Staging

1. Alle ZIPs hochladen, **beide** Datenbanken sichern
2. Alle auspacken, dann **der Reihe nach** `apply.sh` unter `set -e` — jedes
   prüft die Marker seines Vorgängers und bricht ab
3. **EIN Rebuild am Ende** genügt für das mb-Backend. **Wurde
   `backend/src/routes/marktbericht.js` angefasst, muss `backend` mit.**
4. Migration prüfen, Buster-Kette prüfen, **Strg+F5**
5. Bei Datenpaketen: **Saatlauf, dann `docker restart`**
6. Erst nach dem Klicktest aufräumen

**Vor dem Commit die Marker MESSEN**, nicht annehmen:

```
cd /opt/dealpilot
hostname
for m in v1083-WMOD v1083-WKAS v1083-WRND v1083a-WLAZ v1083a-WBOOT v1083b-WSTU v1083b-WTXT v1083b-WPDF; do
  n=$(grep -rl "$m" marktbericht/backend/src marktbericht/backend/tools frontend/marktbericht-app/app.js 2>/dev/null | wc -l)
  printf '%-14s %s Datei(en)\n' "$m" "$n"
done
```

Eine `0` heißt: das Paket lief nicht → **nicht committen.** Zusätzlich im
Container prüfen — „habs eingespielt" ist nicht dasselbe wie installiert:

```
docker exec dealpilot-mb-backend grep -c "<marker>" /app/src/<pfad>
```

### Standard-Deploy nach Prod (bewährt am 12.08., zweimal)

**Jeder Block beginnt mit `cd`, `hostname` und dem Zweig.**

```
cd /opt/dealpilot
hostname                             == DealPilot-Staging
git rev-parse --abbrev-ref HEAD
git status -s
```

```
cd /opt/dealpilot
git add -u
git add NEUE DATEIEN EINZELN          (NIE -A oder .)
git diff --cached --name-only         == GENAU meine Dateien
git diff --cached --name-only | grep -E 'auto-save|patchesold|\.pre-|docker-compose|Caddyfile' || echo sauber
```

```
cd /opt/dealpilot
git commit -m "<Inhalt benennen, nicht nur die Nummer>"
```

```
cd /opt/dealpilot
git checkout main
git rev-parse --abbrev-ref HEAD       == main, SONST NICHT WEITER
git pull --ff-only                    ← ZUERST, sonst sperrt der Merge fremde Arbeit aus
git rev-parse --short HEAD            ← PROD-ANKER NOTIEREN
```

```
cd /opt/dealpilot
git log --oneline main..staging | wc -l
git log --oneline main..staging | head -20
git diff main...staging --name-only | grep -iE 'migration|docker-compose|Caddyfile' || echo "keine Migration"
```

```
cd /opt/dealpilot
git rev-parse --abbrev-ref HEAD       == main
git merge --no-ff staging -m "…"
git rev-parse --short HEAD
git tag <name je Arbeitsstrang>       ← alle auf denselben Commit
git push origin main --tags
```

```
cd /opt/dealpilot
git checkout staging && git merge --ff-only main && git push
```

**Prod:**

```
ssh root@157.90.117.167
```

```
cd /opt/dealpilot
hostname                          == DealPilot-Prod-neu
git rev-parse --abbrev-ref HEAD   == main
git status -s                     == sauber
git log --oneline -1              ← PROD-ANKER
```

```
cd /opt/dealpilot
hostname
docker exec dealpilot-postgres pg_dump -U dealpilot -d dealpilot_db | gzip > /root/backup-haupt-vor-<hash>.sql.gz
docker exec dealpilot-mb-db pg_dump -U mb -d marktbericht | gzip > /root/backup-mb-vor-<hash>.sql.gz
ls -lh /root/backup-*vor-<hash>.sql.gz     ← ~7,3 MB / ~614 KB, sonst STOPP
```

```
cd /opt/dealpilot
hostname
git fetch
git log HEAD..origin/main --oneline | wc -l      ← muss zur Zahl von Staging passen
git diff HEAD...origin/main --name-only | grep -iE 'migration|docker-compose|Caddyfile' || echo "keine"
```

```
cd /opt/dealpilot
hostname
git pull --ff-only
grep -c "<marker>" <datei>        ← Inhaltspruefung VOR dem Rebuild, je Strang einer
ls -l marktbericht/backend/src/lib/register/lzs-nrw.json
```

```
cd /opt/dealpilot
hostname
docker compose -f docker-compose.prod.yml up -d --build mb-backend backend
```

Bei Datenpaketen zusätzlich:

```
cd /opt/dealpilot
hostname
docker exec dealpilot-mb-backend node /app/tools/register-saat.mjs
docker restart dealpilot-mb-backend
sleep 8
docker logs --tail 20 dealpilot-mb-backend | grep -i register
```

**Abnahme:** Marker im laufenden Container · beide Migrationstabellen
unverändert · `docker logs --tail 12` beider Container ohne Ausnahme ·
**Strg+F5** · Klicktest gegen die Regressionswerte · eine Adresse **außerhalb
NRW** (dort muss „kein Ausschuss hinterlegt" stehen).
Caddyfile-Änderung: danach `docker exec dealpilot-caddy caddy validate` + reload.

**Rückweg:** `git reset --hard <Prod-Anker>` + Rebuild + Strg+F5. Migrationen
sind additiv → ein Code-Rollback braucht **kein** DB-Restore; `mb.param_modell`
bliebe befüllt und würde nur nicht mehr gelesen. Bei echter Datenänderung
zusätzlich
`zcat /root/backup-mb-vor-<hash>.sql.gz | docker exec -i dealpilot-mb-db psql -U mb -d marktbericht`.
**Ein Code-Rollback vor v966 macht das Löschen wieder unmöglich, stellt aber
bereits gelöschte mb-Berichte NICHT wieder her.**

---

## CHRONIK — DIE ROLLBACK-KETTE

**Marktbericht-Strang (neueste zuerst):**

```
99c1097  rollout-20260812-abend + marktbericht-v1083b-20260812
         + marktbericht-v1154-20260812              (Anker 65ca0b0)
         v1083/a/b Register + Kaskade + Stufenregel + Herkunft im PDF,
         dazu v1146-v1154 aus dem Parallelstrang
65ca0b0  marktbericht-v1082b-20260812 + marktbericht-v1145-20260812  (Anker 4ceb915)
ca9e101  marktbericht-v1076-20260803
21dc057  marktbericht-v1073-20260803
72b3189  verfahrenswahl-20260802 (v1061)
```

**Haupt-App / Landing / Mobile:**

```
0a543d7  landing-promo-20260723   (Anker 2b7a131)  Cockpit-Intro, Hero-Video, ERSTFLUG 16 %
2b7a131  immo-cutover-20260721    (Anker 8cf82c5)  .immo-Domains, Mail-Sweep, Caddyfile
8cf82c5  beleg-import-20260721    (Anker 28a926f)  KI-Beleg-Import
28a926f  rollout-20260719         (Anker 7d2f0b9)  BMF v974–v994 + Voice v1000
7d2f0b9  rollout-20260718         (Anker 84d50a3)  QC-Ring, Mobile-Sperre, Verlauf, Analytics
3bc4998  marktbericht-20260718 · b11dd44 whitelabel-20260716 · f0a90a0/-b/-c/-d 0715er
84d50a3  v968 · 7e3f360 v941 · 9ab41ee rollout-20260714
ea33a6c  v899 (Bankexport) · 03d0d23 MA34 · 16963c7 v898 · 1c69fd2 MA33
b92686d  v851-landing (Anker 6729968) · 36f5fe0 v816 · d2fd84b v800 · 2fe05d7 v748 · 2a3b569 v734
Prod-Rollback NIE unter e43ce2d — darunter hängt der Microservice.
```

**DB-Backups auf Prod:** `/root/backup-haupt-vor-v1083b.sql.gz` (7,3 MB) +
`backup-mb-vor-v1083b.sql.gz` (614 KB) · `-vor-65ca0b0` (12.08. mittags) ·
`-pre-landing-promo` · `-pre-immo-cutover-20260721-1420` (6,7 MB) ·
`-pre-beleg-import` · `-pre-rollout-20260719` (6,5 MB) ·
`-pre-rollout-20260718` + `backup-mb-pre-rollout-20260718` ·
`-pre-whitelabel-2026-07-16` · `-pre-v968` · `Caddyfile.pre-rollout-20260719`.

**Erledigte Meilensteine, die nicht zurückgedreht werden:**
Web-Cutover auf `.immo` (alle vier Hosts HTTP 200, ACME-Certs) · Mail mit
DKIM `cloudpit` (dkim/spf/dmarc pass) · **Demo-Seed geschlossen**
(`SEED_DEMO_DATA=0` + `users.is_active=false` für `demo@dealpilot.local`) ·
Stripe LIVE seit 15.07. · Caddyfile repo-gepflegt ·
**Ausschuss-Register für alle 73 NRW-Ausschüsse auf Prod (12.08.).**

---

## OFFENE PUNKTE

### Sofort — Abnahme des letzten Rollouts

- **Browser-Klicktest auf Prod:** Hüllhorst (305.937 / 348.687 / 2,56
  unverändert, Belastbarkeit **92 %**, Herkunft **kreisscharf**) und eine
  Adresse **außerhalb NRW** („kein Ausschuss hinterlegt").
- **Gegentest für den RND-Herkunftsvermerk:** ein Bericht **ohne**
  Modernisierungsgrad. Nur dort erscheint „· geschätzt" und der volle Hinweis
  am Rechenweg. Die Zeile war im Echtbetrieb noch nie sichtbar.
- **Aufräumen auf Staging:** `.pre-v1083*`-Dateien, `/tmp/v1083*`,
  `/tmp/v1083b-check`.

### Der nächste Bau — Sachwertfaktoren ins Register

`swf_modelle.js` liegt auf Prod und rechnet 36 Prüfungen richtig, aber
`gutachterausschuss.js` nutzt für Sachwertfaktoren weiterhin die zwei
handgeschriebenen Module. Der Weg ist derselbe wie beim Liegenschaftszins:

1. **`param_modell_ebene_check` messen** — der erlaubte Wertebereich ist nach
   wie vor unbekannt. `gemeinde` und `kreis` gehen, `gemeinde_verbund` nicht.
2. **Registerdatensätze schreiben** mit `formel` + `korrekturen` je Modellform.
   **Zuerst Lüdenscheid** (`potenz`) — und dabei die Kaskade nutzen, sonst
   kollidiert es mit dem Märkischen Kreis unter 05962.
3. **Höxter und Märkischer Kreis** — die Tabellen sind geerntet und geprüft,
   die Rohdaten liegen in `out/swf_roh.json` des Ernte-Pakets.
4. **`gutachterausschuss.sachwertfaktor()` auf das Register umstellen**,
   Rückgabeform unverändert, die zwei Module als Rückfall stehen lassen.
5. **Schlusshinweis in `register-saat.mjs`**: nach dem Lauf ist ein
   `docker restart dealpilot-mb-backend` nötig.
6. **Prüfstrecke:** gleiche RND in allen Verfahren · Regression Hüllhorst und
   Löhner Straße · **Kettenprüfung am Ausgabeobjekt**, nicht am Rückgabewert.

### Billig und flächendeckend

Die vier **anderen CSV** der Grundstücksmarktdaten NRW sind ungenutzt:
`baulandpreise.csv` (Bodenrichtwertniveaus je Lage), `efh.csv` und `we.csv`
(Durchschnittspreise je Altersklasse), `umsatz.csv` (Preisentwicklung,
Erbbauzinssätze). Alles Zero 2.0, alles für 73 Ausschüsse, alles bereits
heruntergeladen.

### Zu messen

- **Kostenkennwert gegen 904,26 €/m²** (Mix 49 % Stufe 2 / 51 % Stufe 3,
  Basisjahr 2010) — es fehlt die NHK-Zeile für ein Haus **ohne** Keller.
  Signatur `nhkKennwert(typ, kellerDg, stufe)`.
- **Baupreisindex 2,02 gegen die amtlichen 1,906** aus dem GMB Dortmund,
  dazu die fehlende Stichtagsfähigkeit.
- **`GND_TABELLE.geprueft` steht auf `false`** — Gewerbezeilen sind
  Arbeitsstand, stehen aber in Kundenberichten. Passt zum Befund, dass die
  Gewerbe-GND im CSV Stichprobenmittel sind (41 bis 75 Jahre).
- **`GND_JAHRE = 80` gegen den Modellvermerk** — Bonn rechnet Wohnen mit 60.
  Der Registerdatensatz führt die GND mit; gelesen wird sie noch nicht.
- **Lizenzangaben Hessen / MV / Berlin** im `boris/registry.js`, alle
  `verified: false`.
- **Stammdatenfeld „Garten" gegen das Hinterlandfeld** — stehen nebeneinander.
- **Ein NRW-Ausschuss ohne jeden LZS** (73 minus 72) und 8 Gemeinden ohne
  Abdeckung — auflisten und als „kein Ausschuss hinterlegt" führen.
- **Stadt Dortmund führt 8 LZS ohne Angabe der Geschäftsjahre** (Jahrgang 2023).

### Ernte — Stand und Fläche

**Liegenschaftszinssätze NRW: vollständig.** 493 Datensätze, alle 73 Ausschüsse,
Berichtsjahr 2024, auf Prod. Zweiter Jahrgang (2023, 479 Sätze) liegt geprüft im
Ernte-Paket bereit.

**Sachwertfaktoren: 21 Ausschüsse erfasst**, davon **15 am Original-PDF belegt**:
Bochum · Dortmund · Düsseldorf · Duisburg · Essen · **Höxter** · Iserlohn ·
**Märkischer Kreis** · Kreis Lippe · Kreis Paderborn · Bielefeld · Lüdenscheid ·
Rhein-Erft · Herford · Minden-Lübbecke. Nur aus der Netz-Ernte: Stadt Paderborn.
**Nicht belegbar:** Gütersloh und Köln (keine feste Adresse, nur über den
BORIS-Downloadbereich).

Vollständige Daten: `claude/v1083-ernte-lzs-nrw-alle-73.md` ·
`claude/v1083-ernte-hoexter-mk-belegt.md` · `claude/v1083-ernte-owl-ruhr.md` ·
`claude/v1083-ernte-rheinschiene.md` · `claude/v1083-ernte-fuenf-staedte.md` ·
`claude/v1083-ernte-hoexter-iserlohn-mk.md` ·
`claude/wettbewerb-sachwertfaktor-20260810.md` ·
`claude/v1083-korrektur-bonn-20260812.md` ·
`claude/v1083-messung-tarball-20260812.md`

**Nächster Ausbauschritt nach Aufwand pro Einwohner:** Berlin, Hamburg, Bremen
und Sachsen-Anhalt — zusammen fünf Ausschüsse für vier Bundesländer, alle
kostenfrei. Berlins Sachwertfaktor-PDF (Jahrgang 2025, Stand 04.02.2026) liegt
frei bei berlin.de. Danach NRW fertig. Rheinland-Pfalz wäre ein Bundesland
für 150 €.

### Wertermittlung, nach Wirkung

1. **Sachwertfaktoren ins Register** (siehe oben), beginnend mit Lüdenscheid.
2. **`mb.valuation_inputs` wird nicht beschrieben** → Berichte nicht
   reproduzierbar.
3. **Ist-Miete-Gegenüberstellung** § 31 Abs. 2 mit Abschlag nach § 8.
4. **RND-Tabellen des NRW-Modells** für GND 70, 60, 50, 40.
5. **MFH-Sachwert** (vertagt; Spezifikation liegt vor: `NHK_MFH_2010`
   825/985/1190 · 765/915/1105 · 755/900/1090, Wohnungsgrößenfaktor
   35 = 1,10 / 50 = 1,00 / 135 = 0,85 linear, Grundriss 1,05/1,00/0,97/0,95,
   GND 80 J, MEA-Bruch, BGF nur direkt, fehlende Felder → KEIN Sachwert; eigene
   Datei neben dem CrossCheckService). Der Sachwert-ETW-Text „nicht anwendbar"
   ist eine **Implementierungsgrenze**, keine ImmoWertV-Aussage.
6. **BOG/Wohnrecht-Modul** (Leibrentenmethode, Sterbetafel) — Feature-Lücke.

### Open Data

- **Auf Produktion liegen KEINE Open-Data-Sätze** in `param_werte`
  (`quelle_parser='p1-imbde'` = 0). Die 28.827 Sätze existieren nur auf Staging
  (davon 6.060 benannt, 22.767 offen). **`param_modell` ist davon unberührt** —
  dort liegen die 493 Registerdatensätze auf beiden Servern.
- **Der Pfad zum Open-Data-Erntewerkzeug im Container ist unbekannt** —
  `/app/od/tools/opendata-ernte.mjs` existiert NICHT. Erst suchen:
  `docker exec dealpilot-mb-backend find /app -name "opendata-ernte.mjs"`.
- **Berlin ernten** (v1066): braucht `poppler-utils`, Erwartung 6 Modelle,
  0 verworfen.

### Datenlücken

- **Ortsteil → Gebietsgruppe Berlin** (Tabelle 1 im Amtsblatt, 96 Zeilen) —
  `pdftotext` verklebt die Spalten.
- **Wägungsanteile für Mehrfamilienhäuser** — die Verordnung gibt sie nur für
  Ein-/Zweifamilienhäuser.

### Offene Entscheidungen (Marcel)

- **Ersatzebenen der Kaskade** (übernommener Faktor nach ImmoWertA Nr. 9(3)
  und/oder Anlage 25 BewG — oder weiterhin nichts)
- **Ausbaureihenfolge** und ob der RLP-Landesbericht gekauft wird
- **Anfrage an den Oberen Gutachterausschuss** wegen der robots-Sperre
- **`market=seed` auf Prod** — wann auf echte Vergleichsdaten?
- **Berater-Seat 39 €**
- **Bankexport-Free-Leck** (das Gate blockt nur `starter`, Free rutscht
  watermarked durch, das Marketing sagt „–")
- **APP_URL / Kunden-Mails auf `app.dealpilot.immo`**
- **Plan-Naming-Konsistenz:** die Landing verkauft Flugklassen, App/Stripe/
  Settings/Mails sagen Free/Starter/Investor/Pro — App-weite Umbenennung als
  eigenes Paket oder bewusst Landing-only?

### Aufräumen (eigene Pakete, nach Abnahme)

- Altes Intro-Markup (`intro-kerosin`, `#dpi-css`) — aktuell nur per CSS aus
- **Totes Pricing-Plugin:** `#pricing-host` existiert im Markup **nicht**;
  `pricing-plugin.js/.css` + Inline-Fassung (~23 KB) rendern nie
- `dp-hero-dealscore.mp4` ungenutzt (die Karte wird als HTML animiert)
- Alte Landing-Skripte (`market-live.js`, `effects.js`) werden nicht mehr geladen
- Leiche `marktbericht/frontend/app.js` im mb-Image
- `.pre-v108*`-Dateien auf Staging
- `.env`: tote `@junker-immo.de`-Empfänger, `ADMIN_EMAIL`-Platzhalter —
  **NICHT** `PRICEHUBBLE_USERNAME` / `SPRENGNETTER_AVM_USERNAME` (AVM-Logins!)
- `voiceStream.js` löschen

### Gold-Nachzug (ein Sammel-ZIP)

Voice-Orbit (Mikro-Gradient, Chip-Rand, `#vi-fill`) · Verlauf-Panel/Chart (v972) ·
Kerosin-Knopf-Gradient → WL_TINTS.
Backlog nach Sichtbarkeit: pricing-modal 53 · reseller-portal 42 · qc-bridge 39 ·
mobile-demo 37 · rnd-wizard 27 · settings 23 · tax-periods 20 ·
quick-boarding 18 · pass 17 · voice-import 16 · help 13.

### Steuer-Follow-up

Taggenaue 3-Jahres-Frist § 6 Ib Nr. 1a (ab Besitz/Nutzen/Lasten) +
fiktive-AfA-Kürzung (Eigennutzung → Vermietung). § 255 HGB AK gegen HK;
anschaffungsnahe HK > 15 % der **NETTO**-Gebäude-AK → HK/AfA statt Sofortabzug;
HK § 255 II 100 % Gebäude ohne Split.
**`sonst`-Auto-Sync Tab-Investition → `ak_sonst` hängt** (Fallback `ji_e` aktiv)
— Ursache fixen.

### Technik / Quer

Willkommens-Mail · Whitelabel-Domain vor dem Login · Abrechnung-Tab ·
Reseller-Self-Serve-Onboarding · Benachrichtigungen · erster Pool-Kauf als
Staffel-Test · SPF/DKIM/DMARC für `junker-immobilien.io` · DATEV EXTF (braucht
den Deal Tracker zuerst) · **Deal Tracker** (`ledger_entries`, `typ CHECK`
ertrag/aufwand/zins/tilgung/aktivierung) **und Ankauf-Widget** (Feature-Lücke
gegenüber ImmoAnalyse.Pro) · Portfolio-Pass · Bestands-PDF · Co-Pilot-Tab ·
ImmoMetrica-Vollintegration · NeuRIS ·
Forschungszulage (FZulG, Borchard/OneVoice, 2026–2028, ~105.840 €, 35 % KMU,
70 €/h Eigenleistungspauschale) · Pflichtdokumente v2 ·
Mitgabe-Expansion (`.dpkt`) · immocation-Print-File · DPMA (Wort + Bild) ·
UG → GmbH · SSoT `pricing-modal` + Landing aus `config.js` ·
Bundesbank-406 bei Live-Marktzinsen · Kommunale Wärmeplanung ·
Stripe-Webhook prüfen/reaktivieren · DB-Passwort-Rotation · Server-Upgrade ·
„PDF beim Export frisch rechnen" (offscreen-iframe wie MA27) ·
Altobjekte ohne `kaufdat` einmal öffnen + speichern

---

## DIE TESTOBJEKTE

| | |
|---|---|
| **Hüllhorst** — Hermannstraße 9, 32609, ETW 165 m², Bj 1968, 2 WE | Kreis Minden-Lübbecke (AGS 05770016). **Regression:** Gebäudesachwert **305.937 €**, vorläufiger Sachwert **348.687 €**, Zinsanpassung **2,56 %**, amtliche Miete **4,83 €/m²**, Vergleichsfaktor **239.250 €**, RND **49,6 J.** Seit v1083b zusätzlich: LZS 2,2 % **Stufe A**, Herkunft **kreisscharf**, Belastbarkeit **92 %**, Sachwert-Karte nennt den Grund „Ausschuss leitet für diese Objektart keinen Faktor ab" |
| **Löhner Straße 278**, 32120 Hiddenhausen, ZFH 233 m², Bj 1964 | Kreis Herford (AGS 05758016). **Maßstab:** Verkehrswertgutachten 350.094,36 €, BGF 346,62 m², Bodenwert 144.840 €. **Regression durch den generischen Auswerter:** vorläufiger Sachwert 326.649 € × **SWF 0,889 Stufe A** (Tabelle 0,899, kRnd −0,01, kBgf 0) = **290.391 €** marktangepasst. Marcels 0,91 war eigene Angabe (Stufe E). |

**Achtung bei den Löhner-Sollwerten:** Sie sind unter der Restnutzungsdauer 18
entstanden — also ohne erfassten Modernisierungsgrad. Sobald der Klicktest mit
Modernisierungspunkten läuft, ändern sich beide Regressionswerte und müssen neu
festgelegt und gegen das Gutachten abgenommen werden.

**Beide gehören in jede Prüfstrecke, die den Rechenkern anfasst.**

---

## KEY-LEARNINGS — DIE KURZFASSUNG

- **Erst messen, dann bauen.** Marker-Übersicht als erster Befehl; die Landkarte
  selbst aufnehmen; keiner Übergabe glauben — auch keiner eigenen.
- **Der Sollwert kommt aus dem Dokument** — inklusive Rundung. Wo keiner steht:
  Monotonie über die ganze Tabelle, Nachzählen **und** die abgedruckte
  Stichprobenstatistik.
- **Eine Prüfung darf ihre Vorbedingung nicht selbst herstellen.** Am
  Ausgabeobjekt messen und an seinem Leser, nicht am Rückgabewert.
- **Große Pakete, ein `apply.sh`, Installationsbefehle ungefragt, Server sauber.**
- **In jeden Befehlsblock: `cd`, `hostname`, Zweig.** Staging-first. Nur eigene
  Dateien einzeln stagen. Vor dem Merge `git pull --ff-only`, vor dem Prod-Pull
  `git fetch` + gegenlesen. Nur EIN Chat fasst git an.
- **Die Kette prüfen, nicht die Funktion** — aber erst messen, bevor ein Befund
  behauptet wird. Die Messung macht den Fix oft kleiner.
- **Jede Zahl trägt ihre Herkunft** (Stufe A–E, Modellvermerk, Ausschuss,
  Stichtag, Maßstab). **Kein Verfahren rechnet halb. Ein stiller Rückfall ist
  schlimmer als ein Fehler — und ein falsch beschrifteter Hinweis auch.**
- **Rechenkerne nie duplizieren:** DSCR, KPI, Score, `gutachterausschuss.js`,
  `swf_modelle.js`, `kaskadeSchluessel()`, `stufeNachStreuung()`.
- **Gold über `var(--wl-*)` + WL_TINTS; Statusfarben bleiben hart; Wächter vor
  jedem Rollout.**
- **Plan nie lesen vor `dp:plan-ready`. Marktbericht-Proxy immer durch
  `qstrUser`. Öffentliche Endpoints immer 204.**
- **Beweisen statt behaupten** — Untestbares ehrlich als Staging-Abnahmepunkt
  kennzeichnen.
- **Fehler offen zugeben, falsche Diagnosen ausdrücklich zurücknehmen.** Zwei
  gleiche Fehler hintereinander heißt: Sitzung beenden, Übergabe schreiben.

---
---

# TEIL VI — DIE ARBEIT IM REPO (CLAUDE CODE)

Teil I–V beschreiben den Weg über den Chat: Tarball anfordern, ZIP mit
`apply.sh` bauen, `scp`, auf dem Server auspacken. **Dieser Weg gilt
weiterhin** — für alles, was das mb-Backend, Migrationen oder Server-Eingriffe
betrifft.

Seit dem 04.08. läuft die Frontend-Arbeit über einen zweiten Weg: **Claude Code
direkt im Arbeitsverzeichnis `E:\DealPilot\repo`.** Zwischen dem 04. und 12.08.
sind darüber **254 Commits (v1079 bis v1147b)** entstanden. Dieser Teil hält
fest, was dieser Weg anders macht und was er gekostet hat.

## VI.1 · WELCHER WEG WANN

| | Chat + ZIP (Teil I–V) | Repo + Claude Code (Teil VI) |
|---|---|---|
| **Wofür** | mb-Backend, Migrationen, Server, Ernte | Frontend, CSS, JS, Landing, Admin |
| **Werkzeug** | `apply.sh` + `patch.py`, Anker mit `count==1` | direkte Dateiänderung, `git` |
| **Ausrollen** | `scp` + `unzip` + `apply.sh` + Rebuild | `.\tools\deploy-staging.ps1` |
| **Prüfen** | Marker im Container greppen | im Browser nachmessen |
| **Rollback** | `rollback.sh` / `.pre-<paket>` | `git checkout -- <datei>` |

**Gemeinsam bleibt:** neue Versionsnummer bei neuem Inhalt · große Pakete ·
Staging-first · Marker in Kommentaren · Cache-Buster hochziehen · nur eigene
Dateien einzeln stagen.

### Die Dateien, die die Arbeit steuern
| Datei | sagt |
|---|---|
| `CLAUDE.md` | **wie** gearbeitet wird (Kurzfassung dieser Anweisung, im Repo) |
| `BACKLOG.md` | **was** ansteht — Reihenfolge = Priorität, oberster offener Punkt wird bearbeitet |
| `FALLEN.md` | **wo** schon jemand hingefallen ist (Werkzeug- und Messfallen) |
| `PROJEKTANWEISUNG.md` | **diese** Datei — der Gesamtstand, fortlaufend |
| `design/mockups/` | der Zielzustand. Bei Layoutfragen dort nachsehen statt raten |
| `design/Vorschläge/` | Demo-first-Ablage: **zuerst** Entwurf, **dann** bauen |

**Marcel legt seine Screenshots jedes Mal in `design/mockups/` ab.** Vor jedem
Punkt, der Optik betrifft, dort nachsehen — und **den Dateinamen in den
Backlog-Punkt schreiben**. Ein Optik-Befund ohne Bildbezug ist eine Vermutung;
beim Stapel-Modus kam die falsche Annahme aus `handy2.jpg`, einer Datei, die
gar nicht mehr im Repo lag.

### Arbeitsmodus — durchziehen statt nachfragen
**Standard ist: machen.** Nicht fragen, ob gebaut werden soll — bauen,
ausrollen, prüfen, nachbessern, bis es steht. Der Kreislauf pro Aufgabe:

1. Messen (DOM, Konsole, `getBoundingClientRect`) und **den Befund nennen**
2. Ändern
3. `.\tools\deploy-staging.ps1`
4. Im Browser nachmessen, ob es **wirklich** wirkt
5. Bei Abweichung zurück zu 1 — **nicht** fragen, ob weitergemacht werden soll

Erst melden, wenn es **funktioniert** oder wenn du **nicht weiterkommst**.

**Nachfragen nur bei:** Produktion · Datenbank-Eingriffen · Geld, Preisen,
Kündigungen · Optik ohne klare Vorgabe (dann Demo bauen und zeigen) · wenn
etwas aus „Nicht anfassen" angefasst werden müsste · nach drei erfolglosen
Anläufen (STOPP, Diagnose, melden).
**Nicht nachfragen bei:** Datei-Änderungen im Repo, Commits, Ausrollen auf
Staging, Messen im Browser, Zwischenversionen. Das ist der Auftrag.

### Commit- und Deploy-Disziplin im Repo
- **NIE `git add -A` oder `git add .`** — Dateien einzeln stagen.
- **Nie committen:** `auto-save.js` · `docker-compose.prod.yml` · `Caddyfile` ·
  `*.pre-*` · `patchesold/`
- Vor dem Commit `git diff --cached --name-only` gegenlesen.
- **Nach jeder JS/CSS-Änderung den Cache-Buster hochziehen**, sonst kommt die
  Änderung im Browser nicht an.
- Frontend ist **volume-mounted** → `git pull` auf dem Server = sofort live,
  kein Rebuild. Backend-Änderung oder neue Migration → Rebuild.
- Commit-Nachrichten benennen den **Befund**, nicht die Nummer
  (`v1144: Der Sachwertfaktor wurde nie angewandt — falscher Feldname an zwei
  Stellen`). Nach Abschluss wandert der Punkt in `BACKLOG.md` nach **Fertig**,
  mit Datum, Commit-Hash und Befund.

---

## VI.2 · DAS DEPLOY-SKRIPT LÜGT IN BEIDE RICHTUNGEN

`tools/deploy-staging.ps1` hat drei Defekte, alle offen. Die Datei liegt per
`.gitignore` **nur lokal** — sie taucht in keinem Repo-Stand auf.

- **BOM vor `set -e`.** Der Server meldet
  `bash: line 1: ﻿set: command not found`, das `set -e` wird verschluckt. Ohne
  Fehlerabbruch gibt ein gescheiterter Deploy trotzdem `AUSGEROLLT: <sha>` aus.
  **Fehlschlag sieht aus wie Erfolg.**
- **Abbruch an gits stderr.** `$ErrorActionPreference = "Stop"` plus PowerShell
  5.1: `git push` schreibt seinen Fortschritt nach stderr, daraus wird ein
  `NativeCommandError`, das Skript bricht in Zeile 68 ab — **obwohl der Push
  lief**. Schritt 6, der `git pull` auf dem Server, läuft dann nie. GitHub hat
  den Stand, der Server nicht. **Erfolg sieht aus wie Fehlschlag.**
- **Abbruch an fremden Serveränderungen.** Das Skript bricht ab, sobald auf dem
  Server eine verfolgte Datei geändert ist — auch wenn der eigene Commit sie
  nicht anfasst. Auf Staging war das der Dauerzustand: 319 Zeilen aus zwei
  alten Paketen in `marktbericht/backend/src/connectors/boris/registry.js`, die
  nie zurückflossen (mit `e35e34b` eingesammelt).

**Deshalb nach jedem Lauf den echten Stand prüfen, nie der Ausgabe glauben:**
```
ssh root@116.203.214.11 'cd /opt/dealpilot && git rev-parse --short HEAD'
```
gegen den lokalen `HEAD`. Bricht das Skript nach dem Push ab, den Server-Pull
von Hand nachziehen (`git pull --ff-only` in `/opt/dealpilot`).

---

## VI.3 · MESSEN IM BROWSER — DIE KABINE

`resize_window` ändert `innerWidth` **nicht** — es blieb bei 1920, egal was
angefordert wurde. Responsive messen geht nur über ein **gleich-Origin-iframe**
mit gesetzter `style.width/height`; Media-Queries richten sich danach.

- **Die Kabine braucht einen Träger, auf dem die App nicht schon läuft.** Ein
  Renderer-Einfrieren (CDP-Timeout nach 45 s) kam nicht vom iframe, sondern
  davon, dass dieselbe App zweimal im selben Renderer startete. Träger ist
  `/impressum.html` (7 KB), Inhalt gelöscht, iframe 390 × 844 bzw. 820 × 1180.
  **Auf der App-Domain**, nicht auf der Landing-Domain.
- **Eine unbekannte URL taugt nicht als leerer Träger** — der SPA-Fallback
  liefert die volle App zurück (159 Skripte).
- **Eingefrorene Transitions.** Der gedrosselte Tab lässt CSS-Transitions bei
  Offset 0 stehen; der Drawer sah geschlossen aus, obwohl `.sb-mobile-open`
  gesetzt war. `*{transition:none!important}` hilft **nicht**. Was hilft:
  `document.getAnimations().forEach(a => a.finish())` nach jeder Änderung.
  Transitions stehen in der Kaskade **über** allem, auch über Inline-`!important`.
- **Im verborgenen Tab feuert `requestAnimationFrame` nie** — ein rAF-Nachlauf
  läuft dort nicht an (v1082c, v1092b). Nachläufe ohne rAF bauen.
- **CDP bricht nach 45 s ab.** Ein `setTimeout(…, 60000)` im selben
  `javascript_tool`-Aufruf meldet „renderer may be frozen", obwohl die Seite in
  Ordnung ist. Wartezeiten auf mehrere Aufrufe verteilen, ≤ ~40 s pro Aufruf.
- **`window.confirm` blockiert jede Browser-Automation.** Der
  Marktbericht-Abruf fragt vor dem kostenpflichtigen Lauf nach
  (`marktbericht-app/app.js:224`, v647-cost). Der modale Dialog friert den
  Renderer ein, der Tab ist tot und muss geschlossen werden. **Das ist kein
  Produktfehler — der Dialog ist der Kostenschutz und gehört dahin.** Vor
  automatisierten Läufen `window.confirm = () => true` setzen (und den Text
  mitschreiben, er nennt den Preis). Gilt genauso für `alert` und `prompt`.
- **Ein Überlauftest prüft gegen den klippenden Vorfahren, nicht gegen den
  Viewport.** Fünf abgeschnittene Tabellenzellen blieben unentdeckt, weil sie
  innerhalb des Fensters lagen. Vorfahren mit `overflow-x:auto` zählen **nicht**
  als Befund — dort ist der Inhalt erwischbar.
- **Zustand aus dem vorigen Prüflauf verfälscht die nächste Messung.** Ein
  selbst gesetztes `body.hdr-collapsed` überlebte den Reload (localStorage) und
  ließ einen Spalt von 49 px melden, den es nicht gab. Vor jeder Messung
  `document.body.className` und die einschlägigen Merker mitlesen — und im
  Befund nennen.
- **Aufklapper sind Umschalter.** `feldhilfe.js` entfernt den Kasten, wenn er
  schon da ist. Ein Prüflauf, der alle Info-Zeichen durchklickt, **schließt**
  die aus einem abgebrochenen Lauf noch offenen und meldet sie als „ohne Text".
  Vor der Messung `.fh-box` abräumen.
- **Faustregel:** Sieht eine Messung physikalisch unmöglich aus, liegt es am
  Messwerkzeug, nicht an der App.

---

## VI.4 · WELCHE CSS-REGEL GEWINNT, SAGT NUR DER KASKADEN-WALKER

**`element.matches(selektor)` findet Regeln, sagt aber nichts darüber, welche
gewinnt.** Zwei Sitzungen sind daran hängengeblieben: eine Regel als gewinnend
erklärt, die tatsächlich verlor, und dann am Symptom weitergepatcht.

In `css/style.css` (36.929 Zeilen, 4.198 `!important`, 226 Media-Queries auf
25 Breakpoints) steht zu fast jedem Element mehr als eine Farbregel. Häufigster
blinder Fleck: das Element trägt **Klasse und ID**
(`<div class="hdr-obj-name" id="hdr-obj">`), die Gegenregel selektiert über die
ID. `!important` auf beiden Seiten hebt sich auf, es entscheidet die Spezifität.

Der Walker läuft alle `document.styleSheets` rekursiv (auch `@media`), matcht je
**Teilselektor** einer Kommaliste und sortiert nach `!important` → Spezifität →
Reihenfolge. Zwei eigene blinde Flecken:

- **Kurzschriften.** CSSOM expandiert `background:` nicht zu `background-color`.
  Wer nur das Longhand abfragt, findet null Treffer und hält die Stelle für
  ungeregelt. Immer **beide** abfragen. Gleiches beim Schreiben: wer
  `background:` überbieten will, muss selbst `background:` setzen.
- **Pseudoelemente.** Das Goldband der Stapel-Karte ist `.sbc-top::before`. Ein
  Grund-Leser, der nur die Elternkette abklappert, rechnet Text gegen die dunkle
  Karte darunter und meldet k=1,08, wo real k=8,01 steht.

### Inline-`!important` schlägt alles
Mehrere JS-Dateien setzen Stile **inline mit `!important`**, ausdrücklich um jede
CSS-Regel zu schlagen — `js/dp-band-fix.js` (v863, Schließen-Knopf) und
`js/deal-action-boarding.js` (v857, `min-height:0` auf `.dab-chip`). Der
Kaskaden-Walker findet den Setzer **nicht**: er läuft `document.styleSheets`, und
die Inline-Regel steht dort nicht drin.

**Wirkt eine Regel nicht, obwohl die Spezifität passt:** zuerst
`el.getAttribute('style')` lesen. Steht der Wert dort, wird **in der JS-Datei**
geändert, nicht im CSS. Ein zweiter CSS-Versuch mit höherer Spezifität ist
verlorene Zeit.

### Weitere CSS-Fallen dieser Ära
- **Token-Überschreibungen reichen nicht** — farbtragende Flächen müssen
  **einzeln benannt** werden. Die dunkle Fassung hängt **nicht** an
  `--surface`/`--border`, sondern an später gesetzten, harten Regeln:
  `header.hdr`, `nav.tabs`, `aside.sidebar`.
- **Bei gleicher Spezifität gewinnt die spätere Regel.** Lieber Spezifität
  erhöhen als auf Ladereihenfolge bauen.
- **`:not(#id)` erbt ID-Spezifität** — `.hero > *:not(#dpm-flug)` hat 110, nicht
  10. Nie Sammelregeln auf Container-Kinder.
- **Flex-Kinder in `overflow:auto`-Containern schrumpfen, statt zu scrollen.**
  Der Inhalt wird still abgeschnitten → `flex:0 0 auto` setzen.
- **`align-items:center` lässt leere `::before`-Pseudoelemente auf null Höhe
  schrumpfen** → `align-self:stretch`, sonst ist der Verlauf unsichtbar.
- **`var()` funktioniert nicht in** SVG-Präsentationsattributen, Canvas, Leaflet,
  jsPDF, Data-URIs → `_wlc()` / `_wlrgbaH()` / `_pdfGold()`.
- **`#app` gibt es in der App NICHT.** `document.getElementById('app')` liefert
  `null`. Eine CSS-Regel mit diesem Anker greift **nirgends** und sieht dabei
  völlig plausibel aus — kostete in `v1147` einen ganzen Ausrollzyklus (behoben
  mit `v1147b`). **Jeden Anker vor dem Schreiben im Browser auslesen, auch den
  aus der eigenen Dokumentation.**

---

## VI.5 · DIE DARSTELLUNGS-EBENE (v1082–v1136h)

Der Nutzer kann das Aussehen der App über vier Attribute am `<html>` steuern.
Modul ist **`js/ui-varianten.js`** mit **`css/ui-varianten.css`**; das Panel
sitzt in `js/settings.js`. Gemessen am 12.08.:

| Attribut | Werte | Istzustand (**kein** Attribut) |
|---|---|---|
| `data-ui-theme` | `kontor` · `panel` · `kanzlei` · `boarding` · `konsole` | DealPilot |
| `data-ui-cards` | `kompakt` · `wallet` · `stapel` | Standard |
| `data-ui-surface` | `light` | Passend |
| `data-ui-form` (v1098) | `kantig` · `rund` | Passend |

- **Istzustände tragen bewusst kein Attribut.** Ein `data-ui-theme=""` würde in
  CSS auf `[data-ui-theme]` matchen und den Istzustand kippen — leerer Wert
  heißt **Attribut entfernen** (`ui-varianten.js:140`).
- **Der Vorwegsetzer im Kopf** (`index.html:45`, Marker `v1082-uv-boot`) setzt
  die Attribute **vor dem ersten Paint**, sonst blitzt beim Neuladen kurz die
  DealPilot-Fassung auf. **Achtung, gemessene Lücke:** seine Whitelist kennt bei
  `data-ui-cards` nur `['kompakt','wallet']` — **`stapel` fehlt** (v1095 nicht
  nachgezogen), und `data-ui-form` fehlt ganz (v1098 nicht nachgezogen). Wer
  eine neue Vorlage oder einen neuen Modus baut, **trägt ihn dort mit ein.**

### Skin und Vorlage sind zwei verschiedene Dinge
Neben der Vorlage gibt es den **Chrome-Skin**: `body.dp-chrome-hell` (103
Regeln), API `window._dpDispSkin('hell'|'obsidian')`, Merker `dp_chrome_hell`.

- **`_dpDispSkin` ist ZWEIMAL definiert** — `settings.js:3130` und
  `settings.js:3364`. **In JS gewinnt die letzte**, und nur die schaltet
  zusätzlich `dp-hdr-compact`. Wer die erste patcht, editiert toten Code.
- **Hell und Obsidian nie im laufenden Tab umschalten.** `_dpDispSkin`
  hinterlässt Inline-CSS-Variablen am `<body>`, die nach dem Zurückschalten
  stehen bleiben — die zweite Messung misst eine Mischfassung, die es im Betrieb
  nicht gibt. `styleElement.disabled = true` setzt den berechneten Stil nicht
  zurück. **Teuer dazu:** `_dpDispSkin` ruft `vorlageNachziehen()`; steht die
  aktive Vorlage der neuen Helligkeit entgegen, wird
  `dp_user_settings.ui_theme` auf `''` gesetzt — **die Vorlage ist weg.**
  Zum Messen: Merker `dp_chrome_hell` setzen, `reload()`, messen. Fassung A und
  B je einzeln. **Nie A→B→A in einem Tab.**
- **Zustände über den Bedienweg herstellen, nie per Attribut.** Wer
  `data-ui-theme` per `setAttribute` setzt, misst **nicht** denselben Zustand wie
  ein Klick im Panel: der Klick löst zusätzlich `skinNachziehen()`
  (`ui-varianten.js:853`, v1085) aus. Ein Paket sah über `setAttribute` sauber
  aus und färbte über den echten Weg Kopf und Tab-Leiste in **allen vier hellen
  Vorlagen schwarz**.
- Ursache war ein **Tokenname mit zwei Bedeutungen**: `--dp-header-bg` ist der
  Nutzerwert des Reglers *und* eine Interna des Hell-Skins. Bevor ein fremdes
  Token als „Nutzerwert" gelesen wird: prüfen, wer es sonst noch setzt. **Dem
  eigenen Zweck gehört ein eigener Namensraum** (v1104: `--uv-*` für die
  Bereichsfarben).

### Markenverlust wird über den Farbton gemessen
Um zu prüfen, wo eine Vorlage die Markenfarbe totsetzt: Akzent setzen,
Momentaufnahme **ohne** Vorlage, dann je Vorlage erneut, je Element vergleichen.
Zählen oder Regex über die CSS-Datei taugt nicht. Vier Fallen:

1. **„Neutral" ist nicht „grau".** Mit dem Kriterium max − min ≤ 8 meldete die
   Vorlage `panel` null Treffer — ihr Neutralton ist `rgb(21,26,32)` (Blaustich),
   `boarding` ist cremefarben. Richtig ist der **Farbton**.
2. **Nie mit rotem Testakzent messen.** Rot ist von Status-Rot nicht zu trennen,
   Grün genauso wenig. **Violett** (`#7C5CBF`) hält beide eindeutig.
3. **Rahmenfarbe nur zählen bei `border-width > 0`** und Stil ≠ `none`.
4. **`color` nur zählen bei eigenem Textknoten** — sonst zählt jede
   Vererbungsstufe mit, und aus 13 Elementen werden scheinbar 33.

**Die Trennlinie:** Gold bei 10–55 % Deckung ist ein **Neutralton**, den die
Vorlage bestimmen darf. Vollton auf Text oder Bedienelement ist **Marke** und
muss mitfärben. Und **beide Bedienwege** prüfen —
`DealPilotWhitelabel.apply()` setzt `--gold-d` und die `--wl-*`, der Regler
`_dpDispAccent()` nicht (v1096b).

**Markentöne tragen einen Mindestkontrast** (v1097), keine feste
Prozent-Ableitung — ein Ton für helle Flächen statt zwei (v1097b). Die
Gold-auf-Gold-Reihe (v1113 bis v1113f) hat vier Markenableitungen einzeln
nachgezogen; drei davon fielen erst in der **Rot-Gegenprobe** auf.

---

## VI.6 · DIE OBJEKTKARTE — GEMESSENE STRUKTUR

Gebaut in `js/storage.js` von `_renderRichCard()` ab Z. 866, Karten in `#sb-list`.

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

- Karte zeigt **Kaufdatum** (`.sbc-date` = `kaufdat`), `updated_at` nur als
  `data-updated`. Backend `listForUser` liefert `data->>'halter'` +
  `data->>'kaufdat'` (Änderung = Backend-Rebuild).
- **`.sbc-halter` trägt Farbe und Größe inline im Markup** (v850,
  CSS-kommt-nicht-an-Lehre) — nicht auf eine CSS-Regel zurückbauen.
- Sidebar-Suche ist `sidebar-search.js`, keine zweite `sb-search.js`.
  `sb-portfolio`-Block bleibt entfernt (v848); Portfolio-Cockpit nur über das
  Aktionen-Akkordeon.
- **Vier Modi, vier Baustellen:** Standard · **Wallet** (v1082e–v1082j: Score-
  Ringe standen leer, Foto dehnte sich, Stufen-Pille rutschte unter den Ring —
  vier Anläufe) · **Kompakt** (v1092–v1094: schmale Zeile zum Aufklappen;
  v1082k sparte nur 10 px, weil das falsche Element getroffen war) ·
  **Stapel** (v1095, Handy-Optik; Feinschliff v1105–v1105c).
  **Gegen die gemessene Struktur bauen, nicht gegen das Mockup** — `v1082g`
  war ein Neubau genau aus diesem Grund.

---

## VI.7 · WERKZEUGFALLEN UNTER WINDOWS / POWERSHELL 5.1

- **`Set-Content` zerstört Dateien mit Umlauten.** Ein
  `(Get-Content x -Raw) -replace … | Set-Content x -Encoding UTF8` hat
  `index.html` komplett neu geschrieben: jedes Nicht-ASCII-Zeichen doppelt
  kodiert, BOM vorangestellt — **711 geänderte Zeilen statt einer** (behoben mit
  `v1123c`). Immer `[System.IO.File]::ReadAllText` / `WriteAllText`. Nach jeder
  Buster-Änderung `git diff --stat` gegenlesen.
- **`WriteAllLines` rettet nicht, wenn das Skript selbst falsch gelesen wird.**
  PowerShell 5.1 liest eine `.ps1` **ohne BOM als ANSI**: jedes „—" und jeder
  Umlaut im Skript-**Literal** ist schon beim Einlesen kaputt. Betrifft nur die
  eigenen Literale, nicht die eingelesenen Zeilen — deshalb sieht die Datei zu
  99 % richtig aus. Auch Suchmuster trifft es: `-Pattern '^## Später'` findet
  nichts. **In Skripten ASCII-Muster benutzen** (`'^## Sp.ter'`) und Texte mit
  Umlauten aus einer UTF-8-Datei einlesen, nie als Literal.
- **PowerShell 5.1 behandelt typografische Anführungszeichen wie echte Quotes.**
  Eine Commit-Nachricht mit „…" sprengt das Here-String, git liest die
  Bruchstücke als Dateinamen. Nachricht in eine Datei schreiben und
  `git commit -F` nutzen.
- **`&&`, `||`, `?:`, `??`, `?.` gibt es in 5.1 nicht** — `; if ($?) { … }`.
  Kein `2>&1` auf native Exes (NativeCommandError trotz Exit 0).
- **`DPC` gibt es im Seiten-Scope nicht.** In `config.js:852` steht
  `var DPC = window.DealPilotConfig;` — ein modul-interner Alias. Nach außen
  heißt alles `window.DealPilotConfig.branding.*`. Ein `try/catch` mit stillem
  Rückfall auf den Rohwert ließ eine Korrektur **nie** laufen, bei gemessenem
  Kontrast 1,00. **Fehlende Module laut melden**, nicht im `catch` verschwinden.
- **`grep -q` in einer Pipe kappt die Pipe** — der Sender stirbt an
  `BrokenPipeError`. Ausgabe erst in eine Datei, dann zählen.
- **Ein falscher Modulname lässt die Korrektur stillschweigend nie laufen**
  (`v1123e`). Modulnamen gegen die Datei prüfen, nicht gegen die Erinnerung.

---

## VI.8 · CHRONIK v1079–v1147b (254 Commits, 04.–12.08.)

Thematisch geordnet; die Commit-Nachricht nennt jeweils den Befund.

| Strecke | Versionen | worum es ging |
|---|---|---|
| **Logo / Kopf** | v1079 · v1080 · v1086 · v1086b · v1101 · v1101b | rahmenlose Wortmarke, Goldrahmen aus CSS, kompakter Logo-Kopf, Regler wirken auch unter einer Vorlage. `v1086b`: Logo saß mittig statt links — **Flex-Richtung fehlte, zweites Mal** |
| **Plan-Gates** | v1081 | Partner-Plan war von fünf Pro-Gates ausgesperrt |
| **Darstellungs-Vorlagen** | v1082 · v1082b–v1082k | die zwei 404-Dateien mit Leben gefüllt; heller Text auf hellem Grund; Karte trägt Farbe als Verlauf; Wallet neu gebaut |
| **Aktionen-Menü** | v1084 · v1084b · v1136e–v1136h | gegliedert, Schranken sichtbar, Kerosin am Eintrag, Trefferflächen 769–900 px, folgt der hellen Darstellung |
| **Skin ↔ Vorlage** | v1085 · v1103 · v1136f · v1136g | Skin-Schalter gekoppelt; Hell-Skin überstimmte die Vorlage an drei Flächen; Träger der Hell-Regeln ist nur der Chrome-Skin |
| **Tablet-Kopfleiste** | v1087 · v1087b | von 589 px auf fünf Spalten (statt Scroller) |
| **Heller Text auf hellem Grund** | v1088 · v1089 · v1090 · v1107 · v1107b | Leiste, Kopfzeile, Tabs, die letzten zwei Goldflächen, Kachel-Texte in **jeder** Vorlage |
| **Kartenmodi** | v1091 · v1091b · v1092–v1092d · v1094 · v1095–v1095c · v1105–v1105c · v1106 · v1108 · v1108b | Kompakt als aufklappbare Zeile, Stapel als vierter Modus, Score-Ring lag über der Adresse. `v1092d` nimmt `v1092c` zurück |
| **Marke unter den Vorlagen** | v1093 · v1096 · v1096b · v1097 · v1097b · v1109 · v1113–v1113f | die Vorlage darf die Marke nicht totsetzen; Mindestkontrast statt Prozent-Ableitung; WL-Tints mit Einstufung je Ton |
| **Darstellungs-Panel** | v1098–v1098d · v1099–v1099d · v1100 · v1102–v1102c · v1104 · v1110 | Abschnitt Marke, Form und Schrift; Arbeitsbereich folgt der Vorlage; **altes Panel abgeklemmt** (v1100); eigener Namensraum für Bereichsfarben (v1104); Einstellungen galten nach jedem Tab-Wechsel als geändert (v1110) |
| **Partner / Whitelabel** | v1111 · v1114 · v1122 | Partner-Flow Weg C und A, dann B (drei Freiheitsstufen je Partner, ohne Migration); Partner-Branding griff nicht — **drei getrennte Ursachen** |
| **Handy** | v1112 · v1112b · v1118 · v1118b · v1118c · v1138b–v1138e · v1141d | Einstellungen auf dem Handy (**vier Kaskadenfehler**), Partner-Portal nie für kleine Schirme gebaut, **Handy-Sperre gefallen**, Trefferflächen auf 44 px, Löschen-Schaltfläche lag auf der Score-Zahl |
| **Schließen-Knopf** | v1115 · v1116 · v1117 | Ist-Zustand gemessen, drei Fassungen gezeigt, Fassung B an sieben Stellen vereinheitlicht — und `v1117`, weil sie erst dann wirklich ankam |
| **Textfarben-Regler** | v1123–v1123e | Score- und KPI-Karten; `v1123c` reparierte die eigene Kodierungspanne; `v1123e`: falscher Modulname, die Korrektur lief nie |
| **Kopf/Reiter-Spalt** | v1124 · v1124b | `hdr-h` blieb stehen, auch beim zugeklappten Kopf |
| **Marktbericht-Preise** | v1125–v1125c · v1126–v1126d | drei echte Stufenpreise (**GELD-Befund:** Stufe 1 bewarb 2 L, abgebucht wurden 5 L), Meilensteinleiste, Bestätigungsdialog nennt den echten Preis. `v1126c`: Stufe 3 war unerreichbar (Henne-Ei) |
| **Marktbericht-Wizard** | v1127–v1130 | Reiter, ganze Fläche, sechs Reiter statt drei, Übersicht als erster Reiter. `v1129c`: der Ladebalken hat nie existiert |
| **Werbungskosten-PDF** | v1131 · v1132 · v1133 | Aufstellung ging nicht auf (1.500 € ohne Zeile), Nullzeilen verschwinden, Steuerwirkung pro Jahr und Monat |
| **Marktbericht-Rückweg** | v1119–v1121 · v1134 · v1135 · v1135b · v1136–v1136d | bedingte Felder erschienen nie; **fünf Felder gingen im Objekt verloren**; das Hauptprogramm löschte die Wertermittlungsfelder wieder weg; Zahlenfelder nehmen die deutsche Schreibweise an |
| **Landing** | v1083 · v1136i · v1136j | Netzwerk-Fehlermeldung nennt die Ursache; Partnerlogo CareTech Thiel (Zuschnitt war das Problem, nicht die Größenregel) |
| **Rechenkern / Sachwert** | v1137 · v1137b · v1139–v1146b | negativer Cashflow zeigt sein Vorzeichen; **Bodenwertverzinsung bei ETW lief auf dem doppelten Wert** (v1140); Rechenwege im Ergebnis; **der Sachwertfaktor wurde nie angewandt — falscher Feldname an zwei Stellen** (v1144); neun tote Info-Zeichen bekamen Texte |
| **Ankreuzfelder** | v1147 · v1147b | auf 33 px (Marcels Entscheidung). `v1147` stand auf `#app` — **ein Element, das es nicht gibt** |

**Drei Rücknahmen in dieser Ära, alle ausdrücklich:** `v1092d` (nimmt `v1092c`
zurück), `v1113f` (nimmt den eigenen Rückschritt aus `v1113e` zurück),
`v1136h` (Band und Kopf zurückgenommen, Zusatz bleibt auf der Sidebar).

---

## VI.9 · STAND UND EINSTIEGSPUNKT (12.08.2026)

**Alles auf `6a11a32`**, lokal wie Staging, Zweig `staging`, Arbeitsverzeichnis
sauber. Der Einstiegspunkt steht **im Backlog oben** unter
„→ Hier weitermachen"; diese Datei wiederholt ihn nicht, sonst laufen zwei
Wahrheiten nebeneinander.

**Prüfstrecken auf Staging:**
- `PRUEF_ZFH Löhner Str. 278` (`3fbb754c`) — **EFH**, Stufe 3 bezahlt, weitere
  Marktberichte kosten **0 L**. Der einzige Haus-Testfall.
- `Hermannstraße 9 Hüllhorst` (`07d89138`) — ETW, Stufe 3 bezahlt.
- Kerosin zuletzt: **86 L**.

**Zwei offene Abnahmen:**
1. **Ankreuzfelder 33 px** (`v1147b`) — gemessen ohne geladenes Objekt, 0 von
   26 Feldern sichtbar. Mit geladenem Objekt gegenmessen, ob die Formularzeilen
   tragen (besonders Steuer und Pilot-Analyse).
2. **Produktion** — liegt dieselbe `registry.js`-Drift dort auch? SSH ist
   read-only, ein Dateivergleich genügt.

**Aus dieser Konsolidierung neu aufgenommen (noch nicht gebaut):**
- Der Vorwegsetzer `v1082-uv-boot` in `index.html:46` kennt `stapel` und
  `data-ui-form` nicht → beim Neuladen blitzt für diese Nutzer die
  DealPilot-Fassung auf. Zwei Zeilen, siehe VI.5.
- `frontend/style.css` (27.477 Zeilen, 842 KB) wird von keiner Seite geladen →
  Aufräumen als eigenes Paket, **nie am Rollout-Tag**.
- `_dpDispSkin` ist in `settings.js` doppelt definiert (Z. 3130 / Z. 3364) → die
  tote erste Fassung entfernen, ebenfalls als eigenes Paket.

---

## VI.10 · ROLLOUT-JOURNAL (FORTLAUFEND)

**Regel:** Nach **jedem** Rollout kommt hier ein Eintrag dazu — neueste zuerst,
in dieser Datei, nicht in einer neuen. Ein Eintrag hat vier Zeilen: **Was ·
Commit · Nachweis · Rest.** „Nachweis" ist die Messung, nicht die Absicht. Wo
kein Nachweis steht, ist der Punkt nicht abgenommen.

| Datum | Was | Commit | Nachweis | Rest |
|---|---|---|---|---|
| 30.08. | **`v1176`–`v1179`** — das neue Preismodell an allen Anzeigestellen (19,99 / 39,99 / 79,99, Partner 99 mit Seats 24/19/15), Kontingente statt Litertank, die drei Stufen einheitlich benannt (Marktpreisindikation · Erweiterte Marktpreisindikation · Wertermittlung nach ImmoWertV, „ersetzt kein Gutachten"), Co-Pilot auf 5 Fragen für Free/Starter, dazu fünf Kleinigkeiten aus dem Testbericht | `dd226cb` `99b99db` `f137547` `27f319b` `7751bf0` | Im Browser nachgemessen: Karten 19,99/39,99/79,99 mit deutschem Komma, Kontingente 1/5/10/15, Matrix in beiden Fassungen, Co-Pilot-Pille „5 von 5 Fragen frei" im Prüfmodus `free` und „unbegrenzt" als Partner. Serverseitig gegengelesen: Vorzeichen der Preis-Einordnung, Bankexport-Sperre, Stufennamen | **Die Anzeige ist umgestellt, die Buchhaltung nicht** — `aiCreditsService.js` führt weiter Liter. Offen: Stripe-Preise (Dashboard), Migration der Tabelle `plans`, die drei Zähler, Einzelkauf am Knopf |
| 30.08. | **`v1175`** — Marcels Wahl aus der Demo: **Fassung C** als Schnellauswahl (Gold, Karamell, Kupfer, Ziegel, Moos hell, Sand — Blau, Petrol, Schiefer fallen weg). Dazu sein Nachtrag „freier Farbregler": ein Farbton-Regler mit Regenbogenbahn, offen im Panel statt im Fenster des Systems | `3f4a6cc` | Bedienweg über alle drei Bedienelemente: Kachel → Regler springt auf 18° · Regler 200° → `#3F8EB5`, Kacheln aus · Farbkasten auf eine Kachelfarbe → Kachel an, Regler 69° · Zurücksetzen → 44°. Grenzen des Reglers einzeln geprüft: fast grau + 120° → `#267326` (ohne S-Boden hätte sich nichts bewegt), fast weiß + 300° → `#C875C8` (Deckel L 0,62), fast schwarz → `#732673` (Boden 0,30) | **Punkt 4 ist damit zu.** Alles Kühle kommt über Regler oder Farbkasten — nachgewiesen. Die drei Bedienelemente gehen durch **eine** Funktion (`akzentSetzen`); ausgelassen wird nur das, an dem gerade gezogen wird, sonst springt der Regler |
| 30.08. | **`v1174`** — freier Akzentwähler im Darstellungs-Panel (Backlog Punkt 4, Marcels „beides"). Es gab hier keinen: die sechs `<input type=color>` im Panel gehören den Bereichsfarben, der einzige freie Wähler saß im Reseller-Portal und setzt die **Partner**-Marke. Dazu die Demo für die wärmeren Töne | `8e95bf5` | Bedienweg in allen vier Richtungen: Kachel → Wähler folgt · Wähler auf freie Farbe → Kachel aus, Wähler markiert · Wähler auf Kachelfarbe → Kachel an · Zurücksetzen → Gold. `localStorage` vor dem Reset-Test vollständig gesichert und danach zurückgeschrieben. Demo-Skript einmal echt gelaufen: 4 × 6 Kacheln, 22 Tabellenzeilen, kein Fehler | **Zwei Rücknahmen:** die Mindestkontrast-Regel ist seit `v1109` gebaut (mit `#F0D000` schwächster Textton **3,84**, nicht 2,57–2,98 — das sind Zahlen von vor v1109), und es gibt **keinen** Kontrastmangel in den heutigen sechs: auf Obsidian landet nicht der rohe Akzent, sondern ein aufgehellter Ton (5,48–9,58). **Die Tonwahl ist reiner Geschmack und liegt bei Marcel** |
| 30.08. | **`v1173`** — Wallet-Karte (Backlog Punkt 11): Bild, Kaufpreis und „privat" klebten aneinander. Spalte 1 des Rasters war 64 px breit und das 64-px-Bild bekam zusätzlich `margin-left:10px` — es fraß damit genau den 10-px-Spaltenabstand. Dazu Zeilenabstand 0 zwischen `align-self:end` und `align-self:start` | `0131306` | Gemessen am ausgerollten Stand ohne Testregel: Bild → Text **0 → 12 px** (Standardkarte 12), „privat" → Preis **1 → 5 px** (Standard 4); Paar bleibt mittig zum Bild (271 = 271); Adresse läuft nicht über, 24 px Luft zum Ring; Kartenmodus über den **Bedienweg** gesetzt | Marcels zweite Vorgabe („alle Werte, die wir brauchen") mitgeprüft: die Wallet-Fassung blendet gegenüber dem Standard **nichts** aus |
| 30.08. | **`v1173b`** — der Griff nach der Spaltenbreite hatte einen Preis: Nummer, Datum und Adresse standen in Spalte 2, ihre Breite hing damit an der Bildspalte. Beide Bandzeilen spannen jetzt über beide Spalten und halten ihren Einzug (74 px) selbst | `1e4bde8` | Messkabine 390 px: Adresse **244/244 vorher → 234/232 nach `v1173` (zwei Pixel Ellipse) → 322/322 jetzt**; die 12/5 px aus `v1173` bleiben; Band steht pixelgleich wie vor `v1173` | **Neuer Befund, nicht von mir verursacht:** bei 390 px liegen im Wallet-Modus die Aktionen **auf** dem Score-Ring — `elementFromPoint` auf der Ringmitte trifft `sbc-del`. Ursache ist die 44-px-Trefferfläche aus v650/v652. Steht als Punkt 10 im Backlog |
| 13.08. | **`v1161` + DB** — `business`/`enterprise` gelöscht (Marcels Freigabe): erst vier Code-Stellen geräumt, dann die Zeilen | `0a488f5` | Rebuild + Marker im Container (`VALID_PLANS` ohne business); Dump + `BEGIN/ROLLBACK`-Probelauf; danach `plans` 5 Zeilen, API 4 Pläne, **0 Fremdschlüssel-Waisen**, Abos unverändert | **Nur Staging.** Auf Prod erst nach dem `v1161`-Rollout wiederholen — sonst akzeptiert das alte Backend weiter `'business'` |
| 13.08. | **`v1160`** — Gate zugezogen (Marcels Entscheidung „das Versprechen gilt"): `market_data_fields` und `live_market_rates` bei Free auf `false` | `d0aedab` | Matrix nach der Änderung: free/starter `false`, investor/pro `true` — deckungsgleich mit der Cockpit-Matrix; Syntax auf dem Server ok | **DB führte für Free längst `false`** → `v1160` schließt das **Startfenster** vor der DB-Antwort, nicht mehr |
| 13.08. | **Plan-Prüflauf (Punkt 6)** — alle drei Wahrheiten gegeneinander gehalten, dazu der DB-Weg | (nur Backlog) | Matrizen **deckungsgleich** (31 Zeilen); `bank_pdf_premium` **toter Schlüssel**; 13 Schlüssel auf `undefined=false`; `business`/`enterprise` mit nur 10/13 Schlüsseln | **Plan-Override greift nicht** (`dp_plan_override='free'` → bleibt `partner`) — Prüflauf je Plan braucht echte Konten |
| 13.08. | **`v1159`** — im Stapelmodus löste die **Pfeilmitte Löschen aus** (12 px Überlappung); Pfeil nach unten, 20 → 22 px | `c1f71b5` | `elementFromPoint` auf der Pfeilmitte trifft jetzt `sbc-arrow` statt „Löschen"; 5 px Abstand; Aufklappen funktioniert; Kompaktmodus unberührt | 44-px-Trefferfläche bleibt offen — passt nicht in eine 63-px-Karte mit Aktionen oben |
| 13.08. | **`v1158`/`b`** — Reiter tragen im hellen Modus die Tinte des Aktionen-Menüs (Marcels Vorgabe), als gemeinsames Token `--dp-hell-ink` | `399df3f` | Alle 9 Reiter rgb(20,19,16) = Aktionen-Menü; Goldstrich bleibt; Kopfzeile unverändert; **Obsidian unberührt** | Der Selektor stand **dreimal** in der Datei — die späteste Regel entschied |
| 13.08. | **`v1157`/`b`** — der Whitelabel-Sweeper verwarf jede Nutzeränderung am **Body-Inline-Stil**: `reset()` spielt bei Akzentwechsel die Originale zurück. Regler schreibt jetzt in ein eigenes Stylesheet | `c2d7e9b` | Rot überlebt den Akzentwechsel (rgb 255,0,0 vor **und** nach); eigene Fehlannahme zum Sweeper-Nebeneffekt im Code zurückgenommen | **Struktureller Befund:** dieselbe Falle trifft jeden Regler am Body-Inline-Stil (u. a. `--dp-obj-text`, die sechs Bereichsfarben) |
| 13.08. | **`v1156`/`b`/`c`** — Grundfarbe unter aktiver Vorlage sichtbar gesperrt (Marcels Weg B); dabei zwei eigene Fehler behoben | `8cc7af0` | Bedienweg: gesperrt/frei/gesperrt, Hinweistexte korrekt getrennt, `inert` gesetzt, Fokus greift nicht | Sperrtest mit **echten** Mauskoordinaten offen — `el.click()` ist als Prüfmittel untauglich |
| 13.08. | **`v1155`** — das Darstellungs-Panel färbte sich mit der gewählten Farbe mit (Punkt 4); Tab-Text-Regler war doppelt tot (Punkt 6) | `2347684` | Panel-Überschrift bleibt Gold, Vorschaufläche geht auf Türkis; Tab-Text ging auf rgb(255,0,0) — Regler wirkt | **Halb:** nach einem Akzentwechsel überschreibt etwas den Body-Inline-Stil; Setzer nicht per `setProperty` → `cssText`/`setAttribute` patchen. Punkt 5 braucht eine Entscheidung |
| 12.08. | **Ankreuzfeld-Abnahme nachgeholt** — die Messung vom Mittag war wertlos (0 von 26 Feldern sichtbar) | (nur Backlog) | 21 Felder über alle Reiter, **alle 33 × 33**, kein Überlauf, bei 1440 **und** 390 px; Zeilen tragen (33/35 px) | eigener Messfehler gefunden und korrigiert: Achsen **getrennt** prüfen — `.main-col` klippt waagerecht, scrollt senkrecht |
| 12.08. | **Zwischenfall: Server stand auf `main`, fremder Commit auf `staging`** — beide Seiten vereint und gesichert | `ce821e3` | Zweig geprüft (`--abbrev-ref`), Divergenz gelesen (`0a55ee4`, 920 Zeilen v1083 des Parallel-Chats), konfliktfrei gemergt, zurückgepusht; alle 7 eigenen Marker + 3 fremde Dateien vorhanden, mb-Container hatte den Rebuild schon | **Prüfbefehl erweitert** (Zweig + Hash) — steht in `FALLEN.md` Punkt 1 |
| 12.08. | **`v1154`** — Differenz-Formel stand zweimal (Abbuchung ↔ Auskunft), jetzt eine Funktion. Dazu: „`BEDARF` zusammenführen" **zurückgenommen** — zwei Zwecke, zwei Listen | `99a14db` | node-Beweis über alle 12 Kombinationen; **Rebuild** gefahren, Marker im Container, `/stufenpreis` live identisch | `baustatus` ist ein Pflichtfeld ohne leere Option → kann nie fehlen; Merkposten falls sich das ändert |
| 12.08. | **`v1153`/`v1153b`** — Klappleiste fürs Handy (Marcels Wahl „C"): 55 px statt 188 px unter 900 px, ab 1024 px unverändert eine Zeile | `7fb691f` | Bedienweg geprüft: auf/zu, 48-px-Zeilen, Wahl klappt zu, „Weiter" lässt offen, Merker hält den Reload | — |
| 12.08. | **Abrechnung nachgewiesen, ohne Kerosin** — Auskunft und Abbuchung rechnen dieselbe Differenz-Formel; im Log ein echter Vorgang mit 7 L = 12 − 5. Dazu die Handy-Demo der Schrittleiste (drei Fassungen) | `(Doku + Demo)` | `/stufenpreis` und `_kerosinKosten` gegenübergestellt; `ai_credits_log` lesend geprüft; sieben 12-L-Buchungen als **Altdaten vom 02.08.** datiert (vor v1125) | Formel steht an **zwei** Stellen → zusammenführen; Demo blockiert auf Marcels Wahl |
| 12.08. | **`v1152`** — Stufe 1 war gesperrt, weil `knopfSperren()` gegen `ab` statt `genauerAb` prüfte und so die Stufe-3-Felder `plot`/`units` verlangte | `d17edac` | Beide Richtungen am ausgerollten Stand: Stufe 1 klickbar mit „· 2 L", Stufe 3 weiterhin gesperrt; kein Abruf, kein Kerosin. Reiter-Reihenfolge geprüft und stimmig | zwei Listen derselben Pflichtangaben (`BEDARF` ↔ `VERFAHREN[].pflicht`) gehören zusammengeführt |
| 12.08. | **`v1151`** — die sieben Wizard-Reiter (902 px) brachen um, weil ihr Behälter bei **jeder** Breite auf 760 px stand; eigene Grenze 960 px | `7c716ab` | Kabine mit `mb-wizard.js?v=1151`: eine Zeile bei 1024/1280/1920, kein Überlauf; 390 px bricht auf vier Zeilen (~188 px) | Handy braucht eine **zweite Darstellung** (Demo-first), nicht die gequetschte erste |
| 12.08. | **`v1150`/`v1150b`** — die PDF-Fußnote nannte die **Konstante** 1,0 statt des angewandten Faktors (0,925) und trug keine Stufe; jetzt „Sachwertfaktor 0,925 (Stufe A)" bzw. „1,15 (Stufe E · eigene Angabe)" | `e33ea05` | Am ausgelieferten `app.js?v=1150b` geprüft; Fußnote gegen Bericht 73 gerechnet, sechs Fälle inkl. Rückfall und alter Zahlform; `node --check` ok | Hinweistext beim SWF bleibt offen — **sein Anzeigeweg fehlt** (`app.js:612` zeigt ihn nur bei `!marktangepasst`) |
| 12.08. | **Fehldiagnose zurückgenommen** — „manueller Sachwertfaktor trägt keine Herkunft" war falsch: Stufe E läuft über `WertParameterService` → `nhk2010.js:897` → Karte. Lehre als `FALLEN.md` Punkt 9 | (Doku) | Kette vom Verbraucher her nachgelesen; `v1144` hatte den Weg hergestellt | zwei echte Restlücken: Stufe im **PDF**, Hinweistext beim SWF |
| 12.08. | **`v1149`** — der § 194-Hinweis stand im PDF auf jeder Seite (7×), steht jetzt nur auf Seite 1 | `6777afe` | Server: `node --check` ok, Marker `v1149-FUSS`, Buster-Kette alle **vier** Glieder auf 1149 | **Sichtnachweis am PDF fehlt** — `exportPdf()` gab bei einem Replay-Bericht keine Textausgabe, Ursache nicht getrennt (Punkt unter „Später") |
| 12.08. | **Entwurf zu Punkt 3** — Stufen abgegrenzt, Abrechnung geklärt, Herkunftsbefund | `6777afe` | `BEDARF` als eine Quelle gelesen; 22 objektartabhängige Zusatzfelder aufgeschlüsselt; Herkunftsweiche in `CrossCheckService.js` gemessen | **Stufe E an der Zahl** ist der nächste Bauschritt (Backend → Rebuild) |
| 12.08. | **`v1148`** — der Inhalt wurde bei 1025 px schmaler als bei 1024 px (764 → 645), behoben mit `minmax(0,380px) minmax(764px,1fr)` ab 1025 px | `e4f3066` | Kabine mit Buster `W68`: 1024/1025/1100/1143/1144/1400 px → Inhalt konstant 764, kein Überlauf; eingeklappt weiter `66px 1034px` | Einklapp-Zustand nur per Klasse geprüft — es gibt **kein** Bedienelement (`#dp-sb-toggle` fehlt im DOM), als Punkt unter „Später" |
| 12.08. | **Tablet-Punkt nachgemessen — kein Code geändert.** A, C und D waren gebaut; der Entwurf hatte nur bei 820 px gemessen | (nur Backlog) | Messreihe 820/900/901/1024/1025/1180 px in der Kabine; `bsheet` per `display:none!important` seit V46 stillgelegt | B (Bild), Admin (Konto), 1025-px-Sprung → wurde `v1148` |
| 12.08. | **Diese Konsolidierung** — Teil VI, zwei Korrekturen (`style.css`, Handy-Sperre), sechs Regeln | `1a76b38` | Server auf `1a76b38` per `git rev-parse` gegengeprüft; Skript brach wie dokumentiert in Z. 68 ab, Pull von Hand nachgezogen | drei Aufräum-Befunde im Backlog unter „Später" |
| 12.08. | Übergabe: Einstiegspunkt im Backlog, vier neue Fallen | `6a11a32` | — (Dokumentation) | — |
| 12.08. | Ankreuzfelder auf 33 px | `674c3b0` → `413d409` | Selektor korrigiert; `#app` existiert nicht | Abnahme mit geladenem Objekt offen |
| 12.08. | `boris`: alle 16 Länder über verifizierte Landesdienste (v1077–v1082b) | `e35e34b` · Merge `65ca0b0` | 319 Server-Zeilen ins Repo eingesammelt | — |
| 11.08. | Prod-Rollout Wertermittlung + Objekt-Reiter | `e682367` → `51958c6` | Prod-Abnahme vermerkt (`4ceb915`) | — |

*(Ältere Rollouts: siehe „CHRONIK — DIE ROLLBACK-KETTE" in Teil V.)*






### `v1162` / `v1162b` — Hell und Dunkel als zwei Profile · `381e678`

**Was.** Ein Schalter „Obsidian / Hell" in Einstellungen → **Profil & Anzeige**.
Obsidian bleibt der Auslieferungszustand.

**Der helle Modus ist die Vorlage `kanzlei`, kein Skin.** Beweis ist
`design/mockups/hell.png`: warme helle Kopfleiste (`--uv-chrome #FBFAF7`),
Serifenschrift, **goldene Reiter**. Goldene Reiter heißt: `dp-chrome-hell` ist
**aus** — dessen Tinte (`v1158`) wäre dunkel. `panel` ist „Kühl" mit Blaustich
und im Bild nirgends.

| Profil | `ui_theme` | `ui_cards` | `dp_chrome_hell` |
|---|---|---|---|
| Obsidian | `''` | `''` | `0` |
| Hell | `kanzlei` | `''` | `0` |

**Nachweis.** Echte Klicks, `settings.js?v=v1162b`: nach „Hell" Kopfleiste und
Sidebar `rgb(251,250,247)`, Reiter golden, Vorlage `kanzlei`; nach „Obsidian"
Sidebar `rgb(10,10,10)`, Vorlage leer. Bei einer dritten Vorlage ist **kein**
Profil markiert — gemessen (`aktiv: null` bei `panel`).

**Die Lehre, teuer bezahlt in `v1162`:**
> **`_dpDispSkin` löscht die Vorlage.** Es ruft `vorlageNachziehen()`, und das
> setzt `dp_user_settings.ui_theme` auf `''`, wenn die aktive Vorlage der neuen
> Helligkeit widerspricht. Wer Vorlage **und** Skin in einem Griff setzt, muss
> **erst den Skin schalten, dann die Vorlage** — sonst löscht der Skin, was
> eine Zeile vorher gesetzt wurde. Ich hatte das im eigenen Kommentar richtig
> stehen und im Code falsch gebaut.

**Rest.** „Je Profil eigene Werte" über `brand_display` fehlt — `ui_cards` wird
heute hart überschrieben. Markierung beim programmatischen Öffnen fehlt.

### `v1163` — Plan-Prüfmodus · `a4107d0`

**Was.** Der Plan-Override wirkt jetzt — aber **nur nach unten**.
`dp_plan_override` auf einen niedrigeren Plan setzen, neu laden, durchklicken;
`localStorage.removeItem('dp_plan_override')` hebt ihn auf.

**Warum er vorher nicht wirkte.** `getCurrentPlanKey()` (`config.js`) fragte
**zuerst** `Sub.getCurrentSync()`; ein echtes Abo im Cache gewann immer. Der
Override war nie tot, er stand hinten in der Reihenfolge.

**Warum nicht einfach Vorrang.** Das hätte jeden Nutzer mit einer
Konsolenzeile auf `partner` gehoben. Rangordnung
`free < starter < investor < pro < partner`, strikt kleiner.

**Die Stelle, die man übersieht:** `hasFeature` fragt zuerst
`Sub.hasCachedFeature` — die DB-Features des **echten** Abos. Ohne
Sonderbehandlung zeigt die Oberfläche den simulierten Plan und schaltet die
Funktionen des echten frei. **Das sieht aus wie ein bestandener Test.** Im
Prüfmodus wird der DB-Weg übersprungen; eine Quelle für beide Leser
(`pruefOverride`).

**Grenzen, die zum Werkzeug gehören:** simuliert wird das Frontend-Gate, nicht
die Backend-Durchsetzung; und es gilt der `config.js`-Fallback des simulierten
Plans, nicht dessen DB-Zeile.

**Nebenertrag — B3 entwarnt.** Alle 26 im Frontend abgefragten
Feature-Schlüssel gegen die 37 in Plänen definierten gehalten: **keiner fehlt.**
Ein Tippfehler, der still den teuersten Plan sperrt, existiert nicht.

> **Lehre, zwei Fehlbefunde teuer:** Feature-Schlüssel **nie** über Namenslisten
> diffen. `_gate('[data-feature="a"], [data-feature="b"]', 'b')` trennt Selektor
> und Schlüssel — ein grep über beide wirft sie zusammen und erfindet Dreher,
> die es nicht gibt. Und eine Probe auf einen erfundenen Schlüssel liefert
> immer `false`, weil unbekannt = false. **Aufrufstelle lesen, nicht Namen
> vergleichen.**

### Prüfergebnis: die sieben Pro-Tage (`TR7-trial`) — kein Umbau

**Sie sind eingebaut.** Ich hatte im Prüflauf geschrieben, ich könne das nicht
bestätigen — **das war falsch, weil ich in meinen Unterlagen gesucht habe statt
im Code.**

**Nicht am Starter, sondern ab Registrierung:** jeder neue Nutzer bekommt eine
`plan_trials`-Zeile mit `granted_plan='pro'`, `expires_at = NOW() + 7 days`.
Vergeben in `userService.js:42` (der Trichter) und `auth.js:69`,
Mehrfachvergabe per `WHERE NOT EXISTS` ausgeschlossen, Auslaufen automatisch
über `expires_at`. Ein Fehlschlag wird geloggt und bricht die Registrierung
nicht ab.

**Vier bewusste Abweichungen von rohem Pro:** bezahltes Abo schlägt die
Testphase · `export_csv`/`json_backup`/`excel_import` bleiben aus · KI-Kontingent
auf Free-Niveau · Wasserzeichen bleibt aktiv.

**Nach Tag 7 wird nichts unerreichbar.** `requireUnderLimit('objects')` hängt an
**genau einer Stelle**: `objects.js:73`, `router.post('/')`. Nur das **Anlegen**
ist begrenzt — Lesen, Listen, Ändern nicht. Objektlimits: free 1 · starter 5 ·
investor 25 · pro/partner `-1`.

> **Lehre:** „Steht nicht in meinen Unterlagen" ist kein Befund. Das ist
> `FALLEN.md` Punkt 9 zum vierten Mal — diesmal gegen ein Feature, das Marcel
> selbst genannt hatte. **Wenn er sagt, etwas sei gebaut, im Code nachsehen.**

### `v1164` — Objektnummer im Kopf, Kontrast · `bb44d8d`

**Backlog-Punkt 9, und es war der Rest eines halb erledigten Punkts.** Der Punkt
nannte 2,98 / 2,88; gemessen wurden **3,88 (kanzlei) / 3,72 (boarding)** — die
Regel hatte längst gewirkt, nur nicht weit genug. Kleiner Text (10,5 px / 700)
braucht 4,5.

**Gelöst über den Token:** `--uv-marke-dd` war nur ein Alias auf `--uv-marke-d`.
Jetzt `color-mix(in srgb, var(--uv-marke-d) 82%, #000)` — **relativ zum
Markenton**, damit ein Whitelabel-Rot Rot bleibt und nur dunkler wird. Ein festes
Gold hätte die Mandantenmarke an sechs Stellen überschrieben.

Ergebnis: kanzlei **5,38**, boarding **5,16**. Alle sechs Leser des Tokens stehen
auf hellem Grund, keiner auf dunklem — deshalb gilt es für alle.

**Drei Werkzeugfallen aus diesem Lauf stehen jetzt in `FALLEN.md` Punkt 10** —
`color(srgb …)` statt `rgb()`, Verläufe im Grund-Leser, und der eigene
halbtransparente Hintergrund des gemessenen Elements.

### `v1165` — Garagenfeld im Marktbericht · `b9e7851`

**Backlog-Punkt 10 war als „blockiert" markiert — der Widerspruch darunter war
es nicht.** Die Feldhilfe (v1142) sagte „bei einer Eigentumswohnung nur der
eigene Anteil", der Platzhalter sagte „alle Garagen zusammen". **Sichtbar ist
der Platzhalter**; die Hilfe muss man aufklappen. Der Nutzer trug also die
Gesamtfläche ein — und `lib/nhk2010.js` kennt weder `mea` noch `ist_wohnung`,
kürzt also nichts. Am Prüfobjekt Hüllhorst 64,58 m² für eine von drei
Einheiten, bis zu ~18.500 € zu viel.

> **Lehre, allgemein:** Ein Punkt, der auf eine Entscheidung wartet, kann
> trotzdem Anteile haben, die **keine** brauchen. Bevor „blockiert" stehen
> bleibt: nachsehen, ob darunter etwas liegt, das in **jedem** Ausgang der
> Entscheidung richtig ist. Zwei Texte, die sich widersprechen, sind so ein
> Fall — einer ist falsch, egal wie entschieden wird.

**Cache-Buster:** die Marktbericht-Kette hat **drei** Glieder, die zusammen
gezogen werden müssen — `frontend/index.html` → `marktbericht-view.js` (die
iframe-URL **im** Skript) → `marktbericht-app/index.html`.

### `v1166` — Hinweis am Garagenfeld · `c9779df`

Erscheint, wenn ein **Miteigentumsanteil gepflegt** ist **und** eine
Garagenfläche steht: *„Der Miteigentumsanteil wird hier nicht abgezogen —
anders als beim Bodenwert. Steht dort der eigene Anteil?"*

**Keine Schwelle, keine Rechnung.** Die Garage folgt in der Teilungserklärung
meist einem eigenen Anteil oder einem Sondernutzungsrecht, nicht dem
Wohnungs-MEA — eine automatische Kürzung wäre in **beide** Richtungen falsch.
Gefragt wird, nicht gerechnet.

**Empfehlung zur offenen Frage aus Punkt 10: Weg A** (Feld bleibt
wohnungsbezogen). Das Modell ist an allen anderen Stellen bereits
wohnungsbezogen; die Garage wäre bei B der einzige Sonderweg. Die Entscheidung
liegt weiterhin bei Marcel.

> **Zwei Einbaufallen, die hier gelten und anderswo auch:**
> `zeichnen()` baut die Blöcke neu auf — ein davor angehängtes Element ist
> still wieder weg; also **nach** dem Neuzeichnen einhängen. Und für
> `.wm-f small` gibt es in der Marktbericht-App **keine** Regel: ein blankes
> `<small>` erbt, was zufällig da ist. Eigene Darstellung mitgeben.

### `v1167` — die zwei Reste des Profil-Schalters · `c1d572b`

**Punkt 5 ist damit vollständig.**

**Je Profil eigene Werte.** `dp_profil_werte` merkt für `hell` und `obsidian`
getrennt `ui_cards`, `ui_surface`, `ui_form`. **Nur diese drei** — `ui_accent`
und `ui_obsidian` sind Markenfarben und gelten in beiden Profilen. Gesichert
wird nur, wenn wirklich ein Profil aktiv war; bei einer dritten Vorlage gehört
der Stand zu keinem der zwei.

Gemessen: Obsidian + Wallet → Hell → zurück → **Wallet ist wieder da.**

**Markierung beim Öffnen.** `markieren()` hing nur am Klick; wer das Pane
öffnete, sah zwei ungedrückte Knöpfe, obwohl einer galt. `_dpProfilMarkieren`
existierte längst und wurde nur nie beim Öffnen gerufen.

### `v1168` — Checkboxen per Sprache · `77be07f`

**Backlog-Punkt 7, Rest 1.** Beide Katalogbauer schlossen `type="checkbox"`
aus. Die Freigabe allein hätte nichts bewirkt — **vier Stellen** mussten mit,
jede hätte still versagt:

1. **Backend-Whitelist** `voiceExtractService:51` — `kind` wird gegen eine
   feste Liste geprüft; `bool` wäre **still auf `text`** gefallen.
2. **Prompt-Zeile** — sonst rät das Modell zwischen `true`, `"ja"`, `1`.
3. **Normalisierung in beiden Auswertepfaden.**
4. **`applyMerged()`** in `object-actions.js` — `setInput()` schreibt in
   `.value` und lässt ein Häkchen unberührt; es wäre als übernommen
   **gezählt** worden, ohne gesetzt zu sein.

> **Die Regel, die dabei am meisten wert ist:** Es kommt **nur JA** durch. Ein
> „nein" wird verworfen statt als `false` übernommen — sonst hakt ein
> beiläufiges „einen Stellplatz gibt es nicht" ein Feld **aktiv ab**, das der
> Nutzer nie angefasst hat. Die Import-Tabelle zeigt nur, was gesetzt wird;
> ein stilles Abhaken wäre dort unsichtbar.

**Und der Maßstab:** 203 Felder, **genau eine Checkbox** (`san_tax_active`).
Die Änderung ist vollständig, betrifft heute aber ein Feld — das Formular löst
Ja/Nein sonst über Selects. **Erst zählen, dann schätzen.**

**Backend geändert → Rebuild.** Vier Marker im laufenden Container geprüft.

### `v1169` — Spracheingabe: Tempo und Stichwort-Fenster · `a78ab83`

**Vier Modelle pro Aufnahme:** Transkription · Live-Zwischenauswertung
(`gpt-4o-mini`) · Feldauswertung (`gpt-5.5`) · Verifikation (`gpt-5.4-mini`).
Wer die Spracheingabe beschleunigen will, fängt hier an.

**Der erste Fund:** Der Transkriptions-Default stand auf
`gpt-4o-transcribe-diarize`. **Diarisierung trennt Sprecher voneinander** —
beim Diktat ins eigene Mikrofon spricht eine Person. Der Dateikopf nannte als
Default ohnehin `gpt-4o-mini-transcribe`; **Code und Doku waren auseinander,
und der Code hatte das teurere gewonnen.** Jetzt korrigiert, weiter über
`OPENAI_TRANSCRIBE_MODEL` überschreibbar.

**Stichwort-Fenster statt Wolke.** Höchstens neun Chips sichtbar; ein
erkanntes bleibt 900 ms grün stehen, geht dann weg, von hinten rückt eins nach.

> **Warum nur die Sichtbarkeit geändert wurde:** `updateChipsFromText`,
> `markChipsFinal` und die Gruppen-Navigation suchen per Selektor
> `.vi-chip[data-cid=…]`. **Wer dort Elemente aus dem DOM entfernt, bricht drei
> Stellen still.** Und der Fortschrittszähler muss weiter alle zählen, sonst
> steht dort dauerhaft „9".

**Offen:** Um wie viel die Transkription schneller wird, ist nicht gemessen —
dafür braucht es einen Sprechlauf. Die weiteren Hebel wären der
Verifikations-Pass (zweiter Aufruf) und `gpt-5.5` in der Feldauswertung; beides
Qualitätsfragen, nicht einseitig zu entscheiden.

### `v1170` — Verifikations-Pass aus · `ecd5be2`

**Marcels Entscheidung**, um Tempo zu gewinnen. Der Pass (v522) ist ein
**vollständiger zweiter KI-Aufruf**: Transkript **und** Erstergebnis gehen noch
einmal weg und werden gegengeprüft. Er kostet damit etwa so viel Wartezeit wie
die Auswertung selbst — **der größte einzelne Hebel**.

**Nicht gelöscht, nur abgeschaltet.** Den Schalter `OPENAI_VOICE_VERIFY` gab es
bereits, nur stand der Standard auf „an". Der Code bleibt vollständig und läuft
wieder, sobald die Variable auf `1` gesetzt wird.

**Nachweis, der zählt:** `printenv OPENAI_VOICE_VERIFY` **im Container** ist
leer — der neue Default greift wirklich. Stünde dort eine `1`, wäre die
Änderung wirkungslos gewesen und hätte trotzdem nach Erfolg ausgesehen.

> **Wenn die Qualität sichtbar nachlässt** — falsch zugeordnete Zahlen,
> verwechselte Felder —, ist das die **erste** Stellschraube: Variable auf `1`,
> Rebuild. Dann war der Pass sein Geld wert.

**Damit laufen noch zwei Modelle je Aufnahme** (Transkription + Auswertung)
statt vier. Der verbleibende Hebel wäre `gpt-5.5` in der Feldauswertung.

### `v1172` / `v1172b` — Eine Breite für die Marktbericht-Seite · `167c935`

**Marcels Befund am Bild `design/mockups/markztbericht.png`:** Schrittleiste
breit, alles darüber und darunter schmal.

**Die Ursache war mein eigener Eingriff aus `v1151`.** Dort bekam die
Reiterleiste eine **eigene** Grenze von 960 px, weil die sieben Marken 902 px
brauchen und bei 760 px umbrachen. Technisch richtig begründet — die Leiste ist
Navigation, keine Formularzeile. **Nur entsteht dadurch eine zweite Kante auf
derselben Seite, und genau die sieht man.** Jetzt 960 px für alles; keine
760er-Regel mehr in der Datei.

> **Lehre:** Eine Sonderbreite für ein einzelnes Element ist fast immer die
> falsche Antwort auf „zu schmal". **Wenn ein Element mehr Platz braucht als
> seine Nachbarn, ist die Frage, ob nicht alle mehr brauchen.**

**`v1172b`:** Das `sed`-Muster traf nur **eins von drei** Kettengliedern — es
suchte `v=1165`, dort stand längst `v=1166`. Der Wizard stand auf `1172`, die
iframe-URL weiter auf `1166`; der Browser hätte das iframe-Dokument aus dem
Cache geladen und die Änderung wäre nie angekommen. **Ein `sed`, das nichts
findet, meldet keinen Fehler** — nach jedem Ziehen alle Glieder nebeneinander
ausgeben lassen.


**`v1180` — Stripe: die neuen Preise angelegt, 064 und 065 ausgeführt.**
Commit `8b87e23`. Nachweis: vier Checkout-Sitzungen aus dem Container mit
dem Schlüssel der App — Starter 1999, Pro-Jahr 79900, `paket_gross` 3990,
**Partner + 12 Seats 32700**. Die letzte Zahl beweist die Volume-Staffel:
9900 + 12 × 1900, weil 12 in Stufe 2 fällt.

**Der Befund, der Zeit spart: es sind zwei Stripe-Konten, und Staging
benutzt das unauffälligere.** `acct_1TWXFdGefFev8arz` ist das Hauptkonto
(live *und* test), `acct_1TWXFqKEjyPDo0wo` die Sandbox (nur test) — und
**Staging rechnet gegen die Sandbox.** Im Container nachgemessen:
`sk_test`, und die Seat-IDs der `.env` tragen `KEjyPDo0wo`. Im Hauptkonto
liegen aus einer früheren Sitzung bereits Partner- und Seat-Testpreise,
die **nichts** erreichen. Wer nur „Test-Modus" prüft und nicht das Konto,
legt sauber an — nur am falschen Ort.

**Daraus fiel ein echter Defekt:** `plans.partner` trug auf Staging die
**Live**-IDs `price_1TtM0CGefFev8arz…`, während Staging mit `sk_test`
läuft. Partner-Checkout war dort nie möglich. Ursache ist
`061_partner_stripe_live.sql`: sie schreibt Live-IDs **bedingungslos in
jede Datenbank**, und Migrationen laufen auf Staging wie auf Prod.

> **Lehre, die über Stripe hinausgeht: eine hartverdrahtete ID in einer
> Migration ist immer in einer der beiden Umgebungen falsch.** `065` hängt
> deshalb an der **Umgebung** statt am Zeilenzustand — sie greift nur, wenn
> die `starter`-Zeile eine Sandbox-ID trägt, und tut auf Prod nichts. Die
> neun Einmalkäufe lösen es noch besser: sie tragen `lookup_key`, werden
> zur Laufzeit aufgelöst und brauchen überhaupt keine ID im Code.

**Live wurde bewusst nicht angefasst.** Preise sind Geld, Geld ist Marcels
Entscheidung. Solange es keine Live-Preise gibt, darf `064` **nicht** auf
Prod laufen — sonst wirbt die Seite mit 19,99 € und bucht 29 € ab.

**Nebenbei bestätigt: das Deploy-Skript lügt weiter** (VI.2). Es brach an
gits `Everything up-to-date` auf stderr ab, bevor der Server zog — der
`git pull` musste von Hand nach.

**`v1181` — die Live-Preise angelegt, und die ID-Falle strukturell
geschlossen.** Auf Marcels „ja leg das auch an": dieselben 19 Objekte in
`acct_1TWXFdGefFev8arz` livemode. Produkte wiederverwendet, Preise neu.
**Niemandem wurde etwas berechnet** — ein neuer Preis ändert an
bestehenden Abonnements nichts.

**Der eigentliche Ertrag der Runde kam beim Vorbereiten von Migration 066
und hat sie überflüssig gemacht.** Ich wollte 066 an der Umgebung
aufhängen, so wie 065 es tut. Dabei gemessen: **die Seeds 003/008/014
schreiben nie eine Stripe-ID** — eine frische Datenbank hat dort `NULL`.
Es gibt also gar keinen verlässlichen Zeilenzustand, an dem eine Migration
erkennen könnte, wo sie läuft. Jede Bedingung wäre geraten gewesen — genau
der Fehler, den 061 gemacht hat, nur eine Ebene subtiler.

> **Lehre: wenn die Umgebungserkennung selbst geraten ist, ist die
> Migration die falsche Stelle.** Die Antwort war, die ID ganz
> abzuschaffen: alle 19 Preise tragen jetzt in **beiden** Konten denselben
> `lookup_key` (`dp_plan_<plan>_<intervall>`, `dp_seat_*`, `dp_paket_*`,
> `dp_einzeln_*`). Der Schlüssel ist umgebungsblind — wer mit dem
> Sandbox-Schlüssel fragt, bekommt Sandbox-Preise, wer mit dem
> Live-Schlüssel fragt, Live-Preise. Keine Migration muss mehr wissen, wo
> sie steht.

**Nachweis:** aus dem Container, mit dem Schlüssel der App, **19 von 19
aufgelöst** mit korrekten Beträgen. Kleine Falle dabei:
`prices.list({lookup_keys})` nimmt **höchstens 10 Schlüssel je Abfrage**
und antwortet sonst mit 400 — in Zehnerblöcken fragen.

**Was offen bleibt und Code ist, nicht Stripe:** `subscription.js:138`
liest den Preis weiter aus `plan.stripe_price_monthly_id`. Solange das so
ist, braucht Prod seine Spalten von Hand. Der richtige Schritt ist, dort
auf den `lookup_key` umzustellen und die Spalte zum Rückfall zu machen —
dann können `061` und `065` irgendwann ganz verschwinden.

**Produktion wurde nicht angefasst.** Der Zugriff auf `157.90.117.167` ist
in dieser Sitzung gesperrt; der Ist-Zustand dort ist ungemessen. Deshalb
steht im Backlog fertiges SQL statt einer Migration, die auf geratene IDs
baut. **064 und die ID-Umstellung gehören auf Prod in denselben
Arbeitsgang** — sonst wirbt die Seite mit 19,99 € und bucht 29 € ab.



**`v1182` / `v1182b` / `v1182c` — der Durchstich im Browser, drei Fixes.**
Commits `8e57aec` ff. Gemessen auf `app.staging.dealpilot.immo` (die App
liegt **nicht** auf `staging.dealpilot.io`), angemeldet als Partner.

**Der teuerste Befund war nicht im Code, sondern in Stripe:** „Plan
wechseln" führt ins **Kundenportal**, und dessen Preisliste hängt an der
Billing-Portal-Konfiguration `bpc_…` — nicht an den Produkten und nicht an
den Preisen. Sie war gar nicht gesetzt und kam aus einer unsichtbaren
Dashboard-Voreinstellung: das Portal bot **29 / 59 / 99 €**, während die
App 19,99 / 39,99 / 79,99 zeigte. **Neue Preise anzulegen reicht also
nicht — die Portal-Konfiguration ist eine dritte Stelle**, neben
`config.js` (Anzeige) und `plans` (Abbuchung). Jetzt explizit gesetzt und
im Portal nachgemessen: 19,99 / 39,99 monatlich, 199 / 399 / 799 jährlich.

**`v1182`: jeder zahlende Kunde sah „0 € / Monat".** Die Plan-Karte las
`plan.name` / `plan.priceMonthly` / `plan.maxObjects`, die Pläne führen
aber `label` / `price_monthly_eur` / `limits.objects`. Kein Plan hatte je
einen der drei Schlüssel — der Block sprang seit v234.1 nie ein.

> **Lehre: ein Fallback kann einen toten Block jahrelang decken.** Der
> Planname fiel auf den grossgeschriebenen Schluessel zurueck und sah
> deshalb richtig aus. Oben stand „Partner", also hat niemand geprueft, ob
> darunter noch die Vorbelegung steht. **Wo eine Zeile teils aus Daten und
> teils aus Vorbelegung kommt, muss die Vorbelegung erkennbar sein** —
> „0 € / Monat" sieht aus wie ein Wert, nicht wie ein Ausfall.

**`v1182b` änderte nichts, `v1182c` war der Fix.** Der Kerosin-Kasten stand
auf „Lädt…", weil sein Markup seit v611 im Plan-Reiter gebaut wird, der
Füller aber am KI-Reiter hing. `'plan'` in die Bedingung aufzunehmen half
nicht: das Markup wird **nach** dieser Stelle eingesetzt, der Lookup griff
ins Leere. Erst `setTimeout(40)` — wie es der DealScore-Zweig seit V63.21
macht — traf den richtigen Moment.

**Zwei Messfallen, beide selbst getreten und beide teuer genug fuer die
Chronik:**
- Die Reiter sind `.st-tab[data-tab]` mit `onclick="_swSet(this)"`.
  `[data-pane]` ist die **Inhaltsflaeche**. Ich habe zweimal die Flaeche
  geklickt, nichts geschah, und habe daraufhin einen funktionierenden Fix
  fuer kaputt gehalten. **Ein fehlgeschlagener Test ist erst ein Befund,
  wenn der Bedienweg stimmt.**
- **Im verborgenen Tab feuert `requestAnimationFrame` nie** — der
  ERSTFLUG-Rabatt rollt den Monatspreis per rAF herunter, also blieb 19,99
  statt 16,79 stehen. Ich hatte das schon als Defekt gemeldet und
  zurueckgenommen. `document.visibilityState` gehoert vor jede Messung, die
  an einer Animation haengt.


**`v1183` — der Kontingent-Zaehler. Kerosin ist weg.** Commits `31f9829`
ff. Migration 066. Der groesste offene Punkt aus dem Backlog ist gebaut:
gezaehlt wird je Leistungsart (mpi / mpi_plus / wev), nicht mehr in einem
gemeinsamen Litertank. Marcels Entscheidung dazu: die acht kleinen
KI-Hilfen sind im Plan enthalten und kosten nichts — eine Waehrung, drei
Bewertungen.

> **Die Lehre dieser Runde, und sie gilt weit ueber Stripe hinaus:
> `getStatus()` liefert `total_remaining` nicht mehr — und
> `undefined < 1` ist `false`.** Alle sieben 402-Sperren in `ai.js` haetten
> danach lautlos NIE mehr gegriffen: die Leistung waere erbracht und nie
> bezahlt worden. Dieselbe Form im Demo-Deckel (`NaN > 200` ist auch
> falsch) und beim Co-Pilot-Tageslimit, das ueber das Literlimit
> abgeleitet wurde und jeden still auf `free` gesetzt haette.
> **Ein toter Vergleich schlaegt nicht fehl — er wird wahr oder falsch.**
> Wer ein Feld aus einer Antwort entfernt, muss jeden Vergleich darauf
> suchen. Deshalb sind die Sperren ausdruecklich entfernt statt
> wirkungslos gelassen, und `consume()`/`addBonus()` antworten mit einem
> harten Nein plus Log-Warnung statt mit einer stillen Null.

**Marcels Befund „total unuebersichtlich" war woertlich richtig.** Die
Kachelleiste im Nachkauf stand als vier feste Knoepfe im HTML und trug
noch „10 L / 2 €", waehrend die Karte darunter laengst aus `DATA` kam und
„15 · 10 · 3 / 39,90 €" zeigte. **Zwei Listen fuer dieselbe Sache** — das
vierte Mal in diesem Projekt (FEHLT_TEXT/BEDARF v1126d,
BEDARF/VERFAHREN v1152, Abbuchung/Ankuendigung v1154, und jetzt hier).
Die Kacheln werden aus `DATA` gebaut; sie koennen nicht mehr driften.

**Marktwert-Abrufe haben einen eigenen Bestand bekommen.** Sie kosteten
40 bzw. 20 L — bei fuenf Bewertungen im Monat waere ein einziger Abruf
das Achtfache des Kontingents gewesen. Die Zahlen stammten aus der Zeit,
als 100 L im Pro-Plan lagen. **Wenn sich die Einheit aendert, muss jeder
Preis, der in der alten Einheit steht, neu begruendet werden** — sonst
wandert eine Zahl mit, deren Grundlage weg ist.

**Derselbe Text lag dreifach im Haus:** `landing/index.html`,
`landing/leistungsumfang.html` und `landing/assets/pricing-plugin.js`.
Alle drei nachgezogen. **Nebenbefund:** die Landing nannte PriceHubble
und Sprengnetter namentlich, was CLAUDE.md ausdruecklich verbietet —
jetzt „unabhaengige Bewertungspartner".

**Nachweis:** Funktionslauf im Container (nur die gebuchte Art sinkt, die
anderen nicht; unbekannte Art abgelehnt; stillgelegtes consume() sagt
Nein; addKontingent schreibt gut) und im Browser gegengelesen — kein
„Kerosin", „Liter" oder „Pilot-Anfrage" mehr im sichtbaren Text.

**Offen und ehrlich benannt:** der Stripe-Webhook ruft `addKontingent()`
noch nicht auf — ein Kauf fuellt das Kontingent also noch nicht. Und der
Monatsuebertrag ist ungetestet, weil dafuer ein Monatswechsel noetig ist.

**`v1186` — Prod-Rollout, 31.08.2026, 21:40.** Commit `fc5e7b3`,
Migrationen 064–069. Der erste Rollout seit dem 14.08., 58 Commits.
Preise live: 19,99 / 39,99 / 79,99 / 99. Beide Datenbanken vorher
gesichert und auf Inhalt geprueft.

> **Die Preis-IDs stehen jetzt in keiner Migration mehr.**
> `db/plans-preise-sync.js` fragt Stripe beim Start mit dem Schluessel
> DIESER Umgebung nach den `lookup_key`s und traegt ein, was es findet —
> kein einziges `price_` im Quelltext. Das ist die strukturelle Antwort
> auf eine Falle, die dieses Projekt zum dritten Mal beschaeftigt hat.

> **ZWEI DIAGNOSEN VON MIR WAREN FALSCH, beide ausdruecklich
> zurueckgenommen:**
> 1. Ich meldete, Migration 065 schreibe Sandbox-IDs auf Prod und breche
>    die Zahlung. Sie hat einen Riegel (`LIKE '%KEjyPDo0wo%'`), den mein
>    `grep`-Filter nicht traf — auf Live tut sie nichts. **Der gebaute
>    Abgleich war trotzdem noetig, nur aus dem umgekehrten Grund:** weil
>    065 auf Prod nichts tut, haette niemand die neuen Preise
>    eingetragen. Ein Riegel, der eine Migration stilllegt, hinterlaesst
>    eine Luecke.
> 2. Der Uebergabezettel und ich sagten, die Live-Portal-Konfiguration
>    fuehre 29/59/99 €. Gemessen: sie fuehrt **gar keine Produktliste**,
>    weder live noch in der Sandbox. Von den „drei Preisstellen" sind es
>    zwei. Nicht angefasst.

**Und eine Korrektur an CLAUDE.md:** dort stand „Produktion · SSH
read-only". Gemessen laufen dort `git pull`, `docker compose build` und
`pg_dump`. Die Zeile vermittelte eine falsche Sicherheit — wer sie
liest, haelt einen Fehlgriff auf Prod fuer technisch unmoeglich.
**Der Schutz ist die Regel, nicht der Zugang.**

**`v1185` — vier Wochen Pro, mit einem Testpaket, das verfaellt.**
Commits `dac26aa` … `37b03f5`. Migrationen 068 und 069. Marcels
Vorschlag: neue Nutzer bekommen vier Wochen Pro, zwei Erinnerungsmails,
und die Cockpit-Matrix zeigt es.

> **Zwei Drittel standen schon, und das dritte war absichtlich
> ausgelassen.** Die Testphase gibt es seit TR7 (`plan_trials`, sieben
> Tage Pro ab Registrierung), den taeglichen Mail-Lauf seit v799. Was
> fehlte, stand als Kommentar im Code: *„KI-Kontingent bleibt auf
> Free-Niveau (Kerosin wird nicht verschenkt)."* Der Testnutzer sah Pro,
> hatte eine Marktpreisindikation im Monat und **null** Wertermittlungen
> — er konnte gerade das nicht testen, wofuer er zahlen soll. **Wer eine
> Idee fuer neu haelt, ohne nachzusehen, baut sie ein zweites Mal daneben.**

**Die Geldentscheidung hat Marcel getroffen, nicht ich:** ein einmaliges
Paket (5 · 3 · 1) fuer das ganze Fenster, das mit der Testphase
verfaellt. Das Pro-Monatskontingent waere die teure Variante gewesen,
und das ist gemessen, nicht vermutet: ungenutztes Monatskontingent
wandert beim Monatswechsel in die Bank, **und die Bank verfaellt nie**.
In vier Wochen liegt fast immer ein Monatswechsel — ein Testnutzer, der
nichts tut, haette danach als Free-Nutzer dauerhaft bis zu 15
Wertermittlungen auf Vorrat gehabt.

**Was mehrfach im Haus lag, zum fuenften und sechsten Mal:** die
Trial-Vergabe stand zweimal im Code mit eigener Tagezahl (jetzt
`userService.gewaehreTestphase()`), und der Satz „verfaellt nicht" stand
in zwei Fusstexten, von denen ich zuerst nur einen nachzog.

> **Der teuerste Fund beim Nachmessen im Browser:** die
> Boarding-Pass-Karte filtert seit v1176 **alles mit „/ Monat" aus der
> Feature-Liste**, weil die Kontingentzeile als eigenes Feld darueber
> steht. Meine neue Zeile fiel genau in diesen Filter und war auf der
> Karte unsichtbar — waehrend sie in der Matrix daneben korrekt stand.
> **Ein Filter, der nach Textmustern aussortiert, trifft auch Saetze,
> die es noch nicht gab, als er geschrieben wurde.**

**Nachweis:** Container-Lauf (28 Tage, Paket 5/3/1, Reihenfolge
Monat → Testphase → Bank, zweite Wertermittlung abgelehnt, nach Ablauf
Toepfe leer und Gekauftes unberuehrt, zweite Vergabe abgelehnt) und
Mail-Lauf mit abgefangenem Versand (2 von 3 Kandidaten, der Zahler
faellt raus, keine offenen Platzhalter, zweiter Lauf schickt nichts
nach). Im Browser gegengelesen: Matrix, Free-Karte, Landing,
Kontingent-Box.

**Offen und ehrlich benannt:** eine echte Mail ist nie rausgegangen.
Und `routes/admin.js` registriert zweimal denselben Pfad
`/users/:id/start-pro-trial` — Express nimmt die erste Registrierung,
also den alten `subscriptions`-Weg; der Admin-Trial vergibt deshalb kein
Testpaket. Nicht angefasst, weil ausserhalb des Auftrags.

**`v1184` — der Kauf kommt an.** Commits `78280ec`, `65370f3`. Migration
067. Der offene Rest aus v1183 ist geschlossen: ein Kauf fuellt das
Kontingent.

> **Der Webhook war die dritte von drei Unterbrechungen, nicht die
> einzige.** Der Uebergabezettel nannte nur ihn. Gemessen wurde die ganze
> Kette, bevor gebaut wurde, und sie riss schon im Browser:
> `settings.js:_buyCreditPack` suchte den SKU in `aiCreditPackages` —
> der Liter-Liste, die v1183 stillgelegt hatte. Die Knoepfe schicken seit
> v1176 `paket_kurz` und `mpi`. **Jeder Kaufversuch endete lokal mit
> „Credit-Pack nicht gefunden", ohne je einen Netzwerkaufruf zu machen.**
> Danach erst haette `/credits/checkout` mit `400 invalid_pack`
> geantwortet, und danach erst der Webhook in den stillgelegten
> Litertank geschrieben. **Wer nur den gemeldeten Punkt repariert, baut
> zwei Drittel einer Kette.**

**Die Preise stehen nirgends im Code.** `services/bewertungsKatalog.js`
loest die neun Posten zur Laufzeit ueber ihren `lookup_key` auf. Der
Grund ist bekannt und teuer: eine Price-ID gilt je Konto, Staging rechnet
gegen die Sandbox `acct_1TWXFqKEjyPDo0wo` — eine ID im Code oder in einer
Migration ist deshalb **immer in genau einer Umgebung falsch, und zwar
lautlos**. Ein `lookup_key` ist ein Name und heisst in beiden Konten
gleich. Die Paketinhalte (`mpi`/`mpi_plus`/`wev`) stehen als Metadaten am
Stripe-Preis, nicht in einer eigenen Tabelle.

**Die Menge kommt aus den Line Items, nicht aus unseren Metadaten.** Der
Preis ist auch die Quelle des Betrags; steht die Menge woanders, koennen
Betrag und Ware auseinanderlaufen. Die Sitzungs-Metadaten sind nur der
Rueckfall, wenn das Nachladen scheitert.

**Scheitert die Gutschrift, wird der Fehler geworfen.** Der alte
Credit-Pack-Zweig faengt ihn und loggt nur — hier waere das ein bezahlter
Kauf ohne Ware. Der Anspruch auf `credit_purchases` geht zurueck auf
`pending`, der Router antwortet 500, Stripe stellt erneut zu.

**Beim Pruefen kam ein zweiter Fehler heraus, der nicht gesucht war:**
ein frisch angelegter Pro-Nutzer stand vor jedem Kauf auf
`mpi=5 mpi_plus=5 wev=5` **in der Bank** — sein volles Monatskontingent,
zusaetzlich zum Monatskontingent. Der erste Monat waere doppelt gewesen.
`_carryOver()` ueberspringt nur, wenn `kontingent_carry_at` im laufenden
Monat liegt; bei `NULL` laeuft er durch. Migration 066 hatte die damals
bestehenden Zeilen gesetzt, der Spalte aber **keinen DEFAULT** gegeben —
und `_ensureCurrentPeriod()` legt neue Zeilen mit `INSERT (user_id)` an.
**Eine Datenmigration heilt den Bestand, nicht die Zukunft.** Migration
067 setzt den DEFAULT, der Riegel im Code bleibt zusaetzlich (Prod hat
067 noch nicht).

**Nachweis, alles im Container gegen die Sandbox gelaufen:** Katalog mit
neun Posten aus Stripe · `/credits/checkout` liefert echte Sitzungen
(`paket_gross` 3990 ct → 15/10/3, `mpi` 90 ct → 1) statt `400` · Webhook
bucht (Bank 5/5/5 → 20/15/8), Doppellauf bucht nicht noch einmal ·
Uebertrag: 2 von 5 verbraucht → 3 wandern, `used` auf 0, Deckel bei 15
haelt, 40 Gekaufte bleiben ungekuerzt · im Browser: `settings.js?v=v1184`
geladen, Tuersteher findet alle SKUs, Knopf endet auf `checkout.stripe.com`
mit 7,90 € und 5 · 2 · 0.

**Zwei Pruefnutzer stehen auf Staging** (`v1184-pruef@dealpilot.test`,
`v1184-carry@dealpilot.test`, beide mit Pro-Abo). Ihre Kaufhistorie ist
echt; die zwei unbezahlten Test-Sitzungen auf Marcels Konto wurden
entfernt, damit `/credits/purchases` nichts Falsches zeigt.

**Zum dritten Mal in zwei Tagen der verborgene Tab:** die Landing blieb
im Screenshot leer, obwohl `getBoundingClientRect()` Hoehe 626 und
Deckkraft 1 meldete. `document.visibilityState === 'hidden'` gehoert vor
jede Messung, die an einer Animation haengt — und **die Messung schlaegt
das Bild.**

---

### v1191 (01.09.2026, `8902e87`) — der Löschknopf fraß den Aufklapp-Pfeil

**Was:** In der Objektkarte war der Chevron zum Auf- und Zuklappen nicht
erreichbar. `elementFromPoint` in seiner **Mitte** lieferte in beiden
aufklappbaren Kartenmodi `sbc-btn sbc-del`. Wer aufklappen wollte, öffnete
die **Löschabfrage**.

**Gemessen** (Kabine auf `/impressum.html`, iframe 390 px, Partner-Konto,
Objekt „Am Markt 9, Kabelsketal", Pfeilspalte pixelweise abgetastet):

| | vorher | nachher |
|---|---|---|
| `.sbc-del` | 26 × **44** px + unsichtbares `::after` 44 × 44 → greift 8..52 px unter der Kartenoberkante | 26 × 26 px, kein `::after` |
| `.sbc-arrow` erreichbar (kompakt) | **1 Rasterpunkt** von 22 px | **22 von 22 px** |
| `.sbc-arrow` erreichbar (stapel) | 4 px von 22 | **22 von 22 px** |
| Pfeilmitte trifft | `sbc-btn sbc-del` | `sbc-arrow` |

**Zwei Ursachen, beide aus der 44-px-Trefferflächen-Kampagne (v650/v650c):**

1. `style.css:22663`, `@media (max-width:640px)`:
   `button, .btn, .tab, input… { min-height: 44px !important }`.
   Das **nackte `button`** trifft auch die Kartenknöpfe. Und
   **`min-height` schlägt `height`** — die 26 px aus V101 (`style.css:27189`)
   waren wirkungslos. `!important` hilft dagegen nicht: es sind zwei
   verschiedene Eigenschaften, nicht zwei Regeln um dieselbe.
2. `style.css:36060`: `.sbc-btn::after { width/height: max(100%, 44px) }`,
   **zentriert**. Bei 26 px Knopfhöhe ragt die unsichtbare Fläche je 9 px
   nach oben und unten heraus. Deshalb meldete `elementFromPoint`
   `sbc-btn` acht Pixel weiter, als der Knopf hoch ist.

> **Das war die dritte Auflage desselben Fehlers.** `v1138b` (die
> Score-Zahl lag unter dem Löschknopf) und `v1159` (der Chevron in
> „stapel") haben beide das **Opfer verschoben** — Score nach unten,
> Chevron nach unten — und den **Täter nie angefasst**. Solange der
> Löschknopf 44 px in eine 64-px-Karte drückt, wandert der Konflikt nur
> weiter. Deshalb hier die Ursache: die zwei Kartenknöpfe werden von der
> Pauschale ausgenommen.

**Warum die 44 px für genau diese zwei Knöpfe zurückgenommen werden:** Die
zugeklappte Karte ist 64–82 px hoch und trägt auf ihren obersten 60 px
**vier** Bedienziele — Duplizieren, Löschen, Aufklappen und die Karte
selbst. 44 px sind dort nicht unterzubringen. Die Pauschale hat dort keine
Bedienbarkeit erzeugt, sondern die **gefährlichste** der vier Aktionen über
die anderen gelegt.

> **Eine Variante war gebaut und wurde nach der Messung verworfen:** die
> Fläche nach **oben** wachsen zu lassen (0..34 statt 8..34) statt sie zu
> schrumpfen. Gemessen: sie legt den Löschknopf auf die obersten 8 px der
> Karte, wo bisher „Objekt öffnen" lag. **Mehr Fläche für die
> gefährlichste Aktion ist der falsche Handel** — auch wenn die Zahl
> dabei besser aussieht.

**Dazu:** `ui-varianten.css` — Chevron in „kompakt" `top: 22px → 26px`.
Die Aktionen enden bei 34, der Pfeil begann bei 32; die obersten 2 px
gingen weiterhin an den Knopf.

**Nachweis auf Staging** (`8902e87`, frisch geladen, `style.css?v=v1191`):
fünf sichtbare Karten × zwei Modi, zu und aufgeklappt — Pfeil überall
22 von 22 px erreichbar, Löschmitte → `sbc-del`, Duplizierenmitte →
`sbc-btn`. **Und der echte Klickweg:** ein Mausklick auf die Pfeilmitte
klappt die Karte auf, `delSaved` wird nicht gerufen, keine Löschabfrage,
alle sieben Karten bleiben stehen.

**Rest — zwei Entscheidungen für Marcel, bewusst nicht geraten:**

1. **Der Score-Ring liegt in „kompakt" unter dem Duplizieren-Knopf.**
   Gemessen: Ring 239..277 px, Aktionen 249..305 — die Ringmitte trifft
   `sbc-btn`. Optisch sichtbar: das Kopiersymbol klebt auf dem Ring.
   Freistellen geht (`right: 34px → 68px`), kostet aber **30 px
   Adressbreite** (`padding-right` 84 → 114), sonst läuft der Text unter
   den Ring.
2. **44 px Trefferfläche für den Pfeil** sind in „kompakt" machbar
   (46 px frei unter den Aktionen), in „stapel" nicht (30 px). Sie kosten
   in kompakt 22 px Kartenfläche, auf der heute „Objekt öffnen" liegt —
   und die Fläche wäre in den zwei Modi unterschiedlich groß.

---

### v1192 (01.09.2026, `8aa9857`) — der Score-Ring lag unter den Aktionsknöpfen

**Marcels Entscheidung auf die zwei Fragen aus `v1191`: „a ja, b nein."**
Der Ring wird freigestellt, die 44-px-Fläche für den Pfeil bleibt wie sie
ist.

| Modus | geändert | Ring vorher | Ring jetzt |
|---|---|---|---|
| **kompakt** | Ring `right: 34px → 68px`, Adresse `padding-right: 84 → 94` | Mitte trifft `sbc-btn` (Duplizieren), 14 von 38 px frei | **38 von 38 px frei** |
| **wallet** | Overlay `top: 12px → 34px` | Mitte traf `sbc-del`, ab `v1191` noch die obere Hälfte verdeckt | **40 von 40 px frei** |

**Warum in „kompakt" 34 px nicht reichten:** der Kommentar an der Regel
sagte „Ring nach links rücken, damit der Chevron rechts daneben Platz
hat" — gerechnet war also nur gegen den **Chevron**. Die
**Aktionsknöpfe** stehen aber bei `right: 6px` und sind 56 px breit, sie
belegen die rechten 62 px. Mit `right: 34` lag der Ring mittendrin.
Sichtbar war es die ganze Zeit: das Kopiersymbol klebte auf dem Ring.

**Warum die zwei Modi es verschieden lösen — beide Wege sind gemessen:**

- In **kompakt** ist die Karte **80 px** hoch. Schiebt man den Ring nach
  unten (`top: 34`), steht er zwar frei, aber die **Stufen-Pille** hängt
  am selben Overlay und rutscht auf y79–101 — sie **tritt aus der Karte
  heraus**. Also nach links.
- In **wallet** ist die Karte **255 px** hoch, unten ist Platz. Nach
  links geht es dort **nicht**: der Ring läge bei l203–243, das Datum in
  der Kopfzeile endet bei 214, und `.sbc-top-line1` hat
  `flex-wrap: wrap` — das Datum bräche um und machte die Karte höher.

> **Eine eigene Zahl war zu grob und wird zurückgenommen.** Ich hatte
> Marcel gesagt, den Ring freizustellen koste **30 px** Adressbreite. Das
> war der Wert meines ersten Versuchs (`padding-right: 114`), nicht die
> nötige Untergrenze. Nachgerechnet: der Adresstext muss vor Pixel 204
> enden, das schafft **94** — also **10 px**, nicht 30. Der Unterschied
> ist sichtbar: „Am Markt 9, Kabelsketal" steht mit 94 noch vollständig
> da, mit 114 nicht mehr. **Wer eine Kostenangabe aus dem ersten
> Versuchswert nimmt statt aus der Untergrenze, verhandelt gegen sich
> selbst.**

**Nachweis auf Staging** (`8aa9857`, frisch geladen,
`ui-varianten.css?v=v1192`), fünf sichtbare Karten je Modus:
Ringmitte → `sbc-mini-score-num` in **allen vier** Kartenmodi (Standard,
kompakt, wallet, stapel), volle Ringhöhe frei · Stufen-Pille überall
innerhalb der Karte · Pfeil weiter 22 von 22 px · Löschen und Duplizieren
treffen ihre eigenen Knöpfe.

**Damit sind Backlog-Punkt 1 (Handy-Befunde) und Punkt 10 (Wallet-Ring)
zu** — es war derselbe Täter, und aus 1–10 wurde 1–8.

---

### v1193 (01.09.2026, `cd68aa0`) — die Marktbericht-Ampel rechnete noch in Kerosin

**Gefunden beim Aufnehmen des Ist-Zustands** für den Backlog-Punkt
„Marktbericht neu gestalten". Die Meilenstein-Ampel zeigte
**„2 L / 5 L / 12 L"**, der Knopf „Marktbericht erstellen · 12 L".

**Der Server war seit `v1183` umgestellt, das Frontend nicht.**
`GET /marktbericht/stufenpreis` liefert das Feld `kosten` mit
`{anzahl, art}` je Stufe (`mpi` · `mpi_plus` · `wev`) und sagt im
Kommentar (`routes/marktbericht.js:277`) wörtlich: *„`preise`/`faellig`
bleiben als Liter-Felder stehen, bis der letzte alte Aufrufer weg ist;
sie dürfen nichts mehr steuern."* **`mb-stufen.js` war dieser letzte
Aufrufer.**

| | vorher | jetzt |
|---|---|---|
| Ampel | `2 L` · `5 L` · `12 L` | `1 × MPI` · `1 × MPI+` · `1 × WEV` |
| Knopf bei Stufe 2 | `· 5 L` | `· 1 Erweiterte Marktpreisindikation` |

**Warum in der Ampel das Kürzel und am Knopf der volle Name steht:** in
der Ampel steht der ausgeschriebene Name schon **links in derselben
Zeile** — „Marktpreisindikation … 1 Marktpreisindikation" wäre eine
Dopplung. Das Kürzel zeigt dafür auf genau den Zähler, den der Nutzer in
seiner Kontingent-Box wiederfindet (`ai-credits.js:32` füllt sie mit
`kurz`). Am Knopf steht links nichts, dort wird ausgeschrieben — Wort für
Wort wie im Bestätigungsdialog aus `v1187`.

> **Der Platz war vorher gemessen, nicht geschätzt:** die Ampelzeile ist
> 878 px breit, rechts vom Namen bleiben 754 px. Selbst
> „1 Wertermittlung nach ImmoWertV" (257 px) hätte gepasst — die
> Kurzform ist also **keine Platzentscheidung, sondern eine
> inhaltliche.**

**Dazu ist ein Preisversprechen verschwunden, das der Server nicht
einlöst:** *„eine höhere Stufe kostet nur die Differenz."* Genau diesen
Satz hat `v1187` aus dem Bestätigungsdialog entfernt, weil
`_faelligeStufe()` seit `v1183` entweder **0** zurückgibt oder die
**volle** Stufe. In der Ampel stand er weiter.

**Und eine tote Preistabelle ist raus:** `VOLLPREIS = {1:2, 2:5, 3:12}`,
die Kerosin-Literpreise. Nach dem Umbau las sie niemand mehr —
gegengeprüft mit `grep -rn VOLLPREIS frontend/ backend/`, ein einziger
Treffer, ihre eigene Zeile. Eine tote Preistabelle ist keine harmlose
Leiche: **der nächste Leser hält sie für die Wahrheit.**

> **Warum `v1187` diese Stelle nicht gefunden hat, und das ist die
> eigentliche Lehre:** `v1187` hat vier Kerosin-Stellen gesucht und
> behoben — gesucht wurde nach dem **Wort** „Kerosin". Hier stand nur
> `p + ' L'`, zusammengesetzt aus einer Variablen und einem Buchstaben,
> und die Klasse hieß `mbst-kero`. **Eine Währung versteckt sich in ihrer
> Einheit, nicht in ihrem Namen.** Wer Reste sucht, greppt nach der
> Einheit **und sieht sich die Oberfläche an** — der Fund kam hier nicht
> aus einem grep, sondern daraus, dass die Seite einmal geöffnet wurde.

**Nachweis auf Staging** (frisch geladen, `mb-stufen.js?v=1193`): kein
einziges `\d+ L` mehr im gesamten Seitentext, kein Differenz-Versprechen.
Am Testobjekt Hüllhorst durchgespielt — mit Adresse, Art, Fläche und
Baujahr springt die Ampel auf Stufe 1 und der Knopf auf
„· 1 Marktpreisindikation", mit Zustand und Qualität auf Stufe 2 und
„· 1 Erweiterte Marktpreisindikation".

**Vier Cache-Buster mussten mit**, weil die App im iframe läuft:
`mb-stufen.js` in `marktbericht-app/index.html`, die iframe-URL in
`js/marktbericht-view.js:91` und deren eigener Buster in `index.html:3223`.

---

### v1194 / v1194b (01.09.2026, `b026689` + `954a669`) — die abgeschaffte Währung stand noch auf dem Geldweg

**Der Auftrag war, den Wizard-Ablauf nach Preisumbau-Resten abzusuchen —
gefunden wurde etwas anderes und Schwereres.** `v1187` hatte nach dem
**Wort** „Kerosin" gesucht, `v1193` nach `\d+ L` im Seitentext. Diese
Runde hat nach der **Einheit** gesucht und die Oberfläche aufgemacht.

#### Der schwerwiegende Befund: `credits-modal.js` stand auf dem Kaufweg

Die Datei ist der Kerosin-Laden aus `v489` — vier Pakete, 10/28/90/160
Liter zu 2/5/15/25 €. `v1176` und `v1183` haben die Währung abgeschafft,
**die Datei blieb geladen.** Und am Ende stand:

```js
window._buyCreditPack = function(packId) { CreditsModal.open(); … }
```

`js/settings.js:2109` setzt **dieselbe** globale Funktion. In `index.html`
steht `settings.js` auf Zeile **3151**, `credits-modal.js` auf **3252** —
beide ohne `defer`, also in Dokumentreihenfolge. **Bei gleichem Namen
gewinnt der spätere Setzer.** Im laufenden Staging ausgelesen:

```
window._buyCreditPack  →  credits-modal.js (KEROSIN)
```

Damit führte jedes **„Dazubuchen"** und **„Kaufen"** in Einstellungen →
Plan (`settings.js:1955` / `:1971`) nicht zu Stripe, sondern in den
Kerosin-Laden. **Die Reparatur aus `v1184` („der Kauf kommt an") lief auf
diesem Weg nie** — sie war da, sie kam nur nie dran. Der Nachkauf über das
Preis-Modal war nicht betroffen: `_buyCreditPackDirect` trägt einen
anderen Namen und wird von niemandem überschrieben.

**Und der Laden hätte Geld genommen.** `creditPacks.js` kennt
`kerosin_10…160` weiterhin, `creditPackWebhook.js` bucht sie auf
`bonus_credits` — die Spalte, von der `aiCreditsService` seit `v1183`
sagt: stillgelegt. `getStatus` und `consumeArt` lesen sie nicht mehr,
`ai.js:120` nennt sie wörtlich „stillgelegt". **Geld rein, nichts raus.**

**Die Datei ist ausgeräumt, nicht gelöscht.** `checkPurchaseSuccess()` ist
der **einzige** Leser von `?credit_purchase=` — dem `success_url`-Parameter
aus `routes/credits.js:213`. Wer die Datei löscht, nimmt jedem echten Kauf
die Rückmeldung. Deren Text lautete bis hierher **„✓ Kerosin erfolgreich
getankt!"** — der letzte Satz, den ein zahlender Kunde zu sehen bekam.

#### Fünf weitere Stellen — alle mit falschem **Preis**, nicht nur falschem Namen

| Datei | stand da | Wahrheit im Backend |
|---|---|---|
| `js/object-actions.js` | „**20 L** Sprengnetter" (live gemessen) | `consumeAvm()` zieht **1 Marktwert-Abruf**, `avm.js:236` sagt `required: 1`. Die 40/20 sind der alte Liter-Tarif aus `COST` |
| `js/ui.js` | Knopf „Trend-Text erzeugen **1 L**" | `logExtract`, `cost 0, source 'free'` — kostet **nichts**. Die Zeile darüber sagte schon „im Plan enthalten" |
| `js/bmf-modal.js` | Knopf nach jedem Lauf auf „KI-Vorschlag **(1 Credit)**" zurückgesetzt | `ai.js` hat seit `v1183` **keinen 402 mehr** — 7× der Kommentar „Frueher stand hier ein 402 gegen den Litertank". Die Vorlage in `bmf-modal-html.html:269` sagt nur „KI-Vorschlag" |
| `js/tooltip-content.js` | „kostet **2 Credits** / je **1 Credit**" | alle drei genannten Analysen sind kostenlos. Der Schlüssel `tab7.ki_credits` wird von keinem Feld aufgerufen — die Angabe stand trotzdem im Haus |
| `marktbericht-app/wertermittlung.js` | `var KEROSIN = {1:2, 2:5, 3:12}` | eine **zweite Preisquelle** neben dem Server |

**Zu `voice`:** die Sprachauswertung ist aus dem Kosten-Hinweis ganz
verschwunden. `ai.js:514` bucht sie über `logExtract` — „im Plan
enthalten", `cost 0`. **Für etwas Kostenloses ein Preisschild zu zeigen
ist derselbe Fehler wie eine abgeschaffte Währung, nur andersherum.**

**Zu `wertermittlung.js`:** die Liste war nicht sichtbar —
`mb-stufen.zeichnen()` ersetzt den Inhalt von `#wm-ziel` durch die
Meilenstein-Ampel („Die alte Optionsliste weicht"). **Genau deshalb hat
`v1193` dort kein `L` gefunden: die Stelle war nicht sichtbar, nur
geladen.** Fällt `mb-stufen.js` aber aus, bleibt stehen, was dort steht.
**Ein falscher Preis als Rückfallebene ist schlechter als gar keiner.**
Der Preis steht jetzt nur noch an einer Stelle: in der Ampel.

**Nebenbefund im selben Block:** `js/ui.js` zeigte
**„Gerade nicht verf00fcgbar"** — dem `ü` fehlte der Backslash, der
Nutzer las die Ziffern.

#### `v1194b` — der Cache-Buster, der die Hälfte verschluckt hätte

Beim Nachmessen gefunden, **bevor** der Marktbericht geöffnet wurde:
`js/marktbericht-view.js:91` verdrahtet die iframe-URL der Marktbericht-App
mit einer eigenen Versionsnummer, und die stand noch auf `1193`. `v1194`
hat `marktbericht-app/index.html` geändert (`wertermittlung.js` 1177 →
1194) — mit unverändertem `?v=1193` hätte der Browser das alte
iframe-HTML aus dem Cache genommen und darin weiter
`wertermittlung.js?v=1177` geladen. **Die Änderung wäre im Repo richtig
gewesen und im Browser nicht angekommen.**

> **Zwei Buster in einer Kette:** der äußere (`index.html` → `view.js`)
> und der innere (`view.js` → iframe). **Beide müssen mit.**
>
> **Und das stand schon hier.** Der `v1193`-Eintrag eine Bildschirmseite
> weiter oben sagt wörtlich: *„Vier Cache-Buster mussten mit, weil die App
> im iframe läuft … die iframe-URL in `js/marktbericht-view.js:91` und
> deren eigener Buster in `index.html:3223`."* **Ich bin trotzdem
> hineingelaufen** und habe es erst beim Nachmessen bemerkt, nicht beim
> Bauen. Ein Eintrag im Journal wirkt nur, wenn er vor dem Ausliefern
> gelesen wird — bei einer Änderung an `marktbericht-app/` gehört diese
> Kette auf die Prüfstrecke, nicht in die Erinnerung.

#### Nachgemessen auf Staging (`954a669`, frisch geladen)

| | Befund |
|---|---|
| `window._buyCreditPack` | `settings.js` (Stripe) ✔ — Aufruf mit unbekanntem Schlüssel erreicht den Türsteher „Credit-Pack nicht gefunden", **ohne Netzaufruf** |
| `CreditsModal.open` | führt aufs Preis-Modal, baut keinen Laden mehr ✔ |
| Marktradar, eine Quelle | „Beim **Abrufen** wird **1 Marktwert-Abruf** (Sprengnetter) aus deinem Kontingent verbraucht." |
| Marktradar, zwei Quellen | „… **werden** 1 Marktwert-Abruf (Sprengnetter) **+** 1 Marktwert-Abruf (PriceHubble) …" |
| Preis-Modal | kein `L`, kein „Kerosin", kein „Credits" — Knöpfe „Bewertungen kaufen" |
| Marktbericht | `wertermittlung.js?v=1194`, Ampel `1 × MPI` / `1 × MPI+`, sieben Reiter, kein `L` |
| Plan-Ansicht | MPI 48 · MPI+ 10 · WEV 10 · Marktwert 0 — sauber |
| `node --check` | alle sieben geänderten JS-Dateien |

#### Die Methode, die das gefunden hat

`v1187` suchte nach „Kerosin", `v1193` nach `\d+ L` im Seitentext.
**Beide hätten den Marktradar-Hinweis verfehlt:** dort steht
`' L'`, ein geschütztes Leerzeichen — mein erstes `grep` nach `' L'`
fand ihn auch nicht. Und **keine** Textsuche hätte gefunden, dass zwei
Dateien dieselbe globale Funktion belegen. Das sieht man erst, wenn man
`window._buyCreditPack` **im laufenden System ausliest.**

> **Die Regel dahinter, allgemeiner als Kerosin:** wo zwei Dateien
> denselben globalen Namen setzen, entscheidet die Ladereihenfolge in
> `index.html`, und der Verlierer ist **lautlos** weg. Eine Reparatur kann
> vollständig, getestet und richtig sein — und trotzdem nie laufen.

**Was NICHT geprüft ist:** ob ein echter Kauf über den reparierten Weg
ankommt. Der Weg ist ausgelesen, der Türsteher greift, aber es ist keine
Stripe-Sitzung gestartet worden. **Und Produktion trägt denselben Defekt**
— `credits-modal.js` ist dort unverändert.

### v1195 (01.09.2026, `69dee08`) — der letzte Liter-Rest stand ganz oben

**Beim Abruf-Test aufgefallen, nicht beim Suchen.** Im Kopf des
Marktberichts stand statisch **„◷ 5 L bei Marktwert · keine Daten =
kostenlos"** (`js/marktbericht-view.js:129`, ein `v654`-Rest). Drei Fehler
auf einmal: die Währung ist seit `v1183` weg · die Zahl stimmte nicht
(abgerechnet wird **1 Bewertung** der zur Stufe gehörenden Art) · und es
war die **dritte** Preisangabe auf demselben Schirm.

| Stelle | Quelle | wandert mit? |
|---|---|---|
| Band oben | fest verdrahtet | **nein** |
| Ampel („1 × MPI+") | Server, `kosten` | ja |
| Knopf („1 Erweiterte Marktpreisindikation") | Server, `kosten` | ja |

**Das statische Schild ist weg.** Dort steht jetzt nur noch, **wann**
abgerechnet wird; das **wieviel** steht an genau einer Stelle.

> ### Warum `v1194` diese Stelle verfehlt hat — zwei Gründe
>
> **1 · Der Text war zerlegt.** Im Quelltext steht ` 5 L bei ` mitten in
> einem Satz. Weder `grep` nach „Kerosin" (`v1187`) noch nach `' L'`
> (mein Kehraus) noch nach `\d+ L` im Seitentext (`v1193`) trifft das.
> **Die Einheit versteckt sich nicht nur im Namen, sondern auch im Satz.**
>
> **2 · Ich habe das Bild gemessen und den Rahmen übersehen.** Geprüft
> wurde `marktbericht-app/index.html` — der **iframe**. Das Band gehört
> aber der **Haupt-App** und liegt außerhalb. Beide Male stand
> „kein Treffer" im Befund, und beide Male stimmte er für die Fläche, die
> ich angesehen hatte. **Wer eine Fläche prüft, muss den Rahmen
> mitprüfen** — bei jeder iframe-Ansicht gehören beide `body.innerText`
> in dieselbe Messung.

---

### Der Marktbericht-Abruf ist gefahren — 01.09.2026, auf Marcels Freigabe

**Die offene Frage seit der Übergabe war: zieht die Abbuchung die richtige
Art?** Sie ist beantwortet. Testobjekt `2026-004 · Bäckerstr. 7
Musterhausen` (Dummy), erreichte Stufe 2.

| | |
|---|---|
| Ankündigung Ampel | `1 × MPI+` |
| Ankündigung Knopf | „Marktbericht erstellen · **1 Erweiterte Marktpreisindikation**" |
| Kontingent vorher | MPI 48 · MPI+ **10** · WEV 10 |
| Kontingent nachher | MPI 48 · MPI+ **9** · WEV 10 |
| Log | `marktbericht:full` · `cost 1` · `source 'monthly'` · `{"art":"mpi_plus","wert_stufe":2,"quelle":"monat","external_ref":"d65ed5cb…"}` |
| Spalten | `mpi_plus_used` 0 → **1**, Bank **unverändert** bei 5 |
| Ergebnis | Marktwert 176.000 €, Spanne 143.000–262.000 €, Score 46/100 |

**Vier Dinge sind damit bewiesen, nicht mehr vermutet:**

1. **Die angekündigte Art ist die gebuchte Art.** `mpi_plus`, passend zur
   erreichten Stufe 2 — nicht `mpi`, nicht `wev`.
2. **Genau eine**, und die anderen beiden Arten bleiben unberührt.
3. **Zuerst der Monat, dann die Bank.** `source: 'monthly'`,
   `mpi_plus_used` 0 → 1, die Bank blieb bei 5. Das ist die richtige
   Reihenfolge: was ohnehin verfällt, geht zuerst.
4. **Ein zweiter Lauf auf dasselbe Objekt kostet nichts.** Danach gemessen:
   Stufe 1 und 2 melden `{anzahl: 0}`, der Knopf sagt „ohne Aufpreis".
   Stufe 3 meldet `{anzahl: 1, art: 'wev'}` — **die volle Wertermittlung,
   keine Differenz.** Genau das, was `v1187`/`v1193` angekündigt haben.

> **Der Bestätigungsdialog ist ein natives `window.confirm()`**
> (`marktbericht-app/app.js:330`). Das blockiert den gesamten Renderer —
> auch die Browser-Erweiterung: Screenshot, JS-Auswertung und sogar
> Tastendrücke liefen alle in den Timeout. **Beim Prüfen im Browser darf
> dieser Knopf nicht blind gedrückt werden.** Der Dialog trug übrigens
> zusätzlich eine Plausibilitätswarnung („Grundstücksfläche bei einer
> Wohnung — die fließt nur bei Häusern in die Bewertung ein"), die
> Warnstrecke arbeitet also.

**Weiterhin offen: was bei LEEREM Kontingent passiert.** Alle drei Arten
haben Vorrat (48 / 9 / 10), der `402`-Pfad
(`routes/marktbericht.js:457`) ist nicht ausgelöst worden. Er ließe sich
auf Staging mit einem gezielten `UPDATE ai_credits_user` prüfen — das ist
ein Datenbank-Eingriff und braucht eine eigene Freigabe.

### v1196 / v1196b (01.09.2026, `59a87d2` + `005a084`) — zwei Wizard-Reiter waren leer und sahen aus wie ein Defekt

**Der Wizard-Durchgang, den die Übergabe verlangt hat.** Alle sieben Reiter
am Objekt „Hölderlinstr. 1" (erreichte Stufe 1) durchgeklickt und
vermessen:

| Reiter | Höhe | Felder |
|---|---|---|
| 1 Übersicht | 384 px | 2 |
| 2 Objekt | 511 px | 9 |
| 3 Zustand | 465 px | 7 |
| 4 Ausstattung | 435 px | 8 |
| 5 Gebäude & Außen | 466 px | 9 |
| **6 Wertermittlung** | **18 px** | **0** |
| **7 Zusatzwerte** | **18 px** | **0** |

Sichtbar war in 6 und 7 nur die eigene Unterzeile des Reiters — bei 6
wörtlich nur „Bodenwert, NHK, Feinjustierung". Kein Satz, warum dort
nichts steht, kein Weg weiter.

**Kaputt war nichts.** Die Felder gehören zu Stufe 3 und erscheinen,
sobald man diese Tiefe ansteuert — die Ampel sagt es sogar: *„Eine Zeile
tiefer klicken blendet die nächsten Angaben ein."* Nachgemessen: ein Klick
auf die Ampel-Zeile 3 füllt Reiter 6 mit 15 und Reiter 7 mit 6 Feldern.

> **Aber wer den Reiter direkt anklickt, sieht davon nichts.** Er sieht
> eine leere Seite. **Eine richtige Mechanik, die aussieht wie ein Fehler,
> ist ein Fehler.**

**Jetzt steht in einem leeren Reiter**, zu welcher Stufe seine Angaben
gehören, was dafür noch fehlt, und ein Knopf blendet sie ein:

> **Diese Angaben gehören zu: Wertermittlung nach ImmoWertV.**
> Sie erscheinen hier, sobald du diese Tiefe ansteuerst. Dafür fehlt noch:
> Grundstücksfläche, Wohneinheiten, Miteigentumsanteil.
> `[ Angaben einblenden ]`

**Der Text kommt aus der Ampel, nicht aus einer zweiten Liste.**
Stufenname und Fehlendes werden aus der gerenderten Ampel-Zeile gelesen
(`.mbst-ms[data-mbst-ziel]`), der Knopf steuert genau diese Zeile an. Hier
kann also nichts auseinanderlaufen — die Falle, die im Marktbericht schon
sechsmal zugeschlagen hat. Ist die Ampel noch nicht da, erscheint **gar
kein** Hinweis: lieber nichts sagen als etwas Erfundenes.

#### `v1196b` — mein eigener Knopf klickte ein Element, das es nicht mehr gab

**Beim Nachmessen von `v1196` gefunden, bevor es als fertig gemeldet
wurde.** Der Knopf hielt die Ampel-Zeile fest, die beim **Bauen** des
Hinweises gegriffen wurde, und rief später `zeile.click()`. Wirkung: null.
Fehler: keiner. Meldung: keine.

**Ursache:** `mb-stufen.zeichnen()` setzt bei **jedem** `melden()` das
`innerHTML` von `#wm-ziel` neu. Die Zeile ist danach ein anderes Element,
die alte Referenz hängt losgelöst im Speicher — und **ein losgelöster
Knoten hat keinen Weg mehr zum `document`**, an dem der
Meilenstein-Handler als delegierter Listener hängt (`mb-stufen.js:358`).
Der Klick verpufft.

**Beweis statt Vermutung, beides in einem Lauf gemessen:**

| Messung | Ergebnis |
|---|---|
| Klick auf die **frisch gesuchte** Zeile | 0 → **12 Felder**, Hinweis räumt sich selbst ab |
| `querySelector('.mbst-ms[data-mbst-ziel="3"]') === alteReferenz` | **„NEUES Element"** |

Jetzt wird nur die **Stufenzahl** festgehalten und das Element im Moment
des Klicks gesucht. Abgenommen über den echten Bedienweg: 0 → 12 Felder in
Reiter 6, 6 Felder in Reiter 7, beide Hinweise weg, Höhe 18 → 1095 px.

> **Dieselbe Fehlerklasse wie der Gelddefekt aus `v1194`, nur
> andersherum:** dort gewann der spätere Setzer einer globalen Funktion,
> hier verliert eine festgehaltene Referenz gegen ein neu gezeichnetes
> DOM. **Beide Male sieht der Quelltext richtig aus, und beide Male
> passiert im Browser nichts.** Gegen beides hilft nur dasselbe: den
> fertigen Zustand im laufenden System auslesen, nicht den Quelltext
> lesen.

**Cache-Buster: diesmal alle drei der Kette gleich mit** — `mb-wizard.js`
im iframe-HTML, die iframe-URL in `marktbericht-view.js:91` und deren
eigener Buster in `index.html:3228`. Die Lektion aus `v1194b`, angewandt
statt wiederholt.

---

### Der 402-Pfad bei leerem Kontingent — halb bewiesen, ehrlich getrennt

**Der Datenbank-Eingriff, der den Fall vollständig beweisen würde, wurde
von der Umgebung blockiert.** Deshalb steht hier getrennt, was gemessen
ist und was nur gelesen:

**Gelesen (Server):** `routes/marktbericht.js` prüft an **zwei** Stellen
(Z. 320 und Z. 454) `k.rest < 1` und antwortet mit `402` und
`{ error: _KEIN_KONTINGENT[art], needs_credits: true, art, required: 1 }`.
Die Meldungen sind ausgeschrieben — *„Keine erweiterte
Marktpreisindikation mehr frei."* — statt wie früher *„Nicht genug Kerosin
im Tank"*.

**Gemessen (Frontend):** `_zeigeKaufAngebot()` aus `v1187` wurde mit genau
der Nutzlast aufgerufen, die der Server bei 402 schickt. Ergebnis auf dem
Schirm:

> ⚠ Keine erweiterte Marktpreisindikation mehr frei. · Dein
> Monatskontingent für diese Bewertungsart ist aufgebraucht. Du kannst
> genau diese eine nachkaufen — sie verfällt nicht. ·
> **[ Eine erweiterte Marktpreisindikation kaufen · 1,90 € ]** ·
> Günstiger im Paket: im Cockpit unter „Plan".

**Der Preis kommt live aus `/credits/bewertungen`**, also aus Stripe —
1,90 € = 190 Cent, und der Katalog führt neun SKUs (`mpi`, `mpi_plus`,
`wev`, `avm_a`, `avm_b`, vier Pakete). **Keine zweite Preisliste im
Quelltext.**

**Was fehlt:** dass der Server den `402` unter echten Bedingungen auch
wirklich schickt. Dafür müsste eine Art auf 0 gesetzt werden.

### Werkzeug: `deploy-staging.ps1` v3/v3b (01.09.2026, `d0ab1f4`) — drei Defekte, einer davon nie bemerkt

**Kein Rollout-Paket, sondern das Werkzeug selbst.** Es steht hier, weil
seine Fehlfunktion jeden Rollout dieser Sitzung Handarbeit gekostet hat.

**Der Fund, der in keinem Backlog stand: PowerShell-Variablen sind nicht
groß-/kleinschreibungsempfindlich.** `$BRANCH` und `$branch` sind
dieselbe Variable. Gemessen auf `main`:
`branch='main'  BRANCH='main'  -ne ergibt: False`.

> **Die Zweig-Sperre hat nie funktioniert** — wer versehentlich auf `main`
> stand, hätte `main` nach `origin/staging` gepusht, und das Skript hätte
> dazu `[ok] lokaler Zweig: main` gemeldet.

Dieselbe Falle zweimal mehr: `$REMOTE`/`$remote` (das ganze Bash-Skript
landete als Pfad in einem `cd`) und `$FERN`/`$fern`. **Aus `v2` geerbt und
in `v3` wiederholt** — gefunden erst beim Prüfen der Abbruch-Pfade.
Gegenprobe jetzt: alle 24 Variablennamen nach `ToLower()` gruppiert, keine
Gruppe mit mehr als einer Schreibweise.

**Die beiden bekannten Defekte, beide belegt:**

| | Ursache | Wirkung | Lösung |
|---|---|---|---|
| BOM vor `set -e` | die PowerShell-Pipe an `ssh "bash -s"` setzt `EF BB BF` davor (mit `od -c` gemessen) | der Fehlerabbruch auf dem Server war **nie aktiv** | keine Pipe mehr: `WriteAllText` mit `UTF8Encoding($false)` + `scp` |
| Tod an gits stderr | `$ErrorActionPreference = "Stop"` + `NativeCommandError` in WinPS 5.1 | Push durch, Skript Exit 1, **Server-Pull fiel aus** | `"Continue"` + `$LASTEXITCODE` nach jedem nativen Aufruf |

Weder `$OutputEncoding` noch `[Console]::OutputEncoding` auf
`UTF8Encoding($false)` half gegen das BOM — beides gemessen. Deshalb der
Umweg über Datei und `scp`.

**Schritt 7 ist neu und der eigentliche Gewinn:** das Skript liest den
HEAD des Servers und vergleicht ihn mit dem lokalen. Weicht er ab, ist es
ein Abbruch. **`Fertig.` ist damit ein Beweis, kein Versprechen** — bis
hierher musste der Stand jedes Mal von Hand gegengelesen werden.

**Die Datei liegt jetzt im Repo.** Sie stand in `.gitignore` als einziges
Werkzeug unter `tools/`; genau deshalb konnte eine kaputte Fassung so
lange überleben — kein Diff, keine Historie, keine Gegenlesung.

> **Zwei Lehren, die über dieses Skript hinausgehen:**
>
> **1 · „Kann ich nicht reproduzieren" ist kein „gibt es nicht".** Den
> stderr-Abbruch löst der Werkzeug-Host nicht aus, Marcels interaktive
> Konsole schon. Die Reparatur baut deshalb nicht mehr auf das
> Fehlerverhalten, sondern auf den Rückgabewert — sie hält in beiden.
>
> **2 · Ein Skript, das nur im Erfolgsfall stimmt, ist nicht geprüft.**
> Beide eigenen Fehler in `v3` fielen erst auf, als die **Abbruch**-Pfade
> durchgespielt wurden. Der Erfolgslauf sah vorher schon tadellos aus.

### v1197 (01.09.2026, `c9efc07`) — ein fehlender Kaufpreis machte das Objekt schlecht statt unbewertet

**Beim ersten Blick auf den Ergebnis-Teil gefunden** — der war laut Backlog
„überhaupt noch nicht angesehen worden".

Die Kennzahlenzeile sagt bei fehlendem Kaufpreis ehrlich **„– %"** für die
Bruttorendite. Die Score-Komponente daneben zeigte **„Bruttorendite
0 / 100"** und riss über ihr Gewicht von 20 % den ganzen Deal-Score mit.
Daneben stand **keine Erklärung**, weil der Untertitel bei fehlendem Wert
korrekt leer bleibt. **Der Nutzer sah eine harte Null ohne Grund.**

#### Die Ursache stand an zwei Stellen

```
ScoringService.js:39    const gy = grossYieldPct ?? 0;
ReportOrchestrator.js   grossYieldPct: valuation.yield?.gross_yield_pct ?? 0
```

Zwei Gürtel um dieselbe falsche Hose. Die Formel ist `clamp01((gy-2)/6)`,
**ihr neutraler Punkt liegt bei 5 %, nicht bei 0.** Aus „unbekannt" wurde
damit der schlechtestmögliche Wert.

**Die Nachbarn in derselben Funktion machen es richtig:**

| Komponente | fehlt → | |
|---|---|---|
| Preisabschlag | `?? 0` → `0,5 + 0/30` = 0,5 | neutral ✓ (die 0 ist hier **zufällig** der neutrale Punkt) |
| **Bruttorendite** | `?? 0` → `(0−2)/6` → clamp 0 | **schlechtestmöglich ✗** |
| Makrolage | `?? 50` | neutral ✓ |
| Mikrolage | `?? 50` | neutral ✓ |
| Risiko | `?? 0.6` | dokumentierter Vorgabewert ✓ |

**Die `?? 0` war von den Nachbarn abgeschrieben, wo sie harmlos ist.** Das
ist die Falle aus `CLAUDE.md`: *„`Number(null)` ist 0 und besteht
`Number.isFinite` — erst auf Abwesenheit prüfen, dann rechnen."* Und der
Kopf der Datei sagt die Absicht seit jeher: *„sonst neutral 50 + Note
geschätzt"*. `macroScore()` macht das. `dealScore()` machte es nicht.

#### Was jetzt passiert

Jeder Teilwert geht durch `teil(name, wert, formel, ersatz)`. Fehlt die
Zahl, wird der neutrale Ersatz genommen **und der Name in `geschaetzt`
vermerkt**. Die Oberfläche schreibt dann **„keine Daten — neutral
angesetzt"** an den Balken. **Eine Zahl ohne Herkunft gibt es hier nicht
mehr.**

#### Zweiter Fund am selben Ort: ein Untertitel, der log

`mietentwicklung: 'mangels Miet-Zeitreihe konservativ angesetzt'` war
**fest verdrahtet** — der Satz erschien immer. Im geöffneten Bericht stand
er neben **100/100**, was nur **mit** echter Zeitreihe zustande kommt.
Alle Nachbarn in derselben Liste sind bedingt; dieser war es nicht. Jetzt
nennt er die echte Zeitreihe oder schweigt.

#### Echter Funktionslauf, nicht nur `node --check`

```
ohne Kaufpreis (null)          50/100  Durchschnittlich       rendite= 50
Rendite 2 % (unteres Ende)     40/100  Unterdurchschnittlich  rendite=  0
Rendite 5 % (neutraler Punkt)  50/100  Durchschnittlich       rendite= 50
Rendite 8 % (oberes Ende)      60/100  Attraktiv              rendite=100

unbekannt == neutraler Punkt ....... true
unbekannt != schlechtester Wert .... true
alles unbekannt -> 6 von 6 geschaetzt
alles bekannt   -> geschaetzt leer
Rendite 0 %     -> Teilwert 0
```

> **Der letzte Punkt ist der wichtigste: „null Rendite" und „Rendite
> unbekannt" sind jetzt zwei verschiedene Dinge.** Eine echte Null wird
> weiterhin schlecht bewertet.

#### Am echten Bericht gegengeprüft — dasselbe Objekt, dieselben Daten

| | alt (id 72) | neu (id 78) |
|---|---|---|
| Bruttorendite-Teilwert | **0** / 100 | **50** / 100 |
| Deal-Score | **45** | **56** |
| `geschaetzt` | Feld fehlt | `["preisabschlag","bruttorendite"]` |

Und auf dem Schirm: *„Bruttorendite 50 / 100 · keine Daten — neutral
angesetzt"*, *„Preisabschlag 50 / 100 · keine Daten — neutral angesetzt"*,
Mietentwicklung ohne den erfundenen Satz.

**Nebenbeweis:** der zweite Bericht auf dasselbe, bereits bezahlte Objekt
hat **nichts** gekostet — Kontingent vor und nach dem Lauf 48 / 9 / 10.
Damit ist die „ohne Aufpreis"-Zusage ein zweites Mal belegt.

#### Offen und bewusst nicht entschieden

Statt neutral zu ersetzen könnte man den fehlenden Teilwert **weglassen und
die übrigen Gewichte hochnormieren**. Fachlich ebenso vertretbar, fällt
anders aus. **Diese Wahl gehört Marcel** — im Code steht die Konvention,
die die Datei ohnehin schon dokumentiert.

**Alte Berichte behalten ihre gespeicherten Zahlen.** Die Rechnung wirkt
nur auf neu erzeugte; die Oberflächen-Korrektur (kein erfundener Satz)
wirkt auch rückwirkend, weil sie beim Anzeigen greift.

**Backend-Änderung** — `mb-backend` gerebuildet, Container läuft die neue
Fassung, keine Fehler im Log.

### v1198 / v1198b / v1198c (02.09.2026, `78039c1` · `78a48d3` · `9894d90`) — der Ertragswert verzinste das volle Grundstück einer Eigentumswohnung

**Beim Durchgehen des Ergebnis-Teils gefunden.** Es ist der Fehler, den
`v1026` abgestellt hat — auf einem zweiten Weg wieder hereingekommen.

#### Was gemessen wurde

Bericht 78, ETW 100 m², Miteigentumsanteil fehlte, Grundstück 950 m² zu
90 €/m²:

```
= Reinertrag                                3.767 €
− Bodenwertverzinsung (85.500 € × 2,2 %)   −1.881 €   ← halber Reinertrag
= Gebäudereinertrag                         1.886 €
= Gebäudeertragswert                       25.216 €
+ Bodenwert                                85.500 €   ← volles Grundstück
= vorläufiger Ertragswert                 110.716 €
```

**Derselbe Bericht führte daneben** `cross_check.bodenwert.wert = null`,
`vollstaendig = false`, mit dem Hinweis, der Bodenwert bleibe „hier außen
vor". **Zwei Rechnungen derselben Größe in einem Bericht — und der
Ertragswert nahm die ungeschützte.**

#### Die Ursache ist eine Zeile

`CrossCheckService.js:447`:

```js
const bwErgebnis = (p.bodenwert && p.bodenwert.vollstaendig)
  ? p.bodenwert
  : { vollstaendig: bodenwert != null, wert: bodenwert, … };
```

**`vollstaendig: false` ist bei einer ETW ohne MEA eine ENTSCHEIDUNG des
`v1026`-Schutzes, kein Fehlen.** Der Rückfall las sie als „liegt nicht
vor" und setzte `plot * brw` ein — genau den Wert, den der Schutz
verworfen hatte — **und meldete ihn als `vollstaendig: true`.**

> **Ein stiller Rückfall sieht aus wie ein bestandener Lauf.** Der Schutz
> war da, er wurde ausgeführt, er hat richtig entschieden — und eine Ebene
> weiter wurde seine Entscheidung als Datenlücke missverstanden und
> überschrieben.

Dazu ein zweiter Weg derselben Zahl: `CrossCheckService.js:75` rechnet
`plot * brw` **ohne jeden Schutz**, obwohl `istWohnung` sechs Zeilen
darüber schon bereitsteht und nicht benutzt wird.

#### Was jetzt gilt

Liegt `p.bodenwert` vor, gilt es — **auch und gerade dann, wenn es
„nichts" sagt.** Der Rückfall greift nur noch, wenn gar kein geprüftes
Ergebnis existiert. `ErtragswertService` fängt das sauber ab (`hatBw`
wird false) und rechnet das **vereinfachte Ertragswertverfahren ohne
Bodenwerttrennung** samt Warnung — der Weg, den `FIX-OHNEBW` dort
ausdrücklich vorsieht.

**Abgrenzung, geprüft:** `vollstaendig: false` entsteht nur bei fehlender
Fläche/BRW — dort ist auch der Rückfall `null`, also keine Änderung — oder
beim ETW-Schutz. **Die Änderung trifft genau diesen einen Fall.**

#### Gegengeprüft am echten Bericht — dasselbe Objekt, eine Zeile Unterschied

| | vorher (id 78) | nachher (id 79) |
|---|---|---|
| Verfahren | allgemeines Ertragswertverfahren | **vereinfachtes (ohne Bodenwerttrennung)** |
| `bodenwert_eur` | 85.500 € | **null** |
| `bodenwert_fehlt` | false | **true** |
| Bodenwertverzinsung | −1.881 € auf 85.500 € | **entfällt** |
| „+ Bodenwert" | +85.500 € | **entfällt** |
| Ertragswert | 110.716 € | **50.365 €** |

Im Server-Log: `wertparameter: LZS 2,2 % (Stufe A), kein Bodenwert` ·
`quercheck: Vergleich 195000 / Sachwert – / Ertrag 50500`.

> **Die absoluten Zahlen dieses Testobjekts sind nicht aussagekräftig** —
> seine Kaltmiete steht auf 1 €/m², was die Plausibilitätsprüfung auch
> anmahnt. Was zählt, ist der Mechanismus.

#### `v1198b` — ein Strich ohne Grund sieht aus wie ein Anzeigefehler

Nach `v1198` stand korrekt „–", aber darunter lief der Rechenweg weiter:
*„Grundstücksfläche × Bodenrichtwert · 950 m² × 90 €/m² · 85.500 € ·
= Bodenwert –"*. Die verbotene Zahl stand als Zwischenschritt trotzdem da,
und kein Wort erklärte den Strich. **`ErtragswertService` legt den fertigen
Satz längst in `hinweise` ab — er wurde nur nie gezeigt.** Jetzt steht er
unter der Zahl, wenn `vollstaendig === false`. Dieselbe Regel wie `v1197`:
**keine Zahl — und kein Strich — ohne Herkunft.**

#### `v1198c` — und dabei fiel auf, dass der Satz in ae/oe/ue stand

*„wird der Bodenwert **ueber** den Miteigentumsanteil ermittelt. Ohne ihn
**waere** der volle **Grundstueckswert** anzusetzen … bleibt er hier
**aussen** vor … **ergaenzen** … **Teilungserklaerung**"*

`CLAUDE.md`: *„ae/oe/ue gehört in Kommentare, NIE in Nutztext."*

> **Es fiel nie auf, weil ihn niemand zu sehen bekam** — die Oberfläche
> zeigte ihn erst ab `v1198b` an. **Ein Text, den man erst sieht, wenn man
> ihn anzeigt, wird auch erst dann gelesen.** Der Rest der Datei benutzt
> durchgehend echte Umlaute (55 Zeilen); gegengeprüft über alle
> `hinweise`/`warnungen`/`notes` im Marktbericht-Backend: **keine weitere
> Stelle.**

#### Positiv aufgefallen und nicht angetastet

Die Sachwert-Karte macht es längst vorbildlich: *„**–** · Sachwert nicht
ausgewiesen: für eine Eigentumswohnung wird die Bruttogrundfläche der
Wohnung benötigt. Die Näherung aus der Wohnfläche ist im Mehrfamilienhaus
zu ungenau (Treppenhaus, Keller, Gemeinschaftsflächen). Beim
Wohnungseigentum führt ohnehin das Vergleichswertverfahren."* **Genau das
Muster, das `v1198b` für den Bodenwert nachzieht.**

#### Was Marcel als Sachverständiger gegenlesen muss

`v1198` **ändert den Ertragswert jeder Eigentumswohnung ohne erfassten
Miteigentumsanteil.** Die Regel selbst ist nicht neu — sie steht in
`CLAUDE.md` und ausführlich begründet in `v1026`. **Neu ist nur, dass der
Ertragswert sie jetzt auch befolgt.** Der saubere Ausweg für eine echte
Bewertung bleibt: **den Miteigentumsanteil eintragen** — wozu die
Oberfläche seit `v1196` aktiv einlädt.

### v1199 (02.09.2026, `4964e64`) — die fehlenden Angaben stehen jetzt am Feld

**Marcels Wahl aus der Demo:** „b ist super" —
`design/Vorschläge/marktbericht-fehlende-felder.html`, Variante B.

**Das Problem, gemessen am 01.09.:** die Pflichtangaben der Stufen 1–3
standen nur in der Ampel, **ganz oben, außerhalb des Reiters.** Wer in
Reiter 2 „Objekt" arbeitete, sah neun gleich aussehende Felder und konnte
nicht erkennen, welche vier die Stufe überhaupt erst freischalten. Von
`address`/`ptype`/`area`/`year` (Stufe 1), `cond`/`quality` (Stufe 2) und
`plot`/`units` (Stufe 3) trug **keines** einen Marker — nur `baustatus`,
weil es zufällig über `wertermittlung.js` gerendert wird.

**Warum Gold und nicht Rot:** ein leeres Feld ist kein Fehler, und Rot ist
in dieser Leiste schon für „fehlt" vergeben (`.mbst-fehlt`). **Zweimal
dieselbe Farbe für zwei Dringlichkeiten macht beide stumpf.** Die tote
CSS-Regel `.wm-f.fehlt` (rote Kontur, Klasse wird nirgends gesetzt) bleibt
deshalb bewusst liegen — sie war der Entwurf, der nicht gewonnen hat.

#### Zwei Entscheidungen, im Code festgehalten

**1 · Nur die nächste Stufe.** Wer auf Stufe 1 steht, bekommt die Felder
für Stufe 2 markiert — nicht zusätzlich die für Stufe 3. Sonst steht die
Maske voll und die Markierung sagt wieder nichts.

**2 · Keine zweite Liste.** Feld-IDs und Klarnamen kommen aus `BEDARF` /
`bedarf3()`, der Stufenname aus `NAMEN` — dieselben Quellen, aus denen
Ampel und Knopf ihre Wörter nehmen. **Im Marktbericht sind schon sechs
Fehler daraus entstanden, dass dieselbe Sache zweimal im Haus stand.**

#### Gemessen statt geraten

| | Befund |
|---|---|
| Behälter je Reiter | Wertermittlung baut `.wm-f`; Reiter 2–5 ein nacktes `<div>` mit Label und Feld; **`#address` hängt direkt im Reiter, ohne Hülle** → eigener Solo-Fall |
| Feldrahmen | kommt aus `input,select`, Spezifität **(0,0,1)** → `.mbst-fehltfeld input` ist **(0,1,1)** und gewinnt **ohne `!important`** |
| Nachgemessen im Browser | Streifen `rgb(201,168,76)`, Feldrahmen `rgb(201,168,76)`, Zeile `rgb(184,147,47)` in JetBrains Mono |

#### Der ganze Ablauf, am Objekt „Hölderlinstr. 1" durchgespielt

| Schritt | Ergebnis |
|---|---|
| Objekt geladen, erreichte Stufe **1** | markiert: `cond`, `quality` in Reiter 3 — *„fehlt für Erweiterte Marktpreisindikation"* |
| `cond` ausgefüllt | dessen Marke räumt sich ab, `quality` bleibt |
| `quality` ausgefüllt → Stufe **2** | Marken **wandern** auf `plot`, `units` in Reiter 5 — *„fehlt für Wertermittlung nach ImmoWertV"* |
| `mea` (Stufe 3, noch nicht im DOM) | **nicht** markiert — dort greift der Hinweis aus `v1196` |

> **`v1196` und `v1199` greifen ineinander:** Felder, die es gibt, werden
> am Feld markiert; Felder, die es noch nicht gibt, erklärt ihr leerer
> Reiter. Zusammen bleibt keine Lücke, in der der Nutzer raten muss.

### v1200 / v1200b (02.09.2026, `3d727e4` · `1fb1dae`) — der Miteigentumsanteil war da und wurde nicht mitgeschickt

**Aus Marcels Frage entstanden:** *„sollten wir das nicht als Pflichtfeld
setzen oder vorher drauf hinweisen?"* — Die Messung sagt: **ein Pflichtfeld
hätte diesen Fall gar nicht verhindert.**

#### Was gemessen wurde

Objekt Hüllhorst, erreichte Stufe 2:

| | |
|---|---|
| Feld `mea` im DOM | **nein** — der Wertermittlungs-Block wird erst aufgeklappt gebaut |
| `window._mbVorrat('mea')` | **„50"** |
| `payload().mea_pct` | **null** |
| Was die Ampel dazu schrieb | *„liegt im Objekt vor: Miteigentumsanteil — hier klicken zum Übernehmen"* |

**Die App kannte den Wert, sagte auf dem Schirm, dass sie ihn kennt — und
schickte ihn nicht mit.** Ein Pflichtfeld hätte etwas erzwungen, das
längst da war; und ausfüllen ließe es sich bei Stufe 2 ohnehin nicht, weil
das Feld dort nicht existiert.

#### Die Unterscheidung, auf die es ankommt

```
Feld da, aber leer  ->  der Nutzer wollte es so. Leer bleibt leer.
Feld gar nicht da   ->  niemand wollte etwas. Der Vorrat gilt.
```

Neu ist `pWert(id)` in `wertermittlung.js`, benutzt **ausschließlich** in
`payload()`. **`wert()` selbst bleibt unverändert** — `erreicht()` muss
weiter am ausgefüllten Formular hängen, sonst spränge die Stufe von allein
hoch (`v1139`: „nie ohne Zutun"). Dieselbe Trennung macht `ausObjekt()`
in `mb-stufen.js` seit ebendiesem `v1139`.

**Kein Preis-Einfluss, geprüft und nachgemessen:** `wert_stufe` blieb 2,
der Knopf sagte weiter *„ohne Aufpreis"*, das Kontingent blieb 48/9/10.

#### Das Ergebnis ist deutlicher als erwartet

Derselbe Bericht, dasselbe Objekt, nur die Werte kommen jetzt an:

| | vorher (id 79) | jetzt (id 81) |
|---|---|---|
| `mea_pct` / `bgf` | null / null | **50** / **195** |
| Bodenwert | — nicht angesetzt | **40.338 €**, vollständig |
| Bodenwertverzinsung | entfiel | **40.338 € × 2,56 %** — der Anteil, nicht das Grundstück |
| Verfahren | vereinfachtes | **allgemeines Ertragswertverfahren** |
| Ertragswert | 50.365 € | **192.328 €** |
| Sachwert | – | **242.274 €** |
| Spread der drei Verfahren | **286 %** | **1,6 %** |

> **Die 40.338 € sind kein Zufallstreffer.** Genau diese Zahl steht im
> `v1140-MEARENT`-Kommentar als der geprüfte Sollwert dieses Testobjekts
> (*„+ Bodenwert 40.338 EUR"*), und die 2,56 % Zinsanpassung stehen in
> `CLAUDE.md` als Kennzahl von Hüllhorst. **Die Reparatur reproduziert die
> bekannten richtigen Werte.**

**Nebenbefund:** nicht nur `mea` und `bgf` gingen verloren, sondern auch
`spMiete` und `sonstEinnahmen` — der Rohertrag stieg von 5.160 € auf
10.284 €, weil die Stellplatzmiete (2 × 45 €) und die sonstigen Erträge
(240 €) endlich mitkommen. **Es war nie ein Miteigentumsanteil-Problem,
sondern ein Payload-Problem.**

#### Zweite Maßnahme: die Ertragswert-Karte sagt jetzt, wie gerechnet wurde

Sie zeigte nur „Reinertrag … p. a.". Dass **ohne Bodenwert** gerechnet
wurde, stand im Datensatz (`verfahren`), aber nirgends auf dem Schirm.
Jetzt steht *„· ohne Bodenwert gerechnet"* daneben, wenn
`bodenwert_fehlt` gesetzt ist — und **schweigt**, wenn es nichts zu
erklären gibt. Im positiven Lauf nachgemessen: kein Hinweis, kein
Grund-Kasten, wie es sein soll.

#### Kein Pflichtfeld — und warum nicht

Es widerspräche dem eigenen Stufenkonzept. Der Bericht sagt selbst
*„Ertragswert indikativ mit Pauschalwerten — genau ab Stufe 3"*, und für
Stufe 3 **ist** der Miteigentumsanteil bereits Pflicht (`bedarf3()`). Ein
Pflichtfeld bei Stufe 1/2 würde die Marktpreisindikation für **jede**
Eigentumswohnung blockieren, obwohl sie keinen Bodenwert braucht.

#### `v1200b` — und dann stand `pWert` im falschen Gültigkeitsbereich

```
ReferenceError: pWert is not defined
  at Object.payload (wertermittlung.js:850)
```

Die neue Funktion war nach dem `return '';` von `wert()` eingefügt worden,
aber **vor dessen schließender Klammer**. Damit lag sie im
Gültigkeitsbereich von `wert()` und war für `payload()` unsichtbar.

> **Das ist syntaktisch einwandfrei** — eine Funktionsdeklaration nach
> einem `return` ist erlaubt, nur unerreichbar. **`node --check` meldete
> „OK".** Genau davor warnt `CLAUDE.md`: *„node --check prüft nur Syntax.
> Verträge prüft nur ein echter Lauf."* Gefunden hat es der erste Aufruf
> von `payload()` im Browser.
>
> **Zum zweiten Mal in dieser Sitzung dieselbe Lehre** — nach `v1196b`,
> wo eine festgehaltene DOM-Referenz ebenso lautlos ins Leere lief.

Gegengeprüft nach der Verschiebung: Klammerbilanz der Datei **0**,
Klammerbilanz des verschobenen Blocks **0**, `wert()` wieder vier Zeilen
lang wie zuvor.

### v1201 (02.09.2026, `a47f3d2`) — der Miteigentumsanteil ist Pflicht

**Marcels Entscheidung, wörtlich:** *„der Miteigentumsanteil muss
ausgefüllt werden als Pflichtwert, sonst kann man es nicht ausführen."*

**Ich hatte davon abgeraten und die Gründe genannt; er hat es bestätigt.**
Damit ist es entschieden und gebaut. Drei Teile, die zusammengehören:

**1 · Das Feld steht jetzt ganz vorn.** `mea` wandert von `FELDER.stufe3`
nach `FELDER.stufe1`. Es wurde bis hierher erst gebaut, wenn jemand die
Wertermittlung ansteuerte (`if (s >= 3)`) — **bei Stufe 1 und 2 war es
nicht einmal sichtbar.** Eine Pflicht, die man nicht erfüllen kann, ist
keine Pflicht, sondern eine Sackgasse. `wenn: istWohnung()` bleibt: bei
Häusern gibt es das Feld weiterhin nicht.

**2 · Die Ampel verlangt ihn ab Stufe 1.** Neu ist `bedarf1()`, gebaut wie
`bedarf3()`. Fest in `BEDARF[1]` wäre falsch — bei einem Haus gibt es
keinen, und eine Ampel, die Unmögliches fordert, ist schlimmer als keine
(`v1126d`). `mea` ist dafür aus `bedarf3()` **raus**.

> Dabei fiel auf, dass `(n === 3) ? bedarf3() : BEDARF[n]` **dreimal
> wortgleich** im Haus stand — in `fehlend()`, `offenGeteilt()` und
> `feldMarken()`. Mit `bedarf1()` wären daraus drei Stellen geworden, die
> man einzeln hätte nachziehen müssen. Jetzt gibt es `bedarfFuer(n)`.

**3 · Die harte Sperre.** `generate()` hatte **gar keine**
Vollständigkeitsprüfung — der Knopf lief einfach los. Jetzt bricht er bei
einer ETW ohne Miteigentumsanteil ab, springt ins Feld und erklärt warum.
**Kein `alert()`** — ein natives Fenster blockiert den ganzen Renderer;
die Meldung geht in `errBox`, dieselbe Fläche wie das `v1187`-Kaufangebot.
Geprüft wird gegen `payload()`, **nicht** gegen das DOM: seit `v1200`
kommt der Wert auch aus dem Objekt, wenn das Feld nicht gezeichnet ist.

#### Nachgemessen

| Prüfung | Ergebnis |
|---|---|
| `mea` geleert → Stufe | **0** |
| Knopf | „Marktbericht erstellen" **ohne Preis** |
| Feld markiert (`v1199`) | ja |
| Klick auf den Knopf | **kein Bestätigungsdialog** — die Sperre greift davor |
| Meldung | „⚠ Miteigentumsanteil fehlt …" in `errBox` |
| Natives Fenster | keins, die Seite bleibt bedienbar |

#### ⚠ Die Nebenwirkung, die Geld kostet — und die Marcel wissen muss

**Bei einer vollständig gepflegten ETW springt die Stufe jetzt von allein
auf 3**, und der Knopf fordert die teuerste Tiefe:

| Objekt | vorher | jetzt |
|---|---|---|
| 2026-1004 · 2026-1005 · 2026-004 | 1 Erweiterte Marktpreisindikation | **1 Wertermittlung nach ImmoWertV** |

Im Einzelkauf sind das **1,90 € gegen 3,90 €**; aus dem Kontingent ein
WEV statt eines MPI+.

**Es ist kein neu eingebauter Fehler, sondern eine Folge der
Entscheidung.** Gegengeprüft am ZFH „Löhner Str. 278": dort steht
`erreicht: 3` **ebenfalls**, und dort gab es nie ein `mea`-Feld. **Bei
Häusern war der Selbstsprung also längst so.** Bei Eigentumswohnungen war
er nur zufällig gedeckelt — weil das Pflichtfeld unsichtbar war und
`fehlend(3)` deshalb nie leer wurde.

> **Die Regel „die Stufe ergibt sich aus den Angaben" (Marcels eigene aus
> `v1193`) tut also genau, was sie soll.** Wer das nicht will, muss die
> Tiefe wieder an einen ausdrücklichen Klick binden — dafür gibt es
> `_angestrebt` bereits. Das wäre aber eine Änderung **für alle
> Objektarten**, nicht nur für ETW, und gehört ausdrücklich entschieden.


### v1202 (02.09.2026, `4d649ff`) — die Stufe wird wieder gewählt, und der Preis folgt der Wahl

**Marcels Entscheidung:** *„dann lass uns doch wieder die drei Stufen zum
Auswählen machen und dann für die jeweilige Stufe die Pflichtfelder
anzeigen."*

**Das kehrt `v1193` um** („kein Vorab-Klick, die Stufe ergibt sich aus den
Angaben") — und zwar aus einem gemessenen Grund: seit `v1201` der
Miteigentumsanteil sichtbar wurde, war bei einer vollständig gepflegten
Eigentumswohnung Stufe 3 sofort erreicht, und der Knopf forderte
**ungefragt** eine Wertermittlung (3,90 €) statt einer erweiterten
Marktpreisindikation (1,90 €).

#### Was sich umdreht

```
vorher   Preis und Tiefe = erreicht()    -> die Daten bestimmen die Kosten
jetzt    Preis und Tiefe = gewaehlt()    -> der Nutzer bestimmt die Kosten
```

**`erreicht()` bleibt unverändert** und behält seine Aufgabe: es sagt, ob
die gewählte Tiefe **vollständig** ist. Es entscheidet nur nicht mehr, was
sie kostet.

#### Im Einzelnen

- **`gewaehlt()`** liest die Wahl aus `dp_mb_stufe` (über
  `Wertermittlung.stufe`) und steht ohne Zutun auf **1** — der günstigsten.
  **Teurer wird es nur durch einen Klick.**
- **Die Ampel ist wieder eine Auswahl.** Die gewählte Zeile trägt Rand und
  gefüllten Punkt. Bewusst **nicht grün**: Grün heißt hier „erreicht", und
  gewählt ist etwas anderes als fertig.
- **`melden()`** nimmt nur noch die Wahl. Das `Math.max(1, erreicht(),
  _angestrebt)` war der Selbstsprung.
- **`feldMarken()`** markiert für die gewählte Tiefe, und zwar über **alle**
  Stufen bis dahin — Stufe 3 braucht auch die Angaben von 1 und 2. Bis
  `v1201` markierte es nur die „nächste" Stufe und hätte bei gewählter
  Stufe 3 die Lücken in Stufe 1 stumm gelassen.
- **Die Sperre in `generate()` ist verallgemeinert.** Sie kannte nur den
  Miteigentumsanteil (`v1201`) und gilt jetzt für jede Pflichtangabe der
  gewählten Tiefe. **Welche das sind, weiß `mb-stufen.js` allein** und gibt
  sie über `offenFuer()` heraus — in `app.js` steht bewusst keine eigene
  Liste.

#### Nachgemessen am unbezahlten Objekt 2026-999

| geklickt | Knopf |
|---|---|
| 1 | „· **1 Marktpreisindikation**" |
| 2 | „· **1 Erweiterte Marktpreisindikation**" |
| 3 | „· **1 Wertermittlung nach ImmoWertV**" |
| zurück auf 1 | „· **1 Marktpreisindikation**" |

**Der Preis folgt der Wahl in beide Richtungen.** Vorgabewert nach frischem
Laden: Stufe 1.

**Und die Sperre:** bei gewählter Stufe 3 mit geleerten Feldern steht in
der Ampel *„Erweiterte Marktpreisindikation ist gewählt. Dafür fehlt noch:
Qualität."*, die Felder tragen ihre goldene Marke mit dem Stufennamen, und
`generate()` bricht ab mit

> ⚠ Angaben fehlen für Wertermittlung nach ImmoWertV · Es fehlt noch:
> Qualität, Wohneinheiten. · Die fehlenden Felder sind im Formular gold
> markiert. **Du kannst auch eine geringere Tiefe wählen** — dann werden
> weniger Angaben gebraucht.

**Kein Kostendialog davor**, kein natives Fenster.

> **Nebenbefund:** der Knopf ist bei fehlenden Angaben ohnehin schon
> `disabled` — die App prüft das selbst. Die neue Sperre ist damit das
> **Netz für den Fall, den die App nicht sehen kann**: ein Feld, das gar
> nicht im DOM ist. Genau der Miteigentumsanteil-Fall aus `v1200`/`v1201`.
> Beide Wege wurden getrennt geprüft: Klick auf den gesperrten Knopf tut
> nichts, `generate()` direkt gerufen zeigt die Meldung.

# ES GIBT DREI STÄNDE — NICHT EINEN

**Stand 14.08.2026.** DealPilot wird in **zwei parallelen Chats** entwickelt, und
jeder führt seine eigene Projektanweisung. **Diese Datei ist der Haupt-App-Strang.**

| Stand | Strang | Nummern | Inhalt |
|---|---|---|---|
| `claude/projektanweisung-marktbericht-20260812-abend.md` (2.605 Z.) | Marktbericht | v1077–v1083b | Register, Wertermittlung, amtliche Daten, Ernte |
| `claude/projektanweisung-nachtrag-20260814.md` | Marktbericht | v1084–v1096a | Fortschreibung dazu |
| **diese Datei** | **Haupt-App** | **v1148–v1172** | Darstellung, Profile, Plan-Gate, Spracheingabe |

**Marcels Nachtrag nennt diesen Strang beim Namen:** *„der Parallel-Chat
v1158–v1171 (Hell/Dunkel, Spracheingabe, Plan-Gate, Beleg-Import)."* Beide
Stände waren mit `74ae2e3` auf Prod.

> **Ein „Widerspruch" zwischen den Dateien ist meist nur der andere Strang.**
> Sechs bekannte Scheinwidersprüche stehen am Ende des Nachtrags tabelliert —
> darunter „zwei `style.css`" (für die Haupt-App falsch: `index.html:38` lädt
> `css/style.css`, `frontend/style.css` ist eine Leiche) und „Handy-Sperre
> aktiv" (mit `v1118` aufgehoben). **Vor dem Melden prüfen, welcher Strang die
> Aussage besitzt.**

## ⚠ DIESE DATEI WURDE EINMAL ÜBERSCHRIEBEN — 14.08.2026

**Marcels Marktbericht-Fassung lag als `PROJEKTANWEISUNG.md` im
Wurzelverzeichnis und hat diese Datei ersetzt.** Beide trugen denselben Namen in
verschiedenen Ordnern; eine Kopie ins Wurzelverzeichnis genügte.

**Der Schaden lief mehrere Stunden unbemerkt**, weil `cat >>` klaglos an die
falsche Datei anhängt — die Anhänge landeten auf der Marktbericht-Fassung.
Aufgefallen erst, als zwei Dateien exakt dieselbe Byte-Zahl hatten (160.475).

**Wiederhergestellt aus `56a77fe`** (3.490 Zeilen), die Anhänge danach neu
geschrieben. **Nichts ist verloren, weil jeder Rollout committet wurde** — der
einzige Grund, warum das gutging.

**Konsequenz:** die Marktbericht-Fassung heißt jetzt
`claude/projektanweisung-marktbericht-20260812-abend.md`. **Nie wieder zwei
Projektanweisungen mit gleichem Dateinamen.** Und: nach einem `cat >>` auf eine
lange Datei die Zeilenzahl gegenprüfen, nicht nur den Rückgabewert.
