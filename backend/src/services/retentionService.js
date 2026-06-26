'use strict';
/**
 * v799 — Kundenbindung (Retention) Service
 *
 *  - getSettings() / saveSettings(): retention_settings (singleton id=1)
 *  - listExpiring(daysBefore): Abos, die in <= daysBefore Tagen auslaufen
 *  - listInactive(days): aktive User ohne Login seit >= days Tagen
 *  - defaultExpiryTemplate() / defaultInactiveTemplate(): Standard-Mailtexte
 *  - runOnce({ dryRun }): prueft Kriterien + verschickt (mit Dedup ueber retention_log)
 *
 * Mails ueber mailerService + mailLayout (Boarding-Pass-Wrap).
 * Platzhalter in Templates: {{name}}, {{days}}, {{date}}.
 */

const { query } = require('../db/pool');
const mailer = require('./mailerService');

let _mailLayout = null;
try { _mailLayout = require('./mailLayout'); } catch (e) { _mailLayout = null; }

const APP_URL = process.env.FRONTEND_BASE_URL || 'https://dealpilot.junker-immobilien.io';

// ── Standard-Templates ────────────────────────────────────────
function defaultExpiryTemplate() {
  return {
    subject: 'Dein DealPilot-Zugang l\u00e4uft bald aus',
    body:
      'Hallo {{name}},\n\n' +
      'dein DealPilot-Abo l\u00e4uft in {{days}} Tagen (am {{date}}) aus.\n\n' +
      'Damit du deine Objekte, Analysen und Marktberichte ohne Unterbrechung weiter nutzen kannst, ' +
      'verl\u00e4ngere am besten rechtzeitig direkt in der App.\n\n' +
      'Wenn du Fragen hast oder Unterst\u00fctzung brauchst, antworte einfach auf diese Mail \u2014 wir helfen gern.\n\n' +
      'Viele Gr\u00fc\u00dfe\nDein DealPilot-Team'
  };
}

function defaultInactiveTemplate() {
  return {
    subject: 'Wir sind f\u00fcr dich da \u2014 alles okay bei dir?',
    body:
      'Hallo {{name}},\n\n' +
      'wir haben gemerkt, dass du DealPilot seit {{days}} Tagen nicht mehr genutzt hast \u2014 ' +
      'und wollten kurz nachfragen: Alles okay? Hakt es irgendwo?\n\n' +
      'Falls du Unterst\u00fctzung brauchst, k\u00f6nnen wir dir gern helfen:\n' +
      '\u2022 Pers\u00f6nlicher Support \u2014 antworte einfach auf diese Mail\n' +
      '\u2022 Webinare & Einstiegshilfen, damit du das Maximum aus deinen Analysen holst\n\n' +
      'Wir w\u00fcrden uns freuen, dich wieder an Bord zu haben.\n\n' +
      'Viele Gr\u00fc\u00dfe\nDein DealPilot-Team'
  };
}

