# DEALPILOT — PROJEKTANWEISUNG (GESAMTSTAND)
**Stand 12.08.2026 · nach v1147b · KONSOLIDIERT ÜBER DEN GESAMTVERLAUF**

Diese Fassung ersetzt **alle** vorherigen: V1.1.239.10 (19.05.), 03.07., 11.07.,
12./14.07., 18./19.07., 21./22./23.07., 02.08. (v1040, v1061), 03.08. (v1073,
v1076), 12.08. (v1082b/v1145) und die Ablage
`design/mockups/PROJEKTANWEISUNG-GESAMT-20260812.md`. Bitte alle alten
Fassungen aus dem Projekt löschen — nebeneinander erzeugen sie Widersprüche.

**Diese Datei ist ab jetzt der eine Ort.** Sie liegt im Repo unter
`PROJEKTANWEISUNG.md` und wird **nach jedem Rollout fortgeschrieben** (Teil VI,
Rollout-Journal) — nicht als neue Datei mit neuem Datum, sondern als dieselbe
Datei mit neuem Eintrag. Für die Claude-App gilt: hier herauskopieren, nicht
danebenschreiben.

**Was hier anders ist als bei den letzten Konsolidierungen:** Die Fassungen ab
02.08. hatten alles gestrichen, was „erledigt" war, und sind dadurch zu reinen
Wertermittlungs-Papieren geworden. Die Haupt-App, Mobile, Landing, Reseller und
Admin waren praktisch verschwunden — samt der Lehren, die dort teuer bezahlt
wurden. **Diese Fassung führt den Gesamtverlauf.** Erledigte Aufgaben sind raus;
erledigte **Erkenntnisse** sind drin, denn eine Lehre ist nie erledigt.

**Und was gegenüber der 12.08.-Fassung dazukam:** die Fassung vom 12.08. kannte
nur den Marktbericht-Strang (v1082b/v1145). Zwischen dem 04. und 12.08. sind im
Repo aber **254 Commits von v1079 bis v1147b** entstanden — Darstellungs-Ebene,
Objektkarten, Handy-Freigabe, Partner-Flow, Werbungskosten-PDF, Marktbericht-
Wizard. Die stehen jetzt in **Teil VI** samt der Werkzeug- und Messfallen, die
sie gekostet haben. Zwei Angaben der alten Fassung waren dabei **falsch** und
sind korrigiert: die aktive `style.css` und die Handy-Sperre.

**Wie zu lesen:** Teil I ist Haltung und Arbeitsweise — gilt immer. Teil II ist
die Landkarte mit sechs Workstreams. Teil III ist die Wertermittlung. Teil IV
sind Marke, Architektur, Geld, Daten, Server. Teil V sind Diagnose-Lehren,
Rollout und offene Punkte. **Teil VI ist die Arbeit im Repo mit Claude Code**
— Werkzeuge, Messkabine, Darstellungs-Ebene, Chronik und das fortlaufende
Rollout-Journal.

---
---

# TEIL I — HALTUNG UND ARBEITSWEISE

## DIE SECHS REGELN, DIE IMMER GELTEN

*(Bis 12.08. waren es vier. Regel 2 und 5 standen verstreut im Text und haben
mehr gekostet als alle anderen zusammen — sie stehen jetzt oben.)*

**1 · Erst messen, dann bauen.**
Struktur wird **nie angenommen, immer ausgelesen**: DOM per `outerHTML`, Klassen
aus `index.html`, Farbwerte per `getComputedStyle`, Marker per `grep`.
**Zählen ist keine Messung** — „das Token hat 133 Verwendungen" sagt nichts
darüber, *wo* es greift, und „ich habe es eingespielt" nichts darüber, ob es im
Container liegt.
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

**Zwei Korrekturen, beide teuer bezahlt:** Die Zeile `connectors/boris/*.js`
fehlte — dort liegen v1077 bis v1082b, und die Übersicht meldete deshalb einen
Stand von v1076, obwohl alles installiert war. Und das Muster braucht
`[A-Z0-9]`, nicht `[A-Z]`, sonst fehlen `WA2`, `WSW`, `WVF` und alle mit Ziffer
im Namen.

In den anderen Workstreams gilt dasselbe Prinzip mit anderen Mitteln: **die
Landkarte selbst aufnehmen**, Marker greppen, im Zweifel einen Screenshot
verlangen. Keiner Übergabe glauben, was die App lädt.

**2 · Ursache statt Symptom — nach zwei bis drei Fehlversuchen STOPP.**
Dann wird nicht weitergepatcht, sondern diagnostiziert: `getComputedStyle`,
`getBoundingClientRect`, `elementFromPoint`, Direktaufruf der Funktion,
Console auf `Uncaught`. Lieber fünf Minuten Diagnose als dreißig Minuten Raten.
**Und: erst messen, bevor ein Befund behauptet wird.** Am 11.08. wurden drei
Diagnosen zur Restnutzungsdauer gestellt und alle drei widerlegt — der
Rechenkern war heil, die Zahl kam aus einer fehlenden Eingabe.

**3 · Der Prüfmaßstab ist das Anwendungsbeispiel des Dokuments.**
Nie eine selbst ausgerechnete Zahl. Jeder Grundstücksmarktbericht, die SW-RL,
die ImmoWertV-Anlagen, die amtliche BMF-Vorlage — alle drucken durchgerechnete
Beispiele ab. Trifft die Prüfung sie, ist die Tabelle richtig gelesen.

**Auch die Rundung ist Dokumentverhalten** (SW-RL: volle Euro; 879,97 ≠ 880).
**Und wo kein Beispiel abgedruckt ist**, sind Monotonie über die ganze Tabelle
und eine Zählprüfung gegen die erwartete Zeilenzahl der Ersatz — nie das
Bauchgefühl. **Fünf falsche Sollwerte an einem Tag** (v1065–v1070) haben
gezeigt, warum das nicht verhandelbar ist.

**4 · Staging-first. Immer.**
Produktion wird nie direkt angefasst. Getaggt wird **nur auf Staging** (der
Prod-SSH-Key ist read-only). **Staging darf kaputtgehen — dafür ist es da.**

**5 · Fehler offen zugeben, besonders die eigenen.**
Eine falsche Diagnose wird **ausdrücklich zurückgenommen**, nicht stillschweigend
ersetzt. Im Repo heißt das: der Rücknahme-Commit sagt, was falsch war
(`v1092d: v1092c zurückgenommen`, `v1136h: Band und Kopf zurückgenommen`,
`v1113f: eigener Rückschritt aus v1113e zurückgenommen`).
**Wenn zwei gleiche Fehler hintereinander passieren, ist die Sitzung zu lang** —
abschließen, übergeben, Schluss.

**6 · Große Pakete, keine Kleinstschritte.**
Ein Feature = EIN ZIP mit `apply.sh`, `rollback.sh`, `patch.py`, `README` und
`TEST-LOG`. Zusammenhängendes bündeln, Superset bevorzugen. Nie in P1/P2/P3
zersplittern (Lehre aus v898: fünf Teilpakete, unübersichtlich). Bei drei oder
mehr offenen Punkten: Befunde sammeln, dann **ein** Nachzugspaket. Einziger
erlaubter Kleinschritt: ein gezielter Nachzug nach Marcels Sichtung.
**Neuer Inhalt heißt neue Versionsnummer**, ohne dass Marcel danach fragen muss.
(Marcels Dauervorgabe seit 18.07.)

**6a · Installationsbefehle immer mitgeben. Ungefragt.**
*(Gilt für den ZIP-Weg aus dem Chat. Bei der Arbeit im Repo mit Claude Code
tritt `.\tools\deploy-staging.ps1` an diese Stelle — siehe Teil VI.)*

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

**Seine Zwischenfragen sind oft die besten Befunde.** „Haben wir dafür nicht
Tabellen im Backend?" führte zu `mb.param_modell` und ersparte eine Migration.
„Sollten wir das Datum nicht mitnehmen?" deckte auf, dass die Zeitangaben je
Kennzahl geführt werden müssen, nicht je Bericht. Solche Fragen ernst nehmen.

**Staging-first IMMER. URSACHE statt Symptom. Fehler offen zugeben** — auch die
eigenen, besonders die eigenen. Eine falsche Diagnose wird **ausdrücklich
zurückgenommen**, nicht stillschweigend ersetzt.

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
an einem Tag passiert — drei widerlegte Diagnosen, ein Lesefehler in der
Wettbewerbsanalyse, eine vertauschte Spaltenzuordnung. Gehalten hat der Tag nur,
weil nach jeder Behauptung gemessen wurde.

**Whack-a-Mole-Stopp:** nach 2–3 Fehlversuchen STOPP, neu diagnostizieren.
Lieber fünf Minuten Diagnose als dreißig Minuten Raten.

### Datei- und Ausgabeaustausch
- Terminal-Ausgaben **unter ~40 Zeilen** — filtern, kürzen, zählen.
  `| wc -l` statt Liste · `| sort | uniq -c` · `| cut -c1-200` · `--stat` statt
  vollem Diff. Riesiges in eine Datei schreiben und als `.txt` anhängen.
