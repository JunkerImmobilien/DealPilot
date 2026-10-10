/* v2073 · Prueft die ECHTE rnd-calc.js mit den ECHTEN Objekten aus dem
   Portfolio-Export. Kein Nachbau, keine Fixture - sonst messe ich mich
   selbst (Memory: pruefer-der-sich-selbst-misst). */
import fs from 'fs';
import vm from 'vm';

const KERN = './frontend/js/rnd-calc.js';
const TAB = './frontend/js/rnd-gnd-table.js';
const EXPORT = (process.argv[2] || './Dateien/API-Export/portfolio-20261010-1045.json');

const ctx = { window: {}, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(TAB, 'utf8'), ctx);
vm.runInContext(fs.readFileSync(KERN, 'utf8'), ctx);
const RND = ctx.window.DealPilotRND;
if (!RND) { console.error('FEHLER: Kern nicht geladen'); process.exit(1); }

let fehler = 0;
const pruef = (name, ist, soll, cmp) => {
  const ok = cmp ? cmp(ist, soll) : ist === soll;
  if (!ok) { fehler++; console.log('  FEHLT  ' + name + ': ist ' + JSON.stringify(ist) + ', soll ' + JSON.stringify(soll)); }
  else console.log('  ok     ' + name + ' = ' + JSON.stringify(ist));
  return ok;
};

console.log('Kern geladen, VERSION ' + RND.VERSION);
console.log('Neue Exporte vorhanden: ' +
  ['punkteAusMod', 'istKernsaniert', 'gndAusObjektTyp', 'MOD_MAX']
    .map(k => k + '=' + (typeof RND[k])).join(', '));

/* ═══ 1 · Die drei Ableitungen einzeln ═══ */
console.log('\n=== 1 · gndAusObjektTyp (Marcels Festlegung: ETW/MFH = 80) ===');
pruef('ETW', RND.gndAusObjektTyp('ETW'), 80);
pruef('Eigentumswohnung', RND.gndAusObjektTyp('Eigentumswohnung'), 80);
pruef('MFH', RND.gndAusObjektTyp('MFH'), 80);
pruef('EFH', RND.gndAusObjektTyp('EFH'), 80);
pruef('Buerogebaeude', RND.gndAusObjektTyp('Bürogebäude'), 60);
pruef('Hotel', RND.gndAusObjektTyp('Hotel'), 40);
pruef('leer -> 80', RND.gndAusObjektTyp(''), 80);

console.log('\n=== 2 · punkteAusMod ===');
const modVoll = { dach: '< 5 Jahre', fenster: '< 5 Jahre', leitungen: '< 5 Jahre',
  heizung: '< 5 Jahre', aussenwand: '< 5 Jahre', baeder: '< 5 Jahre',
  innenausbau: '< 5 Jahre', grundriss: '< 5 Jahre' };
pruef('alles frisch = 20', RND.punkteAusMod(modVoll).total, 20);
pruef('leer = 0', RND.punkteAusMod({}).total, 0);
pruef('nur Dach frisch = 4', RND.punkteAusMod({ dach: '< 5 Jahre' }).total, 4);
pruef('Dach 5-10 J = 3', RND.punkteAusMod({ dach: '5 - 10 Jahre' }).total, 3);
pruef('Dach 10-20 J = 2', RND.punkteAusMod({ dach: '10 - 20 Jahre' }).total, 2);
pruef('Dach >20 J = 0', RND.punkteAusMod({ dach: '> 20 Jahre' }).total, 0);
pruef('Kernsanierung erkannt', RND.istKernsaniert({ dach: 'Kernsanierung' }), true);
pruef('keine Kernsanierung', RND.istKernsaniert({ dach: '< 5 Jahre' }), false);

