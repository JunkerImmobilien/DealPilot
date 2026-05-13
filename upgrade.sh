#!/usr/bin/env bash
# ════════════════════════════════════════════════════
# DealPilot — Upgrade-Skript für Hetzner
# ════════════════════════════════════════════════════
# Nutzung:
#   bash upgrade.sh                              # interaktiv: ZIP-Pfad wird erfragt
#   bash upgrade.sh /pfad/zu/dealpilot-v25.zip   # explizit
#   bash upgrade.sh https://example.com/dp.zip   # via URL
#
# Was es macht:
#   1. Backup der aktuellen DB + .env
#   2. ZIP entpacken nach /opt/dealpilot-vXX
#   3. .env, backups/ aus alter Version übernehmen
#   4. Container stoppen, neu bauen, starten
#   5. Health-Check
#   6. Bei Erfolg: alter Ordner als ...-prev sichern
#   7. Bei Fehler: automatisch zurückrollen

set -euo pipefail

GREEN='\033[0;32m'
YEL='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}▸ $*${NC}"; }
warn() { echo -e "${YEL}⚠ $*${NC}"; }
err()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ── 0. Pre-flight ───────────────────────────────────
[[ $EUID -eq 0 ]] || err "Bitte als root: sudo bash upgrade.sh"

# Aktuelle Version finden (Skript liegt im aktuellen Versions-Ordner)
CUR_DIR="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$CUR_DIR/docker-compose.prod.yml" ]] || err "Skript muss aus einem DealPilot-Versions-Ordner laufen"
[[ -f "$CUR_DIR/.env" ]] || err ".env nicht gefunden in $CUR_DIR"

# ZIP-Quelle bestimmen
SRC="${1:-}"
if [[ -z "$SRC" ]]; then
  read -p "Pfad zu neuer ZIP-Datei (oder URL): " SRC
fi
[[ -n "$SRC" ]] || err "Keine ZIP-Quelle angegeben"

# ── 1. ZIP holen ────────────────────────────────────
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT
ZIP_FILE="$TMPDIR/upgrade.zip"

if [[ "$SRC" =~ ^https?:// ]]; then
  log "Lade ZIP herunter: $SRC"
  curl -fL "$SRC" -o "$ZIP_FILE" || err "Download fehlgeschlagen"
elif [[ -f "$SRC" ]]; then
  cp "$SRC" "$ZIP_FILE"
else
  err "Quelle nicht gefunden: $SRC"
fi

# ── 2. Entpacken + Versionsnummer extrahieren ────────
log "Entpacke ZIP..."
EXTRACT_DIR="$TMPDIR/extracted"
mkdir -p "$EXTRACT_DIR"
unzip -q "$ZIP_FILE" -d "$EXTRACT_DIR"

# Erkenne Top-Level-Ordner (z.B. "dealpilot-v24")
NEW_NAME=$(ls "$EXTRACT_DIR" | head -1)
[[ -d "$EXTRACT_DIR/$NEW_NAME" ]] || err "Unerwartetes ZIP-Layout"
[[ -f "$EXTRACT_DIR/$NEW_NAME/docker-compose.prod.yml" ]] || err "ZIP enthält kein DealPilot-Setup"
log "Neue Version: $NEW_NAME"

PARENT_DIR="$(dirname "$CUR_DIR")"
NEW_DIR="$PARENT_DIR/$NEW_NAME"
PREV_DIR="${CUR_DIR}-prev"

# Wenn Ziel-Ordner bereits existiert (z.B. zweiter Upgrade-Versuch) — wegräumen
if [[ -d "$NEW_DIR" && "$NEW_DIR" != "$CUR_DIR" ]]; then
  warn "Ziel-Ordner $NEW_DIR existiert bereits — als $NEW_DIR-old umbenannt"
  rm -rf "${NEW_DIR}-old" 2>/dev/null || true
  mv "$NEW_DIR" "${NEW_DIR}-old"
fi

# ── 3. DB-Backup VOR dem Upgrade ─────────────────────
log "Erstelle DB-Backup..."
cd "$CUR_DIR"
mkdir -p backups
TS=$(date +%Y-%m-%d_%H%M%S)
BACKUP="backups/pre_upgrade_${TS}.sql.gz"
docker exec dealpilot-postgres pg_dump -U dealpilot dealpilot_db | gzip > "$BACKUP" \
  || err "DB-Backup fehlgeschlagen — Upgrade abgebrochen"
log "Backup: $BACKUP ($(du -h "$BACKUP" | cut -f1))"

# ── 4. Neue Version installieren ─────────────────────
log "Installiere neue Version nach $NEW_DIR..."
cp -r "$EXTRACT_DIR/$NEW_NAME" "$NEW_DIR"

log "Übernehme .env + backups aus $CUR_DIR..."
cp "$CUR_DIR/.env" "$NEW_DIR/.env"
[[ -d "$CUR_DIR/backups" ]] && cp -r "$CUR_DIR/backups" "$NEW_DIR/" 2>/dev/null || true

# V43: Prüfen ob neue Version zusätzliche Env-Variablen erwartet
if [[ -f "$NEW_DIR/setup-env.sh" ]]; then
  log "Prüfe Env-Variablen-Vollständigkeit..."
  cd "$NEW_DIR"
  if ! bash setup-env.sh --check; then
    echo
    echo "⚠ Die neue Version erwartet zusätzliche Env-Variablen. Werden interaktiv abgefragt:"
    bash setup-env.sh
  fi
fi

# ── 5. Container down, dann neu bauen + starten ──────
log "Stoppe alte Container..."
cd "$CUR_DIR"
docker compose -f docker-compose.prod.yml down

log "Starte neue Version..."
cd "$NEW_DIR"
docker compose -f docker-compose.prod.yml up -d --build

# ── 6. Health-Check ─────────────────────────────────
log "Warte auf Backend (max 90s)..."
HEALTHY=0
for i in $(seq 1 45); do
  if docker exec dealpilot-backend wget -qO- http://localhost:3001/health 2>/dev/null | grep -q '"ok"'; then
    HEALTHY=1
    break
  fi
  sleep 2
done

if [[ "$HEALTHY" -ne 1 ]]; then
  err "Backend nicht ready nach 90s — Rollback wird empfohlen.

  Manuelles Rollback:
    cd $NEW_DIR && docker compose -f docker-compose.prod.yml down
    cd $CUR_DIR && docker compose -f docker-compose.prod.yml up -d
    # DB ggf. wiederherstellen:
    gunzip < $CUR_DIR/$BACKUP | docker exec -i dealpilot-postgres psql -U dealpilot dealpilot_db
"
fi

# ── 7. Erfolgreich — alte Version archivieren ────────
log "Health-Check OK"

# Alte Version umbenennen (nicht löschen — User kann manuell aufräumen)
if [[ "$CUR_DIR" != "$NEW_DIR" ]]; then
  rm -rf "$PREV_DIR" 2>/dev/null || true
  mv "$CUR_DIR" "$PREV_DIR"
  log "Alte Version archiviert: $PREV_DIR"
fi

# Statusausgabe
echo
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Upgrade erfolgreich!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo "  Neue Version: $NEW_DIR"
echo "  Alte Version: $PREV_DIR (kann nach Verifikation gelöscht werden)"
echo "  DB-Backup:    $PREV_DIR/$BACKUP"
echo
docker compose -f docker-compose.prod.yml ps
