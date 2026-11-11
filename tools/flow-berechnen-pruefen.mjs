#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * flow-berechnen-pruefen.mjs — v3289 · Flow Investor, Punkt 1
 *
 * „GLEICHES ERGEBNIS WIE IM BROWSER" fuer POST /objects/:id/berechnen
 * (Dateien/Makler-Hub/Flow-Investor-Schnittstelle.md). Geprueft wird die
 * ECHTE Funktion der Route (services/flowBerechnung.js ergebnisBauen) ueber
 * die ECHTE Abbildung (services/objektRechnung.js) - ohne Datenbank.
 *
 * DREI EBENEN
 *   E1  Kern: dieselbe Rechnung einmal mit dem Spiegel im Backend
 *       (services/rechenkerne.js) und einmal mit DealKpis / DealScore /
 *       QcHeuristik direkt aus frontend/js. Muss bitgleich sein. RC 1 sonst.
 *   E2  Browser: gegen die Werte, die der BROWSER am Objekt gestempelt hat
 *       (calc.js/storage.js: _kpis_bmy, _kpis_nmy, _kpis_dscr, _kpis_ltv,
 *       _kpis_cf_vs, _kpis_miete_j, _dealpilot_score), bis auf Rundung.
 *       Jede Abweichung wird mit ihrer vermutlichen Ursache gemeldet:
 *       Rechenfelder, die calc.js liest und die Abbildung nicht (gemessen,
 *       nicht angenommen - die Liste kommt aus calc.js selbst). Die Zahl der
 *       abweichenden Objekte steht in tools/flow-berechnen-basislinie.json;
 *       MEHR als dort = RC 1, weniger = Hinweis, die Basislinie zu senken.
 *       (Der Deckel darf sinken, nie steigen.)
 *   E3  Felder: welche Rechenfelder des Browsers die Abbildung nicht kennt,
 *       ueber alle Objekte gezaehlt (Vorbild objekt-mapper-pruefen.mjs).
 *
 * DATEN: tools/flow-berechnen-faelle.json - eingefroren, NUR Rechenfelder
 * (Zahlen und Auswahlwerte, keine Namen, keine Anschriften): das Demo-Objekt
 * (backend/src/db/demo-object.json), die Pruefobjekte Vollausstattung A/B
 * (tools/demo-vollausstattung.mjs, erfundene Daten) und die Objekte des
 * Demo-Kontos. Neu einfrieren: --einfrieren=<export.json> (Liste {seq, data}).
 *
 * Aufruf:
 *   node tools/flow-berechnen-pruefen.mjs              Bericht, RC 0/1
 *   node tools/flow-berechnen-pruefen.mjs --einzeln    jede Abweichung ausfuehrlich
 *   node tools/flow-berechnen-pruefen.mjs --basislinie-schreiben
 *   node tools/flow-berechnen-pruefen.mjs --einfrieren=<export.json>
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import Module, { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAELLE = path.join(ROOT, 'tools', 'flow-berechnen-faelle.json');
const BASIS = path.join(ROOT, 'tools', 'flow-berechnen-basislinie.json');
const require_ = createRequire(import.meta.url);
const arg = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] == null ? true : m[2]] : [a, true]; }));

/* ── Das Backend ohne seine npm-Pakete laden ─────────────────────────────
 * Auf dem Entwicklerrechner liegt kein backend/node_modules. Die reinen Wege
 * (ergebnisBauen, rechnen) brauchen weder pg noch express - sie werden nur
 * beim Laden der Module mitgezogen. Fehlt ein Paket, kommt ein Platzhalter,
 * der jeden Aufruf schluckt; eine Abfrage an die Datenbank WIRFT, damit ein
 * Weg, der doch eine braucht, auffaellt statt still null zu liefern. */
