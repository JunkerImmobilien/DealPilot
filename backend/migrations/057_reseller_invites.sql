-- ============================================================
-- Migration 057 · Mandanten-Einladungen (reseller_invites)
-- ------------------------------------------------------------
-- Einladung per E-Mail: der Partner lädt einen Mandanten ein,
-- dieser legt über den Link selbst ein Konto an. Erst bei Annahme
-- entsteht ein reseller_clients-Eintrag (user_id ist dort NOT NULL).
-- Idempotent.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS reseller_invites (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reseller_id   uuid NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
    email         text NOT NULL,
    display_name  text NOT NULL,
    token         text NOT NULL UNIQUE,
    status        text NOT NULL DEFAULT 'pending',   -- pending | accepted | revoked
    client_id     uuid REFERENCES reseller_clients(id) ON DELETE SET NULL,
    invited_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    invited_at    timestamptz NOT NULL DEFAULT now(),
    accepted_at   timestamptz,
    expires_at    timestamptz NOT NULL DEFAULT (now() + interval '21 days')
);
CREATE INDEX IF NOT EXISTS idx_invites_reseller ON reseller_invites (reseller_id, status);
CREATE INDEX IF NOT EXISTS idx_invites_token    ON reseller_invites (token);

COMMIT;

-- ROLLBACK: DROP TABLE IF EXISTS reseller_invites;
