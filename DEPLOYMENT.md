# DealPilot — Deployment-Workflow

**Stand: 13.05.2026** · Siehe auch [README.md](README.md) für Architektur-Übersicht.

Diese Datei beschreibt **wie du Updates ausrollst** von Code-Änderung bis Live.

---

## Der Standard-Workflow
---

## Die 4 Update-Typen

Je nach Art der Änderung sind unterschiedliche Schritte nötig. Identifiziere zuerst was du änderst:

| Typ | Was | Deploy-Methode |
|---|---|---|
| 1 | Frontend (HTML/CSS/JS) | Volume-Mount → sofort live, nur Caddy reload |
| 2 | Backend (Node-Code) | Image rebuild + recreate Container |
| 3 | Migration (neue SQL) | Backend restart (Migrations laufen beim Start) |
| 4 | .env (Secrets/Config) | force-recreate Container |

---

## Typ 1: Frontend-Änderung (HTML/CSS/JS)

**Was zählt dazu:** Änderungen in `frontend/js/*.js`, `frontend/css/*.css`, `frontend/index.html`

### Workflow

```bash
# ─── AUF STAGING-SERVER ───
ssh root@116.203.214.11
cd /opt/dealpilot

# 1. Code ändern
nano frontend/js/SOMEFILE.js

# 2. Cache-Bump (sonst lädt Browser alte Datei aus Cache!)
sed -i 's|SOMEFILE\.js?v=[0-9]\+|SOMEFILE.js?v=NEUE_VERSION|g' frontend/index.html

# 3. Im Browser testen
# https://staging.dealpilot.junker-immobilien.io (Strg+Shift+R)

# 4. Wenn OK: commit + push
git add frontend/
git commit -m "feat(frontend): WAS DU GEMACHT HAST"
git push origin staging

# ─── AUF PROD-SERVER ───
ssh root@157.90.117.167
cd /opt/dealpilot

# 5. Merge staging → main
git fetch origin
git merge origin/staging --no-ff -m "Merge staging into main: WAS DU GEMACHT HAST"
git push origin main

# 6. Caddy reload (volume-mount = eigentlich sofort live, restart sicherheitshalber)
docker compose -f docker-compose.prod.yml restart caddy

# 7. Browser-Test: https://dealpilot.junker-immobilien.io (Strg+Shift+R)
```

**Dauer:** 2-5 Minuten

---

## Typ 2: Backend-Änderung (Node.js-Code)

**Was zählt dazu:** Änderungen in `backend/src/**`

### Workflow

```bash
# ─── AUF STAGING ───
ssh root@116.203.214.11
cd /opt/dealpilot

# 1. Code ändern
nano backend/src/routes/SOMEFILE.js

# 2. Image neu bauen + Container ersetzen
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --force-recreate backend

# 3. Logs prüfen
docker compose -f docker-compose.prod.yml logs --tail=20 backend
# Server sollte starten ohne Errors

# 4. Im Browser/API testen

# 5. Commit + push
git add backend/
git commit -m "feat(backend): WAS DU GEMACHT HAST"
git push origin staging

# ─── AUF PROD ───
ssh root@157.90.117.167
cd /opt/dealpilot

# 6. DB-Backup (immer vor Backend-Update auf Prod!)
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U dealpilot dealpilot_db | gzip > /root/db-backup-$(date +%Y%m%d-%H%M%S).sql.gz

# 7. Merge + Pull
git fetch origin
git merge origin/staging --no-ff -m "Merge: WAS DU GEMACHT HAST"
git push origin main

# 8. Image neu bauen + Container ersetzen
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --force-recreate backend

# 9. Logs prüfen
docker compose -f docker-compose.prod.yml logs --tail=20 backend
```

**Dauer:** 5-10 Minuten (wegen Build)

---

## Typ 3: Migration (neue SQL-Datei)

**Was zählt dazu:** Neue Datei in `backend/migrations/NNN_*.sql`

### Workflow

```bash
# ─── AUF STAGING ───
ssh root@116.203.214.11
cd /opt/dealpilot

# 1. SQL-File erstellen mit nächster Nummer
# Aktuelle Migrations checken:
ls backend/migrations/ | tail -3
# z.B. letzte ist 019, neue wird 020:
nano backend/migrations/020_neues_feature.sql

# 2. Backend restart → Migrations laufen automatisch beim Start
docker compose -f docker-compose.prod.yml restart backend

# 3. Logs checken — Migration sollte applied werden
docker compose -f docker-compose.prod.yml logs --tail=20 backend
# Suche nach: "✓ Migration 020_neues_feature.sql applied"

# 4. App testen

# 5. Commit + push
git add backend/migrations/
git commit -m "feat(db): Migration 020 — was sie macht"
git push origin staging

# ─── AUF PROD ───
ssh root@157.90.117.167
cd /opt/dealpilot

# 6. DB-BACKUP IST PFLICHT!
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U dealpilot dealpilot_db | gzip > /root/db-backup-pre-mig020-$(date +%Y%m%d-%H%M%S).sql.gz

# 7. Merge + Pull
git fetch origin
git merge origin/staging --no-ff -m "Merge: Migration 020"
git push origin main

# 8. Restart (Migration läuft beim Start)
docker compose -f docker-compose.prod.yml restart backend

# 9. Logs prüfen
docker compose -f docker-compose.prod.yml logs --tail=20 backend
```

**Dauer:** 5-10 Minuten

---

## Typ 4: `.env`-Änderung (Secrets, Config)

**Was zählt dazu:** Änderungen an Stripe-Keys, JWT-Secret, neue ENV-Variable, etc.