const origLoad = Module._load;
Module._load = function (req) {
  if (/[\\/]db[\\/]pool(\.js)?$/.test(req) || req === '../db/pool' || req === './pool') {
    return { query: async () => { throw new Error('Pruefer: keine Datenbank'); }, pool: {}, transaction: async () => { throw new Error('Pruefer: keine Datenbank'); } };
  }
  if (!req.startsWith('.') && !req.startsWith('node:') && !Module.isBuiltin(req) && !path.isAbsolute(req)) {
    try { return origLoad.apply(this, arguments); } catch (e) {
      const leer = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : leer), apply: () => leer, construct: () => leer });
      return leer;
    }
  }
  return origLoad.apply(this, arguments);
};
const _warn = console.warn; console.warn = () => {};
const rk = require_(path.join(ROOT, 'backend/src/services/rechenkerne.js'));
const objektRechnung = require_(path.join(ROOT, 'backend/src/services/objektRechnung.js'));
const flow = require_(path.join(ROOT, 'backend/src/services/flowBerechnung.js'));
const vorgaben = require_(path.join(ROOT, 'backend/src/services/botVorgabenService.js'));
console.warn = _warn;

/* ── Die Kerne direkt aus frontend/js (E1) ──────────────────────────────── */
function frontendKerne() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/src/generated/rechenkerne/_pruefsummen.json'), 'utf8'));
  const ctx = vm.createContext(rk._fensterStub());
  ctx.global = ctx;
  for (const datei of manifest.reihenfolge) {
    const p = path.join(ROOT, 'frontend', 'js', datei);
    if (!fs.existsSync(p)) continue;   /* RND-Kerne liegen anders - hier nicht gebraucht */
    new vm.Script(fs.readFileSync(p, 'utf8'), { filename: 'frontend/js/' + datei }).runInContext(ctx);
  }
  const Q = ctx.QcHeuristik;
  return {
    vorhanden: () => true,
    kpis: (e) => ctx.DealKpis.compute(e || {}),
    grestBasis: (kp, inv) => ctx.DealKpis.grestBasis(kp, inv),
    gebaeudeAhk: (e) => ctx.DealKpis.gebaeudeAhk(e || {}),
    score: (k) => ctx.DealScore.computeFromKpis(k || {}),
    scoreGewichte: (v) => ctx.DealScore.gewichteAus(v || {}),
    stufe: (s) => ctx.ScoreTier.stufe(s),
    heuristik: (e, b, na) => Q.bewerten(e || {}, b, na),
    heuristikTeil: (name, ...a) => Q[name].apply(Q, a)
  };
}

/* ── Welche Felder liest calc.js? Aus der Datei, nicht aus dem Gedaechtnis ── */
function calcFelder() {
  const t = fs.readFileSync(path.join(ROOT, 'frontend/js/calc.js'), 'utf8');
  const s = new Set();
  for (const m of t.matchAll(/\bv\('([a-z0-9_]+)'\)/g)) s.add(m[1]);
  return [...s].sort();
}

/* Sonstige Schluessel, die zum Rechnen gehoeren (Auswahlen, Haken, Stempel). */
const AUCH = ['_bwk_mode', '_bwk_pct_mode', 'svw_herkunft', 'bankval_migriert', 'bankval', 'lageklasse', 'objart',
  'd1_type', 'd2_type', '_d2_enabled', '_d1_anschl_enable', '_d2_anschl_enable', '_ek_ist_nk', '_me_inc_ze', '_erbpacht',
  'erbbauzins', 'plz', 'afa_satz', 'mietausfall_alt', 'weitere_darlehen', '_dealpilot_score', '_ds2_score', '_ds2_computed'];

function einfrieren(exportDatei) {
  const roh = JSON.parse(fs.readFileSync(exportDatei, 'utf8'));
  const liste = Array.isArray(roh) ? roh : (roh.items || roh.objekte || []);
  const erlaubt = new Set(calcFelder().concat(AUCH));
  const alt = fs.existsSync(FAELLE) ? JSON.parse(fs.readFileSync(FAELLE, 'utf8')) : { faelle: {} };
  const faelle = Object.fromEntries(Object.entries(alt.faelle || {}).filter(([k]) => !liste.some((o) => k === (o.praefix || 'demo-konto') + ':' + (o.seq || o.id))));
  let n = 0;
  for (const o of liste) {
    const d = o.data || o.daten || {};
    if (!d._kpis_bmy && d._kpis_bmy !== 0) continue;
    const r = {};
    for (const [k, v] of Object.entries(d)) {
      if (!(erlaubt.has(k) || k.startsWith('_kpis_'))) continue;
      if (v == null || (typeof v === 'object' && k !== 'weitere_darlehen')) continue;
      if (typeof v === 'string' && v.length > 40 && k !== 'weitere_darlehen') continue;
      r[k] = v;
    }
    faelle[(o.praefix || 'demo-konto') + ':' + (o.seq || o.id)] = { quelle: o.quelle || 'Demo-Konto (Export)', d: r };
    n++;
  }
  const aus = Object.assign({}, alt, { faelle: faelle });
  aus.stand_demo_konto = new Date().toISOString().slice(0, 10) + ' · ' + n + ' Objekte aus ' + path.basename(exportDatei);
  fs.writeFileSync(FAELLE, JSON.stringify(aus, null, 1) + '\n');
  console.log(n + ' Objekte des Demo-Kontos eingefroren -> ' + path.relative(ROOT, FAELLE));
}

