#!/usr/bin/env node
/* tools/ki-deckel-pruefen.mjs — v3318 · KI-Verbrauch erfassen und Monatsdeckel
 *
 *   node tools/ki-deckel-pruefen.mjs
 *
 * Laedt die ECHTEN Dateien (backend/src/services/kiVerbrauch.js, openaiService.js, config.js) mit einer
 * nachgebauten Datenbank, ohne Netz und ohne OpenAI:
 *   A  Preisliste: jeder Satz in PREISE_FEST gegen die Preistabelle des Kostenberichts
 *      (Dateien/Architektur/KI-Kosten-je-Kunde-2026-11-12.md, Abschnitt 2 - hier abgeschrieben, nicht
 *      aus dem Code gelesen), und die Kostenrechnung je Modell an festen usage-Beispielen
 *      (Text, Cache, Audio, Dauer, Websuche, Chat-Completions-Form, unbekanntes Modell = teuerster Satz).
 *   B  Deckel: knapp unter der Grenze frei, GENAU an der Grenze gesperrt, Admin ohne Deckel, Testkonto
 *      eigener Wert, Testphase eigener Wert, eigener Schluessel nie gesperrt, Marktbericht nicht im Deckel,
 *      je Vorgang nur einmal geprueft, Monatsgrenze je Funktion, parallele Vorgaenge werden vorgemerkt.
 *   C  Protokollfehler bricht den Aufruf nicht: INSERT wirft -> erfassen() wirft nicht, callOpenAI()
 *      liefert trotzdem den Text; gesperrt -> callOpenAI() ruft fetch gar nicht erst.
 *   D  Co-Pilot-Tageszaehler steht in der Datenbank: Modul neu geladen (= Neustart) -> derselbe Stand;
 *      tagVerbrauchen() haelt das Limit; routes/ai.js fuehrt keine Map mehr.
 *   E  Aufrufstellen: jeder OpenAI-Aufruf in backend/src und marktbericht/backend/src steht in der
 *      Liste unten und hat seinen Erfassungsweg (kiVerbrauch.erfassen / usageErfassen / _kiSammler)
 *      und - ausser im mb-Dienst - seine Pruefung (vorAufruf) in der Naehe. Neue Stelle = ROT.
 *      Dazu: kein direkter OpenAI-Aufruf im Frontend.
 * RC=0 sauber.
 */
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let fehler = 0;
const ok = (t) => console.log('  ok   ' + t);
const rot = (t) => { fehler++; console.log('  ROT  ' + t); };
const nah = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* ── nachgebaute Datenbank ─────────────────────────────────────────────── */
const DB = { users: {}, plaene: {}, verbrauch: [], tag: {}, insertWirft: false };
function sqlNorm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
async function fakeQuery(sql, p) {
  const s = sqlNorm(sql);
  if (/^SELECT role, is_test_user FROM users/.test(s)) { const u = DB.users[p[0]]; return { rows: u ? [u] : [] }; }
  if (/^INSERT INTO ki_verbrauch/.test(s)) {
    if (DB.insertWirft) throw new Error('relation "ki_verbrauch" does not exist (nachgestellt)');
    const k = ['user_id', 'endpunkt', 'funktion', 'gruppe', 'vorgang', 'modell', 'ein', 'ein_cached', 'ein_audio', 'aus', 'denk',
      'websuchen', 'audio_sek', 'usd', 'eur', 'kurs', 'bepreist', 'im_deckel', 'eigener_schluessel', 'abgeschnitten', 'quelle', 'meta'];
    const z = {}; k.forEach((n, i) => { z[n] = p[i]; }); DB.verbrauch.push(z); return { rows: [], rowCount: 1 };
  }
  if (/^SELECT COALESCE\(SUM\(eur\),0\) AS eur FROM ki_verbrauch WHERE user_id = \$1 AND im_deckel AND NOT eigener_schluessel/.test(s)) {
    const sum = DB.verbrauch.filter((z) => z.user_id === p[0] && z.im_deckel && !z.eigener_schluessel).reduce((a, z) => a + Number(z.eur), 0);
    return { rows: [{ eur: String(sum) }] };
  }
  if (/^SELECT COUNT\(DISTINCT vorgang\) AS n FROM ki_verbrauch/.test(s)) {
    const set = new Set(DB.verbrauch.filter((z) => z.user_id === p[0] && z.gruppe === p[1] && !z.eigener_schluessel && (p.length < 3 || z.vorgang !== p[2])).map((z) => z.vorgang));
    return { rows: [{ n: String(set.size) }] };
  }
  if (/^SELECT copilot, sprache_s FROM ki_tageszaehler/.test(s)) { const z = DB.tag[p[0]]; return { rows: z ? [z] : [] }; }
  if (/^INSERT INTO ki_tageszaehler \(user_id, tag, copilot, sprache_s\)/.test(s)) {
    const z = DB.tag[p[0]] || (DB.tag[p[0]] = { copilot: 0, sprache_s: 0 }); z.copilot += p[1]; z.sprache_s += p[2]; return { rows: [] };
  }
  if (/^INSERT INTO ki_tageszaehler \(user_id, tag\)/.test(s)) { if (!DB.tag[p[0]]) DB.tag[p[0]] = { copilot: 0, sprache_s: 0 }; return { rows: [] }; }
  if (/^UPDATE ki_tageszaehler SET copilot = copilot \+ 1/.test(s)) {
    const z = DB.tag[p[0]]; if (z && z.copilot < p[1]) { z.copilot++; return { rows: [{ copilot: z.copilot }] }; } return { rows: [] };
  }
  throw new Error('Pruefer kennt die Abfrage nicht: ' + s.slice(0, 90));
}

