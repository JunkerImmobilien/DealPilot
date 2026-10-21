#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/wertermittlung-pruefen.mjs · v2580 · v2595
   v2595: B6/B7 auf comparison.differenz_zum_ertragswert (Soll in der Falldatei,
   mit dem Wert davor), B4b/B10i als Pruefung statt Befund, B10j/B10k Sachwert
   ohne Bodenwert, B12 Modellpruefung des Liegenschaftszinses (lib/modellpruefung.js).

   Prueft die Wertermittlung des Marktberichts am ECHTEN Rechenkern:
     marktbericht/backend/src/services/ErtragswertService.js
     marktbericht/backend/src/services/CrossCheckService.js
     marktbericht/backend/src/services/ValuationService.js (nur geladen)
     marktbericht/backend/src/lib/immowertv.js, lib/nhk2010.js, lib/nrw_modell.js
   ohne Datenbank und ohne Netz. Falldatei: tools/wertermittlung-faelle.json

     Ebene A  amtliche Anwendungsbeispiele (EW-RL, VW-RL, ImmoWertA, Anlage 4)
              Massstab ist das Dokument, Toleranz die Rundung des Dokuments.
     Ebene B  Testfaelle 1-11 aus Dateien/DealPilot_ImmoWertV_Claude_Prompt.md.
              Wo der Code bewusst anders entscheidet: IST pruefen, als
              "Entscheidung offen" melden, kein Rot.
     Ebene C  Regression der Demo-Objekte: eingefrorene Eingaben von
              CrossCheckService.compute (Erfassung auf Staging, 21.10.2026),
              eingefrorene Sollwerte.

   Die Uhr steht auf dem 21.10.2026 (Stichtagsjahr 2026), sonst rechnete
   Ebene C im Januar mit neuen Bewirtschaftungskosten.

   Aufruf:  node tools/wertermittlung-pruefen.mjs            kurz (<= 40 Zeilen)
            node tools/wertermittlung-pruefen.mjs --alle     jeder Wert
            node tools/wertermittlung-pruefen.mjs --einfrieren=<fang.json>
                 schreibt Ebene C neu (nur nach einer bewussten Aenderung!)
   RC=0 sauber, RC=1 mindestens ein Rot, RC=2 Pruefer kaputt.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as nodeModule from 'node:module';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(WURZEL, 'marktbericht/backend/src');
const FALLDATEI = path.join(WURZEL, 'tools/wertermittlung-faelle.json');
const ALLE = process.argv.includes('--alle');
const EINFRIEREN = (process.argv.find((a) => a.startsWith('--einfrieren=')) || '').split('=')[1] || null;

/* ── feste Uhr ─────────────────────────────────────────────────────── */
const FEST = Date.parse('2026-10-21T12:00:00Z');
const _Date = Date;
class FesteUhr extends _Date {
  constructor(...a) { if (a.length) super(...a); else super(FEST); }
  static now() { return FEST; }
}
globalThis.Date = FesteUhr;

/* ── 'pg' ohne node_modules: ValuationService zieht ueber
   WertParameterService lib/db.js nach. Ein Pool, der nie verbindet. ── */
let pgGestellt = false;
if (typeof nodeModule.registerHooks === 'function') {
  nodeModule.registerHooks({
    resolve(spec, ctx, next) {
      if (spec === 'pg') {
        pgGestellt = true;
        return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
          'class Pool { constructor() {} query() { return Promise.reject(new Error("offline: keine Datenbank im Pruefer")); } on() {} end() {} }\n'
          + 'export default { Pool };') };
      }
      return next(spec, ctx);
    },
  });
}

const geladen = [];
const lade = async (rel) => {
  const voll = path.join(SRC, rel);
  if (!fs.existsSync(voll)) throw new Error('fehlt: ' + rel);
  const m = await import(pathToFileURL(voll).href);
  geladen.push(rel);
  return m;
};
let IW, NHK, NRW, EWS, CCS, VS = null, vsGrund = '';
try {
  IW = await lade('lib/immowertv.js');
  NHK = await lade('lib/nhk2010.js');
  NRW = await lade('lib/nrw_modell.js');
  EWS = (await lade('services/ErtragswertService.js')).ErtragswertService;
  CCS = await lade('services/CrossCheckService.js');
} catch (e) { console.log('PRUEFER KAPUTT: ' + e.message); process.exit(2); }
try { VS = (await lade('services/ValuationService.js')).ValuationService; }
catch (e) { vsGrund = e.message.slice(0, 60); }

/* Zaehler: welche echte Funktion wie oft gerufen wurde */
const ruf = {};
const zaehle = (name, fn) => (...a) => { ruf[name] = (ruf[name] || 0) + 1; return fn(...a); };
const ertragswert = zaehle('ErtragswertService.ertragswert', EWS.ertragswert.bind(EWS));
const bodenwert = zaehle('ErtragswertService.bodenwert', EWS.bodenwert.bind(EWS));
const compute = zaehle('CrossCheckService.compute', CCS.CrossCheckService.compute.bind(CCS.CrossCheckService));
const mieteNachBand = zaehle('mieteNachBand', CCS.mieteNachBand);
const barwertfaktor = zaehle('barwertfaktor', IW.barwertfaktor);
const abzinsungsfaktor = zaehle('abzinsungsfaktor', IW.abzinsungsfaktor);
const bwkAnsaetze = zaehle('bwkAnsaetze', IW.bwkAnsaetze);
const sachwert = zaehle('nhk2010.sachwert', NHK.sachwert);
const gewogenerKennwert = zaehle('gewogenerKennwert', NHK.gewogenerKennwert);
const nhkKennwert = zaehle('nhkKennwert', NHK.nhkKennwert);
const nrwBwk = zaehle('nrw_modell.bewirtschaftungskosten', NRW.bewirtschaftungskosten);

const F = JSON.parse(fs.readFileSync(FALLDATEI, 'utf8'));

/* ── Buchfuehrung ─────────────────────────────────────────────────── */
const E = { A: { faelle: 0, werte: 0, rot: 0, offen: 0 }, B: { faelle: 0, werte: 0, rot: 0, offen: 0 }, C: { faelle: 0, werte: 0, rot: 0, offen: 0 } };
const rotListe = [], offenListe = [], hinweise = [], detail = [];
const eur = (v) => (v == null ? 'kein Wert' : (typeof v === 'number' ? v.toLocaleString('de-DE', { maximumFractionDigits: 4 }) : String(v)));
function wert(eb, id, was, ist, soll, tol = 0) {
  E[eb].werte++;
  const ok = (soll === null) ? (ist === null || ist === undefined)
    : (typeof soll === 'number' && typeof ist === 'number' && Math.abs(ist - soll) <= tol + 1e-9);
  detail.push((ok ? '  ok   ' : '  ROT  ') + id + ' ' + was + ': ist ' + eur(ist) + ', soll ' + eur(soll) + (tol ? ' (±' + tol + ')' : ''));
  if (!ok) { E[eb].rot++; rotListe.push(id + ' ' + was + ': ist ' + eur(ist) + ', soll ' + eur(soll) + (tol ? ' ±' + tol : '')); }
  return ok;
}
function pruefe(eb, id, was, ok, text) {
  E[eb].werte++;
  detail.push((ok ? '  ok   ' : '  ROT  ') + id + ' ' + was + (text ? ' — ' + text : ''));
  if (!ok) { E[eb].rot++; rotListe.push(id + ' ' + was + (text ? ': ' + text : '')); }
  return ok;
}
function offen(eb, id, text) { E[eb].offen++; offenListe.push(id + ' ' + text); detail.push('  OFFEN ' + id + ' ' + text); }
const dezimalen = (x) => { const s = String(x); return s.includes('.') ? s.split('.')[1].length : 0; };
const zeile = (k, re) => { const z = (k.staffel || []).find((s) => re.test(s.pos)); return z ? z.wert : undefined; };
const klon = (x) => JSON.parse(JSON.stringify(x));

