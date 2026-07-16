'use strict';
/**
 * mandant-branding.js — Whitelabel für Mandanten (Paket 13)
 * Beim Login eines MANDANTEN (reseller_client) wird das Branding seines
 * Resellers geladen und angewandt:
 *   - App-Menü: zentrale Gold-Variablen (--gold*) auf die Akzentfarbe
 *   - PDFs: DealPilotConfig.branding.get() um Firma + Logo erweitern
 * Owner/normale User sind nicht betroffen (Backend liefert dann null).
 */
(function () {
  var _b = null;

  // Farb-Helfer (analog config.js v901)
  function _rgb(h) { h = (h || '').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function _hex(r, g, b) { function c(x) { x = Math.max(0, Math.min(255, Math.round(x))); return ('0' + x.toString(16)).slice(-2); } return '#' + c(r) + c(g) + c(b); }
  function _lighten(h, p) { var a = _rgb(h); return _hex(a[0] + (255 - a[0]) * p / 100, a[1] + (255 - a[1]) * p / 100, a[2] + (255 - a[2]) * p / 100); }
  function _darken(h, p) { var a = _rgb(h); return _hex(a[0] * (1 - p / 100), a[1] * (1 - p / 100), a[2] * (1 - p / 100)); }
  function _ok(h) { return /^#[0-9a-fA-F]{6}$/.test(h || ''); }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Menü-Schriftzug "DealPilot" für Whitelabel-Mandanten durch Reseller-Name/Logo ersetzen (defensiv)
  function replaceWordmark() {
    if (!_b) return;
    var label = _b.brand_name || '';
    var logo = _b.brand_logo_b64 || '';
    if (!label && !logo) return;
    /* W16-selectors: '.sidebar-logo' gab es nie — die Sidebar-Wortmarke heisst
       '.app-logo-simple-sidebar'. Deshalb blieb dort ewig das DealPilot-Logo
       stehen, obwohl branding.get() das Reseller-Logo korrekt lieferte.
       (Der Sweeper in whitelabel-override.js faengt es zusaetzlich ab — das ist
       die Notbremse, hier ist die Ursache.) */
    var sels = ['.dp-wordmark', '.sb-logo', '.hdr-brand', '.hdr-logo', '.sidebar-logo',
                '.app-logo-simple-sidebar', '.brand-logo', '[class*="wordmark"]'];
    sels.forEach(function (sel) {
      var nodes; try { nodes = document.querySelectorAll(sel); } catch (e) { return; }
      Array.prototype.forEach.call(nodes, function (el) {
        if (el.getAttribute('data-mb-brand')) return;
        var t = (el.textContent || '').replace(/\s/g, '').toLowerCase();
        // nur ersetzen, wenn es wirklich der DealPilot-Schriftzug ist (Text) oder ein Bild-Logo trägt
        if (t.indexOf('dealpilot') === -1 && !el.querySelector('img')) return;
        el.setAttribute('data-mb-brand', '1');
        if (logo) el.innerHTML = '<img src="' + logo + '" alt="' + _esc(label) + '" style="max-height:26px;max-width:150px;vertical-align:middle">';
        else el.textContent = label;
      });
    });
  }

  function applyAccent() {
    if (!_b || !_ok(_b.brand_accent)) return;
    var acc = _b.brand_accent;
    var hi = _ok(_b.brand_accent_hi) ? _b.brand_accent_hi : _lighten(acc, 22);
    var lo = _ok(_b.brand_accent_lo) ? _b.brand_accent_lo : _darken(acc, 16);
    /* W6-override: die zentralen Tokens reichen nicht — 25+ Module haben ihr Gold
       fest verdrahtet (object-actions 54x, dpsh-score-hero 37x, deal-action 29x ...).
       Die Override-Ebene fegt CSSOM + Inline-Styles + SVG-Attribute nach. */
    try {
      if (window.DealPilotWhitelabel && window.DealPilotWhitelabel.apply({
        accent: acc, accentHi: hi, accentLo: lo, obsidian: _b.brand_obsidian,
        /* W11-passname: Name+Logo mitgeben -> der Sweeper ersetzt ALLE zehn
           Wortmarken-Varianten (.fb-bb-logo, .mf-logo, .dpmb-logo, .dpx-logo,
           .rp-logo, .dp-mtb-brand ...), die replaceWordmark() nie erwischt hat. */
        name: _b.brand_name || '', logo: _b.brand_logo_b64 || ''
      })) return;   // Override hat die Tokens schon gesetzt
    } catch (e) {}
    var r = document.documentElement.style;
    r.setProperty('--gold', acc);
    r.setProperty('--gold-hi', hi);
    r.setProperty('--gold-lo', lo);
    r.setProperty('--gold-l', _lighten(acc, 28));
    r.setProperty('--gold-2', hi);
    r.setProperty('--gold-3', lo);
    r.setProperty('--gold-bg', _lighten(acc, 82));
  }

  function overrideBranding() {
    try {
      var DPC = window.DealPilotConfig;
      if (!DPC || !DPC.branding || typeof DPC.branding.get !== 'function') return false;
      if (DPC.branding._mandantWrapped) return true;
      DPC.branding._mandantWrapped = true;
      var orig = DPC.branding.get;
      DPC.branding.get = function () {
        var b = orig.apply(this, arguments) || {};
        if (_b) {
          /* W1a-allfields: config.js liefert fuer Free/Starter/Investor HART die Junker-Defaults
             (nur Pro bekommt Custom). Der Mandant ist aber per Reseller-Vertrag Whitelabel,
             nicht per eigenem Plan -> hier ALLE Felder ueberschreiben, sonst steht ein fremder
             Firmenname ueber der Junker-Adresse im PDF-Footer. */
          if (_b.brand_name) { b.company = _b.brand_name; b.product_name = _b.brand_name; }
          if (_b.brand_company) b.company = _b.brand_company;   // Rechtsname schlaegt Markenname
          if (_b.brand_logo_b64) b.logo_b64 = _b.brand_logo_b64;
          if (_b.brand_tagline) b.tagline = _b.brand_tagline;
          if (_b.brand_address) b.address = _b.brand_address;
          if (_b.brand_plz)     b.plz     = _b.brand_plz;
          if (_b.brand_city)    b.city    = _b.brand_city;
          if (_b.brand_phone)   b.phone   = _b.brand_phone;
          if (_b.brand_email)   b.email   = _b.brand_email;
          if (_b.brand_website) b.website = _b.brand_website;
          /* Akzent fuer die PDF-Engine (pdf.js liest window._dpPdfColors) */
          if (_b.brand_accent)    b.accent    = _b.brand_accent;
          if (_b.brand_accent_hi) b.accent_hi = _b.brand_accent_hi;
          if (_b.brand_accent_lo) b.accent_lo = _b.brand_accent_lo;
          /* Junker-Reste entfernen, die der Reseller NICHT gepflegt hat:
             lieber leer als fremde Adresse. name/role sind Personendaten -> raus. */
          if (_b.brand_address || _b.brand_city || _b.brand_phone || _b.brand_email) {
            if (!_b.brand_address) b.address = '';
            if (!_b.brand_plz)     b.plz     = '';
            if (!_b.brand_city)    b.city    = '';
            if (!_b.brand_phone)   b.phone   = '';
            if (!_b.brand_email)   b.email   = '';
            if (!_b.brand_website) b.website = '';
            b.name = ''; b.role = '';
          }
          b.is_custom = true;
        }
        return b;
      };
      return true;
    } catch (e) { return false; }
  }

  /* W1a-pdfaccent: Akzent in die jsPDF-Palette schieben (pdf.js exportiert sie als
     window._dpPdfSetAccent). Ohne das bleibt jedes Mandanten-PDF DealPilot-gold.
     Selbststartend mit Retry: _b wird erst von boot() asynchron gefuellt, und
     pdf.js kann spaeter geladen sein als dieses Modul. */
  function applyPdfAccent() {
    try {
      if (!_b || !_b.brand_accent) return false;
      if (typeof window._dpPdfSetAccent !== 'function') return false;
      window._dpPdfSetAccent(_b.brand_accent, _b.brand_accent_hi, _b.brand_accent_lo);
      /* W12-mandantlight: helles Deckblatt, wenn der Reseller es so will. */
      try { if (typeof window._dpPdfSetLight === 'function') window._dpPdfSetLight(!!_b.brand_pdf_light); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  (function _pdfAccentPoll(n) {
    if (applyPdfAccent()) return;              // fertig
    if ((n || 0) > 20) return;                 // ~20s, dann aufgeben (kein Mandant / kein Akzent)
    setTimeout(function () { _pdfAccentPoll((n || 0) + 1); }, 1000);
  })(0);

  /* W20-mandantdisplay: Der Reseller stellt die Darstellung im Panel ein
     ("Meine Mandanten"), sie liegt als resellers.brand_display. Hier wird sie beim
     Mandanten angewandt — ueber DIESELBEN Handler, die auch das Panel benutzt.
     Kein zweiter Rendering-Pfad, keine Doppel-Wahrheit.
     WICHTIG: nur, wenn der Mandant NICHT selbst schon etwas eingestellt hat —
     seine eigene Wahl schlaegt die Vorgabe des Resellers. Sonst wuerde ihm bei
     jedem Login seine Einstellung weggenommen. */
  function applyResellerDisplay() {
    try {
      if (!_b) return;
      var d = _b.brand_display;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
      if (!d || typeof d !== 'object' || !Object.keys(d).length) return;
      var MAP = {
        dp_chrome_hell: function (v) { c('_dpDispSkin', v === '1' ? 'hell' : 'obsidian'); },
        dp_hdr_compact: function (v) { c('_dpDispHdr', v === '1' ? 'compact' : 'normal'); },
        dp_hdr_ui: function (v) { c('_dpDispHeader', v); },
        dp_side_ui: function (v) { c('_dpDispSide', v); },
        dp_text_ui: function (v) { c('_dpDispText', v); },
        dp_hero_ui: function (v) { c('_dpDispHero', v); },
        dp_kpi_ui: function (v) { c('_dpDispKpi', v); },
        dp_obj_ui: function (v) { c('_dpDispObj', v); },
        dp_objtext_ui: function (v) { c('_dpDispObjText', v); },
        dp_tabtext_ui: function (v) { c('_dpDispTabText', v); },
        dp_card_ui: function (v) { c('_dpDispCard', v); },
        dp_accent_ui: function (v) { c('_dpDispAccent', v); },
        dp_font_ui: function (v) { c('_dpDispFont', v); },
        dp_zoom_ui: function (v) { c('_dpDispSize', v); }
      };
      function c(fn, v) { try { if (typeof window[fn] === 'function' && v) window[fn](v); } catch (e) {} }
      var seen = false;
      try { seen = localStorage.getItem('dp_wl_display_seen') === '1'; } catch (e) {}
      if (seen) return;                       // Mandant hat es schon bekommen -> seine Wahl gilt
      Object.keys(d).forEach(function (k) { if (MAP[k] && d[k]) MAP[k](d[k]); });
      try { localStorage.setItem('dp_wl_display_seen', '1'); } catch (e) {}
      try { if (window._dpDispRefresh) _dpDispRefresh(); } catch (e) {}
    } catch (e) {}
  }
  (function _dispPoll(n) {
    try {
      if (_b && typeof window._dpDispHeader === 'function') { applyResellerDisplay(); return; }
    } catch (e) {}
    if ((n || 0) > 20) return;
    setTimeout(function () { _dispPoll((n || 0) + 1); }, 800);
  })(0);

  /* W25-fouc: laeuft SOFORT beim Script-Laden — vor jedem Netzwerk-Aufruf.
     Der gemerkte Stand vom letzten Mal wird angewandt; der Fetch korrigiert
     danach, falls der Reseller etwas geaendert hat. Beim Logout raeumt boot()
     den Cache weg (kein fremdes Branding fuer den naechsten Nutzer). */
  (function _fromCache() {
    try {
      if (!localStorage.getItem('ji_token')) { localStorage.removeItem('dp_wl_cache'); return; }
      var raw = localStorage.getItem('dp_wl_cache'); if (!raw) return;
      var c = JSON.parse(raw); if (!c || !c.whitelabel_enabled) return;
      _b = c;
      var go = function () {
        if (!window.DealPilotWhitelabel) return setTimeout(go, 30);
        try {
          window.DealPilotWhitelabel.apply({
            accent: c.brand_accent, accentHi: c.brand_accent_hi, accentLo: c.brand_accent_lo,
            obsidian: c.brand_obsidian, name: c.brand_name, logo: c.brand_logo_b64
          });
        } catch (e) {}
      };
      go();
    } catch (e) {}
  })();

  /* W37-plan-ready: boot() lief GENAU EINMAL, 700 ms nach dem Seitenladen.
     Beim Login gibt es da noch keinen Token -> return, fuer immer. Erst der
     Reload half. Vierter Fall der W3/W4/W7-Familie: reagiert, bevor die
     Daten da sind, und deutet den Fehlschlag still als "kein Mandant".
     _bootDone verhindert doppelte Fetches, wenn Timer und Ereignis beide
     zuenden. */
  var _bootDone = false;
  async function boot() {
    if (_bootDone) return;
    try { if (!localStorage.getItem('ji_token')) { localStorage.removeItem('dp_wl_cache'); return; } } catch (e) { return; }
    // Wrap früh installieren (liest _b dynamisch)
    if (!overrideBranding()) setTimeout(overrideBranding, 1000);
    try {
      var r = await Auth.apiCall('/reseller-invite/my-branding');
      _b = r && r.branding;
      /* W25-fouc: Branding merken, damit der naechste Login SOFORT faerbt statt
         erst nach dem Fetch. Ohne das sieht der Mandant ~1s DealPilot-Design und
         dann einen Umschlag — das wirkt wie ein Fehler, nicht wie seine Kanzlei. */
      try {
        if (_b) localStorage.setItem('dp_wl_cache', JSON.stringify(_b));
        else localStorage.removeItem('dp_wl_cache');
      } catch (e) {}
    } catch (e) { return; }
    _bootDone = true;   /* W37: erst NACH erfolgreichem Fetch sperren */
    if (!_b) return;
    /* W39-pdf-gold: _pdfAccentPoll gibt nach ~20s auf. Wer laenger am
       Login-Bildschirm steht — also jeder — bekam den Akzent NIE in die
       PDF-Palette, und das Bank-PDF blieb DealPilot-gold. Hier ist _b
       nachweislich da, also setzen wir ihn selbst. Fuenfter Fall der
       W3/W4/W7/W37-Familie: ein Timer, den man nie zuverlaessig gewinnt. */
    try { applyPdfAccent(); } catch (e) {}
    overrideBranding();
    applyAccent();
    replaceWordmark();
    // gegen den späten Theme-Boot (config.js setTimeout 1600) + Header-Render erneut anwenden
    setTimeout(function () { applyAccent(); replaceWordmark(); }, 1700);
    setTimeout(function () { applyAccent(); replaceWordmark(); }, 3200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 700); });
  else setTimeout(boot, 700);

  /* W37-plan-ready: DER eigentliche Fix. Der 700-ms-Timer oben deckt nur den
     Reload ab (Token schon da). Nach einem frischen Login existiert der Token
     erst SPAETER — dafuer gibt es seit W17 den Vertrag, den reseller-portal.js
     (Z.927) laengst nutzt und der hier fehlte. subscription.js feuert ihn,
     sobald der Plan wirklich bekannt ist. Kein neuer Timer, keine Retry-
     Schleife — die gewinnt man nie zuverlaessig. */
  window.addEventListener('dp:plan-ready', function () { boot(); });
  /* War der Plan schon da, bevor dieses Modul geladen wurde? */
  if (window.DealPilotPlanReady) boot();
})();
