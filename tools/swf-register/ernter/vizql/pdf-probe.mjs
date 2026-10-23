// v2887 · Gegenprobe einer Sitzungsernte gegen den PDF-Export des Kalkulators.
//
// Die PDF-Route (public.tableau.com/views/<wb>/<view>.pdf?<Parameter>=<Wert>) rechnet unabhaengig von
// unserer Sitzung. Je Aufruf nur EIN rechnender Parameter - zwei zugleich leeren den Faktor (gemessen
// 22.10.2026). Listen-Parameter nehmen den WERT der Liste (Lagesowst=1), nicht die Beschriftung; deshalb
// wird das Label im Rechenblock des PDF mitgelesen und mit der erwarteten Beschriftung verglichen.
//
// Braucht pdftotext (poppler) im PATH. Schreibt <AUS>/ernte/pdf-proben.json.
// Aufruf: node pdf-probe.mjs <wb> '<json-Liste der Proben>'
//   Probe: {"query":"Sach=250000","kombi":"Lagesowst=Weyhe/Stuhr","sach":250000,"brw":null,"label":"Weyhe/Stuhr"}
import * as PF from './pfade.mjs';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [wb, roh] = process.argv.slice(2);
const e = JSON.parse(readFileSync(PF.AUS + 'ernte/' + wb + '.json', 'utf8'));
const ziel = PF.AUS + 'ernte/pdf-proben.json';
const alle = existsSync(ziel) ? JSON.parse(readFileSync(ziel, 'utf8')) : {};
const out = [];
const tmp = mkdtempSync(join(tmpdir(), 'pdfprobe-'));
for (const p of JSON.parse(roh)) {
  const url = `https://public.tableau.com/views/${wb}/${e.view}.pdf?:showVizHome=no&${p.query}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)' } });
  const f = join(tmp, 'p.pdf'); writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  let txt = ''; try { txt = execFileSync('pdftotext', ['-enc', 'UTF-8', f, '-'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (x) { txt = ''; }
  const flach = txt.replace(/\s+/g, ' ');
  const m = /Standardabweichung:\s*(\d,\d\d)\s*±\s*(\d,\d\d)/.exec(flach);
  /* Rechenblock: von der Ueberschrift bis zur Standardabweichung. pdftotext zerlegt die Ligatur "tf"
     ("Sachwer aktor"), deshalb nicht am Wort "Sachwertfaktor" schneiden. */
  const block = (/Berechnung des Sachwer.{0,4}aktors(.*?)Standardabweichung/.exec(flach) || /^(.*?)Standardabweichung/.exec(flach) || [])[1] || '';
  const pdf = m ? Number(m[1].replace(',', '.')) : null;
  const K = e.kombis.find((k) => k.name === p.kombi);
  const zelle = K ? K.zellen[String(p.brw ?? null)][e.sachs.indexOf(p.sach)] : undefined;
  const labelOk = p.label ? block.includes(p.label) : true;
  const erg = { ...p, pdf, sd: m ? Number(m[2].replace(',', '.')) : null, zelle, label_im_pdf: labelOk, block: block.trim().slice(0, 160), datum: new Date().toISOString().slice(0, 10) };
  console.log((pdf !== null && pdf === zelle && labelOk ? 'OK  ' : 'ROT ') + p.query.padEnd(24), 'PDF', pdf, 'Zelle', zelle, 'Label', labelOk, '|', erg.block.slice(0, 110));
  out.push(erg);
}
rmSync(tmp, { recursive: true, force: true });
alle[wb] = out; writeFileSync(ziel, JSON.stringify(alle, null, 1));
process.exit(out.every((x) => x.pdf !== null && x.pdf === x.zelle && x.label_im_pdf) ? 0 : 1);
