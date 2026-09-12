/* ═══════════════════════════════════════════════════════════════════════
   erbbau-engine.js · v1312 · Erbbaurecht rechnen statt raten
   ═══════════════════════════════════════════════════════════════════════

   WARUM ES DAS GIBT
   Eine Marktbewertung - egal ob GeoMap/Real Estate Pilot, Sprengnetter oder
   PriceHubble - liefert IMMER den Wert des Volleigentums. Gemessen am
   11.09.2026: keiner der drei Anbieter nimmt einen Erbbau-Parameter
   entgegen (GeoMap quittiert leasehold / heritableBuildingRight /
   groundLease / erbbaurecht / erbpacht samt und sonders mit
   400 "Unrecognized field"). Wer eine Erbbaurechts-Wohnung gegen so einen
   Wert haelt, vergleicht Aepfel mit Birnen - und zwar um 5 bis 50 Prozent
   daneben.

   DER STANDARD, NACH DEM GERECHNET WIRD
   § 50 ImmoWertV 2021 (finanzmathematischer Wert des Erbbaurechts). Die
   steuerliche Schwester § 193 BewG rechnet dieselbe Mechanik, nur mit
   festen Zinssaetzen aus Anlage 21/26. Beide addieren drei Groessen:

     Erbbaurechtswert = Wert des fiktiven Volleigentums
                      - Bodenwert des fiktiv unbelasteten Grundstuecks
                      + Barwert der Erbbauzins-Differenz ueber die Restlaufzeit
                      - Barwert des bei Zeitablauf NICHT entschaedigten
                        Gebaeudewertanteils

   Der Abschlag, den wir suchen, ist die Differenz zum Volleigentum:

     Abschlag = Bodenwert
              - Barwert(angemessener Erbbauzins - vertraglicher Erbbauzins)
              + Barwert(nicht entschaedigter Gebaeudeanteil)

   Lesart der zweiten Zeile: wer WENIGER Erbbauzins zahlt als marktueblich
   waere, hat einen Vorteil - der mindert den Abschlag. Wer MEHR zahlt, hat
   einen Nachteil, und der Abschlag waechst ueber den Bodenwert hinaus.

   WAS DIESE DATEI NICHT TUT
   Sie liest kein DOM, sie schreibt kein DOM, sie kennt calc() nicht. Reine
   Funktionen, ein Eingabeobjekt rein, ein Ergebnisobjekt raus - wie
   dscr-engine.js und deal-kpis.js. Wer den Wert braucht, ruft hier an.

   Quellen (abgerufen 11.09.2026):
   - gesetze-im-internet.de/immowertv_2022 §§ 48-52
   - dejure.org/gesetze/BewG/193 (Liegenschaftszinssaetze Abs. 4 S. 3)
   - dejure.org/gesetze/ErbbauRG/27 (Entschaedigung, 2/3-Mindestregel)
   ═══════════════════════════════════════════════════════════════════════ */
