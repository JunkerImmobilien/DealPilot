#!/usr/bin/env node
// pruefe-text.mjs · Kundentext-Pruefung vor der Freigabe (Skill freigabe-pruefung, 22.11.2026)
//
// Aufruf:  node .claude/skills/freigabe-pruefung/pruefe-text.mjs <datei|ordner> ...
//
// Geprueft wird nur KUNDENTEXT. In .md-Dateien ist das der Inhalt von Codebloecken,
// deren Kennung mit "kunde" beginnt (```kunde instagram, ```kunde hook, ```kunde bild ...).
// Hat eine .md-Datei keinen solchen Block, wird die ganze Datei geprueft und ein Hinweis
// ausgegeben. .srt und .txt werden ganz geprueft (Zeitstempel und Nummern uebersprungen).
//
// ROT  = darf so nicht raus (RC 1).  GELB = Marcel oder Agent muss hinsehen (RC 0).
// Der Pruefer ersetzt das Lesen nicht. Er faengt die Fehler, die beim Lesen durchrutschen.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const PREISE = JSON.parse(fs.readFileSync(path.join(HIER, 'preise.json'), 'utf8')).erlaubt_eur;

const ROT = [
  [/[–—]/, 'Gedankenstrich (– oder —) im Kundentext'],
  [/\S - \S/, 'Bindestrich als Gedankenstrich (" - ")'],
  [/;/, 'Semikolon im Kundentext'],
  [/bundesbank|\bboris\b|zensus|immobilienscout|immoscout|\bis24\b|sprengnetter|pricehubble|immowelt|destatis|statistisches bundesamt|regionaldatenbank|\bgenesis\b/i, 'Datenquelle namentlich genannt'],
  [/sparkasse|volksbank|raiffeisen|bbbank|commerzbank|deutsche bank|postbank|\bdkb\b|hypovereinsbank|targobank|sparda|psd bank/i, 'echter Bankname'],
  [/\bING\b/, 'echter Bankname (ING)'],
  [/kerosin|\bliter\b/i, 'abgeschaffter Begriff (heisst Kontingent)'],
  [/revolution|die beste app|die beste software|marktführer|testsieger/i, 'Superlativ, den wir nicht belegen'],
  [/garantiert|garantie|sichere rendite|risikolos|ohne risiko/i, 'Versprechen oder Garantie'],
  [/staatlich geprüft(?!er (Elektro)?[Tt]echniker)|staatlich gefördert|vom ministerium/i, 'falsche Aussage zum Forschungsprojekt'],
  [/mietwucher/i, 'Begriff nicht verwenden'],
  [/immobewertung|investmentpunk|hörhan|hoerhan|rentably|rentablo/i, 'Wettbewerber genannt (vergleichende Werbung)'],
  [/\bTOP\b|\bOkay\b/, 'falsches Score-Wort (Sehr gut, Gut, Solide, Schwach, Kritisch)']
];

const GELB = [
  [/immometrica/i, 'Wettbewerber genannt, nur mit Grund'],
  [/passives einkommen|finanzielle freiheit|reich werden|schnell reich/i, 'Glücksversprechen, passt nicht zum Ton'],
  [/gutachten/i, 'Wort Gutachten: DealPilot liefert eine Indikation, kein Verkehrswertgutachten'],
  [/\bSTARK\b/, 'STARK ist keine Score-Stufe'],
  [/rendite[^.\n]*\d+([.,]\d+)?\s*(%|prozent)|\d+([.,]\d+)?\s*(%|prozent)[^.\n]*rendite/i, 'Renditezahl: nur als Beispielrechnung, nie als Versprechen'],
  [/steuer|afa|abschreib/i, 'Steuerthema: Satz „Allgemeine Information, keine Steuerberatung.“ vorhanden?'],
  [/\b\d{2,}\s*(nutzer|kunden|investoren)\b/i, 'Nutzerzahl: nur, wenn sie gemessen ist (Startseite nennt > 870)']
];

function geld(zeile) {
  const funde = [];
  const re = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:€|EUR\b|Euro\b)/g;
  let m;
  while ((m = re.exec(zeile))) {
    const wert = Number(m[1].replace(/\./g, '').replace(',', '.'));
    if (!PREISE.some((p) => Math.abs(p - wert) < 0.001)) funde.push(m[0]);
  }
  return funde;
}

