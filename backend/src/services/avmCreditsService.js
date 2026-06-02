'use strict';
/**
 * 028 — Marktdaten-(AVM)-Credit-Service
 * ═══════════════════════════════════════════════════════════════
 * Getrennter Topf vom KI-Service. Speichert in ai_credits_user.avm_bonus_credits.
 *   - 1 Credit = 1 Abruf (KEIN x2 wie bei KI)
 *   - kein Monatskontingent — rein zugekaufte Credits (verfallen nicht)
 *   - Gate "ab Starter" wird in der Route geprueft (nicht hier)
 *
 * Log: ai_credits_log mit source='avm' (Verbrauch positiv, Kauf negativ).
 */
const { query } = require('../db/pool');

async function _ensure(userId) {
  await query(
    `INSERT INTO ai_credits_user (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

async function getBalance(userId) {
  await _ensure(userId);
  const r = await query(
    `SELECT avm_bonus_credits FROM ai_credits_user WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0] ? (r.rows[0].avm_bonus_credits || 0) : 0;
}

// Spiegelt die Form von aiCreditsService.getStatus (total_remaining), damit avm.js
// einheitlich damit arbeiten kann.
async function getStatus(userId) {
  const bal = await getBalance(userId);
  return { avm_credits: bal, total_remaining: bal };
}

// Zieht cost Markt-Credits ab. { ok:true } oder { ok:false, reason }
async function consume(userId, cost, endpoint, meta) {
  cost = Math.max(1, parseInt(cost, 10) || 1);
  await _ensure(userId);
  const bal = await getBalance(userId);
  if (bal < cost) {
    return { ok: false, reason: 'no_credits', balance: bal };
  }
  await query(
    `UPDATE ai_credits_user SET avm_bonus_credits = avm_bonus_credits - $1, updated_at = NOW() WHERE user_id = $2`,
    [cost, userId]
  );
  await query(
    `INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1, $2, $3, 'avm', $4)`,
    [userId, endpoint || 'avm', cost, meta ? JSON.stringify(meta) : null]
  );
  return { ok: true };
}

// Stripe-Webhook: Markt-Credits gutschreiben (Kauf). amount = Anzahl Credits (1:1).
async function addBonus(userId, amount, ref) {
  amount = Math.max(0, parseInt(amount, 10) || 0);
  if (amount === 0) return { ok: false, reason: 'zero_amount' };
  await _ensure(userId);
  await query(
    `UPDATE ai_credits_user SET avm_bonus_credits = avm_bonus_credits + $1, updated_at = NOW() WHERE user_id = $2`,
    [amount, userId]
  );
  await query(
    `INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1, 'avm-purchase', $2, 'avm', $3)`,
    [userId, -amount, JSON.stringify({ ref: ref || null })]
  );
  return { ok: true };
}

module.exports = { getBalance, getStatus, consume, addBonus };
