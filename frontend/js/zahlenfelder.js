'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   v3023 · ZAHLENFELDER DEUTSCH ANZEIGEN — eine Schicht fuer alle Reiter
   ═══════════════════════════════════════════════════════════════════════

   GEMESSEN am 28.10.2026 (Lindenallee 2026-1123, Hoelderlinstr. 2026-1008,
   Am Markt 2026-1040): in den Reitern des Objekts standen Zahlen in vier
   Schreibweisen nebeneinander — „3313" und „9600" (Bewirtschaftung, vom
   Import roh geschrieben), „1090000" (Kaufpreis), „3.57" und „1.5"
   (Dezimalpunkt), „6,5" und „68.000" (vom Nutzer deutsch getippt). Die
   Summen daneben zeigten „3.313 €".

   URSACHE: Es gab KEINE Formatierschicht fuer Eingabefelder. `loadData()`
   schreibt `e.value = d[id]` roh, `calc()` schreibt berechnete Felder
   (Makler €, Notar € …) als nackte Zahl, Import/Quick-Check/Sprache/BMF
   ebenso. Gelesen wird ueber `parseDe()` (calc.js), das alle Schreibweisen
   versteht — deshalb rechnete alles richtig, und nur die Anzeige war
   uneinheitlich.

   WARUM NICHT EINFACH DEN WERT FORMATIEREN: rund 35 Stellen lesen Felder
   mit `parseFloat(x.value)` oder `replace(',', '.')` (afa-ui wfl,
   marktbericht-view price=kp, investment-profile kp …), und `collectData()`
   speichert `e.value` als Text, den Portfolio, Track Record und Backend
   wieder mit `parseFloat` lesen. „1.090.000" waere dort 1,09 €.

   DESHALB trennt diese Schicht ANZEIGE und WERT:
     · `.value` liefert weiterhin GENAU den Text, der ohne diese Schicht im
       Feld stuende (`_dpRoh`) — jeder Leser, jede Rechnung und der
       gespeicherte Datensatz sehen dasselbe wie vorher, Byte fuer Byte.
     · Sichtbar ist die deutsche Schreibweise (Tausenderpunkt,
       Dezimalkomma, € ganz oder mit zwei Stellen, % mit Komma).
     · Beim Bearbeiten (Fokus) steht der Rohtext im Feld, wie bisher;
       beim Verlassen wird er wieder deutsch angezeigt.
   Jeder Schreibweg (loadData, calc, Import `_wertSchreiben`, Quick-Check-
   Uebernahme, Sprache, BMF) geht ueber den `value`-Setzer und kommt damit
   formatiert an — ohne dass einer davon angefasst werden muss.

   Jahreszahlen (Baujahr, Modernisierungsjahr, Zielbild-Jahr), PLZ,
   Hausnummer, Flur, Daten: nie formatiert. Ein Text, der keine Zahl ist
   („ca. 5"), bleibt, wie er ist.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpZahlenfelder) return;
  var NATIV = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (!NATIV || !NATIV.get || !NATIV.set) return;

  /* Nie formatieren: Jahreszahlen und Kennungen */
  var NIE = { baujahr: 1, modernis: 1, zb_fertig_jahr: 1, plz: 1, hnr: 1, flur: 1,
              flurstueck: 1, kuerzel: 1, d1_auszahl: 1, d1_vertragsdatum: 1 };
  /* Felder in €/m² — das Praefix sagte nur „€" */
  var EUR_QM = { brw: 1, brw_manuell: 1, hinterland_eur_qm: 1, ds2_marktmiete: 1, me_soll: 1,
                 zb_markt_qm: 1, zb_vgl_qm: 1, zb_soll_qm: 1, zb_ziel_qm: 1 };
  /* Felder, denen die Einheit ganz fehlte (nur im Beschriftungstext) */
  var EINHEIT_FEHLT = { ueberf_rest_zins: '%', mv_abw_jahre: 'J.' };

  function _parse(s) {
    if (s == null) return null;
    var t = String(s).trim();
    if (!t || !/\d/.test(t)) return null;
    if (!/^[-+]?[\d.,\s €%]+$/.test(t)) return null;      /* „ca. 5", „1,5-2" bleiben Text */
    var n = (typeof window.parseDe === 'function') ? window.parseDe(t) : NaN;
    return (typeof n === 'number' && isFinite(n)) ? n : null;
  }

  function _stellen(n) {
    var s = String(Math.abs(n));
    if (/e/i.test(s)) return 6;
    var i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  }

  function _klemm(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  /* Die Einheit wird am Feld ABGELESEN (Praefix, Suffix, .unit, Beschriftung),
     nicht aus dem Namen geraten. */
  function _art(el) {
    var id = el.id || '';
    if (EUR_QM[id]) return 'eur';
    var txt = '';
    var iw = el.closest('.iw, .ass-inp, .fesh-cost');
    if (iw) {
      var u = iw.querySelectorAll('.pfx, .sfx, .unit');
      for (var i = 0; i < u.length; i++) txt += ' ' + u[i].textContent;
      if (iw.classList.contains('fesh-cost')) txt += ' ' + iw.textContent;
    }
    if (!txt.trim()) {
      var f = el.closest('.f, label');
      var lab = f && (f.tagName === 'LABEL' ? f : f.querySelector('label'));
      txt = lab ? lab.textContent : '';
    }
    if (/€/.test(txt)) return 'eur';
    if (/%/.test(txt)) return 'pct';
    if (/m²|qm/.test(txt)) return 'qm';
    if (/\bJ\.?\b|Jahre/.test(txt)) return 'jahre';
    return 'zahl';
  }

  function _format(n, art) {
    var f;
    if (art === 'eur') {
      f = (Math.abs(n - Math.round(n)) < 0.005) ? 0 : 2;
    } else if (art === 'pct') {
      f = _klemm(_stellen(n), (Number.isInteger(n) && Math.abs(n) >= 10) ? 0 : 1, 3);
    } else if (art === 'qm') {
      f = _klemm(_stellen(n), 0, 2);
    } else if (art === 'jahre') {
      f = _klemm(_stellen(n), 0, 1);
    } else {
      f = _klemm(_stellen(n), 0, 4);
    }
    return n.toLocaleString('de-DE', { minimumFractionDigits: f, maximumFractionDigits: f });
  }

  function anzeige(el, roh) {
    if (/[.,]\s*$/.test(String(roh))) return roh;   /* halb getippt („3,") - so lassen */
    var n = _parse(roh);
    return n === null ? roh : _format(n, el._dpZfArt || 'zahl');
  }

  function _passt(el) {
    if (!el || el.tagName !== 'INPUT' || el._dpZfArt) return false;
    if (el.type !== 'text') return false;
    var im = el.inputMode || el.getAttribute('inputmode') || '';
    if (im !== 'decimal' && im !== 'numeric') return false;
    if (NIE[el.id]) return false;
    if (el.hasAttribute('data-zf-aus')) return false;
    var f = el.closest('.f');
    var lab = f && f.querySelector('label');
    if (lab && /^\s*(baujahr|modernisierungsjahr)|\(jahr\)/i.test(lab.textContent)) return false;
    return true;
  }

  function _einheitErgaenzen(el) {
    var id = el.id;
    if (EUR_QM[id]) {
      var iw = el.closest('.iw'), p = iw && iw.querySelector('.pfx');
      if (p && p.textContent.trim() === '€') { p.textContent = '€/m²'; el.classList.add('dp-zf-pfx-breit'); }
    }
    if (EINHEIT_FEHLT[id] && !(el.parentElement && el.parentElement.querySelector('.sfx, .unit'))) {
      var w = el.parentElement;
      if (!w.classList.contains('iw')) {
        w = document.createElement('div'); w.className = 'iw';
        el.parentNode.insertBefore(w, el); w.appendChild(el);
      }
      var s = document.createElement('span'); s.className = 'sfx'; s.textContent = EINHEIT_FEHLT[id];
      w.appendChild(s);
      el.classList.add('tr');
    }
  }

  function einrichten(el) {
    if (!_passt(el)) return;
    _einheitErgaenzen(el);
    el._dpZfArt = _art(el);
    el._dpRoh = NATIV.get.call(el);
    el._dpFokus = (document.activeElement === el);
    Object.defineProperty(el, 'value', {
      configurable: true,
      get: function () { return this._dpFokus ? NATIV.get.call(this) : this._dpRoh; },
      set: function (x) {
        NATIV.set.call(this, x);                 /* der Browser normalisiert (null -> '') */
        var roh = NATIV.get.call(this);
        this._dpRoh = roh;
        if (!this._dpFokus) NATIV.set.call(this, anzeige(this, roh));
      }
    });
    if (!el._dpFokus) NATIV.set.call(el, anzeige(el, el._dpRoh));
  }

  /* Fokus: Rohtext zum Bearbeiten. Verlassen: Rohtext merken, deutsch zeigen.
     Am window in der CAPTURE-Phase, damit es VOR jedem blur-Leser am Feld
     selbst laeuft — in einem blur-Handler ist activeElement schon <body>. */
  window.addEventListener('focus', function (ev) {
    var el = ev.target;
    if (!el || !el._dpZfArt) return;
    el._dpFokus = true;
    if (NATIV.get.call(el) !== el._dpRoh) NATIV.set.call(el, el._dpRoh);
  }, true);
  window.addEventListener('blur', function (ev) {
    var el = ev.target;
    if (!el || !el._dpZfArt || !el._dpFokus) return;
    el._dpRoh = NATIV.get.call(el);
    el._dpFokus = false;
    NATIV.set.call(el, anzeige(el, el._dpRoh));
  }, true);

  function scan(wurzel) {
    var r = wurzel || document;
    var l = r.querySelectorAll ? r.querySelectorAll('.sec input[inputmode]') : [];
    for (var i = 0; i < l.length; i++) einrichten(l[i]);
  }

  var _t = null;
  function _spaeter() { if (_t) return; _t = setTimeout(function () { _t = null; scan(); }, 60); }

  function start() {
    try {
      var st = document.createElement('style');
      st.textContent = '.iw input.trl.dp-zf-pfx-breit{padding-left:46px !important}';
      document.head.appendChild(st);
    } catch (e) {}
    scan();
    try {
      new MutationObserver(function (ml) {
        /* nur neue ELEMENTE mit Eingabefeld — calc() schreibt staendig Text,
           das soll keinen Durchlauf ausloesen */
        for (var i = 0; i < ml.length; i++) {
          var a = ml[i].addedNodes;
          for (var j = 0; a && j < a.length; j++) {
            var n = a[j];
            if (n.nodeType === 1 && (n.tagName === 'INPUT' || (n.querySelector && n.querySelector('input')))) { _spaeter(); return; }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  window.DpZahlenfelder = { scan: scan, einrichten: einrichten, anzeige: anzeige, _format: _format, _parse: _parse };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