- Quelldateien als **Upload**; **mehr als 3 Dateien → Tarball.**
  ```
  cd /opt/dealpilot/frontend && tar czf /tmp/dp-frontend.tgz js css *.html marktbericht-app
  ```
  **Achtung:** `landing/` und `admin/` sind Unterordner, `backend/` liegt unter
  `/opt/dealpilot/backend` — explizit mitnehmen (erst `find`/`ls`, dann exakte
  Pfade). Ein `tar landing/index.html` aus `/opt/dealpilot` schlägt fehl.
- **Uploads überleben keinen Container-Reset** — Wichtiges früh verarbeiten.
- **Beim Tarball-Anfordern die Importketten mitdenken:** `gutachterausschuss.js`
  importiert `umrechnung_nrw.js` — ein Modul allein läuft lokal nicht.
- **Ein Tarball altert.** Läuft ein zweiter Chat parallel, ist ein zwei Tage
  alter Tarball für die dort angefassten Dateien wertlos. Vor jedem Patch frisch
  ziehen oder live am Server messen. (`voice-import.js` im Juli-Tarball war
  Juni-Stand.)
- **Rekonstruierte Arbeitskopien gegen die Marker prüfen** — eine aus älteren
  Ständen zusammengesetzte Kopie führt zu falschen Befunden (zweimal passiert:
  `immowertv.js`, `nhk2010.js`).
- **Einzeiler kurz halten.** Lange Befehle werden beim Einfügen zerschossen; am
  12.08. hat sich mitten in einen `node -e`-Aufruf Text aus einem anderen Puffer
  gedrängt. Zwei kurze Zeilen schlagen eine lange.
- **Projektwissen zuerst durchsuchen**, dann Dateien anfordern. Paket-Notizen
  und Ernte-Dokumente liegen als `claude/*.md` im Projekt.

---
---

# TEIL II — DIE LANDKARTE UND DIE SECHS WORKSTREAMS

## WORKSTREAMS / NAMESPACES — NIE MISCHEN

| | Namespace | Prod-Stand |
|---|---|---|
| **(A) Haupt-App** | `vNNN` | `beleg-import-20260721` + BMF v974–v994 + Voice v1000 |
| **(B) Mobile** | `MA` | MA34; **MA35 und die v970-Sperre sind mit v1118 entfernt** |
| **(C) Landing** | Feature-Name | `landing-promo-20260723` |
| **(D) Marktbericht** | `vNNN` | **`65ca0b0`**, Tags `marktbericht-v1082b-20260812` + `marktbericht-v1145-20260812` |
| **(E) Reseller / Whitelabel** | `P-NN` / `W-NN` | W43 |
| **(F) Admin** | `vNNN` | v973/a/b + Marktzinsen-Reiter |

`vNNN` ist über A/D/F **geteilt** — im Paket-Kopf ausweisen, welcher Workstream.

**Zwei Nummernkreise im Marktbericht-Strang (Stand 12.08.):** dieser Chat
vergibt v1077–v1083 (BORIS, Sachwertfaktoren), der Parallel-Chat v1138–v1145
(Wertermittlung, Rechenwege, Handy). Beide laufen in dieselben Dateien —
**vor jedem Paket den aktuellen Stand ziehen.**

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
- **ZWEI `style.css` — und die Zuordnung war hier jahrelang verdreht.**
  Gemessen am 12.08.: `frontend/index.html` Zeile 38 lädt
  **`css/style.css`** (36.929 Zeilen, 1,26 MB, aktiv gepflegt).
  **`frontend/style.css`** (27.477 Zeilen, Stand 03.08.) wird von **keiner
  einzigen** HTML-Datei geladen — sie ist eine Leiche. Gegenprobe:
  `grep -o 'href="[^"]*style\.css[^"]*"' frontend/*.html` liefert genau einen
  Treffer. Wer nach der alten Angabe arbeitet, patcht die tote Datei, misst
  keine Wirkung und sucht den Fehler in der Kaskade.
- **Pfad-basiert routen, NICHT basename** — es gibt zwei `index.html`
  **und zwei `style.css`.**

### ZWILLINGSDATEIEN — immer zusammen patchen
`dealpilot-mb.js` ↔ `dealpilot-mb-qc.js` ·
`js/marktbewertung-card.js` ↔ `marktbericht-app/marktbewertung-card.js` ·
`css/marktbewertung-card.css` ↔ `marktbericht-app/marktbewertung-card.css` ·
`landing/promo-erstflug.js` ↔ `js/promo-erstflug.js` (`apply.sh` prüft mit `cmp`)

**HANDY-SPERRE IST GEFALLEN (v1118, 11.08.) — die alte Angabe „bewusst AKTIV"
ist überholt.** `js/mobile-redirect.js` (v970, „MB1-hardblock") und MA35 sind
**gelöscht**; in `index.html` steht an der Stelle nur noch der Kommentar
`v1118-ma-ausbau: … entfernt`. Die normale Ansicht trägt das Handy seit v1118
allein, geprüft im Durchgang bei 390 px (v1118b/c: sieben Bedienelemente auf
44 px gezogen). `?nomobileblock` gibt es nicht mehr.

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
  `wertermittlung.js`), läuft als **iframe** über
  `frontend/js/marktbericht-view.js` (`#mbv-frame`). **IMMER HELL** — keine
  Dunkelfarben in neuen Bausteinen (Feldrahmen `rgba(255,255,255,…)` sind dort
  unsichtbar). Tachos gold.
- **Eigenes mb-Backend:** `/opt/dealpilot/marktbericht/backend/` (Node, **ESM!**
  `node --check` nur als `.mjs`-Kopie). Container `dealpilot-mb-backend`,
  Compose-Service `mb-backend`, Port 4000 **nur im Docker-Netz** (Caddy kennt
  ihn nicht). Deploy = Image-Rebuild. Abhängigkeiten bewusst nur `cors`,
  `express`, `pg` — ZIP über eingebautes `zlib`, HTTP über `fetch`.
- **Eigene mb-DB:** `dealpilot-mb-db` (PostGIS), Schema `mb.` —
  **STEHT IN KEINEM BACKUP-SKRIPT** (die sichern nur `dealpilot-postgres`) →
  vor jedem Eingriff eigener `pg_dump`.
- **Proxy** `backend/src/routes/marktbericht.js` → `mb-backend:4000`.
  **KEIN Catch-all**, jede Route einzeln, `forward(method, path, opts)`
  (query + body zusammen).
  **`qstrUser()` setzt `user_id` IMMER aus `req.user.id` — jede neue Route MUSS
  da durch**, sonst Datenleck beim Lesen bzw. ein Löschknopf für fremde
  Berichte (v942-userbind).
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
- **Migrationen mb-Track:** 001–014 vergeben, **nächste 015**.
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

**Chrome-Downloads über die Fernsteuerung:** Chrome blockt mehrere automatische
Downloads je Seitenaufruf **stumm**. Zwei je Aufruf gehen durch, danach ist
Schluss; die Seite muss neu geladen werden. Steht die Domain einmal in der
Blockieren-Liste unter `chrome://settings/content/automaticDownloads`, hilft nur
das Entfernen des Eintrags. Der `download`-Attribut-Trick wirkt nur
**same-origin** — für `gars.nrw` also von `gars.nrw` aus auslösen.

### Die Verarbeitung — die Leiter hat drei Stufen
1. **`pdftotext -layout`** löst den Löwenanteil. 458 Seiten am Stück ohne
   Abbruch. Die Grenze der Web-Extraktion (Abbruch nach 45–57 Seiten) existiert
   hier nicht.
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

**Nicht crawlen, wo eine API existiert.** Behördenportale sind Weboberflächen
für Menschen (`boris.nrw.de` = 9.440 Bytes JavaScript, null Links). CKAN
abfragen: `ckan.open.nrw.de/api/3/action/package_show?id=ad760913-…` →
`GMDNRW_CSV.zip` mit `lzs.csv` (73 GAA × 11 Objektarten × 16 Kennzahlen),
Zero 2.0, kommerziell erlaubt — enthält **nicht nur** den Zinssatz, sondern auch
Bewirtschaftungskostenquote, Rest-/Gesamtnutzungsdauer, Marktmiete,
Kaufpreisniveau je Gemeinde.

**Konnektoren:** `BorisConnector` (Bodenrichtwerte, ArcGIS, 16 Länder) ·
`IrwConnector` (Immobilienrichtwerte § 20 über WMS, Jahrgänge ab 2011) ·
`OpenDataConnector` (NRW CKAN) · `opendata/` (AK-OGA bundesweit, Parser P1).

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
Berlin (kostenfrei). Bayern und Schleswig-Holstein sagen in ihren
Landesberichten ausdrücklich, dass sie diese Daten **nicht** enthalten.

**Das ist der Burggraben.** Wer amtliche kreisscharfe Sachwertfaktoren will,
muss dieselbe Handarbeit leisten — es gibt keine Datei, die man einmal zieht.

### Zum Wettbewerb (beide vermessen am 10./11.08.)
**immobilien-wertermittlung.de (ImmoInvent GmbH)** — Tooltip wörtlich:
*„Der angegebene Sachwertfaktor wird über einen internen Algorithmus ermittelt.
Dieser deckt sich aber nicht zwangsläufig mit den Sachwertfaktoren der
Gutachterausschüsse. Bitte überprüfen Sie immer den Sachwertfaktor und ziehen
Sie immer die Sachwertfaktoren der Gutachterausschüsse oder eigene
Sachwertfaktoren vor!"* An der Löhner Straße schlägt der Assistent **1,13** vor,
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

