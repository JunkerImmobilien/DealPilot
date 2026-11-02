/* ocr-messen.cjs — v3089 · Qualität der Server-Texterkennung messen, ohne KI.
   Läuft IM Backend-Container (braucht tesseract, pdftoppm, pdftotext, /app/src/services/ocr.js):
     docker cp tools/ocr-messen.cjs dealpilot-backend:/tmp/ && docker exec dealpilot-backend node /tmp/ocr-messen.cjs /tmp/ocrtest
   Jede PDF-Seite wird wie im Browser gerendert (2200 px breit, JPEG 85 %) und mit Tesseract gelesen.
   Hat das PDF eine Textschicht, ist sie der Prüfmaßstab: Trefferquote der Wörter (≥ 3 Zeichen) und
   der ZAHLEN (Beträge, Daten, Flurstücke) — die Zahlen sind es, die in die Rechnung gehen.
   Ohne Textschicht (echter Scan): nur Lesbarkeit (Konfidenz) und Wortzahl. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ocr = require('/app/src/services/ocr.js');
const dir = process.argv[2] || '/tmp/ocrtest';
const MAX_SEITEN = +(process.argv[3] || 4);
const tmp = '/tmp/ocrmess'; fs.mkdirSync(tmp, { recursive: true });

function woerter(t) { return (String(t).toLowerCase().match(/[a-zäöüß]{3,}/g) || []); }
function zahlen(t) { return (String(t).match(/\d[\d.,]*\d|\d/g) || []).map((z) => z.replace(/[.,]$/, '')).filter((z) => z.length >= 2); }
function quote(soll, ist) {
  if (!soll.length) return null;
  const pool = {}; ist.forEach((w) => { pool[w] = (pool[w] || 0) + 1; });
  let hit = 0; soll.forEach((w) => { if (pool[w] > 0) { hit++; pool[w]--; } });
  return Math.round(hit / soll.length * 1000) / 10;
}
const dateien = fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f)).sort();
const summe = { w: [0, 0], z: [0, 0] };
for (const f of dateien) {
  const p = path.join(dir, f);
  let seiten = 1;
  try { seiten = +(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [p]).toString()) || [0, 1])[1]; } catch (e) {}
  const n = Math.min(seiten, MAX_SEITEN);
  for (let s = 1; s <= n; s++) {
    for (const x of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, x));
    execFileSync('pdftoppm', ['-jpeg', '-jpegopt', 'quality=85', '-scale-to-x', '2200', '-scale-to-y', '-1', '-f', String(s), '-l', String(s), p, path.join(tmp, 's')]);
    const bild = path.join(tmp, fs.readdirSync(tmp)[0]);
    const t0 = Date.now();
    const r = ocr._tsvZuText(execFileSync('tesseract', [bild, 'stdout', '-l', 'deu', '--psm', '3', 'tsv'], { maxBuffer: 64e6 }).toString());
    const ms = Date.now() - t0;
    let gt = '';
    try { gt = execFileSync('pdftotext', ['-layout', '-f', String(s), '-l', String(s), p, '-']).toString(); } catch (e) {}
    const gw = woerter(gt), gz = zahlen(gt);
    let zeile = `${f.slice(0, 44).padEnd(44)} S.${String(s).padStart(2)}  Lesbarkeit ${String(r.konfidenz).padStart(3)} %  ${String(r.woerter).padStart(4)} Wörter  ${String(ms).padStart(5)} ms`;
    if (gw.length >= 20) {
      const qw = quote(gw, woerter(r.text)), qz = quote(gz, zahlen(r.text));
      summe.w[0] += gw.length * qw / 100; summe.w[1] += gw.length;
      if (gz.length) { summe.z[0] += gz.length * qz / 100; summe.z[1] += gz.length; }
      zeile += `  | Textschicht: Wörter ${qw} %  Zahlen ${qz == null ? '–' : qz + ' %'} (${gz.length})`;
    } else zeile += '  | Scan ohne Textschicht';
    console.log(zeile);
  }
}
if (summe.w[1]) console.log(`\nGESAMT gegen Textschicht: Wörter ${(summe.w[0] / summe.w[1] * 100).toFixed(1)} % von ${summe.w[1]}, Zahlen ${summe.z[1] ? (summe.z[0] / summe.z[1] * 100).toFixed(1) + ' % von ' + summe.z[1] : '–'}`);
