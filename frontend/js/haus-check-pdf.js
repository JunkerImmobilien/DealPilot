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
    var P = [];
    function add(titel, unter, html) { P.push([titel, unter, html]); }

    /* 1 · Kurzurteil */
    var g = H.haus.gruppen;
    add('Kurzurteil', 'Ist das Haus gut? Und passt es zu dir?',
      B.scoreRing(H.haus.score, H.haus.stufe.wort, 'Haus-Score von 100')
      + B.kacheln([
        g.preis ? { l: 'Preis', v: B.zahl(g.preis.score), s: 'von 100, Gewicht 35 %' } : null,
        { l: 'Zustand', v: B.zahl(g.zustand.score), s: 'von 100, Gewicht 35 %' },
        g.lage ? { l: 'Lage', v: B.zahl(g.lage.score), s: 'von 100, Gewicht 30 %' } : null,
        { l: 'Passt es zu mir?', v: H.leistbarkeit.quote == null ? 'ohne Einkommen' : B.pct(H.leistbarkeit.quote, 0), s: H.leistbarkeit.ampel === 'gruen' ? 'gut tragbar' : H.leistbarkeit.ampel === 'gelb' ? 'knapp' : H.leistbarkeit.ampel === 'rot' ? 'zu hoch' : 'Belastung vom Netto',
          art: H.leistbarkeit.ampel === 'gruen' ? 'gut' : H.leistbarkeit.ampel === 'rot' ? 'schlecht' : '' }
      ])
      + '<div class="block"><h3>Was du wissen solltest</h3><ul>' + H.urteil.map(function (t) { return '<li>' + B.esc(t) + '</li>'; }).join('') + '</ul></div>');

    /* 2 · Preis und Wert */
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
      wHtml += '<p class="det">Indikative Wertermittlung nach ImmoWertV, ohne Ortsbesichtigung, kein Gutachten.</p>';
      /* Namensnennung: nur die Quellen, die in DIESEM Wert stecken (Lizenzvermerke der Registersätze) */
      if (W.quellen && W.quellen.length) wHtml += '<div class="block"><h3>Quellennachweis</h3><ul>' + W.quellen.map(function (q) {
        return '<li class="det">' + B.esc(q.vermerk) + (q.kennzahlen && q.kennzahlen.length ? ' (' + B.esc(q.kennzahlen.join(', ')) + ')' : '') + '</li>'; }).join('') + '</ul></div>';
    } else wHtml = '<p>Für dieses Objekt liegt noch keine Wertermittlung vor.' + (W && (W.weg || W.grund) && !/^[a-z_]+$/.test(String(W.weg || W.grund)) ? ' ' + B.esc(W.weg || W.grund) : '') + '</p>'
      + '<p class="det">Mit der vollständigen Anschrift rechnet DealPilot den Wert nach ImmoWertV aus den Daten des Gutachterausschusses.</p>';
    wHtml += '<div class="block"><h3>Kaufnebenkosten</h3>' + B.liste([
      ['Grunderwerbsteuer', B.eur(H.nebenkosten.grest)], ['Notar', B.eur(H.nebenkosten.notar)], ['Grundbuch', B.eur(H.nebenkosten.grundbuch)],
      ['Makler (Käuferanteil)', B.eur(H.nebenkosten.makler)], ['Summe', B.eur(H.nebenkosten.summe) + ' (' + B.pct(H.nebenkosten.pct, 1) + ')', { art: 'summe' }]]) + '</div>';
    add('Preis und Wert', 'Kaufpreis gegen den Wert nach ImmoWertV, Kaufnebenkosten', wHtml);

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
      + '<p class="det">Annahmen: Wertentwicklung ' + B.pct(KM.annahmen.wertsteigerung_pct, 1) + ', Mietsteigerung ' + B.pct(KM.annahmen.mietsteigerung_pct, 1) + ' und Anlagezins ' + B.pct(KM.annahmen.anlagezins_pct, 1) + ' im Jahr. Beispielrechnung, keine Garantie.</p>');

    /* 4 · Zustand und Energie */
    add('Haus und Zustand', 'Baujahr, Energie, Pflichten nach dem Kauf',
      B.energieSkala(O.energieklasse, O.kwh)
      + '<div class="block"><h3>Worauf du achten solltest</h3><ul>' + g.zustand.punkte.concat(g.zustand.hinweise).map(function (t) { return '<li>' + B.esc(t) + '</li>'; }).join('') + '</ul></div>'
      + (O.unterlagen && O.unterlagen.length ? '<div class="block"><h3>Aus deinen Unterlagen</h3><ul>' + O.unterlagen.map(function (t) { return '<li>' + B.esc(t) + '</li>'; }).join('') + '</ul></div>' : ''));

    /* 5 · Lage und Umfeld */
    var uHtml = '';
    if (U && U.ok) {
      uHtml = '<table><thead><tr><th>In der Nähe</th><th class="r">Entfernung</th><th class="r">zu Fuß</th></tr></thead><tbody>' + U.kategorien.map(function (k) {
        var n = k.naechster;
        return '<tr><td>' + B.esc(k.label) + (n && n.name ? '<div class="det">' + B.esc(n.name) + '</div>' : '') + '</td><td class="r num">'
          + (k.nicht_ermittelt ? 'nicht ermittelt' : n ? (n.luftlinie_m < 1000 ? B.zahl(n.luftlinie_m) + ' m' : B.zahl(n.luftlinie_m / 1000, 1) + ' km') : 'nicht im Umkreis') + '</td><td class="r num">' + (n ? 'ca. ' + n.fuss_min + ' Min.' : '–') + '</td></tr>';
      }).join('') + '</tbody></table><p class="det">' + B.esc(U.hinweis) + ' Kartendaten ' + B.esc(U.vermerk) + '.</p>';
    } else uHtml = '<p>Das Umfeld war beim Erstellen nicht abrufbar.</p>';
    add('Lage und Umfeld', 'Was ist in der Nähe?', (e.karte ? '<img class="karte" src="' + e.karte + '" alt="Karte">' : '') + uHtml);

    /* 6 · Finanzierung, Leistbarkeit und Bank */
    var F = H.finanzierung;
    var bank = B.kacheln([
      { l: 'Darlehen', v: B.eur(F.darlehen), s: 'Beleihungsauslauf zum Kaufpreis ' + B.pct(F.ltv_pct, 0) },
      { l: 'Rate im Monat', v: B.eur(F.rate), s: 'Zins ' + B.pct(F.zins_pct, 2) + ' plus ' + B.pct(F.tilgung_pct, 0) + ' Tilgung' },
      { l: 'Wohnkosten im Monat', v: B.eur(H.leistbarkeit.wohnkosten), s: 'Rate plus Kosten, die ein Mieter nicht trägt' },
      { l: 'Belastung', v: H.leistbarkeit.quote == null ? 'ohne Einkommen' : B.pct(H.leistbarkeit.quote, 0) + ' vom Netto', art: H.leistbarkeit.ampel === 'gruen' ? 'gut' : H.leistbarkeit.ampel === 'rot' ? 'schlecht' : '' }
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
    add('Finanzierung und Bank', 'Rate, Belastung, Beleihungswert, Unterlagen', bank);

    /* 7 · Förderung */
    if (O.foerderung && O.foerderung.length) add('Förderung', 'Öffentliche Programme, die in Frage kommen',
      '<ul>' + O.foerderung.map(function (f) { return '<li><b>' + B.esc(f.name) + '</b> ' + B.esc(f.satz || '') + '</li>'; }).join('') + '</ul>'
      + '<p class="det">Vor Vorhabenbeginn bzw. vor dem Kaufvertrag beantragen. Voraussetzungen und Konditionen beim Förderprogramm prüfen.</p>');

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
    S.push(B.seite(c, 'Hinweise', B.abschnitt('Anhang', 'Methodik und Hinweise')
      + '<p>Der Haus-Score bewertet das Haus aus Preis (35 %), Zustand (35 %) und Lage (30 %). Die Leistbarkeit zeigt getrennt, ob das Haus zu deinem Einkommen passt.</p>'
      + '<p>Die ersparte Miete ist der Mittelwert der ortsüblichen Vergleichsmiete, bei Häusern mit dem Zuschlag laut Mietspiegel.</p>'
      + '<p>Indikative Wertermittlung nach ImmoWertV mit amtlichen Daten der Gutachterausschüsse, ohne Ortsbesichtigung, kein Gutachten. Für Bank, Erbschaft oder Gericht ein Verkehrswertgutachten beauftragen.</p>'
      + '<p class="det">Kartendaten © OpenStreetMap-Mitwirkende.</p>'));
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
  window.DpHausCheck = { dokument: dokument, vorschau: function (e) { return dokument(e).then(function (h) { window.DpDokument.vorschau(h, 'Haus-Check'); return h; }); }, version: 'v5130' };
})();
