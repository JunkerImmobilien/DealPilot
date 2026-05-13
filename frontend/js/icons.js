'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V33 — icons.js
   Inline SVG-Icons im Lucide-Style (MIT-Lizenz, https://lucide.dev)
   
   Verwendung:
     <span class="dp-ico">${Icons.house()}</span>
     <span class="dp-ico dp-ico-sm">${Icons.trendingUp({ size: 16 })}</span>
   
   Default-Größe: 20x20, currentColor — übernimmt Farbe vom Parent.
═══════════════════════════════════════════════════════════════ */

window.Icons = (function() {
  function _wrap(path, opts) {
    var s = (opts && opts.size) || 20;
    var stroke = (opts && opts.stroke) || 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" ' +
           'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + stroke + '" ' +
           'stroke-linecap="round" stroke-linejoin="round" class="dp-svg">' + path + '</svg>';
  }

  // Navigations- / UI-Icons
  return {
    // Häuser & Immobilien
    house: function(o) { return _wrap('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', o); },
    building: function(o) { return _wrap('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>', o); },
    folder: function(o) { return _wrap('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>', o); },
    folderOpen: function(o) { return _wrap('<path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>', o); },

    // Finanzen / Charts
    trendingUp: function(o) { return _wrap('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>', o); },
    trendingDown: function(o) { return _wrap('<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>', o); },
    pieChart: function(o) { return _wrap('<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>', o); },
    barChart: function(o) { return _wrap('<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>', o); },
    coins: function(o) { return _wrap('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>', o); },
    euro: function(o) { return _wrap('<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>', o); },
    target: function(o) { return _wrap('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>', o); },

    // Risiko / Sicherheit
    shield: function(o) { return _wrap('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>', o); },
    shieldCheck: function(o) { return _wrap('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>', o); },
    alert: function(o) { return _wrap('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', o); },
    info: function(o) { return _wrap('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>', o); },
    check: function(o) { return _wrap('<polyline points="20 6 9 17 4 12"/>', o); },
    x: function(o) { return _wrap('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', o); },
    trash: function(o) { return _wrap('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>', o); },
    eye: function(o) { return _wrap('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', o); },
    layout: function(o) { return _wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>', o); },

    // Kommunikation / Aktionen
    handshake: function(o) { return _wrap('<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>', o); },
    fileText: function(o) { return _wrap('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>', o); },
    download: function(o) { return _wrap('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', o); },
    upload: function(o) { return _wrap('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>', o); },
    plus: function(o) { return _wrap('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', o); },
    refresh: function(o) { return _wrap('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>', o); },
    copy: function(o) { return _wrap('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', o); },
    settings: function(o) { return _wrap('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>', o); },
    help: function(o) { return _wrap('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>', o); },
    feedback: function(o) { return _wrap('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', o); },

    // V63.74: Icons für Feedback & Support
    compass: function(o) { return _wrap('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>', o); },
    route: function(o) { return _wrap('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>', o); },
    flag: function(o) { return _wrap('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>', o); },
    lifebuoy: function(o) { return _wrap('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="14.83" y1="9.17" x2="18.36" y2="5.64"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/>', o); },
    bug: function(o) { return _wrap('<rect x="8" y="6" width="8" height="14" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/><path d="M20 13h-4"/><path d="M4 13h4"/><path d="m10 4 1 2"/><path d="m14 4-1 2"/>', o); },
    helpCircle: function(o) { return _wrap('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>', o); },
    database: function(o) { return _wrap('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>', o); },
    creditCard: function(o) { return _wrap('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>', o); },
    mail: function(o) { return _wrap('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>', o); },
    camera: function(o) { return _wrap('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>', o); },
    logOut: function(o) { return _wrap('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>', o); },
    badge: function(o) { return _wrap('<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>', o); },
    user: function(o) { return _wrap('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', o); },
    bank: function(o) { return _wrap('<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>', o); },
    sparkles: function(o) { return _wrap('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>', o); },
    brain: function(o) { return _wrap('<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>', o); },
    trophy: function(o) { return _wrap('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>', o); },
    clipboard: function(o) { return _wrap('<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>', o); },
    search: function(o) { return _wrap('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', o); },
    chevronDown: function(o) { return _wrap('<polyline points="6 9 12 15 18 9"/>', o); },
    chevronRight: function(o) { return _wrap('<polyline points="9 18 15 12 9 6"/>', o); },
    arrowRight: function(o) { return _wrap('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>', o); },
    star: function(o) { return _wrap('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', o); },
    starOutline: function(o) { return _wrap('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none"/>', o); },
    calendar: function(o) { return _wrap('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', o); },
    map: function(o) { return _wrap('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>', o); },
    scale: function(o) { return _wrap('<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>', o); },
    lightbulb: function(o) { return _wrap('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>', o); },
    link: function(o) { return _wrap('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', o); },
    zap: function(o) { return _wrap('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', o); },
    save: function(o) { return _wrap('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>', o); },
    image: function(o) { return _wrap('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>', o); },
    chartLine: function(o) { return _wrap('<path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/>', o); },

    // Stylesheet einmalig injizieren
    _injectCss: function() {
      if (document.getElementById('dp-icons-css')) return;
      var s = document.createElement('style');
      s.id = 'dp-icons-css';
      s.textContent = '.dp-ico{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;line-height:0}' +
                      '.dp-ico .dp-svg{display:block}' +
                      '.dp-ico-sm .dp-svg{width:14px;height:14px}' +
                      '.dp-ico-md .dp-svg{width:18px;height:18px}' +
                      '.dp-ico-lg .dp-svg{width:24px;height:24px}' +
                      '.dp-ico-xl .dp-svg{width:32px;height:32px}';
      document.head.appendChild(s);
    }
  };
})();

// Auto-inject CSS
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { Icons._injectCss(); });
} else {
  Icons._injectCss();
}

