# DealPilot Changelog

## V1.1.233 — 2026-05-19

### Mobile-Fixes für iPhone-Safari (Marcel-Feedback)

Aus User-Screenshots wurden 6 Mobile-Layout-Probleme identifiziert und
in einem konsolidierten CSS-Block am Ende von style.css gefixt.
Desktop-Layout bleibt 100% unverändert (alles in @media-Queries gewickelt).

**Bild 1 + 3 — Header-Score-Chevron überlappt:**
- `.hdr-toggle-btn` war `position:absolute; z-index:305` und überlappte
  auf Mobile mit KI-Credits-Pill, Aktionen-Menü-Pfeil und Theme-Toggle
- Fix: `display:none` ab `≤ 768px` (auf Mobile redundant)

**Bild 2 — dp-tip-Tooltip-Button-Bubble:**
- Die V228-Hilfe-Buttons hatten eine ::before Hover-Bubble die auf Mobile
  zu groß rendert und über Eingabefelder rüberhängt
- Fix: Button kleiner (18px statt 22px), Hover-Bubble auf Touch ausgeblendet
  (auf Touch-Geräten gibt's keinen Hover, daher nutzlos)

**Bild 4 — Settings-Modal-Header Account-Tab bricht aus:**
- Settings-Header war `flex-direction: row` und kollidierte mit den Tabs
- Fix: bei `≤ 600px` Header in Spalten, Tabs in eigener Zeile mit
  horizontal-scroll, kleinerer Padding/Font

**Bild 5 — Portfolio-Tabelle abgeschnitten:**
- `.ao-table-wrap` hatte schon `overflow-x: auto`, aber kein `min-width`
  am `.ao-table` → Tabelle wurde gequetscht statt zu scrollen
- Fix: `min-width: 700px` ab `≤ 900px` damit horizontaler Scroll greift
- Bonus: Kürzel-Spalte `position: sticky; left: 0` damit User beim
  Scrollen Bezug behält
- Gold-Gradient am rechten Rand als Scroll-Hinweis

**Bild 6 — Hilfe-Modal Foot-Layout:**
- Input "Frag den DealPilot" + "Fragen"-Button waren auf Mobile zu eng
- Fix: bei `≤ 600px` Input + Button vertikal stacken, jeweils 100% Breite

**Bonus für iPhone SE / sehr schmale Phones (< 380px):**
- KI-Credits-Pill-Label "KI" wird ausgeblendet, nur Icon bleibt
- Spart 30-40px im engsten Header-Bereich

### Architektur
Alles in **einem konsolidierten Block** am Ende von style.css. Bei künftigen
Mobile-Fixes können dort weitere Regeln angehängt werden. Bei Bedarf
komplett entfernbar (Block-Marker: `/* V233: Mobile-Fixes */`).


## V1.1.232 — 2026-05-19

### UX-Polish: Card-Header-Icons konsequent über alle 8 Tabs ausgerollt

**Vorher:** Tab Objekt (s0) hatte schon 6 Cards mit Premium-Icons (.ct ct-pro
mit Lucide-SVG in cremegolde-Box). Die anderen 7 Tabs hatten 51 Cards ohne
Icons oder mit unprofessionellen Emojis (📈 💰 📅 📋 📊 💡 🏦).

**Nachher:** Alle 51 Card-Titel über die App nutzen jetzt das gleiche
Premium-Pattern: Lucide-SVG-Icon in cremegolde-Box mit Goldverlaufslinie.

**SVG-Symbol-Library erweitert um 7 neue Icons:**
- `i-percent` — AfA-Konfiguration
- `i-calculator` — Steuer-Modul
- `i-calendar` — Steuerverlauf
- `i-piggy-bank` — Bausparvertrag (Tab Finanzierung + Tab Bewertung)
- `i-arrow-down` — Nicht umlagefähige Kosten
- `i-search` — Detailpositionen
- `i-gauge` — Alle Kennzahlen

**Bereits existierende Icons reused** (54 vorhanden, davon hier verwendet):
i-euro, i-hammer, i-bath, i-key, i-bar, i-pin, i-trend, i-user, i-trending-up,
i-receipt, i-bank, i-clock, i-portfolio, i-check, i-bulb, i-settings, i-zap,
i-window, i-file-text, i-star, i-coins, i-warn

**Emojis aus 7 Card-Titeln entfernt** zugunsten konsistenter SVG-Icons.

### Coverage
- 33 reguläre Cards (mit `<div class="ct">`)
- 10 Sub-Cards (mit inline `margin:0;border:none;padding:0`)
- 6 schon vorhandene Cards in Tab Objekt — automatisch konsistent via gleiche CSS
- 1 cr-title Sondercase
- 1 Bauspardarlehen-Konditionen mit komplexem inline style
- = 51 Patches durchgeführt, plus 6 bereits da

### Was bewusst NICHT geändert wurde
- `.ct-row`-Klasse (10x): das sind Row-Layouts ohne Title-Konzept
- Settings-Modal Tab-Header (`data-tab="..."`): separate Komponente
- Score-Bars und KPI-Header (Tab Bewertung): haben eigene Layouts

### Risiko-Hinweis
Das CSS-System ist bereits production-tested (Tab Objekt seit Wochen live).
V232 rollt nur das existierende Pattern auf weitere 51 Stellen aus.
Bei visuellen Regressionen: kleines Inline-`style="..."` an einzelnen
Cards prüfen — die könnten mit ct-pro kollidieren.


## V1.1.231 — 2026-05-19

### Bug-Fix: DSCR-Konsistenz (B8.15)

**Problem:** Drei verschiedene Stellen im Code rechneten DSCR mit leicht
abweichenden Formeln:
- `calc.js` (UI-Hauptberechnung): KD = Zins + Tilgung + BSV-Sparrate
- `calc.js` (Cashflow-Box, phase-aware): KD inkl. BSV nur in Sparphase
- `deal-kpis.js` (DealScore): KD = Zins + Tilgung (**OHNE BSV** — Bug!)

→ Bei Tilgungsaussetzungsdarlehen mit Bausparvertrag wich der DealScore-
DSCR vom UI-DSCR ab. User sah verschiedene Werte für die gleiche Kennzahl.

**Lösung — neue Datei `frontend/js/dscr-engine.js`:**

Single Source of Truth via `window.Dscr.compute({nkm_j, ze_j, zins_j,
tilg_j, bsv_j, bwk_cf})`. Returnt {brutto, netto, kd, schwelle} mit
identischer Formel überall:
- **Brutto:** (NKM+ZE) / (Zins+Tilgung+BSV)
- **Netto:** (NKM+ZE-BWK_NUL) / (Zins+Tilgung+BSV)
- Klassifizierung: ≥1.2 good, 1.0-1.2 warn, <1.0 bad

**3 Patches stellen die Aufrufer um:**
- `deal-kpis.js` Z. 134-139 → ruft `Dscr.compute()` mit BSV-Sparrate
- `calc.js` Z. 1107-1111 → ruft `Dscr.compute()`
- `calc.js` Z. 2440-2444 (Cashflow-Box) → ruft `Dscr.compute()` phase-aware

**Script-Reihenfolge in index.html angepasst:**
`dscr-engine.js` wird VOR `deal-kpis.js` und `calc.js` geladen.

**Unit-getestet:** 6 Szenarien (Standard, mit BSV, kritisch, Bar-Kauf,
String/null/NaN-Robustheit, Klassifizierungs-Schwellen).

### Code-Quality-Vorteile
- ~10 Code-Smells entfernt (var dscr-Schatten, doppelte Formeln, etc.)
- DSCR-Berechnung ist jetzt deterministic und debuggable
- Neue DSCR-Konsumenten (Portfolio, Reports) können `Dscr.compute()`
  wiederverwenden statt eigene Formel zu schreiben
- Bei künftigen Änderungen der Bewertungs-Schwellen: ein zentraler Ort

### Bei der Gelegenheit gefixt
- Brutto-Zähler nutzte `(nkm+ze)*12`, Netto-Zähler nutzte nur `nkm_j` →
  jetzt beide auf konsistenter Basis `(NKM+ZE)*12`. Im typischen Deal
  ohne Zuschläge (ZE=0) keine Änderung. Bei Deals mit Stellplatz-
  Zuschlag liefert der Netto-DSCR jetzt einen leicht höheren Wert
  (was korrekt ist).


## V1.1.230 — 2026-05-19

### Quick-Win-Sammelpatch: Audit-Fixes (B8.16 + B8.29) + V228.4 Tooltip-Rest

**B8.29 — Equity Multiple ∞-Display Fix:**
- Bei Vollfinanzierung (EK = 0) zeigt Equity Multiple ∞ — der Untertitel
  zeigte aber weiterhin "geschätzt", was widersprüchlich war.
- Fix: kpi-em-sub wird jetzt dynamisch gesetzt — "max. Hebel" bei ∞,
  "geschätzt" sonst.

**B8.16 — Threshold-Marker auf Score-Bars:**
- DealScore-Bars zeigen jetzt visuelle Linien bei 60% (akzeptabel→gut)
  und 85% (gut→sehr gut) als CSS-Pseudo-Elements.
- Subtil (1.5px breit, leicht durchsichtig, Gold-Akzent bei 85%) —
  hilft User die Score-Übergänge visuell zu verorten ohne aufdringlich
  zu sein.
- Implementiert via .ds-bar::before / ::after — keine JS-Änderung nötig.

**V228.4 — Tooltip-System Komplettierung (9 weitere Stellen):**
- tab8.dealpilot_score (Score-Header in Tab Bewertung)
- tab8.investor_score (Investor Deal Score Header)
- tab8.cashflow_rendite (Tabelle "Alle Kennzahlen")
- tab8.equity_multiple (KPI-Header) — schon V228.2
- tab5.tilgungsaussetzung (Bausparvertrag-Card)
- tab5.zinsaenderungsrisiko (Bank-Cockpit-Item)
- tab5.kfw (KfW-InfoBox-Titel)
- tab6.hg_umlagefaehig (Hausgeld-Feld)
- tab6.hg_nicht_umlagefaehig (Hausgeld-Feld)

### Übersprungen (für V228.5 falls relevant)
- tab8.stress_matrix — Container-Card-Titel braucht weiteren Kontext
- tab8.tilgung_vom_mieter — kein Label gefunden
- tab5.ltv_basis — Checkbox-Sondercase
- tab6.sonderverwaltung / sonstiges_umlagefaehig — keine eindeutigen Anker
- tab7.ki_credits / analyse_parameter / empfehlungs_skala — Settings-Tab
  (Pill / Settings-KI-Tab statt regulärem Tab 7)

### Coverage nach V230
- 60+ Tooltips deployed (von 69 in tooltip-content.js)
- Tooltip-System nahezu vollständig — die verbleibenden 8 sind Sondercases
  die separat geplant werden müssen.


## V1.1.229 — 2026-05-19

### Major Feature: KI-Halluzinationsschutz (B7.6/B7.19)

**Problem:** Bei Test-PLZ wie `12345`, `00000`, `99999` halluzinierte die KI
Bodenrichtwerte, Mietspiegel und Lage-Bewertungen als wären sie echte Werte.
Folge: Der DealScore wurde mit erfundenen Zahlen befüllt — und Nutzer
hätten Investmentenscheidungen darauf basieren können.

**Lösung — Doppelsicherung im Backend:**

- Neue Datei `backend/src/services/plzValidator.js`
- Express-Middleware in 4 PLZ-konsumierenden Routes registriert:
  - `POST /api/v1/ai/analyze` (DealPilot-Analyse)
  - `POST /api/v1/ai/lage` (KI-Lage-Bewertung)
  - `POST /api/v1/ai/qc-suggest` (Quick-Check)
  - `POST /api/v1/ai/bodenrichtwert` (KI-BRW-Schätzung)
- Bei ungültiger PLZ: HTTP 422 mit code='INVALID_PLZ' + reason

**Blockierte Test-PLZ (25 Stück):**
00000, 11111, 22222, …, 99999, 12345, 54321, 01234, 98765, 12321,
23456, 34567, 45678, 56789, 67890, 10101, 20202, 30303, 40404, 50505

**Validation-Regeln:**
- Format: exakt 5 Ziffern (kein Auto-Padding mehr)
- Range: 01067–99998 (deutscher PLZ-Bereich)
- Test-PLZ-Blacklist (s.o.)

**Frontend — freundliche Fehlermeldungen:**
- Globaler Fetch-Interceptor in index.html erkennt 422+INVALID_PLZ
- Zeigt im richtigen Result-Container (ki-lage-body, ki-miete-body, brw-ki-result)
  einen klaren Hinweis mit Icon, Erklärung und Button "PLZ-Feld öffnen →"
- 3 unterschiedliche Texte je nach reason:
  - `test_plz`: 🤖 "Sieht nach Test-Eingabe aus"
  - `out_of_range`: 📮 "Außerhalb des deutschen Bereichs"
  - `invalid_format`: ✏ "5 Ziffern (z.B. 32049)"

**Architektur-Vorteile:**
- Single Source of Truth für PLZ-Validation
- Middleware → 1 Eingriffspunkt pro Route, keine Duplication
- KI wird gar nicht erst aufgerufen → spart Credits + verhindert Halluzination

### Was NICHT in V229 ist
- PLZ-Override für Edge-Cases (z.B. User wohnt wirklich in 12345 Berlin-Adlershof)
- Erweiterte PLZ-Lücken-Liste (Nicht-existente PLZ wie 02000-02999) — TBD
- Server-seitige Telemetrie über Häufigkeit der Blocks


## V1.1.228 — 2026-05-19

### Major Feature: Tooltip-System mit 3-Stufen-Toggle

**Neues Tooltip-System** mit zentraler Content-Library und intelligenten
Severity-Filtern:

- **69 Tooltips** verteilt über alle 8 Tabs (Objekt, Investition, Miete,
  Steuer-Details, Finanzierung, Bewirtschaftung, KI-Analyse, Bewertung)
- Lehrerhaft-ausführliche Erklärungen für beide Zielgruppen (Anfänger + Profi)
- Mit Beispielen, Paragraphen-Quellen und Best-Practice-Hinweisen

**3-Stufen-Toggle** in Settings → Profil & Anzeige:

- **Anfänger** (Default): alle Tooltips sichtbar
- **Profi**: nur 'pro' und 'critical' Tooltips (keine Anfänger-Krimskrams)
- **Aus**: alle Tooltips komplett ausgeblendet

**Zwei Darstellungsformen:**

- **ⓘ-Popup** (Standard): kleines Icon neben dem Feld, Klick öffnet Popup
  mit Titel, Erklärung, Beispiel und ggf. Paragraphen-Quelle
- **InfoBox** (für 4 kritische Themen): permanente Box unter dem Feld
  - 15%-Grenze (§ 6 Abs. 1 Nr. 1a EStG)
  - WEG-Rücklage (NICHT doppelt einrechnen)
  - Degressive AfA (§ 7 Abs. 5a EStG) — schon in V227 als eigener Block
  - § 7b Sonder-AfA — schon in V227 als eigener Block

### Architektur

- Neue Datei `frontend/js/tooltip-content.js` (~580 Z., 69 Tooltips)
- Neue Datei `frontend/js/tooltip-engine.js` (~250 Z., Engine + Popup-Render + Storage)
- CSS direkt in index.html injiziert (`<style id="v228-tooltip-styles">`)
- Mode-State in localStorage (`dp_tooltip_mode`)
- MutationObserver für dynamisch eingefügte ⓘ-Icons (Tab-Wechsel etc.)

### Settings-Integration

- Neue Sektion "💡 Tooltip-Hilfe" im Tab "Profil & Anzeige"
- Direkt unter dem V213-Block ("Markt-Daten-Cards")
- 3 große Buttons (Aus / Profi / Anfänger) mit Beschreibungstext
- Erklärungs-Hint unten was die Modi bewirken

### Was NICHT in V228 ist

- Tooltips für alle Tab-3-Felder (10 Felder gepatched, ~3-5 weitere möglich)
- KI-Halluzinationsschutz (B7.6/B7.19) — V229
- Tab-8-Polish (DSCR Brutto/Netto, ∞-Display) — V229
- Mobile-Responsiveness der Popups (Desktop-optimiert)


## V1.1.227 — 2026-05-19

### Major Feature: Degressive AfA + § 7b Sonder-AfA (B4.1)

**Neue AfA-Methoden im Tab Steuer-Details:**
- **5,0 % degressiv** (§ 7 Abs. 5a EStG) — vom Restbuchwert, ohne Wechsel
- **5,0 % degressiv mit Wechsel** auf 3 % linear (empfohlen, klassische Steueroptimierung)

**Neue § 7b Sonder-AfA** (collapsible Block):
- Zusätzliche 5 % p.a. in den ersten 4 Jahren
- Eligibility-Checks (Effizienzhaus 40 NH, Baukosten-Cap, Vermietungspflicht)
- Förderfähige Basis automatisch berechnet (Cap 4.000 €/m² Wohnfläche)

**Auto-Hinweis-Banner bei Neubau** (weicher Switch nach Marcels Spezifikation):
- Wenn `ds2_zustand=neubau` UND `Baujahr ≥ 2023` UND lineare AfA gewählt
- Banner zeigt: "💡 Degressive AfA möglich" mit Direkt-Wechseln-Button
- Per X-Button dismissable

**Vorschau-Tabelle bei degressiv:**
- Erste 10 Jahre detailliert (Normal-AfA / § 7b / Gesamt)
- Wechseljahr markiert wenn "degressiv mit Wechsel" aktiv

**Backend bleibt unberührt** — alle Berechnungen im Frontend
(keine DB-Migration, keine API-Änderung).

### Architektur
- Neue Datei `frontend/js/afa-engine.js` — Reine Compute-Library (testbar, unit-tested)
- Neue Datei `frontend/js/afa-ui.js` — UI-Glue zwischen Engine und Tab Steuer
- `frontend/js/calc.js` — AfA-Block ersetzt durch Engine-Call, State._afaSeries befüllt
- `frontend/js/tax.js` — `_computeAutoForYear` nutzt jahresgenaue Series statt Jahr-1-Wert

### Bugfixes
- **B2.10 (V226-Followup)**: Sanierungs-Nutzungsdauer für anschaffungsnahe HK
  ist jetzt methode-aware (33 J. bei degressiv, sonst 100 / linearSatz).
- AfA-Option-Label im Tab Investition vereinfacht

### Tests
- Unit-Tests für afa-engine.js (Linear, Degressiv, Wechsel-Logik, § 7b)
- Excel-Abgleich für klassische Reihen erfolgreich

### Was NICHT in V227 ist
- Finanzamt-PDF-Export-Update auf degressive Reihe (kommt in V228)
- DB-Persistierung der AfA-Methode (derzeit reicht JSONB `data`-Spalte)


## V1.1.226 — 2026-05-19

### Fixes (Pre-Pro Bug-Fixes nach Tab-Audit)
- **B2.1** "Junker Immobilien"-Provision-Zeile in Tab Investition umbenannt zu "Sonstige" (0% Default statt 1.5%)
- **B7.15** KI-Box-Header in Tab KI-Analyse: "DealPilot KI · Junker Immobilien" → "DealPilot KI"
- **B2.2** Grunderwerbsteuer: Neue PLZ → Bundesland → GrESt-Lookup-Logik (`grest-plz-lookup.js`). Bei PLZ-Eingabe wird der korrekte GrESt-Satz automatisch gesetzt. Manuelles Übersteuern weiter möglich.
- **B5.4** Tilgung-Default Hauptdarlehen 1.00% → 2.00% (banküblicher Mindestsatz)
- **B4.2** Grenzsteuersatz-Default 40.45% (Marcel-spezifisch) entfernt → placeholder 42.00
- **B4.5** Checkbox "Grenzsteuersatz automatisch aus zvE berechnen" Default → aktiv
- **B2.10** AfA-Verteilungs-Option Label erweitert: "50 J. Altbau / 33 J. Neubau" — Klarstellung für User
- **B7.14** Tab KI: `<div class="sec-title">` → `<h2>` (a11y-Konsistenz)

### Hinweise
- **Degressive AfA (B4.1)** bleibt für V227 vorbehalten (eigene Session, Backend-Logik nötig)
- **Tooltip-System (V228)** als eigenes Thema mit On/Off-Schalter in Settings


Versionierungs-Strategie: **Major.Minor.Patch** (Semantic Versioning)

- **Major** (X.0.0): App-Architektur-Sprünge — User merkt es sofort (UI-Redesign, neue Hauptbereiche, breaking changes)
- **Minor** (1.X.0): Neue Features — sichtbare Erweiterungen (Stripe-Integration, Admin-Dashboard, Welcome-Mails)
- **Patch** (1.1.X): Bugfixes, kleine Verbesserungen, CSS-Tweaks — User merkt's meist nicht direkt

User-sichtbar in der Sidebar: nur `Major.Minor` (z. B. "V1.1"). Bei Hover zeigt Tooltip den vollen Semver inkl. Patch (`V1.1.222`).

---

## V1.1 — 2026-05-18

**Logo-Saga abgeschlossen + Auth-Style überarbeitet**

### UI / Design
- HD-Logo mit eingebackenem Goldrahmen für App (Login-Card + Sidebar)
- Sidebar-Logo auf 160px vergrößert
- Login-Card Hintergrund schwarz (#0A0808) statt warmes Dunkelbraun
- Staubschwarm-Effekt in allen Auth-Karten (Login, Reset, Konto erstellen, Beta-Tester)
- Logo zentriert in allen Auth-Karten
- Sidebar Margin-Top reduziert

### Internes
- Versionierungs-Strategie etabliert (Semver)
- Version-Badge in Sidebar-User-Box (Major.Minor mit Tooltip)
- Server-Aufräumung: alte `.bak-*` Files, `/tmp/vXXX/` Verzeichnisse, alte Logo-Assets

### Patches die in V1.1 enthalten sind
- V202-V211: Erste Logo-Iterationen (Saum, Sternschnuppe)
- V212: Cinematic-Intro auf Landing
- V213-V215: Logo radikal vereinfacht, neues HD-PNG eingeführt
- V216: Sidebar 160px, Logo zentriert, V216-Goldkugel-Versuch
- V217: Login-Card Background-Override, Logo-Zentrierung erzwungen
- V218-V221: weitere Effekt-Versuche (rolled-back)
- V222: Finaler Stand — Schwarz + Staubschwarm
- V223: V1.0 → V1.1, Version-Badge, Cleanup

---

## V1.0 — 2026-05-12

**Erster offizieller Production-Release**

Vorher: V215 als Build-Stamp. Ab V1.x für externe Kommunikation.

Enthaltene interne Patches: V100-V200 (Investment-Analyse-Features, Stripe-Subscriptions, Deal-Scoring, Portfolio-Strategy, Bankexport, KI-Analyse v1).

---

## Geplant

### V1.2 — Stripe KI-Credits
- 4 One-Time-Produkte (5 / 12 / 29 / 59 €)
- Backend: POST /credits/checkout
- Webhook für mode=payment
- Frontend: _buyCreditPack aktivieren
- Welcome-Mail nach Checkout

### V1.3 — Customer-Portal + Admin-Dashboard
- Sub.openPortal testen + dokumentieren
- Admin-Dashboard MVP (V194) deployen
- TOTP-Auth für Admins

### V2.0 — Multi-Tenant / Reseller (Major)
- Subdomain-Strategie (reseller-x.dealpilot.*)
- White-Label-System ausbauen (Logo / Branding pro Tenant)
- Reseller-Pricing hybrid (Flat-Fee + variabel)
