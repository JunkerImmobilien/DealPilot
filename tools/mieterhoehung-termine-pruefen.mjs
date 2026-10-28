#!/usr/bin/env node
/* tools/mieterhoehung-termine-pruefen.mjs · v3028 — Prüfstrecke „verlangbar ab · wirksam ab"

   Marcel 28.10.2026 („ja, mach das so"): „sofort" hieß nur, dass das Erhöhungsverlangen
   jetzt gestellt werden darf. Getrennt ausgewiesen werden seither
     verlangbar ab   frühester Zugang des Verlangens / der Erklärung
     wirksam ab      Beginn der Zahlungspflicht
   Wortlaut (gesetze-im-internet.de, gelesen 28.10.2026):
     § 558 Abs. 1 S. 2  „Das Mieterhöhungsverlangen kann frühestens ein Jahr nach der letzten
                         Mieterhöhung geltend gemacht werden."
     § 558b Abs. 1      „… mit Beginn des dritten Kalendermonats nach dem Zugang des Erhöhungsverlangens."
     § 559b Abs. 2      „… mit Beginn des dritten Monats nach dem Zugang der Erklärung."
     § 557b Abs. 3      „… mit Beginn des übernächsten Monats nach dem Zugang der Erklärung …"

   Geprüft an den ECHTEN Dateien:
     A  frontend/js/potenzial.js  wirksamNachZugang() - Zugangstage, Jahresgrenze
     B  frontend/js/potenzial.js  mhTermine()         - Sperrfrist, sofort, eigene Angabe
     C  frontend/js/potenzial.js  sollFuer()          - die Wohnung trägt beide Termine (Uhr fest 28.10.2026)
     D  backend objektWissen.js   potenzial()         - liest die gespeicherten Felder, Jahressumme nur ab wirksam
     E  backend objektWissen.js   _altTermin()        - alter Speicherstand gibt dasselbe wie mhTermine()
     F  Quelltext: kein „sofort" mehr als Wirksamkeitstermin; Pilot-Regel an beiden Stellen
   RC=0 sauber, RC=1 Abweichung. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE_FE = path.join(WURZEL, 'frontend/js/potenzial.js');

let fehler = 0, n = 0;
function gleich(name, ist, soll) {
  n++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) { fehler++; console.log('  FEHLER ' + name + ': ist ' + JSON.stringify(ist) + ', soll ' + JSON.stringify(soll)); }
}

/* ── potenzial.js im vm laden, Uhr fest auf 28.10.2026 ─────────────────── */
const ECHT = Date;
class FestDate extends ECHT {
  constructor(...a) { if (a.length) super(...a); else super(2026, 9, 28, 12, 0, 0); }
  static now() { return new ECHT(2026, 9, 28, 12, 0, 0).getTime(); }
}
const stubEl = () => null;
const fenster = {
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout() {}, clearTimeout() {}, innerWidth: 1280
};
const dokument = {
  readyState: 'loading', addEventListener() {}, getElementById: stubEl, querySelector: stubEl,
  querySelectorAll() { return []; }, createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
  head: { appendChild() {} }, body: { appendChild() {} }
};
fenster.window = fenster; fenster.document = dokument;
const ctx = vm.createContext(Object.assign(fenster, { Date: FestDate, console, Math, JSON, Number, String, Object, Array, isFinite, parseFloat, parseInt, RegExp, Promise }));
vm.runInContext(fs.readFileSync(QUELLE_FE, 'utf8'), ctx, { filename: 'potenzial.js' });
const P = ctx.DpPotenzial;
if (!P || !P.mhTermine) { console.log('ABBRUCH: DpPotenzial.mhTermine fehlt'); process.exit(2); }

