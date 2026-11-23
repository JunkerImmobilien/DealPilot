# Vorschau-Funktionen — was derzeit ausgeblendet ist

Stand **17.11.2026, v3600** (`04adcfa6`, `d3b389e8`). Marcel 17.11.2026: *„Funktionen, die noch
nicht fertig sind, dürfen beim nächsten Prod-Rollout nicht für Kunden sichtbar werden.“*

**Die eine Liste steht im Code:** `backend/src/services/vorschau-funktionen.json`.
Diese Datei hier erklärt sie und führt daneben auf, was sonst nur für uns oder für niemanden
sichtbar ist. **Was in der JSON steht, gilt** — weicht diese Tabelle ab, ist sie veraltet.
Live-Stand je Server: Admin › System › **Vorschau**.

## 1 · Vorschau-Funktionen (Mechanismus v3600)

| Schlüssel | Funktion | seit | sichtbar für | Frontend-Sperre | Backend-Sperre |
|---|---|---|---|---|---|
| `gutachten_org` | gutachten.org: „Ersteinschätzung (gutachten.org)“, „Gutachten beauftragen (gutachten.org)“, Fenster, Anfragen, Bestellung mit Preis/Rabatt | v3540 (bis v3591) | Admin-Konten, Freigabeliste | `js/gutachterpartner.js` baut die Knöpfe nur nach `DpVorschau.frei('gutachten_org')` | `routes/gutachterpartner.js`: `router.use(vorschau.sperre('gutachten_org'))` vor ALLEN Routen, auch `/status` → 403 |
| `vermoegen` | Vermögen & Haushalt (Seitenleiste › Ansichten, Fenster, PDF, Vermögensseite im Track Record) | v3217 | Admin-Konten, Freigabeliste | `index.html` `data-vorschau="vermoegen"` am Knopf; `js/vermoegen.js` öffnet, druckt und erinnert nur nach `DpVorschau.frei('vermoegen')` | `services/telegramPdfService.js` `erzeugen()`: PDF `dok_vermoegen` → 403 (App über `/rechenkerne/dok-pdf` und Telegram) |
| `umsetzungswuensche` | Umsetzungswünsche und Bordbuch (Alt+B) | v3097 | nur Zusatz „Entwicklungspartner“ (wie bisher; Admin bewusst nicht) | `index.html` `data-vorschau="umsetzungswuensche"`; `js/umsetzungswuensche.js`, `js/bordbuch.js` fragen `DpVorschau.frei` | `routes/wuensche.js`: `router.use(vorschau.sperre('umsetzungswuensche'))`, auch `/zugang` → 403 |
| `grafiken_neu` | Neue Grafiken: Pilot-Analyse (Vermögensaufbau, Cashflow-Brücke, Plan gegen Ist, Weg zum positiven Cashflow, Mietspielraum, Ergebnis aus Vermietung) und Portfolio-Cockpit „Portfolio auf einen Blick“ | v4140 | Admin-Konten, Freigabeliste | `js/grafiken-neu.js` fragt `DpVorschau.frei('grafiken_neu')`, sonst passiert nichts; mit Freigabe blendet es die alten Grafiken an diesen Stellen aus | keine nötig: `nur_frontend` mit Begründung (reine Darstellung, keine Route), vom Prüfer seit v4140 so zugelassen |

Admin › Gutachtenaufträge (v3590) ist ohnehin nur im Admin-Portal (`requireAdmin`), gehört aber
fachlich zu `gutachten_org`.

**Bewusst offen:** der Speicherweg `user_settings` Schlüssel `vermoegen` — dort liegt auch das
**Profilfoto** (W-5). Eine Sperre dort nähme jedem Kunden das Foto. Gesperrt sind Ansicht,
Dokument und PDF.

### Wer „frei“ ist (`services/vorschau.js`, `entscheiden()`)

1. Admin › Vorschau › **„für alle“** gesetzt (Tabelle `vorschau_freigaben`, Migration 111, 30 s im Speicher) → jeder.
2. Sonst die Gruppen aus `frei_fuer`:
   - `admin` — `users.role = 'admin'`
   - `vorschau` — Freigabeliste: Zusatz `vorschau` je Konto (`user_zusaetze`), im Admin › Vorschau per E-Mail
   - `zusatz:<name>` — ein bestehender Zusatz (`entwicklungspartner`)
3. Unbekannter Schlüssel = gesperrt, auch für Admin. `vorschau.sperre('unbekannt')` wirft beim Start.

**Staging = Prod.** Dieselbe Regel auf beiden Servern — sonst ist die Sperre auf Staging nicht
nachmessbar, und „auf Staging geht es“ sagt nichts über Prod. Was das Testen nicht bricht:
Marcels Konto ist Admin; `tools/gutachterpartner-testkonto.js` setzt seinem Testkonto den Zusatz
`vorschau` (mit `--ohne-vorschau` sieht es, was ein Kunde sieht); die anderen Testkonten
(Partner, Steuer-Mappe) brauchen keine Vorschau-Funktion.

