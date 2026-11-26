#!/usr/bin/env node
/* tools/mietspiegel-naeherung-tdm.mjs · v5080 — DealPilot-Näherung mit Text- und Data-Mining (§ 44b UrhG)
   Marcel 26.11.2026: Mietspiegel mit Speicherverbot bzw. Rechtevorbehalt werden für die Näherung ausgelesen.
   Regeln (wissen/2026-11-26.md, „TDM“):
     1. Rohwerte nur im Arbeitsordner AUSSERHALB des Repos (--tdm=<ordner>, raster/<ags>.json), nie im Repo, nie in
        einer DB. Gesperrte Wertedateien (freigabe: gesperrt) liegen schon im Repo und gehen hier mit ein.
     2. Die Näherung lernt nur übergreifende Muster (EIN Faktor, Form klassen_faktor). Nie ein Faktor oder eine Zelle
        je TDM-Stadt. Bauregel Leave-one-Stadt-out: jede Stadt wird mit dem Faktor OHNE ihren Mietspiegel gemessen,
        und der veröffentlichte Faktor muss auf 3 Stellen gleich dem Faktor ohne jede einzelne TDM-Stadt sein.
     3. Gespeichert werden nur Faktor und Güte (naeherung-tdm.json): je Stadt die mittlere Abweichung in Prozent.
        Kopie-Prüfer: liegt eine TDM-Stadt über alle Rasterpunkte im Mittel unter 1 % am eigenen Mietspiegel,
        ist das ein Warnsignal für eine Kopie: ROT, nichts geschrieben.
     4. Zusätzlich gemessen: der Rückfall „Angebotsmiete minus 22/10/5 %“ (config.js mieteAngebotAbschlag) an den
        Mietspiegelstädten mit Angebotsmedian (--angebote=<csv ags,n,median>, aus den eigenen Marktberichten).
   Aufruf: node tools/mietspiegel-naeherung-tdm.mjs --tdm=<ordner> [--angebote=<csv>] [--schreiben]
   Liest Zensus-Zeilen der TDM-Gemeinden von Staging (ssh, nur SELECT) in den Speicher. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MS = path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel');
const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] == null ? true : m[2]] : [a, true]; }));
const imp = (p) => import(pathToFileURL(p).href);
const { werteLaden, mietspiegelWerteFuer } = await imp(path.join(MS, 'werte.js'));
const { zensusBlock, naeherungFuer, REGION_JE_LAND } = await imp(path.join(MS, 'naeherung.js'));
const ZIEL = path.join(MS, 'naeherung-tdm.json');
const VZ = JSON.parse(fs.readFileSync(path.join(MS, 'verzeichnis.json'), 'utf8')).saetze;
const KAPP = JSON.parse(fs.readFileSync(path.join(WURZEL, 'frontend/js/data/kappungsgrenzen.json'), 'utf8'));
const ctx = vm.createContext({ console, Math, JSON, Number, String, Object, Array, isFinite, parseFloat, parseInt, RegExp, Date });
ctx.window = ctx; ctx.self = ctx;
vm.runInContext(fs.readFileSync(path.join(WURZEL, 'frontend/js/mietpotenzial-kern.js'), 'utf8'), ctx);
ctx.document = { readyState: 'complete', addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } };
try { vm.runInContext(fs.readFileSync(path.join(WURZEL, 'frontend/js/config.js'), 'utf8'), ctx); } catch (e) { /* nur mieteAngebotAbschlag gebraucht */ }
const K = ctx.DpMietpotenzial;
const ABS = (ctx.DealPilotConfig || {}).mieteAngebotAbschlag;
const marktlage = (ags) => { const kp = K.kappungAus(KAPP, { ags }, {}), br = K.mietpreisbremseAus(KAPP, { ags }); return (br && br.gilt === true) || (kp && Number(kp.pct) === 15) ? 'angespannt' : 'mittel'; };