/* ── A · Zugang → wirksam (Tagesgenau gefragt, monatsgenau beantwortet) ── */
gleich('A § 558b Zugang 15.10. → 01.01.', P.wirksamNachZugang('2026-10-15', '558'), '2027-01-01');
gleich('A § 558b Zugang 31.10. → 01.01.', P.wirksamNachZugang('2026-10-31', '558'), '2027-01-01');
gleich('A § 558b Zugang 01.11. → 01.02.', P.wirksamNachZugang('2026-11-01', '558'), '2027-02-01');
gleich('A § 558b Zugang 30.09. → 01.12. (noch im Jahr)', P.wirksamNachZugang('2026-09-30', '558'), '2026-12-01');
gleich('A § 559b Zugang 15.10. → 01.01.', P.wirksamNachZugang('2026-10-15', '559'), '2027-01-01');
gleich('A § 559b Zugang 01.11. → 01.02.', P.wirksamNachZugang('2026-11-01', '559'), '2027-02-01');
gleich('A § 557b Zugang 15.10. → 01.12.', P.wirksamNachZugang('2026-10-15', '557b'), '2026-12-01');
gleich('A § 557b Zugang 10.11. → 01.01. (Jahresgrenze)', P.wirksamNachZugang('2026-11-10', '557b'), '2027-01-01');
gleich('A § 557b Zugang 31.12. → 01.02.', P.wirksamNachZugang('2026-12-31', '557b'), '2027-02-01');

/* ── B · mhTermine, heute = 10/2026 ─────────────────────────────────────── */
const H = '2026-10';
let t = P.mhTermine({ art: '558', letzte: '2025-03-01', heute: H });
gleich('B1 letzte 03/2025: verlangbar sofort', [t.verlangbar_ab, t.verlangbar_sofort], ['2026-10', true]);
gleich('B1 wirksam 01/2027', t.wirksam_ab, '2027-01');
gleich('B1 Text', t.text, 'verlangbar ab sofort · wirksam ab 01/2027');
gleich('B1 Zugang heute benannt', t.text_lang, 'verlangbar ab sofort · wirksam ab 01/2027 (Zugang heute angenommen, § 558b Abs. 1 BGB)');
t = P.mhTermine({ art: '558', letzte: '2026-01-01', heute: H });
gleich('B2 letzte 01/2026: verlangbar 01/2027 (§ 558 Abs. 1 S. 2)', [t.verlangbar_ab, t.verlangbar_sofort], ['2027-01', false]);
gleich('B2 wirksam 04/2027 (= letzte + 15)', t.wirksam_ab, '2027-04');
gleich('B2 Text', t.text, 'verlangbar ab 01/2027 · wirksam ab 04/2027');
t = P.mhTermine({ art: '558', letzte: '2025-10-01', heute: H });
gleich('B3 letzte 10/2025: genau ein Jahr → sofort, wirksam 01/2027', [t.verlangbar_sofort, t.wirksam_ab], [true, '2027-01']);
t = P.mhTermine({ art: '558', heute: H });
gleich('B4 ohne letzte: sofort + Sperre ungeprüft', [t.verlangbar_sofort, t.wirksam_ab, t.letzte_fehlt], [true, '2027-01', true]);
t = P.mhTermine({ art: '558', letzte: '2025-03', wirksam_eigen: '2027-06', heute: H });
gleich('B5 eigene Angabe später: gilt', [t.wirksam_ab, t.eigene_angabe, t.hinweis], ['2027-06', true, null]);
t = P.mhTermine({ art: '558', letzte: '2025-03', wirksam_eigen: '2026-11', heute: H });
gleich('B6 eigene Angabe zu früh: gilt, mit Hinweis', [t.wirksam_ab, !!t.hinweis], ['2026-11', true]);
t = P.mhTermine({ art: '559', letzte: '2026-08-01', heute: H });
gleich('B7 § 559 ohne Jahressperre: sofort, wirksam 01/2027', [t.verlangbar_sofort, t.wirksam_ab, t.norm], [true, '2027-01', '§ 559b Abs. 2 BGB']);
t = P.mhTermine({ art: '557b', letzte: '2026-01-01', heute: H });
gleich('B8 § 557b: Erklärung 11/2026, wirksam 01/2027 (ein Jahr unverändert)', [t.verlangbar_ab, t.wirksam_ab], ['2026-11', '2027-01']);
t = P.mhTermine({ art: '558', letzte: '2025-03', heute: '2026-12' });
gleich('B9 Jahresgrenze: heute 12/2026 → wirksam 03/2027', t.wirksam_ab, '2027-03');

