/* ═══════════════════════════════════════════════════════════════════════
   objektkarten-stil.js · v1715 — die Entwürfe unter „Darstellung"

   Marcel am 30.09.2026, zweiter Durchgang:
     „bitte arbeite unter Darstellung auch den wechsel der Karten ein.
      Bau alle ein außer Status und Cockpit. Nehme die information
      Investor aus der Design Optik bei allen raus außer bei unserem
      standard Obsidian look. Das Fenster kannst du dann wieder
      entfernen."

   Drei Änderungen gegenüber v1714:

   1. Das schwebende Fenster ist WEG. Es war zum Ausprobieren gebaut
      („erst mal auf dem bildschirm zum umswitchen") und hat seinen
      Zweck erfüllt. Die Wahl steht jetzt dort, wo sie hingehört:
      Einstellungen → Darstellung → Aussehen.

      > Ein Werkzeug, das zum Ausprobieren gebaut wurde, wird nach dem
      > Ausprobieren abgebaut. Sonst steht es irgendwann in der
      > Auslieferung und niemand weiß mehr, warum.

   2. Status und Cockpit sind raus — Marcels Auswahl.

   3. Die INVESTOR-Lasche erscheint nur noch im Standard (Aktenreiter).
      In den anderen Entwürfen wäre sie ein Fremdkörper: sie gehört zur
      Aktenmetapher, nicht zu einer Datenzeile oder einer Ampel. Das
      steht in der CSS (layout-varianten.css, v1715).

   ── DAS ATTRIBUT ─────────────────────────────────────────────────────
   `data-dp-objkarte` am `<html>`, vorher gegrept: frei. Ohne Wahl bleibt
   der Aktenreiter — das leere Attribut ist der Istzustand und trägt
   keine Regel.

   ── NUR IN DEN LAYOUTS ───────────────────────────────────────────────
   Die Entwürfe formen die Karte in der Layout-SCHIENE. Ohne Layout gibt
   es sie nicht, also wird das Attribut dort auch nicht gesetzt.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__dpObjkarte) return;
  window.__dpObjkarte = true;

  var LS = 'dp_objkarte_stil';
  var ATTR = 'data-dp-objkarte';
  var HOST = 'dp-objkarte-wahl-host';

  /* v1724: die Wahl steht jetzt an ZWEI Orten - in den Einstellungen
     (ID, wie bisher) und im Darstellungs-Panel (Klasse). Marcel:
     "wenn wir das auch mit unter Darstellung oeffnen anbieten".

     Eine zweite ID waere ein Duplikat und der Browser nimmt dann still
     die erste - deshalb traegt der zweite Ort eine KLASSE. `hosts()`
     liefert beide, und jede Funktion arbeitet ueber die Liste statt
     ueber ein einzelnes Element. */
  function hosts() {
    return Array.prototype.slice.call(document.querySelectorAll('#' + HOST + ', .' + HOST));
  }

  var STILE = {
    '':          { name: 'Aktenreiter', sub: 'Lasche mit Objektnummer · Standard' },
    bordkarte:   { name: 'Bordkarte',   sub: 'Abriss links, Nummer hochkant' },
    kante:       { name: 'Score-Kante', sub: 'Farbiger Strich statt Ring' },
    datenzeile:  { name: 'Datenzeile',  sub: 'Mono, eine Zeile, bündig' },
    ampel:       { name: 'Ampel',       sub: 'Ein Punkt sagt die Stufe' },
    kennzahlen:  { name: 'Kennzahlen',  sub: 'Preis, Rendite, Cashflow' },
    minimal:     { name: 'Minimal',     sub: 'Nur Adresse und Ring' }
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
    wahlNachziehen();
  }

  /* ── Die Wahl in den Einstellungen ─────────────────────────────────
     Gebaut wird in `#dp-objkarte-wahl-host`, den `settings.js` im
     Abschnitt „Aussehen" anlegt — genau wie bei der Layout-Wahl (v1697).
     Die Farben stehen im CSS, nicht hier: eine Marke, die im JS klebt,
     färbt sich beim Mandanten nicht um. */
  function baueWahl() {
    hosts().forEach(function (host) {
    if (!host || host.getAttribute('data-gebaut') === '1') return;
    host.setAttribute('data-gebaut', '1');
    host.innerHTML =
      '<div class="dp-okw-box">' +
        '<div class="dp-okw-kopf">Objektkarten in der Liste</div>' +
        '<div class="dp-okw-gitter">' +
          Object.keys(STILE).map(function (k) {
            return '<button type="button" class="dp-okw" data-ok="' + k + '">' +
                     '<span class="dp-okw-n">' + STILE[k].name + '</span>' +
                     '<span class="dp-okw-s">' + STILE[k].sub + '</span>' +
                   '</button>';
          }).join('') +
        '</div>' +
        '<div class="dp-okw-fuss">Wirkt in den Layouts Aktenmappe, Kanzlei und Tower — ' +
        'die normale Ansicht bleibt, wie sie ist.</div>' +
      '</div>';
    host.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dp-okw') : null;
      if (!b) return;
      setze(b.getAttribute('data-ok'));
    });
    });
    wahlNachziehen();
  }

  function wahlNachziehen() {
    hosts().forEach(function (host) {
      host.querySelectorAll('.dp-okw').forEach(function (b) {
        b.classList.toggle('an', b.getAttribute('data-ok') === aktuell);
      });
    });
  }

  /* Der Abschnitt „Aussehen" wird erst beim Öffnen der Einstellungen
     gebaut. Ein Beobachter hängt die Wahl ein, sobald der Host da ist -
     ein Timer würde raten, wann das ist. */
  function hostBeobachten() {
    if (hosts().length) baueWahl();
    if (!window.MutationObserver) return;
    new MutationObserver(function () {
      if (hosts().length) baueWahl();
    }).observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    var p = new URLSearchParams(location.search);
    var ausUrl = p.get('objkarte');
    var gemerkt = '';
    try { gemerkt = localStorage.getItem(LS) || ''; } catch (e) {}

    if (ausUrl !== null) setze(ausUrl === 'aus' ? '' : ausUrl);
    else setze(gemerkt);

    /* v1715: der Merker des alten Schwebefensters wird abgeräumt. Wer ihn
       noch trägt, bekäme sonst nie etwas zu sehen und wüsste nicht,
       warum - das Fenster gibt es nicht mehr. */
    try { localStorage.removeItem('dp_objkarte_schalter'); } catch (e) {}
    try {
      var alt = document.getElementById('dp-ok-schalter');
      if (alt) alt.remove();
    } catch (e) {}

    hostBeobachten();

    /* Wechselt das Layout, wird neu entschieden: ohne Layout keine
       Schiene, und dann darf das Attribut nicht stehen bleiben. */
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
    aktuell: function () { return aktuell; }
  };
})();