## DAS AUSSCHUSS-REGISTER — NEUN MODELLFORMEN

**Jeder Ausschuss veröffentlicht in eigener Struktur.** Gemessen an 21 Berichten
des Jahrgangs 2026 gibt es nicht drei Formen, sondern **neun**:

| Form | Ausschüsse |
|---|---|
| `matrix_interp` Matrix, zwei stetige Achsen, Kreuzinterpolation | Minden-Lübbecke (SW × RND), Herford (SW × BRW), Höxter (SW × BRW), Kreis Paderborn (SW × Lagewert) |
| `matrix_kategorial` x stetig, y kategorial | Bielefeld (SW × Wohnlage mittel/gut/sehr gut) |
| `matrix_band` beide Achsen Bänder, KEINE Interpolation | Düsseldorf (Baulandfläche × Baujahresgruppe) |
| `stufen_1d` eine stetige Achse | Iserlohn, Märkischer Kreis, Lüdenscheid (Tabellenfassung) |
| `potenz` Y = a · X^b | Lüdenscheid (Formelfassung) |
| `linear_sachwert` liefert den WERT, nicht den Faktor | Stadt Paderborn (drei Objektarten) |
| `doppel_log` SF[%] = c + a·ln(F) + b·ln(X) | Kreis Lippe |
| `konstante` ein Faktor je Objektart | Essen, Duisburg |
| `basiswert_additiv` Basiswert + Bandkorrekturen | Bochum |
| `zuschlag_prozent` Zu-/Abschläge in % nach Gebiet | Dortmund (zusätzlich eine Baujahrstabelle für Gebiet 1) |

**Bochum und `zuschlag_prozent` brauchen keinen eigenen Auswerter** — Bochum ist
eine `konstante` plus vier `band`-Korrekturen.

**Neue Eigenschaft, kein neuer Auswerter:** Iserlohn und Märkischer Kreis führen
**Zeitreihen** über sechs Berichtsjahre. Der jüngste Jahrgang gilt, die älteren
sind Dokumentation.

**Der Auswerter ist `swf_modelle.js`** (v1083-WMOD) — acht Auswerter, ein
Vertrag, dazu additive Korrekturen als Stufen- oder Bandtabelle. Prüfstrecke
37 von 37. **Kernbeleg:** die Regression Löhner Straße läuft durch den
**generischen** Auswerter und liefert Tabellenwert 0,899 und Faktor 0,889 —
exakt die Zahlen des v1076-Klicktests aus dem handgeschriebenen Herford-Modul.

**Die drei Strukturbeispiele, an denen es aufgefallen ist:**

| Ausschuss | Sachwertfaktoren | Abschnitt | Außenanlagen | Gartenland |
|---|---|---|---|---|
| Minden-Lübbecke (05770) | Matrix Sachwert × **RND** | 5.1.4 | feste Beträge | 5 €/m² pauschal |
| Lüdenscheid (25200) | eindimensional **+ Formel** | 5.1.2 | 5 % | — |
| Herford (05758) | Matrix Sachwert × **BRW** + Zuschläge | 5.1.2 | 6 % (4–8) | 20 % des BRW |

**`lib/gutachterausschuss.js` bleibt die einzige Stelle**, die nach dem
Gemeindeschlüssel entscheidet, und gibt immer dieselbe Form zurück.
**Sachwertfaktor nur über den Auflöser, nie ein Modul direkt.**

**Neuen Ausschuss aufnehmen:** Bericht holen → Rezept nach dem Muster von
`312-hoexter.json` → Prüfstand → Registerdatensatz → Eintrag in `AUSSCHUESSE`.

**KEIN TREFFER HEISST KEIN WERT.** Nie ein Nachbarkreis, nie ein Landesmittel.
Genau so ist in v1060 ein Vergleichsfaktor aus Minden-Lübbecke in einen Bericht
für Hiddenhausen geraten: die Kreisprüfung lag in den Modulen, in einem fehlte sie.

**Der Herford-Pfad ist seit v1076 END-TO-END BELEGT.** BORIS liefert den AGS,
der Orchestrator schreibt ihn in `ref.ags` zurück (v1075-WAGS), der CrossCheck
holt die Matrix, der marktangepasste Sachwert erscheint mit Stufe A und
Ausschussname. **Vorher lief dieser Zweig NIE.**

---

## DAS ERNTEWERKZEUG

**Je Ausschuss ein Rezept, für alle derselbe Prüfstand.** Ein generischer Parser
ist unmöglich, aus demselben Grund, aus dem es kein generisches Sachwertmodell
gibt. Die Prüfungen dagegen sind für alle gleich.

```
tools/gmb-ernte.py          der Prüfstand
tools/rezepte/<gaa>.json    je Ausschuss ein Rezept
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

**Module (`marktbericht/backend/src/lib/`):**

| Datei | Inhalt | Belegt gegen |
|---|---|---|
| `immowertv.js` | Bodenwert, Ertragswert, GND-Tabelle, Anlage 3 | Verordnungstext |
| `anlage2.js` | Restnutzungsdauer bei Modernisierung (Export heißt **`restnutzungsdauer`**!) | Verordnungsformel, am Server gemessen |
| `nhk2010.js` | **NHK vollständig: 36 Gebäudearten 1.–3., 180 Kennwerte · gewogener Ausstattungsgrad `gewogenerKennwert()` · Bauteile vor AWM · Garage 14.1 · Außenanlagen-%** | SW-RL 2012 Anlagen 1+2 (vier Beispiele + gewogen 1.01 → 880 €/m²) |
| `nrw_modell.js` | AGVGA-NRW, BWK-Ansätze, RND, Streuung | Modell selbst (230 → 280) |
| `mietmodell_nrw.js` | Mietpreisübersicht Minden-Lübbecke | 5,64 €/m² · 507,60 € |
| `vergleichsfaktoren_nrw.js` | Vergleichsfaktoren § 20 | 150.100 / 253.750 € |
| `verfahrenswahl.js` | Führendes Verfahren, Zinsanpassung § 33 | § 6 Abs. 1 |
| `sachwertfaktoren_nrw.js` | Sachwertfaktoren Minden-Lübbecke | Monotonie beidseitig |
| `sachwertfaktoren_herford.js` | Sachwertfaktoren + UK Kreis Herford | 0,89 + 0,02 − 0,03 = 0,88 |
| `umrechnung_nrw.js` | UK Grundstücksgröße, Hinterland § 41 | 0,881 / 0,988 / 58 €/m² |
| `gutachterausschuss.js` | **Auflöser** (importiert `umrechnung_nrw`!) | Zuständigkeit |
| `swf_modelle.js` (v1083) | **Acht Auswerter für die neun Modellformen** | 37 Prüfungen gegen Anwendungsbeispiele |

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

### Der Rechenkern ist geprüft — Stand 11.08.
Anlass war eine Differenz von rund 72.000 € im Gebäudesachwert gegenüber dem
Werkzeug, mit dem das Gutachten zur Löhner Straße erstellt wurde.
**Ergebnis nach sechs Messungen am Server: kein Befund im Code.**

| geprüft | Ergebnis |
|---|---|
| `anlage2.js` bei GND 80, Alter 62, 3 Punkte | **24 Jahre**, Formel Anlage 2 (a = 0,9033 · b = 1,9263 · c = 1,2505) |
| Staffel 0/1/2/3/5 Punkte | 19,3 · 19,3 · 21,7 · 24 · 28,7 — Bänder wie in der Verordnung |
| `nhkSachwert()`-Aufrufe (Z. 137, 189) | beide mit `rnd_jahre: _rndEinheitlich()`, seit v1056-WRND-1 |
| Kette `modGrad` → `mod_punkte` | heil: `wertermittlung.js:740` · `app.js:1380` · `ReportOrchestrator:136` |

**Die alte Notiz „RND 18 statt 24" ist damit erledigt.** Die 18 kam daher, dass
im Klicktest kein Modernisierungsgrad ausgewählt war; dann greift der
beabsichtigte Rückfall `if (_mp == null) return rnd;` auf GND − Alter.

### Der stille Rückfall — offener Paketinhalt
Bleibt `modGrad` leer, zeigt der Bericht eine Restnutzungsdauer von 18 Jahren
**ohne Hinweis**, dass das nicht die Anlage-2-Zahl ist. Wirkung an der Löhner
Straße: Restwertfaktor 0,225 statt 0,30, rund **57.500 €** weniger
Gebäudesachwert — unbemerkt.

Das verletzt zwei eigene Grundsätze: *kein Verfahren rechnet halb* und *jede Zahl
trägt ihre Herkunft*. Empfehlung: Herkunft ausweisen — „Restnutzungsdauer
geschätzt (Gesamtnutzungsdauer minus Alter), da kein Modernisierungsgrad erfasst
— Anlage 2 nicht angewandt." Dazu ein Prüfstreckenpunkt, der nachweist, dass
Sachwert und Ertragswert **dieselbe** Restnutzungsdauer ausweisen.

### Drei Konstanten im CrossCheckService
- **`BAUPREISINDEX = 2.02`** (Z. 22), kommentiert als „2010 → 2026 (Destatis,
  gerundet)". Das **Berechnungsbeispiel des GMB Dortmund 2026** rechnet dagegen
  mit *Index 2010 = 100 · Bundesindex = 190,6*, also Faktor **1,906** zum
  Stichtag 01.01.2026 — unsere Konstante liegt rund **6 % darüber**. Und sie hat
  **keinen Stichtagsbezug**: bei einem Wertermittlungsstichtag in der
  Vergangenheit rechnet sie zwangsläufig falsch.
- **`GND_JAHRE = 80`** (Z. 24), obwohl `immowertv.js` eine GND-Tabelle führt.
  Für Wohngebäude richtig, für Gewerbe falsch.
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
A  amtlich, gemeinde- oder kreisscharf      nicht indikativ
B  amtlich regional / als unsicher markiert nicht indikativ
C  marktabgeleitet, objektspezifisch        indikativ
D  § 256 BewG                               indikativ
E  eigene Angabe                            schlägt alles
```
Kette: **gemeinde (8) → kreis (5) → bezirk (3) → land (2) → bund**
Herabstufung bei Streuung über 25 % (`LZS_STREUUNG_SCHWELLE`): A wird B.
**Eigene Angabe (E) schlägt A, wird aber als eigene Angabe gekennzeichnet.**

