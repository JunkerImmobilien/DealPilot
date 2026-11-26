/* haus-check-pdf.js · v5130 · KK6 · PDF „Haus-Check“ für Selbstnutzer (Marcel 26.11.2026: 9,99 €, Bankseite, Lage und Umfeld)
   Baut mit den Bausteinen von dp-dokument.js (DpDokument) ein Dokument mit Inhaltsverzeichnis und Seitenzahlen
   (data-dp-abschnitt / data-dp-toc, die Zahlen setzt der PDF-Dienst). RECHNET NICHTS SELBST:
     haus      Ergebnis von DpEigennutzerKern.kern(...)              (Haus-Score, Leistbarkeit, Nebenkosten, Kaufen/Mieten)
     wert      { verfahren:'sachwert'|'vergleichswert', betrag, vollstaendig, rechenweg:[{pos,detail,wert}], marktpreis,
                 ertragswert, fehlt:'…', weg:'…' }  aus der Stufe-3-Wertermittlung des Marktberichts (cross_check)
     belw      Antwort von POST /marktbericht/beleihungswert (lib/beleihungswert.js), optional
     umfeld    Antwort von GET /market-stats/umfeld, optional
     objekt    { adresse, objektart, baujahr, wfl, kaufpreis, energieklasse, kwh, unterlagen:[…], foerderung:[…] }
   „Verkehrswert“ steht NUR bei wert.vollstaendig === true (Stufe 3 nach ImmoWertV vollständig), sonst „vorläufiger Sachwert“
   bzw. „vorläufiger Vergleichswert“ mit dem Weg zum fehlenden Wert. Kundentext ohne Gedankenstrich und Semikolon. */
