/* ════════════════════════════════════════════════════════════════════════════
   TOUR-PRÜFER · misst jeden Schritt des Rundgangs gegen sein Ziel
   ════════════════════════════════════════════════════════════════════════════

   AUFRUF (in der Browser-Konsole der laufenden App):

     1. Diese Datei einmal einfügen.
     2. DpTourPruefer.start('Standard (Heute)', 'A')   // oder 'B'
     3. Nach dem Lauf:  DpTourPruefer.bericht()

   Oder in einem Rutsch, mit Ansichtswechsel:

     DpTourPruefer.alleAnsichten()    // 4 Ansichten x 2 Zweige, nacheinander

   ────────────────────────────────────────────────────────────────────────────
   SIEBEN ANLÄUFE, SIEBEN LEHREN — alle am 02.10.2026 bezahlt

   1  `goto()` auf eine BEENDETE Tour tut nichts. Danach gibt es keinen
      Spot mehr, und jede Messung meldet "kein Ziel".
   2  Ein eigener Schrittzähler läuft mit der Tour auseinander: sie
      verzweigt (`choices`) und überspringt. Der aktuelle Schritt steht in
      der BLASE, nirgends sonst.
   3  Blind takten und dabei `next()` rufen überspringt Schritte — die
      Tour sprang von 2 auf 5. Gewartet wird auf den TITELWECHSEL.
   4  Nach dem Titelwechsel liegt eine Blende über dem Spot (450 ms).
      Wer sofort misst, liest die VORIGE Stellung.
   5  Zwei Timer nebeneinander (Suchschleife + Messung) messen die falsche
      Uhr. EINE Uhr, und sie wartet auf die Wirkung.
   6  Der Prüfer darf die Tour nicht selbst starten und 300 ms später
      prüfen — `start()` braucht rund eine Sekunde.
   7  Beim Neustart verschwindet die ALTE Blase kurz. Wer nur auf
      "Blase da" wartet, findet die alte und misst in die Lücke. Gewartet
      wird auf den ERSTEN Schritt, am Titel erkannt.

   8  Timer NICHT pauschal löschen. Ein `for (i..) clearTimeout(i)` über
      692 Timer legt die TOUR mit lahm — sie besteht aus nichts anderem.
      Danach stand sie auf Schritt 1 und kam nie weiter, und das sah aus
      wie ein Hänger in der App.

   > Ein Prüfer, der sein Prüfobjekt nicht kennt, misst sich selbst.

   ────────────────────────────────────────────────────────────────────────
   NOCH OFFEN (Stand 02.10.2026)

   Dieser Prüfer kommt über Schritt 1 nicht hinaus: er misst, wartet
   1,1 s, klickt `[data-action="next"]` — und der Titel bleibt stehen.
   GEGENGEPRÜFT: derselbe Knopf, von Hand geklickt, wechselt sofort auf
   „Objekt auswählen". Der Klick des Prüfers kommt also nicht an, obwohl
   er denselben Knopf trifft.

   DER NÄCHSTLIEGENDE VERDACHT IST WIDERLEGT. Vermutet hatte ich, die
   Blase werde bei jedem Schritt neu gebaut und die gemerkte Referenz
   zeige ins Leere. Gemessen:

     gemerkte Blase nach dem Klick   isConnected: true
     dieselbe wie im Dokument        true

   Sie bleibt dasselbe Element, nur ihr `innerHTML` wird ersetzt — ein
   `blase.querySelector(...)` im Timeout holt also einen frischen Knopf.

   Was die Messung STATTDESSEN zeigte: bei Schritt 3 gibt es gar keinen
   `[data-action="next"]`, weil dort die VERZWEIGUNG steht — nur zwei
   `[data-goto]`-Knöpfe. Der Prüfer sucht die zuerst ab, das ist also
   nicht die Ursache.

   > Ein widerlegter Verdacht gehört aufgeschrieben, nicht gelöscht.
   > Sonst prüft ihn der Nächste noch einmal.

   Was noch zu messen ist: ein Protokoll IM Läufer, das je Takt festhält,
   welchen Zweig er nimmt (`data-goto`, `next` oder keins) und ob der
   Klick ankam. Ohne das ist jede weitere Vermutung geraten.

   ────────────────────────────────────────────────────────────────────────────
   WAS GEMESSEN WIRD

   Nicht `querySelector` gegen null — das war schon einmal der Fehler
   (30.09.2026, "36 von 37 Zielen"). Gemessen wird, WAS UNTER DEM SPOT
   LIEGT, per `elementsFromPoint` in seiner Mitte:

     ok                der Spot sitzt auf dem Ziel (oder einem Nachkommen)
     SPOT_FREMD        er sitzt auf etwas anderem — mit Angabe worauf
     SPOT_AUSSERHALB   seine Mitte liegt außerhalb des Fensters
     KEIN_SPOT         es gibt keinen sichtbaren Spot
     UNBEKANNT         der Titel der Blase steht in keinem Schritt
   ════════════════════════════════════════════════════════════════════════ */
