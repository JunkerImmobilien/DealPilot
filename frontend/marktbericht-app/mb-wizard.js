/* ============================================================================
   DealPilot v1127 — mb-wizard.js
   „Aus 4.608 px Scroll werden Reiter." (Marcels Entscheidung 2026-08-11,
   Entwurf: design/Vorschlaege/marktbericht-wizard.html)

   ── DIE REITER SIND DIE MEILENSTEINE ──────────────────────────────────────
   Drei Reiter, nicht fuenf. Der Entwurf zeigte fuenf Schritte; beim Bauen
   hat die Struktur eine bessere Antwort gegeben: die vorhandenen Bloecke
   fallen genau auf die drei Stufen, und damit entspricht jeder Reiter einem
   Meilenstein aus v1126. Eine Gliederung, zwei Darstellungen — statt zweier
   Gliederungen, die auseinanderlaufen.

     1 Objekt            -> Einschaetzung          (Adresse, Eckdaten, Einlesen)
     2 Zustand & Markt   -> Marktpreisindikation   (Baustatus, Genauigkeit)
     3 Wertermittlung    -> Wertermittlung         (Grundstueck, NHK, Feinjust.)

   ── ES WIRD UMGEHAENGT, NICHT NEU GEBAUT ──────────────────────────────────
   Die Felder bleiben DIESELBEN DOM-Knoten. Sie werden nur in andere
   Behaelter verschoben. Damit gilt weiter:
     - payload() liest dieselben Elemente ueber dieselben Ids
     - jeder vorhandene Listener bleibt haengen
     - kein zweiter Feldkatalog, keine zweite Wahrheit
   Ein Neubau der Felder haette genau das zerstoert.

   ── WARUM EIN BEOBACHTER NOETIG IST ───────────────────────────────────────
   wertermittlung.js `zeichnen()` entfernt wm-b1/b2/b3 und setzt sie neu in
   die Panel-Spalte — bei jedem Stufenwechsel. Ohne Nachfuehrung lagen die
   Bloecke danach wieder ausserhalb der Reiter. Deshalb ein
   MutationObserver, der die bekannten Bloecke zurueckholt. Dasselbe Muster
   wie karten-kompakt.js und modal-boarding-skin.js.

   KEIN requestAnimationFrame: feuert im verborgenen Tab nicht (gemessen,
   dp-band-fix.js v1092b).
   ============================================================================ */
