#!/usr/bin/env node
/* v3430 · Jahresabgleich (frontend/js/jahresabgleich.js), Haus je Jahr (frontend/js/hausverlauf.js wegJahre),
 * Grafik-Engine (frontend/js/jahresbuch-grafik.js) an den ECHTEN Dateien, ohne Browser. Erfundene Daten.
 *
 *  M  Mieterhöhungspotenzial je Jahr über den ECHTEN Kern (mietpotenzial-kern.js sollFuer/teil558) mit der
 *     ECHTEN Liste (mieterhoehungen.js mieteMonat/ableiten). Handbeispiel: 62 m², Mietspiegel 14,52 €/m²
 *     (= 900,24 €), Kappung 15 %, 800 → 850 € ab 07/2023, 850 → 900 € ab 04/2025.
 *  S  Stand je Schritt, Haus: Protokoll + (Abrechnung oder Wirtschaftsplan) = erledigt
 *  W  WEG-Jahreswerte aus einer erfundenen Auswertung (neu mit weg.jahre, alt ohne), Anteil über MEA,
 *     Sonderumlage des Objekts geht vor, Urteil-Satz
 *  V  Vertrag Backend: jedes Feld von weg.jahre im Prompt wird im Frontend gelesen und umgekehrt
 *  G  Grafik: eine Skala je Bild, Balken rund am Datenende, Legende, gewähltes Jahr, Gold nur als Token
 *  E  Einbau: Jahresstände aus Ankauf · Bestand · Zielbild herausgenommen, Jahresbuch-Tafel im Reiter leer,
 *     Dokumente tragen Art und Jahr, Buster v3430
 *
 * Aufruf: node tools/jahresabgleich-pruefen.mjs   (RC=0 sauber) */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let gruen = 0, rot = 0;
const ok = (b, t) => { if (b) gruen++; else { rot++; console.log('  ROT  ' + t); } };

function kontext(extra = {}) {
  const ctx = Object.assign({ console, Date, Math, JSON, parseInt, parseFloat, isFinite, String, Number, Object, Array, setTimeout: () => 0,
    document: { getElementById: () => null, addEventListener() {}, head: null, createElement: () => ({}), querySelectorAll: () => [] },
    addEventListener() {}, dispatchEvent() {} }, extra);
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}
const c = kontext();
for (const f of ['mietpotenzial-kern.js', 'mieterhoehungen.js', 'jahresbuch-grafik.js', 'hausverlauf.js', 'jahresabgleich.js']) vm.runInContext(lies('frontend/js/' + f), c);
const K = c.DpMietpotenzial, E = c.DpErhoehungen, JA = c.DpJahresabgleich, HV = c.DpHausverlauf, GR = c.DpJahresbuchGrafik;

