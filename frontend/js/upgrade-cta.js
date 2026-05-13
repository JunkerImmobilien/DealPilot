/**
 * V174 — Plan-Upgrade-CTA (deaktiviert seit V176)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Der goldene "Upgrade"-Pill rechts unten wurde in V174 eingeführt
 * aber war unpraktisch — versperrte UI. In V176 deaktiviert.
 *
 * Plan-Wechsel-Flow läuft jetzt über:
 *   User-Menü (Sidebar) → "Plan wechseln" → Settings-Modal → Plan-Tab
 *
 * Diese Datei bleibt im Bundle damit der Script-Tag in index.html nicht
 * 404 wirft. Tut sonst nichts mehr.
 */
(function () {
  'use strict';
  // V176: Disabled. Removed upgrade-pill und upgrade-modal.
  // Plan-Wechsel-Logik ist jetzt im Settings-Modal (settings.js: _renderPlanPane).
  console.log('[upgrade-cta] V176: deaktiviert — Plan-Wechsel via Settings → Plan-Tab');
})();
