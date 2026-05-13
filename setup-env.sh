#!/usr/bin/env bash
# DealPilot V45 — Env-Setup-Script
#
# Verwendung:
#   bash setup-env.sh                 # Erstellt .env interaktiv, ergänzt fehlende Keys
#   bash setup-env.sh --check         # Nur prüfen, Exit-Code != 0 wenn Variablen fehlen
#   bash setup-env.sh --fix-smtp      # NUR die 7 BETA_*-Variablen (SMTP) auf Junker-Defaults setzen
#                                       (alles andere unangetastet) — fragt nach SMTP_PASS
#
# Lehre aus V42:
# - env_file: .env muss IM compose-File sein (jetzt permanent — siehe docker-compose.prod.yml)
# - Container muss neu erstellt werden NACH .env-Änderungen (docker rm -f + up)
# - Hetzner blockiert outbound 465 → Port 587 + STARTTLS
# - BETA_MAIL_FROM braucht Anführungszeichen wegen < > Zeichen
# - FROM-Adresse identisch zu SMTP_USER (sonst lehnt Alfahosting ab oder Spam)

set -e

ENV_FILE=".env"
CHECK_ONLY=false
FIX_SMTP=false
case "$1" in
  --check)     CHECK_ONLY=true ;;
  --fix-smtp)  FIX_SMTP=true ;;
  --test-mail) TEST_MAIL=true ;;
esac

