'use strict';
/**
 * PriceHubble AVM Live-Client (v739).
 *
 * Verifiziert gegen die echte API:
 *   Login:      POST /auth/login/credentials  -> { access_token, expires_in }
 *   Valuation:  POST /api/v1/valuation/property_value_light (dossierlos)
 *               -> { confidence, currency, valueRange{lower,upper} }
 *
 * Zwei Calls je Bewertung: dealType 'sale' (Marktwert) + 'rent' (Marktmiete).
 * Token-Cache (12h, 5min-Puffer) gegen PriceHubble-Sperrschutz.
 *
 * ENV: PRICEHUBBLE_USERNAME, PRICEHUBBLE_PASSWORD, PRICEHUBBLE_API_BASE
 * Result-Schema wie avm-stub.pricehubbleStub() (mode 'live').
 */

const { pricehubbleStub, num } = require('./avm-stub');

function _cfg() {
  return {
    user: process.env.PRICEHUBBLE_USERNAME || '',
    pass: process.env.PRICEHUBBLE_PASSWORD || '',
    base: (process.env.PRICEHUBBLE_API_BASE || 'https://api.pricehubble.com').replace(/\/+$/, '')
  };
}

function isConfigured() {
  const c = _cfg();
  return !!(c.user && c.pass && c.base);
}

/* v739-ph-live: Token-Cache (Modul-Level). Token gilt 12h; 5min-Puffer,
   damit NICHT jeder Call neu einloggt (PriceHubble sperrt bei zu vielen Auth-Requests). */
var _phToken = null;
var _phTokenExp = 0;

async function _login() {
  var now = Date.now();
  if (_phToken && now < _phTokenExp) return _phToken;
  const c = _cfg();
  const res = await fetch(c.base + '/auth/login/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: c.user, password: c.pass })
  });
  if (!res.ok) {
    const err = new Error('PriceHubble Login \u2192 HTTP ' + res.status);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  _phToken = data.access_token || data.token || null;
  var ttl = (data.expires_in ? data.expires_in : 43200) * 1000;
  _phTokenExp = now + Math.max(0, ttl - 5 * 60 * 1000);
  return _phToken;
}

/* Objektart (eure Codes) -> PriceHubble propertyType.code */
function _phPropertyType(objektart) {
  var o = String(objektart || '').toUpperCase();
  if (o === 'ETW' || o === 'WOHNUNG' || o === 'APARTMENT') return 'apartment';
  if (o === 'EFH' || o === 'DHH' || o === 'RH' || o === 'HAUS' || o === 'MFH') return 'house';
  return 'apartment';
}

/* PriceHubble confidence -> euer conf/confClass */
function _phConf(confidence) {
  var c = String(confidence || '').toLowerCase();
  if (c === 'high') return { conf: 'Gut', confClass: 'good' };
  if (c === 'low') return { conf: 'Schwach', confClass: 'weak' };
  return { conf: 'Mittel', confClass: 'medium' };
}

/* Adresse aus euren Inputs -> PriceHubble location.address */
function _phAddress(inputs) {
  var addr = {};
  if (inputs.plz) addr.postCode = String(inputs.plz);
  if (inputs.ort) addr.city = String(inputs.ort);
  if (inputs.str) addr.street = String(inputs.str);
  if (inputs.hnr) addr.houseNumber = String(inputs.hnr);
  return addr;
}

/* Ein property_value_light-Call fuer gegebenen dealType. */
async function _phValueLight(token, inputs, dealType) {
  const c = _cfg();
  var property = {
    location: { address: _phAddress(inputs) },
    propertyType: { code: _phPropertyType(inputs.objektart) }
  };
  var by = num(inputs.baujahr); if (by) property.buildingYear = by;
  var wfl = num(inputs.wfl); if (wfl) property.livingArea = wfl;
  var payload = { dealType: dealType, countryCode: 'DE', property: property };
  const res = await fetch(c.base + '/api/v1/valuation/property_value_light', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error('PriceHubble valuation (' + dealType + ') \u2192 HTTP ' + res.status + ': ' + text.slice(0, 200));
    err.status = res.status;
    throw err;
  }
  var j = null; try { j = JSON.parse(text); } catch (e) {}
  return j;
}

/**
 * Echte Bewertung. Zwei Calls (sale + rent), Mittelwert aus valueRange.
 * @param {object} inputs
 * @returns {object} Result-Schema (provider 'PriceHubble', mode 'live')
 */
async function valuate(inputs) {
  inputs = inputs || {};
  if (!isConfigured()) {
    const e = new Error('PriceHubble-Credentials fehlen (ENV nicht gesetzt).');
    e.code = 'AVM_NOT_CONFIGURED';
    throw e;
  }
  const token = await _login();

  const sale = await _phValueLight(token, inputs, 'sale');
  const sr = (sale && sale.valueRange) || {};
  if (sr.lower == null || sr.upper == null) {
    const e = new Error('PriceHubble: keine Bewertung (valueRange fehlt).');
    e.status = 502;
    throw e;
  }
  var low = Math.round(sr.lower);
  var high = Math.round(sr.upper);
  var marktwert = Math.round((sr.lower + sr.upper) / 2);

  var mmLow = null, mmHigh = null, marktmieteCold = null, marktmieteEurSqm = null;
  try {
    const rent = await _phValueLight(token, inputs, 'rent');
    const rr = (rent && rent.valueRange) || {};
    if (rr.lower != null && rr.upper != null) {
      mmLow = Math.round(rr.lower);
      mmHigh = Math.round(rr.upper);
      marktmieteCold = Math.round((rr.lower + rr.upper) / 2);
      var wfl = num(inputs.wfl);
      if (wfl) marktmieteEurSqm = Math.round((marktmieteCold / wfl) * 100) / 100;
    }
  } catch (e) { /* Miete optional */ }

  var cc = _phConf(sale.confidence);
  var wflv = num(inputs.wfl);

  var out = {
    provider: 'PriceHubble',
    mode: 'live',
    marktwert: marktwert,
    low: low,
    high: high,
    eurPerSqm: wflv ? Math.round(marktwert / wflv) : null,
    conf: cc.conf,
    confClass: cc.confClass,
    ts: new Date().toISOString()
  };
  if (marktmieteCold != null) {
    out.marktmieteCold = marktmieteCold;
    out.marktmieteLow = mmLow;
    out.marktmieteHigh = mmHigh;
    out.marktmieteEurSqm = marktmieteEurSqm;
  }
  return out;
}

module.exports = { valuate: valuate, isConfigured: isConfigured };
