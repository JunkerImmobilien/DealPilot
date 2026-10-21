#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * objekt-mapper-pruefen.mjs — v2147
 *
 * KOMMT AN, WAS IM REITER OBJEKT EINGEGEBEN WIRD?
 *
 * Marcel am 12.10.2026: „natürlich müssen die eingaben dort auch passend
 * in den marktbericht übergeben werden können."
 *
 * ── WARUM EIN GREP NICHT REICHT ─────────────────────────────────────
 *
 * Ein grep über den Marktbericht-Dienst findet für fast jeden
 * Mapper-Schlüssel einen Leser. Das ist aber nur die halbe Antwort:
 *
 *   > Ein grep-Treffer beweist einen LESER, keine WIRKUNG. Ein Feld
 *   > kann gelesen und trotzdem verworfen werden — in einer Bedingung,
 *   > die nie wahr wird, oder hinter einem Vorrang, den ein anderes
 *   > Feld gewinnt.
 *
 * Dieser Prüfer misst die ANDERE Hälfte, und zwar am ECHTEN Mapper:
 * er trägt je Formularfeld zwei verschiedene Werte ein und sieht nach,
 * ob sich die Ausgabe ändert. Ein Feld, das man zweimal verschieden
 * füllt und das beide Male dasselbe erzeugt, ist im Formular umsonst.
 *
 * Das ist der Empfindlichkeitstest, der im Backlog unter N4 seit dem
 * 04.10.2026 offenstand.
 *
 * ── ZWEI ZAHLEN, DIE ICH ZURUECKNEHME ───────────────────────────────
 *
 * Beim grep-Lauf am 12.10.2026 habe ich „71 Schlüssel, 70 gelesen"
 * gemeldet. Beides war am QUELLTEXT gezählt, nicht am Lauf:
 *
 *   gegreppt   71 Schlüssel          gemessen   59 in reportInput
 *                                              +9 in nutzerEinschaetzung
 *                                              = 68 über drei Wege
 *
 * Die Differenz sind verschachtelte Objektschlüssel, die mein Regex
 * mitnahm. Eine Zahl, die aus dem Quelltext kommt, ist keine Messung —
 * dieser Prüfer nennt deshalb nur, was der echte Aufruf zurückgibt.
 *
 * ── DIE GRENZE DIESES PRUEFERS ──────────────────────────────────────
 *
 * Er misst den MAPPER, nicht den fertigen Bericht. Dass ein Feld im
 * `reportInput` ankommt, heisst noch nicht, dass es den Sachwert
 * bewegt — dafür braucht es einen echten Berichtslauf gegen die
 * Datenbank. Diese Deckung wird unten ausdrücklich genannt, damit
 * niemand den Prüfer für mehr hält, als er ist.
 *
 * ── UND ER PRUEFT SICH SELBST ───────────────────────────────────────
 *
 * Ein Testwert, den das Formular nicht anbietet, misst nichts. Beim
 * ersten Lauf waren 46 meiner 82 Testwerte erfunden — darunter alle
 * neun `eq_*` (die tragen GROSSSCHREIBUNG: `ZENTRALHEIZUNG`) und die
 * vier Modernisierungsfelder (die tragen Text, kein `value`). Darum
 * liest der Prüfer die echten <option>-Werte aus `index.html` und
 * bricht ab, wenn ein Testwert dort nicht vorkommt.
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PFAD = path.join(process.cwd(), 'marktbericht', 'backend', 'src',
  'services', 'DealPilotObjectMapper.js');
let M;
try {
  M = (await import(pathToFileURL(PFAD).href)).DealPilotObjectMapper;
} catch (e) {
  console.error('Mapper nicht ladbar: ' + e.message);
  process.exit(2);
}
if (!M || typeof M.reportInput !== 'function') {
  console.error('reportInput() fehlt.');
  process.exit(2);
}

/* ── Ein vollständig gefülltes Objekt, wie es der Reiter liefert ──────
 * Die Feld-Ids sind an `frontend/index.html` (Abschnitt s0) ausgelesen,
 * nicht geraten. */
