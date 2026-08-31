-- ════════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 067
-- v1184: der Monatsuebertrag beschenkte jeden neuen Nutzer
--
-- GEMESSEN am 31.08.2026 auf Staging, beim Pruefen des Kaufwegs: ein
-- frisch angelegter Pro-Nutzer stand ohne einen einzigen Kauf auf
--   mpi=5  mpi_plus=5  wev=5  IN DER BANK
-- also genau seinem Monatskontingent — zusaetzlich zum Monatskontingent
-- selbst. Er haette den ersten Monat doppelt gehabt.
--
-- URSACHE: `_carryOver()` ueberspringt den Uebertrag nur, wenn
-- `kontingent_carry_at` im laufenden Monat liegt. Bei NULL laeuft er
-- durch. Migration 066 hat zwar alle DAMALS bestehenden Zeilen gesetzt,
-- aber die Spalte bekam keinen DEFAULT — und `_ensureCurrentPeriod()`
-- legt neue Zeilen mit `INSERT INTO ai_credits_user (user_id)` an. Jede
-- seither entstandene Zeile war NULL und wurde beim ersten Statusabruf
-- beschenkt.
--
-- WARUM EIN DEFAULT UND NICHT NUR EIN IF IM CODE: ai_credits_user wird an
-- mehreren Stellen angelegt (aiCreditsService._ensureCurrentPeriod,
-- creditPackWebhook). Ein DEFAULT deckt jede davon ab, auch die naechste,
-- die jemand schreibt. Der Riegel im Code kommt trotzdem dazu — Prod hat
-- diese Migration noch nicht.
--
-- KEIN RUECKBAU des schon Verschenkten: auf Staging steht es in der Bank
-- von Testnutzern, auf Prod ist 064/066 nie gelaufen. Wer hier abzoege,
-- naehme Guthaben weg, ohne es nachweisen zu koennen.
-- ════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE ai_credits_user
  ALTER COLUMN kontingent_carry_at SET DEFAULT date_trunc('month', NOW())::date;

COMMENT ON COLUMN ai_credits_user.kontingent_carry_at IS
  'v1183: Monat, fuer den der Uebertrag ins Sparguthaben zuletzt lief. v1184: DEFAULT laufender Monat — ohne ihn wird eine neue Zeile beim ersten Statusabruf beschenkt.';

UPDATE ai_credits_user
   SET kontingent_carry_at = date_trunc('month', NOW())::date
 WHERE kontingent_carry_at IS NULL;

COMMIT;
