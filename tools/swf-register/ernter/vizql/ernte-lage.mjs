// Nachernte je Lage fuer bereits im Register stehende NI-Saetze, die an der VORGABE-Lage abgetastet wurden.
// Gitter = Achsen des bestehenden Registersatzes; Lage-Parameter per Index. Gegenprobe: die Vorgabe-Lage
// muss die bestehenden Zellen reproduzieren.
// Aufruf: node ernte-lage.mjs <workbook> <ags> <zweig> "<Lage-Parameter-Caption>"
import * as PF from './pfade.mjs';
import * as T from './tab.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [wb, ags, zweig, cap] = process.argv.slice(2);
const AUS = PF.AUS + 'ernte-lage/';
mkdirSync(AUS, { recursive: true });
const reg = JSON.parse(readFileSync(PF.REGISTER + 'swf-ni.json', 'utf8'));
const satz = reg.find((s) => s.ags === ags && s.zweig === zweig && s.kennzahl === 'sachwertfaktor');
const F = satz.formel;
const v = await T.viewName(wb);
const s = await T.sitzung(wb, v.view);
const P = Object.fromEntries(s.params.map((p) => [p.caption, p]));
const lp = P[cap]; if (!lp || !lp.liste) throw new Error('Lage-Parameter fehlt: ' + cap);
const berName = (v.sheets.find((x) => /(^|_)ber(echnung)?$/i.test(x[1]) || x[1] === 'Berechnung') || [])[1];
const ber = async () => { const t = T.texte(await T.svg(s, berName)); const f = t.find((x) => /^\d,\d\d$/.test(x)); return f ? Number(f.replace(',', '.')) : null; };
const brwCap = P.Brw ? 'Brw' : null; const sachCap = 'Sach';
const defIdx = lp.liste.findIndex((l) => l[1] === lp.wert);
console.log(wb, ags, zweig, 'Blatt', berName, 'Lagen', lp.liste.map((l) => l[1]).join(' · '), 'Vorgabe', defIdx);
const out = { wb, ags, zweig, cap, lagen: [], achse_x: F.achse_x, achse_y: F.achse_y };
for (let i = 0; i < lp.liste.length; i++) {
  await T.setzeIndex(s, cap, i);
  const z = {};
  for (const b of F.achse_y) {
    if (brwCap) await T.setze(s, brwCap, b);
    z[b] = [];
    for (const x of F.achse_x) { await T.setze(s, sachCap, x); z[b].push(await ber()); }
  }
  let abw = null;
  if (i === defIdx) { abw = 0; for (const b of F.achse_y) F.zellen[b].forEach((c, j) => { if (c !== z[b][j]) abw++; }); }
  out.lagen.push({ idx: i, wert: lp.liste[i][0], name: lp.liste[i][1], zellen: z, abweichung_zum_bestand: abw });
  console.log('  Lage', i, lp.liste[i][1], 'Zelle[0][0]', z[F.achse_y[0]][0], abw === null ? '' : 'Abweichung zum Bestand: ' + abw + ' Zellen');
}
writeFileSync(AUS + wb + '.json', JSON.stringify(out, null, 1));
console.log('fertig', wb);
