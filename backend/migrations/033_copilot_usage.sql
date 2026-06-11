-- v596: Co-Pilot Monatslimit (persistiert, Reset zum Monatsanfang)
CREATE TABLE IF NOT EXISTS copilot_usage (
  user_id      text PRIMARY KEY,
  period_start date NOT NULL DEFAULT date_trunc('month', NOW())::date,
  used         integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT NOW()
);
