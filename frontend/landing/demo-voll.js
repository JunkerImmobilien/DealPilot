/* ═══════════════════════════════════════════════════════════════════════
   demo-voll.js · v1572 · Fünf vollständige Fassungen, EINE Datenquelle
   ───────────────────────────────────────────────────────────────────────
   Alle fünf Fassungen lesen aus DATEN unten. Das ist Absicht: verglichen
   werden soll die Form, nicht der Umfang. Wenn eine Fassung inhaltlich
   dünner wirkt als eine andere, liegt es an ihrer Bauart — nicht daran,
   dass ich ihr weniger mitgegeben habe.

   Die Zahlen sind ein erfundenes Musterobjekt (Musterweg 12), keine
   echte Anschrift: Marcel am 23.09.2026 zur Hermannstraße "das muss
   natürlich raus".
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Das Musterobjekt ────────────────────────────────────────────── */
  var OBJ = {
    adr: 'Musterweg 12, 32105 Musterstadt',
    art: 'ETW · 3 Zimmer · 78 m² · Bj 1994',
    kp: '285.000 €', score: 74, stufe: 'Gut'
  };

  /* ── Die vier Stationen ──────────────────────────────────────────── */
  var DATEN = [
    {
      k: 'erfassen', sym: '◉', t: 'Erfassen', schritt: 'Schritt 1 · 30 Sekunden',
      kopf: 'Sprechen statt tippen.',
      satz: 'Exposé-PDF rein oder ins Mikrofon sprechen — DealPilot liest '
        + 'Kaufpreis, Fläche, Baujahr, Miete und Hausgeld selbst heraus. '
        + 'Der Sprechlauf fragt nur noch nach, was fehlt.',
      punkte: [
        'PDF-Import erkennt 14 Felder aus dem Exposé',
        'Sprechlauf: 24 geführte Fragen, jede überspringbar',
        'Quick-Check vor Ort am Handy — Voreinstellungen greifen',
        'Fehlt etwas, steht dort der Marktwert statt einer Lücke'
      ],
      kontrast: ['Ohne DealPilot:', '40 Felder abtippen, aus vier Unterlagen zusammengesucht'],
      /* für die Karte in V1 */
      klbl: 'Aufnahme läuft', kgross: '14 / 14', ksub: 'Felder erkannt<br>Exposé_Musterweg12.pdf',
      kzeilen: [['Kaufpreis', '285.000 €'], ['Wohnfläche', '78 m²'], ['Baujahr', '1994'], ['Kaltmiete', '780 €']],
      fort: 25,
      /* für V3 */
      feld: ['OBJEKT', '78 m²'],
      /* für V5 */
      zeit: '0:30', vgl: ['Sonst dafür:', '45 Minuten'],
      erg: [['◉', 'Exposé eingelesen', '14 von 14 Feldern erkannt, nichts nachgetippt'],
      ['♪', 'Sprechlauf beendet', 'Hausgeld und Rücklage mündlich ergänzt'],
      ['◈', 'Objekt steht', 'Musterweg 12 · ETW 78 m² · Bj 1994']]
    },
    {
      k: 'rechnen', sym: '◆', t: 'Rechnen', schritt: 'Schritt 2 · 10 Sekunden',
      kopf: '24 Kennzahlen. Eine Zahl.',
      satz: 'Rendite, Finanzierung, Risiko, Lage und Upside werden einzeln '
        + 'bewertet und zu einem Score verdichtet. Sechs Profile — wer auf '
        + 'Cashflow schaut, bekommt eine andere Gewichtung als wer auf Sicherheit schaut.',
      punkte: [
        'Deal Score 2.0 aus 24 Kennzahlen, Gewichtung 35/25/20/10/10',
        'DSCR, Kapitaldienstfähigkeit und Anschluss-Stresstest',
        'Cashflow nach Steuern über die volle Haltedauer',
        'Sechs Profile: Ausgewogen bis Sicherheit — umschaltbar'
      ],
      kontrast: ['Ohne DealPilot:', 'Eine Excel, die niemand außer dem Ersteller prüfen kann'],
      klbl: 'Investor Deal Score', kgross: '74 <small style="font:500 13px var(--mono);color:var(--mut)">/100</small>',
      ksub: '◆ Gut · 21 von 24 Kennzahlen belegt',
      kzeilen: [['Rendite', '71'], ['Finanzierung', '84'], ['Risiko', '76'], ['Lage & Markt', '68']],
      fort: 50,
      feld: ['SCORE', '74'],
      zeit: '0:40', vgl: ['Sonst dafür:', '2 Stunden Excel'],
      erg: [['◆', 'Deal Score 74 · Gut', 'Finanzierung trägt, Rendite ist die Schwachstelle'],
      ['↗', 'DSCR 1,24', 'Kapitaldienst gedeckt — auch im Stresstest bei 5,5 %'],
      ['€', 'Cashflow +112 €/Monat', 'nach Steuern, nach Rücklage, ab Jahr 1']]
    },
    {
      k: 'belegen', sym: '⚖', t: 'Belegen', schritt: 'Schritt 3 · automatisch',
      kopf: 'Jede Zahl mit Herkunft.',
      satz: 'Restnutzungsdauer nach Anlage 2 ImmoWertV, Liegenschaftszins und '
        + 'Sachwertfaktor vom zuständigen Gutachterausschuss, Bodenrichtwert '
        + 'mit Stichtag. Wo keine amtliche Zahl vorliegt, steht dort der Weg dorthin.',
      punkte: [
        'Restnutzungsdauer nach Anlage 2 — mit Modernisierungspunkten',
        'Ertrags-, Sach- und Vergleichswert nach ImmoWertV',
        'Liegenschaftszins und Sachwertfaktor vom Ausschuss, mit Jahrgang',
        'Quellennachweis mit Lizenz und Stichtag im Bericht'
      ],
      kontrast: ['Ohne DealPilot:', 'Zahlen, die vor der Bank niemand belegen kann'],
      klbl: 'Quellennachweis', kgross: '3 / 3', ksub: 'amtliche Quellen zugeordnet',
      kzeilen: [['Restnutzungsdauer', '48 J.'], ['Liegenschaftszins', '3,4 %'], ['Bodenrichtwert', '340 €/m²'], ['Sachwertfaktor', '1,08']],
      fort: 75,
      feld: ['BELEGT', '3 Quellen'],
      zeit: '0:45', vgl: ['Sonst dafür:', '3 Behördenanfragen'],
      erg: [['⚖', 'RND 48 Jahre', 'Anlage 2 ImmoWertV · Bj 1994, 9 Modernisierungspunkte'],
      ['§', 'Liegenschaftszins 3,4 %', 'Gutachterausschuss Musterstadt · GMB 2025, S. 48'],
      ['⌗', 'Bodenrichtwert 340 €/m²', 'BORIS · Stichtag 01.01.2026 · dl-de/by-2-0']]
    },
    {
      k: 'ausgeben', sym: '⎘', t: 'Ausgeben', schritt: 'Schritt 4 · ein Klick',
      kopf: 'Sechs Seiten, bankfähig.',
      satz: 'Investment-Case für die Bank, BMF-Anlage fürs Finanzamt, '
        + 'Marktbericht mit Quellennachweis. Auf Wunsch im eigenen Logo — '
        + 'oder direkt in den Datenraum des Objekts.',
      punkte: [
        'Investment-Case: 6 Seiten, Kennzahlen, Cashflow, Stresstest',
        'BMF-Anlage zur Kaufpreisaufteilung — Formularlogik abgebildet',
        'Marktbericht mit Quellennachweis, Lizenz und Stichtag',
        'Whitelabel: eigenes Logo, eigene Farbe, eigene Fußzeile'
      ],
      kontrast: ['Ohne DealPilot:', 'Ein Abend Layout, bevor die Bank überhaupt hinsieht'],
      klbl: 'Ausgabe bereit', kgross: '3 PDF', ksub: '18 Seiten · mit Quellennachweis',
      kzeilen: [['Investment-Case', '6 S.'], ['BMF-Anlage', '4 S.'], ['Marktbericht', '8 S.'], ['Erzeugt in', '2,1 s']],
      fort: 100,
      feld: ['AUSGABE', '3 PDF'],
      zeit: '4:00', vgl: ['Sonst dafür:', '3 Stunden'],
      erg: [['⎘', 'Investment-Case', '6 Seiten · Kennzahlen, Cashflow, Stresstest, Score'],
      ['◫', 'BMF-Anlage', '4 Seiten · Kaufpreisaufteilung fürs Finanzamt'],
      ['⌘', 'Marktbericht', '8 Seiten · mit Quellennachweis und Lizenz']]
    }
  ];

  var N = DATEN.length;
  /* Fährt die Uhr in V5 hoch: Sekunden je Station, aufsummiert. */
  var UHR = [30, 40, 45, 240];

  /* ── Werkzeug ────────────────────────────────────────────────────── */
  function el(sel, w) { return (w || document).querySelector(sel); }
  function alle(sel, w) { return [].slice.call((w || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* Zahlen hochlaufen lassen. Zieht die Ziffern aus dem Text und
     behält alles drumherum - "285.000 €" bleibt "285.000 €". */
  function hoch(node, ziel, ms) {
    var m = String(ziel).match(/[\d.,]+/);
    if (!m) { node.innerHTML = ziel; return; }
    var roh = m[0], dez = roh.indexOf(',') >= 0;
    var z = parseFloat(roh.replace(/\./g, '').replace(',', '.'));
    if (!isFinite(z)) { node.innerHTML = ziel; return; }
    var t0 = performance.now();
    (function s(t) {
      var p = Math.min(1, (t - t0) / (ms || 900));
      var e = 1 - Math.pow(1 - p, 3), v = z * e;
      var txt = dez ? v.toFixed(1).replace('.', ',')
        : Math.round(v).toLocaleString('de-DE');
      node.innerHTML = String(ziel).replace(roh, txt);
      if (p < 1) requestAnimationFrame(s);
    })(t0);
  }

  /* ══════════════════════════════════════════════════════════════════
     FASSUNG 1 · DIE REISE
     ══════════════════════════════════════════════════════════════════ */
  function bauV1(wirt) {
    wirt.innerHTML = '<div class="v1">'
      + '<div class="v1-weg">' + DATEN.map(function (d, i) {
        return '<div class="v1-st" data-i="' + i + '"><b>' + d.sym + ' ' + d.t + '</b>'
          + '<span>' + esc(d.schritt) + '</span></div>';
      }).join('') + '</div>'
      + '<div class="v1-buehne"><div class="v1-txt"></div>'
      + '<div class="v1-karte"><div class="v1-k-band"><span>DEALPILOT · PRE-FLIGHT</span>'
      + '<span class="v1-k-nr">' + esc(OBJ.adr.split(',')[0].toUpperCase()) + '</span></div>'
      + '<div class="v1-k-body"></div><div class="v1-k-fort"><i></i></div></div>'
      + '</div></div>';

    var txt = el('.v1-txt', wirt), body = el('.v1-k-body', wirt);
    var fort = el('.v1-k-fort i', wirt), sts = alle('.v1-st', wirt);

    return function (i) {
      var d = DATEN[i];
      sts.forEach(function (s, n) {
        s.classList.toggle('on', n === i);
        s.classList.toggle('fertig', n < i);
      });
      txt.innerHTML = '<h3>' + esc(d.kopf) + '</h3><p>' + d.satz + '</p>'
        + '<div class="v1-liste">' + d.punkte.map(function (p, n) {
          return '<div class="v1-li" style="--n:' + n + '"><i>›</i><span>' + esc(p) + '</span></div>';
        }).join('') + '</div>'
        + '<div class="v1-kontrast"><b>' + esc(d.kontrast[0]) + '</b>'
        + '<span>' + esc(d.kontrast[1]) + '</span></div>';

      body.innerHTML = '<div class="v1-k-stand on">'
        + '<div class="v1-k-lbl">' + esc(d.klbl) + '</div>'
        + '<div class="v1-k-gross glanz">' + d.kgross + '</div>'
        + '<div class="v1-k-sub">' + d.ksub + '</div>'
        + '<div class="v1-k-zeilen">' + d.kzeilen.map(function (z, n) {
          return '<div class="v1-k-z" style="opacity:0;animation:vAuf .45s var(--e-hoch) '
            + (0.25 + n * 0.11) + 's forwards"><span>' + esc(z[0]) + '</span>'
            + '<b data-ziel="' + esc(z[1]) + '">' + esc(z[1]) + '</b></div>';
        }).join('') + '</div></div>';
      alle('[data-ziel]', body).forEach(function (n, k) {
        n.innerHTML = '&nbsp;';
        setTimeout(function () { hoch(n, n.getAttribute('data-ziel'), 700); }, 300 + k * 110);
      });
      fort.style.width = d.fort + '%';
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     FASSUNG 2 · VORHER / NACHHER
     ══════════════════════════════════════════════════════════════════ */
  function bauV2(wirt) {
    wirt.innerHTML = '<div class="v2">'
      + '<div class="v2-seite v2-alt"><div class="v2-kopf"><span class="mk">OHNE</span>'
      + '<b>Wie es heute läuft</b></div><div class="v2-inhalt-a"></div>'
      + '<div class="v2-summe"><span>ZEITAUFWAND</span><b>3:00 h</b></div></div>'
      + '<div class="v2-mitte">→</div>'
      + '<div class="v2-seite v2-neu"><div class="v2-kopf"><span class="mk">MIT DEALPILOT</span>'
      + '<b>Wie es laufen kann</b></div><div class="v2-inhalt-n"></div>'
      + '<div class="v2-summe"><span>ZEITAUFWAND</span><b>4:00 min</b></div></div></div>';

    var a = el('.v2-inhalt-a', wirt), n = el('.v2-inhalt-n', wirt);
    var ALT = [
      ['40 Felder aus vier Unterlagen abtippen', '45 min'],
      ['Excel bauen, Formeln prüfen', '60 min'],
      ['Restnutzungsdauer nachschlagen', '20 min'],
      ['Gutachterausschuss anschreiben', '3 Tage'],
      ['Bericht layouten, bevor die Bank hinsieht', '55 min']
    ];

    return function (i) {
      a.innerHTML = ALT.slice(0, i + 1).map(function (z, k) {
        return '<div class="v2-zeile" style="opacity:0;animation:vAuf .5s var(--e-hoch) '
          + (k * 0.09) + 's forwards"><span>' + esc(z[0]) + '</span><b>' + esc(z[1]) + '</b></div>';
      }).join('');
      n.innerHTML = DATEN.slice(0, i + 1).map(function (d, k) {
        return '<div class="v2-zeile" style="opacity:0;animation:vAuf .5s var(--e-hoch) '
          + (0.15 + k * 0.09) + 's forwards"><span>' + d.sym + ' ' + esc(d.kopf) + '</span>'
          + '<b>' + esc(d.zeit) + '</b></div>'
          + (k === i ? '<div class="v2-zeile" style="border:0;opacity:0;animation:vAuf .5s var(--e-hoch) .3s forwards">'
            + '<span style="font-size:12px;color:var(--ddk)">' + esc(d.punkte[0]) + '</span></div>' : '');
      }).join('');
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     FASSUNG 3 · BOARDING-PASS MIT LANDEBAHN
     ══════════════════════════════════════════════════════════════════ */
  function bauV3(wirt) {
    var bc = '';
    for (var b = 0; b < 26; b++) bc += '<i style="height:' + (9 + (b * 7 % 19)) + 'px"></i>';

    wirt.innerHTML = '<div class="v3">'
      + '<div class="v3-bahn"><i></i><span class="v3-flug">✈</span></div>'
      + '<div class="v3-halt">' + DATEN.map(function (d, i) {
        return '<div class="v3-h" data-i="' + i + '"><b>' + d.sym + ' ' + d.t + '</b>'
          + '<span>' + esc(d.schritt) + '</span></div>';
      }).join('') + '</div>'
      + '<div class="v3-pass"><div class="v3-p-links">'
      + '<div class="v3-p-kopf"><span class="mk">DealPilot · Boarding Pass</span>'
      + '<span class="nr">' + esc(OBJ.adr) + ' · ' + esc(OBJ.art) + '</span></div>'
      + '<div class="v3-felder">' + DATEN.map(function (d, i) {
        return '<div class="v3-f" data-i="' + i + '"><span class="t">' + esc(d.feld[0]) + '</span>'
          + '<span class="w">' + esc(d.feld[1]) + '</span>'
          + '<span class="stempel">GEPRÜFT</span></div>';
      }).join('') + '</div>'
      + '<div class="v3-satz" style="margin-top:14px;font-size:12.8px;color:var(--mut);min-height:38px"></div>'
      + '</div>'
      + '<div class="v3-p-rechts"><span class="lb">INVESTOR<br>DEAL SCORE</span>'
      + '<span class="gr">' + OBJ.score + '</span>'
      + '<div class="v3-bc">' + bc + '</div></div></div></div>';

    var bahn = el('.v3-bahn i', wirt), flug = el('.v3-flug', wirt);
    var hs = alle('.v3-h', wirt), fs = alle('.v3-f', wirt), satz = el('.v3-satz', wirt);

    return function (i) {
      var p = (i + 1) / N * 100;
      bahn.style.width = p + '%';
      flug.style.left = p + '%';
      hs.forEach(function (h, n) { h.classList.toggle('on', n === i); });
      fs.forEach(function (f, n) { f.classList.toggle('on', n <= i); });
      satz.innerHTML = '<b style="color:var(--ink)">' + esc(DATEN[i].kopf) + '</b> '
        + DATEN[i].satz;
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     FASSUNG 4 · DAS COCKPIT
     ══════════════════════════════════════════════════════════════════ */
  function bauV4(wirt) {
    var KACHEL = [
      ['DEAL SCORE', '74', 'gd', 74], ['DSCR', '1,24', 'gr', 82],
      ['CASHFLOW', '+112 €', 'gr', 66], ['RENDITE', '4,1 %', '', 58],
      ['KENNZAHLEN', '24', 'gd', 100], ['BELEGT', '21/24', 'gr', 88],
      ['RND', '48 J.', '', 60], ['LIEGENSCHAFTSZINS', '3,4 %', '', 68]
    ];
    var h = [38, 52, 44, 61, 55, 72, 66, 81, 74, 88, 83, 95];

    wirt.innerHTML = '<div class="v4">'
      + '<div class="v4-kopf"><span class="tt">' + esc(OBJ.adr) + ' · ' + esc(OBJ.art) + '</span>'
      + '<span class="st"><i class="leuchte"></i><span class="v4-st">ERFASSUNG LÄUFT</span></span></div>'
      + '<div class="v4-raster">' + KACHEL.map(function (k, n) {
        return '<div class="v4-i blink" style="--d:' + (n * 0.35) + 's">'
          + '<span class="lbl">' + esc(k[0]) + '</span>'
          + '<span class="wert ' + k[2] + '" data-ziel="' + esc(k[1]) + '">' + esc(k[1]) + '</span>'
          + '<span class="bar" style="--n:' + n + ';--b:' + k[3] + '%"><i></i></span></div>';
      }).join('') + '</div>'
      + '<div class="v4-unten">'
      + '<div class="v4-chart"><span class="lbl">CASHFLOW NACH STEUERN · 12 JAHRE</span>'
      + '<div class="v4-balken">' + h.map(function (v, n) {
        return '<i style="--h:' + v + '%;--n:' + n + '"></i>';
      }).join('') + '</div></div>'
      + '<div class="v4-log"></div></div></div>';

    alle('[data-ziel]', wirt).forEach(function (n, k) {
      var z = n.getAttribute('data-ziel'); n.innerHTML = '&nbsp;';
      setTimeout(function () { hoch(n, z, 900); }, 200 + k * 90);
    });

    var log = el('.v4-log', wirt), st = el('.v4-st', wirt);
    return function (i) {
      st.textContent = DATEN[i].t.toUpperCase() + ' · ' + DATEN[i].schritt.toUpperCase();
      var zs = [];
      DATEN.slice(0, i + 1).forEach(function (d) {
        zs.push(['ok', d.sym + ' ' + d.t + ' — ' + d.kopf]);
        d.erg.forEach(function (e) { zs.push(['', '  ' + e[1] + ' · ' + e[2]]); });
      });
      zs = zs.slice(-9);
      log.innerHTML = zs.map(function (z, n) {
        return '<div class="' + z[0] + '" style="--n:' + n + '">' + esc(z[1]) + '</div>';
      }).join('');
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     FASSUNG 5 · DIE UHR
     ══════════════════════════════════════════════════════════════════ */
  function bauV5(wirt) {
    wirt.innerHTML = '<div class="v5">'
      + '<div class="v5-uhr"><div class="v5-ring">'
      + '<svg viewBox="0 0 160 160"><circle class="tr" cx="80" cy="80" r="72"></circle>'
      + '<circle class="pg" cx="80" cy="80" r="72"></circle></svg>'
      + '<div class="v5-zeit"><b class="v5-t">0:00</b><span>MINUTEN</span></div></div>'
      + '<div class="v5-vgl"><span class="v5-v1">Sonst dafür:</span><b class="v5-v2">—</b></div></div>'
      + '<div class="v5-inhalt"><h3></h3><p></p><div class="v5-erg"></div></div></div>';

    var pg = el('.v5-ring .pg', wirt), tt = el('.v5-t', wirt);
    var v1 = el('.v5-v1', wirt), v2 = el('.v5-v2', wirt);
    var h3 = el('.v5-inhalt h3', wirt), p = el('.v5-inhalt > p', wirt);
    var erg = el('.v5-erg', wirt);

    return function (i) {
      var d = DATEN[i];
      pg.style.strokeDashoffset = 452 - 452 * ((i + 1) / N);
      /* Die Uhr zählt auf die Gesamtzeit dieser Station hoch. */
      var ziel = UHR[i], t0 = performance.now(), von = i ? UHR[i - 1] : 0;
      (function s(t) {
        var q = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - q, 3);
        var sek = Math.round(von + (ziel - von) * e);
        tt.textContent = Math.floor(sek / 60) + ':' + ('0' + (sek % 60)).slice(-2);
        if (q < 1) requestAnimationFrame(s);
      })(t0);
      v1.textContent = d.vgl[0]; v2.textContent = d.vgl[1];
      h3.textContent = d.kopf; p.innerHTML = d.satz;
      erg.innerHTML = d.erg.map(function (e, n) {
        return '<div class="v5-e" style="--n:' + n + '"><span class="ik">' + e[0] + '</span>'
          + '<span><b>' + esc(e[1]) + '</b><span>' + esc(e[2]) + '</span></span></div>';
      }).join('');
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     Antrieb: jede Fassung läuft für sich, aber nur wenn sie sichtbar
     ist und der Reiter vorn liegt.
     Grund (FALLEN.md): im Hintergrund-Tab feuert requestAnimationFrame
     nie und Timer werden auf ~1 s gedrosselt - eine Messung dort misst
     das Werkzeug, nicht die Seite.
     ══════════════════════════════════════════════════════════════════ */
  var BAUER = { v1: bauV1, v2: bauV2, v3: bauV3, v4: bauV4, v5: bauV5 };

  alle('[data-fassung]').forEach(function (wirt) {
    var zeige = BAUER[wirt.getAttribute('data-fassung')](wirt);
    var i = 0, uhr = null, sicht = false;
    zeige(0);

    function schritt() { i = (i + 1) % N; zeige(i); }
    function an() {
      if (uhr || !sicht || document.visibilityState !== 'visible') return;
      uhr = setInterval(schritt, 4200);
    }
    function aus() { clearInterval(uhr); uhr = null; }

    new IntersectionObserver(function (es) {
      sicht = es[0].isIntersecting; sicht ? an() : aus();
    }, { threshold: .25 }).observe(wirt);
    document.addEventListener('visibilitychange', function () {
      document.visibilityState === 'visible' ? an() : aus();
    });

    /* Klick hält an und springt - wer selbst steuert, will nicht
       weitergeschoben werden. */
    wirt.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-i]');
      if (!t) return;
      aus(); i = +t.getAttribute('data-i'); zeige(i);
    });
  });
})();
