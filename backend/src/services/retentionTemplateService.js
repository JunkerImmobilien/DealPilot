'use strict';
/**
 * v802 — Kundenbindung-Vorlagen + Hintergrund + Vorschau
 *  - listTemplates(kind) / saveTemplate / deleteTemplate  (Tabelle retention_templates)
 *  - getBackground / saveBackground                       (Tabelle retention_background, singleton)
 *  - previewHtml(subject, bodyHtml)                       (wie der echte Versand rendern)
 */
const { query } = require('../db/pool');

let _mailLayout = null;
try { _mailLayout = require('./mailLayout'); } catch (e) { _mailLayout = null; }

function _esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _looksLikeHtml(s) { return /<[a-z][\s\S]*>/i.test(String(s || '')); }
function _sanitize(html) {
  let h = String(html || '');
  h = h.replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select)\b[^>]*>/gi, '');
  h = h.replace(/<!--[\s\S]*?-->/g, '');
  h = h.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '').replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  h = h.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  h = h.replace(/(href|src)\s*=\s*"\s*(javascript|data(?!:image\/)|vbscript):[^"]*"/gi, '$1="#"');
  h = h.replace(/(href|src)\s*=\s*'\s*(javascript|data(?!:image\/)|vbscript):[^']*'/gi, "$1='#'");
  return h;
}

// ── Vorlagen ──────────────────────────────────────────────────
async function listTemplates(kind) {
  let sql = 'SELECT id, name, kind, subject, body_html, created_at FROM retention_templates';
  const params = [];
  if (kind && kind !== 'any') { params.push(kind); sql += ' WHERE kind = $1 OR kind = \'any\''; }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  const r = await query(sql, params);
  return r.rows;
}
async function saveTemplate(p) {
  p = p || {};
  const name = String(p.name || '').trim() || 'Vorlage';
  const kind = ['expiry', 'inactive', 'any'].indexOf(p.kind) >= 0 ? p.kind : 'any';
  const r = await query(
    `INSERT INTO retention_templates (name, kind, subject, body_html)
     VALUES ($1,$2,$3,$4) RETURNING id, name, kind, subject, body_html, created_at`,
    [name, kind, p.subject || null, p.body_html || null]
  );
  return r.rows[0];
}
async function deleteTemplate(id) {
  const r = await query('DELETE FROM retention_templates WHERE id = $1 RETURNING id', [id]);
  return r.rowCount > 0;
}

// ── Hintergrund (singleton) ───────────────────────────────────
async function getBackground() {
  await query('INSERT INTO retention_background (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
  const r = await query('SELECT html, name, updated_at FROM retention_background WHERE id = 1');
  return r.rows[0] || { html: null, name: null };
}
async function saveBackground(html, name) {
  await query('INSERT INTO retention_background (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
  await query('UPDATE retention_background SET html = $1, name = $2, updated_at = NOW() WHERE id = 1',
    [html || null, name || null]);
  return getBackground();
}

// ── Vorschau ──────────────────────────────────────────────────
// Rendert genau wie der Versand: HTML-Body sanitizen, ggf. in Hintergrund-Vorlage
// ({{BODY}}) einsetzen, sonst mailLayout.wrap.
async function previewHtml(subject, bodyHtml) {
  const inner = _looksLikeHtml(bodyHtml) ? _sanitize(bodyHtml) : _esc(bodyHtml).replace(/\n/g, '<br>');
  let bg = null;
  try { bg = await getBackground(); } catch (e) { bg = null; }
  if (bg && bg.html && bg.html.indexOf('{{BODY}}') >= 0) {
    return _sanitize(bg.html).replace('{{BODY}}', inner);
  }
  const body = '<div style="font-size:15px;line-height:1.6;color:#1b1815;">' + inner + '</div>';
  if (_mailLayout && typeof _mailLayout.wrap === 'function') {
    try {
      return _mailLayout.wrap({
        preheader: subject || '',
        heroKicker: 'DealPilot',
        heroTitle: subject || '',
        bodyHtml: body,
        footerNote: 'Junker Immobilien \u00b7 DealPilot'
      });
    } catch (e) { /* fallback */ }
  }
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">' + body + '</div>';
}

module.exports = {
  listTemplates, saveTemplate, deleteTemplate,
  getBackground, saveBackground,
  previewHtml
};
