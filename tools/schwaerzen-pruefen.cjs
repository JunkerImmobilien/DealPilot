/* schwaerzen-pruefen.cjs — v3089 · prüft backend/src/services/schwaerzen.js (die ECHTE Datei)
   an festen Fällen: was geschwärzt werden MUSS (Personennamen, auch hinter „Wohnung") und was
   stehen bleiben MUSS (Firmen, Beträge, Objektanschrift, Lagewörter). RC=0 sauber.
   Aufruf: node tools/schwaerzen-pruefen.cjs */
const path = require('path');
const s = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'schwaerzen.js'));
const FAELLE = [
  ['Die Wohnung Albers/Kowalski mit allen Nebengewerken', 'Die Wohnung [Name] mit allen Nebengewerken'],
  ['den Wohnungen Petersen und Albers/Kowalski und Kostentragung', 'den Wohnungen [Name] und Kostentragung'],
  ['die Wohnung Nr. 5 im Erdgeschoss', 'die Wohnung Nr. 5 im Erdgeschoss'],
  ['Wohnung Dachgeschoss links', 'Wohnung Dachgeschoss links'],
  ['Kosten der Wohnung Kellergeschoss', 'Kosten der Wohnung Kellergeschoss'],
  ['Rücksprache mit Hr. Becker', 'Rücksprache mit Hr. [Name]'],
  ['Herr Max Mustermann stimmt zu', 'Herr [Name] stimmt zu'],
  ['Müller, Erika, geb. 01.02.1960', '[Name], geb. [Datum]'],
  ['Fa. Dachbau Nord (Dachdecker) 16.888,43 €', 'Fa. Dachbau Nord (Dachdecker) 16.888,43 €'],
  ['Industriestr. 4-8, 12345 Musterstadt', 'Industriestr. 4-8, 12345 Musterstadt'],
  ['dass sie und Familie Lorenz zurzeit', 'dass sie und Familie [Name] zurzeit'],
  ['Herr Hans Beispiel, Ahornweg 12, 12345 Musterstadt', 'Herr [Name], [Anschrift]'],
  ['Objekt Lindenallee 14, 32052 Herford', 'Objekt Lindenallee 14, 32052 Herford'],
  ['der Wohnung Albers/Kowalski und Familie Lorenz', 'der Wohnung [Name] und Familie [Name]'],
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
