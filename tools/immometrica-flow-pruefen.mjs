#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * immometrica-flow-pruefen.mjs — v3298 · Flow Investor, Punkt 4
 *
 * Erkennung und Ablauf der ImmoMetrica-Ereignisse (services/immometricaFlow.js)
 * mit den ECHTEN Funktionen und einer Datenbank im Speicher - KEIN Abruf bei
 * ImmoMetrica, kein Kontingent.
 *
 *   I1  stand(): Id, Preis, Flaeche, Titel, Link aus platforms[].url, online/offline;
 *       keine weiteren Felder (keine Kontaktdaten).
 *   I2  erkennen(): neu, preis_gesenkt (mit Schwelle preissenkung_pct), unter_zielpreis
 *       (nur beim Unterschreiten, nicht jedes Mal), offline, wieder_online; Grundstand
 *       meldet nichts.
 *   I3  verarbeiten(): erster Lauf Grundstand ohne Ereignis, zweiter Lauf Senkung und
 *       Zielpreis aus dem verknuepften Objekt (_flow_berechnung), Preishistorie am Objekt,
 *       Webhook-Aufruf mit den Feldern aus dem Auftrag.
 *   I4  Der Job ist AUS ohne FLOW_IMMOMETRICA_JOB=an.
 *
 * Aufruf: node tools/immometrica-flow-pruefen.mjs     RC 0 = alles gruen
 * ══════════════════════════════════════════════════════════════════════ */
