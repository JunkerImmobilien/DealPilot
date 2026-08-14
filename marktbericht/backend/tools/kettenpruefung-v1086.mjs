// kettenpruefung-v1086.mjs  (v1086-WKET)
//
// Am Ausgabeobjekt gemessen, ohne dass der Test das Register selbst laedt.

import { sachwertfaktor, liegenschaftszinssatz, bodenpreisniveau }
  from '../lib/gutachterausschuss.js';
import { registerStand, finde, SAATDATEIEN }
  from '../lib/ausschuss_register.js';

let ok = 0, fehler = 0;
const p = (t, b, z = '') => {
  if (b) { ok++; console.log(`  ok      ${t}${z ? ' — ' + z : ''}`); }
  else { fehler++; console.log(`  FEHLER  ${t}${z ? ' — ' + z : ''}`); }
};

/* ── 1 · Die Zeitreihe: der juengere Jahrgang gewinnt ──────────────────── */
// Gebaut seit v1083, nie gelaufen. Jetzt liegen 2024 UND 2023 vor.

const hf = liegenschaftszinssatz({ ags: '05758016', zweig: 'zfh' });
p('Herford liefert den JUENGEREN Jahrgang',
  hf && hf.verfuegbar && hf.berichtsjahr === 2024,
  hf && `${hf.wert_pct} % · Berichtsjahr ${hf.berichtsjahr}`);

const alle = finde('liegenschaftszinssatz', '05758016');
const jahre = [...new Set(alle.map((x) => x.berichtsjahr))].sort();
p('Beide Jahrgaenge stehen konfliktfrei nebeneinander',
  jahre.length === 2 && jahre[0] === 2023 && jahre[1] === 2024,
  `Jahrgaenge ${jahre.join(', ')} · ${alle.length} Saetze am Schluessel`);
p('Der erste Satz ist der juengste',
  alle.length && alle[0].berichtsjahr === Math.max(...jahre),
  `zuerst ${alle[0] && alle[0].berichtsjahr}`);

/* ── 2 · Bodenpreisniveaus ─────────────────────────────────────────────── */

const dus = bodenpreisniveau({ ags: '05111000', nutzungsart: 'efh',
  lage: 'gut' });
p('Duesseldorf, EFH, gute Lage',
  dus && dus.verfuegbar && dus.wert_eur_qm === 1850,
  dus && `${dus.wert_eur_qm} EUR/m2 · Stufe ${dus.stufe} · indikativ=${dus.indikativ}`);

p('Der Wert ist als indikativ gekennzeichnet',
  dus && dus.indikativ === true && dus.stufe === 'B',
  dus && `Stufe ${dus.stufe}`);
p('Der Hinweis sagt, dass es KEIN Bodenrichtwert ist',
  dus && /kein Bodenrichtwert/i.test(dus.hinweis || ''),
  dus && String(dus.hinweis).slice(0, 70));
p('Quellenvermerk und Lizenz haengen am Ergebnis',
  dus && !!dus.quellenvermerk && dus.lizenz === 'dl-de/zero-2-0',
  dus && dus.lizenz);

const lageOhne = bodenpreisniveau({ ags: '05111000', nutzungsart: 'efh',
  lage: 'spitzenlage' });
p('Unbekannte Lage: kein Wert, keine Uebertragung',
  lageOhne && lageOhne.verfuegbar === false
    && lageOhne.grund === 'lage_ohne_wert',
  lageOhne && `${lageOhne.grund} · gefuehrt: ${(lageOhne.gefuehrte_lagen || []).join(', ')}`);

const artOhne = bodenpreisniveau({ ags: '05111000', nutzungsart: 'schloss' });
p('Unbekannte Nutzungsart: kein Wert',
  artOhne && artOhne.verfuegbar === false
    && artOhne.grund === 'nutzungsart_nicht_gefuehrt',
  artOhne && artOhne.grund);

const bayern = bodenpreisniveau({ ags: '07315000', nutzungsart: 'efh',
  lage: 'gut' });
p('Ausserhalb der hinterlegten Gebiete: kein Niveau hinterlegt',
  bayern && bayern.verfuegbar === false
    && bayern.grund === 'kein_niveau_hinterlegt',
  bayern && bayern.grund);

const uebersicht = bodenpreisniveau({ ags: '05111000' });
p('Ohne Nutzungsart die volle Aufschluesselung',
  uebersicht && uebersicht.verfuegbar
    && Object.keys(uebersicht.nutzung || {}).length === 5,
  uebersicht && Object.keys(uebersicht.nutzung || {}).join(', '));

/* ── 3 · Nichts von v1084/v1085 ist schlechter geworden ────────────────── */

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
p('Ein Bodenpreisniveau ist KEIN Sachwertfaktor',
  (() => { const r = sachwertfaktor({ ags: '05316000', sachwert_eur: 300000,
    brw_eur_qm: 200, rnd_jahre: 50, bgf_qm: 300, objektart: 'Einfamilienhaus' });
    return r && r.verfuegbar === false; })(),
  'eine Gemeinde mit Niveau, aber ohne Ausschuss, liefert weiter nichts');

/* ── 4 · Register ──────────────────────────────────────────────────────── */

const st = registerStand();
p('ALLE angemeldeten Saatdateien gelesen',
  /* Keine feste Zahl — die Liste waechst mit jedem Bundesland. Verglichen
   * wird gegen SAATDATEIEN; das ist die Zusicherung, die nicht altert.
   * In v1085 wurde genau diese Falle behoben und in v1086 gleich wieder
   * gebaut. */
  Array.isArray(st.gelesen) && st.gelesen.length === SAATDATEIEN.length
    && (st.vermisst || []).length === 0,
  (st.gelesen || []).map((g) => `${g.datei.split('/').pop()}:${g.saetze}`).join(' · '));
p('Die Kennzahlen dieses Pakets sind da',
  /* KEINE Gesamtzahl. Sie waechst mit jedem Paket, und eine Zusicherung,
   * die mit dem naechsten Paket faellt, ist keine Zusicherung — sie ist
   * eine Zeitbombe. Geprueft wird, was DIESES Paket gebracht hat. */
  st.je_kennzahl && st.je_kennzahl.liegenschaftszinssatz > 900
    && st.je_kennzahl.sachwertfaktor > 30
    && st.je_kennzahl.bodenpreisniveau > 400,
  JSON.stringify(st.je_kennzahl));

console.log('');
console.log(`Kettenpruefung v1086: ${ok} ok · ${fehler} FEHLER`);
process.exit(fehler ? 1 : 0);
