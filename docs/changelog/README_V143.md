# V143 — Bugfixes + Portfolio-Strategy Verbesserungen

## Was ist neu in V143?

### Behobene Bugs aus V142

**1. Datenraum: Objekt-Ordner wird in Deal-Aktion korrekt angezeigt**
- Problem: Trotz eingerichtetem Objekt-Datenraum zeigte Deal-Aktion nur den persönlichen Ordner
- Ursache: Auflösung der aktuellen Objekt-ID schaute nur in `localStorage`, nicht in `window._currentObjData`
- Fix: Zentrale Helper-Funktion `_resolveCurrentObjId()` prüft 4 Quellen (localStorage, _currentObjData, currentObjectId, DOM-Kürzel-Feld)

**2. "Datenraum-Einstellungen"-Button (⚙) funktioniert**
- Problem: Klick führte zu nichts
- Ursache: Inline-Onclick mit `&quot;`-Encoding wurde vom Browser nicht korrekt geparst
- Fix: Eigene Funktion `openDatenraumSettings()` mit mehrfachen Fallbacks (window.openSettings / openSettings / _swSet / direkter Klick)

**3. "Ordner-Link einfügen"-Button war unleserlich (schwarz auf schwarz)**
- Problem: Schrift nicht sichtbar
- Fix: Button auf Gold-Hintergrund mit weißer Schrift umgestellt, mit `!important` gegen CSS-Overrides geschützt

**4. Rechtliches-Tab Icon fehlte**
- Problem: `i-fileText`-Icon existiert nicht im SVG-Set
- Fix: Auf vorhandenes `i-book`-Icon gewechselt (passt thematisch zu "Rechtliches")

### Portfolio-Strategie: Beleihungswertreserve-Bug behoben

**5. Verkehrswert wurde nicht erkannt**
- Problem bei BO_HÖ1: User hatte VW 600.000 € gesetzt, Darlehen 132.000 € — Beleihungswertreserve wurde aber als 0 angezeigt
- Ursache: Strategie-Modul suchte nur Feld-Namen `verkehrswert` oder `marktwert`, aber Daten lagen unter `vw_immowertv` o.ä.
- Fix: 11 Feld-Namen werden jetzt der Reihe nach geprüft:
  - `verkehrswert`, `marktwert` (Standard)
  - `vw_immowertv`, `immowertv_wert` (ImmoWertV-Berechnung)
  - `vw_sv`, `sv_verkehrswert` (Sachverständigen-Gutachten)
  - `immo_bewertung_bank`, `bank_bewertung` (Bank-Bewertung aus Excel)
  - `vw_immoscout`, `vw_pricehubble`, `vw_ph` (Marktdaten)
  - Fallback: Kaufpreis × 1.02^Haltedauer

### Portfolio-Strategie: Realistischere RND-Werte

**6. RND-AfA war bei alten Objekten unrealistisch hoch**
- Problem: Wenn Sanstand fehlte und alter ≥40 J, wurden ALLE 9 Gewerke auf "veraltet" gesetzt → RND von 7-8 J → AfA-Satz 13%+
- Realität: Selbst unsanierte Altbauten haben meist OK Decken/Grundriss/Substanz
- Fix: Sanstand 4-5 nutzt jetzt realistische Mix-Bewertungen
  - **4 (bedürftig):** Dach/Aussenwand/Decken/Grundriss = standard · Rest = veraltet
  - **5 (unsaniert):** Decken/Grundriss = standard · Rest = veraltet

Ergebnis: AfA-Sätze landen jetzt im realistischen Bereich 3-6% statt 10-15%.

### Portfolio-Strategie: Darlehen-Typen erweitert

**7. Tilgungsaussetzungsdarlehen + Bausparer werden mitberechnet**
- Bisher: Nur `d1` + `d2` als Darlehen-Total
- Jetzt: `d1` + `d2` + `d3` (Tilgungsaussetzung/Bausparer)
- Feld-Aliase: `d3`, `tilgungsaussetzung`, `bausparer_summe`, `ta_darlehen`
- Plus Aliase für d1/d2: `darlehen_1/2`, `darlehen1/2_summe`, `hauptdarlehen`, `zusatzdarlehen`

### Portfolio-Strategie: Disclaimer-Banner oben

**8. Prominenter Hinweis "keine Steuer-/Finanzberatung"**
- Bisher: Disclaimer war ganz unten im Modul, leicht übersehbar
- Jetzt: Gold-umrandeter Banner direkt unter der Toolbar mit klarem Hinweis auf §6 StBerG / §3 RDG / §34c GewO
- Verweist explizit auf Steuerberater + Notar/Anwalt für konkrete Umsetzung

