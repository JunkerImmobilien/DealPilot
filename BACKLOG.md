# Backlog

**Reihenfolge = Priorität.** Der oberste offene Punkt wird bearbeitet.

Nach Abschluss wandert ein Punkt nach unten unter **Fertig**, mit Datum,
Commit-Hash und dem **Befund** — was war die Ursache, was wurde gemessen.
Dort **ohne** Nummer: Nummern sind Reihenfolge, kein Name. Die verbleibenden
Punkte werden fortlaufend neu durchnummeriert. Hängt etwas, kommt `**BLOCKIERT:**` mit einem Satz Begründung
direkt unter den Punkt — nicht kommentarlos liegenlassen.

**Vorlagen und Bilder:** `design/` (Mockups, Logos). Siehe `design/README.md`.

---
## Offen

1. **Branding unter „Darstellung" zusammenlegen.** Es gibt zwei Panels:
   das alte `#dp-tb-panel` (`settings.js` `_dpDisp*`, v927) mit Logo,
   Logogröße, Schriften, Akzent und dem Reseller-Block, und das neue aus
   `ui-varianten.js` mit Vorlage, Karten, Fläche. Marcels Vorgabe: ein
   Abschnitt **Marke** im neuen Panel — Logo, Logogröße, Kartenfarbe,
   Schrift, Akzent. Für alle sichtbar, für Nicht-Partner ausgegraut (wie
   die Farbsektion es heute schon macht). `_dpResBlock` und `_dpLogoBlock`
   werden **umgehängt, nicht neu gebaut** — beide liefern nachweislich
   sauberes HTML.

   **Kein Defekt in der Bedienung:** mit Partner-Konto durchgeklickt sind
   Reiter, Branding-Panel, gespeichertes Logo und Farb-Editor alle in
   Ordnung. Das leere `onclick` am Partner-Reiter ist Absicht
   (`reseller-portal.js:557` entfernt es und hängt einen Listener an).

   ### Bauanleitung

   **Die beiden Panels im Vergleich — gemessen, nicht angenommen:**

   | | alt | neu |
   |---|---|---|
   | Baut | `settings.js:3167` `panelHtml()` | `ui-varianten.js:225` `p.innerHTML` |
   | Wurzel | `#dp-tb-panel`, Rumpf `.dp-tb-b` | `#dpuv-panel`, Rumpf `#dpuv-b` |
   | Abschnitt | `.dp-tb-sec` + `<b>` | `.dpuv-g` + `<h3>` |
   | Neu zeichnen | `window.panelHtmlRebuild()` | `oeffnen()` (`:325`) |
   | Speichert | Einzelschlüssel `dp_*_ui` | ein JSON `dp_user_settings` |
   | Öffnet | `window._dpOpenToolbar()` | `DealPilotUiVarianten` |

   **Das alte Panel hat drei Einhängepunkte, die schon genau dafür
   gebaut wurden** — dasselbe Muster nutzt der neue Abschnitt:
   `_dpResBlock()` (`:3170`), `_dpLogoBlock()` (`:3188`), `_dpResSave()`
   (`:3189`). Alle drei sind global, liefern fertiges HTML und wurden
   nachweislich sauber gerendert.

   **Schritt für Schritt:**

   1. **Nichts löschen.** Das alte Panel bleibt zunächst, wie es ist —
      sonst hängt bei jedem Fehlschlag die ganze Darstellung. Erst wenn
      der neue Abschnitt steht und geprüft ist, wird der Aufruf des alten
      Panels entfernt.
   2. **Abschnitt „Marke" in `ui-varianten.js`** hinter der Farbsektion
      einhängen, als weiteres `<div class="dpuv-g"><h3>Marke</h3>…`.
      Inhalt: Logo (Datei + Ausrichtung + Größe), Kartenfarbe, Schrift,
      Akzent.
   3. **Bedienelemente nicht neu erfinden.** Die Handler sind alle global
      und funktionieren: `_dpDispHeader`, `_dpDispSide`, `_dpDispText`,
      `_dpDispHero`, `_dpDispKpi`, `_dpDispObj`, `_dpDispAccent`,
      `_dpDispFont`, `_dpDispSize`, `_dpDispLogoAlign`, `_dpDispLogoReset`,
      `_dpDispRefresh`, `_dpDispTarget`, `_dpResCommit`. Für Farbzeilen
      reicht das Muster aus `settings.js:3166` `ci(fn, lsKey, default,
      label)` — eine `<input type="color">` mit `oninput`.
   4. **Reseller-Umschalter mitnehmen:** `_dpResBlock()` liefert „Mich /
      Meine Mandanten", `_dpResSave()` den Speichern-Knopf. Beide geben
      Leerstring zurück, wenn kein Partner — das Ausblenden erledigt sich
      damit von selbst.
   5. **Sperre sichtbar statt versteckt.** Für Nicht-Partner bleibt der
      Abschnitt stehen und wird ausgegraut, genau wie die Farbsektion es
      heute macht. Tor ist `Plan.can('reseller')`
      (`darstellung-reseller.js:48` `isPartner()`).
   6. **Farb-Editor anbinden:** `DealPilotBrandingEditor.open({accent,
      obsidian, mail, name, logo}, onApply)`. „Abbrechen" stellt den
      vorherigen Zustand selbst wieder her.
   7. **Nach dem Umbau** den Aufruf im Partner-Portal (`rp-b-disp`) auf
      das neue Panel umbiegen, damit es nur noch einen Weg gibt.

   **Fallen, die schon einmal Zeit gekostet haben:**

   - **`free` in `settings.js:3168` heißt nicht „kostenlos".** Es ist
     `(k==='pro'||k==='partner')`, also „darf den Akzent sehen". Beim
     Übernehmen nicht als Gratis-Prüfung missverstehen.
   - **Die Speicherorte sind verschieden.** Alt schreibt Einzelschlüssel
     `dp_*_ui`, neu ein JSON unter `dp_user_settings`. Solange beide Panels
     existieren, muss die Marke im **alten** Format bleiben — sonst sieht
     das alte Panel die Werte nicht mehr, und der Mandanten-Abgleich in
     `darstellung-reseller.js` (`MAP`, `:40`) liest genau diese Schlüssel.
   - **Der Sweeper ist Pflicht.** `_dpDisp*` setzt nur CSS-Variablen;
     Module mit hart verdrahtetem Gold ignorieren die. Deshalb ruft
     `applySet()` zusätzlich `DealPilotWhitelabel.apply()` bzw. `.reset()`.
     Wer die Marke woanders anwendet, muss das mitnehmen.
   - **Gold-Literale nur als `var(--wl-<hex>, #<hex>)`.** Vor dem Rollout
     `python3 tools/gold-audit.py`, RC=0 ist sauber.
   - **Zum Prüfen wird ein Partner-Konto gebraucht** — mit PRO ist der
     ganze Abschnitt unsichtbar und man misst ins Leere.

2. **Stapel-Modus feinziehen** — `v1095`/`v1095b` steht (siehe **Fertig**).
   Offen bleibt der Vergleich mit `design/mockups/handy2.jpg` im Detail:
   dort tragen die KPI-Kacheln im Rumpf **dunkle** Flächen, hier folgen sie
   der Vorlagenfarbe. Dazu fehlen „Im Rennen" und „Detail öffnen →" — beide
   gibt es auf der Leistenkarte nicht, sie kämen aus `storage.js`. Erst
   entscheiden, ob sie überhaupt in die Leiste gehören.

---

## Später

- **Ein sehr dunkler Partner-Akzent ist auf dunklem Grund kaum lesbar.**
  Gemessen mit `#7B2D3B` (dem Akzent aus dem alten Punkt 1): in `konsole`
  liegt der Kontrast der Marken-Elemente bei **2,26–2,37**. Das ist
  **nicht** durch v1096 entstanden — **ohne** Vorlage ist derselbe Akzent
  noch schlechter: Preis **1,31**, Aktionen-Knopf 2,8. Es trifft also die
  Grundfassung genauso und ist ein Whitelabel-Thema, kein Vorlagen-Thema:
  `--gold-2` hellt einen ohnehin dunklen Markenton zu wenig auf. Kandidat
  wäre ein Mindest-Helligkeitsabstand statt einer festen Ableitung. Eigener
  Punkt, weil er die Marken-Ableitung insgesamt betrifft.

