'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   DealPilot V36 — Unit Tests für DealScore 2.0 + parseDe
   
   Lauffähig direkt mit Node:
     node tests/dealscore2.test.js
   
   Tests prüfen:
   - parseDe (deutsche/amerikanische Zahlen, Tausender, Edge-Cases)
   - DealScore2.interpolate (lineare Interpolation)
   - DealScore2.bucketLookup (LTV/Tilgung-Bereiche)
   - DealScore2.compute mit verschiedenen Deal-Profilen
   - LTV+DSCR Interaction-Adjustments
   - Fallback-Verhalten bei fehlenden KPIs
═══════════════════════════════════════════════════════════════════════════ */

// Browser-API stubben
global.window = {};
global.localStorage = {
  _data: {},
  getItem: function(k) { return this._data[k] || null; },
  setItem: function(k, v) { this._data[k] = String(v); },
  removeItem: function(k) { delete this._data[k]; }
};

// parseDe aus calc.js extrahieren (ohne den ganzen calc.js zu laden)
var fs = require('fs');
var path = require('path');
var calcJs = fs.readFileSync(path.join(__dirname, '../frontend/js/calc.js'), 'utf8');
// Funktions-Body mit Brace-Tracking finden
function extractFn(src, name) {
  var sigPat = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{');
  var m = src.match(sigPat);
  if (!m) return null;
  var start = m.index;
  var bodyStart = start + m[0].length;
  var depth = 1, i = bodyStart;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(start, i);
}
var parseDeSrc = extractFn(calcJs, 'parseDe');
if (!parseDeSrc) { console.error('parseDe nicht gefunden in calc.js'); process.exit(1); }
// In globalen Scope evaluieren
global.parseDe = (new Function(parseDeSrc + '\nreturn parseDe;'))();

// DealScore2 laden
require('../frontend/js/dealscore2.js');
var DS = global.window.DealScore2;

/* ─────────────────────────────────────────────────────────────
   Mini-Test-Framework
───────────────────────────────────────────────────────────── */
var tests = 0, passed = 0, failed = 0;
var failures = [];

function test(name, fn) {
  tests++;
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (err) {
    failed++;
    failures.push({ name: name, err: err });
    console.log('  ✗ ' + name);
    console.log('      ' + err.message);
  }
}
function group(name, fn) {
  console.log('\n[' + name + ']');
  fn();
}
function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || '') + '\n      expected: ' + JSON.stringify(expected) + '\n      actual:   ' + JSON.stringify(actual));
  }
}
function near(actual, expected, eps, msg) {
  eps = eps || 0.01;
  if (Math.abs(actual - expected) > eps) {
    throw new Error((msg || '') + ' (eps=' + eps + ')\n      expected: ' + expected + '\n      actual:   ' + actual);
  }
}
function truthy(actual, msg) {
  if (!actual) throw new Error((msg || 'expected truthy') + '\n      actual: ' + JSON.stringify(actual));
}

/* ═══════════════════════════════════════════════════════════════
   parseDe — deutsche Zahleneingabe
═══════════════════════════════════════════════════════════════ */
group('parseDe', function() {
  test('"3,5" → 3.5', function() { eq(parseDe('3,5'), 3.5); });
  test('"3.5" → 3.5', function() { eq(parseDe('3.5'), 3.5); });
  test('"1.250,50" → 1250.5 (DE Format)', function() { eq(parseDe('1.250,50'), 1250.5); });
  test('"1,250.50" → 1250.5 (US Format)', function() { eq(parseDe('1,250.50'), 1250.5); });
  test('"1.250" → 1250 (DE Tausender, 3 Ziffern)', function() { eq(parseDe('1.250'), 1250); });
  test('"1.250.000" → 1250000', function() { eq(parseDe('1.250.000'), 1250000); });
  test('"3.50" → 3.5 (Dezimal mit 2 Stellen)', function() { eq(parseDe('3.50'), 3.5); });
  test('"12.5" → 12.5 (Dezimal mit 1 Stelle)', function() { eq(parseDe('12.5'), 12.5); });
  test('"-3,5" → -3.5', function() { eq(parseDe('-3,5'), -3.5); });
  test('"  €5,75  " → 5.75 (Whitespace + Currency)', function() { eq(parseDe('  €5,75  '), 5.75); });
  test('"" → 0', function() { eq(parseDe(''), 0); });
  test('null → 0', function() { eq(parseDe(null), 0); });
  test('Zahl 3.5 → 3.5 (passthrough)', function() { eq(parseDe(3.5), 3.5); });
  test('"abc" → 0 (ungültig)', function() { eq(parseDe('abc'), 0); });
});

