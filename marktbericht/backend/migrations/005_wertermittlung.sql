-- 005_wertermittlung.sql  (Paket wertermittlung-stufe1)
-- ─────────────────────────────────────────────────────────────────────
-- Zwei neue Tabellen im Schema mb.:
--
--   mb.wert_parameter   Liegenschaftszinssaetze, Sachwertfaktoren und die
--                       uebrigen fuer die Wertermittlung erforderlichen Daten.
--                       Wird von der Harvest-Pipeline (eigenes Paket) gefuellt
--                       und hier nur GELESEN. NIE ueberschreiben — jede neue
--                       Fassung ist eine neue Zeile mit eigenem Gueltigkeits-
--                       zeitraum, damit ein Bericht von heute in zwei Jahren
--                       dieselbe Zahl zeigt.
--
--   mb.valuation_inputs Die Eingaben der Wertermittlung je Bericht.
--                       user_id-gebunden wie market_reports (v942-userbind).
--
-- KEIN ON DELETE CASCADE — gleiche Linie wie 001/002.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) Parametertabelle
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS mb.wert_parameter (
  id            BIGSERIAL PRIMARY KEY,

  -- Raumbezug: amtlicher Gemeindeschluessel des Kreises (5-stellig) bzw.
  -- Regierungsbezirk/Land bei groeberen Stufen.
  ags           TEXT        NOT NULL,
  ags_ebene     TEXT        NOT NULL DEFAULT 'kreis',   -- kreis | bezirk | land | bund

  objektart     TEXT        NOT NULL,                   -- efh | zfh | dhh | rh | etw | mfh_bis6 | mfh_ueber6 | gemischt | gewerbe | alle
  typ           TEXT        NOT NULL,                   -- lzs | sachwertfaktor | vergleichsfaktor | rohertragsfaktor | indexreihe

  wert          NUMERIC(12,4) NOT NULL,
  wert_min      NUMERIC(12,4),
  wert_max      NUMERIC(12,4),
  einheit       TEXT        NOT NULL DEFAULT 'prozent', -- prozent | faktor | eur_qm

  -- Herkunft und Belastbarkeit
  qualitaet     CHAR(1)     NOT NULL,                   -- A amtlich kreisscharf
                                                        -- B amtlich regional
                                                        -- C eigene Marktableitung
                                                        -- D gesetzlicher Auffangwert
  fallzahl      INTEGER,                                -- nur Stufe C: N der Aggregationszelle
  quelle_text   TEXT,                                   -- "GAA Kreis Minden-Luebbecke, Bericht 2025"
  quelle_url    TEXT,
  dokument_id   BIGINT,
  seite         INTEGER,

  -- Modelltreue: ein Faktor gilt nur mit dem Modell, in dem er abgeleitet wurde.
  modellversion TEXT        NOT NULL DEFAULT 'immowertv2021',  -- immowertv2021 | vor2022 | unklar

  stichtag      DATE,
  gueltig_von   DATE        NOT NULL DEFAULT CURRENT_DATE,
  gueltig_bis   DATE,

  geprueft_von  TEXT,
  geprueft_am   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lesepfad der Kaskade: exakter AGS + Objektart + Typ, beste Qualitaet,
-- gueltig am Stichtag.
CREATE INDEX IF NOT EXISTS ix_wert_parameter_lookup
  ON mb.wert_parameter (typ, ags, objektart, qualitaet, gueltig_von DESC);

CREATE INDEX IF NOT EXISTS ix_wert_parameter_ebene
  ON mb.wert_parameter (typ, ags_ebene, objektart);

-- Dieselbe Zahl aus derselben Quelle nicht doppelt einlesen.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wert_parameter_fassung
  ON mb.wert_parameter (ags, objektart, typ, qualitaet, gueltig_von, modellversion);

COMMENT ON TABLE  mb.wert_parameter IS
  'Wertermittlungsparameter (Liegenschaftszins, Sachwertfaktor, ...). Wird von der Harvest-Pipeline befuellt. NIE UPDATE auf wert — neue Fassung = neue Zeile.';
COMMENT ON COLUMN mb.wert_parameter.qualitaet IS
  'A amtlich kreisscharf | B amtlich regional | C eigene Marktableitung | D gesetzlicher Auffangwert';

-- ═══════════════════════════════════════════════════════════════════════
-- 2) Eingaben der Wertermittlung
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS mb.valuation_inputs (
  id            BIGSERIAL PRIMARY KEY,
  property_id   BIGINT      REFERENCES mb.properties(id),
  report_id     BIGINT      REFERENCES mb.market_reports(id),
  user_id       TEXT        NOT NULL,

  stufe         TEXT        NOT NULL DEFAULT 'ertragswert',  -- ertragswert | sachwert | verkehrswert
  baustatus     TEXT,                                        -- bestand | bestand_erstbezug_saniert | neubau_erstbezug | neubau_im_bau | geplant

  eingaben      JSONB       NOT NULL DEFAULT '{}'::jsonb,    -- Rohwerte des Formulars
  ergebnis      JSONB,                                       -- vollstaendige Staffel, eingefroren
  parameter_ids BIGINT[],                                    -- welche wert_parameter-Zeilen genutzt wurden

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_valuation_inputs_user   ON mb.valuation_inputs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_valuation_inputs_report ON mb.valuation_inputs (report_id);

COMMENT ON TABLE mb.valuation_inputs IS
  'Eingaben und eingefrorenes Ergebnis der Wertermittlung. user_id IMMER aus dem Token (qstrUser), nie aus dem Browser.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3) Startbestand Stufe D — § 256 BewG, bundesweit gueltig.
--    Deckt die Flaeche ab Tag 1 ab, bis die Harvest-Pipeline Stufe A/B liefert.
--    ags='00000' + ebene='bund' = greift ueberall, wenn nichts Besseres da ist.
--    Die Bodenrichtwert-Degression bei EFH rechnet der Code, nicht die Tabelle.
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO mb.wert_parameter
  (ags, ags_ebene, objektart, typ, wert, einheit, qualitaet, quelle_text, modellversion, gueltig_von)
VALUES
  ('00000','bund','efh',       'lzs', 2.5, 'prozent','D','§ 256 Abs. 1 Nr. 1 BewG — gesetzlicher Auffangwert, nicht marktabgeleitet','immowertv2021','2022-01-01'),
  ('00000','bund','zfh',       'lzs', 2.5, 'prozent','D','§ 256 Abs. 1 Nr. 1 BewG — gesetzlicher Auffangwert, nicht marktabgeleitet','immowertv2021','2022-01-01'),
  ('00000','bund','dhh',       'lzs', 2.5, 'prozent','D','§ 256 Abs. 1 Nr. 1 BewG — gesetzlicher Auffangwert, nicht marktabgeleitet','immowertv2021','2022-01-01'),
  ('00000','bund','rh',        'lzs', 2.5, 'prozent','D','§ 256 Abs. 1 Nr. 1 BewG — gesetzlicher Auffangwert, nicht marktabgeleitet','immowertv2021','2022-01-01'),
  ('00000','bund','etw',       'lzs', 3.0, 'prozent','D','§ 256 Abs. 1 Nr. 2 BewG — gesetzlicher Auffangwert, nicht marktabgeleitet','immowertv2021','2022-01-01'),
  ('00000','bund','mfh_bis6',  'lzs', 4.0, 'prozent','D','§ 256 Abs. 1 Nr. 3 BewG — gesetzlicher Auffangwert, nicht marktabgeleitet','immowertv2021','2022-01-01'),
  ('00000','bund','mfh_ueber6','lzs', 4.5, 'prozent','D','§ 256 Abs. 1 Nr. 4 BewG — gesetzlicher Auffangwert, nicht marktabgeleitet','immowertv2021','2022-01-01')
ON CONFLICT DO NOTHING;

COMMIT;
