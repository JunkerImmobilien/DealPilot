// PotenzialService.js — v2430 · Ertragswert je Stufe (Bestand · Mieterhöhung · Zielbild)
// ─────────────────────────────────────────────────────────────────────────────
// Marcel 19.10.2026: „Der Investor zeigt der Bank das versteckte Kapital im Haus."
//
// KEIN ZWEITER ERTRAGSWERT. Die Basis entsteht im ReportOrchestrator mit
// `nurWertBasis` — derselbe Weg wie der Bericht Stufe 3 bis einschließlich
// CrossCheckService.compute (Mapper, BORIS, Zins-Kaskade A–E/N, BWK-Quote, GND
// des Zins-Modells, Bodenwert, marktübliche bzw. Ist-Miete). Der Quercheck legt
// die Eingabe seines Kerns nicht aufzählbar ab (`_ertragswertEingabe`). Hier
// rechnet derselbe Kern (`ErtragswertService.ertragswert`) mit dieser Eingabe:
//
//   Bestand        unverändert          -> muss dem Bericht Stufe 3 entsprechen
//   Mieterhöhung   Wohn-Rohertrag = Soll-Mieten, RND nach Modernisierungspunkten
//   Zielbild       Wohn-Rohertrag = Zielmieten,  RND nach Modernisierungspunkten
//
// Liegenschaftszins, Bodenwert, GND und Gewerbe bleiben; die BWK-Quote folgt
// dem neuen Rohertrag (sie steht auf dem gesamten Rohertrag, § 10 ImmoWertV).
//
// Aufteilung: jede Wohnung zusätzlich als Eigentumswohnung — Zins der Kaskade
// für Wohnungseigentum, Bodenwertanteil nach MEA oder Fläche, ein Kern-Aufruf je
// Wohnung und Stufe. Gewerbe bleibt mit seinem Anteil am Haus in der Summe.
//
// Kennzeichnung überall: Potenzialwert, keine Verkehrswertermittlung. Kein
// Bericht, kein Eintrag in mb.reports/mb.properties, kein KI-Aufruf.
import { ErtragswertService } from './ErtragswertService.js';
import { WertParameterService } from './WertParameterService.js';
import { restnutzungsdauerEinheitlich as rndEinheitlich } from '../lib/rnd-einheitlich.js';
import { mieteNachBand, herkunftNachBand, differenzZumErtragswert } from './CrossCheckService.js';   /* v2488 · dieselbe Bandregel wie der Bestand; v2595 · dieselbe Differenz */
import { ValuationService } from './ValuationService.js';         /* v2541 */
import { MarketAnalysisService } from './MarketAnalysisService.js';   /* v2541 */
import { marktmiete as amtlicheMiete, klasseAusPunkten, KLASSE_TEXT } from '../lib/mietmodell_nrw.js';   /* v2988 */
import { MIETBAND } from './CrossCheckService.js';   /* v2988 */
import { erhoehungspfad558, ausschluss558, kappungFuer } from '../lib/kappung.js';
import { vergleichsmieteWohnung, bandWohnung, zielMaximum, mietsteigerungRate, fortschreibung } from '../lib/mietanker.js';   /* v3343 */
import { barwertAbweichung } from '../lib/immowertv.js';   /* v3283 · Mietabweichung je Wohnung mit dem ETW-Zins */
import { vergleichsfaktor as regVergleichsfaktor } from '../lib/gutachterausschuss.js';   /* v3200 · Aufteilerwert */
import { regVfEingabe, regVfErgebnis } from '../lib/vergleichsfaktor_eingabe.js';         /* v3200 */
import { vergleichsfaktor as amtlicherVf } from '../lib/vergleichsfaktoren_nrw.js';      /* v3200 */
import { IrwConnector } from '../connectors/IrwConnector.js';                            /* v3200c */
import { vergleichswertIrw, objektAusRef } from '../lib/vergleichswert_irw.js';           /* v3200c */   /* v3150 */

/* ══ v2541 · MARKTPREISINDIKATION JE STUFE UND JE WOHNUNG ═════════════════════
   Marcel 20.10.2026: „dann kann man den Ertragswert sehen, aber auch die
   Marktpreisindikationen" — Entscheidung: beide Wege nebeneinander.
   (1) Angebote: derselbe Kern wie der Bericht (ValuationService.compute, Median
       der Angebotspreise × Fläche × Objektfaktoren, Abschlag auf Angebotspreise).
       Bestand = die Indikation des Berichts. Mieterhöhung = dieselbe Zahl (die
       Angebotspreise hängen nicht an der Miete - so ausgewiesen). Zielbild =
       derselbe Kern mit Zustand „modernisiert" und Modernisierung im Stichtagsjahr;
       ein bOM-Kostenabzug entfällt dort (die Maßnahmen stehen als Kosten daneben).
   (2) Rohertragsfaktor × Jahresmiete der Stufe: nur wo der Ausschuss für das
       Segment einen Rohertragsfaktor veröffentlicht (Register), sonst kein Wert
       und der Satz, warum (Wo die Quelle endet, endet die Rechnung).
   Je Wohnung (nur mit Aufteilung): Angebote für WOHNUNGEN am Ort (eigener Abruf
   je Flächenklasse, Segment „Wohnung") × Fläche der Wohnung, derselbe Kern. */
const rundeMpi = (v) => (v == null ? null : Math.round(v / (v >= 500000 ? 5000 : v >= 100000 ? 1000 : 500)) * (v >= 500000 ? 5000 : v >= 100000 ? 1000 : 500));
function mpiAngebote(wb, refAenderung) {
  try {
    if (!wb || !wb.sale || !(Number(wb.sale.median_per_sqm) > 0)) return null;
    const ref = Object.assign({}, wb.ref || {}, refAenderung || {});
    const v = ValuationService.compute(ref, wb.sale, wb.rent, wb.land_value_roh || null);
    const mv = v && v.market_value;
    if (!mv || mv.estimated == null) return null;
    return { wert: mv.estimated, low: mv.low ?? null, high: mv.high ?? null,
             abschlag_pct: mv.angebot_abschlag ? mv.angebot_abschlag.pct : null,
             abschlag_herkunft: mv.angebot_abschlag ? mv.angebot_abschlag.herkunft : null,
             abschlag_kurz: mv.angebot_abschlag ? (mv.angebot_abschlag.kurz || null) : null,   /* v2578 */
             /* v2842 · der Wert OHNE Abschlag (Angebotsniveau), wie ValuationService ihn fuehrt */
             roh: mv.angebot_abschlag && mv.angebot_abschlag.roh ? { wert: mv.angebot_abschlag.roh.estimated ?? null, low: mv.angebot_abschlag.roh.low ?? null, high: mv.angebot_abschlag.roh.high ?? null } : null,
             median_qm: mv.basis_median_sqm ?? null, gegenprobe: v.amtliche_gegenprobe || null };
  } catch (e) { return null; }
}
const ZIELBILD_REF = () => ({ condition: 'modernisiert', modernization: 'umfassend modernisiert',
  modernization_year: new Date().getFullYear(), bom_eur: null, bom_grund: null });

/* v2870 · Marcel 22.10.2026, neuer Wortlaut (vorher „Potenzialwert …, keine Verkehrswertermittlung“) */
/* v3150 · die Stufe Mieterhoehung ist seit N114 ein Wert ZUM STICHTAG (Erhoehungen erst ab Wirksamkeit, abgezinst);
   der Ausblick-Satz gilt nur noch fuer das Zielbild. */
export const KENNZEICHNUNG = 'Der Ertragswert nach Mieterhöhung bezieht sich auf den heutigen Stichtag: die nach § 558 BGB zulässigen Erhöhungen zählen erst ab ihrer Wirksamkeit und sind abgezinst, Gebäudezustand und Restnutzungsdauer sind die des Bestands. Der Ertragswert im Zielbild ist ein Ausblick: er unterstellt, dass die Maßnahmen umgesetzt sind, und ist kein Verkehrswert nach § 194 BauGB zum heutigen Stichtag.';
const STUFEN = ['mieterhoehung', 'zielbild'];

const zahl = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const rund = (v) => (v == null ? null : Math.round(v));

/** Die BWK-Eingabe auf einen neuen Wohn-Rohertrag umstellen.
 *  `manuell` (Quote des Ausschusses oder Pauschale) steht als Betrag in der
 *  Eingabe und muss mitwandern; `normiert` rechnet der Kern selbst. */
function bwkNachziehen(ein, neuMieteJahr) {
  if (String(ein.bwk_modus) !== 'manuell' || !(Number(ein.bwk_gesamt_jahr) > 0)) return;
  const alteMiete = Number(ein.miete_markt_jahr) || 0;
  const bezug = Number(ein.bwk_bezugsgroesse_jahr) > 0 ? Number(ein.bwk_bezugsgroesse_jahr) : alteMiete;
  if (!(bezug > 0)) return;
  const quote = Number(ein.bwk_gesamt_jahr) / bezug;
  const neuBezug = bezug - alteMiete + neuMieteJahr;
  ein.bwk_gesamt_jahr = Math.round(neuBezug * quote);
  if (Number(ein.bwk_bezugsgroesse_jahr) > 0) ein.bwk_bezugsgroesse_jahr = Math.round(neuBezug);
}

/** Restnutzungsdauer einer Stufe: dieselbe Ableitung wie im Bestand, nur mit
 *  den Punkten nach der Maßnahme. Eine Maßnahme verlängert, verkürzt nie. */
function rndEinstellen(ein, ref, basisKern, plusPunkte) {
  const plus = Number(plusPunkte) > 0 ? Number(plusPunkte) : 0;
  const basisP = zahl(ein.mod_punkte);
  const neuP = Math.min(20, (basisP != null ? basisP : 0) + plus);
  const info = { mod_punkte_vorher: basisP, mod_punkte: plus > 0 ? neuP : basisP, plus };
  if (plus <= 0) return info;
  if (ein.rnd_jahre == null) {
    ein.mod_punkte = neuP;                       /* der Kern leitet Anlage 2 selbst ab */
  } else {
    const G = (basisKern && basisKern.nutzungsdauer && basisKern.nutzungsdauer.gnd) || ein.gnd_jahre || 80;
    try {
      const r = rndEinheitlich(Object.assign({}, ref, { mod_punkte: neuP }), G);
      if (r && r.quelle === 'anlage2' && Number(r.rnd) > Number(ein.rnd_jahre)) ein.rnd_jahre = Number(r.rnd);
      info.rnd_quelle = r ? r.quelle : null;
    } catch (e) { /* bleibt bei der RND des Bestands */ }
  }
  return info;
}

function kernZusammenfassung(k) {
  if (!k) return null;
  const st = Array.isArray(k.staffel) ? k.staffel : [];
  const pos = (re) => { const z = st.find((x) => re.test(String(x.pos || ''))); return z ? z.wert : null; };
  return {
    wert: k.vollstaendig ? (k.wert ?? null) : null,
    wert_ungerundet: k.wert_ungerundet ?? null,
    vollstaendig: !!k.vollstaendig,
    rnd: k.nutzungsdauer ? k.nutzungsdauer.rnd : null,
    gnd: k.nutzungsdauer ? k.nutzungsdauer.gnd : null,
    rnd_modell: k.nutzungsdauer ? k.nutzungsdauer.modell : null,
    barwertfaktor: k.barwertfaktor ?? null,
    rohertrag: pos(/^= Rohertrag/),
    reinertrag: pos(/^= Reinertrag/),
    lzs_pct: k.lzs ? k.lzs.pct : null,
    lzs_stufe: k.lzs ? k.lzs.stufe : null,
    warnungen: Array.isArray(k.warnungen) ? k.warnungen.slice(0, 4) : [],
  };
}

/* ══ v2488 · EINE BASIS FUER ALLE STUFEN (20.10.2026) ═══════════════════════
   Gemessen am Demo-MFH (6 WE, 378 m², eine leer, Ist 5,99 €/m²): Bestand
   545.000 €, Mieterhöhung 535.000 € - die Stufe lag UNTER dem Bestand, obwohl
   die Miete stieg. Der Bestand rechnete mit der Wertermittlungs-Miete (Ist unter
   dem Band -> untere Kante 6,64 €/m² auf alle 378 m², die leere Wohnung
   eingeschlossen), die Stufen mit der tatsaechlichen Miete aus dem Browser
   (leer = 0, ohne Bandpruefung).
   Jetzt je Wohnung:
     Basis (roh)  vermietet: Ist-Miete nach der Bandregel des Bestands
                  (mieteNachBand, je €/m²); leer: Vergleichsmiete des Bestands
     Basis        so verteilt, dass die Summe EXAKT dem Bestands-Rohertrag
                  entspricht (Bestand = Bericht Stufe 3): der Unterschied zuerst
                  auf die leeren Wohnungen, der Rest anteilig
     Stufe        Basis + max(0, min(Stufenmiete, obere Bandkante) - Basis roh)
                  (leer: gegen die Basis selbst, also max(Basis, Stufenmiete))
   Die Anhebung ist damit genau die Mehrmiete der Wohnung gegen ihre eigene
   gepruefte Basis - bei Angleichung 1 dasselbe wie max(Basis, Stufenmiete).
   Ueber der oberen Kante wird nichts kapitalisiert (§ 8 Abs. 3 ImmoWertV, wie
   im Bestand). Eine Stufe unterschreitet den Bestand nie. */
const r2 = (x) => Math.round(x * 100) / 100;
function bestandsBasis(basis, wl) {
  const band = basis.miete_band || null;
  const markt = zahl(basis.markt_qm) || zahl(basis.miete_qm);
  const rB = Number(basis.ein.miete_markt_jahr) || 0;
  const zeilen = wl.map((w) => {
    if (!w || w.art === 'gewerbe' || !(Number(w.wfl) > 0)) return null;
    const wfl = Number(w.wfl);
    const ist = zahl(w.miete_jahr && w.miete_jahr.bestand) || 0;
    /* v3343 · je Wohnung ihre eigene Vergleichsmiete und ihr Band - dieselbe Rechnung wie CrossCheckService
       (lib/mietanker.js), nur wenn der Anker des Bestands aus ihr kommt (basis.vgl_kontext) */
    const vW = basis.vgl_kontext ? vergleichsmieteWohnung(basis.vgl_kontext, wfl) : null;
    const bW = vW ? bandWohnung(vW) : null;
    const bandW = bW ? Object.assign({}, band || {}, { anker_qm: bW.anker_qm, unten_qm: bW.unten_qm, oben_qm: bW.oben_qm, spanne: bW.spanne }) : band;
    const marktW = bW ? bW.anker_qm : markt;
    let qm, herkunft, istQm = null;
    if (ist > 0) {
      istQm = r2(ist / 12 / wfl);
      const r = mieteNachBand(istQm, bandW, marktW);
      qm = r.qm != null ? r.qm : istQm;
      herkunft = herkunftNachBand(r);   /* v2600 · ausserhalb: Anker (ueber_band/unter_band) */
    } else {
      qm = marktW; herkunft = 'leer_marktueblich';
    }
    if (!(qm > 0)) return null;
    return { wfl, ist, ist_qm: istQm, qm, herkunft, roh: herkunft === 'ist_im_band' ? ist : qm * wfl * 12,   /* v2541 · im Band die Vertragsmiete */
             kappe: bandW && bandW.oben_qm > 0 ? bandW.oben_qm * wfl * 12 : Infinity,
             band: bandW, markt: marktW,   /* v2936 · fuer die Bandregel der Stufenmiete */
             vgl: vW || null, ziel_max: vW ? zielMaximum(vW, basis.bremse, w.bremse_ausnahme) : null };   /* v3343 */
  });
  const summeRoh = zeilen.reduce((a, z) => a + (z ? z.roh : 0), 0);
  if (!(summeRoh > 0) || !(rB > 0)) return null;
  /* Der Unterschied zwischen Haus und Wohnungen geht zuerst auf die leeren
     Wohnungen - hoechstens bis zur marktueblichen Miete, nie unter null -, erst
     der Rest anteilig auf alle.
     v2520: Seit der Bestand selbst leer = Vergleichsmiete rechnet (Ist-Miete nur
     auf der vermieteten Flaeche, CrossCheckService), ist dieser Unterschied klein:
     er stammt nur noch aus der Bandpruefung JE Wohnung gegen die des Hauses
     (Demo-MFH: WE 1 mit 6,18 €/m² unter der Kante 6,64, das Haus mit 7,31 im
     Band - 375 €/Jahr; die leere WE 5 traegt 9,04 statt 9,48 €/m²). Bis v2519
     waren es rund 5.000 €/Jahr, weil der Bestand die Ist-Miete durch die GESAMTE
     Wohnflaeche teilte (5,99 statt 7,31 €/m²). So bleibt die vermietete Wohnung bei ihrer
     geprueften Ist-Miete, und das Zielbild mit voller Vermietung zur Zielmiete
     ergibt genau die Summe der Zielmieten. */
  const verm = zeilen.filter((z) => z && z.herkunft !== 'leer_marktueblich');
  const leer = zeilen.filter((z) => z && z.herkunft === 'leer_marktueblich');
  const sV = verm.reduce((a, z) => a + z.roh, 0), sL = leer.reduce((a, z) => a + z.roh, 0);
  const pool = leer.length ? Math.max(0, Math.min(sL, rB - sV)) : 0;
  const fV = sV > 0 ? (rB - pool) / sV : 1;
  const fL = sL > 0 ? (sV > 0 ? pool : rB) / sL : 1;
  verm.forEach((z) => { z.basis = z.roh * fV; });
  leer.forEach((z) => { z.basis = z.roh * fL; z.basis_qm = r2(z.basis / 12 / z.wfl); });
  return { zeilen, faktor: fV, faktor_leer: leer.length ? fL : null, rohertrag: rB };
}
/** Wertermittlungs-Miete einer Wohnung in der Stufe s.
 *  v2988 · `ov` (optional): Band und marktuebliche Miete NACH den Massnahmen der Stufe
 *  (mieteNachModernisierung). Dann gilt die Bandregel gegen DIESES Band - auch fuer die
 *  Ist-Miete einer Wohnung ohne eigene Stufenmiete (der Mieter zahlt sie weiter, nach der
 *  Modernisierung ist sie womoeglich marktueblich) und fuer leere Wohnungen. */
/* v3343 · ZIELBILD: RECHTMAESSIG ERZIELBAR (ImmoWertA zu § 31: bei Neuvermietung die „rechtmaessig erzielbare"
   Miete). Das Band des Zielbilds reicht bis zum rechtlichen Maximum der Wohnung (lib/mietanker.js zielMaximum:
   Oberwert x 1,10 mit Mietpreisbremse, x 1,20 ohne), mindestens bis zur oberen Bandkante des Bestands. Eine
   Zielmiete darueber zaehlt nur bis zum Maximum - es ist selbst rechtmaessig erzielbar (kein Bandkanten-Ersatz,
   sondern die gesetzliche Obergrenze). Ohne Vergleichsmiete der Wohnung: wie bisher. */
