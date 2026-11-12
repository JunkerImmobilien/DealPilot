'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   osmKacheln.js · v3336 — Kartenkacheln von OpenStreetMap, serverseitig
   zwischengespeichert, fuer die Lagekarte im PDF (frontend/js/lagekarte.js)

   Marcel 12.11.2026: „Wenn wir kein Bild haben im Investment-PDF, koennte man
   auch ein Geo-Bild reinladen mit Punkt von OpenStreetMap."

   WARUM SERVERSEITIG: Die Tile Usage Policy von tile.openstreetmap.org
   verlangt einen erkennbaren User-Agent, Zwischenspeichern und geringe Last.
   Der Browser holt die Kacheln deshalb nicht selbst, sondern ueber
   GET /api/v1/lagekarte/kachel/:z/:x/:y.png - jede Kachel geht hoechstens
   einmal je FRISCH_TAGE an OSM, danach kommt sie aus der Ablage.

   - Abgefragt werden NUR Kachelnummern (z/x/y) - keine Adresse, keine
     Koordinate des Objekts, kein Nutzerbezug verlaesst den Server.
   - Kosten: 0 EUR (OSM-Kacheln sind frei; Lizenz ODbL, Namensnennung
     „© OpenStreetMap-Mitwirkende" steht im Bild, lagekarte.js).
   - Ratenbegrenzung: hoechstens NETZ_JE_MINUTE Abrufe an OSM je Minute und
     NETZ_PARALLEL gleichzeitig; darueber 429 - die Lagekarte faellt dann weg,
     das PDF entsteht wie vorher ohne Bild.
   - Faellt OSM aus und liegt eine aeltere Kachel in der Ablage, kommt die
     aeltere (lieber eine Woche alte Strasse als keine Karte).
   Zusammengesetzt wird im Browser (Leinwand, Punkt, Namensnennung) - das
   Backend hat keine Bildbibliothek und braucht dafuer keine.
   ═══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const QUELLE = 'https://tile.openstreetmap.org';
/* generischer Name, keine Personendaten (Policy: „clearly identifying User-Agent") */
const USER_AGENT = 'DealPilot-Lagekarte/1.0 (Kachel-Cache fuer PDF-Lagekarten)';
const ZOOM_MIN = 10, ZOOM_MAX = 18;
const FRISCH_TAGE = 30;
const NETZ_JE_MINUTE = 60, NETZ_PARALLEL = 2;

function ablageVerzeichnis() {
  return process.env.OSM_KACHEL_DIR || path.join(process.env.UPLOAD_DIR || '/app/uploads', 'osm-kacheln');
}

/** z, x, y als ganze Zahlen im gueltigen Bereich - sonst null */
function pruefen(z, x, y) {
  const Z = Number(z), X = Number(x), Y = Number(y);
  if (![Z, X, Y].every(Number.isInteger)) return null;
  if (Z < ZOOM_MIN || Z > ZOOM_MAX) return null;
  const n = Math.pow(2, Z);
  if (X < 0 || Y < 0 || X >= n || Y >= n) return null;
  return { z: Z, x: X, y: Y };
}

function pfad(dir, k) { return path.join(dir, String(k.z), String(k.x), k.y + '.png'); }

/* Ratenbegrenzung: gleitendes Minutenfenster + Zahl gleichzeitiger Abrufe */
const _zeiten = [];
let _laufend = 0;
const _unterwegs = new Map();   /* dieselbe Kachel nur einmal gleichzeitig holen */
function _freigabe(jetzt) {
  while (_zeiten.length && jetzt - _zeiten[0] > 60000) _zeiten.shift();
  return _zeiten.length < NETZ_JE_MINUTE && _laufend < NETZ_PARALLEL;
}

function _fehler(status, text) { const e = new Error(text); e.status = status; return e; }

/** PNG-Signatur - alles andere wird nicht gespeichert und nicht ausgeliefert */
function istPng(buf) {
  return Buffer.isBuffer(buf) && buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

/**
 * Liefert { buf, herkunft: 'ablage' | 'netz' | 'ablage-alt' }.
 * o.fetchFn / o.dir / o.jetzt nur fuer den Pruefer (tools/lagekarte-pruefen.mjs).
 */
async function kachel(z, x, y, o) {
  o = o || {};
  const k = pruefen(z, x, y);
  if (!k) throw _fehler(400, 'kachel_ungueltig');
  const dir = o.dir || ablageVerzeichnis();
  const datei = pfad(dir, k);
  const jetzt = o.jetzt || Date.now();
  let alt = null;
  try {
    const st = fs.statSync(datei);
    const buf = fs.readFileSync(datei);
    if (istPng(buf)) {
      if (jetzt - st.mtimeMs < FRISCH_TAGE * 86400000) return { buf, herkunft: 'ablage' };
      alt = buf;
    }
  } catch (e) { /* nicht in der Ablage */ }

  const schluessel = datei;
  if (_unterwegs.has(schluessel)) return _unterwegs.get(schluessel);
  if (!_freigabe(jetzt)) {
    if (alt) return { buf: alt, herkunft: 'ablage-alt' };
    throw _fehler(429, 'kachel_rate');
  }
  const fetchFn = o.fetchFn || globalThis.fetch;
  _zeiten.push(jetzt); _laufend++;
  const lauf = (async () => {
    await null;   /* erst nach _unterwegs.set weiterlaufen, sonst raeumt finally vor dem Eintrag ab */
    try {
      const r = await fetchFn(QUELLE + '/' + k.z + '/' + k.x + '/' + k.y + '.png', {
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/png' },
        signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(10000) : undefined,
      });
      if (!r || !r.ok) throw _fehler(502, 'kachel_quelle_' + (r ? r.status : 'x'));
      const buf = Buffer.from(await r.arrayBuffer());
      if (!istPng(buf)) throw _fehler(502, 'kachel_kein_png');
      try {
        fs.mkdirSync(path.dirname(datei), { recursive: true });
        const tmp = datei + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, buf); fs.renameSync(tmp, datei);
      } catch (e) { /* Ablage voll/gesperrt: ausliefern geht trotzdem */ }
      return { buf, herkunft: 'netz' };
    } catch (e) {
      if (alt) return { buf: alt, herkunft: 'ablage-alt' };
      throw e.status ? e : _fehler(502, 'kachel_quelle');
    } finally { _laufend--; _unterwegs.delete(schluessel); }
  })();
  _unterwegs.set(schluessel, lauf);
  return lauf;
}

/* nur fuer den Pruefer: Ratenfenster leeren */
function _zuruecksetzen() { _zeiten.length = 0; _laufend = 0; _unterwegs.clear(); }

module.exports = { kachel, pruefen, istPng, ablageVerzeichnis, USER_AGENT, QUELLE, FRISCH_TAGE, NETZ_JE_MINUTE, ZOOM_MIN, ZOOM_MAX, _zuruecksetzen };
