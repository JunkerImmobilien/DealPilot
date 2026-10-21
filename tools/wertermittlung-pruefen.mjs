#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/wertermittlung-pruefen.mjs · v2580 · v2595 · v2600
   v2600: E1 Band am Satz des Ausschusses (Anker ± 20 %), E2 Mietabweichung als boG
   (A-E6 Anlage 3 Beispiel 1, B13-B15), E3 Leerstand mit/ohne Abzug (B4, B16), E4
   Spanne der DealPilot-Formel (B17), E10 negativer Gebaeudereinertrag (A-E5 jetzt
   echte Pruefung), Prompt-Test 8 Doppelzaehlung (B8b). Ebene C rechnet mit den
   Modellansaetzen des verwendeten Registersatzes (wie ReportOrchestrator seit v2595).
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
const barwertAbweichungen = zaehle('barwertAbweichungen', IW.barwertAbweichungen);
const barwertAbweichung = zaehle('barwertAbweichung', IW.barwertAbweichung);
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
      if (s.liquidationshinweis_bodenwert != null) wert('A', id, 'Bodenwert als Liquidationshinweis daneben',
        k.liquidationshinweis ? k.liquidationshinweis.bodenwert_eur : null, s.liquidationshinweis_bodenwert, 0);
    } else if (f.art === 'bog_barwert') {
      /* v2600 · E2 · der Mehrertrag je Jahr abgezinst mit dem Liegenschaftszins (EW-RL Nr. 11.1) */
      const b = barwertAbweichungen(e.differenzen, e.lzs_pct);
      wert('A', id, 'Barwert der Abweichung (Summe der abgezinsten Jahre)', b, s.summe, t.euro);
      wert('A', id, 'boG gerundet (Dokument)', b == null ? null : Math.round(b / t.rundung_dokument) * t.rundung_dokument, s.bog, 0);
      const kB = ertragswert(Object.assign(einManuell(fr.ertragswert), { bog_posten: [{ pos: 'besonderes objektspezifisches Merkmal: Mietabweichung', wert: s.bog }] }), bwEinfach(fr.ertragswert.bodenwert));
      wert('A', id, 'Ertragswert mit boG-Zeile (Summe vor Rundung)', kB.wert_ungerundet, s.ertragswert_summe, t.euro);
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
/* v2600 · Die eingefrorenen Argumente (Erfassung vor v2595) fuehren lzs_modellansaetze noch
   nicht. Der ReportOrchestrator reicht seit v2595 die Modellansaetze DES Satzes durch, dessen
   Zins der Ertragswert nutzt (nur aus dem Register, nicht ausserhalb der Geltung). Der Pruefer
   holt sie aus der ECHTEN Registerdatei - gleiche AGS, gleicher Zweig, gleiches Berichtsjahr,
   genau ein Treffer -, sonst bleibt das Feld leer. Nichts abgeschrieben. */
const REG = (() => {
  const d = path.join(SRC, 'lib/register'), alle = [];
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith('.json')) continue;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); } catch (e) { continue; }
    for (const s of (Array.isArray(j) ? j : (j.saetze || []))) if (s && s.kennzahl === 'liegenschaftszinssatz') alle.push(s);
  }
  return alle;
})();
const satzFuer = (p) => {
  if (!p || !p.lzs_aus_register || (p.lzs_rueckfrage && p.lzs_rueckfrage.grund === 'ausserhalb_geltung')) return null;
  const ags = String(p.ags || '');
  const h = REG.filter((s) => s.ags && (ags === String(s.ags) || ags.startsWith(String(s.ags))) && s.zweig === p.lzs_zweig
    && Number(s.berichtsjahr) === Number(p.lzs_berichtsjahr));
  return h.length === 1 && h[0].modellansaetze && typeof h[0].modellansaetze === 'object' ? h[0].modellansaetze : null;
};
const mitSatz = (a) => { if (a[4] && a[4].lzs_modellansaetze === undefined) a[4].lzs_modellansaetze = satzFuer(a[4]); return a; };
const ccFall = (name, aendern, opt = {}) => {
  const fall = C.faelle[name];
  if (!fall) return null;
  const a = klon(fall.argumente);
  if (!opt.ohneSatz) mitSatz(a);
  if (aendern) aendern(a);
  return compute(...a);
};
const einOk = () => ({ objektart: 'mfh', baujahr: 1990, baustatus: 'bestand', wohnflaeche_qm: 400, anzahl_we: 6,
  stichtag_jahr: 2026, miete_markt_jahr: 36000, lzs_pct: 3.0, lzs_stufe: 'A', rnd_jahre: 40 });
