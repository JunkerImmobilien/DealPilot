// Baut aus der Gemeinde-Ernte (Filter "Lage mit Faktor Satz") der GAG Oldenburg-Cloppenburg Registersaetze
// je Gemeinde (8-stellige AGS), v2882. Schreibt marktbericht/backend/src/lib/register/swf-ni-ol-2026.json.
import * as PF from './pfade.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const E = PF.AUS;
const ZIEL = PF.REGISTER + 'swf-ni-ol-2026.json';
const kopf = JSON.parse(readFileSync(E + 'kopf.json', 'utf8'));
const gem = readFileSync(PF.GEMEINDEN, 'utf8').split(/\r?\n/).filter(Boolean).map((z) => z.split(';'));
const z = (t) => Number(String(t).replace(/\./g, '').replace(',', '.'));
const iso = (d) => { const m = /(\d\d)\.(\d\d)\.(\d{4})/.exec(d); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const VERMERK = '© Oberer Gutachterausschuss für Grundstückswerte Niedersachsen 2026, dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0), https://immobilienmarkt.niedersachsen.de';
const GAA = 'Gutachterausschuss für Grundstückswerte Oldenburg-Cloppenburg';
const BPI_W = 'Die NHK 2010 beziehen sich auf den Kostenstand des Jahres 2010, so dass sie mit dem Baupreisindex für den Neubau von Wohngebäuden konventioneller Bauart des Statistischen Bundesamtes an die Preisverhältnisse des Kaufzeitpunktes bzw. Wertermittlungsstichtages anzupassen sind (§ 36 Abs. 2 ImmoWertV).';
const fehler = []; const hinweise = [];
const KREISE = { '2026_sw_efh_olclpclpvec': ['03453', '03460'], '2026_sw_efh_olclpdelollabra': ['03401', '03458', '03461'], '2026_sw_efh_olclpolstwst': ['03403', '03451'] };
const KREISFREI = { 'Delmenhorst, Stadt': '03401000', 'Oldenburg (Oldenburg), Stadt': '03403000', 'Hude (Oldb)': '03458010' };
function agsFuer(name, kreise) {
  if (KREISFREI[name]) return KREISFREI[name];
  const kern = name.replace(/, Stadt$/, '').trim();
  const t = gem.filter((g) => kreise.includes(g[0].slice(0, 5)) && (g[1] === name || g[1].replace(/, (Stadt|Flecken)$/, '') === kern || g[1] === kern));
  return t.length === 1 ? t[0][0] : null;
}
function kurveStst(k, normWert) {
  const t = k.texte; const ci = t.findIndex((x) => /^Umrechnungskoeff/.test(x)); if (ci < 0) return { fehler: 'keine Achse' };
  const vor = t.slice(0, ci).map(z); const br = vor.findIndex((x, i) => i > 0 && x < vor[i - 1]); const ticks = vor.slice(0, br < 0 ? vor.length : br);
  const ti = t.findIndex((x, i) => i > ci && /^Umrechnungskoeffizienten/.test(x));
  const lab = t.slice(ci + 1, ti < 0 ? undefined : ti).filter((x) => /^\d,\d\d$/.test(x)).map(z);
  if (lab.length !== ticks.length) return { fehler: `Beschriftungen ${lab.length} != Stuetzstellen ${ticks.length}` };
  const pr = k.probe.filter((p) => p.f != null).sort((a, b) => a.x - b.x); const f0 = k.f0;
  const rq = (x) => { const e = pr.find((p) => Math.abs(p.x - x) < 1e-9); if (e) return e.f / f0; const a = [...pr].reverse().find((p) => p.x < x), b = pr.find((p) => p.x > x); if (!a || !b) return null; return (a.f + (b.f - a.f) * (x - a.x) / (b.x - a.x)) / f0; };
  const st = [...ticks].sort((a, b) => a - b);
  // nicht notwendig monoton: Zuordnung je Stuetzstelle an den naechstgelegenen Rechnerquotienten, eindeutig
  const frei = [...lab]; const stufen = {}; const abw = [];
  for (const x of st) { const r = rq(x); if (r == null) return { fehler: 'Rechnerquotient fehlt bei ' + x }; let bi = 0; frei.forEach((l, i) => { if (Math.abs(l - r) < Math.abs(frei[bi] - r)) bi = i; }); stufen[String(x)] = frei[bi]; abw.push(Math.abs(frei[bi] - r)); frei.splice(bi, 1); }
  if (stufen[String(normWert)] !== 1) return { fehler: `Norm ${normWert} traegt ${stufen[String(normWert)]}` };
  const maxAbw = Math.max(...abw); if (maxAbw > 0.03) return { fehler: 'Abweichung ' + maxAbw.toFixed(3) };
  return { stufen, maxAbw };
}
const alle = [];
for (const [wb, kreise] of Object.entries(KREISE)) {
  if (!existsSync(E + 'ernte/' + wb + '.json')) { fehler.push(wb + ' fehlt noch'); continue; }
  const e = JSON.parse(readFileSync(E + 'ernte/' + wb + '.json', 'utf8')); const kf = kopf[wb];
  const korr = []; const normTeile = [];
  if (e.korrekturen && e.korrekturen.Stst) {
    const p = e.params.find((x) => x.caption === 'Stst'); const kv = kurveStst(e.korrekturen.Stst, z(p.wert));
    if (kv.fehler) fehler.push(wb + ' Stst: ' + kv.fehler);
    else { korr.push({ bez: 'Abweichende Standardstufe', feld: 'standardstufe', art: 'stufen', wirkung: 'multiplikativ', stufen: kv.stufen, rundung_stellen: 2, hinweis: `${Object.keys(kv.stufen).length} abgedruckte Stützstellen (Diagramm „Diastst“ des Kalkulators), zwischen ihnen linear interpoliert, über den Rand hinaus nicht verlängert. Zuordnung der Beschriftungen gegen den Rechner geprüft, größte Abweichung ${kv.maxAbw.toFixed(3)}.` }); normTeile.push('Standardstufe ' + p.wert); }
  }
  const brwS = e.stichprobe.Bodenrichtwert, swS = e.stichprobe['vorläufiger Sachwert'] || e.stichprobe['vorl. Sachwert'] || Object.entries(e.stichprobe).find(([k]) => /Sachwert/.test(k))?.[1] || ['(Spanne des Dashboards)', ''];
  const fall = z((e.anz.match(/[\d.]+/) || ['0'])[0]);
  const def = e.lagen.find((L) => L.default) || e.lagen[0];
  const nB = z(e.params.find((p) => p.caption === 'Brw').wert), nS = z(e.params.find((p) => p.caption === 'Sach').wert);
  for (const L of e.lagen) {
    const m = /^(.*) \[([\d,]+)\]$/.exec(L.name); const name = m ? m[1] : L.name; const koeff = m ? z(m[2]) : null;
    const ags = agsFuer(name, kreise);
    if (!ags) { hinweise.push(`${wb}: „${name}“ keiner Gemeinde eindeutig zuzuordnen - kein Satz`); continue; }
    const leer = Object.values(L.zellen).flat().filter((x) => x == null).length; if (leer) { fehler.push(name + ': leere Zellen ' + leer); continue; }
    const zellen = {}; for (const b of e.brws) zellen[String(b)] = L.zellen[b];
    // Gegenprobe Gemeinde-Koeffizient: Normzelle ~ Vorgabe-Normzelle x Koeffizient
    const nz = zellen[String(nB)][e.sachs.indexOf(nS)], dz = def.zellen[nB][e.sachs.indexOf(nS)];
    if (koeff != null && Math.abs(nz - dz * koeff) > 0.011) fehler.push(`${name}: Normzelle ${nz} != ${dz} x ${koeff}`);
    const gname = (gem.find((g) => g[0] === ags) || [])[1] || name;
    alle.push({
      land_code: 'NI', ags, ebene: 'gemeinde', gebiet_name: `${GAA}, ${gname}`, gaa_name: GAA, kennzahl: 'sachwertfaktor', zweig: 'ezfh',
      formel: { form: 'matrix_interp', achse_x_feld: 'sachwert', achse_x_bez: 'vorläufiger Sachwert in Euro', achse_x: e.sachs, achse_y_feld: 'brw', achse_y_bez: 'Bodenrichtwert in €/m²', achse_y: e.brws, zellen, rundung_stellen: 2, liefert: 'faktor',
        normobjekt: (normTeile.length ? normTeile.join(' · ') + ' · ' : '') + `Gemeinde ${L.name}`,
        hinweis: `Alle ${e.brws.length * e.sachs.length} Zellen am amtlichen Kalkulator ${wb} mit gesetzter Gemeinde „${L.name}“ abgefragt (Sitzung, Filter „Lage mit Faktor Satz“, Ergebnisfeld „Berechnung“ als Vektorbild), Bodenrichtwert ${e.brws[0]}–${e.brws[e.brws.length - 1]} €/m² × vorläufiger Sachwert ${e.sachs[0]}–${e.sachs[e.sachs.length - 1]} € — nur innerhalb der Stichprobe (BRW ${brwS[0]}–${brwS[1]}, Sachwert ${swS[0]}–${swS[1]} €). GEGENPROBE: am Normpunkt (BRW ${nB}, Sachwert ${nS} €) weist der Kalkulator ${String(L.norm.f).replace('.', ',')} ± ${String(L.norm.sd).replace('.', ',')} aus; die Zelle trägt ${String(nz).replace('.', ',')} (Vorgabegemeinde ${String(dz).replace('.', ',')} × Gemeindekoeffizient ${m ? m[2] : '?'}).` },
      korrekturen: korr,
      modellansaetze: { wortlaut: 'Sachwertmodell der niedersaechsischen Gutachterausschuesse: NHK 2010, Bezugsmassstab Brutto-Grundflaeche, lineare Alterswertminderung. Der Kalkulator gibt den Sachwertfaktor zu einem vorlaeufigen Sachwert und Bodenrichtwert aus; die Gemeinde wirkt ueber einen Umrechnungskoeffizienten.', nhk: 'NHK 2010', bezugsmassstab: 'Brutto-Grundflaeche', alterswertminderung: 'linear',
        baupreisindex_bezug: 'kaufzeitpunkt', baupreisindex_wortlaut: BPI_W, baupreisindex_seite: 'Beschreibung der Dashboards 2026 (GAG Niedersachsen, download/223867), Kap. 9.1 Sachwertfaktoren – Ein- und Zweifamilienhäuser, S. 4', baupreisindex_quelle_url: 'https://www.gag.niedersachsen.de/download/223867',
        gnd_jahre: 80, gnd_beleg: 'Beschreibung der Dashboards 2026, Kap. 9.1, S. 2 und S. 4 („Die Gesamtnutzungsdauer beträgt 80 Jahre.“)', gemeindekoeffizient: koeff },
      geltungsbereich: { raeumlich: gname, gemeinde_dokument: L.name, kalkulator_gebiet: e.titel.split(' | ')[1] || null },
      belege: [{ fundstelle: `Kalkulator ${wb} (Tableau Public, Profil ogagmd2026), Ergebnisfeld „Berechnung“, Auswahl „Gemeinde [Umrechnungskoeffizient]“; ${kf.quelle}`, wortlaut: `${e.titel.split(' | ').slice(0, 2).join(' ')} · Wertermittlungsstichtag ${kf.stichtag} · Stichprobe ${kf.anz} · Gemeinde „${L.name}“` }],
      stufe: 'B', stufe_grund: 'Stufe B statt A: die Gitterwerte sind am amtlichen Kalkulator abgefragt, nicht aus einer abgedruckten Tabelle übernommen; die Stützstellen sind von uns gewählt (innerhalb der Stichprobe).',
      fallzahl: fall || null, streuung: L.norm.sd ?? null, stichtag: iso(kf.stichtag), berichtsjahr: 2026, modellversion: 'GMI 2026 (Kalkulator)',
      quelle_url: `https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/Sachwertfaktor/einundzweifamilienhaeuser/${wb}`,
      quelle_parser: 'v2882-WTAB', quellenvermerk: VERMERK, lizenz: 'dl-de/by-2-0', verwendung: 'produkt',
      auflagen: 'Die Faktoren gelten nur für einen vorläufigen Sachwert nach dem Modell der niedersächsischen Gutachterausschüsse (NHK 2010, Brutto-Grundfläche, lineare Alterswertminderung, Gesamtnutzungsdauer 80 Jahre) und nur für die genannte Gemeinde (Gemeindekoeffizient im Satz enthalten).',
      fundstelle: `Grundstücksmarktinformationen Niedersachsen 2026, Sachwertfaktor, Kalkulator ${wb}, Gemeinde ${L.name}`,
    });
  }
}
console.log('Saetze', alle.length, 'Fehler', fehler.length); fehler.forEach((f) => console.log('  F ' + f)); hinweise.forEach((h) => console.log('  H ' + h));
if (process.argv.includes('--schreiben') && !fehler.length) { writeFileSync(ZIEL, JSON.stringify(alle, null, 1) + '\n'); console.log('geschrieben', ZIEL); }
