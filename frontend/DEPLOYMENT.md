# DealPilot — Deployment-Hinweise

Diese Datei beschreibt, wie DealPilot auf einen eigenen Server deployt wird.
Die App besteht aus drei Teilen:

1. **Frontend** — statische Files (HTML/CSS/JS) im Verzeichnis `frontend/`
2. **Backend** — Node.js + Express + Postgres im Verzeichnis `backend/`
3. **Datenbank** — PostgreSQL (per Docker oder nativ)

---

## 1. Architektur-Trennung

| Komponente | Pfad | Aufgabe |
|---|---|---|
| Frontend | `frontend/` | Statische Auslieferung (Caddy / Nginx / serve) |
| Backend  | `backend/`  | REST-API, Auth, DB, Stripe, KI-Proxy |
| DB       | `backend/migrations/` | SQL-Schema-Versionierung |
| Konfig   | `backend/.env` | Geheime Werte — **niemals committen** |

Frontend und Backend können auf demselben Host laufen (Reverse-Proxy) oder getrennt.

---

## 2. Environment Variables

Kopiere `backend/.env.example` nach `backend/.env` und fülle die Werte:

```bash
cp backend/.env.example backend/.env
```

Wichtigste Variablen:

| Variable | Bedeutung |
|---|---|
| `DATABASE_URL`         | Postgres-Connection-String |
| `JWT_SECRET`           | 64-stelliger Hex-String — **immer ändern** |
| `CORS_ORIGINS`         | Komma-Liste erlaubter Frontend-Domains |
| `FRONTEND_BASE_URL`    | Wird für Stripe-Redirects und E-Mail-Links benutzt |
| `UPLOAD_DIR`           | Pfad für User-Uploads (Logos), absolut in Prod |
| `OPENAI_API_KEY`       | Optional — wenn gesetzt, läuft KI über Server statt Client |
| `STRIPE_*`             | Für Plan-Abos (optional) |

> **Hinweis Uploads:** Stelle sicher, dass `UPLOAD_DIR` ein **persistentes Volume** ist (Docker-Volume oder gemounteter Disk-Bereich). Beim Container-Rebuild dürfen die Dateien nicht verloren gehen.

---

## 3. Docker-Compose-Setup

Der mitgelieferte `backend/docker-compose.yml` startet:
- Postgres (mit benanntem Volume)
- Backend-Container
- Optional: pgweb für DB-Browsing

```bash
cd backend
docker compose up -d --build
```

Frontend separat:

```bash
cd frontend
npx serve -l 8080      # Dev
# oder Caddy/Nginx vor das Verzeichnis hängen für Produktion
```

---

## 4. Reverse-Proxy (Beispiel Caddy)

Schlankste Lösung mit automatischem HTTPS:

```caddyfile
dealpilot.example.com {
  # API
  handle /api/* {
    reverse_proxy backend:3001
  }
  # Frontend (statische Files)
  handle {
    root * /var/www/dealpilot
    try_files {path} /index.html
    file_server
  }
}
```

---

## 5. Pricing & Usage serverseitig

Die aktuelle Free-Plan-Logik liegt **client-seitig** (`localStorage`).
Für Server-Mode siehst du im `backend/src/services/`:

- `subscription` (Plan-Status pro User)
- `usage`-Tabelle (planmäßig — Migration vorzubereiten)

Architektur-Idee:
- Client ruft `/api/v1/subscription/me` → bekommt aktiven Plan + verbleibende Limits
- Vor jeder kostenpflichtigen Aktion: `/api/v1/usage/check` (DB-Lookup)
- Stripe-Webhook → updated `subscriptions`-Tabelle

---

## 6. KI-Analyse über Backend (optional)

Heute: Client hält OpenAI-Key in localStorage und ruft OpenAI direkt.
Empfehlung Produktion:

1. `OPENAI_API_KEY` im Server hinterlegen
2. Endpoint `POST /api/v1/ai/analyze` anlegen — Server schickt Request
3. Frontend ruft nur `/api/v1/ai/analyze` mit Calc-Payload
4. Vorteil: Key niemals im Browser, zentrales Rate-Limiting möglich

---

## 7. Auth-Konzept

JWT-basiert, Backend stellt Token bei Login aus, Frontend speichert in localStorage.
Migrationen 001–006 enthalten:
- `users`
- `objects`
- `subscriptions`
- `email_tokens` (für Verifikation/Reset)
- `tax_records` + `tax_bemerkungen`

---

## 8. Backups

```bash
docker exec <db-container> pg_dump -U dealpilot dealpilot_db > backup_$(date +%F).sql
```

Empfohlen: täglich automatisiert per Cron + Off-Site-Storage.

---

## 9. Health-Checks

Backend stellt `/api/v1/health` bereit — stündlich pingen, Alarm bei 5xx.

---

## 10. Versionierung

Beim Update:
1. DB-Backup
2. `docker compose down`
3. Code-Update (ZIP entpacken oder git pull)
4. `.env` zurückkopieren / migrieren
5. `docker compose up -d --build`
6. Migrations laufen automatisch beim Backend-Start