/* Standard-Eingabe fuer Faelle, die nur Rohertrag/BWK/Zins/RND kennen */
const einManuell = (e, fr = {}) => ({
  objektart: e.objektart || 'mfh', baujahr: 2000, baustatus: 'bestand', wohnflaeche_qm: 100, anzahl_we: 1,
  stichtag_jahr: 2026, miete_markt_jahr: e.rohertrag ?? fr.rohertrag, bwk_modus: 'manuell',
  bwk_gesamt_jahr: e.bwk ?? fr.bwk, lzs_pct: e.lzs_pct, lzs_stufe: 'A', rnd_jahre: e.rnd_jahre,
  bog_eur: e.bog_eur || null, bog_grund: e.bog_eur ? 'Anwendungsbeispiel' : null,
});
const bwEinfach = (eur_, teil = 0) => bodenwert(teil > 0
  ? { flaeche_qm: 1, brw_sqm: eur_, groessenanpassung: { verfuegbar: true, gruen_qm: 1, wert_eur: eur_ + teil,
      koeffizient_angewandt: false, bauland_qm: 1, bodenwert_eur_qm: eur_, wert_bauland_eur: eur_,
      quelle_art: 'eigene Angabe', gruen_eur_qm: teil, wert_gruen_eur: teil, rentierlich: false,
      hinweis: 'selbstständig nutzbare Teilfläche' } }
  : { flaeche_qm: 1, brw_sqm: eur_ });

/* ══ EBENE A ═════════════════════════════════════════════════════════ */
for (const f of F.ebene_a) {
  E.A.faelle++;
  const id = f.id, s = f.soll || {}, t = f.toleranz || {}, e = f.eingabe || {}, fr = f.eingabe_frei || {};
  try {
    if (f.art === 'ertragswert') {
      const k = ertragswert(einManuell(e, fr), bwEinfach(e.bodenwert, e.teilflaeche_eur || 0));
      if (f.status === 'entscheidung_offen') {
        const ist = k.wert_ungerundet ?? null;
        if (pruefe('A', id, 'IST wie eingefroren', ist === f.ist_erwartet.ertragswert_ungerundet,
          'ist ' + eur(ist) + ', eingefroren ' + eur(f.ist_erwartet.ertragswert_ungerundet))) {
          offen('A', id, '(' + f.quelle + ') Dokument ' + eur(s.summe) + ' / ' + eur(s.ertragswert) + ', Kern ' + eur(ist) + ' — ' + f.titel);
        }
        continue;
      }
      if (s.reinertrag != null) wert('A', id, 'Reinertrag', zeile(k, /^= Reinertrag/), s.reinertrag, t.euro);
      if (s.bodenwertverzinsung != null) { const v = zeile(k, /Bodenwertverzinsung/); wert('A', id, 'Bodenwertverzinsung', v == null ? v : Math.abs(v), s.bodenwertverzinsung, t.euro); }
      if (s.gebaeudereinertrag != null) wert('A', id, 'Gebäudereinertrag', zeile(k, /^= Gebäudereinertrag/), s.gebaeudereinertrag, t.euro);
      if (s.barwertfaktor != null) wert('A', id, 'Barwertfaktor', k.barwertfaktor, s.barwertfaktor, 0.5 * 10 ** -dezimalen(s.barwertfaktor));
      if (s.gebaeudeertragswert != null) wert('A', id, 'Gebäudeertragswert', zeile(k, /^= Gebäudeertragswert/), s.gebaeudeertragswert, t.euro);
      if (s.vorlaeufiger_ertragswert != null) wert('A', id, 'vorläufiger Ertragswert', zeile(k, /^= vorläufiger Ertragswert/) - (e.teilflaeche_eur || 0), s.vorlaeufiger_ertragswert, t.euro);
      if (s.summe != null) wert('A', id, 'Summe vor Rundung', k.wert_ungerundet, s.summe, t.euro);
      if (s.ertragswert != null) wert('A', id, 'Ertragswert gerundet', k.wert, s.ertragswert, t.rundung_dokument || 0);
    } else if (f.art === 'faktoren') {
      for (const [p, n, soll] of f.barwertfaktor || []) wert('A', id, 'Barwertfaktor ' + p + ' %/' + n + ' J', barwertfaktor(p, n), soll, 0.5 * 10 ** -dezimalen(soll));
      for (const [p, n, soll] of f.abzinsungsfaktor || []) wert('A', id, 'Abzinsungsfaktor ' + p + ' %/' + n + ' J', abzinsungsfaktor(p, n), soll, 0.5 * 10 ** -Math.max(dezimalen(soll), 3));
    } else if (f.art === 'vereinfacht') {
      /* Der Kern rechnet § 29 nicht selbst (mit Bodenwert rechnet er § 28, ohne
         keinen Wert). Geprueft werden seine Faktoren in der Formel des § 29. */
      const kf = barwertfaktor(e.lzs_pct, e.rnd_jahre), af = abzinsungsfaktor(e.lzs_pct, e.rnd_jahre);
      const br = Math.round(e.reinertrag * kf), bwa = Math.round(e.bodenwert * af);
      wert('A', id, 'Barwert des Reinertrags (§ 29 Nr. 1)', br, s.barwert_reinertrag, t.euro);
      wert('A', id, 'abgezinster Bodenwert (§ 29 Nr. 2)', bwa, s.bodenwert_abgezinst, t.euro);
      wert('A', id, 'vorläufiger Ertragswert § 29', br + bwa, s.vorlaeufiger_ertragswert, t.euro);
    } else if (f.art === 'bwk_anlage3') {
      const k = ertragswert({ objektart: e.objektart, baujahr: 2000, wohnflaeche_qm: e.wohnflaeche_qm, anzahl_we: 1,
        stichtag_jahr: e.stichtag_jahr, miete_markt_jahr: e.rohertrag, bwk_modus: 'normiert',
        lzs_pct: fr.lzs_pct, lzs_stufe: 'A', rnd_jahre: fr.rnd_jahre }, bwEinfach(fr.bodenwert));
      wert('A', id, 'Verwaltungskosten', zeile(k, /^Verwaltungskosten/), s.verwaltung, t.euro);
      wert('A', id, 'Instandhaltung', zeile(k, /^Instandhaltung/), s.instandhaltung, t.euro);
      wert('A', id, 'Mietausfallwagnis', zeile(k, /^Mietausfallwagnis/), s.mietausfall, t.euro);
      const b = zeile(k, /^− Bewirtschaftungskosten/);
      wert('A', id, 'Bewirtschaftungskosten', b == null ? b : Math.abs(b), s.bwk, t.euro);
    } else if (f.art === 'bwk_jahr') {
      wert('A', id, e.feld + ' ' + e.stichtag_jahr, bwkAnsaetze(e.stichtag_jahr).werte[e.feld], s.wert, 0);
    } else if (f.art === 'bwk_nrw') {
      const w = nrwBwk({ rohertrag_eur: e.rohertrag, wohnflaeche_qm: e.wohnflaeche_qm, ist_eigentumswohnung: false, wohneinheiten: 1, stichtag_jahr: e.stichtag_jahr });
      const etw = nrwBwk({ rohertrag_eur: e.rohertrag, wohnflaeche_qm: e.wohnflaeche_qm, ist_eigentumswohnung: true, wohneinheiten: 1, stichtag_jahr: e.stichtag_jahr });
      wert('A', id, 'Verwaltung je Wohnung', w.posten[0].wert, s.verwaltung_we, 0);
      wert('A', id, 'Verwaltung je ETW', etw.posten[0].wert, s.verwaltung_etw, 0);
      wert('A', id, 'Instandhaltung je m²', w.posten[1].wert / e.wohnflaeche_qm, s.instandhaltung_qm, 0.05);
      wert('A', id, 'Mietausfallwagnis %', w.posten[2].wert / e.rohertrag * 100, s.mietausfall_pct, 0.001);
    } else if (f.art === 'kennwert_gewogen') {
      const g = gewogenerKennwert(e.typ, e.ausstattung);
      wert('A', id, 'gewogener Kostenkennwert', g.verfuegbar ? g.kennwert_eur_qm : null, s.kennwert_eur_qm, 0);
    } else if (f.art === 'kennwert_tabelle') {
      s.stufen.forEach((soll, i) => wert('A', id, 'Typ ' + e.typ + ' Stufe ' + (i + 1), nhkKennwert(e.typ, null, i + 1), soll, 0));
    } else if (f.art === 'sachwert_marktanpassung') {
      const sw = sachwert({ nhk_typ: '1.01', standardstufe: 3, bgf_direkt: e.gebaeude_sachwert / 835, baupreisindex: 1,
        gnd_jahre: 80, rnd_jahre: 80, bom_eur: e.bom_eur, bom_grund: 'Anwendungsbeispiel' },
        { vollstaendig: true, wert: e.bodenwert }, { wert: e.sachwertfaktor });
      wert('A', id, 'Gebäudesachwert (Ausgangsgröße)', sw.gebaeude_sachwert_eur ?? null, e.gebaeude_sachwert, t.euro);
      wert('A', id, 'vorläufiger Sachwert', sw.vorlaeufiger_sachwert_eur ?? null, s.vorlaeufiger_sachwert, t.euro);
      wert('A', id, 'marktangepasster Sachwert', zeile(sw, /^= marktangepasster Sachwert/) ?? null, s.marktangepasst, t.euro);
      wert('A', id, 'Sachwert nach boG', sw.wert, s.summe, t.euro);
      wert('A', id, 'Sachwert gerundet (Dokument)', sw.wert, s.sachwert, t.rundung_dokument);
    } else {
      pruefe('A', id, 'unbekannte Art ' + f.art, false);
    }
  } catch (err) { pruefe('A', id, 'Lauf', false, 'Ausnahme: ' + err.message); }
}

