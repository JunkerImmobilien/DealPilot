/* js/leerzustand.js — v5020a · Was ohne Objekt und ohne Bestand keinen Sinn ergibt
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Marcel 25.11.2026: „kannst du bitte auch prüfen, ob gewisse Sachen ausgeblendet werden sollten, wenn man noch
 * kein Objekt angelegt hat oder auf gewonnen gesetzt hat … Sachen, die keinen Sinn machen, sollten wir ausblenden
 * oder vereinfachen."
 *
 * GEMESSEN 25.11.2026 auf Staging mit zwei Testkonten (A ohne Objekt, B nur Ankauf), Gestaltung Aktenmappe:
 *   A  Ausgeben: Track Record, Bankexport und Export stehen im Menü, ein Klick zeigt nur
 *      „Bitte zuerst mindestens ein Objekt speichern“ bzw. ein leeres Export-Fenster.        → ausgeblendet
 *   A  Portfolio-Liste: grauer kursiver Satz „Noch keine Objekte gespeichert.“ ohne Weg.      → Karte mit „Erstes
 *      Objekt anlegen“ und „Quick Boarding“ (storage.js _sbLeer)
 *   B  Track Record ohne gewonnenes Objekt zeigt ersatzweise ALLE Objekte als „Nachweis“.     → ausgeblendet, bis
 *      ein Objekt gewonnen ist (dieselbe Regel wie das Portfolio-Cockpit seit v4010)
 *   B  Reiter Steuer eines Ankaufsobjekts: „Jahresende: Tipp zur Jahreszeit“ (Reparaturen bis 31.12. bezahlen)
 *      und das Finanzamt-PDF mit Anlage V für ein Haus, das noch nicht gekauft ist.            → im Ankauf aus,
 *      ein Satz sagt, wann es erscheint
 *   Schon richtig: Portfolio-Cockpit erst mit Bestand (v4010), Objekt-Cockpit und Jahresabgleich nur bei
 *   gewonnenen Objekten (v4460), Bestand-Liste mit eigenem Leersatz (doppelkarte.js v4600), Pilot-Analyse
 *   und Bewertung ohne Kaufpreis mit Leerzustand und Weg („Daten eingeben“).
 *
 * Gesteuert nur über Attribute am <html>, nie per Inline-Stil (v1935d):
 *   data-dp-objekte = "0" | "n"        aus storage.js _dpBestandMelden (dieselbe Listenabfrage wie die Karten)
 *   data-dp-lz-bestand = "0" | "1"        dito
 *   data-dp-obj-phase = "ankauf" | "bestand" | ""   das geladene Objekt (gewonnen = Bestand)
 * Einstellungen, Deal-Check, Marktbericht, Import und Neues Objekt bleiben immer erreichbar.
 */
