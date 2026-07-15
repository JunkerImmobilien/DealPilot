'use strict';
/**
 * mobile-branding.js (W2) — Whitelabel fuer die Mobile-App
 *
 * Warum eigenes Modul statt mandant-branding.js: die Mobile-App hat eine EIGENE
 * DOM-Struktur (.brand b, .brandbar .lg) — die Selektoren der Desktop-Version
 * (.dp-wordmark, .sb-logo, .hdr-brand) greifen hier nicht.
 *
 * Muss VOR dem Inline-Script von mobile-demo.html geladen werden, damit
 * window._mbGold()/_mbGoldA() dort verfuegbar sind.
 */
(function () {
  var DEF_GOLD = '#C9A84C';

  /* ── Farb-Helfer (auch ohne Reseller nutzbar) ─────────────── */
  function _gold() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--gold');
      v = (v || '').trim();
      return v || DEF_GOLD;
    } catch (e) { return DEF_GOLD; }
  }
  function _goldA(alpha) {
    var h = _gold();
    if (!/^#[0-9a-fA-F]{6}$/.test(h)) return 'rgba(201,168,76,' + alpha + ')';
    return 'rgba(' + parseInt(h.substr(1, 2), 16) + ',' + parseInt(h.substr(3, 2), 16) +
           ',' + parseInt(h.substr(5, 2), 16) + ',' + alpha + ')';
  }
  window._mbGold = _gold;
  window._mbGoldA = _goldA;

  /* ── Reseller-Branding holen ──────────────────────────────── */
  var _b = null;

  function _hex(h) { return /^#[0-9a-fA-F]{6}$/.test(h || '') ? h : null; }
  function _mix(hex, pct) {           // pct>0 heller, pct<0 dunkler
    if (!_hex(hex)) return null;
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    function f(v) {
      var x = pct > 0 ? v + (255 - v) * pct : v * (1 + pct);
      return Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
    }
    return '#' + f(r) + f(g) + f(b);
  }

  function applyColors() {
    if (!_b) return;
    var acc = _hex(_b.brand_accent); if (!acc) return;
    var hi = _hex(_b.brand_accent_hi) || _mix(acc, 0.35);
    var lo = _hex(_b.brand_accent_lo) || _mix(acc, -0.25);
    var rs = document.documentElement.style;
    rs.setProperty('--gold', acc);
    rs.setProperty('--gold-hi', hi);
    rs.setProperty('--gold-deep', _mix(acc, -0.30));
    rs.setProperty('--gold-dim', _mix(acc, -0.35));
    rs.setProperty('--runway', 'linear-gradient(110deg,' + hi + ',' + acc + ' 55%,' + lo + ')');
    var obs = _hex(_b.brand_obsidian);
    if (obs) rs.setProperty('--obsidian', obs);
    /* Theme-Farbe der PWA mitziehen */
    try {
      var m = document.querySelector('meta[name="theme-color"]');
      if (m && obs) m.setAttribute('content', obs);
    } catch (e) {}
  }

  /* ── Wortmarke ersetzen ───────────────────────────────────── */
  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  function applyWordmark() {
    if (!_b) return;
    var label = _b.brand_name || '';
    var logo = _b.brand_logo_b64 || '';
    if (!label && !logo) return;

    /* WICHTIG: .brandbar .lg wird auch fuer "Quick Boarding", "Ergebnis",
       "Exposé einlesen" usw. benutzt — NUR die echten DealPilot-Wortmarken
       anfassen, sonst werden Seitentitel ueberschrieben. */
    var els = document.querySelectorAll('.brand b, .brandbar .lg, .intro .ey');
    Array.prototype.forEach.call(els, function (el) {
      if (el.getAttribute('data-mb-brand')) return;
      var txt = (el.textContent || '').replace(/\s+/g, '');
      if (txt !== 'DealPilot' && txt !== 'DealPilot·MobileApp') return;
      el.setAttribute('data-mb-brand', '1');
      if (logo) el.innerHTML = '<img src="' + _esc(logo) + '" alt="' + _esc(label) + '" style="max-height:22px;max-width:130px;vertical-align:middle">';
      else el.textContent = label;
    });

    /* Initial-Kachel .brand .g ("D") */
    var g = document.querySelector('.brand .g');
    if (g && label && !g.getAttribute('data-mb-brand')) {
      g.setAttribute('data-mb-brand', '1');
      g.textContent = label.trim().charAt(0).toUpperCase();
    }

    /* Gate-Wortmarke (wird per JS gerendert -> spaeter nochmal versuchen) */
    try {
      var gate = document.querySelector('#mb-gate div[style*="font-weight:700"]');
      if (gate && !gate.getAttribute('data-mb-brand') && /DealPilot/.test(gate.textContent || '')) {
        gate.setAttribute('data-mb-brand', '1');
        gate.innerHTML = logo
          ? '<img src="' + _esc(logo) + '" alt="' + _esc(label) + '" style="max-height:34px;max-width:180px">'
          : '<span style="color:#f6f2e8">' + _esc(label) + '</span>';
      }
    } catch (e) {}

    try { document.title = label + ' · App'; } catch (e) {}
  }

  function applyAll() { applyColors(); applyWordmark(); }

  /* ── Laden ────────────────────────────────────────────────── */
  async function load() {
    var tok = null;
    try { tok = localStorage.getItem('ji_token'); } catch (e) {}
    if (!tok) return;                     // nicht eingeloggt -> DealPilot-Optik
    try {
      var base = window.JI_API_BASE || '/api/v1';
      var r = await fetch(base + '/reseller-invite/my-branding', {
        headers: { Authorization: 'Bearer ' + tok }
      });
      if (!r.ok) return;                  // kein Mandant / kein Whitelabel -> still nichts tun
      var j = await r.json();
      if (!j || !j.branding) return;
      _b = j.branding;
      applyAll();
      /* Views werden dynamisch gerendert -> nachziehen */
      try {
        new MutationObserver(function () { applyWordmark(); })
          .observe(document.body, { childList: true, subtree: true });
      } catch (e) {}
      [600, 1800, 4000].forEach(function (ms) { setTimeout(applyAll, ms); });
    } catch (e) { /* Branding ist Kuer, nie App-blockierend */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
