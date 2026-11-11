'use strict';
/**
 * mb-whitelabel.js (W36) — Whitelabel fuer die Marktbericht-App.
 *
 * WARUM EIGENES MODUL: marktbericht-app/index.html laeuft in einem IFRAME —
 * ein eigenes Dokument. Der Override im Elterndokument kommt hier nicht rein.
 * Exakt dieselbe Lage wie beim Quick-Check (qc-whitelabel.js, W18).
 *
 * Das iframe ist same-origin -> localStorage (ji_token) und /api/v1 erreichbar.
 * Es holt sein Branding selbst und uebergibt es an die Override-Ebene, die
 * hier ebenfalls geladen wird. Die setzt die Gold- und wl-Tokens dann auf
 * das documentElement DIESES Dokuments.
 */
(function () {
  function boot() {
    var tok = null;
    try { tok = localStorage.getItem('ji_token'); } catch (e) {}
    if (!tok) return;                       /* nicht eingeloggt -> DealPilot-Optik */
    if (!window.DealPilotWhitelabel) {      /* Override noch nicht da */
      return setTimeout(boot, 400);
    }
    var base = window.JI_API_BASE || '/api/v1';
    fetch(base + '/reseller-invite/my-branding', { headers: { Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var b = j && j.branding;
        if (!b) return;                     /* kein Mandant -> nichts tun */
        /* v2273 · der Markenname fürs PDF-Deckblatt (app.js) - dort stand fest „Junker Immobilien“ */
        if (b.brand_name) window._mbMarkenName = String(b.brand_name);
        /* v3299 · klassisches PDF-Deckblatt (app.js exportPdf): Marke statt
           "DealPilot MARKTBERICHT", Fuss mit der Website des Partners statt der
           Adresse, unter der die App laeuft. */
        window._mbMarke = {
          name: b.brand_name || '', website: b.brand_website || '',
          logoDunkel: b.brand_logo_auf_dunkel || '', logo: b.brand_logo_b64 || ''
        };
        if (b.brand_logo_b64 && !b.brand_logo_auf_dunkel && window.DealPilotLogoKontrast) {
          window.DealPilotLogoKontrast.varianten(b.brand_logo_b64, b.brand_logo_dark_b64 || null)
            .then(function (v) { window._mbMarke.logoDunkel = v.auf_dunkel; }, function () {});
        }
        window.DealPilotWhitelabel.apply({
          accent: b.brand_accent, accentHi: b.brand_accent_hi, accentLo: b.brand_accent_lo,
          obsidian: b.brand_obsidian, name: b.brand_name, logo: b.brand_logo_b64,
          logoDunkel: b.brand_logo_auf_dunkel || '', logoHell: b.brand_logo_auf_hell || ''   /* v3299 */
        });
      })
      .catch(function () { /* Branding ist Kuer, nie berichtsblockierend */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
