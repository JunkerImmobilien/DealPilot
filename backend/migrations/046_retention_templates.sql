-- 046_retention_templates.sql — Kundenbindung-Vorlagen + Hintergrund (v802)

-- Eigene Vorlagen-Bibliothek fuer Kundenbindung (getrennt von mail_layouts/Massenmail).
CREATE TABLE IF NOT EXISTS retention_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  kind        VARCHAR(20) NOT NULL DEFAULT 'expiry',  -- 'expiry' | 'inactive' | 'any'
  subject     TEXT,
  body_html   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_retention_templates_kind ON retention_templates(kind, created_at DESC);

-- Hintergrund-/Rahmen-Vorlage (singleton id=1). HTML mit {{BODY}}-Platzhalter,
-- in den der eigentliche Mailtext eingesetzt wird. Optional; leer = mailLayout.wrap Standard.
CREATE TABLE IF NOT EXISTS retention_background (
  id          INT PRIMARY KEY DEFAULT 1,
  html        TEXT,
  name        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT retention_background_singleton CHECK (id = 1)
);
INSERT INTO retention_background (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
