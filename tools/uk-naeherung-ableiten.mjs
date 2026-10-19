#!/usr/bin/env node
/* uk-naeherung-ableiten.mjs (v2288) — leitet die DealPilot-NAEHERUNG fuer den
   Umrechnungskoeffizienten der Grundstuecksgroesse aus ALLEN amtlichen Tabellen
   des Registers ab. Marcel 16.10.2026: „wir bestimmen eine Formel fuer die
   Berechnung des Koeffizienten, damit es naeherungsweise ist. Das waere dann
   eine Stufe darunter."

   FORM (dieselbe, die Hamburg amtlich verwendet):
       UK(Objekt) / UK(Bezugsgroesse) = (Flaeche / Bezugsgroesse) ^ b

   VORGEHEN
   - Jede amtliche Tabelle/Formel (Saetze mit Wert UND vorgemerkte Stuetzstellen
     `formel_vorgemerkt` + `nutzung_intern: "stuetzstelle"`) wird an Stuetzstellen
     von 0,5- bis 2,5-facher Bezugsgroesse abgetastet - nur innerhalb ihres
     eigenen Gueltigkeitsbereichs, mit der ECHTEN koeffizientFuer().
   - Je Tabelle ein eigenes b (kleinste Quadrate durch den Ursprung in
     ln-ln). Jede Tabelle zaehlt EINMAL - lange Tabellen duerfen nicht
     dominieren.
   - Ergebnis: Median von b, getrennt fuer kreisfreie Staedte / Stadtstaaten
     („stadt") und Landkreise/Gemeinden („land"), dazu die Streuung zwischen
     den Tabellen (Quartile) und die typische Abweichung der Naeherung vom
     amtlichen Wert in Prozent - das ist die Genauigkeitsangabe im Bericht.
   - „Kein Einfluss" (flaeche_eins) zaehlt mit b = 0: auch das ist ein Markt.

   Schreibt `marktbericht/backend/src/lib/uk-naeherung.json` (mit Stand,
   Tabellenzahl, Laendern). Mit --trocken nur anzeigen. Nennt die DECKUNG. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDNER = path.join(WURZEL, 'marktbericht/backend/src/lib/register');
const ZIEL = path.join(WURZEL, 'marktbericht/backend/src/lib/uk-naeherung.json');
const UK = await import('file://' + path.join(WURZEL, 'marktbericht/backend/src/lib/umrechnung_flaeche.js').replace(/\\/g, '/'));
const TROCKEN = process.argv.includes('--trocken');

const FAKTOREN = [0.5, 0.6, 0.75, 0.9, 1.1, 1.25, 1.5, 1.75, 2, 2.5];
/* Kreisfreie Staedte erkennen: Stadtstaaten (02, 04, 11) und Saetze, deren
   Gebiets-/Ausschussname eine Stadt nennt und keinen Kreis/Landkreis. */
const istStadt = (s) => /^(02|04|11)/.test(String(s.ags))
  || (/\bstadt\b|stadtkreis|kreisfreie/i.test(String(s.gebiet_name || '') + ' ' + String(s.gaa_name || ''))
      && !/landkreis|\bkreis\b(?!freie)|kreises|region\b|städteregion/i.test(String(s.gebiet_name || '')));

function normen(f) {
  if (f.form === 'flaeche_tabelle') {
    return Object.entries(f.tabellen || {}).map(([k, t]) => (k === '*' ? Number(t.bezug_qm) : Number(k))).filter((x) => x > 0);
  }
  if (f.form === 'flaeche_funktion') {
    const sp = f.spanne_qm || [];
    const mitte = sp[0] && sp[1] ? Math.round(Math.sqrt(sp[0] * sp[1])) : 600;
    return [Number(f.normgroesse_qm) || mitte];
  }
  return [];
}

