-- ════════════════════════════════════════════════════
-- JUNKER IMMOBILIEN BACKEND - Migration 005
-- Tax records: persistent yearly tax calculations per object
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tax_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,

  year INTEGER NOT NULL,                          -- Calendar year (e.g., 2026)

  -- Inputs
  base_income NUMERIC(14, 2) NOT NULL,            -- zvE without immo
  marginal_tax_rate NUMERIC(5, 4),                -- Grenzsteuersatz used (decimal: 0.42 = 42%)

  -- Income side (V+V)
  einnahmen_vv NUMERIC(14, 2) NOT NULL DEFAULT 0, -- Net rent yearly
  schuldzinsen NUMERIC(14, 2) NOT NULL DEFAULT 0,
  bewirtschaftung NUMERIC(14, 2) NOT NULL DEFAULT 0,
  afa NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sanierung_erhaltungsaufwand NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sonstige_werbungskosten NUMERIC(14, 2) NOT NULL DEFAULT 0,

  -- Result
  immo_result NUMERIC(14, 2) NOT NULL DEFAULT 0,  -- Überschuss (>0) oder Verlust (<0)
  tax_before NUMERIC(14, 2),                      -- Steuer ohne Immo
  tax_after NUMERIC(14, 2),                       -- Steuer mit Immo
  tax_delta NUMERIC(14, 2),                       -- Differenz (positiv = Nachzahlung)
  refund NUMERIC(14, 2),                          -- Erstattung (positiv = Geld zurück)

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tax_records_unique UNIQUE (user_id, object_id, year)
);

CREATE INDEX IF NOT EXISTS idx_tax_records_user ON tax_records(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_records_object ON tax_records(object_id);
CREATE INDEX IF NOT EXISTS idx_tax_records_year ON tax_records(year);

DROP TRIGGER IF EXISTS tax_records_updated_at ON tax_records;
CREATE TRIGGER tax_records_updated_at
  BEFORE UPDATE ON tax_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
