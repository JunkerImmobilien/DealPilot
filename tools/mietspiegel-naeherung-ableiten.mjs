#!/usr/bin/env node
/* tools/mietspiegel-naeherung-ableiten.mjs · v3266 — DealPilot-Näherung der ortsüblichen Vergleichsmiete ableiten

   Kalibriert NUR an den FREIEN Mietspiegel-Wertedateien (marktbericht/backend/src/lib/mietspiegel/werte/<ags>.json,
   freigabe ≠ 'gesperrt'): je Stadt die Mittelwerte des Mietspiegels über ein Raster (Baujahr 1955/1965/…/2005 ×
   50/70/90 m², Standardlage/-ausstattung des Dokuments; ohne Standard die Lage „normal“/„mittel“, sonst die Stadt nicht),
   gerechnet mit DERSELBEN Funktion wie die Route (mietspiegelWerteFuer). Eingang je Gemeinde: Zensus-2022-
   Bestandsmiete (mb.zensus_werte, gesamt / Baujahr / Größe), Ausschnitt der Kalibrierstädte in naeherung-zensus.json.

   Geprüft werden mehrere Formen per Leave-one-Stadt-out (der Faktor wird jeweils OHNE die geprüfte Stadt bestimmt):
     zensus_roh                Zensus gesamt, unverändert
     vpi_fortschreibung        Mittel aus Baujahres- und Größenklasse × Index der Nettokaltmieten (lib/zensus_miete.js)
     gesamt_faktor             Zensus gesamt × Faktor
     klassen_faktor            Zensus(Baujahr) × Zensus(Größe) / Zensus(gesamt) × Faktor
     klassen_faktor_marktlage  wie klassen_faktor, Faktor je Marktlage (Mietpreisbremse/Kappung 15 % → angespannt)
   Gewählt wird die Form mit der kleinsten mittleren Abweichung im Raster; eine Form mit mehr Parametern nur, wenn sie
   mindestens 0,3 Prozentpunkte besser ist. Geschrieben wird nur, wenn die gewählte Form besser ist als der Zensus
   unverändert — sonst bleibt naeherung.json unberührt und RC=1.

   Der heutige Rückfall (Angebotsmiete minus 22/10/5 %, config.js mieteAngebotAbschlag) ist an diesen Daten NICHT
   messbar: DealPilot führt keine Angebotsmiete je Gemeinde (sie kommt je Objekt von außen). Das steht so in der Datei.

   Aufruf:  node tools/mietspiegel-naeherung-ableiten.mjs            Güte ausgeben und naeherung.json schreiben
            node tools/mietspiegel-naeherung-ableiten.mjs --pruefen  nur vergleichen: RC=1, wenn die Datei veraltet ist
            node tools/mietspiegel-naeherung-ableiten.mjs --holen    Zensus-Ausschnitt neu von Staging lesen (ssh, nur SELECT)
   Nach jeder Mietspiegel-Ernte laufen lassen und naeherung.json (+ naeherung-zensus.json) mitcommitten. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MS = path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel');
const ARG = new Set(process.argv.slice(2));
const imp = (p) => import(pathToFileURL(p).href);
const { werteLaden, mietspiegelWerteFuer } = await imp(path.join(MS, 'werte.js'));
const { zensusBlock, naeherungFuer, NAEHERUNG_DATEI } = await imp(path.join(MS, 'naeherung.js'));
const { NKM_INDEX } = await imp(path.join(WURZEL, 'marktbericht/backend/src/lib/zensus_miete.js'));
const ZENSUS_DATEI = path.join(MS, 'naeherung-zensus.json');
const VZ = JSON.parse(fs.readFileSync(path.join(MS, 'verzeichnis.json'), 'utf8')).saetze;

/* Marktlage aus der Kappungs-/Bremsenliste der Haupt-App (Kern mietpotenzial-kern.js, echte Datei) */
const KAPP = JSON.parse(fs.readFileSync(path.join(WURZEL, 'frontend/js/data/kappungsgrenzen.json'), 'utf8'));
const ctx = vm.createContext({ console, Math, JSON, Number, String, Object, Array, isFinite, parseFloat, parseInt, RegExp, Date });
ctx.window = ctx; ctx.self = ctx;
vm.runInContext(fs.readFileSync(path.join(WURZEL, 'frontend/js/mietpotenzial-kern.js'), 'utf8'), ctx);
const K = ctx.DpMietpotenzial;
function marktlage(ags) {
  const kp = K.kappungAus(KAPP, { ags }, {}), br = K.mietpreisbremseAus(KAPP, { ags });
  return (br && br.gilt === true) || (kp && Number(kp.pct) === 15) ? 'angespannt' : 'mittel';
}

