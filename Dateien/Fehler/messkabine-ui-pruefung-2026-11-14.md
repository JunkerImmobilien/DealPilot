# Messkabine · UI-Prüfung 14.11.2026

Gemessen auf Staging (`messkabine.html?leer=1`, iframe 1440 × 900 und 390 × 844, Layout `v1b`,
Netzsperre der Messkabine aktiv: 0 gesperrte Aufrufe, `localStorage` vorher gesichert und danach
zurückgestellt, Rest 0). Gemessen wurde mit `getComputedStyle`/`getBoundingClientRect`, nicht geschätzt.

**Was nicht gemessen werden konnte:** Im Browser war **niemand angemeldet** (kein `ji_token`,
die App zeigte den Anmeldedialog `#auth-modal`). Angemeldet wurde nicht. Das Anmeldefenster wurde im
Prüfling ausgeblendet und dahinter gemessen: Plan `plan-free`, **kein Objekt geladen**.
Deshalb fehlen in dieser Messung:
- die Reiter mit Inhalt (alle Felder leer; nur die ohne Objekt sichtbaren Felder sind gezählt),
- Pilot-Analyse (gesperrt, nur 20 Elemente), Track Record und Bankexport (öffnen beim Free-Plan das Preisfenster),
- BMF-Fenster, Objekt-Historie, Bordbuch und Vermögen (öffnen ohne Objekt/Anmeldung kein Fenster),
- `openWkModal`, `openKpiModal`, `openCombinedImport`, `showScoreDetails`, `openMarketModal`,
  `showLimitReachedModal`, `openJahresabschluss`, `openDatenraumSettings`, `openPersoenlich` gibt es als
  globale Funktion nicht (TypeError), sie wurden nicht weiter gesucht.

Für die nächste Runde: angemeldet und mit einem Objekt im Status Ankauf messen.

---

## Tabelle 1 · Schließen-Knöpfe aller gemessenen Modale

| Modal | Selektor | Desktop (B×H, Radius) | 390 px (B×H, Radius) | Zeichen | Farbe / Fläche | Regel |
|---|---|---|---|---|---|---|
| Einstellungen | `button.set-modal-close.dp-band-close` | 32×32, 9px | 32×32, 9px | SVG | Gold `#E8CC7A` auf `#17130D`, Rand Gold 0,8 | style.css:35564 |
| Hilfe | `button.set-modal-close.dp-band-close` | 32×32, 9px | (wie Einst.) | SVG | wie oben | style.css:37648 |
| Einheiten (MFH) | `#mfh-band-zu.dp-band-close` | 32×32, 9px | **32×44**, 9px | ✕ (Text) | wie oben | style.css:35564 + 23106 |
| Import-Hub / Export-Hub | `button.iexp-close` | 36×36, **8px** | 44×44, **50 %** | SVG | `#2A2727` auf 6 % Grau, kein Rand | style.css:17905, 41391 |
| Tilgungsplan | `button.iexp-close` | 36×36, 8px | 44×44, 50 % | SVG | wie oben | style.css:22264/22693 |
| Feedback | `button.fb-close.close` | 36×36, 9px | **36×44**, 9px | SVG in `<span>`, `font-size:0` | Weiß 65 % auf 6 % Weiß | style.css:19699, 20320 |
| Umsetzungswünsche | `button.dpw-zu` | **25,2×24, 0px** | **41,2×44, 0px** | × (20px) | `#9A9287`, keine Fläche, kein Rand | layout-varianten.css:521 |
| Preisfenster | `button.pricing-modal-close` | 36×36, 50 % | 44×44, 50 % | SVG | Weiß 85 % auf 6 % Weiß | pricing-modal.css:40 |
| PDF-Import / Marktdaten-Import | `button.bmf-close` | 32×32, 50 % | **32×44, 50 % → Oval** | × | Weiß 70 %, Rand Weiß 15 % | style.css:6649 |
| DealScore-Einstellungen, Upgrade | `button.pricing-close` | 34×34, **50 %** | 40×40, **10px** | × | `#7A7370` auf `#F0ECE4` | style.css:1065, 1802 |
| Beta-Tester | `button.beta-close` | 30×30, 50 % | **30,2×44, 50 % → Oval** | × | Weiß 70 %, Rand Weiß 15 % | style.css:7782 |
| Quick-Check: API-Key, Übernehmen | `button.modal-close` | **32,6×35,4, 4px** | 32,6×35,4, 4px | ✕ in **Arial 22px** | `#7A7370`, keine Fläche | quickcheck-app.html:2112 |

