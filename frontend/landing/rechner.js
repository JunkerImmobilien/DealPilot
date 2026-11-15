/* ═══════════════════════════════════════════════════════════════════════
   rechner.js · landing-seo-2 (15.11.2026)
   Die drei öffentlichen Rechner der Landing. Eine Datei, die Art steht am
   Formular: <form class="rr" data-rechner="rendite|cashflow|faktor">.

   GERECHNET WIRD HIER NICHTS: DealKpis.compute() liefert bmy, nmy, fak,
   gi, cf_m, cf_ns_m, steuer, dscr, ekr (deal-kpis.js), DealKpis.gebaeudeAhk()
   den Gebäudeanteil für die AfA. Hier stehen nur die Abbildung der
   Eingaben auf den Kern und die Anzeige. Einzige eigene Zeile: der
   Kaufpreis bei einem gewählten Faktor (Faktor × Jahresmiete) im
   Faktor-Rechner, die Umkehrung von fak - eine Multiplikation, kein Kern.

   Abbildung wie der Deal-Check der Startseite (dp2-dealcheck.js):
     Nebenkosten = Kaufpreis × Nebenkosten-%, Darlehen = Kaufpreis +
     Nebenkosten − Eigenkapital, nicht umlagefähige Kosten als bwk_nul.
   Zins: Vorbelegung aus /api/v1/market-rates/bauzins (10 Jahre, Stufe nach
   Beleihung wie stufen_ltv). Kommt keiner an, wird keiner erfunden: das
   Feld bleibt leer und der Cashflow wartet auf eine Eingabe.

   Eingaben verlassen den Browser nicht. Der Knopf in die App trägt sie als
   Fragment (#dc=1&kp=…&nkm=…&ek=…&zins=…&nk=…), wie der Deal-Check
   (js/dealcheck-uebernahme.js nimmt es an).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var form = document.querySelector('form.rr');
  if (!form || !window.DealKpis) return;
  var art = form.getAttribute('data-rechner');

  function feld(n) { return form.querySelector('[name="' + n + '"]'); }
  function zahl(n) {
    var el = feld(n);
    if (!el) return NaN;
    var s = String(el.value || '').trim().replace(/\s|€|%/g, '');
    if (!s) return NaN;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');   /* 250.000 = Tausenderpunkt */
    s = s.replace(',', '.');
    var x = parseFloat(s);
    return isFinite(x) ? x : NaN;
  }
  function dez(x, st) { return x.toLocaleString('de-DE', { minimumFractionDigits: st, maximumFractionDigits: st }); }
  function eur(x) { return Math.round(x).toLocaleString('de-DE') + ' €'; }
  function pct(x) { return dez(x, 2) + ' %'; }
  function setze(k, t, neg) {
    var el = form.parentNode.querySelector('[data-aus="' + k + '"]');
    if (!el) return;
    el.textContent = t;
    if (neg != null) el.classList.toggle('neg', !!neg);
  }
  function leer() {
    [].forEach.call(form.parentNode.querySelectorAll('[data-aus]'), function (el) { el.textContent = '…'; el.classList.remove('neg'); });
  }

  /* ── Zins vorbelegen (nur Cashflow) ─────────────────────────────── */
  var zinsDaten = null, zinsVonHand = false, zinsFertig = false;
  function stufeFuer(ltv) {
    var s = zinsDaten && zinsDaten.stufen_ltv;
    if (!s) return 'standard';
    var namen = Object.keys(s).sort(function (a, b) { return s[a] - s[b]; });
    for (var i = 0; i < namen.length; i++) if (ltv <= s[namen[i]] + 1e-9) return namen[i];
    return namen[namen.length - 1];
  }
  function zinsVorschlag(ltv) {
    var r = zinsDaten && zinsDaten.indicativeRates && zinsDaten.indicativeRates['10'];
    if (!r) return null;
    var st = stufeFuer(ltv);
    return r[st] != null ? { zins: r[st], stufe: st } : null;
  }
  if (art === 'cashflow' && feld('zins')) {
    feld('zins').addEventListener('input', function () { zinsVonHand = true; });
    fetch('/api/v1/market-rates/bauzins').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { zinsDaten = d && d.indicativeRates ? d : null; zinsFertig = true; rechne(); })
      .catch(function () { zinsFertig = true; rechne(); });
  }

  function rechne() {
    var kp = zahl('kp'), nkPct = zahl('nk'), nkm = zahl('nkm');
    if (!(kp > 0) || !(nkm > 0) || !(nkPct >= 0)) { leer(); return; }
    var nk = kp * nkPct / 100;
    var e = { kp: kp, nk: nk, nkm: nkm };

    if (art === 'faktor') {
      var k0 = DealKpis.compute(e);
      setze('fak', dez(k0.fak, 1));
      setze('bmy', pct(k0.bmy));
      setze('jahresmiete', eur(k0.nkm_j));
      var wfl = zahl('wfl');
      setze('qm', wfl > 0 ? eur(kp / wfl) + ' je m²' : 'Wohnfläche eintragen');
      var ziel = zahl('zielfaktor');
      setze('zielkp', ziel > 0 ? eur(ziel * k0.nkm_j) : 'Zielfaktor eintragen');
      return;
    }

    var nul = zahl('nul');
    e.bwk_nul = (nul >= 0 ? nul : 0) * 12;
    var san = zahl('san'); if (san > 0) e.san = san;

    if (art === 'rendite') {
      var k1 = DealKpis.compute(e);
      setze('bmy', pct(k1.bmy));
      setze('nmy', pct(k1.nmy));
      setze('fak', dez(k1.fak, 1));
      setze('gi', eur(k1.gi));
      setze('ueberschuss', eur(k1.nkm_j - k1.bwk_nul) + ' im Jahr');
      appLink(kp, nkm, null, null, nkPct);   /* Eigenkapital setzt die App (10 %) */
      return;
    }

    /* Cashflow */
    var ek = zahl('ek'); if (!(ek >= 0)) ek = 0;
    var darlehen = Math.max(0, kp + nk - ek);
    var ltv = kp > 0 ? darlehen / kp * 100 : 0;
    if (!zinsVonHand) {
      var v = zinsVorschlag(ltv);
      var hinweis = form.parentNode.querySelector('[data-hinweis="zinsquelle"]');
      if (v) {
        feld('zins').value = dez(v.zins, 2);
        if (hinweis) hinweis.textContent = 'Indikativer Zins für 10 Jahre Bindung bei ' + Math.round(ltv) + ' % Beleihung, tagesaktuell. Eigener Zins überschreibt ihn.';
      } else if (hinweis && zinsFertig && !zinsDaten) {
        hinweis.textContent = 'Trag den Zins deiner Finanzierung ein.';
      }
    }
    var zins = zahl('zins'), tilg = zahl('tilg');
    if (!(zins >= 0) || !(tilg >= 0)) { leer(); return; }
    var grenz = zahl('grenz'); if (!(grenz >= 0)) grenz = 0;
    var geb = zahl('geb'), afaSatz = zahl('afa');
    var afa = 0;
    if (geb > 0 && afaSatz > 0) afa = DealKpis.gebaeudeAhk({ kp: kp, nk: nk, gebAntPct: geb }).gebAhk * afaSatz / 100;
    e.ek = ek; e.d1 = darlehen; e.d1z = zins; e.d1t = tilg; e.afa = afa; e.grenz = grenz;
    var k = DealKpis.compute(e);
    setze('cf_m', eur(k.cf_m) + ' im Monat', k.cf_m < 0);
    setze('cf_ns_m', eur(k.cf_ns_m) + ' im Monat', k.cf_ns_m < 0);
    setze('steuer', k.steuer <= 0 ? eur(-k.steuer / 12) + ' Erstattung im Monat' : eur(k.steuer / 12) + ' Steuer im Monat');
    setze('dscr', darlehen > 0 ? dez(Math.round(k.dscr * 100) / 100, 2) : 'entfällt');
    setze('rate', eur((k.zins_j + k.tilg_j) / 12) + ' im Monat');
    setze('darlehen', eur(darlehen));
    setze('afa_j', eur(afa) + ' im Jahr');
    setze('ekr', ek > 0 ? pct(k.ekr) : 'entfällt');
    appLink(kp, nkm, ek, zins, nkPct);
  }

  function appLink(kp, nkm, ek, zins, nkPct) {
    [].forEach.call(document.querySelectorAll('a[data-app-uebergabe]'), function (a) {
      var basis = String(a.getAttribute('href') || '').split('#')[0];   /* umgebung.js schreibt den Host um */
      a.setAttribute('href', basis + '#dc=1&kp=' + Math.round(kp) + '&nkm=' + Math.round(nkm) + (ek != null ? '&ek=' + Math.round(ek) : '')
        + (zins != null ? '&zins=' + (Math.round(zins * 100) / 100) : '') + '&nk=' + (Math.round(nkPct * 100) / 100));
    });
  }

  var t = null;
  form.addEventListener('input', function () { clearTimeout(t); t = setTimeout(rechne, 120); });
  form.addEventListener('submit', function (ev) { ev.preventDefault(); rechne(); });
  rechne();
})();