/* ── Module umlenken: Datenbank, Abo, fehlende Pakete ──────────────────── */
const origLoad = Module._load;
Module._load = function (req) {
  if (/[\\/]db[\\/]pool(\.js)?$/.test(req) || req === '../db/pool' || req === './pool') return { query: fakeQuery };
  if (/subscriptionService$/.test(req)) return { getEffectivePlan: async (uid) => DB.plaene[uid] || { plan_id: 'free' } };
  if (!req.startsWith('.') && !req.startsWith('node:') && !Module.isBuiltin(req) && !path.isAbsolute(req)) {
    try { return origLoad.apply(this, arguments); } catch (e) {
      if (req === 'dotenv') return { config: () => ({ parsed: {} }) };
      const leer = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : leer), apply: () => leer, construct: () => leer });
      return leer;
    }
  }
  return origLoad.apply(this, arguments);
};
process.env.OPENAI_API_KEY = 'sk-server-pruefer';
delete process.env.KI_DECKEL_EUR; delete process.env.KI_MONATSGRENZEN; delete process.env.OPENAI_PREISE; delete process.env.OPENAI_USD_EUR;
const _warn = console.warn; console.warn = () => {};
const PFAD_KV = path.join(WURZEL, 'backend/src/services/kiVerbrauch.js');
const config = require(path.join(WURZEL, 'backend/src/config.js'));
let KV = require(PFAD_KV);
KV._setzeQuery(fakeQuery);

/* ═══ A · Preisliste und Kostenrechnung ═══════════════════════════════════ */
console.log('\nA  Preisliste (Bericht Abschnitt 2) und Kostenrechnung je Modell');
const BERICHT = {   /* USD je Mio Token: ein / ein gecacht / aus - abgeschrieben aus dem Bericht */
  'gpt-5.6-luna': [0.20, 0.02, 1.20], 'gpt-5.6-terra': [2.00, 0.20, 12.00], 'gpt-5.5': [5.00, 0.50, 30.00],
  'gpt-5.4-mini': [0.75, 0.075, 4.50], 'gpt-4.1': [2.00, 0.50, 8.00], 'gpt-4.1-mini': [0.40, 0.10, 1.60], 'gpt-4o-mini': [0.15, 0.075, 0.60]
};
for (const [m, [e, c, a]] of Object.entries(BERICHT)) {
  const p = KV.PREISE_FEST[m];
  if (!p) { rot(m + ' fehlt in PREISE_FEST'); continue; }
  if (nah(p.ein, e) && nah(p.einCached, c) && nah(p.aus, a)) ok(m + ' ' + e + ' / ' + c + ' / ' + a + ' $ je Mio');
  else rot(m + ': Code ' + p.ein + '/' + p.einCached + '/' + p.aus + ' statt ' + e + '/' + c + '/' + a);
}
for (const [m, min] of Object.entries({ 'gpt-4o-mini-transcribe': 0.003, 'gpt-4o-transcribe': 0.006, 'gpt-realtime-whisper': 0.017 })) {
  const p = KV.PREISE_FEST[m];
  if (p && nah(p.min, min)) ok(m + ' ' + min + ' $/min'); else rot(m + ' Minutenpreis ' + (p && p.min) + ' statt ' + min);
}
if (nah(KV.WEBSUCHE_USD.standard, 0.025) && nah(KV.WEBSUCHE_USD.denk, 0.010)) ok('Websuche 25 $ / 10 $ je 1.000'); else rot('Websuche-Preise');
if (nah(KV.kurs(), 0.92)) ok('Kurs 0,92 €/$ (OPENAI_USD_EUR-Vorgabe)'); else rot('Kurs ' + KV.kurs());

