/* ═══════════════════════════════════════════════════════════════════════
   dp2-ablauf.js · v1562 · Der begehbare Ablauf
   ───────────────────────────────────────────────────────────────────────
   Marcel am 23.09.2026: "Wir haben die Bereiche, was der Pilot macht,
   und in fuenf Schritten zum Ziel. Das waere cool, wenn wir das
   animieren und zusammenfuehren. Man geht zum Beispiel auf 'Rechnen
   statt Schaetzen' und bekommt dann 'Kennzahlen pruefen' ... dass das
   aufgepoppt wird, animiert wird, dass die User denken: boah, cool,
   was das alles kann."

   Aus zwei Abschnitten wird einer: vier Phasen als Reiter, darunter
   faehrt auf, was in dieser Phase geschieht - der Schritt aus dem
   bisherigen Fuenfschritt, die Handgriffe und das, was am Ende dasteht.

   Es laeuft von selbst weiter, solange niemand eingreift. Beim ersten
   Klick hoert das auf: wer selbst blaettert, will nicht weitergeschoben
   werden.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Die Inhalte stehen hier und nur hier. Die Schritt-Nummern sind die
     des bisherigen "In fuenf Schritten zum Ziel" - deshalb hat eine
     Phase zwei davon und eine gar keinen. */
  var PHASEN = [
    {
      k: 'Erfassen', sym: 'i-mikro',
      t: 'Erfassen statt abtippen',
      schritt: '01 // IMPORT',
      satz: 'Exposé hochladen, das Objekt diktieren oder Belege scannen — die Werte '
          + 'landen in den Feldern, nicht im Notizblock.',
      wege: [
        ['Quick-Check', 'Sechs Zahlen, eine Minute — lohnt das Weiterrechnen?'],
        ['Exposé-PDF', 'Die KI liest Kaufpreis, Fläche, Baujahr, Miete und die Bilder heraus.'],
        ['Sprechlauf', 'In sechs Etappen diktieren. Nach Etappe 2 steht der erste Score.'],
        ['Belege', 'Rechnungen einlesen, jede Zeile bestätigen, ab in die Anschaffungskosten.'],
      ],
      ergebnis: ['Objekt angelegt', 'Bis zu 30 Fotos', 'Nichts abgetippt'],
    },
    {
      k: 'Rechnen', sym: 'i-zahnrad',
      t: 'Rechnen statt schätzen',
      schritt: '02 // ANALYSE',
      satz: 'Cashflow, DSCR, LTV und Rendite — heute, zum Ende der Zinsbindung und für '
          + 'den Anschluss. Dazu Steuer und AfA und die 15-Jahres-Projektion.',
      wege: [
        ['Finanzierung', 'Annuität, Zweitdarlehen, KfW, Bausparen, Anschluss-Stresstest.'],
        ['Steuer &amp; AfA', 'Linear, degressiv, § 7b — mit der 15-%-Regel als Live-Balken.'],
        ['Bewirtschaftung', 'Umlagefähig und nicht umlagefähig getrennt geführt.'],
        ['Miete &amp; Markt', 'Mietstruktur, Marktvergleich, Entwicklung als Treppe.'],
      ],
      ergebnis: ['15 Jahre Projektion', 'Cashflow nach Steuern', 'DSCR und LTV'],
    },
    {
      k: 'Belegen', sym: 'i-ziel',
      t: 'Belegen statt behaupten',
      schritt: '03 // CO-PILOT  ·  04 // BEWERTEN',
      satz: 'Der Co-Pilot kennt alle deine Zahlen und benennt Stärken und Risiken. '
          + 'Der Investor Deal Score fasst 24 Kennzahlen zu einer Zahl zusammen — '
          + 'und sagt dazu, auf wie vielen Angaben sie beruht.',
      wege: [
        ['Investor Deal Score', '24 Kennzahlen in fünf Bereichen, Gewichte frei wählbar.'],
        ['Co-Pilot', 'Rückfragen zum eigenen Objekt — Web-Recherche nur auf Knopfdruck.'],
        ['Amtliche Quellen', 'BMF-Arbeitshilfe, ImmoWertV, Bodenrichtwert, Bundesbank.'],
        ['Restnutzungsdauer', 'Sechs Verfahren, 190 Bauteile — Ergebnis als Spanne.'],
      ],
      ergebnis: ['Score 0–100', 'Jede Zahl mit Quelle', 'Note ab 70 % Vollständigkeit'],
    },
    {
      k: 'Ausgeben', sym: 'i-doc',
      t: 'Ausgeben statt basteln',
      schritt: '05 // EXPORT',
      satz: 'Der Investment-Case für die Bank, die Mappe fürs Finanzamt, der Datenraum '
          + 'für alles, was sonst noch verlangt wird.',
      wege: [
        ['Investment-Case', 'Sechs Seiten: Objekt, Finanzierung, Charts, Tilgung, Cashflow.'],
        ['Bankexport', 'Excel mit 25 Spalten — und das eigene Logo im PDF.'],
        ['Finanzamt', 'Werbungskosten bis zur Zeile der Anlage V, Kaufpreisaufteilung dabei.'],
        ['Datenraum', 'Unterlagen je Objekt, mit Checkliste und Freigabe auf Zeit.'],
      ],
      ergebnis: ['Bankfertig', 'Logo ab Investor', 'Freigabe per QR'],
    },
  ];


  /* ══ Die Szene je Phase ══════════════════════════════════════════════
     Marcel am 23.09.2026: "Beim Erfassen ein Mikrofon, was sich bewegt,
     wie aus der DealPilot-App ... ein paar Sachen aufpoppen. Also das
     muss richtig geil animieren."
     Das Mikrofon ist aus voice-import.js uebernommen - dieselben Ringe,
     dieselbe Ringzeit. Die Stichwoerter liegen im Kreis darum und werden
     nacheinander abgehakt, wie im echten Sprechlauf. */
  /* ══ Die Szene je Phase ══════════════════════════════════════════════
     v1569 · Marcel am 23.09.2026: "Das muss optisch richtig aufgewertet
     sein, ein richtiger Wow-Effekt ... beim Rechnen vielleicht einfach
     eine kleine Investor-Deal-Score-Karte, die wir oben im Header haben
     ... beim Belegen eine Restnutzung, eine Rechnung, eine
     Verkehrswertrechnung ... bei der Ausgabe ein aktuelles PDF mit
     Zahlen und einen Auszug draufgeben."

     Jede Szene zeigt jetzt ein ECHTES Stueck Arbeit statt einer
     Andeutung. Die Zahlen sind durchgerechnet und passen zueinander:
     ein Objekt, 112 m², 285.000 €, 820 € Kaltmiete - dieselben Werte
     laufen durch alle vier Szenen.

     Keine echte Anschrift: das Testobjekt der Entwicklung steht an
     einer Adresse, an der jemand wohnt. */
  function szene(i) {

    /* ── 1 · ERFASSEN ────────────────────────────────────────────────
       Das Mikrofon aus der App, darum die Stichwoerter im Kreis. */
    if (i === 0) {
      var woerter = ['3-Zimmer-ETW', '112 m²', 'Baujahr 1974', '820 € kalt',
        '285.000 €', 'mit Stellplatz'];
      var chips = woerter.map(function (w, n) {
        var winkel = (n / woerter.length) * 2 * Math.PI - Math.PI / 2;
        var x = 50 + Math.cos(winkel) * 36, y = 50 + Math.sin(winkel) * 33;
        return '<span class="sz-chip" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1)
          + '%;animation-delay:' + (n * 0.95).toFixed(2) + 's"><i class="ck" style="animation-delay:'
          + (n * 0.95).toFixed(2) + 's">✓</i>' + w + '</span>';
      }).join('');
      return '<div class="sz-ringe"><i></i><i></i><i></i></div>' + chips
        + '<span class="sz-mic"><svg class="ico"><use href="#i-mikro"/></svg></span>'
        + '<span class="sz-mitschrift">„Dreizimmerwohnung, 112 Quadratmeter, '
        + 'Baujahr vierundsiebzig …"</span>';
    }

    /* ── 2 · RECHNEN ─────────────────────────────────────────────────
       Die Score-Karte aus dem Kopf, im Kleinen. Derselbe Aufbau:
       Ring, Zahl, Stufe, darunter die Kennzahlen. */
    if (i === 1) {
      /* Dieselbe Karte wie im Kopf - nur kleiner. Die Balken kommen aus
         derselben Liste wie oben, damit beide nie auseinanderlaufen. */
      var bal = [['Rendite', 35, 71], ['Finanzierung', 25, 84], ['Risiko', 20, 76],
        ['Lage & Markt', 10, 68], ['Upside', 10, 59]];
      return '<div class="sz-skal"><div class="idscard sz-klein">'
        + '<div class="ids-band"><span class="l"><i class="dot"></i>'
        + 'Pre-Flight · Investor Deal Score</span><span class="cleared">Cleared</span></div>'
        + '<div class="ids-head"><span class="ids-title">Investor <b>Deal Score</b></span>'
        + '<span class="ids-allkpi">☰ Alle KPIs</span></div>'
        + '<div class="ids-body"><div class="ids-left">'
        + '<div class="ids-dial"><svg viewBox="0 0 120 120" aria-hidden="true">'
        + '<circle class="tr" cx="60" cy="60" r="53"></circle>'
        + '<circle class="pg sz-pg" cx="60" cy="60" r="53"></circle></svg>'
        + '<div class="ids-dv"><b>74</b><small>/&thinsp;100</small></div></div>'
        + '<div class="ids-badge">◆ Gut</div>'
        + '<div class="ids-stats">'
        + '<div><b>285.000&nbsp;€</b><span>Kaufpreis</span></div>'
        + '<div><b>21/24</b><span>KPIs</span></div>'
        + '<div><b>88&thinsp;%</b><span>Tiefe</span></div></div></div>'
        + '<div class="ids-right"><div class="ids-h">So setzt sich der Score zusammen</div>'
        + bal.map(function (z, n) {
            var f = z[2] >= 85 ? '#2E8455' : z[2] >= 70 ? '#3FA56C' : '#C9A84C';
            return '<div class="ids-bar"><div class="top">'
              + '<span class="nm">' + z[0] + '<span class="wt">' + z[1] + '%</span></span>'
              + '<span class="sc" style="color:' + f + '">' + z[2] + '<small>/100</small></span>'
              + '</div><span class="track"><i class="sz-bal" style="--b:' + z[2]
              + '%;--n:' + n + ';background:' + f + '"></i></span></div>';
          }).join('')
        + '</div></div>'
        + '<div class="ids-tear"><span class="nl"></span><span class="nr"></span></div>'
        + '<div class="ids-foot">'
        + '<div class="lab">PASSENGER<b>DealPilot Co-Pilot</b></div>'
        + '<div class="lab" style="text-align:center">FLIGHT<b>DP · BOARDING</b></div>'
        + '<div class="ids-qr sz-qr"></div></div>'
        + '</div></div>';
    }

    /* ── 3 · BELEGEN ─────────────────────────────────────────────────
       Drei Nachweise, jeder mit seiner Quelle - das ist der Punkt:
       nicht die Zahl, sondern woher sie kommt. */
    if (i === 2) {
      var belege = [
        ['Restnutzungsdauer', '34 Jahre', 'Anlage 2 ImmoWertV · Punktraster'],
        ['Gebäudeanteil', '78,4 %', 'BMF-Arbeitshilfe, Fassung 06/2023'],
        ['Verkehrswert', '271.400 €', 'Ertragswertverfahren · § 27 ImmoWertV'],
      ];
      return '<div class="sz-belege">' + belege.map(function (b, n) {
        return '<div class="sz-beleg" style="--n:' + n + '">'
          + '<div class="sz-b-kopf"><b>' + b[0] + '</b><span class="sz-b-wert">' + b[1] + '</span></div>'
          + '<div class="sz-b-q"><i class="sz-b-ok">✓</i>' + b[2] + '</div>'
          + '</div>';
      }).join('') + '</div>';
    }

    /* ── 4 · AUSGEBEN ────────────────────────────────────────────────
       Eine Seite aus dem Investment-Case, mit den Zahlen der anderen
       drei Szenen. Der Auszug ist kein Bild, sondern gesetzt - er
       bleibt damit scharf und laesst sich vorlesen. */
    var balken = [38, 52, 46, 68, 58, 79, 71, 88];
    return '<div class="sz-pdf">'
      + '<span class="sz-blatt" style="--n:0"></span>'
      + '<span class="sz-blatt" style="--n:1"></span>'
      + '<div class="sz-blatt top" style="--n:2">'
      + '<div class="sz-p-kopf"><span class="sz-p-marke">DEALPILOT</span>'
      + '<span class="sz-p-typ">INVESTMENT-CASE</span></div>'
      + '<div class="sz-p-titel">3-Zimmer-Eigentumswohnung<br><i>112 m² · Baujahr 1974</i></div>'
      + '<div class="sz-p-tab">'
      + [['Kaufpreis', '285.000 €'], ['Jahresnettomiete', '9.840 €'],
         ['Cashflow / Monat', '+ 214 €'], ['Deal Score', '74 / 100']]
        .map(function (z) { return '<div><span>' + z[0] + '</span><b>' + z[1] + '</b></div>'; }).join('')
      + '</div>'
      + '<div class="sz-p-chart">'
      + balken.map(function (h, n) {
          return '<i style="--h:' + h + '%;--n:' + n + '"></i>';
        }).join('')
      + '</div>'
      + '<div class="sz-p-fuss">Cashflow-Projektion · 15 Jahre</div>'
      + '</div>'
      + '<span class="sz-stempel">BANKFERTIG</span></div>';
  }

  var wirt = document.getElementById('ablauf');
  if (!wirt) return;
  var ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Aufbauen ───────────────────────────────────────────────────── */
  var reiter = PHASEN.map(function (p, i) {
    return '<button class="ab-r' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">'
      + '<span class="ab-rn">0' + (i + 1) + '</span>'
      + '<span class="ab-rt">' + p.k + '</span>'
      + '<span class="ab-rb"><i></i></span>'
      + '</button>';
  }).join('');

  var buehnen = PHASEN.map(function (p, i) {
    return '<div class="ab-b' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">'
      + '<div class="ab-links">'
      + '<div class="ab-kopf">'
      + '<span class="ab-sym"><svg class="ico"><use href="#' + p.sym + '"/></svg></span>'
      + '<span class="ab-schritt">' + p.schritt + '</span>'
      + '<h3>' + p.t + '</h3><p>' + p.satz + '</p></div>'
      + '<div class="ab-wege">'
      + p.wege.map(function (w, j) {
          return '<div class="ab-w" style="--n:' + j + '">'
            + '<b>' + w[0] + '</b><span>' + w[1] + '</span></div>';
        }).join('')
      + '</div>'
      + '</div>'
      + '<div class="ab-szene">' + szene(i) + '</div>'
      + '<div class="ab-erg">'
      + p.ergebnis.map(function (e) { return '<span>' + e + '</span>'; }).join('')
      + '</div>'
      + '</div>';
  }).join('');

  wirt.innerHTML = '<div class="ab-reiter">' + reiter + '</div>'
    + '<div class="ab-buehne">' + buehnen + '</div>';

    /* Der QR im Stub der kleinen Karte - derselbe feste Startwert wie
       oben, damit beide Karten dasselbe Muster tragen. */
    wirt.querySelectorAll('.sz-qr').forEach(function (host) {
      var n = 11, cell = 3, svg = '<svg width="' + (n * cell) + '" height="' + (n * cell)
        + '" viewBox="0 0 ' + (n * cell) + ' ' + (n * cell) + '" aria-hidden="true">';
      function fp(x, y) {
        return '<rect x="' + x + '" y="' + y + '" width="' + (7 * cell) + '" height="' + (7 * cell) + '" fill="#0c0b09"/>'
          + '<rect x="' + (x + cell) + '" y="' + (y + cell) + '" width="' + (5 * cell) + '" height="' + (5 * cell) + '" fill="#fff"/>'
          + '<rect x="' + (x + 2 * cell) + '" y="' + (y + 2 * cell) + '" width="' + (3 * cell) + '" height="' + (3 * cell) + '" fill="#0c0b09"/>';
      }
      var seed = 7;
      function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        if ((x < 7 && y < 7) || (x > 3 && y < 7 && x >= n - 7)) continue;
        if (rnd() > 0.55) svg += '<rect x="' + (x * cell) + '" y="' + (y * cell) + '" width="' + cell + '" height="' + cell + '" fill="#0c0b09"/>';
      }
      host.innerHTML = svg + fp(0, 0) + fp((n - 7) * cell, 0) + '</svg>';
    });

  var rs = [].slice.call(wirt.querySelectorAll('.ab-r'));
  var bs = [].slice.call(wirt.querySelectorAll('.ab-b'));
  var akt = 0, uhr = null, selbst = false;

  function zeige(i) {
    akt = (i + PHASEN.length) % PHASEN.length;
    rs.forEach(function (r, j) { r.classList.toggle('on', j === akt); });
    bs.forEach(function (b, j) {
      var an = j === akt;
      /* Die Klasse wird kurz abgenommen und neu gesetzt, damit die
         Einfahr-Animation der Wege auch beim zweiten Mal laeuft. */
      if (an && !ruhig) {
        b.classList.remove('on');
        void b.offsetWidth;          /* erzwingt ein Neuberechnen */
      }
      b.classList.toggle('on', an);
    });
  }

  function weiter() { zeige(akt + 1); }
  function anhalten() {
    if (uhr) { clearInterval(uhr); uhr = null; }
    selbst = true;
    wirt.classList.add('ab-hand');
  }

  wirt.addEventListener('click', function (e) {
    var r = e.target.closest('.ab-r[data-i]');
    if (!r) return;
    anhalten();
    zeige(parseInt(r.dataset.i, 10));
  });

  /* Pfeiltasten, wenn ein Reiter den Fokus hat. */
  wirt.addEventListener('keydown', function (e) {
    if (!e.target.closest('.ab-r')) return;
    if (e.key === 'ArrowRight') { anhalten(); zeige(akt + 1); rs[akt].focus(); }
    if (e.key === 'ArrowLeft') { anhalten(); zeige(akt - 1); rs[akt].focus(); }
  });

  /* ── Von selbst weiter, solange niemand eingreift ──────────────────
     Nur wenn der Abschnitt im Bild steht und das Fenster vorn ist -
     im verborgenen Tab wird jeder Timer auf rund eine Sekunde gedrosselt
     und die Uebergaenge laufen gar nicht. */
  if (!ruhig) {
    var imBild = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        imBild = e.isIntersecting;
        if (imBild && !uhr && !selbst) {
          uhr = setInterval(function () {
            if (document.visibilityState !== 'visible' || !imBild) return;
            weiter();
          }, 5000);
        } else if (!imBild && uhr) { clearInterval(uhr); uhr = null; }
      });
    }, { threshold: 0.3 }).observe(wirt);
  }
})();