/* ═══════════════════════════════════════════════════════════════
   DealScore2.interpolate
═══════════════════════════════════════════════════════════════ */
group('DealScore2.interpolate', function() {
  var pts = [[0, 0], [50, 50], [100, 100]];
  test('exakter Punkt', function() { eq(DS.interpolate(50, pts), 50); });
  test('Linear zwischen Punkten', function() { eq(DS.interpolate(25, pts), 25); });
  test('Wert <= erster Punkt → erster Punkt', function() { eq(DS.interpolate(-10, pts), 0); });
  test('Wert >= letzter Punkt → letzter Punkt', function() { eq(DS.interpolate(150, pts), 100); });
  test('null → null', function() { eq(DS.interpolate(null, pts), null); });

  // Realistische Bruttorendite-Schwellen
  var bmr = [[4, 20], [5, 50], [7, 80], [9, 100]];
  test('Bruttorendite 6% → 65 (zwischen 50 und 80)', function() { eq(DS.interpolate(6, bmr), 65); });
  test('Bruttorendite 4.5% → 35', function() { eq(DS.interpolate(4.5, bmr), 35); });
  test('Bruttorendite 3% (unter Min) → 20', function() { eq(DS.interpolate(3, bmr), 20); });
});

/* ═══════════════════════════════════════════════════════════════
   DealScore2.bucketLookup
═══════════════════════════════════════════════════════════════ */
group('DealScore2.bucketLookup', function() {
  var ltvBuckets = [
    { min: 0, max: 70, points: 85 },
    { min: 70, max: 85, points: 95 },
    { min: 85, max: 95, points: 100 },
    { min: 95, max: 105, points: 75 },
    { min: 105, max: 999, points: 30 }
  ];
  test('LTV 50% → 85', function() { eq(DS.bucketLookup(50, ltvBuckets), 85); });
  test('LTV 80% → 95', function() { eq(DS.bucketLookup(80, ltvBuckets), 95); });
  test('LTV 90% → 100 (Best Case)', function() { eq(DS.bucketLookup(90, ltvBuckets), 100); });
  test('LTV 100% → 75', function() { eq(DS.bucketLookup(100, ltvBuckets), 75); });
  test('LTV 110% → 30 (Über 105%)', function() { eq(DS.bucketLookup(110, ltvBuckets), 30); });
  test('null → null', function() { eq(DS.bucketLookup(null, ltvBuckets), null); });
});

