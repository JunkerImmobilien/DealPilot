-- ═══════════════════════════════════════════════════════════════
-- Migration 020: Plan-Features Consolidation V186 (13.05.2026)
-- ═══════════════════════════════════════════════════════════════
-- Konsolidiert alle Plan-Features:
--   - Free: streng, kein Pro-Demo mehr (außer Deal-Score V2 als 'demo')
--   - Single-Source-of-Truth wird DB, Frontend liest aus subscription-API
--   - max_pdf_exports_monthly für alle Pläne konsistent gesetzt
--   - Alle Features die im Frontend existieren werden in DB-features-JSONB nachgezogen
-- ═══════════════════════════════════════════════════════════════

UPDATE plans SET
  max_objects = 1,
  max_users = 1,
  max_ai_analyses_monthly = 2,
  max_pdf_exports_monthly = 2,
  max_photo_uploads_per_object = 3,
  features = jsonb_build_object(
    'support',                    'community',
    'full_calc',                  true,
    'deal_score_basic',           true,
    'deal_score_v2',              'demo',
    'ai_analysis',                true,
    'ai_analysis_tab',            'simplified',
    'ai_market_analysis',         false,
    'investment_thesis_ai',       false,
    'market_data_fields',         false,
    'live_market_rates',          false,
    'bmf_calc_export',            false,
    'mietspiegel_vergleich',      null,
    'steuer_modul',               true,
    'pdf_export',                 true,
    'export_csv',                 true,
    'watermark',                  true,
    'bank_pdf_normal',            false,
    'bank_pdf_a3',                false,
    'bank_pdf_premium',           false,
    'bankexport',                 false,
    'werbungskosten_pdf',         true,
    'track_record_pdf',           false,
    'track_record_custom_cover',  false,
    'custom_logo',                false,
    'custom_finance_models',      false,
    'custom_imports',             false,
    'premium_pdf_layouts',        false,
    'api_access',                 false,
    'priority_support',           false,
    'migration_service',          false
  )
WHERE id = 'free';

UPDATE plans SET
  max_objects = 5,
  max_users = 1,
  max_ai_analyses_monthly = 10,
  max_pdf_exports_monthly = NULL,
  max_photo_uploads_per_object = 6,
  features = jsonb_build_object(
    'support',                    'email',
    'full_calc',                  true,
    'deal_score_basic',           true,
    'deal_score_v2',              false,
    'ai_analysis',                true,
    'ai_analysis_tab',            'simplified',
    'ai_market_analysis',         false,
    'investment_thesis_ai',       false,
    'market_data_fields',         false,
    'live_market_rates',          false,
    'bmf_calc_export',            false,
    'mietspiegel_vergleich',      'manual',
    'steuer_modul',               true,
    'pdf_export',                 true,
    'export_csv',                 true,
    'watermark',                  false,
    'bank_pdf_normal',            true,
    'bank_pdf_a3',                false,
    'bank_pdf_premium',           false,
    'bankexport',                 false,
    'werbungskosten_pdf',         true,
    'track_record_pdf',           false,
    'track_record_custom_cover',  false,
    'custom_logo',                false,
    'custom_finance_models',      false,
    'custom_imports',             false,
    'premium_pdf_layouts',        false,
    'api_access',                 false,
    'priority_support',           false,
    'migration_service',          false
  )
WHERE id = 'starter';

UPDATE plans SET
  max_objects = 25,
  max_users = 1,
  max_ai_analyses_monthly = 30,
  max_pdf_exports_monthly = NULL,
  max_photo_uploads_per_object = 10,
  features = jsonb_build_object(
    'support',                    'email',
    'full_calc',                  true,
    'deal_score_basic',           true,
    'deal_score_v2',              true,
    'ai_analysis',                true,
    'ai_analysis_tab',            'full',
    'ai_market_analysis',         true,
    'investment_thesis_ai',       true,
    'market_data_fields',         true,
    'live_market_rates',          true,
    'bmf_calc_export',            true,
    'mietspiegel_vergleich',      'auto',
    'steuer_modul',               true,
    'pdf_export',                 true,
    'export_csv',                 true,
    'watermark',                  false,
    'bank_pdf_normal',            true,
    'bank_pdf_a3',                true,
    'bank_pdf_premium',           false,
    'bankexport',                 true,
    'werbungskosten_pdf',         true,
    'track_record_pdf',           true,
    'track_record_custom_cover',  false,
    'custom_logo',                true,
    'custom_finance_models',      true,
    'custom_imports',             false,
    'premium_pdf_layouts',        false,
    'api_access',                 false,
    'priority_support',           false,
    'migration_service',          false
  )
WHERE id = 'investor';

UPDATE plans SET
  max_objects = -1,
  max_users = 1,
  max_ai_analyses_monthly = 80,
  max_pdf_exports_monthly = NULL,
  max_photo_uploads_per_object = 30,
  features = jsonb_build_object(
    'support',                    'priority',
    'full_calc',                  true,
    'deal_score_basic',           true,
    'deal_score_v2',              true,
    'ai_analysis',                true,
    'ai_analysis_tab',            'full',
    'ai_market_analysis',         true,
    'investment_thesis_ai',       true,
    'market_data_fields',         true,
    'live_market_rates',          true,
    'bmf_calc_export',            true,
    'mietspiegel_vergleich',      'auto',
    'steuer_modul',               true,
    'pdf_export',                 true,
    'export_csv',                 true,
    'watermark',                  false,
    'bank_pdf_normal',            true,
    'bank_pdf_a3',                true,
    'bank_pdf_premium',           true,
    'bankexport',                 true,
    'werbungskosten_pdf',         true,
    'track_record_pdf',           true,
    'track_record_custom_cover',  true,
    'custom_logo',                true,
    'custom_finance_models',      true,
    'custom_imports',             true,
    'premium_pdf_layouts',        true,
    'api_access',                 true,
    'priority_support',           true,
    'migration_service',          true
  )
WHERE id = 'pro';

DO $$
DECLARE
  free_features JSONB;
  pro_features JSONB;
BEGIN
  SELECT features INTO free_features FROM plans WHERE id='free';
  SELECT features INTO pro_features FROM plans WHERE id='pro';
  IF free_features->>'deal_score_v2' != 'demo' THEN
    RAISE EXCEPTION 'Migration 020 failed: Free deal_score_v2 should be demo';
  END IF;
  IF (pro_features->>'api_access')::boolean != true THEN
    RAISE EXCEPTION 'Migration 020 failed: Pro api_access should be true';
  END IF;
  RAISE NOTICE '✓ Migration 020 verified successfully';
END $$;
