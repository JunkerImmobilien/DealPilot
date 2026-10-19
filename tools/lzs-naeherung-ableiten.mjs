#!/usr/bin/env node
/* lzs-naeherung-ableiten.mjs (v2395; seit v2401 verdrahtet als Stufe N, lib/lzs_naeherung.js) — misst, ob sich
   aus allen amtlichen Liegenschaftszinssaetzen des Registers eine DealPilot-
   NAEHERUNG ableiten laesst, die GENAUER ist als der heutige Rueckfall
   (§ 256 BewG, Stufe D). Marcel 16.10.2026: dasselbe Prinzip wie beim
   Umrechnungskoeffizienten „spaeter auch fuer Liegenschaftszins und
   Sachwertfaktor pruefen".

   FORM (lineares Modell, Prozentpunkte):
       LZS = c + a_ETW + a_MFH + a_WGH + r * RND/10 + s * Stadt

   DATENBASIS
   - jeder Registersatz `liegenschaftszinssatz` mit Wert (form konstante, nicht
     gesperrt), Wohnnutzung (EZFH/ETW/MFH/WGH aus dem Zweig, ueber
     zweigwahl.dekodiere), unterhalb der Landesebene (Landeswerte sind die
     Stufe davor und kein Lernstoff);
   - je AGS und Zweig der juengste Jahrgang;
   - RND aus modellansaetze.restnutzungsdauer_mittel, sonst aus dem RND-Band
     des Zweigs, sonst Median der Objektfamilie.

   PRUEFMASS — NICHT in der Stichprobe gemessen:
   - Leave-one-LAND-out (das Land, fuer das gerechnet wird, fehlt im Training:
     genau der Fall BY/SL/HB) und Leave-one-AUSSCHUSS-out;
   - Abweichung |Naeherung − amtlich| in Prozentpunkten, Median und P90;
   - daneben derselbe Massstab fuer § 256 BewG (lzsNach256, der ECHTE Kern).
   Die Naeherung wird nur geschrieben, wenn sie im LOLO-Median UND im P90
   besser ist als § 256 — sonst lohnt sie nicht, und das steht im Protokoll.

   Mit --trocken nur anzeigen, mit --lernkurve zusaetzlich 25/50/75/100 % der
   Ausschuesse (LOLO, 20 Wiederholungen). Nennt die DECKUNG. Schreibt
   marktbericht/backend/src/lib/lzs-naeherung.json. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(WURZEL, 'marktbericht/backend/src/lib');
const ZIEL = path.join(LIB, 'lzs-naeherung.json');
const imp = (d) => import(pathToFileURL(path.join(LIB, d)).href);
const { SAATDATEIEN } = await imp('ausschuss_register.js');
const { dekodiere } = await imp('zweigwahl.js');
const { lzsNach256 } = await imp('immowertv.js');
const TROCKEN = process.argv.includes('--trocken');
const LERNKURVE = process.argv.includes('--lernkurve');

const istStadt = (s) => /^(02|04|11)/.test(String(s.ags))
  || (/\bstadt\b|stadtkreis|kreisfreie/i.test(String(s.gebiet_name || '') + ' ' + String(s.gaa_name || ''))
      && !/landkreis|\bkreis\b(?!freie)|kreises|region\b|städteregion/i.test(String(s.gebiet_name || '')));
function familie(art) {
  const a = String(art || '');
  if (/^(efh|zfh|ezfh|rhdhh|rh|dhh|reh|rmh|altbauvilla|villa)/.test(a)) return 'EZFH';
  if (/^(we|etw)/.test(a)) return 'ETW';
  if (/^(dreifh|mfh)/.test(a)) return 'MFH';
  if (/^(ggg|wgh|gh)$/.test(a) || /^gemischt/.test(a)) return 'WGH';
  return null;   /* Gewerbe, Buero, Handel ...: nicht Gegenstand */
}
const zahl = (v) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) ? n : null; };
const FAM = ['EZFH', 'ETW', 'MFH', 'WGH'];
const B256 = { EZFH: 'efh', ETW: 'etw', MFH: 'mfh', WGH: 'ggg' };

