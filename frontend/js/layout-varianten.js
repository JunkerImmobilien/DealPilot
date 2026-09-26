/* ═══════════════════════════════════════════════════════════════════════
   layout-varianten.js · v1635
   ───────────────────────────────────────────────────────────────────────
   Marcel am 26.09.2026: „Kannst du mir diese Designs komplett umsetzen in
   Staging, dass ich zwischen den einzelnen UIs umschalten kann? Es müssen
   natürlich alle Funktionen da sein."

   ── DER ENTSCHEIDENDE SATZ: ES WIRD NICHTS NACHGEBAUT ─────────────────
   Diese Datei erzeugt KEINE zweite Oberfläche. Sie verschiebt die
   VORHANDENEN Knoten und lässt den Rest die CSS-Schicht machen.

   Warum das die einzige ehrliche Bauweise ist: ein nachgebautes Menü
   hätte am ersten Tag dieselben Einträge und am dreissigsten nicht mehr.
   Jeder neue Knopf müsste an zwei Stellen gepflegt werden, und die
   zweite vergisst man. Ein verschobener Knoten behält seinen
   Ereignishorcher, seinen Zustand und seine Beschriftung - für immer.

   > `appendChild` VERSCHIEBT, es kopiert nicht. Ereignishorcher,
   > Datensätze und laufende Zustände bleiben am Knoten hängen.

   ── WAS GEMESSEN WURDE, BEVOR ICH ANGEFANGEN HABE ─────────────────────
   Am laufenden Stand (v1634b, 1707x917):

     .app-wrap
       aside#sidebar            380 px   Logo · Neu · Suche · Objektkarten
         #sb-actions-accordion           12 Aktionen (zugeklappt)
         #sb-actions-trigger-btn         der Aufklapper
         #sb-user                 82 px  Name · Mail · Plan · Abmelden
       .main-col
         header.hdr              189 px
           .hdr-v61-row1          48 px  Objektnummer · Name · Fortschritt
             #hdr-score-mini             <- GIBT ES SCHON, ist nur leer
           .hdr-v61-row2         141 px
             .scores > .sc-main          <- der GROSSE Score
                     > .sc-pill x5       <- Rendite · Finanz · Risiko · Lage · Upside
         nav.tabs                 44 px  neun .tab-Knöpfe
         .body                           der Inhalt

   **Alles, was gebraucht wird, ist schon da** - auch Nutzer, Plan,
   Abmelden, Support und Rundgang. Es steht nur an der falschen Stelle.

   ── WIE DIE SCHIENE GESETZT WIRD, UND WARUM NICHT MIT GRID ────────────
   `.main-col` hat über sechzig Kinder, die meisten `<script>`. Ein
   `display:grid` darauf würde jedes sichtbare davon zu einem Gitterkind
   machen und an unvorhersehbarer Stelle einsortieren.

   Deshalb steht die Schiene bei den Seitenlayouts `position:fixed` -
   damit ist sie aus dem Fluss und kann mit niemandem kollidieren; der
   Platz entsteht über ein Polster am `.app-wrap`. Bei den waagerechten
   Layouts bleibt sie im Fluss und wird nur über `order` einsortiert.

   ── UMKEHRBARKEIT ─────────────────────────────────────────────────────
   Zu jedem verschobenen Knoten wird Elternteil UND nächstes Geschwister
   gemerkt. `zurueck()` stellt beides wieder her - `insertBefore(knoten,
   merker.naechstes)` trifft auch dann, wenn dazwischen etwas dazukam.
   Ohne den Merker landet ein Knoten am Ende und die Reihenfolge kippt
   still.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotLayout) return;

  var LS = 'dp_layout';

  /* Welche Knoten wandern in die Schiene - je Layout.
     `tabs` steht nur bei v1 dabei: nur dort werden die Reiter senkrecht. */
  var LAYOUTS = {
    v1: { name: 'Aktenmappe',   schiene: 'links',  nimmt: ['tabs', 'aktionen', 'nutzer'], objekteAls: 'schublade' },
    v2: { name: 'Kanzlei',      schiene: 'rechts', nimmt: ['aktionen', 'nutzer'],          objekteAls: 'spalte' },
    v3: { name: 'Werkbank',     schiene: 'leiste', nimmt: ['aktionen', 'nutzer'],          objekteAls: 'schublade' },
    v4: { name: 'Dossier',      schiene: 'fuss',   nimmt: ['aktionen', 'nutzer'],          objekteAls: 'schublade' },
    v5: { name: 'Cockpit hell', schiene: null,     nimmt: [],                              objekteAls: 'spalte' }
  };

  var KNOTEN = {
    tabs:     'nav.tabs',
    aktionen: '#sb-actions-accordion',
    schalter: '#sb-actions-trigger-btn',
    nutzer:   '#sb-user'
  };

  var merker = [];       /* [{ knoten, eltern, naechstes }] */
  var schiene = null;
  var aktuell = '';

  function el(s) { return document.querySelector(s); }

  /* ── Verschieben mit Rückfahrkarte ──────────────────────────────── */
  function hole(sel) {
    var k = el(sel);
    if (!k) return null;
    merker.push({ knoten: k, eltern: k.parentElement, naechstes: k.nextElementSibling });
    return k;
  }
  function zurueck() {
    /* Rückwärts, damit die zuletzt herausgenommenen zuerst zurückgehen -
       sonst zeigt `naechstes` auf einen Knoten, der noch nicht da ist. */
    for (var i = merker.length - 1; i >= 0; i--) {
      var m = merker[i];
      try {
        if (m.naechstes && m.naechstes.parentElement === m.eltern) m.eltern.insertBefore(m.knoten, m.naechstes);
        else m.eltern.appendChild(m.knoten);
      } catch (e) {}
    }
    merker = [];
    if (schiene && schiene.parentElement) schiene.parentElement.removeChild(schiene);
    schiene = null;
  }

  /* ── Die Schiene bauen ──────────────────────────────────────────── */
  function baueSchiene(v) {
    var L = LAYOUTS[v];
    var mc = el('.main-col');
    if (!mc) return;

    schiene = document.createElement('div');
    schiene.className = 'dpl-schiene';
    schiene.setAttribute('data-stellung', L.schiene);

    /* Marke oben - nur bei den senkrechten Schienen, sonst doppelt sich
       das Logo mit der Objektspalte. */
    if (L.schiene === 'links' || L.schiene === 'rechts') {
      var marke = document.createElement('div');
      marke.className = 'dpl-marke';
      marke.innerHTML = '<span class="dpl-wm">Deal<i>Pilot</i></span>';
      schiene.appendChild(marke);
    }

    /* Portfolio-Knopf: nur wo die Objektspalte zur Schublade wird.
       Er bedient den VORHANDENEN Umschalter, statt einen zweiten Weg
       aufzumachen - zwei Wege zu demselben Zustand laufen auseinander. */
    if (L.objekteAls === 'schublade') {
      var pb = document.createElement('button');
      pb.type = 'button';
      pb.className = 'dpl-portfolio';
      pb.innerHTML = '<span class="dpl-i">▣</span><span class="dpl-t">Portfolio</span>'
        + '<span class="dpl-n" id="dpl-obj-zahl"></span>';
      pb.addEventListener('click', function () { portfolio(); });
      schiene.appendChild(pb);
    }

    L.nimmt.forEach(function (art) {
      var k = hole(KNOTEN[art]);
      if (k) {
        var h = document.createElement('div');
        h.className = 'dpl-teil dpl-teil-' + art;
        h.appendChild(k);
        /* Der Aufklapper gehört zum Aktionsblock und wandert mit. */
        if (art === 'aktionen') {
          var s = hole(KNOTEN.schalter);
          if (s) h.insertBefore(s, k);
        }
        schiene.appendChild(h);
      }
    });

    mc.appendChild(schiene);
    zahlNachziehen();
  }

  function zahlNachziehen() {
    var n = document.querySelectorAll('#sb-list .sb-card').length;
    var z = el('#dpl-obj-zahl');
    if (z) z.textContent = n ? String(n) : '';
  }

  /* ── Die Objektspalte als Schublade ─────────────────────────────── */
  function portfolio(zu) {
    var auf = zu === undefined
      ? document.documentElement.getAttribute('data-dpl-portfolio') !== 'auf'
      : !zu;
    document.documentElement.setAttribute('data-dpl-portfolio', auf ? 'auf' : 'zu');
  }

  /* Ein Klick auf eine Objektkarte schliesst die Schublade - sonst steht
     sie über dem Objekt, das man gerade geöffnet hat. */
  document.addEventListener('click', function (e) {
    if (!aktuell) return;
    if (document.documentElement.getAttribute('data-dpl-portfolio') !== 'auf') return;
    var k = e.target.closest ? e.target.closest('.sb-card, .sb-add-new') : null;
    if (k) setTimeout(function () { portfolio(true); }, 60);
  }, true);

  /* Escape schliesst die Schublade. NICHT die Reiter oder etwas anderes -
     eine Taste, die mehr tut als eine Sache, überrascht. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.documentElement.getAttribute('data-dpl-portfolio') === 'auf') {
      portfolio(true);
    }
  });

  /* ── Setzen ─────────────────────────────────────────────────────── */
  function setze(v) {
    v = String(v || '');
    if (v && !LAYOUTS[v]) v = '';
    zurueck();
    aktuell = v;
    var h = document.documentElement;
    if (!v) {
      h.removeAttribute('data-dp-layout');
      h.removeAttribute('data-dpl-portfolio');
      try { localStorage.removeItem(LS); } catch (e) {}
      schalterNachziehen();
      return;
    }
    h.setAttribute('data-dp-layout', v);
    h.setAttribute('data-dpl-portfolio', 'zu');
    /* Der helle Grund kommt vom VORHANDENEN Skin, nicht von hier.
       `body.dp-chrome-hell` ist 103 geprüfte Regeln; eine zweite
       Hellfassung danebenzustellen hiesse, jede künftige Änderung an
       zwei Stellen zu pflegen - und die zweite vergisst man. Diese
       Datei ordnet den Raum, sie färbt ihn nicht. */
    try { if (typeof window._dpDispSkin === 'function') window._dpDispSkin('hell'); } catch (e) {}
    if (LAYOUTS[v].schiene) baueSchiene(v);
    try { localStorage.setItem(LS, v); } catch (e) {}
    schalterNachziehen();
  }

  /* ── Der Umschalter ─────────────────────────────────────────────── */
  var leiste = null;
  function baueSchalter() {
    if (leiste) return;
    leiste = document.createElement('div');
    leiste.className = 'dpl-schalter';
    leiste.innerHTML = '<span class="dpl-schalter-k">Layout</span>';
    var mach = function (wert, text) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = text; b.dataset.wert = wert;
      b.addEventListener('click', function () { setze(wert); });
      leiste.appendChild(b);
    };
    mach('', 'Heute');
    Object.keys(LAYOUTS).forEach(function (k, i) { mach(k, (i + 1) + ' · ' + LAYOUTS[k].name); });
    var zu = document.createElement('button');
    zu.type = 'button'; zu.className = 'dpl-schalter-zu'; zu.textContent = '×';
    zu.title = 'Umschalter ausblenden (kommt mit ?layout= zurück)';
    zu.addEventListener('click', function () {
      leiste.remove(); leiste = null;
      try { localStorage.removeItem('dp_layout_schalter'); } catch (e) {}
    });
    leiste.appendChild(zu);
    document.body.appendChild(leiste);
  }
  function schalterNachziehen() {
    if (!leiste) return;
    [].forEach.call(leiste.querySelectorAll('button[data-wert]'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.wert === aktuell));
    });
  }

  /* ── Start ──────────────────────────────────────────────────────── */
  function start() {
    var p = new URLSearchParams(location.search);
    var ausUrl = p.get('layout');
    var gemerkt = '';
    try { gemerkt = localStorage.getItem(LS) || ''; } catch (e) {}

    if (ausUrl !== null) {
      /* ?layout=3 und ?layout=v3 sind beide erlaubt - wer die Zahl aus
         dem Umschalter abliest, tippt keine v davor. */
      var v = /^[1-5]$/.test(ausUrl) ? 'v' + ausUrl : ausUrl;
      setze(v === 'aus' ? '' : v);
      try { localStorage.setItem('dp_layout_schalter', '1'); } catch (e) {}
    } else if (gemerkt) {
      setze(gemerkt);
    }

    var zeigen = false;
    try { zeigen = localStorage.getItem('dp_layout_schalter') === '1'; } catch (e) {}
    if (zeigen) { baueSchalter(); schalterNachziehen(); }

    /* Die Objektzahl ändert sich, wenn Karten nachgeladen werden. */
    var l = el('#sb-list');
    if (l && window.MutationObserver) {
      new MutationObserver(zahlNachziehen).observe(l, { childList: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DealPilotLayout = {
    setze: setze,
    layouts: LAYOUTS,
    aktuell: function () { return aktuell; },
    schalter: function () { baueSchalter(); schalterNachziehen();
      try { localStorage.setItem('dp_layout_schalter', '1'); } catch (e) {} }
  };
})();
