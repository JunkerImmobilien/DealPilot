'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   karten-kompakt.js — v1092 · Kompakt-Karten zum Aufklappen

   VORLAGE: design/mockups/Screenshot 1.png (offen) und Screenshot 2.png (zu).
   Das ist die Karte aus dem Portfolio-Cockpit (js/dashboard.js:836,
   kanbanCardHtml -> .kc / .kc-flat / .kc-body, umgeschaltet per
   classList.toggle('open')). Uebernommen wird die GESTALTUNG, nicht der Code —
   die Leistenkarte hat eine voellig andere Struktur.

   WARUM EIN EIGENES MODUL
     Die Karte wird in js/storage.js von _renderRichCard() ab Z.866 gebaut.
     Dort wird NICHTS geaendert: kein neues Markup, kein neuer Klickpfad.
     Dieses Modul haengt sich nur an zwei Stellen an:
       1. ein Klick-Horcher am Dokument (Delegation, capture)
       2. eine Klasse .uv-open an der Karte, auf die das CSS reagiert
     Faellt die Datei aus, sind die Karten wieder wie vorher — nur nicht
     mehr aufklappbar.

   GEMESSEN (06.08., Abgleich Standard gegen Kompakt):
     Kompakt blendet gegenueber Standard GENAU DREI Dinge aus —
     .sbc-thumb (Foto), .sbc-halter ("privat") und .sbc-score-label (Stufe).
     Alles andere ist in beiden Fassungen identisch. Im neuen Kompakt kommen
     Foto und Halter im aufgeklappten Rumpf zurueck, die Stufe steht
     dauerhaft unter dem Ring — so wie in der Vorlage.

   DER SCHALTER
     Die Karte traegt bereits ein <span class="sbc-arrow">›</span>
     (storage.js:1044). Das wird der Chevron — kein zusaetzliches Element,
     das der Renderer beim naechsten Zeichnen wegwerfen wuerde.
     Ein Klick darauf darf NICHT das Objekt oeffnen, deshalb
     stopPropagation in der capture-Phase: der Karten-Klick haengt weiter
     oben und wuerde sonst zuerst feuern.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DealPilotKartenKompakt) return;

  var OFFEN = Object.create(null);   /* data-key -> true, ueberlebt Neuzeichnen */
  var KLASSE = 'uv-open';

  function kompaktAn() {
    return document.documentElement.getAttribute('data-ui-cards') === 'kompakt';
  }

  function karteVon(el) {
    return el && el.closest ? el.closest('.sb-card') : null;
  }

  function umschalten(karte) {
    if (!karte) return;
    var k = karte.getAttribute('data-key') || '';
    var offen = karte.classList.toggle(KLASSE);
    if (k) { if (offen) OFFEN[k] = true; else delete OFFEN[k]; }
    karte.setAttribute('aria-expanded', offen ? 'true' : 'false');
  }

  /* Nach jedem Neuzeichnen den Zustand zurueckschreiben. Der Renderer baut
     die Karten komplett neu — ohne das klappt beim Speichern alles zu. */
  function wiederherstellen() {
    if (!kompaktAn()) return;
    var karten = document.querySelectorAll('#sidebar .sb-card');
    for (var i = 0; i < karten.length; i++) {
      var k = karten[i].getAttribute('data-key') || '';
      var soll = !!(k && OFFEN[k]);
      karten[i].classList.toggle(KLASSE, soll);
      karten[i].setAttribute('aria-expanded', soll ? 'true' : 'false');
    }
  }

  /* ── Klick ──────────────────────────────────────────────────────────────
     capture:true ist Pflicht. Der Klick auf die Karte oeffnet das Objekt;
     haengt der Horcher in der bubble-Phase, ist das Objekt schon offen,
     bevor wir stoppen koennen. */
  document.addEventListener('click', function (ev) {
    if (!kompaktAn()) return;
    var ziel = ev.target;
    if (!ziel || !ziel.closest) return;
    var pfeil = ziel.closest('.sbc-arrow');
    if (!pfeil) return;
    var karte = karteVon(pfeil);
    if (!karte || !karte.closest('#sidebar')) return;
    ev.stopPropagation();
    ev.preventDefault();
    umschalten(karte);
  }, true);

  /* Tastatur: der Pfeil ist im CSS ein Knopf, also muss er auch einer sein. */
  document.addEventListener('keydown', function (ev) {
    if (!kompaktAn()) return;
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var ziel = ev.target;
    if (!ziel || !ziel.closest) return;
    var pfeil = ziel.closest('.sbc-arrow');
    if (!pfeil) return;
    var karte = karteVon(pfeil);
    if (!karte || !karte.closest('#sidebar')) return;
    ev.stopPropagation();
    ev.preventDefault();
    umschalten(karte);
  }, true);

  /* Der Pfeil braucht Rolle und Fokus — er kommt als reines <span> aus dem
     Renderer. Wird nach jedem Neuzeichnen erneut gesetzt. */
  function pfeileHerrichten() {
    if (!kompaktAn()) return;
    var pfeile = document.querySelectorAll('#sidebar .sb-card .sbc-arrow');
    for (var i = 0; i < pfeile.length; i++) {
      if (pfeile[i].getAttribute('role') === 'button') continue;
      pfeile[i].setAttribute('role', 'button');
      pfeile[i].setAttribute('tabindex', '0');
      pfeile[i].setAttribute('aria-label', 'Karte auf- und zuklappen');
    }
  }

  /* ── Neuzeichnen abfangen ───────────────────────────────────────────────
     Kein Timer, kein Polling: der Beobachter haengt an der Liste selbst.
     Er feuert auch, wenn die Vorlage umgeschaltet wird (dann sind die
     Karten dieselben, aber data-ui-cards hat sich geaendert). */
  /* v1092b — GEMESSEN: requestAnimationFrame feuert in einem gedrosselten
     oder im Hintergrund liegenden Tab NICHT. Im Pruef-Browser blieb dadurch
     role/tabindex am Pfeil leer und der offene Zustand waere nach einem
     Neuzeichnen verloren gewesen. setTimeout wird gedrosselt, aber es
     feuert. Zusammenlegen tut es genauso. */
  var geplant = false;
  function anstossen() {
    if (geplant) return;
    geplant = true;
    setTimeout(function () {
      geplant = false;
      pfeileHerrichten();
      wiederherstellen();
    }, 0);
  }

  function beobachten() {
    var liste = document.getElementById('sidebar');
    if (!liste) return setTimeout(beobachten, 200);
    new MutationObserver(anstossen).observe(liste, { childList: true, subtree: true });
    new MutationObserver(anstossen).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-ui-cards']
    });
    anstossen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', beobachten);
  } else {
    beobachten();
  }

  window.DealPilotKartenKompakt = {
    /* Fuer die Messung im Browser und fuer Tastaturbedienung von aussen. */
    toggle: function (key) {
      var k = document.querySelector('#sidebar .sb-card[data-key="' + String(key).replace(/"/g, '\\"') + '"]');
      umschalten(k);
    },
    alleZu: function () {
      OFFEN = Object.create(null);
      wiederherstellen();
    },
    offen: function () { return Object.keys(OFFEN); }
  };
})();
