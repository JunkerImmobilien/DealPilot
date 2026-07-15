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
    var sels = ['.dp-wordmark', '.sb-logo', '.hdr-brand', '.hdr-logo', '.sidebar-logo', '.brand-logo', '[class*="wordmark"]'];
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
        accent: acc, accentHi: hi, accentLo: lo, obsidian: _b.brand_obsidian
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
      return true;
    } catch (e) { return false; }
  }
  (function _pdfAccentPoll(n) {
    if (applyPdfAccent()) return;              // fertig
    if ((n || 0) > 20) return;                 // ~20s, dann aufgeben (kein Mandant / kein Akzent)
    setTimeout(function () { _pdfAccentPoll((n || 0) + 1); }, 1000);
  })(0);

  async function boot() {
    try { if (!localStorage.getItem('ji_token')) return; } catch (e) { return; }
    // Wrap früh installieren (liest _b dynamisch)
    if (!overrideBranding()) setTimeout(overrideBranding, 1000);
    try {
      var r = await Auth.apiCall('/reseller-invite/my-branding');
      _b = r && r.branding;
    } catch (e) { return; }
    if (!_b) return;
    overrideBranding();
    applyAccent();
    replaceWordmark();
    // gegen den späten Theme-Boot (config.js setTimeout 1600) + Header-Render erneut anwenden
    setTimeout(function () { applyAccent(); replaceWordmark(); }, 1700);
    setTimeout(function () { applyAccent(); replaceWordmark(); }, 3200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 700); });
  else setTimeout(boot, 700);
})();
