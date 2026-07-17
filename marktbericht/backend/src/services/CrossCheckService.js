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
/* v955-etw: Der Zinssatz ist EFH-begruendet. Fuer Eigentumswohnungen liegen
 * Liegenschaftszinsen typischerweise HOEHER (3,5-5 %) — ein zu niedriger Zins
 * rechnet den Ertragswert nach OBEN. Der Hinweis steht im Output, damit niemand
 * die Zahl fuer eine Aussage haelt, die sie nicht ist. */

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

    /* v955-etw: Die Objektart kam in dieser Datei bisher NICHT vor (grep = 0).
     * Gerechnet wurde alles als EFH — auch jede Eigentumswohnung. */
    const _pt = String(ref.property_type || '').toLowerCase().trim();
    const istWohnung = /etw|wohnung|whg|apartment|appartement/.test(_pt);
    const istHaus = /efh|dhh|\brh\b|reihen|zfh|mfh|haus|villa/.test(_pt);
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
    /* v955-etw
     * ────────────────────────────────────────────────────────────────────────
     * Bei einer Eigentumswohnung wird der Sachwert NICHT gerechnet, sondern
     * weggelassen. Die Konstanten oben sagen selbst, wofuer sie gelten:
     *     NHK_EFH_BGF = 835     "EFH Standardstufe 3"
     *     BGF_FAKTOR  = 1.35    "EFH-Faustwert"
     * Eine ETW hat keinen eigenen Dachstuhl und kein eigenes Fundament; ihr
     * Anteil an Treppenhaus und Keller steckt anders in der Flaeche. Mit der
     * EFH-Tabelle kaeme eine Zahl heraus, die aussieht wie eine zweite Meinung
     * und doch nur dieselbe Flaeche mit der falschen Tabelle ist.
     *
     * Ein falsch gerechneter Quercheck ist schlechter als keiner: er beruhigt.
     * Der Ertragswert bleibt — der rechnet aus Rohertrag und Liegenschaftszins
     * und gilt fuer eine ETW genauso.
     */
    if (istWohnung) {
      out.sachwert = {
        available: false,
        grund: 'Sachwertverfahren für Eigentumswohnungen nicht anwendbar (NHK-Tabelle und BGF-Faktor gelten für Einfamilienhäuser).',
      };
      out.notes.push('Sachwert nicht ausgewiesen: Das vereinfachte Sachwertverfahren arbeitet mit den Normalherstellungskosten für Einfamilienhäuser (NHK 2010, Standardstufe 3) und dem EFH-Faustwert BGF ≈ Wohnfläche × 1,35. Für eine Eigentumswohnung ist das die falsche Grundlage – lieber keine Zahl als eine falsche. Der Ertragswert-Quercheck bleibt.');
    } else if (wfl && buildYear) {
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
        /* v955-etw: SACHWERTFAKTOR = 1.0 heisst "keine Marktanpassung", nicht
         * "Marktanpassung ergibt 1,0". Real liegt er je nach Lage bei 0,8-1,3.
         * Wer das nicht weiss, liest den Sachwert als Verkehrswert. */
        out.notes.push('Sachwertfaktor 1,0 angesetzt: Ohne Daten des örtlichen Gutachterausschusses erfolgt KEINE Marktanpassung. Reale Sachwertfaktoren liegen je nach Lage zwischen 0,8 und 1,3 – der ausgewiesene Sachwert ist deshalb unangepasst und weicht systematisch vom Verkehrswert ab.');
        if (!istHaus && !istWohnung) out.notes.push('Objektart nicht eindeutig – Sachwert mit EFH-Ansatz gerechnet. Bei Nicht-Wohnnutzung ist er nicht belastbar.');
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