/* Gegenprobe: identisch mit der Wizard-Fassung? */
const wz = fs.readFileSync('./frontend/js/rnd-wizard.js', 'utf8');
const mWz = wz.match(/const max = \{[^}]+\}/);
console.log('\n  Wizard-Hoechstpunkte: ' + (mWz ? mWz[0].replace(/\s+/g, ' ') : 'nicht gefunden'));
console.log('  Kern-Hoechstpunkte:   ' + JSON.stringify(RND.MOD_MAX));

/* ═══ 3 · Das echte Objekt 2026-001 ═══ */
console.log('\n=== 3 · Objekt 2026-001 (ETW, Bj 1962, mod_punkte 11) ===');
const exp = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
const o = exp.objekte.find(x => x.nummer === '2026-001');
if (!o) { console.error('Objekt nicht im Export'); process.exit(1); }
console.log('  Rohdaten: baujahr=' + o.daten.baujahr + ' objart=' + o.daten.objart
  + ' mod_punkte=' + o.daten.mod_punkte + ' kaufdat=' + o.daten.kaufdat);

const vorher = { gnd: 70, modPoints: 0, stichtag: o.daten.kaufdat };
const m = RND.mapDealPilotObject(o.daten);
console.log('\n  Abbildung JETZT:');
pruef('gnd', m.gnd, 80);
pruef('modPoints', m.modPoints, 11);
pruef('kernsaniert gesetzt', typeof m.kernsaniert, 'boolean');
pruef('stichtag != Kaufdatum', m.stichtag !== o.daten.kaufdat, true);
console.log('  stichtag        = ' + m.stichtag + '   (' + m.stichtag_herkunft + ')');
console.log('  gnd_herkunft    = ' + m.gnd_herkunft);
console.log('  modPoints_herk. = ' + m.modPoints_herkunft);
console.log('  vorher waere es gewesen: gnd=' + vorher.gnd + ' modPoints=' + vorher.modPoints
  + ' stichtag=' + vorher.stichtag);

console.log('\n  Ergebnis mit der reparierten Eingabe:');
const r = RND.calcAll(m);
console.log('  final_rnd    = ' + r.final_rnd + '   (' + r.final_source + ')');
console.log('  verfahren    = ' + r.verfahren);
console.log('  Punktraster  = ' + (r.methods.punktraster ? r.methods.punktraster.restnutzungsdauer : '-'));
console.log('  pruefung     = ' + JSON.stringify(r.pruefung));

/* Gegenprobe: mit den ALTEN Defaults */
const rAlt = RND.calcAll(Object.assign({}, m, { gnd: 70, modPoints: 0, stichtag: o.daten.kaufdat }));
console.log('  >> mit den alten Defaults waere es: ' + rAlt.final_rnd
  + ' (' + rAlt.verfahren + ')  --  Unterschied ' + (r.final_rnd - rAlt.final_rnd).toFixed(1) + ' Jahre');

/* ═══ 4 · AfA-Zweck: Stichtag = wirtschaftlicher Uebergang ═══ */
console.log('\n=== 4 · zweck "afa" nimmt den wirtschaftlichen Uebergang ===');
const mAfa = RND.mapDealPilotObject(o.daten, { zweck: 'afa' });
console.log('  stichtag = ' + mAfa.stichtag + '  (' + mAfa.stichtag_herkunft + ')');
const mFest = RND.mapDealPilotObject(o.daten, { stichtag: '2024-01-01' });
pruef('ausdruecklicher Stichtag gewinnt', mFest.stichtag, '2024-01-01');
const mGnd = RND.mapDealPilotObject(o.daten, { gnd: 70 });
pruef('ausdrueckliche GND gewinnt', mGnd.gnd, 70);