(function () {
  'use strict';
  if (window.DpLeerzustand) return;
  var H = document.documentElement;

  function gewonnen() {
    try {
      var d = window._currentObjData, el = document.getElementById('_deal_won_state');
      if (d && (d._deal_lost === true || d._deal_lost === 'true')) return false;
      if (el && el.value === 'true') return true;
      return !!(d && (d._deal_won === true || d._deal_won === 'true'));
    } catch (e) { return false; }
  }
  function phase() {
    var p = '';
    try { if (window._currentObjKey) p = gewonnen() ? 'bestand' : 'ankauf'; } catch (e) {}
    if (H.getAttribute('data-dp-obj-phase') !== p) H.setAttribute('data-dp-obj-phase', p);
    hinweis();
  }
  /* Ein Satz an der Stelle des Finanzamt-PDFs, nur im Ankauf sichtbar (CSS) */
  function hinweis() {
    try {
      var c = document.querySelector('.fa-pdf-ctrl'); if (!c || c.parentNode.querySelector('.dp-lz-fa')) return;
      var s = document.createElement('span'); s.className = 'dp-lz-fa';
      s.textContent = 'Finanzamt-PDF und Anlage V gibt es, sobald das Objekt in der Deal-Aktion auf gewonnen steht.';
      c.parentNode.insertBefore(s, c.nextSibling);
    } catch (e) {}
  }
  function melden(n, bestand) {
    H.setAttribute('data-dp-objekte', n > 0 ? 'n' : '0');
    H.setAttribute('data-dp-lz-bestand', bestand ? '1' : '0');
  }

  (function stil() {
    if (document.getElementById('dp-lz-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-lz-stil';
    /* Anker wie v4010: aside.sidebar .sb-act-item{display:flex!important} (0,2,1) schlägt schwächere Sperren,
       ab 1025 px steht das Register in der .dpl-schiene (#sb-actions-accordion) */
    var P = ['html[data-dp-objekte="0"] body #sidebar ', 'html[data-dp-objekte="0"] body #sb-actions-accordion ', 'html[data-dp-objekte="0"] body '];
    var aus = P.map(function (p) { return p + '.sb-act-item.sb-act-ausgeben,' + p + '.sb-act-section-title.sb-act-ausgeben'; }).join(',');
    var Q = ['html[data-dp-lz-bestand="0"] body #sidebar ', 'html[data-dp-lz-bestand="0"] body #sb-actions-accordion ', 'html[data-dp-lz-bestand="0"] body '];
    var tr = Q.map(function (p) { return p + ".sb-act-item[onclick=\"sbActionsAction('trackrec')\"]"; }).join(',');
    s.textContent = aus + ',' + tr + '{display:none !important}'
      /* Reiter Steuer im Ankauf */
      + 'html[data-dp-obj-phase="ankauf"] details.ytf-hinweis,html[data-dp-obj-phase="ankauf"] .fa-pdf-ctrl,'
      /* tax.js setzt am Handy html body #s3-tax .tax-module-card .fa-pdf-ctrl{display:grid!important} (1,2,2) */
      + 'html[data-dp-obj-phase="ankauf"] body #s3-tax .tax-module-card .fa-pdf-ctrl,html[data-dp-obj-phase="ankauf"] body #s3-tax details.ytf-hinweis{display:none !important}'
      + '.dp-lz-fa{display:none}html[data-dp-obj-phase="ankauf"] .dp-lz-fa{display:block;flex:1 1 100%;margin:4px 0 0;font:400 12px/1.4 Inter,system-ui,sans-serif;color:#6B645A}'
      /* Leere Objektliste (storage.js _sbLeer) */
      + '.sb-leer{margin:14px 10px;padding:14px;border:1px dashed color-mix(in srgb,var(--gold,var(--wl-c9a84c,#C9A84C)) 55%,transparent);border-radius:12px;text-align:left}'
      + '.sb-leer b{display:block;font:600 13.5px/1.35 Inter,system-ui,sans-serif;color:inherit;margin:0 0 4px}'
      + '.sb-leer p{margin:0 0 10px;font:400 12px/1.45 Inter,system-ui,sans-serif;opacity:.75}'
      + '.sb-leer button{display:block;width:100%;margin:6px 0 0;padding:8px 10px;border-radius:8px;font:600 12.5px Inter,system-ui,sans-serif;cursor:pointer;border:1px solid color-mix(in srgb,var(--gold,var(--wl-c9a84c,#C9A84C)) 60%,transparent);background:transparent;color:inherit}'
      + '.sb-leer button.haupt{background:linear-gradient(110deg,var(--gold-hi,var(--wl-e8cc7a,#E8CC7A)),var(--gold,var(--wl-c9a84c,#C9A84C)) 55%,var(--gold-lo,var(--wl-b8932f,#b8932f)));color:#1a1712;border-color:transparent}';
    (document.head || document.documentElement).appendChild(s);
  })();

  window.addEventListener('dp:object-ready', function () { setTimeout(phase, 50); setTimeout(phase, 1200); });
  document.addEventListener('change', function (ev) { if (ev.target && ev.target.id === '_deal_won_state') phase(); }, true);
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('nav.tabs .tab, [data-deal-status], .dab-status button, [onclick*="setStatus"]') : null;
    if (t) setTimeout(phase, 400);
  }, true);
  setTimeout(phase, 1500);

  window.DpLeerzustand = { VERSION: 'v5020a', melden: melden, phase: phase };
})();
