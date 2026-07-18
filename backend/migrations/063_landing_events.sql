-- v973: anonymes Landing-Tracking (kein Cookie, keine IP, keine PII).
CREATE TABLE IF NOT EXISTS landing_events (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL,
  event_type  TEXT NOT NULL,              -- pageview | scroll | section | cta | exit | heartbeat
  path        TEXT,
  section     TEXT,
  value       INTEGER,                    -- Scroll-% oder Verweildauer (s)
  referrer    TEXT,                       -- direct | search | social | <host>
  device      TEXT,                       -- desktop | mobile | tablet
  utm_source  TEXT,
  utm_campaign TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_landing_events_created  ON landing_events (created_at);
CREATE INDEX IF NOT EXISTS idx_landing_events_type     ON landing_events (event_type);
CREATE INDEX IF NOT EXISTS idx_landing_events_session  ON landing_events (session_id);
CREATE INDEX IF NOT EXISTS idx_landing_events_type_created ON landing_events (event_type, created_at);
