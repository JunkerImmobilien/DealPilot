-- ═══════════════════════════════════════════════════════════════
-- DealPilot V51 — Migration 010: DS2-Felder + Qualität-Sterne
--
-- Fügt die Investor-Score-2.0-spezifischen Felder zur objects-Tabelle
-- hinzu, sodass sie im API-Mode persistiert werden.
--
-- Idempotent: kann beliebig oft ausgeführt werden, ändert nichts wenn
-- die Spalten schon da sind.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE objects
  ADD COLUMN IF NOT EXISTS ds2_zustand        TEXT,
  ADD COLUMN IF NOT EXISTS ds2_energie        TEXT,
  ADD COLUMN IF NOT EXISTS ds2_bevoelkerung   TEXT,
  ADD COLUMN IF NOT EXISTS ds2_nachfrage      TEXT,
  ADD COLUMN IF NOT EXISTS ds2_wertsteigerung TEXT,
  ADD COLUMN IF NOT EXISTS ds2_entwicklung    TEXT,
  ADD COLUMN IF NOT EXISTS ds2_marktmiete     NUMERIC,
  ADD COLUMN IF NOT EXISTS ds2_mietausfall    TEXT,
  ADD COLUMN IF NOT EXISTS ds2_marktfaktor    NUMERIC;

-- Qualität & Zustand (Sterne-Bewertung pro Bereich + Aggregat)
ALTER TABLE objects
  ADD COLUMN IF NOT EXISTS rate_kueche INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_bad    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_boden  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qz_stars    INTEGER DEFAULT 0;

-- Neue Lage-Felder für DS2-AI
ALTER TABLE objects
  ADD COLUMN IF NOT EXISTS energieklasse TEXT,
  ADD COLUMN IF NOT EXISTS zust_woh      TEXT,
  ADD COLUMN IF NOT EXISTS loc_bev       TEXT,
  ADD COLUMN IF NOT EXISTS loc_nach      TEXT,
  ADD COLUMN IF NOT EXISTS loc_wert      TEXT,
  ADD COLUMN IF NOT EXISTS loc_entw      TEXT;
