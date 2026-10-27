#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/wertermittlung-pruefen.mjs · v2580 · v2595 · v2600 · v2790 · v2800
   v2854: Sanierungsstau in den Potenzial-Stufen nicht doppelt (B54, PotenzialService geladen).
   v2825: GEW - Einheit ohne Nutzungsart wird nachgefragt (B53 angepasst).
   v2824: Gewerbe-/Industriegebaeude (GEW) mit Einheiten, Kette Mapper -> Kern (B53).
   v2820: Abnahme v2800 an der ganzen Kette Formular-Liste -> Mapper -> Kern (B52).
   v2800: Wohnungen im Wohn-/Geschaeftshaus je Mietverhaeltnis (B49-B51), Ort der Nutzungsart-Nachfrage (B48).
   v2790: Marcels sieben Entscheidungen vom 22.10.2026 (B43-B48, A-E6 Reinertragsdifferenz aus der Tabelle des Musters).
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
      /* v2790 · Punkt 2: die Abweichung als REINERTRAGSdifferenz aus den Spalten Rohertrag und
         Bewirtschaftungskosten des Musters (BWK in jedem Jahr 34.800 €) - echte Funktion */
      if (Array.isArray(e.rohertraege_vertrag)) {
        const dR = IW.reinertragsDifferenzen(e.rohertraege_vertrag, e.rohertrag_markt, e.bwk_jahr);
        pruefe('A', id, 'Reinertragsdifferenz je Jahr = Spalte „Abweichung zum marktüblichen Reinertrag" (BWK gleich)',
          !!dR && dR.length === e.differenzen.length && dR.every((x, i) => Math.abs(x - e.differenzen[i]) < 0.005), JSON.stringify(dR));
        wert('A', id, 'Barwert aus der Reinertragsdifferenz', barwertAbweichungen(dR, e.lzs_pct), s.summe, t.euro);
      }
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
      /* v2770 · und der Kern selbst (out.vereinfacht, Gegenrechnung neben § 28) */
      const kV = ertragswert(einManuell({ rohertrag: e.reinertrag + 1, bwk: 1, lzs_pct: e.lzs_pct, rnd_jahre: e.rnd_jahre }), bwEinfach(e.bodenwert));
      const v29 = kV.vereinfacht || {};
      wert('A', id, 'Kern § 29: Barwert des Reinertrags', v29.barwert_reinertrag_eur ?? null, s.barwert_reinertrag, t.euro);
      wert('A', id, 'Kern § 29: abgezinster Bodenwert', v29.bodenwert_abgezinst_eur ?? null, s.bodenwert_abgezinst, t.euro);
      wert('A', id, 'Kern § 29: vorläufiger Ertragswert', v29.vorlaeufiger_ertragswert_eur ?? null, s.vorlaeufiger_ertragswert, t.euro);
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

/* ══ EBENE A · VERGLEICHSFAKTOR-MERKMALE UND W1 (v3008) ═════════════════
   Konstanz ETW (vgf-bw-konstanz-2026.json): das Dokument druckt KEIN
   Anwendungsbeispiel - Pruefmassstab sind die Tabellenpunkte selbst (Normprobe
   an Eckwerten, Klassengrenzen und leeren Zellen; die Tabelle interpoliert nicht,
   sie ist ein Beschluss je Zelle). Dazu W1: kein Vergleichswert mit fehlender
   Anpassung (§ 26 Abs. 1, § 9 Abs. 1 S. 3 ImmoWertV), am echten OGA-BB-Satz. */
try {
  const GAA = await lade('lib/gutachterausschuss.js');
  const vf = (x) => GAA.vergleichsfaktor({ ags: '08335043', objektart: 'etw', wohnflaeche: 80, baujahr: 1985, zimmer: 3, ...x });
  const id = 'A-VGF-KN';
  offen('A', id, 'Konstanz: kein amtliches Anwendungsbeispiel im Dokument - Normprobe an Tabellenpunkten (S. 49)');
  let r = vf({ vgf_wohnlage: 'gute', vgf_ausstattung: 'mittel' });
  wert('A', id + '1', 'gute · 1970-1989 · mittel (Tabelle 4.800)', r.wert ?? null, 4800);
  wert('A', id + '1', 'Objektwert 80 m²', r.objektwert ?? null, 384000);
  pruefe('A', id + '1', 'Rechenweg nennt eigene Angabe', /eigene Angabe nach Lagekarte des Gutachterausschusses/.test(r.rechenweg || ''), r.rechenweg);
  wert('A', id + '2', 'Eckwert bevorzugte · 2001-2023 · stark gehoben', vf({ baujahr: 2023, vgf_wohnlage: 'bevorzugte', vgf_ausstattung: 'stark gehoben' }).wert ?? null, 13200);
  wert('A', id + '2', 'Eckwert mäßige · vor 1935 · mittel', vf({ baujahr: 1900, vgf_wohnlage: 'mäßige', vgf_ausstattung: 'mittel' }).wert ?? null, 4300);
  wert('A', id + '3', 'Klassengrenze Bj 1934 (vor 1935, gute mittel)', vf({ baujahr: 1934, vgf_wohnlage: 'gute', vgf_ausstattung: 'mittel' }).wert ?? null, 5700);
  wert('A', id + '3', 'Klassengrenze Bj 1935 (1935-1969, keine Interpolation)', vf({ baujahr: 1935, vgf_wohnlage: 'gute', vgf_ausstattung: 'mittel' }).wert ?? null, 5000);
  wert('A', id + '4', 'Lageklasse 2,0 -> gute', vf({ lageklasse_brw: 2.0, vgf_ausstattung: 'mittel' }).wert ?? null, 4800);
  wert('A', id + '4', 'Lageklasse 1,9 -> bevorzugte', vf({ lageklasse_brw: 1.9, vgf_ausstattung: 'mittel' }).wert ?? null, 7000);
  wert('A', id + '4', 'Lageklasse 3,9 -> mittlere', vf({ lageklasse_brw: 3.9, vgf_ausstattung: 'mittel' }).wert ?? null, 4300);
  wert('A', id + '4', 'Lageklasse 4,0 -> mäßige', vf({ lageklasse_brw: 4.0, vgf_ausstattung: 'mittel' }).wert ?? null, 2600);
  wert('A', id + '5', 'linksrheinisch (Altstadt, LK 1,0) -> gute', vf({ lageklasse_brw: 1.0, ortsteil_brw: 'Altstadt', vgf_ausstattung: 'mittel' }).wert ?? null, 4800);
  wert('A', id + '5', 'eigene Angabe schlägt Ableitung (Seesicht)', vf({ lageklasse_brw: 1.0, ortsteil_brw: 'Altstadt', vgf_wohnlage: 'bevorzugte', vgf_ausstattung: 'mittel' }).wert ?? null, 7000);
  r = vf({});
  pruefe('A', id + '6', 'ohne Wohnlage/Ausstattung: merkmal_fehlt mit beiden Feldern', r.grund === 'merkmal_fehlt'
    && (r.fehlende_merkmale || []).map((m) => m.feld).join(',') === 'vgf_wohnlage,vgf_ausstattung', r.grund + ' ' + (r.fehlende_merkmale || []).map((m) => m.feld));
  pruefe('A', id + '6', 'Klassen kommen aus dem Satz', ((r.fehlende_merkmale || [])[0] || {}).klassen?.join('|') === 'bevorzugte|gute|mittlere|mäßige');
  pruefe('A', id + '7', '2 Zimmer: ausserhalb des Geltungsbereichs', vf({ zimmer: 2, vgf_wohnlage: 'gute', vgf_ausstattung: 'mittel' }).grund === 'ausserhalb_des_geltungsbereichs');
  pruefe('A', id + '7', 'Bj 2024: nicht extrapoliert', vf({ baujahr: 2024, vgf_wohnlage: 'gute', vgf_ausstattung: 'mittel' }).verfuegbar === false);
  pruefe('A', id + '8', 'leere Zelle (mittlere · 1970-1989 · gehoben) ohne Nachbarwert', vf({ vgf_wohnlage: 'mittlere', vgf_ausstattung: 'gehoben' }).grund === 'zelle_leer');
  pruefe('A', id + '8', 'Klasse einfach: kein Beschluss', vf({ vgf_wohnlage: 'gute', vgf_ausstattung: 'einfach' }).grund === 'zelle_leer');
  pruefe('A', id + '8', 'falscher Klassenname wird nicht unscharf zugeordnet', vf({ vgf_wohnlage: 'gut', vgf_ausstattung: 'mittel' }).verfuegbar === false);
  pruefe('A', id + '9', 'Vorrang: Wertsatz vor der Sperre in vgf-bw-2026.json', vf({}).grund !== 'gesperrt');

  /* W1 am Oberen Gutachterausschuss Brandenburg: Standardstufe fehlt -> kein Wert. */
  const bb = JSON.parse(fs.readFileSync(path.join(SRC, 'lib/register/vgf-bb-oga-2025.json'), 'utf8'))
    .filter((s) => s.formel && s.formel.form && s.vollstaendig !== false);
  const efh = { objektart: 'efh', brw: 100, brw_eur_qm: 100, wohnflaeche: 140, flaeche: 600, baujahr: 1985, rnd: 40,
    standardstufe: 3, unterkellerung_pct: 100, stellplaetze: 2 };
  const voll = bb.filter((s) => (s.korrekturen || []).some((k) => k.feld === 'stellplaetze')).map((s) => ({ s, r: GAA.vergleichsfaktor({ ...efh, ags: s.ags, zweig: s.zweig }) })).find((x) => x.r.verfuegbar);
  if (!voll) pruefe('A', 'A-W1', 'OGA BB: ein Satz rechnet am Normobjekt', false);
  else {
    const ohne = GAA.vergleichsfaktor({ ...efh, standardstufe: null, ags: voll.s.ags, zweig: voll.s.zweig });
    pruefe('A', 'A-W1a', 'OGA BB ' + voll.s.ags + ': ohne Standardstufe kein Wert (merkmal_fehlt)', ohne.verfuegbar === false && ohne.grund === 'merkmal_fehlt', ohne.grund);
    pruefe('A', 'A-W1a', 'Rechenweg-Zeile nennt die offene Anpassung', /Standardstufe/.test(ohne.rechenweg || '') && /kein Wert/.test(ohne.rechenweg || ''), ohne.rechenweg);
    const aus = GAA.vergleichsfaktor({ ...efh, unterkellerung_pct: 120, ags: voll.s.ags, zweig: voll.s.zweig });
    pruefe('A', 'A-W1b', 'Merkmal ausserhalb der Anpassungstabelle: nicht auf Norm gesetzt', aus.verfuegbar === false, aus.grund);
    const st = GAA.vergleichsfaktor({ ...efh, stellplaetze: 0, ags: voll.s.ags, zweig: voll.s.zweig });
    pruefe('A', 'A-W1b', '0 Stellplätze (Tabelle ab 1): kein stiller Randwert', st.verfuegbar === false, st.grund);
    pruefe('A', 'A-W1c', 'Bezugsgröße ist eine Art (wohnflaeche), keine Zahl', voll.r.bezugsgroesse === 'wohnflaeche' && voll.r.bezugsflaeche_qm === 140, String(voll.r.bezugsgroesse));
  }
} catch (err) { pruefe('A', 'A-VGF', 'Lauf', false, 'Ausnahme: ' + err.message); }

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
/* v2993 · B60 Zensus-Bestandsmiete als dritter Anker (lib/zensus_miete.js), vor der Angebotsmiete.
   Fortschreibung mit dem Nettokaltmietenindex (Destatis 2020=100): Mai 2022 102,7 -> Sep. 2026 111,9. */
