-- ════════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 068
-- v1185: die Testphase bekommt einen eigenen Topf, der verfaellt
--
-- Marcels Entscheidung vom 31.08.2026: die Testphase laeuft vier Wochen
-- als Pro und traegt ein EINMALIGES Bewertungspaket — nicht das
-- Monatskontingent eines Pro.
--
-- WARUM EIN EIGENER TOPF UND NICHT DIE BANK:
-- Die Bank verfaellt nie, das ist ihr Zweck (Gekauftes und Angespartes).
-- Waere das Testpaket dort gelandet, haette jeder Testnutzer nach vier
-- Wochen dauerhaft Wertermittlungen auf Vorrat behalten — als Free-Nutzer,
-- ohne je gezahlt zu haben. GEMESSEN am 31.08. beim Pruefen von
-- _carryOver(): ungenutztes Monatskontingent wandert beim Monatswechsel in
-- die Bank, und in vier Wochen liegt fast immer ein Monatswechsel.
--
-- WARUM NICHT DAS PRO-MONATSKONTINGENT FUER DIE DAUER:
-- Wer sich am 20. registriert, bekaeme am 1. das naechste — faktisch das
-- Doppelte, abhaengig vom Zufall des Anmeldedatums. Ein Einmalpaket ist
-- unabhaengig vom Kalender und exakt bezifferbar.
--
-- `testphase_bis` ist die Wahrheit ueber den Verfall. Es ist bewusst eine
-- KOPIE von plan_trials.expires_at und keine Fremdschluessel-Abfrage: der
-- Verbrauchsweg (consumeArt) laeuft bei jeder Bewertung und darf nicht von
-- einem zweiten Tabellenzugriff abhaengen. Gesetzt wird sie beim Gewaehren.
-- ════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE ai_credits_user
  ADD COLUMN IF NOT EXISTS testphase_mpi      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS testphase_mpi_plus INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS testphase_wev      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS testphase_bis      TIMESTAMPTZ;

COMMENT ON COLUMN ai_credits_user.testphase_mpi IS
  'v1185: Marktpreisindikationen aus dem Testpaket. Verfallen mit testphase_bis, wandern NIE in die Bank.';
COMMENT ON COLUMN ai_credits_user.testphase_mpi_plus IS
  'v1185: erweiterte Marktpreisindikationen aus dem Testpaket.';
COMMENT ON COLUMN ai_credits_user.testphase_wev IS
  'v1185: Wertermittlungen aus dem Testpaket.';
COMMENT ON COLUMN ai_credits_user.testphase_bis IS
  'v1185: Ablauf des Testpakets, Kopie von plan_trials.expires_at. Danach wird der Rest verworfen.';

-- Bestandsnutzer bekommen NICHTS nachtraeglich. Wer schon da ist, hat
-- seine sieben Tage gehabt oder zahlt; ein rueckwirkendes Geschenk waere
-- nicht begruendbar und in der Buchhaltung nicht erklaerbar.

COMMIT;
