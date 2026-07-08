'use strict';
/* ImmoMetrica Search API – Calls mit per-User-Token. Mapping -> DealPilot. */
const mapping = require('./immometricaMapping');
const BASE = (process.env.IMMOMETRICA_BASE || 'https://www.immometrica.com/searchapi/v1/').replace(/\/?$/, '/');

function abs(u) { return /^https?:/.test(u) ? u : BASE + String(u).replace(/^\//, ''); }
/* v893c-stub: Demo-Modus (IMMOMETRICA_MODE=stub) — gemappte Demo-Inserate ohne Live-Call/Token */
function _isStub() { return String(process.env.IMMOMETRICA_MODE || '').toLowerCase() === 'stub'; }
function _p(platform, url) { return { platform: platform, url: url, active: true }; }
const DEMO_RAW = {
  's-kapital': [
    { id: 'demo-1001', title: 'Gepflegte 3-Zi-ETW mit Balkon', real_estate_type: 'flatbuy', appartement_type: 'Etagenwohnung',
      address_raw: 'H\u00f6lderlinstr. 1, 32547 Bad Oeynhausen', address_zipcode: '32547',
      buying_price: 189000, buying_price_per_sqm: 2579, rent_cold: 720, rent_total: 920, living_space: 73.3,
      construction_year: 1983, rooms: 3, bath_rooms: 1, floor_act: 2, floor_max: 4, rented_out: true,
      condition: 'Gepflegt', heating_type: 'central_heating', energy_efficiency_class: 'D', is_private: false,
      maintenance: 210, commission_text: '3,57% inkl. MwSt.', balcony: true, basement: true, online_since: '2026-05-15',
      platforms: [_p('IS24', 'https://www.immobilienscout24.de/expose/demo1001')] },
    { id: 'demo-1002', title: 'Vermietete 2-Zi-Wohnung, zentral', real_estate_type: 'flatbuy', appartement_type: 'Wohnung',
      address_raw: 'Bahnhofstr. 12, 32545 Bad Oeynhausen', address_zipcode: '32545',
      buying_price: 145000, buying_price_per_sqm: 2460, rent_cold: 560, living_space: 59.0,
      construction_year: 1996, rooms: 2, bath_rooms: 1, floor_act: 1, floor_max: 3, rented_out: true,
      condition: 'Neuwertig', heating_type: 'gas_heating', energy_efficiency_class: 'C', is_private: true,
      maintenance: 165, balcony: true, elevator: true, online_since: '2026-06-02',
      platforms: [_p('immowelt', 'https://www.immowelt.de/expose/demo1002'), _p('IS24', 'https://www.immobilienscout24.de/expose/demo1002b')] },
    { id: 'demo-1003', title: 'Kapitalanleger-Paket, saniertes Altbau-Apartment', real_estate_type: 'flatbuy', appartement_type: 'Altbauwohnung',
      address_raw: 'Herforder Str. 88, 32257 B\u00fcnde', address_zipcode: '32257',
      buying_price: 119000, buying_price_per_sqm: 2115, rent_cold: 495, living_space: 56.3,
      construction_year: 1954, rooms: 2, bath_rooms: 1, floor_act: 3, floor_max: 3, rented_out: true,
      condition: 'Saniert', heating_type: 'district_heating', energy_efficiency_class: 'B', is_private: false,
      maintenance: 140, new_building: false, basement: true, online_since: '2026-04-20',
      platforms: [_p('ebayKA', 'https://www.kleinanzeigen.de/s-anzeige/demo1003')] }
  ],
  's-mfh': [
    { id: 'demo-2001', title: 'MFH mit 6 Einheiten, gute Rendite', real_estate_type: 'housebuy', house_type: 'Mehrfamilienhaus',
      address_raw: 'Gartenstr. 4, 32105 Bad Salzuflen', address_zipcode: '32105',
      buying_price: 690000, buying_price_per_sqm: 1725, rent_cold: 3450, living_space: 400.0, property_area: 620,
      construction_year: 1972, rooms: 14, number_of_apartments: 6, rented_out: true,
      condition: 'Gepflegt', heating_type: 'oil_heating', energy_efficiency_class: 'E', is_private: false,
      maintenance: 0, basement: true, online_since: '2026-03-11',
      platforms: [_p('IS24', 'https://www.immobilienscout24.de/expose/demo2001')] },
    { id: 'demo-2002', title: 'Wohn- und Gesch\u00e4ftshaus, Innenstadtlage', real_estate_type: 'housebuy', house_type: 'Wohn- / Gesch\u00e4ftshaus',
      address_raw: 'Lange Str. 21, 32423 Minden', address_zipcode: '32423',
      buying_price: 845000, buying_price_per_sqm: 1608, rent_cold: 4100, living_space: 525.0, property_area: 410,
      construction_year: 1965, rooms: 12, number_of_apartments: 5, rented_out: true,
      condition: 'Renovierungsbed\u00fcrftig', heating_type: 'central_heating', energy_efficiency_class: 'F', is_private: false,
      maintenance: 0, online_since: '2026-02-28',
      platforms: [_p('immonet', 'https://www.immonet.de/expose/demo2002')] }
  ]
};
const DEMO_SEARCHES = [
  { id: 's-kapital', name: 'Kapitalanleger DACH', count: DEMO_RAW['s-kapital'].length, results: 'searches/s-kapital/results/' },
  { id: 's-mfh', name: 'Mehrfamilienh\u00e4user NRW', count: DEMO_RAW['s-mfh'].length, results: 'searches/s-mfh/results/' }
];
function _demoPack(list) { return { count: list.length, next: null, items: list.map(it => ({ raw: it, dp: mapping.mapToDp(it) })) }; }
function _demoResults(searchId) { const list = DEMO_RAW[searchId] || DEMO_RAW['s-kapital']; return _demoPack(list); }
function _demoFavorites() { return _demoPack(DEMO_RAW['s-kapital'].slice(0, 2)); }

async function call(token, url) {
  const res = await fetch(url, { headers: { Authorization: 'Token ' + token, Accept: 'application/json' } });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  if (!res.ok) { const err = new Error('ImmoMetrica ' + res.status); err.status = res.status; throw err; }
  return json;
}

async function getSearches(token) {
  if (_isStub()) return DEMO_SEARCHES;
  const root = await call(token, BASE);
  const searchesUrl = root && root.searches ? root.searches : abs('searches/');
  const s = await call(token, searchesUrl);
  const list = Array.isArray(s) ? s : (s && s.results) || [];
  return list.map(x => ({ id: x.id, name: x.name, count: x.count != null ? x.count : null, results: x.results }));
}

async function getResults(token, searchId, page) {
  if (_isStub()) return _demoResults(searchId);
  let url = abs('searches/' + encodeURIComponent(searchId) + '/results/');
  if (page) url += '?page=' + encodeURIComponent(page);
  const j = await call(token, url);
  const items = Array.isArray(j) ? j : (j && j.results) || [];
  return {
    count: j && j.count != null ? j.count : items.length,
    next: (j && j.next) || null,
    items: items.filter(it => !it.fake).map(it => ({ raw: it, dp: mapping.mapToDp(it) })),
  };
}

async function getFavorites(token, cc) {
  if (_isStub()) return _demoFavorites(cc);
  const url = abs('favorites/' + encodeURIComponent(cc) + '/');
  const j = await call(token, url);
  const items = Array.isArray(j) ? j : (j && j.results) || [];
  return {
    count: j && j.count != null ? j.count : items.length,
    items: items.filter(it => !it.fake).map(it => ({ raw: it, dp: mapping.mapToDp(it) })),
  };
}

module.exports = { getSearches, getResults, getFavorites };
