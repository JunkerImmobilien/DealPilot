-- ════════════════════════════════════════════════════
-- DEALPILOT BACKEND - Migration 007
-- V23: Objekt-Sequenznummer (Schema "JJJJ-NNN")
-- Reset pro Jahr, eindeutig pro User
-- ════════════════════════════════════════════════════

ALTER TABLE objects ADD COLUMN IF NOT EXISTS seq_no VARCHAR(12);
CREATE INDEX IF NOT EXISTS idx_objects_user_seq ON objects(user_id, seq_no);

-- Helper-Funktion: nächste Sequenznummer für (user, year) atomar vergeben
-- Gibt einen String "JJJJ-NNN" zurück (3-stellig nullgepadded).
CREATE OR REPLACE FUNCTION get_next_obj_seq(p_user_id UUID, p_year INT)
RETURNS VARCHAR AS $$
DECLARE
  v_max INT;
  v_next INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(seq_no, '-', 2) AS INT)), 0)
    INTO v_max
    FROM objects
   WHERE user_id = p_user_id
     AND seq_no IS NOT NULL
     AND seq_no LIKE p_year::TEXT || '-%';
  v_next := v_max + 1;
  RETURN p_year::TEXT || '-' || LPAD(v_next::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
