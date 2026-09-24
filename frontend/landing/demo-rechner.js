/* ═══════════════════════════════════════════════════════════════════════
   demo-rechner.js · v1592 · Eine Rechnung für beliebige Eingaben
   ───────────────────────────────────────────────────────────────────────
   demo-steuer-daten.js rechnet EIN Objekt durch — Lindenallee 14, einmal
   beim Laden. Für zwei der Ideen reicht das nicht:

     · der Kaufpreis-Regler braucht dieselbe Kette bei jedem Zug
     · das zweite Objekt braucht sie für andere Eingaben

   Deshalb hier dieselben Formeln, aber als Funktion. Die Reihenfolge
   ist die des Rechenwegs, und jede Stufe baut auf der vorigen auf.

   KEINE ZWEITE WAHRHEIT: rechne() liefert für die Eingaben aus
   DP_STEUER.O dieselben Zahlen wie die Rechenbasis. Geprüft wird das
   unten in probe() — weicht eine ab, meldet die Konsole es beim Laden.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var S = window.DP_STEUER;
  if (!S) return;

  function vervielfaeltiger(p, n) {
    var q = Math.pow(1 + p, n);
    return (q - 1) / (p * q);
  }

  /* ── Die ganze Kette, aus einem Satz Eingaben ───────────────────── */
  function rechne(e) {
    var o = {};
    for (var k in S.O) o[k] = S.O[k];        /* Vorgaben … */
    for (var k2 in e) o[k2] = e[k2];         /* … und was überschrieben wird */

    /* 1 · Kaufpreisaufteilung */
    var boden_qm = o.grundstueck_qm * o.mea;
    var boden_roh = boden_qm * o.brw;
    var abschlag = boden_roh * 0.20;
    var boden = boden_roh - abschlag;
    var geb_ohne = o.kaufpreis - boden_roh;
    var geb_mit = o.kaufpreis - boden;

    /* 2 · Restnutzungsdauer */
    var alter = o.stichjahr - o.bj;
    var rnd_rech = o.gnd - alter;
    var rnd = o.rnd || S.RND.von;

    /* 3 · Abschreibung */
    var afa_std = geb_ohne / 50;
    var afa_ist = geb_mit / rnd;
    var mehr = afa_ist - afa_std;

    /* 4 · Ertragswert */
    var rohertrag = o.miete_monat * 12;
    var bwk = rohertrag * o.bwk_quote;
    var reinertrag = rohertrag - bwk;
    var bodenzins = boden * o.lz;
    var geb_reinertrag = reinertrag - bodenzins;
    var vf = vervielfaeltiger(o.lz, S.RND.mitte);
    var verkehrswert = geb_reinertrag * vf + boden;

    /* 5 · Finanzierung */
    var nk_quote = o.nk_grunderwerb + o.nk_notar + o.nk_makler;
    var gesamt = o.kaufpreis * (1 + nk_quote);
    var ek = gesamt * o.ek_quote;
    var darlehen = gesamt - ek;
    var annuitaet = darlehen * (o.zins + o.tilgung);
    var zinsen = darlehen * o.zins;

    /* 6 · Cashflow */
    var hg = o.hausgeld_nicht_umlagefaehig * 12;
    var vor = rohertrag - annuitaet - hg;
    var wk = afa_ist + zinsen + hg;
    var steuer = (rohertrag - wk) * o.steuersatz;
    var nach = vor - steuer;
    /* … und derselbe Cashflow ohne jede Optimierung, als Gegenprobe */
    var wk_ohne = afa_std + zinsen + hg;
    var nach_ohne = vor - ((rohertrag - wk_ohne) * o.steuersatz);

    /* 7 · Vermögen am Ende der Zinsbindung */
    var n = o.zinsbindung || S.FIN.zinsbindung;
    var q = Math.pow(1 + o.zins, n);
    var restschuld = darlehen * q - annuitaet * (q - 1) / o.zins;
    var wert_dann = o.kaufpreis * Math.pow(1.01, n);

    return {
      eingabe: o,
      boden_qm: boden_qm, boden_roh: boden_roh, abschlag: abschlag, boden: boden,
      geb_ohne: geb_ohne, geb_mit: geb_mit, mehr_bemessung: abschlag,
      alter: alter, rnd_rechnerisch: rnd_rech, rnd: rnd,
      afa_standard: afa_std, afa: afa_ist, afa_mehr: mehr,
      steuer_jahr: mehr * o.steuersatz,
      rohertrag: rohertrag, reinertrag: reinertrag, verkehrswert: verkehrswert,
      abweichung: (o.kaufpreis - verkehrswert) / verkehrswert,
      gesamt: gesamt, ek: ek, darlehen: darlehen,
      rate_monat: annuitaet / 12, dscr: reinertrag / annuitaet,
      cf_vor_monat: vor / 12,
      cf_nach_monat: nach / 12,
      cf_ohne_monat: nach_ohne / 12,
      kippt: nach_ohne < 0 && nach >= 0,
      traegt: nach >= 0,
      restschuld: restschuld,
      getilgt: darlehen - restschuld,
      wert_dann: wert_dann,
      zuwachs: (wert_dann - restschuld) - ek,
      /* Was die Karte zeigt: fünf Werte, aus der Rechnung abgeleitet */
      score: null
    };
  }

  /* ── Der Score, mit den Stuetzstellen der echten App ────────────
     Meine erste Fassung hatte eigene Skalen - und kam auf 45, wo die
     Demo 76 zeigte. Nachgesehen in frontend/js/dealscore2.js: dort
     sind es Stuetzstellen-Tabellen, und bei DSCR 0,82 geben sie NULL
     Punkte (die Kurve beginnt erst bei 0,9). Die gesetzten 86 der
     Demo waren also nicht nur ungenau - sie standen dem Programm
     entgegen.

     Uebernommen sind die Tabellen aus thresholds; interpoliert wird
     linear zwischen den Stuetzstellen, wie dort auch. Nur die
     Restnutzungsdauer hat dort keine eigene Kurve (Risiko wird aus
     anderen Groessen gebildet) - die Stufen hier sind daran
     angelehnt und als einzige geschaetzt. */
  var SCHWELLEN = {
    bruttorendite: [[4, 20], [5, 50], [7, 80], [9, 100]],
    cashflow:      [[-300, 0], [-100, 30], [0, 60], [200, 85], [500, 100]],
    dscr:          [[0.9, 0], [1.0, 40], [1.1, 60], [1.2, 80], [1.3, 100]],
    rnd:           [[20, 10], [30, 35], [40, 60], [50, 80], [60, 100]]
  };
  function interpolate(v, tab) {
    if (v === null || v === undefined || !isFinite(v)) return null;
    if (v <= tab[0][0]) return tab[0][1];
    if (v >= tab[tab.length - 1][0]) return tab[tab.length - 1][1];
    for (var i = 0; i < tab.length - 1; i++) {
      var p = tab[i], q = tab[i + 1];
      if (v >= p[0] && v <= q[0]) {
        return Math.round(p[1] + (v - p[0]) / (q[0] - p[0]) * (q[1] - p[1]));
      }
    }
    return null;
  }
  function score(r) {
    var brutto = r.rohertrag / r.eingabe.kaufpreis * 100;
    var w = [
      ['Rendite', 35, interpolate(brutto, SCHWELLEN.bruttorendite)],
      ['Finanzierung', 25, interpolate(r.dscr, SCHWELLEN.dscr)],
      ['Risiko', 20, interpolate(r.rnd, SCHWELLEN.rnd)],
      ['Lage & Markt', 10, 71],
      ['Upside', 10, interpolate(r.cf_nach_monat, SCHWELLEN.cashflow)]
    ];
    var s = 0, g = 0;
    w.forEach(function (x) { s += x[1] * x[2]; g += x[1]; });
    return { werte: w, punkte: Math.round(s / g) };
  }

  function stufe(p) {
    return p >= 85 ? 'Top' : p >= 70 ? 'Gut' : p >= 50 ? 'Solide'
      : p >= 35 ? 'Schwach' : 'Kritisch';
  }

  /* ── Das zweite Objekt: teurer, schlechter vermietet, älter ──────
     Damit die Demo auch absagen kann. Die Zahlen sind so gewählt, dass
     sie plausibel sind - nicht so, dass ein bestimmtes Ergebnis
     herauskommt. Was herauskommt, rechnet dieselbe Kette aus. */
  var AHORN = {
    adr: 'Ahornweg 3, 32105 Musterstadt',
    art: 'Eigentumswohnung · 2 Zimmer · 61 m² · Baujahr 1974 · Erdgeschoss',
    wfl: 61, bj: 1974,
    kaufpreis: 248000,
    miete_monat: 620,
    hausgeld_nicht_umlagefaehig: 135,
    grundstueck_qm: 820, mea: 0.071,
    brw: 150,
    rnd: 32
  };

  /* ── Gegenprobe beim Laden ──────────────────────────────────────
     Eine zweite Rechenstrecke ist nur dann keine zweite Wahrheit, wenn
     sie beweisbar dasselbe liefert. */
  function probe() {
    var r = rechne({ rnd: S.RND.von });
    var paare = [
      ['Bodenwert', r.boden, S.KPA.boden_angesetzt],
      ['Gebäudeanteil', r.geb_mit, S.KPA.gebaeude_mit],
      ['AfA', r.afa, S.AFA.kurz.jahr],
      ['Verkehrswert', r.verkehrswert, S.EW.verkehrswert],
      ['Rate', r.rate_monat, S.FIN.rate_monat],
      ['Cashflow nach Steuern', r.cf_nach_monat, S.CF.mit.nach_steuer_monat]
    ];
    var schief = paare.filter(function (p) { return Math.abs(p[1] - p[2]) > 1; });
    if (schief.length) {
      console.warn('demo-rechner: weicht von der Rechenbasis ab →',
        schief.map(function (p) {
          return p[0] + ': ' + Math.round(p[1]) + ' statt ' + Math.round(p[2]);
        }).join(' · '));
    }
    return schief.length === 0;
  }

  window.DP_RECHNER = {
    rechne: rechne, score: score, stufe: stufe, AHORN: AHORN, probe: probe
  };
  probe();
})();