const bwOk = () => bwEinfach(200000);
function fallB(id, fn) { E.B.faelle++; try { fn(); } catch (err) { pruefe('B', id, 'Lauf', false, 'Ausnahme: ' + err.message); } }

/* B1-B3 · am ECHTEN Band des Falls Westerfeld. v2600 (E1, Marcel 21.10.2026): Anker = Ø Miete
   des verwendeten Satzes (Bielefeld MFH 2025: 7,70 €/m²), Band ± 20 %; ausserhalb gilt der
   ANKER (ImmoWertA zu § 31 c), nicht mehr die Kante. Vorher (v2595): Band 9,50 × 0,7 bis
   × 1,15 um die Angebotsmiete; B2/B3 standen als „Entscheidung offen". */
const W = ccFall('westerfeld_body');
const band = W && W.ertragswert && W.ertragswert.miete_band;
const markt = band ? band.anker_qm : null;
fallB('B1', () => {
  if (!band) return pruefe('B', 'B1', 'Band aus Ebene C', false, 'westerfeld_body fehlt');
  pruefe('B', 'B1', 'Anker = Ø Miete des Satzes (Stufe satz_mittel), Band ± 20 %', band.anker_stufe === 'satz_mittel' && band.anker_qm === 7.7
    && band.unten_qm === 6.16 && band.oben_qm === 9.24, band.anker_stufe + ' ' + band.anker_qm + ', ' + band.unten_qm + '–' + band.oben_qm);
  const r = mieteNachBand(markt, band, markt);
  pruefe('B', 'B1', 'Ist ≈ Markt wird angesetzt', r.fuehrt === true && r.qm === markt, 'Ist ' + markt + ' €/m², Band ' + band.unten_qm + '–' + band.oben_qm);
  pruefe('B', 'B1', 'Stufe der Miete im Ergebnis benannt', !!(W.ertragswert.miete_stufe && W.ertragswert.miete_stufe.code === 'satz_mittel' && /Ø Miete/.test(W.ertragswert.miete_stufe.etikett)));
});
fallB('B2', () => {
  if (!band) return;
  const ist = Math.round(markt * 0.8 * 100) / 100, r = mieteNachBand(ist, band, markt);
  pruefe('B', 'B2', 'Ist −20 % (Bandgrenze) im Band → Ist angesetzt (ImmoWertA zu § 31 a)', r.lage === 'im_band' && r.qm === ist, 'Ist ' + ist + ' €/m²');
  const ist2 = Math.round(markt * 0.75 * 100) / 100, r2 = mieteNachBand(ist2, band, markt);
  pruefe('B', 'B2', 'Ist −25 % unter dem Band → marktüblicher Ansatz = Anker, nicht die Kante', r2.lage === 'unter' && r2.qm === markt && r2.kante === band.unten_qm, 'Ist ' + ist2 + ' → ' + r2.qm);
});
fallB('B3', () => {
  if (!band) return;
  const ist = Math.round(markt * 1.2 * 100) / 100, r = mieteNachBand(ist, band, markt);
  pruefe('B', 'B3', 'Ist +20 % (Bandgrenze) im Band → Ist angesetzt', r.lage === 'im_band' && r.qm === ist, 'Ist ' + ist);
  const ist2 = Math.round(markt * 1.25 * 100) / 100, r2 = mieteNachBand(ist2, band, markt);
  pruefe('B', 'B3', 'Ist +25 % über dem Band → Anker, keine dauerhafte Kapitalisierung des Mehrertrags', r2.lage === 'ueber' && r2.qm === markt, 'Ist ' + ist2 + ' → ' + r2.qm);
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
  const W0 = ccFall('westerfeld_body', null, { ohneSatz: true });
  const ohne = W0 && W0.ertragswert;
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
  wert('B', 'B12d', 'Ertragswert gleich mit und ohne Satz (Ist im Band beider Anker)', e.value_eur, W0.ertragswert.value_eur, 0);
  /* v2600 · Satz-Miete 44 % unter der Ist-Miete. Seit E1 ist der Satz der Anker: die Wohnungen
     liegen ausserhalb seines Bandes, angesetzt wird seine Ø Miete - die Abweichung ist damit
     AUSGERAEUMT, und der Belastbarkeitsabzug der Modellpruefung greift nicht zusaetzlich (kein
     Doppelansatz). Vorher (v2595): Miete abweichend, −8, Ertragswert unveraendert 785.000. */
  const mq = mp.merkmale.miete.ansatz;
  const ma44 = Object.assign({}, satzBielefeld, { marktmiete_eur_qm: Math.round(mq / 1.44 * 100) / 100 });
  const ab = ccFall('westerfeld_body', (a) => { a[4].lzs_modellansaetze = ma44; });
  const e2 = ab && ab.ertragswert, mp2 = e2 && e2.modellpruefung;
  pruefe('B', 'B12e', 'Satz-Miete −44 %: angesetzt die Ø Miete des Satzes, Modellprüfung „im Modell", kein −8',
    !!mp2 && mp2.merkmale.miete.status === 'im_modell' && e2.miete_modellkonform === true
    && !(e2.belastbarkeit.abzuege || []).some((a) => /Miete außerhalb des Modells/.test(a))
    && e2.miete_stufe.code === 'satz_mittel' && Math.abs(e2.miete_herkunft.angesetzt_qm - ma44.marktmiete_eur_qm) < 0.011,
    mp2 ? mp2.merkmale.miete.abweichung_pct + ' %, angesetzt ' + e2.miete_herkunft.angesetzt_qm : '–');
  pruefe('B', 'B12f', 'Mehrertrag ohne Laufzeit: nur Szenarien, Ertragswert ohne boG, „vorläufig" benannt',
    !!e2 && e2.miete_bog && e2.miete_bog.n_offen === 4 && e2.miete_bog.n_angesetzt === 0 && e2.vorlaeufig_vor_bog === true
    && ab.ertragswert_kern.wert_ungerundet === e2.vorlaeufiger_ertragswert_eur + ((ab.ertragswert_kern.staffel.find((x) => x.pos === 'besondere objektspezifische Merkmale') || {}).wert || 0)
    && /Szenarien, keine gesetzliche Annahme/.test((ab.notes || []).join(' ')), e2 ? 'EW ' + e2.value_eur + ' (vorher 785.000)' : '–');
  /* die Modellpruefung meldet weiter, wo der Anker NICHT der Satz ist: amtliche Miete fuehrt
     (AGVGA-Modell), der Satz fuehrt eine 44 % niedrigere Ø Miete -> abweichend, −8 */
  const amt = ccFall('westerfeld_body', (a) => { a[4].lzs_modellansaetze = ma44; a[4].modellversion = 'agvga_nrw_2016';
    a[4].amtliche_miete = { verfuegbar: true, fuehrend: true, miete_qm: mq, quelle: 'Prüfer' }; });
  const e3 = amt && amt.ertragswert, mp3 = e3 && e3.modellpruefung;
  pruefe('B', 'B12g', 'Anker amtlich, Satz −44 %: Modellprüfung abweichend, Kundentext nennt beide Mieten',
    !!mp3 && e3.miete_stufe.code === 'amtlich' && mp3.merkmale.miete.status === 'abweichend' && e3.miete_modellkonform === false
    && /liegt 44 % über der Durchschnittsmiete, aus der der Gutachterausschuss den Liegenschaftszins abgeleitet hat/.test(mp3.text), mp3 ? mp3.text.slice(0, 80) : '');
  wert('B', 'B12h', 'dort −8 Belastbarkeit (Miete außerhalb des Modells)', e3 ? (e3.belastbarkeit.vor_modellpruefung || e3.belastbarkeit.pct) - e3.belastbarkeit.pct - (mp3.merkmale.rnd.status === 'abweichend' ? 8 : 0) - (mp3.merkmale.flaeche.status === 'abweichend' ? 8 : 0) : null, 8, 0);
  const ohneMiete = ccFall('westerfeld_body', (a) => { const m = Object.assign({}, satzBielefeld); delete m.marktmiete_eur_qm; a[4].lzs_modellansaetze = m; });
  pruefe('B', 'B12i', 'Satz ohne Ø Miete → modellkonform null („nicht prüfbar"), −3, Anker fällt auf die Angebotsmiete', !!ohneMiete && ohneMiete.ertragswert.miete_modellkonform === null
    && /nicht prüfbar/.test(ohneMiete.ertragswert.miete_modellkonform_grund || '') && e.belastbarkeit.pct - ohneMiete.ertragswert.belastbarkeit.pct === 3
    && ohneMiete.ertragswert.miete_stufe.code === 'angebot');
});
fallB('B4', () => {
  const L = ccFall('demo2leer');
  if (!L) return pruefe('B', 'B4', 'Fall demo2leer', false, 'fehlt in Ebene C');
  const k = L.ertragswert_kern || {};
  const roh = (k.staffel || []).find((z) => /^Rohertrag Wohnen/.test(z.pos));
  const ok = roh && /leere Fläche .* marktüblicher Miete/.test(roh.detail || '')
    && !(k.staffel || []).some((z) => /Leerstand|Herrichtung|Vermarktung|Mietausfall.*Leer/i.test(z.pos));
  /* v2600 · E3: Standard bleibt „voll vermietet" (Marcel 21.10.2026), benannt als vorlaeufiger
     Ertragswert vor boG; der Abzug ist je leerer Wohnung waehlbar (B16). Vorher: Entscheidung offen. */
  pruefe('B', 'B4', 'Leerstand mit Marktmiete, kein Abzug voreingestellt, „vorläufig vor boG" benannt', !!ok
    && L.ertragswert.vorlaeufig_vor_bog === true && /vor besonderen objektspezifischen/.test(L.ertragswert.bezeichnung || ''),
    roh ? String(roh.detail).slice(0, 60) : 'keine Rohertragszeile');
});
/* B4b · Leerstand OHNE jede Vergleichsmiete (kein Angebot, keine amtliche Miete):
   gemessen 21.10.2026 - die Ist-Miete der vermieteten Wohnungen wird auf die GANZE
   Wohnflaeche verteilt, die leere Wohnung traegt nichts, und der Ertragswert erscheint
   als "Ist-Miete (marktueblich)". Gemeldet, nicht geaendert (Entscheidung: Wert
   unterdruecken oder anderer Mietansatz). */
