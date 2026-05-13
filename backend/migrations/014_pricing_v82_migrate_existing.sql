-- ═══════════════════════════════════════════════════════════════
-- V63.82 / V63.83.1: Pricing-Restruktur — Bestehende User migrieren
-- ═══════════════════════════════════════════════════════════════
-- HOTFIX V63.83.1:
--   - Spalte heißt plan_id (FK auf plans(id)), NICHT plan
--   - Vor UPDATE müssen die neuen Plan-IDs in plans existieren (FK)
--   - Idempotent — kann mehrfach laufen
-- ═══════════════════════════════════════════════════════════════

-- 0) NEUER Plan 'starter' (V63.82-Pricing-Restruktur — bisher nicht in plans-Tabelle)
INSERT INTO plans
  (id, name, description, tagline, highlight, is_listed, is_public, is_active,
   price_monthly_cents, price_yearly_cents,
   max_objects, max_users, max_ai_analyses_monthly, max_pdf_exports_monthly,
   max_photo_uploads_per_object, features, sort_order)
VALUES
  ('starter', 'Starter', 'Für Einsteiger',
   'Erste Berechnung, ohne Schnickschnack', FALSE, TRUE, TRUE, TRUE,
   900, 9000,
   3, 1, 5, NULL, 5,
   '{"export_csv": true, "ai_analysis": true, "pdf_export": true,
     "watermark": false, "advanced_charts": false,
     "support": "email"}'::jsonb,
   1)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  tagline     = EXCLUDED.tagline,
  is_listed   = EXCLUDED.is_listed,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- 1) Alte Plan-IDs ('business', 'enterprise') auf 'investor' migrieren
UPDATE subscriptions
   SET plan_id = 'investor', updated_at = NOW()
 WHERE plan_id IN ('business', 'enterprise');

-- 2) Sicherheits-Fallback: orphan plan_id → 'free'
UPDATE subscriptions
   SET plan_id = 'free', updated_at = NOW()
 WHERE plan_id IS NULL
    OR plan_id NOT IN (SELECT id FROM plans WHERE is_active = TRUE);