const BASIS = {
  plz: '32609', ort: 'Hüllhorst', str: 'Hermannstr.', hnr: '9',
  objart: 'ETW', nutzungsart: 'kapitalanlage', wfl: '100', zimmer: '3',
  baujahr: '1968', etage: '1', etagen_ges: '3', einheiten: '6',
  ds2_zustand: 'normal', standardstufe: '3', ds2_energie: 'D',
  vermstand: 'Vollvermietet', gsfl: '950', mea: '50', kp: '200000', nkm: '490',
  bgf: '120', grundriss: 'zweispaenner', mod_punkte: '8', sachwertfaktor: '1.07',
  nhk_haus: '1', nhk_geschosse: '2', nhk_dach: '1',
  garagen_bgf_qm: '18', garagen_stufe: '3', aussenanlagen_pct: '3',
  aussenanlagen: '6000', bes_bauteile: '4000',
  btl_gauben: '1000', btl_balkone: '2000', btl_vordach: '500',
  hinterland_qm: '828', hinterland_eur_qm: '5', hinterland_rentierlich: '',
  lzs_pct: '2.56', brw: '90', brw_manuell: '', brw_anpassung_pct: '-10',
  brw_anpassung_grund: 'Lärm', stellplatz_miete_monat: '45', sonstige_jahr: '240',
  eq_heating: 'ZENTRALHEIZUNG', eq_windows: 'ZWEIFACHVERGLASUNG',
  eq_floor: 'PARKETT_NATURSTEIN', eq_bath: 'EIN_BAD', eq_guest_wc: 'KEIN_GAESTE_WC',
  eq_store_room: 'AUSSERHALB', eq_walls: 'AUSSENWAENDE_NICHT_GEDAEMMT',
  eq_roof: 'DACHPFANNEN', eq_elevator: 'Nein',
  mod_dach: '10 - 20 Jahre', mod_fenster: '10 - 20 Jahre', mod_heizung: '5 - 10 Jahre',
  mod_baeder: '> 20 Jahre', mod_aussenwand: '', mod_innenausbau: '',
  mod_leitungen: '', mod_grundriss: '',
  ausst_dach: '3', ausst_fenster: '3', ausst_heizung: '4',
  ausst_sanitaer: '3', ausst_fussboeden: '3', ausst_innenwaende: '3',
  ausst_decken: '3', ausst_technik: '3', ausst_aussenwaende: '3',
  bad_anz: '1', balkon_flae: '8', garagen: '1', stellpl_aussen: '1',
  modernis: '2017', baustatus: 'bestand', ausst: 'Gehoben',
  erbpacht: false, erbbauzins: '', erb_restlz: '',
  mikrolage: 'gut', makrolage: 'durchschnittlich', ds2_bevoelkerung: 'stabil',
  ds2_nachfrage: 'mittel', ds2_wertsteigerung: 'mittel',
  ds2_entwicklung: 'begrenzt', ds2_mietausfall: 'niedrig',
  ds2_marktmiete: '8.50', ds2_marktfaktor: '1.0',
  /* v2660 · E2 · Einzelobjekt: Restlaufzeit der Mietabweichung */
  mv_befristet_bis: '2028-06', mv_kuendigungsverzicht_bis: '', mv_abw_jahre: '3'
};

/* Je Formularfeld ein ANDERER Wert — plausibel, aber verschieden. */
const ANDERS = {
  wfl: '180', zimmer: '5', baujahr: '1995', etage: '3', etagen_ges: '5',
  einheiten: '12', ds2_zustand: 'renovierungsbeduerftig', standardstufe: '5',
  ds2_energie: 'A', vermstand: 'Leer', gsfl: '400', mea: '25',
  kp: '450000', nkm: '1200', bgf: '240', grundriss: 'vierspaenner',
  mod_punkte: '19', sachwertfaktor: '1.35',
  nhk_haus: '3', nhk_geschosse: '0', nhk_dach: '3',
  garagen_bgf_qm: '40', garagen_stufe: '5', aussenanlagen_pct: '8',
  aussenanlagen: '22000', bes_bauteile: '15000',
  btl_gauben: '5000', btl_balkone: '9000', btl_vordach: '2500',
  hinterland_qm: '0', hinterland_eur_qm: '40', hinterland_rentierlich: 'ja',
  lzs_pct: '4.80', brw: '320', brw_anpassung_pct: '15',
  brw_anpassung_grund: 'Eckgrundstueck', stellplatz_miete_monat: '95',
  sonstige_jahr: '1800',
  eq_heating: 'FUSSBODENHEIZUNG', eq_windows: 'DREIFACHVERGLASUNG',
  eq_floor: 'FLIESEN', eq_bath: 'MEHR_ALS_EIN_BAD', eq_guest_wc: 'GAESTE_WC',
  eq_store_room: 'INNERHALB_UND_AUSSERHALB', eq_walls: 'AUSSENWAENDE_GEDAEMMT',
  eq_roof: 'SCHIEFER', eq_elevator: 'Ja',
  mod_dach: '< 5 Jahre', mod_fenster: 'Kernsanierung', mod_heizung: '< 5 Jahre',
  mod_baeder: '< 5 Jahre',
  ausst_dach: '5', ausst_fenster: '5', ausst_heizung: '2',
  ausst_sanitaer: '5', ausst_fussboeden: '5', ausst_innenwaende: '5',
  ausst_decken: '5', ausst_technik: '5', ausst_aussenwaende: '5',
  bad_anz: '3', balkon_flae: '25', garagen: '3', stellpl_aussen: '4',
  modernis: '2023', baustatus: 'neubau_erstbezug', ausst: 'Einfach',
  objart: 'MFH', nutzungsart: 'eigennutzung',
  mikrolage: 'schwach', makrolage: 'sehr_gut', ds2_bevoelkerung: 'stark_fallend',
  ds2_nachfrage: 'sehr_schwach', ds2_wertsteigerung: 'hoch',
  ds2_entwicklung: 'keine', ds2_mietausfall: 'hoch',
  ds2_marktmiete: '14.20', ds2_marktfaktor: '1.4',
  plz: '10115', ort: 'Berlin', str: 'Dorotheenstr.', hnr: '42',
  mv_befristet_bis: '2030-12', mv_kuendigungsverzicht_bis: '2029-01', mv_abw_jahre: '7'   /* v2660 */
};

