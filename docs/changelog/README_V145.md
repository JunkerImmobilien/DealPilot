# V145 — Beleihungswert-Hotfix (Verkehrswert-Feldname `svwert`)

## Was ist neu in V145?

### Kritischer Bugfix: Beleihungswertreserve wird endlich korrekt berechnet

**Problem:** Bei BO_HÖ1 (Hölderlinstr 1, Bad Oeynhausen) hatte der User Verkehrswert + Bankbewertung auf 600.000 € gesetzt, das Strategie-Modul zeigte aber 139.000 € als Verkehrswert und damit Beleihungs-Reserve = 0.

**Ursache:** Die echten Backend-Feldnamen sind nicht `verkehrswert`/`marktwert`/`bankbewertung` wie ich vermutet hatte, sondern:
- **`svwert`** (Sachverständigen-Wert nach §194 BauGB — rechtes Feld im Objekt-Tab)
- **`bankval`** (Bank-Bewertung — linkes Feld im Objekt-Tab)

V143 und V144 suchten nach den falschen Namen, daher fiel die Berechnung auf den Fallback (Kaufpreis × 1.02^Jahre) zurück, was bei BO_HÖ1 zufällig nahe 139k ergab.

**Fix:** `svwert` und `bankval` sind jetzt die primären Quellen, alle anderen Aliase bleiben als defensive Fallbacks.

**Ergebnis bei BO_HÖ1 nach V145:**
- Verkehrswert: 600.000 € (statt 139.000 €)
- Beleihungswert: 600.000 × 0,9 = 540.000 €
- Bank-Max: 540.000 × 0,8 = 432.000 €
- Darlehen total: 132.050 €
- **Beleihungs-Reserve: 299.950 €** (statt 0 €)

### Folgewirkung: Auch andere Berechnungen werden jetzt korrekt

Die folgenden Stellen lesen alle aus `row.verkehrswert` — sie werden ab V145 alle die echten 600k bekommen statt der 139k:

- LTV-Aktuell-Berechnung (`d_total / verkehrswert`)
- "EK-Aktivierung durch Aufstockung" (zeigte vorher zu wenig potenziell freies EK)
- "Verkauf an eigene GmbH (7%-Methode)" — Verkehrswert ist die Basis für die KP-Untergrenze
- "Lage-Schwäche-Verkauf" — Empfehlungs-Impact (Erlös minus KP)
- "Refi-Strategien" (rollierendes EK, Bank-Verhandlung)
- Bank-PDF (Verkehrs­wert, Beleihungswert, Reserve)
- Strategie-Empfehlungs-Texte mit `Math.round(row.verkehrswert)...€`

### Nicht angefasst (wichtig zu wissen)

- **calc.js, dealscore.js, charts.js** im Live-System (Tab "Kennzahlen") lesen direkt aus dem DOM (`input-svwert`, `input-bankval`) und waren nie betroffen
- **Bausparsumme `bspar_sum`** wird **bewusst nicht** als d3 (Tilgungsaussetzungsdarlehen) gerechnet — bei BO_HÖ1 ist `bspar_sum = 132050` identisch zu `d1`, das wäre eine Doppelzählung. Bis das Datenmodell sauber definiert ist, bleibt d3 bei `d3`/`tilgungsaussetzung`/`ta_darlehen`.

---

## Hetzner-Deployment

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124

cp -r frontend frontend.bak-pre-v145
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dealpilot dealpilot_db > /root/db-backup-pre-v145.sql

# ZIP hochladen vom lokalen Rechner:
# scp dealpilot-v145.zip root@hetzner-host:/root/

cp frontend/index.html /tmp/index-v144-LIVE.html
unzip -q -o /root/dealpilot-v145.zip
cp /tmp/index-v144-LIVE.html frontend/index.html

# Versions-Bumps (nur 2 Files betroffen)
sed -i 's|portfolio-strategy\.js?v=[0-9]\+|portfolio-strategy.js?v=145|g' frontend/index.html
sed -i 's|config\.js?v=[0-9]\+|config.js?v=145|g' frontend/index.html

docker compose -f docker-compose.prod.yml up -d --build
```

## Verifikation im Browser (Hard-Refresh Strg+Shift+R)

Bei BO_HÖ1 im Console:

```javascript
PortfolioStrategy.loadAndAnalyze().then(res => {
  const bo = res.rows.find(r => r.kuerzel.includes('HÖ'));
  console.log('Verkehrswert:', bo.verkehrswert);          // sollte 600000 sein
  console.log('Beleihungs-Reserve:', bo.beleihungs_reserve); // sollte ~300000 sein
  console.log('LTV-Aktuell:', (bo.ltv_aktuell*100).toFixed(1)+'%'); // sollte ~22% sein
});
```

In der Portfolio-Strategie-UI sollte unter "Beleihungsreserve" jetzt 300k bei BO_HÖ1 erscheinen.

## Rollback

```bash
cd /opt/dealpilot-v25/dealpilot-v124
rm -rf frontend
mv frontend.bak-pre-v145 frontend
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Was bleibt offen (auf V146+)

- **Portfolio-Strategie als Wizard** mit gefilterten Strategien
- **Strategie-Gewichtung** + "nächste Stufe"-Anzeige
- **Tilgungsplan-UI für Darlehen 2** im Finanzierungs-Tab
- **Tilgungsaussetzungsdarlehen + Bausparer** als sauberer separater Datentyp (mit Klärung warum `bspar_sum` aktuell = d1 ist)
- **Reset bei Page-Reload** — Klärungsbedarf was genau gemeint ist
- **Excel-Import-Erweiterung** für Tilgungsaussetzungs-Felder
- **Portfolio-Strategie als Sidebar-Bankexport-Submenü**
