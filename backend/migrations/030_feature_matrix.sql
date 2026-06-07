-- 030: Feature-Matrix Stand 05.06.2026 (v494)
-- Monats-Liter an Matrix angleichen (Backend-PLAN_LIMITS seit v493 identisch)
UPDATE plans SET max_ai_analyses_monthly = 40  WHERE id = 'investor';
UPDATE plans SET max_ai_analyses_monthly = 100 WHERE id = 'pro';

-- Pilot-Lagebewertung ab Starter (Matrix) — Gate existiert (subscription.js Nr.7)
UPDATE plans SET features = features || '{"ai_market_analysis": true}'::jsonb  WHERE id = 'starter';

-- Rohdatenexport (CSV/XLSX) nur Pro (Matrix)
UPDATE plans SET features = features || '{"export_csv": false}'::jsonb WHERE id IN ('free','starter','investor');

-- Werbungskosten-PDF erst ab Investor (Matrix)
UPDATE plans SET features = features || '{"werbungskosten_pdf": false}'::jsonb WHERE id IN ('free','starter');

-- Neue Feature-Keys nach Matrix (UI-Gates folgen in v495)
UPDATE plans SET features = features || '{"marktreport": false, "rnd_full": false, "json_backup": false, "excel_import": false}'::jsonb WHERE id = 'free';
UPDATE plans SET features = features || '{"marktreport": true,  "rnd_full": false, "json_backup": false, "excel_import": true}'::jsonb  WHERE id = 'starter';
UPDATE plans SET features = features || '{"marktreport": true,  "rnd_full": true,  "json_backup": false, "excel_import": true}'::jsonb  WHERE id = 'investor';
UPDATE plans SET features = features || '{"marktreport": true,  "rnd_full": true,  "json_backup": true,  "excel_import": true}'::jsonb  WHERE id = 'pro';
