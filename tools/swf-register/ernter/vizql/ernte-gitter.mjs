// Sitzungsgetriebener Ernter fuer NI-Kalkulatoren mit Lage-Parameter (Region nom: GS, NOM, HOL, OHA, GOE).
// Liest NUR: Sitzung, Parameter setzen, SVG-Export des Blatts "Berechnung". Kein Browser.
// Aufruf: node ernte-gitter.mjs <workbook> [--sb=6] [--ss=9] [--filter="<Filter-Beschriftung>"] [--teil=<suffix>] [--neu]
// Regionen nom (GAG Northeim, Lage-Parameter "Lagefaktor") und ol (GAG Oldenburg-Cloppenburg, Gemeinde-Filter).
import * as PF from './pfade.mjs';
import * as T from './tab.mjs';
import { filterInfo, setzeFilter } from './filter.mjs';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
const wb = process.argv[2];
const AUS = PF.AUS + 'ernte/';
mkdirSync(AUS, { recursive: true });
const ziel = AUS + wb + (process.argv.find((a) => a.startsWith('--teil=')) || '').slice(7) + '.json';
if (existsSync(ziel) && !process.argv.includes('--neu')) { console.log('liegt schon', wb); process.exit(0); }
const zahl = (t) => { const m = /(-?\d+(?:\.\d{3})*(?:,\d+)?)/.exec(String(t)); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null; };
const v = await T.viewName(wb);
const sheetName = (re) => (v.sheets.find((x) => re.test(x[1])) || [])[1];
let s = await T.sitzung(wb, v.view);
const P = Object.fromEntries(s.params.map((p) => [p.caption, p]));
const log = [];
const ber = async () => {
  const t = T.texte(await T.svg(s, sheetName(/^Berechnung$/)));
  const f = t.find((x) => /^\d,\d\d$/.test(x));
  const a = t.find((x) => /^±\s*\d,\d\d$/.test(x));
  return { f: f ? zahl(f) : null, sd: a ? zahl(a.replace('±', '')) : null, roh: t.join(' ') };
};
// Stichprobe
const stp = T.texte(await T.svg(s, sheetName(/^Stichproben(ü|ue)bersicht$/)));
const nach = (label) => { const i = stp.findIndex((x) => x.startsWith(label)); return i < 0 ? null : stp.slice(i + 1, i + 4); };
const brwR = nach('Bodenrichtwert'); const swR = nach('vorläufiger Sachwert') || nach('vorl. Sachwert');
const anz = T.texte(await T.svg(s, sheetName(/^Stichprobenanzahl$/))).join(' ');
const titel = T.texte(await T.svg(s, sheetName(/^Titel$/))).join(' | ');
const stichprobe = {}; for (const lab of ['Kaufzeitpunkt', 'Bodenrichtwert', 'Standardstufe', 'Baujahr', 'Grundstücksfläche', 'Brutto', 'Wohnfläche', 'Restnutzungsdauer', 'vorläufiger Sachwert', 'Modi']) { const r = nach(lab); if (r) stichprobe[lab] = r; }
const bmin = zahl(brwR[0]), bmax = zahl(brwR[1]), smin = zahl(swR[0]), smax = zahl(swR[1]);
const normBrw = zahl(P.Brw.wert), normSach = zahl(P.Sach.wert);
function stufen(lo, hi, n, r, norm) {
  const o = new Set();
  for (let i = 0; i < n; i++) { let x = lo + (hi - lo) * i / (n - 1); x = Math.round(x / r) * r; if (x < lo) x = Math.ceil(lo / r) * r; if (x > hi) x = Math.floor(hi / r) * r; if (x >= lo && x <= hi) o.add(x); }
  if (norm >= lo && norm <= hi) o.add(norm);
  return [...o].sort((a, b) => a - b);
}
const NB = Number((process.argv.find((a) => a.startsWith('--sb=')) || '--sb=6').slice(5));
const NS = Number((process.argv.find((a) => a.startsWith('--ss=')) || '--ss=9').slice(5));
const brws = stufen(bmin, bmax, NB, bmax - bmin > 200 ? 10 : 5, normBrw);
const sachs = stufen(smin, smax, NS, 10000, normSach);
const FILTER = (process.argv.find((a) => a.startsWith('--filter=')) || '').slice(9) || null;
const fi = FILTER ? filterInfo(s.boot, FILTER) : null;
const lageP = FILTER ? null : (P.Lagefaktor || null);
const lagen = fi ? fi.domain.map((d, i) => ({ idx: i, name: d.v, filter: true, default: d.sel })) : lageP ? lageP.liste.map((l, i) => ({ idx: i, wert: l[0], name: l[1] })) : [{ idx: null, name: null }];
const def = await ber();
console.log(wb, 'Norm', normBrw, normSach, 'Default', def.f, 'Gitter', brws.join('/'), '|', sachs.join('/'), '| Lagen', lagen.map((l) => l.name).join(' · '));
const ergebnis = { wb, view: v.view, update: new Date(v.update).toISOString().slice(0, 10), titel, anz, stichprobe, params: s.params.map((p) => ({ name: p.name, caption: p.caption, wert: p.wert, liste: p.liste })), default: def, brws, sachs, lagen: [] };
let n = 0; const t0 = Date.now();
const fertigAlt = (() => { try { return JSON.parse(readFileSync(ziel + '.lagen', 'utf8')); } catch { return []; } })();
for (const L of lagen) {
  const schon = fertigAlt.find((x) => x.name === L.name);
  if (schon) { ergebnis.lagen.push(schon); console.log('  Lage', L.name, 'aus Zwischenstand'); continue; }
  for (let anlauf = 1; anlauf <= 3; anlauf++) {
    try {
      if (L.filter) await setzeFilter(s, fi.fn, L.idx); else if (L.idx !== null) await T.setzeIndex(s, 'Lagefaktor', L.idx);
      const zellen = {}; const lg = [];
      for (const b of brws) {
        await T.setze(s, 'Brw', b);
        zellen[b] = [];
        for (const x of sachs) {
          await T.setze(s, 'Sach', x);
          const r = await ber();
          zellen[b].push(r.f); n++;
          if (r.f === null) lg.push(`LEER lage=${L.name} brw=${b} sach=${x} roh=${r.roh}`);
        }
      }
      await T.setze(s, 'Brw', normBrw); await T.setze(s, 'Sach', normSach);
      const np = await ber();
      ergebnis.lagen.push({ ...L, zellen, norm: np }); log.push(...lg);
      writeFileSync(ziel + '.lagen', JSON.stringify(ergebnis.lagen));
      console.log('  Lage', L.name, 'Norm', np.f, '±', np.sd, `(${n} Punkte, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      break;
    } catch (e) {
      console.log('  Lage', L.name, 'Anlauf', anlauf, 'gescheitert:', String(e.message).slice(0, 120), '- neue Sitzung');
      if (anlauf === 3) throw e;
      s = await T.sitzung(wb, v.view);
    }
  }
}
writeFileSync(ziel + '.teil', JSON.stringify(ergebnis));
// Korrekturkurven: Diagrammtexte + Rechnerquotienten am Normpunkt (Lage 0)
if (lageP) await T.setzeIndex(s, 'Lagefaktor', 0);
if (fi) await setzeFilter(s, fi.fn, fi.domain.findIndex((d) => d.sel));
await T.setze(s, 'Brw', normBrw); await T.setze(s, 'Sach', normSach);
const f0 = (await ber()).f;
ergebnis.korrekturen = {};
for (const [cap, re] of [['Stst', /^Diastst$/], ['Rnda', /^Diarnda$/], ['Wofl', /^Diawofl$/]]) {
  if (!P[cap]) continue;
  const sh = sheetName(re); const txt = sh ? T.texte(await T.svg(s, sh)) : [];
  const probe = [];
  const p = P[cap];
  if (p.domain === 'list' && p.liste && p.liste.length) {
    for (let i = 0; i < p.liste.length; i++) { await T.setzeIndex(s, cap, i); probe.push({ x: zahl(p.liste[i][1]), f: (await ber()).f, idx: i }); }
    const di = p.liste.findIndex((l) => l[1] === p.wert); await T.setzeIndex(s, cap, di < 0 ? 0 : di);
  } else {
    const sp = { Stst: [1.5, 4.5, 0.5, 'Standardstufe'], Rnda: [10, 80, 5, 'Restnutzungsdauer'], Wofl: [50, 300, 10, 'Wohnfläche'] }[cap];
    const r = stichprobe[sp[3]]; const lo = r ? zahl(r[0]) : sp[0], hi = r ? zahl(r[1]) : sp[1];
    const tk = []; for (let x = sp[0]; x <= sp[1] + 1e-9; x += sp[2]) if (x >= lo - 1e-9 && x <= hi + 1e-9) tk.push(Math.round(x * 10) / 10);
    for (const x of tk) { await T.setze(s, cap, x); probe.push({ x, f: (await ber()).f }); }
    await T.setze(s, cap, zahl(p.wert));
  }
  ergebnis.korrekturen[cap] = { sheet: sh, texte: txt, probe, f0, norm: p.wert };
  console.log('  Korrektur', cap, sh, '|', txt.join(' ').slice(0, 200), '| Rechner', probe.map((q) => q.x + ':' + q.f).join(' '));
}
// Lagetabelle
const lt = sheetName(/^Lagetab$/);
if (lt) { ergebnis.lagetab = T.texte(await T.svg(s, lt)); }
const ende = await ber();
ergebnis.ende = ende; ergebnis.log = log;
writeFileSync(ziel, JSON.stringify(ergebnis, null, 1));
console.log('fertig', wb, n, 'Punkte,', log.length, 'leer, Endprobe', ende.f, 'Lagetab', (ergebnis.lagetab || []).length);
