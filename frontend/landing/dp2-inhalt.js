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
  var zeit = 'm';
  function preise() {
    document.querySelectorAll('[data-m]').forEach(function (e) {
      var v = e.dataset[zeit]; if (v == null) return;
      if (e.classList.contains('tk-p')) e.innerHTML = v + '<small> / Monat</small>';
      else if (e.classList.contains('pr')) e.innerHTML = v + '<small> / ' + (zeit === 'j' ? 'Jahr' : 'Monat') + '</small>';
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

  /* ── 5 · Live-Marktzinsen ────────────────────────────────────────── */
  /* Schlaegt der Abruf fehl, bleiben die Werte im HTML stehen - sie sind
     mit Stand gekennzeichnet und damit ehrlich, nur nicht tagesaktuell. */
  fetch('https://app.dealpilot.immo/api/v1/market-rates/pfandbrief?maturities=5,10,15,20')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.rates) return;
      var karten = document.querySelectorAll('#condG .cond-c');
      [5, 10, 15, 20].forEach(function (j, i) {
        var s = d.rates[j] != null ? d.rates[j] : (d.rates['' + j]);
        if (s == null || !karten[i]) return;
        var marge = 1.0, zins = Number(s) + marge;
        karten[i].querySelector('.zs').textContent = zins.toFixed(2).replace('.', ',') + ' %';
        karten[i].querySelector('.er').textContent =
          'Pfandbrief ' + Number(s).toFixed(2).replace('.', ',') + ' % + Marge 1,00 %';
      });
    })
    .catch(function () {});
})();
