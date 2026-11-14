#!/usr/bin/env node
/* v3361 · Zielbild-Fassungen (frontend/js/zielbild-fassungen.js) an den ECHTEN Dateien, ohne Browser.
 *
 *  A  Reine Regeln: hatInhalt (Vorschlag ziel_auto zählt nicht), gueltigAm (aktiv ab gueltig_ab,
 *     Fassung [gueltig_ab, abgeloest_am)), zielNkm (Fassung = Zahl von damals), einordnen (Kopf des
 *     alten Zielbilds wandert in die Fassung, neuer Kopf ab Datum, höchstens 40).
 *  B  ablegen() mit nachgebautem Formular und DpPotenzial: Felder und Einheiten im Schnappschuss,
 *     Ergebnis von damals, saveObj gerufen, ohne eigene Angaben keine Fassung, Soll-Ansicht nie.
 *  C  Jahresstände (jahresstaende.js): ein neuer Stand trägt Ziel-Miete und Zielbild seines Tages.
 *  D  Verdrahtung: „Zielbild leeren" legt VOR dem Leeren ab, ankauf.js nimmt die Bestandsfelder nicht
 *     in den Ankauf, index.html lädt das Modul vor jahresstaende.js, ui.js zeigt die Auswahl.
 *
 * Aufruf: node tools/zielbild-fassungen-pruefen.mjs   (RC=0 sauber) */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let gruen = 0, rot = 0;
const ok = (b, t) => { if (b) gruen++; else { rot++; console.log('  ROT  ' + t); } };