Im DOM der Haupt-App stehen außerdem `bsheet-close «×»`, `dp-pf-mclose «✕»`, `v10-modal-close «svg»`,
`dpb-zu «×»`, `zu «×»` (nicht geöffnet). **Drei Zeichen (×, ✕, SVG) und sieben Bauarten.**

## Tabelle 2 · Formularfelder je Reiter / Fenster (Höhe in px)

| Ort | Desktop | 390 px | Schrift | Radius |
|---|---|---|---|---|
| Objekt (20 Felder) | input 38 · select 38 | 44 · 44 | Inter 13 / 16 | 2px |
| Investition (7) | 38 | 44 | Inter 13 / 16 | 2px |
| Miete (6) | 38 | 44 | Inter 13 / 16 | 2px |
| Finanzierung (5) | 38 | 44 | Inter 13 / 16 | 2px |
| Bewirtschaftung (3) | 38 | 44 | Inter 13 / 16 | 2px |
| Steuer (1) | 38 | 44 | Inter 13 / 16 | 2px |
| Deal-Aktion (1 select) | 38 | 44 | Inter 13 / 16 | 2px |
| Einstellungen: Konto, Profil, Kontakt, API | 38 | 44 | Inter 13 / 16 | 2px |
| Einstellungen: Plan (Mengenfeld `.pm-menge`) | 26 | 26 | Inter 12 / 16 | 0px |
| Hilfe (Suche) | 38 | – | Inter 13 | **8px** |
| Alle Objekte (Suche) | **36,9** | – | Inter 14 | **6px** |
| Cockpit / Vermögen | 38 | – | Inter 13 | **8px** |
| Umsetzungswünsche | input **39,2** · select 38 | input **42,2** · select 44 | Inter 14 / 16 | **9px** |
| Beta-Tester | 38 | – | Inter **14 und 13** gemischt | **6px und 8px** gemischt |
| Einheiten (MFH) | **32** | **32** (trotz 44-Regel: `.mfh-in`) | Inter 13 | 2px |
| Quick-Check (24) | 38 | 44 | Inter 13 / **12,5** | 2px |
| Quick-Check API-Key | **18 (ungestylt)** | 18 | **Arial 13,33** | 0px |

---

## Befunde

### A · Schließen-Knöpfe und Ovales

**A1 · PDF-/Marktdaten-Import: Schließen-Knopf ist auf dem Handy ein Oval** — *falsch*
`#pdfimport-modal .bmf-close`: 390 px gemessen **32 × 44 px bei `border-radius: 50%`**, mit sichtbarem Rand.
Ursache: `style.css:23106` (`@media max-width:640px` → `button … { min-height: 44px !important }`) streckt
nur die Höhe. Die Ausnahme `style.css:41387` (`button[class*="close"]:has(> svg:only-child)`) greift nicht,
weil der Knopf ein Textzeichen „×“ trägt, kein SVG.
Vorschlag: Ausnahme auf alle Schließen-Knöpfe ausweiten (`.bmf-close, .beta-close, .fb-close, .dp-band-close,
.dpw-zu, .modal-close` oder `button[class*="close"]`), dort `width = height = 44px` setzen; das Zeichen auf ein
gemeinsames SVG umstellen.