- **„privat" liegt auf dem Preis** — im Wallet-Modus überlappt `.sbc-halter`
  die `.sbc-kp-row`. Steht so auch auf Marcels Screenshots vom 06.08. und
  ist damit älter als v1091. Eigener Punkt, weil es das Raster von v1082
  betrifft, nicht die Farbe.

- **`.sbcm-label` in der dunklen Fassung mit Kartenfläche „Weiß"** —
  Kontrast 1,06. Die Karte wird weiß, das Kachel-Label bleibt hell.
  Betrifft nur die Kombination `dealpilot`/`konsole` + `ui_surface:light`,
  in allen hellen Vorlagen sauber.

- **Aktionen-Aufklapper in der dunklen Fassung nachsehen** —
  `.sb-actions-accordion-inner` misst `rgb(255,255,255)` **auch** in
  `dealpilot` und `konsole`, also weiße Fläche in der dunklen Leiste. Die
  Einträge darin (`.sb-act-item`) tragen aufgehelltes Gold `#E8C964`. Im
  geschlossenen Zustand nicht sichtbar (`display:none`, Rechteck 0×0),
  deshalb bei den Kontrastläufen nie aufgefallen. **Mit geöffnetem Menü
  nachmessen**, vorher nichts ändern — v1084 hat das Menü gebaut und war
  abgenommen.

- **Tablet-Fassung feinziehen** — Drawer, zweispaltige Formulare,
  Aktionen als Popover statt Blatt von unten
- **Einstellungs-Abschnitte hintereinander rendern** ließ den Prüf-Browser
  zweimal einfrieren (`anbieter`, `mandanten`, `plan`, `rechtliches`, `help`).
  Einzeln unauffällig — auf einem echten Gerät nachstellen
- **Media-Queries konsolidieren** — 226 Blöcke auf 25 Breakpoints. Eigenes
  Vorhaben mit eigener Prüfstrecke, nicht nebenbei
- **Admin-Oberfläche** auf Tablet prüfen

---

## Fertig

<!-- Format:  - [YYYY-MM-DD] Punkt — Commit-Hash -->

- [2026-08-06] **Marke kommt unter einer Vorlage nicht durch — Rest der
  Fundstellen** — `300bfc3`, `f0a6631`

  **Neu gemessen statt der alten Liste gefolgt.** Der Punkt warnte selbst
  vor Fehltreffern seines Regex-Audits, deshalb diesmal im laufenden DOM:
  Akzent setzen, Momentaufnahme **ohne** Vorlage, dann je Vorlage erneut,
  Vergleich je Element und Eigenschaft. Ergebnis sind **13 Elemente**, nicht
  33 Stellen — die alte Zahl zählte jede Vererbungsstufe und jede der vier
  Rahmenseiten einzeln.

  **Zwei Messfehler, die ich dabei zuerst selbst gebaut habe:**

  1. „Neutral" als **Grau** definiert (max − min ≤ 8). Damit meldete
     `panel` **null** Treffer — dessen Neutralton ist `rgb(21,26,32)`, ein
     Blaustich mit Abstand 11, und `boarding` ist cremefarben. Richtig ist
     der Vergleich über den **Farbton**: trägt die Farbe noch den Ton des
     Akzents (± 30°) oder nicht.
  2. Mit dem roten Akzent `#7B2D3B` aus dem Punkt ist die Marke **nicht
     vom Status-Rot zu trennen** — `.sb-card.deal-lost` mit
     `rgba(200,66,61,.65)` erschien als Markenverlust. Gemessen wurde
     deshalb mit **Violett** `#7C5CBF`; Grün und Rot bleiben dann eindeutig
     Statusfarben. Gegenprobe mit Rot: identische Liste bis auf genau
     diesen einen Fehltreffer.

  Dazu zwei Filter, ohne die die Liste Phantome enthält: Rahmenfarbe zählt
  nur bei `border-width > 0`, `color` nur bei **eigenem** Textknoten. Ohne
  den ersten meldet der Logo-Rahmen einen „Verlust", obwohl die Vorlage ihn
  per `border:0` bewusst ganz abräumt.

  **Fünf Sachverhalte, alle behoben (v1096):**

  | Stelle | Befund |
  |---|---|
  | `.sbc-kp` | der **Preis** auf der Karte, prominenteste Zahl |
  | `.sb-actions-trigger` + `.sb-actions-l` | Aktionen-Knopf |
  | `.sbc-seq` | **Fläche** der Nummernpille — v1093 hatte nur die Schrift |
  | `.sb-section-title` | nur `konsole`, v1093 ließ die dunkle Vorlage aus |
  | `.tabs-status-text` | siehe unten, eigener Fehler |

  Der Aktionen-Knopf war schon vorher sichtbar falsch: **v1090 hat den
  Pfeil im selben Knopf golden gesetzt, der Text daneben blieb grau** —
  gemessen Pfeil `#451b23`, Label `rgb(20,19,16)`. Ein Knopf, zwei Farben.

  **Einen eigenen v1082-Fehler nehme ich ausdrücklich zurück:**
  `.tabs-status-text` stand dort in der Gruppe „aufgehelltes Grün" und
  wurde auf `#2E8455` gesetzt. Gemessen ist der Normalzustand aber **Gold**
  (`style.css:25776`); grün wird der Text erst im *fertigen* Zustand über
  `.tabs-status-done .tabs-status-text` (`:25784`). Ich hatte die
  Zustandsfarbe für die Grundfarbe gehalten — Folge: in allen vier hellen
  Vorlagen stand „0 / 6 · 0 %" in Grün. Jetzt trägt der Grundzustand den
  Akzent, Grün bleibt dem Zustand `done`.

  **Der größere Fund kam erst bei der Abnahme (v1096b).** Er betrifft
  **auch v1089, v1090 und v1093**, nicht nur dieses Paket: die Marke kam
  nur durch, wenn der Akzent über den Sweeper gesetzt wurde. Es gibt aber
  **zwei Wege**:

  | Weg | setzt |
  |---|---|
  | `DealPilotWhitelabel.apply()` | `--gold`, `--gold-2`, `--gold-d`, 25 × `--wl-<hex>` |
  | `_dpDispAccent()` (`settings.js:3109`, altes Panel) | nur `--gold` und `--gold-hi/-lo/-l/-2/-3/-bg` — **kein** `--gold-d`, **keine** `--wl-*` |

  Nachgestellt mit violettem Akzent über den Regler: `--gold` stand auf
  `#7C5CBF`, und Objektnummer, aktiver Reiter, Preis, Aktionen-Knopf und
  Fortschritt fielen **alle** auf ihr Literal `#9a7f33` zurück —
  Standard-Gold neben einem violetten Akzent. Genau der Fehler, den dieser
  Punkt beheben sollte, nur an anderer Stelle.

  Der Ton hängt jetzt an `--gold`, das auf beiden Wegen steht, und wird nur
  gerechnet, wenn das Spezialtoken fehlt: `--uv-marke-d` und
  `--uv-marke-dd`. Ist das Token da, gewinnt es unverändert — **v1089 und
  v1090 sehen bitgenau aus wie vorher** (nachgemessen: `#451b23` bzw.
  `#702936`). Zwei Tokens statt einem, weil `--gold-d` und `--wl-9a7f33` im
  Whitelabel **nicht** denselben Wert haben.

  **Nicht geändert, weil Fläche und nicht Marke:** die sieben Rahmen und
  Trennlinien (`aside#sidebar`, `header.hdr`, `nav.tabs`, `#sb-user`,
  `.sb-card`, `.sbcm`, Knopfrahmen). Sie trugen Gold bei **10–55 %
  Deckung**, also einen Neutralton — und die Vorlage bestimmt die Fläche.

  **Nachgemessen auf Staging, angemeldet, Partner-Konto, fünf Objekte,
  Modus „standard", über den Regler-Weg** (also den, der vorher versagte):

  | Vorlage | Treffer gesamt | davon außerhalb der Rahmen |
  |---|---|---|
  | kontor · panel · kanzlei · boarding · konsole | je 9 | **0** |

  Kontrastlauf über die fünf geänderten Stellen, Standard-Gold: hell
  3,36–3,85 · konsole 9,08–10,98. Mit Partner-Rot: hell 4,35–14,64.
  Ohne Vorlage ist der Istzustand bitgenau erhalten — Sidebar `rgb(0,0,0)`,
  Tabs `rgb(10,8,5)`, Karte transparent mit dem originalen Verlauf, alle
  Marken-Elemente auf `#E8C964`. `gold-audit.py` unverändert bei **484**;
  `ui-varianten.css` trägt davon **keine einzige** Fundstelle.

