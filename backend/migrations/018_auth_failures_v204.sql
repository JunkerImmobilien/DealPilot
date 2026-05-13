-- V204 SECURITY-FIX (H6): Account-basierter Brute-Force-Schutz
-- ─────────────────────────────────────────────────────────────────────
-- Express-Rate-Limit schützt nur pro IP. Bei Botnet (1000 IPs gegen
-- einen Account) hilft das nicht. Diese Tabelle trackt Fehlversuche
-- pro User-Account und sperrt nach 5 Fehlversuchen für 5 Minuten,
-- bei weiteren Fehlversuchen exponentiell länger.
--
-- Strategie:
--   count 1-4   → kein Lock, einfach zählen
--   count = 5   → 5 min Lock
--   count = 6   → 15 min Lock
--   count = 7   → 1h Lock
--   count = 8   → 24h Lock
--   count = 9+  → 24h Lock (gleich, kein weiteres Eskalieren)
--
-- Bei erfolgreichem Login: count = 0, locked_until = NULL
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_failures (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  count            INT NOT NULL DEFAULT 0,
  locked_until     TIMESTAMPTZ,
  last_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_ip  VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_auth_failures_locked ON auth_failures(locked_until)
  WHERE locked_until IS NOT NULL;
