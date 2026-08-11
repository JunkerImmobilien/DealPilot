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

  /* ── v1129 · Mehr, kleinere Reiter ───────────────────────────────────────
     Marcels Befund: „Zustand und Markt ist sehr gross mit vielen Angaben."
     Gemessen: der Reiter trug 24 Felder — mehr als die anderen beiden
     zusammen. `precBox` besteht aber aus ZEHN sauberen `.row`-Zeilen, die
     sich thematisch trennen lassen. Und der Expertenblock (Liegenschafts-
     zins, Sachwertfaktor, Bodenrichtwert) ist ein eigener Behaelter — er
     bekommt einen eigenen Reiter, wie gewuenscht.

     Aus drei Reitern werden sechs. Die Meilensteine bleiben drei: mehrere
     Reiter koennen auf dieselbe Stufe einzahlen (`stufe`). */
  var SCHRITTE = [
    { id: 1, t: 'Objekt',        stufe: 1, kurz: 'Adresse, Eckdaten, Einlesen' },
    { id: 2, t: 'Zustand',       stufe: 2, kurz: 'Baustatus, Zustand, Qualität, Modernisierung' },
    { id: 3, t: 'Ausstattung',   stufe: 2, kurz: 'Energie, Heizung, Bad, Böden, Aufzug' },
    { id: 4, t: 'Gebäude & Außen', stufe: 2, kurz: 'Dach, Wände, Balkon, Grundstück, Stellplätze' },
    { id: 5, t: 'Wertermittlung', stufe: 3, kurz: 'Bodenwert, NHK, Feinjustierung' },
    { id: 6, t: 'Zusatzwerte',   stufe: 3, kurz: 'Liegenschaftszins, Sachwertfaktor, Bodenrichtwert' }
  ];

  /* Was in welchen Reiter gehoert. Zwei Schreibweisen:
       '#id' / '.klasse'  — das Element selbst
       'zeile:feldId'     — die `.row`, die dieses Feld enthaelt
     Ids und Klassen sind die vorhandenen — nichts ist neu erfunden. */
  var ZUORDNUNG = {
    1: ['.mbw-h1', '#mbow-host', '#dpktDrop', '.mbw-sichern', '.sep', '.mbw-adresse', '#address',
        'zeile:ptype', 'zeile:area', 'zeile:year', 'zeile:rent'],
    2: ['#wm-b1', 'zeile:cond', 'zeile:quality', 'zeile:modyear'],
    3: ['zeile:eq_energie', 'zeile:eq_floor', 'zeile:eq_guest_wc', '.mbw-aufzug'],
    4: ['zeile:eq_walls', 'zeile:balcony', 'zeile:garages'],
    5: ['#wm-b3'],
    6: ['.mbw-experte']
  };
  /* Diese bleiben UNTEN und gehoeren keinem Reiter — sie gelten immer.
     .mbw-aktionen ist die Zeile "Letzte Ausgabe / Teilbares Angebot";
     sie hat weder Id noch Klasse und wird in markieren() ausgezeichnet. */
  var FUSS = ['#precMeter', '#wm-fehlt', '#goBtn', '#replayBtn', '#errBox', '#genProgress',
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
        'html.mb-breit .mbw-nav,html.mb-breit .mbw-fuss,html.mb-breit #wm-ampel{',
        'max-width:760px;margin-left:auto;margin-right:auto}',
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
        'opacity:.35;pointer-events:none;transition:opacity .3s}',
      /* v1129c · Balken, Prozent und Schritte. */
      '.mbw-pkopf{display:flex;align-items:baseline;gap:10px;font-size:12.5px;font-weight:600;margin-bottom:7px}',
      '.mbw-pct{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:13px;',
        'font-weight:700;color:var(--wl-c9a84c,#C9A84C)}',
      '.mbw-pbahn{height:7px;border-radius:4px;background:rgba(128,128,128,.25);overflow:hidden;margin-bottom:9px}',
      '.mbw-pbahn i{display:block;height:100%;border-radius:4px;transition:width .45s ease;',
        'background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f))}',
      '#genProgSteps{font-size:12px;line-height:1.7}',
      'html.mb-breit #genProgress{font-size:13px}'
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
    /* v1129 · Die Aufzug-Zeile ist als einzige keine `.row`. */
    var el = id('elevator');
    if (el) {
      var w = el.closest('div');
      if (w && !w.classList.contains('mbw-aufzug') && !w.classList.contains('row')) w.classList.add('mbw-aufzug');
    }
    /* v1129 · Der Expertenblock bekommt einen eigenen Reiter. Er wird von
       wertermittlung.js bei jedem zeichnen() NEU gebaut — deshalb wird er
       bei jedem Einraeumen frisch ausgezeichnet, nicht einmalig. */
    var eb = id('wm-exp-box');
    if (eb && eb.parentElement) eb.parentElement.classList.add('mbw-experte');
  }

  /* 'zeile:feldId' -> die `.row`, die dieses Feld enthaelt.
     Warum nicht `.row:has(#id)`: kuerzer, aber `:has()` faellt in aelteren
     Browsern still aus — und ein still ausgefallener Selektor laesst Felder
     unsichtbar im alten Behaelter zurueck. */
  function aufloesen(sel) {
    if (sel.indexOf('zeile:') !== 0) return _panel ? _panel.querySelectorAll(sel) : [];
    var f = id(sel.slice(6));
    if (!f) return [];
    var z = f.closest('.row') || f.closest('div');
    return z ? [z] : [];
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
  /* v1129: sucht im GANZEN Teilbaum, nicht nur unter den direkten Kindern.
     Die Zeilen liegen verschachtelt in `precBox`, der Expertenblock in
     `wm-b3`. Ein Element, das schon im richtigen Blatt sitzt, wird nicht
     angefasst — sonst wanderte bei jedem Lauf der Fokus. */
  function verschieben(el, ziel) {
    if (!el || !ziel || el.parentElement === ziel) return;
    if (ziel.contains(el)) return;
    ziel.appendChild(el);
  }
  /* ── v1129b · DOPPELTE IDs, im Prueflauf gefunden ──────────────────────
     Der Expertenblock steckt in `wm-b3`, und wertermittlung.js baut `wm-b3`
     bei jedem zeichnen() NEU. Hatte ich den Block vorher nach Reiter 6
     verschoben, entstand daneben eine ZWEITE, leere Fassung — mit denselben
     Ids. `getElementById` nimmt die erste; payload() las damit die leere.
     Gemessen: lzs und sachwertfaktor waren zweimal da, der Wert stand in
     der einen, gelesen wurde die andere. Ergebnis: lzs_pct = null.

     Regel: Es darf immer nur EINE geben. Behalten wird die im Reiter — dort
     stehen die Eingaben des Nutzers; die frisch gebaute ist leer. Ein
     Wertabgleich ist nicht noetig, weil die neue nie Werte trug. */
  function expertenDubletten(ziel) {
    var alle = document.querySelectorAll('[id="wm-exp-box"]');
    if (alle.length < 2 || !ziel) return;
    var behalten = null;
    Array.prototype.forEach.call(alle, function (b) { if (ziel.contains(b)) behalten = b; });
    if (!behalten) behalten = alle[0];
    Array.prototype.forEach.call(alle, function (b) {
      if (b === behalten) return;
      var huelle = b.parentElement;
      if (huelle && huelle.parentElement) huelle.parentElement.removeChild(huelle);
      else if (b.parentElement) b.parentElement.removeChild(b);
    });
  }

  function einraeumen() {
    if (!_panel || !id('mbw-blaetter')) return;
    expertenDubletten(id('mbw-b6'));
    markieren();
    Object.keys(ZUORDNUNG).forEach(function (n) {
      var ziel = id('mbw-b' + n);
      if (!ziel) return;
      ZUORDNUNG[n].forEach(function (sel) {
        Array.prototype.slice.call(aufloesen(sel)).forEach(function (el) { verschieben(el, ziel); });
      });
    });
    var fuss = id('mbw-fuss');
    if (fuss) {
      FUSS.forEach(function (sel) {
        Array.prototype.slice.call(aufloesen(sel)).forEach(function (el) { verschieben(el, fuss); });
      });
    }
    /* precHead/precBox haben ausgedient: die Reiter uebernehmen das
       Auf- und Zuklappen. Der leere Behaelter bleibt stehen (app.js fasst
       ihn an), wird aber nicht mehr gezeigt. */
    ['precHead', 'precBox'].forEach(function (x) {
      var e = id(x); if (e) { e.style.display = 'none'; verschieben(e, fuss || _panel); }
    });
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
    prozent();
  }

  /* ── v1129 · Prozentzahl am Ladebalken ────────────────────────────────
     Marcels Wunsch: „am besten mit Prozentangabe". Der Balken selbst gibt
     es schon (app.js setzt `#genProgBar.style.width` in Prozent) — die Zahl
     wird daraus GELESEN, nicht zweitgerechnet. Ein eigener Zaehler wuerde
     vom Balken abweichen, sobald app.js seine Kurve aendert. */
  /* v1129c · DER LADEBALKEN HAT NIE EXISTIERT.
     Gemessen: `#genProgress` ist im HTML ein LEERES div. app.js sucht darin
     `#genProgBar` (Z. 283) und `#genProgSteps` (Z. 289) — beide gibt es
     nicht. Folge: der Balken-Code lief ins Leere, und die Schritte wurden
     mit `prog.innerHTML = …` direkt in den Kasten geschrieben. Es gab also
     immer nur eine Schrittliste, nie einen Balken.

     Hier wird das Geruest gebaut, das der vorhandene Code erwartet — dann
     fuellt app.js beides von selbst, und nichts wird mehr ueberschrieben:
       Kopfzeile  Beschriftung + Prozent
       #genProgBar  der Balken
       #genProgSteps  die Schritte (wie bisher) */
  var _pctBeob = null;
  function geruest() {
    var kopf = id('genProgress');
    if (!kopf || id('genProgBar')) return;
    kopf.innerHTML =
      '<div class="mbw-pkopf"><span>Bericht wird erstellt</span>' +
        '<span class="mbw-pct" id="mbw-pct">0 %</span></div>' +
      '<div class="mbw-pbahn"><i id="genProgBar" style="width:0%"></i></div>' +
      '<div id="genProgSteps"></div>';
  }
  function prozent() {
    geruest();
    var bar = id('genProgBar'), lbl = id('mbw-pct');
    if (!bar || !lbl) return;
    var w = Math.round(parseFloat(bar.style.width) || 0);
    lbl.textContent = w + ' %';
    if (!_pctBeob) {
      try {
        _pctBeob = new MutationObserver(function () { prozent(); });
        _pctBeob.observe(bar, { attributes: true, attributeFilter: ['style'] });
      } catch (e) {}
    }
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
