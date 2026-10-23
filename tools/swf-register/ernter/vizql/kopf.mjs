import * as PF from './pfade.mjs';
import * as T from './tab.mjs';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
const f = PF.AUS + 'kopf.json'; const k = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
for (const wb of process.argv.slice(2)) {
  if (k[wb]) continue;
  const v = await T.viewName(wb); const s = await T.sitzung(wb, v.view);
  const d = T.texte(await T.svg(s, v.view));
  const i = d.findIndex((t) => /^S.?chtag:?$|Wertermittlungsstichtag/.test(t));
  const q = d.find((t) => /Datenbasis/.test(t)) || null;
  const st = d.find((t) => /^\d\d\.\d\d\.\d{4}$/.test(t)) || null;
  k[wb] = { stichtag: st, quelle: q, anz: d.find((t) => /Kauff(ä|ae)lle/.test(t)) || null, titel: d.slice(0, 3).join(' | ') };
  console.log(wb, JSON.stringify(k[wb]));
}
writeFileSync(f, JSON.stringify(k, null, 1));
