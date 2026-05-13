# GitHub-Workflow für DealPilot

**Variante A:** Du schiebst lokal Code ins Repo, der Server pullt. Kein ZIP-Versand mehr.

Repo: https://github.com/JunkerImmobilien/DealPilot

---

## Einmalige Einrichtung

### 1. Lokal: Git-Setup auf deinem Windows-PC

In **Git Bash** oder **PowerShell**:

```bash
cd C:\junker-saas
git init
git branch -M main
```

### 2. SSH-Key für GitHub erstellen (falls nicht vorhanden)

```bash
ssh-keygen -t ed25519 -C "marcel@junker-immobilien"
# Pfad bestätigen mit Enter, Passphrase setzen
type %USERPROFILE%\.ssh\id_ed25519.pub
```

Der ausgegebene Text (`ssh-ed25519 AAAA...`) kommt bei GitHub rein:
- https://github.com/settings/keys → **New SSH key**
- Title: `Marcel-Windows`
- Key-Inhalt einfügen

Test:
```bash
ssh -T git@github.com
# → "Hi JunkerImmobilien! You've successfully authenticated..."
```

### 3. Lokales Repo mit GitHub verbinden

```bash
cd C:\junker-saas
git remote add origin git@github.com:JunkerImmobilien/DealPilot.git

# Falls GitHub das Repo schon mit README initialisiert hat:
git pull origin main --allow-unrelated-histories
```

### 4. Erstes Commit + Push

```bash
git add .
git commit -m "Initial: DealPilot V26"
git push -u origin main
```

**WICHTIG:** Das mitgelieferte `.gitignore` schließt `.env` und Backups vom Commit aus. Prüf aber vor jedem `git add .` mit:
```bash
git status
```
Wenn da `.env` auftaucht → STOP, niemals pushen. (Sollte mit dem .gitignore nicht passieren.)

### 5. Server: Repo clonen statt entpacken

Erstmaliges Setup auf dem Hetzner-Server:

```bash
ssh root@<server-ip>

# SSH-Key auf dem Server (falls noch nicht da)
ssh-keygen -t ed25519 -C "hetzner-dealpilot"
# Passphrase leer lassen für non-interactive deploys
cat ~/.ssh/id_ed25519.pub
```

Diesen Public-Key bei GitHub hinzufügen — selbe Stelle, Title `Hetzner-Deploy`.

```bash
cd /opt
git clone git@github.com:JunkerImmobilien/DealPilot.git dealpilot
cd dealpilot

# .env vom alten v25-Setup übernehmen (oder neu anlegen)
cp /opt/dealpilot-v25-1/.env .  # oder: cp .env.production.example .env && nano .env

# Backups übernehmen
mkdir -p backups
cp -r /opt/dealpilot-v25-1/backups/* backups/ 2>/dev/null || true

# Container starten
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Tägliche Update-Routine (ab jetzt)

### Lokal: Code-Änderungen committen + pushen

```bash
cd C:\junker-saas

# Was hat sich geändert?
git status
git diff

# Alles staged + Commit + Push
git add .
git commit -m "V26.1: kleiner Fix / neues Feature"
git push
```

### Server: Update einspielen

```bash
ssh root@<server-ip>
cd /opt/dealpilot

# 1. Backup zuerst
mkdir -p backups
docker exec dealpilot-postgres pg_dump -U dealpilot dealpilot_db | \
  gzip > backups/pre_pull_$(date +%Y%m%d_%H%M%S).sql.gz

# 2. Code aktualisieren
git pull

# 3. Container neu bauen + starten (Migrations laufen automatisch)
docker compose -f docker-compose.prod.yml up -d --build

# 4. Health-Check
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend --tail 30
```

Fertig.

---

## Versionen markieren (Tags)

Wenn du eine stabile Version festhalten willst:

```bash
# Lokal
git tag -a v26.0 -m "V26 — KI-Key, Sidebar-Mockup, Marktzinsen, Settings-Draft"
git push origin v26.0
```

Auf GitHub erscheint der Tag unter "Releases".

Wenn du auf eine ältere Version zurück willst (nach Rollback):
```bash
ssh root@<server-ip>
cd /opt/dealpilot
git checkout v25.0
docker compose -f docker-compose.prod.yml up -d --build

# Zurück auf aktuelle:
git checkout main
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Rollback bei Problemen

Wenn nach einem `git pull` was bricht:

```bash
ssh root@<server-ip>
cd /opt/dealpilot

# 1. Zum vorherigen Commit zurück
git log --oneline -10                # letzte 10 Commits sehen
git reset --hard HEAD~1              # einen Commit zurück

# 2. Container neu starten
docker compose -f docker-compose.prod.yml up -d --build

# 3. Falls DB-Migrationen schon gelaufen sind, ggf. DB-Restore:
gunzip < backups/pre_pull_<timestamp>.sql.gz | \
  docker exec -i dealpilot-postgres psql -U dealpilot dealpilot_db
```

---

## Häufige Git-Befehle

```bash
git status                  # Was hat sich geändert?
git log --oneline -20       # Letzte 20 Commits
git diff                    # Aktuelle Änderungen ansehen
git diff HEAD~1             # Was hat sich seit dem letzten Commit geändert?
git stash                   # Lokale Änderungen "wegpacken" (z.B. um pullen zu können)
git stash pop               # Sie zurückholen
```

---

## Häufige Probleme

### "Permission denied (publickey)"

SSH-Key nicht (richtig) eingetragen oder ssh-agent läuft nicht. Test:
```bash
ssh -T git@github.com
```

Wenn das nicht klappt: SSH-Key bei GitHub prüfen (https://github.com/settings/keys).

### "fatal: refusing to merge unrelated histories"

Beim ersten `git pull`. Lösung:
```bash
git pull origin main --allow-unrelated-histories
```

### "Your local changes would be overwritten by merge"

Du hast lokal Code geändert, der mit dem Remote kollidiert. Optionen:
```bash
git stash             # lokale Änderungen wegpacken
git pull              # Remote ziehen
git stash pop         # Eigene Änderungen wieder drauf
```

### `.env` aus Versehen gepusht

```bash
# Aus Git entfernen (lokales File bleibt)
git rm --cached .env
git commit -m "Remove .env from tracking"
git push

# WICHTIG: Sofort alle Secrets rotieren!
# - JWT_SECRET neu generieren: openssl rand -hex 64
# - DB_PASSWORD ändern
# - OPENAI_API_KEY neu erstellen bei OpenAI
```

### "Docker compose fails after git pull"

Manchmal hat sich an Dependencies oder Migrations was geändert. Aggressiver Rebuild:
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## Die wichtigste Regel

**`git status` vor jedem `git push`.** Wenn da etwas Verdächtiges drinsteht (`.env`, riesige Photos, Backups), nochmal überlegen bevor du pushst.

`.env`-Files gehören NIE ins Repo. Wenn du es einmal getan hast, sind die Secrets im Internet — auch wenn du den Commit löschst, ist er in der Git-Historie und bei GitHub gespeichert.

---

V26 · Stand 29.04.2026
