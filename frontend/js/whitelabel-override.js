'use strict';
/**
 * whitelabel-override.js (W6) — Whitelabel-Override-Ebene
 *
 * WARUM: 25+ Module bringen ihre eigene, fest verdrahtete Gold-Palette mit
 * (object-actions.js 54x, dpsh-score-hero.js 37x, deal-action.js 29x,
 * pricing-modal.js 28x, storage.js, settings.js, ...). Sie injizieren ihr CSS
 * als JS-String und wissen von var(--gold) nichts. Jede einzeln zu patchen waere
 * Whack-a-Mole — und jede NEUE Datei riesse das Loch wieder auf.
 *
 * WIE: Ein Sweeper, der zur Laufzeit drei Ebenen umschreibt:
 *   1. CSSOM  — Regeln in same-origin Stylesheets (auch injizierte <style>-Bloecke)
 *   2. Inline — element.style="...#C9A84C..."
 *   3. SVG    — fill="#C9A84C" / stroke="..." (Praesentationsattribute)
 * Laeuft NUR bei aktivem Whitelabel. Ohne Reseller passiert gar nichts.
 *
 * API:  window.DealPilotWhitelabel.apply({ accent, accentHi, accentLo, obsidian })
 *       window.DealPilotWhitelabel.isActive()
 */
