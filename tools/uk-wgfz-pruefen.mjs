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

/* v3293 · ABLEITUNG DER WGFZ DES OBJEKTS (wgfzAbleitung, Stufe N). Massstab fuer den
   Wohnflaechen-Weg sind die Beispiele der Ausschuesse selbst (Bremen Umrechnungstabelle
   100012: 800 : 0,8 : 1.600 = rd. 0,63; Muenster GMB 2025 S. 31: 1.200 : 1.000 : 0,75 = 1,6),
   fuer den BGF-Weg § 16 Abs. 4 ImmoWertV (Vollgeschosse voll, Dachgeschoss 75 %, Keller nicht)
   am Ebenen-Modell der ImmoWertA IV.(I).5. Danach die Kette in die amtliche Umrechnung. */
let abl = 0;
const A = (name, ein, soll) => {
  const r = W.wgfzAbleitung(ein);
  const ok = soll.fehlt
    ? !r.verfuegbar && r.grund === soll.fehlt
    : r.verfuegbar && Math.abs(r.wgfz - soll.wgfz) < 1e-9 && r.weg === soll.weg && r.stufe === 'N' && r.amtlich === false
      && /WGFZ abgeleitet aus .*\(DealPilot-Ableitung, Stufe N\), eigene Angabe genauer/.test(r.hinweis || '');
  if (ok) abl++; else fehler('Ableitung ' + name + ': ' + JSON.stringify({ soll, ist: { v: r.verfuegbar, wgfz: r.wgfz, weg: r.weg, grund: r.grund } }));
};
A('Bremen-Beispiel (MFH, Wohnflaeche)', { objektart: 'mfh', plot_area: 1600, living_area: 800, ags: '04011000' }, { wgfz: 0.63, weg: 'wohnflaeche' });
A('Muenster-Beispiel (MFH, eigener Divisor 0,75)', { objektart: 'mfh', plot_area: 1000, living_area: 1200, ags: '05515000' }, { wgfz: 1.6, weg: 'wohnflaeche' });
A('MFH andernorts (Divisor 0,8)', { objektart: 'mfh', plot_area: 680, living_area: 546, bgf: 710, ags: '05766020' }, { wgfz: 1.0, weg: 'wohnflaeche' });
/* 405 m² BGF / 4 Ebenen (KG, EG, OG, DG) = 101,25 × (2 + 0,75) = 278,44 m² / 365 m² = 0,76 */
A('ZFH 1.11 aus BGF', { objektart: 'zfh', plot_area: 365, bgf: 405, nhk_typ: '1.11' }, { wgfz: 0.76, weg: 'bgf' });
/* 190 / 2 Ebenen (EG, DG) = 95 × 1,75 = 166,25 / 650 = 0,26 */
A('EFH 1.21 aus BGF (ohne Keller)', { objektart: 'efh', plot_area: 650, bgf: 190, nhk_typ: '1.21' }, { wgfz: 0.26, weg: 'bgf' });
/* 200 / 3 Ebenen (KG, EG, OG) × 2, Flachdach = 133,33 / 400 = 0,33 */
A('EFH 1.13 Flachdach', { objektart: 'efh', plot_area: 400, bgf: 200, nhk_typ: '1.13' }, { wgfz: 0.33, weg: 'bgf' });
/* 152 × 2,8 (SW-RL 1.12) = 426 / 4 × 2,75 = 292,88 / 780 = 0,38 */
A('EFH 1.12 aus Wohnflaeche ueber BGF', { objektart: 'efh', plot_area: 780, living_area: 152, nhk_typ: '1.12' }, { wgfz: 0.38, weg: 'bgf_aus_wohnflaeche' });
A('ETW ohne Gesamtgebaeude -> fehlt', { objektart: 'wohnung', plot_area: 950, living_area: 100, bgf: 195, nhk_typ: '1.12' }, { fehlt: 'etw_ohne_gesamtgebaeude' });
A('MFH ohne Grundstueck -> fehlt', { objektart: 'mfh', living_area: 500 }, { fehlt: 'grundstueck_fehlt' });
A('MFH nur BGF -> fehlt', { objektart: 'mfh', plot_area: 500, bgf: 700 }, { fehlt: 'wohnflaeche_fehlt' });
A('Haus ohne Gebaeudeart -> fehlt', { objektart: 'efh', plot_area: 780, living_area: 152, bgf: 300 }, { fehlt: 'gebaeudeart_fehlt' });
/* Kette: abgeleitete WGFZ in die amtliche Tabelle Muenster (Norm 1,0; 0,8 -> 0,90) */
{
  const r = W.wgfzAbleitung({ objektart: 'mfh', plot_area: 1000, living_area: 600, ags: '05515000' });
  const k = W.wgfzAnpassung({ ags: '05515000', objektart: 'mfh', brw_eur_qm: 400, wgfz_zone: 1.0, wgfz_objekt: r.wgfz });
  if (r.wgfz === 0.8 && k.verfuegbar && Math.abs(k.faktor - 0.9) < 1e-9 && k.bodenwert_eur_qm === 360) abl++;
  else fehler('Ableitung Kette Muenster: ' + JSON.stringify({ wgfz: r.wgfz, k: { v: k.verfuegbar, f: k.faktor, bw: k.bodenwert_eur_qm, g: k.grund } }));
}
console.log('ABLEITUNG: ' + abl + ' von 12 Faellen (Wohnflaechen-Weg, BGF-Weg, ETW/fehlende Angaben, Kette in die Tabelle)');
console.log('ERGEBNIS: ' + (rot ? rot + ' Fehler' : 'sauber'));
process.exit(rot ? 1 : 0);
