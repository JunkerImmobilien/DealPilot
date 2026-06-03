/* ============================================================================
   DealPilot v451 – deal-action-readycheck.js  (ersetzt v450)
   v451-FIX: Filter-Logik war korrekt (Console-Beweis), aber der Auto-Refresh
   injizierte nur bei AKTIVEM Deal-Aktion-Tab -> beim Laden (Objekt-Tab aktiv)
   lief er ins Leere, Block blieb stale (Baujahr als "fehlt"). Jetzt: active-Guard
   raus + Settle-Re-Checks + Refresh auch bei switchTab.
   ----------------------------------------------------------------------------
   (v450) Lade-Hook-Fix: refresh() an loadData()+calc().
   ----------------------------------------------------------------------------
   (v449-Basis) deal-action-readycheck.js  (ersetzt v448)
   "Bereit fuer die Bank?"-Block im Deal-Aktion-Tab (#s8), additiv:
     - FEHLT-Kriterium DIREKT am Eingabefeld (leer = fehlt) — KEIN Score/applied mehr,
       deckt sich 1:1 mit dem, was der Nutzer im Formular sieht.
     - Fortschritt aus genau diesen Feldern (Balken = nicht-leere Felder).
     - fehlende Felder als klickbare Chips -> Tab-Sprung + Scroll + Gold-Flash.
     - Export-Zeile: Investment-PDF (exportPDF) + BMF-Steuer (exportBmfPdf).
   Einbau OHNE Edit an deal-action.js (MutationObserver auf #s8). Idempotent. Frontend-only.
   ============================================================================ */
