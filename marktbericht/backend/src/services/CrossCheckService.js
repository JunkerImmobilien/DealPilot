// CrossCheckService.js — Sachwert- & Ertragswertverfahren als PLAUSIBILITÄTS-QUERCHECK
// zum Vergleichswert. Vereinfachte, transparente Umsetzung nach ImmoWertV-Logik
// (indikativ, KEIN Gutachten): alle Annahmen als Konstanten dokumentiert und im
// Output unter assumptions ausgewiesen. Reine Rechnung — keine API-Kosten.
import { round } from '../lib/stats.js';

// ---- Annahmen (dokumentiert, anpassbar) ----
const NHK_EFH_BGF = 835;          // NHK 2010, EFH Standardstufe 3, €/m² BGF
const BAUPREISINDEX = 2.02;       // Baupreisindex Wohngebäude 2010 -> 2026 (Destatis, gerundet)
const BGF_FAKTOR = 1.35;          // BGF ≈ Wohnfläche × 1,35 (EFH-Faustwert)
const GND_JAHRE = 80;             // Gesamtnutzungsdauer Wohngebäude
const RND_MIN = 10;               // Mindest-Restnutzungsdauer
const SACHWERTFAKTOR = 1.0;       // Marktanpassung (ohne lokale GAA-Daten neutral = 1,0)
const BWK_QUOTE = 0.23;           // Bewirtschaftungskosten inkl. Mietausfallwagnis, % v. Rohertrag
const LIEGENSCHAFTSZINS = 0.03;   // EFH-typisch 2,5–3,5 % -> 3,0 %

const _num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