(function () {
  'use strict';
  if (window.DealPilotMbWizard) return;

  var SCHRITTE = [
    { id: 1, t: 'Objekt',          kurz: 'Adresse, Eckdaten, Einlesen' },
    { id: 2, t: 'Zustand & Markt', kurz: 'Baustatus, Zustand, Genauigkeit' },
    { id: 3, t: 'Wertermittlung',  kurz: 'Grundstück, Gebäude, Feinjustierung' }
  ];

  /* Was in welchen Reiter gehoert. Reihenfolge = Reihenfolge im Reiter.
     Ids und Klassen sind die vorhandenen — nichts davon ist neu erfunden. */
  var ZUORDNUNG = {
    1: ['.mbw-h1', '#mbow-host', '#dpktDrop', '.mbw-sichern', '.sep', '.mbw-adresse', '#address', '.row'],
    2: ['#wm-b1', '#precHead', '#precBox', '#precMeter'],
    3: ['#wm-b3']
  };
  /* Diese bleiben UNTEN und gehoeren keinem Reiter — sie gelten immer.
     .mbw-aktionen ist die Zeile "Letzte Ausgabe / Teilbares Angebot";
     sie hat weder Id noch Klasse und wird in markieren() ausgezeichnet. */
  var FUSS = ['#wm-fehlt', '#goBtn', '#replayBtn', '#errBox', '#genProgress',
              '#srcChips', '#costNote', '#loadSignal', '.mbw-aktionen'];

  var _aktiv = 1;
  var _panel = null;
  var _plan = null;

  function $(s) { return document.querySelector(s); }
  function id(s) { return document.getElementById(s); }

  /* ── Aufbau ─────────────────────────────────────────────────────────── */
  function stil() {
    if (id('mbw-css')) return;
    var s = document.createElement('style');
    s.id = 'mbw-css';
    s.textContent = [
      '.mbw-reiter{display:flex;gap:0;border-bottom:2px solid rgba(128,128,128,.22);',
        'margin:0 0 14px;overflow-x:auto;scrollbar-width:none}',
      '.mbw-reiter::-webkit-scrollbar{display:none}',
      '.mbw-r{flex:0 0 auto;padding:9px 13px;font:inherit;font-size:12.5px;cursor:pointer;',
        'background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-2px;',
        'color:inherit;opacity:.55;white-space:nowrap;transition:.15s}',
      '.mbw-r:hover{opacity:.85}',
      '.mbw-r.an{opacity:1;font-weight:600;border-bottom-color:var(--wl-c9a84c,#C9A84C)}',
      '.mbw-r .n{font-family:"JetBrains Mono",monospace;font-size:10.5px;opacity:.6;margin-right:5px}',
      '.mbw-r.fertig .n::after{content:" ✓";color:#4caf7d;opacity:1}',
      '.mbw-blatt{display:none}',
      '.mbw-blatt.an{display:block;animation:mbwRein .22s ease}',
      '@keyframes mbwRein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
      '.mbw-kurz{font-size:11px;opacity:.6;margin:-6px 0 12px}',
      '.mbw-nav{display:flex;gap:8px;align-items:center;margin:14px 0 10px;flex-wrap:wrap}',
      '.mbw-nav button{appearance:none;border:1px solid rgba(128,128,128,.35);background:transparent;',
        'color:inherit;border-radius:999px;padding:8px 15px;font:inherit;font-size:12.5px;cursor:pointer}',
      '.mbw-nav button:disabled{opacity:.35;cursor:not-allowed}',
      '.mbw-nav button.weiter{border-color:var(--wl-c9a84c,#C9A84C);color:var(--wl-c9a84c,#C9A84C);font-weight:600}',
      '.mbw-fuss{border-top:1px solid rgba(128,128,128,.18);padding-top:12px;margin-top:6px}'
    ].join('');
    document.head.appendChild(s);
  }

  /* Adresse und die Sichern-Knoepfe tragen keine Id — sie bekommen eine
     Klasse, damit die Zuordnung sie greifen kann. Einmalig, additiv. */
  function markieren() {
    var a = id('address');
    if (a) {
      var lab = a.previousElementSibling;
      if (lab && lab.tagName === 'LABEL' && !lab.classList.contains('mbw-adresse')) lab.classList.add('mbw-adresse');
    }
    var sv = id('saveFileBtn');
    if (sv && sv.parentElement && !sv.parentElement.classList.contains('mbw-sichern')) {
      sv.parentElement.classList.add('mbw-sichern');
    }
    /* Die Aktionszeile "Letzte Ausgabe / Teilbares Angebot" hat weder Id
       noch Klasse — erkennbar nur am versteckten Datei-Eingabefeld darin. */
    var lf = id('loadFileInput');
    if (lf && lf.parentElement && !lf.parentElement.classList.contains('mbw-aktionen')) {
      lf.parentElement.classList.add('mbw-aktionen');
    }
    /* Die Ueberschrift "Objekt eingeben" doppelt jetzt den Reiternamen —
       sie wandert mit hinein, statt darueber stehenzubleiben. */
    if (_panel) {
      var h = _panel.querySelector(':scope > h1');
      if (h && !h.classList.contains('mbw-h1')) h.classList.add('mbw-h1');
    }
  }

  function bauen() {
    _panel = id('wm-ziel') ? id('wm-ziel').parentNode : null;
    if (!_panel || id('mbw-reiter')) return !!_panel;
    stil();
    markieren();

    var reiter = document.createElement('div');
    reiter.className = 'mbw-reiter';
    reiter.id = 'mbw-reiter';
    reiter.innerHTML = SCHRITTE.map(function (s) {
      return '<button type="button" class="mbw-r" data-mbw="' + s.id + '">' +
        '<span class="n">' + s.id + '</span>' + s.t + '</button>';
    }).join('');

    var blaetter = document.createElement('div');
    blaetter.id = 'mbw-blaetter';
    blaetter.innerHTML = SCHRITTE.map(function (s) {
      return '<div class="mbw-blatt" id="mbw-b' + s.id + '">' +
        '<div class="mbw-kurz">' + s.kurz + '</div></div>';
    }).join('') +
      '<div class="mbw-nav" id="mbw-nav">' +
        '<button type="button" id="mbw-zur">← Zurück</button>' +
        '<button type="button" class="weiter" id="mbw-vor">Weiter →</button>' +
      '</div>' +
      '<div class="mbw-fuss" id="mbw-fuss"></div>';

    /* Direkt hinter die Meilensteinleiste — sie bleibt oben stehen und
       gilt fuer alle Reiter. */
    var nachher = id('wm-ziel');
    nachher.parentNode.insertBefore(reiter, nachher.nextSibling);
    reiter.parentNode.insertBefore(blaetter, reiter.nextSibling);

    reiter.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mbw]');
      if (b) zeige(parseInt(b.getAttribute('data-mbw'), 10));
    });
    id('mbw-vor').addEventListener('click', function () { zeige(Math.min(3, _aktiv + 1)); });
    id('mbw-zur').addEventListener('click', function () { zeige(Math.max(1, _aktiv - 1)); });
    return true;
  }

  /* ── Umhaengen ──────────────────────────────────────────────────────── */
  function einraeumen() {
    if (!_panel || !id('mbw-blaetter')) return;
    markieren();
    Object.keys(ZUORDNUNG).forEach(function (n) {
      var ziel = id('mbw-b' + n);
      if (!ziel) return;
      ZUORDNUNG[n].forEach(function (sel) {
        _panel.querySelectorAll(':scope > ' + sel).forEach(function (el) { ziel.appendChild(el); });
      });
    });
    var fuss = id('mbw-fuss');
    if (fuss) {
      FUSS.forEach(function (sel) {
        _panel.querySelectorAll(':scope > ' + sel).forEach(function (el) { fuss.appendChild(el); });
      });
    }
  }

  function zeige(n) {
    _aktiv = n;
    SCHRITTE.forEach(function (s) {
      var b = id('mbw-b' + s.id);
      if (b) b.classList.toggle('an', s.id === n);
      var r = document.querySelector('.mbw-r[data-mbw="' + s.id + '"]');
      if (r) {
        r.classList.toggle('an', s.id === n);
        var erreicht = 0;
        try { erreicht = window.DealPilotMbStufen ? window.DealPilotMbStufen.erreicht() : 0; } catch (e) {}
        r.classList.toggle('fertig', s.id <= erreicht);
      }
    });
    var z = id('mbw-zur'), v = id('mbw-vor');
    if (z) z.disabled = (n === 1);
    if (v) v.disabled = (n === 3);
    try { var w = id('mbw-reiter'); if (w) w.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }

  function angestossen() {
    if (_plan) clearTimeout(_plan);
    _plan = setTimeout(function () { einraeumen(); zeige(_aktiv); }, 120);
  }

  function start() {
    if (!id('wm-ziel')) { setTimeout(start, 400); return; }
    if (!bauen()) { setTimeout(start, 400); return; }
    einraeumen();
    zeige(1);
    /* zeichnen() setzt wm-b1/b3 neu in die Panel-Spalte — zurueckholen. */
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].target === _panel && muts[i].addedNodes.length) { angestossen(); return; }
        }
      }).observe(_panel, { childList: true });
    } catch (e) {}
    /* Die Reiter-Haken folgen der erreichten Stufe. */
    document.addEventListener('change', function () { setTimeout(function () { zeige(_aktiv); }, 250); }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotMbWizard = {
    zeige: zeige, einraeumen: einraeumen,
    _stand: function () {
      return { aktiv: _aktiv, blaetter: SCHRITTE.map(function (s) {
        var b = id('mbw-b' + s.id);
        return s.t + ': ' + (b ? b.querySelectorAll('input,select,textarea').length : '?') + ' Felder';
      }) };
    }
  };
})();
