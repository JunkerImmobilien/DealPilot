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
      + '<b>Abgerufen wird erst, wenn du auf „Abrufen" drückst</b> — dann erst wird Kerosin verbraucht.</p>'
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
  var orig = null;
  function umhuellen() {
    if (typeof window.newObj !== 'function' || window.newObj.__nq) return;
    orig = window.newObj;
    window.newObj = function (opt) {
      /* Mit `{ohneAuswahl:true}` bleibt der alte Weg offen - fuer
         Aufrufer, die ein Objekt aus einem Import heraus anlegen und
         dabei nicht gefragt werden wollen. */
      if (opt && opt.ohneAuswahl) return orig.apply(this, arguments);
      var selbst = this, args = arguments;
      zeige(function (wunsch) {
        var r;
        try { r = orig.apply(selbst, args); } catch (e) { r = null; }
        if (wunsch && wunsch.length) setTimeout(function () { vorwaehlen(wunsch); }, 900);
        return r;
      });
    };
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
