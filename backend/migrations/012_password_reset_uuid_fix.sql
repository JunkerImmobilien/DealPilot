-- V63.66 Migration: Repair password_reset_tokens.user_id type
-- ─────────────────────────────────────────────────────────────────────
-- Hintergrund: Migration 009_password_reset.sql definierte user_id als
-- INTEGER, aber users.id ist UUID. Auf neuen Installationen ist die
-- Migration entweder fehlgeschlagen ODER die Tabelle ist falsch typisiert.
--
-- Diese Migration ist idempotent und behandelt 3 Fälle:
--   A) Tabelle existiert nicht → erstellen mit korrektem UUID-Typ
--   B) Tabelle existiert mit INTEGER → droppen + neu erstellen (Tokens sind kurzlebig, Verlust ok)
--   C) Tabelle existiert mit UUID → nichts tun
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  current_type TEXT;
BEGIN
  -- Prüfe ob Tabelle existiert und welchen Typ user_id hat
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_name = 'password_reset_tokens'
    AND column_name = 'user_id';

  IF current_type IS NULL THEN
    -- Fall A: Tabelle existiert nicht (Migration 009 nie gelaufen oder gefailt)
    RAISE NOTICE 'password_reset_tokens existiert nicht — wird mit UUID erstellt';
    CREATE TABLE password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(128) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX idx_pw_reset_token ON password_reset_tokens(token);
    CREATE INDEX idx_pw_reset_user  ON password_reset_tokens(user_id);
  ELSIF current_type = 'integer' THEN
    -- Fall B: Tabelle existiert mit falschem Typ INTEGER → neu aufbauen
    -- Reset-Tokens sind kurzlebig (1h gültig) — Verlust unkritisch
    RAISE NOTICE 'password_reset_tokens hat user_id INTEGER — wird auf UUID umgebaut';
    DROP TABLE password_reset_tokens CASCADE;
    CREATE TABLE password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(128) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX idx_pw_reset_token ON password_reset_tokens(token);
    CREATE INDEX idx_pw_reset_user  ON password_reset_tokens(user_id);
  ELSE
    RAISE NOTICE 'password_reset_tokens.user_id ist bereits %, kein Update nötig', current_type;
  END IF;
END $$;

-- Cleanup-Helper sicherstellen (idempotent)
CREATE OR REPLACE FUNCTION cleanup_expired_password_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
