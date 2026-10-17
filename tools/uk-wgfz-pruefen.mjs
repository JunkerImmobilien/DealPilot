#!/usr/bin/env node
/* v2361 · Prueft jeden Umrechnungskoeffizienten WGFZ (uk-wgfz-*.json) mit der
   ECHTEN Funktion (lib/umrechnung_wgfz.js) gegen das amtliche Anwendungsbeispiel,
   und dass jede Tabelle an ihrer Norm 1,00 traegt und mit der WGFZ steigt.
   Eine Sperre traegt keine rechenbare formel. RC=0 ist sauber. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ORDNER = path.join(HIER, '..', 'marktbericht', 'backend', 'src', 'lib', 'register');
const W = (await import('file://' + path.join(HIER, '..', 'marktbericht', 'backend', 'src', 'lib', 'umrechnung_wgfz.js').replace(/\\/g, '/'))).default;

let saetze = 0, werte = 0, sperren = 0, beispiele = 0, rot = 0;
const fehler = (t) => { rot++; console.log('  FEHLER ' + t); };
const dateien = fs.readdirSync(ORDNER).filter((x) => x.startsWith('uk-wgfz-') && x.endsWith('.json'));
for (const d of dateien) {
  for (const s of JSON.parse(fs.readFileSync(path.join(ORDNER, d), 'utf8'))) {
    saetze++;
    const wo = d + ' ' + (s.gebiet_name || s.ags);
    if (s.kennzahl !== W.KENNZAHL) { fehler(wo + ': kennzahl ' + s.kennzahl); continue; }
    if (s.vollstaendig === false || s.warum_kein_wert) {
      sperren++;
      if (s.formel && /wgfz_/.test(s.formel.form || '')) fehler(wo + ': Sperre mit rechenbarer formel');
      continue;
    }
    werte++;
    const f = s.formel || {};
    if (f.form === 'wgfz_tabelle') {
      for (const z of f.zeilen || []) {
        if ((z.uk || []).length !== f.wgfz.length) fehler(wo + ' BRW ' + z.brw + ': ' + (z.uk || []).length + ' Zellen statt ' + f.wgfz.length);
        const i1 = f.wgfz.indexOf(1);
        if (i1 >= 0 && z.uk[i1] != null && Math.abs(z.uk[i1] - 1) > 1e-9) fehler(wo + ' BRW ' + z.brw + ': ' + z.uk[i1] + ' bei WGFZ 1,0');
        const v = (z.uk || []).filter((x) => x != null);
        for (let i = 1; i < v.length; i++) if (v[i] < v[i - 1]) fehler(wo + ' BRW ' + z.brw + ': faellt bei Spalte ' + i);
      }
    }
    const p = W.pruefeBeispiel(s);
    if (p == null) console.log('  HINWEIS ' + wo + ': kein Anwendungsbeispiel');
    else if (!p.ok) fehler(wo + ': Beispiel ' + JSON.stringify(p));
    else beispiele++;
  }
}
console.log('DECKUNG: ' + dateien.length + ' Datei(en), ' + saetze + ' Saetze (' + werte + ' Werte, ' + sperren + ' Sperren), '
  + beispiele + ' Anwendungsbeispiel(e) getroffen');
console.log('ERGEBNIS: ' + (rot ? rot + ' Fehler' : 'sauber'));
process.exit(rot ? 1 : 0);