const FAELLE = [
  { name: 'gpt-4.1 Text 10.000 ein (2.000 gecacht) / 1.000 aus', m: 'gpt-4.1',
    data: { usage: { input_tokens: 10000, input_tokens_details: { cached_tokens: 2000 }, output_tokens: 1000 } },
    usd: (8000 * 2.00 + 2000 * 0.50 + 1000 * 8.00) / 1e6 },
  { name: 'gpt-4.1 mit 3 Websuchen (Deal-Analyse-Form)', m: 'gpt-4.1',
    data: { usage: { input_tokens: 11500, output_tokens: 5000 }, output: [{ type: 'web_search_call' }, { type: 'web_search_call' }, { type: 'web_search_call' }, { type: 'message' }] },
    usd: (11500 * 2.00 + 5000 * 8.00) / 1e6 + 3 * 0.025 },
  { name: 'gpt-5.6-luna mit Denk-Token und 1 Suche (Denkmodell-Satz)', m: 'gpt-5.6-luna',
    data: { usage: { input_tokens: 6000, output_tokens: 1500, output_tokens_details: { reasoning_tokens: 1000 } }, output: [{ type: 'web_search_call' }] },
    usd: (6000 * 0.20 + 1500 * 1.20) / 1e6 + 0.010 },
  { name: 'gpt-4.1-mini Chat-Completions-Form (Marktbericht)', m: 'gpt-4.1-mini',
    data: { usage: { prompt_tokens: 24000, prompt_tokens_details: { cached_tokens: 20000 }, completion_tokens: 1800 } },
    usd: (4000 * 0.40 + 20000 * 0.10 + 1800 * 1.60) / 1e6 },
  { name: 'gpt-4o-mini-transcribe Token-Form (Audio 1.200, Text 50 / aus 300)', m: 'gpt-4o-mini-transcribe',
    data: { usage: { type: 'tokens', input_tokens: 1250, input_token_details: { audio_tokens: 1200 }, output_tokens: 300 } },
    usd: (50 * 1.25 + 1200 * 3.00 + 300 * 5.00) / 1e6 },
  { name: 'gpt-4o-mini-transcribe Dauer-Form 120 s', m: 'gpt-4o-mini-transcribe',
    data: { usage: { type: 'duration', seconds: 120 } }, usd: 2 * 0.003 },
  { name: 'Realtime ohne usage, 90 s gemessen', m: 'gpt-realtime-whisper', data: null, extra: { audioSekunden: 90 }, usd: 1.5 * 0.017 },
  { name: 'Datums-Schnappschuss gpt-4.1-2025-04-14 = gpt-4.1', m: 'gpt-4.1-2025-04-14',
    data: { usage: { input_tokens: 1000, output_tokens: 100 } }, usd: (1000 * 2.00 + 100 * 8.00) / 1e6 },
  { name: 'unbekanntes Modell = teuerster Satz, bepreist:false', m: 'gpt-9-geheim',
    data: { usage: { input_tokens: 1000, output_tokens: 1000 } }, usd: (1000 * 5.00 + 1000 * 30.00) / 1e6, unbepreist: true }
];
for (const f of FAELLE) {
  const p = KV.postenAus(f.m, f.data, f.extra || {});
  const passt = nah(p.usd, Math.round(f.usd * 1e6) / 1e6, 1e-6) && nah(p.eur, Math.round(f.usd * 0.92 * 1e6) / 1e6, 2e-6) && (!!f.unbepreist === !p.bepreist);
  if (passt) ok(f.name + ' = ' + (p.usd * 100).toFixed(4) + ' US-ct'); else rot(f.name + ': ' + JSON.stringify({ usd: p.usd, soll: f.usd, bepreist: p.bepreist }));
}
{ const p = KV.postenAus('gpt-4.1', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage: { input_tokens: 1, output_tokens: 1 } });
  if (p.abgeschnitten) ok('abgeschnittene Antwort wird erkannt (status incomplete)'); else rot('abgeschnitten nicht erkannt'); }

/* ═══ B · Deckel ══════════════════════════════════════════════════════════ */
console.log('\nB  Monatsdeckel');
const D = config.ki.deckelEur;
const U = { free: '00000000-0000-4000-8000-000000000001', pro: '00000000-0000-4000-8000-000000000002', admin: '00000000-0000-4000-8000-000000000003',
  test: '00000000-0000-4000-8000-000000000004', trial: '00000000-0000-4000-8000-000000000005', grp: '00000000-0000-4000-8000-000000000006' };
