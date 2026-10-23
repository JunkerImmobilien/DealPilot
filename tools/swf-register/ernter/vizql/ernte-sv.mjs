// Ernter fuer die Kalkulatoren des Gutachterausschusses Sulingen-Verden (v2886).
//
// WARUM EIN EIGENER: diese Dashboards haben KEIN Blatt "Berechnung". Der Faktor steht im
// Dashboard selbst ("Sachwertfaktor: | Standardabweichung: | 1,06 | ± 0,17"); gelesen wird
// deshalb das SVG des ganzen Dashboards. Die Lage ist ein Listen-Parameter mit eigenem Namen
// je Kalkulator (Lagesowst, Lagebrem, Lagenisnst, NoSue), die Zahl der Wohnungen heisst Zawo.
//
// Was geerntet wird:
//   - Gitter Sachwert (x) [x Bodenrichtwert (y), falls der Kalkulator ihn fuehrt] je
//     Kombination der Kategorie-Parameter aus --kat (Index fuer Index)
//   - Gegenprobe am Normpunkt je Kombination
//   - Rechnerquotienten fuer Standardstufe (Stst) und BGF/Wohnflaeche (Bgwf) am Normpunkt
//   - die Texte des Dashboards an der Vorgabe (Diagrammbeschriftungen, Stichprobe, Quelle)
//
// Nur lesend. Kein Browser. Rund 1,5 s je Punkt; Sitzungen sterben nach 30-60 min mit 410,
// deshalb wird je Kombination zwischengespeichert und bei Fehler neu angemeldet.
//
// Aufruf: node ernte-sv.mjs <workbook> [--kat=Lagesowst,Zawo] [--sach=von:bis:schritt]
//                           [--brw=50,100,150] [--neu]
import * as PF from './pfade.mjs';
import * as T from './tab.mjs';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const wb = process.argv[2];
if (!wb) { console.log('Aufruf: node ernte-sv.mjs <workbook> [--kat=A,B] [--sach=von:bis:schritt] [--brw=a,b] [--neu]'); process.exit(2); }
const arg = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').slice(n.length + 3) || null;
const ziel = PF.AUS + 'ernte/' + wb + '.json';
if (existsSync(ziel) && !process.argv.includes('--neu')) { console.log('liegt schon', ziel); process.exit(0); }
const zahl = (t) => { const m = /(-?\d+(?:\.\d{3})*(?:,\d+)?)/.exec(String(t)); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null; };

const v = await T.viewName(wb);
let s = await T.sitzung(wb, v.view);
const P = Object.fromEntries(s.params.map((p) => [p.caption, p]));
const dash = async () => T.texte(await T.svg(s, v.view));
export function wertAus(t) {
  const i = t.indexOf('Standardabweichung:');
  if (i < 0) return { f: null, sd: null };
  const f = /^\d,\d\d$/.test(t[i + 1] || '') ? zahl(t[i + 1]) : null;
  const sd = /^±\s*\d,\d\d$/.test(t[i + 2] || '') ? zahl(t[i + 2].replace('±', '')) : null;
  return { f, sd };
}
const lies = async () => wertAus(await dash());

// Kopf und Stichprobe aus dem Dashboard an der Vorgabe
const t0txt = await dash();
const stichprobe = {};
{
  const a = t0txt.indexOf('Median'); const e = t0txt.indexOf('Modellbeschreibung', a);
  for (let i = a + 1; i < (e < 0 ? t0txt.length : e);) {
    const lab = t0txt[i];
    if (zahl(lab) === null || /[A-Za-zÄÖÜäöü]/.test(lab)) { stichprobe[lab] = t0txt.slice(i + 1, i + 4); i += 4; } else i++;
  }
}
const kopf = {
  titel: t0txt.slice(0, 2).join(' | '),
  stichtag: t0txt.find((x) => /^\d\d\.\d\d\.\d{4}$/.test(x)) || null,
  quelle: t0txt.find((x) => /^Quelle:/.test(x)) || null,
  anz: t0txt.find((x) => /Kauff(ä|ae)lle/.test(x)) || null,
};
const spanne = (re) => { const k = Object.keys(stichprobe).find((x) => re.test(x)); return k ? stichprobe[k].map(zahl) : null; };
const swS = spanne(/Sach/i), brwS = spanne(/^Bodenrichtwert/), ststS = spanne(/^Standardstufe/), bgwfS = spanne(/^Bruttogrundfl/);