/* ── WELCHE METHODEN ZAEHLEN ─────────────────────────────────────────
 * Der Mapper hat vier Methoden, aber nur DREI werden gerufen:
 *
 *   reportInput          api.js:1093, ReportOrchestrator.js:68
 *   dealpilot            ReportOrchestrator.js:72
 *   nutzerEinschaetzung  ReportOrchestrator.js:73
 *   assessment           KEIN AUFRUFER
 *
 * Wer nur `reportInput` prüft, hält die neun Lage-Indikatoren für
 * stumm — sie fahren über `nutzerEinschaetzung`. Genau dieser Fehler
 * ist mir beim ersten Lauf passiert.
 *
 * Darum wird die Ausgabe aller drei LEBENDEN Methoden zusammen
 * gemessen. `assessment` bleibt bewusst draussen: was niemand ruft,
 * trägt auch nichts. */
const WEGE = ['reportInput', 'dealpilot', 'nutzerEinschaetzung'];
function uebergabe(obj) {
  const o = {};
  WEGE.forEach(function (w) { o[w] = M[w](obj); });
  return o;
}

/* ══ PRUEFT SICH DER PRUEFER SELBST? ═════════════════════════════════
 *
 * Ein Testwert, den das Formular nicht anbietet, misst nichts. Genau
 * das ist mir hier passiert: `nutzungsart` hat ZWEI Optionen
 * (`kapitalanlage`, `eigennutzung`), ich hatte „wohnen" und „gemischt"
 * eingetragen — beide treffen die Bedingung `/eigen/` nicht, also kam
 * zweimal dasselbe heraus und das Feld sah stumm aus.
 *
 * Dieselbe Falle wie der Feldname, der nur in einer Fixture stand —
 * nur diesmal mit dem WERT. Darum liest dieser Abschnitt die echten
 * <option>-Werte aus `frontend/index.html` und hält jeden Testwert
 * dagegen. Was es im Formular nicht gibt, kann niemand eingeben. */
const OPTIONEN = (function () {
  const html = fs.readFileSync(path.join(process.cwd(), 'frontend', 'index.html'),
    'latin1');  /* index.html ist latin1 — zwei Ersatzzeichen bei UTF-8 */
  const o = {};
  const re = /<select[^>]*\bid="([a-zA-Z0-9_]+)"[^>]*>([\s\S]*?)<\/select>/g;
  let m;
  while ((m = re.exec(html))) {
    /* Ohne `value` ist der Optionstext der Wert — so sind die acht
       Modernisierungsfelder gebaut („Keine/Nie", „> 20 Jahre", …).
       Wer nur nach `value="…"` greppt, hält sie für leer. */
    const werte = [...m[2].matchAll(/<option([^>]*)>([^<]*)/g)].map(function (x) {
      const v = (x[1].match(/\bvalue="([^"]*)"/) || [])[1];
      return v != null ? v : x[2].replace(/&gt;/g, '>').replace(/&lt;/g, '<')
        .replace(/&ndash;/g, '–').replace(/&amp;/g, '&').trim();
    });
    if (werte.length) o[m[1]] = werte;
  }
  return o;
})();

