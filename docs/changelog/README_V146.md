# V146 — Bauspar-Erkennung + Tilgungsaussetzung-Strategie

## Was ist neu in V146?

### Bausparvertrag wird im Strategie-Modul erkannt und bewertet

**Vorher:** Bausparvertrag-Daten (`bspar_sum`, `bspar_rate`, `bspar_inst` etc.) wurden gespeichert, aber das Strategie-Modul ignorierte sie komplett. Bei einem Tilgungsaussetzungs-Darlehen mit Bausparvertrag erschien keine Warnung oder Empfehlung.

**Jetzt:** Neue Card "**Bausparverträge & Tilgungsaussetzungs-Darlehen**" zeigt für jedes betroffene Objekt:
- Hauptdarlehen-Summe vs. Bausparsumme
- Sparrate pro Monat
- Bausparkasse + voraussichtliche Jahre bis zur Zuteilung
- Status-Ampel:
  - **🟢 Bauspar deckt Anschlussfin. ✓** — Bausparsumme ≥ 95 % des Hauptdarlehens
  - **🟡 Tilgung läuft + Bauspar parallel** — d1 wird normal getilgt, Bauspar als Bonus
  - **🔴 Lücke bei Anschlussfin. ⚠** — Tilgungsaussetzung aber Bausparsumme deckt nicht

### Anschlussfinanzierungs-Warnung

Wenn Bausparsumme < 95 % der Hauptdarlehens-Summe und Tilgung d1 = 0 (Tilgungsaussetzung), erscheint eine rote Warnbox mit:
- Konkrete Deckungsquote in %
- €-Betrag der Lücke
- Hinweis: "Diese muss bei Anschluss­finanzierung als neues Darlehen zu dann gültigen Marktkonditionen aufgenommen werden"

### Erkennung über folgende Felder

Backend-Felder die jetzt ausgewertet werden:
- `bspar_sum` — Bausparsumme
- `bspar_rate` — Sparrate €/Monat
- `bspar_zins` — Sollzins Bauspar-Darlehen %
- `bspar_inst` — Bausparkasse (z.B. "Wüstenrot")
- `bspar_vertrag` — Vertragsnummer
- `bspar_quote_min` — Mindest-Quote für Zuteilung (Default 47 %)
- `d1t` — Tilgung d1; bei < 0,5 % gilt als Tilgungsaussetzung

### Berechnung der Zuteilungs-Jahre

```
Ziel-Ansparen = Bausparsumme × Mindest-Quote%
Jahre bis Zuteilung = ceil(Ziel-Ansparen / (Sparrate × 12))
```

Beispiel BO_HÖ1:
- Bausparsumme: 132.050 €
- Mindest-Quote: 47 %
- Ziel-Ansparen: 62.064 €
- Sparrate: 150 €/M → 1.800 €/J
- **Jahre bis Zuteilung: ~35 Jahre**

(Hinweis: Bei BO_HÖ1 ist `d1t = 0` aktuell wegen fehlendem Wert im Daten­modell — sobald du den korrekten Wert setzt, greift die Tilgungsaussetzungs-Logik.)

---

## Was noch offen ist

### Dropdown "Tilgungsaussetzungsdarlehen" auswählbar machen

Du hast berichtet dass du die Option im Dropdown bei Darlehen II nicht mehr auswählen kannst. Im HTML-Code (`index.html` Zeile 877-879) steht die Option drin. Bevor ich patchen kann, brauche ich von dir die Browser-Console-Output:

```javascript
const sel = document.getElementById('d2_type');
console.log('Anzahl Optionen:', sel?.options.length);
Array.from(sel?.options || []).forEach(o =>
  console.log('  Wert="'+o.value+'" Label="'+o.text+'" disabled='+o.disabled));
console.log('D2-Toggle:', document.getElementById('d2_enable')?.checked);
console.log('D2-Content sichtbar:', document.getElementById('d2_content')?.style.display);
```

→ Output zurück an mich, dann patche ich V146.1.

### KI-Prompt-Fix (LTV mit Verkehrswert statt Kaufpreis)

Du hattest gezeigt dass die KI-Analyse "LTV 95 %" sagt, obwohl es real 22 % sind. Das ist ein **Backend-Bug** in `openaiService.js` — die LTV-Berechnung im Prompt nutzt Kaufpreis statt Verkehrswert.

Backend-Änderungen brauchen eine **DB-Migration + Server-Rebuild**, das ist eigene Session-Arbeit. Verschoben auf V147.

---

## Hetzner-Deployment

```bash
ssh root@hetzner-host
cd /opt/dealpilot-v25/dealpilot-v124

cp -r frontend frontend.bak-pre-v146
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dealpilot dealpilot_db > /root/db-backup-pre-v146.sql

# ZIP hochladen (lokal): scp dealpilot-v146.zip root@hetzner-host:/root/

cp frontend/index.html /tmp/index-v145-LIVE.html
unzip -q -o /root/dealpilot-v146.zip
cp /tmp/index-v145-LIVE.html frontend/index.html

# Versions-Bumps (3 Files)
sed -i 's|portfolio-strategy\.js?v=[0-9]\+|portfolio-strategy.js?v=146|g' frontend/index.html
sed -i 's|portfolio-strategy-ui\.js?v=[0-9]\+|portfolio-strategy-ui.js?v=146|g' frontend/index.html
sed -i 's|config\.js?v=[0-9]\+|config.js?v=146|g' frontend/index.html

docker compose -f docker-compose.prod.yml up -d --build
```

## Verifikation

In der Portfolio-Strategie sollte bei BO_HÖ1 die neue Card "Bausparverträge & Tilgungsaussetzungs-Darlehen" erscheinen mit Wüstenrot, 132.050 €, 150 €/M, ~35 Jahre bis Zuteilung.

## Rollback

```bash
cd /opt/dealpilot-v25/dealpilot-v124
rm -rf frontend
mv frontend.bak-pre-v146 frontend
docker compose -f docker-compose.prod.yml up -d --build
```
