import * as PF from './pfade.mjs';
import * as T from './tab.mjs';
import { writeFileSync } from 'node:fs';
for (const wb of process.argv.slice(2)) {
  const v = await T.viewName(wb); const s = await T.sitzung(wb, v.view);
  const sh = (v.sheets.find((x) => /^Lagetab$/i.test(x[1])) || [])[1]; if (!sh) { console.log(wb, 'kein Lagetab'); continue; }
  const p = T.texteMitPos(await T.svg(s, sh));
  const kopf = ['Gemarkung', 'Lageklasse', 'Gemarkungsnr'].map((k) => p.find((q) => q.t === k));
  const daten = p.filter((q) => !kopf.includes(q) && q.t !== sh);
  const zeilen = new Map();
  for (const q of daten) { const key = Math.round(q.y / 4); const k = [...zeilen.keys()].find((y) => Math.abs(y - q.y) < 4) ?? q.y; if (!zeilen.has(k)) zeilen.set(k, []); zeilen.get(k).push(q); }
  const rows = []; const prob = [];
  for (const [y, qs] of [...zeilen.entries()].sort((a, b) => a[0] - b[0])) {
    const r = {}; for (const q of qs) { const col = kopf.map((h, i) => [i, Math.abs(h.x - q.x)]).sort((a, b) => a[1] - b[1])[0][0]; r[['gemarkung', 'lageklasse', 'gemarkungsnr'][col]] = (r[['gemarkung', 'lageklasse', 'gemarkungsnr'][col]] ? r[['gemarkung', 'lageklasse', 'gemarkungsnr'][col]] + ' ' : '') + q.t; }
    if (!r.gemarkung || !r.lageklasse || !/^\d{3,4}$/.test(r.gemarkungsnr || '')) prob.push(JSON.stringify(r)); rows.push(r);
  }
  writeFileSync(PF.AUS + 'ernte/' + wb + '.lagetab.json', JSON.stringify(rows, null, 1));
  const kl = {}; for (const r of rows) kl[r.lageklasse] = (kl[r.lageklasse] || 0) + 1;
  console.log(wb, rows.length, 'Zeilen', JSON.stringify(kl), 'Problem', prob.length, prob.slice(0, 3).join(' '));
}
