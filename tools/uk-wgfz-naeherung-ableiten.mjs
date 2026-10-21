#!/usr/bin/env node
/* uk-wgfz-naeherung-ableiten.mjs (v2374) — leitet die DealPilot-NAEHERUNG fuer den
   Umrechnungskoeffizienten der wertrelevanten Geschossflaechenzahl (WGFZ, § 16 Abs. 4,
   § 40 ImmoWertV) aus ALLEN amtlichen WGFZ-Tabellen und -Formeln des Registers ab.
   Gegenstueck zu uk-naeherung-ableiten.mjs (Grundstuecksgroesse).

   FORM:   UK(WGFZ Objekt) / UK(WGFZ Richtwert) = (WGFZ Objekt / WGFZ Richtwert) ^ b

   VORGEHEN
   - Quellen: jeder Satz mit Wert (formel) UND jede Sperre mit formel_vorgemerkt und
     nutzung_intern "stuetzstelle" (Lizenz oder Geltung tragen keinen Wert, die Tabelle
     ist trotzdem amtlich); dazu die zonenabhaengigen NI-Tabellen (formel_vorgemerkt.tabellen).
   - Jede Kurve wird an Paaren (Richtwert-WGFZ w0, Objekt-WGFZ w) abgetastet, NUR in
     ihrem eigenen Geltungsbereich und nur fuer w/w0 zwischen 0,5 und 2,0 - mit der
     ECHTEN koeffizientFuer() aus lib/umrechnung_wgfz.js (Matrix: Zellwert direkt).
   - Je Kurve ein eigenes b (kleinste Quadrate durch den Ursprung in ln-ln). Gleiche
     Kurven (dieselben Zahlen bei mehreren Ausschuessen, z. B. WertR-Anlage 11) zaehlen
     EINMAL; wie oft sie uebernommen wurde, steht daneben.
   - Ergebnis: Median von b ueber alle Kurven, getrennt nach Objektart (individueller
     Wohnungsbau / Geschosswohnungsbau) und nach Bodenrichtwertniveau (nur Tabellen mit
     BRW-Zeilen tragen diese Information), dazu die typische Abweichung der Naeherung vom
     amtlichen Faktor (Median und 90-%-Wert, in Prozent) - das ist die Genauigkeitsangabe.

   Schreibt marktbericht/backend/src/lib/uk-wgfz-naeherung.json. Mit --trocken nur anzeigen.
   Nennt die DECKUNG. Baut NICHTS in den Kern ein - das entscheidet der Hauptstrang. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDNER = path.join(WURZEL, 'marktbericht/backend/src/lib/register');
const ZIEL = path.join(WURZEL, 'marktbericht/backend/src/lib/uk-wgfz-naeherung.json');
const K = (await import('file://' + path.join(WURZEL, 'marktbericht/backend/src/lib/umrechnung_wgfz.js').replace(/\\/g, '/'))).default;
const TROCKEN = process.argv.includes('--trocken');

const R_MIN = 0.5, R_MAX = 2.0;
const NORMEN = [0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0];
const r2 = (x) => Math.round(x * 100) / 100;
const grid = (von, bis) => { const a = []; for (let w = Math.max(0.1, von); w <= bis + 1e-9; w = Math.round((w + 0.1) * 100) / 100) a.push(r2(w)); return a; };
const IFW = new Set(['efh', 'zfh', 'dhh', 'rh']);

function klasse(s) {
  const a = ((s.geltungsbereich || {}).objektarten || []).map(String);
  const z = String(s.zweig || '').toLowerCase();
  if (/gewerbe|geschaeft|büro|buero/.test(z) || (a.length && a.every((x) => /gewerbe|buero|geschaeft|mk/.test(x)))) return 'gewerbe';
  if (a.length && a.every((x) => IFW.has(x))) return 'ifw';
  if (z === 'ifw') return 'ifw';
  if (a.some((x) => ['mfh', 'etw', 'gemischt'].includes(x)) || z === 'mfh') return 'gwb';
  return 'alle';
}
const istStadt = (s) => /^(02|04|11)/.test(String(s.ags)) || String(s.ags).length === 8
  || /stadt|kreisfreie/i.test(String(s.gebiet_name || '')) && !/landkreis|kreis\b|region/i.test(String(s.gebiet_name || ''));

/* Eine Kurve = Funktion (w0, w) -> Faktor oder null, mit Bereich. */
function kurven(s, f, wo) {
  const g = s.geltungsbereich || {};
  const out = [];
  const bereich = (von, bis) => [Math.max(von ?? 0.1, g.wgfz_von ?? 0), Math.min(bis ?? 6, g.wgfz_bis ?? 99)];
  if (f.form === 'wgfz_matrix') {
    for (const t of f.teile || []) {
      out.push({ wo, art: 'matrix', faktor: (w0, w) => {
        const i = t.objekt.findIndex((x) => Math.abs(x - w) < 1e-9), j = t.norm.findIndex((x) => Math.abs(x - w0) < 1e-9);
        if (i < 0 || j < 0) return null; const v = (t.werte[i] || [])[j]; return v == null ? null : Number(v);
      }, paare: () => { const p = []; for (const n of t.norm) for (const o of t.objekt) p.push([n, o]); return p; }, schl: JSON.stringify(t.werte) });
    }
    return out;
  }
  if (f.form === 'wgfz_tabelle') {
    for (const z of f.zeilen || []) {
      const ff = { ...f, zeilen: [{ ...z, brw: null }] };
      const vals = f.wgfz.filter((_, i) => z.uk[i] != null);
      if (vals.length < 3) continue;
      const [von, bis] = bereich(Math.min(...vals), Math.max(...vals));
      out.push({ wo: wo + (z.brw != null ? ' BRW ' + z.brw : ''), art: 'tabelle', brw: z.brw ?? null, von, bis,
        k: (w) => K.koeffizientFuer(ff, null, w).k, schl: JSON.stringify([f.wgfz, z.uk]) });
    }
    return out;
  }
  if (['wgfz_potenz', 'wgfz_wurzel', 'wgfz_polynom', 'wgfz_exp'].includes(f.form)) {
    const gilt = f.gilt || {};
    let von = gilt.wgfz_von ?? g.wgfz_von, bis = gilt.wgfz_bis ?? g.wgfz_bis;
    if (f.form === 'wgfz_exp' && f.tabelle) { von = von ?? f.tabelle.wgfz[0]; bis = bis ?? f.tabelle.wgfz[f.tabelle.wgfz.length - 1]; }
    if (f.form === 'wgfz_potenz' && Number(f.exponent) === 0) { von = von ?? 0.4; bis = bis ?? 2.4; }
    von = von ?? 0.4; bis = bis ?? 3.0;
    out.push({ wo, art: f.form, von, bis, k: (w) => K.koeffizientFuer(f, null, w).k, schl: JSON.stringify([f.form, f.faktor, f.exponent, f.a, f.b, f.c, f.koeffizienten, f.tabelle]) });
  }
  return out;
}

