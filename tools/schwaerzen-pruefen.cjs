/* schwaerzen-pruefen.cjs — v3089 · prüft backend/src/services/schwaerzen.js (die ECHTE Datei)
   an festen Fällen: was geschwärzt werden MUSS (Personennamen, auch hinter „Wohnung") und was
   stehen bleiben MUSS (Firmen, Beträge, Objektanschrift, Lagewörter). RC=0 sauber.
   Aufruf: node tools/schwaerzen-pruefen.cjs */
const path = require('path');
const s = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'schwaerzen.js'));
const FAELLE = [
  ['Die Wohnung Grannemann/Hülsmeier mit allen Nebengewerken', 'Die Wohnung [Name] mit allen Nebengewerken'],
  ['den Wohnungen Lingemann und Grannemann/Hülsmeier und Kostentragung', 'den Wohnungen [Name] und Kostentragung'],
  ['die Wohnung Nr. 5 im Erdgeschoss', 'die Wohnung Nr. 5 im Erdgeschoss'],
  ['Wohnung Dachgeschoss links', 'Wohnung Dachgeschoss links'],
  ['Kosten der Wohnung Kellergeschoss', 'Kosten der Wohnung Kellergeschoss'],
  ['Rücksprache mit Hr. Becker', 'Rücksprache mit Hr. [Name]'],
  ['Herr Max Mustermann stimmt zu', 'Herr [Name] stimmt zu'],
  ['Müller, Erika, geb. 01.02.1960', '[Name], geb. [Datum]'],
  ['Fa. Rudolph (Dachdecker) 16.888,43 €', 'Fa. Rudolph (Dachdecker) 16.888,43 €'],
  ['Lübberstr. 12-20, 32052 Herford', 'Lübberstr. 12-20, 32052 Herford'],
  ['dass sie und Familie Brinkmann zurzeit', 'dass sie und Familie [Name] zurzeit'],
  ['Herr Hans Beispiel, Mindener Straße 56, 32049 Herford', 'Herr [Name], [Anschrift]'],
  ['Objekt Sachsenstr. 16, 32052 Herford', 'Objekt Sachsenstr. 16, 32052 Herford'],
  ['der Wohnung Grannemann/Hülsmeier und Familie Brinkmann', 'der Wohnung [Name] und Familie [Name]'],
  ['den Wohnungen Meyer und Herrn Schulz', 'den Wohnungen [Name] und Herrn [Name]'],
  ['IBAN DE89 3704 0044 0532 0130 00', 'IBAN [IBAN]']
];
let rot = 0;
FAELLE.forEach(([ein, soll]) => {
  const ist = s.schwaerze(ein).text;
  if (ist !== soll) { rot++; console.log('ROT ' + JSON.stringify(ein) + '\n    ist  ' + JSON.stringify(ist) + '\n    soll ' + JSON.stringify(soll)); }
});
console.log(rot ? 'ROT — ' + rot + ' von ' + FAELLE.length : 'GRÜN — ' + FAELLE.length + ' Fälle');
process.exit(rot ? 1 : 0);
