# V147 — d1-Tilgungsaussetzung + Portfolio-Strategie in Sidebar

## Was ist neu in V147?

### 1. Tilgungsaussetzungs-Dropdown auch für Darlehen I (Hauptdarlehen)

Bisher konntest du nur bei Darlehen II das Tilgungsmodell auswählen. Jetzt gibt es das Dropdown auch bei Darlehen I — direkt oben in der Card "Darlehen I – Hauptdarlehen":

```
Art des Darlehens:  [Annuitätendarlehen ▼]
                    ├ Annuitätendarlehen
                    ├ Tilgungsaussetzungsdarlehen  ← jetzt verfügbar
                    └ KfW-Darlehen
```

Bei Auswahl "Tilgungsaussetzungsdarlehen":
- Tilgung wird automatisch auf 0 gesetzt
- Monatliche Rate = nur Zinsen
- Restschuld bleibt konstant über die gesamte Laufzeit
- Volltilgung-Anzeige zeigt "Tilgungsaussetzung"
- Bankexport-Tabelle erkennt das Darlehen als "Tilgungsaussetzungs-Darlehen 1"

### 2. Portfolio-Strategie als Sidebar-Menüpunkt

In der Sidebar-Aktion-Akkordeon ist jetzt direkt nach "Bankexport" der Eintrag "Portfolio-Strategie" zu sehen. Klick öffnet das volle Strategie-Modul. Funktioniert auch im Mobile Bottom-Sheet.

Die Card "Portfolio-Strategie­analyse" im Deal-Aktion-Tab (V142) bleibt zusätzlich erhalten — du hast jetzt zwei Wege:
- **Sidebar:** Schnellzugriff von überall, portfolio-weite Sicht
- **Deal-Aktion-Card:** Im Kontext eines Objekts

### Bauspar-Card erweitert (aus V146)

Die V146-Bauspar-Erkennung greift jetzt auch bei d1-Tilgungsaussetzung: Wenn `d1_type = tilgungsaussetzung` und `bspar_sum > 0`, zeigt die Strategie:
- Status-Ampel (grün/gelb/rot)
- Anschlussfinanzierungs-Warnung wenn Bausparsumme < 95 % von d1
- Voraussichtliche Jahre bis Zuteilung

---

## Geänderte Files

```
frontend/index.html                — d1_type Dropdown + Sidebar/Bottom-Sheet Strategy-Button
frontend/js/calc.js                — d1-Type-Logik (Tilgungsaussetzung)
frontend/js/storage.js             — d1_type im Field-Persist + Bankexport
frontend/js/ui.js                  — Strategy-Button-Handler in sb + bsheet
frontend/js/portfolio-strategy.js  — Version V147
frontend/js/config.js              — Label V147
frontend/js/portfolio-strategy-ui.js — Bauspar-Card (aus V146)
```

---

## Hetzner-Deployment

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124

cp -r frontend frontend.bak-pre-v147
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dealpilot dealpilot_db > /root/db-backup-pre-v147.sql

# ZIP hochladen lokal: scp dealpilot-v147.zip root@hetzner-host:/root/

# Wichtig: index.html wird DIESMAL aus dem ZIP übernommen (HTML-Strukturänderungen!)
# Andere V14x-Patches an index.html sind drin
unzip -q -o /root/dealpilot-v147.zip

# Versions-Bumps (mehrere Files)
sed -i 's|portfolio-strategy\.js?v=[0-9]\+|portfolio-strategy.js?v=147|g' frontend/index.html
sed -i 's|portfolio-strategy-ui\.js?v=[0-9]\+|portfolio-strategy-ui.js?v=147|g' frontend/index.html
sed -i 's|config\.js?v=[0-9]\+|config.js?v=147|g' frontend/index.html
sed -i 's|calc\.js?v=[0-9]\+|calc.js?v=147|g' frontend/index.html
sed -i 's|storage\.js?v=[0-9]\+|storage.js?v=147|g' frontend/index.html
sed -i 's|ui\.js?v=[0-9]\+|ui.js?v=147|g' frontend/index.html

docker compose -f docker-compose.prod.yml up -d --build
```

⚠ **Achtung:** Diesmal wird die `index.html` aus dem ZIP genommen (anders als bei den letzten V145/V146). Das ist notwendig weil ich strukturelle HTML-Änderungen gemacht habe (Sidebar-Button, neues Dropdown). Wenn du seit V141 weitere index.html-Patches drauf hast die nicht aus meinen ZIPs kamen, sind die jetzt weg. Falls unsicher: vorher `frontend/index.html` vergleichen mit deiner Live-Version.

## Verifikation

1. **Tab Finanzierung** öffnen → Card "Darlehen I" → neues Dropdown "Art des Darlehens"
2. "Tilgungsaussetzungsdarlehen" auswählen → Tilgung wird 0, Rate = nur Zinsen
3. **Sidebar** → "Aktionen" aufklappen → neuer Button "Portfolio-Strategie"
4. Klick öffnet das Strategie-Modul

## Rollback

```bash
cd /opt/dealpilot-v25/dealpilot-v124
rm -rf frontend
mv frontend.bak-pre-v147 frontend
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Was bleibt noch offen (auf V148+)

- **Portfolio-Strategie als Wizard** mit gefilterten Strategien (eigene Session, größer Umbau)
- **Strategie-Gewichtung + "nächste Stufe"-Anzeige**
- **Tilgungsplan-UI für Darlehen 2** (Zinsplan-Tabelle wie bei Darlehen 1)
- **Excel-Import-Erweiterung** für Tilgungsaussetzung+Bausparer aus ImmoKalk.xlsm
- **KI-Prompt-Fix** (Backend) damit LTV mit Verkehrswert statt Kaufpreis berechnet wird
- **Server-Cleanup** ausführen (Skript ist fertig, einfach auf Hetzner laufen lassen)
