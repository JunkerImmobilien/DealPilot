#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * flow-agent-pruefen.mjs — v3297 · Flow Investor, Punkt 5
 *
 * POST /agent/frage und /agent/bestaetigen mit dem ECHTEN agentLauf.laufen()
 * und den ECHTEN Werkzeugen - das Modell ist ein Drehbuch (fetch abgefangen),
 * die Datenbank liegt im Speicher. Kein KI-Abruf, keine Kosten.
 *
 *   A1  Ein schreibendes Werkzeug (felder_aendern) wird NICHT ausgefuehrt, sondern
 *       vorgemerkt; die Antwort traegt bestaetigen[] mit Token. Kein UPDATE objects.
 *   A2  Ein kostenpflichtiges Werkzeug ohne darf_kosten bleibt gesperrt.
 *   A3  darf_kosten ohne kosten_token: 402 KOSTEN_TOKEN_FEHLT, vor jedem Modellaufruf.
 *   A4  bestaetigen fuehrt genau den Vorschlag aus, mit bestaetigt:true; zweites Mal 404.
 *   A5  schritte nennt Werkzeug und Stufe; Tageslimit wird gezaehlt (copilotKontingent).
 *   A6  Telegram unveraendert: ohne schreibenVormerken laeuft das Schreibwerkzeug wie bisher.
 *
 * Aufruf: node tools/flow-agent-pruefen.mjs     RC 0 = alles gruen
 * ══════════════════════════════════════════════════════════════════════ */
import path from 'path';
import crypto from 'crypto';
import Module, { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
process.env.OPENAI_API_KEY = 'sk-pruefer-ohne-wirkung';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

const V = [];                 /* agent_vorschlaege */
const LOG = [];               /* alle Abfragen */
const DB = {
  query: async (sql, p) => {
    const s = String(sql).replace(/\s+/g, ' ');
    LOG.push(s.slice(0, 80));
    if (/^INSERT INTO agent_vorschlaege/.test(s.trim())) { V.push({ id: V.length + 1, user_id: p[0], token_hash: p[1], werkzeug: p[2], args: JSON.parse(p[3]), kurz: p[4], status: 'offen' }); return { rowCount: 1, rows: [] }; }
    if (/UPDATE agent_vorschlaege SET status='ausgefuehrt'/.test(s)) {
      const z = V.find((x) => x.user_id === p[0] && x.token_hash === p[1] && x.status === 'offen');
      if (!z) return { rowCount: 0, rows: [] };
      z.status = 'ausgefuehrt'; return { rowCount: 1, rows: [{ id: z.id, werkzeug: z.werkzeug, args: z.args, kurz: z.kurz }] };
    }
    if (/UPDATE agent_vorschlaege SET ergebnis/.test(s)) return { rowCount: 1, rows: [] };
    if (/SELECT 1 FROM objects/.test(s)) return { rowCount: 1, rows: [{}] };
    return { rowCount: 0, rows: [] };
  }
};
const origLoad = Module._load;
Module._load = function (req) {
  if (/[\\/]db[\\/]pool(\.js)?$/.test(req) || req === '../db/pool' || req === './pool') return DB;
  if (req === 'express') { const r = () => { const o = {}; ['get', 'post', 'put', 'patch', 'delete', 'use'].forEach((m) => { o[m] = () => o; }); return o; }; const ex = () => r(); ex.Router = r; ex.json = () => () => {}; ex.urlencoded = () => () => {}; return ex; }
  if (!req.startsWith('.') && !req.startsWith('node:') && !Module.isBuiltin(req) && !path.isAbsolute(req)) {
    try { return origLoad.apply(this, arguments); } catch (e) {
      if (req === 'dotenv') return { config: () => ({ parsed: {} }) };
      const leer = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : leer), apply: () => leer, construct: () => leer });
      return leer;
    }
  }
  return origLoad.apply(this, arguments);
};
const _w = console.warn; console.warn = () => {};
const ai = require_(path.join(ROOT, 'backend/src/routes/ai.js'));
let zaehler = 0;
ai.copilotKontingent.verbrauchen = async () => { zaehler++; return { ok: true, limit: 20, benutzt: zaehler }; };
const W = require_(path.join(ROOT, 'backend/src/services/agentWerkzeuge.js'));
const lauf = require_(path.join(ROOT, 'backend/src/services/agentLauf.js'));
const FA = require_(path.join(ROOT, 'backend/src/services/flowAgent.js'));
console.warn = _w;

/* Werkzeug-Spione: was wirklich ausgefuehrt wird */
const ausgefuehrt = [];
const fa = W.finde('felder_aendern');
const origFa = fa.fn;
fa.fn = async (ctx, args) => { ausgefuehrt.push({ werkzeug: 'felder_aendern', args }); return { ok: true, geaendert: Object.keys(args.felder || {}) }; };
const mb = W.finde('marktbericht_abrufen');
mb.fn = async () => { ausgefuehrt.push({ werkzeug: 'marktbericht_abrufen' }); return { ok: true }; };

