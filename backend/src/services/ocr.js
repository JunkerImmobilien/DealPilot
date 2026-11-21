'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   v3089 · TEXTERKENNUNG AUF DEM EIGENEN SERVER (Tesseract, deutsch)

   Marcel 02.11.2026: „mir wäre lieber, wenn wir das Ganze mit den Daten erst
   mal auf den Servern schwärzen und nur den Text da hinschicken … dass es
   genauso gut funktioniert, wie es jetzt funktioniert."

   Bis v3088 gingen gescannte Seiten, Belege und Fotos an den Bot als BILD an
   OpenAI; geschwärzt wurde erst die Antwort. Jetzt: Bild → Tesseract hier →
   schwaerzen.js → nur Text hinaus. Das Bild verlässt den Server nicht.

   Tesseract liegt im Backend-Image (Dockerfile: tesseract-ocr, -deu).
   Ausgabe als TSV: je Wort eine Konfidenz 0–100. Die mittlere Konfidenz
   (gewichtet nach Wortlänge) entscheidet, ob eine Seite „gut lesbar" ist.

   Schalter KI_DOKUMENT_BILDER=erlaubt (Umgebung) stellt den alten Bildweg
   wieder her — nur für den Notfall, z. B. wenn Tesseract im Image fehlt.
   ═══════════════════════════════════════════════════════════════════════ */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const schwaerzen = require('./schwaerzen');

const SCHWELLE_KONFIDENZ = 60;   /* darunter: Seite gilt als schwer lesbar */
const ZEIT_MS = 90000;

function aktiv() { return process.env.KI_DOKUMENT_BILDER !== 'erlaubt'; }

function _datenUrlZuDatei(dataUrl) {
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!m) throw new Error('Kein Bild (data:image/…;base64) übergeben');
  const endung = m[1] === 'jpg' ? 'jpeg' : m[1];
  const datei = path.join(os.tmpdir(), 'ocr-' + crypto.randomBytes(8).toString('hex') + '.' + endung);
  fs.writeFileSync(datei, Buffer.from(m[2], 'base64'));
  return datei;
}

function _tesseract(datei) {
  return new Promise(function (ok, nein) {
    const p = spawn('tesseract', [datei, 'stdout', '-l', 'deu', '--psm', '3', 'tsv'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let aus = '', fehler = '';
    const uhr = setTimeout(function () { try { p.kill('SIGKILL'); } catch (e) {} nein(new Error('Texterkennung: Zeitüberschreitung')); }, ZEIT_MS);
    p.stdout.on('data', function (d) { aus += d; });
    p.stderr.on('data', function (d) { fehler += d; });
    p.on('error', function (e) { clearTimeout(uhr); nein(e.code === 'ENOENT' ? new Error('Texterkennung nicht installiert (tesseract fehlt im Image)') : e); });
    p.on('close', function (code) { clearTimeout(uhr); if (code !== 0) nein(new Error('Texterkennung RC ' + code + ': ' + fehler.slice(0, 200))); else ok(aus); });
  });
}

/* TSV → Text in Lesereihenfolge (Block/Absatz/Zeile) + gewichtete Konfidenz */
function _tsvZuText(tsv) {
  const zeilen = String(tsv).split('\n').slice(1);
  const out = []; let schluesselAlt = null, zeile = [], absatzAlt = null;
  let gewicht = 0, summe = 0, woerter = 0;
  zeilen.forEach(function (z) {
    const t = z.split('\t'); if (t.length < 12) return;
    const ebene = +t[0], block = t[2], absatz = t[3], zl = t[4], conf = parseFloat(t[10]), wort = t[11];
    if (ebene !== 5 || !wort || !wort.trim()) return;
    const schluessel = block + '.' + absatz + '.' + zl;
    if (schluessel !== schluesselAlt && zeile.length) { out.push(zeile.join(' ')); zeile = []; }
    const abs = block + '.' + absatz;
    if (absatzAlt !== null && abs !== absatzAlt && out.length) out.push('');
    absatzAlt = abs; schluesselAlt = schluessel;
    zeile.push(wort);
    if (conf >= 0) { const g = Math.min(wort.length, 12); summe += conf * g; gewicht += g; woerter++; }
  });
  if (zeile.length) out.push(zeile.join(' '));
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), konfidenz: gewicht ? Math.round(summe / gewicht) : 0, woerter: woerter };
}

