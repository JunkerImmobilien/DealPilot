#!/usr/bin/env node
/* lagekarte-pruefen.mjs · v3336 — Lagekarte (OpenStreetMap) statt leerem Bildplatz im PDF
   Prueft an den ECHTEN Dateien, ohne Netz:
     A  Kachel-Mathematik (frontend/js/lagekarte.js): lat/lon -> Weltpixel gegen die
        Formel des OSM-Wikis (Slippy map tilenames) und feste Punkte; der Punkt liegt
        genau in der Bildmitte, die Kacheln decken den Ausschnitt luecken- und doppelfrei
     B  ohne Koordinaten kein Bild (kein Abruf, null)
     C  Kachel-Ablage (backend/src/services/osmKacheln.js): erster Abruf geht ans Netz und
        wird abgelegt, der zweite kommt aus der Ablage OHNE Netz; alte Kachel bei Ausfall;
        ungueltige Kachel 400; Ratenbremse 429; kein PNG wird nicht abgelegt; nur z/x/y
        in der Abfrage, User-Agent ohne Personendaten
     D  Verdrahtung: Route, Skript in index.html, die drei PDF-Wege
   RC=0 sauber. */
import { readFileSync, mkdtempSync, rmSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let n = 0, fehler = 0;
const ok = (b, t) => { n++; if (!b) fehler++; console.log((b ? '  ok   ' : '  ROT  ') + t); };
const nah = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6);

const LK = require(join(WURZEL, 'frontend', 'js', 'lagekarte.js'));
const OSM = require(join(WURZEL, 'backend', 'src', 'services', 'osmKacheln.js'));

/* ── A · Kachel-Mathematik ─────────────────────────────────────────── */
console.log('A · Kachel-Mathematik');
function wiki(lat, lon, z) {   /* OSM-Wiki, Slippy map tilenames (unabhaengig geschrieben) */
  const n = Math.pow(2, z), r = lat * Math.PI / 180;
  return { x: (lon + 180) / 360 * n * 256, y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n * 256 };
}
let w = LK.welt(0, 0, 0); ok(nah(w.x, 128) && nah(w.y, 128), 'lat 0 / lon 0 bei Zoom 0 = Pixel 128/128');
w = LK.welt(0, 0, 1); ok(nah(w.x, 256) && nah(w.y, 256), 'lat 0 / lon 0 bei Zoom 1 = Pixel 256/256 (Kachelecke)');
w = LK.welt(0, -180, 3); ok(nah(w.x, 0), 'lon -180 = linker Rand');
w = LK.welt(85.0511287798, 0, 2); ok(nah(w.y, 0, 1e-3), 'lat 85,0511 = oberer Rand');
const PUNKTE = [['Hermannstr. 9, Hüllhorst', 52.2861968, 8.656101], ['Brandenburger Tor', 52.516275, 13.377704], ['Zugspitze', 47.421111, 10.985278], ['List auf Sylt', 55.0183, 8.4314], ['Suedhalbkugel', -33.8568, 151.2153]];
for (const [name, la, lo] of PUNKTE) {
  const a = LK.welt(la, lo, 16), b = wiki(la, lo, 16);
  ok(nah(a.x, b.x, 1e-4) && nah(a.y, b.y, 1e-4), name + ': Weltpixel wie OSM-Wiki (' + Math.floor(b.x / 256) + '/' + Math.floor(b.y / 256) + ')');
}
/* bekannte Kachel: Brandenburger Tor liegt bei Zoom 16 in 35203/21493 (am 12.11.2026 die Kachel 16/35203/21493 ueber die Staging-Route angesehen: Pariser Platz mit Tor) */
w = LK.welt(52.516275, 13.377704, 16);
ok(Math.floor(w.x / 256) === 35203 && Math.floor(w.y / 256) === 21493, 'Brandenburger Tor Zoom 16 = Kachel 35203/21493');

for (const [name, la, lo] of PUNKTE.slice(0, 3)) {
  for (const [b, h] of [[760, 427], [728, 400], [728, 232], [640, 256]]) {
    const p = LK.plan(la, lo, b, h, 16), m = LK.welt(la, lo, 16);
    /* Punkt in der Mitte: Weltpixel - Kachelursprung + dx = b/2 */
    const k0 = p.liste[0];
    const px = m.x - k0.x * 256 + k0.dx, py = m.y - k0.y * 256 + k0.dy;
    const mitte = nah(px, b / 2, 1e-6) && nah(py, h / 2, 1e-6);
    /* Deckung: jedes Pixel des Ausschnitts genau einmal (Stichprobe auf 4-px-Raster) */
    let luecke = 0, doppelt = 0;
    for (let yy = 0; yy < h; yy += 4) for (let xx = 0; xx < b; xx += 4) {
      const t = p.liste.filter((k) => xx >= k.dx && xx < k.dx + 256 && yy >= k.dy && yy < k.dy + 256).length;
      if (t === 0) luecke++; if (t > 1) doppelt++;
    }
    ok(mitte && !luecke && !doppelt && p.liste.length <= 12, name + ' ' + b + 'x' + h + ': Punkt mittig, ' + p.liste.length + ' Kacheln, Deckung luecken- und doppelfrei');
  }
}

