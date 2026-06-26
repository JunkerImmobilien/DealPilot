-- ════════════════════════════════════════════════════
-- DEALPILOT BACKEND - Migration 037
-- E-Mail-Wechsel (verify-before-active): neue Adresse erst nach
-- Klick auf den Bestätigungslink aktiv. Alte Adresse bleibt bis dahin gültig.
-- Eigene Tabelle, da email_tokens (Mig 004) keinen Platz für die neue Adresse hat
-- und einen CHECK-Constraint nur auf 'verify_email'|'password_reset' besitzt.
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,   -- SHA-256 des Klartext-Tokens
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_change_user ON email_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_email_change_expires ON email_change_requests(expires_at);
