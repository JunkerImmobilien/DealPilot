'use strict';
/**
 * V388: Sprengnetter AVM Live-Client — Mapping verifiziert gegen AVM-API OpenAPI 1.0.0.
 *
 * Endpoints (Basic-Auth, Base https://api.avm.sprengnetter.de):
 *   POST /service/api/valuation                -> Marktwert  (value, meta.range.min/max)
 *   POST /service/api/rent                     -> Marktmiete (value, meta.range.min/max)
 *   POST /service/api/valuation/fairpricelabel -> Fair-Price-Label (nur mit asking_price/KP)
 *
 * ENV (Marcels .env): SPRENGNETTER_AVM_USERNAME / SPRENGNETTER_AVM_PASSWORD
 *   (Fallback auf SPRENGNETTER_USERNAME/PASSWORD). Base ueber SPRENGNETTER_AVM_BASE.
 *
 * Ergebnis-Schema = exakt das, was object-actions.renderCard() liest:
 *   provider, mode, conf, marktwert, low, high, eurPerSqm,
 *   marktmieteCold, marktmieteLow, marktmieteHigh, marktmieteEurSqm,
 *   fairpriceClass, fairpriceLabel, scoreMicro, scoreMacro, wertentwicklung, _raw
 */

function _cfg() {
  return {
    user: process.env.SPRENGNETTER_AVM_USERNAME || process.env.SPRENGNETTER_USERNAME || '',
    pass: process.env.SPRENGNETTER_AVM_PASSWORD || process.env.SPRENGNETTER_PASSWORD || '',
    base: (process.env.SPRENGNETTER_AVM_BASE || 'https://api.avm.sprengnetter.de').replace(/\/+$/, '')
  };
}
function isConfigured() { var c = _cfg(); return !!(c.user && c.pass && c.base); }
function _authHeader() { var c = _cfg(); return 'Basic ' + Buffer.from(c.user + ':' + c.pass).toString('base64'); }

function fin(x) {
  if (x === null || x === undefined || x === '') return null;
  var n = (typeof x === 'string') ? parseFloat(x.replace(/\./g, '').replace(',', '.')) : Number(x);
  return isFinite(n) ? n : null;
}

// DealPilot-Objektart -> Sprengnetter Category (+ ggf. construction)
function _category(objart) {
  var o = String(objart || '').toUpperCase();
  if (o === 'ETW') return { category: 'ETW' };
  if (o === 'EFH') return { category: 'EFH' };
  if (o === 'MFH') return { category: 'MFH' };
  if (o === 'DHH') return { category: 'EFH', construction: 'DOPPELHAUS' };
  if (o === 'RH')  return { category: 'EFH', construction: 'REIHEN_MITTELHAUS' };
  return null; // BUERO/GESCH/HOTEL/GEW/GAR: Wohn-AVM unterstuetzt das nicht
}

function _mapRequest(inputs, opts) {
  opts = opts || {};
  var cat = _category(inputs.objektart);
  if (!cat) { var e = new Error('Sprengnetter-AVM unterstuetzt nur ETW/EFH/MFH/DHH/RH.'); e.code = 'AVM_CATEGORY_UNSUPPORTED'; throw e; }
  var addr = { nation: 'DE' };
  if (inputs.plz) addr.zip = String(inputs.plz);
  if (inputs.ort) addr.town = String(inputs.ort);
  if (inputs.str) addr.street = String(inputs.str);
  if (inputs.hnr) addr.house_number = String(inputs.hnr);
  var body = { address: addr, category: cat.category, range: 10 };
  if (cat.construction) body.construction = cat.construction;
  var by = fin(inputs.baujahr); if (by) body.construction_year = Math.round(by);
  var ry = fin(inputs.modernis); if (ry) body.refurbishment_year = Math.round(ry);
  var la = fin(inputs.wfl); if (la) body.living_area = la;
  var rm = fin(inputs.zimmer); if (rm) body.rooms = rm;
  var fl = fin(inputs.etage); if (fl !== null && cat.category === 'ETW') body.floor = Math.round(fl);
  var fn = fin(inputs.etagen_ges); if (fn && (cat.category === 'EFH' || cat.category === 'MFH')) body.floor_number = Math.round(fn);
  var gar = fin(inputs.garagen); if (gar !== null) body.garages = gar > 0;
  var sp = fin(inputs.stellpl_aussen); if (sp !== null) body.outdoor_parking_space = sp > 0;
  if (opts.askingPrice) body.asking_price = opts.askingPrice;
  return body;
}

