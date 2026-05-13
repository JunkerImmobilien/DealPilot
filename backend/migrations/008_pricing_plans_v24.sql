-- ════════════════════════════════════════════════════
-- DEALPILOT BACKEND - Migration 008
-- V24: Plans-Schema an Frontend angleichen
--   Aktuell: free / pro / business / enterprise
--   Neu:     free / investor / pro / business
--
-- Strategie:
--   1. 'investor'-Plan einfügen
--   2. 'enterprise' deaktivieren (NICHT löschen — User mit dem Plan
--      würden sonst FK-Verstöße werfen). Wir lassen den Plan in der
--      Tabelle, markieren ihn aber als nicht-listbar.
--   3. Existing 'enterprise'-Subscriptions bleiben funktional.
-- ════════════════════════════════════════════════════

-- Neue Spalte für UI-Sichtbarkeit
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_listed BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tagline VARCHAR(255);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS highlight BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id_monthly VARCHAR(100);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id_yearly  VARCHAR(100);

-- Investor-Plan einfügen (zwischen Free und Pro)
INSERT INTO plans
  (id, name, description, tagline, highlight, is_listed,
   price_monthly_cents, price_yearly_cents,
   max_objects, max_users, max_ai_analyses_monthly, max_pdf_exports_monthly,
   max_photo_uploads_per_object, features, sort_order)
VALUES
  ('investor', 'Investor', 'Für Privat-Investoren', 'Für Privat-Investoren', FALSE, TRUE,
   1900, 19000,                                  -- 19 €/Mo, 190 €/Jahr
   10, 1, 10, NULL, 8,
   '{"export_csv": true, "ai_analysis": true, "pdf_export": true,
     "watermark": false, "advanced_charts": true,
     "support": "email"}'::jsonb,
   2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tagline = EXCLUDED.tagline,
  highlight = EXCLUDED.highlight,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  max_objects = EXCLUDED.max_objects,
  max_ai_analyses_monthly = EXCLUDED.max_ai_analyses_monthly,
  max_photo_uploads_per_object = EXCLUDED.max_photo_uploads_per_object,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

-- Pro auf sort_order=3 schieben + tagline + highlight
UPDATE plans
   SET sort_order = 3,
       tagline = 'Für aktive Investoren & Berater',
       highlight = TRUE,
       price_monthly_cents = 2900,
       price_yearly_cents = 29000,
       max_photo_uploads_per_object = 15,
       max_ai_analyses_monthly = 20
 WHERE id = 'pro';

-- Business auf sort_order=4
UPDATE plans
   SET sort_order = 4,
       tagline = 'Für Maklerbüros & Teams',
       price_monthly_cents = 5900,
       price_yearly_cents = 59000,
       max_photo_uploads_per_object = 30
 WHERE id = 'business';

-- Free aktualisieren (höhere Limits zum Testen)
UPDATE plans
   SET tagline = 'Zum Ausprobieren',
       max_objects = 1,
       max_ai_analyses_monthly = 2,
       max_pdf_exports_monthly = 3,
       max_photo_uploads_per_object = 3
 WHERE id = 'free';

-- Enterprise deaktivieren (im Listing nicht mehr zeigen — bestehende Subs bleiben gültig)
UPDATE plans
   SET is_listed = FALSE,
       tagline = 'Auf Anfrage'
 WHERE id = 'enterprise';
