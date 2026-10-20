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
import { mieteNachBand } from './CrossCheckService.js';   /* v2488 · dieselbe Bandregel wie der Bestand */

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
      herkunft = r.fuehrt ? 'ist_im_band' : (r.lage === 'ueber' ? 'obere_kante' : 'untere_kante');
    } else {
      qm = markt; herkunft = 'leer_marktueblich';
    }
    if (!(qm > 0)) return null;
    return { wfl, ist, ist_qm: istQm, qm, herkunft, roh: qm * wfl * 12,
             kappe: band && band.oben_qm > 0 ? band.oben_qm * wfl * 12 : Infinity };
  });
  const summeRoh = zeilen.reduce((a, z) => a + (z ? z.roh : 0), 0);
  if (!(summeRoh > 0) || !(rB > 0)) return null;
  /* Der Unterschied zwischen Haus und Wohnungen entsteht beim Leerstand: der
     Bestand teilt die Ist-Miete der vermieteten Wohnungen durch die GESAMTE
     Wohnflaeche (Demo-MFH 5,99 statt 7,31 €/m²). Er geht deshalb zuerst auf die
     leeren Wohnungen - hoechstens bis zur marktueblichen Miete, nie unter null -,
     erst der Rest anteilig auf alle. So bleibt die vermietete Wohnung bei ihrer
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
      out.grund = (cc.notes && cc.notes.find((n) => /Ertragswert/i.test(n)))
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
    }
    return out;
  },
};

export default PotenzialService;
