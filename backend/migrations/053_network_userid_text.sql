-- ============================================================================
-- DealPilot Migration 053 (v858) — Netzwerk: User-Referenzen auf TEXT
-- BUGFIX: users.id ist UUID/Text — INTEGER-Spalten liessen Lead-/Einreichungs-
-- Inserts mit "invalid input syntax for type integer" scheitern (500).
-- Verlustfrei (USING ::text). Additiv/kompatibel, kein Rollback noetig.
-- ============================================================================
ALTER TABLE network_leads ALTER COLUMN user_id         TYPE TEXT USING user_id::text;
ALTER TABLE network_cards ALTER COLUMN eingereicht_von TYPE TEXT USING eingereicht_von::text;
