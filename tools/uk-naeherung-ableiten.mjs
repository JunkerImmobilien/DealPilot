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

/* ═══ v2610 · GRENZE 2,0 (E5, Marcel 21.10.2026 freigegeben) ═════════════
 * Begruendet mit: beim 2,0-Fachen Median 5,7 % gegen 16,3 % ohne Anpassung,
 * beim 2,5-Fachen 14,2 % gegen 11,7 % (cv-uk.mjs). ACHTUNG, nachgemessen in
 * v2610: die 2,5-Zahl stammt aus einer Teilmenge (Filter x.r === 2.5 trifft nur
 * Tabellen mit ganzzahliger Normgroesse x 2,5). Ueber alle Tabellen ist die
 * Formel beim 2,5-Fachen BESSER (grenze.gemessen_2_5). Umgesetzt wie entschieden,
 * zur Neuentscheidung vorgelegt; Ruecknahme = GRENZE hier setzen und neu laufen. Deshalb gilt
 * die Naeherung nur bis zum 2,0-Fachen; darueber Variante A (volle Flaeche,
 * markiert). Der zweite Ast (Restfaktor bis 3,0) entfaellt fuer die Naeherung.
 * Die amtlichen Tabellen sind davon nicht beruehrt.
 * Abgetastet und gelernt wird nur im Anwendungsbereich (bis 2,0), damit
 * Exponent und Kreuzvalidierung den Bereich beschreiben, in dem gerechnet wird.
 * Die Stuetzstelle 2,5 wird nur noch GEMESSEN (grenze.gemessen_2_5). */
const GRENZE = 2;
const FAKTOREN_ALLE = [0.5, 0.6, 0.75, 0.9, 1.1, 1.25, 1.5, 1.75, 2, 2.5];
const FAKTOREN = FAKTOREN_ALLE.filter((f) => f <= GRENZE);
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
      /* v2610 · nur gemessen, nicht gelernt: der amtliche Wert beim 2,5-Fachen */
      const k25 = UK.koeffizientFuer(satz, Math.round(norm * 2.5), norm), k25n = UK.koeffizientFuer(satz, norm, norm);
      tabellen.push({ wo: datei + ' ' + (s.gebiet_name || s.ags) + ' Norm ' + norm, land: s.land_code, stadt: istStadt(s),
                      b: sxy / sxx, n, pkt, quelle: sperre ? 'stuetzstelle' : 'wert',
                      p25: k25.k != null && k25n.k > 0 ? k25.k / k25n.k : null });
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
  /* ═══ v2593 · NACHGEPRUEFT STATT IN DER STICHPROBE ════════════════════
   * abweichung_* oben misst die Formel an den Tabellen, aus denen sie
   * gelernt ist. Die Kundentexte nennen seit v2593 die Kreuzvalidierung:
   * je Tabelle b = Median der UEBRIGEN Tabellen (Leave-one-Tabelle-out),
   * dazu Leave-one-Land-out. Tabellen ohne Abhaengigkeit (flaeche_eins)
   * zaehlen mit UK = 1 an allen Stuetzpunkten - auch sie sind amtlich.
   * Spanne: b_p10..b_p90 der Tabellen, Deckung je ausgelassener Tabelle
   * mit P10/P90 der uebrigen. Ausgegeben wird die Spanne noch nicht. */
  const pktVon = (t) => (t.pkt && t.pkt.length ? t.pkt : FAKTOREN.map((r) => [r, 1]));
  const cv = (gruppe) => {
    const e = [];
    for (const t of liste) {
      const bo = median(liste.filter((x) => gruppe(x) !== gruppe(t)).map((x) => x.b));
      if (bo == null) continue;
      for (const [r, rel] of pktVon(t)) e.push(Math.abs(Math.pow(r, bo) / rel - 1) * 100);
    }
    return { median_pct: r3(median(e)), p80_pct: r3(quartil(e, 0.8)), p95_pct: r3(quartil(e, 0.95)), punkte: e.length };
  };
  let drin = 0, n = 0;
  liste.forEach((t, i) => {
    const bo = liste.filter((_, j) => j !== i).map((x) => x.b);
    const lo = quartil(bo, 0.1), hi = quartil(bo, 0.9);
    for (const [r, rel] of pktVon(t)) {
      if (Math.abs(r - 1) < 1e-9) continue;
      const k1 = Math.pow(r, lo), k2 = Math.pow(r, hi); n++;
      if (rel >= Math.min(k1, k2) - 1e-9 && rel <= Math.max(k1, k2) + 1e-9) drin++;
    }
  });
  return { b: r3(b), b_q1: r3(quartil(bs, 0.25)), b_q3: r3(quartil(bs, 0.75)),
           b_p10: r3(quartil(bs, 0.1)), b_p90: r3(quartil(bs, 0.9)), tabellen: liste.length,
           laender: [...new Set(liste.map((t) => t.land))].sort(),
           abweichung_median_pct: r3(median(abw)), abweichung_p90_pct: r3(quartil(abw, 0.9)),
           pruefung: { loto: cv((t) => t), lolo: cv((t) => t.land),
             spanne_b_deckung_pct: n ? Math.round(1000 * drin / n) / 10 : null,
             methode: 'Leave-one-Tabelle-out (b = Median der uebrigen Tabellen) und Leave-one-Land-out; |Naeherung/amtlich - 1| in Prozent an allen Stuetzpunkten; Spanne r^b_p10..r^b_p90 mit P10/P90 der uebrigen Tabellen' } };
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
/* v2610 · Grenze belegen: beim 2,5-Fachen Formel (b ohne die eigene Tabelle) gegen UK = 1 */
const g25 = [], g25_0 = [], g25_l = [];
tabellen.forEach((t, i) => {
  if (t.p25 == null && t.b !== 0) return;
  const a = t.p25 == null ? 1 : t.p25;
  const bo = median(tabellen.filter((_, j) => j !== i).map((x) => x.b));
  const bl = median(tabellen.filter((x) => x.land !== t.land).map((x) => x.b));
  g25.push(Math.abs(Math.pow(2.5, bo) / a - 1) * 100); g25_0.push(Math.abs(1 / a - 1) * 100);
  g25_l.push(Math.abs(Math.pow(2.5, bl) / a - 1) * 100);
});
const grenze = { verhaeltnis_bis: GRENZE,
  begruendung: 'Marcels Entscheidung 21.10.2026 (E5): oberhalb des 2,0-Fachen der Bezugsgroesse keine Naeherung, dort Variante A (volle Flaeche, markiert). Grundlage war die Messung "beim 2,5-Fachen schlechter als keine Anpassung" (Median 14,2 gegen 11,7 %). Die Vollmessung hier (alle Tabellen, exakte Stuetzstelle 2,5) zeigt das Gegenteil - siehe gemessen_2_5; die Ausgangsmessung erfasste nur Tabellen, deren Normgroesse x 2,5 ganzzahlig ist. Zur Neuentscheidung vorgelegt.',
  gemessen_2_5: { tabellen: g25.length, formel_median_pct: r3(median(g25)), ohne_anpassung_median_pct: r3(median(g25_0)),
    formel_p80_pct: r3(quartil(g25, 0.8)), ohne_anpassung_p80_pct: r3(quartil(g25_0, 0.8)),
    formel_lolo_median_pct: r3(median(g25_l)), formel_lolo_p80_pct: r3(quartil(g25_l, 0.8)),
    methode: 'Leave-one-Tabelle-out (formel_*) und Leave-one-Land-out (formel_lolo_*); Tabellen ohne Flaechenabhaengigkeit mit UK = 1' } };