// ── Settings ──────────────────────────────────────────────────
async function getSettings() {
  await query('INSERT INTO retention_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
  const r = await query('SELECT * FROM retention_settings WHERE id = 1');
  const s = r.rows[0] || {};
  // Defaults fuer leere Templates einsetzen (nicht speichern, nur ausliefern)
  const exT = defaultExpiryTemplate();
  const inT = defaultInactiveTemplate();
  return {
    expiry_enabled: !!s.expiry_enabled,
    expiry_days_before: s.expiry_days_before != null ? s.expiry_days_before : 14,
    expiry_subject: s.expiry_subject || exT.subject,
    expiry_body: s.expiry_body || exT.body,
    inactive_enabled: !!s.inactive_enabled,
    inactive_days: s.inactive_days != null ? s.inactive_days : 30,
    inactive_subject: s.inactive_subject || inT.subject,
    inactive_body: s.inactive_body || inT.body,
    updated_at: s.updated_at || null
  };
}

async function saveSettings(p) {
  p = p || {};
  await query('INSERT INTO retention_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
  await query(
    `UPDATE retention_settings SET
       expiry_enabled = $1, expiry_days_before = $2, expiry_subject = $3, expiry_body = $4,
       inactive_enabled = $5, inactive_days = $6, inactive_subject = $7, inactive_body = $8,
       updated_at = NOW()
     WHERE id = 1`,
    [
      !!p.expiry_enabled,
      _int(p.expiry_days_before, 14, 1, 365),
      p.expiry_subject || null,
      p.expiry_body || null,
      !!p.inactive_enabled,
      _int(p.inactive_days, 30, 1, 3650),
      p.inactive_subject || null,
      p.inactive_body || null
    ]
  );
  return getSettings();
}

function _int(v, def, min, max) {
  var n = parseInt(v, 10);
  if (isNaN(n)) return def;
  if (min != null && n < min) n = min;
  if (max != null && n > max) n = max;
  return n;
}

// ── Listen ────────────────────────────────────────────────────
// Abos, die in <= daysBefore Tagen auslaufen (current_period_end in der Zukunft, aber nah).
async function listExpiring(daysBefore) {
  const d = _int(daysBefore, 14, 1, 365);
  const r = await query(
    `SELECT u.id, u.email, u.name, s.plan_id, s.current_period_end,
            CEIL(EXTRACT(EPOCH FROM (s.current_period_end - NOW())) / 86400)::int AS days_left
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
      WHERE s.status = 'active'
        AND s.plan_id <> 'free'
        AND s.current_period_end IS NOT NULL
        AND s.current_period_end > NOW()
        AND s.current_period_end <= NOW() + ($1 || ' days')::interval
        AND u.deleted_at IS NULL
        AND u.is_active = true
      ORDER BY s.current_period_end ASC`,
    [String(d)]
  );
  return r.rows;
}

// Aktive User ohne Login seit >= days Tagen.
async function listInactive(days) {
  const d = _int(days, 30, 1, 3650);
  const r = await query(
    `SELECT u.id, u.email, u.name, u.last_login_at,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - u.last_login_at)) / 86400)::int AS days_inactive
       FROM users u
      WHERE u.deleted_at IS NULL
        AND u.is_active = true
        AND u.is_test_user = false
        AND u.last_login_at IS NOT NULL
        AND u.last_login_at <= NOW() - ($1 || ' days')::interval
      ORDER BY u.last_login_at ASC`,
    [String(d)]
  );
  return r.rows;
}

// ── Template-Rendering ────────────────────────────────────────
function _fill(tpl, vars) {
  return String(tpl || '').replace(/\{\{(\w+)\}\}/g, function (_, k) {
    return (vars && vars[k] != null) ? String(vars[k]) : '';
  });
}

let _tplSvc = null; /* v802-html-body */
try { _tplSvc = require('./retentionTemplateService'); } catch (e) { _tplSvc = null; }
function _looksLikeHtml(s) { return /<[a-z][\s\S]*>/i.test(String(s || '')); }
function _sanitizeMailHtml(html) {
  let h = String(html || '');
  h = h.replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select)\b[^>]*>/gi, '');
  h = h.replace(/<!--[\s\S]*?-->/g, '');
  h = h.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '').replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  h = h.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  h = h.replace(/(href|src)\s*=\s*"\s*(javascript|data(?!:image\/)|vbscript):[^"]*"/gi, '$1="#"');
  h = h.replace(/(href|src)\s*=\s*'\s*(javascript|data(?!:image\/)|vbscript):[^']*'/gi, "$1='#'");
  return h;
}
async function _wrapHtml(subject, bodyText) { /* v802-html-body: async + Hintergrund */
  // Wenn ein eigener Renderer (mit Hintergrund-Vorlage) verfuegbar ist, exakt wie die Vorschau rendern.
  if (_tplSvc && typeof _tplSvc.previewHtml === 'function') {
    try { return await _tplSvc.previewHtml(subject, bodyText); } catch (e) { /* fallback unten */ }
  }
  const inner = _looksLikeHtml(bodyText) ? _sanitizeMailHtml(bodyText) : _escapeHtml(bodyText).replace(/\n/g, '<br>');
  const bodyHtml = '<div style="font-size:15px;line-height:1.6;color:#1b1815;">' + inner + '</div>';
  if (_mailLayout && typeof _mailLayout.wrap === 'function') {
    try {
      return _mailLayout.wrap({
        preheader: subject,
        heroKicker: 'DealPilot',
        heroTitle: subject,
        bodyHtml: bodyHtml,
        footerNote: 'Junker Immobilien \u00b7 DealPilot'
      });
    } catch (e) { /* fallback unten */ }
  }
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">' + bodyHtml + '</div>';
}

