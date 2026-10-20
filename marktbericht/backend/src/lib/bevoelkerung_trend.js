/* v2540 · BEVOELKERUNGSTREND OHNE DEN ZENSUS-SPRUNG
 * ──────────────────────────────────────────────────────────────────────
 * Marcel am 20.10.2026: „so dass es richtig ist".
 *
 * Die Regionaldatenbank fuehrt den Bevoelkerungsstand (12411-01-01-4/-5)
 * bis 2021 auf Basis Zensus 2011, ab 2022 auf Basis Zensus 2022 (Destatis,
 * „Umstellung der Bevoelkerungszahlen auf den Zensus 2022"). Die Reihe
 * springt deshalb zwischen 2021 und 2022 - gemessen Minden-Luebbecke +3 %,
 * Huellhorst +2,7 %. Ein Trend aus erstem und letztem Wert schrieb diesen
 * Sprung als Wachstum in die Jahresrate.
 *
 * Destatis (WISTA 6/2025): Ergebnisse vor 2022 sind mit denen ab 2022 „nur
 * bedingt vergleichbar". Eine amtliche Rueckrechnung gibt es nur fuer
 * Kreise (2012-2021), nicht fuer Gemeinden.
 *
 * Hier: die Jahresrate als geometrisches Mittel der JAHRESSCHRITTE, und der
 * Schritt ueber den Bruch (2021 -> 2022) wird ausgelassen. Jeder Schritt
 * vergleicht zwei Werte derselben Basis. Ohne Bruch in der Reihe ist das
 * genau (letzter / erster)^(1/Jahre) - 1 wie bisher.
 * Das ist eine methodische Folgerung von DealPilot, keine amtliche Vorgabe;
 * sie wird im Bericht so benannt.
 *
 * reihe: [{ jahr, wert }] - Reihenfolge egal. Rueckgabe: null oder
 * { v (% p. a.), von, bis, bruch_ausgelassen }. Reine Funktion. */

export const ZENSUS_BRUCH = { vor: 2021, nach: 2022 };

export function bevoelkerungTrend(reihe) {
  const r = (reihe || []).filter((x) => x && Number.isFinite(Number(x.jahr)) && Number(x.wert) > 0)
    .map((x) => ({ jahr: Number(x.jahr), wert: Number(x.wert) }))
    .sort((a, b) => a.jahr - b.jahr);
  if (r.length < 2) return null;
  let logSumme = 0, jahre = 0, bruch = false;
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i];
    if (a.jahr <= ZENSUS_BRUCH.vor && b.jahr >= ZENSUS_BRUCH.nach) { bruch = true; continue; }
    logSumme += Math.log(b.wert / a.wert);
    jahre += b.jahr - a.jahr;
  }
  if (!(jahre > 0)) return null;
  return { v: (Math.exp(logSumme / jahre) - 1) * 100, von: r[0].jahr, bis: r[r.length - 1].jahr, bruch_ausgelassen: bruch };
}
