-- 048_plan_trials.sql — DealPilot Pro-Testzeitraum als Override (mand v811b)
-- Additiv: der Test ueberschreibt voruebergehend den effektiven Plan, ohne die echte
-- subscriptions-Zeile anzufassen. Nach Ablauf gilt automatisch wieder der reale Plan.
CREATE TABLE IF NOT EXISTS plan_trials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_plan TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plan_trials_user ON plan_trials(user_id);
