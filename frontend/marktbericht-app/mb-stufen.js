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
  /* v1126d: Der fruehere FEHLT_TEXT ist raus. Er war eine zweite, von Hand
     gepflegte Liste derselben Pflichtangaben — und lief prompt auseinander.
     Was fehlt, sagt jetzt fehlend() aus BEDARF, also aus einer Quelle. */

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

  /* ── Was jede Stufe WIRKLICH braucht ───────────────────────────────────
     v1126d · EIGENER FEHLER, ZURUECKGENOMMEN. Ich hatte behauptet, hier
     staenden „dieselben Bedingungen wie die Verfahrensampel". Das stimmte
     nicht: geprueft wurden nur address, ptype und area. Folge — die Leiste
     meldete „Wertermittlung erreicht" bei einem halb leeren Formular, ohne
     Baujahr. Genau das ist Marcel aufgefallen.

     Jetzt aus VERFAHREN in wertermittlung.js abgeschrieben:
       markt   pflicht ptype, area, year, baustatus · empfohlen cond, quality
       ertrag  pflicht plot, units
       sach    pflicht plot, year (bei ETW nicht anwendbar)

     Eine Leiste, die mehr behauptet als da ist, ist schlimmer als keine. */
  var BEDARF = {
    1: [['address', 'Adresse'], ['ptype', 'Objektart'], ['area', 'Wohnfläche'], ['year', 'Baujahr']],
    2: [['baustatus', 'Baustatus'], ['cond', 'Zustand'], ['quality', 'Qualität']],
    3: [['plot', 'Grundstücksfläche'], ['units', 'Wohneinheiten']]
  };
  /* Die objektartabhaengigen Pflichtangaben der Wertermittlung. */
  function bedarf3() {
    var l = BEDARF[3].slice();
    if (istWohnung()) l.push(['mea', 'Miteigentumsanteil']);
    else { l.push(['standardstufe', 'Standardstufe']); l.push(['nhkHaus', 'Hausform (NHK)']); }
    return l;
  }
  function fehlend(n) {
    var l = (n === 3) ? bedarf3() : BEDARF[n];
    return l.filter(function (f) { return !wert(f[0]); }).map(function (f) { return f[1]; });
  }
  function erreicht() {
    if (fehlend(1).length) return 0;
    if (fehlend(2).length) return 1;
    if (fehlend(3).length) return 2;
    return 3;
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
    /* v1126d · WAAGERECHT PASST NICHT. Gemessen: die Spalte ist 338 px
       breit, drei Beschriftungen brauchten je 120 px — sie klebten
       aneinander, "Marktpreisindikation" beruehrte die Nachbarn. Deshalb
       eine LISTE statt einer Bahn. Sie hat denselben Inhalt, liest sich in
       der schmalen Spalte aber ruhig und hat Platz fuer das Wichtigste:
       was der jeweiligen Stufe noch fehlt. */
    s.textContent = [
      '.mbst{margin:0 0 16px;padding:14px 16px;border:1px solid rgba(201,168,76,.25);',
        'border-radius:8px;background:rgba(201,168,76,.04)}',
      '.mbst h4{margin:0 0 4px;font-size:13px;color:var(--wl-e8cc7a,#E8CC7A);font-weight:600}',
      '.mbst-sub{font-size:11px;opacity:.65;margin-bottom:11px;line-height:1.45}',
      '.mbst-ms{display:flex;gap:10px;align-items:flex-start;padding:8px 9px;margin:4px 0;',
        'border-radius:6px;cursor:pointer;transition:background .15s}',
      '.mbst-ms:hover{background:rgba(201,168,76,.09)}',
      '.mbst-ms.an{background:rgba(201,168,76,.13)}',
      '.mbst-pkt{flex:0 0 auto;width:20px;height:20px;border-radius:50%;background:rgba(128,128,128,.28);',
        'display:flex;align-items:center;justify-content:center;font-size:10.5px;margin-top:1px;transition:.25s}',
      '.mbst-ms.an .mbst-pkt{background:var(--wl-c9a84c,#C9A84C);color:#2c2410;font-weight:700}',
      '.mbst-txt{flex:1 1 auto;min-width:0}',
      '.mbst-zeile{display:flex;gap:8px;align-items:baseline}',
      '.mbst-name{font-size:12.5px;font-weight:600;opacity:.7}',
      '.mbst-ms.an .mbst-name{opacity:1}',
      '.mbst-kero{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:11px;',
        'font-weight:600;color:var(--wl-c9a84c,#C9A84C);white-space:nowrap}',
      '.mbst-was{font-size:10.5px;line-height:1.45;opacity:.6;margin-top:2px}',
      '.mbst-fehlt{font-size:10.5px;line-height:1.45;margin-top:2px;color:var(--wl-b8625c,#B8625C)}',
      '.mbst-info{margin-top:9px;padding:8px 10px;border-radius:6px;background:rgba(201,168,76,.10);',
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

    var ms = [1, 2, 3].map(function (n) {
      var an = s >= n;
      var p = preisFuer(n);
      var f = fehlend(n);
      return '<div class="mbst-ms' + (an ? ' an' : '') + '" data-mbst-ziel="' + n + '" ' +
          'title="' + (an ? NAMEN[n] + ' erreicht' : 'Angaben für ' + NAMEN[n] + ' einblenden') + '">' +
        '<div class="mbst-pkt">' + (an ? '✓' : n) + '</div>' +
        '<div class="mbst-txt">' +
          '<div class="mbst-zeile"><span class="mbst-name">' + NAMEN[n] + '</span>' +
            '<span class="mbst-kero">' + (p === 0 ? 'bezahlt' : p + ' L') + '</span></div>' +
          (an
            ? '<div class="mbst-was">' + WAS[n] + '</div>'
            : '<div class="mbst-fehlt">fehlt: ' + f.join(', ') + '</div>') +
        '</div></div>';
    }).join('');

    var info;
    if (s === 0) info = '<b>Noch nichts erreicht.</b> Die Angaben oben füllen — die Stufe ergibt sich daraus.';
    else if (s < 3) info = '<b>' + NAMEN[s] + '</b> ist erreicht. Eine Zeile tiefer klicken blendet die nächsten Angaben ein.';
    else info = '<b>Wertermittlung erreicht</b> — alle drei Verfahren rechnen mit echten Parametern.';
    if (_bezahlt > 0) {
      info += '<br>Für dieses Objekt ist <b>' + NAMEN[_bezahlt] + '</b> bereits bezahlt — ' +
              'eine höhere Stufe kostet nur die Differenz.';
    }

    wo.innerHTML =
      '<h4>Was der Bericht leisten soll</h4>' +
      '<div class="mbst-sub">Kein Vorab-Klick nötig — die Stufe ergibt sich aus deinen Angaben.</div>' +
      ms +
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
