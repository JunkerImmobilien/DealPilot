-- 031: Marktbericht-Kostentracking + Schwellen-Alert-Flag
-- Loggt jeden kostenpflichtigen Marktbericht-Abruf (QC/Objekt = fast, Vollbericht = full)
-- mit GeoMap-/OpenAI-Kosten. app_alerts verhindert Mail-Spam (1x/Tag pro Alert-Key).
CREATE TABLE IF NOT EXISTS marktbericht_cost_log (
  id                  BIGSERIAL PRIMARY KEY,
  ts                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id             INTEGER,
  kind                TEXT NOT NULL,            -- 'qc' | 'objekt' | 'voll'
  liters              INTEGER NOT NULL DEFAULT 0,
  geomap_eur          NUMERIC(10,4),
  geomap_balance_eur  NUMERIC(10,4),
  openai_eur          NUMERIC(10,4),
  address             TEXT,
  ok                  BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_mb_cost_log_ts   ON marktbericht_cost_log (ts);
CREATE INDEX IF NOT EXISTS idx_mb_cost_log_kind ON marktbericht_cost_log (kind);

CREATE TABLE IF NOT EXISTS app_alerts (
  alert_key    TEXT PRIMARY KEY,                -- z.B. 'geomap_low'
  last_sent_at TIMESTAMPTZ,
  last_value   NUMERIC(10,4)
);
