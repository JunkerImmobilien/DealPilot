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
    { id: 'ort', stufe: 1,    titel: 'Wo steht das Objekt', felder: ['address', 'ptype', 'usage'] },
    { id: 'eck', stufe: 1,    titel: 'Eckdaten',            felder: ['area', 'rooms', 'year', 'floor'] },
    { id: 'geld', stufe: 1,   titel: 'Geld',                felder: ['rent', 'price'], optional: true,
      hinweis: 'Beide Angaben sind freiwillig. Ohne Kaltmiete rechnet der Bericht mit der Marktmiete.' },
    /* Reiter 3: cond+energy, quality+modern, modyear+baths */
    { id: 'zust', stufe: 2,   titel: 'Zustand und Qualität',
      felder: ['cond', 'energy', 'quality', 'modern', 'modyear', 'baths'] },
    /* Reiter 4 */
    { id: 'energ', stufe: 3,  titel: 'Energie und Heizung',  felder: ['eq_energie', 'eq_heating', 'eq_windows'] },
    { id: 'innen', stufe: 3,  titel: 'Innen',                felder: ['eq_floor', 'eq_bath', 'eq_guest_wc', 'eq_store_room'] },
    { id: 'aufzug', stufe: 2, titel: 'Aufzug',               felder: ['elevator'] },
    /* Reiter 5 */
    { id: 'huelle', stufe: 3, titel: 'Dach und Wände',       felder: ['eq_walls', 'eq_dachform', 'eq_roof'] },
    { id: 'flaech', stufe: 2, titel: 'Flächen',              felder: ['balcony', 'garden', 'plot', 'units'],
      hinweis: 'Grundstück bei einer Eigentumswohnung: das Gesamtgrundstück — der Anteil ergibt sich über den Miteigentumsanteil.' },
    { id: 'stell', stufe: 2,  titel: 'Stellplätze',          felder: ['garages', 'outdoor'] }
  ];

  /* ── Stil ───────────────────────────────────────────────────────────────
     v1346 · WIE DER TAB OBJEKT, NICHT WIE EINE ZWEITE ANWENDUNG.

     Marcels Wunsch: „vom Stil her wäre es cool, wenn es so ist wie im Tab
     Objekt oder im Tab Investition."

     GEMESSEN am laufenden Tab Objekt (`#s0 .card.qz-card`), nicht geraten:

       Karte      #fff · 1,11px solid rgba(201,168,76,.22) · radius 12
                  padding 22px 24px · Schatten 0 2px 12px rgba(42,39,39,.06)
                  margin-bottom 28
       Kopf .ct   DM Sans 700 · 11,5px · VERSALIEN · ls 1,4px · rgb(154,127,51)
                  margin-bottom 14
       Label      Inter 500 · 11px · KEINE Versalien · rgba(42,39,39,.85)
       Feld       #fff · 1,11px solid #e0dbd3 · radius 8 · padding 0 11px
                  13px DM Sans · Höhe 38
       Zeile .g2  grid, 2 Spalten, gap 12

     Mein Mono-Versalien-Label aus v1340c war damit genau falsch herum: die
     App setzt Versalien am KARTENKOPF, nicht am Label. Das wird hier
     zurückgenommen.

     ZWEI SKINS. Die Zahlen oben sind der helle Stand der Haupt-App; der
     Marktbericht hat zusätzlich einen dunklen. Deshalb stehen die Farben
     als Tokens mit hellem Zweig darunter — und nie als hartes Gold
     (Whitelabel-Pflicht).

     EINE ABWEICHUNG, BEWUSST: die Feldhöhe bleibt unter 768 px bei 44 px.
     38 px sind auf dem Handy zu klein zum Treffen, und v1077-mb-touch hat
     das teuer gelernt. Am Schreibtisch gilt die App-Höhe. */
  function stil() {
    if ($('mbk-css')) return;
    var s = document.createElement('style');
    s.id = 'mbk-css';
    s.textContent = [
      /* ── Die Karte ──────────────────────────────────────────────────── */
      '.mbk-block{background:var(--panel,#15151a);',
        'border:1px solid color-mix(in srgb, var(--wl-c9a84c,#C9A84C) 22%, transparent);',
        'border-radius:12px;padding:22px 24px;margin:0 0 20px;position:relative}',
      'html[data-mb-theme="light"] .mbk-block{background:#ffffff;',
        'box-shadow:0 2px 12px rgba(42,39,39,.06)}',
      /* Die Goldkante von v1340 entfaellt: der Objekt-Tab umrandet die ganze
         Karte in Gold, statt links einen Balken zu setzen. */

      /* ── Der Kopf, exakt wie `.ct.ct-pro` ───────────────────────────── */
      '.mbk-kopf{display:flex;align-items:baseline;justify-content:space-between;',
        'gap:12px;margin:0 0 14px}',
      '.mbk-titel{font-family:"DM Sans",system-ui,sans-serif;font-size:11.5px;',
        'font-weight:700;text-transform:uppercase;letter-spacing:1.4px;',
        'color:var(--wl-b8932f,#b8932f);line-height:1.3}',
      'html[data-mb-theme="light"] .mbk-titel{color:#9a7f33}',
      '.mbk-zahl{font-family:"DM Sans",system-ui,sans-serif;font-size:10.5px;',
        'font-weight:500;color:var(--muted,#8a8a93);',
        'border:1px solid color-mix(in srgb, var(--muted,#8a8a93) 35%, transparent);',
        'border-radius:999px;padding:2px 9px;white-space:nowrap;flex:0 0 auto;',
        'letter-spacing:.3px;transition:.18s}',
      '.mbk-zahl.voll{color:#3FA56C;border-color:rgba(63,165,108,.42)}',

      /* ── Felder und Labels wie im Objekt-Tab ────────────────────────── */
      '.mbk-block>.row>div>label,.mbk-block>.row>div>label span,',
        '.mbk-block>label{font-family:"Inter",system-ui,sans-serif!important;',
        'font-size:11px!important;font-weight:500!important;text-transform:none!important;',
        'letter-spacing:normal!important;color:var(--muted,#9a9aa3);',
        'margin:0 0 5px;line-height:1.45}',
      '.mbk-block input,.mbk-block select,.mbk-block textarea{',
        /* v1346b: !important, aus demselben Grund wie bei den Labels -
           der Hell-Skin in index.html setzt font-family fuer jedes input
           selbst mit !important. Gemessen: DM Sans 13px angeordnet,
           Inter 15px angekommen. */
        'font-family:"DM Sans",system-ui,sans-serif!important;font-size:13px!important;',
        'border-radius:8px;padding:0 11px;min-height:38px;',
        'border:1px solid var(--line,#26262c)}',
      'html[data-mb-theme="light"] .mbk-block input,',
        'html[data-mb-theme="light"] .mbk-block select,',
        'html[data-mb-theme="light"] .mbk-block textarea{',
        'background:#ffffff;border-color:#e0dbd3}',
      '.mbk-block input:focus,.mbk-block select:focus{',
        'border-color:var(--wl-c9a84c,#C9A84C);',
        'box-shadow:0 0 0 3px color-mix(in srgb, var(--wl-c9a84c,#C9A84C) 13%, transparent)}',

      /* ── Zusatztexte ────────────────────────────────────────────────── */
      '.mbk-hinweis{font-size:11px;color:var(--muted,#6d6d76);margin:12px 0 0;',
        'line-height:1.45;font-family:"Inter",system-ui,sans-serif}',
      '.mbk-wirkt{font-size:10.5px;color:var(--muted,#7a7a84);margin:5px 0 0;',
        'line-height:1.4;font-family:"Inter",system-ui,sans-serif}',
      '.mbk-block .row{margin:0}',
      '.mbk-block .row + .row{margin-top:14px}',
      '.mbk-solo>div{display:flex;flex-direction:column;min-width:0}',
      '.mbk-solo{grid-template-columns:1fr}',
      /* v1347: minimierte Bloecke - der Kopf bleibt, der Rest geht */
      '.mbk-zu{display:none!important}',
      '.mbk-block-zu{padding:13px 18px;opacity:.72}',
      '.mbk-block-zu .mbk-kopf{margin:0}',
      '.mbk-spaeter{appearance:none;border:0;background:transparent;cursor:pointer;',
        'font-family:"Inter",system-ui,sans-serif;font-size:10.5px;font-weight:500;',
        'color:var(--wl-c9a84c,#C9A84C);padding:2px 0;letter-spacing:.2px;',
        'text-decoration:underline;text-underline-offset:2px;white-space:nowrap}',
      '.mbk-spaeter:hover{color:var(--wl-e8cc7a,#E8CC7A)}',
      'html[data-mb-theme="light"] .mbk-spaeter{color:#9a7f33}',


      /* ── Handy: die Touch-Hoehe gilt weiter (v1077-mb-touch) ────────── */
      '@media (max-width:768px){',
        '.mbk-block input,.mbk-block select,.mbk-block textarea{min-height:44px;font-size:16px}',
        '.mbk-block{padding:16px 15px}',
      '}'
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

  /* === v1347 - DIE FELDER WACHSEN MIT DER GEWAEHLTEN TIEFE ===========
     Marcels Vorgabe woertlich: „Marktpreisindikation klicke ich an. Es
     werden unten nur die Felder angezeigt, die ich brauche. Wenn ich
     erweiterte anklicke, dann werden mehr Felder angezeigt. Und wenn ich
     Wertermittlung anklicke, dann werden die anderen auch noch mit
     angezeigt."

     DIE ZUORDNUNG IST ABGELEITET, NICHT GERATEN. Grundlage ist `BEDARF`
     in mb-stufen.js - die einzige Stelle, die weiss, was eine Stufe
     verlangt:

       Stufe 1  address, ptype, area, year, baustatus (+mea bei ETW)
       Stufe 2  cond, quality
       Stufe 3  plot, units (+standardstufe, nhkHaus bei Nicht-Wohnung)

     Daraus die Bloecke:

       1  Wo steht das Objekt · Eckdaten · Geld
       2  Zustand und Qualitaet · Flaechen · Aufzug · Stellplaetze
       3  Energie und Heizung · Innen · Dach und Waende

     Warum die drei Ausstattungsbloecke erst bei Stufe 3 kommen: seit
     v1345 speisen sie die STANDARDSTUFE nach Anlage 4 - und die braucht
     nur das Sachwertverfahren. Fuer eine Marktpreisindikation aendern sie
     nichts.

     MINIMIERT, NICHT ENTFERNT. Der Kopf bleibt stehen und sagt „ab Stufe
     N"; ein Klick klappt auf. Wer schon etwas eingetragen hat, sieht das
     am Zaehler - und ein Block mit Inhalt klappt NIE von selbst zu.
     Eingaben verschwinden nicht aus dem Blick. */
  var _offen = {};

  function gewaehlteStufe() {
    try {
      var st = window.DealPilotMbStufen;
      if (st && typeof st.gewaehlt === 'function') {
        var n = parseInt(st.gewaehlt(), 10);
        if (n >= 1 && n <= 3) return n;
      }
    } catch (e) {}
    return 3;   /* im Zweifel alles zeigen */
  }

  function hatInhalt(g) {
    for (var i = 0; i < g.felder.length; i++) {
      var el = $(g.felder[i]);
      if (el && gefuellt(el)) return true;
    }
    return false;
  }

  function stufenFilter() {
    var stufe = gewaehlteStufe();
    for (var i = 0; i < GRUPPEN.length; i++) {
      var g = GRUPPEN[i];
      var block = $('mbk-' + g.id);
      if (!block || !g.stufe) continue;
      var zu = (g.stufe > stufe) && !_offen[g.id] && !hatInhalt(g);

      /* Alles ausser dem Kopf verbergen. */
      for (var k = 0; k < block.children.length; k++) {
        var kind = block.children[k];
        if (kind.classList && kind.classList.contains('mbk-kopf')) continue;
        if (zu) kind.classList.add('mbk-zu');
        else kind.classList.remove('mbk-zu');
      }
      if (zu) block.classList.add('mbk-block-zu');
      else block.classList.remove('mbk-block-zu');

      /* Der Kopf sagt, warum. */
      var marke = block.querySelector('.mbk-spaeter');
      var kopf = block.querySelector('.mbk-kopf');
      if (zu && !marke && kopf) {
        marke = document.createElement('button');
        marke.type = 'button';
        marke.className = 'mbk-spaeter';
        marke.setAttribute('data-mbk-auf', g.id);
        marke.textContent = 'ab ' + STUFENNAME[g.stufe] + ' \u00b7 einblenden';
        kopf.appendChild(marke);
      } else if (!zu && marke && marke.parentNode) {
        marke.parentNode.removeChild(marke);
      }
      var zahl = block.querySelector('.mbk-zahl');
      if (zahl) zahl.style.display = zu ? 'none' : '';
    }
  }

  var STUFENNAME = { 1: 'Marktpreisindikation', 2: 'erweiterter Indikation',
                     3: 'Wertermittlung' };

  /* Einblenden bleibt eingeblendet, bis die Tiefe wechselt. */
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-mbk-auf]') : null;
    if (!b) return;
    ev.preventDefault();
    _offen[b.getAttribute('data-mbk-auf')] = 1;
    try { stufenFilter(); } catch (e) {}
  }, true);

  /* Ein Stufenwechsel setzt die Handaufklapper zurueck - sonst sammelt
     sich an, was man einmal gesehen hat. */
  var _letzteStufe = null;
  function stufeGewechselt() {
    var s = gewaehlteStufe();
    if (_letzteStufe != null && s !== _letzteStufe) _offen = {};
    _letzteStufe = s;
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
      try { stil(); bauen(); wirkungZeigen(); stufeGewechselt(); stufenFilter(); zaehlen(); } catch (e) {
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
    stufeGewechselt();
    stufenFilter();
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
    /* v1347b: nach aussen, damit die Stufenlogik PRUEFBAR ist. Eine
       Funktion, die man nicht aufrufen kann, misst man ueber Umwege -
       und Umwege messen etwas anderes. */
    stufenFilter: stufenFilter, gewaehlteStufe: gewaehlteStufe,
    _stand: function () {
      return GRUPPEN.map(function (g) {
        var z = $('mbk-z-' + g.id);
        return { id: g.id, block: !!$('mbk-' + g.id), zaehler: z ? z.textContent : null };
      });
    }
  };
})();
