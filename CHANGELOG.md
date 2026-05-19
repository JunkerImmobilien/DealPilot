# DealPilot Changelog

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
