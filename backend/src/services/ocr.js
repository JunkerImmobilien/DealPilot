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

module.exports = { aktiv, bildZuText, bilderZuText, _tsvZuText, SCHWELLE_KONFIDENZ };
