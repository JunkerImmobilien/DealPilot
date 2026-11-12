#!/usr/bin/env node
/* wasserzeichen-pruefen.mjs · v3337 — „DealPilot Free" nur, wenn der Plan WIRKLICH free ist
   Laedt die ECHTEN Dateien (frontend/js/config.js, den Sub-Block aus subscription.js,
   _applyWatermarkIfFree aus pdf.js, wasserzeichen() aus dok-weiche.js) in einer
   nachgebauten Browser-Umgebung, ohne Netz:
     A  Entscheidung Sub.wasserzeichenNoetig() je Zustand: Investor/Starter/Pro/Partner
        geladen = kein Stempel, Free geladen = Stempel, Testphase = Stempel, Abruf
        gescheitert + kein letzter Plan = KEIN Stempel (gemessen 12.11.: vorher 30x „Free"
        auf 10 Seiten beim Investor), Abruf gescheitert + letzter Plan, abgemeldet
     B  planSicher() laedt einmal frisch nach und ist danach bekannt
     C  pdf.js _applyWatermarkIfFree stempelt genau dann, wenn B/A es sagt (Text „Free"/„Testphase")
     D  dok-weiche.js wasserzeichen() trifft dieselbe Entscheidung
     E  Verdrahtung: planSicher() vor exportPDF und exportPDFBank
   RC=0 sauber. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = (p) => readFileSync(join(WURZEL, p), 'utf8');
let n = 0, fehler = 0;
const ok = (b, t) => { n++; if (!b) fehler++; console.log((b ? '  ok   ' : '  ROT  ') + t); };

const CONFIG = lies('frontend/js/config.js');
const SUBQ = lies('frontend/js/subscription.js');
const s0 = SUBQ.indexOf('var Sub = (function()'), s1 = SUBQ.indexOf('\n})();', s0);
if (s0 < 0 || s1 < 0) { console.log('ROT  Sub-Block in subscription.js nicht gefunden'); process.exit(1); }
const SUB = SUBQ.slice(s0, s1 + 6);
const PDF = lies('frontend/js/pdf.js');
const w0 = PDF.indexOf('function _applyWatermarkIfFree('), w1 = PDF.indexOf('window._applyWatermarkIfFree');
const WM = PDF.slice(w0, w1);
const DW = lies('frontend/js/dok-weiche.js');
const d0 = DW.indexOf('  function wasserzeichen()'), d1 = DW.indexOf('  function aktiv()');
const DWF = DW.slice(d0, d1);
ok(w0 > 0 && w1 > w0 && d0 > 0 && d1 > d0, 'Quelltexte gefunden: Sub, _applyWatermarkIfFree, wasserzeichen()');

/* Umgebung: angemeldet ja/nein, Antwort von /subscription (Objekt) oder Ausfall (null) */
async function umgebung({ angemeldet = true, antwort = null, letzter = null }) {
  const speicher = new Map(); if (letzter) speicher.set('dp_last_plan', letzter);
  const abrufe = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, Promise, Date, JSON, Math, Object, Array, String, Number, Boolean, parseInt, isNaN,
    localStorage: { getItem: (k) => (speicher.has(k) ? speicher.get(k) : null), setItem: (k, v) => speicher.set(k, String(v)), removeItem: (k) => speicher.delete(k) },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
  };
  ctx.window = ctx; ctx.dispatchEvent = () => true; ctx.addEventListener = () => {};
  ctx.document = { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], readyState: 'complete', documentElement: { style: {} }, body: null };
  ctx.Auth = { isLoggedIn: () => angemeldet, isApiMode: () => true,
    apiCall: (p) => { abrufe.push(p); if (/^\/subscription/.test(p) && antwort) return Promise.resolve({ subscription: antwort }); return Promise.reject(new Error('Ausfall')); } };
  vm.createContext(ctx);
  try { vm.runInContext(CONFIG, ctx, { filename: 'config.js' }); } catch (e) { /* config.js darf am DOM scheitern, wenn pricing steht */ }
  vm.runInContext(SUB + '\nthis.Sub = Sub;', ctx, { filename: 'subscription.js' });
  vm.runInContext('var _pn = function () { return "DealPilot"; };\n' + WM + '\nthis._applyWatermarkIfFree = _applyWatermarkIfFree;', ctx, { filename: 'pdf.js' });
  vm.runInContext('var Sub = this.Sub;\n' + DWF + '\nthis.dwWasserzeichen = wasserzeichen;', ctx, { filename: 'dok-weiche.js' });
  try { await ctx.Sub.getCurrent(true); } catch (e) {}
  return { ctx, abrufe, speicher };
}
function stempel(ctx) {
  const texte = [];
  const doc = { internal: { getNumberOfPages: () => 3 }, setPage() {}, setFont() {}, setFontSize() {}, setTextColor() {}, text: (t) => texte.push(t) };
  ctx._applyWatermarkIfFree(doc, 210);
  return texte;
}
const abo = (plan, extra) => Object.assign({ plan_id: plan, plan_name: plan, plan_features: {}, status: 'active', is_active: true, trial: false, limits: {}, usage: {} }, extra || {});

