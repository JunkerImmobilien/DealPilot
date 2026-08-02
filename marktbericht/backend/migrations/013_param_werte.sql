-- 013_param_werte.sql  (v1054, uebernommen aus OD-02)
--
-- UMNUMMERIERT: das Paket kam als 007. Auf Staging liegt dort seit v1041
-- bereits 007_quellenregister.sql, und der mb-Track ist bis 012 durch. Eine
-- zweite 007 waere entweder abgewiesen worden oder haette die bestehende
-- ueberschrieben. Naechste freie Nummer danach: 014.
--
-- Zweck: die "sonstigen zur Wertermittlung erforderlichen Daten" (§ 193 Abs. 5
-- BauGB) aus allen Bundeslaendern an EINER Stelle, mit Herkunft an jeder Zahl.
--
-- Zwei Entwurfsentscheidungen, die nicht aufgeweicht werden:
--
-- 1) ENTWEDER Punktwert ODER Spanne, nie beides und nie keins.
--    Klassierte Quellen (IMB-DE) liefern "2500 und mehr". Das ist kein Wert
--    2500. Der CHECK unten erzwingt, dass ein klassierter Datensatz keinen
--    wert_num traegt — damit kann kein Leser versehentlich einen Punktwert
--    lesen, wo nur eine Spanne stand.
--
-- 2) Kein user_id. Das sind Referenzdaten, keine Nutzerdaten. qstrUser()
--    greift hier NICHT — es gaebe nichts zu binden und die Abfrage liefe leer.
--    Der Schutz liegt beim Schreiben (requireAdmin), nicht beim Lesen.

CREATE TABLE IF NOT EXISTS mb.param_werte (
  id              BIGSERIAL PRIMARY KEY,

  -- Verortung. ags: 8-stellig Gemeinde, 5 Kreis, 3 Bezirk, 2 Land, 'de' Bund.
  land_code       TEXT        NOT NULL,
  ags             TEXT        NOT NULL,
  ebene           TEXT        NOT NULL
                  CHECK (ebene IN ('gemeinde','subkreis','kreis','bezirk','gaa','land','bund')),
  gebiet_name     TEXT,
  gaa_name        TEXT,

  -- Was gemessen wurde
  objektart       TEXT        NOT NULL DEFAULT 'alle',
  kennzahl        TEXT        NOT NULL,
  einheit         TEXT,

  -- Der Wert: Punkt ODER Spanne
  wert_num        NUMERIC,
  wert_min        NUMERIC,
  wert_max        NUMERIC,
  klassiert       BOOLEAN     NOT NULL DEFAULT FALSE,
  offen           TEXT        CHECK (offen IN ('oben','unten')),
  wert_roh        TEXT,

  -- Herkunft. Jede Zahl traegt sie mit.
  stufe           TEXT        NOT NULL CHECK (stufe IN ('A','B','C','D','E')),
  indikativ       BOOLEAN     NOT NULL DEFAULT FALSE,
  semantik_offen  BOOLEAN     NOT NULL DEFAULT FALSE,
  berichtsjahr    INTEGER,
  stichtag        DATE,
  quelle_url      TEXT        NOT NULL,
  quelle_parser   TEXT        NOT NULL,
  lizenz          TEXT,
  quellenvermerk  TEXT,

  erfasst_am      TIMESTAMPTZ NOT NULL DEFAULT now(),
  lauf_id         BIGINT,

  -- Punkt oder Spanne, aber nicht beides und nicht nichts
  CONSTRAINT param_werte_wert_form CHECK (
    (klassiert = FALSE AND wert_num IS NOT NULL AND wert_min IS NULL AND wert_max IS NULL)
    OR
    (klassiert = TRUE  AND wert_num IS NULL     AND (wert_min IS NOT NULL OR wert_max IS NOT NULL))
  ),
  -- Klassiert heisst immer indikativ und hoechstens Stufe C
  CONSTRAINT param_werte_klassiert_stufe CHECK (
    klassiert = FALSE OR (indikativ = TRUE AND stufe IN ('C','D','E'))
  ),
  -- Offene Randklasse braucht die passende Grenze
  CONSTRAINT param_werte_offen CHECK (
    offen IS NULL
    OR (offen = 'oben'  AND wert_min IS NOT NULL AND wert_max IS NULL)
    OR (offen = 'unten' AND wert_max IS NOT NULL AND wert_min IS NULL)
  )
);

-- Ein Neulauf derselben Quelle verdoppelt nichts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_param_werte_quelle
  ON mb.param_werte (land_code, ags, ebene, objektart, kennzahl,
                     COALESCE(berichtsjahr, -1), quelle_url);

-- Die Kaskade fragt genau so: Kennzahl + Objektart, dann AGS von lang nach kurz.
CREATE INDEX IF NOT EXISTS ix_param_werte_kaskade
  ON mb.param_werte (kennzahl, objektart, ags, ebene);
CREATE INDEX IF NOT EXISTS ix_param_werte_land
  ON mb.param_werte (land_code, kennzahl);

-- ---------------------------------------------------------------------------
-- Ernte-Laeufe: was wurde wann von wo geholt, und was ist schiefgegangen.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mb.param_lauf (
  id            BIGSERIAL PRIMARY KEY,
  gestartet_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  beendet_am    TIMESTAMPTZ,
  ausloeser     TEXT        NOT NULL DEFAULT 'cli',
  land_codes    TEXT[],
  gefunden      INTEGER     NOT NULL DEFAULT 0,
  uebernommen   INTEGER     NOT NULL DEFAULT 0,
  verworfen     INTEGER     NOT NULL DEFAULT 0,
  fehler        INTEGER     NOT NULL DEFAULT 0,
  protokoll     JSONB
);

-- ---------------------------------------------------------------------------
-- Probe-Ergebnisse: die Landkarte aus OD-01, damit sie im Admin sichtbar wird
-- statt nur im Terminal zu stehen.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mb.param_probe (
  id           BIGSERIAL PRIMARY KEY,
  geprueft_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  land_code    TEXT        NOT NULL,
  schluessel   TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  http_status  INTEGER,
  content_type TEXT,
  bytes        BIGINT,
  urteil       TEXT,
  dauer_ms     INTEGER,
  fehler       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_param_probe_ziel
  ON mb.param_probe (land_code, schluessel, url);
CREATE INDEX IF NOT EXISTS ix_param_probe_land
  ON mb.param_probe (land_code, geprueft_am DESC);