/* Quellen einsammeln */
const quellen = []; let gelesen = 0, dateien = 0;
for (const datei of fs.readdirSync(ORDNER).filter((x) => x.startsWith('uk-wgfz-') && x.endsWith('.json')).sort()) {
  dateien++;
  for (const s of JSON.parse(fs.readFileSync(path.join(ORDNER, datei), 'utf8'))) {
    gelesen++;
    const sperre = s.vollstaendig === false || !!s.warum_kein_wert;
    const wo = s.land_code + ' ' + (s.gebiet_name || s.ags) + (s.zweig ? ' [' + s.zweig + ']' : '');
    const meta = { land: s.land_code, klasse: klasse(s), stadt: istStadt(s), quelle: sperre ? 'stuetzstelle' : 'wert', brw_von: (s.geltungsbereich || {}).brw_von ?? null };
    if (!sperre && s.formel) { for (const c of kurven(s, s.formel, wo)) quellen.push({ ...c, ...meta }); continue; }
    const v = s.formel_vorgemerkt;
    if (!v) continue;
    if (s.nutzung_intern !== 'keine' && v.form && /^wgfz_/.test(v.form)) { for (const c of kurven(s, v, wo)) quellen.push({ ...c, ...meta }); continue; }
    if (v.zonenabhaengig && Array.isArray(v.tabellen)) {
      for (const t of v.tabellen) {
        if (!Array.isArray(t.wgfz) || !Array.isArray(t.uk) || t.wgfz.length !== t.uk.length) continue;
        const f = { form: 'wgfz_tabelle', wgfz: t.wgfz, zeilen: [{ brw: null, uk: t.uk }] };
        for (const c of kurven({ ...s, geltungsbereich: {} }, f, wo + ' Tab. ' + (t.tabelle || t.id))) quellen.push({ ...c, ...meta, quelle: 'stuetzstelle (NI zonenabhaengig)' });
      }
    }
  }
}

