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
  ok(/data-ja-aktion="' \+ aktion/.test(lies('frontend/js/jahresabgleich.js')) && /JB\(\)\.oeffnen\(y\)/.test(lies('frontend/js/jahresabgleich.js')), 'E „eintragen" öffnet die Bearbeitung des Jahres');
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
  const s24 = J4.stand({ jahr: 2024, status: 'geplant', mb: null }, false);
  ok(s24.steuer === 'ok' && s24.wert === 'ok' && s24.nFest === 2 && s24.n === 3, 'F fest: Steuer und Wert erledigt, mit Miete 3 von 4 (' + s24.n + ')');
  ok(s24.offen.join(',') === 'Haus' && s24.erledigt.join(',') === 'Miete,Steuer,Wert', 'F erledigt/offen mit Namen');
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

console.log(`jahresabgleich-pruefen (v3430): ${gruen} von ${gruen + rot} ok`);
process.exit(rot ? 1 : 0);
