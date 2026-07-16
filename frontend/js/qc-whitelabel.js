'use strict';
/**
 * qc-whitelabel.js (W18) — Whitelabel fuer den Quick-Check-iframe
 *
 * WARUM EIGENES MODUL: quickcheck-app.html laeuft in einem IFRAME — ein eigenes
 * Dokument. Der Sweeper aus W6 laeuft im Elterndokument und kommt hier nicht rein.
 * Gemessen am 15.07.: im QC war `document.querySelectorAll('.dpx').length === 0`
 * und die Quelle hiess `quickcheck-app.html?v=904` — also ein separates Document.
 *
 * Der iframe hat Zugriff auf localStorage (same-origin) und damit auf ji_token.
 * Er holt sein Branding selbst und uebergibt es an die Override-Ebene, die hier
 * ebenfalls geladen wird. Die faengt dann beide --gold-Definitionen ab:
 *   Z.13    :root { --gold: #C9A84C }
 *   Z.6020  #qb-bp { --gold:#C9A84C; --gold-hi:#E8CC7A; ... }   (eigener Namensraum)
 * plus die 138 harten Gold-Stellen im QC.
 */
(function () {
  function boot() {
    var tok = null;
    try { tok = localStorage.getItem('ji_token'); } catch (e) {}
    if (!tok) return;                       // nicht eingeloggt -> DealPilot-Optik
    if (!window.DealPilotWhitelabel) {      // Override-Ebene noch nicht da
      return setTimeout(boot, 400);
    }
    var base = window.JI_API_BASE || '/api/v1';
    fetch(base + '/reseller-invite/my-branding', { headers: { Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var b = j && j.branding;
        if (!b) return;                     // kein Mandant / kein Whitelabel -> nichts tun
        window.DealPilotWhitelabel.apply({
          accent: b.brand_accent, accentHi: b.brand_accent_hi, accentLo: b.brand_accent_lo,
          obsidian: b.brand_obsidian, name: b.brand_name, logo: b.brand_logo_b64
        });
      })
      .catch(function () { /* Branding ist Kuer, nie QC-blockierend */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
