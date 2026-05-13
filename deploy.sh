#!/usr/bin/env bash
# ════════════════════════════════════════════════════
# DealPilot — 1-Klick-Deploy auf Hetzner Cloud-VM
# ════════════════════════════════════════════════════
# Voraussetzungen:
#   - Frische Hetzner Cloud-VM (Ubuntu 22.04 oder 24.04)
#   - SSH als root oder sudo-User
#   - Domain zeigt per A-Record auf die Server-IP (IPv4)
#
# Nutzung:
#   ssh root@<server-ip>
#   bash deploy.sh
#
# Das Skript ist idempotent — du kannst es mehrfach laufen lassen.

set -euo pipefail

GREEN='\033[0;32m'
YEL='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}▸ $*${NC}"; }
warn() { echo -e "${YEL}⚠ $*${NC}"; }
err()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ── 0. Pre-flight ───────────────────────────────────
[[ $EUID -eq 0 ]] || err "Bitte als root ausführen: sudo bash deploy.sh"
[[ -f docker-compose.prod.yml ]] || err "docker-compose.prod.yml nicht gefunden — bitte aus dem entpackten ZIP-Verzeichnis ausführen"
[[ -f Caddyfile ]] || err "Caddyfile nicht gefunden — bitte aus dem entpackten ZIP-Verzeichnis ausführen"

# ── 1. Docker installieren (falls fehlt) ────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Docker wird installiert…"
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  log "Docker installiert."
else
  log "Docker bereits vorhanden."
fi

# ── 2. Firewall (UFW) ───────────────────────────────
if command -v ufw >/dev/null 2>&1; then
  log "Firewall wird konfiguriert (SSH/HTTP/HTTPS)…"
  ufw --force reset >/dev/null 2>&1 || true
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp comment 'SSH'
  ufw allow 80/tcp comment 'HTTP (Caddy ACME)'
  ufw allow 443/tcp comment 'HTTPS'
  ufw --force enable
fi

# ── 3. .env vorbereiten ─────────────────────────────
if [[ ! -f .env ]]; then
  if [[ ! -f .env.production.example ]]; then
    err ".env fehlt und .env.production.example auch — Setup nicht möglich."
  fi
  cp .env.production.example .env
  warn ".env wurde aus dem Template kopiert."
  warn "JETZT BITTE: nano .env  → DOMAIN, ACME_EMAIL, DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD ausfüllen."
  warn "Tipp: Secrets generieren mit:"
  warn "   echo \"DB_PASSWORD=\$(openssl rand -base64 24)\" >> .env"
  warn "   echo \"JWT_SECRET=\$(openssl rand -hex 64)\" >> .env"
  echo
  read -p "Drücke Enter, sobald .env fertig ist (Strg+C zum Abbrechen)…"
fi

# ── 4. .env validieren ──────────────────────────────
required_vars=(DOMAIN ACME_EMAIL DB_PASSWORD JWT_SECRET)
for v in "${required_vars[@]}"; do
  if ! grep -E "^${v}=.+" .env | grep -vE "^${v}=BITTE|^${v}=$|^${v}=AENDERN|^${v}=CHANGE" >/dev/null; then
    err "$v ist in .env nicht gesetzt oder noch ein Platzhalter."
  fi
done
DOMAIN=$(grep '^DOMAIN=' .env | cut -d= -f2-)
log ".env ist valide. Domain: ${DOMAIN}"

# ── 5. DNS-Check ─────────────────────────────────────
log "DNS-Check für ${DOMAIN}…"
SERVER_IP=$(curl -4 -s ifconfig.me || true)
DNS_IP=$(getent hosts "${DOMAIN}" | awk '{print $1}' | head -1 || true)
if [[ -z "${DNS_IP}" ]]; then
  warn "DNS für ${DOMAIN} nicht aufgelöst — bitte A-Record auf ${SERVER_IP} setzen."
  read -p "Trotzdem fortfahren? (y/N) " yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 0
elif [[ "${DNS_IP}" != "${SERVER_IP}" ]]; then
  warn "DNS zeigt auf ${DNS_IP}, Server hat aber ${SERVER_IP}."
  warn "Let's Encrypt wird scheitern bis der A-Record stimmt."
  read -p "Trotzdem fortfahren? (y/N) " yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 0
else
  log "DNS ✓ ${DOMAIN} → ${SERVER_IP}"
fi

# ── 6. Compose Build + Start ─────────────────────────
log "Container werden gebaut + gestartet…"
docker compose -f docker-compose.prod.yml pull --quiet
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# ── 7. Health-Check ──────────────────────────────────
log "Warte auf Backend (max 60s)…"
for i in $(seq 1 30); do
  if docker exec dealpilot-backend wget -qO- http://localhost:3001/health 2>/dev/null | grep -q '"ok"'; then
    log "Backend ✓ läuft"
    break
  fi
  sleep 2
done

log "Status:"
docker compose -f docker-compose.prod.yml ps

echo
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  DealPilot ist deployt!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo "  → https://${DOMAIN}"
echo
echo "Cert-Ausstellung dauert beim ersten Aufruf 10–60 Sekunden."
echo
echo "Logs anschauen:"
echo "  docker compose -f docker-compose.prod.yml logs -f backend"
echo "  docker compose -f docker-compose.prod.yml logs -f caddy"
echo
echo "Backup machen:"
echo "  bash backup.sh"
echo
