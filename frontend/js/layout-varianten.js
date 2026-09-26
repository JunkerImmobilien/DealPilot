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
    v1: { name: 'Aktenmappe',   schiene: 'links',  nimmt: ['tabs', 'aktionen', 'nutzer'], objekteAls: 'schublade', beschreibung: 'Menü links als Gliederung' },
    v2: { name: 'Kanzlei',      schiene: 'rechts', nimmt: ['aktionen', 'nutzer'],          objekteAls: 'spalte', beschreibung: 'Objekte links, Aktionen rechts' },
    v3: { name: 'Werkbank',     schiene: 'leiste', nimmt: ['aktionen', 'nutzer'],          objekteAls: 'schublade', beschreibung: 'Volle Breite, Leiste oben' },
    v4: { name: 'Dossier',      schiene: 'fuss',   nimmt: ['aktionen', 'nutzer'],          objekteAls: 'schublade', beschreibung: 'Wie das fertige Dokument' },
    v5: { name: 'Cockpit hell', schiene: null,     nimmt: [],                              objekteAls: 'spalte', beschreibung: 'Heutiger Aufbau, entschlackt' }
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
      /* ── WESSEN MARKE HIER STEHT ──────────────────────────────────
         Bei einem Whitelabel-Mandanten SEINE, sonst unsere. Gefragt
         wird dieselbe Stelle, aus der auch die PDFs ihr Logo holen
         (`DealPilotConfig.branding.get().logo_b64`) - nicht ein
         zweiter Weg, der irgendwann auseinanderläuft.

         Der Schriftzug trägt `--dpl-gold-lo`, und das hängt am Token
         `--wl-b8932f`. Gemessen mit einem fremden Markenton: das „Pilot"
         wurde rgb(35,85,138), also der Partnerton - ohne eine Zeile
         Sonderbehandlung. */
      var eigenes = '';
      try {
        var b = (window.DealPilotConfig && window.DealPilotConfig.branding
          && typeof window.DealPilotConfig.branding.get === 'function')
          ? (window.DealPilotConfig.branding.get() || {}) : {};
        if (b.logo_b64) eigenes = String(b.logo_b64);
      } catch (e) {}
      marke.innerHTML = eigenes
        ? '<img class="dpl-logo" alt="">'
        : '<span class="dpl-wm">Deal<i>Pilot</i></span>';
      if (eigenes) marke.querySelector('img').src = eigenes;
      schiene.appendChild(marke);
    }

    /* Portfolio-Knopf: nur wo die Objektspalte zur Schublade wird.
       Er bedient den VORHANDENEN Umschalter, statt einen zweiten Weg
       aufzumachen - zwei Wege zu demselben Zustand laufen auseinander. */
    /* v1639 · IMMER anlegen, auch wenn die Objektspalte dauerhaft steht.
       Grund: unter 900 px wird sie in JEDEM Layout zur Schublade (siehe
       layout-varianten.css) - ohne diesen Knopf gaebe es dort keinen Weg
       mehr an die Objektliste. Auf breiten Schirmen blendet die CSS ihn
       bei den Spalten-Layouts aus.

       > Ein Bedienelement, das nur auf einem Geraet existiert, vergisst
       > man beim Umbau des anderen. Lieber immer da und manchmal
       > unsichtbar. */
    {
      schiene.setAttribute('data-objekte', L.objekteAls);
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

  /* ── Der Platz in den Einstellungen ──────────────────────────────────
     Marcel: „ich hoffe, die haben wir in den Einstellungen irgendwo bei
     Anzeige oder Darstellung angegeben."

     Der Abschnitt wird in das VORHANDENE Darstellungs-Panel eingehängt
     (`#dpuv-panel` aus `ui-varianten.js`), mit dessen eigener
     Markup-Sprache: `.dpuv-g` für die Gruppe, `.dpuv-seg`/`.dpuv-sgb`
     für die Kacheln. Damit erbt er Aussehen, Abstände und jede künftige
     Änderung an diesem Panel automatisch.

     > `ui-varianten.js` hat 1.296 Zeilen und eine eigene Speicher- und
     > Anwendungsmechanik. Dort hineinzuschreiben hiesse, sie zu
     > verstehen UND zu riskieren. Ein Abschnitt, der sich von aussen
     > einhängt, kann sie nicht kaputtmachen.

     Eingehängt wird beim Öffnen - das Panel wird erst dann gebaut. */
  var beobachter = null;
  function inPanel() {
    var panel = document.getElementById('dpuv-b');
    if (!panel || document.getElementById('dpl-sek')) return;

    var g = document.createElement('div');
    g.className = 'dpuv-g';
    g.id = 'dpl-sek';
    var kacheln = [{ key: '', name: 'Heute', sub: 'Unverändert' }].concat(
      Object.keys(LAYOUTS).map(function (k, i) {
        return { key: k, name: (i + 1) + ' · ' + LAYOUTS[k].name, sub: LAYOUTS[k].beschreibung };
      }));
    g.innerHTML = '<h3>Aufbau</h3>'
      + '<p class="dpuv-hint">Wo Menü, Aktionen und Objektliste stehen. '
      + 'Die Arbeitsfläche bleibt in allen gleich — es wechselt nur der Rahmen. '
      + 'Ein Aufbau schaltet die Oberfläche auf <b>hell</b>.</p>'
      + '<div class="dpuv-seg" id="dpl-seg">'
      + kacheln.map(function (o) {
          return '<button type="button" class="dpuv-sgb' + (o.key === aktuell ? ' on' : '')
            + '" data-v="' + o.key + '"><b>' + o.name + '</b><small>'
            + (o.sub || '') + '</small></button>';
        }).join('')
      + '</div>';

    /* Vor die Modus-Gruppe: der Aufbau ist die gröbere Entscheidung,
       und grobe Entscheidungen gehören nach oben. */
    panel.insertBefore(g, panel.firstChild);

    g.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dpuv-sgb') : null;
      if (!b) return;
      setze(b.dataset.v);
      [].forEach.call(g.querySelectorAll('.dpuv-sgb'), function (x) {
        x.classList.toggle('on', x.dataset.v === aktuell);
      });
    });
  }

  function panelBeobachten() {
    if (beobachter || !window.MutationObserver) return;
    beobachter = new MutationObserver(function () { inPanel(); });
    beobachter.observe(document.body, { childList: true });
    inPanel();
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
    panelBeobachten();

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