/* ── C · sollFuer: die Wohnung trägt beide Termine (Uhr 28.10.2026) ───── */
let s = P.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', mv_letzte_erhoehung: '2025-03-01' }, { kapp: { pct: 20 }, vgl_qm: 10 });
gleich('C1 Soll-Miete 600 (§ 558)', [s.miete, s.herkunft], [600, 'gerechnet (§ 558)']);
gleich('C1 ab = wirksam', [s.ab, s.verlangbar_ab], ['2027-01', '2026-10']);
gleich('C1 ab_text', s.ab_text, 'verlangbar ab sofort · wirksam ab 01/2027');
gleich('C1 kein nacktes „sofort"', /^sofort/.test(s.ab_text), false);
s = P.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', mv_letzte_erhoehung: '2026-01-01' }, { kapp: { pct: 20 }, vgl_qm: 10 });
gleich('C2 letzte 01/2026', s.ab_text, 'verlangbar ab 01/2027 · wirksam ab 04/2027');
s = P.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', soll: '640', soll_ab: '2027-05', mv_letzte_erhoehung: '2025-03-01' }, { kapp: { pct: 20 }, vgl_qm: 10 });
gleich('C3 eigene Soll-Miete und eigener Termin', [s.miete, s.ab, s.termine.verlangbar_sofort], [640, '2027-05', true]);

/* ── D · objektWissen liest die gespeicherten Felder ─────────────────── */
const OW = require(path.join(WURZEL, 'backend/src/services/objektWissen.js'));
const sA = P.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', mv_letzte_erhoehung: '2025-03-01' }, { kapp: { pct: 20 }, vgl_qm: 10 });
const gespeichert = (w, nr) => ({ nr, ist: 500, soll: Math.round(w.miete), soll_ab: w.ab_text, soll_herkunft: w.herkunft,
  soll_verlangbar_ab: w.termine.verlangbar_ab, soll_verlangbar_sofort: w.termine.verlangbar_sofort, soll_wirksam_ab: w.termine.wirksam_ab, soll_termin: w.termine.text_lang });
const datenD = { _potenzial: { zusammenfassung: { stand: '2026-10-28', wohnungen: [gespeichert(sA, '1'),
  { nr: '2', ist: 800, index: { miete: 840, ab: '2026-12', erklaerung_ab: '2026-10' } }] } } };
const heute = new ECHT(2026, 9, 28);
let p = OW.potenzial(datenD, 2026, heute);
const m1 = p.positionen.find((x) => /558/.test(x.art)), i1 = p.positionen.find((x) => /557b/.test(x.art));
gleich('D1 § 558: verlangen_ab / wirksam_ab', [m1.verlangen_ab, m1.verlangbar_sofort, m1.wirksam_ab], ['2026-10', true, '2027-01']);
gleich('D1 ab_text wie App', m1.ab_text, sA.ab_text);
gleich('D1 termin = Langform der App', m1.termin, sA.termine.text_lang);
gleich('D1 2026: nichts wirksam (Jahresgrenze)', [m1.monate_in_jahr, m1.wirksam_im_jahr_eur], [0, 0]);
gleich('D2 Index: Erklärung sofort, wirksam 12/2026', i1.ab_text, 'verlangbar ab sofort · wirksam ab 12/2026');
gleich('D2 Index: 1 Monat in 2026 = 40 €', [i1.monate_in_jahr, i1.wirksam_im_jahr_eur], [1, 40]);
gleich('D3 Summe wirksam 2026 = nur Index', p.in_diesem_jahr.mieterhoehungen_wirksam_im_jahr, 40);
p = OW.potenzial(datenD, 2027, heute);
gleich('D4 2027: § 558 zwölf Monate', p.positionen.find((x) => /558/.test(x.art)).wirksam_im_jahr_eur, 1200);
/* gespeichert im Sommer: damals „sofort", heute frühestens heute zugegangen */
const alt = JSON.parse(JSON.stringify(datenD));
Object.assign(alt._potenzial.zusammenfassung.wohnungen[0], { soll_verlangbar_ab: '2026-06', soll_wirksam_ab: '2026-09' });
p = OW.potenzial(alt, 2026, heute);
const m2 = p.positionen.find((x) => /558/.test(x.art));
gleich('D5 alter Monat nachgezogen: verlangbar heute, wirksam 01/2027', [m2.verlangen_ab, m2.wirksam_ab], ['2026-10', '2027-01']);
const todo = OW.todos(datenD, { heute }).find((x) => x.art === 'Miete' && /558/.test(x.was));
gleich('D6 To-do nennt verlangen + wirksam', /Erhöhung verlangen ab sofort/.test(todo.was) && /wirksam ab 01\/2027/.test(todo.was), true);

