/* ============================================================================
   DealPilot v443 – finanz-card-merge.js (v3)
   Eine kompakte Kopfzeile in #v10-zins-compact:
     [Titel "Indikative Konditionen…"]  ........  [LTV-Switch] [Marktdaten ansehen]
   Tiles flacher. Leere Empfehlungs-Zeile (row1) entfernt. Default-Marge: schwach (>90%).
   Idempotent. Frontend-only.
   ============================================================================ */
(function () {
  'use strict';
  /* dpfk-v3-off: deaktiviert — dpfk-Band uebernimmt die Kopfzeile (kein Strip-Klau) */ return;
  var LTV = [
    { key: 'premium',  label: '\u226460\u202f%' },
    { key: 'standard', label: '\u226480\u202f%' },
    { key: 'schwach',  label: '>90\u202f%' }
  ];
  var DEFAULT_KEY = 'schwach';

  function setMargin(key) {
    try { if (typeof window.setPfandbriefMargin === 'function') window.setPfandbriefMargin(key); } catch (e) {}
    var sw = document.getElementById('ltv-switch');
    if (sw) sw.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-ltv') === key);
    });
  }
  function buildSwitcher() {
    var sw = document.createElement('span');
    sw.className = 'ltv-switch'; sw.id = 'ltv-switch';
    sw.setAttribute('aria-label', 'Beleihungsauslauf w\u00e4hlen');
    sw.innerHTML = LTV.map(function (o) {
      return '<button type="button" data-ltv="' + o.key + '"' +
             (o.key === DEFAULT_KEY ? ' class="active"' : '') + '>' + o.label + '</button>';
    }).join('');
    sw.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-ltv]'); if (!b) return;
      setMargin(b.getAttribute('data-ltv'));
    });
    return sw;
  }

  function build() {
    var card = document.getElementById('v10-zins-compact');
    var strip = document.getElementById('mrpf-top-strip');
    if (!card || !strip) return false;

    // Alt-Reste aus v440/v442 entfernen
    var oldHead = document.getElementById('mrpf-register-head'); if (oldHead) { try { oldHead.remove(); } catch (e) {} }
    var oldTitle = card.querySelector('.v441-cond-title'); if (oldTitle) { try { oldTitle.remove(); } catch (e) {} }
    var oldRow442 = card.querySelector('.v442-cond-row'); if (oldRow442) { try { oldRow442.remove(); } catch (e) {} }

    if (!card.querySelector('.v443-cond-row')) {
      var row = document.createElement('div');
      row.className = 'v443-cond-row';
      var title = document.createElement('span');
      title.className = 'v443-cond-title';
      title.textContent = 'Indikative Konditionen nach Zinsbindung';
      var right = document.createElement('span');
      right.className = 'v443-cond-right';
      right.appendChild(buildSwitcher());
      // vorhandenen "Marktdaten ansehen"-Button in die Kopfzeile holen
      var btn = card.querySelector('.v10-zc-btn');
      if (btn) { btn.classList.add('v443-mkt-btn'); right.appendChild(btn); }
      row.appendChild(title);
      row.appendChild(right);
      // Kopfzeile als ERSTES Element der Card
      card.insertBefore(row, card.firstChild);
    }

    // leere Empfehlungs-Zeile (row1) ausblenden (Button ist umgezogen)
    var row1 = card.querySelector('.v10-zc-row1'); if (row1) row1.style.display = 'none';

    if (!card.querySelector('#mrpf-top-strip')) { strip.style.display = ''; card.appendChild(strip); }
    return true;
  }

  function applyDefaultMargin() {
    setMargin(DEFAULT_KEY);
    [600, 1300, 2200, 3500].forEach(function (ms) { setTimeout(function () { setMargin(DEFAULT_KEY); }, ms); });
  }

  var t = 0;
  // v481: boot als Funktions-DEKLARATION (nicht benannter Ausdruck), damit der
  // Name auch im DOMContentLoaded-Handler unten im Scope ist. Vorher:
  // "(function boot(){...})()" -> Name nur INNERHALB -> "boot is not defined".
  function boot() {
    if (build()) { applyDefaultMargin(); return; }
    if (t++ < 60) setTimeout(boot, 200);
  }
  boot();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  }
})();