/* ═══════════════════════════════════════════════════════════════
   DealScore2.compute — kompletter Score
═══════════════════════════════════════════════════════════════ */
group('DealScore2.compute', function() {
  // Profil 1: Top-Deal
  test('Top-Deal mit allen Topwerten → 80+', function() {
    var deal = {
      bruttorendite: 8.0, nettorendite: 5.5, cashflowMonatlich: 350, cashOnCash: 8,
      dscr: 1.4, ltv: 90, zinsSatz: 3.0, tilgung: 2.5, eigenkapitalQuote: 12,
      leerstandPct: 2, instandhaltungPctNkm: 7,
      zustand: 'gut', energieKlasse: 'B', mietausfallRisiko: 'niedrig',
      istMieteEurQm: 8, marktmieteEurQm: 9, mietwachstumPct: 3,
      bevoelkerung: 'wachsend', nachfrage: 'stark', mikrolage: 'gut',
      eigenerFaktor: 18, marktFaktor: 22, wertsteigerung: 'hoch',
      entwicklungsmoeglichkeiten: 'eine_starke'
    };
    var r = DS.compute(deal);
    truthy(r.score >= 75, 'Score sollte >=75 sein, war ' + r.score);
    truthy(r.score <= 100, 'Score <=100, war ' + r.score);
    eq(r.color, r.score >= 85 ? 'green-strong' : 'green');
  });

  // Profil 2: Schwacher Deal
  test('Schlechter Deal → < 50', function() {
    var deal = {
      bruttorendite: 3.0, nettorendite: 1.5, cashflowMonatlich: -250, cashOnCash: -2,
      dscr: 0.85, ltv: 110, zinsSatz: 5.5, tilgung: 0.5, eigenkapitalQuote: 5,
      leerstandPct: 15, instandhaltungPctNkm: 35,
      zustand: 'stark_sanierungsbeduerftig', energieKlasse: 'H', mietausfallRisiko: 'hoch',
      istMieteEurQm: 12, marktmieteEurQm: 8, mietwachstumPct: -1,
      bevoelkerung: 'stark_fallend', nachfrage: 'sehr_schwach', mikrolage: 'problematisch',
      eigenerFaktor: 30, marktFaktor: 22, wertsteigerung: 'keines',
      entwicklungsmoeglichkeiten: 'keine'
    };
    var r = DS.compute(deal);
    truthy(r.score < 50, 'Score sollte <50 sein, war ' + r.score);
    eq(r.color, 'red');
    eq(r.label, 'Schwach');
  });

  // Profil 3: Leerer Deal — alle Felder undefined → neutralFallback (60) je Kategorie
  test('Leerer Deal → ~60 (neutral)', function() {
    var r = DS.compute({});
    near(r.score, 60, 5, 'Score nahe 60 erwartet, war ' + r.score);
    eq(r.color, 'gold');
  });

  // Profil 4: Ampel-Logik
  test('Ampel rot bei <50', function() {
    eq(DS.compute({ bruttorendite: 2 }).color === 'red' || DS.compute({ bruttorendite: 2 }).score >= 50, true);
  });

  // Profil 5: Score-Begrenzung 0-100
  test('Score immer 0-100', function() {
    [
      { bruttorendite: -100, nettorendite: -100 },
      { bruttorendite: 999, nettorendite: 999 }
    ].forEach(function(d) {
      var r = DS.compute(d);
      truthy(r.score >= 0 && r.score <= 100, 'Score im Range 0-100, war ' + r.score);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   LTV+DSCR Interaction
═══════════════════════════════════════════════════════════════ */
group('LTV+DSCR Interaction', function() {
  test('LTV 100% + DSCR 1.30 → +5 Bonus', function() {
    var r = DS._scoreFinanzierung({
      ltv: 100, dscr: 1.30, zinsSatz: 4, tilgung: 2, eigenkapitalQuote: 5
    }, DS.getDefaults());
    truthy(r.interactionAdjustment === 5, 'Bonus 5 erwartet, war ' + r.interactionAdjustment);
  });
  test('LTV 100% + DSCR 0.90 → -20 Malus', function() {
    var r = DS._scoreFinanzierung({
      ltv: 100, dscr: 0.90, zinsSatz: 4, tilgung: 2, eigenkapitalQuote: 5
    }, DS.getDefaults());
    truthy(r.interactionAdjustment === -20, 'Malus -20 erwartet, war ' + r.interactionAdjustment);
  });
  test('LTV 110% + DSCR 1.05 → -25 Malus', function() {
    var r = DS._scoreFinanzierung({
      ltv: 110, dscr: 1.05, zinsSatz: 4, tilgung: 2, eigenkapitalQuote: 5
    }, DS.getDefaults());
    truthy(r.interactionAdjustment === -25, 'Malus -25 erwartet, war ' + r.interactionAdjustment);
  });
  test('Kein Trigger bei moderaten Werten', function() {
    var r = DS._scoreFinanzierung({
      ltv: 80, dscr: 1.20, zinsSatz: 4, tilgung: 2, eigenkapitalQuote: 15
    }, DS.getDefaults());
    truthy(!r.interactionAdjustment, 'Kein Adjustment, war ' + r.interactionAdjustment);
  });
  test('Score nach Adjustment auf 0-100 begrenzt', function() {
    // Künstlich: schwache Finanzierung + Malus, sollte bei 0 floor'en
    var r = DS._scoreFinanzierung({
      ltv: 110, dscr: 0.5, zinsSatz: 6, tilgung: 0.5, eigenkapitalQuote: 50
    }, DS.getDefaults());
    truthy(r.score >= 0 && r.score <= 100, 'Score im Range, war ' + r.score);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Fallback bei fehlenden KPIs
═══════════════════════════════════════════════════════════════ */
group('Fallback fehlende Werte', function() {
  test('Kategorie ohne KPIs → neutralFallback', function() {
    var r = DS._scoreLage({}, DS.getDefaults());
    eq(r.score, 60, 'neutralFallback 60 erwartet');
    eq(r.availableKpis, 0);
  });
  test('Kategorie mit teilweisen KPIs → nur verfügbare zählen', function() {
    var cfg = DS.getDefaults();
    var r = DS._scoreRendite({ bruttorendite: 7 }, cfg);
    eq(r.availableKpis, 1);
    eq(Math.round(r.score), 80);   // BMR 7% = 80 Punkte (Konzept)
  });
});

/* ═══════════════════════════════════════════════════════════════
   Konfig-Persistenz
═══════════════════════════════════════════════════════════════ */
group('Config-Persistenz', function() {
  test('getDefaults liefert frisches Objekt', function() {
    var d1 = DS.getDefaults();
    d1.weights.rendite = 999;
    var d2 = DS.getDefaults();
    eq(d2.weights.rendite, 35, 'Defaults dürfen nicht mutiert werden');
  });
  test('saveConfig/loadConfig Round-Trip', function() {
    var cfg = DS.getDefaults();
    cfg.weights.rendite = 50;
    DS.saveConfig(cfg);
    var loaded = DS.loadConfig();
    eq(loaded.weights.rendite, 50);
    DS.resetConfig();
    var fresh = DS.loadConfig();
    eq(fresh.weights.rendite, 35, 'Reset stellt Default wieder her');
  });
});

/* ═══════════════════════════════════════════════════════════════
   Zusammenfassung
═══════════════════════════════════════════════════════════════ */
console.log('\n══════════════════════════════════════');
console.log(' Tests: ' + tests + ' · ✓ ' + passed + ' · ✗ ' + failed);
console.log('══════════════════════════════════════');
if (failed > 0) {
  console.log('\nFailed:');
  failures.forEach(function(f) {
    console.log(' - ' + f.name);
    console.log('   ' + f.err.message.split('\n').join('\n   '));
  });
  process.exit(1);
}
process.exit(0);
