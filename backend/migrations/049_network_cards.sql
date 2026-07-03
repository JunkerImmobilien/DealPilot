-- ============================================================================
-- DealPilot Migration 049 (v852) — Netzwerk-Karten (Designer) + Leads
-- Additive: nur neue Tabellen. Rollback braucht KEIN DB-Restore.
-- ============================================================================

CREATE TABLE IF NOT EXISTS network_cards (
  id                SERIAL PRIMARY KEY,
  kategorie         TEXT NOT NULL CHECK (kategorie IN ('finanzierung','gutachter')),
  name              TEXT NOT NULL,
  rolle             TEXT,
  tags              JSONB NOT NULL DEFAULT '[]'::jsonb,
  beschreibung      TEXT,
  usp               TEXT,
  antwortzeit       TEXT,
  verified          BOOLEAN NOT NULL DEFAULT true,
  cta_label         TEXT NOT NULL DEFAULT 'Anfrage senden',
  akzent            TEXT NOT NULL DEFAULT '#C9A84C',
  hintergrund       TEXT NOT NULL DEFAULT 'weiss',
  hintergrund_farbe TEXT,
  kante_stil        TEXT NOT NULL DEFAULT 'k1',
  kante_farbe       TEXT,
  kuerzel           TEXT,
  logo_url          TEXT,
  ziel_email        TEXT,
  mitgabe           JSONB NOT NULL DEFAULT '{"objekt":true,"eckdaten":true,"kontakt":true,"dr_persoenlich":false,"dr_objekt":false}'::jsonb,
  anforderungen     JSONB NOT NULL DEFAULT '{}'::jsonb,
  aktiv             BOOLEAN NOT NULL DEFAULT true,
  sortierung        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_cards_active
  ON network_cards (aktiv, kategorie, sortierung);

CREATE TABLE IF NOT EXISTS network_leads (
  id         SERIAL PRIMARY KEY,
  card_id    INTEGER REFERENCES network_cards(id) ON DELETE SET NULL,
  user_id    INTEGER,
  object_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_leads_card
  ON network_leads (card_id, created_at);

-- Seed nur, wenn Tabelle leer ist (idempotent).
INSERT INTO network_cards
  (kategorie, name, rolle, tags, beschreibung, usp, antwortzeit, verified,
   cta_label, akzent, hintergrund, kante_stil, kuerzel, ziel_email,
   mitgabe, anforderungen, aktiv, sortierung)
SELECT * FROM (VALUES
  ('finanzierung', 'Sperling Baufinanzierung', 'Baufinanzierung & Peak Advisors',
    '["450 Banken","ungebunden","bundesweit"]'::jsonb,
    'Konzeptberatung aus 450 Banken - strukturiert fuer Kapitalanleger, nicht fuer Eigenheimkaeufer.',
    'Zusage-Quote 94 %', 'Antwort in 24-72 h', true,
    'Finanzierung anfragen', '#5a9bc4', 'weiss', 'k2', 'SPR', NULL,
    '{"objekt":true,"eckdaten":true,"kontakt":true,"dr_persoenlich":true,"dr_objekt":true}'::jsonb,
    '{"dr_objekt":true,"dr_persoenlich":true}'::jsonb, true, 10),
  ('finanzierung', 'Sauerland Finanzen', 'Dominik Wagner - Meschede',
    '["~700 Banken","ungebunden","1 Gespraech"]'::jsonb,
    '"700 Banken - 1 Gespraech." Ungebunden, zugeschnitten auf deine Investment-Planung.',
    'Persoenlicher Ansprechpartner', 'Antwort in 24 h', true,
    'Finanzierung anfragen', '#7aa0bd', 'weiss', 'k2', 'SAU', NULL,
    '{"objekt":true,"eckdaten":true,"kontakt":true,"dr_persoenlich":true,"dr_objekt":true}'::jsonb,
    '{"dr_objekt":true,"dr_persoenlich":true}'::jsonb, true, 20),
  ('gutachter', 'Junker Immobilien', 'Sachverstaendigenbuero - Huellhorst',
    '["DESAG","ImmoWertV","Schadensgutachten"]'::jsonb,
    'Schadensgutachten (Feuchte, Risse, Schimmel), Immobilienbewertung nach ImmoWertV, Baubegleitung & Projektentwicklung - aus einer Hand.',
    'Technisch, wirtschaftlich, strategisch', 'Antwort in 24 h', true,
    'Gutachten anfragen', '#C9A84C', 'weiss', 'k1', 'JI', 'info@junker-immobilien.io',
    '{"objekt":true,"eckdaten":true,"kontakt":true,"dr_persoenlich":false,"dr_objekt":false}'::jsonb,
    '{}'::jsonb, true, 10),
  ('gutachter', 'Gutachten.org', 'Zertifizierter Fachpartner',
    '["Zertifiziert","Unabhaengig","Bundesweit"]'::jsonb,
    'Verkehrswertgutachten durch zertifizierte, unabhaengige Sachverstaendige - deutschlandweit.',
    'Bundesweites Netz', 'Antwort in 48 h', true,
    'Gutachten anfragen', '#8aa89a', 'weiss', 'k1', 'GUT', NULL,
    '{"objekt":true,"eckdaten":true,"kontakt":true,"dr_persoenlich":false,"dr_objekt":false}'::jsonb,
    '{}'::jsonb, true, 20)
) AS seed(kategorie, name, rolle, tags, beschreibung, usp, antwortzeit, verified,
          cta_label, akzent, hintergrund, kante_stil, kuerzel, ziel_email,
          mitgabe, anforderungen, aktiv, sortierung)
WHERE NOT EXISTS (SELECT 1 FROM network_cards);
