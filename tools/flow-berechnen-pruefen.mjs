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

/* ── E4 · Profil und Ziele (v3290, Punkt 3) ─────────────────────────────
 * flowProfil.pruefen(): Voreinstellung frage, auto nur mit Monatsgrenze, Ziele in die richtige
 * Ablage (min_dscr/min_cashflow_monat = Investmentprofil), unbekannte Felder abgewiesen.
 * flowBewahren(): ein aelterer Browser-Blob loescht den juengeren Flow-Block nicht.
 * ergebnisBauen() mit Zielen: min_bruttorendite geht als zielBmr an den Kern (Ampel am Ziel),
 * max_kaufpreis und max_faktor deckeln den Zielpreis, die Ziel-Liste stimmt. */
const flowProfil = require_(path.join(ROOT, 'backend/src/services/flowProfil.js'));
let e4Fehler = 0, e4n = 0;
const e4 = (name, ok, ist) => { e4n++; if (!ok) { e4Fehler++; console.log('  \x1b[31mE4 ROT\x1b[0m ' + name + (ist !== undefined ? '  (ist: ' + JSON.stringify(ist).slice(0, 300) + ')' : '')); } };
{
  const leer = flowProfil.profilAus(null, null, []);
  e4('Voreinstellung frage', ['mpi', 'mpi_plus', 'wev'].every((s) => leer.freigaben[s] === 'frage') && leer.freigaben.monatsgrenze_eur === 0, leer.freigaben);
  let p = flowProfil.pruefen({ freigaben: { mpi: 'auto' } }, {}, {}, 't');
  e4('auto ohne Monatsgrenze abgewiesen', p.fehler.length === 1 && /Monatsgrenze/.test(p.fehler[0]), p.fehler);
  p = flowProfil.pruefen({ freigaben: { mpi: 'auto', monatsgrenze_eur: 50 } }, {}, {}, 'api:k1');
  e4('auto mit Monatsgrenze gespeichert und vermerkt', !p.fehler.length && p.ip.flow.freigaben.mpi === 'auto' && p.ip.flow.freigaben.auto_gesetzt.von === 'api:k1', p);
  const teile = flowProfil.flowTeile(p.ip);
  e4('nicht gesetzte Stufen bleiben frage', teile.freigaben.mpi_plus === 'frage' && teile.freigaben.wev === 'frage', teile.freigaben);
  e4('auto ohne Grenze im Bestand gilt als frage', flowProfil.flowTeile({ flow: { freigaben: { wev: 'auto' } } }).freigaben.wev === 'frage');
  p = flowProfil.pruefen({ ziele: { min_dscr: 1.3, min_cashflow_monat: 50, max_faktor: 22, min_bruttorendite: '5,5', max_kaufpreis: 250000 } }, { min_dscr: 1.2, tilgung_default: 2 }, {}, 't');
  e4('Ziele in der richtigen Ablage', !p.fehler.length && p.ip.min_dscr === 1.3 && p.ip.min_cashflow_vor_st === 50 && p.ip.tilgung_default === 2
    && p.ip.flow.ziele.max_faktor === 22 && p.ip.flow.ziele.min_bruttorendite === 5.5 && p.ip.flow.ziele.min_dscr === undefined, p.ip);
  p = flowProfil.pruefen({ ziele: { unsinn: 1 }, investment: { ai_risk: 'x' }, extra: {} }, {}, {}, 't');
  e4('Unbekanntes abgewiesen', p.fehler.length === 3, p.fehler);
  p = flowProfil.pruefen({ ziele: { max_faktor: null } }, { flow: { ziele: { max_faktor: 20 } } }, {}, 't');
  e4('null loescht ein Ziel', p.ip.flow.ziele.max_faktor === undefined, p.ip);
  p = flowProfil.pruefen({ lage: { klassen: { B: { ziel_bmr: 6.5 } } } }, {}, { klassen: { A: { ziel_bmr: 4 } }, x: 1 }, 't');
  e4('Lage-Ziel gemischt, Rest bleibt', !p.fehler.length && p.lage.klassen.A.ziel_bmr === 4 && p.lage.klassen.B.ziel_bmr === 6.5 && p.lage.x === 1, p.lage);
  const alt = { keys: { dp_investment_profile: JSON.stringify({ min_dscr: 1.2, flow: { geaendert: '2026-11-11T10:00:00Z', ziele: { max_faktor: 20 } } }) } };
  const neuOhne = { keys: { dp_investment_profile: JSON.stringify({ min_dscr: 1.4 }), dp_dealscore2_preset: 'lage' } };
  const bew = flowProfil.flowBewahren(neuOhne, alt);
  const bip = JSON.parse(bew.keys.dp_investment_profile);
  e4('Browser ohne Flow-Block: gespeicherter bleibt, Rest vom Browser', bip.flow && bip.flow.ziele.max_faktor === 20 && bip.min_dscr === 1.4 && bew.keys.dp_dealscore2_preset === 'lage', bip);
  const neuAlt = { keys: { dp_investment_profile: JSON.stringify({ flow: { geaendert: '2026-11-10T10:00:00Z', ziele: { max_faktor: 30 } } }) } };
  e4('aelterer Flow-Block verliert', JSON.parse(flowProfil.flowBewahren(neuAlt, alt).keys.dp_investment_profile).flow.ziele.max_faktor === 20);
  const neuJung = { keys: { dp_investment_profile: JSON.stringify({ flow: { geaendert: '2026-11-12T10:00:00Z', ziele: { max_faktor: 30 } } }) } };
  e4('juengerer Flow-Block gewinnt', JSON.parse(flowProfil.flowBewahren(neuJung, alt).keys.dp_investment_profile).flow.ziele.max_faktor === 30);

  /* ergebnisBauen mit Zielen am Rundgang-Objekt */
  const dO = F.faelle['objekt:demo-object.json'].d;
  const ipZ = { flow: { ziele: { min_bruttorendite: 7, max_kaufpreis: 150000, max_faktor: 12 } }, min_dscr: 1.3 };
  const prZ = flow.profilAus({ keys: { dp_investment_profile: JSON.stringify(ipZ) } }, null, []);
  const ohneLage = Object.assign({}, dO, { lageklasse: '' });
  const bZ = flow.ergebnisBauen(ohneLage, flow.ergMitProfil(ergaenzungOhneDb(ohneLage), prZ, ohneLage), prZ, {});
  const bmrZeile = (bZ.ergebnis.quickcheck.kennzahlen_ampel || []).find((x) => x.id === 'bmr') || {};
  e4('min_bruttorendite als zielBmr an den Kern (Ampel am Ziel)', bZ.ergebnis.profil.ziel_bmr === 7 && bmrZeile.am_ziel === true, { ziel_bmr: bZ.ergebnis.profil.ziel_bmr, bmr: bmrZeile });
  const nkmJ = bZ.R.K.nkm_j;
  const zp = bZ.ergebnis.quickcheck.zielpreis;
  e4('Zielpreis = niedrigste Grenze (Faktor 12 x ' + nkmJ + ')', zp === Math.round(Math.min(150000, 12 * nkmJ)) && /max_faktor/.test(bZ.ergebnis.quickcheck.zielpreis_grund),
    { zp, grund: bZ.ergebnis.quickcheck.zielpreis_grund });
  e4('noetige Preissenkung zum Zielpreis', Math.abs(bZ.ergebnis.quickcheck.noetige_preissenkung_pct - Math.round((1 - zp / dO.kp.replace(/\./g, '')) * 1000) / 10) < 0.11, bZ.ergebnis.quickcheck.noetige_preissenkung_pct);
  const zl = bZ.ergebnis.quickcheck.ziele;
  e4('Ziel-Liste: 4 gesetzte Ziele, keins erfuellt', zl.length === 4 && zl.every((x) => !x.erfuellt) && bZ.ergebnis.quickcheck.ziele_erfuellt === false, zl);
  const bOhne = flow.ergebnisBauen(ohneLage, flow.ergMitProfil(ergaenzungOhneDb(ohneLage), flow.profilAus(null, null, []), ohneLage), flow.profilAus(null, null, []), {});
  e4('ohne Ziele: keine Liste, Zielpreis aus dem Kern', bOhne.ergebnis.quickcheck.ziele.length === 0 && bOhne.ergebnis.quickcheck.ziele_erfuellt === null
    && /Quick-Check|Kaufpreis erfuellt/.test(bOhne.ergebnis.quickcheck.zielpreis_grund || '') && bOhne.ergebnis.quickcheck.zielpreis === Math.round(bOhne.R.kp <= (bOhne.ergebnis.quickcheck.zielpreis) ? bOhne.R.kp : bOhne.ergebnis.quickcheck.zielpreis), bOhne.ergebnis.quickcheck.zielpreis_grund);
}
/* ── E5 · Vom Hub angelegte Vorgaben verdraengen die des Browsers nicht (v3292) ───
 * Ursache (vorgaben-sync.js, Zweig „Server gewinnt"): setzen(server) entfernt jeden lokalen
 * Schluessel, der auf dem Server fehlt. Legt PUT /flow/profil den Blob neu an, traegt er die Marke
 * flow_angelegt; der Browser fuehrt dann zusammen (DpVorgabenSync.zusammenfuehren - die ECHTE Datei). */
{
  const f = { console, JSON };
  f.window = f; f.self = f;
  f.Storage = function () {}; f.Storage.prototype = { setItem() {}, removeItem() {} };
  f.addEventListener = () => {};
  const ctxV = vm.createContext(f);
  new vm.Script(fs.readFileSync(path.join(ROOT, 'frontend/js/vorgaben-sync.js'), 'utf8'), { filename: 'vorgaben-sync.js' }).runInContext(ctxV);
  const VS = ctxV.DpVorgabenSync;
  const p1 = flowProfil.pruefen({ ziele: { min_dscr: 1.3, max_faktor: 20 }, investment: { tilgung_default: 2 } }, {}, {}, 'api:k');
  const blob = flowProfil.blobNeu(null, p1, 'u1');
  e4('E5 neuer Blob traegt flow_angelegt mit den gesetzten Feldern', blob.flow_angelegt && blob.flow_angelegt.felder.indexOf('min_dscr') >= 0
    && blob.flow_angelegt.felder.indexOf('tilgung_default') >= 0, blob.flow_angelegt);
  const p2 = flowProfil.pruefen({ investment: { tilgung_default: null } }, p1.ip, {}, 'api:k');
  const blob2 = flowProfil.blobNeu(blob, p2, 'u1');
  e4('E5 zweiter PUT vor dem Browser: Marke bleibt, Felder vereinigt', blob2.flow_angelegt && blob2.flow_angelegt.am === blob.flow_angelegt.am
    && blob2.flow_angelegt.felder.indexOf('min_dscr') >= 0, blob2.flow_angelegt);
  const lokal = { dp_dealscore2_preset: 'conservative', dp_dealscore_weights: '{"cashflow":30}', dp_std_set: 'b',
    dp_investment_profile: JSON.stringify({ tilgung_default: 1.5, min_dscr: 1.1, ai_risk: 'Konservativ', ek_quote_default: 20 }) };
  const z = VS.zusammenfuehren(JSON.parse(JSON.stringify(blob2)), lokal);
  const zip = JSON.parse(z.dp_investment_profile);
  e4('E5 Browser-Vorlagen bleiben (Vorlage, Gewichte, Set)', z.dp_dealscore2_preset === 'conservative' && z.dp_dealscore_weights === lokal.dp_dealscore_weights && z.dp_std_set === 'b', z);
  e4('E5 Investmentprofil: lokale Felder bleiben, Hub-Felder und Flow-Block kommen', zip.ai_risk === 'Konservativ' && zip.ek_quote_default === 20
    && zip.min_dscr === 1.3 && !('tilgung_default' in zip) && zip.flow && zip.flow.ziele.max_faktor === 20, zip);
  const zLeer = VS.zusammenfuehren(JSON.parse(JSON.stringify(blob2)), {});
  e4('E5 neuer Browser ohne eigenen Stand: der Server-Stand', JSON.parse(zLeer.dp_investment_profile).min_dscr === 1.3 && Object.keys(zLeer).length === 1, zLeer);
  const vomBrowser = { keys: { dp_dealscore2_preset: 'lage', dp_investment_profile: '{}' }, nutzer: 'u1', stand: 'x' };
  e4('E5 Blob des Browsers bekommt keine Marke', !flowProfil.blobNeu(vomBrowser, p1, 'u1').flow_angelegt
    && flowProfil.blobNeu(vomBrowser, p1, 'u1').keys.dp_dealscore2_preset === 'lage');
}

console.log('  E4/E5 Profil, Ziele, Zusammenfuehren: ' + (e4n - e4Fehler) + ' von ' + e4n + ' gruen');

/* ── Basislinie ────────────────────────────────────────────────────────── */
let rc = (e1Fehler || e4Fehler) ? 1 : 0;
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