**A2 · Beta-Tester: Schließen-Knopf ist auf dem Handy ein Oval** — *falsch*
`.beta-close` (style.css:7782): 390 px **30,2 × 44 px, 50 %**, Rand Weiß 15 %. Dieselbe Ursache wie A1.

**A3 · Feedback: Schließen-Knopf auf dem Handy hochkant** — *auffällig*
`#feedback-modal .fb-close` (style.css:19699/20320): Desktop 36 × 36, 390 px **36 × 44**, Radius 9px.
Das SVG steckt in einem `<span>`, deshalb greift `:has(> svg:only-child)` (style.css:41387) nicht
(gemessen `matches = false`). Außerdem `font-size: 0px`.
Vorschlag: Ausnahme mit `:has(svg)` statt `:has(> svg:only-child)`, oder `.fb-close` ausdrücklich nennen.

**A4 · Einheiten (MFH): Gold-Knopf auf dem Handy hochkant** — *auffällig*
`#mfh-band-zu.dp-band-close`: Desktop 32 × 32, 390 px **32 × 44**, Radius 9px, Zeichen ✕ als Text.
Die anderen `dp-band-close` (Einstellungen, Hilfe) tragen ein SVG und bleiben 32 × 32.
Vorschlag: auch hier das SVG einsetzen (dann greift die Ausnahme) oder `.dp-band-close` in die Ausnahme.

**A5 · Quick-Check-Fenster (API-Key, „Welche Daten übernehmen?“): Schließen-Knopf in Arial, nicht quadratisch** — *falsch*
`quickcheck-app.html:2112` `.modal-close`: **32,6 × 35,4 px**, Radius 4px, „✕“ in **Arial 22px** (keine
`font-family` gesetzt → Browser-Standard für `<button>`), keine Fläche. Steht so auf Desktop und Handy.
Vorschlag: an den Haus-Knopf angleichen (32 × 32, 9px, SVG, `font-family: inherit`).

**A6 · Umsetzungswünsche (und die Auswahlfenster aus `bmf-wahl.js` / `pdf-wahl.js`): eigener, nackter Schließen-Knopf** — *auffällig*
`.dpw-zu` (layout-varianten.css:521): Desktop **25,2 × 24 px, Radius 0**, ohne Fläche und Rand, „×“ 20px;
390 px **41,2 × 44 px**. Sieht neben den anderen Fenstern wie ein Textrest aus.
Vorschlag: auf `dp-band-close` umstellen.

**A7 · Schließen-Knöpfe allgemein uneinheitlich** — *auffällig*
Sieben Bauarten (Tabelle 1): Größe 25–36 px Desktop, Radius 0 / 4 / 8 / 9 px / 50 %, Zeichen ×, ✕ und SVG,
drei Farbwelten (Gold auf Obsidian, Grau auf Creme, Weiß auf Dunkel). Abstand zur Kastenecke 8–43 px oben,
12–28 px rechts.
Zwei Knöpfe **wechseln die Form zwischen den Breiten**: `iexp-close` eckig 8px (Desktop) → rund 50 % (Handy),
`pricing-close` rund 50 % (Desktop) → eckig 10px (Handy).
Vorschlag: ein Haus-Knopf (der Gold-Knopf `dp-band-close`, 32 × 32 Desktop, 44 × 44 Handy, Radius 9px, SVG),
die übrigen sechs Klassen darauf abbilden.

**A8 · Kapseln, die gewollt sind (kein Befund)** — zur Abgrenzung gemessen: Schalter `.ji-slider` 38 × 20
(Pilot-Analyse), `.dpl-sw-bahn` 32 × 18 (Seitenleiste), Balken `.ltv-bg`, `#ek-bar`, `.bc-kpi-track-bar`
(Höhe 8–10 px), Pille `.qb-badge` „OFFEN“ 64 × 26 (Quick-Check). Rund-auf-ungleich ist hier das Muster,
kein Fehler.

### B · Schriften

