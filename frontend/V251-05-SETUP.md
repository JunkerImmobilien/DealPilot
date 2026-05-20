# V251-05 — ENV-Setup für Export-Encryption

## Server-Key generiert
```
DEALPILOT_EXPORT_KEY=b53cc2f0b2e4dbc567e72b1d63892cb89faec93241ac9fee28031f8cda4bd773
```

## In .env eintragen
```bash
ssh root@116.203.214.11
cd /opt/dealpilot
echo "" >> .env
echo "# V251-05: AES-256 Key fuer JSON-Export-Verschluesselung" >> .env
echo "DEALPILOT_EXPORT_KEY=b53cc2f0b2e4dbc567e72b1d63892cb89faec93241ac9fee28031f8cda4bd773" >> .env

# Backend neu starten damit ENV greift
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
```

## Production identisch
```bash
ssh root@157.90.117.167
cd /opt/dealpilot
echo "" >> .env
echo "DEALPILOT_EXPORT_KEY=b53cc2f0b2e4dbc567e72b1d63892cb89faec93241ac9fee28031f8cda4bd773" >> .env
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
```

**WICHTIG:** Production und Staging dürfen NICHT den gleichen Key haben
wenn der Export sich nicht zwischen den Umgebungen austauschen soll.

Wenn der Key verloren geht, sind alle verschluesselten Exports verloren.
Bitte sicher aufbewahren (z.B. in Bitwarden/Passwort-Manager).
