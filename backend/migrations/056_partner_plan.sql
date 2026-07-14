-- 056_partner_plan.sql
-- Partner-/Reseller-Plan. features.reseller=true ist Pflicht, sonst greift
-- requireFeature('reseller') nicht. Idempotent via ON CONFLICT.
-- Hinweis: die stripe_*-IDs sind TEST-Mode (aus Staging). Fuer Prod-LIVE
-- werden sie im separaten Stripe-LIVE-Schritt aktualisiert.

INSERT INTO public.plans
  (id, name, description, is_active, is_public,
   price_monthly_cents, price_yearly_cents,
   stripe_product_id, stripe_price_monthly_id, stripe_price_yearly_id,
   max_objects, max_users, max_ai_analyses_monthly, max_pdf_exports_monthly, max_photo_uploads_per_object,
   features, sort_order, is_listed, tagline, highlight,
   stripe_price_id_monthly, stripe_price_id_yearly, created_at, updated_at)
VALUES
  ('partner', 'Partner',
   'Reseller-Plan fuer Makler, Steuerberater, Finanzierer & mehr - inkl. Mandanten-Verwaltung und Whitelabel.',
   true, false,
   14900, 149000,
   'prod_UsCIoKVXP3UVWR', 'price_1TsRtnKEjyPDo0woM9uKdXJF', 'price_1TsRtoKEjyPDo0woFZv1b22m',
   -1, 1, 100, -1, 30,
   '{"support": "priority", "reseller": true, "rnd_full": true, "full_calc": true, "watermark": false, "api_access": true, "bankexport": true, "export_csv": true, "pdf_export": true, "ai_analysis": true, "bank_pdf_a3": true, "custom_logo": true, "json_backup": true, "marktreport": true, "bmf_advanced": true, "excel_import": true, "steuer_modul": true, "deal_score_v2": true, "custom_imports": true, "ai_analysis_tab": "full", "bank_pdf_normal": true, "bmf_calc_export": true, "bank_pdf_premium": true, "deal_score_basic": true, "priority_support": true, "track_record_pdf": true, "live_market_rates": true, "migration_service": true, "ai_market_analysis": true, "market_data_fields": true, "werbungskosten_pdf": true, "premium_pdf_layouts": true, "reseller_whitelabel": true, "investment_thesis_ai": true, "custom_finance_models": true, "mietspiegel_vergleich": "auto", "track_record_custom_cover": true}'::jsonb,
   5, false, 'Makler - Steuerberater - Finanzierer', false,
   NULL, NULL, now(), now())
ON CONFLICT (id) DO NOTHING;
