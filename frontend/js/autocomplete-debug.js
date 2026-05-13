/**
 * V174 — Autocomplete Diagnose-Tool
 * ═══════════════════════════════════════════════════════════════════
 *
 * Browser-Konsole:
 *   DealPilotAutocompleteDebug.check()   — Prüft ob autocomplete.js geladen ist
 *   DealPilotAutocompleteDebug.testQuery('Berlin Hauptstr')  — Test-Suche bei Nominatim
 *
 * Hilft zu prüfen warum Adress-Vorschläge ggf. nicht erscheinen.
 */
(function () {
  'use strict';

  function check() {
    console.log('═══ Autocomplete-Check ═══');

    // Ist autocomplete.js installiert?
    var hasAutocomplete = !!(window.DealPilotAutocomplete);
    console.log('  window.DealPilotAutocomplete: ' + (hasAutocomplete ? '✓' : '✗'));

    // Ist es an str/ort-Feldern gehookt?
    var strField = document.getElementById('str');
    var ortField = document.getElementById('ort');
    console.log('  Adress-Feld #str: ' + (strField ? '✓ vorhanden' : '✗ nicht im DOM'));
    console.log('  Stadt-Feld #ort: ' + (ortField ? '✓ vorhanden' : '✗ nicht im DOM'));

    if (strField) {
      var hasListener = strField._dpAutocomplete || strField.getAttribute('data-dp-autocomplete');
      console.log('  Autocomplete-Marker auf #str: ' + (hasListener ? '✓' : 'kein Marker sichtbar (kann trotzdem funktionieren)'));
    }

    // Test-Aufruf an Nominatim
    console.log('');
    console.log('  Bitte testen mit:');
    console.log('    DealPilotAutocompleteDebug.testQuery("Hauptstraße 12 Berlin")');
  }

  async function testQuery(q) {
    console.log('═══ Nominatim Test-Query ═══');
    console.log('  Query:', q);
    var url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=de&limit=5&q=' + encodeURIComponent(q);
    console.log('  URL:', url);
    try {
      var t0 = performance.now();
      var resp = await fetch(url, { headers: { 'Accept-Language': 'de' } });
      var dt = (performance.now() - t0).toFixed(0);
      var data = await resp.json();
      console.log('  Antwort in ' + dt + 'ms, HTTP ' + resp.status);
      console.log('  Anzahl Treffer:', data.length);
      data.slice(0, 5).forEach(function (item, i) {
        var addr = item.address || {};
        console.log('  [' + (i + 1) + ']',
          addr.road || addr.pedestrian || addr.footway || '(–)',
          addr.house_number || '',
          '·',
          addr.postcode || '?',
          addr.city || addr.town || addr.village || '?',
          '→', item.lat, item.lon
        );
      });
      if (!data.length) {
        console.warn('  ⚠ Keine Treffer — eventuell Tippfehler oder Nominatim-Rate-Limit (1 req/s)');
      }
    } catch (e) {
      console.error('  ✗ Fehler:', e.message);
    }
  }

  window.DealPilotAutocompleteDebug = { check: check, testQuery: testQuery };
  console.log('[autocomplete-debug V174] geladen — DealPilotAutocompleteDebug.check() / .testQuery("...")');
})();
