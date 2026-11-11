#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * offerte-payload-pruefen.mjs — v3295 · Flow Investor, Punkt 2
 *
 * LIEFERT DER SERVER DENSELBEN AUFTRAG WIE DER BROWSER?
 *
 * POST /objects/:id/offerte baut den Auftrag fuer openaiService.analyze()
 * selbst (services/offertePayload.js). Massstab ist der Auftrag aus
 * tools/prompt-lecks-pruefen.mjs: dort steht JEDES Feld, das der Browser
 * (ui.js _buildAIPayload) schickt und das im Prompt ankommt. Dieser Pruefer
 * liest den Auftrag aus der ECHTEN Datei (nicht abgeschrieben) und prueft je
 * Feld, ob der Server es aus einem Objekt fuellt, an dem jedes Quellfeld mit
 * einem erfundenen, unverwechselbaren Wert belegt ist.
 *
 *   P1  Abdeckung: jedes Feld des Browser-Auftrags ist im Server-Auftrag
 *       gefuellt - ausser den bekannten, die es nur im Browser gibt
 *       (OHNE_SERVER, mit Grund). Ein neues fehlendes Feld = RC 1, ein
 *       bekanntes, das jetzt doch kommt = Hinweis, die Liste zu kuerzen.
 *   P2  Die Werte kommen an: die Prueferwerte des Objekts stehen im Prompt
 *       (echte buildPrompt()).
 *   P3  Bestandsmodus: mit _ankauf traegt der Auftrag `ankauf` (daran haengt
 *       _bestandModus in analyze()); ohne nicht.
 *   P4  Kennzahlen = objektRechnung (kp, bmy, cf_m, dscr) an den Demo-Objekten.
 *
 * Aufruf: node tools/offerte-payload-pruefen.mjs     RC 0 = alles gruen
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import Module, { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const origLoad = Module._load;
Module._load = function (req) {
  if (/[\\/]db[\\/]pool(\.js)?$/.test(req) || req === '../db/pool') return { query: async () => { throw new Error('keine DB'); } };
  if (!req.startsWith('.') && !req.startsWith('node:') && !Module.isBuiltin(req) && !path.isAbsolute(req)) {
    try { return origLoad.apply(this, arguments); } catch (e) {
      if (req === 'dotenv') return { config: () => ({ parsed: {} }) };
      const leer = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : leer), apply: () => leer, construct: () => leer });
      return leer;
    }
  }
  return origLoad.apply(this, arguments);
};
const _w = console.warn; console.warn = () => {};
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const OP = require_(path.join(ROOT, 'backend/src/services/offertePayload.js'));
const OR = require_(path.join(ROOT, 'backend/src/services/objektRechnung.js'));
const openai = require_(path.join(ROOT, 'backend/src/services/openaiService.js'));
const flowProfil = require_(path.join(ROOT, 'backend/src/services/flowProfil.js'));
console.warn = _w;

/* Den Browser-Auftrag aus der echten Datei lesen */
const quelle = fs.readFileSync(path.join(ROOT, 'tools/prompt-lecks-pruefen.mjs'), 'utf8');
const a0 = quelle.indexOf('const auftrag = {');
const a1 = quelle.indexOf('\n};', a0);
if (a0 < 0 || a1 < 0) { console.log('Auftrag in prompt-lecks-pruefen.mjs nicht gefunden'); process.exit(2); }
const browserAuftrag = new Function(quelle.slice(a0, a1 + 3) + '\nreturn auftrag;')();

function blaetter(o, p, aus) {
  if (Array.isArray(o)) { o.forEach((x) => blaetter(x, p + '[]', aus)); return aus; }
  if (o && typeof o === 'object') { Object.keys(o).forEach((k) => blaetter(o[k], p ? p + '.' + k : k, aus)); return aus; }
  if (o !== null && o !== undefined && o !== '') aus.add(p);
  return aus;
}