/* Staffel: kein Verlangen, Termin = nächste Staffel; alter Text „sofort" wird nicht durchgereicht */
const st = OW.potenzial({ _mfh: { einheiten: [{ nr: '1', mv_art: 'staffel', mv_naechste_anpassung: '2027-03-01' }, { nr: '2', mv_art: 'staffel' }] },
  _potenzial: { zusammenfassung: { stand: '2026-10-01', wohnungen: [{ nr: '1', ist: 500, soll: 530, soll_ab: 'sofort' }, { nr: '2', ist: 500, soll: 530, soll_ab: 'sofort' }] } } }, 2026, heute);
gleich('D7 Staffel mit Datum', [st.positionen[0].verlangen_ab, st.positionen[0].wirksam_ab, st.positionen[0].ab_text], [null, '2027-03', 'nächste Staffel wirksam ab 03/2027 (§ 557a BGB, ohne Erklärung)']);
gleich('D7 Staffel ohne Datum: kein „sofort"', /^sofort/.test(st.positionen[1].ab_text), false);

/* ── E · alter Speicherstand (nur Text) gibt dasselbe wie mhTermine() ─── */
const AT = OW._termine._altTermin;
gleich('E0 Regeltabelle gleich', OW._termine.TERMIN_PLUS, { '558': P.TERMIN_REGEL['558'].plus, '559': P.TERMIN_REGEL['559'].plus, '557b': P.TERMIN_REGEL['557b'].plus });
for (const [text, letzte, art] of [['sofort', '2025-03', '558'], ['Jan 2027', '2025-10', '558'], ['Mrz 2027', '2025-12', '558'],
  ['sofort (letzte Erhöhung nicht eingetragen)', null, '558'], ['sofort', '2026-08', '559']]) {
  const a = AT(text, '2026-10-28', H, art), b = P.mhTermine({ art, letzte, heute: H });
  gleich('E alt „' + text + '" (' + art + ')', [a.verlangbar_ab, a.verlangbar_sofort, a.wirksam_ab], [b.verlangbar_ab, b.verlangbar_sofort, b.wirksam_ab]);
}

/* ── F · Quelltext ─────────────────────────────────────────────────────── */
const fe = fs.readFileSync(QUELLE_FE, 'utf8');
const mv = fs.readFileSync(path.join(WURZEL, 'frontend/js/mietvertrag-objekt.js'), 'utf8');
const oa = fs.readFileSync(path.join(WURZEL, 'backend/src/services/openaiService.js'), 'utf8');
gleich('F1 potenzial.js: kein „? \'sofort\' : monatText" mehr', /\?\s*'sofort'\s*:\s*monatText/.test(fe), false);
gleich('F2 mietvertrag-objekt.js: kein Rückfall „sofort" beim § 558', /ab_text\s*:\s*'sofort'/.test(mv), false);
gleich('F3 Pilot-Regel im Analyse-Auftrag und im Co-Pilot', (oa.match(/MH_TERMIN_REGEL/g) || []).length >= 3, true);

console.log('mieterhoehung-termine-pruefen (v3028): ' + (n - fehler) + ' von ' + n + ' ok');
process.exit(fehler ? 1 : 0);
