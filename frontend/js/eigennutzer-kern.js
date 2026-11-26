/* eigennutzer-kern.js · v5120ii6 · DEMO-KERN (aus FF6 demo-eigennutzer.js übernommen, 26.11.2026)
   Nur aktiv über eigennutzer-qc-demo.js / eigennutzer-app-demo.js und nur auf Staging (Demo-Schalter).
   Vor einem echten Rollout: als Kern sauber schneiden, Annahmen in config, ins Backend spiegeln (rechenkerne-spiegeln).
   Ursprung: · Eigennutzer-Check „Ist das Haus gut?“
   NUR DEMO. Rechnet im Browser mit echten öffentlichen Daten von Staging und festen Annahmen.
   Alle Annahmen stehen hier als Kommentar. Kein Kern, nichts wird gespeichert.

   Datenquellen (öffentlich, dieselben wie der Landing-Deal-Check):
     ZINS   GET /api/v1/market-rates/bauzins   → indicativeRates[bindung][stufe]
            Stufe nach Beleihung (LTV): ≤60 premium, ≤80 standard, ≤90 schwach, sonst voll (stufen_ltv der Antwort).
     MIETE  GET /api/v1/market-stats/schnellcheck?plz&baujahr&wfl → vergleichsmiete.qm (Mittelwert der Zelle)
            Eigennutzer: ersparte Miete = MITTELWERT, nicht Oberwert (Investorenlogik gilt hier nicht,
            der Selbstnutzer spart die übliche Miete, nicht die höchstmögliche).
     LAGE   dieselbe Antwort: makrolage.wert (0–100), leerstand.ton, bevoelkerung.wert
   Rückfall ohne Netz: Zins 4,09 % (10 J standard, Stand 25.11.2026), Miete 7,87 €/m², Makrolage 51.

   ANNAHMEN (Demo):
     Kaufnebenkosten 10 % (GrESt NRW 6,5 % + Notar/Grundbuch ~2 % + Puffer), Tilgung 2 %, Zinsbindung 10 J.
     Bewirtschaftung Eigennutzer 3,00 €/m² mtl. (Nebenkosten, die ein Mieter auch zahlt, sind NICHT drin,
       nur Instandhaltung 1,50 €/m² und Versicherung/Grundsteuer-Anteil 1,50 €/m², die ein Mieter nicht trägt).
     Wertentwicklung 1,5 % p. a., Mietsteigerung 2,0 % p. a., Anlagezins Mieter 3,0 % p. a.
     Leistbarkeit: Wohnkosten (Rate + Bewirtschaftung) / Netto-Haushaltseinkommen.

   SCORE (Demo-Gewichte, Marcel entscheidet):
     Preis 30 · Zustand 20 · Lage 20 · Leistbarkeit 30. Stufen wie ScoreTier (≥85 Sehr gut, ≥70 Gut, ≥50 Solide, ≥35 Schwach, sonst Kritisch).
*/
(function () {
  var API = (location.origin || '') + '/api/v1';
  var RUECK = { zins: 4.09, miete: 7.87, makro: 51, leer: 'gut', bev: 0.13, gebiet: 'Bielefeld, Stadt', quelle: 'Rückfall' };

  function lin(x, pts) { /* stückweise linear über [[x,y],…], x aufsteigend */
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
      var a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    }
    return pts[pts.length - 1][1];
  }
  function stufe(s) {
    if (s >= 85) return { wort: 'Sehr gut', ton: 'gut' };
    if (s >= 70) return { wort: 'Gut', ton: 'gut' };
    if (s >= 50) return { wort: 'Solide', ton: 'mittel' };
    if (s >= 35) return { wort: 'Schwach', ton: 'schlecht' };
    return { wort: 'Kritisch', ton: 'schlecht' };
  }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }

  /* Zustands-Hinweise nach Baujahr: gekürzt aus besichtigung.js (Baujahresklassen) */
  function zustand(bj) {
    if (bj >= 2010) return { s: 90, p: ['Gewährleistung und Bauabnahme prüfen', 'Lüftungsanlage und Wartung', 'Energieausweis mit Bedarfswerten'] };
    if (bj >= 1995) return { s: 75, p: ['Wärmedämmfassade auf Risse prüfen', 'Fenster und Lüftung', 'Heizung ab 30 Jahren tauschen'] };
    if (bj >= 1978) return { s: 60, p: ['Asbest möglich bis 1993', 'Flachdach und Isolierglas', 'Heizung oft schon über 30 Jahre'] };
    if (bj >= 1949) return { s: 45, p: ['Asbest, PCB und Bleileitungen möglich', 'kaum Dämmung, hohe Energiekosten', 'Elektrik und Bäder oft veraltet'] };
    return { s: 40, p: ['Holzbalkendecken und Feuchte', 'Elektrik erneuern', 'Denkmalschutz prüfen'] };
  }

  function rechne(e, d) {
    var kp = e.kp, wfl = e.wfl, bj = e.bj, ek = e.ek, netto = e.netto;
    var nk = kp * 0.10, darlehen = Math.max(0, kp + nk - ek);
    var ltv = darlehen / kp * 100;
    var zins = d.zinsFn(ltv);
    var rate = darlehen * (zins + 2) / 100 / 12;
    var bew = wfl * 3.0;
    /* ersparte Miete im Monat. Demo-Annahme: Einfamilienhaus mit 15 % Hauszuschlag auf die Wohnungs-Vergleichsmiete
       (Mietspiegel nennen 10 bis 25 %, Bielefeld schließt Häuser aus, dann Näherung plus Zuschlag). */
    var miete = d.mieteQm * 1.15 * wfl;
    var faktor = kp / (miete * 12);                   /* Kaufpreis in Jahresmieten */
    var sPreis = Math.round(lin(faktor, [[18, 100], [22, 85], [26, 65], [30, 45], [35, 20], [40, 5]]));
    var z = zustand(bj);
    var sLage = Math.round(Math.max(0, Math.min(100, d.makro + (d.leer === 'gut' ? 6 : d.leer === 'schlecht' ? -6 : 0) + (d.bev > 0.3 ? 4 : d.bev < -0.3 ? -4 : 0))));
    var quote = netto > 0 ? (rate + bew) / netto * 100 : null;
    var sLeist = quote == null ? null : Math.round(lin(quote, [[25, 100], [30, 90], [35, 72], [40, 50], [45, 30], [55, 5]]));
    var gew = sLeist == null ? { p: 0.43, z: 0.285, l: 0.285, f: 0 } : { p: 0.30, z: 0.20, l: 0.20, f: 0.30 };
    var gesamt = Math.round(sPreis * gew.p + z.s * gew.z + sLage * gew.l + (sLeist || 0) * gew.f);

    /* Kaufen gegen Mieten: Vermögen nach Jahren
       Käufer: Wert(t) − Restschuld(t). Mieter: EK + NK angelegt zu 3 % plus jährlich (Wohnkosten Kauf − Miete) angelegt. */
    var reihe = [], wert = kp, schuld = darlehen, depot = ek, mieteJ = miete * 12, jahr = null;
    for (var t = 0; t <= 20; t++) {
      var kauf = wert - schuld, mieten = depot;
      reihe.push({ t: t, kauf: kauf, mieten: mieten });
      if (jahr == null && t > 0 && kauf >= mieten) jahr = t;
      var zinsJ = schuld * zins / 100, tilgJ = Math.min(schuld, rate * 12 - zinsJ);
      schuld = Math.max(0, schuld - tilgJ);
      wert *= 1.015;
      var kostenKauf = rate * 12 + bew * 12;
      depot = depot * 1.03 + Math.max(0, kostenKauf - mieteJ);
      mieteJ *= 1.02;
    }
    return {
      gesamt: gesamt, stufe: stufe(gesamt), zins: zins, rate: rate, bew: bew, miete: miete, faktor: faktor,
      quote: quote, darlehen: darlehen, ltv: ltv, jahr: jahr, reihe: reihe, gebiet: d.gebiet, quelle: d.quelle,
      gruppen: [
        { k: 'Preis', s: sPreis, t: 'Du zahlst ' + faktor.toFixed(1).replace('.', ',') + ' Jahresmieten. Üblich sind rund 22 bis 26.' },
        { k: 'Zustand', s: z.s, t: 'Baujahr ' + bj + ': ' + z.p[0] + '.', punkte: z.p },
        { k: 'Lage', s: sLage, t: 'Makrolage ' + d.makro + ' von 100, Leerstand ' + (d.leer === 'gut' ? 'niedrig' : 'erhöht') + '.' },
        { k: 'Leistbarkeit', s: sLeist, t: quote == null ? 'Netto-Einkommen eintragen, dann rechnen wir die Belastung.' : 'Wohnkosten ' + Math.round(quote) + ' % vom Netto-Einkommen.' }
      ]
    };
  }

  function daten(plz, bj, wfl) {
    var d = { zinsFn: function () { return RUECK.zins; }, mieteQm: RUECK.miete, makro: RUECK.makro, leer: RUECK.leer, bev: RUECK.bev, gebiet: RUECK.gebiet, quelle: RUECK.quelle };
    var z = fetch(API + '/market-rates/bauzins').then(function (r) { return r.json(); }).then(function (j) {
      var ir = j.indicativeRates && j.indicativeRates['10'], st = j.stufen_ltv || { premium: 60, standard: 80, schwach: 90, voll: 100 };
      if (ir) d.zinsFn = function (ltv) {
        var k = ltv <= st.premium ? 'premium' : ltv <= st.standard ? 'standard' : ltv <= st.schwach ? 'schwach' : 'voll';
        return ir[k];
      };
    }).catch(function () {});
    var m = fetch(API + '/market-stats/schnellcheck?plz=' + encodeURIComponent(plz) + '&baujahr=' + bj + '&wfl=' + wfl)
      .then(function (r) { return r.json(); }).then(function (j) {
        if (j.vergleichsmiete && j.vergleichsmiete.qm) { d.mieteQm = j.vergleichsmiete.qm; d.quelle = j.vergleichsmiete.quelle === 'mietspiegel' ? 'Mietspiegel' : 'DealPilot-Näherung'; }
        if (j.makrolage && j.makrolage.wert != null) d.makro = j.makrolage.wert;
        if (j.leerstand && j.leerstand.ton) d.leer = j.leerstand.ton;
        if (j.bevoelkerung && j.bevoelkerung.wert != null) d.bev = j.bevoelkerung.wert;
        if (j.gebiet) d.gebiet = j.gebiet;
      }).catch(function () {});
    return Promise.all([z, m]).then(function () { return d; });
  }

  window.DpEigennutzerKern = { rechne: rechne, daten: daten, eur: eur, stufe: stufe };
})();
