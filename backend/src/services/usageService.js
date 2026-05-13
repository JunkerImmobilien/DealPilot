'use strict';
const { query } = require('../db/pool');

/**
 * Increment a usage counter for a user in the current month.
 * Returns the new count.
 */
async function incrementUsage(userId, metric, by = 1) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const r = await query(
    `INSERT INTO usage_counters (user_id, period_year, period_month, metric, count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, period_year, period_month, metric) DO UPDATE SET
       count = usage_counters.count + EXCLUDED.count,
       updated_at = NOW()
     RETURNING count`,
    [userId, year, month, metric, by]
  );
  return r.rows[0].count;
}

/**
 * Get current month's usage for a user across all metrics.
 */
async function getCurrentMonthUsage(userId) {
  const now = new Date();
  const r = await query(
    `SELECT metric, count FROM usage_counters
     WHERE user_id = $1 AND period_year = $2 AND period_month = $3`,
    [userId, now.getUTCFullYear(), now.getUTCMonth() + 1]
  );
  const result = {};
  for (const row of r.rows) result[row.metric] = row.count;
  return result;
}

/**
 * Check if a user has reached their plan limit for a metric.
 * Returns { allowed, current, limit }.
 *
 * - limit === null means unlimited
 * - allowed = false when current >= limit
 */
async function checkLimit(userId, metric, planLimit) {
  if (planLimit == null) return { allowed: true, current: null, limit: null };
  const usage = await getCurrentMonthUsage(userId);
  const current = usage[metric] || 0;
  return {
    allowed: current < planLimit,
    current: current,
    limit: planLimit
  };
}

module.exports = {
  incrementUsage,
  getCurrentMonthUsage,
  checkLimit
};
