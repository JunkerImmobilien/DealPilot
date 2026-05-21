-- V259-01: Steuerzeitraum-Tabelle
-- Migration 025: tax_periods fuer verlaufsbasierte zvE-Logik

CREATE TABLE IF NOT EXISTS tax_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    zve INTEGER NOT NULL CHECK (zve >= 0),
    reason VARCHAR(100),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_periods_user_date
  ON tax_periods (user_id, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_tax_periods_user
  ON tax_periods (user_id);

-- Trigger fuer updated_at (idempotent)
CREATE OR REPLACE FUNCTION update_tax_periods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tax_periods_updated_at ON tax_periods;
CREATE TRIGGER tax_periods_updated_at
  BEFORE UPDATE ON tax_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_tax_periods_updated_at();

-- Constraint: valid_to muss nach valid_from sein
ALTER TABLE tax_periods
  DROP CONSTRAINT IF EXISTS tax_periods_date_check;
ALTER TABLE tax_periods
  ADD CONSTRAINT tax_periods_date_check
  CHECK (valid_to IS NULL OR valid_to >= valid_from);

-- Hinweis: Ueberschneidungen werden in der Backend-Logik geprueft,
-- nicht als DB-Constraint (zu komplex fuer Exclusion-Constraints).