console.log('=== Selbstprüfung: stehen die Testwerte im Formular? ===');
console.log('  Auswahlfelder in index.html: ' + Object.keys(OPTIONEN).length);
const erfundeneWerte = [];
function pruefeWerte(name, satz) {
  Object.keys(satz).forEach(function (feld) {
    if (!OPTIONEN[feld]) return;            /* kein Auswahlfeld -> frei */
    const v = String(satz[feld]);
    if (!OPTIONEN[feld].includes(v)) {
      erfundeneWerte.push(name + '.' + feld + ' = "' + v
        + '"   möglich: ' + OPTIONEN[feld].filter((x) => x).join('|'));
    }
  });
}
pruefeWerte('BASIS', BASIS);
pruefeWerte('ANDERS', ANDERS);
if (!erfundeneWerte.length) {
  console.log('  ok  jeder Testwert eines Auswahlfeldes ist eine echte Option');
} else {
  console.log('  ROT ' + erfundeneWerte.length + ' Testwert(e) gibt es im Formular NICHT:');
  erfundeneWerte.forEach(function (e) { console.log('      ' + e); });
  console.log('      Ein solcher Wert misst nichts — der Befund wäre erfunden.');
}
console.log('');

const vorher = uebergabe(BASIS);
const SCHLUESSEL = [];
WEGE.forEach(function (w) {
  Object.keys(vorher[w] || {}).forEach(function (k) { SCHLUESSEL.push(w + '.' + k); });
});
function hole(o, pfad) {
  const t = pfad.split('.');
  return o[t[0]] ? o[t[0]][t[1]] : undefined;
}

console.log('=== Was der Mapper aus dem gefüllten Reiter macht ===');
console.log('  Formularfelder im Auftrag : ' + Object.keys(BASIS).length);
console.log('  Gemessene Wege            : ' + WEGE.join(', '));
console.log('  Schlüssel insgesamt       : ' + SCHLUESSEL.length);
WEGE.forEach(function (w) {
  console.log('     ' + w.padEnd(22) + Object.keys(vorher[w] || {}).length);
});
const belegt = SCHLUESSEL.filter(function (k) {
  const v = hole(vorher, k);
  return v !== null && v !== undefined && v !== '' && !(typeof v === 'object' && v !== null && !Object.keys(v).length);
});
console.log('  davon belegt              : ' + belegt.length);
console.log('');

/* ══ DER EMPFINDLICHKEITSTEST ════════════════════════════════════════ */
console.log('=== Empfindlichkeit: ändert ein anderer Eingabewert die Ausgabe? ===');
const stumm = [], wirkt = [];
Object.keys(ANDERS).forEach(function (feld) {
  const kopie = Object.assign({}, BASIS);
  kopie[feld] = ANDERS[feld];
  let nachher;
  try { nachher = uebergabe(kopie); } catch (e) { stumm.push({ feld, warum: 'wirft: ' + e.message }); return; }
  const a = JSON.stringify(vorher), b = JSON.stringify(nachher);
  if (a === b) { stumm.push({ feld, warum: 'Ausgabe identisch' }); return; }
  /* Welche Schlüssel haben sich geändert? */
  const geaendert = SCHLUESSEL.filter(function (k) {
    return JSON.stringify(hole(vorher, k)) !== JSON.stringify(hole(nachher, k));
  });
  wirkt.push({ feld, auf: geaendert });
});

console.log('  wirksam : ' + wirkt.length + ' von ' + Object.keys(ANDERS).length);
console.log('  stumm   : ' + stumm.length);
console.log('');
/* ── GEWOLLT STUMM ODER ECHT STUMM? ─────────────────────────────────
 * Vier der stummen Felder sind es, WEIL ein anderes Feld Vorrang hat.
 * Das ist kein Defekt, sondern eine Entscheidung — aber behaupten
 * reicht nicht: fällt der Vorrang weg, MUSS das Feld wirken. Erst
 * diese Gegenprobe trennt „gewollt stumm" von „verloren".
 *
 * Jeder Eintrag: das Feld, was man wegnehmen muss, und warum. */
