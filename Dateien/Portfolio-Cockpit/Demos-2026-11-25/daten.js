/* Echte Werte des Staging-Demokontos, gelesen am 24.11.2026 aus
   DealPilotDashboard.portfolioPayload(), .zielbildPayload(), .steuerKetteDaten(), .blickDaten()
   und dp_investment_profile (nur lesend, nichts gespeichert). 18 Objekte im Bestand.
   Hölderlinstr. 1 führt im Datensatz 7331 m² Wohnfläche, gemeint sind 73,31 m² (hier 73). */
window.DPD = (function () {
  // name;ort;art;lage;zustand;energie;leer%;we;bj;wfl;kp;mieteJ;cfNs;cfVs;ek;darl;rest;tilgJ;zinsJ;zb;score;empf;dscr;zins%;ltv%
  var roh = [
    'Westerfeldstr. 146;Bielefeld;MFH;B;normal;B;10;6;1967;390;545000;39420;4936;4061;74592;472415;463444;4724;18897;2034-12;68;Optimieren;1.18;4;86.68',
    'Musterhof 8;Herford;MFH;B;normal;D;2;5;1972;390;465000;31500;5781;11984;149125;372000;316745;9300;4278;2036-01;76;;1.9;1.15;80',
    'Demostraße 5;Herford;ETW;;normal;D;2;1;1972;68;145000;7920;-703;-1216;35000;125000;117996;2500;4750;2034-02;65;Verkauf prüfen;0.91;3.8;86.21',
    'Westerfeldstr. 140;Bielefeld;MFH;B;normal;B;10;6;1967;390;545000;34740;3990;-446;74592;472415;463444;4724;18897;2034-12;60;Halten;1;4;86.68',
    'Musterweg 7;Herford;ETW;B;normal;D;2;1;1994;74;219000;7680;-2799;-4623;84073;175200;164402;3504;6745;2033-11;49;;0.55;3.85;80',
    'Am Quittengarten 12;Bünde;MFH;B;normal;D;2;8;1966;560;740000;55080;4384;-716;231768;592000;576637;8880;27765;2035-02;70;Halten;1.24;4.69;80',
    'Gohliser Str. 42;Leipzig;MFH;A;normal;D;0;12;1938;852;1680000;95160;9678;16326;474536;1420000;1393035;14200;56800;2034-12;77;Halten;1.23;4;84.52',
    'Musterallee 12;Herford;MFH;B;;E;2;6;1972;412;640000;33000;-679;-586;258441;512000;480400;10240;20224;2033-11;;Prüfen;0.98;3.95;80',
    'Musterring 40;Bielefeld;MFH;B;;F;2;4;1958;286;455000;28260;2439;4917;207799;364000;345615;7280;13650;2034-05;;;1.24;3.75;80',
    'Mustergasse 3;Bielefeld;ETW;B;;F;2;1;1965;59;149000;6240;-9636;-10289;58375;119200;111683;2980;4351;2039-05;;Verkauf prüfen;0.61;3.65;80',
    'Hölderlinstr. 1;Bad Oeynhausen;ETW;B;normal;D;0;1;1983;73;125000;7920;1035;1035;42963;106250;105984;1063;4144;2036-08;64;Optimieren;1.18;3.9;94.52',
    'Ravensberger Weg 38;Bielefeld;MFH;B;normal;D;0;8;1978;606;1240000;67080;9919;9928;430748;980000;906331;9800;39200;2030-04;69;Halten;1.21;4;79.03',
    'Bismarckstr. 27;Detmold;MFH;A;gut;E;0;6;1908;546;850000;45120;-882;-4065;276045;691000;666404;6910;27640;2033-06;62;Optimieren;0.89;4;81.29',
    'Musterstraße 12;Leipzig;ETW;B;gut;B;0;1;1998;68;189000;9360;344;-1021;13135;200000;196219;2000;7000;2035-01;55;Optimieren;0.86;3.5;90.91',
    'Parkstr. 9;Bad Oeynhausen;MFH;C;renovierungsbedürftig;G;0;5;1905;427;395000;39420;9390;15386;262392;324000;317847;3240;12960;2035-01;77;Halten;1.96;4;82.03',
    'Am Markt 9;Kabelsketal;ETW;C;normal;C;0;1;1998;118;132000;8880;1080;1080;16196;132000;127372;1980;4620;2034-08;81;Optimieren;1.16;3.5;100',
    'Hermannstraße 9;Hüllhorst;ETW;C;gut;C;0;1;1962;100;200000;13200;4690;5930;47540;180000;179398;1800;5400;2036-07;74;Halten;1.82;3;90',
    'Bäckerstr. 7;Minden;ETW;B;renovierungsbedürftig;D;0;1;1928;78;165000;9660;-1200;-1985;30721;165000;161068;3300;6435;2035-08;36;Optimieren;0.8;3.9;100'
  ];
  // Bestand · Soll · Zielbild je Objekt (zielbildPayload.je_objekt): stufe;mieteB;mieteZ;massn;ewB;ewZ;zuwachsNK;rndB;rndZ
  var bsz = [
    'zielbild;38340;43384;62000;735000;880000;83000;26.3;30.5',
    'zielbild;31500;42430;62000;515000;715000;138000;32.8;37.4',
    'zielbild;7440;7440;0;111000;148000;37000;39.7;39.7',
    'zielbild;33660;43384;62000;710000;880000;108000;26.3;30.5',
    'zielbild;7680;8951;0;139000;199000;60000;52.6;52.6',
    'zielbild;52200;56683;0;580000;745000;165000;21.5;21.5',
    'zielbild;94080;99228;85500;1750000;2110000;274500;36.7;39.1',
    'zielbild;31920;43903;0;535000;665000;130000;27.8;27.8',
    'zielbild;27420;31208;0;344000;395000;51000;16.8;16.8',
    'zielbild;6240;6508;0;85000;115000;30000;32.3;32.3',
    'bestand;7920;7920;0;;;;;',
    'bestand;67080;67080;0;;;;;',
    'zielbild;44040;59194;21000;860000;1075000;194000;36.7;36.7',
    'bestand;9360;9360;0;;;;;',
    'zielbild;38340;45528;136000;499000;515000;-120000;32;34.4',
    'mieterhoehung;8400;10080;0;163000;165000;2000;52;52',
    'bestand;13200;13200;0;;;;;',
    'mieterhoehung;9360;11232;0;81000;81000;0;12;12'
  ];
  // Steuerwirkung auf den Cashflow (steuerKetteDaten): Kaufjahr, Ergebnis V+V, Wirkung (+ = Steuer sinkt)
  var steuer = {
    'Ravensberger Weg 38': [2020, 20, -9], 'Musterhof 8': [2021, 13199, -6204], 'Bismarckstr. 27': [2023, -6774, 3184],
    'Musterweg 7': [2023, -3880, 1824], 'Musterallee 12': [2023, 203, -95], 'Demostraße 5': [2024, -1090, 511],
    'Mustergasse 3': [2024, -1387, 652], 'Musterring 40': [2024, 5273, -2479], 'Musterstraße 12': [2024, -3282, 1543],
    'Gohliser Str. 42': [2024, 14146, -6649], 'Parkstr. 9': [2024, 12758, -5926], 'Westerfeldstr. 140': [2025, -9584, 4435],
    'Westerfeldstr. 146': [2025, -1861, 875], 'Am Quittengarten 12': [2025, -10851, 5099], 'Bäckerstr. 7': [2025, -4380, 2059],
    'Hermannstraße 9': [2026, 1654, -778], 'Am Markt 9': [2026, -1758, 0], 'Hölderlinstr. 1': [2026, -1430, 0]
  };
  var gmbh = { 'Am Markt 9': 1, 'Hölderlinstr. 1': 1 };
  function n(v) { return v === '' || v == null ? null : Number(v); }
  var objekte = roh.map(function (z, i) {
    var a = z.split(';'), b = bsz[i].split(';');
    var o = {
      i: i, name: a[0], ort: a[1], art: a[2], lage: a[3] || null, zustand: a[4] || null, energie: a[5] || null,
      leer: n(a[6]), we: n(a[7]), bj: n(a[8]), wfl: n(a[9]), kp: n(a[10]), mieteJ: n(a[11]), cfNs: n(a[12]), cfVs: n(a[13]),
      ek: n(a[14]), darl: n(a[15]), rest: n(a[16]), tilgJ: n(a[17]), zinsJ: n(a[18]), zb: a[19], score: n(a[20]), empf: a[21] || null,
      dscr: n(a[22]), zins: n(a[23]), ltv: n(a[24]),
      stufe: b[0], mieteB: n(b[1]), mieteZ: n(b[2]), massn: n(b[3]), ewB: n(b[4]), ewZ: n(b[5]), zuwachs: n(b[6]), rndB: n(b[7]), rndZ: n(b[8])
    };
    var s = steuer[o.name] || [null, null, null];
    o.kaufjahr = s[0]; o.ergVV = s[1]; o.steuerWirkung = s[2]; o.halter = gmbh[o.name] ? 'Demo Immobilien GmbH' : 'Privat';
    o.wert = o.ewB != null ? o.ewB : o.kp;            // Wertansatz: Ertragswert Bestand, sonst Kaufpreis
    o.wertQuelle = o.ewB != null ? 'Ertragswert Bestand' : 'Kaufpreis';
    o.ekHeute = o.wert - o.rest;
    o.zbJahr = Number(o.zb.slice(0, 4)) + (Number(o.zb.slice(5, 7)) - 1) / 12;
    o.zbRest = o.zbJahr - (2026 + 10.8 / 12);
    o.restZb = Math.max(0, o.rest - o.tilgJ * Math.max(0, o.zbRest)); // grob, ohne Tilgungsanstieg
    o.kapDienst = o.zinsJ + o.tilgJ;
    o.coc = o.ek > 0 ? o.cfVs / o.ek * 100 : null;
    o.mehrMiete = o.mieteZ - o.mieteB;
    o.qmMiete = o.wfl ? o.mieteJ / 12 / o.wfl : null;
    return o;
  });
  return {
    stand: '24.11.2026', heute: 2026 + 10.8 / 12,
    objekte: objekte,
    ziele: { minDscr: 1.2, minCfVs: 0, maxLtv: 90 },
    summe: { n: 18, kp: 8879000, gi: 10336158, ek: 2768041, darl: 7402480, rest: 7094023, mieteJ: 539640, cfVsJ: 45699, cfNsJ: 41763,
      tilgJ: 98425, zinsJ: 283755, kdJ: 382180, brutto: 6.08, netto: 5.87, dscr: 1.41, score: 69, nebenkosten: 1145654 },
    zielbild: { mieteB: 528180, mieteMh: 549367, mieteZ: 606713, massn: 428500, ewB: 7107000, ewZ: 8688000, nachKosten: 8259500, zuwachsNK: 1152500,
      mpiB: 7995000, renditeB: 5.95, renditeZ: 6.52 },
    projektion: [{ j: 0, rest: 7094023, wert: 8879000 }, { j: 1, rest: 6936073, wert: 8879000 }, { j: 5, rest: 6324496, wert: 9610915 }, { j: 10, rest: 5560024, wert: 10611227 }],
    steuer: { zvePrivat: 90000, grenz: 40.45 },
    // Score-Kopf, gemessen im heutigen Portfolio-Cockpit (Staging, 24.11.2026)
    score: { gesamt: 69, wort: 'Solide', vol: 8880000, cfMon: 3808, gezaehlt: '15 von 18 Objekten, nach Kaufpreis gewichtet',
      inv: { wert: 69, anteil: 76, frage: 'Wie gut sind die Immobilien, egal wie sie finanziert sind?', teile: [
        ['Objektrendite', 14.5, 66, 'Bruttorendite · Nettorendite'], ['Risiko & Zustand', 19.7, 74, 'Leerstand · Instandhaltung · Bausubstanz · Energieklasse · Mietausfall · Ausstattung'],
        ['Lage & Markt', 52.6, 69, 'Ist zu Marktmiete · Mietwachstum · Bevölkerung · Nachfrage · Mikrolage'], ['Potenzial & Preis', 13.2, 68, 'Mietsteigerung · Faktor gegen Markt · Wertsteigerung · Entwicklung']] },
      fin: { wert: 68, anteil: 24, frage: 'Trägt die Finanzierung den Bestand?', teile: [
        ['Kapitaldienst & Beleihung', 62.5, 76, 'DSCR · LTV · Zinssatz · Tilgung · EK-Bedarf'], ['Cashflow & EK-Rendite', 37.5, 56, 'Cashflow im Monat · Cash-on-Cash']] } }
  };
})();

