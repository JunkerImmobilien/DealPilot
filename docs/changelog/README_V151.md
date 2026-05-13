# V151 — RND-Prefill + Datenraum-Fix + Settings-Modal-Fix

## Was ist neu in V151?

### 1. ★ RND-Wizard übernimmt jetzt alle Objektdaten

**Problem:** Beim Starten des RND-Wizards waren Straße, Hausnummer, PLZ, Ort, Einheit, Baujahr und Wohnfläche **leer** — der User musste alles doppelt eingeben.

**Ursache:** `_getRndPrefill()` suchte nach DOM-IDs mit `input-`-Prefix (`input-str`, `input-plz` etc.), aber die Live-V145-HTML nutzt **kurze IDs ohne Prefix** (`str`, `plz`, `wfl`, `baujahr`, `mea`).

**Fix:** FieldMap überarbeitet — versucht zuerst die echten Live-IDs (`str`, `hnr`, `plz`, `ort`, `mea`, `baujahr`, `wfl`, `kp`, `kuerzel`, `objart`), dann Fallback auf `input-`-prefixed Variante. Zusätzlich werden gebaut:

- `objekt_adresse` = "Strasse Hnr, PLZ Ort" als Komposit-Feld
- `einheit` aus `mea` (z.B. WE 02)
- `kuerzel_kurz` aus `kuerzel`

**Verifikation in der Console nach Wizard-Start:**
```javascript
// Vor V151:
// [RND-Wizard] Prefill ermittelt: { stichtag: '2026-05-11' }   ← fast leer
// Mit V151:
// [RND-Wizard] Prefill ermittelt: { baujahr: '1994', wohnflaeche: '52.6',
//   str: 'Am Markt', hnr: '9', plz: '06184', ort: 'Großkugel',
//   einheit: '...', objekt_adresse: 'Am Markt 9, 06184 Großkugel', ... }
```

### 2. ★ "Datenraum einrichten" öffnet jetzt das Settings-Modal

**Problem:** Klick auf "Datenraum einrichten" zeigte "Settings-Modal konnte nicht geöffnet werden".

**Ursache:** Die Funktion sucht `openSettings`, aber die Live-App heißt sie **`showSettings`** (in settings.js Zeile 99 definiert, Zeile 496 als `window.showSettings` exportiert).

**Fix:** Aufruf-Reihenfolge: `showSettings('datenraum')` → `showSettings()` → `openSettings(...)` → alert. Plus: `showSettings(initialTab)` akzeptiert den Tab-Namen direkt als Parameter — kein separater Klick auf Tab nötig.

### 3. ★ Dokumentenprüfung: klarere leere-Zustände

Im Bank-/FB-Anfrage-Modal zeigt das Datenraum-Panel jetzt **unterscheidbare Zustände:**

- **Kein Objekt:** "Kein aktives Objekt geladen — bitte zuerst Objekt im Tab 'Objekt' laden oder erstellen."
- **Objekt da, kein Datenraum:** "Datenraum nicht angehängt — bitte zuerst persönlichen Cloud-Ordner und Objekt-Ordner verknüpfen" + Button "Datenraum einrichten"
- **Alles verknüpft:** Pflicht-Dokumenten-Liste mit Status-Bars (unverändert)

So weiß der User immer was als nächstes zu tun ist.

### 4. PDF/DOCX/Editor-Buttons im RND-Wizard — Cache-Bump erzwungen

Falls du nach V150-Deploy immer noch PDF/DOCX/Editor-Buttons gesehen hast: Das war ein **Browser-Cache-Problem**, weil das Cache-Bump für `rnd-wizard.js` nicht durchgelaufen war. In V151 setzen wir die Cache-Version explizit auf 151 für **alle** RND-relevanten Files.

**Verifikation nach V151-Deploy:**
```javascript
console.log('rnd-wizard.js:', 
  document.querySelector('script[src*="rnd-wizard.js"]')?.src);
// Sollte enden mit ?v=151
```

### 5. Backend-Route `/api/v1/rnd-request` — DEPLOY-ANLEITUNG

**Status:** Die Route-Datei `rndRequest.js` ist seit V149 fertig, **aber noch nicht im Backend registriert**. Deshalb bekommt der User "Server nicht erreichbar" beim Klick auf "Jetzt Anfrage senden".

**Was du tun musst (einmalig):**

```bash
# 1. Datei ins Backend-Image bringen
docker cp /root/dealpilot-v151/backend/src/routes/rndRequest.js \
  dealpilot-v124-backend:/app/src/routes/rndRequest.js

# 2. In index.js die Route registrieren
docker compose -f docker-compose.prod.yml exec backend sh -c '
  # Falls noch nicht registriert: Import + use einfügen
  grep -q "rndRequestRoutes" /app/src/index.js || \
    sed -i "
      /const betaSignupRoutes = require/ a\
const rndRequestRoutes = require(\"./routes/rndRequest\");
      /app.use(.\/api\/v1\/beta-signup./ a\
app.use(\"/api/v1/rnd-request\", rndRequestRoutes);
    " /app/src/index.js
'

# 3. Backend-Container neu starten
docker compose -f docker-compose.prod.yml restart backend

# 4. Testen
curl -s https://dealpilot.junker-immobilien.io/api/v1/rnd-request/list \
  -H "Cookie: <deine-session-cookie>"
# Sollte JSON-Liste zurückgeben (auch leer ist OK)
```