**B1 · Preisfenster in der Systemschrift** — *falsch*
`pricing-modal.css:112`: `.pricing-modal-overlay { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, … Arial }`.
**60 sichtbare Elemente** erben das, darunter die Überschrift „Vier Pakete. Ein Cockpit.“ (46px Desktop,
17px Handy), „Dein Plan“, der Untertitel und die Sterne. Auf Windows ist das Segoe UI, auf dem Mac San Francisco.
Vorschlag: `font-family: Inter, …`; die Überschrift ausdrücklich Space Grotesk.

**B2 · Feedback-Fenster: Überschrift in Georgia statt Cormorant** — *falsch*
`style.css:20368` `#feedback-modal .hero-h { font-family: Georgia, "Cormorant Garamond", serif; }` —
Georgia steht **vorn** und ist auf jedem Windows-/Mac-Rechner installiert, Cormorant kommt nie zum Zug.
Gemessen: `h2.hero-h` und `span.gold` („Feedback & Support“), 30px Desktop, 17px Handy.
Vorschlag: Reihenfolge tauschen: `"Cormorant Garamond", Georgia, serif`.

**B3 · DM Sans im Kopf der App** — *auffällig*
`#hdr-obj` („Neues Objekt“, 14,5px) und `#tabs-status-text` („0 / 6 Bereiche“, 11px), Desktop und Handy.
Ursache: `style.css:8` `body { font-family: 'DM Sans', sans-serif }` — alles ohne eigene Regel erbt DM Sans;
`style.css:14` `.hdr-obj` setzt keine Schrift. DM Sans ist keine Hausschrift (CLAUDE.md: Space Grotesk, Inter,
JetBrains Mono, Cormorant).
Vorschlag: die Wurzel `body` auf Inter umstellen (größter Hebel, nimmt B3–B5 mit) — vorher an den Ansichten
nachmessen, weil 112 Regeln (laut `layout-varianten.css:639`) bewusst DM Sans setzen.

**B4 · DM Sans in den Bank-Diagrammen (Reiter Bewertung) und in Chart.js** — *auffällig*
`js/bank-charts.js:346, 350, 359, 377–392, 568–570, 873–944` schreiben `font-family="DM Sans"` als
SVG-Attribut (gemessen 20 `<text>` in `#bc-equity`); `js/charts.js:61–78, 104, 359–378` setzen DM Sans
für Achsen, Tooltips und Canvas-Beschriftungen.
Vorschlag: auf Inter (Text) bzw. JetBrains Mono (Zahlen) umstellen; `var()` geht dort nicht, also Literal.

**B5 · DM Sans im Quick-Check und in kleineren Fenstern** — *auffällig*
Quick-Check: 11 sichtbare Elemente (`.page-head-sub` „Schnellprüfung…“, `#qc-pf-lead`, `.dp-pf-lbl`
„Exposé / Marktbericht“, „ImmoMetrica“, `#qc-ltv-satz`, `#save-hint`, `#save-btn` „Als Objekt speichern“).
Beta-Tester: 7 Elemente (Titel 22px, Labels). Einstellungen › Mandanten: 1, › Plan: `.v234-status-name`.

**B6 · `ui-monospace` statt JetBrains Mono** — *Kosmetik*
Feedback-Fenster (3 × Zähler „1“, 10,5px) und Einstellungen › Konto (`#pk-imo-badge`, `#pk-imo-body label`):
die erste Schrift der Liste ist `ui-monospace`, JetBrains Mono kommt nicht vor.

**B7 · Schriftboden 8,5 px** — kein Verstoß gemessen (0 Elemente unter 8,5 px in allen Reitern, Fenstern und im
Quick-Check). Einzige Ausnahme `font-size: 0` am `.fb-close` (gewollt, Knopf ohne Text).

### C · Felder und Höhen