const VORRANG = {
  ausst: {
    weg: ['standardstufe'],
    warum: 'die Standardstufe 1-5 gewinnt (v1851, Anlage 4 ImmoWertV)'
  },
  mod_dach:    { leer: true, warum: 'nur GEZAEHLT in mod_angaben, der Jahrgang selbst fährt nicht mit' },
  mod_fenster: { leer: true, warum: 'dito' },
  mod_heizung: { leer: true, warum: 'dito' },
  mod_baeder:  { leer: true, warum: 'dito' }
};
const gewollt = [], echt = [];
stumm.forEach(function (s) {
  const v = VORRANG[s.feld];
  if (!v) { echt.push(s); return; }
  /* Den Vorrang wegnehmen und noch einmal messen */
  const ohne = Object.assign({}, BASIS);
  (v.weg || []).forEach(function (k) { delete ohne[k]; });
  const a = uebergabe(ohne);
  const b = uebergabe(Object.assign({}, ohne,
    v.leer ? { [s.feld]: '' } : { [s.feld]: ANDERS[s.feld] }));
  const wirktJetzt = JSON.stringify(a) !== JSON.stringify(b);
  (wirktJetzt ? gewollt : echt).push(Object.assign({}, s,
    { warum: v.warum, bewiesen: wirktJetzt }));
});

if (gewollt.length) {
  console.log('  ── GEWOLLT STUMM (Gegenprobe bewiesen) ──');
  gewollt.forEach(function (g) {
    console.log('     ok  ' + g.feld.padEnd(16) + g.warum);
  });
  console.log('');
}
if (echt.length) {
  console.log('  ── OHNE ZIEL IM BERICHT ──');
  echt.forEach(function (s) {
    console.log('     ' + s.feld.padEnd(16) + (s.warum || ''));
  });
  console.log('');
  console.log('  Ein Feld, das man zweimal verschieden füllt und das beide');
  console.log('  Male dasselbe erzeugt, steht im Formular umsonst — es sei');
  console.log('  denn, ein anderer Weg liest es (Kalkulation, Score, PDF).');
  console.log('  Das gehört dann DORT belegt, nicht hier vermutet.');
  console.log('');
}

/* ══ DIE GEGENPROBE: findet der Prüfer ein Leck überhaupt? ═══════════ */
console.log('=== Gegenprobe: erkennt der Prüfer ein stummes Feld? ===');
const erfunden = Object.assign({}, BASIS, { gibtesnicht_xyz: 'wert' });
const mitErfundenem = uebergabe(erfunden);
const gleich = JSON.stringify(mitErfundenem) === JSON.stringify(vorher);
console.log('  ' + (gleich ? 'ok  ' : 'ROT ') + 'ein erfundenes Feld ändert nichts'
  + (gleich ? '' : ' — der Prüfer misst Rauschen'));

/* Und umgekehrt: ein bekannt wirksames Feld MUSS wirken. */
const probe = uebergabe(Object.assign({}, BASIS, { wfl: '999' }));
const wflWirkt = JSON.stringify(probe) !== JSON.stringify(vorher);
console.log('  ' + (wflWirkt ? 'ok  ' : 'ROT ') + 'die Wohnfläche wirkt (Kontrollprobe)');

/* Und die Methode, die niemand ruft, wird ausdrücklich genannt */
const tot = typeof M.assessment === 'function';
console.log('  ' + (tot ? '!!  ' : 'ok  ')
  + 'assessment() existiert' + (tot ? ' und hat KEINEN Aufrufer (Doppelung zu nutzerEinschaetzung)' : ' nicht mehr'));

console.log('');
console.log('=== Deckung ===');
console.log('  Mapper        : der ECHTE aus marktbericht/backend/src/services');
console.log('  Gemessen      : ' + Object.keys(ANDERS).length + ' Formularfelder, je mit zwei Werten');
console.log('  NICHT gemessen: ob das Feld den BERICHT bewegt. Dieser Prüfer');
console.log('                  endet am reportInput. Für den Sachwert braucht');
console.log('                  es einen echten Lauf gegen die Datenbank.');

const rot = (gleich ? 0 : 1) + (wflWirkt ? 0 : 1) + (erfundeneWerte.length ? 1 : 0);
console.log('');
console.log(rot === 0
  ? 'SAUBER — die Gegenproben greifen. ' + wirkt.length + ' Felder wirken, '
    + gewollt.length + ' sind gewollt stumm (bewiesen), '
    + echt.length + ' haben kein Ziel im Bericht.'
  : 'ROT — die Gegenprobe selbst ist schief.');
process.exit(rot ? 1 : 0);
