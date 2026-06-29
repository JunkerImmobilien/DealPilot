-- 047_api_keys.sql — DealPilot API-Keys (mand v807)
-- Additiv: nur neue Tabelle. Code-Rollback braucht kein DB-Restore.

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'DealPilot API',
  key_prefix   TEXT NOT NULL,                 -- sichtbarer Anfang, z.B. dpk_live_ab12cd
  key_hash     TEXT NOT NULL UNIQUE,          -- sha256 des vollen Keys (Klartext wird nie gespeichert)
  scopes       TEXT NOT NULL DEFAULT 'crud',  -- volle CRUD (Lesen/Schreiben/Loeschen)
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,                   -- NULL = unbegrenzt
  revoked_at   TIMESTAMPTZ,                   -- gesetzt = widerrufen
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
