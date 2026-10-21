/* lage_stufen.js — v2518 · EINE Skala fuer die Lage-Einstufungen
 * ──────────────────────────────────────────────────────────────────────
 * Marcel am 20.10.2026: „die Stufensysteme bitte angleichen auf EINE
 * Skala, dieselbe in Bericht und Messdienst".
 *
 * Gemessen vorher (20.10.2026), drei Skalen fuer dieselben Merkmale:
 *   Bericht (MarketInsights/Orchestrator)  3 Stufen  Mikro gut/mittel/begrenzt
 *                                                    (75/55), Makro gut/durch-
 *                                                    schnittlich/schwach (60/45),
 *                                                    Nachfrage hoch/mittel/niedrig
 *                                                    (60/120 Tage), Leerstand
 *                                                    niedrig/moderat/erhoeht (3/6 %)
 *   Messdienst (LageMessungService)        5 Stufen  Nachfrage aus dem Leerstand
 *   Haupt-App (dealpilot-mb.js, Formular)  5 Stufen  = die Auswahllisten im Reiter
 *                                                    Objekt
 * Massstab ist die FUENFSTUFIGE Skala des Formulars: dort steht der Wert am
 * Ende, und eine Stufe, die das Formular nicht kennt, laesst sich nicht
 * uebernehmen. Die Werte (stufe) sind die Optionswerte der Auswahllisten in
 * frontend/index.html, die Worte deren Beschriftung.
 *
 * Die Schwellen und ihre Begruendung:
 *   makrolage   Score 0-100: 75 / 60 / 45 / 30. Die mittleren (60, 45) sind
 *               die des Berichts seit v2158; 75 und 30 als aeussere Stufen
 *               je 15 Punkte daneben (Haupt-App seit v1316).
 *   mikrolage   Score 0-100: 85 / 75 / 55 / 35. 75 und 55 sind die des
 *               Berichts; der Umfeld-Score ist bei 0,98 gedeckelt, „sehr gut"
 *               verlangt deshalb 85, „sehr schwach" unter 35.
 *   bevoelkerung  % p. a.: +0,8 / +0,2 / -0,2 / -0,8. Ein Band von +/-0,2 %
 *               je Jahr ist „stabil" (Rundungs- und Fortschreibungsrauschen,
 *               rund 2 % in zehn Jahren); ab 0,8 % je Jahr (rund 8 % in zehn
 *               Jahren) „stark".
 *   nachfrage   Vermarktungsdauer der Angebote, Median Tage (Kauf, letzte
 *               12 Monate): 30 / 60 / 120 / 200. 60 und 120 sind die des
 *               Berichts; ein Monat und rund ein halbes Jahr aussen.
 *   mietausfall Marktaktiver Leerstand laut Zensus 2022, %: 1,5 / 3 / 6 / 9.
 *               3 und 6 sind die des Berichts (v1316 „Leerstand qualitativ");
 *               unter 1,5 % gilt der Markt als angespannt (Fluktuationsreserve),
 *               ab 9 % als strukturell leer.
 *   wertsteigerung  Preis-CAGR % p. a.: 3 / 2 / 1 / >0. Die Skala der
 *               Haupt-App (wc() in dealpilot-mb.js) - der Bericht hatte 3/1/0
 *               mit vier Worten, die das Formular nicht kennt.
 * Alle Schwellen sind MODELLANNAHMEN von DealPilot, keine amtlichen Werte -
 * so stehen sie auch am Feld.
 *
 * Ton: Stufe 1-2 gut, 3 mittel, 4-5 schwach - fuer jede Skala gleich, auch
 * beim Mietausfallrisiko (dort ist „sehr niedrig" die gute Stufe). */

