// DealPilotObjectMapper.js
// Uebersetzt ein DealPilot-Objekt (.dpkt: flach ODER { data: {...} }) in
//   - reportInput: Felder fuer ReportOrchestrator.generate (Adresse, Flaeche, Preise, brw)
//   - assessment:  die DS2-Lage-/Potenzialbewertungen (Mikro/Makro/Bevoelkerung/Nachfrage/
//                  Entwicklung/Wertsteigerung/Mietausfall + Marktmiete/Marktfaktor)
//   - dealpilot:   vorhandener DealScore + (geparste) KI-Investmentanalyse
// So fliessen die in DealPilot bereits erfassten Einschaetzungen direkt in den Bericht.

function dataOf(obj) {
  if (obj && typeof obj === 'object' && obj.data && typeof obj.data === 'object') return obj.data;
  return obj || {};
}
function pick(d, keys) {
  for (const k of keys) if (d[k] != null && d[k] !== '') return d[k];
  return null;
}
function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v
    : parseFloat(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}
function mapPropertyType(raw) {
  const s = String(raw || '').toLowerCase();
  if (/etw|wohnung|eigentumswohnung/.test(s)) return 'wohnung';
  if (/mfh|mehrfamilien/.test(s)) return 'mfh';
  if (/efh|dhh|rh|zfh|haus|einfamilien|doppelhaus|reihenhaus/.test(s)) return 'haus';
  return null;
}
function buildAddress(d) {
  const str = pick(d, ['str', 'strasse', 'straße']);
  const hnr = pick(d, ['hnr', 'hausnummer']);
  const plz = pick(d, ['plz']);
  const ort = pick(d, ['ort', 'stadt']);
  const line1 = [str, hnr].filter(Boolean).join(' ');
  const line2 = [plz, ort].filter(Boolean).join(' ');
  const full = [line1, line2].filter(Boolean).join(', ');
  return full || null;
}
function vacancyFrom(d) {
  const v = String(pick(d, ['vermstand', 'vermietungsstand']) || '').toLowerCase();
  if (/leer|unvermietet/.test(v)) return true;
  if (/vermietet/.test(v)) return false;
  return false;
}

export const DealPilotObjectMapper = {
  reportInput(obj) {
    const d = dataOf(obj);
    const wfl = num(pick(d, ['wfl', 'wohnflaeche', 'wohnfläche']));
    return {
      address: buildAddress(d),
      property_type: mapPropertyType(pick(d, ['objart', 'objektart'])),
      living_area: wfl,
      rooms: num(pick(d, ['zimmer'])),
      build_year: num(pick(d, ['baujahr'])),
      floor: num(pick(d, ['etage'])),
      condition: pick(d, ['ds2_zustand', 'zustand']) || 'gepflegt',
      energy_class: pick(d, ['ds2_energie', 'energieklasse', 'energie_label']),
      purchase_price: num(pick(d, ['kp', 'kaufpreis'])),
      monthly_net_rent: num(pick(d, ['nkm', 'nettokaltmiete'])),
      vacancy: vacancyFrom(d),
      // Bodenrichtwert aus DealPilot als BORIS-Fallback
      land_value_manual: num(pick(d, ['brw'])),
      /* v727-equipment: Ausstattungsdetails (fliessen in DealPilot-Marktanalyse ein) */
      heating: pick(d, ['eq_heating']),
      windows: pick(d, ['eq_windows']),
      floor_covering: pick(d, ['eq_floor']),
      bath: pick(d, ['eq_bath']),
      guest_wc: pick(d, ['eq_guest_wc']),
      store_room: pick(d, ['eq_store_room']),
      exterior_walls: pick(d, ['eq_walls']),
      roof: pick(d, ['eq_roof']),
      elevator: pick(d, ['eq_elevator']),
    };
  },

  // Lage- und Potenzialbewertungen (DealPilot-Eingaben). Strings bleiben lesbar (gut/mittel/…).
  assessment(obj) {
    const d = dataOf(obj);
    const out = {
      mikrolage: pick(d, ['mikrolage']),
      makrolage: pick(d, ['makrolage']),
      bevoelkerung: pick(d, ['ds2_bevoelkerung']),
      nachfrage: pick(d, ['ds2_nachfrage']),
      entwicklung: pick(d, ['ds2_entwicklung']),
      wertsteigerung: pick(d, ['ds2_wertsteigerung']),
      mietausfallrisiko: pick(d, ['ds2_mietausfall']),
      ausstattung: pick(d, ['ausst', 'ausstattung']),
      vermietungsstand: pick(d, ['vermstand', 'vermietungsstand']),
      marktmiete_eur_qm: num(pick(d, ['ds2_marktmiete'])),
      marktfaktor: num(pick(d, ['ds2_marktfaktor'])),
    };
    // nur zurueckgeben, wenn mind. ein Feld belegt ist
    return Object.values(out).some((v) => v != null && v !== '') ? out : null;
  },

  // Vorhandener DealScore + KI-Investmentanalyse (in der .dpkt als JSON-String)
  dealpilot(obj) {
    const d = dataOf(obj);
    let ai = null;
    const raw = obj && obj.ai_analysis != null ? obj.ai_analysis : d.ai_analysis;
    if (raw) {
      if (typeof raw === 'string') { try { ai = JSON.parse(raw); } catch { ai = null; } }
      else if (typeof raw === 'object') ai = raw;
    }
    const score = num(pick(d, ['_dealpilot_score', 'dealpilot_score']));
    const ds2 = num(pick(d, ['_ds2_score', 'ds2_score']));
    const dscr = num(pick(d, ['_kpis_dscr']));
    const ltv = num(pick(d, ['_kpis_ltv']));
    const cashflow = num(pick(d, ['_kpis_cf_ns']));
    const sv = num(pick(d, ['svwert']));
    if (score == null && ds2 == null && !ai && dscr == null) return null;
    return { score, ds2_score: ds2, dscr, ltv_pct: ltv, cashflow_monthly: cashflow,
             sv_wert: sv, ai_analysis: ai };
  },
};
