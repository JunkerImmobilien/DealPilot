/* V260-04: Tour-Start im Sidebar-Aktionen-Akkordeon + Score-Hide */
(function() {
  'use strict';

  function injectTourEntry() {
    const inner = document.querySelector('.sb-actions-accordion-inner');
    if (!inner) return;
    if (inner.querySelector('[data-v260-tour]')) return;
    
    const div = document.createElement('div');
    div.className = 'sb-tour-item';
    div.setAttribute('data-v260-tour', '1');
    div.innerHTML = '<span class="sb-tour-item-icon">🎓</span><span>Tour starten</span>';
    div.onclick = function() {
      startTourFromSidebar();
    };
    inner.appendChild(div);
  }
  
  function startTourFromSidebar() {
    document.body.classList.add('dp-tour-active');
    
    // Bestehende Tour-Start-Funktion suchen
    const fns = [
      () => window.startTour && window.startTour(),
      () => window.DpTour && window.DpTour.start && window.DpTour.start(),
      () => window.dpTourStart && window.dpTourStart(),
      () => {
        // Fallback: vorhandenen Tour-Button klicken
        const btn = document.querySelector('[data-action="start-tour"], button[onclick*="startTour"], .tour-start-btn');
        if (btn) btn.click();
      }
    ];
    for (const fn of fns) {
      try { fn(); break; } catch(e) {}
    }
    
    // Sidebar zumachen
    if (window.sbActionsToggle) {
      const acc = document.getElementById('sb-actions-accordion');
      if (acc && acc.classList.contains('sb-actions-open')) {
        sbActionsToggle();
      }
    }
  }
  
  // Wenn Tour endet, dp-tour-active wieder entfernen
  function watchTourEnd() {
    // Hook into existing tour-end events
    document.addEventListener('tour:end', function() {
      document.body.classList.remove('dp-tour-active');
    });
    // Polling fallback: wenn Tour-DOM weg, Klasse entfernen
    setInterval(() => {
      if (document.body.classList.contains('dp-tour-active')) {
        const tourEl = document.querySelector('.tour-tooltip, .dp-tour, [class*="tour-step"]');
        if (!tourEl) {
          document.body.classList.remove('dp-tour-active');
        }
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(injectTourEntry, 800);
      watchTourEnd();
    });
  } else {
    setTimeout(injectTourEntry, 800);
    watchTourEnd();
  }
  
  window.DpTourSidebar = {
    injectTourEntry,
    startTourFromSidebar,
    _meta: 'V260-04'
  };
})();