DB.users[U.free] = { role: 'user', is_test_user: false };
DB.users[U.pro] = { role: 'user', is_test_user: false }; DB.plaene[U.pro] = { plan_id: 'pro' };
DB.users[U.admin] = { role: 'admin', is_test_user: false }; DB.plaene[U.admin] = { plan_id: 'pro' };
DB.users[U.test] = { role: 'user', is_test_user: true }; DB.plaene[U.test] = { plan_id: 'pro' };
DB.users[U.trial] = { role: 'user', is_test_user: false }; DB.plaene[U.trial] = { plan_id: 'pro', trial: true };
DB.users[U.grp] = { role: 'user', is_test_user: false }; DB.plaene[U.grp] = { plan_id: 'starter' };
function zeile(uid, eur, extra) { DB.verbrauch.push(Object.assign({ user_id: uid, eur: eur, im_deckel: true, eigener_schluessel: false, gruppe: null, vorgang: 'v-' + DB.verbrauch.length }, extra || {})); }
async function gesperrt(uid, o) {
  try { await KV.mitKontext(Object.assign({ userId: uid, endpunkt: 'ai/copilot' }, o || {}), () => KV.vorAufruf(o || {})); return false; }
  catch (e) { if (e.code === 'KI_KONTINGENT' && e.status === 429) return e; throw e; }
}
const Werte = [['free', D.free], ['starter', D.starter], ['investor', D.investor], ['pro', D.pro], ['partner', D.partner], ['testphase', D.testphase]];
const MAX = 4.00;
for (const [n, w] of Werte) { if (w != null && w > 0 && w <= MAX) ok('Deckel ' + n + ' ' + w.toFixed(2) + ' € (≤ ' + MAX.toFixed(2) + ' €)'); else rot('Deckel ' + n + ' = ' + w + ' (soll 0 < x ≤ 4 €)'); }
if (D.admin === null) ok('Admin ohne Deckel'); else rot('Admin-Deckel ' + D.admin);

zeile(U.pro, D.pro - 0.000001);
if (!(await gesperrt(U.pro))) ok('Pro ' + D.pro + ' €: knapp darunter (−0,000001 €) frei'); else rot('Pro knapp unter der Grenze gesperrt');
zeile(U.pro, 0.000001);
const e1 = await gesperrt(U.pro);
if (e1 && /KI-Kontingent für diesen Monat ist aufgebraucht/.test(e1.message) && /Ab dem 1\./.test(e1.message)) ok('Pro genau an der Grenze gesperrt: „' + e1.message + '“');
else rot('Pro genau an der Grenze nicht (richtig) gesperrt');
if (!(await gesperrt(U.pro, { eigenerSchluessel: true }))) ok('eigener OpenAI-Schluessel: nie gesperrt'); else rot('eigener Schluessel gesperrt');
if (!(await gesperrt(U.pro, { endpunkt: 'marktbericht/full', funktion: 'marktbericht' }))) ok('KI-Marktbericht: nicht im Deckel (eigenes Kontingent)'); else rot('Marktbericht gesperrt');
if (await gesperrt(U.pro, { endpunkt: 'marktbericht/verlauf-text' })) ok('Verlaufstext zaehlt in den Deckel'); else rot('Verlaufstext nicht gedeckelt');

zeile(U.admin, 500);
if (!(await gesperrt(U.admin))) ok('Admin mit 500 € Verbrauch: frei'); else rot('Admin gesperrt');
zeile(U.test, D.test - 0.01);
if (!(await gesperrt(U.test))) ok('Testkonto eigener Wert ' + D.test + ' €: darunter frei'); else rot('Testkonto unter eigenem Wert gesperrt');
zeile(U.test, 0.01);
if (await gesperrt(U.test)) ok('Testkonto an ' + D.test + ' € gesperrt'); else rot('Testkonto-Deckel greift nicht');
zeile(U.trial, D.testphase);
if (await gesperrt(U.trial)) ok('laufende Testphase: eigener Wert ' + D.testphase + ' € (nicht der Pro-Deckel)'); else rot('Testphase-Deckel greift nicht');
zeile(U.free, D.free);
if (await gesperrt(U.free)) ok('Free an ' + D.free + ' € gesperrt'); else rot('Free-Deckel greift nicht');