function bandZielbild(band, z) {
  const zm = z && z.ziel_max;
  if (!band || !zm || !(zm.neu_max_qm > 0)) return null;
  return Object.assign({}, band, { oben_qm: Math.max(Number(band.oben_qm) || 0, zm.neu_max_qm), recht_max_qm: zm.neu_max_qm });
}
function zielRoh(z, mJahr, bandZ) {
  const q = r2(mJahr / 12 / z.wfl);
  if (q < bandZ.unten_qm) return null;
  return q > bandZ.oben_qm ? bandZ.oben_qm * z.wfl * 12 : mJahr;
}
function stufenMiete(z, w, s, ov) {
  if (!z) return null;
  if (s === 'bestand') return z.basis;
  if (s === 'zielbild' && z.ziel_max && z.wfl > 0) {
    const bandZ = bandZielbild(ov && ov.band ? ov.band : z.band, z);
    const m0 = zahl(w.miete_jahr && w.miete_jahr[s]);
    if (bandZ && m0 != null && m0 > 0) {
      const leer = z.herkunft === 'leer_marktueblich';
      const roh = zielRoh(z, m0, bandZ);
      if (roh != null) return z.basis + Math.max(0, roh - (leer ? z.basis : z.roh));
    }
  }
  if (ov && ov.band && ov.markt > 0 && z.wfl > 0) {
    const m0 = zahl(w.miete_jahr && w.miete_jahr[s]);
    const leer = z.herkunft === 'leer_marktueblich';
    const mEff = (m0 != null && m0 > z.ist) ? m0 : (z.ist > 0 ? z.ist : null);
    let roh;
    if (mEff != null && mEff > 0) {
      const r = mieteNachBand(r2(mEff / 12 / z.wfl), ov.band, ov.markt);
      roh = r.fuehrt ? mEff : ov.markt * z.wfl * 12;
    } else roh = ov.markt * z.wfl * 12;
    return z.basis + Math.max(0, roh - (leer ? z.basis : z.roh));
  }
  const m = zahl(w.miete_jahr && w.miete_jahr[s]);
  if (m == null || !(m > z.ist)) return z.basis;           /* keine Anhebung -> Basis */
  /* leer: max(Basis, Stufenmiete); vermietet: die Mehrmiete gegen die eigene gepruefte Miete */
  const bezug = z.herkunft === 'leer_marktueblich' ? z.basis : z.roh;
  /* v2936 · DIESELBE BANDREGEL WIE IM BESTAND (E1, v2600). Bis v2935 kappte die
     Stufe an der oberen Bandkante, der Bestand setzt ueber dem Band aber den
     Anker (die marktuebliche Miete) an. Gemessen Parkstr. 9: alle fuenf Wohnungen
     ueber dem Band (6,41-9,50 €/m², Band 3,71-5,57, Anker 4,64) - die Mieterhoehung
     hob jede auf die Kante 5,57 und ergab 186.000 statt 159.000 € Ertragswert,
     ohne dass eine marktuebliche Miete stieg. Jetzt: die Stufenmiete je m² laeuft
     durch mieteNachBand - im Band zaehlt sie, ausserhalb gilt der Anker. */
  let stufeRoh = Math.min(m, z.kappe);
  if (z.wfl > 0 && (z.band || z.markt)) {
    const r = mieteNachBand(r2(m / 12 / z.wfl), z.band, z.markt);
    stufeRoh = r.fuehrt ? m : (Number(r.qm) > 0 ? r.qm * z.wfl * 12 : stufeRoh);
  }
  return z.basis + Math.max(0, stufeRoh - bezug);
}

/* == v2988 · MIETE NACH MODERNISIERUNG (Marcel 27.10.2026, Parkstr. 9) ==================
   § 27 Abs. 1 / § 31 Abs. 2 ImmoWertV: Rohertrag = marktueblich erzielbare Ertraege fuer
   das Objekt in SEINEM Zustand. Das Zielbild unterstellt die Massnahmen als umgesetzt
   (ImmoWertA zu § 2 Abs. 5: Qualitaetsstichtag als „Beschreibung bestimmter Annahmen zum
   Grundstueckszustand") - marktueblich ist dann die Miete der modernisierten Wohnung.
   Woher sie kommt, in dieser Rangfolge:
     1  eigene Angabe (Feld zb_markt_qm, „Marktübliche Miete nach Modernisierung", nur Zielbild)
     2  die amtliche Quelle selbst, wo sie nach Modernisierung staffelt und Anker des
        Bestands ist: Mietpreisuebersicht Minden-Luebbecke (Abschnitt 9) mit der Klasse aus
        den Punkten NACH der Massnahme - dieselbe Tabelle, dieselben Faktoren (Lage, Groesse,
        Geschoss), nur die Klasse wechselt
     3  sonst nichts: die Quelle staffelt nicht (Ø Miete des Satzes, Angebotsmiete) - es
        bleibt beim Band des Bestands, und der Bericht sagt es (keine erfundene Zahl).
        Konservative Entscheidung, fuer Marcel markiert (entscheidung_offen).
   Band wie im Bestand: Anker ± MIETBAND.pct. Eine Stufe faellt nie unter den Bestand. */
const qm2 = (v) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/m²';
const pkt = (v) => (v == null ? '–' : String(Math.round(Number(v) * 10) / 10).replace('.', ','));
const bandT = (q) => qm2(q * (1 - MIETBAND.pct / 100)).replace(' €/m²', '') + '–' + qm2(q * (1 + MIETBAND.pct / 100));
function bandUm(band0, anker, etikett) {
  return Object.assign({}, band0 || {}, { anker_qm: anker, anker_etikett: etikett,
    unten_qm: Math.round(anker * (1 - MIETBAND.pct / 100) * 100) / 100,
    oben_qm: Math.round(anker * (1 + MIETBAND.pct / 100) * 100) / 100, band_pct: MIETBAND.pct });
}
function mieteNachModernisierung(wb, basis, s, plus, kosten, eigenQm) {
  const band0 = basis.miete_band || null;
  const anker0 = band0 && band0.anker_qm > 0 ? Number(band0.anker_qm) : zahl(basis.markt_qm);
  const hatMassnahme = (Number(plus) > 0) || (Number(kosten) > 0);
  const eigen = s === 'zielbild' && Number(eigenQm) > 0 ? Number(eigenQm) : null;
  const EIGEN_T = ' Eigenen Ansatz eintragen: Reiter Objekt, Karte „Mieterhöhung und Zielbild“, Feld „Marktübliche Miete nach Modernisierung“.';
  if (!(anker0 > 0)) return { ov: null, info: null };
  if (eigen != null) {
    const wirkt = eigen > anker0 + 0.005;
    return { ov: wirkt ? { band: bandUm(band0, eigen, 'marktübliche Miete nach Modernisierung (eigene Angabe)'), markt: eigen } : null,
      info: { weg: 'eigene_angabe', qm_vorher: anker0, qm_nachher: eigen, wirkt,
        satz: 'Marktübliche Miete nach Modernisierung: eigene Angabe ' + qm2(eigen)
          + (wirkt ? ' statt ' + qm2(anker0) + ' im Bestand (Band ± ' + MIETBAND.pct + ' %: ' + bandT(eigen) + ').'
            : ' — nicht über der marktüblichen Miete des Bestands (' + qm2(anker0) + '), ohne Wirkung.') } };
  }
  if (!hatMassnahme) return { ov: null, info: null };
  const E = wb && wb.amtliche_miete_eingabe;
  const amtlich = !!(band0 && band0.anker_stufe === 'amtlich');
  if (amtlich && E) {
    const pV = zahl(basis.ein.mod_punkte);
    const pN = Math.min(20, (pV != null ? pV : 0) + (Number(plus) > 0 ? Number(plus) : 0));
    const kV = E.modernisierung_klasse != null ? Number(E.modernisierung_klasse) : klasseAusPunkten(pV);
    const kN = klasseAusPunkten(pN);
    let r = null;
    try { r = (kN != null && (kV == null || kN > kV)) ? amtlicheMiete(Object.assign({}, E, { modernisierung_klasse: kN })) : null; } catch (e) { r = null; }
    const qmN = r && r.verfuegbar && Number(r.miete_qm) > 0 ? Number(r.miete_qm) : null;
    const wirkt = qmN != null && qmN > anker0 + 0.005;
    const kT = (k, p) => (k ? 'Klasse ' + k + ' (' + (KLASSE_TEXT[k] || '') + ', ' + pkt(p) + ' Punkte)' : 'ohne Klasse');
    let satz = 'Die Mietpreisübersicht des Gutachterausschusses staffelt nach Modernisierungsgrad. Die Maßnahmen heben ihn von '
      + kT(kV, pV) + ' auf ' + kT(kN, pN);
    if (wirkt) {
      satz += ' (fiktives Baujahr ' + r.fiktives_baujahr + '): marktübliche Miete ' + qm2(qmN) + ' statt ' + qm2(anker0)
        + ', Band ± ' + MIETBAND.pct + ' % ' + bandT(qmN) + '.';
    } else if (kN != null && kV != null && kN > kV) {
      satz += (r && r.verfuegbar ? ' (fiktives Baujahr ' + r.fiktives_baujahr + ')' : '')
        + ' — die Tabelle ergibt keine höhere Miete' + (r && r.verfuegbar && r.fiktives_baujahr <= 1950 ? ' (bis Baujahr 1949 gilt der Wert von 1950)' : '')
        + '. Mehrmiete über der marktüblichen Miete (' + qm2(anker0) + ' + ' + MIETBAND.pct + ' %) ist nicht angesetzt.' + EIGEN_T;
    } else {
      satz += ' — die Klasse ändert sich nicht, die marktübliche Miete bleibt ' + qm2(anker0)
        + '. Mehrmiete darüber (+ ' + MIETBAND.pct + ' %) ist nicht angesetzt.' + EIGEN_T;
    }
    return { ov: wirkt ? { band: bandUm(band0, qmN, 'amtliche Miete nach Modernisierung (Klasse ' + kN + ')'), markt: qmN } : null,
      info: { weg: 'amtlich_nach_modernisierung', klasse_vorher: kV, klasse_nachher: kN, punkte_vorher: pV, punkte_nachher: pN,
        qm_vorher: anker0, qm_nachher: qmN, fiktives_baujahr: r && r.verfuegbar ? r.fiktives_baujahr : null, wirkt, satz,
        quelle: r && r.quelle ? r.quelle : 'Mietpreisübersicht des Gutachterausschusses' } };
  }
  return { ov: null, info: { weg: 'nicht_gestaffelt', qm_vorher: anker0, qm_nachher: null, wirkt: false, entscheidung_offen: true,
    satz: 'Mehrmiete über der marktüblichen Miete nicht angesetzt — die verwendete Quelle (' + ((band0 && band0.anker_etikett) || 'Vergleichsmiete') + ' '
      + qm2(anker0) + ') staffelt nicht nach Modernisierung.' + EIGEN_T } };
}

function eineStufe(basis, ref, basisKern, miete, plus, kosten, bogMiete) {
  const ein = Object.assign({}, basis.ein);
  /* v2854 · SANIERUNGSSTAU UND MASSNAHMEN NICHT DOPPELT. Der Bestand traegt die
     Sanierungskosten des Objekts als boG (§ 8 Abs. 3, Mapper bomAus). Die Stufe
     fuehrt ihre Massnahmenkosten selbst und zieht sie im Wertzuwachs ab - blieb
     der boG in der Stufe stehen, zaehlte dieselbe Arbeit zweimal (Parkstr. 9:
     Stau 137.000 €, Zielbild-Massnahmen 136.000 €). Entscheidung 22.10.2026:
     in jeder Stufe gilt der Stau in Hoehe ihrer Kosten als behoben,
     boG = min(0, Stau + Kosten) - nur fuer einen boG aus den Sanierungskosten. */
  let stau = null;
  const _kst = Number(kosten) > 0 ? Number(kosten) : 0;
  if (ein.bog_quelle === 'sanierungskosten' && Number(ein.bog_eur) < 0) {
    const vor = Number(ein.bog_eur);
    const rest = Math.min(0, vor + _kst);
    const behoben = Math.round(rest - vor);
    const de0 = (x) => Math.round(Math.abs(x)).toLocaleString('de-DE');
    const text = _kst > 0
      ? 'Sanierungsstau durch die Maßnahmen dieser Stufe behoben: ' + de0(behoben) + ' €, Rest ' + de0(rest) + ' €'
      : 'Sanierungsstau unverändert (die Stufe hat keine Maßnahmenkosten): ' + de0(vor) + ' €';
    if (_kst > 0) {
      ein.bog_eur = rest === 0 ? null : Math.round(rest);
      ein.bog_grund = text + ' (Sanierungsstau laut Objekt ' + de0(vor) + ' €)';
    }
    stau = { stau_eur: Math.round(vor), kosten_eur: Math.round(_kst), behoben_eur: behoben, rest_eur: Math.round(rest), text };
  }
  const rndInfo = rndEinstellen(ein, ref, basisKern, plus);
  if (miete != null && miete >= 0) {
    bwkNachziehen(ein, miete);
    ein.miete_markt_jahr = Math.round(miete);
    ein.miete_aufteilung = null;   /* v2520 · die Aufteilung vermietet/leer gilt nur im Bestand */
    /* v2600 · E2 · die Stufe setzt die Miete selbst an - die Mietabweichung des Bestands (boG)
       gilt dort nicht mehr (sonst doppelt, Prompt-Regel 5). Der Leerstandsabzug bleibt. */
    if (Array.isArray(ein.bog_posten)) ein.bog_posten = ein.bog_posten.filter((x) => !/Mietabweichung/.test(String(x.pos || '')));
    ein.vorlaeufig_vor_bog = false;
    /* v3150 · Stufe Mieterhoehung: die Mindermiete bis zur Wirksamkeit der Erhoehungen als boG */
    if (bogMiete && Math.round(bogMiete.wert)) {
      ein.bog_posten = (Array.isArray(ein.bog_posten) ? ein.bog_posten : []).concat([{ pos: bogMiete.pos, wert: Math.round(bogMiete.wert), detail: bogMiete.detail || '' }]);
    }
  }
  let k = ErtragswertService.ertragswert(ein, basis.bodenwert);
  /* Untergrenze: die Stufe rechnet nie mit einer kürzeren RND als der Bestand. */
  const rB = basisKern && basisKern.nutzungsdauer ? basisKern.nutzungsdauer.rnd : null;
  if (k && k.nutzungsdauer && rB != null && k.nutzungsdauer.rnd < rB) {
    ein.rnd_jahre = rB; ein.mod_punkte = null;
    k = ErtragswertService.ertragswert(ein, basis.bodenwert);
  }
  const z = kernZusammenfassung(k);
  if (z) { z.mod_punkte = rndInfo.mod_punkte; z.mod_punkte_plus = rndInfo.plus; z.miete_wohnen_jahr = ein.miete_markt_jahr; z.sanierungsstau = stau; }
  /* v3283 · die Eingabe der Stufe fuer den Anteil je Wohnung (nicht in der Antwort: nicht aufzaehlbar) */
  if (z) Object.defineProperty(z, '_ein', { value: ein, enumerable: false });
  return z;
}

/* ══ v3283 · MINDERMIETE JE WOHNUNG ALS boG (ImmoWertA 31 c, Marcel 11.11.2026 „nimm das, was richtig ist") ══
   Gemessen Modul 26, Wohnung 1 (68 m², Ist 6,00 €/m², Band 6,16–9,24, Anker 7,70): als Eigentumswohnung
   Bestand 107.000 € > Mieterhoehung 106.000 €, Anteil am Haus 114.437 > 108.005 €. Das Haus rechnete richtig
   (Bestand 580.000 < Mieterhoehung 630.000, die Mindermiete je Wohnung als boG, v2993/v3150) - aber JE
   WOHNUNG fehlte sie im Bestand: die Eigentumswohnung rechnete mit 7,70 €/m² ohne Abzug, die Stufe
   Mieterhoehung mit Abzug. Und der Anteil am Haus verteilte den GANZEN Hauswert nach dem Anteil am
   Rohertrag - Bodenwert und den boG aller Wohnungen eingeschlossen; eine Wohnung, deren Miete in der
   Stufe weniger stieg als die der anderen, verlor Wert (die leere Wohnung 5: 114.426 -> 106.606 €).
   ImmoWertA 31 (Rohertrag) a) und c): vorlaeufiger Ertragswert mit der marktueblichen Miete, die Abweichung
   als besonderes objektspezifisches Grundstuecksmerkmal (§ 8 Abs. 3), Mieterhoehungsmoeglichkeiten
   beruecksichtigt (31 b: §§ 558 ff. BGB). Jetzt je Wohnung und Stufe:
     Bestand        die Mietabweichung dieser Wohnung aus dem Bestand (CrossCheckService mietabweichungBog:
                    Pfad nach § 558 bis zur marktueblichen Miete, oder belegte Laufzeit)
     Mieterhoehung  der Pfad dieser Wohnung bis zur Zielmiete der Stufe (stufe558); ohne eigenen Pfad
                    die Abweichung des Bestands
     Zielbild       keine (die Stufe unterstellt die Zielmiete, wie das Haus)
   Zins: als Eigentumswohnung der Liegenschaftszins fuer Wohnungseigentum (der Zins DIESES Verfahrens),
   im Anteil am Haus der des Hauses. Anteil am Haus = Ertragswert der Wohnung im Modell des Hauses
   (gleicher Zins, gleiche Bewirtschaftungskosten, Bodenwert nach Anteil) + ihr boG; was das Haus darueber
   hinaus traegt (Stellplaetze, Sanierungsstau, Rundung), nach dem Anteil am Rohertrag. */
const MM_POS = { underrent: 'besonderes objektspezifisches Grundstücksmerkmal: Mindermiete (ImmoWertA 31 c)',
                 overrent: 'besonderes objektspezifisches Grundstücksmerkmal: Mehrmiete (ImmoWertA 31 c)' };
/** Die Bestandszeile der Mietabweichung einer Wohnung - nur, wenn das Haus sie wirklich ansetzt. */
function bestandMietZeile(basis, nr, nW) {
  const mb = basis.miet_bog || null;
  const post = (Array.isArray(basis.ein.bog_posten) ? basis.ein.bog_posten : []).find((x) => /Mietabweichung/.test(String(x.pos || '')));
  if (!post || !mb || !Array.isArray(mb.zeilen)) return null;
  const zs = mb.zeilen.filter((x) => x && x.nutzung !== 'gewerbe');
  if (nr != null) { const f = zs.find((x) => x.nr != null && String(x.nr) === String(nr)); if (f) return f; }
  return nW === 1 && zs.length === 1 ? zs[0] : null;
}
const ymDe = (ym) => (ym ? ym.slice(5, 7) + '/' + ym.slice(0, 4) : null);
/** boG einer Wohnung in Stufe s mit dem Zins lzsPct (null = keiner).
 *  ctx: { basis, S558, kapp, st, lzsHaus, rndHaus, nW } */
