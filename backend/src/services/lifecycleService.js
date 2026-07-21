'use strict';
/*
 * lifecycleService.js (v779) — Abo-Lifecycle.
 * SICHERHEIT:
 *  - dryRun = true wenn opts.dryRun ODER config.enabled = false -> es wird NICHTS gesendet/gelöscht,
 *    nur protokolliert (return.actions).
 *  - Idempotenz über lifecycle_events UNIQUE(user_id, stage): jede Stufe genau 1x pro User.
 *  - Aktive Abos werden NIE angefasst (nur status canceled/unpaid/past_due nach Periodenende).
 *  - Hard-Delete nur, wenn der User bereits soft-gelöscht ist (deleted_at gesetzt).
 *  - Admins (role='admin') ausgenommen.
 */
const { query } = require('../db/pool');
const userService = require('./userService');
const mailLayout = require('./mailLayout');
const mailer = require('./mailerService');

const DEFAULTS = {
  enabled: false, days_reminder: 2, days_warn_delete: 83,
  days_soft_delete: 90, days_hard_delete: 97, coupon_percent: 10, coupon_days: 14
};

async function getConfig() {
  try {
    const r = await query('SELECT * FROM lifecycle_config WHERE id = 1');
    return r.rows[0] || Object.assign({}, DEFAULTS);
  } catch (e) { return Object.assign({}, DEFAULTS); }
}

async function updateConfig(patch) {
  patch = patch || {};
  const allowed = ['enabled', 'days_reminder', 'days_warn_delete', 'days_soft_delete', 'days_hard_delete', 'coupon_percent', 'coupon_days'];
  const sets = [], params = [];
  for (let i = 0; i < allowed.length; i++) {
    const k = allowed[i];
    if (patch[k] !== undefined && patch[k] !== null) { params.push(patch[k]); sets.push(k + ' = $' + params.length); }
  }
  if (!sets.length) return getConfig();
  params.push(1);
  await query('UPDATE lifecycle_config SET ' + sets.join(', ') + ' WHERE id = $' + params.length, params);
  return getConfig();
}

async function listEvents(opts) {
  opts = opts || {};
  const r = await query(
    `SELECT e.stage, e.created_at, u.email
       FROM lifecycle_events e LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC LIMIT $1`,
    [opts.limit || 200]
  );
  return r.rows;
}

// ── Stripe-Winback-Gutschein (selbst-enthalten; Fehler -> null, blockt nichts) ──
async function _createCoupon(percent, days) {
  try {
    const config = require('../config');
    const Stripe = require('stripe');
    const stripe = new Stripe(config.stripe.secretKey);
    const coupon = await stripe.coupons.create({
      percent_off: percent, duration: 'once', max_redemptions: 1,
      name: 'DealPilot Winback ' + percent + '%'
    });
    const code = 'COMEBACK' + Math.random().toString(36).slice(2, 8).toUpperCase();
    await stripe.promotionCodes.create({
      coupon: coupon.id, code: code, max_redemptions: 1,
      expires_at: Math.floor(Date.now() / 1000) + days * 86400
    });
    return code;
  } catch (e) { console.error('[lifecycle] coupon failed:', e && e.message); return null; }
}

function _send(to, kicker, title, bodyText, footer) {
  if (!to) return Promise.resolve();
  return mailer.sendMail({
    to: to,
    subject: title,
    text: bodyText,
    html: mailLayout.wrap({
      brandTag: 'DEALPILOT', heroKicker: kicker, heroTitle: title,
      bodyHtml: '<div style="font-size:14px;line-height:1.6;color:#3a2e08;white-space:pre-wrap;">' + mailLayout._esc(bodyText) + '</div>',
      footerNote: footer || 'DealPilot \u00b7 Junker Immobilien'
    })
  }).catch(function (e) { console.error('[lifecycle] mail failed:', e && e.message); });
}

// Reihenfolge der Post-lapse-Stufen (aufsteigend).
const _ORDER = ['downgrade', 'warn_delete', 'soft_delete', 'hard_delete'];

