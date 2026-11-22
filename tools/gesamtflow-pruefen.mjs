#!/usr/bin/env node
/* tools/gesamtflow-pruefen.mjs · v3978
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

console.log(`gesamtflow-pruefen (v3978): ${gruen} von ${gruen + rot} ok`);
process.exit(rot ? 1 : 0);
