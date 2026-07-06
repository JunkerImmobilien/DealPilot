-- ============================================================================
-- DealPilot Migration 052 (v856) — Netzwerk: Logo-BG, Bild-Deckkraft,
-- Pro-Einreichung (Freigabe-Workflow). Additiv, kein Rollback noetig.
-- ============================================================================

ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS logo_bg               TEXT;
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS hintergrund_deckkraft INTEGER NOT NULL DEFAULT 85;
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS status                TEXT NOT NULL DEFAULT 'aktiv';
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS wunsch_kategorie      TEXT;
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS eingereicht_von       INTEGER;
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS eingereicht_email     TEXT;

CREATE INDEX IF NOT EXISTS idx_network_cards_status ON network_cards (status);
