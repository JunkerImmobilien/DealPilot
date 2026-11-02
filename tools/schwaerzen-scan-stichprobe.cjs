/* schwaerzen-scan-stichprobe.cjs — v3089 · im Backend-Container: echte Scans durch den echten Weg
   (pdftoppm 2200 px → ocr.bildZuText = Tesseract + Schwärzen) und nur die Zeilen zeigen, in denen
   ein Personenname typischerweise steht (Wohnung, Eigentümer, Herr/Frau). So fallen Reste auf.
   docker exec dealpilot-backend node /tmp/schwaerzen-scan-stichprobe.cjs /tmp/ocrscan 3 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ocr = require('/app/src/services/ocr.js');
const dir = process.argv[2] || '/tmp/ocrscan', max = +(process.argv[3] || 3), tmp = '/tmp/stich';
fs.mkdirSync(tmp, { recursive: true });
(async function () {
  let namen = 0, seiten = 0;
  for (const f of fs.readdirSync(dir).filter((x) => /\.pdf$/i.test(x)).sort()) {
    for (let s = 1; s <= max; s++) {
      for (const x of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, x));
      try { execFileSync('pdftoppm', ['-jpeg', '-jpegopt', 'quality=85', '-scale-to-x', '2200', '-scale-to-y', '-1', '-f', String(s), '-l', String(s), path.join(dir, f), path.join(tmp, 's')]); } catch (e) { break; }
      const b = fs.readdirSync(tmp)[0]; if (!b) break;
      const r = await ocr.bildZuText('data:image/jpeg;base64,' + fs.readFileSync(path.join(tmp, b)).toString('base64'));
      seiten++; namen += (r.text.match(/\[Name\]/g) || []).length;
      r.text.split('\n').filter((z) => /Wohnung|Eigentümer|Herr|Frau|Hr\.|Fr\./.test(z)).forEach((z) => console.log(f.slice(0, 18).padEnd(18), 'S.' + s, '|', z.slice(0, 120)));
    }
  }
  console.log(`\n${seiten} Seiten, ${namen}× [Name]`);
})();