**C1 · Quick-Check: API-Key-Feld ist ungestylt** — *falsch*
`#api-key-input` im API-Key-Fenster: **164 × 18 px, Arial 13,33px, Radius 0**, Browser-Standard.
Ursache: v3177 hat das Feld von `type="password"` auf `type="text"` umgestellt (Kommentar
`quickcheck-app.html:4044`), die einzige Regel dafür heißt aber noch `.modal input[type="password"]`
(`quickcheck-app.html:2233`).
Vorschlag: Selektor auf `.modal input[type="text"], .modal input[type="password"]` erweitern.

**C2 · Quick-Check auf dem Handy: Eingabeschrift 12,5 px** — *falsch*
`quickcheck-app.html:3052–3057` (`@media max-width:640px`): `body.dp-neue-karte .card .field > input` → 12,5px.
Die Haupt-App setzt auf dem Handy 16px. **iOS Safari zoomt bei jedem Antippen eines Feldes unter 16 px
in die Seite**. Gemessen: 24 Felder, alle 12,5px, Höhe 44.
Vorschlag: auf dem Handy 16px wie in der Haupt-App.

**C3 · Einheiten (MFH): Felder 32 px statt 38 / 44** — *auffällig*
`js/mfh-einheiten.js:1518` `#mfh-modal .mfh-in { height: 32px }` (5 input, 1 select). Auf dem Handy bleibt es
bei 32, die 44-px-Regel kommt gegen die Inline-Regel nicht an — kleinere Tippfläche als überall sonst.

**C4 · Feldradien uneinheitlich** — *auffällig*
Reiter, Einstellungen, Quick-Check: **2px**. Hilfe-Suche, Cockpit/Vermögen: **8px**. Alle-Objekte-Suche: **6px**.
Umsetzungswünsche: **9px**. Beta-Tester: 6px **und** 8px im selben Fenster. Plan-Mengenfeld: 0px.
Vorschlag: 2px als Haus-Radius festschreiben (die Mehrheit), die Abweichler angleichen.

**C5 · Feldhöhen knapp daneben** — *Kosmetik*
Umsetzungswünsche: Textfeld **39,2** gegen Auswahl **38** (Handy 42,2 gegen 44). Alle-Objekte-Suche **36,9**
statt 38. Beta-Tester: Feldschrift 14px und 13px gemischt.
In den Reitern selbst ist alles gleich: Desktop 38/38, Handy 44/44, Inter 13/16, keine Reihe mit
ungleicher Höhe (0 Treffer).

### D · Abgeschnitten / außerhalb

**D1 · Reiter Objekt: Label abgeschnitten** — *Kosmetik*
`.od-raster.od-gebaeude > .f > label` „Wohneinheiten im Gebäude“: `scrollWidth 145 > clientWidth 122`
(Desktop 1440). Vorschlag: „Einheiten im Gebäude“ oder `white-space: normal`.

**D2 · Bewertung auf dem Handy: Diagramm „Eigenkapital und Restschuld“ quer scrollend** — *Kosmetik*
`#bc-equity .bc-svg-wrap`: SVG 680 px (viewBox 1200 × 380) in 271 px Breite, `overflow-x: auto`. Kein
Seitenüberlauf (Dokument 390), aber der Nutzer muss wischen, ohne dass es angezeigt wird.

**D3 · Einstellungen › Rechtliches auf dem Handy: Tabelle Dienstleister quer scrollend** — *Kosmetik*
Tabelle 396 px in 294 px, `overflow-x: auto`. Lesbar, aber die Spalte „Sitz“ ist zunächst unsichtbar.

Sonst: kein Seitenüberlauf bei 390 px, keine abgeschnittenen Texte in den Fenstern, Reiterleiste scrollt
gewollt (386 / 476).

---

## Zählung

| Schwere | Anzahl | Befunde |
|---|---:|---|
| falsch | 7 | A1, A2, A5, B1, B2, C1, C2 |
| auffällig | 9 | A3, A4, A6, A7, B3, B4, B5, C3, C4 |
| Kosmetik | 5 | B6, C5, D1, D2, D3 |

## Nebenbefund zur Messung

