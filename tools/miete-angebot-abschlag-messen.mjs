#!/usr/bin/env node
/* tools/miete-angebot-abschlag-messen.mjs · v5080 — Abschlag Angebotsmiete -> ortsübliche Vergleichsmiete messen
   Marcel 26.11.2026: der Rückfall „Angebotsmiete minus 22/10/5 %“ (config.js mieteAngebotAbschlag) lag an 10 Städten
   im Mittel 25 % zu hoch. Gemessen an ALLEN freien Mietspiegelstädten mit Angebotsmedian aus den eigenen
   Marktberichten (--angebote=<csv ags,n,median>, Mindestzahl Berichte --min=2): je Stadt der tatsächliche Abstand
   1 − Mietspiegel/Angebot (Mietspiegel = Median über das Raster Baujahr 1955–2005 × 50/70/90 m²), Stufe wie im Kern
   (abschlagStufe: angespannt = Mietpreisbremse oder Kappung 15 %, entspannt = unter 20.000 Einwohnern, sonst mittel).
   Neuer Abschlag je Stufe = Median der Städte der Stufe, Güte per Leave-one-Stadt-out (alt gegen neu). Schreibt nichts. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MS = path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel');
const A = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] == null ? true : m[2]] : [a, true]; }));
const { werteLaden, mietspiegelWerteFuer } = await import(pathToFileURL(path.join(MS, 'werte.js')).href);
const VZ = new Map(JSON.parse(fs.readFileSync(path.join(MS, 'verzeichnis.json'), 'utf8')).saetze.map((s) => [s.ags, s]));
const KAPP = JSON.parse(fs.readFileSync(path.join(WURZEL, 'frontend/js/data/kappungsgrenzen.json'), 'utf8'));
const ctx = vm.createContext({ console, Math, JSON, Number, String, Object, Array, isFinite, parseFloat, parseInt, RegExp, Date });
ctx.window = ctx; ctx.self = ctx;
ctx.document = { readyState: 'complete', addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } };
vm.runInContext(fs.readFileSync(path.join(WURZEL, 'frontend/js/mietpotenzial-kern.js'), 'utf8'), ctx);
try { vm.runInContext(fs.readFileSync(path.join(WURZEL, 'frontend/js/config.js'), 'utf8'), ctx); } catch (e) {}
const K = ctx.DpMietpotenzial, CFG = ctx.DealPilotConfig.mieteAngebotAbschlag;
const MIN = Number(A.min || 2);
const ang = Object.fromEntries(fs.readFileSync(String(A.angebote), 'utf8').trim().split(/\r?\n/).map((z) => z.split(','))
  .filter((x) => /^\d{8}$/.test(x[0]) && Number(x[1]) >= MIN).map((x) => [x[0], { n: Number(x[1]), qm: Number(x[2]) }]));
const med = (a) => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; };
const r1 = (x) => Math.round(x * 10) / 10;
const staedte = [];
for (const [ags, w] of werteLaden().jeAgs) {
  if (w.freigabe === 'gesperrt' || !ang[ags]) continue;
  const pk = []; for (const bj of [1955, 1965, 1975, 1985, 1995, 2005]) for (const wfl of [50, 70, 90]) { let r = mietspiegelWerteFuer(w, { baujahr: bj, wfl }); if (!(r.mittel > 0)) r = mietspiegelWerteFuer(w, { baujahr: bj, wfl, lage: 'mittel' }); if (r.mittel > 0) pk.push(r.mittel); }
  if (!pk.length) continue;
  const v = VZ.get(ags) || {};
  const br = K.mietpreisbremseAus(KAPP, { ags }), kp = K.kappungAus(KAPP, { ags }, {});
  const st = K.abschlagStufe(CFG, { bremse_gilt: br ? br.gilt : null, kapp_pct: kp ? kp.pct : null, ags, einwohner: v.einwohner_ca || null });
  const ms = med(pk);
  staedte.push({ ags, gemeinde: w.gemeinde, ms, angebot: ang[ags].qm, n: ang[ags].n, stufe: st.stufe, abstand: 1 - ms / ang[ags].qm });
}
const fehler = (s, pct) => Math.abs(s.angebot * (1 - pct / 100) / s.ms - 1) * 100;
const STUFEN = ['angespannt', 'mittel', 'entspannt'];
const neu = {}; for (const st of STUFEN) { const l = staedte.filter((s) => s.stufe === st); neu[st] = l.length ? r1(med(l.map((s) => s.abstand * 100))) : null; }
const loo = (s) => { const l = staedte.filter((o) => o !== s && o.stufe === s.stufe); return l.length ? med(l.map((o) => o.abstand * 100)) : CFG.stufen[s.stufe]; };
console.log('Städte mit Angebotsmedian (mind. ' + MIN + ' Berichte): ' + staedte.length);
console.log('Stufe'.padEnd(12) + 'Städte'.padStart(7) + '   Abschlag alt   Abschlag neu (Median)   Fehler alt   Fehler neu (LOO)');
for (const st of STUFEN) {
  const l = staedte.filter((s) => s.stufe === st);
  if (!l.length) { console.log(st.padEnd(12) + '0'.padStart(7)); continue; }
  const fa = l.map((s) => fehler(s, CFG.stufen[st])), fn = l.map((s) => fehler(s, loo(s)));
  const m = (a) => r1(a.reduce((x, y) => x + y, 0) / a.length);
  console.log(st.padEnd(12) + String(l.length).padStart(7) + ('   ' + CFG.stufen[st] + ' %').padEnd(16) + ((neu[st] + ' %').padEnd(24)) + (m(fa) + ' %').padEnd(13) + m(fn) + ' %');
}
const all = (f) => r1(staedte.reduce((a, s) => a + f(s), 0) / staedte.length);
console.log('gesamt'.padEnd(12) + String(staedte.length).padStart(7) + ' '.repeat(43) + (all((s) => fehler(s, CFG.stufen[s.stufe])) + ' %').padEnd(13) + all((s) => fehler(s, loo(s))) + ' %');
console.log('\nJe Stadt: ' + staedte.sort((a, b) => a.abstand - b.abstand).map((s) => s.gemeinde + ' ' + r1(s.abstand * 100) + ' % (' + s.stufe + ', n ' + s.n + ')').join(' · '));
