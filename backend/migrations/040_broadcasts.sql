-- ════════════════════════════════════════════════════
-- DEALPILOT BACKEND - Migration 040
-- Massenmail-Versand (Broadcast): Audit-Log was wann an wie viele ging.
-- Zwei Modi: 'newsletter' (nur Opt-ins) | 'operational' (alle aktiven, nur Betrieb/Wartung).
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_label VARCHAR(120),
  mode VARCHAR(20),                     -- 'newsletter' | 'operational'
  subject VARCHAR(255),
  body_html TEXT,
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',   -- draft | sending | done | failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC);
