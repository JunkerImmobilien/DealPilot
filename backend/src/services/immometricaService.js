'use strict';
/* ImmoMetrica Search API – Calls mit per-User-Token. Mapping -> DealPilot. */
const mapping = require('./immometricaMapping');
const BASE = (process.env.IMMOMETRICA_BASE || 'https://www.immometrica.com/searchapi/v1/').replace(/\/?$/, '/');

function abs(u) { return /^https?:/.test(u) ? u : BASE + String(u).replace(/^\//, ''); }

async function call(token, url) {
  const res = await fetch(url, { headers: { Authorization: 'Token ' + token, Accept: 'application/json' } });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  if (!res.ok) { const err = new Error('ImmoMetrica ' + res.status); err.status = res.status; throw err; }
  return json;
}

async function getSearches(token) {
  const root = await call(token, BASE);
  const searchesUrl = root && root.searches ? root.searches : abs('searches/');
  const s = await call(token, searchesUrl);
  const list = Array.isArray(s) ? s : (s && s.results) || [];
  return list.map(x => ({ id: x.id, name: x.name, count: x.count != null ? x.count : null, results: x.results }));
}

async function getResults(token, searchId, page) {
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
  const url = abs('favorites/' + encodeURIComponent(cc) + '/');
  const j = await call(token, url);
  const items = Array.isArray(j) ? j : (j && j.results) || [];
  return {
    count: j && j.count != null ? j.count : items.length,
    items: items.filter(it => !it.fake).map(it => ({ raw: it, dp: mapping.mapToDp(it) })),
  };
}

module.exports = { getSearches, getResults, getFavorites };
