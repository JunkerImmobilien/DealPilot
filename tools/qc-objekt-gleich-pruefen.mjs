#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   qc-objekt-gleich-pruefen.mjs   (v3339)

   WOZU: Quick-Check und das daraus gespeicherte Objekt rechnen mit DEMSELBEN
   Kern (DealKpis.compute -> DealScore.computeFromKpis). Am 12.11.2026 zeigten
   sie trotzdem verschiedene Zahlen (Am Quittengarten 12, 80 % Beleihung):

     Quick-Check      Score 72 · DSCR 1,16 · NMR 5,2 %
     Objekt/Bank-PDF  Score 73 · DSCR 1,21 · NMR 5,37 %

   Ursache waren die EINGABEN, nicht der Kern:
     a) die Garagen der Mieterliste (_merged.ze, 6 x 40 EUR) gingen nur an das
        spaetere Objekt, nicht in den Quick-Check (OBJ2QC ohne ze),
     b) der Leerstand aus den Einstellungen (2 %, v3030) zog nur im Objekt ab,
        _dpPilotScore rief DealKpis.compute ohne leerstand_pct.

   WIE: die ECHTEN Dateien werden geladen bzw. ausgeschnitten, nichts nachgebaut:
     A  _dpPilotScore und _qcLeerstandPct aus quickcheck-app.html (vm), dazu
        deal-kpis.js, dscr-engine.js, score-tiers.js, qc-heuristik.js, dealscore.js
        Quick-Check-Eingaben wie nach dem Import (Miete = Wohnungen + Garagen als
        Einzelposten, Hausgeld gesamt + Anteil) gegen die Objekt-Eingaben
        (nkm + ze, hg_ul/hg_nul, Leerstand 2 %) -> Score gleich, DSCR und NMR
        hoechstens um die Rundung des Hausgeld-Anteils (ganze Prozent) verschieden.
     B  object-actions.js: OBJ2QC fuehrt ze -> qc_nkm_sonst; quick-check.js gibt
        qc_nkm_sonst beim Speichern als ze zurueck (Rueckweg).
     C  pdf-import.js (Exposé-Fotos): _woerterIn/_textPunkte echt gerechnet; jede
        Ganzseiten-Rueckgabe und jeder Zuschnitt aus der gerenderten Seite laeuft
        ueber die Textpruefung, der Notfall-Pfad nimmt keine Textseite.

   Aufruf: node tools/qc-objekt-gleich-pruefen.mjs [--qc=<andere quickcheck-app.html>]
   RC=0 sauber, RC=1 rot. Gegenprobe gegen den Stand vor v3339 muss ROT sein.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const JS = (f) => path.join(WURZEL, 'frontend/js', f);
const arg = (n) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const QC_DATEI = arg('qc') || path.join(WURZEL, 'frontend/quickcheck-app.html');
const OA_DATEI = arg('oa') || JS('object-actions.js');
const PI_DATEI = arg('pi') || JS('pdf-import.js');

let rot = 0, gruen = 0;
const ok = (b, t) => { if (b) { gruen++; console.log('  \x1b[32mOK\x1b[0m  ' + t); } else { rot++; console.log('  \x1b[31mROT\x1b[0m ' + t); } };

function fenster(profil) {
  const f = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, setTimeout() {}, clearTimeout() {},
    localStorage: { getItem() { return null; }, setItem() {} },
    DealPilotInvestmentProfile: { get: (k) => (profil || {})[k] } };
  f.window = f; f.self = f; f.parent = f;
  f.document = { readyState: 'complete', addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; }, head: { appendChild() {} }, body: { appendChild() {} } };
  return vm.createContext(Object.assign(f, { console, Math, JSON, Number, String, Object, Array, isFinite, parseFloat, parseInt, RegExp, Promise, Date }));
}
const lies = (d) => fs.readFileSync(d, 'utf8').replace(/\r\n/g, '\n');   /* gemischte Zeilenenden (autocrlf) */
const lade = (ctx, datei) => vm.runInContext(lies(datei), ctx, { filename: path.basename(datei) });