const BJ = [1955, 1965, 1975, 1985, 1995, 2005], WFL = [50, 70, 90];
function mittelwert(w, bj, wfl) {
  let r = mietspiegelWerteFuer(w, { baujahr: bj, wfl });
  if (r.mittel > 0) return r.mittel;
  for (const l of ['normal', 'mittel']) { r = mietspiegelWerteFuer(w, { baujahr: bj, wfl, lage: l }); if (r.mittel > 0) return r.mittel; }
  return null;
}
const rasterAus = (w) => { const p = []; for (const bj of BJ) for (const wfl of WFL) { const m = mittelwert(w, bj, wfl); if (m) p.push({ bj, wfl, ms: m }); } return p; };

/* ── Städte ─────────────────────────────────────────────────────────── */
const frei = [], tdm = [];
for (const [ags, w] of werteLaden().jeAgs) {
  const s = { ags, gemeinde: w.gemeinde, punkte: rasterAus(w), tdm: w.freigabe === 'gesperrt', herkunft: w.freigabe === 'gesperrt' ? 'gesperrt' : 'frei' };
  if (s.punkte.length) (s.tdm ? tdm : frei).push(s);
}
if (ARGS.tdm) {
  const dir = path.join(String(ARGS.tdm), 'raster');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => /^\d{8}\.json$/.test(x)) : []) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (frei.some((s) => s.ags === r.ags) || tdm.some((s) => s.ags === r.ags)) continue;
    tdm.push({ ags: r.ags, gemeinde: r.gemeinde, punkte: r.punkte.filter((p) => p.ms > 0), tdm: true, herkunft: 'tdm' });
  }
}

