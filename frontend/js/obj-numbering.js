'use strict';
/* ═══════════════════════════════════════════════════
   DEALPILOT V23 – obj-numbering.js
   Vergibt + verwaltet Objektnummern im Schema "JJJJ-NNN".
   - Reset pro Jahr (jeder 1. Januar startet neu bei 001)
   - Pro User getrennter Counter
   - Im API-Modus: Backend kennt höchste Nummer und vergibt sie
   - Im Local-Modus: localStorage-Counter pro Jahr+User

   Public API:
     ObjNumbering.next()                 → assignt + liefert "2026-007"
     ObjNumbering.format(year, seq)      → "2026-007"
     ObjNumbering.peekNextLocal(year)    → schaut den Counter an, ohne zu inkrementieren
     ObjNumbering.registerExisting(num)  → upgradet den Counter wenn ein importierter Wert höher ist
═══════════════════════════════════════════════════ */

window.ObjNumbering = (function() {

  function _userPrefix() {
    if (typeof Auth !== 'undefined' && typeof Auth.getStorageKey === 'function') {
      return Auth.getStorageKey('seq_');
    }
    return 'dp_seq_';
  }

  function _counterKey(year) {
    return _userPrefix() + year;
  }

  function format(year, seq) {
    var s = String(seq);
    while (s.length < 3) s = '0' + s;
    return year + '-' + s;
  }

  /**
   * Parst ein Format "2026-007" → { year: 2026, seq: 7 }, oder null.
   */
  function parse(str) {
    if (!str) return null;
    var m = String(str).match(/^(\d{4})-(\d{1,4})$/);
    if (!m) return null;
    return { year: parseInt(m[1], 10), seq: parseInt(m[2], 10) };
  }

  /**
   * Schaut den nächsten Wert für ein Jahr im localStorage an (ohne zu inkrementieren).
   */
  function peekNextLocal(year) {
    if (year == null) year = new Date().getFullYear();
    var n = parseInt(localStorage.getItem(_counterKey(year)) || '0', 10);
    return format(year, n + 1);
  }

  /**
   * Liefert die nächste Sequenznummer + inkrementiert.
   * Nutzt das aktuelle Jahr.
   */
  function next() {
    var year = new Date().getFullYear();
    // V23: Bevor wir vergeben, scannen wir alle bereits gespeicherten Objekte
    // dieses Users im aktuellen Jahr und nehmen das Maximum als Basis.
    // Dadurch kann der User Objekte importieren ohne Konflikt.
    _bumpFromExisting(year);
    var key = _counterKey(year);
    var n = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, String(n));
    return format(year, n);
  }

  /**
   * Nach einem Import ein vorhandenes Objekt registrieren — falls dessen
   * Nummer höher ist als der lokale Counter, wird der Counter angehoben.
   */
  function registerExisting(numStr) {
    var p = parse(numStr);
    if (!p) return;
    var key = _counterKey(p.year);
    var current = parseInt(localStorage.getItem(key) || '0', 10);
    if (p.seq > current) localStorage.setItem(key, String(p.seq));
  }

  /**
   * Geht alle gespeicherten Objekte des aktuellen Users durch und stellt sicher,
   * dass der Counter mindestens auf der höchsten gefundenen Nummer steht.
   */
  function _bumpFromExisting(year) {
    try {
      var prefix = _userPrefixForObjects();
      var max = 0;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(prefix) !== 0) continue;
        try {
          var d = JSON.parse(localStorage.getItem(k) || '{}');
          if (d && d._obj_seq) {
            var p = parse(d._obj_seq);
            if (p && p.year === year && p.seq > max) max = p.seq;
          }
        } catch (e) { /* skip */ }
      }
      if (max > 0) {
        var key = _counterKey(year);
        var current = parseInt(localStorage.getItem(key) || '0', 10);
        if (max > current) localStorage.setItem(key, String(max));
      }
    } catch (e) { /* nicht kritisch */ }
  }

  function _userPrefixForObjects() {
    if (typeof Auth !== 'undefined' && typeof Auth.getStorageKey === 'function') {
      return Auth.getStorageKey('obj_');
    }
    return 'ji_';
  }

  return {
    next: next,
    format: format,
    parse: parse,
    peekNextLocal: peekNextLocal,
    registerExisting: registerExisting
  };
})();
