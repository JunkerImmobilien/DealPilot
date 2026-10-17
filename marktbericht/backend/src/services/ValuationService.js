// ValuationService.js — Marktwert + Renditekennzahlen.
// Formeln exakt nach Auftrag; Faktoren transparent & einzeln ausgewiesen.
import { round } from '../lib/stats.js';
import { istGewerbe, istGrundstueck } from '../lib/marktsegment.js';   /* v2241 */
import { groessenanpassung as ukAusRegister, naeherung as ukNaeherung } from '../lib/umrechnung_flaeche.js';   /* v2282, v2288 */

// Zustands-/Energie-/Etagen-Faktoren (dokumentiert, anpassbar)
// Zustand robust gemappt inkl. Synonyme & DealPilot-Werte ("gut", "saniert", ...).
const CONDITION_FACTOR = {
  erstbezug: 1.08, neuwertig: 1.08, neu: 1.08, kernsaniert: 1.07,
  saniert: 1.05, modernisiert: 1.04, 'sehr gut': 1.04, sehr_gut: 1.04, 'sehr_gut': 1.04,
  gut: 1.0, gepflegt: 1.0, normal: 0.99, mittel: 0.96,
  renovierungsbeduerftig: 0.88, 'renovierungsbedürftig': 0.88,
  sanierungsbeduerftig: 0.82, 'sanierungsbedürftig': 0.82, unsaniert: 0.92, abrissreif: 0.70,
  /* v1444 · Backlog v22 Punkt 17: die Werte der App-Auswahl ds2_zustand kamen hier
     nicht vor und fielen still auf 1,0 - „neubau" wie „gepflegt", und
     „stark sanierungsbeduerftig" ebenso. Jetzt eindeutig zugeordnet. */
  neubau: 1.08, stark_sanierungsbeduerftig: 0.82, 'stark sanierungsbedürftig': 0.82,
};
// Ausstattungsqualität (einfach … luxuriös)
const QUALITY_FACTOR = { einfach: 0.93, normal: 1.0, gehoben: 1.06, luxurioes: 1.12, 'luxuriös': 1.12, luxus: 1.12 };
// Modernisierungsgrad
const MODERNIZATION_FACTOR = {
  kernsaniert: 1.08, 'umfassend modernisiert': 1.05, umfassend: 1.05,
  teilmodernisiert: 1.02, teilweise: 1.02, keine: 1.0,
  unsaniert: 0.95, original: 0.95, renovierungsstau: 0.90,
};
/* v2241 · Zustaende, die einen Instandsetzungsbedarf ausdruecken. Liegt
   dafuer ein Kostenbetrag (bOM) vor, entfaellt ihr Abschlag. */
const MANGEL_ZUSTAND = new Set(['renovierungsbeduerftig', 'renovierungsbedürftig', 'sanierungsbeduerftig',
  'sanierungsbedürftig', 'unsaniert', 'abrissreif', 'stark_sanierungsbeduerftig', 'stark sanierungsbedürftig']);
const MANGEL_MODERNISIERUNG = new Set(['unsaniert', 'original', 'renovierungsstau']);
const ENERGY_FACTOR = { 'A+': 1.06, A: 1.05, B: 1.03, C: 1.01, D: 1.0, E: 0.98, F: 0.95, G: 0.92, H: 0.9 };

const _norm = (v) => String(v ?? '').toLowerCase().trim();
const _lookup = (map, v, dflt = 1.0) => (map[_norm(v)] ?? dflt);
const _clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function floorFactor(floor, propertyType) {
  if (propertyType === 'haus' || floor == null) return 1.0;
  if (floor === 0) return 0.97;       // EG
  if (floor >= 4) return 1.02;        // höhere Lage leicht +
  return 1.0;
}

const _roundNice = (v) => {
  if (v == null) return v;
  const step = v >= 500000 ? 5000 : v >= 100000 ? 1000 : 500;
  return Math.round(v / step) * step;
};

/* ═══ v2241 · VERGLEICH FUER GEWERBE ════════════════════════════════════
   Nur mit Angeboten aus dem Segment Gewerbe DERSELBEN Klasse
   (MarketAnalysisService setzt `segment: 'gewerbe'`). Fehlt das, entfaellt
   der Vergleich — mit Grund, ohne Ersatz.

   Die Objektfaktoren oben (Zustand, Ausstattung, Energie, Etage, Balkon,
   Aufzug, Stellplaetze, Grundstuecks-Mehrflaeche) sind Festlegungen fuer
   WOHNraum. Fuer ein Buero oder eine Halle gibt es keine belegte
   Entsprechung; sie werden deshalb nicht angewandt. Gerechnet wird
   Median x Flaeche, Spanne aus den Quartilen, dazu ein bOM-Betrag, wenn
   einer vorliegt. Es bleibt eine Angebotsindikation (§ 25 Abs. 1:
   Kaufpreise, nicht Angebote) und heisst auch so. */
