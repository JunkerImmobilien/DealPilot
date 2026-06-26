-- ════════════════════════════════════════════════════
-- DEALPILOT BACKEND - Migration 041
-- Abo-Lifecycle: automatische Erinnerung / Downgrade / Lösch-Warnung / Soft-Delete / Hard-Delete.
-- WICHTIG: enabled = false ausgeliefert -> der Job läuft als Dry-Run (protokolliert, tut nichts),
--          bis er im Admin ("Kundenbindung") bewusst eingeschaltet wird.
-- Fristen sind Admin-editierbar (keine hartcodierten Werte).
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lifecycle_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false,
  days_reminder    INTEGER NOT NULL DEFAULT 2,    -- T-2 vor Periodenende: Erinnerung (nur wer kündigt)
  days_warn_delete INTEGER NOT NULL DEFAULT 83,   -- nach Periodenende: Lösch-Warnung + Gutschein
  days_soft_delete INTEGER NOT NULL DEFAULT 90,   -- Konto deaktivieren (markieren)
  days_hard_delete INTEGER NOT NULL DEFAULT 97,   -- endgültig löschen
  coupon_percent   INTEGER NOT NULL DEFAULT 10,
  coupon_days      INTEGER NOT NULL DEFAULT 14,
  CONSTRAINT lifecycle_config_singleton CHECK (id = 1)
);
INSERT INTO lifecycle_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stage VARCHAR(40) NOT NULL,   -- reminder | downgrade | warn_delete | soft_delete | hard_delete
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, stage)       -- Idempotenz: jede Stufe genau 1x pro User
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_created ON lifecycle_events(created_at DESC);