(function () {
  var _acc = null, _hi = null, _lo = null, _obs = null;
  var _label = '', _logo = '';   /* W11-wordmark */
  var _active = false;
  var _seen = new WeakSet();      // bereits gefegte Stylesheets/Regeln
  var _timer = null;

  /* ── Farb-Helfer ──────────────────────────────────────────── */
  function _ok(h) { return /^#[0-9a-fA-F]{6}$/.test(h || ''); }
  function _rgbArr(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function _hex(r, g, b) {
    function c(x) { x = Math.max(0, Math.min(255, Math.round(x))); return ('0' + x.toString(16)).slice(-2); }
    return '#' + c(r) + c(g) + c(b);
  }
  function _lighten(h, p) { var a = _rgbArr(h); return _hex(a[0] + (255 - a[0]) * p / 100, a[1] + (255 - a[1]) * p / 100, a[2] + (255 - a[2]) * p / 100); }
  function _darken(h, p) { var a = _rgbArr(h); return _hex(a[0] * (1 - p / 100), a[1] * (1 - p / 100), a[2] * (1 - p / 100)); }

  /* ── Die Gold-Tokens, die in den Modulen stecken ──────────── */
  var MAP = [];
  function buildMap() {
    var accRgb = _rgbArr(_acc);
    MAP = [
      // Hex-Varianten (case-insensitiv behandelt, s.u.)
      { re: /#C9A84C/gi, to: function () { return _acc; } },
      { re: /#E8CC7A/gi, to: function () { return _hi; } },
      { re: /#b8932f/gi, to: function () { return _lo; } },
      { re: /#9a7f33/gi, to: function () { return _darken(_acc, 26); } },
      { re: /#E2C97E/gi, to: function () { return _lighten(_acc, 15); } },
      { re: /#E8C964/gi, to: function () { return _lighten(_acc, 8); } },
      { re: /#E8C766/gi, to: function () { return _lighten(_acc, 8); } },
      { re: /#FAF5E8/gi, to: function () { return _lighten(_acc, 88); } },
      { re: /#a8761f/gi, to: function () { return _darken(_acc, 30); } },
      // rgba/rgb mit dem Gold-Tripel — Alpha erhalten
      { re: /rgba\(\s*201\s*,\s*168\s*,\s*76\s*,/gi,
        to: function () { return 'rgba(' + accRgb[0] + ',' + accRgb[1] + ',' + accRgb[2] + ','; } },
      { re: /rgb\(\s*201\s*,\s*168\s*,\s*76\s*\)/gi,
        to: function () { return 'rgb(' + accRgb[0] + ',' + accRgb[1] + ',' + accRgb[2] + ')'; } }
    ];
  }
  function swap(v) {
    if (!v || typeof v !== 'string') return null;
    var out = v, hit = false;
    for (var i = 0; i < MAP.length; i++) {
      if (MAP[i].re.test(out)) {
        MAP[i].re.lastIndex = 0;
        out = out.replace(MAP[i].re, MAP[i].to());
        hit = true;
      }
      MAP[i].re.lastIndex = 0;
    }
    return hit ? out : null;
  }

  /* ── 1) CSSOM: Regeln in Stylesheets umschreiben ──────────── */
  function sweepRules(rules) {
    if (!rules) return;
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      try {
        if (r.cssRules) { sweepRules(r.cssRules); continue; }   // @media/@supports
        if (!r.style) continue;
        if (_seen.has(r)) continue;
        var changed = false;
        for (var j = 0; j < r.style.length; j++) {
          var prop = r.style.item(j);
          var val = r.style.getPropertyValue(prop);
          var nv = swap(val);
          if (nv) {
            var prio = r.style.getPropertyPriority(prop);
            r.style.setProperty(prop, nv, prio);
            changed = true;
          }
        }
        if (changed) _seen.add(r);
      } catch (e) { /* einzelne Regel ueberspringen, nie die ganze Sweep abbrechen */ }
    }
  }
  function sweepSheets() {
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      var s = sheets[i];
      try {
        if (!s.cssRules) continue;      // cross-origin (CDN) -> SecurityError
        sweepRules(s.cssRules);
      } catch (e) { /* cross-origin: nicht unser Problem */ }
    }
  }

  /* ── 2) Inline-Styles ─────────────────────────────────────── */
  function sweepInline(root) {
    var nodes;
    try { nodes = (root || document).querySelectorAll('[style]'); } catch (e) { return; }
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-wl') === '1') return;
      var s = el.getAttribute('style');
      var nv = swap(s);
      el.setAttribute('data-wl', '1');
      if (nv) el.setAttribute('style', nv);
    });
  }

  /* ── 3) SVG-Praesentationsattribute ───────────────────────── */
  function sweepSvg(root) {
    var nodes;
    try { nodes = (root || document).querySelectorAll('[fill],[stroke],[stop-color]'); } catch (e) { return; }
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-wls') === '1') return;
      el.setAttribute('data-wls', '1');
      ['fill', 'stroke', 'stop-color'].forEach(function (a) {
        var v = el.getAttribute(a);
        if (!v) return;
        var nv = swap(v);
        if (nv) el.setAttribute(a, nv);
      });
    });
  }

  /* ── 4) Wortmarken ────────────────────────────────────────────
     Es gibt ZEHN verschiedene Implementierungen des "DealPilot"-Schriftzugs:
     .dp-wordmark-auth (auth.js), .fb-bb-logo (feedback-modal.js), .mf-logo
     (mandant-freigaben.js), .dpmb-logo (marktbewertung-card.js), .dpx-logo
     (dealpilot-mb.js/-mb-qc.js), .rp-logo (reseller-portal.js), .dp-mtb-brand
     (help.js) ... Jede einzeln zu patchen waere wieder Whack-a-Mole.
     Deshalb: nach TEXT suchen, nicht nach Klasse. */
  var WM_SEL = '.dp-wordmark,.dp-wordmark-auth,.sb-logo,.hdr-brand,.hdr-logo,.sidebar-logo,' +
               '.brand-logo,.rp-logo,.fb-bb-logo,.mf-logo,.dpmb-logo,.dpx-logo,.dp-mtb-brand,' +
               '[class*="wordmark"],[class*="-logo"],[class*="-brand"]';
  function sweepWordmark(root) {
    if (!_label && !_logo) return;
    var nodes;
    try { nodes = (root || document).querySelectorAll(WM_SEL); } catch (e) { return; }
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-wlw') === '1') return;
      /* NUR echte Wortmarken: der Text muss GENAU "DealPilot" sein.
         Sonst wuerden Ueberschriften wie "DealPilot Markteinschaetzung" oder
         "Co-Pilot" mit ersetzt. */
      var t = (el.textContent || '').replace(/\s+/g, '');
      if (t !== 'DealPilot') return;
      if (el.querySelector('img')) return;              // schon ein Logo drin
      el.setAttribute('data-wlw', '1');
      if (_logo) {
        el.innerHTML = '<img src="' + String(_logo).replace(/"/g, '&quot;') +
                       '" alt="" style="max-height:1.5em;max-width:150px;vertical-align:middle">';
      } else {
        el.textContent = _label;
      }
    });
  }

  /* ── Gesamt-Sweep (gedrosselt) ────────────────────────────── */
  function sweep() {
    if (!_active) return;
    try { sweepSheets(); } catch (e) {}
    try { sweepInline(); } catch (e) {}
    try { sweepSvg(); } catch (e) {}
    try { sweepWordmark(); } catch (e) {}   /* W11-wordmark */
  }
  function sweepThrottled() {
    if (_timer) return;
    _timer = setTimeout(function () { _timer = null; sweep(); }, 220);
  }

  /* ── Oeffentliche API ─────────────────────────────────────── */
  function apply(b) {
    if (!b) return false;
    /* W11-wordmark: Name/Logo auch ohne Akzent uebernehmen — ein Reseller kann
       seine Marke setzen, ohne die Farbe zu aendern. */
    if (b.name) _label = b.name;
    if (b.logo) _logo = b.logo;
    if (!_ok(b.accent)) { if (_label || _logo) { _active = true; sweepWordmark(); _watch(); return true; } return false; }
    _acc = b.accent;
    _hi  = _ok(b.accentHi) ? b.accentHi : _lighten(_acc, 22);
    _lo  = _ok(b.accentLo) ? b.accentLo : _darken(_acc, 16);
    _obs = _ok(b.obsidian) ? b.obsidian : null;
    buildMap();
    _active = true;

    /* Die zentralen Tokens zuerst — die decken alles ab, was schon var(--gold) nutzt */
    var r = document.documentElement.style;
    r.setProperty('--gold', _acc);
    r.setProperty('--gold-hi', _hi);
    r.setProperty('--gold-lo', _lo);
    r.setProperty('--gold-l', _lighten(_acc, 15));
    r.setProperty('--gold-2', _lighten(_acc, 8));
    r.setProperty('--gold-3', _darken(_acc, 26));
    r.setProperty('--gold-bg', _lighten(_acc, 88));
    if (_obs) r.setProperty('--obsidian', _obs);

    sweep();
    _watch();
    return true;
  }
  var _watching = false;
  function _watch() {
    if (_watching) return; _watching = true;
    /* Module rendern spaeter nach -> beobachten */
    try {
      new MutationObserver(sweepThrottled).observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'fill', 'stroke']
      });
    } catch (e) {}
    [700, 2000, 4500].forEach(function (ms) { setTimeout(sweep, ms); });
  }

  window.DealPilotWhitelabel = {
    apply: apply,
    isActive: function () { return _active; },
    resweep: sweep,
    sweepWordmark: sweepWordmark,
    accent: function () { return _acc; }
  };
})();