/* ── B · ohne Koordinaten kein Bild ─────────────────────────────────── */
console.log('B · ohne Koordinaten kein Bild');
for (const [la, lo, t] of [[null, null, 'null'], [undefined, 8, 'undefined'], ['', '', 'leer'], [0, 0, 'Nullinsel 0/0'], [NaN, 8, 'NaN'], [95, 8, 'lat 95'], [52, 200, 'lon 200']]) {
  ok(LK.koordOk(la, lo) === false, 'koordOk(' + t + ') = false');
}
ok(LK.koordOk(52.28, 8.65) === true, 'koordOk(52,28 / 8,65) = true');
let abrufe = 0; const echtFetch = globalThis.fetch; globalThis.fetch = () => { abrufe++; return Promise.reject(new Error('kein Netz im Pruefer')); };
ok((await LK.bild(null, null, {})) === null && abrufe === 0, 'bild(null, null) = null ohne einen Abruf');
ok((await LK.fuerAdresse('', {})) === null && abrufe === 0, 'fuerAdresse("") = null ohne Abruf');
ok((await LK.fuerAdresse('Hüllhorst', {})) === null && abrufe === 0, 'Anschrift ohne Hausnummer/PLZ = null ohne Abruf');
globalThis.fetch = echtFetch;

/* ── C · Kachel-Ablage ─────────────────────────────────────────────── */
console.log('C · Kachel-Ablage (services/osmKacheln.js)');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a8c3d39c0000000049454e44ae426082', 'hex');
const dir = mkdtempSync(join(tmpdir(), 'osm-kachel-'));
const urls = [], kopf = [];
const netz = (antwort) => async (url, opt) => { urls.push(url); kopf.push(opt && opt.headers); return antwort(); };
const gut = netz(() => ({ ok: true, status: 200, arrayBuffer: async () => PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.length) }));
const tot = async () => { throw new Error('kein Netz'); };
try {
  OSM._zuruecksetzen();
  const a = await OSM.kachel(16, 34289, 21453, { dir, fetchFn: gut });
  ok(a.herkunft === 'netz' && OSM.istPng(a.buf) && urls.length === 1, 'erster Abruf: aus dem Netz, PNG');
  ok(urls[0] === 'https://tile.openstreetmap.org/16/34289/21453.png', 'Abfrage traegt nur z/x/y: ' + urls[0]);
  const ua = kopf[0] && kopf[0]['User-Agent'];
  ok(!!ua && /^DealPilot-Lagekarte\//.test(ua) && !/@|junker|marcel/i.test(ua), 'eigener User-Agent ohne Personendaten: ' + ua);
  const datei = join(dir, '16', '34289', '21453.png');
  ok(existsSync(datei), 'abgelegt unter z/x/y.png');
  const b = await OSM.kachel(16, 34289, 21453, { dir, fetchFn: tot });
  ok(b.herkunft === 'ablage' && b.buf.equals(PNG), 'zweiter Abruf: aus der Ablage, OHNE Netz');
  const spaeter = Date.now() + (OSM.FRISCH_TAGE + 1) * 86400000;
  const c = await OSM.kachel(16, 34289, 21453, { dir, fetchFn: tot, jetzt: spaeter });
  ok(c.herkunft === 'ablage-alt', 'nach ' + (OSM.FRISCH_TAGE + 1) + ' Tagen und Netzausfall: die alte Kachel');
  urls.length = 0;
  const d = await OSM.kachel(16, 34289, 21453, { dir, fetchFn: gut, jetzt: spaeter });
  ok(d.herkunft === 'netz' && urls.length === 1, 'nach Ablauf mit Netz: neu geholt');
  utimesSync(datei, new Date(), new Date());
  for (const [z, x, y, t] of [[9, 1, 1, 'Zoom 9'], [19, 1, 1, 'Zoom 19'], [16, -1, 0, 'x negativ'], [16, 65536, 0, 'x ausserhalb'], ['16', '1.5', '2', 'Bruch'], ['16', 'a', '2', 'Text'], ['../16', 1, 1, 'Pfad']]) {
    let st = null; try { await OSM.kachel(z, x, y, { dir, fetchFn: gut }); } catch (e) { st = e.status; }
    ok(st === 400, 'ungueltige Kachel (' + t + ') = 400');
  }
  let st = null; try { await OSM.kachel(16, 100, 100, { dir, fetchFn: netz(() => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('<html>').buffer })) }); } catch (e) { st = e.status; }
  ok(st === 502 && !existsSync(join(dir, '16', '100', '100.png')), 'Antwort ohne PNG: 502, nichts abgelegt');
  st = null; try { await OSM.kachel(16, 101, 100, { dir, fetchFn: netz(() => ({ ok: false, status: 503 })) }); } catch (e) { st = e.status; }
  ok(st === 502, 'Kachelserver 503: 502 (Lagekarte faellt weg, PDF wie vorher)');
  OSM._zuruecksetzen();
  let erste429 = null;
  for (let i = 0; i < OSM.NETZ_JE_MINUTE + 3; i++) {
    try { await OSM.kachel(16, 200 + i, 300, { dir, fetchFn: gut }); } catch (e) { if (e.status === 429 && erste429 === null) erste429 = i; }
  }
  ok(erste429 === OSM.NETZ_JE_MINUTE, 'Ratenbremse: Abruf Nr. ' + (OSM.NETZ_JE_MINUTE + 1) + ' in der Minute = 429 (gemessen: ' + erste429 + ')');
  const e = await OSM.kachel(16, 34289, 21453, { dir, fetchFn: tot });
  ok(e.herkunft === 'ablage', 'Ratenbremse greift nicht fuer Kacheln aus der Ablage');
  OSM._zuruecksetzen();
  /* zwei gleichzeitige Abrufe derselben Kachel = ein Netzabruf */
  urls.length = 0;
  const [p1, p2] = await Promise.all([OSM.kachel(16, 500, 500, { dir, fetchFn: gut }), OSM.kachel(16, 500, 500, { dir, fetchFn: gut })]);
  ok(urls.length === 1 && p1.buf.equals(p2.buf), 'gleichzeitige Abrufe derselben Kachel: ein Netzabruf');
  /* eine Lagekarte = bis zu 12 Kacheln auf einmal: alle kommen an, hoechstens 2 gleichzeitig beim Kachelserver
     (erster Lauf auf Staging: ohne Schlange bekamen 10 von 12 ein 429, die Karte fiel weg) */
  OSM._zuruecksetzen();
  let gleichzeitig = 0, spitze = 0;
  const langsam = async () => { gleichzeitig++; spitze = Math.max(spitze, gleichzeitig); await new Promise((r) => setTimeout(r, 30)); gleichzeitig--;
    return { ok: true, status: 200, arrayBuffer: async () => PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.length) }; };
  const zwoelf = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => OSM.kachel(16, 700 + (i % 4), 900 + Math.floor(i / 4), { dir, fetchFn: langsam })));
  ok(zwoelf.every((r) => r.status === 'fulfilled' && r.value.herkunft === 'netz') && spitze <= 2, '12 Kacheln gleichzeitig: alle geliefert, Spitze ' + spitze + ' gleichzeitig beim Kachelserver');
} finally { rmSync(dir, { recursive: true, force: true }); OSM._zuruecksetzen(); }

