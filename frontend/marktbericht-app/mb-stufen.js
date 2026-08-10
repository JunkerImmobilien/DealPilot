/* ============================================================================
   DealPilot v1126 — mb-stufen.js
   „Die drei Stufen sollen vereint werden, nicht vorher abgefragt."
   (Marcels Entscheidung 2026-08-11, Entwurf: design/Vorschlaege/marktbericht-wizard.html)

   WAS SICH AENDERT
   Die Zielfrage („Schnelle Einschaetzung / Genaue Preisindikation /
   Wertermittlung") verschwindet als FRAGE. An ihre Stelle tritt eine
   Meilensteinleiste: man fuellt aus, und die Stufe ERGIBT sich. Am Knopf
   steht, was der Bericht auf der erreichten Stufe kostet.

   WAS BLEIBT
   Alles darunter. `stufe()` und `setStufe()` aus wertermittlung.js sind
   weiter die einzige Wahrheit ueber die Stufe — dieser Baustein RECHNET sie
   nur aus und meldet sie dorthin. Damit folgen Bloecke (precBox, wm-b3),
   Ampel und payload() unveraendert. Kein zweites Stufenmodell.

   DER PREIS KOMMT VOM SERVER
   GET /marktbericht/stufenpreis?ref=… liefert die schon bezahlte Stufe und
   den faelligen Betrag je Stufe. Der Browser rechnet die Ermaessigung NICHT
   selbst aus — er kennt die bezahlte Stufe nicht und soll sie nicht kennen
   (v1125: sie kommt aus dem Kerosin-Log, nie aus dem Browser).
   Antwortet der Server nicht, stehen die vollen Preise da: lieber zu viel
   angekuendigt als eine Ermaessigung versprochen, die es nicht gibt.
   ============================================================================ */
