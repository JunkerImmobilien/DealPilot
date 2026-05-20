-- ═══════════════════════════════════════════════════════════════
-- Migration 024_plan_limits_fillgaps_v240.sql  
-- ═══════════════════════════════════════════════════════════════
-- V240 Bug-D-Fix: Plan-Limits-Lücken
--
-- Stand vor Migration (Staging-DB):
--   starter:  max_pdf_exports_monthly = NULL  → unklar/blockierend
--   investor: max_pdf_exports_monthly = NULL  → unklar/blockierend
--   pro:      max_pdf_exports_monthly = NULL
--             max_objects             = NULL  → sollte unlimited sein
--
-- Konvention im Code: -1 = unbegrenzt, NULL = nicht gesetzt (kann zu
-- Unklarheiten in Vergleichen führen). Pro hat objects=-1 (unlimited)
-- laut frontend/js/config.js. Für PDF-Exporte setzen wir bewusste
-- Limits proportional zu den AI-Limits:
--   starter (10 ai)  → 10 pdf  (Privat-Investor, eine Hand voll Deals)
--   investor (30 ai) → 30 pdf  (Bestseller, mehrere Deals/Monat)
--   pro (80 ai)      → -1      (unbegrenzt, Sachverständige/White-Label)
--
-- Idempotent: COALESCE schreibt nur wenn Wert noch NULL ist. Wenn ein
-- Admin bereits einen anderen Wert gesetzt hat, bleibt der erhalten.
-- ═══════════════════════════════════════════════════════════════

-- Starter
UPDATE plans
SET max_pdf_exports_monthly = COALESCE(max_pdf_exports_monthly, 10)
WHERE id = 'starter';

-- Investor
UPDATE plans
SET max_pdf_exports_monthly = COALESCE(max_pdf_exports_monthly, 30)
WHERE id = 'investor';

-- Pro: unbegrenzt = -1
UPDATE plans
SET max_pdf_exports_monthly = COALESCE(max_pdf_exports_monthly, -1),
    max_objects             = COALESCE(max_objects, -1)
WHERE id = 'pro';

-- Verify (läuft in der Migration selbst nur als Output)
DO $$
DECLARE
  r record;
BEGIN
  RAISE NOTICE '──── plan limits after migration ────';
  FOR r IN
    SELECT id, max_objects, max_ai_analyses_monthly, max_pdf_exports_monthly
    FROM plans
    WHERE id IN ('starter','investor','pro')
    ORDER BY id
  LOOP
    RAISE NOTICE '  % | objects=% | ai=% | pdf=%',
      rpad(r.id, 10), r.max_objects, r.max_ai_analyses_monthly, r.max_pdf_exports_monthly;
  END LOOP;
END $$;
