/* ═══════════════════════════════════════════════════════════════════
   portfolio-strategie.js · v1880 — das Modul zum Forschungsvorhaben 827-757-583/2026-1/1

   Marcel am 05.10.2026: „ja leg das modul portfolio strategie an nach dem zweiten weg" —
   derselbe Chat, dasselbe Repo, hinter einem Feature-Schlüssel. Der Code reist mit jedem
   Rollout nach Prod, erscheint dort aber nicht: `portfolio_strategie` steht in Migration 085
   für jeden Plan auf false; auf Staging ist er für Marcels Plan von Hand an.

   Was das Modul heute ist: die Ansicht „Portfolio-Strategie" neben dem Portfolio-Cockpit —
   Bestand mit dem, was das Verfahren je Objekt braucht (Kaufdatum, Spekulationsfrist § 23,
   anschaffungsnaher Aufwand § 6 Abs. 1 Nr. 1a, Halter, AfA-Reihe), dazu der Stand der zehn
   Arbeitspakete aus Anlage 1 des Antrags. Was es noch nicht ist: die heuristische Suche
   (AP 6). Die kommt als eigene Versuchsreihe mit vorab gesetzter Schwelle, nicht als
   Bauchgefühl — und jeder Lauf landet in `portfolio_strategie_laeufe`.

   Sperren: ohne Feature-Schlüssel tut `openPortfolioStrategie()` nichts außer einem Hinweis;
   dp-plan-gates.js sperrt den Knopf in der Seitenleiste über `data-feature`.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var SEC_ID = 'portfolio-strategie';
  var FEATURE = 'portfolio_strategie';

  var AP = [
    ['AP 1', 'Zielfunktion', 'Barwert nach Steuer über alle Objekte, progressiv gekoppelt (§ 32a)'],
    ['AP 2', 'Steuer-Rechenkern', 'AfA-Methodenwechsel, § 7b, V+V, Verlustverrechnung — im Objekt-Rechner vorhanden (calc.js, afa-engine.js)'],
    ['AP 3', 'Normableitung', 'Normtext zu Rechengröße; Wahlrechte als Exklusionsrelation'],
    ['AP 4', 'Datenfusion', 'Bewertungsquellen, Register der Zinssätze und Sachwertfaktoren — im Marktbericht vorhanden'],
    ['AP 5', 'Szenario-Engine', 'Vergleich fester Varianten über 10-Jahres-Barwert, Cashflow, Steuerlast'],
    ['AP 6', 'Heuristische Suche', 'Startheuristik, lokale Suche über Zuordnung und Zeitpunkt; Schwelle: unter 2 % zum Referenzoptimum kleiner Bestände'],
    ['AP 7', 'Restriktions- und Fristenmodell', 'Fristen und Freibeträge als verbrauchbare Budgets in gleitenden Fenstern'],
    ['AP 8', 'Ereignisextraktion', 'Freitext zu steuerlich zählenden Vorgängen, Regeln mit Rückfrage'],
    ['AP 9', 'Profilgewichtung', 'profilabhängige Zielfunktion, Konvergenz über alle Investorprofile'],
    ['AP 10', 'Validierung', 'Referenzbestand, Fehlalarmquote unter 5 %, Rekalibrierung'],
  ];

  function hatFeature() {
    try {
      var p = global.DealPilotConfig && global.DealPilotConfig.pricing;
      if (p && typeof p.hasFeature === 'function') return !!p.hasFeature(FEATURE);
    } catch (e) {}
    try { return !!(global.DealPilotPlanReady && global.DealPilotPlanReady.features && global.DealPilotPlanReady.features[FEATURE]); } catch (e) {}
    return false;
  }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(n) { return (n == null || !isFinite(n)) ? '–' : Math.round(n).toLocaleString('de-DE') + ' €'; }
  /* v1880c · Die API liefert "780000.00" (Punkt als Dezimaltrenner) — die deutsche Lesart machte daraus
     78.000.000. Reine Zahlen mit höchstens einem Punkt und zwei Nachkommastellen sind englisch. */
  function num(v) {
    if (v == null || v === '') return null;
    var t = String(v).trim();
    if (/^-?\d+(\.\d{1,2})?$/.test(t)) { var e = parseFloat(t); return isFinite(e) ? e : null; }
    var s = t.replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isFinite(n) ? n : null;
  }
  function datum(s) {
    if (!s) return null;
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = String(s).match(/^(\d{2})\.(\d{2})\.(\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    return null;
  }
  function tage(a, b) { return Math.round((b - a) / 86400000); }

  /* ── Fristen je Objekt: das Stück von AP 7, das sich heute schon aus den Objektdaten lesen lässt ── */
  function fristen(d) {
    var heute = new Date();
    var kauf = datum(d.wirtschaftlicher_uebergang || d.kaufdat || d.kaufdatum);
    var out = { kauf: kauf, spekulation_ende: null, spekulation_rest_tage: null, san_frist_ende: null, san_rest_tage: null, san_quote: null };
    if (kauf) {
      var s = new Date(kauf); s.setFullYear(s.getFullYear() + 10);      /* § 23 Abs. 1 Nr. 1 EStG: zehn Jahre */
      out.spekulation_ende = s; out.spekulation_rest_tage = tage(heute, s);
      var f = new Date(kauf); f.setFullYear(f.getFullYear() + 3);       /* § 6 Abs. 1 Nr. 1a EStG: drei Jahre */
      out.san_frist_ende = f; out.san_rest_tage = tage(heute, f);
    }
    var kp = num(d.kp), geb = num(d.geb_ant), san = num(d.san);
    if (kp && geb != null && san != null) out.san_quote = san / (kp * geb / 100);
    return out;
  }
  function fmtDatum(x) { return x ? x.toLocaleDateString('de-DE') : '–'; }

  function bestandLaden() {
    var host = $('pst-bestand'); if (!host) return;
    host.innerHTML = '<p class="pst-hint">Bestand wird geladen …</p>';
    var p = (global.Auth && typeof Auth.apiCall === 'function') ? Auth.apiCall('/objects?limit=500') : Promise.reject(new Error('Auth fehlt'));
    p.then(function (r) {
      var list = (r && (r.objects || r.items || r.data)) || (Array.isArray(r) ? r : []);
      if (!list.length) { host.innerHTML = '<p class="pst-hint">Kein Objekt im Bestand.</p>'; return; }
      var rows = list.map(function (o) {
        /* v1880a · GET /objects liefert eine ZUSAMMENFASSUNG (name, ort, kaufpreis, halter, kaufdat, seq_no),
           nicht das Objekt - gemessen am 05.10.2026. Fuer Sanierungsquote und Gebaeudeanteil braeuchte es
           das volle Objekt (/objects/:id); das holt die Versuchsreihe spaeter je Objekt. */
        var d = o.data || o; d.kp = d.kp != null ? d.kp : o.kaufpreis; d.kaufdat = d.kaufdat || o.kaufdat; var fr = fristen(d);
        var adr = o.name || ([d.str, d.hnr].filter(Boolean).join(' ') + (d.ort ? ', ' + d.ort : ''));
        var halter = d.halter || o.halter || '–';
        var spek = fr.spekulation_rest_tage == null ? '–' : (fr.spekulation_rest_tage <= 0 ? 'frei' : Math.ceil(fr.spekulation_rest_tage / 30.44) + ' Mon.');
        var san = fr.san_rest_tage == null ? '–' : (fr.san_rest_tage <= 0 ? 'abgelaufen' : Math.ceil(fr.san_rest_tage / 30.44) + ' Mon.');
        var quote = fr.san_quote == null ? '–' : (Math.round(fr.san_quote * 1000) / 10).toFixed(1).replace('.', ',') + ' %';
        var warn = (fr.san_quote != null && fr.san_quote > 0.15 && fr.san_rest_tage > 0) ? ' pst-warn' : '';
        return '<tr><td class="tal">' + esc(adr || o.seq || o.id) + '</td><td class="tal">' + esc(halter) + '</td><td>' + eur(num(d.kp)) + '</td>'
          + '<td>' + fmtDatum(fr.kauf) + '</td><td>' + esc(spek) + '</td><td>' + esc(san) + '</td><td class="' + (warn ? 'pst-warn' : '') + '">' + quote + '</td></tr>';
      }).join('');
      host.innerHTML = '<div class="card"><div class="ct">Bestand mit Fristen · AP 7, Stand aus den Objektdaten</div><div class="pst-scroll"><table class="cft"><thead><tr><th class="tal">Objekt</th><th class="tal">Halter</th><th>Kaufpreis</th><th>Kauf</th>'
        + '<th title="§ 23 EStG: Veräußerung erst nach zehn Jahren steuerfrei">Spekulationsfrist</th>'
        + '<th title="§ 6 Abs. 1 Nr. 1a EStG: drei Jahre ab Anschaffung">15-%-Fenster</th><th title="Sanierung ÷ Gebäude-AK">Sanierungsquote</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        + '</div><p class="pst-hint">' + list.length + ' Objekte · Fristen aus dem Kaufdatum gerechnet · Sanierungsquote erst mit dem vollen Objekt (folgt mit der Versuchsreihe). Das ist der Zustand, den AP 7 als Budget führt.</p>';
    }).catch(function (e) { host.innerHTML = '<p class="pst-hint">Bestand konnte nicht geladen werden: ' + esc(e && e.message) + '</p>'; });
  }

  function sektion() {
    var s = $(SEC_ID); if (s) return s;
    var mcol = document.querySelector('.main-col'); if (!mcol) return null;
    s = document.createElement('section'); s.className = 'sec'; s.id = SEC_ID;
    s.innerHTML = '<div class="pst-kopf"><div class="pst-kicker">Forschungsvorhaben 827-757-583 · BSFZ-Bescheinigung vom 05.10.2026</div>'
      + '<h2>Portfolio-Strategie</h2>'
      + '<p>Verfahren zur automatisierten, investorprofil-abhängigen steuerlich-strukturellen Optimierung von Immobilien-Bestandsportfolios. '
      + 'Dieses Modul ist nur mit dem Feature-Schlüssel <code>portfolio_strategie</code> sichtbar und läuft auf Prod nicht mit.</p></div>'
      + '<div id="pst-bestand"></div>'   /* v1888a: die Ueberschrift traegt die Karte selbst (.ct) - sonst steht sie doppelt */
      + '<h3 class="pst-h3">Arbeitspakete (Anlage 1 des Antrags)</h3><div class="pst-ap">'
      + AP.map(function (a) { return '<div class="card pst-ap-k"><b>' + a[0] + ' · ' + esc(a[1]) + '</b><span>' + esc(a[2]) + '</span></div>'; }).join('')
      + '</div>'
      + '<h3 class="pst-h3">Versuchsreihen</h3><p class="pst-hint">Jeder Lauf des Verfahrens landet in <code>portfolio_strategie_laeufe</code> (Hypothese, Eingabe, Ergebnis, Befund). Noch kein Lauf.</p>';
    mcol.appendChild(s);
    if (!$('pst-style')) {
      var st = document.createElement('style'); st.id = 'pst-style';
      /* v1880c · Der Objekt-Lader stellt jede .sec wieder auf display:'' — die Sektion stand dann unter dem
         Objekt. Sichtbar ist sie nur mit data-pst-offen am <html>; das schlägt jeden Lader. */
      st.textContent = 'html:not([data-pst-offen]) #' + SEC_ID + '{display:none !important}'
        /* v1888: nur noch Anordnung. Farben, Flaechen und Schrift kommen aus der Ansicht (.card/.ct/.cft),
           damit die Aktenmappe wie die Aktenmappe aussieht und Heute wie Heute. Die Warnfarbe bleibt hart -
           Statusfarben sind in jeder Marke gleich (CLAUDE.md). */
        + '#' + SEC_ID + '{padding:18px 22px}'
        + '#' + SEC_ID + ' .pst-kicker{font:600 10px/1 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;opacity:.75;margin-bottom:4px}'
        + '#' + SEC_ID + ' .pst-kopf p{max-width:760px;font-size:13.5px;line-height:1.55}'
        + '#' + SEC_ID + ' .pst-h3{font:700 11px/1 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;margin:22px 0 10px}'
        + '#' + SEC_ID + ' .pst-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}'
        + '#' + SEC_ID + ' .pst-hint{font-size:12px;opacity:.75;margin:8px 0}'
        + '#' + SEC_ID + ' .pst-ap{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}'
        + '#' + SEC_ID + ' .pst-ap-k{padding:10px 12px;display:flex;flex-direction:column;gap:3px}'
        + '#' + SEC_ID + ' .pst-ap-k b{font-size:12px}#' + SEC_ID + ' .pst-ap-k span{font-size:11.5px;opacity:.8;line-height:1.4}'
        + '#' + SEC_ID + ' .pst-warn{color:#B8625C;font-weight:700}'
        + '@media (max-width:700px){#' + SEC_ID + '{padding:12px}}';
      document.head.appendChild(st);
    }
    return s;
  }

  function openPortfolioStrategie() {
    if (!hatFeature()) {
      try { if (typeof global.toast === 'function') global.toast('Portfolio-Strategie ist in diesem Plan nicht freigeschaltet.'); } catch (e) {}
      return;
    }
    var s = sektion(); if (!s) return;
    /* wie openDashboard() in dashboard.js: Reiter und Objektbereiche weg, eigene Sektion zeigen */
    try { if (global._currentObjKey && typeof global.saveObj === 'function') global.saveObj({ silent: true }); } catch (e) {}
    var tabs = document.querySelector('.tabs'); if (tabs) tabs.style.display = 'none';
    var wf = document.querySelector('.tabs-workflow-bar'); if (wf) wf.style.display = 'none';
    document.documentElement.setAttribute('data-pst-offen', '1');
    document.querySelectorAll('.sec').forEach(function (x) { x.style.display = (x.id === SEC_ID) ? 'block' : 'none'; });
    bestandLaden();
    try { var mc = document.querySelector('.main-col'); if (mc) mc.scrollTop = 0; } catch (e) {}
  }
  function schliessen() {
    if (document.documentElement.getAttribute('data-pst-offen') !== '1') return;
    document.documentElement.removeAttribute('data-pst-offen');
    var tabs = document.querySelector('.tabs'); if (tabs) tabs.style.display = '';
    var wf = document.querySelector('.tabs-workflow-bar'); if (wf) wf.style.display = '';
  }
  /* Wer ein Objekt lädt oder das Cockpit öffnet, verlässt die Strategie — die Objektbereiche
     zeigt dann der Lader selbst wieder. */
  global.addEventListener('dp:object-ready', schliessen);
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('.sb-card, .sb-act-item') : null;
    if (t && !(t.getAttribute('onclick') || '').match(/openPortfolioStrategie/)) schliessen();
  }, true);

  global.openPortfolioStrategie = openPortfolioStrategie;
  global.PortfolioStrategie = { open: openPortfolioStrategie, close: schliessen, fristen: fristen, AP: AP, FEATURE: FEATURE };
})(window);