// Achsen
const normSach = zahl(P.Sach.wert), normBrw = P.Brw ? zahl(P.Brw.wert) : null;
function sachAchse() {
  const a = arg('sach');
  let [lo, hi, st] = a ? a.split(':').map(Number) : [null, null, null];
  if (!a) { st = swS[1] > 500000 ? 50000 : 25000; lo = Math.ceil(swS[0] / st) * st; hi = Math.floor(swS[1] / st) * st; }
  /* Bereichs-Parameter: Tableau klemmt Werte ausserhalb auf den Rand (gemessen 23.10.2026: 475.000 lieferte
     den Wert von 450.000). Deshalb die Achse auf [min, max] des Parameters begrenzen. */
  const pmin = zahl(P.Sach.min), pmax = zahl(P.Sach.max);
  if (pmin !== null && lo < pmin) lo = Math.ceil(pmin / st) * st;
  if (pmax !== null && hi > pmax) hi = Math.floor(pmax / st) * st;
  const o = new Set(); for (let x = lo; x <= hi + 1e-6; x += st) o.add(Math.round(x));
  if (normSach >= lo && normSach <= hi) o.add(normSach);
  return [...o].sort((p, q) => p - q);
}
function brwAchse() {
  if (!P.Brw) return [null];
  const a = arg('brw'); if (a) return a.split(',').map(Number);
  let [lo, hi] = brwS; const bmin = zahl(P.Brw.min), bmax = zahl(P.Brw.max);
  if (bmin !== null && lo < bmin) lo = bmin; if (bmax !== null && hi > bmax) hi = bmax;
  const r = hi - lo > 150 ? 10 : 5;
  const o = new Set(); for (let i = 0; i < 6; i++) { let x = Math.round((lo + (hi - lo) * i / 5) / r) * r; x = Math.min(Math.max(x, Math.ceil(lo / r) * r), Math.floor(hi / r) * r); o.add(x); }
  if (normBrw >= lo && normBrw <= hi) o.add(normBrw);
  return [...o].sort((p, q) => p - q);
}
const sachs = sachAchse(), brws = brwAchse();
const kats = (arg('kat') || '').split(',').filter(Boolean);
for (const k of kats) if (!P[k] || !P[k].liste) throw new Error('Kategorie-Parameter fehlt: ' + k);
// kartesisches Produkt der Kategorie-Indizes
let kombis = [[]];
for (const k of kats) kombis = kombis.flatMap((c) => P[k].liste.map((_, i) => [...c, i]));
const name = (c) => c.map((i, j) => kats[j] + '=' + P[kats[j]].liste[i][1]).join(' · ') || 'ohne';
console.log(wb, kopf.titel, '| Gitter Sach', sachs.join('/'), '| BRW', brws.join('/'), '| Kombinationen', kombis.map(name).join(' ; '));

const ergebnis = { wb, view: v.view, update: new Date(v.update).toISOString().slice(0, 10), kopf, stichprobe, texte_vorgabe: t0txt,
  params: s.params.map((p) => ({ name: p.name, caption: p.caption, wert: p.wert, domain: p.domain, liste: p.liste && p.liste.length < 20 ? p.liste : null })),
  vorgabe: wertAus(t0txt), sachs, brws, kats, kombis: [] };
const zw = ziel + '.kombis';
const alt = existsSync(zw) ? JSON.parse(readFileSync(zw, 'utf8')) : [];
const setzeKombi = async (c) => { for (let j = 0; j < kats.length; j++) await T.setzeIndex(s, kats[j], c[j]); };
let n = 0; const tStart = Date.now();
for (const c of kombis) {
  const schon = alt.find((x) => x.name === name(c)); if (schon) { ergebnis.kombis.push(schon); console.log('  ', name(c), 'aus Zwischenstand'); continue; }
  for (let anlauf = 1; anlauf <= 3; anlauf++) {
    try {
      await setzeKombi(c);
      const zellen = {}; const leer = [];
      for (const b of brws) {
        if (b !== null) await T.setze(s, 'Brw', b);
        zellen[String(b)] = [];
        for (const x of sachs) { await T.setze(s, 'Sach', x); const r = await lies(); zellen[String(b)].push(r.f); n++; if (r.f === null) leer.push(`brw=${b} sach=${x}`); }
      }
      if (normBrw !== null) await T.setze(s, 'Brw', normBrw);
      await T.setze(s, 'Sach', normSach);
      const norm = await lies();
      const k = { name: name(c), idx: c, werte: c.map((i, j) => P[kats[j]].liste[i]), zellen, norm, leer };
      ergebnis.kombis.push(k); writeFileSync(zw, JSON.stringify(ergebnis.kombis));
      console.log('  ', k.name, 'Norm', norm.f, '±', norm.sd, 'leer', leer.length, `(${n} Punkte, ${((Date.now() - tStart) / 1000).toFixed(0)} s)`);
      break;
    } catch (e) {
      console.log('  ', name(c), 'Anlauf', anlauf, 'gescheitert:', String(e.message).slice(0, 120), '- neue Sitzung');
      if (anlauf === 3) throw e;
      s = await T.sitzung(wb, v.view);
    }
  }
}
// Rechnerquotienten der stetigen Korrekturen an der Vorgabe-Kombination
const vorgabeKombi = kats.map((k) => Math.max(0, P[k].liste.findIndex((l) => l[1] === P[k].wert)));
await setzeKombi(vorgabeKombi);
if (normBrw !== null) await T.setze(s, 'Brw', normBrw);
await T.setze(s, 'Sach', normSach);
const f0 = (await lies()).f;
ergebnis.korrekturen = {};
for (const [cap, von, bis, schritt] of [['Stst', 1.0, 5.0, 0.5], ['Bgwf', 1.0, 4.2, 0.2]]) {
  if (!P[cap]) continue;
  const probe = [];
  for (let x = von; x <= bis + 1e-9; x += schritt) { const xr = Math.round(x * 10) / 10; await T.setze(s, cap, xr); probe.push({ x: xr, f: (await lies()).f }); }
  await T.setze(s, cap, zahl(P[cap].wert));
  ergebnis.korrekturen[cap] = { f0, norm: P[cap].wert, probe };
  console.log('  Korrektur', cap, probe.map((q) => q.x + ':' + q.f).join(' '));
}
ergebnis.ende = await lies();
writeFileSync(ziel, JSON.stringify(ergebnis, null, 1));
console.log('fertig', wb, n, 'Punkte, Endprobe', ergebnis.ende.f, '(Vorgabe', ergebnis.vorgabe.f + ')', '->', ziel);
