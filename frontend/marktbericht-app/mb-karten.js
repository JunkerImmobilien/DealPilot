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
  var GRUPPEN = [
    { id: 'ort',    titel: 'Wo steht das Objekt', felder: ['address', 'ptype', 'usage'] },
    { id: 'eck',    titel: 'Eckdaten',            felder: ['area', 'rooms', 'year', 'floor'] },
    { id: 'geld',   titel: 'Geld',                felder: ['rent', 'price'], optional: true,
      hinweis: 'Beide Angaben sind freiwillig. Ohne Kaltmiete rechnet der Bericht mit der Marktmiete.' },
    { id: 'zust',   titel: 'Zustand',             felder: ['cond', 'quality', 'modern', 'modyear'] },
    { id: 'energ',  titel: 'Energie und Heizung', felder: ['energy', 'eq_energie', 'eq_heating', 'eq_windows'] },
    { id: 'innen',  titel: 'Innen',               felder: ['eq_floor', 'eq_bath', 'eq_guest_wc', 'eq_store_room', 'baths'] },
    { id: 'huelle', titel: 'Dach und Wände',      felder: ['eq_walls', 'eq_dachform', 'eq_roof'] },
    { id: 'flaech', titel: 'Flächen',             felder: ['balcony', 'garden', 'plot', 'units'],
      hinweis: 'Grundstück bei einer Eigentumswohnung: das Gesamtgrundstück — der Anteil ergibt sich über den Miteigentumsanteil.' },
    { id: 'stell',  titel: 'Stellplätze und Aufzug', felder: ['garages', 'outdoor', 'elevator'] }
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
      /* Labels klein und in Mono-Versalien — dieselbe Schriftlogik wie die
         Kennzahlen-Labels der Haupt-App. Nur INNERHALB der Bloecke, damit
         die Wertermittlung unberuehrt bleibt. */
      '.mbk-block label{font-family:"JetBrains Mono",monospace;font-size:10px;',
        'letter-spacing:.11em;text-transform:uppercase;color:var(--muted,#7e7e88);',
        'margin:0 0 6px;line-height:1.5}',
      '.mbk-block label span{text-transform:none;letter-spacing:0;font-family:"Inter",sans-serif}',
      '.mbk-block input:focus,.mbk-block select:focus{border-color:var(--wl-c9a84c,#C9A84C);',
        'box-shadow:0 0 0 3px color-mix(in srgb, var(--wl-c9a84c,#C9A84C) 13%, transparent)}',
      '.mbk-block .row{margin:0}',
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

  function zeileVon(id) {
    var el = $(id);
    if (!el) return null;
    var r = el.closest ? el.closest('.row') : null;
    /* `#address` und `#elevator` stehen ohne `.row` — dann gilt die
       unmittelbare Huelle. */
    return r || (el.parentElement && el.parentElement.classList
      && el.parentElement.classList.contains('mbk-block') ? null : el.parentElement);
  }

  function bauen() {
    var neu = 0;
    for (var i = 0; i < GRUPPEN.length; i++) {
      var g = GRUPPEN[i];
      var zeilen = [];
      for (var j = 0; j < g.felder.length; j++) {
        var z = zeileVon(g.felder[j]);
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
  function sichtbar(el) {
    if (!el) return false;
    if (el.type === 'hidden') return false;
    return !!(el.offsetParent || el.getClientRects().length);
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
      try { stil(); bauen(); zaehlen(); } catch (e) {
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
