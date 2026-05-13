# Junker Immobilien Backend

Node.js + Express + PostgreSQL backend mit Multi-User-Auth, Subscriptions (Stripe), Plan-Limits.

## Features

- **REST API** mit JWT-Auth und bcrypt-Passwort-Hashing
- **PostgreSQL** mit versionierten Migrations (auto-update-fähig)
- **Multi-User** mit Admin/User-Rollen
- **Subscriptions** über Stripe (Free/Pro/Business/Enterprise, monatlich/jährlich)
- **Plan-Limits** mit Usage-Counter (KI-Analysen, PDF-Exporte, Objekte)
- **Webhooks** mit Idempotenz und Audit-Log
- **Rate Limiting** für Brute-Force-Schutz
- **Docker-ready** mit docker-compose

## Quick Start (Docker)

```bash
cd backend
cp .env.example .env

# JWT-Secret generieren und in .env eintragen:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Server starten (PostgreSQL + Backend)
docker compose up -d

# Verify
curl http://localhost:3001/health
```

Migrations laufen automatisch beim Start. Daten werden in einem Docker-Volume persistiert (überleben `docker compose down`).

Für Stripe-Setup siehe Abschnitt unten.

---

## API Endpoints

Base URL: `http://localhost:3001/api/v1`

### Auth
| Method | Path | Beschreibung |
|---|---|---|
| POST | `/auth/register` | Neuen User registrieren (erster wird Admin) |
| POST | `/auth/login` | Einloggen, gibt JWT zurück |
| GET | `/auth/me` | Aktueller User (auth required) |
| POST | `/auth/change-password` | Passwort ändern |
| POST | `/auth/logout` | Logout |

### Plans
| Method | Path | Beschreibung |
|---|---|---|
| GET | `/plans` | Öffentliche Pläne (für Pricing-Page) |
| GET | `/plans/all` | Alle Pläne (admin) |

### Subscription
| Method | Path | Beschreibung |
|---|---|---|
| GET | `/subscription` | Aktueller Plan + Limits + Usage |
| POST | `/subscription/checkout` | Stripe-Checkout starten |
| POST | `/subscription/portal` | Stripe Customer Portal öffnen |

### Objects
| Method | Path | Beschreibung |
|---|---|---|
| GET | `/objects` | Liste eigener Objekte |
| GET | `/objects/:id` | Einzelnes Objekt mit Daten + Fotos |
| POST | `/objects` | Neues Objekt (Plan-Limit gilt) |
| PUT | `/objects/:id` | Objekt updaten |
| DELETE | `/objects/:id` | Objekt löschen |
| POST | `/objects/track-usage` | Usage tracken (`ai_analysis`, `pdf_export`) |

### Users (admin only)
| Method | Path | Beschreibung |
|---|---|---|
| GET | `/users` | Alle User auflisten |
| PATCH | `/users/:id/active` | User aktivieren/deaktivieren |
| PATCH | `/users/:id/role` | Rolle ändern |
| DELETE | `/users/:id` | User löschen |

### Webhooks
| Method | Path | Beschreibung |
|---|---|---|
| POST | `/webhooks/stripe` | Stripe-Events (signature-verified, idempotent) |

---

## Stripe-Setup