function umgebung(felder, o = {}) {
  const gespeichert = [];
  const ctx = {
    console, Date, Math, JSON, parseInt, isFinite, String, Number, Object, Array, setTimeout: () => 0,
    CustomEvent: function (n, d) { this.type = n; this.detail = d && d.detail; },
    document: { getElementById: (id) => (id in felder ? { value: felder[id] } : null), addEventListener() {}, head: null, createElement: () => ({}) },
    addEventListener() {}, dispatchEvent() {},
    saveObj: () => { gespeichert.push(1); return Promise.resolve(); },
    _currentObjData: o.daten || {},
    _dpMfh: o.mfh || null,
    DpMfhEinheiten: { artMitEinheiten: () => !!o.mfh },
    DealPilotAnkaufAnsicht: { aktiv: () => !!o.soll },
    DealPilotAnkauf: { stand: () => (o.stichtag ? { stichtag: o.stichtag } : null) },
    DpPotenzial: {
      modell: () => ({ aktiv: true, wohnungen: [{ ziel_auto: !!o.auto }], stufen: { bestand: { miete_m: 900 }, mieterhoehung: null, zielbild: { miete_m: 1150, kosten: 18000, plus: 2 } } }),
      kennzahlen: () => ({ zielbild: { miete_j: 13800 } }),
      ergebnis: () => ({ haus: { bestand: { wert: 210000 }, zielbild: { wert: 262000, rnd: 38 } } })
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(lies('frontend/js/zielbild-fassungen.js'), ctx);
  return { ctx, F: ctx.DpZielbildFassungen, gespeichert };
}

/* ── A ──────────────────────────────────────────────────────── */
{
  const { F } = umgebung({});
  ok(!F.hatInhalt({ felder: {}, einheiten: [], haus_massnahmen: [] }), 'A leer ist kein Inhalt');
  ok(F.hatInhalt({ felder: { zb_ziel_qm: '9,20' } }), 'A Zielmiete ist Inhalt');
  ok(!F.hatInhalt({ felder: { zb_massnahmen: '[]' } }), 'A leere Maßnahmenliste ist kein Inhalt');
  ok(F.hatInhalt({ felder: {}, einheiten: [{ i: 0, massnahmen: [{ id: 'bad' }] }] }), 'A Maßnahme einer Wohnung ist Inhalt');
  ok(F.hatInhalt({ felder: {}, einheiten: [], haus_massnahmen: [{ id: 'dach' }] }), 'A Hausmaßnahme ist Inhalt');

  const L = [
    { id: 'a', titel: 'Zielbild 2027', gueltig_ab: null, abgeloest_am: '2026-03-01', ergebnis: { ziel_nkm: 1000 } },
    { id: 'b', titel: 'Zielbild 2028', gueltig_ab: '2026-03-01', abgeloest_am: '2027-05-15', ergebnis: { miete_m_ziel: 1100 } }
  ];
  const akt = { gueltig_ab: '2027-05-15', titel: 'Zielbild 2029' };
  ok(F.gueltigAm(L, akt, '2025-12-31').fassung.id === 'a', 'A 2025 gilt die erste Fassung (ohne Beginn)');
  ok(F.gueltigAm(L, akt, '2026-03-01').fassung.id === 'b', 'A am Wechseltag gilt die neue Fassung');
  ok(F.gueltigAm(L, akt, '2027-05-14').fassung.id === 'b', 'A Tag vor dem Wechsel gilt die alte');
  ok(F.gueltigAm(L, akt, '2027-05-15').aktiv === true, 'A ab gueltig_ab gilt das aktive');
  ok(F.gueltigAm([], {}, '2020-01-01').aktiv === true, 'A ohne Fassungen gilt immer das aktive');
  ok(F.zielNkm(F.gueltigAm(L, akt, '2025-06-30'), 1300) === 1000, 'A Fassung: Ziel von damals (ziel_nkm)');
  ok(F.zielNkm(F.gueltigAm(L, akt, '2026-06-30'), 1300) === 1100, 'A Fassung ohne ziel_nkm: miete_m_ziel');
  ok(F.zielNkm(F.gueltigAm(L, akt, '2028-01-01'), 1300) === 1300, 'A aktiv: heutiges Ziel');

  const r = F.einordnen([], { gueltig_ab: '2025-01-01', titel: 'Erstes', angelegt_am: 'x' }, { zieljahr: 2028, felder: {} }, { datum: '2026-11-14', titelNeu: 'Zweites' });
  ok(r.liste.length === 1 && r.fassung.titel === 'Erstes' && r.fassung.gueltig_ab === '2025-01-01' && r.fassung.abgeloest_am === '2026-11-14', 'A einordnen: alter Kopf in der Fassung');
  ok(r.aktiv.gueltig_ab === '2026-11-14' && r.aktiv.titel === 'Zweites' && r.fassung.status === 'abgeloest', 'A einordnen: neuer Kopf ab Datum');
  const r2 = F.einordnen([], {}, { zieljahr: null, felder: {} }, { datum: '2026-11-14', seit: '2025-02-01' });
  ok(r2.fassung.titel === 'Zielbild ohne Zieljahr' && r2.fassung.gueltig_ab === '2025-02-01', 'A ohne Kopf: Titel aus Zieljahr, Beginn = Ankauf');
  let l = [];
  for (let i = 0; i < 45; i++) l = F.einordnen(l, {}, { felder: {} }, { datum: '2026-01-01' }).liste;
  ok(l.length === 40, 'A höchstens 40 Fassungen (' + l.length + ')');
}

/* ── B ──────────────────────────────────────────────────────── */
{
  const felder = { zb_ziel_qm: '9,20', zb_fertig_jahr: '2028', zb_ziel_wann: 'bei Mieterwechsel', zb_massnahmen: '[{"id":"bad","k":12000}]', zb_soll_qm: '', zb_soll_ab: '',
    zb_vgl_qm: '', zb_markt_qm: '', zb_ziel_bremse: '', zb_bremse_ausnahme: '' };
  const { F, ctx, gespeichert } = umgebung(felder, { stichtag: '2025-01-01' });
  const f = F.ablegen({ datum: '2026-11-14', titelNeu: 'Zielbild 2030', notiz: 'Umbau verschoben' });
  ok(!!f && f.felder.zb_ziel_qm === '9,20' && f.zieljahr === 2028 && f.titel === 'Zielbild 2028', 'B Felder und Zieljahr im Schnappschuss');
  ok(f.gueltig_ab === '2025-01-01', 'B erste Fassung beginnt mit dem Ankauf-Stichtag');
  ok(f.ergebnis.ziel_nkm === 1150 && f.ergebnis.miete_m_ziel === 1150 && f.ergebnis.ertragswert_ziel === 262000 && f.ergebnis.kosten === 18000, 'B Ergebnis von damals');
  ok(ctx._currentObjData._zielbilder.length === 1 && ctx._currentObjData._zielbild_aktiv.titel === 'Zielbild 2030', 'B im Objekt abgelegt');
  ok(gespeichert.length === 1, 'B saveObj gerufen');
  ok(F.statusSetzen(f.id, 'erreicht') && ctx._currentObjData._zielbilder[0].status === 'erreicht', 'B Status setzen');
  ok(!F.statusSetzen(f.id, 'gelöscht'), 'B unbekannter Status abgewiesen');
  ok(/vorher Zielbild 2028/.test(F.wechselSatz()) && /11\/2026/.test(F.wechselSatz()), 'B Satz zum Wechsel: ' + F.wechselSatz());
  const f2 = F.ablegen({ ohneSpeichern: true });
  ok(!!f2 && f2.gueltig_ab === '2026-11-14' && gespeichert.length === 2, 'B zweite Fassung beginnt am Wechseltag, ohneSpeichern speichert nicht (Speicherungen ' + gespeichert.length + ')');

  const leerF = {}; Object.keys(felder).forEach((k) => { leerF[k] = ''; });
  const L = umgebung(leerF, { auto: true });
  ok(L.F.ablegen() === false && !L.ctx._currentObjData._zielbilder, 'B nur Vorschlag (ziel_auto): keine Fassung');
  const S = umgebung(felder, { soll: true });
  ok(S.F.ablegen() === false, 'B in der Soll-Ansicht nie');
  const mfh = { einheiten: [{ nr: '1', wfl: 60, ist: 450, ziel_qm: '9', massnahmen: [{ id: 'bad', k: 9000 }] }, { nr: '2', wfl: 70, ist: 520 }], haus_massnahmen: [{ id: 'dach', k: 30000 }] };
  const M = umgebung(leerF, { mfh });
  const fm = M.F.ablegen({ ohneSpeichern: true });
  ok(!!fm && fm.einheiten.length === 2 && fm.einheiten[0].ziel_qm === '9' && fm.haus_massnahmen[0].id === 'dach', 'B MFH: Einheiten und Hausmaßnahmen im Schnappschuss');
  mfh.einheiten[0].ziel_qm = '11';
  ok(fm.einheiten[0].ziel_qm === '9', 'B Schnappschuss ist eine Kopie (bewegt sich nicht mit)');
}

/* ── C ──────────────────────────────────────────────────────── */
{
  const { ctx } = umgebung({ zb_fertig_jahr: '2028' }, { daten: { _zielbild_aktiv: { titel: 'Zielbild 2028', gueltig_ab: '2026-01-01' } } });
  ctx.State = { kpis: null, cfRows: [] };
  ctx._currentObjKey = 'k1';
  vm.runInContext(lies('frontend/js/jahresstaende.js'), ctx);
  const st = ctx.DpJahresstaende.neuerStand({}, new Date('2026-11-14T10:00:00Z'));
  ok(st.kz.ziel_nkm === 1150 && st.kz.zielbild === 'Zielbild 2028', 'C Jahresstand trägt Ziel und Zielbild seines Tages (' + st.kz.ziel_nkm + ', ' + st.kz.zielbild + ')');
}

/* ── D ──────────────────────────────────────────────────────── */
{
  const pot = lies('frontend/js/potenzial.js');
  const i0 = pot.indexOf('function leeren()'), iA = pot.indexOf('DpZielbildFassungen.ablegen', i0), iL = pot.indexOf('e.massnahmen = []; e.massnahme', i0);
  ok(i0 > 0 && iA > i0 && iL > iA, 'D leeren(): erst ablegen, dann leeren');
  const ank = lies('frontend/js/ankauf.js');
  ok(/k === '_zielbilder' \|\| k === '_zielbild_aktiv'/.test(ank), 'D ankauf.js friert die Fassungen nicht mit ein');
  const html = lies('frontend/index.html');
  const iz = html.indexOf('js/zielbild-fassungen.js?v='), ij = html.indexOf('js/jahresstaende.js?v=');
  ok(iz > 0 && ij > iz, 'D index.html lädt zielbild-fassungen.js vor jahresstaende.js');
  ok(/DpZielbildFassungen\.leisteHtml\(\)/.test(lies('frontend/js/ui.js')), 'D ui.js zeigt die Auswahl in der Pilot-Analyse');
  ok(/DpZielbildFassungen\.mount\(\)/.test(pot), 'D objektKarte zeichnet die Fassungen');
}

console.log(`zielbild-fassungen-pruefen (v3361): ${gruen} von ${gruen + rot} ok`);
process.exit(rot ? 1 : 0);