/* ═══ 5 · Alter >= GND: Basis 0, Pruefung erzwungen, KEINE Extrapolation ═══ */
console.log('\n=== 5 · Alter >= GND (Marcels Punkte 3 und 4) ===');
for (const bj of [1930, 1900]) {
  const rr = RND.calcAll({ baujahr: bj, stichtag: '2026-10-10', gnd: 80, modPoints: 11,
    gewerkeBewertung: {}, schaeden: [] });
  console.log('  Bj ' + bj + ' (Alter ' + (2026 - bj) + '): final=' + rr.final_rnd
    + ' | gesperrt=' + rr.pruefung.uebernahme_gesperrt
    + ' | grund=' + rr.pruefung.grund);
  if (rr.final_rnd !== 0) { fehler++; console.log('    FEHLT: sollte 0 sein (keine Extrapolation)'); }
  if (!rr.pruefung.erforderlich) { fehler++; console.log('    FEHLT: Pruefung muss erforderlich sein'); }
  if (!rr.pruefung.uebernahme_gesperrt) { fehler++; console.log('    FEHLT: Uebernahme muss gesperrt sein'); }
}
/* Die Sperre loest sich mit einer dokumentierten reellen RND */
const rReell = RND.calcAll({ baujahr: 1900, stichtag: '2026-10-10', gnd: 80, modPoints: 11,
  gewerkeBewertung: {}, schaeden: [], reelleRND: 25 });
pruef('reelle RND loest die Sperre', rReell.pruefung.uebernahme_gesperrt, false);
pruef('reelle RND wird uebernommen', rReell.final_rnd, 25);

/* ═══ 6 · Punkt 5: die beiden verbotenen Behauptungen ═══ */
console.log('\n=== 6 · Verbotene Formulierungen (Marcels Punkt 5) ===');
const quell = fs.readFileSync(KERN, 'utf8');
const ohneKomm = quell.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
pruef('"Anlage 2 nicht anwendbar" raus (Nutztext)', /Anlage 2 nicht anwendbar/.test(ohneKomm), false);
pruef('"nicht anwendbar" als finalSource raus', /finalSource = [^;]*nicht anwendbar/.test(ohneKomm), false);
pruef('30-%-Anker bleibt', /unter_30_prozent/.test(ohneKomm), true);
pruef('185 BewG bleibt', /185 Abs\. 3/.test(quell), true);

/* ═══ 7 · Alle Objekte: wie viele aendern sich? ═══ */
console.log('\n=== 7 · Alle 23 Objekte: Wirkung der Reparatur ===');
let geaendert = 0, gleich = 0, punkteJetzt = 0, gnd80 = 0;
const zeilen = [];
for (const ob of exp.objekte) {
  if (!ob.daten || !ob.daten.baujahr) continue;
  const mm = RND.mapDealPilotObject(ob.daten);
  const neu = RND.calcAll(mm);
  const alt = RND.calcAll(Object.assign({}, mm, { gnd: 70, modPoints: 0, stichtag: ob.daten.kaufdat }));
  if (mm.modPoints > 0) punkteJetzt++;
  if (mm.gnd === 80) gnd80++;
  if (Math.abs(neu.final_rnd - alt.final_rnd) > 0.05) {
    geaendert++;
    zeilen.push([ob.nummer, ob.daten.baujahr, mm.modPoints, mm.gnd,
      alt.final_rnd.toFixed(1), neu.final_rnd.toFixed(1),
      (neu.final_rnd - alt.final_rnd).toFixed(1), neu.pruefung.erforderlich ? 'Pruefung' : '']);
  } else gleich++;
}
console.log('Nr        | Bj   | Pkt | GND | alt    | neu    | Diff   | Hinweis');
for (const z of zeilen) console.log(
  String(z[0]).padEnd(9) + ' | ' + String(z[1]).padEnd(4) + ' | ' + String(z[2]).padStart(3)
  + ' | ' + String(z[3]).padStart(3) + ' | ' + String(z[4]).padStart(6) + ' | '
  + String(z[5]).padStart(6) + ' | ' + String(z[6]).padStart(6) + ' | ' + z[7]);
console.log('\nObjekte mit Punkten > 0: ' + punkteJetzt + ' | mit GND 80: ' + gnd80
  + ' | Ergebnis geaendert: ' + geaendert + ' | unveraendert: ' + gleich);