/* ── Zensus (in den Speicher, nur SELECT) ─────────────────────────────── */
const alleAgs = [...frei, ...tdm].map((s) => s.ags);
const sql = "select coalesce(json_agg(json_build_object('ags',ags,'gebiet_name',gebiet_name,'dimension',dimension,'auspraegung',auspraegung,'auspraegung_text',auspraegung_text,'wert',wert)),'[]') from mb.zensus_werte where ebene='gemeinde' and kennzahl='nettokaltmiete_qm' and ags in (" + alleAgs.map((a) => "'" + a + "'").join(',') + ')';
const roh = JSON.parse(execFileSync('ssh', ['root@116.203.214.11', 'docker exec dealpilot-mb-db psql -U mb -d marktbericht -At -c "' + sql.replace(/"/g, '\\"') + '"'], { encoding: 'utf8', maxBuffer: 1 << 26 }).trim());
const ZE = {}; for (const z of roh) (ZE[z.ags] = ZE[z.ags] || []).push({ dimension: z.dimension, auspraegung: z.auspraegung, auspraegung_text: z.auspraegung_text, wert: Number(z.wert), gebiet_name: z.gebiet_name });
const ohneZ = [];
for (const L of [frei, tdm]) for (let i = L.length - 1; i >= 0; i--) { const s = L[i]; s.zeilen = ZE[s.ags]; s.lage = marktlage(s.ags); s.region = REGION_JE_LAND[s.ags.slice(0, 2)];
  if (!s.zeilen || !(zensusBlock(s.zeilen).gesamt > 0)) { ohneZ.push(s.gemeinde); L.splice(i, 1); } }

/* ── Rechnung: EIN Faktor (klassen_faktor), Leave-one-Stadt-out ─────── */
const basis = (s, p) => naeherungFuer({ modell: 'klassen_faktor', faktor: 1 }, s.zeilen, { baujahr: p.bj, wfl: p.wfl }).qm;
const med = (a) => { const b = a.filter((x) => isFinite(x)).sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; };
const faktor = (L) => med(L.flatMap((s) => s.punkte.map((p) => p.ms / basis(s, p))));
const r3 = (x) => Math.round(x * 1000) / 1000, r1 = (x) => Math.round(x * 10) / 10;
const mape = (s, f) => { const a = s.punkte.map((p) => Math.abs(basis(s, p) * f / p.ms - 1) * 100); return a.reduce((x, y) => x + y, 0) / a.length; };
function guete(staedte, fFuer) {
  const je = staedte.map((s) => ({ s, pct: mape(s, fFuer(s)) }));
  const agg = (l) => l.length ? { staedte: l.length, mape_pct: r1(l.reduce((a, x) => a + x.pct * x.s.punkte.length, 0) / l.reduce((a, x) => a + x.s.punkte.length, 0)) } : null;
  const reg = {}; for (const x of je) (reg[x.s.region] = reg[x.s.region] || []).push(x);
  return { gesamt: agg(je), region: Object.fromEntries(Object.entries(reg).sort().map(([r, l]) => [r, agg(l)])), je };
}
const fAlt = faktor(frei), alle = [...frei, ...tdm], fNeu = faktor(alle);
const altFrei = guete(frei, (s) => faktor(frei.filter((o) => o !== s)));
const altTdm = guete(tdm, () => fAlt);                                          /* heute: TDM-Städte gehen nicht ein */
const neuFrei = guete(frei, (s) => faktor(alle.filter((o) => o !== s)));
const neuTdm = guete(tdm, (s) => faktor(alle.filter((o) => o !== s)));           /* Bauregel: ohne die eigene Stadt */

/* Bauregel: veröffentlichter Faktor = Faktor ohne jede einzelne TDM-Stadt (auf 3 Stellen) */
const abweichend = tdm.filter((s) => r3(faktor(alle.filter((o) => o !== s))) !== r3(fNeu)).map((s) => s.gemeinde);
/* Kopie-Prüfer */
const kopie = neuTdm.je.filter((x) => x.pct < 1).map((x) => x.s.gemeinde + ' ' + x.pct.toFixed(2) + ' %');

/* ── Rückfall „Angebotsmiete minus 22/10/5 %“ an Mietspiegelstädten ─── */
let rueck = null;
if (ARGS.angebote && ABS) {
  const ang = Object.fromEntries(fs.readFileSync(String(ARGS.angebote), 'utf8').trim().split(/\r?\n/).map((z) => z.split(',')).filter((x) => /^\d{8}$/.test(x[0]) && Number(x[1]) >= 5).map((x) => [x[0], Number(x[2])]));
  const zeilen = [];
  for (const s of alle) {
    if (!(ang[s.ags] > 0)) continue;
    const ms = med(s.punkte.map((p) => p.ms));
    const stufe = s.lage === 'angespannt' ? 'angespannt' : 'mittel';
    const schaetz = ang[s.ags] * (1 - ABS.stufen[stufe] / 100);
    zeilen.push({ gemeinde: s.gemeinde, ms: Math.round(ms * 100) / 100, angebot: ang[s.ags], stufe, abschlag_ist_pct: r1((1 - ms / ang[s.ags]) * 100), fehler_pct: r1((schaetz / ms - 1) * 100) });
  }
  const abw = zeilen.map((z) => Math.abs(z.fehler_pct));
  rueck = { staedte: zeilen.length, mape_pct: zeilen.length ? r1(abw.reduce((a, x) => a + x, 0) / abw.length) : null, zeilen };
}

/* ── Ausgabe ────────────────────────────────────────────────────────── */
const fmt = (g) => g ? String(g.mape_pct).replace('.', ',') + ' % (n ' + g.staedte + ')' : '–';
console.log('Städte: frei ' + frei.length + ' · TDM ' + tdm.length + ' (gesperrt ' + tdm.filter((s) => s.herkunft === 'gesperrt').length + ', ausgelesen ' + tdm.filter((s) => s.herkunft === 'tdm').length + ')' + (ohneZ.length ? ' · ohne Zensus: ' + ohneZ.join(', ') : ''));
console.log('Faktor alt (nur frei) ' + r3(fAlt) + ' · neu (frei + TDM) ' + r3(fNeu));
console.log('\nGüte (mittlere Abweichung zum Mietspiegel, Leave-one-Stadt-out)');
console.log('Region'.padEnd(8) + 'frei alt'.padEnd(18) + 'frei neu'.padEnd(18) + 'TDM alt'.padEnd(18) + 'TDM neu');
for (const r of ['Nord', 'West', 'Mitte', 'Süd', 'Ost', 'gesamt']) {
  const g = (x) => r === 'gesamt' ? x.gesamt : x.region[r];
  console.log(r.padEnd(8) + fmt(g(altFrei)).padEnd(18) + fmt(g(neuFrei)).padEnd(18) + fmt(g(altTdm)).padEnd(18) + fmt(g(neuTdm)));
}
console.log('\nTDM je Stadt (neu, ohne eigene Stadt): ' + neuTdm.je.map((x) => x.s.gemeinde + ' ' + x.pct.toFixed(1).replace('.', ',') + ' %').join(' · '));
console.log('Bauregel (Faktor ohne jede TDM-Stadt gleich auf 3 Stellen): ' + (abweichend.length ? 'ABWEICHEND bei ' + abweichend.join(', ') : 'ja'));
console.log('Kopie-Prüfer (< 1 % über alle Rasterpunkte): ' + (kopie.length ? 'ROT ' + kopie.join(', ') : 'sauber'));
if (rueck) {
  console.log('\nRückfall Angebotsmiete minus ' + ABS.stufen.angespannt + '/' + ABS.stufen.mittel + '/' + ABS.stufen.entspannt + ' % an ' + rueck.staedte + ' Mietspiegelstädten: mittlere Abweichung ' + String(rueck.mape_pct).replace('.', ',') + ' %');
  for (const z of rueck.zeilen) console.log('  ' + z.gemeinde.padEnd(24) + ' MS ' + z.ms.toFixed(2) + ' · Angebot ' + z.angebot.toFixed(2) + ' · Abschlag tatsächlich ' + String(z.abschlag_ist_pct).replace('.', ',') + ' % (Stufe ' + z.stufe + ') · Fehler ' + String(z.fehler_pct).replace('.', ',') + ' %');
}
const besser = neuFrei.gesamt.mape_pct <= altFrei.gesamt.mape_pct + 0.1 && neuTdm.gesamt && altTdm.gesamt && neuTdm.gesamt.mape_pct <= altTdm.gesamt.mape_pct;
console.log('\nÜbernehmen: ' + (besser ? 'ja (TDM-Städte genauer, freie nicht schlechter)' : 'nein'));
if (kopie.length || abweichend.length) { console.log('NICHT geschrieben: Kopie-Prüfer oder Bauregel rot'); process.exit(1); }
if (ARGS.schreiben && besser) {
  const out = {
    titel: 'DealPilot-Näherung, Kalibrierung mit Text- und Data-Mining (§ 44b UrhG), nur Parameter und Güte',
    version: 'v5080', stand: new Date().toISOString().slice(0, 10), erzeugt_von: 'tools/mietspiegel-naeherung-tdm.mjs',
    intern: 'Faktor aus freien und nicht frei nutzbaren Mietspiegeln (Speicherverbot, Rechtevorbehalt), Rohwerte nach der Ableitung gelöscht (Löschnachweis wissen/2026-11-26.md). Nur Staging bis zur anwaltlichen Bestätigung (BACKLOG).',
    modell: 'klassen_faktor', faktor: r3(fNeu), n_staedte: alle.length, n_frei: frei.length, n_tdm: tdm.length,
    guete: { verfahren: 'Leave-one-Stadt-out, Raster Baujahr 1955 bis 2005 × 50/70/90 m²', mape_pct: r1((neuFrei.gesamt.mape_pct * frei.length + neuTdm.gesamt.mape_pct * tdm.length) / alle.length) },
    guete_region: Object.fromEntries(['Nord', 'West', 'Mitte', 'Süd', 'Ost'].map((r) => { const a = neuFrei.region[r], b = neuTdm.region[r];
      const n = (a ? a.staedte : 0) + (b ? b.staedte : 0); return [r, n ? { staedte: n, mape_pct: r1(((a ? a.mape_pct * a.staedte : 0) + (b ? b.mape_pct * b.staedte : 0)) / n) } : null]; }).filter((x) => x[1])),
    guete_stadt: Object.fromEntries(neuTdm.je.map((x) => [x.s.ags, r1(x.pct)])),
    rueckfall_angebot: rueck ? { staedte: rueck.staedte, mape_pct: rueck.mape_pct } : null
  };
  fs.writeFileSync(ZIEL, JSON.stringify(out, null, 1) + '\n');
  console.log('geschrieben: ' + path.relative(WURZEL, ZIEL));
}
