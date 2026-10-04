-- 081_telegram_angebot.sql  ·  v1821
--
-- DAS ANGEBOT, FUER DAS DER NUTZER BEZAHLT HAT
--
-- GEMESSEN am 04.10.2026 an Marcels eigenem Dialog (telegram_dialog.verlauf,
-- Bericht 137 in mb.market_reports):
--
--   Nutzer: "Dann lass uns mal eine erweiterte Marktpreisindikation abrufen."
--   Bot:    "... fuer das Objekt Am Markt 9, 06184 Kabelsketal kostet einen
--            Abruf aus deinem Kontingent ..."
--   Nutzer: "Ja"
--   Bot:    "Hier ist die ... fuer das Objekt Gohliser Strasse 42, Leipzig"
--
-- Der Preis wurde fuer ein Objekt angesagt, abgerufen und ABGEBUCHT wurde
-- ein anderes (mpi_plus_used ging auf 1). Die Ursache lag an zwei Stellen:
-- `marktbericht_preis` hielt das Objekt nicht fest, und die Geldsperre
-- (`darfKosten`) prueft nur, DASS eine Preisansage dastand.
--
--   > Die Geldsperre fragt, ob zugestimmt wurde. Sie fragt nicht, wozu.
--   > Eine Zustimmung ohne Gegenstand ist keine Zustimmung.
--
-- Deshalb diese Spalte: die Preisansage legt hier ab, WOFUER sie gilt —
-- Objekt, Stufe und Zeitpunkt. Der Abruf nimmt ausschliesslich das, was
-- hier steht, und ignoriert jede Objektangabe des Modells. Das WOFUER
-- gehoert genauso ausserhalb des Modells wie das OB.
--
-- Warum eine eigene Spalte und nicht `objekt_id`: die fuehrt die laufende
-- Anlage. Zwei Bedeutungen auf einem Feld loeschen sich lautlos — das ist
-- in diesem Haus schon passiert (data-dp-karte, v1517).

ALTER TABLE telegram_dialog
  ADD COLUMN IF NOT EXISTS angebot jsonb;

COMMENT ON COLUMN telegram_dialog.angebot IS
  'v1821 · Die letzte Preisansage: {objekt_id, stufe, art, zeit}. Nur hierauf '
  'darf sich ein "ja" beziehen. Wird nach dem Abruf geloescht, damit eine '
  'zweite Zustimmung nicht denselben Abruf erneut ausloest.';
