# Backlog

**Reihenfolge = Priorität.** Der oberste offene Punkt wird bearbeitet.

Nach Abschluss wandert ein Punkt nach unten unter **Fertig**, mit Datum und
Commit-Hash. Hängt etwas, kommt `**BLOCKIERT:**` mit einem Satz Begründung
direkt unter den Punkt — nicht kommentarlos liegenlassen.

**Vorlagen und Bilder:** `design/` (Mockups, Logos). Siehe `design/README.md`.

---

## Jetzt — Handy und Tablet zum Laufen bringen

Ziel des Blocks: die **bestehende** Oberfläche auf Telefon und Tablet
bedienbar machen — **alle Seiten, alle Tabs, alle Bereiche.** Losgelöst von
der MA-Reihe und `mobile-demo.html`, die bleiben unberührt.

Zum Testen: `https://app.staging.dealpilot.immo/?nomobileblock`
(in der Geräteemulation gilt der Browser als `pointer:coarse`, sonst legt sich
das Handy-Overlay drüber). Die Sperre selbst wird **nicht** angefasst.

Prüfgrößen durchgehend: **390 px** (Handy), **820 px** (Tablet hoch),
**1024 px** (Tablet quer).

---

### 2 · Aktionen-Akkordeon klappt in die falsche Richtung

`ui.js:1582` trägt den Kommentar „klappt NACH OBEN aus", der Trigger zeigt ▲ —
das Verhalten widerspricht dem. Kommentare sind kein `getBoundingClientRect`.

**Fertig, wenn:** Das Menü öffnet nach oben, steht vollständig im Bild, ist
scrollbar wenn es länger als der Schirm ist, und schließt bei Objektwahl.

---

### 3 · Objektliste auf dem Tablet erreichbar machen

Im Band **769–900 px** liegt die Sidebar `position:fixed` bei `left:-280px`
und wird ausschließlich über `.sidebar.open` geöffnet — eine Klasse, die **kein
Code setzt**. iPad im Hochformat sind 810–834 px, also mitten drin.

Vier Umschalt-Mechaniken nebeneinander:

| Klasse | Ausgelöst von | Status |
|---|---|---|
| `.sidebar.open` | niemandem | toter CSS-Code |
| `.app-wrap.sb-mobile-open` | `main.js:230` | der richtige |
| `.sidebar.sb-mobile-open` | `ui.js:1712` | falsches Element |
| `.sidebar.mobile-open` | Inline-`onclick`, `index.html:607` | Knopf nie sichtbar |

Auf **eine** reduzieren. Bei ≤768 px gibt es bereits einen
Vereinheitlichungs-Block mit dem Kommentar „EIN einheitlicher Drawer" — daran
anschließen, nicht neu erfinden.

**Achtung:** Bei 901–1024 px steht die Leiste heute als feste Spalte. Das ist
auf dem iPad quer richtig und soll **so bleiben** — nur 769–900 wird repariert.

`.mobile-overlay` ist nur bis 768 px gestylt und braucht im neuen Band Regeln.

**Fertig, wenn:** Bei 820 px öffnet und schließt die Liste zuverlässig,
mehrfach hintereinander, und beim Drehen auf 1024 px steht wieder die Spalte.

---

### 4 · Kopfleiste auf dem Handy entlasten

Die Kopfleiste trägt zu viel für 390 px.

- Kürzel-Chip (`.hdr-obj-num`) und Feldanzeige (`.hdr-completeness`) raus
- Feldfortschritt bekommt eine eigene schmale Zeile darunter
- Kerosin bleibt, aber nur als Zahl ohne Balken
- **Investor Deal Score darf auf dem Handy raus.** Wenn die Anzeige in
  `#hdr-badges` den Platz sprengt, auf ≤768 px ausblenden — die Zahl steht
  ohnehin auf jeder Objektkarte und im Tab „Bewertung". Auf Tablet bleibt sie.
- Autosave-Anzeige auf den Punkt reduzieren, Text weg

