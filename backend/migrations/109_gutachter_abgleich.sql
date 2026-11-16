-- 109_gutachter_abgleich.sql  ·  v3580
--
-- KERN GEGEN PARTNER (Marcel 16.11.2026: „Rechenkern mit den Partner-Ergebnissen
-- kontinuierlich prüfen/verbessern“)
--
-- Zu jeder Ersteinschaetzung bei gutachten.org wird mitgeschrieben:
--   eingaben  die an den Partner uebergebenen Objektangaben (ohne Personendaten)
--   kern      die Restnutzungsdauer UNSERES Kerns (rnd-calc.js ueber mapDealPilotObject,
--             derselbe Weg wie POST /rechenkerne/rnd) zum selben Zeitpunkt
-- Das Partner-Ergebnis steht schon in `ergebnis`, Zeitpunkt in `created_at`, Objekt in `objekt_id`.
-- Ausgewertet wird nur lesend (tools/rnd-partner-abgleich.mjs); den Kern aendert niemand automatisch.

ALTER TABLE gutachter_anfragen ADD COLUMN IF NOT EXISTS eingaben JSONB;
ALTER TABLE gutachter_anfragen ADD COLUMN IF NOT EXISTS kern JSONB;
