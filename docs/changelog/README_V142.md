# V142 — RND-Wizard + Portfolio-Strategie im Menü + Rechtliches-Tab

## Was ist neu in V142?

### 1. RND-Modul V3.0 mit Wizard und DOCX-Export ★★★

**Bug-Fix in der technischen RND-Formel** (kritisch):
In V2 wurde "aktueller Standard" als neutral (kein Aufschlag) behandelt — das war falsch.
V3 nutzt die Original-Gutachter-Formel:
```
RND-Basis      = GND - Alter
Abzug          = RND-Basis × veraltet% / 2
Aufschlag Std. = RND-Basis × standard% / 2   ← in V2 war hier 0
Aufschlag Geh. = RND-Basis × gehoben%
RND            = RND-Basis − Abzug + AufStd + AufGeh
```
Verifiziert an zwei Original-Gutachten von "Der Gutachter München":
- 25DG06644 (WE 03, Mix 100/0/0) → 22 J. ✓
- 25DG02661 (WE 18, Mix 85/15/0) → 26 J. ✓

**Neuer 9-Schritt-Wizard** (rnd-wizard.js) inspiriert vom dergutachter.net-Original:
1. Objekt-Basis (Typ, Adresse, Baujahr, Wohnfläche)
2. Auftraggeber & Stichtag
3. Bauliche Anlagen (Dach, Fenster, Heizung)
4. Gebäudetechnik (Energieträger, Warmwasser)
5. Sanitäranlagen
6. Modernisierungen (Punktraster)
7. Schäden
8. Gewerke-Bewertung
9. Zusammenfassung & Berechnung

**Auto-Ergebnis-Modal nach Wizard-Abschluss** mit:
- RND-Wert (z.B. "26 J.")
- AfA-Vergleich Standard vs. Kurz mit konkreten €-Beträgen pro Jahr
- **"Lohnt sich"-Bewertung** ampelfarbcodiert:
  - 🟢 **klar lohnenswert** (Netto-Vorteil >0)
  - 🟡 **grenzwertig**
  - 🔴 **nicht lohnenswert** (Gutachter-Kosten > Steuer-Ersparnis)
- Drei Aktions-Buttons: PDF, DOCX, Vollständiges Gutachten anfragen

**Neuer DOCX-Export** (rnd-docx.js):
Erstellt eine echte .docx-Datei (Office Open XML), bearbeitbar in Word/LibreOffice — vollständig mit allen Kapiteln, Tabellen, Anlage BFH IX R 25/19.

**Direkter DealPilot-JSON-Import**:
`DealPilotRND.mapDealPilotObject()` mappt automatisch `rate_bad/boden/fenster/kueche`, `ds2_zustand`, `ds2_energie`, `geb_ant` etc. — Wizard wird mit den Objektdaten vorausgefüllt.

### 2. Portfolio-Strategie als Card in Deal-Aktion

Vorher: Versteckter Hidden-Gate über "roter Punkt" in Settings → Info.
Jetzt: **Eigene Action-Card in Tab "Deal-Aktion"** mit "Modul öffnen"-Button.

Card-Inhalt: "17 Strategien · 12 Diagnose-Karten · Anlage-Ziel, Bestand und Marktlage in einer ganzheitlichen Strategie. RND, KP-Aufteilung, GmbH-Verkauf, Eigenheim­schaukel, Familien­stiftung u.v.m."

### 3. Rechtliches-Tab in Settings

Vorher: Impressum + Datenschutz waren collapsed im Info-Tab versteckt.
Jetzt: **Eigener Tab "Rechtliches"** zwischen Info und Hilfe, beide Texte dauerhaft ausgeklappt sichtbar.

Im Info-Tab gibt's nur noch einen Verweis-Button "📋 Impressum & Datenschutz" der zum Rechtliches-Tab führt.

### 4. Datenraum-Fix: Backend-Objekte laden

