-- ============================================================================
-- DealPilot Migration 050 (v854) — Netzwerk-Karten: CTA-Verhalten + Datenpflege
-- Additive Spalte + idempotente Daten-Updates. Kein Rollback noetig.
-- ============================================================================

ALTER TABLE network_cards
  ADD COLUMN IF NOT EXISTS cta_aktion TEXT NOT NULL DEFAULT 'lead';

-- Junker Immobilien (Gutachten): Huellhorst raus, CTA oeffnet das
-- DealPilot-interne Gutachten-Modal, Logo (Favicon) setzen.
UPDATE network_cards SET
  rolle = 'Sachverstaendigenbuero',
  cta_aktion = 'gutachten_modal',
  logo_url = COALESCE(logo_url, 'https://junker-immobilien.io/wp-content/uploads/2026/03/cropped-favicon-alt-270x270.png')
WHERE name = 'Junker Immobilien' AND kategorie = 'gutachter';

-- Sauerland Finanzen: Logo + Interims-Ziel (manuelle Weiterleitung bis Partnervertrag).
UPDATE network_cards SET
  logo_url = COALESCE(logo_url, 'https://www.sauerland-finanzen.de/wp-content/uploads/2022/01/cropped-Bildschirmfoto-2022-01-27-um-15.20.57-270x270.png'),
  ziel_email = COALESCE(ziel_email, 'dealpilot@junker-immobilien.io')
WHERE name = 'Sauerland Finanzen';

-- Sperling: Interims-Ziel (Website im Wartungsmodus, Logo folgt vom Partner).
UPDATE network_cards SET
  ziel_email = COALESCE(ziel_email, 'dealpilot@junker-immobilien.io')
WHERE name = 'Sperling Baufinanzierung';

-- Gutachten.org: lokales Fachpartner-Siegel, weisser Hintergrund, Interims-Ziel.
UPDATE network_cards SET
  logo_url = '/img/partner/gutachten-org.png',
  hintergrund = 'weiss',
  ziel_email = COALESCE(ziel_email, 'dealpilot@junker-immobilien.io')
WHERE name = 'Gutachten.org';

-- Zweite Junker-Karte: Beratung & Zweite Meinung (Standard-Lead an info@).
INSERT INTO network_cards
  (kategorie, name, rolle, tags, beschreibung, usp, antwortzeit, verified,
   cta_label, akzent, hintergrund, kante_stil, kuerzel, logo_url, ziel_email,
   mitgabe, anforderungen, cta_aktion, aktiv, sortierung)
SELECT
  'gutachter', 'Junker Immobilien - Beratung', 'Beratung & Zweite Meinung',
  '["Kaufberatung","Zweitmeinung","Deal-Check"]'::jsonb,
  'Unabhaengige Kaufberatung und zweite Meinung vor der Entscheidung - Unterlagen, Fotos und Fragen direkt einreichen.',
  'Antwort direkt vom Sachverstaendigen', 'Antwort in 24 h', true,
  'Beratung anfragen', '#C9A84C', 'weiss', 'k1', 'JI',
  'https://junker-immobilien.io/wp-content/uploads/2026/03/cropped-favicon-alt-270x270.png',
  'info@junker-immobilien.io',
  '{"objekt":true,"eckdaten":true,"kontakt":true,"dr_persoenlich":false,"dr_objekt":false}'::jsonb,
  '{}'::jsonb, 'lead', true, 12
WHERE NOT EXISTS (SELECT 1 FROM network_cards WHERE name = 'Junker Immobilien - Beratung');
