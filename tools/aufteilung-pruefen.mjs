#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * aufteilung-pruefen.mjs — v3322
 *
 * AUFGETEILT → VERGLEICHSWERT JE EINHEIT FÜHRT — KOMMT ES ÜBERALL AN?
 *
 * Marcel 12.11.2026: „wenn aufgeteilt … Vergleichswert führend … die ganzen
 * Wohnungen einzeln über das Vergleichswertverfahren gerechnet und angegeben.
 * Haben wir das überall berücksichtigt? Unter Einheiten, im Tab Pilotanalyse?"
 *
 * Gerechnet wird der Aufteilerwert EINMAL im Marktbericht-Dienst
 * (PotenzialService aufteilerRechnen, geprüft in wertermittlung-pruefen B66).
 * Dieser Prüfer lädt die ECHTEN Frontend-Dateien und prüft die Kette dahinter:
 *   A  potenzial.js aufteilungKurz(): je Stufe Summe/Wert/Name, je Wohnung
 *      führender Wert, Herkunft, stützender Ertragswert — nichts neu gerechnet
 *   (pdfDaten() baut seine Tabelle „Wert je Wohnung" aus derselben Funktion -
 *    ihr Ausdruck ist Staging-Abnahme, das Modell braucht ein offenes Formular)
 *   C  wert-zielbild.js zielbildFuer(): der GESPEICHERTE Stand trägt den
 *      Aufteilerwert ins Portfolio-Cockpit (dashboard.js liest nur dort)
 *   D  wert-zielbild.js mitAufteilung(): Pilot-Analyse/Bewertung „Wert je
 *      Verfahren" — Zeile „Vergleichswert je Einheit" führt, Bericht stützt,
 *      der Wertanker (W.fuehrend, calc.js) bleibt unberührt
 *   E  ohne Haken „aufgeteilt" ändert sich nichts
 * RC=0 sauber, RC=1 rot.
 * ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = (f) => path.join(WURZEL, 'frontend', 'js', f);
let rot = 0, gruen = 0;
function pruefe(name, ok, info) {
  if (ok) gruen++; else rot++;
  console.log((ok ? '  ok   ' : '  ROT  ') + name + (info != null && info !== '' ? ' — ' + String(info).slice(0, 160) : ''));
}
function fenster() {
  const f = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, setTimeout() {}, clearTimeout() {}, innerWidth: 1280,
    localStorage: { getItem() { return null; }, setItem() {} }, fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }) };
  f.window = f; f.self = f;
  f.document = { readyState: 'complete', addEventListener() {}, getElementById: () => null, querySelector: () => null,
    querySelectorAll() { return []; }, createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
    head: { appendChild() {} }, body: { appendChild() {} } };
  return vm.createContext(Object.assign(f, { console: { log() {}, warn() {}, error() {}, info() {} }, Math, JSON, Number, String, Object, Array, Date, isFinite, parseFloat, parseInt, RegExp, Promise }));
}
const lade = (c, f) => vm.runInContext(fs.readFileSync(JS(f), 'utf8'), c, { filename: f });

const c = fenster();
lade(c, 'mietpotenzial-kern.js'); lade(c, 'potenzial.js'); lade(c, 'wert-zielbild.js');
const P = c.DpPotenzial, W = c.DpWertZielbild;
if (!P || typeof P.aufteilungKurz !== 'function') { console.log('ABBRUCH: DpPotenzial.aufteilungKurz fehlt'); process.exit(1); }
if (!W || typeof W.zielbildFuer !== 'function' || typeof W._mitAufteilung !== 'function') { console.log('ABBRUCH: DpWertZielbild.zielbildFuer/_mitAufteilung fehlt'); process.exit(1); }