/* ══ EBENE B ═════════════════════════════════════════════════════════ */
const C = F.ebene_c || { faelle: {} };
const ccFall = (name, aendern) => {
  const fall = C.faelle[name];
  if (!fall) return null;
  const a = klon(fall.argumente);
  if (aendern) aendern(a);
  return compute(...a);
};
const einOk = () => ({ objektart: 'mfh', baujahr: 1990, baustatus: 'bestand', wohnflaeche_qm: 400, anzahl_we: 6,
  stichtag_jahr: 2026, miete_markt_jahr: 36000, lzs_pct: 3.0, lzs_stufe: 'A', rnd_jahre: 40 });
const bwOk = () => bwEinfach(200000);
function fallB(id, fn) { E.B.faelle++; try { fn(); } catch (err) { pruefe('B', id, 'Lauf', false, 'Ausnahme: ' + err.message); } }

/* B1-B3 · am ECHTEN Band des Falls Westerfeld (Kern v2541: unten x 0,7, oben x 1,15) */
const W = ccFall('westerfeld_body');
const band = W && W.ertragswert && W.ertragswert.miete_band;
const markt = band ? band.angebot_qm : null;
fallB('B1', () => {
  if (!band) return pruefe('B', 'B1', 'Band aus Ebene C', false, 'westerfeld_body fehlt');
  const r = mieteNachBand(markt, band, markt);
  pruefe('B', 'B1', 'Ist ≈ Markt wird angesetzt', r.fuehrt === true && r.qm === markt, 'Ist ' + markt + ' €/m², Band ' + band.unten_qm + '–' + band.oben_qm);
});
fallB('B2', () => {
  if (!band) return;
  const ist = Math.round(markt * 0.8 * 100) / 100, r = mieteNachBand(ist, band, markt);
  if (pruefe('B', 'B2', 'IST: Ist −20 % im Band, Ist angesetzt', r.lage === 'im_band' && r.qm === ist, 'Ist ' + ist + ' €/m²')) {
    offen('B', 'B2', 'Ist 20 % unter Markt (' + ist + ' statt ' + markt + ' €/m²) wird angesetzt, nicht die marktübliche Miete (v2367, Prompt: Markt maßgeblich)');
  }
});
fallB('B3', () => {
  if (!band) return;
  const ist = Math.round(markt * 1.2 * 100) / 100, r = mieteNachBand(ist, band, markt);
  if (pruefe('B', 'B3', 'IST: Ist +20 % über Band, Kante angesetzt', r.lage === 'ueber' && r.qm === band.oben_qm, 'Ist ' + ist + ', Kante ' + band.oben_qm)) {
    offen('B', 'B3', 'Ist 20 % über Markt: angesetzt die obere Bandkante ' + band.oben_qm + ' €/m² (Markt × 1,15), dauerhaft über die ganze RND (Prompt: keine automatische dauerhafte Kapitalisierung)');
  }
});
/* B12 · v2595 · MODELLPRUEFUNG DES ZINSSATZES. Bis v2594 war miete_modellkonform = true,
   sobald die Ist-Miete im Band lag. Geprueft am Fall Westerfeld mit den Modellansaetzen des
   Satzes, den der Bericht dort verwendet (Bielefeld, MFH, Berichtsjahr 2025) - gelesen aus der
   ECHTEN Registerdatei, nicht abgeschrieben. Die eingefrorenen Argumente fuehren das Feld
   lzs_modellansaetze noch nicht (Erfassung vor v2595): ohne Satz muss das Ergebnis null sein. */
