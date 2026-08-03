-- 014_param_modell.sql  (v1066)
--
-- WARUM ES DIESE TABELLE BRAUCHT
--
-- mb.param_werte speichert ZAHLEN. Das reicht fuer Minden-Luebbecke (ein
-- Mittelwert mit Streuung) und fuer die AK-OGA-Klassen. Es reicht NICHT
-- fuer Berlin.
--
-- Berlin veroeffentlicht im Amtsblatt keine Tabelle, sondern eine
-- Regressionsgleichung:
--
--   LZS = 0,644 + 0,132 x Objektkaltmiete + 0,0013304 x 1.096 (+ 0,167)
--
-- dazu Korrekturen fuer Altbezirk, Baujahresgruppe und gewerblichen Anteil.
-- Die sechs abgedruckten Tabellen sind nur Stuetzstellen dieser Gleichung.
-- Wer eine Stuetzstelle fuer "den Liegenschaftszinssatz von Berlin" haelt,
-- verwendet einen Wert, der fuer eine Miete von 4,00 EUR/m2 gilt, bei einem
-- Objekt mit 12,00.
--
-- DIE ZWEITE, WICHTIGERE HAELFTE: MODELLKONFORMITAET (§ 10 ImmoWertV)
--
-- Berlin schreibt ausdruecklich, dass die Zinssaetze nur dann zu einem
-- marktgerechten Ergebnis fuehren, wenn mit IHREN Ansaetzen gerechnet wird:
-- Instandhaltung 13,80 EUR/m2, Verwaltung 351 EUR je Wohnung, Mietausfall
-- 2 bzw. 4 Prozent, Bodenrichtwert zum 01.01.2024.
--
-- Ein Berliner Zinssatz mit den Bewirtschaftungskosten des AGVGA-NRW-Modells
-- waere modellfremd — und das Ergebnis saehe amtlich aus, ohne es zu sein.
-- Deshalb traegt jedes Modell seine Ansaetze MIT. Wer den Zinssatz nimmt,
-- nimmt die Ansaetze dazu oder gar nichts.

CREATE TABLE IF NOT EXISTS mb.param_modell (
  id              BIGSERIAL PRIMARY KEY,

  land_code       TEXT        NOT NULL,
  ags             TEXT        NOT NULL,
  ebene           TEXT        NOT NULL
                  CHECK (ebene IN ('gemeinde','kreis','bezirk','gaa','land','bund')),
  gebiet_name     TEXT,
  gaa_name        TEXT,

  kennzahl        TEXT        NOT NULL,
  -- Innerhalb eines Modells kann es mehrere Zweige geben (Berlin: sechs
  -- Gebietsgruppen mit unterschiedlichem Zuschlag).
  zweig           TEXT        NOT NULL DEFAULT 'standard',

  -- Die Gleichung. Bewusst DATEN, nicht Code: eine Formel als Zeichenkette
  -- muesste ausgewertet werden, und ausgewerteter Text aus einer PDF ist
  -- eine Sicherheitsluecke mit Anlauf.
  --   { konstante, je_miete, je_tag, tage, zuschlag }
  formel          JSONB       NOT NULL,

  -- Zu- und Abschlaege: { altbezirk:{...}, baujahresgruppe:{...},
  --                       gewerbeanteil_pct:{...} }
  korrekturen     JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Die Ansaetze, mit denen gerechnet werden MUSS. Ohne sie kein Zinssatz.
  modellansaetze  JSONB       NOT NULL,

  -- Wofuer das Modell gilt und wofuer ausdruecklich nicht.
  --   { min_mieteinheiten, objektarten_aus:[], miete_von, miete_bis }
  geltungsbereich JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Die Stuetzstellen aus der Veroeffentlichung. Sie sind der Beleg:
  -- rechnet die Formel sie nicht nach, wird das Modell nicht gespeichert.
  belege          JSONB       NOT NULL,

  stufe           TEXT        NOT NULL CHECK (stufe IN ('A','B','C','D','E')),
  fallzahl        INTEGER,
  stichtag        DATE,
  berichtsjahr    INTEGER,
  modellversion   TEXT        NOT NULL,
  quelle_url      TEXT        NOT NULL,
  quelle_parser   TEXT        NOT NULL,
  quellenvermerk  TEXT,
  lizenz          TEXT,

  erfasst_am      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Eine Formel ohne Beleg wird nicht gespeichert.
  CONSTRAINT param_modell_belegt CHECK (jsonb_array_length(belege) > 0)
);

-- Ein Neulauf derselben Quelle verdoppelt nichts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_param_modell_quelle
  ON mb.param_modell (land_code, ags, kennzahl, zweig,
                      COALESCE(berichtsjahr, -1), quelle_url);

CREATE INDEX IF NOT EXISTS ix_param_modell_suche
  ON mb.param_modell (kennzahl, ags, ebene);