/** Ein Bild (data-URL) → { text (GESCHWÄRZT), konfidenz, woerter, lesbar, geschwaerzt } */
async function bildZuText(dataUrl) {
  const datei = _datenUrlZuDatei(dataUrl);
  try {
    const r = _tsvZuText(await _tesseract(datei));
    const s = schwaerzen.schwaerze(r.text);
    return { text: s.text, konfidenz: r.konfidenz, woerter: r.woerter, lesbar: r.konfidenz >= SCHWELLE_KONFIDENZ && r.woerter >= 5,
      geschwaerzt: s.gesamt || 0 };
  } finally { try { fs.unlinkSync(datei); } catch (e) {} }
}

/** Mehrere Bilder, höchstens zwei gleichzeitig (Tesseract nutzt selbst mehrere Kerne). */
async function bilderZuText(bilder) {
  const liste = bilder || [], aus = new Array(liste.length); let i = 0;
  async function arbeiter() { while (i < liste.length) { const n = i++; aus[n] = await bildZuText(liste[n]); } }
  await Promise.all([arbeiter(), arbeiter()]);
  return aus;
}

/* ═══════════════════════════════════════════════════════════════════════
   v3941 · TEXTERKENNUNG NUR IM ARBEITSSPEICHER (Einzel-Check der Landing)

   bildZuText() oben schreibt das Bild nach tmpdir, weil der App-Weg so gebaut
   ist. Der Einzel-Check verspricht Besuchern ohne Konto: keine Datei auf der
   Platte (tools/einzelcheck-pruefen.mjs, fs-Spion). Deshalb ein eigener Weg,
   der die App-Funktionen NICHT berührt:

     PDF-Puffer → pdftoppm (STDIN „-“, ohne Ausgabewurzel = STDOUT, eine Seite je
     Aufruf, PNG grau) → Puffer → tesseract „stdin“ „stdout“ (TSV) → Text.

   Grenzen: höchstens OCR_MAX_SEITEN (6) Seiten, eine Frist für die GANZE
   Unterlage (OCR_ZEIT_MS, je Prozess der Rest davon; danach SIGKILL), höchstens
   OCR_MAX_BILD_BYTES je Seitenbild. Zurück kommt der UNGESCHWÄRZTE Text (roh):
   der Aufrufer schwärzt ihn, bevor er irgendwohin geht (einzelcheck.js
   leseEine, derselbe Weg wie der Text aus pdftotext).
   ═══════════════════════════════════════════════════════════════════════ */
const OCR_MAX_SEITEN = 6;
const OCR_ZEIT_MS = 60000;
const OCR_DPI = 200;
const OCR_MAX_BILD_BYTES = 30 * 1024 * 1024;
let _starte = spawn;   /* nur der Prüfer tauscht ihn (_setzeStarter) */

/** Ein Prozess, Eingabe über STDIN, Ausgabe aus STDOUT – nichts berührt die Platte. */
function _imSpeicher(befehl, args, eingabe, fristMs, maxBytes) {
  return new Promise(function (ok, nein) {
    if (!(fristMs > 0)) { nein(Object.assign(new Error('Texterkennung: Zeitüberschreitung'), { code: 'ZEIT' })); return; }
    let p;
    try { p = _starte(befehl, args, { stdio: ['pipe', 'pipe', 'pipe'], env: Object.assign({}, process.env, { OMP_THREAD_LIMIT: '2' }) }); }
    catch (e) { nein(e); return; }
    const teile = []; let laenge = 0, fehler = '', fertig = false, zuViel = false;
    const ende = function (f, w) { if (fertig) return; fertig = true; clearTimeout(uhr); f(w); };
    const uhr = setTimeout(function () { try { p.kill('SIGKILL'); } catch (e) {} ende(nein, Object.assign(new Error('Texterkennung: Zeitüberschreitung'), { code: 'ZEIT' })); }, fristMs);
    p.stdout.on('data', function (d) {
      laenge += d.length;
      if (laenge > maxBytes) { zuViel = true; try { p.kill('SIGKILL'); } catch (e) {} return; }
      teile.push(d);
    });
    p.stderr.on('data', function (d) { if (fehler.length < 2000) fehler += d; });
    p.on('error', function (e) { ende(nein, e.code === 'ENOENT' ? Object.assign(new Error(befehl + ' fehlt im Image'), { code: 'FEHLT' }) : e); });
    p.on('close', function (code) {
      if (zuViel) { ende(nein, Object.assign(new Error(befehl + ': Ausgabe zu groß'), { code: 'GROSS' })); return; }
      ende(ok, { code: code, aus: Buffer.concat(teile), fehler: String(fehler).slice(0, 300) });
    });
    p.stdin.on('error', function () { /* Prozess beendet, bevor alles geschrieben war */ });
    p.stdin.end(eingabe);
  });
}