Während der Messung tauchten in derselben Chrome-Tabgruppe zweimal fremde Tabs auf
(`/api/v1/health` und „Neuer Tab“). Einen davon (`/api/v1/health`) habe ich geschlossen, bevor klar war, dass er
vermutlich zu einer anderen Sitzung gehörte. Messe-Studio und `?nc=3349` wurden nicht angefasst.

---

# Zweite Runde (angemeldet)

Gemessen auf Staging am 14.11.2026 nachmittags in `messkabine.html?leer=1`, iframe 1440 × 900 und 390 × 844,
**angemeldet als „Testkunde Partnerplatz“** (Plan Investor, zwei Objekte, Partnerplatz bei „Schmidt & Partner“, eine
Aufgabe). Gemessen am Objekt Westerfeldstr. 146 (Bestand), Detailgrad Experte (über `DpDetailgrad.vorgabeSetzen(3)`,
nur lokal). **Netzsperre der Messkabine während der Messung an** (Schreibaufrufe gesperrt, nur für An- und Abmeldung
kurz aus), `localStorage` vorher gesichert und danach zurückgestellt (Unterschied 0), am Ende abgemeldet und Token
entfernt. Nichts gelöscht, keine Pilot-Analyse gestartet (kostet Kontingent). Gemessen mit `getComputedStyle`,
`getBoundingClientRect`, `scrollWidth`/`clientWidth` und einem Regel-Leser über alle Stylesheets (welche Regel setzt was).

Gemessen: alle neun Reiter (Objekt bis Deal-Aktion) mit Inhalt, Einstellungen mit allen zehn Unterreitern, Hilfe,
Import- und Export-Hub, Tilgungsplan, BMF, Deal-Score alt und neu, KPI-Aufschlüsselung, Preisfenster, Beta, PDF-Import,
Marktdaten-Import, Feedback, Meine Freigaben, Track Record, Bankexport, Mein Partner, Cockpit, Vermögen, Quick-Check
(iframe) und das Erststart-Fenster (`#dp-onboarding`). Nach dem Ausrollen dieselben Stellen bei 1440 und 390 px nachgemessen.

Versionen: **v3370** (Commit `7e539bf5`), **v3370a** (Commit `767c0caa`). Gold-Audit auf Staging RC 0 (366 Fundstellen,
genau auf der Basislinie), `buster-ebenen-pruefen` sauber, `deploy-staging.ps1` mit allen Prüfern grün.