(function (W) {
  'use strict';

  /* ── Voreinstellungen ────────────────────────────────────────────────
     Alles ueberschreibbar. Die Zahlen sind Marktmitte, keine Wahrheit. */

  /* Angemessener Erbbauzinssatz bei Neubestellung, Wohnen.
     Marktueblich 3-5 % vom Bodenwert; Schnitt 2023 lag bei 3-4 %,
     kommunale und kirchliche Ausgeber liegen darunter (Berlin: 2,25 %). */
  var ZINSSATZ_ANGEMESSEN = 3.5;

  /* Kapitalisierungszinssatz. § 193 Abs. 4 S. 3 BewG staffelt nach Art:
     EFH/ZFH 2,5 · MFH 3,5 · gemischt bis 50 % gewerbl. 4,5 ·
     ueber 50 % gewerbl. 5,0 · Geschaeftsgrundstueck 6,0.
     Liegt ein oertlicher Liegenschaftszinssatz vor, schlaegt der das. */
  var LIZ_NACH_ART = {
    efh: 2.5, zfh: 2.5, dhh: 2.5, rh: 2.5, rmh: 2.5,
    etw: 3.5, mfh: 3.5, whg: 3.5,
    gemischt: 4.5, buero: 4.5,
    gew: 5.0, gewerbe: 5.0, hotel: 5.0, gar: 5.0,
    gesch: 6.0, geschaeft: 6.0
  };
  var LIZ_STANDARD = 3.5;

  /* Entschaedigung fuer das Bauwerk bei Zeitablauf, § 27 ErbbauRG.
     Fuer Wohnraum ist zwei Drittel des Verkehrswerts das gesetzliche
     Minimum, von dem der Grundstueckseigentuemer nicht nach unten
     abweichen darf. Viele Vertraege schreiben genau das. */
  var ENTSCHAEDIGUNG_PCT = 66.67;

  /* Markt-Erfahrungswerte fuer die Plausibilitaetsampel. Das sind
     BEOBACHTETE Kaufpreisabschlaege, keine Rechnung - sie pruefen nur, ob
     das Rechenergebnis in der Welt vorkommt. Banken setzen bei der
     Beleihung ueblicherweise 15-30 % an. */
  var MARKT_SPANNEN = [
    { abJahre: 70, von: 5,  bis: 15, text: 'lange Restlaufzeit' },
    { abJahre: 40, von: 15, bis: 30, text: 'mittlere Restlaufzeit' },
    { abJahre: 20, von: 30, bis: 50, text: 'kurze Restlaufzeit' },
    { abJahre: 0,  von: 50, bis: 80, text: 'sehr kurze Restlaufzeit' }
  ];

  /* ── Bausteine ──────────────────────────────────────────────────────── */

  function _zahl(x) {
    var n = (typeof x === 'string') ? parseFloat(String(x).replace(/\./g, '').replace(',', '.')) : x;
    return (typeof n === 'number' && isFinite(n)) ? n : null;
  }

  /* Rentenbarwertfaktor (Vervielfaeltiger): was sind n Jahresraten von 1 EUR
     heute wert? Bei i = 0 sind es schlicht n Raten. */
  function barwertfaktor(i, n) {
    if (!(n > 0)) return 0;
    if (!(i > 0)) return n;
    return (1 - Math.pow(1 + i, -n)) / i;
  }

  /* Abzinsungsfaktor: was ist 1 EUR in n Jahren heute wert? */
  function abzinsfaktor(i, n) {
    if (!(n > 0)) return 1;
    if (!(i > 0)) return 1;
    return Math.pow(1 + i, -n);
  }

  /* Kapitalisierungszinssatz zur Objektart. Unbekannte Art faellt auf den
     Standard - nie auf 0, das wuerde jede Abzinsung ausschalten. */
  function zinsFuerArt(art) {
    if (!art) return LIZ_STANDARD;
    var k = String(art).toLowerCase().replace(/[^a-z]/g, '');
    return LIZ_NACH_ART[k] != null ? LIZ_NACH_ART[k] : LIZ_STANDARD;
  }

  /* Marktspanne zur Restlaufzeit. */
  function marktSpanne(restlaufzeit) {
    var n = _zahl(restlaufzeit);
    if (n == null) return null;
    for (var i = 0; i < MARKT_SPANNEN.length; i++) {
      if (n >= MARKT_SPANNEN[i].abJahre) return MARKT_SPANNEN[i];
    }
    return MARKT_SPANNEN[MARKT_SPANNEN.length - 1];
  }

  /* ── Der Rechenkern ─────────────────────────────────────────────────── */

  /**
   * compute(e) - Erbbaurechtswert und Abschlag nach § 50 ImmoWertV.
   *
   * Eingabe (alles optional ausser volleigentum, bodenwert, restlaufzeit):
   *   volleigentum      Wert des fiktiven Volleigentums in EUR (Marktbewertung
   *                     oder Verkehrswert - der Wert, als gaebe es kein Erbbaurecht)
   *   bodenwert         Bodenwert des fiktiv unbelasteten Grundstuecks in EUR,
   *                     bei ETW der MEA-Anteil
   *   restlaufzeit      Restlaufzeit des Erbbaurechts in Jahren
   *   erbbauzins        vertraglich vereinbarter Erbbauzins in EUR pro Jahr
   *   zinssatzAngemessen  angemessener Erbbauzinssatz in % (Vorgabe 3,5)
   *   kapitalzins       Kapitalisierungszinssatz in % (schlaegt objektart)
   *   objektart         'etw' | 'efh' | 'mfh' | 'gemischt' | ... (fuer den Zins)
   *   restnutzungsdauer Restnutzungsdauer des Gebaeudes in Jahren
   *   entschaedigungPct Entschaedigung bei Zeitablauf in % des Gebaeudewerts
   *                     (Vorgabe 66,67 - das gesetzliche Minimum fuer Wohnraum)
   *
   * Ausgabe: { ok, erbbaurechtswert, abschlag, abschlagPct, teile{...},
   *            annahmen{...}, hinweise[], markt{...} }
   * Bei fehlenden Pflichtangaben: { ok:false, fehlt:[...] } - kein halber Wert.
   */
  function compute(e) {
    e = e || {};
    var out = { ok: false, fehlt: [], hinweise: [] };

    var voll = _zahl(e.volleigentum);
    var bw   = _zahl(e.bodenwert);
    var rlz  = _zahl(e.restlaufzeit);

    if (!(voll > 0)) out.fehlt.push('volleigentum');
    if (!(bw >= 0) || bw == null) out.fehlt.push('bodenwert');
    if (!(rlz > 0)) out.fehlt.push('restlaufzeit');
    if (out.fehlt.length) {
      /* Regel aus der Wertermittlung: kein Verfahren rechnet halb. Fehlt
         eine Pflichtangabe, kommt kein Wert - auch kein vorsichtiger. */
      return out;
    }

    var zsAng = _zahl(e.zinssatzAngemessen);
    if (!(zsAng > 0)) zsAng = ZINSSATZ_ANGEMESSEN;

    var liz = _zahl(e.kapitalzins);
    if (!(liz > 0)) liz = zinsFuerArt(e.objektart);
    var i = liz / 100;

    var ent = _zahl(e.entschaedigungPct);
    if (ent == null || ent < 0) ent = ENTSCHAEDIGUNG_PCT;
    if (ent > 100) ent = 100;

    /* 1 · Wertanteil der baulichen Anlagen = Volleigentum minus Boden.
           Das ist der Teil, der dem Erbbauberechtigten gehoert. */
    var gebaeudeanteil = Math.max(0, voll - bw);

    /* 2 · Erbbauzins-Differenz, kapitalisiert.
           angemessen = Bodenwert x angemessener Zinssatz
           vertraglich = was tatsaechlich gezahlt wird
           Positiv = der Vertrag ist guenstiger als der Markt = Vorteil. */
    var zinsAngemessenEur = bw * (zsAng / 100);
    var zinsVertragEur = _zahl(e.erbbauzins);
    var zinsBekannt = (zinsVertragEur != null && zinsVertragEur >= 0);
    if (!zinsBekannt) {
      /* Ohne Vertragszins nehmen wir an, der Vertrag sei marktgerecht -
         die Differenz ist dann null. Das ist die neutrale Annahme, aber
         sie muss auf den Tisch: gerade alte Vertraege liegen oft weit
         darunter, und genau darin steckt der halbe Wert. */
      zinsVertragEur = zinsAngemessenEur;
      out.hinweise.push('Kein Erbbauzins angegeben - gerechnet wird mit einem marktgerechten Vertrag. ' +
        'Alte Vertraege liegen oft deutlich darunter; dann faellt der Abschlag kleiner aus.');
    }
    var bwf = barwertfaktor(i, rlz);
    var zinsvorteil = (zinsAngemessenEur - zinsVertragEur) * bwf;

    /* 3 · Nicht entschaedigter Gebaeudewertanteil bei Zeitablauf.
           Nur relevant, wenn das Gebaeude den Vertrag ueberlebt: laeuft die
           Restnutzungsdauer vorher aus, ist bei Zeitablauf ohnehin nichts
           mehr da, was entschaedigt werden koennte. */
    var rnd = _zahl(e.restnutzungsdauer);
    var azf = abzinsfaktor(i, rlz);
    var heimfall = 0;
    var restGeb = 0;
    if (rnd != null && rnd > rlz) {
      /* Linearer Restwert des Gebaeudes am Ende der Vertragslaufzeit -
         so rechnet auch § 193 Abs. 5 BewG. */
      restGeb = gebaeudeanteil * ((rnd - rlz) / rnd);
      heimfall = restGeb * (1 - ent / 100) * azf;
    } else if (rnd == null) {
      out.hinweise.push('Keine Restnutzungsdauer angegeben - der Heimfall bleibt unberuecksichtigt. ' +
        'Ueberlebt das Gebaeude den Vertrag, faellt der Abschlag hoeher aus.');
    }

    /* Zusammensetzen. */
    var wert = gebaeudeanteil + zinsvorteil - heimfall;
    if (wert < 0) wert = 0;
    var abschlag = voll - wert;
    var abschlagPct = voll > 0 ? (abschlag / voll * 100) : 0;

    /* Marktampel: liegt die Rechnung in dem, was am Markt beobachtet wird? */
    var sp = marktSpanne(rlz);
    var markt = null;
    if (sp) {
      markt = {
        von: sp.von, bis: sp.bis, text: sp.text,
        imRahmen: (abschlagPct >= sp.von - 5 && abschlagPct <= sp.bis + 5)
      };
      if (!markt.imRahmen) {
        out.hinweise.push('Der gerechnete Abschlag von ' + abschlagPct.toFixed(1) + ' % liegt ausserhalb der ' +
          'Spanne, die bei ' + sp.text + ' (' + sp.von + '-' + sp.bis + ' %) am Markt beobachtet wird. ' +
          'Das kann stimmen - ein sehr guenstiger oder sehr teurer Erbbauzins wirkt genau so. ' +
          'Vertragszins, Restlaufzeit und Bodenwert bitte gegenlesen.');
      }
    }

    if (rlz < 30) {
      out.hinweise.push('Unter 30 Jahren Restlaufzeit finanzieren die meisten Banken nicht mehr voll - ' +
        'die Tilgung muss dann innerhalb der Restlaufzeit durch sein. Das trifft den Wiederverkauf haerter ' +
        'als die Rechnung zeigt.');
    }

    out.ok = true;
    out.erbbaurechtswert = wert;
    out.abschlag = abschlag;
    out.abschlagPct = abschlagPct;
    out.teile = {
      gebaeudeanteil: gebaeudeanteil,
      bodenwert: bw,
      zinsAngemessenEur: zinsAngemessenEur,
      zinsVertragEur: zinsVertragEur,
      zinsvorteil: zinsvorteil,
      barwertfaktor: bwf,
      abzinsfaktor: azf,
      gebaeuderestwertBeiAblauf: restGeb,
      heimfallabschlag: heimfall
    };
    out.annahmen = {
      zinssatzAngemessen: zsAng,
      kapitalzins: liz,
      entschaedigungPct: ent,
      restlaufzeit: rlz,
      restnutzungsdauer: rnd,
      zinsGeschaetzt: !zinsBekannt,
      quelle: '§ 50 ImmoWertV 2021, Zinssaetze nach § 193 Abs. 4 BewG, Entschaedigung § 27 ErbbauRG'
    };
    out.markt = markt;
    return out;
  }

  /**
   * schnellabschlag(restlaufzeit) - die Marktmitte als Prozentzahl, wenn
   * ausser der Restlaufzeit nichts bekannt ist. Fuer die Ampel in der
   * Objektkarte, NICHT fuer die Bewertung.
   */
  function schnellabschlag(restlaufzeit) {
    var sp = marktSpanne(restlaufzeit);
    if (!sp) return null;
    return { pct: (sp.von + sp.bis) / 2, von: sp.von, bis: sp.bis, text: sp.text };
  }

  W.Erbbau = {
    compute: compute,
    schnellabschlag: schnellabschlag,
    barwertfaktor: barwertfaktor,
    abzinsfaktor: abzinsfaktor,
    zinsFuerArt: zinsFuerArt,
    marktSpanne: marktSpanne,
    ZINSSATZ_ANGEMESSEN: ZINSSATZ_ANGEMESSEN,
    ENTSCHAEDIGUNG_PCT: ENTSCHAEDIGUNG_PCT,
    LIZ_NACH_ART: LIZ_NACH_ART
  };
})(window);
