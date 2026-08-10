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
      /* v1127c · UMBRECHEN, NICHT ABSCHNEIDEN. Gemessen: die Spalte ist
         338 px breit, die drei Reiter brauchen zusammen rund 372 px — mit
         `overflow-x:auto` war der dritte angeschnitten und nur durch
         seitliches Scrollen erreichbar. Ein Reiter, den man nicht sieht,
         ist kein Reiter. Mit flex-wrap rutscht er in die zweite Zeile. */
      '.mbw-reiter{display:flex;flex-wrap:wrap;gap:0 2px;',
        'border-bottom:2px solid rgba(128,128,128,.22);margin:0 0 14px}',
      '.mbw-r{flex:0 0 auto;padding:9px 11px;font:inherit;font-size:12.5px;cursor:pointer;',
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
      '.mbw-fuss{border-top:1px solid rgba(128,128,128,.18);padding-top:12px;margin-top:6px}',

      /* ── v1128 · BREIT-MODUS ────────────────────────────────────────────
         Marcels Befund: „das ist voll klein und gedrueckt — ich dachte, wir
         bauen einen grossen Wizard." Er hat recht, und es war mein Fehler:
         ich habe die Reiter in die LINKE SPALTE gequetscht.

         Gemessen: `.grid` steht auf `380px 898px`. Die Formularspalte ist
         fest 380 px breit, waehrend daneben 898 px leer stehen, solange
         kein Bericht da ist. Mein eigener Entwurf zeigte den Wizard ueber
         die volle Breite — umgesetzt hatte ich ihn im alten Korsett.

         Solange kein Ergebnis vorliegt, bekommt der Wizard die ganze
         Flaeche. Der Inhalt bleibt dabei auf 760 px zentriert: eine
         Formularzeile ueber 1.278 px waere unlesbar. Sobald das Ergebnis
         da ist, kommt die zweispaltige Ansicht zurueck — „am Schluss das
         Ergebnis wie jetzt". */
      'html.mb-breit .grid{grid-template-columns:1fr !important}',
      'html.mb-breit #resultPanel{display:none !important}',
      'html.mb-breit .panel{max-width:none}',
      'html.mb-breit #wm-ziel,html.mb-breit .mbw-reiter,html.mb-breit .mbw-blatt,',
        'html.mb-breit .mbw-nav,html.mb-breit .mbw-fuss{max-width:760px;margin-left:auto;margin-right:auto}',
      'html.mb-breit .mbw-r{font-size:14px;padding:13px 20px}',
      'html.mb-breit .mbw-kurz{max-width:760px;margin-left:auto;margin-right:auto;font-size:12px}',
      'html.mb-breit input:not([type=checkbox]):not([type=radio]),html.mb-breit select{',
        'font-size:15px;padding:11px 12px}',
      'html.mb-breit label{font-size:13px}',
      /* Der Weiter-Knopf traegt den Weg — er darf gross sein. */
      'html.mb-breit .mbw-nav{display:flex;gap:10px;padding-top:6px}',
      'html.mb-breit .mbw-nav button{padding:12px 26px;font-size:14px}',
      'html.mb-breit .mbw-nav button.weiter{background:linear-gradient(110deg,',
        'var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));',
        'color:#2c2410;border-color:transparent}',
      'html.mb-breit #goBtn{width:100%;padding:15px 20px;font-size:15px}',
      /* Der Ladebalken bekommt die Buehne, statt unten zu kleben. */
      'html.mb-breit #genProgress{max-width:760px;margin:18px auto 0;padding:18px 20px}',
      'html.mb-erzeugt .mbw-reiter,html.mb-erzeugt .mbw-blatt,html.mb-erzeugt .mbw-nav{',
        'opacity:.35;pointer-events:none;transition:opacity .3s}'
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

  /* ── v1128 · Breit, solange kein Ergebnis da ist ──────────────────────
     Erkennung am vorhandenen Zustand, nicht an einem eigenen Merker:
     `#resultBody` traegt die Klasse `hide`, solange kein Bericht vorliegt
     (app.js). Das ist die Wahrheit der App — ein zweiter Merker waere eine
     zweite Wahrheit. */
  function ergebnisDa() {
    var rb = id('resultBody');
    return !!(rb && !rb.classList.contains('hide'));
  }
  function erzeugtGerade() {
    var p = id('genProgress');
    return !!(p && !p.classList.contains('hide'));
  }
  function breiteSetzen() {
    var w = document.documentElement;
    w.classList.toggle('mb-breit', !ergebnisDa());
    w.classList.toggle('mb-erzeugt', erzeugtGerade() && !ergebnisDa());
  }

  function start() {
    if (!id('wm-ziel')) { setTimeout(start, 400); return; }
    if (!bauen()) { setTimeout(start, 400); return; }
    einraeumen();
    zeige(1);
    breiteSetzen();
    /* zeichnen() setzt wm-b1/b3 neu in die Panel-Spalte — zurueckholen. */
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].target === _panel && muts[i].addedNodes.length) { angestossen(); return; }
        }
      }).observe(_panel, { childList: true });
    } catch (e) {}
    /* Ergebnis und Ladebalken beobachten — beide schalten die Breite. */
    try {
      var beob = new MutationObserver(function () { breiteSetzen(); });
      var rb = id('resultBody'), gp = id('genProgress');
      if (rb) beob.observe(rb, { attributes: true, attributeFilter: ['class'] });
      if (gp) beob.observe(gp, { attributes: true, attributeFilter: ['class'] });
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
