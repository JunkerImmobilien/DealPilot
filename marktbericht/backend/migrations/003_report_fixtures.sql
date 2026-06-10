-- 003_report_fixtures.sql — gespeicherte Berichte fuer kostenlosen Replay.
-- Ein echter Bericht wird einmal abgerufen (kostet GeoMap-Guthaben) und hier gespeichert.
-- Beim Weiterentwickeln (v.a. Frontend/PDF) laedt man den gespeicherten Stand ueber
-- /reports/replay -> KEINE erneuten API-Kosten. key='last' = zuletzt erstellter Bericht.
CREATE TABLE IF NOT EXISTS mb.report_fixtures (
  key        TEXT PRIMARY KEY,     -- 'last' oder object_key (z.B. 'geo:52.1:8.6:wohnung:95:1995')
  address    TEXT,
  result     JSONB NOT NULL,        -- vollstaendiges Orchestrator-Ergebnis (data + report_md + ...)
  created_at TIMESTAMPTZ DEFAULT now()
);
