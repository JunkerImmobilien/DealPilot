#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * flow-zugang-pruefen.mjs — v3289 · Flow Investor, Punkt 7
 *
 * Prueft den Zugang fuer DealPilot Flow mit den ECHTEN Dateien, ohne
 * Datenbank (Abfragen und Plan werden je Fall vorgegeben):
 *
 *   Z1  zusatzService.flowLinien: makler_hub -> makler, Plan-Merkmal
 *       flow_linien, Zusatz 'flow' (nur aktiv), Vereinigung, Reihenfolge.
 *   Z2  maklerHubService.apiKeyScope: makler 'crud' (wie bisher),
 *       investor/privat 'flow', beides 'crud flow', ohne Linie kein Schluessel.
 *   Z3  middleware/flow.js: FLOW_ROUTEN lassen nur die Flow-Wege durch.
 *   Z4  middleware/auth.js mit x-api-key, je Fall Plan/Testphase/Linien:
 *       crud in der Testphase 403 (wie bisher) · flow in der Testphase mit
 *       Linie investor auf /berechnen durch · flow auf /ai 403 · flow ohne
 *       Linie 403 · crud flow ausserhalb der Testphase voller Zugriff ·
 *       crud flow in der Testphase nur Flow-Routen.
 *   Z5  requireFlowLinie('investor'): ohne Linie 403 FLOW_LINIE_FEHLT.
 *
 * Aufruf: node tools/flow-zugang-pruefen.mjs     RC 0 = alles gruen
 * ══════════════════════════════════════════════════════════════════════ */
import path from 'path';
import Module, { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);

/* Gegenwart je Fall: Plan, Zusatz-Zeile, Nutzer */
const LAGE = { plan: null, zusatz: null };
const DB = {
  query: async (sql, p) => {
    const s = String(sql);
    if (/FROM user_zusaetze/.test(s)) return LAGE.zusatz ? { rowCount: 1, rows: [LAGE.zusatz] } : { rowCount: 0, rows: [] };
    if (/FROM users WHERE id/.test(s)) return { rowCount: 1, rows: [{ id: 'u1', email: 'probe@example.invalid', name: 'Probe', role: 'user', is_active: true, email_verified_at: new Date(), created_at: new Date() }] };
    if (/UPDATE api_keys SET last_used_at/.test(s)) return { rowCount: 1, rows: [] };
    return { rowCount: 0, rows: [] };
  }
};
const origLoad = Module._load;
Module._load = function (req) {
  if (/[\\/]db[\\/]pool(\.js)?$/.test(req) || req === '../db/pool') return DB;
  if (!req.startsWith('.') && !req.startsWith('node:') && !Module.isBuiltin(req) && !path.isAbsolute(req)) {
    try { return origLoad.apply(this, arguments); } catch (e) {
      const leer = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : leer), apply: () => leer, construct: () => leer });
      return leer;
    }
  }
  return origLoad.apply(this, arguments);
};
const _w = console.warn; console.warn = () => {};
const sub = require_(path.join(ROOT, 'backend/src/services/subscriptionService.js'));
sub.getEffectivePlan = async () => LAGE.plan;
const apiKeys = require_(path.join(ROOT, 'backend/src/services/apiKeyService.js'));
let SCHLUESSEL = null;
apiKeys.findValidByPlaintext = async () => SCHLUESSEL;
apiKeys.touchLastUsed = async () => {};
const zusatz = require_(path.join(ROOT, 'backend/src/services/zusatzService.js'));
const hub = require_(path.join(ROOT, 'backend/src/services/maklerHubService.js'));
const flow = require_(path.join(ROOT, 'backend/src/middleware/flow.js'));
const auth = require_(path.join(ROOT, 'backend/src/middleware/auth.js'));
console.warn = _w;

let fehler = 0, n = 0;
function pruef(name, ok, ist) { n++; if (!ok) { fehler++; console.log('  \x1b[31mROT\x1b[0m ' + name + (ist !== undefined ? '  (ist: ' + JSON.stringify(ist) + ')' : '')); } }
const plan = (features, trial) => ({ plan_id: 'probe', plan_features: features, trial: !!trial, max_users: 1 });

/* Z1 */
const faelleZ1 = [
  [plan({ makler_hub: true }), null, ['makler']],
  [plan({}), null, []],
  [plan({ flow_linien: ['investor', 'unsinn', 'privat'] }), null, ['privat', 'investor']],
  [plan({ makler_hub: true }), { aktiv: true, linien: ['investor'] }, ['makler', 'investor']],
  [plan({}), { aktiv: false, linien: ['investor'] }, []],
  [plan({}), { aktiv: true, linien: '["privat","investor"]' }, ['privat', 'investor']]
];
for (const [p, z, soll] of faelleZ1) {
  LAGE.plan = p; LAGE.zusatz = z;
  const ist = await zusatz.flowLinien('u1');
  pruef('Z1 ' + JSON.stringify(p.plan_features) + ' + ' + JSON.stringify(z), JSON.stringify(ist) === JSON.stringify(soll), ist);
}

