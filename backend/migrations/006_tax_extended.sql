-- ════════════════════════════════════════════════════
-- JUNKER IMMOBILIEN BACKEND - Migration 006
-- Extends tax_records with detailed Werbungskosten fields
-- Adds tax_bemerkungen table for per-position notes
-- ════════════════════════════════════════════════════

-- Add detailed Werbungskosten columns to tax_records
ALTER TABLE tax_records
  -- 1.0 Finanzierungskosten (detailed)
  ADD COLUMN IF NOT EXISTS kontofuehrung NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bereitstellung NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notar_grundschuld NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vermittlung NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finanz_sonst NUMERIC(14, 2) DEFAULT 0,

  -- 2.0 Betriebskosten (detailed)
  ADD COLUMN IF NOT EXISTS nk_umlf NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nk_n_umlf NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS betr_sonst NUMERIC(14, 2) DEFAULT 0,

  -- 3.0 Verwaltungskosten (detailed)
  ADD COLUMN IF NOT EXISTS hausverwaltung NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS steuerber NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porto NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verw_sonst NUMERIC(14, 2) DEFAULT 0,

  -- 4.0 Sonstige Kosten (detailed)
  ADD COLUMN IF NOT EXISTS fahrtkosten NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verpflegung NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hotel NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inserat NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gericht NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS telefon NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sonst_kosten NUMERIC(14, 2) DEFAULT 0,

  -- 6.0 AfA bewegliche WG + Anschaffungsnah / Erhaltung
  ADD COLUMN IF NOT EXISTS sonst_bewegl_wg NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anschaffungsnah NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS erhaltungsaufwand NUMERIC(14, 2) DEFAULT 0,

  -- 7.0 Einnahmen (detailed)
  ADD COLUMN IF NOT EXISTS einnahmen_km NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS einnahmen_nk NUMERIC(14, 2) DEFAULT 0;

-- ════════════════════════════════════════════════════
-- Bemerkungen pro Steuer-Position pro Jahr pro Objekt
-- ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tax_bemerkungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,

  year INTEGER NOT NULL,
  field VARCHAR(64) NOT NULL,           -- e.g. 'schuldzinsen', 'fahrtkosten'
  bemerkung TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tax_bemerkungen_unique UNIQUE (user_id, object_id, year, field)
);

CREATE INDEX IF NOT EXISTS idx_tax_bemerkungen_user ON tax_bemerkungen(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_bemerkungen_object ON tax_bemerkungen(object_id);
CREATE INDEX IF NOT EXISTS idx_tax_bemerkungen_year ON tax_bemerkungen(year);

DROP TRIGGER IF EXISTS tax_bemerkungen_updated_at ON tax_bemerkungen;
CREATE TRIGGER tax_bemerkungen_updated_at
  BEFORE UPDATE ON tax_bemerkungen
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
