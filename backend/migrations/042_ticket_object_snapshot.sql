-- ════════════════════════════════════════════════════
-- DEALPILOT BACKEND - Migration 042
-- Support-Ticket: JSON-Snapshot des angehaengten Nutzer-Objekts (zum Debuggen).
-- Additiv: nur eine neue Spalte, kein Datenverlust.
-- ════════════════════════════════════════════════════
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS object_snapshot JSONB;
