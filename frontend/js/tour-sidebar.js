/* V270-tour-sidebar-disabled: Tour starten aus Aktionen-Sidebar entfernt
 * Tour-Engine bleibt aktiv über Hilfe-Modal Button.
 * Original-Datei archiviert via Git-History.
 */
(function() {
  'use strict';

  // No-op: Tour-Sidebar-Item wird nicht mehr ins DOM eingefügt
  function startTourFromSidebar() {
    // Fallback: über andere Mechanismen Tour starten
    if (typeof window.startTour === 'function') {
      window.startTour();
    } else {
      var btn = document.querySelector('[data-action="start-tour"], button[onclick*="startTour"], .tour-start-btn');
      if (btn) btn.click();
    }
  }

  // Exports beibehalten für andere Module die das evtl. aufrufen
  window.startTourFromSidebar = startTourFromSidebar;
})();
