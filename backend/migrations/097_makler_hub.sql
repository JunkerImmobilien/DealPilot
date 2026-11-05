-- 097_makler_hub.sql  ·  v3190
--
-- MAKLER-HUB × DEALPILOT: Anmeldung mit dem DealPilot-Konto (OAuth 2.0 Authorization Code mit PKCE).
-- Vertrag: Dateien/Makler-Hub/Anmeldung-Schnittstelle.md (Stand 04.11.2026).
-- Marcel 05.11.2026: der Makler-Hub läuft vorerst UNTER dem Partner-Paket (gleicher Preis, gleiche Platzzahl,
-- Standardkontingent für Partner). Partnertypen (Makler, Steuerberater, Finanzierer, Sonstige) folgen.
--
-- Abgrenzbarkeit: alle Hub-Daten liegen in eigenen Tabellen mit Präfix hub_ und hängen nur über user_id an
-- DealPilot. Zieht der Hub später auf einen eigenen Server, bleibt DealPilot der Anmelde-/Abo-Dienst; diese
-- drei Tabellen bleiben hier, der Hub hält seine Firmen und Mitarbeiter ohnehin in seiner eigenen Datenbank.
--
--   hub_codes         Einmal-Codes (60 s), nur als SHA-256 gespeichert, gebunden an Nutzer, Client, Redirect, PKCE
--   hub_verbindungen  je Nutzer und Client höchstens eine aktive Verbindung; hub_token nur als SHA-256
--   hub_protokoll     jede Verbindung, jeder Token-Tausch, jedes Trennen (Konto, Zeit, IP) - für Sicherheit und Abrechnung

CREATE TABLE IF NOT EXISTS hub_codes (
  id              BIGSERIAL PRIMARY KEY,
  code_hash       TEXT NOT NULL UNIQUE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id       TEXT NOT NULL,
  redirect_uri    TEXT NOT NULL,
  code_challenge  TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hub_codes_ablauf ON hub_codes (expires_at);

CREATE TABLE IF NOT EXISTS hub_verbindungen (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id       TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  api_key_id      UUID NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ NULL,
  revoked_at      TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS hub_verbindungen_aktiv ON hub_verbindungen (user_id, client_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS hub_protokoll (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NULL,
  client_id       TEXT,
  art             TEXT NOT NULL,          -- code | token | token_fehler | konto | getrennt | webhook
  ip              TEXT,
  detail          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hub_protokoll_nutzer ON hub_protokoll (user_id, created_at DESC);

-- Der Partner enthält den Makler-Hub (Feature-Flag, damit kein Code eine Planliste führt)
UPDATE plans SET features = COALESCE(features, '{}'::jsonb) || '{"makler_hub": true}'::jsonb WHERE id = 'partner';