fallB('B4b', () => {
  const ohneMarkt = (a) => { a[2] = { listing_type: 'miete', source: 'keine_daten', sample_size: 0, median_per_sqm: null, comparables: [] }; };
  const L = ccFall('demo2leer', ohneMarkt, { ohneSatz: true }), V = ccFall('demo', ohneMarkt, { ohneSatz: true });   /* v2600: der Satz waere sonst der Anker */
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

/* ══ v2600 · E2 · MIETABWEICHUNG ALS boG (B20-B22), E3 (B23), E4 (B24), Prompt-Test 8 (B8b) ══ */
const westerfeldMit = (fn) => ccFall('westerfeld_body', (a) => { fn(a[0].einheiten_miete[0], a); });
const anteil = (e) => e && e.ertragswert;
/* der eigene boG des Objekts (Westerfeld: Sanierungskosten −26.000 €) steht unveraendert daneben */
const eigenerBog = (r) => { const z = ((r && r.ertragswert_kern && r.ertragswert_kern.staffel) || []).find((s) => s.pos === 'besondere objektspezifische Merkmale'); return z ? z.wert : 0; };
fallB('B20', () => {
  /* WE 1 mit 500 €/Monat (5,13 €/m²) unter dem Band 6,16-9,24; Restlaufzeit 5 Jahre (Eingabe) */
  const r = westerfeldMit((w) => { w.ist_monat = 500; w.mv_abw_jahre = 5; }), e = anteil(r);
  const z = e && e.miete_bog && e.miete_bog.zeilen[0];
  const f = 390 / 390, diff = Math.round(500 * 12 * f) - Math.round(7.7 * 97.5 * 12);
  pruefe('B', 'B20', 'Underrent mit Laufzeit → boG angesetzt', !!z && z.angesetzt && z.art === 'underrent' && z.jahre === 5 && z.jahre_quelle === 'eingabe', z ? JSON.stringify(z).slice(0, 90) : '–');
  wert('B', 'B20', 'boG = Differenz × Barwertfaktor (2,5 % / 5 J.)', z ? z.barwert_eur : null, barwertAbweichung(diff, e.liegenschaftszins_pct, 5), 0);
  const kz = (r.ertragswert_kern.staffel || []).find((s) => /Merkmal: Mietabweichung/.test(s.pos));
  pruefe('B', 'B20', 'eigene boG-Zeile nach dem vorläufigen Ertragswert, Ertragswert = vorläufig + boG', !!kz && kz.wert === z.barwert_eur
    && r.ertragswert_kern.wert_ungerundet === e.vorlaeufiger_ertragswert_eur + z.barwert_eur + eigenerBog(r) && e.vorlaeufig_vor_bog === false && e.bezeichnung === 'Ertragswert');
});
fallB('B21', () => {
  const r = westerfeldMit((w) => { w.ist_monat = 500; }), e = anteil(r);
  const b = e && e.miete_bog;
  pruefe('B', 'B21', 'ohne Laufzeit: Szenarien 3/5/10 Jahre, nichts angesetzt', !!b && b.n_angesetzt === 0 && b.n_offen === 1
    && b.szenarien.map((s) => s.jahre).join() === '3,5,10' && b.szenarien[0].barwert_eur < 0 && b.szenarien[2].barwert_eur < b.szenarien[0].barwert_eur);
  pruefe('B', 'B21', 'Ertragswert ohne boG, als vorläufig benannt, Satz nennt die Spanne in €', !!e && e.vorlaeufig_vor_bog
    && r.ertragswert_kern.wert_ungerundet === e.vorlaeufiger_ertragswert_eur + eigenerBog(r)
    && (r.notes || []).some((n) => /Je nach Dauer macht sie −[\d.]+ € \(3 Jahre\) bis −[\d.]+ € \(10 Jahre\) aus — Szenarien, keine gesetzliche Annahme/.test(n)));
});
fallB('B22', () => {
  /* WE 1 mit 1.100 €/Monat (11,28 €/m²) ueber dem Band: Mehrertrag */
  const r1 = westerfeldMit((w) => { w.ist_monat = 1100; w.mv_abw_jahre = 5; }), b1 = r1 && r1.ertragswert.miete_bog;
  pruefe('B', 'B22', 'Overrent mit „erwartet noch 5 Jahre" (unbelegt) → nur Szenario', !!b1 && b1.n_angesetzt === 0 && b1.zeilen[0].art === 'overrent'
    && /belegter Vertragslaufzeit/.test(b1.zeilen[0].grund || ''));
  const r2 = westerfeldMit((w) => { w.ist_monat = 1100; w.mv_befristet_bis = '2029-10-21'; }), b2 = r2 && r2.ertragswert.miete_bog;
  const z = b2 && b2.zeilen[0];
  pruefe('B', 'B22', 'Overrent mit Befristung bis 21.10.2029 → 3 Jahre angesetzt', !!z && z.angesetzt && z.jahre === 3 && z.jahre_quelle === 'befristung' && z.barwert_eur > 0);
  wert('B', 'B22', 'boG = Mehrertrag × Barwertfaktor (2,5 % / 3 J.)', z ? z.barwert_eur : null, barwertAbweichung(z ? z.differenz_jahr : 0, r2.ertragswert.liegenschaftszins_pct, 3), 0);
});
fallB('B23', () => {
  const L0 = ccFall('demo2leer');
  const L1 = ccFall('demo2leer', (a) => { const w = a[0].einheiten_miete.find((x) => x.leer); w.leer_abzug = true; w.leer_monate = 6; w.herrichtung_eur = 5000; });
  const e0 = L0 && L0.ertragswert, e1 = L1 && L1.ertragswert;
  pruefe('B', 'B23', 'ohne Option: kein Leerstandsabzug', !!e0 && !e0.leerstand_bog && !(L0.ertragswert_kern.staffel || []).some((s) => /Merkmal: Leerstand/.test(s.pos)));
  const z = e1 && e1.leerstand_bog && e1.leerstand_bog.zeilen[0];
  const anker = e1 ? e1.miete_stufe.qm : null, wfl = L1 ? L1.ertragswert.miete_aufteilung.einheiten.find((x) => x.herkunft === 'leer_marktueblich').wfl : null;
  wert('B', 'B23', 'mit Option: Mietausfall 6 Monate = Marktmiete × Fläche × 6', z ? z.mietausfall_eur : null, Math.round(Math.round(anker * wfl * 12) / 12 * 6), 0);
  wert('B', 'B23', 'Ertragswert (ungerundet) = vorläufig − Mietausfall − 5.000 Herrichtung', L1 ? L1.ertragswert_kern.wert_ungerundet : null,
    e1 ? e1.vorlaeufiger_ertragswert_eur - z.mietausfall_eur - 5000 + eigenerBog(L1) : null, 0);
  pruefe('B', 'B23', 'zweite leere Wohnung ohne Abzug → weiter „vorläufig"', !!e1 && e1.vorlaeufig_vor_bog === true);
});
fallB('B24', () => {
  /* E4 · Stufe N mit Spanne (Halbbreite MFH 1,16 Pp, lzs-naeherung.json) */
  const r = ccFall('westerfeld_body', (a) => { a[4].lzs_stufe = 'N'; a[4].lzs_pct = 3.45; a[4].lzs_formel = { spanne_p80_pp: 1.16 }; });
  const s = r && r.ertragswert.lzs_spanne;
  pruefe('B', 'B24', 'Stufe N: Spanne 2,29–4,61 % und Ertragswert an beiden Rändern', !!s && s.von_pct === 2.29 && s.bis_pct === 4.61
    && s.ertragswert_von_eur < r.ertragswert.value_eur && s.ertragswert_bis_eur > r.ertragswert.value_eur
    && /8 von 10 amtlichen Zinssätzen vergleichbarer Objekte/.test(s.text), s ? s.text : 'keine Spanne');
  const k = ertragswert(Object.assign({}, r._ertragswertEingabe.ein, { lzs_pct: 4.61 }), r._ertragswertEingabe.bodenwert);
  wert('B', 'B24', 'unterer Rand = derselbe Kern mit 4,61 %', s ? s.ertragswert_von_eur : null, k.wert, 0);
  const r2 = ccFall('westerfeld_body', (a) => { a[4].lzs_stufe = 'N'; a[4].lzs_pct = 3.45; a[4].lzs_formel = {}; });
  pruefe('B', 'B24', 'ohne Spannenfelder entfällt die Spanne still', !!r2 && r2.ertragswert.available && r2.ertragswert.lzs_spanne === undefined);
});
fallB('B8b', () => {
  /* Prompt-Test 8: die Abweichung steht schon als eigener boG im Objekt -> keine Doppelzaehlung */
  const r = westerfeldMit((w, a) => { w.ist_monat = 500; w.mv_abw_jahre = 5; a[4].bog_eur = -20000; a[4].bog_grund = 'Mietabweichung WE 1 (Underrent), eigene Berechnung'; });
  const e = r && r.ertragswert;
  pruefe('B', 'B8b', 'eigener boG mit Mietbezug → berechnete Mietabweichung nicht zusätzlich', !!e && e.bog_doppelt_vermieden === true
    && !(r.ertragswert_kern.staffel || []).some((s) => /Merkmal: Mietabweichung/.test(s.pos))
    && r.ertragswert_kern.wert_ungerundet === e.vorlaeufiger_ertragswert_eur - 20000
    && (r.notes || []).some((n) => /nur einmal berücksichtigt/.test(n)));
});

/* ══ v2660 · E7 · VERGLEICHSWERT AUS DEM IMMOBILIENRICHTWERT (B30–B34) ══════
   Eingefrorene IRW-Abrufe in der Falldatei (ebene_b.B30/B31.irw_eingefroren), gerechnet
   ueber den ECHTEN CrossCheckService; die Sollzahl kommt aus dem ECHTEN Kern
   (vergleichswertIrw) mit denselben Merkmalen bzw. aus irw-pruefen --live (329.932 €). */
let VIRW = null;
try { VIRW = await lade('lib/vergleichswert_irw.js'); } catch (e) { VIRW = null; }
const irwB30 = F.ebene_b.B30 && F.ebene_b.B30.irw_eingefroren;
const irwB31 = F.ebene_b.B31 && F.ebene_b.B31.irw_eingefroren;
fallB('B30', () => {
  if (!irwB30 || !VIRW) return pruefe('B', 'B30', 'eingefrorener IRW / Kern', false, 'fehlt');
  const alt = ccFall('loehner');
  const r = ccFall('loehner', (a) => { a[4].irw = klon(irwB30); });
  const v = r && r.vergleichswert_irw, c = r && r.comparison;
  wert('B', 'B30', 'Vergleichswert Löhner Str. 278 (IRW 1.700 × 0,833 × 233 m²)', v && v.verfuegbar ? v.vergleichswert_eur : null, 329932, 0);
  wert('B', 'B30', 'angepasster Richtwert €/m²', v && v.verfuegbar ? v.wert_qm : null, 1416, 0);
  pruefe('B', 'B30', 'Stufe A, Rechenweg Zeile für Zeile (IRW, 7 Koeffizienten, = angepasst, × Fläche, = Vergleichswert)',
    !!v && v.stufe === 'A' && v.rechenweg.length === 11 && /Immobilienrichtwert/.test(v.rechenweg[0].pos) && v.rechenweg[10].pos === '= Vergleichswert',
    v ? v.rechenweg.map((z) => z.pos).join(' | ') : '');
  pruefe('B', 'B30', 'comparison: Bezeichnung „Vergleichswert (§ 24 ImmoWertV, Immobilienrichtwert)", Basis Kaufpreise',
    !!c && c.vergleichswert_eur === 329932 && c.bezeichnung === 'Vergleichswert (§ 24 ImmoWertV, Immobilienrichtwert)'
    && c.basis === 'kaufpreise' && c.basis_art === 'immobilienrichtwert', c ? c.bezeichnung + ' ' + c.vergleichswert_eur : '');
  pruefe('B', 'B30', 'Marktpreisindikation bleibt getrennt (angebotswert_eur unverändert)',
    !!c && !!alt && c.angebotswert_eur === alt.comparison.angebotswert_eur && alt.comparison.bezeichnung === 'Marktpreisindikation aus Angebotspreisen');
  pruefe('B', 'B30', 'EFH/ZFH mit amtlichem Sachwertfaktor: Sachwert führt, Vergleichswert zweites Verfahren',
    !!r && r.verfahrenswahl.verfahren === 'sachwert' && (r.verfahrenswahl.weitere || []).includes('vergleichswert'), JSON.stringify(r && r.verfahrenswahl.weitere));
  pruefe('B', 'B30', 'Quellennachweis nennt Immobilienrichtwert und Umrechnungskoeffizienten mit Link',
    !!r && (r.quellen_nachweis || []).some((q) => q.kennzahlen.includes('Immobilienrichtwert und Umrechnungskoeffizienten') && /LGDIR_2_0531000_2026/.test(q.url || '')));
  wert('B', 'B30', 'Ertragswert unverändert', r ? r.ertragswert.value_eur : null, alt ? alt.ertragswert.value_eur : NaN, 0);
  wert('B', 'B30', 'Sachwert unverändert', r ? r.sachwert.value_eur : null, alt ? alt.sachwert.value_eur : NaN, 0);
});
fallB('B31', () => {
  if (!irwB31 || !VIRW) return pruefe('B', 'B31', 'eingefrorener IRW / Kern', false, 'fehlt');
  const essen = { address: 'Rüttenscheider Str. 120, 45131 Essen', units: 9, living_area: 75, build_year: 1975, standardstufe: 3,
    balcony_area: 6, garages: 0, outdoor_parking: 0, usage_type: 'vermietet', floor: 2 };
  const r = ccFall('huellhorst', (a) => { a[4].irw = klon(irwB31); Object.assign(a[0], essen); });
  const v = r && r.vergleichswert_irw;
  const soll = VIRW.vergleichswertIrw({ irw: klon(irwB31), objekt: VIRW.objektAusRef(Object.assign({ property_type: 'wohnung' }, essen)) });
  pruefe('B', 'B31', 'Kern rechnet (Essen ETW: Baujahr, Standard, Vermietung, Stellplatz, Balkon, Einheiten, Fläche)', !!soll.verfuegbar, soll.hinweis || '');
  wert('B', 'B31', 'Vergleichswert ETW Essen = Kern mit denselben Merkmalen', v && v.verfuegbar ? v.vergleichswert_eur : null, soll.vergleichswert_eur, 0);
  pruefe('B', 'B31', 'ETW mit IRW: Vergleichswert führt, Ertragswert zweites',
    !!r && r.verfahrenswahl.verfahren === 'vergleichswert' && (r.verfahrenswahl.weitere || []).includes('ertragswert') && r.ertragswert.available,
    r ? r.verfahrenswahl.verfahren : '');
  pruefe('B', 'B31', 'Stellplätze nicht im IRW: Hinweis steht', !!v && (v.hinweise || []).some((h) => /Stellplätze/.test(h)));
});
fallB('B32', () => {
  const r = ccFall('huellhorst');
  pruefe('B', 'B32', 'Hüllhorst (nicht beschlossen): kein Vergleichswert, Marktpreisindikation, Wahl wie bisher',
    !!r && !r.vergleichswert_irw && r.comparison.basis === 'angebote' && r.comparison.bezeichnung === 'Marktpreisindikation aus Angebotspreisen'
    && r.verfahrenswahl.waere === 'sachwert' && !(r.quellen_nachweis || []).some((q) => /Immobilienrichtwert/.test(q.kennzahlen.join())));
});
fallB('B33', () => {
  if (!irwB30) return;
  const ohneMod = ccFall('loehner', (a) => { a[4].irw = klon(irwB30); a[0].mod_punkte = null; });
  const v = ohneMod && ohneMod.vergleichswert_irw;
  pruefe('B', 'B33', 'ohne Modernisierungspunkte: kein Wert, merkmal_fehlt, Ort der Angabe, Weg zur Umrechnungsvorschrift',
    !!v && v.verfuegbar === false && v.grund === 'merkmal_fehlt' && v.fehlt.includes('modernisierung')
    && /Anlage 2, Reiter Objekt/.test(v.fehlt_text.join()) && /LGDIR_2_0531000_2026/.test((v.weg || {}).url || ''), v ? v.hinweis_kunde : '');
  pruefe('B', 'B33', 'dann zurück zur Marktpreisindikation, Verfahrenswahl wie ohne IRW',
    ohneMod.comparison.basis === 'angebote' && !(ohneMod.verfahrenswahl.weitere || []).length && (ohneMod.notes || []).some((n) => /fehlt die Angabe: Modernisierung/.test(n)));
  const ohneKeller = ccFall('loehner', (a) => { a[4].irw = klon(irwB30); a[0].nhk_typ = null; a[0].keller_dg = null; });
  pruefe('B', 'B33', 'ohne NHK-Typ/Unterkellerung: Keller fehlt (nicht vorbelegt)',
    !!ohneKeller && ohneKeller.vergleichswert_irw.grund === 'merkmal_fehlt' && ohneKeller.vergleichswert_irw.fehlt.join() === 'keller');
  const o = VIRW.objektAusRef({ property_type: 'haus', build_year: 1964, living_area: 233 });
  pruefe('B', 'B33', 'objektAusRef erfindet nichts (nur Baujahr und Fläche)', JSON.stringify(o) === '{"baujahr":1964,"wohnflaeche":233}', JSON.stringify(o));
  const o2 = VIRW.objektAusRef({ property_type: 'haus', property_subtype: 'dhh', nhk_typ: '2.21', usage_type: 'eigennutzung', floor: 0 });
  pruefe('B', 'B33', 'NHK 2.21 + DHH: ohne Keller, Doppelhaushälfte; Eigennutzung = unvermietet; Etage nur bei ETW',
    o2.keller === false && o2.anbauweise === 'doppelhaushaelfte' && o2.vermietet === false && o2.geschoss === undefined, JSON.stringify(o2));
});
fallB('B34', () => {
  if (!irwB30 || !VIRW) return;
  const dhh = { property_type: 'haus', property_subtype: 'dhh', nhk_typ: '2.12', build_year: 1964, living_area: 140, plot_area: 400,
    standardstufe: 3, mod_punkte: 1 };
  const a = VIRW.vergleichswertIrw({ irw: klon(irwB30), objekt: VIRW.objektAusRef(dhh), ersatz_teilmarkt: true });
  pruefe('B', 'B34', 'Herford: DHH über die EFH-Umrechnung (Anbauweise geführt) rechnet', a.verfuegbar === true
    && a.faktoren.some((f) => f.id === 'anbauweise' && Math.abs(f.uk - 0.931) < 1e-9), a.verfuegbar ? 'Anbauweise ' + a.faktoren.find((f) => f.id === 'anbauweise').uk : a.hinweis);
  const saetze = VIRW.ladeSaetze().filter((s) => s.gasl === '31000' && s.zweig === 'efh_zfh')
    .map((s) => Object.assign(klon(s), { formel: Object.assign(klon(s.formel), { merkmale: s.formel.merkmale.filter((m) => m.id !== 'anbauweise') }) }));
  const b = VIRW.vergleichswertIrw({ irw: klon(irwB30), objekt: VIRW.objektAusRef(dhh), ersatz_teilmarkt: true, saetze });
  pruefe('B', 'B34', 'ohne Anbauweise in der Umrechnung: kein Wert (grund teilmarkt)', b.verfuegbar === false && b.grund === 'teilmarkt', b.grund);
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
                  soll: auszug(compute(...mitSatz(klon(v.argumente)))), argumente: '__ARG_' + name + '__' };
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
    const ist = auszug(compute(...mitSatz(klon(fall.argumente))));
    for (const [k, soll] of Object.entries(fall.soll)) {
      const tol = (k === 'lzs_pct' || k === 'rnd_jahre' || k === 'vervielfaeltiger') ? 0.0001 : 0;
      wert('C', name, k, ist[k] ?? null, soll, tol);
    }
  } catch (err) { pruefe('C', name, 'Lauf', false, 'Ausnahme: ' + err.message); }
}

/* ══ AUSGABE ═════════════════════════════════════════════════════════ */
if (ALLE) detail.forEach((z) => console.log(z));
const titel = { A: 'amtliche Anwendungsbeispiele', B: 'Prompt-Testfälle 1–11', C: 'Demo-Objekte (eingefroren ' + (C.stand || '–') + ')' };
console.log('wertermittlung-pruefen v2600 · Uhr ' + new _Date(FEST).toISOString().slice(0, 10));
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
