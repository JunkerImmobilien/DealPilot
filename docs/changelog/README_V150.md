# V150 — Dropdown-Gate-Fix + RND-Wizard Cleanup

## Was ist neu in V150?

### 1. ★ d1-Dropdown öffnet jetzt mit beiden Optionen (Investor + Pro)

**Problem (gefunden!):** Im Investor-Plan war die Option "Tilgungsaussetzungsdarlehen" zwar im DOM vorhanden, aber zur Laufzeit per JavaScript auf `disabled + hidden + display:none` gesetzt. Das war Plan-Gating das nur den Pro-Plan zugelassen hat. Beim Klick öffnete sich das Dropdown, zeigte aber nur "Annuitätendarlehen" weil die andere Option versteckt war.

**Fix in `d1-type-handler.js`:** Force-Enable mit Plan-Awareness:
- **Free, Investor, Pro, Business:** Tilgungsaussetzung sichtbar und auswählbar ✓
- **Starter (nur):** Bleibt gesperrt, mit klarem Hinweis "🔒 — ab Investor-Plan" statt unsichtbar

Plus ein `MutationObserver` der die Optionen wieder freischaltet falls **irgendein anderes Skript** sie nochmal versteckt (Belt + Suspenders).

### 2. RND-Wizard: Export-Buttons entfernt, nur "Anfrage senden" bleibt

**Vorher (V149):**
- Wizard endete mit "In Editor übernehmen ✓" Button
- Editor öffnete sich mit "Gutachten als PDF / als DOCX / Im Rechner anpassen"
- User konnte selbst exportieren

**Jetzt (V150):**
- Wizard-Step 9 (Zusammenfassung) hat **nur einen Button**: "📨 Jetzt vollständiges Gutachten anfragen"
- Footer-Button heißt "Schließen" statt "In Editor übernehmen"
- Kein Editor-Pfad mehr, kein Rechner-Modus
- PDF/DOCX-Funktionen bleiben im Code (als `_legacyGenerate*_unused`) — nicht entfernt, damit Marcel sie später aus einem Admin-Tool nutzen kann

**Workflow:**
1. User klickt "Anfrage senden"
2. Loading-Spinner
3. POST an `/api/v1/rnd-request` mit vollständigen Wizard-Daten als JSON
4. Backend speichert + sendet Mail an Junker Immobilien
5. Erfolg: grüne Box mit Referenz-Nr.
6. Fehler: Fallback mit fertigem mailto-Link (Daten gehen nicht verloren)

### 3. GND und Alter werden im Ergebnis-Modal korrekt angezeigt

**Vorher:** "GND ? J." / "ALTER ? J." weil das `result`-Objekt diese Felder nicht hatte.

**Jetzt:** Vor dem Rendern werden GND (aus Objekttyp-Tabelle, Default 70) und Alter (Stichtagsjahr − Baujahr) berechnet und ergänzt.

### 4. PDF/DOCX-Abweichungen zum Referenz-Gutachten

Da User nicht mehr exportieren kann, sind PDF/DOCX-Abweichungen ein **internes Thema** (nur für Marcels Admin-Tool relevant). Folgende Punkte sind bekannt und werden in V151+ adressiert, sobald Marcel das Admin-Tool nutzt:

- Energieausweis-Wert leer (sollte aus Wizard-Eingabe kommen)
- Modernisierungs-Tabelle: "Keine/Nie" statt "> 20 Jahre" bei lange zurückliegenden Sanierungen
- "Alter von ca. — Jahren" Variable fehlt im Text
- AfA-Anlage (Seite 36) ist im Original nicht enthalten — sollte raus
- Tragwerks-Text und Restlebensdauer-Stufen feinjustieren

---

## Files im ZIP

```
frontend/js/d1-type-handler.js     ★ Force-Enable mit Plan-Awareness
frontend/js/rnd-wizard.js          ★ Nur "Anfrage senden", Export raus
frontend/js/deal-action.js         ★ GND/Alter-Enrichment
frontend/js/config.js              (Label V150)
frontend/css/rnd-styles.css        (aus V149)
frontend/css/select-fix.css        (aus V149)
backend/src/routes/rndRequest.js   (aus V149)
README_V150.md
```

---

## Hetzner-Deployment

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124

cp -r frontend frontend.bak-pre-v150
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dealpilot dealpilot_db > /root/db-backup-pre-v150.sql

# ZIP hochladen lokal: scp dealpilot-v150.zip root@hetzner-host:/root/
unzip -q -o /root/dealpilot-v150.zip

# select-fix.css einbinden (falls noch nicht da)
grep -q "select-fix.css" frontend/index.html || \
  sed -i 's|<link rel="stylesheet" href="css/rnd-styles.css?v=[0-9]\+">|&\n<link rel="stylesheet" href="css/select-fix.css?v=150">|' frontend/index.html

# Cache-Bumps
sed -i 's|d1-type-handler\.js?v=[0-9]\+|d1-type-handler.js?v=150|g' frontend/index.html
sed -i 's|rnd-wizard\.js?v=[0-9]\+|rnd-wizard.js?v=150|g' frontend/index.html
sed -i 's|deal-action\.js?v=[0-9]\+|deal-action.js?v=150|g' frontend/index.html
sed -i 's|config\.js?v=[0-9]\+|config.js?v=150|g' frontend/index.html
sed -i 's|rnd-styles\.css?v=[0-9]\+|rnd-styles.css?v=150|g' frontend/index.html
sed -i 's|select-fix\.css?v=[0-9]\+|select-fix.css?v=150|g' frontend/index.html

docker compose -f docker-compose.prod.yml up -d --build
```

## Verifikation

### 1. d1-Dropdown beide Optionen (Investor-Plan!)
```javascript
const sel = document.getElementById('d1_type');
console.log('Optionen:', Array.from(sel.options).map(o =>
  o.value + ' | disabled=' + o.disabled + ' hidden=' + o.hidden));
// Erwartet: beide value=annuitaet UND value=tilgungsaussetzung mit disabled=false
```

Visueller Test:
- Tab **Finanzierung** → Darlehen I → Klick auf "Art des Darlehens"
- Liste klappt auf
- **Beide Optionen sichtbar**: Annuitätendarlehen + Tilgungsaussetzungsdarlehen
- Klick auf "Tilgungsaussetzungsdarlehen" → Bauspar-Card erscheint

### 2. RND-Wizard hat nur "Anfrage senden"
- Deal-Aktion → RND-Wizard öffnen
- 9 Steps durchklicken
- Ergebnis-Anzeige zeigt RND + AfA-Vergleich
- **Nur 1 Button** sichtbar: "📨 Jetzt vollständiges Gutachten anfragen"
- Footer-Button: "Schließen" (statt "In Editor übernehmen")
- Kein PDF/DOCX/Rechner-Button

### 3. GND und Alter korrekt
- Im RND-Ergebnis-Modal (falls noch über alten Pfad geöffnet):
- GND zeigt 70 (für Wohnobjekte) statt "?"
- ALTER zeigt z.B. "32" statt "?"

## Starter-Plan-Test (falls vorhanden)
```javascript
localStorage.setItem('dp_plan_override', 'starter');
location.reload();
```
Erwartung: Tilgungsaussetzungs-Option im Dropdown bleibt sichtbar aber **disabled mit "🔒"-Hinweis**.

```javascript
localStorage.removeItem('dp_plan_override');  // zurücksetzen
```

## Rollback
```bash
cd /opt/dealpilot-v25/dealpilot-v124
rm -rf frontend
mv frontend.bak-pre-v150 frontend
docker compose -f docker-compose.prod.yml up -d --build
```
