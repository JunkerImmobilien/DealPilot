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
    for (const v of varianten) {
      if (!v || STUFEN.indexOf(v.key) < 0) continue;
      const m = zahl(v.miete_wohnen_jahr);
      if (m == null) continue;
      const z = eineStufe(basis, ref, kB, m, zahl(v.mod_punkte_plus) || 0);
      if (z) { z.kosten = zahl(v.kosten) || 0; out.haus[v.key] = z; }
    }

    /* ── je Wohnung ─────────────────────────────────────────────────── */
    const wl = (Array.isArray(auftrag.wohnungen) ? auftrag.wohnungen : []).filter((w) => w && Number(w.wfl) > 0);
    if (wl.length) {
      const flSum = wl.reduce((a, w) => a + Number(w.wfl), 0);
      const meaSum = wl.reduce((a, w) => a + (Number(w.mea_pct) > 0 ? Number(w.mea_pct) : 0), 0);
      const stufenAlle = ['bestand'].concat(STUFEN).filter((s) => out.haus[s]);
      /* Anteil am Haus: der Hauswert der Stufe nach dem Anteil am Rohertrag */
      const summeMiete = {};
      stufenAlle.forEach((s) => { summeMiete[s] = wl.reduce((a, w) => a + (zahl(w.miete_jahr && w.miete_jahr[s]) || 0), 0); });
      out.wohnungen = wl.map((w) => {
        const r = { nr: w.nr || null, art: w.art || 'wohnen', wfl: Number(w.wfl), anteil_am_haus: {} };
        stufenAlle.forEach((s) => {
          const mw = zahl(w.miete_jahr && w.miete_jahr[s]) || 0;
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
          aOut.zins[s] = { pct: Number(lzs.wert), stufe: lzs.stufe || null, quelle: lzs.quelle || null,
            etikett: lzs.zins_herkunft ? lzs.zins_herkunft.etikett : null, bwk_quote_pct: bwk ? bwk.pct : null };
          let summe = 0, vollst = true;
          out.wohnungen.forEach((r, i) => {
            const w = wl[i];
            const mw = zahl(w.miete_jahr && w.miete_jahr[s]) || 0;
            if (r.art === 'gewerbe') { summe += r.anteil_am_haus[s] || 0; r.als_etw = r.als_etw || {}; r.als_etw[s] = null; return; }
            const e = etwEingabe(basis, ref, w, mw, lzs, bwk, rnd, r.anteil);
            const k = mw > 0 ? ErtragswertService.ertragswert(e.ein, e.bw) : null;
            const wert = k && k.vollstaendig ? k.wert : null;
            r.als_etw = r.als_etw || {};
            r.als_etw[s] = wert;
            if (wert == null) vollst = false; else summe += wert;
          });
          aOut.je_stufe[s] = { summe: Math.round(summe), vollstaendig: vollst,
            potenzial: Math.round(summe - aOut.kosten_eur - out.haus[s].wert) };
        }
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
