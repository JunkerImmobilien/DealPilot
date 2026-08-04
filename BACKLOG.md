# Backlog

**Reihenfolge = Priorität.** Der oberste offene Punkt wird bearbeitet.

Nach Abschluss wandert ein Punkt nach unten unter **Fertig**, mit Datum,
Commit-Hash und dem **Befund** — was war die Ursache, was wurde gemessen.
Dort **ohne** Nummer: Nummern sind Reihenfolge, kein Name. Die verbleibenden
Punkte werden fortlaufend neu durchnummeriert. Hängt etwas, kommt `**BLOCKIERT:**` mit einem Satz Begründung
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




### 1 · Marktbericht auf Handy und Tablet

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

### 2 · Übrige Seiten und Bereiche

Alles, was nicht Objekt-Tab, Cockpit oder Marktbericht ist:

- Einstellungen (alle Abschnitte, das Modal selbst)
- Alle Objekte (Karten-, Listen-, Kanban-Ansicht)
- Quick Boarding / Quick Check
- Track Record
- Datenraum
- Netzwerk (siehe Punkt 3)
- Anmeldung, Registrierung, Passwort vergessen
- Preise und Upgrade-Fenster
- Rechtliches (Impressum, Datenschutz, AGB)
- Reseller-Portal

**Fertig, wenn:** Jede Seite bei 390 px erreichbar, lesbar und bedienbar ist.

---

## Fehler

### 3 · Partner-Netzwerk lädt nicht

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

### 4 · Darstellungs-Modal mit festen UI-Vorlagen

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

### 5 · Aktionen-Menü gliedern

Gehört zu jeder hellen Vorlage, betrifft aber alle: das Menü ist heute eine
lange Liste. Gruppieren nach **Ansichten · Analyse · Anlegen · Ausgeben ·
System**.

Plan-Schranken sichtbar markieren statt verstecken — die `data-feature`-Marker
(`track_record_pdf`, `bank_pdf_a3`, `export_csv`) stehen bereits im Markup.
Kerosin-Kosten am Eintrag anzeigen, wo welche anfallen (Marktbericht).

**Fertig, wenn:** Das Menü ist gegliedert, Schranken sind erkennbar, und es
funktioniert auf Desktop, Tablet und Handy.

---

### 6 · Objektkarten-Modi: Kompakt · Standard · Wallet

Ein Markup, drei Optiken, **reines CSS**. Die gemessene Struktur von
`_renderRichCard` (`storage.js:866`) steht in CLAUDE.md — nicht neu raten.

Wallet: Kopfzeile im Markenverlauf, Score-Ring links, Stufen-Pille rechts.
Der Ring ist der vorhandene SVG mit berechnetem `stroke-dasharray`.

**Falle:** `align-items:center` lässt ein leeres `::before` auf null Höhe
schrumpfen — das Goldband wäre unsichtbar. `align-self:stretch` ist Pflicht.

**Fertig, wenn:** Alle drei Modi in allen drei Fassungen sauber aussehen, auf
Desktop, Tablet und Handy.

---

### 7 · Kartenfläche: Passend · Weiß

Karten folgen der Fassung oder bleiben weiß, auch im dunklen Modus.

**Falle:** Bei gleicher Spezifität gewinnt die spätere Regel. Über `html[...]`
scopen statt auf Ladereihenfolge bauen.

---

### 8 · Zugang zum Darstellungs-Modal und Plan-Schranken

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

### 9 · Handy-Sperre plan-abhängig lösen

Erst wenn 1–2 stehen. Die Sperre (`js/mobile-redirect.js`) bleibt bis dahin
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
- ~~**Vier Umschalt-Mechaniken endgültig aufräumen**~~ — in v648 miterledigt
- **Widersprüchliche Regeln in den ≤768-Blöcken** — `.sb-list` trägt
  `height:40vh !important` **und** `height:0 !important`, die letzte gewinnt
- **Media-Queries konsolidieren** — 226 Blöcke auf 25 Breakpoints. Eigenes
  Vorhaben mit eigener Prüfstrecke, nicht nebenbei
- **Admin-Oberfläche** auf Tablet prüfen

---

## Fertig

<!-- Format:  - [YYYY-MM-DD] Punkt — Commit-Hash -->

- [2026-08-04] **Sidebar-Fußzeile auf dem Handy sichtbar machen** — `159f6c0`

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
  liegt unter den 44 px aus Punkt 2, gehört dorthin. Der Logo-Header frisst mit
  201 px weiter ein Drittel des Handy-Viewports (Optik, nicht angefasst).