### Eine Funktion freigeben

- **Ohne Rollout:** Admin › Vorschau › „für alle“ (nur Rolle `owner`, im Audit-Log).
- **Endgültig:** Eintrag aus der JSON nehmen, die `vorschau.sperre`/`darf`/`DpVorschau.frei`/`data-vorschau`
  der Funktion entfernen, neue Version. Der Prüfer verlangt beides gemeinsam (eine Sperre auf einen
  Schlüssel, den es nicht mehr gibt, wirft beim Start).

### Eine neue Funktion in die Vorschau nehmen

1. Eintrag in `vorschau-funktionen.json`: `schluessel`, `bezeichnung`, `seit`, `beschreibung`, `frei_fuer`,
   `frontend_erkennung` (Regex: jede Datei, die sie trifft, braucht die Sperre), `frontend_ausgenommen`
   (Datei → Grund), `routen` und/oder `backend_stellen`, `backend_erkennung` (Regex über `routes/*.js`).
2. Route: `router.use(authenticate); router.use(vorschau.sperre('<schluessel>'));` **vor** der ersten Route.
3. Oberfläche: statisches Markup `data-vorschau="<schluessel>"`, gebautes erst nach `DpVorschau.frei('<schluessel>')`.
4. `node tools/vorschau-pruefen.mjs` → RC=0.

### Absicherung

`tools/vorschau-pruefen.mjs` (läuft in `deploy-staging.ps1` und `rollout-prod.ps1`, bricht ab):
A Liste · B Entscheidung am echten Kern (22 Fälle) · C Backend-Sperren an den echten Dateien ·
D Frontend-Sperren (JS je Datei, HTML je TAG) · **E Gegenprobe**: zehn Kopien im Speicher, aus
denen je eine Sperre entfernt ist — jede muss rot werden, sonst ist der Prüfer selbst rot.

> **Falle, teuer bezahlt (v3495):** `aside.sidebar .sb-act-item{display:flex!important}` (0,2,1)
> schlug die alte Sperre (0,1,0) — auf Prod war „Vermögen & Haushalt“ am Handy sichtbar. Die
> Grundregel steht deshalb im `<head>` von `index.html` (`#dp-vorschau-grund`) mit
> `aside.sidebar .sb-act-item[data-vorschau]:not(.dpv-frei)` (0,4,1) und `html body #sidebar …` (1,2,2).
> Sichtbarkeit immer bei 390 px UND Desktop messen.

## 2 · Sonst nur für uns (kein Vorschau-Mechanismus, gewollt)

| Was | Wer | Wo | Warum nicht in der Liste |
|---|---|---|---|
| Admin-Portal (`frontend/admin/`) samt Gutachtenaufträge, Vorschau, Register | Admin-Benutzer (eigenes Token) | `middleware/adminAuth.js` | eigenes Login, nie Kunde |
| Plan-Wechsel ohne Stripe `POST /subscription/demo-change-plan` | `role = admin` oder `ENABLE_DEMO_PLAN_SWITCH=1` | `routes/subscription.js` | Werkzeug, keine Funktion |
| Partner-Cockpit / Mein Partner | Partner bzw. verbundene Kunden | `partner-kunden.js` (`.dp-frei`) | Produkt-Recht, nicht „unfertig“ |
| DealPilot Flow (Makler-Hub-Linien) | Plan-Merkmal `flow_linien`/`makler_hub` oder Zusatz `flow` | `zusatzService.flowLinien` | Produkt, Preis offen |
| Schnittstelle Rechenkerne | Plan mit `api_access` + Zusatz `rechenkerne_api` | `zusatzService.darfRechnen` | Produkt |
| Messe-Studio blendet Vermögen, Pilot u. a. in Videos aus | nur im Studio-Modus | `messe-drehbuch.js` | Aufnahme, keine Sperre |

## 3 · Für alle abgeschaltet (Schalter im Code)

| Was | Schalter | seit |
|---|---|---|
| Kacheln der beiden Bewertungspartner auf der Bordkarte (namentlich nie nach außen) | `object-actions.js` `PARTNER_AVM_SICHTBAR` (Rückfall `window.DP_PARTNER_AVM`) | v1637 |
| Bewertungspartner „coming soon“ im Pre-Flight außer auf Staging | `object-actions.js` `AVM_PREFLIGHT_SOON` | v895h |
| Erstflug-Rabatt-Anzeige | `promo-erstflug.js` `ANZEIGE_AKTIV = false` | — |

Nicht Vorschau, aber leicht zu verwechseln: der **alte** gutachten.org-Weg aus dem RND-Wizard
(`js/gutachten-org.js`, v1447: „E-Mail an Gutachten.org“, „Kostenlose Ersteinschätzung (Formular)“
über Mail/Zwischenablage, ohne Schnittstelle) ist seit September auf Prod und **nicht** gesperrt.
Die Partnerschaft steht auch auf `landing/leistungsumfang.html`.
