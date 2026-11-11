#!/usr/bin/env node
/* v3314 · N157 · Prueft die zwei Regeln vom 11.11.2026 an den ECHTEN Dateien (ohne Browser):
 *
 *  A  Steuerjahr des heutigen vollen Jahres (frontend/js/anteilig.js steuerjahrHeute):
 *     Ankauf (kein Datum / Kaufjahr >= laufendes Jahr) -> Kaufjahr, Bestand -> laufendes Jahr.
 *  B  Ladezustand der Steuergrundlagen (tax-periods.js + wk-aggregator.js DpSteuerGrundlagen):
 *     offen/laedt -> 'laedt', beides geladen -> 'bereit', HTTP 429 -> 'fehler' (sichtbar geloggt),
 *     warten() loest ueber Ereignisse auf, nicht angemeldet -> 'bereit'.
 *  C  Verdrahtung: calc.js nimmt das Steuerjahr aus steuerjahrHeute, storage.js wartet in
 *     saveObj und laesst _kpis_cf_ns bei vorlaeufiger Steuer stehen.
 *
 * Aufruf: node tools/steuerjahr-pruefen.mjs   (RC=0 sauber) */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = (f) => fs.readFileSync(path.join(ROOT, 'frontend/js', f), 'utf8');
let gruen = 0, rot = 0;
const ok = (b, t) => { if (b) { gruen++; } else { rot++; console.log('  ROT  ' + t); } };