console.log('\n-- Abschnitte 1-7: ' + (fehler === 0 ? 'bestanden' : fehler + ' Abweichung(en)') + ', weiter mit 8 --');
/* v2074: HIER STAND process.exit(). Es hat Abschnitt 8 nie erreicht -
   der Pruefer meldete RC=0, ohne die neuen Punkte zu pruefen. Ein
   Pruefer, der vor seinem letzten Abschnitt aussteigt, ist der
   gefaehrlichste: er sagt gruen. */

/* ═══ 8 · v2074 · Reihenfolge und Zeitgemaessheit ═══════════════════════
   Marcels Festlegung vom 10.10.2026: das Anlage-2-Modell rechnet, die
   Technik prueft, der Sachverstaendige entscheidet. Und: Zeitgemaessheit
   wirkt ueber die PUNKTE, nicht als Aufschlag auf die technische RND. */
console.log('\n=== 8 · v2074 · Reihenfolge und Zeitgemaessheit ===');
const alleGrade = (g) => Object.fromEntries(RND.GEWERKE.map(x => [x.id, g]));

/* a) Zeitgemaess darf die Basis NICHT ueberschreiten */
for (const [alter, gnd] of [[10, 80], [28, 80], [48, 80]]) {
  const basis = gnd - alter;
  const t = RND.calcTechnisch(alter, gnd, alleGrade('standard'), null, null);
  pruef('zeitgemaess(Alter ' + alter + ') = Basis ' + basis, t.restnutzungsdauer, basis);
  if (t.alterswertminderung_pct <= 0) {
    fehler++; console.log('  FEHLT  AWM ist 0 % bei Alter ' + alter + ' - das ist kein Ergebnis');
  }
}

/* b) Fehlende Angabe ist nicht "zeitgemaess" und gibt keinen Aufschlag */
const leer = RND.calcTechnisch(28, 80, {}, null, null);
pruef('ohne Angabe = Basis 52', leer.restnutzungsdauer, 52);
pruef('unbewertet wird ausgewiesen', leer.anteil_unbewertet_pct, 100);

/* c) Der Deckel 0,90 x GND */
const hoch = RND.calcTechnisch(5, 80, alleGrade('gehoben'), null, null);
if (hoch.restnutzungsdauer > 80 * 0.90 + 0.01) {
  fehler++; console.log('  FEHLT  Deckel 0,90 x GND greift nicht: ' + hoch.restnutzungsdauer);
} else console.log('  ok     Deckel 0,90 x GND = ' + hoch.restnutzungsdauer + ' (max 72)');

/* d) Liegt ein Modellergebnis vor, traegt es - nicht die Technik */
const rMod = RND.calcAll({ baujahr: 1962, stichtag: '2026-10-10', gnd: 80, modPoints: 11,
  gewerkeBewertung: alleGrade('veraltet'), schaeden: [] });
pruef('Modell traegt den Endwert', rMod.verfahren, 'punktraster');
if (rMod.methods.technisch == null) { fehler++; console.log('  FEHLT  technisch muss erhalten bleiben'); }
else console.log('  ok     technisch bleibt ausgewiesen = ' + rMod.methods.technisch.restnutzungsdauer);
const abwGrenze = (rMod.grenzen || []).find(g => g.art === 'technik_weicht_ab');
console.log('  ' + (abwGrenze ? 'ok     ' : 'Hinweis') + ' Abweichungs-Grenze '
  + (abwGrenze ? 'gemeldet' : 'nicht gemeldet (Abweichung unter 20 %)'));

