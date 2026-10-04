/* Liest eine PDF-Seite SPALTENTREU.

   Warum es das braucht: der normale Textstrom wirft leere Zellen weg. Am
   Landesgrundstuecksmarktbericht M-V 2025, Abb. 5.2, gemessen:

     "Mehrfamilienhaeuser x x x x x"

   Fuenf Kreuze fuer ACHT Ausschuesse — welche drei fehlen, steht nicht da.
   Wer das als Liste liest, ordnet die Kreuze den ersten fuenf Spalten zu
   und liegt falsch.

   > Eine Tabelle ohne ihre Leerstellen ist keine Tabelle, sondern eine
   > Aufzaehlung. Der Unterschied entscheidet hier, welcher Ausschuss
   > welchen Wert fuehrt.

   Deshalb werden die x-Koordinaten der Textstuecke mitgelesen und die
   Zeilen anhand der Spaltenmitten neu aufgebaut.

   Aufruf:
     node tabelle.js DATEI.pdf SEITE [spalte1,spalte2,...]
   Ohne Spaltenliste werden die erkannten x-Positionen ausgegeben, damit
   man die Spaltenmitten ablesen kann. */
const fs = require('fs');

const datei = process.argv[2];
const seite = parseInt(process.argv[3] || '1', 10);
const spaltenArg = process.argv[4];

(async () => {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(datei)), useSystemFonts: true }).promise;
  if (seite < 1 || seite > pdf.numPages) { console.error('Seite ausserhalb 1..' + pdf.numPages); process.exit(1); }
  const p = await pdf.getPage(seite);
  const c = await p.getTextContent();

  const items = c.items
    .filter((i) => (i.str || '').trim() !== '')
    .map((i) => ({ s: i.str.trim(), x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) }));

  console.error('=== DECKUNG ===');
  console.error('Seiten gesamt : ' + pdf.numPages + ' | gelesen: Seite ' + seite);
  console.error('Textstuecke   : ' + items.length);
  if (!items.length) { console.error('*** NULL STUECKE = WERKZEUG AUSGEFALLEN ***'); process.exit(2); }

  /* Zeilen bilden: gleiche y-Koordinate (Toleranz 3) */
  const zeilen = {};
  items.forEach((i) => {
    const k = Object.keys(zeilen).find((y) => Math.abs(parseInt(y, 10) - i.y) <= 3);
    (zeilen[k !== undefined ? k : i.y] = zeilen[k !== undefined ? k : i.y] || []).push(i);
  });
  const sortiert = Object.keys(zeilen)
    .map(Number).sort((a, b) => b - a)
    .map((y) => zeilen[y].sort((a, b) => a.x - b.x));

  if (!spaltenArg) {
    /* Ohne Spaltenvorgabe: zeigen, WO die kurzen Marken stehen (x/-Zeichen),
       damit man die Spaltenmitten ablesen kann. */
    console.error('');
    console.error('=== X-POSITIONEN KURZER MARKEN (x, -, Kreuze) ===');
    const marken = {};
    items.filter((i) => i.s.length <= 2).forEach((i) => { marken[i.x] = (marken[i.x] || 0) + 1; });
    console.error(Object.keys(marken).map(Number).sort((a, b) => a - b)
      .map((x) => x + '(' + marken[x] + ')').join(' '));
    console.error('');
    console.error('=== ZEILEN ROH (y | x:text) ===');
    sortiert.forEach((z) => {
      console.log(String(z[0].y).padStart(4) + ' | ' + z.map((i) => i.x + ':' + i.s).join('  '));
    });
    return;
  }

  const spalten = spaltenArg.split(',').map(Number);
  console.error('Spaltenmitten : ' + spalten.join(' '));
  console.error('');
  sortiert.forEach((z) => {
    /* Alles links der ersten Spalte ist die Zeilenbeschriftung */
    const label = z.filter((i) => i.x < spalten[0] - 12).map((i) => i.s).join(' ');
    const zellen = spalten.map((sx) => {
      const t = z.find((i) => Math.abs(i.x - sx) <= 12 && i.s.length <= 2);
      return t ? t.s : '-';
    });
    if (!label && zellen.every((v) => v === '-')) return;
    console.log(label.padEnd(44).slice(0, 44) + ' | ' + zellen.join(' '));
  });
})().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