/* je Vorgang nur einmal: ein zweiter Aufruf im selben Vorgang wird nicht abgeschnitten */
{
  const uid = '00000000-0000-4000-8000-000000000007'; DB.users[uid] = { role: 'user', is_test_user: false }; DB.plaene[uid] = { plan_id: 'investor' };
  let zweiter = 'nicht gelaufen';
  await KV.mitKontext({ userId: uid, endpunkt: 'telegram' }, async () => {
    await KV.vorAufruf({});
    zeile(uid, D.investor + 1);           /* der erste Aufruf war teuer */
    try { await KV.vorAufruf({}); zweiter = 'frei'; } catch (e) { zweiter = 'gesperrt'; }
  });
  if (zweiter === 'frei') ok('Agent-Runde 2 im selben Vorgang laeuft weiter (geprueft je Vorgang)'); else rot('Runde 2 im selben Vorgang: ' + zweiter);
  if (await gesperrt(uid)) ok('… der naechste Vorgang ist gesperrt'); else rot('naechster Vorgang nicht gesperrt');
}
/* parallele Vorgaenge: Reserve je offenem, geprueftem Vorgang */
{
  const uid = '00000000-0000-4000-8000-000000000008'; DB.users[uid] = { role: 'user', is_test_user: false }; DB.plaene[uid] = { plan_id: 'starter' };
  const reserve = config.ki.reserveEur;
  zeile(uid, D.starter - reserve + 0.01);   /* allein frei, mit einem offenen Vorgang daneben nicht */
  let erster, zweiter;
  await KV.mitKontext({ userId: uid, endpunkt: 'ai/lage' }, async () => {
    erster = await KV.vorAufruf({}).then(() => 'frei', () => 'gesperrt');   /* bleibt offen (kein Ende der Anfrage) */
    zweiter = await gesperrt(uid);
  });
  if (erster === 'frei' && zweiter) ok('erster Vorgang frei, zweiter paralleler mit ' + reserve + ' € Reserve fuer den ersten gesperrt'); else rot('parallele Vorgaenge: erster ' + erster + ', zweiter ' + (zweiter ? 'gesperrt' : 'frei'));
  KV._offen.delete(uid);   /* = Ende der ersten Anfrage (res finish) */
  if (!(await gesperrt(uid))) ok('… nach Ende des ersten Vorgangs wieder frei'); else rot('Reserve wird nicht freigegeben');
}
/* Monatsgrenze je Funktion */
{
  const g = config.ki.monatsgrenzen.starter.analyse;
  for (let i = 0; i < g - 1; i++) zeile(U.grp, 0.0001, { gruppe: 'analyse' });
  if (!(await gesperrt(U.grp, { endpunkt: 'ai/analyze' }))) ok('Starter: ' + (g - 1) + ' von ' + g + ' Deal-Analysen -> frei'); else rot('Monatsgrenze zu frueh');
  zeile(U.grp, 0.0001, { gruppe: 'analyse' });
  const e = await gesperrt(U.grp, { endpunkt: 'ai/analyze' });
  if (e && /Deal-Analysen/.test(e.message) && /\(\d+ von \d+\)/.test(e.message)) ok(g + ' von ' + g + ' -> gesperrt: „' + e.message + '“'); else rot('Monatsgrenze Analyse greift nicht');
  if (!(await gesperrt(U.grp, { endpunkt: 'ai/copilot' }))) ok('… andere Funktion (Co-Pilot) bleibt frei'); else rot('Monatsgrenze sperrt fremde Funktion');
  if (KV.gruppeAus('ai/extract-dokument') === 'dokument' && KV.gruppeAus('ai/lage') === 'recherche' && KV.gruppeAus('objects/:id/offerte') === 'analyse' && KV.gruppeAus('ai/copilot') === null)
    ok('Einordnung Weg -> Gruppe (dokument, recherche, analyse, keine)'); else rot('gruppeAus');
}
/* Antwort fuer die Route */
{
  let st = null, body = null;
  const res = { status(n) { st = n; return this; }, json(b) { body = b; return this; } };
  const e = KV.kontingentFehler({ grund: 'deckel', anteil_pct: 100, zurueck_am: '2026-12-01' });
  if (KV.antwortBeiSperre(res, e) && st === 429 && body.code === 'KI_KONTINGENT' && body.message === e.message) ok('Route antwortet 429 mit code KI_KONTINGENT und freundlicher Meldung');
  else rot('antwortBeiSperre');
}

