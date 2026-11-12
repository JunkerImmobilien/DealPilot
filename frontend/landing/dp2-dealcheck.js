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
       Kommt kein Zins an, wird KEINER erfunden: dann erscheint ein Feld zum Selbsteintragen.
     · LAGE & MARKT aus /api/v1/market-stats/schnellcheck (v3324, nur eigene amtliche
       Tabellen, 0 € je Abruf — Begründung im Kopf von backend/src/routes/marketStats.js).
     · Keine Animation bei prefers-reduced-motion: Karte wechselt ohne Drehung, Zahlen stehen sofort.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var box = document.getElementById('dealcheck');
  if (!box) return;
  var VORGABE = { ek_pct: 10, tilg: 1.5, nul_pct: 17, nk_pct: 10, bindung: '10' };
  var STUFE = 'voll';   /* landing-dealcheck-3 · Beleihungsstufe aus /market-rates/bauzins (voll = 100 %) */
  var RING_U = 2 * Math.PI * 52;
  var $ = function (id) { return document.getElementById(id); };
  var karte = $('dkKarte'), vorn = $('dkVorn'), hinten = $('dcErg');
  var F = { kp: $('dcKp'), nkm: $('dcNkm'), zins: $('dcZins'), plz: $('dcPlz') };
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
      setze('dkStand', 'Der Tageszins ist gerade nicht abrufbar – trag deinen Zins selbst ein.');
    });

  /* ── Rechnen (nur Kerne der App) ────────────────────────────────────── */
  function rechnen() {
    var kp = zahl(F.kp), nkm = zahl(F.nkm), zins = zinsJetzt();
    if (!(kp > 0) || !(nkm > 0) || !isFinite(zins) || !window.DealKpis || !window.DealScore || !window.ScoreTier) return null;
    var ek = Math.round(kp * VORGABE.ek_pct / 100);
    var nkPct = VORGABE.nk_pct, nk = kp * nkPct / 100;
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
    return { kp: kp, nkm: nkm, zins: zins, ek: ek, nk: nk, nkPct: nkPct, darlehen: darlehen, k: k, score: ds.score, st: ScoreTier.stufe(ds.score) };
  }

  function zeichne(r, anteil) {
    var s = Math.round(r.score * anteil), cf = r.k.cf_m * anteil;
    setze('dcScore', String(s));
    $('dkRingV').style.strokeDashoffset = String(RING_U * (1 - Math.max(0, Math.min(100, r.score * anteil)) / 100));
    $('dkBalken').style.width = Math.max(0, Math.min(100, r.score * anteil)) + '%';
    setze('dcCf', (cf >= 0 ? '+' : '−') + eur(Math.abs(cf)));
  }

  function zeigen(r) {
    var n = ++lauf;
    var ring = $('dcRing'), stufe = $('dcStufe');
    ring.setAttribute('data-farbe', r.st.farbe);
    stufe.setAttribute('data-farbe', r.st.farbe);
    setze('dcStufe', r.st.wort);
    setze('dcBmy', pct(r.k.bmy));
    setze('dcDscr', r.k.d_total > 0 ? dez(Math.round(r.k.dscr * 100) / 100, 2) : 'entfällt');
    $('dcCfK').classList.toggle('neg', r.k.cf_m < 0);
    var los = $('dcLos');
    if (los) {
      /* landing-kern-3 · nur das Fragment ändern — umgebung.js schreibt den Host um */
      var basis = String(los.getAttribute('href') || '').split('#')[0];
      los.setAttribute('href', basis + '#dc=1&kp=' + Math.round(r.kp) + '&nkm=' + Math.round(r.nkm) + '&ek=' + Math.round(r.ek)
        + '&zins=' + (Math.round(r.zins * 100) / 100) + '&nk=' + (Math.round(r.nkPct * 100) / 100));
    }
    setze('dcAnnahme', 'Vorab-Rechnung mit ' + eur(r.ek) + ' Eigenkapital (10 %), ' + eur(r.nk) + ' Nebenkosten (10 %), Darlehen '
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
    for (var i = 0; i < 4; i++) { var l = document.createElement('div'); l.className = 'dk-lk laedt'; g.appendChild(l); }
    fetch(appApi() + '/market-stats/schnellcheck?plz=' + plz)
      .then(function (r) { return r.ok ? r.json() : (r.status === 429 ? { _bremse: true } : null); })
      .then(function (d) {
        if (n !== lauf) return;
        g.innerHTML = '';
        if (!d || d._bremse) { setze('dkLageQ', d && d._bremse ? 'Gerade zu viele Abrufe – in ein paar Minuten noch einmal.' : 'Lage & Markt gerade nicht abrufbar.'); return; }
        if (d.gebiet) setze('dkLageTitel', 'Lage & Markt · ' + String(d.gebiet).split(',')[0]);
        var k = [];
        if (d.makrolage) k.push(kachel('Makrolage', d.makrolage.wert + ' / 100', d.makrolage.wort, d.makrolage.ton));
        if (d.bevoelkerung) k.push(kachel('Einwohner', (d.bevoelkerung.wert > 0 ? '+' : d.bevoelkerung.wert < 0 ? '−' : '±') + dez(Math.abs(d.bevoelkerung.wert), 1) + ' %/J', d.bevoelkerung.wort, d.bevoelkerung.ton));
        if (d.leerstand) k.push(kachel('Leerstand', dez(d.leerstand.wert, 1) + ' %', d.leerstand.wort + ' · Zensus', d.leerstand.ton));
        if (d.miete) {
          var art = d.mietspiegel && d.mietspiegel.art;
          var ms = art === 'qualifiziert' ? 'qualif. Mietspiegel' : art === 'einfach' ? 'einf. Mietspiegel' : art ? 'Mietspiegel' : 'Bestandsmiete';
          k.push(kachel('Miete Ø je m²', dez(d.miete.qm, 2) + ' €', ms, null));
        }
        if (!k.length) { setze('dkLageQ', 'Für diese PLZ liegen uns noch keine amtlichen Lagedaten vor – in der App gibt es den vollen Marktbericht.'); return; }
        k.forEach(function (x, i) { x.style.animationDelay = (i * 90) + 'ms'; g.appendChild(x); });
        var mo = d.miete && d.miete.monat && /^\d{4}-\d{2}$/.test(d.miete.monat) ? d.miete.monat.slice(5) + '/' + d.miete.monat.slice(0, 4) : null;
        setze('dkLageQ', 'Amtliche Daten: Regionaldatenbank, Zensus 2022' + (mo ? ' (Miete fortgeschrieben auf ' + mo + ')' : '') + (d.mietspiegel && d.mietspiegel.art ? ', Mietspiegel der Gemeinde' : '') + '.');
      })
      .catch(function () { if (n === lauf) { g.innerHTML = ''; setze('dkLageQ', 'Lage & Markt gerade nicht abrufbar.'); } });
  }

  /* ── Drehen ─────────────────────────────────────────────────────────── */
  function seite(hintenAn) {
    karte.classList.toggle('gedreht', hintenAn);
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
