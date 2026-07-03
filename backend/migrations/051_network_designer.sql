-- ============================================================================
-- DealPilot Migration 051 (v855) — Netzwerk: freie Kategorien + Karten-Designer-Ausbau
-- Additive Spalten + neue Tabelle + Constraint-Entfernung. Kein Rollback noetig.
-- ============================================================================

-- Frei anlegbare Kategorien (Rails im Deal-Aktion-Tab)
CREATE TABLE IF NOT EXISTS network_categories (
  key        TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  farbe      TEXT NOT NULL DEFAULT '#C9A84C',
  sortierung INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO network_categories (key, label, farbe, sortierung)
SELECT 'finanzierung', 'Finanzierung & Banken', '#5a9bc4', 10
WHERE NOT EXISTS (SELECT 1 FROM network_categories WHERE key = 'finanzierung');

INSERT INTO network_categories (key, label, farbe, sortierung)
SELECT 'gutachter', 'Gutachter & Sachverstaendige', '#C9A84C', 20
WHERE NOT EXISTS (SELECT 1 FROM network_categories WHERE key = 'gutachter');

-- Kategorie-Constraint entfernen (Kategorien sind jetzt frei)
ALTER TABLE network_cards DROP CONSTRAINT IF EXISTS network_cards_kategorie_check;

-- Neue Designer-Spalten
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS website          TEXT;
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS logo_data        TEXT;
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS logo_zoom        INTEGER NOT NULL DEFAULT 100;
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS logo_x           INTEGER NOT NULL DEFAULT 50;
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS logo_y           INTEGER NOT NULL DEFAULT 50;
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS hintergrund_bild TEXT;

-- Websites der Start-Partner nachpflegen (idempotent)
UPDATE network_cards SET website = COALESCE(website, 'sperling-baufinanzierung.de')
WHERE name = 'Sperling Baufinanzierung';
UPDATE network_cards SET website = COALESCE(website, 'sauerland-finanzen.de')
WHERE name = 'Sauerland Finanzen';
UPDATE network_cards SET website = COALESCE(website, 'junker-immobilien.io')
WHERE name IN ('Junker Immobilien', 'Junker Immobilien - Beratung');
UPDATE network_cards SET website = COALESCE(website, 'gutachten.org')
WHERE name = 'Gutachten.org';
