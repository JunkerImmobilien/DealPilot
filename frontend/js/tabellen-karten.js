/* ═══════════════════════════════════════════════════════════════════════
   tabellen-karten.js · v2060
   BREITE TABELLEN WERDEN AUF DEM HANDY ZU KARTEN
   ═══════════════════════════════════════════════════════════════════════

   Marcels Vorgabe (Master-Prompt, 09.10.2026):

     „Breite Tabellen · Desktop: mehrspaltige Tabelle. Tablet: reduzierte
      Spalten. Smartphone: Kartenansicht oder vertikale Liste,
      Feldbezeichnung über oder neben dem Wert, wichtige Informationen
      zuerst, Zusatzdetails bei Bedarf aufklappbar."

   ── WAS GEMESSEN WURDE, BEVOR DAS HIER ENTSTAND ──────────────────────

   In der Messkabine bei 390 px, je Ansicht durchgescrollt. **Kein
   einziger funktionaler Fehler** — nichts unerreichbar, kein Überlauf,
   der nicht aufgefangen wäre. Was blieb, waren fünf Tabellen, die
   waagerecht geschoben werden müssen:

     Ansicht     Tabelle           Spalten  Zeilen  sichtbar/Inhalt
     single      #oe-gewerke             5      10   331 / 648  = 2,0x
     dashboard   .sk-tab                 7       8   308 / 788  = 2,6x
     dashboard   #dp-proj-table         14      20   332 / 926  = 2,8x
     all         .ao-table (Pässe)       5      15   327 / 700  = 2,1x
     all         .ao-table (Objekte)     9      22   327 / 757  = 2,3x

   Sie sind **kein Fehler**: jede liegt in einer Hülle mit
   `overflow-x:auto`, und der Balken nimmt dort messbar Höhe weg (4 bis
   14 px). Nichts ist abgeschnitten.

     > Aber 14 Spalten in 332 px waagerecht zu schieben heisst, eine
     > Zahl zu lesen und ihre Überschrift nicht mehr zu sehen. Das ist
     > bedienbar und trotzdem unbrauchbar.

   ── WARUM EIN ZENTRALES MODUL UND NICHT FÜNF KORREKTUREN ─────────────

   Marcel: „Wenn mehrere Komponenten denselben Fehler aufweisen, behebe
   die Ursache möglichst zentral. Bevorzuge wiederverwendbare
   Layout-Patterns."

   Alle fünf Tabellen haben `<thead>` mit `<th>` — damit lässt sich die
   Spaltenüberschrift an jede Zelle hängen und die Zeile als Karte
   lesen. Eine Lösung, fünf Stellen, und die nächste Tabelle bekommt sie
   geschenkt.

   ── WAS NICHT PASSIERT ───────────────────────────────────────────────

   **Keine Zelle wird entfernt, keine Zeile umsortiert.** Das Markup
   bleibt, wie es ist; es kommt nur ein `data-dptk-spalte` an jede `td`
   und eine Klasse an die Tabelle. Wer die Tabelle neu rendert, zerstört
   nichts — der Beobachter unten hängt die Beschriftung wieder an.

   **Am Schreibtisch ändert sich nichts.** Der Kartenmodus steht
   vollständig in `@media(max-width:600px)`.

   ── „WICHTIGES ZUERST" ───────────────────────────────────────────────

   Ab der fünften Spalte wird eingeklappt, mit einem Schalter je Tabelle
   („Alle Spalten"). Vier Spalten sind bei allen fünf Tabellen genau die
   identifizierenden: Objekt/Jahr/Gewerk plus die ersten Kennzahlen.

   Der Schalter steht ÜBER der Tabelle und sagt, wie viele Spalten er
   zeigt — ein Schalter, der nur „mehr" heisst, verschweigt, wie viel
   man verpasst.

   ── DER NAMENSRAUM IST GEPRÜFT, NICHT GERATEN ────────────────────────

   `dpk-` war schon belegt (`.dpk-ertrag`, `.dpk-copilot` in
   `datenaufnahme.css`) — zwei Module auf einem Namen löschen sich
   lautlos. Gegrept und frei: `dptk`, `data-dptk-*`,
   `DealPilotTabellenKarten`.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotTabellenKarten) return;

  var SICHTBAR = 4;          /* Spalten, die immer stehen */
  var MIN_SPALTEN = 5;       /* darunter lohnt der Umbau nicht */

  /* ── Der Stil ────────────────────────────────────────────────────────
     Vollständig in der Media-Query: am Schreibtisch existiert davon
     nichts. Farben kommen aus den vorhandenen Tokens — ein Gold-Literal
     hier wäre beim Mandanten falsch (Whitelabel-Pflicht). */
  function stil() {
    if (document.getElementById('dptk-stil')) return;
    var s = document.createElement('style');
    s.id = 'dptk-stil';
    s.textContent = [
      '@media(max-width:600px){',
      /* Die Hülle muss den Querlauf abgeben, sonst scrollt sie weiter. */
      '  .dptk-huelle{overflow-x:visible !important}',
      '  table.dptk{width:100% !important;min-width:0 !important;display:block}',
      '  table.dptk thead{display:none}',
      '  table.dptk tbody{display:block}',
      '  table.dptk tbody tr{display:block;margin:0 0 8px;padding:8px 10px;',
      '    border:1px solid rgba(42,39,39,.14);border-radius:10px;',
      '    background:rgba(42,39,39,.02)}',
      '  table.dptk tbody tr:last-child{margin-bottom:0}',
      /* Jede Zelle: Beschriftung links, Wert rechts. */
      '  table.dptk tbody td{display:flex;align-items:baseline;gap:10px;',
      '    justify-content:space-between;width:auto !important;',
      '    border:0 !important;padding:3px 0 !important;text-align:right;',
      '    font:500 12.5px/1.45 Inter,system-ui,sans-serif;white-space:normal}',
      '  table.dptk tbody td::before{content:attr(data-dptk-spalte);',
      '    flex:0 0 auto;max-width:52%;text-align:left;opacity:.62;',
      '    font:600 10.5px/1.45 "JetBrains Mono",ui-monospace,monospace;',
      '    letter-spacing:.04em;text-transform:none}',
      /* Eine Zelle ohne Beschriftung (z. B. Aktionsknöpfe) nimmt die
         ganze Breite - ein leeres Label davor sähe nach Fehler aus. */
      '  table.dptk tbody td[data-dptk-spalte=""]{justify-content:flex-end}',
      '  table.dptk tbody td[data-dptk-spalte=""]::before{content:none}',
      /* Die erste Zelle ist die Überschrift der Karte. */
      '  table.dptk tbody td:first-child{font-weight:700;font-size:13.5px;',
      '    padding-bottom:6px !important;margin-bottom:4px;',
      '    border-bottom:1px solid rgba(42,39,39,.10) !important}',
      '  table.dptk tbody td:first-child::before{opacity:.5}',
      /* Zusatzspalten einklappen, bis der Schalter sie holt. */
      '  table.dptk:not(.dptk-alle) tbody td:nth-child(n+' + (SICHTBAR + 1) + '){display:none}',
      /* Der Schalter */
      '  .dptk-schalter{display:flex;align-items:center;gap:8px;margin:0 0 8px;',
      '    padding:7px 11px;border:1px solid rgba(42,39,39,.16);border-radius:9px;',
      '    background:none;cursor:pointer;width:100%;',
      '    font:600 11px/1 "JetBrains Mono",ui-monospace,monospace;',
      '    letter-spacing:.06em;color:inherit;opacity:.78}',
      '  .dptk-schalter:hover{opacity:1}',
      '  .dptk-schalter i{font-style:normal;margin-left:auto;opacity:.6}',
      '}',
      /* ── v2060b · DAS TABLET BEKOMMT KEINE KARTEN, SONDERN PLATZ ────
         GEMESSEN bei 767x757 nach v2060a: die beiden Anzeigetabellen
         schoben dort weiter waagerecht, aber nur mit Faktor 1,2 und 1,3
         (auf dem Handy waren es 2,6 und 2,8). Sie PASSEN fast.

         Karten wären hier verschenkter Platz - Marcels Vorgabe für das
         Tablet heisst „reduzierte oder sinnvoll gruppierte Spalten",
         nicht Kartenansicht. Also bleibt die Tabelle eine Tabelle und
         darf nur nicht breiter sein als ihr Platz: `min-width` weg,
         Umbruch erlaubt, Zahlen etwas enger.

         Keine Spalte faellt weg. Bei 7 Spalten auf 656 px sind das
         94 px je Spalte - genug fuer eine Zahl mit Tausenderpunkt. */
      /* v2060c - Grenze 900 -> 1200. GEMESSEN bei 1023x757 (iPad quer,
         kleiner Laptop): dort schoben beide Tabellen weiter, Faktor 1,2 -
         die Projektionstabelle ist 926 px breit, ihr Kasten nur 820.
         Ab 1200 px ist der Kasten breiter als die 926 und die Regel wird
         nicht mehr gebraucht; darunter schon. Die Zahl ist also nicht
         gegriffen, sondern die Breite der breitesten Tabelle plus Rand. */
      '@media(min-width:601px) and (max-width:1200px){',
      '  table.dptk{width:100% !important;min-width:0 !important;table-layout:fixed}',
      '  table.dptk th,table.dptk td{white-space:normal;overflow-wrap:anywhere;',
      '    padding-left:5px !important;padding-right:5px !important;font-size:12px}',
      '  table.dptk th{font-size:10.5px;line-height:1.25}',
      '  .dptk-huelle{overflow-x:visible !important}',
      '}',
      /* Ausserhalb beider Fenster: nichts. Der Schalter darf am
         Schreibtisch nicht einmal Platz brauchen. */
      '@media(min-width:601px){.dptk-schalter{display:none}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── Die Beschriftung an die Zellen hängen ───────────────────────────
     Gelesen wird die LETZTE Kopfzeile: bei mehrzeiligen Köpfen steht
     dort die Spalte, nicht die Gruppe. */
  function beschriften(t) {
    var kopfZeilen = t.querySelectorAll('thead tr');
    if (!kopfZeilen.length) return 0;
    var kopf = kopfZeilen[kopfZeilen.length - 1];
    var namen = [].slice.call(kopf.children).map(function (th) {
      return (th.textContent || '').replace(/\s+/g, ' ').trim()
             .replace(/[▲▼↑↓⇅⇄]/g, '').trim();
    });
    if (namen.length < MIN_SPALTEN) return 0;
    var n = 0;
    [].slice.call(t.querySelectorAll('tbody tr')).forEach(function (tr) {
      [].slice.call(tr.children).forEach(function (td, i) {
        /* colspan-Zellen (Zwischensummen, "keine Daten") bekommen keine
           Beschriftung - sie gehören zu keiner Spalte. */
        if (td.colSpan > 1) { td.setAttribute('data-dptk-spalte', ''); return; }
        td.setAttribute('data-dptk-spalte', namen[i] || '');
        n++;
      });
    });
    return n;
  }

  /* ── Der Schalter über der Tabelle ───────────────────────────────────
     Er sagt, WIE VIELE Spalten er holt. Ein Schalter, der nur „mehr"
     heisst, verschweigt, wie viel man gerade nicht sieht. */
  function schalter(t, spalten) {
    var huelle = t.parentElement;
    if (!huelle) return;
    if (huelle.previousElementSibling &&
        huelle.previousElementSibling.classList.contains('dptk-schalter')) return;
    var versteckt = spalten - SICHTBAR;
    if (versteckt < 1) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'dptk-schalter';
    var mal = function () {
      var alle = t.classList.contains('dptk-alle');
      b.innerHTML = (alle ? 'Weniger Spalten' : 'Alle ' + spalten + ' Spalten')
                  + '<i>' + (alle ? '▴' : '+' + versteckt) + '</i>';
      b.setAttribute('aria-expanded', alle ? 'true' : 'false');
    };
    b.addEventListener('click', function () {
      t.classList.toggle('dptk-alle');
      mal();
    });
    mal();
    huelle.parentNode.insertBefore(b, huelle);
  }

  /* ── Eine Tabelle übernehmen ───────────────────────────────────────
     v2060a · EINGABETABELLEN BLEIBEN TABELLEN.

     Gemessen am 09.10.2026: von den fünf Tabellen, die der Formfilter
     fand, sind ZWEI Eingabemasken — `#oe-gewerke` mit 23 und
     `.ytf-table` mit 45 Feldern. Die hätte der Kartenmodus zerquetscht.

     Und genau das ist hier schon einmal passiert. In `style.css` steht
     über `#oe-karte-gewerke`:

       „v1881 · HANDY-DURCHGANG 05.10.2026 … die Regel v1862c macht die
        TABELLE zum Scrollkasten (display:block) — der Inhalt schrumpfte
        trotzdem auf 60-px-Auswahlen ('– k', 'Kei', '> 2'), gemessen auf
        390 px. Scrollkasten ist jetzt die Karte, die Tabelle behält
        ihre Breite und wischt."

     Dort steht deshalb `min-width:620px !important` an einer ID-ID-Regel
     — sie hat meine Regel ohnehin geschlagen, der Schaden blieb also
     aus. Aber der Schalter stand sinnlos darüber.

     > Eine Anzeigetabelle liest man. Eine Eingabetabelle bedient man,
     > und ein `<select>` mit 110 px Mindestbreite passt in keine
     > Label-Wert-Zeile. Die Form allein unterscheidet das nicht — die
     > Felder darin schon. */
  function nimm(t) {
    if (!t || t.tagName !== 'TABLE') return false;
    if (!t.querySelector('thead')) return false;
    var tb = t.querySelector('tbody');
    if (!tb || !tb.querySelector('tr')) return false;
    if (tb.querySelector('input, select, textarea')) return false;
    var kopfZeilen = t.querySelectorAll('thead tr');
    var spalten = kopfZeilen.length
      ? kopfZeilen[kopfZeilen.length - 1].children.length : 0;
    if (spalten < MIN_SPALTEN) return false;
    if (!beschriften(t)) return false;
    t.classList.add('dptk');
    if (t.parentElement) t.parentElement.classList.add('dptk-huelle');
    schalter(t, spalten);
    return true;
  }

  /* ── Alle finden ────────────────────────────────────────────────────
     Keine feste Liste von Ids: eine Tabelle, die jemand morgen
     dazustellt, soll den Kartenmodus geschenkt bekommen. Gefiltert wird
     über die FORM (thead, genug Spalten), nicht über den Namen. */
  function alle(wurzel) {
    var n = 0;
    [].slice.call((wurzel || document).querySelectorAll('table')).forEach(function (t) {
      try { if (nimm(t)) n++; } catch (e) {}
    });
    return n;
  }

  /* ── Nach dem Neu-Rendern wieder greifen ─────────────────────────────
     Die Tabellen entstehen per `innerHTML` (Projektion, Alle-Objekte,
     Steuerübersicht). Ohne Beobachter trägt die erste Fassung die
     Beschriftung und jede weitere nicht - der Kartenmodus sähe dann aus
     wie ein Fehler, der „manchmal" auftritt. */
  var geplant = null;
  function nachziehen() {
    if (geplant) return;
    geplant = setTimeout(function () {
      geplant = null;
      try { alle(document); } catch (e) {}
    }, 160);
  }

  function start() {
    stil();
    alle(document);
    try {
      var mo = new MutationObserver(function (m) {
        for (var i = 0; i < m.length; i++) {
          var l = m[i].addedNodes;
          for (var j = 0; j < l.length; j++) {
            var n = l[j];
            if (n.nodeType !== 1) continue;
            if (n.tagName === 'TABLE' || n.tagName === 'TBODY' || n.tagName === 'TR'
                || (n.querySelector && n.querySelector('table'))) { nachziehen(); return; }
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }

  window.DealPilotTabellenKarten = {
    alle: alle, nimm: nimm, nachziehen: nachziehen,
    /* Für die Messkabine: was hat gegriffen? */
    stand: function () {
      var t = [].slice.call(document.querySelectorAll('table.dptk'));
      return {
        uebernommen: t.length,
        schalter: document.querySelectorAll('.dptk-schalter').length,
        tabellen: t.map(function (x) {
          return { id: x.id || '(ohne id)', cls: (x.className || '').split(/\s+/)[0],
                   spalten: x.querySelectorAll('thead tr:last-child > *').length,
                   zellenBeschriftet: x.querySelectorAll('tbody td[data-dptk-spalte]').length };
        })
      };
    }
  };
})();
