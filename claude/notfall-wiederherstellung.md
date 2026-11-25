# Notfall-Wiederherstellung DealPilot (Prod)

Stand 25.11.2026 (v4880). Gilt für den Fall „Server ist weg oder kaputt“. Zuständig für Freigabe: Marcel.
Zustand jederzeit: Admin › **Betrieb** (Ampeln, letzte Nachtsicherung, letzte Wiederherstellungsprobe).

## 0 · Was man VORHER haben muss (sonst geht es nicht)

| Was | Wo es liegt | Ersatz, wenn weg |
|---|---|---|
| Git-Repo | `git@github.com:JunkerImmobilien/DealPilot.git` (Zweige `main` = Prod, `staging`) | – |
| **`.env`** (rund 120 Schlüssel: DB, JWT, Stripe, SMTP, OpenAI, Geoapify, Zensus/Destatis, Nextcloud, ImmoMetrica, `DATEI_SCHLUESSEL` …) | NUR `/opt/dealpilot/.env` auf dem Server und in der Hetzner-Serversicherung | Schlüssel neu holen bei den Anbietern; **`DATEI_SCHLUESSEL` ist nicht ersetzbar**: ohne ihn sind die verschlüsselten Dateien der Dokumentenablage verloren |
| `docker-compose.prod.yml`, `Caddyfile`, `pdf-dienst/docker-compose.pdf.yml` | nur auf dem Server (bewusst nicht im Repo) und in der Hetzner-Serversicherung | aus `docker-compose.yml`/Repo-Doku nachbauen (Stunden) |
| Nachtsicherung `dp_*.dump`, `mb_*.dump`, `uploads_*.tar.gz` | `/opt/dealpilot/backups` auf dem Server (03:00, rotierend) und in der Hetzner-Serversicherung | – |
| DNS (dealpilot.immo, app.dealpilot.immo, app.dealpilot.junker-immobilien.io) | Registrar/DNS-Anbieter, Zugang Marcel | – |

> **Lücke (Stand 25.11.2026):** `.env`, Compose-Dateien und Caddyfile existieren nur auf dem Server. Fällt der
> Server samt Hetzner-Sicherung aus, ist die Wiederherstellung nicht vollständig möglich. Empfehlung: verschlüsselte
> Kopie dieser vier Dateien im Passwortmanager (Marcel). Admin › Betrieb zeigt das als gelben Punkt „Konfiguration“,
> bis `BETRIEB_KONFIG_OFFSITE=1` in der `.env` steht.

## 1 · Weg A: Hetzner-Serversicherung zurückspielen (schnellster Weg, ~15 Min.)

1. Hetzner Cloud Console › Server › Backups › jüngste Sicherung › „Wiederherstellen“ (oder als neues Image einen
   neuen Server erstellen, gleiche Größe, Standort Nürnberg/Falkenstein).
2. Bei neuem Server: IPv4 in DNS eintragen (A-Records der drei Domains), oder Floating IP umhängen.
3. Weiter mit **4 · Prüfschritte**. Daten sind auf dem Stand der Hetzner-Sicherung (täglich); die Nachtsicherung
   unter `/opt/dealpilot/backups` kann neuer sein und nach 3.2 eingespielt werden.

## 2 · Weg B: Neuer Server von Null (~1,5 bis 3 Std.)

1. Hetzner: Server anlegen (mind. 4 vCPU / 8 GB / 150 GB), Ubuntu LTS, SSH-Schlüssel hinterlegen.
2. Grundpakete: `apt update && apt -y upgrade && apt -y install docker.io docker-compose-v2 git python3 unattended-upgrades`;
   `dpkg-reconfigure -plow unattended-upgrades`; Firewall nur 22, 80, 443.
3. `git clone git@github.com:JunkerImmobilien/DealPilot.git /opt/dealpilot && cd /opt/dealpilot && git checkout main`
4. `.env`, `docker-compose.prod.yml`, `Caddyfile`, `pdf-dienst/docker-compose.pdf.yml` aus Passwortmanager bzw.
   Hetzner-Sicherung zurücklegen (Abschnitt 0).
5. Nachtsicherung-Dateien auf den neuen Server holen (aus Hetzner-Sicherung einhängen oder per `scp` vom alten Server).
6. Weiter mit 3.

## 3 · Datenbanken und Dateien zurückspielen