(function () {
  'use strict';
  if (window.DealPilotMbStufen) return;

  var VOLLPREIS = { 1: 2, 2: 5, 3: 12 };
  var NAMEN = { 1: 'Einschätzung', 2: 'Marktpreisindikation', 3: 'Wertermittlung' };
  var WAS = {
    1: 'Lage und Marktpreisindikation.',
    2: 'Zusätzlich Baustatus, Zustand und Qualität — deutlich engere Spanne.',
    3: 'Zusätzlich Boden-, Ertrags- und Sachwert nach ImmoWertV, mit Rechenweg im PDF.'
  };
  /* Was fuer die naechste Stufe noch fehlt — dieselben Pflichtangaben, die
     die Ampel prueft, nur in Worten. */
  var FEHLT_TEXT = {
    1: 'Adresse, Objektart und Wohnfläche',
    2: 'Baustatus und Zustand',
    3: 'Grundstücksfläche und — je nach Objektart — Standardstufe bzw. Miteigentumsanteil'
  };

  var _faellig = null;      /* vom Server, je Stufe */
  var _bezahlt = 0;
  var _letzte = 0;
  /* ── v1126c · Das Henne-Ei-Problem, im Durchgang gefunden ───────────────
     Stufe 3 verlangt `plot` und — je nach Objektart — `mea` bzw.
     `standardstufe`/`nhkHaus`. Die liegen aber ALLE im Block `wm-b3`, und
     den baut wertermittlung.js erst `if (s >= 3)`. Die Felder, die
     hochstufen, gibt es vor dem Hochstufen also gar nicht: **Stufe 3 war
     rein rechnerisch unerreichbar.**

     Aufloesung ohne Frage vorweg: der Meilenstein ist ANKLICKBAR. Ein Klick
     ist kein Fragebogen, sondern „ich will tiefer" — dasselbe „Vertiefen"
     wie in der Uebersicht des Entwurfs. Danach entscheiden wieder die
     Felder, ob die Stufe wirklich vollstaendig ist.
     _angestrebt ist deshalb eine UNTERGRENZE, nie eine Behauptung. */
  var _angestrebt = 0;

  function $(id) { return document.getElementById(id); }
  function wert(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function istWohnung() { return /wohnung|etw/i.test(wert('ptype')); }

  /* ── Die erreichte Stufe, aus dem Ausgefuellten ────────────────────────
     Bewusst dieselben Bedingungen wie die Verfahrensampel in
     wertermittlung.js — nicht strenger und nicht laxer, sonst zeigt die
     Leiste etwas anderes an als die Ampel darunter. */
  function erreicht() {
    if (!(wert('address') && wert('ptype') && wert('area'))) return 0;
    var s = 1;
    if (wert('baustatus') && wert('cond')) s = 2;
    if (s === 2 && wert('plot')) {
      var sachOk = istWohnung()
        ? !!wert('mea')
        : (!!wert('standardstufe') && !!wert('nhkHaus'));
      if (sachOk) s = 3;
    }
    return s;
  }

  function ref() {
    try {
      if (typeof window._mbRef === 'function') { var r = window._mbRef(); if (r) return String(r); }
    } catch (e) {}
    try { if (window._mbwRef) return String(window._mbwRef); } catch (e) {}
    return null;
  }

  function preisHolen() {
    var r = ref();
    var url = '/api/v1/marktbericht/stufenpreis' + (r ? ('?ref=' + encodeURIComponent(r)) : '');
    var tok = null; try { tok = localStorage.getItem('ji_token'); } catch (e) {}
    return fetch(url, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} })
      .then(function (x) { return x.json(); })
      .then(function (d) {
        if (d && d.faellig) { _faellig = d.faellig; _bezahlt = parseInt(d.bezahlte_stufe, 10) || 0; }
        zeichnen();
      })
      .catch(function () { _faellig = null; zeichnen(); });
  }

  function preisFuer(s) {
    if (_faellig && _faellig[s] != null) return parseInt(_faellig[s], 10);
    return VOLLPREIS[s];
  }

  /* ── Die Leiste ────────────────────────────────────────────────────────── */
  function stil() {
    if ($('mbst-css')) return;
    var s = document.createElement('style');
    s.id = 'mbst-css';
    s.textContent = [
      '.mbst{margin:0 0 16px;padding:14px 16px;border:1px solid rgba(201,168,76,.25);',
        'border-radius:8px;background:rgba(201,168,76,.04)}',
      '.mbst h4{margin:0 0 14px;font-size:13px;color:var(--wl-e8cc7a,#E8CC7A);font-weight:600}',
      '.mbst-bahn{position:relative;height:44px;margin:0 6px 6px}',
      '.mbst-linie{position:absolute;left:0;right:0;top:9px;height:4px;border-radius:3px;background:rgba(128,128,128,.25)}',
      '.mbst-fuell{position:absolute;left:0;top:9px;height:4px;border-radius:3px;',
        'background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));transition:width .35s}',
      '.mbst-ms{position:absolute;top:0;transform:translateX(-50%);text-align:center;width:120px}',
      '.mbst-pkt{width:22px;height:22px;border-radius:50%;background:rgba(128,128,128,.25);',
        'margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:11px;transition:.3s}',
      '.mbst-ms.an .mbst-pkt{background:var(--wl-c9a84c,#C9A84C);color:#2c2410;font-weight:700}',
      '.mbst-lbl{font-size:10.5px;line-height:1.3;margin-top:5px;opacity:.65}',
      '.mbst-ms.an .mbst-lbl{opacity:1;font-weight:600}',
      '.mbst-kero{font-family:"JetBrains Mono",monospace;font-size:10px;opacity:.75;display:block}',
      '.mbst-info{margin-top:8px;padding:8px 10px;border-radius:6px;background:rgba(201,168,76,.10);',
        'font-size:11.5px;line-height:1.5}',
      '.mbst-info b{color:var(--wl-e8cc7a,#E8CC7A)}'
    ].join('');
    document.head.appendChild(s);
  }

  function zeichnen() {
    var wo = $('wm-ziel');
    if (!wo) return;
    stil();
    /* Die alte Optionsliste weicht — der Behaelter bleibt, damit
       stufenAnwenden() weiter seinen Hinweis anhaengen kann. */
    wo.className = 'mbst';
    var s = erreicht();

    var pos = { 1: 12, 2: 50, 3: 88 };
    var ms = [1, 2, 3].map(function (n) {
      var an = s >= n;
      var p = preisFuer(n);
      return '<div class="mbst-ms' + (an ? ' an' : '') + '" style="left:' + pos[n] + '%" ' +
        'data-mbst-ziel="' + n + '" title="' + (an ? NAMEN[n] : 'Angaben für ' + NAMEN[n] + ' einblenden') + '">' +
        '<div class="mbst-pkt">' + (an ? '✓' : n) + '</div>' +
        '<div class="mbst-lbl">' + NAMEN[n] +
        '<span class="mbst-kero">' + (p === 0 ? 'bezahlt' : p + ' L') + '</span></div></div>';
    }).join('');

    var info;
    if (s === 0) {
      info = '<b>Noch nichts erreicht.</b> Es fehlen ' + FEHLT_TEXT[1] + '.';
    } else if (s < 3) {
      info = '<b>' + NAMEN[s] + ' erreicht.</b> ' + WAS[s] +
             ' Für <b>' + NAMEN[s + 1] + '</b> fehlen noch ' + FEHLT_TEXT[s + 1] + '.';
    } else {
      info = '<b>Wertermittlung erreicht.</b> ' + WAS[3];
    }
    if (_bezahlt > 0) {
      info += '<br>Für dieses Objekt ist <b>' + NAMEN[_bezahlt] + '</b> bereits bezahlt — ' +
              'eine höhere Stufe kostet nur die Differenz.';
    }

    wo.innerHTML =
      '<h4>Was der Bericht leisten soll — es ergibt sich aus deinen Angaben</h4>' +
      '<div class="mbst-bahn"><div class="mbst-linie"></div>' +
        '<div class="mbst-fuell" style="width:' + (s ? pos[s] : 0) + '%"></div>' + ms + '</div>' +
      '<div class="mbst-info">' + info + '</div>';

    knopf(s);
  }

  /* Der Preis wandert an den Erzeugen-Knopf — dort wird er ausgegeben. */
  function knopf(s) {
    var b = $('goBtn');
    if (!b) return;
    /* NICHT auf `disabled` pruefen — gemessen ist der Knopf auch im
       Normalzustand deaktiviert, solange Pflichtangaben fehlen, und dann
       waere der Preis nie zu sehen. Ueberschrieben werden darf nur der
       LAUFENDE Abruf: app.js setzt dort ein <span class="spin"> hinein. */
    if (b.querySelector('.spin')) return;
    var p = s >= 1 ? preisFuer(s) : null;
    b.textContent = s >= 1
      ? ('Marktbericht erstellen · ' + (p === 0 ? 'ohne Aufpreis' : p + ' L'))
      : 'Marktbericht erstellen';
  }

  /* ── Die Stufe an wertermittlung.js melden ─────────────────────────────
     NUR bei echter Aenderung: setStufe() zeichnet die Bloecke neu, das bei
     jedem Tastendruck zu tun waere teuer und wuerde den Fokus kosten. */
  function melden() {
    var s = erreicht();
    /* _angestrebt ist die Untergrenze: der Nutzer hat den Meilenstein
       angeklickt und will die Felder sehen. Was davon ausgefuellt ist,
       entscheidet weiter allein erreicht(). */
    var ziel = Math.max(1, s, _angestrebt);
    if (ziel === _letzte) { zeichnen(); return; }
    _letzte = ziel;
    try {
      if (window.Wertermittlung && window.Wertermittlung.setStufe) window.Wertermittlung.setStufe(ziel);
    } catch (e) {}
    zeichnen();
  }

  var _plan = null;
  function angestossen() {
    if (_plan) clearTimeout(_plan);
    /* setTimeout, nicht requestAnimationFrame: rAF feuert im verborgenen
       oder gedrosselten Tab nicht (gemessen, dp-band-fix.js v1092b). */
    _plan = setTimeout(melden, 180);
  }

  function start() {
    if (!$('wm-ziel')) { setTimeout(start, 400); return; }
    document.addEventListener('input', angestossen, true);
    document.addEventListener('change', angestossen, true);
    /* Klick auf einen Meilenstein blendet dessen Angaben ein. */
    document.addEventListener('click', function (ev) {
      var m = ev.target && ev.target.closest ? ev.target.closest('[data-mbst-ziel]') : null;
      if (!m) return;
      var n = parseInt(m.getAttribute('data-mbst-ziel'), 10);
      if (!(n >= 1 && n <= 3)) return;
      _angestrebt = n;
      melden();
    }, true);
    _letzte = 0;
    melden();
    preisHolen();
    /* Objektwechsel im Dropdown -> neuer Preis. */
    var sel = document.querySelector('#mbow-host select');
    if (sel) sel.addEventListener('change', function () { setTimeout(preisHolen, 300); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotMbStufen = {
    erreicht: erreicht, zeichnen: zeichnen, preisHolen: preisHolen,
    _stand: function () { return { erreicht: erreicht(), bezahlt: _bezahlt, faellig: _faellig }; }
  };
})();
