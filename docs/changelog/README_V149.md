# V149 — Dropdown-Fix + Wizard-Layout + Anfrage-Versand

## Was ist neu in V149?

### 1. d1_type-Dropdown öffnet endlich beim Klick ★

**Problem:** Du hattest in V148 berichtet dass das Dropdown beim Klick nicht aufklappt. Die Browser-Console zeigte beide Optionen (annuitaet + tilgungsaussetzung), aber visuell ließ sich die Liste nicht öffnen.

**Ursache:** Die globale `select { appearance: none }`-Regel in style.css blockiert das native Browser-Dropdown-Verhalten. In Kombination mit einem inline-SVG-Pfeil-Background als Workaround, das aber bei deinem Browser oder Render-Cycle nicht greift.

**Fix:** Neue Datei `select-fix.css` setzt `appearance: auto` und `webkit-appearance: menulist` für `#d1_type`, `#d2_type` und andere Dropdowns zurück. Damit funktioniert das **native Browser-Dropdown wieder**, behält aber den Gold-Border auf Focus.

### 2. RND-Wizard Checkbox-Layout fixed

**Problem:** Im Schäden-Step (Step 7) klebten die Checkboxen am Container-Rand, der Abstand zum Label-Text war zu eng, Hover/Focus-States nicht erkennbar.

**Fix in `rnd-styles.css`:**
- Checkboxen mit `flex-shrink: 0` und expliziter Größe 18×18px
- Gap zum Label auf 12px
- Padding der Schaden-Rows auf 12×14px
- Hover-State mit Gold-Border und Cream-Hintergrund
- Info-Box am Anfang mit Goldakzent, klare Trennung zum Checkbox-Grid
- "Erweitert"-Toggle-Box am Ende mit Charcoal-Tönen
- Margins zwischen Headlines und Sektionen explizit gesetzt

### 3. Export-Buttons raus — "Jetzt Anfrage senden" rein

**Vorher:** Im RND-Wizard-Ergebnis-Modal gab es 3 Buttons:
- PDF herunterladen
- DOCX herunterladen
- Vollständiges Gutachten anfragen (öffnete Expert-Maske als Fallback)

**Jetzt:** Nur noch 2 Buttons:
- **Schließen** (Outline)
- **Jetzt Anfrage senden →** (Gold-Primary)

Der User kann das Gutachten nicht mehr selbst exportieren. Mit Klick auf "Anfrage senden" wird:

1. Vollständiger Wizard-State + Ergebnis + AfA-Vergleich als JSON gepackt
2. POST an `/api/v1/rnd-request` (Backend)
3. Backend speichert die Datei in `/data/rnd-requests/RND-YYYYMMDD-XXXX.json` für späteren Import in dein RND-Modul
4. Backend sendet E-Mail an dich mit Zusammenfassung + Referenz-Nummer
5. Erfolgs-Modal beim User zeigt: "✓ Anfrage erfolgreich übermittelt — Ref. RND-..."

### 4. Robustes Fallback bei Server-Problemen

Falls der Backend-Endpunkt nicht erreichbar ist (Network-Error, Server down), wird **nicht einfach geschluckt**. Stattdessen bekommt der User ein Modal:
- "Server zurzeit nicht erreichbar"
- Button "📄 JSON herunterladen" — lädt die Wizard-Daten als JSON-Datei
- Hinweis: "Bitte per E-Mail an info@junker-immobilien.io senden"

So gehen die Eingaben des Users nie verloren.

### 5. Backend-Endpunkt `/api/v1/rnd-request` ★ NEU

Drei Routen:

**POST /** — User schickt Anfrage
- Authentifiziert (User-Login)
- Rate-Limit: 10 pro Stunde pro User
- Validierung mit Zod (passthrough — wir akzeptieren alle Wizard-Felder)
- Speichert JSON-Datei in `/data/rnd-requests/`
- Mail an `info@junker-immobilien.io` (oder konfigurierte Adresse)
- Antwort: `{ success: true, request_id: 'RND-YYYYMMDD-XXXX' }`

**GET /list** — Liste aller Anfragen (für späteres Admin-UI)
- Authentifiziert
- Letzte 50 Anfragen sortiert nach Datum
- Felder: request_id, received_at, user_email, objekt, rnd

**GET /:id** — Einzelne Anfrage abrufen (für Import ins RND-Modul)
- Authentifiziert
- Validiert ID-Format
- Gibt komplette JSON zurück

---

## Files im ZIP

```
frontend/js/d1-type-handler.js     (aus V148)
frontend/js/portfolio-strategy.js  (V146/148-Stand)
frontend/js/portfolio-strategy-ui.js
frontend/js/deal-action.js         ★ Export-Buttons raus, Anfrage-Versand drin
frontend/js/config.js              (Label V149)
frontend/css/rnd-styles.css        ★ Wizard-Layout-Fix
frontend/css/select-fix.css        ★ NEU — Dropdown-Bug-Fix

backend/src/routes/rndRequest.js   ★ NEU — Backend-Route
README_V149.md
```

---

## Hetzner-Deployment

### Frontend

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124

cp -r frontend frontend.bak-pre-v149
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dealpilot dealpilot_db > /root/db-backup-pre-v149.sql

# ZIP hochladen lokal: scp dealpilot-v149.zip root@hetzner-host:/root/

unzip -q -o /root/dealpilot-v149.zip

# Neue CSS-Datei muss in index.html geladen werden
# Sed-Patch: füge select-fix.css NACH rnd-styles.css ein
grep -q "select-fix.css" frontend/index.html || \
  sed -i 's|<link rel="stylesheet" href="css/rnd-styles.css?v=[0-9]\+">|&\n<link rel="stylesheet" href="css/select-fix.css?v=149">|' frontend/index.html

# Verify
grep -c "select-fix.css" frontend/index.html

# Versions-Bumps
sed -i 's|deal-action\.js?v=[0-9]\+|deal-action.js?v=149|g' frontend/index.html
sed -i 's|portfolio-strategy\.js?v=[0-9]\+|portfolio-strategy.js?v=149|g' frontend/index.html
sed -i 's|portfolio-strategy-ui\.js?v=[0-9]\+|portfolio-strategy-ui.js?v=149|g' frontend/index.html
sed -i 's|config\.js?v=[0-9]\+|config.js?v=149|g' frontend/index.html
sed -i 's|d1-type-handler\.js?v=[0-9]\+|d1-type-handler.js?v=149|g' frontend/index.html
sed -i 's|rnd-styles\.css?v=[0-9]\+|rnd-styles.css?v=149|g' frontend/index.html

docker compose -f docker-compose.prod.yml up -d --build
```

### Backend (Route registrieren)

Die Backend-Route muss von dir manuell ins Server-Image eingebaut werden:

```bash
# 1. Datei kopieren ins Backend-Verzeichnis
# Erwarteter Pfad im Backend-Container: /app/src/routes/rndRequest.js
# Auf Hetzner musst du den richtigen Pfad nehmen (je nach Compose-Volume)

# Vermutlich (im Backend-Source):
docker compose -f docker-compose.prod.yml exec backend ls /app/src/routes/

# Datei rein-kopieren:
docker cp /root/dealpilot-v149/backend/src/routes/rndRequest.js \
  dealpilot-backend:/app/src/routes/rndRequest.js

# 2. In index.js registrieren — Zeile nach den anderen routes/-Imports:
# const rndRequestRoutes = require('./routes/rndRequest');
# und unten bei app.use():
# app.use('/api/v1/rnd-request', rndRequestRoutes);
```

⚠ **Wichtig:** Backend-Änderungen brauchen einen vollen Rebuild. Wenn dir das zu heikel ist, kann das Backend in einer eigenen Mini-Session deployt werden. **Das Frontend funktioniert auch ohne Backend** — der Fallback-Modus zeigt dann das JSON-Download-Modal.

## Verifikation

### 1. Dropdown öffnet beim Klick (Strg+Shift+R)
- Tab **Finanzierung** → Darlehen I → Klick auf **"Art des Darlehens"**
- Liste öffnet sich mit beiden Optionen
- "Tilgungsaussetzungsdarlehen" auswählen → Bauspar-Card erscheint

### 2. RND-Wizard Checkbox-Layout
- Deal-Aktion → RND-Wizard öffnen → bis Step 7 durchklicken
- Schäden-Checkboxen haben **klaren Abstand**, hover-Effekt mit Gold-Border
- "Erweitert"-Box ganz unten in Cream-Box mit Erklär-Text

### 3. Anfrage senden
- Im RND-Wizard alle Steps ausfüllen → bis Step 9 (Ergebnis)
- **Nur 2 Buttons** sichtbar: "Schließen" + "Jetzt Anfrage senden →"
- Klick auf "Anfrage senden":
  - Mit Backend-Route deployt: ✓ Anfrage übermittelt mit Referenz-Nr
  - Ohne Backend-Route: "Server nicht erreichbar" + JSON-Download-Button

## Rollback

```bash
cd /opt/dealpilot-v25/dealpilot-v124
rm -rf frontend
mv frontend.bak-pre-v149 frontend
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Offene Punkte (V150+)

- **PDF/DOCX-Abweichung zum Referenz-Gutachten** (du hast erwähnt — bitte Referenz-PDF nochmal hochladen + sagen ob Layout, Werte oder Texte abweichen)
- **Admin-UI** für die RND-Anfragen-Liste (Import-Button im RND-Modul)
- **PDF-Import** für Bankdarlehen + Bausparvertrag (V148-Stub)
- **Portfolio-Strategie als Wizard** (großer Umbau)
- **KI-Prompt-Fix** für LTV mit Verkehrswert (Backend)
