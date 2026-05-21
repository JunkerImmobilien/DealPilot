-- V264-05: Cleanup-Script fuer doppelte tax_periods Eintraege
-- 
-- NICHT AUTOMATISCH ausfuehren! Erst SELECT pruefen, dann DELETE.
-- 
-- Anwendung:
--   docker exec -i dealpilot-postgres psql -U dealpilot dealpilot_db < dedupe_tax_periods.sql

-- 1. Erst: ZEIGE Duplikate
SELECT user_id, valid_from, valid_to, zve, COUNT(*) as duplicate_count
FROM tax_periods
GROUP BY user_id, valid_from, valid_to, zve
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Dann: LOESCHE alle bis auf den ältesten Eintrag pro Duplikat-Gruppe
-- ! Nur ausfuehren wenn obige Liste Duplikate zeigt
/*
DELETE FROM tax_periods t1
USING tax_periods t2
WHERE t1.id > t2.id
  AND t1.user_id = t2.user_id
  AND t1.valid_from = t2.valid_from
  AND COALESCE(t1.valid_to::text, '') = COALESCE(t2.valid_to::text, '')
  AND t1.zve = t2.zve;
*/

-- 3. Zur Sicherheit: Unique-Constraint hinzufuegen damit kuenftig keine Duplikate moeglich
-- (Postgres erlaubt NULL != NULL, daher COALESCE-Trick)
ALTER TABLE tax_periods 
  DROP CONSTRAINT IF EXISTS tax_periods_unique_user_dates;

ALTER TABLE tax_periods 
  ADD CONSTRAINT tax_periods_unique_user_dates 
  UNIQUE NULLS NOT DISTINCT (user_id, valid_from, valid_to);
