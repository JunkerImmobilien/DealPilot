'use strict';
/*
 * supportService.js (v777) — Support-Tickets + Kundenzufriedenheit.
 * Wird von der /feedback-Route (best-effort) und vom Admin-Portal genutzt.
 */
const { query } = require('../db/pool');

async function createTicketFromSubmission(opts) {
  opts = opts || {};
  const t = await query(
    `INSERT INTO support_tickets (user_id, contact_email, category, subject, object_snapshot, status, last_activity_at)
     VALUES ($1,$2,$3,$4,$5,'new',NOW()) RETURNING id`,
    [opts.userId || null, opts.contactEmail || null, opts.category || null,
     (opts.subject || '').slice(0, 255),
     opts.objectSnapshot ? JSON.stringify(opts.objectSnapshot) : null]
  );
  const ticketId = t.rows[0].id;
  const _um = await query(
    `INSERT INTO ticket_messages (ticket_id, sender, body) VALUES ($1,'user',$2) RETURNING id`,
    [ticketId, opts.message || '']
  );
  return { ticketId: ticketId, messageId: _um.rows[0].id };
}

async function recordFeedback(opts) {
  opts = opts || {};
  const rating = parseInt(opts.overallRating, 10);
  await query(
    `INSERT INTO feedback_entries (user_id, contact_email, overall_rating, criteria, message)
     VALUES ($1,$2,$3,$4,$5)`,
    [opts.userId || null, opts.contactEmail || null,
     (isNaN(rating) ? null : rating),
     opts.criteria ? JSON.stringify(opts.criteria) : null,
     opts.message || null]
  );
  return { ok: true };
}

async function listTickets(opts) {
  opts = opts || {};
  const params = []; let wsql = '';
  if (opts.status && opts.status !== 'all') { params.push(opts.status); wsql = 'WHERE t.status = $1'; }
  const r = await query(
    `SELECT t.id, t.contact_email, t.category, t.subject, t.status,
            t.created_at, t.last_activity_at, u.email AS user_email,
            (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id)::int AS msg_count
       FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id
       ${wsql}
      ORDER BY (t.status = 'closed') ASC, t.last_activity_at DESC
      LIMIT 300`,
    params
  );
  return r.rows;
}