async function _post(path, body) {
  var c = _cfg();
  var res = await fetch(c.base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': _authHeader() },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    var text = await res.text().catch(function () { return ''; });
    var err = new Error('Sprengnetter ' + path + ' -> HTTP ' + res.status + (text ? (': ' + text.slice(0, 300)) : ''));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function _rangeOf(resp) {
  var r = resp && resp.meta && resp.meta.range;
  return r ? { min: fin(r.min), max: fin(r.max) } : { min: null, max: null };
}
function _fairLabel(cls) {
  switch (String(cls || '')) {
    case 'TOP_OFFER': return 'Top-Angebot';
    case 'GOOD_OFFER': return 'Gutes Angebot';
    case 'FAIR_OFFER': return 'Fairer Preis';
    case 'EXPENSIVE': return 'Teuer';
    case 'VERY_EXPENSIVE': return 'Sehr teuer';
    default: return null;
  }
}

async function valuate(inputs) {
  if (!isConfigured()) {
    var e = new Error('Sprengnetter-Credentials fehlen (ENV SPRENGNETTER_AVM_USERNAME/PASSWORD nicht gesetzt).');
    e.code = 'AVM_NOT_CONFIGURED'; throw e;
  }
  var kp = fin(inputs.kp);
  var baseReq = _mapRequest(inputs);

  // Marktwert (Pflicht)
  var valuation = await _post('/service/api/valuation', baseReq);
  // Marktmiete (best effort)
  var rent = await _post('/service/api/rent', baseReq).catch(function () { return null; });
  // Fair-Price-Label (nur mit Kaufpreis)
  // ───────────────────────────────────────────────────────────────────────
  // v480: Fair-Price-Label ("vs. Kaufpreis / Sehr teuer", rotes Label) VORERST
  // DEAKTIVIERT. Es ist ein eigener API-Request (≈1 € pro Bewertung MIT Kaufpreis).
  // fairpriceClass/fairpriceLabel bleiben dadurch null → das rote Label rendert nicht.
  // REAKTIVIEREN: einfach den if-Block unten wieder einkommentieren (und ggf. den
  // Credit-Preis in avm.js COST.sprengnetter_full wieder anheben).
  // ───────────────────────────────────────────────────────────────────────
  var fpl = null;
  // if (kp) {
  //   try { fpl = await _post('/service/api/valuation/fairpricelabel', _mapRequest(inputs, { askingPrice: kp })); }
  //   catch (e2) { fpl = null; }
  // }

  var la = fin(inputs.wfl) || 0;
  var mw = fin(valuation && valuation.value);
  var mwR = _rangeOf(valuation);
  var mm = rent ? fin(rent.value) : null;
  var mmR = rent ? _rangeOf(rent) : { min: null, max: null };

  return {
    provider: 'Sprengnetter',
    mode: 'live',
    conf: 'Sprengnetter AVM',
    marktwert: mw,
    low: mwR.min,
    high: mwR.max,
    eurPerSqm: (mw && la) ? (mw / la) : null,
    marktmieteCold: mm,
    marktmieteLow: mmR.min,
    marktmieteHigh: mmR.max,
    marktmieteEurSqm: (mm && la) ? (mm / la) : null,
    fairpriceClass: fpl ? (fpl.fairpricelabel_class || null) : null,
    fairpriceLabel: fpl ? _fairLabel(fpl.fairpricelabel_class) : null,
    scoreMicro: null,
    scoreMacro: null,
    wertentwicklung: null,
    _raw: {
      valuationValue: mw, valuationRange: mwR,
      rentValue: mm, rentRange: mmR,
      fairClass: fpl ? (fpl.fairpricelabel_class || null) : null,
      model: valuation && valuation.meta ? (valuation.meta.model || null) : null,
      score: valuation && valuation.meta ? (valuation.meta.score != null ? valuation.meta.score : null) : null
    }
  };
}

module.exports = { valuate: valuate, isConfigured: isConfigured };
