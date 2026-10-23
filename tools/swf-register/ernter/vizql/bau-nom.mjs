// Baut aus den Ernte-JSONs der Region Northeim (GAG Northeim: Goslar, Northeim, Holzminden, LK Goettingen)
// Registersaetze sachwertfaktor (v2881). Schreibt marktbericht/backend/src/lib/register/swf-ni-nom-2026.json.
import * as PF from './pfade.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const E = PF.AUS;
const ZIEL = PF.REGISTER + 'swf-ni-nom-2026.json';
const kopf = JSON.parse(readFileSync(E + 'kopf.json', 'utf8'));
const lies = (wb) => JSON.parse(readFileSync(E + 'ernte/' + wb + '.json', 'utf8'));
const z = (t) => Number(String(t).replace(/\./g, '').replace(',', '.'));
const iso = (d) => { const m = /(\d\d)\.(\d\d)\.(\d{4})/.exec(d); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const VERMERK = '© Oberer Gutachterausschuss für Grundstückswerte Niedersachsen 2026, dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0), https://immobilienmarkt.niedersachsen.de';
const GAA = 'Gutachterausschuss für Grundstückswerte Northeim';
const BPI_W = 'Die NHK 2010 beziehen sich auf den Kostenstand des Jahres 2010, so dass sie mit dem Baupreisindex für den Neubau von Wohngebäuden konventioneller Bauart des Statistischen Bundesamtes an die Preisverhältnisse des Kaufzeitpunktes bzw. Wertermittlungsstichtages anzupassen sind (§ 36 Abs. 2 ImmoWertV).';
const fehler = [];

/** Lage-Codes kanonisch: "GÖ02 & GÖ03" -> "GÖ 02 & GÖ 03" */
const code = (c) => c.replace(/\s+/g, '').replace(/^([A-ZÄÖÜ]+)(\d+)$/i, '$1 $2');
const kanon = (alias) => /^alle lagen/i.test(alias) ? alias : alias.split('&').map((x) => code(x.trim())).join(' & ');

/** Lagetabelle aus der Positionslesung (lagetab.mjs): EFH-Tabelle vollstaendig, RH-Tabelle mit verbundenen
 *  Zellen - deshalb nur EFH, RH-Gemarkungen muessen Teilmenge sein. "k. A." bekommt keine Lage. */
function lagetab(wbEfh, wbRh, lagen) {
  const rows = JSON.parse(readFileSync(E + 'ernte/' + wbEfh + '.lagetab.json', 'utf8'));
  const out = []; let ka = 0, kaputt = 0;
  for (const r of rows) {
    if (!r.gemarkung || !/^[0-9]{3,4}$/.test(r.gemarkungsnr || '') || !r.lageklasse) { kaputt++; continue; }
    if (/^k[.] ?A[.]?$/i.test(r.lageklasse)) { ka++; continue; }
    const c = code(r.lageklasse); const ziel = lagen.find((L) => L.kanon.split(' & ').includes(c));
    if (!ziel) { fehler.push(wbEfh + ': Lageklasse ohne Lage: ' + r.lageklasse); continue; }
    out.push({ gemarkung: r.gemarkung, gemarkungsnr: r.gemarkungsnr, lageklasse: ziel.kanon, lageklasse_dokument: r.lageklasse });
  }
  if (wbRh) {
    const rh = JSON.parse(readFileSync(E + 'ernte/' + wbRh + '.lagetab.json', 'utf8'));
    const nrs = new Set(rows.map((r) => r.gemarkungsnr));
    const fremd = rh.filter((r) => r.gemarkungsnr && !nrs.has(r.gemarkungsnr));
    if (fremd.length) fehler.push(wbRh + ': ' + fremd.length + ' Gemarkungen nicht in der EFH-Tabelle');
  }
  return { tabelle: out, ka, kaputt };
}

/** Diagramm-Beschriftungen den Stuetzstellen zuordnen, gegen die Rechner-Quotienten. */
function kurve(k, normWert) {
  const t = k.texte; const ci = t.findIndex((x) => /^Umrechnungskoeff/.test(x));
  if (ci < 0) return { fehler: 'keine Achsenbeschriftung' };
  const vor = t.slice(0, ci).map(z); let br = vor.findIndex((x, i) => i > 0 && x < vor[i - 1]);
  const ticks = vor.slice(0, br < 0 ? vor.length : br);
  const ti = t.findIndex((x, i) => i > ci && /^Umrechnungskoeffizienten/.test(x));
  const lab = t.slice(ci + 1, ti < 0 ? undefined : ti).filter((x) => /^\d,\d\d$/.test(x)).map(z);
  if (lab.length !== ticks.length) return { fehler: `Beschriftungen ${lab.length} != Stuetzstellen ${ticks.length}` };
  const f0 = k.f0; const pr = k.probe.filter((p) => p.f != null).sort((a, b) => a.x - b.x);
  const rq = (x) => { const e = pr.find((p) => Math.abs(p.x - x) < 1e-9); if (e) return e.f / f0; const a = [...pr].reverse().find((p) => p.x < x), b = pr.find((p) => p.x > x); if (!a || !b) return null; return (a.f + (b.f - a.f) * (x - a.x) / (b.x - a.x)) / f0; };
  const rr = ticks.map(rq);
  const st = [...ticks].sort((a, b) => a - b);
  const steigt = rq(st[st.length - 1]) >= rq(st[0]);
  const ls = [...lab].sort((a, b) => (steigt ? a - b : b - a));
  const stufen = {}; const abw = [];
  st.forEach((x, i) => { stufen[String(x)] = ls[i]; const r = rq(x); if (r != null) abw.push(Math.abs(ls[i] - r)); });
  const n = stufen[String(normWert)];
  if (n !== 1) return { fehler: `Norm ${normWert} traegt ${n}, nicht 1,00` };
  const maxAbw = Math.max(...abw);
  if (maxAbw > 0.03) return { fehler: `Beschriftung weicht vom Rechner um ${maxAbw.toFixed(3)} ab` };
  return { stufen, maxAbw, ticks: st };
}

const KORR = { Stst: ['Abweichende Standardstufe', 'standardstufe'], Rnda: ['Abweichende Restnutzungsdauer', 'rnd_jahre'], Wofl: ['Abweichende Wohnfläche', 'wohnflaeche'] };

function saetze(wb, { ags, ebene, gebiet, zweig, lageModus, zuordnung }) {
  const e = lies(wb); const kf = kopf[wb];
  const istRh = /_rh_/.test(wb);
  const korr = []; const normTeile = [];
  for (const [cap, k] of Object.entries(e.korrekturen || {})) {
    const p = e.params.find((x) => x.caption === cap);
    const normWert = z(p.wert.replace(/^(\d),0$/, '$1'));
    const kv = kurve(k, normWert);
    if (kv.fehler) { fehler.push(wb + ' ' + cap + ': ' + kv.fehler); continue; }
    korr.push({ bez: KORR[cap][0], feld: KORR[cap][1], art: 'stufen', wirkung: 'multiplikativ', stufen: kv.stufen, rundung_stellen: 2,
      hinweis: `${Object.keys(kv.stufen).length} abgedruckte Stützstellen (Diagramm „${k.sheet}“ des Kalkulators), zwischen ihnen linear interpoliert, über den Rand hinaus nicht verlängert. Zuordnung der Beschriftungen zu den Stützstellen gegen den Rechner geprüft: größte Abweichung der Beschriftung vom Quotienten des Rechners am Normobjekt ${kv.maxAbw.toFixed(3)} (Rundung der Rechnerausgabe auf zwei Stellen und Modellform).` });
    normTeile.push(`${KORR[cap][0].replace('Abweichende ', '')} ${p.wert}`);
  }
  const brwS = e.stichprobe.Bodenrichtwert, swS = e.stichprobe['vorläufiger Sachwert'] || e.stichprobe['vorl. Sachwert'] || Object.entries(e.stichprobe).find(([k]) => /Sachwert/.test(k))?.[1] || ['(Spanne des Dashboards)', ''];
  const fall = z((e.anz.match(/[\d.]+/) || ['0'])[0]);
  const out = [];
  for (const L of e.lagen) {
    const leer = Object.values(L.zellen).flat().filter((x) => x == null).length;
    const negativ = (e.log || []).filter((x) => x.includes('lage=' + L.name + ' ') && /roh=-/.test(x));
    if (leer && leer !== negativ.length) { fehler.push(wb + ' Lage ' + L.name + ': ' + leer + ' leere Zellen'); continue; }
    const leerText = negativ.length ? ' LEER gelassen: ' + negativ.map((x) => { const m = /brw=([0-9]+) sach=([0-9]+) roh=(-[0-9,]+)/.exec(x); return m ? `Zelle BRW ${m[1]} / Sachwert ${m[2]} € (Kalkulator gibt ${m[3]} aus — außerhalb des Modells)` : x; }).join('; ') + '.' : '';
    const zellen = {}; for (const b of e.brws) zellen[String(b)] = L.zellen[b];
    const lage = (lageModus === 'lage') ? kanon(L.name) : null;
    const s = {
      land_code: 'NI', ags, ebene, gebiet_name: gebiet, gaa_name: GAA, kennzahl: 'sachwertfaktor', zweig,
      formel: { form: 'matrix_interp', achse_x_feld: 'sachwert', achse_x_bez: 'vorläufiger Sachwert in Euro', achse_x: e.sachs,
        achse_y_feld: 'brw', achse_y_bez: 'Bodenrichtwert in €/m²', achse_y: e.brws, zellen, rundung_stellen: 2, liefert: 'faktor',
        normobjekt: normTeile.join(' · ') + (lage ? ` · Lage ${lage}` : ''),
        hinweis: `Alle ${e.brws.length * e.sachs.length} Zellen am amtlichen Kalkulator ${wb} abgefragt (Sitzung, Parameter gesetzt, Ergebnisfeld „Berechnung“ als Vektorbild gelesen), Bodenrichtwert ${e.brws[0]}–${e.brws[e.brws.length - 1]} €/m² × vorläufiger Sachwert ${e.sachs[0]}–${e.sachs[e.sachs.length - 1]} € — nur innerhalb der Stichprobe (BRW ${brwS[0]}–${brwS[1]}, Sachwert ${swS[0]}–${swS[1]} €). Die Vorgabewerte des Kalkulators (BRW ${e.brws.includes(z(e.params.find((p) => p.caption === 'Brw').wert)) ? e.params.find((p) => p.caption === 'Brw').wert : '?'}, Sachwert ${e.params.find((p) => p.caption === 'Sach').wert} €) sind Gitterachsen. GEGENPROBE: am Normpunkt dieser Lage weist der Kalkulator ${String(L.norm.f).replace('.', ',')} ± ${String(L.norm.sd).replace('.', ',')} aus; ${leerText ? '' : ''}die Zelle trägt ${String(zellen[String(z(e.params.find((p) => p.caption === 'Brw').wert))][e.sachs.indexOf(z(e.params.find((p) => p.caption === 'Sach').wert))]).replace('.', ',')}.${leerText}` },
      korrekturen: korr,
      modellansaetze: { wortlaut: 'Sachwertmodell der niedersaechsischen Gutachterausschuesse: NHK 2010, Bezugsmassstab Brutto-Grundflaeche, lineare Alterswertminderung. Der Kalkulator gibt den Sachwertfaktor zu einem vorlaeufigen Sachwert aus; abweichende Merkmale wirken ueber Umrechnungskoeffizienten.',
        nhk: 'NHK 2010', bezugsmassstab: 'Brutto-Grundflaeche', alterswertminderung: 'linear', baupreisindex_bezug: 'kaufzeitpunkt', baupreisindex_wortlaut: BPI_W,
        baupreisindex_seite: istRh ? 'Beschreibung der Dashboards 2026 (GAG Niedersachsen, download/223867), Kap. 9.2 Sachwertfaktoren – Reihenhäuser und Doppelhaushälften, S. 9' : 'Beschreibung der Dashboards 2026 (GAG Niedersachsen, download/223867), Kap. 9.1 Sachwertfaktoren – Ein- und Zweifamilienhäuser, S. 4',
        baupreisindex_quelle_url: 'https://www.gag.niedersachsen.de/download/223867', gnd_jahre: 80,
        gnd_beleg: istRh ? 'Beschreibung der Dashboards 2026, Kap. 9.2, S. 7 und S. 9 („Die Gesamtnutzungsdauer beträgt 80 Jahre.“)' : 'Beschreibung der Dashboards 2026, Kap. 9.1, S. 2 und S. 4 („Die Gesamtnutzungsdauer beträgt 80 Jahre.“)' },
      geltungsbereich: lage ? { lage, lage_dokument: L.name, lagefaktor_parameter: L.wert, zuordnung } : { raeumlich: e.titel.split(' | ')[1] || null },
      belege: [{ fundstelle: `Kalkulator ${wb} (Tableau Public, Profil ogagmd2026), Ergebnisfeld „Berechnung“; ${kf.quelle}`, wortlaut: `${e.titel.split(' | ').slice(0, 2).join(' ')} · Stichtag ${kf.stichtag} · Stichprobe ${kf.anz}` + (lage ? ` · Lage „${L.name}“ (Lagefaktor-Parameter ${L.wert})` : '') }],
      stufe: 'B', stufe_grund: 'Stufe B statt A: die Gitterwerte sind nicht aus einer abgedruckten Tabelle übernommen, sondern am amtlichen Kalkulator abgefragt; die Stützstellen sind von uns gewählt (innerhalb der Stichprobe). Die Korrekturkurven sind vom Ausschuss selbst abgedruckt.',
      fallzahl: fall || null, streuung: L.norm.sd ?? null, stichtag: iso(kf.stichtag), berichtsjahr: 2026, modellversion: 'GMI 2026 (Kalkulator)',
      quelle_url: `https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/Sachwertfaktor/${istRh ? 'reihenhausdoppelhaushaelfte' : 'einundzweifamilienhaeuser'}/${wb}`,
      ...(lage ? { quelle_url: `https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/Sachwertfaktor/${istRh ? 'reihenhausdoppelhaushaelfte' : 'einundzweifamilienhaeuser'}/${wb}#lage=${encodeURIComponent(lage)}` } : {}),
      quelle_parser: 'v2881-WTAB', quellenvermerk: VERMERK, lizenz: 'dl-de/by-2-0', verwendung: 'produkt',
      auflagen: 'Die Faktoren gelten nur für einen vorläufigen Sachwert nach dem Modell der niedersächsischen Gutachterausschüsse (NHK 2010, Brutto-Grundfläche, lineare Alterswertminderung, Gesamtnutzungsdauer 80 Jahre). Der Ausschuss staffelt nach Lageklassen; die Lage wird über die Gemarkung bestimmt (Lagetabelle des Kalkulators). Die Umrechnungskoeffizienten für Standardstufe und Restnutzungsdauer sind die abgedruckten Diagrammwerte; der Kalkulator selbst rechnet bei abweichenden Merkmalen mit seiner Regressionsfunktion und kann davon um bis zu zwei Hundertstel abweichen.',
      fundstelle: `Grundstücksmarktinformationen Niedersachsen 2026, Sachwertfaktor, Kalkulator ${wb}` + (lage ? `, Lage ${L.name}` : ''),
    };
    if (!lage) delete s.formel.normobjekt_lage;
    out.push(s);
  }
  return out;
}

const alle = [];
// Goslar, Northeim: Lage ueber Gemarkung, Kreisebene
for (const [kz, ags, name] of [['gs', '03153', 'Landkreis Goslar'], ['nom', '03155', 'Landkreis Northeim']]) {
  const e1 = lies(`2026_sw_efh_nom${kz}`), e2 = lies(`2026_sw_rh_nom${kz}`);
  const lagen = [...new Set([...e1.lagen, ...e2.lagen].map((L) => kanon(L.name)))].map((k) => ({ kanon: k }));
  const lt = lagetab(`2026_sw_efh_nom${kz}`, `2026_sw_rh_nom${kz}`, lagen);
  const zu = { art: 'gemarkung', quelle: 'Lagetabellen („Lage einblenden“) der Kalkulatoren 2026_sw_efh_nom' + kz + ' und 2026_sw_rh_nom' + kz, hinweis: `${lt.tabelle.length} Gemarkungen mit Lageklasse; ${lt.ka} mit „k. A.“ (keine Angabe) und ${lt.kaputt} unlesbare Zeilen bekommen keine Lage.`, tabelle: lt.tabelle };
  alle.push(...saetze(`2026_sw_efh_nom${kz}`, { ags, ebene: 'kreis', gebiet: `${GAA}, Bereich ${name}`, zweig: 'ezfh', lageModus: 'lage', zuordnung: zu }));
  alle.push(...saetze(`2026_sw_rh_nom${kz}`, { ags, ebene: 'kreis', gebiet: `${GAA}, Bereich ${name}`, zweig: 'rhdhh', lageModus: 'lage', zuordnung: zu }));
}
// Holzminden: eine Lage
alle.push(...saetze('2026_sw_efh_nomhol', { ags: '03255', ebene: 'kreis', gebiet: `${GAA}, Bereich Landkreis Holzminden`, zweig: 'ezfh', lageModus: 'keine' }));
alle.push(...saetze('2026_sw_rh_nomhol', { ags: '03255', ebene: 'kreis', gebiet: `${GAA}, Bereich Landkreis Holzminden`, zweig: 'rhdhh', lageModus: 'keine' }));
if (!existsSync(E + 'ernte/2026_sw_rh_nomakgoemorte.json')) fehler.push('Goettingen noch nicht geerntet'); else
// LK Goettingen: Altkreis Goettingen ohne Orte (GOE-Lagen) + Altkreis Osterode (OHA-Lagen) auf Kreisebene,
// Stadt Goettingen (morte, ohne Lage) auf Gemeindeebene.
{
  const wbs = ['2026_sw_efh_nomakgoeoorte', '2026_sw_rh_nomakgoeoorte', '2026_sw_efh_nomakoha', '2026_sw_rh_nomakoha'];
  const es = wbs.map(lies);
  const lagen = [...new Set(es.flatMap((e) => e.lagen.map((L) => kanon(L.name))))].map((k) => ({ kanon: k }));
  const l1 = lagetab(wbs[0], wbs[1], lagen), l2 = lagetab(wbs[2], wbs[3], lagen);
  const doppelt = l1.tabelle.filter((r) => l2.tabelle.some((q) => q.gemarkungsnr === r.gemarkungsnr)); if (doppelt.length) fehler.push('Göttingen: Gemarkung in beiden Tabellen: ' + doppelt.map((r) => r.gemarkung).join(', '));
  const zu = { art: 'gemarkung', quelle: 'Lagetabellen („Lage einblenden“) der Kalkulatoren ' + wbs.join(', '), hinweis: `${l1.tabelle.length + l2.tabelle.length} Gemarkungen mit Lageklasse (Altkreis Göttingen und Altkreis Osterode zusammengeführt); ${l1.ka + l2.ka} mit „k. A.“ und ${l1.kaputt + l2.kaputt} unlesbare Zeilen bekommen keine Lage.`, tabelle: [...l1.tabelle, ...l2.tabelle] };
  alle.push(...saetze(wbs[0], { ags: '03159', ebene: 'kreis', gebiet: `${GAA}, Bereich Altkreis Göttingen ohne Göttingen, Bovenden, Eddigehausen, Rosdorf`, zweig: 'ezfh', lageModus: 'lage', zuordnung: zu }));
  alle.push(...saetze(wbs[1], { ags: '03159', ebene: 'kreis', gebiet: `${GAA}, Bereich Altkreis Göttingen ohne Göttingen, Bovenden, Eddigehausen, Rosdorf`, zweig: 'rhdhh', lageModus: 'lage', zuordnung: zu }));
  alle.push(...saetze(wbs[2], { ags: '03159', ebene: 'kreis', gebiet: `${GAA}, Bereich Altkreis Osterode am Harz`, zweig: 'ezfh', lageModus: 'lage', zuordnung: zu }));
  alle.push(...saetze(wbs[3], { ags: '03159', ebene: 'kreis', gebiet: `${GAA}, Bereich Altkreis Osterode am Harz`, zweig: 'rhdhh', lageModus: 'lage', zuordnung: zu }));
  alle.push(...saetze('2026_sw_efh_nomakgoemorte', { ags: '03159016', ebene: 'gemeinde', gebiet: `${GAA}, Bereich Stadt Göttingen (Kalkulator „Göttingen u. Orte: Bovenden, Eddigehausen, Rosdorf“)`, zweig: 'ezfh', lageModus: 'keine' }));
  alle.push(...saetze('2026_sw_rh_nomakgoemorte', { ags: '03159016', ebene: 'gemeinde', gebiet: `${GAA}, Bereich Stadt Göttingen (Kalkulator „Göttingen u. Orte: Bovenden, Eddigehausen, Rosdorf“)`, zweig: 'rhdhh', lageModus: 'keine' }));
}
console.log('Saetze', alle.length, 'Fehler', fehler.length); for (const f of fehler) console.log('  ' + f);
if (process.argv.includes('--probe')) writeFileSync(E + 'probe-nom-out.json', JSON.stringify(alle, null, 1));
if (process.argv.includes('--schreiben') && !fehler.length) { writeFileSync(ZIEL, JSON.stringify(alle, null, 1) + '\n'); console.log('geschrieben', ZIEL); }
