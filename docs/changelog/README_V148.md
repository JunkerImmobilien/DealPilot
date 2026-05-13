# V148 — D1-Tilgungsaussetzung funktioniert + RND-Wizard hübsch

## Was ist neu in V148?

### 1. d1-Tilgungsaussetzungs-Dropdown funktioniert endlich ★

**Problem:** In deiner Live-Version (V145) gibt es schon das Dropdown "Art des Darlehens" bei Darlehen I mit den Optionen Annuitätendarlehen + Tilgungsaussetzungsdarlehen. Aber beim Klick passierte nichts — die Funktion `onD1TypeChange()` war **nirgends im Code implementiert**.

**Fix:** Neue Datei `d1-type-handler.js` implementiert alle V63.57-Funktionen die im HTML referenziert sind aber im Code fehlten:

- `onD1TypeChange()` — Bei Tilgungsaussetzung wird:
  - Bauspar-Card (war versteckt) sichtbar gemacht
  - Tilgungs-Feld auf 0 gesetzt und deaktiviert (ausgegraut)
  - Hinweis "bei Aussetzung deaktiviert" eingeblendet

- `calcD1Volltilgung()` — Berechnet das Volltilgungs-Jahr live:
  - Annuität: aus Zins + Tilgung + Auszahldatum
  - Tilgungsaussetzung: Anzeige "Bauspar löst ab" statt Datum

- `_recalcBspar()` — Bauspar-Zuteilung wird live berechnet:
  - Voraussichtliche Jahre bis Zuteilung
  - Zuteilungs-Datum (basierend auf Auszahldatum + Sparrate)
  - Bauspardarlehens-Rate (Annuität auf die Differenz)

- `openTilgungsplanModal()` — Tilgungsplan als Modal-Tabelle:
  - Jahr für Jahr: Restschuld Anfang → Zinsen → Tilgung → Rate → Restschuld Ende
  - Summen unten
  - Bei Tilgungsaussetzung: zeigt nur die Zinsbindungs-Jahre mit Tilgung 0

- `triggerPdfImportTo()` — Stub mit Erklärung wie's manuell geht, automatischer Import kommt in V149+

### 2. RND-Wizard Styling — sieht aus wie Settings-Modal

**Problem aus deinem Screenshot:** Der Wizard erschien hinter/unter dem Header (z-index zu niedrig), Felder verrutscht, weiße Boxen die nicht zur App-Optik passten.

**Fix in `rnd-styles.css`:**
- z-index auf **99999** (vor allem anderem) mit `!important` gegen jede CSS-Konkurrenz
- Volle Hintergrund-Abdunkelung mit Blur-Effekt
- Header in **Charcoal** (var(--ch)) mit Cormorant Garamond Überschrift — wie Settings
- Eingabefelder mit deinem **Gold-Border auf Focus**, identisch zu Settings-Inputs
- Step-Indikator mit Gold/Charcoal-Farbgebung
- Primary-Button in Gold, Secondary in Outline — wie überall sonst
- Footer in Creme-Hintergrund (FAF6E8)
- Modal-Border in Gold

Die alten Styles bleiben drin, werden aber durch `!important` überschrieben — kein Risiko.

### 3. Bauspar-Karte im Strategie-Modul (aus V146)

Sobald `d1_type = tilgungsaussetzung` UND `bspar_sum > 0` gesetzt sind, zeigt das Strategie-Modul eine eigene Karte mit:
- Status-Ampel (grün = Bauspar deckt Anschluss / rot = Lücke)
- Anschlussfinanzierungs-Warnung mit konkreter Deckungs-Quote
- Voraussichtliche Jahre bis Zuteilung

### 4. Verkehrswert über `svwert`/`bankval` (aus V145)

Bleibt unverändert drin — Beleihungswertreserve wird korrekt berechnet.

---

## Was ich NICHT angefasst habe

- **`index.html` wird NICHT überschrieben** — V147 hat das kaputt gemacht. Ab V148: nur additive sed-Patches
- Header-Struktur, Tab-Struktur, Sidebar — bleibt 1:1 wie in deinem V145 Live

---

## Files im ZIP

```
frontend/js/d1-type-handler.js     ★ NEU
frontend/js/portfolio-strategy.js  (V146-Bauspar + V145-VW)
frontend/js/portfolio-strategy-ui.js (V146-Bauspar-Card)
frontend/js/config.js              (Label V148)
frontend/css/rnd-styles.css        (Wizard-Styling-Fix)
README_V148.md
```

