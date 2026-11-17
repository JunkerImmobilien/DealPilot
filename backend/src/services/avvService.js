'use strict';
/**
 * services/avvService.js · v3620 — Auftragsverarbeitungsvertrag (AVV) fuer Partner, Art. 28 DSGVO
 *
 * Marcel 17.11.2026: „zum Abhaken wie die AGB“. Gemessen: Zustimmungen liegen seit v2933 in
 * consent_log (Konto, Art, Version, Zeitpunkt, user_agent, kontext) und werden beim Kauf im Checkout
 * geprueft (consentService.widerrufVerzichtPruefen -> 400 ohne Zustimmung). Der AVV nutzt dieselbe
 * Tabelle mit art = 'avv' - keine Migration. Wie bei den uebrigen Zustimmungen wird KEINE IP-Adresse
 * gespeichert (Migration 090: „der Nachweis haengt am angemeldeten Konto“).
 *
 * Abschluss:
 *   - beim Buchen des Partner-Plans: POST /subscription/partner/checkout verlangt
 *     { avv_zustimmung: true, avv_version: AVV_VERSION } (pruefen() unten, 400 / 409)
 *   - bestehende Partner: GET /partner/cockpit liefert stand(); ist er nicht aktuell, fragt das
 *     Cockpit einmal (frontend/js/avv-zustimmung.js) und schreibt ueber POST /consent/avv.
 *
 * Neue Version: AVV_VERSION und AVV_STAND hier UND im Kopf von frontend/landing/avv.html
 * (#avv-stand data-version/data-stand) hochziehen - tools/avv-pruefen.js prueft, dass beide gleich sind.
 * Danach ist stand().aktuell fuer jeden Partner false, bis er neu zustimmt.
 */
const consent = require('./consentService');
const { query } = require('../db/pool');

const AVV_VERSION = '1.0';
const AVV_STAND = '2026-11-17';
const AVV_LINK = '/avv.html';   /* Landing-Domain: frontend/landing/avv.html. App-Domain: frontend/avv.html leitet auf /landing/avv.html */

function standText() {
  const [j, m, t] = AVV_STAND.split('-');
  return t + '.' + m + '.' + j;
}
function haekchenText() {
  return 'Ich schließe den Auftragsverarbeitungsvertrag (Version ' + AVV_VERSION + ' vom ' + standText() + ') mit Junker Solution ab.';
}

/** Letzte AVV-Zustimmung eines Kontos und ob sie der geltenden Version entspricht. */
async function stand(userId) {
  let z = null;
  if (userId) {
    const r = await query(
      `SELECT version, accepted_at FROM consent_log WHERE user_id = $1 AND art = 'avv'
        ORDER BY accepted_at DESC LIMIT 1`, [userId]);
    z = r.rows[0] || null;
  }
  return {
    version: AVV_VERSION, stand: AVV_STAND, link: AVV_LINK, text: haekchenText(),
    zugestimmt: z ? { version: z.version, am: z.accepted_at } : null,
    aktuell: !!(z && z.version === AVV_VERSION)
  };
}

function fehler(code, status, message) { const e = new Error(message); e.status = status; e.code = code; return e; }

/** Prueft die Zustimmung aus einem Body ({ avv_zustimmung, avv_version }) und protokolliert sie.
    Fehlt sie: 400 avv_fehlt. Andere Version als die geltende: 409 avv_version_veraltet. */
async function pruefen(req, kontext) {
  const b = (req && req.body) || {};
  if (b.avv_zustimmung !== true) {
    throw fehler('avv_fehlt', 400, 'Bitte schließe vor dem Buchen den Auftragsverarbeitungsvertrag ab (Häkchen).');
  }
  if (String(b.avv_version || '') !== AVV_VERSION) {
    throw fehler('avv_version_veraltet', 409, 'Der Auftragsverarbeitungsvertrag liegt in einer neuen Version vor (' + AVV_VERSION + '). Bitte lade die Seite neu.');
  }
  return zustimmen(req.user && req.user.id, req.headers && req.headers['user-agent'], kontext);
}

async function zustimmen(userId, userAgent, kontext) {
  if (!userId) throw fehler('nicht_angemeldet', 401, 'nicht angemeldet');
  return consent.protokollieren({
    userId, art: 'avv', version: AVV_VERSION, userAgent,
    kontext: Object.assign({ text: haekchenText(), stand: AVV_STAND }, kontext || {})
  });
}

module.exports = { AVV_VERSION, AVV_STAND, AVV_LINK, haekchenText, stand, pruefen, zustimmen };
