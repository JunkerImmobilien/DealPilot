'use strict';
/**
 * V326: AVM-Stub — deterministische Demo-Ergebnisse für PriceHubble + Sprengnetter.
 *
 * ZWECK
 *   Solange AVM_MODE=stub ist, liefert dieses Modul Ergebnisse in EXAKT dem Schema,
 *   das die abgenommene V17-Test-HTML erzeugt — aber OHNE externe (kostenpflichtige)
 *   API-Calls. So lässt sich die komplette Pipeline (UI, Übernahmen, Credit-Modal)
 *   auf Staging gefahrlos testen.
 *
 *   Die Zahlen-Mathematik ist 1:1 aus der V17-Demo portiert (eurPerSqm 1485 / 1620,
 *   Miete 8,50 / 8,80 €/m²), damit der optische Stand identisch bleibt.
 *
 * WICHTIG
 *   Sobald AVM_MODE=live gesetzt wird, übernehmen sprengnetter-client.js /
 *   pricehubble-client.js — die liefern dasselbe Schema, aber aus echten API-Daten.
 */

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  // deutsche Eingaben tolerant lesen: "73,5" / "1.485" / "1485 €"
  var s = String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * PriceHubble-Stub.
 * @param {object} inputs { plz, ort, str, hnr, objektart, wfl, baujahr, kp }
 * @returns {object} Result-Schema (provider 'PriceHubble')
 */
function pricehubbleStub(inputs) {
  inputs = inputs || {};
  var wfl = num(inputs.wfl) || 73;
  var eurPerSqm = 1485;
  var marktwert = Math.round(wfl * eurPerSqm);
  var low = Math.round(marktwert * 0.92);
  var high = Math.round(marktwert * 1.10);
  var marktmieteCold = Math.round(wfl * 8.50);

  return {
    provider: 'PriceHubble',
    mode: 'stub',
    marktwert: marktwert,
    low: low,
    high: high,
    eurPerSqm: eurPerSqm,
    conf: 'Gut',
    confClass: 'good',
    scoreLocation: 6.8,
    scoreMicro: 7.1,
    scoreMacro: 6.5,
    wertentwicklung: 2.42,
    marktmieteCold: marktmieteCold,
    marktmieteEurSqm: 8.50,
    marktmieteLow: Math.round(marktmieteCold * 0.92),
    marktmieteHigh: Math.round(marktmieteCold * 1.10),
    comparables: 47,
    ts: new Date().toISOString()
  };
}

/**
 * Sprengnetter-Stub.
 * @param {object} inputs { plz, ort, str, hnr, objektart, wfl, baujahr, kp }
 * @returns {object} Result-Schema (provider 'Sprengnetter')
 */
function sprengnetterStub(inputs) {
  inputs = inputs || {};
  var wfl = num(inputs.wfl) || 73;
  var eurPerSqm = 1620;
  var marktwert = Math.round(wfl * eurPerSqm);
  var eurMieteSqm = 8.8;
  var marktmiete = Math.round(wfl * eurMieteSqm);
  var kp = num(inputs.kp) || marktwert;

  var diffPct = (kp - marktwert) / marktwert * 100;
  var fpl = diffPct < -10 ? 'TOP_OFFER'
          : diffPct < -3 ? 'GOOD_OFFER'
          : diffPct < 5 ? 'FAIR_OFFER'
          : diffPct < 15 ? 'EXPENSIVE'
          : 'VERY_EXPENSIVE';

  return {
    provider: 'Sprengnetter',
    mode: 'stub',
    marktwert: marktwert,
    low: Math.round(marktwert * 0.91),
    high: Math.round(marktwert * 1.12),
    eurPerSqm: eurPerSqm,
    conf: 'Gut',
    confClass: 'good',
    confidenceRaw: 0.72,
    standardError: 5.4,
    marktmieteCold: marktmiete,
    marktmieteLow: Math.round(marktmiete * 0.91),
    marktmieteHigh: Math.round(marktmiete * 1.12),
    marktmieteEurSqm: eurMieteSqm,
    rentScore: 0.68,
    wertentwicklung: 2.18,
    grossYield: marktmiete * 12 / marktwert * 100,
    priceFactor: marktwert / (marktmiete * 12),
    fairPriceLabel: fpl,
    fairPriceValue: marktwert,
    priceRangeMin: Math.round(eurPerSqm * 0.78),
    priceRangeMax: Math.round(eurPerSqm * 1.28),
    timeseriesPoints: 40,
    timeseriesStart: { date: '2016-01-01', value: Math.round(marktwert * 0.74) },
    timeseriesEnd: { date: new Date().toISOString().slice(0, 10), value: marktwert },
    sepi: {
      top: Math.round(eurPerSqm * 1.18),
      medium: eurPerSqm,
      low: Math.round(eurPerSqm * 0.82)
    },
    ts: new Date().toISOString()
  };
}

module.exports = { pricehubbleStub: pricehubbleStub, sprengnetterStub: sprengnetterStub, num: num };
