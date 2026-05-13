# V144 — RND-Wizard-Auslöser + transparente Hebel-Berechnung

## Was ist neu in V144?

### 1. RND-Wizard öffnet direkt aus dem Expert-Modal ★

**Bisher (V143):** Klick auf "Restnutzungsdauer-Gutachten" im Modal "Gutachten & Expertise anfragen" zeigte nur ein Textfeld zum Beschreiben. Wizard ging nicht auf.

**Jetzt (V144):** Sobald du im Expert-Modal das Radio "Restnutzungsdauer-Gutachten" auswählst, schließt das Modal sich automatisch und der 9-Schritt-Wizard öffnet sich. Du wirst durch alle Fragen geführt (Objekt-Basis, Bauliche Anlagen, Gebäudetechnik, Sanitär, Modernisierungen, Schäden, Gewerke-Bewertung). Am Ende erhältst du:

- RND-Wert in Jahren
- AfA-Vergleich Standard vs. Kurz mit konkreten €-Beträgen
- **Lohnt-Sich-Bewertung** (grün/gelb/rot-Ampel)
- Drei Aktions-Buttons: PDF / DOCX / **Vollständiges Gutachten anfragen**

### 2. "Gutachten anfragen" schickt komplette Wizard-Daten

Klick auf "Vollständiges Gutachten anfragen" im Ergebnis-Modal:
- Schließt das Modal
- Öffnet die Expert-Anfrage-Maske mit RND vorausgewählt
- **Füllt das Nachrichten-Textfeld automatisch mit allen Wizard-Eingaben**
  - Objekt-Basis (Adresse, Baujahr, Wohnfläche)
  - Wizard-Ergebnis (RND, GND, Alter)
  - AfA-Vergleich (Standard %, Kurz %, Mehr Steuer/Jahr, Netto-Vorteil)
  - Bewertungs-Empfehlung
- Du kannst die Nachricht ergänzen und absenden — Marcel bekommt **alle relevanten Daten in einer Mail**

### 3. "Hebel über RND-Gutachten" jetzt transparent berechnet ★★

**Problem (V143):** In der Portfolio-Strategie stand bei "RND-Gutachten beauftragen" eine Summe wie "~24.000 €", aber niemand konnte nachvollziehen woher die kam.

**Jetzt (V144):** Direkt unter der Empfehlungs-Step erscheint eine ausklappbare Breakdown-Tabelle:

```
So setzt sich der Hebel zusammen
─────────────────────────────────────────────────────────────────
Objekt    Geb.-Anteil  AfA alt  AfA neu  +Steuer/J  Gutachter  Netto  % Anteil
BO_HÖ1    480.000 €    2,00 %   4,17 %    +4.368 €  −1.000 €   23.040  73 %
LPZ_DD    280.000 €    2,00 %   3,57 %    +1.838 €  −1.000 €    8.625  27 %
─────────────────────────────────────────────────────────────────
Summe                                     +6.206 €  −2.000 €   31.665  100 %

Berechnung: "AfA neu" = 100 / Restnutzungsdauer in Jahren
"Mehr Steuer/J" = (AfA neu − AfA alt) × Gebäude-Anteil × Grenzsteuersatz
"Netto über RND" = Mehr-Steuer × RND-Jahre − Gutachter-Kosten
Beträge nach §7 Abs. 4 Satz 2 EStG, BFH IX R 25/19.
```

Jedes Objekt mit allen Werten + sein **prozentualer Anteil** am Gesamthebel.

### 4. Verkehrswert-Erkennung erweitert

`bankbewertung` (das zweite VW-Feld im Objekt-Tab) als zusätzliche Quelle für die Beleihungswertreserve. Wenn ein User nur "Bankbewertung 600k" eingibt (statt "Verkehrswert"), wird der Hebel jetzt trotzdem korrekt erfasst.

---

## Was NICHT in V144 ist (vertagt auf V145)

- **Portfolio-Strategie als kompletter Wizard** mit gefilterten Strategien — größer Umbau, eigene Session
- **Strategie-Gewichtung** + "was muss ich tun für nächste Stufe"
- **Tilgungsplan-UI für Darlehen 2** im Finanzierungs-Tab
- **Tilgungsaussetzungsdarlehen/Bausparer Import-UI** aus Excel
- **Portfolio-Strategie im Bankexport-Submenü**

---

## Hetzner-Deployment

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124

cp -r frontend frontend.bak-pre-v144
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dealpilot dealpilot_db > /root/db-backup-pre-v144.sql

# ZIP hochladen (vom lokalen Rechner):
# scp dealpilot-v144.zip root@hetzner-host:/root/

cp frontend/index.html /tmp/index-v143-LIVE.html
unzip -q -o /root/dealpilot-v144.zip
cp /tmp/index-v143-LIVE.html frontend/index.html

# Versions-Bumps einzeln
sed -i 's|deal-action\.js?v=[0-9]\+|deal-action.js?v=144|g' frontend/index.html
sed -i 's|settings\.js?v=[0-9]\+|settings.js?v=144|g' frontend/index.html
sed -i 's|datenraum\.js?v=[0-9]\+|datenraum.js?v=144|g' frontend/index.html
sed -i 's|datenraum\.css?v=[0-9]\+|datenraum.css?v=144|g' frontend/index.html
sed -i 's|portfolio-strategy\.js?v=[0-9]\+|portfolio-strategy.js?v=144|g' frontend/index.html
sed -i 's|portfolio-strategy-ui\.js?v=[0-9]\+|portfolio-strategy-ui.js?v=144|g' frontend/index.html
sed -i 's|portfolio-strategy-pdf\.js?v=[0-9]\+|portfolio-strategy-pdf.js?v=144|g' frontend/index.html
sed -i 's|portfolio-strategy\.css?v=[0-9]\+|portfolio-strategy.css?v=144|g' frontend/index.html
sed -i 's|bank-negotiation-pdf\.js?v=[0-9]\+|bank-negotiation-pdf.js?v=144|g' frontend/index.html
sed -i 's|config\.js?v=[0-9]\+|config.js?v=144|g' frontend/index.html

docker compose -f docker-compose.prod.yml up -d --build
```

## Verifikation im Browser (Hard-Refresh Strg+Shift+R)

1. **RND-Wizard:** Deal-Aktion → "Gutachten & Expertise anfragen" → Radio "Restnutzungsdauer-Gutachten" auswählen → Wizard öffnet sich automatisch
2. **Wizard-Daten in Anfrage:** Im Ergebnis-Modal "Vollständiges Gutachten anfragen" → Expert-Maske öffnet sich → Textfeld enthält bereits alle Wizard-Daten (Adresse, RND, AfA-Vergleich)
3. **RND-Hebel transparent:** Portfolio-Strategie öffnen → in "Nächste Schritte" beim RND-Gutachten-Step → Breakdown-Tabelle erscheint mit Anteilen pro Objekt
4. **Bankbewertung als Backup:** Objekt mit nur Bankbewertung (kein Verkehrswert) → Beleihungswertreserve wird jetzt berechnet

## Rollback

```bash
cd /opt/dealpilot-v25/dealpilot-v124
rm -rf frontend
mv frontend.bak-pre-v144 frontend
docker compose -f docker-compose.prod.yml up -d --build
```