const satzBielefeld = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(SRC, 'lib/register/lzs-swf-2026-nachernte.json'), 'utf8'));
    const s = (Array.isArray(j) ? j : (j.saetze || [])).find((x) => x.kennzahl === 'liegenschaftszinssatz'
      && String(x.ags).startsWith('05711') && x.zweig === 'mfh' && Number(x.berichtsjahr) === 2025);
    return s ? s.modellansaetze : null;
  } catch (e) { return null; }
})();
fallB('B12', () => {
  if (!satzBielefeld) return pruefe('B', 'B12', 'Registersatz Bielefeld MFH 2025', false, 'nicht gefunden');
  const ohne = W && W.ertragswert;
  pruefe('B', 'B12a', 'ohne Satz: miete_modellkonform null, Modellpruefung nicht geprüft, kein Abzug',
    !!ohne && ohne.miete_modellkonform === null && ohne.modellpruefung && ohne.modellpruefung.geprueft === false
    && !(ohne.belastbarkeit.abzuege || []).some((a) => /Modell des Liegenschaftszinses/.test(a)));
  const mit = ccFall('westerfeld_body', (a) => { a[4].lzs_modellansaetze = satzBielefeld; });
  const e = mit && mit.ertragswert, mp = e && e.modellpruefung;
  if (!mp || !mp.geprueft) return pruefe('B', 'B12b', 'Modellpruefung mit Satz', false, 'nicht geprüft');
  wert('B', 'B12b', 'Ø Miete des Satzes (marktmiete_eur_qm)', mp.merkmale.miete.satz, 7.7, 0);
  pruefe('B', 'B12c', 'Westerfeld im Modell (Miete, RND, Fläche) → modellkonform true',
    e.miete_modellkonform === true && mp.abweichend.length === 0,
    'Miete ' + mp.merkmale.miete.ansatz + ' (' + mp.merkmale.miete.abweichung_pct + ' %), RND ' + mp.merkmale.rnd.ansatz + ' gegen ' + mp.merkmale.rnd.satz + ', Fläche ' + mp.merkmale.flaeche.ansatz + ' gegen ' + mp.merkmale.flaeche.satz);
  wert('B', 'B12d', 'Ertragswert unverändert durch die Prüfung', e.value_eur, W.ertragswert.value_eur, 0);
  /* Miete +44 % gegen den Satz: Satz-Miete so gesetzt, dass die angesetzte Miete 44 % darueber liegt */
  const mq = mp.merkmale.miete.ansatz;
  const ma44 = Object.assign({}, satzBielefeld, { marktmiete_eur_qm: Math.round(mq / 1.44 * 100) / 100 });
  const ab = ccFall('westerfeld_body', (a) => { a[4].lzs_modellansaetze = ma44; });
  const e2 = ab && ab.ertragswert, mp2 = e2 && e2.modellpruefung;
  pruefe('B', 'B12e', 'Miete +44 % → abweichend, modellkonform false mit Grund',
    !!mp2 && mp2.merkmale.miete.status === 'abweichend' && e2.miete_modellkonform === false && /außerhalb ±20 %/.test(e2.miete_modellkonform_grund || ''),
    mp2 ? mp2.merkmale.miete.abweichung_pct + ' %' : '–');
  wert('B', 'B12f', 'Belastbarkeit −8 gegen die Prüfung im Modell', e2 ? e.belastbarkeit.pct - e2.belastbarkeit.pct : null, 8, 0);
  pruefe('B', 'B12g', 'Kundentext ohne Fachjargon nennt beide Mieten', !!mp2 && /liegt 44 % über der Durchschnittsmiete, aus der der Gutachterausschuss den Liegenschaftszins abgeleitet hat/.test(mp2.text)
    && /nur eingeschränkt/.test(mp2.text), mp2 ? mp2.text.slice(0, 90) : '');
  wert('B', 'B12h', 'Ertragswert bleibt bei Abweichung', e2 ? e2.value_eur : null, W.ertragswert.value_eur, 0);
  const ohneMiete = ccFall('westerfeld_body', (a) => { const m = Object.assign({}, satzBielefeld); delete m.marktmiete_eur_qm; a[4].lzs_modellansaetze = m; });
  pruefe('B', 'B12i', 'Satz ohne Ø Miete → modellkonform null („nicht prüfbar"), −3', !!ohneMiete && ohneMiete.ertragswert.miete_modellkonform === null
    && /nicht prüfbar/.test(ohneMiete.ertragswert.miete_modellkonform_grund || '') && e.belastbarkeit.pct - ohneMiete.ertragswert.belastbarkeit.pct === 3);
});
fallB('B4', () => {
  const L = ccFall('demo2leer');
  if (!L) return pruefe('B', 'B4', 'Fall demo2leer', false, 'fehlt in Ebene C');
  const k = L.ertragswert_kern || {};
  const roh = (k.staffel || []).find((z) => /^Rohertrag Wohnen/.test(z.pos));
  const ok = roh && /leere Fläche .* marktüblicher Miete/.test(roh.detail || '')
    && !(k.staffel || []).some((z) => /Leerstand|Herrichtung|Vermarktung|Mietausfall.*Leer/i.test(z.pos));
  if (pruefe('B', 'B4', 'IST: Leerstand mit Marktmiete, kein Abzug', !!ok, roh ? String(roh.detail).slice(0, 60) : 'keine Rohertragszeile')) {
    offen('B', 'B4', 'Leerstand: leere Fläche mit marktüblicher Miete, kein Abzug für Vermarktung/Herrichtung (Marcel 21.10.2026; Prompt: zeitweilige Kosten berücksichtigen)');
  }
});
/* B4b · Leerstand OHNE jede Vergleichsmiete (kein Angebot, keine amtliche Miete):
   gemessen 21.10.2026 - die Ist-Miete der vermieteten Wohnungen wird auf die GANZE
   Wohnflaeche verteilt, die leere Wohnung traegt nichts, und der Ertragswert erscheint
   als "Ist-Miete (marktueblich)". Gemeldet, nicht geaendert (Entscheidung: Wert
   unterdruecken oder anderer Mietansatz). */
