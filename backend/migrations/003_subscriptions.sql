-- ════════════════════════════════════════════════════
-- JUNKER IMMOBILIEN BACKEND - Migration 003
-- Subscription Plans & User Subscriptions (Stripe-based)
-- ════════════════════════════════════════════════════

-- Plans table - subscription tiers (Free, Pro, Business, Enterprise)
-- Seeded with defaults; can be updated via admin or directly in DB
CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(50) PRIMARY KEY,                    -- 'free', 'pro', 'business', 'enterprise'
  name VARCHAR(100) NOT NULL,                    -- Display name
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,       -- show on pricing page

  -- Pricing (in cents, EUR)
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_yearly_cents INTEGER NOT NULL DEFAULT 0,

  -- Stripe identifiers (set after creating products in Stripe dashboard)
  stripe_product_id VARCHAR(100),
  stripe_price_monthly_id VARCHAR(100),
  stripe_price_yearly_id VARCHAR(100),

  -- Plan limits (NULL = unlimited)
  max_objects INTEGER,                           -- max calculation entries
  max_users INTEGER,                             -- max team members (1 for solo plans)
  max_ai_analyses_monthly INTEGER,               -- AI analysis quota per month
  max_pdf_exports_monthly INTEGER,               -- PDF export quota per month
  max_photo_uploads_per_object INTEGER,          -- photos per object

  -- Feature flags (JSONB for flexibility - add new features without schema changes)
  features JSONB NOT NULL DEFAULT '{}'::jsonb,

  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS plans_updated_at ON plans;
CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Seed default plans ─────────────────────────────
INSERT INTO plans
  (id, name, description, price_monthly_cents, price_yearly_cents,
   max_objects, max_users, max_ai_analyses_monthly, max_pdf_exports_monthly,
   max_photo_uploads_per_object, features, sort_order)
VALUES
  ('free',       'Free',       'Zum Ausprobieren',
   0,    0,
   3,    1,    2,    3,    3,
   '{"export_csv": true, "ai_analysis": true, "pdf_export": true,
     "watermark": true, "support": "community"}'::jsonb,
   1),

  ('pro',        'Pro',        'F\u00fcr einzelne Investoren',
   2900, 29000,                              -- 29 €/Mo, 290 €/Jahr (~2 Monate gratis)
   NULL, 1,    50,   NULL, 12,
   '{"export_csv": true, "ai_analysis": true, "pdf_export": true,
     "watermark": false, "advanced_charts": true, "investment_thesis_ai": true,
     "support": "email"}'::jsonb,
   2),

  ('business',   'Business',   'F\u00fcr Maklerb\u00fcros & Teams',
   7900, 79000,                              -- 79 €/Mo, 790 €/Jahr
   NULL, 5,    NULL, NULL, 25,
   '{"export_csv": true, "ai_analysis": true, "pdf_export": true,
     "watermark": false, "advanced_charts": true, "investment_thesis_ai": true,
     "team_collaboration": true, "custom_branding": true, "api_access": false,
     "support": "priority"}'::jsonb,
   3),

  ('enterprise', 'Enterprise', 'Individuelle L\u00f6sung',
   29900, 299000,                            -- 299 €/Mo, 2990 €/Jahr (anpassbar)
   NULL, NULL, NULL, NULL, NULL,
   '{"export_csv": true, "ai_analysis": true, "pdf_export": true,
     "watermark": false, "advanced_charts": true, "investment_thesis_ai": true,
     "team_collaboration": true, "custom_branding": true, "api_access": true,
     "white_label": true, "sso": true, "dedicated_support": true,
     "support": "dedicated"}'::jsonb,
   4)
ON CONFLICT (id) DO NOTHING;

-- ── Stripe customers ───────────────────────────────
-- Maps users to Stripe customer IDs
CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,                   -- denormalized for webhook lookups
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_id ON stripe_customers(stripe_customer_id);

DROP TRIGGER IF EXISTS stripe_customers_updated_at ON stripe_customers;
CREATE TRIGGER stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Subscriptions ──────────────────────────────────
-- One row per user. Status mirrors Stripe states.
-- A user without a row here is on the 'free' plan implicitly.
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) NOT NULL REFERENCES plans(id),
  billing_interval VARCHAR(20) NOT NULL,         -- 'monthly' | 'yearly'

  status VARCHAR(50) NOT NULL,                   -- trialing|active|past_due|canceled|unpaid|incomplete|incomplete_expired|paused
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,

  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Stripe references
  stripe_subscription_id VARCHAR(100) UNIQUE,
  stripe_price_id VARCHAR(100),

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_billing_check CHECK (billing_interval IN ('monthly', 'yearly')),
  CONSTRAINT subscriptions_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Stripe webhook events log ──────────────────────
-- Used for idempotency (don't process the same event twice)
-- and for debugging
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id VARCHAR(100) PRIMARY KEY,                   -- Stripe event id (evt_xxx)
  type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_webhook_events(type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_received ON stripe_webhook_events(received_at DESC);

-- ── Usage tracking ─────────────────────────────────
-- Counts API actions per user per month (for plan limit enforcement)
CREATE TABLE IF NOT EXISTS usage_counters (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,                  -- 2026
  period_month INTEGER NOT NULL,                 -- 1-12
  metric VARCHAR(50) NOT NULL,                   -- 'ai_analysis', 'pdf_export', etc.
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, period_year, period_month, metric)
);

CREATE INDEX IF NOT EXISTS idx_usage_user_period ON usage_counters(user_id, period_year, period_month);

-- ── Add columns to users for Stripe linkage ────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
