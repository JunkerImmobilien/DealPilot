'use strict';
/**
 * v855 – networkCardsService.js
 * CRUD fuer Netzwerk-Partnerkarten (voller Designer: Bild-Logos mit Zoom/Position,
 * Bild-Hintergrund, Website, freie Kategorien, CTA-Verhalten) + Kategorien + Leads.
 */
const { pool } = require('../db/pool');

function normTags(tags) {
  if (Array.isArray(tags)) return JSON.stringify(tags);
  if (typeof tags === 'string') {
    var t = tags.trim();
    if (!t) return '[]';
    if (t[0] === '[') { try { JSON.parse(t); return t; } catch (e) {} }
    return JSON.stringify(t.split(',').map(function (x) { return x.trim(); }).filter(Boolean));
  }
  return '[]';
}
function normObj(o, fallback) {
  if (o && typeof o === 'object' && !Array.isArray(o)) return JSON.stringify(o);
  if (typeof o === 'string' && o.trim()[0] === '{') { try { JSON.parse(o); return o; } catch (e) {} }
  return fallback;
}
function clampInt(v, min, max, def) {
  var n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
const MITGABE_DEFAULT = '{"objekt":true,"eckdaten":true,"kontakt":true,"dr_persoenlich":false,"dr_objekt":false}';

function fields(d) {
  return [
    (d.kategorie || 'finanzierung').toString().trim() || 'finanzierung',
    d.name || 'Neue Karte',
    d.rolle || null,
    normTags(d.tags),
    d.beschreibung || null,
    d.usp || null,
    d.antwortzeit || null,
    d.verified === false ? false : true,
    d.cta_label || 'Anfrage senden',
    d.akzent || '#C9A84C',
    d.hintergrund || 'weiss',
    d.hintergrund_farbe || null,
    d.hintergrund_bild || null,
    d.kante_stil || 'k1',
    d.kante_farbe || null,
    d.kuerzel || null,
    d.logo_url || null,
    d.logo_data || null,
    clampInt(d.logo_zoom, 50, 300, 100),
    clampInt(d.logo_x, 0, 100, 50),
    clampInt(d.logo_y, 0, 100, 50),
    d.website || null,
    d.ziel_email || null,
    normObj(d.mitgabe, MITGABE_DEFAULT),
    normObj(d.anforderungen, '{}'),
    d.cta_aktion === 'gutachten_modal' ? 'gutachten_modal' : 'lead',
    d.aktiv === false ? false : true,
    Number.isFinite(+d.sortierung) ? +d.sortierung : 0
  ];
}

const COLS = 'kategorie, name, rolle, tags, beschreibung, usp, antwortzeit, verified, ' +
  'cta_label, akzent, hintergrund, hintergrund_farbe, hintergrund_bild, kante_stil, kante_farbe, ' +
  'kuerzel, logo_url, logo_data, logo_zoom, logo_x, logo_y, website, ziel_email, ' +
  'mitgabe, anforderungen, cta_aktion, aktiv, sortierung';
const PARAMS = '$1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25::jsonb,$26,$27,$28';

async function listActive() {
  const r = await pool.query(
    `SELECT id, kategorie, name, rolle, tags, beschreibung, usp, antwortzeit, verified,
            cta_label, akzent, hintergrund, hintergrund_farbe, hintergrund_bild,
            kante_stil, kante_farbe, kuerzel, logo_url, logo_data, logo_zoom, logo_x, logo_y,
            website, mitgabe, anforderungen, cta_aktion
     FROM network_cards WHERE aktiv = true
     ORDER BY kategorie, sortierung, id`
  );
  return r.rows;
}

async function listAll() {
  const r = await pool.query(
    `SELECT c.*, COALESCE(l.cnt, 0) AS leads
     FROM network_cards c
     LEFT JOIN (SELECT card_id, COUNT(*) cnt FROM network_leads GROUP BY card_id) l
       ON l.card_id = c.id
     ORDER BY c.kategorie, c.sortierung, c.id`
  );
  return r.rows;
}

async function create(d) {
  const r = await pool.query(
    `INSERT INTO network_cards (${COLS}) VALUES (${PARAMS}) RETURNING *`,
    fields(d)
  );
  return r.rows[0];
}

async function update(id, d) {
  const r = await pool.query(
    `UPDATE network_cards SET
       kategorie=$2, name=$3, rolle=$4, tags=$5::jsonb, beschreibung=$6, usp=$7,
       antwortzeit=$8, verified=$9, cta_label=$10, akzent=$11, hintergrund=$12,
       hintergrund_farbe=$13, hintergrund_bild=$14, kante_stil=$15, kante_farbe=$16,
       kuerzel=$17, logo_url=$18, logo_data=$19, logo_zoom=$20, logo_x=$21, logo_y=$22,
       website=$23, ziel_email=$24, mitgabe=$25::jsonb, anforderungen=$26::jsonb,
       cta_aktion=$27, aktiv=$28, sortierung=$29, updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id].concat(fields(d))
  );
  return r.rows[0];
}

async function remove(id) {
  const r = await pool.query('DELETE FROM network_cards WHERE id=$1 RETURNING id', [id]);
  return r.rowCount > 0;
}

async function getById(id) {
  const r = await pool.query('SELECT * FROM network_cards WHERE id=$1', [id]);
  return r.rows[0] || null;
}

async function recordLead(cardId, userId, objectRef) {
  await pool.query(
    'INSERT INTO network_leads (card_id, user_id, object_ref) VALUES ($1,$2,$3)',
    [cardId, userId || null, objectRef || null]
  );
}

/* ── Kategorien ─────────────────────────────────────────────────────────── */
async function listCategories() {
  const r = await pool.query('SELECT key, label, farbe, sortierung FROM network_categories ORDER BY sortierung, key');
  return r.rows;
}
async function listCategoriesWithCounts() {
  const r = await pool.query(
    `SELECT k.key, k.label, k.farbe, k.sortierung, COALESCE(c.cnt, 0) AS cards
     FROM network_categories k
     LEFT JOIN (SELECT kategorie, COUNT(*) cnt FROM network_cards GROUP BY kategorie) c
       ON c.kategorie = k.key
     ORDER BY k.sortierung, k.key`
  );
  return r.rows;
}
async function createCategory(d) {
  const key = String(d.key || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  if (!key) throw new Error('Ungueltiger Kategorie-Key');
  const r = await pool.query(
    `INSERT INTO network_categories (key, label, farbe, sortierung)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, farbe=EXCLUDED.farbe, sortierung=EXCLUDED.sortierung
     RETURNING *`,
    [key, d.label || key, d.farbe || '#C9A84C', Number.isFinite(+d.sortierung) ? +d.sortierung : 0]
  );
  return r.rows[0];
}
async function updateCategory(key, d) {
  const r = await pool.query(
    `UPDATE network_categories SET label=$2, farbe=$3, sortierung=$4 WHERE key=$1 RETURNING *`,
    [key, d.label || key, d.farbe || '#C9A84C', Number.isFinite(+d.sortierung) ? +d.sortierung : 0]
  );
  return r.rows[0] || null;
}
async function deleteCategory(key) {
  const c = await pool.query('SELECT COUNT(*) AS n FROM network_cards WHERE kategorie=$1', [key]);
  if (parseInt(c.rows[0].n, 10) > 0) return { ok: false, reason: 'has_cards' };
  const r = await pool.query('DELETE FROM network_categories WHERE key=$1 RETURNING key', [key]);
  return { ok: r.rowCount > 0 };
}

module.exports = {
  listActive, listAll, create, update, remove, getById, recordLead,
  listCategories, listCategoriesWithCounts, createCategory, updateCategory, deleteCategory
};
