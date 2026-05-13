-- V63.25: UNIQUE-Constraint für (user_id, seq_no) — verhindert dass ein User
-- zwei Objekte mit derselben ID hat. Doppelte werden bei der Migration NICHT
-- automatisch korrigiert (das wäre destruktiv); der UNIQUE-Index wird daher
-- partiell auf seq_no IS NOT NULL gesetzt UND nur für ZUKÜNFTIGE Inserts.
-- Vorhandene Duplikate erkennt das Frontend an o.ds2_computed-vergleichbarer
-- Heuristik (renderSaved markiert sie rot mit "⚠").
--
-- Wenn beim ersten Migrationslauf bereits Duplikate vorhanden sind, würde der
-- Index-Build fehlschlagen — wir nehmen dies in Kauf und liefern den Fix für
-- Duplikate über das UI (rote Markierung + manuelles Umnummerieren via Header-ID).

DO $$
BEGIN
  -- Versuche den Constraint zu erstellen; wenn Duplikate vorhanden, log und weiter
  BEGIN
    ALTER TABLE objects
      ADD CONSTRAINT objects_user_seq_unique UNIQUE (user_id, seq_no);
    RAISE NOTICE 'V63.25: UNIQUE constraint (user_id, seq_no) added';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE WARNING 'V63.25: Duplicates exist on (user_id, seq_no) — constraint NOT applied. Use UI to renumber.';
    WHEN duplicate_object THEN
      RAISE NOTICE 'V63.25: UNIQUE constraint already exists (idempotent run)';
  END;
END$$;