/* Felder, die es nur im Browser gibt (gerechnet in calc.js/anderen Modulen, nicht am Objekt gespeichert) */
const OHNE_SERVER = {
  'steuer.werbungskosten_jahr1': 'Jahresschleife calc.js (State.cfRows)',
  'steuer.wende': 'Jahresschleife calc.js (State.cfRows)',
  'steuer.verlauf': 'Jahresschleife calc.js (State.cfRows)',
  'steuer.ahk_warnung': 'calc.js _dpAhkWarnung',
  'potenzial': 'potenzial.js im Browser (am Objekt nur als _potenzial-Zusammenfassung)',
  'indexmiete': 'indexmiete.js im Browser',
  'bestand': 'DpBestand.payload() im Browser',
  'zustand.restnutzungsdauer_berechnet': 'RND-Assistent (_dpRnd) im Browser',
  'investor_score': 'Investor Deal Score (DS2) rechnet nur der Browser',
  'kennzahlen.em': 'Equity Multiple aus der Exit-Rechnung von calc.js',
  'ankauf.abweichung': 'ankauf.js Abgleich mit dem Live-Stand',
  'aiOptions': 'KI-Stil liegt in den Browser-Einstellungen (Settings)',
  'score_unvollstaendig': 'Vollstaendigkeit des DS2 im Browser',
  'mietentwicklung.einheiten_index': 'MietEntwicklung.einheitenStand() im Browser',
  'mietentwicklung.einheiten_gesamt': 'MietEntwicklung.einheitenStand() im Browser',
  'mietentwicklung.einheiten_mit_plan': 'MietEntwicklung.einheitenStand() im Browser',
  'investor_profil.verkaeufer_druck': 'seit v3059 ausgebaut',
  'investor_profil.marktlage': 'seit v3022 schlank ausgeblendet'
};
/* Im Massstab, aber auch vom Browser NICHT unter diesem Namen gesendet (ui.js schickt d1z_pct/d1t_pct,
   kennzahlen.ek, objart, wohnung.zimmer; buildPrompt liest diese) - kein Server-Mangel, gemeldet. */
const AUCH_BROWSER_NICHT = ['objekt.kaufpreis', 'objekt.objektart', 'objekt.zimmer', 'finanzierung.ek', 'finanzierung.d1z', 'finanzierung.d1t'];
/* Haengt die Route an, wie /ai/analyze (Marktbericht-Dienst) - beide Wege auf dem Server */
const GLEICHER_WEG = ['marktbericht'];
const ohneServer = (p) => Object.keys(OHNE_SERVER).some((k) => p === k || p.startsWith(k + '.') || p.startsWith(k + '['));

