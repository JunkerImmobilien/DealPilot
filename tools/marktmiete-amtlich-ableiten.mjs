#!/usr/bin/env node
/* tools/marktmiete-amtlich-ableiten.mjs · v5110 (EE6, Marcel 26.11.2026: „zu den Mieten ja nimm die … einen passenden Wert ableiten,
   der darf aber nicht zu niedrig sein")
   Sammelt die AMTLICHEN Marktmieten der Gutachterausschüsse für Wohnungen (€/m² Wohnfläche, monatlich, netto kalt) in EINE Datei,
   aus der die DealPilot-Näherung der Vergleichsmiete ihr örtliches Niveau mitnimmt (lib/mietspiegel/naeherung.js):
     1 Register: modellansaetze.marktmiete_eur_qm der Liegenschaftszins-Sätze (die Miete, mit der der Ausschuss den Zins
       abgeleitet hat), nur Wohnungs-Zweige (mfh*, we_*, etw*, dreifh), jüngster Jahrgang je Schlüssel.
     2 Grundstücksmarktdaten NRW (Open Data, dl-de/zero-2-0), in mb.wert_parameter typ='miete_qm' (OpenDataConnector),
       Objektarten mfh_bis6, mfh_ueber6, etw (nicht etw_selbstgenutzt). Nur mit --holen von Staging gelesen (ssh, nur SELECT),
       sonst bleibt der NRW-Teil der vorhandenen Datei stehen.
   Ergebnis je Gemeinde (8 Stellen) bzw. Kreis (5 Stellen): Median, Anzahl, Jahrgang, Herkunft (Ausschuss, Jahr) — Herkunft nur intern,
   der Kundentext sagt „amtliche Marktmiete". Speicherrecht: Register wie der jeweilige Satz (Lizenz je Satz), NRW dl-de/zero-2-0.
   Aufruf: node tools/marktmiete-amtlich-ableiten.mjs [--holen] [--pruefen] */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REG = path.join(WURZEL, 'marktbericht/backend/src/lib/register');
const ZIEL = path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel/marktmiete-amtlich.json');
const ARG = new Set(process.argv.slice(2));
const WOHN = /^(mfh|we_|etw|dreifh)/;
const med = (a) => { const b = a.filter((x) => isFinite(x)).sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; };
const r2 = (x) => Math.round(x * 100) / 100;

/* ── 1 Register ───────────────────────────────────────────────────────── */
function walk(o, cb, kopf) {
  if (Array.isArray(o)) o.forEach((x) => walk(x, cb, kopf));
  else if (o && typeof o === 'object') { cb(o, kopf); for (const k in o) walk(o[k], cb, kopf); }
}
const roh = [];
for (const f of fs.readdirSync(REG).filter((f) => f.endsWith('.json')).sort()) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(REG, f), 'utf8')); } catch (e) { continue; }
  const kopf = { jahr: j.berichtsjahr || j.jahrgang || null };
  walk(j, (o) => {
    const m = o.modellansaetze;
    if (!o.kennzahl || !m || m.marktmiete_eur_qm == null) return;
    const w = Number(m.marktmiete_eur_qm);
    if (!(w >= 2 && w <= 40) || !WOHN.test(String(o.zweig || ''))) return;
    if (o.vollstaendig === false || o.formel === null) { /* Sperre: Miete stand trotzdem im Modell, ist aber nicht freigegeben */ if (o.zugang) return; }
    const ags = String(o.ags || '');
    if (!/^\d{5}(\d{3})?$/.test(ags)) return;
    const jahr = Number(o.berichtsjahr || o.jahrgang || kopf.jahr || (o.stichtag ? String(o.stichtag).slice(0, 4) : '')) || null;
    roh.push({ ags, w, jahr, gaa: o.gaa_name || o.gebiet_name || null, lizenz: o.lizenz || null, datei: f });
  });
}

/* ── 2 NRW Open Data ──────────────────────────────────────────────────── */
let alt = null; try { alt = JSON.parse(fs.readFileSync(ZIEL, 'utf8')); } catch (e) { alt = null; }
let nrw = (alt && alt.nrw_roh) || [];
if (ARG.has('--holen')) {
  const sql = "select coalesce(json_agg(json_build_object('ags',ags,'o',objektart,'w',wert,'st',stichtag,'q',quelle_text)),'[]') from mb.wert_parameter where typ='miete_qm' and objektart in ('mfh_bis6','mfh_ueber6','etw')";
  const out = execFileSync('ssh', ['root@116.203.214.11', 'docker exec dealpilot-mb-db psql -U mb -d marktbericht -At -c "' + sql.replace(/"/g, '\\"') + '"'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  nrw = JSON.parse(out.trim()).map((z) => ({ ags: String(z.ags), w: Number(z.w), jahr: z.st ? Number(String(z.st).slice(0, 4)) : null, gaa: z.q ? String(z.q).split(',')[0] : null, objektart: z.o }));
}
for (const z of nrw) if (z.w >= 2 && z.w <= 40) roh.push({ ags: z.ags, w: z.w, jahr: z.jahr, gaa: z.gaa, lizenz: 'dl-de/zero-2-0', datei: 'grundstuecksmarktdaten-nrw' });

/* ── Verdichten: jüngster Jahrgang je Schlüssel ───────────────────────── */
const je = {};
for (const x of roh) (je[x.ags] = je[x.ags] || []).push(x);
const gemeinde = {}, kreis = {};
for (const [ags, l] of Object.entries(je).sort()) {
  const jmax = Math.max(...l.map((x) => x.jahr || 0));
  const neu = l.filter((x) => (x.jahr || 0) === jmax);
  const e = { qm: r2(med(neu.map((x) => x.w))), n: neu.length, jahr: jmax || null,
    herkunft: [...new Set(neu.map((x) => (x.gaa || '?') + (x.jahr ? ' ' + x.jahr : '')))].slice(0, 4) };
  (ags.length === 5 ? kreis : gemeinde)[ags] = e;
}
const param = {
  titel: 'Amtliche Marktmieten der Gutachterausschüsse für Wohnungen (€/m² Wohnfläche, monatlich, netto kalt)',
  version: 'v5110',
  stand: new Date().toISOString().slice(0, 10),
  erzeugt_von: 'tools/marktmiete-amtlich-ableiten.mjs',
  verwendung: 'nur intern als örtliches Niveau der DealPilot-Näherung (lib/mietspiegel/naeherung.js); Kundentext „amtliche Marktmiete", nie der Name einer Quelle',
  speicherrecht: 'Register: Lizenz je Satz (meist dl-de/zero-2-0 bzw. dl-de/by-2-0); Grundstücksmarktdaten NRW: dl-de/zero-2-0',
  n_gemeinden: Object.keys(gemeinde).length, n_kreise: Object.keys(kreis).length, n_werte: roh.length,
  gemeinde, kreis,
  nrw_roh: nrw
};
const neu = JSON.stringify(param, null, 1) + '\n';
if (ARG.has('--pruefen')) {
  const a = alt ? JSON.stringify(Object.assign({}, alt, { stand: null })) : '', b = JSON.stringify(Object.assign({}, param, { stand: null }));
  console.log(a === b ? 'marktmiete-amtlich.json ist aktuell' : 'marktmiete-amtlich.json ist VERALTET');
  process.exit(a === b ? 0 : 1);
}
fs.writeFileSync(ZIEL, neu);
console.log('amtliche Marktmieten: ' + roh.length + ' Werte → ' + param.n_gemeinden + ' Gemeinden, ' + param.n_kreise + ' Kreise → ' + path.relative(WURZEL, ZIEL));
