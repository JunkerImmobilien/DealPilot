-- V197: Test-User-Flag + Credit-Purchases
-- 2026-05-17

BEGIN;

-- ─── 1. Test-User-Flag ────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_test_user boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_test_user
  ON users(is_test_user) WHERE is_test_user = true;

COMMENT ON COLUMN users.is_test_user IS
  'V197: True = User wird in MRR/ARR/Wachstum-KPIs ausgeschlossen (Beta-Tester etc.)';

-- ─── 2. Credit-Purchase-Historie ──────────────────────────
CREATE TABLE IF NOT EXISTS credit_purchases (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id         text NOT NULL,
  credits_granted int NOT NULL,
  amount_cents    int NOT NULL,
  currency        text NOT NULL DEFAULT 'eur',
  stripe_session_id    text UNIQUE,
  stripe_payment_intent text,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user
  ON credit_purchases(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_session
  ON credit_purchases(stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_status
  ON credit_purchases(status, created_at DESC);

COMMENT ON TABLE credit_purchases IS
  'V197: One-Time-Käufe von KI-Credits. status: pending/completed/failed/refunded';

COMMENT ON COLUMN credit_purchases.pack_id IS
  'Konstante: pack_5, pack_15, pack_40, pack_100 — entspricht /backend/src/services/creditPacks.js';

COMMIT;