/* Abtasten und je Kurve b schaetzen; gleiche Kurven einmal */
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const quantil = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
const nach = new Map(); let doppelt = 0;
for (const q of quellen) {
  if (nach.has(q.schl)) { nach.get(q.schl).uebernahmen.push(q.wo); doppelt++; continue; }
  const pkt = [];
  if (q.art === 'matrix') {
    for (const [w0, w] of q.paare()) {
      const r = w / w0; if (r < R_MIN - 1e-9 || r > R_MAX + 1e-9 || Math.abs(r - 1) < 1e-9) continue;
      const f = q.faktor(w0, w); if (f == null || !(f > 0)) continue; pkt.push([w0, w, f]);
    }
  } else {
    const ws = grid(q.von, q.bis);
    for (const w0 of NORMEN.filter((n) => n >= q.von - 1e-9 && n <= q.bis + 1e-9)) {
      const k0 = q.k(w0); if (!(k0 > 0)) continue;
      for (const w of ws) {
        const r = w / w0; if (r < R_MIN - 1e-9 || r > R_MAX + 1e-9 || Math.abs(r - 1) < 1e-9) continue;
        const k = q.k(w); if (!(k > 0)) continue; pkt.push([w0, w, k / k0]);
      }
    }
  }
  if (pkt.length < 3) continue;
  let sxy = 0, sxx = 0; for (const [w0, w, f] of pkt) { const x = Math.log(w / w0), y = Math.log(f); sxy += x * y; sxx += x * x; }
  if (!(sxx > 0)) continue;
  nach.set(q.schl, { ...q, b: sxy / sxx, pkt, uebernahmen: [q.wo] });
}
const kurvenListe = [...nach.values()];

function auswertung(liste, bFest) {
  if (!liste.length) return null;
  const bs = liste.map((t) => t.b); const b = bFest ?? median(bs);
  const abw = []; for (const t of liste) for (const [w0, w, f] of t.pkt) abw.push(Math.abs(Math.pow(w / w0, b) / f - 1) * 100);
  const wmin = median(liste.map((t) => Math.min(...t.pkt.map((p) => Math.min(p[0], p[1]))))), wmax = median(liste.map((t) => Math.max(...t.pkt.map((p) => Math.max(p[0], p[1])))));
  /* v2593 · Kreuzvalidierung wie in uk-naeherung-ableiten.mjs: je Kurve b =
     Median der UEBRIGEN Kurven (Leave-one-Kurve-out), dazu Leave-one-Land-out,
     an allen Stuetzpunkten. Spanne r^b_p10..r^b_p90 mit P10/P90 der uebrigen
     Kurven, Deckung gemessen. Nur ohne festes b (sonst ist es kein Lernen). */
  let pruefung = null;
  if (bFest == null && liste.length > 2) {
    const cv = (gruppe) => {
      const e = [];
      for (const t of liste) {
        const bo = median(liste.filter((x) => gruppe(x) !== gruppe(t)).map((x) => x.b));
        if (bo == null) continue;
        for (const [w0, w, f] of t.pkt) e.push(Math.abs(Math.pow(w / w0, bo) / f - 1) * 100);
      }
      return { median_pct: r3(median(e)), p80_pct: r3(quantil(e, 0.8)), p95_pct: r3(quantil(e, 0.95)), punkte: e.length };
    };
    let drin = 0, n = 0;
    liste.forEach((t, i) => {
      const bo = liste.filter((_, j) => j !== i).map((x) => x.b);
      const lo = quantil(bo, 0.1), hi = quantil(bo, 0.9);
      for (const [w0, w, f] of t.pkt) {
        const r = w / w0; if (Math.abs(r - 1) < 1e-9) continue;
        const k1 = Math.pow(r, lo), k2 = Math.pow(r, hi); n++;
        if (f >= Math.min(k1, k2) - 1e-9 && f <= Math.max(k1, k2) + 1e-9) drin++;
      }
    });
    pruefung = { loto: cv((t) => t), lolo: cv((t) => t.land), spanne_b_deckung_pct: n ? Math.round(1000 * drin / n) / 10 : null,
      methode: 'Leave-one-Kurve-out (b = Median der uebrigen Kurven) und Leave-one-Land-out; |Naeherung/amtlich - 1| in Prozent an allen Stuetzpunkten; Spanne r^b_p10..r^b_p90 mit P10/P90 der uebrigen Kurven' };
  }
  return { b: r3(b), b_q1: r3(quantil(bs, 0.25)), b_q3: r3(quantil(bs, 0.75)), b_min: r3(Math.min(...bs)), b_max: r3(Math.max(...bs)),
    b_p10: r3(quantil(bs, 0.1)), b_p90: r3(quantil(bs, 0.9)), pruefung,
    tabellen: liste.length, uebernahmen: liste.reduce((n, t) => n + t.uebernahmen.length, 0), punkte: abw.length,
    laender: [...new Set(liste.flatMap((t) => [t.land]))].sort(),
    wgfz_median_von: r3(wmin), wgfz_median_bis: r3(wmax),
    abweichung_median_pct: r3(median(abw)), abweichung_p90_pct: r3(quantil(abw, 0.9)) };
}

