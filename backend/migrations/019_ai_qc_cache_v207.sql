-- V207a: KI-Recherche-Cache für QC-Suggest
-- ─────────────────────────────────────────────────────────────────────
-- Hintergrund: Bei mehrfachem Klick auf KI-Recherche kamen jedes Mal
-- andere Werte → kein Vertrauen. Mit temperature=0 sind die Werte zwar
-- deterministischer, aber Web-Search-Resultate können trotzdem variieren.
-- Lösung: Per Adresse + Group + Context-Hash 24h cachen.
--
-- Cache-Key = SHA-256(group + adresse_normalized + plz + kp_range)
-- Damit greift Cache auch bei minimalen Adress-Variationen ("Str." vs "Straße").
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_qc_cache (
  cache_key      VARCHAR(64) PRIMARY KEY,
  groep          VARCHAR(20) NOT NULL,   -- 'rent' | 'mgmt' | 'finance'
  adresse        TEXT,                    -- für Debug, nicht für Lookup
  result_json    JSONB NOT NULL,
  hits           INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_qc_cache_expires
  ON ai_qc_cache(expires_at);

-- Cleanup-Helper für Cron (täglich abgelaufene Einträge weg)
CREATE OR REPLACE FUNCTION cleanup_expired_ai_qc_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_qc_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
