/* ═══════════════════════════════════════════════════════════════════════
   hell-varianten.js · v1517
   ───────────────────────────────────────────────────────────────────────
   Marcel am 22.09.2026: "Zum Hellmodus haette ich ganz gerne mal: kannst du
   mir die Varianten zum Umschalten mal in die App bauen, dass ich mir das
   anschauen kann, wie das fuer mich wirkt? ... Es waere auch gut, wenn wir
   das Ganze im Header-Bereich dann auch so mit umschalten koennten."

   Gemessen im Profil kanzlei, bevor hier etwas gebaut wurde:
     Seite       #F7F5F1
     Seitenleiste #FBFAF7
     Objektkarte  #F5EDD8   <- ein kraeftiger Sandton
     Kartenrahmen #E4D6AE
     Schatten     keiner
   Drei Cremetoene uebereinander, ohne Schatten - deshalb heben sich die
   Karten nicht ab. Genau diese Werte aendert jede Variante, dazu die
   Kopfleiste und die Reiterzeile.

   Der Umschalter ist ein WERKZEUG zum Ansehen, keine Funktion fuer Kunden:
   er erscheint nur in den hellen Profilen und nur, wenn er ausdruecklich
   eingeschaltet wurde (Tastenfolge oder ?karten=1). Er setzt
   <html data-dp-karte="v1..v6"> und merkt sich das in localStorage.
   Ohne Attribut aendert sich nichts - die Seite sieht aus wie heute.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SCHLUESSEL = 'dp_karten_variante';
  var SCHALTER_AN = 'dp_karten_schalter';
  var HELL = ['kontor', 'panel', 'kanzlei', 'boarding'];

  var VARIANTEN = [
    ['', 'Heute', 'unveraendert'],
    ['v1', 'Weiss auf Creme', 'Karte weiss, Creme nur als Grund'],
    ['v2', 'Goldkante links', 'wie ein Aktenreiter'],
    ['v3', 'Deutlicher Rahmen', 'staerkere Kante, echter Schatten'],
    ['v4', 'Ohne Creme', 'kuehles Grau statt Sand'],
    ['v5', 'Mit Kopfleiste', 'Creme nur noch im Band'],
    ['v6', 'Ruhige Liste', 'Linien statt Kaesten'],
  ];

  function istHell() {
    var p = document.documentElement.getAttribute('data-ui-theme') || '';
    return HELL.indexOf(p) >= 0;
  }
  function lies(k, f) { try { return localStorage.getItem(k) || f; } catch (e) { return f; } }
  function schreib(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ── v1653e · DAS WERKZEUG TRITT ZURUECK, WENN EIN LAYOUT STEHT ────
     Gemessen am 28.09.2026 an der laufenden Kanzlei: am `<html>`
     standen VIER Gestaltungsschichten gleichzeitig -

       data-dp-layout="v2"        der Aufbau
       data-dp-kartenstil="trichter"  die Datenaufnahme
       data-ui-theme="kontor"     die Darstellung (Kundenfeature)
       data-dp-karte="v2"         DIESES Werkzeug

     Die 44 Regeln hier faerben Karten, Seitenleiste und Kopf - und
     ueberschreiben damit genau das, was der Aufbau gerade setzt. Marcel
     sah eine Kanzlei, die „nicht so aussieht, wie wir es besprochen
     haben", und der Grund war nicht eine falsche Regel, sondern eine
     Schicht zu viel.

     > Der Kopf dieser Datei sagt es selbst: „Der Umschalter ist ein
     > WERKZEUG zum Ansehen, keine Funktion fuer Kunden." **Ein Werkzeug
     > hat zurueckzutreten, wenn eine echte Ansicht danebensteht** -
     > sonst misst man wieder nur das Werkzeug.

     Der Merker bleibt erhalten: wer das Layout wieder auf „Heute"
     stellt, bekommt seine Kartenvariante zurueck. */
  function layoutAktiv() {
    return document.documentElement.hasAttribute('data-dp-layout');
  }

  function anwenden(v) {
    if (v && !layoutAktiv()) document.documentElement.setAttribute('data-dp-karte', v);
    else document.documentElement.removeAttribute('data-dp-karte');
    schreib(SCHLUESSEL, v || '');
    var p = document.getElementById('dp-kv-panel');
    if (p) {
      p.querySelectorAll('button[data-v]').forEach(function (b) {
        b.classList.toggle('an', (b.dataset.v || '') === (v || ''));
      });
    }
  }

  function panel() {
    if (document.getElementById('dp-kv-panel')) return;
    var d = document.createElement('div');
    d.id = 'dp-kv-panel';
    var h = '<div class="dp-kv-kopf">Kartenvariante'
      + '<button type="button" class="dp-kv-zu" title="Schliessen">&times;</button></div>';
    VARIANTEN.forEach(function (v) {
      h += '<button type="button" data-v="' + v[0] + '">'
        + '<b>' + v[1] + '</b><span>' + v[2] + '</span></button>';
    });
    h += '<div class="dp-kv-fuss">Nur zum Ansehen · wird nur bei dir gespeichert</div>';
    d.innerHTML = h;
    d.addEventListener('click', function (e) {
      if (e.target.closest('.dp-kv-zu')) { d.remove(); schreib(SCHALTER_AN, '0'); return; }
      var b = e.target.closest('button[data-v]');
      if (b) anwenden(b.dataset.v || '');
    });
    document.body.appendChild(d);
    anwenden(lies(SCHLUESSEL, ''));
  }

  function start() {
    if (!istHell()) return;
    /* v1527 · Marcel: "zu den Kartenvarianten würde ich zu ohne Creme
       tendieren". Also ist v4 die Vorauswahl - umschalten bleibt möglich,
       und wer schon etwas gewählt hat, behält seine Wahl. */
    anwenden(lies(SCHLUESSEL, null) === null ? 'v4' : lies(SCHLUESSEL, ''));
    var an = lies(SCHALTER_AN, '0') === '1'
      || /[?&]karten=1/.test(location.search);
    if (/[?&]karten=1/.test(location.search)) schreib(SCHALTER_AN, '1');
    if (an) panel();
  }

  /* Tastenfolge "kkk" blendet den Schalter ein oder aus - so bleibt er aus
     dem Weg, bis er gebraucht wird. */
  var folge = '';
  document.addEventListener('keydown', function (e) {
    var z = document.activeElement;
    if (z && /^(INPUT|TEXTAREA|SELECT)$/.test(z.tagName)) return;
    folge = (folge + (e.key || '')).slice(-3);
    if (folge !== 'kkk') return;
    folge = '';
    if (!istHell()) { if (typeof window.toast === 'function') window.toast('Nur in den hellen Ansichten'); return; }
    var p = document.getElementById('dp-kv-panel');
    if (p) { p.remove(); schreib(SCHALTER_AN, '0'); }
    else { schreib(SCHALTER_AN, '1'); panel(); }
  });

  /* v1653e: Wechselt der Aufbau, wird neu entschieden - sonst bliebe
     die Kartenvariante haengen, die beim Laden gesetzt wurde, und der
     Rueckweg auf „Heute" brachte sie nicht wieder. */
  if (window.MutationObserver) {
    new MutationObserver(function () {
      anwenden(lies(SCHLUESSEL, ''));
    }).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-dp-layout']
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotKartenVariante = { setze: anwenden, panel: panel, varianten: VARIANTEN };
})();