(function () {
  'use strict';
  var ARTNAME = { efh: 'Einfamilienhaus', zfh: 'Zweifamilienhaus', dhh: 'Doppelhaushälfte', rh: 'Reihenhaus', etw: 'Eigentumswohnung' };

  function wertName(w) {
    var v = w && w.verfahren === 'vergleichswert' ? 'Vergleichswert' : 'Sachwert';
    return w && w.vollstaendig ? 'Verkehrswert' : 'vorläufiger ' + v;
  }

  function bauen(e, B, c) {
    var H = e.haus, O = e.objekt || {}, W = e.wert || null, U = e.umfeld, L = e.belw;
    /* pp6 · Datenschutz: das Netto-Einkommen verlässt den Browser nie. Der Server druckt den Bericht ohne Netto (quote null),
       dann steht hier, ab welchem Netto die Wohnkosten gut tragbar bzw. knapp sind, gerechnet nur aus den Wohnkosten. */
    var LB = H.leistbarkeit, abN = function (pct) { return LB.wohnkosten > 0 && pct > 0 ? Math.ceil(LB.wohnkosten / pct * 100 / 10) * 10 : null; };
    var abGruen = abN(LB.grenzen && LB.grenzen.gruen), abGelb = abN(LB.grenzen && LB.grenzen.gelb);
    var P = [];
    function add(titel, unter, html) { P.push([titel, unter, html]); }
    /* pp6 · Bericht wieder mindestens auf dem Stand des Musters (HH6, 13 Seiten), mit echten Daten. Nichts wird erfunden:
       wo eine Zahl fehlt, steht der Weg dorthin. Lage und Umfeld stehen NUR hier, nicht auf der Karte der Landing. */
    var tab = function (kopf, zeilen, rechts) {
      return '<table><thead><tr>' + kopf.map(function (k, i) { return '<th' + (rechts && rechts.indexOf(i) >= 0 ? ' class="r"' : '') + '>' + B.esc(k) + '</th>'; }).join('') + '</tr></thead><tbody>'
        + zeilen.map(function (z) { return '<tr>' + z.map(function (x, i) { return '<td' + (rechts && rechts.indexOf(i) >= 0 ? ' class="r num"' : '') + '>' + x + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    };
    var JETZT = new Date().getFullYear(), BJ = Number(O.baujahr) || null, ALTER = BJ ? JETZT - BJ : null;
    var ETW = O.objektart === 'etw';

    /* 1 · Kurzurteil */
    var g = H.haus.gruppen;
    add('Kurzurteil', 'Ist das Haus gut? Und passt es zu dir?',
      B.scoreRing(H.haus.score, H.haus.stufe.wort, 'Haus-Score von 100')
      + B.kacheln([
        g.preis ? { l: 'Preis', v: B.zahl(g.preis.score), s: 'von 100, Gewicht 35 %' } : null,
        { l: 'Zustand', v: B.zahl(g.zustand.score), s: 'von 100, Gewicht 35 %' },
        g.lage ? { l: 'Lage', v: B.zahl(g.lage.score), s: 'von 100, Gewicht 30 %' } : null,
        { l: 'Passt es zu mir?', v: H.leistbarkeit.quote == null ? (abGruen ? 'ab ' + B.eur(abGruen) : 'ohne Einkommen') : B.pct(H.leistbarkeit.quote, 0), s: H.leistbarkeit.ampel === 'gruen' ? 'gut tragbar' : H.leistbarkeit.ampel === 'gelb' ? 'knapp' : H.leistbarkeit.ampel === 'rot' ? 'zu hoch' : (abGruen ? 'Netto im Monat, damit gut tragbar' : 'Belastung vom Netto'),
          art: H.leistbarkeit.ampel === 'gruen' ? 'gut' : H.leistbarkeit.ampel === 'rot' ? 'schlecht' : '' }
      ])
      + '<div class="block"><h3>Was du wissen solltest</h3><ul>' + H.urteil.map(function (t) { return '<li>' + B.esc(t) + '</li>'; }).join('') + '</ul></div>');

    /* 2 · Grundangaben (pp6) */
    var KELLER = { ja: 'unterkellert', nein: 'ohne Keller' }, GESCH = { '1': 'nur Erdgeschoss', '2': 'Erd- und Obergeschoss' },
      DACH = { '1': 'Dachgeschoss ausgebaut', '2': 'Dachgeschoss nicht ausgebaut', '3': 'Flachdach' };
    var ga = [['Anschrift', B.esc(O.adresse || '')], ['Objekt', B.esc(ARTNAME[O.objektart] || '')], ['Baujahr', B.jahr(O.baujahr) + (ALTER != null ? ' (' + ALTER + ' Jahre alt)' : '')],
      ['Wohnfläche', B.zahl(O.wfl) + ' m²']];
    if (!ETW) ga.push(['Grundstück', O.gsfl ? B.zahl(O.gsfl) + ' m²' : 'nicht angegeben']);
    if (!ETW && O.keller) ga.push(['Keller', KELLER[O.keller] || B.esc(O.keller)]);
    if (!ETW && O.geschosse) ga.push(['Geschosse', GESCH[O.geschosse] || B.esc(O.geschosse)]);
    if (!ETW && O.dach) ga.push(['Dach', DACH[O.dach] || B.esc(O.dach)]);
    if (O.ausst) ga.push(['Ausstattung', B.esc(O.ausst)]);
    ga.push(['Kaufpreis', B.eur(O.kaufpreis) + (O.wfl ? ' (' + B.eur(O.kaufpreis / O.wfl) + ' je m²)' : '')], ['Eigenkapital', B.eur(O.ek || 0)],
      ['Darlehen', B.eur(H.finanzierung.darlehen)], ['Stichtag', B.esc(e.stichtag ? new Date(e.stichtag).toLocaleDateString('de-DE') : B.datum(new Date()))]);
    add('Grundangaben', 'Womit dieser Bericht rechnet', B.liste(ga)
      + '<p class="det">Alle Angaben stammen aus deiner Eingabe beim Kauf. Abweichungen zum Exposé, zum Grundriss oder zum Energieausweis ändern das Ergebnis. Mit den Unterlagen wird der Bericht genauer.</p>'
      + '<div class="block"><h3>Was DealPilot dazu geholt hat</h3><ul>'
      + '<li>Bodenrichtwert, Sachwertfaktor und Modellansätze des zuständigen Gutachterausschusses</li>'
      + '<li>Ortsübliche Vergleichsmiete für ein Objekt dieser Größe und dieses Baujahrs</li>'
      + '<li>Zins von heute für zehn Jahre Zinsbindung</li>'
      + '<li>Grundsteuer und Trinkwasserentgelt der Gemeinde, übrige Nebenkosten als Durchschnitt</li>'
      + '<li>Lage, Bevölkerung und Umfeld rund um die Anschrift</li></ul></div>');

    /* 3 · Preis und Wert */
    var wHtml = '';
    if (W && W.betrag) {
      wHtml += B.kacheln([
        { l: wertName(W), v: B.eur(W.betrag), s: W.verfahren === 'vergleichswert' ? 'Vergleichswertverfahren' : 'Sachwertverfahren, führend für Häuser', art: 'hi' },
        { l: 'Kaufpreis', v: B.eur(O.kaufpreis), s: g.preis && g.preis.abweichung_pct != null ? (g.preis.abweichung_pct > 0 ? B.pct(g.preis.abweichung_pct, 1) + ' über dem Wert' : B.pct(-g.preis.abweichung_pct, 1) + ' unter dem Wert') : '' },
        W.ertragswert ? { l: 'Ertragswert (stützend)', v: B.eur(W.ertragswert) } : null,
        W.marktpreis ? { l: 'Marktpreisindikation', v: B.eur(W.marktpreis), s: 'aus Angebotspreisen, kein Verkehrswert' } : null
      ]);
      /* Rechenweg aus dem Marktbericht: Gedankenstriche im Kundentext durch Kommas ersetzen (Kundentext-Regel) */
      var glatt = function (t) { return t == null ? t : String(t).replace(/\s[–—]\s/g, ', ').replace(/[–—]/g, ' bis ').replace(/;/g, ','); };
      if (W.rechenweg && W.rechenweg.length) wHtml += '<div class="block"><h3>Rechenweg</h3>' + B.staffel(W.rechenweg.map(function (z) { return Object.assign({}, z, { pos: glatt(z.pos), detail: glatt(z.detail) }); }), false) + '</div>';
      if (!W.vollstaendig) wHtml += '<p class="det">' + B.esc('Noch kein Verkehrswert: ' + (W.fehlt || 'eine amtliche Angabe fehlt') + '. ' + (W.weg || '')) + '</p>';
      if (g.preis && g.preis.abweichung_pct != null) {
        var ab = g.preis.abweichung_pct, satz = ab > 10 ? 'Das ist deutlich über dem Wert. Hier lohnt es sich, nachzuverhandeln.' : ab > 3 ? 'Das ist etwas über dem Wert. Ein Gespräch über den Preis lohnt sich.' : ab >= -3 ? 'Das ist ein fairer Preis.' : 'Das ist günstig. Prüf trotzdem genau, warum.';
        wHtml += '<div class="block"><h3>Einordnung</h3><p>Der Kaufpreis liegt ' + (ab > 0 ? B.pct(ab, 1) + ' über' : B.pct(-ab, 1) + ' unter') + ' dem ' + B.esc(wertName(W)) + '. ' + satz + '</p></div>';
      }
      wHtml += '<p class="det">Indikative Wertermittlung nach ImmoWertV, ohne Ortsbesichtigung, kein Gutachten.</p>';
      /* Namensnennung: nur die Quellen, die in DIESEM Wert stecken (Lizenzvermerke der Registersätze) */
      if (W.quellen && W.quellen.length) wHtml += '<div class="block"><h3>Quellennachweis</h3><ul>' + W.quellen.map(function (q) {
        return '<li class="det">' + B.esc(q.vermerk) + (q.kennzahlen && q.kennzahlen.length ? ' (' + B.esc(q.kennzahlen.join(', ')) + ')' : '') + '</li>'; }).join('') + '</ul></div>';
    } else wHtml = '<p>Für dieses Objekt liegt noch keine Wertermittlung vor.' + (W && (W.weg || W.grund) && !/^[a-z_]+$/.test(String(W.weg || W.grund)) ? ' ' + B.esc(W.weg || W.grund) : '') + '</p>'
      + '<p class="det">Mit der vollständigen Anschrift rechnet DealPilot den Wert nach ImmoWertV aus den Daten des Gutachterausschusses.</p>';
    /* Angebotspreise am Ort (zusammengefasst, kein Verkehrswert) und Kaufpreis in Jahresmieten */
    var M = e.markt || {}, vz = [];
    if (M.qm > 0 && O.wfl) vz.push(['Angebotspreise am Ort im Schnitt', B.eur(M.qm) + ' je m²'], ['Dein Kaufpreis', B.eur(O.kaufpreis / O.wfl) + ' je m²']);
    if (H.miete.faktor) vz.push(['Kaufpreis in Jahresmieten', B.zahl(H.miete.faktor, 1) + ' (' + B.eur(O.kaufpreis) + ' geteilt durch ' + B.eur(H.miete.monat * 12) + ' ersparte Jahresmiete)']);
    if (vz.length) wHtml += '<div class="block"><h3>Was Häuser am Ort kosten</h3>' + B.liste(vz)
      + '<p class="det">Angebotspreise sind Wunschpreise der Verkäufer und liegen meist über den gezahlten Preisen. Sie sind kein Verkehrswert. Üblich sind rund 22 bis 26 Jahresmieten.</p></div>';
    add('Preis und Wert', 'Zahlst du zu viel? Kaufpreis gegen den Wert nach ImmoWertV', wHtml);

    /* 3 · Kaufen oder mieten */
    var KM = H.kaufen_mieten;
    add('Kaufen oder mieten', 'Ersparte Miete und Vermögen über 20 Jahre',
      B.kacheln([
        { l: 'Ersparte Miete', v: B.eur(H.miete.monat) + ' im Monat', s: 'Mittelwert der Vergleichsmiete' + (H.miete.hauszuschlag_pct ? ' plus ' + B.zahl(H.miete.hauszuschlag_pct) + ' % Hauszuschlag' : '') },
        { l: 'Kaufpreis in Jahresmieten', v: B.zahl(H.miete.faktor, 1), s: 'üblich rund 22 bis 26' },
        { l: 'Ergebnis', v: KM.jahr ? 'ab Jahr ' + KM.jahr : 'nicht in 20 Jahren', s: 'ab dann ist Kaufen günstiger', art: KM.jahr ? 'gut' : 'schlecht' }
      ])
      + (KM.reihe.length ? '<div class="block">' + B.linien([
        { name: 'Kaufen: Wert minus Restschuld', klasse: 'l1', werte: KM.reihe.map(function (p) { return { x: p.jahr, y: p.kaufen }; }) },
        { name: 'Mieten und Geld anlegen', klasse: 'l3', werte: KM.reihe.map(function (p) { return { x: p.jahr, y: p.mieten }; }) }
      ], { h: 150, titel: 'Vermögen nach Jahren', fmt: function (v) { return B.zahl(v / 1000, 0) + ' T€'; } }) + '</div>' : '')
      + (KM.reihe.length ? '<div class="block"><h3>Nach Jahren</h3>' + tab(['Nach Jahren', 'Kaufen', 'Mieten und anlegen', 'Unterschied'],
          KM.reihe.filter(function (p) { return p.jahr > 0 && (p.jahr % 5 === 0 || p.jahr === KM.jahr); }).map(function (p) {
            var d = p.kaufen - p.mieten; return [B.zahl(p.jahr), B.eur(p.kaufen), B.eur(p.mieten), (d >= 0 ? '+ ' : '− ') + B.eur(Math.abs(d))]; }), [1, 2, 3]) + '</div>' : '')
      + (e.vmiete && e.vmiete.mittel ? '<div class="block"><h3>Die ersparte Miete</h3><p>Ortsübliche Vergleichsmiete ' + B.eur(e.vmiete.unten) + ' bis ' + B.eur(e.vmiete.oben) + ' je m², Mittelwert ' + B.eur(e.vmiete.mittel) + ' je m²'
          + (e.vmiete.art === 'mietspiegel' ? ' laut Mietspiegel' : ' aus der DealPilot-Näherung') + '. Für Selbstnutzer rechnen wir bewusst mit dem Mittelwert'
          + (H.miete.hauszuschlag_pct ? ' plus ' + B.zahl(H.miete.hauszuschlag_pct) + ' % Hauszuschlag' : '') + ', nicht mit der höchstmöglichen Miete.</p></div>' : '')
      + '<p class="det">Heizung, Grundsteuer, Wasser, Müll und Versicherung zahlst du als Mieter genauso wie als Eigentümer. Sie heben sich auf und stehen deshalb nicht in diesem Vergleich, wohl aber in der Haushaltsrechnung.</p>'
      + '<p class="det">Annahmen: Wertentwicklung ' + B.pct(KM.annahmen.wertsteigerung_pct, 1) + ', Mietsteigerung ' + B.pct(KM.annahmen.mietsteigerung_pct, 1) + ' und Anlagezins ' + B.pct(KM.annahmen.anlagezins_pct, 1) + ' im Jahr. Beispielrechnung, keine Garantie.</p>');

    /* 5 · Leistbarkeit (pp6, eigener Abschnitt). Das Netto steht hier nur in der Fassung, die im Browser bleibt. */
    var LZ = B.kacheln([
      { l: 'Rate im Monat', v: B.eur(H.finanzierung.rate), s: 'Zins ' + B.pct(H.finanzierung.zins_pct, 2) + ' plus ' + B.pct(H.finanzierung.tilgung_pct, 0) + ' Tilgung' },
      { l: 'Wohnkosten im Monat', v: B.eur(LB.wohnkosten), s: 'Rate, Eigentümerkosten, Heizung, Nebenkosten' },
      { l: LB.quote == null && abGruen ? 'Gut tragbar ab Netto' : 'Belastung', v: LB.quote == null ? (abGruen ? B.eur(abGruen) + ' im Monat' : 'ohne Einkommen') : B.pct(LB.quote, 0) + ' vom Netto', art: LB.ampel === 'gruen' ? 'gut' : LB.ampel === 'rot' ? 'schlecht' : '' }
    ]);
    var AU = LB.aufstellung || [];
    if (AU.length) {
      var zeilen = AU.filter(function (x) { return !x.teil; }).map(function (x) { return [x.l.replace(/ \(Grundsteuer.*\)$/, '') + (x.herkunft && x.k !== 'uebrige' ? ' (' + x.herkunft + ')' : ''), B.eur(x.eur), x.summe ? { art: 'summe' } : null].filter(function (y) { return y !== null; }); });
      if (LB.quote == null && abGruen) { zeilen.push(['Gut tragbar ab einem Netto-Einkommen von', B.eur(abGruen)]); if (abGelb) zeilen.push(['Knapp ab einem Netto-Einkommen von', B.eur(abGelb)]); }
      else zeilen.push(['Anteil vom Netto-Einkommen', LB.quote == null ? 'ohne Einkommen' : B.pct(LB.quote, 0) + ' von ' + B.eur(LB.netto)]);
      LZ += '<div class="block"><h3>Haushaltsrechnung</h3>' + B.liste(zeilen) + '</div>';
      var teile = AU.filter(function (x) { return x.teil; });
      if (teile.length) LZ += '<div class="block"><h3>Nebenkosten einzeln</h3>' + tab(['Posten', 'Herkunft', 'Im Monat'],
        teile.map(function (x) { return [B.esc(x.l.replace(/^davon /, '')), B.esc(x.herkunft), B.eur(x.eur)]; }).concat([['<b>Nebenkosten ohne Heizung</b>', '', '<b>' + B.eur(teile.reduce(function (a, x) { return a + x.eur; }, 0)) + '</b>']]), [2])
        + '<p class="det">Je Gemeinde heißt: aus den Zahlen deiner Gemeinde abgeleitet, kein Bescheid. Bundesschnitt heißt: Durchschnitt aller Abrechnungen. Grundsteuerbescheid, Abfallgebühren und ein Versicherungsangebot für dieses Haus sind genauer.</p></div>';
      var HZ = LB.heizung || {};
      if (HZ.kwh_qm) LZ += '<p class="det">Heizung: ' + B.zahl(HZ.kwh_qm) + ' kWh je m² im Jahr × ' + B.zahl(HZ.ct, 1) + ' Cent je kWh (' + B.esc(HZ.herkunft || '') + '). Eigentümerkosten: Instandhaltung und Rücklage, die ein Mieter nicht trägt.</p>';
    }
    LZ += '<p class="det">Grün bis ' + LB.grenzen.gruen + ' %, gelb bis ' + LB.grenzen.gelb + ' % vom Netto. Banken rechnen meist nur die Rate gegen höchstens 40 % vom Netto, die Nebenkosten kommen hier dazu.</p>';
    add('Leistbarkeit', 'Was dich das Haus im Monat kostet', LZ);

    /* 6 · Zustand, Energie und Sanierung (pp6 ausführlicher: Heizung und GEG, Bauteile nach Alter) */
    var zh = B.energieSkala(O.energieklasse, O.kwh)
      + '<div class="block"><h3>Worauf du achten solltest</h3><ul>' + g.zustand.punkte.concat(g.zustand.hinweise).map(function (t) { return '<li>' + B.esc(t) + '</li>'; }).join('') + '</ul></div>'
      + (O.unterlagen && O.unterlagen.length ? '<div class="block"><h3>Aus deinen Unterlagen</h3><ul>' + O.unterlagen.map(function (t) { return '<li>' + B.esc(t) + '</li>'; }).join('') + '</ul></div>' : '');
    if (BJ) {
      /* Bauteile: nur das Alter seit Baujahr und der Hinweis, nicht erfundene Kosten. Kosten schätzt ein Handwerker oder Energieberater nach der Besichtigung. */
      var bt = [['Heizung', 'Typenschild ansehen. Kessel über 30 Jahre können nach dem Kauf eine Austauschpflicht auslösen.'],
        ['Dach und Dachfenster', 'Eindeckung, Rinnen, Abdichtung und Dämmung der obersten Geschossdecke prüfen.'],
        ['Fenster und Außentüren', 'Verglasung, Dichtungen und Rahmen. Beschlagene Scheiben zwischen den Gläsern heißen Austausch.'],
        ['Fassade und Dämmung', 'Risse, Feuchte, Algen. Bei gedämmten Fassaden Sockel und Fensteranschlüsse.'],
        ['Elektrik', 'Sicherungskasten mit Fehlerstromschutzschalter, Leitungen mit Schutzleiter.'],
        ['Bäder und Leitungen', 'Material der Wasserleitungen, Fugen, Feuchte hinter Wanne und Dusche.']];
      zh += '<div class="block"><h3>Bauteile nach Alter</h3>' + tab(['Bauteil', 'Alter ohne bekannte Erneuerung', 'Worauf achten'],
        bt.map(function (x) { return ['<b>' + x[0] + '</b>', ALTER + ' Jahre', B.esc(x[1])]; }), [1])
        + '<p class="det">Ohne Liste der Modernisierungen nehmen wir an, dass die Bauteile so alt sind wie das Haus. Was schon erneuert wurde, steht im Exposé oder beim Verkäufer. Die Kosten je Gewerk schätzt ein Handwerker oder Energieberater nach der Besichtigung, dafür gibt es Förderung.</p></div>';
    }
    zh += '<div class="block"><h3>Heizung und Gebäudeenergiegesetz</h3>' + B.liste([
      ['Austauschpflicht', 'Öl- und Gaskessel über 30 Jahre, außer Brennwert- und Niedertemperaturkessel'],
      ['Nach dem Eigentümerwechsel', 'zwei Jahre Zeit für Austauschpflicht, Dämmung der obersten Geschossdecke und der Leitungen im Keller, falls noch nicht geschehen'],
      ['Beim Tausch der Heizung', 'neue Heizungen mit 65 % erneuerbarer Energie, Übergangsfristen je nach kommunaler Wärmeplanung'],
      ['Energieausweis', 'muss der Verkäufer spätestens bei der Besichtigung vorlegen']])
      + (LB.heizung && LB.heizung.kwh_qm ? '<p>Heizkosten heute rund ' + B.eur(Math.round(LB.heizung.kwh_qm * O.wfl * LB.heizung.ct / 100)) + ' im Jahr (' + B.zahl(LB.heizung.kwh_qm * O.wfl) + ' kWh × ' + B.zahl(LB.heizung.ct, 1) + ' Cent, ' + B.esc(LB.heizung.herkunft || '') + ').</p>' : '')
      + '<p class="det">Stand der Regeln beim Erstellen dieses Berichts. Das Gebäudeenergiegesetz wird überarbeitet, vor dem Kauf den aktuellen Stand und die Wärmeplanung der Gemeinde prüfen.' + (ETW ? ' Bei der Eigentumswohnung entscheidet die Gemeinschaft über Heizung, Dach und Fassade.' : '') + '</p></div>';
    add('Zustand, Energie und Sanierung', 'Was in den nächsten Jahren auf dich zukommt', zh);

    /* 7 · Förderung */
    if (O.foerderung && O.foerderung.length) add('Förderung', 'Wofür es Geld vom Staat geben kann',
      '<ul>' + O.foerderung.map(function (f) { return '<li><b>' + B.esc(f.name) + '</b> ' + B.esc(f.satz || '') + '</li>'; }).join('') + '</ul>'
      + '<p class="det">Vor Vorhabenbeginn bzw. vor dem Kaufvertrag beantragen. Voraussetzungen und Konditionen beim Förderprogramm prüfen.</p>');

    /* 5 · Lage und Umfeld */
    var uHtml = '';
    if (U && U.ok) {
      uHtml = '<table><thead><tr><th>In der Nähe</th><th class="r">Entfernung</th><th class="r">zu Fuß</th></tr></thead><tbody>' + U.kategorien.map(function (k) {
        var n = k.naechster;
        return '<tr><td>' + B.esc(k.label) + (n && n.name ? '<div class="det">' + B.esc(n.name) + '</div>' : '') + '</td><td class="r num">'
          + (k.nicht_ermittelt ? 'nicht ermittelt' : n ? (n.luftlinie_m < 1000 ? B.zahl(n.luftlinie_m) + ' m' : B.zahl(n.luftlinie_m / 1000, 1) + ' km') : 'nicht im Umkreis') + '</td><td class="r num">' + (n ? 'ca. ' + n.fuss_min + ' Min.' : '–') + '</td></tr>';
      }).join('') + '</tbody></table><p class="det">' + B.esc(U.hinweis) + ' Kartendaten ' + B.esc(U.vermerk) + '.</p>';
    } else uHtml = '<p>Das Umfeld war beim Erstellen nicht abrufbar.</p>';
    var LG = e.lage || {}, lk = [];
    if (g.lage) lk.push({ l: 'Lage im Haus-Score', v: B.zahl(g.lage.score), s: 'von 100, Gewicht 30 %' });
    if (LG.mikro != null) lk.push({ l: 'Mikrolage', v: B.zahl(LG.mikro), s: 'von 100, direkte Umgebung' });
    if (LG.makro != null) lk.push({ l: 'Makrolage', v: B.zahl(LG.makro), s: 'von 100, Ort und Region' });
    var lz = [];
    if (LG.bevoelkerung_trend_pct != null) lz.push(['Bevölkerung', (LG.bevoelkerung_trend_pct >= 0 ? 'wächst' : 'schrumpft') + ' um ' + B.pct(Math.abs(LG.bevoelkerung_trend_pct), 1) + ' im Jahr']);
    if (LG.angebotsdauer_tage) lz.push(['Angebote am Markt', 'im Schnitt ' + B.zahl(LG.angebotsdauer_tage) + ' Tage online']);
    if (LG.ort) lz.push(['Ort', B.esc(LG.ort + (LG.plz ? ' (' + LG.plz + ')' : ''))]);
    add('Lage und Umfeld', 'Wo das Haus steht und was in der Nähe ist',
      (lk.length ? B.kacheln(lk) : '') + (lz.length ? B.liste(lz) : '')
      + (e.karte ? '<div class="block"><img class="karte" src="' + e.karte + '" alt="Karte der Umgebung" style="width:100%;height:78mm;object-fit:cover;border-radius:2mm"></div>' : '')
      + '<div class="block"><h3>Was ist in der Nähe?</h3>' + uHtml + '</div>');

    /* 9 · Checkliste für die Besichtigung (pp6, besichtigung.js ohne Formular) */
    var BS = window.DpBesichtigung, gr = [];
    try { gr = BS && BS.gruppen ? BS.gruppen({ bj: BJ, art: String(O.objektart || '').toUpperCase() }) : []; } catch (x) { gr = []; }
    if (gr.length) {
      var kasten = '<span style="display:inline-block;width:3.4mm;height:3.4mm;border:0.35mm solid currentColor;border-radius:0.6mm;vertical-align:-0.5mm"></span>';
      add('Checkliste für die Besichtigung', 'Zum Ausdrucken und Abhaken', gr.map(function (G) {
        return '<div class="block"><h3>' + B.esc(G.titel) + '</h3>' + tab(['', 'Punkt', 'Worauf achten'], G.punkte.map(function (p) {
          return [kasten, '<b>' + B.esc(p.titel) + '</b>', B.esc(p.text)]; })) + '</div>';
      }).join('') + '<p class="det">Hinweise für die Besichtigung, keine Gutachteraussage. Notizen direkt auf diesem Blatt.</p>');
    }

    /* 6 · Finanzierung, Leistbarkeit und Bank */
    var F = H.finanzierung;
    var bank = B.kacheln([
      { l: 'Darlehen', v: B.eur(F.darlehen), s: 'Beleihungsauslauf zum Kaufpreis ' + B.pct(F.ltv_pct, 0) },
      { l: 'Rate im Monat', v: B.eur(F.rate), s: 'Zins ' + B.pct(F.zins_pct, 2) + ' plus ' + B.pct(F.tilgung_pct, 0) + ' Tilgung' },
      { l: 'Wohnkosten im Monat', v: B.eur(H.leistbarkeit.wohnkosten), s: 'Rate, Eigentümer- und Betriebskosten' },
      { l: H.leistbarkeit.quote == null && abGruen ? 'Gut tragbar ab Netto' : 'Belastung', v: H.leistbarkeit.quote == null ? (abGruen ? B.eur(abGruen) + ' im Monat' : 'ohne Einkommen') : B.pct(H.leistbarkeit.quote, 0) + ' vom Netto', art: H.leistbarkeit.ampel === 'gruen' ? 'gut' : H.leistbarkeit.ampel === 'rot' ? 'schlecht' : '' }
    ]);
    if (L && L.verfuegbar !== false && L.beleihungswert) {
      bank += '<div class="block"><h3>Indikativer Beleihungswert</h3>' + B.liste([
        ['Beleihungswert (indikativ)', B.eur(L.beleihungswert)],
        ['Beleihungsauslauf', L.auslauf_pct != null ? B.pct(L.auslauf_pct, 0) : (F.darlehen && L.beleihungswert ? B.pct(F.darlehen / L.beleihungswert * 100, 0) : '–')]
      ]) + (L.hinweise && L.hinweise.length ? '<p class="det">' + B.esc(L.hinweise[0]) + '</p>' : '')
        + '<p class="det">Indikativer Check nach der Beleihungswertverordnung. Die Bank bewertet selbst und kann abweichen. Kein Gutachten.</p></div>';
    } else bank += '<p class="det">Den Beleihungswert bewertet die Bank selbst. Ein indikativer Check folgt, sobald die Wertermittlung vollständig ist.</p>';
    bank += '<div class="block"><h3>Für das Bankgespräch</h3><ul><li>Exposé, Grundriss, Wohnflächenberechnung</li><li>Energieausweis</li><li>Grundbuchauszug, Flurkarte</li>'
      + (O.objektart === 'etw' ? '<li>Teilungserklärung, letzte drei Protokolle, Wirtschaftsplan, Hausgeldabrechnung</li>' : '<li>Baubeschreibung, Liste der Modernisierungen</li>')
      + '<li>Einkommensnachweise, Eigenkapitalnachweis</li></ul></div>';
    if (e.anrechnung && e.anrechnung.code) bank += '<div class="block"><h3>Weiter in DealPilot</h3><p>Buchst du bis ' + B.esc(new Date(e.anrechnung.bis).toLocaleDateString('de-DE')) + ' ein Paket, rechnet DealPilot ' + B.esc((e.anrechnung.cents / 100).toFixed(2).replace('.', ',')) + ' € an. Code ' + B.esc(e.anrechnung.code) + '. Ein anderer Gutscheincode lässt sich damit nicht kombinieren.</p></div>';
    add('Finanzierung und Bank', 'Darlehen, Beleihungswert, Unterlagen für die Bank', bank);

    /* 11 · Kaufnebenkosten (pp6, eigener Abschnitt wie im Muster) */
    var NK = H.nebenkosten;
    add('Kaufnebenkosten', 'Was zum Kaufpreis dazukommt', B.liste([
      ['Grunderwerbsteuer', B.eur(NK.grest)], ['Notar', B.eur(NK.notar)], ['Grundbuch', B.eur(NK.grundbuch)],
      ['Makler (Käuferanteil)', B.eur(NK.makler)], ['Summe', B.eur(NK.summe) + ' (' + B.pct(NK.pct, 1) + ' vom Kaufpreis)', { art: 'summe' }]])
      + '<div class="block"><h3>Was dahinter steckt</h3><ul><li>Grunderwerbsteuer: Satz deines Bundeslands auf den Kaufpreis, fällig nach dem Kaufvertrag.</li>'
      + '<li>Notar und Grundbuch: nach dem Gerichts- und Notarkostengesetz, mit Grundschuld für das Darlehen.</li>'
      + '<li>Makler: Käuferanteil laut Angabe im Exposé.</li></ul>'
      + '<p class="det">Kaufnebenkosten zahlt die Bank meist nicht mit. Sie kommen aus dem Eigenkapital.</p></div>');


    var mark = function (html, k) { return html.replace('<section class="seite', '<section data-dp-abschnitt="' + k + '" class="seite'); };
    var S = [];
    S.push(B.deckblatt(c, { eyebrow: 'Haus-Check · Selbst nutzen', titel: 'Ist das Haus gut?', unter: O.adresse,
      wertLabel: W && W.betrag ? wertName(W) : 'Haus-Score', wert: W && W.betrag ? B.eur(W.betrag) : String(H.haus.score),
      wertNeben: 'Haus-Score ' + H.haus.score + ' · ' + H.haus.stufe.wort,
      meta: [['Objekt', ARTNAME[O.objektart] || ''], ['Baujahr', B.jahr(O.baujahr)], ['Wohnfläche', B.zahl(O.wfl) + ' m²'], ['Kaufpreis', B.eur(O.kaufpreis)]] }));
    S.push(B.seite(c, 'Inhalt', B.abschnitt('Haus-Check', 'Inhalt') + '<table class="inhalt"><tbody>' + P.map(function (p, i) {
      return '<tr><td class="num" style="width:12mm;font-weight:700">' + (i + 1) + '</td><td><b>' + B.esc(p[0]) + '</b><div class="det">' + B.esc(p[1]) + '</div></td>'
        + '<td class="r num" style="width:16mm"><span data-dp-toc="a' + (i + 1) + '"></span></td></tr>';
    }).join('') + '</tbody></table>'));
    P.forEach(function (p, i) { S.push(mark(B.seite(c, p[0], B.abschnitt('Abschnitt ' + (i + 1), p[0], p[1]) + p[2]), 'a' + (i + 1))); });
    S.push(B.seite(c, 'Hinweise', B.abschnitt('Anhang', 'Quellen und Methodik')
      + '<p>Der Haus-Score bewertet das Haus aus Preis (35 %), Zustand (35 %) und Lage (30 %). Die Leistbarkeit zeigt getrennt, ob das Haus zu deinem Einkommen passt.</p>'
      + '<p>Die ersparte Miete ist der Mittelwert der ortsüblichen Vergleichsmiete, bei Häusern mit dem Zuschlag laut Mietspiegel.</p>'
      + '<p>Indikative Wertermittlung nach ImmoWertV mit amtlichen Daten der Gutachterausschüsse, ohne Ortsbesichtigung, kein Gutachten. Für Bank, Erbschaft oder Gericht ein Verkehrswertgutachten beauftragen.</p>'
      + '<p>Die Nebenkosten ohne Heizung setzen sich aus Grundsteuer und Trinkwasserentgelt deiner Gemeinde und Durchschnitten für die übrigen Posten zusammen. Die Heizung kommt aus dem Energieausweis, der Energieklasse oder einer Annahme nach Baujahr.</p>'
      + '<p>Kaufen oder mieten vergleicht dein Vermögen: Kaufen ist Wert des Hauses minus Restschuld, Mieten ist Eigenkapital und Kaufnebenkosten angelegt, dazu jeden Monat der Betrag, den der Kauf mehr kostet als die Miete.</p>'
      + '<div class="block"><h3>Quellen</h3><ul class="det"><li>Grundsteuer und Trinkwasserentgelt je Gemeinde: Statistische Ämter des Bundes und der Länder, Deutschland, dl-de/by-2-0, eigene Ableitung je m² Wohnfläche</li>'
      + '<li>Kartendaten © OpenStreetMap-Mitwirkende</li><li>Wertermittlung: Daten des zuständigen Gutachterausschusses, Quellennachweis im Abschnitt Preis und Wert</li></ul></div>'));
    return B.dokument('Haus-Check · ' + (O.adresse || ''), S);
  }

  /** e wie oben. Rückgabe Promise<html>. */
  function dokument(e) {
    var B = window.DpDokument; if (!B) return Promise.reject(new Error('dp-dokument.js fehlt'));
    return B.logo().then(function (logo) {
      var c = { logo: logo, marke: B.marke(), dokument: 'Haus-Check', zeile: (e.objekt && e.objekt.adresse) || '', stand: B.datum(new Date()) };
      return bauen(e, B, c);
    });
  }
  window.DpHausCheck = { dokument: dokument, vorschau: function (e) { return dokument(e).then(function (h) { window.DpDokument.vorschau(h, 'Haus-Check'); return h; }); }, version: 'v5150pp6' };
})();