function mietBogWohnung(ctx, z, w, s, lzsPct, rnd) {
  if (!z || !(z.ist > 0) || z.herkunft === 'leer_marktueblich' || s === 'zielbild' || !(Number(lzsPct) > 0)) return null;
  const gleich = Number(lzsPct) === Number(ctx.lzsHaus) && Number(rnd) === Number(ctx.rndHaus);
  const opt = { stichtag: ctx.st, letzte: w.letzte || null, letzteBetragMonat: zahl(w.letzte_betrag) || null, mvArt: w.mv_art || null, vorsichtig36: true };
  const aus = (pf, art, quelle, ziel) => (pf ? { wert: Math.round(pf.barwert_eur), art, jahre: pf.jahre, bis: pf.monate != null ? ymAb(ctx.st, pf.monate) : null,
    zins_pct: Number(lzsPct), quelle, ziel_monat: ziel != null ? Math.round(ziel / 12 * 100) / 100 : null,
    erste_anhebung: pf.erste_anhebung || (pf.schritte && pf.schritte.length ? ymAb(ctx.st, pf.schritte[0].ab_monat) : null), vorsichtig36: !!pf.vorsichtig36 } : null);
  if (s === 'mieterhoehung' && ctx.S558) {
    const zr = ctx.S558.zeilen.find((x) => x.schritte && x.nr != null && String(x.nr) === String(w.nr));
    if (zr) {
      const T = zr.ziel_monat * 12;
      const pf = gleich ? { barwert_eur: zr.mindermiete_barwert_eur, jahre: zr.jahre_bis_ziel, monate: null, erste_anhebung: zr.erste_anhebung, vorsichtig36: zr.vorsichtig36 }
        : erhoehungspfad558(z.ist, T, lzsPct, ctx.kapp.pct, rnd, opt);
      const r = aus(pf, 'underrent', 'Mieterhöhung nach § 558 BGB bis zur Zielmiete der Stufe', T);
      if (r && gleich && zr.schritte.length) r.bis = zr.schritte[zr.schritte.length - 1].ab;
      return r;
    }
  }
  /* Bestand (und Mieterhoehung ohne eigenen Pfad): die Abweichung, die das Haus fuer diese Wohnung ansetzt */
  const bz = bestandMietZeile(ctx.basis, w.nr, ctx.nW);
  if (!bz || !bz.angesetzt) return null;
  const d = Number(bz.differenz_jahr) || 0;
  if (bz.abgelaufen || !d) return null;
  if (bz.pfad558) {
    const ansatz = z.ist - d;
    const pf = gleich ? { barwert_eur: bz.barwert_eur, jahre: bz.jahre, monate: null, erste_anhebung: bz.pfad558.erste_anhebung, vorsichtig36: bz.pfad558.vorsichtig36 }
      : erhoehungspfad558(z.ist, ansatz, lzsPct, ctx.kapp.pct, rnd, opt);
    const r = aus(pf, 'underrent', 'Mieterhöhung nach § 558 BGB bis zur marktüblichen Miete', ansatz);
    if (r && gleich && Array.isArray(bz.pfad558.schritte) && bz.pfad558.schritte.length) r.bis = ymAb(ctx.st, bz.pfad558.schritte[bz.pfad558.schritte.length - 1].ab_monat);
    return r;
  }
  const n = Number(bz.jahre);
  if (!(n > 0)) return null;
  const wert = gleich ? Number(bz.barwert_eur) : barwertAbweichung(d, lzsPct, n);
  if (wert == null) return null;
  return { wert: Math.round(wert), art: bz.art, jahre: n, bis: ymAb(ctx.st, Math.round(n * 12)), zins_pct: Number(lzsPct),
    quelle: bz.jahre_quelle === 'befristung' ? 'Befristung' : (bz.jahre_quelle === 'kuendigungsverzicht' ? 'Kündigungsverzicht' : 'eingetragene Dauer der Abweichung'), ziel_monat: null };
}
/** Der Satz zum boG einer Wohnung (Rechenweg). */
function mietBogSatz(b) {
  if (!b) return null;
  const eu = (x) => (x < 0 ? '−' : '+') + Math.abs(Math.round(x)).toLocaleString('de-DE') + ' €';
  return (MM_POS[b.art] || MM_POS.underrent).replace(/^b/, 'B') + ' ' + eu(b.wert) + ': Barwert der Differenz zur angesetzten Miete'
    + (b.ziel_monat ? ' (' + b.ziel_monat.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/Monat)' : '')
    + ' über ' + String(b.jahre).replace('.', ',') + ' J.' + (b.bis ? ' bis ' + ymDe(b.bis) : '') + ' (' + b.quelle
    + (b.vorsichtig36 ? ', erste Anhebung als vorsichtige Annahme nach 36 Monaten' : (b.erste_anhebung ? ', erste Anhebung ' + ymDe(b.erste_anhebung) : ''))
    + '), abgezinst mit dem Liegenschaftszins ' + String(b.zins_pct).replace('.', ',') + ' %.';
}
/** Ertragswert einer Wohnung im Modell des Hauses (Stufeneingabe einS, ohne boG) - fuer den Anteil am Haus. */
function wohnungImHaus(einS, bwHaus, w, mw, anteil) {
  if (!einS || !(mw > 0) || !(Number(w.wfl) > 0)) return null;
  const ein = Object.assign({}, einS, { wohnflaeche_qm: Number(w.wfl), anzahl_we: 1, miete_markt_jahr: Math.round(mw), miete_ist_jahr: null,
    gewerbe_jahr: null, gewerbe_flaechen: null, gewerbe_ohne_nutzung_qm: null, gewerbe_ohne_nutzung_nr: null,
    stellplatz_anz: 0, stellplatz_miete_monat: null, garagen_anz: 0, aussen_anz: 0, zusatz_jahr: null, sonstige_jahr: null,
    miete_aufteilung: null, bog_posten: null, bog_eur: null, bog_grund: null, vorlaeufig_vor_bog: false,
    leerstand_pct: null, instandhaltung_ruecklage_jahr: null });
  if (String(einS.bwk_modus) === 'manuell' && Number(einS.bwk_gesamt_jahr) > 0) {
    const bez = Number(einS.bwk_bezugsgroesse_jahr) > 0 ? Number(einS.bwk_bezugsgroesse_jahr) : Number(einS.miete_markt_jahr);
    if (!(bez > 0)) return null;
    ein.bwk_gesamt_jahr = Math.round(Number(einS.bwk_gesamt_jahr) * mw / bez);
    ein.bwk_bezugsgroesse_jahr = Math.round(mw);
  }
  if (!bwHaus || !bwHaus.vollstaendig || bwHaus.wert == null) return null;
  const bwE = Object.assign({}, bwHaus, { wert: bwHaus.wert * anteil });
  if (bwHaus.wert_rentierlich != null) bwE.wert_rentierlich = bwHaus.wert_rentierlich * anteil;
  if (bwHaus.bodenwert_gesamt != null) bwE.bodenwert_gesamt = bwHaus.bodenwert_gesamt * anteil;
  let k = null;
  try { k = ErtragswertService.ertragswert(ein, bwE); } catch (e) { return null; }
  return k && k.vollstaendig ? Number(k.wert_ungerundet != null ? k.wert_ungerundet : k.wert) : null;
}

/* ══ v3150 · N114 · DIE STUFE „MIETERHÖHUNG" ALS WERT ZUM STICHTAG (Marcel 03.11.2026) ══════════
   Vorgaben zur sachverständigen Bewertung, Punkte 1-3:
   (1) Die Stufe bildet den Wert zum Wertermittlungsstichtag ab. Eine zulässige Mieterhöhung zählt
       erst ab ihrer Wirksamkeit, die Mehrerträge sind abgezinst - keine sofortige volle
       Kapitalisierung. Gebäudezustand und Restnutzungsdauer sind die des BESTANDS: eine erst
       durch geplante Modernisierung erreichbare längere RND, die Modernisierungsumlage
       (§ 559 BGB) und die Maßnahmenkosten gehören ins Zielbild (sonst doppelt).
   (2) Die Stufe endet an der ortsüblichen Vergleichsmiete (§ 558 BGB) unter Kappung und Fristen.
       Eine höhere Neuvermietungsmiete ist NICHT Teil dieser Stufe. Ist im Objekt statt einer
       Vergleichsmiete nur die Marktmiete (Neuvermietung) eingetragen, gilt die marktübliche
       Miete der Wertermittlung (Anker des Bandes) - mit dem Satz, warum.
   (3) Ohne Erhöhungshistorie: erste Anhebung als vorsichtige Annahme erst nach 36 Monaten,
       mit Sensitivität (lib/kappung.js, opts.vorsichtig36).
   Rechenweg wie im Bestand (ImmoWertA 31.(2) b) und c), EW-RL Anl. 3 Bsp. 1): Rohertrag mit der
   Zielmiete der Stufe, die Mindermiete bis dahin als Barwert (boG, Liegenschaftszins des
   Bestands, Restnutzungsdauer des Bestands als Deckel). Je Wohnung ersetzt die Stufe nur die
   Bestands-Zeile der Mietabweichung, die sie neu rechnet; Überhöhungen und Gewerbe bleiben. */
const ymAb = (st, off) => { const t = st.getUTCFullYear() * 12 + st.getUTCMonth() + off; return String(Math.floor(t / 12)) + '-' + String((t % 12) + 1).padStart(2, '0'); };
function stufe558(basis, ref, bb, wlB, kB) {
  if (!bb) return null;
  const lzs = kB && kB.lzs && Number(kB.lzs.pct) > 0 ? Number(kB.lzs.pct) : Number(basis.ein.lzs_pct);
  const rnd = kB && kB.nutzungsdauer ? Number(kB.nutzungsdauer.rnd) : null;
  const st = basis.stichtag ? new Date(basis.stichtag + 'T00:00:00Z') : new Date();
  const kapp = basis.kappung || kappungFuer(ref.ags, ref.kappung_pct, st);
  const mb = basis.miet_bog || null;
  const bestPost = (Array.isArray(basis.ein.bog_posten) ? basis.ein.bog_posten : []).find((x) => /Mietabweichung/.test(String(x.pos || '')));
  const bestWert = bestPost ? Number(bestPost.wert) || 0 : 0;
  const bestZeilen = bestPost && mb && Array.isArray(mb.zeilen) ? mb.zeilen.filter((x) => x && x.nutzung !== 'gewerbe') : [];
  const zeileVon = (nr, n) => {
    if (!bestZeilen.length) return null;
    if (nr != null) { const f = bestZeilen.find((x) => x.nr != null && String(x.nr) === String(nr)); if (f) return f; }
    return n === 1 && bestZeilen.length === 1 ? bestZeilen[0] : null;
  };
  const nW = wlB.filter((w) => w && w.art !== 'gewerbe').length;
  const mieten = [], zeilen = [];
  let alt = 0, neu = 0;
  const eurJ = (x) => Math.round(x).toLocaleString('de-DE') + ' €';
  bb.zeilen.forEach((z, i) => {
    const w = wlB[i] || {};
    mieten[i] = z ? z.basis : null;
    if (!z || z.herkunft === 'leer_marktueblich' || !(z.ist > 0) || !(z.wfl > 0)) return;
    const nr = w.nr || null;
    const r = { nr, ist_monat: Math.round(z.ist / 12 * 100) / 100, ist_qm: z.ist_qm, ziel_monat: null, ziel_qm: null, ziel_herkunft: null };
    const aus = ausschluss558(w.mv_art);
    if (aus) { r.grund = aus; zeilen.push(r); return; }
    /* Zielmiete der Stufe: ortsuebliche Vergleichsmiete, sonst eigene Soll-Miete; nur Marktmiete -> Anker */
    let zielJ = null;
    const vglJ = zahl(w.vgl_jahr), sollJ = zahl(w.soll558_jahr);
    if (vglJ > 0 && !w.vgl_marktmiete) { zielJ = vglJ; r.ziel_herkunft = 'ortsübliche Vergleichsmiete (' + (w.vgl_herkunft || 'Objekt') + ')'; }
    else if (vglJ > 0 && w.vgl_marktmiete && z.markt > 0) {
      zielJ = z.markt * z.wfl * 12;
      r.ziel_herkunft = 'marktübliche Miete der Wertermittlung (' + pctQm(z.markt) + '); im Objekt ist nur die Marktmiete bei Neuvermietung (' + pctQm(vglJ / 12 / z.wfl) + ') eingetragen, sie kann über der ortsüblichen Vergleichsmiete liegen und zählt hier nicht';
    } else if (sollJ > z.ist) { zielJ = sollJ; r.ziel_herkunft = 'eigene Angabe Soll-Miete'; }
    if (!(zielJ > 0)) { r.grund = 'keine Vergleichsmiete eingetragen'; zeilen.push(r); return; }
    /* Bandregel wie im Bestand (v2936): im Band zaehlt die Zielmiete, ausserhalb der Anker */
    const nb = mieteNachBand(r2(zielJ / 12 / z.wfl), z.band, z.markt);
    let T = nb.fuehrt ? zielJ : (Number(nb.qm) > 0 ? nb.qm * z.wfl * 12 : zielJ);
    if (!nb.fuehrt && Number(nb.qm) > 0) r.ziel_herkunft += '; außerhalb des Bandes der Marktüblichkeit, angesetzt der Anker ' + pctQm(nb.qm);
    T = Math.max(T, z.roh);
    r.ziel_monat = Math.round(T / 12 * 100) / 100; r.ziel_qm = r2(T / 12 / z.wfl);
    if (!(T > z.ist + 0.5)) { r.grund = 'die Miete liegt schon an der Zielmiete'; zeilen.push(r); return; }
    const pf = erhoehungspfad558(z.ist, T, lzs, kapp.pct, rnd, { stichtag: st, letzte: w.letzte || null,
      letzteBetragMonat: zahl(w.letzte_betrag) || null, mvArt: w.mv_art || null, vorsichtig36: true });
    if (!pf) { r.grund = 'kein Erhöhungspfad rechenbar'; zeilen.push(r); return; }
    const bz = zeileVon(nr, nW);
    const altW = bz && bz.angesetzt && Number.isFinite(Number(bz.barwert_eur)) ? Number(bz.barwert_eur) : 0;
    alt += altW; neu += pf.barwert_eur;
    mieten[i] = z.basis + (T - z.roh);
    Object.assign(r, { schritte: pf.schritte.map((x) => ({ ab: ymAb(st, x.ab_monat), miete_monat: x.miete_monat })),
      erste_anhebung: pf.erste_anhebung || (pf.schritte.length ? ymAb(st, pf.schritte[0].ab_monat) : null),
      jahre_bis_ziel: pf.jahre, mindermiete_barwert_eur: pf.barwert_eur, bestand_barwert_eur: altW || null,
      mehrertrag_jahr: Math.round(T - z.roh), annahmen: pf.annahmen, vorsichtig36: !!pf.vorsichtig36,
      sensitiv: pf.sensitiv || null, wartefrist_geprueft: !!pf.wartefrist_geprueft, kappung_basis_unbekannt: !!pf.kappung_basis_unbekannt });
    zeilen.push(r);
  });
  const mit = zeilen.filter((x) => x.schritte);
  const sens = mit.reduce((a, x) => a + ((x.sensitiv && x.sensitiv.unterschied_eur) || 0), 0);
  const bogWert = bestWert - alt + neu;
  const detail = mit.map((x) => (x.nr ? x.nr + ': ' : '') + eurJ(x.ist_monat) + ' → ' + eurJ(x.ziel_monat) + '/Monat, erste Anhebung '
    + (x.erste_anhebung ? x.erste_anhebung.slice(5, 7) + '/' + x.erste_anhebung.slice(0, 4) : '–') + (x.vorsichtig36 ? ' (vorsichtige Annahme 36 Monate)' : '')
    + ', ' + String(x.jahre_bis_ziel).replace('.', ',') + ' J. bis zur Zielmiete, Barwert ' + eurJ(x.mindermiete_barwert_eur)).join('; ');
  const datum = st.toISOString().slice(0, 10).split('-').reverse().join('.');
  return {
    mieten, zeilen, lzs_pct: lzs, rnd_jahre: rnd, kappung_pct: kapp.pct, kappung_text: kapp.text, stichtag: st.toISOString().slice(0, 10),
    bog: { pos: 'besonderes objektspezifisches Merkmal: Mietabweichung bis zur Wirksamkeit der Mieterhöhungen (§ 558 BGB)', wert: bogWert,
      detail: 'Mindermiete bis zur Zielmiete, monatlich abgezinst mit dem Liegenschaftszins ' + String(lzs).replace('.', ',') + ' %: ' + detail
        + (bestWert && Math.round(bestWert - alt) ? '; übrige Abweichungen wie im Bestand ' + eurJ(bestWert - alt) : '') },
    n_wohnungen: mit.length, sensitiv_eur: sens || null,
    satz: 'Mieterhöhung zum Stichtag ' + datum + ': '
      + (mit.length ? mit.length + ' Wohnung' + (mit.length === 1 ? '' : 'en') + ' bis zur ortsüblichen Vergleichsmiete nach § 558 BGB (' + kapp.text + '), jede Erhöhung erst ab ihrer Wirksamkeit, '
        + 'die Mindermiete bis dahin abgezinst (Barwert zusammen ' + eurJ(neu) + '). Restnutzungsdauer ' + (rnd != null ? String(rnd).replace('.', ',') + ' J.' : '–')
        + ' wie im Bestand; geplante Modernisierungen, ihre Umlage nach § 559 BGB und eine längere Restnutzungsdauer zählen erst im Zielbild. Eine höhere Neuvermietungsmiete ist nicht Teil dieser Stufe.'
        + (mit.some((x) => x.vorsichtig36) ? ' Wo die bisherigen Erhöhungen nicht eingetragen sind, gilt als vorsichtige Bewertungsannahme die erste Anhebung erst nach 36 Monaten (keine gesetzliche Frist); '
          + 'wäre die Wartefrist schon erfüllt, läge der Wert um rund ' + eurJ(sens) + ' höher.' : '')
        : 'keine Wohnung mit zulässiger Erhöhung.'),
  };
}