/* Ergebnis des Dienstes wie PotenzialService es liefert (Felder aus aufteilerRechnen, B66) */
const R = {
  verfuegbar: true,
  haus: { bestand: { wert: 600000 } },
  aufteilung: {
    kosten_eur: 9000, je_stufe: { bestand: { summe: 563000, vollstaendig: true, potenzial: -46000 } },
    aufteiler: { bestand: { summe: 670000, wert: 661000, vollstaendig: false, bezeichnung: 'Vergleichswert (amtlicher Vergleichsfaktor/Immobilienrichtwert und aus Angebotspreisen), 1 × Ertragswert ersatzweise',
      potenzial: 61000, negativ: false, zaehl: { amtlich: 2, irw: 1, angebote: 1, ertragswert: 1, gewerbe: 1, fehlt: 1 } } }
  },
  wohnungen: [
    { nr: '1', art: 'wohnen', wfl: 60, fuehrend: { bestand: { wert: 150000, verfahren: 'vergleichswert_amtlich', bezeichnung: 'Vergleichswert (amtlicher Vergleichsfaktor)', herkunft: 'amtlicher Vergleichsfaktor 2.500 €/m² · Gutachterausschuss Prüfstadt · Stufe A', stuetzend: 140000 } } },
    { nr: '2', art: 'wohnen', wfl: 70, fuehrend: { bestand: { wert: 160000, verfahren: 'vergleichswert_amtlich', bezeichnung: 'Vergleichswert (Immobilienrichtwert)', herkunft: 'Immobilienrichtwert 2.286 €/m² · Gutachterausschuss Prüfstadt · Stufe A', stuetzend: 150000 } } },
    { nr: '3', art: 'wohnen', wfl: 63, fuehrend: { bestand: { wert: 145000, verfahren: 'vergleichswert_angebote', bezeichnung: 'Vergleichswert (indikativ, aus Angebotspreisen abgeleitet)', indikativ: true, herkunft: 'Angebotspreise … abzüglich 10 % Abschlag, indikativ', stuetzend: 138000 }, zielbild: { wert: 160000 } } },
    { nr: '4', art: 'wohnen', wfl: 70, fuehrend: { bestand: { wert: 135000, verfahren: 'ertragswert_etw', bezeichnung: 'Ertragswert als Eigentumswohnung (ersatzweise)', ersatzweise: true, herkunft: 'kein Vergleichswert verfügbar', stuetzend: null } } },
    { nr: 'G', art: 'gewerbe', wfl: 50, fuehrend: { bestand: { wert: 80000, verfahren: 'anteil_haus', bezeichnung: 'Anteil am Haus (Gewerbe)' } } },
    { nr: '6', art: 'wohnen', wfl: 55, fuehrend: { bestand: { wert: null, verfahren: null } } }
  ]
};
const M = { wohnungen: [{ nr: '1', lage: 'EG links' }, { nr: '2', lage: 'EG rechts' }, { nr: '3', lage: '1. OG' }, { nr: '4', lage: '2. OG' }, { nr: 'G', lage: 'Laden' }, { nr: '6', lage: 'DG' }] };

console.log('aufteilung-pruefen v3322 · echte Dateien: potenzial.js, wert-zielbild.js');
/* ── A ── */
const A = P.aufteilungKurz(R, M);
pruefe('A Aufteilerwert Bestand gelesen (661.000, Summe 670.000, unvollständig)', A && A.aufteiler.bestand.wert === 661000 && A.aufteiler.bestand.summe === 670000 && A.aufteiler.bestand.vollstaendig === false, A && JSON.stringify(A.aufteiler.bestand).slice(0, 120));
pruefe('A sechs Einheiten, Summe der Einzelwerte = Summe des Dienstes', A && A.je_wohnung.length === 6 && A.je_wohnung.reduce((s, w) => s + (w.wert || 0), 0) === 670000);
pruefe('A je Wohnung Herkunft und stützender Ertragswert, Lage aus dem Formular', A && A.je_wohnung[1].herkunft.startsWith('Immobilienrichtwert') && A.je_wohnung[0].stuetzend === 140000 && A.je_wohnung[2].lage === '1. OG');
pruefe('A Wohnung ohne Wert bleibt ohne Wert (kein Ersatz)', A && A.je_wohnung[5].wert === null);
pruefe('A ohne Aufteilung im Ergebnis → null', P.aufteilungKurz({ verfuegbar: true, haus: {} }, M) === null);
pruefe('A Dienst nicht verfügbar → null', P.aufteilungKurz(Object.assign({}, R, { verfuegbar: false }), M) === null);

/* ── C ── gespeicherter Stand → Portfolio-Cockpit */
const zus = { stufen: { bestand: { kaltmiete_jahr: 38340, ertragswert: 600000 }, zielbild: { kaltmiete_jahr: 45000, ertragswert: 640000 } },
  aufteilung: { kosten: 9000, je_stufe: R.aufteilung.je_stufe, aufteiler: A.aufteiler, aufteiler_gesperrt: null, je_wohnung: A.je_wohnung } };
