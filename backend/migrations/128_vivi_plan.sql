-- 128_vivi_plan.sql  ·  v4350 (Marcel 24.11.2026: „ViVi ab Investor“, inklusive Testphase)
--
-- Bis v4340 war die ViVi-Anbindung eine Vorschau-Funktion (nur Admin und Freigabeliste).
-- Jetzt ein Plan-Merkmal: plans.features.vivi. Investor, Pro und Partner ja, Free und Starter nein.
-- Die Testphase läuft als Pro (plan_trials, subscriptionService.getEffectivePlan) und ist damit dabei.
-- Gelesen von services/vivi/viviZugang.js (Backend) und js/vivi-zugang.js (Oberfläche, plan_features).
-- Ausdrücklich false statt fehlend: ein unbekannter Schlüssel ist zwar auch false, aber so steht die
-- Entscheidung für jeden Plan in der Datenbank.
UPDATE plans SET features = COALESCE(features, '{}'::jsonb) || '{"vivi": true}'::jsonb  WHERE id IN ('investor', 'pro', 'partner');
UPDATE plans SET features = COALESCE(features, '{}'::jsonb) || '{"vivi": false}'::jsonb WHERE id IN ('free', 'starter');
