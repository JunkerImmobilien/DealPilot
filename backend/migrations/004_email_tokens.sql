-- ════════════════════════════════════════════════════
-- JUNKER IMMOBILIEN BACKEND - Migration 004
-- Email verification & password reset infrastructure
-- (Schema only - sending logic to be added when email provider is configured)
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,                     -- 'verify_email' | 'password_reset'
  token_hash VARCHAR(128) NOT NULL UNIQUE,       -- SHA-256 of the actual token
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_tokens_type_check CHECK (type IN ('verify_email', 'password_reset'))
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_user_type ON email_tokens(user_id, type);
CREATE INDEX IF NOT EXISTS idx_email_tokens_expires ON email_tokens(expires_at);
