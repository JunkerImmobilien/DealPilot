-- 004_user_binding.sql  (v942)
-- ─────────────────────────────────────────────────────────────────────
-- 1. SAUBERER NEUSTART (Entscheidung Marcel, 17.07.2026)
--    Der Altbestand hat keinen Besitzer und ist teils Schrott:
--      * 65 Snapshots trugen den QUELLTEXT von _currentObjectId() als object_key
--        (dealpilot-mb.js:109 nahm die Funktion statt ihres Rueckgabewerts)
--      * der Rest haengt an einem Geo-Fingerabdruck (Koordinaten+Typ+Flaeche+Baujahr),
--        d.h. dasselbe Haus liegt bei 5 m^2 Tippunterschied in mehreren Gruppen
--    Ein Backfill muesste raten, wem was gehoert. Wir raten nicht.
--
-- 2. USER-BINDUNG
--    Bis v941 hatte das mb-Backend KEINE Benutzer: jeder eingeloggte Nutzer
--    konnte ueber /objects und /reports/one?id=N die Berichte aller anderen
--    lesen. user_id bleibt NULLABLE -> ein Snapshot ohne Besitzer ist fuer
--    JEDEN unsichtbar (fail-closed), statt den Report zu sprengen.
--
-- 3. object_label = das DealPilot-Kuerzel ("2026-001") zum Zeitpunkt des Berichts.
--    Die mb-DB kann nicht auf dealpilot-postgres.objects joinen (zwei Server).
--    Der Proxy frischt es zur Laufzeit auf, solange das Objekt existiert.
-- ─────────────────────────────────────────────────────────────────────

TRUNCATE mb.object_snapshots, mb.market_reports, mb.report_fixtures RESTART IDENTITY;

ALTER TABLE mb.object_snapshots ADD COLUMN IF NOT EXISTS user_id      INTEGER;
ALTER TABLE mb.object_snapshots ADD COLUMN IF NOT EXISTS object_label TEXT;
ALTER TABLE mb.market_reports   ADD COLUMN IF NOT EXISTS user_id      INTEGER;

CREATE INDEX IF NOT EXISTS idx_obj_snap_user     ON mb.object_snapshots (user_id);
CREATE INDEX IF NOT EXISTS idx_obj_snap_user_ref ON mb.object_snapshots (user_id, external_ref);
CREATE INDEX IF NOT EXISTS idx_obj_snap_user_key ON mb.object_snapshots (user_id, object_key);
CREATE INDEX IF NOT EXISTS idx_market_reports_user ON mb.market_reports (user_id);
