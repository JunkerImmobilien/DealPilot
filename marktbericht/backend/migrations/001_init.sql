-- 001_init.sql — Marktbericht-Schema (PostgreSQL + PostGIS)
-- Integrierbar in DealPilot: eigenes Schema 'mb', damit keine Tabellen-Kollision
-- mit den DealPilot-Kerntabellen (objects, users, tax_snapshots ...).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS mb;

-- Quellen-Registry (welche API/Datei lieferte was)
CREATE TABLE IF NOT EXISTS mb.api_sources (
  id           SERIAL PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,      -- 'geoapify','overpass','seed','csv_import','openai'
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL,            -- 'geocode','poi','market','ai','landvalue','macro'
  active       BOOLEAN DEFAULT TRUE,
  config       JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ETL-Läufe (Audit)
CREATE TABLE IF NOT EXISTS mb.etl_runs (
  id           SERIAL PRIMARY KEY,
  source_code  TEXT,
  job          TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running',  -- running|ok|error
  rows_in      INTEGER DEFAULT 0,
  rows_out     INTEGER DEFAULT 0,
  message      TEXT,
  started_at   TIMESTAMPTZ DEFAULT now(),
  finished_at  TIMESTAMPTZ
);

-- Adressen + Geokodierung
CREATE TABLE IF NOT EXISTS mb.addresses (
  id           SERIAL PRIMARY KEY,
  raw          TEXT,
  street       TEXT,
  house_number TEXT,
  postcode     TEXT,
  city         TEXT,
  district     TEXT,
  state        TEXT,
  country      TEXT DEFAULT 'DE',
  lat          DOUBLE PRECISION,
  lon          DOUBLE PRECISION,
  geom         geometry(Point, 4326),
  geocoder     TEXT,
  geocode_conf DOUBLE PRECISION,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mb_addr_geom ON mb.addresses USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_mb_addr_postcode ON mb.addresses (postcode);

-- Referenz-Objekt (das zu bewertende Objekt)
CREATE TABLE IF NOT EXISTS mb.properties (
  id            SERIAL PRIMARY KEY,
  external_ref  TEXT,                    -- spätere DealPilot object-id
  address_id    INTEGER REFERENCES mb.addresses(id),
  property_type TEXT,                    -- 'wohnung','haus','mfh','gewerbe'
  usage_type    TEXT,                    -- 'eigennutzung','kapitalanlage'
  living_area   DOUBLE PRECISION,        -- m²
  rooms         DOUBLE PRECISION,
  build_year    INTEGER,
  floor         INTEGER,
  condition     TEXT,                    -- 'neuwertig','gepflegt','renovierungsbeduerftig'
  energy_class  TEXT,                    -- A+..H
  purchase_price DOUBLE PRECISION,
  monthly_net_rent DOUBLE PRECISION,
  vacancy       BOOLEAN DEFAULT FALSE,
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  geom          geometry(Point, 4326),
  data          JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mb_prop_geom ON mb.properties USING GIST (geom);

-- Marktangebote (Vergleichs-Pool): Kauf- und Mietangebote
CREATE TABLE IF NOT EXISTS mb.offers (
  id            SERIAL PRIMARY KEY,
  source_code   TEXT,
  listing_type  TEXT NOT NULL,           -- 'kauf' | 'miete'
  property_type TEXT,
  postcode      TEXT,
  city          TEXT,
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  geom          geometry(Point, 4326),
  living_area   DOUBLE PRECISION,
  rooms         DOUBLE PRECISION,
  build_year    INTEGER,
  condition     TEXT,
  energy_class  TEXT,
  price         DOUBLE PRECISION,        -- Kaufpreis ODER Monatsmiete (je listing_type)
  price_per_sqm DOUBLE PRECISION,
  offer_date    DATE,
  raw           JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mb_offers_geom ON mb.offers USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_mb_offers_type ON mb.offers (listing_type, property_type);
CREATE INDEX IF NOT EXISTS idx_mb_offers_date ON mb.offers (offer_date);

-- POI / Mikrolage-Daten (aus Geoapify Places + OSM Overpass)
CREATE TABLE IF NOT EXISTS mb.poi_data (
  id            SERIAL PRIMARY KEY,
  source_code   TEXT,
  category      TEXT NOT NULL,           -- 'supermarket','school','kita','doctor','transit','park','station'
  name          TEXT,
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  geom          geometry(Point, 4326),
  ref_lat       DOUBLE PRECISION,        -- Referenzpunkt der Abfrage
  ref_lon       DOUBLE PRECISION,
  distance_m    DOUBLE PRECISION,
  raw           JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mb_poi_geom ON mb.poi_data USING GIST (geom);

-- Aggregierte Indizes (Zeitreihen) — Platzhalter für spätere echte Quellen
CREATE TABLE IF NOT EXISTS mb.rent_indices (
  id          SERIAL PRIMARY KEY,
  region_code TEXT,                      -- PLZ oder AGS
  period      DATE,
  rent_sqm    DOUBLE PRECISION,
  source_code TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mb.price_indices (
  id          SERIAL PRIMARY KEY,
  region_code TEXT,
  period      DATE,
  price_sqm   DOUBLE PRECISION,
  source_code TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Bodenrichtwerte (Stub-Tabelle, BORIS später)
CREATE TABLE IF NOT EXISTS mb.land_values (
  id          SERIAL PRIMARY KEY,
  postcode    TEXT,
  city        TEXT,
  value_sqm   DOUBLE PRECISION,
  zone        TEXT,
  ref_date    DATE,
  source_code TEXT,
  geom        geometry(Polygon, 4326),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Makro-/Mikro-Lage-Snapshots
CREATE TABLE IF NOT EXISTS mb.macro_locations (
  id            SERIAL PRIMARY KEY,
  region_code   TEXT,
  city          TEXT,
  metrics       JSONB DEFAULT '{}'::jsonb,  -- bevoelkerung, kaufkraft, arbeitslosenquote ...
  source_code   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mb.micro_locations (
  id            SERIAL PRIMARY KEY,
  property_id   INTEGER REFERENCES mb.properties(id),
  metrics       JSONB DEFAULT '{}'::jsonb,  -- Distanzen, Counts pro Kategorie
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Bewertungsergebnisse + Scores + finaler Bericht
CREATE TABLE IF NOT EXISTS mb.valuation_results (
  id            SERIAL PRIMARY KEY,
  property_id   INTEGER REFERENCES mb.properties(id),
  result        JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mb.deal_scores (
  id            SERIAL PRIMARY KEY,
  property_id   INTEGER REFERENCES mb.properties(id),
  score         DOUBLE PRECISION,
  breakdown     JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mb.market_reports (
  id            SERIAL PRIMARY KEY,
  property_id   INTEGER REFERENCES mb.properties(id),
  ai_mode       TEXT,
  payload       JSONB NOT NULL,          -- strukturierte Daten, die in die KI gingen
  report_md     TEXT,                    -- generierter Bericht (Markdown)
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Quellen-Seed
INSERT INTO mb.api_sources (code, name, kind) VALUES
  ('geoapify','Geoapify','geocode'),
  ('overpass','OSM Overpass','poi'),
  ('seed','Seed-Generator','market'),
  ('csv_import','CSV-Import','market'),
  ('dealpilot_import','DealPilot-Objekt-Import','market'),
  ('geomap','GeoMap','market'),
  ('openai','OpenAI','ai')
ON CONFLICT (code) DO NOTHING;
