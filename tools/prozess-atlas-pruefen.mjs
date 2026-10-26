import fs from 'fs';
import vm from 'vm';

/* ══ v2188 · PRUEFER FUER DEN PROZESS-ATLAS ════════════════════════════
 *
 * Marcel, 13.10.2026: „Unsere Prozesse muessen dokumentiert sein und
 * plausibel sein." Der Atlas (frontend/js/prozess-atlas.js) erzaehlt
 * Ablaeufe nach. Er darf keinen Weg erzaehlen, den es im Code nicht gibt.
 *
 * Geprueft wird die ECHTE Datei, geladen wie im Browser (Memory:
 * pruefer-der-sich-selbst-misst):
 *   1 · jede Station traegt einen Beleg `datei:symbol`, die Datei gibt
 *       es, und das Symbol steht darin
 *   2 · jede Kante verbindet zwei vorhandene Stationen, jede Station ist
 *       verbunden (ein Knoten ohne Kante taeuscht einen Ablauf vor)
 *   3 · die Zahlen, die er nennt, stimmen mit den Rechenkernen ueberein:
 *       DealScore-Gewichte (dealscore.js DEFAULT_WEIGHTS), Investor-Deal-
 *       Score-Gewichte (dealscore2.js weights), Score-Schwellen
 *       (score-tiers.js), Etappen des Marktberichts (mb-auftrag.js)
 *   4 · kein Anbietername, kein abgeschaffter Begriff im Nutztext
 *
 * Die DECKUNG steht in der Ausgabe (Memory: pruefer-der-gruen-wird):
 * wie viele Stationen, Kanten und Belege wirklich gelesen wurden.
 * RC=0 ist sauber.
 * ═══════════════════════════════════════════════════════════════════ */
const QUELLE = 'frontend/js/prozess-atlas.js';
const ctx = { window: {}, document: { readyState: 'complete' }, console };
ctx.window.matchMedia = () => ({ matches: false });
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(QUELLE, 'utf8'), ctx, { filename: QUELLE });
const A = ctx.window.DealPilotAtlas;
let fehler = 0;
const rot = (m) => { fehler++; console.log('  FEHLER ' + m); };
if (!A || !Array.isArray(A.PROZESSE)) { console.log('Atlas nicht ladbar'); process.exit(1); }

/* 1 + 2 */
let nSt = 0, nKa = 0, nBe = 0;
const lesen = {};
/* \uXXXX-Schreibweisen aufloesen: im Code steht „Bereit für die Bank",
   auf dem Bildschirm „Bereit für die Bank". Gesucht wird, was man sieht. */
const datei = (p) => (lesen[p] ??= fs.existsSync(p)
  ? fs.readFileSync(p, 'utf8').replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
  : null);
const pids = new Set();
for (const P of A.PROZESSE) {
  if (pids.has(P.id)) rot('Prozess doppelt: ' + P.id); pids.add(P.id);
  const ids = new Set(), verbunden = new Set();
  for (const k of P.knoten) {
    nSt++;
    if (ids.has(k.id)) rot(P.id + ': Station doppelt ' + k.id); ids.add(k.id);
    if (!(k.s >= 0 && k.s < P.spalten.length)) rot(P.id + '/' + k.id + ': Spalte ' + k.s + ' ausserhalb');
    if (!k.t || !k.d) rot(P.id + '/' + k.id + ': Titel oder Erklaerung fehlt');
    if (!k.beleg || !k.beleg.includes(':')) { rot(P.id + '/' + k.id + ': kein Beleg'); continue; }
    const i = k.beleg.indexOf(':');
    const pfad = k.beleg.slice(0, i), sym = k.beleg.slice(i + 1);
    const t = datei(pfad);
    if (t == null) rot(P.id + '/' + k.id + ': Beleg-Datei fehlt ' + pfad);
    else if (!t.includes(sym)) rot(P.id + '/' + k.id + ': „' + sym + '“ steht nicht in ' + pfad);
    else nBe++;
  }
  const lage = new Set();
  for (const k of P.knoten) { const p = k.s + '/' + k.z; if (lage.has(p)) rot(P.id + ': zwei Stationen auf ' + p); lage.add(p); }
  for (const e of P.kanten) {
    nKa++;
    if (!ids.has(e[0]) || !ids.has(e[1])) rot(P.id + ': Kante ' + e.join('→') + ' zeigt ins Leere');
    verbunden.add(e[0]); verbunden.add(e[1]);
  }
  for (const id of ids) if (!verbunden.has(id)) rot(P.id + '/' + id + ': Station ohne Kante');
}

