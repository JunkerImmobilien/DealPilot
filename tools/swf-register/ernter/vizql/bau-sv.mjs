// v2887 · Registersaetze aus der Ernte der Sulingen-Verden-Kalkulatoren (ernte-sv.mjs).
//
//   Stuhr, Syke, Weyhe   EFH, ZFH, RH/DHH je Gemeinde (Lage "Syke" | "Stuhr/Weyhe" nennt die Gemeinden selbst)
//   uebriger LK Diepholz EFH, ZFH (Kreisebene; Stuhr/Syke/Weyhe haben eigene Gemeindesaetze)
//   LK Nienburg          RH/DHH (ganzer Kreis, Kopie auf die Stadt Nienburg, die eigene Gemeindesaetze traegt)
//   LK Heidekreis        RH/DHH
//   Sperren mit Weg      LK Verden RH/DHH (Lage "Bremer Umland" ohne Ortsliste),
//                        LK Nienburg ohne Stadt EFH/ZFH (Nord-/Suedkreis/Randgemeinden ohne Ortsliste)
//
// Schreibt marktbericht/backend/src/lib/register/swf-ni-sv-2026.json und ersetzt in swf-ni.json die drei
// RH-Sperren Stuhr/Syke/Weyhe sowie die Sperre Nienburg-Land (EZFH) durch die neue Fassung.
// Aufruf: node bau-sv.mjs [--schreiben]
import * as PF from './pfade.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const E = PF.AUS + 'ernte/';
const ZIEL = PF.REGISTER + 'swf-ni-sv-2026.json';
const NI = PF.REGISTER + 'swf-ni.json';
const fehler = []; const log = [];
const z = (t) => Number(String(t).replace(/\./g, '').replace(',', '.'));
const iso = (d) => { const m = /(\d\d)\.(\d\d)\.(\d{4})/.exec(d || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const de = (x) => String(x).replace('.', ',');
const lies = (wb) => { const f = E + wb + '.json'; if (!existsSync(f)) { fehler.push(wb + ' noch nicht geerntet'); return null; } return JSON.parse(readFileSync(f, 'utf8')); };
const GAA = 'Gutachterausschuss für Grundstückswerte Sulingen-Verden';
const VERMERK = '© Gutachterausschuss für Grundstückswerte Sulingen-Verden 2026, dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0), https://immobilienmarkt.niedersachsen.de';
const LIZENZ_BELEG = { fundstelle: 'Nutzungsbedingungen der Grundstücksmarktberichte und Landesgrundstücksmarktdaten, https://www.gag.niedersachsen.de/startseite/grundstucksmarktberichte/nutzungsbedingungen/nutzungsbedingungen-197313.html (gelesen 23.10.2026)', wortlaut: 'Für die Grundstücksmarktberichte und Landesgrundstücksmarktdaten gilt die Lizenz "Datenlizenz Deutschland – Namensnennung – Version 2.0" (dl-de/by-2-0). … unter Angabe der Quelle © Gutachterausschuss für Grundstückswerte [Name des Ausschusses] [Jahr] … Zusätzlich ist die Internetadresse https://immobilienmarkt.niedersachsen.de anzugeben.' };
const NAV = (wb) => `https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/Sachwertfaktor/${/_rh_/.test(wb) ? 'reihenhausdoppelhaushaelfte' : 'einundzweifamilienhaeuser'}/${wb}`;

/* Modellansaetze: dieselben wie an den bestehenden, abgenommenen Saetzen des Ausschusses
   (swf-ni.json, Landkreis Diepholz RH und Heidekreis EZFH) - Modellbeschreibung Sachwertfaktoren des
   Ausschusses und Beschreibung der Dashboards 2026 (download/223867), Seiten je Objektart. */
const ni = JSON.parse(readFileSync(NI, 'utf8'));
const vorlage = (ags, zweig) => { const s = ni.find((x) => x.ags === ags && x.zweig === zweig && x.kennzahl === 'sachwertfaktor' && x.modellansaetze); if (!s) throw new Error('Vorlage fehlt ' + ags + '/' + zweig); return JSON.parse(JSON.stringify(s.modellansaetze)); };
const MOD = { efh: vorlage('03358', 'ezfh'), rh: vorlage('03251', 'rhdhh') };
for (const [k, m] of Object.entries(MOD)) { if (m.gnd_jahre !== 80 || m.baupreisindex_bezug !== 'kaufzeitpunkt') fehler.push('Vorlage Modell ' + k + ' ohne GND 80 / Indexbezug'); }

/* Diagramm aus den Dashboard-Texten: Beschriftungen zwischen Achsentitel und Diagrammtitel,
   Stuetzstellen = die ersten n Zahlen der Zahlenfolge vor dem Achsentitel. */
function diagramm(t, titelRe) {
  const ti = t.findIndex((x) => titelRe.test(x)); if (ti < 0) return null;
  let ai = -1; for (let i = ti - 1; i >= 0; i--) if (/^Umrechnungskoe/.test(t[i])) { ai = i; break; }
  if (ai < 0) return null;
  const labels = t.slice(ai + 1, ti).filter((x) => /^\d,\d\d$/.test(x)).map(z);
  let a = ai - 1; while (a >= 0 && /^\d+(,\d+)?$/.test(t[a])) a--;
  const folge = t.slice(a + 1, ai).map(z);
  const ticks = folge.slice(0, labels.length);
  for (let i = 1; i < ticks.length; i++) if (!(ticks[i] > ticks[i - 1])) return { fehler: 'Stützstellen nicht steigend: ' + ticks.join('/') };
  return { ticks, labels, titel: t[ti] };
}
/* Beschriftungen den Stuetzstellen zuordnen: je Stuetzstelle die naechstgelegene noch freie Beschriftung
   zum Rechnerquotienten f(x)/f(Norm). Norm muss 1,00 tragen, Abweichung <= 0,03. */
function kurve(e, cap, titelRe) {
  const k = e.korrekturen && e.korrekturen[cap]; if (!k) return { fehler: 'keine Rechnerprobe ' + cap };
  const d = diagramm(e.texte_vorgabe, titelRe); if (!d) return { fehler: 'kein Diagramm ' + titelRe }; if (d.fehler) return d;
  const q = []; for (const x of d.ticks) { const p = k.probe.find((y) => Math.abs(y.x - x) < 1e-9); if (!p || p.f == null) return { fehler: `${cap}: Rechnerwert fehlt bei ${x}` }; q.push(p.f / k.f0); }
  /* Die Rechnerquotienten sind auf zwei Stellen gerundete Faktoren geteilt durch einen gerundeten
     Normfaktor - bei f0 = 0,80 ist ihre Aufloesung 0,0125. Verlaeuft die Kurve monoton, werden die
     Beschriftungen deshalb in ihrer Ordnung zugeordnet (wie bau-nom), sonst je Stuetzstelle die
     naechstgelegene freie Beschriftung. */
  const steigt = q.every((v, i) => i === 0 || v >= q[i - 1] - 1e-9), faellt = q.every((v, i) => i === 0 || v <= q[i - 1] + 1e-9);
  const stufen = {}; const abw = [];
  if (steigt || faellt) {
    const ls = [...d.labels].sort((a2, b2) => (steigt ? a2 - b2 : b2 - a2));
    d.ticks.forEach((x, i) => { stufen[x.toFixed(1)] = ls[i]; abw.push(Math.abs(ls[i] - q[i])); });
  } else {
    const frei = [...d.labels];
    d.ticks.forEach((x, i) => { let bi = 0; frei.forEach((l, j) => { if (Math.abs(l - q[i]) < Math.abs(frei[bi] - q[i])) bi = j; }); stufen[x.toFixed(1)] = frei[bi]; abw.push(Math.abs(frei[bi] - q[i])); frei.splice(bi, 1); });
  }
  const norm = z(k.norm).toFixed(1);
  if (stufen[norm] !== 1) return { fehler: `${cap}: Norm ${norm} trägt ${stufen[norm]}` };
  const maxAbw = Math.max(...abw); if (maxAbw > 0.03 + 1e-9) return { fehler: `${cap}: Beschriftung weicht vom Rechner um ${maxAbw.toFixed(3)} ab` };
  return { stufen, maxAbw, titel: d.titel };
}
function korrekturen(e) {
  const out = []; const norm = [];
  const P = Object.fromEntries(e.params.map((p) => [p.caption, p]));
  if (P.Stst) {
    const kv = kurve(e, 'Stst', /^Umrechnungskoeffizienten für abweichende Standardstufen/);
    if (kv.fehler) fehler.push(e.wb + ' ' + kv.fehler); else {
      out.push({ bez: 'Abweichende Standardstufe', feld: 'standardstufe', art: 'stufen', wirkung: 'multiplikativ', stufen: kv.stufen, rundung_stellen: 2,
        hinweis: `${Object.keys(kv.stufen).length} abgedruckte Stützstellen (Diagramm „${kv.titel}“ des Kalkulators), zwischen ihnen linear interpoliert, über den Rand hinaus nicht verlängert. Zuordnung der Beschriftungen zu den Stützstellen gegen den Rechner geprüft: größte Abweichung vom Quotienten am Normobjekt ${de(kv.maxAbw.toFixed(3))}.` });
      norm.push('Standardstufe ' + P.Stst.wert);
    }
  }
  if (P.Bgwf) {
    const kv = kurve(e, 'Bgwf', /^Umrechnungskoeffizienten bei abweichendem Verhältnis von Bruttogrundfläche/);
    if (kv.fehler) fehler.push(e.wb + ' ' + kv.fehler); else {
      out.push({ bez: 'Abweichendes Verhältnis Bruttogrundfläche zu Wohnfläche', feld: 'bgf_wfl', art: 'stufen', wirkung: 'multiplikativ', stufen: kv.stufen, rundung_stellen: 2,
        hinweis: `${Object.keys(kv.stufen).length} abgedruckte Stützstellen (Diagramm „${kv.titel}“), Normstelle ${P.Bgwf.wert}, gegen den Rechner geprüft (größte Abweichung ${de(kv.maxAbw.toFixed(3))}). Das Feld \`bgf_wfl\` ist ein VERHÄLTNIS und wird nicht erhoben; ohne die Angabe rechnet das Modell am Normobjekt — so, wie es der Kalkulator selbst vorgibt.` });
      norm.push('Bruttogrundfläche/Wohnfläche ' + P.Bgwf.wert);
    }
  }
  return { out, norm };
}
const sp = (e, re) => { const k = Object.keys(e.stichprobe).find((x) => re.test(x)); return k ? e.stichprobe[k] : ['?', '?', '?']; };

function satz(e, kombiName, { ags, ebene, gebiet, zweig, objektart_bez, geltung, url_suffix = '', proben = [] }) {
  const K = e.kombis.find((k) => k.name === kombiName); if (!K) { fehler.push(e.wb + ': Kombination fehlt ' + kombiName); return null; }
  const leer = Object.values(K.zellen).flat().filter((x) => x == null).length; if (leer) { fehler.push(`${e.wb} ${kombiName}: ${leer} leere Zellen`); return null; }
  const P = Object.fromEntries(e.params.map((p) => [p.caption, p]));
  const nS = z(P.Sach.wert), nB = P.Brw ? z(P.Brw.wert) : null;
  const zeile = K.zellen[String(nB)]; const ni2 = e.sachs.indexOf(nS);
  const normZelle = ni2 >= 0 && zeile ? zeile[ni2] : null;
  if (normZelle !== null && normZelle !== K.norm.f) fehler.push(`${e.wb} ${kombiName}: Normzelle ${normZelle} != Normprobe ${K.norm.f}`);
  const { out: korr, norm } = korrekturen(e);
  const istRh = /_rh_/.test(e.wb);
  const swS = sp(e, /Sach/i), brwS = sp(e, /^Bodenrichtwert/);
  const kat = K.werte.map((w, j) => `${e.kats[j]} „${w[1]}“`).join(', ');
  const probeText = proben.map((p) => `PDF-Export ${p.query}: ${p.label ? '„' + p.label + '“, ' : ''}${de(p.pdf)} (Zelle ${de(p.zelle)})`).join('; ');
  const formel = nB === null
    ? { form: 'stufen_1d', achse_feld: 'sachwert', achse_bez: 'vorläufiger Sachwert in Euro', stufen: Object.fromEntries(e.sachs.map((x, i) => [String(x), K.zellen.null[i]])), rundung_stellen: 2, liefert: 'faktor' }
    : { form: 'matrix_interp', achse_x_feld: 'sachwert', achse_x_bez: 'vorläufiger Sachwert in Euro', achse_x: e.sachs, achse_y_feld: 'brw', achse_y_bez: 'Bodenrichtwert in €/m²', achse_y: e.brws, zellen: Object.fromEntries(e.brws.map((b) => [String(b), K.zellen[String(b)]])), rundung_stellen: 2, liefert: 'faktor' };
  formel.normobjekt = [...norm, kat].filter(Boolean).join(' · ') + ` — die Vorgaben des Kalkulators; Stichprobe ${e.kopf.anz}: vorläufiger Sachwert ${swS[0]}–${swS[1]} € (Median ${swS[2]}), Bodenrichtwert ${brwS[0]}–${brwS[1]} €/m² (Median ${brwS[2]}).`;
  formel.hinweis = `${e.sachs.length * e.brws.length} Stützstellen am amtlichen Kalkulator ${e.wb} abgefragt (Sitzung, Parameter gesetzt, Ergebnisfeld „Sachwertfaktor“ aus dem Vektorbild des Dashboards gelesen)${kat ? ', ' + kat : ''}: vorläufiger Sachwert ${e.sachs[0]}–${e.sachs[e.sachs.length - 1]} €${nB === null ? ' — DIESES MODELL KENNT KEINEN BODENRICHTWERT' : `, Bodenrichtwert ${e.brws[0]}–${e.brws[e.brws.length - 1]} €/m²`}, nur innerhalb der Stichprobe und des Eingabebereichs. Zwischen den Stützstellen linear, darüber hinaus nicht verlängert. GEGENPROBE: am Normpunkt (Sachwert ${nS} €${nB === null ? '' : ', BRW ' + nB}) weist der Kalkulator ${de(K.norm.f)} ± ${de(K.norm.sd)} aus${probeText ? '; ' + probeText : ''}.`;
  const kf = e.kopf;
  return {
    land_code: 'NI', ags, ebene, gebiet_name: gebiet, gaa_name: GAA, kennzahl: 'sachwertfaktor', zweig, objektart_bez,
    formel, korrekturen: korr,
    modellansaetze: JSON.parse(JSON.stringify(istRh ? MOD.rh : MOD.efh)),
    geltungsbereich: geltung,
    belege: [
      { fundstelle: `Kalkulator ${e.wb} (Tableau Public, Profil ogagmd2026), Dashboard „${e.view}“, Feld „Sachwertfaktor“; ${kf.quelle}`, wortlaut: `${kf.titel} · Wertermittlungsstichtag ${kf.stichtag} · Stichprobe ${kf.anz}${kat ? ' · ' + kat : ''}` },
      ...proben.map((p) => ({ fundstelle: `PDF-Export des Kalkulators, https://public.tableau.com/views/${e.wb}/${e.view}.pdf?${p.query} (abgerufen ${p.datum})`, wortlaut: `Sachwertfaktor ${de(p.pdf)}${p.label ? ', ' + p.label : ''}` })),
      LIZENZ_BELEG],
    stufe: 'B', stufe_grund: 'Stufe B statt A: die Werte sind am amtlichen Kalkulator abgefragt, nicht aus einer abgedruckten Tabelle übernommen; die Stützstellen sind von uns gewählt (innerhalb der Stichprobe). Die Korrekturkurven sind die vom Ausschuss abgedruckten Diagrammwerte.',
    fallzahl: z((kf.anz || '').match(/[\d.]+/)?.[0] || '0') || null, streuung: K.norm.sd ?? null, stichtag: iso(kf.stichtag), berichtsjahr: 2026, modellversion: 'GMI 2026 (Kalkulator)',
    quelle_url: NAV(e.wb) + url_suffix,
    quelle_parser: 'v2887-WSV', quellenvermerk: VERMERK, lizenz: 'dl-de/by-2-0', verwendung: 'produkt',
    auflagen: 'Die Faktoren gelten nur für einen vorläufigen Sachwert nach dem Modell der niedersächsischen Gutachterausschüsse (NHK 2010, Brutto-Grundfläche nach DIN 277-1:2005-02, lineare Alterswertminderung, Gesamtnutzungsdauer 80 Jahre, Baupreisindex zum Kaufzeitpunkt) und nur im genannten Gebiet. Die Umrechnungskoeffizienten sind die abgedruckten Diagrammwerte; der Kalkulator rechnet bei abweichenden Merkmalen mit seiner Regressionsfunktion und kann davon um bis zu drei Hundertstel abweichen.',
    fundstelle: `Grundstücksmarktinformationen Niedersachsen 2026, Sachwertfaktor, Kalkulator ${e.wb}${kat ? ', ' + kat : ''}`,
  };
}
function sperre({ ags, ebene, gebiet, zweig, wb, warum, beleg }) {
  return { land_code: 'NI', ags, ebene, gebiet_name: gebiet, gaa_name: GAA, kennzahl: 'sachwertfaktor', zweig, objektart_bez: null, formel: null, korrekturen: [], modellansaetze: null, geltungsbereich: null,
    belege: [{ art: 'amtliche Veröffentlichung', fundstelle: beleg }], stufe: 'A', stufe_grund: null, fallzahl: null, streuung: null, stichtag: null, berichtsjahr: 2026, modellversion: null,
    quelle_url: NAV(wb), quelle_parser: 'v2887-hand (Kalkulator-Sitzung, gelesen am 23.10.2026)', quellenvermerk: null, lizenz: 'kein Wert - Lizenz nicht einschlägig', fundstelle: beleg,
    auflagen: ['KEIN Nachbarkreis und kein Landesmittel.'], zugang: 'kostenfrei', warum_kein_wert: warum, unvollstaendig_grund: warum, vollstaendig: false };
}

/* quelle_url ohne Anhang: der Tabellenschluessel von mb.param_modell traegt ags und zweig, die Saetze
   unterscheiden sich darin bereits; derselbe Link wie die bisherigen Sperren laesst register-saat die
   alte Zeile aktualisieren statt eine zweite daneben zu legen. */
// PDF-Gegenproben (je Kalkulator mindestens zwei, je EIN rechnender Parameter; abgerufen mit pdf-probe.mjs)
const PROBEN = existsSync(E + 'pdf-proben.json') ? JSON.parse(readFileSync(E + 'pdf-proben.json', 'utf8')) : {};
const proben = (wb, filt) => (PROBEN[wb] || []).filter(filt || (() => true));
for (const wb of ['2026_sw_rh_sulverdhstsywe', '2026_sw_efh_sulverdhstsywe', '2026_sw_efh_sulverdhostsywe', '2026_sw_rh_sulverni', '2026_sw_rh_sulverhk']) {
  const p = PROBEN[wb] || []; if (p.length < 2) fehler.push(wb + ': weniger als zwei PDF-Gegenproben');
  for (const q of p) if (q.pdf !== q.zelle) fehler.push(`${wb}: PDF ${q.query} ${q.pdf} != Zelle ${q.zelle}`);
}

const alle = [];
const OA = { efh: { objektarten: ['efh'], objektarten_ausgeschlossen: ['zfh', 'dhh', 'rh', 'mfh', 'etw'] }, zfh: { objektarten: ['zfh'], objektarten_ausgeschlossen: ['efh', 'dhh', 'rh', 'mfh', 'etw'] }, rh: { objektarten: ['dhh', 'rh'], objektarten_ausgeschlossen: ['efh', 'zfh', 'mfh', 'etw'] } };
const ZAWO_EFH = 'Zawo=Einfamilienhaus', ZAWO_ZFH = 'Zawo=Zweifam.hs./mit Einliegerwohnung';
// (1) Stuhr, Syke, Weyhe
const SSW = [['03251037', 'Stuhr', 'Weyhe/Stuhr', 'Stuhr/Weyhe'], ['03251041', 'Syke, Stadt', 'Syke', 'Syke'], ['03251047', 'Weyhe', 'Weyhe/Stuhr', 'Stuhr/Weyhe']];
{
  const rh = lies('2026_sw_rh_sulverdhstsywe'), ef = lies('2026_sw_efh_sulverdhstsywe');
  for (const [ags, name, lageRh, lageEf] of SSW) {
    const g = (dok, oa) => ({ raeumlich: name, lage_dokument: dok, lage_parameter: 'Lagesowst', zuordnung_hinweis: 'Der Kalkulator nennt die Gemeinde selbst („Syke“ bzw. „Stuhr/Weyhe“); er gilt laut Titel nur für Stuhr, Syke und Weyhe.', ...OA[oa] });
    if (rh) alle.push(satz(rh, 'Lagesowst=' + lageRh, { ags, ebene: 'gemeinde', gebiet: `${GAA}, ${name}`, zweig: 'rhdhh', objektart_bez: 'Reihenhaus, Doppelhaushälfte', geltung: g(lageRh, 'rh'), proben: proben('2026_sw_rh_sulverdhstsywe', (p) => p.kombi === 'Lagesowst=' + lageRh) }));
    if (ef) {
      alle.push(satz(ef, `Lagesowst=${lageEf} · ${ZAWO_EFH}`, { ags, ebene: 'gemeinde', gebiet: `${GAA}, ${name}`, zweig: 'ezfh', objektart_bez: 'freistehendes Einfamilienhaus', geltung: g(lageEf, 'efh'), proben: proben('2026_sw_efh_sulverdhstsywe', (p) => p.kombi === `Lagesowst=${lageEf} · ${ZAWO_EFH}`) }));
      alle.push(satz(ef, `Lagesowst=${lageEf} · ${ZAWO_ZFH}`, { ags, ebene: 'gemeinde', gebiet: `${GAA}, ${name}`, zweig: 'zfh', objektart_bez: 'Zweifamilienhaus oder Einfamilienhaus mit Einliegerwohnung', geltung: g(lageEf, 'zfh'), proben: proben('2026_sw_efh_sulverdhstsywe', (p) => p.kombi === `Lagesowst=${lageEf} · ${ZAWO_ZFH}`) }));
    }
  }
}
// (2) uebriger Landkreis Diepholz EFH / ZFH
{
  const e = lies('2026_sw_efh_sulverdhostsywe');
  if (e) {
    const g = (oa) => ({ raeumlich: 'Landkreis Diepholz ohne Stuhr, Syke und Weyhe', hinweis: 'Stuhr, Syke und Weyhe tragen eigene Gemeindesätze aus dem Kalkulator 2026_sw_efh_sulverdhstsywe.', ...OA[oa] });
    alle.push(satz(e, ZAWO_EFH, { ags: '03251', ebene: 'kreis', gebiet: `${GAA}, Bereich übriger Landkreis Diepholz`, zweig: 'ezfh', objektart_bez: 'freistehendes Einfamilienhaus', geltung: g('efh'), proben: proben('2026_sw_efh_sulverdhostsywe', (p) => p.kombi === ZAWO_EFH) }));
    alle.push(satz(e, ZAWO_ZFH, { ags: '03251', ebene: 'kreis', gebiet: `${GAA}, Bereich übriger Landkreis Diepholz`, zweig: 'zfh', objektart_bez: 'Zweifamilienhaus oder Einfamilienhaus mit Einliegerwohnung', geltung: g('zfh'), proben: proben('2026_sw_efh_sulverdhostsywe', (p) => p.kombi === ZAWO_ZFH) }));
  }
}
// (3) LK Nienburg RH (ganzer Kreis) + Kopie Stadt Nienburg
{
  const e = lies('2026_sw_rh_sulverni');
  if (e) {
    const s = satz(e, 'ohne', { ags: '03256', ebene: 'kreis', gebiet: `${GAA}, Bereich Landkreis Nienburg`, zweig: 'rhdhh', objektart_bez: 'Reihenhaus, Doppelhaushälfte', geltung: { raeumlich: 'Landkreis Nienburg (Weser) einschließlich der Stadt Nienburg', ...OA.rh }, proben: proben('2026_sw_rh_sulverni') });
    if (s) { alle.push(s); const c = JSON.parse(JSON.stringify(s)); c.ags = '03256022'; c.ebene = 'gemeinde'; c.gebiet_name = `${GAA}, Nienburg (Weser), Stadt`; c.geltungsbereich.hinweis_kopie = 'Kopie des Kreissatzes auf Gemeindeebene: die Stadt trägt einen eigenen EFH-Satz (Kalkulator 2026_sw_efh_sulvernistni), und ohne die Kopie fände die Gemeindeebene keinen Reihenhaus-Faktor. Der Reihenhaus-Kalkulator gilt laut Titel für den ganzen Landkreis.'; alle.push(c); }
  }
}
// (4) Heidekreis RH
{
  const e = lies('2026_sw_rh_sulverhk');
  if (e) alle.push(satz(e, 'ohne', { ags: '03358', ebene: 'kreis', gebiet: `${GAA}, Bereich Landkreis Heidekreis`, zweig: 'rhdhh', objektart_bez: 'Reihenhaus, Doppelhaushälfte', geltung: { raeumlich: 'Landkreis Heidekreis', ...OA.rh }, proben: proben('2026_sw_rh_sulverhk') }));
}
// (5) Sperren mit Weg
alle.push(sperre({ ags: '03361', ebene: 'kreis', gebiet: `${GAA}, Bereich Landkreis Verden`, zweig: 'rhdhh', wb: '2026_sw_rh_sulverver',
  warum: 'Der Kalkulator 2026_sw_rh_sulverver (Reihenhäuser und Doppelhaushälften, Landkreis Verden, Wertermittlungsstichtag 01.01.2026, 226 Kauffälle, frei abrufbar) staffelt den Sachwertfaktor nach zwei Lagen: „Lage im Bremer Umland“ und „Lage im übrigen Landkreis“ (die Tabelle „Umrechnungskoeffizienten für weitere wertbeeinflussende Merkmale“ druckt dazu 1,00 und 1,08). Welche Gemeinden oder Ortsteile zum Bremer Umland gehören, nennt der Kalkulator nicht; eine geratene Lage wäre teurer als gar kein Wert (acht Prozent). WEG ZUR QUELLE: Kalkulator unter dem Link, Lage dort selbst wählen; den Faktor als eigene Angabe eintragen.',
  beleg: 'Kalkulator 2026_sw_rh_sulverver (Tableau Public, Profil ogagmd2026), Parameter „Lagebrem“ [1 = Bremer Umland, 2 = Übriger Landkreis], Dashboard-Tabelle „Umrechnungskoeffizienten für weitere wertbeeinflussende Merkmale“ (gelesen 23.10.2026)' }));
alle.push(sperre({ ags: '03256', ebene: 'kreis', gebiet: `${GAA}, Bereich Landkreis Nienburg ohne Stadt Nienburg`, zweig: 'ezfh', wb: '2026_sw_efh_sulverniostni',
  warum: 'Für den Landkreis Nienburg OHNE die Stadt Nienburg führt der Ausschuss einen eigenen Kalkulator (2026_sw_efh_sulverniostni, freistehende Ein- und Zweifamilienhäuser, Wertermittlungsstichtag 01.01.2026, 574 Kauffälle, frei abrufbar) mit drei Lagen: „Lage im nördlichen Landkreis“, „Lage im südlichen Landkreis“ und „Lage in den Randgemeinden zur Stadt Nienburg“ (die Tabelle „Umrechnungskoeffizienten für weitere wertbeeinflussende Merkmale“ druckt dazu 1,05, 1,00 und 1,00). Welche Gemeinden zu welcher Lage gehören, nennt der Kalkulator nicht, und der Kalkulator hat kein Bodenrichtwert-Feld; eine geratene Lage wäre teurer als gar kein Wert. Bis v2882 galt hier der Satz der STADT Nienburg für den ganzen Kreis. Reihenhäuser und Doppelhaushälften haben einen eigenen, kreisweiten Satz. WEG ZUR QUELLE: Kalkulator unter dem Link, Lage dort selbst wählen; den Faktor als eigene Angabe eintragen.',
  beleg: 'Kalkulator 2026_sw_efh_sulverniostni (Tableau Public, Profil ogagmd2026), Parameter „Lagenisnst“ [Nordkreis, Südkreis, Stadtrand Nienburg], Blatt „ni2_efh_tab“ (gelesen 23.10.2026)' }));

const ok = alle.filter(Boolean);
console.log('Sätze', ok.length, '(Werte', ok.filter((s) => s.vollstaendig !== false).length + ', Sperren', ok.filter((s) => s.vollstaendig === false).length + ')');
for (const s of ok) console.log('  ', s.ags, s.zweig.padEnd(6), s.vollstaendig === false ? 'SPERRE' : 'WERT  ', s.formel ? (s.formel.form + ' Norm ' + (s.streuung != null ? '±' + s.streuung : '')) : '', s.korrekturen.map((k) => k.feld).join(','), s.gebiet_name.slice(GAA.length + 2));
// swf-ni.json: alte RH-Sperren Stuhr/Syke/Weyhe und Sperre Nienburg-Land EZFH fallen (neue Fassung steht in swf-ni-sv-2026.json)
const raus = (s) => s.kennzahl === 'sachwertfaktor' && ((s.zweig === 'rhdhh' && ['03251037', '03251041', '03251047'].includes(s.ags) && s.vollstaendig === false) || (s.ags === '03256' && s.zweig === 'ezfh' && s.vollstaendig === false));
const weg = ni.filter(raus); if (weg.length !== 4) fehler.push('swf-ni.json: ' + weg.length + ' statt 4 alte Sperren gefunden');
console.log('Fehler', fehler.length); fehler.forEach((f) => console.log('  F ' + f));
if (process.argv.includes('--schreiben') && !fehler.length) {
  writeFileSync(ZIEL, JSON.stringify(ok, null, 1) + '\n'); console.log('geschrieben', ZIEL);
  const roh = readFileSync(NI, 'utf8'); let t = JSON.stringify(ni.filter((s) => !raus(s)), null, 2);
  if (roh.includes('\r\n')) t = t.replace(/\n/g, '\r\n'); if (/\r?\n$/.test(roh)) t += roh.endsWith('\r\n') ? '\r\n' : '\n';
  writeFileSync(NI, t); console.log('swf-ni.json: 4 alte Sperren entfernt');
}