/* ── D · Verdrahtung ───────────────────────────────────────────────── */
console.log('D · Verdrahtung');
const lies = (p) => readFileSync(join(WURZEL, p), 'utf8');
ok(/app\.use\('\/api\/v1\/lagekarte',[^\n]*rateLimit[^\n]*require\('\.\/routes\/lagekarte'\)/.test(lies('backend/src/index.js')), 'Route /api/v1/lagekarte eingehaengt, mit rateLimit');
ok(/router\.get\('\/kachel\/:z\/:x\/:y\.png', authenticate/.test(lies('backend/src/routes/lagekarte.js')), 'Kachelroute nur angemeldet');
const idx = lies('frontend/index.html');
ok(/<script src="js\/lagekarte\.js\?v=v\d+[a-z]?"><\/script>/.test(idx), 'index.html laedt lagekarte.js');
ok(/DpLagekarte\.bild\(/.test(lies('frontend/js/dp-dokumente.js')), 'dp-dokumente.js: Deckblatt ohne Foto -> Lagekarte');
ok(/DpLagekarte\.fuerAdresse\(/.test(lies('frontend/js/pdf.js')), 'pdf.js: Deckblatt ohne Foto -> Lagekarte');
ok(/DpLagekarte\.fuerAdresse\(/.test(lies('frontend/js/pdf-investment-bank.js')), 'pdf-investment-bank.js: Titelbild ohne Foto -> Lagekarte');
const lk = lies('frontend/js/lagekarte.js');
ok(!/tile\.openstreetmap\.org/.test(lk.replace(/\/\*[\s\S]*?\*\//g, '')), 'der Browser ruft tile.openstreetmap.org nie selbst ab');
ok(/OpenStreetMap-Mitwirkende/.test(lk) && /fillText\(VERMERK/.test(lk), 'Namensnennung „© OpenStreetMap-Mitwirkende“ wird ins Bild gezeichnet');

console.log(fehler ? '\nROT: ' + fehler + ' von ' + n + ' Punkten' : '\nsauber (RC=0), ' + n + ' Punkte');
process.exit(fehler ? 1 : 0);