/* 3 · Zahlen gegen die Kerne */
function block(text, start) {
  const i = text.indexOf(start); if (i < 0) return null;
  const j = text.indexOf('}', i);
  const o = {};
  for (const m of text.slice(i, j).matchAll(/([a-z_]+)\s*:\s*(\d+)/g)) o[m[1]] = +m[2];
  return o;
}
const st = (pid, id) => A.PROZESSE.find((p) => p.id === pid).knoten.find((k) => k.id === id);
const ds = block(datei('frontend/js/dealscore.js'), 'DEFAULT_WEIGHTS = {');
const dsAtlas = st('scores', 'c3').gew.map((g) => g[1]);
const dsKern = [ds.cashflow, ds.rendite, ds.ltv, ds.risiko, ds.potenzial];
if (dsAtlas.join() !== dsKern.join()) rot('DealScore-Gewichte: Atlas ' + dsAtlas.join('/') + ', dealscore.js ' + dsKern.join('/'));
const ds2 = block(datei('frontend/js/dealscore2.js'), 'weights: {');
const ds2Atlas = st('scores', 'c4').gew.map((g) => g[1]);
const ds2Kern = [ds2.rendite, ds2.finanzierung, ds2.risiko, ds2.lage, ds2.upside];
if (ds2Atlas.join() !== ds2Kern.join()) rot('Investor-Deal-Score-Gewichte: Atlas ' + ds2Atlas.join('/') + ', dealscore2.js ' + ds2Kern.join('/'));
const tiers = datei('frontend/js/score-tiers.js');
const schwAtlas = st('scores', 'c5').gew.map((g) => g[1]);
for (const s of schwAtlas) if (!new RegExp('>=\\s*' + s + '\\b').test(tiers)) rot('Score-Schwelle ' + s + ' steht nicht in score-tiers.js');
const mba = datei('frontend/js/mb-auftrag.js');
const etKern = [...mba.slice(mba.indexOf('ETAPPEN = ['), mba.indexOf('];', mba.indexOf('ETAPPEN = ['))).matchAll(/t:\s*'([^']+)'/g)].map((m) => m[1]);
const etAtlas = st('marktbericht', 'm4').unter.map((u) => u[0]);
if (etKern.join('|') !== etAtlas.join('|')) rot('Marktbericht-Etappen: Atlas ' + etAtlas.join(', ') + ' / mb-auftrag.js ' + etKern.join(', '));

/* 4 · Nutztext */
const nutz = JSON.stringify(A.PROZESSE.map((P) => [P.name, P.sub, P.spalten, P.knoten.map((k) => [k.t, k.k, k.d, k.unter, k.ein, k.aus])]));
for (const w of ['Sprengnetter', 'PriceHubble', 'Kerosin', 'Liter']) if (nutz.includes(w)) rot('Nutztext nennt „' + w + '“');

/* 5 · v2965a · Verweise ins Flughandbuch: jede Ablauf-Id gibt es in tools/handbuch-ablaeufe.mjs,
   jeder Schluessel trifft einen Ablauf (und eine Station), sonst zeigt der Knopf ins Leere */
const { ABLAEUFE } = await import(new URL('./handbuch-ablaeufe.mjs', import.meta.url));
const hbIds = new Set(ABLAEUFE.map((a) => a.id));
let nHb = 0;
for (const [sch, ziel] of Object.entries(A.HANDBUCH || {})) {
  nHb++;
  if (!hbIds.has(ziel)) rot('Handbuch-Verweis ' + sch + ' → „' + ziel + '“ gibt es in handbuch-ablaeufe.mjs nicht');
  const [pid, kid] = sch.split(':'); const P = A.PROZESSE.find((p) => p.id === pid);
  if (!P) rot('Handbuch-Verweis ' + sch + ': Ablauf fehlt');
  else if (kid !== '*' && !P.knoten.some((k) => k.id === kid)) rot('Handbuch-Verweis ' + sch + ': Station fehlt');
}

console.log('Handbuch-Verweise: ' + nHb + ' (Ablaeufe im Handbuch: ' + hbIds.size + ')');
console.log('Prozess-Atlas: ' + A.PROZESSE.length + ' Ablaeufe, ' + nSt + ' Stationen, ' + nKa + ' Kanten, ' + nBe + '/' + nSt + ' Belege im Code gefunden');
console.log('Kerne: DealScore ' + dsKern.join('/') + ' · Investor ' + ds2Kern.join('/') + ' · Schwellen ' + schwAtlas.join('/') + ' · Etappen ' + etKern.length);
console.log(fehler ? fehler + ' Fehler' : 'sauber');
process.exit(fehler ? 1 : 0);