**Fertig, wenn:** Bei 390 px passt die Kopfleiste in eine Zeile und der
Objektname ist lesbar.

---

### 5 · Alle neun Objekt-Tabs handytauglich

Objekt · Investition · Miete · Finanzierung · Bewirtschaftung · Steuer ·
Pilot-Analyse · Bewertung · Deal-Aktion.

- Formulare auf eine Spalte, außer kurze Paare wie PLZ/Ort
- **Eingabefelder auf 16 px** — darunter zoomt iOS Safari beim Antippen hinein
- Trefferflächen mindestens 44 px, jedes `:hover` braucht ein `:active`
- Tabs scrollen mit Snap; neun Reiter passen nicht nebeneinander →
  Raster-Übersicht als Ausweg (`design/mockups/dp-handy-mockup-v2.html`)
- Tabellen, Diagramme und breite Kacheln dürfen nicht seitlich überlaufen
- Aufklappbereiche und Modals müssen ins Bild passen und scrollen können

**Tab für Tab prüfen, nicht stichprobenartig.** Jeder erledigte Tab wird hier
namentlich vermerkt.

**Fertig, wenn:** Jede der neun Seiten bei 390 px ohne waagerechtes Scrollen
bedienbar ist und kein Eingabefeld beim Antippen hineinzoomt.

---

### 6 · Portfolio-Cockpit auf Handy und Tablet

Eigene Ansicht mit eigenen Kacheln, Tabellen und Diagrammen — von den
Tab-Regeln nicht miterfasst.

- Kacheln untereinander statt nebeneinander
- Tabellen entweder waagerecht scrollbar **mit sichtbarem Hinweis** oder als
  Kartenliste umbrechen
- Diagramme skalieren mit, keine feste Pixelbreite
- Filter und Sortierung erreichbar, nicht abgeschnitten

**Fertig, wenn:** Bei 390 px und 820 px vollständig lesbar und bedienbar.

---

### 7 · Marktbericht auf Handy und Tablet

Eigene Anwendung unter `frontend/marktbericht-app/` mit eigenem CSS.
**Eigener Namensraum `vNNN` (Marktbericht) — nicht mit der Haupt-App mischen.**

- Eingabestrecke und Objektwahl bedienbar
- Karten (Leaflet) auf Touch bedienbar, Zoom ohne Konflikt mit dem Seitenscroll
- Diagramme (Chart.js) skalieren mit
- PDF-Erzeugung auslösbar, Ergebnis erreichbar
- Klappblöcke aus v1075/v1076 auf schmalem Schirm prüfen

**Achtung:** `var()` greift nicht in Leaflet und jsPDF — dort stehen feste
Werte, die beim Umbau nicht verlorengehen dürfen.

**Fertig, wenn:** Ein vollständiger Marktbericht bei 390 px erzeugt und
angesehen werden kann.

---

### 8 · Übrige Seiten und Bereiche

Alles, was nicht Objekt-Tab, Cockpit oder Marktbericht ist:

- Einstellungen (alle Abschnitte, das Modal selbst)
- Alle Objekte (Karten-, Listen-, Kanban-Ansicht)
- Quick Boarding / Quick Check
- Track Record
- Datenraum
- Netzwerk (siehe Punkt 9)
- Anmeldung, Registrierung, Passwort vergessen
- Preise und Upgrade-Fenster
- Rechtliches (Impressum, Datenschutz, AGB)
- Reseller-Portal

**Fertig, wenn:** Jede Seite bei 390 px erreichbar, lesbar und bedienbar ist.

---

## Fehler

### 9 · Partner-Netzwerk lädt nicht

**Zuerst Diagnose, kein Umbau.** Ursache ist unbekannt.

Beteiligt: `frontend/js/netzwerk-einreichung.js` (in `index.html:2993`),
`backend/src/routes/network.js`, `services/networkCardsService.js`,
Migrationen 049–054.