So aktivierst du die Bezahl-Funktion (alles im [Stripe Dashboard](https://dashboard.stripe.com)):

### 1. Stripe-Account erstellen

Auf [stripe.com](https://stripe.com) registrieren. Für DE: deutsche Geschäftsadresse + Steuernummer eintragen.

### 2. API-Keys holen

Dashboard → "Entwickler" → "API-Schlüssel":
- **Geheimer Schlüssel** (`sk_test_...` für Testmodus, `sk_live_...` produktiv)
- **Veröffentlichbarer Schlüssel** (`pk_test_...`)

In `.env` eintragen:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Products und Prices anlegen

Pro Plan (Pro, Business, Enterprise — Free braucht keinen) im Dashboard → "Produktkatalog":

**Produkt 1: Pro**
- Name: "Junker Pro"
- Preis hinzufügen → "Wiederkehrend" → 29 € / Monat → Preis-ID kopieren (`price_xxx_monthly`)
- Preis hinzufügen → "Wiederkehrend" → 290 € / Jahr → Preis-ID kopieren (`price_xxx_yearly`)

Selbiges für **Business** (79 € / 790 €) und **Enterprise** (299 € / 2990 € — oder „Custom" lassen).

### 4. Price-IDs in die DB eintragen

Du hast 6 Stripe-Price-IDs. Diese verknüpfst du in der `plans`-Tabelle:

```sql
UPDATE plans SET
  stripe_product_id = 'prod_XYZ',
  stripe_price_monthly_id = 'price_XYZ_monthly',
  stripe_price_yearly_id = 'price_XYZ_yearly'
WHERE id = 'pro';

-- gleiches für business + enterprise
```

Oder über `psql`:
```bash
docker compose exec postgres psql -U junker -d junker_db
```

### 5. Webhook einrichten

Stripe schickt Events (z.B. `subscription.created`, `subscription.updated`) an deinen Server. Damit wir Subscriptions korrekt synchronisieren:

1. Im Stripe-Dashboard → "Entwickler" → "Webhooks" → "Endpoint hinzufügen"
2. URL eingeben: `https://deine-domain.de/api/v1/webhooks/stripe`
3. Events auswählen (oder "alle Events" für den Anfang):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Nach Erstellen → "Signing Secret" anzeigen und in `.env` eintragen:
```
STRIPE_WEBHOOK_SECRET=whsec_...
```

5. Backend neu starten: `docker compose restart backend`

### 6. Lokal testen mit Stripe CLI

Für lokale Entwicklung kann der echte Webhook nicht zu `localhost` durchkommen. Lösung: [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe login
stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
```

Das gibt dir ein temporäres Webhook-Secret, das du in `.env` einträgst (während du testest).

---

## Datenbank-Schema (auto-update-fähig)

Migrations liegen in `migrations/` und werden beim Start ausgeführt. Die `schema_migrations`-Tabelle merkt sich was schon angewendet ist — jede Datei läuft nur einmal.

**Aktuelle Migrations:**
- `001_init.sql` — Users + Migrations-Tracking
- `002_objects.sql` — Kalkulationsobjekte (JSONB) + Audit-Log
- `003_subscriptions.sql` — Plans + Subscriptions + Stripe-Customers + Usage
- `004_email_tokens.sql` — Tokens für Email-Verify und Passwort-Reset

**Neue Migration anlegen:**
1. Datei `migrations/005_meine_aenderung.sql` erstellen
2. SQL-Statements rein
3. `docker compose up -d --build` — Migration läuft automatisch beim Start

**Manuelle Migration:**
```bash
docker compose exec backend npm run migrate
```

---

## Update-Strategie (für später)

Wenn du Code-Updates deployen willst:
```bash
git pull
docker compose up -d --build
```

Daten bleiben erhalten (Volume), neue Migrations laufen, alter Container wird ersetzt.

---

## Environment-Variablen

Siehe `.env.example` für die komplette Liste. Wichtige:

| Variable | Beschreibung | Pflicht? |
|---|---|---|
| `JWT_SECRET` | Secret für Token-Signierung (64 Zeichen) | ✓ |
| `DATABASE_URL` | PostgreSQL-Verbindung | ✓ |
| `CORS_ORIGINS` | Komma-getrennte erlaubte Origins | ✓ |
| `FRONTEND_BASE_URL` | URL der Web-App (für Stripe-Redirects) | ✓ |
| `STRIPE_SECRET_KEY` | Stripe-API-Key | nur für Abos |
| `STRIPE_WEBHOOK_SECRET` | Webhook-Signing-Secret | nur für Abos |
| `BCRYPT_ROUNDS` | Cost-Faktor (default 11) | nein |

---

## Deployment

### Hetzner / VPS mit Docker
```bash
git clone <repo> && cd junker-backend
cp .env.example .env  # Werte eintragen!
docker compose up -d
# Reverse-Proxy (Caddy/Nginx) für HTTPS davorschalten
```

### Render / Railway / Fly.io
Connect Repository, ENV-Vars setzen, Service deployt automatisch. PostgreSQL als Add-on dazubuchen oder externe DB (Supabase, Neon).

### Automatic Migrations
Sind in `docker-compose.yml` als `command` so konfiguriert, dass beim Container-Start zuerst Migrations laufen, dann der Server. Bei Cloud-Deploys ohne docker-compose: Migrations einmal in der Build/Deploy-Phase aufrufen mit `npm run migrate`.

---

## Architektur-Notizen

**Warum JSONB für `objects.data`?**
Du kannst neue Kalkulationsfelder im Frontend hinzufügen ohne das DB-Schema zu ändern. Indexable Summary-Felder (kaufpreis, bmy, cf_ns, dscr) sind als separate Spalten ausgelagert für schnelle Listen-Queries.

**Warum kein DB-Eintrag für Free-User?**
Wer keine Subscription-Row hat, ist auf Free. Spart Schreibvorgänge bei Registrierung und ist robust falls Subscriptions mal verloren gehen.

**Warum Webhook-Idempotenz-Tabelle?**
Stripe sendet Events teilweise mehrfach (bei Netzwerkproblemen). Die `stripe_webhook_events`-Tabelle merkt sich, was schon verarbeitet wurde — ein Event löst die Logik nur einmal aus.

**Plan-Limits sind in Code UND DB:**
- DB enthält die Limit-Zahlen (in `plans`-Tabelle, anpassbar pro Plan)
- Code prüft die Limits vor dem Ausführen einer Aktion
- Usage wird in `usage_counters` gezählt (year+month+metric+user)

---

## Lizenz
Proprietär — Junker Immobilien
