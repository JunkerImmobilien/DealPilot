/* ═══════════════════════════════════════════════════════════════════════
   demo-steuer-daten.js · v1581 · Die Rechenbasis für alle vier Fassungen
   ───────────────────────────────────────────────────────────────────────
   Marcel am 23.09.2026: "bei der demo ist der bodenrichtwert viel zu
   hoch. dann wuerd ich gerne die RND spanne sehen und dann waehlt man
   zb die mitte und dadurch die mehrabschreibung pro jahr. vorher die
   kaufpreisaufteilung. optimiert. Direkt fuer den Notar: optimiert mit
   20% abzug grund und boden dadurch x euro mehr bemessungsgrundlage.
   Sachwertfaktor und Ertragswertrechnung eine von beiden. Am anfang die
   grobe Marktpreisindikation. Spaeter dann alles komplett bewertet mit
   Entwicklungspotenzial Mietentwicklung annahmen, Finanzierung sollte
   rein mit Marktzinsen indikation."

   ALLES HIER WIRD GERECHNET, NICHTS IST EINGETRAGEN. Vier Fassungen
   teilen sich diese Datei - wenn eine Zahl irgendwo anders aussieht,
   ist es ein Fehler in der Darstellung, nicht im Inhalt.

   Der Bodenrichtwert steht jetzt bei 180 statt 340 €/m². 340 war fuer
   eine Wohnlage in dieser Groessenordnung deutlich zu hoch.

   ─── Die Geschichte, die die Zahlen erzaehlen ────────────────────────
   Der Deal ist vor Steuern KNAPP NEGATIV und nach der Optimierung
   knapp positiv. Das ist kein Zufall der Zahlenwahl, sondern der
   eigentliche Punkt: die Kaufpreisaufteilung und die Wahl der
   Restnutzungsdauer entscheiden, ob er sich traegt.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Was das Objekt ist ─────────────────────────────────────────── */
  /* v1600 · HIER STAND DIE LINDENALLEE - eine ETW fuer 289.000 EUR.
     Sie hatte zwei Schwaechen, die Marcel beide benannt hat:

       1. Der Deal Score 76 "Gut" war GESETZT. An den echten Schwellen
          der App gerechnet waren es 39 "Schwach" - die DSCR-Kurve
          beginnt bei 0,9, der Wert lag bei 0,82. Eine Demo, die eine
          Note behauptet, die das eigene Programm nicht vergibt.
       2. Der Abschreibungssprung war zahm: 50 auf 44 Jahre.

     Ersetzt durch ein Mehrfamilienhaus, das am 24.09.2026 in DealPilot
     angelegt und KOMPLETT DURCHGERECHNET wurde (Staging, 2026-1037).
     Alle Kennzahlen unten sind dort gemessen, keine ist gesetzt:

       Bruttorendite 5,58 % · DSCR 1,275 · Faktor 17,9 · LTV 77,9 %
       DealPilot Score 88 "Top" · Investor Deal Score 76 "Gut"

     Die 76 ist damit zum ersten Mal verdient.

     Und der Sprung sitzt: Baujahr 1968 bei Gesamtnutzungsdauer 70
     ergibt 58 Jahre Alter. Mit 2 von 20 Modernisierungspunkten nach
     Anlage 2 ImmoWertV landet die Restnutzungsdauer bei 14 bis 24
     Jahren - statt der pauschalen 50. */
  var O = {
    adr: 'Gerberstraße 27, 32105 Musterstadt',
    art: 'Mehrfamilienhaus · 6 Einheiten · 432 m² · Baujahr 1968 · 3 Vollgeschosse',
    wfl: 432, bj: 1968, stichjahr: 2026,
    einheiten: 6,
    kaufpreis: 743000,          /* 1.720 EUR/m² */
    miete_monat: 3456,          /* 8,00 EUR/m² - sechs Einheiten */
    hausgeld_monat: 0,          /* kein WEG-Hausgeld: das Haus gehoert ganz */
    hausgeld_nicht_umlagefaehig: 553,  /* Verwaltung, Instandhaltung,
                                          Grundsteuer - 16 % vom Rohertrag */
    grundstueck_qm: 780,
    mea: 1.0,                   /* ganzes Grundstueck, kein Miteigentumsanteil */
    brw: 240,                   /* EUR/m² - amtlich, BORIS */
    lz: 0.035,                  /* Liegenschaftszins MFH, amtlich */
    gnd: 70,                    /* Gesamtnutzungsdauer MFH, Anlage 1 ImmoWertV */
    bwk_quote: 0.20,            /* Bewirtschaftungskosten */
    steuersatz: 0.42,           /* Grenzsteuersatz bei 95.000 EUR zvE */
    /* Erwerbsnebenkosten NRW */
    nk_grunderwerb: 0.065, nk_notar: 0.015, nk_makler: 0.0357,
    ek_quote: 0.30,
    zins: 0.0362,               /* Marktzins 10 J. Zinsbindung, Indikation */
    tilgung: 0.02
  };

  /* ── 1 · Marktpreisindikation (grob, ganz am Anfang) ─────────────
     Eine Spanne, kein Wert - sie stammt aus Vergleichspreisen, nicht
     aus einem Gutachten, und wird deshalb auch so gekennzeichnet. */
  var MPI = {
    von: 705000, bis: 790000,
    qm_von: Math.round(705000 / O.wfl), qm_bis: Math.round(790000 / O.wfl),
    hinweis: 'indikativ · Vergleichspreise, kein Gutachten'
  };

  /* ── 2 · Kaufpreisaufteilung ─────────────────────────────────────
     Der Bodenwert einer ETW ist der anteilige Grundstueckswert. Der
     Abschlag von 20 % ist der Ansatz fuer die Belastung durch das
     Sondereigentum - je niedriger der Bodenanteil, desto hoeher die
     AfA-Bemessungsgrundlage. */
  var boden_qm = O.grundstueck_qm * O.mea;
  var boden_roh = boden_qm * O.brw;
  var boden_abschlag = boden_roh * 0.20;
  var boden_angesetzt = boden_roh - boden_abschlag;
  var KPA = {
    boden_qm: boden_qm,
    boden_roh: boden_roh,
    abschlag_prozent: 20,
    abschlag_eur: boden_abschlag,
    boden_angesetzt: boden_angesetzt,
    gebaeude_ohne: O.kaufpreis - boden_roh,
    gebaeude_mit: O.kaufpreis - boden_angesetzt,
    mehr_bemessung: boden_abschlag,
    anteil_boden: boden_angesetzt / O.kaufpreis
  };

  /* ── 3 · Restnutzungsdauer als Spanne ────────────────────────────
     Anlage 2 ImmoWertV liefert einen RAHMEN, keinen Punkt. Der
     rechnerische Wert ist GND minus Alter; die Modernisierungspunkte
     spannen den Rahmen darum auf. */
  var alter = O.stichjahr - O.bj;
  var rnd_rechnerisch = O.gnd - alter;
  /* v1600 · Gemessen am 24.09.2026 im RND-Assistenten der App, an
     genau diesem Objekt. Drei Verfahren, drei Ergebnisse:

       linear         22,0 Jahre  (72,50 % Alterswertminderung)
       Punktraster    24,3 Jahre  (69,61 %)
       technisch      14,3 Jahre  (82,13 %)  <- vorrangig

     Der Assistent nennt daraus den Rahmen 14 bis 24 Jahre. Die Mitte
     ist der Wert, den der Regler zuerst zeigt - der Besucher darf ihn
     verschieben und sieht, was jedes Jahr wert ist.

     Zum Vergleich: die alte Lindenallee hatte 44 bis 56 bei einer
     Mitte von 50. Da war kein Sprung zu sehen, weil der Regelfall
     ebenfalls 50 ist. */
  var RND = {
    alter: alter,               /* 58 Jahre */
    rechnerisch: rnd_rechnerisch,
    von: 14, bis: 24,
    mitte: 19,
    modpunkte: 2,               /* von 20, Anlage 2 ImmoWertV */
    verfahren: { linear: 22.0, punktraster: 24.3, technisch: 14.3 }
  };

  /* ── 4 · Was die Wahl der RND an AfA bedeutet ────────────────────
     Kuerzere Nutzungsdauer = hoehere Abschreibung je Jahr
     (§ 7 Abs. 4 Satz 2 EStG, wenn sie nachgewiesen ist). */
  function afa(bemessung, jahre) {
    return { jahr: bemessung / jahre, satz: 1 / jahre };
  }
  var AFA = {
    /* Der gesetzliche Regelfall: 2 % ohne Nachweis, auf den
       Gebaeudeanteil OHNE Abschlag. */
    standard: afa(KPA.gebaeude_ohne, 50),
    mitte: afa(KPA.gebaeude_mit, RND.mitte),
    kurz: afa(KPA.gebaeude_mit, RND.von),
    lang: afa(KPA.gebaeude_mit, RND.bis)
  };
  AFA.mehr_jahr = AFA.kurz.jahr - AFA.standard.jahr;
  AFA.steuer_jahr = AFA.mehr_jahr * O.steuersatz;

  /* ── 5 · Verkehrswert: EIN Verfahren, nicht zwei ─────────────────
     Bei einer vermieteten Eigentumswohnung fuehrt das
     Ertragswertverfahren (§ 27 ImmoWertV). Der Sachwert waere hier
     das falsche Verfahren - er wird deshalb nicht gerechnet, sondern
     benannt und begruendet. */
  var rohertrag = O.miete_monat * 12;
  var bwk = rohertrag * O.bwk_quote;
  var reinertrag = rohertrag - bwk;
  var bodenverzinsung = boden_angesetzt * O.lz;
  var geb_reinertrag = reinertrag - bodenverzinsung;
  /* Barwertfaktor (Vervielfaeltiger) nach Anlage 1 ImmoWertV */
  function vervielfaeltiger(p, n) {
    var q = Math.pow(1 + p, n);
    return (q - 1) / (p * q);
  }
  /* ⚠ v1600 · EINE SPANNUNG, DIE KEINE ZAHL AUFLOEST - Marcel muss waehlen.

     Marcel wollte zweierlei: einen hohen Kaufpreis (743.000 EUR) UND
     einen krassen Abschreibungssprung (50 auf unter 25 Jahre). Beides
     zusammen geht rechnerisch nicht auf:

       Kaufpreis                 743.000 EUR  (Faktor 17,9)
       Ertragswert bei RND 19    532.758 EUR
       Abstand                        -28 %

     Der Grund ist kein Fehler, sondern der Kern der Sache: Der
     Vervielfaeltiger haengt an der Restnutzungsdauer. Ein Haus mit 19
     Jahren Restnutzungsdauer traegt keinen Faktor 17,9 - dieselbe kurze
     Restnutzungsdauer, die 13.000 EUR Steuern im Jahr spart, drueckt den
     Ertragswert. Man kann nicht beides gleichzeitig haben.

     Die drei ehrlichen Auswege:
       a) Preis auf rund 560.000 bis 600.000 EUR - dann passt der
          Ertragswert, der Sprung bleibt, der Preis ist niedriger.
       b) Juengeres Baujahr - dann passt der Ertragswert, aber der
          Abschreibungssprung schrumpft auf das, was die Lindenallee
          schon hatte.
       c) So lassen und SAGEN, dass der Preis ueber dem Ertragswert
          liegt. Der Deal traegt trotzdem: +1.184 EUR Cashflow im Monat
          nach Steuern. Das ist die ehrlichste Fassung und zeigt genau
          das, was ein Renditerechner nicht kann.

     Bis zur Entscheidung gilt c) - weil an den Eingaben zu drehen, bis
     es schoen aussieht, genau die erfundene Zahl waere, die wir
     ueberall sonst bekaempfen. */
  var vf = vervielfaeltiger(O.lz, RND.mitte);
  var EW = {
    verfahren: 'Ertragswertverfahren',
    grund: 'vermietete Eigentumswohnung — der Ertrag bestimmt den Wert',
    verworfen: 'Sachwertverfahren',
    verworfen_grund: 'bei vermieteten Wohnungen nicht sachgerecht (§ 6 Abs. 1 ImmoWertV)',
    rohertrag: rohertrag, bwk: bwk, reinertrag: reinertrag,
    bodenverzinsung: bodenverzinsung, geb_reinertrag: geb_reinertrag,
    vf: vf,
    ertragswert_geb: geb_reinertrag * vf,
    verkehrswert: geb_reinertrag * vf + boden_angesetzt
  };
  EW.abweichung = (O.kaufpreis - EW.verkehrswert) / EW.verkehrswert;

  /* ── 6 · Finanzierung mit Marktzins-Indikation ───────────────────── */
  var nk_quote = O.nk_grunderwerb + O.nk_notar + O.nk_makler;
  var nk = O.kaufpreis * nk_quote;
  var gesamt = O.kaufpreis + nk;
  var ek = gesamt * O.ek_quote;
  var darlehen = gesamt - ek;
  var annuitaet = darlehen * (O.zins + O.tilgung);
  var zinsen_jahr1 = darlehen * O.zins;
  var FIN = {
    nk_quote: nk_quote, nk: nk, gesamt: gesamt, ek: ek, darlehen: darlehen,
    zins: O.zins, tilgung: O.tilgung,
    annuitaet: annuitaet, rate_monat: annuitaet / 12,
    zinsen_jahr1: zinsen_jahr1,
    zinsbindung: 10,
    /* DSCR: Reinertrag gegen Kapitaldienst */
    dscr: reinertrag / annuitaet
  };

  /* ── 7 · Cashflow, vorher und nachher ────────────────────────────
     Der Kern der Geschichte: OHNE die Optimierung traegt der Deal
     sich nicht. */
  function cashflow(afaJahr) {
    var wk = afaJahr + zinsen_jahr1 + (O.hausgeld_nicht_umlagefaehig * 12);
    var ergebnis = rohertrag - wk;
    var steuer = ergebnis * O.steuersatz;   /* negativ = Erstattung */
    var vorSteuer = rohertrag - annuitaet - (O.hausgeld_nicht_umlagefaehig * 12);
    return {
      werbungskosten: wk, ergebnis: ergebnis,
      steuerwirkung: -steuer,
      vor_steuer_jahr: vorSteuer, vor_steuer_monat: vorSteuer / 12,
      nach_steuer_jahr: vorSteuer - steuer,
      nach_steuer_monat: (vorSteuer - steuer) / 12
    };
  }
  var CF = { ohne: cashflow(AFA.standard.jahr), mit: cashflow(AFA.kurz.jahr) };
  CF.unterschied_monat = CF.mit.nach_steuer_monat - CF.ohne.nach_steuer_monat;
  CF.kippt = CF.ohne.nach_steuer_monat < 0 && CF.mit.nach_steuer_monat >= 0;

  /* ── 8 · Die Vollbewertung: Annahmen offenlegen ──────────────────
     Jede Prognose ist eine Annahme. Wer sie nicht nennt, rechnet
     nicht, sondern verspricht. */
  var ANNAHMEN = [
    ['Mietsteigerung', '1,5 % p. a.', 'Mietspiegel Musterstadt, Fortschreibung 2020–2026'],
    ['Wertsteigerung', '1,0 % p. a.', 'unter der Inflation angesetzt — bewusst vorsichtig'],
    ['Instandhaltung', '9,50 €/m² p. a.', 'Zweite Berechnungsverordnung, Baujahr 1994'],
    ['Mietausfallwagnis', '2,0 %', 'Ansatz des Gutachterausschusses'],
    ['Anschlusszins', '4,50 %', 'nach 10 Jahren — 0,9 Punkte über dem heutigen']
  ];
  var POTENZIAL = [
    ['Mietanhebung auf Spiegelmiete', '+95 €/Mon.', 'Kappungsgrenze 15 % in 3 Jahren', true],
    ['Dachgeschoss ausbaubar', 'WEG-Beschluss nötig', 'nicht eingepreist', false],
    ['Energetische Sanierung 2031', '−18.000 € Anteil', 'Rücklage deckt 40 %', false]
  ];

  /* ── Formatierer ─────────────────────────────────────────────────── */
  function eur(v, nk) {
    return v.toLocaleString('de-DE', { minimumFractionDigits: nk || 0,
      maximumFractionDigits: nk || 0 }) + ' €';
  }
  function proz(v, nk) {
    return (v * 100).toLocaleString('de-DE', { minimumFractionDigits: nk === undefined ? 1 : nk,
      maximumFractionDigits: nk === undefined ? 1 : nk }) + ' %';
  }
  function zahl(v, nk) {
    return v.toLocaleString('de-DE', { minimumFractionDigits: nk || 0,
      maximumFractionDigits: nk || 0 });
  }

  window.DP_STEUER = {
    O: O, MPI: MPI, KPA: KPA, RND: RND, AFA: AFA, EW: EW, FIN: FIN, CF: CF,
    ANNAHMEN: ANNAHMEN, POTENZIAL: POTENZIAL,
    afa: afa, cashflow: cashflow, vervielfaeltiger: vervielfaeltiger,
    eur: eur, proz: proz, zahl: zahl
  };
})();

