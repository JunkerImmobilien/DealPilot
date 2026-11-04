/* ═══════════════════════════════════════════════════════════════════════
   dp-dokumente.js · v3179 — die Dokumente im einheitlichen Design (DEMO)
   Inhalte fuer: Investment-PDF, Bankfassung, Kurzfassung, Kaufpreisaufteilung,
   Finanzamt (Werbungskosten), Track Record, Bankexport. Der Marktbericht
   Profi (marktbericht-profi.js) ist die Vorlage des Designs.

   DEMO-STAND: Marcel nimmt die Gestaltung ab, bevor eine Fassung die
   bisherige jsPDF-Ausgabe ersetzt. Bis dahin sind die Knoepfe unveraendert;
   erzeugt wird ueber DpDokumente.oeffnen(typ) oder den PDF-Dienst (dok_*).

   Zahlen: NUR aus den Rechenkernen der App — State.kpis / State.cfRows /
   State._vz nach calcNow(), DealKpis, _computeYearTotal (Steuer),
   _lastBmfResults/_dpKpaZahlen (BMF), getAllObjectsData /
   _buildBankExportRows (Portfolio). Hier wird nichts neu gerechnet ausser
   Summen und Darstellung (z. B. Kaufnebenkosten = Kaufpreis × Satz, wie im
   bisherigen PDF).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var D = function () { return window.DpDokument; };

  /* ── Lesen aus dem geladenen Objekt ───────────────────────────────── */
  function feld(id) { var e = document.getElementById(id); if (!e) return ''; if (e.type === 'checkbox') return e.checked; return e.value == null ? '' : String(e.value); }
  function zahlAus(id) {
    var s = String(feld(id) || '').trim(); if (!s) return null;
    s = s.replace(/[^\d,.\-]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s); return isFinite(n) ? n : null;
  }
  var OBJART = { ETW: 'Eigentumswohnung', EFH: 'Einfamilienhaus', ZFH: 'Zweifamilienhaus', MFH: 'Mehrfamilienhaus', DHH: 'Doppelhaushälfte', RH: 'Reihenhaus', GESCH: 'Geschäftshaus', BUERO: 'Bürogebäude' };
  function objektKopf() {
    var str = [feld('str'), feld('hnr')].filter(Boolean).join(' '), ort = [feld('plz'), feld('ort')].filter(Boolean).join(' ');
    var art = OBJART[feld('objart')] || feld('objart') || 'Immobilie';
    return { adresse: [str, ort].filter(Boolean).join(', '), strasse: str, ort: ort, art: art, artKurz: feld('objart'),
      wfl: zahlAus('wfl'), bj: zahlAus('baujahr'), gs: zahlAus('gsfl'), seq: (window.State && State._obj_seq) || feld('_obj_seq') || '' };
  }
  function api(p) { return window.Auth.apiCall(p); }
  /* Objektinfo: Fotos, Nummer; ohne Foto die Lagekarte aus dem neuesten Marktbericht (das Objekt selbst fuehrt keine Koordinaten) */
  function objektInfo(key, adresse) {
    if (!key) return Promise.resolve({ fotos: [], seq: '', kuerzel: '', karte: null });
    return api('/objects/' + encodeURIComponent(key)).then(function (o) {
      var info = { fotos: (o && o.photos) || [], seq: (o && o.data && o.data._obj_seq) || '', kuerzel: (o && o.kuerzel) || '', karte: null };
      if (info.fotos.length) return info;
      /* v3179c · Koordinaten ueber die Anschrift (Geocoder des Marktberichts, gecacht) - nicht ueber den
         Berichtsverlauf: per Schnittstelle erzeugte Berichte tragen keinen Objektbezug. */
      var adr = adresse || (o && o.name) || '';
      if (!adr) return info;
      return api('/marktbericht/geocode?address=' + encodeURIComponent(adr)).then(function (g) {
        return D().karte(g && g.lat, g && g.lon, 16, 1400, 700).then(function (k) { info.karte = k; return info; });
      }).catch(function () { return info; });
    }).catch(function () { return { fotos: [], seq: '', kuerzel: '', karte: null }; });
  }
  function fotosFuer(key) { return objektInfo(key).then(function (i) { return i.fotos; }); }
  function basis(dokName) {
    var B = D(), m = B.marke();
    return B.logo(m).then(function (l) { return { marke: m, logo: l, dokument: dokName, stand: B.datum(new Date()) }; });
  }
  /* Kaufnebenkosten aus dem Kern (DealKpis.nebenkosten): Grunderwerbsteuer ohne Inventar/Moeblierung.
     v3179 · Erster Entwurf rechnete Kaufpreis × Satz selbst - GrESt 35.425 statt 34.970 €. */
  function nebenkosten(kp) {
    var e = { kp: kp, inventar: zahlAus('moebl') || 0, makler_p: zahlAus('makler_p'), notar_p: zahlAus('notar_p'), gba_p: zahlAus('gba_p'), gest_p: zahlAus('gest_p'), ji_p: zahlAus('ji_p') };
    var r = (window.DealKpis && DealKpis.nebenkosten) ? DealKpis.nebenkosten(e) : {};
    return [['Makler', 'makler', 'makler_p'], ['Notar', 'notar', 'notar_p'], ['Grundbuchamt', 'gba', 'gba_p'], ['Grunderwerbsteuer', 'grest', 'gest_p'], ['Vermittlung / Beratung', 'ji', 'ji_p']]
      .map(function (x) { return r[x[1]] ? { name: x[0], pct: e[x[2]], eur: r[x[1]] } : null; }).filter(Boolean);
  }
  function darlehen() {
    var l = [], d1 = zahlAus('d1');
    if (d1) l.push({ name: 'Darlehen I · Annuitätendarlehen', betrag: d1, zins: zahlAus('d1z'), tilg: zahlAus('d1t'), bind: zahlAus('d1_bindj') });
    var d2 = zahlAus('d2'); var an = feld('d2_enable');
    if (d2 && an !== false) l.push({ name: 'Darlehen II', betrag: d2, zins: zahlAus('d2z'), tilg: zahlAus('d2t'), bind: zahlAus('d2_bindj') });
    l.forEach(function (x) { if (x.zins != null && x.tilg != null) x.rate = x.betrag * (x.zins + x.tilg) / 100 / 12; });
    return l;
  }

  /* ── gemeinsame Seitenstuecke der Investment-Familie ─────────────── */
  function kpiKacheln(K, B) {
    return B.kacheln([
      { l: 'Bruttomietrendite', v: B.pct(K.bmy, 2), s: 'auf Kaufpreis' },
      { l: 'Nettomietrendite', v: B.pct(K.nmy, 2), s: 'auf Gesamtinvestition' },
      { l: 'Cashflow n. St.', v: B.eurS((K.cf_ns || 0) / 12), s: 'je Monat, Jahr 1', art: (K.cf_ns || 0) >= 0 ? 'gut' : 'schlecht' },
      { l: 'EK-Rendite', v: B.pct(K.ekr, 2), s: 'p. a. vor Steuern' },
      { l: 'LTV', v: B.pct(K.ltv, 1), s: 'auf Kaufpreis' },
      { l: 'DSCR', v: B.zahl(K.dscr, 2), s: K.dscr >= 1.2 ? 'tragfähig' : 'knapp', art: K.dscr >= 1.2 ? 'gut' : 'schlecht' },
      { l: 'Kaufpreisfaktor', v: B.zahl(K.fak, 1) + '-fach' },
      { l: 'Equity Multiple', v: B.zahl(K.em, 1) + 'x', s: 'über die Haltedauer' }
    ]);
  }
  function cashflowJahr1(K, B) {
    return B.liste([
      ['Warmmiete / Jahr (NKM + NK-Vorauszahlungen)', B.eur(K.warm_j)],
      ['abzüglich NK-Vorauszahlungen der Mieter', B.eurS(-(K.nk_vz_j || 0)), { art: 'ein' }],
      ['Nettokaltmiete / Jahr', B.eur(K.nkm_netto_j), { art: 'summe' }],
      ['zuzüglich Zusatzeinnahmen (Stellplatz, Garage)', B.eurS(K.ze_j || 0), { art: 'ein' }],
      ['abzüglich nicht umlagefähige Bewirtschaftung', B.eurS(-(K.bwk_cf || 0)), { art: 'ein' }],
      ['Betriebsergebnis (NOI)', B.eur(K.noi_dscr), { art: 'summe' }],
      ['abzüglich Zinsen', B.eurS(-(K.zins_j || 0)), { art: 'ein' }],
      ['abzüglich Tilgung', B.eurS(-(K.tilg_j || 0)), { art: 'ein' }],
      ['Cashflow vor Steuern / Jahr', B.eurS(K.cf_op), { art: 'summe', farbe: 1 }],
      ['Steuern (Belastung −, Erstattung +)', B.eurS(-(K.steuer || 0)), { art: 'ein', farbe: 1 }],
      ['Cashflow nach Steuern / Jahr', B.eurS(K.cf_ns), { art: 'ende', farbe: 1 }],
      ['Cashflow nach Steuern / Monat', B.eurS((K.cf_ns || 0) / 12, 0), { farbe: 1 }]
    ]);
  }
  function investitionUndFinanzierung(K, B, kurz) {
    var kp = K.kp || zahlAus('kp') || 0, nk = nebenkosten(kp), nkSum = nk.reduce(function (a, x) { return a + x.eur; }, 0);
    var inv = [['Kaufpreis', B.eur(kp)]];
    if (!kurz) nk.forEach(function (x) { inv.push([x.name + ' (' + B.zahl(x.pct, 2) + ' %)', B.eur(x.eur), { art: 'ein' }]); });
    inv.push(['Erwerbsnebenkosten (' + B.zahl(kp ? nkSum / kp * 100 : 0, 1) + ' %)', B.eur(nkSum), { art: 'summe' }]);
    var san = zahlAus('san'); if (san) inv.push(['Sanierung', B.eur(san)]);
    inv.push(['Gesamtinvestition', B.eur(K.gi), { art: 'ende' }]);
    var dl = darlehen(), fin = [['Eigenkapital', B.eur(K.ek), { det: B.zahl(K.gi ? K.ek / K.gi * 100 : 0, 1) + ' % der Gesamtinvestition' }]];
    dl.forEach(function (x) {
      fin.push([x.name, B.eur(x.betrag)]);
      fin.push(['Zins / Tilgung' + (x.bind ? ' / Bindung' : ''), B.pct(x.zins, 2) + ' · ' + B.pct(x.tilg, 2) + (x.bind ? ' · ' + B.zahl(x.bind, 0) + ' J.' : ''), { art: 'ein' }]);
      if (x.rate) fin.push(['Rate / Monat', B.eur(x.rate, 2), { art: 'ein' }]);
    });
    fin.push(['Finanzierung gesamt', B.eur(K.d_total), { art: 'summe' }]);
    fin.push(['Beleihungsauslauf (LTV)', B.pct(K.ltv, 1)]);
    if (K.wp_kpi) fin.push(['Wertpuffer gegenüber Kaufpreis', B.eurS(K.wp_kpi), { farbe: 1 }]);
    return '<div class="zwei"><div class="block"><h3>Investition</h3>' + B.liste(inv) + '</div><div class="block"><h3>Finanzierung</h3>' + B.liste(fin) + '</div></div>';
  }
  function bewirtschaftung(K, B) {
    return '<div class="block"><h3>Bewirtschaftung</h3>' + B.liste([
      ['Umlagefähig (durchlaufend) / Jahr', B.eur(K.bwk_ul)],
      ['Nicht umlagefähig (im Cashflow) / Jahr', B.eur(K.bwk_nul), { art: 'summe' }],
      ['Bewirtschaftungskosten gesamt / Jahr', B.eur(K.bwk)],
      ['Anteil an der Kaltmiete', B.pct(K.nkm_j ? K.bwk / K.nkm_j * 100 : null, 1), { art: 'ein' }]
    ]) + '</div><div class="block"><h3>Steuerliche Wirkung (Jahr 1)</h3>' + B.liste([
      ['Abschreibung (AfA) / Jahr', B.eur(K.afa)],
      ['Zu versteuerndes Ergebnis', B.eurS(K.zve_immo)],
      ['Steuerwirkung (Erstattung +, Belastung −)', B.eurS(-(K.steuer || 0)), { farbe: 1 }]
    ]) + '</div>';
  }
  function dreiPhasen(K, B) {
    var sp = function (k, t, cls, w) {
      return '<div class="phase ' + cls + '"><h4>' + t + '</h4><table><tbody>'
        + [['Kaltmiete / Jahr', B.eur(w.nkm)], ['− Bewirtschaftung', B.eur(w.bwk)], ['− Zinsen', B.eur(w.zins)], ['− Tilgung', B.eur(w.tilg)],
          ['= CF v. St.', B.eurS(w.cfop)], ['± Steuern', B.eurS(w.st)], ['= CF n. St.', B.eurS(w.cfns)], ['= je Monat', B.eurS(w.cfns / 12)]]
          .map(function (z, i) { return '<tr' + (i >= 4 && i !== 5 ? ' class="summe"' : '') + '><td>' + z[0] + '</td><td class="r num">' + z[1] + '</td></tr>'; }).join('')
        + '</tbody></table></div>';
    };
    return '<div class="drei3">'
      + sp(1, 'Jahr 1', 'p1', { nkm: K.nkm_j, bwk: K.bwk_cf, zins: K.zins_j, tilg: K.tilg_j, cfop: K.cf_op, st: -(K.steuer || 0), cfns: K.cf_ns })
      + sp(2, 'Ende Zinsbindung', 'p2', { nkm: K.nkm_ezb, bwk: K.bwk_cf_ezb, zins: K.zins_ezb, tilg: K.tilg_ezb, cfop: K.cf_op_ezb, st: -(K.ster_ezb || 0), cfns: K.cf_ns_ezb })
      + sp(3, 'Anschluss', 'p3', { nkm: K.nkm_an, bwk: K.bwk_cf_an, zins: K.zins_an, tilg: K.tilg_an, cfop: K.cf_op_an, st: -(K.ster_an || 0), cfns: K.cf_ns_an })
      + '</div>';
  }
  function zinsRisiko(K, B) {
    var rs = (State.cfRows || []).filter(function (r) { return r.y === (zahlAus('d1_bindj') || 10); })[0];
    return '<div class="block"><h3>Zinsänderungsrisiko</h3>' + B.liste([
      ['Zinsbindung', B.zahl(zahlAus('d1_bindj'), 0) + ' Jahre'],
      ['Restschuld am Ende der Zinsbindung', B.eur(rs ? rs.rs : null)],
      ['Rate nach Anschluss / Monat', B.eur(K.rate_an_m, 2)],
      ['Mehrbelastung je Monat bei Zinsanstieg (' + B.zahl(K.zaer_pct, 1) + ' Prozentpunkte)', B.eur(K.zaer_m, 2), { art: 'ende' }]
    ]) + '</div>';
  }
  function projektion(B, max) {
    var r = (State.cfRows || []).slice(0, max || 15);
    return '<table class="dicht"><thead><tr><th>Jahr</th><th class="r">Kaltmiete</th><th class="r">Bewirt.</th><th class="r">Zins</th><th class="r">Tilgung</th><th class="r">CF v. St.</th><th class="r">Steuer</th><th class="r">CF n. St.</th><th class="r">Restschuld</th><th class="r">Wert</th><th class="r">LTV</th></tr></thead><tbody>'
      + r.map(function (z) {
        var f = function (v, s) { return '<td class="r num' + (s && v > 0 ? ' pos' : s && v < 0 ? ' neg' : '') + '">' + (s ? B.eurS(v).replace(' €', '') : B.zahl(v, 0)) + '</td>'; };
        return '<tr><td class="num">' + z.cal + '</td>' + f(z.nkm_y) + f(z.bwk_cf_y) + f(z.zy) + f(z.ty) + f(z.cfop_y, 1) + f(-(z.tax_y || 0), 1) + f(z.cfns_y, 1) + f(z.rs) + f(z.wert_y) + '<td class="r num">' + B.zahl(z.ltv_y, 0) + ' %</td></tr>';
      }).join('') + '</tbody></table><p class="det">Alle Werte in Euro. CF = Cashflow; Steuer: Erstattung +, Belastung −.</p>';
  }
  function vermoegen(K, B) {
    var r = State.cfRows || [], vz = State._vz || {};
    var lin = B.linien([
      { name: 'Immobilienwert', klasse: 'l3', werte: r.map(function (z) { return { x: z.cal, y: z.wert_y }; }) },
      { name: 'Restschuld', klasse: 'l2', werte: r.map(function (z) { return { x: z.cal, y: z.rs }; }) }
    ], { flaeche: [0, 1], titel: 'Vermögensaufbau' });
    var wf = B.wasserfall([
      { name: 'Tilgung', wert: vz.tilgung_kum, klasse: 'b1' }, { name: 'CF-Überschuss', wert: vz.cf_ueberschuss_konto, klasse: 'b2' },
      { name: 'Steuervorteil', wert: vz.steuervorteil, klasse: 'b2' }, { name: 'Wertsteigerung', wert: vz.wertsteig_kum, klasse: 'b2' }
    ], 'Zuwachs');
    var letzt = r[r.length - 1] || {};
    return '<div class="block"><h3>Vermögensaufbau über ' + r.length + ' Jahre</h3><p class="sub">Die Fläche zwischen Immobilienwert und Restschuld ist das aufgebaute Eigenkapital: im letzten Jahr ' + B.eur(letzt.eq_y) + '.</p>' + lin + '</div>'
      + '<div class="block"><h3>Vermögenszuwachs</h3>' + wf
      + B.kacheln([{ l: 'Eingesetztes Eigenkapital', v: B.eur(K.ek) }, { l: 'Vermögenszuwachs', v: B.eurS(vz.verm_zuwachs), art: 'gut' }, { l: 'Equity Multiple', v: B.zahl(K.em, 1) + 'x', art: 'hi' }], true) + '</div>';
  }
  function annahmen(K, B) {
    return '<div class="block"><h3>Annahmen</h3>' + B.liste([
      ['Mietsteigerung p. a.', B.pct(K.mstg, 1)], ['Wertsteigerung p. a.', B.pct(zahlAus('wertstg'), 1)], ['Kostensteigerung p. a.', B.pct(zahlAus('kostenstg'), 1)],
      ['Exit-Rendite (Bruttomiete auf Verkaufspreis)', B.pct(zahlAus('exit_bmy'), 1)], ['Grenzsteuersatz', B.pct(zahlAus('grenz'), 2)]
    ]) + '<p class="det" style="margin-top:3mm">Alle Angaben ohne Gewähr. Keine Steuer- oder Anlageberatung. Prognosen beruhen auf den genannten Annahmen und sind keine Zusicherung.</p></div>';
  }

  /* ── 1 · Investment-PDF ──────────────────────────────────────────── */
  function investment(art) {
    var B = D(), K = (window.State && State.kpis) || {}, o = objektKopf(), key = window._currentObjKey;
    var kurz = art === 'kurz', bank = art === 'bank';
    var name = kurz ? 'Investment Case · Kurzfassung' : bank ? 'Investment Case · Bankfassung' : 'Investment Case';
    var sc = (window._dpPdfScore && _dpPdfScore(K)) || {};
    return Promise.all([basis(name), objektInfo(key, o.adresse)]).then(function (z) {
      var c = z[0], info = z[1], fotos = info.fotos; c.zeile = o.adresse; o.seq = info.seq || o.seq;
      var S = [];
      S.push(B.deckblatt(c, { bild: fotos[0] || info.karte || null, eyebrow: name, titel: o.adresse, unter: [o.art, o.wfl ? B.zahl(o.wfl, 0) + ' m² Wohnfläche' : '', o.bj ? 'Baujahr ' + B.jahr(o.bj) : ''].filter(Boolean).join(' · '),
        kz: [{ l: 'Kaufpreis', v: B.eur(K.kp) }, { l: 'Gesamtinvestition', v: B.eur(K.gi) }, { l: 'Eigenkapital', v: B.eur(K.ek) }, { l: 'Bruttomietrendite', v: B.pct(K.bmy, 2), art: 'hi' }],
        meta: [['Objekt-Nr.', o.seq || '–'], ['Stand', c.stand], ['Deal Score', sc.score != null ? B.zahl(sc.score, 0) + ' · ' + (sc.label || '') : '–']],
        zitat: feld('thesis') || '', hinweisRechts: bank ? 'Finanzierungsunterlage' : 'Vertraulich' }));
      /* Überblick */
      S.push(B.seite(c, 'Überblick', B.abschnitt('Executive Summary', 'Investitionsüberblick', o.adresse + ' · ' + o.art)
        + '<div class="zwei"><div>' + B.scoreRing(sc.score, sc.label) + '</div><div>' + B.kacheln([
          { l: 'CF n. St. Jahr 1', v: B.eurS(K.cf_ns), art: 'gut' }, { l: 'CF n. St. Ende Zinsbindung', v: B.eurS(K.cf_ns_ezb) }], false).replace('class="kz"', 'class="kz" style="grid-template-columns:1fr 1fr"') + '</div></div>'
        + kpiKacheln(K, B) + '<h3>Von der Warmmiete zum Cashflow</h3>' + cashflowJahr1(K, B)));
      /* Objekt & Finanzierung */
      var galerie = (!kurz && fotos.length > 1) ? '<h3>Ansichten</h3><div class="galerie">' + fotos.slice(1, 5).map(function (f) { return '<img src="' + f + '" alt="">'; }).join('') + '</div>' : '';
      S.push(B.seite(c, 'Objekt und Finanzierung', B.abschnitt('Abschnitt 1', 'Objekt und Finanzierung')
        + '<div class="kv">' + [['Objektart', o.art], ['Baujahr', B.jahr(o.bj)], ['Wohnfläche', o.wfl ? B.zahl(o.wfl, 0) + ' m²' : '–'], ['Grundstück', o.gs ? B.zahl(o.gs, 0) + ' m²' : '–'],
          ['Kaufdatum', B.datum(feld('kaufdat')) || '–'], ['Energieklasse', feld('ds2_energie') || '–']].map(function (k) { return '<div><span>' + k[0] + '</span><span>' + B.esc(k[1]) + '</span></div>'; }).join('') + '</div>'
        + investitionUndFinanzierung(K, B, kurz) + (kurz ? '' : galerie)));
      if (!kurz) S.push(B.seite(c, 'Ertrag und Bewirtschaftung', B.abschnitt('Abschnitt 2', 'Ertrag, Bewirtschaftung und Steuer') + bewirtschaftung(K, B)
        + (feld('ds2_energie') ? '<h3>Energieeffizienz</h3>' + B.energieSkala(feld('ds2_energie')) : '')));
      S.push(B.seite(c, 'Drei Phasen', B.abschnitt('Abschnitt ' + (kurz ? 2 : 3), 'Cashflow in drei Phasen', 'Jahr 1, Ende der Zinsbindung und Anschlussfinanzierung mit dem angenommenen Zins.') + dreiPhasen(K, B) + zinsRisiko(K, B)));
      if (!kurz) {
        S.push(B.seite(c, 'Projektion', B.abschnitt('Abschnitt 4', 'Cashflow-Projektion ' + (State.cfRows || []).length + ' Jahre') + projektion(B)));
        S.push(B.seite(c, 'Vermögen', B.abschnitt('Abschnitt 5', 'Vermögensaufbau') + vermoegen(K, B)));
      }
      S.push(B.seite(c, 'Annahmen', B.abschnitt('Anhang', 'Annahmen und Hinweise') + annahmen(K, B)
        + (kurz ? '<div class="hinweis">Kurzfassung: Projektion, Vermögensaufbau, Bewirtschaftung und Mieterliste stehen im vollständigen Investment Case.</div>' : '')));
      return B.dokument(name + ' · ' + o.adresse, S);
    });
  }

  /* ── 4 · Kaufpreisaufteilung ─────────────────────────────────────── */
  function bmfBereit() {
    if (window._lastBmfResults && window._lastBmfResults._fuer === window._currentObjKey) return Promise.resolve();
    return new Promise(function (ok) {
      try { if (typeof window.openBMFModal === 'function') window.openBMFModal(); } catch (e) {}
      setTimeout(function () {
        try { if (typeof window.runBmf === 'function') window.runBmf(); } catch (e) {}
        var t0 = Date.now();
        (function warte() {
          if (window._lastBmfResults || Date.now() - t0 > 15000) { try { window.closeBMFModal && window.closeBMFModal(); } catch (e) {} if (window._lastBmfResults) window._lastBmfResults._fuer = window._currentObjKey; return ok(); }
          setTimeout(warte, 400);
        })();
      }, 3500);
    });
  }
  function kaufpreisaufteilung() {
    var B = D(), o = objektKopf();
    return bmfBereit().then(function () { return Promise.all([basis('Kaufpreisaufteilung'), objektInfo(window._currentObjKey, o.adresse)]); }).then(function (zz) {
      var c = zz[0], info = zz[1]; c.zeile = o.adresse;
      var r = window._lastBmfResults || {}, w = function (k) { return r[k] && typeof r[k] === 'object' ? r[k].value : r[k]; };
      var z = (window._dpKpaZahlen && _dpKpaZahlen()) || {};
      var S = [];
      S.push(B.deckblatt(c, { bild: info.fotos[0] || info.karte || null, eyebrow: 'Kaufpreisaufteilung nach BMF-Arbeitshilfe', titel: o.adresse, unter: o.art + (o.bj ? ' · Baujahr ' + B.jahr(o.bj) : ''),
        wertLabel: 'Gebäudeanteil', wert: B.pct(w('gebaeudeanteil_prozent'), 2), wertNeben: 'Grund und Boden ' + B.eur(w('kaufpreisanteil_grund')) + '<br>Gebäude ' + B.eur(w('kaufpreisanteil_gebaeude')),
        meta: [['Kaufpreis', B.eur(z.kp)], ['Stand', c.stand], ['Grundlage', 'BMF-Arbeitshilfe']] }));
      S.push(B.seite(c, 'Herleitung', B.abschnitt('Abschnitt 1', 'Herleitung nach der Arbeitshilfe', 'Sach- und Ertragswert nach der Arbeitshilfe des Bundesministeriums der Finanzen; maßgeblich ist der höhere Bezug je Objektart.')
        + B.liste([['Bodenwert', B.eur(w('bodenwert'))], ['Vorläufiger Sachwert', B.eur(w('sachwert_vorlaeufig'))], ['Marktangepasster Sachwert', B.eur(w('sachwert_marktangepasst'))],
          ['Vorläufiger Ertragswert', B.eur(w('ertragswert'))], ['Maßgebender Verkehrswert', B.eur(w('massgebender_verkehrswert')), { art: 'summe' }],
          ['Grund und Boden (Einzelwert)', B.eur(w('grund_boden_wert')), { art: 'ein' }], ['Gebäude (Einzelwert)', B.eur(w('gebaeude_wert')), { art: 'ein' }],
          ['Gebäudeanteil', B.pct(w('gebaeudeanteil_prozent'), 2), { art: 'ende' }]])
        /* v3179b · kaufpreisanteil_* der BMF-Rechnung stehen auf den ANSCHAFFUNGSKOSTEN (Kaufpreis Immobilie +
           Erwerbsnebenkosten), nicht auf dem Kaufpreis - erster Entwurf nannte sie „Anteile des Kaufpreises“
           (Westerfeldstr.: 489.828 + 122.763 = 612.591 € gegen 538.000 € Kaufpreis). */
        + (function () {
          var akG = Number(w('kaufpreisanteil_grund')) || 0, akB = Number(w('kaufpreisanteil_gebaeude')) || 0, ak = akG + akB;
          var pct = Number(w('gebaeudeanteil_prozent')) || 0, kpI = Number(z.kpImmo) || 0;
          var vGeb = kpI * pct / 100, vBod = kpI - vGeb;
          return '<h3>Aufteilung der Anschaffungskosten</h3>' + B.liste([['Kaufpreis', B.eur(z.kp)], ['davon Inventar / Möblierung', B.eur(z.inventar), { art: 'ein' }], ['Kaufpreis Immobilie', B.eur(kpI), { art: 'summe' }],
            ['Erwerbsnebenkosten (anteilig)', B.eur(ak - kpI)], ['Anschaffungskosten', B.eur(ak), { art: 'summe' }],
            ['Anteil Grund und Boden (' + B.zahl(100 - pct, 2) + ' %)', B.eur(akG), { art: 'ein' }], ['Anteil Gebäude (' + B.zahl(pct, 2) + ' %) · AfA-Bemessungsgrundlage', B.eur(akB), { art: 'ende' }]])
            + '<h3>Aufteilung des Kaufpreises für den Kaufvertrag</h3>' + B.liste([['Grund und Boden', B.eur(vBod)], ['Gebäude', B.eur(vGeb)], ['Kaufpreis Immobilie', B.eur(kpI), { art: 'ende' }]])
            + '<div class="hinweis">Formulierungsvorschlag: „Vom Kaufpreis entfallen ' + B.eur(vGeb) + ' auf das Gebäude und ' + B.eur(vBod) + ' auf Grund und Boden' + (z.inventar ? '; ' + B.eur(z.inventar) + ' entfallen auf mitverkauftes Inventar' : '') + '.“ Die Aufteilung folgt der Arbeitshilfe des Bundesministeriums der Finanzen; keine Steuerberatung.</div>';
        })()));
      return B.dokument('Kaufpreisaufteilung · ' + o.adresse, S);
    });
  }

  /* ── 5 · Finanzamt (Werbungskosten) ──────────────────────────────── */
  var WK = [['1. Finanzierungskosten', [['schuldzinsen', 'Schuldzinsen'], ['kontofuehrung', 'Kontoführung'], ['bereitstellung', 'Bereitstellungszinsen'], ['notar_grundschuld', 'Notar Grundschuld'], ['vermittlung', 'Vermittlung'], ['finanz_sonst', 'Sonstige']]],
    ['2. Betriebskosten', [['nk_umlf', 'umlagefähig'], ['nk_n_umlf', 'nicht umlagefähig'], ['betr_sonst', 'Sonstige']]],
    ['3. Verwaltungskosten', [['hausverwaltung', 'Hausverwaltung'], ['steuerber', 'Steuerberatung'], ['porto', 'Porto'], ['verw_sonst', 'Sonstige']]],
    ['4. Sonstige Kosten', [['fahrtkosten', 'Fahrtkosten'], ['verpflegung', 'Verpflegung'], ['hotel', 'Übernachtung'], ['inserat', 'Inserate'], ['gericht', 'Gericht/Anwalt'], ['telefon', 'Telefon'], ['sonst_kosten', 'Sonstige'], ['sonst_bewegl_wg', 'Bewegliche Wirtschaftsgüter']]],
    ['5. Absetzung für Abnutzung (AfA)', [['afa', 'AfA']]],
    ['6. Anschaffungsnahe Herstellkosten / Erhaltung', [['anschaffungsnah', 'Anschaffungsnah'], ['erhaltungsaufwand', 'Erhaltungsaufwand']]]];
  function finanzamt(jahre) {
    var B = D(), o = objektKopf(), rows = (State.cfRows || []).slice(0, jahre || 3);
    return Promise.all([basis('Werbungskosten · Finanzamt'), objektInfo(window._currentObjKey, o.adresse)]).then(function (zz) {
      var c = zz[0], info = zz[1]; c.zeile = o.adresse;
      var S = [], ges = [];
      S.push(B.deckblatt(c, { bild: info.fotos[0] || info.karte || null, eyebrow: 'Aufstellung Werbungskosten · Anlage V', titel: o.adresse, unter: o.art + ' · vermietet',
        meta: [['Veranlagungsjahre', rows.map(function (r) { return r.cal; }).join(', ')], ['Stand', c.stand], ['Eigentümer', feld('halter') || (c.marke.name || '')]] }));
      rows.forEach(function (row, i) {
        var t = _computeYearTotal(row.cal, i) || {}, v = t.values || {};
        var tab = [], summe = 0;
        WK.forEach(function (g) {
          var s = g[1].reduce(function (a, f) { return a + (Number(v[f[0]]) || 0); }, 0); if (!s) return;
          tab.push([g[0], B.eur(s, 2), { art: 'summe' }]);
          g[1].forEach(function (f) { if (Number(v[f[0]])) tab.push([f[1], B.eur(v[f[0]], 2), { art: 'ein' }]); });
          summe += s;
        });
        tab.push(['Summe Werbungskosten ' + row.cal, B.eur(summe, 2), { art: 'ende' }]);
        var ein = (Number(v.einnahmen_km) || 0) + (Number(v.einnahmen_nk) || 0);
        ges.push([String(row.cal), B.eur(ein, 2), B.eur(summe, 2), B.eurS(ein - summe, 2)]);
        S.push(B.seite(c, 'Jahr ' + row.cal, B.abschnitt('Veranlagungsjahr ' + row.cal, 'Werbungskosten ' + row.cal, o.adresse)
          + '<div class="zwei"><div>' + B.liste(tab) + '</div><div><h3 style="margin-top:0">Einnahmen</h3>' + B.liste([['Kaltmiete', B.eur(v.einnahmen_km, 2)], ['Umlagen', B.eur(v.einnahmen_nk, 2)], ['Einnahmen gesamt', B.eur(ein, 2), { art: 'summe' }]])
          + '<h3>Steuerwirkung</h3>' + B.liste([['Einkünfte aus Vermietung', B.eurS(ein - summe, 2), { art: 'summe' }], ['Steuerwirkung (Erstattung +)', B.eurS(-(row.tax_y || 0), 0), { farbe: 1 }]]) + '</div></div>'));
      });
      S.push(B.seite(c, 'Übersicht', B.abschnitt('Übersicht', 'Alle Jahre im Vergleich') + '<table><thead><tr><th>Jahr</th><th class="r">Einnahmen</th><th class="r">Werbungskosten</th><th class="r">Einkünfte</th></tr></thead><tbody>'
        + ges.map(function (g) { return '<tr><td class="num">' + g[0] + '</td><td class="r num">' + g[1] + '</td><td class="r num">' + g[2] + '</td><td class="r num">' + g[3] + '</td></tr>'; }).join('') + '</tbody></table>'
        + '<p class="det" style="margin-top:3mm">Zuordnung zur Anlage V nach den Zeilen des jeweiligen Veranlagungsjahres. Keine Steuerberatung.</p>'));
      return B.dokument('Werbungskosten · ' + o.adresse, S);
    });
  }

  /* ── 6 · Track Record (Portfolio) ────────────────────────────────── */
  function trackRecord() {
    var B = D();
    return Promise.all([basis('Track Record'), getAllObjectsData()]).then(function (z) {
      var c = z[0], objs = (z[1] || []).filter(function (o) { return o.data && o.data._deal_won; });
      c.zeile = 'Portfolio · ' + objs.length + ' Objekte';
      var sum = function (f) { return objs.reduce(function (a, o) { return a + (Number(f(o)) || 0); }, 0); };
      var kp = sum(function (o) { return o.kpis && o.kpis.kp; }), wfl = sum(function (o) { return parseFloat(String(o.data.wfl || '').replace(',', '.')); });
      var cf = sum(function (o) { return o.kpis && o.kpis.cf_ns_yearly; }), dl = sum(function (o) { return o.kpis && o.kpis.d_total; });
      var S = [];
      S.push(B.deckblatt(c, { bild: null, eyebrow: 'Track Record', titel: (c.marke.company || 'Portfolio'), unter: 'Portfolio-Übersicht und Performance',
        kz: [{ l: 'Objekte', v: B.zahl(objs.length, 0) }, { l: 'Kaufpreise gesamt', v: B.eur(kp) }, { l: 'Wohnfläche', v: B.zahl(wfl, 0) + ' m²' }, { l: 'Cashflow n. St. / Jahr', v: B.eurS(cf), art: 'hi' }],
        meta: [['Darlehen gesamt', B.eur(dl)], ['Stand', c.stand], ['Ø Bruttorendite', B.pct(objs.length ? sum(function (o) { return o.kpis && o.kpis.bmy; }) / objs.length : null, 2)]] }));
      S.push(B.seite(c, 'Objekte', B.abschnitt('Übersicht', 'Objekte im Bestand') + '<table><thead><tr><th>Objekt</th><th>Art</th><th class="r">Fläche</th><th class="r">Kaufpreis</th><th class="r">Bruttorendite</th><th class="r">CF n. St./J.</th><th class="r">DSCR</th></tr></thead><tbody>'
        + objs.map(function (o) { var d = o.data, k = o.kpis || {}; return '<tr><td>' + B.esc([d.str, d.hnr].filter(Boolean).join(' ')) + '<div class="det">' + B.esc([d.plz, d.ort].filter(Boolean).join(' ')) + '</div></td><td>' + B.esc(d.objart || '') + '</td><td class="r num">' + B.zahl(parseFloat(String(d.wfl || '').replace(',', '.')), 0) + ' m²</td><td class="r num">' + B.eur(k.kp) + '</td><td class="r num">' + B.pct(k.bmy, 2) + '</td><td class="r num' + ((k.cf_ns_yearly || 0) >= 0 ? ' pos' : ' neg') + '">' + B.eurS(k.cf_ns_yearly) + '</td><td class="r num">' + B.zahl(k.dscr, 2) + '</td></tr>'; }).join('')
        + '</tbody></table>'));
      objs.forEach(function (o) {
        var d = o.data, k = o.kpis || {}, adr = [[d.str, d.hnr].filter(Boolean).join(' '), [d.plz, d.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        S.push(B.seite(c, adr, '<div class="zwei"><div>' + (d._thumb ? '<img class="karte" src="' + d._thumb + '" alt="" style="height:52mm;object-fit:cover">' : '') + '</div><div>'
          + B.abschnitt(d.objart || '', adr) + '<div class="kv" style="grid-template-columns:1fr">' + [['Kaufdatum', B.datum(d.kaufdat) || '–'], ['Wohnfläche', B.zahl(parseFloat(String(d.wfl || '').replace(',', '.')), 0) + ' m²'], ['Baujahr', B.jahr(d.baujahr)], ['Kaufpreis', B.eur(k.kp)], ['Darlehen', B.eur(k.d_total)]]
            .map(function (x) { return '<div><span>' + x[0] + '</span><span class="num">' + x[1] + '</span></div>'; }).join('') + '</div></div></div>'
          + B.kacheln([{ l: 'Bruttorendite', v: B.pct(k.bmy, 2) }, { l: 'CF n. St. / Monat', v: B.eurS(k.cf_ns_monthly), art: (k.cf_ns_monthly || 0) >= 0 ? 'gut' : 'schlecht' }, { l: 'DSCR', v: B.zahl(k.dscr, 2) }, { l: 'Rate / Monat', v: B.eur(k.rate_total_m) }])
          + (d.thesis ? '<h3>Investmentthese</h3><p>' + B.esc(d.thesis) + '</p>' : '')));
      });
      return B.dokument('Track Record · ' + (c.marke.company || ''), S);
    });
  }

  /* ── 7 · Bankexport (Portfolio, quer) ────────────────────────────── */
  function bankexport() {
    var B = D();
    return Promise.all([basis('Bankexport · alle Darlehen'), getAllObjectsData()]).then(function (z) {
      var c = z[0], objs = (z[1] || []).filter(function (o) { return o.data && o.data._deal_won; });
      var rows = _buildBankExportRows(objs) || [];
      c.zeile = objs.length + ' Objekte · ' + rows.length + ' Darlehen';
      var sumKp = objs.reduce(function (a, o) { return a + (Number(o.kpis && o.kpis.kp) || 0); }, 0);
      var sumRs = rows.reduce(function (a, r) { return a + (Number(r.akt_restschuld) || 0); }, 0), sumDl = rows.reduce(function (a, r) { return a + (Number(r.darl_summe) || 0); }, 0);
      var sumKd = rows.reduce(function (a, r) { return a + (Number(r.kapitaldienst) || 0); }, 0);
      var tab = '<table class="dicht"><thead><tr><th>Nr</th><th>Objekt</th><th>Art</th><th class="r">m²</th><th class="r">NKM €</th><th class="r">€/m²</th><th>Bank</th><th>Darlehen</th><th>Auszahlung</th><th class="r">Betrag</th><th class="r">Zins</th><th class="r">Tilg.</th><th class="r">Rate</th><th class="r">Bindung</th><th class="r">Restschuld heute</th><th>Bindung bis</th><th class="r">Rest bei Ablauf</th></tr></thead><tbody>'
        + rows.map(function (r) {
          return '<tr><td class="num">' + B.esc(r.nr) + '</td><td>' + B.esc([r.strasse, r.hnr].filter(Boolean).join(' ')) + '<div class="det">' + B.esc([r.plz, r.ort].filter(Boolean).join(' ')) + '</div></td><td>' + B.esc(r.bez || '') + '</td>'
            + '<td class="r num">' + B.zahl(r.qm, 0) + '</td><td class="r num">' + B.zahl(r.nkm, 0) + '</td><td class="r num">' + B.zahl(r.eur_qm, 2) + '</td><td>' + B.esc(r.bank || '') + '</td><td>' + B.esc(r.art || '') + '<div class="det">' + B.esc(r.vertragsnr || '') + '</div></td><td class="num">' + B.esc(r.fin_datum || '') + '</td>'
            + '<td class="r num">' + B.zahl(r.darl_summe, 0) + '</td><td class="r num">' + B.zahl((r.zins || 0) * 100, 2) + ' %</td><td class="r num">' + B.zahl((r.tilgung || 0) * 100, 2) + ' %</td><td class="r num">' + B.zahl(r.kapitaldienst, 2) + '</td><td class="r num">' + B.zahl(r.zinsbindung, 0) + ' J.</td>'
            + '<td class="r num">' + B.zahl(r.akt_restschuld, 0) + '</td><td class="num">' + B.esc(r.laufzeit || '') + '</td><td class="r num">' + B.zahl(r.restschuld_ende, 0) + '</td></tr>';
        }).join('') + '<tr class="ende"><td></td><td>Summe</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="r num">' + B.zahl(sumDl, 0) + '</td><td></td><td></td><td class="r num">' + B.zahl(sumKd, 2) + '</td><td></td><td class="r num">' + B.zahl(sumRs, 0) + '</td><td></td><td></td></tr></tbody></table>';
      var S = [B.seite(c, 'Darlehensübersicht', B.abschnitt('Bankexport', 'Alle Darlehen im Bestand', 'Stand ' + c.stand + ' · Beträge in Euro, Raten je Monat.')
        + B.kacheln([{ l: 'Objekte', v: B.zahl(objs.length, 0) }, { l: 'Darlehen', v: B.zahl(rows.length, 0) }, { l: 'Kaufpreise gesamt', v: B.eur(sumKp) }, { l: 'Restschuld heute', v: B.eur(sumRs), art: 'hi' }]) + tab, { quer: true })];
      return B.dokument('Bankexport · ' + (c.marke.company || ''), S, { quer: true });
    });
  }

  /* ── Einstieg ────────────────────────────────────────────────────── */
  var TYPEN = {
    investment: function () { return investment('voll'); }, bank: function () { return investment('bank'); }, kurz: function () { return investment('kurz'); },
    kaufpreisaufteilung: kaufpreisaufteilung, finanzamt: function () { return finanzamt(3); }, trackrecord: trackRecord, bankexport: bankexport
  };
  function dokument(typ) {
    if (!TYPEN[typ]) return Promise.reject(new Error('Unbekanntes Dokument: ' + typ));
    try { if (typeof window.calcNow === 'function' && /investment|bank|kurz|finanzamt|kaufpreis/.test(typ)) window.calcNow(); } catch (e) {}
    return TYPEN[typ]();
  }
  window.DpDokumente = {
    VERSION: 'v3179', TYPEN: Object.keys(TYPEN), dokument: dokument,
    oeffnen: function (typ) { return dokument(typ).then(function (h) { D().vorschau(h, typ); }); }
  };
})();
