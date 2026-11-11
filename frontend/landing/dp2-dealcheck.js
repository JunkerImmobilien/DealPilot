/* ═══════════════════════════════════════════════════════════════════════
   dp2-dealcheck.js · landing-kern-2 (11.11.2026)
   Der öffentliche Deal-Check auf der Startseite — ohne Anmeldung.

   Marcel 11.11.2026 (Runde 2): Mini-Deal-Check bauen, mit den ECHTEN Kernen.
   Gerechnet wird NICHTS hier: DealKpis.compute() (deal-kpis.js, mit
   Dscr.compute() aus dscr-engine.js), DealScore.computeFromKpis()
   (dealscore.js) und ScoreTier.stufe() (score-tiers.js) kommen aus der App
   (index.html lädt sie mit denselben Bustern wie frontend/index.html,
   tools/buster-ebenen-pruefen.mjs wacht darüber).

   Die Abbildung der Eingaben folgt dem Quick-Check (js/quick-check.js,
   qcCalc): Darlehen = Kaufpreis + Nebenkosten − Eigenkapital, Score mit
   wp_kpi = 5 % des Kaufpreises und darlehen = d_total. Was der Quick-Check
   abfragt und hier fehlt (Hausgeld, Lage, Zustand), ersetzen die Vorgaben der
   App (config.js investmentProfileDefaults):
     ek_quote_default 10 %  · tilgung_default 1,5 %
     bwk_anteil_default 16 % der Nettokaltmiete (nicht umlagefähig)
     + mietausfall_pct 1 %  → bwk_nul = 17 % der Jahresnettokaltmiete
   Der Zins kommt indikativ (10 Jahre, 80 % Beleihung) vom selben Endpunkt
   wie die Live-Marktzinsen, solange niemand ihn selbst einträgt.
   Ergebnis ist eine VORAB-Einstufung; der Text sagt das.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var box = document.getElementById('dealcheck');
  if (!box) return;
  var VORGABE = { ek_pct: 10, tilg: 1.5, nul_pct: 17, nk_pct: 10, zins: 4.0 };
  var $ = function (id) { return document.getElementById(id); };
  var F = { kp: $('dcKp'), nkm: $('dcNkm'), ek: $('dcEk'), zins: $('dcZins'), nk: $('dcNk') };
  var ekSelbst = false, zinsSelbst = false;

  function zahl(el) {
    if (!el) return NaN;
    var s = String(el.value || '').trim().replace(/\s|€|%/g, '');
    if (!s) return NaN;
    /* „250.000" = Tausenderpunkt, „3,8" = Komma (memory: Punkt ist kein Tausender bei Prozent) */
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function pct(n) { return (Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %'; }
  function setze(id, t) { var e = $(id); if (e) e.textContent = t; }

  function rechnen() {
    var kp = zahl(F.kp), nkm = zahl(F.nkm);
    var ergebnis = $('dcErg');
    if (!(kp > 0) || !(nkm > 0) || !window.DealKpis || !window.DealScore || !window.ScoreTier) {
      ergebnis.classList.add('leer');
      return;
    }
    var nkPct = zahl(F.nk); if (!(nkPct >= 0)) nkPct = VORGABE.nk_pct;
    var zins = zahl(F.zins); if (!(zins >= 0)) zins = VORGABE.zins;
    var ek = zahl(F.ek);
    if (!ekSelbst || !(ek >= 0)) { ek = Math.round(kp * VORGABE.ek_pct / 100); if (!ekSelbst) F.ek.placeholder = ek.toLocaleString('de-DE'); }
    var nk = kp * nkPct / 100;
    var darlehen = Math.max(0, kp + nk - ek);
    var k = DealKpis.compute({
      kp: kp, nk: nk, nkm: nkm, ze: 0, uf: 0,
      bwk_ul: 0, bwk_nul: nkm * 12 * VORGABE.nul_pct / 100,
      d1: darlehen, d1z: zins, d1t: VORGABE.tilg, ek: ek
    });
    var ds = DealScore.computeFromKpis({
      kp: kp, cf_m: k.cf_m, nmy: k.nmy, ltv: k.ltv, dscr: k.dscr,
      wp_kpi: kp * 0.05, mstg: 1.5,
      darlehen: (k.d_total != null && isFinite(k.d_total)) ? k.d_total : null
    });
    var st = ScoreTier.stufe(ds.score);
    ergebnis.classList.remove('leer');
    setze('dcBmy', pct(k.bmy));
    setze('dcNmy', pct(k.nmy));
    setze('dcCf', (k.cf_m >= 0 ? '+' : '−') + eur(Math.abs(k.cf_m)));
    setze('dcDscr', k.d_total > 0 ? (Math.round(k.dscr * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) : 'entfällt');
    setze('dcScore', String(ds.score));
    setze('dcStufe', st.versal);
    $('dcCfK').classList.toggle('neg', k.cf_m < 0);
    var ring = $('dcRing');
    ring.setAttribute('data-farbe', st.farbe);
    ring.style.setProperty('--dc-p', Math.max(0, Math.min(100, ds.score)));
    setze('dcAnnahme', 'Gerechnet mit ' + eur(ek) + ' Eigenkapital, ' + eur(nk) + ' Nebenkosten, Darlehen '
      + eur(darlehen) + ' zu ' + pct(zins) + ' und ' + pct(VORGABE.tilg) + ' Tilgung, nicht umlagefähigen Kosten von '
      + VORGABE.nul_pct + ' % der Kaltmiete.');
  }

  F.ek.addEventListener('input', function () { ekSelbst = String(F.ek.value).trim() !== ''; });
  F.zins.addEventListener('input', function () { zinsSelbst = true; });
  [F.kp, F.nkm, F.ek, F.zins, F.nk].forEach(function (el) { el.addEventListener('input', rechnen); });

  /* Indikativer Zins, 10 Jahre, wie die Live-Marktzinsen (relativer Pfad, v1547) */
  fetch('/api/v1/market-rates/pfandbrief?maturities=10')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      var d = res && res.indicativeRates ? res : (res && res.data && res.data.indicativeRates ? res.data : null);
      var s = d && d.indicativeRates && d.indicativeRates['10'];
      var z = s && (s.standard != null ? s.standard : s.premium);
      if (z == null || !isFinite(z) || zinsSelbst) return;
      F.zins.value = (Math.round(z * 100) / 100).toLocaleString('de-DE');
      setze('dcZinsHinweis', 'indikativ, 10 Jahre, Bundesbank-Daten');
      rechnen();
    })
    .catch(function () {});

  /* Die Kerne kommen per <script> aus der App; erst rechnen, wenn sie da sind. */
  if (window.DealKpis && window.DealScore && window.ScoreTier) rechnen();
  else window.addEventListener('load', rechnen);
})();
