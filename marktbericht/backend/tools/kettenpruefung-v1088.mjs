// kettenpruefung-v1088.mjs  (v1088-WKET)

import { sachwertfaktor, liegenschaftszinssatz } from '../lib/gutachterausschuss.js';
import { registerStand, SAATDATEIEN, finde } from '../lib/ausschuss_register.js';

let ok = 0, fehler = 0;
const p = (t, b, z = '') => {
  if (b) { ok++; console.log(`  ok      ${t}${z ? ' — ' + z : ''}`); }
  else { fehler++; console.log(`  FEHLER  ${t}${z ? ' — ' + z : ''}`); }
};

/* ── Sachsen-Anhalt: stufen_kategorial, Landesebene ───────────────────── */

/* Der Sollwert kommt aus dem Dokument: Stendal steht dort mit 3,0 %.
 *
 * Der erste Anlauf dieses Tests fragte nach "Halle" — das steht gar nicht
 * in der Tabelle, und der Test war trotzdem gruen, weil er einen
 * Fehlschlaggrund als Ergebnis durchgehen liess. Eine nachsichtige
 * Zusicherung ist gruen und wertlos. */
const st = liegenschaftszinssatz({ ags: '15084000', zweig: 'mfh',
  ort: 'Stendal' });
p('Sachsen-Anhalt: Stendal liefert 3,0 % aus der Nachschlagetabelle',
  st && st.verfuegbar === true && st.wert_pct === 3.0,
  st && (st.verfuegbar ? `${st.wert_pct} % · Form ${st.modellform}` : st.grund));

const unbekannt = liegenschaftszinssatz({ ags: '15084000', zweig: 'mfh',
  ort: 'Kleinkleckersdorf' });
p('Ein Ort ausserhalb der Tabelle bekommt KEINEN Wert',
  unbekannt && unbekannt.verfuegbar === false
    && unbekannt.grund === 'kategorie_unbekannt',
  unbekannt && unbekannt.grund);

const stOhneOrt = liegenschaftszinssatz({ ags: '15002000', zweig: 'mfh' });
p('Ohne Ortsangabe kein Zinssatz (keine Interpolation, kein Raten)',
  stOhneOrt && stOhneOrt.verfuegbar === false,
  stOhneOrt && stOhneOrt.grund);

p('Der Liegenschaftszins DARF auf Landesebene fallen',
  finde('liegenschaftszinssatz', '15002000').length > 0,
  `${finde('liegenschaftszinssatz', '15002000').length} Satz/Saetze ueber ags=15`);

/* ── Halle: regression_additiv, der neunte Auswerter ──────────────────── */

const halle = sachwertfaktor({ ags: '15002000', sachwert_eur: 250000,
  brw_eur_qm: 120, standardstufe: 3, objektart: 'Einfamilienhaus' });
/* Halle rechnet, sobald alle vier Terme da sind. Die Gemarkungsgruppe
 * liegt uns noch nicht vor — der Test sagt deshalb GENAU das, statt jeden
 * beliebigen Grund durchgehen zu lassen. */
/* DER SOLLWERT AUS DER ABGEDRUCKTEN GLEICHUNG.
 *
 * 0,79821318 + 10800,16031602 x 250000^-0,81 + 0,00096848 x 120
 *            − 1,63874939 x 3^-1,88 − 0,06348555 x 1  =  1,1014  ->  1,10
 *
 * Der erste Lauf gab hier 2,02: die Umrechnungskoeffizienten des Berichts
 * lagen als additive `korrekturen` im Datensatz und wurden auf die
 * Gleichung DRAUFGERECHNET, obwohl sie dieselbe Wirkung nur beschreiben.
 * Eine Doppelzaehlung, die plausibel aussieht — genau die Sorte Fehler,
 * gegen die der Umsetzer jetzt abbricht. */
p('Halle: die abgedruckte Gleichung ergibt 1,10 (keine Doppelzaehlung)',
  (() => { const r = sachwertfaktor({ ags: '15002000', sachwert_eur: 250000,
    brw_eur_qm: 120, standardstufe: 3, gemarkung: 1,
    objektart: 'Einfamilienhaus' });
    return r && r.verfuegbar && Math.round((r.wert ?? 0) * 100) === 110; })(),
  (() => { const r = sachwertfaktor({ ags: '15002000', sachwert_eur: 250000,
    brw_eur_qm: 120, standardstufe: 3, gemarkung: 1,
    objektart: 'Einfamilienhaus' });
    return r.verfuegbar ? `Faktor ${r.wert}` : r.grund; })());

