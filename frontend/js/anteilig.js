/* V268-01: Anteilig-Helper für Kaufjahr-basierte Berechnung
 * WU (Wirtschaftlicher Übergang) ist führend, Kaufdatum ist Fallback.
 * Pure functions, keine DOM-Manipulation außer read-only Lookups.
 */
(function() {
  'use strict';

  /** ISO-Datum aus Input lesen. Returns "YYYY-MM-DD" or null. */
  function _readDate(id) {
    var el = document.getElementById(id);
    if (!el || !el.value) return null;
    var v = el.value.trim();
    // type="date" liefert immer YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return null;
  }

  /** Relevantes Datum: WU führend, kaufdat fallback. */
  function getRelevantDate() {
    var wu = _readDate('wirtschaftlicher_uebergang');
    if (wu) return wu;
    return _readDate('kaufdat');
  }

  /** Monatsfaktor für Jahr 1: (13 - month) / 12.
   *  Beispiel: April (Monat 4) → (13-4)/12 = 9/12 = 0.75
   *  Sicherheits-Check: nur wenn dateISO im sinnvollen Bereich.
   */
  function startFactorMonths(dateISO, year) {
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return 1;
    var parts = dateISO.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (!y || !m || m < 1 || m > 12) return 1;
    if (year !== undefined && year !== y) return 1; // nur Jahr 1 anteilig
    return (13 - m) / 12;
  }

  /** Kaufjahr (oder WU-Jahr) für Streifen/Projektions-Anzeige.
   *  Returns Year-Integer oder null. Mit Safeguard gegen Tippfehler.
   */
  function getBaseYear() {
    var rd = getRelevantDate();
    if (!rd) return null;
    var y = parseInt(rd.split('-')[0], 10);
    var nowY = new Date().getFullYear();
    // Schutz: nicht mehr als 30 Jahre Vergangenheit, nicht mehr als 5 Jahre Zukunft
    if (!y || y < nowY - 30 || y > nowY + 5) return null;
    return y;
  }

  /** Default-Belegung von WU beim Laden eines Objekts.
   *  Bestand: WU leer + kaufdat gesetzt → WU = kaufdat
   *  Neu: WU leer + kaufdat leer → WU = heute
   *  Bestehender Wert wird NIE überschrieben.
   *
   *  Wird von storage.js loadData() aufgerufen (über Hook).
   */
  function ensureDefault(opts) {
    opts = opts || {};
    var wu = document.getElementById('wirtschaftlicher_uebergang');
    if (!wu) return false;
    if (wu.value) return false; // schon befüllt: nicht überschreiben

    var kd = document.getElementById('kaufdat');
    if (kd && kd.value) {
      wu.value = kd.value;
      return 'kaufdat';
    }
    if (opts.fillToday) {
      var d = new Date();
      wu.value = d.getFullYear() + '-' +
                 String(d.getMonth()+1).padStart(2,'0') + '-' +
                 String(d.getDate()).padStart(2,'0');
      return 'today';
    }
    return false;
  }

  window.DealPilotAnteilig = {
    getRelevantDate: getRelevantDate,
    getBaseYear:     getBaseYear,
    startFactorMonths: startFactorMonths,
    ensureDefault:   ensureDefault,
    _meta: 'V268-01'
  };
})();
