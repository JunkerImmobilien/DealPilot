#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * tools/anlage-v-pruefen.mjs — v3800
 *
 * Marcel 19.11.2026 nach dem Termin bei der Steuerkanzlei: alles, was die
 * Anlage V abfragt, muss eingebbar sein und an der richtigen Zeile ankommen;
 * die Kanzlei las die Zeilennummern als „alt".
 *
 *  A  jede Abschrift frontend/js/anlage-v-<JJJJ>.js: Kopf (Quelle, Kennung,
 *     Stand), jede Zuordnung zeigt auf eine abgeschriebene Zeile, alle Angaben
 *     des Kerns haben eine Zeile, Summenzeilen vorhanden, Kundentext sauber
 *  B  Kern js/anlage-v-kern.js am echten Code: ohne Angaben Wirkung 0, Teile der
 *     Kaltmiete aendern die Summe nicht, Zeile 15 = Kaltmiete − Teile, verteilte
 *     Erhaltung je Ursprungsjahr, § 7b getrennt, Kuerzung, STRENG je Jahr
 *  C  tax.js _computeYearTotal mit gespeichertem Satz (vorgabe): ohne anlage_v
 *     bitgleich, mit Angaben Einnahmen/Werbungskosten/Ergebnis wie der Kern
 *  D  keine Zeilennummer fest im Code der drei Ansichten, kein Ersatzjahr,
 *     Verdrahtung (index.html laedt den Kern, Speichern schickt anlage_v,
 *     Backend nimmt anlage_v an, Migration)
 *  G  Gegenprobe: je eine Stelle zurueckgebaut -> erwartet ROT
 *
 * Aufruf: node tools/anlage-v-pruefen.mjs     RC=0 sauber
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');   /* Arbeitskopie kann CRLF sein (autocrlf) */
let rot = 0, gruen = 0, still = false;
const ok = (b, t) => { if (b) gruen++; else { rot++; if (!still) console.log('  ROT  ' + t); } };
const nah = (a, b, tol = 0.005) => Math.abs(a - b) <= tol;

function kernCtx(quellen) {
  const ctx = { console, Math, Number, String, Object, isFinite };
  ctx.window = ctx; vm.createContext(ctx);
  for (const q of quellen) vm.runInContext(q, ctx);
  return ctx;
}

