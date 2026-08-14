// kettenpruefung-v1087.mjs  (v1087-WKET)

import { marktdaten, durchschnittspreis, sachwertfaktor, bodenpreisniveau }
  from '../lib/gutachterausschuss.js';
import { registerStand, SAATDATEIEN } from '../lib/ausschuss_register.js';

let ok = 0, fehler = 0;
const p = (t, b, z = '') => {
  if (b) { ok++; console.log(`  ok      ${t}${z ? ' — ' + z : ''}`); }
  else { fehler++; console.log(`  FEHLER  ${t}${z ? ' — ' + z : ''}`); }
};

/* ── Durchschnittspreise ──────────────────────────────────────────────── */

const we = durchschnittspreis({ ags: '05111000', art: 'we', klasse: 'neu' });
p('Düsseldorf, Wohnungseigentum, Erstverkauf nach Neubau',
  we && we.verfuegbar && we.preis_eur_qm === 7358,
  we && `${we.preis_eur_qm} EUR/m2 · ${we.anzahl} Faelle · Stufe ${we.stufe}`);

const ueberBaujahr = durchschnittspreis({ ags: '05111000', art: 'we',
  baujahr: 1968 });
p('Baujahr 1968 trifft die Klasse 1950-1974',
  ueberBaujahr && ueberBaujahr.verfuegbar && ueberBaujahr.klasse === '1974',
  ueberBaujahr && `Klasse ${ueberBaujahr.klasse} · ${ueberBaujahr.preis_eur_qm} EUR/m2`);

const zuNeu = durchschnittspreis({ ags: '05111000', art: 'we',
  baujahr: 2024 });
p('Baujahr 2024 liegt ausserhalb der Quelle: kein Wert geraten',
  zuNeu && (zuNeu.klasse == null || zuNeu.verfuegbar === false),
  'die Quelle endet bei 2018');

const falscheArt = durchschnittspreis({ ags: '05111000', art: 'burg' });
p('Unbekannte Objektart: kein Wert',
  falscheArt && falscheArt.verfuegbar === false
    && falscheArt.grund === 'objektart_nicht_gefuehrt',
  falscheArt && (falscheArt.gefuehrte_arten || []).join(', '));

/* ── Preisentwicklung ─────────────────────────────────────────────────── */

const pe = marktdaten({ ags: '05111000', kennzahl: 'preisentwicklung' });
p('Düsseldorf: Preisentwicklung je Teilmarkt',
  pe && pe.verfuegbar && pe.teilmaerkte && pe.teilmaerkte.efh
    && pe.teilmaerkte.efh.entwicklung_pct === -2,
  pe && `efh ${pe.teilmaerkte.efh.entwicklung_pct} % · mfh `
    + `${pe.teilmaerkte.mfh.entwicklung_pct} %`);
p('Eine Entwicklung von 0 ist ein WERT, kein fehlender Wert',
  pe && pe.teilmaerkte.iwb && pe.teilmaerkte.iwb.entwicklung_pct === 0,
  'iwb 0 %');

/* ── Erbbauzinssatz ───────────────────────────────────────────────────── */

const erbb = marktdaten({ ags: '05334002', kennzahl: 'erbbauzinssatz' });
p('Erbbauzinssatz: entweder ein Wert mit Fallzahl, oder gar keiner',
  erbb && (erbb.verfuegbar
    ? (typeof erbb.wert_pct === 'number' && erbb.wert_pct > 0)
    : erbb.grund === 'keine_marktdaten_hinterlegt'),
  erbb && (erbb.verfuegbar ? `${erbb.wert_pct} % · ${erbb.fallzahl} Faelle`
                           : erbb.grund));

/* ── Die Grenzen halten ───────────────────────────────────────────────── */

p('Marktdaten sind IMMER indikativ',
  we && we.indikativ === true && pe && pe.indikativ === true,
  'kein Weg in einen Rechenweg');
p('Unbekannte Kennzahl wird abgewiesen',
  (() => { const r = marktdaten({ ags: '05111000', kennzahl: 'sachwertfaktor' });
    return r && r.verfuegbar === false && r.grund === 'kennzahl_unbekannt'; })(),
  'der Sachwertfaktor laeuft NICHT ueber die Marktdaten');
p('Ausserhalb der hinterlegten Gebiete: keine Marktdaten',
  (() => { const r = marktdaten({ ags: '07315000',
    kennzahl: 'durchschnittspreis' });
    return r && r.grund === 'keine_marktdaten_hinterlegt'; })());

/* ── Nichts von v1084 bis v1086 ist schlechter geworden ───────────────── */

p('Hoexter unveraendert 0,77',
  (() => { const r = sachwertfaktor({ ags: '05762020', sachwert_eur: 300000,
    brw_eur_qm: 80, rnd_jahre: 55, bgf_qm: 300, objektart: 'Einfamilienhaus' });
    return r && Math.round((r.wert ?? 0) * 100) === 77; })());
p('Berlin ueber den Altbezirk unveraendert 0,96',
  (() => { const r = sachwertfaktor({ ags: '11000000', sachwert_eur: 500000,
    objektart: 'Einfamilienhaus', altbezirk: 'Steglitz' });
    return r && Math.round((r.wert ?? 0) * 100) === 96; })());
p('Bodenpreisniveau unveraendert 1.850 EUR/m2',
  (() => { const r = bodenpreisniveau({ ags: '05111000', nutzungsart: 'efh',
    lage: 'gut' }); return r && r.wert_eur_qm === 1850; })());

/* ── Register ─────────────────────────────────────────────────────────── */

const st = registerStand();
p('ALLE angemeldeten Saatdateien gelesen',
  Array.isArray(st.gelesen) && st.gelesen.length === SAATDATEIEN.length
    && (st.vermisst || []).length === 0,
  (st.gelesen || []).map((g) => `${g.datei.split('/').pop()}:${g.saetze}`).join(' · '));
p('Die Kennzahlen dieses Pakets sind da',
  /* Keine Gesamtzahl — siehe kettenpruefung-v1086.mjs. */
  st.je_kennzahl && st.je_kennzahl.durchschnittspreis > 300
    && st.je_kennzahl.preisentwicklung > 200
    && st.je_kennzahl.erbbauzinssatz > 10,
  JSON.stringify(st.je_kennzahl));

console.log('');
console.log(`Kettenpruefung v1087: ${ok} ok · ${fehler} FEHLER`);
process.exit(fehler ? 1 : 0);
