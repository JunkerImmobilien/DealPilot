-- 034 provider credentials
-- Per-User externe Anbieter-Zugaenge (z.B. ImmoMetrica). Key AES-256-GCM verschluesselt.
-- Idempotent (CREATE TABLE IF NOT EXISTS). users.id = UUID (gen_random_uuid).

CREATE TABLE IF NOT EXISTS user_provider_credentials (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  hint       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);
