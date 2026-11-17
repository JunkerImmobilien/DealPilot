#!/usr/bin/env node
/* tools/miete-zusatz-pruefen.mjs · v3670 — Wohnungsmiete und Zusatzeinnahmen getrennt

   Marcel 17.11.2026: Stellplatz, Kueche, Sonstiges aus der „angesetzten Miete" herausrechnen.
   „Wir haben im Tab Miete ein Feld dafuer, das heisst zusaetzliche Einnahmen … darunter zum
   Ausklappen auch trennen, aber nur wenn erforderlich."

   Geprueft an den ECHTEN Dateien, ohne Netz und ohne Datenbank:
     A  Quick-Check _qcMietpotenzial (quickcheck-app.html, Funktion herausgeloest, echter
        Mietpotenzial-Kern): Faelle A–D der Inventur 17.11.2026 als Sollwerte
          A  780 Wohnung + 50 Stellplatz + 30 Kueche + 20 Sonstiges, 65 m², Marktmiete 813
             -> Wohnung 780 (12,00 €/m²), Zusatz 100, 4 % UNTER dem Mittel (bis v3669: 13,54 €/m², 8 % darueber)
          B  880 nur Wohnung -> Wohnung 880 (13,54 €/m²), 8 % ueber dem Mittel (unveraendert)
          C  Gesamtmiete 880 getippt, Teile 100, KEINE Grundmiete -> Wohnung 780
          D  Wohnung = Marktmiete 813 + Stellplatz 50 -> „keine Miete angegeben" (leer) erkannt
        und der Kappungs-Text der Box nennt den einheitlichen Vertrag (BGH VIII ZR 249/23)
     B  Reiter Miete, js/ze-aufteilung.js in einer nachgebauten Seite: ze bleibt Summe, Aufteilen
        uebernimmt den bisherigen Betrag als Stellplatz, Teile sperren ze, Import eines Teils
        verliert den bisherigen Betrag nicht (Rest -> Sonstiges), Skript schreibt ze -> Aufteilung
        aufgehoben, setzen() ersetzt, Laden eines Objekts aendert keine Werte
     C  Marktbericht lib/zusatz_einnahmen.js + echter Mapper + echter Ertragswertdienst:
        ungeteilt kapitalisiert, Kueche als sonstiger Ertrag mit eigener Dauer, keine Doppelzaehlung
        mit Anzahl × Stellplatzmiete (Hinweis im Bericht), Stellplatzanteil 0 -> beide, Ist-Miete im
        Band unberuehrt (nkm/wfl), Gewerbezweig traegt ze
     D  Verdrahtung: Felder gespeichert (FIELDS, Reset), Karte schickt ze und Teile, Importe zeigen
        auf die Teile (Mietvertrag, Exposé, Mieterliste, Paket, MFH, QC → Objekt)
     G  Gegenprobe: je eine Verdrahtung entfernt -> der zugehoerige Punkt wird rot
   RC=0 sauber, RC=1 Abweichung. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = (r) => path.join(WURZEL, r);
const lies = (r) => fs.readFileSync(F(r), 'utf8').replace(/\r\n/g, '\n');
let rot = 0, gruen = 0;
const pruefe = (ebene, name, ok, ist) => { if (ok) gruen++; else { rot++; console.log('  ROT ' + ebene + ' ' + name + (ist !== undefined ? '  (ist: ' + (typeof ist === 'string' ? ist : JSON.stringify(ist)) + ')' : '')); } return ok; };

/* ═══ A · Quick-Check ═══════════════════════════════════════════════════════════════════════════ */
function qcLaden(htmlText) {
  const a = htmlText.indexOf('  window._qcMietpotenzial = function(inputs, avm){');
  const b = htmlText.indexOf('  window._dpPilotScore = function(inputs, avm){');
  if (a < 0 || b < a) throw new Error('_qcMietpotenzial nicht gefunden');
  const quelle = htmlText.slice(a, b);
  const felder = {};
  const doc = { getElementById: (id) => (id in felder ? { value: felder[id] } : null) };
  const ctx = { document: doc, console, Math, JSON, Number, String, Object, isFinite, parseFloat, parseInt };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(F('frontend/js/mietpotenzial-kern.js'), 'utf8'), ctx, { filename: 'mietpotenzial-kern.js' });
  vm.runInContext(`var QcEngine = { num: function (v) { if (v == null || v === '') return null; var s = String(v).trim();
      if (s.indexOf(',') !== -1) s = s.replace(/\\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? null : n; } };
    function n(v){ var x = QcEngine.num(v); return (x != null && isFinite(x)) ? x : 0; }
    function _par(){ return null; } function _kappDaten(){ return null; } function _qcAgsFuer(){ return null; }
    var QcApp = { scheduleUpdate: function(){} };`, ctx);
  vm.runInContext(quelle, ctx, { filename: 'quickcheck-app.html#_qcMietpotenzial' });
  return { mp: (inp, mm, form) => {
    Object.keys(felder).forEach((k) => delete felder[k]);
    Object.assign(felder, form || {});
    if (mm) felder._mb_state = JSON.stringify({ card: { mm: { low: Math.round(mm * 0.9), med: mm, high: Math.round(mm * 1.15) } } });
    return ctx._qcMietpotenzial(inp, null);
  } };
}
const qcHtml = lies('frontend/quickcheck-app.html');
function ebeneA(html, tag) {
  let Q; try { Q = qcLaden(html); } catch (e) { return pruefe('A', tag + 'Quick-Check laedt', false, e.message); }
  const basis = { wfl: '65', plz: '32609', ort: 'Testort', bj: '1990', objektart: 'ETW' };
  const qm = (x) => Math.round(x / 65 * 100) / 100;
  const pct = (w, m) => Math.round((w / m - 1) * 100);
  /* A: alle Teile in inputs (wie qc-save) */
  let r = Q.mp(Object.assign({ nkm: '880', nkm_grund: '780', nkm_stp: '50', nkm_kueche: '30', nkm_sonst: '20' }, basis), 813);
  pruefe('A', tag + 'A Wohnung 780', r && r.grund === 780, r && r.grund);
  pruefe('A', tag + 'A Zusatz 100', r && r.zusatz === 100, r && r.zusatz);
  pruefe('A', tag + 'A 12,00 €/m² statt 13,54', r && qm(r.grund) === 12, r && qm(r.grund));
  pruefe('A', tag + 'A 4 % unter dem Mittel (813)', r && pct(r.grund, r.markt_monat) === -4, r && pct(r.grund, r.markt_monat));
  pruefe('A', tag + 'A nicht leer', r && r.leer === false, r && r.leer);
  pruefe('A', tag + 'A zulaessig in 3 J. auf die Wohnung (ist_monat 780)', r && r.zul && Math.round(r.zul.ist_monat) === 780, r && r.zul);
  pruefe('A', tag + 'A nkm_3j = Wohnung zulaessig + Zusatz', r && r.zul && Math.abs(r.nkm_3j - (r.zul.miete_monat + 100)) < 0.01, r && r.nkm_3j);
  /* A': Teile NUR im Formular (getInputs liest nur die Gesamtmiete) */
  r = Q.mp(Object.assign({ nkm: '880' }, basis), 813, { qc_nkm_grund: '780', qc_nkm_stp: '50', qc_nkm_kueche: '30', qc_nkm_sonst: '20' });
  pruefe('A', tag + "A' Teile aus dem Formular gelesen (getInputs ohne nkm_grund)", r && r.grund === 780 && r.zusatz === 100, r && [r.grund, r.zusatz]);
  /* B */
  r = Q.mp(Object.assign({ nkm: '880', nkm_grund: '880' }, basis), 813);
  pruefe('A', tag + 'B ohne Zusatz unveraendert: 13,54 €/m², 8 % ueber', r && r.grund === 880 && r.zusatz === 0 && qm(r.grund) === 13.54 && pct(r.grund, r.markt_monat) === 8, r && [r.grund, r.zusatz]);
  /* C */
  r = Q.mp(Object.assign({ nkm: '880' }, basis), 813, { qc_nkm_stp: '50', qc_nkm_kueche: '30', qc_nkm_sonst: '20' });
  pruefe('A', tag + 'C Gesamtmiete ohne Grundmiete: Wohnung = 880 - 100', r && r.grund === 780 && r.zusatz === 100, r && [r.grund, r.zusatz]);
  /* D */
  r = Q.mp(Object.assign({ nkm: '863', nkm_grund: '813', nkm_stp: '50' }, basis), 813);
  pruefe('A', tag + 'D Marktmiete + Stellplatz: leer erkannt', r && r.leer === true, r && r.leer);
  /* Box-Text */
  pruefe('A', tag + 'Box zeigt Wohnung und Zusatz getrennt', /\$\{e0\(wohn\)\} Wohnung/.test(html) && /Stellplatz, Küche, Sonstiges<\/small>/.test(html));
  pruefe('A', tag + 'Box vergleicht die Wohnung (wohn > mp.markt_monat)', /else if \(wohn > mp\.markt_monat \* 1\.03\)/.test(html));
  pruefe('A', tag + 'Balken auf die Wohnung', /\{ c: 'ist', t: 'Ist heute', v: wohn \}/.test(html));
  pruefe('A', tag + 'Kappung: einheitlicher Vertrag -> Gesamtmiete', /einem Vertrag vereinbart, gilt die Kappungsgrenze für die Gesamtmiete/.test(html));
  pruefe('A', tag + 'Score/Rendite weiter auf der Gesamtmiete (DealKpis nkm:nkm, ze:0)', /DealKpis\.compute\(\{ kp:kp, nk:kp\*knk, san:san, nkm:nkm, ze:0,/.test(html));
}
console.log('A · Quick-Check');
ebeneA(qcHtml, '');

/* ═══ B · Reiter Miete: js/ze-aufteilung.js ════════════════════════════════════════════════════ */
function seite() {
  const lst = {};
  const mk = (id, tag) => ({ id, tagName: tag || 'INPUT', value: '', readOnly: false, open: false, title: '', textContent: '',
    classList: { _s: new Set(), toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    dispatchEvent(ev) { ev.target = this; (lst[ev.type] || []).forEach((f) => f(ev)); return true; } });
  const els = {};
  ['ze', 'ze_stp_monat', 'ze_kueche_monat', 'ze_sonst_monat', 'ze-auft-stand'].forEach((id) => { els[id] = mk(id); });
  els['ze-auft'] = mk('ze-auft', 'DETAILS');
  const document = { readyState: 'complete', head: { appendChild(e) { els[e.id] = e; } },
    getElementById: (id) => els[id] || null, createElement: () => mk('', 'STYLE'),
    addEventListener: (t, f) => { (lst[t] = lst[t] || []).push(f); } };
  const ctx = { document, console, Math, String, isFinite, parseFloat, Event: function (t) { this.type = t; } };
  ctx.window = ctx;
  let geladen = 0;
  ctx.loadData = function (d) { geladen++; Object.keys(d || {}).forEach((k) => { if (els[k]) els[k].value = d[k]; }); };
  vm.createContext(ctx);
  return { ctx, els, tippe(id, v) { els[id].value = v; els[id].dispatchEvent(new ctx.Event('input')); },
    oeffne() { els['ze-auft'].open = true; els['ze-auft'].dispatchEvent(new ctx.Event('toggle')); }, geladen: () => geladen };
}
function ebeneB(quelle, tag) {
  const S = () => { const s = seite(); vm.runInContext(quelle, s.ctx, { filename: 'ze-aufteilung.js' }); return s; };
  let s;
  try { s = S(); } catch (e) { return pruefe('B', tag + 'Modul laedt', false, e.message); }
  const Z = s.ctx.DpZeAufteilung;
  pruefe('B', tag + 'Schnittstelle DpZeAufteilung', !!(Z && Z.setzen && Z.summe && Z.aufgeteilt));
  /* 1 · Altbestand: ze als Ganzes */
  s.tippe('ze', '90');
  pruefe('B', tag + '1 ohne Aufteilung bleibt ze frei und unveraendert', s.els.ze.value === '90' && !s.els.ze.readOnly);
  /* 2 · Aufklappen: der Betrag steht als Stellplatz */
  s.oeffne();
  pruefe('B', tag + '2 Aufklappen: bisheriger Betrag -> Stellplatz/Garage', s.els.ze_stp_monat.value === '90', s.els.ze_stp_monat.value);
  pruefe('B', tag + '2 dann ze gesperrt', s.els.ze.readOnly === true);
  /* 3 · Teile tippen */
  s.tippe('ze_stp_monat', '50'); s.tippe('ze_kueche_monat', '30'); s.tippe('ze_sonst_monat', '20');
  pruefe('B', tag + '3 ze = Summe der Teile (100)', s.els.ze.value === '100', s.els.ze.value);
  s.tippe('ze_kueche_monat', '12,50');
  pruefe('B', tag + '3 auf den Cent (82,5)', s.els.ze.value === '82,5', s.els.ze.value);
  /* 4 · alle Teile leer -> ze wieder frei, Summe bleibt */
  s.tippe('ze_stp_monat', ''); s.tippe('ze_kueche_monat', ''); s.tippe('ze_sonst_monat', '');
  pruefe('B', tag + '4 Teile geleert: ze frei', s.els.ze.readOnly === false, s.els.ze.readOnly);
  /* 5 · Import schreibt NUR den Stellplatz, ze hatte 80 (ungeteilt) -> Rest unter Sonstiges, nichts verloren */
  s = S(); s.tippe('ze', '80'); s.tippe('ze_stp_monat', '50');
  pruefe('B', tag + '5 Import eines Teils: ze bleibt 80, Rest 30 unter Sonstiges', s.els.ze.value === '80' && s.els.ze_sonst_monat.value === '30', [s.els.ze.value, s.els.ze_sonst_monat.value]);
  /* 6 · derselbe Stellplatz wie in ze -> kein Rest, nicht doppelt */
  s = S(); s.tippe('ze', '50'); s.tippe('ze_stp_monat', '50');
  pruefe('B', tag + '6 gleicher Betrag: ze 50, Sonstiges leer (nicht doppelt)', s.els.ze.value === '50' && s.els.ze_sonst_monat.value === '', [s.els.ze.value, s.els.ze_sonst_monat.value]);
  /* 7 · ein Skript schreibt ze, waehrend aufgeteilt ist -> gilt als Ganzes */
  s = S(); s.oeffne(); s.tippe('ze_stp_monat', '50'); s.tippe('ze_kueche_monat', '30');
  s.els.ze.value = '120'; s.els.ze.dispatchEvent(new s.ctx.Event('input'));
  pruefe('B', tag + '7 Skript schreibt ze: Aufteilung aufgehoben, ze 120 gilt', s.els.ze.value === '120' && s.els.ze_stp_monat.value === '' && s.els.ze_kueche_monat.value === '' && !s.els.ze.readOnly,
    [s.els.ze.value, s.els.ze_stp_monat.value, s.els.ze_kueche_monat.value]);
  /* 8 · setzen() (Mieterliste/Exposé nach Abgleich): ersetzt, Teile genau wie gelesen */
  s = S(); s.tippe('ze', '90'); s.ctx.DpZeAufteilung.setzen({ stp: 80, kueche: 40, sonst: 0 });
  pruefe('B', tag + '8 setzen(): ze 120 = 80 Stellplatz + 40 Kueche', s.els.ze.value === '120' && s.els.ze_stp_monat.value === '80' && s.els.ze_kueche_monat.value === '40' && s.els.ze_sonst_monat.value === '',
    [s.els.ze.value, s.els.ze_stp_monat.value, s.els.ze_kueche_monat.value, s.els.ze_sonst_monat.value]);
  /* 9 · Laden eines Objekts schreibt nichts um */
  s = S(); s.ctx.loadData({ ze: '75', ze_stp_monat: '50', ze_kueche_monat: '20', ze_sonst_monat: '' });
  pruefe('B', tag + '9 loadData: gespeicherte Werte bleiben (ze 75), ze gesperrt', s.els.ze.value === '75' && s.els.ze.readOnly === true && s.geladen() === 1, [s.els.ze.value, s.els.ze.readOnly]);
  s.ctx.loadData({ ze: '40', ze_stp_monat: '', ze_kueche_monat: '', ze_sonst_monat: '' });
  pruefe('B', tag + '9 naechstes Objekt ohne Teile: ze frei', s.els.ze.value === '40' && s.els.ze.readOnly === false);
}
console.log('B · Reiter Miete (ze-aufteilung.js)');
const zeQuelle = lies('frontend/js/ze-aufteilung.js');
ebeneB(zeQuelle, '');

/* ═══ C · Marktbericht ═════════════════════════════════════════════════════════════════════════ */
console.log('C · Marktbericht');
const SRC = F('marktbericht/backend/src');
const imp = async (r) => import(pathToFileURL(path.join(SRC, r)).href);
const ZE = await imp('lib/zusatz_einnahmen.js');
const { DealPilotObjectMapper: MAP } = await imp('services/DealPilotObjectMapper.js');
const { ErtragswertService: EWS } = await imp('services/ErtragswertService.js');
const za = ZE.zusatzAufteilen;
let z = za({ ze: '100' });
pruefe('C', 'ungeteilt: ze 100 -> 1.200 €/J. kapitalisiert, keine Kueche', z.zusatz_ertrag_jahr === 1200 && z.zusatz_aufgeteilt === false && z.sonstige_jahr == null, z);
z = za({ ze: '100', ze_stp_monat: '50', ze_kueche_monat: '30', ze_sonst_monat: '20' });
pruefe('C', 'geteilt: Stellplatz+Sonstiges 840 kapitalisiert, Kueche 360 als sonstiger Ertrag', z.zusatz_ertrag_jahr === 840 && z.sonstige_jahr === 360 && z.zusatz_stellplatz_jahr === 600 && z.zusatz_sonst_jahr === 240, z);
z = za({ ze: '120', ze_stp_monat: '50', ze_kueche_monat: '30' });
pruefe('C', 'Summe groesser als Teile: Rest 40 zaehlt als Sonstiges (nichts verloren)', z.zusatz_ertrag_jahr === 1080 && z.sonstige_jahr === 360, z);
z = za({ ze: '', ze_kueche_monat: '30', sonstige_jahr: '600' });
pruefe('C', 'Kueche kommt zu vorhandenem sonstige_jahr hinzu', z.sonstige_jahr === 960 && z.zusatz_ertrag_jahr == null, z);
/* Mapper */
const ri = MAP.reportInput({ data: { plz: '32609', ort: 'Testort', objart: 'ETW', wfl: '65', nkm: '780', ze: '100', ze_stp_monat: '50', ze_kueche_monat: '30', ze_sonst_monat: '20' } });
pruefe('C', 'Mapper reicht die Aufteilung durch', ri.zusatz_ertrag_jahr === 840 && ri.sonstige_jahr === 360 && ri.zusatz_aufgeteilt === true && ri.zusatz_stellplatz_jahr === 600,
  { z: ri.zusatz_ertrag_jahr, s: ri.sonstige_jahr, a: ri.zusatz_aufgeteilt });
const ri0 = MAP.reportInput({ data: { plz: '32609', objart: 'ETW', wfl: '65', nkm: '780', ze: '90' } });
pruefe('C', 'Mapper Altbestand: ze 90 -> 1.080 kapitalisiert (wie seit v2382)', ri0.zusatz_ertrag_jahr === 1080 && ri0.zusatz_aufgeteilt === false && ri0.sonstige_jahr == null, ri0.zusatz_ertrag_jahr);
/* Ertragswertdienst */
const bw = EWS.bodenwert({ flaeche_qm: 1, brw_sqm: 40000 });
const ein0 = { objektart: 'etw', baujahr: 1990, wohnflaeche_qm: 65, anzahl_we: 1, stichtag_jahr: 2026, miete_markt_jahr: 9360,
  lzs_pct: 3, lzs_stufe: 'A', rnd_jahre: 40, bwk_modus: 'normiert' };
const ew = (x) => EWS.ertragswert(Object.assign({}, ein0, x), bw);
const roh = (k) => { const z2 = (k.staffel || []).find((s) => /^= Rohertrag/.test(s.pos)); return z2 ? z2.wert : null; };
const kOhne = ew({});
const kUng = ew({ zusatz_jahr: 1200, zusatz_aufgeteilt: false });
pruefe('C', 'ungeteilt: Rohertrag + 1.200, Zeile „Zusätzliche Einnahmen (Stellplatz, Küche, Sonstiges)"',
  roh(kUng) === roh(kOhne) + 1200 && (kUng.staffel || []).some((s) => /^Zusätzliche Einnahmen \(Stellplatz, Küche, Sonstiges\) 100 €\/Monat/.test(s.pos)), roh(kUng) - roh(kOhne));
pruefe('C', 'ungeteilt: Hinweis auf das Aufteilen (Kueche mit eigener Dauer)', (kUng.hinweise || []).some((h) => /nicht aufgeteilt/.test(h) && /eigener Dauer/.test(h)));
const kDop = ew({ zusatz_jahr: 1200, zusatz_aufgeteilt: false, stellplatz_anz: 2, stellplatz_miete_monat: 40 });
pruefe('C', 'Doppelzaehlung: ze ersetzt 2 × 40 €, nicht dazu', roh(kDop) === roh(kOhne) + 1200, roh(kDop) - roh(kOhne));
pruefe('C', 'Doppelzaehlung: der Bericht sagt es', (kDop.hinweise || []).some((h) => /nicht zusätzlich 2 × 40 €\/Monat/.test(h) && /doppelt/.test(h)));
const kGet = ew({ zusatz_jahr: 840, zusatz_aufgeteilt: true, zusatz_stellplatz_jahr: 600, zusatz_sonst_jahr: 240, zusatz_kueche_jahr: 360, sonstige_jahr: 360, stellplatz_anz: 1, stellplatz_miete_monat: 40 });
pruefe('C', 'geteilt: 840 im Rohertrag (Stellplatz 50 ersetzt 1 × 40), Kueche nicht', roh(kGet) === roh(kOhne) + 840, roh(kGet) - roh(kOhne));
pruefe('C', 'geteilt: Kueche als sonstiger Ertrag mit eigener Dauer (15 J.)', kGet.sonstige_ertraege && kGet.sonstige_ertraege.jahr === 360 && kGet.sonstige_ertraege.dauer_jahre === 15, kGet.sonstige_ertraege);
pruefe('C', 'geteilt: Zeile nennt Kueche/Moeblierung', (kGet.staffel || []).some((s) => /sonstige Erträge \(davon Küche\/Möblierung 360 €/.test(s.pos)));
const kNull = ew({ zusatz_jahr: 240, zusatz_aufgeteilt: true, zusatz_stellplatz_jahr: 0, zusatz_sonst_jahr: 240, stellplatz_anz: 2, stellplatz_miete_monat: 40 });
pruefe('C', 'Stellplatzanteil 0: Anzahl × Miete (960) UND Sonstiges (240)', roh(kNull) === roh(kOhne) + 1200, roh(kNull) - roh(kOhne));
pruefe('C', 'Ertragswert steigt mit Zusatz, Kueche kurz', kUng.wert > kOhne.wert && kGet.wert > kOhne.wert, [kOhne.wert, kUng.wert, kGet.wert]);
/* Ist-Miete im Band: CrossCheck rechnet nkm/wfl - ze kommt dort nicht vor */
const ccs = lies('marktbericht/backend/src/services/CrossCheckService.js');
pruefe('C', 'CrossCheck: BWK-Bezugsgroesse mit derselben Regel (stellplatzErtrag)', /const _spEinnahme = stellplatzErtrag\(/.test(ccs));
pruefe('C', 'CrossCheck: Gewerbezweig traegt ze (zusatz_jahr im einG)', /\/\* v3670 · `ze` fehlte im Gewerbezweig ganz/.test(ccs));
pruefe('C', 'Orchestrator reicht die Aufteilung durch', /zusatz_aufgeteilt: input\.zusatz_aufgeteilt === true/.test(lies('marktbericht/backend/src/services/ReportOrchestrator.js')));

/* ═══ D · Verdrahtung ══════════════════════════════════════════════════════════════════════════ */
function ebeneD(Q, tag) {
  const has = (f, re, name) => pruefe('D', tag + name, re.test(Q[f]));
  has('storage', /'ze','ze_stp_monat','ze_kueche_monat','ze_sonst_monat'/, 'storage.js FIELDS speichert die Teile');
  has('storage', /'ze_stp_monat', 'ze_kueche_monat', 'ze_sonst_monat',\s+\/\/ v3670/, 'storage.js Reset (Objekt B erbt keine Teile von A)');
  has('index', /<input id="ze_stp_monat"[^>]*>[\s\S]*<input id="ze_kueche_monat"[^>]*>[\s\S]*<input id="ze_sonst_monat"/, 'index.html Felder im Aufklapper');
  has('index', /<script src="js\/ze-aufteilung\.js\?v=v3670"><\/script>/, 'index.html laedt ze-aufteilung.js');
  has('mb', /'ze', 'ze_stp_monat', 'ze_kueche_monat', 'ze_sonst_monat',/, 'Karte (dealpilot-mb.js) schickt ze und Teile');
  has('dok', /stellplatz_miete_eur: \['ze_stp_monat'/, 'Mietvertrag: Stellplatz -> Teil Stellplatz (nicht mehr ganz ze)');
  has('dok', /kueche_miete_eur: \['ze_kueche_monat'/, 'Mietvertrag: Kuechenzuschlag -> Teil Kueche');
  has('schema', /"kueche_miete_eur": number/, 'Mietvertrag-Schema liest den Kuechenzuschlag');
  has('oai', /stellplatz_miete_monat: Zahl in Euro\/MONAT/, 'Exposé-Schema liest Stellplatzmiete');
  has('oai', /'stellplatz_miete_monat', 'kueche_miete_monat', 'zusatz_miete_monat' \/\* v3670 \*\/\]\.forEach/, 'Exposé: Zusatzmieten werden uebernommen (nicht verworfen)');
  has('oa', /_merged\.ze\.kind = 'ze_teile'/, 'Exposé-Uebernahme setzt die Teile');
  has('oa', /source: 'Mieterliste', kind: 'ze_teile', teile: \{ stp: stp, kueche: kue/, 'Mieterliste: Stellplatz und Kueche getrennt');
  has('oa', /if \(it\.kind === 'ze_teile'\) \{/, '_wertSchreiben kennt ze_teile');
  has('mfh', /var _stpT = stellplatzNachziehen\(list\)/, 'MFH „Übernehmen": Stellplatzmiete der Wohnungen -> ze');
  has('ue', /M\.stellplatzNachziehen\(E\)/, 'Mietvertrag -> Einheit: Stellplatzmiete -> ze');
  has('pk', /setze\('ze_stp_monat'/, 'Paket-Import: Stellplatzmiete -> ze');
  has('qcj', /set\('ze_stp_monat', _qcWohn > 0 && _qcStp > 0/, 'QC -> Objekt: Teile statt nur Summe');
  has('qcj', /var _qcWohn = snapshot\.nkm_grund > 0 \? snapshot\.nkm_grund : \(qcZusatz > 0 && snapshot\.nkm > qcZusatz/, 'QC -> Objekt: ohne Grundmiete Wohnung = Gesamt - Teile');
}
const Q = { storage: lies('frontend/js/storage.js'), index: lies('frontend/index.html'), mb: lies('frontend/js/dealpilot-mb.js'),
  dok: lies('frontend/js/dokument-import.js'), schema: lies('backend/src/services/dokumentSchemas.js'), oai: lies('backend/src/services/openaiService.js'),
  oa: lies('frontend/js/object-actions.js'), mfh: lies('frontend/js/mfh-einheiten.js'), ue: lies('frontend/js/unterlagen-eingang.js'),
  pk: lies('frontend/js/paket-import.js'), qcj: lies('frontend/js/quick-check.js') };
console.log('D · Verdrahtung');
ebeneD(Q, '');

/* ═══ G · Gegenprobe ═══════════════════════════════════════════════════════════════════════════ */
console.log('G · Gegenprobe (je eine Stelle zurueckgebaut, erwartet ROT)');
const vorher = rot;
const still = (fn) => { const r0 = rot, g0 = gruen, l = console.log; console.log = () => {}; try { fn(); } finally { console.log = l; } const d = rot - r0; rot = r0; gruen = g0; return d; };
const gegen = [
  ['QC liest Teile nicht mehr (alte grund-Zeile)', () => ebeneA(qcHtml.replace(/var grund = _t\('nkm_grund'\)>0 \? Math\.min\(_t\('nkm_grund'\), nkm\) : \(nkm - _zt > 0 \? nkm - _zt : nkm\)/, "var grund = n(i.nkm_grund)>0 ? Math.min(n(i.nkm_grund), nkm) : nkm"), 'g ')],
  ['Box vergleicht wieder die Gesamtmiete', () => ebeneA(qcHtml.replace('else if (wohn > mp.markt_monat * 1.03)', 'else if (nkm > mp.markt_monat * 1.03)'), 'g ')],
  ['Rest-Regel im Reiter entfernt', () => ebeneB(zeQuelle.replace('if (so && v - s > 0.005)', 'if (false)'), 'g ')],
  ['Skript-Schreiben von ze ohne Wirkung', () => ebeneB(zeQuelle.replace("else if (id === 'ze') zeGeaendert();", ''), 'g ')],
  ['Karte schickt ze nicht', () => ebeneD(Object.assign({}, Q, { mb: Q.mb.replace("'ze', 'ze_stp_monat', 'ze_kueche_monat', 'ze_sonst_monat',", '') }), 'g ')],
  ['Mietvertrag-Stellplatz wieder auf ze', () => ebeneD(Object.assign({}, Q, { dok: Q.dok.replace("stellplatz_miete_eur: ['ze_stp_monat'", "stellplatz_miete_eur: ['ze'") }), 'g ')],
];
gegen.forEach(([name, fn]) => pruefe('G', 'Gegenprobe: ' + name, still(fn) > 0));
pruefe('G', 'Doppelzaehlung-Gegenprobe: ohne Ersatzregel waere der Rohertrag 960 hoeher',
  ZE.stellplatzErtrag({ stellplatz_anz: 2, stellplatz_miete_monat: 40, zusatz_jahr: 1200 }).jahr === 1200 && (1200 + 960) !== 1200);
void vorher;

console.log((rot ? 'RC=1 ' + rot + ' rot, ' : 'RC=0 sauber, ') + gruen + ' gruen');
process.exit(rot ? 1 : 0);