# ─────────────────────────────────────────────
# --test-mail Modus: schickt echte Test-Mail über laufenden Backend-Container
# ─────────────────────────────────────────────
if [ "${TEST_MAIL:-false}" = "true" ]; then
  echo "=== DealPilot V48 — SMTP-Test-Mail ==="
  echo
  echo "1. Prüfe ob Backend-Container läuft..."
  if ! docker ps --format "{{.Names}}" | grep -q "^dealpilot-backend$"; then
    echo "  ⚠ dealpilot-backend Container läuft nicht."
    echo "    Erst hochfahren: docker compose -f docker-compose.prod.yml up -d"
    exit 1
  fi
  echo "  ✓ läuft"
  echo

  echo "2. ENV-Variablen im Container:"
  N=$(docker exec dealpilot-backend env 2>/dev/null | grep -c "^BETA_")
  echo "  BETA_*-Variablen: $N (erwartet: 7)"
  if [ "$N" != "7" ]; then
    echo "  ⚠ Anzahl stimmt nicht. Container neu erstellen:"
    echo "    docker rm -f dealpilot-backend"
    echo "    docker compose -f docker-compose.prod.yml up -d --no-deps backend"
    exit 1
  fi
  docker exec dealpilot-backend env 2>/dev/null | grep "^BETA_" | sed 's/BETA_SMTP_PASS=.*/BETA_SMTP_PASS=********/'
  echo

  echo "3. Status-Endpoint:"
  STATUS=$(curl -s http://localhost:3001/api/v1/beta-signup/status 2>/dev/null || echo '{}')
  echo "  $STATUS"
  if ! echo "$STATUS" | grep -q "\"configured\":true"; then
    echo "  ⚠ Mailer nicht konfiguriert. Logs prüfen:"
    echo "    docker logs dealpilot-backend 2>&1 | grep -i 'smtp\\|mail' | tail -20"
    exit 1
  fi
  echo

  echo "4. Test-Mail an info@junker-immobilien.io senden:"
  RESP=$(curl -s -X POST http://localhost:3001/api/v1/beta-signup \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"V48 Test\",\"email\":\"info@junker-immobilien.io\",\"message\":\"V48 SMTP-Test um $(date)\"}" 2>/dev/null)
  echo "  Response: $RESP"
  if echo "$RESP" | grep -q "\"success\":true"; then
    echo
    echo "  ✓ Mail wurde versendet. Prüfe info@junker-immobilien.io Postfach (auch Spam)."
    echo "  Logs:"
    docker logs dealpilot-backend 2>&1 | tail -5 | grep -i "beta\\|mail\\|smtp" || echo "    (keine relevanten Log-Einträge in letzten 5 Zeilen)"
  else
    echo
    echo "  ⚠ Mail-Versand fehlgeschlagen. Logs:"
    docker logs dealpilot-backend 2>&1 | grep -i "smtp\\|mail\\|beta" | tail -10
    echo
    echo "  Häufigste Ursachen:"
    echo "    - SMTP-Passwort falsch (vom User geändert?)"
    echo "    - BETA_MAIL_FROM ohne Anführungszeichen"
    echo "    - Hetzner blockiert Port (sollte 587 sein, nicht 465)"
    echo "    - Container hat alte ENV (docker rm -f + up)"
  fi
  exit 0
fi

# ─────────────────────────────────────────────
# --fix-smtp Modus: nur SMTP-Werte überschreiben
# ─────────────────────────────────────────────
if [ "$FIX_SMTP" = "true" ]; then
  if [ ! -f "$ENV_FILE" ]; then
    echo "FEHLER: $ENV_FILE existiert nicht. Erst 'bash setup-env.sh' für vollen Setup."
    exit 1
  fi

  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
  echo "→ Backup: ${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"

  # Passwort abfragen
  read -r -s -p "  BETA_SMTP_PASS (Postfach-Passwort info@junker-immobilien.io): " SMTP_PASS
  echo

  # Alle BETA_-Zeilen aus der .env entfernen
  grep -v "^BETA_" "$ENV_FILE" > "${ENV_FILE}.tmp" || true

  # Junker-SMTP-Block anhängen
  cat >> "${ENV_FILE}.tmp" <<EOF

# V45: SMTP für Beta-Anfragen + Passwort-Reset (Alfahosting · Hetzner-getestet)
# Hetzner blockiert outbound Port 465 → wir nutzen 587 + STARTTLS
BETA_SMTP_HOST=host160.alfahosting-server.de
BETA_SMTP_PORT=587
BETA_SMTP_SECURE=false
BETA_SMTP_USER=info@junker-immobilien.io
BETA_SMTP_PASS=$SMTP_PASS
BETA_MAIL_FROM="DealPilot <info@junker-immobilien.io>"
BETA_MAIL_TO=info@junker-immobilien.io
EOF

  mv "${ENV_FILE}.tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  echo
  echo "✓ SMTP-Variablen in $ENV_FILE aktualisiert."
  echo "  Status:"
  grep "^BETA_" "$ENV_FILE" | sed 's/^BETA_SMTP_PASS=.*/BETA_SMTP_PASS=********/'
  echo
  echo "Nächster Schritt — Container neu erstellen damit ENV neu geladen wird:"
  echo "  docker rm -f dealpilot-backend"
  echo "  docker compose -f docker-compose.prod.yml up -d --no-deps backend"
  echo "  sleep 12"
  echo "  docker exec dealpilot-backend env | grep BETA_ | wc -l   # → 7"
  echo "  curl -s https://dealpilot.junker-immobilien.io/api/v1/beta-signup/status"
  exit 0
fi

# Alle erforderlichen Keys + Defaults + Beschreibung
declare -A KEYS=(
  [DB_PASSWORD]="DB-Passwort für PostgreSQL (mind 16 Zeichen, alphanumerisch)"
  [JWT_SECRET]="JWT-Secret (mind 32 Zeichen, random)"
  [DOMAIN]="Domain ohne https:// (z.B. dealpilot.junker-immobilien.io)"
  [ADMIN_EMAIL]="Admin-E-Mail (Initial-Admin-Account)"
  [ADMIN_PASSWORD]="Admin-Passwort (Initial-Admin-Account)"
  [ADMIN_NAME]="Admin-Anzeigename"
  [OPENAI_API_KEY]="OpenAI API Key (sk-... — leer lassen wenn User eigene Keys nutzen)"
  [BETA_SMTP_HOST]="SMTP-Host (z.B. host160.alfahosting-server.de)"
  [BETA_SMTP_PORT]="SMTP-Port (587 STARTTLS empfohlen, 465 TLS-direkt von Hetzner geblockt)"
  [BETA_SMTP_SECURE]="true bei Port 465, false bei Port 587 STARTTLS"
  [BETA_SMTP_USER]="SMTP-Benutzername (volle E-Mail-Adresse)"
  [BETA_SMTP_PASS]="SMTP-Passwort"
  [BETA_MAIL_FROM]='Sender-Anzeige (z.B. "DealPilot <info@junker-immobilien.io>")'
  [BETA_MAIL_TO]="Empfänger für Beta-Anfragen"
  [SEED_DEMO_DATA]="0=keine Demo-Daten, 1=Demo-User mit Beispielobjekten anlegen"
  [FRONTEND_BASE_URL]="Vollständige Frontend-URL inkl https:// (für Reset-Mail-Links)"
)

# Reihenfolge zum Schreiben
ORDER=(
  DB_PASSWORD JWT_SECRET DOMAIN
  ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME
  OPENAI_API_KEY
  BETA_SMTP_HOST BETA_SMTP_PORT BETA_SMTP_SECURE BETA_SMTP_USER BETA_SMTP_PASS
  BETA_MAIL_FROM BETA_MAIL_TO
  SEED_DEMO_DATA FRONTEND_BASE_URL
)

# Defaults — Junker-spezifisch vorbefüllt damit Marcel nicht jedes Mal alles eintippen muss
declare -A DEFAULTS=(
  [BETA_SMTP_HOST]="host160.alfahosting-server.de"
  [BETA_SMTP_PORT]="587"
  [BETA_SMTP_SECURE]="false"
  [BETA_SMTP_USER]="info@junker-immobilien.io"
  [BETA_MAIL_FROM]='"DealPilot <info@junker-immobilien.io>"'
  [BETA_MAIL_TO]="info@junker-immobilien.io"
  [SEED_DEMO_DATA]="0"
  [ADMIN_NAME]="Marcel Junker"
  [DOMAIN]="dealpilot.junker-immobilien.io"
  [FRONTEND_BASE_URL]="https://dealpilot.junker-immobilien.io"
)

echo "=== DealPilot V49 — .env Setup ==="
echo

# 1. Existing .env einlesen
declare -A EXISTING=()
if [ -f "$ENV_FILE" ]; then
  echo "→ Existierende $ENV_FILE gefunden — lese ein…"
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    # Werte in "..." oder '...' bleiben wie sie sind
    EXISTING[$key]="$value"
  done < "$ENV_FILE"
  echo "  ${#EXISTING[@]} Variablen gefunden."
else
  echo "→ Keine $ENV_FILE — wird neu erstellt."
fi
echo

# 2. Pro Key prüfen ob da, falls nicht: fragen
NEW_KEYS=()
for key in "${ORDER[@]}"; do
  if [ -n "${EXISTING[$key]:-}" ]; then
    echo "  ✓ $key bereits gesetzt"
  else
    NEW_KEYS+=("$key")
  fi
done

if [ ${#NEW_KEYS[@]} -eq 0 ]; then
  echo
  echo "✓ Alle erforderlichen Variablen vorhanden — keine Änderung nötig."
  exit 0
fi

if [ "$CHECK_ONLY" = "true" ]; then
  echo
  echo "FEHLEND: ${NEW_KEYS[*]}"
  echo "→ Ohne --check würde das Script nach diesen fragen."
  exit 1
fi

echo
echo "${#NEW_KEYS[@]} Variablen fehlen. Werden jetzt abgefragt:"
echo

# 3. Backup
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
  echo "  Backup: ${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
  echo
fi

# 4. Frage pro Key
for key in "${NEW_KEYS[@]}"; do
  desc="${KEYS[$key]}"
  default="${DEFAULTS[$key]:-}"
  prompt="  $key — $desc"
  [ -n "$default" ] && prompt="$prompt [Default: $default]"
  prompt="$prompt: "

  if [[ "$key" == *"PASS"* ]] || [[ "$key" == *"SECRET"* ]]; then
    read -r -s -p "$prompt" value
    echo
  else
    read -r -p "$prompt" value
  fi

  [ -z "$value" ] && value="$default"
  EXISTING[$key]="$value"
done

# 5. .env neu schreiben in der ORDER-Reihenfolge
{
  echo "# DealPilot V43 .env — generiert von setup-env.sh am $(date)"
  echo "# Editieren erlaubt, aber Format beachten: KEY=value (oder KEY=\"value mit spaces\")"
  echo

  for key in "${ORDER[@]}"; do
    val="${EXISTING[$key]:-}"
    # Zusatzkommentar bei kritischen Keys
    case "$key" in
      BETA_SMTP_PORT)
        echo "# Hetzner blockiert outbound 465. Bei timeout: auf 587 wechseln + SECURE=false."
        ;;
      BETA_MAIL_FROM)
        echo "# Format mit Display-Name: \"DealPilot <info@junker-immobilien.io>\" (Anführungszeichen)"
        ;;
      JWT_SECRET)
        echo "# WICHTIG: bei Änderung werden alle aktiven Sessions ungültig!"
        ;;
    esac
    echo "$key=$val"
  done

  # Sonstige existierende Keys die nicht in ORDER stehen, am Ende anhängen
  for key in "${!EXISTING[@]}"; do
    skip=false
    for o in "${ORDER[@]}"; do
      [ "$o" = "$key" ] && { skip=true; break; }
    done
    [ "$skip" = "false" ] && echo "$key=${EXISTING[$key]}"
  done
} > "$ENV_FILE"

chmod 600 "$ENV_FILE"
echo
echo "✓ $ENV_FILE geschrieben (${#EXISTING[@]} Variablen, Modus 600)."
echo
echo "Nächster Schritt:"
echo "  docker compose -f docker-compose.prod.yml up -d --build --force-recreate"
echo
