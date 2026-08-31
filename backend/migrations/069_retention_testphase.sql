-- ════════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 069
-- v1185: die Testphase bekommt zwei Erinnerungen
--
-- Marcels Vorgabe vom 31.08.2026: nach der Haelfte und kurz vor Ablauf
-- eine Mail, falls noch kein Plan gebucht ist.
--
-- Der Versand haengt am bestehenden taeglichen Retention-Lauf (v799,
-- index.js). Ein zweiter Scheduler waere eine zweite Wahrheit darueber,
-- wann Post rausgeht.
--
-- WARUM DIE BESTEHENDE AUSLAUF-MAIL NICHT REICHT: `listExpiring()` sucht
-- ueber `subscriptions.current_period_end`. Ein Testnutzer hat gar keine
-- subscriptions-Zeile — seine Testphase steht in `plan_trials`. Die
-- vorhandene Mail haette ihn nie erreicht.
--
-- Nur ein Schalter, keine Textspalten: die beiden Vorlagen stehen im Code
-- (retentionService.defaultTestphaseTemplates). Wer sie in die Datenbank
-- holt, muss auch die Admin-Oberflaeche nachziehen — sonst liegt Text an
-- einer Stelle, die niemand sieht.
-- ════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE retention_settings
  ADD COLUMN IF NOT EXISTS testphase_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN retention_settings.testphase_enabled IS
  'v1185: zwei Erinnerungen waehrend der Pro-Testphase (Halbzeit und kurz vor Ablauf)';

COMMIT;
