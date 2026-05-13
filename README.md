# DealPilot — Operations & Architecture

**Stand: 13.05.2026** · Wartung: Marcel Junker · info@junker-immobilien.io

## Was ist DealPilot?

SaaS-Web-App für Immobilien-Investmentanalyse. Vanilla JS Frontend + Node/Express Backend + PostgreSQL. Stripe im Test-Mode.

## Hosts & URLs

| Was | URL | Server | Pfad |
|---|---|---|---|
| **Production** | https://dealpilot.junker-immobilien.io | `157.90.117.167` | `/opt/dealpilot` |
| **Staging** | https://staging.dealpilot.junker-immobilien.io | `116.203.214.11` | `/opt/dealpilot` |
| **Repo** | https://github.com/JunkerImmobilien/DealPilot | privat | — |
| **Stripe** | https://dashboard.stripe.com/test/ | Sandbox | — |

## Stack

- **Frontend:** Vanilla JS, von Caddy als statische Files serviert. Volume-mounted → sofort live nach `git pull`
- **Backend:** Node 20 + Express. Code im Docker-Image gebacken → braucht `docker compose build backend` bei Änderung
- **DB:** PostgreSQL 16
- **Reverse Proxy:** Caddy 2-alpine, Let's Encrypt
- **Container:** `dealpilot-backend` · `dealpilot-caddy` · `dealpilot-postgres`

Compose-Project-Name in `.env`:
- Prod: `COMPOSE_PROJECT_NAME=dealpilot-v124`
- Staging: `COMPOSE_PROJECT_NAME=dealpilot-staging`

## Git-Branches

- `main` — Production
- `staging` — Entwicklung/Test

## Standard-Deploy

```bash
# Frontend-Änderung
git pull
# sofort live (volume-mount)

# Backend-Änderung
git pull
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --force-recreate backend

# Migrations
git pull
docker compose -f docker-compose.prod.yml restart backend

# .env-Änderung
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
```

## Stripe (Test-Mode aktiv)

**Test-Karte:** `4242 4242 4242 4242`, 12/30, 123, 32609

**Keys in `.env`:** `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Webhook-Pfad:** `POST /api/v1/webhooks/stripe`

### Stripe-Produkte (Test-Mode, in DB-Tabelle `plans`)

| Plan | Product-ID | Monthly | Yearly |
|---|---|---|---|
| Starter | `prod_UVZEGHdNAurZqc` | `price_1TWYAsKEjyPDo0woEGBhBfKR` | `price_1TWY5lKEjyPDo0woGmRmfCIj` |
| Investor | `prod_UVZG7q4Hcnb81e` | `price_1TWYAdKEjyPDo0wod4nboi5k` | `price_1TWY7WKEjyPDo0wowRN0yUbD` |
| Pro | `prod_UVZG7e1bPNMBgm` | `price_1TWYAIKEjyPDo0woadC7NZOe` | `price_1TWY8JKEjyPDo0woUJZjYdwk` |

### Frontend-Module
- `subscription.js` — `Sub`-Modul (startCheckout, openPortal)
- `pricing-modal.js` — F/S/I/P Stepper
- `settings.js` — Plan-Tab
- `stripe-success.js` (V183) — Auto-Refresh nach Stripe-Redirect

### Backend
- `routes/subscription.js` — POST /checkout, /portal
- `routes/stripeWebhook.js` — Webhook-Handler mit V184 Race-Schutz
- `services/stripeService.js` — Stripe-API-Calls

### V184 Race-Condition-Fix
Stripe schickt `created` (incomplete) + `updated` (active) parallel. Falls `created` zuletzt ankommt würde es Status zurückwerfen → User wird Free. Fix: skip wenn DB schon active.

### V183 Auto-Refresh
Erkennt Stripe-Return über `?subscription=success` ODER `/subscription/success` ODER referrer = stripe.com. Macht `Sub.invalidateCache()` + Toast.

## DB-Wartung

```bash
# Backup
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U dealpilot dealpilot_db | gzip > /root/db-backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Restore
gunzip -c BACKUP.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U dealpilot -d dealpilot_db
```

### Häufige Queries

```sql
-- User-Plan
SELECT u.email, s.plan_id, s.status, s.billing_interval
FROM users u JOIN subscriptions s ON s.user_id=u.id WHERE u.email='...';

-- Webhook-Events
SELECT type, processed_at IS NOT NULL AS ok, received_at
FROM stripe_webhook_events ORDER BY received_at DESC LIMIT 20;

-- Test-User reset auf Free
UPDATE subscriptions SET plan_id='free', status='active', stripe_subscription_id=NULL
WHERE user_id=(SELECT id FROM users WHERE email='...');
```

## Cache-Bumps Frontend

```bash
sed -i 's|FILE\.js?v=[0-9]\+|FILE.js?v=NEUE_NR|g' frontend/index.html
```

## Offene Themen

- Stripe Live-Mode (Account-Verifikation, Live-Produkte, AGB)
- Customer-Portal-Test (`Sub.openPortal()`)
- Plan-Upgrade Starter→Pro mit Proration
- Webhook-Idempotenz-Test

## Lessons Learned 13.05.2026

1. Backend-Code im Docker-Image → `build` nötig, nicht nur `restart`
2. Frontend volume-mounted → sofort live
3. Stripe-Webhooks parallel → Race-Schutz V184
4. `.env`-Änderung braucht `up -d --force-recreate`
5. `COMPOSE_PROJECT_NAME` über ENV → kein Git-Drift
6. Webhook-Secrets pro Endpunkt unterschiedlich
7. Browser-Cache: Strg+Shift+R oder Inkognito beim Testen