if (arg.einfrieren) { einfrieren(arg.einfrieren); process.exit(0); }

/* ── Ergaenzung ohne Datenbank: wie botVorgabenService.ergaenzung(), Bot-Vorgaben leer ── */
function ergaenzungOhneDb(d) {
  const vorhanden = {}, vomNutzer = {}, vorschlag = {}, fehlt = [];
  const hat = (id) => d[id] != null && String(d[id]).trim() !== '';
  Object.keys(vorgaben.ERLAUBT).forEach((id) => {
    if (id === 'ek_quote') return;
    if (hat(id)) { vorhanden[id] = d[id]; return; }
    fehlt.push(id);
  });
  if (!hat('gest_p')) {
    const g = vorgaben.grestFuerPlz(d.plz);
    if (g) { vorschlag.gest_p = { wert: g.satz, herkunft: 'Grunderwerbsteuer ' + g.name }; const i = fehlt.indexOf('gest_p'); if (i >= 0) fehlt.splice(i, 1); }
  } else vorhanden.gest_p = d.gest_p;
  [['notar_p', 1.5], ['gba_p', 0.5]].forEach(([id, w]) => { const i = fehlt.indexOf(id); if (i >= 0) { fehlt.splice(i, 1); vorschlag[id] = { wert: w, herkunft: 'Richtwert' }; } });
  return { vorhanden, vom_nutzer: vomNutzer, vorschlag, fehlt, hat_vorgaben: false, beschriftung: {} };
}

/* ── Lauf ──────────────────────────────────────────────────────────────── */
const F = JSON.parse(fs.readFileSync(FAELLE, 'utf8'));
const profilRoh = F.profil || {};
const profil = flow.profilAus(profilRoh.browser_vorgaben || null, profilRoh.lage_profil || null, []);
const KF = frontendKerne();
const CALC = calcFelder();
const FELD_SONST = new Set(AUCH);

const VERGLEICH = [
  /* [Stempel am Objekt, Weg im Ergebnis, Toleranz absolut, Name] */
  ['_kpis_bmy', (R) => R.K ? R.K.bmy : R.K0.bmy, 0.005, 'Bruttomietrendite %'],
  ['_kpis_nmy', (R) => R.K ? R.K.nmy : null, 0.005, 'Nettomietrendite %'],
  ['_kpis_miete_j', (R) => (R.K || R.K0).nkm_j, 0.5, 'Jahresmiete €'],
  ['_kpis_cf_vs', (R) => R.K ? R.K.cf_op : null, 1, 'Cashflow v. St. €/Jahr'],
  ['_kpis_dscr', (R) => (R.K && R.darlehenGesamt > 0) ? R.K.dscr : null, 0.005, 'DSCR'],
  ['_kpis_ltv', (R) => (R.K && R.darlehenGesamt > 0) ? R.K.ltv : null, 0.05, 'LTV %'],
  ['_dealpilot_score', (R) => R.S ? R.S.score : null, 0, 'DealPilot-Score']
];

let e1Fehler = 0;
const abweichend = [];
const ungelesenZaehl = {};
let nObjekte = 0, nMitStempel = 0, nGerechnet = 0;

const stabil = (x) => JSON.stringify(x, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v));