/* e) Die verbotene Reihenfolge-Formulierung darf nicht zurueckkehren */
const q2 = fs.readFileSync(KERN, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
pruef('"technische ... (vorrangig)" raus', /technische Alterswertminderung \(vorrangig\)/.test(q2), false);
pruef('aufschlagStandard ist 0', /aufschlagStandard = 0/.test(q2), true);


/* ═══ 9 · v2075 · Eine Punktevergabe fuer alle Aufrufer ════════════════
   Vier Stellen vergaben Anlage-2-Punkte: Wizard, Kern, BMF-Rechner und
   deal-action aus `sanstand`. Der Kern vergibt sie jetzt. */
console.log('\n=== 9 · v2075 · Punktevergabe und Doppelungen ===');

/* a) MOD_MAX ist aus MOD_ELEMENTS abgeleitet, keine zweite Liste */
let maxAbw = 0;
RND.MOD_ELEMENTS.forEach(e => { if (RND.MOD_MAX[e.id] !== e.max) maxAbw++; });
pruef('MOD_MAX == MOD_ELEMENTS[].max', maxAbw, 0);
pruef('Summe der Hoechstpunkte', Object.values(RND.MOD_MAX).reduce((a, b) => a + b, 0), 20);

/* b) ja/teilweise/nein nach Anlage 2, nicht pauschal 2 */
const IDS = Object.keys(RND.MOD_MAX);
const alleJTN = (v) => Object.fromEntries(IDS.map(i => [i, v]));
pruef('alles "ja" = 20 (nicht 16)', RND.punkteAusJaTeilNein(alleJTN('ja')).total, 20);
pruef('alles "nein" = 0', RND.punkteAusJaTeilNein(alleJTN('nein')).total, 0);
pruef('nur Dach "ja" = 4 (nicht 2)', RND.punkteAusJaTeilNein({ dach: 'ja' }).total, 4);
pruef('nur Aussenwand "ja" = 4', RND.punkteAusJaTeilNein({ aussenwand: 'ja' }).total, 4);
pruef('nur Fenster "ja" = 2', RND.punkteAusJaTeilNein({ fenster: 'ja' }).total, 2);
pruef('Dach "teilweise" = 2', RND.punkteAusJaTeilNein({ dach: 'teil' }).total, 2);
pruef('bewertet wird gezaehlt', RND.punkteAusJaTeilNein({ dach: 'ja', fenster: 'nein' }).bewertet, 1);
pruef('leer -> 0 bewertet', RND.punkteAusJaTeilNein({}).bewertet, 0);

/* c) Beide Formate muessen bei gleicher Aussage gleich viel ergeben */
const vollZeit = Object.fromEntries(IDS.map(i => [i, '< 5 Jahre']));
pruef('Zeitstufen und ja/nein stimmen ueberein',
  RND.punkteAusMod(vollZeit).total, RND.punkteAusJaTeilNein(alleJTN('ja')).total);

/* d) Kein Aufrufer vergibt noch selbst Punkte */
const nutztext = (pfad) => fs.readFileSync(pfad, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const bmf = nutztext('./frontend/js/bmf-bodenabschlag.js');
pruef('bmf: kein "punkte += 2" mehr', /punkte \+= 2/.test(bmf), false);
pruef('bmf: nutzt punkteAusJaTeilNein', /punkteAusJaTeilNein/.test(bmf), true);
const da = nutztext('./frontend/js/deal-action.js');
pruef('deal-action: modPoints nicht direkt aus sanstand', /modPoints: sanstand/.test(da), false);
pruef('deal-action: liest die mod_*-Felder', /punkteAusMod/.test(da), true);
pruef('mfh-einheiten: nutzt MOD_ELEMENTS',
  /MOD_ELEMENTS/.test(fs.readFileSync('./frontend/js/mfh-einheiten.js', 'utf8')), true);


/* ═══ 10 · v2080 · Die drei Funde des zweiten Chats ════════════════════
   Gemeldet am 10.10.2026, hier nachgemessen - zwei davon schwerer als
   gemeldet. */
console.log('\n=== 10 · v2080 · Robustheit und Zustands-Rueckfall ===');

/* a) Zahlen in Textfeldern duerfen die Abbildung nicht abstuerzen lassen.
      Gemeldet war die PLZ; `ort` traf es genauso. */
const basis = { baujahr: 1962, objart: 'ETW', wfl: 100, str: 'X', hnr: '1', plz: '12345', ort: 'Y' };
for (const [feld, wert] of [['plz', 32609], ['ort', 123], ['str', 5], ['hnr', 9],
                            ['plz', 0], ['ort', false], ['str', null]]) {
  const d = Object.assign({}, basis); d[feld] = wert;
  let ok = true, msg = '';
  try { RND.mapDealPilotObject(d); } catch (e) { ok = false; msg = e.message; }
  if (!ok) { fehler++; console.log('  FEHLT  ' + feld + '=' + JSON.stringify(wert) + ' stuerzt ab: ' + msg); }
  else console.log('  ok     ' + feld + '=' + JSON.stringify(wert) + ' -> kein Absturz');
}

/* b) Der Zustands-Rueckfall muss die ECHTEN Formular-Optionen treffen.
      Vorher ergaben alle fuenf "standard" - das Feld war wirkungslos. */
const ECHTE_ZUSTAENDE = [
  ['Neubau / kernsaniert', 'gehoben'],
  ['Guter Zustand', 'standard'],
  ['Normaler Zustand', 'standard'],
  ['Renovierungsbedürftig', 'veraltet'],
  ['Stark sanierungsbedürftig', 'veraltet']
];
for (const [wert, soll] of ECHTE_ZUSTAENDE) {
  const m = RND.mapDealPilotObject({ baujahr: 1962, objart: 'ETW', wfl: 100,
    plz: '32609', ort: 'X', ds2_zustand: wert });
  const grade = [...new Set(Object.values(m.gewerkeBewertung || {}))];
  const ist = grade.length === 1 ? grade[0] : grade.join('+');
  pruef('Zustand "' + wert + '"', ist, soll);
}
/* Gegenprobe: die Optionen stehen wirklich so im Formular */
const htmlQ = fs.readFileSync('./frontend/index.html', 'utf8');
const sel = htmlQ.match(/id="ds2_zustand"[\s\S]{0,900}?<\/select>/);
if (!sel) { fehler++; console.log('  FEHLT  ds2_zustand nicht in index.html gefunden'); }
else {
  const opts = [...sel[0].matchAll(/<option[^>]*>([^<]*)<\/option>/g)]
    .map(x => x[1].trim()).filter(t => t && !/bitte w/i.test(t));
  const fehlend = opts.filter(o => !ECHTE_ZUSTAENDE.some(([w]) => w === o));
  if (fehlend.length) {
    fehler++;
    console.log('  FEHLT  Formular-Optionen ohne Pruefung: ' + JSON.stringify(fehlend));
    console.log('         -> der Rueckfall kennt sie nicht, sie ergeben "standard"');
  } else console.log('  ok     alle ' + opts.length + ' Formular-Optionen sind geprueft');
}

/* c) Kein Aktenzeichen als Scheinquelle fuer die Schadens-Abschlaege */
const kernQ = fs.readFileSync(KERN, 'utf8');
const nutz = kernQ.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
pruef('BFH-Zitat nicht im Nutztext', /IX R 7\/12/.test(nutz), false);
const katalogZeile = kernQ.split('\n').findIndex(l => /Schadens-Katalog mit orientierenden/.test(l));
if (katalogZeile >= 0) {
  const umfeld = kernQ.split('\n').slice(Math.max(0, katalogZeile - 2), katalogZeile + 2).join(' ');
  pruef('Katalog-Zeile nennt kein Aktenzeichen', /IX R \d+\/\d+/.test(umfeld), false);
}

console.log('\n' + (fehler === 0 ? 'GESAMT RC=0' : 'GESAMT RC=1 - ' + fehler + ' Abweichung(en)'));
process.exit(fehler === 0 ? 0 : 1);
