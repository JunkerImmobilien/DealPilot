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

console.log(`steuerjahr-pruefen: ${gruen} gruen, ${rot} rot`);
process.exit(rot ? 1 : 0);
