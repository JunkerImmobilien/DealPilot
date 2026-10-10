/* ═══════════════════════════════════════════════════════════════════════
   neues-objekt-quellen.js · v1643 — die Checkliste beim Anlegen

   Marcel am 26.09.2026: „wenn wir ein neues Objekt anlegen wollen,
   vielleicht auch irgendeinen Reiter machen, so ein Untermenü, was sich
   aufmacht, wo man dann auswählen kann, was man alles durchführen will,
   also jetzt sagen wir den PDF-Import, dann Partnerschnittstellen und
   DealPilot — und dann wird das passend ausgelesen."

   Und aus der Entwurfsschau: „Ich fand den ersten Entwurf und auch diese
   Auswahlliste, das fand ich am besten."

   ── WAS SIE TUT, UND WAS SIE AUSDRÜCKLICH NICHT TUT ──────────────────
   Sie fragt VOR dem Anlegen, woher die Daten kommen sollen, legt dann
   das Objekt an und **wählt die Quellen auf der Datenaufnahme-Zeile
   vor** — über deren echten Bedienweg, also mit `click()` auf die
   vorhandene Kachel.

   **Sie löst den Abruf NICHT aus.** Der kostet Kerosin, und eine
   Oberfläche, die beim Anlegen ungefragt Geld ausgibt, ist eine Falle.
   Der Nutzer sieht die Zeile mit seiner Auswahl und drückt „Abrufen".

   > Vorwählen ist eine Erleichterung. Auslösen wäre eine Entscheidung -
   > und die trifft, wer bezahlt.

   ── WARUM ÜBER DIE KACHELN UND NICHT ÜBER DIE ZUSTANDSVARIABLE ───────
   `selectedSources()` liest `.dp-pf-tile input:checked`. Man könnte die
   Häkchen direkt setzen - dann fehlten aber `.on`, die LED und der
   Zähler im Aufklapper, die alle an `toggleSource`/den Klickhorchern
   hängen. Ein Klick erledigt alles auf einmal.

   > Wer einen Zustand an der Datenhaltung setzt statt am Bedienelement,
   > baut sich einen zweiten Weg - und der vergisst die Hälfte.

   ── DIE QUELLEN ─────────────────────────────────────────────────────
   Gelesen wird die Zeile selbst, nicht eine eigene Liste: welche
   Kacheln es gibt, weiss nur sie. Eine feste Liste hier wäre am ersten
   Tag richtig und am dreissigsten falsch. Die Beschreibungen stehen
   unten als ZUORDNUNG nach `data-src` - fehlt eine, erscheint die
   Kachel trotzdem, nur ohne Untertitel.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotNeuesObjekt) return;

  /* Nur Beschreibung und Reihenfolge - NICHT, welche Quellen es gibt. */
  var TEXTE = {
    dealpilot:   { t: 'DealPilot Marktbewertung', u: 'Markteinschätzung aus unseren Daten' },
    dpmb:        { t: 'DealPilot Marktbewertung', u: 'Markteinschätzung aus unseren Daten' },
    import:      { t: 'Exposé oder Marktbericht', u: 'PDF einlesen — Adresse, Fläche, Preis' },
    expose:      { t: 'Exposé oder Marktbericht', u: 'PDF einlesen — Adresse, Fläche, Preis' },
    voice:       { t: 'Sprache',                  u: 'Das Objekt frei einsprechen' },
    immometrica: { t: 'ImmoMetrica',              u: 'Aus dem Bestand übernehmen' },
    spr:         { t: 'Bewertungspartner',        u: 'Externe Marktbewertung' },
    ph:          { t: 'Bewertungspartner',        u: 'Externe Marktbewertung' }
  };

  var LS = 'dp_neuobj_quellen';

  function kacheln() {
    /* Nur SICHTBARE Kacheln - die ausgeblendeten Partner (v1637) sollen
       hier nicht als Auswahl erscheinen. */
    return [].slice.call(document.querySelectorAll('.dp-pf-tile'))
      .filter(function (e) {
        var b = e.getBoundingClientRect();
        return b.width > 0 && !e.classList.contains('dp-pf-disabled');
      });
  }

  function gemerkt() {
    try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; }
  }

  /** Die gewählten Quellen auf der Zeile vorwählen - über den Bedienweg. */
  function vorwaehlen(wunsch) {
    var versuche = 0;
    (function warten() {
      var k = kacheln();
      if (!k.length && versuche++ < 30) return setTimeout(warten, 300);
      k.forEach(function (e) {
        var an = e.classList.contains('on');
        var soll = wunsch.indexOf(e.dataset.src) >= 0;
        if (an !== soll) {
          try { e.click(); } catch (x) {}
        }
      });
      /* Die Zeile in den Blick holen - wer gerade gewählt hat, will
         sehen, dass es angekommen ist. */
      try {
        var bar = document.querySelector('.dp-pfbar');
        if (bar) bar.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (x) {}
    })();
  }

  function zeige(weiter) {
    var alt = document.getElementById('dp-nq');
    if (alt) alt.remove();

    var k = kacheln();
    if (!k.length) { weiter([]); return; }   /* keine Zeile da - nicht im Weg stehen */

    var vor = gemerkt();
    var ov = document.createElement('div');
    ov.id = 'dp-nq';
    ov.className = 'dpnq-ov';
    ov.innerHTML =
      '<div class="dpnq-k" role="dialog" aria-modal="true" aria-label="Woher kommen die Daten?">'
      + '<div class="dpnq-kopf"><b>Neues Objekt</b>'
      + '<button type="button" class="dpnq-x" aria-label="Schließen">×</button></div>'
      + '<p class="dpnq-vor">Woher sollen die Daten kommen? Du kannst mehrere wählen — '
      + 'oder nichts, und alles selbst eintragen.</p>'
      + '<div class="dpnq-liste">'
      + k.map(function (e) {
          var s = e.dataset.src || '';
          var tx = TEXTE[s] || { t: (e.querySelector('.dp-pf-lbl') || {}).textContent || s, u: '' };
          var an = vor.indexOf(s) >= 0;
          return '<label class="dpnq-z' + (an ? ' an' : '') + '">'
            + '<input type="checkbox" data-src="' + s + '"' + (an ? ' checked' : '') + '>'
            + '<span class="dpnq-t"><b>' + tx.t + '</b><small>' + tx.u + '</small></span></label>';
        }).join('')
      + '</div>'
      + '<p class="dpnq-fuss">Die Auswahl wird auf der Datenaufnahme vorbereitet. '
      /* v2078: hier stand „dann erst wird Kerosin verbraucht". Den Begriff
         gibt es seit v1176 nicht mehr (config.js:238 „Kontingente statt
         Kerosin"), und die Einheit Liter ist mit ihm gefallen. */
      + '<b>Abgerufen wird erst, wenn du auf „Abrufen" drückst</b> — dann erst wird dein Kontingent belastet.</p>'
      + '<div class="dpnq-knoepfe">'
      + '<label class="dpnq-merk"><input type="checkbox" id="dpnq-merken"> Auswahl merken</label>'
      + '<button type="button" class="dpnq-b" id="dpnq-ohne">Nur anlegen</button>'
      + '<button type="button" class="dpnq-b dpnq-haupt" id="dpnq-los">Objekt anlegen</button>'
      + '</div></div>';

    document.body.appendChild(ov);

    function wahl() {
      return [].slice.call(ov.querySelectorAll('.dpnq-liste input:checked'))
        .map(function (c) { return c.dataset.src; });
    }
    function zu() { ov.remove(); }

    ov.addEventListener('change', function (e) {
      var l = e.target.closest ? e.target.closest('.dpnq-z') : null;
      if (l) l.classList.toggle('an', e.target.checked);
    });
    ov.querySelector('.dpnq-x').addEventListener('click', zu);
    ov.addEventListener('click', function (e) { if (e.target === ov) zu(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape' && document.getElementById('dp-nq')) { zu(); document.removeEventListener('keydown', esc); }
    });

    ov.querySelector('#dpnq-ohne').addEventListener('click', function () { zu(); weiter([]); });
    ov.querySelector('#dpnq-los').addEventListener('click', function () {
      var w = wahl();
      if (ov.querySelector('#dpnq-merken').checked) {
        try { localStorage.setItem(LS, JSON.stringify(w)); } catch (e) {}
      }
      zu(); weiter(w);
    });
  }

  /* ── Umhüllen ────────────────────────────────────────────────────── */
  /* ── v1695 · DREI UMHÜLLUNGEN, EIN RING ─────────────────────────────
     Marcel: „wenn ich ein neues Objekt anlegen möchte, öffnet sich ein
     Modal, es macht aber nichts, wenn ich auf Objekt anlegen klicke."

     GEMESSEN: `newObj({ohneAuswahl:true})` wirft
     **`Maximum call stack size exceeded`** — eine Endlosrekursion.

     `window.newObj` wird von DREI Stellen umhüllt:
       `neues-objekt-quellen.js:164`  (diese, mit `__nq`)
       `newobj-fixes.js:134`
       `object-actions.js:1951`      (mit `_dpObjNewWrap`)

     Die Wache unten erneuert alle 250 ms, sobald `__nq` fehlt — und das
     fehlt auch dann, wenn eine der ANDEREN Umhüllungen zuletzt
     geschrieben hat. Dann wird deren Wrapper als `orig` genommen, der
     seinerseits auf unseren alten zeigt. **Ring geschlossen.**

     > Eine Wache, die nur fragt „ist meine Marke noch da?", kann nicht
     > unterscheiden, ob sie überschrieben oder UMHÜLLT wurde. Im ersten
     > Fall muss sie neu umhüllen, im zweiten darf sie es gerade nicht.

     Zwei Sperren, beide nötig:
     1. `meinWrapper` — nie die eigene Fassung als „Original" nehmen,
        auch nicht mittelbar über eine fremde Umhüllung.
     2. `laeuft` — sollte ein Ring trotzdem entstehen, bricht er beim
        zweiten Eintritt ab, statt den Stapel zu sprengen. */
  var orig = null;
  var meinWrapper = null;
  var laeuft = false;

  function umhuellen() {
    if (typeof window.newObj !== 'function' || window.newObj.__nq) return;
    /* Zeigt die aktuelle Fassung (mittelbar) auf uns, waere jede
       weitere Umhuellung ein Ring. Dann lieber gar nichts tun: der
       bestehende Weg funktioniert, er traegt nur nicht mehr unsere
       Marke. */
    if (meinWrapper && window.newObj === meinWrapper) return;

    /* ── v1695b · `orig` DARF NICHT GETEILT SEIN ────────────────────
       Hier stand `orig = window.newObj` — eine MODULVARIABLE, die alle
       je erzeugten Wrapper gemeinsam benutzen. Jede Erneuerung durch die
       Wache hat sie umgebogen, auch fuer die ALTEN Wrapper, die noch in
       fremden Umhuellungen stecken. Danach zeigte der alte auf den
       neuen und der neue ueber die fremde Huelle auf den alten.

       > Eine Umhuellung muss ihr Original selbst festhalten. Teilt sie
       > es mit den anderen, zeigt nach dem naechsten Umhuellen jede auf
       > die falsche — und irgendwann im Kreis.

       `meinOrig` steht jetzt in der Closure. `orig` bleibt nur fuer die
       Wache erhalten, die es zuruecksetzt.                            */
    var meinOrig = window.newObj;
    orig = meinOrig;
    meinWrapper = function (opt) {
      /* Mit `{ohneAuswahl:true}` bleibt der alte Weg offen - fuer
         Aufrufer, die ein Objekt aus einem Import heraus anlegen und
         dabei nicht gefragt werden wollen. */
      if (opt && opt.ohneAuswahl) return meinOrig.apply(this, arguments);
      if (laeuft) return meinOrig.apply(this, arguments);   /* Ringbremse */
      var selbst = this, args = arguments;
      zeige(function (wunsch) {
        var r;
        laeuft = true;
        try {
          r = meinOrig.apply(selbst, args);
        } catch (e) {
          /* v1695: NICHT mehr schlucken. Hier stand `catch (e) { r = null; }`
             — und genau das hat die Rekursion unsichtbar gemacht: der
             Klick lief ins Leere, ohne dass irgendwo etwas stand.
             Ein Fehler, den niemand sieht, wird nicht behoben. */
          r = null;
          try { console.error('[neues-objekt] Anlegen fehlgeschlagen:', e); } catch (e2) {}
          if (typeof window.toast === 'function') {
            window.toast('Objekt konnte nicht angelegt werden — bitte neu laden.');
          }
        } finally {
          laeuft = false;
        }
        if (wunsch && wunsch.length) setTimeout(function () { vorwaehlen(wunsch); }, 900);
        return r;
      });
    };
    window.newObj = meinWrapper;
    window.newObj.__nq = true;
  }

  /* ── WARUM EIN WÄCHTER UND KEIN EINMALIGES UMHÜLLEN ──────────────────
     GEMESSEN am 26.09.2026: nach dem ersten Umhüllen war
     `window.newObj.__nq` wieder `false`. Ursache ist keine Zeitfrage,
     sondern die Reihenfolge der Skripte:

       `function newObj() {…}` ist eine DEKLARATION. Sie wird beim
       Auswerten IHRES Skripts an `window` gebunden - und überschreibt
       dabei alles, was vorher dort stand, auch meine Umhüllung.

     > Eine Umhüllung, die vor der Deklaration läuft, wird von ihr
     > aufgefressen. Wer nicht weiss, wann die Deklaration kommt, muss
     > NACHSEHEN, nicht warten.

     Deshalb: nicht aufhören, sobald einmal umhüllt wurde, sondern
     nachsehen, ob die Umhüllung noch DA ist - dreissig Sekunden lang,
     und ein letztes Mal nach `load`. Danach steht sie. */
  var n = 0;
  (function wache() {
    if (!window.newObj || !window.newObj.__nq) { orig = null; umhuellen(); }
    if (n++ < 120) setTimeout(wache, 250);
  })();
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (!window.newObj || !window.newObj.__nq) { orig = null; umhuellen(); }
    }, 400);
  });

  window.DealPilotNeuesObjekt = {
    zeige: zeige,
    vorwaehlen: vorwaehlen,
    vergessen: function () { try { localStorage.removeItem(LS); } catch (e) {} }
  };
})();
