-- ═══════════════════════════════════════════════════════════════
-- 028 — Marktdaten-(AVM)-Credits
-- Getrennter Credit-Topf (1 Credit = 1 Abruf) + Kauf-Art-Kennzeichnung.
-- Idempotent (IF NOT EXISTS) — gefahrlos mehrfach ausfuehrbar.
-- ═══════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE ai_credits_user
  ADD COLUMN IF NOT EXISTS avm_bonus_credits INTEGER NOT NULL DEFAULT 0;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'ki';

COMMENT ON COLUMN ai_credits_user.avm_bonus_credits IS
  '028: Marktdaten-Credits (1 = 1 Abruf), getrennt vom KI-Topf bonus_credits';
COMMENT ON COLUMN credit_purchases.kind IS
  '028: Kauf-Art — ki | avm';

COMMIT;
