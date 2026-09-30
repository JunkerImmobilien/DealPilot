/* ═══════════════════════════════════════════════════════════════════════
   pdf-wahl.js · v1636 — die Rückfrage vor dem Export

   Marcel am 26.09.2026: „Bei dem Bankexport müssen wir nachfragen, wenn
   wir draufklicken, welchen wir da nehmen sollen, den hellen oder den
   dunklen. Da gibt's ja auch noch Abstufungen."

   ── WAS ES WIRKLICH GIBT (gemessen, nicht angenommen) ─────────────────
   Ich habe nicht geraten, welche Fassungen existieren, sondern nachgesehen:

     `window._dpPdfLight`                pdf.js:600, Vorgabe FALSE
     `_cv(dunkel, hell)`                 pdf.js:602, **13 Fundstellen**
     `pdf-investment-bank.js`            **null** Fundstellen

   Daraus folgt genau eine Aufteilung:

     · `exportPDF`      — das grosse Investment-PDF. Deckblatt und
                          Seitenköpfe DUNKEL oder HELL, je nach Schalter.
     · `exportPDFBank`  — die Bankfassung. Immer weisses Papier; sie
                          kennt den Schalter gar nicht.

   Also drei Abstufungen, und keine erfundene vierte.

   ── WARUM DIE WAHL NICHT IN DIE EINSTELLUNGEN GEHÖRT ──────────────────
   Weil sie vom EMPFÄNGER abhängt, nicht vom Nutzer. Dieselbe Person
   schickt morgens etwas an die Bank und mittags an einen Miteigentümer.
   Eine Einstellung, die man vor jedem zweiten Export ändern müsste, ist
   keine Einstellung, sondern eine Falle. Deshalb die Frage im Moment des
   Klicks - mit „merken" für den, der immer dasselbe nimmt.

   ── DIE UMHÜLLUNG ─────────────────────────────────────────────────────
   Die beiden Funktionen werden umhüllt, nicht ersetzt. Jeder bestehende
   Aufrufer (Seitenmenü, Deal-Aktion, Dashboard-Karte, hybrid-aktionen)
   bekommt die Frage automatisch - ohne dass eine einzige Aufrufstelle
   angefasst wird. Wer sie NICHT will, ruft mit `{ohneRueckfrage:true}`.

   > Eine Umhüllung erreicht Aufrufer, die man noch gar nicht kennt.
   > Eine geänderte Aufrufstelle erreicht genau eine.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotPdfWahl) return;

  var LS = 'dp_pdf_wahl';

  var WAHLEN = [
    { id: 'bank', titel: 'Bankfassung', unter: 'Weisses Papier, Kennzahlen als Tabelle',
      fuer: 'Bank · Finanzierung · Steuerberater', hell: true, art: 'bank' },
    { id: 'hell', titel: 'Investment-PDF · hell', unter: 'Volles Dokument, helles Deckblatt',
      fuer: 'Miteigentümer · Partner · Ausdruck', hell: true, art: 'voll' },
    { id: 'obsidian', titel: 'Investment-PDF · Obsidian', unter: 'Volles Dokument, dunkles Deckblatt',
      fuer: 'Eigener Gebrauch · Präsentation', hell: false, art: 'voll' }
  ];

  var origBank = null, origVoll = null;

  function fuehreAus(w) {
    /* Der Schalter gilt nur für DIESEN Export - danach zurück auf den
       Stand, den der Mandant gesetzt hat. Ein Schalter, der stehen
       bleibt, färbt den nächsten Export mit, den niemand gewählt hat. */
    var vorher = window._dpPdfLight;
    try {
      if (typeof window._dpPdfSetLight === 'function') window._dpPdfSetLight(w.hell);
      else window._dpPdfLight = w.hell;
      if (w.art === 'bank') { if (origBank) return origBank.call(window, { ohneRueckfrage: true }); }
      else { if (origVoll) return origVoll.call(window, { ohneRueckfrage: true }); }
    } finally {
      /* Erst nach einem Wimpernschlag zurücksetzen: der Export ist
         async und liest die Farben noch, während wir hier schon
         weiterlaufen. */
      setTimeout(function () {
        try {
          if (typeof window._dpPdfSetLight === 'function') window._dpPdfSetLight(vorher);
          else window._dpPdfLight = vorher;
        } catch (e) {}
      }, 4000);
    }
  }

  function gemerkt() {
    try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; }
  }

  function frage(vorauswahl) {
    var g = gemerkt();
    if (g) {
      var w = WAHLEN.filter(function (x) { return x.id === g; })[0];
      if (w) return fuehreAus(w);
    }
    zeige(vorauswahl);
  }

  function zeige(vorauswahl) {
    var alt = document.getElementById('dp-pdf-wahl');
    if (alt) alt.remove();

    var ov = document.createElement('div');
    ov.id = 'dp-pdf-wahl';
    ov.className = 'dpw-ov';

    var karten = WAHLEN.map(function (w) {
      return '<button type="button" class="dpw-k' + (w.id === vorauswahl ? ' dpw-an' : '') + '" data-id="' + w.id + '">'
        + '<span class="dpw-probe dpw-probe-' + (w.hell ? 'hell' : 'dunkel') + '"></span>'
        + '<span class="dpw-tx"><b>' + w.titel + '</b>'
        + '<span class="dpw-u">' + w.unter + '</span>'
        + '<span class="dpw-f">' + w.fuer + '</span></span></button>';
    }).join('');

    ov.innerHTML =
      '<div class="dpw-kasten" role="dialog" aria-modal="true" aria-label="Welche Fassung?">'
      + '<div class="dpw-kopf"><b>Welche Fassung?</b>'
      + '<button type="button" class="dpw-zu" aria-label="Schliessen">×</button></div>'
      + '<p class="dpw-vor">Drei Fassungen stehen bereit. Sie unterscheiden sich im Umfang '
      + 'und im Deckblatt - der Inhalt ist derselbe.</p>'
      + '<div class="dpw-liste">' + karten + '</div>'
      + '<label class="dpw-merk"><input type="checkbox" id="dpw-merken"> '
      + 'Diese Wahl merken <span>(änderbar in den Einstellungen)</span></label>'
      + '</div>';

    document.body.appendChild(ov);

    function zu() { ov.remove(); }
    ov.querySelector('.dpw-zu').addEventListener('click', zu);
    ov.addEventListener('click', function (e) { if (e.target === ov) zu(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { zu(); document.removeEventListener('keydown', esc); }
    });

    [].forEach.call(ov.querySelectorAll('.dpw-k'), function (k) {
      k.addEventListener('click', function () {
        var w = WAHLEN.filter(function (x) { return x.id === k.dataset.id; })[0];
        if (!w) return;
        if (ov.querySelector('#dpw-merken').checked) {
          try { localStorage.setItem(LS, w.id); } catch (e) {}
        }
        zu();
        fuehreAus(w);
      });
    });

    var erste = ov.querySelector('.dpw-an') || ov.querySelector('.dpw-k');
    if (erste) erste.focus();
  }

  /* ── Umhüllen ────────────────────────────────────────────────────── */
  function umhuellen() {
    if (typeof window.exportPDFBank === 'function' && !window.exportPDFBank.__dpw) {
      origBank = window.exportPDFBank;
      window.exportPDFBank = function (opt) {
        if (opt && opt.ohneRueckfrage) return origBank.apply(this, arguments);
        return frage('bank');
      };
      window.exportPDFBank.__dpw = true;
    }
    if (typeof window.exportPDF === 'function' && !window.exportPDF.__dpw) {
      origVoll = window.exportPDF;
      window.exportPDF = function (opt) {
        if (opt && opt.ohneRueckfrage) return origVoll.apply(this, arguments);
        return frage('hell');
      };
      window.exportPDF.__dpw = true;
    }
  }

  /* Die Exportfunktionen entstehen in Dateien, die nach dieser hier
     geladen werden können. Deshalb nicht einmal, sondern bis beide da
     sind - höchstens zehn Sekunden lang. */
  var versuche = 0;
  (function warten() {
    umhuellen();
    if ((!origBank || !origVoll) && versuche++ < 40) setTimeout(warten, 250);
  })();

  window.DealPilotPdfWahl = {
    zeige: zeige,
    vergessen: function () { try { localStorage.removeItem(LS); } catch (e) {} },
    gemerkt: gemerkt,
    wahlen: WAHLEN
  };
})();
