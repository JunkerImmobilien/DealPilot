'use strict';
/**
 * V326: Sprengnetter AVM Live-Client.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ ⚠ LIVE-MAPPING UNVERIFIZIERT                                          │
 * │ Diese Datei ist ein lauffähiges Gerüst auf Basis der dokumentierten   │
 * │ Endpoints. Request-Body + Response-Felder MÜSSEN gegen die echte      │
 * │ Sprengnetter-API-Doku geprüft werden, BEVOR AVM_MODE=live gesetzt     │
 * │ wird. Jeder Live-Call kostet Geld. Bis zur Verifikation: AVM_MODE=stub│
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * ENV:
 *   SPRENGNETTER_USERNAME, SPRENGNETTER_PASSWORD, SPRENGNETTER_AVM_BASE
 *
 * Liefert dasselbe Result-Schema wie avm-stub.sprengnetterStub().
 */

const { sprengnetterStub, num } = require('./avm-stub');

function _cfg() {
  return {
    user: process.env.SPRENGNETTER_USERNAME || '',
    pass: process.env.SPRENGNETTER_PASSWORD || '',
    base: (process.env.SPRENGNETTER_AVM_BASE || 'https://api.avm.sprengnetter.de').replace(/\/+$/, '')
  };
}

function isConfigured() {
  const c = _cfg();
  return !!(c.user && c.pass && c.base);
}

function _authHeader() {
  const c = _cfg();
  return 'Basic ' + Buffer.from(c.user + ':' + c.pass).toString('base64');
}

/**
 * Feld-Mapping DealPilot → Sprengnetter-Request.
 * TODO(live): Feldnamen gegen echte API-Doku verifizieren.
 */
function _mapRequest(inputs) {
  return {
    address: {
      postalCode: String(inputs.plz || ''),
      city: String(inputs.ort || ''),
      street: String(inputs.str || ''),
      houseNumber: String(inputs.hnr || '')
    },
    livingArea: num(inputs.wfl) || null,
    constructionYear: num(inputs.baujahr) || null,
    propertyType: String(inputs.objektart || ''),
    purchasePrice: num(inputs.kp) || null
  };
}

async function _post(path, body) {
  const c = _cfg();
  const res = await fetch(c.base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': _authHeader() },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error('Sprengnetter ' + path + ' → HTTP ' + res.status + (text ? (': ' + text.slice(0, 200)) : ''));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Holt Marktwert + Marktmiete (+ Fair-Price-Label falls KP vorhanden).
 * @param {object} inputs
 * @returns {object} Result-Schema (provider 'Sprengnetter')
 */
async function valuate(inputs) {
  if (!isConfigured()) {
    const e = new Error('Sprengnetter-Credentials fehlen (ENV nicht gesetzt).');
    e.code = 'AVM_NOT_CONFIGURED';
    throw e;
  }

  // TODO(live): Endpoints + Response-Parsing gegen echte Doku verifizieren.
  //   /service/api/valuation         → Marktwert
  //   /rent                          → Marktmiete
  //   /valuation/fairpricelabel      → Fair-Price-Label (nur mit KP)
  const reqBody = _mapRequest(inputs);
  const hasKp = !!num(inputs.kp);

  const valuation = await _post('/service/api/valuation', reqBody);
  const rent = await _post('/rent', reqBody).catch(() => null);
  const fpl = hasKp ? await _post('/valuation/fairpricelabel', reqBody).catch(() => null) : null;

  // TODO(live): Felder aus valuation/rent/fpl ins Schema mappen.
  // Bis das verifiziert ist, fällt der Client kontrolliert auf das Stub-Schema
  // zurück und markiert mode:'live-unmapped', damit nichts halluziniert wird.
  const shaped = sprengnetterStub(inputs);
  shaped.mode = 'live-unmapped';
  shaped._raw = { valuation: !!valuation, rent: !!rent, fairPriceLabel: !!fpl };
  return shaped;
}

module.exports = { valuate: valuate, isConfigured: isConfigured };