console.log('Grenze ' + GRENZE + '-fach: beim 2,5-Fachen (' + g25.length + ' Tabellen) Formel ' + grenze.gemessen_2_5.formel_median_pct
  + ' % (LOLO ' + grenze.gemessen_2_5.formel_lolo_median_pct + ') gegen ohne Anpassung ' + grenze.gemessen_2_5.ohne_anpassung_median_pct + ' % (Median); P80 '
  + grenze.gemessen_2_5.formel_p80_pct + ' gegen ' + grenze.gemessen_2_5.ohne_anpassung_p80_pct);
const aus = {
  stand: new Date().toISOString().slice(0, 10),
  form: 'UK(Objekt)/UK(Bezugsgroesse) = (Flaeche/Bezugsgroesse)^b',
  herkunft: 'DealPilot-Naeherung aus amtlichen Umrechnungstabellen der Gutachterausschuesse (Register), Median der Exponenten je Tabelle',
  stufe: 'N',   /* v2401 · eigene Stufe N (DealPilot-Formel), vorher D */
  /* v2360 · Marcel 17.10.2026: „fuer Mehrfamilienhaeuser muessen wir die Formel fuer den
     Koeffizienten auf jeden Fall mit hinzunehmen". mfh gilt als UEBERTRAGUNG aus dem
     individuellen Wohnungsbau (die Tabellen sind IfW) - nur in Zonen bis II Vollgeschosse,
     im Bericht ausdruecklich so gekennzeichnet. */
  gilt_fuer: { objektarten: ['efh', 'zfh', 'dhh', 'rh', 'mfh'], uebertragen_auf: ['mfh'], max_vollgeschosse: 2, verhaeltnis_von: 0.5, verhaeltnis_bis: GRENZE },
  mindest_tabellen: MIN_TABELLEN,
  grenze,
  /* v2610 · der zweite Ast ist fuer die Naeherung abgeschaltet; die Messung bleibt im Protokoll */
  oberhalb_gemessen: restC.length >= MIN_TABELLEN ? { verdrahtet: false, ab: 2.5, bis: 3, rest_faktor: r3(restFaktor), tabellen: restC.length,
    abweichung_median_pct: r3(median(restAbw)), abweichung_p90_pct: r3(quartil(restAbw, 0.9)),
    /* v2593 · Leave-one-Tabelle-out wie oben */
    pruefung: (() => { const e = restPkt.map((k3, i) => { const c = median(restC.filter((_, j) => j !== i));
      return Math.abs(((Math.pow(2.5, alle.b) * 2.5 + 0.5 * c) / 3) / k3 - 1) * 100; });
      return { loto: { median_pct: r3(median(e)), p80_pct: r3(quartil(e, 0.8)), p95_pct: r3(quartil(e, 0.95)), punkte: e.length } }; })() } : null,
  alle, stadt: stadt.tabellen >= MIN_TABELLEN ? stadt : null, land: land.tabellen >= MIN_TABELLEN ? land : null,
};
if (!TROCKEN) { fs.writeFileSync(ZIEL, JSON.stringify(aus, null, 2) + '\n'); console.log('geschrieben: ' + path.relative(WURZEL, ZIEL)); }
