// ScoringService.js — Makro-Score + Deal-Score.
// Mikro-Score kommt aus MicroLocationService. Makro nutzt vorhandene Metriken
// (falls vorhanden), sonst neutral 50 + Note "geschätzt".
import { round } from '../lib/stats.js';

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

export const ScoringService = {
  // metrics optional: {bevoelkerung_trend, kaufkraft_idx, arbeitslosenquote, wanderungssaldo,
  //                    leerstand, neubau, miet_trend, kaufpreis_trend}
  macroScore(metrics) {
    if (!metrics || Object.keys(metrics).length === 0) {
      return { score: 50, breakdown: {}, estimated: true,
               note: 'Keine Makro-Daten (Destatis/Regionalstatistik nicht angebunden) – neutraler Default 50.' };
    }
    const parts = {};
    const add = (k, val) => { if (typeof val === 'number') parts[k] = round(val * 100, 0); };
    add('bevoelkerung', clamp01((metrics.bevoelkerung_trend ?? 0) / 2 + 0.5));
    add('kaufkraft', clamp01((metrics.kaufkraft_idx ?? 100) / 200));
    add('arbeitslosigkeit', clamp01(1 - (metrics.arbeitslosenquote ?? 6) / 15));
    add('wanderung', clamp01((metrics.wanderungssaldo ?? 0) / 2 + 0.5));
    add('miet_trend', clamp01((metrics.miet_trend ?? 0) / 0.1 / 2 + 0.5));
    add('kaufpreis_trend', clamp01((metrics.kaufpreis_trend ?? 0) / 0.1 / 2 + 0.5));
    const vals = Object.values(parts);
    const score = vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length, 0) : 50;
    return { score, breakdown: parts, estimated: false };
  },

  // Deal-Score nach Auftrag:
  // 30% Preisabschlag, 20% Bruttorendite, 20% Makro, 15% Mikro, 10% Mietentwicklung, 5% Risiko
  dealScore({ discountPct, grossYieldPct, macroScore, microScore, rentTrendPct, riskScore }) {
    const breakdown = {};

    // Preisabschlag: 0% -> 0.5, +15% -> 1.0, -15% -> 0.0
    const discComp = clamp01(0.5 + (discountPct ?? 0) / 30);
    breakdown.preisabschlag = round(discComp * 100, 0);

    // Bruttorendite: 3% -> 0.3, 6% -> 0.8, >=8% -> 1.0
    const gy = grossYieldPct ?? 0;
    const yieldComp = clamp01((gy - 2) / 6);
    breakdown.bruttorendite = round(yieldComp * 100, 0);

    const macroComp = clamp01((macroScore ?? 50) / 100);
    breakdown.makrolage = round(macroComp * 100, 0);

    const microComp = clamp01((microScore ?? 50) / 100);
    breakdown.mikrolage = round(microComp * 100, 0);

    // Mietentwicklung: -2%/Jahr -> 0, +4%/Jahr -> 1
    const rentComp = clamp01(((rentTrendPct ?? 0) + 2) / 6);
    breakdown.mietentwicklung = round(rentComp * 100, 0);

    // Risiko: bereits 0..1 (1 = geringes Risiko); Default 0.6
    const riskComp = clamp01(riskScore ?? 0.6);
    breakdown.risiko = round(riskComp * 100, 0);

    const total =
      0.30 * discComp +
      0.20 * yieldComp +
      0.20 * macroComp +
      0.15 * microComp +
      0.10 * rentComp +
      0.05 * riskComp;

    const score = round(total * 100, 0);
    let rating = 'Neutral';
    if (score >= 75) rating = 'Sehr attraktiv';
    else if (score >= 60) rating = 'Attraktiv';
    else if (score >= 45) rating = 'Durchschnittlich';
    else rating = 'Unterdurchschnittlich';

    return { score, rating, breakdown, weights: {
      preisabschlag: 0.30, bruttorendite: 0.20, makrolage: 0.20,
      mikrolage: 0.15, mietentwicklung: 0.10, risiko: 0.05 } };
  },
};