Zu klären, in dieser Reihenfolge:
1. Kommt in der Browser-Konsole ein Fehler? Welcher?
2. Wird die API überhaupt gerufen? Netzwerk-Tab: Status, Antwortkörper
3. Antwortet das Backend 401, 403, 404 oder 500?
4. Bei 403: greift eine Plan-Schranke? **Unbekannter Feature-Schlüssel ist für
   jeden `false`, auch für Pro** — häufiger Fall
5. Bei 500: Serverprotokoll ansehen
6. Sind die Netzwerk-Tabellen auf Staging überhaupt migriert?

**Erst wenn die Ursache benannt ist, wird gebaut.** Befund hier eintragen.

**Fertig, wenn:** Das Netzwerk lädt auf Desktop und Handy, mit Nachweis was es
war.

---

## Als Nächstes — die neue Darstellung

Vorlage: `design/mockups/dp-darstellung-panel.html` — der abgenommene
Zielzustand. Nicht danebenbauen, dagegen bauen.

---

### 10 · Darstellungs-Modal mit festen UI-Vorlagen

**Das Kernstück.** Heute ist die Oberfläche B2C-Optik: Obsidian, Gold,
Leuchten, Verläufe. Ein Berater, der sie vor dem Mandanten öffnet, braucht
etwas Ruhigeres. Deshalb **fünf bis sechs fertige Vorlagen** zur Auswahl —
nicht einzelne Schalter, die man selbst zusammenstellen muss.

**Wo:** Einstellungen → Profil & Anzeige → „Darstellung öffnen". Das
Einstellungsfenster schließt, das Darstellungs-Modal geht auf. Dort die
Vorlagen zur Auswahl, darunter die Farbeinstellungen.

**Eine Vorlage stellt gemeinsam um:**
- Kopfleiste (Farbe, Höhe, Radien, welche Anzeigen sichtbar sind)
- Seitenleiste und Aktionen-Menü
- Objektkarten-Modus
- Logo-Variante (hell / dunkel / nur Bildmarke)
- Radien, Schatten, Randstärken, Typografie

**Vorschlag für die Vorlagen** — Namen und Zuschnitt vor der Umsetzung
abstimmen:

| Vorlage | Charakter | Für wen |
|---|---|---|
| **DealPilot** | Obsidian & Gold, wie heute | Standard, niemand muss umstellen |
| **Kontor** | Reinweiß, Haarlinien, kein Radius, kein Schatten | maximale Ruhe, viele Objekte |
| **Panel** | Kühles Grau-Weiß, weiche Radien, feiner Schatten | neutralster Untergrund fürs Whitelabel |
| **Kanzlei** | Hell mit Serife, viel Weißraum, Panels ohne Rahmen | Berater vor dem Mandanten |
| **Boarding** | Creme, Markenstreifen, Ticket-Karten | markentreu, aber hell |
| **Konsole** | Dicht, Monospace, ohne Fotos | Bestandshalter mit 40+ Objekten |

**Darüber liegen die Farbeinstellungen:** Akzent, Obsidian/Grundfarbe,
Mail-Akzent. Jede Vorlage lässt sich damit an das Branding des Partners
anpassen — die Vorlage bestimmt die **Form**, die Farbe kommt vom Partner.

**Zwingend:**
- `dealpilot` trägt **kein** Attribut → wer nicht umschaltet, bekommt die App
  bitgenau wie heute
- Gold bleibt `var(--gold)`, damit Whitelabel weiter mitfärbt
- Statusfarben Grün `#3FA56C` und Rot `#B8625C` werden nie angefasst
- Die Wahl bleibt gespeichert und überlebt das Neuladen

**Teuer bezahlt, steht auch in CLAUDE.md:** Token zu überschreiben reicht
**nicht**. `--surface`, `--border`, `--muted` landen korrekt, werden von der
dunklen Fassung aber nicht benutzt. Kopfleiste, Tabs und Sidebar hängen an
später gesetzten, harten Regeln. Jede farbtragende Fläche muss **einzeln
benannt** werden — rund 51 Selektoren, die Liste steckt im vorhandenen
Hell-Skin `body.dp-chrome-hell`.

