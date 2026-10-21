#!/usr/bin/env node
/* tools/handbuch-bilder.mjs — v2560 · Bildschirmfotos → frontend/handbuch/bilder/
 *
 * Zweiter Schritt der Bildaufnahme fuer das Flughandbuch (der erste ist
 * frontend/handbuch/aufnahme.js im Browser auf Staging):
 *
 *   Die Aufnahme liefert je Objektart eine Kurzliste (eine Zeile je Reiter,
 *   eine Zeile je Bild) und die PNG-Bildschirmfotos des Ausschnitts
 *   [388,72]–[1359,725] im Bildschirmfoto-Rahmen (= CSS 528/98 bis 1848/987
 *   bei 2133 × 987 CSS-Pixeln). Dieses Werkzeug schneidet jedes Foto auf den
 *   Rahmen des Bildes zu, schreibt es als WebP und baut
 *   frontend/handbuch/bilder/aufnahme.json — die Datei, die
 *   tools/handbuch-erzeugen.mjs als GEMESSENE Sichtbarkeit liest.
 *
 * Kurzliste (eine Datei je Objektart, Name komp-<ART>.txt):
 *   <sec>|<id,id,…>|<Felder je Bild, z. B. 18,7,2>      sichtbare Felder in Bildreihenfolge
 *   C|<datei.webp>|<x0,y0,x1,y1 in CSS>|<Nr. des PNG>   ein Reiter-Bild
 *   W|<datei.webp>|<Unterschrift>|<Nr. des PNG>          ein Bild der Wohnungsliste (ungeschnitten)
 *
 * Aufruf: node tools/handbuch-bilder.mjs <png-ordner> <komp-ETW.txt> <komp-EFH.txt> <komp-MFH.txt>
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = path.join(WURZEL, 'frontend', 'handbuch', 'bilder');
const [ordner, ...kompDateien] = process.argv.slice(2);
if (!ordner || !kompDateien.length) { console.error('Aufruf: node tools/handbuch-bilder.mjs <png-ordner> <komp-*.txt …>'); process.exit(2); }

/* Ausschnitt der Aufnahme in CSS-Pixeln und der Massstab Bild/CSS (gemessen:
   971 Rahmenpixel → 1189 Bildpixel; Rahmen 1568 ↔ 2133 CSS) */
const X0 = 388 * 2133 / 1568, Y0 = 72 * 987 / 726;
const S = 1189 / (971 * 2133 / 1568);

/* Beispielwerte aus aufnahme.js — dieselben, die ins Formular gingen */
const k = { innerWidth: 2133, innerHeight: 987, document: {}, console };
k.window = k; vm.createContext(k);
new vm.Script(fs.readFileSync(path.join(WURZEL, 'frontend', 'handbuch', 'aufnahme.js'), 'utf8')).runInContext(k);
const BSP = k.DPHB.beispiel;

const png = fs.readdirSync(ordner).filter((f) => /\.png$/.test(f));
const finde = (nr) => { const f = png.find((x) => new RegExp('-' + nr + '\\.png$').test(x)); if (!f) throw new Error('PNG Nr. ' + nr + ' fehlt'); return path.join(ordner, f); };

