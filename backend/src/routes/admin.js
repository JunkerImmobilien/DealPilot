'use strict';
/**
 * V197: Admin-Dashboard mit Test-User-Filter
 *
 * NEU gegenüber V196:
 *   - Dashboard/Users/Charts filtern is_test_user=false aus den KPIs
 *   - Neuer Endpoint: POST /admin/users/:id/toggle-test
 *   - POST /admin/users akzeptiert is_test_user
 *   - GET /admin/users gibt is_test_user zurück
 *   - User-Filter: status=test um Test-User zu sehen
 */

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const jwt = require('jsonwebtoken');

const router = express.Router();
const { requireAdmin, requireRole, signAdminToken } = require('../middleware/adminAuth');

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

async function audit(db, adminId, adminEmail, action, targetType, targetId, payload, ip, userAgent, success = true) {
  try {
    await db.query(
      `INSERT INTO admin_audit_log
       (admin_user_id, admin_email, action, target_type, target_id, payload, ip, user_agent, success)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
      [adminId, adminEmail, action, targetType, targetId,
       payload ? JSON.stringify(payload) : null,
       ip, userAgent, success]
    );
  } catch (e) {
    console.warn('[audit] failed:', e.message);
  }
}

async function logLoginAttempt(db, ip, email, success) {
  try {
    await db.query(
      `INSERT INTO admin_login_attempts (ip, email_attempted, success) VALUES ($1, $2, $3)`,
      [ip || 'unknown', email || null, !!success]
    );
  } catch (e) {
    console.warn('[login-attempt] failed:', e.message);
  }
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
function csvRow(arr) { return arr.map(csvEscape).join(',') + '\r\n'; }

// ──────────────────────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────────────────────

router.post('/auth/login', async (req, res) => {
  const db = req.app.get('db');
  const { email, password, totpCode } = req.body || {};
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  if (!email || !password) {
    return res.status(400).json({ error: 'email_and_password_required' });
  }

  try {
    const attemptsResult = await db.query(
      `SELECT COUNT(*) AS cnt FROM admin_login_attempts
       WHERE ip = $1 AND success = false AND created_at > NOW() - INTERVAL '15 minutes'`,
      [ip]
    );
    if (parseInt(attemptsResult.rows[0].cnt, 10) >= 5) {
      return res.status(429).json({ error: 'too_many_attempts', message: 'Zu viele Login-Versuche. Bitte 15 Minuten warten.' });
    }

    const adminResult = await db.query(
      `SELECT id, email, role, password_hash, totp_secret, totp_enabled,
              failed_attempts, locked_until, is_active
       FROM admin_users WHERE email = $1`,
      [email.toLowerCase()]
    );
    if (!adminResult.rowCount) {
      await logLoginAttempt(db, ip, email, false);
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const admin = adminResult.rows[0];

    if (!admin.is_active) {
      await logLoginAttempt(db, ip, email, false);
      return res.status(403).json({ error: 'account_disabled' });
    }

    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      return res.status(423).json({ error: 'account_locked', locked_until: admin.locked_until });
    }

    const pwOk = await bcrypt.compare(password, admin.password_hash);
    if (!pwOk) {
      const newFails = (admin.failed_attempts || 0) + 1;
      const lockUntil = newFails >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;
      await db.query('UPDATE admin_users SET failed_attempts=$1, locked_until=$2 WHERE id=$3', [newFails, lockUntil, admin.id]);
      await logLoginAttempt(db, ip, email, false);
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    if (admin.totp_enabled) {
      if (!totpCode) {
        return res.status(200).json({ requires_totp: true });
      }
      let totpSecret = admin.totp_secret;
      if (totpSecret && totpSecret.includes(':') && totpSecret.split(':').length === 3) {
        try {
          const totpService = require('../services/totpService');
          if (totpService && typeof totpService.decryptSecret === 'function') {
            totpSecret = totpService.decryptSecret(admin.totp_secret);
          }
        } catch (e) { /* nicht kritisch */ }
      }
      const totpOk = speakeasy.totp.verify({
        secret: totpSecret,
        encoding: 'base32',
        token: String(totpCode).replace(/\s/g, ''),
        window: 1
      });
      if (!totpOk) {
        await logLoginAttempt(db, ip, email, false);
        return res.status(401).json({ error: 'invalid_totp' });
      }
    }

    await db.query('UPDATE admin_users SET failed_attempts=0, locked_until=NULL, last_login_at=NOW(), last_login_ip=$1 WHERE id=$2', [ip, admin.id]);
    await logLoginAttempt(db, ip, email, true);
    await audit(db, admin.id, admin.email, 'admin.login', null, null, null, ip, req.headers['user-agent']);

    const token = signAdminToken({ id: admin.id, email: admin.email, role: admin.role });
    res.json({
      token,
      admin: { id: admin.id, email: admin.email, role: admin.role }
    });
  } catch (err) {
    console.error('[admin/login] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

router.get('/auth/me', requireAdmin, async (req, res) => {
  res.json({ admin: req.adminUser });
});

// ──────────────────────────────────────────────────────────────
// DASHBOARD (V197: is_test_user=false in MRR/User-Counts)
// ──────────────────────────────────────────────────────────────

router.get('/dashboard', requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  try {
    // KPIs schließen Test-User aus
    const usersAgg = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_test_user = false) AS total,
        COUNT(*) FILTER (WHERE is_active = true AND deleted_at IS NULL AND is_test_user = false) AS active,
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '30 days' AND is_test_user = false) AS active_30d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days' AND is_test_user = false) AS new_7d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days' AND is_test_user = false) AS new_30d,
        COUNT(*) FILTER (WHERE is_test_user = true AND deleted_at IS NULL) AS test_users
      FROM users
    `);
    const stats = usersAgg.rows[0];

    // Plan-Verteilung schließt Test-User aus
    const planDist = await db.query(`
      SELECT
        COALESCE(p.id, 'free') AS plan_id,
        COALESCE(p.name, 'Free') AS plan_name,
        COALESCE(p.price_monthly_cents, 0) AS price_monthly_cents,
        COUNT(u.id) AS user_count
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      LEFT JOIN plans p ON p.id = s.plan_id
      WHERE u.deleted_at IS NULL AND u.is_test_user = false
      GROUP BY p.id, p.name, p.price_monthly_cents
      ORDER BY price_monthly_cents NULLS FIRST
    `);

    // MRR schließt Test-User aus
    const revenue = await db.query(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN s.billing_interval = 'monthly' THEN p.price_monthly_cents
            WHEN s.billing_interval = 'yearly' THEN p.price_yearly_cents / 12
            ELSE 0
          END
        ), 0) AS mrr_cents,
        COUNT(*) FILTER (WHERE s.status = 'active' AND p.id != 'free') AS paying_users
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'active' AND u.is_test_user = false
    `);
    const rev = revenue.rows[0];

    const recentSignups = await db.query(`
      SELECT id, email, name, created_at, is_active, is_test_user
      FROM users WHERE deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 5
    `);

    const recentLogins = await db.query(`
      SELECT id, email, name, last_login_at, is_test_user
      FROM users WHERE last_login_at IS NOT NULL AND deleted_at IS NULL
      ORDER BY last_login_at DESC LIMIT 5
    `);

    res.json({
      kpis: {
        total_users: parseInt(stats.total, 10) || 0,
        active_users: parseInt(stats.active, 10) || 0,
        active_30d: parseInt(stats.active_30d, 10) || 0,
        new_7d: parseInt(stats.new_7d, 10) || 0,
        new_30d: parseInt(stats.new_30d, 10) || 0,
        test_users: parseInt(stats.test_users, 10) || 0,
        mrr_cents: parseInt(rev.mrr_cents, 10) || 0,
        arr_cents: (parseInt(rev.mrr_cents, 10) || 0) * 12,
        paying_users: parseInt(rev.paying_users, 10) || 0
      },
      plan_distribution: planDist.rows.map(r => ({
        plan_id: r.plan_id,
        plan_name: r.plan_name,
        user_count: parseInt(r.user_count, 10),
        price_monthly_cents: parseInt(r.price_monthly_cents, 10)
      })),
      recent_signups: recentSignups.rows,
      recent_logins: recentLogins.rows
    });
  } catch (err) {
    console.error('[admin/dashboard] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// CHARTS (V197: ohne Test-User)
// ──────────────────────────────────────────────────────────────

router.get('/charts/users-trend', requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);
  try {
    const result = await db.query(`
      WITH date_series AS (
        SELECT generate_series(
          (CURRENT_DATE - INTERVAL '${days - 1} days')::date,
          CURRENT_DATE::date,
          INTERVAL '1 day'
        )::date AS day
      ),
      daily_signups AS (
        SELECT DATE(created_at) AS day, COUNT(*) AS new_count
        FROM users
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
          AND deleted_at IS NULL AND is_test_user = false
        GROUP BY DATE(created_at)
      ),
      cumulative AS (
        SELECT ds.day,
               COALESCE(s.new_count, 0)::int AS new_users,
               (SELECT COUNT(*)::int FROM users
                WHERE created_at <= ds.day + INTERVAL '1 day'
                AND deleted_at IS NULL AND is_test_user = false) AS cumulative
        FROM date_series ds
        LEFT JOIN daily_signups s ON s.day = ds.day
      )
      SELECT day, new_users, cumulative FROM cumulative ORDER BY day
    `);

    res.json({
      series: result.rows.map(r => ({
        day: r.day,
        new_users: r.new_users,
        cumulative: r.cumulative
      }))
    });
  } catch (err) {
    console.error('[admin/charts/users-trend] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

router.get('/charts/mrr-trend', requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);
  try {
    const result = await db.query(`
      WITH date_series AS (
        SELECT generate_series(
          (CURRENT_DATE - INTERVAL '${days - 1} days')::date,
          CURRENT_DATE::date,
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT
        ds.day,
        COALESCE(SUM(
          CASE
            WHEN s.billing_interval = 'monthly' THEN p.price_monthly_cents
            WHEN s.billing_interval = 'yearly' THEN p.price_yearly_cents / 12
            ELSE 0
          END
        ), 0)::bigint AS mrr_cents,
        COUNT(s.id) FILTER (WHERE p.id != 'free') AS paying_users
      FROM date_series ds
      LEFT JOIN subscriptions s
        ON s.current_period_start <= (ds.day + INTERVAL '1 day')
        AND (s.ended_at IS NULL OR s.ended_at > ds.day)
        AND s.status IN ('active', 'canceled')
      LEFT JOIN plans p ON p.id = s.plan_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE u.id IS NULL OR u.is_test_user = false
      GROUP BY ds.day ORDER BY ds.day
    `);

    res.json({
      series: result.rows.map(r => ({
        day: r.day,
        mrr_cents: parseInt(r.mrr_cents, 10) || 0,
        paying_users: parseInt(r.paying_users, 10) || 0
      }))
    });
  } catch (err) {
    console.error('[admin/charts/mrr-trend] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// USERS
// ──────────────────────────────────────────────────────────────

router.get('/users', requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const { q = '', limit = 50, offset = 0, plan = '', status = '' } = req.query;
  try {
    let where = "u.deleted_at IS NULL";
    const params = [];
    if (q && q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      where += ` AND (LOWER(u.email) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length})`;
    }
    if (plan === 'free') {
      where += ` AND s.id IS NULL`;
    } else if (plan && ['starter', 'investor', 'pro'].includes(plan)) {
      params.push(plan);
      where += ` AND p.id = $${params.length}`;
    }
    if (status === 'active') where += ` AND u.is_active = true AND u.is_test_user = false`;
    if (status === 'inactive') where += ` AND u.is_active = false`;
    if (status === 'test') where += ` AND u.is_test_user = true`;
    if (status === 'real') where += ` AND u.is_test_user = false`;

    params.push(parseInt(limit, 10) || 50);
    params.push(parseInt(offset, 10) || 0);

    const result = await db.query(`
      SELECT
        u.id, u.email, u.name, u.role, u.is_active, u.is_test_user,
        u.last_login_at, u.created_at, u.email_verified_at,
        COALESCE(p.id, 'free') AS plan_id,
        COALESCE(p.name, 'Free') AS plan_name,
        (SELECT COUNT(*) FROM objects WHERE user_id = u.id) AS object_count
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      LEFT JOIN plans p ON p.id = s.plan_id
      WHERE ${where}
      ORDER BY u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ users: result.rows, count: result.rowCount });
  } catch (err) {
    console.error('[admin/users] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// V197 NEU: Test-User-Toggle
// ──────────────────────────────────────────────────────────────

router.post('/users/:id/toggle-test', requireAdmin, requireRole('owner', 'support'), async (req, res) => {
  const db = req.app.get('db');
  const { reason = '' } = req.body || {};
  try {
    const result = await db.query(`
      UPDATE users SET is_test_user = NOT is_test_user, updated_at=NOW()
      WHERE id=$1 AND deleted_at IS NULL
      RETURNING is_test_user, email
    `, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'user_not_found' });

    const action = result.rows[0].is_test_user ? 'user.mark_as_test' : 'user.unmark_test';
    await audit(db, req.adminUser.id, req.adminUser.email, action, 'user', req.params.id,
                { reason }, req.ip, req.headers['user-agent']);

    res.json({ success: true, is_test_user: result.rows[0].is_test_user, email: result.rows[0].email });
  } catch (err) {
    console.error('[admin/users/toggle-test] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// CSV-EXPORTS (V197: enthält is_test_user)
// ──────────────────────────────────────────────────────────────

router.get('/users.csv', requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const { q = '', plan = '', status = '' } = req.query;
  try {
    let where = "u.deleted_at IS NULL";
    const params = [];
    if (q && q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      where += ` AND (LOWER(u.email) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length})`;
    }
    if (plan === 'free') {
      where += ` AND s.id IS NULL`;
    } else if (plan && ['starter', 'investor', 'pro'].includes(plan)) {
      params.push(plan);
      where += ` AND p.id = $${params.length}`;
    }
    if (status === 'active') where += ` AND u.is_active = true AND u.is_test_user = false`;
    if (status === 'inactive') where += ` AND u.is_active = false`;
    if (status === 'test') where += ` AND u.is_test_user = true`;
    if (status === 'real') where += ` AND u.is_test_user = false`;

    const result = await db.query(`
      SELECT
        u.id, u.email, u.name, u.role,
        u.is_active, u.is_test_user, u.email_verified_at, u.totp_enabled,
        u.created_at, u.last_login_at,
        COALESCE(p.id, 'free') AS plan_id,
        COALESCE(p.name, 'Free') AS plan_name,
        s.billing_interval,
        s.current_period_end,
        s.stripe_subscription_id,
        (SELECT COUNT(*) FROM objects WHERE user_id = u.id) AS object_count,
        cu.current_period_used AS credits_used,
        cu.bonus_credits
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      LEFT JOIN plans p ON p.id = s.plan_id
      LEFT JOIN ai_credits_user cu ON cu.user_id = u.id
      WHERE ${where}
      ORDER BY u.created_at DESC
    `, params);

    let csv = '\uFEFF' + csvRow([
      'ID', 'Email', 'Name', 'Rolle',
      'Aktiv', 'Test-User', 'Email-Verifiziert', 'TOTP-Aktiv',
      'Registriert', 'Letzter Login',
      'Plan-ID', 'Plan-Name', 'Billing', 'Period-End', 'Stripe-Sub',
      'Objekte', 'Credits-Verbraucht', 'Bonus-Credits'
    ]);

    for (const r of result.rows) {
      csv += csvRow([
        r.id, r.email, r.name, r.role,
        r.is_active ? 'Ja' : 'Nein',
        r.is_test_user ? 'Ja' : 'Nein',
        r.email_verified_at ? 'Ja' : 'Nein',
        r.totp_enabled ? 'Ja' : 'Nein',
        r.created_at ? new Date(r.created_at).toISOString() : '',
        r.last_login_at ? new Date(r.last_login_at).toISOString() : '',
        r.plan_id, r.plan_name,
        r.billing_interval || '',
        r.current_period_end ? new Date(r.current_period_end).toISOString() : '',
        r.stripe_subscription_id || '',
        r.object_count || 0,
        r.credits_used || 0,
        r.bonus_credits || 0
      ]);
    }

    await audit(db, req.adminUser.id, req.adminUser.email, 'export.users.csv', null, null,
                { count: result.rowCount, filters: { q, plan, status } },
                req.ip, req.headers['user-agent']);

    const filename = `dealpilot-users-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('[admin/users.csv] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

router.get('/audit-log.csv', requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const { action = '', limit = 5000 } = req.query;
  try {
    let where = '1=1';
    const params = [];
    if (action) {
      params.push(`%${action}%`);
      where += ` AND a.action LIKE $${params.length}`;
    }
    params.push(Math.min(parseInt(limit, 10) || 5000, 10000));

    const result = await db.query(`
      SELECT
        a.created_at, a.admin_email, a.action,
        a.target_type, a.target_id,
        u.email AS target_user_email,
        a.ip, a.user_agent, a.success, a.payload
      FROM admin_audit_log a
      LEFT JOIN users u ON a.target_type = 'user' AND u.id::text = a.target_id
      WHERE ${where}
      ORDER BY a.created_at DESC
      LIMIT $${params.length}
    `, params);

    let csv = '\uFEFF' + csvRow([
      'Zeit', 'Admin-Email', 'Aktion',
      'Ziel-Typ', 'Ziel-ID', 'Ziel-User-Email',
      'IP', 'User-Agent', 'Erfolg', 'Payload'
    ]);

    for (const r of result.rows) {
      csv += csvRow([
        r.created_at ? new Date(r.created_at).toISOString() : '',
        r.admin_email || '',
        r.action,
        r.target_type || '',
        r.target_id || '',
        r.target_user_email || '',
        r.ip || '',
        r.user_agent || '',
        r.success ? 'Ja' : 'Nein',
        r.payload ? JSON.stringify(r.payload) : ''
      ]);
    }

    await audit(db, req.adminUser.id, req.adminUser.email, 'export.audit.csv', null, null,
                { count: result.rowCount, action_filter: action },
                req.ip, req.headers['user-agent']);

    const filename = `dealpilot-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('[admin/audit-log.csv] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// USERS / ACTIONS — POST /users akzeptiert is_test_user
// ──────────────────────────────────────────────────────────────

router.post('/users', requireAdmin, requireRole('owner', 'support'), async (req, res) => {
  const db = req.app.get('db');
  const { email, name, plan_id = 'free', is_test_user = false } = req.body || {};

  if (!email || !name) {
    return res.status(400).json({ error: 'email_and_name_required' });
  }

  try {
    const dup = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (dup.rowCount > 0) return res.status(409).json({ error: 'email_exists' });

    const tempPassword = crypto.randomBytes(9).toString('base64').slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const result = await db.query(`
      INSERT INTO users (email, name, password_hash, role, is_active, email_verified_at, is_test_user)
      VALUES ($1, $2, $3, 'user', true, NOW(), $4)
      RETURNING id, email, name, created_at, is_test_user
    `, [email.toLowerCase(), name, passwordHash, !!is_test_user]);

    const newUser = result.rows[0];

    if (plan_id && plan_id !== 'free') {
      await db.query(`
        INSERT INTO subscriptions (user_id, plan_id, billing_interval, status, current_period_start, current_period_end)
        VALUES ($1, $2, 'monthly', 'active', NOW(), NOW() + INTERVAL '1 year')
      `, [newUser.id, plan_id]);
    }

    await audit(db, req.adminUser.id, req.adminUser.email, 'user.created', 'user', newUser.id,
                { email, plan_id, is_test_user: !!is_test_user }, req.ip, req.headers['user-agent']);

    res.json({
      user: newUser,
      temp_password: tempPassword,
      message: 'User angelegt. Initial-Passwort einmalig anzeigen, dann nie wieder zugänglich!'
    });
  } catch (err) {
    console.error('[admin/users/create] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

router.get('/users/:id', requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(`
      SELECT
        u.id, u.email, u.name, u.role, u.is_active, u.is_test_user,
        u.last_login_at, u.created_at, u.email_verified_at, u.totp_enabled,
        COALESCE(p.id, 'free') AS plan_id,
        COALESCE(p.name, 'Free') AS plan_name,
        s.billing_interval, s.current_period_end, s.cancel_at_period_end,
        s.stripe_subscription_id,
        (SELECT COUNT(*) FROM objects WHERE user_id = u.id) AS object_count,
        cu.current_period_used AS credits_used,
        cu.bonus_credits,
        cu.current_period_start AS credits_period_start
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      LEFT JOIN plans p ON p.id = s.plan_id
      LEFT JOIN ai_credits_user cu ON cu.user_id = u.id
      WHERE u.id = $1 AND u.deleted_at IS NULL
    `, [req.params.id]);

    if (!result.rowCount) return res.status(404).json({ error: 'user_not_found' });

    const auditRows = await db.query(`
      SELECT action, ip, created_at, payload AS meta, success
      FROM admin_audit_log
      WHERE target_type = 'user' AND target_id = $1
      ORDER BY created_at DESC LIMIT 20
    `, [req.params.id]);

    res.json({ user: result.rows[0], audit: auditRows.rows });
  } catch (err) {
    console.error('[admin/users/:id] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

router.post('/users/:id/change-plan', requireAdmin, requireRole('owner', 'support'), async (req, res) => {
  const db = req.app.get('db');
  const { plan_id, billing_interval = 'monthly', reason = '' } = req.body || {};

  if (!plan_id) return res.status(400).json({ error: 'plan_id_required' });
  if (!['monthly', 'yearly'].includes(billing_interval)) {
    return res.status(400).json({ error: 'invalid_billing_interval' });
  }

  try {
    const planCheck = await db.query('SELECT id FROM plans WHERE id = $1', [plan_id]);
    if (!planCheck.rowCount && plan_id !== 'free') {
      return res.status(404).json({ error: 'plan_not_found' });
    }

    await db.query(`UPDATE subscriptions SET status='canceled', ended_at=NOW() WHERE user_id=$1 AND status='active'`, [req.params.id]);

    if (plan_id !== 'free') {
      await db.query(`
        INSERT INTO subscriptions (user_id, plan_id, billing_interval, status, current_period_start, current_period_end)
        VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '1 year')
      `, [req.params.id, plan_id, billing_interval]);
    }

    await audit(db, req.adminUser.id, req.adminUser.email, 'user.plan_change', 'user', req.params.id,
                { plan_id, billing_interval, reason }, req.ip, req.headers['user-agent']);

    res.json({ success: true, plan_id, billing_interval });
  } catch (err) {
    console.error('[admin/users/change-plan] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

router.post('/users/:id/grant-credits', requireAdmin, requireRole('owner', 'support'), async (req, res) => {
  const db = req.app.get('db');
  const { amount, reason = '' } = req.body || {};
  const amt = parseInt(amount, 10);
  if (!amt || amt < 1 || amt > 10000) {
    return res.status(400).json({ error: 'invalid_amount' });
  }

  try {
    await db.query(`
      INSERT INTO ai_credits_user (user_id, bonus_credits)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET
        bonus_credits = ai_credits_user.bonus_credits + EXCLUDED.bonus_credits,
        updated_at = NOW()
    `, [req.params.id, amt]);

    await db.query(`
      INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta)
      VALUES ($1, 'admin-grant', $2, 'admin', $3::jsonb)
    `, [req.params.id, -amt, JSON.stringify({ admin_id: req.adminUser.id, reason })]);

    await audit(db, req.adminUser.id, req.adminUser.email, 'user.credits_grant', 'user', req.params.id,
                { amount: amt, reason }, req.ip, req.headers['user-agent']);

    const newState = await db.query('SELECT bonus_credits, current_period_used FROM ai_credits_user WHERE user_id = $1', [req.params.id]);
    res.json({ success: true, granted: amt, balance: newState.rows[0] });
  } catch (err) {
    console.error('[admin/users/grant-credits] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

router.post('/users/:id/reset-password', requireAdmin, requireRole('owner', 'support'), async (req, res) => {
  const db = req.app.get('db');
  const { reason = '' } = req.body || {};
  try {
    const userCheck = await db.query('SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!userCheck.rowCount) return res.status(404).json({ error: 'user_not_found' });

    const newPassword = crypto.randomBytes(9).toString('base64').slice(0, 12);
    const newHash = await bcrypt.hash(newPassword, 10);

    await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [newHash, req.params.id]);

    await audit(db, req.adminUser.id, req.adminUser.email, 'user.password_reset', 'user', req.params.id,
                { reason }, req.ip, req.headers['user-agent']);

    res.json({
      success: true,
      email: userCheck.rows[0].email,
      new_password: newPassword,
      warning: 'Dieses Passwort wird nur EINMAL angezeigt. Sofort sicher an den User übermitteln!'
    });
  } catch (err) {
    console.error('[admin/users/reset-password] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

router.post('/users/:id/toggle-active', requireAdmin, requireRole('owner', 'support'), async (req, res) => {
  const db = req.app.get('db');
  const { reason = '' } = req.body || {};
  try {
    const result = await db.query(`UPDATE users SET is_active = NOT is_active, updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL RETURNING is_active, email`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'user_not_found' });

    const action = result.rows[0].is_active ? 'user.unsuspend' : 'user.suspend';
    await audit(db, req.adminUser.id, req.adminUser.email, action, 'user', req.params.id,
                { reason }, req.ip, req.headers['user-agent']);

    res.json({ success: true, is_active: result.rows[0].is_active, email: result.rows[0].email });
  } catch (err) {
    console.error('[admin/users/toggle-active] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

router.delete('/users/:id', requireAdmin, requireRole('owner'), async (req, res) => {
  const db = req.app.get('db');
  const { confirm_email, reason = '' } = req.body || {};

  try {
    const userCheck = await db.query('SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!userCheck.rowCount) return res.status(404).json({ error: 'user_not_found' });
    if (confirm_email !== userCheck.rows[0].email) {
      return res.status(400).json({ error: 'confirmation_mismatch', message: 'confirm_email muss die Email des Users sein' });
    }

    await db.query(`
      UPDATE users
      SET deleted_at=NOW(),
          email=CONCAT('deleted-', id, '@deleted.local'),
          name='[gelöscht]',
          password_hash='[deleted]',
          is_active=false,
          totp_secret=NULL,
          totp_enabled=false
      WHERE id=$1
    `, [req.params.id]);

    await db.query(`UPDATE subscriptions SET status='canceled', ended_at=NOW() WHERE user_id=$1`, [req.params.id]);

    await audit(db, req.adminUser.id, req.adminUser.email, 'user.delete_dsgvo', 'user', req.params.id,
                { email: userCheck.rows[0].email, reason }, req.ip, req.headers['user-agent']);

    res.json({ success: true, deleted: userCheck.rows[0].email });
  } catch (err) {
    console.error('[admin/users/delete] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// AUDIT-LOG
// ──────────────────────────────────────────────────────────────

router.get('/audit-log', requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const { action = '', limit = 100, offset = 0 } = req.query;
  try {
    let where = '1=1';
    const params = [];
    if (action) {
      params.push(`%${action}%`);
      where += ` AND a.action LIKE $${params.length}`;
    }
    params.push(parseInt(limit, 10) || 100);
    params.push(parseInt(offset, 10) || 0);

    const result = await db.query(`
      SELECT
        a.id, a.action, a.ip, a.user_agent, a.created_at,
        a.payload AS meta,
        a.target_type, a.target_id,
        a.admin_email,
        u.email AS target_user_email
      FROM admin_audit_log a
      LEFT JOIN users u ON a.target_type = 'user' AND u.id::text = a.target_id
      WHERE ${where}
      ORDER BY a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({
      entries: result.rows.map(r => ({
        ...r,
        target_user_id: r.target_type === 'user' ? r.target_id : null
      }))
    });
  } catch (err) {
    console.error('[admin/audit-log] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// PLANS-LIST
// ──────────────────────────────────────────────────────────────

router.get('/plans', requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(`
      SELECT id, name, price_monthly_cents, price_yearly_cents
      FROM plans WHERE is_active = true
      ORDER BY price_monthly_cents
    `);
    res.json({ plans: result.rows });
  } catch (err) {
    console.error('[admin/plans] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

module.exports = router;