const zf = W.zielbildFuer({ _potenzial: { stand: '2026-11-12T10:00:00Z', zusammenfassung: zus } });
pruefe('C zielbildFuer trägt den Aufteilerwert (661.000, 5 Wohnungen ohne Gewerbe)', zf && zf.aufteilung && zf.aufteilung.wert === 661000 && zf.aufteilung.n === 5, zf && JSON.stringify(zf.aufteilung));
pruefe('C Ertragswert Bestand bleibt daneben (stützend, 600.000)', zf && zf.stufen.bestand.ertragswert === 600000);
const zg = W.zielbildFuer({ _potenzial: { zusammenfassung: Object.assign({}, zus, { aufteilung: { kosten: 0, je_stufe: R.aufteilung.je_stufe, aufteiler_gesperrt: 'Eine Wohnung hat keine Wohnfläche' } }) } });
pruefe('C ohne Aufteilerwert: Grund statt Zahl', zg && zg.aufteilung && zg.aufteilung.wert === undefined && /Wohnfläche/.test(zg.aufteilung.gesperrt), zg && JSON.stringify(zg.aufteilung));
const zs = W.zielbildFuer({ _potenzial: { zusammenfassung: Object.assign({}, zus, { ertragswert_gesperrt: true }) } });
pruefe('C ohne Stufe 3 kein Aufteilerwert', zs && zs.aufteilung === null);
const zo = W.zielbildFuer({ _potenzial: { zusammenfassung: { stufen: zus.stufen } } });
pruefe('C ungeteilt: aufteilung null', zo && zo.aufteilung === null);

/* ── D ── Pilot-Analyse „Wert je Verfahren" */
const bericht = () => ({ fuehrend: 'ertragswert', klartext: 'Führend ist der Ertragswert mit 600.000 €: an ihm misst sich der Preis, die übrigen Werte sind die Gegenprobe. Dein Kaufpreis …',
  marktpreisindikation: { unten: 700000, mitte: 760000, oben: 820000 },
  verfahren: [{ schluessel: 'mpi', name: 'Marktpreisindikation', mitte: 760000, fuehrend: false },
              { schluessel: 'ertragswert', name: 'Ertragswert', zusatz: 'Liegenschaftszins 2,50 %', mitte: 600000, fuehrend: true }] });
c._dpMfh = { aufgeteilt: true };
c.DpPotenzial = Object.assign({}, P, { modell: () => M, ergebnis: () => R });
const D = W._mitAufteilung(bericht());
const zAuf = D.verfahren.find((v) => v.schluessel === 'aufteiler'), zEw = D.verfahren.find((v) => v.schluessel === 'ertragswert');
pruefe('D Zeile „Vergleichswert je Einheit (Summe)“ führt mit 661.000', !!zAuf && zAuf.fuehrend === true && zAuf.mitte === 661000, zAuf && zAuf.zusatz);
pruefe('D steht nach der Marktpreisindikation, vor dem Ertragswert', D.verfahren.map((v) => v.schluessel).join(',') === 'mpi,aufteiler,ertragswert');
pruefe('D Ertragswert des Hauses nicht mehr „führend“, als stützend benannt', !!zEw && zEw.fuehrend === false && /stützend/.test(zEw.zusatz), zEw && zEw.zusatz);
pruefe('D genau EINE Zeile führt', D.verfahren.filter((v) => v.fuehrend).length === 1);
pruefe('D Wertanker unberührt (W.fuehrend bleibt ertragswert, calc.js liest _wertDaten)', D.fuehrend === 'ertragswert');
pruefe('D Klartext: Vergleichswert je Einheit führend, alter Führungssatz ersetzt', /^In Wohnungseigentum aufgeteilt: führend ist der Vergleichswert je Einheit/.test(D.klartext) && !/Führend ist der Ertragswert/.test(D.klartext), D.klartext);
pruefe('D Zusatz nennt Zahl der Wohnungen, Kosten und Unvollständigkeit', !!zAuf && /5 Wohnungen einzeln/.test(zAuf.zusatz) && /Aufteilungskosten/.test(zAuf.zusatz) && /unvollständig/.test(zAuf.zusatz));

/* ── E ── ohne Haken */
c._dpMfh = { aufgeteilt: false };
const E = W._mitAufteilung(bericht());
pruefe('E ohne „aufgeteilt“: Tafel unverändert', E.verfahren.length === 2 && E.verfahren[1].fuehrend === true && /^Führend ist der Ertragswert/.test(E.klartext));
c._dpMfh = { aufgeteilt: true }; c.DpPotenzial = Object.assign({}, P, { modell: () => M, ergebnis: () => null });
const E2 = W._mitAufteilung(bericht());
pruefe('E aufgeteilt, aber noch nicht gerechnet: Tafel unverändert, keine erfundene Zahl', E2.verfahren.length === 2 && !E2.verfahren.some((v) => v.schluessel === 'aufteiler'));

console.log('\n' + (gruen + rot) + ' Punkte, ' + gruen + ' grün, ' + rot + ' rot');
console.log(rot ? 'RC=1 ROT' : 'RC=0 sauber');
process.exit(rot ? 1 : 0);