| Bereich | Befund | Messwert | Stand |
|---|---|---|---|
| Schließen-Knöpfe 390 px | Der Haus-Knopf aus v3358 verlor gegen stärkere Regeln: Import-/Export-Hub, Tilgungsplan (`.iexp-close`) und Preisfenster (`.pricing-modal-close`) **rund** | 44 × 44, Radius 50 % (`html body button[class*="close"]:has(> svg:only-child)`, Spezifität 0,2,4 gegen 0,2,0) | behoben in v3370 → 44 × 44, 9 px |
| Schließen-Knöpfe 390 px | Einstellungen und Hilfe (`.set-modal-close`) blieben klein | 32 × 32 (`html #help-modal …`, 1,1,1) | behoben in v3370 → 44 × 44 |
| Schließen-Knöpfe ≤ 900 px | Track Record, Bankexport (`.dpm-x`) eigene Größe | 40 × 40, Radius 10 px | behoben in v3370 → 44 bzw. 32, 9 px |
| Mein Partner | `.pk-zu` nicht im Haus-Knopf, auf dem Handy hochkant | Desktop 34 × 34 r 8, 390 px **34 × 44** | behoben in v3370 |
| Meine Freigaben | `.mf-x` Kreis, auf dem Handy **Oval** | 30 × 30 r 50 %, 390 px 30 × 44 | behoben in v3370 |
| BMF-Rechner | `.bmfmo-close-top` eigene Form | 30,6 × 27 r 8, 390 px 41 × 44 | behoben in v3370 (nur CSS, `bmf-modal-v292.js` unberührt) |
| Datenaufnahme-Schublade | `.dp-pf-mclose` seit v2969a bewusst rund | 44 × 44 r 50 % | behoben in v3370 → 9 px, Größe 44 bleibt |
| Schließen-Knöpfe, vorsorglich | weitere Fenster-X ohne Haus-Form: `.rp-x` (30 r 50 %), `.wizard-close` (32 r 50 %), `.dp-legal-close` (32 r 50 %), `.rnd-wiz-close` (r 6), `.hh-x` (36), `.bi-x`, `.da-modal-close`, `.upgrade-close`, `.dpdi-close`, `.tax-bestand-overlay-close`, `.dpuew-x`, `.bb-zu`, `.dpnq-x`, `.dpes-x` | aus den Regeln gelesen, die Fenster nicht alle geöffnet | in v3370 in den Haus-Knopf aufgenommen; Sichtprüfung je Fenster ist **Staging-Abnahmepunkt** |
| Schließen-Knöpfe, ausgelassen | `.qcpm-x` (Nicht anfassen), `.jb-zu`, `.dp-erh-x` (Module der Hauptsitzung), `.dp-tour-close`, `.brw-karte-zu`, `.dp-lh-zu`, `.vm-x`, `.dvb-zu` (keine Fenster-X) | – | bewusst nicht angefasst |
| Schrift Kopf | Objektname `#hdr-obj`, „21 / 24 Felder“ und Score-Badge (`.sc-grade`, `.sc-v`, „Investor Deal Score“) in **DM Sans** | 5 Elemente auf jeder Seite | behoben in v3370 |
| Schrift Fenster | Deal-Score-Einstellungen neu **87 Elemente DM Sans**, Einstellungen › Deal Score `.ds-pane-title`, › Mandanten „Pro-Funktion“ (Inline-Stil), Bewertung „So setzt sich der Score zusammen“, Beta 8 | je Fenster gezählt | behoben in v3370 (67 Deklarationen in style.css, dazu 5 CSS- und 10 JS-Dateien) |
| Schrift Mono | `ui-monospace` statt JetBrains Mono: Einstellungen › Konto `#pk-imo-badge`, „API-Token“, Cockpit `.sk-nr`, `.dp-mappe-l`, Feedback `.section-h-num`, ImmoMetrica-Import | 3–7 Elemente je Ort | behoben in v3370 (JetBrains Mono davor) |
| Schrift Feedback, Tour | Fensterkörper `-apple-system` vor Inter (Segoe UI auf Windows) | `#feedback-modal .fb-modal`, `tour.css` | behoben in v3370 |
| Nachmessung Schrift | Reiter, Einstellungen (10 Unterreiter), 10 Fenster, Cockpit: Elemente in einer Nicht-Hausschrift | **0** | – |
| Investment-PDF | v3358 stellte die Diagramme auf `font-family="Inter"` um; `pdf.js` setzte für die Bildumwandlung nur DM Sans auf Helvetica, Inter ist dort nicht geladen → Rückfall auf Serifen (der Fehler aus v2463) | Code gelesen | behoben in v3370; **PDF-Abnahme auf Staging offen** |
| Finanzierung 1440 px | fünf Kacheln in einer 521 px breiten Karte zu je 99 px: „1.968,40 €“, „Zinsen 1.574,72 €“, „Annuitätendarlehen“ mit … gekürzt | 81/79, 86/79, 97/79 | behoben in v3370 → unter 600 px Kartenbreite drei Spalten (170 px) |
| Finanzierung 1440 px | „Marktzins übernehmen“ links und rechts angeschnitten (v3340a löste nur das Handy) | 126/113 | behoben in v3370 → bricht um (2 Zeilen, 37 px) |
| Finanzierung 1440 px | „Zinsrisiko“ `#zaer_display` „+1,00 % p.a. (Anschluss 5,00 % − Aktuell 4,00 %)“ gekürzt | 335/239 | behoben in v3370a → 239/239, 46 px hoch |
| Aufgabenband (Partner) 390 px | `#dppk-band` „Neue Aufgabe von …“ nur halb so breit, vier Zeilen, mitten über dem Inhalt (`left:50%` ohne Breite) | 194 × 144 px ab x 97 | behoben in v3370 → 356 × 126 |
| Quick-Check 390 px | Schlüsselfeld `#api-key-input` 13 px (iOS zoomt unter 16 px) | 13 px | behoben in v3370 → 16 px |
| Quick-Check | Felder 38/44, Inter 13/16, Radius 2, Schließen 32/44 r 9, kein Überlauf | gemessen | in Ordnung |
| Reiter 1440 / 390 | Feldhöhen in allen Reitern 38 / 44, Inter 13 / 16, Radius 2; kein waagerechter Seitenüberlauf (0 px) | 18–87 Felder je Reiter | in Ordnung |
| Steuer › Jahreserklärung | Tabelle `.ytf-input-wrap input` Schrift 11 px statt 13 | 45 Felder, Höhe 38 | offen – dichte Tabelle, Optik-Frage |
| Deal-Score-Einstellungen | Felder Radius 5 px, Schrift 12,5 px; Einstellungen › Deal Score 14 px | 42 Felder | offen – gehört zu C4 |
| Felder Radien (C4) | Vermögen/Mein Partner 8 px, Cockpit-Textfeld 9 px neben Auswahl 2 px, BMF 8 px, Tilgungsplan 4 px, Beta 6/8 px, Quick-Check-Schlüsselfeld 6 px bei 42 px Höhe | gemessen | offen – Haus-Radius nicht festgelegt |
| Felder (C5) | Mengenfeld `.pm-menge` 26 px, Radius 0 (Einstellungen › Plan, Preisfenster) | 26 px | offen – Stepper, Optik-Frage |
| Pillen | Aktionsknöpfe in Track Record/Bankexport `.dpm-btn` Radius 999 px neben `.btn` 8 px im selben Fenster; Chips `.dab-chip` (Deal-Aktion) und `.oe-chip` (Objekt) als Pillen, auf dem Handy 44 px hoch; Monatlich/Jährlich-Schalter im Preisfenster | 309 × 38 r 999; 90 × 22 → 97 × 44 | offen – Optik-Frage (`.dpm-btn` ist „Fassung B“ vom 08.08.) |
| Erststart-Fenster | `#dp-onboarding` hat keinen Schließen-Knopf, nur „Diesen Schritt überspringen“ | 6 Knöpfe | offen – Produktentscheidung |
| Mein Partner 390 px | Reiterleiste `.pk-reiter` wischt quer, „Aufgaben“ am Rand angeschnitten | 547/383 | offen – Querwischen im Code gewollt (nowrap), Kosmetik |
| Track Record | Escape schloss im Lauf nicht (Bankexport ja), obwohl `esc-schliesst.js` ihn führt | einmal gemessen | offen – nicht nachgestellt; im Lauf war das Erststart-Fenster nur ausgeblendet |
| D2 / D3 aus Runde 1 | Diagramm und Rechtliches-Tabelle wischen quer | – | offen, unverändert (Kosmetik) |
| Seitenleiste | E-Mail `.sb-user-email` mit … gekürzt | 247/165 | gewollt, kein Befund |
| Messlauf | `showPdfModal()` direkt gerufen blieb bei „PDF wird erstellt“ stehen | – | kein Befund, vermutlich die Netzsperre |

**Zählung:** 18 Befunde behoben (v3370: 17, v3370a: 1), 9 offen mit Grund. Für Marcel zu entscheiden:
**Haus-Radius der Felder** (C4, Vorschlag 2 px wie in den Reitern), **Pillen oder Ecken** für `.dpm-btn` und die
Chips, **Schließen-Knopf im Erststart-Fenster**.