/* ── M · Mieterhöhungspotenzial je Jahr ─────────────────────── */
{
  const liste = [{ datum: '2023-07-01', art: '558', von: 800, auf: 850 }, { datum: '2025-04-01', art: '558', von: 850, auf: 900 }];
  const q = [{ nr: '1', liste, heute: 900, wfl: 62, vgl_qm: 14.52, vgl_art: 'mietspiegel_qualifiziert' }];
  const ctx = { kapp: { pct: 15 } };
  const r25 = JA.mpRein(q, 2025, ctx, K, E);
  ok(r25.ist === 850, 'M 2025: Miete am 01.01. aus der Liste = 850 (' + r25.ist + ')');
  ok(Math.abs(r25.zul - 900.24) < 0.01, 'M 2025: zulässig = Mietspiegel 14,52 × 62 = 900,24 (Kappung 15 % auf 800 = 920 liegt höher) (' + r25.zul + ')');
  ok(r25.verlangbar_ab === '2025-01' && r25.wirksam_ab === '2025-04', 'M 2025: verlangbar ab 01/2025 (Sperrfrist ab 07/2023 abgelaufen), wirksam ab 04/2025 (' + r25.verlangbar_ab + ', ' + r25.wirksam_ab + ')');
  ok(r25.genutzt.length === 1 && r25.genutzt[0].auf === 900, 'M 2025: Erhöhung auf 900 € ab 04/2025 als genutzt erkannt');
  ok(r25.ungenutzt_jahr === 2, 'M 2025: ungenutzt nur die 0,24 € × 9 Monate = 2 € (' + r25.ungenutzt_jahr + ')');
  const r24 = JA.mpRein(q, 2024, ctx, K, E);
  ok(r24.ist === 850 && r24.verlangbar_ab === '2024-07' && r24.wirksam_ab === '2024-10', 'M 2024: Sperrfrist bis 07/2024, wirksam ab 10/2024 (' + r24.verlangbar_ab + ', ' + r24.wirksam_ab + ')');
  ok(r24.ungenutzt_jahr === 151, 'M 2024: Okt.–Dez. je 50,24 € nicht genutzt = 151 € (' + r24.ungenutzt_jahr + ')');
  const r26 = JA.mpRein(q, 2026, ctx, K, E);
  ok(r26.ist === 900 && r26.zul === 900 && r26.plus === 0 && !r26.wirksam_ab, 'M 2026: 900 € liegen an der Vergleichsmiete (unter 1 € keine Erhöhung), nichts verlangbar');
  ok(/Vergleichsmiete/.test(r26.wohnungen[0].grund || ''), 'M 2026: Grund aus dem Kern (' + r26.wohnungen[0].grund + ')');
  /* Kappung greift: Mietspiegel 16 €/m² = 992 € */
  const qK = [Object.assign({}, q[0], { vgl_qm: 16 })];
  ok(JA.mpRein(qK, 2024, ctx, K, E).zul === 920, 'M Kappung 15 % auf die Miete drei Jahre vorher (800 €, die Erhöhung im Fenster angerechnet) = 920 €');
  ok(JA.mpRein(qK, 2024, { kapp: { pct: 20 } }, K, E).zul === 960, 'M Kappung 20 % = 960 €');
  /* ohne Liste: Felder des Reiters Miete, wenn sie vor dem Stichtag liegen */
  const qF = [{ nr: '', liste: [], heute: 900, letzte: '2025-04-01', betrag: 50, wfl: 62, vgl_qm: 16 }];
  const rF = JA.mpRein(qF, 2025, ctx, K, E);
  ok(rF.ist === 850 && rF.sperre === true, 'M ohne Liste: Miete vor der letzten Erhöhung = 850, die Erhöhung davor ist unbekannt → Sperrfrist ungeprüft gesagt');
  /* MFH: Summe je Wohnung */
  const qM = [q[0], { nr: '2', liste: [], heute: 500, wfl: 50, vgl_qm: 12 }];
  const rM = JA.mpRein(qM, 2025, ctx, K, E);
  ok(rM.n === 2 && Math.abs(rM.ist - 1350) < 0.01 && Math.abs(rM.zul - (900.24 + 575)) < 0.01, 'M MFH: je Wohnung gerechnet und summiert (Whg. 2: 500 × 1,15 = 575 unter 600 Mietspiegel) (' + rM.zul + ')');
  ok(JA.mpRein([{ heute: 0, liste: [] }], 2025, ctx, K, E).n === 0, 'M leere Wohnung zählt nicht');
  ok(!/\bkappung\(|function sollFuer/.test(lies('frontend/js/jahresabgleich.js')), 'M keine zweite Rechnung: jahresabgleich.js ruft den Kern, rechnet § 558 nicht selbst');
}

/* ── S · Stand je Schritt ───────────────────────────────────── */
{
  ok(JA.hausStand({ protokoll: '12.06.2024', abrechnung: true }, false) === 'ok', 'S Protokoll + Abrechnung = erledigt');
  ok(JA.hausStand({ protokoll: '12.06.2024', wirtschaftsplan: true }, false) === 'ok', 'S Protokoll + Wirtschaftsplan = erledigt');
  ok(JA.hausStand({ protokoll: '12.06.2024' }, false) === 'teil', 'S nur Protokoll = teilweise');
  ok(JA.hausStand({ abrechnung: true }, false) === 'teil', 'S nur Abrechnung = teilweise');
  ok(JA.hausStand({}, false) === 'offen' && JA.hausStand({}, true) === 'laufend', 'S nichts: vergangen offen, laufend läuft');
}

/* ── W · WEG-Jahreswerte ────────────────────────────────────── */
{
  const ausw = { weg: {
    jahre: [
      { jahr: 2023, versammlung: '24.05.2023', protokoll: true, wirtschaftsplan: true, jahresabrechnung: false, hausgeld_plan_monat_eur: 226, hausgeld_ist_jahr_eur: null, ruecklage_stand_eur: 41000, sonderumlagen_gesamt_eur: 18000, sonderumlagen_anteil_eur: null, beschluesse: ['Dachsanierung beschlossen'], verwalter: 'Muster Hausverwaltung GmbH', quelle: 'Protokoll 24.05.2023' },
      { jahr: 2024, versammlung: '11.06.2024', protokoll: true, wirtschaftsplan: true, jahresabrechnung: true, hausgeld_plan_monat_eur: 233, hausgeld_ist_jahr_eur: 2790, abrechnungsergebnis_eur: -64, ruecklage_stand_eur: 46500, beschluesse: ['Hausgeld +3 % ab 2025'], verwalter: 'Muster Hausverwaltung GmbH', quelle: 'Protokoll 11.06.2024, Abrechnung 2024' },
      { jahr: 2025, protokoll: false, wirtschaftsplan: true, hausgeld_plan_monat_eur: 240 }
    ],
    chronik: [{ datum: '24.05.2023', jahr: 2023, art: 'sonderumlage', titel: 'Sonderumlage Dach', betrag_eur: 18000, status: 'beschlossen' }, { jahr: 2025, art: 'verwaltung', titel: 'Neue Verwaltung bestellt' }]
  } };
  const su = [{ jahr: 2023, betrag: 1200, faellig: '01.09.2023' }];
  const J = HV.wegJahre(ausw, su, [], { etw: true, mea_pct: '6,5' });
  const j = (y) => J.filter((z) => z.jahr === y)[0];
  ok(J.length === 3 && J[0].jahr === 2023, 'W drei Jahre, älteste zuerst');
  ok(j(2023).su_anteil === 1200, 'W Sonderumlage des Objekts aus #weg_su geht vor (1.200 € Anteil, nicht 18.000 × MEA)');
  ok(j(2023).su_gesamt === 18000, 'W Sonderumlage der Gemeinschaft bleibt sichtbar');
  ok(j(2024).ruecklage_anteil === Math.round(46500 * 0.065), 'W Rücklage-Anteil über den MEA 6,5 % (' + j(2024).ruecklage_anteil + ')');
  ok(j(2024).hausgeld_plan_monat === 233 && j(2024).hausgeld_ist_jahr === 2790 && j(2024).abrechnungsergebnis === -64, 'W Hausgeld Plan (Wirtschaftsplan) und Ist (Abrechnung) je Jahr');
  ok(j(2023).erledigt && j(2024).erledigt && !j(2025).erledigt, 'W erledigt = Protokoll + Wirtschaftsplan oder Abrechnung (2025 ohne Protokoll offen)');
  ok(j(2025).verwalter === 'Neue Verwaltung bestellt' && j(2023).verwalter === 'Muster Hausverwaltung GmbH', 'W Verwalter je Jahr (aus weg.jahre, sonst aus der Chronik)');
  ok(j(2023).beschluesse[0] === 'Dachsanierung beschlossen', 'W Beschlüsse je Jahr');
  const dop = HV.wegJahre({ weg: { jahre: [{ jahr: 2023, beschluesse: ['Dach, Sonderumlage 18.000 €'] }], chronik: [{ jahr: 2023, art: 'beschluss', titel: 'Dachsanierung beschlossen' }, { jahr: 2022, art: 'beschluss', titel: 'Treppenhaus' }] } }, [], []);
  ok(dop[1].beschluesse.length === 1 && dop[0].beschluesse[0] === 'Treppenhaus', 'W Beschluss nicht doppelt: weg.jahre geht vor, die Chronik füllt nur Jahre ohne');
  /* alte Auswertung ohne weg.jahre: Dokumente mit Art und Jahr (seit v3430 gespeichert) und Protokolldatum */
  const alt = HV.wegJahre({ weg: { chronik: [{ datum: '18.06.2022', art: 'beschluss', titel: 'Treppenhaus 2023' }] } }, [],
    [{ typ: 'weg_protokoll', label: 'WEG-Protokoll', datum: '18.06.2022' }, { typ: 'hausgeld', label: 'Wirtschaftsplan / Hausgeldabrechnung', art: 'Jahresabrechnung', jahr: 2022 },
     { typ: 'hausgeld', label: 'Wirtschaftsplan / Hausgeldabrechnung' }], { etw: false });
  ok(alt.length === 1 && alt[0].jahr === 2022 && alt[0].protokoll && alt[0].abrechnung && alt[0].erledigt && alt[0].versammlung === '18.06.2022', 'W alt: Protokoll aus dem Datum, Abrechnung aus Art und Jahr des Dokuments');
  ok(alt[0].beschluesse[0] === 'Treppenhaus 2023', 'W alt: Beschluss aus der Chronik');
  ok(!alt.some((z) => z.wirtschaftsplan), 'W Dokument „Wirtschaftsplan / Hausgeldabrechnung" ohne Art zählt nicht (nichts erfunden)');
  ok(HV.wegJahre(null, null, null).length === 0 && HV.wegJahre({ weg: { jahre: [null, { jahr: 'x' }] } }, [{}], [null]).length === 0, 'W leere/kaputte Eingaben werfen nicht');
  const u = HV.urteil(J, [], 2022);
  ok(u && u.wort === 'Haus mit Baustellen.' && /Eine Sonderumlage in 4 Jahren \(2023\)/.test(u.satz) && /Rücklage steigt/.test(u.satz) && /Hausgeld \+6,2 % seit 2023/.test(u.satz), 'W Urteil: ' + (u && u.wort + ' ' + u.satz));
  ok(HV.urteil([{ jahr: 2024, ruecklage_stand: 1 }, { jahr: 2025, ruecklage_stand: 2 }], [], 2024).wort === 'Ruhiges Haus.', 'W Urteil ruhig: keine Sonderumlage, Rücklage steigt');
  ok(HV.urteil([{ jahr: 2024, su_anteil: 500 }, { jahr: 2025, su_anteil: 700 }], [], 2024).wort === 'Unruhiges Haus.', 'W Urteil unruhig: zwei Sonderumlagen');
  /* F1 (v3977, Gesamt-Flow 22.11.2026): KI-Zeilen um ein Jahr verschoben - Zeile 2023 mit Versammlung 18.04.2024 und
     Quelle „Hausgeldabrechnung 2024.pdf". Die Dokumente tragen das richtige Jahr und entscheiden. */
  {
    const aus = { weg: { jahre: [
      { jahr: 2023, versammlung: '18.04.2024', protokoll: true, jahresabrechnung: true, hausgeld_plan_monat_eur: 310, hausgeld_ist_jahr_eur: 3855, abrechnungsergebnis_eur: 135, ruecklage_stand_eur: 64500, beschluesse: ['Hausgeld 2024 auf 310 €'], quelle: 'WEG-Protokoll 2024.pdf, Hausgeldabrechnung 2024.pdf' },
      { jahr: 2024, versammlung: '10.04.2025', protokoll: true, wirtschaftsplan: true, jahresabrechnung: true, hausgeld_plan_monat_eur: 330, hausgeld_ist_jahr_eur: 3977, abrechnungsergebnis_eur: 17, ruecklage_stand_eur: 52000, beschluesse: ['Hausgeld ab 2025 330 €'], quelle: 'WEG-Protokoll 2025.pdf, Wirtschaftsplan 2025.pdf, Hausgeldabrechnung 2025.pdf' },
      { jahr: 2025, versammlung: '15.04.2026', protokoll: true, hausgeld_plan_monat_eur: 345, ruecklage_stand_eur: 48500, sonderumlagen_anteil_eur: 8160, beschluesse: ['Wirtschaftsplan 2026 beschlossen'], quelle: 'WEG-Protokoll 2026.pdf' },
      { jahr: 2026, versammlung: '15.04.2026', protokoll: true, wirtschaftsplan: true, hausgeld_plan_monat_eur: 345, quelle: 'WEG-Protokoll 2026.pdf' }] } };
    const dk = [
      { typ: 'hausgeld', datei: 'Hausgeldabrechnung 2024.pdf', art: 'Jahresabrechnung', jahr: 2024 }, { typ: 'hausgeld', datei: 'Hausgeldabrechnung 2025.pdf', art: 'Jahresabrechnung', jahr: 2025 },
      { typ: 'hausgeld', datei: 'Wirtschaftsplan 2025.pdf', art: 'Wirtschaftsplan', jahr: 2025 }, { typ: 'hausgeld', datei: 'Wirtschaftsplan 2026.pdf', art: 'Wirtschaftsplan', jahr: 2026 },
      { typ: 'weg_protokoll', datei: 'WEG-Protokoll 2024.pdf', datum: '18.04.2024' }, { typ: 'weg_protokoll', datei: 'WEG-Protokoll 2025.pdf', datum: '10.04.2025' }];
    const F = HV.wegJahre(aus, [], dk, { etw: true, mea_pct: '8,5' }), f = (y) => F.filter((z) => z.jahr === y)[0] || {};
    ok(f(2024).hausgeld_plan_monat === 310 && f(2024).hausgeld_ist_jahr === 3855 && f(2024).abrechnungsergebnis === 135, 'W F1 2024 = Abrechnung 2024 (3.855 €, +135) und Plan 310 € (' + [f(2024).hausgeld_plan_monat, f(2024).hausgeld_ist_jahr, f(2024).abrechnungsergebnis].join('/') + ')');
    ok(f(2025).hausgeld_plan_monat === 330 && f(2025).hausgeld_ist_jahr === 3977 && f(2025).abrechnungsergebnis === 17, 'W F1 2025 = Abrechnung 2025 (3.977 €, +17) und Plan 330 € (' + [f(2025).hausgeld_plan_monat, f(2025).hausgeld_ist_jahr].join('/') + ')');
    ok(f(2023).hausgeld_plan_monat == null && f(2023).hausgeld_ist_jahr == null && f(2023).ruecklage_stand === 64500, 'W F1 2023 ohne verschobene Hausgeldwerte, Rücklage 31.12.2023 bleibt');
    ok(f(2024).versammlung === '18.04.2024' && f(2026).hausgeld_plan_monat === 345 && f(2025).su_anteil === 8160, 'W F1 Versammlung im Jahr ihres Datums, Plan 2026 = 345 €, Sonderumlage bleibt 2025');
    const dw = dk.map((d) => d.datei === 'Hausgeldabrechnung 2024.pdf' ? Object.assign({}, d, { werte: { kosten_jahr: 3850, ergebnis: 130 } }) : d);
    const W2 = HV.wegJahre(aus, [], dw, { etw: true }).filter((z) => z.jahr === 2024)[0];
    ok(W2 && W2.hausgeld_ist_jahr === 3850 && W2.abrechnungsergebnis === 130, 'W F1 Werte am Dokument gehen der KI-Zeile vor');
    const oa = lies('frontend/js/object-actions.js');
    ok(/function _hgWerte\(ex\)/.test(oa) && /o\.werte = _w/.test(oa), 'W F1 object-actions.js speichert die Hausgeldwerte am Dokument');
    ok(/AUCH wenn sie in der Versammlung eines anderen Jahres/.test(lies('backend/src/services/openaiService.js')), 'W F1 Prompt: Jahr = Wirtschafts-/Abrechnungsjahr, nicht das Versammlungsjahr');
  }
  const sp = HV.grafikSpec(J);
  ok(sp && sp.panels.length === 2 && sp.panels[0].marken.length === 1 && sp.panels[0].serien[0].werte[2024] === 233 * 12, 'W Grafik: Hausgeld (Plan × 12) und Rücklage, Sonderumlage als Marke');
}

/* ── V · Vertrag Backend ↔ Frontend ─────────────────────────── */
{
  const svc = lies('backend/src/services/openaiService.js');
  const i = svc.indexOf('"jahre": [{'), teil = i > 0 ? svc.slice(i, svc.indexOf('\n', i)) : '';
  const felder = (teil.match(/\\?"([a-z_]+)\\?":/g) || []).map((x) => x.replace(/[\\":]/g, '')).filter((f) => f !== 'jahre');
  ok(i > 0 && felder.length >= 14, 'V weg.jahre steht im Prompt von dokumenteAuswerten (' + felder.length + ' Felder)');
  const hv = lies('frontend/js/hausverlauf.js');
  const gelesen = (f) => new RegExp("['.\"]" + f + "['\" ]|x\\." + f + '\\b|\\+ \'_eur\'').test(hv) || hv.indexOf("'" + f.replace(/_eur$/, '') + "'") >= 0;
  const fehlt = felder.filter((f) => !gelesen(f));
  ok(!fehlt.length, 'V jedes Feld im Schema wird gelesen (kein Feld ohne Ausgabe): ' + (fehlt.join(', ') || 'alle'));
  ok(/maxTokens: 8000/.test(svc.slice(svc.indexOf('async function dokumenteAuswerten'), svc.indexOf('async function dokumenteAuswerten') + 9000)), 'V Antwortlänge 8000 (die Jahre kommen dazu, keine abgeschnittene JSON-Antwort)');
}

/* ── G · Grafik ─────────────────────────────────────────────── */
{
  const spec = { jahre: [2021, 2022, 2023, 2024], heute: 2026, gewaehlt: 2023, panels: [
    { titel: 'A', art: 'linie', serien: [{ name: 'Plan', typ: 'linie', strich: 'plan', werte: { 2021: 100, 2022: 110, 2023: 120, 2024: 130 } }, { name: 'Ist', typ: 'linie', strich: 'ist', werte: { 2021: 100, 2022: 105 } }] },
    { titel: 'B', art: 'balken', serien: [{ name: 'P', typ: 'balken', werte: { 2021: 10, 2022: -5 } }, { name: 'I', typ: 'balken', werte: { 2021: 8 } }] }] };
  const s = GR.bild(spec);
  ok((s.match(/class="jbg-t"/g) || []).length === 2, 'G zwei Bilder, je eine Skala (keine Doppelachse)');
  ok((s.match(/<path d="M[^"]*Q[^"]*" style="fill:/g) || []).length === 3, 'G drei Balken mit rundem Datenende (Pfad mit Q), auch der negative');
  ok(/class="jbg-band"/.test(s) && /jbg-gew/.test(s), 'G gewähltes Jahr als Band und in der Achse');
  ok(!/stroke-dasharray="[^"]*"[^>]*class="jbg-ax"/.test(s) && /stroke-opacity:\.10;stroke-width:1/.test(s), 'G Gitter: Haarlinie, durchgezogen');
  ok((s.match(/data-jbg-jahr=/g) || []).length === 4, 'G Trefferflächen je Jahr (Kästchen, Klick wählt das Jahr)');
  ok(/Plan/.test(GR.legendeHtml(spec)) && /Ist/.test(GR.legendeHtml(spec)), 'G Legende ab zwei Reihen');
  const roh = lies('frontend/js/jahresbuch-grafik.js') + lies('frontend/js/jahresabgleich.js') + lies('frontend/js/hausverlauf.js');
  ok(!/#C9A84C|#E8CC7A|#b8932f/i.test(roh.replace(/var\(--wl-c9a84c, ?#C9A84C\)/gi, '').replace(/var\(--wl-b8932f, ?#b8932f\)/gi, '')), 'G Gold nur über var(--wl-c9a84c) (gold-audit)');
  ok(!/fill="var\(|stroke="var\(/.test(roh), 'G var() nie in SVG-Präsentationsattributen');
}

/* ── E · Einbau ─────────────────────────────────────────────── */
{
  const js = lies('frontend/js/jahresstaende.js');
  ok(/var JAHRESSTAENDE_IM_JAHRESABGLEICH = true/.test(js) && /JAHRESSTAENDE_IM_JAHRESABGLEICH \? '' : '<h4 class="dp-wv-h"/.test(js), 'E Jahresstände-Tafel nicht mehr unter Ankauf · Bestand · Zielbild (Zielerreichung bleibt)');
  ok(/standJahr: standJahr/.test(js) && /J\.standJahr\(z\.jahr\)/.test(lies('frontend/js/jahresabgleich.js')), 'E DSCR und Score aus dem Jahresstand in der Tabelle');
  const jb = lies('frontend/js/jahresbuch.js');
  ok(/querySelector\('\[data-dp-ja-host\]'\)/.test(jb) && /closest\('#dp-jb-ov'\)/.test(jb), 'E Jahresbuch-Tafel im Reiter leer, im Fenster „Jahre" (Eingabe) bleibt sie');
  /* v4090 · „eintragen" öffnet die Eingabe IM Reiter (vorher Fenster „Jahre"). Kommentare zählen nicht (Prüfer findet sein Zitat). */
  ok(/data-ja-aktion="' \+ aktion/.test(lies('frontend/js/jahresabgleich.js')) && /a === 'eintragen'\) \{ eingabeAuf\(y\)/.test(lies('frontend/js/jahresabgleich.js')) && !/JB\(\)\.oeffnen\(/.test(lies('frontend/js/jahresabgleich.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')) && /eingabeHtml: eingabeHtml/.test(jb), 'E „eintragen" öffnet die Bearbeitung des Jahres');
  ok(!/Kauf gegen heute/.test(lies('frontend/js/jahresabgleich.js').replace(/\/\*[\s\S]*?\*\//g, '')), 'E Tafel „Kauf gegen heute" je Jahr entfällt');
  ok(/o\.art = ex\.art/.test(lies('frontend/js/object-actions.js')) && /o\.jahr = ex\.jahr/.test(lies('frontend/js/object-actions.js')), 'E gespeicherte Dokumente tragen Art und Jahr');
  const idx = lies('frontend/index.html');
  for (const f of ['jahresabgleich.js', 'hausverlauf.js', 'jahresbuch.js', 'jahresbuch-grafik.js', 'jahresstaende.js', 'object-actions.js'])
    { const m = idx.match(new RegExp('js/' + f.replace('.', '[.]') + '[?]v=v([0-9]+)')); ok(m && +m[1] >= 3430, 'E Buster ab v3430 für ' + f + ' (' + (m ? m[1] : 'fehlt') + ')'); }
}

/* ── F · Festschreiben, Kopf je Jahr, ViVi je Jahr (v4016/v4017) ───────────────── */
{
  const c4 = kontext();
  for (const f of ['mieterhoehungen.js', 'jahresbuch.js', 'jahresabgleich.js']) vm.runInContext(lies('frontend/js/' + f), c4);
  const B = c4.DpJahresbuch, J4 = c4.DpJahresabgleich, E4 = c4.DpErhoehungen;
  ok(JSON.stringify(B.festAus({ fest: { miete: '2026-11-23', foo: 'x', steuer: '' } })) === '{"miete":"2026-11-23"}', 'F festAus: nur bekannte Schritte mit Datum');
  const alle = B.festNeu({}, null, true, '2026-11-23');
  ok(Object.keys(alle).join(',') === 'miete,steuer,wert,haus', 'F Jahr festschreiben = alle vier Schritte');
  ok(B.festNeu(alle, ['steuer'], false, 'x').steuer === undefined && B.festNeu(alle, ['steuer'], false, 'x').miete === '2026-11-23', 'F einen Schritt wieder freigeben, die anderen bleiben');
  ok(B.festNeu({ miete: '2025-01-01' }, ['miete'], true, '2026-11-23').miete === '2025-01-01', 'F erneut festschreiben behält das erste Datum');
  ok(Object.keys(B.festNeu(alle, null, false, 'x')).length === 0, 'F Jahr freigeben = leer');
  /* stand(): festgeschrieben zählt als erledigt, Text mit Namen der Schritte */
  c4.DpJahresbuch.fest = (j) => (j === 2024 ? { steuer: '2026-11-23', wert: '2026-11-23' } : {});
  /* v4037 · Miete eines vergangenen Jahres ist erst mit Ist-Miete erledigt (eingetragen oder aus ViVi) */
  ok(J4.stand({ jahr: 2024, status: 'geplant', mb: null }, false).miete === 'offen' && J4.stand({ jahr: 2024, status: 'geplant', mb: null, miete_vivi: true }, false).miete === 'ok', 'F v4037 Miete 2024 ohne Ist offen, mit Ist aus ViVi erledigt');
  const s24 = J4.stand({ jahr: 2024, status: 'geplant', mb: null, miete_eigen: true }, false);
  ok(s24.steuer === 'ok' && s24.wert === 'ok' && s24.nFest === 2 && s24.n === 3, 'F fest: Steuer und Wert erledigt, mit Miete 3 von 4 (' + s24.n + ')');
  ok(s24.offen.join(',') === 'Haus' && s24.erledigt.join(',') === 'Miete,Wert,Steuer', 'F erledigt/offen mit Namen (v4090 Reihenfolge Miete, Wert, Haus, Steuer)');
  const lauf = J4.stand({ jahr: new Date().getFullYear(), status: 'geplant' }, false);
  ok(lauf.nFest === 0 && lauf.miete === 'laufend', 'F laufendes Jahr lässt sich nicht festschreiben');
  const js = lies('frontend/js/jahresabgleich.js');
  ok(!/dp-ja-erinnerung">Jahresabgleich ' \+ er\.jahr/.test(js), 'F keine Erinnerung an ein anderes Jahr über dem gewählten (Fehler „bleibt 2025 · 2 von 4")');
  ok(/function reiterMarke\(\)[\s\S]{0,900}gewaehltesJahr\(Z\)/.test(js), 'F Reitermarke folgt dem gewählten Jahr');
  ok(/von 4 Schritten erledigt/.test(js), 'F „2 von 4 Schritten erledigt (…)" statt „2 von 4"');
  const jb = lies('frontend/js/jahresbuch.js');
  ok(/function aenderungErlaubt\(jahr, schritt\) \{\s*if \(festGesperrt\(jahr, schritt \|\| 'steuer'\)\) return false;/.test(jb), 'F Steuer festgeschrieben sperrt die Anlage V ohne Dialog');
  ok(/aenderungErlaubt\(y, 'miete'\)/.test(jb) && /aenderungErlaubt\(y, 'miete'\)/.test(lies('frontend/js/mfh-einheiten.js')), 'F Miete festgeschrieben sperrt Ist-Miete und Wohnungsmieten des Jahres');
  /* ViVi: Kaltmiete im Jahr aus dem Mietverlauf, ab dem Übergang */
  const q = [{ liste: [{ id: 'vivi-1', datum: '2026-11-01', art: '558', von: 495, auf: 520 }], heute: 520 }];
  ok(J4.viviMieteRein(q, 2024, 7, E4) === 2970 && J4.viviMieteRein(q, 2025, 1, E4) === 5940 && J4.viviMieteRein(q, 2026, 1, E4) === 5990, 'F ViVi-Kaltmiete 2024 ab 07 = 2.970, 2025 = 5.940, 2026 = 5.990 (Testobjekt 1179)');
  ok(J4.viviMieteRein([], 2025, 1, E4) === null, 'F ohne ViVi-Quelle kein Wert');
}


/* ── A · v4090 Ablauf, Reihenfolge, Sprung, Grafik, Kennzahlen sichern ───────────────── */
{
  const c5 = kontext();
  for (const f of ['mieterhoehungen.js', 'jahresbuch.js', 'jahresbuch-grafik.js', 'jahresabgleich.js']) vm.runInContext(lies('frontend/js/' + f), c5);
  const J5 = c5.DpJahresabgleich, G5 = c5.DpJahresbuchGrafik;
  ok(J5.SCHRITTE.map((x) => x[1]).join(',') === 'Miete,Wert,Haus,Steuer', 'A Reihenfolge Miete, Wert, Haus, Steuer');
  const s1 = { miete: 'ok', wert: 'offen', haus: 'teil', steuer: 'offen', fest: {}, nFest: 0 };
  ok(J5.aktiverSchritt({ jahr: 2025 }, s1, false) === 'wert', 'A Ablauf startet beim ersten offenen Schritt (Wert)');
  ok(J5.aktiverSchritt({ jahr: 2026 }, s1, true) === 'miete', 'A laufendes Jahr: Leiste beim Schritt Miete (v4150, Knöpfe nur noch dort)');
  ok(J5.aktiverSchritt({ jahr: 2025 }, { miete: 'ok', wert: 'ok', haus: 'ok', steuer: 'ok', fest: {}, nFest: 0 }, false) === null, 'A alles erledigt: kein aktiver Schritt');
  const fh = J5.fuehrungHtml({ jahr: 2025, status: 'geplant' }, s1, false, 'wert', true);
  ok(/Schritt 2 von 4 · Wert · offen/.test(fh) && !/f-zurueck|f-weiter/.test(fh) && /data-ja-aktion="festschreiben" data-ja-schritt-k="wert"/.test(fh) && /data-ja-aktion="wert"/.test(fh), 'A Leiste (v4150): Schritt 2 von 4, Knöpfe des Schritts und Schritt festschreiben, kein Zurück/Weiter');
  { const sk = J5.schritt('miete', 'Miete', { miete: 'offen', fest: {} }, '1 €', 'Plan 1 €', 'Satz.', '<button type="button" data-ja-aktion="miete">X</button>', 2025);
    ok(!/<button/.test(sk) && /data-ja-k="miete"/.test(sk), 'L Karte ohne Knöpfe und ohne festschreiben, anklickbar über data-ja-k (v4150)');
    const fl = J5.fuehrungHtml({ jahr: 2026, status: 'geplant' }, s1, true, 'miete', true);
    ok(/data-ja-aktion="miete"/.test(fl) && !/festschreiben/.test(fl) && /läuft noch/.test(fl), 'L laufendes Jahr: Leiste mit den Knöpfen der Karte, ohne Festschreiben'); }
  { const sf = { miete: 'ok', wert: 'ok', haus: 'teil', steuer: 'offen', fest: { wert: '2026-11-23' }, nFest: 1 };
    const ff = J5.fuehrungHtml({ jahr: 2025, status: 'geplant' }, sf, false, 'wert', true);
    ok(/data-ja-aktion="freigeben" data-ja-schritt-k="wert"/.test(ff) && !/data-ja-aktion="festschreiben"/.test(ff), 'L festgeschriebener Schritt: nur wieder freigeben'); }
  ok(!/f-weiter/.test(J5.fuehrungHtml({ jahr: 2025, status: 'geplant' }, s1, false, 'steuer', true)), 'A letzter Schritt ohne weiter');
  let texte = '';
  for (const k of ['miete', 'wert', 'haus', 'steuer']) for (const st of ['ok', 'offen']) for (const weg of [true, false]) texte += J5.aufgabe(k, { jahr: 2025, status: 'geplant' }, Object.assign({}, s1, { [k]: st }), weg).t + '\n';
  ok(!/[–—;]/.test(texte), 'A Kundentext des Ablaufs ohne Gedankenstrich und Semikolon');
  const js = lies('frontend/js/jahresabgleich.js');
  ok(/function warteSichtbar\(/.test(js) && /a === 'miete'\) \{ zuMiete\('erh'\)/.test(js) && /det\.open = true/.test(js) && /einheitOeffnen\(wohnungMitLuft\(\)\)/.test(js), 'A Mieterhöhung eintragen: wartet auf das Ziel, klappt die Eingabe auf, MFH öffnet die Wohnung');
  ok(/Kennzahlen ' \+ heuteJahr\(\) \+ ' jetzt sichern/.test(js) && /data-tip-id="pa\.ja_kennzahlen_sichern"/.test(js) && /'pa\.ja_kennzahlen_sichern'/.test(lies('frontend/js/tooltip-content.js')) && !/festhalten<\/button>/.test(js), 'A „Stand festhalten" heißt „Kennzahlen JJJJ jetzt sichern", Hilfe nur über den Tooltip-Schalter');
  /* Grafik: Karten je Kennzahl, Kopf mit Ist, Plan und Abstand in Worten */
  const sp = G5.ausAlt({ jahre: [{ jahr: 2024, miete_plan: 6000, miete_ist: 6200, cf_plan: -1000, cf_ist: null }, { jahr: 2025, miete_plan: 6240, miete_ist: 6770, cf_plan: -2000, cf_ist: -1500 }], heute: 2026, gewaehlt: 2025, karten: true });
  ok(sp.karten === true && sp.panels.every((p) => p.serien.some((s) => s.rolle === 'ist') && p.serien.some((s) => s.rolle === 'plan')), 'A Grafik: Karten, jede mit Ist und Plan');
  const gr = lies('frontend/js/jahresbuch-grafik.js');
  ok(/WMAX = 1400/.test(gr) && /Math\.min\(WMAX, Math\.round\(bw\)\)/.test(gr) && !/Math\.min\(W0, Math\.round\(bw\)\)/.test(gr), 'A Grafik in echter Größe, nicht über 720 hochskaliert');
  ok(/' über' : ' unter'\) \+ ' Plan/.test(gr) && /'▲ ' : '▼ '/.test(gr), 'A Abstand zum Plan mit Zeichen und Wort, nie nur Farbe');
}


/* ── X · v4090 Festgeschriebene Jahre sind gesperrt (Marcel 23.11.2026) ───────────────── */
{
  const c6 = kontext({ toast() {} });
  for (const f of ['mieterhoehungen.js', 'jahresbuch.js']) vm.runInContext(lies('frontend/js/' + f), c6);
  const B = c6.DpJahresbuch;
  ok(B.feldGesperrtRein({ miete: 'x' }, 'nkm_j') && B.feldGesperrtRein({ miete: 'x' }, 'einheiten') && B.feldGesperrtRein({ miete: 'x' }, 'leer_monate') && !B.feldGesperrtRein({ miete: 'x' }, 'steuer_status'), 'X Miete fest sperrt Ist-Miete, Wohnungen, Leerstand, nicht den Steuerstand');
  ok(B.feldGesperrtRein({ steuer: 'x' }, 'steuer_status') && !B.feldGesperrtRein({ steuer: 'x' }, 'rs_ist'), 'X Steuer fest sperrt den Steuerstand');
  const alle4 = { miete: 'x', wert: 'x', haus: 'x', steuer: 'x' };
  ok(B.feldGesperrtRein(alle4, 'rs_ist') && B.feldGesperrtRein(alle4, 'notiz') && !B.feldGesperrtRein({ miete: 'x' }, 'notiz'), 'X Restschuld und Notiz sperren mit dem ganzen Jahr');
  const alt = [{ id: 'a', datum: '2024-05-01', art: '558', von: 500, auf: 540 }, { id: 'b', datum: '2025-03-01', art: '558', von: 540, auf: 560 }];
  const fm = (y) => y === 2024;
  const r1 = B.erhoehungenSchuetzenRein(alt, alt.concat([{ id: 'c', datum: '2024-09-01', art: '558', von: 540, auf: 555 }]), fm);
  ok(r1.abgewiesen && r1.liste.length === 2, 'X neue Erhöhung in festgeschriebenem Mietjahr fällt weg');
  const r2 = B.erhoehungenSchuetzenRein(alt, [alt[1]], fm);
  ok(r2.abgewiesen && r2.liste.some((x) => x.id === 'a'), 'X gelöschte Erhöhung im festgeschriebenen Jahr kommt zurück');
  const r3 = B.erhoehungenSchuetzenRein(alt, [alt[0], { id: 'd', datum: '2025-08-01', art: '558', von: 560, auf: 580 }], fm);
  ok(!r3.abgewiesen && r3.liste.length === 2 && r3.liste[1].id === 'd', 'X offenes Jahr bleibt frei änderbar');
  /* echte Schreibstelle: _jahre wird nicht geschrieben, wenn Miete fest */
  const jb = lies('frontend/js/jahresbuch.js');
  ok(/if \(feldGesperrt\(jahr, feld\)\) \{ sperrHinweis/.test(jb), 'X schreiben() prüft jede Schreibstelle eines Jahres');
  ok(/function steuerSperreEinhaengen\(\)/.test(jb) && /istFest\(y, 'steuer'\)\) \{ sperrHinweis\(y, 'steuer'\); return false; \}/.test(jb), 'X dpSteuerSetzen (Belege, Unterlagen, Sonderumlage, ViVi) schreibt nicht in eine festgeschriebene Steuer');
  /* Wrapper real: tax-Funktion wird nicht gerufen */
  let gerufen = 0; c6.dpSteuerSetzen = () => { gerufen++; return true; };
  c6.DpJahresbuch.fest = () => ({});
  B.steuerSperreEinhaengen();
  c6._currentObjData = { _jahre: { '2024': { fest: { steuer: '2026-11-23' } } } };
  const rS = c6.dpSteuerSetzen(2024, 'erhaltungsaufwand', 100), rS2 = c6.dpSteuerSetzen(2025, 'erhaltungsaufwand', 100);
  ok(rS === false && rS2 === true && gerufen === 1, 'X Steuer 2024 fest: dpSteuerSetzen lehnt ab, 2025 schreibt (' + gerufen + ')');
  ok(/erhoehungenSchuetzen\(h\.liste\(\), l\)/.test(lies('frontend/js/mieterhoehungen.js')), 'X Liste der Mieterhöhungen (Reiter Miete, Wohnung) geschützt');
  ok(/erhoehungenSchuetzenRein\(alt, m,/.test(lies('frontend/js/vivi-felder.js')), 'X ViVi-Abgleich übernimmt nichts in ein festgeschriebenes Mietjahr');
  ok(/JBf\.istFest\(yE, 'miete'\)/.test(lies('frontend/js/object-actions.js')), 'X Belege/Unterlagen: Mieterhöhung in festgeschriebenem Jahr nicht übernommen');
  const ja = lies('frontend/js/jahresabgleich.js');
  ok(/a === 'freigeben'\) \{ _frage = /.test(ja) && /a === 'freigeben-ja'\)/.test(ja) && /fest_protokoll/.test(jb) && /aktion: an \? 'festgeschrieben' : 'freigegeben'/.test(jb), 'X Freigeben nur nach Rückfrage, Vorgang im Protokoll');
}

/* ── H · v4100 ViVi im Schritt Haus, Assistent Jahresabschluss, ein Knopf Belege & Unterlagen ───────────────── */
{
  const c7 = kontext();
  for (const f of ['mieterhoehungen.js', 'jahresbuch.js', 'hausverlauf.js', 'jahresabgleich.js', 'jahresabschluss.js']) vm.runInContext(lies('frontend/js/' + f), c7);
  const J7 = c7.DpJahresabgleich, AS = c7.DpJahresabschluss;
  const sj = { nk_umlf: { posten: [{ text: 'Hausgeld (Vorauszahlung) Jan', betrag: 200 }, { text: 'Grundsteuer B', betrag: 300 }, { text: 'Hausgeld Feb', betrag: 200 }] },
    nk_n_umlf: { posten: [{ text: 'Hausgeld (nicht umlagefähig)', betrag: 50.5 }] }, erhaltungsaufwand: { posten: [{ text: 'Hausgeld Sonder', betrag: 999 }] } };
  ok(J7.hgViviRein(sj) === 450.5, 'H Hausgeld laut ViVi = Hausgeld-Posten der umgelegten und nicht umgelegten Kosten, ohne Grundsteuer (' + J7.hgViviRein(sj) + ')');
  ok(J7.hgViviRein({}) === null && J7.hgViviRein(null) === null, 'H ohne ViVi-Posten kein Wert');
  const hV = J7.hausMitViviRein({ hg_ist_j: null }, 450, false);
  ok(hV.hg_ist_j === 450 && hV.hg_quelle === 'vivi', 'H ViVi-Hausgeld zählt, wo kein eigener Wert steht');
  const hE = J7.hausMitViviRein({ hg_ist_j: 4800 }, 450, false);
  ok(hE.hg_ist_j === 4800 && hE.hg_quelle === 'eigen', 'H Abrechnung/eigene Angabe schlägt ViVi');
  const hF = J7.hausMitViviRein({ hg_ist_j: null }, 450, true);
  ok(hF.hg_ist_j === null && !hF.hg_quelle, 'H festgeschriebener Haus-Schritt bleibt unberührt');
  ok(J7.hausStand({ hg_ist_j: 450, hg_quelle: 'vivi' }, false) === 'teil' && J7.hausStand({ protokoll: 'x', abrechnung: true, hg_ist_j: 1, hg_quelle: 'vivi' }, false) === 'ok', 'H ViVi-Hausgeld allein = teilweise, mit Protokoll und Abrechnung erledigt');
  const z = { jahr: 2025, status: 'geplant' };
  const alleOk = { miete: 'ok', wert: 'ok', haus: 'ok', steuer: 'ok', nFest: 0, fest: {}, _haus: {} };
  ok(J7.fertigErgebnis(z, alleOk, true).art === 'frage', 'H alles erledigt: Rückfrage, nie direkt festschreiben');
  const teil = Object.assign({}, alleOk, { haus: 'teil', steuer: 'offen', _haus: { protokoll: 'x' } });
  const e2 = J7.fertigErgebnis(z, teil, true);
  ok(e2.art === 'offen' && e2.schritt === 'haus' && /Abrechnung hochladen/.test(e2.text) && /Anlage V 2025/.test(e2.text) && !/[–—;]/.test(e2.text), 'H offen: erster offener Schritt Haus, Satz „Noch offen: …“ (' + e2.text + ')');
  ok(J7.fertigErgebnis({ jahr: new Date().getFullYear() }, alleOk, true).art === 'laeuft', 'H laufendes Jahr wird nicht abgeschlossen');
  ok(AS.SCHRITTE.map((x) => x[1]).join(',') === 'Miete,Wert,Haus & Belege,Steuer,Festschreiben', 'H Assistent: fünf Schritte');
  ok(AS.startSchritt(teil, null, null) === 'haus' && AS.startSchritt(alleOk, null, null) === 'fest' && AS.startSchritt(teil, 'miete', 'steuer') === 'miete' && AS.startSchritt(teil, null, 'steuer') === 'steuer', 'H Startschritt: Wunsch, sonst gemerkter Schritt, sonst erster offener');
  const as = lies('frontend/js/jahresabschluss.js'), ja = lies('frontend/js/jahresabgleich.js');
  ok(as.split('festSetzen(J, null, true)').length === 2 && as.includes("if (a === 'fest-ja') { _z.frage = false; if (JB()) JB().festSetzen(J, null, true)"), 'H Jahr festschreiben nur über „Ja, festschreiben“ nach der Rückfrage');
  ok(ja.includes("if (!k && global.DpJahresabschluss) { global.DpJahresabschluss.oeffnen(_gewaehlt, 'fest'); return; }"), 'H „Jahr festschreiben“ im Reiter führt in den Assistenten (Rückfrage)');
  ok(ja.includes("fertig: null, eintragen: 'miete', wert: 'wert', haus: 'haus', 'vivi-abgleich': 'haus', steuer: 'steuer'"), 'H Schritt-Knöpfe eines vergangenen Jahres öffnen den Assistenten beim Schritt');
  ok(as.includes('DpEingang.jahresInRahmen(bx, _z.jahr, { festesJahr: true })') && as.includes('eingabeHtml(_z.jahr)'), 'H Assistent nutzt Belege je Jahr und die Jahreseingabe, kein Nachbau');
  const ohneKommentar = as.split(String.fromCharCode(10)).filter((l) => !/^\s*(\/\*|\*|\/\/)/.test(l)).join(' ');
  ok(!/—| – /.test(ohneKommentar), 'H Assistent: Kundentext ohne Gedankenstrich (– allein steht nur für einen leeren Wert)');
  const ue = lies('frontend/js/unterlagen-eingang.js');
  ok(ue.includes('function _viviTeil(jahr, opt)') && ue.includes('data-bj-vivi') && ue.includes('In DealPilot gebucht'), 'H Belege je Jahr: bei ViVi Gegenüberstellung „Laut ViVi“ und „In DealPilot gebucht“');
  ok(!lies('frontend/js/tax.js').includes('>Belege je Jahr</button>') && lies('frontend/index.html').includes('Belege &amp; Unterlagen') && lies('frontend/index.html').includes('DpEingang.start()'), 'H Reiter Steuer: ein Knopf „Belege & Unterlagen“, der zweite ist entfernt');
  ok(/function start\(\) \{[\s\S]{0,260}reiter: 'jahre'/.test(ue), 'H Start-Reiter: mit Belegen „Belege je Jahr“, sonst „Einlesen“');
}

/* ── E · v4110 Assistent im DealPilot-Design, Anlage V nach Stufe, Hinweiszeile folgt dem gewählten Jahr ─────── */
{
  const H = new Date().getFullYear();
  const mk = (aus) => {
    const c8 = kontext({ document: { getElementById: (id) => (id === 'yearly-tax-form-box' ? { id } : null), addEventListener() {}, head: null, createElement: () => ({}), querySelectorAll: () => [] } });
    for (const f of ['mieterhoehungen.js', 'jahresbuch.js', 'hausverlauf.js', 'jahresabgleich.js', 'jahresabschluss.js']) vm.runInContext(lies('frontend/js/' + f), c8);
    if (aus != null) c8.DpDetailgrad = { ausgeblendet: () => aus, stufe: () => (aus ? 1 : 2) };
    return c8;
  };
  ok(mk(true).DpJahresabgleich.anlageVErlaubt() === false && mk(false).DpJahresabgleich.anlageVErlaubt() === true, 'E Anlage V nur, wenn der Detailgrad #yearly-tax-form-box nicht ausblendet (Einsteiger nein, ab Fortgeschritten ja)');
  ok(mk(true).DpJahresabschluss.anlageVErlaubt() === false, 'E Assistent fragt dieselbe Stufe ab');
  const c9 = mk(false), J9 = c9.DpJahresabgleich;
  const Z = [{ jahr: H - 2, status: 'geplant' }, { jahr: H - 1, status: 'geplant' }, { jahr: H, status: 'geplant' }];
  const L = { liste: [] };
  const w1 = J9.wechselJahr(Z, false, L, H - 2), w2 = J9.wechselJahr(Z, false, L, H), w3 = J9.wechselJahr(Z, false, L, H - 1);
  ok(w1 && w1.jahr === H - 2 && w2 && w2.jahr === H - 1 && w3 && w3.jahr === H - 1, 'E Hinweiszeile folgt dem gewählten Jahr (vergangenes Jahr gewählt: dieses, laufendes Jahr gewählt: Vorjahr)');
  c9.DpJahresbuch.fest = (j) => (j === H - 2 ? { miete: 1, wert: 1, haus: 1, steuer: 1 } : {});
  ok(J9.wechselJahr(Z, false, L, H - 2) === null, 'E festgeschriebenes Jahr: keine Zeile, kein Knopf');
  const as = lies('frontend/js/jahresabschluss.js'), ja = lies('frontend/js/jahresabgleich.js'), sk = lies('frontend/js/modal-boarding-skin.js');
  ok(as.includes("ov.className = 'oabi-ov dp-jab-mode'") && as.includes('class="oabi-reiter"') && as.includes('class="oabi-body"') && as.includes('class="oabi-foot"') && as.includes("class=\"oabi-btn' + (haupt ? ' primary' : '')"), 'E Assistent im Rahmen von „Belege einlesen“ (.oabi-ov, .oabi-reiter, .oabi-body, .oabi-foot, .oabi-btn)');
  ok(sk.includes("t.indexOf('jahresabschluss') >= 0"), 'E Obsidian-Leiste und Gold-Kopf über modal-boarding-skin.js');
  ok(as.includes("ov.querySelector('.oabi-foot').innerHTML = knopf('zu', 'Schließen', false)"), 'E erster Fuß-Knopf ist Schließen (das × der Leiste klickt ihn)');
  ok(as.includes("(anlageVErlaubt() ? knopf('anlage-v'") && as.includes('JA().zuAnlageV(J)'), 'E Absprung zur Anlage V nur mit Stufe und bis zur Anlage V');
  ok(/function zuAnlageV\(\) \{[\s\S]{0,420}yearly-tax-form-box[\s\S]{0,700}nav\.tabs[\s\S]{0,400}scrollBy\(\{ top: dy/.test(ja) && ja.includes("if (a === 'steuer') { zuAnlageV(); return; }"), 'E Absprung wartet auf die Anlage V und rollt hin');
  ok(!ja.includes('dp-ja-fertig-k') && !/function wechselHtml/.test(ja) && !/out \+= wechselHtml/.test(ja) && (ja.match(/knopf\('fertig'/g) || []).length === 1 && /var jahrKn = lauf[\s\S]{0,900}knopf\('fertig', z\.jahr \+ ' fertig machen', true, z\.jahr\)/.test(ja), 'L „fertig machen“ genau einmal, an der Jahresauswahl des gewählten Jahres (v4150)');
  ok(/var jahrKn = lauf \? '<span class="dp-ja-jk-t">' \+ z\.jahr \+ ' läuft noch/.test(ja) && /s\.nFest === 4[\s\S]{0,300}data-ja-aktion="freigeben"/.test(ja), 'L laufendes Jahr ohne Knopf, festgeschrieben: wieder freigeben an derselben Stelle');
  ok(!/knopf\('zurueck'/.test(as) && /knopf\('weiter', 'Weiter: ' \+ SCHRITTE\[i \+ 1\]\[1\]/.test(as), 'L Assistent ohne Zurück, Weiter nennt den nächsten Schritt');
}

/* ── N · v4330 Objekt OHNE ViVi-Anbindung (Marcel 24.11.2026: „funktioniert das, wenn wir ViVi nicht angebunden haben?“) ── */
{
  const cN = kontext();
  for (const f of ['mieterhoehungen.js', 'jahresbuch.js', 'hausverlauf.js', 'jahresabgleich.js', 'jahresabschluss.js']) vm.runInContext(lies('frontend/js/' + f), cN);
  ok(cN.DpJahresabgleich.viviVerknuepft() === false && cN.DpJahresabgleich.viviHgJahr(2025) === null, 'N ohne DpVivi: nicht verknüpft, kein ViVi-Hausgeld');
  const hN = cN.DpJahresabgleich.hausMitViviRein({ hg_ist_j: null }, null, false);
  ok(hN.hg_ist_j === null && hN.hg_quelle !== 'vivi', 'N ohne ViVi bleibt das Hausgeld leer statt „laut ViVi“');
  const as = lies('frontend/js/jahresabschluss.js'), ue = lies('frontend/js/unterlagen-eingang.js'), jb = lies('frontend/js/jahresbuch.js'), ja = lies('frontend/js/jahresabgleich.js');
  ok(as.includes("if (!a || !a.viviVerknuepft || !a.viviVerknuepft()) return '';"), 'N Assistent: ViVi-Zeile nur mit Anbindung');
  ok(as.includes("<small>Übernommene Belege' + (JA() && JA().viviVerknuepft && JA().viviVerknuepft() ? ' und ViVi-Werte' : '')") && !as.includes('Übernommene Belege und ViVi-Werte'), 'N Schritt Steuer nennt ViVi nur mit Anbindung');
  ok(ue.includes("Unterlage, ' + (_viviVerknuepft() ? 'ViVi, ' : '') + 'von Hand") && ue.includes("eingelesen' + (_viviVerknuepft() ? ' oder aus ViVi übernommen' : '') + ' wurden.") && ue.includes("function _viviTeil(jahr, opt) {") && ue.includes("    if (!_viviVerknuepft()) return '';"), 'N Belege je Jahr: ohne Anbindung kein ViVi im Text und keine Spalte „Laut ViVi“');
  ok(as.includes("else if (!L.length) h += '<div class=\"dp-jab-box gold\">Alle vier Schritte"), 'N Festschreiben: „Alle vier Schritte erledigt“ nur, wenn nichts offen ist');
  ok(jb.includes("_stFest = istFest(q.jahr, 'steuer')") && jb.includes('!(_stFest && !z.av.eigen)'),'N festgeschriebene Steuer: kein „übernehmen“ in die Anlage V');
  ok(ja.includes('fertig(finde() || e); }, 420)') && ja.includes('sc.scrollBy(0, dy2)'),'N Absprung rollt erst nach dem Reiterwechsel (420 ms) und zieht nach');
  /* echter Lauf: Zeile mit festgeschriebener Steuer und Vorschlag in der Anlage V */
  cN._currentObjData = { _jahre: { '2025': { fest: { steuer: '2026-11-24' } } } };
  const zf = cN.DpJahresbuch.zeile({ jahr: 2025, plan: 7912, proj: 7680, ist: { nkm_j: 7500 }, av: { wert: 7680, eigen: false } });
  cN._currentObjData = { _jahre: {} };
  const zo = cN.DpJahresbuch.zeile({ jahr: 2025, plan: 7912, proj: 7680, ist: { nkm_j: 7500 }, av: { wert: 7680, eigen: false } });
  ok(!zf.abgleich && zo.abgleich && zo.abgleich.art === 'vorschlag', 'N Vorschlag „übernehmen“ nur im offenen Jahr (fest: ' + JSON.stringify(zf.abgleich) + ', offen: ' + (zo.abgleich && zo.abgleich.art) + ')');
}

console.log(`jahresabgleich-pruefen (v3430): ${gruen} von ${gruen + rot} ok`);
process.exit(rot ? 1 : 0);