console.log('A · Entscheidung je Zustand');
{
  const u = await umgebung({ antwort: abo('free') });
  ok(!!(u.ctx.DealPilotConfig && u.ctx.DealPilotConfig.pricing), 'config.js geladen (echte Preistabelle)');
}
const FAELLE = [
  ['Investor, Abo geladen', { antwort: abo('investor') }, false, null],
  ['Starter, Abo geladen', { antwort: abo('starter') }, false, null],
  ['Pro, Abo geladen', { antwort: abo('pro') }, false, null],
  ['Free, Abo geladen', { antwort: abo('free') }, true, 'DealPilot Free'],
  ['Testphase (Pro, trial:true)', { antwort: abo('pro', { status: 'trialing', trial: true }) }, true, 'DealPilot Testphase'],
  ['Investor, /subscription faellt aus, kein letzter Plan (neue Anmeldung)', { antwort: null }, false, null],
  ['Investor, /subscription faellt aus, letzter Plan investor', { antwort: null, letzter: 'investor' }, false, null],
  ['Free, /subscription faellt aus, letzter Plan free', { antwort: null, letzter: 'free' }, true, 'DealPilot Free'],
  ['abgemeldet (nur Token, keine Sitzung)', { angemeldet: false, antwort: abo('investor') }, true, 'DealPilot Free'],
];
for (const [name, opt, soll, text] of FAELLE) {
  const u = await umgebung(opt);
  const ist = u.ctx.Sub.wasserzeichenNoetig();
  const t = stempel(u.ctx);
  const dw = u.ctx.dwWasserzeichen();
  ok(ist === soll, name + ': wasserzeichenNoetig() = ' + ist);
  ok(soll ? (t.length === 9 && t.every((x) => x === text)) : t.length === 0, name + ': pdf.js stempelt ' + (t.length ? t.length + 'x „' + t[0] + '"' : 'nicht'));
  ok(dw === soll, name + ': dok-weiche wasserzeichen() = ' + dw);
}

console.log('B · planSicher()');
{
  const u = await umgebung({ antwort: null });
  ok(u.ctx.Sub.planUnbekannt() === true, 'nach Ausfall: Plan unbekannt');
  /* Dienst ist wieder da */
  u.ctx.Auth.apiCall = (p) => { u.abrufe.push(p); return Promise.resolve({ subscription: abo('investor') }); };
  const vor = u.abrufe.length;
  const r = await u.ctx.Sub.planSicher();
  ok(r === true && u.abrufe.length === vor + 1 && u.ctx.Sub.planUnbekannt() === false, 'planSicher() laedt EINMAL frisch nach, danach bekannt (investor)');
  ok(stempel(u.ctx).length === 0, 'danach kein Stempel');
  const vor2 = u.abrufe.length; await u.ctx.Sub.planSicher();
  ok(u.abrufe.length === vor2, 'bekannter Plan: planSicher() ruft nichts ab');
  const f = await umgebung({ antwort: null });
  f.ctx.Auth.apiCall = () => Promise.resolve({ subscription: abo('free') });
  await f.ctx.Sub.planSicher();
  ok(stempel(f.ctx).length === 9, 'Free nach Ausfall und planSicher(): Stempel wieder da');
}

console.log('C · Doppel-Stempel-Schutz bleibt');
{
  const u = await umgebung({ antwort: abo('free') });
  const texte = []; const doc = { internal: { getNumberOfPages: () => 2 }, setPage() {}, setFont() {}, setFontSize() {}, setTextColor() {}, text: (t) => texte.push(t) };
  u.ctx._applyWatermarkIfFree(doc, 210); u.ctx._applyWatermarkIfFree(doc, 210);
  ok(texte.length === 6, 'zweiter Aufruf stempelt nicht nochmal (' + texte.length + ' Texte bei 2 Seiten)');
}

console.log('E · Verdrahtung');
const oK = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const inner = PDF.slice(PDF.indexOf('async function _exportPDFInner('));
ok(/await Sub\.planSicher\(\)/.test(oK(inner.slice(0, 800))), 'pdf.js: _exportPDFInner wartet auf Sub.planSicher()');
const bank = lies('frontend/js/pdf-investment-bank.js'); const b0 = bank.indexOf('window.exportPDFBank = async function');
ok(b0 > 0 && /await Sub\.planSicher\(\)/.test(oK(bank.slice(b0, b0 + 1200))), 'pdf-investment-bank.js: exportPDFBank wartet auf Sub.planSicher()');
ok(/Sub\.wasserzeichenNoetig\(\)/.test(oK(WM)), 'pdf.js: _applyWatermarkIfFree fragt Sub.wasserzeichenNoetig()');

console.log(fehler ? '\nROT: ' + fehler + ' von ' + n + ' Punkten' : '\nsauber (RC=0), ' + n + ' Punkte');
process.exit(fehler ? 1 : 0);