---

## Was NICHT in V143 ist (vertagt auf V144+)

- **Portfolio-Strategie als Wizard** — größer Umbau, eigene Session
- **Strategie-Gewichtung** + "was muss ich tun für nächste Stufe" — eigene Session
- **Tilgungsplan-UI für Darlehen 2** im Finanzierungs-Tab — UI-Erweiterung
- **Tilgungsaussetzungsdarlehen/Bausparer Import-UI** aus Excel
- **Portfolio-Strategie im Bankexport-Submenü** — Sidebar-Eingriff zu riskant in dieser Session

---

## Hetzner-Deployment

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124  # Live-Ordner

# Backup
cp -r frontend frontend.bak-pre-v143
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dealpilot dealpilot_db > /root/db-backup-pre-v143.sql

# ZIP hochladen (vom lokalen Rechner)
# auf Windows:  scp dealpilot-v143.zip root@hetzner-host:/root/

# Live-index.html sichern, ZIP entpacken, Live-Variante wiederherstellen
cp frontend/index.html /tmp/index-v142-LIVE.html
unzip -q -o /root/dealpilot-v143.zip
cp /tmp/index-v142-LIVE.html frontend/index.html

# Versions-Bumps für V143 (einzeln, sicher)
sed -i 's|deal-action\.js?v=[0-9]\+|deal-action.js?v=143|g' frontend/index.html
sed -i 's|settings\.js?v=[0-9]\+|settings.js?v=143|g' frontend/index.html
sed -i 's|datenraum\.js?v=[0-9]\+|datenraum.js?v=143|g' frontend/index.html
sed -i 's|datenraum\.css?v=[0-9]\+|datenraum.css?v=143|g' frontend/index.html
sed -i 's|portfolio-strategy\.js?v=[0-9]\+|portfolio-strategy.js?v=143|g' frontend/index.html
sed -i 's|portfolio-strategy-ui\.js?v=[0-9]\+|portfolio-strategy-ui.js?v=143|g' frontend/index.html
sed -i 's|portfolio-strategy-pdf\.js?v=[0-9]\+|portfolio-strategy-pdf.js?v=143|g' frontend/index.html
sed -i 's|portfolio-strategy\.css?v=[0-9]\+|portfolio-strategy.css?v=143|g' frontend/index.html
sed -i 's|bank-negotiation-pdf\.js?v=[0-9]\+|bank-negotiation-pdf.js?v=143|g' frontend/index.html
sed -i 's|config\.js?v=[0-9]\+|config.js?v=143|g' frontend/index.html

# Docker rebuild
docker compose -f docker-compose.prod.yml up -d --build
sleep 30
docker ps | grep dealpilot
```

## Verifikation im Browser (Hard-Refresh)

1. **Datenraum-Bug:** Bei einem Objekt mit verknüpftem Datenraum → Deal-Aktion-Tab → Chip "Objekt-Ordner" muss erscheinen + Klick öffnet den Cloud-Ordner

2. **Datenraum-Einstellungen-Button:** ⚙-Icon rechts in der Quick-Access-Bar → öffnet Settings → Datenraum-Tab

3. **Ordnerlink-Button:** Settings → Datenraum → "Ordner-Link einfügen" klicken → Modal mit goldener Schrift auf weißem Hintergrund (vorher schwarz auf schwarz)

4. **Rechtliches-Icon:** Settings → "Rechtliches"-Tab hat jetzt das Buch-Icon (gold wie andere)

5. **BO_HÖ1 Beleihungswertreserve:** Portfolio-Strategie öffnen → BO_HÖ1 muss jetzt eine positive Beleihungs-Reserve zeigen (basierend auf 600k VW × 0,9 × 0,8 − 132k = 432k − 132k = **300k Reserve**)

6. **RND-AfA realistisch:** Bei alten Bestandsobjekten ohne Sanstand sind die RND-AfA-Sätze jetzt 3-6% (vorher oft 10-15%)

7. **Disclaimer:** Portfolio-Strategie öffnen → gold-umrandeter Banner ganz oben mit "keine Steuer-/Finanzberatung"

## Rollback

```bash
cd /opt/dealpilot-v25/dealpilot-v124
rm -rf frontend
mv frontend.bak-pre-v143 frontend
docker compose -f docker-compose.prod.yml up -d --build
```
