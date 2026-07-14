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
          if (_b.brand_name) { b.company = _b.brand_name; b.product_name = _b.brand_name; }
          if (_b.brand_logo_b64) b.logo_b64 = _b.brand_logo_b64;
          b.is_custom = true;
        }
        return b;
      };
      return true;
    } catch (e) { return false; }
  }

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