import path from 'path';
import Module, { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
delete process.env.FLOW_IMMOMETRICA_JOB;

const ST = new Map(), EV = [], HIST = [];
const OBJ = { id: 'obj-1', offer: '9001', zielpreis: 150000 };
const DB = {
  query: async (sql, p) => {
    const s = String(sql).replace(/\s+/g, ' ');
    if (/SELECT preis, online, objekt_id FROM immometrica_staende/.test(s)) { const z = ST.get(p[1] + '|' + p[2]); return z ? { rowCount: 1, rows: [z] } : { rowCount: 0, rows: [] }; }
    if (/INSERT INTO immometrica_staende/.test(s)) { ST.set(p[1] + '|' + p[2], { preis: p[3], online: p[7], objekt_id: p[8] }); return { rowCount: 1 }; }
    if (/FROM objects WHERE user_id=\$1 AND data->>'_immometrica_id'/.test(s)) return p[1] === OBJ.offer ? { rowCount: 1, rows: [{ id: OBJ.id, zp: String(OBJ.zielpreis) }] } : { rowCount: 0, rows: [] };
    if (/UPDATE objects SET data = jsonb_set/.test(s)) { HIST.push({ id: p[0], eintrag: JSON.parse(p[2]) }); return { rowCount: 1 }; }
    if (/INSERT INTO immometrica_ereignisse/.test(s)) { EV.push({ art: p[1], offer: p[3], objekt: p[4] }); return { rowCount: 1, rows: [{ id: EV.length, at: new Date() }] }; }
    throw new Error('Pruefer: unbekannte Abfrage ' + s.slice(0, 90));
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
const _w = console.warn, _l = console.log; console.warn = () => {};
const hub = require_(path.join(ROOT, 'backend/src/services/maklerHubService.js'));
const HUB = [];
hub.ereignis = (uid, art, daten) => { HUB.push({ art, daten }); };
const IF = require_(path.join(ROOT, 'backend/src/services/immometricaFlow.js'));
console.warn = _w;

let fehler = 0, n = 0;
const pruef = (name, ok, ist) => { n++; if (!ok) { fehler++; _l('  \x1b[31mROT\x1b[0m ' + name + (ist !== undefined ? '  ' + JSON.stringify(ist).slice(0, 400) : '')); } };

/* I1 */
const raw = { id: 9001, buying_price: 180000, living_space: 72.5, title: 'Pruef-ETW', offline_since: null,
  platforms: [{ platform: 'p', url: 'https://example.invalid/expose/1', active: true }], contact: { name: 'NICHT WEITERGEBEN', phone: '0' } };
const s1 = IF.stand(raw);
pruef('I1 Felder', s1.offer_id === '9001' && s1.preis === 180000 && s1.flaeche === 72.5 && s1.link === 'https://example.invalid/expose/1' && s1.online === true, s1);
pruef('I1 keine weiteren Felder (keine Kontaktdaten)', Object.keys(s1).sort().join(',') === 'flaeche,link,offer_id,online,preis,titel', Object.keys(s1));
pruef('I1 offline_since -> offline', IF.stand(Object.assign({}, raw, { offline_since: '2026-11-01' })).online === false);

/* I2 */
const arten = (alt, neu, opt) => IF.erkennen(alt, neu, opt).map((e) => e.art).sort().join(',');
const N = (preis, online) => ({ offer_id: '1', preis: preis, online: online !== false });
pruef('I2 neu', arten(null, N(100)) === 'neu');
pruef('I2 Grundstand meldet nichts', arten(null, N(100), { grundstand: true }) === '');
pruef('I2 Senkung', arten({ preis: 200000, online: true }, N(190000)) === 'preis_gesenkt');
pruef('I2 Senkung unter Schwelle nicht', arten({ preis: 200000, online: true }, N(196000), { alarme: { preissenkung_pct: 5 } }) === '');
pruef('I2 Senkung ab Schwelle', arten({ preis: 200000, online: true }, N(190000), { alarme: { preissenkung_pct: 5 } }) === 'preis_gesenkt');
const sk = IF.erkennen({ preis: 200000, online: true }, N(190000))[0];
pruef('I2 senkung_pct = 5,00', sk.senkung_pct === 5 && sk.preis_alt === 200000 && sk.preis_neu === 190000, sk);
pruef('I2 Erhoehung meldet nichts', arten({ preis: 200000, online: true }, N(210000)) === '');
pruef('I2 offline', arten({ preis: 1, online: true }, N(1, false)) === 'offline');
pruef('I2 wieder online', arten({ preis: 1, online: false }, N(1)) === 'wieder_online');
pruef('I2 unter Zielpreis beim Unterschreiten', arten({ preis: 160000, online: true }, N(150000), { alarme: { unter_zielpreis: true }, zielpreis: 150000 }) === 'preis_gesenkt,unter_zielpreis');
pruef('I2 unter Zielpreis nicht zweimal', arten({ preis: 149000, online: true }, N(149000), { alarme: { unter_zielpreis: true }, zielpreis: 150000 }) === '');
pruef('I2 ohne Alarm-Haken kein Zielpreis-Ereignis', arten({ preis: 160000, online: true }, N(150000), { zielpreis: 150000 }) === 'preis_gesenkt');

/* I3 */
const profil = { alarme: { preissenkung_pct: 3, unter_zielpreis: true }, ziele: { max_kaufpreis: null } };
await IF.verarbeiten('u1', 's1', [{ raw }], { profil, grundstand: true });
pruef('I3 Grundstand: kein Ereignis, Stand gespeichert', EV.length === 0 && ST.get('s1|9001') && ST.get('s1|9001').preis === 180000, { EV, st: ST.get('s1|9001') });
const ev = await IF.verarbeiten('u1', 's1', [{ raw: Object.assign({}, raw, { buying_price: 149000 }) }], { profil });
pruef('I3 Senkung + unter Zielpreis gemeldet', ev.map((e) => e.art).sort().join(',') === 'preis_gesenkt,unter_zielpreis', ev);
pruef('I3 verknuepft mit dem Objekt', ev.every((e) => e.objekt_id === OBJ.id) && EV.every((e) => e.objekt === OBJ.id), ev);
pruef('I3 Preishistorie am Objekt', HIST.length === 1 && HIST[0].id === OBJ.id && HIST[0].eintrag[0].preis === 149000 && HIST[0].eintrag[0].vorher === 180000, HIST);
const felder = ['art', 'suche_id', 'offer_id', 'objekt_id', 'titel', 'link', 'preis_alt', 'preis_neu', 'senkung_pct', 'zielpreis', 'at'];
pruef('I3 Webhook mit den Feldern des Auftrags', HUB.length === 2 && HUB.every((h) => /^immometrica\./.test(h.art) && felder.every((k) => k in h.daten)), HUB);
const ev2 = await IF.verarbeiten('u1', 's1', [{ raw: Object.assign({}, raw, { id: 9002, buying_price: 99000 }) }], { profil });
pruef('I3 neuer Treffer nach dem Grundstand: neu (Zielpreis ohne Objekt und ohne max_kaufpreis: keiner)', ev2.map((e) => e.art).join(',') === 'neu' && ev2[0].objekt_id === null, ev2);

const ev3 = await IF.verarbeiten('u1', 's1', [{ raw: Object.assign({}, raw, { id: 9003, buying_price: 90000 }) }], { profil, nurNeuMelden: true });
pruef('I3 Treffer ohne Stand aus dem Aenderungs-Filter: still nachgetragen (v3298a)', ev3.length === 0 && ST.has('s1|9003'), ev3);
const ev4 = await IF.verarbeiten('u1', 's1', [{ raw: Object.assign({}, raw, { id: 9004, buying_price: 90000 }), _echtNeu: true }], { profil, nurNeuMelden: true });
pruef('I3 Treffer aus dem Filter neu: Ereignis neu', ev4.map((e) => e.art).join(',') === 'neu', ev4);

/* I4 */
console.log = () => {};
const an = IF.starten();
console.log = _l;
pruef('I4 Job AUS ohne Schalter', an === false && IF.eingeschaltet() === false);

_l('immometrica-flow-pruefen: ' + (n - fehler) + ' von ' + n + ' gruen');
_l(fehler ? '\x1b[31mRC=1\x1b[0m' : '\x1b[32mRC=0\x1b[0m');
process.exit(fehler ? 1 : 0);