fallB('B4b', () => {
  const ohneMarkt = (a) => { a[2] = { listing_type: 'miete', source: 'keine_daten', sample_size: 0, median_per_sqm: null, comparables: [] }; };
  const L = ccFall('demo2leer', ohneMarkt), V = ccFall('demo', ohneMarkt);
  if (!L || !V) return pruefe('B', 'B4b', 'Faelle demo/demo2leer', false, 'fehlen');
  const eL = L.ertragswert || {}, eV = V.ertragswert || {};
  const roh = ((L.ertragswert_kern || {}).staffel || []).find((z) => /^Rohertrag Wohnen/.test(z.pos)) || {};
  /* v2595 · vorher (v2580) BEFUND: leere Flaeche 0 €, 4,72 statt 5,99 €/m², Ertragswert ausgewiesen */
  pruefe('B', 'B4b', 'Leerstand ohne Vergleichsmiete → kein Ertragswert, Grund genannt', !eL.available && eL.grund_code === 'leerstand_ohne_vergleichsmiete'
    && (L.notes || []).some((n) => /^Ertragswert entfällt: .*leer/.test(n)), eL.available ? 'ausgewiesen ' + eur(eL.value_eur) : 'kein Ertragswert');
  void eV; void roh;
});
fallB('B5', () => {
  const kN = ertragswert(Object.assign(einOk(), { bwk_modus: 'normiert', modellversion: 'agvga_nrw_2016' }), bwOk());
  const kA = ertragswert(Object.assign(einOk(), { bwk_modus: 'normiert' }), bwOk());
  pruefe('B', 'B5', 'Zins mit AGVGA-Modell → BWK nach diesem Modell (§ 10)', !!(kN.bwk_modell && kN.bwk_modell.modell === 'agvga_nrw') && !kA.bwk_modell,
    'BWK NRW ' + eur(Math.abs(zeile(kN, /^− Bewirtschaftungskosten/))) + ' gegen Anlage 3 ' + eur(Math.abs(zeile(kA, /^− Bewirtschaftungskosten/))));
});
/* B6/B7/B9 · Gegenueberstellung am Fall Westerfeld, Marktpreisindikation gesetzt */
const mitMpi = (faktor) => ccFall('westerfeld_body', (a) => { const ew = C.faelle.westerfeld_body.soll.ertragswert; a[3].market_value.estimated = Math.round(ew * faktor); });
/* v2595 · B6/B7 auf die Differenz mit Vorzeichen bezogen auf den Ertragswert. Soll und der
   Wert davor (spread_pct) stehen in der Falldatei (ebene_b.B6/B7). Die Gegenueberstellung
   rechnet mit dem ECHTEN Ertragswert des Falls; die Marktpreisindikation steht im Verhaeltnis
   910/800 bzw. 750/800 dazu - das Soll wird deshalb auf diesen Ertragswert skaliert. */
