'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * scripts/fotos-pruefen.js — v3310 · Objektfotos in der Ablage, echter Lauf gegen die echte Datenbank
 *
 *   docker exec dealpilot-backend node scripts/fotos-pruefen.js <user-id>      NUR STAGING (legt an, löscht wieder)
 *
 * Ruft die echten Funktionen (objectService.create/update/getById/deleteObject, objektFotos) mit zwei
 * selbst erzeugten Bildern (keine echten Fotos) und prüft:
 *   1 Anlegen: in objects.photos stehen Verweise, keine base64-Bilder; erstes Foto bleibt ohne _thumb inline
 *   2 Lesen:   getById liefert wieder genau die data-URLs (Byte für Byte)
 *   3 Speichern mit denselben Fotos: dieselben Verweise, keine neue Datei
 *   4 Kopieren (GET → POST wie das Frontend): eigene Dateien am neuen Objekt, Bilder gleich
 *   5 Foto entfernen: Datei bleibt in der Nachfrist, danach weg
 *   6 fremder Verweis (anderes Konto) wird beim Speichern verworfen und beim Lesen nicht aufgelöst
 *   7 Objekt löschen: seine Fotodateien sind weg; Liste/Speicherplatz der Ablage zählen keine Fotos
 *   8 Altbestand: eine base64-Zeile ohne Verweis liest sich unverändert
 * RC=0 sauber.
 * ═══════════════════════════════════════════════════════════════════════════ */
const zlib = require('zlib');
const { pool, query } = require('../src/db/pool');
const objectService = require('../src/services/objectService');
const objektFotos = require('../src/services/objektFotos');
const ablage = require('../src/services/dateiAblage');

if (/157\.90\.117\.167|prod/i.test(String(process.env.PUBLIC_URL || process.env.APP_URL || ''))) { console.error('nur Staging'); process.exit(2); }
const userId = process.argv[2];
let fehler = 0;
const ok = (t) => console.log('  ok   ' + t);
const rot = (t) => { fehler++; console.log('  ROT  ' + t); };

/* ein echtes kleines PNG (einfarbig), damit es kein Platzhalter-Text ist */
function png(r, g, b) {
  const crc = (buf) => { let c, crcT = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
    let x = 0xffffffff; for (const v of buf) x = crcT[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const w = 64, h = 48, roh = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; roh[o] = r; roh[o + 1] = (g + x) & 255; roh[o + 2] = (b + y) & 255; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const datei = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(roh)), chunk('IEND', Buffer.alloc(0))]);
  return 'data:image/png;base64,' + datei.toString('base64');
}
const rohFotos = async (id) => (await query('SELECT photos FROM objects WHERE id = $1', [id])).rows[0].photos;
const fotoDateien = async (id, alle) => (await query("SELECT id FROM dateien WHERE object_id = $1 AND quelle = 'objektfoto'" + (alle ? '' : ' AND deleted_at IS NULL'), [id])).rows.map((r) => r.id);

