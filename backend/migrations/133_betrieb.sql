-- 133_betrieb.sql  ·  v4880
--
-- BETRIEB: Zustand der Server (Platte, Speicher, Last, Sicherheitsupdates, Neustart, Ports, TLS,
-- Image-Alter, Datenbankgrößen, Nachtsicherung) und Ergebnis der Wiederherstellungsprobe.
-- Geschrieben NICHT vom Backend, sondern vom Host-Takt tools/server/betrieb-sammeln.py
-- (stündlich, nur lesend am Host) und tools/server/wiederherstellungsprobe.sh (monatlich)
-- per docker exec psql. Das Backend liest nur (Admin › Betrieb) und verschickt die Mails.
-- Marcel 25.11.2026: „wann wir größere Server brauchen, ob wir Sicherheitslücken haben,
-- wie Backups laufen, und wenn alles zusammenstürzt, dass wir es wieder herstellen können“.
--
-- art: 'messung' (stündlich), 'audit' (npm audit, wöchentlich), 'probe' (Wiederherstellung),
--      'mail' (vom Backend: versandte Betriebs-Mail, zum Entdoppeln).

CREATE TABLE IF NOT EXISTS betrieb_messungen (
  id          BIGSERIAL PRIMARY KEY,
  server      TEXT        NOT NULL,
  art         TEXT        NOT NULL DEFAULT 'messung',
  erfasst_am  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  daten       JSONB       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS betrieb_messungen_art_zeit ON betrieb_messungen (art, erfasst_am DESC);
