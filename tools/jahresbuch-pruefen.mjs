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
{
  let fragen = [];
  const c2 = kontext({ _currentObjData: { _jahre: { '2024': { steuer_status: 'bescheid' }, '2025': { steuer_status: 'erklaert' } } },
    confirm: (t) => { fragen.push(t); return false; } });
  vm.runInContext(lies('frontend/js/jahresbuch.js'), c2);
  const B = c2.DpJahresbuch;
  ok(JSON.stringify(B.jahreVon(2023, 2026)) === '[2026,2025,2024,2023]', 'J Jahre vom Kauf bis heute, jüngstes zuerst');
  ok(B.jahreVon(null, 2026).length === 0 && B.jahreVon(2027, 2026).length === 0, 'J ohne Kaufjahr oder Kauf in der Zukunft: keine Jahre');
  ok(B.summeEinheiten({ '0': { miete_m: 500 }, '1': { miete_m: 600, leer_monate: 3 } }) === 500 * 12 + 600 * 9, 'J Summe der Wohnungen mit Leerstand');
  ok(B.summeEinheiten({}) === null, 'J ohne Wohnungsangaben kein Vorschlag');
  const z1 = B.zeile({ jahr: 2025, plan: { nkm_y: 12000, cfop_y: 1500, rs: 180000 }, ist: { nkm_j: '11.400', rs_ist: 178000 }, av: { wert: 12000, eigen: false } });
  ok(z1.miete_ist === 11400 && z1.miete_abw === -600 && z1.rs_abw === -2000, 'J Abweichung Miete und Restschuld gegen den Plan');
  ok(z1.abgleich && z1.abgleich.art === 'vorschlag', 'J Anlage V nur Vorschlag: Ist-Miete wird angeboten, nicht übernommen (E7)');
  const z2 = B.zeile({ jahr: 2025, ist: { nkm_j: 11400 }, av: { wert: 11000, eigen: true } });
  ok(z2.abgleich.art === 'abweichung' && /maßgeblich/.test(z2.abgleich.text), 'J eigene Anlage V weicht ab: Hinweis, keine Angleichung');
  const z3 = B.zeile({ jahr: 2025, ist: { nkm_j: 11400 }, av: { wert: 11400.4, eigen: true } });
  ok(z3.abgleich.art === 'gleich', 'J gleich bis 1 €');
  ok(B.zeile({ jahr: 2025, ist: {}, av: { wert: 1, eigen: true } }).abgleich === null, 'J ohne Ist-Miete kein Abgleich');
  ok(B.zeile({ jahr: 2025, ist: { nkm_j: 13800 }, ziel_nkm: 1150 }).ziel_erreicht === true && B.zeile({ jahr: 2025, ist: { nkm_j: 13000 }, ziel_nkm: 1150 }).ziel_erreicht === false, 'J Ziel erreicht nur als Vorschlag ab Ist ≥ Ziel');
  const s1 = B.setzen({}, 2025, 'nkm_j', 11400);
  ok(s1['2025'].nkm_j === 11400 && !!s1['2025'].geaendert_am, 'J setzen');
  ok(!('2025' in B.setzen(s1, 2025, 'nkm_j', '')), 'J leerer Wert räumt das Jahr ab');
  ok(B.status(2024) === 'bescheid' && B.status(2023) === 'geplant', 'J Status je Jahr, fehlt = geplant');
  ok(B.aenderungErlaubt(2024) === false && fragen.length === 1 && /Bescheid/.test(fragen[0]), 'J Bescheid: Nachfrage, Nein lässt die Zelle stehen (E6)');
  ok(B.aenderungErlaubt(2023) === true && fragen.length === 1, 'J geplant: keine Nachfrage');
  const tax = lies('frontend/js/tax.js');
  const iU = tax.indexOf('function updateTaxOverride'), iA = tax.indexOf('DpJahresbuch.aenderungErlaubt(year)', iU), iS = tax.indexOf('_setYearOverride(year, field, val)', iU);
  ok(iU > 0 && iA > iU && iS > iA, 'J tax.js fragt vor dem Ändern einer Zelle');
  ok(/add\('jahre', 'Jahre'/.test(lies('frontend/js/pilot-analyse-v4.js')), 'J Unterreiter Jahre in der Pilot-Analyse');
  ok(/k === '_jahre'/.test(lies('frontend/js/ankauf.js')) || /'_jahre'\) continue/.test(lies('frontend/js/ankauf.js')), 'J ankauf.js friert _jahre nicht ein');
  ok(!/(^|[^a-z])_jahre\b|DpJahresbuch/.test(lies('frontend/js/calc.js')), 'J calc.js liest das Jahresbuch nicht (Paket 5 wartet auf E4)');
  ok(/js\/jahresbuch\.js\?v=/.test(lies('frontend/index.html')), 'J index.html lädt jahresbuch.js');
}

/* ── G ── Verlaufsgrafik (v3364, jahresbuch-grafik.js) */
{
  const c3 = kontext();
  vm.runInContext(lies('frontend/js/jahresbuch-grafik.js'), c3);
  const Gr = c3.DpJahresbuchGrafik;
  const d = { heute: 2026, ereignisse: [{ jahr: 2023, monat: 7, art: 'erhoehung', text: 'Mieterhöhung' }, { jahr: 2024, monat: 3, art: 'zielbild', kurz: 'neues Zielbild', text: 'Wechsel' }], jahre: [] };
  for (let y = 2021; y <= 2029; y++) d.jahre.push({ jahr: y, miete_plan: 9600 + (y - 2021) * 200, miete_ist: y <= 2025 ? 9600 + (y - 2021) * 250 : null, miete_proj: y >= 2026 ? 10800 : null, ziel_j: y < 2024 ? 12000 : 13200, cf_plan: 1500, cf_ist: y <= 2025 ? (y === 2022 ? -350 : 1200) : null });
  const svg = Gr.svg(d);
  ok(/Kaltmiete je Jahr/.test(svg) && /Cashflow vor Steuer je Jahr/.test(svg), 'G zwei Bilder über derselben Jahresachse');
  ok((svg.match(/stroke:var\(--jbg-flaeche/g) || []).length === 5, 'G fünf gefüllte Ist-Punkte (2021-2025)');
  ok((svg.match(/fill:var\(--jbg-flaeche, #FDFCFA\);stroke:var\(--wl-c9a84c/g) || []).length === 4, 'G vier hohle Punkte der Projektion (2026-2029)');
  ok((svg.match(/data-jbg-i=/g) || []).length === 9, 'G Trefferflächen je Jahr für das Kästchen');
  const ohneToken = (lies('frontend/js/jahresbuch-grafik.js') + lies('frontend/js/jahresbuch.js') + lies('frontend/js/zielbild-fassungen.js') + lies('frontend/js/mieterhoehungen.js')).replace(/var\(--wl-c9a84c, #C9A84C\)/g, '');
  ok(!/#C9A84C|#E8CC7A|#b8932f/i.test(ohneToken), 'G Gold nur über var(--wl-c9a84c) (gold-audit)');
  ok(Gr.svg({ jahre: [d.jahre[0]] }) === '', 'G mit einem Jahr kein Bild');
  ok(/data-dp-jb-grafik/.test(lies('frontend/js/jahresbuch.js')) && /js\/jahresbuch-grafik\.js\?v=/.test(lies('frontend/index.html')), 'G eingebaut im Unterreiter Jahre');
}

console.log(`jahresbuch-pruefen (v3362, v3363, v3364): ${gruen} von ${gruen + rot} ok`);
process.exit(rot ? 1 : 0);
