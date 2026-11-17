#!/usr/bin/env node
/* tools/modernisierung-ableiten-pruefen.mjs — v3660
 *
 * Prueft die Rangfolge der Modernisierungspunkte fuer die Restnutzungsdauer
 * (frontend/js/modernisierung-herkunft.js) und ihre Anschluesse:
 *   A  Rueckfall nach Alter und Energieklasse (mittel = 8, ab 30 Jahren)
 *   B  Rangfolge: eigene Angabe > Zustand (eigene) > Ableitung > Rueckfall
 *   C  Textableitung an erfundenen Exposé-Saetzen (keine echten Adressen)
 *   D  Kombination Text + Bild je Gewerk, Widerspruch, Untergrenze
 *   E  Kette mb-Backend: lib/rnd-einheitlich.js rechnet mit dem Rueckfall
 *   F  Kette App/Backend: rnd-calc.js mapDealPilotObject() fragt die Rangfolge
 *   G  KI-Belege: _modernisierungenNorm (openaiService.js) verwirft Zitate,
 *      die nicht im Text stehen
 *   H  Spiegel: mb-Kopie Byte fuer Byte gleich der Quelle
 *   Z  Gegenprobe: ohne Rangfolge (alte Vorbelegung 0) faellt die RND - der
 *      Pruefer sieht den Unterschied
 * RC 0 = sauber.  Aufruf: node tools/modernisierung-ableiten-pruefen.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const QUELLE = path.join(WURZEL, 'frontend/js/modernisierung-herkunft.js');
const M = require(QUELLE);
let rot = 0, gruen = 0;
const ok = (b, t, ist) => { if (b) { gruen++; } else { rot++; console.log('  ROT  ' + t + (ist !== undefined ? '  -> ' + JSON.stringify(ist) : '')); } };
const kopf = (t) => console.log('\n' + t);

kopf('A  Rueckfall nach Alter und Energieklasse');
ok(M.bestimmen({ baujahr: 1956, stichtag_jahr: 2026 }).punkte === 8, 'A1 1956 ohne Angabe -> 8 (Mitte „mittel" 6-10)');
ok(M.bestimmen({ baujahr: 1956, stichtag_jahr: 2026 }).herkunft === 'rueckfall_mittel', 'A2 Herkunft rueckfall_mittel');
ok(M.bestimmen({ baujahr: 2001, stichtag_jahr: 2026 }).punkte === 0, 'A3 juenger als 30 Jahre -> 0');
ok(M.bestimmen({ baujahr: 1996, stichtag_jahr: 2026 }).punkte === 8, 'A4 genau 30 Jahre -> 8');
ok(M.bestimmen({ baujahr: 1956, stichtag_jahr: 2026, energieklasse: 'B' }).punkte === 12, 'A5 Klasse B vor 1995 -> 12');
ok(M.bestimmen({ baujahr: 1956, stichtag_jahr: 2026, energieklasse: 'A+' }).punkte === 12, 'A6 Klasse A+ -> 12');
ok(M.bestimmen({ baujahr: 1956, stichtag_jahr: 2026, energieklasse: 'E' }).punkte === 8, 'A7 Klasse E -> 8 (unveraendert)');
ok(M.bestimmen({ baujahr: 1956, stichtag_jahr: 2026, energieklasse: 'G' }).punkte === 6, 'A8 Klasse G -> 6');
ok(M.bestimmen({ baujahr: 1995, stichtag_jahr: 2026, energieklasse: 'G' }).punkte === 8, 'A9 Baujahr 1995: Klasse sagt nichts -> 8');
ok(/angenommen/.test(M.bestimmen({ baujahr: 1956, stichtag_jahr: 2026 }).satz), 'A10 Satz sagt „angenommen"');
ok(/genauer/.test(M.bestimmen({ baujahr: 1956, stichtag_jahr: 2026 }).satz), 'A11 Satz verweist auf eigene Angaben');
ok(M.bestimmen({}).punkte === 8, 'A12 ohne Baujahr -> 8 (Alter unbekannt, Modernisierung typisch nicht ausschliessbar)');

kopf('B  Rangfolge');
ok(M.bestimmen({ mod_punkte: 5, baujahr: 1956 }).punkte === 5 && M.bestimmen({ mod_punkte: 5 }).herkunft === 'eigene', 'B1 eigene Punkte 5 gelten');
ok(M.bestimmen({ mod_punkte: 0, mod_punkte_herkunft: 'eigene_angabe', baujahr: 1956 }).punkte === 0, 'B2 eigene 0 („nicht modernisiert") gilt');
ok(M.bestimmen({ mod_punkte: 0, mod_angaben: 3, baujahr: 1956 }).punkte === 0, 'B3 0 mit beantworteten Gewerken gilt');
ok(M.bestimmen({ mod_punkte: 0, baujahr: 1956 }).punkte === 8, 'B4 0 ohne Kennung und ohne Gewerke = alte Vorbelegung -> Rueckfall');
ok(M.bestimmen({ zustand: 'gut', baujahr: 1956 }).punkte === 14, 'B5 Zustand gut -> 14');
ok(M.bestimmen({ zustand: 'normal', baujahr: 1956 }).punkte === 8, 'B6 Zustand mittel -> 8');
ok(M.bestimmen({ zustand: 'stark_sanierungsbeduerftig', baujahr: 1956 }).punkte === 0, 'B7 sanierungsbeduerftig -> 0');
ok(M.bestimmen({ zustand: 'gut', baujahr: 2010 }).punkte === 0, 'B8 Zustand bei jungem Gebaeude -> 0');
const abl = { punkte: 11, gewerke: { dach: { punkte: 4, quelle: 'text' } }, kurz: 'aus dem Exposé-Text abgeleitet', quellen: ['text'] };
ok(M.bestimmen({ zustand: 'gut', zustand_quelle: 'bilder', ableitung: abl, baujahr: 1956 }).punkte === 11, 'B9 abgeleiteter Zustand zaehlt nicht als eigene Angabe, die Ableitung gilt');
ok(M.bestimmen({ zustand: 'normal', ableitung: abl, baujahr: 1956 }).punkte === 8, 'B10 eigener Zustand schlaegt die Ableitung');
ok(M.bestimmen({ mod_punkte: 3, ableitung: abl }).punkte === 3, 'B11 eigene Punkte schlagen alles');
ok(M.bestimmen({ ableitung: abl, baujahr: 1956 }).stufe === 2, 'B12 Ableitung = Stufe 2');

kopf('C  Textableitung (erfundene Saetze)');
const T1 = 'Das Mehrfamilienhaus wurde laufend instand gehalten. Die Fassade erhielt ein Wärmedämmverbundsystem (WDVS). '
  + 'Das Dach wurde gedämmt. Beheizt wird über eine Gas-Brennwertheizung. Mehrere Wohnungen wurden in den letzten Jahren modernisiert. '
  + 'Gepflegter Zustand.';
const l1 = M.ausText(T1, { stichtag_jahr: 2026 });
const hat = (l, g, art, r) => l.some((x) => x.gewerk === g && (!art || x.art === art) && (!r || x.richtung === r));
ok(hat(l1, 'aussenwand', 'konkret', 'positiv'), 'C1 WDVS -> Aussenwand positiv', l1);
ok(hat(l1, 'dach', 'konkret', 'positiv'), 'C2 Dach gedaemmt -> Dach positiv');
ok(hat(l1, 'heizung', 'konkret', 'positiv'), 'C3 Brennwert -> Heizung positiv');
ok(hat(l1, 'baeder', 'allgemein') && hat(l1, 'innenausbau', 'allgemein'), 'C4 Wohnungen modernisiert -> Baeder/Innenausbau allgemein');
ok(l1.filter((x) => x.gewerk === 'baeder')[0].umfang === 'teilweise', 'C5 „Mehrere Wohnungen" -> teilweise');
ok(l1.filter((x) => x.gewerk === 'baeder')[0].kuerzlich === true, 'C6 „in den letzten Jahren" erkannt');
ok(!l1.some((x) => /Gepflegt/.test(x.zitat)), 'C7 „gepflegt" ist keine Modernisierung');
const l2 = M.ausText('Die Fenster müssen erneuert werden.', {});
ok(hat(l2, 'fenster', 'konkret', 'negativ'), 'C8 „muessen erneuert werden" -> negativ', l2);
const l3 = M.ausText('Baujahr 1958, Fenster erneuert.', { stichtag_jahr: 2026 });
ok(l3.length === 1 && l3[0].jahr == null, 'C9 Baujahr ist kein Modernisierungsjahr', l3);
const l4 = M.ausText('Das Dach wurde 2019 neu eingedeckt.', { stichtag_jahr: 2026 });
ok(l4.length === 1 && l4[0].jahr === 2019, 'C10 Jahr am Gewerk', l4);
ok(M.ausText('Die Dachgeschosswohnung wurde modernisiert.', {}).every((x) => x.gewerk !== 'dach'), 'C11 Dachgeschoss ist nicht das Dach');
ok(M.ausText('Das Haus wurde 2021 kernsaniert.', { stichtag_jahr: 2026 }).length === 8, 'C12 kernsaniert -> alle acht allgemein');

kopf('D  Kombination je Gewerk');
const k1 = M.kombinieren({ text: l1, baujahr: 1956, stichtag_jahr: 2026, energieklasse: 'C' });
ok(k1 && k1.punkte === 12, 'D1 Fixture 1 mit Klasse C -> 12 Punkte (2,8+2,8+1,4 belegt, Fenster 1,4 nach Klasse, vier Gewerke je 0,8)', k1 && k1.punkte);
ok(k1.gewerke.aussenwand.quelle === 'text' && k1.gewerke.aussenwand.punkte === 2.8, 'D2 WDVS ohne Jahr, Klasse C bestaetigt -> 70 % von 4', k1.gewerke.aussenwand);
ok(k1.gewerke.leitungen.quelle === 'angenommen', 'D3 Gewerk ohne Aussage -> angenommen');
ok(/Exposé-Text/.test(k1.kurz), 'D4 kurz nennt den Exposé-Text');
const k1ohne = M.kombinieren({ text: l1, baujahr: 1956, stichtag_jahr: 2026 });
ok(k1ohne.gewerke.aussenwand.punkte === 2, 'D5 ohne Energieklasse 50 % von 4', k1ohne.gewerke.aussenwand);
const fotos = M.normFotos({ fenster: { stufe: 'neuwertig', sicherheit: 'hoch', beschreibung: 'Kunststofffenster mit Isolierverglasung' },
  aussenwand: { stufe: 'veraltet', sicherheit: 'hoch', beschreibung: 'bauzeitlicher Putz' }, baeder: { stufe: 'neuwertig', sicherheit: 'niedrig' } });
ok(!fotos.baeder, 'D6 Bildbefund mit niedriger Sicherheit faellt weg');
const k2 = M.kombinieren({ text: l1, fotos, baujahr: 1956, stichtag_jahr: 2026 });
ok(k2.gewerke.fenster.quelle === 'bild' && k2.gewerke.fenster.punkte === 1.4, 'D7 Bild ergaenzt Fenster (neuwertig 70 %)', k2.gewerke.fenster);
ok(k2.gewerke.aussenwand.quelle === 'text' && !!k2.gewerke.aussenwand.widerspruch, 'D8 Widerspruch Text/Bild: konkreter Text gilt, Widerspruch genannt');
ok(k2.widersprueche.length >= 1, 'D9 Widerspruch in der Liste');
ok(/Exposé-Text und Bildern/.test(k2.kurz), 'D10 kurz: „aus Exposé-Text und Bildern abgeleitet"');
const k3 = M.kombinieren({ text: M.ausText('Einige Wohnungen wurden renoviert.', {}), baujahr: 1956, stichtag_jahr: 2026 });
ok(k3.gewerke.baeder.punkte === 0.8, 'D11 positive Teil-Aussage senkt nie unter die Annahme', k3.gewerke.baeder);
ok(M.kombinieren({ text: M.ausText('Gepflegtes Haus in ruhiger Lage.', {}), baujahr: 1956 }) === null, 'D12 nur „gepflegt" -> keine Ableitung');
const k4 = M.kombinieren({ text: [], fotos: M.normFotos({ baeder: { stufe: 'neuwertig', sicherheit: 'mittel', beschreibung: 'Bad mit neuen Fliesen' } }), baujahr: 1956 });
ok(k4 && /Bildern/.test(k4.kurz) && k4.gewerke.baeder.beleg === 'Bad mit neuen Fliesen', 'D13 nur Bilder -> „aus Bildern abgeleitet" mit Beschreibung');

kopf('E  Kette mb-Backend (lib/rnd-einheitlich.js)');
const E = await import(pathToFileURL(path.join(WURZEL, 'marktbericht/backend/src/lib/rnd-einheitlich.js')).href);
const ST = { wertermittlungsstichtag: '2026-11-17' };
const e1 = E.restnutzungsdauerEinheitlich({ build_year: 1956, ...ST }, 80);
ok(e1.quelle === 'anlage2' && e1.modernisierung && e1.modernisierung.punkte === 8, 'E1 ohne Angabe: Anlage 2 mit 8 Punkten', e1);
ok(/angenommen/.test(e1.hinweis) && /aus 8 Modernisierungspunkten/.test(e1.hinweis), 'E2 Hinweis nennt 8 Punkte und „angenommen"');
const e0 = E.restnutzungsdauerEinheitlich({ build_year: 1956, mod_punkte: 0, mod_punkte_herkunft: 'eigene_angabe', ...ST }, 80);
ok(e0.modernisierung === null && /aus 0 Modernisierungspunkten/.test(e0.hinweis), 'E3 eigene 0 bleibt 0');
const eA = E.restnutzungsdauerEinheitlich({ build_year: 1956, mod_punkte: null, mod_angaben: 3, ...ST }, 80);
ok(/aus 0 Modernisierungspunkten/.test(eA.hinweis), 'E4 Gewerke beantwortet, Punkte fehlen -> 0 wie bisher');
const eZ = E.restnutzungsdauerEinheitlich({ build_year: 1956, condition: 'gut', ...ST }, 80);
ok(eZ.modernisierung && eZ.modernisierung.herkunft === 'zustand' && eZ.modernisierung.punkte === 14, 'E5 Zustand aus dem Objekt (condition) -> 14');
const eB = E.restnutzungsdauerEinheitlich({ build_year: 1956, mod_ableitung: JSON.stringify(k1), ...ST }, 80);
ok(eB.modernisierung && eB.modernisierung.herkunft === 'abgeleitet' && eB.modernisierung.punkte === 12, 'E6 Ableitung als JSON -> 12');
ok(E.modernisierungFuerRnd({ build_year: 1956, mod_punkte: 7 }) === null, 'E7 modernisierungFuerRnd: eingetragene Punkte -> null');
ok(E.modernisierungFuerRnd({ build_year: 1956 }).punkte === 8, 'E8 modernisierungFuerRnd ohne Angabe -> 8 (Basis des Wertpotenzials)');

kopf('F  Kette rnd-calc.js mapDealPilotObject');
const ctx = vm.createContext({ console }); ctx.window = ctx; ctx.globalThis = ctx;
for (const f of ['modernisierung-herkunft.js', 'rnd-gnd-table.js', 'rnd-calc.js']) {
  new vm.Script(fs.readFileSync(path.join(WURZEL, 'frontend/js', f), 'utf8'), { filename: f }).runInContext(ctx);
}
const R = ctx.DealPilotRND;
const m1 = R.mapDealPilotObject({ baujahr: '1956', objart: 'MFH' });
ok(m1.modPoints === 8 && m1.modernisierung && /angenommen/.test(m1.modPoints_herkunft), 'F1 leeres Objekt -> 8, Herkunft angenommen', [m1.modPoints, m1.modPoints_herkunft]);
const m2 = R.mapDealPilotObject({ baujahr: '1956', objart: 'MFH', mod_punkte: '0' });
ok(m2.modPoints === 0 && !m2.modernisierung, 'F2 Auswahlfeld „nicht modernisiert" (0) -> 0', [m2.modPoints]);
const m3 = R.mapDealPilotObject({ baujahr: '1956', objart: 'MFH', ds2_zustand: 'gut' });
ok(m3.modPoints === 14, 'F3 Zustand gut -> 14', m3.modPoints);
const m4 = R.mapDealPilotObject({ baujahr: '1956', objart: 'MFH', mod_dach: '< 5 Jahre' });
ok(m4.modPoints === 4 && !m4.modernisierung, 'F4 Gewerke-Angabe gilt (Dach < 5 J. = 4)', m4.modPoints);
const m5 = R.mapDealPilotObject({ baujahr: '1956', objart: 'MFH', ds2_energie: 'B' });
ok(m5.modPoints === 12, 'F5 Energieklasse B -> 12', m5.modPoints);
const c1 = R.calcAll(m1), c0 = R.calcAll(Object.assign({}, m1, { modPoints: 0 }));
ok(c1.final_rnd > c0.final_rnd + 10, 'F6 RND mit Rueckfall deutlich ueber 0 Punkten (' + c1.final_rnd + ' / ' + c0.final_rnd + ')');

kopf('G  KI-Belege (openaiService._modernisierungenNorm, aus der Quelle gelesen)');
const oai = fs.readFileSync(path.join(WURZEL, 'backend/src/services/openaiService.js'), 'utf8');
const ga = oai.indexOf('const _GEWERKE_A2'), gb = oai.indexOf('/* ══ v3660 · ZUSTAND AUS DEN BILDERN');
ok(ga > 0 && gb > ga, 'G0 Funktion gefunden');
const norm = new vm.Script('(function(){' + oai.slice(ga, gb) + '; return _modernisierungenNorm; })()').runInNewContext({});
const txt = 'Die Fassade wurde mit WDVS gedämmt. Neue Kunststofffenster.';
const n1 = norm([{ gewerk: 'fassade', zitat: 'Fassade wurde mit WDVS gedämmt', richtung: 'positiv' },
                 { gewerk: 'dach', zitat: 'Dach komplett neu', richtung: 'positiv' },
                 { gewerk: 'keller', zitat: 'Neue Kunststofffenster' }], txt);
ok(n1.length === 1 && n1[0].gewerk === 'aussenwand', 'G1 erfundenes Zitat und unbekanntes Gewerk fallen weg, Fassade -> aussenwand', n1);
ok(/"modernisierungen"/.test(oai) && /cleaned\.modernisierungen = _modernisierungenNorm/.test(oai), 'G2 Feld steht im Antwortschema und wird uebernommen (kein Feld, keine Ausgabe)');
ok(/modernisierungen: _modernisierungenNorm\(o\.modernisierungen, text\)/.test(oai), 'G3 Paket-Auslese uebernimmt das Feld je Objekt');
ok(/kiFunktion: 'zustand-bilder'/.test(oai), 'G4 Bildauswertung meldet sich beim KI-Deckel als zustand-bilder');

kopf('H  Spiegel');
const sum = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const mb = path.join(WURZEL, 'marktbericht/backend/src/lib/generated/modernisierung-herkunft.cjs');
ok(fs.existsSync(mb) && sum(mb) === sum(QUELLE), 'H1 mb-Kopie = Quelle (sonst: node tools/rechenkerne-spiegeln.mjs)');
const be = path.join(WURZEL, 'backend/src/generated/rechenkerne/modernisierung-herkunft.js');
ok(fs.existsSync(be) && sum(be) === sum(QUELLE), 'H2 Backend-Kopie = Quelle');

kopf('Z  Gegenprobe');
const alt = Object.assign({}, m1, { modPoints: 0 });
ok(R.calcAll(alt).final_rnd !== c1.final_rnd, 'Z1 die alte Vorbelegung 0 waere erkannt worden');
ok(M.bestimmen({ mod_punkte: 0, mod_punkte_herkunft: 'eigene_angabe', baujahr: 1956 }).punkte !== M.bestimmen({ mod_punkte: 0, baujahr: 1956 }).punkte, 'Z2 Kennung „eigene_angabe" unterscheidet Antwort und Vorbelegung');

console.log('\n' + (rot ? 'ROT: ' + rot + ' von ' + (rot + gruen) : 'SAUBER: ' + gruen + ' Punkte'));
process.exit(rot ? 1 : 0);