export const SKALEN = {
  makrolage: {
    stufen: [[75, 'sehr_gut', 'sehr gut'], [60, 'gut', 'gut'], [45, 'durchschnittlich', 'durchschnittlich'],
             [30, 'schwach', 'schwach'], [-Infinity, 'sehr_schwach', 'sehr schwach']],
    text: '≥75 sehr gut · ≥60 gut · ≥45 durchschnittlich · ≥30 schwach · darunter sehr schwach (Score 0–100)',
  },
  mikrolage: {
    stufen: [[85, 'sehr_gut', 'sehr gut'], [75, 'gut', 'gut'], [55, 'durchschnittlich', 'durchschnittlich'],
             [35, 'schwach', 'schwach'], [-Infinity, 'sehr_schwach', 'sehr schwach']],
    text: '≥85 sehr gut · ≥75 gut · ≥55 durchschnittlich · ≥35 schwach · darunter sehr schwach (Score 0–100)',
  },
  bevoelkerung: {
    stufen: [[0.8, 'stark_wachsend', 'stark wachsend'], [0.2, 'wachsend', 'wachsend'], [-0.2, 'stabil', 'stabil'],
             [-0.8, 'leicht_fallend', 'leicht fallend'], [-Infinity, 'stark_fallend', 'stark fallend']],
    text: '≥0,8 %/J stark wachsend · ≥0,2 wachsend · ≥−0,2 stabil · ≥−0,8 leicht fallend · darunter stark fallend',
  },
  /* absteigend: kleiner Wert = bessere Stufe; Grenze gilt inklusive (<=) */
  nachfrage: {
    absteigend: true,
    stufen: [[30, 'sehr_stark', 'sehr stark'], [60, 'stark', 'stark'], [120, 'mittel', 'mittel'],
             [200, 'schwach', 'schwach'], [Infinity, 'sehr_schwach', 'sehr schwach']],
    text: '≤30 Tage sehr stark · ≤60 stark · ≤120 mittel · ≤200 schwach · darüber sehr schwach (Vermarktungsdauer der Angebote, Median)',
  },
  mietausfall: {
    absteigend: true, streng: true,
    stufen: [[1.5, 'sehr_niedrig', 'sehr niedrig'], [3, 'niedrig', 'niedrig'], [6, 'mittel', 'mittel'],
             [9, 'erhoeht', 'erhöht'], [Infinity, 'hoch', 'hoch']],
    text: '<1,5 % sehr niedrig · <3 % niedrig · <6 % mittel · <9 % erhöht · darüber hoch (marktaktiver Leerstand laut Zensus 2022)',
  },
  wertsteigerung: {
    stufen: [[3, 'sehr_hoch', 'sehr hoch'], [2, 'hoch', 'hoch'], [1, 'mittel', 'mittel'],
             [1e-9, 'niedrig', 'niedrig'], [-Infinity, 'keines', 'keines']],
    text: '≥3 %/J sehr hoch · ≥2 hoch · ≥1 mittel · >0 niedrig · sonst keines (Angebotspreise, Entwicklung je Jahr)',
  },
};

const TON = ['gut', 'gut', 'mittel', 'schwach', 'schwach'];

/* -> { stufe, wort, ton, index } | null. Kein Wert, keine Stufe. */
export function einstufen(skala, wert) {
  const s = SKALEN[skala];
  if (!s || wert == null || wert === '' || !Number.isFinite(Number(wert))) return null;
  const v = Number(wert);
  const i = s.absteigend
    ? s.stufen.findIndex(([g]) => (s.streng ? v < g : v <= g))
    : s.stufen.findIndex(([g]) => v >= g);
  if (i < 0) return null;
  return { stufe: s.stufen[i][1], wort: s.stufen[i][2], ton: TON[i], index: i + 1 };
}

export function schwelleText(skala) { return (SKALEN[skala] && SKALEN[skala].text) || ''; }

/* Marktaktiver Leerstand laut Zensus 2022, Gemeinde vor Kreis (v2501:
   die oberste Ebene von lookupDb() ist der KREIS). -> { wert, ebene, name } | null */
export function zensusLeerstand(z) {
  if (!z || !z.available) return null;
  const g = z.gemeinde && z.gemeinde.leerstandsquote_marktaktiv != null ? z.gemeinde : null;
  if (g) return { wert: Number(g.leerstandsquote_marktaktiv), ebene: 'Gemeinde', name: g.name || null };
  if (z.leerstandsquote_marktaktiv != null) return { wert: Number(z.leerstandsquote_marktaktiv), ebene: 'Kreis', name: z.kreis_name || null };
  return null;
}
export const ZENSUS_LEERSTAND_TEXT = 'Leerstand laut Zensus 2022 (Stichtag 15.05.2022)';