/* ── A · Quick-Check gegen Objekt ─────────────────────────────────────── */
console.log('A · Quick-Check (_dpPilotScore) gegen Objekt (DealKpis), Am Quittengarten 12, 80 %');
const qcQuelle = lies(QC_DATEI);
const bloecke = [...qcQuelle.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const blockPilot = bloecke.filter((b) => /window\._dpPilotScore\s*=\s*function/.test(b));
ok(blockPilot.length === 1, 'genau ein Block mit window._dpPilotScore (' + blockPilot.length + ')');
const leerSchnitt = qcQuelle.match(/window\._qcLeerstandPct = function \(\) \{[\s\S]*?\n\};/g) || [];

const NK = 83768, KP = 740000, D1 = 592000;
const ctx = fenster({ leerstand_pct: 2 });
['dscr-engine.js', 'deal-kpis.js', 'score-tiers.js', 'qc-heuristik.js', 'dealscore.js'].forEach((f) => lade(ctx, JS(f)));
ctx._qcKnkPct = () => NK / KP * 100;   /* dieselben Nebenkosten wie das Objekt - der Pruefer misst Miete und Leerstand */
if (leerSchnitt.length === 1) vm.runInContext(leerSchnitt[0], ctx);
ok(leerSchnitt.length === 1, '_qcLeerstandPct genau einmal in quickcheck-app.html (' + leerSchnitt.length + ')');
if (blockPilot.length === 1) vm.runInContext(blockPilot[0], ctx);

/* Objekt: so wie es nach „Als Objekt speichern" dasteht (gemessen 12.11.2026, Objekt A) */
const OBJ = ctx.DealKpis.compute({ kp: KP, nk: NK, san: 0, nkm: 4240, ze: 240, bwk_ul: 25166, bwk_nul: 8434, d1: D1, d1z: 4.69, d1t: 1.5,
  ek: KP + NK - D1, svw: 0, afa: 0, grenz: 0, ekInklNkLtv: false, leerstand_pct: 2 });
const objScore = ctx.DealScore.computeFromKpis({ kp: KP, cf_m: OBJ.cf_m, nmy: OBJ.nmy, ltv: OBJ.ltv, dscr: OBJ.dscr, wp_kpi: 0 }).score;
/* der Score haengt an den Gewichten des Kontos (im App-Lauf 73 mit der Vorlage des Demo-Kontos) - verglichen wird deshalb nur QC gegen Objekt im selben Kontext */
ok(Math.abs(OBJ.dscr - 1.2076) < 0.0005 && Math.abs(OBJ.nmy - 5.3718) < 0.001, 'Objekt rechnet wie im App-Lauf gemessen: DSCR ' + OBJ.dscr.toFixed(4) + ' (1,2076), NMR ' + OBJ.nmy.toFixed(4) + ' (5,3718)');

/* Quick-Check nach dem Import: Wohnungen 4.240 + Garagen 240 als Einzelposten -> qc_nkm 4.480 (mieteAddUp),
   Hausgeld (25.166 + 8.434) / 12 = 2.800, Anteil round(8434 / 33600 * 100) = 25 (object-actions.js) */
const QC = typeof ctx._dpPilotScore === 'function'
  ? ctx._dpPilotScore({ kp: '740000', nkm: '4480', nkm_grund: '4240', hg: '2800', hg_split: '25', ek: String(KP + NK - D1), zins: '4,69', tilg: '1,5', wfl: '560', plz: '' }, null)
  : null;
if (QC && QC.kpi) {
  console.log('      Objekt    Score ' + objScore + ' · DSCR ' + OBJ.dscr.toFixed(3) + ' · NMR ' + OBJ.nmy.toFixed(3) + ' %');
  console.log('      QuickChk  Score ' + QC.score + ' · DSCR ' + QC.kpi.dscr + ' · NMR ' + QC.kpi.nmr + ' % · Leerstand ' + QC.kpi.leerPct + ' %');
  ok(QC.score === objScore, 'Score gleich (' + QC.score + ' / ' + objScore + ')');
  ok(Math.abs(QC.kpi.dscr - Math.round(OBJ.dscr * 100) / 100) <= 0.01, 'DSCR gleich auf zwei Stellen (± Rundung des Anteils)');
  ok(Math.abs(QC.kpi.nmr - Math.round(OBJ.nmy * 10) / 10) <= 0.1, 'NMR gleich auf eine Stelle');
  ok(QC.kpi.leerPct === 2 && QC.kpi.leerY === Math.round(4480 * 12 * 0.02), 'Leerstand 2 % aus den Einstellungen im Quick-Check (' + QC.kpi.leerY + ' EUR/Jahr)');
} else ok(false, '_dpPilotScore liefert kein Ergebnis');
/* ohne Einstellung bleibt es bei 0 (wie main.js setDefaults ohne Profil) */
const ctx0 = fenster({});
if (leerSchnitt.length === 1) { vm.runInContext(leerSchnitt[0], ctx0); ok(ctx0._qcLeerstandPct() === 0, 'ohne Profilwert Leerstand 0'); }

/* ── B · Abbildung und Rueckweg der Zusatzeinnahmen ───────────────────── */
console.log('B · Garagen/Stellplaetze der Mieterliste in den Quick-Check und zurueck');
const oa = lies(OA_DATEI);
const obj2qc = (oa.match(/var OBJ2QC = \{[\s\S]*?\};/) || [''])[0];
ok(/(^|[\s,{])ze:\s*'qc_nkm_sonst'/.test(obj2qc), "OBJ2QC fuehrt ze -> 'qc_nkm_sonst'");
ok(/_merged\.ze = \{/.test(oa), 'object-actions.js legt _merged.ze aus der Mieterliste an (Quelle der Zeile)');
const qcjs = lies(JS('quick-check.js'));
ok(/qcZusatz = \(snapshot\.nkm_stp[\s\S]{0,140}snapshot\.nkm_sonst/.test(qcjs) && /set\('ze', String\(Math\.round\(qcZusatz\)\)\)/.test(qcjs), 'quick-check.js schreibt nkm_sonst beim Speichern als ze ins Objekt');

/* ── C · Exposé-Seiten sind keine Fotos ───────────────────────────────── */
console.log('C · Bildgewinnung aus PDFs (pdf-import.js)');
const pi = lies(PI_DATEI);
const fnText = (pi.match(/function _textPunkte\(content, vp\) \{[\s\S]*?\n  \}/) || [])[0];
const fnIn = (pi.match(/function _woerterIn\(pts, x, y, w, h\) \{[\s\S]*?\n  \}/) || [])[0];
const max = (pi.match(/var BILD_MAX_WOERTER = (\d+);/) || [])[1];
ok(fnText && fnIn && max, '_textPunkte, _woerterIn und BILD_MAX_WOERTER vorhanden' + (max ? ' (' + max + ')' : ''));
if (fnText && fnIn) {
  const c = vm.createContext({});
  vm.runInContext(fnText + '\n' + fnIn, c);
  const vp = { scale: 2, convertToViewportPoint: (x, y) => [x * 2, (842 - y) * 2] };
  const pts = c._textPunkte({ items: [{ str: '790.000 €', transform: [1, 0, 0, 1, 50, 400], width: 60, height: 14 }, { str: 'Kaufpreis', transform: [1, 0, 0, 1, 50, 385], width: 40, height: 8 }, { str: '', transform: [1, 0, 0, 1, 0, 0] }] }, vp);
  ok(pts.length === 2 && pts[0].n === 2 && Math.abs(pts[0].x - 160) < 1e-9 && Math.abs(pts[0].y - 870) < 1e-9, 'Textpunkte in Canvas-Pixeln (Mitte des Stuecks, y von oben)');
  ok(c._woerterIn(pts, 0, 800, 400, 200) === 3 && c._woerterIn(pts, 0, 0, 400, 500) === 0 && c._woerterIn(null, 0, 0, 1, 1) === 0, 'Woerter im Ausschnitt gezaehlt, ausserhalb nicht');
}
const split = (pi.match(/function _splitPageIntoPhotos\(canvas, pts\) \{[\s\S]*?\n  \}\n/) || [''])[0];
ok(!!split, '_splitPageIntoPhotos nimmt die Textpunkte (canvas, pts)');
ok(split && !/return \[canvas\.toDataURL/.test(split) && (split.match(/return _ganz\(\)/g) || []).length === 3, 'alle drei Ganzseiten-Rueckgaben laufen ueber die Textpruefung');
ok(split && !/_cropCanvasToDataURL\(canvas/.test(split.replace(/var _schnitt = function[^\n]*\n/, '')), 'jeder Zuschnitt laeuft ueber _schnitt (Textpruefung)');
ok(/_splitPageIntoPhotos\(canvas, _textPunkte\(content, vp\)\)/.test(pi), 'die Heuristik gibt die Textpunkte ihrer Seite mit');
ok(/if \(wordCount > BILD_MAX_WOERTER\) continue;\s+\/\/ v3339/.test(pi) && !/wordCount > 250/.test(pi), 'Notfall-Pfad nimmt keine Textseite mehr (war > 250 Woerter)');

console.log('\n' + (rot ? '\x1b[31mROT\x1b[0m ' + rot : '\x1b[32mSAUBER\x1b[0m') + ' · ' + gruen + ' Punkte gruen');
process.exit(rot ? 1 : 0);
