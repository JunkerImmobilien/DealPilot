/* ═══════════════════════════════════════════════════════════════════════
   teamplatz-rechner.js · v3947 (22.11.2026)
   Landing preise.html › Partner › Teamplätze: Staffel und Auswahlrechner.

   KEINE Zahl in dieser Datei. Die Stufen kommen aus der EINEN Quelle
   frontend/js/teamplatz-staffel.js (window.DpTeamplatz), geladen vom App-Host
   wie dealcheck-laden.js die Kerne lädt. BUSTER: derselbe wie in
   frontend/index.html, diese Datei steht in tools/buster-ebenen-pruefen.mjs
   (DOKUMENTE). Der Preis des Partner-Plans wird aus der Partner-Karte
   derselben Seite gelesen (.pr data-m / data-j), nicht kopiert.

   Ohne Skript bleibt der Rückfall im HTML stehen (monatlich, 3 Logins),
   tools/teamplatz-pruefen.mjs vergleicht ihn mit der Quelle.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var box = document.getElementById('teamplaetze');
  if (!box) return;
  var h = location.hostname, app = /(^|\.)staging\.dealpilot\.immo$/.test(h) ? 'https://app.staging.dealpilot.immo/' : 'https://app.dealpilot.immo/';
  if (/^(localhost|127\.0\.0\.1)$/.test(h) || /^app\./.test(h)) app = '/';   /* lokal und unter /landing/ der App: derselbe Host */
  var QUELLE = 'js/teamplatz-staffel.js?v=v3947a';

  var S = { zeit: 'm', logins: 3 };
  function eur(n) {
    var r = Math.round(Number(n) * 100) / 100;
    return r.toLocaleString('de-DE', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
  }
  /* „99 €“, „1.089 €“ -> 99, 1089 */
  function zahlAus(t) { var x = parseFloat(String(t || '').replace(/[^\d,]/g, '').replace(',', '.')); return Number.isFinite(x) ? x : null; }
  function partnerPreis(zeit) {
    var pr = document.querySelector('#partner-plan .pr[data-m]');
    return pr ? zahlAus(zeit === 'j' ? pr.getAttribute('data-j') : pr.getAttribute('data-m')) : null;
  }
  function iv() { return S.zeit === 'j' ? 'yearly' : 'monthly'; }

  function stufenZeichnen(TP) {
    var g = box.querySelector('[data-team-stufen]'); if (!g) return;
    var f = S.zeit === 'j' ? 'jahr' : 'monat', anders = S.zeit === 'j' ? 'monat' : 'jahr';
    g.innerHTML = TP.STUFEN.map(function (s, i) {
      return '<div><div class="st">' + TP.stufenName(s).toUpperCase() + '</div>' +
        '<div class="pv" data-team-stufe="' + i + '" data-m="' + s.monat + '" data-j="' + s.jahr + '">' + eur(s[f]) + '<small>/ ' + (S.zeit === 'j' ? 'Jahr' : 'Monat') + '</small></div>' +
        '<div class="pj">oder ' + eur(s[anders]) + (S.zeit === 'j' ? ' im Monat' : ' im Jahr') + '</div></div>';
    }).join('');
    var ab = document.querySelector('[data-team-ab]');
    if (ab) { var a = ab.querySelector('a'); ab.innerHTML = 'Du bist im Plan enthalten. Weitere Logins für dein Team ab ' + eur(TP.ab(iv())) + (S.zeit === 'j' ? ' im Jahr, ' : ' im Monat, '); if (a) ab.appendChild(a); }
  }

  /* „3 × 59 € + 5 × 49 € + 1 × 39 €“ für n Teamplätze */
  function rechnung(TP, n) {
    var st = TP.stripeStufen(iv()), rest = n, unten = 0, teile = [];
    for (var i = 0; i < st.length && rest > 0; i++) {
      var oben = st[i].bis == null ? Infinity : st[i].bis, k = Math.max(0, Math.min(rest, oben - unten));
      if (k > 0) teile.push(k + ' × ' + eur(st[i].cent / 100));
      rest -= k; unten = oben;
    }
    return teile.join(' + ');
  }
  function ergebnisZeichnen(TP) {
    var e = box.querySelector('[data-team-ergebnis]'); if (!e) return;
    var n = Math.max(0, S.logins - 1), team = TP.teamSumme(n, iv()), plan = partnerPreis(S.zeit);
    var ein = S.zeit === 'j' ? 'Jahr' : 'Monat', zus = plan != null ? plan + team : null;
    e.innerHTML =
      (plan != null ? '<div class="pteam-z"><span>Partner-Plan mit dir als Inhaber</span><span>' + eur(plan) + '</span></div>' : '') +
      '<div class="pteam-z"><span>' + (n === 0 ? 'Kein Teamplatz' : n + (n === 1 ? ' Teamplatz' : ' Teamplätze')) + (n ? '<small>' + rechnung(TP, n) + '</small>' : '') + '</span><span>' + eur(team) + '</span></div>' +
      (zus != null ? '<div class="pteam-z sum"><span>Zusammen je ' + ein + '</span><span>' + eur(zus) + '</span></div>' +
        '<div class="pteam-z schnitt"><span>im Schnitt je Login</span><span>' + eur(zus / S.logins) + '</span></div>'
        : '<div class="pteam-z sum"><span>Teamplätze je ' + ein + '</span><span>' + eur(team) + '</span></div>');
  }

  function los(TP) {
    var inp = box.querySelector('[data-team-logins]');
    function setzen(v) { S.logins = Math.max(1, Math.min(50, parseInt(v, 10) || 1)); if (inp) inp.value = S.logins; ergebnisZeichnen(TP); }
    if (inp) {
      inp.addEventListener('input', function () { if (inp.value !== '') setzen(inp.value); });
      inp.addEventListener('change', function () { setzen(inp.value); });
    }
    [].forEach.call(box.querySelectorAll('.pteam-step button[data-d]'), function (b) {
      b.addEventListener('click', function () { setzen(S.logins + Number(b.getAttribute('data-d'))); });
    });
    function zeitLesen() { var on = document.querySelector('#segZeit button.on'); S.zeit = on && on.getAttribute('data-zeit') === 'j' ? 'j' : 'm'; stufenZeichnen(TP); ergebnisZeichnen(TP); }
    var sz = document.getElementById('segZeit');
    if (sz) sz.addEventListener('click', function () { setTimeout(zeitLesen, 0); });
    zeitLesen();
  }

  /* Direktlink preise.html#teamplaetze: Partner-Ansicht öffnen und hinrollen */
  if (location.hash === '#teamplaetze') {
    setTimeout(function () {
      var b = document.querySelector('#segArt button[data-art="partner"]'); if (b) b.click();
      setTimeout(function () { box.scrollIntoView({ block: 'start' }); }, 80);
    }, 60);
  }

  if (window.DpTeamplatz) { los(window.DpTeamplatz); return; }
  var s = document.createElement('script');
  s.src = app + QUELLE; s.async = true;
  s.onload = function () { if (window.DpTeamplatz) los(window.DpTeamplatz); };
  document.body.appendChild(s);
})();