/* ── 1 · Einlesen ─────────────────────────────────────────────────────── */
let gelesen = 0, dateien = 0;
const roh = [];
for (const d of SAATDATEIEN) {
  const arr = JSON.parse(fs.readFileSync(path.join(LIB, 'register', d), 'utf8'));
  dateien++;
  for (const s of arr) {
    gelesen++;
    if (s.kennzahl !== 'liegenschaftszinssatz' || s.vollstaendig === false || !s.formel || s.formel.form !== 'konstante') continue;
    const w = zahl(s.formel.wert); if (w == null) continue;
    if (String(s.ags || '').length <= 2) continue;
    const dz = dekodiere(s.zweig); const F = familie(dz.art); if (!F) continue;
    const ma = s.modellansaetze || {};
    let rnd = zahl(ma.restnutzungsdauer_mittel) ?? zahl(ma.restnutzungsdauer);
    if (rnd == null && (dz.rnd_von != null || dz.rnd_bis != null)) {
      rnd = dz.rnd_bis == null ? dz.rnd_von + 10 : dz.rnd_von == null ? dz.rnd_bis - 5 : (dz.rnd_von + dz.rnd_bis) / 2;
    }
    roh.push({ ags: s.ags, land: s.land_code, gaa: s.gaa_name || String(s.ags).slice(0, 5), zweig: s.zweig,
      jahr: s.berichtsjahr || 0, F, w, rnd, stadt: istStadt(s) ? 1 : 0,
      ueber6: /ueber6/.test(s.zweig), brw: zahl(ma.brw_mittel_eur_qm) });
  }
}
const juengst = new Map();
for (const r of roh) { const k = r.ags + '|' + r.zweig; if (!juengst.has(k) || juengst.get(k).jahr < r.jahr) juengst.set(k, r); }
const rows = [...juengst.values()];

/* ── 2 · Statistik ───────────────────────────────────────────────────── */
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const quantil = (a, p) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
function kq(X, y, lam = 1e-3) {   /* kleinste Quadrate mit leichter Ridge (nicht auf den Achsenabschnitt) */
  const p = X[0].length; const A = Array.from({ length: p }, () => Array(p + 1).fill(0));
  for (let i = 0; i < X.length; i++) for (let a = 0; a < p; a++) { for (let b = 0; b < p; b++) A[a][b] += X[i][a] * X[i][b]; A[a][p] += X[i][a] * y[i]; }
  for (let a = 1; a < p; a++) A[a][a] += lam * X.length;
  for (let c = 0; c < p; c++) {
    let pv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r;
    [A[c], A[pv]] = [A[pv], A[c]]; const v = A[c][c] || 1e-12; for (let k = c; k <= p; k++) A[c][k] /= v;
    for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c]; for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((r) => r[p]);
}
const skalar = (b, x) => b.reduce((s, v, i) => s + v * x[i], 0);
const RND_MED = {}; for (const F of FAM) RND_MED[F] = median(rows.filter((r) => r.F === F && r.rnd != null).map((r) => r.rnd)) || 30;
const RND_VON = 5, RND_BIS = 80;
const merkmale = (r) => [1, r.F === 'ETW' ? 1 : 0, r.F === 'MFH' ? 1 : 0, r.F === 'WGH' ? 1 : 0,
  Math.min(RND_BIS, Math.max(RND_VON, r.rnd ?? RND_MED[r.F])) / 10, r.stadt];
const nach256 = (r) => lzsNach256(B256[r.F], r.brw, r.F === 'MFH' ? (r.ueber6 ? 8 : 5) : null).pct;

