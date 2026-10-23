// v2883 · Korrektur des NI-Bestands (swf-ni.json):
//  (1) Salzgitter, Helmstedt, Peine (EZFH + RH/DHH): je Lage ein Satz statt eines Satzes an der Vorgabe-Lage.
//  (2) Hameln-Pyrmont EZFH: Lagen "Hameln" und "Bad Pyrmont" auf Gemeindeebene, Kreis-EZFH wird Sperre.
//  (3) Stadt Nienburg EZFH: von Kreis- auf Gemeindeebene; Rest des Kreises Sperre.
//  (4) Diepholz RH/DHH ("übriger Landkreis"): Stuhr, Syke, Weyhe gesperrt (eigener Kalkulator).
import * as PF from './pfade.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const D = PF.REGISTER;
const E = PF.AUS;
const roh = readFileSync(D + 'swf-ni.json', 'utf8');
const reg = JSON.parse(roh);
const andere = JSON.parse(readFileSync(D + 'swf-ni-sh-rp-sl-2026.json', 'utf8'));
const kopf = JSON.parse(readFileSync(E + 'kopf.json', 'utf8'));
const fehler = []; const log = [];
const clone = (o) => JSON.parse(JSON.stringify(o));
const idx = (ags, zweig) => reg.findIndex((s) => s.ags === ags && s.zweig === zweig && s.kennzahl === 'sachwertfaktor');
const kanon = (alias) => alias.replace(/\s*\[[\d,]+\]\s*$/, '').replace(/^Gemeinde Stadt /, '').replace(/^Gemeinde /, '').replace(/^Gem\. /, '').trim();

function lagenSaetze(wb, ags, zweig, zuordnungArt) {
  const e = JSON.parse(readFileSync(E + 'ernte-lage/' + wb + '.json', 'utf8'));
  const i = idx(ags, zweig); if (i < 0) { fehler.push(`${ags}/${zweig} nicht im Bestand`); return null; }
  const alt = reg[i];
  const def = e.lagen.find((L) => L.abweichung_zum_bestand !== null);
  if (!def || def.abweichung_zum_bestand !== 0) { fehler.push(`${wb}: Vorgabe-Lage reproduziert den Bestand nicht (${def && def.abweichung_zum_bestand})`); return null; }
  const neu = [];
  for (const L of e.lagen) {
    const leer = Object.values(L.zellen).flat().filter((x) => x == null).length; if (leer) { fehler.push(`${wb} ${L.name}: ${leer} leer`); return null; }
    const s = clone(alt);
    s.formel.zellen = Object.fromEntries(alt.formel.achse_y.map((b) => [String(b), L.zellen[b]]));
    s.formel.normobjekt = (alt.formel.normobjekt || '') + ` · Lage „${kanon(L.name)}“`;
    s.formel.hinweis = (alt.formel.hinweis || '') + ` v2883: dasselbe Gitter je LAGE am Kalkulator abgefragt (Lage-Parameter „${e.cap}“ per Index gesetzt). Die Vorgabe-Lage reproduziert alle ${alt.formel.achse_x.length * alt.formel.achse_y.length} Zellen des bisherigen Satzes.`;
    s.geltungsbereich = { ...(alt.geltungsbereich || {}), lage: kanon(L.name), lage_dokument: L.name, lage_parameter: e.cap, lage_parameterwert: L.wert,
      zuordnung: { art: zuordnungArt, hinweis: 'Die Lagenamen des Kalkulators nennen die Gemeinden bzw. Ortsteile selbst; zugeordnet wird nur ein vollständiger Name (Ortsteil vor Gemeinde). Ein Ort, der in keinem Lagenamen steht (z. B. Mitgliedsgemeinden einer Samtgemeinde oder „Südkreis“), bekommt keinen Faktor.' } };
    s.belege = [...(Array.isArray(alt.belege) ? alt.belege : [alt.belege]), { fundstelle: `Kalkulator ${wb}, Lage „${L.name}“ (v2883, ${new Date().toISOString().slice(0, 10)})`, wortlaut: `Lage-Parameter „${e.cap}“, Wert ${L.wert}; ${kopf[wb] ? kopf[wb].quelle : ''}` }];
    s.quelle_parser = (alt.quelle_parser || '') + '+v2883-WLAGE';
    if (L !== def) s.quelle_url = alt.quelle_url + '#lage=' + encodeURIComponent(kanon(L.name)).slice(0, 80);
    s.fundstelle = (alt.fundstelle || '') + `, Lage ${kanon(L.name)}`;
    neu.push(s);
  }
  reg.splice(i, 1, ...neu);
  log.push(`${ags}/${zweig}: 1 Satz -> ${neu.length} Lage-Sätze (${neu.map((s) => s.geltungsbereich.lage).join(' | ')})`);
  return neu;
}
lagenSaetze('2026_sw_efh_bssz', '03102', 'ezfh', 'ortsteil');
lagenSaetze('2026_sw_rh_bssz', '03102', 'rhdhh', 'ortsteil');
lagenSaetze('2026_sw_efh_bshe', '03154', 'ezfh', 'gemeinde_oder_ortsteil');
lagenSaetze('2026_sw_rh_bshe', '03154', 'rhdhh', 'gemeinde_oder_ortsteil');
lagenSaetze('2026_sw_efh_bspe', '03157', 'ezfh', 'gemeinde');
lagenSaetze('2026_sw_rh_bspe', '03157', 'rhdhh', 'gemeinde');
// Lage-Gruppen EZFH und RH muessen gleich heissen, sonst findet der Kern fuer eine Objektart keinen Satz.
for (const ags of ['03102', '03154', '03157']) {
  const g = (z) => [...new Set(reg.filter((s) => s.ags === ags && s.zweig === z && s.kennzahl === 'sachwertfaktor').map((s) => s.geltungsbereich.lage))].sort().join(' | ');
  if (g('ezfh') !== g('rhdhh')) fehler.push(`${ags}: Lagen EZFH [${g('ezfh')}] != RH [${g('rhdhh')}]`);
}