/* ═══ C · Protokollfehler bricht nichts ═══════════════════════════════════ */
console.log('\nC  Protokollfehler bricht den Aufruf nicht');
DB.insertWirft = true;
{
  let geworfen = false, p = null;
  try { p = KV.erfassen({ modell: 'gpt-4.1', data: { usage: { input_tokens: 10, output_tokens: 10 } }, userId: U.pro }); await p._db; } catch (e) { geworfen = true; }
  if (!geworfen && p && p.usd > 0 && (await p._db) === false) ok('INSERT wirft -> erfassen() wirft nicht, Posten gerechnet, Fehler geschluckt'); else rot('erfassen() bei DB-Fehler');
}
const AUFRUFE = [];
globalThis.fetch = async (url, init) => {
  AUFRUFE.push(String(url));
  const body = JSON.parse(init.body);
  return { ok: true, status: 200, json: async () => ({ output_text: 'Antwort ' + body.model + ' max=' + body.max_output_tokens + ' tools=' + (body.tools || []).length,
    usage: { input_tokens: 100, output_tokens: 20 }, output: [] }), text: async () => '' };
};
const oai = require(path.join(WURZEL, 'backend/src/services/openaiService.js'));
{
  const uid = '00000000-0000-4000-8000-000000000009'; DB.users[uid] = { role: 'user', is_test_user: false }; DB.plaene[uid] = { plan_id: 'pro' };
  let r = null, fehlerText = null;
  try { r = await KV.mitKontext({ userId: uid, endpunkt: 'ai/lage' }, () => oai.callOpenAI('Hallo', {})); } catch (e) { fehlerText = e.message; }
  if (r && /^Antwort/.test(r.text)) ok('callOpenAI() mit kaputtem Protokoll liefert trotzdem: „' + r.text + '“'); else rot('callOpenAI() bei Protokollfehler: ' + fehlerText);
  DB.insertWirft = false;
  /* Ausgabegrenze und Websuche */
  const r2 = await KV.mitKontext({ userId: uid, endpunkt: 'ai/extract-rndg' }, () => oai.callOpenAI('x', { maxTokens: 900, noWebSearch: true, model: 'gpt-4.1' }));
  const r3 = await KV.mitKontext({ userId: uid, endpunkt: 'ai/analyze' }, () => oai.callOpenAI('x', { model: 'gpt-4.1' }));
  const r4 = await KV.mitKontext({ userId: uid, endpunkt: 'ai/copilot' }, () => oai.callOpenAI('x', { maxTokens: 2500, model: 'gpt-5.6-luna' }));
  if (/max=2000 tools=0/.test(r2.text)) ok('maxTokens 900 wirkt (Grenze 2.000 = Mindestwert), Websuche aus'); else rot('maxTokens/noWebSearch: ' + r2.text);
  if (/max=32000 tools=1/.test(r3.text)) ok('ohne maxTokens bleibt das Modellmaximum 32.000, Websuche an (Deal-Analyse)'); else rot('Analyse-Grenze: ' + r3.text);
  if (/max=7750/.test(r4.text)) ok('Denkmodell: 2.500 × 1,5 + 4.000 Denk-Token = 7.750'); else rot('Denkmodell-Grenze: ' + r4.text);
  const z = DB.verbrauch.filter((x) => x.user_id === uid);
  if (z.length === 3 && z.every((x) => x.funktion === 'callOpenAI') && z.map((x) => x.endpunkt).join(',') === 'ai/extract-rndg,ai/analyze,ai/copilot')
    ok('jeder callOpenAI-Aufruf = eine Zeile mit Nutzer und Weg aus dem Vorgang (3 Zeilen)'); else rot('Zeilen aus callOpenAI: ' + JSON.stringify(z.map((x) => x.endpunkt)));
  /* gesperrt: kein fetch */
  zeile(uid, D.pro + 1);
  const vor = AUFRUFE.length; let code = null;
  try { await KV.mitKontext({ userId: uid, endpunkt: 'ai/lage' }, () => oai.callOpenAI('x', {})); } catch (e) { code = e.code; }
  if (code === 'KI_KONTINGENT' && AUFRUFE.length === vor) ok('gesperrt: callOpenAI() wirft KI_KONTINGENT, OpenAI wird gar nicht gerufen'); else rot('gesperrter callOpenAI(): code=' + code + ', fetch=' + (AUFRUFE.length - vor));
  /* eigener Schluessel trotz Sperre */
  config.openai.apiKey = '';
  let r5 = null; try { r5 = await KV.mitKontext({ userId: uid, endpunkt: 'ai/lage' }, () => oai.callOpenAI('x', { userApiKey: 'sk-eigener' })); } catch (e) { r5 = null; }
  const z5 = DB.verbrauch[DB.verbrauch.length - 1];
  if (r5 && z5.eigener_schluessel === true) ok('eigener Schluessel trotz Sperre: laeuft, Zeile als eigener_schluessel'); else rot('eigener Schluessel bei Sperre');
  config.openai.apiKey = 'sk-server-pruefer';
}

