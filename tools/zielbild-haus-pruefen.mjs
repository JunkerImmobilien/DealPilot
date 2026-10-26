/* tools/zielbild-haus-pruefen.mjs - v2966 · N80 (Marcel 26.10.2026: „ja bitte")
 * Massnahmen am ganzen Haus im MFH-Zielbild: Kosten genau einmal (Flaechenanteile = Hauskosten),
 * Punkte je Gewerk hoechstens einmal (Elektrik 1 neben Leitungen 2 = 2), Gebaeude-Zustand als
 * Ausgangspunkt, § 559 bei „bewohnt", keine Wohnungsmassnahme (Bad) am Haus.
 * Laedt die ECHTE frontend/js/potenzial.js; die Anlage-2-Maxima sind hier als Stub gesetzt.
 * Aufruf: node tools/zielbild-haus-pruefen.mjs   RC=0 sauber */
import fs from 'fs';
import vm from 'vm';
const MAX = { dach: 4, aussenwand: 4, fenster: 2, leitungen: 2, heizung: 2, baeder: 2, innenausbau: 2, grundriss: 2 };
const FELD = {};
const doc = { getElementById: (id) => (id in FELD ? { value: FELD[id] } : null), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], readyState: 'complete',
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} }, body: { appendChild() {} } };
const win = { DpMfhEinheiten: { maxPunkte: (g) => MAX[g] || 2, punkteVon: (g, st) => ({ '0': 0, 'h': MAX[g] / 2 })[st] || 0, punkteObjekt: (g, v) => (v === 'neu' ? MAX[g] : 0) } };
win.window = win; win.document = doc; win.addEventListener = () => {};
const ctx = vm.createContext(Object.assign(win, { console, setTimeout, Promise, JSON, Math, Date, isFinite, parseFloat, String, Number, Array, Object, fetch: undefined }));
vm.runInContext(fs.readFileSync('frontend/js/potenzial.js', 'utf8'), ctx);
const P = win.DpPotenzial;
let fehler = 0; const ist = (n, a, b) => { const ok = Math.abs(a - b) < 1e-6; if (!ok) fehler++; console.log((ok ? 'ok   ' : 'FEHL ') + n + ': ' + a + (ok ? '' : ' statt ' + b)); };
const E = () => [
  { nr: '1', wfl: 60, ist: 400, status: 'vermietet', ziel_qm: 9, massnahmen: [{ id: 'elektrik', t: 'Elektrik', k: 3000 }] },
  { nr: '2', wfl: 90, ist: 600, status: 'vermietet', ziel_qm: 9, massnahmen: [{ id: 'bad', t: 'Bad', k: 12000 }] },
  { nr: '3', wfl: 50, ist: 0, status: 'leer', ziel_qm: 10, massnahmen: [] }];
// ohne Haus
const m0 = P.modell({ einheiten: E(), gebaeude: {} });
ist('ohne Haus: Kosten Zielbild', m0.stufen.zielbild.kosten, 15000);
// mit Haus: Dach 40.000 + Leitungen 10.000
const H = [{ id: 'dach', t: 'Dach', k: 40000 }, { id: 'leitungen', t: 'Leitungen', k: 10000 }];
const m1 = P.modell({ einheiten: E(), gebaeude: {}, haus_massnahmen: H });
ist('mit Haus: Kosten Zielbild = 15.000 + 50.000', m1.stufen.zielbild.kosten, 65000);
ist('Anteil WE1 (60/200)', m1.wohnungen[0].kosten_haus, 15000);
ist('Summe Anteile = Hauskosten', m1.wohnungen.reduce((a, w) => a + w.kosten_haus, 0), 50000);
// Punkte WE1: Elektrik 1 + Leitungen 2 -> Leitungen 2 (nicht 3), Dach 4 => 6
ist('Punkte WE1 (Dach 4 + Leitungen 2, Elektrik nicht zusaetzlich)', m1.wohnungen[0].plus_ziel, 6);
ist('Punkte WE2 (Bad 2 + Dach 4 + Leitungen 2)', m1.wohnungen[1].plus_ziel, 8);
ist('Punkte WE3 (Dach 4 + Leitungen 2)', m1.wohnungen[2].plus_ziel, 6);
ist('Stufe Zielbild plus (flaechengewichtet)', m1.stufen.zielbild.plus, Math.round(((6 * 60 + 8 * 90 + 6 * 50) / 200) * 10) / 10);
// Gebaeude-Zustand halb modernisiert: Dach nur noch 2 Punkte
const m2 = P.modell({ einheiten: E(), gebaeude: { dach: 'h' }, haus_massnahmen: H });
ist('Dach schon halb modernisiert: WE3 nur 2 + 2', m2.wohnungen[2].plus_ziel, 4);
// bewohnt: Mieterhoehung bekommt Kosten und Punkte
const m3 = P.modell({ einheiten: E(), gebaeude: {}, haus_massnahmen: [{ id: 'heizung', t: 'Heizung', k: 20000, bewohnt: true }] });
ist('bewohnt: Kosten Mieterhoehung = Hausanteil der bewohnten', m3.stufen.mieterhoehung ? m3.stufen.mieterhoehung.kosten : -1, 20000);
// Wohnungsmassnahmen zeigen nur die eigenen
ist('WE1 Liste nur eigene Massnahmen', m1.wohnungen[0].massnahmen.length, 1);
// nicht-Haus-Katalog wird ignoriert (Bad am Haus)
const m4 = P.modell({ einheiten: E(), gebaeude: {}, haus_massnahmen: [{ id: 'bad', t: 'Bad', k: 9999 }] });
ist('Bad als Hausmassnahme ignoriert', m4.stufen.zielbild.kosten, 15000);
// Objektfeld sagt Heizung modernisiert (wie Parkstr. 9), Gebaeude-Zustand 0: Heizung bringt nichts mehr
FELD.mod_heizung = 'neu';
const m5 = P.modell({ einheiten: E(), gebaeude: { heizung: '0' }, haus_massnahmen: [{ id: 'heizung', t: 'Heizung', k: 20000 }, { id: 'dach', t: 'Dach', k: 1000 }] });
ist('Objektfeld Heizung modernisiert: WE3 nur Dach 4', m5.wohnungen[2].plus_ziel, 4);
ist('... Kosten zaehlen trotzdem', m5.stufen.zielbild.kosten, 15000 + 21000);
delete FELD.mod_heizung;
console.log(fehler ? fehler + ' Fehler' : 'sauber'); process.exit(fehler ? 1 : 0);