const alle = auswertung(kurvenListe.filter((t) => t.klasse !== 'gewerbe'));
const ifw = auswertung(kurvenListe.filter((t) => t.klasse === 'ifw'));
const gwb = auswertung(kurvenListe.filter((t) => t.klasse === 'gwb' || t.klasse === 'alle'));
const gewerbe = auswertung(kurvenListe.filter((t) => t.klasse === 'gewerbe'));
const wohnen = kurvenListe.filter((t) => t.klasse !== 'gewerbe');
const nurWerte = auswertung(kurvenListe.filter((t) => t.quelle === 'wert' && t.klasse !== 'gewerbe'));
const stadt = auswertung(wohnen.filter((t) => t.stadt)), land = auswertung(wohnen.filter((t) => !t.stadt));
/* BRW-Niveau: nur Kurven, die einer BRW-Zeile zugeordnet sind */
const mitBrw = wohnen.filter((t) => t.brw != null);
const brwBaender = [[0, 250], [250, 350], [350, 450], [450, 10000]].map(([a, z]) => ({ von: a, bis: z, ...auswertung(mitBrw.filter((t) => t.brw >= a && t.brw < z)) })).filter((x) => x.tabellen);
/* Wie gut traegt das GESAMT-b die Teilgruppen? */
const quer = { ifw_mit_gesamt_b: auswertung(kurvenListe.filter((t) => t.klasse === 'ifw'), alle.b), gwb_mit_gesamt_b: auswertung(kurvenListe.filter((t) => t.klasse === 'gwb' || t.klasse === 'alle'), alle.b) };

console.log('DECKUNG: ' + dateien + ' Dateien, ' + gelesen + ' Saetze, ' + quellen.length + ' Kurven gelesen, ' + kurvenListe.length + ' verschiedene ausgewertet ('
  + doppelt + ' Uebernahmen derselben Zahlen nur einmal gezaehlt; ' + kurvenListe.filter((t) => t.quelle !== 'wert').length + ' davon interne Stuetzstellen)');
const zeile = (n, k) => k && console.log(n.padEnd(14) + ' b = ' + k.b + ' (Q1 ' + k.b_q1 + ' · Q3 ' + k.b_q3 + ' · ' + k.b_min + '…' + k.b_max + ')  Kurven ' + k.tabellen + '  Laender ' + k.laender.join(' ')
  + '  Abw. ' + k.abweichung_median_pct + ' % (P90 ' + k.abweichung_p90_pct + ' %)');