/* ══ v3152 · N117 · STUFE 3 „NEUVERMIETUNG" (Marcel 03.11.2026) ═══════════════════════════════════
   Vorgabe Punkt 2: das Potenzial über der ortsüblichen Vergleichsmiete ist eine EIGENE Stufe -
   realistisch erwartbare Mieterwechsel, Verzögerung, Leerstand, Neuvermietungskosten, Abzinsung; nie
   „alle Wohnungen frei". Sie baut auf der Stufe Mieterhöhung auf (nicht addiert aus unabhängigen Werten).
   Je vermietete Wohnung: Mehrmiete U = Neuvermietungsmiete (heutiger Zustand, Mietpreisbremse, aus der
   App) − Zielmiete der Stufe Mieterhöhung. Erwarteter Anteil neu vermietet nach t Jahren: 1 − (1 − f)^t.
   Barwert = Σ Monate U/12 × Anteil × (1 − Leerstand) abgezinst mit dem Liegenschaftszins, minus Kosten
   je erstem Wechsel (eine Monatsmiete der neuen Miete) mit seiner Wahrscheinlichkeit, gedeckelt auf die
   Restnutzungsdauer des Bestands.
   Leerstand: Feld „Leerstand p.a." (Marcel: „das könnte man nehmen"); Fluktuation 8 % p. a. und Kosten
   eine Monatsmiete sind Annahmen (Vorschlag 03.11.2026), im Ergebnis so benannt. */
const NV_FLUKTUATION = 0.08, NV_KOSTEN_MONATE = 1;
function stufeNeuvermietung(S558, bb, wlB, kB, leerPct, basisWert) {
  if (!S558 || !bb) return null;
  const lzs = S558.lzs_pct / 100, rnd = Number(S558.rnd_jahre) > 0 ? Number(S558.rnd_jahre) : 40;
  const L = Number.isFinite(Number(leerPct)) && Number(leerPct) >= 0 && Number(leerPct) < 50 ? Number(leerPct) / 100 : null;
  const f = NV_FLUKTUATION, mon = Math.round(rnd * 12), q = Math.pow(1 - f, 1 / 12);
  const eurJ = (x) => Math.round(x).toLocaleString('de-DE') + ' €';
  const zeilen = [];
  let summe = 0, kosten = 0;
  bb.zeilen.forEach((z, i) => {
    const w = wlB[i] || {};
    if (!z || z.herkunft === 'leer_marktueblich' || !(z.ist > 0)) return;
    const N = zahl(w.neu_jahr);
    if (!(N > 0)) return;
    const r558 = S558.zeilen.find((x) => (x.nr != null && String(x.nr) === String(w.nr || '')) ) || null;
    const T = r558 && r558.ziel_monat > 0 ? Math.max(z.ist, r558.ziel_monat * 12) : z.ist;
    const U = N - T;
    const r = { nr: w.nr || null, ziel_mieterhoehung_monat: Math.round(T / 12 * 100) / 100, neu_monat: Math.round(N / 12 * 100) / 100,
      neu_qm: zahl(w.neu_qm), neu_herkunft: w.neu_herkunft || null, bremse: w.neu_bremse || null, gedeckelt: !!w.neu_gedeckelt };
    if (!(U > 1)) { r.grund = 'die Neuvermietungsmiete liegt nicht über der Zielmiete der Stufe Mieterhöhung'; zeilen.push(r); return; }
    let bw = 0, kw = 0;
    for (let m = 0; m < mon; m++) {
      const anteil = 1 - Math.pow(q, m + 1);                 /* erwarteter Anteil neu vermietet bis Monatsende */
      const ab = Math.pow(1 + lzs, (m + 1) / 12);
      bw += (U / 12) * anteil * (1 - (L || 0)) / ab;
      const p1 = Math.pow(q, m) - Math.pow(q, m + 1);         /* erster Wechsel in diesem Monat */
      kw += p1 * (N / 12) * NV_KOSTEN_MONATE / ab;
    }
    r.mehrmiete_jahr = Math.round(U); r.barwert_eur = Math.round(bw - kw); r.kosten_barwert_eur = Math.round(kw);
    summe += bw - kw; kosten += kw;
    zeilen.push(r);
  });
  const mit = zeilen.filter((x) => x.barwert_eur != null);
  if (!mit.length) return { verfuegbar: false, zeilen, satz: zeilen.length ? 'Neuvermietung: keine Wohnung, deren Neuvermietungsmiete über der Zielmiete der Mieterhöhung liegt.' : null };
  const ann = 'Annahmen: ' + Math.round(f * 100) + ' % der Mieter wechseln je Jahr (im Schnitt ' + String(Math.round(10 / f) / 10).replace('.', ',') + ' Jahre Mietdauer), '
    + (L != null ? 'Leerstand ' + String(Math.round(L * 1000) / 10).replace('.', ',') + ' % laut Feld „Leerstand p.a.“' : 'kein Leerstand eingetragen (Feld „Leerstand p.a.“)')
    + ', Kosten je Wechsel ' + NV_KOSTEN_MONATE + ' Monatsmiete — keine amtlichen Werte, sondern Annahmen.';
  const wert = basisWert != null ? Math.round(basisWert + summe) : null;
  const wertR = wert != null ? Math.round(wert / 1000) * 1000 : null;   /* der Satz nennt die gerundete Zahl wie die Kachel */
  return {
    verfuegbar: true, wert, barwert_eur: Math.round(summe), kosten_barwert_eur: Math.round(kosten), zeilen, annahmen: ann,
    fluktuation_pct: f * 100, leerstand_pct: L != null ? L * 100 : null, kosten_monate: NV_KOSTEN_MONATE,
    satz: 'Bei Mieterwechsel ist mehr möglich als die Vergleichsmiete: ' + mit.length + ' Wohnung' + (mit.length === 1 ? '' : 'en') + ' bis zur Neuvermietungsmiete ('
      + (mit[0].neu_herkunft || 'Marktmiete') + (mit.some((x) => x.gedeckelt) ? ', bei ' + mit.filter((x) => x.gedeckelt).length + ' Wohnung(en) gedeckelt durch die Mietpreisbremse' : '') + '), '
      + 'jeweils erst, wenn die Wohnung frei wird. Barwert der Mehrmiete ' + eurJ(summe) + ' nach Leerstand und Kosten, zusätzlich zur Stufe Mieterhöhung'
      + (wertR != null ? ' (zusammen rund ' + eurJ(wertR) + ')' : '') + '. ' + ann + ' Nicht unterstellt: dass Wohnungen heute frei sind.',
  };
}

/** Zins für Wohnungseigentum aus derselben Kaskade (A–E, N) wie der Bericht. */
/* ══ v3200 · DER VERGLEICHSWERT EINER WOHNUNG (Aufteilerwert) ════════════════
   Marcel 07.11.2026: „einzelne Wohnungen sind mehr wert" - eine aufgeteilte Wohnung wird
   über den Vergleichswert gehandelt, nicht als Anteil am Ertragswert des Hauses. Führend
   ist der amtliche Vergleichsfaktor (§ 20 ImmoWertV, aus Kaufpreisen), mit den Merkmalen
   DER WOHNUNG: Fläche, Zimmer, Geschosslage, Einbauküche, vermietet. Dieselbe Eingabe wie
   der Bericht einer Eigentumswohnung (lib/vergleichsfaktor_eingabe.js) - keine zweite Liste. */
function wohnungMerkmale(w, auftrag) {
  const lage = String((w && w.lage) || '');
  const gl = /\b(EG|Erdgeschoss|Hochparterre|Parterre)\b/i.test(lage) ? 'erdgeschoss'
    : (/\b(DG|Dachgeschoss|Staffelgeschoss|Spitzboden)/i.test(lage) ? 'dachgeschoss'
      : (/(\d+\.?\s*OG|Obergeschoss|\bOG\b)/i.test(lage) ? 'obergeschoss' : null));
  const k = String((w && w.kueche) || '');
  const az = String((auftrag && auftrag.aufzug) || '').toLowerCase();
  return {
    geschosslage: gl,
    einbaukueche: /^ebk/.test(k) ? 'ja' : (k === 'keine' ? 'nein' : null),
    vermietet: w && w.leer === true ? 'nein' : (w && w.leer === false ? 'ja' : null),
    aufzug: /^(ja|true)$/.test(az) ? 'ja' : (/^(nein|false)$/.test(az) ? 'nein' : null),
  };
}
function vergleichWohnung(ref, wb, w, rnd, auftrag, mieteJahr, irwEtw) {
  const wfl = Number(w && w.wfl);
  if (!(wfl > 0)) return null;
  /* v3200c · die Rohdaten (Gemeinde, Ortsteil, Lageklasse) stehen nur in land_value_roh */
  const lv = (wb && (wb.land_value_roh || wb.land_value)) || null;
  const brw = lv && lv.available && Number(lv.value_sqm) > 0 ? Number(lv.value_sqm) : null;
  const ags = String(ref.ags || '').replace(/\D/g, '');
  const refW = Object.assign({}, ref, { property_type: 'etw', living_area: wfl,
    rooms: Number(w.zimmer) > 0 ? Number(w.zimmer) : null, units: null,
    mea_pct: Number(w.mea_pct) > 0 ? Number(w.mea_pct) : null, garages: null, outdoor_parking: null, vermietungsstand: null });
  const mk = wohnungMerkmale(w, auftrag);
  let gesperrt = null;
  if (ags && brw != null) {
    try {
      const r = regVergleichsfaktor(regVfEingabe({ ref: refW, landValue: lv, ags, brw, rnd, bgf: null, extra: mk }));
      const v = regVfErgebnis(r, { ref: refW, bgf: null, hhNorm: null });
      if (v && v.verfuegbar && Number(v.wert_eur) > 0) {
        return { wert: Math.round(v.wert_eur), faktor_qm: v.faktor_qm, herkunft: 'amtlich', ausschuss: v.ausschuss || null,
          stufe: v.stufe || null, quellenvermerk: v.quellenvermerk || null, lizenz: v.lizenz || null, merkmale: mk };
      }
      /* v3200b · vermietete Wohnung: gibt der Satz eine Umrechnung vermietet/unvermietet (Hamburg IMB 7.6.3,
         0,6578 + 0,0513 × Rendite), wird der Wert der FREIEN Wohnung damit umgerechnet. Rendite = marktübliche
         Jahresnettokaltmiete × 100 / Wert unvermietet; Faktor höchstens 1. Nur wenn sonst nichts offen ist. */
      const offenFelder = v && v.korrekturen_offen ? v.korrekturen_offen.map((x) => x.feld) : [];
      const korrV = r && r._satz && Array.isArray(r._satz.korrekturen) ? r._satz.korrekturen.find((k) => k && k.feld === 'vermietet' && k.umrechnung) : null;
      if (v && v.verfuegbar === false && mk.vermietet === 'ja' && korrV && offenFelder.length === 1 && offenFelder[0] === 'vermietet' && Number(mieteJahr) > 0) {
        const rF = regVergleichsfaktor(regVfEingabe({ ref: refW, landValue: lv, ags, brw, rnd, bgf: null, extra: Object.assign({}, mk, { vermietet: 'nein' }) }));
        const vF = regVfErgebnis(rF, { ref: refW, bgf: null, hhNorm: null });
        const u = korrV.umrechnung;
        if (vF && vF.verfuegbar && Number(vF.wert_eur) > 0 && u.art === 'rendite_linear') {
          const rendite = Number(mieteJahr) * 100 / Number(vF.wert_eur);
          const fak = Math.min(Number(u.obergrenze) || 1, Number(u.a) + Number(u.b) * rendite);
          return { wert: Math.round(vF.wert_eur * fak), wert_frei: Math.round(vF.wert_eur), faktor_qm: vF.faktor_qm, herkunft: 'amtlich',
            vermietet_umrechnung: { faktor: Math.round(fak * 10000) / 10000, rendite_pct: Math.round(rendite * 100) / 100, fundstelle: u.fundstelle || null },
            ausschuss: vF.ausschuss || null, stufe: vF.stufe || null, quellenvermerk: vF.quellenvermerk || null, lizenz: vF.lizenz || null, merkmale: mk };
        }
      }
      if (v && v.verfuegbar === false) gesperrt = { grund: v.grund || null, hinweis: v.hinweis || null,
        offen: v.korrekturen_offen ? v.korrekturen_offen.map((x) => x.bez || x.feld).filter(Boolean) : null, ausschuss: v.ausschuss || null };
    } catch (e) { /* kein Wert - der Rückfall entscheidet */ }
  }
  try {
    const bp = (lv && lv.properties_raw) || {};
    const gem = bp.Gemeinde || bp.GENA || ref.gemeinde || null;
    if (gem && Number(ref.build_year) > 0) {
      const a = amtlicherVf({ ags: ref.ags || null, objektart: 'etw', gemeinde: gem, baujahr: ref.build_year,
        wohnflaeche_qm: wfl, wohneinheiten: null, grundstuecksflaeche_qm: null, erstverkauf: false });
      if (a && a.verfuegbar && a.fuehrend !== false && Number(a.wert_eur) > 0) {
        return { wert: Math.round(a.wert_eur), faktor_qm: a.faktor_qm, herkunft: 'amtlich', ausschuss: a.ausschuss || null, stufe: 'A', merkmale: mk };
      }
    }
  } catch (e) { /* ebenso */ }
  /* v3200c · NRW: Immobilienrichtwert für Wohnungseigentum (§ 24 ImmoWertV, beurkundete Kaufpreise), umgerechnet
     auf DIESE Wohnung mit den Umrechnungskoeffizienten des Ausschusses - derselbe Kern wie im Bericht. */
  if (irwEtw && irwEtw.verfuegbar && irwEtw.roh && typeof irwEtw.roh === 'object') {
    try {
      const vi = vergleichswertIrw({ irw: irwEtw, objekt: objektAusRef(refW, { bodenrichtwert: brw }), bog: [] });
      if (vi && vi.verfuegbar && Number(vi.vergleichswert_eur) > 0) {
        return { wert: Math.round(vi.vergleichswert_eur), faktor_qm: vi.wert_qm || null, herkunft: 'amtlich', quelle: 'Immobilienrichtwert',
          ausschuss: vi.quelle ? vi.quelle.ausschuss : null, stufe: vi.stufe || 'A', merkmale: mk };
      }
      if (!gesperrt && vi && vi.verfuegbar === false) gesperrt = { grund: vi.grund || 'irw', hinweis: vi.hinweis || null,
        offen: (vi.gruende || []).filter((g) => g.grund === 'merkmal_fehlt').map((g) => g.name || g.id), ausschuss: null };
    } catch (e) { /* kein Wert */ }
  }
  return gesperrt ? Object.assign({ wert: null }, gesperrt) : null;
}

async function etwZins(ref, brwSqm, rnd) {
  try {
    return await WertParameterService.liegenschaftszins({
      ags: ref.ags || null, objektart: 'wohnung', anzahlWe: ref.units || null, brwSqm,
      nutzerwert: null,
      objekt: { objart: 'ETW', nutzung: ref.nutzung || ref.usage_type || 'vermietet', haustyp: null,
                baujahr: ref.build_year || null, restnutzungsdauer: rnd, einheiten: ref.units || null,
                lage: ref.lage || null, stadtteil: ref.stadtteil || ref.ortsteil || null } });
  } catch (e) { return null; }
}
async function etwBwk(ref, lzs) {
  if (lzs && lzs.aus_register && lzs.modell_bwk_quote && !lzs.ausserhalb_geltung && Number(lzs.modell_bwk_quote.pct) > 0) {
    return { pct: Number(lzs.modell_bwk_quote.pct), quelle: (lzs.ausschuss || lzs.quelle || 'Gutachterausschuss') + ' — Modellansatz desselben Satzes' };
  }
  try {
    const b = await WertParameterService.hole({ typ: 'bwk_pct', ags: ref.ags || null, objektart: 'wohnung', anzahlWe: ref.units || null });
    const fremd = b && b.herkunft === 'opendata' && !(lzs && lzs.herkunft === 'opendata' && lzs.quelle === b.quelle);
    if (b && b.wert > 0 && !(lzs && lzs.ausserhalb_geltung) && !fremd) return { pct: Number(b.wert), quelle: b.quelle || null };
  } catch (e) { /* Anlage 3 */ }
  return null;
}

function etwEingabe(basis, ref, w, miete, lzs, bwk, rnd, anteil) {
  const b = basis.ein;
  const ein = {
    objektart: 'wohnung', baujahr: b.baujahr, baustatus: b.baustatus,
    wohnflaeche_qm: w.wfl, anzahl_we: 1, stichtag_jahr: b.stichtag_jahr,
    miete_markt_jahr: Math.round(miete), gewerbe_jahr: null,
    stellplatz_anz: 0, zusatz_jahr: null, sonstige_jahr: null,
    modellversion: lzs.modellversion || null,
    rnd_jahre: rnd, gnd_jahre: (lzs.aus_register && Number(lzs.modell_gnd_jahre) > 0 && !lzs.ausserhalb_geltung)
      ? Number(lzs.modell_gnd_jahre) : b.gnd_jahre || null,
    lzs_pct: Number(lzs.wert), lzs_quelle: lzs.quelle || null, lzs_stufe: lzs.stufe || null,
    lzs_herkunft: lzs.zins_herkunft ? { ebene: lzs.zins_herkunft.ebene, etikett: lzs.zins_herkunft.etikett } : null,
  };
  if (bwk) {
    ein.bwk_modus = 'manuell';
    ein.bwk_gesamt_jahr = Math.round(miete * bwk.pct / 100);
    ein.bwk_bezugsgroesse_jahr = Math.round(miete);
    ein.bwk_quote_pct = bwk.pct; ein.bwk_quote_herkunft = bwk.quelle;
  } else {
    ein.bwk_modus = 'normiert';
  }
  const bw = basis.bodenwert;
  let bwE = null;
  if (bw && bw.vollstaendig && bw.wert != null) {
    bwE = Object.assign({}, bw, { wert: Math.round(bw.wert * anteil) });
    if (bw.wert_rentierlich != null) bwE.wert_rentierlich = Math.round(bw.wert_rentierlich * anteil);
    if (bw.bodenwert_gesamt != null) bwE.bodenwert_gesamt = Math.round(bw.bodenwert_gesamt * anteil);
  }
  return { ein, bw: bwE };
}

/* v2431 · Warum die Aufteilung hier nichts bringt - in Marcels Worten, aus den
   Zahlen DIESER Rechnung. Ein Satz, der nur sagt was stimmt: der Zinsvergleich nur,
   wenn der ETW-Zins wirklich hoeher liegt; liegt die Summe ueber dem Haus und
   frisst erst die Aufteilung den Abstand, sagt er genau das. */