for (const [id, faktor] of [['B6', 910 / 800], ['B7', 750 / 800]]) {
  fallB(id, () => {
    const fb = F.ebene_b[id] || {}, soll = fb.soll || {};
    const r = mitMpi(faktor);
    const d = r && r.comparison ? r.comparison.differenz_zum_ertragswert : null;
    if (!d) return pruefe('B', id, 'comparison.differenz_zum_ertragswert', false, 'fehlt');
    const ew = d.ertragswert_eur, skal = ew / 800000;
    wert('B', id, 'Differenz € (MPI − Ertragswert)', d.absolut_eur, Math.round(soll.absolut_eur * skal), 1);
    wert('B', id, 'Differenz % vom Ertragswert', d.relativ_pct, soll.relativ_pct, 0.01);
    const sp = r.comparison.spread_pct;
    pruefe('B', id, 'spread_pct bleibt (rückwärtskompatibel)', sp != null && Math.abs(sp - fb.vorher.wert) < 0.051, 'spread ' + sp + ' %');
  });
}
fallB('B6b', () => {
  wert('B', 'B6b', 'Differenz ohne Ertragswert = null', CCS.differenzZumErtragswert(910000, null), null);
  wert('B', 'B6b', 'Differenz bei Ertragswert 0 = null', CCS.differenzZumErtragswert(910000, 0), null);
  const d = CCS.differenzZumErtragswert(910000, 800000), d2 = CCS.differenzZumErtragswert(750000, 800000);
  wert('B', 'B6b', 'Prompt-Beispiel +110.000', d.absolut_eur, 110000, 0);
  wert('B', 'B6b', 'Prompt-Beispiel +13,75 %', d.relativ_pct, 13.75, 0);
  wert('B', 'B6b', 'Prompt-Beispiel −50.000', d2.absolut_eur, -50000, 0);
  wert('B', 'B6b', 'Prompt-Beispiel −6,25 %', d2.relativ_pct, -6.25, 0);
});
fallB('B8', () => {
  const k = ertragswert(Object.assign(einOk(), { miete_ist_jahr: 28800, bwk_modus: 'normiert' }), bwOk());
  pruefe('B', 'B8', 'Ist −20 %: Rohertrag bleibt Marktmiete, kein boG-Automatismus',
    zeile(k, /^= Rohertrag/) === 36000 && !(k.staffel || []).some((z) => /objektspezifisch/.test(z.pos))
    && k.hinweise.some((h) => /besonderes objektspezifisches Merkmal/.test(h)));
});
fallB('B9', () => {
  const r = mitMpi(1);
  pruefe('B', 'B9', 'Angebotswert heißt Marktpreisindikation, nicht Vergleichswert', !!r && r.comparison.basis === 'angebote'
    && /Marktpreisindikation/.test(r.comparison.bezeichnung) && /keine Kaufpreise/.test(r.comparison.basis_hinweis));
});
fallB('B10', () => {
  const ohneRoh = ertragswert(Object.assign(einOk(), { miete_markt_jahr: 0 }), bwOk());
  wert('B', 'B10a', 'ohne Rohertrag kein Ertragswert', ohneRoh.wert, null);
  const ohneRnd = ertragswert(Object.assign(einOk(), { baujahr: null, rnd_jahre: null }), bwOk());
  wert('B', 'B10b', 'ohne Baujahr/RND kein Ertragswert', ohneRnd.wert, null);
  const ohneBw = ertragswert(einOk(), null);
  wert('B', 'B10c', 'ohne Bodenwert kein Ertragswert (§§ 28, 29 brauchen ihn)', ohneBw.wert, null);
  pruefe('B', 'B10c', 'Grund wird genannt', (ohneBw.warnungen || []).some((w) => /Bodenwert/.test(w) && /nicht ausgewiesen/.test(w)), (ohneBw.warnungen || [])[0] ? String(ohneBw.warnungen[0]).slice(0, 70) : 'keine Warnung');
  const bwEtw = bodenwert({ flaeche_qm: 800, brw_sqm: 200, ist_wohnung: true });
  wert('B', 'B10d', 'ETW ohne MEA: kein Bodenwert und kein Ertragswert', ertragswert(Object.assign(einOk(), { objektart: 'etw', anzahl_we: 1, wohnflaeche_qm: 70, miete_markt_jahr: 6000 }), bwEtw).wert, null);
  const swBasis = { nhk_typ: '1.01', bgf_direkt: 200, baupreisindex: 1.91, gnd_jahre: 80, rnd_jahre: 40 };
  pruefe('B', 'B10e', 'Sachwert ohne Standardstufe entfällt', sachwert(swBasis, { vollstaendig: true, wert: 100000 }, null).anwendbar === false);
  pruefe('B', 'B10f', 'Sachwert ohne Baupreisindex entfällt', sachwert(Object.assign({}, swBasis, { standardstufe: 3, baupreisindex: null }), { vollstaendig: true, wert: 100000 }, null).anwendbar === false);
  pruefe('B', 'B10g', 'MFH-Sachwert ohne BGF/Typ entfällt', sachwert({ nhk_typ: null, objektart: 'mfh', wohnflaeche_qm: 400, standardstufe: 3, baupreisindex: 1.91, gnd_jahre: 80, rnd_jahre: 40 }, { vollstaendig: true, wert: 100000 }, null).anwendbar === false);
  /* B10i · dieselbe Frage beim Sachwert (§ 35 Abs. 2: vorlaeufiger Sachwert = bauliche Anlagen + Aussenanlagen
     + BODENWERT). Gemessen: nhk2010.sachwert gibt ohne Bodenwert den Gebaeudewert als Sachwert aus (mit Warnung).
     Gemeldet, nicht geaendert - nicht Teil des Auftrags v2580. */
  /* v2595 · vorher (v2580) BEFUND: 159.485 € = nur Gebaeude als Sachwert ausgewiesen */
  const swOhneBw = sachwert(Object.assign({}, swBasis, { standardstufe: 3 }), null, { wert: 1.0 });
  pruefe('B', 'B10i', 'Sachwert ohne Bodenwert entfällt (§ 35 Abs. 2), Grund genannt', swOhneBw.wert == null && swOhneBw.anwendbar === false
    && swOhneBw.grund_code === 'bodenwert_fehlt' && /§ 35 Abs. 2/.test(swOhneBw.grund || ''), swOhneBw.wert != null ? eur(swOhneBw.wert) : 'kein Wert');
  const swEtw = sachwert(Object.assign({}, swBasis, { standardstufe: 3 }), bwEtw, null);
  pruefe('B', 'B10j', 'ETW ohne MEA: kein Sachwert, Grund nennt den Miteigentumsanteil', swEtw.wert == null && /Miteigentumsanteil/.test(swEtw.grund || ''));
  /* Pauschalweg im CrossCheck: Haus ohne Typ/Stufe und OHNE Grundstuecksflaeche */
  const pausch = CCS.CrossCheckService.compute({ property_type: 'efh', living_area: 140, build_year: 1990, plot_area: null },
    { available: true, value_sqm: 200 }, null, { market_value: { estimated: null } }, {});
  pruefe('B', 'B10k', 'Pauschalweg ohne Bodenwert: kein Sachwert', !!pausch && pausch.sachwert && pausch.sachwert.available === false
    && pausch.sachwert.grund_code === 'bodenwert_fehlt', pausch && pausch.sachwert && pausch.sachwert.available ? 'ausgewiesen ' + eur(pausch.sachwert.value_eur) : 'kein Wert');
  const pauschMit = CCS.CrossCheckService.compute({ property_type: 'efh', living_area: 140, build_year: 1990, plot_area: 500 },
    { available: true, value_sqm: 200 }, null, { market_value: { estimated: null } }, {});
  pruefe('B', 'B10k', 'Pauschalweg mit Bodenwert rechnet weiter (vorläufig)', !!pauschMit && pauschMit.sachwert.available === true && pauschMit.sachwert.vorlaeufig === true);
  const ohneZins = ertragswert(Object.assign(einOk(), { lzs_pct: null, lzs_stufe: null }), bwOk());
  pruefe('B', 'B10h', 'ohne Zins: § 256 BewG als Stufe D (Ausnahme LZS, Marcel 19.10.)', ohneZins.wert != null && ohneZins.lzs.stufe === 'D');
});
fallB('B11', () => {
  const k0 = ertragswert(Object.assign(einOk(), { bwk_modus: 'normiert', bwk_mietausfall_pct: null }), bwOk());
  wert('B', 'B11a', 'Number(null) ist kein 0 %: Mietausfall 2 % von 36.000', zeile(k0, /^Mietausfallwagnis/), 720, 0);
  const kNeg = ertragswert(Object.assign(einOk(), { bwk_modus: 'manuell', bwk_gesamt_jahr: 40000 }), bwOk());
  wert('B', 'B11b', 'negativer Reinertrag: kein Ertragswert', kNeg.wert, null);
  wert('B', 'B11c', 'Barwertfaktor bei 0 % = Jahre', barwertfaktor(0, 30), 30, 0);
  wert('B', 'B11d', 'Stichtag 2026: Verwaltung je WE', bwkAnsaetze(2026).werte.verw_we, 367, 0);
  const b30 = bwkAnsaetze(2030);
  pruefe('B', 'B11e', 'Stichtag 2030: Werte 2026, als abweichend benannt', b30.jahr_je_feld.verw_we === 2026 && b30.abweichend.length === 5);
  const k20 = ertragswert(Object.assign(einOk(), { bwk_modus: 'normiert', stichtag_jahr: 2020 }), bwOk());
  pruefe('B', 'B11f', 'Stichtag 2020 (vor Anlage 3 2021): Warnung „vorläufig"', k20.warnungen.some((w) => /Stichtagsjahr 2020/.test(w)));
  /* Sensitivitaet ist dieselbe Rechnung mit Zins + 0,5 - auch mit nicht rentierlicher Teilflaeche */
  const ein = einManuell({ objektart: 'mfh', lzs_pct: 6.0, rnd_jahre: 50 }, { rohertrag: 20000, bwk: 5000 });
  const kS = ertragswert(ein, bwEinfach(100000, 40000));
  const kP = ertragswert(Object.assign({}, ein, { lzs_pct: 6.5 }), bwEinfach(100000, 40000));
  wert('B', 'B11g', 'Sensitivität +0,5 % = Kern mit 6,5 % (rentierlicher Bodenwert)', kS.sensitivitaet ? kS.sensitivitaet.lzs_plus_05.wert : null, kP.wert, 0);
});

/* B13 · v2611 · E6 · DAS DEALPILOT-LANDESMITTEL (nur Liegenschaftszins, Stufe N).
   Am echten Modul lib/lzs_naeherung.js und der echten lzs-naeherung.json; die
   Sollwerte kommen aus der JSON selbst (Zelle), geprueft wird, dass Kern und
   Tabelle zusammenpassen und die Regeln (>= 8 Ausschuesse, besser als § 256
   und Formel) in jeder verdrahteten Zelle gelten. */
