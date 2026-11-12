#!/usr/bin/env node
/* tools/mietanker-pruefen.mjs · v3343 — Vergleichsmiete der Wohnung, Anker der Marktüblichkeit,
   Zielbild-Maximum, Fortschreibung und Kappungspfad (marktbericht/backend/src/lib/mietanker.js).
   Lädt die ECHTEN Dateien (Kern, Mietspiegel-Werte, Näherung, Kappungsliste), ohne Datenbank und Netz.
   Zensus-Zeilen der Demo-Gemeinden: tools/mietanker-zensus.json (gelesen von Staging, 12.11.2026).

   Abschnitte
     Q  Näherung ohne Spanne: Oberwert/Unterwert-Faktor = Median der freien Mietspiegel (gemessen, nicht gesetzt)
     H  Herford, Bj 1998, 98 m²: Mietspiegel 6,00 / 6,98 / 7,80, keine Bremse
     E  Einordnung: Oberwert nur mit zwei Merkmalgruppen, Achse des Mietspiegels zählt nicht doppelt
     B  Mietpreisbremse 110 %, Ausnahme § 556e/§ 556f
     N  Am Quittengarten 12 (Bünde, Näherung): Ist im Band über der Ø Miete des Zinssatzes bleibt Ist
     F  Fortschreibung 4 Jahre gegen Handrechnung, Rate (eigen, Formularvorgabe, Index)
     K  Kappungspfad über zwei Zyklen
     Z  Zielbild im Wertkern: Zielmiete zählt bis zum rechtlichen Maximum (PotenzialService)
   RC=0 sauber. */
import fs from 'node:fs';
import path from 'node:path';
import nodeModule from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (typeof nodeModule.registerHooks === 'function') nodeModule.registerHooks({ resolve(spec, ctx, next) {
  if (spec === 'pg') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('class Pool { query(){return Promise.reject(new Error("offline"))} on(){} end(){} }\nexport default { Pool };') };
  return next(spec, ctx);
} });
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(WURZEL, 'marktbericht/backend/src');
const imp = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
const MA = await imp('lib/mietanker.js');
const W = await imp('lib/mietspiegel/werte.js');
const N = await imp('lib/mietspiegel/naeherung.js');
const KP = await imp('lib/kappung.js');
const CC = await imp('services/CrossCheckService.js');
const PS = await imp('services/PotenzialService.js');
const Z = JSON.parse(fs.readFileSync(path.join(WURZEL, 'tools/mietanker-zensus.json'), 'utf8'));

let rot = 0, n = 0;
const ok = (ab, was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + ab + ' · ' + was + (ist !== undefined ? ' → ' + ist : '')); };
const gleich = (ab, was, ist, soll, tol = 0.005) => ok(ab, was + ' = ' + soll, ist != null && Math.abs(ist - soll) <= tol, ist);