for (const [name, fall] of Object.entries(F.faelle)) {
  nObjekte++;
  const d = fall.d;
  /* E3: welche Schluessel liest die Abbildung? Gemessen per Proxy */
  const gelesen = new Set();
  const spion = new Proxy(d, { get: (t, k) => { if (typeof k === 'string') gelesen.add(k); return t[k]; } });
  const ergA = flow.ergMitProfil(ergaenzungOhneDb(spion), profil, spion);
  const ergB = flow.ergMitProfil(ergaenzungOhneDb(d), profil, d);
  let A, B;
  try {
    A = flow.ergebnisBauen(spion, ergA, profil, {});
    B = flow.ergebnisBauen(d, ergB, profil, { kerne: KF });
  } catch (e) { console.log('  ' + name + ': FEHLER ' + (e && e.stack || e)); e1Fehler++; continue; }

  /* E1 */
  const sa = stabil(A.ok ? A.ergebnis : A.fehlt), sb = stabil(B.ok ? B.ergebnis : B.fehlt);
  if (sa !== sb) { e1Fehler++; console.log('  E1 ' + name + ': Spiegel und frontend/js rechnen VERSCHIEDEN'); }
  if (!A.ok) continue;
  nGerechnet++;

  /* E3 */
  const gesetzt = (k) => d[k] != null && String(d[k]).trim() !== '' && String(d[k]) !== '0' && d[k] !== false;
  const ungelesen = CALC.filter((k) => gesetzt(k) && !gelesen.has(k));
  ungelesen.forEach((k) => { ungelesenZaehl[k] = (ungelesenZaehl[k] || 0) + 1; });

  /* E2 */
  const R = A.R;
  const zeilen = [];
  let stempel = 0;
  for (const [k, weg, tol, was] of VERGLEICH) {
    if (d[k] == null || !Number.isFinite(Number(d[k]))) continue;
    if (k === '_kpis_dscr' && d._kpis_dscr_art !== 'netto') continue;   /* vor v3031 brutto gestempelt */
    stempel++;
    const soll = Number(d[k]), ist = weg(R);
    if (ist == null) {
      /* Der Browser stempelt beim Barkauf DSCR/LTV 0 - der Server sagt „entfaellt" (v1927). Kein Widerspruch. */
      if ((k === '_kpis_dscr' || k === '_kpis_ltv') && soll === 0) continue;
      zeilen.push([was, soll, null, 'Server rechnet ' + (k === '_dealpilot_score' ? 'keinen Score (fehlt: ' + R.scoreFehlt.join(', ') + ')' : 'diese Kennzahl nicht')]);
      continue;
    }
    if (Math.abs(ist - soll) > tol + 1e-9) zeilen.push([was, soll, ist, null]);
  }
  if (stempel) nMitStempel++;
  if (zeilen.length) abweichend.push({ name, zeilen, ungelesen, R, d });
}

/* ── Bericht ───────────────────────────────────────────────────────────── */
const f2 = (x) => (x == null ? '–' : (Math.abs(x) >= 100 ? Math.round(x).toLocaleString('de-DE') : (Math.round(x * 1000) / 1000).toLocaleString('de-DE')));
console.log('Flow Investor · POST /objects/:id/berechnen gegen den Browser');
console.log('  Profil: ' + profil.name + (profilRoh._herkunft ? ' (' + profilRoh._herkunft + ')' : '') + ' · Gewichte ' + JSON.stringify(rk.scoreGewichte(profil.ds)));
console.log('  ' + nObjekte + ' Objekte, ' + nGerechnet + ' gerechnet, ' + nMitStempel + ' mit Browser-Stempel');
console.log('  E1 Kern (Spiegel = frontend/js): ' + (e1Fehler ? e1Fehler + ' VERSCHIEDEN' : 'bitgleich in allen ' + nObjekte));

/* Ursachen zaehlen: welche ungelesenen Felder tragen die abweichenden Objekte? */
const ursache = {};
abweichend.forEach((a) => a.ungelesen.forEach((k) => { ursache[k] = (ursache[k] || 0) + 1; }));
const ohneUrsache = abweichend.filter((a) => !a.ungelesen.length);
console.log('  E2 Browser: ' + (nMitStempel - abweichend.length) + ' von ' + nMitStempel + ' gleich bis auf Rundung, '
  + abweichend.length + ' weichen ab' + (abweichend.length ? ' (davon ' + ohneUrsache.length + ' ohne ungelesenes Rechenfeld)' : ''));
