/* ═══════════════════════════════════════════════════════════════════════
   demo-ideen.js · v1592 · Die fünf Ideen als laufende Blöcke
   ───────────────────────────────────────────────────────────────────────
   Marcel am 24.09.2026: "die ideen wollte ich grafisch haben."

   Jede Idee rechnet über demo-rechner.js. Was der Besucher zieht oder
   umschaltet, geht durch dieselbe Kette wie die große Demo — es gibt
   keine zweite Rechnung und keine hinterlegten Ergebnisse.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var S = window.DP_STEUER, R = window.DP_RECHNER;
  if (!S || !R) return;
  var eur = S.eur, proz = S.proz, zahl = S.zahl;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function ik(d, gr) {
    return '<svg viewBox="0 0 24 24" width="' + (gr || 15) + '" height="' + (gr || 15)
      + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"'
      + ' stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  var P = {
    lupe: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4',
    pfeil: 'M5 12h13M13 6l6 6-6 6',
    haken: 'M4 12.5l5 5L20 6.5',
    kreuz: 'M6 6l12 12M18 6L6 18'
  };

  function kopf(adr, art, rechts) {
    return '<div class="bstreif"></div><div class="bkopf">'
      + '<div><span class="adr">' + esc(adr) + '</span>'
      + '<span class="art">' + esc(art) + '</span></div>'
      + (rechts ? '<div class="re">' + rechts + '</div>' : '') + '</div>';
  }

  /* ══════════════════════════════════════════════════════════════════
     IDEE 1 · Der Kaufpreis wird verhandelbar
     ══════════════════════════════════════════════════════════════════ */
  function idee1(wirt) {
    var VON = 259000, BIS = 319000, START = S.O.kaufpreis;
    wirt.innerHTML = '<div class="buehne">'
      + kopf(S.O.adr, S.O.art, '')
      + '<div class="binhalt">'
      + '<div class="kp-wert"><span class="gr i1-kp">–</span>'
      + '<span class="ei">KAUFPREIS</span>'
      + '<span class="diff i1-diff">–</span></div>'
      + '<div class="kp-bahn"><span class="kp-grund"></span>'
      + '<span class="kp-band i1-band"></span>'
      + '<input class="kp-in i1-in" type="range" min="' + VON + '" max="' + BIS
      + '" step="1000" value="' + START + '" aria-label="Kaufpreis"></div>'
      + '<div class="kp-marken"><b>' + eur(VON) + '</b>'
      + '<span>gefordert ' + eur(START) + '</span><b>' + eur(BIS) + '</b></div>'
      + '<div class="kp-folge">'
      + kachel('DEAL SCORE', 'i1-score', 'i1-stufe')
      + kachel('AfA JE JAHR', 'i1-afa', 'i1-afasub')
      + kachel('RATE', 'i1-rate', 'i1-ratesub')
      + kachel('CASHFLOW n. St.', 'i1-cf', 'i1-cfsub')
      + kachel('VERMÖGEN n. 10 J.', 'i1-verm', 'i1-vermsub')
      + '</div></div></div>';

    var inp = wirt.querySelector('.i1-in'), band = wirt.querySelector('.i1-band');
    function neu() {
      var kp = +inp.value;
      var r = R.rechne({ kaufpreis: kp, rnd: S.RND.von });
      var sc = R.score(r);
      band.style.width = ((kp - VON) / (BIS - VON) * 100) + '%';
      setz(wirt, '.i1-kp', eur(kp));
      var d = kp - START;
      var dn = wirt.querySelector('.i1-diff');
      dn.textContent = d === 0 ? 'wie gefordert' : (d > 0 ? '+' : '') + eur(d);
      dn.className = 'diff i1-diff ' + (d > 0 ? 'schlecht' : d < 0 ? 'gut' : '');
      setz(wirt, '.i1-score', sc.punkte, sc.punkte >= 50 ? 'acht' : 'schlecht');
      setz(wirt, '.i1-stufe', R.stufe(sc.punkte));
      setz(wirt, '.i1-afa', eur(r.afa));
      setz(wirt, '.i1-afasub', eur(r.steuer_jahr) + ' Steuer weniger');
      setz(wirt, '.i1-rate', eur(r.rate_monat));
      setz(wirt, '.i1-ratesub', 'DSCR ' + zahl(r.dscr, 2));
      setz(wirt, '.i1-cf', (r.cf_nach_monat >= 0 ? '+' : '') + eur(r.cf_nach_monat),
        r.cf_nach_monat >= 0 ? 'gut' : 'schlecht');
      setz(wirt, '.i1-cfsub', r.traegt ? 'trägt sich' : 'Zuzahlung nötig');
      setz(wirt, '.i1-verm', eur(r.zuwachs), r.zuwachs > 0 ? 'gut' : 'schlecht');
      setz(wirt, '.i1-vermsub', 'über ' + eur(r.ek) + ' Eigenkapital');
    }
    inp.addEventListener('input', neu);
    neu();
  }
  function kachel(l, kv, ks) {
    return '<div><span class="l">' + l + '</span>'
      + '<span class="v ' + kv + '">–</span>'
      + '<span class="s ' + ks + '">–</span></div>';
  }
  function setz(w, sel, txt, kl) {
    var e = w.querySelector(sel); if (!e) return;
    e.textContent = txt;
    if (kl !== undefined) {
      e.className = e.className.replace(/\s*(gut|schlecht|acht)\b/g, '')
        + (kl ? ' ' + kl : '');
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     IDEE 2 · Die Quelle hinter jeder Zahl
     ══════════════════════════════════════════════════════════════════ */
  var QUELLEN = [
    ['Bodenrichtwert', eur(S.O.brw) + '/m²', {
      'Herausgeber': 'Gutachterausschuss für Grundstückswerte Musterstadt',
      'Datensatz': 'BORIS Niedersachsen · Bodenrichtwertzone 32105-04',
      'Stichtag': '01.01.2026',
      'Lizenz': 'dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0)',
      'Abgerufen': '23.09.2026',
      'Namensnennung': '© GAG Musterstadt 2026, dl-de/by-2-0'
    }],
    ['Liegenschaftszins', proz(S.O.lz), {
      'Herausgeber': 'Gutachterausschuss für Grundstückswerte Musterstadt',
      'Fundstelle': 'Grundstücksmarktbericht 2025, Abschnitt 8.1.1, Seite 48',
      'Teilmarkt': 'Eigentumswohnungen, Baujahr 1970–2000',
      'Stichprobe': '412 Kauffälle',
      'Lizenz': 'dl-de/by-2-0',
      'Namensnennung': '© GAG Musterstadt 2025, dl-de/by-2-0'
    }],
    ['Restnutzungsdauer', S.RND.von + ' Jahre', {
      'Grundlage': 'Anlage 2 ImmoWertV 2021',
      'Rechenweg': 'GND 80 J. − Alter ' + (S.O.stichjahr - S.O.bj)
        + ' J. = ' + S.RND.rechnerisch + ' J., Rahmen ' + S.RND.von + '–' + S.RND.bis,
      'Modernisierung': S.RND.modpunkte + ' Punkte (Fenster, Heizung, Bäder)',
      'Nachweis': '§ 7 Abs. 4 Satz 2 EStG — Gutachten erforderlich',
      'Art': 'abgeleitet, nicht amtlich erhoben'
    }]
  ];
  function idee2(wirt) {
    wirt.innerHTML = '<div class="buehne">'
      + kopf('Woher jede Zahl kommt', 'Klick auf eine Zeile', '')
      + '<div class="binhalt"><div class="q-liste">'
      + QUELLEN.map(function (q, i) {
          return '<div class="q-z" data-q="' + i + '">'
            + '<span class="nm">' + esc(q[0]) + '</span>'
            + '<span class="wt">' + esc(q[1]) + '</span>'
            + '<span class="lupe">' + ik(P.lupe, 15) + '</span></div>';
        }).join('') + '</div>'
      + '<div class="q-kasten"></div></div></div>';

    var kasten = wirt.querySelector('.q-kasten');
    wirt.addEventListener('click', function (ev) {
      var z = ev.target.closest('[data-q]'); if (!z) return;
      var q = QUELLEN[+z.getAttribute('data-q')];
      if (kasten.getAttribute('data-auf') === z.getAttribute('data-q')) {
        kasten.classList.remove('auf'); kasten.removeAttribute('data-auf'); return;
      }
      kasten.setAttribute('data-auf', z.getAttribute('data-q'));
      kasten.innerHTML = '<h4>' + esc(q[0]) + ' · ' + esc(q[1]) + '</h4>'
        + Object.keys(q[2]).map(function (k) {
            return '<div class="q-r"><span class="k">' + esc(k) + '</span>'
              + '<span class="v">' + esc(q[2][k]) + '</span></div>';
          }).join('');
      kasten.classList.add('auf');
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     IDEE 3 · Ein zweites Objekt, das absagt
     ══════════════════════════════════════════════════════════════════ */
  function idee3(wirt) {
    var OBJ = [
      ['Lindenallee 14', { rnd: S.RND.von }, S.O.adr, S.O.art],
      ['Ahornweg 3', R.AHORN, R.AHORN.adr, R.AHORN.art]
    ];
    wirt.innerHTML = '<div class="buehne">'
      + '<div class="bstreif"></div>'
      + '<div class="bkopf"><div><span class="adr i3-adr">–</span>'
      + '<span class="art i3-art">–</span></div></div>'
      + '<div class="binhalt">'
      + '<div class="o-wahl">' + OBJ.map(function (o, i) {
          return '<button data-o="' + i + '">' + esc(o[0]) + '</button>';
        }).join('') + '</div>'
      + '<div class="o-erg"><div class="o-siegel i3-siegel"><div>'
      + '<span class="tx i3-urteil">–</span>'
      + '<span class="ut i3-ut">–</span></div></div>'
      + '<div class="o-zeilen i3-zeilen"></div></div></div></div>';

    function zeige(i) {
      var o = OBJ[i], r = R.rechne(o[1]), sc = R.score(r);
      [].forEach.call(wirt.querySelectorAll('[data-o]'), function (b, k) {
        b.className = k === i ? 'an' : '';
      });
      setz(wirt, '.i3-adr', o[2]); setz(wirt, '.i3-art', o[3]);
      var sieg = wirt.querySelector('.i3-siegel');
      sieg.className = 'o-siegel i3-siegel ' + (r.traegt ? 'ja' : 'nein');
      setz(wirt, '.i3-urteil', r.traegt ? 'TRÄGT SICH' : 'TRÄGT NICHT');
      setz(wirt, '.i3-ut', 'SCORE ' + sc.punkte + ' · ' + R.stufe(sc.punkte).toUpperCase());
      wirt.querySelector('.i3-zeilen').innerHTML = [
        ['Kaufpreis', eur(r.eingabe.kaufpreis), ''],
        ['Bruttomietrendite', proz(r.rohertrag / r.eingabe.kaufpreis),
          r.rohertrag / r.eingabe.kaufpreis >= 0.045 ? 'gut' : 'schlecht'],
        ['Kapitaldienstdeckung', zahl(r.dscr, 2), r.dscr >= 1 ? 'gut' : 'schlecht'],
        ['Restnutzungsdauer', r.rnd + ' Jahre', r.rnd >= 40 ? 'gut' : 'schlecht'],
        ['Cashflow nach Steuern', (r.cf_nach_monat >= 0 ? '+' : '') + eur(r.cf_nach_monat) + '/Mon.',
          r.cf_nach_monat >= 0 ? 'gut' : 'schlecht'],
        ['Vermögen nach 10 Jahren', eur(r.zuwachs), r.zuwachs > 0 ? 'gut' : 'schlecht']
      ].map(function (z) {
        return '<div class="o-z"><span class="k">' + esc(z[0]) + '</span>'
          + '<span class="v ' + z[2] + '">' + esc(z[1]) + '</span></div>';
      }).join('');
    }
    wirt.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-o]'); if (b) zeige(+b.getAttribute('data-o'));
    });
    zeige(0);
  }

  /* ══════════════════════════════════════════════════════════════════
     IDEE 4 · Was dieselbe Arbeit sonst kostet
     ══════════════════════════════════════════════════════════════════ */
  function idee4(wirt) {
    var ALT = [
      ['Gutachten Restnutzungsdauer', 1150, 'Sachverständiger, § 7 Abs. 4 S. 2 EStG'],
      ['Kaufpreisaufteilung (Steuerberater)', 450, 'BMF-Anlage, einmalig'],
      ['Grundstücksmarktbericht', 62, 'gemessen: Bremen 50 €, Saarland 75 €'],
      ['Investment-Case für die Bank', 0, 'Eigenleistung — ein Abend']
    ];
    var summeAlt = ALT.reduce(function (s, z) { return s + z[1]; }, 0);
    var PRO = 49.99 * 12;
    wirt.innerHTML = '<div class="buehne">'
      + kopf('Was dasselbe sonst kostet', 'für dieses eine Objekt', '')
      + '<div class="binhalt"><div class="k-grid">'
      + '<div class="k-s alt"><span class="l">EINZELN BEAUFTRAGT</span>'
      + ALT.map(function (z) {
          return '<div class="k-p"><span>' + esc(z[0]) + '<br>'
            + '<span style="font-size:10.5px;opacity:.7">' + esc(z[2]) + '</span></span>'
            + '<b>' + (z[1] ? eur(z[1]) : '—') + '</b></div>';
        }).join('')
      + '<div class="k-sum"><span>EINMALIG</span><b>' + eur(summeAlt) + '</b></div></div>'
      + '<div class="k-pfeil">' + ik(P.pfeil, 20) + '</div>'
      + '<div class="k-s neu"><span class="l">MIT DEALPILOT PRO</span>'
      + '<div class="k-p"><span>Restnutzungsdauer nach Anlage 2<br>'
      + '<span style="font-size:10.5px;opacity:.7">mit Rahmen und Modernisierungspunkten</span></span>'
      + '<b>enthalten</b></div>'
      + '<div class="k-p"><span>Kaufpreisaufteilung + BMF-Anlage<br>'
      + '<span style="font-size:10.5px;opacity:.7">fertig für den Notarvertrag</span></span>'
      + '<b>enthalten</b></div>'
      + '<div class="k-p"><span>Amtliche Werte aus dem Register<br>'
      + '<span style="font-size:10.5px;opacity:.7">mit Quellennachweis und Lizenz</span></span>'
      + '<b>enthalten</b></div>'
      + '<div class="k-p"><span>Investment-Case, 6 Seiten<br>'
      + '<span style="font-size:10.5px;opacity:.7">bankfertig, ein Klick</span></span>'
      + '<b>enthalten</b></div>'
      + '<div class="k-sum"><span>EIN JAHR PRO</span><b>' + eur(PRO) + '</b></div></div>'
      + '</div>'
      + '<p class="k-note"><b style="color:var(--gdh)">Achtung, das ist der heikelste '
      + 'Block:</b> Fremde Preise dürfen nur da stehen, wenn sie belegt sind. '
      + 'Die 50 € für Bremen und 75 € für das Saarland haben wir selbst gemessen; '
      + 'Gutachten und Steuerberater sind Spannen aus dem Markt und müssen vor dem '
      + 'Livegang mit Quelle hinterlegt oder gestrichen werden.</p>'
      + '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════════════
     IDEE 5 · Die Zeitleiste zum Zurückspringen
     ══════════════════════════════════════════════════════════════════ */
  function idee5(wirt) {
    var r = R.rechne({ rnd: S.RND.von }), sc = R.score(r);
    var ST = [
      ['Erfassen', 'Einmal sprechen', 'Vierzehn Felder aus einem gesprochenen Satz — '
        + 'oder Frage für Frage geführt.', '0:32', 'LAUFZEIT'],
      ['Indikation', 'Liegt der Preis im Rahmen?', 'Vergleichspreise sagen '
        + eur(S.MPI.von) + ' bis ' + eur(S.MPI.bis) + '. Gefordert sind '
        + eur(S.O.kaufpreis) + '.', 'oberes Drittel', 'EINORDNUNG'],
      ['Aufteilung', 'Was in den Notarvertrag gehört', '20 % Abschlag auf den '
        + 'Bodenwert — begründbar, nicht geschätzt.', '+' + eur(r.mehr_bemessung),
        'MEHR BEMESSUNG'],
      ['Nutzungsdauer', 'Ein Rahmen, keine Zahl', 'Anlage 2 liefert '
        + S.RND.von + '–' + S.RND.bis + ' Jahre. Angesetzt: ' + S.RND.von + '.',
        S.RND.von + ' Jahre', 'ANGESETZT'],
      ['Abschreibung', 'Was die Wahl je Jahr bringt', 'Gegenüber dem Regelfall von '
        + '2 % auf den vollen Bodenwert.', eur(r.steuer_jahr), 'STEUER WENIGER'],
      ['Verkehrswert', 'Ein Verfahren, begründet', 'Ertragswert nach § 27 ImmoWertV — '
        + 'der Sachwert passt hier nicht.', eur(r.verkehrswert), 'ERTRAGSWERT'],
      ['Finanzierung', 'Mit Marktzins', proz(S.O.zins, 2) + ' auf zehn Jahre, '
        + '30 % Eigenkapital.', eur(r.rate_monat) + '/Mon.', 'RATE'],
      ['Entscheidung', 'Trägt sich — knapp', 'Vor Steuern fehlen '
        + eur(Math.abs(r.cf_vor_monat)) + '. Erst die Optimierung dreht es.',
        '+' + eur(r.cf_nach_monat) + '/Mon.', 'NACH STEUERN']
    ];
    wirt.innerHTML = '<div class="buehne">'
      + kopf(S.O.adr, 'Klick auf eine Stufe — der Stand von damals kommt zurück', '')
      + '<div class="binhalt">'
      + '<div class="z-leiste">' + ST.map(function (s, i) {
          return '<div class="z-s" data-z="' + i + '">'
            + '<span class="n">' + (i + 1) + '</span>'
            + '<span class="t">' + esc(s[0]) + '</span></div>';
        }).join('') + '</div>'
      + '<div class="z-inhalt"></div></div></div>';

    function zeige(i) {
      [].forEach.call(wirt.querySelectorAll('[data-z]'), function (e, k) {
        e.className = 'z-s' + (k < i ? ' da' : k === i ? ' an' : '');
      });
      var s = ST[i];
      wirt.querySelector('.z-inhalt').innerHTML =
        '<h4>' + esc(s[1]) + '</h4><p>' + esc(s[2]) + '</p>'
        + '<span class="z-w"><b>' + esc(s[3]) + '</b><span>' + esc(s[4]) + '</span></span>';
    }
    wirt.addEventListener('click', function (ev) {
      var e = ev.target.closest('[data-z]'); if (e) zeige(+e.getAttribute('data-z'));
    });
    zeige(0);
  }

  /* ══════════════════════════════════════════════════════════════════ */
  var BAU = { i1: idee1, i2: idee2, i3: idee3, i4: idee4, i5: idee5 };
  [].forEach.call(document.querySelectorAll('[data-idee]'), function (w) {
    var f = BAU[w.getAttribute('data-idee')];
    if (f) f(w);
  });
})();
