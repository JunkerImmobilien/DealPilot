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
             median_qm: mv.basis_median_sqm ?? null, gegenprobe: v.amtliche_gegenprobe || null };
  } catch (e) { return null; }
}
const ZIELBILD_REF = () => ({ condition: 'modernisiert', modernization: 'umfassend modernisiert',
  modernization_year: new Date().getFullYear(), bom_eur: null, bom_grund: null });

export const KENNZEICHNUNG = 'Potenzialwert nach Mieterhöhung bzw. Zielbild, keine Verkehrswertermittlung.';
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
    let qm, herkunft, istQm = null;
    if (ist > 0) {
      istQm = r2(ist / 12 / wfl);
      const r = mieteNachBand(istQm, band, markt);
      qm = r.qm != null ? r.qm : istQm;
      herkunft = herkunftNachBand(r);   /* v2600 · ausserhalb: Anker (ueber_band/unter_band) */
    } else {
      qm = markt; herkunft = 'leer_marktueblich';
    }
    if (!(qm > 0)) return null;
    return { wfl, ist, ist_qm: istQm, qm, herkunft, roh: herkunft === 'ist_im_band' ? ist : qm * wfl * 12,   /* v2541 · im Band die Vertragsmiete */
             kappe: band && band.oben_qm > 0 ? band.oben_qm * wfl * 12 : Infinity };
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
/** Wertermittlungs-Miete einer Wohnung in der Stufe s. */
function stufenMiete(z, w, s) {
  if (!z) return null;
  if (s === 'bestand') return z.basis;
  const m = zahl(w.miete_jahr && w.miete_jahr[s]);
  if (m == null || !(m > z.ist)) return z.basis;           /* keine Anhebung -> Basis */
  /* leer: max(Basis, Stufenmiete); vermietet: die Mehrmiete gegen die eigene gepruefte Miete */
  const bezug = z.herkunft === 'leer_marktueblich' ? z.basis : z.roh;
  return z.basis + Math.max(0, Math.min(m, z.kappe) - bezug);
}

function eineStufe(basis, ref, basisKern, miete, plus) {
  const ein = Object.assign({}, basis.ein);
  const rndInfo = rndEinstellen(ein, ref, basisKern, plus);
  if (miete != null && miete >= 0) {
    bwkNachziehen(ein, miete);
    ein.miete_markt_jahr = Math.round(miete);
    ein.miete_aufteilung = null;   /* v2520 · die Aufteilung vermietet/leer gilt nur im Bestand */
    /* v2600 · E2 · die Stufe setzt die Miete selbst an - die Mietabweichung des Bestands (boG)
       gilt dort nicht mehr (sonst doppelt, Prompt-Regel 5). Der Leerstandsabzug bleibt. */
    if (Array.isArray(ein.bog_posten)) ein.bog_posten = ein.bog_posten.filter((x) => !/Mietabweichung/.test(String(x.pos || '')));
    ein.vorlaeufig_vor_bog = false;
  }
  let k = ErtragswertService.ertragswert(ein, basis.bodenwert);
  /* Untergrenze: die Stufe rechnet nie mit einer kürzeren RND als der Bestand. */
  const rB = basisKern && basisKern.nutzungsdauer ? basisKern.nutzungsdauer.rnd : null;
  if (k && k.nutzungsdauer && rB != null && k.nutzungsdauer.rnd < rB) {
    ein.rnd_jahre = rB; ein.mod_punkte = null;
    k = ErtragswertService.ertragswert(ein, basis.bodenwert);
  }
  const z = kernZusammenfassung(k);
  if (z) { z.mod_punkte = rndInfo.mod_punkte; z.mod_punkte_plus = rndInfo.plus; z.miete_wohnen_jahr = ein.miete_markt_jahr; }
  return z;
}