### Wichtig

- `.env` ist **NICHT** im Git
- Jeder Server hat seine **eigene `.env`**
- Wenn du eine Variable auf beiden Servern willst, musst du sie auf beiden **manuell** setzen
- `restart` reicht **NICHT** für ENV-Änderungen — du brauchst `up -d --force-recreate`!

### Workflow

```bash
# Auf jedem Server separat:
cd /opt/dealpilot

# 1. .env bearbeiten
nano .env

# 2. Container neu erstellen (NICHT nur restart!)
docker compose -f docker-compose.prod.yml up -d --force-recreate backend

# 3. Verify: Container sieht die neue Variable
docker compose -f docker-compose.prod.yml exec backend printenv | grep VARIABLE_NAME

# 4. Logs prüfen
docker compose -f docker-compose.prod.yml logs --tail=10 backend
```

---

## Konkrete Beispiele

### Beispiel A: Button-Text ändern (Typ 1)

```bash
# Staging
ssh root@116.203.214.11
cd /opt/dealpilot
sed -i 's|"Investor-Plan starten"|"Investor jetzt buchen"|g' frontend/js/pricing-modal.js
sed -i 's|pricing-modal\.js?v=181|pricing-modal.js?v=182|g' frontend/index.html
# Browser-Test
git add . && git commit -m "feat(ui): Button-Text Investor angepasst" && git push origin staging

# Prod
ssh root@157.90.117.167
cd /opt/dealpilot
git fetch && git merge origin/staging --no-ff -m "Merge: Button-Text" && git push origin main
docker compose -f docker-compose.prod.yml restart caddy
```

### Beispiel B: Backend-Endpoint anpassen (Typ 2)

```bash
# Staging
ssh root@116.203.214.11
cd /opt/dealpilot
nano backend/src/services/planService.js
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
docker compose -f docker-compose.prod.yml logs -f backend
# testen
git add . && git commit -m "feat(plans): neues Feature X" && git push origin staging

# Prod
ssh root@157.90.117.167
cd /opt/dealpilot
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U dealpilot dealpilot_db | gzip > /root/db-backup-$(date +%Y%m%d-%H%M%S).sql.gz
git fetch && git merge origin/staging --no-ff -m "Merge: Plan-Feature X" && git push origin main
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
docker compose -f docker-compose.prod.yml logs --tail=20 backend
```

### Beispiel C: Stripe-Webhook-Secret rotieren (Typ 4)

```bash
# Auf Prod (oder Staging — beide haben eigene Secrets):
cd /opt/dealpilot
sed -i 's|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=whsec_NEW_KEY|' .env
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
docker compose -f docker-compose.prod.yml exec backend printenv | grep STRIPE_WEBHOOK_SECRET
```

---

## Hotfix-Workflow (Notfall direkt auf Prod)

Wenn Prod brennt und Staging-Test zu lange dauert:

```bash
# Direkt auf Prod fixen
ssh root@157.90.117.167
cd /opt/dealpilot
nano DATEI
git add . && git commit -m "hotfix: WAS WAR DAS PROBLEM" && git push origin main

# Container neu (je nach Typ)
docker compose -f docker-compose.prod.yml build backend && \
docker compose -f docker-compose.prod.yml up -d --force-recreate backend

# Danach Staging mit Prod syncen!
ssh root@116.203.214.11
cd /opt/dealpilot
git fetch && git merge origin/main --no-ff -m "Sync: Hotfix vom Prod" && git push origin staging
```

---

## Vor jedem Deploy auf Prod (Checkliste)

```bash
# 1. DB-Backup
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U dealpilot dealpilot_db | \
  gzip > /root/db-backup-$(date +%Y%m%d-%H%M%S).sql.gz

# 2. Aktuellen Stand notieren (für Rollback)
docker compose -f docker-compose.prod.yml ps
git log --oneline -3
```

---

## Rollback

Wenn nach Deploy was kaputt ist:

### Code rollbacken

```bash
# Letzten guten Commit finden
git log --oneline -10

# Code zurücksetzen
git reset --hard LETZTER_GUTER_COMMIT_HASH

# Backend: rebuilden mit altem Code
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --force-recreate backend

# Frontend: Caddy restart (volume-mount lädt automatisch)
docker compose -f docker-compose.prod.yml restart caddy
```

### DB rollbacken

```bash
# Backup-Datei finden
ls -lt /root/db-backup-*.sql.gz | head -5

# Restore
gunzip -c /root/db-backup-XXX.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U dealpilot -d dealpilot_db
```

---

## Was du **NIE** tun solltest

❌ Direkt auf Prod entwickeln ohne Staging-Test (außer echte Hotfixes)
❌ `.env` ins Git committen (Secrets würden geleakt)
❌ `git push --force` auf shared Branches (überschreibt History)
❌ Migration auf Prod ohne DB-Backup
❌ `docker volume rm` (DB-Daten sind drin!)
❌ Cache-Bumps vergessen (Browser zeigt alte JS-Datei)

---

## Häufige Befehle Spickzettel

```bash
# Container-Status
docker compose -f docker-compose.prod.yml ps

# Logs ansehen
docker compose -f docker-compose.prod.yml logs --tail=30 backend
docker compose -f docker-compose.prod.yml logs -f backend  # live

# Backend rebuild + restart
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --force-recreate backend

# DB-Konsole
docker compose -f docker-compose.prod.yml exec postgres psql -U dealpilot dealpilot_db

# Git-Status
git status
git log --oneline -5
git branch --show-current
```

