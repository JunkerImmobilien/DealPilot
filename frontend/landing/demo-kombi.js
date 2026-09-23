/* ═══════════════════════════════════════════════════════════════════════
   demo-kombi.js · v1574 · Ein Szenario, vier Stationen, drei Fassungen
   ───────────────────────────────────────────────────────────────────────
   Das Beispielobjekt ist erfunden: Lindenallee 14. Eine echte Anschrift
   stand hier bis v1569 und musste raus - eine Seite, die ein fremdes
   Haus durchrechnet, nennt Zahlen zu einem Eigentuemer, der nicht
   gefragt wurde.

   Die Zahlen sind trotzdem in sich stimmig gerechnet, nicht gewuerfelt:
   Baujahr 1994, Gesamtnutzungsdauer 80 Jahre, Stichtag 2026 - daraus
   folgen 32 Jahre Alter und eine einfache Restnutzungsdauer von 48
   Jahren. Die Modernisierungspunkte heben sie auf 51, im Rahmen 44-56.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var IKON = {
    mikro: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
    score: 'M12 3l9 9-9 9-9-9z M12 8.5l3.5 3.5L12 15.5 8.5 12z',
    waage: 'M12 4v16M5 7h14M5 7l-3 6h6zM19 7l3 6h-6zM8 20h8',
    stapel: 'M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4',
    blatt: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
    haus: 'M3 11l9-7 9 7M5 9.5V21h14V9.5M10 21v-6h4v6',
    lineal: 'M3 8h18v8H3zM7 8v4M11 8v4M15 8v4M19 8v4'
  };
  function ik(k, gr) {
    return '<svg viewBox="0 0 24 24" width="' + (gr || 15) + '" height="' + (gr || 15)
      + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"'
      + ' stroke-linejoin="round" aria-hidden="true"><path d="' + IKON[k] + '"/></svg>';
  }

  /* ── Das Beispielobjekt ──────────────────────────────────────────── */
  var OBJ = {
    adr: 'Lindenallee 14, 32105 Musterstadt',
    art: 'Eigentumswohnung · 3 Zimmer · 82 m² · Baujahr 1994 · 2. OG mit Balkon',
    kp: '289.000 €', score: 76, stufe: 'Gut'
  };

  /* Wie weit die Uhr am ENDE jeder Station steht, in Sekunden. */
  var UHR = [32, 44, 51, 238];

  var BARS = [['Rendite', 35, 72], ['Finanzierung', 25, 86], ['Risiko', 20, 79],
    ['Lage & Markt', 10, 71], ['Upside', 10, 63]];

  /* Was gesprochen wird - Wort fuer Wort getippt. */
  var SATZ = 'Lindenallee vierzehn, Dreikommafünf Zimmer, zweiundachtzig '
    + 'Quadratmeter, Baujahr vierundneunzig, Kaufpreis zweihundertneunund'
    + 'achtzigtausend, Kaltmiete achthundertvierzig, Hausgeld zweihundertzehn.';

  var CHIPS = [['Kaufpreis', '289.000 €'], ['Wohnfläche', '82 m²'],
    ['Baujahr', '1994'], ['Kaltmiete', '840 €'], ['Hausgeld', '210 €'],
    ['Zimmer', '3,5']];

  /* ── Die vier Stationen ──────────────────────────────────────────── */
  var ST = [
    {
      sym: 'mikro', t: 'Erfassen', schritt: '30 Sekunden',
      kopf: 'Einmal sprechen. Mehr nicht.',
      satz: 'Der Sprechlauf hört mit und trägt ein. Was er nicht versteht, '
        + 'fragt er nach — und was im Exposé-PDF steht, liest er ohnehin selbst.',
      ohne: '40 Felder aus vier Unterlagen abtippen', ohneZt: '45 min', mitZt: '0:32'
    },
    {
      sym: 'score', t: 'Rechnen', schritt: '12 Sekunden',
      kopf: '24 Kennzahlen werden eine Zahl.',
      satz: 'Rendite, Finanzierung, Risiko, Lage und Upside einzeln bewertet, '
        + 'dann gewichtet verdichtet. Sechs Profile — wer auf Cashflow schaut, '
        + 'bekommt eine andere Gewichtung als wer auf Sicherheit schaut.',
      ohne: 'Excel bauen, Formeln prüfen, hoffen', ohneZt: '2 Std', mitZt: '0:44'
    },
    {
      sym: 'waage', t: 'Belegen', schritt: '7 Sekunden',
      kopf: 'Eine Spanne, kein Bauchgefühl.',
      satz: 'Anlage 2 ImmoWertV liefert keinen Punkt, sondern einen Rahmen. '
        + 'DealPilot zeigt ihn — und setzt den Wert sichtbar hinein, statt eine '
        + 'Genauigkeit zu behaupten, die das Modell nicht hergibt.',
      ohne: 'Gutachterausschuss anschreiben, warten', ohneZt: '3 Tage', mitZt: '0:51'
    },
    {
      sym: 'stapel', t: 'Ausgeben', schritt: 'ein Klick',
      kopf: 'Achtzehn Seiten, bankfähig.',
      satz: 'Investment-Case für die Bank, BMF-Anlage fürs Finanzamt, '
        + 'Marktbericht mit Quellennachweis. Auf Wunsch im eigenen Logo.',
      ohne: 'Bericht layouten, bevor die Bank hinsieht', ohneZt: '55 min', mitZt: '3:58'
    }
  ];

  var N = ST.length;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* ══════════════════════════════════════════════════════════════════
     Die vier Szenen. Jede gibt {links, rechts} zurueck.
     ══════════════════════════════════════════════════════════════════ */
  function szene(i) {
    var d = ST[i];
    var kopf = '<h3>' + esc(d.kopf) + '</h3><p>' + d.satz + '</p>';

    /* ── 1 · SPRECHEN ────────────────────────────────────────────── */
    if (i === 0) {
      var w = '';
      for (var b = 0; b < 22; b++) w += '<i style="--n:' + b + '"></i>';
      return {
        links: kopf
          + '<div class="kb-mik"><div class="kb-mik-k">'
          + '<span class="kb-ring"></span><span class="kb-ring"></span>'
          + '<span class="kb-ring"></span>' + ik('mikro', 24) + '</div>'
          + '<div class="kb-welle">' + w + '</div></div>'
          + '<div class="kb-mitschrift"><span class="kb-tipp"></span>'
          + '<span class="cur"></span></div>'
          + '<div class="kb-chips"></div>',
        rechts: kartenRahmen('AUFNAHME LÄUFT',
          '<div class="kb-k-lbl">Erkannte Felder</div>'
          + '<div class="kb-k-gross kb-zahl" data-ziel="14 / 14">&nbsp;</div>'
          + '<div class="kb-k-sub">aus Sprache und Exposé-PDF<br>'
          + 'nichts davon wurde getippt</div>'
          + '<div class="kb-k-zeilen">' + CHIPS.slice(0, 4).map(function (c, n) {
            return zeile(c[0], c[1], n);
          }).join('') + '</div>')
      };
    }

    /* ── 2 · RECHNEN ─────────────────────────────────────────────── */
    if (i === 1) {
      return {
        links: kopf + '<div class="kb-belege">'
          + [['score', 'Deal Score 76 · Gut', 'Finanzierung trägt den Deal, Rendite ist die Schwachstelle'],
          ['waage', 'DSCR 1,27', 'Kapitaldienst gedeckt — auch im Stresstest bei 5,5 %'],
          ['haus', 'Cashflow +138 € im Monat', 'nach Steuern, nach Rücklage, ab dem ersten Jahr']]
            .map(function (e, n) { return beleg(e, n); }).join('') + '</div>',
        rechts: kartenRahmen('INVESTOR DEAL SCORE',
          '<div class="kb-dial"><svg viewBox="0 0 120 120" aria-hidden="true">'
          + '<circle class="tr" cx="60" cy="60" r="53"></circle>'
          + '<circle class="pg" cx="60" cy="60" r="53"></circle></svg>'
          + '<div class="kb-dv"><b class="kb-score">0</b><small>/ 100</small></div></div>'
          + '<div class="kb-stufe">◆ ' + OBJ.stufe.toUpperCase() + '</div>'
          + '<div class="kb-bars">' + BARS.map(function (z, n) {
            var f = z[2] >= 85 ? '#2E8455' : z[2] >= 70 ? '#3FA56C' : '#C9A84C';
            return '<div class="kb-bar"><div class="top">'
              + '<span class="nm">' + z[0] + '<span class="wt">' + z[1] + '%</span></span>'
              + '<span class="sc" style="color:' + f + '">' + z[2] + '</span></div>'
              + '<span class="track"><i style="--b:' + z[2] + '%;--n:' + n
              + ';background:' + f + '"></i></span></div>';
          }).join('') + '</div>')
      };
    }

    /* ── 3 · BELEGEN: die Restnutzungsdauer als SPANNE ───────────── */
    if (i === 2) {
      return {
        links: kopf
          + '<div class="kb-spanne"><div class="kb-sp-kopf">'
          + '<span class="lb">RESTNUTZUNGSDAUER · ANLAGE 2 IMMOWERTV</span>'
          + '<span class="wt"><span class="kb-rnd">0</span> Jahre<small>im Rahmen 44–56</small></span>'
          + '</div><div class="kb-sp-bahn"><span class="kb-sp-grund"></span>'
          + '<span class="kb-sp-band"></span><span class="kb-sp-mark"></span></div>'
          + '<div class="kb-sp-skala"><span>30</span><span>40</span><span>50</span>'
          + '<span>60</span><span>70</span></div>'
          + '<div class="kb-sp-note">' + ik('lineal', 13)
          + '<span>Baujahr 1994 · GND 80 Jahre · 9 Modernisierungspunkte '
          + '→ 51 statt 48 Jahre</span></div></div>'
          + '<div class="kb-belege">'
          + [['waage', 'Liegenschaftszins 3,4 %', 'Gutachterausschuss Musterstadt · GMB 2025, S. 48'],
          ['haus', 'Bodenrichtwert 340 €/m²', 'BORIS · Stichtag 01.01.2026 · dl-de/by-2-0']]
            .map(function (e, n) { return beleg(e, n); }).join('') + '</div>',
        rechts: kartenRahmen('QUELLENNACHWEIS',
          '<div class="kb-k-lbl">Amtlich belegt</div>'
          + '<div class="kb-k-gross kb-zahl" data-ziel="21 / 24">&nbsp;</div>'
          + '<div class="kb-k-sub">Kennzahlen mit benannter Herkunft —<br>'
          + 'Ausschuss, Jahrgang, Seite, Lizenz</div>'
          + '<div class="kb-k-zeilen">'
          + zeile('Restnutzungsdauer', '51 J.', 0)
          + zeile('Liegenschaftszins', '3,4 %', 1)
          + zeile('Bodenrichtwert', '340 €/m²', 2)
          + zeile('Sachwertfaktor', '1,08', 3) + '</div>')
      };
    }

    /* ── 4 · AUSGEBEN ────────────────────────────────────────────── */
    return {
      links: kopf + '<div class="kb-pdfs">'
        + [['Investment-Case', 'Kennzahlen, Cashflow, Stresstest, Score', '6 Seiten'],
        ['BMF-Anlage', 'Kaufpreisaufteilung fürs Finanzamt', '4 Seiten'],
        ['Marktbericht', 'mit Quellennachweis und Lizenz', '8 Seiten']]
          .map(function (p, n) {
            return '<div class="kb-pdf" style="--n:' + n + '">'
              + '<span class="ik">' + ik('blatt', 17) + '</span>'
              + '<span><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></span>'
              + '<span class="s">' + esc(p[2]) + '</span></div>';
          }).join('') + '</div>',
      rechts: kartenRahmen('AUSGABE BEREIT',
        '<div class="kb-k-lbl">Erzeugt</div>'
        + '<div class="kb-k-gross kb-zahl" data-ziel="18">&nbsp;</div>'
        + '<div class="kb-k-sub">Seiten in drei Dokumenten,<br>'
        + 'fertig für Bank und Finanzamt</div>'
        + '<div class="kb-k-zeilen">'
        + zeile('Rechenzeit', '2,1 s', 0)
        + zeile('Eigenes Logo', 'möglich', 1)
        + zeile('Quellennachweis', 'enthalten', 2)
        + zeile('Gesamtdauer', '3:58 min', 3) + '</div>')
    };
  }

  function zeile(k, v, n) {
    return '<div class="kb-k-z" style="opacity:0;animation:kbRein .45s var(--e-hoch) '
      + (0.3 + n * 0.12) + 's forwards"><span>' + esc(k) + '</span>'
      + '<b class="kb-zahl" data-ziel="' + esc(v) + '">&nbsp;</b></div>';
  }
  function beleg(e, n) {
    return '<div class="kb-bel" style="--n:' + n + '">'
      + '<span class="ik">' + ik(e[0], 14) + '</span>'
      + '<span><b>' + esc(e[1]) + '</b><span>' + esc(e[2]) + '</span></span></div>';
  }
  function kartenRahmen(band, inhalt) {
    return '<div class="kb-karte"><div class="kb-k-band"><span>' + band + '</span>'
      + '<span>LINDENALLEE 14</span></div>'
      + '<div class="kb-k-body">' + inhalt + '</div>'
      + '<div class="kb-tear"></div>'
      + '<div class="kb-foot"><span>PASSENGER<b>DealPilot Co-Pilot</b></span>'
      + '<span style="text-align:right">FLIGHT<b>DP · BOARDING</b></span></div></div>';
  }

  /* ── Zahlen hochlaufen ───────────────────────────────────────────
     Das Ausgabeformat wird aus dem Ziel ABGELESEN, nicht erfunden:
     "1994" darf keinen Tausenderpunkt bekommen, "1,27" keine
     abgeschnittene Nachkommastelle. (CLAUDE.md) */
  function hoch(node, ziel, ms) {
    var m = String(ziel).match(/[\d.,]+/);
    if (!m) { node.innerHTML = ziel; return; }
    var roh = m[0];
    var kk = roh.indexOf(',') >= 0 ? roh.length - roh.indexOf(',') - 1 : 0;
    var tp = roh.indexOf('.') >= 0;
    var z = parseFloat(roh.replace(/\./g, '').replace(',', '.'));
    if (!isFinite(z)) { node.innerHTML = ziel; return; }
    var t0 = performance.now();
    (function s(t) {
      var p = Math.min(1, (t - t0) / (ms || 850));
      var v = z * (1 - Math.pow(1 - p, 3));
      var txt = v.toFixed(kk).replace('.', ',');
      if (tp) txt = txt.replace(/\B(?=(\d{3})+(?!\d))/, '.');
      node.innerHTML = String(ziel).replace(roh, txt);
      if (p < 1) requestAnimationFrame(s);
    })(t0);
  }

  /* ══════════════════════════════════════════════════════════════════
     Antrieb
     ══════════════════════════════════════════════════════════════════ */
  var wirt = document.querySelector('[data-kombi]');
  if (!wirt) return;

  wirt.innerHTML = '<div class="kb">'
    + '<div class="kb-kopf">'
    + '<div class="kb-obj"><b>' + esc(OBJ.adr) + '</b><span>' + esc(OBJ.art) + '</span></div>'
    + '<div class="kb-uhr"><div class="kb-uhr-t"><b class="kb-zeit">0:00</b>'
    + '<span><span class="kb-tick"></span>LAUFZEIT</span></div>'
    + '<div class="kb-uhr-ring"><svg viewBox="0 0 48 48" aria-hidden="true">'
    + '<circle class="tr" cx="24" cy="24" r="22"></circle>'
    + '<circle class="pg" cx="24" cy="24" r="22"></circle></svg></div></div></div>'
    + '<div class="kb-haupt"><div class="kb-weg">' + ST.map(function (s, n) {
      return '<div class="kb-st" data-i="' + n + '"><b>' + ik(s.sym) + s.t + '</b>'
        + '<span>' + esc(s.schritt) + '</span></div>';
    }).join('') + '</div>'
    + '<div class="kb-buehne"><div class="kb-txt"></div><div class="kb-rechts"></div></div>'
    + '</div>'
    + '<div class="kb-fuss">'
    + '<div class="kb-f ohne"><span class="mk">OHNE</span>'
    + '<span class="tx"></span><span class="zt"></span></div>'
    + '<div class="kb-f mit"><span class="mk">MIT DEALPILOT</span>'
    + '<span class="tx"></span><span class="zt"></span></div></div>'
    + '</div>';

  var txt = wirt.querySelector('.kb-txt'), rechts = wirt.querySelector('.kb-rechts');
  var sts = [].slice.call(wirt.querySelectorAll('.kb-st'));
  var zeitN = wirt.querySelector('.kb-zeit'), ringN = wirt.querySelector('.kb-uhr-ring .pg');
  var fOhne = wirt.querySelector('.kb-f.ohne'), fMit = wirt.querySelector('.kb-f.mit');

  var i = 0, uhr = null, tikker = null, sekunde = 0, sicht = false;

  function zeigZeit(s) {
    zeitN.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function zeige(n, weich) {
    var d = ST[n], sz = szene(n);
    sts.forEach(function (s, k) {
      s.classList.toggle('on', k === n);
      s.classList.toggle('fertig', k < n);
    });

    function setzen() {
      txt.innerHTML = sz.links;
      rechts.innerHTML = sz.rechts;
      txt.classList.remove('kb-raus'); rechts.classList.remove('kb-raus');
      txt.classList.add('kb-rein'); rechts.classList.add('kb-rein');
      setTimeout(function () {
        txt.classList.remove('kb-rein'); rechts.classList.remove('kb-rein');
      }, 520);
      nachziehen(n);
    }
    if (weich) {
      txt.classList.add('kb-raus'); rechts.classList.add('kb-raus');
      setTimeout(setzen, 340);
    } else setzen();

    /* Die Uhr zaehlt von der vorigen Station auf die neue hoch und
       tickt dann weiter - stehende Zeit waere keine Zeit. */
    var von = n ? UHR[n - 1] : 0, bis = UHR[n], t0 = performance.now();
    ringN.style.strokeDashoffset = 138 - 138 * ((n + 1) / N);
    clearInterval(tikker);
    (function s(t) {
      var p = Math.min(1, (t - t0) / 900);
      sekunde = Math.round(von + (bis - von) * (1 - Math.pow(1 - p, 3)));
      zeigZeit(sekunde);
      if (p < 1) requestAnimationFrame(s);
      else tikker = setInterval(function () { zeigZeit(++sekunde); }, 1000);
    })(t0);

    fOhne.querySelector('.tx').textContent = d.ohne;
    fOhne.querySelector('.zt').textContent = d.ohneZt;
    fMit.querySelector('.tx').textContent = d.kopf;
    fMit.querySelector('.zt').textContent = d.mitZt;
  }

  /* Was nach dem Einsetzen noch von Hand angestossen werden muss. */
  function nachziehen(n) {
    [].slice.call(wirt.querySelectorAll('.kb-zahl')).forEach(function (el, k) {
      var z = el.getAttribute('data-ziel');
      if (!z) return;
      setTimeout(function () { hoch(el, z, 780); }, 320 + k * 110);
    });

    if (n === 0) {
      /* Die Mitschrift wird getippt - Wort fuer Wort, nicht Zeichen fuer
         Zeichen: so liest es sich wie Spracherkennung und nicht wie eine
         Schreibmaschine. */
      var ziel = wirt.querySelector('.kb-tipp');
      var chips = wirt.querySelector('.kb-chips');
      if (!ziel) return;
      var worte = SATZ.split(' '), k = 0;
      var t = setInterval(function () {
        if (!ziel.isConnected) { clearInterval(t); return; }
        ziel.textContent = worte.slice(0, ++k).join(' ');
        if (k >= worte.length) {
          clearInterval(t);
          chips.innerHTML = CHIPS.map(function (c, m) {
            return '<span class="kb-chip" style="--n:' + m + '">'
              + '<i>✓</i>' + esc(c[0]) + ' <b>' + esc(c[1]) + '</b></span>';
          }).join('');
        }
      }, 95);
    }

    if (n === 1) {
      var ring = wirt.querySelector('.kb-dial .pg');
      var sc = wirt.querySelector('.kb-score');
      if (ring) setTimeout(function () {
        ring.style.strokeDashoffset = 333 - 333 * (OBJ.score / 100);
      }, 60);
      if (sc) { var t0 = performance.now();
        (function s(t) {
          var p = Math.min(1, (t - t0) / 1300);
          sc.textContent = Math.round(OBJ.score * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(s);
        })(t0);
      }
    }

    if (n === 2) {
      /* Die Spanne: Skala 30-70, Rahmen 44-56, Wert 51. */
      var band = wirt.querySelector('.kb-sp-band');
      var mark = wirt.querySelector('.kb-sp-mark');
      var rnd = wirt.querySelector('.kb-rnd');
      var p0 = (44 - 30) / 40 * 100, p1 = (56 - 30) / 40 * 100, pw = (51 - 30) / 40 * 100;
      if (band) { band.style.left = p0 + '%';
        setTimeout(function () { band.style.width = (p1 - p0) + '%'; }, 40); }
      if (mark) { mark.style.left = '0%';
        setTimeout(function () { mark.style.left = pw + '%'; mark.classList.add('da'); }, 60); }
      if (rnd) { var u0 = performance.now();
        (function s(t) {
          var p = Math.min(1, (t - u0) / 1100);
          rnd.textContent = Math.round(51 * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(s);
        })(u0);
      }
    }
  }

  function schritt() { i = (i + 1) % N; zeige(i, true); }
  function an() {
    if (uhr || !sicht || document.visibilityState !== 'visible') return;
    uhr = setInterval(schritt, 7000);
  }
  function aus() { clearInterval(uhr); uhr = null; }

  zeige(0, false);
  new IntersectionObserver(function (es) {
    sicht = es[0].isIntersecting;
    if (sicht) an(); else aus();
  }, { threshold: .2 }).observe(wirt);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') an(); else aus();
  });
  wirt.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-i]');
    if (!t) return;
    aus(); i = +t.getAttribute('data-i'); zeige(i, true);
  });
})();
