/* pruef-zweigwahl.mjs — v1816
 *
 * Prueft die Zweigwahl gegen das ECHTE Register: jeder Ausschuss, jede
 * Objektart, und fuer jeden Fall die Frage — kommt ein Zinssatz an, oder
 * kommt eine Rueckfrage, die SAGT was fehlt?
 *
 * DER PRUEFER NENNT SEINE DECKUNG. "Alles gruen" ohne die Zahl, wie viele
 * Ausschuesse und Zweige er gesehen hat, ist kein Befund.
 *
 * UND ER ENTHAELT EINEN GEGENTEST: fuer jeden Fall wird zusaetzlich
 * gemessen, was der BERICHT heute liefert (WertParameterService). Nur so
 * laesst sich sagen, dass sich etwas geaendert hat — "nachher richtig"
 * beweist nicht "vorher falsch".
 *
 * Lauf:  docker exec dealpilot-mb-backend node /tmp/pruef-zweigwahl.mjs
 */
import { finde, registerStand } from '/app/src/lib/ausschuss_register.js';
import { liegenschaftszinssatz } from '/app/src/lib/gutachterausschuss.js';
import { waehle, dekodiere } from '/app/src/lib/zweigwahl.js';
import { WertParameterService as WPS } from '/app/src/services/WertParameterService.js';
import { q } from '/app/src/lib/db.js';

const stand = registerStand();
console.log('DECKUNG · Register: ' + (stand.saetze || '?') + ' Saetze, '
  + (stand.gebiete || '?') + ' Gebiete');

/* ── Die Gebiete kommen aus der QUELLE des Registers, nicht aus einer
 * eigenen Liste. `finde(kennzahl, null)` gibt [] zurueck — es braucht ein
 * konkretes AGS und laeuft die Kaskade. Mein erster Anlauf fragte mit
 * null und meldete daraufhin NULL Gebiete bei 2655 Saetzen im Register.
 *
 *   > Null ueber alles ist kein Befund, sondern ein ausgefallenes
 *   > Werkzeug. (Zum zweiten Mal heute.)                                */
const rows = await q(
  `SELECT ags, max(coalesce(gebiet_name, gaa_name, ags)) AS name,
          array_agg(DISTINCT zweig) AS zweige
     FROM mb.param_modell
    WHERE kennzahl = 'liegenschaftszinssatz'
    GROUP BY ags`);
const alleAgs = new Map();
for (const r of rows || []) {
  alleAgs.set(String(r.ags), { name: r.name, zweige: r.zweige || [] });
}
console.log('DECKUNG · Gebiete mit Liegenschaftszinssatz: ' + alleAgs.size);
const alleZweige = new Set([...alleAgs.values()].flatMap((x) => x.zweige));
console.log('DECKUNG · verschiedene Zweige: ' + alleZweige.size);

/* Jeder Schluessel muss sich zerlegen lassen — ein Schluessel, dessen Art
   leer bleibt, waere ein blinder Fleck des Dekoders. */
let unzerlegt = 0;
for (const z of alleZweige) {
  const d = dekodiere(z);
  if (!d.art) { unzerlegt++; console.log('  NICHT ZERLEGT: ' + z); }
}
console.log('DECKUNG · nicht zerlegbare Zweige: ' + unzerlegt + ' von ' + alleZweige.size);

/* Die Probefaelle — realistische Objekte, kein Wunschdenken. */
const FAELLE = [
  { name: 'ETW Altbau vermietet',  objart: 'ETW', baujahr: 1965, restnutzungsdauer: 40, nutzung: 'vermietet' },
  { name: 'ETW Neubau vermietet',  objart: 'ETW', baujahr: 2015, restnutzungsdauer: 65, nutzung: 'vermietet' },
  { name: 'EFH freistehend',       objart: 'EFH', haustyp: 'frei', baujahr: 1980, restnutzungsdauer: 45 },
  { name: 'EFH Reihenhaus',        objart: 'EFH', haustyp: 'rh',   baujahr: 1980, restnutzungsdauer: 45 },
  { name: 'EFH Doppelhaushaelfte', objart: 'EFH', haustyp: 'dhh',  baujahr: 1980, restnutzungsdauer: 45 },
  { name: 'ZFH',                   objart: 'ZFH', baujahr: 1970, restnutzungsdauer: 40 },
  { name: 'MFH 8 Einheiten',       objart: 'MFH', einheiten: 8, baujahr: 1975, restnutzungsdauer: 40 },
];

let mitZweig = 0, mitRueckfrage = 0, ohneWert = 0;
const rueckfragen = {};
const zeilen = [];