/* ── Runde 2 (25.11.2026) ─────────────────────────────────────────────────
   Objektbilder: erstes Objektfoto aus dem Staging-Datensatz (nur gelesen). Ohne Foto die Lagekarte,
   wie sie oben auf den Marktbericht gedruckt wird (gleiche Quelle, gleicher Stil, Lizenzhinweis im Bild).
   Fünf Musteradressen gibt es nicht wirklich, dort zeigt die Karte die Postleitzahl.
   EK-Rendite: Eingaben genau so, wie die App sie je Objekt an ek-rendite.js gibt
   (DealPilotDashboard.ekr4Obj, Staging 25.11.2026): ek; cf_op; steuer; tilg; wert; darlehen0; wstg.
   Gerechnet wird nur in ek-rendite.js (Kopie der App-Datei, nicht nachgebaut). */
(function (D) {
  var bilder = {
    'Demostraße 5': ['750253e6-karte', 'karte'], 'Musterweg 7': ['fc9b94e6-karte', 'plz'], 'Musterhof 8': ['efc78191-karte', 'plz'],
    'Mustergasse 3': ['a9dd8642-karte', 'plz'], 'Gohliser Str. 42': ['a573d1c8', 'foto'], 'Bismarckstr. 27': ['c5278bb5', 'foto'],
    'Am Quittengarten 12': ['3888ccb6', 'foto'], 'Musterstraße 12': ['c650a214', 'foto'], 'Westerfeldstr. 146': ['2dc33474', 'foto'],
    'Musterallee 12': ['50094e78-karte', 'plz'], 'Hermannstraße 9': ['07d89138', 'foto'], 'Ravensberger Weg 38': ['72082555', 'foto'],
    'Musterring 40': ['3b032292-karte', 'plz'], 'Westerfeldstr. 140': ['ae155d38', 'foto'], 'Hölderlinstr. 1': ['a021f2c2', 'foto'],
    'Bäckerstr. 7': ['d65ed5cb', 'foto'], 'Am Markt 9': ['ec2d0f32', 'foto'], 'Parkstr. 9': ['0da7e9b6', 'foto']
  };
  var ekEin = {
    'Demostraße 5': [35000, -1216, -512, 2727, 130000, 125000], 'Musterweg 7': [84073, -4623, -1824, 3504, 219000, 175200],
    'Musterhof 8': [149125, 11984, 6203, 9300, 465000, 372000], 'Mustergasse 3': [58375, -10289, -652, 2980, 149000, 119200],
    'Gohliser Str. 42': [474536, 16326, 6648, 14200, 1814000, 1420000], 'Bismarckstr. 27': [276045, -4065, -3184, 6910, 725000, 691000],
    'Am Quittengarten 12': [231768, -716, -5099, 8880, 700000, 592000], 'Musterstraße 12': [13135, -1021, -1365, 2000, 220000, 200000],
    'Westerfeldstr. 146': [74592, 4061, -875, 5008, 740000, 472415], 'Musterallee 12': [258441, -586, 94, 10240, 640000, 512000],
    'Hermannstraße 9': [47540, 5930, 1240, 1800, 204000, 180000], 'Ravensberger Weg 38': [430748, 9928, 9, 9800, 1314000, 980000],
    'Musterring 40': [207799, 4917, 2479, 7280, 455000, 364000], 'Westerfeldstr. 140': [74592, -446, -4436, 4724, 740000, 472415],
    'Hölderlinstr. 1': [42963, 1035, 0, 1063, 167529, 106250], 'Bäckerstr. 7': [30721, -1985, -785, 3300, 195000, 165000],
    'Am Markt 9': [16196, 1080, 0, 1980, 137000, 132000], 'Parkstr. 9': [262392, 15386, 5996, 3240, 453000, 324000]
  };
  D.objekte.forEach(function (o) {
    var b = bilder[o.name] || [null, null];
    o.bild = b[0] ? 'objektbilder/' + b[0] + '.jpg' : null; o.bildArt = b[1];
    var e = ekEin[o.name];
    o.ekr = e && window.DpEkRendite ? DpEkRendite.rechne({ ek: e[0], cf_op: e[1], steuer: e[2], tilg: e[3], bspar: 0, wert: e[4], darlehen0: e[5], uebergang: null, stichtag: null, wstg: 0.02 }) : null;
  });
  D.ekrP = window.DpEkRendite ? DpEkRendite.portfolio(D.objekte.map(function (o) { return o.ekr; })) : null;
  // Gesamtbewertung wie im heutigen Portfolio-Cockpit (dashboard.js renderGesamtbew): Investiert · Bilanz heute · Nach Bewertung
  var mitEw = D.objekte.filter(function (o) { return o.ewB != null; });
  D.gesamt = {
    kp: D.summe.kp, nk: D.summe.nebenkosten, sonst: D.summe.gi - D.summe.kp - D.summe.nebenkosten, gi: D.summe.gi, darl: D.summe.darl, ek: D.summe.ek,
    wertKp: D.summe.kp, rest: D.summe.rest,
    ewN: mitEw.length, ewS: mitEw.reduce(function (s, o) { return s + o.ewB; }, 0), kpEwS: mitEw.reduce(function (s, o) { return s + o.kp; }, 0),
    mpiS: D.zielbild.mpiB
  };
})(window.DPD);