const ZM = await lade('lib/zensus_miete.js');
const await_kappung = await lade('lib/kappung.js');   /* v2993 */
fallB('B60', () => {
  const z = { available: true, gemeinde: { name: 'Prüfgemeinde', miete_baujahr: { klasse: '1949-1978', wert: 5.0 }, miete_flaeche: { klasse: '60-80', wert: 6.0 } }, kreis: null };
  const r = ZM.zensusMieteAmStichtag(z, new Date('2026-09-15'));
  wert('B', 'B60a', 'Zensus Mittel der Klassen 5,0/6,0, fortgeschrieben ×111,9/102,7', r ? r.qm : null, Math.round(5.5 * 111.9 / 102.7 * 100) / 100, 0.001);
  pruefe('B', 'B60b', 'Gemeinde vor Kreis, Herkunft im Text', !!r && r.ebene === 'gemeinde' && /Zensus 2022/.test(r.text) && /Index der Nettokaltmieten/.test(r.text));
  pruefe('B', 'B60c', 'ohne Zensuswert kein Ergebnis', ZM.zensusMieteAmStichtag({ available: true, gemeinde: null, kreis: { name: 'K' } }, new Date()) === null);
  const W0 = ccFall('westerfeld_body', (a) => { a[4].amtliche_miete = null; a[4].zensus_miete = r; }, { ohneSatz: true });
  const bd = W0 && W0.ertragswert && W0.ertragswert.miete_band;
  pruefe('B', 'B60d', 'ohne amtliche Miete und ohne Satz: Anker = Zensus (nicht Angebot)', !!bd && bd.anker_stufe === 'zensus' && bd.anker_qm === r.qm,
    bd ? bd.anker_stufe + ' ' + bd.anker_qm : 'kein Band');
});
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

/* B37 · v2730 · ZUGANGSSPERRE ODER FACHLICHE SPERRE (Marcel 22.10.2026).
   Ist der Registersatz NUR gesperrt, weil der Wert kostenpflichtig/genehmigungs-
   pflichtig/nichtkommerziell/auf Anfrage ist (Feld `zugang`), rechnet Stufe N mit
   dem Weg zum Bericht; fachliche Sperre und Rueckfrage bleiben § 256 mit Weg.
   Am ECHTEN WertParameterService, echten Register, ohne Datenbank (die Tabelle
   mb.wert_parameter fuehrt BW nicht). Orte aus nachernte-2026-10b-bw-wege.json
   und lzs-swf-bw-2026-wege.json. */
