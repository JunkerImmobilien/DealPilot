-- V42 Migration: Password-Reset-Tokens
-- Speichert one-time-use Tokens für Passwort-Reset, gültig 1h
-- V63.66 BUGFIX: user_id war INTEGER, aber users.id ist UUID (siehe 001_init.sql).
-- Auf neuen Installationen schlug die Migration fehl. Korrigiert auf UUID.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pw_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_pw_reset_user ON password_reset_tokens(user_id);

-- Cleanup-Helper: alle abgelaufenen Tokens löschen (Cron-Job kann das täglich aufrufen)
CREATE OR REPLACE FUNCTION cleanup_expired_password_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