**Bug in V141:** Datenraum-Tab in Settings zeigte "Noch keine Objekte angelegt" obwohl Objekte da waren. Das lag daran, dass `datenraum.js` versuchte aus `localStorage` zu lesen — DealPilot lädt aber über Backend-API.

**Fix:** Datenraum nutzt jetzt die globale Funktion `window.getAllObjectsData()` (async, fetcht vom Backend). Settings-Tab zeigt erst "Lade Objekte aus dem Backend …" und rendert nach Backend-Antwort die echte Drop-down-Liste.

---

## Inhalt der ZIP

```
frontend/js/datenraum.js                ← Backend-Objekt-Fix
frontend/js/deal-action.js              ← Wizard-Trigger + Portfolio-Card
frontend/js/settings.js                 ← Rechtliches-Tab + Info-Tab gestrafft
frontend/js/portfolio-strategy.js       ← Version V142
frontend/js/portfolio-strategy-ui.js    (unverändert)
frontend/js/portfolio-strategy-pdf.js   (unverändert)
frontend/js/bank-negotiation-pdf.js     (unverändert)
frontend/js/config.js                   ← Version-Label V142
frontend/js/rnd-calc.js                 ★ V3.0 Bug-Fix
frontend/js/rnd-ui.js                   ★ V3.0
frontend/js/rnd-pdf.js                  ★ V3.0 Original-Layout
frontend/js/rnd-docx.js                 ★ NEU
frontend/js/rnd-wizard.js               ★ NEU — 9-Schritt-Wizard
frontend/js/rnd-gnd-table.js            (V3.0)
frontend/js/rnd-bte-katalog.js          (V3.0)
frontend/css/datenraum.css              (unverändert)
frontend/css/portfolio-strategy.css     (unverändert)
frontend/css/rnd-styles.css             ★ V3.0
frontend/index.html                     ← script-Tags für Wizard + DOCX
README_V142.md                          ← diese Datei
```

---

## Hetzner-Deployment

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124  # Live-Ordner (oder wo es bei dir liegt)

# Backup
cp -r frontend frontend.bak-pre-v142
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dealpilot dealpilot_db > /root/db-backup-pre-v142.sql

# ZIP hochladen + entpacken
scp dealpilot-v142.zip root@hetzner-host:/root/  # vom lokalen Rechner
unzip -q -o /root/dealpilot-v142.zip
# Achtung: die index.html in der ZIP enthält NICHT alle Strategie-Tags
# der V134-Live-Variante. Du hattest die in V141 bereits korrekt eingebaut,
# daher nehmen wir die produktive index.html als Basis:
cp frontend.bak-pre-v142/index.html frontend/index.html

# Versions-Bumps für V142
sed -i 's|deal-action\.js?v=[0-9]\+|deal-action.js?v=142|g; \
        s|settings\.js?v=[0-9]\+|settings.js?v=142|g; \
        s|datenraum\.js?v=[0-9]\+|datenraum.js?v=142|g; \
        s|datenraum\.css?v=[0-9]\+|datenraum.css?v=142|g; \
        s|portfolio-strategy\.js?v=[0-9]\+|portfolio-strategy.js?v=142|g; \
        s|portfolio-strategy-ui\.js?v=[0-9]\+|portfolio-strategy-ui.js?v=142|g; \
        s|portfolio-strategy-pdf\.js?v=[0-9]\+|portfolio-strategy-pdf.js?v=142|g; \
        s|portfolio-strategy\.css?v=[0-9]\+|portfolio-strategy.css?v=142|g; \
        s|bank-negotiation-pdf\.js?v=[0-9]\+|bank-negotiation-pdf.js?v=142|g; \
        s|config\.js?v=[0-9]\+|config.js?v=142|g; \
        s|rnd-calc\.js?v=[0-9]\+|rnd-calc.js?v=142|g; \
        s|rnd-ui\.js?v=[0-9]\+|rnd-ui.js?v=142|g; \
        s|rnd-pdf\.js?v=[0-9]\+|rnd-pdf.js?v=142|g; \
        s|rnd-gnd-table\.js?v=[0-9]\+|rnd-gnd-table.js?v=142|g; \
        s|rnd-bte-katalog\.js?v=[0-9]\+|rnd-bte-katalog.js?v=142|g; \
        s|rnd-styles\.css?v=[0-9]\+|rnd-styles.css?v=142|g' \
  frontend/index.html