(async () => {
  if (!userId) { console.error('Aufruf: node scripts/fotos-pruefen.js <user-id>'); process.exit(2); }
  if (!ablage.bereit()) { rot('Ablage nicht eingerichtet (DATEI_SCHLUESSEL)'); process.exit(1); }
  const A = png(200, 40, 40), B = png(40, 160, 60), C = png(30, 60, 200);
  const data = { _name: 'v3310 Fotoprüfung (wird gelöscht)', str: 'Prüfstraße', hnr: '1', ort: 'Teststadt', _thumb: 'data:image/jpeg;base64,AAAA' };
  const neu = [];
  try {
    /* 1 */
    const o = await objectService.create(userId, { data: Object.assign({}, data), aiAnalysis: null, photos: [A, B] });
    neu.push(o.id);
    const roh1 = await rohFotos(o.id);
    if (roh1.length === 2 && roh1.every(objektFotos.istVerweis)) ok('Anlegen: Zeile hält 2 Verweise (' + JSON.stringify(roh1).length + ' Zeichen statt ' + (A.length + B.length) + ')');
    else rot('Anlegen: Zeile hält ' + JSON.stringify(roh1).slice(0, 120));
    const o0 = await objectService.create(userId, { data: { _name: 'v3310 ohne _thumb' }, aiAnalysis: null, photos: [A, B] });
    neu.push(o0.id);
    const roh0 = await rohFotos(o0.id);
    if (roh0[0] === A && objektFotos.istVerweis(roh0[1])) ok('ohne _thumb bleibt das Titelbild inline (Objektliste), das zweite wandert');
    else rot('ohne _thumb: ' + JSON.stringify(roh0).slice(0, 120));
    /* 2 */
    const g = await objectService.getById(userId, o.id);
    if (g.photos.length === 2 && g.photos[0] === A && g.photos[1] === B) ok('Lesen: getById liefert dieselben data-URLs Byte für Byte');
    else rot('Lesen: ' + (g.photos || []).map((p) => String(p).slice(0, 30)).join(' | '));
    const roh = await objectService.getById(userId, o.id, { fotos: false });
    if (roh.photos.every(objektFotos.istVerweis)) ok('getById(…, {fotos:false}) liefert Verweise ohne Laufwerk'); else rot('fotos:false löste auf');
    /* 3 */
    const vorDat = await fotoDateien(o.id);
    await objectService.update(userId, o.id, { data: Object.assign({}, data), aiAnalysis: null, photos: g.photos });
    const roh3 = await rohFotos(o.id), nachDat = await fotoDateien(o.id);
    if (JSON.stringify(roh3) === JSON.stringify(roh1) && nachDat.length === vorDat.length) ok('erneut speichern: dieselben Verweise, keine neue Datei (' + nachDat.length + ')');
    else rot('erneut speichern: ' + vorDat.length + ' → ' + nachDat.length + ' Dateien');
    /* 4 */
    const k = await objectService.create(userId, { data: Object.assign({}, data, { _name: 'v3310 Kopie' }), aiAnalysis: null, photos: g.photos });
    neu.push(k.id);
    const gk = await objectService.getById(userId, k.id), rohK = await rohFotos(k.id);
    const kDat = await fotoDateien(k.id);
    if (gk.photos[0] === A && gk.photos[1] === B && kDat.length === 2 && !rohK.some((p) => roh1.includes(p))) ok('Kopie: eigene 2 Dateien, gleiche Bilder');
    else rot('Kopie: ' + kDat.length + ' Dateien, gleich=' + (gk.photos[0] === A));
    /* 5 */
    await objectService.update(userId, o.id, { data: Object.assign({}, data), aiAnalysis: null, photos: [A, C] });
    const d5a = await fotoDateien(o.id);
    if (d5a.length === 3) ok('Foto ersetzt: alte Datei bleibt in der Nachfrist (' + objektFotos.NACHFRIST_MIN + ' min)'); else rot('Nachfrist: ' + d5a.length + ' Dateien');
    await query("UPDATE dateien SET created_at = NOW() - INTERVAL '10 minutes' WHERE object_id = $1 AND quelle = 'objektfoto'", [o.id]);
    await objektFotos.aufraeumen(userId, o.id);
    const d5b = await fotoDateien(o.id), g5 = await objectService.getById(userId, o.id);
    if (d5b.length === 2 && g5.photos[0] === A && g5.photos[1] === C) ok('nach der Nachfrist: entferntes Foto weg, die beiden gültigen lesbar'); else rot('nach Nachfrist: ' + d5b.length);
    /* 6 */
    const fremd = (await query("SELECT id FROM users WHERE id <> $1 LIMIT 1", [userId])).rows[0];
    const fremdVerweis = objektFotos.PRAEFIX + (await fotoDateien(o.id))[0];
    if (fremd) {
      const aus = await objektFotos.zumSpeichern(fremd.id, k.id, [fremdVerweis], { _thumb: 'x' });
      const gelesen = await objektFotos.zumLesen(fremd.id, [fremdVerweis]);
      if (aus.length === 0 && gelesen.length === 0) ok('fremder Verweis: beim Speichern verworfen, beim Lesen nicht aufgelöst');
      else rot('fremder Verweis kam durch');
    }
    /* 7 */
    const st = await ablage.stand(userId), li = await ablage.liste(userId, o.id);
    if (!li.length) ok('Ablage-Liste zeigt keine Objektfotos'); else rot('Ablage-Liste zeigt ' + li.length + ' Fotos');
    const kid = k.id;
    await objectService.deleteObject(userId, kid); neu.splice(neu.indexOf(kid), 1);
    const kRest = await fotoDateien(kid);
    if (!kRest.length) ok('Objekt gelöscht: seine Fotodateien sind weg (Speicherplatz zählt sie nicht: ' + st.anzahl + ' Unterlagen)');
    else rot('nach dem Löschen noch ' + kRest.length + ' Dateien');
    /* 8 */
    const alt = await objektFotos.zumLesen(userId, [A, B]);
    if (alt[0] === A && alt[1] === B) ok('Altbestand (base64) liest sich unverändert'); else rot('Altbestand verändert');
  } catch (e) { rot('Lauf: ' + e.message); }
  finally {
    for (const id of neu) { try { await objectService.deleteObject(userId, id); } catch (e) { console.log('  aufräumen ' + id + ': ' + e.message); } }
    await pool.end();
  }
  console.log(fehler ? 'ROT: ' + fehler : 'sauber (RC=0)');
  process.exit(fehler ? 1 : 0);
})();
