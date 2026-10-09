/* doppelkarte.js - v2031
 * ═════════════════════════════════════════════════════════════════════
 * DIE OBJEKTKARTE DREHT SICH UM.
 *
 * Marcel, 09.10.2026: „waere es auch cool, wenn man so eine Doppelkarte
 * hat ... dort kann man immer zwischen Soll und Ist wechseln und die
 * dreht sich dann quasi um. Das waere irgendwie eine pfiffige Loesung."
 * Dazu: „schaust dir das alles an, die ganzen Stellen, dass das
 * funktioniert ... fuer alle Objekte und auch im Aussehen."
 *
 * ── WARUM KEIN DREH-RAHMEN ──────────────────────────────────────────
 *
 * Die naheliegende Bauart waere ein Wrapper um `.sb-card` mit zwei
 * Seiten und `backface-visibility`. Zwei Messungen sprechen dagegen:
 *
 *   `.sb-list` ist `display:flex; flex-direction:column; gap:18px`
 *              -> ein Wrapper wird das Flex-Kind, nicht mehr die Karte
 *   `.sb-card` traegt 245 Regeln, 45 davon mit `!important`
 *              -> jede davon rechnet damit, wo die Karte sitzt
 *
 * (Immerhin: **kein einziger** Kind- oder Geschwister-Selektor auf
 * `.sb-card` - gemessen, beides 0. Ein Wrapper waere also nicht an den
 * Selektoren gescheitert, sondern am Flex-Layout.)
 *
 * ── DIE BAUART, DIE STATTDESSEN GILT ────────────────────────────────
 *
 * Die Karte dreht sich SELBST und tauscht auf halbem Weg ihren Inhalt:
 *
 *   1. `rotateY(90deg)` - die Karte steht auf der Kante, man sieht nichts
 *   2. Inhalt austauschen (dieselbe Bau-Funktion, andere Zahlen)
 *   3. zurueck auf `rotateY(0)` - die andere Seite kommt heraus
 *
 * Fuer das Auge ist das ein Umdrehen. Fuer das Layout passiert gar
 * nichts: dasselbe Element, dieselbe Stelle im Flex, alle 245 Regeln
 * greifen weiter, und die Hoehe kann nicht springen, weil **dieselbe
 * Funktion** beide Seiten baut (`_renderRichCard`).
 *
 *   > Eine zweite Kartenbauerei fuer die Rueckseite waere der teuerste
 *   > Fehler an dieser Stelle: sie wuerde beim naechsten Umbau der
 *   > Vorderseite zurueckbleiben, und niemand saehe es - man dreht ja
 *   > selten um.
 *
 * ── WO DER KNOPF SITZT ──────────────────────────────────────────────
 *
 * NICHT in `.sbc-actions`: die erscheint beim Hover (`style.css:4982`),
 * und auf dem Handy gibt es keinen Hover. Ein Knopf, den man dort nicht
 * sieht, ist nicht vorhanden - dieser Fehler lief hier schon einmal
 * neun Tage.
 *
 * Der Dreh-Knopf ist deshalb ein eigenes Kind der Karte, dauerhaft
 * sichtbar - und zwar NUR auf Karten, die wirklich einen Ankauf-Stand
 * haben. Ohne Stand gibt es nichts umzudrehen, also auch keinen Knopf.
 * ═════════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  var DREHZEIT = 170;                 /* muss zur CSS-Dauer passen */
  var gedreht = Object.create(null);  /* key -> true = zeigt den Ankauf */
  var alle = false;                   /* Schalter ueber der Liste */

  function el(id) { return document.getElementById(id); }

  /* ── Hat dieses Objekt einen Ankauf-Stand? ────────────────────────
     Zwei Quellen, und beide sind noetig:
       - das GELADENE Objekt haelt ihn in `window._dpAnkauf`
       - alle anderen bekommen ihn als Listenspalte (`ankauf_kurz`),
         die `_renderRichCard` in `window._dkOpts` ablegt
     Das geladene Objekt zuerst: dort ist der Stand frisch, in der Liste
     steht der Stand vom letzten Abruf. */
  function ankaufVon(key) {
    if (key && window._currentObjKey === key && window._dpAnkauf && window._dpAnkauf.kurz) {
      return { kurz: window._dpAnkauf.kurz, stichtag: window._dpAnkauf.stichtag };
    }
    var o = window._dkOpts && window._dkOpts[key];
    if (o && o.ankaufKurz) return { kurz: o.ankaufKurz, stichtag: o.ankaufStichtag || null };
    return null;
  }

  function zahl(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = (typeof v === 'number') ? v : parseFloat(v);
    return isFinite(n) ? n : null;
  }

  /* ── Die Stufenfarbe ──────────────────────────────────────────────
     Dieselben Schnitte wie die Vorderseite (85/70/50). Sie stehen hier
     NICHT als eigene Kette, sondern werden aus `ScoreTier` geholt, wenn
     es da ist - sonst waere das die fuenfte Kopie, und genau die hat
     `tools/score-ketten-pruefen.mjs` zu verhindern. */
  function stufeKlasse(score) {
    var s = zahl(score);
    if (s === null) return '';
    if (window.ScoreTier && typeof ScoreTier.classify === 'function') {
      var f = ScoreTier.classify(s);
      return f === 'top' ? 'sbc-score-green-strong'
           : f === 'green' ? 'sbc-score-green'
           : f === 'gold' ? 'sbc-score-gold' : 'sbc-score-red';
    }
    return s >= 85 ? 'sbc-score-green-strong'
         : s >= 70 ? 'sbc-score-green'
         : s >= 50 ? 'sbc-score-gold' : 'sbc-score-red';
  }

  function _datum(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
    var t = String(iso).split('-');
    return t[2] + '.' + t[1] + '.' + t[0];
  }

  /* ── Die Rueckseite ───────────────────────────────────────────────
     Dieselbe Funktion, andere Zahlen. Was NICHT ueberschrieben wird,
     bleibt wie vorn: Adresse, Nummer, Bild, Halter. Es ist dasselbe
     Objekt - nur ein anderer Zeitpunkt. */
  function rueckseite(key) {
    var o = window._dkOpts && window._dkOpts[key];
    var a = ankaufVon(key);
    if (!o || !a || typeof window._renderRichCard !== 'function') return null;
    var k = a.kurz || {};
    var score = zahl(k._ds2_score);
    var neu = {};
    for (var n in o) if (Object.prototype.hasOwnProperty.call(o, n)) neu[n] = o[n];
    neu.ds2Score    = score;
    neu.ds2ScoreCls = stufeKlasse(score);
    neu.kp          = zahl(k.kp);
    neu.cf_ns       = zahl(k._kpis_cf_ns);
    neu.bmy         = zahl(k._kpis_bmy);
    neu.nmr         = zahl(k._kpis_nmy);
    neu.dscr        = zahl(k._kpis_dscr);
    neu.ltv         = zahl(k._kpis_ltv);
    neu.ankaufBand  = _datum(a.stichtag);
    /* Der Trend der Vorderseite gehoert nicht auf die Rueckseite: er
       beschreibt den LAUFENDEN Cashflow. Lieber keine Linie als eine,
       die zum falschen Zeitpunkt gehoert. */
    neu._cfTrend = null;
    /* v2031b - abgeleitet: storage.js darf das NICHT als Zutaten des
       Objekts merken, sonst ueberschreibt diese Zeile den Merker. */
    neu._dkAbgeleitet = true;
    return window._renderRichCard(neu);
  }

  /* Vorderseite neu bauen = dieselbe Funktion mit den gemerkten opts */
  function vorderseite(key) {
    var o = window._dkOpts && window._dkOpts[key];
    if (!o || typeof window._renderRichCard !== 'function') return null;
    var neu = {};
    for (var n in o) if (Object.prototype.hasOwnProperty.call(o, n)) neu[n] = o[n];
    neu.ankaufBand = null;
    neu._dkAbgeleitet = true;   /* v2031b - siehe rueckseite() */
    return window._renderRichCard(neu);
  }

  /* ── Umdrehen ─────────────────────────────────────────────────────
     Der Inhalt wird AUF HALBEM WEG getauscht, nicht vorher und nicht
     nachher - sonst sieht man die neuen Zahlen schon beim Wegdrehen. */
  function drehen(karte, nachAnkauf) {
    if (!karte || karte._dkLaeuft) return;
    var key = karte.getAttribute('data-key');
    var html = nachAnkauf ? rueckseite(key) : vorderseite(key);
    if (!html) return;
    karte._dkLaeuft = true;
    karte.classList.add('dk-dreht');
    setTimeout(function () {
      try {
        var hilf = document.createElement('div');
        hilf.innerHTML = html;
        var neu = hilf.firstElementChild;
        if (neu) {
          karte.innerHTML = neu.innerHTML;
          /* Die Klassen der neuen Seite uebernehmen, aber `dk-dreht`
             und `active` behalten - die gehoeren zum Zustand der
             Liste, nicht zur Seite. */
          var aktiv = karte.classList.contains('active');
          karte.className = neu.className + ' dk-dreht' + (aktiv ? ' active' : '');
          gedreht[key] = !!nachAnkauf;
          knopfSetzen(karte);
        }
      } catch (e) { console.warn('[v2031] drehen:', e.message); }
      karte.classList.remove('dk-dreht');
      setTimeout(function () { karte._dkLaeuft = false; }, DREHZEIT);
    }, DREHZEIT);
  }

  /* ── Der Knopf ────────────────────────────────────────────────────
     Eigenes Kind der Karte, dauerhaft sichtbar. Nicht in
     `.sbc-actions` - die haengt am Hover und ist auf dem Handy nie da. */
  /* v2032 - knopfSetzen baut nichts mehr. Der Knopf kommt aus
     `_renderRichCard` (im Fluss, nicht obendrauf); hier wird nur noch
     der Klick abgefangen - per DELEGATION am Listencontainer, damit er
     jeden Neuaufbau ueberlebt. Ein Griff auf einzelne Knoepfe waere
     nach dem naechsten renderSaved() ins Leere gegangen. */
  function knopfSetzen() { /* absichtlich leer, siehe oben */ }

  /* v2036 - dieser Faenger trifft nichts mehr: `.dk-knopf` wird seit
     v2036 nicht mehr gebaut (der Modus-Dreher sitzt ueber der Liste).
     Er bleibt stehen, weil er nichts kostet und der Weg zurueck zu
     einem Knopf JE KARTE damit offen ist - entfernt wird er, wenn
     feststeht, dass es dabei bleibt. */
  (function klickFangen() {
    function binden() {
      var liste = el('sb-list');
      if (!liste || liste._dkKlick) return;
      liste._dkKlick = true;
      liste.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('.dk-knopf') : null;
        if (!b) return;
        ev.stopPropagation();
        ev.preventDefault();
        var karte = b.closest('.sb-card');
        var key = b.getAttribute('data-dk-key') || (karte && karte.getAttribute('data-key'));
        if (karte && key) drehen(karte, !gedreht[key]);
      }, true);
    }
    binden();
    document.addEventListener('DOMContentLoaded', binden);
    setTimeout(binden, 900);
    setTimeout(binden, 2600);
  })();
  /* ── Nach jedem Render neu greifen ────────────────────────────────
     `renderSaved()` ersetzt `#sb-list`.innerHTML komplett. Jeder Griff
     auf die alten Elemente ist danach ins Leere - deshalb wird nach
     jedem Rendern neu angesetzt, und der gemerkte Drehzustand wieder
     hergestellt. */
  function anlegen() {
    var liste = el('sb-list');
    if (!liste) return;
    var karten = liste.querySelectorAll('.sb-card');
    for (var i = 0; i < karten.length; i++) {
      var k = karten[i], key = k.getAttribute('data-key');
      /* v2031c - eine laufende Drehung NICHT anfassen.

         anlegen() laeuft nach jedem Listen-Neuaufbau und zusaetzlich
         zweimal verzoegert (800 ms, 2500 ms). Faellt das in eine Drehung,
         setzt es die Karte auf die gemerkte Seite zurueck - und der Klick
         sieht aus, als waere er verschluckt worden.

         Gemessen: bei 650 ms Klickabstand ging jeder ZWEITE Klick
         verloren, bei 720 ms keiner. Ein Fehler, der nur im Takt
         auftritt, ist trotzdem einer. */
      if (k._dkLaeuft) continue;
      knopfSetzen(k);
      /* War diese Karte gedreht? Dann ohne Animation direkt auf die
         Rueckseite - eine Drehung bei jedem Listen-Neuaufbau waere
         Unruhe, kein Hinweis. */
      if (gedreht[key] && ankaufVon(key)) {
        var html = rueckseite(key);
        if (html) {
          var hilf = document.createElement('div');
          hilf.innerHTML = html;
          var neu = hilf.firstElementChild;
          if (neu) {
            var aktiv = k.classList.contains('active');
            k.innerHTML = neu.innerHTML;
            k.className = neu.className + (aktiv ? ' active' : '');
            knopfSetzen(k);
          }
        }
      }
    }
    schalterSetzen();
  }

  /* ── Der Schalter ueber der Liste ─────────────────────────────────
     Dreht alle Karten auf einmal - fuer den Blick ueber den Bestand.
     Er erscheint nur, wenn ueberhaupt eine Karte einen Ankauf-Stand
     hat; sonst waere er ein Schalter ohne Wirkung. */
  /* ── Der Modus-Dreher ────────────────────────────────────────────
     v2036 - zwei Segmente ueber der Liste statt eines Knopfes je
     Karte. Er sitzt AUSSERHALB der Karte und muss deshalb in keiner
     der vier Darstellungsachsen passen.

     Er erscheint nur, wenn ueberhaupt eine Karte einen Ankauf-Stand
     hat - ein Schalter ohne Wirkung ist ein Versprechen. */
  function schalterSetzen() {
    var liste = el('sb-list');
    if (!liste) return;
    var mit = 0, karten = liste.querySelectorAll('.sb-card');
    for (var i = 0; i < karten.length; i++) if (ankaufVon(karten[i].getAttribute('data-key'))) mit++;
    var s = el('dk-schalter');
    if (!mit) { if (s) s.remove(); return; }
    if (!s) {
      s = document.createElement('div');
      s.id = 'dk-schalter';
      s.className = 'dk-schalter';
      s.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-dk-modus]') : null;
        if (!b) return;
        ev.stopPropagation();
        modusSetzen(b.getAttribute('data-dk-modus') === 'ankauf');
      });
      liste.insertBefore(s, liste.firstChild);
    }
    s.innerHTML =
      '<span class="dk-seg-titel">Stand</span>'
      + '<button type="button" data-dk-modus="bestand" class="dk-seg' + (alle ? '' : ' aktiv') + '"'
      + ' title="Die laufenden Zahlen von heute">Bestand</button>'
      + '<button type="button" data-dk-modus="ankauf" class="dk-seg' + (alle ? ' aktiv' : '') + '"'
      + ' title="Die Zahlen, wie sie beim Nutzen-/Lastenwechsel eingefroren wurden">Ankauf <b>' + mit + '</b></button>';
  }

  /* Alle Karten mit Ankauf-Stand umschalten. Karten OHNE Stand bleiben
     stehen - aber sie werden gekennzeichnet: eine Karte, die im
     Ankauf-Modus ihre HEUTIGEN Zahlen zeigt, ohne das zu sagen, waere
     eine Luege im Nebensatz. Halbe Deckkraft kann nichts verdecken. */
  function modusSetzen(nachAnkauf) {
    alle = !!nachAnkauf;
    /* v2037 - der Dreher gilt nicht nur der Liste. Das GEOEFFNETE
       Objekt wechselt mit: im Ankauf-Modus zeigt es den eingefrorenen
       Datensatz, gesperrt, mit Hinweis. Marcels Entscheidung vom
       09.10.: die Sperre gilt NUR dort, im Bestand bleibt alles
       editierbar - sonst koennte man nichts mehr pflegen. */
    try {
      if (window.DealPilotAnkaufAnsicht) DealPilotAnkaufAnsicht.setzen(alle);
    } catch (e) { console.warn('[v2037] Ankauf-Ansicht:', e.message); }
    var liste = el('sb-list');
    if (!liste) return;
    var ks = liste.querySelectorAll('.sb-card');
    for (var j = 0; j < ks.length; j++) {
      var kk = ks[j], kkey = kk.getAttribute('data-key');
      if (!ankaufVon(kkey)) {
        kk.classList.toggle('dk-ohne-ankauf', alle);
        if (alle) kk.setAttribute('data-dk-hinweis', 'Fuer dieses Objekt ist kein Ankauf-Stand festgeschrieben - du siehst die heutigen Zahlen.');
        else kk.removeAttribute('data-dk-hinweis');
        continue;
      }
      if (!!gedreht[kkey] !== alle) drehen(kk, alle);
    }
    schalterSetzen();
  }
  /* `renderSaved` baut die Liste neu. Ein MutationObserver ist hier
     richtig und kein Polling: er feuert genau dann, wenn getauscht
     wurde, und nicht alle 300 ms ins Leere. */
  function beobachten() {
    var liste = el('sb-list');
    if (!liste || liste._dkBeobachtet) return;
    liste._dkBeobachtet = true;
    var warten = null;
    new MutationObserver(function () {
      clearTimeout(warten);
      warten = setTimeout(anlegen, 60);
    }).observe(liste, { childList: true });
    anlegen();
  }

  function start() {
    beobachten();
    setTimeout(beobachten, 800);
    setTimeout(beobachten, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('dp:object-ready', function () { setTimeout(anlegen, 300); });

  window.DealPilotDoppelkarte = {
    drehen: function (key, nachAnkauf) {
      var k = document.querySelector('#sb-list .sb-card[data-key="' + key + '"]');
      if (k) drehen(k, nachAnkauf);
    },
    zustand: function () { return { gedreht: gedreht, alle: alle }; },
    anlegen: anlegen,
    modusSetzen: modusSetzen,
    ankaufVon: ankaufVon
  };
})();