**Median-Liegenschaftszins NRW:** ETW vermietet 2,2 % · EFH 1,4 % · MFH 3,2 %.
Der § 256-Auffangwert (3,0 / 2,5) liegt durchweg zu hoch.

**Offene Entscheidung (Marcel):** Für Gebiete ohne hinterlegten Ausschuss steht
heute „kein Ausschuss hinterlegt". Denkbare Ersatzebenen: **ImmoWertA Nr. 9(3)**
erlaubt Daten anderer Ausschüsse bei nachgewiesener Modellgleichheit und mit
besonderer Begründung (Kölner Handlungsleitfaden: „die Höhe der vorgenommenen
Marktanpassung bedarf immer einer besonderen Begründung"). Und **Anlage 25 BewG**
wäre eine bundesweite gesetzliche Wertzahl — allerdings steuerlich, nicht für den
Verkehrswert. Noch nicht entschieden.

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
Er nennt die Richtungen, nicht ihre Stärke. Das gehört so in den Bericht.

### Nicht aufweichen
- **Kein Verfahren rechnet halb.** Fehlt eine Pflichtangabe, erscheint das
  Verfahren nicht — statt mit einem stillen Standardwert zu rechnen.
- **Wo die Quelle endet, endet die Rechnung.** Tabelle bis 1.600 m²? Darüber
  wird ausgewiesen, nicht gerechnet. Extrapolation ist in mehreren Berichten
  ausdrücklich untersagt.
- **Jede Zahl trägt ihre Herkunft.** Stufe A–E, Modellvermerk, `indikativ`,
  **den Ausschuss und den Stichtag**. Seit v1075 bis ins PDF: `out.sachwert`
  reicht gewogene Stufe, Bauteile, Garage, Außenanlagen und Hinweise durch.
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
bepreist, nicht nach Kosten.
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
(`price_1TtM0CGefFev8arzACdni0a9`) bzw. 1.490 €/Jahr
(`…ixIUNCYo`). **Seat** `prod_Ut8Gi6OPw3FdtF`, Volume-Staffel
35 / 29 / 24 € monatlich (`price_1TtM0DGefFev8arzBopJ0ESC`), 350 / 290 / 240 €
jährlich. Die früher notierten 249 € sind **falsch**.
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

### Die mb-DB kann das Ausschuss-Register schon — gemessen 12.08.
**`mb.param_modell` passt ohne Migration 015.** Sie ist besser zugeschnitten,
als ein Neuentwurf geworden wäre:

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
UNIQUE (land_code, ags, kennzahl, zweig, COALESCE(berichtsjahr,-1), quelle_url)
```
**Kein Datensatz ohne Beleg** — als Constraint. Und das `berichtsjahr` im
Schlüssel ist die **Zeitreihe**: Iserlohn und Märkischer Kreis passen mit sechs
Jahrgängen nativ hinein.

### Die halbe Erntestrecke steht schon
| Tabelle | Stand 12.08. |
|---|---|
| `gaa_sources` → `gaa_documents` | **67 Dokumente, ALLE `status = neu`** — nie extrahiert; **0 davon von gars.nrw oder boris.nrw** |
| `param_modell` | **0 Zeilen** |
| `param_lauf` | Zähler `gefunden/uebernommen/verworfen/fehler` + `protokoll` jsonb |
| `param_probe` | **Quellenwächter** (http_status, content_type, urteil) — NICHT das Prüfprotokoll |
| `param_werte` | Open-Data-Sätze (28.827 auf Staging, **0 auf Prod**) |

**Daraus folgt der Zuschnitt von v1083:** kein neues Gerüst, sondern der
fehlende Schritt. `gaa_sources` um die NRW-Quellen ergänzen, die Berichte als
`gaa_documents` eintragen, `gmb-ernte.py` wird der Schritt **Dokument →
`param_modell`** (aus der Warteschlange holen, `pdftotext`, Rezept + Prüfstand,
bei Erfolg Datensatz schreiben und `status='fertig'`, bei Durchfall
`status='fehler'` mit Begründung in `notiz`, Zähler und Protokoll nach
`param_lauf`), und `gutachterausschuss.js` liest `param_modell` statt seiner
einprogrammierten Konstanten. **Rückgabeform bleibt identisch.**

Der `sha256` in `gaa_documents` trägt mehr, als er aussieht: ändert ein
Ausschuss seinen Bericht, ändert sich der Hash, und das Dokument fällt
automatisch zurück in die Warteschlange. **Die Jahrgangspflege läuft von selbst.**

---

## SERVER / STACK

Vanilla-JS-Frontend (**kein Build**, volume-mounted → `git pull` = live),
Node/Express **:3001**, mb-backend **:4000** (beide nur im Docker-Netz),
PostgreSQL 16 + PostGIS, Docker Compose, Caddy, Hetzner.

**STAGING** `root@116.203.214.11` · **PROD** `root@157.90.117.167`
(`DealPilot-Prod-neu`) · beide `/opt/dealpilot` ·
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
  Server `poppler-utils` nachrüsten.
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
MARKET_CACHE_TTL_MIN     720 (12 h) — zum Testen auf 5
KI_GEGENRECHNUNG         0 = aus, 1 = Zweitmeinung
HARVEST_SCHEDULER        1 = an
NACHBARWERT              1 = an (greift erst nach der vollen Kaskade)
OPENDATA_KASKADE         1 = an (OD-Ebene in der Parameterkaskade)
LZS_STREUUNG_SCHWELLE    25 (Prozent, ab da A → B)
IRW_JAHRE_ZURUECK        3
BORISD_USER_AGENT        Browser-Kennung für gis.nrw.de
OPENDATA_USER_AGENT      eigene Kennung mit Kontakt
MB_BODY_LIMIT            80mb
```
**`mb-backend` hat einen `environment:`-Block ohne `env_file:`** — zehn
Variablen aus der `.env` kommen dort nicht an. `compose-env.sh` aus v1064 trägt
sie ein, danach `--force-recreate`.

### AVM & Betriebsschalter
**DealPilot ruft IMMER den Marktbericht-Microservice** (2 L). Sprengnetter
(20 L) und PriceHubble (40 L) hängen an `AVM_MODE`
(`AVM_LIVE_PROVIDERS=sprengnetter,pricehubble`). `MB_DEMO=1` bzw. `market=seed`
→ Seed-Zahlen. ImmoMetrica `IMMOMETRICA_MODE=stub`, 428 = kein Zugang.

**⚠ Prod läuft derzeit mit `market=seed`** (720 erzeugte Angebote im Log) —
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
mit `null`, während der Orchestrator den korrekten Wert längst aufgelöst hatte.
`grep "ref.ags ="` hätte es sofort gezeigt: **nach der Variable suchen, die
angeblich gefüllt ist.**

**Aber: die Kette kann auch heil sein.** Am 11.08. wurden drei Diagnosen zur
Restnutzungsdauer gestellt und alle drei widerlegt — der Rechenkern war richtig,
die Kette heil, und die auffällige Zahl kam schlicht aus einer fehlenden
Eingabe. **Bevor ein Befund behauptet wird, muss er gemessen sein, nicht
plausibel.**

**Der Sollwert kommt aus dem Dokument, nicht aus dem Kopf** — einschließlich der
Rundung. Fünf falsche Sollwerte an einem Tag (v1065–v1070), jedes Mal von der
Prüfstrecke gefangen. Fünfmal ist ein Zustand.

**Ein Extraktionsmodell erfindet Tabellen.** Bei Bochum kam eine perfekt
gestaffelte Sachwertfaktor-Matrix zurück, die es im Dokument nicht gibt, dazu
eine verdrehte Fallzahl. Aufgefallen ist es nur an der Gegenprobe. **Jede
Tabelle aus einem PDF braucht die Nachrechnung gegen das Anwendungsbeispiel oder
mindestens eine Zählprüfung.**

**Die kluge Prüfung fängt weniger als die dumme.** Beim fehlerhaften Suchmuster
gingen Monotonie, Wertebereich und Anwendungsbeispiel alle durch — nur das
Nachzählen der Zeilen fand die Lücke.

**Proben über die ganze Tabelle statt Stichproben.** Monotonie in beide
Richtungen fängt vertauschte Blöcke und Zahlendreher. Genau das hat die
Ausrichtung der Sachwertfaktor-Matrix entschieden.

**Wo eine Rückfall-Regel steht, prüfen, wofür sie gilt.**
`HAUS_TABELLE['_kreis']` galt für jeden Ort in Deutschland.

**Ein stiller Rückfall ist schlimmer als ein Fehler.** Er liefert eine Zahl, die
aussieht wie die richtige. Jeder Rückfall muss sich im Bericht melden.

**Die erste Erklärung ist nicht die ganze.** Beim leeren `ref.ags` lagen DREI
unabhängige Ursachen übereinander — und die vierte (der const-Zweig) zündete
erst nach dem Fix der ersten drei. Beim Promo waren es ebenfalls drei: falsches
Stripe-Konto, falsch gelesene Coupon-Struktur, Negativ-Cache. **Bei
mehrschichtigen Ketten einmal komplett durchmessen:** Stripe → Backend-Prozess →
HTTP → Browser-Cache.

**Es gibt nur EIN Modal und Schichten.** „Falsches Modal"-Eindrücke erst per
`grep -rln` über `js/` klären, bevor umgebaut wird. Gelöschte „Leichen" können
aktive UI-Schichten sein (`bmf-modal-v292.js`).

**Bevor ein zweites Werkzeug gebaut wird, nachsehen, ob es das erste schon
gibt.** `gaa_documents` und `param_lauf` standen längst da.

### Git und Parallelbetrieb
- **Nur EIN Chat fasst git an.** Am 12.08. hat der Parallel-Chat während des
  Rollouts weitergeschrieben; zwischen Commit und Merge erschien ein fremder
  Commit. Es ist gutgegangen, war aber Glück.
- **Vor dem Merge `git pull --ff-only` auf main.** Lokales main auf Staging war
  **190 Commits zurück** — ohne den Pull wären 190 fremde Commits ausgesperrt
  worden. **Der Anker ist der Hash NACH dem Pull.**
- **`main..staging` vor dem Merge zählen.** Erwartet wurde ein Commit, es waren
  über fünfzig aus zwei Arbeitssträngen.
- **`git diff main...staging --name-only` vor dem Rollout lesen** — vor allem auf
  Migrationen. Keine Migration heißt: sauberer Rückweg per
  `git reset --hard <Anker>` + Rebuild.
- **Ein Fremd-Commit kann uncommittete Working-Tree-Dateien mit-committen** —
  nur eigene Dateien EINZELN stagen, zeitnah committen. Geteilte Dateien über
  `*.pre-<paket>`-Backups trennen (Backup → Datei → `git add` → Vollversion
  zurück), nicht auf Hunk-Picking verlassen. `git show :datei | grep`
  gegenprüfen.
- **`git log main..staging` kann LEER sein trotz vieler Änderungen** (alles
  uncommittet) → immer zusätzlich `git status -s`.
- **Vor dem Prod-Pull `git fetch`** — Prods `origin/main` ist bis dahin alt.
- Nach dem Neuverbinden landet man in `~`, nicht im Repo. **`cd /opt/dealpilot`
  gehört in jeden Befehlsblock.**
- **Rückroll statt Verheddern:** Features, die auf Infrastruktur warten, nicht im
  selben Commit mitschleppen.

### Patch-Disziplin
1. **Ein Marker sagt „hier war ich", nicht „hier ist alles gut."** Viermal hat
   ein gesetzter Marker seine eigene Reparatur blockiert (`if marker in s: skip`).
   Wo ein Fehler ausgeliefert wurde, braucht es einen Block, der den **Schaden**
   sucht. **Marker gehören in Kommentare, NIE in Nutztext** und nicht in
   Erklärtexte (`/* WSACH-3 */` stand im Kunden-PDF; dreimal fand die Suche die
   eigene Kommentarzeile). Und nicht ans Zeilenende, wenn ein späterer Schritt
   dahinter etwas anhängt.
2. **Ein Patch darf keinen Marker löschen, den seine eigene Vorbedingung
   braucht** — sonst läuft er genau einmal.
3. **Ein Löschschritt hinterlässt keinen Marker** — Zeilen werden durch einen
   Kommentar ERSETZT, der zugleich als Marker dient.
4. **Ein Anker ohne Zeilenende ist eine Wette.** `newPage(); // …Seitenende`
   ließ ` lassen` stehen → `lassen is not defined`, syntaktisch gültig,
   `node --check` winkt durch, Absturz erst zur Laufzeit.
5. **Echte UTF-8-Zeichen in Ankern**, keine Escape-Schreibweise; Einrückung am
   echten Code messen. **Ausnahme:** in `wertermittlung.js` stehen `·`-Escapes
   **literal** im Quelltext — dort muss der Anker die Backslash-Schreibweise
   treffen. NBSP-Falle: Anker aus dem Live-Grep, nicht tippen.
6. **Eine Datei, zwei Stellen.** Nach jedem `ersetze` prüfen, ob dasselbe Muster
   nochmal vorkommt (Modellvermerk, BORIS-Feldnamen, Fußnote — dreimal die erste
   Stelle repariert und die zweite übersehen).
7. **Reihenfolge prüfen:** eingefügter Code muss NACH dem Aufbau der Objekte
   stehen, auf die er zugreift (`out.available = true` steht **vor** dem
   Verfahrensvergleich).
8. **Vorbedingungen auf Marker prüfen, die es gibt** — und in den Dateien, die im
   Arbeitsverzeichnis LIEGEN. Ein `patch.py`, das eine Datei prüft, die
   `apply.sh` nicht in die Arbeitskopie kopiert hat, bricht ab. Eine neu
   angelegte Datei trägt keinen Marker ihres eigenen Pakets.
9. **Variablennamen in derselben Funktion können kollidieren** — vor neuen Namen
   `grep` im Zielscope (`_pt` war schon vergeben).
10. **Eine Datei, die das Paket NEBEN das Original legt, ist nicht installiert.**
    v1065 lieferte die belegte Legende als `imbde_legende.csv.v1065` statt die
    CSV zu ersetzen — `ladeLegende()` wäre mit einer LEEREN Map zurückgekommen
    und alle 28.827 Sätze wären `semantik_offen` geblieben. **Beipackdateien
    gehören ins `apply.sh` wie Code**, mit Prüfung auf die erste Zeile.
11. **Ein doppelt zugewiesener Shell-Wert überschreibt still.** In einem
    abgeleiteten `apply.sh` stand `NEUE=""` NACH der neuen Zuweisung.
12. **Anker auf Ausdrucks-Ebene**, wenn Zeilen mehrfach vorkommen (6× `ak_total`,
    5× `var host`) — mit count-Ausgabe; Index-Span statt Escape-Raterei.
13. **Regex-Block-Ersatz zwischen zwei kurzen, sonderzeichenfreien Ankern**
    (`.*?` + `re.DOTALL`), beide vorher `count()==1` — bei zickigen Ankern.
14. **Backups nie überschreiben:** `.pre-<paket>` nur anlegen, wenn keins da ist
    (v999: ein Doppellauf hatte das saubere Backup mit dem gepatchten Stand
    überschrieben; das Repo war die Rettung).
15. **Der Mock muss die echte Schnittstelle abbilden.** `q()` liefert `res.rows`
    direkt — ein Stub mit `{rows:[]}` verdeckte neun `.rows`-Zugriffe.
16. **Cache-Buster attributgebunden ersetzen:**
    `(\b(?:src|href)\s*=\s*)(["'])(…)NAME(?:\?v=[^"']*)?\2`
17. **Marker-Kollision:** Idempotenz-Marker nicht auf Strings ankern, die das
    angehängte Modul selbst enthält (v972a: nicht `dp-pa-tab-verlauf`, sondern
    die `id="…"`-Form).
18. **`VNNN`-Variable prüfen:** `apply.sh` lädt aus `/tmp/${VNNN}/` — gegen den
    ZIP-Namen prüfen, `rm -rf /tmp/vNNN` vor dem `unzip`.

### Bash und Node
- **`grep -q X && { exit 1; }` bricht unter `set -e` ab, wenn grep NICHTS
  findet** — also im guten Fall. Die if-Form tut das nicht.
- **`grep -c` mit null Treffern gibt Rückgabewert 1** → `|| true`; und `grep -c`
  zählt **Zeilen, nicht Treffer** (`</body>` kommt 3× vor, `grep -c` sagte 2).
- **Node 18 auf dem Host erkennt ESM nicht von selbst**, Node 22 seit 22.7 schon.
  `package.json` mit `{"type":"module"}` gehört in **jede** Arbeitskopie.
- **`node --check` ist als `.js` und `.mjs` unterschiedlich streng.**
  Browser-Scripts als `.cjs` prüfen; ESM meldet fälschlich Doppel-Deklarationen
  — **das aber als Hinweis auf echte Doppel-Funktionen nutzen.**
- **Doppel-Definition: in JS gewinnt die LETZTE.** Vor dem Patch prüfen, welche
  aktiv ist, sonst editiert man toten Code.
- kein `#` in Einzeiler-Pastes · **kein `!` in doppelten Quotes**
  (History-Expansion; steht seit Monaten hier und ist trotzdem wieder passiert) ·
  `>`/`<` ausschreiben · verschachtelte `$()` vermeiden · HEREDOC fragil →
  `create_file`/ZIP · `docker compose` nur aus `/opt/dealpilot` · Umlaute und
  `·` quoten · **lange Einzeiler werden beim Einfügen zerschossen** ·
  mehrzeilige Pastes können als Befehle interpretiert werden.
- **„CACHED" beim Build ist nicht immer ein Fehler.** Wurde `backend/src` nicht
  geändert, ist die Zwischenspeicherung richtig. Gegen den Diff prüfen.
- **BOM in Mockdateien prüfen.**

### CSS / Frontend
- **`:not(#id)` erbt ID-Spezifität.** `.hero > *:not(#dpm-flug)` hat 110, nicht
  10 — die Regel überstimmte `.hero-orb{position:absolute}`, beide Orbs
  rutschten in den Fluss und schoben den Hero um **exakt 760 px**. **Nie
  Sammelregeln auf Container-Kinder**, immer das eine Zielelement benennen.
- **Element-zuerst bei Optik:** `getComputedStyle` + Element-HTML in der Console;
  prüfen, ob die Regel überhaupt geparst ankommt
  (`[...document.styleSheets]`). **`rules: Array(0)` trotz geladener Datei = das
  CSS kommt NICHT an, kein Spezifitätsproblem.**
- **CSS kommt partout nicht an → Style INLINE ins JS-Markup.** Garantie-Lösung
  (v850, `.sbc-halter`).
- **`insertBefore` nur, wenn `ref` ein DIREKTES Kind ist** — sonst
  `NotFoundError` und der ganze IIFE ist tot. „Feature erscheint nicht, kein
  CSS-Fehler" → Console auf `Uncaught` prüfen.
- **Parallel laufende Renderer:** eine Quelle festlegen, Alt-Render entfernen,
  Hook an den zentralen Render.
- **Klick-Diagnose vor Patch-Serien.** Nach 2–3 Fehlversuchen STOPP →
  `getComputedStyle`, `getBoundingClientRect`, `elementFromPoint`,
  Direktaufruf der Funktion. Console-Einzeiler als return-IIFE.
- **Accordion-Lehre:** alten `vNNN`-Block per Marker-Regex ENTFERNEN und EINEN
  sauberen schreiben.
- **Die Buster-Kette hat vier Glieder.** Sie wurde viermal vergessen.
- **SVG ohne Größe füllt den Container.** Browser normalisiert Hex zu `rgb()`,
  Custom Properties nicht.
- **Hochformat-Video formatfüllend = Upscale = Pixel** → vorab ins Zielformat
  rendern (crop + lanczos + unsharp), nie den Browser skalieren lassen.
- **Autoplay mit Ton ist ohne Klick verboten** (Browser-Regel, kein Bug; der
  Schalter „Sound: erlaubt" hebt sie nicht auf). Richtig: mit Ton **versuchen**,
  bei `NotAllowedError` stumm neu starten.
- **Layout rechnerisch absichern** (Breitensumme gegen Platz).
- **Bild-Retusche:** Farb-Schlüssel-Maske + MaxFilter-Dilation + **harte
  Schutzzonen-Rechtecke** statt Feder-Maske (die lässt an den Rändern Original
  durchscheinen → Geisterreste). Den Farbdetektor an echten Pixeln
  **kalibrieren**, Ergebnis per Zoom-Crops abnehmen.

### Backend / Ops
- **Status lesen, nicht raten.** 405 auf einen POST an eine statische Domain =
  `file_server` (nur GET/HEAD), nicht die fehlende Route. 402 = consume /
  Feldnamen. `printenv` für Container-Env. **Aufrufer immer lesen — alle.**
- **Fremde API? Die echte Signatur und einen echten Aufrufer lesen**, bevor man
  sie nutzt (`admin-landing.js` rief `API.call()`, das der Wrapper gar nicht
  exportiert).
- **Theme-Farben messen, nicht annehmen** (`getComputedStyle`).
- **NXDOMAIN ≠ „propagiert noch"** — der Record existiert gar nicht. `dig
  @1.1.1.1`, `curl --resolve`, vom Server lesen (die Sandbox hat kein Netz).
- **Zertifikat rot im Browser, grün auf dem Server:** erst messen —
  ```
  echo | openssl s_client -connect HOST:443 -servername HOST 2>/dev/null | openssl x509 -noout -issuer -subject -dates
  ```
  Issuer Let's Encrypt + ≥ 2 Zertifikate + kein Mixed Content = der Server ist
  sauber, der Rest ist Browser-Zustand. Gegenprobe: anderer Browser.
- **Vor einer Migration, die bestehende Zeilen anfasst:**
  ```
  docker exec dealpilot-mb-db psql -U mb -d marktbericht -c "BEGIN; <UPDATE>; ROLLBACK;"
  ```
  Migration 012 lief in den Eindeutigkeitsindex und hängte den Container in eine
  Neustartschleife. **Ein Muster, das einmal nötig war (`NOT EXISTS` in 010), ist
  beim nächsten Mal wieder nötig.**
- **Verify-Mail fehlt = SPAM (SPF/DKIM/DMARC), kein Bug.**
- **Direkt-Patch auf Prod** → Cleanup `git checkout -- <files>` + `git pull`.

### Stripe
- **`promotion_code.coupon` gibt es so nicht mehr.** Die API liefert
  `"promotion": {"coupon": "id", "type": "coupon"}` — nur die ID, je nach
  API-Version aber auch als eingebettetes Objekt oder unter `pc.coupon`.
  **Alle drei Formen abdecken**, notfalls `coupons.retrieve(id)` nachladen. Der
  Endpoint hat wegen dieser einen Zeile nie funktioniert.
- **Negative Antworten NIE cachen.** `{active:false}` landete für 10 min im
  `sessionStorage` — **das überlebt Strg+Shift+R** und stirbt erst beim
  Tab-Schließen. Nur positive Antworten cachen; Cache-Key bei Bugfixes
  hochziehen (`dp_promo_v1` → `v2`).
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
  Berechtigungshinweise und Download-Symbole sieht nur Marcel — bei blockierten
  Aktionen ihn hinschauen lassen.
- **Passwörter werden nicht eingegeben.** Fehlt ein Login, meldet man das und
  arbeitet mit dem öffentlichen Teil weiter.

### Wächter
**Ein Wächter, der Unfug meldet, wird überlesen.** Zweimal an einem Tag: der
Taktgeber meldete 38 frisch geprüfte Quellen als „seit 18 Monaten stumm", und das
TDZ-Werkzeug hätte einen Rollout blockiert, ohne dass ein Fehler vorlag.
`tools/tdz-pruefung.py` **meldet, bricht aber nicht ab** — es kennt keine
Gültigkeitsbereiche.

### Grundsätzlich
- **Die Landkarte selbst aufnehmen** — keiner Übergabe glauben, was die App lädt.
  Bei UI-Fragen schlägt ein Screenshot von Marcel jede Grep-Runde.
- **Feldnamen amtlicher APIs messen, nicht annehmen**
  (`Gemeindekennzeichen` ≠ `Gemeindeschlüssel`, `f.opt` ≠ `f.optionen`,
  `nhk_efh_bgf_eur`). Auch eigene Exporte: `anlage2.js` exportiert
  `restnutzungsdauer`, nicht `anlage2Rnd` (das ist ein Import-Alias).
- **Behauptungen aus alten Übergaben nachmessen.** „Kapitel 11 fehlt im PDF" und
  „Vergleichsobjekte zeigen 9 Zeilen bei (10)" — beides existierte nicht.
- **Stale-Baseline:** Basis per Marker + md5 + Lead-Text verifizieren, nicht am
  Dateinamen (Screenshot „QUICKBOARDING PASS" gegen Upload „BOARDING PASS" =
  andere Datei). Prod und Staging können auseinanderlaufen.
- **Erst die Adressen prüfen, dann das Werkzeug abschreiben.** Der Crawler galt
  als untauglich, weil er auf Startseiten statt auf Verteilerseiten geschickt
  wurde.
- **Auslöser entschärfen statt Konsumenten patchen** (Performance, v729–v734).
  Trace first.

---

## AUSLIEFERUNG

- **`apply.sh` = alles oder nichts:** Kopien in `/tmp` patchen, ALLE Prüfungen,
  dann tauschen. Anker- oder Syntaxfehler → nichts geschrieben.
  `package.json` MIT anlegen (ESM!). Vorbedingungen über **Marker**, nicht über
  Annahmen. Wenn ein Funktionslauf Modul-Importe braucht: die **ganze** `src/` in
  die Arbeitskopie kopieren, nicht einzelne Dateien (Importketten!).
  `DP_ROOT`-Override für den e2e-Mock gegen einen Fake-ROOT.
- **ZIP-Konvention:** Wrapper `NAME.zip` → `NAME/`, nie mit Präfix.
  `unzip -o paket.zip -d /tmp` (nicht `-d /tmp/paket`, sonst liegt alles eine
  Ebene tiefer). `apply.sh` macht kein `cd` heraus.
- **Anker:** Python `str_replace` mit `count==1`. Marker codegebunden UND im
  Ersatztext (der Doppellauf prüft es). **Pfad-basiert routen, NICHT basename.**
- **Prüfstrecke vor JEDER Auslieferung:** `node --check` (ESM als `.mjs`) +
  **Doppellauf** (muss SKIP melden) + **echter Funktionslauf gegen das
  Anwendungsbeispiel des Dokuments** + Kettenprüfung (kommt der Wert an?) +
  **Funktionslauf jedes Zweigs, den der Patch neu freischaltet** +
  Struktur-Endprüfung (div/details-Balance, Klammern) + **Regression gegen
  Hüllhorst und Löhner Straße** + Rollback-Test (byte-identisch).
- **Beweisen statt behaupten:** echte Funktionen in node laufen lassen.
  Untestbares (OpenAI, echter Mailversand, Live-DNS/Certs, jsPDF-Darstellung)
  **ehrlich** als Staging-Abnahmepunkt kennzeichnen.
- **Server sauber — erst NACH dem Test:**
  ```
  find /opt/dealpilot -name "*.pre-v10*" -type f -print -delete
  ```
  (ohne `-maxdepth`, sonst wird das mb-Backend nicht erreicht). Entpackte
  Paket-Ordner ebenfalls wegräumen. `auto-save.js` bleibt untracked;
  `patchesold/` gehört dem Parallel-Chat.
- **scp im LOKALEN Terminal**, Ziel `/tmp`.

---

## ROLLOUT

### Mehrere Pakete auf Staging
1. Alle ZIPs hochladen, **beide** Datenbanken sichern
2. Alle auspacken, dann **der Reihe nach** `apply.sh` unter `set -e` — jedes
   prüft die Marker seines Vorgängers und bricht ab
3. **EIN Rebuild am Ende** genügt: das mb-Backend lädt seine Module aus dem
   Image, alle Pakete sind vorher im Arbeitsverzeichnis gelandet
4. Migration prüfen, Buster-Kette prüfen, **Strg+F5**
5. Erst nach dem Klicktest aufräumen

**Vor dem Commit die Marker MESSEN**, nicht annehmen:
```
for m in v1074-WAUS9 v1074-WBTL v1075-WAGS v1076-WLET …; do
  n=$(grep -rl "$m" marktbericht/backend/src frontend/marktbericht-app 2>/dev/null | wc -l)
  printf '%-14s %s Datei(en)\n' "$m" "$n"
done
```
Eine `0` heißt: das Paket lief nicht → **nicht committen.** Zusätzlich im
Container prüfen — „habs eingespielt" ist nicht dasselbe wie installiert:
```
docker exec dealpilot-mb-backend grep -c "<marker>" /app/src/<pfad>
```

### Standard-Deploy nach Prod (bewährt am 12.08.)
```
cd /opt/dealpilot
git status -s
git add -u; git add NEUE DATEIEN EINZELN (NIE -A/.)
git diff --cached --name-only     == GENAU meine Dateien
git diff --cached --name-only | grep -E 'auto-save|patchesold|\.pre-|docker-compose|Caddyfile'
git commit
git checkout main
git pull --ff-only                ← ZUERST, sonst sperrt der Merge fremde Arbeit aus
git rev-parse --short HEAD        ← ANKER NOTIEREN
git log --oneline main..staging   ← was kommt wirklich mit?
git diff main...staging --name-only | grep -i migration
git merge --no-ff staging -m "<Inhalt benennen, nicht nur die Nummer>"
git tag <name>                    ← je Arbeitsstrang ein Tag auf denselben Commit
git push origin main --tags
git checkout staging && git merge --ff-only main && git push
```

**Prod:**
```
ssh root@157.90.117.167
cd /opt/dealpilot
hostname                          == DealPilot-Prod-neu
git rev-parse --abbrev-ref HEAD   == main     (im Repo, nicht in ~!)
git status -s                     == sauber
git log --oneline -1              ← PROD-ANKER

docker exec dealpilot-postgres pg_dump -U dealpilot -d dealpilot_db | gzip > /root/backup-haupt-vor-<hash>.sql.gz
docker exec dealpilot-mb-db pg_dump -U mb -d marktbericht | gzip > /root/backup-mb-vor-<hash>.sql.gz
ls -lh /root/backup-*vor-<hash>.sql.gz     ← plausible Groesse? sonst STOPP

git fetch
git log HEAD..origin/main --oneline | head -8   ← gegenlesen
git pull --ff-only
grep -c "<marker>" <datei>        ← Inhaltspruefung VOR dem Rebuild
docker compose -f docker-compose.prod.yml up -d --build mb-backend backend
```

**Abnahme:** Marker im laufenden Container · beide Migrationstabellen
unverändert · `docker logs --tail 12` ohne Ausnahme · **Strg+F5** · Klicktest
(bei der Wertermittlung mit einer Adresse außerhalb NRW).
Caddyfile-Änderung: danach `docker exec dealpilot-caddy caddy validate` + reload.

**Rückweg:** `git reset --hard <Prod-Anker>` + Rebuild. Migrationen sind additiv
→ ein Code-Rollback braucht **kein** DB-Restore. Bei Datenänderung zusätzlich
`zcat /root/backup-mb-vor-<hash>.sql.gz | docker exec -i dealpilot-mb-db psql -U mb -d marktbericht`.
**Ein Code-Rollback vor v966 macht das Löschen wieder unmöglich, stellt aber
bereits gelöschte mb-Berichte NICHT wieder her** — dafür nur der mb-Dump.

---

## CHRONIK — DIE ROLLBACK-KETTE

**Haupt-App / Landing / Mobile (neueste zuerst):**
```
0a543d7  landing-promo-20260723   (Anker 2b7a131)  Cockpit-Intro, Hero-Video, ERSTFLUG 16 %
2b7a131  immo-cutover-20260721    (Anker 8cf82c5)  .immo-Domains, Mail-Sweep, Caddyfile
8cf82c5  beleg-import-20260721    (Anker 28a926f)  KI-Beleg-Import
28a926f  rollout-20260719         (Anker 7d2f0b9)  BMF v974–v994 + Voice v1000
7d2f0b9  rollout-20260718         (Anker 84d50a3)  QC-Ring, Mobile-Sperre, Verlauf, Analytics
3bc4998  marktbericht-20260718 · b11dd44 whitelabel-20260716 · f0a90a0/-b/-c/-d 0715er
84d50a3  v968 · 7e3f360 v941 · 9ab41ee rollout-20260714
ea33a6c  v899 (Bankexport)  ·  03d0d23 MA34  ·  16963c7 v898  ·  1c69fd2 MA33
b92686d  v851-landing (Anker 6729968) · 36f5fe0 v816 · d2fd84b v800 · 2fe05d7 v748 · 2a3b569 v734
Prod-Rollback NIE unter e43ce2d — darunter hängt der Microservice.
```

**Marktbericht-Strang:**
```
65ca0b0  marktbericht-v1082b-20260812 + marktbericht-v1145-20260812   (Anker 4ceb915)
ca9e101  marktbericht-v1076-20260803
21dc057  marktbericht-v1073-20260803
72b3189  verfahrenswahl-20260802 (v1061)
```

**DB-Backups auf Prod:** `/root/backup-pre-landing-promo.sql.gz` ·
`-pre-immo-cutover-20260721-1420.sql.gz` (6,7 MB) · `-pre-beleg-import.sql.gz` ·
`-pre-rollout-20260719.sql.gz` (6,5 MB) · `-pre-rollout-20260718.sql.gz` +
`backup-mb-pre-rollout-20260718.sql.gz` · `-pre-whitelabel-2026-07-16` ·
`-pre-v968` · `Caddyfile.pre-rollout-20260719` ·
`backup-haupt-/-mb-vor-<hash>.sql.gz` (12.08.).

**Erledigte Meilensteine, die nicht zurückgedreht werden:**
Web-Cutover auf `.immo` (alle vier Hosts HTTP 200, ACME-Certs) · Mail mit
DKIM `cloudpit` (dkim/spf/dmarc pass) · **Demo-Seed geschlossen**
(`SEED_DEMO_DATA=0` + `users.is_active=false` für `demo@dealpilot.local`) ·
Stripe LIVE seit 15.07. · Caddyfile repo-gepflegt.

---

## OFFENE PUNKTE

### v1083 — der nächste Bau
1. **Frischen Tarball ziehen.** Der vom 10.08. ist für vier Dateien überholt
   (`wertermittlung.js`, `nhk2010.js`, `CrossCheckService.js`,
   `ReportOrchestrator.js`).
2. **Register in `mb.param_modell`** — Datensätze aus den geernteten
   Ausschüssen, Seed aus einer versionierten Datei im Repo.
3. **`gmb-ernte.py` an die vorhandene Erntestrecke hängen**
   (`gaa_documents` → `param_modell`, Protokoll nach `param_lauf`).
4. **`gutachterausschuss.js` liest die Tabelle** statt seiner Konstanten.
5. **Herkunftsvermerk für die geschätzte Restnutzungsdauer.**
6. **`HF_STAND.lzs` und `bwk_2026` verdrahten** — Herford GMB 2026 nennt
   1,8 % ± 0,8 für ZFH (446 Fälle), gerechnet wird noch mit 1,7 % aus der
   Ernte 2024.
7. **Prüfstrecke:** gleiche RND in allen Verfahren, Regression Hüllhorst und
   Löhner Straße.

### Zu messen
- **Kostenkennwert gegen 904,26 €/m²** (Mix 49 % Stufe 2 / 51 % Stufe 3,
  Basisjahr 2010) — es fehlt die NHK-Zeile für ein Haus **ohne** Keller.
  Signatur `nhkKennwert(typ, kellerDg, stufe)`.
- **Baupreisindex 2,02 gegen die amtlichen 1,906** aus dem GMB Dortmund,
  dazu die fehlende Stichtagsfähigkeit.
- **`GND_TABELLE.geprueft` steht auf `false`** — Gewerbezeilen sind
  Arbeitsstand, stehen aber in Kundenberichten.
- **Lizenzangaben Hessen / MV / Berlin** im `boris/registry.js`, alle
  `verified: false`.
- **Stammdatenfeld „Garten" gegen das Hinterlandfeld** — stehen nebeneinander.
- **Prod-Klicktest** mit einer Adresse außerhalb NRW
  (`land_value.source`, `fallback_von`, `quellenvermerk`).

### Ernte — Stand und Fläche
**21 Ausschüsse erfasst**, davon 13 am Original-PDF belegt: Bochum · Dortmund ·
Düsseldorf · Duisburg · Essen · Höxter · Iserlohn · Märkischer Kreis ·
Kreis Lippe · Kreis Paderborn · Bielefeld · Lüdenscheid · Rhein-Erft — dazu
Herford und Minden-Lübbecke aus früheren Paketen. Nur aus der Netz-Ernte:
Stadt Paderborn. **Nicht belegbar:** Gütersloh und Köln (keine feste Adresse,
nur über den BORIS-Downloadbereich).
Vollständige Daten: `claude/v1083-ernte-owl-ruhr.md` ·
`claude/v1083-ernte-rheinschiene.md` · `claude/v1083-ernte-fuenf-staedte.md` ·
`claude/v1083-ernte-hoexter-iserlohn-mk.md` ·
`claude/wettbewerb-sachwertfaktor-20260810.md`

**Nächster Ausbauschritt nach Aufwand pro Einwohner:** Berlin, Hamburg, Bremen
und Sachsen-Anhalt — zusammen fünf Ausschüsse für vier Bundesländer, alle
kostenfrei. Danach NRW fertig. Rheinland-Pfalz wäre ein Bundesland für 150 €.

### Wertermittlung, nach Wirkung
1. **Lüdenscheid in den Auflöser** (Potenzfunktion).
2. **Sachwertfaktoren für weitere NRW-Kreise** — 73 Ausschüsse, alle frei; der
   Herford-Pfad ist das belegte Muster.
3. **`mb.valuation_inputs` wird nicht beschrieben** → Berichte nicht
   reproduzierbar.
4. **Ist-Miete-Gegenüberstellung** § 31 Abs. 2 mit Abschlag nach § 8.
5. **RND-Tabellen des NRW-Modells** für GND 70, 60, 50, 40.
6. **MFH-Sachwert** (vertagt; Spezifikation liegt vor: `NHK_MFH_2010`
   825/985/1190 · 765/915/1105 · 755/900/1090, Wohnungsgrößenfaktor
   35 = 1,10 / 50 = 1,00 / 135 = 0,85 linear, Grundriss 1,05/1,00/0,97/0,95,
   GND 80 J, MEA-Bruch, BGF nur direkt, fehlende Felder → KEIN Sachwert; eigene
   Datei neben dem CrossCheckService). Der Sachwert-ETW-Text „nicht anwendbar"
   ist eine **Implementierungsgrenze**, keine ImmoWertV-Aussage.
7. **BOG/Wohnrecht-Modul** (Leibrentenmethode, Sterbetafel) — Feature-Lücke.

### Open Data
- **Auf Produktion liegen KEINE Open-Data-Sätze.**
  `select count(*) from mb.param_werte where quelle_parser='p1-imbde'` = 0.
  Die 28.827 Sätze existieren nur auf Staging (davon 6.060 benannt, 22.767 offen).
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
- `.pre-v10*`-Dateien auf Staging
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
Willkommens-Mail · Whitelabel-Domain vor dem Login (der Gate-Screen kennt den
Reseller noch nicht) · Abrechnung-Tab · Reseller-Self-Serve-Onboarding ·
Benachrichtigungen · erster Pool-Kauf als Staffel-Test ·
SPF/DKIM/DMARC für `junker-immobilien.io` · DATEV EXTF (braucht den Deal Tracker
zuerst) · **Deal Tracker** (`ledger_entries`, `typ CHECK`
ertrag/aufwand/zins/tilgung/aktivierung) **und Ankauf-Widget** (Feature-Lücke
gegenüber ImmoAnalyse.Pro) · Portfolio-Pass · Bestands-PDF · Co-Pilot-Tab
(Design + Backend-Chat-Endpunkt, rate-limited je Plan, kein Kerosin, günstigeres
Modell) · ImmoMetrica-Vollintegration · NeuRIS ·
Forschungszulage (FZulG, Borchard/OneVoice, 2026–2028, ~105.840 €, 35 % KMU,
70 €/h Eigenleistungspauschale) · Pflichtdokumente v2 ·
Mitgabe-Expansion (`.dpkt`) · immocation-Print-File · DPMA (Wort + Bild) ·
UG → GmbH · SSoT `pricing-modal` + Landing aus `config.js` ·
Bundesbank-406 bei Live-Marktzinsen · Kommunale Wärmeplanung ·
Stripe-Webhook prüfen/reaktivieren · DB-Passwort-Rotation · Server-Upgrade ·
„PDF beim Export frisch rechnen" (offscreen-iframe wie MA27, gegen den
KPI-Freeze) · Altobjekte ohne `kaufdat` einmal öffnen + speichern

---

## DIE TESTOBJEKTE

| | |
|---|---|
| **Hüllhorst** — Hermannstraße 9, 32609, ETW 165 m², Bj 1968, 2 WE | Kreis Minden-Lübbecke. **Regression:** Sachwert 305.937 / 348.687 €, Zinsanpassung 2,56 %, amtliche Miete 4,83 €/m², Vergleichsfaktor 239.250 € |
| **Löhner Straße 278**, 32120 Hiddenhausen, ZFH 233 m², Bj 1964 | Kreis Herford (AGS 05758016). **Maßstab:** Verkehrswertgutachten 350.094,36 €, BGF 346,62 m², Bodenwert 144.840 €. **Regression seit v1076** (Klicktest-Eingaben: Gewerke-Mix gewogene Stufe 2,72, Bauteile 95.000 €, Garage 64,58 m², Außen 7 %, Hinterland 828 m² × 30 €, RND 18): vorläufiger Sachwert 326.649 € × **SWF 0,889 Stufe A** (Tabelle 0,899, kRnd −0,01, kBgf 0) = **290.391 €** marktangepasst. Marcels 0,91 war eigene Angabe (Stufe E). |

**Achtung bei den Sollwerten:** Sie sind unter der Restnutzungsdauer 18
entstanden — also ohne erfassten Modernisierungsgrad. Sobald der
Herkunftsvermerk gebaut ist und der Klicktest mit Modernisierungspunkten läuft,
ändern sich beide Regressionswerte und müssen neu festgelegt und gegen das
Gutachten abgenommen werden.

**Beide gehören in jede Prüfstrecke, die den Rechenkern anfasst.**

---

## KEY-LEARNINGS — DIE KURZFASSUNG

- **Erst messen, dann bauen.** Marker-Übersicht als erster Befehl; die Landkarte
  selbst aufnehmen; keiner Übergabe glauben.
- **Der Sollwert kommt aus dem Dokument** — inklusive Rundung. Wo keiner steht:
  Monotonie über die ganze Tabelle **und** Nachzählen.
- **Große Pakete, ein `apply.sh`, Installationsbefehle ungefragt, Server sauber.**
- **Staging-first. Nur eigene Dateien einzeln stagen. Vor dem Merge
  `git pull --ff-only`, vor dem Prod-Pull `git fetch` + gegenlesen.**
- **Die Kette prüfen, nicht die Funktion** — aber erst messen, bevor ein Befund
  behauptet wird.
- **Jede Zahl trägt ihre Herkunft** (Stufe A–E, Modellvermerk, Ausschuss,
  Stichtag). **Kein Verfahren rechnet halb. Ein stiller Rückfall ist schlimmer
  als ein Fehler.**
- **Rechenkerne nie duplizieren:** DSCR, KPI, Score, Sachwertfaktor-Auflöser,
  `swf_modelle.js`.
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
| 12.08. | **Diese Konsolidierung** — Teil VI, zwei Korrekturen (`style.css`, Handy-Sperre), sechs Regeln | `1a76b38` | Server auf `1a76b38` per `git rev-parse` gegengeprüft; Skript brach wie dokumentiert in Z. 68 ab, Pull von Hand nachgezogen | drei Aufräum-Befunde im Backlog unter „Später" |
| 12.08. | Übergabe: Einstiegspunkt im Backlog, vier neue Fallen | `6a11a32` | — (Dokumentation) | — |
| 12.08. | Ankreuzfelder auf 33 px | `674c3b0` → `413d409` | Selektor korrigiert; `#app` existiert nicht | Abnahme mit geladenem Objekt offen |
| 12.08. | `boris`: alle 16 Länder über verifizierte Landesdienste (v1077–v1082b) | `e35e34b` · Merge `65ca0b0` | 319 Server-Zeilen ins Repo eingesammelt | — |
| 11.08. | Prod-Rollout Wertermittlung + Objekt-Reiter | `e682367` → `51958c6` | Prod-Abnahme vermerkt (`4ceb915`) | — |

*(Ältere Rollouts: siehe „CHRONIK — DIE ROLLBACK-KETTE" in Teil V.)*





