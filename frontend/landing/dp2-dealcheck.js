/* ═══════════════════════════════════════════════════════════════════════
   dp2-dealcheck.js · landing-kern-2 (11.11.2026), landing-kern-3 (Vorbelegung, Übergabe),
   landing-dealcheck-2 (12.11.2026, Wendekarte, Zins je Bindung, Lage & Markt)
   Der öffentliche Deal-Check auf der Startseite — ohne Anmeldung.

   Gerechnet wird NICHTS hier: DealKpis.compute() (deal-kpis.js, mit
   Dscr.compute() aus dscr-engine.js), DealScore.computeFromKpis()
   (dealscore.js) und ScoreTier.stufe() (score-tiers.js) kommen aus der App
   (index.html lädt sie mit denselben Bustern wie frontend/index.html,
   tools/buster-ebenen-pruefen.mjs wacht darüber).

   Die Abbildung der Eingaben folgt dem Quick-Check (js/quick-check.js,
   qcCalc): Darlehen = Kaufpreis + Nebenkosten − Eigenkapital, Score mit
   wp_kpi = 5 % des Kaufpreises und darlehen = d_total. Was hier fehlt, ersetzen
   die Vorgaben der App (config.js investmentProfileDefaults):
     ek_quote_default 10 %  · tilgung_default 1,5 %  · Nebenkosten 10 %
     bwk_anteil_default 16 % der Nettokaltmiete (nicht umlagefähig)
     + mietausfall_pct 1 %  → bwk_nul = 17 % der Jahresnettokaltmiete
   Ergebnis ist eine VORAB-Einstufung; der Text sagt das.

   landing-kern-3 · VORBELEGUNG 150.000 € / 880 € (Bestands-ETW, Faktor 14,2,
   Bruttorendite 7,0 %). Gemessen mit den echten Kernen in Node (11.11.2026):
     Zins 3,6 %: CF +93 €, DSCR 1,15, 69 · Solide
     Zins 4,1 %: CF +30 €, DSCR 1,04, 62 · Solide
     Zins 4,6 %: CF −32 €, DSCR 0,96, 53 · Solide
   ÜBERGABE IN DIE APP: der Knopf #dcLos trägt die fünf Zahlen als Fragment
   (#dc=1&kp=…&nkm=…&ek=…&zins=…&nk=…) — geht an keinen Server; die App
   (js/dealcheck-uebernahme.js) nimmt es an. Unverändert seit landing-kern-3.

   landing-dealcheck-2 · Marcel 12.11.2026: „cooler animieren … mit Wendekarte
   eingeben, man sieht nur so einen Score mit Progress-Bar … einfacher, kleiner …
   den indikativen Zins über die Jahre auswählen … und der sich das rauszieht …
   Schnellcheck mit Lage und Markt".
     · Eingaben nur noch Kaufpreis, Kaltmiete, Zinsbindung, optional PLZ.
       Eigenkapital (10 %) und Nebenkosten (10 %) stehen als Annahme auf der Rückseite.
     · ZINS JE BINDUNG aus /api/v1/market-rates/bauzins (öffentlich, dieselbe Quelle wie
       die Live-Marktzinsen der App: Bundesanleihe des Tages + Marktaufschlag aus der
       MFI-Zinsstatistik der Bundesbank + K). Gewählt wurde die Stufe „standard" (80 %
       Beleihung). landing-dealcheck-3 · Marcel 12.11.2026 „höheren": das Darlehen ist hier
       Kaufpreis + 10 % Nebenkosten − 10 % Eigenkapital = 100 % des Kaufpreises, also gilt die
       Stufe „voll" (stufen_ltv 100, Zuschlag +0,45 pp aus formel.zuschlaege, dieselbe Kurve wie
       die App). Gemessen 12.11.2026 mit den echten Kernen, 150.000 € / 880 € / 10 J:
         standard 4,16 %: CF +23 €, DSCR 1,03, 62 · Solide
         voll     4,61 %: CF −33 €, DSCR 0,96, 53 · Solide
       Die Übergabe in die App trägt denselben Zins (&zins=…).
       landing-dealcheck-4 · Marcel 12.11.2026 „ja auf 950 ändern": Vorbelegung Kaltmiete
       880 → 950 €, damit das Beispiel mit dem Vollfinanzierungszins nicht ins Minus kippt.
       Nachgerechnet mit den echten Kernen in Node (dieselben Zahlen wie oben reproduziert):
         950 € · standard 4,16 %: CF +81 €, DSCR 1,11, 67 · Solide
         950 € · voll     4,61 %: CF +25 €, DSCR 1,03, 62 · Solide  (Bruttorendite 7,6 %)
       Kommt kein Zins an, wird KEINER erfunden: dann erscheint ein Feld zum Selbsteintragen.
     · LAGE & MARKT aus /api/v1/market-stats/schnellcheck (v3324, nur eigene amtliche
       Tabellen, 0 € je Abruf — Begründung im Kopf von backend/src/routes/marketStats.js).
     · Keine Animation bei prefers-reduced-motion: Karte wechselt ohne Drehung, Zahlen stehen sofort.

   landing-dealcheck-14 · Marcel 19.11.2026: „zusätzliche Einnahmen, Tiefgarage 50 €, Küche 40 €, die müssen in den
   Score". Aufklappbar unter der Kaltmiete: Stellplatz (auch Garage), Küche, Sonstiges. Die Summe geht als ze in
   DealKpis.compute (Rendite, Cashflow, DSCR, damit in den Score), die 17 % Kosten bleiben auf der Kaltmiete (wie calc.js).
   Die Mietrechnung (Vergleichsmiete, Kappung, Neuvermietung 110/120 %) bleibt bei der Kaltmiete je m².
   Gemessen mit den echten Kernen in Node, 150.000 € / 850 € / 10 J voll 4,67 % (Stand 18.11.2026):
     ohne Zusatz: CF −66 €, DSCR 0,91, 47 · Schwach
     + 90 € (50 Tiefgarage + 40 Küche): CF +24 €, DSCR 1,03, 62 · Solide
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var box = document.getElementById('dealcheck');
  if (!box) return;
  /* landing-seo-3 · die Karte steht HIER (vorher als Markup in index.html), damit Startseite und
     Rechner-Seiten dieselbe Komponente haben. @@KP@@/@@NKM@@ = Startwerte, @@KPI@@ = Kennzahlen je Fokus. */
  var KARTE = [
    "<form class=\"dk-seite dk-vorn\" id=\"dkVorn\" onsubmit=\"return false\" autocomplete=\"off\" aria-label=\"Deal-Check Eingaben\">",
    "  <div class=\"dk-kopf\"><span class=\"dk-marke\">Deal-Check</span><span class=\"dk-nr\">Boarding · Vorab</span></div>",
    "  <label class=\"dk-f\"><span>Kaufpreis</span><input id=\"dcKp\" inputmode=\"decimal\" value=\"@@KP@@\" aria-label=\"Kaufpreis in Euro\"><i>€</i></label>",
    "  <label class=\"dk-f\"><span>Kaltmiete im Monat</span><input id=\"dcNkm\" inputmode=\"decimal\" value=\"@@NKM@@\" aria-label=\"Nettokaltmiete im Monat in Euro\"><i>€</i></label>",
    /* landing-dealcheck-14 · Marcel 19.11.2026: zusätzliche Einnahmen (Stellplatz/Garage, Küche, Sonstiges), aufklappbar.
       Sie gehen als ze in DealKpis.compute (wie im Quick-Check: qc_nkm_stp/garage/kueche/sonst -> ze), die Mietrechnung
       (Vergleichsmiete, Kappung, Neuvermietung) bleibt bei der Kaltmiete der Wohnung. */
    "  <details class=\"dk-zusatz\" id=\"dkZusatz\"><summary><span>Zusätzliche Einnahmen <em>optional</em></span><b id=\"dkZeSumme\">Stellplatz, Küche</b></summary>",
    "    <div class=\"dk-drei\"><label class=\"dk-f\"><span>Stellplatz</span><input id=\"dcZeStp\" inputmode=\"decimal\" placeholder=\"0\" aria-label=\"Stellplatz oder Garage im Monat in Euro, optional\"><i>€</i></label>",
    "      <label class=\"dk-f\"><span>Küche</span><input id=\"dcZeKue\" inputmode=\"decimal\" placeholder=\"0\" aria-label=\"Küche im Monat in Euro, optional\"><i>€</i></label>",
    "      <label class=\"dk-f\"><span>Sonstiges</span><input id=\"dcZeSon\" inputmode=\"decimal\" placeholder=\"0\" aria-label=\"Sonstige Einnahmen im Monat in Euro, optional\"><i>€</i></label></div>",
    "    <small class=\"dk-zusatz-h\">Je Monat, Stellplatz auch Garage oder Tiefgarage. Zählt in Rendite, Cashflow und Score. Mieterhöhung und Vergleichsmiete rechnen nur mit der Kaltmiete der Wohnung.</small>",
    "  </details>",
    "  <fieldset class=\"dk-bind\"><legend>Zinsbindung</legend>",
    "    <div class=\"dk-chips\" id=\"dkChips\" role=\"radiogroup\" aria-label=\"Zinsbindung\">",
    "      <button type=\"button\" role=\"radio\" aria-checked=\"false\" data-b=\"5\"><b>5 J</b><small>–</small></button>",
    "      <button type=\"button\" role=\"radio\" aria-checked=\"true\" class=\"an\" data-b=\"10\"><b>10 J</b><small>–</small></button>",
    "      <button type=\"button\" role=\"radio\" aria-checked=\"false\" data-b=\"15\"><b>15 J</b><small>–</small></button>",
    "      <button type=\"button\" role=\"radio\" aria-checked=\"false\" data-b=\"20\"><b>20 J</b><small>–</small></button>",
    "    </div>",
    "    <label class=\"dk-f dk-zins-eigen\" id=\"dkZinsEigen\" hidden><span>Zins selbst eintragen</span><input id=\"dcZins\" inputmode=\"decimal\" placeholder=\"z. B. 4,1\" aria-label=\"Sollzins in Prozent\"><i>%</i></label>",
    "    <small class=\"dk-stand\" id=\"dkStand\">Zins wird geladen …</small>",
    "  </fieldset>",
    "  <label class=\"dk-f dk-plz\"><span>PLZ <em>optional · Lage &amp; Markt</em></span><input id=\"dcPlz\" inputmode=\"numeric\" maxlength=\"5\" placeholder=\"z. B. 12345\" aria-label=\"Postleitzahl, optional\"></label>",
    "  <div class=\"dk-zwei\" id=\"dkObj\"><label class=\"dk-f\"><span>Baujahr <em>optional</em></span><input id=\"dcBj\" inputmode=\"numeric\" maxlength=\"4\" placeholder=\"z. B. 1975\" aria-label=\"Baujahr, optional\"></label>",
    "    <label class=\"dk-f\"><span>Wohnfläche <em>optional</em></span><input id=\"dcWfl\" inputmode=\"decimal\" maxlength=\"5\" placeholder=\"z. B. 70\" aria-label=\"Wohnfläche in Quadratmetern, optional\"><i>m²</i></label></div>",
    "  <button type=\"submit\" class=\"btn-p dk-los\" id=\"dkDreh\">Deal prüfen <span aria-hidden=\"true\">↻</span></button>",
    "</form>",
    "<div class=\"dk-seite dk-hinten\" id=\"dcErg\" aria-live=\"polite\" aria-hidden=\"true\">",
    "  <div class=\"dk-kopf\"><span class=\"dk-marke\">Deal Score</span><button type=\"button\" class=\"dk-zur\" id=\"dkZur\">↺ Eingaben ändern</button></div>",
    "  <div class=\"dk-score\">",
    "    <div class=\"dk-ring\" id=\"dcRing\"><svg viewBox=\"0 0 120 120\" aria-hidden=\"true\"><circle class=\"dk-ring-bg\" cx=\"60\" cy=\"60\" r=\"52\"/><circle class=\"dk-ring-v\" id=\"dkRingV\" cx=\"60\" cy=\"60\" r=\"52\"/></svg>",
    "      <div class=\"dk-ring-z\"><b id=\"dcScore\">0</b><small>/ 100</small></div></div>",
    "    <div class=\"dk-stufe-box\"><div class=\"dk-stufe\" id=\"dcStufe\">–</div>",
    "      <div class=\"dk-skala\" aria-hidden=\"true\"><i id=\"dkBalken\"></i><s style=\"left:35%\"></s><s style=\"left:50%\"></s><s style=\"left:70%\"></s><s style=\"left:85%\"></s></div>",
    "      <div class=\"dk-skala-w\" aria-hidden=\"true\"><span>Kritisch</span><span>Solide</span><span>Sehr gut</span></div></div>",
    "  </div>",
    "  <div class=\"dk-kpi\">@@KPI@@</div>",
    "  <div class=\"dk-lage\" id=\"dkLage\" hidden><div class=\"dk-lage-k\"><span id=\"dkLageTitel\">Lage &amp; Markt</span><a id=\"dkLageMehr\" href=\"https://app.dealpilot.immo/?register=1\">mehr in der App →</a></div><div class=\"dk-lage-g\" id=\"dkLageG\"></div><small id=\"dkLageQ\"></small></div>",
    "  <a class=\"btn-p dk-weiter\" id=\"dcLos\" href=\"https://app.dealpilot.immo/?register=1\">In DealPilot weiterrechnen →</a>",
    "  <p class=\"dk-annahme\" id=\"dcAnnahme\"></p>",
    "</div>"
  ].join('\n');

  /* landing-seo-3 · PARAMETER am <section id="dealcheck"> (Marcel 15.11.2026: „ein Rechner, nicht vier“):
       data-dk-fokus  rendite | cashflow | faktor   welche Kennzahl auf der Rückseite vorn steht (ohne: Startseite)
       data-dk-kp     Startwert Kaufpreis, z. B. "200.000" (ohne: 150.000)
       data-dk-nkm    Startwert Kaltmiete im Monat (ohne: 950)
     Gerechnet wird für jeden Fokus dasselbe, nur die Anzeige der Kennzahlen wechselt. */
  var FOKUS = box.getAttribute('data-dk-fokus') || '';
  var KPI = {
    cf:   { id: 'dcCf',   label: 'Cashflow / Monat', kl: 'dk-cf', huelle: 'dcCfK' },
    bmy:  { id: 'dcBmy',  label: 'Bruttorendite' },
    nmy:  { id: 'dcNmy',  label: 'Nettorendite' },
    fak:  { id: 'dcFak',  label: 'Kaufpreisfaktor' },
    dscr: { id: 'dcDscr', label: 'DSCR' }
  };
  var REIHE = { rendite: ['bmy', 'nmy', 'cf'], faktor: ['fak', 'bmy', 'cf'], cashflow: ['cf', 'dscr', 'bmy'] }[FOKUS] || ['cf', 'bmy', 'dscr'];
  function kpiHtml() {
    return REIHE.map(function (k, i) {
      var d = KPI[k], kl = [d.kl, i === 0 && k !== 'cf' ? 'dk-haupt' : ''].filter(Boolean).join(' ');
      return '<div' + (d.huelle ? ' id="' + d.huelle + '"' : '') + (kl ? ' class="' + kl + '"' : '') + '><span>' + d.label + '</span><b id="' + d.id + '">–</b></div>';
    }).join('');
  }
  var kEl = document.getElementById('dkKarte');
  if (kEl && !document.getElementById('dkVorn')) {
    kEl.innerHTML = KARTE.replace('@@KP@@', box.getAttribute('data-dk-kp') || '150.000')
      .replace('@@NKM@@', box.getAttribute('data-dk-nkm') || '950').replace('@@KPI@@', kpiHtml());
  }
  var VORGABE = { ek_pct: 10, tilg: 1.5, nul_pct: 17, nk_pct: 10, bindung: '10' };
  var STUFE = 'voll';   /* landing-dealcheck-3 · Beleihungsstufe aus /market-rates/bauzins (voll = 100 %) */
  var RING_U = 2 * Math.PI * 52;
  var $ = function (id) { return document.getElementById(id); };
  var karte = $('dkKarte'), vorn = $('dkVorn'), hinten = $('dcErg');
  var F = { kp: $('dcKp'), nkm: $('dcNkm'), zins: $('dcZins'), plz: $('dcPlz'), bj: $('dcBj'), wfl: $('dcWfl'),
            zeStp: $('dcZeStp'), zeKue: $('dcZeKue'), zeSon: $('dcZeSon') };
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var zinsen = null;            /* { '5': 4.11, … } vom Endpunkt, sonst null */
  var standText = '';
  var bindung = VORGABE.bindung;
  var lauf = 0;                 /* Zähler gegen überholte Animationen/Abrufe */

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
  function dez(n, st) { return n.toLocaleString('de-DE', { minimumFractionDigits: st, maximumFractionDigits: st }); }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function pct(n) { return dez(Math.round(n * 100) / 100, 2) + ' %'; }
  function setze(id, t) { var e = $(id); if (e) e.textContent = t; }
  function datum(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : null; }

  /* ── Zins je Bindung ────────────────────────────────────────────────── */
  function zinsJetzt() {
    if (zinsen && zinsen[bindung] != null) return zinsen[bindung];
    var z = zahl(F.zins);
    return z >= 0 && z < 20 ? z : NaN;
  }
  function chipsZeigen() {
    var bt = $('dkChips').querySelectorAll('button');
    for (var i = 0; i < bt.length; i++) {
      var b = bt[i].getAttribute('data-b'), an = b === bindung;
      bt[i].classList.toggle('an', an);
      bt[i].setAttribute('aria-checked', an ? 'true' : 'false');
      var z = zinsen && zinsen[b];
      bt[i].querySelector('small').textContent = z != null ? dez(z, 2) + ' %' : '–';
    }
  }
  $('dkChips').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    bindung = b.getAttribute('data-b');
    chipsZeigen();
  });

  fetch('/api/v1/market-rates/bauzins')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var ir = d && d.indicativeRates;
      if (!ir) throw new Error('kein Zins');
      var z = {}, n = 0;
      ['5', '10', '15', '20'].forEach(function (b) {
        /* landing-dealcheck-3 · Stufe „voll" (100 % Beleihung, stufen_ltv des Endpunkts): bei 10 % Eigenkapital
           und 10 % Nebenkosten ist das Darlehen = Kaufpreis. Bis hier stand „standard" (80 %). */
        var s = ir[b], w = s && (s[STUFE] != null ? s[STUFE] : null);
        if (w != null && isFinite(w)) { z[b] = Math.round(w * 100) / 100; n++; }
      });
      if (!n) throw new Error('kein Zins');
      zinsen = z;
      if (zinsen[bindung] == null) bindung = Object.keys(zinsen)[0];
      var bd = d.formel && d.formel.bund_datum && (d.formel.bund_datum['10'] || d.formel.bund_datum[bindung]);
      var st = datum(bd) || datum(d.abgerufen);
      var ltvS = d.stufen_ltv && d.stufen_ltv[STUFE];
      standText = 'Zins für Vollfinanzierung (' + (ltvS || 100) + ' % Beleihung), indikativ aus Daten der Deutschen Bundesbank' + (st ? ' · Stand ' + st : '');
      setze('dkStand', standText);
      chipsZeigen();
    })
    .catch(function () {
      /* Kein Zins erfunden: Bindungen ausblenden, Feld zum Selbsteintragen zeigen */
      zinsen = null;
      $('dkChips').hidden = true;
      $('dkZinsEigen').hidden = false;
      setze('dkStand', 'Der Tageszins ist gerade nicht abrufbar. Trag deinen Zins selbst ein.');
    });

  /* ── Zusätzliche Einnahmen (landing-dealcheck-14) ───────────────────── */
  function zeTeil(el) { var z = zahl(el); return z > 0 && z < 100000 ? z : 0; }
  function zeMonat() { return zeTeil(F.zeStp) + zeTeil(F.zeKue) + zeTeil(F.zeSon); }
  function zeZeigen() {
    var z = zeMonat();
    setze('dkZeSumme', z > 0 ? '+' + eur(z) + ' im Monat' : 'Stellplatz, Küche');
    $('dkZeSumme').classList.toggle('an', z > 0);
  }
  [F.zeStp, F.zeKue, F.zeSon].forEach(function (el) { if (el) el.addEventListener('input', zeZeigen); });

  /* ── Rechnen (nur Kerne der App) ────────────────────────────────────── */
  function rechnen() {
    var kp = zahl(F.kp), nkm = zahl(F.nkm), zins = zinsJetzt(), ze = zeMonat();
    if (!(kp > 0) || !(nkm > 0) || !isFinite(zins) || !window.DealKpis || !window.DealScore || !window.ScoreTier) return null;
    var ek = Math.round(kp * VORGABE.ek_pct / 100);
    var nkPct = VORGABE.nk_pct, nk = kp * nkPct / 100;
    var darlehen = Math.max(0, kp + nk - ek);
    var k = DealKpis.compute({
      /* landing-dealcheck-14 · ze = zusätzliche Einnahmen. Die 17 % nicht umlagefähige Kosten stehen wie in der App
         (calc.js bwk_nul_pct x nkm, ohne ze) auf der Kaltmiete der Wohnung. */
      kp: kp, nk: nk, nkm: nkm, ze: ze, uf: 0,
      bwk_ul: 0, bwk_nul: nkm * 12 * VORGABE.nul_pct / 100,
      d1: darlehen, d1z: zins, d1t: VORGABE.tilg, ek: ek
    });
    var ds = DealScore.computeFromKpis({
      kp: kp, cf_m: k.cf_m, nmy: k.nmy, ltv: k.ltv, dscr: k.dscr,
      wp_kpi: kp * 0.05, mstg: 1.5,
      darlehen: (k.d_total != null && isFinite(k.d_total)) ? k.d_total : null
    });
    return { kp: kp, nkm: nkm, ze: ze, zins: zins, ek: ek, nk: nk, nkPct: nkPct, darlehen: darlehen, k: k, score: ds.score, st: ScoreTier.stufe(ds.score) };
  }

  function zeichne(r, anteil) {
    var s = Math.round(r.score * anteil), cf = r.k.cf_m * anteil;
    setze('dcScore', String(s));
    $('dkRingV').style.strokeDashoffset = String(RING_U * (1 - Math.max(0, Math.min(100, r.score * anteil)) / 100));
    $('dkBalken').style.width = Math.max(0, Math.min(100, r.score * anteil)) + '%';
    if ($('dcCf')) setze('dcCf', (cf >= 0 ? '+' : '−') + eur(Math.abs(cf)));
  }

  function zeigen(r) {
    var n = ++lauf;
    var ring = $('dcRing'), stufe = $('dcStufe');
    ring.setAttribute('data-farbe', r.st.farbe);
    stufe.setAttribute('data-farbe', r.st.farbe);
    setze('dcStufe', r.st.wort);
    setze('dcBmy', pct(r.k.bmy));
    setze('dcDscr', r.k.d_total > 0 ? dez(Math.round(r.k.dscr * 100) / 100, 2) : 'entfällt');
    if ($('dcCfK')) $('dcCfK').classList.toggle('neg', r.k.cf_m < 0);
    setze('dcNmy', pct(r.k.nmy));                       /* landing-seo-3 · Fokus Rendite */
    setze('dcFak', dez(Math.round(r.k.fak * 10) / 10, 1));   /* landing-seo-3 · Fokus Faktor */
    var los = $('dcLos');
    if (los) {
      /* landing-kern-3 · nur das Fragment ändern — umgebung.js schreibt den Host um */
      var basis = String(los.getAttribute('href') || '').split('#')[0];
      los.setAttribute('href', basis + '#dc=1&kp=' + Math.round(r.kp) + '&nkm=' + Math.round(r.nkm) + '&ek=' + Math.round(r.ek)
        + '&zins=' + (Math.round(r.zins * 100) / 100) + '&nk=' + (Math.round(r.nkPct * 100) / 100)
        /* landing-dealcheck-14 · zusätzliche Einnahmen im Monat. Die App (js/dealcheck-uebernahme.js) liest &ze noch nicht
           und setzt ze = 0, bis sie nachgezogen ist (offener Punkt). */
        + (r.ze > 0 ? '&ze=' + Math.round(r.ze) : ''));
    }
    setze('dcAnnahme', (r.ze > 0 ? 'Mit ' + eur(r.ze) + ' zusätzlichen Einnahmen im Monat. ' : '') + 'Vorab-Rechnung mit ' + eur(r.ek) + ' Eigenkapital (10 %), ' + eur(r.nk) + ' Nebenkosten (10 %), Darlehen '
      + eur(r.darlehen) + ' zu ' + pct(r.zins) + (zinsen ? ' (' + bindung + ' J)' : '') + ', ' + pct(VORGABE.tilg)
      + ' Tilgung, ' + VORGABE.nul_pct + ' % nicht umlagefähige Kosten. Alles anpassbar in der App. Keine Finanzierungs- oder Steuerberatung.');
    if (ruhig) { zeichne(r, 1); return; }
    zeichne(r, 0);
    var t0 = null, dauer = 1300, warte = 380;
    function schritt(t) {
      if (n !== lauf) return;
      if (t0 == null) t0 = t + warte;
      var x = Math.max(0, Math.min(1, (t - t0) / dauer));
      zeichne(r, 1 - Math.pow(1 - x, 3));
      if (x < 1) requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
  }

  /* ── Lage & Markt (optional, per PLZ) ───────────────────────────────── */
  function kachel(titel, wert, wort, ton) {
    var d = document.createElement('div');
    d.className = 'dk-lk';
    if (ton) d.setAttribute('data-ton', ton);
    var a = document.createElement('span'); a.textContent = titel;
    var b = document.createElement('b'); b.textContent = wert;
    d.appendChild(a); d.appendChild(b);
    if (wort) { var c = document.createElement('em'); c.textContent = wort; d.appendChild(c); }
    return d;
  }
  /* Die Landing-Domain leitet nur einzelne /api-Pfade weiter (Caddy: market-rates, public/stats, track) —
     der Schnellcheck geht deshalb an den App-Host, wie erstflug-popup.js und promo-erstflug.js:
     dealpilot.immo -> app.dealpilot.immo, staging.dealpilot.immo -> app.staging.dealpilot.immo (CORS erlaubt). */
  function appApi() {
    var h = location.hostname.replace(/^www\./i, '');
    if (h.indexOf('localhost') >= 0 || h.indexOf('127.0.0.1') === 0) return '/api/v1';
    return location.protocol + '//' + (h.indexOf('app.') === 0 ? h : 'app.' + h) + '/api/v1';
  }
  function lage(plz) {
    var feld = $('dkLage'), g = $('dkLageG'), n = lauf;
    if (!/^\d{5}$/.test(plz)) { feld.hidden = true; return; }
    feld.hidden = false;
    setze('dkLageTitel', 'Lage & Markt · PLZ ' + plz);
    setze('dkLageQ', '');
    g.innerHTML = '';
    for (var i = 0; i < 6; i++) { var l = document.createElement('div'); l.className = 'dk-lk laedt'; g.appendChild(l); }
    /* landing-dealcheck-6 · Baujahr/Wohnfläche optional für die Vergleichsmiete */
    var bj = parseInt(String(F.bj.value || '').replace(/\D/g, ''), 10), wfl = zahl(F.wfl);
    bj = bj >= 1800 && bj <= 2030 ? bj : null; wfl = wfl >= 15 && wfl <= 400 ? wfl : null;
    fetch(appApi() + '/market-stats/schnellcheck?plz=' + plz + (bj ? '&baujahr=' + bj : '') + (wfl ? '&wfl=' + Math.round(wfl) : ''))
      .then(function (r) { return r.ok ? r.json() : (r.status === 429 ? { _bremse: true } : null); })
      .then(function (d) {
        if (n !== lauf) return;
        g.innerHTML = '';
        if (!d || d._bremse) { setze('dkLageQ', d && d._bremse ? 'Gerade zu viele Abrufe. Bitte in ein paar Minuten noch einmal.' : 'Lage & Markt gerade nicht abrufbar.'); return; }
        if (d.gebiet) setze('dkLageTitel', 'Lage & Markt · ' + String(d.gebiet).split(',')[0]);
        var k = [];
        if (d.makrolage) k.push(kachel('Makrolage', d.makrolage.wert + ' / 100', d.makrolage.wort, d.makrolage.ton));
        /* landing-dealcheck-5 · Marcel 12.11.2026 „es gibt nichts zu den Einwohnern": die Zahl selbst, mit Ebene
           (Gemeinde oder Kreis) und Entwicklung; ohne Zahl bleibt die Entwicklung allein wie bisher. */
        var bv = d.bevoelkerung, ew = d.einwohner;
        var trend = bv ? (bv.wert > 0 ? '+' : bv.wert < 0 ? '−' : '±') + dez(Math.abs(bv.wert), 1) + ' %/J' : null;
        if (ew && ew.wert > 0) k.push(kachel(ew.ebene === 'gemeinde' ? 'Einwohner' : 'Einwohner Kreis', Math.round(ew.wert).toLocaleString('de-DE'),
          (bv ? bv.wort + ' · ' + trend : (ew.fuenf_jahre_pct != null ? (ew.fuenf_jahre_pct > 0 ? '+' : '') + dez(ew.fuenf_jahre_pct, 1) + ' % in 5 J.' : 'Stand ' + ew.jahr)), bv ? bv.ton : null));
        else if (bv) k.push(kachel('Einwohner', trend, bv.wort, bv.ton));
        if (d.leerstand) k.push(kachel('Leerstand', dez(d.leerstand.wert, 1) + ' %', d.leerstand.wort + ' · Zensus', d.leerstand.ton));
        if (d.miete) {
          var art = d.mietspiegel && d.mietspiegel.art;
          /* landing-dealcheck-5 · Marcel 12.11.2026 „die Miete ist sehr gering": es ist der Durchschnitt ALLER laufenden
             Mietverträge (Zensus, fortgeschrieben) - alte Verträge ziehen ihn nach unten, Neuvermietung liegt meist darüber.
             Das steht jetzt an der Kachel; bis hierhin stand dort die Art des Mietspiegels, als wäre es dessen Wert. */
          /* landing-dealcheck-13 · Marcel 19.11.2026: „als Investor denken … Bestandsmieten maximal möglich, in der Karte
             angeben, was da ist, und den Schnitt darunter". Gross steht der obere Rand der Vergleichsmiete (bis dorthin
             darf im Bestand nach § 558 erhoeht werden), darunter der Durchschnitt aller laufenden Vertraege (Zensus). */
          var vgB = d.vergleichsmiete, obB = vgB && vgB.qm > 0 ? (vgB.quelle === 'mietspiegel' && vgB.oben > 0 ? vgB.oben : vgB.qm * OBEN_TYPISCH) : null;
          /* landing-dealcheck-13b · Marcel 19.11.2026 („ja nimm 1"): mit eigener Miete zeigt die Kachel, was im Bestand
             in 3 Jahren erreichbar ist (Rand oder Kappung, was zuerst greift) bzw. „ausgereizt"; sonst den Rand. */
          var nkmB = zahl(F.nkm), istB = wfl && nkmB > 0 ? nkmB / wfl : null, kpB = d.kappung && d.kappung.pct ? d.kappung.pct : 20;
          if (obB && istB) {
            var zB = Math.min(obB, istB * (1 + kpB / 100));
            if (zB <= istB + 0.005) k.push(kachel('Bestand in 3 Jahren', 'ausgereizt', 'deine ' + dez(istB, 2) + ' € · Rand ' + dez(obB, 2) + ' €', null));
            else k.push(kachel('Bestand in 3 Jahren', dez(zB, 2) + ' €/m²', '+' + dez(Math.round((zB - istB) * wfl), 0) + ' € im Monat · Ø Verträge ' + dez(d.miete.qm, 2) + ' €', null));
          }
          else if (obB) k.push(kachel('Bestandsmiete bis', (vgB.quelle === 'mietspiegel' && vgB.oben > 0 ? '' : 'ca. ') + dez(obB, 2) + ' €/m²', 'Ø laufende Verträge ' + dez(d.miete.qm, 2) + ' €', null));
          else k.push(kachel('Bestandsmiete Ø', dez(d.miete.qm, 2) + ' €/m²', 'alle laufenden Verträge', null));
        }
        /* landing-dealcheck-6 · Vergleichsmiete (Marcel 12.11.2026 „haben wir auch die Vergleichsmieten?"): Mietspiegel-Mittelwert
           der Gemeinde, wo wir die Werte führen dürfen, sonst DealPilot-Näherung (nie „Mietspiegel" genannt). */
        var vg = d.vergleichsmiete;
        /* landing-dealcheck-13 · Marcel 19.11.2026: „bei Vergleichsmieten nicht den Mittelwert, sondern den obersten Wert,
           darunter die Spanne". */
        if (vg && vg.qm > 0) k.push(kachel('Vergleichsmiete bis', (vg.quelle === 'mietspiegel' && vg.oben > 0 ? dez(vg.oben, 2) : 'ca. ' + dez(vg.qm * OBEN_TYPISCH, 2)) + ' €/m²',
          (vg.quelle === 'mietspiegel' ? (vg.unten && vg.oben ? 'Spanne ' + dez(vg.unten, 2) + ' bis ' + dez(vg.oben, 2) + ' · Mittel ' + dez(vg.qm, 2) : 'Mittel ' + dez(vg.qm, 2)) : 'Mittel ' + dez(vg.qm, 2) + ' · Näherung ±' + dez(vg.abweichung_pct || 7.5, 1).replace(',0', '') + ' %')
          + (vg.objekt && vg.objekt.norm ? ' · Bj. ' + vg.objekt.baujahr + ', ' + vg.objekt.wfl + ' m²' : ''), null));
        /* Kappungsgrenze und Mietpreisbremse in EINER Kachel (landing-dealcheck-5 hatte zwei) */
        var mb = d.mietpreisbremse, kp = d.kappung;
        if ((kp && kp.pct) || (mb && mb.gilt != null)) {
          var bis = mb && mb.bis && /^\d{4}-\d{2}/.test(mb.bis) ? ' bis ' + mb.bis.slice(5, 7) + '/' + mb.bis.slice(0, 4) : '';
          k.push(kachel('Mietrecht', kp && kp.pct ? 'Kappung ' + kp.pct + ' %' : '–',
            mb && mb.gilt === true ? 'Mietpreisbremse' + bis : mb && mb.gilt === false ? 'keine Mietpreisbremse' : 'Bremse: bitte prüfen', null));
        }
        if (!k.length) { setze('dkLageQ', 'Für diese PLZ liegen uns noch keine amtlichen Lagedaten vor. In der App gibt es den vollen Marktbericht.'); return; }
        k.forEach(function (x, i) { x.style.animationDelay = (i * 90) + 'ms'; g.appendChild(x); });
        var satz = mieteSatz(vg, kp, mb, wfl);
        if (satz) { var p = document.createElement('p'); p.className = 'dk-miete-satz'; p.innerHTML = satz; g.appendChild(p); }
        var mo = d.miete && d.miete.monat && /^\d{4}-\d{2}$/.test(d.miete.monat) ? d.miete.monat.slice(5) + '/' + d.miete.monat.slice(0, 4) : null;
        setze('dkLageQ', 'Amtliche Daten: Regionaldatenbank, Zensus 2022' + (mo ? ' (Miete fortgeschrieben auf ' + mo + ')' : '') + (d.mietspiegel && d.mietspiegel.art && d.mietspiegel.art !== 'unklar' ? ', ' + (d.mietspiegel.art === 'qualifiziert' ? 'qualifizierter' : d.mietspiegel.art === 'einfach' ? 'einfacher' : '') + ' Mietspiegel der Gemeinde vorhanden' : '') + (d.kappung || d.mietpreisbremse ? ', Landesverordnungen nach § 558 Abs. 3 und § 556d BGB' : '') + (d.einwohner && d.einwohner.ebene === 'kreis' ? '. Einwohner auf Kreisebene' : '') + '.');
      })
      .catch(function () { if (n === lauf) { g.innerHTML = ''; setze('dkLageQ', 'Lage & Markt gerade nicht abrufbar.'); } });
  }

  /* landing-dealcheck-8 · HÖCHSTMIETE, rechtlich gegengeprüft (Recherche 12.11.2026, Marcel: „keine Falschaussage"):
       Maßstab ist die Vergleichsmiete DER WOHNUNG (Einzelvergleichsmiete) - der Oberwert der Spanne nur, wenn
       Ausstattung, Lage, Zustand ihn tragen (BGH VIII ZR 82/18, VIII ZR 346/10). Deshalb zwei Zahlen: Mittel und Rand.
       Bestand  § 558: bis zur Vergleichsmiete; Kappung 20/15 % innerhalb von 3 Jahren insgesamt; 15 Monate Sperrfrist.
       Bremse § 556d: höchstens 110 % der Vergleichsmiete der Wohnung; Ausnahmen § 556e/f; Verordnungen längstens bis 31.12.2029.
       Ohne Bremse: keine mietrechtliche Obergrenze; über 120 % der üblichen Miete droht Mietpreisüberhöhung (§ 5 WiStG,
       nur bei Ausnutzung eines knappen Angebots), Mietwucher (§ 291 StGB) erst bei auffälligem Missverhältnis.
       „Mietwucher" nie für § 5 WiStG. Alles als Orientierung, keine Rechtsberatung.
     Ohne Spanne (DealPilot-Näherung): oberer Rand typisch × 1,186 = Median Oberwert/Mittelwert über 3.051 Felder aus
     70 freien Mietspiegeln (gemessen 12.11.2026), mit „ca.". */
  /* landing-dealcheck-10 · Marcel 13.11.2026: EIN Faktor mit der App (lib/mietanker.js NAEHERUNG_OBEN 1,14,
     477 Rasterpunkte). Die 1,186 oben stammt aus einer anderen Zählung (3.051 Felder) und lag höher. */
  var OBEN_TYPISCH = 1.14;
  var OHNE_BREMSE = 1.20;   /* landing-dealcheck-13d · Marcel 19.11.2026: doch 120 % */
  /* landing-dealcheck-8b · Marcel 12.11.2026: „bitte ohne ; oder – nur mit Punkt und Komma … Mietwucher anders
     ausdrücken". Kurze Sätze, kein Gedankenstrich, kein Semikolon, das Wort Mietwucher fällt weg. */
  function mieteSatz(vg, kp, mb, wfl) {
    if (!vg || !(vg.qm > 0)) return null;
    var nkm = zahl(F.nkm), mitW = wfl && nkm > 0, kpct = kp && kp.pct ? kp.pct : 20;
    var spanne = vg.quelle === 'mietspiegel' && vg.oben > 0, oben = spanne ? vg.oben : vg.qm * OBEN_TYPISCH, ca = spanne ? '' : 'ca. ';
    var eu = function (qm, mitCa) { return '<b>' + (mitCa ? ca : '') + dez(qm, 2) + ' €</b>' + (mitW ? ' (' + dez(Math.round(qm * wfl), 0) + ' € im Monat)' : ''); };
    var t = '<b>Was an Miete möglich ist, je m² nettokalt</b><br>';
    /* landing-dealcheck-12 · v3770 · Marcel 18.11.2026 („die oberste Grenze nehmen plus den zehn Prozent … das nutzen wir
       für die gesamte App"): wie die App (lib/mietanker.js zielMaximum) zuerst das Maximum am oberen Rand mit seiner
       Bedingung, der Wert vom Mittel nur noch als sicherer Wert danach. Bis hier stand „höchstens 110 % …, also <Mittel>"
       vorn, der Mittelwert las sich als Grenze. */
    t += '<b>Bestand:</b> bis zur Vergleichsmiete der Wohnung, am oberen Rand ' + eu(oben, true)
      + ', wenn Ausstattung, Lage und Zustand das tragen, sonst ' + eu(vg.qm) + ' im Mittel. Erhöht werden darf um höchstens ' + kpct + ' % in 3 Jahren, frühestens 15 Monate nach der letzten Erhöhung (§ 558 BGB).<br>';
    if (mb && mb.gilt === true) t += '<b>Neuvermietung:</b> hier gilt die Mietpreisbremse. Nach § 556d BGB sind höchstens 110 % der Vergleichsmiete erlaubt, am oberen Rand also ' + eu(oben * 1.1, true)
      + ', wenn Ausstattung, Lage und Zustand das tragen, sonst ' + eu(vg.qm * 1.1) + '. Ausnahmen gibt es bei höherer Vormiete, Modernisierung in den letzten 3 Jahren und Erstbezug nach dem 01.10.2014.';
    /* landing-dealcheck-13c · Marcel 19.11.2026: ohne Mietpreisbremse zuerst 110 %, dann (13d) doch 120 %, die rechtlich
       unbedenkliche Grenze nach § 5 WiStG; in der App einstellbar. */
    else if (mb && mb.gilt === false) t += '<b>Neuvermietung:</b> hier gilt keine Mietpreisbremse, die Miete ist frei vereinbar. DealPilot rechnet mit 120 % der Vergleichsmiete, am oberen Rand also ' + eu(oben * OHNE_BREMSE, true)
      + ', wenn Ausstattung, Lage und Zustand das tragen, sonst ' + eu(vg.qm * OHNE_BREMSE) + '. Das ist die Grenze, bis zu der eine Miete rechtlich unbedenklich ist. Wer darüber geht und dabei ein knappes Wohnungsangebot ausnutzt, riskiert ein Bußgeld wegen überhöhter Miete (§ 5 WiStG).';
    else t += '<b>Neuvermietung:</b> ob die Mietpreisbremse gilt, bitte prüfen.';
    /* landing-dealcheck-13 · Marcel 19.11.2026: die eigene Miete am oberen Rand und an der Neuvermietung messen
       (Investorensicht), nicht am Mittel. Der Mittelwert steht nur noch als Einordnung dabei. */
    var neuMax = mb && mb.gilt === true ? oben * 1.1 : mb && mb.gilt === false ? oben * OHNE_BREMSE : null;
    if (mitW) {
      var ist = nkm / wfl, bisOben = oben - ist, ziel = Math.min(oben, ist * (1 + kpct / 100));
      var mtl = function (qm) { return dez(Math.round(qm * wfl), 0) + ' €'; };
      t += '<br><b>Deine Miete:</b> ' + dez(ist, 2) + ' € je m² (Mittel ' + dez(vg.qm, 2) + ' €). '
        + (zeMonat() > 0 ? 'Gerechnet nur mit der Kaltmiete der Wohnung, ohne Stellplatz, Küche und Sonstiges. ' : '');   /* landing-dealcheck-14 */
      if (bisOben > 0.05) {
        t += 'Bis zum oberen Rand fehlen ' + ca + dez(bisOben, 2) + ' €, das sind ' + mtl(bisOben) + ' im Monat. '
          + (ziel < oben - 0.005 ? 'Wegen der Kappung sind in 3 Jahren davon bis <b>' + dez(ziel, 2) + ' €</b> erreichbar (' + mtl(ziel - ist) + ' mehr im Monat), der Rest in den Jahren danach. '
                                 : 'Das ist in 3 Jahren erreichbar, also <b>' + mtl(bisOben) + ' mehr im Monat</b>. ')
          + 'Voraussetzung: Ausstattung, Lage und Zustand tragen den oberen Wert.';
      } else {
        t += 'Sie liegt ' + (bisOben < -0.05 ? dez(-bisOben, 2) + ' € über dem' : 'am') + ' oberen Rand. Im Bestand ist sie ausgereizt, eine Erhöhung nach § 558 BGB geht voraussichtlich nicht mehr.';
      }
      if (neuMax && neuMax > ist + 0.05) t += ' Bei einer Neuvermietung sind bis ' + ca + dez(neuMax, 2) + ' € möglich, also ' + mtl(neuMax - ist) + ' mehr im Monat.';
      t += ' Modernisierung, Index- oder Staffelmiete sind getrennt zu prüfen.';
    }
    t += ' <small>Orientierung, keine Rechtsberatung.';
    if (!spanne) t += ' Die Vergleichsmiete ist eine DealPilot-Näherung (±' + dez(vg.abweichung_pct || 7.5, 1) + ' %). Für eine Mieterhöhung braucht es den Mietspiegel, drei Vergleichswohnungen oder ein Gutachten.';
    return t + '</small>';
  }

  /* ── Drehen ─────────────────────────────────────────────────────────── */
  /* landing-dealcheck-9 · Karte so hoch wie die sichtbare Seite (wächst mit den nachgeladenen Kacheln mit) */
  function hoehe() { var s = karte.classList.contains('gedreht') ? hinten : vorn; if (s && s.offsetHeight) karte.style.height = s.offsetHeight + 'px'; }
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(hoehe); ro.observe(vorn); ro.observe(hinten); }
  window.addEventListener('resize', hoehe);
  function seite(hintenAn) {
    karte.classList.toggle('gedreht', hintenAn);
    hoehe();
    hinten.setAttribute('aria-hidden', hintenAn ? 'false' : 'true');
    vorn.setAttribute('aria-hidden', hintenAn ? 'true' : 'false');
    if ('inert' in hinten) { hinten.inert = !hintenAn; vorn.inert = hintenAn; }
  }
  function pruefen() {
    var r = rechnen();
    if (!r) {
      var leer = !(zahl(F.kp) > 0) ? F.kp : !(zahl(F.nkm) > 0) ? F.nkm : (!zinsen ? F.zins : null);
      if (leer) leer.focus();
      return;
    }
    seite(true);
    zeigen(r);
    lage(String(F.plz.value || '').replace(/\D/g, '').slice(0, 5));
    /* Fokus nur bei Tastaturbedienung mitnehmen — nach einem Klick stand sonst ein Rahmen um „Eingaben ändern" */
    if (perTaste) setTimeout(function () { var z = $('dkZur'); if (z && hinten.getAttribute('aria-hidden') === 'false') z.focus({ preventScroll: true }); }, ruhig ? 0 : 500);
  }
  var perTaste = false;
  document.addEventListener('keydown', function () { perTaste = true; }, true);
  document.addEventListener('pointerdown', function () { perTaste = false; }, true);
  vorn.addEventListener('submit', function (e) { e.preventDefault(); pruefen(); });
  $('dkZur').addEventListener('click', function () {
    lauf++;
    seite(false);
    if (perTaste) setTimeout(function () { F.kp.focus({ preventScroll: true }); }, ruhig ? 0 : 500);
  });
  F.plz.addEventListener('input', function () { F.plz.value = String(F.plz.value).replace(/\D/g, '').slice(0, 5); });
  F.bj.addEventListener('input', function () { F.bj.value = String(F.bj.value).replace(/\D/g, '').slice(0, 4); });
  seite(false);

  /* Einmal kurz anwackeln, wenn die Karte ins Bild kommt — zeigt, dass sie sich dreht */
  if (!ruhig && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        setTimeout(function () { if (!karte.classList.contains('gedreht')) { karte.classList.add('wink'); setTimeout(function () { karte.classList.remove('wink'); }, 1300); } }, 500);
      });
    }, { threshold: 0.6 });
    io.observe(karte);
  }
})();