const pctDe = (v) => (v == null ? '–' : String(Math.round(Number(v) * 100) / 100).replace('.', ',') + ' %');
const pctQm = (v) => (v == null ? '–' : String(Math.round(Number(v) * 100) / 100).replace('.', ',') + ' €/m²');
const eurDe = (v) => Math.round(Number(v) || 0).toLocaleString('de-DE') + ' €';
function negativHinweis(a, out, neg) {
  const s = neg.indexOf('bestand') >= 0 ? 'bestand' : neg[0];
  const zE = a.zins[s] && a.zins[s].pct != null ? Number(a.zins[s].pct) : null;
  const zH = out.basis && out.basis.lzs_pct != null ? Number(out.basis.lzs_pct) : null;
  const j = a.je_stufe[s];
  const gruende = [];
  if (zE != null && zH != null && zE > zH) gruende.push('Wohnungseigentums-Zins ' + pctDe(zE) + ' gegen ' + pctDe(zH) + ' für das Mehrfamilienhaus');
  gruende.push('höhere Verwaltungskosten je Einheit');
  if (j && !j.unter_haus) {
    return 'Nach den amtlichen Zinssätzen liegt die Summe der Einzelwohnungen hier nur knapp über dem Wert des Hauses ('
      + gruende.join(', dazu ') + '); nach den Kosten der Aufteilung von ' + eurDe(a.kosten_eur) + ' bleibt kein Potenzial.';
  }
  return 'Nach den amtlichen Zinssätzen liegt die Summe der Einzelwohnungen hier unter dem Wert des Hauses: '
    + gruende.join(', dazu ') + '.';
}

/* ══ v2595 · ERTRAGSWERT UND MARKTPREISINDIKATION IM BESTAND, NEBENEINANDER ══════
   Gutachterpruefung 21.10.2026 (Prompt „Vergleich der Werte", „Ursachenanalyse"):
   zwei gleichrangige Werte, je €/m² auf DIESELBE Bezugsflaeche (Wohnflaeche des
   Objekts), die Differenz mit Vorzeichen in € und in % des Ertragswerts (dieselbe
   Rechnung wie comparison.differenz_zum_ertragswert), die Stufe des Zinses und die
   Herkunft der Miete, das Ergebnis der Modellpruefung und die Ursachen - jede mit
   ihrem Status:
     nachgewiesen    gemessen, mit Zahl (Miete gegen Ø Miete des Satzes, Abschlag)
     plausibel       eine Erklaerung, die passt, aber nicht belegt ist
     nicht_pruefbar  was wir nicht sehen koennen (Angebotsauswahl des Datenanbieters)
   Ein „nachgewiesen" belegt die TATSACHE, nicht ihren Anteil an der Differenz - der
   ist ohne die Methodik der Marktpreisindikation nicht bezifferbar (Prompt: keine
   scheinpraezise Ursachenzerlegung). Bis v2594 stand hier ein pauschaler Satz
   („sie kennt die Miete nicht …"), der fuer jedes Objekt dasselbe sagte. */
const qmDe = (v) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/m²';
function vergleichBestand(wb, out, bestand) {
  const ref = (wb && wb.ref) || {}, cc = (wb && wb.cross_check) || {}, e = cc.ertragswert || {};
  const ew = bestand && bestand.wert != null ? bestand.wert : null;
  const mpi = out.haus && out.haus.bestand ? out.haus.bestand.mpi_angebote : null;
  const fl = zahl(ref.living_area);
  const proQm = (w) => (w != null && fl > 0 ? Math.round(w / fl) : null);
  const A = out.mpi && out.mpi.angebote && out.mpi.angebote.verfuegbar ? out.mpi.angebote : null;
  const mp = e.modellpruefung || null, mh = e.miete_herkunft || null, band = e.miete_band || null;
  const lzsStufe = out.basis ? out.basis.lzs_stufe : null;
  const lzsEt = out.basis ? out.basis.lzs_etikett : null;

  /* Herkunft der Miete in einem Satz */
  let mieteSatz = null, mieteKurz = null;
  if (mh) {
    /* v2600 · E1 · Massstab ist der Anker (amtlich / Ø Miete des Satzes / Angebotsmiete), Band ± 20 %;
       ausserhalb gilt der Anker selbst (nicht mehr die Kante) */
    const bandT = band ? ' (Band ' + qmDe(band.unten_qm).replace(' €/m²', '') + '–' + qmDe(band.oben_qm) + ')' : '';
    const ms = e.miete_stufe || null;
    const ank = ms ? ms.etikett + ' ' + qmDe(ms.qm) : (mh.vergleich_qm ? 'Vergleichsmiete ' + qmDe(mh.vergleich_qm) : 'Vergleichsmiete');
    const aus = (mh.n_oben || 0) + (mh.n_unten || 0);
    if (mh.code === 'je_wohnung') {
      mieteKurz = 'Ist-Miete je Wohnung' + (aus ? ', ' + aus + ' außerhalb des Bandes' : ', im Band') + (mh.n_leer ? ', ' + mh.n_leer + ' leer' : '');
      /* v2600 · knapp (Tafel nicht aufblaehen): Massstab, dann nur, was nicht im Band liegt */
      const nT = [mh.n_band ? mh.n_band + ' im Band (Ist-Miete)' : null, mh.n_oben ? mh.n_oben + ' darüber' : null, mh.n_unten ? mh.n_unten + ' darunter' : null,
        mh.n_leer ? mh.n_leer + ' leer' : null].filter(Boolean);
      mieteSatz = 'gemessen an der ' + ank + ' ± ' + ((ms && ms.band_pct) || 20) + ' %' + bandT + ': ' + nT.join(', ')
        + (aus || mh.n_leer ? ' — ' + (aus && mh.n_leer ? 'diese' : (aus ? 'darüber/darunter' : 'leere')) + ' mit ' + qmDe(ms ? ms.qm : mh.vergleich_qm) + ' angesetzt' : '') + '.';
    } else if (mh.code === 'ist_im_band') {
      mieteKurz = 'Ist-Miete im Band';
      mieteSatz = 'Ist-Miete im Band um die ' + ank + bandT + ' — angesetzt, wie sie gezahlt wird.';
    } else if (mh.code === 'ueber_band' || mh.code === 'unter_band') {
      const o = mh.code === 'ueber_band';
      mieteKurz = 'marktübliche Miete (Ist ' + (o ? 'darüber' : 'darunter') + ')';
      mieteSatz = 'Die Ist-Miete liegt ' + (o ? 'über' : 'unter') + ' dem Band' + bandT + '; angesetzt ist die ' + ank + '.';
    } else {
      mieteKurz = ms ? ms.etikett : 'Angebotsmiete';
      mieteSatz = 'Keine Ist-Miete erfasst — angesetzt ist die ' + ank + '.';
    }
  }
  /* v2600 · E2/E3 · die Abweichung in einer Zeile: angesetzt, oder als Szenario */
  const eu = (x) => (x > 0 ? '+' : (x < 0 ? '−' : '')) + Math.abs(Math.round(Number(x))).toLocaleString('de-DE') + ' €';
  const b = e.miete_bog || null;
  let bogSatz = null;
  if (e.bog_doppelt_vermieden) bogSatz = 'Mietabweichung steckt in den eigenen besonderen Merkmalen, nicht doppelt angesetzt.';
  else if (b && (b.n_angesetzt || b.n_offen)) {
    const t = [];
    if (b.n_angesetzt && b.angesetzt_eur) t.push('angesetzt ' + eu(b.angesetzt_eur) + ' (Barwert über die Restlaufzeit)');
    if (b.n_offen && b.szenarien) t.push(eu(b.offen_differenz_jahr) + '/Jahr, Restlaufzeit unbekannt: ' + eu(b.szenarien[0].barwert_eur).replace(' €', '') + ' bis '
      + eu(b.szenarien[b.szenarien.length - 1].barwert_eur) + ' (Szenario ' + b.szenarien[0].jahre + '–' + b.szenarien[b.szenarien.length - 1].jahre + ' J.), nicht im Wert');
    bogSatz = 'Mietabweichung ' + t.join('; ') + '.';
  }
  if (e.leerstand_bog && e.leerstand_bog.summe_eur > 0 && !e.bog_doppelt_vermieden) bogSatz = (bogSatz ? bogSatz + ' ' : '') + 'Leerstand: ' + eu(-e.leerstand_bog.summe_eur) + ' (Mietausfall, Herrichtung).';
  /* Stufe des Zinses in einem Satz */
  const lzsSatz = lzsStufe ? ('Liegenschaftszins ' + Number(out.basis.lzs_pct).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' % · Stufe ' + lzsStufe
    + (lzsStufe === 'A' && (!lzsEt || lzsEt === 'amtlich') ? ' — amtlicher Satz des Gutachterausschusses'
      : lzsStufe === 'N' ? ' — ' + (e.liegenschaftszins_n_etikett && /Landesmittel/.test(e.liegenschaftszins_n_etikett) ? e.liegenschaftszins_n_etikett : 'abgeleitet aus der DealPilot-Formel') + ', nicht amtlich'
      : lzsStufe === 'D' ? ' — gesetzlicher Auffangwert (§ 256 BewG); mit dem örtlichen Zins wird es genauer'
      /* B ist der oertliche amtliche Satz mit grosser Streuung - kein „genauer" (v2595 im Browser gemessen) */
      : lzsStufe === 'B' ? ' — amtlicher Satz des Gutachterausschusses, aber mit großer Streuung'
      : lzsStufe === 'E' ? ' — eigene Angabe'
      : ' — ' + (lzsEt || 'nicht der örtliche Satz') + '; mit dem örtlichen Zins wird es genauer') + '.') : null;

  /* Ursachen der Differenz - nur, was hier gemessen ist, als „nachgewiesen" */
  const d = differenzZumErtragswert(mpi, ew);
  const ursachen = [];
  if (d) {
    const mm = mp && mp.geprueft && mp.merkmale ? mp.merkmale : null;
    if (mm && mm.miete.status !== 'unbekannt' && mm.miete.abweichung_pct != null && Math.abs(mm.miete.abweichung_pct) >= 5) {
      const ueber = mm.miete.abweichung_pct > 0;
      ursachen.push({ status: 'nachgewiesen', richtung: ueber ? 'ertragswert_hoeher' : 'ertragswert_niedriger',
        text: 'Angesetzte Miete ' + qmDe(mm.miete.ansatz) + ', ' + Math.round(Math.abs(mm.miete.abweichung_pct)) + ' % '
          + (ueber ? 'über' : 'unter') + ' der Ø Miete des Zinses (' + qmDe(mm.miete.satz) + ') — ' + (ueber ? 'hebt' : 'senkt') + ' den Ertragswert.' });
    }
    if (mh && mh.angesetzt_qm && band && band.angebot_qm && Math.abs(mh.angesetzt_qm / band.angebot_qm - 1) >= 0.05) {
      const p = Math.round((mh.angesetzt_qm / band.angebot_qm - 1) * 100);
      ursachen.push({ status: 'nachgewiesen', richtung: p > 0 ? 'ertragswert_hoeher' : 'ertragswert_niedriger',
        text: 'Angesetzte Miete ' + Math.abs(p) + ' % ' + (p > 0 ? 'über' : 'unter') + ' der Angebotsmiete am Ort ('
          + qmDe(band.angebot_qm) + '); die Marktpreisindikation rechnet ohne die Miete dieses Hauses.' });
    }
    if (mm && mm.rnd.status !== 'unbekannt' && mm.rnd.abweichung_jahre != null && Math.abs(mm.rnd.abweichung_jahre) >= 5) {
      const l = mm.rnd.abweichung_jahre > 0;
      ursachen.push({ status: 'nachgewiesen', richtung: l ? 'ertragswert_hoeher' : 'ertragswert_niedriger',
        text: 'Restnutzungsdauer ' + Math.round(mm.rnd.ansatz) + ' J., ' + Math.abs(mm.rnd.abweichung_jahre) + ' J. '
          + (l ? 'über' : 'unter') + ' dem Ø der Kauffälle des Zinses (' + Math.round(mm.rnd.satz) + ' J.) — ' + (l ? 'hebt' : 'senkt') + ' den Ertragswert.' });
    }
    if (A && A.abschlag_pct != null && Number(A.abschlag_pct) !== 0) {
      ursachen.push({ status: 'nachgewiesen', richtung: 'mpi_niedriger',
        text: 'Abschlag ' + String(Math.round(Number(A.abschlag_pct) * 10) / 10).replace('.', ',')
          + ' % auf Angebotspreise (' + (/^örtlich/.test(String(A.abschlag_herkunft || '')) ? 'örtlich gemessen' : (/eigene/.test(String(A.abschlag_herkunft || '')) ? 'eigene Angabe' : 'Marktdurchschnitt')) + ') — senkt die Marktpreisindikation.' });
    }
    if (b && b.n_offen && b.offen_differenz_jahr) {
      const ov = b.offen_differenz_jahr > 0;
      ursachen.push({ status: 'nachgewiesen', richtung: ov ? 'ertragswert_niedriger' : 'ertragswert_hoeher',
        text: (ov ? 'Mehrertrag' : 'Minderertrag') + ' der Ist-Mieten (' + eu(b.offen_differenz_jahr) + '/Jahr) ohne bekannte Restlaufzeit nicht im Ertragswert — '
          + (ov ? 'der Markt bezahlt ihn womöglich mit.' : 'der Ertragswert liegt insoweit über dem heutigen Ertrag.') });
    }
    if (mh && mh.n_leer && !(e.leerstand_bog && e.leerstand_bog.summe_eur > 0)) {
      ursachen.push({ status: 'plausibel', richtung: 'ertragswert_hoeher',
        text: mh.n_leer + ' leere Wohnung' + (mh.n_leer === 1 ? '' : 'en') + ' im Ertragswert mit Vergleichsmiete, ohne Abzug bis zur Wiedervermietung — '
          + 'der Markt zahlt für den heutigen Zustand womöglich weniger.' });
    }
    if (lzsStufe && lzsStufe !== 'A') {
      ursachen.push({ status: 'plausibel', richtung: null,
        text: (lzsStufe === 'B' ? 'Der amtliche Zins streut stark (Stufe B)' : 'Der Zins ist nicht der örtliche amtliche Satz (Stufe ' + lzsStufe + ')')
          + (e.sensitivitaet && e.sensitivitaet.lzs_plus_05 ? '; ein halber Prozentpunkt mehr ändert den Ertragswert um ' + String(e.sensitivitaet.lzs_plus_05.abweichung_pct).replace('.', ',') + ' %' : '') + '.' });
    }
    ursachen.push({ status: 'nicht_pruefbar', richtung: null,
      text: 'Welche Angebote der Datenanbieter auswählt und wie er sie gewichtet, ist nicht offengelegt.' });
  }
  return {
    bezugsflaeche: fl > 0 ? { qm: fl, art: 'Wohnfläche des Objekts' } : null,
    ertragswert: { wert: ew, eur_qm: proQm(ew), lzs_pct: out.basis ? out.basis.lzs_pct : null, lzs_stufe: lzsStufe, lzs_etikett: lzsEt,
                   belastbarkeit: e.belastbarkeit ? { pct: e.belastbarkeit.pct, label: e.belastbarkeit.label } : null },
    mpi: { wert: mpi, eur_qm: proQm(mpi), abschlag_pct: A ? A.abschlag_pct : null, abschlag_herkunft: A ? A.abschlag_herkunft : null,
           spanne: out.haus && out.haus.bestand ? (out.haus.bestand.mpi_angebote_spanne || null) : null },
    differenz: d,
    miete: mh ? { code: mh.code, kurz: mieteKurz, satz: mieteSatz, angesetzt_qm: mh.angesetzt_qm,
                  stufe: e.miete_stufe ? e.miete_stufe.code : null, stufe_etikett: e.miete_stufe ? e.miete_stufe.etikett : null } : null,
    /* v2600 · E2/E3/E4 */
    bog: bogSatz ? { satz: bogSatz, angesetzt_eur: b && !e.bog_doppelt_vermieden ? (b.angesetzt_eur || 0) : 0 } : null,
    bezeichnung: e.bezeichnung || 'Ertragswert', vorlaeufig_vor_bog: !!e.vorlaeufig_vor_bog,
    lzs_spanne: e.lzs_spanne ? { text: e.lzs_spanne.text, von_pct: e.lzs_spanne.von_pct, bis_pct: e.lzs_spanne.bis_pct,
      ertragswert_von_eur: e.lzs_spanne.ertragswert_von_eur, ertragswert_bis_eur: e.lzs_spanne.ertragswert_bis_eur } : null,
    lzs: lzsStufe ? { stufe: lzsStufe, etikett: lzsEt, satz: lzsSatz } : null,
    modellpruefung: mp && mp.geprueft ? { kurz: mp.kurz, text: mp.text, abweichend: mp.abweichend, unbekannt: mp.unbekannt,
      ausschuss: mp.ausschuss || null, berichtsjahr: mp.berichtsjahr || null, schwellen_art: mp.schwellen ? mp.schwellen.art : null }
      : { kurz: null, text: mp ? mp.hinweis || null : null, nicht_geprueft: true },
    ursachen,
    /* v2660 · E7 · der Vergleichswert aus dem Immobilienrichtwert, knapp (nur wo ein IRW vorliegt) */
    vergleichswert: (function () {
      const v = cc.vergleichswert_irw;
      if (!v) return null;
      if (v.verfuegbar) {
        return { verfuegbar: true, wert: v.vergleichswert_eur, eur_qm: v.wert_qm, stufe: v.stufe || 'A',
          ausschuss: v.quelle ? v.quelle.ausschuss : null, fuehrend: !!(cc.verfahrenswahl && cc.verfahrenswahl.verfahren === 'vergleichswert') };
      }
      return { verfuegbar: false, grund: v.grund || null, fehlt: (v.fehlt_text || []).map((t) => String(t).split(' — ')[0]),
        weg: v.weg || null, irw_qm: cc.irw && cc.irw.verfuegbar ? cc.irw.wert_qm : null };
    })(),
  };
}

/* ══ v3265 · WERT JE WOHNUNG BEI AUFTEILUNG: DIE BAUSTEINE ═══════════════════
   refWohnungEtw: die Referenz einer Wohnung für den Angebotskern - dieselbe wie im
   abgerechneten Abruf (v2541), deshalb hier einmal statt zweimal.
   etwAusAbruf: das Angebotsniveau der Flächenklasse aus dem letzten Abruf „Marktpreise"
   (gespeichert in mb.potenzial_abrufe) durch DENSELBEN Kern wie dort - ValuationService
   mit dem Abschlag auf Angebotspreise (lib/angebot_abschlag.js). Keine Zahl ohne Abruf:
   fehlt die Flächenklasse, gibt es keinen Wert. */
