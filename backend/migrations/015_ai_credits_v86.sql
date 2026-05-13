-- ═══════════════════════════════════════════════════════════════
-- V63.86 — KI-Credits-Tracking
--
-- Tracked pro User:
--   - verbrauchte Credits im aktuellen Abrechnungs-Monat
--   - dazugekaufte Bonus-Credits (verfallen erst nach Verwendung, nicht monatlich)
--
-- HOTFIX V63.87: users.id ist UUID, nicht INTEGER (wie ursprünglich
-- in 015 angenommen). Schema entsprechend angepasst.
-- ═══════════════════════════════════════════════════════════════

-- Pro User: aktueller Monatsverbrauch + Bonus-Credit-Topf
CREATE TABLE IF NOT EXISTS ai_credits_user (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Verbrauch im aktuellen Monat (resettet automatisch bei month-rollover via API)
  current_period_used  INTEGER NOT NULL DEFAULT 0,
  current_period_start DATE    NOT NULL DEFAULT (date_trunc('month', NOW())::date),
  -- Bonus-Credits aus Käufen (überleben Monats-Reset)
  bonus_credits        INTEGER NOT NULL DEFAULT 0,
  -- Audit
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit-Log: jede einzelne KI-Anfrage
CREATE TABLE IF NOT EXISTS ai_credits_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  endpoint    VARCHAR(64) NOT NULL,         -- 'analyze' | 'lage' | 'mietspiegel' | ...
  cost        INTEGER NOT NULL DEFAULT 1,   -- Anzahl Credits diese Anfrage gekostet hat
  source      VARCHAR(16) NOT NULL,         -- 'monthly' | 'bonus'
  meta        JSONB
);

CREATE INDEX IF NOT EXISTS idx_ai_credits_log_user_date ON ai_credits_log(user_id, used_at DESC);
