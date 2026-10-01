/* ═══════════════════════════════════════════════════════════════════════
   v1748 · DIE KAUFPREISAUFTEILUNG FRAGT, STATT ZU RATEN
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 01.10.2026: „Im Tower, wenn ich auf Kaufpreisaufteilung klicke,
   öffnet sich immer noch die Kaufpreisaufteilung. Da haben wir ja mehrere
   PDFs, die man dort ausgeben kann … vielleicht zu sagen: Welches wolltest
   du denn haben davon? Oder wir nennen das auch nicht Kaufpreisaufteilung,
   sondern BMF-Rechner … und dass wir dann ein Modal kriegen, wo wir es
   aussuchen können."

   GEMESSEN, was hinter dem einen Knopf wirklich liegt — nicht geraten:

     window.openBMFModal()             der Rechner
     window.exportBmfPdf()             die BMF-Anlage als PDF
     DealPilotBelegImport.open('ak')   die Belege der Anschaffungskosten

   **Es ist EIN PDF, nicht mehrere.** Das gehört gesagt, statt drei Einträge
   zu erfinden, die es nicht gibt. Was es stattdessen gibt, sind drei WEGE —
   rechnen, ausgeben, belegen — und die standen bisher alle hinter demselben
   Klick. Welcher davon lief, entschied `window._lastBmfResults`: ein
   Zustand, den niemand angezeigt bekommt.

   > Ein Knopf, der je nach unsichtbarem Zustand etwas anderes tut, ist kein
   > Knopf, sondern ein Würfel. Derselbe Satz stand schon in v1731 über dem
   > Deal-Aktions-Tab — dort wurde er in zwei benannte Knöpfe aufgelöst. Die
   > neuen Ansichten bauen ihre Ausgabeliste aber SELBST
   > (`layout-varianten.js`, `AUSGABEN`), und dort blieb der eine Eintrag
   > stehen. Eine Lehre, die nur an einer Stelle gezogen wird, gilt nicht.

   Die Gestaltung ist bewusst dieselbe wie bei der Fassungswahl
   (`pdf-wahl.js`, Klassen `dpw-*` aus `layout-varianten.css`): zwei
   Auswahlfenster, die gleich aussehen, lernt man einmal.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function hat(fn) { return typeof window[fn] === 'function'; }

  /* Gerechnet oder nicht — davon haengt ab, ob die Anlage ueberhaupt etwas
     enthaelt. Statt den Knopf still umzudeuten, wird er ausgegraut und sagt
     warum. */
  function gerechnet() {
    try { return !!window._lastBmfResults; } catch (e) { return false; }
  }

  var WEGE = [
    {
      id: 'rechner',
      titel: 'Aufteilung berechnen',
      unter: 'BMF-Rechner öffnen',
      fuer: 'Grund und Gebäude nach der amtlichen Arbeitshilfe aufteilen — ' +
            'mit Verprobung der drei Verfahren.',
      tun: function () {
        if (hat('openBMFModal')) return window.openBMFModal();
        toast('BMF-Rechner nicht geladen.');
      }
    },
    {
      id: 'anlage',
      titel: 'BMF-Anlage als PDF',
      unter: 'für das Finanzamt',
      fuer: 'Die fertige Anlage: Aufteilung, AfA-Bemessungsgrundlage und ' +
            'Verprobung — als Dokument zum Einreichen.',
      /* Der einzige Weg hier, der etwas voraussetzt. */
      sperre: function () {
        return gerechnet() ? null : 'Erst berechnen — die Anlage druckt das Ergebnis.';
      },
      tun: function () {
        if (hat('exportBmfPdf')) return window.exportBmfPdf();
        toast('BMF-Anlage nicht verfügbar.');
      }
    },
    {
      id: 'belege',
      titel: 'Belege einlesen',
      unter: 'Anschaffungskosten',
      fuer: 'Rechnungen und Belege der Anschaffungsnebenkosten erfassen — ' +
            'KI-gestützt, mehrere je Lauf.',
      tun: function () {
        if (window.DealPilotBelegImport && typeof window.DealPilotBelegImport.open === 'function') {
          return window.DealPilotBelegImport.open('ak');
        }
        toast('Beleg-Import nicht geladen.');
      }
    }
  ];

  function toast(t) {
    try { if (typeof window.toast === 'function') return window.toast(t); } catch (e) {}
    try { if (window.DealPilotToast && window.DealPilotToast.show) return window.DealPilotToast.show(t); } catch (e) {}
    console.warn('[BmfWahl]', t);
  }

  function zeige() {
    var alt = document.querySelector('.dpw-ov[data-bmf]');
    if (alt) alt.remove();

    var ov = document.createElement('div');
    ov.className = 'dpw-ov';
    ov.setAttribute('data-bmf', '1');

    var karten = WEGE.map(function (w) {
      var grund = w.sperre ? w.sperre() : null;
      return '<button type="button" class="dpw-k' + (grund ? ' dpw-aus' : '') + '" data-id="' + w.id + '"' +
        (grund ? ' disabled title="' + grund + '"' : '') + '>' +
        '<span class="dpw-tx"><b>' + w.titel + '</b>' +
        '<span class="dpw-u">' + w.unter + '</span>' +
        '<span class="dpw-f">' + (grund ? grund : w.fuer) + '</span></span></button>';
    }).join('');

    ov.innerHTML =
      '<div class="dpw-kasten" role="dialog" aria-modal="true" aria-label="Kaufpreisaufteilung">' +
      '<div class="dpw-kopf"><b>Kaufpreisaufteilung · BMF</b>' +
      '<button type="button" class="dpw-zu" aria-label="Schliessen">×</button></div>' +
      '<p class="dpw-vor">Drei Wege führen hier weiter — rechnen, ausgeben, belegen. ' +
      'Die Anlage lässt sich erst ziehen, wenn gerechnet wurde.</p>' +
      '<div class="dpw-liste">' + karten + '</div>' +
      '</div>';

    document.body.appendChild(ov);

    function zu() { ov.remove(); }
    ov.querySelector('.dpw-zu').addEventListener('click', zu);
    ov.addEventListener('click', function (e) { if (e.target === ov) zu(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { zu(); document.removeEventListener('keydown', esc); }
    });

    [].forEach.call(ov.querySelectorAll('.dpw-k'), function (k) {
      k.addEventListener('click', function () {
        if (k.disabled) return;
        var w = WEGE.filter(function (x) { return x.id === k.dataset.id; })[0];
        zu();
        if (w) setTimeout(function () { try { w.tun(); } catch (e) { toast('Nicht verfügbar.'); } }, 60);
      });
    });

    var erste = ov.querySelector('.dpw-k:not([disabled])');
    if (erste) try { erste.focus(); } catch (e) {}
  }

  window.DealPilotBmfWahl = { zeige: zeige, wege: WEGE, gerechnet: gerechnet };
})();
