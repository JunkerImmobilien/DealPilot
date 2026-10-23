/**
 * v2933 · Zustimmungen mit Nachweis (Tabelle consent_log, Migration 090).
 *
 * Eine Stelle, die schreibt: die Route /api/v1/consent (Hinweise aus legal.js)
 * und die Checkout-Routen (Widerrufsverzicht nach § 356 Abs. 5 BGB) rufen
 * beide `protokollieren()`. Gespeichert wird keine IP-Adresse - der Nachweis
 * haengt am angemeldeten Konto.
 */
const { query } = require('../db/pool');

const ARTEN = ['hinweise', 'widerruf_verzicht', 'agb', 'datenschutz', 'newsletter'];

/* Der Wortlaut, dem beim Kauf zugestimmt wird. Aendert er sich, steigt die
   Version - das Protokoll sagt dann, welcher Satz galt. Derselbe Text steht
   im Fenster vor dem Checkout (frontend/js/legal.js, DpWiderruf). */
const WIDERRUF_VERSION = '2026-10-23';
const WIDERRUF_TEXT = 'Ich verlange ausdrücklich, dass DealPilot vor Ablauf der Widerrufsfrist mit der '
  + 'Ausführung des Vertrags beginnt. Mir ist bekannt, dass mein Widerrufsrecht mit vollständiger '
  + 'Vertragserfüllung bzw. bei digitalen Inhalten mit Beginn der Ausführung erlischt (§ 356 Abs. 4 und 5 BGB).';

async function protokollieren({ userId, art, version, userAgent, kontext }) {
  if (ARTEN.indexOf(art) < 0) throw new Error('unbekannte Zustimmungsart: ' + art);
  if (!version || String(version).length > 40) throw new Error('version fehlt oder zu lang');
  const r = await query(
    `INSERT INTO consent_log (user_id, art, version, user_agent, kontext)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, accepted_at`,
    [userId || null, art, String(version), userAgent ? String(userAgent).slice(0, 200) : null,
     kontext ? JSON.stringify(kontext) : null]
  );
  return r.rows[0];
}

async function fuerNutzer(userId) {
  const r = await query(
    `SELECT art, version, accepted_at, kontext FROM consent_log
     WHERE user_id = $1 ORDER BY accepted_at DESC LIMIT 200`, [userId]);
  return r.rows;
}

/* Prueft den Widerrufsverzicht aus einem Checkout-Body und protokolliert ihn.
   Wirft 400, wenn er fehlt - ohne Zustimmung kein Checkout. */
async function widerrufVerzichtPruefen(req, kontext) {
  const b = req.body || {};
  if (b.widerruf_verzicht !== true) {
    const e = new Error('Bitte bestätige vor dem Kauf, dass die Ausführung sofort beginnen soll (Widerrufsrecht).');
    e.status = 400; e.code = 'widerruf_verzicht_fehlt';
    throw e;
  }
  return protokollieren({
    userId: req.user && req.user.id,
    art: 'widerruf_verzicht',
    version: b.widerruf_version || WIDERRUF_VERSION,
    userAgent: req.headers && req.headers['user-agent'],
    kontext: Object.assign({ text: WIDERRUF_TEXT }, kontext || {})
  });
}

/* Aufbewahrung 3 Jahre (Datenschutzerklaerung) */
async function aufraeumen() {
  const r = await query(`DELETE FROM consent_log WHERE accepted_at < now() - interval '3 years'`);
  return r.rowCount;
}

module.exports = { ARTEN, WIDERRUF_VERSION, WIDERRUF_TEXT, protokollieren, fuerNutzer, widerrufVerzichtPruefen, aufraeumen };