const tabellen = []; let gelesen = 0, dateien = 0, doppelt = 0;
/* Dieselbe Tabelle an vielen Gemeinden (NI: ein Dokument, 40 Gemeinde-Saetze) zaehlt EINMAL. */
const gesehen = new Set();
for (const datei of fs.readdirSync(ORDNER).filter((x) => x.startsWith('uk-') && x.endsWith('.json')).sort()) {
  const arr = JSON.parse(fs.readFileSync(path.join(ORDNER, datei), 'utf8')); dateien++;
  for (const s of arr) {
    gelesen++;
    const sperre = s.vollstaendig === false || !!s.warum_kein_wert;
    const formel = !sperre ? s.formel : (s.nutzung_intern === 'stuetzstelle' ? s.formel_vorgemerkt : null);
    if (!formel) continue;
    const satz = { ...s, formel };
    const _schl = JSON.stringify(formel);
    if (gesehen.has(_schl)) { doppelt++; continue; }
    gesehen.add(_schl);
    if (formel.form === 'flaeche_eins') {
      tabellen.push({ wo: datei + ' ' + (s.gebiet_name || s.ags), land: s.land_code, stadt: istStadt(s), b: 0, n: 0, quelle: sperre ? 'stuetzstelle' : 'wert' });
      continue;
    }
    for (const norm of normen(formel)) {
      let sxy = 0, sxx = 0, n = 0; const pkt = [];
      for (const fa of FAKTOREN) {
        const fl = Math.round(norm * fa);
        const kF = UK.koeffizientFuer(satz, fl, norm), kN = UK.koeffizientFuer(satz, norm, norm);
        if (kF.k == null || !(kN.k > 0)) continue;
        const x = Math.log(fl / norm), y = Math.log(kF.k / kN.k);
        sxy += x * y; sxx += x * x; n++; pkt.push([fl / norm, kF.k / kN.k]);
      }
      if (n < 3 || !(sxx > 0)) continue;
      tabellen.push({ wo: datei + ' ' + (s.gebiet_name || s.ags) + ' Norm ' + norm, land: s.land_code, stadt: istStadt(s),
                      b: sxy / sxx, n, pkt, quelle: sperre ? 'stuetzstelle' : 'wert' });
    }
  }
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const quartil = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

function klasse(liste) {
  const bs = liste.map((t) => t.b);
  const b = median(bs);
  /* typische Abweichung: wie weit liegt die Naeherung mit diesem b vom amtlichen
     Wert jeder Tabelle - Median der absoluten Prozentabweichung ueber alle Punkte */
  const abw = [];
  for (const t of liste) for (const [r, rel] of (t.pkt || [])) abw.push(Math.abs(Math.pow(r, b) / rel - 1) * 100);
  return { b: r3(b), b_q1: r3(quartil(bs, 0.25)), b_q3: r3(quartil(bs, 0.75)), tabellen: liste.length,
           laender: [...new Set(liste.map((t) => t.land))].sort(),
           abweichung_median_pct: r3(median(abw)), abweichung_p90_pct: r3(quartil(abw, 0.9)) };
}
const alle = klasse(tabellen), stadt = klasse(tabellen.filter((t) => t.stadt)), land = klasse(tabellen.filter((t) => !t.stadt));

console.log('DECKUNG: ' + dateien + ' Dateien, ' + gelesen + ' Saetze, ' + tabellen.length + ' Tabellen/Formeln ausgewertet ('
  + tabellen.filter((t) => t.quelle === 'stuetzstelle').length + ' davon interne Stuetzstellen, ' + doppelt + ' gleiche Tabellen nur einmal gezaehlt)');
for (const [n, k] of [['alle', alle], ['stadt', stadt], ['land', land]]) {
  console.log(n.padEnd(6) + ' b = ' + k.b + '  (Q1 ' + k.b_q1 + ' · Q3 ' + k.b_q3 + ')  Tabellen ' + k.tabellen
    + '  Laender ' + k.laender.join(' ') + '  typ. Abweichung ' + k.abweichung_median_pct + ' % (90 %: ' + k.abweichung_p90_pct + ' %)');
}
const beispiel = (b) => [0.5, 1.5, 2, 2.5].map((r) => r + 'x: ' + Math.round(Math.pow(r, b) * 1000) / 1000).join('  ');
console.log('Beispiel stadt: ' + beispiel(stadt.b || alle.b) + '   land: ' + beispiel(land.b || alle.b));

/* v2360 · ZWEITER AST JENSEITS DES 2,5-FACHEN. Dort fallen die amtlichen Tabellen
   steiler (Mehrflaeche wie Hinterland). Je Tabelle mit Wert beim 3-Fachen der
   Restfaktor c aus k(3)*3 = k(2,5)*2,5 + 0,5*c; Median ueber alle. Die Genauigkeit
   wird mitgeschrieben - sie ist deutlich schlechter als unter dem 2,5-Fachen. */
const restC = [], restPkt = [];
{
  const gesehen2 = new Set();
  for (const datei of fs.readdirSync(ORDNER).filter((x) => x.startsWith('uk-') && x.endsWith('.json'))) {
    for (const s of JSON.parse(fs.readFileSync(path.join(ORDNER, datei), 'utf8'))) {
      const sperre = s.vollstaendig === false || !!s.warum_kein_wert;
      const fm = !sperre ? s.formel : (s.nutzung_intern === 'stuetzstelle' ? s.formel_vorgemerkt : null);
      if (!fm || fm.form !== 'flaeche_tabelle') continue;
      const schl = JSON.stringify(fm); if (gesehen2.has(schl)) continue; gesehen2.add(schl);
      for (const norm of normen(fm)) {
        const satz = { ...s, formel: fm };
        const kk = (r) => { const a = UK.koeffizientFuer(satz, Math.round(norm * r), norm), n = UK.koeffizientFuer(satz, norm, norm); return a.k != null && n.k > 0 ? a.k / n.k : null; };
        const k25 = kk(2.5), k3 = kk(3);
        if (k25 != null && k3 != null) { restC.push((3 * k3 - 2.5 * k25) / 0.5); restPkt.push(k3); }
      }
    }
  }
}
const restFaktor = median(restC);
const restAbw = restPkt.map((k3) => Math.abs(((Math.pow(2.5, alle.b) * 2.5 + 0.5 * restFaktor) / 3) / k3 - 1) * 100);
console.log('oberhalb 2,5-fach: Restfaktor ' + r3(restFaktor) + ' aus ' + restC.length + ' Tabellen, typ. Abweichung beim 3-Fachen '
  + r3(median(restAbw)) + ' % (90 %: ' + r3(quartil(restAbw, 0.9)) + ' %)');
const MIN_TABELLEN = 8;
const aus = {
  stand: new Date().toISOString().slice(0, 10),
  form: 'UK(Objekt)/UK(Bezugsgroesse) = (Flaeche/Bezugsgroesse)^b',
  herkunft: 'DealPilot-Naeherung aus amtlichen Umrechnungstabellen der Gutachterausschuesse (Register), Median der Exponenten je Tabelle',
  stufe: 'N',   /* v2401 · eigene Stufe N (DealPilot-Formel), vorher D */
  /* v2360 · Marcel 17.10.2026: „fuer Mehrfamilienhaeuser muessen wir die Formel fuer den
     Koeffizienten auf jeden Fall mit hinzunehmen". mfh gilt als UEBERTRAGUNG aus dem
     individuellen Wohnungsbau (die Tabellen sind IfW) - nur in Zonen bis II Vollgeschosse,
     im Bericht ausdruecklich so gekennzeichnet. */
  gilt_fuer: { objektarten: ['efh', 'zfh', 'dhh', 'rh', 'mfh'], uebertragen_auf: ['mfh'], max_vollgeschosse: 2, verhaeltnis_von: 0.5, verhaeltnis_bis: restC.length >= MIN_TABELLEN ? 3 : 2.5 },
  mindest_tabellen: MIN_TABELLEN,
  oberhalb: restC.length >= MIN_TABELLEN ? { ab: 2.5, bis: 3, rest_faktor: r3(restFaktor), tabellen: restC.length,
    abweichung_median_pct: r3(median(restAbw)), abweichung_p90_pct: r3(quartil(restAbw, 0.9)) } : null,
  alle, stadt: stadt.tabellen >= MIN_TABELLEN ? stadt : null, land: land.tabellen >= MIN_TABELLEN ? land : null,
};
if (!TROCKEN) { fs.writeFileSync(ZIEL, JSON.stringify(aus, null, 2) + '\n'); console.log('geschrieben: ' + path.relative(WURZEL, ZIEL)); }