let LZN = null, WPS = null;
try { LZN = await lade('lib/lzs_naeherung.js'); } catch (e) { LZN = null; }
try { WPS = await lade('services/WertParameterService.js'); } catch (e) { WPS = null; }
fallB('B13', () => {
  if (!LZN || !LZN.lzsLandesmittel) return pruefe('B', 'B13', 'lzsLandesmittel geladen', false, 'fehlt');
  const d = LZN.lzsNaeherungsDaten(), Z = (d && d.landesmittel && d.landesmittel.zellen) || {};
  const an = Object.entries(Z).filter(([, z]) => z.verdrahtet);
  pruefe('B', 'B13a', 'jede verdrahtete Zelle: >= 8 Ausschüsse, genauer als § 256 und (wo die Formel rechnet) als die Formel',
    an.length > 0 && an.every(([, z]) => z.ausschuesse >= 8 && z.saetze >= 8 && z.fehler_loao.landesmittel_median_pp < z.fehler_loao.bewg256_median_pp
      && (!z.formel_rechnet_im_land || z.fehler_loao.landesmittel_median_pp < z.fehler_loao.formel_median_pp)),
    an.map(([k]) => k).join(' '));
  const zHe = Z['HE|MFH'];
  const lm = LZN.lzsLandesmittel({ ags: '06411000', objektart: 'mfh', rnd: 30 });
  if (!zHe || !zHe.verdrahtet) return pruefe('B', 'B13b', 'Zelle HE|MFH verdrahtet', false, zHe ? zHe.grund : 'fehlt');
  wert('B', 'B13b', 'Darmstadt MFH: Landesmittel = Median der Zelle HE|MFH', lm.verfuegbar ? lm.pct : null, zHe.median_pct, 0);
  pruefe('B', 'B13c', 'Spanne um den Wert (± P80 der Kreuzvalidierung), Deckung gemessen',
    lm.pct_von < lm.pct && lm.pct < lm.pct_bis && Math.abs((lm.pct_bis - lm.pct) - zHe.spanne_p80_pp) < 0.011 && lm.spanne_deckung === zHe.spanne_deckung_pct,
    lm.pct_von + '–' + lm.pct_bis + ' %, Deckung ' + lm.spanne_deckung + ' %');
  pruefe('B', 'B13d', 'Kennzeichnung „DealPilot-Landesmittel aus n amtlichen Zinssätzen" mit Land und Objektart',
    new RegExp('DealPilot-Landesmittel aus ' + zHe.saetze + ' amtlichen Zinssätzen').test(lm.hinweis) && /Hessen, Mehrfamilienhäuser/.test(lm.hinweis) && /nicht amtlich/.test(lm.hinweis),
    lm.hinweis.slice(0, 90));
  const efh = LZN.lzsLandesmittel({ ags: '06411000', objektart: 'efh', rnd: 40 });
  const efhF = LZN.lzsNaeherung({ ags: '06411000', objektart: 'efh', rnd: 40 });
  pruefe('B', 'B13e', 'HE EZFH: Formel genauer → kein Landesmittel, die Formel rechnet (mit Spanne)',
    !efh.verfuegbar && efh.grund === 'formel_besser' && efhF.verfuegbar && efhF.pct_von < efhF.pct && efhF.spanne_deckung > 0, efh.grund);
  const bw = LZN.lzsLandesmittel({ ags: '08115001', objektart: 'efh', rnd: 40 });
  pruefe('B', 'B13f', 'BW EZFH: unter 8 Ausschüssen → kein Landesmittel', !bw.verfuegbar && bw.grund === 'zu_wenig_saetze',
    Z['BW|EZFH'] ? Z['BW|EZFH'].saetze + ' Sätze / ' + Z['BW|EZFH'].ausschuesse + ' Ausschüsse' : '–');
  pruefe('B', 'B13g', 'Gewerbe und RND außerhalb 5–80: kein Landesmittel',
    !LZN.lzsLandesmittel({ ags: '06411000', objektart: 'buero' }).verfuegbar && !LZN.lzsLandesmittel({ ags: '06411000', objektart: 'mfh', rnd: 90 }).verfuegbar);
  if (WPS && WPS.zinsHerkunft) {
    const h = WPS.zinsHerkunft({ wert: lm.pct, stufe: 'N', dealpilot_landesmittel: true, pct_von: lm.pct_von, pct_bis: lm.pct_bis,
      spanne_deckung: lm.spanne_deckung, formel: { weg: 'landesmittel', ...lm.landesmittel } });
    pruefe('B', 'B13h', 'Herkunft: Ebene dealpilot_landesmittel, unter A, Etikett mit Land/Objektart/Jahrgang, Spanne',
      h.ebene === 'dealpilot_landesmittel' && h.unter_a === true && /^DealPilot-Landesmittel aus [0-9]+ amtlichen Zinssätzen [(]Hessen, Mehrfamilienhäuser, Jahrgänge? [0-9]{4}/.test(h.etikett)
      && h.spanne && h.spanne.pct_von === lm.pct_von && !!h.weg, h.etikett);
    const hF = WPS.zinsHerkunft({ wert: efhF.pct, stufe: 'N', dealpilot_formel: true, pct_von: efhF.pct_von, pct_bis: efhF.pct_bis, spanne_deckung: efhF.spanne_deckung, formel: efhF.formel });
    pruefe('B', 'B13i', 'E4: Formel-Herkunft trägt die Spanne', hF.ebene === 'dealpilot_formel' && hF.spanne && hF.spanne.pct_bis === efhF.pct_bis);
  } else hinweise.push('B13h/i übersprungen: WertParameterService nicht geladen');
  /* Ertragswertwirkung (Kern): MFH 6 WE, Rohertrag 36.000, RND 30 - Formel gegen Landesmittel */
  const fMfh = LZN.lzsNaeherung({ ags: '06411000', objektart: 'mfh', rnd: 30 });
  const kF = ertragswert(Object.assign(einOk(), { lzs_pct: fMfh.pct, lzs_stufe: 'N', rnd_jahre: 30 }), bwOk());
  const kL = ertragswert(Object.assign(einOk(), { lzs_pct: lm.pct, lzs_stufe: 'N', rnd_jahre: 30 }), bwOk());
  pruefe('B', 'B13j', 'Ertragswert rechnet mit dem Landesmittel (Stufe N)', kL.wert > 0 && kL.lzs.stufe === 'N' && kL.wert !== kF.wert,
    'Formel ' + fMfh.pct + ' % → ' + eur(kF.wert) + ' · Landesmittel ' + lm.pct + ' % → ' + eur(kL.wert));
});

/* B14 · v2612 · UK-FORMEL 0,5- BIS 3,0-FACH, ZWEITER AST OBERHALB 2,5.
   E5 (v2610: Kappung bei 2,0) zurueckgenommen - die Begruendung kam aus einer
   Teilmenge. Geprueft wird die Geltung, beide Aeste und die Messung an der
   GENAUEN Stuetzstelle (uk-naeherung.json pruefung_genau): die Naeherung muss
   dort im Median besser sein als ohne Anpassung, sonst gehoert der Ast gekappt. */
let UKF = null;
try { UKF = await lade('lib/umrechnung_flaeche.js'); } catch (e) { UKF = null; }
fallB('B14', () => {
  if (!UKF || !UKF.naeherung) return pruefe('B', 'B14', 'umrechnung_flaeche geladen', false, 'fehlt');
  const j = JSON.parse(fs.readFileSync(path.join(SRC, 'lib/uk-naeherung.json'), 'utf8'));
  const o = j.oberhalb || {};
  pruefe('B', 'B14a', 'uk-naeherung.json: Geltung bis 3,0, zweiter Ast ab 2,5', j.gilt_fuer.verhaeltnis_bis === 3 && o.ab === 2.5 && o.rest_faktor > 0,
    'bis ' + j.gilt_fuer.verhaeltnis_bis + ', Restfaktor ' + o.rest_faktor);
  const n = (fl) => UKF.naeherung({ objektart: 'efh', flaeche_qm: fl, bezugsgroesse_qm: 600, brw_eur_qm: 200, geschosszahl: 'II' });
  const b = j.alle.b, r4 = (x) => Math.round(x * 10000) / 10000;
  const k25 = n(1500), k30 = n(1800);
  wert('B', 'B14b', '2,5-fach: Potenz (2,5)^b', k25.verfuegbar ? k25.koeffizient_bauland : null, r4(Math.pow(2.5, b)), 0.0001);
  wert('B', 'B14c', '3,0-fach: zweiter Ast (2,5^b·2,5 + 0,5·c)/3', k30.verfuegbar ? k30.koeffizient_bauland : null, r4((Math.pow(2.5, b) * 2.5 + 0.5 * o.rest_faktor) / 3), 0.0001);
  const ueber = n(1806);
  pruefe('B', 'B14d', '3,01-fach: keine Näherung (ausserhalb_bereich)', !ueber.verfuegbar && ueber.grund === 'ausserhalb_bereich', ueber.grund);
  const g = j.pruefung_genau || {}, g25 = g.bei_2_5 || {}, g30 = g.bei_3_0_zweiter_ast || {};
  pruefe('B', 'B14e', 'genaue Stützstelle, alle Tabellen: Näherung bei 2,5 und 3,0 besser als ohne Anpassung (Median)',
    g25.naeherung_median_pct < g25.ohne_anpassung_median_pct && g30.naeherung_median_pct < g30.ohne_anpassung_median_pct,
    '2,5: ' + g25.naeherung_median_pct + ' gegen ' + g25.ohne_anpassung_median_pct + ' % · 3,0: ' + g30.naeherung_median_pct + ' gegen ' + g30.ohne_anpassung_median_pct + ' %');
});

/* ══ EBENE C ═════════════════════════════════════════════════════════ */
const auszug = (cc) => {
  const e = (cc && cc.ertragswert) || {}, s = (cc && cc.sachwert) || {};
  return {
    ertragswert: e.available ? e.value_eur : null,
    rohertrag: e.available ? e.rohertrag_pa_eur : null,
    bwk: e.available ? e.bwk_pa_eur : null,
    reinertrag: e.available ? e.reinertrag_pa_eur : null,
    lzs_pct: e.available ? e.liegenschaftszins_pct : null,
    rnd_jahre: e.available ? e.restnutzungsdauer_jahre : null,
    vervielfaeltiger: e.available ? e.vervielfaeltiger : null,
    bodenwert: e.available ? (e.bodenwert_eur ?? null) : null,
    sachwert: s.available ? (s.value_eur ?? null) : null,
  };
};
if (EINFRIEREN) {
  const fang = JSON.parse(fs.readFileSync(EINFRIEREN, 'utf8'));
  const alt = F.ebene_c && F.ebene_c.faelle ? F.ebene_c.faelle : {};
  const neu = {};
  for (const [name, v] of Object.entries(fang)) {
    if (!v.argumente) continue;
    neu[name] = { markt: v.markt, erfasst: v.ergebnis, frueher: (alt[name] && alt[name].frueher) || null,
                  anmerkung: (alt[name] && alt[name].anmerkung) || null,
                  soll: auszug(compute(...klon(v.argumente))), argumente: '__ARG_' + name + '__' };
  }
  F.ebene_c = Object.assign({}, F.ebene_c || {}, { stand: '2026-10-21', faelle: neu });
  /* die Argumente je Fall in EINER Zeile - sonst wird die Datei 20.000 Zeilen lang */
  let text = JSON.stringify(F, null, 2);
  for (const [name, v] of Object.entries(fang)) {
    if (v.argumente) text = text.replace('"__ARG_' + name + '__"', () => JSON.stringify(v.argumente));
  }
  fs.writeFileSync(FALLDATEI, text + '\n');
  console.log('Ebene C eingefroren: ' + Object.keys(neu).length + ' Fälle → ' + path.relative(WURZEL, FALLDATEI));
  process.exit(0);
}
for (const [name, fall] of Object.entries(C.faelle || {})) {
  E.C.faelle++;
  try {
    const ist = auszug(compute(...klon(fall.argumente)));
    for (const [k, soll] of Object.entries(fall.soll)) {
      const tol = (k === 'lzs_pct' || k === 'rnd_jahre' || k === 'vervielfaeltiger') ? 0.0001 : 0;
      wert('C', name, k, ist[k] ?? null, soll, tol);
    }
  } catch (err) { pruefe('C', name, 'Lauf', false, 'Ausnahme: ' + err.message); }
}

/* ══ AUSGABE ═════════════════════════════════════════════════════════ */
if (ALLE) detail.forEach((z) => console.log(z));
const titel = { A: 'amtliche Anwendungsbeispiele', B: 'Prompt-Testfälle 1–11', C: 'Demo-Objekte (eingefroren ' + (C.stand || '–') + ')' };
console.log('wertermittlung-pruefen v2595 · Uhr ' + new _Date(FEST).toISOString().slice(0, 10));
for (const eb of ['A', 'B', 'C']) {
  const x = E[eb];
  console.log('  Ebene ' + eb + ' ' + titel[eb].padEnd(38) + x.faelle + ' Fälle, ' + x.werte + ' Werte, '
    + (x.werte - x.rot) + ' grün, ' + x.rot + ' rot' + (x.offen ? ', ' + x.offen + ' Entscheidung offen' : ''));
}
const fns = Object.keys(ruf);
console.log('  Deckung: ' + geladen.length + ' Dateien echt geladen (' + geladen.map((g) => path.basename(g, '.js')).join(', ') + ')'
  + (VS ? '' : '; ValuationService NICHT geladen: ' + vsGrund) + (pgGestellt ? '; pg gestellt' : ''));
console.log('  Gerufen: ' + fns.map((n) => n.replace(/^.*\./, '') + ' ' + ruf[n] + '×').join(', '));
const PFLICHT = ['ErtragswertService.ertragswert', 'ErtragswertService.bodenwert', 'CrossCheckService.compute', 'nhk2010.sachwert', 'barwertfaktor', 'abzinsungsfaktor'];
const ungerufen = PFLICHT.filter((n) => !ruf[n]);
if (ungerufen.length) { console.log('  PRUEFER KAPUTT: nie gerufen: ' + ungerufen.join(', ')); process.exit(2); }
if (!Object.keys(C.faelle || {}).length) { console.log('  PRUEFER KAPUTT: Ebene C leer'); process.exit(2); }
if (rotListe.length) {
  console.log('ROT (' + rotListe.length + '):');
  rotListe.slice(0, 14).forEach((z) => console.log('  ' + z));
  if (rotListe.length > 14) console.log('  … ' + (rotListe.length - 14) + ' weitere (--alle)');
}
if (offenListe.length && !ALLE) {
  console.log('Entscheidung offen (IST geprüft, kein Rot):');
  offenListe.forEach((z) => console.log('  ' + (z.length > 150 ? z.slice(0, 147) + '…' : z)));
}
hinweise.forEach((h) => console.log('HINWEIS ' + (h.length > 160 ? h.slice(0, 157) + '…' : h)));
console.log(rotListe.length ? 'RC=1' : 'RC=0 sauber');
process.exit(rotListe.length ? 1 : 0);