function bloecke(text, datei) {
  const ext = path.extname(datei).toLowerCase();
  if (ext !== '.md') {
    return [{ art: ext.slice(1), start: 1, zeilen: text.split(/\r?\n/) }];
  }
  const zeilen = text.split(/\r?\n/);
  const out = [];
  let akt = null;
  zeilen.forEach((z, i) => {
    const auf = z.match(/^```\s*(kunde[^\s`]*(?:\s+[^`]*)?)\s*$/i);
    if (!akt && auf) { akt = { art: auf[1].trim(), start: i + 2, zeilen: [] }; return; }
    if (akt && /^```\s*$/.test(z)) { out.push(akt); akt = null; return; }
    if (akt) akt.zeilen.push(z);
  });
  if (!out.length) return [{ art: 'ganze-datei', start: 1, zeilen, ohneMarkierung: true }];
  return out;
}

function pruefe(datei) {
  const text = fs.readFileSync(datei, 'utf8');
  const befunde = [];
  const bl = bloecke(text, datei);
  if (bl[0] && bl[0].ohneMarkierung && datei.endsWith('.md')) {
    befunde.push({ s: 'GELB', z: 0, t: 'keine ```kunde-Blöcke markiert, ganze Datei geprüft (auch interne Notizen)' });
  }
  for (const b of bl) {
    const istSrt = b.art === 'srt';
    let ersteZeile = true;
    let hashtags = 0;
    const woerter = [];
    b.zeilen.forEach((z, i) => {
      const nr = b.start + i;
      if (istSrt && (/^\d+$/.test(z.trim()) || /-->/.test(z))) return;
      if (!z.trim()) return;
      for (const [re, t] of ROT) if (re.test(z)) befunde.push({ s: 'ROT', z: nr, t, zeile: z.trim() });
      for (const [re, t] of GELB) if (re.test(z)) befunde.push({ s: 'GELB', z: nr, t, zeile: z.trim() });
      for (const g of geld(z)) befunde.push({ s: 'GELB', z: nr, t: 'Betrag ' + g + ' ist kein Preis aus preise.json: Beispielrechnung kennzeichnen oder belegen', zeile: z.trim() });
      hashtags += (z.match(/#[\p{L}\d_]+/gu) || []).length;
      woerter.push(...z.split(/\s+/).filter(Boolean));
      if (ersteZeile && /instagram/i.test(b.art) && z.length > 125) {
        befunde.push({ s: 'GELB', z: nr, t: 'erste Zeile länger als 125 Zeichen (Instagram kürzt)', zeile: z.trim() });
      }
      ersteZeile = false;
    });
    if (/hook/i.test(b.art) && woerter.length > 12) befunde.push({ s: 'GELB', z: b.start, t: 'Hook hat ' + woerter.length + ' Wörter, Ziel höchstens 12' });
    if (hashtags > 15) befunde.push({ s: 'GELB', z: b.start, t: hashtags + ' Hashtags im Block, höchstens 15' });
    if (/linkedin/i.test(b.art) && /https?:\/\//.test(b.zeilen.join('\n'))) befunde.push({ s: 'GELB', z: b.start, t: 'Link im LinkedIn-Beitrag: besser in den ersten Kommentar' });
  }
  return befunde;
}

function dateien(ziel) {
  const st = fs.statSync(ziel);
  if (st.isFile()) return [ziel];
  return fs.readdirSync(ziel, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(ziel, e.name);
    if (e.isDirectory()) return dateien(p);
    return /\.(md|srt|txt)$/i.test(e.name) ? [p] : [];
  });
}

const ziele = process.argv.slice(2);
if (!ziele.length) { console.log('Aufruf: node pruefe-text.mjs <datei|ordner> ...'); process.exit(2); }
let rot = 0, gelb = 0;
for (const d of ziele.flatMap(dateien)) {
  const bef = pruefe(d);
  if (!bef.length) { console.log('OK    ' + d); continue; }
  console.log('\n' + d);
  for (const b of bef) {
    if (b.s === 'ROT') rot++; else gelb++;
    console.log('  ' + b.s.padEnd(4) + ' Z.' + String(b.z).padEnd(4) + ' ' + b.t + (b.zeile ? '  |  ' + b.zeile.slice(0, 90) : ''));
  }
}
console.log('\nErgebnis: ' + rot + ' ROT, ' + gelb + ' GELB' + (rot ? '  -> nicht freigabefähig' : ''));
process.exit(rot ? 1 : 0);