function auslassen(schl, menge = rows) {
  const formel = [], bewg = [], jeGruppe = {};
  for (const g of [...new Set(menge.map(schl))]) {
    const test = menge.filter((r) => schl(r) === g), train = rows.filter((r) => schl(r) !== g);
    const b = kq(train.map(merkmale), train.map((r) => r.w));
    const e = test.map((r) => Math.abs(skalar(b, merkmale(r)) - r.w)), e2 = test.map((r) => Math.abs(nach256(r) - r.w));
    formel.push(...e); bewg.push(...e2);
    jeGruppe[g] = { saetze: test.length, formel_median_pp: r3(median(e)), bewg256_median_pp: r3(median(e2)) };
  }
  return { formel, bewg, jeGruppe };
}
const lolo = auslassen((r) => r.land), loao = auslassen((r) => r.gaa);
const b = kq(rows.map(merkmale), rows.map((r) => r.w));
const inSample = rows.map((r) => Math.abs(skalar(b, merkmale(r)) - r.w));
const besserIn = Object.values(lolo.jeGruppe).filter((g) => g.formel_median_pp < g.bewg256_median_pp).length;
const laender = Object.keys(lolo.jeGruppe).sort();
const kennz = (e) => ({ median_pp: r3(median(e)), p90_pp: r3(quantil(e, 0.9)) });
const bias256 = {}; for (const F of FAM) { const s = rows.filter((r) => r.F === F); bias256[F] = { saetze: s.length, amtlich_median_pct: r3(median(s.map((r) => r.w))), bewg256_minus_amtlich_pp: r3(median(s.map((r) => nach256(r) - r.w))) }; }

console.log('DECKUNG: ' + dateien + ' Dateien, ' + gelesen + ' Saetze gelesen, ' + rows.length + ' Zinssaetze (Wohnen, Wert, juengster Jahrgang) aus '
  + new Set(rows.map((r) => r.gaa)).size + ' Ausschuessen, ' + laender.length + ' Laendern (' + laender.join(' ') + ')');
console.log('Familien: ' + FAM.map((F) => F + ' ' + bias256[F].saetze).join(' · ') + ' — § 256 minus amtlich (Median): '
  + FAM.map((F) => F + ' ' + bias256[F].bewg256_minus_amtlich_pp).join(' · ') + ' PP');
console.log('Leave-one-Land-out      Naeherung ' + kennz(lolo.formel).median_pp + ' / P90 ' + kennz(lolo.formel).p90_pp
  + '   § 256 ' + kennz(lolo.bewg).median_pp + ' / P90 ' + kennz(lolo.bewg).p90_pp + '   besser in ' + besserIn + ' von ' + laender.length + ' Laendern');
console.log('Leave-one-Ausschuss-out Naeherung ' + kennz(loao.formel).median_pp + ' / P90 ' + kennz(loao.formel).p90_pp + '   (in der Stichprobe: '
  + kennz(inSample).median_pp + ' / ' + kennz(inSample).p90_pp + ')');
console.log('je Land (Naeherung / § 256, Median PP): ' + laender.map((l) => l + ' ' + lolo.jeGruppe[l].formel_median_pp + '/' + lolo.jeGruppe[l].bewg256_median_pp).join('  '));
console.log('Koeffizienten: c ' + r3(b[0]) + ' · ETW ' + r3(b[1]) + ' · MFH ' + r3(b[2]) + ' · WGH ' + r3(b[3]) + ' · je 10 J. RND ' + r3(b[4]) + ' · Stadt ' + r3(b[5]));

