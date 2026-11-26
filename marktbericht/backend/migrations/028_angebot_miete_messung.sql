-- 028_angebot_miete_messung.sql — v5090 · Angebotsmieten je Abruf, nur zusammengefasst (26.11.2026)
-- Marcel 26.11.2026: „mit jedem Abruf … die Daten mitnehmen und unsere Datenbank füllen". GeoMap hat
-- zugestimmt (Gespräch Marcel, schriftliche Bestätigung im Dezember 2026, siehe BACKLOG).
-- Je Marktbericht EINE Zeile aus der Kennzahl-Abfrage, die ohnehin läuft: kein Zusatzabruf, keine
-- Rohangebote, keine Adressen, keine Offer-IDs. Noch NICHT in der Rechnung (nur Admin-Überblick).
CREATE TABLE IF NOT EXISTS mb.angebot_miete_messung (
  id             BIGSERIAL PRIMARY KEY,
  jahr           INT  NOT NULL,
  monat          INT  NOT NULL,
  ags            TEXT,                      -- 8-stellig, sonst Kreis
  land           TEXT,                      -- erste zwei Stellen der AGS
  objektart      TEXT NOT NULL,             -- wohnung | haus | mfh
  wfl_klasse     TEXT,                      -- Zensus-Klasse der gesuchten Wohnfläche (je Wohnung beim MFH)
  bj_klasse      TEXT,                      -- Zensus-Klasse des Baujahrs
  median_eur_qm  NUMERIC(8,2) NOT NULL,
  q25_eur_qm     NUMERIC(8,2),
  q75_eur_qm     NUMERIC(8,2),
  n              INT NOT NULL,
  radius_m       INT,
  gruppe         TEXT,                      -- eng | mittel | weit bzw. Filterstufe des Anbieters
  zeitfenster_monate INT,
  quelle         TEXT NOT NULL DEFAULT 'geomap',
  erfasst_am     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS angebot_miete_messung_ort ON mb.angebot_miete_messung (land, ags, objektart, wfl_klasse);
COMMENT ON TABLE mb.angebot_miete_messung IS 'v5090 · zusammengefasste Angebotsmieten je Marktbericht (Median, n), ohne Rohangebote; noch nicht in der Rechnung';