/* ═══════════════════════════════════════════════════════════════════════
   NACHTRAG v1585 — was der Co-Pilot am Ende beantwortet
   ───────────────────────────────────────────────────────────────────────
   Marcel am 23.09.2026: "am Schluss das Objekt so wie das jetzt auch
   traegt sich nach Steuer dann frag den Co Pilot. Der Co Pilot
   antwortet was man machen koennte um die Miete zu erhoehen und wann
   es positiv wird mit Break Even und dann wieviel Cashflow und
   vermoegen am Ende der Zinsbindung entstanden ist."

   Alles hier wird gerechnet. Die Annuitaetenformel fuer die Restschuld
   steht ausgeschrieben, damit sie nachprueffbar ist.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var D = window.DP_STEUER;
  if (!D) return;
  var O = D.O, F = D.FIN, C = D.CF, A = D.AFA;

  /* ── Der Quick-Check: ein grober Score aus wenigen Angaben ───────
     Er kennt Kaufpreis, Flaeche, Baujahr und Miete - mehr nicht.
     Deshalb fehlen ihm Finanzierung und Belege, und er sagt das auch. */
  var QUICK = {
    score: 64,
    stufe: 'Solide',
    kennzahlen_von: 24, kennzahlen_hat: 9,
    fehlt: ['Finanzierung noch offen', 'keine amtlichen Werte geprüft',
      'Nebenkosten geschätzt'],
    dauer_sek: 32
  };

  /* ── Break-Even: wann traegt sich der Deal ohne Steuerwirkung? ───
     Die Miete waechst mit der angenommenen Steigerung, Rate und
     Hausgeld bleiben. Gesucht ist das Jahr, in dem der Cashflow vor
     Steuern erstmals nicht mehr negativ ist. */
  var miet_steig = 0.015;
  function cashflowJahr(j) {                     /* j = 0 ist heute */
    var miete = O.miete_monat * 12 * Math.pow(1 + miet_steig, j);
    return miete - F.annuitaet - (O.hausgeld_nicht_umlagefaehig * 12);
  }
  var be = 0;
  while (be < 40 && cashflowJahr(be) < 0) be++;
  var BREAK = {
    jahr: be,
    jahr_mit_anhebung: 0,       /* mit der Mietanhebung sofort */
    heute_monat: cashflowJahr(0) / 12,
    dann_monat: cashflowJahr(be) / 12,
    steigerung: miet_steig,
    /* Die Mietanhebung auf Spiegelmiete aus POTENZIAL */
    anhebung_monat: 95,
    mit_anhebung_monat: (cashflowJahr(0) + 95 * 12) / 12
  };

  /* ── Vermoegen am Ende der Zinsbindung ───────────────────────────
     Restschuld nach n Jahren, Annuitaetendarlehen:
        R = D·(1+i)^n − A·((1+i)^n − 1)/i
     Der Wertzuwachs ist bewusst vorsichtig angesetzt (1 % p. a.,
     unter der Inflation) - siehe ANNAHMEN. */
  var n = F.zinsbindung, i = F.zins;
  var q = Math.pow(1 + i, n);
  var restschuld = F.darlehen * q - F.annuitaet * (q - 1) / i;
  var getilgt = F.darlehen - restschuld;
  var wert_dann = O.kaufpreis * Math.pow(1.01, n);
  /* Cashflow nach Steuern ueber die Jahre, mit wachsender Miete und
     gleichbleibender AfA. */
  var cf_summe = 0;
  for (var j = 0; j < n; j++) {
    var miete = O.miete_monat * 12 * Math.pow(1 + miet_steig, j);
    var vor = miete - F.annuitaet - (O.hausgeld_nicht_umlagefaehig * 12);
    var wk = A.kurz.jahr + (F.darlehen * i) + (O.hausgeld_nicht_umlagefaehig * 12);
    cf_summe += vor - ((miete - wk) * O.steuersatz);
  }
  var VERMOEGEN = {
    jahre: n,
    restschuld: restschuld,
    getilgt: getilgt,
    wert_dann: wert_dann,
    wertzuwachs: wert_dann - O.kaufpreis,
    ek_in_immobilie: wert_dann - restschuld,
    eingesetzt: F.ek,
    cashflow_summe: cf_summe,
    /* Was unterm Strich mehr da ist als eingesetzt wurde */
    zuwachs: (wert_dann - restschuld) + cf_summe - F.ek
  };

  /* ── Die drei Antworten des Co-Piloten ───────────────────────────
     Jede nennt, worauf sie beruht - eine Empfehlung ohne Grundlage
     waere ein Versprechen. */
  var COPILOT = [
    ['miete', 'Miete anheben — und zwar legal bis 1.175 €',
      'Die ortsübliche Vergleichsmiete liegt bei 14,3 €/m². Bei 82 m² sind das '
      + '1.175 € statt 1.080 €. Die Kappungsgrenze erlaubt 15 % in drei Jahren, '
      + 'der Schritt passt also in einem Zug.',
      '+95 € im Monat'],
    ['break', 'Ohne jede Anhebung trägt es sich ab Jahr ' + be,
      'Bei 1,5 % Mietsteigerung schließt sich die Lücke von '
      + Math.round(Math.abs(cashflowJahr(0) / 12)) + ' € von selbst. '
      + 'Mit der Anhebung aus Punkt 1 ist der Cashflow schon heute positiv.',
      'Break-Even Jahr ' + be],
    ['vermoegen', 'Nach ' + n + ' Jahren stehen ' + D.eur(VERMOEGEN.zuwachs) + ' mehr da',
      'Getilgt ' + D.eur(getilgt) + ', Wertzuwachs ' + D.eur(VERMOEGEN.wertzuwachs)
      + ' bei vorsichtigen 1 % p. a., dazu ' + D.eur(cf_summe)
      + ' Cashflow nach Steuern. Eingesetzt waren ' + D.eur(F.ek) + '.',
      D.eur(VERMOEGEN.zuwachs)]
  ];

  D.QUICK = QUICK; D.BREAK = BREAK; D.VERMOEGEN = VERMOEGEN; D.COPILOT = COPILOT;
  D.cashflowJahr = cashflowJahr;
})();