/** PDF-Puffer → { roh (UNGESCHWÄRZT), konfidenz, woerter, seiten, lesbar, abgeschnitten, grund } */
async function ocrAusPuffer(pdf, opts) {
  const o = opts || {};
  const maxSeiten = Math.max(1, Math.min(OCR_MAX_SEITEN, Number(o.maxSeiten) || OCR_MAX_SEITEN));
  const frist = Date.now() + Math.max(1000, Math.min(OCR_ZEIT_MS, Number(o.zeitMs) || OCR_ZEIT_MS));
  if (!Buffer.isBuffer(pdf) || !pdf.length) throw new Error('Texterkennung: kein PDF-Puffer');
  const texte = []; let summe = 0, gewicht = 0, woerter = 0, seiten = 0, abgeschnitten = false, grund = null;
  for (let n = 1; n <= maxSeiten; n++) {
    let bild;
    try {
      bild = await _imSpeicher('pdftoppm', ['-f', String(n), '-l', String(n), '-r', String(OCR_DPI), '-gray', '-png', '-'],
        pdf, frist - Date.now(), OCR_MAX_BILD_BYTES);
    } catch (e) { if (e.code === 'ZEIT') { abgeschnitten = true; grund = 'zeit'; break; } throw e; }
    if (bild.code === 99 && n > 1) break;               /* Seitenende: „Wrong page range given“ */
    if (bild.code !== 0 || !bild.aus.length) throw new Error('pdftoppm RC ' + bild.code + ': ' + bild.fehler);
    let tsv;
    try {
      tsv = await _imSpeicher('tesseract', ['stdin', 'stdout', '-l', 'deu', '--psm', '3', 'tsv'], bild.aus, frist - Date.now(), 8 * 1024 * 1024);
    } catch (e) { if (e.code === 'ZEIT') { abgeschnitten = true; grund = 'zeit'; break; } throw e; }
    bild = null;
    if (tsv.code !== 0) throw new Error('Texterkennung RC ' + tsv.code + ': ' + tsv.fehler);
    const r = _tsvZuText(tsv.aus.toString('utf8'));
    seiten++;
    if (r.text) texte.push(r.text);
    if (r.woerter) { summe += r.konfidenz * r.woerter; gewicht += r.woerter; woerter += r.woerter; }
    /* Seiten nach der sechsten werden nicht gelesen (und nicht gezählt) */
  }
  const konfidenz = gewicht ? Math.round(summe / gewicht) : 0;
  return { roh: texte.join('\n\n'), konfidenz: konfidenz, woerter: woerter, seiten: seiten,
    lesbar: konfidenz >= SCHWELLE_KONFIDENZ && woerter >= 5, abgeschnitten: !!abgeschnitten, grund: grund };
}
/** nur für tools/einzelcheck-pruefen.mjs: den Prozessstarter tauschen (null = echter spawn) */
function _setzeStarter(f) { _starte = typeof f === 'function' ? f : spawn; }

module.exports = { aktiv, bildZuText, bilderZuText, _tsvZuText, SCHWELLE_KONFIDENZ,
  ocrAusPuffer, OCR_MAX_SEITEN, OCR_ZEIT_MS, _setzeStarter };