function pruefen(Q) {
  const r0 = rot;
  /* ── A · Abschriften ── */
  const dateien = fs.readdirSync(path.join(ROOT, 'frontend/js')).filter((f) => /^anlage-v-\d{4}\.js$/.test(f)).sort();
  ok(dateien.length >= 1, 'A mindestens eine Abschrift anlage-v-<Jahr>.js');
  const K0 = kernCtx([Q.kern]).AnlageVKern;
  for (const f of dateien) {
    const jahr = +f.slice(9, 13);
    const src = Q.jahr[f] != null ? Q.jahr[f] : lies('frontend/js/' + f);
    const c = kernCtx([src]); const T = c['AnlageV' + jahr];
    ok(T && T.jahr === jahr && T.zeilen && T.felder, 'A ' + f + ': window.AnlageV' + jahr + ' mit jahr, zeilen, felder');
    if (!T) continue;
    ok(/Quelle|quelle/.test(src.slice(0, 2000)) && T.quelle && T.formular && /^\d{4}AnlV/.test(T.formular) && T.formular.indexOf(String(jahr)) === 0, 'A ' + f + ': Kopf nennt Quelle und Formularkennung des Jahres');
    ok(!!T.stand, 'A ' + f + ': Stand des Vordrucks');
    const fehlt = Object.keys(T.felder).filter((k) => T.felder[k].zeile != null && !T.zeilen[T.felder[k].zeile]);
    ok(!fehlt.length, 'A ' + f + ': jede Zuordnung zeigt auf eine abgeschriebene Zeile ' + fehlt.join(','));
    const ohne = K0.SCHLUESSEL.filter((k) => !T.felder[k]);
    ok(!ohne.length, 'A ' + f + ': jede Angabe des Kerns hat eine Zuordnung (auch null) ' + ohne.join(','));
    const S = T.summen || {};
    ok(['einnahmen', 'werbungskosten', 'ueberschuss'].every((k) => S[k] != null && T.zeilen[S[k]]), 'A ' + f + ': Summenzeilen einnahmen/werbungskosten/ueberschuss abgeschrieben');
    const ne = ((src.match(/nicht_erfasst:\s*\[([\s\S]*?)\n  \]/) || [])[1] || '').replace(/\/\*[\s\S]*?\*\//g, '');
    ok(!/tax_records|afa_linear|afa_sonder_7b|v\d{3,4}|`/.test(ne), 'A ' + f + ': „im Formular selbst" ohne interne Begriffe');
  }

  /* ── B · Kern ── */
  const c = kernCtx([Q.jahr['anlage-v-2025.js'] != null ? Q.jahr['anlage-v-2025.js'] : lies('frontend/js/anlage-v-2025.js'), Q.kern]);
  const K = c.AnlageVKern;
  ok(K && K.aufstellung && K.wirkung && K.tabelle, 'B Schnittstelle AnlageVKern');
  if (!K) return;
  const w0 = K.wirkung({}, 5000);
  ok(w0.ein === 0 && w0.wk === 0 && w0.kuerzung === 0, 'B ohne Angaben: Wirkung 0 (bitgleich)');
  ok(K.tabelle(2026) === null || !!c.AnlageV2026, 'B STRENG: ohne Abschrift 2026 kein Ersatzjahr');
  ok(K.tabelle(2024) === null, 'B STRENG: 2024 ohne Abschrift -> null');
  /* Beispiel: Kaltmiete 12.000 inkl. 1.200 Garagen und 2.400 Angehoerige, Umlagen 2.000 */
  const v = { einnahmen_km: 12000, einnahmen_nk: 2000, av_garagen: 1200, av_angehoerige: 2400, av_nk_nachzahlung: -150,
    schuldzinsen: 3000, afa: 2500, nk_umlf: 2000, erhaltungsaufwand: 1500, av_renten: 600, av_ust_gezahlt: 100,
    av_zuschuesse: 500, av_zuschuesse_eigen: 100, av_kuerzung_pct: 10, av_vorsteuer: 50, av_wohnflaeche: 120 };
  const wkGrund = 3000 + 2500 + 2000 + 1500;
  const w = K.wirkung(v, wkGrund);
  ok(nah(w.ein, -150 + 500 - 100) && nah(w.wk, 700), 'B Wirkung: Einnahmen −150 + 500 − 100, Werbungskosten 600 + 100');
  ok(nah(w.kuerzung, (wkGrund + 700) * 0.10), 'B Kuerzung 10 % auf die vollen Werbungskosten');
  const ein = 14000 + w.ein, wk = wkGrund + w.wk;
  const R = K.aufstellung(2025, { values: v, einnahmen: ein, werbungskosten: wk, ergebnis: ein - wk + w.kuerzung,
    afaLinear: 2000, afaSonder7b: 500, auto: { afa: 2500, erhaltungsaufwand: 1500 }, erhV: { 2025: 600, 2024: 400 }, erhG: 1800 });
  const z = (liste, nr) => liste.filter((e) => e.zeile === nr);
  ok(R && z(R.einnahmen, 15).length === 1 && nah(z(R.einnahmen, 15)[0].betrag, 12000 - 1200 - 2400), 'B Zeile 15 = Kaltmiete − Garagen − Angehoerige (8.400)');
  ok(R && z(R.einnahmen, 26).length === 1 && nah(z(R.einnahmen, 26)[0].betrag, 1200) && z(R.einnahmen, 19).length === 1, 'B Garagen in Zeile 26, Angehoerige in Zeile 19');
  ok(R && z(R.einnahmen, 21).length === 1 && nah(z(R.einnahmen, 21)[0].betrag, -150), 'B Nachzahlung/Erstattung NK in Zeile 21 (negativ)');
  ok(R && z(R.einnahmen, 31).length === 1 && nah(z(R.einnahmen, 31)[0].betrag, 400) && z(R.einnahmen, 30).length === 1, 'B Zeile 29 − Zeile 30 = Zeile 31 (Kz 08)');
  const sumEin = R ? R.einnahmen.filter((e) => !e.teil).reduce((a, e) => a + e.betrag, 0) : 0;
  ok(R && nah(sumEin, ein) && R.summeEinnahmen.zeile === 32 && nah(R.summeEinnahmen.betrag, ein), 'B Einnahmenzeilen ergeben Zeile 32 (' + Math.round(sumEin) + ' / ' + ein + ')');
  const sumWk = R ? R.wk.reduce((a, e) => a + e.betrag, 0) : 0;
  ok(R && nah(sumWk, wk) && R.summeWk.zeile === 83, 'B Werbungskostenzeilen ergeben Zeile 83 (' + Math.round(sumWk) + ' / ' + wk + ')');
  ok(R && z(R.wk, 35).length === 1 && nah(z(R.wk, 35)[0].betrag, 2000) && z(R.wk, 38).length === 1 && nah(z(R.wk, 38)[0].betrag, 500), 'B § 7b getrennt: Zeile 35 linear, Zeile 38 Sonder-AfA');
  ok(R && nah((z(R.wk, 55)[0] || {}).betrag, 500) && nah((z(R.wk, 60)[0] || {}).betrag, 600) && nah((z(R.wk, 72)[0] || {}).betrag, 400), 'B Erhaltung: sofort Zeile 55 (500), verteilt 2025 Zeile 60 (600), aus 2024 Zeile 72 (400)');
  ok(R && z(R.info, 57).length === 1 && z(R.info, 84).length === 1 && z(R.info, 11).length === 1 && z(R.info, 87).length === 1, 'B Angaben ohne Wirkung: Zeilen 11, 57, 84, 87');
  ok(R && z(R.wk, 54).length === 1 && z(R.wk, 79).length === 1, 'B Renten Zeile 54, gezahlte USt Zeile 79');
  ok(R && R.kuerzung && nah(R.kuerzung.betrag, w.kuerzung) && nah(R.ueberschuss.betrag, ein - wk) && R.ueberschuss.zeile === 85, 'B Zeile 85 ungekuerzt, Kuerzung als Hinweis');
  const R2 = K.aufstellung(2025, { values: Object.assign({}, v, { erhaltungsaufwand: 2000 }), einnahmen: ein, werbungskosten: wk + 500, auto: { erhaltungsaufwand: 1500 }, erhV: { 2025: 600 } });
  ok(R2 && nah((z(R2.wk, 55)[0] || {}).betrag, 2000) && R2.hinweise.some((h) => /von Hand/.test(h)), 'B Erhaltung von Hand geaendert: ganz in Zeile 55, mit Hinweis');
  const R3 = K.aufstellung(2025, { values: { einnahmen_km: 1000, av_garagen: 1500 }, einnahmen: 1000, werbungskosten: 0 });
  ok(R3 && R3.hinweise.length >= 1, 'B Teile groesser als die Kaltmiete: Hinweis');
  ok(K.aufstellung(2024, { values: v }) === null, 'B Aufstellung fuer ein Jahr ohne Abschrift: null');

  /* ── B2 · v3800b ── */
  const s7 = (j) => K.sieben(100000, 2020, j).satz;
  ok(s7(2019) === 0 && s7(2020) === 9 && s7(2027) === 9 && s7(2028) === 7 && s7(2031) === 7 && s7(2032) === 0, 'B2 §§ 7h/7i: 2020-2027 je 9 %, 2028-2031 je 7 %, davor/danach 0 (Abs. 1 Satz 1)');
  /* ELSTER-Hilfe Anlage V 2025, Beispiel Familie Muster: 420 / 1.050 = 40 %, Kuerzung 60 %, WK 4.920 -> 1.968 */
  const vb40 = K.verbilligt({ quote: 420 / 1050 * 100 });
  const wB = K.wirkung({ av_kuerzung_pct: vb40.pct }, 4920);
  ok(vb40.pct === 60 && nah(4920 - wB.kuerzung, 1968), 'B2 Beispiel der ELSTER-Hilfe: 40 % entgeltlich -> Kuerzung 60 %, Werbungskosten 4.920 -> 1.968 €');
  const pos = Array.from({ length: 10 }, () => ({ ein: 10000, wk: 9500 })), neg = Array.from({ length: 10 }, () => ({ ein: 10000, wk: 12500 }));
  ok(K.verbilligt({ quote: 60, jahre: pos }).pct === 0 && K.verbilligt({ quote: 60, jahre: neg }).pct === 40, 'B2 60 %: Prognose positiv -> keine Kuerzung, negativ -> 40 % (§ 21 Abs. 2 Satz 2)');
  /* Sicherheitsabschlaege Rz. 34: 30 x 10.000 x 1,1 = 330.000, 30 x 12.000 x 0,9 = 324.000 -> positiv, ohne Zuschlaege negativ */
  ok(K.verbilligt({ quote: 60, jahre: Array.from({ length: 30 }, () => ({ ein: 10000, wk: 12000 })) }).pct === 0, 'B2 Sicherheitszuschlag/-abschlag 10 % (BMF 08.10.2004 Rz. 34)');
  ok(K.verbilligt({ quote: 66 }).pct === 0 && K.verbilligt({ quote: 80 }).pct === 0, 'B2 ab 66 %: voll entgeltlich');
  const wA = K.wirkung({ av_anteil_pct: 80 }, 10000);
  ok(nah(wA.wk, -2000) && nah(K.wirkung({}, 10000).wk, 0) && nah(K.wirkung({ av_anteil_pct: 0 }, 10000).wk, 0), 'B2 abzugsfaehiger Anteil 80 %: Werbungskosten −20 %, fehlend/0 = 100 %');
  const vA = { einnahmen_km: 12000, einnahmen_nk: 0, schuldzinsen: 3000, afa: 2000, erhaltungsaufwand: 1000, av_anteil_pct: 80, av_zurechnung_a_pct: 50, av_fewo: 2, av_angeh_flag: 2, av_andere_raeume: 3000 };
  const RA = K.aufstellung(2025, { values: vA, einnahmen: 12000, werbungskosten: 6000 * 0.8, afaArt: { m: 'linear', s: 2 }, kaufjahr: 2024,
    einheiten: [{ b: 'Wohnung 1', q: 60, e: 500, g: 0 }, { b: 'Wohnung 2', q: 40, e: 250, g: 0 }, { b: 'Laden', q: 50, e: 250, g: 1 }] });
  const zA = (l, nr, teil) => l.filter((e) => e.zeile === nr && !!e.teil === !!teil);
  ok(RA && nah(zA(RA.wk, 35)[0].betrag, 1600) && zA(RA.wk, 34, true).length === 1 && nah(zA(RA.wk, 48)[0].betrag, 2400) && zA(RA.wk, 47, true).length === 1, 'B2 verhaeltnismaessig: Zeile 35 = 80 % der AfA, Zeile 34 Gesamtbetrag/Anteil, ebenso 47/48');
  ok(RA && zA(RA.wk, 56).length === 1 && nah(zA(RA.wk, 56)[0].betrag, 800) && !zA(RA.wk, 55).length, 'B2 Erhaltung verhaeltnismaessig in Zeile 56 (Kz 37), nicht 55');
  ok(RA && nah(RA.wk.filter((e) => !e.teil).reduce((a, e) => a + e.betrag, 0), 4800), 'B2 Summe der Zeilen = Zeile 83 (4.800)');
  ok(RA && zA(RA.einnahmen, 13, true).length === 1 && zA(RA.einnahmen, 14, true).length === 1 && nah(zA(RA.einnahmen, 13, true)[0].betrag + zA(RA.einnahmen, 14, true)[0].betrag, 9000) && nah(zA(RA.einnahmen, 16, true)[0].betrag, 3000), 'B2 Einzelangaben: Zeilen 13/14 ergeben Zeile 15 (9.000), Zeile 16 = Zeile 18 (3.000)');
  ok(RA && RA.zurechnung && RA.zurechnung.zeile === 86 && nah(RA.zurechnung.a, RA.zurechnung.b), 'B2 Zeile 86: haelftige Zurechnung Person A / B');
  ok(RA && RA.info.some((e) => e.zeile === 10 && /2 = Nein/.test(e.text) && e.kz === '61') && RA.info.some((e) => e.zeile === 33 && /wie Vorjahr/.test(e.text)), 'B2 Ankreuzfeld Zeile 10 (Kz 61), AfA-Angaben Zeile 33');

  /* ── C · tax.js mit gespeichertem Satz ── */
  const tc = { console: { log() {}, warn() {}, info() {}, error() {} }, Date, Math, JSON, parseFloat, parseInt, isFinite, isNaN, Number, String, Object, Array, Promise, setTimeout() {}, clearTimeout() {},
    document: { getElementById: () => null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }) }, addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } };
  tc.window = tc; tc.parseDe = (s) => { const n = parseFloat(String(s == null ? '' : s).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }; tc.State = {};
  vm.createContext(tc);
  let cyt = null;
  try {
    for (const f of ['anteilig.js', 'afa-engine.js', 'deal-kpis.js', 'anlage-v-2025.js']) vm.runInContext(lies('frontend/js/' + f), tc);
    vm.runInContext(Q.kern, tc);
    vm.runInContext(Q.tax + ';window._cyt=_computeYearTotal;', tc);
    cyt = tc._cyt;
  } catch (e) { ok(false, 'C tax.js laedt im Pruefstand: ' + e.message); }
  if (cyt) {
    const satz = { schuldzinsen: 3000, afa: 2500, nk_umlf: 2000, erhaltungsaufwand: 1500, einnahmen_km: 12000, einnahmen_nk: 2000 };
    const a = cyt(2025, 0, satz);
    ok(nah(a.einnahmen, 14000) && nah(a.werbungskosten, 9000) && nah(a.ergebnis, 5000), 'C ohne anlage_v bitgleich: 14.000 / 9.000 / 5.000');
    const b = cyt(2025, 0, Object.assign({}, satz, { anlage_v: { av_garagen: 1200, av_renten: 600, av_ust_gezahlt: 100, av_nk_nachzahlung: -150, av_zuschuesse: 500, av_zuschuesse_eigen: 100, av_kuerzung_pct: 10, _erhV: { 2025: 600 } } }));
    ok(nah(b.einnahmen, 14250) && nah(b.werbungskosten, 9700) && nah(b.ergebnis, 14250 - 9700 + 970), 'C mit anlage_v: Einnahmen 14.250, Werbungskosten 9.700, Ergebnis mit Kuerzung 970');
    ok(b.erhV && b.erhV[2025] === 600 && b.values.av_garagen === 1200, 'C Auskunft aus anlage_v kommt an (erhV, av_garagen)');
    const c3 = cyt(2025, 0, Object.assign({}, satz, { anlage_v: { av_anteil_pct: 80, av_zurechnung_a_pct: 50, av_fewo: 2 } }));
    ok(nah(c3.einnahmen, 14000) && nah(c3.werbungskosten, 7200) && nah(c3.ergebnis, 6800), 'C abzugsfaehiger Anteil 80 %: Werbungskosten 7.200, Ergebnis 6.800; Flags/Zurechnung ohne Wirkung');
    if (process.argv.find((a) => a.startsWith('--saetze='))) {
      /* Gespeicherte Saetze ohne anlage_v (JSON-Liste, lesend aus Staging geholt): neue Rechnung = alte Formel */
      const S = JSON.parse(fs.readFileSync(process.argv.find((a) => a.startsWith('--saetze=')).slice(9), 'utf8').replace(/^[^\[]*/, ''));
      const WKF = ['schuldzinsen','kontofuehrung','bereitstellung','notar_grundschuld','vermittlung','finanz_sonst','nk_umlf','nk_n_umlf','betr_sonst','hausverwaltung','steuerber','porto','verw_sonst','fahrtkosten','verpflegung','hotel','inserat','gericht','telefon','sonst_kosten','afa','sonst_bewegl_wg','anschaffungsnah','erhaltungsaufwand'];
      let ab = 0;
      for (const s of S) {
        const e0 = (+s.einnahmen_km) + (+s.einnahmen_nk), w0 = WKF.reduce((a, f) => a + (+s[f] || 0), 0), t = cyt(s.year, 0, s);
        if (!nah(t.einnahmen, e0) || !nah(t.werbungskosten, w0) || !nah(t.ergebnis, e0 - w0)) ab++;
      }
      ok(S.length > 0 && ab === 0, 'C ' + S.length + ' gespeicherte Saetze ohne anlage_v: neue Rechnung = alte Formel (' + ab + ' Abweichungen)');
      if (!still) console.log('  C  ' + S.length + ' gespeicherte Saetze ohne anlage_v nachgerechnet, ' + ab + ' Abweichungen');
    }
  }

  /* ── D · Verdrahtung, keine festen Nummern ── */
  const code = (x) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const dokA = (Q.dok.match(/function anlageVBlatt\([\s\S]*?\n  \}\n/) || [''])[0];
  const wkA = (Q.wk.match(/function _renderAnlageVPage\([\s\S]*?\n\}\n/) || [''])[0];
  const festeNr = /(zl|zeile|summe)\(\s*'?\d{2}\b|'Zeile \d+'|Zeile \d{2}\b/;
  ok(dokA && !festeNr.test(code(dokA)), 'D Steuer-Mappe (anlageVBlatt): keine Zeilennummer im Code');
  ok(wkA && !festeNr.test(code(wkA)), 'D Werbungskosten-PDF (_renderAnlageVPage): keine Zeilennummer im Code');
  ok(/AnlageVKern\.zeileFuer\(y\.year, r\.f\)/.test(Q.tax) && !/_avAlt/.test(code(Q.tax)), 'D Tooltip: nur die Abschrift des Jahres, kein Ersatzjahr');
  ok(!/ersatz: k\[i\]|ersatz: kandidaten\[i\]/.test(code(Q.dok) + code(Q.wk)), 'D kein Ersatzjahr in Steuer-Mappe und Werbungskosten-PDF');
  ok(/js\/anlage-v-2025\.js\?v=[^"]+"><\/script>\s*\n<script src="js\/anlage-v-kern\.js\?v=/.test(Q.idx), 'D index.html laedt den Kern nach der Abschrift');
  ok(/anlage_v: \(function \(\) \{[\s\S]{0,200}AnlageVKern\.auszug\(v\)/.test(Q.sto), 'D Speichern schickt anlage_v (storage.js)');
  ok(/anlage_v: z\.record/.test(lies('backend/src/routes/taxRecords.js')) && /anlageV\(data\.anlage_v\)/.test(lies('backend/src/services/taxService.js')), 'D Backend nimmt anlage_v an und speichert es');
  ok(fs.existsSync(path.join(ROOT, 'backend/migrations/120_tax_records_anlage_v.sql')), 'D Migration 120 tax_records.anlage_v');
  ok(/av_garagen: \(function/.test(Q.tax) && /DpZeAufteilung, t = Z && Z\.teile/.test(Q.tax), 'D tax.js: Zeile Garagen aus der Aufteilung der Zusatzeinnahmen');
  ok(/erhV: j\.erhV/.test(lies('frontend/js/sanierung-plan.js')), 'D Sanierungsplan liefert verteilte Erhaltung je Ursprungsjahr');
  return rot - r0;
}

const Q = { kern: lies('frontend/js/anlage-v-kern.js'), tax: lies('frontend/js/tax.js'), dok: lies('frontend/js/dp-dokumente.js'),
  wk: lies('frontend/js/werbungskosten-pdf.js'), idx: lies('frontend/index.html'), sto: lies('frontend/js/storage.js'), jahr: {} };
console.log('Anlage V · Abschriften, Kern, Steuerrechnung, Verdrahtung');
pruefen(Q);
const echt = rot;

console.log('G · Gegenprobe (je eine Stelle zurueckgebaut, erwartet ROT)');
const gegen = [
  ['Kern: Garagen aendern die Summe', Object.assign({}, Q, { kern: Q.kern.replace("av_garagen:        { art: 'davon_km'", "av_garagen:        { art: 'ein'") })],
  ['Kern: Ersatzjahr', Object.assign({}, Q, { kern: Q.kern.replace("return t && t.zeilen && t.felder ? t : null;", "return t && t.zeilen && t.felder ? t : window.AnlageV2025;") })],
  ['Abschrift: Garagen in falscher Zeile', Object.assign({}, Q, { jahr: { 'anlage-v-2025.js': lies('frontend/js/anlage-v-2025.js').replace("av_garagen:         { zeile: 26", "av_garagen:         { zeile: 99") } })],
  ['tax.js ohne anlage_v', Object.assign({}, Q, { tax: Q.tax.replace("einnahmen += _avW.ein;", "") })],
  ['Mappe mit fester Zeile 83', Object.assign({}, Q, { dok: Q.dok.replace("zl(R.summeWk.zeile, null, 'Summe der Werbungskosten'", "zl('83', null, 'Summe der Werbungskosten'") })],
];
still = true;
let gegenRot = 0;
for (const [name, q] of gegen) {
  const r = rot; let e = null;
  try { pruefen(q); } catch (x) { e = x; }
  const wurdeRot = rot > r || e;
  rot = r;
  if (!wurdeRot) { gegenRot++; console.log('  ROT  Gegenprobe blieb gruen: ' + name); } else gruen++;
}
still = false;
rot = echt + gegenRot;
console.log(rot ? 'RC=1 ' + rot + ' rot, ' + gruen + ' gruen' : 'RC=0 sauber, ' + gruen + ' gruen');
process.exit(rot ? 1 : 0);