// Markiert alle Stufen UNTERHALB von `stage` als erledigt (ohne Aktion/Mail).
// Verhindert, dass bei einem Catch-up-User (schon weit über mehreren Schwellen)
// ein Folge-Scan die niedrigeren Stufen rückwärts nachfeuert.
async function _supersedeBelow(userId, stage, dryRun) {
  if (dryRun) return;
  const idx = _ORDER.indexOf(stage);
  for (let k = 0; k < idx; k++) {
    await query('INSERT INTO lifecycle_events (user_id, stage) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, _ORDER[k]]);
  }
}

// Registriert die Stufe idempotent und führt die Aktion aus (außer dryRun).
async function _stage(userId, stage, dryRun, actions, email, action) {
  const ex = await query('SELECT 1 FROM lifecycle_events WHERE user_id = $1 AND stage = $2', [userId, stage]);
  if (ex.rowCount > 0) return false;
  if (dryRun) { actions.push({ userId: userId, email: email, stage: stage, dryRun: true }); return false; }
  const ins = await query(
    'INSERT INTO lifecycle_events (user_id, stage) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id',
    [userId, stage]
  );
  if (ins.rowCount === 0) return false; // paralleler Lauf war schneller
  try { await action(); } catch (e) { console.error('[lifecycle] action', stage, 'failed:', e && e.message); }
  actions.push({ userId: userId, email: email, stage: stage, dryRun: false });
  return true;
}

async function scan(opts) {
  opts = opts || {};
  const cfg = await getConfig();
  const dryRun = !!opts.dryRun || !cfg.enabled;
  const actions = [];

  // ── Reminder: vor Periodenende, nur wer gekündigt hat (cancel_at_period_end) ──
  const rem = await query(
    `SELECT s.user_id, u.email, u.name, s.current_period_end
       FROM subscriptions s JOIN users u ON u.id = s.user_id
      WHERE s.cancel_at_period_end = true
        AND s.current_period_end IS NOT NULL
        AND s.current_period_end > NOW()
        AND s.current_period_end <= NOW() + ($1 || ' days')::interval
        AND u.role <> 'admin' AND u.deleted_at IS NULL`,
    [String(cfg.days_reminder)]
  );
  for (let i = 0; i < rem.rows.length; i++) {
    const r = rem.rows[i];
    await _stage(r.user_id, 'reminder', dryRun, actions, r.email, function () {
      return _send(r.email, 'ERINNERUNG', 'Dein DealPilot-Zugang endet bald',
        'Hallo' + (r.name ? ' ' + r.name : '') + ',\n\ndein DealPilot-Abo l\u00e4uft in K\u00fcrze aus. Wenn du weiter Zugriff auf deine Analysen und dein Portfolio behalten m\u00f6chtest, verl\u00e4ngere einfach in den Einstellungen.\n\nDein DealPilot-Team',
        'Du erh\u00e4ltst diese E-Mail, weil dein Abo demn\u00e4chst endet.');
    });
  }

  // ── Post-lapse Stufen: eine pro Scan und User (höchste fällige, noch nicht erledigte) ──
  const cand = await query(
    `SELECT s.user_id, s.current_period_end, u.email, u.name, u.is_active, u.deleted_at,
            EXTRACT(EPOCH FROM (NOW() - s.current_period_end)) / 86400 AS d
       FROM subscriptions s JOIN users u ON u.id = s.user_id
      WHERE s.current_period_end IS NOT NULL
        AND s.current_period_end < NOW()
        AND s.status IN ('canceled','unpaid','past_due')
        AND u.role <> 'admin'`
  );
  for (let i = 0; i < cand.rows.length; i++) {
    const c = cand.rows[i];
    const d = Number(c.d);

    if (d >= cfg.days_hard_delete && c.deleted_at) {
      await _supersedeBelow(c.user_id, 'hard_delete', dryRun);
      await _stage(c.user_id, 'hard_delete', dryRun, actions, c.email, function () {
        return userService.deleteUser(c.user_id);
      });
      continue;
    }
    if (d >= cfg.days_soft_delete && !c.deleted_at) {
      await _supersedeBelow(c.user_id, 'soft_delete', dryRun);
      await _stage(c.user_id, 'soft_delete', dryRun, actions, c.email, async function () {
        await userService.setActive({ userId: c.user_id, isActive: false });
        await query('UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [c.user_id]);
        await _send(c.email, 'KONTO DEAKTIVIERT', 'Dein DealPilot-Konto wurde deaktiviert',
          'Hallo' + (c.name ? ' ' + c.name : '') + ',\n\ndein Konto wurde wegen l\u00e4ngerer Inaktivit\u00e4t deaktiviert. Melde dich, wenn du es reaktivieren m\u00f6chtest.\n\nDein DealPilot-Team',
          'Kontaktiere support@dealpilot.immo zur Reaktivierung.');
      });
      continue;
    }
    if (d >= cfg.days_warn_delete) {
      await _supersedeBelow(c.user_id, 'warn_delete', dryRun);
      await _stage(c.user_id, 'warn_delete', dryRun, actions, c.email, async function () {
        const code = await _createCoupon(cfg.coupon_percent, cfg.coupon_days);
        const codeLine = code
          ? ('\n\nKomm zur\u00fcck mit ' + cfg.coupon_percent + '% Rabatt \u2013 Code: ' + code + ' (g\u00fcltig ' + cfg.coupon_days + ' Tage).')
          : '';
        const tageBis = Math.max(1, cfg.days_hard_delete - cfg.days_warn_delete);
        await _send(c.email, 'LETZTE ERINNERUNG', 'Dein DealPilot-Konto wird bald gel\u00f6scht',
          'Hallo' + (c.name ? ' ' + c.name : '') + ',\n\ndein Konto wird in ca. ' + tageBis + ' Tagen endg\u00fcltig gel\u00f6scht, inklusive aller Objekte und Daten.' + codeLine + '\n\nDein DealPilot-Team',
          'Reaktivieren jederzeit \u00fcber app.dealpilot.junker-immobilien.io');
      });
      continue;
    }
    if (d >= 0) {
      await _stage(c.user_id, 'downgrade', dryRun, actions, c.email, function () {
        return _send(c.email, 'TARIF GE\u00c4NDERT', 'Dein DealPilot-Konto ist jetzt im Free-Tarif',
          'Hallo' + (c.name ? ' ' + c.name : '') + ',\n\ndein Abo ist ausgelaufen \u2013 dein Konto l\u00e4uft jetzt im kostenlosen Free-Tarif weiter. Deine Daten bleiben erhalten. Jederzeit wieder upgraden in den Einstellungen.\n\nDein DealPilot-Team',
          'Du kannst jederzeit wieder upgraden.');
      });
      continue;
    }
  }

  return { enabled: cfg.enabled, dryRun: dryRun, count: actions.length, actions: actions.slice(0, 200) };
}

module.exports = { getConfig, updateConfig, listEvents, scan };
