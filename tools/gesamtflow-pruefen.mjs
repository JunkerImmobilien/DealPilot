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

console.log(`gesamtflow-pruefen (v3979): ${gruen} von ${gruen + rot} ok`);
process.exit(rot ? 1 : 0);