fs.mkdirSync(ZIEL, { recursive: true });
const erg = { am: new Date().toISOString().slice(0, 10), ansicht: { breite: 2133, hoehe: 987, hinweis: 'Desktop, Eingabetiefe 3, weitere Objektdetails an' }, arten: {} };
let n = 0;
for (const datei of kompDateien) {
  const art = /komp-([A-Z]+)\.txt$/.exec(datei)[1];
  const A = erg.arten[art] = { beispiel: BSP[art], reiter: {} };
  const zeilen = fs.readFileSync(datei, 'utf8').split(/\r?\n/).filter(Boolean);
  const bilder = zeilen.filter((z) => z.startsWith('C|'));
  for (const z of zeilen.filter((z) => !/^[CWEMP]\|/.test(z))) {
    const [sec, ids, teile] = z.split('|');
    const sichtbar = ids.split(','), nummer = {}; sichtbar.forEach((id, i) => { nummer[id] = i + 1; });
    let p = 0; const bl = teile.split(',').map(Number).map((anz, i) => { const f = sichtbar.slice(p, p + anz); p += anz; return { datei: 'hb-' + art.toLowerCase() + '-' + sec + '-' + (i + 1) + '.webp', felder: f }; });
    A.reiter[sec] = { sichtbar, nummer, bilder: bl };
  }
  /* E|sec|ids|anzahl je Bild: Felder, die erst nach einer Auswahl erscheinen (Nummern laufen weiter) */
  for (const z of zeilen.filter((z) => z.startsWith('E|'))) {
    const [, sec, ids, teile] = z.split('|'); const R = A.reiter[sec]; const felder = ids.split(','), nummer = {};
    felder.forEach((id, i) => { nummer[id] = R.sichtbar.length + i + 1; });
    let p = 0;
    R.extra = { felder, nummer, bilder: teile.split(',').map(Number).map((anz, i) => { const f = felder.slice(p, p + anz); p += anz; return { datei: 'hb-' + art.toLowerCase() + '-' + sec + '-x' + (i + 1) + '.webp', felder: f }; }) };
  }
  /* M|sec|datei|ids: Handy-Bild (390 px) */
  for (const z of zeilen.filter((z) => z.startsWith('M|'))) {
    const [, sec, datei, ids] = z.split('|'); const R = A.reiter[sec];
    (R.mobil = R.mobil || { bilder: [] }).bilder.push({ datei, felder: ids.split(',') });
  }
  for (const z of bilder) {
    /* C|datei|css|png[|ox,oy,massstab|rx0,ry0,rx1,ry1]: ohne Einbettung der feste Desktop-Ausschnitt;
       mit Einbettung (Handy-iframe) liegen die CSS-Werte im iframe und werden ins Fenster umgerechnet */
    const [, webp, css, nr, einb, reg] = z.split('|');
    let [x0, y0, x1, y1] = css.split(',').map(Number);
    let R0 = [X0, Y0, X0 + 1189 / S, Y0 + 800 / S];
    if (einb) { const [ox, oy, m] = einb.split(',').map(Number); [x0, y0, x1, y1] = [ox + x0 * m, oy + y0 * m, ox + x1 * m, oy + y1 * m]; R0 = reg.split(',').map(Number); }
    const [bw, bh] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', finde(nr)]).toString().trim().split(',').map(Number);
    const s2 = bw / (R0[2] - R0[0]);
    const cx = Math.max(0, Math.round((x0 - R0[0]) * s2)), cy = Math.max(0, Math.round((y0 - R0[1]) * s2));
    const cw = Math.min(bw - cx, Math.round((x1 - x0) * s2)), ch = Math.min(bh - cy, Math.round((y1 - y0) * s2));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', finde(nr), '-vf', 'crop=' + cw + ':' + ch + ':' + cx + ':' + cy, '-c:v', 'libwebp', '-quality', '82', path.join(ZIEL, webp)]);
    n++;
  }
  /* P|datei|id:x:y;… - Mittelpunkte der Nummernmarken als Anteil am Bild (fuer klickbare Nummern) */
  const marken = {};
  for (const z of zeilen.filter((z) => z.startsWith('P|'))) {
    const [, datei, liste] = z.split('|');
    marken[datei] = (liste || '').split(';').filter(Boolean).map((m) => { const [id, x, y] = m.split(':'); return { id, x: +x, y: +y }; });
  }
  for (const R of Object.values(A.reiter)) {
    [].concat(R.bilder || [], (R.extra && R.extra.bilder) || [], (R.mobil && R.mobil.bilder) || []).forEach((b) => { if (marken[b.datei]) b.marken = marken[b.datei]; });
  }
  for (const z of zeilen.filter((z) => z.startsWith('W|'))) {
    const [, webp, unterschrift, nr] = z.split('|');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', finde(nr), '-c:v', 'libwebp', '-quality', '82', path.join(ZIEL, webp)]);
    (A.wohnungen = A.wohnungen || []).push({ datei: webp, unterschrift });
    n++;
  }
}
fs.writeFileSync(path.join(ZIEL, 'aufnahme.json'), JSON.stringify(erg, null, 1) + '\n');
console.log(n + ' Bilder geschrieben, aufnahme.json mit ' + Object.keys(erg.arten).join(', '));
