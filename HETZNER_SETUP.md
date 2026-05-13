# DealPilot auf Hetzner deployen — Schritt für Schritt

Diese Anleitung führt dich von "ich habe nichts" bis "DealPilot läuft unter https://meinedomain.de".
Geschätzte Zeit: **30–45 Minuten**.

Du brauchst:
- Eine Hetzner-Cloud-Account (https://console.hetzner.cloud)
- Eine eigene Domain (z.B. bei All-Inkl, INWX, Cloudflare, IONOS — egal wo)
- Einen SSH-Client. Auf Windows: PowerShell (eingebaut) oder PuTTY.
- Das `dealpilot-v22.zip`

---

## 1. Hetzner-VM bestellen

1. **Login** auf [console.hetzner.cloud](https://console.hetzner.cloud)
2. Klick auf **„Server"** → **„Server hinzufügen"**
3. **Standort:** Nürnberg oder Falkenstein (deutsche DSGVO-Konformität, schnell zu OWL)
4. **Image:** Ubuntu 24.04
5. **Typ:** Wähle einen ARM- oder x86-Server. Empfehlung:
   - **CAX11** (ARM, 2 vCPU, 4 GB RAM) — **3,79 € / Monat**, völlig ausreichend für DealPilot mit ~10 Usern
   - Wenn du später wachsen willst: **CAX21** (ARM, 4 vCPU, 8 GB RAM) — 6,49 €/Mo
6. **Netzwerk:** IPv4 + IPv6 lassen
7. **SSH-Key:** Wenn du noch keinen hast — siehe Anhang A unten. Sonst auswählen.
8. **Firewall:** keine separate (machen wir per UFW auf dem Server)
9. **Backups:** **Aktivieren** (+20% Aufschlag — wert es). Das gibt dir tägliche Snapshots.
10. **Name:** `dealpilot-prod`
11. **„Erstellen & kaufen"**

Nach ~30 Sekunden bekommst du eine **IPv4-Adresse**, sowas wie `49.12.123.45`. Die brauchen wir gleich.

---

## 2. Domain auf den Server zeigen lassen

Geh zum DNS-Verwaltung deiner Domain (bei deinem Registrar) und lege einen **A-Record** an:

| Typ | Name        | Wert (IP des Servers) | TTL  |
|-----|-------------|-----------------------|------|
| A   | `dealpilot` | `49.12.123.45`        | 300  |

Wenn du eine eigene Domain wie `dealpilot.junker-immobilien.io` willst, tipp `dealpilot` ein.
Wenn du die Hauptdomain willst (`junker-immobilien.io`), tipp `@` oder lass das Feld leer.

**Optional aber empfohlen:** Auch ein AAAA-Record für IPv6 mit der IPv6-Adresse aus Hetzner.

DNS braucht je nach Registrar 5 Minuten bis 24 Stunden. Bei Cloudflare: sofort. Bei IONOS: ~30 Min.

**Test:** Auf Windows in PowerShell `nslookup dealpilot.deinedomain.de` — wenn du die Hetzner-IP siehst, ist DNS bereit.

---

## 3. ZIP auf den Server hochladen

In **PowerShell** auf deinem Windows-PC:

```powershell
# In das Verzeichnis wechseln, in dem das ZIP liegt
cd C:\Users\$env:USERNAME\Downloads

# Hochladen via SCP (eingebaut in Windows 10/11)
scp dealpilot-v22.zip root@49.12.123.45:/root/

# Per SSH einloggen
ssh root@49.12.123.45
```

**Tipp:** Wenn `scp` und `ssh` nicht funktionieren — Windows Settings → Apps → Optionale Features → "OpenSSH Client" installieren.

---

## 4. Auf dem Server: ZIP entpacken + Deploy starten

Sobald du per SSH eingeloggt bist (du bist jetzt auf dem Hetzner-Server):

```bash
# Tools installieren falls nötig
apt-get update && apt-get install -y unzip

# Ins Arbeitsverzeichnis
cd /opt
unzip /root/dealpilot-v22.zip
cd dealpilot-v22

# Deploy starten — installiert Docker, Firewall, fragt nach .env
bash deploy.sh
```

Das Skript macht jetzt automatisch:
- Docker installieren
- Firewall (UFW): SSH, HTTP, HTTPS frei, alles andere zu
- `.env` aus dem Template anlegen (du musst gleich Werte eintragen)
- Validieren, dass DNS auf den Server zeigt
- Container bauen + starten
- Health-Check

Wenn das Skript dich auffordert, die `.env` auszufüllen:

```bash
nano .env
```

Ändere mindestens diese Werte:

```bash
DOMAIN=dealpilot.deinedomain.de       # ← deine echte Domain
ACME_EMAIL=du@deinedomain.de          # ← für Let's Encrypt-Warnungen
DB_PASSWORD=...                        # ← generieren: openssl rand -base64 24
JWT_SECRET=...                         # ← generieren: openssl rand -hex 64
ADMIN_EMAIL=marcel@deinedomain.de
ADMIN_PASSWORD=DeinSicheresPasswort
ADMIN_NAME=Marcel Junker
SEED_DEMO_DATA=1                       # ← für Demo-User + 3 Beispielobjekte
OPENAI_API_KEY=sk-...                  # ← OPTIONAL für KI-Web-Recherche
```

**Secrets generieren** (in einem zweiten SSH-Tab oder einfach nacheinander):

```bash
echo "DB_PASSWORD=$(openssl rand -base64 24)"
echo "JWT_SECRET=$(openssl rand -hex 64)"
```

Werte kopieren und in `nano` einfügen, dann `Ctrl+O`, Enter, `Ctrl+X`.

Zurück im Deploy-Skript: **Enter drücken**, das Skript läuft weiter.

Beim ersten Aufruf von `https://dealpilot.deinedomain.de` zieht Caddy automatisch ein Let's-Encrypt-Zertifikat — das dauert 10-60 Sekunden. Danach bist du live.

---

## 5. Verifizieren

```bash
# Container-Status
docker compose -f docker-compose.prod.yml ps

# Sollte zeigen: postgres (healthy), backend (running), caddy (running)

# Backend-Health
curl http://localhost:3001/health
# {"status":"ok","uptime":42}

# HTTPS testen
curl -I https://dealpilot.deinedomain.de
# HTTP/2 200 ...
```

Im Browser:
- `https://dealpilot.deinedomain.de` → DealPilot lädt
- Login mit `demo@dealpilot.local` / `demo12345` → 3 Demo-Objekte mit Bildern sichtbar
- Login mit deinem `ADMIN_EMAIL` / `ADMIN_PASSWORD` → leerer Account, du bist Admin

---

## 6. Tägliche Backups einrichten

```bash
cd /opt/dealpilot-v22
chmod +x backup.sh

# Cron-Eintrag für tägliches Backup um 03:00
crontab -e
# Folgende Zeile hinzufügen:
0 3 * * * cd /opt/dealpilot-v22 && ./backup.sh >> /var/log/dealpilot-backup.log 2>&1
```

Backups landen in `/opt/dealpilot-v22/backups/dealpilot_YYYY-MM-DD_HHMMSS.sql.gz`.
Backups älter als 30 Tage werden automatisch gelöscht.

**Empfehlung:** Backups regelmäßig auf einen anderen Ort kopieren (z.B. mit `rclone` zu Hetzner Storage Box oder S3). Die VM kann jederzeit kaputtgehen.

---

## 7. Updates einspielen (für später, V23+)

Wenn ich dir ein neues ZIP gebe:

```powershell
# Auf Windows
scp dealpilot-v23.zip root@49.12.123.45:/root/
ssh root@49.12.123.45
```

```bash
# Auf dem Server
cd /opt/dealpilot-v22
./backup.sh                                    # SICHERHEIT ZUERST
docker compose -f docker-compose.prod.yml down

cd /opt
mv dealpilot-v22 dealpilot-v22-old             # alte Version umbenennen statt löschen
unzip /root/dealpilot-v23.zip
cd dealpilot-v23
cp ../dealpilot-v22-old/.env .                 # .env von alter Version übernehmen
cp -r ../dealpilot-v22-old/backups .           # Backups übernehmen

docker compose -f docker-compose.prod.yml up -d --build
```

Migrations laufen automatisch beim Backend-Start.

---

## 8. Häufige Befehle

```bash
# Logs live anschauen
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f caddy

# Container neu starten
docker compose -f docker-compose.prod.yml restart backend

# Komplett stoppen + starten
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# In den Postgres-Container
docker exec -it dealpilot-postgres psql -U dealpilot dealpilot_db

# In den Backend-Container
docker exec -it dealpilot-backend sh

# Backup einspielen (DB komplett überschreiben — Vorsicht!)
gunzip < backups/dealpilot_2026-04-28_030000.sql.gz | docker exec -i dealpilot-postgres psql -U dealpilot dealpilot_db
```

---

## 9. KI-Web-Recherche aktivieren (optional)

Wenn du Lage-Recherche mit OpenAI aktivieren willst:

1. OpenAI-Account: https://platform.openai.com/api-keys
2. API-Key generieren (Format: `sk-...`)
3. Auf `pay-as-you-go` umstellen — gpt-4o-mini kostet ~0,01-0,03 € pro Analyse mit Web-Search
4. In `.env` eintragen:
   ```
   OPENAI_API_KEY=sk-DeinKeyHier
   OPENAI_DEFAULT_MODEL=gpt-4o-mini
   ```
5. Restart: `docker compose -f docker-compose.prod.yml restart backend`
6. Testen in der App: Tab „KI-Analyse" → es sollte jetzt server-seitig laufen und Quellen-URLs zurückgeben

Wenn du **kein** `OPENAI_API_KEY` setzt, läuft die KI-Analyse weiter im Client-Modus (User trägt eigenen Key in den Einstellungen ein).

---

## 10. Troubleshooting

### „Cert konnte nicht ausgestellt werden"

Ursache fast immer: DNS zeigt nicht (oder noch nicht) auf den Server.

```bash
# Zeigt deine Domain auf die Server-IP?
dig +short dealpilot.deinedomain.de
# Sollte deine Hetzner-IP zurückgeben
```

Wenn die IP falsch ist: A-Record beim Registrar prüfen, 5-30 Minuten warten, dann `docker compose -f docker-compose.prod.yml restart caddy`.

### „permission denied" beim Deploy

Du bist nicht als root eingeloggt. Entweder `sudo bash deploy.sh` oder `sudo -i` und dann `bash deploy.sh`.

### Backend startet nicht

```bash
docker compose -f docker-compose.prod.yml logs backend | tail -50
```

Häufigste Ursachen:
- `.env` fehlt oder hat einen Tippfehler bei `JWT_SECRET`/`DB_PASSWORD`
- Postgres ist noch nicht ready (warte 10s und probier nochmal)

### „Out of memory"

Die kleine CAX11 hat 4 GB RAM, das reicht für ~10-20 gleichzeitige User. Bei mehr → CAX21 (8 GB).
Upgrade per Hetzner-Console: Server stoppen → Skalieren → CAX21 → starten.

### App läuft, aber keine HTTPS

Caddy braucht 1-2 Minuten nach dem ersten Request. Lass die Domain einmal aufrufen, warte 1 Min, refresh.

```bash
docker compose -f docker-compose.prod.yml logs caddy | grep -i certificate
```

Sollte irgendwo `certificate obtained successfully` stehen.

---

## Anhang A: SSH-Key generieren (falls du noch keinen hast)

In **PowerShell auf Windows**:

```powershell
ssh-keygen -t ed25519 -C "marcel@junker"
# Pfad bestätigen mit Enter (Default-Pfad)
# Passphrase setzen (empfohlen, leer lassen wenn lokal sicher)

# Public-Key anzeigen — den brauchst du für Hetzner
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

Den ausgegebenen Text (`ssh-ed25519 AAAA... marcel@junker`) kopierst du in der Hetzner-Console unter **„SSH-Keys" → „Hinzufügen"**.

---

## Anhang B: Was kostet das jetzt?

| Posten             | Pro Monat      |
|--------------------|----------------|
| Hetzner CAX11      | 3,79 €         |
| Backups (+20%)     | 0,76 €         |
| Domain (Beispiel)  | ~1,00 €        |
| Let's Encrypt SSL  | 0,00 €         |
| OpenAI (optional)  | ~5–20 €        |
| **Gesamt**         | **~5,55 €** + ggf. OpenAI |

Wenn du Stripe und Bezahlen-Infrastruktur dazunimmst, kommen ca. 1,4% + 0,25 € pro Transaktion dazu — aber das ist eine separate V23-Aufgabe.

---

## Anhang C: Wann brauche ich Hilfe?

- Domain-Registrar weigert sich, A-Record zu setzen → frag deinen Registrar
- Hetzner-Account-Fragen → Hetzner-Support (sehr gut, deutschsprachig)
- DealPilot-Bugs → mir melden, mit Logs aus `docker compose logs`