**Vorlage:** `design/mockups/dp-darstellung-panel.html` — Panel rechts, App
links live. Genau dieses Verhalten ist gemeint.

**Fertig, wenn:** Alle Vorlagen wirken auf Kopfleiste, Tabs, Sidebar,
Objektkarten und Logo, die Farbeinstellungen greifen darüber,
`gold-audit.py` gibt RC=0, und nirgends steht heller Text auf hellem Grund.

---

### 11 · Aktionen-Menü gliedern

Gehört zu jeder hellen Vorlage, betrifft aber alle: das Menü ist heute eine
lange Liste. Gruppieren nach **Ansichten · Analyse · Anlegen · Ausgeben ·
System**.

Plan-Schranken sichtbar markieren statt verstecken — die `data-feature`-Marker
(`track_record_pdf`, `bank_pdf_a3`, `export_csv`) stehen bereits im Markup.
Kerosin-Kosten am Eintrag anzeigen, wo welche anfallen (Marktbericht).

**Fertig, wenn:** Das Menü ist gegliedert, Schranken sind erkennbar, und es
funktioniert auf Desktop, Tablet und Handy.

---

### 12 · Objektkarten-Modi: Kompakt · Standard · Wallet

Ein Markup, drei Optiken, **reines CSS**. Die gemessene Struktur von
`_renderRichCard` (`storage.js:866`) steht in CLAUDE.md — nicht neu raten.

Wallet: Kopfzeile im Markenverlauf, Score-Ring links, Stufen-Pille rechts.
Der Ring ist der vorhandene SVG mit berechnetem `stroke-dasharray`.

**Falle:** `align-items:center` lässt ein leeres `::before` auf null Höhe
schrumpfen — das Goldband wäre unsichtbar. `align-self:stretch` ist Pflicht.

**Fertig, wenn:** Alle drei Modi in allen drei Fassungen sauber aussehen, auf
Desktop, Tablet und Handy.

---

### 13 · Kartenfläche: Passend · Weiß

Karten folgen der Fassung oder bleiben weiß, auch im dunklen Modus.

**Falle:** Bei gleicher Spezifität gewinnt die spätere Regel. Über `html[...]`
scopen statt auf Ladereihenfolge bauen.

---

### 14 · Zugang zum Darstellungs-Modal und Plan-Schranken

Modal für **alle** Pläne öffnen, den **Farbteil darin** sperren. Heute bricht
der Wrapper in `settings.js:3391` bei `currentKey() !== 'partner'` das ganze
Panel ab — die Prüfung wandert von „Panel öffnen" auf „Farbsektion
freischalten".

Damit gilt: **Vorlagen wählen darf jeder**, **Farben ändern erst ab Partner.**
Die Farbsektion bleibt für andere sichtbar, aber ausgegraut — sichtbar
gesperrt ist ehrlicher als versteckt.

Farben laufen weiter über `DealPilotBrandingEditor.open()` und
`DealPilotWhitelabel.apply({accent, obsidian})`.

In den Einstellungen bleibt nur Verwaltung: der Knopf, das Häkchen
„Handy & Tablet freischalten", der Partner-Block „Für Mandanten".

**Offene Entscheidung:** Der Skin-Schalter Hell/Obsidian existiert bereits
separat. Entweder er verschwindet, oder er wird an die Darstellung gekoppelt.
Sonst laufen beide auseinander.

---

### 15 · Kleineres Logo für die helle Fassung

Das heutige Logo ist für die dunkle Leiste gebaut. In Kontor und Panel braucht
es eine kompaktere, helle Variante.

Dateien in `design/logo/`, Auswahl über die Fassung.

**Fertig, wenn:** In jeder der drei Fassungen sitzt das passende Logo, ohne
Verzerrung, auch bei eingeklappter Leiste und auf dem Handy.

