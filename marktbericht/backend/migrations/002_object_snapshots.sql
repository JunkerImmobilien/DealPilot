-- 002_object_snapshots.sql — Verlaufs-Historie pro Objekt.
-- Jeder erstellte Marktbericht legt einen Snapshot mit den Kern-KPIs ab.
-- Der object_key gruppiert wiederkehrende Berichte desselben Objekts, sodass
-- man den zeitlichen Verlauf (Marktwert, Score, Rendite ...) abrufen kann.
-- Bei DealPilot-Integration: object_key = 'dp:<dealpilot_object_id>' -> exakte Zuordnung.

CREATE TABLE IF NOT EXISTS mb.object_snapshots (
  id                SERIAL PRIMARY KEY,
  object_key        TEXT NOT NULL,                 -- gruppiert Snapshots desselben Objekts
  external_ref      TEXT,                          -- DealPilot-Objekt-ID (falls aus .dpkt)
  property_id       INTEGER REFERENCES mb.properties(id),
  report_id         INTEGER REFERENCES mb.market_reports(id),
  address           TEXT,
  lat               DOUBLE PRECISION,
  lon               DOUBLE PRECISION,
  property_type     TEXT,
  living_area       NUMERIC,
  build_year        INTEGER,
  -- Kern-KPIs fuer den Verlauf
  market_value      NUMERIC,
  market_value_low  NUMERIC,
  market_value_high NUMERIC,
  median_sqm        NUMERIC,
  gross_yield_pct   NUMERIC,
  rent_multiplier   NUMERIC,
  deal_score        INTEGER,
  micro_score       INTEGER,
  macro_score       INTEGER,
  price_cagr_pct    NUMERIC,
  confidence        NUMERIC,
  comparable_group  TEXT,                          -- 'eng' | 'breit'
  ai_mode           TEXT,
  data              JSONB,                          -- vollstaendiges Ergebnis (Flexibilitaet)
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_object_snapshots_key  ON mb.object_snapshots (object_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_object_snapshots_ref  ON mb.object_snapshots (external_ref);