/* Ein Objekt, an dem jedes Quellfeld einen erfundenen Wert traegt */
const J = (x) => JSON.stringify(x);
const D = {
  plz: '32609', ort: 'Pruefort', str: 'Pruefstrasse', hnr: '9', objart: 'MFH', wfl: '23456', baujahr: '1968',
  makrolage: 'PRUEF-MAKRO', mikrolage: 'PRUEF-MIKRO', lageklasse: 'B', ds2_bevoelkerung: 'PRUEF-WACHSEND',
  ds2_nachfrage: 'PRUEF-STARK', ds2_wertsteigerung: 'PRUEF-HOCH', ds2_entwicklung: 'PRUEF-BEGRENZT',
  thesis: 'PRUEF-THESE', risiken: 'PRUEF-RISIKO', notizen: 'PRUEF-NOTIZ', wertstg: '1,7', mietstg: '2,3',
  kp: '345.678', nkm: '1.800', ze: '50', d1: '234.567', d1z: '3,9', d1t: '2,1', d1_bindj: '12', anschl_z: '4,4', anschl_t: '1,8', anschl_bj: '2038',
  restschuld: '187.654', ek: '56.789', gest_p: '6,5', notar_p: '1,5', gba_p: '0,5', makler_p: '3,57',
  hg_ul: '3.123', hg_nul: '2.134', grundsteuer: '456', weg_r: '567', eigen_r: '678', mietausfall: '1,9', _bwk_mode: 'detail',
  zve: '87.654', grenz: '41,7', afa_satz: '2,7', afa_rnd_jahre: '43', geb_ant: '73,9', afa_eigen: '3,3',
  san: '47.119', san_ust: 'PRUEF-netto', san_tax_active: true, san_tax_years: '4', afa_sonder7b_aktiv: true,
  _erbpacht: true, erbbauzins: '1.987',
  me_modus: 'detail', mietspiegel: '9,8', leerstand: '2,7', umlagef: '312', me_soll: '11,7', me_anz: '3', me_int: '2', me_pct: '4,3',
  zimmer: '3', bad_anz: '2', etage: 'PRUEF-OG', etagen_ges: '4', garagen: '3', stellpl_aussen: '2', balkon_flae: '17', grundriss: 'PRUEF-GRUNDRISS',
  brw: '345', brw_stichtag: '2026-01-01', gsfl: '987', mea: '12,5', bgf: '654', standardstufe: '3', sachwertfaktor: '1,13', lzs_pct: '3,1', nutzungsart: 'PRUEF-WOHNEN',
  halter: 'PRUEF-HALTER-GMBH', halter_seit: '2019-05-01', kaufdat: '2019-04-01', wirtschaftlicher_uebergang: '2019-06-01', vermstand: 'PRUEF-VOLLVERMIETET',
  mod_dach: 'PRUEF-DACH-NEU', mod_heizung: 'PRUEF-HEIZUNG', mod_fenster: 'PRUEF-FENSTER', mod_baeder: 'PRUEF-BAEDER', ds2_zustand: 'PRUEF-ZUSTAND', ds2_energie: 'PRUEF-ENERGIE', modernis: 'PRUEF-MODERNIS', mod_punkte: '7',
  svwert: '398.765', ds2_marktmiete: '10,9',
  _dp_herkunft: J({ kp: 'PRUEF-HERKUNFT-EXPOSE' }),
  _immometrica_online_since: '2026-09-01',
  _avm_state: J({ avm: { p1: { provider: 'p1', marktwert: 351234, low: 320000, high: 380000, konfidenz: 'PRUEF-KONF' } } }),
  _mb_state: J({ card: { microRaw: 72, macroRaw: 55, trendRaw: 2.4, mw: { med: 362222 }, marktkontext: { x: 'PRUEF-KONTEXT' } } }),
  _dok_auswertung: J({ dokumente: [{ label: 'PRUEF-DOK-TEILUNGSERKLAERUNG', datum: '2020' }],
    auswertung: { risiken: [{ schwere: 'hoch', titel: 'PRUEF-RISIKOTITEL', beschreibung: 'b', kosten_eur: 12345, quelle: 'q' }],
      weg: { kernpunkte: ['PRUEF-WEG-KERN'], ruecklage: '9.999', fazit: 'f' } } }),
  _ankauf: J({ daten: { kp: '1' }, stichtag: '2024-09-29', am: '2024-09-29', korrekturen: [], kurz: 'PRUEF-KENNZAHLEN-DAMALS' }),
  _mfh: J({ einheiten: [
    { nr: 1, wfl: '81,23', ist: '912', art: 'wohnen', status: 'vermietet', lage: 'PRUEFLAGE-EINS', etage: 'PRUEFETAGE', zimmer: '3',
      mv_art: 'PRUEF-STAFFELMIETE', mv_letzte_erhoehung: '2019-07-13', mv_letzte_erhoehung_betrag: '40', mv_naechste_anpassung: '2027-04-19',
      mv_befristet_bis: '2031-11-23', zustand: 'PRUEFZUSTAND-EINHEIT', soll: '975', mv_beginn: '2018-03-01', mv_kuendigungsverzicht_bis: '2029-06-30',
      mv_erhoehung_art: 'PRUEF-STAFFEL', mv_erhoehung_wert: '43', mv_rhythmus_jahre: '2', mv_stufen_offen: '3', massnahme: 'PRUEF-BAD-ERNEUERN', kosten: '28.456' },
    { nr: 2, wfl: '81,24', ist: '913', art: 'gewerbe', status: 'leer', mv_art: 'PRUEF-INDEXMIETE' }],
    aufgeteilt: true, gnd: 77, stand: '2026-10-12', gebaeude: { dach: 'v', heizung: 'h' } })
};
const profil = flowProfil.profilAus({ keys: { dp_investment_profile: J({ min_dscr: 1.3, min_cashflow_vor_st: 50, max_ltv: 85, ai_strat: 'PRUEF-STRATEGIE', ai_risk: 'PRUEF-RISIKONEIGUNG' }) } }, null, []);
const erg = { vorhanden: { d1z: D.d1z, d1t: D.d1t, gest_p: D.gest_p, notar_p: D.notar_p, gba_p: D.gba_p, makler_p: D.makler_p }, vom_nutzer: {}, vorschlag: {}, fehlt: [] };
const R = OR.rechnen(D, { erg: erg, gespeichert: { dealscore: null } });
const P = OP.bauen(D, R, { S: R.S, profil: profil, objId: 'x' });
delete P.objId;
P.marktbericht = { anzahl: 1, aktuell: { report_id: 1 } };   /* haengt die Route aus dem Marktbericht-Dienst an */

let fehler = 0, n = 0;
const pruef = (name, ok, ist) => { n++; if (!ok) { fehler++; console.log('  \x1b[31mROT\x1b[0m ' + name + (ist !== undefined ? '  ' + JSON.stringify(ist).slice(0, 400) : '')); } };

