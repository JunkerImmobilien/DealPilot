#!/usr/bin/env node
/* PDF-Text mit pdf.js — das einzige Werkzeug, das komprimierte CID-Ströme
   liest. Ein Latin-1-Tj-Prüfer gibt bei denselben Dateien Buchstabensalat
   zurück (am 01.10.2026 am KPT-Gutachten gemessen: 380 Textstücke, alle
   unlesbar).

   Das Werkzeug nennt seine DECKUNG: Seiten gelesen, Zeichen gefunden.
   Null Textstücke ist kein Befund, sondern ein ausgefallenes Werkzeug. */
const fs = require('fs');

const datei = process.argv[2];
const vonSeite = parseInt(process.argv[3] || '1', 10);
const bisSeite = parseInt(process.argv[4] || '0', 10);
const suche = process.argv[5] || '';

(async () => {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const daten = new Uint8Array(fs.readFileSync(datei));
  const pdf = await pdfjs.getDocument({ data: daten, useSystemFonts: true }).promise;
  const letzte = bisSeite > 0 ? Math.min(bisSeite, pdf.numPages) : pdf.numPages;

  let zeichen = 0, leer = 0;
  const seiten = [];
  for (let n = vonSeite; n <= letzte; n++) {
    const p = await pdf.getPage(n);
    const c = await p.getTextContent();
    const t = c.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
    zeichen += t.length;
    if (!t) leer++;
    seiten.push({ n, t });
  }

  console.error('=== DECKUNG ===');
  console.error('Seiten gesamt   : ' + pdf.numPages);
  console.error('gelesen         : ' + seiten.length + ' (' + vonSeite + '–' + letzte + ')');
  console.error('davon leer      : ' + leer);
  console.error('Zeichen         : ' + zeichen);
  if (!zeichen) { console.error('*** NULL ZEICHEN = WERKZEUG AUSGEFALLEN ***'); process.exit(2); }

  if (suche) {
    const re = new RegExp(suche, 'i');
    const treffer = seiten.filter((s) => re.test(s.t));
    console.error('Seiten mit „' + suche + '": ' + treffer.length
      + (treffer.length ? '  →  ' + treffer.map((s) => s.n).slice(0, 40).join(' ') : ''));
    treffer.slice(0, 3).forEach((s) => {
      console.log('\n===== SEITE ' + s.n + ' =====');
      console.log(s.t.slice(0, 2500));
    });
  } else {
    seiten.forEach((s) => { console.log('\n===== SEITE ' + s.n + ' ====='); console.log(s.t); });
  }
})().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