const kz = {};
abweichend.forEach((a) => a.zeilen.forEach((z) => { kz[z[0]] = (kz[z[0]] || 0) + 1; }));
if (abweichend.length) console.log('     je Kennzahl: ' + Object.entries(kz).map(([k, n]) => k + ' ' + n).join(' · '));
if (Object.keys(ursache).length) console.log('     ungelesene Rechenfelder in den abweichenden Objekten: '
  + Object.entries(ursache).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + n).join(', '));
const URSACHE = fs.existsSync(BASIS) ? (JSON.parse(fs.readFileSync(BASIS, 'utf8')).ursachen || {}) : {};
for (const a of (arg.einzeln ? abweichend : abweichend.slice(0, 8))) {
  console.log('    · ' + a.name + (URSACHE[a.name] ? '  Ursache: ' + URSACHE[a.name] : '  Ursache: OFFEN'));
  if (arg.einzeln) console.log('        ' + (a.ungelesen.length ? 'ungelesen: ' + a.ungelesen.join(' ') : 'kein ungelesenes Rechenfeld'));
  for (const [was, soll, ist, txt] of a.zeilen) console.log('        ' + was + ': Browser ' + f2(soll) + ' · Server ' + (txt || f2(ist)));
}
if (!arg.einzeln && abweichend.length > 8) console.log('    … ' + (abweichend.length - 8) + ' weitere (--einzeln)');
console.log('  E3 Felder, die calc.js liest und die Abbildung nicht (Objekte mit Wert): '
  + (Object.keys(ungelesenZaehl).length ? Object.entries(ungelesenZaehl).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + n).join(', ') : 'keine'));

/* ── Basislinie ────────────────────────────────────────────────────────── */
let rc = e1Fehler ? 1 : 0;
if (arg['basislinie-schreiben']) {
  const altB = fs.existsSync(BASIS) ? JSON.parse(fs.readFileSync(BASIS, 'utf8')) : {};
  const urs = {};
  abweichend.forEach((a) => { urs[a.name] = (altB.ursachen && altB.ursachen[a.name]) || 'OFFEN - Ursache messen und eintragen'; });
  fs.writeFileSync(BASIS, JSON.stringify({ stand: new Date().toISOString().slice(0, 10), profil: altB.profil || null,
    abweichende_objekte: abweichend.length, objekte: abweichend.map((a) => a.name).sort(), ursachen: urs,
    hinweis: 'Deckel: darf sinken, nie steigen (tools/flow-berechnen-pruefen.mjs). Jede Ursache gemessen, nicht vermutet.' }, null, 1) + '\n');
  console.log('  Basislinie geschrieben: ' + abweichend.length + ' abweichende Objekte');
} else if (fs.existsSync(BASIS)) {
  const b = JSON.parse(fs.readFileSync(BASIS, 'utf8'));
  const neu = abweichend.map((a) => a.name).filter((n) => (b.objekte || []).indexOf(n) < 0);
  if (abweichend.length > b.abweichende_objekte || neu.length) {
    rc = 1;
    console.log('  \x1b[31mROT: ' + abweichend.length + ' abweichende Objekte, Basislinie ' + b.abweichende_objekte
      + (neu.length ? ' · neu: ' + neu.join(', ') : '') + '\x1b[0m');
  } else if (abweichend.some((a) => !b.ursachen || !b.ursachen[a.name] || /^OFFEN/.test(b.ursachen[a.name]))) {
    rc = 1;
    console.log('  \x1b[31mROT: eine Abweichung ohne gemessene Ursache in der Basislinie\x1b[0m');
  } else if (abweichend.length < b.abweichende_objekte) {
    console.log('  Weniger Abweichungen als die Basislinie (' + b.abweichende_objekte + ') - bitte --basislinie-schreiben');
  }
} else if (abweichend.length) {
  rc = 1;
  console.log('  Keine Basislinie - jede Abweichung ist rot. Ursachen klaeren, dann --basislinie-schreiben.');
}
console.log(rc ? '\x1b[31mRC=1\x1b[0m' : '\x1b[32mRC=0\x1b[0m');
process.exit(rc);