function refWohnungEtw(fl) {
  return { property_type: 'etw', living_area: fl, units: 1, plot_area: null, garden_area: null,
    garages: 0, outdoor_parking: 0, purchase_price: null, monthly_net_rent: null, bom_eur: null, bom_grund: null, floor: null, vacancy: false };
}
function etwNiveauAusAbruf(abruf, wfl) {
  const liste = abruf && Array.isArray(abruf.wohnungen) ? abruf.wohnungen : [];
  const key = Math.round(Math.round(Number(wfl)) / 10);
  if (!(Number(wfl) > 0)) return null;
  const t = liste.find((x) => x && x.art !== 'gewerbe' && x.mpi_etw && Number(x.mpi_etw.median_qm) > 0
    && Math.round(Math.round(Number(x.wfl)) / 10) === key);
  if (!t) return null;
  const e = t.mpi_etw, z = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  return { median_per_sqm: Number(e.median_qm), q25_per_sqm: z(e.q25_qm), q75_per_sqm: z(e.q75_qm), sample_size: z(e.stichprobe) };
}
function etwAusAbruf(wb, ref, r, abruf, mitZiel) {
  const fl = Math.round(Number(r && r.wfl));
  const sale = etwNiveauAusAbruf(abruf, fl);
  if (!sale) return null;
  const wbW = { ref: Object.assign({}, ref, refWohnungEtw(fl)), sale, rent: wb ? wb.rent : null, land_value_roh: null };
  const b = mpiAngebote(wbW, null);
  if (!b) return null;
  const z = mitZiel ? mpiAngebote(wbW, ZIELBILD_REF()) : null;
  return { bestand: b.wert, low: b.low, high: b.high, zielbild: z ? z.wert : null,
    median_qm: Math.round(sale.median_per_sqm), q25_qm: sale.q25_per_sqm != null ? Math.round(sale.q25_per_sqm) : null,
    q75_qm: sale.q75_per_sqm != null ? Math.round(sale.q75_per_sqm) : null,
    abschlag_pct: b.abschlag_pct, abschlag_herkunft: b.abschlag_herkunft || null, stichprobe: sale.sample_size,
    roh: b.roh ? b.roh.wert : null,
    quelle: 'abruf', abgerufen_am: abruf.abgerufen_am || null };
}
const VERFAHREN_TEXT = {
  vergleichswert_amtlich: 'Vergleichswert (amtlicher Vergleichsfaktor)',
  vergleichswert_angebote: 'Vergleichswert (indikativ, aus Angebotspreisen abgeleitet)',
  ertragswert_etw: 'Ertragswert als Eigentumswohnung (ersatzweise)',
  anteil_haus: 'Anteil am Haus (Gewerbe)' };
/* v3265 · die Summe nach Aufteilung trägt den Namen ihres führenden Verfahrens */
function aufteilerBezeichnung(z) {
  if (!z) return null;
  const vg = (z.amtlich || 0) + (z.angebote || 0);
  if (!vg) return z.ertragswert ? 'Ertragswert als Eigentumswohnung (ersatzweise, kein Vergleichswert verfügbar)' : null;
  /* v3322 · Immobilienrichtwert beim Namen (bis v3317 hieß auch er „amtlicher Vergleichsfaktor“) */
  const amt = !z.irw ? 'amtlicher Vergleichsfaktor' : (z.irw === z.amtlich ? 'Immobilienrichtwert' : 'amtlicher Vergleichsfaktor/Immobilienrichtwert');
  const art = z.amtlich && !z.angebote ? 'Vergleichswert (' + amt + ')'
    : (!z.amtlich ? 'Vergleichswert (indikativ, aus Angebotspreisen abgeleitet)' : 'Vergleichswert (' + amt + ' und aus Angebotspreisen)');
  return art + (z.ertragswert ? ', ' + z.ertragswert + ' × Ertragswert ersatzweise' : '');
}

/* v3322 · AUFTEILERWERT als eigene Funktion (bis v3317 in rechne(), nur über den ganzen Lauf prüfbar).
   Je Wohnung das führende Verfahren: 1. Vergleichswert aus amtlicher Kaufpreisbasis (Vergleichsfaktor oder
   Immobilienrichtwert, § 20/§ 24 ImmoWertV), 2. sonst Angebotspreise MIT Abschlag (indikativ, wie Stufe M),
   3. sonst der Ertragswert als Eigentumswohnung ersatzweise; Gewerbe mit seinem Anteil am Haus. Stützend
   bleibt der Ertragswert der Wohnung (als_etw). Kein Treffer heißt kein Wert: fehlt eine Wohnung ganz, ist
   die Summe unvollständig (vollstaendig: false), es wird nichts ergänzt. Setzt r.fuehrend[s] je Wohnung.
   Rückgabe { [stufe]: { summe, wert, vollstaendig, zaehl, bezeichnung, potenzial, negativ } }. */
function aufteilerRechnen(wohnungen, jeStufe, haus, kostenEur, stufen) {
  const aus = (s) => String(s || '').replace(/^(Der|Die|Das)\s+/, '');
  const T = {};
  for (const s of stufen) {
    if (!jeStufe || !jeStufe[s] || !haus || !haus[s]) continue;
    let sum = 0, voll = true; const zaehl = { amtlich: 0, irw: 0, angebote: 0, ertragswert: 0, gewerbe: 0, fehlt: 0 };
    (wohnungen || []).forEach((r) => {
      r.fuehrend = r.fuehrend || {};
      if (r.art === 'gewerbe') {
        const v = r.anteil_am_haus ? r.anteil_am_haus[s] : null;
        r.fuehrend[s] = { wert: v, verfahren: 'anteil_haus', bezeichnung: VERFAHREN_TEXT.anteil_haus, herkunft: 'Anteil am Ertragswert des Hauses' };
        if (v == null) { voll = false; zaehl.fehlt++; } else { sum += v; zaehl.gewerbe++; }
        return;
      }
      const vg = r.vergleich_etw ? r.vergleich_etw[s] : null;
      const mp = r.mpi_etw ? (s === 'zielbild' ? r.mpi_etw.zielbild : r.mpi_etw.bestand) : null;
      /* v3265 · wie Stufe M (v3242): Angebotspreise führen nur MIT Abschlag - ohne ihn sind es
         Angebots-, keine Kaufpreise (§ 25 Abs. 1 ImmoWertV) */
      const mpAb = r.mpi_etw && Number(r.mpi_etw.abschlag_pct) > 0;
      const stz = r.als_etw && r.als_etw[s] > 0 ? r.als_etw[s] : null;
      const irw = !!(vg && vg.quelle === 'Immobilienrichtwert');
      let v = null, verf = null, herk = null;
      if (vg && vg.wert > 0) {
        v = vg.wert; verf = 'vergleichswert_amtlich'; zaehl.amtlich++; if (irw) zaehl.irw++;
        herk = (irw ? 'Immobilienrichtwert' : 'amtlicher Vergleichsfaktor') + (vg.faktor_qm ? ' ' + Math.round(vg.faktor_qm).toLocaleString('de-DE') + ' €/m²' : '')
          + (vg.ausschuss ? ' · ' + aus(vg.ausschuss) : '') + (vg.stufe ? ' · Stufe ' + vg.stufe : '');
      } else if (mp > 0 && mpAb) {
        v = Math.round(mp); verf = 'vergleichswert_angebote'; zaehl.angebote++;
        herk = 'Angebotspreise für Eigentumswohnungen am Ort' + (r.mpi_etw.median_qm ? ' (' + Math.round(r.mpi_etw.median_qm).toLocaleString('de-DE') + ' €/m²)' : '')
          + ' abzüglich ' + String(r.mpi_etw.abschlag_pct).replace('.', ',') + ' % Abschlag, indikativ';
      } else if (stz) {
        v = stz; verf = 'ertragswert_etw'; zaehl.ertragswert++;
        herk = 'kein Vergleichswert verfügbar' + (vg && vg.offen && vg.offen.length ? ' (für den amtlichen Vergleichsfaktor fehlt: ' + vg.offen.join(', ') + ')' : '');
      } else { voll = false; zaehl.fehlt++; }
      /* v3265 · am Ergebnis je Wohnung: was führt, was stützt, und ob der Ertragswert nur ersatzweise steht */
      r.fuehrend[s] = { wert: v, verfahren: verf,
        bezeichnung: verf ? (irw && verf === 'vergleichswert_amtlich' ? 'Vergleichswert (Immobilienrichtwert)' : VERFAHREN_TEXT[verf]) : null,
        herkunft: herk,   /* v3322 · Herkunft je Zahl */
        indikativ: verf === 'vergleichswert_angebote',
        quelle: verf === 'vergleichswert_angebote' ? (r.mpi_etw.quelle || 'markt') : null,
        stuetzend: verf && verf !== 'ertragswert_etw' ? stz : null,
        ersatzweise: verf === 'ertragswert_etw' };
      if (v != null) sum += v;
    });
    const wert = Math.round(sum - (Number(kostenEur) || 0));
    T[s] = { summe: Math.round(sum), wert, vollstaendig: voll, zaehl, bezeichnung: aufteilerBezeichnung(zaehl),
      potenzial: Math.round(wert - haus[s].wert), negativ: wert < haus[s].wert };
  }
  return T;
}

/* v3343 · Zielbild je Wohnung: welche Miete gilt und warum (Rechenweg, Kundentext nur Punkt und Komma) */
function zielHerleitung(bb, wlB, mieteZ) {
  const de = (x) => (x == null ? '-' : (Math.round(x * 100) / 100).toFixed(2).replace('.', ','));
  return bb.zeilen.map((z, i) => {
    if (!z) return null;
    const w = wlB[i] || {}, zm = z.ziel_max, v = z.vgl;
    const m = mieteZ(z, i);
    return { nr: w.nr || String(i + 1), wfl: z.wfl, angesetzt_qm: z.wfl > 0 && m != null ? Math.round(m / 12 / z.wfl * 100) / 100 : null,
      eingabe_qm: zahl(w.miete_jahr && w.miete_jahr.zielbild) > 0 && z.wfl > 0 ? Math.round(zahl(w.miete_jahr.zielbild) / 12 / z.wfl * 100) / 100 : null,
      vergleichsmiete: v ? { quelle: v.quelle, unten: v.unten, mittel: v.mittel, oben: v.oben, ca: !!v.ca, einordnung: v.einordnung ? v.einordnung.wahl : null } : null,
      maximum: zm ? { bestand_qm: zm.bestand_max_qm, neu_qm: zm.neu_max_qm, konservativ_qm: zm.konservativ_qm, faktor: zm.faktor, bremse_gilt: zm.bremse_gilt, bedingung: zm.bedingung } : null,
      satz: zm ? ('Vergleichsmiete ' + (v.ca ? 'ca. ' : '') + de(v.mittel) + ' €/m², Spanne ' + de(v.unten) + ' bis ' + de(v.oben) + ' €/m². Rechtlich erzielbar bei Neuvermietung bis ' + de(zm.neu_max_qm)
        + ' €/m² (' + (zm.faktor > 1.15 ? '120 % ohne Mietpreisbremse' : '110 % mit Mietpreisbremse') + '). Im Zielbild zählt die Zielmiete bis zu diesem Maximum.') : null };
  }).filter(Boolean);
}
function zielbildPrognose(basis, ref, kB, zb, auftrag) {
  const st = basis.stichtag ? new Date(basis.stichtag + 'T00:00:00Z') : new Date();
  const jetzt = st.getUTCFullYear();
  const zj = Math.round(zahl(auftrag.zielbild_jahr) || 0);
  if (!(zj > jetzt) || zj > jetzt + 30) return zj && zj <= jetzt ? null : (zj ? null : { verfuegbar: false, grund: 'Zielbild-Jahr nicht eingetragen (Feld „Zielbild fertig (Jahr)“), ohne Jahr keine Prognose.' });
  const rate = mietsteigerungRate(auftrag.mietsteigerung_pct);
  if (!rate) return null;
  const n = zj - jetzt;
  const f = fortschreibung(rate.pct, n);
  const ein0 = zb._ein || basis.ein;
  const ein = Object.assign({}, ein0);
  const mNeu = Math.round(Number(zb.miete_wohnen_jahr) * f);
  bwkNachziehen(ein, mNeu);
  ein.miete_markt_jahr = mNeu;
  const rndZ = zahl(zb.rnd);
  /* Ohne Massnahme altert das Gebaeude bis zum Zieljahr (RND - n). Mit Massnahme bleibt die RND des Zielbilds:
     sie ist nach Anlage 2 ab der Modernisierung gerechnet, und das Zieljahr ist ihr Fertigstellungsjahr. */
  const altert = !(zahl(zb.mod_punkte_plus) > 0);
  const rndP = rndZ != null ? (altert ? Math.max(10, Math.round((rndZ - n) * 10) / 10) : rndZ) : null;
  if (rndP != null) { ein.rnd_jahre = rndP; ein.mod_punkte = null; }
  const k = ErtragswertService.ertragswert(ein, basis.bodenwert);
  const z = kernZusammenfassung(k);
  if (!z || z.wert == null) return null;
  /* zum Vergleich: dieselbe Miete mit der RND des Zielbilds (nur die Mietentwicklung, ohne Alterung) */
  let wertGleicheRnd = null;
  if (altert && rndZ != null && rndP !== rndZ) { const e2 = Object.assign({}, ein, { rnd_jahre: rndZ }); const k2 = kernZusammenfassung(ErtragswertService.ertragswert(e2, basis.bodenwert)); wertGleicheRnd = k2 ? k2.wert : null; }
  const de = (x) => String(Math.round(x * 1000) / 10).replace('.', ',');
  return { verfuegbar: true, jahr: zj, jahre: n, rate_pct: rate.pct, rate_quelle: rate.quelle, rate_text: rate.text, faktor: Math.round(f * 10000) / 10000,
    wert: z.wert, wert_ungerundet: z.wert_ungerundet, rohertrag: z.rohertrag, rnd: z.rnd, miete_wohnen_jahr: mNeu, wert_ohne_alterung: wertGleicheRnd,
    satz: 'Prognose zum Jahr ' + zj + ': Wohnmiete des Zielbilds fortgeschrieben mit ' + rate.text + ', Faktor ' + String(Math.round(f * 1000) / 1000).replace('.', ',')
      + '. Vergleichsmiete, Spanne und die Grenzen der Neuvermietung wandern mit demselben Faktor. Liegenschaftszins und Bodenwert wie heute, Bewirtschaftungskosten mit gleicher Quote, Restnutzungsdauer '
      + (rndP != null ? String(rndP).replace('.', ',') + ' Jahre' + (altert ? ' (das Gebäude ist ' + n + ' Jahre älter)' : ' (ab Fertigstellung der Maßnahmen im Zieljahr)') : 'wie im Zielbild')
      + '. Eine Prognose, kein Verkehrswert. Mietanstieg ' + de(f - 1) + ' % bis ' + zj + '.' };
}

