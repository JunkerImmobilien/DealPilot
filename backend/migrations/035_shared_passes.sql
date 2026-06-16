-- 035_shared_passes.sql  ·  Quick Boarding Shared Pass  (marker: qb-shared-pass)
-- Additiv: nur eine neue Tabelle. Code-Rollback braucht KEIN DB-Restore.
CREATE TABLE IF NOT EXISTS shared_passes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          varchar(16) NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_id     uuid REFERENCES objects(id) ON DELETE SET NULL,
  title         varchar(255),
  snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,
  view_count    integer NOT NULL DEFAULT 0,
  claim_count   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz
);
-- code hat durch UNIQUE bereits einen Index. Zusaetzlich fuer Owner-Liste + Cleanup:
CREATE INDEX IF NOT EXISTS idx_shared_passes_owner   ON shared_passes(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_passes_expires ON shared_passes(expires_at);