/* Q */
{
  const { jeAgs } = W.werteLaden(); const o = [], u = [];
  for (const [, w] of jeAgs) { if (w.freigabe === 'gesperrt') continue;
    for (const bj of [1960, 1975, 1995]) for (const fl of [50, 70, 90]) { const r = W.mietspiegelWerteFuer(w, { baujahr: bj, wfl: fl }); if (r.mittel > 0 && r.oben > 0) o.push(r.oben / r.mittel); if (r.mittel > 0 && r.unten > 0) u.push(r.unten / r.mittel); } }
  const med = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  ok('Q', 'Rasterpunkte der freien Mietspiegel ≥ 300', o.length >= 300, o.length);
  gleich('Q', 'NAEHERUNG_OBEN gegen Median Oberwert/Mittel', MA.NAEHERUNG_OBEN, med(o), 0.01);
  gleich('Q', 'NAEHERUNG_UNTEN gegen Median Unterwert/Mittel', MA.NAEHERUNG_UNTEN, med(u), 0.01);
}
/* H */
const kH = { werte: W.werteFuer('05758012'), baujahr: 1998, signale: {} };
const vH = MA.vergleichsmieteWohnung(kH, 98);
const brH = KP.mietpreisbremseFuer('05758012', new Date('2026-11-12'));
{
  ok('H', 'Quelle Mietspiegel Herford', vH && vH.quelle === 'mietspiegel', vH && vH.etikett);
  gleich('H', 'unten', vH.unten, 6.00); gleich('H', 'Mittel', vH.mittel, 6.98); gleich('H', 'oben', vH.oben, 7.80);
  ok('H', 'ohne Merkmale Einordnung Mittelwert, Anker 6,98', vH.einordnung.wahl === 'mittel' && vH.qm === 6.98, vH.einordnung.wahl + ' ' + vH.qm);
  const b = MA.bandWohnung(vH);
  gleich('H', 'Band unten = min(6,00 ; 6,98 × 0,8)', b.unten_qm, 5.58); gleich('H', 'Band oben = max(7,80 ; 6,98 × 1,2)', b.oben_qm, 8.38);
  ok('H', 'Herford ohne Mietpreisbremse', brH.gilt === false, brH.gilt);
  const z = MA.zielMaximum(vH, brH);
  gleich('H', 'Bestandsmieter bis Oberwert', z.bestand_max_qm, 7.80); gleich('H', 'Neuvermietung 120 % × 7,80', z.neu_max_qm, 9.36);
  gleich('H', 'konservativ Mittelwert', z.konservativ_qm, 6.98);
  ok('H', 'Bedingung genannt (Einordnung nicht belegt)', !!z.bedingung && /BGH VIII ZR 82\/18/.test(z.bedingung));
  ok('H', 'Text § 5 WiStG ohne „Mietwucher", ohne Semikolon', /§ 5 WiStG/.test(z.texte[1]) && !/wucher/i.test(z.texte.join(' ')) && !/;/.test(z.texte.join(' ') + z.bedingung));
}
/* E */
{
  /* Herford unterscheidet die Lage selbst (Lagentabelle) - deshalb hier Ausstattung + Zustand */
  ok('E', 'Herford: Lage zählt nicht (der Mietspiegel führt eine Lagentabelle)', MA.vergleichsmieteWohnung(Object.assign({}, kH, { signale: { standardstufe: 4, mikrolage: 'gut' } }), 98).einordnung.wahl === 'mittel');
  const vO = MA.vergleichsmieteWohnung(Object.assign({}, kH, { signale: { standardstufe: 4, mod_punkte: 12 } }), 98);
  ok('E', 'Standardstufe 4 + 12 Modernisierungspunkte → Oberwert 7,80, belegt', vO.einordnung.wahl === 'oben' && vO.qm === 7.80 && vO.einordnung.belegt_oben, vO.einordnung.text);
  ok('E', 'mit belegtem Oberwert keine Bedingung im Zielbild', MA.zielMaximum(vO, brH).bedingung === null);
  const v1 = MA.vergleichsmieteWohnung(Object.assign({}, kH, { signale: { standardstufe: 4 } }), 98);
  ok('E', 'nur eine Merkmalgruppe → Mittelwert', v1.einordnung.wahl === 'mittel', v1.einordnung.wahl);
  const vG = MA.vergleichsmieteWohnung(Object.assign({}, kH, { signale: { standardstufe: 4, mikrolage: 'gut', zustand: 'sanierungsbedürftig' } }), 98);
  ok('E', 'positiv und negativ gemischt → Mittelwert', vG.einordnung.wahl === 'mittel', vG.einordnung.wahl);
  const vU = MA.vergleichsmieteWohnung(Object.assign({}, kH, { signale: { standardstufe: 1.5, zustand: 'sanierungsbedürftig' } }), 98);
  ok('E', 'zwei negative → Unterwert 6,00', vU.einordnung.wahl === 'unten' && vU.qm === 6.00, vU.qm);
  const e = MA.einordnung({ standardstufe: 4, mikrolage: 'gut' }, { lage: true });
  ok('E', 'Lage, die der Mietspiegel selbst unterscheidet, zählt nicht doppelt', e.wahl === 'mittel', e.text);
  const eNeu = MA.einordnung({ standardstufe: 4, baujahr: 2020, jahr: 2026 });
  ok('E', 'Neubau (≤ 10 Jahre) + gehobene Ausstattung → Oberwert', eNeu.wahl === 'oben', eNeu.text);
}
/* B */
{
  const z = MA.zielMaximum(vH, { gilt: true });
  gleich('B', 'mit Bremse 110 % × 7,80', z.neu_max_qm, 8.58);
  ok('B', 'Text § 556d, Ausnahmen genannt', /§ 556d/.test(z.texte[1]) && /§ 556e/.test(z.texte[1]));
  const zp = MA.zielMaximum(vH, { gilt: null });
  gleich('B', 'Bremse „bitte prüfen" rechnet vorsichtig wie mit Bremse', zp.neu_max_qm, 8.58);
  ok('B', 'eingetragene Ausnahme § 556f genannt', /556f/.test(MA.zielMaximum(vH, { gilt: true }, '556f').texte[1]));
}
/* N */
const kQ = { werte: null, naeherung_param: N.naeherungParameter(), zensus_zeilen: Z.gemeinden['05758004'], baujahr: 1966, signale: { mikrolage: 'durchschnittlich', mod_punkte: 0, zustand: 'gut' } };
const vQ = MA.vergleichsmieteWohnung(kQ, 74);
const bQ = MA.bandWohnung(vQ);
{
  ok('N', 'Bünde ohne Wertedatei → DealPilot-Näherung', vQ && vQ.quelle === 'naeherung' && vQ.ca, vQ && vQ.etikett);
  gleich('N', 'Näherung 74 m², Bj 1966 (Zensus 5,43 × 5,75 / 5,67 × 1,109)', vQ.mittel, 6.11);
  gleich('N', 'Oberwert ca. 6,11 × 1,14', vQ.oben, 6.97);
  gleich('N', 'Band unten 6,11 × 0,8', bQ.unten_qm, 4.89); gleich('N', 'Band oben 6,11 × 1,2', bQ.oben_qm, 7.33);
  const r1 = CC.mieteNachBand(7.03, bQ, bQ.anker_qm), r3 = CC.mieteNachBand(7.36, bQ, bQ.anker_qm);
  ok('N', 'Wohnung 1 Ist 7,03 im Band (über Ø Satzmiete 5,50) → Ist-Miete', r1.fuehrt && r1.qm === 7.03, r1.qm);
  ok('N', 'Wohnung 3 Ist 7,36 über dem Band → Anker 6,11 (E1)', !r3.fuehrt && r3.qm === 6.11, r3.qm);
  const brQ = KP.mietpreisbremseFuer('05758004', new Date('2026-11-12'));
  ok('N', 'Bünde ohne Mietpreisbremse', brQ.gilt === false, brQ.gilt);
  const zQ = MA.zielMaximum(vQ, brQ);
  gleich('N', 'Zielbild-Maximum Neuvermietung ca. 6,97 × 1,2', zQ.neu_max_qm, 8.36);
  ok('N', 'Näherung im Text als „ca."', /ca\. 8,36/.test(zQ.texte[1]), zQ.texte[1]);
  ok('N', 'freie Wertedatei vorhanden, Tabelle endet → keine Näherung', MA.vergleichsmieteWohnung({ werte: W.werteFuer('05758012'), naeherung_param: N.naeherungParameter(), zensus_zeilen: Z.gemeinden['05758012'], baujahr: 2030 }, 70) === null);
}
/* F */
{
  gleich('F', 'Faktor 4 Jahre × 2 % = 1,02^4', MA.fortschreibung(2, 4), 1.08243216, 1e-8);
  const vF = MA.spanneFortschreiben(vH, MA.fortschreibung(2, 4));
  gleich('F', 'Oberwert Herford 2030 = 7,80 × 1,0824', vF.oben, 8.44); gleich('F', 'Mittel 2030 = 6,98 × 1,0824', vF.mittel, 7.56);
  gleich('F', 'Maximum Neuvermietung 2030 = 8,44 × 1,2', MA.zielMaximum(vF, brH).neu_max_qm, 10.13);
  const rI = MA.mietsteigerungRate(null);
  gleich('F', 'Index der Nettokaltmieten 2020–2025: (109,4/100)^(1/5) − 1', rI.pct, 1.81, 0.001);
  ok('F', 'Zeitraum 2020 bis 2025 genannt', rI.von === 2020 && rI.bis === 2025 && /2020 bis 2025/.test(rI.text), rI.text);
  ok('F', 'Formularvorgabe 3,0 % zählt nicht als eigene Angabe', MA.mietsteigerungRate(3.0).quelle === 'nkm_index');
  const rE = MA.mietsteigerungRate(1.5);
  ok('F', 'eigene Mietsteigerung 1,5 % wird genommen', rE.quelle === 'eigen' && rE.pct === 1.5, rE.text);
}
/* K */
{
  const p = MA.kappungsPfad({ ist_qm: 5.0, vgl_qm: 7.5, rate_pct: 0, kappung_pct: 20, monate: 84 });
  ok('K', 'zwei Zyklen: 6,00 (Monat 0), 7,20 (Monat 36), 7,50 (Monat 72)', p.schritte.length === 3 && p.schritte[0].qm === 6 && p.schritte[1].monat === 36 && p.schritte[1].qm === 7.2 && p.schritte[2].monat === 72 && p.schritte[2].qm === 7.5, JSON.stringify(p.schritte));
  const p15 = MA.kappungsPfad({ ist_qm: 5.0, vgl_qm: 9.0, rate_pct: 0, kappung_pct: 15, monate: 72 });
  ok('K', 'Kappung 15 %: 5,75 (0), 6,61 (36), 7,60 (72)', p15.schritte.map((x) => x.qm).join('|') === '5.75|6.61|7.6', p15.schritte.map((x) => x.monat + ':' + x.qm).join(' '));
  const pR = MA.kappungsPfad({ ist_qm: 6.0, vgl_qm: 6.5, rate_pct: 2, kappung_pct: 20, monate: 48 });
  ok('K', 'Vergleichsmiete wächst mit: jede Stufe ≤ Vergleichsmiete zum Zeitpunkt', pR.schritte.every((x) => x.qm <= 6.5 * Math.pow(1.02, x.monat / 12) + 0.005) && pR.schritte.length >= 2, JSON.stringify(pR.schritte));
  const pS = MA.kappungsPfad({ ist_qm: 5.0, vgl_qm: 7.5, rate_pct: 0, kappung_pct: 20, monate: 84, erste_ab_monat: 10 });
  ok('K', 'Sperrfrist: erste Stufe erst ab Monat 10', pS.schritte[0].monat === 10, pS.schritte[0].monat);
}
/* Z */
{
  const zMax = MA.zielMaximum(vQ, { gilt: false });
  const z = { wfl: 74, ist: 6240, ist_qm: 7.03, qm: 7.03, herkunft: 'ist_im_band', roh: 6240, basis: 6240, band: bQ, markt: bQ.anker_qm, ziel_max: zMax };
  const sm = (q) => PS._stufenMiete(z, { miete_jahr: { zielbild: Math.round(q * 74 * 12) } }, 'zielbild', null);
  gleich('Z', 'Zielmiete 8,36 (rechtliches Maximum, über dem Band 7,33) zählt voll', sm(8.36), Math.round(8.36 * 74 * 12), 1);
  gleich('Z', 'Zielmiete 9,00 zählt bis zum Maximum 8,36', sm(9.0), 8.36 * 74 * 12, 1);
  gleich('Z', 'Zielmiete 8,00 zählt voll', sm(8.0), Math.round(8.0 * 74 * 12), 1);
  const zOhne = Object.assign({}, z, { ziel_max: null });
  const smO = PS._stufenMiete(zOhne, { miete_jahr: { zielbild: Math.round(8.36 * 74 * 12) } }, 'zielbild', null);
  gleich('Z', 'ohne Vergleichsmiete der Wohnung: alte Regel (über dem Band → Anker, Zielbild = Basis)', smO, 6240, 1);
}
console.log('mietanker-pruefen v3343 · ' + n + ' Punkte, ' + (n - rot) + ' grün, ' + rot + ' rot');
console.log(rot ? 'RC=1' : 'RC=0 sauber');
process.exit(rot ? 1 : 0);