function gewerbeVergleich(ref, sale, area, out) {
  const ok = sale && sale.segment === 'gewerbe' && Number(sale.median_per_sqm) > 0;
  /* Mit Wohnteil (Geschaeftshaus mit Wohnungen) gibt es keine EINE
     Vergleichsklasse: der Gewerbemedian auf die Wohnflaeche waere
     derselbe Fehler wie bisher umgekehrt. */
  const _wohnteil = ref.gewerbe && Number(ref.gewerbe.wfl_wohnen) > 0;
  if (ok && area && _wohnteil) {
    out.vergleichswert_gesperrt = { grund: 'gemischte_nutzung',
      hinweis: 'Vergleichswert entfällt: das Objekt verbindet Gewerbe- und Wohnflächen ('
        + Math.round(Number(ref.gewerbe.wfl_wohnen)) + ' m² Wohnen). Für diese Mischung gibt es keine '
        + 'einheitliche Vergleichsgruppe; maßgeblich ist der Ertragswert.' };
    out.notes.push(out.vergleichswert_gesperrt.hinweis);
    return out;
  }
  if (!ok || !area) {
    out.vergleichswert_gesperrt = {
      grund: !ok ? 'keine_gewerbe_vergleichsdaten' : 'flaeche_fehlt',
      hinweis: !ok
        ? ('Vergleichswert entfällt: für dieses Gewerbeobjekt'
          + (ref.gewerbe_art ? '' : ' (Gewerbeart nicht bestimmt)')
          + ' liegen keine Vergleichsdaten aus dem Gewerbemarkt derselben Nutzung vor. '
          + 'Wohnungs- und Hauspreise sind dafür kein Maßstab und werden nicht ersatzweise verwendet.')
        : 'Vergleichswert entfällt: die Nutzfläche fehlt.',
    };
    out.notes.push(out.vergleichswert_gesperrt.hinweis);
    return out;
  }
  const base = Number(sale.median_per_sqm);
  const _b = Number(ref.bom_eur);
  const kosten = (ref.bom_eur != null && Number.isFinite(_b) && _b !== 0) ? Math.round(_b) : 0;
  const ev = base * area + kosten;
  out.factors = { location_factor: 1.0, condition_factor: 1.0, quality_factor: 1.0,
    modernization_factor: 1.0, object_adjustment: 1.0, amenity_factor: 1.0, energy_factor: 1.0,
    floor_factor: 1.0, vacancy_factor: 1.0, parking_value_eur: 0, land_excess_value_eur: 0,
    ...(kosten ? { kostenabzug_eur: kosten, kostenabzug_grund: ref.bom_grund || null } : {}) };
  out.market_value.estimated = _roundNice(ev);
  if (sale.q25_per_sqm != null && sale.q75_per_sqm != null) {
    out.market_value.low = _roundNice(sale.q25_per_sqm * area + kosten);
    out.market_value.high = _roundNice(sale.q75_per_sqm * area + kosten);
    out.market_value.range_basis = 'quartile';
  } else {
    /* Keine erfundene ±10-%-Spanne fuer Gewerbe: ohne Quartile keine Spanne. */
    out.market_value.low = null; out.market_value.high = null;
    out.market_value.range_basis = 'keine';
  }
  out.market_value.basis_median_sqm = round(base / 5, 0) * 5;
  out.market_value.confidence = sale.confidence;
  out.market_value.segment = 'gewerbe';
  out.market_value.gewerbe_klasse = sale.gewerbe_klasse || null;
  out.market_value.bezeichnung = 'Marktpreisindikation aus Gewerbeangeboten';
  const dc = sale.confidence != null ? sale.confidence : 0.5;
  /* Ohne Objektfaktoren und mit Angebotspreisen: gedaempft wie die
     pauschale Spanne im Wohnweg (0,82), nie hoeher als die Stichprobe. */
  const _conf = _clamp(dc * 0.82, 0, 0.98);
  out.market_value.confidence_pct = Math.round(_conf * 100);
  out.market_value.confidence_label = out.market_value.confidence_pct >= 85 ? 'Sehr hoch'
    : out.market_value.confidence_pct >= 70 ? 'Hoch' : out.market_value.confidence_pct >= 55 ? 'Mittel' : 'Niedrig';
  out.market_value.confidence_parts = { marktdaten: round(dc, 2), eingaben: null, streuung: 0.82 };
  out.notes.push('Gewerbe: Marktpreisindikation aus Angeboten der Klasse '
    + (sale.gewerbe_klasse || 'Gewerbe') + ' (Median ' + Math.round(base).toLocaleString('de-DE')
    + ' €/m² × ' + Math.round(area).toLocaleString('de-DE') + ' m²). Die Objektfaktoren für Wohnraum '
    + '(Zustand, Ausstattung, Energie, Etage, Stellplätze) sind nicht angewandt — für Gewerbe gibt es dafür '
    + 'keine belegten Ansätze. Angebotspreise sind keine Kaufpreise (§ 25 Abs. 1 ImmoWertV).');
  if (kosten) {
    out.notes.push((kosten < 0 ? 'Abzug' : 'Zuschlag') + ' besondere objektspezifische Grundstücksmerkmale: '
      + (kosten < 0 ? '− ' : '+ ') + Math.abs(kosten).toLocaleString('de-DE') + ' €'
      + (ref.bom_grund ? ' (' + ref.bom_grund + ')' : '') + ' (§ 8 Abs. 3 ImmoWertV).');
  }
  if (ref.purchase_price && ev > 0) {
    out.market_value.discount_to_market_pct = round((1 - ref.purchase_price / ev) * 100, 1);
  }
  return out;
}