# Neu hinzufügen: rnd-wizard.js + rnd-docx.js Script-Tags
# Prüfen ob sie schon da sind:
grep -c "rnd-wizard\.js" frontend/index.html
grep -c "rnd-docx\.js" frontend/index.html
# Wenn beide 0 zurückgeben, dann einfügen:
sed -i 's|<script src="js/rnd-ui\.js?v=142"></script>|<script src="js/rnd-docx.js?v=142"></script>\n<script src="js/rnd-ui.js?v=142"></script>\n<script src="js/rnd-wizard.js?v=142"></script>|' frontend/index.html

# Docker rebuild
docker compose -f docker-compose.prod.yml up -d --build
sleep 30
docker ps | grep dealpilot
```

---

## Verifikation im Browser (Hard-Refresh mit Strg+Shift+R)

### 1. Datenraum funktioniert jetzt mit Backend-Objekten
- Settings → Datenraum-Tab
- Sektion "Objekt-Datenräume" zeigt erst "Lade Objekte aus dem Backend …"
- Nach 1-2 Sekunden: Drop-down mit allen Objekten aus dem Backend (z.B. Dealstreet 999 Dealhausen)

### 2. Portfolio-Strategie als Card
- Tab "Deal-Aktion" öffnen
- 5. Card "Portfolio-Strategie­analyse" sichtbar
- Klick → Strategie-Modul öffnet sich (17 Strategien)

### 3. Rechtliches-Tab
- Settings öffnen → neuer Tab "Rechtliches" zwischen "Info" und "Hilfe"
- Klick zeigt Impressum + Datenschutz dauerhaft ausgeklappt
- Im Info-Tab nur noch Schnellzugriff-Button "📋 Impressum & Datenschutz"

### 4. RND-Wizard
- Beliebiges Objekt laden mit Baujahr ≥ 1980 und Kaufpreis
- Deal-Aktion-Tab → Banner "RND-Gutachten lohnt sich" (oder direkt Card 3 "Gutachten & Expertise" → RND wählen)
- Klick "Gutachten direkt anfragen" → **9-Schritt-Wizard öffnet sich**
- Felder vorausgefüllt aus Objekt-Daten (Adresse, Baujahr, Wohnfläche, ggf. Gewerke)
- Wizard durchklicken → Ergebnis-Modal mit "Lohnt sich"-Ampel + AfA-Zahlen
- 3 Buttons unten: PDF / DOCX / Vollständiges Gutachten anfragen

---

## Bekannte Einschränkungen

- **DOCX-Export** braucht JSZip (CDN-geladen). Bei Air-Gap später vendoren.
- **Wizard-Prefill** mappt aktuell Feld-IDs `input-baujahr`, `input-wfl`, `input-kp`, `input-geb-ant`, `input-str`, `input-hnr`, `input-plz`, `input-ort`, `input-grenz`, `input-afa-satz`, `input-objekt-typ`, `input-ds2-energie`, `input-ds2-zustand`. Falls eines anders heißt: bleibt im Wizard leer und muss vom User eingegeben werden.
- **"Lohnt sich"-Bewertung** nutzt die `ampel`-Property aus `calcAfaVergleich`. Bei sehr alten Objekten ohne KP kann das Modal nur die RND zeigen, keinen AfA-Vergleich.

---

## Rollback (falls etwas schiefläuft)

```bash
cd /opt/dealpilot-v25/dealpilot-v124
rm -rf frontend
mv frontend.bak-pre-v142 frontend
docker compose -f docker-compose.prod.yml up -d --build
```