/* ═══════════════════════════════════════════════════════════════
   V33: Auto-Replace für Emoji-Prefixes in der Sidebar / Buttons
   Statt 50 HTML-Stellen anzufassen, suchen wir nach den bekannten
   Emoji-Prefixen und ersetzen sie zur Laufzeit durch SVG-Icons.
═══════════════════════════════════════════════════════════════ */
(function() {
  // Mapping: Emoji am Anfang → Icon-Funktion
  var EMOJI_MAP = [
    { rx: /^📁\s*/, icon: 'folder' },
    { rx: /^📂\s*/, icon: 'folderOpen' },
    { rx: /^📊\s*/, icon: 'pieChart' },
    { rx: /^📈\s*/, icon: 'trendingUp' },
    { rx: /^📉\s*/, icon: 'trendingDown' },
    { rx: /^🏦\s*/, icon: 'bank' },
    { rx: /^📋\s*/, icon: 'clipboard' },
    { rx: /^📄\s*/, icon: 'fileText' },
    { rx: /^⚙️?\s*/, icon: 'settings' },
    { rx: /^🔍\s*/, icon: 'search' },
    { rx: /^🤖\s*/, icon: 'sparkles' },
    { rx: /^🧠\s*/, icon: 'brain' },
    { rx: /^💰\s*/, icon: 'coins' },
    { rx: /^🏆\s*/, icon: 'trophy' },
    { rx: /^🎯\s*/, icon: 'target' },
    { rx: /^🛡️?\s*/, icon: 'shield' },
    { rx: /^💡\s*/, icon: 'lightbulb' },
    { rx: /^🔗\s*/, icon: 'link' },
    { rx: /^✦\s*/, icon: 'sparkles' },
    { rx: /^✨\s*/, icon: 'sparkles' },
    { rx: /^👤\s*/, icon: 'user' },
    { rx: /^🏠\s*/, icon: 'house' },
    { rx: /^🏢\s*/, icon: 'building' },
    { rx: /^📅\s*/, icon: 'calendar' },
    { rx: /^🗺️?\s*/, icon: 'map' },
    { rx: /^⚖️?\s*/, icon: 'scale' },
    { rx: /^⚠️?\s*/, icon: 'alert' },
    { rx: /^ⓘ\s*/, icon: 'info' },
    { rx: /^→\s*/, icon: 'arrowRight' },
    { rx: /^▾\s*/, icon: 'chevronDown' },
    { rx: /^▸\s*/, icon: 'chevronRight' },
    { rx: /^↻\s*/, icon: 'refresh' },
    { rx: /^\+\s+/, icon: 'plus' },
  ];

  function _replaceTextNode(node) {
    var t = node.textContent;
    if (!t) return;
    for (var i = 0; i < EMOJI_MAP.length; i++) {
      var m = t.match(EMOJI_MAP[i].rx);
      if (m && Icons[EMOJI_MAP[i].icon]) {
        var rest = t.replace(EMOJI_MAP[i].rx, '');
        // Nur ersetzen wenn nach dem Emoji noch Text kommt — sonst Single-Icon-Buttons ignorieren
        if (rest.trim().length === 0) return;
        var span = document.createElement('span');
        span.className = 'dp-ico dp-ico-replaced';
        span.innerHTML = Icons[EMOJI_MAP[i].icon]({ size: 16 });
        span.style.marginRight = '7px';
        var parent = node.parentNode;
        if (!parent) return;
        // Skip falls schon mal ersetzt
        if (parent.querySelector && parent.querySelector('.dp-ico-replaced')) return;
        parent.insertBefore(span, node);
        node.textContent = rest;
        return;
      }
    }
  }

  function replaceEmojisIn(root) {
    if (!root) return;
    // Ziele: Buttons, Section-Titles, Tab-Labels — nicht alle Texte!
    var selectors = [
      '.sb-section-title',
      '.sb-nav-btn',
      '.sb-collapsible-header > span',
      '.tab',
      '.btn',
      '.vw-btn',                      // V34: View-Switcher (Einzelobjekt / Alle Objekte)
      '.ai-title',
      '.ai-mini-title > span',        // V34: KI-Mini-Title
      '.section-title',
      '.card-title',
      '.ct',                          // V34: Card-Titles im Cashflow
      '.kpi-eval-title > span',       // V34: Kennzahlen-Bewertung Title
      '.cf-phase-title',              // V34: Cashflow-Phase-Titles
      '.cr-title',
      '.fesh-apply-btn'               // V34: FESH-Apply-Button
    ];
    var els = root.querySelectorAll(selectors.join(','));
    els.forEach(function(el) {
      // Nur direkter Text-Inhalt, nicht durch HTML-Children rekursiv
      var first = el.firstChild;
      if (first && first.nodeType === 3) {  // Textnode
        _replaceTextNode(first);
      }
    });
  }

  // Beim DOM-Load und nach Sidebar-Re-Renders
  function _runIconReplace() {
    try { replaceEmojisIn(document.body); } catch(e) { console.warn('icon replace:', e); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _runIconReplace);
  } else {
    setTimeout(_runIconReplace, 50);
  }
  // Re-Run nach dynamischen Renders
  window.refreshIcons = _runIconReplace;
})();

