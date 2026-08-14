// kettenpruefung-v1089.mjs  (v1089-WKET)

import { sachwertfaktor, liegenschaftszinssatz } from '../lib/gutachterausschuss.js';
import { registerStand, SAATDATEIEN, finde } from '../lib/ausschuss_register.js';

let ok = 0, fehler = 0;
const p = (t, b, z = '') => {
  if (b) { ok++; console.log(`  ok      ${t}${z ? ' — ' + z : ''}`); }
  else { fehler++; console.log(`  FEHLER  ${t}${z ? ' — ' + z : ''}`); }
};

/* ── Muenchen: im Register, aber bewusst nicht rechnend ───────────────── */
//
// Das Korrekturblatt ist eine Sammlung von RANDAUSWERTUNGEN derselben
// Stichprobe nach acht Merkmalen — kein geschlossenes Wertermittlungsmodell
// mit Normobjekt, und ohne Stichtag. Eine Randverteilung wie ein Modell
// anzuwenden hiesse, acht nicht unabhaengige Sichten als eine Gleichung zu
// lesen. Der Datensatz steht deshalb im Register und RECHNET NICHT.
//
// Der erste Anlauf dieses Tests erwartete 1,15 und war damit selbst der
// Fehler: der Erntelauf war strenger als die Zusicherung.

const muc = sachwertfaktor({ ags: '09162000', sachwert_eur: 700000,
  objektart: 'Einfamilienhaus' });
p('Muenchen steht im Register und rechnet bewusst NICHT',
  muc && muc.verfuegbar === false && muc.grund === 'datensatz_unvollstaendig',
  muc && muc.grund);
p('Muenchen nennt den Grund und den Ausschuss',
  muc && /Randauswertung|Normobjekt|Stichtag/i.test(String(muc.hinweis || ''))
    && !!muc.ausschuss,
  muc && String(muc.hinweis).slice(0, 90));
p('Der elfte Auswerter ist trotzdem verdrahtet',
  (() => { const r = finde('sachwertfaktor', '09162000');
    return r.length === 2 && r.every((x) => (x.formel || {}).form === 'baender_1d'); })(),
  'baender_1d, 2 Datensaetze');

/* ── Niedersachsen ────────────────────────────────────────────────────── */

const otter = liegenschaftszinssatz({ ags: '03352000', zweig: 'efh' });
p('Landkreis Cuxhaven: Zinssatz vorhanden',
  otter && (otter.verfuegbar ? otter.wert_pct > 0 : !!otter.grund),
  otter && (otter.verfuegbar
    ? `${otter.wert_pct} % · ${otter.wert_art || 'Art nicht ausgewiesen'}`
    : otter.grund));

p('Die Art des Werts reist mit (Median statt Mittel)',
  (() => { const alle = finde('liegenschaftszinssatz', '03352000');
    return alle.some((s) => (s.formel || {}).wert_art); })(),
  (() => { const a = finde('liegenschaftszinssatz', '03352000');
    return a.map((s) => `${s.zweig}:${(s.formel || {}).wert_art}`).slice(0, 4).join(' '); })());

const resthof = sachwertfaktor({ ags: '03357000', sachwert_eur: 200000,
  objektart: 'resthof' });
p('Resthofstellen: je Landkreis ein eigener Faktor',
  resthof && (resthof.verfuegbar ? resthof.wert > 0.2 : !!resthof.grund),
  resthof && (resthof.verfuegbar ? `${resthof.wert} · ${resthof.ausschuss}`
                                 : resthof.grund));

p('Die vier Resthof-Kreise sind VIER Datensaetze, nicht einer',
  ['03352000', '03356000', '03357000', '03359000']
    .every((a) => finde('sachwertfaktor', a).length > 0),
  ['03352', '03356', '03357', '03359']
    .map((a) => `${a}:${finde('sachwertfaktor', a + '000').length}`).join(' '));

/* ── Nichts von v1084 bis v1088 ist schlechter geworden ───────────────── */

p('Hoexter unveraendert 0,77',
  (() => { const r = sachwertfaktor({ ags: '05762020', sachwert_eur: 300000,
    brw_eur_qm: 80, rnd_jahre: 55, bgf_qm: 300, objektart: 'Einfamilienhaus' });
    return r && Math.round((r.wert ?? 0) * 100) === 77; })());
p('Herford-Modul unveraendert 0,88',
  (() => { const r = sachwertfaktor({ ags: '05758016', sachwert_eur: 300000,
    brw_eur_qm: 125, rnd_jahre: 45, bgf_qm: 500, objektart: 'Zweifamilienhaus' });
    return r && r.herkunft === 'modul' && Math.round((r.wert ?? 0) * 100) === 88; })());
p('Berlin unveraendert 0,96',
  (() => { const r = sachwertfaktor({ ags: '11000000', sachwert_eur: 500000,
    objektart: 'Einfamilienhaus', altbezirk: 'Steglitz' });
    return r && Math.round((r.wert ?? 0) * 100) === 96; })());
p('Halle unveraendert 1,10',
  (() => { const r = sachwertfaktor({ ags: '15002000', sachwert_eur: 250000,
    brw_eur_qm: 120, standardstufe: 3, gemarkung: 1,
    objektart: 'Einfamilienhaus' });
    return r && Math.round((r.wert ?? 0) * 100) === 110; })());
p('Stendal unveraendert 3,0 %',
  (() => { const r = liegenschaftszinssatz({ ags: '15084000', zweig: 'mfh',
    ort: 'Stendal' }); return r && r.wert_pct === 3.0; })());
p('Ausserhalb der hinterlegten Gebiete weiter kein Wert',
  (() => { const r = sachwertfaktor({ ags: '07315000' /* Mainz — RLP ist kostenpflichtig und nicht geerntet */, sachwert_eur: 400000,
    brw_eur_qm: 900, rnd_jahre: 50, bgf_qm: 300, objektart: 'Einfamilienhaus' });
    return r && r.grund === 'kein_ausschuss_hinterlegt'; })(), 'Mainz');

const s = registerStand();
p('ALLE angemeldeten Saatdateien gelesen',
  Array.isArray(s.gelesen) && s.gelesen.length === SAATDATEIEN.length
    && (s.vermisst || []).length === 0,
  (s.gelesen || []).map((g) => `${g.datei.split('/').pop()}:${g.saetze}`).join(' · '));

console.log('');
console.log(`Kettenpruefung v1089: ${ok} ok · ${fehler} FEHLER`);
process.exit(fehler ? 1 : 0);
