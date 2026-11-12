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
  var F = { kp: $('dcKp'), nkm: $('dcNkm'), zins: $('dcZins'), plz: $('dcPlz'), bj: $('dcBj'), wfl: $('dcWfl') };
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
          k.push(kachel('Bestandsmiete Ø', dez(d.miete.qm, 2) + ' €/m²', 'alle laufenden Verträge', null));
        }
        /* landing-dealcheck-6 · Vergleichsmiete (Marcel 12.11.2026 „haben wir auch die Vergleichsmieten?"): Mietspiegel-Mittelwert
           der Gemeinde, wo wir die Werte führen dürfen, sonst DealPilot-Näherung (nie „Mietspiegel" genannt). */
        var vg = d.vergleichsmiete;
        if (vg && vg.qm > 0) k.push(kachel('Vergleichsmiete', dez(vg.qm, 2) + ' €/m²',
          (vg.quelle === 'mietspiegel' ? 'Mietspiegel' + (vg.unten && vg.oben ? ' ' + dez(vg.unten, 2) + ' bis ' + dez(vg.oben, 2) : '') : 'Näherung ±' + dez(vg.abweichung_pct || 7.5, 1).replace(',0', '') + ' %')
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
        setze('dkLageQ', 'Amtliche Daten: Regionaldatenbank, Zensus 2022' + (mo ? ' (Miete fortgeschrieben auf ' + mo + ')' : '') + (d.mietspiegel && d.mietspiegel.art && d.mietspiegel.art !== 'unklar' ? ', ' + (d.mietspiegel.art === 'qualifiziert' ? 'qualifizierter' : d.mietspiegel.art === 'einfach' ? 'einfacher' : '') + ' Mietspiegel der Gemeinde vorhanden' : '') + (d.kappung || d.mietpreisbremse ? ', Landesverordnungen nach § 558 Abs. 3 und § 556d BGB' : '') + (d.einwohner && d.einwohner.ebene === 'kreis' ? '; Einwohner auf Kreisebene' : '') + '.');
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
  var OBEN_TYPISCH = 1.186;
  /* landing-dealcheck-8b · Marcel 12.11.2026: „bitte ohne ; oder – nur mit Punkt und Komma … Mietwucher anders
     ausdrücken". Kurze Sätze, kein Gedankenstrich, kein Semikolon, das Wort Mietwucher fällt weg. */
  function mieteSatz(vg, kp, mb, wfl) {
    if (!vg || !(vg.qm > 0)) return null;
    var nkm = zahl(F.nkm), mitW = wfl && nkm > 0, kpct = kp && kp.pct ? kp.pct : 20;
    var spanne = vg.quelle === 'mietspiegel' && vg.oben > 0, oben = spanne ? vg.oben : vg.qm * OBEN_TYPISCH, ca = spanne ? '' : 'ca. ';
    var eu = function (qm, mitCa) { return '<b>' + (mitCa ? ca : '') + dez(qm, 2) + ' €</b>' + (mitW ? ' (' + dez(Math.round(qm * wfl), 0) + ' € im Monat)' : ''); };
    var t = '<b>Was an Miete möglich ist, je m² nettokalt</b><br>';
    t += '<b>Bestand:</b> bis zur Vergleichsmiete der Wohnung. Im Mittel sind das ' + eu(vg.qm) + ', am oberen Rand ' + eu(oben, true)
      + ', wenn Ausstattung, Lage und Zustand das tragen. Erhöht werden darf um höchstens ' + kpct + ' % in 3 Jahren, frühestens 15 Monate nach der letzten Erhöhung (§ 558 BGB).<br>';
    if (mb && mb.gilt === true) t += '<b>Neuvermietung:</b> hier gilt die Mietpreisbremse. Nach § 556d BGB sind höchstens 110 % der Vergleichsmiete erlaubt, also ' + eu(vg.qm * 1.1)
      + ', am oberen Rand ' + eu(oben * 1.1, true) + '. Ausnahmen gibt es bei höherer Vormiete, Modernisierung in den letzten 3 Jahren und Erstbezug nach dem 01.10.2014.';
    else if (mb && mb.gilt === false) t += '<b>Neuvermietung:</b> hier gilt keine Mietpreisbremse, die Miete ist frei vereinbar. Unbedenklich sind bis zu 120 % der Vergleichsmiete, also ' + eu(vg.qm * 1.2)
      + '. Wer darüber geht und dabei ein knappes Wohnungsangebot ausnutzt, riskiert ein Bußgeld wegen überhöhter Miete (§ 5 WiStG).';
    else t += '<b>Neuvermietung:</b> ob die Mietpreisbremse gilt, bitte prüfen.';
    if (mitW) {
      var ist = nkm / wfl, abw = (ist / vg.qm - 1) * 100;
      t += '<br><b>Deine Miete:</b> ' + dez(ist, 2) + ' € je m²';
      if (abw < -3) {
        var ziel = Math.min(oben, ist * (1 + kpct / 100));
        t += ', das sind ' + dez(Math.abs(abw), 0) + ' % unter dem Mittel. In 3 Jahren sind bis zu <b>' + dez(ziel, 2) + ' €</b> möglich, also ' + dez(Math.round((ziel - ist) * wfl), 0) + ' € mehr im Monat.';
      } else if (abw > 3) {
        t += ', das sind ' + dez(abw, 0) + ' % über dem Mittel. '
          + (ist > oben ? 'Sie liegt auch über dem oberen Rand. Sie darf so bleiben, eine weitere Erhöhung nach § 558 BGB ist aber voraussichtlich ausgeschöpft.'
                        : 'Sie liegt noch in der Spanne. Eine weitere Erhöhung geht nur, wenn Ausstattung und Lage eine Einordnung weiter oben tragen.')
          + ' Modernisierung, Index- oder Staffelmiete sind davon getrennt zu prüfen.';
      } else t += ', das entspricht etwa dem Mittel.';
    }
    t += ' <small>Orientierung, keine Rechtsberatung.';
    if (!spanne) t += ' Die Vergleichsmiete ist eine DealPilot-Näherung (±' + dez(vg.abweichung_pct || 7.5, 1) + ' %). Für eine Mieterhöhung braucht es den Mietspiegel, drei Vergleichswohnungen oder ein Gutachten.';
    return t + '</small>';
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