window.DpTourPruefer = (function () {
  'use strict';

  var _laeufe = [];
  var _aktiv = null;

  function sicht(e) {
    if (!e) return false;
    var r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var c = getComputedStyle(e);
    return !(c.display === 'none' || c.visibility === 'hidden'
             || parseFloat(c.opacity) < 0.25);
  }

  function box(e) {
    var r = e.getBoundingClientRect();
    return { l: Math.round(r.left), t: Math.round(r.top),
             w: Math.round(r.width), h: Math.round(r.height) };
  }

  function titel() {
    return ((document.querySelector('.dp-tour-title') || {}).textContent || '').trim();
  }

  function zuTitel(t) {
    var S = window.DpTourSteps || [];
    for (var i = 0; i < S.length; i++) {
      if ((S[i].title || '').trim() === t) return { i: i, s: S[i] };
    }
    return null;
  }

  function pruefe(j) {
    var sp = document.querySelector('.dp-tour-spotlight');
    if (!sp || !sicht(sp)) return { urteil: 'KEIN_SPOT' };
    var b = box(sp);
    var mx = b.l + b.w / 2, my = b.t + b.h / 2;
    if (mx < 0 || my < 0 || mx > innerWidth || my > innerHeight) {
      return { urteil: 'SPOT_AUSSERHALB', spot: b, fenster: [innerWidth, innerHeight] };
    }
    var unten = document.elementsFromPoint(mx, my).filter(function (x) {
      return !/dp-tour/.test((x.className || '').toString());
    });
    var ok = false;
    try {
      for (var k = 0; k < unten.length && k < 8; k++) {
        if (unten[k].closest && unten[k].closest(j.s.selector)) { ok = true; break; }
      }
    } catch (e) {}
    var r = { urteil: ok ? 'ok' : 'SPOT_FREMD', spot: b };
    if (!ok && unten[0]) {
      r.liegt_auf = ((unten[0].id ? '#' + unten[0].id : '') + '.'
        + (unten[0].className || '').toString().split(' ')[0]).slice(0, 34);
      r.text = (unten[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    }
    return r;
  }

  /* ── Auf den ERSTEN Schritt warten, nicht nur auf "eine Blase" ────── */
  function warteAufStart(fertig) {
    var S = window.DpTourSteps || [];
    var ersterTitel = (S[0] && S[0].title || '').trim();
    var n = 0;
    (function warte() {
      var b = document.querySelector('.dp-tour-bubble');
      if (b && sicht(b) && titel() === ersterTitel) { fertig(true); return; }
      if (++n > 50) { fertig(false); return; }    /* 15 s */
      setTimeout(warte, 300);
    })();
  }

  function einLauf(name, zweig, fertig) {
    try { window.DpTour.reset(); window.DpTour.start(); } catch (e) {}
    warteAufStart(function (bereit) {
      if (!bereit) {
        fertig({ ansicht: name, zweig: zweig, schritte: [],
                 abbruch: 'Die Tour erreichte Schritt 1 nicht (15 s gewartet).' });
        return;
      }
      var out = [], letzter = '', takte = 0, busy = false;
      var iv = setInterval(function () {
        if (busy) return;
        if (++takte > 300) {
          clearInterval(iv);
          fertig({ ansicht: name, zweig: zweig, schritte: out, abbruch: 'Notbremse nach 300 Takten' });
          return;
        }
        var blase = document.querySelector('.dp-tour-bubble');
        if (!blase || !sicht(blase)) {
          clearInterval(iv);
          fertig({ ansicht: name, zweig: zweig, schritte: out, ende: 'Tour beendet' });
          return;
        }
        var t = titel();
        if (!t || t === letzter) return;
        busy = true; letzter = t;
        /* 1,1 s: Blende (450 ms) plus Luft. Lehre 4. */
        setTimeout(function () {
          var j = zuTitel(t);
          var e = { titel: t.slice(0, 32) };
          if (!j) { e.urteil = 'UNBEKANNT'; }
          else {
            e.n = j.i + 1;
            e.tab = j.s.tab || '-';
            e.sub = !!(j.s.subTargets || j.s.subSelectors);
            e.wahl = !!j.s.choices;
            var r = pruefe(j);
            e.urteil = r.urteil;
            if (r.spot) e.spot = r.spot;
            if (r.liegt_auf) e.liegt_auf = r.liegt_auf;
            if (r.text) e.text = r.text;
            if (r.fenster) e.fenster = r.fenster;
          }
          out.push(e);
          /* Verzweigung: den gewählten Zweig klicken. Lehre 2. */
          var w = blase.querySelectorAll('[data-goto]');
          if (w.length) {
            w[(zweig === 'B' && w[1]) ? 1 : 0].click();
            busy = false; return;
          }
          var nx = blase.querySelector('[data-action="next"]');
          if (nx) { nx.click(); busy = false; return; }
          clearInterval(iv);
          fertig({ ansicht: name, zweig: zweig, schritte: out, ende: 'letzter Schritt erreicht' });
        }, 1100);
      }, 300);
    });
  }

  function layoutSetzen(v) {
    try {
      if (window.DealPilotLayout && typeof window.DealPilotLayout.setze === 'function') {
        window.DealPilotLayout.setze(v);
        return true;
      }
    } catch (e) {}
    return false;
  }

  var ANSICHTEN = [
    { key: 'heute', name: 'Standard (Heute)' },
    { key: 'v1b',   name: 'Aktenmappe' },
    { key: 'v2',    name: 'Kanzlei' },
    { key: 'v2b',   name: 'Tower' }
  ];

  return {
    start: function (name, zweig) {
      _aktiv = (name || 'ohne Namen') + ' / Zweig ' + (zweig || 'A');
      console.log('[TourPruefer] Lauf: ' + _aktiv);
      einLauf(name || 'ohne Namen', zweig || 'A', function (r) {
        _laeufe.push(r);
        _aktiv = null;
        console.log('[TourPruefer] fertig: ' + r.schritte.length + ' Schritte · '
          + (r.ende || r.abbruch));
      });
      return 'laeuft — DpTourPruefer.bericht() zeigt das Ergebnis';
    },

    alleAnsichten: function () {
      var i = 0, zweige = ['A', 'B'], zi = 0;
      function naechster() {
        if (i >= ANSICHTEN.length) {
          console.log('[TourPruefer] ALLE fertig — DpTourPruefer.bericht()');
          return;
        }
        var a = ANSICHTEN[i];
        layoutSetzen(a.key);
        setTimeout(function () {
          einLauf(a.name, zweige[zi], function (r) {
            _laeufe.push(r);
            console.log('[TourPruefer] ' + a.name + ' / ' + zweige[zi] + ': '
              + r.schritte.length + ' Schritte');
            zi++;
            if (zi >= zweige.length) { zi = 0; i++; }
            setTimeout(naechster, 1500);
          });
        }, 1500);
      }
      naechster();
      return '8 Laeufe (4 Ansichten x 2 Zweige) — dauert rund 10 Minuten';
    },

    bericht: function () {
      if (!_laeufe.length) return 'noch kein Lauf' + (_aktiv ? ' fertig (laeuft: ' + _aktiv + ')' : '');
      var zeilen = [];
      _laeufe.forEach(function (L) {
        var z = {};
        L.schritte.forEach(function (s) { z[s.urteil] = (z[s.urteil] || 0) + 1; });
        zeilen.push('── ' + L.ansicht + ' / Zweig ' + L.zweig + ' ── '
          + L.schritte.length + ' Schritte · ' + (L.ende || L.abbruch));
        zeilen.push('   ' + JSON.stringify(z));
        L.schritte.filter(function (s) { return s.urteil !== 'ok'; }).forEach(function (s) {
          zeilen.push('   ' + String(s.n || '?').padStart(2) + ' ' + s.urteil.padEnd(16)
            + String(s.tab || '-').padEnd(9) + s.titel
            + (s.liegt_auf ? '  liegt auf ' + s.liegt_auf : '')
            + (s.spot && s.urteil === 'SPOT_AUSSERHALB' ? '  Spot ' + JSON.stringify(s.spot) : ''));
        });
      });
      /* Welche Schritte hat KEIN Lauf erreicht? Das ist selbst ein Befund. */
      var erreicht = {};
      _laeufe.forEach(function (L) { L.schritte.forEach(function (s) { if (s.n) erreicht[s.n] = 1; }); });
      var nie = [];
      for (var i = 1; i <= (window.DpTourSteps || []).length; i++) if (!erreicht[i]) nie.push(i);
      if (nie.length) {
        zeilen.push('');
        zeilen.push('NIE ERREICHT (' + nie.length + ' von ' + window.DpTourSteps.length + '): ' + nie.join(', '));
        zeilen.push('   Ein Schritt, den kein Zweig erreicht, ist entweder tot oder');
        zeilen.push('   haengt an einer Bedingung, die hier nie zutraf.');
      }
      return zeilen.join('\n');
    },

    rohdaten: function () { return _laeufe; },
    leeren: function () { _laeufe = []; return 'geleert'; }
  };
})();