---

### 16 · Handy-Sperre plan-abhängig lösen

Erst wenn 1–8 stehen. Die Sperre (`js/mobile-redirect.js`) bleibt bis dahin
**aktiv**.

Freigabe ab Partner-Plan, gilt auch für dessen Mandanten. Der Haken: die Sperre
prüft beim Laden, der Plan kommt erst mit `dp:plan-ready`. Lösung: aus dem
gecachten `dp_last_plan` entscheiden, dann `_dpMobileBlock.evaluate()` bei
`dp:plan-ready` erneut rufen — der Korrekturpfad ist vorhanden. **Immer erst
sperren, dann freigeben, nie umgekehrt.**

**Fertig, wenn:** Partner sieht auf dem Telefon die Hauptansicht, alle anderen
weiterhin den Hinweis, und beim ersten Login auf einem neuen Gerät blitzt
nichts Falsches auf.

---

## Später

- **Tablet-Fassung feinziehen** — Drawer, zweispaltige Formulare,
  Aktionen als Popover statt Blatt von unten
- **Vier Umschalt-Mechaniken endgültig aufräumen** — toter `.sidebar.open`-Code
  raus, Inline-Handler weg, eine Funktion
- **Widersprüchliche Regeln in den ≤768-Blöcken** — `.sb-list` trägt
  `height:40vh !important` **und** `height:0 !important`, die letzte gewinnt
- **Media-Queries konsolidieren** — 226 Blöcke auf 25 Breakpoints. Eigenes
  Vorhaben mit eigener Prüfstrecke, nicht nebenbei
- **Admin-Oberfläche** auf Tablet prüfen

---

## Fertig

<!-- Format:  - [YYYY-MM-DD] Punkt — Commit-Hash -->

- [2026-08-04] **1 · Sidebar-Fußzeile auf dem Handy sichtbar machen** — `159f6c0`

  **Befund (gemessen, beide Verdachtsmomente widerlegt):** `#sb-user` wird
  sauber gerendert, `[V245]` meldet Erfolg — der Abbruchpfad in `auth.js:495`
  war es nicht. Die Liste war seit v639 bereits auf `40vh` gedeckelt und
  scrollte selbst — das `overflow:visible` aus v622 greift also nicht mehr.

  Die Ursache lag darüber: über dem Nutzerblock stehen ausschließlich **feste
  Höhen** — `.sb-header` 201 px + `.sb-section-title` 64 px +
  `.sb-actions-trigger` 36 px + `#sb-user` 81 px = 382 px, dazu die Liste mit
  40 vh. Bedingung fürs Hineinpassen: `0,4·vh + 382 ≤ vh`, also **vh ≥ 637 px**.
  Gemessen bei 390 px Breite: 696 px sichtbar · 660 px 3 px ab · 616 px 29 px
  ab · 556 px 65 px ab. Genau der iPhone-Safari-Bereich — auf dem Desktop mit
  844 px Höhe war nie etwas zu sehen.

  **Fix (v645, `style.css` W38→W39):** Die Liste bekommt den Restplatz
  (`flex:1 1 auto`, `min-height:72px`) statt der festen 40 vh, Trigger und
  Nutzerblock werden unten verankert und dürfen nicht schrumpfen. Nur ≤ 768 px
  und nur im geöffneten Drawer.

  **Nachgemessen auf Staging (W39):** bei 844/700/664/620/560/476 px Höhe
  durchgehend `abgeschnitten = 0 px`, Abmelden per `elementFromPoint`
  getroffen, Liste scrollt in sich. Tablet 820 px und Desktop 1024/1200 px
  unverändert.

  **Offen daneben:** Trefferfläche der Icon-Knöpfe ist 34 × 44 px — die Breite
  liegt unter den 44 px aus Punkt 5, gehört dorthin. Der Logo-Header frisst mit
  201 px weiter ein Drittel des Handy-Viewports (Optik, nicht angefasst).
