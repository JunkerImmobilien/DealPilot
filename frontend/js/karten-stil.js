/* ═══════════════════════════════════════════════════════════════════════
   karten-stil.js · v1651 — die Datenaufnahme bekommt eine zweite Achse

   Marcel am 28.09.2026: „Und ich finde auch, den Entwurf, den Trichter,
   den könnten wir auch machen. Und wir wollten ja auch, dass wir die
   unterschiedlichen Stile dann wechseln können und allem. Auch bei der
   Pre-Flight-Karte, die ja jetzt umbenannt wird, oder Bordkarte."

   ── WAS HIER GETRENNT WIRD ───────────────────────────────────────────
   Der AUFBAU (`layout-varianten.js`, `data-dp-layout`) sagt, WO Menü,
   Aktionen und Objektliste stehen. Der STIL sagt, WIE die
   Datenaufnahme-Karte im Objekt aussieht. Das sind zwei Fragen, und wer
   sie in einen Schalter presst, kann die eine nicht ohne die andere
   beantworten.

   ── WARUM DAS ATTRIBUT `data-dp-kartenstil` HEISST UND NICHT
      `data-dp-karte` ───────────────────────────────────────────────────
   Weil `data-dp-karte` schon vergeben war. `hell-varianten.js` (v1517,
   22.09.2026) führt darunter sechs Kartenvarianten `v1`…`v6`, mit 44
   Regeln in `hell-varianten.css`.

   Ich hatte den Namen am 28.09. blind genommen. **Zwei Module, die auf
   dasselbe Attribut schreiben, löschen sich gegenseitig** - wer den
   Kartenstil wählt, verliert die Hellvariante und umgekehrt, ohne dass
   irgendwo etwas widerspricht.

   Aufgefallen ist es nicht am Umschalten, sondern bei einer
   Bedienbarkeitsmessung auf 390 px: `#dp-kv-panel`, das Werkzeugfenster
   jenes anderen Moduls, lag über der Datenaufnahme und verdeckte drei
   von vier Kacheln. Erst beim Nachsehen, WOHER dieses Panel kommt, kam
   die Namenskollision ans Licht.

   > **Bevor ein neuer Schalter einen Namen bekommt, wird gegrept.**
   > CLAUDE.md sagt „Namensräume nie mischen" - das gilt auch für
   > Attributnamen, nicht nur für Versionsnummern.

   Deshalb ein eigenes Attribut am `<html>`:

     (kein Attribut)  automatisch — wie bisher: hell → Zeile, sonst die
                      Obsidian-Bordkarte im Auslieferungszustand
     zeile            Entwurf 1, die 55-px-Zeile (seit v1639)
     trichter         Entwurf 4 — links die Quellen, rechts was daraus
                      wird
     bordkarte        Entwurf 5 — die Metapher, aber nur das, was etwas
                      bedeutet: der Abriss trennt Wählen von Auslösen

   > **Wer nicht umschaltet, bekommt die App so, wie er sie kennt.** Das
   > leere Attribut ist der Istzustand und trägt KEINE Regel. Derselbe
   > Grundsatz wie in `ui-varianten.js` und `layout-varianten.js`.

   ── WARUM DER TRICHTER JS BRAUCHT UND DIE BORDKARTE NICHT ────────────
   Die Bordkarte ordnet nur um, was schon dasteht — `.dp-pf-perf` ist
   die Perforation, sie war bloss versteckt. Reines CSS.

   Der Trichter dagegen zeigt rechts, WAS aus den Quellen wird. Diese
   drei Zeilen gibt es im DOM nicht; `content:` in einem Pseudoelement
   wäre Nutztext in einem Kommentarfach. Also baut dieses Modul den
   Block — und räumt ihn wieder ab, wenn der Stil wechselt.

   `object-actions.js` rendert die Leiste bei jedem Objektwechsel neu
   und wirft den Block dabei weg. Ein Beobachter hängt ihn wieder ein.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LS = 'dp_karten_stil';
  var STILE = {
    zeile:     { name: 'Zeile',     sub: 'Eine Leiste, 55 px' },
    trichter:  { name: 'Trichter',  sub: 'Quellen links, Ergebnis rechts' },
    bordkarte: { name: 'Bordkarte', sub: 'Abriss trennt Wählen und Abrufen' },
    kartei:    { name: 'Kartei',    sub: 'Kopfzeile, Quellen, Fusszeile' }
  };

  var aktuell = '';
  var wache = null;

  /* ── Der Ertragsblock des Trichters ───────────────────────────────
     Was dabei herauskommt. Drei Zeilen, keine Zahlen — Zahlen wären
     eine Behauptung, solange nichts abgerufen wurde. */
  var ERTRAG = [
    ['Adresse, Fläche, Baujahr', 'Objektdaten'],
    ['Kaufpreis und Miete',      'Investition'],
    ['Marktwert und Spanne',     'Bewertung']
  ];

  /* Der Abrufknopf steckt in `.dp-pf-rz`. Im Trichter gehört er unter
     den Ertragsblock — also wird er umgehängt. Sein Platz wird exakt
     gemerkt (Elternteil PLUS nächster Geschwister), sonst landet er
     beim Zurückschalten irgendwo am Ende. */
  var rzHeimat = null;

  function ertragBauen(bar) {
    if (!bar || bar.querySelector('.dpk-ertrag')) return;
    var e = document.createElement('div');
    e.className = 'dpk-ertrag';
    e.innerHTML = '<span class="dpk-ertrag-titel">Was dabei herauskommt</span>'
      + ERTRAG.map(function (z) {
          return '<span class="dpk-ertrag-zeile"><span>' + z[0]
            + '</span><span class="dpk-ertrag-was">' + z[1] + '</span></span>';
        }).join('');
    bar.appendChild(e);

    var rz = bar.querySelector('.dp-pf-rz');
    if (rz) {
      if (!rzHeimat) rzHeimat = { eltern: rz.parentNode, naechster: rz.nextSibling };
      e.appendChild(rz);
    }
  }

  function ertragAbraeumen() {
    /* Erst den Knopf heimschicken, dann den Block entfernen - sonst
       nimmt der Block ihn mit. */
    if (rzHeimat && rzHeimat.eltern) {
      var rz = document.querySelector('.dp-pf-rz');
      if (rz) {
        if (rzHeimat.naechster && rzHeimat.naechster.parentNode === rzHeimat.eltern) {
          rzHeimat.eltern.insertBefore(rz, rzHeimat.naechster);
        } else {
          rzHeimat.eltern.appendChild(rz);
        }
      }
      rzHeimat = null;
    }
    [].forEach.call(document.querySelectorAll('.dpk-ertrag'), function (e) { e.remove(); });
  }

  /* ── Die Zählung „n Quellen gewählt" der Bordkarte ────────────────
     Sie steht im Entwurf als kleine Zeile unter dem Knopf. Eine Zahl,
     die nicht mitzählt, ist schlimmer als keine - deshalb hängt sie an
     denselben Kacheln, die der Abruf liest (`.dp-pf-tile input`). */
  function zaehlung(bar) {
    if (!bar) return;
    var rz = bar.querySelector('.dp-pf-rz');
    if (!rz) return;
    var z = rz.querySelector('.dpk-zahl');
    if (aktuell !== 'bordkarte') { if (z) z.remove(); return; }
    if (!z) {
      z = document.createElement('small');
      z.className = 'dpk-zahl';
      rz.appendChild(z);
    }
    var n = bar.querySelectorAll('.dp-pf-tile input:checked').length;
    var neu = n === 1 ? '1 Quelle gewählt' : n + ' Quellen gewählt';
    /* NUR schreiben, wenn sich etwas ändert. Siehe `anwenden()`. */
    if (z.textContent !== neu) z.textContent = neu;
  }

  /* ── v1659 · Die Zählung der Kartei ───────────────────────────────
     Der Entwurf 2 führt sie rechts in der KOPFZEILE als „1 von 4
     gewählt" - nicht unter dem Knopf wie die Bordkarte. Gesetzt wird
     sie als Attribut an `.dp-pf-lead`, die CSS zeigt sie über
     `attr()`; so bleibt der Text an einer Stelle und die Kopfzeile
     braucht kein zusätzliches Element. */
  function karteiZaehlung(bar) {
    if (!bar) return;
    var lead = bar.querySelector('.dp-pf-lead');
    if (!lead) return;
    if (aktuell !== 'kartei') {
      if (lead.hasAttribute('data-dpk-wahl')) lead.removeAttribute('data-dpk-wahl');
      return;
    }
    var alle = bar.querySelectorAll('.dp-pf-tile input').length;
    var n = bar.querySelectorAll('.dp-pf-tile input:checked').length;
    var neu = n + ' von ' + alle + ' gewählt';
    if (lead.getAttribute('data-dpk-wahl') !== neu) {
      lead.setAttribute('data-dpk-wahl', neu);
    }
  }

  /* ── v1657 · Die Objektnummer in den Kopf der Bordkarte ───────────
     Der Entwurf zeigt sie rechts in der Kopfzeile („Objekt 2026-1637")
     und beantwortet damit, wofür hier abgerufen wird. Bei einer Karte,
     die man aus einer Liste heraus öffnet, ist das keine Zierde.

     Gelesen wird `#hdr-obj-num` - dieselbe Quelle wie im Kopf, nicht
     eine zweite. Gesetzt als Attribut, damit die CSS sie über `attr()`
     zeigen kann; so bleibt der Text an EINER Stelle. */
  function objektnummerSetzen(bar) {
    if (!bar) return;
    var lead = bar.querySelector('.dp-pf-lead');
    if (!lead) return;
    var num = document.getElementById('hdr-obj-num');
    var txt = num ? (num.textContent || '').trim().replace(/\s*✎\s*$/, '') : '';
    var neu = txt ? 'Objekt ' + txt : '';
    if (lead.getAttribute('data-dpk-objekt') !== neu) {
      lead.setAttribute('data-dpk-objekt', neu);
    }
  }

  /* ── Anwenden ─────────────────────────────────────────────────────
     > **Ein Beobachter, der auf seine eigenen Änderungen reagiert,
     > ist eine Endlosschleife.** Genau das ist am 28.09.2026 passiert:
     > `zaehlung()` setzte bei der Bordkarte jedes Mal `textContent`,
     > der Beobachter (`childList`, `subtree`) feuerte darauf, rief
     > `anwenden()`, und der Browser-Tab fror ein - kein Fehler in der
     > Konsole, keine Meldung, nur Stille.
     >
     > Zwei Riegel, weil einer allein von der nächsten Änderung wieder
     > aufgehoben werden kann: die Zählung schreibt nur bei echter
     > Änderung (oben), UND der Beobachter ist abgeklemmt, solange hier
     > gearbeitet wird. */
  var inArbeit = false;
  function anwenden() {
    if (inArbeit) return;
    inArbeit = true;
    if (wache) wache.disconnect();
    try {
      var bar = document.getElementById('oab-bar');
      if (aktuell === 'trichter') { ertragBauen(bar); } else { ertragAbraeumen(); }
      zaehlung(bar);
      objektnummerSetzen(bar);
      karteiZaehlung(bar);
    } catch (e) {
      try { console.warn('[karten-stil]', e); } catch (e2) {}
    }
    inArbeit = false;
    /* Erst im nächsten Bild wieder zuhören - sonst stehen die eigenen
       Änderungen schon in der Warteschlange des Beobachters. */
    if (wache) {
      var w = wache;
      (window.requestAnimationFrame || setTimeout)(function () {
        if (w === wache && document.body) {
          w.observe(document.body, { childList: true, subtree: true });
        }
      }, 0);
    }
  }

  /* ── v1660 · DER STIL GILT NUR IN EINEM LAYOUT ────────────────────
     Marcel: „wenn ich auf heute zurueckschalte, sieht es nicht so aus
     wie heute … und auch die Pre-Flight-Karte soll die alte sein."

     Gemessen nach dem Zurueckschalten: `data-dp-kartenstil="kartei"`
     stand weiterhin am `<html>`, die Leiste war 266 px hoch und weiss -
     die Kartei, nicht die alte Bordkarte.

     > **Der Merker ueberlebt das Layout, die WIRKUNG darf es nicht.**
     > „Heute" heisst Auslieferungszustand, und der kennt keinen
     > Kartenstil. Wer spaeter wieder ein Layout waehlt, bekommt seinen
     > Stil zurueck - der Merker bleibt ja.

     Dasselbe Prinzip wie bei `hell-varianten.js` in v1653e: eine
     Schicht, die neben einer echten Ansicht weiterfaerbt, macht jede
     Abnahme wertlos. */
  function layoutAktiv() {
    return document.documentElement.hasAttribute('data-dp-layout');
  }

  function setze(stil) {
    aktuell = STILE[stil] ? stil : '';
    var h = document.documentElement;
    if (aktuell && layoutAktiv()) h.setAttribute('data-dp-kartenstil', aktuell);
    else h.removeAttribute('data-dp-kartenstil');

    /* Zeile, Trichter und Bordkarte sind alle drei die HELLE Karte -
       sie setzen alle `dp-neue-karte` voraus. Ohne diese Marke greift
       keine der 46 Grundregeln, und der Stil sähe aus wie ein halb
       aufgetragener Anstrich. */
    if (document.body) document.body.classList.toggle('dp-neue-karte-stil', !!aktuell);

    try { localStorage.setItem(LS, aktuell); } catch (e) {}
    anwenden();

    if (window.DealPilotLayout && typeof window.DealPilotLayout.karteMarke === 'function') {
      try { window.DealPilotLayout.karteMarke(); } catch (e) {}
    }
  }

  /* ── Der Beobachter ───────────────────────────────────────────────
     `object-actions.js` baut die Leiste bei jedem Objektwechsel neu.
     Ohne Beobachter ist der Trichter nach dem ersten Klick auf ein
     anderes Objekt wieder eine Zeile - und das sieht aus wie ein
     Fehler, nicht wie ein Stil. */
  function beobachten() {
    if (wache || !window.MutationObserver) return;
    wache = new MutationObserver(function () { if (aktuell) anwenden(); });
    wache.observe(document.body, { childList: true, subtree: true });
  }

  /* Die Zählung muss auch auf Klicks reagieren, nicht nur auf Umbauten. */
  document.addEventListener('change', function (e) {
    if ((aktuell === 'bordkarte' || aktuell === 'kartei') && e.target && e.target.closest
        && e.target.closest('.dp-pf-tile')) {
      zaehlung(document.getElementById('oab-bar'));
      karteiZaehlung(document.getElementById('oab-bar'));
    }
  }, true);
  document.addEventListener('click', function (e) {
    if ((aktuell === 'bordkarte' || aktuell === 'kartei') && e.target && e.target.closest
        && e.target.closest('.dp-pf-tile')) {
      setTimeout(function () { zaehlung(document.getElementById('oab-bar')); }, 30);
    }
  }, true);

  /* ── Der Platz in den Einstellungen ───────────────────────────────
     Direkt unter „Aufbau" (`#dpl-sek` aus `layout-varianten.js`),
     in derselben Markup-Sprache des Darstellungs-Panels. */
  var panelWache = null;
  function inPanel() {
    var panel = document.getElementById('dpuv-b');
    if (!panel || document.getElementById('dpk-sek')) return;

    var g = document.createElement('div');
    g.className = 'dpuv-g';
    g.id = 'dpk-sek';
    var kacheln = [{ key: '', name: 'Automatisch', sub: 'Passt sich dem Modus an' }]
      .concat(Object.keys(STILE).map(function (k) {
        return { key: k, name: STILE[k].name, sub: STILE[k].sub };
      }));
    g.innerHTML = '<h3>Datenaufnahme</h3>'
      + '<p class="dpuv-hint">Wie die Karte im Objekt aussieht, mit der du die '
      + 'Datenquellen wählst. Die Quellen und der Abruf sind in allen dieselben — '
      + 'es wechselt nur die Form.</p>'
      + '<div class="dpuv-seg" id="dpk-seg">'
      + kacheln.map(function (o) {
          return '<button type="button" class="dpuv-sgb' + (o.key === aktuell ? ' on' : '')
            + '" data-k="' + o.key + '"><b>' + o.name + '</b><small>'
            + o.sub + '</small></button>';
        }).join('')
      + '</div>';

    /* Hinter den Aufbau, wenn es ihn gibt - erst der Rahmen, dann was
       darin steht. */
    var auf = document.getElementById('dpl-sek');
    if (auf && auf.nextSibling) panel.insertBefore(g, auf.nextSibling);
    else if (auf) panel.appendChild(g);
    else panel.insertBefore(g, panel.firstChild);

    g.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dpuv-sgb') : null;
      if (!b) return;
      setze(b.dataset.k);
      [].forEach.call(g.querySelectorAll('.dpuv-sgb'), function (x) {
        x.classList.toggle('on', x.dataset.k === aktuell);
      });
    });
  }

  function panelBeobachten() {
    if (panelWache || !window.MutationObserver) return;
    panelWache = new MutationObserver(function () { inPanel(); });
    panelWache.observe(document.body, { childList: true });
    inPanel();
  }

  /* ── Start ────────────────────────────────────────────────────────── */
  /* ── v1654 · DER TRICHTER IST NICHT MEHR DER STANDARD ──────────────
     Marcel am 28.09.2026: „was mir auch nicht gefaellt, ist halt die
     Pre-Flight-Karte mit dem Trichter. Da sollten wir die
     standardmaessige Karte erst mal reinsetzen, die wir vorher hatten,
     aber halt im neueren Design."

     Das ist **Entwurf 5** — die Bordkarte, aber nur das, was etwas
     bedeutet: der Abriss trennt Waehlen von Ausloesen, keine
     Perforation als Zierat, kein Strichcode.

     Zwei Dinge passieren hier:

     1. Wer **nichts** gewaehlt hat, bekommt in den Layouts die
        Bordkarte statt der Zeile. Der Trichter bleibt waehlbar.
     2. Ein bereits gemerkter `trichter` wird **einmalig** auf
        `bordkarte` umgestellt. Das ist ein Eingriff in einen fremden
        Merker und deshalb genau einmal, mit eigenem Marker - sonst
        koennte niemand den Trichter je wieder waehlen.

     > Einen Merker still zu ueberschreiben waere falsch. Einmalig und
     > erklaert ist es das, was verlangt wurde. */
  var MIGRIERT = 'dp_karten_stil_v1654';

  function start() {
    var p = new URLSearchParams(location.search);
    var ausUrl = p.get('karte');
    var gemerkt = '';
    try { gemerkt = localStorage.getItem(LS) || ''; } catch (e) {}

    try {
      if ((gemerkt === 'trichter' || gemerkt === 'bordkarte') && !localStorage.getItem(MIGRIERT + 'b')) {
        gemerkt = 'kartei';
        localStorage.setItem(LS, gemerkt);
        localStorage.setItem(MIGRIERT + 'b', '1');
      }
    } catch (e) {}

    if (ausUrl !== null) setze(ausUrl === 'aus' ? '' : ausUrl);
    else if (gemerkt) setze(gemerkt);
    /* KEIN Standard per JS. Wer nichts gewaehlt hat, bekommt die
       Bordkarte ueber die CSS-Regel
       `html[data-dp-layout]:not([data-dp-kartenstil])` - also NUR in
       einem Layout.

       > Ein `setze('bordkarte')` hier wuerde `data-dp-kartenstil`
       > setzen, damit `dp-neue-karte` ausloesen und den
       > **Obsidian-Auslieferungszustand veraendern**. Wer nicht
       > umschaltet, bekommt die App so, wie er sie kennt - das gilt
       > auch fuer einen gut gemeinten Standard. */

    beobachten();
    panelBeobachten();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  /* v1660: Wechselt der Aufbau, wird neu entschieden - sonst bliebe
     der Stil haengen, den das letzte Layout gesetzt hat, oder er kaeme
     beim Zurueckschalten nicht wieder. */
  if (window.MutationObserver) {
    new MutationObserver(function () { setze(aktuell || (function(){
      try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; }
    })()); }).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-dp-layout']
    });
  }

  window.DealPilotKartenStil = {
    setze: setze,
    stil: function () { return aktuell; },
    stile: STILE
  };
})();
