/* ═══════════════════════════════════════════════════════════════════════
   dp2-inhalt.js · v1540 · Rendert Module, Geschichten und die Matrix
   ───────────────────────────────────────────────────────────────────────
   Die Daten stehen in dp2-daten.js und sind unveraendert aus der
   bisherigen Landing uebernommen. Hier steht nur, WIE sie aussehen.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 1 · Die 19 Module als Boarding-Pass-Karten ──────────────────── */
  var grid = document.getElementById('bpGrid');
  if (grid && window.DP_MODULE) {
    grid.innerHTML = window.DP_MODULE.map(function (m, i) {
      var nr = String(i + 1).padStart(2, '0');
      return '<div class="bp rv">'
        + '<div class="bp-top"><span>DEALPILOT · MODUL</span><span>' + nr + '</span></div>'
        + '<div class="bp-in">'
        + '<div class="bp-ico">' + m.i + '</div>'
        + '<h3>' + m.t + '</h3>'
        + '<p class="sb">' + m.s + '</p>'
        + '<ul>' + m.b.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul>'
        + '</div>'
        + '<div class="bp-tear"><span class="nl"></span><span class="nr"></span></div>'
        + '<div class="bp-stub"><span>Gate DP-' + nr + '</span><b>an Bord ✈</b></div>'
        + '</div>';
    }).join('');
    durchlauf(grid);
  }

  /* ══ Der Modul-Durchlauf ═══════════════════════════════════════════════
     v1545 · Marcel am 22.09.2026: "Jeder Bereich ein Boarding-Pass - das
     ist sehr viel. Kann man das visuell besser darstellen? Auch animieren,
     vielleicht Slider oder so als Durchlauf. Es nimmt viel Platz ein."

     Neunzehn Karten untereinander waren fuenf Reihen. Jetzt stehen vier
     nebeneinander und der Rest faehrt durch - dieselben Inhalte auf einem
     Viertel der Hoehe.

     Wie viele nebeneinander stehen, wird nicht geraten, sondern an der
     echten Breite der ersten Karte GEMESSEN - sonst laeuft die Anzeige
     "1-4 von 19" am Handy gegen die Wirklichkeit. */
  function durchlauf(grid) {
    var karten = [].slice.call(grid.children);
    if (karten.length < 2) return;
    var bar = document.getElementById('bpBar');
    var zahl = document.getElementById('bpZahl');
    var vor = document.getElementById('bpNext');
    var zur = document.getElementById('bpPrev');
    var pos = 0, uhr = null;

    function proSeite() {
      var b = karten[0].getBoundingClientRect().width;
      var v = grid.parentElement.getBoundingClientRect().width;
      if (!b) return 1;
      return Math.max(1, Math.round(v / (b + 16)));
    }
    function zeige(p) {
      var n = proSeite(), max = Math.max(0, karten.length - n);
      pos = Math.max(0, Math.min(p, max));
      var b = karten[0].getBoundingClientRect().width + 16;
      grid.style.transform = 'translateX(' + (-pos * b) + 'px)';
      var bis = Math.min(pos + n, karten.length);
      if (zahl) zahl.textContent = (pos + 1) + '\u2013' + bis;
      if (bar) {
        bar.style.width = (n / karten.length * 100).toFixed(1) + '%';
        bar.style.marginLeft = (pos / karten.length * 100).toFixed(1) + '%';
      }
    }
    function weiter() {
      var n = proSeite();
      zeige(pos + n > karten.length - n ? 0 : pos + n);
    }
    if (vor) vor.addEventListener('click', function () { weiter(); halt(); });
    if (zur) zur.addEventListener('click', function () { zeige(pos - proSeite()); halt(); });

    /* Autoplay. Im verborgenen Tab wird jeder Timer auf rund eine Sekunde
       gedrosselt - deshalb wird dort gar nicht erst weitergeschaltet. */
    function lauf() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      uhr = setInterval(function () {
        if (document.visibilityState !== 'visible') return;
        weiter();
      }, 5200);
    }
    function halt() { if (uhr) { clearInterval(uhr); uhr = null; } }
    grid.parentElement.addEventListener('mouseenter', halt);
    addEventListener('resize', function () { clearTimeout(window._bpT); window._bpT = setTimeout(function () { zeige(pos); }, 160); });

    /* Wischen am Handy */
    var x0 = null;
    grid.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; halt(); }, { passive: true });
    grid.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var d = e.changedTouches[0].clientX - x0;
      if (Math.abs(d) > 45) zeige(pos + (d < 0 ? proSeite() : -proSeite()));
      x0 = null;
    }, { passive: true });

    zeige(0);
    lauf();
  }

  /* ── 2 · Die 16 Geschichten als Karussell ────────────────────────── */
  var track = document.getElementById('stxTrack');
  var dots = document.getElementById('stxDots');
  if (track && window.DP_STORIES) {
    var S = window.DP_STORIES, akt = 0;
    track.innerHTML = S.map(function (s) {
      var absaetze = (Array.isArray(s.body) ? s.body : [s.body])
        .map(function (p) { return '<p>' + p + '</p>'; }).join('');
      return '<div class="stx-item"><div class="stx-in">'
        + '<div><span class="stx-tag">' + s.tag + '</span>'
        + '<blockquote class="stx-scene">' + s.scene + '</blockquote></div>'
        + '<div class="stx-body">' + absaetze
        + (s.pay ? '<div class="stx-pay">✈ ' + s.pay + '</div>' : '')
        + '</div></div></div>';
    }).join('');
    dots.innerHTML = S.map(function (_, i) {
      return '<i data-i="' + i + '"' + (i === 0 ? ' class="on"' : '') + '></i>';
    }).join('');

    function zeige(i) {
      akt = (i + S.length) % S.length;
      track.style.transform = 'translateX(' + (-akt * 100) + '%)';
      dots.querySelectorAll('i').forEach(function (d, j) { d.classList.toggle('on', j === akt); });
    }
    dots.addEventListener('click', function (e) {
      var d = e.target.closest('i[data-i]'); if (d) { zeige(parseInt(d.dataset.i, 10)); halt(); }
    });
    document.getElementById('stxPrev').addEventListener('click', function () { zeige(akt - 1); halt(); });
    document.getElementById('stxNext').addEventListener('click', function () { zeige(akt + 1); halt(); });

    /* Autoplay - haelt an, sobald jemand selbst blaettert, und laeuft im
       verborgenen Tab gar nicht erst (dort wird jeder Timer gedrosselt). */
    var uhr = null;
    function lauf() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      uhr = setInterval(function () {
        if (document.visibilityState !== 'visible') return;
        zeige(akt + 1);
      }, 12000);
    }
    function halt() { if (uhr) { clearInterval(uhr); uhr = null; } }
    var vp = track.parentElement;
    vp.addEventListener('mouseenter', halt);
    lauf();
  }

  /* ── 3 · Die Cockpit-Matrix ──────────────────────────────────────── */
  /* [Funktion, Free, Starter, Investor, Pro]
     '+' = enthalten · '-' = nicht enthalten · alles andere wird als
     Wert gesetzt. Vollstaendig aus der bisherigen Matrix uebernommen. */
  var MX = [
    ['Die ersten 4 Wochen', 'Pro · 5 · 3 · 1', '-', '-', '-'],
    ['Objekte', '1', '5', '25', '∞'],
    ['Marktpreisindikation / Monat', '1', '5', '5', '5'],
    ['Erweiterte Marktpreisindikation / Monat', '-', '-', '5', '5'],
    ['Wertermittlung nach ImmoWertV / Monat', '-', '-', '-', '5'],
    ['Nicht genutzte Abrufe bleiben erhalten', '-', '+', '+', '+'],
    ['Bewertungen nachkaufen', '-', '+', '+', '+'],
    ['DealPilot Score (5 Faktoren)', '+', '+', '+', '+'],
    ['Investor Deal Score (24 KPIs)', 'Demo', '-', '+', '+'],
    ['Boarding (Schnellprüfung)', '+', '+', '+', '+'],
    ['Pilot-Analyse (KI)', 'vereinfacht', 'vereinfacht', 'Vollversion', 'Vollversion'],
    ['Pilot-Lagebewertung (KI)', '-', '+', '+', '+'],
    ['DealPilot Marktreport', '-', '+', '+', '+'],
    ['Deal-Aktion (Anfragen / Gutachten)', '+', '+', '+', '+'],
    ['RND-Einschätzung &amp; Gutachten-Anfrage', 'nur Anfrage', 'nur Anfrage', '+', '+'],
    ['Marktdatenfelder', 'gesperrt*', 'gesperrt*', '+', '+'],
    ['Live-Marktzinsen', '-', '-', '+', '+'],
    ['Mietspiegel-Vergleich', '-', 'manuell', 'automatisch', 'automatisch'],
    ['Marktdaten-Schnittstellen', 'Demo', 'zubuchbar', 'zubuchbar', 'zubuchbar'],
    ['BMF-Rechner &amp; Export', '-', '-', '+', 'Advanced'],
    ['Finanzierung', 'Demo', 'Hauptdarlehen', '+ KfW &amp; Bauspar', 'wie Investor'],
    ['AfA-Methoden', 'Demo', 'linear + § 7b', '+ degressiv', 'wie Investor'],
    ['Werbungskosten-Modul', 'Demo', '+', '+', '+'],
    ['Investment-PDF', 'Wasserzeichen', '+', '+', '+'],
    ['Werbungskosten-PDF', '-', '-', '+', '+'],
    ['Track-Record-PDF', 'Wasserzeichen', '-', '+', '+'],
    ['Eigenes Logo &amp; Footer im PDF', '-', '-', '+', '+'],
    ['Bankexport (PDF / Excel)', '-', '-', '+', '+'],
    ['Rohdatenexport (CSV / XLSX)', '-', '-', '-', '+'],
    ['JSON-Objektsicherung', '-', '-', '-', '+'],
    ['Exposé-Import', '+', '+', '+', '+'],
    ['Marktbericht-Import', '+', '+', '+', '+'],
    ['Excel-Import', '-', '+', '+', '+'],
    ['API-Zugang', '-', '-', '-', '+'],
    ['Migration &amp; Setup-Service', '-', '-', '-', '3 h'],
  ];
  var body = document.getElementById('mxBody');
  if (body) {
    body.innerHTML = MX.map(function (z) {
      return '<tr><td>' + z[0] + '</td>' + z.slice(1).map(function (v) {
        if (v === '+') return '<td class="ja">✓</td>';
        if (v === '-') return '<td class="nein">–</td>';
        return '<td class="wert">' + v + '</td>';
      }).join('') + '</tr>';
    }).join('');
  }

  /* ── 4 · Tarif-Umschalter ────────────────────────────────────────── */
  /* ══ Der Monatlich/Jaehrlich-Umschalter ═══════════════════════════════
     v1551 · Die Tickets tragen jetzt das Markup der bisherigen Landing:
     der Preis steht in .tk-price mit data-m und data-y, die Notiz in
     .tk-note mit data-save. Die Partner-Karte behaelt ihr eigenes
     data-m/data-j - beide Schreibweisen werden gelesen, damit keine
     Zahl stehen bleibt, nur weil sie anders benannt ist. */
  var zeit = 'm';
  function eur(n) { return Number(n).toFixed(2).replace('.', ',').replace(/,00$/, ''); }
  function preise() {
    /* Die Tickets */
    document.querySelectorAll('.tk-price[data-m]').forEach(function (e) {
      var m = e.dataset.m, y = e.dataset.y;
      if (m == null || y == null) return;
      e.innerHTML = '<b>' + (zeit === 'j' ? eur(y) : eur(m)) + '</b>'
        + '<span class="cur">€</span>'
        + '<span class="per">/ ' + (zeit === 'j' ? 'Jahr' : 'Monat') + '</span>';
    });
    document.querySelectorAll('.tk-note[data-save]').forEach(function (e) {
      var k = e.closest('.tk'), pr = k && k.querySelector('.tk-price[data-m]');
      if (!pr) return;
      e.textContent = zeit === 'j'
        ? 'spart ' + e.dataset.save + ' € im Jahr'
        : 'oder ' + eur(pr.dataset.y) + ' €/Jahr';
    });
    /* Die Partner-Karte */
    document.querySelectorAll('.pr[data-m], .prn[data-m]').forEach(function (e) {
      var v = e.dataset[zeit]; if (v == null) return;
      if (e.classList.contains('pr')) e.innerHTML = v + '<small> / ' + (zeit === 'j' ? 'Jahr' : 'Monat') + '</small>';
      else e.textContent = v;
    });
  }
  var sz = document.getElementById('segZeit');
  if (sz) sz.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-zeit]'); if (!b) return;
    this.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on'); zeit = b.dataset.zeit; preise();
  });

  var SUB = {
    einzel: 'Für private Investoren — ein Konto, deine Objekte.',
    partner: 'Für Kanzleien, Maklerbüros und Finanzierer — Ihre Mandanten unter Ihrer Marke.',
  };
  function artSetzen(art) {
    var p = art === 'partner';
    document.getElementById('boxPartner').classList.toggle('on', p);
    document.getElementById('boxEinzel').classList.toggle('off', p);
    document.getElementById('segSub').textContent = SUB[art];
    document.querySelectorAll('#segArt button').forEach(function (x) {
      x.classList.toggle('on', x.dataset.art === art);
    });
    /* Was gerade eingeblendet wird, darf nicht auf opacity 0 stehen bleiben. */
    document.querySelectorAll('.rv:not(.in)').forEach(function (e) { e.classList.add('in'); });
    preise();
  }
  var sa = document.getElementById('segArt');
  if (sa) sa.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-art]'); if (b) artSetzen(b.dataset.art);
  });
  /* Direktlink #partner-plan oeffnet die Partner-Ansicht. */
  if (location.hash === '#partner-plan') artSetzen('partner');
  document.querySelectorAll('a[href="#partner-plan"]').forEach(function (a) {
    a.addEventListener('click', function () { setTimeout(function () { artSetzen('partner'); }, 30); });
  });

  /* ══ 5 · Live-Marktzinsen ══════════════════════════════════════════
     v1544 · Marcel am 22.09.2026: "Die Live-Marktzinsen sind wirklich
     live und so von der alten Seite?"

     Gemessen: JA, die Zinsen sind echt. Die Route antwortet auf Prod und
     Staging mit source:"live", Stand 21.09.2026, Quelle Deutsche
     Bundesbank. ABER mein Abruf war falsch gebaut und ist still
     gescheitert - er las d.rates, und dieses Feld gibt es nicht. Die
     Antwort fuehrt:

       yields          {"5":3.68,"10":3.88,"15":3.99,"20":4.05}
       margins         {"premium":0.2,"standard":0.3,"schwach":0.55}
       indicativeRates {"10":{"premium":4.08,"standard":4.18,...}}

     Dazu haette meine Rechnung "+1,00 % Marge" auch inhaltlich nicht
     gestimmt: die Marge liefert die Schnittstelle selbst mit, und sie
     liegt bei 0,2 bis 0,55 - nicht bei 1,0. Die alte Seite liest
     indicativeRates, also die fertig gerechneten Werte. Genau das tut
     diese Fassung jetzt auch.

     Schlaegt der Abruf fehl, bleiben die Werte im HTML stehen - sie
     tragen einen Stand und sind damit ehrlich, nur nicht tagesaktuell. */
  var MON = ['Jan','Feb','M\u00e4r','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  function pz(v) { return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + '\u00a0%'; }
  /* v1547: RELATIVER Pfad, nicht die App-Domain. Gemessen am
       22.09.2026: ein Abruf von staging.dealpilot.immo nach
       app.dealpilot.immo scheitert an CORS (Failed to fetch, die
       App-Domain sendet keine Access-Control-Header). Ueber die
       EIGENE Domain kommt derselbe Endpunkt mit 200 durch - der
       Caddy leitet ihn weiter. Beim Nutzerzaehler steht es laengst
       so; hier war es inkonsequent. */
  fetch('/api/v1/market-rates/pfandbrief?maturities=5,10,15,20')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      /* Defensiv: die Nutzdaten koennen oben oder unter .data liegen. */
      var d = res && res.indicativeRates ? res
        : (res && res.data && res.data.indicativeRates ? res.data : null);
      if (!d || !d.indicativeRates) return;
      var karten = document.querySelectorAll('#condG .cond-c');
      ['5', '10', '15', '20'].forEach(function (j, i) {
        var satz = d.indicativeRates[j], roh = d.yields && d.yields[j];
        if (!satz || !karten[i]) return;
        var zins = satz.standard != null ? satz.standard : satz.premium;
        if (zins == null) return;
        karten[i].querySelector('.zs').textContent = pz(zins);
        var marge = d.margins && d.margins.standard;
        karten[i].querySelector('.er').textContent = (roh != null)
          ? 'Pfandbrief ' + pz(roh) + ' + Marge ' + (marge != null ? pz(marge) : '\u2013')
          : 'Indikativ nach Zinsbindung';
        /* Was live ist, darf auch so heissen - und was es nicht ist, nicht. */
        var bd = karten[i].querySelector('.bd');
        if (bd) bd.textContent = (d.sources && d.sources[j] === 'live') ? 'LIVE' : 'INDIKATIV';
      });
      var fuss = document.querySelector('.cond-foot');
      if (fuss) {
        var stand = null, p = d.periods && (d.periods['10'] || d.periods['5']);
        if (p) { var dt = new Date(p); if (!isNaN(dt)) stand = MON[dt.getMonth()] + ' ' + dt.getFullYear(); }
        var q = (d.sourceInfo && d.sourceInfo.name) || 'Bundesbank';
        fuss.innerHTML = '<span class="live">\u25CF ' + (d.source === 'live' ? 'Live' : 'Stand')
          + ' \u00b7 ' + q + '</span>' + (stand ? ' \u00b7 Stand ' + stand : '')
          + ' \u00b7 indikative Sch\u00e4tzung, kein Bankangebot \u00b7 keine '
          + 'Finanzierungsberatung (\u00a7 34c GewO)';
      }
    })
    .catch(function () {});
})();
