#!/usr/bin/env node
/* tools/mietrecht-spiegel-pruefen.mjs · landing-dealcheck-5 (12.11.2026)
   Der Landing-Deal-Check zeigt Kappungsgrenze und Mietpreisbremse aus dem Marktbericht-Backend
   (marktbericht/backend/src/lib/kappung.js kappungFuer / mietpreisbremseFuer). Die App rechnet dieselbe
   Frage in frontend/js/mietpotenzial-kern.js (kappungAus / mietpreisbremseAus). Dieser Prüfer lädt
   BEIDE echten Dateien und vergleicht je AGS: Prozent der Kappung, gilt/bis der Bremse, Bremsen-Text.
   Fälle: jede AGS der Liste plus je Land eine AGS, die nicht drinsteht. RC=0 ist sauber. */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const K = require(path.join(W, 'frontend/js/mietpotenzial-kern.js'));
const mb = await import(pathToFileURL(path.join(W, 'marktbericht/backend/src/lib/kappung.js')).href);
const daten = JSON.parse(fs.readFileSync(path.join(W, 'frontend/js/data/kappungsgrenzen.json'), 'utf8'));
const heute = new Date().toISOString().slice(0, 10);
const PRE = { SH: '01', HH: '02', NI: '03', HB: '04', NW: '05', HE: '06', RP: '07', BW: '08', BY: '09', SL: '10', BE: '11', BB: '12', MV: '13', SN: '14', ST: '15', TH: '16' };
const faelle = new Set();
for (const [land, L] of Object.entries(daten.laender)) {
  for (const g of L.gemeinden || []) if (g && /^\d{8}$/.test(g.ags || '')) faelle.add(g.ags);
  faelle.add(PRE[land] + '999999');
}
let fehler = 0, n = 0, bremse = 0, k15 = 0;
for (const ags of faelle) {
  n++;
  const ka = K.kappungAus(daten, { ags }, { heute }), kb = mb.kappungFuer(ags, null, new Date(heute + 'T12:00:00Z'));
  const ba = K.mietpreisbremseAus(daten, { ags }, { heute }), bb = mb.mietpreisbremseFuer(ags, new Date(heute + 'T12:00:00Z'));
  const d = [];
  if (ka.pct !== kb.pct) d.push(`Kappung ${ka.pct} ≠ ${kb.pct}`);
  if (ba.gilt !== bb.gilt) d.push(`Bremse gilt ${ba.gilt} ≠ ${bb.gilt}`);
  if ((ba.bis || null) !== (bb.bis || null)) d.push(`Bremse bis ${ba.bis} ≠ ${bb.bis}`);
  if (ba.text !== bb.text) d.push(`Bremse-Text\n      App: ${ba.text}\n      mb:  ${bb.text}`);
  if (d.length) { fehler++; if (fehler <= 8) console.log('ROT ', ags, d.join(' · ')); }
  if (bb.gilt) bremse++; if (kb.pct === 15) k15++;
}
console.log(`${n} AGS verglichen · Bremse gilt ${bremse} · Kappung 15 % ${k15} · Abweichungen ${fehler}`);
process.exit(fehler ? 1 : 0);
