// ValuationService.js — Marktwert + Renditekennzahlen.
// Formeln exakt nach Auftrag; Faktoren transparent & einzeln ausgewiesen.
import { round } from '../lib/stats.js';

// Zustands-/Energie-/Etagen-Faktoren (dokumentiert, anpassbar)
// Zustand robust gemappt inkl. Synonyme & DealPilot-Werte ("gut", "saniert", ...).
const CONDITION_FACTOR = {
  erstbezug: 1.08, neuwertig: 1.08, neu: 1.08, kernsaniert: 1.07,
  saniert: 1.05, modernisiert: 1.04, 'sehr gut': 1.04, sehr_gut: 1.04, 'sehr_gut': 1.04,
  gut: 1.0, gepflegt: 1.0, normal: 0.99, mittel: 0.96,
  renovierungsbeduerftig: 0.88, 'renovierungsbedürftig': 0.88,
  sanierungsbeduerftig: 0.82, 'sanierungsbedürftig': 0.82, unsaniert: 0.92, abrissreif: 0.70,
};
// Ausstattungsqualität (einfach … luxuriös)
const QUALITY_FACTOR = { einfach: 0.93, normal: 1.0, gehoben: 1.06, luxurioes: 1.12, 'luxuriös': 1.12, luxus: 1.12 };
// Modernisierungsgrad
const MODERNIZATION_FACTOR = {
  kernsaniert: 1.08, 'umfassend modernisiert': 1.05, umfassend: 1.05,
  teilmodernisiert: 1.02, teilweise: 1.02, keine: 1.0,
  unsaniert: 0.95, original: 0.95, renovierungsstau: 0.90,
};
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

export const ValuationService = {
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

    // F) Marktwert = Median-Vergleichspreis/m² * Fläche * Faktoren
    const base = sale && sale.median_per_sqm ? sale.median_per_sqm : null;
    if (base && area) {
      const locationFactor = 1.0; // später aus Makro/Mikro-Score ableitbar
      const condFactor = _lookup(CONDITION_FACTOR, ref.condition);
      const qualFactor = _lookup(QUALITY_FACTOR, ref.quality);
      const modFactor = _lookup(MODERNIZATION_FACTOR, ref.modernization);
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
      const TYPICAL_PLOT_SQM = 650, EXCESS_MARKET_FACTOR = 0.40;
      const _pt = _norm(ref.property_type);
      const isHouse = _pt.includes('haus') || ['efh', 'dhh', 'rh', 'zfh', 'mfh'].includes(_pt);
      const plotArea = _num(ref.plot_area);
      const brwSqm = landValue && landValue.available && Number(landValue.value_sqm) > 0
        ? Number(landValue.value_sqm) : null;
      let landExcessValue = 0; let landComponent = null;
      if (isHouse && plotArea > 0 && brwSqm) {
        const excess = Math.max(0, plotArea - TYPICAL_PLOT_SQM);
        const raw = excess * brwSqm * EXCESS_MARKET_FACTOR;
        landExcessValue = Math.round(_clamp(raw, 0, base * area * 0.35));
        landComponent = {
          plot_area_sqm: plotArea, typical_plot_sqm: TYPICAL_PLOT_SQM,
          excess_sqm: excess, brw_sqm: brwSqm, market_factor: EXCESS_MARKET_FACTOR,
          value_eur: landExcessValue,
          land_value_total_eur: Math.round(plotArea * brwSqm),
        };
        if (landExcessValue > 0) {
          out.notes.push(`Grundstücks-Mehrfläche: ${excess} m² über typischem EFH-Grundstück (${TYPICAL_PLOT_SQM} m²) × BRW ${brwSqm} €/m² × Marktfaktor ${EXCESS_MARKET_FACTOR} = +${landExcessValue.toLocaleString('de-DE')} € (additiv).`);
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
      if (round(objAdjRaw, 3) !== round(objAdj, 3)) {
        out.notes.push(`Objektzuschlag (Zustand×Qualität×Modernisierung = ${round(objAdjRaw, 3)}) auf ${objAdj} gedeckelt (Plausibilität).`);
      }
      out.notes.push('Objektfaktoren (Zustand, Ausstattungsqualität, Modernisierung, Energie, Etage, Ausstattung) verschieben die Punkt-Indikation; Stellplätze fließen additiv ein; die Spanne bleibt datenbasiert (GeoMap-Quartile).');

      const factorProduct = locationFactor * objAdj * amenityFactor * enFactor * flFactor * vacFactor;
      const additive = parkingValue + landExcessValue;
      const ev = base * area * factorProduct + additive;
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
      const combined = _clamp(dataConf * (0.78 + 0.22 * completeness), 0, 0.98);
      out.market_value.data_confidence = round(dataConf, 2);
      out.market_value.input_filled = filled.length;
      out.market_value.input_total = PRECISION.length;
      out.market_value.input_completeness = round(completeness, 2);
      out.market_value.input_missing = PRECISION.filter(([k]) => !has(k)).map(([, l]) => l);
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