(function () {
  'use strict';

  /* Score-Key -> Kandidaten-DOM-IDs (erstes existierendes Feld gewinnt). */
  var FIELD_TARGETS = {
    zins:           ['d1z'],
    tilgung:        ['d1t'],
    baujahr:        ['baujahr'],
    energie:        ['ds2_energie'],
    qualitaet:      ['qz-stars-rows', 'rate_kueche'],
    mikrolage:      ['mikrolage'],
    makrolage:      ['makrolage'],
    bevoelkerung:   ['ds2_bevoelkerung'],
    nachfrage:      ['ds2_nachfrage'],
    mietwachstum:   ['mietwachstum', 'ds2_mietwachstum', 'mietwachstumPct'],
    wertsteigerung: ['ds2_wertsteigerung'],
    entwicklungs:   ['ds2_entwicklung', 'ds2_entwicklungsmoeglichkeiten'],
    leerstand:      ['leerstand'],
    instandhaltung: ['instandhaltung', 'ihr', 'instandh'],
    mietausfall:    ['ds2_mietausfall', 'mietausfall']
  };

  /* Deutsche Chip-Labels (unabhaengig vom Score). */
  var LABELS = {
    zins: 'Zinssatz', tilgung: 'Tilgung', baujahr: 'Baujahr / Zustand',
    energie: 'Energieklasse', qualitaet: 'Qualit\u00e4t & Zustand',
    mikrolage: 'Mikrolage', makrolage: 'Makrolage', bevoelkerung: 'Bev\u00f6lkerung',
    nachfrage: 'Nachfrage', mietwachstum: 'Mietwachstum', wertsteigerung: 'Wertsteigerung',
    entwicklungs: 'Entwicklungsm\u00f6glichkeiten', leerstand: 'Leerstand',
    instandhaltung: 'Instandhaltung', mietausfall: 'Mietausfall-Risiko'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function firstEl(ids) {
    for (var i = 0; i < ids.length; i++) {
      var e = document.getElementById(ids[i]);
      if (e) return e;
    }
    return null;
  }

  /* Liest den tatsaechlichen Feldzustand: existiert? gefuellt? */
  function fieldState(key) {
    var el = firstEl(FIELD_TARGETS[key]);
    if (!el) return { exists: false, filled: false };
    if (key === 'qualitaet') {
      // Sterne: gefuellt, wenn irgendeine rate_/qual_-Bewertung > 0
      var hid = document.querySelectorAll('input[id^="rate_"], input[id^="qual_"]');
      for (var i = 0; i < hid.length; i++) {
        var v = parseFloat(hid[i].value);
        if (!isNaN(v) && v > 0) return { exists: true, filled: true };
      }
      return { exists: true, filled: false };
    }
    var val = (el.value != null) ? String(el.value).trim() : '';
    return { exists: true, filled: val !== '' };  // "0" zaehlt als gefuellt
  }

  function getData() {
    var total = 0, missing = [];
    Object.keys(FIELD_TARGETS).forEach(function (k) {
      var f = fieldState(k);
      if (!f.exists) return;       // Feld nicht im DOM -> nicht zaehlen
      total++;
      if (!f.filled) missing.push({ key: k, name: LABELS[k] || k });
    });
    var filled = total - missing.length;
    var percent = total ? Math.round(filled / total * 100) : 0;
    return { percent: percent, filled: filled, total: total, missing: missing };
  }

  function buildHtml(d) {
    var pct = Math.max(0, Math.min(100, d.percent | 0));
    var body;
    if (d.missing.length) {
      var chips = d.missing.map(function (m) {
        return '<button type="button" class="dp-rc-chip" onclick="DealPilotReadyCheck.jump(\'' + esc(m.key) + '\')">' + esc(m.name) + '</button>';
      }).join('');
      body = '<div class="dp-rc-missing-label">Fehlende Angaben (' + d.missing.length + ')</div>' +
             '<div class="dp-rc-chips">' + chips + '</div>';
    } else {
      body = '<div class="dp-rc-allset">\u2713 Alle Angaben vollst\u00e4ndig</div>';
    }
    var exp =
      '<div class="dp-rc-exports">' +
        '<span class="dp-rc-exp-label">Exporte:</span>' +
        '<button type="button" class="dp-rc-exp-btn" onclick="DealPilotReadyCheck.exp(\'invest\')">Investment-PDF</button>' +
        '<button type="button" class="dp-rc-exp-btn" onclick="DealPilotReadyCheck.exp(\'bmf\')">BMF-Steuer</button>' +
      '</div>';
    return '<div id="da-readycheck" class="da-readycheck">' +
      '<div class="dp-rc-head"><span class="dp-rc-title">Bereit f\u00fcr die Bank?</span>' +
        '<span class="dp-rc-prog">' + d.filled + ' / ' + d.total + ' Feldern \u00b7 ' + pct + ' %</span></div>' +
      '<div class="dp-rc-bar"><div class="dp-rc-bar-fill" style="width:' + pct + '%"></div></div>' +
      body + exp +
    '</div>';
  }

  function inject() {
    var sec = document.getElementById('s8');
    if (!sec) return;
    if (!sec.querySelector('.da-stage') && !sec.querySelector('.junker-action-banner')) return;
    var d = getData();
    var existing = document.getElementById('da-readycheck');
    var html = buildHtml(d);
    if (existing) {
      var tmp0 = document.createElement('div'); tmp0.innerHTML = html;
      existing.parentNode.replaceChild(tmp0.firstElementChild, existing);
      return;
    }
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    var node = tmp.firstElementChild;
    var banner = sec.querySelector('.junker-action-banner');
    var anchor = banner || sec.querySelector('.sec-title');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(node, anchor.nextSibling);
    else sec.insertBefore(node, sec.firstChild);
  }

  function jump(key) {
    var el = firstEl(FIELD_TARGETS[key] || []);
    if (!el) return;
    var sec = el.closest ? el.closest('.sec') : null;
    if (sec) {
      var tabs = document.querySelectorAll('.tab');
      var idx = -1;
      for (var j = 0; j < tabs.length; j++) {
        if (tabs[j].getAttribute('data-target-sec') === sec.id) { idx = j; break; }
      }
      if (idx >= 0 && typeof window.switchTab === 'function') { try { window.switchTab(idx); } catch (e) {} }
    }
    setTimeout(function () {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
      el.classList.add('dp-rc-flash');
      setTimeout(function () { el.classList.remove('dp-rc-flash'); }, 1600);
      if (el.focus && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { try { el.focus({ preventScroll: true }); } catch (e) {} }
    }, 140);
  }

  function exp(which) {
    try {
      if (which === 'invest' && typeof window.exportPDF === 'function') return window.exportPDF();
      if (which === 'bmf' && typeof window.exportBmfPdf === 'function') return window.exportBmfPdf();
    } catch (e) { console.warn('[v449] export ' + which, e); }
  }

  window.DealPilotReadyCheck = { jump: jump, exp: exp, refresh: inject };

  var _obs = null;
  function startObserver() {
    var sec = document.getElementById('s8');
    if (!sec || _obs) return;
    _obs = new MutationObserver(function () {
      if (document.getElementById('da-readycheck')) return;
      _obs.disconnect();
      try { inject(); } catch (e) {}
      _obs.observe(sec, { childList: true });
    });
    _obs.observe(sec, { childList: true });
  }

  var _t = null;
  function refresh() {
    clearTimeout(_t);
    _t = setTimeout(function () {
      // v451: KEIN active-Guard mehr. inject() self-guarded (no-op solange #s8 leer);
      // beim Laden ist meist der Objekt-Tab aktiv, daher lief der Refresh frueher ins Leere.
      try { inject(); } catch (e) {}
      // Settle: spaet befuellte Felder (loadData/calc-Kaskade) sicher erfassen
      setTimeout(function () { try { inject(); } catch (e) {} }, 250);
      setTimeout(function () { try { inject(); } catch (e) {} }, 700);
    }, 200);
  }
  document.addEventListener('input', refresh, true);
  document.addEventListener('change', refresh, true);

  /* v450: Beim Laden eines Objekts (loadData) und beim Neuberechnen (calc) feuert
     KEIN input-Event -> der Block blieb auf dem leeren Stand stehen. Wir haengen
     uns einmalig (idempotent) hinter loadData() und calc() und re-injizieren. */
  function wrapGlobal(name) {
    var fn = window[name];
    if (typeof fn !== 'function' || fn._v450Wrapped) return;
    var wrapped = function () {
      var r = fn.apply(this, arguments);
      try { refresh(); } catch (e) {}
      return r;
    };
    wrapped._v450Wrapped = true;
    try { for (var k in fn) { if (Object.prototype.hasOwnProperty.call(fn, k)) wrapped[k] = fn[k]; } } catch (e) {}
    window[name] = wrapped;
  }
  function installHooks() {
    wrapGlobal('loadData');
    wrapGlobal('calc');
    wrapGlobal('switchTab'); // v451: auch beim Tab-Wechsel (z.B. hin zu Deal-Aktion) refreshen
  }

  function boot() {
    startObserver();
    installHooks();
    // settle: ein paar verzoegerte Re-Checks, falls Felder spaet befuellt werden
    try { inject(); } catch (e) {}
    setTimeout(inject, 350);
    setTimeout(inject, 900);
    setTimeout(installHooks, 1500); // falls loadData/calc erst spaeter global werden
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  else setTimeout(boot, 200);
})();