/* Das Modell als Drehbuch */
let drehbuch = [];
globalThis.fetch = async (url, o) => {
  if (!/openai\.com/.test(String(url))) throw new Error('Pruefer: unerwarteter Abruf ' + url);
  const schritt = drehbuch.shift() || { text: 'Fertig.' };
  const output = [];
  (schritt.aufrufe || []).forEach((a, i) => output.push({ type: 'function_call', name: a.name, arguments: JSON.stringify(a.args || {}), call_id: 'c' + i + Math.random() }));
  if (schritt.text) output.push({ type: 'message', content: [{ type: 'output_text', text: schritt.text }] });
  return { ok: true, json: async () => ({ output }) };
};

let fehler = 0, n = 0;
const pruef = (name, ok, ist) => { n++; if (!ok) { fehler++; console.log('  \x1b[31mROT\x1b[0m ' + name + (ist !== undefined ? '  ' + JSON.stringify(ist).slice(0, 400) : '')); } };
const U = 'u1', OBJ = '11111111-2222-3333-4444-555555555555';

/* A1 / A2 / A5 */
drehbuch = [
  { aufrufe: [{ name: 'felder_aendern', args: { nummer: 1, felder: { kp: '199000' } } }, { name: 'marktbericht_abrufen', args: { stufe: 1 } }] },
  { text: 'Ich wuerde den Kaufpreis auf 199.000 EUR setzen - bitte bestaetigen.' }
];
const r1 = await FA.frage(U, { text: 'Setz den Kaufpreis auf 199000', objekt_id: OBJ });
pruef('A1 Schreibwerkzeug nicht ausgefuehrt', !ausgefuehrt.some((x) => x.werkzeug === 'felder_aendern'), ausgefuehrt);
pruef('A1 Vorschlag mit Token', Array.isArray(r1.bestaetigen) && r1.bestaetigen.length === 1 && /^dpav_/.test(r1.bestaetigen[0].token)
  && r1.bestaetigen[0].werkzeug === 'felder_aendern' && /kp=199000/.test(r1.bestaetigen[0].kurz), r1.bestaetigen);
pruef('A1 kein UPDATE objects', !LOG.some((q) => /UPDATE objects/.test(q)), LOG);
pruef('A2 kostenpflichtiges Werkzeug gesperrt', !ausgefuehrt.some((x) => x.werkzeug === 'marktbericht_abrufen'), ausgefuehrt);
pruef('A5 schritte mit Werkzeug und Stufe', r1.schritte.some((s) => s.werkzeug === 'felder_aendern' && s.stufe === 'schreiben')
  && r1.schritte.some((s) => s.werkzeug === 'marktbericht_abrufen'), r1.schritte);
pruef('A5 Antworttext', /199\.000/.test(r1.antwort), r1.antwort);
pruef('A5 Tageslimit gezaehlt', zaehler === 1 && r1.tageslimit.benutzt === 1, r1.tageslimit);

/* A3 */
let fehl = null;
const vorher = zaehler;
try { await FA.frage(U, { text: 'Hol den Bericht', darf_kosten: true }); } catch (e) { fehl = e; }
pruef('A3 darf_kosten ohne Token: 402 KOSTEN_TOKEN_FEHLT', fehl && fehl.statusCode === 402 && fehl.code === 'KOSTEN_TOKEN_FEHLT' && zaehler === vorher, fehl && fehl.message);

/* A4 */
const tok = r1.bestaetigen[0].token;
const b1 = await FA.bestaetigen(U, tok);
const lauf1 = ausgefuehrt.find((x) => x.werkzeug === 'felder_aendern');
pruef('A4 bestaetigen fuehrt aus, mit bestaetigt:true', b1.ok && lauf1 && lauf1.args.bestaetigt === true && lauf1.args.felder.kp === '199000', { b1, lauf1 });
let zweit = null;
try { await FA.bestaetigen(U, tok); } catch (e) { zweit = e; }
pruef('A4 zweites Mal 404', zweit && zweit.statusCode === 404, zweit && zweit.message);
let fremd = null;
try { await FA.bestaetigen('u2', 'dpav_falsch'); } catch (e) { fremd = e; }
pruef('A4 fremder Token 404', fremd && fremd.statusCode === 404);

/* A6 */
ausgefuehrt.length = 0;
drehbuch = [{ aufrufe: [{ name: 'felder_aendern', args: { nummer: 1, felder: { kp: '1' } } }] }, { text: 'ok' }];
const ctxT = { userId: U, protokoll: [], merkeObjekt() {}, merkeListe() {} };
await lauf.laufen('telegram', ctxT, {});
pruef('A6 Telegram ohne schreibenVormerken: Werkzeug laeuft wie bisher', ausgefuehrt.some((x) => x.werkzeug === 'felder_aendern'), ausgefuehrt);
fa.fn = origFa;

console.log('flow-agent-pruefen: ' + (n - fehler) + ' von ' + n + ' gruen');
console.log(fehler ? '\x1b[31mRC=1\x1b[0m' : '\x1b[32mRC=0\x1b[0m');
process.exit(fehler ? 1 : 0);
