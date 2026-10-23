-- 089_tax_periods_veranlagung.sql  ·  v2892
--
-- VERANLAGUNG UND KIRCHENSTEUER JE STEUERZEITRAUM
--
-- Marcel am 23.10.2026: "mach bitte die offenen Punkte fertig". Seit v2891
-- stehen Splitting und Kirchensteuer im Investmentprofil und gelten fuer
-- alle Jahre. Wer heiratet oder aus der Kirche austritt, hat aber je Jahr
-- eine andere Veranlagung - genau dafuer gibt es die Steuerzeitraeume.
--
-- NULL heisst "wie im Investmentprofil". Nur ein gesetzter Wert ueberstimmt
-- das Profil fuer diesen Zeitraum. Kirchensteuer in Prozent: 0, 8 oder 9.

ALTER TABLE tax_periods ADD COLUMN IF NOT EXISTS splitting BOOLEAN;
ALTER TABLE tax_periods ADD COLUMN IF NOT EXISTS kirchensteuer SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_periods_kirchensteuer_chk') THEN
    ALTER TABLE tax_periods ADD CONSTRAINT tax_periods_kirchensteuer_chk
      CHECK (kirchensteuer IS NULL OR kirchensteuer IN (0, 8, 9));
  END IF;
END $$;