- [2026-08-06] **Vier Befunde aus Marcels Screenshots** — `2131dfd`, `0982845`

  Zustand nachgestellt: Kontor + Objektkarten „Wallet" + Kartenfläche
  „Weiß", Objekt geladen (`header.hdr.has-v64-score`), 1920 breit.

  **(A) Der Investor Deal Score stand auf Schwarz.** Ursache ist
  **v927-headerblack**, `style.css:35410-35416`: der *alte* helle Skin
  `body.dp-chrome-hell` setzt `--dp-header-bg:#0a0a0a` und färbt damit Kopf,
  beide Reihen und `#hdr-badges` schwarz —
  `body.dp-chrome-hell header.hdr.has-v64-score` (0,3,2) und
  `body.dp-chrome-hell #hdr-badges` (1,1,1). Meine Vorlagen-Regel steht bei
  (0,2,3) und verliert gegen beide. **v1085 hat den Skin-Schalter an die
  Darstellung gekoppelt** — seitdem trifft es jeden, der eine helle Vorlage
  wählt. Gemessen mit gesetztem `dp-chrome-hell`: genau drei Flächen auf
  `rgb(10,10,10)`, alles andere weiß. Das war auch der Grund, warum der
  Objektname auf seinen Bildern kaum lesbar war — v1089 hatte ihn dunkel
  gefärbt, der Kopf darunter blieb schwarz. Die Vorlage ist die spätere und
  ausdrückliche Wahl und gewinnt jetzt; der Hell-Skin **ohne** Vorlage
  behält seinen schwarzen Kopf.

  **(B) Objektkarten ohne Umrahmung.** Ursache war meine eigene
  v1082-Regel „Kontor: Karten ohne Seitenrahmen, nur Trennlinie". Gemessen:
  `dealpilot` 2 px / Radius 11 px / Schatten gegen `kontor` 0 / 0 / keiner.
  Damit fällt die Gestaltungsentscheidung von v1082 — Marcel will den
  Rahmen. Die Karte nimmt Haarlinie und Radius aus den Tokens.

  **(C) Das Gold lief nicht bis zum Kartenrand.** Gemessen: `.sb-card`
  345 px, `.sbc-top` 325 px und 14 px unter der Oberkante — das Band ist
  dessen `::before` und damit ebenso 325 px. Ursache ist die
  Kartenpolsterung `14px 10px 10px`. Band per negativem Außenabstand an die
  Kante gezogen, die Ecken bekommt das Band selbst: `overflow:hidden` ist
  gesperrt, weil das Investor-Ribbon bei `top:-7px` sitzt.
  **Nachgemessen: Rand links/rechts/oben je 2 px — das ist der Rahmen.**

  **(D) Der Score-Ring sprang nach oben links.** Gemessen: `Standard`
  `right:12px` → Ring x 284, **rechts**; `Wallet` `left:9px` → Ring x 21,
  **links**. v1082j hatte ihn bewusst aufs Band geschoben und wird
  zurückgenommen. **Nachgemessen: Ring x 285–335, Stufen-Pille darunter bei
  y 172–197 — Lage wie im Standard (284–334).**

  **Ein Zwischenstand war falsch (v1091 → v1091b):** mit
  `display:inline-block` (aus dem Wallet-Block von v1082h) flossen Ring und
  Pille in *eine* Zeile, Ring x 226–276, Pille x 276–343. Im Standard ist
  die Pille `display:block` und stapelt sich dadurch unter den Ring.

  **Gegenprobe** über alle sechs Fassungen, Kontrastlauf k < 2 in
  `#sidebar`/`header.hdr`/`nav.tabs`: hell 1, dunkel 3 Fundstellen — beide
  Reste sind unter **Später** eingetragen und älter als dieses Paket.

- [2026-08-06] **Heller Text auf hellem Grund — der Rest aus v1088** —
  `1a13207`, `49d5c3a`

  **Meine v1088-Diagnose war am falschen Gegner gemessen und wird
  ausdrücklich zurückgenommen.** Ich hatte `.hdr-v61-row1 .hdr-obj-name`
  (0,2,0) als konkurrierende Regel geprüft und daraus geschlossen, meine
  Regel gewinne. Die Regel, die wirklich gewinnt, selektiert über die
  **ID** — und die Elemente tragen Klasse *und* ID:

  | Datei | Selektor | Spez. |
  |---|---|---|
  | `style.css:24145` | `header.hdr.has-v64-score #hdr-obj` | (1,2,1) |
  | `style.css:24136` | `header.hdr.has-v64-score #hdr-obj-num` | (1,2,1) |
  | `style.css:24065` | `header.hdr.has-v64-score .hdr-sep` | (0,3,1) |

  `index.html:807/813`: `<span class="hdr-obj-num" id="hdr-obj-num">` und
  `<div class="hdr-obj-name" id="hdr-obj">`. Meine v1088-Selektoren waren
  rein klassenbasiert (0,3,3) und verlieren gegen jede ID — `!important`
  steht auf beiden Seiten, also entscheidet die Spezifität. Deshalb löste
  `--uv-chrome-ink` am Element korrekt auf und blieb trotzdem wirkungslos:
  die Deklaration kam nie zum Zug. **v1089** fixt über Selektoren mit ID,
  (1,2,3) schlägt (1,2,1). Der Trenner `.hdr-sep` hängt an derselben
  Ursache und war in v1088 gar nicht erfasst.

  **v1090** räumt die zwei Reste ab, die der saubere Lauf danach zeigte —
  beide derselbe Fall wie die Objektnummer, aufgehelltes Gold `#E8C964`
  auf hellem Grund: `#hdr-credits-pill-label` (erbt von
  `.hdr-credits-pill`) und `.sb-actions-arrow`. Beide Gegner sind (0,3,1)
  und tragen keine ID, hier reicht Klassen-Spezifität.

  **Das Werkzeug, das gefehlt hat:** ein Kaskaden-Walker, der *alle*
  Stylesheets rekursiv durchgeht (auch `@media`/`@supports`), je
  **Teilselektor** matcht und nach `!important` → Spezifität → Reihenfolge
  sortiert. `element.matches()` findet Regeln, sagt aber nichts über die
  Kaskade — das war der Denkfehler.

  **Zwei eigene Messfehler nehme ich zurück,** die ich zwischendurch als
  Befund hatte: `.sb-user-name` (angeblich dunkel auf schwarzem `#sb-user`)
  und `.sb-actions-l`. Beides Artefakte des gedrosselten Prüf-Tabs —
  **eingefrorene Transitions überschreiben sogar Inline-`!important`**, ein
  `background:transparent !important` mit höchster Spezifität blieb ohne
  Wirkung. Nach `document.getAnimations().forEach(a => a.finish())` sind
  beide sauber. `.sb-act-l` war ein Fehlalarm meines Scanners: liegt in
  einem `display:none`-Aufklapper, Rechteck 0×0. Der Scanner filtert das
  jetzt.

  **Nachgemessen** (Kontrastlauf über `#sidebar`, `header.hdr`, `nav.tabs`,
  Schwelle k < 2, im gleich-Origin-iframe bei 1440 / 820 / 390):

  | Fassung | vor v1089 | nach v1090 |
  |---|---|---|
  | kontor · panel · kanzlei · boarding | 4 | **0** |
  | dealpilot · konsole (Referenz, dunkel) | 2 | 1 |

  Der eine verbleibende Treffer in der dunklen Fassung ist
  `.sb-version-badge` (Gold bei 70 % Deckung auf einem Gold-8-%-Plättchen)
  — so gebaut, in den hellen Fassungen gar nicht auffällig.

