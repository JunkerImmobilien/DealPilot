/* ═══════════════════════════════════════════════════════════════════════
   objektkarten-stil.js · v1714 — die Entwürfe zum Umschalten

   Marcel am 30.09.2026: „bei den Objektkarten möchte ich dass du mir die
   anderen auch baust zum wechseln. erst mal auf dem bildschirm zum
   umswitchen."

   Gemeint sind die zehn Entwürfe aus `design/mockups/
   objektkarten-schiene-v1707.html`. Gebaut ist bisher Nummer 02, der
   Aktenreiter (v1709–v1712). Die übrigen kommen hier dazu — als
   WÄHLBARE Varianten, nicht als Ersatz.

   ── WARUM EIN EIGENES ATTRIBUT ────────────────────────────────────────
   `data-dp-objkarte` am `<html>`. Vorher gegrept, wie CLAUDE.md es
   verlangt: der Name ist frei. Belegt sind bereits `data-bg`,
   `data-dp-karte` (hell-varianten.js), `data-dpl-portfolio`,
   `data-flyer-code`, `data-dp-layout`, `data-dp-kartenstil`,
   `data-ui-cards`, `data-ui-form`.

   > Sieben Gestaltungsattribute liegen damit gleichzeitig am `<html>`.
   > Das ist viel — aber ein achtes mit einem schon belegten Namen wäre
   > schlimmer: zwei Module auf einem Attribut löschen sich lautlos.

   ── DER STANDARD TRÄGT KEIN ATTRIBUT ─────────────────────────────────
   Ohne Wahl bleibt der Aktenreiter. Das leere Attribut ist der
   Istzustand und trägt keine Regel — derselbe Grundsatz wie in
   `karten-stil.js` und `layout-varianten.js`.

   ── NUR IN DEN LAYOUTS ───────────────────────────────────────────────
   Die Entwürfe formen die Karte in der Layout-SCHIENE. In der normalen
   Ansicht gibt es die Schiene nicht, also wird das Attribut dort auch
   nicht gesetzt — sonst stünde eine halb aufgetragene Gestaltung da.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__dpObjkarte) return;
  window.__dpObjkarte = true;

  var LS = 'dp_objkarte_stil';
  var ATTR = 'data-dp-objkarte';

  var STILE = {
    '':          { name: 'Aktenreiter', sub: 'Lasche mit Objektnummer (Standard)' },
    bordkarte:   { name: 'Bordkarte',   sub: 'Abriss links, Jahr hochkant' },
    kante:       { name: 'Score-Kante', sub: 'Farbiger Strich statt Ring' },
    datenzeile:  { name: 'Datenzeile',  sub: 'Mono, eine Zeile, bündig' },
    ampel:       { name: 'Ampel',       sub: 'Ein Punkt sagt die Stufe' },
    kennzahlen:  { name: 'Kennzahlen',  sub: 'Preis, Rendite, Cashflow' },
    minimal:     { name: 'Minimal',     sub: 'Nur Adresse und Ring' },
    status:      { name: 'Status',      sub: 'Deal-Stufe zuerst' },
    cockpit:     { name: 'Cockpit',     sub: 'Score als Rundinstrument' }
  };

  var aktuell = '';

  function layoutAktiv() {
    return document.documentElement.hasAttribute('data-dp-layout');
  }

  function setze(stil) {
    aktuell = (stil && STILE[stil]) ? stil : '';
    var h = document.documentElement;
    if (aktuell && layoutAktiv()) h.setAttribute(ATTR, aktuell);
    else h.removeAttribute(ATTR);
    try { localStorage.setItem(LS, aktuell); } catch (e) {}
    schalterNachziehen();
  }

  /* ── Der Schalter ──────────────────────────────────────────────────
     Ein Panel auf dem Bildschirm, wie `DealPilotLayout.schalter()`. Er
     ist zum AUSPROBIEREN da, nicht zum Ausliefern - deshalb erscheint er
     nur, wenn er ausdrücklich angefordert wurde (Merker oder Aufruf). */
  var MERKER = 'dp_objkarte_schalter';

  function baueSchalter() {
    if (document.getElementById('dp-ok-schalter')) return;
    var box = document.createElement('div');
    box.id = 'dp-ok-schalter';
    box.className = 'dp-ok-schalter';
    box.innerHTML =
      '<div class="dp-ok-kopf">' +
        '<span class="dp-ok-t">Objektkarte</span>' +
        '<button type="button" class="dp-ok-zu" id="dp-ok-zu" title="Schließen">✕</button>' +
      '</div>' +
      '<div class="dp-ok-liste">' +
        Object.keys(STILE).map(function (k) {
          return '<button type="button" class="dp-ok-w" data-ok="' + k + '">' +
                   '<span class="dp-ok-n">' + STILE[k].name + '</span>' +
                   '<span class="dp-ok-s">' + STILE[k].sub + '</span>' +
                 '</button>';
        }).join('') +
      '</div>' +
      '<div class="dp-ok-fuss">Nur in den Layouts. Die Wahl bleibt gemerkt.</div>';
    document.body.appendChild(box);

    box.addEventListener('click', function (e) {
      var zu = e.target.closest ? e.target.closest('#dp-ok-zu') : null;
      if (zu) { box.remove(); try { localStorage.removeItem(MERKER); } catch (x) {} return; }
      var b = e.target.closest ? e.target.closest('.dp-ok-w') : null;
      if (!b) return;
      setze(b.getAttribute('data-ok'));
    });
    schalterNachziehen();
  }

  function schalterNachziehen() {
    var box = document.getElementById('dp-ok-schalter');
    if (!box) return;
    box.querySelectorAll('.dp-ok-w').forEach(function (b) {
      b.classList.toggle('an', b.getAttribute('data-ok') === aktuell);
    });
  }

  function start() {
    var p = new URLSearchParams(location.search);
    var ausUrl = p.get('objkarte');
    var gemerkt = '';
    try { gemerkt = localStorage.getItem(LS) || ''; } catch (e) {}

    if (ausUrl !== null) setze(ausUrl === 'aus' ? '' : ausUrl);
    else setze(gemerkt);

    /* Der Schalter erscheint, wenn er einmal angefordert wurde - über
       `?objkarte-schalter`, den Merker oder den Aufruf von außen. */
    var will = p.has('objkarte-schalter');
    if (!will) { try { will = localStorage.getItem(MERKER) === '1'; } catch (e) {} }
    if (will) {
      try { localStorage.setItem(MERKER, '1'); } catch (e) {}
      baueSchalter();
    }

    /* Wechselt das Layout, wird neu entschieden: ohne Layout gibt es
       keine Schiene, und dann darf das Attribut nicht stehen bleiben. */
    if (window.MutationObserver) {
      new MutationObserver(function () { setze(aktuell); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-dp-layout'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotObjektkarte = {
    setze: setze,
    stile: STILE,
    aktuell: function () { return aktuell; },
    schalter: function () {
      try { localStorage.setItem(MERKER, '1'); } catch (e) {}
      baueSchalter();
    }
  };
})();
