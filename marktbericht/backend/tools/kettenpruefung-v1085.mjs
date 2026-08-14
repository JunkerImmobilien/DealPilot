// kettenpruefung-v1085.mjs  (v1085-WKET)
//
// Prueft am AUSGABEOBJEKT, mit den Feldnamen des echten Aufrufers, und ohne
// dass der Test das Register selbst laedt.

import { sachwertfaktor, liegenschaftszinssatz } from '../lib/gutachterausschuss.js';
import { registerStand, finde, SAATDATEIEN }
  from '../lib/ausschuss_register.js';

let ok = 0, fehler = 0;
const p = (t, b, z = '') => {
  if (b) { ok++; console.log(`  ok      ${t}${z ? ' — ' + z : ''}`); }
  else { fehler++; console.log(`  FEHLER  ${t}${z ? ' — ' + z : ''}`); }
};

/* ── Berlin: Sachwertfaktor ueber den Altbezirk ────────────────────────── */
// Gruppe 1 traegt u.a. Steglitz. Ohne Altbezirk darf NICHTS herauskommen.

const ohneBezirk = sachwertfaktor({
  ags: '11000000', sachwert_eur: 500000, objektart: 'Einfamilienhaus' });
p('Berlin ohne Altbezirk: kein Wert',
  ohneBezirk && ohneBezirk.verfuegbar === false,
  ohneBezirk && ohneBezirk.grund);

const mitBezirk = sachwertfaktor({
  ags: '11000000', sachwert_eur: 500000, objektart: 'Einfamilienhaus',
  altbezirk: 'Steglitz' });
p('Berlin mit Altbezirk rechnet',
  mitBezirk && mitBezirk.verfuegbar === true,
  mitBezirk && (mitBezirk.grund || `Faktor ${mitBezirk.wert} · ${mitBezirk.rechenweg}`));

const innenstadt = sachwertfaktor({
  ags: '11000000', sachwert_eur: 500000, objektart: 'Einfamilienhaus',
  altbezirk: 'Kreuzberg' });
p('Altbezirk ohne Sachwertfaktor: kein Wert, mit Begruendung',
  innenstadt && innenstadt.verfuegbar === false
    && innenstadt.grund === 'gebiet_ohne_wert',
  innenstadt && innenstadt.grund);

/* ── Berlin: Liegenschaftszinssatz als Funktion ────────────────────────── */
// Der Datensatz traegt vollstaendig:false — er darf NICHT rechnen.

const zinsBe = liegenschaftszinssatz({ ags: '11000000', zweig: 'mfh',
  objektkaltmiete_eur_m2_monat: 11 });
p('Berliner Zinssatz rechnet NICHT (Datensatz unvollstaendig)',
  zinsBe && zinsBe.verfuegbar === false
    && zinsBe.grund === 'datensatz_unvollstaendig',
  zinsBe && zinsBe.grund);
p('Der unvollstaendige Satz nennt seinen Grund',
  zinsBe && /\S/.test(zinsBe.hinweis || ''),
  zinsBe && String(zinsBe.hinweis).slice(0, 90));

/* ── Der Zins als Konstante laeuft weiter ──────────────────────────────── */

const zinsHf = liegenschaftszinssatz({ ags: '05758016', zweig: 'zfh' });
p('Herford: Zinssatz unveraendert 1,8 %',
  zinsHf && zinsHf.verfuegbar && Math.round((zinsHf.wert_pct ?? 0) * 10) === 18,
  zinsHf && `${zinsHf.wert_pct} % · Stufe ${zinsHf.stufe} · Form ${zinsHf.modellform}`);

/* ── Kaskadensperre: Sachwertfaktor faellt nie auf Landesebene ─────────── */

p('NRW-Regression: Hoexter unveraendert 0,77',
  (() => { const r = sachwertfaktor({ ags: '05762020', sachwert_eur: 300000,
    brw_eur_qm: 80, rnd_jahre: 55, bgf_qm: 300, objektart: 'Einfamilienhaus' });
    return r && Math.round((r.wert ?? 0) * 100) === 77; })(), '0,77');

p('Herford laeuft weiter ueber das MODUL',
  (() => { const r = sachwertfaktor({ ags: '05758016', sachwert_eur: 300000,
    brw_eur_qm: 125, rnd_jahre: 45, bgf_qm: 500, objektart: 'Zweifamilienhaus' });
    return r && r.herkunft === 'modul' && Math.round((r.wert ?? 0) * 100) === 88; })(),
  '0,88 aus dem Herford-Modul');

p('Ausserhalb der hinterlegten Gebiete und Berlin: kein Ausschuss hinterlegt',
  (() => { const r = sachwertfaktor({ ags: '07315000' /* Mainz — RLP ist kostenpflichtig und nicht geerntet */, sachwert_eur: 400000,
    brw_eur_qm: 900, rnd_jahre: 50, bgf_qm: 300, objektart: 'Einfamilienhaus' });
    return r && r.grund === 'kein_ausschuss_hinterlegt'; })());

/* ── Register ──────────────────────────────────────────────────────────── */

const st = registerStand();
p('ALLE angemeldeten Saatdateien gelesen',
  /* Keine feste Zahl — die Liste waechst mit jedem Bundesland. Verglichen
   * wird gegen SAATDATEIEN; das ist die Zusicherung, die nicht altert.
   * In v1085 wurde genau diese Falle behoben und in v1086 gleich wieder
   * gebaut. */
  Array.isArray(st.gelesen) && st.gelesen.length === SAATDATEIEN.length
    && (st.vermisst || []).length === 0,
  (st.gelesen || []).map((g) => `${g.datei.split('/').pop()}:${g.saetze}`).join(' · '));
p('Beide Kennzahlen im Register',
  st.je_kennzahl && st.je_kennzahl.sachwertfaktor > 30
    && st.je_kennzahl.liegenschaftszinssatz > 490,
  JSON.stringify(st.je_kennzahl));

console.log('');
console.log(`Kettenpruefung v1085: ${ok} ok · ${fehler} FEHLER`);
process.exit(fehler ? 1 : 0);
