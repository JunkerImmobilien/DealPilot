# DealPilot Changelog

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