/* ═══════════════════════════════════════════════════════════════
   V34: Slot-Filler — bestimmte Container mit fest zugeordneten
   Icons befüllen (statt Emojis). Greift beim DOM-Load.
═══════════════════════════════════════════════════════════════ */
(function() {
  var SLOTS = [
    { id: 'ai-icon-main',     icon: 'sparkles', size: 22 },
    { id: 'ai-mini-icon-svg', icon: 'sparkles', size: 16 }
  ];
  function fillSlots() {
    SLOTS.forEach(function(s) {
      var el = document.getElementById(s.id);
      if (el && Icons[s.icon]) {
        el.innerHTML = Icons[s.icon]({ size: s.size });
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillSlots);
  } else {
    setTimeout(fillSlots, 50);
  }
})();

/* ═══════════════════════════════════════════════════════════════
   V53: Generischer data-ico Filler — jedes Element mit data-ico="name"
   wird automatisch mit dem Icon befüllt. Größe via data-ico-size.
═══════════════════════════════════════════════════════════════ */
(function() {
  function fillDataIcos() {
    document.querySelectorAll('[data-ico]').forEach(function(el) {
      if (el.dataset.icoFilled === '1') return;
      var name = el.getAttribute('data-ico');
      var size = parseInt(el.getAttribute('data-ico-size')) || 18;
      if (Icons[name]) {
        el.innerHTML = Icons[name]({ size: size });
        el.dataset.icoFilled = '1';
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillDataIcos);
  } else {
    setTimeout(fillDataIcos, 50);
  }
  // Auch nach dynamischen Renders re-runnen
  window.refreshDataIcos = fillDataIcos;
})();
