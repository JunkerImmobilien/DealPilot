-- ═══════════════════════════════════════════════════════════════
-- V63.80: 2FA (TOTP) + Recovery-Codes
-- ═══════════════════════════════════════════════════════════════
-- Idempotent: kann mehrfach gelaufen werden (IF NOT EXISTS).
-- Kompatibel zu Postgres 12+.
-- ═══════════════════════════════════════════════════════════════

-- TOTP-Secret (Base32) + aktiv-Flag pro User.
-- totp_secret bleibt nach Disable bestehen, falls User reaktivieren will,
-- wird aber im /auth/2fa/disable explizit auf NULL gesetzt.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret    TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_setup_at  TIMESTAMPTZ;

-- Recovery-Codes — gehasht gespeichert (bcrypt), einmalig nutzbar.
-- Beim Generieren von neuen Codes werden alle alten Codes gelöscht.
CREATE TABLE IF NOT EXISTS user_recovery_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_recovery_codes_user_id
  ON user_recovery_codes(user_id);

-- Pre-Auth-Token-Tabelle: Wenn User Login mit Passwort schafft aber 2FA
-- noch verifiziert werden muss, bekommt er einen kurzlebigen Pre-Auth-Token,
-- der nur für /auth/2fa/verify-login gilt. Verfällt nach 5 Min.
CREATE TABLE IF NOT EXISTS auth_pre_tokens (
  token       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_pre_tokens_expires
  ON auth_pre_tokens(expires_at);
