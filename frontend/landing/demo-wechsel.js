/* ═══════════════════════════════════════════════════════════════════════
   demo-wechsel.js · v1577 · Der Wechselschritt — sechs Akte
   ───────────────────────────────────────────────────────────────────────
   Marcel am 23.09.2026: "sollten wir vlt die schnellbewertung mit den 5
   Werten die zum DealScore fuehren angeben, dann die entscheidung lohnt
   oder lohnt nicht und dann weiter ... erst links geht es weiter dann
   erscheint das rechts dann wieder weiter links."

   Die Akte:
     0  SPRECHEN    Mikrofon links, Felder rechts - die Pille fliegt
     1  BEWERTEN    fuenf Werte im Wechsel an der Mittelachse
     2  VERDICHTEN  aus fuenf wird eine Zahl
     3  ENTSCHEIDEN lohnt oder lohnt nicht, mit Gruenden
     4  BELEGEN     woher jede Zahl kommt - amtlich, indikativ, kein Wert
     5  AUSGEBEN    drei Dokumente

   Das Objekt ist erfunden (Lindenallee 14), die Zahlen sind in sich
   gerechnet: Baujahr 1994, GND 80, Stichtag 2026 -> 32 Jahre Alter,
   rechnerisch RND 48, mit neun Modernisierungspunkten 51 im Rahmen
   44-56.

   Der Score 76 ist NICHT gewuerfelt, sondern aus den fuenf Werten
   gewichtet gerechnet - siehe rechnenScore(). Waere er gesetzt, wuerde
   die Szene genau das vorfuehren, was sie behauptet zu widerlegen.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var IKON = {
    mikro: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
    haken: 'M4 12.5l5 5L20 6.5',
    euro: 'M17 5.5A7 7 0 1 0 17 18.5M4 10h8M4 14h8',
    bank: 'M3 10l9-6 9 6M5 10v9M9.7 10v9M14.3 10v9M19 10v9M3 21h18',
    schild: 'M12 3l8 3v6c0 4.4-3.3 8.2-8 9-4.7-.8-8-4.6-8-9V6z',
    pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
    pfeil: 'M5 12h13M13 6l6 6-6 6',
    steig: 'M4 17l5.5-5.5 3.5 3.5L20 8M20 8h-4.5M20 8v4.5',
    waage: 'M12 4v16M5 7h14M5 7l-3 6h6zM19 7l3 6h-6zM8 20h8',
    blatt: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
    lineal: 'M3 8h18v8H3zM7 8v4M11 8v4M15 8v4M19 8v4',
    frage: 'M9.2 9.2a2.9 2.9 0 1 1 3.6 2.8c-.5.2-.8.7-.8 1.2v.8M12 17.5h.01',
    haus: 'M3 11l9-7 9 7M5 9.5V21h14V9.5M10 21v-6h4v6'
  };
  function ik(k, gr, fill) {
    return '<svg viewBox="0 0 24 24" width="' + (gr || 15) + '" height="' + (gr || 15)
      + '" fill="' + (fill || 'none') + '" stroke="currentColor" stroke-width="1.8"'
      + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="' + IKON[k] + '"/></svg>';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  var OBJ = {
    adr: 'Lindenallee 14, 32105 Musterstadt',
    art: 'Eigentumswohnung · 3,5 Zimmer · 82 m² · Baujahr 1994 · 2. OG mit Balkon'
  };

  /* ── Die fünf Werte der Schnellbewertung ─────────────────────────
     Gewichtung wie in DealScore2: 35 / 25 / 20 / 10 / 10. */
  var WERTE = [
    ['euro',   'Rendite',      35, 72, 'Mietrendite 3,5 % · Cashflow +138 €/Monat'],
    ['bank',   'Finanzierung', 25, 86, 'DSCR 1,27 · Zinsbindung 12 Jahre · 22 % EK'],
    ['schild', 'Risiko',       20, 79, 'WEG-Rücklage auskömmlich · kein Sanierungsstau'],
    ['pin',    'Lage & Markt', 10, 71, 'B-Lage · Mietspiegel steigend · Leerstand 1,8 %'],
    ['steig',  'Upside',       10, 63, 'Mietanhebung möglich · Dachgeschoss ausbaubar']
  ];

  /* Der Score wird GERECHNET, nicht gesetzt. */
  function rechnenScore() {
    var s = 0, g = 0;
    WERTE.forEach(function (w) { s += w[2] * w[3]; g += w[2]; });
    return Math.round(s / g);
  }
  var SCORE = rechnenScore();

  /* Die Stufenkette der Haupt-App (js/dashboard.js:390) - dieselben
     Schwellen, damit die Seite nicht ein anderes Wort zeigt als das
     Programm. */
  function stufe(s) {
    return s >= 85 ? 'Top' : s >= 70 ? 'Gut' : s >= 50 ? 'Solide'
      : s >= 35 ? 'Schwach' : 'Kritisch';
  }
  var LOHNT = SCORE >= 70;

  /* ── Sprechlauf: was gesagt wird und wohin es fällt ──────────────── */
  var SATZ = 'Lindenallee vierzehn, dreikommafünf Zimmer, zweiundachtzig '
    + 'Quadratmeter, Baujahr vierundneunzig, Kaufpreis zweihundertneunund'
    + 'achtzigtausend, Kaltmiete achthundertvierzig, Hausgeld zweihundertzehn.';
  var FELDER = [
    ['Kaufpreis', '289.000 €'], ['Wohnfläche', '82 m²'], ['Baujahr', '1994'],
    ['Kaltmiete', '840 €'], ['Hausgeld', '210 €'], ['Zimmer', '3,5']
  ];

  var BELEGE = [
    ['amt', 'haus',   'Bodenrichtwert',    '340 €/m²', 'AMTLICH',
      'BORIS · Stichtag 01.01.2026 · dl-de/by-2-0'],
    ['amt', 'euro',   'Liegenschaftszins', '3,4 %',    'AMTLICH',
      'Gutachterausschuss Musterstadt · GMB 2025, S. 48'],
    ['amt', 'waage',  'Sachwertfaktor',    '1,08',     'AMTLICH',
      'Kalkulator 2026 · Stichprobe 854 Fälle'],
    ['ind', 'lineal', 'Restnutzungsdauer', '51 Jahre', 'ABGELEITET',
      'Anlage 2 ImmoWertV · Rahmen 44–56 Jahre'],
    ['weg', 'frage',  'Vergleichsfaktor',  'kein Wert', 'WEG',
      '→ Ausschuss Musterstadt · Vollbericht kostenpflichtig']
  ];

  /* ── Die sechs Akte ──────────────────────────────────────────────── */
  var AKTE = [
    { k: 'sprechen',   dauer: 9500, uhr: 32,
      ohne: '40 Felder aus vier Unterlagen abtippen', ohneZt: '45 min' },
    { k: 'bewerten',   dauer: 9000, uhr: 44,
      ohne: 'Excel bauen, Formeln prüfen, hoffen',    ohneZt: '2 Std' },
    { k: 'verdichten', dauer: 7000, uhr: 47,
      ohne: 'Fünf Zahlen im Kopf gewichten',          ohneZt: '—' },
    { k: 'entscheiden',dauer: 8000, uhr: 49,
      ohne: 'Bauchgefühl',                            ohneZt: 'unbezifferbar' },
    { k: 'belegen',    dauer: 8000, uhr: 58,
      ohne: 'Gutachterausschuss anschreiben, warten', ohneZt: '3 Tage' },
    { k: 'ausgeben',   dauer: 8000, uhr: 238,
      ohne: 'Bericht layouten, bevor die Bank hinsieht', ohneZt: '55 min' }
  ];
  var N = AKTE.length;

  /* ══════════════════════════════════════════════════════════════════
     Die Szenen
     ══════════════════════════════════════════════════════════════════ */
  function szene(n) {
    var a = AKTE[n];

    if (a.k === 'sprechen') {
      var w = '';
      for (var b = 0; b < 26; b++) w += '<i style="--n:' + b + '"></i>';
      return titel('AKT 1 · ERFASSEN', 'Einmal sprechen. Mehr nicht.',
        'Der Sprechlauf hört mit und trägt ein. Jeder erkannte Wert poppt am '
        + 'Mikrofon auf und fällt in sein Feld.')
        + '<div class="wx-sprech">'
        + '<div class="wx-links"><div class="wx-mik"><div class="wx-mik-k">'
        + '<span class="wx-ring"></span><span class="wx-ring"></span>'
        + '<span class="wx-ring"></span>' + ik('mikro', 28) + '</div>'
        + '<div class="wx-welle">' + w + '</div></div>'
        + '<div class="wx-mitschrift"><span class="wx-tipp"></span>'
        + '<span class="cur"></span></div></div>'
        + '<div class="wx-rechts"><div class="wx-felder">'
        + FELDER.map(function (f, i) {
          return '<div class="wx-feld" data-f="' + i + '">'
            + '<span class="hk">' + ik('haken', 12) + '</span>'
            + '<span class="lb">' + esc(f[0]) + '</span>'
            + '<span class="vl">—</span></div>';
        }).join('') + '</div></div></div>';
    }

    if (a.k === 'bewerten') {
      return titel('AKT 2 · SCHNELLBEWERTUNG', 'Fünf Werte, fünf Gewichte.',
        'Jeder Bereich wird einzeln bewertet und trägt unterschiedlich schwer. '
        + 'Rendite zählt 35 Prozent, Upside nur zehn.')
        + '<div class="wx-werte">' + WERTE.map(function (v, i) {
          var f = v[3] >= 85 ? '#5BD98E' : v[3] >= 70 ? '#3FA56C' : '#C9A84C';
          return '<div class="wx-w ' + (i % 2 ? 're' : 'li') + '" style="--n:' + i + '">'
            + '<div class="karte">'
            + '<span class="ik">' + ik(v[0], 17) + '</span>'
            + '<span><span class="nm">' + esc(v[1]) + '</span>'
            + '<span class="be">' + esc(v[4]) + '</span></span>'
            + '<span class="rechts"><span class="pkt" style="color:' + f + '">'
            + v[3] + '</span><span class="gw">GEWICHT ' + v[2] + ' %</span></span>'
            + '<span class="bar"><i style="--b:' + v[3] + '%;--n:' + i
            + ';background:' + f + '"></i></span>'
            + '</div></div>';
        }).join('') + '</div>';
    }

    if (a.k === 'verdichten') {
      return titel('AKT 3 · VERDICHTUNG', 'Aus fünf Werten wird eine Zahl.',
        'Gewichtet, nicht gemittelt — so schlägt die Finanzierung stärker durch '
        + 'als das Aufwertungspotenzial.')
        + '<div class="wx-score">'
        + '<div class="wx-dial"><svg viewBox="0 0 120 120" aria-hidden="true">'
        + '<defs><linearGradient id="wxG" x1="0" y1="0" x2="1" y2="1">'
        + '<stop offset="0%" stop-color="#E8CC7A"/><stop offset="55%" stop-color="#C9A84C"/>'
        + '<stop offset="100%" stop-color="#b8932f"/></linearGradient></defs>'
        + '<circle class="tr" cx="60" cy="60" r="53"></circle>'
        + '<circle class="pg" cx="60" cy="60" r="53"></circle></svg>'
        + '<div class="wx-dv"><b class="wx-zahl">0</b><small>INVESTOR DEAL SCORE</small></div>'
        + '</div>'
        + '<div class="wx-sum"><span class="lb">SO KOMMT DIE ZAHL ZUSTANDE</span>'
        + '<h4>' + SCORE + ' von 100 — Stufe ' + stufe(SCORE) + '</h4>'
        + '<p>Die Finanzierung trägt den Deal (86 bei 25 Prozent Gewicht), '
        + 'die Rendite ist die Schwachstelle (72 bei 35 Prozent). '
        + 'Alle 24 Kennzahlen stehen dahinter, 21 davon sind belegt.</p>'
        + '<div class="wx-mini">' + WERTE.map(function (v) {
          var f = v[3] >= 85 ? '#5BD98E' : v[3] >= 70 ? '#3FA56C' : '#C9A84C';
          return '<div><b style="color:' + f + '">' + v[3] + '</b><span>'
            + esc(v[1].split(' ')[0].toUpperCase()) + '<br>' + v[2] + ' %</span></div>';
        }).join('') + '</div></div></div>';
    }

    if (a.k === 'entscheiden') {
      var gruende = LOHNT
        ? [['gut', 'haken', 'Kapitaldienst gedeckt',
            'DSCR 1,27 — auch im Stresstest bei 5,5 % bleibt Luft.'],
          ['gut', 'haken', 'Cashflow ab Jahr 1 positiv',
            '+138 € im Monat nach Steuern und nach Rücklage.'],
          ['acht', 'pfeil', 'Achtung: Rendite ist die Schwachstelle',
            '3,5 % Mietrendite — der schwächste der fünf Werte. Die Mietanhebung '
            + 'ist eingepreist, nicht gesichert.']]
        : [['acht', 'pfeil', 'Kapitaldienst reißt im Stresstest', '']];
      return titel('AKT 4 · DIE ENTSCHEIDUNG', LOHNT ? 'Lohnt sich.' : 'Lohnt sich nicht.',
        'Der Score allein entscheidet nicht — er sagt, worauf zu achten ist. '
        + 'Die drei Sätze darunter sind das, was vor der Bank zählt.')
        + '<div class="wx-ent">'
        + '<div class="wx-siegel' + (LOHNT ? '' : ' nein') + '"><div class="in">'
        + '<span class="hk">' + ik(LOHNT ? 'haken' : 'pfeil', 34) + '</span>'
        + '<span class="tx">' + (LOHNT ? 'LOHNT' : 'LOHNT NICHT') + '</span>'
        + '<span class="ut">SCORE ' + SCORE + ' · ' + stufe(SCORE).toUpperCase()
        + '</span></div></div>'
        + '<div class="wx-gruende">' + gruende.map(function (g, i) {
          return '<div class="wx-gr ' + g[0] + '" style="--n:' + i + '">'
            + '<span class="ik">' + ik(g[1], 16) + '</span>'
            + '<span><b>' + esc(g[2]) + '</b>'
            + (g[3] ? '<span>' + esc(g[3]) + '</span>' : '') + '</span></div>';
        }).join('') + '</div></div>';
    }

    if (a.k === 'belegen') {
      return titel('AKT 5 · HERKUNFT', 'Jede Zahl sagt, woher sie kommt.',
        'Drei Sorten, sichtbar getrennt: amtlich aus dem Bericht des Ausschusses, '
        + 'abgeleitet und als solches gekennzeichnet — oder gar nicht vorhanden. '
        + 'Dann steht dort der Weg zur echten Zahl.')
        + '<div class="wx-weiter"><div class="wx-liste">'
        + BELEGE.slice(0, 3).map(beleg).join('') + '</div>'
        + '<div class="wx-liste">' + BELEGE.slice(3).map(function (b, i) {
          return beleg(b, i + 3);
        }).join('')
        + '<div class="wx-gr acht" style="--n:3;margin-top:4px">'
        + '<span class="ik">' + ik('frage', 15) + '</span>'
        + '<span><b>Kein Wert ist auch eine Auskunft</b>'
        + '<span>Im Register geben 181 von 383 Sachwertfaktor-Sätzen genau diese '
        + 'begründete Auskunft statt einer Zahl.</span></span></div>'
        + '</div></div>';
    }

    return titel('AKT 6 · AUSGABE', 'Achtzehn Seiten, bankfähig.',
      'Investment-Case für die Bank, BMF-Anlage fürs Finanzamt, Marktbericht mit '
      + 'Quellennachweis — auf Wunsch im eigenen Logo.')
      + '<div class="wx-weiter"><div class="wx-pdfs">'
      + [['Investment-Case', 'Kennzahlen, Cashflow, Stresstest, Score', '6 Seiten', '03 Bank'],
      ['BMF-Anlage', 'Kaufpreisaufteilung fürs Finanzamt', '4 Seiten', '04 Steuern'],
      ['Marktbericht', 'mit Quellennachweis und Lizenz', '8 Seiten', '05 Bewertung']]
        .map(function (p, i) {
          return '<div class="wx-pdf" style="--n:' + i + '">'
            + '<span class="ik">' + ik('blatt', 18) + '</span>'
            + '<span><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></span>'
            + '<span class="s">' + esc(p[2]) + '<br>→ ' + esc(p[3]) + '</span></div>';
        }).join('') + '</div>'
      + '<div class="wx-gruende">'
      + '<div class="wx-gr gut" style="--n:0"><span class="ik">' + ik('haken', 16) + '</span>'
      + '<span><b>Drei Minuten achtundfünfzig</b><span>vom ersten gesprochenen Wort '
      + 'bis zum fertigen Bankpapier.</span></span></div>'
      + '<div class="wx-gr gut" style="--n:1"><span class="ik">' + ik('haken', 16) + '</span>'
      + '<span><b>Jede Zahl mit Herkunft</b><span>Ausschuss, Jahrgang, Seite und '
      + 'Lizenz stehen im Bericht.</span></span></div>'
      + '<div class="wx-gr gut" style="--n:2"><span class="ik">' + ik('haken', 16) + '</span>'
      + '<span><b>Direkt im Datenraum</b><span>abgelegt in den Unterordnern des '
      + 'Objekts, nicht im Download-Ordner.</span></span></div>'
      + '</div></div>';
  }

  function titel(lb, h, p) {
    return '<div class="wx-titel"><span class="lb">' + esc(lb) + '</span>'
      + '<h3>' + esc(h) + '</h3><p>' + p + '</p></div>';
  }
  function beleg(b, i) {
    return '<div class="wx-li ' + b[0] + '" style="--n:' + i + '">'
      + '<span class="ik">' + ik(b[1], 15) + '</span>'
      + '<span><span class="nm">' + esc(b[2]) + '</span>'
      + '<span class="qu">' + esc(b[5]) + '</span></span>'
      + '<span class="wt">' + esc(b[3]) + '</span>'
      + '<span class="st">' + esc(b[4]) + '</span></div>';
  }

  /* ══════════════════════════════════════════════════════════════════ */
  var wirt = document.querySelector('[data-wechsel]');
  if (!wirt) return;

  wirt.innerHTML = '<div class="wx">'
    + '<div class="wx-streifen"></div>'
    + '<div class="wx-kopf">'
    + '<div class="wx-obj"><b><span class="pin">' + ik('pin', 18) + '</span>'
    + esc(OBJ.adr) + '</b><span>' + esc(OBJ.art) + '</span></div>'
    + '<div class="wx-akt">' + AKTE.map(function (_, i) {
      return '<i data-a="' + i + '"></i>';
    }).join('') + '</div>'
    + '<div class="wx-uhr"><div><b class="wx-zeit">0:00</b>'
    + '<span><span class="wx-tick"></span>LAUFZEIT</span></div></div></div>'
    + '<div class="wx-bahn"><div class="wx-achse"><i></i></div>'
    + '<div class="wx-szene"></div></div>'
    + '<div class="wx-fuss">'
    + '<div class="wx-f ohne"><span class="mk">OHNE</span>'
    + '<span class="tx"></span><span class="zt"></span></div>'
    + '<div class="wx-f mit"><span class="mk">MIT DEALPILOT</span>'
    + '<span class="tx"></span><span class="zt"></span></div></div>'
    + '</div>';

  var bahn = wirt.querySelector('.wx-bahn');
  var buehne = wirt.querySelector('.wx-szene');
  var punkt = wirt.querySelector('.wx-achse i');
  var balken = [].slice.call(wirt.querySelectorAll('.wx-akt i'));
  var zeitN = wirt.querySelector('.wx-zeit');
  var fOhne = wirt.querySelector('.wx-f.ohne'), fMit = wirt.querySelector('.wx-f.mit');

  var n = 0, uhr = null, tikker = null, sekunde = 0, sicht = false, flugUhr = null;

  function zeigZeit(s) {
    zeitN.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function zeige(i, weich) {
    var a = AKTE[i];
    balken.forEach(function (b, k) { b.classList.toggle('da', k <= i); });
    punkt.style.top = (i / (N - 1) * 100) + '%';

    function setzen() {
      clearInterval(flugUhr);
      /* Pillen, die noch unterwegs sind, gehoeren nicht in die naechste
         Szene - sie haengen an der Bahn, nicht an der Buehne, und
         wuerden den Wechsel ueberleben. */
      [].slice.call(bahn.querySelectorAll('.wx-flug')).forEach(function (p) {
        p.remove();
      });
      buehne.classList.remove('wx-raus');
      buehne.innerHTML = szene(i);
      nachziehen(i);
    }
    if (weich) { buehne.classList.add('wx-raus'); setTimeout(setzen, 300); }
    else setzen();

    var von = i ? AKTE[i - 1].uhr : 0, bis = a.uhr, t0 = performance.now();
    clearInterval(tikker);
    (function s(t) {
      var p = Math.min(1, (t - t0) / 900);
      sekunde = Math.round(von + (bis - von) * (1 - Math.pow(1 - p, 3)));
      zeigZeit(sekunde);
      if (p < 1) requestAnimationFrame(s);
      else tikker = setInterval(function () { zeigZeit(++sekunde); }, 1000);
    })(t0);

    fOhne.querySelector('.tx').textContent = a.ohne;
    fOhne.querySelector('.zt').textContent = a.ohneZt;
    fMit.querySelector('.tx').textContent =
      (buehne.querySelector('.wx-titel h3') || {}).textContent || '';
    fMit.querySelector('.zt').textContent =
      Math.floor(a.uhr / 60) + ':' + ('0' + (a.uhr % 60)).slice(-2);
  }

  function nachziehen(i) {
    var a = AKTE[i];

    /* ── Akt 1: tippen, dann Pillen fliegen lassen ─────────────────── */
    if (a.k === 'sprechen') {
      var ziel = buehne.querySelector('.wx-tipp');
      var worte = SATZ.split(' '), k = 0;
      var t = setInterval(function () {
        if (!ziel.isConnected) { clearInterval(t); return; }
        ziel.textContent = worte.slice(0, ++k).join(' ');
        if (k >= worte.length) { clearInterval(t); fliegen(); }
      }, 78);
    }

    /* ── Akt 3: Ring und Zahl ──────────────────────────────────────── */
    if (a.k === 'verdichten') {
      var ring = buehne.querySelector('.wx-dial .pg');
      var zahl = buehne.querySelector('.wx-zahl');
      if (ring) setTimeout(function () {
        ring.style.strokeDashoffset = 333 - 333 * (SCORE / 100);
      }, 60);
      if (zahl) { var t0 = performance.now();
        (function s(t) {
          var p = Math.min(1, (t - t0) / 1500);
          zahl.textContent = Math.round(SCORE * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(s);
        })(t0);
      }
    }
  }

  /* Die Pille poppt am Mikrofon auf und fliegt in ihr Feld.
     Die Strecke wird GEMESSEN, nicht gesetzt: sie haengt von der
     Spaltenbreite ab und ist auf jedem Schirm anders. */
  function fliegen() {
    var mik = buehne.querySelector('.wx-mik-k');
    var felder = [].slice.call(buehne.querySelectorAll('.wx-feld'));
    if (!mik || !felder.length) return;
    var i = 0;
    flugUhr = setInterval(function () {
      if (!mik.isConnected || i >= FELDER.length) { clearInterval(flugUhr); return; }
      var f = FELDER[i], feld = felder[i];
      var vonR = mik.getBoundingClientRect();
      var zuR = feld.getBoundingClientRect();
      var bahnR = bahn.getBoundingClientRect();

      var pille = document.createElement('span');
      pille.className = 'wx-flug';
      pille.innerHTML = ikSmall() + esc(f[0]) + ' <b>' + esc(f[1]) + '</b>';
      pille.style.left = (vonR.left - bahnR.left + vonR.width / 2) + 'px';
      pille.style.top = (vonR.top - bahnR.top + vonR.height / 2 - 14) + 'px';
      bahn.appendChild(pille);
      pille.classList.add('start');
      var dx = (zuR.left - bahnR.left + 26) - parseFloat(pille.style.left);
      var dy = (zuR.top - bahnR.top + zuR.height / 2 - 14) - parseFloat(pille.style.top);

      /* DAS ERGEBNIS HAENGT NICHT AN DER ANIMATION.
         Gemessen am 23.09.2026: die Flugkette lag in zwei
         verschachtelten requestAnimationFrame. Im Hintergrund-Tab
         feuert rAF nie - die Pillen poppten auf, blieben am Mikrofon
         liegen, und die Felder wurden NIE gefuellt. Der Zustand steckte
         in der Animation fest.
         Jetzt setzt ein eigener Timer das Feld, komme was wolle; der
         Flug ist nur noch Schmuck davor. setTimeout wird im
         Hintergrund gedrosselt, aber es laeuft. */
      setTimeout(function () {
        pille.classList.remove('start');
        pille.classList.add('fliegt');
        pille.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.85)';
      }, 340);
      setTimeout(function () {
        feld.classList.add('voll');
        feld.querySelector('.vl').textContent = f[1];
        if (pille.parentNode) pille.remove();
      }, 950);
      i++;
    }, 980);
  }
  function ikSmall() {
    return '<svg viewBox="0 0 24 24" width="12" height="12" fill="none"'
      + ' stroke="currentColor" stroke-width="2.4" stroke-linecap="round"'
      + ' stroke-linejoin="round" aria-hidden="true"><path d="'
      + IKON.haken + '"/></svg>';
  }

  function schritt() { n = (n + 1) % N; zeige(n, true); }
  function an() {
    if (uhr || !sicht || document.visibilityState !== 'visible') return;
    uhr = setInterval(function () {
      clearInterval(uhr); uhr = null; schritt(); an();
    }, AKTE[n].dauer);
  }
  function aus() {
    clearInterval(uhr); uhr = null; clearInterval(flugUhr); clearInterval(tikker);
  }

  zeige(0, false);
  new IntersectionObserver(function (es) {
    sicht = es[0].isIntersecting;
    if (sicht) an(); else aus();
  }, { threshold: .2 }).observe(wirt);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') an(); else aus();
  });
  wirt.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-a]');
    if (!t) return;
    aus(); n = +t.getAttribute('data-a'); zeige(n, true);
  });
})();