- [2026-08-04] **Neues Logo einsetzen, altes entfernen** — `7a86e7b`, `56a9c04`

  **Befund (gemessen, nicht angenommen):** Der Logo-Kopf war **207 px** bei
  390 px Viewport und **221 px** auf dem Desktop. Zwei Ursachen: das alte PNG
  hat Seitenverhältnis **2,18 : 1**, und `.app-logo-simple-sidebar` stand auf
  `width:100%` ohne Deckel (v931/v932/v937, alle mit `!important`) — das Logo
  wuchs also mit jeder Leistenbreite und riss den Kopf mit hoch.

  Zweiter Befund, beim Prüfen aufgefallen: `settings.js:3309` (v931)
  **überschreibt** `_dpDispSkin` aus `:3104` und lässt den Logo-Tausch bewusst
  weg („KEIN Logo-Tausch mehr"). Mit dem neuen Rahmen-Logo geht das nicht mehr
  — dessen Wortmarke „Deal" ist **weiß**, auf hellem Grund wäre die halbe
  Marke unsichtbar.

  **Fix (v646, `style.css` W39→W40, `settings.js` W20→W22, `config.js` TR7→TR8):**
  Neue Dateien `assets/dealpilot-logo-rahmen.png` (dunkler Grund) und
  `assets/dealpilot-logo-rahmen-hell.png` (heller Grund), Seitenverhältnis
  **3,18 : 1**. Dazu ein Breitendeckel (232 px Desktop · 220 px ≤ 900 px ·
  176 px bei ≤ 620 px Höhe) — der hält nebenbei das 512-px-Asset auf ≥ 2× für
  Retina. Spezifität `body:not(.dp-sidebar-collapsed) aside.sidebar#sidebar`,
  damit die späteren `!important`-Blöcke nicht gewinnen; die eingeklappte
  Leiste ist ausgenommen und behält die DP-Bildmarke aus v610.

  Der Logo-Tausch entscheidet jetzt **nach gemessener Hintergrundhelligkeit**
  (`getComputedStyle` die Elternkette hoch bis zur ersten deckenden Farbe)
  statt nach Klassen — greift damit auch bei frei gewählter Kopfleistenfarbe.
  Eigenes Upload-Logo und Whitelabel-Logo bleiben unangetastet.

  **Nachgemessen auf Staging (W40):** `.sb-header` 390 px → **87 px**
  (vorher 207), 820 px → **84 px**, 1024 px → **88 px**, 390 × 556 px →
  **65 px** und Nutzerblock weiterhin `abgeschnitten = 0 px`. Objektliste
  wächst bei 390 px von 439 auf **559 px**. Eingeklappt unverändert
  (Logo `display:none`, DP-Badge da, Leiste 66 px). Heller Kopf lädt
  `-hell.png`, dunkler `-rahmen.png` — beides im Browser geprüft.

  Alte Dateien `dealpilot-logo-app.png` und `dealpilot-logo-app-light.png`
  entfernt; es verwiesen nur noch zwei Kommentare darauf.
  `dealpilot-logo.png` (Landing, PDFs) unangetastet.

- [2026-08-04] **Aktionen-Akkordeon klappt in die falsche Richtung** — `983d681`, `69996ee`

  **Befund — der Verdacht war falsch, ich nehme ihn ausdrücklich zurück.**
  Gemessen bei 390 × 844 mit offenem Drawer: das Panel klappt sehr wohl
  **nach oben** — `top 58`, Inhalt bis `591`, Trigger erst bei `709`.
  Ebenso bei 820 px und auf dem Desktop (1400 × 730 und 1400 × 520). Der
  Pfeil dreht sich auch bereits (`[aria-expanded="true"] → rotate(180deg)`,
  `style.css:11599`). Das hatten v642/v644 schon erledigt, nur stand es
  nicht im Backlog.

  **Der echte Fehler lag darunter:** eine **114 px hohe Totzone** zwischen
  dem Ende des sichtbaren Menüs (591) und dem Ende des Kastens (705).
  `elementFromPoint(180, 621)` lieferte dort `#sb-actions-accordion` statt
  der Objektliste. Klicks versandeten, und das Menü schloss dabei nicht
  einmal — `_sbActionsOutsideClick` überspringt alles, was in `acc` liegt.

  **Ursache:** `sbActionsToggle()` setzte `bottom` inline **mit
  `important`** (V73-fix). Inline-`!important` schlägt jede
  Stylesheet-Regel, also auch das `bottom:auto !important` aus v642, das im
  Drawer den Fixed-Overlay-Modus herstellt. Damit galten gleichzeitig
  `top:58px` **und** `bottom:139,5px` auf einem `fixed`-Element mit
  `height:auto` → Box auf 647 px gestreckt, Inhalt 533 px.

  **Zweiter Befund:** der CSS-Deckel `calc(100dvh - 58px - 110px)` ist
  geraten. Bei 390 × 556 endete das Menü bei 446 px, der Trigger begann
  aber schon bei 409 px — 37 px Überlappung.

  **Fix (v647, `ui.js` 972b→973b):** Neues `_sbActionsDock()` entscheidet
  nach `getComputedStyle().position`. `absolute` (Desktop, Tablet): `bottom`
  wie bisher an den Trigger andocken. `fixed` (Drawer ≤ 768 px): kein
  Inline-`bottom`, stattdessen `max-height` aus der **gemessenen**
  Trigger-Oberkante minus 8 px Spalt. `static` (eingeklappte Leiste): beides
  weg, das CSS macht die Position. Dazu Neuberechnung bei `resize`.

  **Nachgemessen auf Staging (973b):** Überhang **0 px** in allen Fassungen.
  390 × 844: Menü 58–591, Trigger 697. 390 × 556: Menü 58–401, Trigger 409,
  scrollt in sich. 1400 × 520: 15–385, Trigger 389, scrollt. 820 × 1180:
  528–981, Trigger 985. Klick unter dem Menü trifft wieder `#sb-list`,
  Objektwahl schließt das Menü, Pfeil steht auf `rotate(180deg)`.

  **Nebenbefund, noch offen:** `css/ui-varianten.css` und `js/ui-varianten.js`
  sind in `index.html` (Z. 29 und 3466) verlinkt, existieren aber weder im
  Repo noch auf dem Server — zwei 404 bei jedem Seitenaufruf.

- [2026-08-04] **Objektliste auf dem Tablet erreichbar machen** — `6bffd55`, `dfcea21`

  **Befund — deutlich schlimmer als angenommen.** Es war nicht „die Liste ist
  unerreichbar", sondern **die ganze App war im Band 769–1024 px eine leere
  Seite.** Gemessen:

  | Viewport | `.app-wrap` Spalten | `#sidebar` | `.main-col` oben |
  |---|---|---|---|
  | 820 × 1180 | `820px` (**eine**) | `relative`, `translateX(-240px)`, Höhe 1180 | **1180** |
  | 1024 × 768 | `1024px` (**eine**) | dito | **768** |
  | 1025 × 768 | `380px 645px` | `relative`, sichtbar | 0 |

  Der Inhalt begann also eine **volle Bildschirmhöhe unter dem Falz**.
  Damit ist auch die Backlog-Annahme „bei 901–1024 px steht die Leiste als
  feste Spalte" widerlegt — dort war es genauso kaputt.

  **Ursache, drei Regeln, die sich gegenseitig aushebeln:**
  1. `@media (max-width:1024px) .app-wrap{grid-template-columns:1fr}` —
     Leiste und Inhalt stapeln sich untereinander.
  2. `@media (max-width:1024px) .sidebar{position:fixed}` sollte die Leiste
     aus dem Fluss nehmen, wird aber von der **späteren, medienlosen**
     Regel `aside.sidebar{position:relative}` geschlagen: (0,1,1) gegen
     (0,1,0). **Eine Media-Query erhöht die Spezifität nicht.**
  3. Nur unter 768 px zieht v622 mit `body #sidebar.sidebar
     {position:fixed !important}` (1,2,1) den Kopf aus der Schlinge —
     deshalb lief das Handy und das Tablet nicht.

  **Vierter Befund:** `@media (max-width:1024px) .body{margin-left:240px
  !important}`, ein Rest aus der Zeit der fixen 240-px-Leiste. Bei 1024 px
  begann `.body` dadurch bei 500 statt 260 und war 519 statt 764 px breit.
  Unter 768 px war das längst zurückgenommen, im Band dazwischen nicht.

  **Fix (v648, `style.css` W40→W42, `ui.js` 973b→974, `main.js` 950→951):**
  - **769–900 px** bekommt den vorhandenen v622-Drawer. Statt ihn zu doppeln,
    wandern die Media-Queries der Drawer-Blöcke v622 · v625 · v633 · v637 ·
    v638 · v639 · v642 · v645 von 768 auf **900 px**.
  - **901–1024 px** bekommt den neuen Block `v648-tablet-shell`: echte zwei
    Spalten (`260px minmax(0,1fr)`), Leiste `sticky` im Fluss, keine
    Drawer-Bedienelemente, kein Backdrop.
  - `.body`-Randabzug im ganzen Band auf 0.

  **Vier Umschalt-Mechaniken auf eine reduziert** (der „Später"-Punkt ist
  damit miterledigt):
  - `ui.js:1751 toggleMobileSidebar` gelöscht — setzte `.sb-mobile-open` auf
    `#sidebar` statt `.app-wrap` und war ohnehin wirkungslos, weil `main.js`
    danach lädt und neu definiert. Genau so entstanden die vier Mechaniken.
  - `.mobile-hamburger` aus dem Markup — in jedem Band `display:none`.
  - `#mobile-overlay` aus dem Markup — Backdrop ist `#sb-backdrop`.
  - `.sidebar.open`-Regel entfernt — keine Zeile setzt die Klasse.
  - `drawer-fix-20260731` zurückgenommen — setzte `left:0` auf ein Element,
    das per `transform` verschoben wird, und blendete den toten Hamburger ein.
  - Schwellen 768 → 900 in `main.js` (resize-Reset) und `ui.js`
    (`closeMobileSidebarOnAction`).

  **Nachgemessen auf Staging (W42):**
  390 × 844 unverändert (Inhalt oben, Drawer auf/zu, Aktionen-Menü ohne
  Überhang) · 820 × 1180 Inhalt bei `top 0`, Drawer mehrfach auf/zu, Backdrop
  greift, kein waagerechtes Scrollen · 901 × 800 und 1024 × 768 zwei Spalten
  `260px + 641/764px`, Hamburger aus, `.body` bündig · 1440 × 800 unverändert
  `380px + 1060px`.

- [2026-08-04] **Kopfleiste auf dem Handy entlasten** — `15c197a`

  **Befund (gemessen, 390 × 844, Objekt Dealstreet 999 geladen):**
  `header.hdr` war **385 × 279 px** — ein volles Drittel des Viewports, bevor
  ein Formularfeld sichtbar wurde. `.hdr-v61-row1` brach auf **drei** Zeilen
  um (151 px): Hamburger 32 × 44 + Kürzel-Chip 73 × 27 + Name 222 × 22 /
  Autosave 127 × 25 + Feldanzeige 198 × 27 / Kerosin-Pille 107 × 44.
  Darunter `#hdr-badges` mit **128 px** Score-Karte.

  **Fix (v649, `style.css` W42→W43), nur ≤ 768 px:**
  Kürzel-Chip und Trenner raus · Objektname `flex:1 1 auto` mit
  Auslassungspunkten · Autosave nur noch der Punkt · Kerosin ohne Balken ·
  Feldfortschritt über `order:99` + `flex:1 0 100%` in eine **eigene schmale
  Zeile** umgebrochen, ganz ohne Markup-Änderung · Investor Deal Score aus
  (`#hdr-badges > *:not(.hdr-incomplete-banner)`) — der Hinweis „bitte 70 %
  ausfüllen" bleibt, das ist eine Handlungsaufforderung und keine Kennzahl.

  **Nachgemessen auf Staging (W43):** `header.hdr` 390 px → **76 px**
  (279 vorher). Eine Zeile: Hamburger · Objektname 224 px lesbar ·
  Autosave-Punkt · „37 L". Darunter 17 px Fortschrittszeile
  „24 / 24 Felder · 100 %". Tablet 820 px unverändert.

  **Nebenbefund, offen:** Auf 820 px ist die Kopfleiste **589 px** hoch —
  `#hdr-badges` allein 492 px, weil die fünf KPI-Pillen dort zu je zwei
  nebeneinander umbrechen. Der Backlog will den Score auf dem Tablet
  behalten, deshalb nicht angefasst. Gehört zu „Tablet-Fassung feinziehen".

- [2026-08-04] **Alle neun Objekt-Tabs handytauglich** — `366285e`, `f3aa78b`, `0677c88`, `2464cac`, `6b1d14f`, `0183da0`

  **Befund (gemessen bei 390 × 844, Objekt geladen, Tab für Tab durchgeklickt):**

  Kein Tab hatte waagerechtes **Seiten**-Scrollen — `documentElement.scrollWidth`
  war überall gleich `innerWidth`. Der Inhalt lief aber trotzdem über den
  rechten Rand hinaus und wurde still abgeschnitten:

  | Tab | Element | rechte Kante |
  |---|---|---|
  | Objekt | `.qz-label` | 553 |
  | Miete | `#ki-miete-box` | 394 |
  | Finanzierung | `.dpfk-ctrl` / `.dpfk-ltv` | **606** (`.body` 193 px über) |
  | Finanzierung | `.mrpf-top-tile` | 578 |
  | Steuer | `.fa-pdf-ctrl` | 537 |
  | Bewertung | `table.kpi-eval-table` | 562 |
  | Bewertung | `.cf-mode-btns` | 490 |

  Dazu **240 Eingabefelder mit 12,5 px bzw. 13,3 px** Schrift — iOS Safari
  zoomt bei jedem Antippen hinein, sobald ein Feld unter 16 px liegt. Und
  **19 Knopfarten unter 44 px** Trefferfläche, darunter die im Backlog
  vermerkten Seitenleisten-Icons.

  **Drei getrennte Ursachen, nicht eine:**
  1. **`min-width:auto` auf Rasterkindern** — die Voreinstellung. Ein breites
     Enkelkind schiebt die ganze Spalte auf. `#ki-miete-box` war dadurch
     368 px breit in einer 333-px-Spalte. Sammelfall hinter mehreren Zeilen
     der Tabelle.
  2. **`flex: 1 1 0%` beim Konditionsband.** `.dpfk-band` bricht um (333 px),
     `.dpfk-stub` belegt davon 331 px. Weil die Flex-Basis **0** ist, passt
     `.dpfk-body` rechnerisch noch auf dieselbe Zeile — es bekommt 0 px
     Breite und der Inhalt läuft bis 606 px hinaus, statt umzubrechen.
     Flex-Basis 100 % erzwingt die eigene Zeile.
  3. **`grid-template-columns:170px 1fr auto !important` ohne Media-Query**
     (`style.css:9421`) schlug den Mobilblock bei ≤ 720 px, der kein
     `!important` trägt. Mit `.qz-label{min-width:200px !important}` ergab
     das 553 px auf einem 390-px-Schirm.

  **Fix (v650, `style.css` W43→W44f), nur ≤ 768 px:**
  - Alle Textfelder, Auswahlfelder und Textbereiche auf **16 px**. Zwei
    Auswahlfelder blieben zunächst auf 13 px — `#d1_type,#d2_type` sind mit
    **ID-Spezifität** (1,0,0) und `!important` gesetzt, `.body select`
    (0,2,1) verliert dagegen. Mit der ID im Selektor sitzt es.
  - Trefferflächen: unsichtbares `::after` mit `max(100%,44px)` legt die
    Fläche auf 44 × 44, ohne die Optik zu ändern. Wo Höhe wachsen darf
    (Akkordeon-Zeilen, Aktionen-Trigger), stattdessen `min-height`.
  - `:active`-Rückmeldung für alle Knopfarten unter `@media (hover:none)` —
    auf Touch gibt es kein Hover, ohne Rückmeldung wirkt jeder Tipp folgenlos.
  - Kurze Paare nebeneinander: das Adressraster wird zu vier Spalten,
    PLZ spannt 1, Ort 3, Straße 3, Hausnummer 1, alles andere volle Breite.
    Ohne `:has()`-Unterstützung fällt es sauber auf eine Spalte zurück.
  - Die KPI-Tabelle ist mit 535 px **echt** breiter als der Schirm. Sie wird
    nicht gequetscht, sondern bekommt einen eigenen Scroller **mit sichtbarem
    Verlaufs-Hinweis** am rechten Rand.
  - BMF-Modal: `.bmfmo-tabs` war 325 px breit bei `scrollWidth` 549 und
    `flex-wrap:nowrap` — der vierte Reiter war nicht erreichbar. Jetzt
    waagerecht scrollend mit Snap, wie die Haupt-Tab-Leiste.

  **Nachgemessen auf Staging (W44f), Tab für Tab:**

  | Tab | Seiten-Scroll | `.body`-Scroll | Überlauf |
  |---|---|---|---|
  | Objekt | 0 | 0 | keiner |
  | Investition | 0 | 0 | keiner |
  | Miete | 0 | 0 | keiner |
  | Finanzierung | 0 | 0 | keiner |
  | Bewirtschaftung | 0 | 0 | keiner |
  | Steuer | 0 | 0 | keiner |
  | Pilot-Analyse | 0 | 0 | keiner |
  | Bewertung | 0 | 0 | keiner |
  | Deal-Aktion | 0 | 0 | keiner |

  Eingabefelder: **187 × 16 px**, kein Feld mehr darunter (der einzige Rest
  ist `input[type=range]`, bei dem iOS nicht zoomt). Trefferflächen: keine
  unter 44 px mehr. Adressraster gemessen: PLZ 68 px + Ort 225 px in einer
  Zeile, Straße 225 px + Hausnummer 68 px in der nächsten, alles andere
  303 px voll. BMF-Modal 374 × 793 in 390 × 844, Reiter scrollen, Rumpf
  scrollt.

  **Nicht gebaut, bewusst:** die Raster-Übersicht als Ausweg für die neun
  Reiter. Die Tab-Leiste hat bereits `scroll-snap-type:x` mit
  `scroll-snap-align:start` und Reiter von 73 × 44 px — sie funktioniert
  gemessen. Eine zweite Navigationsform daneben wäre eine Produktentscheidung,
  keine Reparatur.

- [2026-08-04] **Portfolio-Cockpit auf Handy und Tablet** — `ac0a0b8`, `6afb7a5`

  **Befund — die Ursache war ein Parserfehler, kein fehlendes Responsive-CSS.**
  `dashboard.css:431` stand als

  ```
  #dashboard-main .pick, #dashboard-main @media(max-width:880px){ … }
  ```

  — eine `@media`-Regel **mitten in einer Selektorliste**. Der Parser
  verwirft den kompletten Block. Nachgewiesen im Browser: `cssRules` von
  `dashboard.css` enthielt 351 Regeln und genau diesen
  `(max-width:880px)`-Block **nicht**, während die drei anderen
  880er-Blöcke (Z. 500 / 581 / 610) da waren. Entstanden ist es beim
  nachträglichen Voranstellen von `#dashboard-main` vor alle Selektoren.

  Damit war die ganze Mobilfassung des Cockpits tot. Gemessen bei 390 px:

  | Element | soll | war |
  |---|---|---|
  | `.gates` (Kanban) | 1 Spalte | `344px 103px 99px` = 545 px in 353 px, Spalten bis **590** |
  | `.kpis` | 2 Spalten | 4 Spalten à 79 px |
  | `.charts` | 1 Spalte | 2 Spalten, Diagramm bis **560** |

  `.pick` kommt weder im Markup noch sonst im Stylesheet vor — beim
  Reparieren geht nichts verloren.

  **Fix (v651, `dashboard.css` W34→W35):** Block als sauberes
  `@media(max-width:880px)` mit `#dashboard-main`-Präfix wiederhergestellt.
  Dazu ein v651-Block für die Reste: Diagramme und Canvas auf
  `max-width:100%`, Abschnittskopfzeilen umbrechend (`#dp-proj-years` lief
  bis 393), Übersichtskacheln zweispaltig, Tabellenbereiche waagerecht
  scrollbar.

  **Nebenbefund, betrifft nicht nur Mobil — und war der schwerere:**
  Der Boarding-Pass `#oab-bar` trägt seit v593 `overflow:hidden` und seit
  v578 `flex-wrap:nowrap`, sein Inhalt ist rund **1240 px** breit.

  | Viewport | sichtbar | Inhalt | Folge |
  |---|---|---|---|
  | 390 px | — | — | v619 stapelt, alles erreichbar |
  | 820 px | 747 | 1208 | abgeschnitten |
  | 1024 px | 691 | 1208 | abgeschnitten |
  | **1440 px** | 1015 | 1240 | abgeschnitten, `#oab-run` bei x 1485–1587 |

  Der Startknopf „Abrufen" der PRE-FLIGHT-Strecke war damit auf **jedem
  Schirm unter rund 1620 px** unerreichbar — auch auf einem normalen
  Notebook mit 1366 oder 1440 px. Jetzt (v651b) waagerecht scrollbar mit
  Snap und einem Verlauf am rechten Rand als Hinweis; wo der Inhalt passt,
  ändert sich nichts.

  **Nachgemessen auf Staging (W45 / dashboard W35):**
  Cockpit bei 390 px, 820 px und 1024 px — **kein** Überlauf, kein
  Seiten-Scrollen. Objekt-Ansicht ebenso; `#oab-bar` erscheint jetzt als
  echter Scroller (747 / 1208 bei 820 px), und bei 1024 px liegt
  `#oab-run` nach dem Scrollen bei x 830–932, also **im Bild**.

  **Nicht geprüft:** die Tabelle der geteilten Pässe war im Testkonto leer.
  Die Scroll-Regel dafür steht, der Nachweis fehlt.