/** Zins für Wohnungseigentum aus derselben Kaskade (A–E, N) wie der Bericht. */
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
    const varianten = Array.isArray(auftrag.varianten) ? auftrag.varianten : [];
    const wl = (Array.isArray(auftrag.wohnungen) ? auftrag.wohnungen : []).filter((w) => w && Number(w.wfl) > 0);
    /* v2488 · ohne Wohnungsliste (ETW, Einzelobjekt): EINE Wohnung = das Objekt,
       Ist aus der Eingabe des Berichts, Stufenmiete aus der Variante. */
    const wlB = wl.some((w) => w.art !== 'gewerbe') ? wl : [{ art: 'wohnen', wfl: zahl(basis.wohnflaeche_wohnen) || zahl(basis.ein.wohnflaeche_qm),
      miete_jahr: Object.assign({ bestand: (!ref.vacancy && zahl(ref.monthly_net_rent) > 0) ? zahl(ref.monthly_net_rent) * 12 : 0 },
        ...varianten.filter((v) => v && STUFEN.indexOf(v.key) >= 0).map((v) => ({ [v.key]: zahl(v.miete_wohnen_jahr) }))) }];
    const bb = bestandsBasis(basis, wlB);
    const anhebungN = (s) => (bb ? bb.zeilen.filter((z, i) => z && stufenMiete(z, wlB[i], s) > z.basis + 0.5).length : 0);
    bestand.anhebung_jahr = 0;
    for (const v of varianten) {
      if (!v || STUFEN.indexOf(v.key) < 0) continue;
      let m = zahl(v.miete_wohnen_jahr);
      if (m == null) continue;
      if (bb) m = bb.zeilen.reduce((a, z, i) => a + (z ? stufenMiete(z, wlB[i], v.key) : 0), 0);
      else m = Math.max(m, Number(basis.ein.miete_markt_jahr) || 0);   /* ohne Basis: nie unter dem Bestand */
      const z = eineStufe(basis, ref, kB, m, zahl(v.mod_punkte_plus) || 0);
      if (z) {
        z.kosten = zahl(v.kosten) || 0;
        z.anhebung_jahr = Math.round(z.miete_wohnen_jahr - bestand.miete_wohnen_jahr);   /* v2488 */
        z.anhebung_wohnungen = anhebungN(v.key);
        out.haus[v.key] = z;
      }
    }
    /* ── v2541 · Marktpreisindikation je Stufe (zwei Wege, s. o.) ─────────── */
    {
      const V = wb.valuation || null;
      const mvB = (V && V.market_value && V.market_value.estimated != null)
        ? { wert: V.market_value.estimated, low: V.market_value.low ?? null, high: V.market_value.high ?? null,
            abschlag_pct: V.market_value.angebot_abschlag ? V.market_value.angebot_abschlag.pct : null,
            abschlag_herkunft: V.market_value.angebot_abschlag ? V.market_value.angebot_abschlag.herkunft : null,
            abschlag_kurz: V.market_value.angebot_abschlag ? (V.market_value.angebot_abschlag.kurz || null) : null,   /* v2578 */
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
      };
      for (const s of ['bestand'].concat(STUFEN)) {
        const h = out.haus[s]; if (!h) continue;
        const a = s === 'zielbild' ? mvZ : mvB;
        h.mpi_angebote = a ? a.wert : null;
        h.mpi_angebote_spanne = a && a.low != null ? [a.low, a.high] : null;
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
          + ', darunter oder darüber die Bandkante' + (leer ? ', leere Wohnungen mit dem Teil des Bestands-Rohertrags, der danach bleibt (höchstens die marktübliche Miete)' : '')
          + '. Mieterhöhung und Zielbild rechnen die Mehrmiete der Wohnung hinzu, oberhalb des Bandes nichts.',
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
        return z ? stufenMiete(z, w, s) : (zahl(w.miete_jahr && w.miete_jahr[s]) || 0);
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

      const auf = auftrag.aufteilung || {};
      if (auf.aktiv) {
        const brw = wb.land_value && wb.land_value.available ? wb.land_value.value_sqm : null;
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
            const k = mw > 0 ? ErtragswertService.ertragswert(e.ein, e.bw) : null;
            const wert = k && k.vollstaendig ? k.wert : null;
            r.als_etw = r.als_etw || {};
            r.als_etw[s] = wert;
            if (wert == null) vollst = false; else summe += wert;
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
          const refW = { property_type: 'etw', living_area: fl, units: 1, plot_area: null, garden_area: null,
            garages: 0, outdoor_parking: 0, purchase_price: null, monthly_net_rent: null, bom_eur: null, bom_grund: null, floor: null, vacancy: false };
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
