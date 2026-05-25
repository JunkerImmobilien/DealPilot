-- ════════════════════════════════════════════════════
-- DEALPILOT BACKEND - Migration 008
-- Tax Snapshots (V278) - persistenter V+V-Snapshot pro Objekt
-- ════════════════════════════════════════════════════
-- Vorher: data.steuer_snapshot JSONB im objects-Datensatz.
--         Problem: UPDATE objects SET data = $1 kann Snapshot
--         versehentlich ueberschreiben (kein Merge auf JS-Seite).
-- Neu:    Eigene Tabelle. Object-Updates ueberschreiben Snapshot nicht.
--         Atomic upsert via ON CONFLICT.

CREATE TABLE IF NOT EXISTS tax_snapshots (
  object_id UUID PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- wk_per_year: { "2025": -1573, "2026": 999, ... } - V+V Ueberschuss/Verlust pro Jahr
  wk_per_year JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Metadata
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(32) DEFAULT 'tax_timeline_render'
);

-- Index fuer schnelles Laden aller Snapshots eines Users
CREATE INDEX IF NOT EXISTS idx_tax_snapshots_user ON tax_snapshots(user_id);

-- Auto-Update updated_at bei UPDATE
CREATE OR REPLACE FUNCTION update_tax_snapshots_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tax_snapshots_updated_at ON tax_snapshots;
CREATE TRIGGER trg_tax_snapshots_updated_at
  BEFORE UPDATE ON tax_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_tax_snapshots_timestamp();

-- Backfill: bestehende data.steuer_snapshot Werte in neue Tabelle uebertragen
INSERT INTO tax_snapshots (object_id, user_id, wk_per_year, source)
SELECT
  id,
  user_id,
  COALESCE(data->'steuer_snapshot'->'wk_per_year', '{}'::jsonb),
  'backfill_v278'
FROM objects
WHERE data ? 'steuer_snapshot' AND data->'steuer_snapshot' ? 'wk_per_year'
ON CONFLICT (object_id) DO NOTHING;
