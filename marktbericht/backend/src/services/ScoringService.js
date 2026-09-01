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
  //
  // ── v1197 · UNBEKANNT IST NICHT SCHLECHT ────────────────────────────────
  // Bis hierher stand fuer die Bruttorendite:
  //
  //     const gy = grossYieldPct ?? 0;
  //     const yieldComp = clamp01((gy - 2) / 6);   // (0-2)/6 = -0.33 -> 0
  //
  // Ein Objekt OHNE Kaufpreis hat keine Bruttorendite. Der Wert fiel damit
  // auf 0 von 100 — den schlechtestmoeglichen — und riss ueber sein Gewicht
  // von 20 % den ganzen Deal-Score mit. Gemessen an einem echten Bericht
  // (Huellhorst, ohne Kaufpreis): Score 45/100, Komponente „Bruttorendite
  // 0 / 100", und daneben KEINE Erklaerung, weil der Untertitel bei
  // fehlendem Wert korrekt leer bleibt. Der Nutzer sah eine harte Null ohne
  // Grund.
  //
  // Die Nachbarn in derselben Funktion machen es richtig: `macroScore ?? 50`
  // und `microScore ?? 50` landen neutral, und beim Preisabschlag ist die 0
  // ZUFAELLIG der neutrale Punkt der Formel (0.5 + 0/30 = 0.5). Bei der
  // Rendite liegt der neutrale Punkt aber bei 5 % — die `?? 0` war von den
  // Nachbarn abgeschrieben, wo sie harmlos ist.
  //
  // Das ist die Falle, die in CLAUDE.md steht: „Number(null) ist 0 und
  // besteht Number.isFinite — erst auf Abwesenheit pruefen, dann rechnen."
  //
  // Und der Kopf dieser Datei sagt die Absicht seit jeher: „sonst neutral 50
  // + Note geschaetzt". `macroScore()` macht das auch. `dealScore()` nicht.
  //
  // Jetzt: JEDER Teilwert geht durch `teil()`. Fehlt die Zahl, wird der
  // neutrale Ersatz genommen UND der Name in `geschaetzt` vermerkt, damit
  // die Oberflaeche sagen kann, welcher Teilwert geraten und welcher
  // gemessen ist. Eine Zahl ohne Herkunft gibt es hier nicht mehr.
  //
  // OFFEN UND BEWUSST NICHT ENTSCHIEDEN: statt neutral zu ersetzen koennte
  // man den fehlenden Teilwert ganz WEGLASSEN und die uebrigen Gewichte
  // hochnormieren. Das ist fachlich ebenso vertretbar und faellt anders aus.
  // Diese Wahl gehoert Marcel, nicht dem Code — hier steht bewusst die
  // Konvention, die diese Datei ohnehin schon dokumentiert.
  dealScore({ discountPct, grossYieldPct, macroScore, microScore, rentTrendPct, riskScore }) {
    const breakdown = {};
    const geschaetzt = [];

    // wert == null  ->  Ersatz nehmen und merken. Deckt null UND undefined ab.
    function teil(name, wert, formel, ersatz) {
      if (wert == null) { geschaetzt.push(name); return ersatz; }
      return clamp01(formel(wert));
    }

    // Preisabschlag: 0% -> 0.5, +15% -> 1.0, -15% -> 0.0
    const discComp = teil('preisabschlag', discountPct, (v) => 0.5 + v / 30, 0.5);
    breakdown.preisabschlag = round(discComp * 100, 0);

    // Bruttorendite: 2% -> 0.0, 5% -> 0.5, 8% -> 1.0
    const yieldComp = teil('bruttorendite', grossYieldPct, (v) => (v - 2) / 6, 0.5);
    breakdown.bruttorendite = round(yieldComp * 100, 0);

    const macroComp = teil('makrolage', macroScore, (v) => v / 100, 0.5);
    breakdown.makrolage = round(macroComp * 100, 0);

    const microComp = teil('mikrolage', microScore, (v) => v / 100, 0.5);
    breakdown.mikrolage = round(microComp * 100, 0);

    // Mietentwicklung: -2%/Jahr -> 0, +4%/Jahr -> 1
    const rentComp = teil('mietentwicklung', rentTrendPct, (v) => (v + 2) / 6, 0.5);
    breakdown.mietentwicklung = round(rentComp * 100, 0);

    // Risiko: bereits 0..1 (1 = geringes Risiko); Vorgabewert 0.6, bewusst
    // nicht 0.5 — ohne Kenntnis wird leicht vorsichtiger angesetzt.
    const riskComp = teil('risiko', riskScore, (v) => v, 0.6);
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

    return { score, rating, breakdown, geschaetzt, weights: {
      preisabschlag: 0.30, bruttorendite: 0.20, makrolage: 0.20,
      mikrolage: 0.15, mietentwicklung: 0.10, risiko: 0.05 } };
  },
};