const _b37 = {};
if (WPS && WPS.WertParameterService) {
  const _efh = { objart: 'efh', haustyp: 'freistehend', nutzung: 'vermietet', baujahr: 1985, restnutzungsdauer: 40, einheiten: 1 };
  const _mfh = { objart: 'mfh', nutzung: 'vermietet', baujahr: 1970, restnutzungsdauer: 30, einheiten: 6 };
  const _lz = (ags, art, o) => WPS.WertParameterService.liegenschaftszins({ ags, objektart: art, anzahlWe: o.einheiten,
    brwSqm: 200, stichtag: '2026-10-01', objekt: o }).catch((e) => ({ fehler: e.message }));
  _b37.mannheim = await _lz('08222000', 'efh', _efh);      /* kostenpflichtig, 40 € */
  _b37.sindelfingen = await _lz('08115045', 'mfh', _mfh);  /* genehmigungspflichtig */
  _b37.altdorf = await _lz('08115002', 'efh', _efh);       /* fachlich: Widerspruch im Dokument */
  _b37.boeblingen = await _lz('08115003', 'efh', _efh);    /* Rueckfrage: Achse fehlt */
}
fallB('B37', () => {
  if (!WPS || !WPS.WertParameterService || !LZN || !LZN.registerSperreKlasse) return pruefe('B', 'B37', 'WertParameterService/registerSperreKlasse geladen', false, 'fehlt');
  const m = _b37.mannheim || {}, s = _b37.sindelfingen || {}, a = _b37.altdorf || {}, b = _b37.boeblingen || {};
  const wm = (m.zins_herkunft && m.zins_herkunft.weg) || {};
  pruefe('B', 'B37a', 'Mannheim EFH (kostenpflichtige Sperre) → Stufe N, gekennzeichnet, Weg mit Preis und Bestell-Link',
    m.stufe === 'N' && m.zugang_sperre && m.zugang_sperre.zugang === 'kostenpflichtig'
    && /^abgeleitet aus der DealPilot-Formel|^DealPilot-Landesmittel/.test(m.zins_herkunft.etikett)
    && /gegen Gebühr — genauer geht es mit seinem Wert/.test(wm.text || '') && /40 Euro/.test(wm.text || '')
    && wm.bestell_url === 'https://www.service-bw.de/zufi/leistungen/6015515' && !wm.url
    && /Bestellweg: https:\/\/www\.service-bw\.de/.test(wm.text || ''),
    m.stufe + ' ' + m.wert + ' % · ' + String(wm.text || m.fehler || '').slice(0, 70));
  const ws = (s.zins_herkunft && s.zins_herkunft.weg) || {};
  pruefe('B', 'B37b', 'Sindelfingen MFH (genehmigungspflichtig) → Stufe N, Weg nennt die Genehmigung',
    s.stufe === 'N' && s.zugang_sperre && s.zugang_sperre.zugang === 'genehmigungspflichtig' && /Genehmigung/.test(ws.text || ''),
    s.stufe + ' ' + s.wert + ' %');
  pruefe('B', 'B37c', 'Altdorf EFH (fachliche Sperre) → § 256 mit Weg, Grund fachliche_sperre',
    a.stufe === 'D' && !a.zugang_sperre && a.dealpilot_formel_nicht && a.dealpilot_formel_nicht.sperre === 'fachliche_sperre'
    && a.zins_herkunft && a.zins_herkunft.weg && /örtlichen Liegenschaftszinssatz/.test(a.zins_herkunft.weg.text),
    a.stufe + ' ' + (a.dealpilot_formel_nicht && a.dealpilot_formel_nicht.sperre));
  pruefe('B', 'B37d', 'Böblingen EFH (Rückfrage) → § 256, keine Formel',
    b.stufe === 'D' && !b.zugang_sperre && b.dealpilot_formel_nicht && b.dealpilot_formel_nicht.sperre === 'rueckfrage',
    b.stufe + ' ' + (b.rueckfrage && b.rueckfrage.grund));
  /* reine Klassierung: Feld statt Freitext; aelterer Jahrgang entscheidet nicht */
  const K = LZN.registerSperreKlasse;
  const sp = (zugang, zweig = 'ezfh', j = 2025) => ({ vollstaendig: false, warum_kein_wert: 'x', zugang, zweig, berichtsjahr: j, gaa_name: 'GAA X', bestell_url: 'https://x' });
  const wert = { zweig: 'etw', berichtsjahr: 2025, formel: { wert: 2.1 } };
  const rfZ = { grund: 'datensatz_unvollstaendig', zweig: 'ezfh' };
  const k1 = K([sp('kostenpflichtig'), sp('nichtkommerziell', 'mfh')], null);
  const k2 = K([sp('auf_anfrage_kostenfrei')], rfZ);
  const k3 = K([sp('kostenfrei')], rfZ);
  const k4 = K([sp('kostenpflichtig'), wert], { grund: 'lage', zweig: 'ezfh' });
  const k5 = K([sp('kostenpflichtig'), wert], rfZ);
  const alt = sp(undefined, 'ezfh', 2024), neu = sp('kostenpflichtig', 'ezfh', 2025);
  const k6 = K([alt, neu], rfZ, (z) => (z === 'ezfh' ? neu : null));
  const k7 = K([alt, neu], rfZ);
  const k8 = K([sp('kostenpflichtig')], { grund: 'register_fehler' });
  pruefe('B', 'B37e', 'Klassierung: nur Zugangssperren → zugang; auf_anfrage_kostenfrei/kostenfrei → fachlich; Rückfrage bei Wertsatz → fachlich; Objektzweig gesperrt neben Wertsatz → zugang; jüngster Jahrgang entscheidet; Registerfehler → fachlich',
    k1.klasse === 'zugang' && k2.klasse === 'fachlich' && k3.klasse === 'fachlich' && k4.klasse === 'fachlich'
    && k5.klasse === 'zugang' && k6.klasse === 'zugang' && k7.klasse === 'fachlich' && k8.klasse === 'fachlich',
    [k1, k2, k3, k4, k5, k6, k7, k8].map((k) => k.klasse[0]).join(''));
  /* Ertragswert vorher (§ 256) / nachher (N) an zwei BW-Objekten, echter Kern */
  const n256 = (art, we) => IW.lzsNach256(art, 200, we).pct;
  const efhEin = () => ({ objektart: 'efh', baujahr: 1985, baustatus: 'bestand', wohnflaeche_qm: 150, anzahl_we: 1,
    stichtag_jahr: 2026, miete_markt_jahr: 15000, rnd_jahre: 40 });
  const eV = ertragswert(Object.assign(efhEin(), { lzs_pct: n256('efh', 1), lzs_stufe: 'D' }), bwEinfach(150000));
  const eN = ertragswert(Object.assign(efhEin(), { lzs_pct: m.wert, lzs_stufe: 'N' }), bwEinfach(150000));
  const mV = ertragswert(Object.assign(einOk(), { lzs_pct: n256('mfh', 6), lzs_stufe: 'D', rnd_jahre: 30 }), bwOk());
  const mN = ertragswert(Object.assign(einOk(), { lzs_pct: s.wert, lzs_stufe: 'N', rnd_jahre: 30 }), bwOk());
  _b37.ew = { efh: [n256('efh', 1), eV.wert, m.wert, eN.wert], mfh: [n256('mfh', 6), mV.wert, s.wert, mN.wert] };
  pruefe('B', 'B37f', 'Ertragswert rechnet nachher mit Stufe N (EFH Mannheim, MFH Sindelfingen), vorher mit § 256',
    eV.wert > 0 && eN.wert > 0 && mV.wert > 0 && mN.wert > 0 && eN.lzs.stufe === 'N' && mN.lzs.stufe === 'N' && eN.wert !== eV.wert && mN.wert !== mV.wert,
    'EFH ' + n256('efh', 1) + ' % → ' + eur(eV.wert) + ' / ' + m.wert + ' % → ' + eur(eN.wert)
    + ' · MFH ' + n256('mfh', 6) + ' % → ' + eur(mV.wert) + ' / ' + s.wert + ' % → ' + eur(mN.wert));
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
  /* v2993 · Wohnung unter dem Band ohne Vertragsdatum: Dauer aus dem Erhoehungspfad nach § 558 BGB
     (lib/kappung.js), nicht mehr die Szenarien 3/5/10 (ImmoWertA zu § 31 c). Bis v2992 stand hier
     „ohne Laufzeit: Szenarien 3/5/10 Jahre, nichts angesetzt". */
  const z = b && b.zeilen && b.zeilen[0];
  pruefe('B', 'B21', 'ohne Laufzeit (Wohnung, unter dem Band): § 558-Pfad angesetzt, keine Szenarien', !!z && b.n_angesetzt === 1 && b.n_offen === 0
    && !b.szenarien && z.jahre_quelle === 'bgb558' && z.barwert_eur < 0 && z.pfad558 && z.pfad558.schritte[0].ab_monat === 3
    && z.pfad558.schritte[0].miete_monat === Math.round(Math.min(500 * (1 + z.pfad558.kappung_pct / 100), (z.differenz_jahr * -1 + 6000) / 12) * 100) / 100,
    z ? z.jahre + ' J., ' + z.barwert_eur + ' €, ' + JSON.stringify(z.pfad558 && z.pfad558.schritte.slice(0, 2)) : 'keine Zeile');
  pruefe('B', 'B21', 'Ertragswert = vorläufig + Barwert des Pfads (+ eigener boG)', !!e && !!z
    && r.ertragswert_kern.wert_ungerundet === e.vorlaeufiger_ertragswert_eur + z.barwert_eur + eigenerBog(r));
  /* Handrechnung: 1.000 €/Monat Ist, 1.100 marktueblich, 3 %, Kappung 20 %: Monate 0-2 je −100 €,
     abgezinst (1,03)^-(1/12 … 3/12) = −298,53 -> −299 €; ab Monat 3 erreicht (0,3 Jahre). */
  const KP = await_kappung;
  const hp = KP.erhoehungspfad558(12000, 13200, 3, 20, 40);
  wert('B', 'B21', 'Handbeispiel § 558: Barwert 3 Monate × −100 € bei 3 %', hp ? hp.barwert_eur : null, -299, 0);
  wert('B', 'B21', 'Handbeispiel § 558: Dauer 0,25 J. (gerundet 0,3)', hp ? hp.jahre : null, 0.3, 0);
  const hp2 = KP.erhoehungspfad558(12000, 18000, 3, 15, 40);
  pruefe('B', 'B21', 'Kappung 15 %: drei Schritte (1.150, 1.322,50, 1.500 gedeckelt) in Monat 3, 39, 75',
    !!hp2 && hp2.schritte.map((x) => x.ab_monat + ':' + x.miete_monat).join() === '3:1150,39:1322.5,75:1500', hp2 ? JSON.stringify(hp2.schritte) : '');
  const kb = KP.kappungFuer('05711000', null), kh = KP.kappungFuer('02000000', null), ke = KP.kappungFuer('05711000', 15);
  pruefe('B', 'B21', 'Kappungsgrenze: Hamburg 15 % (Verordnung), eigene Angabe geht vor', kh.pct === 15 && kh.herkunft === 'verordnung' && ke.pct === 15 && ke.herkunft === 'eigen' && (kb.pct === 20 || kb.pct === 15),
    kh.pct + ' ' + kb.pct + ' ' + ke.herkunft);
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

/* ══ v2670 · GARAGE IM NORMOBJEKT (B36) ═══════════════════════════════════════
   Marcel 21.10.2026: enthaelt das Normobjekt eine Garage und das Objekt keine, wird
   abgezogen - nur in der Hoehe des Ausschusses. Herford EFH/ZFH: Zeitwertspanne
   5.000-15.000 € (Oertliche Fachinformationen 2026, S. 3) -> Untergrenze 5.000 €. */
fallB('B36', () => {
  if (!irwB30) return pruefe('B', 'B36', 'eingefrorener IRW', false, 'fehlt');
  const mit = ccFall('loehner', (a) => { a[4].irw = klon(irwB30); });
  const ohne = ccFall('loehner', (a) => { a[4].irw = klon(irwB30); a[0].garages = 0; a[0].outdoor_parking = 0; });
  const unb = ccFall('loehner', (a) => { a[4].irw = klon(irwB30); a[0].garages = null; a[0].outdoor_parking = null; });
  const vm = mit && mit.vergleichswert_irw, vo = ohne && ohne.vergleichswert_irw, vu = unb && unb.vergleichswert_irw;
  wert('B', 'B36', 'Löhner mit Garage: Vergleichswert wie B30 (kein Abzug)', vm && vm.verfuegbar ? vm.vergleichswert_eur : null, 329932, 0);
  // v2671: Mitte der Spanne statt Untergrenze (vorher v2670: 324.932)
  wert('B', 'B36', 'Löhner ohne Garage: 329.932 − 10.000 (Mitte der Spanne 5.000–15.000 des Ausschusses)', vo && vo.verfuegbar ? vo.vergleichswert_eur : null, 319932, 0);
  pruefe('B', 'B36', 'ohne Garage: Rechenweg-Zeile „Garage des Normobjekts" −10.000 mit Spanne und Seite',
    !!vo && vo.rechenweg.some((z) => /Garage des Normobjekts/.test(z.pos) && z.wert === -10000 && /Mitte.*5\.000 € bis 15\.000 €.*S\. 3/.test(z.detail)),
    vo ? (vo.rechenweg.find((z) => /Garage/.test(z.pos)) || {}).detail : '');
  wert('B', 'B36', 'Garage nicht angegeben: kein Abzug', vu && vu.verfuegbar ? vu.vergleichswert_eur : null, 329932, 0);
  pruefe('B', 'B36', 'Garage nicht angegeben: Hinweis mit Betrag und Ort der Angabe',
    !!vu && (vu.hinweise || []).some((h) => /nicht angegeben/.test(h) && /10\.000 €/.test(h)));
});

/* ══ v2670 · MIETPREISUEBERSICHT JENSEITS DER GROESSENTABELLE (B35) ══════════
   Marcel 21.10.2026: ueber 140 m² die oberste Groessenklasse ansetzen (nicht
   fortrechnen) und kennzeichnen; unten genauso (unter 50 m² die unterste).
   Vorher (v2600): ausserhalb der Tabelle „nicht fuehrend", Anker = Ø Miete des Satzes. */
let MM = null;
try { MM = await lade('lib/mietmodell_nrw.js'); } catch (e) { MM = null; }
fallB('B35', () => {
  if (!MM) return pruefe('B', 'B35', 'mietmodell_nrw geladen', false, 'fehlt');
  const mm = (wfl) => MM.marktmiete({ gemeinde: 'Hüllhorst', baujahr: 1968, wohnflaeche_qm: wfl, ags: '05770016',
    modernisierung_klasse: 4, wohnlage: 'mittel', stichtag_jahr: 2026 });
  const g165 = mm(165), g140 = mm(140), g40 = mm(40), g50 = mm(50), g100 = mm(100);
  wert('B', 'B35', '165 m²: Miete = oberste Klasse (140 m²)', g165.miete_qm, g140.miete_qm, 0);
  wert('B', 'B35', '165 m²: 6,54 × 0,9 × 0,82 = 4,83 €/m²', g165.miete_qm, 4.83, 0);
  pruefe('B', 'B35', '165 m²: führend, gekennzeichnet „Wohnfläche über der Tabelle, oberste Größenklasse angesetzt"',
    g165.fuehrend === true && g165.ausserhalb_tabelle === true && g165.groessenklasse === 'oberste'
    && /^Wohnfläche über der Tabelle, oberste Größenklasse angesetzt/.test(g165.ausserhalb_hinweis || '')
    && /oberste Größenklasse 140 m²/.test(g165.staffel[2].pos), g165.ausserhalb_hinweis || '');
  wert('B', 'B35', '40 m²: Miete = unterste Klasse (50 m²)', g40.miete_qm, g50.miete_qm, 0);
  pruefe('B', 'B35', '40 m²: führend, Faktor 1,20, „unterste Größenklasse angesetzt"',
    g40.fuehrend === true && g40.groessenklasse === 'unterste' && g40.staffel[2].faktor === 1.2
    && /^Wohnfläche unter der Tabelle, unterste Größenklasse angesetzt/.test(g40.ausserhalb_hinweis || ''), g40.ausserhalb_hinweis || '');
  pruefe('B', 'B35', '100 m² (in der Tabelle): kein Vermerk, Faktor 0,94',
    g100.fuehrend === true && g100.ausserhalb_tabelle === false && g100.ausserhalb_hinweis === null && g100.staffel[2].faktor === 0.94);
  const r = ccFall('huellhorst');
  const e = r && r.ertragswert;
  pruefe('B', 'B35', 'Hüllhorst 165 m²: Anker amtlich 4,83, Etikett gekennzeichnet, Ist 10,00 über dem Band -> 4,83',
    !!e && e.miete_stufe.code === 'amtlich' && e.miete_stufe.qm === 4.83
    && /oberste Größenklasse angesetzt/.test(e.miete_stufe.etikett) && /oberste Größenklasse/.test(e.miete_stufe.groessenklasse_hinweis || ''),
    e ? e.miete_stufe.etikett : '');
  wert('B', 'B35', 'Hüllhorst Ertragswert (v2600: 239.000)', e ? e.value_eur : null, 218000, 0);
});

/* ══ v2770 · AUS DEM VERKEHRSWERT-MODUL V4.2.6 UEBERNOMMEN (B40-B42) ═════════
   B40 Mapper: je Gewerbeeinheit Ist, Markt, Vertragslaufzeit.
   B41 Wohn- und Geschaeftshaus (Demo-MFH, WE 6 als Laden): Mietabweichung Gewerbe
       mit Befristung als boG (E2-Regeln je Mietverhaeltnis), ohne Laufzeit Szenarien.
   B42 § 29 als Gegenrechnung am Demo-MFH: Wert bleibt § 28, Differenz nur Rundung. */
const DPM = (await lade('services/DealPilotObjectMapper.js')).DealPilotObjectMapper;
fallB('B40', () => {
  const ri = DPM.reportInput({ data: { objart: 'MFH', wfl: 378, _mfh_einheiten: [
    { nr: 'WE 1', art: 'wohnen', wfl: 310, ist: 2265 },
    { nr: 'Laden', art: 'gewerbe', nutzung_gew: 'buero_praxis_laden', wfl: 68, ist: 700, markt_qm: 8, mv_befristet_bis: '2031-10-21' },
    { nr: 'Büro leer', art: 'gewerbe', nutzung_gew: 'buero_praxis_laden', wfl: 50, status: 'leer', markt_qm: 7 }] } });
  const g = ri && ri.gewerbe, z = g && g.einheiten;
  pruefe('B', 'B40', 'nur die vermietete Gewerbeeinheit mit beiden Mieten', !!z && z.length === 1 && z[0].nr === 'Laden'
    && z[0].ist_jahr === 8400 && z[0].markt_jahr === 6528 && z[0].mv_befristet_bis === '2031-10-21', JSON.stringify(z));
});
const gewDemo = (ge) => (a) => {
  a[0].gewerbe = { n_gewerbe: 1, n_wohnen: 5, wfl_wohnen: 310, wfl_gewerbe: 68, flaechen: { buero_praxis_laden: 68 },
    ist_jahr: ge.ist_jahr, markt_jahr: 6528, markt_vollstaendig: true, leer_ohne_markt: 0, ohne_nutzung_qm: 0,
    wohnen_ist_jahr: 27180, wohnen_leer: 0, einheiten: [Object.assign({ nr: 'Laden', markt_jahr: 6528 }, ge)] };
};
fallB('B41', () => {
  const r = ccFall('demo', gewDemo({ ist_jahr: 8400, mv_befristet_bis: '2031-10-21' })), e = r && r.ertragswert;
  const b = e && e.miete_bog, z = b && b.zeilen[0];
  pruefe('B', 'B41', 'Overrent Laden mit Befristung bis 21.10.2031 → 5 Jahre angesetzt', !!z && z.angesetzt && z.art === 'overrent'
    && z.jahre === 5 && z.jahre_quelle === 'befristung' && b.gewerbe === true, z ? JSON.stringify(z).slice(0, 120) : JSON.stringify(e).slice(0, 120));
  wert('B', 'B41', 'boG = (8.400 − 6.528) × Barwertfaktor (Zins des Kerns / 5 J.)', z ? z.barwert_eur : null, barwertAbweichung(1872, e.liegenschaftszins_pct, 5), 0);
  const kz = r && (r.ertragswert_kern.staffel || []).find((s) => /Merkmal: Mietabweichung Gewerbe/.test(s.pos));
  pruefe('B', 'B41', 'eigene boG-Zeile „Mietabweichung Gewerbe", Ertragswert = vorläufig + boG', !!kz && kz.wert === z.barwert_eur
    && r.ertragswert_kern.wert_ungerundet === e.vorlaeufiger_ertragswert_eur + z.barwert_eur + eigenerBog(r));
  // v2790: 5.000 (−23,4 %, ausserhalb des Bandes); vorher v2770: 6.000 (−8,1 %, seit v2790 im Band -> B43)
  const r2 = ccFall('demo', gewDemo({ ist_jahr: 5000 })), e2 = r2 && r2.ertragswert, b2 = e2 && e2.miete_bog;
  pruefe('B', 'B41', 'Underrent ohne Laufzeit → nur Szenarien 3/5/10, vorläufig, Satz „je Gewerbeeinheit"', !!b2 && b2.n_angesetzt === 0
    && b2.szenarien.map((s) => s.jahre).join() === '3,5,10' && e2.vorlaeufig_vor_bog === true
    && (r2.notes || []).some((n) => /Restlaufzeit je Gewerbeeinheit/.test(n)));
  const r3 = ccFall('demo', gewDemo({ ist_jahr: 6528 })), e3 = r3 && r3.ertragswert;
  pruefe('B', 'B41', 'Ist = Markt → kein boG, nicht vorläufig', !!e3 && !e3.miete_bog && e3.vorlaeufig_vor_bog === false);
});
fallB('B42', () => {
  const r = ccFall('demo'), k = r && r.ertragswert_kern, v = k && k.vereinfacht;
  pruefe('B', 'B42', '§ 29 Gegenrechnung vorhanden, Wert bleibt § 28', !!v && k.wert === r.ertragswert.value_eur);
  pruefe('B', 'B42', 'Differenz § 29 − § 28 nur aus Rundung der Faktoren (< 0,1 %)', !!v && Math.abs(v.differenz_zu_28_eur) < 0.001 * k.wert_ungerundet,
    v ? 'Differenz ' + v.differenz_zu_28_eur + ' €' : '');
});

/* ══ v2790 · MARCELS SIEBEN ENTSCHEIDUNGEN VOM 22.10.2026 (B43-B48) ══════════════
   B43 Punkt 1  Band ±20 % auch fuer Gewerbe (Anker Marktmiete der Einheit bzw. Ø Miete
                des Gewerbe-Zinssatzes)
   B44 Punkt 2  boG auf der Reinertragsdifferenz (Muster EW-RL Anl. 3 Bsp. 1, A-E6)
   B45 Punkt 3  Stellplaetze im reinen Gewerbeobjekt: Mietausfall 4 %, Verwaltung je Stellplatz
   B46 Punkt 4  Instandhaltung Gewerbe exakt (Anteil der Wohn-Instandhaltung zum Stichtag)
   B47 Punkt 5  kein gewogener Zins: bei Mischnutzung zuerst der WGH-Satz (wgh/ggg)
   B48 Punkt 6  Gewerbe ohne Nutzungsart: kein Ertragswert, Grund + Nachfrage */
const zeileK = (k, re) => { const z = ((k && k.staffel) || []).find((s) => re.test(s.pos)); return z ? z.wert : null; };
fallB('B43', () => {
  const im = ccFall('demo', gewDemo({ ist_jahr: 6000 })), eI = im && im.ertragswert;
  pruefe('B', 'B43', 'Laden Ist 6.000 (−8,1 %) im Band: kein boG, nicht vorläufig, Band-Zeile ist_im_band',
    !!eI && !eI.miete_bog && eI.vorlaeufig_vor_bog === false && im.gewerbe_band && im.gewerbe_band.zeilen[0].herkunft === 'ist_im_band');
  wert('B', 'B43', 'Rohertrag Gewerbe = Ist 6.000 (vorher v2770: Markt 6.528)', zeileK(im.ertragswert_kern, /^Rohertrag Gewerbe/), 6000, 0);
  const p7 = ccFall('demo', gewDemo({ ist_jahr: 7000 }));
  wert('B', 'B43', 'Laden Ist 7.000 (+7,2 %) im Band: Rohertrag Gewerbe 7.000', zeileK(p7.ertragswert_kern, /^Rohertrag Gewerbe/), 7000, 0);
  const au = ccFall('demo', gewDemo({ ist_jahr: 8400, mv_befristet_bis: '2031-10-21' }));
  wert('B', 'B43', 'Laden Ist 8.400 (+28,7 %) außerhalb: Rohertrag Gewerbe = Markt 6.528', zeileK(au.ertragswert_kern, /^Rohertrag Gewerbe/), 6528, 0);
  pruefe('B', 'B43', 'Grenze: +20 % genau (7.834) im Band, +20,1 % (7.841) außerhalb',
    CCS.gewerbeNachBand({ markt_jahr: 6528, einheiten: [{ ist_jahr: 7833.6, markt_jahr: 6528 }] }).zeilen[0].herkunft === 'ist_im_band'
    && CCS.gewerbeNachBand({ markt_jahr: 6528, einheiten: [{ ist_jahr: 7841, markt_jahr: 6528 }] }).zeilen[0].herkunft === 'ueber_band');
  /* reines Gewerbeobjekt ohne Marktmiete je Einheit: Anker = Ø Miete des Gewerbe-Zinssatzes */
  const gewAnker = (monat) => (a) => { a[0].property_type = 'gewerbe'; a[0].gewerbe_art = 'buero'; a[0].gewerbe = null;
    a[0].monthly_net_rent = monat; a[0].vacancy = false; a[0].garages = 0; a[0].outdoor_parking = 0;
    Object.assign(a[4], { lzs_pct: 5, lzs_zweig: 'gewerbe', lzs_aus_register: true, lzs_stufe: 'A', lzs_modellansaetze: { marktmiete_eur_qm: 7.5 } }); };
  const gi = ccFall('demo', gewAnker(2600)), gE = gi && gi.ertragswert;
  pruefe('B', 'B43', 'Gewerbeobjekt Ist 6,88 €/m² im Band um Ø 7,50 des Satzes: Ist angesetzt, nicht indikativ',
    !!gE && gE.available && gE.gewerbe_herkunft === 'anker_lzs' && gE.indikativ === false && gE.gewerbe_band.herkunft === 'ist_im_band', gE ? gE.gewerbe_herkunft + '/' + gE.indikativ : '');
  wert('B', 'B43', 'Gewerbeobjekt im Band: Rohertrag = Ist 31.200 (vorher v2770: Ist ungeprüft, indikativ)', gE ? gE.rohertrag_pa_eur : null, 31200, 0);
  const ga = ccFall('demo', gewAnker(2000)), gA = ga && ga.ertragswert;
  wert('B', 'B43', 'Gewerbeobjekt Ist 5,29 €/m² außerhalb: Rohertrag = 7,50 × 378 × 12', gA ? gA.rohertrag_pa_eur : null, 34020, 0);
  pruefe('B', 'B43', 'außerhalb ohne Vertragslaufzeit: Szenarien 3/5/10, vorläufig', !!gA && gA.vorlaeufig_vor_bog === true
    && gA.miete_bog && gA.miete_bog.n_offen === 1 && gA.miete_bog.offen_differenz_jahr === 24000 - 34020);
  const gu = ccFall('demo', (a) => { gewAnker(2600)(a); a[4].lzs_modellansaetze = null; }), gU = gu && gu.ertragswert;
  pruefe('B', 'B43', 'ohne Ø Miete im Satz: wie bisher Ist-Miete, indikativ', !!gU && gU.gewerbe_herkunft === 'ist_ungeprueft' && gU.indikativ === true);
});
fallB('B44', () => {
  const r = ccFall('demo', gewDemo({ ist_jahr: 8400, mv_befristet_bis: '2031-10-21' })), b = r && r.ertragswert && r.ertragswert.miete_bog;
  pruefe('B', 'B44', 'boG-Basis = Reinertragsdifferenz (BWK in beiden Ansätzen gleich, EW-RL Anl. 3 Bsp. 1)', !!b && b.basis === 'reinertragsdifferenz'
    && /Reinertr/.test(b.basis_text) && /Beispiel 1/.test(b.basis_text));
  const kz = (r.ertragswert_kern.staffel || []).find((s) => /Merkmal: Mietabweichung Gewerbe/.test(s.pos));
  pruefe('B', 'B44', 'Rechenweg nennt die Reinertragsdifferenz', !!kz && /^Reinertragsdifferenz je Jahr/.test(kz.detail || ''), kz ? kz.detail : '');
  wert('B', 'B44', 'Betrag unverändert: 1.872 €/Jahr × Barwertfaktor 5 J. (Muster: BWK gleich -> Reinertrags- = Rohertragsdifferenz)',
    b && b.zeilen[0] ? b.zeilen[0].barwert_eur : null, barwertAbweichung(1872, r.ertragswert.liegenschaftszins_pct, 5), 0);
});
const gewObjekt = (extra = {}, art = 'buero') => (a) => {
  a[0].property_type = 'gewerbe'; a[0].gewerbe_art = art; a[0].garages = 2; a[0].outdoor_parking = 0;
  a[0].gewerbe = Object.assign({ n_gewerbe: 2, n_wohnen: 0, wfl_wohnen: 0, wfl_gewerbe: 378, flaechen: { buero_praxis_laden: 200, lager_logistik: 178 },
    markt_jahr: 26400, markt_vollstaendig: true, leer_ohne_markt: 0, ohne_nutzung_qm: 0, wohnen_ist_jahr: 0, wohnen_leer: 0, ist_jahr: 27000,
    einheiten: [{ nr: 'Büro', ist_jahr: 21000, markt_jahr: 19200 }, { nr: 'Lager', ist_jahr: 6000, markt_jahr: 7200 }] }, extra);
  Object.assign(a[4], { lzs_pct: 5, lzs_zweig: 'gewerbe', lzs_aus_register: true, lzs_stufe: 'A', stellplatz_miete_monat: 50, lzs_modellansaetze: null });
};
fallB('B45', () => {
  const r = ccFall('demo', gewObjekt()), k = r && r.ertragswert_kern;
  /* Büro +9,4 %, Lager −16,7 %: beide im Band -> Gewerbe 27.000; Stellplätze 2 × 50 × 12 = 1.200 */
  wert('B', 'B45', 'Rohertrag 27.000 + 1.200 Stellplätze', r && r.ertragswert ? r.ertragswert.rohertrag_pa_eur : null, 28200, 0);
  wert('B', 'B45', 'Mietausfallwagnis 4 % auf alles, auch Stellplätze (vorher v2789: 26.400 × 4 % + 1.200 × 2 % = 1.080)', zeileK(k, /^Mietausfallwagnis/), 1128, 0);
  wert('B', 'B45', 'Verwaltung 3 % × 27.000 + 2 × 48 € (Anlage 3, Garage 2026)', zeileK(k, /^Verwaltungskosten/), 810 + 96, 0);
  pruefe('B', 'B45', 'Zeile und Hinweis nennen die Stellplätze wie Gewerbe', /Stellplätze wie Gewerbe/.test(((k.staffel || []).find((s) => /^Mietausfallwagnis/.test(s.pos)) || {}).pos || '')
    && (k.hinweise || []).some((h) => /4 % auch auf die Stellplätze/.test(h)));
  const w = ccFall('demo', (a) => { gewDemo({ ist_jahr: 6528 })(a); a[0].garages = 2; a[4].stellplatz_miete_monat = 50; });
  pruefe('B', 'B45', 'Wohn- und Geschäftshaus: Stellplätze bleiben beim Wohnen-Satz (getrennt 2 %/4 %)', /Wohnen 2 %, Gewerbe 4 %/.test(((w.ertragswert_kern.staffel || []).find((s) => /^Mietausfallwagnis/.test(s.pos)) || {}).pos || ''));
});
fallB('B46', () => {
  const r = ccFall('demo', gewObjekt()), k = r && r.ertragswert_kern;
  wert('B', 'B46', 'Instandhaltung 200 × 14,40 + 178 × 14,40 × 30 % (= 4,32) + 2 × 108 (vorher v2789 mit 4,30: 3.861)', zeileK(k, /^Instandhaltung/), Math.round(2880 + 178 * 4.32 + 216), 0);
  pruefe('B', 'B46', 'Rechenweg „178 m² × 14,4 € × 30 %"', /178 m² × 14,4 € × 30 %/.test(((k.staffel || []).find((s) => /^Instandhaltung/.test(s.pos)) || {}).pos || ''));
  wert('B', 'B46', 'Lager 2022: 12,20 × 30 % = 3,66 (Tabelle Brandenburg: 3,70)', IW.gewerbeInstandhaltungQm('lager', 12.2), 3.66, 0);
  wert('B', 'B46', 'SB-Markt 2026: 14,40 × 50 %', IW.gewerbeInstandhaltungQm('sb_markt', 14.4), 7.2, 0);
  const k22 = ertragswert({ objektart: 'gewerbe', baujahr: 1990, wohnflaeche_qm: 0, anzahl_we: 0, stichtag_jahr: 2022, miete_markt_jahr: 0,
    gewerbe_jahr: 10000, gewerbe_flaechen: { lager_logistik: 100 }, lzs_pct: 5, lzs_stufe: 'A', rnd_jahre: 30, bwk_modus: 'normiert' }, bwEinfach(50000));
  wert('B', 'B46', 'Kern, Stichtag 2022: Instandhaltung 100 m² Lager = 366 €', zeileK(k22, /^Instandhaltung/), 366, 0);
});
let ZW = null;
try { ZW = await lade('lib/zweigwahl.js'); } catch (e) { ZW = null; }
fallB('B47', () => {
  if (!ZW) return pruefe('B', 'B47', 'zweigwahl geladen', false, 'fehlt');
  const w = (zw, misch) => ZW.waehle(zw, { objart: 'mfh', einheiten: 6, mischnutzung: misch }).zweig || null;
  pruefe('B', 'B47', 'Mischnutzung: WGH-Satz vor dem MFH-Satz', w(['mfh', 'wgh'], true) === 'wgh', w(['mfh', 'wgh'], true));
  pruefe('B', 'B47', 'Mischnutzung: ggg („Wohn- und Geschäftshäuser") vor dem MFH-Satz', w(['mfh', 'ggg'], true) === 'ggg', w(['mfh', 'ggg'], true));
  pruefe('B', 'B47', 'ohne Gewerbe: MFH-Satz wie bisher', w(['mfh', 'wgh'], false) === 'mfh', w(['mfh', 'wgh'], false));
  pruefe('B', 'B47', 'Mischnutzung ohne WGH-Satz: Rangfolge des Wohnhauses (mfh_bis6), kein Mischsatz', w(['mfh_bis6', 'mfh'], true) === 'mfh_bis6');
  const r = ccFall('demo', gewDemo({ ist_jahr: 6528 }));
  pruefe('B', 'B47', 'Bericht ohne WGH-Satz: „gewogener Satz wäre nur ein Hilfsweg und ist nicht gerechnet"', (r.notes || []).some((n) => /gewogener Satz wäre nur ein Hilfsweg und ist nicht gerechnet/.test(n)));
  const r2 = ccFall('demo', (a) => { gewDemo({ ist_jahr: 6528 })(a); a[4].lzs_zweig = 'wgh'; });
  pruefe('B', 'B47', 'mit WGH-Satz: „Satz des Gutachterausschusses für Wohn- und Geschäftshäuser (kein gewogener Zins …)"', (r2.notes || []).some((n) => /Satz des Gutachterausschusses für Wohn- und Geschäftshäuser \(kein gewogener Zins/.test(n)));
  const quellen = ['services/CrossCheckService.js', 'services/ErtragswertService.js', 'services/WertParameterService.js', 'lib/zweigwahl.js']
    .map((f) => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).join('\n');
  pruefe('B', 'B47', 'kein Bezeichner für einen gewogenen Liegenschaftszins im Code (kommentarfreier Text)', !/\b\w*(gewogen|gewichtet)\w*(zins|lzs)\w*\s*[=(]/i.test(quellen) && !/\b\w*(zins|lzs)\w*(gewogen|gewichtet)\w*\s*[=(]/i.test(quellen));
});
fallB('B48', () => {
  const r = ccFall('demo', gewDemo({ ist_jahr: 6528 })), rO = ccFall('demo', (a) => { gewDemo({ ist_jahr: 6528 })(a);
    Object.assign(a[0].gewerbe, { flaechen: {}, ohne_nutzung_qm: 68, ohne_nutzung_nr: ['Laden'] }); });
  const e = rO && rO.ertragswert;
  pruefe('B', 'B48', 'Wohn- und Geschäftshaus, Laden ohne Nutzungsart: kein Ertragswert, Grund, Nachfrage je Einheit (vorher v2789: 645.000 ohne Instandhaltung Laden)',
    !!e && e.available === false && e.grund === 'gewerbe_ohne_nutzungsart' && e.nachfrage && e.nachfrage.einheiten.join() === 'Laden'
    && /fehlt die Nutzungsart/.test(e.hinweis) && /Büro\/Praxis\/Laden, SB-Markt oder Lager\/Logistik/.test(e.hinweis), e ? e.grund : '');
  pruefe('B', 'B48', 'mit Nutzungsart rechnet derselbe Fall', !!r && r.ertragswert.available === true);
  const g = ccFall('demo', (a) => { gewObjekt({ flaechen: { buero_praxis_laden: 200 }, ohne_nutzung_qm: 178, ohne_nutzung_nr: ['Lager'] }, null)(a); }), gE = g && g.ertragswert;
  pruefe('B', 'B48', 'Gewerbeobjekt ohne Gewerbeart, Einheit ohne Nutzungsart: kein Ertragswert mit Nachfrage', !!gE && gE.available === false && gE.grund === 'gewerbe_ohne_nutzungsart' && !!gE.nachfrage, gE ? gE.grund : '');
  const gB = ccFall('demo', gewObjekt({ flaechen: { buero_praxis_laden: 200 }, ohne_nutzung_qm: 178 }, 'buero'));
  pruefe('B', 'B48', 'Gewerbeobjekt mit Gewerbeart Büro: Einheit ohne Angabe trägt die Art des Objekts (rechnet, Hinweis)', !!gB && gB.ertragswert.available === true
    && (gB.notes || []).some((n) => /mit der Gewerbeart des Objekts angesetzt/.test(n)));
  const k = ertragswert({ objektart: 'mfh', baujahr: 1990, wohnflaeche_qm: 300, anzahl_we: 4, stichtag_jahr: 2026, miete_markt_jahr: 24000,
    gewerbe_jahr: 6000, lzs_pct: 3, lzs_stufe: 'A', rnd_jahre: 40, bwk_modus: 'normiert' }, bwEinfach(100000));
  pruefe('B', 'B48', 'Kern: Gewerbe-Rohertrag ohne Nutzungsart -> kein Wert, grund gewerbe_ohne_nutzungsart', k.vollstaendig === false && k.wert == null && k.grund === 'gewerbe_ohne_nutzungsart');
  pruefe('B', 'B48', 'Nachfrage nennt den Ort im Formular (Reiter Objekt → Einheiten erfassen → Details → Gewerbe → Nutzungsart)',
    !!e && /Reiter Objekt/.test(e.hinweis) && /Einheiten erfassen/.test(e.hinweis) && /„Nutzungsart“/.test(e.hinweis), e ? e.hinweis : '');
});

/* ══ v2800 · WOHNUNGEN IM WOHN- UND GESCHAEFTSHAUS JE MIETVERHAELTNIS (B49-B51) ═════
   Bis v2799 schloss der Kern jedes Objekt mit Gewerbe von der Pruefung je Wohnung aus:
   im WGH ging die Ist-Miete der Wohnungen gar nicht ein (Rohertrag Wohnen = Anker 7,70 ×
   310 m² × 12 = 28.644), eine Mietabweichung wurde nie boG - nur die Gewerbeeinheiten.
   Demo-MFH als WGH: fünf Wohnungen (310 m²) + Laden (68 m², Markt 6.528 €/Jahr).
   B49 Wohnung WE 1 über dem Band (11,03 €/m², befristet bis 21.10.2029) + Laden im Band.
   B50 beide außerhalb: WE 1 ohne Laufzeit (Szenario), Laden befristet (angesetzt).
   B51 Mapper: gewerbe.wohnungen je Wohnung, einheiten_miete bleibt null; Doppelansatz. */
const wghWo = (we1) => [Object.assign({ nr: 'WE 1', wfl: 68, ist_monat: 750, leer: false }, we1 || {}),
  { nr: 'WE 2', wfl: 58, ist_monat: 455, leer: false }, { nr: 'WE 3', wfl: 68, ist_monat: 480, leer: false },
  { nr: 'WE 4', wfl: 58, ist_monat: 470, leer: false }, { nr: 'WE 6', wfl: 58, ist_monat: 440, leer: false }];
const wghDemo = (ge, we1) => (a) => { gewDemo(ge)(a); a[0].einheiten_miete = null; a[0].leerstand = null; a[0].gewerbe.wohnungen = wghWo(we1); };
const mbZeile = (k) => ((k && k.staffel) || []).find((s) => /Merkmal: Mietabweichung/.test(s.pos)) || null;
fallB('B49', () => {
  const vor = ccFall('demo', gewDemo({ ist_jahr: 6000 }));   /* der Stand bis v2799: ohne Wohnungsliste */
  wert('B', 'B49', 'ohne Wohnungsliste wie bisher: Rohertrag Wohnen = Anker 7,70 × 310 × 12', zeileK(vor.ertragswert_kern, /^Rohertrag Wohnen/), 28644, 0);
  const r = ccFall('demo', wghDemo({ ist_jahr: 6000 }, { mv_befristet_bis: '2029-10-21' })), e = r && r.ertragswert, b = e && e.miete_bog;
  pruefe('B', 'B49', 'Anker 7,70 (Ø Miete des Satzes), Band 6,16–9,24, je Wohnung geprüft (5 vermietet, WE 1 über dem Band)',
    !!r && r.miete_band && r.miete_band.anker_qm === 7.7 && r.miete_band.oben_qm === 9.24 && r.miete_band.je_wohnung
    && r.miete_band.je_wohnung.n_vermietet === 5 && r.miete_band.je_wohnung.angepasst.length === 1
    && r.miete_band.je_wohnung.angepasst[0].nr === 'WE 1' && r.miete_band.je_wohnung.angepasst[0].herkunft === 'ueber_band',
    r && r.miete_band ? JSON.stringify(r.miete_band.je_wohnung) : '');
  wert('B', 'B49', 'Rohertrag Wohnen = WE 1 mit Anker (7,70 × 68 × 12 = 6.283) + Ist der übrigen (1.845 × 12 = 22.140)', zeileK(r.ertragswert_kern, /^Rohertrag Wohnen/), 6283 + 22140, 0);
  wert('B', 'B49', 'Laden im Band (−8,1 %): Rohertrag Gewerbe = Ist 6.000', zeileK(r.ertragswert_kern, /^Rohertrag Gewerbe/), 6000, 0);
  const z = b && b.zeilen;
  pruefe('B', 'B49', 'genau ein Posten: WE 1 Overrent +2.717 €/Jahr, Befristung 3 J., angesetzt; Laden kein Posten',
    !!z && z.length === 1 && z[0].nr === 'WE 1' && z[0].nutzung === 'wohnen' && z[0].art === 'overrent' && z[0].differenz_jahr === 9000 - 6283
    && z[0].jahre === 3 && z[0].jahre_quelle === 'befristung' && z[0].angesetzt === true, JSON.stringify(z));
  wert('B', 'B49', 'boG = 2.717 × Barwertfaktor (Zins des Kerns, 3 J.)', z && z[0] ? z[0].barwert_eur : null, barwertAbweichung(2717, e.liegenschaftszins_pct, 3), 0);
  const kz = mbZeile(r.ertragswert_kern);
  pruefe('B', 'B49', 'eine boG-Zeile „Mietabweichung Wohnungen", nicht vorläufig', !!kz && /Mietabweichung Wohnungen$/.test(kz.pos) && kz.wert === z[0].barwert_eur
    && /^Reinertragsdifferenz je Jahr/.test(kz.detail) && /WE 1: \+2\.717/.test(kz.detail) && e.vorlaeufig_vor_bog === false, kz ? kz.pos + ' · ' + kz.detail : '');
});
fallB('B50', () => {
  const r = ccFall('demo', wghDemo({ ist_jahr: 8400, mv_befristet_bis: '2031-10-21' })), e = r && r.ertragswert, b = e && e.miete_bog;
  const z = (b && b.zeilen) || [], zW = z.find((x) => x.nr === 'WE 1'), zG = z.find((x) => x.nr === 'Laden');
  pruefe('B', 'B50', 'zwei Posten, je Einheit einmal: WE 1 (wohnen, Overrent ohne Laufzeit, offen) + Laden (gewerbe, befristet 5 J., angesetzt)',
    z.length === 2 && !!zW && !!zG && zW.nutzung === 'wohnen' && zW.angesetzt === false && zW.differenz_jahr === 2717
    && zG.nutzung === 'gewerbe' && zG.angesetzt === true && zG.jahre === 5 && zG.differenz_jahr === 8400 - 6528, JSON.stringify(z));
  wert('B', 'B50', 'angesetzt nur der Laden: 1.872 × Barwertfaktor 5 J.', b ? b.angesetzt_eur : null, barwertAbweichung(1872, e.liegenschaftszins_pct, 5), 0);
  pruefe('B', 'B50', 'WE 1 nur Szenarien 3/5/10 J., Ertragswert vorläufig, Wortlaut „je Wohnung bzw. Gewerbeeinheit"',
    !!b && b.n_offen === 1 && b.offen_differenz_jahr === 2717 && b.szenarien && b.szenarien.length === 3 && e.vorlaeufig_vor_bog === true
    && b.gemischt === true && (r.notes || []).some((n) => /je Wohnung bzw\. Gewerbeeinheit/.test(n)));
  wert('B', 'B50', 'Szenario 10 J. = 2.717 × Barwertfaktor 10 J.', b && b.szenarien ? b.szenarien[2].barwert_eur : null, barwertAbweichung(2717, e.liegenschaftszins_pct, 10), 0);
  wert('B', 'B50', 'Rohertrag Gewerbe = Markt 6.528 (Laden außerhalb), Wohnen 28.423', (zeileK(r.ertragswert_kern, /^Rohertrag Gewerbe/) || 0) * 100000
    + (zeileK(r.ertragswert_kern, /^Rohertrag Wohnen/) || 0), 6528 * 100000 + 28423, 0);
  const kz = mbZeile(r.ertragswert_kern);
  pruefe('B', 'B50', 'boG-Zeile „Mietabweichung Wohnungen und Gewerbe" nennt nur den angesetzten Laden', !!kz && /Wohnungen und Gewerbe$/.test(kz.pos)
    && /Laden: \+1\.872/.test(kz.detail) && !/WE 1/.test(kz.detail), kz ? kz.detail : '');
  const d = ccFall('demo', (a) => { wghDemo({ ist_jahr: 8400, mv_befristet_bis: '2031-10-21' })(a); a[4].bog_eur = -10000; a[4].bog_grund = 'Mietabweichung laut Gutachten'; });
  pruefe('B', 'B50', 'eigener boG mit Mietbezug: keine zusätzliche Mietabweichung (Prompt-Regel 5)', !!d && !mbZeile(d.ertragswert_kern)
    && d.ertragswert.bog_doppelt_vermieden === true, d ? JSON.stringify((d.ertragswert_kern.staffel || []).filter((s) => /Merkmal/.test(s.pos)).map((s) => s.pos)) : '');
});
fallB('B51', () => {
  const ri = DPM.reportInput({ data: { objart: 'MFH', wfl: 378, _mfh_einheiten: [
    { nr: 'WE 1', art: 'wohnen', wfl: 160, ist: 1300, mv_befristet_bis: '2029-10-21' },
    { nr: 'WE 2', art: 'wohnen', wfl: 150, status: 'leer' },
    { nr: 'Laden', art: 'gewerbe', nutzung_gew: 'buero_praxis_laden', wfl: 68, ist: 700, markt_qm: 8 }] } });
  const w = ri && ri.gewerbe && ri.gewerbe.wohnungen;
  pruefe('B', 'B51', 'Mapper: gewerbe.wohnungen nur die Wohnungen, mit Vertragslaufzeit und Leerstand; einheiten_miete bleibt null',
    !!w && w.length === 2 && w[0].nr === 'WE 1' && w[0].ist_monat === 1300 && w[0].mv_befristet_bis === '2029-10-21' && w[1].leer === true
    && ri.einheiten_miete === null, JSON.stringify(w));
  const m = DPM.reportInput({ data: { objart: 'MFH', wfl: 310, _mfh_einheiten: wghWo().map((x) => ({ nr: x.nr, art: 'wohnen', wfl: x.wfl, ist: x.ist_monat })) } });
  pruefe('B', 'B51', 'reines MFH unverändert: einheiten_miete je Wohnung, kein gewerbe', !!m && Array.isArray(m.einheiten_miete) && m.einheiten_miete.length === 5 && m.gewerbe === null);
});

/* ══ v2820 · ABNAHME v2800 AN DER GANZEN KETTE (B52) ═════════════════════
   B48 setzt ohne_nutzung_qm/-nr von Hand. Hier kommt die Einheitenliste so,
   wie das Formular sie schickt (dealpilot-mb.js), durch den ECHTEN Mapper in
   den ECHTEN Kern. Vorher (v2800): das Formular schickte weder nr noch lage,
   der Mapper nannte die Einheit „GE 1" - ein Name, den es im Formular nicht gibt. */
fallB('B52', () => {
  const liste = (laden) => ({ data: { objart: 'MFH', wfl: 378, _mfh_einheiten: wghWo().map((x) => ({ nr: x.nr, art: 'wohnen', wfl: x.wfl, ist: x.ist_monat }))
    .concat([Object.assign({ art: 'gewerbe', wfl: 68, ist: 544, markt_qm: 8 }, laden)]) } });
  const ri = DPM.reportInput(liste({ nr: 'Laden' })), g = ri && ri.gewerbe;
  pruefe('B', 'B52', 'Mapper: Laden ohne Nutzungsart -> ohne_nutzung_qm 68, Name wie im Formular', !!g && g.ohne_nutzung_qm === 68
    && g.ohne_nutzung_nr.join() === 'Laden', JSON.stringify(g && g.ohne_nutzung_nr));
  const r = ccFall('demo', (a) => { a[0].gewerbe = g; }), e = r && r.ertragswert;
  pruefe('B', 'B52', 'Kette Mapper -> Kern: kein Ertragswert, Nachfrage Feld nutzung_gew, Einheit Laden, Ort im Formular',
    !!e && e.available === false && e.grund === 'gewerbe_ohne_nutzungsart' && e.nachfrage && e.nachfrage.feld === 'nutzung_gew'
    && e.nachfrage.einheiten.join() === 'Laden' && /Einheiten erfassen/.test(e.hinweis), e ? e.grund + ' ' + JSON.stringify(e.nachfrage) : 'kein Ergebnis');
  const ohne = DPM.reportInput(liste({})), go = ohne && ohne.gewerbe;
  pruefe('B', 'B52', 'ohne Nummer: Rückfall = Zeilennummer der Liste (Nr. 6), nicht „GE 1"', !!go && go.ohne_nutzung_nr.join() === 'Nr. 6', JSON.stringify(go && go.ohne_nutzung_nr));
  const mit = DPM.reportInput(liste({ nr: 'Laden', nutzung_gew: 'buero_praxis_laden' }));
  const rm = ccFall('demo', (a) => { a[0].gewerbe = mit.gewerbe; });
  pruefe('B', 'B52', 'mit Nutzungsart rechnet dieselbe Kette', !!rm && rm.ertragswert.available === true, rm && rm.ertragswert.grund);
});

/* ══ v2824 · GEWERBE-/INDUSTRIEGEBAEUDE (GEW) MIT EINHEITEN (B53) ══════════
   Marcel 22.10.2026: GEW bekommt „Einheiten erfassen" wie das Geschaeftshaus.
   Kette Formular-Liste -> echter Mapper -> echter Kern, Objektart GEW (Gewerbeart
   des Objekts: gew). v2825 (Marcel 22.10.2026): eine Einheit ohne eigene
   Nutzungsart wird im GEW NACHGEFRAGT wie im WGH - vorher (v2824) trug sie die
   Art des Objekts (Halle/Lager, 30 %) und der Ertragswert rechnete mit Hinweis. */
fallB('B53', () => {
  const ein = (zwei) => [{ nr: 'Halle', art: 'gewerbe', nutzung_gew: 'lager_logistik', wfl: 300, ist: 1500, markt_qm: 5 },
    Object.assign({ nr: 'Büro', art: 'gewerbe', wfl: 78, ist: 700, markt_qm: 9 }, zwei || {})];
  const ri = DPM.reportInput({ data: { objart: 'GEW', wfl: 378, _mfh_einheiten: ein() } }), g = ri && ri.gewerbe;
  pruefe('B', 'B53', 'Mapper: GEW -> gewerbe, Gewerbeart gew, Einheiten getrennt, Büro ohne Nutzungsart', !!g && ri.property_type === 'gewerbe'
    && ri.gewerbe_art === 'gew' && g.n_gewerbe === 2 && g.wfl_gewerbe === 378 && g.flaechen.lager_logistik === 300 && g.ohne_nutzung_nr.join() === 'Büro',
    JSON.stringify({ pt: ri && ri.property_type, art: ri && ri.gewerbe_art, fl: g && g.flaechen, ohne: g && g.ohne_nutzung_nr }));
  const lauf = (r0) => ccFall('demo', (a) => { a[0].property_type = r0.property_type; a[0].gewerbe_art = r0.gewerbe_art; a[0].gewerbe = r0.gewerbe;
    a[0].garages = 0; a[0].outdoor_parking = 0;
    Object.assign(a[4], { lzs_pct: 5, lzs_zweig: 'gewerbe', lzs_aus_register: true, lzs_stufe: 'A', lzs_modellansaetze: null }); });
  const r = lauf(ri), e = r && r.ertragswert;
  pruefe('B', 'B53', 'GEW, eine Einheit ohne Nutzungsart → kein Ertragswert, Nachfrage nutzung_gew für „Büro", Ort im Formular (vorher v2824: rechnete mit Halle/Lager 30 %)',
    !!e && e.available === false && e.grund === 'gewerbe_ohne_nutzungsart' && e.gewerbe === true && e.nachfrage && e.nachfrage.feld === 'nutzung_gew'
    && e.nachfrage.einheiten.join() === 'Büro' && /Einheiten erfassen/.test(e.hinweis) && /„Nutzungsart“/.test(e.hinweis), e ? (e.grund || '') + ' ' + JSON.stringify(e.nachfrage) : 'kein Ergebnis');
  pruefe('B', 'B53', 'kein Übernahme-Hinweis „mit der Gewerbeart des Objekts angesetzt"', !!r && !(r.notes || []).some((n) => /mit der Gewerbeart des Objekts angesetzt/.test(n)));
  const riN = DPM.reportInput({ data: { objart: 'GEW', wfl: 378, _mfh_einheiten: ein({ nutzung_gew: 'buero_praxis_laden' }) } });
  const rN = lauf(riN), eN = rN && rN.ertragswert;
  pruefe('B', 'B53', 'GEW mit Nutzungsart je Einheit: Gewerbe-Ertragswert rechnet', !!eN && eN.available === true && eN.gewerbe === true, eN && (eN.grund || ''));
  pruefe('B', 'B53', 'Rohertrag: beide Ist-Mieten im Band ±20 % um die Marktmiete (Halle 1.500 = 300 × 5, Büro 700 zu 702) → Ist (1.500 + 700) × 12', !!eN && eN.rohertrag_pa_eur === (1500 + 700) * 12, eN && eN.rohertrag_pa_eur);
  const gB = ccFall('demo', gewObjekt({ flaechen: { buero_praxis_laden: 200 }, ohne_nutzung_qm: 178, ohne_nutzung_nr: ['Lager'] }, 'buero'));
  pruefe('B', 'B53', 'Büroobjekt (Gewerbeart buero) unverändert: Einheit ohne Angabe trägt die Art des Objekts (v2790)', !!gB && gB.ertragswert.available === true);
  const riO = DPM.reportInput({ data: { objart: 'Gewerbe', wfl: 378, _mfh_einheiten: ein() } }), rO = lauf(riO), eO = rO && rO.ertragswert;
  pruefe('B', 'B53', 'ohne erkennbare Gewerbeart: kein Ertragswert, Nachfrage nutzung_gew für „Büro"', !!eO && eO.available === false
    && eO.grund === 'gewerbe_ohne_nutzungsart' && eO.nachfrage && eO.nachfrage.feld === 'nutzung_gew' && eO.nachfrage.einheiten.join() === 'Büro',
    eO ? eO.grund + ' art=' + (riO && riO.gewerbe_art) : '');
});

/* ══ v2854 · SANIERUNGSSTAU IN DEN STUFEN NICHT DOPPELT (B54) ═════════════
   Parkstr. 9: Sanierungskosten 137.000 € stehen im Bestand als boG (Mapper bomAus),
   die Zielbild-Massnahmen (136.000 €) sind dieselben Arbeiten und werden im Wertzuwachs
   als Kosten abgezogen. Entscheidung 22.10.2026: in jeder Stufe gilt der Stau in Hoehe
   ihrer Kosten als behoben, boG = min(0, Stau + Kosten) - nur fuer einen boG aus den
   Sanierungskosten. Gegentest: kosten 0 = alter Weg (voller Stau in der Stufe). */
let PSM = null, psGrund = '';
try { PSM = await lade('services/PotenzialService.js'); } catch (e) { psGrund = e.message.slice(0, 80); }
fallB('B54', () => {
  if (!PSM || typeof PSM._eineStufe !== 'function') return pruefe('B', 'B54', 'PotenzialService geladen', false, psGrund || '_eineStufe fehlt');
  const GRUND = 'Sanierungs-/Instandsetzungskosten laut Objekt (brutto) — Kostenansatz, kein sachverständig ermittelter Wertabschlag';
  const lauf = (quelle, grund) => ccFall('demo', (a) => { a[0].bom_eur = -137000; a[0].bom_quelle = quelle; a[4].bog_eur = -137000; a[4].bog_grund = grund; });
  const r = lauf('sanierungskosten', GRUND), basis = r && r._ertragswertEingabe;
  pruefe('B', 'B54', 'Kette: boG aus den Sanierungskosten trägt bog_quelle', !!basis && basis.ein.bog_quelle === 'sanierungskosten' && basis.ein.bog_eur === -137000,
    basis ? basis.ein.bog_quelle + ' ' + basis.ein.bog_eur : 'keine Ertragswert-Eingabe');
  if (!basis) return;
  const kB = ertragswert(Object.assign({}, basis.ein), basis.bodenwert), B = kB.wert_ungerundet, miete = basis.ein.miete_markt_jahr;
  const zZ = PSM._eineStufe(basis, {}, kB, miete, 0, 136000), zM = PSM._eineStufe(basis, {}, kB, miete, 0, 0);
  wert('B', 'B54', 'Zielbild, Kosten 136.000 → Rest-boG −1.000', zZ && zZ.sanierungsstau ? zZ.sanierungsstau.rest_eur : null, -1000, 0);
  wert('B', 'B54', 'Zielbild bei gleicher Miete: Ertragswert = Bestand + 136.000 (vorher = Bestand, Stau doppelt)', zZ ? zZ.wert_ungerundet - B : null, 136000, 1);
  pruefe('B', 'B54', 'Rechenweg-Zeile „Sanierungsstau durch die Maßnahmen dieser Stufe behoben: 136.000 €, Rest 1.000 €"',
    !!zZ && /behoben: 136\.000 €, Rest 1\.000 €/.test(zZ.sanierungsstau.text), zZ && zZ.sanierungsstau && zZ.sanierungsstau.text);
  wert('B', 'B54', 'Stufe ohne Kosten → voller Stau −137.000', zM && zM.sanierungsstau ? zM.sanierungsstau.rest_eur : null, -137000, 0);
  wert('B', 'B54', 'Stufe ohne Kosten: Ertragswert = Bestand', zM ? zM.wert_ungerundet - B : null, 0, 1);
  const zG = PSM._eineStufe(basis, {}, kB, miete, 0, 200000);
  wert('B', 'B54', 'Kosten über dem Stau: boG nie positiv (Rest 0, Ertragswert = Bestand + 137.000)', zG ? zG.wert_ungerundet - B : null, 137000, 1);
  const rE = lauf('eigene_angabe', 'Wegerecht zugunsten des Nachbarn'), bE = rE && rE._ertragswertEingabe;
  const kE = bE ? ertragswert(Object.assign({}, bE.ein), bE.bodenwert) : null, zE = bE ? PSM._eineStufe(bE, {}, kE, bE.ein.miete_markt_jahr, 0, 136000) : null;
  pruefe('B', 'B54', 'eigene bOM-Angabe (Wegerecht) bleibt in jeder Stufe voll', !!zE && !zE.sanierungsstau && zE.wert_ungerundet === kE.wert_ungerundet && bE.ein.bog_quelle === null,
    zE ? 'quelle ' + bE.ein.bog_quelle + ', Δ ' + (zE.wert_ungerundet - kE.wert_ungerundet) : 'kein Lauf');
});

/* v3005 · B55 Regionalfaktor aus dem Sachwertmodell (Hamburg 1,75, § 36 Abs. 3) · B56 Baupreisindex
   zum Wertermittlungsstichtag (§ 36 Abs. 2) · B57 GND Wohnhaus mit Mischnutzung 80 (Anlage 1) */
(() => {
  const ref = { property_type: 'efh', property_subtype: 'efh', living_area: 140, build_year: 1990, plot_area: 600,
    ags: '02000000', standardstufe: 3, nhk_typ: '1.21', bgf: 225, gemeinde: 'Hamburg' };
  const par = (x) => Object.assign({ ags: '02000000', brw_sqm: 800, standardstufe: 3, bgf_direkt: 225 }, x || {});
  const lv = { available: true, value_sqm: 800 };
  const s0 = (compute(ref, lv, null, null, par()) || {}).sachwert || {};
  wert('B', 'B55', 'Hamburg: Regionalfaktor aus dem Modell', s0.regionalfaktor ?? null, 1.75, 0);
  pruefe('B', 'B55', 'Hamburg: Quelle modell_gutachterausschuss, Staffelzeile × Regionalfaktor 1,75',
    s0.regionalfaktor_quelle === 'modell_gutachterausschuss' && (s0.staffel || []).some((z) => /Regionalfaktor/.test(z.pos) && z.faktor === 1.75),
    s0.regionalfaktor_quelle);
  const s1 = (compute(ref, lv, null, null, par({ regionalfaktor: 1.2 })) || {}).sachwert || {};
  pruefe('B', 'B55', 'eigene Angabe 1,2 gilt, mit Hinweis auf § 10', s1.regionalfaktor === 1.2 && /§ 10/.test(String(s1.regionalfaktor_hinweis)), s1.regionalfaktor_hinweis);
  const s2 = (compute(ref, lv, null, null, par({ wertermittlungsstichtag: '2025-06-15' })) || {}).sachwert || {};
  /* v3010 · gewollt geaendert: am 15.06.2025 war der Mai-Wert noch nicht veroeffentlicht (Rhythmus: Juli) -> Februar 2025 */
  wert('B', 'B56', 'Baupreisindex zum Stichtag 15.06.2025 (veröffentlicht: Februar 2025, 132,6 / 70,8)', s2.baupreisindex ? s2.baupreisindex.wert : null, 1.87, 0);
  const s3 = (compute(ref, lv, null, null, par({ wertermittlungsstichtag: '2099-01-01' })) || {}).sachwert || {};
  pruefe('B', 'B56', 'Stichtag in der Zukunft verworfen, heutiger Index', !!s3.baupreisindex && s3.baupreisindex.stichtag_verworfen === '2099-01-01' && s3.baupreisindex.wert === s0.baupreisindex.wert,
    JSON.stringify(s3.baupreisindex || null).slice(0, 80));
  wert('B', 'B57', 'GND Wohnhaus mit Mischnutzung (Anlage 1)', IW.gnd('wohn_misch'), 80, 0);
})();

/* v3009 · B58 Objektspezifisch angepasster Liegenschaftszins (§ 33): Koeffizienten des Ausschusses
   (GAG Aurich, Bueroflaechen 3,5 % bei RND 30, UK 20/30/40/50 = 1,2/1,0/0,8/0,6, GMB S. 44),
   multiplikativ, nur innerhalb der Tabelle; der angepasste Zins geht in Barwertfaktor und
   Bodenwertverzinsung (§ 34 Abs. 1). */
{
  const LA = await lade('lib/lzs_anpassung.js');
  const satz = { gaa_name: 'GAG Aurich', formel: { form: 'konstante', wert: 3.5, rundung_stellen: 2 },
    korrekturen: [{ bez: 'Umrechnungskoeffizient Restnutzungsdauer', feld: 'restnutzungsdauer', art: 'stufen_1d', einheit: 'faktor',
      stufen: { 20: 1.2, 30: 1, 40: 0.8, 50: 0.6 } }] };
  const a40 = LA.lzsAnpassung({ satz, wert_pct: 3.5, eingabe: { restnutzungsdauer: 40 } });
  wert('B', 'B58', 'RND 40: 3,5 % × 0,8 (Stützstelle, multiplikativ, nicht addiert)', a40 && a40.zins_pct, 2.8, 0);
  const a35 = LA.lzsAnpassung({ satz, wert_pct: 3.5, eingabe: { restnutzungsdauer: 35 } });
  wert('B', 'B58', 'RND 35: zwischen den Stützstellen linear (× 0,9)', a35 && a35.zins_pct, 3.15, 0);
  const a60 = LA.lzsAnpassung({ satz, wert_pct: 3.5, eingabe: { restnutzungsdauer: 60 } });
  pruefe('B', 'B58', 'RND 60 außerhalb der Tabelle: nicht extrapoliert, Zins bleibt 3,5 %, Merkmal offen',
    !!a60 && a60.zins_pct === 3.5 && !a60.angepasst && a60.offen.length === 1 && a60.offen[0].ausserhalb, a60 && a60.text);
  const aOhne = LA.lzsAnpassung({ satz: { formel: { form: 'konstante', wert: 2.5 } }, wert_pct: 2.5, eingabe: {} });
  pruefe('B', 'B58', 'ohne Funktion des Ausschusses: unangepasst, mit Grund', !!aOhne && !aOhne.angepasst && /keine Umrechnungskoeffizienten/.test(aOhne.text), aOhne && aOhne.art);
  /* Kette in den Kern: derselbe Ertragswert mit 2,8 % - einmal als Anpassung, einmal ohne - ist gleich,
     und die Anpassungszeile steht im Rechenweg */
  const basisEin = { objektart: 'mfh', anzahl_we: 4, wohnflaeche_qm: 300, miete_markt_jahr: 27000,
    lzs_pct: 2.8, lzs_stufe: 'A', baujahr: 1985, rnd_jahre: 40, stichtag_jahr: 2026, bwk_modus: 'manuell', bwk_gesamt_jahr: 6000 };
  const kOhne = ertragswert(Object.assign({}, basisEin), { vollstaendig: true, wert: 100000 });
  const kMit = ertragswert(Object.assign({}, basisEin, { lzs_anpassung: a40 }), { vollstaendig: true, wert: 100000 });
  pruefe('B', 'B58', 'angepasster Zins 2,8 % in Barwertfaktor und Bodenwertverzinsung, Zeile „3,5 % → 2,8 % (A, angepasst)"',
    !!kMit && kMit.wert === kOhne.wert && (kMit.staffel || []).some((z) => /3,5 % → objektspezifisch angepasst 2,8 % \(A, angepasst\)/.test(z.pos))
      && (kMit.staffel || []).some((z) => /Bodenwertverzinsung .*× 2,8 %/.test(z.pos)),
    kMit && (kMit.staffel || []).map((z) => z.pos).filter((p) => /Liegenschaftszins|Bodenwertverzinsung|Barwert/.test(p)).join(' | '));
}

/* v3010 · B59 Wertermittlungsstichtag (Marcel 27.10.2026): heute (Pruefer-Uhr 21.10.2026) gegen 01.06.2024
   an einem Testobjekt - Baupreisindex nach VEROEFFENTLICHTEM Stand, Alter/RND im Stichtagsjahr, Jahrgang des
   Registers zum Stichtag, kuenftiger Stichtag verworfen. */
{
  const BPI = await lade('lib/baupreisindex.js'), ST = await lade('lib/stichtag.js'), REG = await lade('lib/ausschuss_register.js');
  const am = (t) => { const x = BPI.baupreisindexAm(new Date(t + 'T12:00:00Z')); return x ? x.wert : null; };
  wert('B', 'B59', 'Baupreisindex 21.10.2026 (August 2026, veröffentlicht 09.10.)', am('2026-10-21'), 2.00, 0);
  wert('B', 'B59', 'Baupreisindex 01.09.2026: August noch nicht veröffentlicht → Mai 2026', am('2026-09-01'), 1.98, 0);
  wert('B', 'B59', 'Baupreisindex 01.06.2024 (Februar 2024: 128,5 / 70,8)', am('2024-06-01'), 1.81, 0);
  pruefe('B', 'B59', 'Stichtag in der Zukunft verworfen, heute', ST.stichtagAus('2099-01-01').eigen === false && ST.stichtagAus('2099-01-01').verworfen === '2099-01-01', JSON.stringify(ST.stichtagAus('2099-01-01').verworfen));
  const ref = { property_type: 'efh', property_subtype: 'efh', living_area: 140, build_year: 1990, plot_area: 600,
    ags: '05711000', standardstufe: 3, nhk_typ: '1.21', bgf: 225, gemeinde: 'Bielefeld' };
  const par = (x) => Object.assign({ ags: '05711000', brw_sqm: 300, standardstufe: 3, bgf_direkt: 225 }, x || {});
  const lv = { available: true, value_sqm: 300 };
  const h = (compute(ref, lv, null, null, par()) || {}).sachwert || {};
  const v = (compute(ref, lv, null, null, par({ wertermittlungsstichtag: '2024-06-01' })) || {}).sachwert || {};
  wert('B', 'B59', 'Sachwert: Index im Rechenweg 01.06.2024', v.baupreisindex ? v.baupreisindex.wert : null, 1.81, 0);
  wert('B', 'B59', 'Restnutzungsdauer +2 Jahre (Alter 34 statt 36, Stichtagsjahr − Baujahr)',
    (v.restnutzungsdauer_jahre != null && h.restnutzungsdauer_jahre != null) ? v.restnutzungsdauer_jahre - h.restnutzungsdauer_jahre : null, 2, 0);
  pruefe('B', 'B59', 'Sachwert 01.06.2024 weicht vom heutigen ab (Index und Alter)', h.value_eur != null && v.value_eur != null && h.value_eur !== v.value_eur,
    'heute ' + h.value_eur + ' · 01.06.2024 ' + v.value_eur);
  const jg = REG.mitRegisterStichtag('2024-06-01', () => REG.findeZweig('liegenschaftszinssatz', '05711000', 'we_v'));
  const jgH = REG.findeZweig('liegenschaftszinssatz', '05711000', 'we_v');
  pruefe('B', 'B59', 'Register-Jahrgang zum Stichtag: Bielefeld ETW 01.06.2024 → Satz 31.12.2023, heute jüngster',
    !!jg && String(jg.stichtag).slice(0, 10) === '2023-12-31' && !!jgH && String(jgH.stichtag) > '2024', (jg && jg.stichtag) + ' / ' + (jgH && jgH.stichtag));
  const m1 = CCS.mietabweichungBog([{ nr: 1, differenz_jahr: 1200, befristet_bis: '2026-06-01' }], 3, 40, new Date('2024-06-01T12:00:00Z'));
  const m2 = CCS.mietabweichungBog([{ nr: 1, differenz_jahr: 1200, befristet_bis: '2026-06-01' }], 3, 40, new Date('2026-06-01T12:00:00Z'));
  pruefe('B', 'B59', 'Mietabweichung: Restlaufzeit ab Stichtag (2 Jahre ab 01.06.2024, 0 ab 01.06.2026)',
    !!m1 && !!m2 && m1.zeilen[0].jahre === 2 && m2.zeilen[0].jahre === 0, JSON.stringify(m1 && m1.zeilen && m1.zeilen[0] && m1.zeilen[0].jahre) + '/' + JSON.stringify(m2 && m2.zeilen && m2.zeilen[0] && m2.zeilen[0].jahre));
}

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
console.log('wertermittlung-pruefen v2854 · Uhr ' + new _Date(FEST).toISOString().slice(0, 10));
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
