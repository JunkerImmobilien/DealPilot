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

  // ═══════════════════════════════════════════════════════════════
  // V269-01: Finanzierungs-Anteilig (für Zins+Tilgung Jahr 1)
  // ═══════════════════════════════════════════════════════════════

  /** Parse d1_auszahl in verschiedenen Formaten.
   *  Akzeptiert: "MM.YYYY", "M.YYYY", "YYYY-MM", "MM/YYYY", "M/YYYY"
   *  Returns: {year, month} (1-12) oder null
   */
  function parseD1Auszahl(str) {
    if (!str || typeof str !== 'string') return null;
    var s = str.trim();
    var m;
    if ((m = s.match(/^(\d{1,2})\.(\d{4})$/))) {
      return { month: parseInt(m[1], 10), year: parseInt(m[2], 10) };
    }
    if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) {
      return { month: parseInt(m[1], 10), year: parseInt(m[2], 10) };
    }
    if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) {
      return { month: parseInt(m[2], 10), year: parseInt(m[1], 10) };
    }
    return null;
  }

  /** Cascade: d1_auszahl > WU > kaufdat. Returns "YYYY-MM-01" oder null. */
  function getFinanzierungStartDate() {
    var auszahlEl = document.getElementById('d1_auszahl');
    if (auszahlEl && auszahlEl.value) {
      var parsed = parseD1Auszahl(auszahlEl.value);
      if (parsed && parsed.month >= 1 && parsed.month <= 12) {
        return parsed.year + '-' + String(parsed.month).padStart(2, '0') + '-01';
      }
    }
    return getRelevantDate();
  }

  /** Year-Int für Finanzierungs-Start mit Safeguards. */
  function getFinanzierungBaseYear() {
    var rd = getFinanzierungStartDate();
    if (!rd) return null;
    var y = parseInt(rd.split('-')[0], 10);
    var nowY = new Date().getFullYear();
    if (!y || y < nowY - 30 || y > nowY + 5) return null;
    return y;
  }

  /** Anzahl aktiver Monate in `year`, gerechnet ab `startISO`.
   *  startISO=2024-04-01, year=2024 → 9 (Apr-Dez)
   *  startISO=2023-12-01, year=2024 → 12 (volles Jahr)
   *  startISO=2025-03-01, year=2024 → 0 (Start nach Jahr)
   */
  function getFinanzierungMonths(startISO, year) {
    if (!startISO || !year) return 12;
    var parts = startISO.split('-');
    var sy = parseInt(parts[0], 10);
    var sm = parseInt(parts[1], 10);
    if (!sy || !sm) return 12;
    if (sy < year) return 12;
    if (sy > year) return 0;
    return Math.max(0, 13 - sm);
  }

  /** Exakte Monatsschleife für Annuität Jahr 1.
   *  d: Darlehenssumme, dz_pct: Zins in %, dt_pct: Tilgung in %, months: aktive Monate
   *  Returns: {zins, tilg, restschuld}
   */
  function computeY1Annuitaet(d, dz_pct, dt_pct, months) {
    if (!d || d <= 0 || !months || months <= 0) {
      return { zins: 0, tilg: 0, restschuld: d || 0 };
    }
    var z_decimal = (dz_pct || 0) / 100;
    var t_decimal = (dt_pct || 0) / 100;
    var rate_m = (d * (z_decimal + t_decimal)) / 12;
    var rs = d;
    var sumZ = 0, sumT = 0;
    var n = Math.min(months, 12);
    for (var k = 0; k < n; k++) {
      var zm = rs * z_decimal / 12;
      var tm = rate_m - zm;
      if (tm > rs) tm = rs;
      sumZ += zm;
      sumT += tm;
      rs -= tm;
      if (rs < 0) rs = 0;
    }
    return { zins: sumZ, tilg: sumT, restschuld: rs };
  }

  /** Aussetzung Jahr 1: nur Zinsen auf voller Restschuld. */
  function computeY1Aussetzung(d, dz_pct, months) {
    if (!d || d <= 0 || !months || months <= 0) {
      return { zins: 0, tilg: 0, restschuld: d || 0 };
    }
    var z_decimal = (dz_pct || 0) / 100;
    var zins_pro_monat = d * z_decimal / 12;
    var sumZ = zins_pro_monat * Math.min(months, 12);
    return { zins: sumZ, tilg: 0, restschuld: d };
  }

  /** Soft-Validation: d1_auszahl vs. kaufdat. V269a2: gelockerte Schwellen.
   *  Returns: {ok: bool, level: 'info'|'warn'|'error', msg: string|null}
   */
  function validateFinanzierungDate() { /* V269a2-validation */
    var kdEl = document.getElementById('kaufdat');
    var auszahlEl = document.getElementById('d1_auszahl');
    if (!auszahlEl || !auszahlEl.value) {
      return { ok: true, level: null, msg: null };
    }
    var parsed = parseD1Auszahl(auszahlEl.value);
    if (!parsed) {
      return { ok: false, level: 'error', msg: 'Format ungültig — bitte MM.YYYY (z.B. 05.2025)' };
    }
    if (!kdEl || !kdEl.value) {
      return { ok: true, level: null, msg: null };
    }
    var kdParts = kdEl.value.split('-');
    if (kdParts.length !== 3) return { ok: true, level: null, msg: null };
    var kdY = parseInt(kdParts[0], 10);
    var kdM = parseInt(kdParts[1], 10);
    var diffMonths = (parsed.year - kdY) * 12 + (parsed.month - kdM);
    // Extreme: >36 Monate Distanz → Tippfehler-Verdacht
    if (diffMonths < -36) {
      return { ok: false, level: 'error', msg: '⚠ Auszahlung mehr als 3 Jahre VOR Kauf — bitte prüfen' };
    }
    if (diffMonths > 36) {
      return { ok: false, level: 'error', msg: '⚠ Auszahlung mehr als 3 Jahre NACH Kauf — bitte prüfen' };
    }
    // Info-Bereich
    if (diffMonths < -6) {
      return { ok: true, level: 'info', msg: 'Auszahlung deutlich vor Kauf' };
    }
    if (diffMonths >= 12 && diffMonths <= 24) {
      return { ok: true, level: 'info', msg: 'Nachträglich finanziert' };
    }
    if (diffMonths > 24) {
      return { ok: true, level: 'warn', msg: 'Auszahlung deutlich nach Kauf — Umschuldung oder Forward?' };
    }
    if (diffMonths < 0) {
      return { ok: true, level: 'info', msg: 'Auszahlung vor Kauf (z.B. Notar-Anderkonto)' };
    }
    // 0-12 Monate nach Kauf: kein Hint (normaler Fall + Umschuldungen im ersten Jahr)
    return { ok: true, level: null, msg: null };
  }

  window.DealPilotAnteilig = {
    // V268-01
    getRelevantDate: getRelevantDate,
    getBaseYear:     getBaseYear,
    startFactorMonths: startFactorMonths,
    ensureDefault:   ensureDefault,
    // V269-01
    parseD1Auszahl:           parseD1Auszahl,
    getFinanzierungStartDate: getFinanzierungStartDate,
    getFinanzierungBaseYear:  getFinanzierungBaseYear,
    getFinanzierungMonths:    getFinanzierungMonths,
    computeY1Annuitaet:       computeY1Annuitaet,
    computeY1Aussetzung:      computeY1Aussetzung,
    validateFinanzierungDate: validateFinanzierungDate,
    _meta: 'V269-01'
  };
})();
