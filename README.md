# DealPilot — Investmentanalyse für Profis

Web-App für Immobilien-Investmentanalyse: Cashflow, Steuer, DSCR, IRR, Investment-Case-PDF, KI-Analyse mit Web-Recherche, aktuelle Marktzinsen.

## Was ist neu in V26

**1. KI-Analyse — Server-Key + User-Key Fallback:**
- Server-Key aus `.env` (`OPENAI_API_KEY`) hat Priorität
- User-Key aus Settings als Fallback (wird in localStorage gespeichert, vom Backend nicht geloggt)
- Klare Fehlermeldungen mit Direkt-Link in die Settings ("→ Jetzt in Einstellungen hinterlegen")
- Backend `GET /api/v1/ai/status` liefert jetzt `{available, server_key_configured, accepts_user_key}`

**2. Sidebar mit Mockup-Cards:**
- Sidebar 380px breit
- Foto-Thumbnail mit Gold-Hauskreis
- Objektnummer-Badge + Straße fett + Stadt + Datum
- Kaufpreis groß in Gold (22px)
- 3 Mini-Cards pro Objekt:
  - DSCR mit Slider 0–2+ und Marker, farbcodiert (rot/gelb/grün)
  - CF/M mit Sparkline-Trendkurve
  - BMR mit Bar 0–10%, blau
- Hover zeigt Action-Buttons (Kopieren/Löschen)
- "+ Neues Objekt hinzufügen" als Dashed-Button am Ende der Liste

**3. Sidebar aufgeräumt:**
- Free-Plan-Badge bleibt unten beim User
- Import/Export aus Sidebar entfernt → in Settings → Tab "💾 Daten"
- Bankexport + Track Record bleiben als Sidebar-Buttons

**4. Settings ohne Datenverlust:**
- Modul-globaler Draft-State (`window._SetDraft`)
- Eingaben überleben Tab-Wechsel und Logo-Upload
- "● ungespeicherte Änderungen"-Hinweis im Footer
- Abbrechen-Bestätigung wenn Dirty
- Logo-Upload und Plan-Wechsel bewahren andere Tab-Eingaben
- Save liest aus Draft, nicht direkt vom DOM

**5. Steuer-Detail Werbungskosten:**
- Tooltip am Label erklärt: NK ist Werbungskosten UND Einnahme (durchlaufender Posten, neutralisiert sich)

**6. "Alle Objekte" als Hauptview:**
- Toggle im Header: "📋 Einzelobjekt / 📂 Alle Objekte"
- Sortier- und filterbare Tabelle (Kürzel, Adresse, KP, GI, BMR, DSCR, LTV)
- Live-Suche
- "Laden →" springt zurück zur Einzelansicht
- Sidebar-Button für Alle Objekte ist weg (wäre redundant)

**7. Marktzinsen verbessert:**
- Korrekte BBIM1-Series-Keys von der Bundesbank-API (war seit V25.1)
- Loading-State (`···`-Animation während des Ladens)
- Fehler-Anzeige wenn API komplett ausfällt
- Vergleichslinks zu Interhyp / Dr. Klein / Baufi24 / Bundesbank-Statistik direkt

**8. GitHub-Workflow (Variante A):**
- `.gitignore` mitgeliefert
- `.env.production.example` enthält PGSSLMODE-Hinweis
- `GITHUB_WORKFLOW.md` mit Schritt-für-Schritt-Anleitung
- Update-Routine: `git push` lokal → `git pull && docker compose up -d --build` auf dem Server

## Architektur

```
dealpilot/
├── frontend/
│   ├── index.html              ← V26: View-Switcher Header, All-Objects-Container
│   ├── css/style.css           ← V26: Sidebar 380px, Mockup-Cards CSS
│   └── js/
│       ├── config.js           ← Pricing-Config
│       ├── settings.js         ← V26: Draft-State + Daten-Tab
│       ├── ui.js               ← V26: setMainView, _buildAIPayload, _formatAIError
│       ├── storage.js          ← V26: Mockup-Cards (Foto + Mini-Cards)
│       ├── all-objects.js      ← V26: Inline-View statt Modal
│       ├── market-rates.js     ← V25.1: BBIM1-Series, V26: Loading-State
│       └── …
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── ai.js           ← V26: User-Key Fallback aus Body
│   │   │   ├── marketRates.js
│   │   │   └── …
│   │   ├── services/
│   │   │   ├── marketRatesService.js  ← V25.1: BBIM1-Keys
│   │   │   ├── openaiService.js       ← V26: User-Key + 401-Handling
│   │   │   └── …
│   │   └── db/
│   │       ├── pool.js         ← V25.1: PGSSLMODE-gesteuert
│   │       └── seed-demo.js
│   └── migrations/
├── docker-compose.prod.yml
├── Caddyfile
├── deploy.sh
├── upgrade.sh
├── backup.sh
├── .gitignore                  ← V26: NEU
├── .env.production.example     ← V25.1: PGSSLMODE-Hinweis
├── GITHUB_WORKFLOW.md          ← V26: Variante A
├── HETZNER_SETUP.md
└── UPDATE_HETZNER_V25_TO_V26.md
```

## Pricing-Pläne (Default)

| Plan       | Monatlich | Jährlich  | Objekte | KI/Monat | Watermark |
|------------|-----------|-----------|---------|----------|-----------|
| Free       | 0 €       | 0 €       | 1       | 2        | ja        |
| Investor   | 19 €      | 190 €     | 10      | 10       | nein      |
| Pro        | 29 €      | 290 €     | ∞       | 20       | nein      |
| Business   | 59 €      | 590 €     | ∞       | ∞        | nein      |

Konfig in `frontend/js/config.js` (`DealPilotConfig.pricing`). Backend-Sync via Migration 008.

---

V26 · Stand 29.04.2026
