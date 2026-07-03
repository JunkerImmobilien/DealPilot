'use strict';
/**
 * v852 – networkCardsService.js
 * CRUD fuer Netzwerk-Partnerkarten (Designer-Felder) + Lead-Erfassung.
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
const MITGABE_DEFAULT = '{"objekt":true,"eckdaten":true,"kontakt":true,"dr_persoenlich":false,"dr_objekt":false}';

function fields(d) {
  return [
    d.kategorie === 'gutachter' ? 'gutachter' : 'finanzierung',
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
    d.kante_stil || 'k1',
    d.kante_farbe || null,
    d.kuerzel || null,
    d.logo_url || null,
    d.ziel_email || null,
    normObj(d.mitgabe, MITGABE_DEFAULT),
    normObj(d.anforderungen, '{}'),
    d.aktiv === false ? false : true,
    Number.isFinite(+d.sortierung) ? +d.sortierung : 0
  ];
}

const COLS = 'kategorie, name, rolle, tags, beschreibung, usp, antwortzeit, verified, ' +
  'cta_label, akzent, hintergrund, hintergrund_farbe, kante_stil, kante_farbe, ' +
  'kuerzel, logo_url, ziel_email, mitgabe, anforderungen, aktiv, sortierung';

async function listActive() {
  const r = await pool.query(
    `SELECT id, kategorie, name, rolle, tags, beschreibung, usp, antwortzeit, verified,
            cta_label, akzent, hintergrund, hintergrund_farbe, kante_stil, kante_farbe,
            kuerzel, logo_url, mitgabe, anforderungen
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
    `INSERT INTO network_cards (${COLS})
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20,$21)
     RETURNING *`,
    fields(d)
  );
  return r.rows[0];
}

async function update(id, d) {
  const r = await pool.query(
    `UPDATE network_cards SET
       kategorie=$2, name=$3, rolle=$4, tags=$5::jsonb, beschreibung=$6, usp=$7,
       antwortzeit=$8, verified=$9, cta_label=$10, akzent=$11, hintergrund=$12,
       hintergrund_farbe=$13, kante_stil=$14, kante_farbe=$15, kuerzel=$16,
       logo_url=$17, ziel_email=$18, mitgabe=$19::jsonb, anforderungen=$20::jsonb,
       aktiv=$21, sortierung=$22, updated_at=NOW()
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

module.exports = { listActive, listAll, create, update, remove, getById, recordLead };