let lernkurve = null;
if (LERNKURVE) {
  let seed = 7; const zufall = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const gremien = [...new Set(rows.map((r) => r.gaa))];
  lernkurve = {};
  for (const f of [0.25, 0.5, 0.75, 1]) {
    const E = [];
    for (let w = 0; w < (f === 1 ? 1 : 20); w++) for (const L of laender) {
      const kand = gremien.filter((g) => rows.find((r) => r.gaa === g).land !== L);
      const mix = [...kand]; for (let i = mix.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [mix[i], mix[j]] = [mix[j], mix[i]]; }
      const wahl = new Set(mix.slice(0, Math.max(1, Math.round(mix.length * f))));
      const tr = rows.filter((r) => wahl.has(r.gaa)); const bb = kq(tr.map(merkmale), tr.map((r) => r.w));
      for (const r of rows.filter((x) => x.land === L)) E.push(Math.abs(skalar(bb, merkmale(r)) - r.w));
    }
    lernkurve[Math.round(f * 100) + '%'] = kennz(E);
  }
  console.log('Lernkurve LOLO (Anteil Ausschuesse im Training): ' + Object.entries(lernkurve).map(([k, v]) => k + ' ' + v.median_pp + '/' + v.p90_pp).join(' · '));
}

const lohnt = median(lolo.formel) < median(lolo.bewg) && quantil(lolo.formel, 0.9) < quantil(lolo.bewg, 0.9);
console.log(lohnt ? 'ERGEBNIS: Naeherung genauer als § 256 BewG (LOLO, Median und P90).' : 'ERGEBNIS: lohnt NICHT — nicht in Median und P90 besser als § 256 BewG. Nichts geschrieben.');
const aus = {
  stand: new Date().toISOString().slice(0, 10),
  form: 'LZS [%] = c + a_ETW + a_MFH + a_WGH + r * min(80, max(5, RND))/10 + s * Stadt',
  herkunft: 'DealPilot-Naeherung aus allen amtlichen Liegenschaftszinssaetzen des Registers (Wohnnutzung, juengster Jahrgang je Zweig), kleinste Quadrate',
  kennzeichnung: 'abgeleitet aus der DealPilot-Formel (nie amtlich)',
  stufe: 'N',
  stufe_hinweis: 'Stufe N (v2401): unter jedem amtlichen Satz und unter dem Landeswert, ueber § 256 BewG (D). Nur in Laendern, in denen sie gemessen genauer ist (pruefung.je_land), nie wo das Register fuer die AGS einen Satz fuehrt.',
  verdrahtet: true,
  gilt_fuer: {
    familien: { EZFH: 'Ein-/Zweifamilien-, Doppel-, Reihenhaus', ETW: 'Wohnungseigentum', MFH: 'Drei- und Mehrfamilienhaus', WGH: 'Wohn- und Geschaeftshaus' },
    rnd_von: RND_VON, rnd_bis: RND_BIS,
    nicht: 'Gewerbe, Buero, Handel, Sonderimmobilien; nie wo der Ausschuss einen Wert fuehrt (auch keinen gesperrten: dann Weg zum Ausschuss)',
  },
  koeffizienten: { c: r3(b[0]), ETW: r3(b[1]), MFH: r3(b[2]), WGH: r3(b[3]), je_10_jahre_rnd: r3(b[4]), stadt: r3(b[5]) },
  rnd_ersatz: Object.fromEntries(FAM.map((F) => [F, RND_MED[F]])),
  daten: { saetze: rows.length, ausschuesse: new Set(rows.map((r) => r.gaa)).size, laender },
  pruefung: {
    methode: 'Leave-one-Land-out (massgeblich) und Leave-one-Ausschuss-out; |Naeherung - amtlich| in Prozentpunkten',
    lolo: kennz(lolo.formel), loao: kennz(loao.formel), in_stichprobe: kennz(inSample),
    bewg256_lolo: kennz(lolo.bewg), besser_als_256_in_laendern: besserIn + ' von ' + laender.length,
    je_land: lolo.jeGruppe,
  },
  bewg256_gegen_amtlich: bias256,
  lernkurve,
};
if (lohnt && !TROCKEN) { fs.writeFileSync(ZIEL, JSON.stringify(aus, null, 2) + '\n'); console.log('geschrieben: ' + path.relative(WURZEL, ZIEL)); }