**Falls Docker-Container heißt anders:** Prüfe mit `docker ps | grep dealpilot`.

---

## Files im ZIP

```
frontend/js/deal-action.js     ★ Prefill-Fix + Settings-Modal-Fix
frontend/js/datenraum.js       ★ Klarere Empty-States
frontend/js/rnd-wizard.js      (V150-Stand, nur Cache-Bump)
frontend/js/d1-type-handler.js (V150-Stand, nur Cache-Bump)
frontend/js/config.js          (Label V151)
frontend/css/select-fix.css    (aus V149)
frontend/css/rnd-styles.css    (aus V149)
backend/src/routes/rndRequest.js  ★ Bereit für Backend-Deploy
README_V151.md
```

---

## Frontend-Deployment

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124

cp -r frontend frontend.bak-pre-v151
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dealpilot dealpilot_db > /root/db-backup-pre-v151.sql

# ZIP hochladen lokal: scp dealpilot-v151.zip root@hetzner-host:/root/
unzip -q -o /root/dealpilot-v151.zip

# Cache-Bumps (REDUNDANT — sicher dass alle durchgehen)
sed -i 's|deal-action\.js?v=[0-9]\+|deal-action.js?v=151|g' frontend/index.html
sed -i 's|datenraum\.js?v=[0-9]\+|datenraum.js?v=151|g' frontend/index.html
sed -i 's|rnd-wizard\.js?v=[0-9]\+|rnd-wizard.js?v=151|g' frontend/index.html
sed -i 's|d1-type-handler\.js?v=[0-9]\+|d1-type-handler.js?v=151|g' frontend/index.html
sed -i 's|config\.js?v=[0-9]\+|config.js?v=151|g' frontend/index.html
sed -i 's|select-fix\.css?v=[0-9]\+|select-fix.css?v=151|g' frontend/index.html
sed -i 's|rnd-styles\.css?v=[0-9]\+|rnd-styles.css?v=151|g' frontend/index.html

# Verify alle Files auf v151
echo "═══ Cache-Versionen ═══"
grep -oE '(deal-action|datenraum|rnd-wizard|d1-type-handler|config)\.js\?v=[0-9]+' frontend/index.html | sort -u

docker compose -f docker-compose.prod.yml up -d --build
```

## Backend-Deployment (separat, siehe oben in Punkt 5)

---

## Verifikation nach Deploy

### 1. RND-Prefill (HARD: Strg+Shift+R)
- Lade ein Objekt mit Adresse + Daten
- Deal-Aktion → RND-Wizard öffnen
- **Step 1 (Objektdaten):** Straße, Hnr, PLZ, Ort, Baujahr, Wohnfläche **automatisch ausgefüllt**
- Console-Log: `[RND-Wizard] Prefill ermittelt: { ... viele Felder ... }`

### 2. RND-Wizard Step 9 (Ergebnis)
- Alle Steps durchklicken
- **Nur 1 Button** sichtbar: "📨 Jetzt vollständiges Gutachten anfragen"
- KEIN "PDF", "DOCX", "In Editor öffnen"
- Footer-Button: "Schließen"

### 3. Datenraum einrichten (Bug-Fix)
- Deal-Aktion → "Datenraum einrichten" klicken
- **Settings-Modal öffnet sich** direkt auf Tab "Datenraum"
- Keine Alert-Meldung mehr

### 4. Dokumentenprüfung leere Zustände
- Bank-Anfrage öffnen ohne aktives Objekt:
  - "Kein aktives Objekt geladen — bitte zuerst Objekt im Tab 'Objekt' laden"
- Bank-Anfrage öffnen mit Objekt aber ohne Datenraum:
  - "Datenraum nicht angehängt" + Button "Datenraum einrichten"

### 5. Anfrage senden (nach Backend-Deploy)
- Wizard durchklicken → "Anfrage senden"
- ✓ Grüne Erfolgs-Box mit Referenz-Nr. (z.B. `RND-20260511-A1B2`)
- E-Mail in deinem Posteingang mit Wizard-Daten

---

## Was bleibt offen für V152+

- **Placeholder-Texte** in allen Tabs (kein "Herford" etc.) → System sichten, neutrale Platzhalter setzen, evtl. Autocomplete
- **PDF/DOCX-Layout-Korrekturen** für dein Admin-Tool: Energieausweis, "> 20 Jahre" statt "Keine/Nie", "Alter von ca. — Jahren" Variable, AfA-Anlage raus
- **`custom_finance_models` für Investor** in Plan-Konfig freischalten (sauberere Lösung als V150-Override)

## Rollback
```bash
cd /opt/dealpilot-v25/dealpilot-v124
rm -rf frontend
mv frontend.bak-pre-v151 frontend
docker compose -f docker-compose.prod.yml up -d --build
# Backend: einfach den geänderten index.js zurücksetzen
```
