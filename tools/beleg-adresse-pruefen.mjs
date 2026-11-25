#!/usr/bin/env node
/* v4930 · Prüfer: eingelesene Unterlagen mit fremder Objektanschrift werden abgelehnt (Marcel 25.11.2026).
   A  Kern frontend/js/adress-pruefung.js an erfundenen Adressen (gleich, Schreibvarianten, anders, ohne Bezug)
   B  Verdrahtung in den echten Dateien (Sammel-Import, Dokument-Import, Beleg-Leser, Backend-Prompt)
   C  Gegenproben: je eine Sicherung entfernt → muss rot werden
   RC 0 = sauber. Testadressen sind erfunden. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let fehler = 0, ok = 0;
const pruef = (name, bed, info) => { if (bed) { ok++; console.log('  ok  ' + name); } else { fehler++; console.log('  ROT ' + name + (info ? '  (' + info + ')' : '')); } };

function kernLaden(src) {
  const ctx = { module: { exports: {} }, window: undefined, console };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return ctx.module.exports;
}

console.log('A  Kern (adress-pruefung.js)');
const KERN = lies('frontend/js/adress-pruefung.js');
const AP = kernLaden(KERN);
const obj = { str: 'Westerfeldstraße', hnr: '146', plz: '32049', ort: 'Herford' };
const faelle = [
  ['Westerfeldstr. 146, 32049 Herford', 'gleich'],
  ['Westerfeld Straße 146', 'gleich'],
  ['WESTERFELDSTRASSE 146a, 32049 Herford', 'gleich'],
  ['Westerfeldstr. 144-148, 32049 Herford', 'gleich'],
  ['Musterweg 7, 32052 Herford', 'anders'],
  ['Westerfeldstr. 12, 32049 Herford', 'anders'],
  ['Am Markt 18, 32049 Herford', 'anders'],
  ['Westerfeldstr. 146, 10115 Berlin', 'anders'],
  ['32049 Herford', 'unbekannt'],
  ['', 'unbekannt'],
  [null, 'unbekannt'],
];
faelle.forEach(([d, soll]) => { const r = AP.pruefen(d, obj); pruef(JSON.stringify(d) + ' → ' + soll, r.urteil === soll, 'ist ' + r.urteil); });
pruef('ohne Objektanschrift kein Urteil', AP.pruefen('Musterweg 7', null).urteil === 'unbekannt');
/* Handwerkerrechnung: Firmenadresse steht nur als aussteller, objekt_anschrift fehlt → kein Objektbezug, kein Block */
const rechnung = { aussteller: 'Muster Sanitär GmbH, Werkstraße 3, 33602 Bielefeld', positionen: [] };
pruef('Rechnung ohne objekt_anschrift: keine Anschrift erkannt (Firmenadresse zählt nicht)', AP.ausAuslese(rechnung) === null);
pruef('Rechnung mit Leistungsort gleich → gleich', AP.pruefen(AP.ausAuslese({ leistungsort: 'Westerfeldstr. 146, 32049 Herford' }), obj).urteil === 'gleich');
pruef('Auslese objekt.adresse fremd → anders', AP.pruefen(AP.ausAuslese({ objekt: { adresse: 'Musterweg 7, 32052 Herford' } }), obj).urteil === 'anders');
const m = AP.meldung(AP.pruefen('Musterweg 7, 32052 Herford', obj));
pruef('Meldung nennt beide Adressen und „Nicht übernommen.“', /Musterweg 7/.test(m) && /Westerfeldstra/.test(m) && /Nicht übernommen\.$/.test(m), m);
pruef('Kundentext ohne Gedankenstrich/Semikolon', !/[–—;]/.test(m));

console.log('B  Verdrahtung');
const OA = lies('frontend/js/object-actions.js'), DI = lies('frontend/js/dokument-import.js'), BI = lies('frontend/js/beleg-import.js');
const OS = lies('backend/src/services/openaiService.js'), AI = lies('backend/src/routes/ai.js'), IX = lies('frontend/index.html');
const verdrahtung = (oa, di, bi, os, ai, ix) => [
  ['Sammel-Import: _dateiSperren in recompute', /function recompute\(\) \{\s*_merged = \{\};\s*_dateiSperren\(\);/.test(oa)],
  ['Sammel-Import: Exposé/Marktbericht/Dokument nur ohne Sperre', (oa.match(/!_gesperrt\(f\)/g) || []).length >= 3],
  ['Sammel-Import: Auswertung ohne gesperrte Dateien', /function _unterlagenListe\(\) \{[\s\S]{0,200}_dateiSperren\(\);[\s\S]{0,300}if \(_gesperrt\(f\)\) return;/.test(oa)],
  ['Sammel-Import: kein „Ja, trotzdem übernehmen“', !/trotzdem übernehmen/.test(oa)],
  ['Sammel-Import: Bestand sperrt Exposé und Marktbericht', /bestand && \(typ === 'expose' \|\| typ === 'market'\)/.test(oa)],
  ['Sammel-Import: fremde Datei nie abgelegt', /f\.file && !f\.fremd/.test(oa)],
  ['Dokument-Import: gemeinsamer Kern, kein „trotzdem“', /DpAdressPruefung/.test(di) && !/trotzdem übernehmen/.test(di)],
  ['Beleg-Leser: objekt_anschrift geprüft', /_belegAdrPruefen\(r\)/.test(bi) && /_belegAdrPruefen\(x2\)/.test(bi)],
  ['Backend-Prompt: objekt_anschrift in beiden Beleg-Prompts', (os.match(/"objekt_anschrift":"string oder null"/g) || []).length === 2],
  ['Backend: objekt_anschrift bis in die Antwort', /objekt_anschrift: wahl\.oa/.test(os) && /objekt_anschrift: \(out && out\.objekt_anschrift\)/.test(ai)],
  ['index.html lädt adress-pruefung.js vor dem Dokument-Import', ix.indexOf('js/adress-pruefung.js') > 0 && ix.indexOf('js/adress-pruefung.js') < ix.indexOf('js/dokument-import.js')],
];
verdrahtung(OA, DI, BI, OS, AI, IX).forEach(([n, b]) => pruef(n, b));

console.log('C  Gegenproben');
const rotBei = (name, fn) => { const alle = fn(); const r = alle.every(([, b]) => b); pruef('rot bei: ' + name, !r); };
rotBei('recompute ohne _dateiSperren', () => verdrahtung(OA.replace('    _dateiSperren();\n', '').replace('    _dateiSperren();\r\n', ''), DI, BI, OS, AI, IX));
rotBei('„trotzdem“ wieder drin', () => verdrahtung(OA + "\n// Ja, trotzdem übernehmen", DI, BI, OS, AI, IX));
rotBei('Beleg-Leser ohne Prüfung', () => verdrahtung(OA, DI, BI.split('_belegAdrPruefen(r)').join('x(r)'), OS, AI, IX));
rotBei('Prompt ohne Feld', () => verdrahtung(OA, DI, BI, OS.split('"objekt_anschrift":"string oder null"').join('"x":1'), AI, IX));
{ const K2 = kernLaden(KERN.replace("if (!gleicheStr) return res('anders', 'strasse');", '')); pruef('rot bei: Kern ohne Straßenvergleich', K2.pruefen('Am Markt 146, 32049 Herford', obj).urteil !== 'anders'); }

console.log('\n' + (fehler ? 'ROT - ' + fehler + ' Befund(e).' : 'SAUBER - ' + ok + ' Punkte.'));
process.exit(fehler ? 1 : 0);