function _escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Versand mit Dedup ─────────────────────────────────────────
async function _alreadySent(userId, kind, refKey) {
  const r = await query(
    'SELECT 1 FROM retention_log WHERE user_id = $1 AND kind = $2 AND ref_key = $3 LIMIT 1',
    [userId, kind, refKey]
  );
  return r.rowCount > 0;
}

async function _logSent(userId, kind, refKey, meta) {
  try {
    await query(
      'INSERT INTO retention_log (user_id, kind, ref_key, meta) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [userId, kind, refKey, meta ? JSON.stringify(meta) : null]
    );
  } catch (e) { /* ignore */ }
}

async function _sendOne(row, kind, settings, vars, refKey) {
  if (!row.email) return { skipped: 'no_email' };
  if (await _alreadySent(row.id, kind, refKey)) return { skipped: 'already_sent' };

  const subject = (kind === 'expiry') ? settings.expiry_subject : settings.inactive_subject;
  const bodyTpl = (kind === 'expiry') ? settings.expiry_body : settings.inactive_body;
  const body = _fill(bodyTpl, vars);
  const subj = _fill(subject, vars);

  await mailer.sendMail({
    to: row.email,
    subject: subj,
    text: body,
    html: await _wrapHtml(subj, body)
  });
  await _logSent(row.id, kind, refKey, { email: row.email });
  return { sent: true };
}

/**
 * runOnce — wird vom Scheduler (taeglich) ODER manuell (Admin "jetzt senden") aufgerufen.
 * dryRun=true: nur zaehlen, was verschickt WUERDE (kein Mailversand, kein Log).
 */
async function runOnce(opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;
  const force = !!opts.force; // ignoriert enabled-Schalter (fuer manuellen "jetzt senden")
  const s = await getSettings();
  const result = { expiry: { candidates: 0, sent: 0, skipped: 0 }, inactive: { candidates: 0, sent: 0, skipped: 0 }, dryRun: dryRun };

  // ── Auslauf ──
  if (force || s.expiry_enabled) {
    const rows = await listExpiring(s.expiry_days_before);
    result.expiry.candidates = rows.length;
    for (const row of rows) {
      const dateStr = row.current_period_end ? new Date(row.current_period_end).toLocaleDateString('de-DE') : '';
      const refKey = 'expiry:' + (row.current_period_end ? new Date(row.current_period_end).toISOString().slice(0, 10) : 'na');
      const vars = { name: row.name || '', days: row.days_left, date: dateStr };
      if (dryRun) {
        if (await _alreadySent(row.id, 'expiry', refKey)) result.expiry.skipped++; else result.expiry.sent++;
        continue;
      }
      try {
        const r = await _sendOne(row, 'expiry', s, vars, refKey);
        if (r.sent) result.expiry.sent++; else result.expiry.skipped++;
      } catch (e) { result.expiry.skipped++; console.error('[retention] expiry send error:', e.message); }
    }
  }

  // ── Inaktivitaet ──
  if (force || s.inactive_enabled) {
    const rows = await listInactive(s.inactive_days);
    result.inactive.candidates = rows.length;
    for (const row of rows) {
      // Dedup-Fenster: 1 Mail pro 30-Tage-Block der Inaktivitaet
      const block = Math.floor((row.days_inactive || 0) / 30);
      const refKey = 'inactive:b' + block;
      const vars = { name: row.name || '', days: row.days_inactive, date: '' };
      if (dryRun) {
        if (await _alreadySent(row.id, 'inactive', refKey)) result.inactive.skipped++; else result.inactive.sent++;
        continue;
      }
      try {
        const r = await _sendOne(row, 'inactive', s, vars, refKey);
        if (r.sent) result.inactive.sent++; else result.inactive.skipped++;
      } catch (e) { result.inactive.skipped++; console.error('[retention] inactive send error:', e.message); }
    }
  }

  return result;
}

module.exports = {
  getSettings, saveSettings,
  listExpiring, listInactive,
  defaultExpiryTemplate, defaultInactiveTemplate,
  runOnce
};
