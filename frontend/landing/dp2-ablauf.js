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
  function szene(i) {
    if (i === 0) {
      var woerter = ["Hermannstraße 9", "165 m²", "Baujahr 1968", "740 € kalt", "ETW"];
      var chips = woerter.map(function (w, n) {
        var winkel = (n / woerter.length) * 2 * Math.PI - Math.PI / 2;
        var x = 50 + Math.cos(winkel) * 34, y = 50 + Math.sin(winkel) * 32;
        return '<span class="sz-chip" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1)
          + '%;animation-delay:' + (n * 1.1).toFixed(1) + 's"><i class="ck" style="animation-delay:'
          + (n * 1.1).toFixed(1) + 's">✓</i>' + w + '</span>';
      }).join("");
      return '<div class="sz-ringe"><i></i><i></i><i></i></div>' + chips
        + '<span class="sz-mic"><svg class="ico"><use href="#i-mikro"/></svg></span>';
    }
    if (i === 1) {
      var zeilen = [["Bruttorendite", "7,30 %", ""], ["Cashflow / Monat", "+ 1.240 €", "gr"],
        ["Kapitaldienstdeckung", "1,42", ""], ["Beleihungsauslauf", "88 %", ""],
        ["Steuerwirkung / Jahr", "− 2.180 €", "gr"]];
      return '<div class="sz-zahlen">' + zeilen.map(function (z, n) {
        return '<div class="sz-z" style="--n:' + n + '"><span>' + z[0]
          + '</span><b class="' + z[2] + '">' + z[1] + '</b></div>';
      }).join("") + '</div>';
    }
    if (i === 2) {
      return '<div class="sz-score"><svg viewBox="0 0 150 150" aria-hidden="true">'
        + '<circle class="tr" cx="75" cy="75" r="65"></circle>'
        + '<circle class="pg" cx="75" cy="75" r="65"></circle></svg>'
        + '<div class="mitte">87</div>'
        + '<span class="sz-marke">◆ SEHR GUT · 23 VON 24 KPIs</span></div>';
    }
    var hoehen = [46, 72, 58, 88, 64, 95];
    return '<div class="sz-pdf">'
      + '<span class="sz-blatt" style="--n:0"></span>'
      + '<span class="sz-blatt" style="--n:1"></span>'
      + '<span class="sz-blatt top" style="--n:2"><i class="bk"></i>'
      + '<i class="zl m"></i><i class="zl k"></i><i class="zl m"></i>'
      + '<span class="chart">' + hoehen.map(function (h, n) {
          return '<i style="--h:' + h + '%;--n:' + n + '"></i>';
        }).join("") + '</span></span>'
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