zeile('wohnen alle', alle); zeile('ifw', ifw); zeile('gwb', gwb); zeile('gewerbe', gewerbe); zeile('nur Werte', nurWerte); zeile('stadt', stadt); zeile('land', land);
for (const x of brwBaender) zeile('BRW ' + x.von + '-' + (x.bis > 9000 ? '' : x.bis), x);
zeile('ifw mit b_alle', quer.ifw_mit_gesamt_b); zeile('gwb mit b_alle', quer.gwb_mit_gesamt_b);

const MIN_TABELLEN = 8;
const aus = {
  stand: new Date().toISOString().slice(0, 10),
  form: 'UK(WGFZ Objekt)/UK(WGFZ Richtwert) = (WGFZ Objekt / WGFZ Richtwert)^b',
  herkunft: 'DealPilot-Naeherung aus allen amtlichen WGFZ-Umrechnungstabellen und -formeln des Registers (Werte und interne Stuetzstellen), Median der Exponenten je Kurve; gleiche Zahlenreihen einmal gezaehlt',
  kennzeichnung: 'abgeleitet aus der DealPilot-Formel (nie amtlich)',
  stufe: 'N',   /* v2401 · eigene Stufe N (DealPilot-Formel), vorher D */
  empfehlung: 'Ein Exponent fuer den Geschosswohnungsbau (b = ' + (gwb && gwb.b) + ' aus ' + (gwb && gwb.tabellen) + ' Kurven, ' + (gwb && gwb.laender.length) + ' Laender). '
    + 'Individueller Wohnungsbau getrennt waere flacher (b = ' + (ifw && ifw.b) + '), aber nur ' + (ifw && ifw.tabellen) + ' Kurven aus ' + (ifw && ifw.laender.join('/')) + ' - zu wenig; dort rechnen die Ausschuesse ueber die Flaeche, keine WGFZ-Naeherung. '
    + 'Gewerbe/Geschaeft nicht einbezogen (b = ' + (gewerbe && gewerbe.b) + ', fast proportional). '
    + 'Mit dem Bodenrichtwert steigt b in den Tabellen mit BRW-Zeilen deutlich (VW-RL-Typ), getragen von nur ' + mitBrw.length + ' Kurven aus ' + [...new Set(mitBrw.map((t) => t.land))].join('/') + ' - als Befund dokumentiert, nicht getrennt.',
  gilt_fuer: {
    verhaeltnis_von: R_MIN, verhaeltnis_bis: R_MAX,
    wgfz_von: 0.4, wgfz_bis: 3.0,
    keine_extrapolation: 'Nur wenn die Bodenrichtwertzone eine WGFZ fuehrt und WGFZ Objekt / WGFZ Richtwert zwischen 0,5 und 2,0 liegt, beide WGFZ zwischen 0,4 und 3,0. Ausserhalb: keine Anpassung, Hinweis.',
    objektarten: ['mfh', 'etw', 'gemischt'],
    objektarten_hinweis: 'Ein-/Zweifamilienhaeuser rechnen die meisten Ausschuesse ueber die Flaeche; nur wo die Zone ausschliesslich die WGFZ fuehrt, gilt die Klasse ifw.',
  },
  mindest_tabellen: MIN_TABELLEN,
  alle, ifw: ifw && ifw.tabellen >= MIN_TABELLEN ? ifw : ifw && { ...ifw, zu_wenige_kurven: true },
  gwb: gwb && gwb.tabellen >= MIN_TABELLEN ? gwb : gwb,
  gewerbe_nicht_in_der_formel: gewerbe,
  nur_werte: nurWerte, stadt, land, brw_niveau: brwBaender, quer,
  kurven: kurvenListe.map((t) => ({ wo: t.wo, land: t.land, klasse: t.klasse, quelle: t.quelle, brw: t.brw ?? null, b: r3(t.b), punkte: t.pkt.length, uebernommen_von: t.uebernahmen.length > 1 ? t.uebernahmen : undefined })),
};
if (!TROCKEN) { fs.writeFileSync(ZIEL, JSON.stringify(aus, null, 2) + '\n'); console.log('geschrieben: ' + path.relative(WURZEL, ZIEL)); }
