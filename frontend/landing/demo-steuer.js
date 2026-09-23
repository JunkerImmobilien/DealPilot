/* ═══════════════════════════════════════════════════════════════════════
   demo-steuer.js · v1581 · Vier Fassungen desselben Rechenwegs
   ───────────────────────────────────────────────────────────────────────
   Alle Zahlen kommen aus demo-steuer-daten.js. Hier wird nichts
   gerechnet ausser dem, was der Regler in Fassung B aendert - und der
   ruft dieselben Funktionen auf.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var D = window.DP_STEUER;
  if (!D) return;
  var O = D.O, eur = D.eur, proz = D.proz, zahl = D.zahl;

  var IK = {
    haken: 'M4 12.5l5 5L20 6.5',
    euro: 'M17 5.5A7 7 0 1 0 17 18.5M4 10h8M4 14h8',
    waage: 'M12 4v16M5 7h14M5 7l-3 6h6zM19 7l3 6h-6zM8 20h8',
    lineal: 'M3 8h18v8H3zM7 8v4M11 8v4M15 8v4M19 8v4',
    bank: 'M3 10l9-6 9 6M5 10v9M9.7 10v9M14.3 10v9M19 10v9M3 21h18',
    steig: 'M4 17l5.5-5.5 3.5 3.5L20 8M20 8h-4.5M20 8v4.5',
    frage: 'M9.2 9.2a2.9 2.9 0 1 1 3.6 2.8c-.5.2-.8.7-.8 1.2v.8M12 17.5h.01',
    pfeil: 'M5 12h13M13 6l6 6-6 6'
  };
  function ik(k, gr) {
    return '<svg viewBox="0 0 24 24" width="' + (gr || 15) + '" height="' + (gr || 15)
      + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"'
      + ' stroke-linejoin="round" aria-hidden="true"><path d="' + IK[k] + '"/></svg>';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* ── Die acht Stufen der Kette ───────────────────────────────────── */
  var KETTE = [
    ['Indikation', 'grobe Einordnung'],
    ['Aufteilung', 'Boden / Gebäude'],
    ['Nutzungsdauer', 'Rahmen und Wahl'],
    ['Abschreibung', 'je Jahr'],
    ['Verkehrswert', 'ein Verfahren'],
    ['Finanzierung', 'Marktzins'],
    ['Cashflow', 'vor / nach Steuern'],
    ['Potenzial', 'Annahmen offen']
  ];

  function kopf() {
    return '<div class="gstreif"></div><div class="rahm-kopf">'
      + '<div><b>' + esc(O.adr) + '</b><span>' + esc(O.art) + '</span></div>'
      + '<div class="kp"><b>' + eur(O.kaufpreis) + '</b>'
      + '<span>KAUFPREIS · ' + eur(O.kaufpreis / O.wfl) + '/m²</span></div></div>';
  }
  function rz(lb, wert, klasse, klein) {
    return '<div class="rz ' + (klasse || '') + '"><span class="lb">' + lb
      + (klein ? '<small>' + klein + '</small>' : '') + '</span>'
      + '<span class="wt">' + wert + '</span></div>';
  }
  function stufe(n, titel, tag, tagklasse, body) {
    return '<div class="stufe"><div class="st-kopf">'
      + '<span class="st-nr">' + n + '</span><b>' + titel + '</b>'
      + '<span class="tag ' + tagklasse + '">' + tag + '</span></div>'
      + '<div class="st-body">' + body + '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════════════
     FASSUNG A · DER RECHENWEG
     ══════════════════════════════════════════════════════════════════ */
  function bauA(wirt) {
    var K = D.KPA, R = D.RND, A = D.AFA, E = D.EW, F = D.FIN, C = D.CF;
    wirt.innerHTML = '<div class="rahm">' + kopf()
      /* 1 */
      + stufe(1, 'Marktpreisindikation', 'INDIKATIV', 'ind',
        '<div class="sp"><div class="sp-lbl"><span class="l">GROBE EINORDNUNG '
        + 'VOR DER PRÜFUNG</span><span class="v">' + eur(D.MPI.von) + ' – '
        + eur(D.MPI.bis) + '</span></div>'
        + '<div class="sp-bahn"><span class="sp-grund"></span>'
        + '<span class="sp-band" style="left:18%;width:52%"></span>'
        + '<span class="sp-mark" style="left:63%"></span></div>'
        + '<div class="sp-skala"><span>240.000 €</span><span>280.000 €</span>'
        + '<span>320.000 €</span></div></div>'
        + rz('Kaufpreis liegt in der Spanne', eur(O.kaufpreis), 'summe',
          D.MPI.hinweis + ' · ' + eur(D.MPI.qm_von) + '–' + eur(D.MPI.qm_bis) + '/m²'))
      /* 2 */
      + stufe(2, 'Kaufpreisaufteilung — für den Notarvertrag', 'AMTLICH + RECHNUNG', 'amt',
        rz('Grundstücksanteil', zahl(K.boden_qm, 1) + ' m²', '',
          zahl(O.grundstueck_qm) + ' m² × MEA ' + proz(O.mea, 1))
        + rz('Bodenrichtwert', eur(O.brw) + '/m²', '', 'BORIS · Stichtag 01.01.2026')
        + rz('Bodenwert roh', eur(K.boden_roh))
        + rz('Abschlag ' + K.abschlag_prozent + ' % Sondereigentum', '− ' + eur(K.abschlag_eur),
          'minus', 'Belastung des Grundstücks durch das Gebäude')
        + rz('Bodenwert im Vertrag', eur(K.boden_angesetzt), 'summe',
          proz(K.anteil_boden) + ' vom Kaufpreis')
        + rz('Gebäudeanteil = AfA-Bemessungsgrundlage', eur(K.gebaeude_mit), 'summe gross')
        + '<div class="gewinn">' + ik('haken', 18)
        + '<b>+ ' + eur(K.mehr_bemessung) + '</b>'
        + '<span>mehr Bemessungsgrundlage als ohne den Abschlag — '
        + 'dieser Satz gehört so in den Notarvertrag.</span></div>')
      /* 3 */
      + stufe(3, 'Restnutzungsdauer — ein Rahmen, keine Zahl', 'ABGELEITET', 'ind',
        '<div class="sp"><div class="sp-lbl">'
        + '<span class="l">ANLAGE 2 IMMOWERTV · BJ ' + O.bj + ' · GND ' + O.gnd
        + ' J. · ' + R.modpunkte + ' MOD.-PUNKTE</span>'
        + '<span class="v">' + R.mitte + ' Jahre<small>Rahmen ' + R.von + '–' + R.bis
        + '</small></span></div>'
        + '<div class="sp-bahn"><span class="sp-grund"></span>'
        + spBand(R.von, R.bis) + '<span class="sp-mark" style="left:'
        + spPos(R.mitte) + '%"></span></div>'
        + '<div class="sp-skala"><span>30</span><span>40</span><span>50</span>'
        + '<span>60</span><span>70</span></div></div>'
        + rz('rechnerisch (GND − Alter)', R.rechnerisch + ' Jahre', '',
          O.stichjahr + ' − ' + O.bj + ' = ' + R.alter + ' Jahre Alter'))
      /* 4 */
      + stufe(4, 'Abschreibung je Jahr', 'RECHNUNG', 'rech',
        rz('gesetzlicher Regelfall — 2 %, ohne Abschlag', eur(A.standard.jahr), '',
          '§ 7 Abs. 4 Satz 1 EStG')
        + rz('bei ' + R.mitte + ' Jahren (Mitte des Rahmens)', eur(A.mitte.jahr), '',
          proz(A.mitte.satz, 2) + ' — mit optimierter Aufteilung')
        + rz('bei ' + R.von + ' Jahren (unteres Ende)', eur(A.kurz.jahr), 'plus',
          proz(A.kurz.satz, 2) + ' — § 7 Abs. 4 Satz 2, Nachweis nötig')
        + rz('Mehr-Abschreibung je Jahr', '+ ' + eur(A.mehr_jahr), 'summe plus')
        + '<div class="gewinn">' + ik('euro', 18)
        + '<b>' + eur(A.steuer_jahr) + '</b>'
        + '<span>weniger Steuer je Jahr bei ' + proz(O.steuersatz, 0)
        + ' Grenzsteuersatz — über ' + R.von + ' Jahre sind das '
        + eur(A.steuer_jahr * R.von) + '.</span></div>')
      /* 5 */
      + stufe(5, 'Verkehrswert — ein Verfahren, nicht zwei', 'AMTLICH', 'amt',
        rz('gewählt: ' + E.verfahren, '§ 27 ImmoWertV', '', E.grund)
        + rz('nicht gerechnet: ' + E.verworfen, '—', '', E.verworfen_grund)
        + rz('Jahresrohertrag', eur(E.rohertrag), '',
          eur(O.miete_monat) + '/Monat · ' + eur(O.miete_monat / O.wfl * 1) + '/m²')
        + rz('Bewirtschaftungskosten ' + proz(O.bwk_quote, 0), '− ' + eur(E.bwk), 'minus')
        + rz('Reinertrag', eur(E.reinertrag))
        + rz('Bodenwertverzinsung ' + proz(O.lz), '− ' + eur(E.bodenverzinsung), 'minus',
          'nur der rentierliche Bodenwert, § 41 ImmoWertV')
        + rz('Gebäudereinertrag', eur(E.geb_reinertrag))
        + rz('× Vervielfältiger ' + zahl(E.vf, 2), eur(E.ertragswert_geb), '',
          'Liegenschaftszins ' + proz(O.lz) + ' · ' + R.mitte + ' Jahre')
        + rz('+ Bodenwert', eur(K.boden_angesetzt))
        + rz('Verkehrswert', eur(E.verkehrswert), 'summe gross')
        + rz('Kaufpreis liegt darüber', '+ ' + proz(E.abweichung), '',
          'in dieser Lage vertretbar — der Aufschlag ist der Preis für die Lage'))
      /* 6 */
      + stufe(6, 'Finanzierung mit Marktzins-Indikation', 'INDIKATIV', 'ind',
        rz('Kaufpreis', eur(O.kaufpreis))
        + rz('Erwerbsnebenkosten ' + proz(F.nk_quote), '+ ' + eur(F.nk), '',
          'Grunderwerb ' + proz(O.nk_grunderwerb, 1) + ' · Notar '
          + proz(O.nk_notar, 1) + ' · Makler ' + proz(O.nk_makler, 2))
        + rz('Gesamtaufwand', eur(F.gesamt), 'summe')
        + rz('Eigenkapital ' + proz(O.ek_quote, 0), '− ' + eur(F.ek), 'minus')
        + rz('Darlehen', eur(F.darlehen), 'summe')
        + rz('Zins ' + proz(F.zins, 2) + ' · Tilgung ' + proz(F.tilgung, 0),
          eur(F.rate_monat) + '/Mon.', '',
          'Marktindikation ' + F.zinsbindung + ' Jahre Zinsbindung, kein Angebot')
        + rz('Kapitaldienstdeckung (DSCR)', zahl(F.dscr, 2), 'minus',
          'unter 1,0 — die Miete allein trägt die Rate nicht'))
      /* 7 */
      + stufe(7, 'Cashflow — und was die Optimierung ausmacht', 'RECHNUNG', 'rech',
        rz('vor Steuern', eur(C.ohne.vor_steuer_monat) + '/Mon.', 'minus',
          'Miete − Rate − nicht umlagefähiges Hausgeld')
        + rz('nach Steuern, ohne Optimierung', eur(C.ohne.nach_steuer_monat) + '/Mon.',
          'minus', 'Regel-AfA 2 %, Bodenwert ohne Abschlag')
        + rz('nach Steuern, mit Optimierung', '+ ' + eur(C.mit.nach_steuer_monat) + '/Mon.',
          'summe plus', 'RND ' + R.von + ' Jahre + Bodenabschlag')
        + '<div class="gewinn">' + ik('steig', 18)
        + '<b>+ ' + eur(C.unterschied_monat) + '</b>'
        + '<span>im Monat Unterschied. <b style="color:#fff">Die Optimierung kippt '
        + 'den Deal</b> — ohne sie trägt er sich nicht.</span></div>')
      /* 8 */
      + stufe(8, 'Potenzial und Annahmen — offengelegt', 'ANNAHME', 'rech',
        D.POTENZIAL.map(function (p) {
          return rz((p[3] ? '<b style="color:#fff">' + esc(p[0]) + '</b>' : esc(p[0])),
            esc(p[1]), p[3] ? 'plus' : '', esc(p[2]));
        }).join('')
        + '<div style="height:9px"></div>'
        + D.ANNAHMEN.map(function (a) {
          return rz(esc(a[0]), esc(a[1]), '', esc(a[2]));
        }).join(''))
      + '</div>';
  }
  function spPos(v) { return (v - 30) / 40 * 100; }
  function spBand(a, b) {
    return '<span class="sp-band" style="left:' + spPos(a) + '%;width:'
      + (spPos(b) - spPos(a)) + '%"></span>';
  }

  /* ══════════════════════════════════════════════════════════════════
     FASSUNG B · DER REGLER — die Nutzungsdauer wählen
     ══════════════════════════════════════════════════════════════════ */
  function bauB(wirt) {
    var R = D.RND, K = D.KPA;
    wirt.innerHTML = '<div class="rahm">' + kopf()
      + '<div class="reg">'
      + '<div class="reg-wert"><span class="gr b-rnd">' + R.mitte + '</span>'
      + '<span class="ei">JAHRE RESTNUTZUNGSDAUER</span>'
      + '<span class="hi">Anlage 2 ImmoWertV liefert einen Rahmen. '
      + 'Schieb ihn — alles darunter rechnet mit.</span></div>'
      + '<div class="reg-bahn"><span class="reg-grund"></span>'
      + '<span class="reg-band"></span>'
      + '<input class="reg-in" type="range" min="' + R.von + '" max="' + R.bis
      + '" value="' + R.mitte + '" step="1" aria-label="Restnutzungsdauer in Jahren">'
      + '</div>'
      + '<div class="reg-marken"><b>' + R.von + ' J.</b>'
      + '<span>rechnerisch ' + R.rechnerisch + '</span><b>' + R.bis + ' J.</b></div>'
      + '<div class="reg-folge">'
      + '<div><span class="l">ABSCHREIBUNG JE JAHR</span>'
      + '<span class="v b-afa">–</span>'
      + '<span class="s b-afasatz">–</span></div>'
      + '<div><span class="l">STEUER JE JAHR WENIGER</span>'
      + '<span class="v acht b-steuer">–</span>'
      + '<span class="s">gegenüber dem Regelfall 2 %</span></div>'
      + '<div><span class="l">CASHFLOW NACH STEUERN</span>'
      + '<span class="v b-cf">–</span>'
      + '<span class="s b-cfhin">–</span></div>'
      + '</div>'
      + '<div class="reg-hinweis">' + ik('frage', 14)
      + '<span><b>Der Rahmen ist die Grenze, nicht der Vorschlag.</b> '
      + 'Wer unter ' + R.von + ' Jahre geht, verlässt das Modell — dafür braucht es '
      + 'ein Gutachten nach § 7 Abs. 4 Satz 2 EStG. DealPilot zeigt den Rahmen und '
      + 'lässt die Wahl, statt eine Zahl zu setzen, die niemand belegen kann.</span></div>'
      + '<div style="margin-top:14px">'
      + rz('AfA-Bemessungsgrundlage (Gebäudeanteil)', eur(K.gebaeude_mit), '',
        'Kaufpreis − Bodenwert ' + eur(K.boden_angesetzt) + ' (nach ' + K.abschlag_prozent
        + ' % Abschlag)')
      + '</div></div>'
      + kettenleiste(2)
      + '</div>';

    var inp = wirt.querySelector('.reg-in');
    var band = wirt.querySelector('.reg-band');
    function neu() {
      var j = +inp.value;
      var a = D.afa(K.gebaeude_mit, j);
      var mehr = a.jahr - D.AFA.standard.jahr;
      var steuer = mehr * O.steuersatz;
      var cf = D.cashflow(a.jahr);
      wirt.querySelector('.b-rnd').textContent = j;
      wirt.querySelector('.b-afa').textContent = eur(a.jahr);
      wirt.querySelector('.b-afasatz').textContent = proz(a.satz, 2) + ' je Jahr';
      var st = wirt.querySelector('.b-steuer');
      st.textContent = (steuer >= 0 ? '+ ' : '') + eur(steuer);
      st.className = 'v b-steuer ' + (steuer > 0 ? 'acht' : '');
      var c = wirt.querySelector('.b-cf');
      c.textContent = (cf.nach_steuer_monat >= 0 ? '+ ' : '')
        + eur(cf.nach_steuer_monat) + '/Mon.';
      c.className = 'v b-cf ' + (cf.nach_steuer_monat >= 0 ? 'gut' : '');
      wirt.querySelector('.b-cfhin').textContent = cf.nach_steuer_monat >= 0
        ? 'trägt sich' : 'Zuzahlung nötig';
      var p = (j - R.von) / (R.bis - R.von);
      band.style.left = '0'; band.style.width = (p * 100) + '%';
    }
    inp.addEventListener('input', neu);
    neu();
  }

  function kettenleiste(aktiv) {
    return '<div class="kette">' + KETTE.map(function (k, i) {
      return '<div class="' + (i === aktiv ? 'on' : '') + '"><b>' + esc(k[0]) + '</b>'
        + esc(k[1]) + '</div>';
    }).join('') + '</div>';
  }

  /* ══════════════════════════════════════════════════════════════════
     FASSUNG C · VORHER / NACHHER
     ══════════════════════════════════════════════════════════════════ */
  function bauC(wirt) {
    var K = D.KPA, A = D.AFA, C = D.CF, R = D.RND;
    function seite(klasse, mk, titel, zeilen, ergLb, ergWt) {
      return '<div class="vn-s ' + klasse + '"><div class="vn-k">'
        + '<span class="mk">' + mk + '</span><b>' + titel + '</b></div>'
        + zeilen.map(function (z) { return rz(z[0], z[1], z[2] || '', z[3]); }).join('')
        + '<div class="vn-erg"><span>' + ergLb + '</span><b>' + ergWt + '</b></div></div>';
    }
    wirt.innerHTML = '<div class="rahm">' + kopf()
      + '<div class="vn">'
      + seite('alt', 'OHNE DEALPILOT', 'Standardweg', [
        ['Bodenwert im Vertrag', eur(K.boden_roh), '', 'voller Bodenrichtwert, kein Abschlag'],
        ['AfA-Bemessungsgrundlage', eur(K.gebaeude_ohne), ''],
        ['Nutzungsdauer', '50 Jahre', '', 'gesetzlicher Regelfall, ohne Nachweis'],
        ['Abschreibung je Jahr', eur(A.standard.jahr), '', proz(A.standard.satz, 2)],
        ['Steuerwirkung', eur(C.ohne.steuerwirkung), ''],
        ['Cashflow vor Steuern', eur(C.ohne.vor_steuer_monat) + '/Mon.', 'minus']
      ], 'CASHFLOW NACH STEUERN', eur(C.ohne.nach_steuer_monat) + '/Mon.')
      + '<div class="vn-pfeil">' + ik('pfeil', 22) + '</div>'
      + seite('neu', 'MIT DEALPILOT', 'Optimiert und belegt', [
        ['Bodenwert im Vertrag', eur(K.boden_angesetzt), 'plus',
          'nach ' + K.abschlag_prozent + ' % Abschlag Sondereigentum'],
        ['AfA-Bemessungsgrundlage', eur(K.gebaeude_mit), 'plus',
          '+ ' + eur(K.mehr_bemessung) + ' gegenüber links'],
        ['Nutzungsdauer', R.von + ' Jahre', 'plus',
          'unteres Ende des Rahmens ' + R.von + '–' + R.bis + ', mit Nachweis'],
        ['Abschreibung je Jahr', eur(A.kurz.jahr), 'plus', proz(A.kurz.satz, 2)],
        ['Steuerwirkung', eur(C.mit.steuerwirkung), 'plus'],
        ['Cashflow vor Steuern', eur(C.mit.vor_steuer_monat) + '/Mon.', 'minus',
          'identisch — die Finanzierung ändert sich nicht']
      ], 'CASHFLOW NACH STEUERN', '+ ' + eur(C.mit.nach_steuer_monat) + '/Mon.')
      + '</div>'
      + '<div style="padding:16px 22px 18px;border-top:1px solid var(--line)">'
      + '<div class="gewinn">' + ik('haken', 18)
      + '<b>+ ' + eur(C.unterschied_monat) + '</b>'
      + '<span>im Monat, ' + eur(C.unterschied_monat * 12) + ' im Jahr. '
      + '<b style="color:#fff">Links trägt sich der Deal nicht, rechts schon.</b> '
      + 'Es ist dasselbe Objekt, derselbe Kaufpreis, dieselbe Bank — '
      + 'nur zwei Zahlen sind anders und beide sind belegbar.</span></div></div>'
      + '</div>';
  }

  /* ══════════════════════════════════════════════════════════════════
     FASSUNG D · DAS BLATT
     ══════════════════════════════════════════════════════════════════ */
  function bauD(wirt) {
    var K = D.KPA, R = D.RND, A = D.AFA, E = D.EW, F = D.FIN, C = D.CF;
    function z(l, v, kl) {
      return '<div class="bl-z ' + (kl || '') + '"><span class="l">' + l
        + '</span><span class="v">' + v + '</span></div>';
    }
    function ab(t, q, inhalt) {
      return '<div class="bl-abschnitt"><div class="bl-t"><span>' + t + '</span>'
        + '<span class="q">' + q + '</span></div>' + inhalt + '</div>';
    }
    wirt.innerHTML = '<div class="rahm"><div class="gstreif"></div><div class="bl">'
      + '<div class="bl-kopf"><div><h4>' + esc(O.adr) + '</h4>'
      + '<div class="sub">' + esc(O.art) + '<br>Stichtag 01.01.' + O.stichjahr
      + ' · Kaufpreis ' + eur(O.kaufpreis) + '</div></div>'
      + '<div class="re"><span class="l">VERKEHRSWERT</span>'
      + '<span class="v">' + eur(E.verkehrswert) + '</span></div></div>'
      + '<div class="bl-spalten"><div>'
      + ab('MARKTPREISINDIKATION', 'Vergleichspreise · indikativ',
        z('Spanne', eur(D.MPI.von) + ' – ' + eur(D.MPI.bis))
        + z('je m²', eur(D.MPI.qm_von) + ' – ' + eur(D.MPI.qm_bis)))
      + ab('KAUFPREISAUFTEILUNG', 'BORIS · für den Notarvertrag',
        z('Grundstücksanteil', zahl(K.boden_qm, 1) + ' m²')
        + z('Bodenrichtwert', eur(O.brw) + '/m²')
        + z('Bodenwert roh', eur(K.boden_roh))
        + z('Abschlag ' + K.abschlag_prozent + ' %', '− ' + eur(K.abschlag_eur), 'minus')
        + z('Bodenwert angesetzt', eur(K.boden_angesetzt), 's')
        + z('Gebäudeanteil (AfA-Basis)', eur(K.gebaeude_mit), 's gut'))
      + ab('RESTNUTZUNGSDAUER', 'Anlage 2 ImmoWertV',
        z('rechnerisch', R.rechnerisch + ' Jahre')
        + z('Rahmen', R.von + ' – ' + R.bis + ' Jahre')
        + z('angesetzt', R.von + ' Jahre', 's'))
      + ab('ABSCHREIBUNG', '§ 7 Abs. 4 EStG',
        z('Regelfall 2 %', eur(A.standard.jahr))
        + z('angesetzt ' + proz(A.kurz.satz, 2), eur(A.kurz.jahr))
        + z('Mehr je Jahr', '+ ' + eur(A.mehr_jahr), 's gut')
        + z('Steuer je Jahr weniger', eur(A.steuer_jahr), 'gut'))
      + '</div><div>'
      + ab('ERTRAGSWERTVERFAHREN', '§ 27 ImmoWertV · Sachwert verworfen',
        z('Jahresrohertrag', eur(E.rohertrag))
        + z('Bewirtschaftungskosten', '− ' + eur(E.bwk), 'minus')
        + z('Reinertrag', eur(E.reinertrag))
        + z('Bodenwertverzinsung ' + proz(O.lz), '− ' + eur(E.bodenverzinsung), 'minus')
        + z('Gebäudereinertrag', eur(E.geb_reinertrag))
        + z('Vervielfältiger', zahl(E.vf, 2))
        + z('Verkehrswert', eur(E.verkehrswert), 's'))
      + ab('FINANZIERUNG', 'Marktindikation, kein Angebot',
        z('Gesamtaufwand', eur(F.gesamt))
        + z('Eigenkapital ' + proz(O.ek_quote, 0), eur(F.ek))
        + z('Darlehen', eur(F.darlehen))
        + z('Zins ' + proz(F.zins, 2) + ' / Tilgung ' + proz(F.tilgung, 0),
          eur(F.rate_monat) + '/Mon.')
        + z('Kapitaldienstdeckung', zahl(F.dscr, 2), 'minus'))
      + ab('CASHFLOW', 'nach Steuern, ' + proz(O.steuersatz, 0) + ' Grenzsteuersatz',
        z('vor Steuern', eur(C.ohne.vor_steuer_monat) + '/Mon.', 'minus')
        + z('ohne Optimierung', eur(C.ohne.nach_steuer_monat) + '/Mon.', 'minus')
        + z('mit Optimierung', '+ ' + eur(C.mit.nach_steuer_monat) + '/Mon.', 's gut'))
      + ab('ANNAHMEN', 'jede Prognose offengelegt',
        D.ANNAHMEN.map(function (a) { return z(esc(a[0]), esc(a[1])); }).join(''))
      + '</div></div>'
      + '<div class="bl-fuss"><span class="sig">TRÄGT SICH</span>'
      + '<span>… aber erst nach Steuern und nur mit belegter Nutzungsdauer. '
      + 'Vor Steuern fehlen ' + eur(Math.abs(C.ohne.vor_steuer_monat))
      + ' im Monat. Alle amtlichen Werte mit Quelle im Anhang.</span></div>'
      + '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════════════ */
  var BAUER = { a: bauA, b: bauB, c: bauC, d: bauD };
  [].slice.call(document.querySelectorAll('[data-steuer]')).forEach(function (w) {
    var f = BAUER[w.getAttribute('data-steuer')];
    if (f) f(w);
  });
})();