async function getTicket(id) {
  const t = await query(
    `SELECT t.*, u.email AS user_email
       FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
    [id]
  );
  if (t.rowCount === 0) return null;
  const m = await query(
    `SELECT id, sender, body, created_at FROM ticket_messages
      WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [id]
  );
  let _att = [];
  try {
    const a = await query(
      `SELECT id, message_id, sender, filename, mime, size_bytes, created_at
         FROM ticket_attachments WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    _att = a.rows;
  } catch (e) { _att = []; }
  return { ticket: t.rows[0], messages: m.rows, attachments: _att };
}

async function addReply(opts) {
  opts = opts || {};
  const t = await query('SELECT id, contact_email, subject FROM support_tickets WHERE id = $1', [opts.ticketId]);
  if (t.rowCount === 0) return null;
  const _am = await query(
    `INSERT INTO ticket_messages (ticket_id, sender, body) VALUES ($1,'admin',$2) RETURNING id`,
    [opts.ticketId, opts.body || '']
  );
  await query(`UPDATE support_tickets SET status = 'waiting', last_activity_at = NOW() WHERE id = $1`, [opts.ticketId]);
  const _r = t.rows[0]; _r.messageId = _am.rows[0].id; // v777h-reply-msgid
  return _r; // { id, contact_email, subject, messageId }
}

async function setStatus(opts) {
  opts = opts || {};
  const allowed = ['new', 'open', 'waiting', 'closed'];
  if (allowed.indexOf(opts.status) < 0) return { error: 'invalid status' };
  await query(`UPDATE support_tickets SET status = $1, last_activity_at = NOW() WHERE id = $2`, [opts.status, opts.ticketId]);
  return { ok: true };
}

async function listFeedback() {
  const r = await query(
    `SELECT f.id, f.overall_rating, f.criteria, f.message, f.created_at,
            u.email AS user_email, f.contact_email
       FROM feedback_entries f LEFT JOIN users u ON u.id = f.user_id
      ORDER BY f.created_at DESC LIMIT 300`
  );
  return r.rows;
}

const _FB_CRIT_KEYS = ['ux','workflow','onboarding','kpis','score','pdf','ai','performance'];
function _fbPeriodWhere(period) {
  if (period === 'year')  return "AND created_at >= date_trunc('year', NOW())";
  if (period === 'month') return "AND created_at >= date_trunc('month', NOW())";
  return '';
}
// from/to (YYYY-MM-DD) -> parametrisiertes Datumsfenster; sonst Perioden-Logik.
function _fbRangeClause(period, from, to, params) {
  const okDate = function (x) { return typeof x === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x); };
  if (okDate(from) || okDate(to)) {
    let c = '';
    if (okDate(from)) { params.push(from); c += ' AND created_at >= $' + params.length; }
    if (okDate(to))   { params.push(to);   c += " AND created_at < ($" + params.length + "::date + interval '1 day')"; }
    return c;
  }
  return _fbPeriodWhere(period);
}
async function feedbackStats(period, from, to) {
  const params = [];
  const w = _fbRangeClause(period, from, to, params);
  const r = await query(
    'SELECT COUNT(*)::int AS n, ROUND(AVG(overall_rating)::numeric, 2) AS avg_rating' +
    ' FROM feedback_entries WHERE overall_rating > 0 ' + w, params
  );
  // Schnitt je Kriterium aus dem JSONB-Feld (nur Werte > 0 zaehlen)
  const byCriterion = {};
  for (let i = 0; i < _FB_CRIT_KEYS.length; i++) {
    const k = _FB_CRIT_KEYS[i];
    const cr = await query(
      "SELECT ROUND(AVG(v)::numeric,2) AS avg, COUNT(*)::int AS n FROM (" +
      "  SELECT (criteria->>'" + k + "')::numeric AS v FROM feedback_entries" +
      "   WHERE criteria ? '" + k + "' AND (criteria->>'" + k + "') ~ '^[0-9]+$' " + w +
      ") q WHERE v > 0", params
    );
    byCriterion[k] = { avg: cr.rows[0] && cr.rows[0].avg != null ? Number(cr.rows[0].avg) : null,
                       n: cr.rows[0] ? cr.rows[0].n : 0 };
  }
  const base = r.rows[0] || { n: 0, avg_rating: null };
  return { n: base.n, avg_rating: base.avg_rating, period: period || 'all', byCriterion: byCriterion };
}

async function listFeedbackRange(period, from, to) {
  const params = [];
  const w = _fbRangeClause(period, from, to, params);
  const r = await query(
    'SELECT f.overall_rating, f.criteria, f.message, f.created_at, u.email AS user_email, f.contact_email' +
    ' FROM feedback_entries f LEFT JOIN users u ON u.id = f.user_id' +
    ' WHERE 1=1 ' + w + ' ORDER BY f.created_at DESC LIMIT 5000', params
  );
  return r.rows;
}

async function saveAttachments(opts) {
  opts = opts || {};
  const files = Array.isArray(opts.files) ? opts.files : [];
  if (!opts.ticketId || !files.length) return [];
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const base = process.env.UPLOAD_DIR || '/app/uploads';
  const dir = path.join(base, 'tickets', String(opts.ticketId));
  fs.mkdirSync(dir, { recursive: true });
  const out = [];
  for (const f of files) {
    if (!f || !f.buffer) continue;
    const mime = f.mimetype || 'application/octet-stream';
    let ext = '';
    const mm = /^image\/(png|jpe?g|gif|webp)$/i.exec(mime);
    if (mm) ext = '.' + mm[1].toLowerCase().replace('jpeg', 'jpg');
    else if (f.originalname && /\.[a-z0-9]{2,5}$/i.test(f.originalname)) ext = f.originalname.slice(f.originalname.lastIndexOf('.'));
    const fname = crypto.randomUUID() + ext;
    const abspath = path.join(dir, fname);
    fs.writeFileSync(abspath, f.buffer);
    const r = await query(
      `INSERT INTO ticket_attachments (ticket_id, message_id, sender, filename, mime, size_bytes, path)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [opts.ticketId, opts.messageId || null, opts.sender || 'user',
       String(f.originalname || fname).slice(0, 255), mime, (f.size || (f.buffer ? f.buffer.length : 0)), abspath]
    );
    out.push({ id: r.rows[0].id, filename: f.originalname || fname, mime: mime });
  }
  return out;
}

async function getAttachment(id) {
  const r = await query(
    `SELECT id, ticket_id, filename, mime, size_bytes, path FROM ticket_attachments WHERE id = $1`,
    [id]
  );
  if (r.rowCount === 0) return null;
  return r.rows[0];
}

module.exports = {
  createTicketFromSubmission, recordFeedback,
  listTickets, getTicket, addReply, setStatus,
  saveAttachments, getAttachment,
  listFeedback, feedbackStats, listFeedbackRange, FB_CRIT_KEYS: _FB_CRIT_KEYS
};