- [2026-08-05] **Kopfleiste auf dem Tablet** — `fc36d12`

  **Befund (gemessen bei 820 × 1180 mit geladenem Objekt):**

  | Element | war |
  |---|---|
  | `header.hdr` | **815 × 589** — die halbe Bildschirmhöhe |
  | `#hdr-badges` | 815 × 492 |
  | `.scores` | `grid-template-columns: 381.5px 381.5px` — **zwei** Spalten |
  | `.sc-main` | 771 × 121, spannt beide Spalten |
  | `.sc-pill` × 5 | 382 × 109 → bei zwei Spalten **drei Zeilen** |

  Eine Pille trägt Label 15 px + Wert 33 px + Unterzeile 15 px + Balken 4 px
  = 67 px Inhalt in einem 109-px-Kasten. Inhaltlich ist sie schmal
  („RENDITE / 98 % / 4 von 4 KPIs") — sie braucht keine 382 px Breite. Bei
  771 px verfügbarer Breite passen **fünf** zu je rund 147 px nebeneinander.

  **Fix (v1087b):** fünf Spalten statt zwei, Score-Karte spannt darüber.
  `minmax(0,1fr)` statt `1fr`, sonst greift `min-width:auto` und ein breiter
  Inhalt sprengt die Spalte — der Sammelfall aus v650.

  **Einen ersten Anlauf nehme ich zurück (v1087):** Ich hatte die Pillen in
  eine waagerecht scrollende Spur gelegt, nach dem Muster des Boarding-Passes
  aus v651b. Die Kopfzeile war danach zwar 365 statt 589 px — aber `.sc-main`
  wurde **1118 px breit** und lief aus dem Bild, weil `min-width:max-content`
  den Container auf die Summe aller Pillen zieht und die Score-Karte mit
  `flex:1 0 100%` davon 100 % nimmt. Ein Scroller war hier schlicht das
  falsche Mittel: die Pillen passen ja.

  **Nachgemessen:** 820 × 1180 → `header.hdr` **348 px** (vorher 589), alle
  fünf Pillen à 149 px in **einer** Zeile, Score-Karte wieder 771 px und im
  Bild, kein waagerechtes Scrollen. Gegenprobe unverändert: 390 px → 76 px
  (v649-Arbeit, Pillen dort ausgeblendet) · 1440 px → 243 px · 1920 px →
  190 px.

- [2026-08-05] **Kompakter Logo-Kopf in den Vorlagen** — `20dbb4c`, `49c1944`

  Marcels Vorgabe: die Vorlagen sollen aussehen wie sein Bild `UI-Ansicht.png`
  (inzwischen entfernt), „auch
  das Logo darf klein werden".

  **Befund:** Die Vorlage hatte den Logo-Kopf **gar nicht angefasst** —
  `.sb-header` 379 × 125 in *jeder* Fassung, Rahmen 323 × 83, Bild 287 × 53.
  Soll laut `dp-mockup-alle-formate.html:138-145`: `.list-hd` mit 12 px
  Polsterung und Trennlinie, also rund 60 px. Das war der auffälligste
  Unterschied zum Bild.

  **Fix:** flacher Kopf, kleines linksbündiges Logo, kein Goldrahmen. Höhe
  führt, Breite folgt (`height:26px` / `width:auto`) — sonst zieht die
  Leistenbreite das Logo wieder auf, das war der v646-Befund. In den vier
  hellen Vorlagen wird die Wortmarke invertiert, weil ihr „Deal" weiß ist
  und auf hellem Grund verschwände; `hue-rotate(180deg)` dreht den Goldton
  zurück.

  **Nachgemessen:** `.sb-header` **125 → 49 px**, Logo 141 × 26, Abstand von
  links 13 px, kein Rahmen. Die Objektliste gewinnt dadurch 76 px.
  „dealpilot" trägt kein Attribut — Rahmen, Wortmarke und Größenregler aus
  v1079/v1080 bleiben dort unangetastet.

  **Zum zweiten Mal derselbe Fehler, deshalb hier notiert:** Das Logo saß
  zuerst bei x = 119 statt 13 — exakt die Mitte. `justify-content:flex-start`
  stand auf Header *und* Wrapper, lief aber ins Leere, weil die
  **Flex-Richtung** nicht gesetzt war: bei `column` steuert `align-items` die
  waagerechte Achse, und das geerbte `center` gewann. Dieselbe Ursache wie
  bei der Wallet-Stufenpille (v1082i). **Regel für künftige Arbeit: wo
  Ausrichtung gesetzt wird, gehört die Richtung dazu.**

  **Nicht gebaut, bewusst:** das „D"-Badge und die Zeile „by Junker
  Immobilien" aus dem Mockup. Beides ist Markeninhalt — per CSS `content`
  eingesetzt stünde bei jedem Whitelabel-Mandanten der falsche Name in der
  Leiste. Das gehört an die Branding-Daten, nicht ins Stylesheet.

- [2026-08-05] **Widersprüchliche `.sb-list`-Regeln** — *keine Änderung nötig*

  Der Punkt ist veraltet. `height:40vh !important` und `height:0 !important`
  stehen nicht mehr im Stylesheet; die einzige Fundstelle ist ein Kommentar.
  Gemessen bei 390 × 844 mit offenem Drawer: `flex: 1 1 auto`,
  `min-height: 72px`, `overflow-y: auto`, Höhe 511 px, scrollt in sich.
  Das hat **v645** bereits erledigt, als die Liste den Restplatz bekam.

- [2026-08-05] **Handy-Sperre plan-abhängig lösen** — `9f6b3ba`

  `js/mobile-redirect.js` steht in CLAUDE.md unter **Nicht anfassen**. Die
  Vorbedingung dieses Punktes („erst wenn 1–2 stehen") war erfüllt, und der
  Punkt beschrieb die Änderung samt Lösungsweg — deshalb angefasst.

  **Der Haken, den der Punkt selbst benannte:** Die Datei läuft bewusst
  **ohne** `setTimeout` („bei einer Sperre darf es kein offenes Zeitfenster
  geben"). Der Plan steht zu diesem Zeitpunkt aber noch nicht fest, weil
  `Sub.getCurrent` ein Netzaufruf ist. Entschieden wird deshalb **nur aus
  dem Cache**:

  | Schlüssel | Bedeutung |
  |---|---|
  | `dp_last_plan` | zuletzt bekannter Plan (`subscription.js:101`) |
  | `dp_wl_cache` | Reseller-Branding — existiert **ausschließlich** bei einem `reseller_client` (`mandant-branding.js:230`, das Backend liefert für Owner `null`). Damit ist es das gecachte Kennzeichen „Mandant eines Partners". |

  **Immer erst sperren, dann freigeben.** Leerer Cache heißt Sperre. Der
  Korrekturpfad hängt an `dp:plan-ready`, nicht an einem Timer.

  **Nachgemessen (Touch-Zeiger nachgestellt, damit `isPhone()` greift):**

  | Fall | Ergebnis |
  |---|---|
  | kein Cache (neues Gerät) | **gesperrt** |
  | Plan `pro` | gesperrt |
  | Plan `free` | gesperrt |
  | Plan `partner` | **frei** |
  | Mandant (`dp_wl_cache` gesetzt) | **frei** |

  Korrekturpfad: leerer Cache → gesperrt; danach `dp:plan-ready` mit
  `partner` → **frei**. Gegenprobe: dasselbe Signal mit `free` → bleibt
  **gesperrt**. Beim ersten Login auf einem neuen Gerät blitzt damit nichts
  Falsches auf — es steht die Sperre, und die weicht erst, wenn der Plan sie
  widerlegt.

  Die Erkennungsregeln (Regel A/B, Tablet-Schwelle 1400 px) und die
  Testhintertür `?nomobileblock` sind unangetastet.

- [2026-08-05] **Skin-Schalter und Darstellung liefen auseinander** — `9f6b3ba`

  **Entschieden: koppeln, nicht löschen.** Der Punkt ließ beides offen.
  Drei Gründe für die Kopplung:

  1. `body.dp-chrome-hell` trägt **105 gewachsene Regeln**. Die zu entfernen
     ist ein eigenes Vorhaben mit eigener Prüfstrecke, kein Nebenzug.
  2. `darstellung-reseller.js:29` und `mandant-branding.js:156` rufen
     `_dpDispSkin`, um die Marke eines Partners an dessen Mandanten
     durchzureichen. Fällt die Funktion weg, bricht das Whitelabel.
  3. Gemessen **stören** sich beide nicht — `html[data-ui-theme]` (0,2,1)
     liegt über `body.dp-chrome-hell` (0,2,0), die Vorlage gewinnt. Das
     Problem war nicht Kollision, sondern **Auseinanderlaufen**: „Hell"
     schalten und „Konsole" wählen ergab Konsole, der Schalter wirkte
     folgenlos.

  Umhüllt nach dem Hausmuster aus `settings.js:3469` — das Verhalten der
  Originalfunktion bleibt unangetastet, es kommt nur etwas dahinter.
  Wächter-Flag gegen den Ringschluss.

  **Nachgemessen, fünf Fälle:**

  | Schritt | Vorlage | `dp_chrome_hell` |
  |---|---|---|
  | Skin = hell | `kontor` | 1 |
  | Skin = obsidian | *(entfernt)* | 0 |
  | Vorlage = konsole | `konsole` | 0 |
  | Vorlage = boarding | `boarding` | 1 |
  | Panel aktiv, dann Skin = hell | **`panel` bleibt** | 1 |

  Der letzte Fall ist der wichtige: Wer „Hell" schaltet und schon auf einer
  hellen Vorlage steht, behält sie. Nachgezogen wird nur, wenn die Vorlage
  der neuen Helligkeit **widerspricht** — sonst würde der Schalter eine
  bewusste Wahl überschreiben.

- [2026-08-05] **Aktionen-Menü gliedern** — `599821f`, `bf6b546`

  **Befund vorab — zwei Annahmen des Punktes stimmten nicht:**
  Das Menü hat **11 Einträge**, nicht „eine lange Liste". Und die
  Gliederungs-Mechanik **existierte bereits**: `.sb-act-section-title` stand
  schon vor „Daten" und „App", nur waren die ersten sieben Einträge
  ungruppiert. Es wurde deshalb nichts neu erfunden, sondern die vorhandene
  Mechanik durchgezogen.

  **Gliederung** nach der Backlog-Vorgabe:

  | Gruppe | Einträge |
  |---|---|
  | Ansichten | Einzelobjekt · Portfolio-Cockpit |
  | Analyse | Marktbericht |
  | Anlegen | Neues Objekt · Quick Boarding · Import |
  | Ausgeben | Track Record · Bankexport · Export |
  | System | Einstellungen · Feedback & Support |

  **Plan-Schranken — `dp-plan-gates.js` komplett neu.** Die alte Fassung
  hatte drei Fehler auf einmal:
  1. Sie **versteckte** per `display:none`. Der Punkt will das Gegenteil.
  2. Sie erkannte den Eintrag über einen **Textvergleich**
     (`textContent === 'Export'`) auf sichtbarem Nutztext — obwohl die
     `data-feature`-Marker die ganze Zeit daneben im Markup standen. Jede
     Umbenennung hätte sie ins Leere laufen lassen.
  3. Sie behandelte **nur** „Export". `track_record_pdf` und `bank_pdf_a3`
     trugen ihren Marker, wurden aber nie ausgewertet.

  Jetzt bleiben gesperrte Einträge **sichtbar**, ausgegraut, mit Schloss,
  und der Klick führt zu den Plänen statt ins Leere.

  **Die Falle dabei, ausdrücklich abgesichert:** CLAUDE.md — „Unbekannter
  Feature-Schlüssel ist für jeden `false`, auch für Pro." `hasFeature()`
  würde bei einem Tippfehler im Marker **allen zahlenden Kunden** den
  Eintrag wegnehmen. Deshalb wird nur gesperrt, wenn der Schlüssel
  nachweislich in den Features irgendeines bekannten Plans vorkommt.
  Unbekannt = offen lassen. Nachgemessen: Marker auf
  `tippfehler_gibt_es_nicht` gesetzt → **nicht** gesperrt.

  **Kerosin am Marktbericht: „ab 2 L".** Die Staffel steht in
  `backend/src/routes/marktbericht.js:34`
  (`COST = {fast:2, full:5, wertermittlung:12}`) — deshalb eine Spanne und
  keine erfundene feste Zahl, die volle Staffel steht im `title`.

  **Nachgemessen auf Staging, angemeldet:**

  | Viewport | Ergebnis |
  |---|---|
  | 1440 × 900 | 5 Gruppen, 0 versteckt, Kerosin am Marktbericht |
  | 390 × 844 | Menü 58–689, Trigger 697, **Überhang 0**, kein Ziel < 44 px |
  | 390 × 556 | Kasten 343 px, Inhalt 686 px — scrollt in sich, letzter Eintrag per `elementFromPoint` getroffen, 44 px hoch |
  | 820 × 1180 | alle Einträge **44 px**, 5 Gruppen, kein Überlauf |

  Sperr-Pfad mit gestubbtem Plan geprüft: alle drei Einträge **sichtbar**
  (`display` ≠ `none`), Deckkraft 0,5, Schloss da, `onclick` beiseitegelegt.

  **Eine Zwischendiagnose nehme ich ausdrücklich zurück:** Ich hatte bei
  390 × 556 „383 px abgeschnitten" gemeldet. Falsch — der innere Container
  scrollt (`scrollHeight 686`, `clientHeight 341`, `overflow-y:auto`); ich
  hatte ungescrollten Inhalt für abgeschnittenen gehalten. Ebenso war das
  gleichzeitige `max-height` **und** `bottom` am Kasten ein Artefakt meiner
  iframe-Messkabine: `resize` feuert im gedrosselten Tab nicht, also lief
  `_sbActionsDock()` nach dem Verkleinern nie neu. Nach manuellem Aufruf
  stand nur noch `max-height` — der v647-Code ist in Ordnung.

  **Nebenbefund, mitbehoben (v1084b):** Bei 820 px waren alle Einträge nur
  **36 px** hoch, bei 390 px dagegen 44. v650 hatte die Trefferflächen auf
  `max-width:768px` gelegt, v648 den Drawer aber auf 900 px gezogen — im
  Band dazwischen fehlte die Regel. Bestand schon vorher; gehört hierher,
  weil „funktioniert auf Desktop, Tablet und Handy" das Abnahmemaß ist.

- [2026-08-05] **Partner-Netzwerk lädt nicht** — `253664a`

  **Der Punkt war veraltet — das Netzwerk lädt.** Nachgemessen in einer
  angemeldeten Sitzung, Objekt geladen, Deal-Aktion-Tab offen:

  | Prüfung | Ergebnis |
  |---|---|
  | `Auth.apiCall('/network-cards')` | **5 Karten, 2 Kategorien** |
  | Rails im Deal-Aktion-Tab, Desktop | **2 Rails, 7 Karten**, keine Meldung |
  | Dieselbe Strecke bei **390 × 844** | **2 Rails, 7 Karten**, kein Seiten-Überlauf |

  Die fünf Partner erscheinen namentlich in den beiden Spuren
  (Finanzierung, Gutachter).

  **Ich kann nicht sagen, was es war** — der Fehlerzustand trat nicht mehr
  auf, und eine Ursache, die man nicht gesehen hat, wird hier nicht
  behauptet. Wahrscheinlichster Kandidat bleibt ein abgelaufenes Token;
  `v982-netauth` hat den Ladepfad zwischenzeitlich auf `Auth.apiCall`
  umgestellt.

  **Vorher ausgeschlossen (alles gemessen, Serverseite):** Route gemountet
  (401 ohne Token), Migrationen bis 63, Tabellen da, 5 Karten `aktiv`, kein
  `[network]`-Fehler in 72 h, keine 404 unter 167 Skripten, Antwort nur
  92 kB (also kein Timeout), keine Plan-Schranke auf dem Ladepfad, und die
  Renderstrecke mit den echten DB-Daten gegen `buildRails()` geprüft.

  **Eine Backlog-Annahme ist widerlegt:** `netzwerk-einreichung.js` stand
  als erste beteiligte Datei. Das Modul **bootet gar nicht** — `boot()`
  beginnt mit `return; /* v893p-off */`. Der Tab existiert nicht; gemeint
  waren immer die Rails in `deal-action-boarding.js`.

  **Was gebaut wurde (v1083), damit der nächste Fall greifbar ist:** Der
  catch-Zweig meldete **jede** Ursache als „Netzwerk aktuell nicht
  erreichbar." — auch ein abgelaufenes Token. Genau deshalb war der Punkt
  so lange nicht zu fassen. Jetzt unterscheidet er 401 / 403 / anderer
  Status / kein Status und schreibt eine Konsolenzeile dazu.
  Geprüft durch Stub: bei 401 steht „Sitzung abgelaufen — bitte einmal neu
  anmelden, dann ist das Netzwerk wieder da.", danach wieder 7 Karten.

  Dabei ein falscher Kommentar richtiggestellt: er versprach einen
  „zentralen 401-Handler (Re-Login + Retry)". Den gibt es nicht.
  `Auth.apiCall` wirft bei 401 nur einen Error mit `.status`, und
  `session-expired-banner.js` blendet einen Hinweisbalken ein — **kein
  Re-Login, kein Retry.**

- [2026-08-05] **Darstellungs-Modal mit sechs UI-Vorlagen** — `495e35c`, `ff6eba1`, `44ce7bb`, `bd77f4c`, `ff20dfb`, `8f603e9`

  Gebaut gegen `design/mockups/dp-darstellung-panel.html`. Die sechs Namen
  und ihr Zuschnitt sind am 2026-08-05 abgenommen. **Punkt 4 (Kartenmodi)
  und Punkt 5 (Kartenfläche) sind miterledigt** — sie hängen an denselben
  Attributen und wären getrennt eine zweite Mechanik gewesen. Der
  „Später"-Punkt mit den zwei 404 ebenfalls.

  **Befund vorab (gemessen, nicht geraten):** `css/ui-varianten.css` und
  `js/ui-varianten.js` waren seit 20260801 in `index.html:29` und `:3466`
  verlinkt und existierten nicht. Der Kommentar dort sagte schon „nach
  style.css, damit `html[data-ui-*]` greift" — der Platz war vorbereitet.

  Im DOM bei 1920 px gezählt: **65 Elemente mit deckender Hintergrundfarbe**
  (CLAUDE.md schätzte „rund 51"). Der Großteil sind Formularfelder und
  `div.card`, alle weiß — die folgen der Fläche. Deshalb **nicht 6 × 65
  Regeln, sondern ein Satz Flächenregeln plus 6 × ~30 Token-Zeilen.**

  **Die CLAUDE.md-Warnung „Token-Überschreibungen reichen nicht" gilt
  differenzierter als gedacht:**

  | Fläche | liest Tokens? |
  |---|---|
  | `aside.sidebar{background:var(--dp-s0)!important}` | **ja** |
  | `.sb-card{background:var(--dp-obj-card,…)!important}` | ja, aber siehe unten |
  | `header.hdr.has-v64-score + nav.tabs{background:rgb(10,8,5)!important}` | **nein, hart** |

  Die Tab-Leiste wurde deshalb einzeln benannt — mit demselben
  Nachbarschafts-Selektor plus `html[data-ui-theme]` davor, statt sich auf
  die Ladereihenfolge zu verlassen.

  **Vier Fehler, jeder erst durch Messung gefunden:**

  1. **v1082b · Halber Skin in der Objektkarte.** Kontrastlauf über alle
     Textknoten: `.sbc-mini-score-num` #FFFFFF auf #FFFFFF = **1.00**,
     `.sbcm-label` rgba(255,255,255,.7) auf #FAF9F7 = **1.05**. Die
     Kachel*fläche* war aufgehellt, die Schrift darauf nicht.
  2. **v1082c · Panel ging im gedrosselten Tab nicht auf.**
     `requestAnimationFrame` feuerte nach 700 ms **nicht**, die `open`-Klasse
     kam nie. Ersetzt durch erzwungenen Reflow (`void p.offsetWidth`) —
     synchron, ohne Zeitplaner.
  3. **v1082d · Die Objektkarte trägt ihre Farbe als Verlauf.** Gemessen:
     `background-color: rgba(0,0,0,0)` — transparent — und
     `background-image: linear-gradient(135deg, rgba(20,15,5,.6), rgba(0,0,0,.7))`.
     Das Token färbt nur `background-color`, der Verlauf lag darüber: auf
     hellen Vorlagen stand weiter eine **schwarze Karte in heller Leiste**.
     **Und meine eigene Messung war dafür blind** — sie las `backgroundColor`,
     sah die transparente Karte, stieg zur hellen Sidebar hoch und rechnete
     gegen Weiß. Der Kontrastlauf wurde nachgezogen, damit er Verläufe sieht.
  4. **v1082e · Wallet-Ringe standen leer.** Die Score-Zahl erbt
     `currentColor` (weiß) und der Wallet-Ring bekommt eine weiße Scheibe
     untergelegt. Im Bild gesehen, nicht gemessen — der Kontrastlauf deckte
     nur die vier hellen Vorlagen ab, der Fehler hängt aber am
     **Kartenmodus**. Im Mockup stand die Regel bereits; ich hatte sie beim
     Übertragen übersehen.

  **Nachgemessen auf Staging, angemeldet, mit fünf echten Objekten:**

  | Vorlage | Sidebar | Tabs | Karte |
  |---|---|---|---|
  | DealPilot (kein Attribut) | `0,0,0` | `10,8,5` | Verlauf, unverändert |
  | Kontor | `255,255,255` | `255,255,255` | `#FFFFFF` |
  | Panel | `255,255,255` | `255,255,255` | `#FFFFFF` |
  | Kanzlei | `251,250,247` | `251,250,247` | `#FFFFFF` |
  | Boarding | `250,245,232` | `250,245,232` | Creme |
  | Konsole | `22,24,28` | `22,24,28` | `#1A1D22` |

  Kontrastlauf über Objektkarte in allen sechs: **keine Stelle unter 2.5**.
  Alle Vorlagen auch bei **390 px und 820 px** gemessen, kein waagerechter
  Überlauf (`scrollWidth == innerWidth`). Panel auf dem Handy als Blatt von
  unten (390 × 658), keine Trefferfläche unter 44 px. Persistenz überlebt
  das Neuladen (alle drei Attribute), Inline-Boot im `<head>` verhindert das
  Aufblitzen.

  **Die wichtigste Zusicherung, ausdrücklich nachgemessen:** Nach
  „Zurücksetzen" sind alle drei Attribute `null` — **entfernt, nicht leer
  gesetzt** — und der Istzustand ist bitgenau zurück: Sidebar `rgb(0,0,0)`,
  Tabs `rgb(10,8,5)`, Karte transparent mit dem originalen Verlauf. Wer nicht
  umschaltet, merkt von diesem Paket nichts.

  **Punkt 6 teilweise:** Die Partner-Schranke ist von „Panel öffnen"
  (`settings.js:3395`, brach für jeden außer Partner ab) auf die
  **Farbsektion** gewandert. Vorlagen wählen darf jeder, Farben ab Partner,
  die Sektion bleibt sichtbar und ausgegraut — geprüft: `locked=true` ohne
  Partner-Plan, Hinweisleiste sichtbar.

  **Zu `gold-audit.py`:** Der Lauf stand vorher auf RC=1 mit **483**
  Fundstellen (Altlast in 56 Dateien). v1082 brachte **sieben neue** — meine
  eigene Vorgabe verletzt. Mit v1082f auf **eine** reduziert: der Fokusring
  auf `color-mix(… var(--wl-c9a84c, #C9A84C) …)`, die sechs Vorgabewerte auf
  eine Konstante `GOLD_STD`. Die bleibt bewusst ein rohes Literal — sie ist
  ein *Daten*wert: `var(--wl-…)` und `_wlc()` liefern beide den bereits
  umgefärbten Ton, genau den, den man ersetzen will. Stand jetzt **484**.
  RC=0 insgesamt ist ein eigenes Vorhaben.

  **Nachbesserung nach Marcels Bildern (`v1082g`–`v1082k`, `4e3f050`,
  `5261fcf`, `ada1638`, `cc87747`, `b58a289`):** Der Screenshot zeigte, dass
  die Wallet-Karten die halbe Karte zudeckten. Vier Ursachen, alle aus
  **einem** Fehler — ich hatte die Regeln aus dem Mockup übernommen, statt
  die echte Struktur auszulesen:

  | Was | Warum |
  |---|---|
  | Investor-Ribbon abgeschnitten | `overflow:hidden` auf der Karte — das Ribbon sitzt gemessen bei `top:-7px` und ragt absichtlich hinaus |
  | Foto, Preis, Kacheln fehlten | das `::before` lag mit `inset:0` über der **ganzen** `.sbc-top`; im Mockup deckt es nur zwei Rasterzeilen |
  | Foto 130 px statt 64 | Rasterzellen strecken ihren Inhalt per Voreinstellung |
  | Stufen-Pille über der Objektnummer | `.sbc-score-label` ist `display:block` mit `margin-top`, und `align-items` allein reichte nicht — Richtung und Umbruch mussten ausdrücklich gesetzt werden |

  **Der Grund, warum Abschreiben hier scheitern musste:** Im Mockup liegt
  `.sbc-score-overlay` **innerhalb** `.sbc-top`. In der echten App ist es ein
  **direktes Kind der Karte** und absolut positioniert. Genau die Stelle war
  nicht übertragbar — „übernommen wird die Gestaltung, nicht der Code".

  Dazu ein fünfter, eigenständiger Fehler: **„Kompakt" sparte nur 10 px**
  (198 gegen 208). Die Regel zielte auf `.sbc-mini-grid`, den **Behälter** —
  die Höhe steckt aber in den **Kacheln** `.sbcm` (67 von 77 px). CLAUDE.md
  nennt beide ausdrücklich getrennt; ich hatte das eine für das andere
  genommen.

  **Nachgemessen (Wallet, angemeldet, echte Objekte):** Band 53 px, Ring
  links (x 9), Score-Zahl lesbar, Nummer und Datum auf Gold, Pille rechts am
  Bandende, Foto 64 × 64 ohne Überlappung, Preis und alle drei Kacheln
  sichtbar, Investor-Ribbon ragt wie vorgesehen hinaus.
  Kartenhöhen: **Kompakt 171 · Standard 211 · Wallet 247 px** — die drei
  Modi unterscheiden sich jetzt sichtbar.

  **Nicht gebaut, bewusst:** die Kopplung von Skin-Schalter und Vorlage.
  Beide greifen gleichzeitig, die Vorlage gewinnt (Spezifität), aber es sind
  zwei Mechaniken für dieselbe Frage. Steht jetzt als eigener Punkt 3 —
  das ist eine Produktentscheidung, keine Reparatur.

- [2026-08-05] **Partner-Plan wurde von fünf Pro-Schranken ausgesperrt** — `f96e981`

  Nebenbefund aus der Diagnose zu Punkt 1, aber ein eigenständiger Fehler und
  deutlich größer als der Anlass.

  **Befund (gemessen an der DB, nicht angenommen):** Die `plans`-Tabelle führt
  **sieben** Pläne (`free starter investor pro partner business enterprise`),
  `PRICING` in `config.js` kennt **vier** (`free starter investor pro`).
  `partner` fehlt dort *bewusst* — `reseller-portal.js:568` spritzt ihn
  nachträglich ein und **klont dabei die Pro-Features** („Partner ist ein
  erweiterter Pro"). `pricing.plans` ist dieselbe Referenz wie `PRICING`,
  deshalb liefert `currentKey()` danach korrekt `'partner'`.

  **Fünf Stellen verglichen trotzdem hart auf `currentKey() === 'pro'`** und
  sperrten damit ausgerechnet den **höheren** Plan aus:

  | Datei | Was dem Partner fehlte |
  |---|---|
  | `netzwerk-einreichung.js:26` | Teaser „Pro freischalten" statt Einreichungsformular |
  | `deal-action.js:60` | Deal-Aktion-Konfiguration |
  | `apikeys.js:12` | API-Zugang — obwohl `api_access` in der DB-Zeile `true` ist |
  | `settings.js:1360` | Branding-Routing |
  | `config.js:846` | Farbpalette (`_isPalette`) |

  `settings.js:3164` und `:3247` machen es richtig
  (`(k==='pro'||k==='partner')`) — das war die Vorlage. `settings.js:3392`
  prüft sogar auf `!== 'partner'` und funktioniert nur, weil
  `reseller-portal.js` vorher einspritzt. Es waren also zwei Muster im Umlauf.

  Auf Staging betrifft das **2 aktive Partner-Abos** — der teuerste Plan.

  **Fix (v1081):** eine Quelle statt fünf Vergleichen. Neu
  `DealPilotConfig.pricing.isProOrAbove()` mit der Liste `PRO_FAMILIE` in
  `config.js`; alle fünf Stellen darauf umgestellt, jede mit Inline-Rückfall
  auf `(k==='pro'||k==='partner')`, falls `config.js` einmal älter ausgeliefert
  wird. `config` TR8→TR9, `apikeys` 810→811, `settings` W22→W23,
  `deal-action` W33→W34, `netzwerk-einreichung` 893p→v1081.

  **Nachgemessen auf Staging:** `Sub.getCurrentSync()` der Reihe nach auf jeden
  Plan gestellt — `free`/`starter`/`investor` → `false`, `pro`/`partner` →
  **`true`**. `pricing.plans` enthält alle fünf Schlüssel. `node --check` auf
  allen fünf Dateien sauber.

  **Nicht bewiesen:** dass das die Ursache von Punkt 1 ist. Die
  Einreichungsstrecke, die hier am sichtbarsten betroffen wäre, ist per
  `v893p-off` ohnehin abgeschaltet. Der Fix steht für sich.

- [2026-08-05] **Logo-Rahmen auf flachen Viewports, Ausrichtungs-Regler wieder wirksam** — `a4b1291`

  Nachtrag zu v1079 (rahmenlose Wortmarke + gezeichneter Goldrahmen). Die
  **Gestaltung bleibt unangetastet**, nur die Größe hängt jetzt am Viewport.

  **Befund (gemessen auf Staging, gleich-Origin-iframe, Drawer offen):**

  | Viewport | `.sb-header` | Rahmen | Bild |
  |---|---|---|---|
  | 390 × 844 | 116 | 296 × 78 | 260 × 48 |
  | 390 × 556 | **108** | 296 × 78 | 260 × 48 |
  | 390 × 476 | **108** | 296 × 78 | 260 × 48 |
  | 820 × 1180 | 121 | 323 × 83 | 287 × 53 |
  | 1024 × 768 | 104 | 213 × 62 | 177 × 32 |
  | 1440 × 900 | 125 | 323 × 83 | 287 × 53 |

  Kein waagerechter Überlauf in irgendeiner Fassung, eingeklappte Leiste
  unverändert (66 px, Logo `display:none`, „D"/„P" aus `::before`/`::after`,
  **kein** Goldrahmen), Hellmodus zieht den schwarzen Kasten aus CSS.

  **Zwei Fehler in den Zeilen dazwischen:**
  1. `--dp-logo-max` (v646) ist **tot**. Der Deckel saß auf dem *Bild*; die
     gleichnamige v1079-Regel am Dateiende setzt `max-width:100%` und gewinnt
     bei gleicher Spezifität als spätere. Deshalb blieb der Kopf auf flachen
     Viewports bei 108 px stehen, statt weiter nachzugeben — bei 476 px Höhe
     ein knappes Viertel des Schirms. Der Deckel gehört seit v1079 ohnehin
     nicht mehr aufs Bild: das Bild füllt den Rahmen, ein gedeckeltes Bild
     würde darin schwimmen. Jetzt schrumpft der **Rahmen**, das Bild folgt.
  2. `justify-content` stand in v1079 fest auf `center` und hat den
     **Ausrichtungs-Regler** (`--dp-logo-justify`, `settings.js:3328`) still
     totgelegt. Gemessen: `flex-start` gesetzt, computed blieb `center`.

  **Nachgemessen auf Staging (W49):** 390 × 556 → `.sb-header` **81 px**
  (vorher 108), Liste 327 → **354 px** · 390 × 476 → **66 px** (vorher 108),
  Liste 247 → **289 px**. 390 × 844, 820, 1024, 1440 unverändert.
  Ausrichtung: `flex-start` → Bild bei 18 px vom Rahmenrand, `flex-end` → 133 px.
  Größen-Regler weiter wirksam (60 % → 106 statt 177 px).

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

- [2026-08-04] **Marktbericht auf Handy und Tablet** — `e669327`, `e9a4d7b`

  Eigener Namensraum **v1077 (Marktbericht)**, nichts mit der Haupt-App
  gemischt.

  **Befund Eingabestrecke (gemessen bei 390 × 844, dieselbe Strecke, die
  im iframe der App läuft):** kein waagerechter Überlauf — v620 sitzt.
  Aber **54 Eingabefelder auf 15 px** und eines auf 13 px → iOS Safari
  zoomt bei jedem Antippen hinein. Und drei Knöpfe unter 44 px:
  `.mbrep-tog` 70 × 26, `#saveFileBtn` und `#loadFileBtn` je 150 × 32.

  **Befund fertiger Bericht (an einem gespeicherten Bericht gemessen, ohne
  neuen Kerosin-Abruf):** `body.scrollWidth` **639** statt 375. Vier
  Stellen, alle derselbe Fall — ein Rasterkind mit `min-width:auto` zieht
  die Spur auf:

  | Element | war |
  |---|---|
  | `.grid` | Spur 646 px statt 347 |
  | `#addrAC` (Vorschlagsliste am `body`) | 602 px breit |
  | `#microGrid` | zwei Spalten 238 + 354 = **592** in 305 px |
  | `.wv-g` | drei Spalten 153 + 140 + 110 = **402** in 305 px |

  **Befund Karte:** Leaflet zieht per Voreinstellung schon mit **einem**
  Finger. In einer 3 200 px langen Berichtsseite heißt das: wer beim
  Scrollen die Karte trifft, bleibt darin hängen.

  **Fix (v1077, `marktbericht-app` 1076→1077b):**
  Neuer Block `v1077-mb-touch` bei ≤ 768 px — Felder auf 16 px,
  Trefferflächen auf 44 px, Karte auf 60 vh mit 40-px-Zoomknöpfen,
  Diagramme und Tabellen auch **oberhalb** 560 px begrenzt (v620 deckte
  nur ≤ 560 ab), Klappblöcke v1075/v1076 umbrechend, dazu die vier
  Raster-Stellen des fertigen Berichts.
  Karte: ein Finger scrollt die Seite, **zwei** Finger bewegen und zoomen,
  mit kurzem Hinweis beim Ein-Finger-Versuch — nur auf Zeigern ohne Hover,
  auf Maus und Trackpad bleibt alles wie gehabt. Kneifen zum Zoomen bleibt
  in jedem Fall an. Keine Farbwerte angefasst (`var()` greift in Leaflet
  nicht).

  **Nachgemessen auf Staging (1077b), fertiger Bericht bei 390 px:**
  `docScroll = 0`, `body.scrollWidth = 375 = clientWidth`, **kein**
  Element über dem rechten Rand. Bericht 3 194 px hoch, Karte 420 px,
  PDF-Knopf 44 px hoch. `#microGrid` und `.wv-g` einspaltig (305 px).
  Eingabestrecke: kein Feld mehr unter 16 px, kein Ziel mehr unter 44 px.

  **Staging-Abnahmepunkte — hier ehrlich offen:**
  1. **PDF-Erzeugung.** Der Knopf steht und ist 44 px hoch, ein echter
     Klick lädt eine Datei herunter — das habe ich nicht ausgelöst.
  2. **Zwei-Finger-Geste auf der Karte.** Der Pfad hängt an
     `matchMedia('(hover:none)')` und greift deshalb im Prüfbrowser nicht.
     Die Regeln sind gemessen (`#map` steht auf `touch-action:pan-y`, der
     Hinweis auf `position:absolute; z-index:1000`), die Geste selbst
     gehört auf ein echtes Telefon.
  3. **Erzeugen eines neuen Berichts bei 390 px.** Bewusst nicht erzwungen:
     der Lauf kostet 5 L Kerosin und hängt an einem `window.confirm`, das
     die Browser-Steuerung blockiert. Geprüft wurde stattdessen ein
     bereits gespeicherter Bericht — dieselbe Renderstrecke, gleiche
     Darstellung.

- [2026-08-04] **Übrige Seiten und Bereiche** — `30d1d69`, `6069a7a`, `a3651c9`, `60c0b80`

  **Befund (gemessen bei 390 × 844, Bereich für Bereich durchgeklickt):**
  Waagerechter Überlauf gab es fast nirgends mehr — die Sammelursachen
  hatte v650 schon erledigt. Übrig blieben Felder unter 16 px und Knöpfe
  unter 44 px, und die sitzen alle **außerhalb von `.body`**, weshalb der
  v650-Block sie nicht erwischt hat:

  | Bereich | Befund |
  |---|---|
  | Alle Objekte · Track Record · Bankexport · Quick Check | `#sb-search-input` **12,5 px** |
  | Einstellungen, alle 11 Abschnitte | `set_user_*`, `set_pwd_*`, `dp-ec-*` u. a. **13 px**; `.set-modal-close` und `.help-sidebar-item` unter 44 px |
  | Anmeldung · Registrierung · Passwort vergessen | `auth-email`, `auth-password`, `pw-reset-email` **13,5 px** |
  | Bankexport · Quick Check | `.dpm-x` unter 44 px |
  | Preise / Upgrade | `.pricing-modal-close`, `a.bw-cta` unter 44 px |
  | Reseller-Portal | acht Felder **14 px**, eines 13,3 px; Rücklink unter 44 px |
  | Rechtliches (Impressum · Datenschutz · AGB) | Rück- und Fußzeilen-Links unter 44 px |
  | **Datenschutz** | Tabelle der Auftragsverarbeiter: `body.scrollWidth` **430** statt 375 — echt breiter als der Schirm |
  | **Alle Objekte, Listenansicht** | `.ao-table` ist **700 px** breit und scrollt in `.ao-table-wrap` — ohne sichtbaren Hinweis |

  **Fix (v652, `style.css` W45→W47, dazu die vier eigenständigen Seiten):**
  Felder in `#auth-modal`, `#settings-modal`, `.set-modal-cream`,
  `.global-view-overlay` und `#sb-search-input` auf **16 px** — mit
  `:not()` für Kontrollkästchen, Schalter, Farb- und Dateifelder, bei denen
  iOS ohnehin nicht zoomt. Trefferflächen wie in v650 über ein unsichtbares
  `::after` mit `max(100%,44px)`, damit die Optik unverändert bleibt.
  Die Objekttabelle bekommt einen Verlaufs-Hinweis am rechten Rand.
  `impressum.html`, `datenschutz.html`, `agb.html` und `reseller.html`
  tragen jeweils einen eigenen `@media (max-width:768px)`-Block — sie haben
  kein gemeinsames Stylesheet.

  **Nachgemessen auf Staging (W47), jeder Bereich einzeln:**

  | Bereich | Überlauf | Felder < 16 px | Ziele < 44 px |
  |---|---|---|---|
  | Alle Objekte | 0 | 0 | 0 |
  | Einstellungen | 0 | 0 | 0 |
  | Track Record | 0 | 0 | 0 |
  | Bankexport | 0 | 0 | 0 |
  | Quick Check | 0 | 0 | 0 |
  | Anmeldung / Registrierung / Passwort | 0 | 0 | 0 |
  | Preise / Upgrade | 0 | 0 | 0 |
  | Datenraum | 0 | 0 | 0 |
  | Impressum | `bodySW 375` | – | 0 |
  | Datenschutz | `bodySW 378` (vorher 430) | – | 0 |
  | AGB | `bodySW 375` | – | 0 |
  | Reseller-Portal | `bodySW 375` | 0 | 0 |

  **Nebenbefund, noch offen:** Beim Durchklicken der Einstellungs-Abschnitte
  fror der Prüf-Browser zweimal ein, sobald mehrere der hinteren Abschnitte
  (`anbieter`, `mandanten`, `plan`, `rechtliches`, `help`) in einem Zug
  gerendert wurden. Einzeln geöffnet ist jeder unauffällig. Das kann ein
  Artefakt der Automatisierung sein oder ein echter Rendering-Kostenpunkt —
  nicht weiter verfolgt, gehört auf ein echtes Gerät.

- [2026-08-06] **Kartenmodus „Stapel" (Handy-Optik)** — `v1095`, `v1095b`

  Vorlage `design/mockups/handy2.jpg`. Zugeklappt eine goldene Zeile mit
  Score-Ring links auf dem Verlauf, Adresse fett daneben, Nummer und Datum
  klein darunter, Stufen-Abzeichen rechts, Chevron außen.

  **Nachgemessen:** zu **61 px**, offen **255 px**; Band 343 × 59; Ring
  x 21, Abzeichen x 305–336, Chevron x 330. Aufgeklappt sind Foto, Preis,
  Halter und KPI-Kacheln alle da. Das Goldband ist in **allen vier**
  geprüften Vorlagen identisch (`rgb(232,204,122) → rgb(201,…)`) — es ist
  das Kennzeichen des Modus, hell wie dunkel. Der Rumpf folgt dagegen der
  Vorlagenfarbe, damit Kontor keinen schwarzen Block bekommt.

  Aufgeklappt wird über dieselbe Mechanik wie „Kompakt"
  (`js/karten-kompakt.js`, Klasse `.uv-open`); `kompaktAn()` nimmt jetzt
  beide Modi. `CARDS` in `ui-varianten.js:45` um `{ key:'stapel' }`
  erweitert — der Umschalter zeichnet den vierten Knopf von selbst.

  **Ein Fehler unterwegs (v1095b):** das Stufen-Abzeichen stand bei x 0.
  Mein `position:absolute` bezog sich auf `.sbc-score-overlay` — das ist
  selbst absolut und damit der positionierte Vorfahr, nicht die Karte. Bei
  `left:8px` und automatischer Breite schob `right:30px` es aus dem Bild.
  Richtig ist das Muster aus v1082j: das Overlay spannt über die Bandbreite
  und schiebt Ring und Abzeichen per `space-between` auseinander.
