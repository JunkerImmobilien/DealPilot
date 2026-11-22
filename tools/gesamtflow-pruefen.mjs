#!/usr/bin/env node
/* tools/gesamtflow-pruefen.mjs · v3978 ff.
 *
 * Prüfer für die Befunde des Gesamt-Flow-Tests 22.11.2026 (Dateien/Testunterlagen/Gesamtflow-2026-11-22/ERGEBNIS.md).
 * Je Befund ein Abschnitt, an den ECHTEN Dateien, ohne Browser, ohne Netz, ohne DB. Erfundene Zahlen nach den
 * Testobjekten (Musterallee 12, Musterweg 7, Mustergasse 3, Musterring 40).
 * F1 steht in tools/jahresabgleich-pruefen.mjs (Abschnitt W F1).
 *
 *  F2  Quick-Check MFH: kein pauschales Hausgeld 5 €/m², sondern Bewirtschaftung nach bwk-profil.js vorschlag()
 *      (Betriebskosten je m² + Verwaltung je Wohnung + Instandhaltung je m², ImmoWertV Anlage 3) mit Hinweis
 *
 * Aufruf: node tools/gesamtflow-pruefen.mjs   (RC=0 sauber)
 * Gegenprobe: jeder Abschnitt wird gegen die Datei vor dem Fix rot (git show <commit>~1:<datei>). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ERSATZ = {};   /* --alt=<datei>=<pfad>: Gegenprobe mit einer anderen Fassung */
for (const a of process.argv.slice(2)) { const m = a.match(/^--alt=([^=]+)=(.+)$/); if (m) ERSATZ[m[1]] = m[2]; }
const lies = (f) => fs.readFileSync(ERSATZ[f] || path.join(ROOT, f), 'utf8');
let gruen = 0, rot = 0;
const ok = (b, t) => { if (b) gruen++; else { rot++; console.log('  ROT  ' + t); } };

/* ── kleine DOM-Attrappe ───────────────────────────────────────── */
function dom() {
  const els = {};
  const mk = (id, value = '') => {
    const e = { id, value, dataset: {}, textContent: '', _l: {}, hidden: false,
      addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); },
      dispatchEvent(ev) { (this._l[ev.type] || []).forEach((f) => f(ev)); return true; },
      setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
      closest() { return this._feld || null; }, querySelector() { return null; } };
    els[id] = e; return e;
  };
  const document = {
    readyState: 'complete', els, mk,
    getElementById: (id) => els[id] || null,
    querySelector: (sel) => { const m = sel.match(/label\[for="([^"]+)"\]/); return m ? (els['label:' + m[1]] || null) : null; },
    querySelectorAll: () => [], addEventListener() {}, createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} }
  };
  return document;
}
function Ev(type) { this.type = type; }

/* ── F2 · Quick-Check MFH ohne Hausgeld ────────────────────────── */
{
  const html = lies('frontend/quickcheck-app.html');
  const i = html.indexOf('<script id="qc-profile-defaults">'), j = html.indexOf('</script>', i);
  const code = i > 0 ? html.slice(html.indexOf('>', i) + 1, j) : '';
  ok(code.length > 1000, 'F2 Skript qc-profile-defaults gefunden');
  /* echtes bwk-profil.js */
  const bdoc = dom();
  const bctx = { console, Math, JSON, Number, String, isFinite, parseFloat, parseInt, Object, Array, Date, setTimeout: () => 0, clearTimeout() {},
    localStorage: { getItem: () => null, setItem() {} }, fetch: () => new Promise(() => {}), document: bdoc, addEventListener() {}, dispatchEvent() {} };
  bctx.window = bctx; vm.createContext(bctx);
  vm.runInContext(lies('frontend/js/bwk-profil.js'), bctx);
  const BP = bctx.DealPilotBwkProfil;
  ok(BP && BP.vorschlag, 'F2 bwk-profil.js geladen');

  function lauf(art, wfl, einh) {
    const d = dom();
    const hg = d.mk('qc_hg'); d.mk('qc_kp', '640000'); d.mk('qc_wfl', String(wfl)); d.mk('qc_bj', '1972'); d.mk('qc_objektart', art);
    d.mk('qc_einheiten', String(einh)); const hint = d.mk('qc-hg-hint'); const lb = d.mk('label:qc_hg'); lb.textContent = 'Hausgeld / Monat (€)';
    d.mk('qc_hg_split', '22'); d.mk('qc_zins'); d.mk('qc_tilg');
    /* der alte Weg: Richtwert nach Baujahr 5,00 €/m² */
    const IP = { getHausgeldEstimate: (kp, o) => ({ monatlich: o.wohnflaeche * 5, methode: 'wohnflaeche', faktor: 5, grundlageText: 'Richtwert', baujahrBereich: null }),
      getZins: () => null, get: () => null };
    const ctx = { console, Math, JSON, Number, String, isFinite, parseFloat, parseInt, Object, Array, Date, setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, Event: Ev, document: d, addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } };
    ctx.window = ctx; ctx.parent = { DealPilotInvestmentProfile: IP, DealPilotBwkProfil: BP, Hausgeld: null };
    ctx.window.parent = ctx.parent;
    vm.createContext(ctx);
    try { vm.runInContext(code, ctx); } catch (e) { return { fehler: e.message }; }
    return { hg: hg.value, hint: hint.textContent, label: lb.textContent };
  }
  const v = BP.vorschlag({ objart: 'MFH', wfl: 420, einheiten: 6 });
  const soll = Math.round((v.hg_ul + v.hg_nul + v.eigen_r) / 12);
  const r = lauf('MFH', 420, 6);
  ok(!r.fehler, 'F2 Quick-Check-Skript läuft (' + (r.fehler || 'ok') + ')');
  ok(r.hg !== '2100' && r.hg === String(soll), 'F2 MFH 420 m², 6 WE: Bewirtschaftung ' + soll + ' €/Monat nach Anlage 3, nicht 2.100 € (= 5 €/m² Hausgeld) — Ist ' + r.hg);
  ok(/Kein Hausgeld/.test(r.hint) && /Anlage 3/.test(r.hint), 'F2 Hinweis nennt „Kein Hausgeld" und die Herkunft (' + r.hint.slice(0, 90) + ' …)');
  ok(/Bewirtschaftung/.test(r.label), 'F2 Feld heißt beim MFH „Bewirtschaftung / Monat" (' + r.label + ')');
  const e = lauf('ETW', 74, 1);
  ok(e.hg === '370' && /Hausgeld/.test(e.label), 'F2 ETW bleibt beim Hausgeld-Richtwert (74 m² × 5 = 370 €, ' + e.hg + ')');
}