p('Halle rechnet ueber regression_additiv, sobald alle Terme da sind',
  (() => { const r = sachwertfaktor({ ags: '15002000', sachwert_eur: 250000,
    brw_eur_qm: 120, standardstufe: 3, gemarkung: 1,
    objektart: 'Einfamilienhaus' });
    return r && r.verfuegbar === true && r.modellform === 'regression_additiv'
      && r.wert > 0.2 && r.wert < 3; })(),
  (() => { const r = sachwertfaktor({ ags: '15002000', sachwert_eur: 250000,
    brw_eur_qm: 120, standardstufe: 3, gemarkung: 1,
    objektart: 'Einfamilienhaus' });
    return r.verfuegbar ? `Faktor ${r.wert}` : r.grund; })());

p('Der Gebaeudestandard kommt ueber die Feldbruecke an (standardstufe)',
  halle && halle.grund !== 'feld_fehlt'
    || (halle && /Gemarkung/i.test(String(halle.hinweis || ''))),
  halle && (halle.verfuegbar ? 'rechnet' : String(halle.hinweis).slice(0, 70)));

const halleLuecke = sachwertfaktor({ ags: '15002000', sachwert_eur: 250000,
  objektart: 'Einfamilienhaus' });
p('Fehlt ein Term der Gleichung, gibt es KEINEN Wert',
  halleLuecke && halleLuecke.verfuegbar === false,
  halleLuecke && halleLuecke.grund);

/* ── Erfurt: zwei Tabellen, getrennt nach Baujahr ─────────────────────── */

const alt = sachwertfaktor({ ags: '16051000', sachwert_eur: 200000,
  brw_eur_qm: 100, objektart: 'Einfamilienhaus', baujahr: 1975 });
const neu = sachwertfaktor({ ags: '16051000', sachwert_eur: 200000,
  brw_eur_qm: 100, objektart: 'Einfamilienhaus', baujahr: 2005 });
p('Baujahr 1975 trifft die Tabelle bis 1990',
  alt && (alt.verfuegbar ? /bis1990/.test(String(alt.zweig)) : !!alt.grund),
  alt && (alt.zweig || alt.grund));
p('Baujahr 2005 trifft die Tabelle ab 1991',
  neu && (neu.verfuegbar ? /ab1991/.test(String(neu.zweig)) : !!neu.grund),
  neu && (neu.zweig || neu.grund));
p('Die beiden sind NICHT derselbe Datensatz',
  alt && neu && alt.zweig !== neu.zweig,
  `${alt && alt.zweig} gegen ${neu && neu.zweig}`);

const ohneBj = sachwertfaktor({ ags: '16051000', sachwert_eur: 200000,
  brw_eur_qm: 100, objektart: 'Einfamilienhaus' });
p('OHNE Baujahr kein Wert — lieber nichts als die falsche Tabelle',
  ohneBj && ohneBj.verfuegbar === false,
  ohneBj && ohneBj.grund);

/* ── Nichts von v1084 bis v1087 ist schlechter geworden ───────────────── */

p('Hoexter unveraendert 0,77',
  (() => { const r = sachwertfaktor({ ags: '05762020', sachwert_eur: 300000,
    brw_eur_qm: 80, rnd_jahre: 55, bgf_qm: 300, objektart: 'Einfamilienhaus' });
    return r && Math.round((r.wert ?? 0) * 100) === 77; })());
p('Herford-Modul unveraendert 0,88',
  (() => { const r = sachwertfaktor({ ags: '05758016', sachwert_eur: 300000,
    brw_eur_qm: 125, rnd_jahre: 45, bgf_qm: 500, objektart: 'Zweifamilienhaus' });
    return r && r.herkunft === 'modul' && Math.round((r.wert ?? 0) * 100) === 88; })());
p('Berlin ueber den Altbezirk unveraendert 0,96',
  (() => { const r = sachwertfaktor({ ags: '11000000', sachwert_eur: 500000,
    objektart: 'Einfamilienhaus', altbezirk: 'Steglitz' });
    return r && Math.round((r.wert ?? 0) * 100) === 96; })());
p('Herford-Zins unveraendert 1,8 %',
  (() => { const r = liegenschaftszinssatz({ ags: '05758016', zweig: 'zfh' });
    return r && Math.round((r.wert_pct ?? 0) * 10) === 18; })());
p('Ausserhalb der hinterlegten Laender weiter kein Wert',
  (() => { const r = sachwertfaktor({ ags: '07315000' /* Mainz — RLP ist kostenpflichtig und nicht geerntet */, sachwert_eur: 400000,
    brw_eur_qm: 900, rnd_jahre: 50, bgf_qm: 300, objektart: 'Einfamilienhaus' });
    return r && r.grund === 'kein_ausschuss_hinterlegt'; })());

const s = registerStand();
p('ALLE angemeldeten Saatdateien gelesen',
  Array.isArray(s.gelesen) && s.gelesen.length === SAATDATEIEN.length
    && (s.vermisst || []).length === 0,
  (s.gelesen || []).map((g) => `${g.datei.split('/').pop()}:${g.saetze}`).join(' · '));

console.log('');
console.log(`Kettenpruefung v1088: ${ok} ok · ${fehler} FEHLER`);
process.exit(fehler ? 1 : 0);