/* ── freie Wertedateien ───────────────────────────────────────────────── */
const frei = [...werteLaden().jeAgs.entries()].filter(([, w]) => w.freigabe !== 'gesperrt');

/* ── Zensus-Ausschnitt ────────────────────────────────────────────────── */
if (ARG.has('--holen')) {
  const liste = frei.map(([a]) => "'" + a + "'").join(',');
  const sql = "select coalesce(json_agg(json_build_object('ags',ags,'gebiet_name',gebiet_name,'dimension',dimension,'auspraegung',auspraegung,'auspraegung_text',auspraegung_text,'wert',wert) order by ags,dimension,auspraegung),'[]') from mb.zensus_werte where ebene='gemeinde' and kennzahl='nettokaltmiete_qm' and ags in (" + liste + ')';
  const roh = execFileSync('ssh', ['root@116.203.214.11', 'docker exec dealpilot-mb-db psql -U mb -d marktbericht -At -c "' + sql.replace(/"/g, '\\"') + '"'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const zeilen = JSON.parse(roh.trim());
  const je = {};
  for (const z of zeilen) { (je[z.ags] = je[z.ags] || []).push({ d: z.dimension, a: z.auspraegung, t: z.auspraegung_text, w: Number(z.wert) }); }
  const name = {}; for (const z of zeilen) name[z.ags] = z.gebiet_name;
  fs.writeFileSync(ZENSUS_DATEI, JSON.stringify({ titel: 'Zensus 2022, Nettokaltmiete je m² der Kalibrier-Gemeinden (Ausschnitt aus mb.zensus_werte, Tabellen 4000W-0004/-0005/-0009)',
    lizenz: '© Statistische Ämter des Bundes und der Länder, Zensus 2022, Datenlizenz Deutschland – Namensnennung – 2.0', stichtag: '2022-05-15',
    gelesen_am: new Date().toISOString().slice(0, 10), gemeinden: Object.fromEntries(Object.keys(je).sort().map((a) => [a, { name: name[a], zeilen: je[a] }])) }, null, 1) + '\n');
  console.log('Zensus-Ausschnitt: ' + Object.keys(je).length + ' Gemeinden, ' + zeilen.length + ' Zeilen → ' + path.relative(WURZEL, ZENSUS_DATEI));
}
const ZS = JSON.parse(fs.readFileSync(ZENSUS_DATEI, 'utf8'));
const zeilenFuer = (ags) => { const g = ZS.gemeinden[ags]; return g ? g.zeilen.map((z) => ({ dimension: z.d, auspraegung: z.a, auspraegung_text: z.t, wert: z.w, gebiet_name: g.name })) : null; };

/* ── Kalibrierpunkte ──────────────────────────────────────────────────── */
const BJ = [1955, 1965, 1975, 1985, 1995, 2005], WFL = [50, 70, 90];
function mittelwert(w, bj, wfl) {
  let r = mietspiegelWerteFuer(w, { baujahr: bj, wfl });
  if (r.mittel > 0) return { ms: r.mittel, lage: null, ob: r.oben > 0 ? r.oben : null, un: r.unten > 0 ? r.unten : null };
  /* ohne Standard im Dokument: nur die ausdrücklich mittlere Lage, nie ein selbst gebildetes Mittel */
  for (const l of ['normal', 'mittel']) {
    r = mietspiegelWerteFuer(w, { baujahr: bj, wfl, lage: l });
    if (r.mittel > 0) return { ms: r.mittel, lage: l, ob: r.oben > 0 ? r.oben : null, un: r.unten > 0 ? r.unten : null };
  }
  return null;
}
const staedte = [], ohne = [];
for (const [ags, w] of frei) {
  const zeilen = zeilenFuer(ags);
  const ges = zeilen && zensusBlock(zeilen).gesamt;
  const punkte = [];
  for (const bj of BJ) for (const wfl of WFL) { const m = mittelwert(w, bj, wfl); if (m) punkte.push({ bj, wfl, ms: m.ms, lage: m.lage, ob: m.ob, un: m.un }); }
  const vz = VZ.find((v) => v.ags === ags) || {};
  if (!punkte.length || !(ges > 0)) { ohne.push(w.gemeinde + (ges > 0 ? '' : ' (kein Zensus)')); continue; }
  staedte.push({ ags, gemeinde: w.gemeinde, land: vz.land || null, stand: w.stand || null, lage: marktlage(ags), zeilen, punkte,
    lage_angenommen: punkte.some((p) => p.lage) ? punkte.find((p) => p.lage).lage : null });
}

/* v5110 · amtliche Marktmieten der Gutachterausschüsse (tools/marktmiete-amtlich-ableiten.mjs) als örtliches Niveau */
const MMJ = (() => { try { return JSON.parse(fs.readFileSync(path.join(MS, 'marktmiete-amtlich.json'), 'utf8')); } catch (e) { return null; } })();
const { marktmieteFuer } = await imp(path.join(MS, 'naeherung.js'));
for (const s of staedte) { s.mm = marktmieteFuer(MMJ, s.ags); s.zges = zensusBlock(s.zeilen).gesamt; }

/* ── Formen ───────────────────────────────────────────────────────────── */
const med = (a) => { const b = a.filter((x) => isFinite(x)).sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; };
const r3 = (x) => Math.round(x * 1000) / 1000;
const nkmLetzt = Object.keys(NKM_INDEX.monate).sort().pop();
const NKM_F = NKM_INDEX.monate[nkmLetzt] / NKM_INDEX.basis_wert;
const basisVon = {
  zensus_roh: (s, p) => zensusBlock(s.zeilen, p.bj, p.wfl).gesamt,
  gesamt_faktor: (s, p) => zensusBlock(s.zeilen, p.bj, p.wfl).gesamt,
  klassen_faktor: (s, p) => naeherungFuer({ modell: 'klassen_faktor', faktor: 1 }, s.zeilen, { baujahr: p.bj, wfl: p.wfl }).qm,
  klassen_faktor_marktlage: (s, p) => naeherungFuer({ modell: 'klassen_faktor', faktor: 1 }, s.zeilen, { baujahr: p.bj, wfl: p.wfl }).qm,
  vpi_fortschreibung: (s, p) => { const b = zensusBlock(s.zeilen, p.bj, p.wfl); const k = [b.baujahr, b.flaeche].filter(Boolean).map((x) => x.wert); return (k.length ? k.reduce((a, x) => a + x, 0) / k.length : b.gesamt) * NKM_F; }
};
const PARAMETER = { zensus_roh: 0, vpi_fortschreibung: 0, gesamt_faktor: 1, klassen_faktor: 1, klassen_faktor_marktlage: 2 };
function faktor(form, andere, lage) {
  if (form === 'zensus_roh' || form === 'vpi_fortschreibung') return 1;
  let g = andere;
  if (form === 'klassen_faktor_marktlage') { const h = andere.filter((s) => s.lage === lage); if (h.length >= 5) g = h; }
  return med(g.flatMap((s) => s.punkte.map((p) => p.ms / basisVon[form](s, p))));
}
function guete(liste) {
  const pct = liste.map((x) => Math.abs(x.p / x.ist - 1) * 100), eur = liste.map((x) => Math.abs(x.p - x.ist));
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  return { mape_pct: Math.round(sum(pct) / pct.length * 10) / 10, mae_eur: Math.round(sum(eur) / eur.length * 100) / 100,
    anteil_5_pct: Math.round(pct.filter((x) => x <= 5).length / pct.length * 100), anteil_10_pct: Math.round(pct.filter((x) => x <= 10).length / pct.length * 100),
    median_pct: Math.round(med(pct) * 10) / 10, n: pct.length };
}
const ergebnis = {};
for (const form of Object.keys(basisVon)) {
  const raster = [], norm = [];
  for (const s of staedte) {
    const f = faktor(form, staedte.filter((o) => o !== s), s.lage);
    for (const p of s.punkte) {
      const x = { ist: p.ms, p: basisVon[form](s, p) * f };
      raster.push(x); if (p.bj === 1975 && p.wfl === 70) norm.push(x);
    }
  }
  ergebnis[form] = { raster: guete(raster), normwohnung: guete(norm) };
}

/* ── Ausgabe ──────────────────────────────────────────────────────────── */
const zeile = (n, g) => n.padEnd(26) + g.mape_pct.toFixed(1).replace('.', ',').padStart(5) + ' %  ' + String(g.mae_eur.toFixed(2)).replace('.', ',').padStart(5) + ' €  '
  + String(g.anteil_5_pct).padStart(3) + ' %  ' + String(g.anteil_10_pct).padStart(3) + ' %  n ' + g.n;
console.log('Kalibrierung: ' + staedte.length + ' freie Mietspiegel, ' + staedte.reduce((a, s) => a + s.punkte.length, 0) + ' Rasterpunkte'
  + (ohne.length ? ' · ohne Rasterwert: ' + ohne.join(', ') : ''));
console.log('Leave-one-Stadt-out    Ø Abw.   Ø €/m²  ±5 %  ±10 %   (Raster | Normwohnung 1975, 70 m²)');
for (const [f, e] of Object.entries(ergebnis)) { console.log('  R ' + zeile(f, e.raster)); console.log('  N ' + zeile(f, e.normwohnung)); }
console.log('  Rückfall Angebotsmiete − 22/10/5 %: nicht messbar (keine Angebotsmiete je Gemeinde in DealPilot)');

let wahl = 'gesamt_faktor';
for (const f of ['klassen_faktor', 'klassen_faktor_marktlage']) {
  const besser = ergebnis[wahl].raster.mape_pct - ergebnis[f].raster.mape_pct;
  if (besser >= 0.3 * (PARAMETER[f] - PARAMETER[wahl])) wahl = f;
}
for (const f of ['zensus_roh', 'vpi_fortschreibung']) if (ergebnis[f].raster.mape_pct < ergebnis[wahl].raster.mape_pct - 0.3) wahl = f;
const gut = ergebnis[wahl].raster.mape_pct < ergebnis.zensus_roh.raster.mape_pct || wahl === 'zensus_roh';
console.log('Gewählt: ' + wahl + ' (' + String(ergebnis[wahl].raster.mape_pct).replace('.', ',') + ' %)' + (gut ? '' : ' — NICHT besser als der Zensus unverändert, nichts geschrieben'));
if (!gut) process.exit(1);

const alle = staedte.flatMap((s) => s.punkte.map((p) => p.ms / basisVon[wahl](s, p)));
/* v5080 · Güte je Region (Leave-one-Stadt-out mit der gewählten Form) für die knappe Genauigkeitsangabe im Kundentext */
const { REGION_JE_LAND } = await imp(path.join(MS, 'naeherung.js'));
const jeRegion = {};
for (const s of staedte) {
  const r = REGION_JE_LAND[s.ags.slice(0, 2)] || 'unbekannt';
  const f = faktor(wahl, staedte.filter((o) => o !== s), s.lage);
  const e = jeRegion[r] = jeRegion[r] || { punkte: [], staedte: 0 };
  e.staedte++;
  for (const p of s.punkte) e.punkte.push({ ist: p.ms, p: basisVon[wahl](s, p) * f });
}
const guete_region = Object.fromEntries(Object.entries(jeRegion).sort().map(([r, e]) => [r, Object.assign({ staedte: e.staedte }, guete(e.punkte))]));
console.log('Je Region (LOO, ' + wahl + '): ' + Object.entries(guete_region).map(([r, g]) => r + ' ' + String(g.mape_pct).replace('.', ',') + ' % (n ' + g.staedte + ')').join(' · '));

/* ── v5110 · Erweiterung amtliche Marktmiete und Spanne (EE6, Marcel 26.11.2026 „nicht zu niedrig") ─────────────────────
   Vorhersage mit Marktmiete: (1 − a) × Klassen × f + a × Klassen / Zensus gesamt × Marktmiete × g, a je Ebene (Gemeinde/Kreis),
   f und g jeweils OHNE die geprüfte Stadt. Übernommen nur, wenn die mittlere Abweichung nicht schlechter wird. */
const KLB = (s, p) => basisVon.klassen_faktor(s, p);
const fOhne = new Map(), gOhne = new Map();
const fV = (s) => { if (!fOhne.has(s)) fOhne.set(s, faktor(wahl, staedte.filter((o) => o !== s), s.lage)); return fOhne.get(s); };
const gV = (s) => { if (!gOhne.has(s)) gOhne.set(s, med(staedte.filter((o) => o !== s && o.mm).flatMap((o) => o.punkte.map((p) => p.ms / (KLB(o, p) / o.zges * o.mm.qm))))); return gOhne.get(s); };
const vorher = (s, p) => basisVon[wahl](s, p) * fV(s);
function mitMM(s, p, ag, ak) {
  const a = s.mm ? (s.mm.ebene === 'gemeinde' ? ag : ak) : 0;
  const v0 = vorher(s, p); if (!(a > 0)) return v0;
  return (1 - a) * v0 + a * KLB(s, p) / s.zges * s.mm.qm * gV(s);
}
const ergMM = (ag, ak) => staedte.flatMap((s) => s.punkte.map((p) => ({ ist: p.ms, p: mitMM(s, p, ag, ak), s, pt: p })));
let besteMM = { ag: 0, ak: 0, mape: guete(ergMM(0, 0)).mape_pct };
const mapeBasis = besteMM.mape;
if (MMJ && (wahl === 'klassen_faktor' || wahl === 'klassen_faktor_marktlage')) for (const ag of [0, 0.25, 0.5, 0.75]) for (const ak of [0, 0.25, 0.5]) {
  const m = guete(ergMM(ag, ak)).mape_pct; if (m < besteMM.mape - 1e-9) besteMM = { ag, ak, mape: m };
}
const mmAktiv = besteMM.ag > 0 || besteMM.ak > 0;
const endP = (s, p) => mmAktiv ? mitMM(s, p, besteMM.ag, besteMM.ak) : vorher(s, p);
/* Spanne: oben/unten zum Mittelwert der freien Mietspiegel (Rasterpunkte mit Spanne) — die App rechnet wie beim Mietspiegel mit dem OBEREN Wert */
const qOb = med(staedte.flatMap((s) => s.punkte.filter((p) => p.ob > 0).map((p) => p.ob / p.ms)));
const qUn = med(staedte.flatMap((s) => s.punkte.filter((p) => p.un > 0).map((p) => p.un / p.ms)));
const nSp = staedte.reduce((a, s) => a + s.punkte.filter((p) => p.ob > 0).length, 0);
const verz = (f) => { const v = staedte.flatMap((s) => s.punkte.map((p) => f(s, p))).filter((x) => isFinite(x)); return Math.round(med(v) * 1000) / 10; };
const verzerrung = {
  mittel_vorher_median_pct: verz((s, p) => vorher(s, p) / p.ms - 1),
  mittel_nachher_median_pct: verz((s, p) => endP(s, p) / p.ms - 1),
  oben_vorher_median_pct: verz((s, p) => p.ob > 0 ? vorher(s, p) / p.ob - 1 : NaN),
  oben_nachher_median_pct: verz((s, p) => p.ob > 0 ? endP(s, p) * qOb / p.ob - 1 : NaN),
  anteil_unter_oben_vorher_pct: (() => { const v = staedte.flatMap((s) => s.punkte.filter((p) => p.ob > 0).map((p) => vorher(s, p) < p.ob)); return Math.round(v.filter(Boolean).length / v.length * 100); })(),
  anteil_unter_oben_nachher_pct: (() => { const v = staedte.flatMap((s) => s.punkte.filter((p) => p.ob > 0).map((p) => endP(s, p) * qOb < p.ob)); return Math.round(v.filter(Boolean).length / v.length * 100); })(),
  hinweis: 'vorher rechnete die App mit dem Mittelwert der Näherung (oben fehlte), nachher mit Näherung × Spanne oben, wie beim Mietspiegel'
};
console.log('Marktmiete: Gewicht Gemeinde ' + besteMM.ag + ', Kreis ' + besteMM.ak + ' · MAPE ' + String(mapeBasis).replace('.', ',') + ' → ' + String(besteMM.mape).replace('.', ',') + ' %'
  + (mmAktiv ? '' : ' (nicht übernommen)'));
console.log('Spanne oben ×' + r3(qOb) + ', unten ×' + r3(qUn) + ' (n ' + nSp + ') · Verzerrung ' + JSON.stringify(verzerrung));
if (mmAktiv) {
  const raster = [], norm = []; const jr = {};
  for (const s of staedte) { const r = REGION_JE_LAND[s.ags.slice(0, 2)] || 'unbekannt'; const e = jr[r] = jr[r] || { punkte: [], staedte: 0 }; e.staedte++;
    for (const p of s.punkte) { const x = { ist: p.ms, p: endP(s, p) }; raster.push(x); e.punkte.push(x); if (p.bj === 1975 && p.wfl === 70) norm.push(x); } }
  ergebnis[wahl] = { raster: guete(raster), normwohnung: guete(norm) };
  for (const k of Object.keys(guete_region)) delete guete_region[k];
  Object.assign(guete_region, Object.fromEntries(Object.entries(jr).sort().map(([r, e]) => [r, Object.assign({ staedte: e.staedte }, guete(e.punkte))])));
  console.log('Je Region mit Marktmiete: ' + Object.entries(guete_region).map(([r, g]) => r + ' ' + String(g.mape_pct).replace('.', ',') + ' %').join(' · '));
}
const param = {
  titel: 'DealPilot-Näherung der ortsüblichen Vergleichsmiete (nie amtlich, nicht der Mietspiegel)',
  version: 'v3266',
  stand: (ZS.gelesen_am || null),
  erzeugt_von: 'tools/mietspiegel-naeherung-ableiten.mjs',
  methode: 'Mittelwert ≈ Faktor × Zensus-2022-Bestandsmiete der Gemeinde nach Baujahresklasse × nach Größenklasse / gesamt (Form klassen_faktor) bzw. Faktor × gesamt (gesamt_faktor); Faktor = Median der Quotienten Mietspiegel-Mittelwert / Zensus über alle Rasterpunkte der freien Mietspiegel. Kalibriert nur an freien Wertedateien (freigabe ≠ gesperrt); Mietspiegel mit Speicherverbot sind nicht im Register und gehen nie ein.',
  modell: wahl === 'klassen_faktor_marktlage' ? 'klassen_faktor' : (wahl === 'zensus_roh' ? 'gesamt_faktor' : wahl),
  faktor: wahl === 'zensus_roh' ? 1 : r3(med(alle)),
  ...(wahl === 'klassen_faktor_marktlage' ? { faktoren_marktlage: Object.fromEntries(['angespannt', 'mittel'].map((l) => [l, r3(faktor(wahl, staedte, l))])) } : {}),
  n_staedte: staedte.length,
  n_punkte: staedte.reduce((a, s) => a + s.punkte.length, 0),
  guete: Object.assign({ verfahren: 'Leave-one-Stadt-out über das Raster (Baujahr 1955–2005 × 50/70/90 m²)' }, ergebnis[wahl].raster),
  guete_normwohnung: Object.assign({ objekt: 'Baujahr 1975, 70 m²' }, ergebnis[wahl].normwohnung),
  guete_region,   /* v5080 · Kundentext nimmt die Region ab 5 Städten (naeherung.js genauigkeit) */
  ...(mmAktiv ? { marktmiete: { gewicht_gemeinde: besteMM.ag, gewicht_kreis: besteMM.ak, g: r3(med(staedte.filter((o) => o.mm).flatMap((o) => o.punkte.map((p) => p.ms / (KLB(o, p) / o.zges * o.mm.qm))))),
    datei: 'marktmiete-amtlich.json', staedte_mit_wert: staedte.filter((s) => s.mm).length, mape_ohne_pct: mapeBasis, mape_mit_pct: besteMM.mape } } : {}),
  spanne: { oben: r3(qOb), unten: r3(qUn), n: nSp, verfahren: 'Median oben/Mittel bzw. unten/Mittel der freien Mietspiegel über das Raster' },
  verzerrung,
  vergleich: Object.assign(Object.fromEntries(Object.entries(ergebnis).map(([f, e]) => [f, { raster_mape_pct: e.raster.mape_pct, raster_10_pct: e.raster.anteil_10_pct, norm_mape_pct: e.normwohnung.mape_pct }])),
    { rueckfall_angebot_abschlag: 'nicht messbar: DealPilot führt keine Angebotsmiete je Gemeinde (sie kommt je Objekt von außen)' }),
  vpi_fortschreibung_faktor: r3(NKM_F), vpi_monat: nkmLetzt,
  zensus: { stichtag: '2022-05-15', tabellen: '4000W-0004/-0005/-0009', lizenz: ZS.lizenz, ausschnitt: 'naeherung-zensus.json' },
  geltung: 'nur Gemeinden ohne verwendbare Mietspiegel-Werte (keine Wertedatei, gesperrt und nicht ausgeliefert, Speicherverbot, kein oder unklarer Mietspiegel); nie neben freien Werten, nie gegen eine eigene Eingabe',
  kalibrierung: staedte.map((s) => ({ ags: s.ags, gemeinde: s.gemeinde, land: s.land, stand: s.stand, marktlage: s.lage, punkte: s.punkte.length,
    ...(s.lage_angenommen ? { lage: s.lage_angenommen } : {}), quotient_median: r3(med(s.punkte.map((p) => p.ms / basisVon[wahl](s, p)))) }))
};
const neu = JSON.stringify(param, null, 1) + '\n';
const alt = fs.existsSync(NAEHERUNG_DATEI) ? fs.readFileSync(NAEHERUNG_DATEI, 'utf8') : '';
if (ARG.has('--pruefen')) {
  const ok = alt.replace(/\r\n/g, '\n') === neu;
  console.log(ok ? 'naeherung.json ist aktuell' : 'naeherung.json ist VERALTET — ohne --pruefen neu schreiben');
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(NAEHERUNG_DATEI, neu);
console.log('geschrieben: ' + path.relative(WURZEL, NAEHERUNG_DATEI) + ' (Faktor ' + String(param.faktor).replace('.', ',') + ', n ' + param.n_staedte + ')');
