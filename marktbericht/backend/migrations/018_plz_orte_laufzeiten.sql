-- 018_plz_orte_laufzeiten.sql — v2197 · N62.18 Punkte 2 und 6
--
-- Marcel am 13.10.2026: „können wir die kritischen Anfragen, die zeitintensiv
-- sind, nicht in unsere eigene Datenbank schreiben … und gleichen sie in
-- regelmaessigen Abstaenden ab?" und „wichtig ist immer, dass wir unsere
-- Quellen angeben."
--
-- (2) PLZ -> Ortschaften/Gemeinde/Kreis. Bis hier fragte JEDER Bericht
--     OpenPLZ live (bis zu zweimal: Kreis und eindeutige Gemeinde). Die
--     Antwort liegt jetzt je PLZ hier und wird nach 90 Tagen neu geholt.
--     Gespeichert wird die Antwort unveraendert - die Auswertung bleibt im
--     Code (AgsResolver), so kann man sie jederzeit anders lesen.
--
-- (6) Laufzeiten. Bis hier wurde keine Dauer gespeichert - weder je Bericht
--     noch je externem Dienst. Ohne Messung ist jede Aussage ueber den
--     Engpass eine Vermutung.

CREATE TABLE IF NOT EXISTS mb.plz_orte (
  plz           TEXT        PRIMARY KEY,
  antwort       JSONB       NOT NULL,          -- Localities-Antwort von OpenPLZ, unveraendert
  quelle        TEXT        NOT NULL DEFAULT 'OpenPLZ API (openplzapi.org), Endpunkt /de/Localities',
  lizenz        TEXT        NOT NULL DEFAULT 'ODbL / amtliche Verwaltungsdaten laut openplzapi.org',
  abgerufen_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mb.laufzeiten (
  id         BIGSERIAL   PRIMARY KEY,
  art        TEXT        NOT NULL,             -- bericht | dienst
  name       TEXT        NOT NULL,             -- z. B. bericht_gesamt, sale, rent, micro, macro, zensus, boris, report_text
  ms         INTEGER     NOT NULL,
  ok         BOOLEAN     NOT NULL DEFAULT true,
  schnell    BOOLEAN,                          -- Schnell-Modus (Quick-Check)
  stufe      INTEGER,
  bericht_id BIGINT,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS laufzeiten_name_ts ON mb.laufzeiten (name, ts DESC);
