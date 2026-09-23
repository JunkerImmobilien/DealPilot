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
  var O = {
    adr: 'Lindenallee 14, 32105 Musterstadt',
    art: 'Eigentumswohnung · 3,5 Zimmer · 82 m² · Baujahr 1994 · 2. OG mit Balkon',
    wfl: 82, bj: 1994, stichjahr: 2026,
    kaufpreis: 289000,
    miete_monat: 1080,          /* 13,17 €/m² - Mietspiegel Musterstadt */
    hausgeld_monat: 210,
    hausgeld_nicht_umlagefaehig: 90,
    grundstueck_qm: 1100,
    mea: 0.092,                 /* 92/1000 Miteigentumsanteil */
    brw: 180,                   /* €/m² - amtlich, BORIS */
    lz: 0.028,                  /* Liegenschaftszins, amtlich */
    gnd: 80,                    /* Gesamtnutzungsdauer, Anlage 1 ImmoWertV */
    bwk_quote: 0.20,            /* Bewirtschaftungskosten */
    steuersatz: 0.42,           /* Grenzsteuersatz */
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
    von: 268000, bis: 312000,
    qm_von: Math.round(268000 / O.wfl), qm_bis: Math.round(312000 / O.wfl),
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
  var RND = {
    alter: alter,
    rechnerisch: rnd_rechnerisch,
    von: 44, bis: 56,
    mitte: 50,
    modpunkte: 9
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
