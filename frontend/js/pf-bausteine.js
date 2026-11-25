/* Die Module des Portfolio-Cockpits. Jedes Modul zeichnet sich in ein Element (K.modul).
   Die Demos setzen sie unterschiedlich zusammen. Baukasten: jede Funktion hier ist ein Modul. */
/* v4730 · Bausteine der Portfolio-Modul-Engine (aus Demos-2026-11-25d/bausteine.js). Fabrik: je Datenstand neu. */
window.DpPfBausteineF = function (K) {
  'use strict';
  var D = K.D, O = D.objekte, S = D.summe;
  function nach(f, ab) { return O.slice().sort(function (a, b) { return ab ? f(a) - f(b) : f(b) - f(a); }); }

  /* Cashflow vor und nach Steuer je Objekt (Hantel, Monat) */
  function cfVorNach(sel, opt) {
    opt = opt || {};
    K.modul(sel, function (w) {
      var os = nach(function (o) { return o.cfNs; });
      if (opt.top) os = os.slice(0, opt.top);
      var rows = os.map(function (o) { return { label: K.kurzName(o, w), a: o.cfVs / 12, b: o.cfNs / 12, tip: K.objTip(o) }; });
      var sv = S.cfVsJ / 12, sn = S.cfNsJ / 12;
      K.satz('Nach Steuer bleiben ' + K.eurV(sn) + ' im Monat, ' + (function (n) { return n === 1 ? '1 Objekt zahlt zu' : n + ' Objekte zahlen zu'; })(os.filter(function (o) { return o.cfNs < 0; }).length), ['Bestand']); return K.karte('Cashflow je Objekt, vor und nach Steuer', 'Monat. Kreis leer vor Steuer, Punkt nach Steuer. Grün, wenn die Steuer entlastet. Portfolio ' + K.eurV(sv) + ' vor, ' + K.eurV(sn) + ' nach Steuer.',
        K.hantel({ w: w, rows: rows, rh: opt.rh || 21, fmtWert: function (v) { return K.eurV(v); }, fmtAx: function (v) { return K.kurz(v); }, aria: 'Cashflow vor und nach Steuer je Objekt' }) +
        K.leg([{ t: 'vor Steuer', o: 1, f: 'transparent' }, { t: 'nach Steuer, Steuer entlastet', f: 'var(--gruen)' }, { t: 'nach Steuer, Steuer belastet', f: 'var(--rot)' }]));
    });
  }

  /* Vermögen je Objekt: Eigenkapital im Objekt und Restschuld */
  function vermoegenJeObjekt(sel, opt) {
    opt = opt || {};
    K.modul(sel, function (w) {
      var os = nach(function (o) { return o.wert; }); if (opt.top) os = os.slice(0, opt.top);
      var rows = os.map(function (o) { return { label: K.kurzName(o, w), teile: [{ v: Math.max(0, o.ekHeute), f: 'var(--c-haupt)' }, { v: o.rest, f: 'var(--c-zweit)' }], wert: K.kurzEur(o.ekHeute), tip: K.tipReg(function () { return '<div class="t-k">' + K.esc(o.name) + '</div>' + K.tz('Wertansatz', K.eur(o.wert)) + K.tz('Quelle', o.wertQuelle) + K.tz('Restschuld', K.eur(o.rest)) + K.tz('Eigenkapital im Objekt', K.eur(o.ekHeute), o.ekHeute >= 0 ? 't-ok' : 't-nok') + K.tz('Beleihung', K.pct(o.ltv)); }) }; });
      var k = K.kennzahlen();
      K.satz('Dir gehören ' + K.mio(k.ekHeute) + ' von ' + K.mio(k.wert) + ' Wertansatz', ['Bestand']); return K.karte('Wem gehört der Bestand', 'Gold ist dein Eigenkapital im Objekt, grau die Restschuld. Zusammen ' + K.mio(k.ekHeute) + ' Eigenkapital bei ' + K.mio(k.wert) + ' Wertansatz.',
        K.stapelQuer({ w: w, rows: rows, rh: opt.rh || 20, aria: 'Eigenkapital und Restschuld je Objekt' }) + K.leg([{ t: 'Eigenkapital im Objekt', f: 'var(--c-haupt)' }, { t: 'Restschuld', f: 'var(--c-zweit)' }]));
    });
  }

  /* Zinsbindung je Objekt */
  function zinsbindung(sel, opt) {
    opt = opt || {};
    K.modul(sel, function (w) {
      var os = nach(function (o) { return o.zbJahr; }, true); if (opt.top) os = os.slice(0, opt.top);
      var rows = os.map(function (o) { return { label: K.kurzName(o, w), ende: o.zbJahr, rest: o.restZb, tip: K.tipReg(function () { return '<div class="t-k">' + K.esc(o.name) + '</div>' + K.tz('Zinsbindung bis', o.zb.slice(5, 7) + '/' + o.zb.slice(0, 4)) + K.tz('noch', (Math.round(o.zbRest * 10) / 10).toString().replace('.', ',') + ' Jahre') + K.tz('Zins heute', K.pct(o.zins)) + K.tz('Restschuld dann rund', K.eur(o.restZb)) + K.tz('je Prozentpunkt mehr Zins', K.eurV(-o.restZb / 100 / 12) + ' / Monat', 't-nok'); }) }; });
      var bald = O.filter(function (o) { return o.zbRest <= 3; });
      K.satz(bald.length ? bald.length + (bald.length > 1 ? ' Zinsbindungen enden' : ' Zinsbindung endet') + ' in den nächsten drei Jahren' : 'Die nächste Zinsbindung endet ' + os[0].zb.slice(5, 7) + '/' + os[0].zb.slice(0, 4) + ', ' + os[0].name, ['Bestand']); return K.karte('Zinsbindung', bald.length ? bald.length + ' Objekt' + (bald.length > 1 ? 'e laufen' : ' läuft') + ' in den nächsten drei Jahren aus. Punktgröße ist die Restschuld beim Ablauf.' : 'Keine Zinsbindung endet in den nächsten drei Jahren. Punktgröße ist die Restschuld beim Ablauf.',
        K.zeitleiste({ w: w, rows: rows, rh: opt.rh || 20 }) + K.leg([{ t: 'bis 3 Jahre', f: 'var(--rot)' }, { t: '3 bis 5 Jahre', f: 'var(--c-akzent)' }, { t: 'über 5 Jahre', f: 'var(--gruen)' }]));
    });
  }

  /* Wohin die Miete geht: Brücke vom Mietertrag zum Cashflow */
  function cfBruecke(sel) {
    K.modul(sel, function (w) {
      var bwk = S.mieteJ - S.zinsJ - S.tilgJ - S.cfVsJ, st = S.cfNsJ - S.cfVsJ;
      var schritte = [
        { t: 'Kaltmiete', k: 'Miete', v: S.mieteJ, summe: true, info: 'Kaltmiete aller 18 Objekte im Jahr, mit Stellplätzen.' },
        { t: 'Bewirtschaftung', k: 'Bewirt.', v: -bwk, info: 'Verwaltung, Instandhaltung, Rücklage, Mietausfall und nicht umlegbare Kosten.' },
        { t: 'Zinsen', k: 'Zins', v: -S.zinsJ, info: 'Zinsen aller Darlehen im Jahr.' },
        { t: 'Tilgung', k: 'Tilg.', v: -S.tilgJ, info: 'Tilgung baut Vermögen auf, verlässt aber das Konto.' },
        { t: 'vor Steuer', k: 'vor St.', v: S.cfVsJ, summe: true },
        { t: 'Steuer', v: st, info: 'Saldo aus Erstattungen und Nachzahlungen über alle Objekte.' },
        { t: 'nach Steuer', k: 'nach St.', v: S.cfNsJ, summe: true }
      ];
      K.satz('Von 100 € Miete bleiben dir ' + Math.round(S.cfNsJ / S.mieteJ * 100) + ' € nach Steuer', ['Bestand']); return K.karte('Wohin die Miete geht', 'Im Jahr. Von ' + K.kurzEur(S.mieteJ) + ' Kaltmiete bleiben ' + K.kurzEur(S.cfNsJ) + ' nach Steuer, das sind ' + K.pct(S.cfNsJ / S.mieteJ * 100) + '.', K.wasserfall({ w: w, h: 210, schritte: schritte, aria: 'Brücke von der Kaltmiete zum Cashflow' }));
    });
  }

  /* Steuer je Objekt: wer entlastet, wer belastet */
  function steuerJeObjekt(sel, opt) {
    opt = opt || {};
    K.modul(sel, function (w) {
      var os = O.filter(function (o) { return o.steuerWirkung != null; }).sort(function (a, b) { return b.steuerWirkung - a.steuerWirkung; });
      var rows = os.map(function (o) { return { label: K.kurzName(o, w), a: 0, b: o.steuerWirkung, tip: K.tipReg(function () { return '<div class="t-k">' + K.esc(o.name) + '</div>' + K.tz('Ergebnis Anlage V', K.eurV(o.ergVV)) + K.tz('Wirkung auf deine Steuer', o.steuerWirkung >= 0 ? 'Steuer sinkt um ' + K.eur(o.steuerWirkung) : 'Steuer steigt um ' + K.eur(-o.steuerWirkung), o.steuerWirkung >= 0 ? 't-ok' : 't-nok') + K.tz('Halter', o.halter) + (o.halter !== 'Privat' ? '<div style="color:#BDB6A8;white-space:normal;margin-top:3px">In der GmbH wirkt der Verlust erst mit späteren Gewinnen.</div>' : ''); }) }; });
      var plus = K.summe(os, function (o) { return Math.max(0, o.steuerWirkung); }), minus = K.summe(os, function (o) { return Math.min(0, o.steuerWirkung); });
      K.satz('Die Steuer ' + (plus + minus >= 0 ? 'entlastet' : 'belastet') + ' dich um ' + K.kurzEur(Math.abs(plus + minus)) + ' im Jahr', ['Bestand']); return K.karte('Steuer je Objekt', 'Im Jahr, Grenzsteuersatz ' + K.pct(D.steuer.grenz) + '. Verluste entlasten um ' + K.kurzEur(plus) + ', Überschüsse kosten ' + K.kurzEur(-minus) + '. Saldo ' + K.eurV(plus + minus) + '.',
        K.hantel({ w: w, rows: rows, rh: opt.rh || 19, fmtWert: K.eurV, aria: 'Steuerwirkung je Objekt' }) + K.leg([{ t: 'Steuer sinkt', f: 'var(--gruen)' }, { t: 'Steuer steigt', f: 'var(--rot)' }]));
    });
  }

  /* Rendite gegen DSCR */
  function renditeDscr(sel, opt) {
    opt = opt || {};
    K.modul(sel, function (w) {
      var z = K.ziele();
      var p = O.map(function (o) { var br = o.mieteJ / o.kp * 100; return { x: br, y: o.dscr, r: o.rest, f: z ? (o.dscr >= z.minDscr ? 'var(--gruen)' : 'var(--rot)') : 'var(--c-haupt)', tip: K.objTip(o), lab: w > 560 && (o.dscr < 0.7 || o.dscr > 1.8 || br > 9) ? o.name.split(' ')[0] : '' }; });
      K.satz(z ? (function (n) { return n === 1 ? '1 Objekt liegt unter deinem DSCR-Ziel' : n + ' Objekte liegen unter deinem DSCR-Ziel'; })(O.filter(function (o) { return o.dscr < z.minDscr; }).length) : 'Rendite und Tragfähigkeit je Objekt', ['Bestand']); return K.karte('Rendite gegen Tragfähigkeit', 'Waagerecht Bruttomietrendite, senkrecht DSCR. Punktgröße ist die Restschuld.' + (z ? ' Unter der Linie liegt dein Ziel ' + K.d2(z.minDscr) + ' nicht vor.' : ''),
        K.streu({ w: w, h: opt.h || 250, punkte: p, refY: z ? z.minDscr : 1, refYText: z ? 'dein Ziel ' + K.d2(z.minDscr) : 'DSCR 1,00', xText: 'Bruttomietrendite in %', fy: K.d2, aria: 'Rendite gegen DSCR' }));
    });
  }

  /* Risikomatrix: Objekte × Risiken */
  function risikoMatrix(sel, opt) {
    opt = opt || {};
    K.modul(sel, function (w) {
      var z = K.ziele(), minD = z ? z.minDscr : 1.2, maxL = z ? z.maxLtv : 90;
      var sp = [
        ['DSCR', function (o) { return [o.dscr >= minD ? 0 : o.dscr >= 1 ? 1 : 2, K.d2(o.dscr)]; }],
        ['LTV', function (o) { return [o.ltv <= 80 ? 0 : o.ltv <= maxL ? 1 : 2, Math.round(o.ltv) + '']; }],
        ['Zins bis', function (o) { return [o.zbRest > 5 ? 0 : o.zbRest > 3 ? 1 : 2, o.zb.slice(0, 4)]; }],
        ['CF', function (o) { var m = o.cfVs / 12; return [m >= 0 ? 0 : m > -100 ? 1 : 2, K.kurz(m)]; }],
        ['Leer', function (o) { return [o.leer <= 3 ? 0 : o.leer <= 8 ? 1 : 2, o.leer + '']; }],
        ['Energie', function (o) { var e = o.energie; return [!e ? 3 : 'ABC'.indexOf(e) >= 0 ? 0 : 'DE'.indexOf(e) >= 0 ? 1 : 2, e || '?']; }],
        ['Zustand', function (o) { return [!o.zustand ? 3 : o.zustand === 'renovierungsbedürftig' ? 2 : 0, !o.zustand ? '?' : o.zustand === 'renovierungsbedürftig' ? 'reno' : o.zustand === 'gut' ? 'gut' : 'ok']; }]
      ];
      var rows = O.map(function (o) { var c = sp.map(function (s) { return s[1](o); }); return { o: o, c: c, rot: c.filter(function (x) { return x[0] === 2; }).length, gelb: c.filter(function (x) { return x[0] === 1; }).length }; })
        .sort(function (a, b) { return (b.rot * 3 + b.gelb) - (a.rot * 3 + a.gelb); });
      if (opt.top) rows = rows.slice(0, opt.top);
      var h = '<div class="tab-wrap"><table class="matrix"><thead><tr><th>Objekt</th>' + sp.map(function (s) { return '<th>' + s[0] + '</th>'; }).join('') + '</tr></thead><tbody>';
      rows.forEach(function (r) { h += '<tr data-tip="' + K.objTip(r.o) + '"><td>' + K.esc(K.kurzName(r.o, w)) + '</td>' + r.c.map(function (x) { return '<td class="c' + (x[0] === 3 ? 'x' : x[0]) + '">' + x[1] + '</td>'; }).join('') + '</tr>'; });
      h += '</tbody></table>';
      var kritisch = rows.filter(function (r) { return r.rot >= 2; }).length;
      K.satz(kritisch + ' Objekte mit zwei oder mehr roten Feldern', ['Bestand']); return K.karte('Risikomatrix', kritisch + ' Objekte mit zwei oder mehr roten Feldern. Grenzen: DSCR ' + K.d2(minD) + ', Beleihung ' + maxL + ' %, Zinsbindung 3 und 5 Jahre, Leerstand 3 und 8 %.', h);
    });
  }

  /* Miethebel: Bestand gegen Zielbild */
  function mietHebel(sel, opt) {
    opt = opt || {};
    K.modul(sel, function (w) {
      var os = O.filter(function (o) { return o.mehrMiete > 0; }).sort(function (a, b) { return b.mehrMiete - a.mehrMiete; });
      if (opt.top) os = os.slice(0, opt.top);
      var rows = os.map(function (o) { return { label: K.kurzName(o, w), a: o.mieteB / 12, b: o.mieteZ / 12, tip: K.tipReg(function () { return '<div class="t-k">' + K.esc(o.name) + '</div>' + K.tz('Kaltmiete heute', K.eur(o.mieteB / 12) + ' / Monat') + K.tz('Zielbild', K.eur(o.mieteZ / 12) + ' / Monat') + K.tz('Mehr im Jahr', K.eurV(o.mehrMiete), 't-ok') + K.tz('Maßnahmen dafür', o.massn ? K.eur(o.massn) : 'keine') + K.tz('Stufe', o.stufe === 'mieterhoehung' ? 'nur Mieterhöhung' : 'Zielbild'); }) }; });
      var zb = D.zielbild;
      K.satz('Der Plan bringt ' + K.eurV(zb.mieteZ - zb.mieteB) + ' mehr Miete im Jahr', ['Zielbild']); return K.karte('Miethebel je Objekt', 'Monat, heute gegen Zielbild. Zusammen ' + K.eurV(zb.mieteZ - zb.mieteB) + ' im Jahr, davon ' + K.eurV(zb.mieteMh - zb.mieteB) + ' ohne Mieterwechsel.',
        K.hantel({ w: w, rows: rows, rh: 20, farbe: function () { return 'var(--c-haupt)'; }, fmtWert: function (v) { return K.eur(v); }, aria: 'Miete heute gegen Zielbild' }) + K.leg([{ t: 'heute', o: 1, f: 'transparent' }, { t: 'Zielbild', f: 'var(--c-haupt)' }]));
    });
  }

  /* Wert heute gegen Zielbild */
  function wertZielbild(sel) {
    K.modul(sel, function (w) {
      var os = O.filter(function (o) { return o.ewB != null; }).sort(function (a, b) { return b.zuwachs - a.zuwachs; });
      var rows = os.map(function (o) { return { label: K.kurzName(o, w), a: o.ewB, b: o.ewZ - o.massn, tip: K.tipReg(function () { return '<div class="t-k">' + K.esc(o.name) + '</div>' + K.tz('Ertragswert heute', K.eur(o.ewB)) + K.tz('Ertragswert Zielbild', K.eur(o.ewZ)) + K.tz('Maßnahmen', K.eur(o.massn)) + K.tz('Zuwachs nach Kosten', K.eurV(o.zuwachs), o.zuwachs >= 0 ? 't-ok' : 't-nok') + K.tz('Restnutzungsdauer', o.rndB + ' → ' + o.rndZ + ' Jahre'); }) }; });
      var zb = D.zielbild;
      K.satz('Der Plan hebt den Wert um ' + K.eurV(zb.zuwachsNK) + ' nach Kosten', ['Zielbild']); return K.karte('Wert heute und im Zielbild', 'Ertragswert, im Zielbild nach Abzug der Maßnahmen. Zusammen ' + K.mio(zb.ewB) + ' auf ' + K.mio(zb.nachKosten) + ', also ' + K.eurV(zb.zuwachsNK) + '.',
        K.hantel({ w: w, rows: rows, rh: 20, aria: 'Ertragswert heute und im Zielbild' }) + K.leg([{ t: 'heute', o: 1, f: 'transparent' }, { t: 'Zielbild nach Kosten, Zuwachs', f: 'var(--gruen)' }, { t: 'Verlust', f: 'var(--rot)' }]));
    });
  }

  /* Vermögensaufbau über zehn Jahre */
  function vermoegenProjektion(sel) {
    K.modul(sel, function (w) {
      var k = K.kennzahlen(), f = k.wert / D.projektion[0].wert;
      var P = D.projektion, x = P.map(function (p) { return p.j; });
      var wert = P.map(function (p) { return p.wert * f; }), rest = P.map(function (p) { return p.rest; }), ek = wert.map(function (v, i) { return v - rest[i]; });
      K.satz('Dein Eigenkapital wächst in zehn Jahren auf ' + K.mio(ek[3]), ['Projektion']); return K.karte('Vermögensaufbau', 'Eigenkapital im Bestand wächst durch Tilgung und Wertentwicklung von ' + K.mio(ek[0]) + ' auf ' + K.mio(ek[3]) + ' in zehn Jahren.',
        K.flaeche({ w: w, h: 190, x: x, xl: ['heute', '+1', '+5', '+10 J'], reihen: [{ werte: wert, farbe: 'var(--c-zweit)', strich: 1 }, { werte: ek, farbe: 'var(--c-haupt)', flaeche: 1 }, { werte: rest, farbe: 'var(--c-akzent)' }],
          tip: function (i) { return K.tipReg(function () { return '<div class="t-k">' + ['heute', 'in 1 Jahr', 'in 5 Jahren', 'in 10 Jahren'][i] + '</div>' + K.tz('Wertansatz', K.eur(wert[i])) + K.tz('Restschuld', K.eur(rest[i])) + K.tz('Eigenkapital', K.eur(ek[i]), 't-ok'); }); }, aria: 'Vermögensaufbau' }) +
        K.leg([{ t: 'Eigenkapital', f: 'var(--c-haupt)' }, { t: 'Restschuld', l: 1, f: 'var(--c-akzent)' }, { t: 'Wertansatz', l: 1, f: 'var(--c-zweit)' }]));
    });
  }

  /* Restschuld, die je Jahr in die Anschlussfinanzierung geht */
  function faelligJeJahr(sel) {
    K.modul(sel, function (w) {
      var j = []; for (var y = 2027; y <= 2039; y++) j.push(y);
      var werte = j.map(function (y) { return K.summe(O.filter(function (o) { return Math.floor(o.zbJahr) === y; }), function (o) { return o.restZb; }); });
      var spitze = j[werte.indexOf(Math.max.apply(null, werte))];
      K.satz(spitze + ' wird mit ' + K.mio(Math.max.apply(null, werte)) + ' am meisten neu finanziert', ['Projektion']); return K.karte('Anschlussfinanzierung je Jahr', 'Restschuld, die zum Ende der Zinsbindung neu finanziert wird. Spitze ' + spitze + ' mit ' + K.mio(Math.max.apply(null, werte)) + '.',
        K.saeulen({ w: w, h: 180, x: j, summe: 1, reihen: [{ werte: werte, farbe: 'var(--c-akzent)' }], tip: function (i) { var os = O.filter(function (o) { return Math.floor(o.zbJahr) === j[i]; }); return os.length ? K.tipReg(function () { return '<div class="t-k">' + j[i] + '</div>' + os.map(function (o) { return K.tz(o.name, K.kurzEur(o.restZb)); }).join('') + '<hr>' + K.tz('+1 Prozentpunkt Zins', K.eurV(-werte[i] / 100) + ' / Jahr', 't-nok'); }) : ''; }, aria: 'Anschlussfinanzierung je Jahr' }));
    });
  }

  /* Zinsstress: was ein höherer Anschlusszins kostet */
  function zinsStress(sel) {
    K.modul(sel, function (w) {
      var os = O.filter(function (o) { return o.zbRest <= 8; }).sort(function (a, b) { return a.zbJahr - b.zbJahr; });
      var h = '<div class="tab-wrap"><table class="tab"><thead><tr><th>Objekt</th><th>Ende</th><th>Restschuld</th><th>heute</th><th>bei 4,5 %</th><th>bei 5,5 %</th><th>DSCR bei 5,5 %</th></tr></thead><tbody>';
      os.forEach(function (o) {
        var mehr45 = o.restZb * Math.max(0, 4.5 - o.zins) / 100, mehr55 = o.restZb * Math.max(0, 5.5 - o.zins) / 100;
        var noi = o.dscr * (o.zinsJ + o.tilgJ), d55 = noi / (o.zinsJ + o.tilgJ + mehr55);
        h += '<tr data-tip="' + K.objTip(o) + '"><td><span class="o-n">' + K.esc(o.name) + '</span></td><td>' + o.zb.slice(5, 7) + '/' + o.zb.slice(2, 4) + '</td><td>' + K.kurzEur(o.restZb) + '</td><td>' + K.pct(o.zins) + '</td><td class="minus">' + K.eurV(-mehr45 / 12) + '</td><td class="minus">' + K.eurV(-mehr55 / 12) + '</td><td class="' + (d55 >= 1.2 ? 'plus' : 'minus') + '">' + K.d2(d55) + '</td></tr>';
      });
      h += '</tbody></table></div>';
      K.satz('Was ein höherer Anschlusszins im Monat kostet', ['Modell']); return K.karte('Zinsstress beim Anschluss', 'Mehrkosten im Monat, wenn der Anschlusszins auf 4,5 oder 5,5 % steigt. Gilt für Bindungen, die in den nächsten acht Jahren enden. Restschuld vereinfacht mit heutiger Tilgung fortgeschrieben.', h);
    });
  }

  /* Kapitaleffizienz: Eigenkapital eingesetzt gegen Rendite darauf */
  function kapitalEffizienz(sel) {
    K.modul(sel, function (w) {
      var st = K.ekStufe(), os = O.filter(function (o) { return o.ekr; }).sort(function (a, b) { return K.ekWert(b.ekr) - K.ekWert(a.ekr); });
      var rows = os.map(function (o) { return { label: K.kurzName(o, w), a: o.ekr.k1, b: K.ekWert(o.ekr), tip: K.tipReg(function () { return K.ekTipHtml(o.ekr, o.name); }) }; });
      K.satz('Dein Eigenkapital verdient ' + K.pct(K.ekWert(K.D.ekrP), 1) + ' im Jahr', ['Bestand']); return K.karte('Was dein Eigenkapital verdient', 'Von operativ (Punkt) bis ' + st.lang + ' (Balkenende). Portfolio ' + K.pct(K.ekWert(K.D.ekrP), 1) + '. Fahr über ein Objekt für alle vier Stufen.',
        K.hantel({ w: w, rows: rows, rh: 19, fmtWert: function (v) { return K.pct(v, 1); }, fmtAx: function (v) { return Math.round(v) + ' %'; }, aria: 'Eigenkapitalrendite je Objekt' }));
    });
  }

  /* Ziele des Investmentprofils als Balken */
  function zielBalken(sel) {
    K.modul(sel, function (w) {
      var z = K.ziele(), k = K.kennzahlen();
      var anteilD = O.filter(function (o) { return o.dscr >= D.ziele.minDscr; }).length / O.length * 100;
      var anteilC = O.filter(function (o) { return o.cfVs >= 0; }).length / O.length * 100;
      var h = K.bullet('DSCR Portfolio', S.dscr, z ? z.minDscr : null, 2, K.d2) + K.bullet('Beleihung Portfolio', k.ltv, z ? z.maxLtv : null, 120, function (v) { return Math.round(v) + ' %'; }, 'unter') +
        K.bullet('Objekte mit DSCR über Ziel', anteilD, z ? 100 : null, 100, function (v) { return Math.round(v) + ' %'; }) + K.bullet('Objekte ohne Zuzahlung', anteilC, z ? 100 : null, 100, function (v) { return Math.round(v) + ' %'; }) +
        K.bullet('EK-Rendite ' + K.ekStufe().kurz, K.ekWert(K.D.ekrP), null, 20, function (v) { return K.pct(v, 1); });
      return K.karte(z ? 'Deine Ziele' : 'Portfolio-Werte', z ? 'Aus deinem Investmentprofil. Strich ist das Ziel.' : 'Im Investmentprofil sind keine Ziele eingetragen. Trag dort Mindest-DSCR, Mindest-Cashflow und höchste Beleihung ein, dann zeigt dieses Modul den Abgleich.', h);
    });
  }

  /* Objektkacheln (Small Multiples) */
  var gedreht = {};
  function rueckseite(o) {
    var z = [], r = o.ekr, kz = function (l, v, cls) { if (v == null || v === '' || v === 'k. A.') return; z.push('<div class="rz"><span>' + l + '</span><b' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</b></div>'); };
    var h = '<div class="on">' + K.esc(o.name) + '</div><div class="oo">Rückseite · Klick oder Enter dreht zurück</div>';
    if (r) {
      h += '<div class="rs-t">EK-Rendite</div><div class="rs-ek">' + [['k4', 'Haupt'], ['k1', '1 Operativ'], ['k2', '2 Nach Steuer'], ['k3', '3 Mit Wert']].map(function (x) {
        return r[x[0]] == null ? '' : '<span' + (x[0] === K.ekStufe().k ? ' class="an"' : '') + '><small>' + x[1] + '</small><b class="' + K.ekKlasse(r[x[0]]) + '">' + K.pct(r[x[0]], 1) + '</b></span>';
      }).join('') + '</div>';
      if (r.hebel) h += '<div class="rs-hebel ' + (r.hebel.richtung === 'positiv' ? 'plus' : 'minus') + '">Hebel ' + r.hebel.richtung + ': Objekt ' + K.pct(r.hebel.gkr, 1) + ' gegen Darlehen ' + K.pct(r.hebel.fk_zins, 1) + '</div>';
    }
    h += '<div class="rs-t">Finanzierung</div>';
    kz('Restschuld', o.rest != null ? K.kurzEur(o.rest) : null);
    kz('Zinsbindung bis', o.zb ? o.zb.slice(5, 7) + '/' + o.zb.slice(0, 4) : null, o.zbRest <= 3 ? 'minus' : '');
    kz('Restschuld dann', o.restZb != null ? K.kurzEur(o.restZb) : null);
    kz('Zins · Tilgung', o.zins != null ? K.pct(o.zins, 2) + ' · ' + K.kurzEur(o.tilgJ) + ' / J' : null);
    kz('Beleihung', o.ltv != null ? K.pct(o.ltv, 0) : null, o.ltv > 90 ? 'minus' : '');
    h += z.join(''); z = [];
    h += '<div class="rs-t">Miete</div>';
    kz('Kaltmiete', o.mieteJ != null ? K.eur(o.mieteJ / 12) + ' / M' : null);
    kz('je m²', o.qmMiete != null ? K.pct(o.qmMiete, 2).replace(' %', ' €') : null);
    kz('Zielbild', o.mieteZ != null && o.mieteZ !== o.mieteB ? K.eur(o.mieteZ / 12) + ' / M' : null);
    kz('Potenzial', o.mehrMiete > 0 ? K.eurV(o.mehrMiete) + ' / J' : null, 'plus');
    kz('Leerstand', o.leer ? K.pct(o.leer, 0) : null, o.leer > 3 ? 'minus' : '');
    h += z.join(''); z = [];
    var ri = [];
    if (o.dscr != null && o.dscr < 1) ri.push('Kapitaldienst nicht gedeckt (DSCR ' + K.d2(o.dscr) + ')');
    if (o.ltv > 90) ri.push('Beleihung über 90 %');
    if (o.zbRest <= 3) ri.push('Zinsbindung endet in ' + Math.max(0, Math.round(o.zbRest * 10) / 10).toLocaleString('de-DE') + ' Jahren');
    if (o.energie === 'F' || o.energie === 'G' || o.energie === 'H') ri.push('Energieklasse ' + o.energie);
    if (o.leer > 3) ri.push('Leerstand ' + K.pct(o.leer, 0));
    if (o.zuwachs != null && o.zuwachs < 0) ri.push('Maßnahmen kosten mehr als sie bringen');
    if (ri.length) h += '<div class="rs-t">Risiken</div><ul class="rs-ri">' + ri.map(function (x) { return '<li>' + K.esc(x) + '</li>'; }).join('') + '</ul>';
    if (o.empf) h += '<div class="rs-empf">Pilot: ' + K.esc(o.empf) + '</div>';
    return h;
  }
  function objektKacheln(sel, sortFn) {
    var host = typeof sel === 'string' ? document.querySelector(sel) : sel;
    function drehen(el) { var n = el.getAttribute('data-name'), an = !gedreht[n]; gedreht[n] = an; el.classList.toggle('gedreht', an); el.setAttribute('aria-pressed', String(an)); }
    if (host && !host.__flip) {
      host.__flip = true;
      host.addEventListener('click', function (e) { var el = e.target.closest('.okachel.flip'); if (el) drehen(el); });
      host.addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; var el = e.target.closest('.okachel.flip'); if (!el) return; e.preventDefault(); drehen(el); });
    }
    K.modul(sel, function (w) {
      var os = O.slice().sort(sortFn || function (a, b) { return (b.score || 0) - (a.score || 0); });
      return '<div class="kacheln">' + os.map(function (o) {
        var z = K.ziele(), dc = z ? (o.dscr >= z.minDscr ? 'color:var(--gruen)' : 'color:var(--rot)') : '';
        var _v = K.ekWert(o.ekr), an = !!gedreht[o.name];
        var vorn = K.bild(o, 'ob-kachel') + '<div class="ok-ring">' + K.ring(o.score) + '</div><div class="on">' + K.esc(o.name) + '</div><div class="oo">' + K.esc(o.ort) + ' · ' + o.art + (o.we > 1 ? ' · ' + o.we + ' WE' : '') + '</div><dl>' +
          '<dt>CF vor St.</dt><dt>CF nach St.</dt><dd style="color:' + (o.cfVs >= 0 ? 'var(--gruen)' : 'var(--rot)') + '">' + K.eurV(o.cfVs / 12) + '</dd><dd style="color:' + (o.cfNs >= 0 ? 'var(--gruen)' : 'var(--rot)') + '">' + K.eurV(o.cfNs / 12) + '</dd>' +
          '<dt>DSCR</dt><dt>Zins bis</dt><dd style="' + dc + '">' + K.d2(o.dscr) + '</dd><dd' + (o.zbRest <= 3 ? ' style="color:var(--rot)"' : '') + '>' + o.zb.slice(5, 7) + '/' + o.zb.slice(0, 4) + '</dd>' +
          '<dt>EK-Rendite</dt><dt>EK eingesetzt</dt><dd class="' + K.ekKlasse(_v) + '">' + K.pct(_v, 1) + '</dd><dd>' + K.kurzEur(o.ek) + '</dd>' + '<dt>Hebel</dt><dt>EK im Objekt</dt><dd style="color:var(--gold-d)">' + (o.mehrMiete > 0 ? K.eurV(o.mehrMiete) : 'keiner') + '</dd><dd>' + K.kurzEur(o.ekHeute) + '</dd></dl><div class="ok-dreh" aria-hidden="true">↻ mehr</div>';
        return '<div class="okachel mit-bild flip' + (an ? ' gedreht' : '') + '" data-name="' + K.esc(o.name) + '" tabindex="0" role="button" aria-pressed="' + an + '" aria-label="' + K.esc(o.name) + ', Karte umdrehen für weitere Angaben"><div class="ok-in"><div class="ok-vorn" data-tip="' + K.objTip(o) + '">' + vorn + '</div><div class="ok-hinten">' + rueckseite(o) + '</div></div></div>';
      }).join('') + '</div>';
    });
  }

  /* Zusammensetzung nach Ort oder Art (Querbalken) */
  function zusammensetzung(sel, nachWas) {
    K.modul(sel, function (w) {
      var g = {}; O.forEach(function (o) { var k = nachWas === 'art' ? (o.art === 'MFH' ? 'Mehrfamilienhaus' : 'Wohnung') : o.ort; g[k] = g[k] || { m: 0, n: 0, w: 0 }; g[k].m += o.mieteJ; g[k].n++; g[k].w += o.wert; });
      var keys = Object.keys(g).sort(function (a, b) { return g[b].m - g[a].m; });
      var rows = keys.map(function (k) { return { label: k, teile: [{ v: g[k].m, f: 'var(--c-haupt)' }], wert: K.pct(g[k].m / S.mieteJ * 100, 0), tip: K.tipReg(function () { return '<div class="t-k">' + K.esc(k) + '</div>' + K.tz('Objekte', g[k].n) + K.tz('Kaltmiete im Jahr', K.eur(g[k].m)) + K.tz('Wertansatz', K.eur(g[k].w)); }) }; });
      return K.karte(nachWas === 'art' ? 'Nach Objektart' : 'Wo die Miete herkommt', 'Anteil an der Kaltmiete. ' + (nachWas === 'art' ? '' : keys[0] + ' trägt ' + K.pct(g[keys[0]].m / S.mieteJ * 100, 0) + '.'), K.stapelQuer({ w: w, rows: rows, rh: 19, aria: 'Kaltmiete nach Ort' }));
    });
  }

  return { cfVorNach: cfVorNach, vermoegenJeObjekt: vermoegenJeObjekt, zinsbindung: zinsbindung, cfBruecke: cfBruecke, steuerJeObjekt: steuerJeObjekt,
    renditeDscr: renditeDscr, risikoMatrix: risikoMatrix, mietHebel: mietHebel, wertZielbild: wertZielbild, vermoegenProjektion: vermoegenProjektion,
    faelligJeJahr: faelligJeJahr, zinsStress: zinsStress, kapitalEffizienz: kapitalEffizienz, zielBalken: zielBalken, objektKacheln: objektKacheln, zusammensetzung: zusammensetzung };
};
