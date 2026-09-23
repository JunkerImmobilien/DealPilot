/* ═══════════════════════════════════════════════════════════════════════
   demo-wechsel.js · v1577 · Der Wechselschritt — sechs Akte
   ───────────────────────────────────────────────────────────────────────
   Marcel am 23.09.2026: "sollten wir vlt die schnellbewertung mit den 5
   Werten die zum DealScore fuehren angeben, dann die entscheidung lohnt
   oder lohnt nicht und dann weiter ... erst links geht es weiter dann
   erscheint das rechts dann wieder weiter links."

   Die acht Stufen des Rechenwegs, nacheinander:
     1 ERFASSEN     Mikrofon links, Felder rechts - die Pille fliegt
     2 INDIKATION   die grobe Spanne, bevor gerechnet wird
     3 AUFTEILUNG   Boden gegen Gebaeude, mit dem 20-%-Abschlag
     4 NUTZUNGSDAUER der Rahmen als REGLER - er faehrt, man uebernimmt
     5 ABSCHREIBUNG was die Wahl je Jahr bedeutet
     6 VERKEHRSWERT ein Verfahren gewaehlt, eines verworfen
     7 FINANZIERUNG Marktzins als Indikation
     8 ENTSCHEIDUNG der Kipppunkt: ohne Optimierung gegen mit

   Alle Zahlen kommen aus demo-steuer-daten.js - dieselbe Rechenbasis
   wie die vier statischen Fassungen auf demo-steuer.html. Zwei
   Darstellungen, eine Quelle.

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

  /* Die Rechenbasis ist dieselbe wie bei den vier statischen Fassungen
     (demo-steuer-daten.js). Zwei Darstellungen, eine Quelle - wenn hier
     eine Zahl anders aussieht als dort, ist es ein Darstellungsfehler. */
  var S = window.DP_STEUER;
  if (!S) { return; }
  var eur = S.eur, proz = S.proz, zahl = S.zahl;

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
    haus: 'M3 11l9-7 9 7M5 9.5V21h14V9.5M10 21v-6h4v6',
    hand: 'M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v5a5 5 0 0 1-5 5h-1.6a5 5 0 0 1-3.9-1.9L6 16.5a1.6 1.6 0 0 1 2.4-2.1L9 15',
    stift: 'M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z',
    kreuz: 'M6 6l12 12M18 6L6 18'
  };
  function ik(k, gr, fill) {
    return '<svg viewBox="0 0 24 24" width="' + (gr || 15) + '" height="' + (gr || 15)
      + '" fill="' + (fill || 'none') + '" stroke="currentColor" stroke-width="1.8"'
      + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="' + IKON[k] + '"/></svg>';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  var OBJ = { adr: S.O.adr, art: S.O.art };

  /* ── Sprechlauf: was gesagt wird und wohin es fällt ──────────────── */
  var SATZ = 'Lindenallee vierzehn, dreikommafünf Zimmer, zweiundachtzig '
    + 'Quadratmeter, Baujahr vierundneunzig, Kaufpreis zweihundertneunund'
    + 'achtzigtausend, Kaltmiete achthundertvierzig, Hausgeld zweihundertzehn.';
  var FELDER = [
    ['Kaufpreis', '289.000 €'], ['Wohnfläche', '82 m²'], ['Baujahr', '1994'],
    ['Kaltmiete', '840 €'], ['Hausgeld', '210 €'], ['Zimmer', '3,5']
  ];

  /* ── Die acht Akte: der ganze Rechenweg, nacheinander ──────────────
     Dieselben Stufen wie in den vier statischen Fassungen, nur laufen
     sie hier ab statt untereinander zu stehen. */
  var AKTE = [
    { k: 'sprechen',   dauer: 10000, uhr: 32,
      ohne: '40 Felder aus vier Unterlagen abtippen',     ohneZt: '45 min' },
    { k: 'indikation', dauer: 7000,  uhr: 38,
      ohne: 'Im Portal nach Vergleichspreisen suchen',    ohneZt: '25 min' },
    { k: 'aufteilung', dauer: 10000, uhr: 52,
      ohne: 'Bodenwert schätzen und hoffen',              ohneZt: 'Streit mit dem Finanzamt' },
    { k: 'nutzung',    dauer: 12000, uhr: 64,
      ohne: 'Pauschal 50 Jahre ansetzen',                 ohneZt: 'ungeprüft' },
    { k: 'afa',        dauer: 8500,  uhr: 71,
      ohne: 'Regel-AfA 2 %, ohne nachzurechnen',          ohneZt: '—' },
    { k: 'wert',       dauer: 11000, uhr: 95,
      ohne: 'Gutachterausschuss anschreiben, warten',     ohneZt: '3 Tage' },
    { k: 'finanz',     dauer: 9000,  uhr: 128,
      ohne: 'Drei Banken anrufen, drei Antworten',        ohneZt: '1 Woche' },
    { k: 'urteil',     dauer: 12000, uhr: 238,
      ohne: 'Bauchgefühl',                                ohneZt: 'unbezifferbar' }
  ];
  var N = AKTE.length;

  /* ══════════════════════════════════════════════════════════════════
     Die Szenen
     ══════════════════════════════════════════════════════════════════ */
  function rz(lb, wert, klasse, klein) {
    return '<div class="wx-r ' + (klasse || '') + '"><span class="lb">' + lb
      + (klein ? '<small>' + klein + '</small>' : '') + '</span>'
      + '<span class="wt">' + wert + '</span></div>';
  }
  function gewinn(betrag, text) {
    return '<div class="wx-gew">' + ik('haken', 19) + '<b>' + betrag + '</b>'
      + '<span>' + text + '</span></div>';
  }
  function spPos(v) { return (v - 30) / 40 * 100; }

  function szene(n) {
    var a = AKTE[n], O = S.O, K = S.KPA, R = S.RND, A = S.AFA, E = S.EW,
        F = S.FIN, C = S.CF;

    /* ── 1 · SPRECHEN ────────────────────────────────────────────── */
    if (a.k === 'sprechen') {
      var w = '';
      for (var b = 0; b < 26; b++) w += '<i style="--n:' + b + '"></i>';
      return titel('STUFE 1 · ERFASSEN', 'Einmal sprechen. Mehr nicht.',
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

    /* ── 2 · MARKTPREISINDIKATION ────────────────────────────────── */
    if (a.k === 'indikation') {
      var p0 = (S.MPI.von - 240000) / 80000 * 100;
      var p1 = (S.MPI.bis - 240000) / 80000 * 100;
      var pk = (O.kaufpreis - 240000) / 80000 * 100;
      return titel('STUFE 2 · MARKTPREISINDIKATION',
        'Erst die grobe Einordnung.',
        'Bevor irgendetwas gerechnet wird: liegt der Kaufpreis überhaupt im Rahmen? '
        + 'Das ist eine Indikation aus Vergleichspreisen, kein Gutachten — und sie '
        + 'wird auch so genannt.')
        + '<div class="wx-spanne" style="max-width:620px"><div class="wx-sp-kopf">'
        + '<span class="lb">VERGLEICHSPREISE · ' + eur(S.MPI.qm_von) + '–'
        + eur(S.MPI.qm_bis) + '/m²</span>'
        + '<span class="wt">' + eur(S.MPI.von) + ' – ' + eur(S.MPI.bis) + '</span></div>'
        + '<div class="wx-sp-bahn"><span class="wx-sp-grund"></span>'
        + '<span class="wx-sp-band" data-l="' + p0 + '" data-w="' + (p1 - p0) + '"></span>'
        + '<span class="wx-sp-mark" data-l="' + pk + '"></span></div>'
        + '<div class="wx-sp-skala"><span>240.000 €</span><span>280.000 €</span>'
        + '<span>320.000 €</span></div>'
        + '<div class="wx-sp-note">' + ik('pin', 13)
        + '<span>Der Kaufpreis von ' + eur(O.kaufpreis) + ' liegt im oberen Drittel '
        + 'der Spanne — auffällig, aber nicht auffällig genug, um abzubrechen. '
        + 'Die Prüfung geht weiter.</span></div></div>'
        + '<div class="wx-rech">'
        + rz('Kaufpreis', eur(O.kaufpreis), '', eur(O.kaufpreis / O.wfl) + ' je m²')
        + rz('Mitte der Indikation', eur((S.MPI.von + S.MPI.bis) / 2), '',
          'daraus allein folgt noch nichts')
        + '</div>';
    }

    /* ── 3 · KAUFPREISAUFTEILUNG ─────────────────────────────────── */
    if (a.k === 'aufteilung') {
      var antB = K.boden_angesetzt / O.kaufpreis * 100;
      return titel('STUFE 3 · KAUFPREISAUFTEILUNG',
        'Was in den Notarvertrag gehört.',
        'Nur der Gebäudeanteil wird abgeschrieben. Je sauberer der Bodenwert '
        + 'hergeleitet ist, desto höher die Bemessungsgrundlage — und der Abschlag '
        + 'für das Sondereigentum ist begründbar, nicht geschätzt.')
        + '<div class="wx-waage"><div class="wx-wbalken">'
        + '<span class="wx-wb bo" data-fb="' + antB + '"><b class="w-bo">–</b>'
        + '<span>BODEN</span></span>'
        + '<span class="wx-wb ge" data-fb="' + (100 - antB) + '"><b class="w-ge">–</b>'
        + '<span>GEBÄUDE · AfA-BASIS</span></span></div>'
        + '<div class="wx-wlegende"><span>' + proz(K.anteil_boden) + ' Bodenanteil</span>'
        + '<span>' + proz(1 - K.anteil_boden) + ' abschreibbar</span></div></div>'
        + '<div class="wx-rech">'
        + rz('Grundstücksanteil', zahl(K.boden_qm, 1) + ' m²', '',
          zahl(O.grundstueck_qm) + ' m² × Miteigentumsanteil ' + proz(O.mea, 1))
        + rz('Bodenrichtwert', eur(O.brw) + '/m²', '', 'BORIS · Stichtag 01.01.2026')
        + rz('Bodenwert roh', eur(K.boden_roh))
        + rz('Abschlag ' + K.abschlag_prozent + ' % Sondereigentum',
          '− ' + eur(K.abschlag_eur), 'minus',
          'Belastung des Grundstücks durch das Gebäude')
        + rz('Bodenwert im Vertrag', eur(K.boden_angesetzt), 'summe')
        + rz('Gebäudeanteil = AfA-Bemessungsgrundlage', eur(K.gebaeude_mit),
          'summe gross')
        + '</div>'
        + gewinn('+ ' + eur(K.mehr_bemessung),
          'mehr Bemessungsgrundlage als ohne den Abschlag. '
          + '<b>Dieser Satz gehört so in den Notarvertrag</b> — später ist er '
          + 'nur noch mit Mühe zu ändern.');
    }

    /* ── 4 · RESTNUTZUNGSDAUER — der Regler ──────────────────────── */
    if (a.k === 'nutzung') {
      return titel('STUFE 4 · RESTNUTZUNGSDAUER',
        'Ein Rahmen, keine Zahl — und die Wahl darin.',
        'Anlage 2 ImmoWertV liefert eine Spanne. DealPilot zeigt sie und lässt '
        + 'wählen, statt eine Zahl zu setzen, die niemand belegen kann.')
        + '<div class="wx-reg">'
        + '<div class="wx-rkopf"><span class="gr n-rnd">' + R.bis + '</span>'
        + '<span class="ei">JAHRE</span>'
        + '<span class="hi">Baujahr ' + O.bj + ' · GND ' + O.gnd + ' J. · '
        + R.modpunkte + ' Modernisierungspunkte</span></div>'
        + '<div class="wx-rbahn"><span class="wx-rgrund"></span>'
        + '<span class="wx-rband"></span>'
        + '<input class="wx-rin" type="range" min="' + R.von + '" max="' + R.bis
        + '" value="' + R.bis + '" step="1" aria-label="Restnutzungsdauer in Jahren">'
        + '</div>'
        + '<div class="wx-rmarken"><b>' + R.von + ' J.</b>'
        + '<span>rechnerisch ' + R.rechnerisch + '</span><b>' + R.bis + ' J.</b></div>'
        + '<div class="wx-rfolge">'
        + '<div><span class="l">ABSCHREIBUNG JE JAHR</span>'
        + '<span class="v n-afa">–</span><span class="s n-satz">–</span></div>'
        + '<div><span class="l">STEUER JE JAHR</span>'
        + '<span class="v n-steuer">–</span>'
        + '<span class="s">gegenüber dem Regelfall 2 %</span></div>'
        + '<div><span class="l">CASHFLOW NACH STEUERN</span>'
        + '<span class="v n-cf">–</span><span class="s n-cfhin">–</span></div>'
        + '</div>'
        + '<div class="wx-anfass">' + ik('hand', 15)
        + '<span>Der Regler fährt von allein — <b style="color:#fff">fass ihn an, '
        + 'dann übernimmst du</b>.</span></div></div>';
    }

    /* ── 5 · ABSCHREIBUNG ────────────────────────────────────────── */
    if (a.k === 'afa') {
      return titel('STUFE 5 · ABSCHREIBUNG',
        'Was die Wahl je Jahr bedeutet.',
        'Eine kürzere Nutzungsdauer heißt höhere Abschreibung. Sie verlangt einen '
        + 'Nachweis nach § 7 Abs. 4 Satz 2 EStG — den liefert das Gutachten, das '
        + 'aus Stufe 4 ohnehin entsteht.')
        + '<div class="wx-rech">'
        + rz('gesetzlicher Regelfall — 2 %, ohne Abschlag', eur(A.standard.jahr), '',
          '§ 7 Abs. 4 Satz 1 EStG · Bemessung ' + eur(S.KPA.gebaeude_ohne))
        + rz('bei ' + R.mitte + ' Jahren (Mitte des Rahmens)', eur(A.mitte.jahr), '',
          proz(A.mitte.satz, 2))
        + rz('bei ' + R.von + ' Jahren (unteres Ende)', eur(A.kurz.jahr), 'plus',
          proz(A.kurz.satz, 2) + ' · mit Nachweis')
        + rz('Mehr-Abschreibung je Jahr', '+ ' + eur(A.mehr_jahr), 'summe plus')
        + '</div>'
        + gewinn(eur(A.steuer_jahr),
          'weniger Steuer je Jahr bei ' + proz(O.steuersatz, 0)
          + ' Grenzsteuersatz. Über ' + R.von + ' Jahre sind das <b>'
          + eur(A.steuer_jahr * R.von) + '</b> — bei einem Aufwand von einmal '
          + 'Gutachten.');
    }

    /* ── 6 · VERKEHRSWERT ────────────────────────────────────────── */
    if (a.k === 'wert') {
      return titel('STUFE 6 · VERKEHRSWERT',
        'Ein Verfahren, begründet gewählt.',
        'Zwei Verfahren nebeneinander zu zeigen, von denen eines nicht passt, '
        + 'sieht nach Gründlichkeit aus und ist das Gegenteil.')
        + '<div class="wx-verf">'
        + '<div class="wx-v ja"><span class="ik">' + ik('haken', 16) + '</span>'
        + '<span><b>' + esc(E.verfahren) + ' · § 27 ImmoWertV</b>'
        + '<span>' + esc(E.grund) + '</span></span></div>'
        + '<div class="wx-v nein"><span class="ik">' + ik('kreuz', 16) + '</span>'
        + '<span><b>' + esc(E.verworfen) + '</b>'
        + '<span>' + esc(E.verworfen_grund) + '</span></span></div></div>'
        + '<div class="wx-rech">'
        + rz('Jahresrohertrag', eur(E.rohertrag), '',
          eur(O.miete_monat) + '/Monat · ' + eur(O.miete_monat / O.wfl) + '/m²')
        + rz('Bewirtschaftungskosten ' + proz(O.bwk_quote, 0), '− ' + eur(E.bwk), 'minus')
        + rz('Reinertrag', eur(E.reinertrag))
        + rz('Bodenwertverzinsung ' + proz(O.lz), '− ' + eur(E.bodenverzinsung), 'minus',
          'nur der rentierliche Bodenwert, § 41 ImmoWertV')
        + rz('Gebäudereinertrag × Vervielfältiger ' + zahl(E.vf, 2),
          eur(E.ertragswert_geb), '',
          'Liegenschaftszins ' + proz(O.lz) + ' amtlich · ' + R.mitte + ' Jahre')
        + rz('+ Bodenwert', eur(S.KPA.boden_angesetzt))
        + rz('Verkehrswert', eur(E.verkehrswert), 'summe gross')
        + rz('Kaufpreis liegt darüber', '+ ' + proz(E.abweichung), '',
          'in dieser Lage vertretbar — aber es steht da')
        + '</div>';
    }

    /* ── 7 · FINANZIERUNG ────────────────────────────────────────── */
    if (a.k === 'finanz') {
      return titel('STUFE 7 · FINANZIERUNG',
        'Mit Marktzins, nicht mit Wunschzins.',
        'Eine Indikation, kein Angebot — das steht an der Zeile und nicht im '
        + 'Kleingedruckten.')
        + '<div class="wx-rech">'
        + rz('Kaufpreis', eur(O.kaufpreis))
        + rz('Erwerbsnebenkosten ' + proz(F.nk_quote), '+ ' + eur(F.nk), '',
          'Grunderwerb ' + proz(O.nk_grunderwerb, 1) + ' · Notar '
          + proz(O.nk_notar, 1) + ' · Makler ' + proz(O.nk_makler, 2))
        + rz('Gesamtaufwand', eur(F.gesamt), 'summe')
        + rz('Eigenkapital ' + proz(O.ek_quote, 0), '− ' + eur(F.ek), 'minus')
        + rz('Darlehen', eur(F.darlehen), 'summe')
        + rz('Zins ' + proz(F.zins, 2) + ' · Tilgung ' + proz(F.tilgung, 0),
          eur(F.rate_monat) + '/Mon.', '',
          'Marktindikation · ' + F.zinsbindung + ' Jahre Zinsbindung')
        + rz('Kapitaldienstdeckung (DSCR)', zahl(F.dscr, 2), 'minus',
          'unter 1,0 — die Miete allein trägt die Rate nicht')
        + '</div>'
        + '<div class="wx-gew" style="background:rgba(201,168,76,.1);'
        + 'border-left-color:var(--gd)">' + ik('pfeil', 19)
        + '<b style="color:var(--gdh)">' + eur(Math.abs(C.ohne.vor_steuer_monat))
        + '</b><span>fehlen im Monat vor Steuern. '
        + '<b>Ob der Deal trägt, entscheidet sich jetzt an der Steuer</b> — '
        + 'und damit an den Stufen 3 und 4.</span></div>';
    }

    /* ── 8 · DAS URTEIL ──────────────────────────────────────────── */
    var lohnt = C.mit.nach_steuer_monat >= 0;
    return titel('STUFE 8 · DIE ENTSCHEIDUNG',
      lohnt ? 'Trägt sich — aber erst nach Steuern.' : 'Trägt sich nicht.',
      'Derselbe Kaufpreis, dieselbe Bank, dasselbe Objekt. Zwei Zahlen sind '
      + 'anders, und beide sind belegbar.')
      + '<div class="wx-kipp">'
      + '<div class="wx-kseite a"><span class="l">OHNE OPTIMIERUNG</span>'
      + '<span class="v">' + eur(C.ohne.nach_steuer_monat) + '</span>'
      + '<span class="s">je Monat · Regel-AfA 2 %, Bodenwert ohne Abschlag</span></div>'
      + '<div class="wx-kpfeil">' + ik('pfeil', 20) + '</div>'
      + '<div class="wx-kseite b"><span class="l">MIT DEALPILOT</span>'
      + '<span class="v">+ ' + eur(C.mit.nach_steuer_monat) + '</span>'
      + '<span class="s">je Monat · RND ' + R.von + ' J. + Bodenabschlag</span></div>'
      + '</div>'
      + '<div class="wx-gruende" style="margin-top:14px;max-width:620px">'
      + '<div class="wx-gr gut" style="--n:0"><span class="ik">' + ik('haken', 16)
      + '</span><span><b>' + eur(C.unterschied_monat) + ' im Monat Unterschied</b>'
      + '<span>' + eur(C.unterschied_monat * 12) + ' im Jahr, allein aus zwei '
      + 'belegbaren Ansätzen.</span></span></div>'
      + '<div class="wx-gr acht" style="--n:1"><span class="ik">' + ik('pfeil', 16)
      + '</span><span><b>Achtung: vor Steuern bleibt es negativ</b>'
      + '<span>' + eur(C.ohne.vor_steuer_monat) + ' im Monat. Wer die Steuerwirkung '
      + 'nicht mitrechnet, hält den Deal für schlecht — oder verlässt sich '
      + 'darauf, ohne sie belegen zu können.</span></span></div>'
      + '<div class="wx-gr gut" style="--n:2"><span class="ik">' + ik('haken', 16)
      + '</span><span><b>Alles mit Herkunft</b>'
      + '<span>Bodenrichtwert und Liegenschaftszins amtlich, Restnutzungsdauer nach '
      + 'Anlage 2, Zins als Marktindikation gekennzeichnet.</span></span></div>'
      + '</div>';
  }

  function titel(lb, h, p) {
    return '<div class="wx-titel"><span class="lb">' + esc(lb) + '</span>'
      + '<h3>' + esc(h) + '</h3><p>' + p + '</p></div>';
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
      /* Die Achse trennt nur, wo wirklich gewechselt wird. Ab Akt 3
         lief sie mitten durch den Text und trennte nichts. */
      bahn.classList.toggle('wechselt', a.k === 'sprechen' || a.k === 'bewerten');
      /* Der Fusstext kommt aus der NEUEN Szene - vorher stand dort der
         Titel des vorigen Akts, weil bei weichem Uebergang erst 300 ms
         spaeter gesetzt wird. */
      fMit.querySelector('.tx').textContent =
        (buehne.querySelector('.wx-titel h3') || {}).textContent || '';
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
    fMit.querySelector('.zt').textContent =
      Math.floor(a.uhr / 60) + ':' + ('0' + (a.uhr % 60)).slice(-2);
  }

  /* Blendet die Elemente einer Szene gestaffelt ein.
     Der Startzustand wird per Inline-Stil gesetzt und per setTimeout
     wieder entfernt - setTimeout wird im Hintergrund gedrosselt, aber
     es laeuft, und der Endzustand ist der normale Stil des Elements.
     Eine CSS-Verzoegerung kann das nicht: sie laeuft dort gar nicht
     erst ab, und das Element bliebe fuer immer unsichtbar. */
  function staffeln(sel, abstand, weite) {
    [].slice.call(buehne.querySelectorAll(sel)).forEach(function (el, k) {
      var x = 0;
      if (weite) x = el.closest('.wx-w') && el.closest('.wx-w').classList.contains('re')
        ? weite : -weite;
      el.style.opacity = '0';
      el.style.transform = x ? 'translateX(' + x + 'px)' : 'translateY(12px)';
      setTimeout(function () {
        if (!el.isConnected) return;
        el.style.transition = 'opacity .55s var(--e-hoch),transform .55s var(--e-hoch)';
        el.style.opacity = '';
        el.style.transform = '';
      }, 90 + k * abstand);
    });
  }

  function nachziehen(i) {
    var a = AKTE[i];
    if (a.k === 'aufteilung') staffeln('.wx-r', 95);
    if (a.k === 'afa' || a.k === 'wert' || a.k === 'finanz') staffeln('.wx-r', 85);
    if (a.k === 'indikation') staffeln('.wx-r', 110);
    if (a.k === 'urteil') staffeln('.wx-gr', 160);

    /* ── Stufe 1: tippen, dann die Pillen fliegen lassen ─────────── */
    if (a.k === 'sprechen') {
      var ziel = buehne.querySelector('.wx-tipp');
      if (!ziel) return;
      var worte = SATZ.split(' '), k = 0;
      var t = setInterval(function () {
        if (!ziel.isConnected) { clearInterval(t); return; }
        ziel.textContent = worte.slice(0, ++k).join(' ');
        if (k >= worte.length) { clearInterval(t); fliegen(); }
      }, 78);
    }

    /* ── Stufe 2: die Spanne faehrt auf ─────────────────────────── */
    if (a.k === 'indikation') {
      var band = buehne.querySelector('.wx-sp-band');
      var mark = buehne.querySelector('.wx-sp-mark');
      if (band) setTimeout(function () {
        if (!band.isConnected) return;
        band.style.left = band.getAttribute('data-l') + '%';
        band.style.width = band.getAttribute('data-w') + '%';
      }, 120);
      if (mark) { mark.style.left = '0%';
        setTimeout(function () {
          if (!mark.isConnected) return;
          mark.style.left = mark.getAttribute('data-l') + '%';
          mark.classList.add('da');
        }, 160);
      }
    }

    /* ── Stufe 3: die Waage kippt ───────────────────────────────── */
    if (a.k === 'aufteilung') {
      var teile = [].slice.call(buehne.querySelectorAll('.wx-wb'));
      teile.forEach(function (el) { el.style.flexBasis = '50%'; });
      setTimeout(function () {
        teile.forEach(function (el) {
          if (!el.isConnected) return;
          el.style.flexBasis = el.getAttribute('data-fb') + '%';
        });
        var bo = buehne.querySelector('.w-bo'), ge = buehne.querySelector('.w-ge');
        if (bo) hoch(bo, eur(S.KPA.boden_angesetzt), 900);
        if (ge) hoch(ge, eur(S.KPA.gebaeude_mit), 900);
      }, 220);
    }

    /* ── Stufe 4: der Regler faehrt - und gibt ab, wer ihn anfasst ─ */
    if (a.k === 'nutzung') regler();
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
  /* Der Regler faehrt von der oberen Grenze zur unteren und zeigt
     dabei, wie die Zahlen mitwandern. Wer ihn anfasst, uebernimmt -
     das Vorfuehren hoert dann auf und der ganze Ablauf haelt an.
     Alles laeuft ueber setTimeout, nicht ueber CSS-Verzoegerungen:
     im Hintergrund-Tab wuerde sonst der Zustand haengenbleiben. */
  function regler() {
    var inp = buehne.querySelector('.wx-rin');
    if (!inp) return;
    var band = buehne.querySelector('.wx-rband');
    var R = S.RND, K = S.KPA, eigen = false;

    function neu() {
      var j = +inp.value;
      var afa = S.afa(K.gebaeude_mit, j);
      var mehr = afa.jahr - S.AFA.standard.jahr;
      var steuer = mehr * S.O.steuersatz;
      var cf = S.cashflow(afa.jahr);
      function setz(sel, txt, kl) {
        var el = buehne.querySelector(sel);
        if (!el) return;
        el.textContent = txt;
        if (kl !== undefined) el.className = el.className.split(' ')[0]
          + ' ' + sel.slice(1) + (kl ? ' ' + kl : '');
      }
      var g = buehne.querySelector('.n-rnd'); if (g) g.textContent = j;
      setz('.n-afa', eur(afa.jahr));
      setz('.n-satz', proz(afa.satz, 2) + ' je Jahr');
      setz('.n-steuer', (steuer >= 0 ? '+ ' : '') + eur(steuer),
        steuer > 0 ? 'acht' : 'schlecht');
      setz('.n-cf', (cf.nach_steuer_monat >= 0 ? '+ ' : '')
        + eur(cf.nach_steuer_monat) + '/Mon.',
        cf.nach_steuer_monat >= 0 ? 'gut' : 'schlecht');
      setz('.n-cfhin', cf.nach_steuer_monat >= 0 ? 'trägt sich' : 'Zuzahlung nötig');
      if (band) band.style.width = ((j - R.von) / (R.bis - R.von) * 100) + '%';
    }

    inp.addEventListener('input', function () {
      if (!eigen) {
        eigen = true;
        clearInterval(flugUhr);
        aus();                      /* der Ablauf haelt an */
        var h = buehne.querySelector('.wx-anfass');
        if (h) h.innerHTML = ik('hand', 15)
          + '<span style="color:var(--grnh)">Du hast übernommen — '
          + 'der Ablauf wartet.</span>';
      }
      neu();
    });

    neu();
    /* Vorfuehren: von der oberen Grenze zur unteren. */
    var j = R.bis;
    clearInterval(flugUhr);
    flugUhr = setInterval(function () {
      if (!inp.isConnected || eigen) { clearInterval(flugUhr); return; }
      if (j <= R.von) { clearInterval(flugUhr); return; }
      inp.value = --j;
      neu();
    }, 520);
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
