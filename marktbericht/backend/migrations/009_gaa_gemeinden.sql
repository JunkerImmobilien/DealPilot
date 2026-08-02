-- 009_gaa_gemeinden.sql  (Paket v1044)
-- ─────────────────────────────────────────────────────────────────────
-- Der Nachbarwert braucht eine schnelle Antwort auf: "welcher
-- Gutachterausschuss ist fuer diese Gemeinde zustaendig, und welche
-- Gemeinden gehoeren sonst noch dazu?"
--
-- Die Antwort steht bereits in mb.gaa_sources.ags_liste — bisher aber ohne
-- Index. Bei 73 NRW-Ausschuessen mit je bis zu 24 Gemeinden laeuft jede
-- Abfrage sonst ueber die ganze Tabelle, und zwar in jedem Bericht.

BEGIN;

CREATE INDEX IF NOT EXISTS ix_gaa_sources_ags_liste
  ON mb.gaa_sources USING GIN (ags_liste);

COMMENT ON COLUMN mb.gaa_sources.ags_liste IS
  'Zustaendigkeitsgebiet. Gemischte Laengen sind Absicht: fuenfstellig, wo der '
  'Ausschuss kreisscharf zustaendig ist (BB, MV), achtstellig, wo er einzelne '
  'Gemeinden abdeckt (NW). Leser muessen beide Formen vertragen.';

COMMIT;