**Keine index.html in der ZIP!** Stattdessen 2 sed-Einzeiler unten zum Hinzufügen des Script-Tags.

---

## Hetzner-Deployment

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124

# Backup
cp -r frontend frontend.bak-pre-v148
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dealpilot dealpilot_db > /root/db-backup-pre-v148.sql

# ZIP hochladen vom lokalen Rechner:
# scp dealpilot-v148.zip root@hetzner-host:/root/

# ZIP entpacken (überschreibt nur JS/CSS-Files, KEINE index.html)
unzip -q -o /root/dealpilot-v148.zip

# === SED-PATCH 1: d1-type-handler.js in index.html einbinden ===
# Fügt den Script-Tag NACH calc.js ein
sed -i 's|<script src="js/calc.js?v=124"></script>|<script src="js/calc.js?v=124"></script>\n<script src="js/d1-type-handler.js?v=148"></script>|' frontend/index.html

# Verify (sollte 1 zeigen):
grep -c "d1-type-handler.js" frontend/index.html

# === SED-PATCH 2: Cache-Bumps für geänderte Files ===
sed -i 's|portfolio-strategy\.js?v=[0-9]\+|portfolio-strategy.js?v=148|g' frontend/index.html
sed -i 's|portfolio-strategy-ui\.js?v=[0-9]\+|portfolio-strategy-ui.js?v=148|g' frontend/index.html
sed -i 's|config\.js?v=[0-9]\+|config.js?v=148|g' frontend/index.html
sed -i 's|rnd-styles\.css?v=[0-9]\+|rnd-styles.css?v=148|g' frontend/index.html

# Final-Check (alles auf 148, plus neuer Handler):
grep -oE '(d1-type-handler|portfolio-strategy[\w-]*|config|rnd-styles)\.(js|css)\?v=[0-9]+' frontend/index.html | sort -u

# Docker rebuild
docker compose -f docker-compose.prod.yml up -d --build
sleep 25
docker ps | grep dealpilot
```

## Verifikation im Browser (Strg+Shift+R)

### 1. d1-Tilgungsaussetzung funktioniert
- Tab **Finanzierung** öffnen
- Card "Darlehen I – Hauptdarlehen"
- Dropdown "Art des Darlehens" → **"Tilgungsaussetzungsdarlehen (mit Bausparvertrag)"** auswählen
- **Bauspar-Card erscheint** automatisch darunter
- Tilgungs-Feld wird **grau/deaktiviert** mit "0"
- Felder ausfüllen: Bausparkasse, Bausparsumme, Sparrate, Mindestquote
- **Status-Box** unten in der Bauspar-Card zeigt: "✓ Zuteilung voraussichtlich nach X Jahren"
- "Zuteilungsdatum (auto berechnet)" zeigt konkretes Datum
- "Rate Bauspardarlehen / Monat (auto)" berechnet sich live

### 2. Tilgungsplan ansehen
- Button **"📋 Tilgungsplan ansehen & bearbeiten"** klicken
- Modal öffnet sich mit Jahres-Tabelle
- Bei Annuität: Tilgung wächst, Restschuld sinkt
- Bei Tilgungsaussetzung: Tilgung 0, Restschuld konstant über Zinsbindung

### 3. RND-Wizard sieht aus wie Settings-Modal
- Tab **Deal-Aktion** → "Gutachten & Expertise anfragen" → Radio "Restnutzungsdauer"
- Wizard öffnet sich
- **Header in Charcoal**, Modal mit Goldrand
- Step-Indikator mit Gold-Highlight
- Eingabefelder breit, Focus mit Gold-Border
- Buttons: Gold (Weiter) / Outline (Zurück)
- Footer in Creme-Hintergrund
- Wizard sitzt **VOR** dem Header (z-index 99999)

## Rollback

```bash
cd /opt/dealpilot-v25/dealpilot-v124
rm -rf frontend
mv frontend.bak-pre-v148 frontend
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Offene Punkte (V149+)

- **PDF-Import** für d1-Bankdarlehen und Bausparvertrag (Stub aktuell, KI-gestützte Volltextanalyse kommt)
- **Tilgungsplan editierbar** (aktuell nur Anzeige)
- **Portfolio-Strategie als Wizard** (großer Umbau, eigene Session)
- **KI-Prompt-Fix** für LTV-Berechnung mit Verkehrswert (Backend)
- **Excel-Import-Erweiterung** für Tilgungsaussetzung+Bauspar (ImmoKalk.xlsm)