export const CrossCheckService = {
  // ref: Objektdaten; landValue: BORIS ({available, value_sqm}); rent: GeoMap-Mietstats;
  // valuation: Ergebnis des Vergleichswertverfahrens (fuer die Gegenueberstellung)
  compute(ref, landValue, rent, valuation) {
    const out = {
      available: false,
      sachwert: { available: false },
      ertragswert: { available: false },
      comparison: null,
      assumptions: {
        nhk_efh_bgf_eur: NHK_EFH_BGF, baupreisindex_2010_heute: BAUPREISINDEX,
        bgf_faktor: BGF_FAKTOR, gnd_jahre: GND_JAHRE, sachwertfaktor: SACHWERTFAKTOR,
        bwk_quote: BWK_QUOTE, liegenschaftszins: LIEGENSCHAFTSZINS,
      },
      notes: ['Vereinfachtes Sachwert-/Ertragswertverfahren nach ImmoWertV-Logik als Plausibilitäts-Quercheck. Indikativ, kein Gutachten n. § 194 BauGB.'],
    };

    const wfl = _num(ref.living_area);
    const buildYear = _num(ref.build_year);
    const plot = _num(ref.plot_area);
    const brw = landValue && landValue.available ? _num(landValue.value_sqm) : null;
    const bodenwert = plot && brw ? Math.round(plot * brw) : null;
    const nowYear = new Date().getFullYear();

    // ---- Restnutzungsdauer (vereinfacht modifiziert) ----
    // Basis: GND - Alter. Modernisierung verlängert (teilmodernisiert +10 J., kern-/umfassend +20 J.),
    // gedeckelt auf GND-10; Minimum RND_MIN.
    let rnd = null;
    if (buildYear) {
      const alter = Math.max(0, nowYear - buildYear);
      rnd = GND_JAHRE - alter;
      const mod = String(ref.modernization || '').toLowerCase();
      const modYear = _num(ref.modernization_year);
      let bonus = 0;
      if (mod.includes('kern') || mod.includes('umfassend')) bonus = 20;
      else if (mod.includes('teil') || (modYear && nowYear - modYear <= 35)) bonus = 10;
      rnd = Math.min(GND_JAHRE - 10, Math.max(rnd + bonus, RND_MIN));
    }

    // ================= SACHWERT =================
    if (wfl && buildYear) {
      const bgf = wfl * BGF_FAKTOR;
      const hkNeubau = bgf * NHK_EFH_BGF * BAUPREISINDEX;
      const alterswertfaktor = rnd != null ? rnd / GND_JAHRE : null;
      const gebaeudeSachwert = alterswertfaktor != null ? hkNeubau * alterswertfaktor : null;
      if (gebaeudeSachwert != null) {
        const vorl = (bodenwert || 0) + gebaeudeSachwert;
        const sachwert = Math.round(vorl * SACHWERTFAKTOR / 1000) * 1000;
        out.sachwert = {
          available: true,
          bodenwert_eur: bodenwert,                       // null wenn Grundstueck/BRW fehlt
          bgf_sqm: Math.round(bgf),
          herstellungskosten_neubau_eur: Math.round(hkNeubau),
          alter_jahre: nowYear - buildYear,
          restnutzungsdauer_jahre: rnd,
          alterswertminderung_faktor: round(alterswertfaktor, 3),
          gebaeude_sachwert_eur: Math.round(gebaeudeSachwert),
          sachwertfaktor: SACHWERTFAKTOR,
          value_eur: sachwert,
          bodenwert_fehlt: bodenwert == null,
        };
        if (bodenwert == null) out.notes.push('Sachwert OHNE Bodenwert (Grundstücksfläche oder Bodenrichtwert fehlt) – nur Gebäudesachwert ausgewiesen.');
      }
    }

    // ================= ERTRAGSWERT =================
    const rentSqm = rent && _num(rent.median_per_sqm);
    if (wfl && rentSqm && rnd != null) {
      const rohertrag = Math.round(rentSqm * wfl * 12);
      const bwk = Math.round(rohertrag * BWK_QUOTE);
      const reinertrag = rohertrag - bwk;
      const q = 1 + LIEGENSCHAFTSZINS;
      const V = (Math.pow(q, rnd) - 1) / (Math.pow(q, rnd) * (q - 1)); // Rentenbarwertfaktor
      let ertragswert;
      if (bodenwert != null) {
        const bodenVz = bodenwert * LIEGENSCHAFTSZINS;
        const gebaeudeReinertrag = Math.max(0, reinertrag - bodenVz);
        ertragswert = gebaeudeReinertrag * V + bodenwert;
      } else {
        ertragswert = reinertrag * V; // vereinfachte Variante ohne Bodenwerttrennung
      }
      ertragswert = Math.round(ertragswert / 1000) * 1000;
      out.ertragswert = {
        available: true,
        rohertrag_pa_eur: rohertrag,
        bwk_pa_eur: bwk,
        reinertrag_pa_eur: reinertrag,
        liegenschaftszins_pct: LIEGENSCHAFTSZINS * 100,
        restnutzungsdauer_jahre: rnd,
        vervielfaeltiger: round(V, 2),
        bodenwert_eur: bodenwert,
        value_eur: ertragswert,
        bodenwert_fehlt: bodenwert == null,
      };
    }

    // ================= VERGLEICH =================
    const vgl = valuation && valuation.market_value ? valuation.market_value.estimated : null;
    if (out.sachwert.available || out.ertragswert.available) {
      out.available = true;
      const vals = [
        ['vergleichswert', vgl],
        ['sachwert', out.sachwert.available ? out.sachwert.value_eur : null],
        ['ertragswert', out.ertragswert.available ? out.ertragswert.value_eur : null],
      ].filter(([, v]) => v != null);
      const nums = vals.map(([, v]) => v);
      out.comparison = {
        vergleichswert_eur: vgl,
        sachwert_eur: out.sachwert.available ? out.sachwert.value_eur : null,
        ertragswert_eur: out.ertragswert.available ? out.ertragswert.value_eur : null,
        min_eur: nums.length ? Math.min(...nums) : null,
        max_eur: nums.length ? Math.max(...nums) : null,
        spread_pct: nums.length >= 2 && Math.min(...nums) > 0
          ? round((Math.max(...nums) / Math.min(...nums) - 1) * 100, 1) : null,
      };
    }
    return out;
  },
};
