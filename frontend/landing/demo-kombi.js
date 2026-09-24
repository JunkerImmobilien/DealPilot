/* ═══════════════════════════════════════════════════════════════════════
   demo-kombi.js · v1575 · Ein Szenario, vier Stationen, sechzehn Schritte
   ───────────────────────────────────────────────────────────────────────
   Das Beispielobjekt ist erfunden: Lindenallee 14. Eine echte Anschrift
   stand hier bis v1569 und musste raus.

   Die Zahlen sind trotzdem in sich gerechnet, nicht gewuerfelt:
   Baujahr 1994, Gesamtnutzungsdauer 80 Jahre, Stichtag 2026 - daraus
   folgen 32 Jahre Alter und rechnerisch 48 Jahre Restnutzungsdauer;
   neun Modernisierungspunkte heben sie auf 51, im Rahmen 44-56.

   ─── Was in v1575 dazukam und WARUM ───────────────────────────────────
   Marcel: "Also nicht, dass wir was Falsches versprechen. Wir haben ja
   nicht fuer alle Liegenschaftszinsen."

   Genau das zeigt die Belegen-Szene jetzt in DREI Sorten:
     amtlich    - Wert aus dem Bericht des zustaendigen Ausschusses
     indikativ  - abgeleitet, als solcher gekennzeichnet
     liegt nicht vor - dann steht dort der WEG: Ausschuss und Quelle

   Die dritte Sorte ist kein Eingestaendnis. CLAUDE.md: "Wo kein Wert
   vorliegt, bekommt der Kunde den Weg dorthin ... Das ist das
   Gegenstueck zur Doktrin: wir erfinden keine Zahl, also muessen wir
   umso genauer sagen koennen, wo die echte steht."

   Die Zahl im Merksatz ist gemessen, nicht geschaetzt: von 383
   Sachwertfaktor-Saetzen im Register liefern 202 einen Wert und 181
   eine begruendete Auskunft (Regressionslauf v1410, Commit 7892d26).
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
    lineal: 'M3 8h18v8H3zM7 8v4M11 8v4M15 8v4M19 8v4',
    haken: 'M4 12.5l5 5L20 6.5',
    punkt: 'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
    pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
    pfeil: 'M5 12h13M13 6l6 6-6 6',
    frage: 'M9.2 9.2a2.9 2.9 0 1 1 3.6 2.8c-.5.2-.8.7-.8 1.2v.8M12 17.5h.01',
    euro: 'M17 5.5A7 7 0 1 0 17 18.5M4 10h8M4 14h8',
    bank: 'M3 10l9-6 9 6M5 10v9M9.7 10v9M14.3 10v9M19 10v9M3 21h18'
  };
  function ik(k, gr) {
    return '<svg viewBox="0 0 24 24" width="' + (gr || 15) + '" height="' + (gr || 15)
      + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"'
      + ' stroke-linejoin="round" aria-hidden="true"><path d="' + IKON[k] + '"/></svg>';
  }

  var OBJ = {
    adr: 'Lindenallee 14, 32105 Musterstadt',
    art: 'Eigentumswohnung · 3,5 Zimmer · 82 m² · Baujahr 1994 · 2. OG mit Balkon',
    score: 76, stufe: 'Gut'
  };

  var UHR = [32, 47, 58, 238];
  var BARS = [['Rendite', 35, 72], ['Finanzierung', 25, 86], ['Risiko', 20, 79],
    ['Lage & Markt', 10, 71], ['Upside', 10, 63]];
  var SATZ = 'Lindenallee vierzehn, dreikommafünf Zimmer, zweiundachtzig '
    + 'Quadratmeter, Baujahr vierundneunzig, Kaufpreis zweihundertneunund'
    + 'achtzigtausend, Kaltmiete achthundertvierzig, Hausgeld zweihundertzehn.';
  var CHIPS = [['Kaufpreis', '289.000 €'], ['Wohnfläche', '82 m²'],
    ['Baujahr', '1994'], ['Kaltmiete', '840 €'], ['Hausgeld', '210 €'],
    ['Zimmer', '3,5']];

  /* ── Vier Stationen, je vier Unterschritte ───────────────────────── */
  var ST = [
    {
      sym: 'mikro', t: 'Erfassen', schritt: 'Schritt 1 · 32 Sekunden',
      kopf: 'Einmal sprechen. Mehr nicht.',
      satz: 'Der Sprechlauf hört mit und trägt ein. Was er nicht versteht, fragt '
        + 'er nach — und was im Exposé-PDF steht, liest er ohnehin selbst.',
      sub: [
        ['0:04', 'Exposé-PDF gelesen · 14 Felder'],
        ['0:14', 'Sprechlauf: Hausgeld und Rücklage ergänzt'],
        ['0:26', 'Plausibilität: Miete gegen Mietspiegel geprüft'],
        ['0:32', 'Objekt angelegt · 2026-1036']
      ],
      ohne: '40 Felder aus vier Unterlagen abtippen', ohneZt: '45 min', mitZt: '0:32'
    },
    {
      sym: 'score', t: 'Rechnen', schritt: 'Schritt 2 · 15 Sekunden',
      kopf: '24 Kennzahlen werden eine Zahl.',
      satz: 'Rendite, Finanzierung, Risiko, Lage und Upside einzeln bewertet, dann '
        + 'gewichtet verdichtet. Sechs Profile — wer auf Cashflow schaut, bekommt '
        + 'eine andere Gewichtung als wer auf Sicherheit schaut.',
      sub: [
        ['0:35', '24 Kennzahlen gerechnet'],
        ['0:39', 'DSCR 1,27 · Stresstest bei 5,5 % bestanden'],
        ['0:43', 'Cashflow nach Steuern über 12 Jahre'],
        ['0:47', 'Deal Score 76 · Gut']
      ],
      ohne: 'Excel bauen, Formeln prüfen, hoffen', ohneZt: '2 Std', mitZt: '0:47'
    },
    {
      sym: 'waage', t: 'Belegen', schritt: 'Schritt 3 · 11 Sekunden',
      kopf: 'Jede Zahl sagt, woher sie kommt.',
      satz: 'Drei Sorten, sichtbar getrennt: amtlich aus dem Bericht des Ausschusses, '
        + 'abgeleitet und als indikativ gekennzeichnet — oder gar nicht vorhanden. '
        + 'Dann steht dort, wo die echte Zahl zu holen ist.',
      sub: [
        ['0:49', 'Zuständigen Gutachterausschuss bestimmt'],
        ['0:52', 'Bodenrichtwert und Liegenschaftszins amtlich'],
        ['0:55', 'Restnutzungsdauer nach Anlage 2 abgeleitet'],
        ['0:58', '1 Kennzahl ohne Wert — Weg hinterlegt']
      ],
      ohne: 'Gutachterausschuss anschreiben, warten', ohneZt: '3 Tage', mitZt: '0:58'
    },
    {
      sym: 'stapel', t: 'Ausgeben', schritt: 'Schritt 4 · ein Klick',
      kopf: 'Achtzehn Seiten, bankfähig.',
      satz: 'Investment-Case für die Bank, BMF-Anlage fürs Finanzamt, Marktbericht '
        + 'mit Quellennachweis. Auf Wunsch im eigenen Logo — oder direkt in den '
        + 'Datenraum des Objekts.',
      sub: [
        ['3:49', 'Investment-Case · 6 Seiten'],
        ['3:53', 'BMF-Anlage Kaufpreisaufteilung · 4 Seiten'],
        ['3:56', 'Marktbericht mit Quellennachweis · 8 Seiten'],
        ['3:58', 'Abgelegt in 03 Bank und 04 Steuern']
      ],
      ohne: 'Bericht layouten, bevor die Bank hinsieht', ohneZt: '55 min', mitZt: '3:58'
    }
  ];

  /* ── Die Abstufung: drei Sorten Zahl ─────────────────────────────── */
  var GRADE = [
    ['amt', 'waage', 'Bodenrichtwert', '340 €/m²', 'AMTLICH',
      'BORIS Niedersachsen · Stichtag 01.01.2026 · dl-de/by-2-0'],
    ['amt', 'euro', 'Liegenschaftszins', '3,4 %', 'AMTLICH',
      'Gutachterausschuss Musterstadt · Grundstücksmarktbericht 2025, S. 48'],
    ['amt', 'haus', 'Sachwertfaktor', '1,08', 'AMTLICH',
      'Gutachterausschuss Musterstadt · Kalkulator 2026, Stichprobe 854 Fälle'],
    ['ind', 'lineal', 'Restnutzungsdauer', '51 Jahre', 'ABGELEITET',
      'Anlage 2 ImmoWertV · aus Baujahr und Modernisierungspunkten'],
    ['ind', 'pfeil', 'Marktpreisindikation', '± 6 %', 'INDIKATIV',
      'unabhängige Bewertungspartner · kein amtlicher Wert'],
    ['weg', 'frage', 'Vergleichsfaktor ETW', 'kein Wert', 'WEG',
      '→ Gutachterausschuss Musterstadt · Vollbericht kostenpflichtig']
  ];

  var N = ST.length;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* ══════════════════════════════════════════════════════════════════
     Die vier Szenen
     ══════════════════════════════════════════════════════════════════ */
  function szene(i) {
    var d = ST[i];
    var kopf = '<h3>' + esc(d.kopf) + '</h3><p>' + d.satz + '</p>'
      + '<div class="kb-sub-mobil"></div>';

    /* ── 1 · SPRECHEN ────────────────────────────────────────────── */
    if (i === 0) {
      var w = '';
      for (var b = 0; b < 22; b++) w += '<i style="--n:' + b + '"></i>';
      return { breit: false,
        links: kopf
          + '<div class="kb-mik"><div class="kb-mik-k">'
          + '<span class="kb-ring"></span><span class="kb-ring"></span>'
          + '<span class="kb-ring"></span>' + ik('mikro', 23) + '</div>'
          + '<div class="kb-welle">' + w + '</div></div>'
          + '<div class="kb-mitschrift"><span class="kb-tipp"></span>'
          + '<span class="cur"></span></div>'
          + '<div class="kb-chips"></div>',
        rechts: karte('AUFNAHME LÄUFT',
          '<div class="kb-k-lbl">Erkannte Felder</div>'
          + '<div class="kb-k-gross kb-zahl" data-ziel="14 / 14">&nbsp;</div>'
          + '<div class="kb-k-sub">aus Sprache und Exposé-PDF —<br>'
          + 'nichts davon wurde getippt</div>'
          + '<div class="kb-k-zeilen">' + CHIPS.slice(0, 4).map(function (c, n) {
            return zeile(c[0], c[1], n);
          }).join('') + '</div>')
      };
    }

    /* ── 2 · RECHNEN — Ring und Balken NEBENEINANDER ─────────────── */
    if (i === 1) {
      return { breit: true,
        links: kopf + '<div class="kb-grade">'
          + [['amt', 'score', 'Deal Score', '76 · Gut', 'ERRECHNET',
            'Finanzierung trägt den Deal, Rendite ist die Schwachstelle'],
          ['amt', 'bank', 'DSCR', '1,27', 'ERRECHNET',
            'Kapitaldienst gedeckt — auch im Stresstest bei 5,5 %'],
          ['amt', 'euro', 'Cashflow', '+138 €/Mon.', 'ERRECHNET',
            'nach Steuern, nach Rücklage, ab dem ersten Jahr']]
            .map(grad).join('') + '</div>',
        rechts: karte('INVESTOR DEAL SCORE',
          '<div class="kb-score-grid">'
          + '<div><div class="kb-dial"><svg viewBox="0 0 120 120" aria-hidden="true">'
          + '<circle class="tr" cx="60" cy="60" r="53"></circle>'
          + '<circle class="pg" cx="60" cy="60" r="53"></circle></svg>'
          + '<div class="kb-dv"><b class="kb-score">0</b><small>/ 100</small></div></div>'
          + '<div class="kb-stufe">◆ ' + OBJ.stufe.toUpperCase() + '</div></div>'
          + '<div class="kb-bars">' + BARS.map(function (z, n) {
            var f = z[2] >= 85 ? '#2E8455' : z[2] >= 70 ? '#3FA56C' : '#C9A84C';
            return '<div class="kb-bar"><div class="top">'
              + '<span class="nm">' + z[0] + '<span class="wt">' + z[1] + '%</span></span>'
              + '<span class="sc" style="color:' + f + '">' + z[2] + '</span></div>'
              + '<span class="track"><i style="--b:' + z[2] + '%;--n:' + n
              + ';background:' + f + '"></i></span></div>';
          }).join('') + '</div></div>'
          + '<div class="kb-kpi">'
          + '<div><b class="kb-zahl" data-ziel="289.000 €">&nbsp;</b><span>KAUFPREIS</span></div>'
          + '<div><b class="kb-zahl" data-ziel="21/24">&nbsp;</b><span>BELEGT</span></div>'
          + '<div><b class="kb-zahl" data-ziel="88 %">&nbsp;</b><span>TIEFE</span></div>'
          + '</div>')
      };
    }

    /* ── 3 · BELEGEN: die Abstufung ──────────────────────────────── */
    if (i === 2) {
      return { breit: false,
        links: kopf
          + '<div class="kb-spanne"><div class="kb-sp-kopf">'
          + '<span class="lb">RESTNUTZUNGSDAUER · ANLAGE 2 IMMOWERTV</span>'
          + '<span class="wt"><span class="kb-rnd">0</span> Jahre'
          + '<small>Rahmen 44–56</small></span></div>'
          + '<div class="kb-sp-bahn"><span class="kb-sp-grund"></span>'
          + '<span class="kb-sp-band"></span><span class="kb-sp-mark"></span></div>'
          + '<div class="kb-sp-skala"><span>30</span><span>40</span><span>50</span>'
          + '<span>60</span><span>70</span></div>'
          + '<div class="kb-sp-note">' + ik('lineal', 13)
          + '<span>Baujahr 1994 · GND 80 Jahre · 9 Modernisierungspunkte '
          + '→ 51 statt 48 Jahre. Die Spanne bleibt sichtbar, weil das Modell '
          + 'einen Rahmen liefert und keinen Punkt.</span></div></div>'
          + '<div class="kb-grade">' + GRADE.map(grad).join('') + '</div>'
          + '<div class="kb-doktrin">' + ik('frage', 14)
          + '<span><b>Wo keine amtliche Zahl vorliegt, erfindet DealPilot keine.</b> '
          + 'Dann steht dort der Weg: welcher Ausschuss zuständig ist und wo sein '
          + 'Bericht liegt. Im Register geben heute <b>181 von 383</b> '
          + 'Sachwertfaktor-Sätzen genau diese begründete Auskunft statt einer '
          + 'Zahl.</span></div>',
        rechts: karte('QUELLENNACHWEIS',
          '<div class="kb-k-lbl">Amtlich belegt</div>'
          + '<div class="kb-k-gross kb-zahl" data-ziel="21 / 24">&nbsp;</div>'
          + '<div class="kb-k-sub">Kennzahlen mit benannter Herkunft —<br>'
          + 'Ausschuss, Jahrgang, Seite, Lizenz</div>'
          + '<div class="kb-k-zeilen">'
          + zeile('Bodenrichtwert', '340 €/m²', 0)
          + zeile('Liegenschaftszins', '3,4 %', 1)
          + zeile('Sachwertfaktor', '1,08', 2)
          + zeile('Restnutzungsdauer', '51 J.', 3)
          + zeile('ohne Wert', '1', 4) + '</div>')
      };
    }

    /* ── 4 · AUSGEBEN ────────────────────────────────────────────── */
    return { breit: false,
      links: kopf + '<div class="kb-pdfs">'
        + [['Investment-Case', 'Kennzahlen, Cashflow, Stresstest, Score', '6 Seiten', '03 Bank'],
        ['BMF-Anlage', 'Kaufpreisaufteilung fürs Finanzamt', '4 Seiten', '04 Steuern'],
        ['Marktbericht', 'mit Quellennachweis und Lizenz', '8 Seiten', '05 Bewertung']]
          .map(function (p, n) {
            return '<div class="kb-pdf" style="--n:' + n + '">'
              + '<span class="ik">' + ik('blatt', 16) + '</span>'
              + '<span><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></span>'
              + '<span class="s">' + esc(p[2]) + '<br>→ ' + esc(p[3]) + '</span></div>';
          }).join('') + '</div>',
      rechts: karte('AUSGABE BEREIT',
        '<div class="kb-k-lbl">Erzeugt</div>'
        + '<div class="kb-k-gross"><span class="kb-zahl" data-ziel="18">&nbsp;</span> Seiten</div>'
        + '<div class="kb-k-sub">in drei Dokumenten,<br>'
        + 'fertig für Bank und Finanzamt</div>'
        + '<div class="kb-k-zeilen">'
        + zeile('Rechenzeit', '2,1 s', 0)
        + zeile('Eigenes Logo', 'möglich', 1)
        + zeile('Quellennachweis', 'enthalten', 2)
        + zeile('Gesamtdauer', '3:58 min', 3) + '</div>')
    };
  }

  function grad(g, n) {
    return '<div class="kb-g ' + g[0] + '" style="--n:' + n + '">'
      + '<span class="ik">' + ik(g[1], 14) + '</span>'
      + '<span class="nm">' + esc(g[2]) + '</span>'
      + '<span class="qu">' + esc(g[5]) + '</span>'
      + '<span class="wt">' + esc(g[3]) + '</span>'
      + '<span class="st">' + esc(g[4]) + '</span></div>';
  }
  function zeile(k, v, n) {
    return '<div class="kb-k-z" style="opacity:0;animation:kbRein .45s var(--e-hoch) '
      + (0.3 + n * 0.11) + 's forwards"><span>' + esc(k) + '</span>'
      + '<b class="kb-zahl" data-ziel="' + esc(v) + '">&nbsp;</b></div>';
  }
  function karte(band, inhalt) {
    return '<div class="kb-karte"><div class="kb-k-band"><span>' + band + '</span>'
      + '<span>LINDENALLEE 14</span></div>'
      + '<div class="kb-k-body">' + inhalt + '</div>'
      + '<div class="kb-tear"></div>'
      + '<div class="kb-foot"><span>PASSENGER<b>DealPilot Co-Pilot</b></span>'
      + '<span style="text-align:right">FLIGHT<b>DP · BOARDING</b></span></div></div>';
  }

  /* Das Ausgabeformat kommt aus dem ZIELWERT, nicht aus einer Annahme:
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

  /* ══════════════════════════════════════════════════════════════════ */
  var wirt = document.querySelector('[data-kombi]');
  if (!wirt) return;

  wirt.innerHTML = '<div class="kb">'
    + '<div class="kb-streifen"></div>'
    + '<div class="kb-kopf">'
    + '<div class="kb-obj"><b><span class="pin">' + ik('pin', 17) + '</span>'
    + esc(OBJ.adr) + '</b><span>' + esc(OBJ.art) + '</span></div>'
    + '<div class="kb-uhr"><div class="kb-uhr-t"><b class="kb-zeit">0:00</b>'
    + '<span><span class="kb-tick"></span>LAUFZEIT</span></div>'
    + '<div class="kb-uhr-ring"><svg viewBox="0 0 48 48" aria-hidden="true">'
    + '<circle class="tr" cx="24" cy="24" r="22"></circle>'
    + '<circle class="pg" cx="24" cy="24" r="22"></circle></svg></div></div></div>'
    + '<div class="kb-haupt"><div class="kb-weg">' + ST.map(function (s, n) {
      return '<div class="kb-st" data-i="' + n + '"><b>' + ik(s.sym) + s.t + '</b>'
        + '<span>' + esc(s.schritt) + '</span>'
        + '<div class="kb-sub"><div class="kb-sub-in"><ul>'
        + s.sub.map(function (u, m) {
          return '<li data-s="' + m + '"><span class="hk">' + ik('punkt', 11) + '</span>'
            + '<span>' + esc(u[1]) + '</span><span class="zt">' + esc(u[0]) + '</span></li>';
        }).join('') + '</ul></div></div></div>';
    }).join('') + '</div>'
    + '<div class="kb-buehne"><div class="kb-txt"></div><div class="kb-rechts"></div></div>'
    + '</div>'
    + '<div class="kb-fuss">'
    + '<div class="kb-f ohne"><span class="mk">OHNE</span>'
    + '<span class="tx"></span><span class="zt"></span></div>'
    + '<div class="kb-f mit"><span class="mk">MIT DEALPILOT</span>'
    + '<span class="tx"></span><span class="zt"></span></div></div>'
    + '</div>';

  var buehne = wirt.querySelector('.kb-buehne');
  var txt = wirt.querySelector('.kb-txt'), rechts = wirt.querySelector('.kb-rechts');
  var sts = [].slice.call(wirt.querySelectorAll('.kb-st'));
  var zeitN = wirt.querySelector('.kb-zeit'), ringN = wirt.querySelector('.kb-uhr-ring .pg');
  var fOhne = wirt.querySelector('.kb-f.ohne'), fMit = wirt.querySelector('.kb-f.mit');

  var i = 0, uhr = null, tikker = null, subUhr = null, sekunde = 0, sicht = false;
  var TAKT = 9000;                        /* je Station */
  var SUBTAKT = TAKT / (4 + 1.6);         /* die vier Haken darin */

  function zeigZeit(s) {
    zeitN.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function zeige(n, weich) {
    var d = ST[n], sz = szene(n);
    sts.forEach(function (s, k) {
      s.classList.toggle('on', k === n);
      s.classList.toggle('fertig', k < n);
      /* Vergangene Stationen zeigen ihre Schritte abgehakt. */
      [].slice.call(s.querySelectorAll('.kb-sub li')).forEach(function (li) {
        li.classList.toggle('da', k < n);
        li.classList.remove('jetzt');
        if (k < n) li.querySelector('.hk').innerHTML = ik('haken', 11);
      });
    });

    function setzen() {
      buehne.classList.toggle('breit', !!sz.breit);
      txt.innerHTML = sz.links;
      rechts.innerHTML = sz.rechts;
      txt.classList.remove('kb-raus'); rechts.classList.remove('kb-raus');
      txt.classList.add('kb-rein'); rechts.classList.add('kb-rein');
      setTimeout(function () {
        txt.classList.remove('kb-rein'); rechts.classList.remove('kb-rein');
      }, 520);
      /* Auf schmalen Schirmen stehen die Unterschritte unter dem Text. */
      var mob = txt.querySelector('.kb-sub-mobil');
      if (mob) mob.innerHTML = '<div class="kb-sub" style="grid-template-rows:1fr">'
        + '<div class="kb-sub-in"><ul>' + d.sub.map(function (u, m) {
          return '<li data-s="' + m + '"><span class="hk">' + ik('punkt', 11)
            + '</span><span>' + esc(u[1]) + '</span>'
            + '<span class="zt">' + esc(u[0]) + '</span></li>';
        }).join('') + '</ul></div></div>';
      nachziehen(n);
      haken(n);
    }
    if (weich) {
      txt.classList.add('kb-raus'); rechts.classList.add('kb-raus');
      setTimeout(setzen, 320);
    } else setzen();

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

  /* Die Unterschritte haken der Reihe nach ab - im Weg UND, auf
     schmalen Schirmen, unter dem Text. Beide tragen dieselben
     data-s-Nummern, deshalb reicht ein Durchlauf. */
  function haken(n) {
    clearInterval(subUhr);
    var k = 0;
    subUhr = setInterval(function () {
      var alle = [].slice.call(wirt.querySelectorAll(
        '.kb-st.on .kb-sub li, .kb-sub-mobil .kb-sub li'));
      alle.forEach(function (li) {
        var s = +li.getAttribute('data-s');
        if (s < k) {
          li.classList.add('da'); li.classList.remove('jetzt');
          li.querySelector('.hk').innerHTML = ik('haken', 11);
        } else if (s === k) {
          li.classList.add('jetzt');
        }
      });
      if (++k > 4) clearInterval(subUhr);
    }, SUBTAKT);
  }

  function nachziehen(n) {
    [].slice.call(wirt.querySelectorAll('.kb-zahl')).forEach(function (el, k) {
      var z = el.getAttribute('data-ziel');
      if (!z) return;
      setTimeout(function () { hoch(el, z, 780); }, 300 + k * 100);
    });

    if (n === 0) {
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
              + '<span class="hk">' + ik('haken', 11) + '</span>'
              + esc(c[0]) + ' <b>' + esc(c[1]) + '</b></span>';
          }).join('');
        }
      }, 88);
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
    uhr = setInterval(schritt, TAKT);
  }
  function aus() { clearInterval(uhr); uhr = null; clearInterval(subUhr); }

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