/* Z2 */
[[['makler'], 'crud'], [['investor'], 'flow'], [['privat'], 'flow'], [['makler', 'investor'], 'crud flow'], [[], null]]
  .forEach(([l, soll]) => pruef('Z2 ' + l.join('+'), hub.apiKeyScope(l) === soll, hub.apiKeyScope(l)));

/* Z3 */
const ID = '11111111-2222-3333-4444-555555555555';
[['POST', '/api/v1/objects/' + ID + '/berechnen', true], ['GET', '/api/v1/objects/felder?suche=zins', true],
 ['GET', '/api/v1/objects', true], ['POST', '/api/v1/objects', true], ['PUT', '/api/v1/objects/' + ID, true],
 ['DELETE', '/api/v1/objects/' + ID, false], ['POST', '/api/v1/dateien', true], ['DELETE', '/api/v1/dateien/' + ID, false],
 ['POST', '/api/v1/ai/analyze', false], ['GET', '/api/v1/immometrica/suchen', false], ['PUT', '/api/v1/user-settings/lage_profil', false],
 ['GET', '/api/v1/objects/portfolio-export', false]]
  .forEach(([m, u, soll]) => pruef('Z3 ' + m + ' ' + u, flow.istFlowRoute(m, u) === soll, flow.istFlowRoute(m, u)));

/* Z4 */
async function lauf(scopes, method, url) {
  SCHLUESSEL = { id: 'k1', user_id: 'u1', scopes: scopes };
  const req = { headers: { 'x-api-key': 'dpk_live_probe' }, method: method, originalUrl: url, url: url };
  let status = 200, body = null, weiter = false;
  const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; }, set() { return this; } };
  await auth.authenticate(req, res, () => { weiter = true; });
  return { weiter, status: weiter ? 200 : status, body, req };
}
const B = '/api/v1/objects/' + ID + '/berechnen';
const z4 = [
  ['crud in der Testphase', plan({ api_access: true, makler_hub: true }, true), null, 'crud', 'GET', '/api/v1/objects', false],
  ['flow, Testphase, Linie investor, /berechnen', plan({ api_access: true }, true), { aktiv: true, linien: ['investor'] }, 'flow', 'POST', B, true],
  ['flow, ohne api_access, Linie investor, /berechnen', plan({}), { aktiv: true, linien: ['investor'] }, 'flow', 'POST', B, true],
  ['flow auf /ai/analyze', plan({ api_access: true }), { aktiv: true, linien: ['investor'] }, 'flow', 'POST', '/api/v1/ai/analyze', false],
  ['flow ohne Linie', plan({ api_access: true }), null, 'flow', 'POST', B, false],
  ['flow mit nur makler', plan({ api_access: true, makler_hub: true }), null, 'flow', 'POST', B, false],
  ['crud flow ausserhalb der Testphase, /ai', plan({ api_access: true, makler_hub: true }), { aktiv: true, linien: ['investor'] }, 'crud flow', 'POST', '/api/v1/ai/analyze', true],
  ['crud flow in der Testphase, /ai', plan({ api_access: true, makler_hub: true }, true), { aktiv: true, linien: ['investor'] }, 'crud flow', 'POST', '/api/v1/ai/analyze', false],
  ['crud flow in der Testphase, /berechnen', plan({ api_access: true, makler_hub: true }, true), { aktiv: true, linien: ['investor'] }, 'crud flow', 'POST', B, true],
  ['read (Altbestand) bleibt nur lesend', plan({ api_access: true }), null, 'read', 'POST', '/api/v1/objects', false]
];
for (const [name, p, z, sc, m, u, soll] of z4) {
  LAGE.plan = p; LAGE.zusatz = z;
  const r = await lauf(sc, m, u);
  pruef('Z4 ' + name, r.weiter === soll, { status: r.status, error: r.body && r.body.error });
}

/* Z5 */
async function linie(z, p) {
  LAGE.plan = p; LAGE.zusatz = z;
  let status = 200, body = null, weiter = false;
  const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
  await flow.requireFlowLinie('investor')({ user: { id: 'u1' } }, res, () => { weiter = true; });
  return { weiter, status, body };
}
let r5 = await linie(null, plan({ makler_hub: true }));
pruef('Z5 ohne Linie investor -> 403', !r5.weiter && r5.status === 403 && r5.body.code === 'FLOW_LINIE_FEHLT', r5);
r5 = await linie({ aktiv: true, linien: ['investor'] }, plan({}));
pruef('Z5 mit Linie investor -> weiter', r5.weiter, r5);
r5 = await linie(null, plan({ flow_linien: ['investor'] }));
pruef('Z5 Plan-Merkmal flow_linien -> weiter', r5.weiter, r5);

console.log('flow-zugang-pruefen: ' + (n - fehler) + ' von ' + n + ' gruen');
console.log(fehler ? '\x1b[31mRC=1\x1b[0m' : '\x1b[32mRC=0\x1b[0m');
process.exit(fehler ? 1 : 0);
