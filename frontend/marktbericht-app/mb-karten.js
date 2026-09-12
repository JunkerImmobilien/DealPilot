'use strict';
/* ============================================================================
   DealPilot v1340 — mb-karten.js
   „Variante B" aus design/Vorschläge/marktbericht-eingabe-varianten.html.
   Marcels Entscheidung 12.09.2026: „mach b das ist cool".

   ── WAS SIE TUT ───────────────────────────────────────────────────────────
   Die vorhandenen `.row`-Zeilen werden in benannte Blöcke gefasst. Jeder
   Block trägt links eine Goldkante, oben einen Titel und rechts einen
   Zähler: „2 / 4".

   Der Zähler ist der eigentliche Grund für diese Variante. Er beantwortet
   die Frage, die beim Ausfüllen wirklich aufkommt — „wie weit bin ich?" —
   und zwar INNERHALB eines Reiters. Die Stufenleiste beantwortet sie nur
   für den ganzen Bericht.

   ── ES WIRD VERSCHOBEN, NICHT NEU GEBAUT ──────────────────────────────────
   Dieselbe Regel wie in mb-wizard.js: die Felder bleiben DIESELBEN
   DOM-Knoten. Damit gilt weiter:
     - payload() liest dieselben Elemente über dieselben Ids
     - jeder vorhandene Listener bleibt hängen
     - die Feldhilfe-Zeichen (v1334) wandern mit
     - die Flucht aus v1336c bleibt, weil `.row` unangetastet bleibt

   Ein Neubau der Felder hätte genau das zerstört — v1129b hat das im
   Wizard teuer gelernt: doppelte Ids, `getElementById` nimmt die erste,
   und der Nutzerwert stand in der anderen.

   ── WARUM EIN BEOBACHTER NÖTIG IST ────────────────────────────────────────
   mb-wizard.js räumt die Zeilen bei jedem Stufenwechsel in die Reiter um,
   wertermittlung.js baut wm-b1/b2/b3 neu. Ohne Nachführung lägen die Blöcke
   danach leer da. Der Beobachter ist GEDROSSELT und setzt während des
   eigenen Umbaus eine Sperre — sonst beobachtet er sich selbst.

   Läuft NACH mb-wizard.js. Vorher wären die Zeilen noch nicht in ihren
   Reitern, und die Blöcke stünden im falschen Blatt.
   ============================================================================ */