```
cd /opt/dealpilot
docker compose -f docker-compose.prod.yml up -d postgres mb-db          # nur die Datenbanken
# 3.1 Haupt-DB (Datenbank dealpilot_db, Nutzer dealpilot)
docker exec -i dealpilot-postgres pg_restore -U dealpilot -d dealpilot_db --clean --if-exists --no-owner < backups/dp_JJJJ-MM-TT.dump
# 3.2 Marktbericht-DB (Datenbank marktbericht, Nutzer mb, PostGIS)
docker exec -i dealpilot-mb-db pg_restore -U mb -d marktbericht --clean --if-exists --no-owner < backups/mb_JJJJ-MM-TT.dump
# 3.3 Dateien (Objektfotos, Dokumentenablage) ins Volume dealpilot_backend_uploads
docker volume create dealpilot_backend_uploads
tar -xzf backups/uploads_JJJJ-MM-TT.tar.gz -C /var/lib/docker/volumes/dealpilot_backend_uploads/_data
# 3.4 Rest starten (Backend baut und spielt fehlende Migrationen ein)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f pdf-dienst/docker-compose.pdf.yml up -d --build
```

Hinweise:
- Die Nachtsicherung ist im Format `-Fc` (pg_restore), nicht SQL. Die Sicherungen vor Rollouts unter `/root/backups`
  sind `*.sql.gz` (SQL): `zcat datei.sql.gz | docker exec -i dealpilot-postgres psql -U dealpilot -d dealpilot_db`.
- **Immer erst ansehen:** `ls -lh backups/` und Größen gegen Admin › Betrieb vergleichen (20-Byte-Sicherung = leer).
- Ist `UU4`s rsync-Snapshot-Skript (tools/server/nachtsicherung.sh) installiert, liegen Dateien als Snapshot-Ordner
  statt tar vor: dann `rsync -a <snapshot>/ /var/lib/docker/volumes/dealpilot_backend_uploads/_data/`.
  Welches Skript läuft, zeigt Admin › Betrieb › Sicherungen.

## 4 · Prüfschritte (in dieser Reihenfolge)

1. `docker ps` – sechs Container laufen: backend, mb-backend, pdf, caddy, postgres, mb-db; backend `healthy`.
2. `curl -s https://app.dealpilot.immo/version.json` liefert die erwartete Version; Landing `https://dealpilot.immo` 200.
3. TLS: Caddy holt Zertifikate selbst (ACME_EMAIL), erst nach DNS-Umstellung. Log: `docker logs dealpilot-caddy`.
4. Anmelden als Admin, Admin › Betrieb: Messung neu (nach Host-Takt, siehe 5), Zahl der Nutzer plausibel.
5. Host-Takte wieder einrichten: `crontab -e`
   ```
   0 3 * * * /root/nachtsicherung.sh
   7 * * * * /usr/bin/python3 /opt/dealpilot/tools/server/betrieb-sammeln.py --server prod
   20 5 * * 1 /usr/bin/python3 /opt/dealpilot/tools/server/betrieb-sammeln.py --server prod --audit
   30 4 1 * * /bin/bash /opt/dealpilot/tools/server/wiederherstellungsprobe.sh prod >> /var/log/wiederherstellungsprobe.log 2>&1
   ```
6. Ein Objekt öffnen (Fotos sichtbar), einen Marktbericht öffnen, ein PDF erzeugen, eine Testmail (Admin) senden.
7. Stripe-Webhook: im Stripe-Dashboard prüfen, dass Ereignisse ankommen (Endpunkt-URL unverändert).

## 5 · Dauer und Datenverlust

| Weg | Dauer | Datenverlust höchstens |
|---|---|---|
| A Hetzner-Sicherung | ~15 Min. + DNS | seit der letzten Hetzner-Sicherung (täglich) |
| B Neuer Server + Nachtsicherung | 1,5 bis 3 Std. | seit 03:00 Uhr des Tages |

## 6 · Probe

`tools/server/wiederherstellungsprobe.sh` spielt monatlich (1. des Monats 04:30) die neueste Nachtsicherung in
temporäre Container ohne Netz ein, vergleicht Tabellen und Zeilen mit der laufenden DB und löscht die Container
wieder. Ergebnis: Admin › Betrieb › Sicherungen. Erste Probe: 25.11.2026 (siehe Journal v4880).