/* ── A ────────────────────────────────────────────────────────────────── */
function anteiligMit(felder) {
  const ctx = {
    document: { getElementById: (id) => (id in felder ? { value: felder[id] } : null) },
    Date, parseInt, console,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(js('anteilig.js'), ctx);
  return ctx.DealPilotAnteilig;
}
const heute = new Date().getFullYear();
const faelleA = [
  ['Bestand: Kauf 01.01.2025, laufendes Jahr 2026', { kaufdat: '2025-01-01' }, 2026, 2026, 'laufend'],
  ['Ankauf: Kauf im laufenden Jahr', { kaufdat: '2026-09-01' }, 2026, 2026, 'kaufjahr'],
  ['Ankauf: Kauf in der Zukunft', { kaufdat: '2027-03-01' }, 2026, 2027, 'kaufjahr'],
  ['WU fuehrt vor Kaufdatum', { kaufdat: '2025-12-01', wirtschaftlicher_uebergang: '2026-01-01' }, 2026, 2026, 'kaufjahr'],
  ['ohne Datum -> laufendes Jahr', {}, 2026, 2026, 'laufend'],
  ['Bestand 2019', { kaufdat: '2019-06-15' }, 2026, 2026, 'laufend'],
];
for (const [t, f, h, jahr, art] of faelleA) {
  /* getBaseYear schuetzt gegen > now+5 / < now-30 mit der ECHTEN Uhr - Faelle liegen darin */
  const r = anteiligMit(f).steuerjahrHeute(h);
  ok(r.jahr === jahr && r.art === art, `A ${t}: erwartet ${jahr}/${art}, ist ${r.jahr}/${r.art}`);
}
{
  const r = anteiligMit({ kaufdat: '2025-01-01' }).steuerjahrHeute(2026);
  ok(r.text === 'Steuerwirkung 2026, laufendes Jahr', 'A Text Bestand: ' + r.text);
  const k = anteiligMit({ kaufdat: '2027-03-01' }).steuerjahrHeute(2026);
  ok(k.text === 'Steuerwirkung 2027, Kaufjahr', 'A Text Ankauf: ' + k.text);
}
void heute;

/* ── B ────────────────────────────────────────────────────────────────── */
async function grundlagen({ angemeldet = true, antworten }) {
  const hoerer = {};
  const logs = { error: [], warn: [] };
  const ausstehend = [];
  const ctx = {
    console: { log() {}, info() {}, warn: (...a) => logs.warn.push(a.join(' ')), error: (...a) => logs.error.push(a.join(' ')) },
    localStorage: { getItem: (k) => (k === 'ji_token' && angemeldet ? 't' : null) },
    document: { readyState: 'complete', getElementById: () => null, addEventListener() {} },
    setTimeout: (fn, ms) => { if (ms >= 20000) return 0; return 0; },   /* Starttimer und Frist aus */
    clearTimeout() {},
    Auth: { isLoggedIn: () => angemeldet, isApiMode: () => true },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    addEventListener: (t, f) => { (hoerer[t] = hoerer[t] || []).push(f); },
    removeEventListener: (t, f) => { hoerer[t] = (hoerer[t] || []).filter((x) => x !== f); },
    dispatchEvent: (e) => { (hoerer[e.type] || []).slice().forEach((f) => f(e)); return true; },
    fetch: (url) => new Promise((res) => ausstehend.push({ url, res })),
    Date, Promise, Object, Array, Number, String, JSON, encodeURIComponent, URLSearchParams,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(js('tax-periods.js'), ctx);
  vm.runInContext(js('wk-aggregator.js'), ctx);
  const antwort = (url) => {
    const i = ausstehend.findIndex((a) => a.url.startsWith(url));
    if (i < 0) return false;
    const [a] = ausstehend.splice(i, 1);
    const st = antworten[url] || 200;
    a.res({ ok: st === 200, status: st, json: async () => (url.includes('periods') ? { periods: [] } : { count: 0, snapshots: [] }) });
    return true;
  };
  return { ctx, logs, antwort, hoerer, ausstehend };
}
const tick = () => new Promise((r) => setImmediate(r));
{
  const g = await grundlagen({ angemeldet: false, antworten: {} });
  ok(g.ctx.DpSteuerGrundlagen.status() === 'bereit', 'B nicht angemeldet -> bereit');
}
{
  const g = await grundlagen({ antworten: {} });
  const S = g.ctx.DpSteuerGrundlagen;
  ok(S.status() === 'laedt', 'B vor dem Laden -> laedt, ist ' + S.status());
  let ereignis = null;
  g.ctx.addEventListener('dp:steuer-grundlagen', (e) => { ereignis = e.detail.status; });
  const w = S.warten();            /* startet beide Ladevorgaenge */
  await tick();
  ok(g.ausstehend.length === 2, 'B warten() startet beide Abrufe, ist ' + g.ausstehend.length);
  g.antwort('/api/v1/tax-periods'); await tick(); await tick();
  ok(S.status() === 'laedt', 'B nur Zeitraeume da -> laedt');
  g.antwort('/api/v1/tax-snapshots'); await tick(); await tick();
  ok(S.status() === 'bereit', 'B beides da -> bereit, ist ' + S.status());
  ok((await w) === 'bereit', 'B warten() loest mit bereit auf');
  ok(ereignis === 'bereit', 'B Ereignis dp:steuer-grundlagen = bereit');
}
{
  const g = await grundlagen({ antworten: { '/api/v1/tax-snapshots': 429 } });
  const S = g.ctx.DpSteuerGrundlagen;
  const w = S.warten();
  await tick();
  g.antwort('/api/v1/tax-periods'); g.antwort('/api/v1/tax-snapshots');
  for (let i = 0; i < 4; i++) await tick();
  ok(S.status() === 'fehler', 'B 429 -> fehler, ist ' + S.status());
  ok((await w) === 'fehler', 'B warten() endet bei fehler (kein Endloswarten)');
  ok(g.logs.error.some((l) => /429/.test(l) && /Anfragebremse/.test(l)), 'B 429 sichtbar als console.error');
  ok(/Snapshots fehler \(HTTP 429\)/.test(S.grund()), 'B grund() nennt die Ursache: ' + S.grund());
}

/* ── C ────────────────────────────────────────────────────────────────── */
const calc = js('calc.js'), storage = js('storage.js');
ok(/_mtxYear\(zve_immo, _stJahrInfo\.jahr, zins_j\)/.test(calc), 'C calc.js: Steuer heute im Steuerjahr');
ok(/DealPilotAnteilig\.steuerjahrHeute\(new Date\(\)\.getFullYear\(\)\)/.test(calc), 'C calc.js liest die Regel aus anteilig.js');
ok(/State\.kpis\.steuer_vorlaeufig = _stVorlaeufig/.test(calc), 'C calc.js stempelt steuer_vorlaeufig');
ok(/addEventListener\('dp:steuer-grundlagen'/.test(calc), 'C calc.js rechnet nach dp:steuer-grundlagen neu');
ok(/DpSteuerGrundlagen\.warten\(\)/.test(storage), 'C storage.js saveObj wartet');
ok(/_stVorl && _altO\._kpis_cf_ns != null && !_altO\._steuer_vorlaeufig/.test(storage), 'C storage.js laesst _kpis_cf_ns stehen');

/* ── D (v3314a) · im Bestand kommt der GANZE Heute-Wert aus dem Steuerjahr ───────────
   Koordination 11.11.2026: Steuer 2026 mit Erhaltung 2025 ist widerspruechlich. Gemessen
   an der Westerfeldstr.: Erhaltung 10.000 nur 2025, 2026 keine. */
ok(/State\.kpis\.steuerjahr_art === 'laufend'[\s\S]{0,120}State\.kpis\.steuerjahr - State\.cfRows\[0\]\.cal/.test(calc), 'D Zeile des Steuerjahres = Steuerjahr - erstes Kalenderjahr');
ok(/var _hR = \(_hIdx >= 1\) \? State\.cfRows\[_hIdx\] : null;/.test(calc), 'D nur ab dem zweiten Jahr (Kaufjahr bleibt eingeschwungen)');
ok(/State\.kpis\.cf_op = _hR\.cfop_y;\s*State\.kpis\.cf_ns = _hR\.cfns_y;/.test(calc), 'D CF v. St. und CF n. St. aus derselben Zeile');
ok(/if\(mode === 'heute' && K\.heute\)/.test(calc), 'D Cashflow-Box heute liest State.kpis.heute');
ok(/if \(K\.heute\) \{\s*nowVals\.wm = K\.heute\.nkm/.test(calc), 'D Phasentabelle Spalte heute geht in sich auf');
ok(/_dpKpisHeute\(K\)/.test(js('pdf-investment-bank.js')) && /_dpKpisHeute\(K\)/.test(js('dp-dokumente.js')), 'D Bank-PDF und Dokumente nehmen den Heute-Wert');
{
  /* _dpKpisHeute an der echten Funktion: Kette Kaltmiete - BWK - Zins - Tilgung - Bauspar = CF v. St. */
  const m = calc.match(/window\._dpKpisHeute = function \(K\) \{[\s\S]*?\n\};/);
  ok(!!m, 'D _dpKpisHeute gefunden');
  if (m) {
    const c = { window: {}, Object };
    vm.createContext(c); vm.runInContext(m[0], c);
    const f = c.window._dpKpisHeute;
    const K = { nkm_j: 39000, bwk_cf: 10000, zins_j: 19000, tilg_j: 6000, cf_op: 4000, cf_ns: 7000, ze_j: 600, nk_vz_j: 1700, bmy: 7.3,
      heute: { nkm: 39420, bwk: 11000, bwk_cf: 10824, zins: 18897, tilg: 6100, bspar: 0, cf_op: 3599, steuer: -1500, cf_ns: 5099, afa: 12481, zve: -2781 } };
    const h = f(K);
    ok(h.nkm_j - h.bwk_cf - h.zins_j - h.tilg_j - h.bspar_j === h.cf_op, 'D Kette geht auf: ' + (h.nkm_j - h.bwk_cf - h.zins_j - h.tilg_j) + ' = ' + h.cf_op);
    ok(h.cf_op - K.heute.steuer === h.cf_ns, 'D CF n. St. = CF v. St. - Steuer im selben Jahr');
    ok(h.bmy === 7.3 && K.nkm_j === 39000, 'D Kennzahlen und Original unveraendert');
    ok(f({ nkm_j: 1 }).nkm_j === 1, 'D ohne heute (Ankauf) unveraendert');
  }
}

console.log(`steuerjahr-pruefen: ${gruen} gruen, ${rot} rot`);
process.exit(rot ? 1 : 0);
