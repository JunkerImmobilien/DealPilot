'use strict';
/**
 * landing-mobile.js — einklappbare Leistungsliste in den Preistickets
 *
 * Laeuft NACH landing-motion.js und promo-erstflug.js (Reihenfolge in
 * index.html). Beide fassen .tk-price / .tk-note / .tk-rip an, keiner baut die
 * <ul class="tk-feat"> neu — dieses Modul kann also einmal laufen und liegen
 * bleiben.
 *
 * Aufteilung mit Absicht:
 *   JS setzt nur die Klasse .tkf-collapsed und haengt den Knopf an.
 *   Das AUSBLENDEN macht CSS in einer @media-Regel.
 * Dadurch verhaelt sich Drehen oder Fenstergroesse-Aendern von allein richtig,
 * ohne resize-Listener und ohne dass hier Breiten gemessen werden.
 */
(function () {

  var KEEP = 2;                 /* so viele Punkte bleiben sichtbar */
  var MARK = 'data-tkf';        /* Idempotenz: zweimaliges Laufen tut nichts */

  function label(n, open) {
    return open
      ? 'Weniger anzeigen<span class="chev">\u25be</span>'
      : 'Alle ' + n + ' Leistungen<span class="chev">\u25be</span>';
  }

  function build(ul) {
    if (!ul || ul.getAttribute(MARK)) return;

    var items = Array.prototype.filter.call(ul.children, function (n) {
      return n.tagName === 'LI';
    });
    if (items.length <= KEEP) return;          /* nichts zu verbergen */

    ul.setAttribute(MARK, '1');
    ul.classList.add('tkf-collapsed');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tkf-more';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = label(items.length, false);

    /* Der Knopf gehoert direkt hinter die Liste — vor die CTA, damit die
       Reihenfolge Preis -> Leistungen -> Aktion erhalten bleibt. */
    if (ul.parentNode) ul.parentNode.insertBefore(btn, ul.nextSibling);

    btn.addEventListener('click', function () {
      var open = ul.classList.toggle('tkf-collapsed') === false;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.innerHTML = label(items.length, open);
    });
  }

  function run() {
    try {
      var host = document.getElementById('pricing');
      if (!host) return;
      Array.prototype.forEach.call(host.querySelectorAll('ul.tk-feat'), build);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();

/**
 * Fassung 2 — drehbare Modulkarten
 *
 * Die 19 Karten in #feats entstehen zur Laufzeit per innerHTML aus einem
 * Inline-Skript in index.html. Statt diesen Generator anzufassen (Anker mitten
 * in einem 4.000-Zeilen-Block), wird hier die FERTIGE Karte umgebaut:
 *
 *   vorher:  .bp > [ .bp-top, .bp-main, .bp-perf, .bp-stub ]
 *   nachher: .bp > .bp-flip > [ .bp-face.bp-front > (die alten Kinder)
 *                               .bp-face.bp-back  > (Titel + Punkte + Abriss) ]
 *
 * Der Umbau laeuft auf JEDER Breite — die Wrapper sind im CSS ausserhalb des
 * Handy-Breakpoints schlicht durchlaessig und die Rueckseite ausgeblendet.
 * Dadurch bleibt der Desktop bitgleich zu vorher, ohne dass hier Breiten
 * gemessen oder resize-Ereignisse abgefangen werden muessten.
 */
(function () {

  var MARK = 'data-bpflip';

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function flipify(bp) {
    if (!bp || bp.getAttribute(MARK)) return;

    var feats = bp.querySelector('.bp-feats');
    var title = bp.querySelector('h3');
    var stub  = bp.querySelector('.bp-stub');
    if (!feats) return;                       /* ohne Punkte keine Rueckseite */

    bp.setAttribute(MARK, '1');

    var flip  = el('div', 'bp-flip');
    var front = el('div', 'bp-face bp-front');
    var back  = el('div', 'bp-face bp-back');

    /* Vorderseite = alles, was bisher direkt in .bp lag */
    while (bp.firstChild) front.appendChild(bp.firstChild);

    /* Rueckseite aus denselben Daten aufbauen */
    var top = front.querySelector('.bp-top');
    if (top) back.appendChild(top.cloneNode(true));

    var main = el('div', 'bp-main');
    if (title) {
      var t = el('div', 'bp-title');
      t.textContent = title.textContent;
      main.appendChild(t);
    }
    main.appendChild(feats.cloneNode(true));

    var turnBack = el('div', 'bp-turn');
    turnBack.innerHTML = '<span class="r">\u21BB</span> zur\u00fcck';
    main.appendChild(turnBack);
    back.appendChild(main);

    var perf = front.querySelector('.bp-perf');
    if (perf) back.appendChild(perf.cloneNode(true));
    if (stub) back.appendChild(stub.cloneNode(true));

    /* Drehhinweis auf die Vorderseite */
    var n = feats.querySelectorAll('li').length;
    var turn = el('div', 'bp-turn');
    turn.innerHTML = '<span class="r">\u21BB</span> ' + n + ' Details';
    var fmain = front.querySelector('.bp-main');
    if (fmain) fmain.appendChild(turn);

    flip.appendChild(front);
    flip.appendChild(back);
    bp.appendChild(flip);

    /* Bedienung */
    bp.setAttribute('tabindex', '0');
    bp.setAttribute('role', 'button');
    bp.setAttribute('aria-pressed', 'false');
    if (title) bp.setAttribute('aria-label', title.textContent + ' \u2014 Details anzeigen');

    function toggle() {
      var on = bp.classList.toggle('is-flipped');
      bp.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    bp.addEventListener('click', toggle);
    bp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }

  /* Der Generator laeuft in einem Inline-Skript. Je nach Ladereihenfolge sind
     die Karten beim DOMContentLoaded schon da oder nicht — deshalb ein paar
     kurze Nachfassversuche statt einer festen Wartezeit. */
  function run(tries) {
    var host = document.getElementById('feats');
    if (!host) return;
    var cards = host.querySelectorAll('.bp');
    if (!cards.length) {
      if (tries > 0) setTimeout(function () { run(tries - 1); }, 120);
      return;
    }
    Array.prototype.forEach.call(cards, flipify);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { run(10); });
  } else {
    run(10);
  }

})();

/**
 * Fassung 3 — Handy-Menue und Zurueck-nach-oben
 *
 * KERNPUNKT: Die Klick-Handler der Navigation haengen in index.html (Z.1502/1503)
 * EINZELN an jedem <a>, nicht delegiert:
 *     querySelectorAll('[data-scroll]').forEach(el => el.addEventListener(...))
 * Ein Klon traegt diese Handler NICHT — er waere tot. Das Menue zeigt deshalb
 * Klone, loest beim Tippen aber den ORIGINALLINK aus (original.click()).
 * Dadurch laeuft exakt dieselbe Mechanik wie am Desktop, ohne dass hier Scroll-
 * oder View-Logik nachgebaut wird. Kommt spaeter ein Navigationspunkt dazu,
 * steht er automatisch auch im Handy-Menue.
 */
(function () {

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  /* ── Menue ──────────────────────────────────────────────────────────── */
  function buildMenu() {
    var navIn = document.querySelector('.nav-in');
    var links = document.querySelectorAll('.nav-links a');
    if (!navIn || !links.length || document.querySelector('.nav-burger')) return;

    var burger = el('button', 'nav-burger');
    burger.type = 'button';
    burger.setAttribute('aria-label', 'Men\u00fc \u00f6ffnen');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<i></i><i></i><i></i>';
    navIn.appendChild(burger);

    var sheet = el('nav', 'nav-sheet');
    sheet.setAttribute('aria-label', 'Hauptmen\u00fc');

    Array.prototype.forEach.call(links, function (orig) {
      var a = el('a', orig.classList.contains('nav-cta') ? 'sheet-cta' : '');
      a.textContent = (orig.textContent || '').trim();
      a.href = orig.getAttribute('href') || '#';
      a.addEventListener('click', function (e) {
        /* Echte Links (z.B. der CTA zur App) duerfen normal navigieren.
           Alles mit data-scroll/data-view laeuft ueber das Original. */
        if (orig.hasAttribute('data-scroll') || orig.hasAttribute('data-view')) {
          e.preventDefault();
          close();
          setTimeout(function () { orig.click(); }, 220);   /* nach der Blende */
        } else {
          close();
        }
      });
      sheet.appendChild(a);
    });
    document.body.appendChild(sheet);

    function open() {
      sheet.classList.add('on');
      burger.classList.add('on');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Men\u00fc schlie\u00dfen');
      document.body.classList.add('nav-open');
    }
    function close() {
      sheet.classList.remove('on');
      burger.classList.remove('on');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Men\u00fc \u00f6ffnen');
      document.body.classList.remove('nav-open');
    }
    burger.addEventListener('click', function () {
      sheet.classList.contains('on') ? close() : open();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('on')) close();
    });
    /* Fensterbreite waechst ueber den Breakpoint -> Sperre nicht haengen lassen */
    window.addEventListener('resize', function () {
      if (window.innerWidth > 620 && sheet.classList.contains('on')) close();
    });
  }

  /* ── Zurueck nach oben ──────────────────────────────────────────────── */
  function buildTop() {
    if (document.querySelector('.to-top')) return;
    var b = el('button', 'to-top');
    b.type = 'button';
    b.setAttribute('aria-label', 'Nach oben');
    b.innerHTML = '\u2191';
    document.body.appendChild(b);

    b.addEventListener('click', function () {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (e) { window.scrollTo(0, 0); }
    });

    var shown = false, tick = false;
    function check() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var want = y > 700;
      if (want !== shown) { shown = want; b.classList.toggle('on', want); }
      tick = false;
    }
    window.addEventListener('scroll', function () {
      if (!tick) { tick = true; requestAnimationFrame(check); }
    }, { passive: true });
    check();
  }

  function run() { buildMenu(); buildTop(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