function sperre(vorlage, ags, ebene, gebiet, zweig, warum, url) {
  return { land_code: 'NI', ags, ebene, gebiet_name: gebiet, gaa_name: vorlage.gaa_name, kennzahl: 'sachwertfaktor', zweig, objektart_bez: null, formel: null, korrekturen: [], modellansaetze: null, geltungsbereich: null,
    belege: [{ art: 'amtliche Veröffentlichung', fundstelle: url + ' (am 22.10.2026 in der Sitzung gelesen)' }], stufe: 'A', stufe_grund: null, fallzahl: null, streuung: null, stichtag: null, berichtsjahr: 2026, modellversion: null,
    quelle_url: url, quelle_parser: 'v2883-hand', quellenvermerk: null, lizenz: 'kein Wert - Lizenz nicht einschlägig', fundstelle: url, auflagen: ['KEIN Nachbarkreis und kein Landesmittel.'], warum_kein_wert: warum, unvollstaendig_grund: warum, vollstaendig: false };
}
// (2) Hameln-Pyrmont EZFH
{
  const e = JSON.parse(readFileSync(E + 'ernte-lage/2026_sw_efh_hmhhm.json', 'utf8'));
  const i = idx('03252', 'ezfh'); const alt = reg[i];
  const def = e.lagen.find((L) => L.abweichung_zum_bestand !== null);
  if (!def || def.abweichung_zum_bestand !== 0) fehler.push('Hameln: Vorgabe-Lage reproduziert den Bestand nicht ' + (def && def.abweichung_zum_bestand));
  const rh = reg.find((s) => s.ags === '03252' && s.zweig === 'rhdhh' && s.kennzahl === 'sachwertfaktor');
  const ziele = { Hameln: ['03252006', 'Hameln, Stadt'], 'Bad Pyrmont': ['03252003', 'Bad Pyrmont, Stadt'] };
  const neu = [];
  for (const L of e.lagen) {
    const z = ziele[L.name]; if (!z) continue;
    const s = clone(alt); s.ags = z[0]; s.ebene = 'gemeinde'; s.gebiet_name = alt.gaa_name + ', ' + z[1];
    s.formel.zellen = Object.fromEntries(alt.formel.achse_y.map((b) => [String(b), L.zellen[b]]));
    s.formel.normobjekt = (alt.formel.normobjekt || '') + ` · Lage „${L.name}“`;
    s.formel.hinweis = (alt.formel.hinweis || '') + ` v2883: Gitter mit gesetzter Lage „${L.name}“ (Lage-Parameter Wert ${L.wert}) abgefragt; die Vorgabe-Lage „Hameln“ reproduziert alle Zellen des bisherigen Kreissatzes.`;
    s.geltungsbereich = { raeumlich: z[1], lage_dokument: L.name, lage_parameterwert: L.wert, hinweis: 'Der Kalkulator führt die Lagen „Hameln“, „Bad Pyrmont“, „Kleinstädte“ und „Dörfer“ (Tabelle „Umrechnungskoeffizienten für abweichende Lagen“: 1,00 / 0,88 / 0,88 / 0,84). Zugeordnet sind nur die beiden Lagen, die eine Gemeinde beim Namen nennen. Ob Ortschaften dieser Städte als „Dörfer“ gelten, sagt der Kalkulator nicht.' };
    s.belege = [...(Array.isArray(alt.belege) ? alt.belege : [alt.belege]), { fundstelle: `Kalkulator 2026_sw_efh_hmhhm, Lage „${L.name}“, Blatt „tabweiterelage“ (v2883)`, wortlaut: 'Hameln 1,00 · Bad Pyrmont 0,88 · Kleinstädte 0,88 · Dörfer 0,84' }];
    s.quelle_parser = (alt.quelle_parser || '') + '+v2883-WLAGE'; s.fundstelle = (alt.fundstelle || '') + `, Lage ${L.name}`;
    neu.push(s);
    if (rh) { const r = clone(rh); r.ags = z[0]; r.ebene = 'gemeinde'; r.gebiet_name = rh.gaa_name + ', ' + z[1]; r.quelle_parser = (rh.quelle_parser || '') + '+v2883-kopie'; r.geltungsbereich = { ...(rh.geltungsbereich || {}), hinweis: 'Unveränderte Kopie des Kreissatzes (Reihenhaus-Kalkulator ohne Lage-Parameter), damit die Gemeindeebene den Reihenhaus-Faktor weiter findet.' }; neu.push(r); }
  }
  if (neu.length !== 4) fehler.push('Hameln: ' + neu.length + ' statt 4 Gemeindesätze');
  const sp = sperre(alt, '03252', 'kreis', alt.gebiet_name, 'ezfh', 'Der Kalkulator 2026_sw_efh_hmhhm (Gutachterausschuss Hameln-Hannover, Landkreis Hameln-Pyrmont) staffelt den Sachwertfaktor für freistehende Ein- und Zweifamilienhäuser nach vier Lagen: „Hameln“ 1,00, „Bad Pyrmont“ 0,88, „Kleinstädte“ 0,88 und „Dörfer“ 0,84 (Blatt „Umrechnungskoeffizienten für abweichende Lagen“). Welche Gemeinden „Kleinstädte“ und welche „Dörfer“ sind, nennt der Kalkulator nicht. Für die Städte Hameln und Bad Pyrmont stehen eigene Sätze auf Gemeindeebene; für alle übrigen Gemeinden bleibt der Faktor offen. Bis v2882 stand hier EIN Satz an der Vorgabe-Lage „Hameln“ für den ganzen Kreis — in einem Dorf lag er rund 16 Prozent zu hoch. WEG ZUR QUELLE: Kalkulator mit Lageauswahl unter dem Link.', alt.quelle_url);
  reg.splice(i, 1, sp, ...neu);
  log.push('03252/ezfh: Kreissatz -> Sperre; Hameln + Bad Pyrmont je EZFH-Lage-Satz + RH-Kopie');
}
// (3) Stadt Nienburg
{
  const i = idx('03256', 'ezfh'); const alt = reg[i];
  if (!/Stadt Nienburg/.test(alt.gebiet_name)) fehler.push('Nienburg: unerwarteter Satz');
  const s = clone(alt); s.ags = '03256022'; s.ebene = 'gemeinde'; s.quelle_parser = (alt.quelle_parser || '') + '+v2883-geltung';
  s.geltungsbereich = { ...(alt.geltungsbereich || {}), raeumlich: 'Nienburg (Weser), Stadt', hinweis: 'v2883: der Kalkulator 2026_sw_efh_sulvernistni gilt für die STADT Nienburg; bis v2882 stand der Satz auf Kreisebene und galt damit für den ganzen Landkreis.' };
  const woe = andere.filter((x) => x.ags === '03256' && x.kennzahl === 'sachwertfaktor').map((x) => { const c = clone(x); c.ags = '03256022'; c.ebene = 'gemeinde'; c.quelle_parser = (x.quelle_parser || '') + '+v2883-kopie'; c.geltungsbereich = { ...(x.geltungsbereich || {}), hinweis_kopie: 'Kopie des Kreissatzes auf Gemeindeebene (v2883), damit die Stadt den Satz weiter findet.' }; return c; });
  const sp = sperre(alt, '03256', 'kreis', 'Gutachterausschuss für Grundstückswerte Sulingen-Verden, Bereich Landkreis Nienburg ohne Stadt Nienburg', 'ezfh', 'Für den Landkreis Nienburg OHNE die Stadt Nienburg führt der Ausschuss einen eigenen Kalkulator (2026_sw_efh_sulverniostni) mit drei Lagen: „Nordkreis“, „Südkreis“ und „Stadtrand Nienburg“. Welche Gemeinden zu welcher Lage gehören, nennt der Kalkulator nicht; eine geratene Lage wäre teurer als gar kein Wert. Bis v2882 galt hier der Satz der STADT Nienburg für den ganzen Kreis. WEG ZUR QUELLE: Kalkulator unter dem Link.', 'https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/Sachwertfaktor/einundzweifamilienhaeuser/2026_sw_efh_sulverniostni');
  reg.splice(i, 1, s, sp);
  log.push('03256/ezfh: Stadt-Nienburg-Satz -> 03256022, Kreis -> Sperre; Wochenendhaus-Kopien ' + woe.length);
  globalThis._woe = woe;
}
// (4) Diepholz RH: Stuhr, Syke, Weyhe
{
  const rh = reg.find((s) => s.ags === '03251' && s.zweig === 'rhdhh' && s.kennzahl === 'sachwertfaktor');
  const woe = andere.filter((x) => x.ags === '03251' && x.kennzahl === 'sachwertfaktor');
  for (const [ags, name] of [['03251037', 'Stuhr'], ['03251041', 'Syke, Stadt'], ['03251047', 'Weyhe']]) {
    reg.push(sperre(rh, ags, 'gemeinde', `Gutachterausschuss für Grundstückswerte Sulingen-Verden, ${name}`, 'rhdhh', `Für Stuhr, Syke und Weyhe führt der Ausschuss einen EIGENEN Reihenhaus-Kalkulator (2026_sw_rh_sulverdhstsywe); der Kreissatz gilt laut Titel nur für den „übrigen Landkreis Diepholz“. Bis v2882 galt er auch hier. Der eigene Kalkulator ist noch nicht ins Register übernommen. WEG ZUR QUELLE: Kalkulator unter dem Link.`, 'https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/Sachwertfaktor/reihenhausdoppelhaushaelfte/2026_sw_rh_sulverdhstsywe'));
    for (const x of woe) { const c = clone(x); c.ags = ags; c.ebene = 'gemeinde'; c.quelle_parser = (x.quelle_parser || '') + '+v2883-kopie'; c.geltungsbereich = { ...(x.geltungsbereich || {}), hinweis_kopie: 'Kopie des Kreissatzes auf Gemeindeebene (v2883).' }; globalThis._woe.push(c); }
  }
  log.push('03251/rhdhh: Sperren für Stuhr, Syke, Weyhe; Wochenendhaus-Kopien ' + woe.length * 3);
}
/* Wochenendhaus-Kopien NICHT angelegt: kein Aufrufer fuehrt die Objektart (ZWEIG_VORZUG), und die Kreissaetze erfuellen den Pflichtfeldvertrag nicht (Basislinie). */
console.log(log.join('\n')); console.log('Sätze', reg.length, 'Fehler', fehler.length); fehler.forEach((f) => console.log('  F ' + f));
if (process.argv.includes('--schreiben') && !fehler.length) {
  let t = JSON.stringify(reg, null, 2); if (roh.includes('\r\n')) t = t.replace(/\n/g, '\r\n'); if (/\r?\n$/.test(roh)) t += roh.endsWith('\r\n') ? '\r\n' : '\n';
  writeFileSync(D + 'swf-ni.json', t); console.log('geschrieben swf-ni.json');
}
