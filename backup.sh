#!/usr/bin/env bash
# DealPilot — DB-Backup
# Schreibt einen pg_dump nach ./backups/

set -euo pipefail
mkdir -p backups
TS=$(date +%Y-%m-%d_%H%M%S)
FILE="backups/dealpilot_${TS}.sql.gz"

docker exec dealpilot-postgres pg_dump -U dealpilot dealpilot_db | gzip > "${FILE}"

echo "✓ Backup erstellt: ${FILE}"
echo "  Größe: $(du -h "${FILE}" | cut -f1)"

# Alte Backups (>30 Tage) löschen
find backups -name "dealpilot_*.sql.gz" -mtime +30 -delete 2>/dev/null || true
