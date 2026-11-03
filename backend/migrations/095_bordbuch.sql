-- 095_bordbuch.sql  ·  v3110
--
-- BORDBUCH: Fehler und Wünsche mit Screenshot (Erweiterung von 094)
--
-- Marcel am 03.11.2026: ein „Männchen für Fehler oder fürs Backlog“, das beim Klick
-- einen Screenshot macht, auf dem man markieren kann, dazu schreiben oder diktieren
-- „was fällt uns auf, was fehlt, wo ist das Problem“. Für ausgewählte Nutzer im Admin
-- freischaltbar („Backlog-User“ = Zusatz 'entwicklungspartner').
--
--   art      'fehler' | 'wunsch' | 'idee'
--   bilder   JSON-Liste von data:-URLs (JPEG/PNG, höchstens 4, je ≤ 4 MB als Text)
--   kontext  Reiter, Objekt, Adresse der Seite, Fenstergröße, App-Version, Browser

ALTER TABLE umsetzungswuensche ADD COLUMN IF NOT EXISTS art     TEXT  NOT NULL DEFAULT 'wunsch';
ALTER TABLE umsetzungswuensche ADD COLUMN IF NOT EXISTS bilder  JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE umsetzungswuensche ADD COLUMN IF NOT EXISTS kontext JSONB;