/* P1 */
const soll = blaetter(browserAuftrag, '', new Set());
const ist = blaetter(P, '', new Set());
const istHat = (p) => ist.has(p) || [...ist].some((q) => q.startsWith(p + '.'));   /* herkunft: Text im Massstab, Objekt im Browser */
const fehlt = [...soll].filter((p) => !istHat(p) && !GLEICHER_WEG.some((g) => p === g || p.startsWith(g + '.')) && AUCH_BROWSER_NICHT.indexOf(p) < 0);
const auchNicht = [...soll].filter((p) => AUCH_BROWSER_NICHT.indexOf(p) >= 0 && !istHat(p));
const unbekanntFehlt = fehlt.filter((p) => !ohneServer(p));
const bekanntFehlt = fehlt.filter((p) => ohneServer(p));
const bekanntDa = Object.keys(OHNE_SERVER).filter((k) => [...ist].some((p) => p === k || p.startsWith(k + '.') || p.startsWith(k + '[')));
console.log('Offerte-Auftrag Server gegen Browser (Massstab: Auftrag aus tools/prompt-lecks-pruefen.mjs)');
console.log('  P1 ' + soll.size + ' Felder im Browser-Auftrag · Server fuellt ' + (soll.size - fehlt.length)
  + ' · nur im Browser ' + bekanntFehlt.length + ' · unbekannt fehlend ' + unbekanntFehlt.length);
pruef('P1 kein unbekannt fehlendes Feld', unbekanntFehlt.length === 0, unbekanntFehlt.length);
if (unbekanntFehlt.length) console.log('     fehlt: ' + unbekanntFehlt.join(' '));
console.log('     nur im Browser (Grund): ' + [...new Set(bekanntFehlt.map((p) => Object.keys(OHNE_SERVER).find((k) => p === k || p.startsWith(k + '.') || p.startsWith(k + '['))))]
  .map((k) => k + ' (' + OHNE_SERVER[k] + ')').join('; '));
console.log('     im Massstab, vom Browser unter diesem Namen auch nicht gesendet: ' + auchNicht.join(', '));
if (bekanntDa.length) console.log('     Hinweis: kommt jetzt doch vom Server, aus OHNE_SERVER streichen: ' + bekanntDa.join(', '));

/* P2 */
const prompt = openai.buildPrompt(P, {});
const werte = ['PRUEF-THESE', 'PRUEF-MAKRO', 'PRUEFLAGE-EINS', 'PRUEF-STAFFELMIETE', 'PRUEF-BAD-ERNEUERN', 'PRUEF-HALTER-GMBH', 'PRUEF-GRUNDRISS',
  'PRUEF-DACH-NEU', 'PRUEF-RISIKOTITEL', 'PRUEF-WEG-KERN', 'PRUEF-DOK-TEILUNGSERKLAERUNG', 'PRUEF-KENNZAHLEN-DAMALS', 'PRUEF-STRATEGIE',
  'PRUEF-VOLLVERMIETET', 'PRUEF-WOHNEN', 'PRUEF-netto', '345.678', '87.654', '47.119', '1.987'];
const fehltImPrompt = werte.filter((w) => prompt.indexOf(w) < 0);
pruef('P2 Prueferwerte stehen im Prompt (' + werte.length + ')', fehltImPrompt.length === 0, fehltImPrompt);

/* P3 */
pruef('P3 mit _ankauf: Block ankauf (Bestandsmodus)', P.ankauf && P.ankauf.kennzahlen_damals === 'PRUEF-KENNZAHLEN-DAMALS', P.ankauf);
const ohneAnkauf = Object.assign({}, D); delete ohneAnkauf._ankauf;
pruef('P3 ohne _ankauf: kein Block ankauf', OP.bauen(ohneAnkauf, R, {}).ankauf === null);

/* P4 */
const demo = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/src/db/demo-object.json'), 'utf8')).data;
const ergD = { vorhanden: {}, vom_nutzer: {}, vorschlag: {}, fehlt: [] };
['d1z', 'd1t', 'gest_p', 'notar_p', 'gba_p', 'makler_p'].forEach((k) => { if (demo[k] != null && demo[k] !== '') ergD.vorhanden[k] = demo[k]; });
const RD = OR.rechnen(demo, { erg: ergD, gespeichert: { dealscore: 77 } });
const PD = OP.bauen(demo, RD, { S: RD.S });
pruef('P4 Kennzahlen aus objektRechnung', PD.kennzahlen.kp === RD.kp && PD.kennzahlen.bmy === RD.K.bmy && PD.kennzahlen.cf_m === RD.K.cf_m && PD.kennzahlen.dscr === RD.K.dscr, PD.kennzahlen);
let promptDemo = '';
try { promptDemo = openai.buildPrompt(PD, {}); } catch (e) { promptDemo = 'FEHLER ' + e.message; }
pruef('P4 buildPrompt laeuft am Rundgang-Objekt', promptDemo.length > 2000 && promptDemo.indexOf('180.000') >= 0, promptDemo.slice(0, 200));

console.log('offerte-payload-pruefen: ' + (n - fehler) + ' von ' + n + ' gruen · Prompt ' + prompt.length + ' Zeichen');
console.log(fehler ? '\x1b[31mRC=1\x1b[0m' : '\x1b[32mRC=0\x1b[0m');
process.exit(fehler ? 1 : 0);
