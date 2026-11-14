#!/usr/bin/env node
/* v3362 · Mieterhöhungsliste (frontend/js/mieterhoehungen.js) und ab v3363 das Jahresbuch
 * (frontend/js/jahresbuch.js) an den ECHTEN Dateien, ohne Browser.
 *
 *  E  Erhöhungen: ableiten (jüngste § 558/Staffel/Index setzt „Letzte Erhöhung", § 559 und Neuvermietung
 *     nicht; Betrag = jüngste § 558; Drei-Jahres-Summe nur als Hinweis), mieteAm, imJahr, eintragAus
 *     (Pflichtfelder), ausVertrag (Vorbelegung nur aus vorhandenen Feldern).
 *  K  Der Kern bleibt: mietpotenzial-kern.js liest die Liste NICHT (Paket 7 wartet auf E5).
 *  J  Jahresbuch (ab v3363, siehe unten).
 *
 * Aufruf: node tools/jahresbuch-pruefen.mjs   (RC=0 sauber) */
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
    CustomEvent: function () {}, document: { getElementById: () => null, addEventListener() {}, head: null, createElement: () => ({}) },
    addEventListener() {}, dispatchEvent() {} }, extra);
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

/* ── E ──────────────────────────────────────────────────────── */
const ctx = kontext();
vm.runInContext(lies('frontend/js/mieterhoehungen.js'), ctx);
const E = ctx.DpErhoehungen;
{
  const L = [
    { id: 'a', datum: '2022-04-01', art: '558', von: 600, auf: 640 },
    { id: 'b', datum: '2024-07-01', art: '558', von: 640, auf: 690 },
    { id: 'c', datum: '2025-03-01', art: '559', von: 690, auf: 740 },
    { id: 'd', datum: '2025-10-01', art: '558', von: 740, auf: 770 }
  ];
  const a = E.ableiten(L, '2026-11-14');
  ok(a.letzte === '2025-10-01', 'E letzte = jüngste § 558 (' + a.letzte + ')');
  ok(a.betrag === 30, 'E Betrag = jüngste § 558 (' + a.betrag + ')');
  ok(a.n558_3j === 2 && a.summe558_3j === 80, 'E Drei-Jahres-Summe nur § 558 nach dem 14.11.2023 (' + a.n558_3j + ', ' + a.summe558_3j + ')');
  const b = E.ableiten([{ datum: '2025-03-01', art: '559', von: 690, auf: 740 }], '2026-11-14');
  ok(b.letzte === null && b.betrag === null, 'E nur § 559: setzt die Jahressperre nicht (§ 558 Abs. 1 Satz 3)');
  const c = E.ableiten([{ datum: '2024-01-01', art: '558', von: 500, auf: 540 }, { datum: '2025-06-01', art: 'neuvermietung', von: 540, auf: 700 }], '2026-11-14');
  ok(c.letzte === '2024-01-01' && c.miete_zuletzt === 700, 'E Neuvermietung zählt nicht als Erhöhung, Miete zuletzt 700');
  const d = E.ableiten([{ datum: '2025-01-01', art: 'index', von: 800, auf: 824 }], '2026-11-14');
  ok(d.letzte === '2025-01-01' && d.betrag === null, 'E Indexmiete setzt die Frist, keinen § 558-Betrag');
  ok(E.ableiten([], '2026-11-14').letzte === null, 'E leere Liste: nichts abgeleitet (Felder bleiben)');
  ok(E.mieteAm(L, '2024-12-31') === 690 && E.mieteAm(L, '2022-01-01') === null && E.mieteAm(L, '2026-01-01') === 770, 'E mieteAm');
  ok(E.imJahr(L, 2025).length === 2 && E.imJahr(L, 2023).length === 0, 'E imJahr');
  ok(!!E.eintragAus({ datum: '', auf: '700' }).fehler, 'E ohne Datum abgewiesen');
  ok(!!E.eintragAus({ datum: '2026-01-01', auf: '' }).fehler, 'E ohne neue Miete abgewiesen');
  const n = E.eintragAus({ datum: '2026-01-01', art: 'xyz', von: '650,50', auf: '1.050' });
  ok(n.eintrag && n.eintrag.art === '558' && n.eintrag.von === 650.5 && n.eintrag.auf === 1050, 'E Zahlen deutsch gelesen, unbekannte Art = § 558');
  const v = E.ausVertrag('2024-04-01', '35', '735');
  ok(v && v.von === 700 && v.auf === 735 && v.art === '558', 'E Vorbelegung aus Vertragsfeldern');
  ok(E.ausVertrag('', '35', '735') === null, 'E ohne Datum keine Vorbelegung');
}

/* ── K ──────────────────────────────────────────────────────── */
{
  const kern = lies('frontend/js/mietpotenzial-kern.js');
  ok(!/erhoehungen/.test(kern), 'K mietpotenzial-kern.js liest die Liste nicht (Paket 7 offen)');
  const mfh = lies('frontend/js/mfh-einheiten.js');
  ok(/DpErhoehungen\.einheitBinden/.test(mfh) && /mfh-we-erh-liste/.test(mfh), 'K Wohnungsfenster bindet die Liste');
  const html = lies('frontend/index.html');
  ok(/js\/mieterhoehungen\.js\?v=/.test(html), 'K index.html lädt mieterhoehungen.js');
}

/* ── J ── (Jahresbuch, ab v3363) */

console.log(`jahresbuch-pruefen (v3362): ${gruen} von ${gruen + rot} ok`);
process.exit(rot ? 1 : 0);
