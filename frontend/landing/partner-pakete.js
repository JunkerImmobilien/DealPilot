/* ═══════════════════════════════════════════════════════════════════════
   partner-pakete.js · v3960 (22.11.2026)
   Landing preise.html › Partner & Whitelabel: vier Pakete Solo, Büro,
   Kanzlei, Netzwerk (Marcel 22.11.2026, Variante C aus
   design/Vorschläge/partner-preise-2026-11-22/). Löst teamplatz-rechner.js ab.

   KEINE Preiszahl in dieser Datei. Partner-Plan und Kundenplätze kommen aus
   frontend/js/kundenplatz-staffel.js (window.DpKundenplatz), Teamplätze aus
   frontend/js/teamplatz-staffel.js (window.DpTeamplatz), beide vom App-Host
   geladen. BUSTER: dieselben wie in frontend/index.html, diese Datei steht in
   tools/buster-ebenen-pruefen.mjs (DOKUMENTE). Die Vorbelegung je Paket steht
   im HTML (data-kunden, data-logins), nicht hier.

   Ohne Skript bleibt der Rückfall im HTML stehen (monatlich, Vorbelegung),
   tools/teamplatz-pruefen.mjs (Abschnitt L) vergleicht ihn mit den Quellen.

   „Jetzt buchen“ verlinkt
     <App>/?register=1&partner_kauf=1&intervall=…&kundenplaetze=…&teamplaetze=…
   partner-plan-kauf.js vonDerLanding() übernimmt die Werte ins Preisfenster.
   teamplaetze = Logins ohne dich als Inhaber.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var box = document.getElementById('partner-plan');
  if (!box) return;
  var karten = [].slice.call(box.querySelectorAll('.ppk[data-kunden]'));
  if (!karten.length) return;
  var h = location.hostname, app = /(^|\.)staging\.dealpilot\.immo$/.test(h) ? 'https://app.staging.dealpilot.immo/' : 'https://app.dealpilot.immo/';
  if (/^(localhost|127\.0\.0\.1)$/.test(h) || /^app\./.test(h)) app = '/';   /* lokal und unter /landing/ der App: derselbe Host */
  var QUELLEN = ['js/kundenplatz-staffel.js?v=v3960', 'js/teamplatz-staffel.js?v=v3947a'];

  var S = { zeit: 'm' };
  function eur(n) {
    var r = Math.round(Number(n) * 100) / 100;
    return r.toLocaleString('de-DE', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
  }
  function iv() { return S.zeit === 'j' ? 'yearly' : 'monthly'; }
  function ganz(v, min, max) { var x = parseInt(v, 10); if (!Number.isFinite(x)) x = min; return Math.max(min, Math.min(max, x)); }
  function puls(el) {
    if (!el) return; el.classList.remove('puls'); void el.offsetWidth; el.classList.add('puls');
    setTimeout(function () { el.classList.remove('puls'); }, 300);
  }

  /* Teamplätze in Teilen nach Stufe: „3 × 59 € + 4 × 49 €“ */
  function teamText(TP, n) {
    var st = TP.stripeStufen(iv()), rest = n, unten = 0, teile = [];
    for (var i = 0; i < st.length && rest > 0; i++) {
      var oben = st[i].bis == null ? Infinity : st[i].bis, k = Math.max(0, Math.min(rest, oben - unten));
      if (k > 0) teile.push(k + ' × ' + eur(st[i].cent / 100));
      rest -= k; unten = oben;
    }
    return teile.join(' + ');
  }

  /** Gesamtrechnung einer Karte. kunden = Kundenplätze, logins = Logins MIT Inhaber. */
  function rechne(K, TP, kunden, logins) {
    var i = iv(), tp = Math.max(0, logins - 1);
    var plan = K.plan(i), kSumme = K.summe(kunden, i), team = TP.teamSumme(tp, i);
    var gesamt = plan + kSumme + team;
    return { plan: plan, kunden: kunden, satz: K.satz(kunden, i), kSumme: kSumme, tp: tp, team: team, gesamt: gesamt,
             jeKunde: kunden > 0 ? gesamt / kunden : null, einheit: S.zeit === 'j' ? 'Jahr' : 'Monat' };
  }
  function link(r) {
    return app + '?register=1&partner_kauf=1&intervall=' + iv() + '&kundenplaetze=' + r.kunden + '&teamplaetze=' + r.tp;
  }

  function zeichnen(K, TP, el, sanft) {
    var kunden = ganz(el.getAttribute('data-kunden'), 0, K.MAX), logins = ganz(el.getAttribute('data-logins'), 1, 50);
    var r = rechne(K, TP, kunden, logins);
    var g = el.querySelector('[data-o="gesamt"]'), neu = eur(r.gesamt).replace(' €', '');
    if (g && g.textContent !== neu) { g.textContent = neu; if (sanft) puls(g); }
    var per = el.querySelector('.tk-price .per'); if (per) per.textContent = '/ ' + r.einheit;
    var sn = el.querySelector('[data-o="schnitt"]');
    if (sn) sn.textContent = r.jeKunde == null ? 'ohne Kundenplätze' : 'im Schnitt ' + eur(r.jeKunde) + ' je Kunde';
    var re = el.querySelector('[data-o="rechnung"]');
    if (re) re.innerHTML =
      '<div><span>Partner-Plan<small>du als Inhaber</small></span><b>' + eur(r.plan) + '</b></div>' +
      '<div><span>' + r.kunden + (r.kunden === 1 ? ' Kundenplatz' : ' Kundenplätze') + '<small>' + (r.kunden ? r.kunden + ' × ' + eur(r.satz) : 'nach Bedarf dazu') + '</small></span><b>' + eur(r.kSumme) + '</b></div>' +
      '<div><span>' + (r.tp ? r.tp + (r.tp === 1 ? ' Teamplatz' : ' Teamplätze') : 'Kein Teamplatz') + '<small>' + (r.tp ? teamText(TP, r.tp) : 'nur du') + '</small></span><b>' + eur(r.team) + '</b></div>';
    var a = el.querySelector('[data-o="buchen"]'); if (a) a.href = link(r);
    [].forEach.call(el.querySelectorAll('input[data-k]'), function (inp) {
      if (document.activeElement !== inp) inp.value = inp.getAttribute('data-k') === 'logins' ? logins : kunden;
    });
  }

  /* eine Zeile mit beiden Staffeln, aus den Quellen */
  function staffelZeile(K, TP) {
    var z = box.querySelector('[data-o="staffel"]'); if (!z) return;
    var f = S.zeit === 'j' ? 'jahr' : 'monat';
    var vor = function (n) { return /^ab /.test(n) ? n : 'für ' + (/Login$/.test(n) ? 'den ' : '') + n; };
    z.textContent = 'Kundenplatz ' + K.STUFEN.map(function (s) { return eur(s[f]) + ' ' + vor(K.stufenName(s)); }).join(', ') +
      ', alle Plätze zum Satz der erreichten Stufe. Teamplatz ' + TP.STUFEN.map(function (s) { return eur(s[f]) + ' ' + vor(TP.stufenName(s)); }).join(', ') +
      ', jeder zum Satz seiner Stufe. Preise je ' + (S.zeit === 'j' ? 'Jahr' : 'Monat') + '.';
  }

  function los(K, TP) {
    function setze(el, k, v) {
      if (k === 'logins') el.setAttribute('data-logins', ganz(v, 1, 50));
      else el.setAttribute('data-kunden', ganz(v, 0, K.MAX));
      zeichnen(K, TP, el, true);
    }
    karten.forEach(function (el) {
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-d]'); if (!b) return;
        var k = b.getAttribute('data-k'), alt = parseInt(el.getAttribute(k === 'logins' ? 'data-logins' : 'data-kunden'), 10) || 0;
        setze(el, k, alt + Number(b.getAttribute('data-d')));
      });
      el.addEventListener('change', function (e) {
        var t = e.target; if (!t.matches || !t.matches('input[data-k]')) return;
        setze(el, t.getAttribute('data-k'), t.value);
        t.value = el.getAttribute(t.getAttribute('data-k') === 'logins' ? 'data-logins' : 'data-kunden');
      });
      el.addEventListener('input', function (e) { var t = e.target; if (t.matches && t.matches('input[data-k]') && t.value !== '') setze(el, t.getAttribute('data-k'), t.value); });
    });
    function zeitLesen(sanft) {
      var on = document.querySelector('#segZeit button.on'); S.zeit = on && on.getAttribute('data-zeit') === 'j' ? 'j' : 'm';
      karten.forEach(function (el) { zeichnen(K, TP, el, sanft); });
      staffelZeile(K, TP);
    }
    var sz = document.getElementById('segZeit');
    /* landing-partner-preise-1 · partner.html hat keinen eigenen Umschalter-Code: .on hier setzen (idempotent, auf preise.html schadet es nicht) */
    if (sz) sz.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button[data-zeit]') : null;
      if (b) [].forEach.call(sz.querySelectorAll('button[data-zeit]'), function (x) { x.classList.toggle('on', x === b); });
      setTimeout(function () { zeitLesen(true); }, 0);
    });
    zeitLesen(false);
  }

  /* Direktlink preise.html#teamplaetze (partner.html, „weitere Logins ab …“): Partner-Ansicht öffnen und hinrollen */
  if (location.hash === '#teamplaetze') {
    setTimeout(function () {
      var b = document.querySelector('#segArt button[data-art="partner"]'); if (b) b.click();
      setTimeout(function () { var z = document.getElementById('teamplaetze'); if (z) z.scrollIntoView({ block: 'start' }); }, 80);
    }, 60);
  }

  function bereit() { if (window.DpKundenplatz && window.DpTeamplatz) los(window.DpKundenplatz, window.DpTeamplatz); }
  var offen = 0;
  QUELLEN.forEach(function (q) {
    if (q.indexOf('kundenplatz') >= 0 ? window.DpKundenplatz : window.DpTeamplatz) return;
    offen++;
    var s = document.createElement('script');
    s.src = app + q; s.async = true;
    s.onload = function () { if (--offen === 0) bereit(); };
    document.body.appendChild(s);
  });
  if (!offen) bereit();
})();