/* ── Hilfe: eine Funktion aus einer echten Datei ausschneiden (Klammern zählen, Zeichenketten und Kommentare überspringen) ── */
function funk(src, name) {
  const i = src.indexOf('function ' + name + '('); if (i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for (; k < src.length; k++) {
    const c = src[k], n = src[k + 1];
    if (c === '/' && n === '*') { k = src.indexOf('*/', k + 2) + 1; continue; }
    if (c === '/' && n === '/') { k = src.indexOf('\n', k); continue; }
    if (c === "'" || c === '"' || c === '`') { for (k++; k < src.length && src[k] !== c; k++) if (src[k] === '\\') k++; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return null;
}

/* ── F3/F4 · Unterlagen schlagen das Exposé sichtbar ──────────── */
{
  const oa = lies('frontend/js/object-actions.js');
  const teile = ['numDe', 'fmt0', 'mergeDokument', '_rohGleich', '_abweichungMerken', '_hausgeldAbweichung'].map((n) => [n, funk(oa, n)]);
  const fehlt = teile.filter((t) => !t[1]).map((t) => t[0]);
  ok(!fehlt.length, 'F3 Funktionen in object-actions.js gefunden (fehlt: ' + (fehlt.join(', ') || '-') + ')');
  const code = teile.filter((t) => t[1]).map((t) => t[1]).join('\n');
  function sandbox(objart, zeilen, exposeRows) {
    const ctx = { console, Math, JSON, Number, String, isFinite, parseFloat, parseInt, Object, Array, Intl, _qcMode: true, _mvImport: [], _importHinweise: [], _vergleich: [], _merged: {} };
    ctx.window = { DokumentImport: { abgleich: (ext, typ) => JSON.parse(JSON.stringify(zeilen[typ] || [])), vergleich: () => [] } };
    ctx._kontext = () => ({ objart, mea: null });
    vm.createContext(ctx);
    try { vm.runInContext(code + '\n;var __f = { mergeDokument: mergeDokument, hg: typeof _hausgeldAbweichung === "function" ? _hausgeldAbweichung : function(){} };', ctx); }
    catch (e) { ctx.__f = { mergeDokument() {}, hg() {} }; }
    Object.assign(ctx._merged, exposeRows);
    return ctx;
  }
  /* ETW-A Musterweg 7: Exposé 76 m², 660 €, Hausgeld 330 €; Mietvertrag 74 m², 640 €; Wirtschaftsplan 2023 295 € */
  const ex = { wfl: { label: 'Wohnfläche', value: '76 m²', raw: '76', source: 'Exposé', kind: 'input' }, nkm: { label: 'Nettokaltmiete / Monat', value: '660 €', raw: 660, source: 'Exposé', kind: 'input' },
    hg_ul: { label: 'Hausgeld umlagefähig / Jahr', value: '3089', raw: '3089', source: 'Exposé', kind: 'input', hgVorgabe: true, hgMonat: 330 }, hg_nul: { label: 'Hausgeld nicht umlagefähig / Jahr', value: '871', raw: '871', source: 'Exposé', kind: 'input', hgVorgabe: true, hgMonat: 330 } };
  const zeilen = { mietvertrag: [{ feld: 'wfl', wort: 'Wohnfläche', anzeige: '74 m²', neu: '74' }, { feld: 'nkm', wort: 'Nettokaltmiete (Monat)', anzeige: '640 €', neu: '640' }],
    hausgeld: [{ feld: 'hg_ul', wort: 'Hausgeld umlagefähig / Jahr', anzeige: '1.980 €', neu: '1980' }, { feld: 'hg_nul', wort: 'Hausgeld nicht umlagefähig / Jahr', anzeige: '1.560 €', neu: '1560' }] };
  const c = sandbox('ETW', zeilen, JSON.parse(JSON.stringify(ex)));
  c.__f.mergeDokument({ typ: 'mietvertrag', label: 'Mietvertrag', extracted: {} }, false);
  c.__f.mergeDokument({ typ: 'hausgeld', label: 'Wirtschaftsplan 2023', extracted: {} }, true);
  c.__f.hg();
  const M = c._merged, H = c._importHinweise.join(' | ');
  ok(M.wfl.raw === '74' && M.nkm.raw === '640', 'F3 ETW: Mietvertrag schlägt Exposé (74 m², 640 €), Ist ' + M.wfl.raw + ' / ' + M.nkm.raw);
  ok(/Abweichung Wohnfläche: Exposé 76 m², Mietvertrag 74 m²/.test(H) && /Abweichung Nettokaltmiete.*Exposé 660 €, Mietvertrag 640 €/.test(H), 'F3 Abweichungsmeldung für Fläche und Miete (' + H.slice(0, 160) + ')');
  ok(M.hg_ul.raw === '1980' && M.hg_ul.nurAktiv === false && M.hg_nul.nurAktiv === false, 'F3 Wirtschaftsplan ersetzt das vorgehakte Exposé-Hausgeld und übernimmt den Haken (kein leeres Feld, keine 5-€-Schätzung)');
  ok(/Abweichung Hausgeld: Exposé 330 €\/Monat, Wirtschaftsplan 2023 295 €\/Monat/.test(H), 'F3 Hausgeld-Abweichung in einem Satz (Exposé 330 €, Wirtschaftsplan 295 €)');
  /* ohne Exposé-Wert bleibt der Wirtschaftsplan bei der ETW nicht vorgehakt (v3088a) */
  const c2 = sandbox('ETW', zeilen, {});
  c2.__f.mergeDokument({ typ: 'hausgeld', label: 'Wirtschaftsplan 2023', extracted: {} }, true);
  ok(c2._merged.hg_ul && c2._merged.hg_ul.nurAktiv === true, 'F3 ohne Exposé-Zeile bleibt der Wirtschaftsplan nicht vorgehakt (v3088a)');
  /* MFH: ein Mietvertrag ist EINE Einheit und schlägt das Exposé nicht */
  const c3 = sandbox('MFH', zeilen, JSON.parse(JSON.stringify(ex)));
  c3.__f.mergeDokument({ typ: 'mietvertrag', label: 'Mietvertrag', extracted: {} }, false);
  ok(c3._merged.wfl.raw === '76', 'F3 MFH: ein Mietvertrag überschreibt die Fläche des Hauses nicht');
  /* F4 · Musterallee 12: eigene Mieterliste gegen Exposé 2.890 €/420 m² - Block aus _unterlagenZeilen echt ausgeführt */
  const a = oa.indexOf('v3979 · F3/F4 Gesamt-Flow'), bEnde = oa.indexOf('/* v3352 · Marcel 13.11.2026', a);
  const block = a > 0 && bEnde > a ? oa.slice(oa.lastIndexOf('/*', a), bEnde) : '';
  ok(block.length > 500, 'F4 Block „Mieterliste schlägt Exposé" in _unterlagenZeilen gefunden');
  const ctx4 = { console, Math, JSON, Number, String, isFinite, parseFloat, parseInt, Object, Array, Intl, _qcMode: true, _importHinweise: [],
    _merged: { nkm: { label: 'Nettokaltmiete / Monat', value: '2.890 €', raw: 2890, source: 'Exposé', kind: 'input' }, wfl: { label: 'Wohnfläche', value: '420 m²', raw: '420', source: 'Exposé', kind: 'input' } },
    _anzeigeMitEinheit: (id, v) => v + ' m²' };
  const we = [{ nr: 'WE 1', wfl: 72, ist: 520 }, { nr: 'WE 2', wfl: 68, ist: 545 }, { nr: 'WE 3', wfl: 72, ist: 590 }, { nr: 'WE 4', wfl: 68, ist: 0, status: 'leer' }, { nr: 'WE 5', wfl: 66, ist: 510 }, { nr: 'WE 6', wfl: 66, ist: 495 }];
  we._eigeneListe = true; we._quelle = 'Mieterliste';
  Object.assign(ctx4, { we, miete: 2660, stp: 90 });
  vm.createContext(ctx4);
  try { vm.runInContext(code + '\n' + block, ctx4); } catch (e) { ok(false, 'F4 Block läuft: ' + e.message); }
  const qcSumme = (Number(ctx4._merged.nkm.raw) || 0) + 90;
  ok(String(ctx4._merged.nkm.raw) === '2660' && qcSumme === 2750, 'F4 Objektmiete = Wohnungen der Mieterliste 2.660 €, mit 90 € Stellplätzen 2.750 € statt 2.980 € (Ist ' + ctx4._merged.nkm.raw + ')');
  ok(String(ctx4._merged.wfl.raw) === '412', 'F3 MFH Wohnfläche = Summe der Mieterliste 412 m² statt 420 (Ist ' + ctx4._merged.wfl.raw + ')');
  ok(/Abweichung .*Exposé 2.890 €, Mieterliste 2.660 €/.test(ctx4._importHinweise.join(' ')), 'F4 Abweichungsmeldung Miete (' + ctx4._importHinweise.join(' | ').slice(0, 140) + ')');
}

/* ── F6 · tilgungsfreie Anlaufzeit im Annuitätendarlehen ────────── */
{
  const cj = lies('frontend/js/calc.js');
  const code = ['_jahrMonatlich', '_zbVor', '_zbIn', '_d1Bindung'].map((n) => funk(cj, n) || '').join('\n');
  function restEndeBindung(D, z, t, bindj, tf, m1) {
    const ctx = { Math, d1z: z, d1_rate_m: D * (z + t) / 12, d1_tf: tf, _zbM1: m1, _zbMon: bindj * 12 };
    vm.createContext(ctx);
    try { vm.runInContext(code + '\n;var __r = ' + D + '; for (var __y = 1; _zbVor(__y) < _zbMon && __y < 400; __y++) __r = _d1Bindung(__r, __y).rs;', ctx); } catch (e) { return NaN; }
    return ctx.__r;
  }
  const a = restEndeBindung(175200, 0.0385, 0.02, 10, 3, 1);   /* Musterweg 7, Auszahlung 12/2023 */
  ok(Math.abs(a - 133819.78) < 1, 'F6 ETW-A Restschuld Ende Bindung mit 3 Monaten tilgungsfrei 133.819,78 € laut Vertrag (Ist ' + (a || 0).toFixed(2) + ')');
  const b = restEndeBindung(512000, 0.0395, 0.02, 10, 6, 1);   /* Musterallee 12 */
  ok(Math.abs(b - 394185.46) < 2, 'F6 MFH-A Restschuld mit 6 Monaten tilgungsfrei ≈ 394.185 € (Ist ' + (b || 0).toFixed(2) + ')');
  const c = restEndeBindung(175200, 0.0385, 0.02, 10, 0, 1);
  ok(Math.abs(c - 132541.40) < 1, 'F6 ohne tilgungsfreie Zeit unverändert 132.541,40 € (Ist ' + (c || 0).toFixed(2) + ')');
  /* Jahr 1 anteilig (anteilig.js) mit tilgungsfreien Monaten */
  const actx = { Math, console, Date, window: {}, document: { getElementById: () => null, addEventListener() {} }, setTimeout: () => 0 };
  actx.window = actx; vm.createContext(actx);
  try { vm.runInContext(lies('frontend/js/anteilig.js'), actx); } catch (e) {}
  const A = actx.DealPilotAnteilig;
  const y1 = A && A.computeY1Annuitaet(175200, 3.85, 2, 1, 3);
  ok(y1 && Math.abs(y1.tilg) < 0.01 && Math.abs(y1.zins - 562.10) < 0.01, 'F6 anteiliges Jahr 1 (1 Monat, tilgungsfrei): nur Zins 562,10 € (Ist ' + (y1 ? y1.zins.toFixed(2) + ' / ' + y1.tilg.toFixed(2) : '-') + ')');
  ok(/id="d1_tf_mon"/.test(lies('frontend/index.html')) && /'d1_tf_mon'/.test(lies('frontend/js/storage.js')), 'F6 Feld d1_tf_mon im Reiter Finanzierung und in FIELDS (wird gespeichert)');
}

/* ── F7 · Darlehensvertrag einlesen (financing-pdf.js, echter Parser) ── */
{
  const ctx = { console, Math, JSON, Number, String, isFinite, parseFloat, parseInt, Object, Array, Date, RegExp, setTimeout: () => 0,
    document: { getElementById: () => null, addEventListener() {}, createElement: () => ({ style: {} }), body: { appendChild() {} }, head: { appendChild() {} } }, addEventListener() {} };
  ctx.window = ctx; vm.createContext(ctx);
  try { vm.runInContext(lies('frontend/js/financing-pdf.js'), ctx); } catch (e) { ok(false, 'F7 financing-pdf.js lädt: ' + e.message); }
  const P = ctx.dpFinPdfLesen;
  const text = 'Musterbank eG · Darlehensvertrag MB-2024-0815\nDarlehensvertrag (Annuitätendarlehen)\nDarlehensart Annuitätendarlehen\nNettodarlehensbetrag 175.200,00 €\n'
    + 'Auszahlungskurs 100 % (kein Disagio)\nAuszahlung voll am 29.12.2023\nSollzins gebunden 3,85 % p. a.\nTilgungsfreie Anlaufzeit 3 Monate (nur Zinsen, 562,10 € im Monat)\n'
    + 'Monatsrate 854,10 € ab dem 4. Monat\nSondertilgung jährlich bis 5 % des Nettodarlehensbetrags (8.760,00 €) ohne Vorfälligkeitsentschädigung\n';
  const r = P ? P(text, 'd1') : { fields: {} }, f = r.fields || {};
  ok(f.bank_inst === 'Musterbank eG', 'F7 Bank „Musterbank eG" statt „eG · Darlehensvertrag …" (Ist ' + f.bank_inst + ')');
  ok(f.d1_auszahl === '12.2023', 'F7 Auszahlung „voll am 29.12.2023" → 12.2023 (Ist ' + f.d1_auszahl + ')');
  ok(f.d1_tf_mon === 3, 'F7 tilgungsfreie Anlaufzeit 3 Monate gelesen (Ist ' + f.d1_tf_mon + ')');
}

/* ── F8/F18 · ViVi: Betrag der letzten Erhöhung, Miete der Jahre aus dem Mietverlauf ── */
{
  const mod = { exports: {} };
  const req = (n) => { if (n === 'crypto' || n === 'node:crypto') return { randomUUID: () => 'x' }; return {}; };
  try { new Function('module', 'exports', 'require', lies('backend/src/services/vivi/viviMapping.js'))(mod, mod.exports, req); } catch (e) { ok(false, 'F8 viviMapping lädt: ' + e.message); }
  const M = mod.exports;
  const paket = { projekt: { id: 'p1' }, einheiten: [{ id: 'u1', square_meters: 58.5, unit_type: 'residential' }],
    mietverhaeltnisse: [{ id: 'r1', unit_id: 'u1', rent: 520, monthly_utility_costs: 175, rental_start: '2019-07-01', last_rent_increase: '2026-11-01' }],
    mietverlauf: { r1: { rent_changes: [{ effective_date: '2026-11-01', previous_rent: 495, new_rent: 520, status: 'active' }, { effective_date: '2023-07-01', previous_rent: 450, new_rent: 495, status: 'active' }] } } };
  let F = {};
  try { F = M.ausVivi(paket, { vivi_ids: {}, mitEinheiten: false, objart: 'ETW', jetzt: '2026-11-22' }).felder || {}; } catch (e) { ok(false, 'F8 ausVivi läuft: ' + e.message); }
  ok(F.mv_letzte_erhoehung && F.mv_letzte_erhoehung.wert === '2026-11-01', 'F8 letzte Erhöhung 01.11.2026 (Ist ' + (F.mv_letzte_erhoehung && F.mv_letzte_erhoehung.wert) + ')');
  ok(F.mv_letzte_erhoehung_betrag && Number(F.mv_letzte_erhoehung_betrag.wert) === 25, 'F8 Betrag der letzten Erhöhung 25 € aus dem Mietverlauf, nicht der alte (Ist ' + (F.mv_letzte_erhoehung_betrag && F.mv_letzte_erhoehung_betrag.wert) + ')');
  const ohne = JSON.parse(JSON.stringify(paket)); delete ohne.mietverlauf;
  let F2 = {}; try { F2 = M.ausVivi(ohne, { vivi_ids: {}, mitEinheiten: false, objart: 'ETW', jetzt: '2026-11-22' }).felder || {}; } catch (e) {}
  ok(F2.mv_letzte_erhoehung_betrag && F2.mv_letzte_erhoehung_betrag.wert === '', 'F8 ohne Mietverlauf: Betrag leer statt alter Betrag zum neuen Datum');
  const vf = lies('frontend/js/vivi-felder.js');
  ok(/'mv_letzte_erhoehung_betrag'/.test(vf), 'F8 vivi-felder.js führt den Betrag (Einheiten und Zahlenvergleich)');
  /* F18 · echte mieterhoehungen.js: Jahresmiete aus letzter Erhöhung und Betrag */
  const ctx = { console, Math, JSON, Number, String, isFinite, parseFloat, parseInt, Object, Array, Date, setTimeout: () => 0, document: undefined };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  try { vm.runInContext(lies('frontend/js/mieterhoehungen.js'), ctx); } catch (e) {}
  const E = ctx.DpErhoehungen;
  const q = [{ liste: [], heute: 520, letzte: '2026-11-01', betrag: 25 }];
  const j25 = E ? Math.round(E.jahresFaktor(q, 2025) * 520 * 12) : null, j26 = E ? Math.round(E.jahresFaktor(q, 2026) * 520 * 12) : null;
  ok(j25 === 5940, 'F18 2025 = 12 × 495 = 5.940 € (Ist ' + j25 + ')');
  ok(j26 === 5990, 'F18 2026 = 10 × 495 + 2 × 520 = 5.990 € (Ist ' + j26 + ')');
  ok(/if \(y <= off\) \{/.test(lies('frontend/js/mietentwicklung.js')), 'F18 mietentwicklung.js: auch das laufende Jahr aus dem Mietverlauf (istFaktor), nicht 12 × heutige Miete');
  const jb = lies('frontend/js/jahresbuch.js');
  ok(/function vertragsErhoehungen\(E\)/.test(jb) && /erh = erh\.concat\(vertragsErhoehungen\(E\)\)/.test(jb), 'F18 Jahresabgleich zeigt die Erhöhung aus „Letzte Erhöhung" (ohne Liste), nicht „Keine Erhöhung"');
}

/* ── F11 · Importarten Mieterhöhung, Betriebskosten, Angebot, Darlehensvertrag ── */
{
  const mod = { exports: {} };
  try { new Function('module', 'exports', 'require', lies('backend/src/services/dokumentSchemas.js'))(mod, mod.exports, () => ({})); } catch (e) { ok(false, 'F11 dokumentSchemas lädt: ' + e.message); }
  const DS = mod.exports;
  const faelle = [
    ['Mieterhöhungsverlangen WE 5\nMieterhöhungsverlangen nach § 558 BGB\nDie Nettokaltmiete Ihrer Wohnung (66 m²) beträgt derzeit 510,00 € (7,73 €/m²). Erhöhung auf 625,00 € ab 01.08.2025. Begründung: Mietspiegel der Stadt Herford, Baualtersklasse 1970 bis 1979.', 'Mieterhoehung WE 5 ab 01.08.2025.pdf', 'mieterhoehung'],
    ['Betriebskostenabrechnung 2024 · Musterallee 12\nBetriebskostenabrechnung 2024 (Gesamthaus)\nGrundsteuer Müllabfuhr Vorauszahlungen Nachzahlung', 'Betriebskostenabrechnung 2024.pdf', 'betriebskosten'],
    ['Betriebskostenabrechnung 2025 · WE 5\nBetriebskostenabrechnung 2025\nGrundsteuer Wasser Vorauszahlungen (12 × 265,00 €) Guthaben Mieter', 'Betriebskostenabrechnung Mieter 2025.pdf', 'betriebskosten'],
    ['Muster Bad & Haustechnik GmbH · Angebot\nAngebot Nr. A-7-2023\nSumme netto 11.630,00 € Umsatzsteuer 19 % Angebotssumme brutto 13.839,70 €', '06 Sanierungsangebot Badmodernisierung.pdf', 'sanierungsangebot'],
    ['Musterbank eG · Darlehensvertrag MB-2023-4711\nDarlehensvertrag (Annuitätendarlehen)\nNettodarlehensbetrag 175.200,00 € Tilgungsfreie Anlaufzeit 3 Monate', '07 Darlehensvertrag MB-2023-4711.pdf', 'darlehensvertrag'],
    ['WEG Musterweg 7 · Jahresabrechnung 2024\nHausgeldabrechnung 2024 · Einzelabrechnung', 'Hausgeldabrechnung 2024.pdf', 'hausgeld'],
    ['Wohnraummietvertrag WE 5\nWohnraummietvertrag\nDie Nettokaltmiete beträgt 590,00 €. Vermieter Mieter Kaution 1.770,00 €.', '03 Mietvertrag WE 5.pdf', 'mietvertrag']];
  faelle.forEach((f) => { const k = DS.klassifiziere ? DS.klassifiziere(f[0], f[1]).typ : null; ok(k === f[2], 'F11 Art „' + f[1] + '" = ' + f[2] + ' (Ist ' + k + ')'); });
  ['mieterhoehung', 'betriebskosten', 'sanierungsangebot', 'darlehensvertrag'].forEach((t) => ok(DS.SCHEMATA && DS.SCHEMATA[t] && DS.SCHEMATA[t].schema.length > 3, 'F11 Schema für ' + t));
  const oa = lies('frontend/js/object-actions.js');
  const dn = (oa.match(/var DOK_NAME = (\/[^\n]*?\/i);/) || [])[1];
  const DN = dn ? eval(dn) : /$^/;
  ok(['Mieterhoehung WE 5 ab 01.08.2025.pdf', 'Betriebskostenabrechnung 2024.pdf', '06 Sanierungsangebot Bad.pdf', '07 Darlehensvertrag MB-2023-4711.pdf'].every((n) => DN.test(n)), 'F11 Dateinamen gelten als Unterlage (nie mehr Marktbericht-Suche)');
  /* Kappungsprüfung am echten Kern */
  const kctx = { console, Math, JSON, Number, String, isFinite, parseFloat, parseInt, Object, Array, Date, setTimeout: () => 0, document: undefined };
  kctx.window = kctx; kctx.globalThis = kctx; vm.createContext(kctx);
  try { vm.runInContext(lies('frontend/js/mietpotenzial-kern.js'), kctx); } catch (e) {}
  const pr = funk(oa, '_mieterhoehungPruefung'), hilf = ['numDe', 'fmt0'].map((n) => funk(oa, n) || '').join('\n');
  const pctx = { Math, JSON, Number, String, isFinite, parseFloat, Intl, K: kctx.DpMietpotenzial };
  vm.createContext(pctx);
  let r = null;
  try { vm.runInContext(hilf + '\n' + (pr || '') + '\n;var __r = _mieterhoehungPruefung({ bisherige_miete_eur: 510, neue_miete_eur: 625, wohnflaeche_m2: 66, art: "558" }, { pct: 20 }, K);', pctx); r = pctx.__r; } catch (e) { r = null; }
  ok(r && r.max === 612 && r.ueber === true && /Kappungsgrenze/.test(r.text), 'F11 WE 5 510 → 625 € (+22,5 %): über der Kappungsgrenze, höchstens 612 € (Kern zulaessig) (Ist ' + (r ? r.max + ' / ' + r.ueber : '-') + ')');
  let r2 = null;
  try { vm.runInContext('var __r2 = _mieterhoehungPruefung({ bisherige_miete_eur: 545, neue_miete_eur: 600, wohnflaeche_m2: 68, art: "558" }, { pct: 20 }, K);', pctx); r2 = pctx.__r2; } catch (e) {}
  ok(r2 && r2.ueber === false, 'F11 WE 2 545 → 600 € (+10 %) innerhalb der Kappungsgrenze');
  ok(/kind === 'erhoehung'/.test(oa) && /erhoehung: 1/.test(oa), 'F11 Zeile „Mieterhöhung" wird geschrieben und erscheint in der Prüftabelle (_SONDER)');
  const di = lies('frontend/js/dokument-import.js');
  ok(/darlehensbetrag_eur: \['d1'/.test(di) && /tilgungsfrei_monate: \['d1_tf_mon'/.test(di) && /brutto_eur: \['san'/.test(di), 'F11 Darlehensvertrag → Darlehen I (inkl. tilgungsfrei), Angebot → Sanierungskosten');
}

/* ── F21 · Deal-Aktion nach neuem Objekt neu zeichnen ── F10 · leere Karte im Quick Boarding füllen ── */
{
  const st = lies('frontend/js/storage.js');
  const n = (st.match(/_dwA\.value = '';\r?\n[^\n]*v3983 · F21[\s\S]{0,400}?DealPilotDealAction\.initStatusSync\(\)/g) || []).length;
  ok(n === 2, 'F21 beide Rücksetzstellen (newObj und Formular leeren) zeichnen die Deal-Aktion neu (initStatusSync), gefunden ' + n);
  /* echte initStatusSync: versteckte Felder leer, _currentObjData {} → „open" */
  const da = lies('frontend/js/deal-action.js');
  const i = da.indexOf('initStatusSync: function()'), body = i > 0 ? da.slice(i + 'initStatusSync: '.length, da.indexOf('\n    },', i) + 6) : '';
  let status = null;
  try {
    const els = { _deal_won_state: { value: 'false' }, _deal_lost_state: { value: 'false' } };
    const ctx = { console, document: { getElementById: (id) => els[id] || null }, window: { _currentObjData: {} }, updateStatusUI: (s) => { status = s; } };
    vm.createContext(ctx); vm.runInContext('(' + body.replace(/,\s*$/, '') + ')()', ctx);
  } catch (e) { status = 'Fehler ' + e.message; }
  ok(status === 'open', 'F21 initStatusSync nach dem Zurücksetzen: Status „open" (Ist ' + status + ')');
  const ui = lies('frontend/js/ui.js'), qb = lies('frontend/js/qc-bridge.js');
  ok(/window\._dpQcLeereKarte = \(window\._currentObjKey && _lk && _lk\.key === window\._currentObjKey && _leer\)/.test(ui), 'F10 Quick Boarding merkt sich die frisch angelegte leere Karte');
  ok(/var _lk = window\._dpQcLeereKarte;[\s\S]{0,600}window\._currentObjKey = _lk\.key/.test(qb) && qb.indexOf('_dpQcLeereKarte') > qb.indexOf("window.newObj({ ohneAuswahl: true })"), 'F10 „Als Objekt speichern" schreibt in diese Karte (nach newObj, nur wenn der Server sie leer meldet)');
}

/* ── F5 · Investitionsthese im Quick-Check: Kaufumfang aus dem Import, kein „3-Zimmer" davor ── */
{
  const oa = lies('frontend/js/object-actions.js');
  const code = ['numDe', '_artCode', '_mergedRoh', '_kontext'].map((n) => funk(oa, n) || '').join('\n');
  const form = { objart: 'MFH', mea: '', kp: '640000' };
  const ctx = { Math, String, Number, isFinite, parseFloat, _qcMode: true, $: (id) => ({ value: form[id] || '' }),
    _merged: { objart: { raw: 'Eigentumswohnung' }, mea: { raw: '8,5' }, wfl: { raw: '74' }, kp: { raw: '219000' } } };
  vm.createContext(ctx);
  let k = null; try { vm.runInContext(code + '\n;var __k = _kontext();', ctx); k = ctx.__k; } catch (e) { k = null; }
  ok(k && k.objart === 'ETW' && k.mea === 8.5 && k.eckdaten && k.eckdaten.kaufpreis === '219000' && k.eckdaten.wohnflaeche === '74', 'F5 Quick-Check: Objektart, MEA und Eckdaten aus dem Import (ETW, 8,5 %, 219.000 €), nicht aus dem offenen MFH');
  const ctx2 = Object.assign({}, ctx, { _merged: {} }); vm.createContext(ctx2);
  let k2 = null; try { vm.runInContext(code + '\n;var __k = _kontext();', ctx2); k2 = ctx2.__k; } catch (e) {}
  ok(k2 && k2.objart === '', 'F5 ohne Objektart im Import keine Objektart vom Vorgänger (Ist ' + (k2 && k2.objart) + ')');
  ok(/if \(!artK\) objekt\.kauf_umfang = 'unbekannt/.test(lies('frontend/js/unterlagen.js')), 'F5 ohne Objektart behauptet die Auswertung keinen Kaufumfang („ganzes Gebäude")');
  ok(!/notesParts\.push\(snapshot\.zimmer \+ '-Zimmer'\)/.test(lies('frontend/js/quick-check.js')), 'F5 „3-Zimmer" geht nicht mehr in die Investitionsthese');
}

/* ── F16 · Rundung Hausgeld-Anteil, Komma ── F17 · Wartehinweis ── F26 · Platzhalter ── */
{
  const oa = lies('frontend/js/object-actions.js'), qc = lies('frontend/quickcheck-app.html');
  const m = oa.match(/qcData\['qc_hg_split'\] = String\(Math\.round\(_n \/ \(_u \+ _n\) \* (\d+)\) \/ (\d+)\)/);
  const u = 1740, n = 1440, ges = Math.round((u + n) / 12), pct = m ? Math.round(n / (u + n) * +m[1]) / +m[2] : NaN;
  const nZur = Math.round(ges * 12 * pct / 100), uZur = ges * 12 - nZur;
  ok(nZur === 1440 && uZur === 1740, 'F16 Wirtschaftsplan 1.740/1.440 € kommt über den Quick-Check unverändert ins Objekt (Ist ' + uZur + '/' + nZur + ')');
  ok(/k!=='bj' && \/\^\\d\+\\\.\\d\+\$\/\.test\(v\)\) v=v\.replace\('\.',','\)/.test(qc), 'F16 Übernahmeliste schreibt 58,5 m² mit Komma');
  const vv = lies('frontend/js/vivi.js');
  ok(!/Das dauert meist nur Sekunden, ' \) \+ 'weil ViVi/.test(vv.replace(/\s+/g, ' ')) && /'Das dauert meist nur Sekunden\. '/.test(vv), 'F17 Wartehinweis: die Begründung „alle Mieten ab Mietbeginn" steht nur beim langen Fall');
  ok(/id="qc_ort" placeholder="Musterstadt"/.test(qc) && !/placeholder="116/.test(qc), 'F26 Quick-Check-Platzhalter ohne echten Ort und ohne echte Hausnummer');
}

console.log(`gesamtflow-pruefen (v3985): ${gruen} von ${gruen + rot} ok`);
process.exit(rot ? 1 : 0);
