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
  /* W22-reapply: Der Sweeper schrieb #C9A84C IN den Regeln um. Beim zweiten Aufruf
     mit anderer Farbe fand er kein #C9A84C mehr -> er war NICHT wiederholbar. Fuer
     den Mandanten (eine Farbe, ein Aufruf) egal — fuer den Vorschau-Umschalter des
     Partners toedlich. Jetzt wird jeder Originalwert gemerkt und vor einem
     Neuanstrich zurueckgespielt. */
  var _touched = [];              // [{st, prop, prio, orig}]
  var _touchedAttr = [];          // [{el, attr, orig}]
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


  /* ── W30-wl-token: die Whitelabel-Farbebene ───────────────────────────────
     Die Module tragen ihr Gold jetzt als var(--wl-<hex>, #<hex>). Diese Tokens
     existieren NUR hier — in keinem :root. Ohne Whitelabel greift also immer der
     Fallback und die Optik ist unveraendert.
     recolor() haelt den Abstand jedes Tons zum Basisgold: Farbwinkel-Versatz,
     Saettigungs-Verhaeltnis und Helligkeits-Versatz werden auf den Akzent
     uebertragen. recolor('#C9A84C', acc) === acc.
     Der alte buildMap()-Sweeper kannte 9 Toene; in den Modulen stecken ~34. */
  /* W34-wl-token: 34 -> 51 Toene. Die zwoelf uebersehenen Stylesheets
     (dashboard.css & Co) brachten 17 neue mit. Nicht drin und mit Absicht:
     Statusfarben (#E89B2F Risiko-Ampel, #E0A030/#A16207 Gelb, #E8B84F
     "--rnd-yellow"), die rote Palette und die warmen Grautoene. */
  /* W35-wl-token: 51 -> 58 Toene. Neu aus bank-charts (SVG-Tachos) und
     marktbericht-view (Gold-Band). */
  /* W36-wl-token: 58 -> 66. Neu aus der Marktbericht-App (Charts, Tachos).
     NICHT drin: --warn #d9a441 und --bad #d9655b — Statusfarben. */
  var WL_TINTS = ['#C9A84C','#E8CC7A','#b8932f','#9a7f33','#9a7f3a','#E2C97E','#E8C964',
    '#E8C766','#E0BE7C','#D4B65A','#D9B45A','#D8C79A','#a8761f','#9c7223','#7a5d18','#bd9c3f',
    '#c08a2f','#A6842D','#B89638','#E5A847','#FAF5E8','#F6EAD0','#F6ECD0','#F7EFD8','#FBF3DF',
    '#FBF1DC','#FAF4E6','#E8D9A8','#F5ECD0','#ECE2C8','#ECE0C2','#EFE7D2','#FBF6E9','#ECE0BE',
    '#C9A042','#BD9A3E','#D8B85E','#A8861E','#F0D98A','#B59238','#8C6E2C','#7A6A3A','#8E6E1F',
    '#E0BE5E','#B89540','#E8C46C','#FFD96A','#B89640','#B8964A','#B8923F','#8B7330','#A68A36',
    '#FFE9A0','#7A6628','#D8BD66','#BDA767','#CDBB85','#FFF7E6','#9A7D28','#A98E3A','#A8842C',
    '#D9B95A','#CDAE4E','#B89A3E','#7A6428','#9A751F'];
  var WL_BASE = '#C9A84C';
  function _toHsl(h) {
    var a = _rgbArr(h), r = a[0] / 255, g = a[1] / 255, b = a[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, H = 0, S = 0, L = (mx + mn) / 2;
    if (d) {
      S = L > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      H = (mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4)) * 60;
    }
    return [H, S, L];
  }
  function _fromHsl(H, S, L) {
    H = ((H % 360) + 360) % 360; S = Math.max(0, Math.min(1, S)); L = Math.max(0, Math.min(1, L));
    function f(n) { var k = (n + H / 30) % 12, a = S * Math.min(L, 1 - L); return L - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1)); }
    return _hex(f(0) * 255, f(8) * 255, f(4) * 255);
  }
  function _recolor(lit, acc) {
    var g = _toHsl(WL_BASE), l = _toHsl(lit), a = _toHsl(acc);
    return _fromHsl(a[0] + (l[0] - g[0]), g[1] > 0 ? a[1] * (l[1] / g[1]) : a[1], a[2] + (l[2] - g[2]));
  }
  function setWlTokens(r) {
    WL_TINTS.forEach(function (h) {
      var v;
      /* Die drei Basistoene darf der Reseller explizit setzen — die haben Vorrang. */
      if (h === '#C9A84C') v = _acc;
      else if (h === '#E8CC7A') v = _hi;
      else if (h === '#b8932f') v = _lo;
      else v = _recolor(h, _acc);
      r.setProperty('--wl-' + h.slice(1).toLowerCase(), v);
    });
  }
  function clearWlTokens(r) {
    WL_TINTS.forEach(function (h) { r.removeProperty('--wl-' + h.slice(1).toLowerCase()); });
  }

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
      // rgba mit dem Gold-Tripel — Alpha erhalten
      { re: /rgba\(\s*201\s*,\s*168\s*,\s*76\s*,/gi,
        to: function () { return 'rgba(' + accRgb[0] + ',' + accRgb[1] + ',' + accRgb[2] + ','; } }
    ];

    /* ── W26-rgb: DER FUND vom 16.07. ──────────────────────────────────────
       Der Browser NORMALISIERT Hex-Farben im CSSOM zu rgb(). Eine Regel
           .mf-hero{background:linear-gradient(105deg,#E8CC7A,#C9A84C 52%,#b8932f)}
       liest sich ueber rule.style als
           linear-gradient(105deg, rgb(232, 204, 122), rgb(201, 168, 76) 52%, ...)
       Meine MAP suchte nach '#E8CC7A' und fand NICHTS. Nur EINE rgb-Variante war
       drin (rgb(201,168,76)) — die anderen acht Toene nicht.
       Das erklaert das ganze Muster: Custom Properties (--dab-gold:#C9A84C) werden
       NICHT normalisiert -> die wurden rot. Normale Eigenschaften mit Hex -> rgb()
       -> blieben gold. Genau deshalb blieben Modal-Hero, Freigaben und
       Partner-Portal golden, waehrend der Rest umschlug.
       Jetzt: fuer JEDEN Ton auch die rgb()-Schreibweise. */
    function _rgbRe(h) {
      var a = _rgbArr(h);
      return new RegExp('rgb\\(\\s*' + a[0] + '\\s*,\\s*' + a[1] + '\\s*,\\s*' + a[2] + '\\s*\\)', 'gi');
    }
    function _rgbStr(h) { var a = _rgbArr(h); return 'rgb(' + a[0] + ', ' + a[1] + ', ' + a[2] + ')'; }
    [
      ['#C9A84C', function () { return _rgbStr(_acc); }],
      ['#E8CC7A', function () { return _rgbStr(_hi); }],
      ['#b8932f', function () { return _rgbStr(_lo); }],
      ['#9a7f33', function () { return _rgbStr(_darken(_acc, 26)); }],
      ['#E2C97E', function () { return _rgbStr(_lighten(_acc, 15)); }],
      ['#E8C964', function () { return _rgbStr(_lighten(_acc, 8)); }],
      ['#E8C766', function () { return _rgbStr(_lighten(_acc, 8)); }],
      ['#FAF5E8', function () { return _rgbStr(_lighten(_acc, 88)); }],
      ['#a8761f', function () { return _rgbStr(_darken(_acc, 30)); }]
    ].forEach(function (p) { MAP.push({ re: _rgbRe(p[0]), to: p[1] }); });
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

  /* ── 1) CSSOM: EIGENES Stylesheet obendrauf ──────────────────
     W28: Bis hierher habe ich versucht, die fremden Regeln zur Laufzeit
     UMZUSCHREIBEN (rule.style.setProperty). Sechs Diagnose-Runden am 16.07.
     haben gezeigt: jeder Einzelschritt funktioniert — Regel lesbar (props: 21),
     background-image in item() enthalten, setProperty von Hand wirkt sofort,
     Regex trifft, _seen geleert — und trotzdem blieb alles gold (86 -> 86).
     Ich finde den Fehler nicht, und weiteres Suchen lohnt nicht.

     Neuer Weg: Ich SCHREIBE NICHTS MEHR in fremde Regeln. Ich LESE sie nur
     (das ist bewiesen zuverlaessig) und erzeuge daraus ein eigenes Stylesheet
     mit !important, das ganz am Ende des <head> haengt. Das kann nicht daneben
     gehen: keine Schreibrechte noetig, Reihenfolge + !important gewinnen immer,
     und Zuruecksetzen ist ein einziges textContent = ''.
     Groeber als die elegante Loesung — aber es tut, was es soll. */
  var OV_ID = 'dp-wl-overlay';
  function _ovNode() {
    var st = document.getElementById(OV_ID);
    if (!st) {
      st = document.createElement('style'); st.id = OV_ID;
      (document.head || document.documentElement).appendChild(st);
    } else if (st.parentNode && st.parentNode.lastChild !== st) {
      st.parentNode.appendChild(st);        // immer ans Ende -> gewinnt die Kaskade
    }
    return st;
  }
  function _declsFor(rule) {
    var out = [];
    try {
      for (var j = 0; j < rule.style.length; j++) {
        var prop = rule.style.item(j);
        var val = rule.style.getPropertyValue(prop);
        var nv = swap(val);
        if (nv) out.push(prop + ':' + nv + ' !important');
      }
    } catch (e) {}
    return out;
  }
  function _collect(rules, out, media) {
    if (!rules) return;
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      try {
        if (r.cssRules && r.conditionText !== undefined) {         // @media / @supports
          var inner = [];
          _collect(r.cssRules, inner, null);
          if (inner.length) {
            var at = (r.type === 4 ? '@media ' : '@supports ') + r.conditionText;
            out.push(at + '{' + inner.join('\n') + '}');
          }
          continue;
        }
        if (r.cssRules) { _collect(r.cssRules, out, media); continue; }
        if (!r.style || !r.selectorText) continue;
        var d = _declsFor(r);
        if (d.length) out.push(r.selectorText + '{' + d.join(';') + '}');
      } catch (e) { /* einzelne Regel ueberspringen */ }
    }
  }
  function sweepSheets() {
    var out = [];
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      var s = sheets[i];
      try {
        if (s.ownerNode && s.ownerNode.id === OV_ID) continue;    // nie sich selbst
        if (!s.cssRules) continue;                                 // cross-origin -> wirft
        _collect(s.cssRules, out, null);
      } catch (e) { /* Google-Fonts & Co: SecurityError, egal */ }
    }
    if (!out.length) return;
    var st = _ovNode();
    var css = out.join('\n');
    if (st.textContent !== css) st.textContent = css;
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
      if (nv) { _touchedAttr.push({ el: el, attr: 'style', orig: s }); el.setAttribute('style', nv); }
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
        if (nv) { _touchedAttr.push({ el: el, attr: a, orig: v }); el.setAttribute(a, nv); }
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

  /* ── 5) Bild-Logos ────────────────────────────────────────────
     W15: Der Wortmarken-Sweep prueft textContent === "DealPilot". Ein <img> hat
     KEINEN Text -> wurde nie angefasst. Genau so blieb .app-logo-simple-sidebar
     auf assets/dealpilot-logo-app.png stehen. (mandant-branding.js sucht
     ".sidebar-logo" — die Klasse heisst aber ".app-logo-simple-sidebar".)
     Zusatzfalle: config.js applyTheme() schreibt die src bei JEDEM Aufruf zurueck
     (1600-ms-Timer, jeder Hell/Dunkel-Wechsel). Deshalb KEIN Einmal-Marker,
     sondern: solange src nicht unser Logo ist, wird gesetzt. Der Observer
     (attributeFilter mit 'src') zieht nach. Kein Loop — steht unser Logo drin,
     kehrt die Funktion sofort um. */
  /* W23-logonarrow: Der Selektor war VIEL zu weit. 'img[class*="-logo"]' und
     '[class*="-logo"] img' trafen auch die Marktbewertungs-Anbieter (Sprengnetter,
     PriceHubble) im PRE-FLIGHT — die trugen danach das Kanzlei-Logo. Das ist nicht
     nur haesslich, sondern sachlich falsch und verletzt die Anbieter-Neutralitaet.
     Jetzt: NUR die echte DealPilot-Wortmarke. Fremde Logos bleiben, wo sie sind. */
  var LOGO_SEL = 'img.app-logo-simple-sidebar,' +
                 'img[src*="dealpilot-logo"],img[src*="dealpilot_logo"],' +
                 'img[src*="dealpilot_logo_app"]';
  function sweepLogoImgs(root) {
    if (!_logo) return;
    var imgs;
    try { imgs = (root || document).querySelectorAll(LOGO_SEL); } catch (e) { return; }
    Array.prototype.forEach.call(imgs, function (img) {
      var cur = img.getAttribute('src') || '';
      if (cur === _logo) return;                     // schon unseres -> Loop-Schutz
      if (cur.indexOf('data:') === 0) return;        // fremdes Inline-Bild nicht anfassen
      /* W23-logonarrow: zweites Netz — nur echte DealPilot-Assets. Selbst wenn ein
         Selektor irgendwann wieder zu weit wird, kann kein Fremdlogo mehr kippen. */
      if (!/dealpilot[-_]logo/i.test(cur) && !img.classList.contains('app-logo-simple-sidebar')) return;
      if (!img.getAttribute('data-wl-orig')) img.setAttribute('data-wl-orig', cur);
      img.setAttribute('src', _logo);
      /* applyTheme() liest data-logo-dark und schreibt es nach src zurueck —
         mitziehen, sonst kaempfen wir gegen den Theme-Boot. */
      if (img.hasAttribute('data-logo-dark')) img.setAttribute('data-logo-dark', _logo);
      if (_label) img.setAttribute('alt', _label);
    });
  }

  /* ── Gesamt-Sweep (gedrosselt) ────────────────────────────── */
  function sweep() {
    if (!_active) return;
    try { sweepSheets(); } catch (e) {}
    try { sweepInline(); } catch (e) {}
    try { sweepSvg(); } catch (e) {}
    try { sweepWordmark(); } catch (e) {}   /* W11-wordmark */
    try { sweepLogoImgs(); } catch (e) {}   /* W15-logoimg */
  }
  function sweepThrottled() {
    if (_timer) return;
    _timer = setTimeout(function () { _timer = null; sweep(); }, 220);
  }

  /* ── Oeffentliche API ─────────────────────────────────────── */
  /* W22-reapply: alles auf den Originalzustand zuruecksetzen. */
  function reset() {
    /* W28: das eigene Stylesheet leeren — die fremden Regeln haben wir nie angefasst. */
    try { var st = document.getElementById(OV_ID); if (st) st.textContent = ''; } catch (e) {}
    _touched.forEach(function (t) { try { t.st.setProperty(t.prop, t.orig, t.prio); } catch (e) {} });
    _touchedAttr.forEach(function (t) { try { t.el.setAttribute(t.attr, t.orig); } catch (e) {} });
    _touched = []; _touchedAttr = []; _seen = new WeakSet();
    try {
      var r = document.documentElement.style;
      ['--gold','--gold-hi','--gold-lo','--gold-l','--gold-2','--gold-3','--gold-bg','--gold-d','--gold-soft','--obsidian']
        .forEach(function (v) { r.removeProperty(v); });
      clearWlTokens(r);
    } catch (e) {}
    /* Marker loeschen, damit der naechste Sweep dieselben Knoten wieder anfasst */
    try {
      ['[data-wl]','[data-wls]','[data-wlw]'].forEach(function (sel) {
        Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
          el.removeAttribute('data-wl'); el.removeAttribute('data-wls'); el.removeAttribute('data-wlw');
        });
      });
    } catch (e) {}
    _active = false;
  }

  function apply(b) {
    if (!b) return false;
    /* W22-reapply: schon aktiv mit anderer Farbe? -> erst Originale zurueck. */
    if (_active && b.accent && b.accent !== _acc) { try { reset(); } catch (e) {} }
    /* W11-wordmark: Name/Logo auch ohne Akzent uebernehmen — ein Reseller kann
       seine Marke setzen, ohne die Farbe zu aendern. */
    if (b.name) _label = b.name;
    if (b.logo) _logo = b.logo;
    if (!_ok(b.accent)) { if (_label || _logo) { _active = true; sweepWordmark(); sweepLogoImgs(); _watch(); return true; } return false; }
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
    /* W29-gold-token: der QC nutzt --gold-d (14x) und --gold-soft (1x).
       Ohne diese zwei Zeilen bleiben genau die Stellen gold. */
    r.setProperty('--gold-d', _darken(_acc, 9));
    r.setProperty('--gold-soft', _lighten(_acc, 82));
    setWlTokens(r);
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
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['style', 'fill', 'stroke', 'src']   /* W15: applyTheme setzt src zurueck */
      });
    } catch (e) {}
    [700, 2000, 4500].forEach(function (ms) { setTimeout(sweep, ms); });
  }

  window.DealPilotWhitelabel = {
    apply: apply,
    isActive: function () { return _active; },
    resweep: sweep,
    reset: reset,   /*W22-reapply*/
    sweepWordmark: sweepWordmark,
    sweepLogoImgs: sweepLogoImgs,
    accent: function () { return _acc; }
  };
})();
