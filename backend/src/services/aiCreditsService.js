'use strict';
/**
 * V63.86 — KI-Credits-Service
 * ═══════════════════════════════════════════════════════════════
 * Verwaltet pro User:
 *   - Monatslimit aus Plan (Free=1, Starter=5, Investor=15, Pro=40)
 *   - aktueller Monats-Verbrauch (resettet beim Monatswechsel)
 *   - Bonus-Credits aus Käufen (verfallen erst nach Verbrauch)
 *
 * Reihenfolge der Verbrauch:
 *   1. Bonus-Credits zuerst (FIFO im Sinne dass die Anzeige sie reduziert)
 *   2. Wenn keine Bonus-Credits mehr → Monats-Credits
 *   3. Wenn beides leer → 402 Payment Required
 */
const { query } = require('../db/pool');

const PLAN_LIMITS = {
  free:     1,
  starter:  5,
  investor: 15,
  pro:      40
};

// Monats-Reset: Wenn current_period_start in einem früheren Monat liegt → reset
async function _ensureCurrentPeriod(userId) {
  await query(`
    INSERT INTO ai_credits_user (user_id) VALUES ($1)
    ON CONFLICT (user_id) DO NOTHING
  `, [userId]);

  await query(`
    UPDATE ai_credits_user
    SET current_period_used  = 0,
        current_period_start = date_trunc('month', NOW())::date,
        updated_at = NOW()
    WHERE user_id = $1
      AND current_period_start < date_trunc('month', NOW())::date
  `, [userId]);
}

async function _getPlanLimit(userId) {
  const r = await query(`
    SELECT plan_id FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1
  `, [userId]);
  const plan = r.rowCount ? r.rows[0].plan_id : 'free';
  return PLAN_LIMITS[plan] != null ? PLAN_LIMITS[plan] : 1;
}

async function getStatus(userId) {
  await _ensureCurrentPeriod(userId);
  const r = await query(`
    SELECT current_period_used, current_period_start, bonus_credits
    FROM ai_credits_user WHERE user_id = $1
  `, [userId]);
  const row = r.rows[0] || { current_period_used: 0, bonus_credits: 0, current_period_start: new Date() };
  const monthlyLimit = await _getPlanLimit(userId);
  const monthlyRemaining = Math.max(0, monthlyLimit - row.current_period_used);

  // Reset-Datum: 1. des nächsten Monats
  const next = new Date();
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(1);
  next.setUTCHours(0, 0, 0, 0);

  return {
    monthly_limit:      monthlyLimit,
    monthly_used:       row.current_period_used,
    monthly_remaining:  monthlyRemaining,
    bonus_credits:      row.bonus_credits,
    total_remaining:    monthlyRemaining + row.bonus_credits,
    period_start:       row.current_period_start,
    period_reset_at:    next.toISOString().slice(0, 10)
  };
}

// Versuche cost Credits abzuziehen. Returns { ok: true, source } oder { ok: false, reason }
async function consume(userId, cost, endpoint, meta) {
  cost = Math.max(1, parseInt(cost, 10) || 1);
  await _ensureCurrentPeriod(userId);
  const status = await getStatus(userId);

  if (status.total_remaining < cost) {
    return { ok: false, reason: 'no_credits', status: status };
  }

  // 1. Bonus zuerst aufbrauchen
  let fromBonus = Math.min(status.bonus_credits, cost);
  let fromMonthly = cost - fromBonus;

  if (fromBonus > 0) {
    await query(`UPDATE ai_credits_user SET bonus_credits = bonus_credits - $1, updated_at = NOW() WHERE user_id = $2`, [fromBonus, userId]);
    await query(`INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1,$2,$3,'bonus',$4)`,
      [userId, endpoint || 'unknown', fromBonus, meta ? JSON.stringify(meta) : null]);
  }
  if (fromMonthly > 0) {
    await query(`UPDATE ai_credits_user SET current_period_used = current_period_used + $1, updated_at = NOW() WHERE user_id = $2`, [fromMonthly, userId]);
    await query(`INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1,$2,$3,'monthly',$4)`,
      [userId, endpoint || 'unknown', fromMonthly, meta ? JSON.stringify(meta) : null]);
  }

  return { ok: true, source: fromBonus > 0 && fromMonthly === 0 ? 'bonus' : (fromBonus === 0 ? 'monthly' : 'mixed') };
}

// Admin / Stripe-Webhook-Hook: Bonus-Credits gutschreiben (Kauf)
async function addBonus(userId, amount, ref) {
  amount = Math.max(0, parseInt(amount, 10) || 0);
  if (amount === 0) return { ok: false, reason: 'zero_amount' };
  await _ensureCurrentPeriod(userId);
  await query(`UPDATE ai_credits_user SET bonus_credits = bonus_credits + $1, updated_at = NOW() WHERE user_id = $2`, [amount, userId]);
  // Log-Eintrag mit negativem cost um Käufe vom Verbrauch zu unterscheiden
  await query(`INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1,'purchase',$2,'bonus',$3)`,
    [userId, -amount, JSON.stringify({ ref: ref || null })]);
  return { ok: true };
}

// V63.91: Reines Logging ohne Credit-Verbrauch (z.B. PDF-Extraktion)
async function logExtract(userId, endpoint) {
  try {
    await query(`INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1,$2,0,'free',NULL)`,
      [userId, endpoint || 'extract']);
  } catch (e) { /* nicht kritisch */ }
  return { ok: true };
}

module.exports = {
  getStatus,
  consume,
  addBonus,
  logExtract,
  PLAN_LIMITS
};