export const PotenzialService = {
  KENNZEICHNUNG,

  /**
   * @param {object} wb   Rückgabe von ReportOrchestrator.generate(..., { nurWertBasis: true })
   * @param {object} auftrag  { varianten: [{key, miete_wohnen_jahr, mod_punkte_plus, kosten}],
   *                            wohnungen: [{nr, art, wfl, mea_pct, miete_jahr:{bestand,mieterhoehung,zielbild},
   *                                         mod_punkte_plus:{mieterhoehung,zielbild}}],
   *                            aufteilung: { aktiv, kosten_eur } }
   */
  async rechne(wb, auftrag = {}) {
    const basis = wb && wb.ertragswert_eingabe;
    const out = { verfuegbar: false, kennzeichnung: KENNZEICHNUNG, stand: new Date().toISOString().slice(0, 10) };
    if (!basis || !basis.ein) {
      const cc = (wb && wb.cross_check) || {};
      /* v2556 · Die erste Notiz mit „Ertragswert" war der allgemeine Hinweis
         („Vereinfachtes Sachwert-/Ertragswertverfahren … Indikativ") - der stand
         dann als GRUND da. Der Hinweis zaehlt nicht; der Lauf wird geloggt. */
      const notiz = (cc.notes || []).find((n) => /^Ertragswert (nicht gerechnet|entfällt)/.test(n))
        || (cc.notes || []).find((n) => /Ertragswert/i.test(n) && !/^Vereinfachtes Sachwert-\/Ertragswertverfahren/.test(n));
      const spur = Array.isArray(wb && wb.trace) ? wb.trace : [];
      try { console.log('[potenzial] keine Ertragswert-Eingabe · ' + spur.slice(-14).map((s) => (typeof s === 'string' ? s : JSON.stringify(s)).slice(0, 160)).join(' | ')); } catch (e) { /* nur Log */ }
      out.grund = notiz
        || 'Für dieses Objekt rechnet der Ertragswert nicht (es fehlen Pflichtangaben wie Wohnfläche, Miete oder Baujahr).';
      return out;
    }
    const ref = wb.ref || {};
    const cc = wb.cross_check || {};
    const kB = ErtragswertService.ertragswert(Object.assign({}, basis.ein), basis.bodenwert);
    const bestand = kernZusammenfassung(kB);
    if (!bestand || bestand.wert == null) {
      out.grund = (kB && kB.warnungen && kB.warnungen[0]) || 'Der Ertragswert rechnet für dieses Objekt nicht.';
      return out;
    }
    bestand.mod_punkte = zahl(basis.ein.mod_punkte);
    bestand.miete_wohnen_jahr = basis.ein.miete_markt_jahr;
    out.verfuegbar = true;
    out.ags = ref.ags || null;
    const bericht = cc.ertragswert || {};
    out.basis = {
      lzs_pct: basis.ein.lzs_pct, lzs_stufe: basis.ein.lzs_stufe || null, lzs_quelle: basis.ein.lzs_quelle || null,
      lzs_etikett: basis.ein.lzs_herkunft ? basis.ein.lzs_herkunft.etikett : null,
      bwk_modus: basis.ein.bwk_modus || null, bwk_quote_pct: basis.ein.bwk_quote_pct ?? null,
      gnd: bestand.gnd, gnd_quelle: basis.gnd_quelle || null,
      bodenwert: basis.bodenwert && basis.bodenwert.vollstaendig ? basis.bodenwert.wert : null,
      wohnflaeche_wohnen: basis.wohnflaeche_wohnen ?? null,
      miete_qm: basis.miete_qm ?? null, miete_quelle: basis.miete_quelle || null,
      /* der Abgleich: dieselbe Zahl wie im Bericht Stufe 3 */
      bericht_ertragswert: bericht.value_eur ?? null,
    };
    out.haus = { bestand };
    out.sanierung = cc.sanierung || null;   /* v2988 · Regel der Sanierungskosten (Mapper sanStatus) */
    const varianten = Array.isArray(auftrag.varianten) ? auftrag.varianten : [];
    const wl = (Array.isArray(auftrag.wohnungen) ? auftrag.wohnungen : []).filter((w) => w && Number(w.wfl) > 0);
    /* v2488 · ohne Wohnungsliste (ETW, Einzelobjekt): EINE Wohnung = das Objekt,
       Ist aus der Eingabe des Berichts, Stufenmiete aus der Variante. */
    const wlB = wl.some((w) => w.art !== 'gewerbe') ? wl : [{ art: 'wohnen', wfl: zahl(basis.wohnflaeche_wohnen) || zahl(basis.ein.wohnflaeche_qm),
      miete_jahr: Object.assign({ bestand: (!ref.vacancy && zahl(ref.monthly_net_rent) > 0) ? zahl(ref.monthly_net_rent) * 12 : 0 },
        ...varianten.filter((v) => v && STUFEN.indexOf(v.key) >= 0).map((v) => ({ [v.key]: zahl(v.miete_wohnen_jahr) }))),
      ...(auftrag.einzel558 && typeof auftrag.einzel558 === 'object' ? auftrag.einzel558 : {}) }];   /* v3150 · Ziel und Historie fuer den Pfad nach § 558 */
    const bb = bestandsBasis(basis, wlB);
    /* v2988 · Band und marktuebliche Miete nach den Massnahmen je Stufe */
    const MNM = {};
    for (const v of varianten) {
      if (!v || STUFEN.indexOf(v.key) < 0) continue;
      MNM[v.key] = mieteNachModernisierung(wb, basis, v.key, zahl(v.mod_punkte_plus) || 0, zahl(v.kosten) || 0, auftrag.zielbild_markt_qm);
    }
    const ovS = (s) => (MNM[s] ? MNM[s].ov : null);
    /* v3150 · N114 · die Stufe Mieterhoehung nach § 558 (Wert zum Stichtag) */
    let S558 = null;
    try { S558 = varianten.some((v) => v && v.key === 'mieterhoehung') ? stufe558(basis, ref, bb, wlB, kB) : null; }
    catch (e) { console.log('[potenzial] stufe558: ' + e.message); S558 = null; }
    /* v3287 · ZIELBILD NIE UNTER DER MIETERHOEHUNG (Marcel 11.11.2026 „nimm das, was richtig ist"). Gemessen
       Modul 26 live: Haus Zielbild 600.000 < Mieterhoehung 625.000 €. Die Zielmiete der Wohnung 1 (9,50 €/m²)
       lag ueber dem Band, die Bandregel (v2936, aus E1) setzte dann den Anker 7,30 an - die Stufe Mieterhoehung
       aber die rechtlich erreichbare Vergleichsmiete 7,80 (im Band). ImmoWertA 31 b: bei bestehenden
       Mietverhaeltnissen sind die zulaessigen Erhoehungen (§§ 558 ff. BGB) marktueblich erzielbar - das Zielbild
       baut auf ihnen auf. Je Wohnung: Zielbild = max(Bandregel des Zielbilds, Zielmiete der Stufe Mieterhoehung).
       E1 bleibt: ausserhalb des Bandes nie die Bandkante, und die Vergleichsmiete der Mieterhoehung liegt selbst im Band. */
    const mieteStufe = (z, i, s) => {
      if (s === 'mieterhoehung' && S558) return S558.mieten[i] != null ? S558.mieten[i] : z.basis;   /* v3150 */
      const m = stufenMiete(z, wlB[i], s, ovS(s));
      return (s === 'zielbild' && S558 && S558.mieten[i] != null && S558.mieten[i] > m) ? S558.mieten[i] : m;
    };
    const anhebungN = (s) => (bb ? bb.zeilen.filter((z, i) => z && mieteStufe(z, i, s) > z.basis + 0.5).length : 0);
    bestand.anhebung_jahr = 0;
    for (const v of varianten) {
      if (!v || STUFEN.indexOf(v.key) < 0) continue;
      let m = zahl(v.miete_wohnen_jahr);
      if (m == null) continue;
      if (bb) m = bb.zeilen.reduce((a, z, i) => a + (z ? mieteStufe(z, i, v.key) : 0), 0);
      else m = Math.max(m, Number(basis.ein.miete_markt_jahr) || 0);   /* ohne Basis: nie unter dem Bestand */
      /* v3150 · Mieterhoehung: RND, Punkte und Kosten des Bestands (N114 Punkt 1), Mindermiete als boG */
      const _mh = v.key === 'mieterhoehung';
      const z = eineStufe(basis, ref, kB, m, _mh ? 0 : (zahl(v.mod_punkte_plus) || 0), _mh ? 0 : (zahl(v.kosten) || 0), _mh && S558 ? S558.bog : null);
      if (z && _mh && S558) {
        z.rechenweg558 = { satz: S558.satz, wohnungen: S558.zeilen, lzs_pct: S558.lzs_pct, rnd_jahre: S558.rnd_jahre, kappung_pct: S558.kappung_pct,
          kappung_text: S558.kappung_text, stichtag: S558.stichtag, mindermiete_eur: Math.round(S558.bog.wert), sensitiv_eur: S558.sensitiv_eur };
        if (zahl(v.mod_punkte_plus) > 0 || zahl(v.kosten) > 0) z.rechenweg558.verschoben = 'Modernisierungen dieser Stufe (' + (zahl(v.kosten) > 0 ? Math.round(zahl(v.kosten)).toLocaleString('de-DE') + ' €' : '')
          + (zahl(v.mod_punkte_plus) > 0 ? (zahl(v.kosten) > 0 ? ', ' : '') + '+' + String(zahl(v.mod_punkte_plus)).replace('.', ',') + ' Punkte' : '') + ') zählen erst im Zielbild.';
      }
      if (z && _mh && S558) {
        /* v3152 · N117 · Stufe Neuvermietung auf der Stufe Mieterhoehung */
        try {
          const nvS = stufeNeuvermietung(S558, bb, wlB, kB, auftrag.leerstand_pct, z.wert_ungerundet != null ? z.wert_ungerundet : z.wert);
          if (nvS) {
            if (nvS.wert != null) nvS.wert = Math.round(nvS.wert / 1000) * 1000;
            out.haus.neuvermietung = nvS;
          }
        } catch (e) { console.log('[potenzial] neuvermietung: ' + e.message); }
      }
      if (z) {
        z.kosten = _mh ? 0 : (zahl(v.kosten) || 0);   /* v3150 */
        z.anhebung_jahr = Math.round(z.miete_wohnen_jahr - bestand.miete_wohnen_jahr);   /* v2488 */
        z.anhebung_wohnungen = anhebungN(v.key);
        z.miete_nach_modernisierung = MNM[v.key] ? MNM[v.key].info : null;   /* v2988 */
        out.haus[v.key] = z;
      }
    }
    /* v3343 · Herleitung der Zielbild-Miete je Wohnung (Vergleichsmiete, Spanne, rechtliches Maximum) */
    if (out.haus.zielbild && bb) {
      out.haus.zielbild.miete_herleitung = zielHerleitung(bb, wlB, (z, i) => mieteStufe(z, i, 'zielbild'));
    }
    /* ── v3343 · PROGNOSE ZUM ZIELBILD-JAHR (Marcel 12.11.2026 abends) ─────────────────────────────
       Getrennt vom heutigen Ertragswert (Stichtag heute, modellkonform): die Wohnmiete des Zielbilds wird mit
       der Rate (lib/mietanker.js mietsteigerungRate) auf das Zieljahr fortgeschrieben - Vergleichsmiete, Spanne
       und die Grenzen 110 %/120 % wandern mit demselben Faktor, das rechtliche Maximum also auch.
       Entscheidungen: Liegenschaftszins und Bodenwert bleiben (keine Prognose von Marktzinsen); die
       Bewirtschaftungskosten bleiben als QUOTE am Rohertrag stehen (bwkNachziehen) - sie steigen damit mit der
       Miete, fuer Instandhaltung und Verwaltung (VPI-Fortschreibung, II. BV § 26 Abs. 4/§ 28 Abs. 5a) liegt
       die Rate in derselben Groessenordnung; die Restnutzungsdauer nimmt bis zum Zieljahr um die Jahre ab
       (das Gebaeude altert), nie unter 10 Jahre. Nie Verkehrswert. */
    if (out.haus.zielbild && out.haus.zielbild.wert != null) {
      try { const pg = zielbildPrognose(basis, ref, kB, out.haus.zielbild, auftrag); if (pg) out.haus.zielbild_prognose = pg; }
      catch (e) { console.log('[potenzial] prognose: ' + e.message); }
    }
    /* ── v2541 · Marktpreisindikation je Stufe (zwei Wege, s. o.) ─────────── */
    {
      const V = wb.valuation || null;
      const mvB = (V && V.market_value && V.market_value.estimated != null)
        ? { wert: V.market_value.estimated, low: V.market_value.low ?? null, high: V.market_value.high ?? null,
            abschlag_pct: V.market_value.angebot_abschlag ? V.market_value.angebot_abschlag.pct : null,
            abschlag_herkunft: V.market_value.angebot_abschlag ? V.market_value.angebot_abschlag.herkunft : null,
            abschlag_kurz: V.market_value.angebot_abschlag ? (V.market_value.angebot_abschlag.kurz || null) : null,   /* v2578 */
            roh: V.market_value.angebot_abschlag && V.market_value.angebot_abschlag.roh   /* v2842 */
              ? { wert: V.market_value.angebot_abschlag.roh.estimated ?? null, low: V.market_value.angebot_abschlag.roh.low ?? null, high: V.market_value.angebot_abschlag.roh.high ?? null } : null,
            median_qm: V.market_value.basis_median_sqm ?? null }
        : mpiAngebote(wb, null);
      const mvZ = out.haus.zielbild ? mpiAngebote(wb, ZIELBILD_REF()) : null;
      const gp = V && V.amtliche_gegenprobe;
      const rf = gp && Number(gp.rohertragsfaktor) > 0 ? Number(gp.rohertragsfaktor) : null;
      const mieteStufe = { bestand: (!ref.vacancy && zahl(ref.monthly_net_rent) > 0) ? zahl(ref.monthly_net_rent) * 12 : null };
      for (const v of varianten) if (v && STUFEN.indexOf(v.key) >= 0) mieteStufe[v.key] = zahl(v.miete_wohnen_jahr);
      out.mpi = {
        angebote: mvB ? { verfuegbar: true, abschlag_pct: mvB.abschlag_pct, abschlag_herkunft: mvB.abschlag_herkunft, abschlag_kurz: mvB.abschlag_kurz || null, median_qm: mvB.median_qm,
          hinweis: 'Angebotspreise am Ort × Wohnfläche × Objektfaktoren, abzüglich Abschlag auf Angebotspreise (§ 25 ImmoWertV verlangt Kaufpreise). '
            + 'Mieterhöhung wie Bestand: die Angebotspreise hängen nicht an der Miete. Zielbild mit Zustand „modernisiert".' }
          : { verfuegbar: false, grund: 'Für diesen Ort liegen keine Angebotspreise vor.' },
        rohertragsfaktor: rf ? { verfuegbar: true, faktor: rf, ausschuss: gp.ausschuss || null, quelle_url: gp.quelle_url || null,
          berichtsjahr: gp.berichtsjahr || null, seite: gp.seite || null,
          hinweis: 'Rohertragsfaktor des Gutachterausschusses × Jahresnettokaltmiete der Stufe — Durchschnitt aus Kauffällen, eine Gegenprobe, kein Verkehrswert.' }
          : { verfuegbar: false, grund: 'Der Gutachterausschuss veröffentlicht für dieses Segment keinen Rohertragsfaktor (oder er liegt nicht im Register).' },
        /* v3041 · Ø Kaufpreis aus Kauffällen × Wohnfläche (Rohertragsfaktor- oder Liegenschaftszins-Satz,
           ValuationService). Hängt weder an der Miete noch an den Maßnahmen: in jeder Stufe derselbe Wert. */
        kauffaelle: gp && Number(gp.wert_kaufpreis_mittel_eur) > 0
          ? { verfuegbar: true, wert: Number(gp.wert_kaufpreis_mittel_eur), kaufpreis_eur_qm: Number(gp.kaufpreis_eur_qm_mittel) || null,
              faelle: gp.kaufpreis_vertraege || null, ausschuss: gp.ausschuss_kurz || gp.ausschuss || null, berichtsjahr: gp.berichtsjahr || null,
              quelle_kennzahl: gp.quelle_kennzahl || null, quelle_url: gp.quelle_url || null,
              hinweis: 'Ø Kaufpreis tatsächlicher Verkäufe laut Gutachterausschuss × Wohnfläche — ohne Anpassung an dieses Objekt, eine Gegenprobe, kein Verkehrswert. Unabhängig von Miete und Maßnahmen.' }
          : { verfuegbar: false, grund: 'Kein passender Ø Kaufpreis aus Kauffällen des Gutachterausschusses (Teilmarkt, Jahrgang, Fallzahl oder Modellrahmen).' },
      };
      for (const s of ['bestand'].concat(STUFEN)) {
        const h = out.haus[s]; if (!h) continue;
        const a = s === 'zielbild' ? mvZ : mvB;
        h.mpi_angebote = a ? a.wert : null;
        h.mpi_angebote_spanne = a && a.low != null ? [a.low, a.high] : null;
        /* v2842 · Marcel 22.10.2026: „Sind da Abschläge drin?" - Abschlag und Wert ohne Abschlag je Stufe mitfuehren */
        h.mpi_abschlag_pct = a && a.abschlag_pct != null ? Number(a.abschlag_pct) : null;
        h.mpi_angebote_roh = a && a.roh && a.roh.wert != null ? a.roh.wert : null;
        h.mpi_rohertrag = rf && mieteStufe[s] > 0 ? { faktor: rf, miete_jahr: Math.round(mieteStufe[s]), wert: rundeMpi(rf * mieteStufe[s]) } : null;
      }
    }

    /* v2595 · der Bestandsvergleich - auch im Abruf „Marktpreise" gespeichert (out.mpi reist mit) */
    try { out.vergleich = vergleichBestand(wb, out, bestand); if (out.mpi) out.mpi.vergleich = out.vergleich; }
    catch (e) { out.vergleich = null; }

    if (bb) {
      const leer = bb.zeilen.filter((z) => z && z.herkunft === 'leer_marktueblich').length;
      out.basis.bestandsbasis = {
        rohertrag_wohnen: bb.rohertrag, angleichung: Math.round(bb.faktor * 10000) / 10000,
        angleichung_leer: bb.faktor_leer != null ? Math.round(bb.faktor_leer * 10000) / 10000 : null,
        wohnungen: bb.zeilen.filter(Boolean).length, leer,
        band_unten_qm: basis.miete_band ? basis.miete_band.unten_qm : null,
        band_oben_qm: basis.miete_band ? basis.miete_band.oben_qm : null,
        markt_qm: zahl(basis.markt_qm),
        hinweis: 'Alle Stufen bauen auf der Miete des Bestands auf: je Wohnung die Ist-Miete im Band der Marktüblichkeit'
          + (basis.miete_band ? ' (' + pctQm(basis.miete_band.unten_qm) + ' bis ' + pctQm(basis.miete_band.oben_qm) + ')' : '')
          + ', darunter oder darüber die marktübliche Miete' + (zahl(basis.markt_qm) ? ' (' + pctQm(zahl(basis.markt_qm)) + ')' : '')
          + (leer ? ', leere Wohnungen mit dem Teil des Bestands-Rohertrags, der danach bleibt (höchstens die marktübliche Miete)' : '')
          + '. Mieterhöhung und Zielbild rechnen die Mehrmiete der Wohnung hinzu, soweit die neue Miete im Band liegt; außerhalb gilt auch dort die marktübliche Miete.',   /* v2936 · bis v2935 stand hier "die Bandkante" (vor v2600) */
      };
    }

    /* ── je Wohnung ─────────────────────────────────────────────────── */
    if (wl.length) {
      const flSum = wl.reduce((a, w) => a + Number(w.wfl), 0);
      const meaSum = wl.reduce((a, w) => a + (Number(w.mea_pct) > 0 ? Number(w.mea_pct) : 0), 0);
      const stufenAlle = ['bestand'].concat(STUFEN).filter((s) => out.haus[s]);
      /* Anteil am Haus: der Hauswert der Stufe nach dem Anteil am Rohertrag */
      /* v2488 · die Wertermittlungs-Miete je Wohnung und Stufe (Gewerbe: Browser-Miete) */
      const bbW = bb && wlB === wl ? bb : null;
      const mieteW = (w, i, s) => {
        const z = bbW ? bbW.zeilen[i] : null;
        return z ? ((s === 'mieterhoehung' || s === 'zielbild') && S558 ? mieteStufe(z, i, s) : stufenMiete(z, w, s, ovS(s))) : (zahl(w.miete_jahr && w.miete_jahr[s]) || 0);   /* v3150, v3287 */
      };
      const summeMiete = {};
      stufenAlle.forEach((s) => { summeMiete[s] = wl.reduce((a, w, i) => a + mieteW(w, i, s), 0); });
      out.wohnungen = wl.map((w, i) => {
        const r = { nr: w.nr || null, art: w.art || 'wohnen', wfl: Number(w.wfl), anteil_am_haus: {} };
        const z = bbW ? bbW.zeilen[i] : null;
        if (z) {
          r.basis_herkunft = z.herkunft; r.ist_qm = z.ist_qm; r.basis_qm = r2(z.basis / 12 / z.wfl);
          r.miete_jahr = {};
          stufenAlle.forEach((s) => { r.miete_jahr[s] = Math.round(mieteW(w, i, s)); });
        }
        stufenAlle.forEach((s) => {
          const mw = mieteW(w, i, s);
          r.anteil_am_haus[s] = summeMiete[s] > 0 ? Math.round(out.haus[s].wert * mw / summeMiete[s]) : null;
        });
        r.anteil = meaSum > 0 && Number(w.mea_pct) > 0 ? Number(w.mea_pct) / meaSum : Number(w.wfl) / flSum;
        r.anteil_herkunft = meaSum > 0 && Number(w.mea_pct) > 0 ? 'Miteigentumsanteil' : 'Fläche';
        return r;
      });
      /* v3283 · Mindermiete je Wohnung als boG (ImmoWertA 31 c) und der Anteil am Haus aus dem Ertragswert
         der Wohnung im Modell des Hauses - statt den ganzen Hauswert nach dem Rohertrag zu verteilen. */
      const mmCtx = { basis, S558, kapp: S558 ? { pct: S558.kappung_pct } : (basis.kappung || kappungFuer(ref.ags, ref.kappung_pct, basis.stichtag ? new Date(basis.stichtag + 'T00:00:00Z') : new Date())),
        st: basis.stichtag ? new Date(basis.stichtag + 'T00:00:00Z') : new Date(), lzsHaus: kB && kB.lzs ? Number(kB.lzs.pct) : Number(basis.ein.lzs_pct),
        rndHaus: kB && kB.nutzungsdauer ? Number(kB.nutzungsdauer.rnd) : null, nW: wl.filter((w) => w && w.art !== 'gewerbe').length };
      out.anteil_regel = 'Ertragswert der Wohnung im Modell des Hauses (Liegenschaftszins und Bewirtschaftungskosten des Hauses, Bodenwert nach Anteil) '
        + 'plus ihre Mietabweichung als besonderes objektspezifisches Grundstücksmerkmal (ImmoWertA 31 c); der Rest des Hauswerts nach dem Anteil am Rohertrag.';
      if (bbW) stufenAlle.forEach((s) => {
        const einS = s === 'bestand' ? basis.ein : (out.haus[s] && out.haus[s]._ein);
        /* v3287 · ungerundet: die Rundung des Hauswerts auf Tausend (bis ±500 €) wanderte sonst je Stufe verschieden in die Anteile */
        const H = out.haus[s] && (out.haus[s].wert_ungerundet != null ? out.haus[s].wert_ungerundet : out.haus[s].wert);
        if (!einS || H == null) return;
        const rnd = out.haus[s].rnd;
        const zeilen = out.wohnungen.map((r, i) => {
          if (r.art === 'gewerbe') return null;
          const w = wl[i], mw = mieteW(w, i, s);
          const b = mietBogWohnung(mmCtx, bbW.zeilen[i], w, s, mmCtx.lzsHaus, rnd);
          return { roh: wohnungImHaus(einS, basis.bodenwert, w, mw, r.anteil), bog: b, mw };
        });
        if (zeilen.some((x) => x && x.mw > 0 && x.roh == null)) return;   /* ohne Kern je Wohnung: wie bisher nach dem Rohertrag */
        const gew = out.wohnungen.reduce((a, r, i) => a + (r.art === 'gewerbe' ? (r.anteil_am_haus[s] || 0) : 0), 0);
        const sW = zeilen.reduce((a, x) => a + (x ? x.mw : 0), 0);
        const rest = H - gew - zeilen.reduce((a, x) => a + (x ? (x.roh || 0) + (x.bog ? x.bog.wert : 0) : 0), 0);
        out.wohnungen.forEach((r, i) => {
          const x = zeilen[i];
          if (!x) return;
          r.anteil_am_haus[s] = Math.round((x.roh || 0) + (x.bog ? x.bog.wert : 0) + (sW > 0 ? rest * x.mw / sW : 0));
          if (x.bog) { r.mietabweichung = r.mietabweichung || {}; r.mietabweichung[s] = Object.assign({}, x.bog, { satz: mietBogSatz(x.bog) }); }
        });
      });

      const auf = auftrag.aufteilung || {};
      if (auf.aktiv) {
        const brw = wb.land_value && wb.land_value.available ? wb.land_value.value_sqm : null;
        /* v3200c · Immobilienrichtwert Wohnungseigentum am Ort, EINMAL je Lauf (nur NRW, nur mit Koordinaten) */
        let irwEtw = null;
        try {
          if (/^05/.test(String(ref.ags || '')) && Number.isFinite(Number(wb.lat)) && Number.isFinite(Number(wb.lon))) {
            irwEtw = await Promise.race([IrwConnector.hole({ lat: Number(wb.lat), lon: Number(wb.lon), objektart: 'etw', anzahlWe: null }),
              new Promise((ok) => setTimeout(() => ok(null), 15000))]);
          }
        } catch (e) { irwEtw = null; }
        const aOut = { kosten_eur: zahl(auf.kosten_eur) || 0, kosten_herkunft: auf.kosten_herkunft || 'eigene Angabe',
                       je_stufe: {}, zins: {} };
        for (const s of stufenAlle) {
          const rnd = out.haus[s].rnd;
          const lzs = await etwZins(ref, brw, rnd);
          if (!lzs || lzs.wert == null) { aOut.zins[s] = { verfuegbar: false, grund: (lzs && (lzs.rueckfrage || lzs.hinweis)) || 'kein Zins für Wohnungseigentum' }; continue; }
          const bwk = await etwBwk(ref, lzs);
          /* v2431 · der AUSSCHUSS, nicht der Herausgeber: in NRW veroeffentlicht der
             Obere Gutachterausschuss die Zinssaetze aller oertlichen Ausschuesse
             (Grundstuecksmarktdaten NRW, Namensnennung) - der Satz selbst ist der
             des oertlichen Ausschusses (Bielefeld: Zweig we_v, 2,9 %). */
          aOut.zins[s] = { pct: Number(lzs.wert), stufe: lzs.stufe || null, quelle: lzs.quelle || null,
            ausschuss: lzs.ausschuss || null, zweig: lzs.zweig || null, ebene: lzs.register_ebene || lzs.ebene || null,
            etikett: lzs.zins_herkunft ? lzs.zins_herkunft.etikett : null, bwk_quote_pct: bwk ? bwk.pct : null };
          let summe = 0, vollst = true;
          out.wohnungen.forEach((r, i) => {
            const w = wl[i];
            const mw = mieteW(w, i, s);
            if (r.art === 'gewerbe') { summe += r.anteil_am_haus[s] || 0; r.als_etw = r.als_etw || {}; r.als_etw[s] = null; return; }
            const e = etwEingabe(basis, ref, w, mw, lzs, bwk, rnd, r.anteil);
            /* v3150 · Stufe Mieterhoehung: die Mindermiete der Wohnung bis zur Zielmiete auch als Eigentumswohnung
               v3283 · auch im BESTAND (ImmoWertA 31 c), abgezinst mit dem Zins fuer Wohnungseigentum - bis hier
               rechnete die Eigentumswohnung im Bestand mit der marktueblichen Miete ohne Abzug */
            if (bbW) {
              const b = mietBogWohnung(mmCtx, bbW.zeilen[i], w, s, Number(lzs.wert), rnd);
              if (b && b.wert) {
                e.ein.bog_posten = [{ pos: MM_POS[b.art] || MM_POS.underrent, wert: b.wert }];
                r.mietabweichung_etw = r.mietabweichung_etw || {};
                r.mietabweichung_etw[s] = Object.assign({}, b, { satz: mietBogSatz(b) });
              }
            }
            const k = mw > 0 ? ErtragswertService.ertragswert(e.ein, e.bw) : null;
            const wert = k && k.vollstaendig ? k.wert : null;
            r.als_etw = r.als_etw || {};
            r.als_etw[s] = wert;
            if (wert == null) vollst = false; else summe += wert;
            /* v3200 · führend: Vergleichswert der Wohnung (Merkmale der Wohnung, RND dieser Stufe) */
            r.vergleich_etw = r.vergleich_etw || {};
            r.vergleich_etw[s] = vergleichWohnung(ref, wb, w, rnd, auftrag, mw, irwEtw);
          });
          const pot = Math.round(summe - aOut.kosten_eur - out.haus[s].wert);
          aOut.je_stufe[s] = { summe: Math.round(summe), vollstaendig: vollst, potenzial: pot,
            /* v2431 · Marcel 19.10.2026: ein negatives Aufteilungspotenzial erscheint
               nicht als Zahl, sondern mit seiner Erklaerung */
            negativ: pot < 0, unter_haus: Math.round(summe) < Math.round(out.haus[s].wert) };
        }
        const neg = Object.keys(aOut.je_stufe).filter((s) => aOut.je_stufe[s].negativ);
        if (neg.length) aOut.negativ_hinweis = negativHinweis(aOut, out, neg);
        aOut.hinweis = 'Jede Wohnung als Eigentumswohnung mit dem Liegenschaftszins für Wohnungseigentum und ihrem Bodenwertanteil'
          + (out.wohnungen.some((r) => r.anteil_herkunft === 'Miteigentumsanteil') ? ' (Miteigentumsanteil)' : ' (nach Wohnfläche)')
          + '. Gewerbeeinheiten gehen mit ihrem Anteil am Hauswert in die Summe.';
        out.aufteilung = aOut;
      }

      /* ── v2541/v2542 · je Wohnung: Marktpreisindikation als Eigentumswohnung ──
         Aus den Angeboten für WOHNUNGEN am Ort (Segment „Wohnung", eigener Abruf
         je Flächenklasse, gecacht), derselbe Kern wie der Bericht einer ETW, mit
         Spanne aus den Quartilen. Nur im abgerechneten Abruf „Marktpreise"
         (auftrag.markt) - jeder Abruf je Flächenklasse ist ein Marktdaten-Aufruf
         (Marcel 20.10.2026: „kostet Guthaben"). Unabhängig davon, ob das Haus als
         „aufgeteilt" markiert ist: Marcel will den Wert je Wohnung sehen. */
      if (auftrag.markt === true) try {
        const cache = {};
        const mit = (p, ms) => Promise.race([p, new Promise((ok) => setTimeout(() => ok(null), ms))]);
        let summeB = 0, summeZ = 0, summeL = 0, summeH = 0, vollB = true, vollZ = true, ersteSale = null;
        for (let i = 0; i < out.wohnungen.length; i++) {
          const r = out.wohnungen[i];
          if (r.art === 'gewerbe') continue;
          const fl = Math.round(Number(r.wfl));
          const refW = refWohnungEtw(fl);   /* v3265 · dieselbe Wohnungs-Referenz wie der Weg aus dem letzten Abruf */
          const key = String(Math.round(fl / 10));
          if (!(key in cache)) {
            cache[key] = await mit(MarketAnalysisService.saleLevel(Object.assign({}, ref, refW)).catch(() => null), 20000);
          }
          const saleW = cache[key];
          if (saleW && !ersteSale) ersteSale = saleW;
          const wbW = { ref: Object.assign({}, ref, refW), sale: saleW, rent: wb.rent, land_value_roh: null };
          const b = mpiAngebote(wbW, null);
          const z = out.haus.zielbild ? mpiAngebote(wbW, ZIELBILD_REF()) : null;
          r.mpi_etw = { bestand: b ? b.wert : null, low: b ? b.low : null, high: b ? b.high : null, zielbild: z ? z.wert : null,
            median_qm: saleW ? Math.round(Number(saleW.median_per_sqm) || 0) || null : null,
            q25_qm: saleW && saleW.q25_per_sqm != null ? Math.round(saleW.q25_per_sqm) : null,
            q75_qm: saleW && saleW.q75_per_sqm != null ? Math.round(saleW.q75_per_sqm) : null,
            abschlag_pct: b ? b.abschlag_pct : null, stichprobe: saleW ? (saleW.sample_size ?? null) : null };
          if (b) { summeB += b.wert; summeL += (b.low != null ? b.low : b.wert); summeH += (b.high != null ? b.high : b.wert); } else vollB = false;
          if (out.haus.zielbild) { if (z) summeZ += z.wert; else vollZ = false; }
        }
        out.etw_markt = { summe_bestand: vollB ? Math.round(summeB) : null, summe_low: vollB ? Math.round(summeL) : null, summe_high: vollB ? Math.round(summeH) : null,
          summe_zielbild: out.haus.zielbild && vollZ ? Math.round(summeZ) : null,
          median_qm: ersteSale ? Math.round(Number(ersteSale.median_per_sqm) || 0) || null : null,
          q25_qm: ersteSale && ersteSale.q25_per_sqm != null ? Math.round(ersteSale.q25_per_sqm) : null,
          q75_qm: ersteSale && ersteSale.q75_per_sqm != null ? Math.round(ersteSale.q75_per_sqm) : null,
          stichprobe: ersteSale ? (ersteSale.sample_size ?? null) : null,
          hinweis: 'Je Wohnung: Angebotspreise für Eigentumswohnungen am Ort (gleiches Baujahr, Flächenklasse der Wohnung) × Wohnfläche, Objektfaktoren und Abschlag auf Angebotspreise wie im Bericht; Spanne aus dem unteren und oberen Quartil; Zielbild mit Zustand „modernisiert".' };
        if (out.aufteilung) out.aufteilung.mpi_etw = out.etw_markt;
      } catch (e) { out.etw_markt = { fehler: 'Marktpreisindikation je Wohnung nicht verfügbar' }; }

      /* ══ v3265 · ANGEBOTSNIVEAU FÜR WOHNUNGEN AUS DEM LETZTEN ABRUF ═══════════
         Marcel 09.11.2026: „wenn aufgeteilt, nach Angebotspreisen die einzelnen Wohnungen
         bewerten … nach dem Vergleichswertverfahren, der Ertragswert nur noch stützend".
         Ohne abgerechneten Abruf (auftrag.markt) gab es bis hier keinen Angebotswert je
         Wohnung - der Aufteilerwert fiel auf den Ertragswert zurück, obwohl für dasselbe
         Objekt ein Abruf „Marktpreise" mit dem Angebotsniveau für Wohnungen am Ort vorlag.
         KEINE NEUE DATENQUELLE: die Route liest den jüngsten Abruf dieses Nutzers für dieses
         Objekt (mb.potenzial_abrufe, Feld wohnungen[].mpi_etw: Median, Quartile, Zahl der
         Angebote je Flächenklasse) und gibt ihn als auftrag._etw_abruf mit. Gerechnet wird
         mit DEMSELBEN Kern wie im Abruf (ValuationService.compute, Abschlag nach
         lib/angebot_abschlag.js) - nur die Flächenklasse der Wohnung muss zum Abruf passen
         (± 5 m² wie dort, round(Fläche/10)); sonst kein Wert und der Ertragswert ersatzweise. */
      if (auftrag.markt !== true && out.aufteilung && auftrag._etw_abruf) {
        for (const r of out.wohnungen) {
          if (r.art === 'gewerbe' || r.mpi_etw) continue;
          const m = etwAusAbruf(wb, ref, r, auftrag._etw_abruf, !!out.haus.zielbild);
          if (m) r.mpi_etw = m;
        }
        out.aufteilung.etw_abruf = { abgerufen_am: auftrag._etw_abruf.abgerufen_am || null,
          wohnungen: out.wohnungen.filter((r) => r.mpi_etw && r.mpi_etw.quelle === 'abruf').length };
      }

      /* ══ v3200 · AUFTEILERWERT ════════════════════════════════════════════════
         Je Wohnung das führende Verfahren: 1. Vergleichswert aus dem amtlichen Vergleichsfaktor,
         2. sonst Vergleichswert aus Angeboten (Abschlag wie im Bericht, gekennzeichnet),
         3. sonst der Ertragswert als Eigentumswohnung. Stützend bleibt der Ertragswert als ETW
         (Summe in je_stufe). Gewerbe geht mit seinem Anteil am Haus ein.
         Aufteilerwert = Summe − Kosten der Aufteilung; Potenzial = Aufteilerwert − Haus. */
      /* v3265 · der Vergleichswert je Wohnung führt nur, wenn ALLE Wohnungen eine Wohnfläche haben
         (Marcel: „nur wenn alle Wohnungen angegeben sind") - eine Summe über einen Teil der Wohnungen
         wäre kein Aufteilerwert. Dann bleibt es bei der Summe der Ertragswerte (wie ohne Vergleichswert). */
      const ohneFl = (Array.isArray(auftrag.wohnungen) ? auftrag.wohnungen : [])
        .filter((w) => w && w.art !== 'gewerbe' && !(Number(w.wfl) > 0)).length;
      if (out.aufteilung && ohneFl > 0) {
        out.aufteilung.aufteiler_gesperrt = { ohne_flaeche: ohneFl,
          grund: (ohneFl === 1 ? 'Eine Wohnung hat' : ohneFl + ' Wohnungen haben') + ' keine Wohnfläche — der Vergleichswert je Wohnung führt erst, wenn alle Wohnungen eine Wohnfläche haben.' };
      }
      if (out.aufteilung && ohneFl === 0) {
        const A = out.aufteilung;
        A.aufteiler = aufteilerRechnen(out.wohnungen, A.je_stufe, out.haus, A.kosten_eur, stufenAlle);   /* v3322 · eigene Funktion, Prüfer B66 */
        A.aufteiler_hinweis = 'Aufteilerwert: je Wohnung das führende Verfahren - Vergleichswert aus dem amtlichen Vergleichsfaktor '
          + 'des Gutachterausschusses (§ 20 ImmoWertV, Merkmale der Wohnung), sonst aus Angebotspreisen für Eigentumswohnungen '
          + '(abzüglich Angebotsabschlag; indikativ, aus Angebotspreisen abgeleitet), sonst ersatzweise der Ertragswert als Eigentumswohnung. Stützend: der Ertragswert jeder Wohnung '
          + 'mit dem Liegenschaftszins für Wohnungseigentum. Abgezogen sind die Kosten der Aufteilung.';
      }
    }

    /* ── v2542 · die Marktdaten des Abrufs, vollständig: Kauf €/m² (Haus-Segment),
       Angebotsmiete €/m², je mit Quartilen und Zahl der Angebote ─────────────── */
    if (auftrag.markt === true) {
      const s = wb.sale || {}, rt = wb.rent || {};
      const rnd0 = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
      const rnd2 = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
      out.markt = {
        kauf_haus: s.median_per_sqm ? { median_qm: rnd0(s.median_per_sqm), q25_qm: rnd0(s.q25_per_sqm), q75_qm: rnd0(s.q75_per_sqm),
          angebote: s.sample_size ?? null, radius_km: s.used_radius_m ? s.used_radius_m / 1000 : null, gruppe: s.comparable_group || null, segment: ref.property_type || null } : null,
        miete: rt.median_per_sqm ? { median_qm: rnd2(rt.median_per_sqm), q25_qm: rnd2(rt.q25_per_sqm), q75_qm: rnd2(rt.q75_per_sqm),
          angebote: rt.sample_size ?? null, radius_km: rt.used_radius_m ? rt.used_radius_m / 1000 : null } : null,
        kauf_etw: out.etw_markt && out.etw_markt.median_qm ? { median_qm: out.etw_markt.median_qm, q25_qm: out.etw_markt.q25_qm,
          q75_qm: out.etw_markt.q75_qm, angebote: out.etw_markt.stichprobe } : null,
        abschlag_pct: out.mpi && out.mpi.angebote ? out.mpi.angebote.abschlag_pct : null,
        stand: new Date().toISOString(),
      };
    }
    return out;
  },
};

export default PotenzialService;

/* v2854 · fuer den Pruefer (tools/wertermittlung-pruefen.mjs B54): dieselbe Stufenrechnung */
export { eineStufe as _eineStufe };
export { stufe558 as _stufe558 };   /* v3150 · Pruefer B61 */
export { stufeNeuvermietung as _stufeNeuvermietung };   /* v3152 · Pruefer B62 */
export { etwAusAbruf as _etwAusAbruf, etwNiveauAusAbruf as _etwNiveauAusAbruf, aufteilerBezeichnung as _aufteilerBezeichnung, aufteilerRechnen as _aufteilerRechnen };   /* v3322 · B66 */   /* v3265 · Pruefer B63 */
/* v2988 · fuer Knotenprobe und Pruefer: Miete nach Modernisierung, Stufenmiete, Bestandsbasis */
export { mieteNachModernisierung as _mieteNachModernisierung, stufenMiete as _stufenMiete, bestandsBasis as _bestandsBasis };
export { zielbildPrognose as _zielbildPrognose, bandZielbild as _bandZielbild };   /* v3343 · Pruefer B70 */