export const ValuationService = {
  /* ═══ v2241 · UNBEBAUTES GRUNDSTUECK ═══════════════════════════════════
     Setzt den Bodenwert als Ergebnis ein. `bw` ist die Rueckgabe von
     ErtragswertService.bodenwert() — DER Bodenwert-Kern (Flaeche x BRW,
     Groessenanpassung, Zuschnitt, Erschliessungsbeitrag). Hier wird nichts
     gerechnet, nur ausgewiesen. Keine Spanne: der Bodenrichtwert ist ein
     Durchschnittswert der Zone, und eine Spanne darum waere erfunden. */
  grundstueck(valuation, bw, landValue, ref) {
    const v = valuation || {};
    v.market_value = {};
    v.notes = Array.isArray(v.notes) ? v.notes : [];
    if (!(bw && bw.vollstaendig && bw.wert != null)) {
      v.vergleichswert_gesperrt = { grund: 'bodenwert_fehlt',
        hinweis: 'Bodenwert nicht bestimmbar: '
          + ((bw && Array.isArray(bw.hinweise) && bw.hinweise.length) ? bw.hinweise.join(' ')
            : 'Grundstücksfläche oder Bodenrichtwert fehlt.') };
      v.notes.push(v.vergleichswert_gesperrt.hinweis);
      return v;
    }
    const q = Object.assign({}, bw.quelle || {});
    /* Der Orchestrator setzt `brw_quelle: 'boris'`, sobald landValue
       verfuegbar ist — auch fuer den Rueckfall auf die eigene Eingabe
       (registry.js: source 'dealpilot-eingabe'). Hier zaehlt die echte
       Herkunft: eine eigene Angabe ist kein amtlicher Wert. */
    if (landValue && landValue.source === 'dealpilot-eingabe') q.herkunft = 'eigene_angabe';
    v.vergleichswert_gesperrt = { grund: 'grundstueck',
      hinweis: 'Unbebautes Grundstück: Vergleichs-, Ertrags- und Sachwert entfallen; der Wert ist der Bodenwert.' };
    v.market_value = {
      estimated: bw.wert, low: bw.wert, high: bw.wert, range_basis: 'keine',
      verfahren: 'bodenwert', bezeichnung: 'Bodenwert (Bodenrichtwert × Fläche, § 40 Abs. 2 ImmoWertV)',
      basis_median_sqm: q.brw_sqm != null ? q.brw_sqm : null,
      brw_sqm: q.brw_sqm != null ? q.brw_sqm : null,
      brw_stichtag: q.stichtag || (landValue && landValue.stichtag) || null,
      brw_zone: q.zone || null,
      brw_herkunft: q.herkunft || null,
      flaeche_qm: Number(ref && ref.plot_area) || null,
      schritte: Array.isArray(bw.schritte) ? bw.schritte : [],
      hinweise: Array.isArray(bw.hinweise) ? bw.hinweise : [],
      confidence_pct: null,
      confidence_label: q.herkunft === 'boris' ? 'Bodenrichtwert' : 'Bodenrichtwert (eigene Angabe)',
    };
    if (ref && ref.purchase_price) {
      v.market_value.discount_to_market_pct = round((1 - ref.purchase_price / bw.wert) * 100, 1);
    }
    v.notes.push('Unbebautes Grundstück: Bodenwert '
      + Math.round(bw.wert).toLocaleString('de-DE') + ' € aus dem Bodenrichtwert '
      + (q.brw_sqm != null ? String(q.brw_sqm).replace('.', ',') + ' €/m² ' : '')
      + (q.herkunft === 'boris' ? '(amtlich)' : '(eigene Angabe)')
      + '. Abweichungen vom Richtwertgrundstück (Größe, Zuschnitt, Erschließung) sind nur berücksichtigt, '
      + 'soweit sie im Objekt angegeben sind.');
    return v;
  },

  // ref: {living_area, purchase_price, monthly_net_rent, condition, energy_class, floor,
  //       property_type, vacancy, plot_area}
  // sale: comparables-Stats (Kauf), rent: comparables-Stats (Miete)
  // landValue: BORIS-Bodenrichtwert ({available, value_sqm}) — fuer Grundstuecks-Mehrflaechenkorrektur (Haeuser)
  compute(ref, sale, rent, landValue = null) {
    const area = Number(ref.living_area) || null;
    const out = { inputs: {}, factors: {}, market_value: {}, yield: {}, notes: [] };

    // A) Kaufpreis pro m²
    out.inputs.price_per_sqm =
      ref.purchase_price && area ? round(ref.purchase_price / area, 2) : null;

    // B) Marktmiete pro m² (aus Vergleichsmieten)
    out.inputs.market_rent_sqm = rent && rent.median_per_sqm ? rent.median_per_sqm : null;

    // C/D/E) Renditekennzahlen
    const annualNetRent = ref.monthly_net_rent ? ref.monthly_net_rent * 12 : null;
    out.yield.annual_net_rent = annualNetRent ? round(annualNetRent, 0) : null;
    out.yield.gross_yield_pct =
      annualNetRent && ref.purchase_price
        ? round((annualNetRent / ref.purchase_price) * 100, 2)
        : null;
    out.yield.rent_multiplier =
      annualNetRent && ref.purchase_price ? round(ref.purchase_price / annualNetRent, 1) : null;

    /* ═══ v2241 · ZWEI OBJEKTARTEN OHNE WOHN-VERGLEICH ═══════════════════
       Unbebautes Grundstueck: kein Gebaeude, keine Wohnflaeche — der Wert
       ist der Bodenwert und wird im Orchestrator aus dem Bodenwert-Kern
       eingesetzt (grundstueck() unten). Gewerbe: NUR mit Vergleichsdaten
       aus dem Segment Gewerbe derselben Klasse. Bis hier rechnete ein
       Buero mit dem Median von Wohnungen und Haeusern. */
    const _ptV = _norm(ref.property_type);
    if (istGrundstueck(_ptV)) {
      out.inputs.market_rent_sqm = null;
      out.vergleichswert_gesperrt = { grund: 'grundstueck',
        hinweis: 'Unbebautes Grundstück: ein Vergleichswert aus Gebäudeangeboten entfällt. '
          + 'Der Wert ergibt sich aus dem Bodenwert (Bodenrichtwert × Fläche, § 40 Abs. 2 ImmoWertV).' };
      out.notes.push(out.vergleichswert_gesperrt.hinweis);
      return out;
    }
    if (istGewerbe(_ptV) || ref.gewerbe_art) {
      if (!(rent && rent.segment === 'gewerbe')) out.inputs.market_rent_sqm = null;
      return gewerbeVergleich(ref, sale, area, out);
    }

    /* v2241 · BESONDERE OBJEKTSPEZIFISCHE GRUNDSTUECKSMERKMALE (§ 8 Abs. 3).
       Sanierungs- oder Instandsetzungskosten aus dem Objekt (`san`) oder
       ein ausdruecklicher bOM-Ansatz. Sie wirken NACH den Marktfaktoren als
       Betrag. Der Zustandsabschlag druckt DENSELBEN Mangel als Prozentsatz
       aus — beides zusammen waere ein Doppelabzug. Liegt ein Abzug vor,
       entfaellt deshalb jeder ZustandsABSCHLAG (Faktor < 1); Zuschlaege
       bleiben, sie beschreiben keinen Mangel. Ohne bOM aendert sich hier
       nichts. */
    const _bomV = Number(ref.bom_eur);
    const kostenAbzug = (ref.bom_eur != null && Number.isFinite(_bomV) && _bomV !== 0) ? Math.round(_bomV) : 0;

    // F) Marktwert = Median-Vergleichspreis/m² * Fläche * Faktoren
    const base = sale && sale.median_per_sqm ? sale.median_per_sqm : null;
    if (base && area) {
      const locationFactor = 1.0; // später aus Makro/Mikro-Score ableitbar
      const condFactorRoh = _lookup(CONDITION_FACTOR, ref.condition);
      const qualFactor = _lookup(QUALITY_FACTOR, ref.quality);
      const modFactorRoh = _lookup(MODERNIZATION_FACTOR, ref.modernization);
      /* v2241: Abzug ODER Abschlag, nie beides. Nur die Stufen, die einen
         MANGEL beschreiben (renovierungs-/sanierungsbeduerftig, unsaniert,
         Renovierungsstau, abrissreif). „normal" (0,99) und „mittel" (0,96)
         sind Abnutzung im ueblichen Rahmen, kein Instandsetzungsbedarf —
         sie bleiben stehen. */
      const _mangelZ = kostenAbzug < 0 && MANGEL_ZUSTAND.has(_norm(ref.condition));
      const _mangelM = kostenAbzug < 0 && MANGEL_MODERNISIERUNG.has(_norm(ref.modernization));
      const condFactor = _mangelZ ? 1.0 : condFactorRoh;
      const modFactor = _mangelM ? 1.0 : modFactorRoh;
      if (_mangelZ || _mangelM) {
        out.notes.push('Zustandsabschlag nicht angesetzt (Faktor '
          + String(_mangelZ ? condFactorRoh : modFactorRoh).replace('.', ',') + '): für denselben Mangel ist ein Betrag von '
          + Math.abs(kostenAbzug).toLocaleString('de-DE') + ' € als besonderes objektspezifisches Grundstücksmerkmal '
          + 'abgezogen (§ 8 Abs. 3 ImmoWertV) — beides zusammen wäre ein Doppelabzug.');
      }
      const enFactor = ENERGY_FACTOR[(ref.energy_class || '').toUpperCase()] ?? 1.0;
      const flFactor = floorFactor(ref.floor, ref.property_type);
      const vacFactor = ref.vacancy ? 0.97 : 1.0;

      // Modernisierungsjahr verfeinert (falls angegeben) den Modernisierungs-Level.
      const _num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
      let modYearFactor = null;
      const modYear = _num(ref.modernization_year);
      if (modYear >= 1950 && modYear <= 2100) {
        const age = Math.max(0, new Date().getFullYear() - modYear);
        modYearFactor = age <= 5 ? 1.06 : age <= 15 ? 1.03 : age <= 30 ? 1.0 : 0.98;
      }
      const effModFactor = modYearFactor != null ? modYearFactor : modFactor;

      // Zustand × Qualität × Modernisierung überschneiden sich inhaltlich -> Teilprodukt
      // auf ±22 % deckeln (gegen Doppelzählung/Ausreißer beim Aufsummieren der Aufschläge).
      const objAdjRaw = condFactor * qualFactor * effModFactor;
      const objAdj = _clamp(objAdjRaw, 0.82, 1.22);

      // Ausstattungs-/Amenity-Faktor: NUR Aufschläge, getrennt vom Zustandsblock, separat gedeckelt
      // (Balkon/Terrasse, Garten, Aufzug, zweites Bad). Diese bewegen den Wert real, überschneiden
      // sich aber nicht mit Zustand/Qualität.
      const hasBalcony = _num(ref.balcony_area) > 0;
      const hasGarden = _num(ref.garden_area) > 0;
      const hasElevator = ref.elevator === true || _norm(ref.elevator) === 'true' || _norm(ref.elevator) === 'ja';
      const baths = _num(ref.bathrooms);
      let amenity = 1.0;
      if (hasBalcony) amenity *= 1.02;
      if (hasGarden) amenity *= 1.02;
      if (hasElevator) amenity *= (_num(ref.floor) >= 3 ? 1.03 : 1.02);
      if (baths >= 2) amenity *= 1.02;
      const amenityFactor = _clamp(amenity, 1.0, 1.12);

      // Stellplätze ADDITIV (eigenständiger Wert, nicht über €/m² skaliert). Pauschalen,
      // bewusst konservativ, da der Vergleichsmedian Parken teils schon enthält. Gedeckelt.
      const GARAGE_VALUE = 10000, OUTDOOR_VALUE = 4000;
      const parkingValue = _clamp(_num(ref.garages) * GARAGE_VALUE + _num(ref.outdoor_parking) * OUTDOOR_VALUE, 0, 30000);

      // GRUNDSTUECKS-MEHRFLAECHE (nur Haeuser): Der Vergleichsmedian €/m² Wfl preist ein
      // TYPISCHES EFH-Grundstueck mit ein. Uebergroesse (ueber ~650 m²) wird vom Markt
      // separat verguetet — additiv ueber den amtlichen Bodenrichtwert, mit Marktabschlag
      // (Uebergroesse wird nicht 1:1 bezahlt). Sanity-Deckel: max. 35 % des Vergleichswerts.
      /* v1071-WMFL-1 · Die 650 m2 und der Faktor 0,40 standen in keiner
       * Quelle. BORIS liefert die tatsaechliche Bezugsgroesse der Zone frei
       * Haus mit (Feld "Flaeche"; bei Loehner Strasse 278 sind es 700 m2,
       * nicht 650). Sie wird jetzt bevorzugt; die 650 bleiben nur als
       * Rueckfall, wenn BORIS nichts liefert — und der Hinweistext sagt,
       * welcher der beiden gegriffen hat. */
      const _bezugBoris = Number(
        (landValue && landValue.properties_raw
          && (landValue.properties_raw['Fläche'] || landValue.properties_raw.Flaeche)) || 0);
      const TYPICAL_PLOT_SQM = _bezugBoris > 0 ? _bezugBoris : 650;
      const TYPICAL_QUELLE = _bezugBoris > 0
        ? 'Bezugsgröße des Bodenrichtwertgrundstücks' : 'Annahme mangels Angabe';
      const EXCESS_MARKET_FACTOR = 0.40;
      const _pt = _norm(ref.property_type);
      const isHouse = _pt.includes('haus') || ['efh', 'dhh', 'rh', 'zfh', 'mfh'].includes(_pt);
      const plotArea = _num(ref.plot_area);
      const brwSqm = landValue && landValue.available && Number(landValue.value_sqm) > 0
        ? Number(landValue.value_sqm) : null;
      let landExcessValue = 0; let landComponent = null;
      if (isHouse && plotArea > 0 && brwSqm) {
        const excess = Math.max(0, plotArea - TYPICAL_PLOT_SQM);
        /* v2282 · Marcel 16.10.2026: „amtlich nur da, wo es auch so ist".
           Liegt ein amtlicher Umrechnungskoeffizient vor (Register, oder ein
           selbst eingetragener), ist die Mehrflaeche genau der Unterschied
           zwischen dem angepassten Bodenwert und dem Bodenwert des
           Richtwertgrundstuecks: Flaeche x BRW x UK - Bezugsgroesse x BRW.
           Nur ohne Koeffizient bleibt der eigene Marktfaktor 0,40 - mit dem
           Vermerk, dass er eine Festlegung von DealPilot ist. */
        let _ukV = null;
        if (_bezugBoris > 0 && excess > 0) {
          const _eigen = Number(ref.uk_flaeche);
          if (_eigen > 0 && _eigen < 3) {
            _ukV = { koeffizient: _eigen, quelle: 'eigene Angabe' };
          } else {
            try {
              const g = ukAusRegister({ ags: ref.ags || null, objektart: ref.property_subtype || ref.property_type,
                flaeche_qm: plotArea, bezugsgroesse_qm: _bezugBoris, brw_eur_qm: brwSqm,
                ortsteile: [((landValue && landValue.properties_raw) || {}).Ortsteil,
                            ((landValue && landValue.properties_raw) || {}).Gemarkungsname].filter(Boolean) });   /* v2283 */
              if (g && g.verfuegbar) _ukV = { koeffizient: g.faktor, quelle: g.quelle, quelle_url: g.quelle_url || null };
              /* v2288 · ohne amtlichen Wert die DealPilot-Formel (nicht bei Minden, nicht
                 wo der Ausschuss eine andere Regel nennt - dann kommt g mit Grund zurueck). */
              else if ((!g || g.grund === 'kein_satz') && !String(ref.ags || '').startsWith('05770')) {
                const _pr = (landValue && landValue.properties_raw) || {};
                const n = ukNaeherung({ objektart: ref.property_subtype || ref.property_type, flaeche_qm: plotArea, bezugsgroesse_qm: _bezugBoris,
                  brw_eur_qm: brwSqm, geschosszahl: _pr.Geschosszahl || _pr.geschosszahl || null });
                if (n && n.verfuegbar) _ukV = { koeffizient: n.faktor, quelle: 'abgeleitet aus der DealPilot-Formel' };
              }
            } catch (e) { _ukV = null; }
          }
        }
        const raw = _ukV
          ? (plotArea * brwSqm * _ukV.koeffizient - _bezugBoris * brwSqm)
          : excess * brwSqm * EXCESS_MARKET_FACTOR;
        landExcessValue = Math.round(_clamp(raw, 0, base * area * 0.35));
        landComponent = {
          plot_area_sqm: plotArea, typical_plot_sqm: TYPICAL_PLOT_SQM,
          excess_sqm: excess, brw_sqm: brwSqm, market_factor: _ukV ? null : EXCESS_MARKET_FACTOR,
          umrechnungskoeffizient: _ukV ? _ukV.koeffizient : null,
          umrechnung_quelle: _ukV ? _ukV.quelle : null,
          value_eur: landExcessValue,
          land_value_total_eur: Math.round(plotArea * brwSqm * (_ukV ? _ukV.koeffizient : 1)),
        };
        if (landExcessValue > 0 && _ukV) {
          out.notes.push(`Grundstücks-Mehrfläche: ${plotArea} m² × BRW ${brwSqm} €/m² × Umrechnungskoeffizient ${String(_ukV.koeffizient).replace('.', ',')} (${_ukV.quelle}) − ${TYPICAL_PLOT_SQM} m² Richtwertgrundstück × ${brwSqm} €/m² = +${landExcessValue.toLocaleString('de-DE')} € (additiv).`);
        } else if (landExcessValue > 0) {
          out.notes.push(`Grundstücks-Mehrfläche: ${excess} m² über ${TYPICAL_PLOT_SQM} m² (${TYPICAL_QUELLE}) × BRW ${brwSqm} €/m² × Marktfaktor ${EXCESS_MARKET_FACTOR} = +${landExcessValue.toLocaleString('de-DE')} € (additiv). Der Marktfaktor ist eine Festlegung von DealPilot, keine Angabe des Gutachterausschusses.`);   /* v1071-WMFL-2 */
        }
      } else if (isHouse && plotArea > 0 && !brwSqm) {
        out.notes.push('Grundstücksfläche angegeben, aber kein Bodenrichtwert verfügbar – Mehrflächenkorrektur nicht berechenbar.');
      }
      out.land_component = landComponent;

      out.factors = {
        location_factor: locationFactor,
        condition_factor: condFactor,
        quality_factor: qualFactor,
        modernization_factor: round(effModFactor, 3),
        object_adjustment: round(objAdj, 3),
        amenity_factor: round(amenityFactor, 3),
        energy_factor: enFactor,
        floor_factor: flFactor,
        vacancy_factor: vacFactor,
        parking_value_eur: parkingValue || 0,
        land_excess_value_eur: landExcessValue || 0,
      };
      if (kostenAbzug) {
        /* v2241: nur wenn es einen gibt — sonst bleibt die Ausgabe wie bisher */
        out.factors.kostenabzug_eur = kostenAbzug;
        out.factors.kostenabzug_grund = ref.bom_grund || null;
        if (condFactor !== condFactorRoh) out.factors.condition_factor_ohne_abzug = condFactorRoh;
      }
      if (round(objAdjRaw, 3) !== round(objAdj, 3)) {
        out.notes.push(`Objektzuschlag (Zustand×Qualität×Modernisierung = ${round(objAdjRaw, 3)}) auf ${objAdj} gedeckelt (Plausibilität).`);
      }
      out.notes.push('Objektfaktoren (Zustand, Ausstattungsqualität, Modernisierung, Energie, Etage, Ausstattung) verschieben die Punkt-Indikation; Stellplätze fließen additiv ein; die Spanne bleibt datenbasiert (GeoMap-Quartile).');

      const factorProduct = locationFactor * objAdj * amenityFactor * enFactor * flFactor * vacFactor;
      /* v2241: der bOM-Betrag ist Teil des Additivs — er wirkt nach den
         Faktoren und in Punktwert UND Spanne gleich. */
      const additive = parkingValue + landExcessValue + kostenAbzug;
      const ev = base * area * factorProduct + additive;
      if (kostenAbzug) {
        out.notes.push((kostenAbzug < 0 ? 'Abzug' : 'Zuschlag') + ' besondere objektspezifische Grundstücksmerkmale: '
          + (kostenAbzug < 0 ? '− ' : '+ ') + Math.abs(kostenAbzug).toLocaleString('de-DE') + ' €'
          + (ref.bom_grund ? ' (' + ref.bom_grund + ')' : '') + ', nach den Marktfaktoren angesetzt (§ 8 Abs. 3 ImmoWertV).');
      }
      // Sinnvolles Runden gegen Scheingenauigkeit: Marktwerte auf 1.000er (kleine auf 500er,
      // grosse auf 5.000er), damit minimale Restschwankungen unsichtbar werden.
      const roundNice = (v) => {
        if (v == null) return v;
        const step = v >= 500000 ? 5000 : v >= 100000 ? 1000 : 500;
        return Math.round(v / step) * step;
      };
      out.market_value.estimated = roundNice(ev);
      // Spanne aus echten GeoMap-Quartilen (q25/q75), falls vorhanden; sonst pauschal ±10%.
      if (sale.q25_per_sqm != null && sale.q75_per_sqm != null) {
        out.market_value.low = roundNice(sale.q25_per_sqm * area * factorProduct + additive);
        out.market_value.high = roundNice(sale.q75_per_sqm * area * factorProduct + additive);
        out.market_value.range_basis = 'quartile';
      } else {
        out.market_value.low = roundNice(ev * 0.9);
        out.market_value.high = roundNice(ev * 1.1);
        out.market_value.range_basis = 'pauschal';
      }
      out.market_value.basis_median_sqm = round(base / 5, 0) * 5; // €/m² auf 5er
      out.market_value.confidence = sale.confidence;

      // Aussagekraft = Marktdaten-Konfidenz (Stichprobe) × Vollstaendigkeit der werttreibenden
      // Objektangaben. Mehr Angaben -> hoehere Indikations-Konfidenz (objektspezifischer).
      const PRECISION = [
        ['condition', 'Zustand'], ['quality', 'Ausstattungsqualität'],
        ['modernization', 'Modernisierung'], ['energy_class', 'Energieklasse'],
      ];
      const has = (k) => { const v = ref[k]; if (v == null) return false; const s = String(v).trim().toLowerCase(); return s !== '' && s !== 'nan' && s !== 'null'; };
      const filled = PRECISION.filter(([k]) => has(k));
      const completeness = filled.length / PRECISION.length;
      const dataConf = sale.confidence != null ? sale.confidence : 0.5;

      /* v948-spread
       * ────────────────────────────────────────────────────────────────────
       * Bis v947 war die Aussagekraft = Stichprobe x Eingabe-Vollstaendigkeit.
       * Die STREUUNG kam nicht vor. Real auf Prod: Marktwert 197.000 € bei einer
       * Spanne von 146.000-272.000 € (Faktor 1,86) -> "Aussagekraft: Hoch · 80 %".
       * Bei der Spanne ist der Punktwert eine Orientierung, keine Aussage.
       *
       * Bezug ist (high-low)/estimated: die Breite RELATIV zu der Aussage, die
       * getroffen wird. Nicht high/low — ein Verhaeltnis sagt nichts darueber,
       * wie weit der Punkt danebenliegen kann.
       *   bis 25 %  -> voll (typische Quartilsbreite, homogener Markt)
       *   darueber  -> linearer Abschlag, Boden 0,45
       *
       * PAUSCHALE Spanne (kein q25/q75 -> +/-10 % erfunden): die ist rechnerisch
       * die engste von allen und bekaeme sonst die BESTE Note. Verkehrt herum —
       * keine Quartile heisst weniger Wissen, nicht mehr. Eigener Abschlag.
       */
      let spreadFactor = 1.0, spreadPct = null;
      if (out.market_value.range_basis === 'pauschal') {
        spreadFactor = 0.82;
        out.notes.push('Keine Vergleichsquartile verfügbar – Spanne pauschal mit ±10 % angesetzt. Die Aussagekraft ist deshalb gedämpft: eine erfundene Spanne ist kein Beleg für Genauigkeit.');
      } else if (out.market_value.low != null && out.market_value.high != null && ev > 0) {
        spreadPct = (out.market_value.high - out.market_value.low) / ev;
        spreadFactor = _clamp(1 - Math.max(0, spreadPct - 0.25) * 1.2, 0.45, 1.0);
      }
      out.market_value.spread_pct = spreadPct != null ? round(spreadPct * 100, 1) : null;
      out.market_value.spread_factor = round(spreadFactor, 2);
      out.market_value.spread_label =
        spreadPct == null ? null
        : spreadPct <= 0.25 ? 'eng'
        : spreadPct <= 0.40 ? 'normal'
        : spreadPct <= 0.60 ? 'weit' : 'sehr weit';
      if (spreadPct != null && spreadPct > 0.40) {
        out.notes.push(
          'Vergleichsspanne ' + Math.round(spreadPct * 100) + ' % des Marktwerts (' +
          Math.round(out.market_value.low).toLocaleString('de-DE') + ' – ' +
          Math.round(out.market_value.high).toLocaleString('de-DE') + ' €). Der Punktwert ist bei dieser Streuung ' +
          'eine Orientierung, keine Aussage — die Aussagekraft ist entsprechend gemindert. ' +
          'Für Kalkulation und Beleihung ist das untere Ende die belastbare Größe.'
        );
      }

      const combined = _clamp(dataConf * (0.78 + 0.22 * completeness) * spreadFactor, 0, 0.98);
      out.market_value.data_confidence = round(dataConf, 2);
      out.market_value.input_filled = filled.length;
      out.market_value.input_total = PRECISION.length;
      out.market_value.input_completeness = round(completeness, 2);
      out.market_value.input_missing = PRECISION.filter(([k]) => !has(k)).map(([, l]) => l);
      /* v948-spread: nachvollziehbar statt Blackbox — wer 43 % liest, soll sehen warum. */
      out.market_value.confidence_parts = {
        marktdaten: round(dataConf, 2),
        eingaben: round(0.78 + 0.22 * completeness, 2),
        streuung: round(spreadFactor, 2),
      };
      out.market_value.confidence_pct = Math.round(combined * 100);
      out.market_value.confidence_label =
        out.market_value.confidence_pct >= 85 ? 'Sehr hoch'
        : out.market_value.confidence_pct >= 70 ? 'Hoch'
        : out.market_value.confidence_pct >= 55 ? 'Mittel' : 'Niedrig';

      // Preisabschlag/-aufschlag ggü. Marktwert
      if (ref.purchase_price) {
        const disc = (1 - ref.purchase_price / ev) * 100; // >0 = unter Marktwert (Schnäppchen)
        out.market_value.discount_to_market_pct = round(disc, 1);
      }
    } else {
      out.notes.push('Kein Vergleichs-Kaufpreis vorhanden – Marktwert nicht belastbar berechenbar.');
    }

    return out;
  },
};