for (const [ags, g] of alleAgs) {
  for (const f of FAELLE) {
    const w = waehle(g.zweige, f);
    if (w.zweig) {
      /* DER ECHTE ABRUF — nicht nur die Wahl, sondern der Wert. */
      const r = liegenschaftszinssatz({ ags, zweig: w.zweig });
      /* DAS FELD HEISST wert_pct. Mein erster Anlauf las r.wert und
         meldete 292-mal "kein Wert" — bei einer Funktion, die
         verfuegbar:true und wert_pct:1.29 zurueckgab.

           > Die ECHTE Funktion zu rufen genuegt nicht, wenn man ihre
           > Antwort falsch liest. */
      const wert = r && (r.wert_pct != null ? r.wert_pct
                        : (r.wert != null ? r.wert : r.zinssatz));
      if (wert != null) {
        mitZweig++;
        zeilen.push([g.name.slice(0, 34), f.name.slice(0, 22), w.zweig.slice(0, 26), wert, r.stufe || 'A']);
      } else {
        ohneWert++;
        /* zweig_nicht_abgeleitet ist KEIN Fehler: der Ausschuss fuehrt
           fuer diese Objektart keinen Zinssatz. Das ist eine Auskunft. */
        const grund = (r && r.grund) || 'kein_wert';
        rueckfragen['abruf:' + grund] = (rueckfragen['abruf:' + grund] || 0) + 1;
      }
    } else {
      mitRueckfrage++;
      rueckfragen[w.rueckfrage] = (rueckfragen[w.rueckfrage] || 0) + 1;
      /* Eine Rueckfrage MUSS sagen, was fehlt — sonst ist sie Schweigen
         mit anderem Wortlaut. */
      if (!w.hinweis || w.hinweis.length < 20) {
        console.log('  RUECKFRAGE OHNE HINWEIS: ' + g.name + ' / ' + f.name + ' / ' + w.rueckfrage);
      }
    }
  }
}

console.log('\n── ERGEBNIS ' + (alleAgs.size * FAELLE.length) + ' Proben ──');
console.log('  Zweig gefunden UND Wert abgerufen : ' + mitZweig);
console.log('  Zweig gefunden, aber kein Wert    : ' + ohneWert);
console.log('  Rueckfrage (sagt, was fehlt)      : ' + mitRueckfrage);
console.log('  Rueckfragen nach Grund            : ' + JSON.stringify(rueckfragen));

console.log('\n── GEGENTEST: was liefert der BERICHT heute? ──');
const VERGLEICH = [
  ['Dresden', '14612000', 'ETW'], ['Leipzig', '14713000', 'ETW'],
  ['Hamburg', '02000000', 'ETW'], ['Hannover', '03241001', 'ETW'],
  ['Bielefeld', '05711000', 'ETW'], ['Detmold', '05766020', 'ETW'],
];
for (const [ort, ags, art] of VERGLEICH) {
  const heute = await WPS.liegenschaftszins({ ags, objektart: art, anzahlWe: 1,
                                              brwSqm: 300, stichtag: '2026-01-01' }) || {};
  const g = alleAgs.get(ags) || alleAgs.get(String(ags).slice(0, 5)) || { zweige: [] };
  const w = waehle(g.zweige, { objart: art, baujahr: 1965, restnutzungsdauer: 40, nutzung: 'vermietet' });
  let reg = null;
  if (w.zweig) {
    const r = liegenschaftszinssatz({ ags, zweig: w.zweig });
    reg = r && (r.wert_pct != null ? r.wert_pct : (r.wert != null ? r.wert : r.zinssatz));
  }
  const diff = (reg != null && heute.wert != null) ? (reg - heute.wert).toFixed(2) : '—';
  console.log([ort.padEnd(10),
    'Bericht ' + String(heute.wert ?? '-').padEnd(5) + ' Stufe ' + (heute.stufe || '-'),
    'Register ' + String(reg ?? (w.rueckfrage ? 'Rueckfrage:' + w.rueckfrage : '-')).padEnd(18),
    'Differenz ' + diff].join(' | '));
}

console.log('\n── Beispiele (erste 12 Treffer) ──');
zeilen.slice(0, 12).forEach((z) =>
  console.log('  ' + z[0].padEnd(34) + ' | ' + z[1].padEnd(22) + ' | '
    + z[2].padEnd(26) + ' | ' + String(z[3]).padStart(5) + ' % | ' + z[4]));

const fehler = unzerlegt;
console.log('\n' + (fehler ? 'NICHT BESTANDEN: ' + fehler + ' Zweige nicht zerlegbar.'
                           : 'Dekoder: alle ' + alleZweige.size + ' Zweige zerlegt.'));
process.exit(fehler ? 1 : 0);