(function () {
  if (window.DealPilotMbKarten) return;

  function $(id) { return document.getElementById(id); }

  /* ── Die Gruppen ────────────────────────────────────────────────────────
     Titel und Feld-Ids. Die Ids sind die vorhandenen aus index.html —
     nichts ist neu erfunden. Eine `.row` kommt in den Block, sobald sie
     EIN Feld der Gruppe enthält; die Reihenfolge der Blöcke folgt der
     Reihenfolge hier.

     `optional` steuert nur die Beschriftung des Zählers. Was wirklich
     Pflicht ist, weiß mb-stufen.js und niemand sonst — hier steht bewusst
     KEINE zweite Pflichtliste. Das wäre die Doppelliste, an der der
     Marktbericht schon sechsmal gescheitert ist. */
  /* v1345b - DIE GRUPPEN FOLGEN DEN ZEILEN, NICHT MEINEM WUNSCHBILD.
     Gemessen: cond, energy und baths landeten in KEINEM Block. Die
     Sicherung aus v1340d hatte recht - `cond` und `energy` stehen in
     DERSELBEN `.row` (index.html), ich hatte sie auf zwei Gruppen
     verteilt. Eine Zeile, die Felder zweier Gruppen traegt, wird von
     beiden verworfen; die Felder blieben heimatlos.

     Dieselbe Ursache bei baths (steht mit modyear in einer Zeile) und
     bei elevator (liegt in Reiter 4, garages/outdoor in Reiter 5).

     Die Einteilung folgt jetzt den tatsaechlichen Zeilen UND der
     Reiter-Zuordnung aus mb-wizard.js. Wer sie aendert, prueft beides. */
  var GRUPPEN = [
    { id: 'ort',    titel: 'Wo steht das Objekt', felder: ['address', 'ptype', 'usage'] },
    { id: 'eck',    titel: 'Eckdaten',            felder: ['area', 'rooms', 'year', 'floor'] },
    { id: 'geld',   titel: 'Geld',                felder: ['rent', 'price'], optional: true,
      hinweis: 'Beide Angaben sind freiwillig. Ohne Kaltmiete rechnet der Bericht mit der Marktmiete.' },
    /* Reiter 3: cond+energy, quality+modern, modyear+baths */
    { id: 'zust',   titel: 'Zustand und Qualität',
      felder: ['cond', 'energy', 'quality', 'modern', 'modyear', 'baths'] },
    /* Reiter 4 */
    { id: 'energ',  titel: 'Energie und Heizung',  felder: ['eq_energie', 'eq_heating', 'eq_windows'] },
    { id: 'innen',  titel: 'Innen',                felder: ['eq_floor', 'eq_bath', 'eq_guest_wc', 'eq_store_room'] },
    { id: 'aufzug', titel: 'Aufzug',               felder: ['elevator'] },
    /* Reiter 5 */
    { id: 'huelle', titel: 'Dach und Wände',       felder: ['eq_walls', 'eq_dachform', 'eq_roof'] },
    { id: 'flaech', titel: 'Flächen',              felder: ['balcony', 'garden', 'plot', 'units'],
      hinweis: 'Grundstück bei einer Eigentumswohnung: das Gesamtgrundstück — der Anteil ergibt sich über den Miteigentumsanteil.' },
    { id: 'stell',  titel: 'Stellplätze',          felder: ['garages', 'outdoor'] }
  ];

  /* ── Stil ───────────────────────────────────────────────────────────────
     Gold ausschliesslich über die --wl-Ebene (Whitelabel-Pflicht). Grün und
     Rot bleiben hart: Statusfarben werden nie tokenisiert. */
  function stil() {
    if ($('mbk-css')) return;
    var s = document.createElement('style');
    s.id = 'mbk-css';
    s.textContent = [
      '.mbk-block{background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.008));',
        'border:1px solid var(--line,#26262c);border-radius:13px;padding:15px 17px 17px;',
        'margin:0 0 14px;position:relative;overflow:hidden}',
      /* Die Goldkante. align-self:stretch waere hier wirkungslos, weil der
         Block kein Flex-Kind ist — top/bottom halten sie auf voller Hoehe. */
      '.mbk-block::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;',
        'background:linear-gradient(180deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,',
        'var(--wl-b8932f,#b8932f));opacity:.85}',
      '.mbk-kopf{display:flex;align-items:center;justify-content:space-between;gap:12px;',
        'margin:0 0 13px}',
      '.mbk-titel{font-family:"Space Grotesk",system-ui,sans-serif;font-size:14.5px;',
        'font-weight:600;line-height:1.3}',
      '.mbk-zahl{font-family:"JetBrains Mono",monospace;font-size:10.5px;',
        'color:var(--muted,#8a8a93);border:1px solid var(--line,#2a2a32);border-radius:999px;',
        'padding:3px 9px;white-space:nowrap;flex:0 0 auto;transition:.18s}',
      '.mbk-zahl.voll{color:#3FA56C;border-color:rgba(63,165,108,.42)}',
      '.mbk-hinweis{font-size:11px;color:var(--muted,#6d6d76);margin:10px 0 0;line-height:1.45}',
      /* v1345: was das Feld bewirkt, direkt darunter */
      '.mbk-wirkt{font-size:10.5px;color:var(--muted,#7a7a84);margin:5px 0 0;line-height:1.4}',
      /* Labels klein und in Mono-Versalien — dieselbe Schriftlogik wie die
         Kennzahlen-Labels der Haupt-App. Nur INNERHALB der Bloecke, damit
         die Wertermittlung unberuehrt bleibt. */
      /* v1340c - MIT !important, UND ZWAR MESSBAR BEGRUENDET.
         Gemessen im Hell-Modus: das Label kam als Inter 13px an, nicht als
         JetBrains Mono 10px. Der Taeter steht in index.html und traegt
         selbst !important:

           html[data-mb-theme="light"] label,... {font-family:'Inter',...!important}

         Gegen !important hilft keine Spezifitaet, nur !important. Die
         Regel bleibt trotzdem eng auf .mbk-block begrenzt - die Labels der
         Wertermittlung sollen unberuehrt bleiben. */
      '.mbk-block>.row>div>label,.mbk-block>label{font-family:"JetBrains Mono",monospace!important;',
        'font-size:10px!important;letter-spacing:.11em!important;text-transform:uppercase!important;',
        'color:var(--muted,#7e7e88);margin:0 0 6px;line-height:1.5}',
      '.mbk-block label span{text-transform:none!important;letter-spacing:0!important;',
        'font-family:"Inter",sans-serif!important;font-size:11px!important}',
      '.mbk-block input:focus,.mbk-block select:focus{border-color:var(--wl-c9a84c,#C9A84C);',
        'box-shadow:0 0 0 3px color-mix(in srgb, var(--wl-c9a84c,#C9A84C) 13%, transparent)}',
      '.mbk-block .row{margin:0}',
      '.mbk-solo>div{display:flex;flex-direction:column;min-width:0}',
      '.mbk-solo{grid-template-columns:1fr}',
      '.mbk-block .row + .row{margin-top:13px}',
      '@media (max-width:560px){.mbk-block{padding:13px 14px 15px}}',
      /* Heller Skin: der Verlauf darf dort nicht aufhellen. */
      'html[data-mb-theme="light"] .mbk-block{background:#ffffff}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Aufbau ─────────────────────────────────────────────────────────────
     Ein Block entsteht an der Stelle der ERSTEN Zeile seiner Gruppe und
     nimmt die uebrigen auf. Steht keine Zeile der Gruppe im DOM, entsteht
     auch kein Block — ein leerer Kasten mit Titel waere eine Behauptung. */
  var _sperre = false;

  /* === v1340d - EIGENER FEHLER, IM SCREENSHOT GESEHEN ================
     Die erste Fassung fiel fuer Felder ohne `.row` auf `parentElement`
     zurueck. Beim Adressfeld ist das der ganze Reiter-Container - und
     der wurde samt allem, was darin steht, in den Block "Wo steht das
     Objekt" geschoben. Im Bild sass "Eckdaten" INNERHALB von "Wo steht
     das Objekt".

     Dieselbe Sorte Fehler wie v1334b: ein zu weit gefasster Vorfahre.
     Dort war es das erste <label> im Panel, hier das erste Elternteil.

     Zwei Sicherungen jetzt:

     1. Ein Feld ohne `.row` bekommt eine EIGENE Huelle, die nur sein
        Label und das Feld traegt. Damit gibt es immer etwas Passendes zu
        verschieben, und nie zu viel.
     2. Eine Zeile wird NIE uebernommen, wenn sie ein Feld einer anderen
        Gruppe enthaelt. Das faengt jeden weiteren Fall dieser Art ab,
        auch einen, den ich noch nicht gesehen habe. */
  var ALLE_FELDER = (function () {
    var m = {};
    for (var i = 0; i < GRUPPEN.length; i++) {
      for (var j = 0; j < GRUPPEN[i].felder.length; j++) m[GRUPPEN[i].felder[j]] = GRUPPEN[i].id;
    }
    return m;
  })();

  /* Traegt der Behaelter ein Feld, das zu einer ANDEREN Gruppe gehoert? */

  function fremdbelegt(el, gruppeId) {
    var f = el.querySelectorAll ? el.querySelectorAll('input[id], select[id], textarea[id]') : [];
    for (var i = 0; i < f.length; i++) {
      var g = ALLE_FELDER[f[i].id];
      if (g && g !== gruppeId) return true;
    }
    return false;
  }

  function huelleBauen(el) {
    var vorhanden = el.previousElementSibling;
    if (el.parentElement && el.parentElement.classList
        && el.parentElement.classList.contains('mbk-solo')) return el.parentElement;
    var h = document.createElement('div');
    h.className = 'row mbk-solo';
    var d = document.createElement('div');
    h.appendChild(d);
    if (el.parentElement) el.parentElement.insertBefore(h, el);
    /* Das Label steht unmittelbar VOR dem Feld - es wandert mit. */
    if (vorhanden && vorhanden.tagName === 'LABEL') d.appendChild(vorhanden);
    d.appendChild(el);
    return h;
  }

  function zeileVon(id, gruppeId) {
    var el = $(id);
    if (!el) return null;
    var r = el.closest ? el.closest('.row') : null;
    if (r) return fremdbelegt(r, gruppeId) ? null : r;
    /* Kein `.row` - eine eigene Huelle, statt den Vorfahren zu nehmen. */
    var ck = el.closest ? el.closest('label') : null;
    if (ck && ck.contains(el)) {
      /* Kontrollkaestchen im Label (Aufzug): das Label ist die Zelle. */
      var p = ck.parentElement;
      if (p && !fremdbelegt(p, gruppeId) && p.children.length === 1) return p;
      return ck;
    }
    return huelleBauen(el);
  }

  function bauen() {
    var neu = 0;
    for (var i = 0; i < GRUPPEN.length; i++) {
      var g = GRUPPEN[i];
      var zeilen = [];
      for (var j = 0; j < g.felder.length; j++) {
        var z = zeileVon(g.felder[j], g.id);
        if (z && zeilen.indexOf(z) < 0) zeilen.push(z);
      }
      if (!zeilen.length) continue;

      var block = $('mbk-' + g.id);
      var kopf = null;
      if (!block) {
        block = document.createElement('div');
        block.className = 'mbk-block';
        block.id = 'mbk-' + g.id;
        kopf = document.createElement('div');
        kopf.className = 'mbk-kopf';
        kopf.innerHTML = '<div class="mbk-titel"></div><div class="mbk-zahl" id="mbk-z-' + g.id + '"></div>';
        kopf.querySelector('.mbk-titel').textContent = g.titel;
        block.appendChild(kopf);
        /* An die Stelle der ersten Zeile, nicht ans Ende des Blattes —
           sonst wandert der Block bei jedem Umbau nach unten. */
        var erste = zeilen[0];
        if (erste.parentElement) erste.parentElement.insertBefore(block, erste);
        neu++;
      }
      /* Die Zeilen hinein. `appendChild` verschiebt, es kopiert nicht. */
      for (var k = 0; k < zeilen.length; k++) {
        if (zeilen[k].parentElement !== block) block.appendChild(zeilen[k]);
      }
      if (g.hinweis && !block.querySelector('.mbk-hinweis')) {
        var h = document.createElement('div');
        h.className = 'mbk-hinweis';
        h.textContent = g.hinweis;
        block.appendChild(h);
      }
    }
    return neu;
  }

  /* ── Der Zähler ─────────────────────────────────────────────────────────
     Gezählt wird, was TATSÄCHLICH im Feld steht — nicht, was irgendwo
     vorliegt. Ein Feld, das die Objektart ausblendet (`display:none`),
     zählt nicht mit: es kann gar nicht gefüllt werden, und ein Zähler, der
     Unerreichbares fordert, ist schlimmer als keiner. */
  /* v1340b - EIGENER FEHLER, IM ERSTEN LAUF GEMESSEN.
     Die erste Fassung pruefte `offsetParent` und `getClientRects()`. Das
     ist die Frage "ist das Feld GERADE auf dem Schirm" - und die ist hier
     falsch: acht von neun Bloecken liegen in einem GESCHLOSSENEN
     Wizard-Reiter, ihre Felder haben deshalb keinen offsetParent. Gemessen:

       ort    -> "2 / 2"
       eck    -> ""     (leer)
       geld   -> ""     ... und so weiter fuer alle uebrigen

     Ein Zaehler, der nur im offenen Reiter eine Zahl zeigt, ist genau dort
     nutzlos, wo er helfen soll: beim Blick auf die Reiterleiste.

     Die richtige Frage ist: GIBT es das Feld. Die Wertermittlung baut
     Felder je Stufe und Objektart ueberhaupt erst - was nicht gebraucht
     wird, existiert nicht, und `$(id)` gibt dann null. Damit ist die
     Unterscheidung schon getroffen, bevor sie hier noetig waere.

     Geprueft wird nur noch ein per Stil ausgeblendetes Feld in seiner
     eigenen Zelle - der zugeklappte Block "Erweiterte Angaben" faellt
     NICHT darunter, denn der Wizard loest ihn beim Einraeumen auf. */
  function ausgeblendet(el) {
    var n = el, tiefe = 0;
    while (n && tiefe++ < 3) {
      if (n.style && n.style.display === 'none') return true;
      if (n.classList && n.classList.contains('row')) break;
      n = n.parentElement;
    }
    return false;
  }

  function sichtbar(el) {
    if (!el) return false;
    if (el.type === 'hidden') return false;
    return !ausgeblendet(el);
  }

  function gefuellt(el) {
    if (!el) return false;
    if (el.type === 'checkbox') return !!el.checked;
    return String(el.value == null ? '' : el.value).trim() !== '';
  }

  function zaehlen() {
    for (var i = 0; i < GRUPPEN.length; i++) {
      var g = GRUPPEN[i];
      var ziel = $('mbk-z-' + g.id);
      if (!ziel) continue;
      var da = 0, gesamt = 0;
      for (var j = 0; j < g.felder.length; j++) {
        var el = $(g.felder[j]);
        if (!el || !sichtbar(el)) continue;
        gesamt++;
        if (gefuellt(el)) da++;
      }
      if (!gesamt) { ziel.textContent = ''; continue; }
      var t = da + ' / ' + gesamt;
      if (g.optional) t += ' · optional';
      ziel.textContent = t;
      if (da >= gesamt) ziel.classList.add('voll'); else ziel.classList.remove('voll');
    }
  }

  /* ── Nachführung ────────────────────────────────────────────────────────
     Gedrosselt, und während des eigenen Umbaus gesperrt — ein Beobachter,
     der seine eigene Änderung sieht, läuft sonst endlos. Kein
     requestAnimationFrame: feuert im verborgenen Tab nie (v1092b). */
  var _zeit = null;
  function bald() {
    if (_sperre) return;
    if (_zeit) clearTimeout(_zeit);
    _zeit = setTimeout(function () {
      _zeit = null;
      _sperre = true;
      try { stil(); bauen(); wirkungZeigen(); zaehlen(); } catch (e) {
        try { console.warn('[v1340] Karten:', e.message); } catch (x) {}
      }
      _sperre = false;
    }, 140);
  }

  function start() {
    /* Erst wenn der Wizard seine Blätter gebaut hat — sonst entstehen die
       Blöcke im alten Fluss und werden gleich wieder auseinandergerissen. */
    if (!document.querySelector('.mbw-blatt') && !$('address')) {
      setTimeout(start, 300);
      return;
    }
    stil();
    bauen();
    wirkungZeigen();
    zaehlen();
    document.addEventListener('input', zaehlen, true);
    document.addEventListener('change', zaehlen, true);
    try {
      new MutationObserver(bald).observe(document.documentElement,
        { childList: true, subtree: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 400); });
  } else {
    setTimeout(start, 400);
  }

  /* === v1345 - WAS EIN FELD BEWIRKT, STEHT AM FELD ====================
     Marcels Frage: "da gebe ich vlt werte an die ich nicht braeuchte und
     garnicht mit einfliessen". Die Antwort steht jetzt dort, wo sie
     gebraucht wird - beim Ausfuellen, nicht erst im Bericht.

     Die Zahlen sind GEMESSEN, nicht geschaetzt: sie stehen so in
     ValuationService.js. Zustand, Qualitaet und Modernisierung bilden dort
     ein Teilprodukt, das auf 0,82 bis 1,22 gedeckelt wird - deshalb steht
     der Deckel dran und nicht die Einzelfaktoren, die ihn ueberschreiten
     koennten. */
  var WIRKUNG = {
    cond:    'Zustand, Qualität und Modernisierung wirken zusammen bis ±22 % auf den Marktwert.',
    quality: 'Zusammen mit Zustand und Modernisierung bis ±22 %.',
    modern:  'Zusammen mit Zustand und Qualität bis ±22 %. Ein Modernisierungsjahr verfeinert es.',
    energy:  'Eigener Faktor auf den Marktwert.',
    floor:   'Eigener Faktor — Erdgeschoss und obere Lagen ohne Aufzug werden anders bewertet.',
    balcony: '+2 %, wenn vorhanden.',
    garden:  '+2 %, wenn vorhanden.',
    elevator:'+2 %, wenn vorhanden.',
    baths:   'Ab dem zweiten Bad ein Aufschlag.',
    eq_walls:   'Geht in die Standardstufe ein (Wägungsanteil 23 — der größte).',
    eq_roof:    'Geht in die Standardstufe ein (Wägungsanteil 15).',
    eq_windows: 'Geht in die Standardstufe ein (Wägungsanteil 11).',
    eq_bath:    'Geht in die Standardstufe ein (Wägungsanteil 9).',
    eq_heating: 'Geht in die Standardstufe ein (Wägungsanteil 9).',
    eq_floor:   'Geht in die Standardstufe ein (Wägungsanteil 5).',
    eq_energie: 'Hebt die Heizungsstufe — eine Wärmepumpe rangiert oben.',
    eq_guest_wc:'Hebt die Sanitärstufe um eins.',
  };

  function wirkungZeigen() {
    Object.keys(WIRKUNG).forEach(function (id) {
      var el = $(id); if (!el) return;
      var zelle = el.parentElement; if (!zelle) return;
      if (!zelle.closest || !zelle.closest('.mbk-block')) return;
      if (zelle.querySelector('.mbk-wirkt')) return;
      var d = document.createElement('div');
      d.className = 'mbk-wirkt';
      d.textContent = WIRKUNG[id];
      zelle.appendChild(d);
    });
  }

  window.DealPilotMbKarten = {
    bauen: bauen, zaehlen: zaehlen, GRUPPEN: GRUPPEN,
    _stand: function () {
      return GRUPPEN.map(function (g) {
        var z = $('mbk-z-' + g.id);
        return { id: g.id, block: !!$('mbk-' + g.id), zaehler: z ? z.textContent : null };
      });
    }
  };
})();