/* ═══ D · Tageszaehler ueberlebt den Neustart ═════════════════════════════ */
console.log('\nD  Co-Pilot-Tageszaehler in der Datenbank');
{
  const uid = U.pro;
  await KV.tagErhoehen(uid, 3, 0);
  await KV.tagErhoehen(uid, 0, 130);
  delete require.cache[require.resolve(PFAD_KV)];            /* = Neustart des Prozesses */
  KV = require(PFAD_KV); KV._setzeQuery(fakeQuery);
  const st = await KV.tagStand(uid);
  if (st.copilot === 3 && st.sprache_s === 130) ok('nach Neuladen des Moduls: 3 Fragen, 130 s Sprache - derselbe Stand'); else rot('Stand nach Neustart: ' + JSON.stringify(st));
  const a = await KV.tagVerbrauchen(uid, 4), b = await KV.tagVerbrauchen(uid, 4);
  if (a.ok && a.benutzt === 4 && !b.ok && b.benutzt === 4) ok('tagVerbrauchen haelt das Limit (4. frei, 5. abgewiesen)'); else rot('tagVerbrauchen: ' + JSON.stringify([a, b]));
  const ai = fs.readFileSync(path.join(WURZEL, 'backend/src/routes/ai.js'), 'utf8');
  if (!/_cpDaily|_spDaily/.test(ai.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) ok('routes/ai.js fuehrt keinen Arbeitsspeicher-Zaehler mehr'); else rot('routes/ai.js: _cpDaily/_spDaily noch im Code');
  if ((ai.match(/kiVerbrauch\.tag(Stand|Erhoehen|Verbrauchen)\(/g) || []).length >= 4) ok('Co-Pilot, Sprache, Telegram/Flow zaehlen ueber ki_tageszaehler'); else rot('Tageszaehler-Aufrufe in routes/ai.js fehlen');
  const mig = path.join(WURZEL, 'backend/migrations');
  const m = fs.readdirSync(mig).find((f) => /_ki_verbrauch\.sql$/.test(f));
  const mt = m ? fs.readFileSync(path.join(mig, m), 'utf8') : '';
  if (/CREATE TABLE IF NOT EXISTS public\.ki_verbrauch/.test(mt) && /CREATE TABLE IF NOT EXISTS public\.ki_tageszaehler/.test(mt)) ok('Migration ' + m + ' legt ki_verbrauch und ki_tageszaehler an'); else rot('Migration fehlt');
}

/* ═══ E · Aufrufstellen ═══════════════════════════════════════════════════ */
console.log('\nE  Jeder OpenAI-Aufruf geht durch den Erfassungsweg');
const STELLEN = {   /* Datei -> Zahl der OpenAI-Aufrufe (fetch / WebSocket / httpJson) */
  'backend/src/services/openaiService.js': 2,      /* callOpenAI, _callOpenAIVision */
  'backend/src/services/agentLauf.js': 1,          /* _ruf (Telegram-/Flow-Agent) */
  'backend/src/services/voiceExtractService.js': 4,/* transcribe, extractFields, quickMatch, verifyFields */
  'backend/src/routes/ai.js': 1,                   /* /copilot-frage */
  'backend/src/ws/voiceStream.js': 1,              /* Realtime-Transkription */
  'marktbericht/backend/src/services/ReportGenerationService.js': 1   /* rawCompletion */
};
const MUSTER = /fetch\(\s*OPENAI_URL|fetch\(\s*['"`]https:\/\/api\.openai\.com|new WebSocket\(\s*REALTIME_URL|httpJson\(\s*`\$\{cfg\.ai\.base\}/g;
function dateienUnter(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'generated') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...dateienUnter(p)); else if (/\.(c|m)?js$/.test(e.name)) out.push(p);
  }
  return out;
}
const gefunden = {};
for (const basis of ['backend/src', 'marktbericht/backend/src']) {
  for (const f of dateienUnter(path.join(WURZEL, basis))) {
    const roh = fs.readFileSync(f, 'utf8');
    const ohneKomm = roh.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    const zeilen = ohneKomm.split('\n');
    let m; MUSTER.lastIndex = 0;
    while ((m = MUSTER.exec(ohneKomm))) {
      const rel = path.relative(WURZEL, f).replace(/\\/g, '/');
      const zeile = ohneKomm.slice(0, m.index).split('\n').length;
      gefunden[rel] = (gefunden[rel] || 0) + 1;
      const danach = zeilen.slice(zeile - 1, zeile + 45).join('\n');
      const davor = zeilen.slice(Math.max(0, zeile - 30), zeile).join('\n');
      const istMb = rel.startsWith('marktbericht/');
      const erfasst = /kiVerbrauch\.erfassen\(|usageErfassen\(|_kiSammler\.getStore\(/.test(davor + danach);
      const geprueft = istMb || /kiVerbrauch\.vorAufruf\(/.test(davor + danach) || (rel === 'backend/src/routes/ai.js' && /authenticate/.test(davor));
      if (erfasst && geprueft) ok(rel + ':' + zeile + ' erfasst' + (istMb ? ' (meldet usage, Deckel im Haupt-Backend)' : ' + geprueft'));
      else rot(rel + ':' + zeile + (erfasst ? '' : ' OHNE Erfassung') + (geprueft ? '' : ' OHNE vorAufruf'));
    }
  }
}
for (const [f, n] of Object.entries(STELLEN)) { if ((gefunden[f] || 0) !== n) rot(f + ': ' + (gefunden[f] || 0) + ' OpenAI-Aufrufe statt ' + n + ' (Liste in tools/ki-deckel-pruefen.mjs nachfuehren)'); }
for (const f of Object.keys(gefunden)) if (!(f in STELLEN)) rot('NEUE Aufrufstelle ' + f + ' (' + gefunden[f] + ') - in die Liste und an kiVerbrauch anschliessen');
if (Object.keys(STELLEN).every((f) => gefunden[f] === STELLEN[f])) ok('Liste der Aufrufstellen vollstaendig (' + Object.values(STELLEN).reduce((a, b) => a + b, 0) + ' in ' + Object.keys(STELLEN).length + ' Dateien)');
{
  const vx = fs.readFileSync(path.join(WURZEL, 'backend/src/services/voiceExtractService.js'), 'utf8');
  const auf = (vx.match(/usageErfassen\(sammler, '[^']+', \w+, data(, apiKey)?\)/g) || []);
  if (auf.length === 4 && auf.every((x) => /, apiKey\)$/.test(x))) ok('voiceExtractService: alle 4 usageErfassen() mit Schluessel (eigener Key -> eigener_schluessel)'); else rot('usageErfassen-Aufrufe: ' + auf.join(' | '));
  if (!/const PREISE_FEST\s*=/.test(vx) && /kiVerbrauch\.preisFuer/.test(vx)) ok('voiceExtractService fuehrt keine eigene Preisliste mehr'); else rot('zweite Preisliste in voiceExtractService');
  const mbp = fs.readFileSync(path.join(WURZEL, 'backend/src/routes/marktbericht.js'), 'utf8');
  if ((mbp.match(/openai_eur\) VALUES/g) || []).length === 4 && (mbp.match(/erfasseFremdPosten\(/g) || []).length === 3) ok('Marktbericht-Proxy: openai_eur in allen 4 cost_log-Zeilen, 3 Wege erfasst'); else rot('Marktbericht-Proxy erfasst nicht alle Wege');
  const idx = fs.readFileSync(path.join(WURZEL, 'backend/src/index.js'), 'utf8');
  const iJson = idx.indexOf("app.use(express.json("), iKv = idx.indexOf("require('./services/kiVerbrauch').middleware");
  if (iJson > 0 && iKv > iJson) ok('index.js: Vorgangs-Middleware direkt nach express.json()'); else rot('index.js: Middleware fehlt oder steht vor dem Parser');
}
/* Frontend: kein direkter OpenAI-Aufruf (B21) */
{
  const treffer = [];
  for (const f of dateienUnter(path.join(WURZEL, 'frontend'))) {
    const t = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    /* nur kostenpflichtige Wege; /v1/models (Schluesseltest in den Einstellungen, eigener Key) kostet nichts */
    if (/fetch\([^)]*api\.openai\.com\/v1\/(responses|chat|audio|realtime|completions|embeddings)/.test(t)) treffer.push(path.relative(WURZEL, f));
  }
  if (!treffer.length) ok('Frontend ruft OpenAI nirgends direkt'); else rot('direkter OpenAI-Aufruf im Frontend: ' + treffer.join(', '));
}

console.warn = _warn;
console.log('\n' + (fehler ? 'ROT: ' + fehler + ' Befund(e)' : 'GRUEN: alles sauber'));
process.exit(fehler ? 1 : 0);
