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
  /* v3986 · F14: dieselbe Entscheidung wie Reiter Steuer und BMF-Rechner (tax.js _dpAnschaffungsnah, v3704): Grenze, Fenster, Wahl */
  function _sanUnterGrenze() { try { var A = typeof window._dpAnschaffungsnah === 'function' ? window._dpAnschaffungsnah() : null; return !!(A && A.san > 0 && !A.an); } catch (e) { return false; } }
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
  /* v3480 · ein Fehler, der dem Nutzer etwas sagt (kein Objekt, kein Steuersatz): die Weiche zeigt ihn als
     Hinweis, statt still auf den PDF-Dienst und die Vorschau auszuweichen (die denselben Fehler nur wiederholen) */
  function nutzerFehler(t) { var e = new Error(t); e.dpNutzer = true; return e; }
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
        /* v3336 · die OSM-Lagekarte mit Punkt und Namensnennung (lagekarte.js, Kacheln aus der eigenen
           Ablage, 0 EUR). Deckblatt 210 x 118 mm.
           v3337 · Marcel 12.11.2026: der Rueckfall auf die Kartenkachel des Marktberichts (/marktbericht/static-map,
           Geoapify, ohne Namensnennung im Bild) ist gestrichen. Faellt die Lagekarte aus, bleibt das Deckblatt
           ohne Kartenbild - wie vor v3336 ohne Foto. */
        var osm = window.DpLagekarte ? DpLagekarte.bild(g && g.lat, g && g.lon, { breite: 760, hoehe: 427 }) : Promise.resolve(null);
        return osm.then(function (lk) { if (lk) info.karte = lk.src; return info; });
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
    /* v3215 · W-17: weitere Darlehen (Kern DpDarlehenWeitere, Liste aus dem Feld) */
    if (window.DpDarlehenWeitere) DpDarlehenWeitere.lesen(feld('darlehen_weitere')).forEach(function (e, i) {
      l.push({ name: DpDarlehenWeitere.name(e, i), betrag: e.betrag, zins: e.zins, tilg: e.tilg, bind: e.bindj });
    });
    l.forEach(function (x) { if (x.zins != null && x.tilg != null) x.rate = x.betrag * (x.zins + x.tilg) / 100 / 12; });
    return l;
  }

  /* ── gemeinsame Seitenstuecke der Investment-Familie ─────────────── */
  function dreiPhasen(K, B) {
    var sp = function (k, t, cls, w) {
      return '<div class="phase ' + cls + '"><h4>' + t + '</h4><table><tbody>'
        + [['Kaltmiete / Jahr', B.eur(w.nkm)], ['− Bewirtschaftung', B.eur(w.bwk)], ['− Zinsen', B.eur(w.zins)], ['− Tilgung', B.eur(w.tilg)],
          ['= CF v. St.', B.eurS(w.cfop)], ['± Steuern', B.eurS(w.st)], ['= CF n. St.', B.eurS(w.cfns)], ['= je Monat', B.eurS(w.cfns / 12)]]
          .map(function (z, i) { return '<tr' + (i >= 4 && i !== 5 ? ' class="summe"' : '') + '><td>' + z[0] + '</td><td class="r num">' + z[1] + '</td></tr>'; }).join('')
        + '</tbody></table></div>';
    };
    return '<div class="drei3">'
      + sp(1, 'Jahr 1', 'p1', { nkm: K.nkm_j, bwk: K.bwk_cf, zins: K.zins_j, tilg: K.tilg_j, cfop: K.cf_op, st: (K.cf_ns || 0) - (K.cf_op || 0), cfns: K.cf_ns })
      + sp(2, 'Ende Zinsbindung', 'p2', { nkm: K.nkm_ezb, bwk: K.bwk_cf_ezb, zins: K.zins_ezb, tilg: K.tilg_ezb, cfop: K.cf_op_ezb, st: (K.cf_ns_ezb || 0) - (K.cf_op_ezb || 0), cfns: K.cf_ns_ezb })
      + sp(3, 'Anschluss', 'p3', { nkm: K.nkm_an, bwk: K.bwk_cf_an, zins: K.zins_an, tilg: K.tilg_an, cfop: K.cf_op_an, st: (K.cf_ns_an || 0) - (K.cf_op_an || 0), cfns: K.cf_ns_an })
      + '</div>';
  }
  /* ── 1 · Investment-PDF, Bankfassung, Kurzfassung ────────────────────
     v3180 · Marcel 04.11.2026: „du hast keinen bericht also die bankfassung des investment pdf die
     mal 18-24 seiten ist und auch mit zielbild etc. … auch Stressmatix und so fehlen." Die Demo v3179
     hatte sieben Seiten. Jetzt dieselben Abschnitte wie pdf-investment-bank.js (jsPDF), aus denselben
     Quellen: State.kpis/cfRows/_vz/phaseTable, Zellen der Zinsaenderung (zaer-*), DpMfhEinheiten,
     DpPotenzial.pdfDaten, DpPdfWertZielbild.daten, BankCharts (Cockpit, Stress-Matrix), _aiAnalysis.
     Gerechnet wird hier nichts, nur gesetzt. */
  function St() { return window.State || {}; }
  function da(v) { return (v === null || v === undefined || v === '' || !isFinite(Number(v))) ? null : Number(v); }
  function zellText(id) { var e = document.getElementById(id); var t = e ? String(e.textContent || '').replace(/\s+/g, ' ').trim() : ''; return (t && t !== '-' && t !== '–') ? t : null; }
  function klar(t) { var s = String(t == null ? '' : t); try { if (typeof window._dpOhnePortal === 'function') s = window._dpOhnePortal(s); } catch (e) {} return s.replace(/\*+/g, '').trim(); }
  /** Tabelle mit Kopf: kopf [Text…], zeilen [{w:[…], art}] - erste Spalte links, Rest rechts */
  function tab(B, kopf, zeilen, cls) {
    return '<table' + (cls ? ' class="' + cls + '"' : '') + '><thead><tr>' + kopf.map(function (h, i) { return '<th' + (i ? ' class="r"' : '') + '>' + B.esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + zeilen.filter(Boolean).map(function (z) {
        var w = z.w || z;
        return '<tr class="' + (z.art || '') + '">' + w.map(function (x, i) { return i ? '<td class="r num">' + B.esc(x == null ? '–' : x) + '</td>' : '<td>' + B.esc(x) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  /* v4860 · Ohne gewählte Herkunft nannte das Dokument die Wertangabe „Marktwert (eigene Schätzung)“. Bei Hauptstr. 51 (Staging)
     ist es der Wert aus dem Marktbericht, nur ohne Herkunftsangabe. Eine Schätzung zu behaupten, die niemand gemacht hat,
     ist falsch (Marcel 24.11.2026). Ohne Herkunft heißt sie deshalb neutral „Wertangabe im Reiter Objekt, Herkunft nicht angegeben“. */
  function svwText(t) {
    if (!t) return t;
    var hk = document.getElementById('svw_herkunft');
    return (!hk || !hk.value) ? String(t).replace(/Marktwert \(eigene Schätzung\)/,'Wertangabe im Reiter Objekt (Herkunft nicht angegeben)') : t;
  }
  function scoreDaten(K) {
    var SC = null, SCK = null;
    try { if (window.DealScore && typeof DealScore.computeFromKpis === 'function') SC = DealScore.computeFromKpis(K); } catch (e) {}
    try { SCK = window._dpPdfScore ? _dpPdfScore(K) : null; } catch (e) {}
    /* wie pdf-investment-bank.js v2992: die ZAHL ist der Score der Objektkarte; die Deutung nur, wenn derselbe Score sie liefert */
    if (SCK && SC && SCK.quelle !== 'kennzahlen') SC = { score: SCK.score, label: SCK.label, investor: true, inv: SCK.inv, fin: SCK.fin };   /* v4800 */
    else if (SCK && !SC) SC = { score: SCK.score, label: SCK.label };
    return SC || {};
  }
  function kennzahlen12(K, B, SC) {
    var S = St(), rows = S.cfRows || [];
    return B.kacheln([
      { l: 'Bruttomietrendite', v: B.pct(K.bmy, 2), s: 'auf Kaufpreis' },
      { l: 'Nettomietrendite', v: B.pct(K.nmy, 2), s: 'auf Gesamtinvestition' },
      { l: 'Kaufpreisfaktor', v: B.zahl(K.fak, 1) + '-fach' },
      { l: 'Cashflow v. St.', v: B.eurS(K.cf_m), s: 'je Monat', art: (K.cf_m || 0) >= 0 ? 'gut' : 'schlecht' },
      { l: 'DSCR', v: B.zahl(K.dscr, 2), s: 'Schuldendienstdeckung', art: K.dscr >= 1.2 ? 'gut' : 'schlecht' },
      { l: 'LTV', v: B.pct(K.ltv, 1), s: S.ltv_basis_label ? 'auf ' + S.ltv_basis_label : '' },
      (K.ekr4 && K.ekr4.haupt != null   /* v4610 · Hauptkennzahl, Stufen 1 bis 3 in der Unterzeile */
        ? { l: 'EK-Rendite', v: B.pct(K.ekr4.haupt, 1), s: 'nach Steuer mit Vermögensdelta · operativ ' + B.pct(K.ekr4.k1, 1) + ', nach Steuer ' + B.pct(K.ekr4.k2, 1) + (K.ekr4.hebel ? ' · Hebel ' + K.ekr4.hebel.richtung + (K.ekr4.hebel.wert_minus2 != null ? ', bei 2 % Wertverlust im Jahr ' + B.pct(K.ekr4.hebel.wert_minus2, 1) : '') : '') + ', vor Steuer mit Delta ' + B.pct(K.ekr4.k3, 1) }
        : { l: 'EK-Rendite', v: B.pct(K.ekr, 2), s: 'p. a. vor Steuern' }),
      { l: 'Interner Zinsfuß', v: da(K.irr) === null ? 'n. b.' : B.pct(K.irr, 2), s: 'IRR' },
      { l: 'Kaltmiete', v: B.eur(da(K.nkm_j) !== null ? K.nkm_j : (rows[1] && rows[1].nkm_y)), s: 'p. a. inkl. Zusatzeinnahmen' },
      { l: 'Equity Multiple', v: da(K.em) === null ? '–' : B.zahl(K.em, 1) + 'x', s: 'über die Haltedauer' },
      svwVeraltet() ? { l: 'Wertpuffer', v: B.eurS(Number(St().wert_anker.wert) - (K.kp || 0)), s: 'Objektwert gegenüber Kaufpreis' } : { l: 'Wertpuffer', v: B.eurS(K.wp_kpi), s: 'gegenüber Kaufpreis' },   /* v4380 */
      scKachel(B, SC)
    ]);
  }
  /* v4800 · Marcel 25.11.2026: Investor Deal Score immer mit seinen zwei Scores, dann kein zweiter Deal Score daneben */
  function scTeile(SC) { return (SC && SC.investor && SC.inv != null && SC.fin != null) ? 'Investment ' + SC.inv + ' · Finanzierung ' + SC.fin : ''; }
  /* v4860a · Wort am Investor Deal Score wie in der App: die Stufe (69 → Solide), nicht die Profil-Empfehlung („Verhandeln“) */
  function igWort(IG) { try { if (window.ScoreTier && IG && IG.score != null) return ScoreTier.stufe(IG.score).wort; } catch (e) {} return (IG && ((IG.empfehlung && IG.empfehlung.text) || IG.stufe)) || ''; }
  function scKachel(B, SC) {
    return SC.investor ? { l: 'Investor Deal Score', v: SC.score ? B.zahl(SC.score, 0) + ' / 100' : '–', s: [SC.label, scTeile(SC)].filter(Boolean).join(' · '), art: 'hi' }
      : { l: 'Deal Score', v: SC.score ? B.zahl(SC.score, 0) + ' / 100' : '–', s: SC.label || '', art: 'hi' };
  }
  function ansprechpartner(c, B) {
    var b = c.marke || {}, z = [];
    if (b.company) z.push(['Unternehmen', b.company]);
    if (b.name && b.name !== b.company) z.push([b.role || 'Ansprechpartner', b.name]);
    var a = [String(b.address || '').trim(), ((b.plz || '') + ' ' + (b.city || '')).trim()].filter(Boolean).join(', ');
    if (a) z.push(['Anschrift', a]);
    if (b.phone) z.push(['Telefon', b.phone]);
    if (b.email) z.push(['E-Mail', b.email]);
    if (b.website) z.push(['Web', String(b.website).replace(/^https?:\/\//, '')]);
    if (!z.length) return '';
    return '<div class="block"><h3>Ansprechpartner</h3><div class="kv">' + z.map(function (x) { return '<div><span>' + B.esc(x[0]) + '</span><span>' + B.esc(x[1]) + '</span></div>'; }).join('') + '</div></div>';
  }
  /* v4380 · Regel (Marcel 24.11.2026): Wertangaben im PDF nur aus dem letzten Bericht und mit demselben maßgebenden Wert wie
     die App (State.wert_anker). Eine im Reiter Objekt aus einem Marktbericht übernommene Wertangabe (svw_herkunft marktbericht
     oder indikation), die vom maßgebenden Wert abweicht, ist veraltet und erscheint nicht. Gemessen Demostraße 5: Feld 111.000 €
     (früher übernommener vorläufiger Ertragswert), maßgebend 130.000 €; das PDF nannte 111.000 und einen Wertpuffer von −34.000 €. */
  function svwVeraltet() {
    var S = St(), svw = zahlAus('svwert');
    if (!svw || !/^(marktbericht|indikation)$/.test(S.svw_herkunft || '')) return false;
    return !!(S.wert_anker && S.wert_anker.wert && Math.abs(Number(S.wert_anker.wert) - svw) > 1);
  }
  /* v4580 · der maßgebende Objektwert, mit dem die App rechnet (calc.js wert_basis / wert_anker), mit Verfahren und Stichtag. null, wenn
     ein Gutachten oder eine Bankbewertung aus dem Reiter Objekt führt (dann steht die Formularangabe mit ihrem Namen) oder nur der Kaufpreis. */
  var ANKER_NAME = { aufteiler: 'Vergleichswert je Wohnung', ertragswert: 'Ertragswert', sachwert: 'Sachwert', vergleichswert: 'Vergleichswert',
    vergleichswert_m: 'Vergleichswert (indikativ, aus Angebotspreisen)', mpi_mit: 'Marktpreisindikation nach Abschlag', mpi_ohne: 'Marktpreisindikation ohne Abschlag' };
  function massgebend(B) {
    var S = St(), A = S.wert_anker;
    if (S.wert_basis_quelle !== 'marktbericht' || !A || !(Number(A.wert) > 0)) return null;
    var st = A.datum ? new Date(A.datum) : null, stT = st && !isNaN(st) ? st.toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' }) : '';
    var fuehrt = /^(aufteiler|ertragswert|sachwert|vergleichswert|vergleichswert_m)$/.test(A.art);
    return { wert: Number(A.wert), art: A.art, name: ANKER_NAME[A.art] || 'Objektwert',
      titel: 'Objektwert · ' + (ANKER_NAME[A.art] || 'Marktbericht') + (fuehrt ? ', führend' : ''),
      det: (A.art === 'aufteiler' ? 'Summe der Wohnungen nach Aufteilungskosten · ' : '') + 'DealPilot-Marktbericht' + (stT ? ', Stichtag ' + stT : '') };
  }
  function finanzierungVoll(K, B, kurz) {
    var S = St(), kp = K.kp || zahlAus('kp') || 0, nk = nebenkosten(kp), nkSum = nk.reduce(function (a, x) { return a + x.eur; }, 0);
    var moebl = zahlAus('moebl'), san = zahlAus('san');
    var inv = [['Kaufpreis', B.eur(kp)]];
    if (moebl && !kurz) inv.push(['davon Möblierung / Inventar', B.eur(moebl), { art: 'ein' }]);
    if (!kurz) nk.forEach(function (x) { inv.push([x.name + ' (' + B.zahl(x.pct, 2) + ' %)', B.eur(x.eur), { art: 'ein' }]); });
    inv.push(['Erwerbsnebenkosten (' + B.zahl(kp ? nkSum / kp * 100 : 0, 1) + ' % vom Kaufpreis)', B.eur(nkSum), { art: 'summe' }]);
    if (san) inv.push(['Sanierung / Modernisierung', B.eur(san)]);
    inv.push(['Gesamtinvestition', B.eur(K.gi), { art: 'ende' }]);
    var aus = feld('d1_type') === 'tilgungsaussetzung', d1 = zahlAus('d1');
    var d2an = feld('d2_enable') === true, d2 = d2an ? zahlAus('d2') : null; if (d2an && !(d2 > 0)) { d2an = false; d2 = null; }
    var fin = [['Eigenkapital', B.eur(K.ek), { det: B.zahl(K.gi ? K.ek / K.gi * 100 : 0, 1) + ' % der Gesamtinvestition' }],
      ['Darlehen I · ' + (aus ? 'Tilgungsaussetzung' : 'Annuitätendarlehen'), B.eur(d1)],
      ['Sollzins · Tilgung · Bindung', B.pct(zahlAus('d1z'), 2) + ' · ' + (aus ? 'Bausparvertrag' : B.pct(zahlAus('d1t'), 2)) + ' · ' + (zahlAus('d1_bindj') != null ? B.zahl(zahlAus('d1_bindj'), 0) + ' J.' : '–'), { art: 'ein' }]];
    if (da(S.d1_rate_monthly)) fin.push(['Rate Darlehen I / Monat', B.eur(S.d1_rate_monthly, 2), { art: 'ein' }]);
    var r2 = 0;
    if (d2an) {
      r2 = d2 * ((zahlAus('d2z') || 0) + (zahlAus('d2t') || 0)) / 100 / 12;
      fin.push(['Darlehen II', B.eur(d2)], ['Sollzins · Tilgung', B.pct(zahlAus('d2z'), 2) + ' · ' + B.pct(zahlAus('d2t'), 2), { art: 'ein' }], ['Rate Darlehen II / Monat', B.eur(r2, 2), { art: 'ein' }]);
    }
    /* v3215 · W-17: weitere Darlehen aus dem Rechenlauf (State, Kern DpDarlehenWeitere) */
    var _W = window.DpDarlehenWeitere, _dwL = _W ? (S.dw_liste || []) : [], _dwSum = S.dw_summe || 0, _dwZj = (S.dw_zm || 0) * 12;
    /* v3223 · Marcel 08.11.2026 „passen die Seitenumbrüche?“: mit drei weiteren Darlehen (je drei Zeilen) wurde
       der Block zu hoch, rutschte ganz auf die nächste Seite (die davor blieb fast leer) und lief rechts über
       den Rand (lange Werte ohne Umbruch). Jetzt EINE Zeile je Darlehen, Konditionen als Unterzeile. */
    _dwL.forEach(function (e, i) {
      var ab = _W.abKauf(e, S.dw_basisjahr);
      var kond = 'Zins ' + B.pct(e.zins, 2) + ' · ' + (e.art === 'tilgungsaussetzung' ? 'ohne Tilgung' : 'Tilgung ' + B.pct(e.tilg, 2))
        + (e.bindj ? ' · Bindung ' + B.zahl(e.bindj, 0) + ' J.' : '') + ' · Rate ' + B.eur(_W.rateM(e), 2) + ' / Monat' + (ab ? '' : ' · ab ' + e.start_jahr + ', nicht in der Summe bei Kauf');
      fin.push([_W.name(e, i) + (ab ? '' : ' (ab ' + e.start_jahr + ')'), B.eur(e.betrag), { det: kond }]);
    });
    if (d2an || _dwSum > 0) {
      var _dS = (d1 || 0) + (d2 || 0) + _dwSum;
      if (_dS > 0) fin.push(['Mischzins (gewichtet)', B.pct(((d1 || 0) * (zahlAus('d1z') || 0) + (d2 || 0) * (zahlAus('d2z') || 0) + _dwZj * 100) / _dS, 2), { art: 'ein' }]);
      fin.push(['Gesamtrate / Monat', B.eur((S.d1_rate_monthly || 0) + r2 + (S.dw_rate_m || 0), 2), { art: 'ein' }]);
    }
    fin.push(['Finanzierung gesamt', B.eur((d1 || 0) + (d2 || 0) + _dwSum), { art: 'summe' }]);
    fin.push(['Beleihungsauslauf (LTV)', B.pct(K.ltv, 1), { det: S.ltv_basis_label ? 'auf ' + S.ltv_basis_label : '' }]);
    var bis = zellText('r-bindend'); if (bis) fin.push(['Zinsbindung bis', bis]);
    fin.push(['Restschuld am Ende der Zinsbindung', B.eur(S.rs)]);
    fin.push(['Finanzierungsstruktur', (aus ? (d2an ? 'Tilgungsaussetzung + Bausparvertrag + Zusatzdarlehen' : 'Tilgungsaussetzung mit Bausparvertrag') : (d2an ? 'Annuitätendarlehen + Zusatzdarlehen' : 'Annuitätendarlehen')) + (_dwL.length ? ' + ' + _dwL.length + (_dwL.length === 1 ? ' weiteres Darlehen' : ' weitere Darlehen') : ''), { umbruch: 1 }]);   /* v3215; v3223 Umbruch */
    /* v4580 · Marcel 24.11.2026 (Westerfeldstr. 146, Seite 3): „Marktwert, eigene Schätzung … ich habe keine Schätzung gemacht“. Das Feld
       im Reiter Objekt trug 567.000 € ohne Herkunft (Demodaten), gerechnet wurde längst mit dem maßgebenden Wert des Marktberichts.
       Jetzt steht hier der Wert, mit dem gerechnet wird, mit seinem Verfahren. Die Formularangabe nur, wenn sie selbst führt. */
    var _mw = massgebend(B), svw = svwVeraltet() ? null : zahlAus('svwert');   /* v4380 */
    if (_mw) {
      fin.push([_mw.titel, B.eur(_mw.wert), { det: _mw.det }]);
      if (da(K.wp_kpi)) fin.push(['Sofortiger Wertpuffer gegenüber dem Kaufpreis', B.eurS(K.wp_kpi), { art: 'ende', farbe: 1 }]);
    } else if (svw) {
      fin.push([svwText(S.svw_label) || 'Wertangabe (Reiter Objekt)', B.eur(svw)]);
      if (da(K.wp_kpi)) fin.push(['Sofortiger Wertpuffer gegenüber dem Kaufpreis', B.eurS(K.wp_kpi), { art: 'ende', farbe: 1 }]);
    }
    /* v3223: wird die Finanzierung trotzdem länger als der Rest der Seite, darf sie umbrechen statt ganz zu springen */
    /* v3223a: mit weiteren Darlehen untereinander in voller Breite - nebeneinander brach die Unterzeile in der
       schmalen Spalte mehrfach um, der Block wurde hoeher als der Rest der Seite und sprang ganz auf die naechste */
    var h = _dwL.length
      ? '<div class="block"><h3>Investition</h3>' + B.liste(inv) + '</div><div style="break-inside:auto;margin-top:4mm"><h3>Finanzierung</h3>' + B.liste(fin) + '</div>'
      : '<div class="zwei"><div class="block"><h3>Investition</h3>' + B.liste(inv) + '</div><div class="block"><h3>Finanzierung</h3>' + B.liste(fin) + '</div></div>';
    if (aus) {
      var bs = S.bsvSummary || {}, bz = [];
      if (feld('bspar_inst')) bz.push(['Bausparkasse', feld('bspar_inst')]);
      if (feld('bspar_vertrag')) bz.push(['Vertragsnummer', feld('bspar_vertrag')]);
      bz.push(['Bausparsumme', B.eur(zahlAus('bspar_sum'))], ['Sparrate / Monat', B.eur(zahlAus('bspar_rate'), 2)], ['Sparrate / Jahr (aus dem Cashflow)', B.eur((zahlAus('bspar_rate') || 0) * 12)]);
      if (zahlAus('bspar_zins') != null) bz.push(['Guthabenzins', B.pct(zahlAus('bspar_zins'), 2)]);
      var zut = zellText('bspar_zuteil_detail') || zellText('bspar_zuteil_auto'); if (zut) bz.push(['Zuteilung', zut]);
      var zst = zellText('bspar_zuteil_status'); if (zst) bz.push(['Zuteilungsstatus', zst, { art: 'ein' }]);
      if (zahlAus('bspar_dar_z') != null) bz.push(['Bauspardarlehen · Zins', B.pct(zahlAus('bspar_dar_z'), 2)]);
      if (zahlAus('bspar_dar_t') != null) bz.push(['Bauspardarlehen · Tilgung', B.pct(zahlAus('bspar_dar_t'), 2)]);
      var drt = zellText('bspar_dar_rate'); if (drt) bz.push(['Bauspardarlehen · Rate', drt]);
      if (da(bs.eingezahlt) !== null) bz.push(['Eingezahlt bis Ende der Zinsbindung', B.eur(bs.eingezahlt)]);
      if (da(bs.guthaben) !== null) bz.push(['Guthaben inkl. Zinsen bei Bindungsende', B.eur(bs.guthaben)]);
      if (da(bs.restschuld) !== null) bz.push(['Restschuld Hauptdarlehen dann', B.eur(bs.restschuld)]);
      if (da(bs.restschuld) && bs.restschuld > 0) bz.push(['Deckung durch Bausparguthaben und -darlehen', B.pct(Math.min(100, ((bs.guthaben || 0) + (bs.bauspardarlehen || 0)) / bs.restschuld * 100), 1), { art: 'ende' }]);
      h += '<div class="block"><h3>Bausparvertrag (Tilgungsersatz)</h3>' + B.liste(bz) + '</div>';
    }
    return h;
  }
  function gesellschaft(B) {
    var halter = String(feld('halter') || '');
    if (!halter || halter === 'privat') return '';
    var M = window.DealPilotMandanten || {}, name = halter, korp = false, satz = null;
    try { var hh = M.get ? M.get(halter) : null; if (hh && hh.name) name = hh.name; } catch (e) {}
    try { korp = !!(M.isCorp && M.isCorp(halter)); } catch (e) {}
    try { satz = M.effRate && M.effRate(); } catch (e) {}
    var z = [['Halter des Objekts', name], ['Besteuerung', korp ? 'Körperschaft- und Gewerbesteuer' : 'Einkommensteuer der Gesellschafter']];
    if (satz != null && isFinite(satz)) z.push(['Angesetzter effektiver Steuersatz', B.pct(satz * 100, 2)]);
    if (korp) z.push(['Verluste', 'mindern nur künftige Gewinne', { art: 'ein' }]);
    if (zahlAus('verkehrswert_ueberf') != null) z.push(['Verkehrswert (AfA-Basis der Gesellschaft)', B.eur(zahlAus('verkehrswert_ueberf'))]);
    if (zahlAus('ueberf_preis') != null) z.push(['Überführungspreis (Basis Grunderwerbsteuer)', B.eur(zahlAus('ueberf_preis'))]);
    if (zahlAus('ueberf_restschuld') != null) z.push(['Übernommene Restschuld', B.eur(zahlAus('ueberf_restschuld'))]);
    if (zahlAus('gesellschafterdarlehen') != null) z.push(['Gesellschafterdarlehen', B.eur(zahlAus('gesellschafterdarlehen'))]);
    return '<div class="block"><h3>Erwerb über eine Gesellschaft</h3>' + B.liste(z) + '</div>';
  }
  /* Kette wie pdf-investment-bank.js: Steuer als Differenz der Cashflows (v2461), Bausparrate (v3029) */
  function ertragKette(K, B) {
    var st = (da(K.cf_op) === null || da(K.cf_ns) === null) ? null : K.cf_ns - K.cf_op;
    return B.liste([
      ['Warmmiete / Jahr (NKM + NK-Vorauszahlungen)', B.eur(K.warm_j)],
      ['abzüglich NK-Vorauszahlungen der Mieter', B.eurS(-(K.nk_vz_j || 0)), { art: 'ein' }],
      ['Nettokaltmiete / Jahr', B.eur(K.nkm_netto_j)],
      (K.ze_j || 0) > 0 ? ['zuzüglich Zusatzeinnahmen (Stellplatz, Garage)', B.eurS(K.ze_j), { art: 'ein' }] : null,
      ['Kaltmiete inkl. Zusatzeinnahmen / Jahr', B.eur(K.nkm_j), { art: 'summe' }],
      ['abzüglich nicht umlagefähiger Bewirtschaftung', B.eurS(-(K.bwk_cf || 0)), { art: 'ein' }],
      ['Betriebsergebnis (NOI)', B.eur(da(K.nkm_j) === null ? null : K.nkm_j - (K.bwk_cf || 0)), { art: 'summe' }],
      ['abzüglich Zinsen', B.eurS(-(K.zins_j || 0)), { art: 'ein' }],
      (K.bspar_j || 0) > 0 ? ['abzüglich Bausparrate', B.eurS(-K.bspar_j), { art: 'ein' }] : null,
      ['abzüglich Tilgung', B.eurS(-(K.tilg_j || 0)), { art: 'ein' }],
      ['Cashflow vor Steuern / Jahr', B.eurS(K.cf_op), { art: 'summe', farbe: 1 }],
      ['Steuern (Belastung −, Erstattung +)', B.eurS(st), { art: 'ein', farbe: 1 }],
      ['Cashflow nach Steuern / Jahr', B.eurS(K.cf_ns), { art: 'ende', farbe: 1 }],
      ['Cashflow nach Steuern / Monat', B.eurS(da(K.cf_ns) === null ? null : K.cf_ns / 12, 2), { farbe: 1 }]
    ]);
  }
  function bewirtschaftungDetail(K, B) {
    var hk = {}; try { var e = document.getElementById('_dp_herkunft'); if (e && e.value) hk = JSON.parse(e.value) || {}; } catch (x) {}
    var gs = [];
    var lbl = function (id, t) { var h = hk[id]; if (h && /geschätzt|geschaetzt|angesetzt|pauschal|Einstellungen|angenommen/i.test(String(h))) { gs.push(t); return t + ' (geschätzt)'; } return t; };
    var z = [[lbl('hg_ul', 'Hausgeld umlagefähig / Jahr'), B.eur(zahlAus('hg_ul'))], [lbl('grundsteuer', 'Grundsteuer / Jahr'), B.eur(zahlAus('grundsteuer'))]];
    if (zahlAus('ul_sonst')) z.push([lbl('ul_sonst', 'Sonstiges umlagefähig'), B.eur(zahlAus('ul_sonst'))]);
    z.push(['Summe umlagefähig (durchlaufend)', B.eur(K.bwk_ul), { art: 'summe' }]);
    z.push([lbl('hg_nul', 'Hausgeld nicht umlagefähig / Jahr'), B.eur(zahlAus('hg_nul'))]);
    if (zahlAus('weg_r')) z.push(['WEG-Rücklage / Jahr (nachrichtlich)', B.eur(zahlAus('weg_r')), { art: 'ein' }]);
    if (zahlAus('eigen_r')) z.push([lbl('eigen_r', 'Eigene Instandhaltungsrücklage'), B.eur(zahlAus('eigen_r'))]);
    if (zahlAus('mietausfall')) z.push([lbl('mietausfall', 'Kalkulatorischer Mietausfall'), B.eur(zahlAus('mietausfall'))]);
    if (zahlAus('nul_sonst')) z.push([lbl('nul_sonst', 'Sonderverwaltung'), B.eur(zahlAus('nul_sonst'))]);
    z.push(['Summe nicht umlagefähig (im Cashflow)', B.eur(K.bwk_cf), { art: 'summe' }]);
    z.push(['Bewirtschaftungskosten gesamt / Jahr', B.eur(K.bwk)]);
    z.push(['davon Anteil an der Kaltmiete', B.pct(K.nkm_j ? K.bwk / K.nkm_j * 100 : null, 1), { art: 'ein' }]);
    return '<div class="block"><h3>Bewirtschaftung</h3>' + B.liste(z)
      + (gs.length ? '<p class="det" style="margin-top:2mm">Die mit „geschätzt“ bezeichneten Posten hat DealPilot angesetzt, weil dazu keine Angabe vorlag – als Anteil der Jahresmiete nach den hinterlegten Standardwerten. Das kalkulatorische Mietausfallwagnis wird immer angesetzt. Alle übrigen Zahlen sind vorgelegte Werte.</p>' : '') + '</div>';
  }
  function steuerWirkung(K, B) {
    return '<div class="block"><h3>Steuerliche Wirkung</h3>' + B.liste([['Abschreibung (AfA) / Jahr', B.eur(K.afa)], ['Zu versteuerndes Ergebnis', B.eurS(K.zve_immo)],
      ['Persönlicher Grenzsteuersatz', B.pct(zahlAus('grenz'), 2)]]) + '</div>';
  }
  function phasenVoll(K, B) {
    K = (typeof window._dpKpisHeute === 'function') ? window._dpKpisHeute(K) : K;   /* v3314a · N157: Spalte heute = Steuerjahr */
    var S = St(), j1 = typeof window._dpPdfJahr1 === 'function' ? window._dpPdfJahr1(false) : 'Jahr 1', bindj = zahlAus('d1_bindj');
    var kopf = ['', j1, 'Ende Zinsbindung', 'Anschluss'];
    var stD = function (v, n) { return (da(v) === null || da(n) === null) ? null : B.eurS(n - v); };
    var bsv = (K.bspar_j || 0) > 0.5 || (K.bspar_ezb || 0) > 0.5 || (K.bspar_an || 0) > 0.5;
    var h = '<div class="block"><h3>Cashflow je Phase</h3><p class="sub">' + B.esc(j1 + ' · Ende der Zinsbindung' + (bindj ? ' (nach ' + B.zahl(bindj, 0) + ' Jahren)' : '') + ' · Anschlussfinanzierung mit dem angenommenen Zins.') + '</p>'
      + tab(B, kopf, [
        { w: ['Kaltmiete / Jahr', B.eur(K.nkm_j), B.eur(K.nkm_ezb), B.eur(K.nkm_an)] },
        { w: ['Bewirtschaftung (nicht umlagef.)', B.eur(K.bwk_cf), B.eur(K.bwk_cf_ezb), B.eur(K.bwk_cf_an)] },
        { w: ['Zinsen', B.eur(K.zins_j), B.eur(K.zins_ezb), B.eur(K.zins_an)] },
        { w: ['Tilgung', B.eur(K.tilg_j), B.eur(K.tilg_ezb), B.eur(K.tilg_an)] },
        bsv ? { w: ['Bausparrate', B.eur(K.bspar_j || 0), B.eur(K.bspar_ezb || 0), B.eur(K.bspar_an || 0)] } : null,
        { w: ['Cashflow vor Steuern', B.eurS(K.cf_op), B.eurS(K.cf_op_ezb), B.eurS(K.cf_op_an)], art: 'summe' },
        { w: ['Steuern (Belastung −, Erstattung +)' + (K.steuerjahr ? ' · ' + K.steuerjahr_text.replace('Steuerwirkung ', 'heute: ') : ''), stD(K.cf_op, K.cf_ns)   /* v3314 · N157 */, stD(K.cf_op_ezb, K.cf_ns_ezb), stD(K.cf_op_an, K.cf_ns_an)] },
        { w: ['Cashflow nach Steuern', B.eurS(K.cf_ns), B.eurS(K.cf_ns_ezb), B.eurS(K.cf_ns_an)], art: 'summe' },
        { w: ['Cashflow nach Steuern / Monat', B.eurS((K.cf_ns || 0) / 12, 2), B.eurS((K.cf_ns_ezb || 0) / 12, 2), B.eurS((K.cf_ns_an || 0) / 12, 2)], art: 'ende' }
      ]) + '<p class="det">Ende Zinsbindung: mit fortgeschriebener Miete und dem dann erreichten Tilgungsstand. Anschluss: mit dem angenommenen Anschlusszins.</p></div>';
    if (document.getElementById('zaer-zins-now')) {
      var zT = function (id) { return (zellText(id) || '–').replace(/^\+/, ''); };
      h += '<div class="block"><h3>Kennzahlen je Phase</h3>' + tab(B, kopf, [
        { w: ['Sollzins', zT('zaer-zins-now'), zT('zaer-zins-ezb'), zT('zaer-zins-an')] },
        { w: ['Rate / Monat', zT('zaer-rate-now'), zT('zaer-rate-ezb'), zT('zaer-rate-an')] },
        { w: ['Cashflow / Monat vor Steuern', zT('zaer-cfvst-now'), zT('zaer-cfvst-ezb'), zT('zaer-cfvst-an')] },
        { w: ['Cashflow / Monat nach Steuern', zT('zaer-cf-now'), zT('zaer-cf-ezb'), zT('zaer-cf-an')] },
        { w: ['DSCR', zT('zaer-dscr-now'), zT('zaer-dscr-ezb'), zT('zaer-dscr-an')] },
        { w: ['Veränderung der Rate gegenüber heute', '–', zellText('zaer-drate-ezb') || '–', zellText('zaer-drate-an') || '–'], art: 'ende' }
      ]) + '</div>';
    }
    var PT = S.phaseTable;
    if (PT && PT.now && PT.ezb && PT.an) {
      var pz = function (f, g) { return [PT.now, PT.ezb, PT.an].map(function (p) { return g(p[f]); }); };
      h += '<div class="block"><h3>Rendite und Vermögen je Phase</h3>' + tab(B, kopf, [
        { w: ['Bruttomietrendite'].concat(pz('bmy', function (v) { return B.pct(v, 2); })) },
        { w: ['Nettomietrendite'].concat(pz('nmy', function (v) { return B.pct(v, 2); })) },
        { w: ['Beleihungsauslauf (LTV)'].concat(pz('ltv', function (v) { return B.pct(v, 1); })) },
        { w: ['Restschuld'].concat(pz('rs', function (v) { return B.eur(v); })) },
        { w: ['Immobilienwert (angenommen)'].concat(pz('wert', function (v) { return B.eur(v); })) },
        { w: ['Eigenkapital im Objekt'].concat(pz('eq', function (v) { return B.eur(v); })), art: 'ende' }
      ]) + '<p class="det">Immobilienwert: fortgeschrieben mit der angenommenen Wertsteigerung, keine Bewertung.</p></div>';
    }
    h += '<div class="block"><h3>Zinsänderungsrisiko</h3>' + B.liste([
      ['Zinsbindung', bindj != null ? B.zahl(bindj, 0) + ' Jahre' : '–'],
      ['Restschuld am Ende der Zinsbindung', B.eur(S.rs)],
      ['Angenommener Anschlusszins · Tilgung', B.pct(zahlAus('anschl_z'), 2) + ' · ' + B.pct(zahlAus('anschl_t'), 2)],
      ['Rate nach Anschluss / Monat', B.eur(K.rate_an_m, 2)],
      ['Mehrzins auf die Restschuld / Monat', B.eur(K.zaer_m, 2), { art: 'ende', det: da(K.zaer_pct) !== null ? 'Zinsanstieg gegenüber heute ' + B.zahl(K.zaer_pct, 2) + ' Prozentpunkte' : '' }]
    ]) + '</div>';
    return h;
  }
  function cfJahre(B) {
    var rows = St().cfRows || [];
    if (!rows.length) return '<p>Keine Jahreswerte vorhanden – bitte Objekt vollständig erfassen.</p>';
    var bsv = rows.some(function (r) { return (r.bspar_y || 0) > 0; });
    var f = function (v) { return da(v) === null ? '–' : B.zahl(v, 0); };
    var fs = function (v) { if (da(v) === null) return '<td class="r num">–</td>'; return '<td class="r num' + (v > 0.5 ? ' pos' : v < -0.5 ? ' neg' : '') + '">' + B.esc(B.eurS(v).replace(' €', '')) + '</td>'; };
    return '<table class="dicht"><thead><tr><th>Jahr</th><th class="r">Kaltmiete</th><th class="r">Bewirt.</th><th class="r">Zins</th><th class="r">' + (bsv ? 'Tilg.+BSV' : 'Tilgung') + '</th><th class="r">CF v. St.</th><th class="r">Steuer</th><th class="r">CF n. St.</th><th class="r">Restschuld</th><th class="r">LTV</th></tr></thead><tbody>'
      + rows.map(function (r) {
        return '<tr><td class="num">' + B.esc(r.cal || r.y) + '</td><td class="r num">' + f(r.nkm_y) + '</td><td class="r num">' + f((r.bwk_cf_y != null ? r.bwk_cf_y : r.bwk_y) + (r.su_y || 0) + (r.san_y || 0) /* v3214 N137 */) + '</td><td class="r num">' + f(r.zy) + '</td><td class="r num">' + f(bsv ? (r.ty || 0) + (r.bspar_y || 0) : r.ty) + '</td>'
          + fs(r.cfop_y) + fs(da(r.tax_y) === null ? null : -r.tax_y) + fs(r.cfns_y) + '<td class="r num">' + f(r.rs) + '</td><td class="r num">' + B.zahl(r.ltv_y, 0) + ' %</td></tr>';
      }).join('') + '</tbody></table><p class="det">Beträge in Euro je Jahr. CF v. St. = Kaltmiete − Bewirtschaftung − Zins − ' + (bsv ? 'Tilgung − Bausparrate' : 'Tilgung') + '. Steuer: + Erstattung, − Belastung. CF n. St. = CF v. St. + Steuer.'
        + B.esc(window.DpSanierungPlan && DpSanierungPlan.einmaligText ? DpSanierungPlan.einmaligText(rows) : '') + '</p>';   /* v3214 N137 */
  }
  /* v3203 · Kurzfassung: der Vermögenszuwachs als ein Bild (derselbe Wasserfall wie in der vollständigen Fassung, aus State._vz) */
  /* v4380 · Marcel 24.11.2026: „lassen wir genauso wie bis jetzt, außer die Diagramme, die wir geändert haben, da die
     aktuellen reinnehmen, dass Farben passen“. Aus den Karten des Reiters Bewertung (grafiken-bewertung.js) nur das Diagramm
     und seine Legende, ohne Kopf und Text: Seiten, Reihenfolge und Texte des Dokuments bleiben. Ohne Karte bleibt das alte Bild. */
  function gbDiagramm(html) {
    if (!html) return '';
    var d = document.createElement('div'); d.innerHTML = html;
    var svg = d.querySelector('svg'); if (!svg) return '';
    [].forEach.call(svg.querySelectorAll('.gb-treff'), function (e) { e.remove(); });
    var leg = d.querySelector('.gb-leg');
    return '<div class="dp-gb dp-gb-pdf">' + svg.outerHTML + (leg ? leg.outerHTML : '') + '</div>';
  }
  function gbKarte(name, a, b) {
    /* v4390 · hinter der Vorschau grafiken_neu wie die Reiter (seit 1.0.157 für alle frei, Migration 129); ohne Freigabe das alte Bild */
    if (window.DpVorschau && typeof window.DpVorschau.frei === 'function' && !window.DpVorschau.frei('grafiken_neu')) return '';
    var G = window.DpGrafikenBewertung; if (!G || typeof G[name] !== 'function') return '';
    try { return gbDiagramm(G[name](a, b)); } catch (e) { try { console.warn('[dp-dokumente] ' + name, e); } catch (x) {} return ''; }
  }
  function zuwachsKurz(B) {
    var S = St(), rows = S.cfRows || [], vz = S._vz || {};
    if (rows.length < 2 || da(vz.verm_zuwachs) === null || typeof B.wasserfall !== 'function') return '';
    return '<div class="block"><h3>Vermögenszuwachs über ' + rows.length + ' Jahre</h3>'
      + (gbKarte('_zuwachsHtml') || B.wasserfall([{ name: 'Tilgung', wert: vz.tilgung_kum, klasse: 'b1' }, { name: 'CF-Überschuss', wert: vz.cf_ueberschuss_konto, klasse: 'b2' },
        { name: 'Steuervorteil', wert: vz.steuervorteil, klasse: 'b2' }, { name: 'Wertsteigerung', wert: vz.wertsteig_kum, klasse: 'b2' }], 'Zuwachs'))   /* v4380 */
      + '<p class="det">Wertsteigerung als Annahme aus den Einstellungen, keine Bewertung nach § 194 BauGB.</p></div>';
  }
  function vermoegenVoll(K, B) {
    var S = St(), rows = S.cfRows || [], vz = S._vz || {};
    if (rows.length < 2) return '<div class="hinweis">Die Projektion endet nach ' + rows.length + ' Jahr' + (rows.length === 1 ? '' : 'en') + '. Vermögensaufbau, Diagramme und Belastungsprobe brauchen mindestens zwei Jahresreihen.</div>';
    var lin = B.linien([
      { name: 'Objektwert (angenommen)', klasse: 'l1', werte: rows.map(function (z) { return { x: z.cal, y: z.wert_y }; }) },
      { name: 'Restschuld', klasse: 'l2', werte: rows.map(function (z) { return { x: z.cal, y: z.rs }; }) },
      { name: 'Eigenkapital im Objekt', klasse: 'l3', werte: rows.map(function (z) { return { x: z.cal, y: z.eq_y }; }) }
    ], { flaeche: [0, 1], titel: 'Vermögensaufbau' });
    var ek0 = da(rows[0].eq_y) !== null ? rows[0].eq_y : 0;
    var jz = rows.filter(function (r, i) { return rows.length <= 12 || i % 2 === 0 || i === rows.length - 1; });
    var tz = jz.map(function (r) { return { w: [String(r.cal || r.y), B.eur(r.wert_y), B.eur(r.rs), B.eur(r.eq_y), B.eurS((r.eq_y || 0) - ek0)] }; }), tk = 'Jahr';
    /* v4580 · Marcel 24.11.2026: „beim Vermögenszuwachs im Detail fehlt das letzte Jahr, die 2045“. Die Grafik darüber (grafiken-bewertung.js
       vermDaten) zeigt den Stand jeweils zu Jahresbeginn bis zum Ende der Betrachtung (2045, Eigenkapital 739 T€), die Tabelle las die
       Jahreszeilen (Wert zu Jahresbeginn, Restschuld zum Jahresende) und hörte 2044 auf. Jetzt dieselben Punkte wie die Grafik. */
    var GV = null; try { GV = (gbKarte('_aufbauHtml') && window.DpGrafikenBewertung && DpGrafikenBewertung._vermDaten) ? DpGrafikenBewertung._vermDaten() : null; } catch (e) { GV = null; }
    if (GV && GV.Z && GV.Z.length) {
      var e0 = GV.w0 - GV.rs0, P = [{ j: (GV.Z[0].j - 1), wert: GV.w0, rs: GV.rs0, ek: e0 }].concat(GV.Z);
      var pz = P.filter(function (z, i) { return P.length <= 12 || i % 2 === 0 || i === P.length - 1; });
      tk = 'Stand 1.1.';
      tz = pz.map(function (z, i) { return { w: [String(z.j) + (i === 0 ? ' (Kauf)' : '') + (z === P[P.length - 1] ? ' (Ende)' : ''), B.eur(z.wert), B.eur(z.rs), B.eur(z.ek), B.eurS(z.ek - e0)], art: z === P[P.length - 1] ? 'ende' : '' }; });
    }
    var h = '<div class="block">' + (gbKarte('_aufbauHtml') || lin) + '<p class="det">Der Objektwert ist eine Annahme aus der hinterlegten Wertsteigerung, keine Bewertung nach § 194 BauGB.</p></div>'
      + '<h3>Vermögenszuwachs im Detail</h3>' + tab(B, [tk, 'Immobilienwert', 'Restschuld', 'Eigenkapital im Objekt', 'Zuwachs gegenüber Kauf'], tz, 'dicht');
    if (da(vz.verm_zuwachs) !== null) {
      var sm = function (f) { return rows.reduce(function (a, r) { return a + (Number(r[f]) || 0); }, 0); };
      h += '<div class="zwei"><div class="block"><h3>Woraus der Vermögenszuwachs besteht (' + rows.length + ' Jahre)</h3>' + B.liste([
          ['Tilgung aus den Mieteinnahmen', B.eur(vz.tilg_durch_einnahmen)], ['Cashflow-Überschuss nach Tilgung, vor Steuern', B.eurS(vz.cf_ueberschuss_konto)],
          [(vz.steuervorteil || 0) < 0 ? 'Steuerlast (kumuliert)' : 'Steuervorteil (kumuliert)', B.eurS(vz.steuervorteil)],
          ['Wertsteigerung (Annahme ' + B.pct(zahlAus('wertstg'), 1) + ' p. a.)', B.eur(vz.wertsteig_kum)], ['Vermögenszuwachs gesamt', B.eurS(vz.verm_zuwachs), { art: 'ende' }]]) + '</div>'
        + '<div class="block"><h3>Wie der Cashflow-Überschuss entsteht</h3>' + B.liste([
          ['Kumulierte Mieteinnahmen (Kaltmiete)', B.eur(sm('nkm_y'))], ['abzüglich Bewirtschaftung', B.eurS(-sm('bwk_cf_y')), { art: 'ein' }], ['abzüglich Zinsen', B.eurS(-sm('zy')), { art: 'ein' }],
          ['abzüglich Tilgung', B.eurS(-sm('ty')), { art: 'ein' }], sm('bspar_y') > 0 ? ['abzüglich Bausparraten', B.eurS(-sm('bspar_y')), { art: 'ein' }] : null,
          ['Cashflow-Überschuss nach Tilgung, vor Steuern', B.eurS(vz.cf_ueberschuss_konto), { art: 'ende' }]]) + '</div></div>'
        + (gbKarte('_zuwachsHtml') || B.wasserfall([{ name: 'Tilgung', wert: vz.tilgung_kum, klasse: 'b1' }, { name: 'CF-Überschuss', wert: vz.cf_ueberschuss_konto, klasse: 'b2' },
          { name: 'Steuervorteil', wert: vz.steuervorteil, klasse: 'b2' }, { name: 'Wertsteigerung', wert: vz.wertsteig_kum, klasse: 'b2' }], 'Zuwachs'));   /* v4380 */
    }
    var w = [];
    if (da(S.wert_basis) !== null) w.push(['Wert-Anker heute', B.eur(S.wert_basis)], ['Angenommene Wertsteigerung p. a.', B.pct(zahlAus('wertstg'), 1)],
      ['Angenommener Wert nach ' + rows.length + ' Jahren', B.eur(da(vz.wertsteig_kum) !== null ? S.wert_basis + vz.wertsteig_kum : null)]);
    if (da(K.exit_vkp) !== null) {
      var lz = rows[rows.length - 1];
      w.push(['Angenommener Verkaufspreis' + (S.btj ? ' nach ' + S.btj + ' Jahren' : ''), B.eur(K.exit_vkp)], ['Restschuld zum Verkaufszeitpunkt', B.eur(lz.rs)],
        ['Möglicher Erlös nach Ablösung', B.eur(K.exit_vkp - Math.max(0, lz.rs || 0)), { art: 'ende' }]);
      if (zahlAus('exit_bmy') != null) w.push(['Unterstellte Exit-Rendite', B.pct(zahlAus('exit_bmy'), 1), { art: 'ein' }]);
    }
    if (w.length) h += '<div class="block"><h3>Wertsteigerung und Exit</h3>' + B.liste(w) + '</div>';
    return h;
  }
  function mieterliste(K, B) {
    var M = null; try { M = window.DpMfhEinheiten && DpMfhEinheiten.berichtDaten ? DpMfhEinheiten.berichtDaten() : null; } catch (e) {}
    if (!M || !M.zeilen || !M.zeilen.length) return '';
    var n = function (s) { var x = Number(String(s == null ? '' : s).replace(',', '.')); return x > 0 ? x : null; };
    var ze = da(K.ze_j) || 0, ist = K.nkm_j || 0, soll = M.s.soll * 12 + ze, bmyS = null;
    try { if (window.DealKpis && DealKpis.compute && K.kp > 0) bmyS = DealKpis.compute({ kp: K.kp, nkm: M.s.soll, ze: ze / 12 }).bmy; } catch (e) {}
    var z = [['Kaltmiete p. a. – Ist', B.eur(ist)], ['Kaltmiete p. a. – Soll (nach Maßnahmen)', B.eur(soll)], ['Bruttomietrendite Ist (auf Kaufpreis)', B.pct(K.bmy, 2)],
      ['Bruttomietrendite Soll (auf Kaufpreis)', B.pct(bmyS, 2)], ['Rechtliche Einheit', M.aufgeteilt ? 'in Wohnungseigentum aufgeteilt (WEG)' : 'ungeteiltes Gebäude']];
    if (M.s.leer) z.push(['Leerstand', M.s.leer + ' Einheiten / ' + B.zahl(M.s.leerFl, 0) + ' m²']);
    if (M.s.kosten) z.push(['Geplante Maßnahmen', B.eur(M.s.kosten)]);
    z.push(['Modernisierungsgrad (flächengewichtet)', B.zahl(M.punkteGew, 1) + ' von 20 Punkten, angesetzt ' + M.hausPunkte]);
    if (M.rndGew > 0) z.push(['Restnutzungsdauer des Gebäudes (Anlage 2, indikativ)', Math.round(M.rndGew) + ' Jahre' + (M.rndInfo && M.rndInfo.gnd ? ' (GND ' + M.rndInfo.gnd + ')' : ''), { art: 'ende' }]);
    return '<h3>Mieterliste</h3><table class="dicht"><thead><tr><th>Nr.</th><th>Lage</th><th class="r">m²</th><th class="r">Ist €/M</th><th class="r">Soll €/M</th><th>Status</th><th class="r">Anlage 2</th></tr></thead><tbody>'
      + M.zeilen.map(function (r) { return '<tr><td>' + B.esc(r.e.nr || '') + '</td><td>' + B.esc(r.e.lage || '') + '</td><td class="r num">' + (r.fl ? B.zahl(r.fl, 0) : '–') + '</td><td class="r num">' + (n(r.e.ist) ? B.zahl(n(r.e.ist), 0) : '–') + '</td><td class="r num">' + (n(r.e.soll) ? B.zahl(n(r.e.soll), 0) : '–') + '</td><td>' + (r.e.status === 'leer' ? 'leer' : 'vermietet') + '</td><td class="r num">' + r.punkte + ' P.' + (r.geerbt === 4 ? '*' : '') + '</td></tr>'; }).join('')
      + '</tbody></table><p class="det">Anlage 2 ImmoWertV: Modernisierungspunkte je Einheit; * = Zustand vollständig vom Gebäude übernommen.</p>'
      + '<div class="block"><h3>Ist gegen Soll</h3>' + B.liste(z) + '<p class="det">' + B.esc(M.sollAbJahr ? 'Die Cashflow-Rechnung setzt die Soll-Miete ab Jahr ' + M.sollAbJahr + ' an; davor und danach gilt die hinterlegte Mietentwicklung.' : 'Die Cashflow-Rechnung rechnet durchgehend mit der Ist-Miete – die Soll-Miete ist hier nur nachrichtlich.') + '</p></div>';
  }
  /* Werte je Verfahren als Spannen gegen den Kaufpreis (wie die Wertlandschaft der Bankfassung) */
  /* v4580 · Marcel 24.11.2026: „die Grafik bei Werte je Verfahren … unten nicht richtig angegeben“. Gemessen Westerfeldstr. 146: keine
     Achse und keine Zahlen, der führende Wert fehlte (pdf-wert-zielbild.js ART ohne aufteiler), die Namen in Versalien. Jetzt: Achse in T€,
     je Zeile Spanne (Band), Mitte (Punkt) mit Zahl, führend in Gold, Kaufpreis als Linie mit Beschriftung oben. */
  function wertSpannen(V, kp, B) {
    var werte = [].concat.apply([], V.map(function (v) { return [v.unten, v.mitte, v.oben]; })).concat([kp]).filter(function (x) { return da(x) !== null; });
    if (!werte.length) return '';
    var lo = Math.min.apply(null, werte), hi = Math.max.apply(null, werte), spn = hi - lo || hi * 0.2 || 1;
    var stp = Math.pow(10, Math.floor(Math.log10(spn / 4))); [1, 2, 2.5, 5, 10].some(function (m) { if (spn / (stp * m) <= 5) { stp *= m; return true; } return false; });
    var min = Math.floor(lo * 0.97 / stp) * stp, max = Math.ceil(hi * 1.03 / stp) * stp;
    var W = 520, L = 168, R = 46, zh = 20, T = 16, H = T + V.length * zh + 22;
    var X = function (v) { return L + (v - min) / (max - min) * (W - L - R); };
    var tsd = function (v) { return B.zahl(v / 1000, 0) + ' T€'; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dg" role="img" aria-label="Werte je Verfahren">';
    for (var t = min; t <= max + 1; t += stp) s += '<line x1="' + X(t).toFixed(1) + '" x2="' + X(t).toFixed(1) + '" y1="' + (T - 4) + '" y2="' + (H - 18) + '" class="g"/>'
      + '<text x="' + X(t).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" class="a">' + B.esc(tsd(t)) + '</text>';
    V.forEach(function (v, i) {
      var y = T + 6 + i * zh, u = da(v.unten) !== null ? v.unten : v.mitte, o = da(v.oben) !== null ? v.oben : v.mitte;
      var nm = String(v.name || '').split(' · ')[0];
      s += '<text x="0" y="' + (y + 3) + '" class="bt"' + (v.fuehrend ? ' font-weight="700"' : '') + '>' + B.esc(nm + (v.fuehrend ? ' · führend' : '')) + '</text>'
        + (o > u ? '<rect x="' + X(u).toFixed(1) + '" y="' + (y - 4) + '" width="' + Math.max(2, X(o) - X(u)).toFixed(1) + '" height="8" rx="2" class="f1"/>' : '')
        + '<circle cx="' + X(v.mitte).toFixed(1) + '" cy="' + y + '" r="' + (v.fuehrend ? 4.2 : 3.2) + '" class="' + (v.fuehrend ? 'b1' : 'b3') + '"/>'
        + '<text x="' + (Math.max(X(o), X(v.mitte)) + 6).toFixed(1) + '" y="' + (y + 3) + '" class="a"' + (v.fuehrend ? ' font-weight="700"' : '') + '>' + B.esc(tsd(v.mitte)) + '</text>';
    });
    if (da(kp) !== null) s += '<line x1="' + X(kp).toFixed(1) + '" x2="' + X(kp).toFixed(1) + '" y1="' + (T - 4) + '" y2="' + (H - 18) + '" class="l2" stroke-dasharray="3 2"/>'
      + '<text x="' + X(kp).toFixed(1) + '" y="' + (T - 7) + '" text-anchor="middle" class="a">Kaufpreis ' + B.esc(tsd(kp)) + '</text>';
    return s + '</svg><p class="det">Band: Spanne des Verfahrens. Punkt: Wert (Mitte). Gold: führendes Verfahren. Rote Linie: Kaufpreis.</p>';
  }
  /* v4580 · Marcel 24.11.2026: „Ertragswert Bestand. Ist das jetzt überhaupt führend? Da steige ich gar nicht durch.“ Die Rolle des
     Ertragswerts steht jetzt an der Überschrift: führend nur, wenn er der maßgebende Wert ist (calc.js wert_anker). */
  /* v4580 · MUSTER (Marcel 24.11.2026: „unten extrem viel Text zur Aufteilung … kurz und knapp, auch woher es kommt“). Nur in den
     Musterfassungen investment_muster / kurz_muster gesetzt, die regulären Fassungen bleiben, bis Marcel die Muster freigibt. */
  var _knapp = false;
  function fussKnapp(B, PD) {
    var f = klar(PD.fuss || ''), A = St().wert_anker, pk = [];
    var lzs = f.match(/Liegenschaftszins (\d+,\d+ %(?: \([^)]*\))?(?: bzw\. \d+,\d+ %(?: \([^)]*\))?)?)/), jahre = f.match(/Jahre: ([^]*?)\.?\s*$/), ks = f.match(/Kappungsgrenze (\d+ %)/), vm = f.match(/Vergleichsmiete (\d+,\d+ €\/m²)/);
    var aufg = !!(PD.wert_je_wohnung && PD.wert_je_wohnung.length);
    if (A && A.art) pk.push('Maßgebend: ' + (ANKER_NAME[A.art] || 'Wert aus dem Marktbericht') + (aufg ? ' des Hauses als Ganzes' : '') + ', führendes Verfahren.' + (aufg ? ' Der Wert nach Aufteilung (Vergleichswert je Wohnung) ist eine zusätzliche Angabe und rechnet nicht mit.' : ''));
    pk.push('Mieterhöhung: Wert zum heutigen Stichtag, Erhöhungen erst ab Wirksamkeit und abgezinst.');
    pk.push('Zielbild: Ausblick mit umgesetzten Maßnahmen, kein heutiger Verkehrswert.');
    pk.push('Marktpreisindikation: aus Angebotspreisen am Ort, sie hängt nicht an der Miete.');
    if (lzs) pk.push('Liegenschaftszins ' + lzs[1] + '.');
    if (ks || vm) pk.push([ks ? 'Kappungsgrenze ' + ks[1] + ' in 3 Jahren' : '', vm ? 'Vergleichsmiete ' + vm[1] + ' (Mietspiegel)' : ''].filter(Boolean).join(', ') + '.');
    if (jahre) pk.push('Jahre: ' + jahre[1].replace(/\s*\([^)]*\)/g, '') + '.');
    return '<ul class="det" style="margin:2mm 0 0 4mm;padding:0">' + pk.map(function (x) { return '<li>' + B.esc(x) + '</li>'; }).join('') + '</ul>';
  }
  function herkunftJeWohnung(B, PD) {
    var h = {}; (PD.wert_je_wohnung || []).forEach(function (w) { var t = String(w.verfahren || ''), i = t.indexOf(' · '); if (i > 0) h[t.slice(i + 3)] = 1; });
    var l = Object.keys(h); if (!l.length) return '';
    return '<p class="det">Herkunft: ' + B.esc(l.join(' · ')) + '</p>';
  }
  function ewRolle() {
    /* v4580b · aufgeteilt: das Haus als Ganzes bleibt maßgebend (Marcel: „der Aufteilerwert steht nur daneben“) */
    var A = St().wert_anker;
    if (!A) return '';
    return A.art === 'ertragswert' ? ' (Haus als Ganzes, führend)' : ' (stützend)';
  }
  function wertZielbild(K, B, WZ, PD, kurz, bank) {
    if (!WZ && !PD) return '';
    var h = '', kp = (WZ && WZ.kaufpreis) || K.kp;
    if (WZ && WZ.verfahren && WZ.verfahren.length) {
      h += '<h3>Werte je Verfahren</h3>' + (WZ.stand ? '<p class="sub">' + B.esc(WZ.stand) + '</p>' : '')
        + tab(B, ['Verfahren', 'von', 'Wert', 'bis', 'zum Kaufpreis'], WZ.verfahren.map(function (v) {
          return { w: [v.name + (v.sub ? ' · ' + v.sub : '') + (v.fuehrend ? ' · führend' : ''), B.eur(v.unten), B.eur(v.mitte), B.eur(v.oben), kp ? B.eurS(v.mitte - kp) : '–'], art: v.fuehrend ? 'ende' : '' };
        }).concat([{ w: ['Kaufpreis', '', B.eur(kp), '', ''], art: 'summe' }]));
      if (!kurz) h += wertSpannen(WZ.verfahren, kp, B);
    }
    var PZ = window.DpPotenzial;
    if (PD && !kurz) {
      h += '<h3>Wertpotenzial</h3>' + (PD.satz_bank ? '<p>' + B.esc(klar(PD.satz_bank)) + '</p>' : '');
      if (PD.art === 'mfh' && PD.wohnungen && PD.wohnungen.length) {
        h += PD.hat_ziel === false
          ? tab(B, ['WE', 'm²', 'Ist €/M', 'Mieterhöhung'], PD.wohnungen.map(function (w) { return [w.we, B.zahl(w.wfl, 0), w.ist, w.soll]; }), 'dicht')
          : tab(B, ['WE', 'm²', 'Ist €/M', 'Mieterhöhung', 'Ziel €/M', 'Maßnahmen'], PD.wohnungen.map(function (w) { return [w.we, B.zahl(w.wfl, 0), w.ist, w.soll, w.ziel, w.massnahmen]; }), 'dicht');
      }
      /* v3332 · aufgeteilt: Wert je Wohnung (Vergleichswert führend, Ertragswert stützend). Stand im jsPDF-Weg
         (pdf.js v3322) und im Bank-PDF, fehlte aber im Investment-PDF dieser Fassung - gemessen 12.11.2026 an
         Westerfeldstr. 146 (2026-1161): Aufteilerwert in der Stufen-Tabelle, die Wohnungen selbst nirgends. */
      if (PD.wert_je_wohnung && PD.wert_je_wohnung.length) {
        var WS = PD.wert_je_wohnung_summe;
        /* v3332a · eigene Tabelle: tab() setzt jede Spalte ab der zweiten rechtsbündig und ohne Umbruch -
           die lange Herkunft schob die Seite über den Rand (das ganze Dokument wurde verkleinert gedruckt) */
        var _vz = function (t) { var i = String(t || '').indexOf(' · '); return i < 0 ? [String(t || ''), ''] : [t.slice(0, i), t.slice(i + 3)]; };
        h += '<h3>Wert je Wohnung · nach Aufteilung</h3><table class="dicht"><thead><tr><th>WE</th><th class="r">m²</th><th class="r">Wert führend</th>'
          + '<th>Verfahren · Herkunft</th><th class="r">Ertragswert stützend</th></tr></thead><tbody>'
          + PD.wert_je_wohnung.map(function (w) {
            var v = _vz(w.verfahren);
            return '<tr><td>' + B.esc(w.we) + '</td><td class="r num">' + B.esc(B.zahl(w.wfl, 0)) + '</td><td class="r num">' + B.esc(w.wert) + '</td>'
              + '<td style="white-space:normal">' + B.esc(v[0]) + (v[1] && !_knapp ? '<div class="det">' + B.esc(v[1]) + '</div>' : '') + '</td><td class="r num">' + B.esc(w.stuetzend) + '</td></tr>';
          }).join('')
          + (WS ? '<tr class="summe"><td>Summe nach Aufteilung</td><td></td><td class="r num">' + B.esc(WS.summe + (WS.vollstaendig ? '' : '*')) + '</td><td style="white-space:normal">'
            + B.esc(WS.bezeichnung) + ' · führend</td><td></td></tr>' : '')
          + '</tbody></table>' + (_knapp ? herkunftJeWohnung(B, PD) : '');
      }
      if (PD.bruecke && PZ && typeof PZ.ueberleitungZeilen === 'function') {
        var UZ = PZ.ueberleitungZeilen(PD.bruecke) || [], um = Math.max.apply(null, UZ.filter(function (z) { return z.schritt; }).map(function (z) { return Math.abs(z.w); }).concat([1]));
        var farbe = { bestand: '#2A2727', kosten: 'var(--rot)', soll: 'color-mix(in srgb,var(--gold) 55%,#fff)', ziel: 'var(--gold-d)' };
        /* v3181 · Marcel: Seitenumbruch vor der Wertueberleitung (sie riss sonst zwischen zwei Seiten) */
        h += '<h3 style="break-before:page;page-break-before:always">Wertüberleitung · Ertragswert je Stufe' + B.esc(ewRolle()) + '</h3><table><tbody>' + UZ.map(function (z) {
          var bar = '';
          if (z.schritt) {
            var b = Math.abs(z.w) / um * 48;
            bar = Math.abs(z.w) < 500 ? '<span class="det">unverändert</span>' : '<div style="position:relative;height:3.2mm"><div style="position:absolute;top:0;height:100%;' + (z.w >= 0 ? 'left:50%' : 'right:50%') + ';width:' + b.toFixed(1) + '%;background:' + (farbe[z.art] || 'var(--gold)') + '"></div><div style="position:absolute;left:50%;top:-.6mm;bottom:-.6mm;border-left:.2mm solid var(--line)"></div></div>';
          }
          var f = z.netto ? (z.w >= 0 ? ' pos' : ' neg') : '';
          return '<tr class="' + (z.netto ? 'ende' : z.summe ? 'summe' : '') + '"><td>' + B.esc(z.t) + (z.klein ? '<div class="det">' + B.esc(z.klein) + '</div>' : '') + '</td><td style="width:38%">' + bar + '</td><td class="r num' + f + '">' + B.esc(z.schritt ? B.eurS(z.w) : B.eur(z.w)) + '</td></tr>';
        }).join('') + '</tbody></table><p class="det">Balken: Veränderung gegen die Zeile darüber, gemeinsame Skala um null. Potenzial netto = Ertragswert ' + (PD.bruecke.zielbild != null ? 'Zielbild' : 'nach Mieterhöhung') + ' minus Bestand minus Maßnahmenkosten.</p>';
      }
      if (PD.kennzahlen && PD.kennzahlen.length) {
        h += '<div class="block"><h3>Kennzahlen je Stufe</h3>' + tab(B, ['Kennzahl'].concat(PD.spalten.map(function (k) { return PD.titel[k]; })),
          PD.kennzahlen.map(function (z) { return { w: z.map(String), art: /^Ertragswert|^nach Aufteilung/.test(z[0]) ? 'summe' : '' }; }).concat([{ w: ['Kaufpreis'].concat(PD.spalten.map(function (k, i) { return i ? '' : B.eur(K.kp); })) }]))
          /* v3332 · PD.fuss traegt den Aufteilungshinweis schon (potenzial.js pdfDaten) - er stand zweimal da */
          + (_knapp ? fussKnapp(B, PD) : '<p class="det">' + B.esc(klar(PD.fuss || '')) + '</p>') + '</div>';
      }
    } else if (WZ && WZ.stufen && WZ.stufen.length) {
      h += '<h3>Ertragswert je Stufe</h3>' + tab(B, ['Stufe', 'Ertragswert', 'Maßnahmen', 'Marktpreisindikation'], WZ.stufen.map(function (s) { return [s.titel, B.eur(s.wert), s.kosten ? B.eur(s.kosten) : '–', s.mpi != null ? B.eur(s.mpi) : '–']; }));
    }
    if (WZ) {
      if (WZ.ausblick && !_knapp) h += '<div class="hinweis">' + B.esc(klar(WZ.ausblick)) + '</div>';
      (WZ.stau || []).forEach(function (s) { h += '<p><b>Sanierungsstau ' + B.esc(s.titel) + ':</b> ' + B.esc(klar(s.satz)) + '</p>'; });
      if (WZ.kern && WZ.kern.length) h += '<div class="block"><h3>Kernaussagen</h3>' + B.liste(WZ.kern.map(function (k) { return [k.titel, k.wert_text || '', { det: k.text ? klar(k.text) : '' }]; })) + '</div>';
      /* v3180c · Bankfassung ohne die Erklaertexte des Marktberichts (Methodik) - die Zahlen stehen in den Tabellen darueber */
      if (!kurz && !bank) (WZ.texte || []).forEach(function (t) { h += '<div class="block"><h3>' + B.esc(t.h) + '</h3>' + t.p.map(function (x) { return '<p>' + B.esc(klar(x)) + '</p>'; }).join('') + '</div>'; });
      /* v3180c · die Kennzeichnung steht schon im Fuss der Stufen-Tabelle (PD.fuss) - nicht zweimal */
      if (WZ.hinweis && !(PD && PD.fuss && !kurz) && !_knapp) h += '<p class="det">' + B.esc(klar(WZ.hinweis)) + '</p>';
    }
    return h;
  }
  function cockpitDaten() {
    if (!window.BankCharts || typeof BankCharts.renderBankCockpit !== 'function') return null;
    var tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-3000px;top:0;width:640px;height:340px'; document.body.appendChild(tmp);
    try { BankCharts.renderBankCockpit(tmp, window.State); } catch (e) {}
    tmp.remove();
    var CD = BankCharts._lastCockpitData;
    return CD && CD.dscrArr && CD.ltvArr && CD.dscrArr.length >= 2 ? CD : null;
  }
  function bankCockpit(B, kurz) {
    var CD = cockpitDaten(); if (!CD) return '';
    var rows = St().cfRows || [], jj = CD.years || rows.map(function (r) { return r.cal || r.y; });
    var sw = window.DealPilotSchwellen ? DealPilotSchwellen.get() : { dscrGruen: 1.2, dscrGelb: 1.0 };
    var reihe = function (arr) { return arr.map(function (v, i) { return { x: Number(jj[i]), y: Number(v) }; }); };
    var flach = function (w) { return jj.map(function (x) { return { x: Number(x), y: w }; }); };
    var dscr = B.linien([{ name: 'DSCR', klasse: 'l1', werte: reihe(CD.dscrArr) }, { name: 'solide ab ' + B.zahl(sw.dscrGruen, 2), klasse: 'l3', werte: flach(sw.dscrGruen) }, { name: 'Deckung ' + B.zahl(sw.dscrGelb, 2), klasse: 'l2', werte: flach(sw.dscrGelb) }],
      { null: true, h: kurz ? 120 : 160, fmt: function (v) { return B.zahl(v, 2); }, titel: 'DSCR im Verlauf' });
    var ltv = B.linien([{ name: 'LTV', klasse: 'l1', werte: reihe(CD.ltvArr) }], { null: true, h: kurz ? 120 : 150, fmt: function (v) { return B.zahl(v, 0) + ' %'; }, titel: 'LTV im Verlauf' });
    /* v4380 · DSCR und LTV wie im Reiter Bewertung (grafiken-bewertung.js verlaufHtml), mit denselben Daten (BankCharts._lastCockpitData) */
    var sw2 = window.DealPilotSchwellen ? DealPilotSchwellen.get() : {}, zz = function (v, d) { v = Number(v); return isFinite(v) && v > 0 ? v : d; };
    var Dgb = { S: St(), K: St().kpis || {}, C: CD, sw: { dg: zz(sw2.dscrGruen, 1.2), dy: zz(sw2.dscrGelb, 1.0), lg: zz(sw2.ltvGruen, 90), lr: zz(sw2.ltvRot, 100) } };
    dscr = gbKarte('_verlaufHtml', Dgb, 'dscr') || dscr; ltv = gbKarte('_verlaufHtml', Dgb, 'ltv') || ltv;
    if (kurz) return '<div class="zwei"><div class="block"><h3>DSCR im Verlauf</h3>' + dscr + '</div><div class="block"><h3>LTV im Verlauf</h3>' + ltv + '</div></div>';
    return '<div class="block"><h3>Schuldendienstdeckung (DSCR) im Verlauf</h3>' + B.kacheln([{ l: 'DSCR Jahr 1', v: B.zahl(CD.dscrToday, 2), s: 'erstes volles Jahr' }, { l: 'DSCR Ende Zinsbindung', v: B.zahl(CD.dscrEzb, 2), s: CD.bindj ? 'Jahr ' + CD.bindj : '' }, { l: 'DSCR Ende', v: B.zahl(CD.dscrEnd, 2), s: 'Betrachtungsende' }], true) + dscr + '</div>'
      + '<div class="block"><h3>Beleihungsauslauf (LTV) im Verlauf</h3>' + B.kacheln([{ l: 'LTV heute', v: B.pct(CD.ltvToday, 1) }, { l: 'LTV Ende Zinsbindung', v: B.pct(CD.ltvEzb, 1), s: CD.bindj ? 'Jahr ' + CD.bindj : '' }, { l: 'LTV Ende', v: B.pct(CD.ltvEnd, 1), s: 'Betrachtungsende' }], true) + ltv + '</div>';
  }
  /* Belastungsprobe: die Matrix rechnet BankCharts (HTML), hier werden ihre 25 Zellen ausgelesen - wie pdf-investment-bank.js */
  /* v4790m · DSCR und LTV wie im Bank-Cockpit der App (bank-charts.js renderBankCockpit), Marcel 25.11.2026: „Vor einer Woche
     hatten wir noch andere Grafiken und Charts dort“. Die Karte wird mit der App gerechnet und mit ihren eigenen Regeln
     (.bc-*) samt den aufgelösten Farbwerten (Whitelabel) ins Dokument gelegt. Kopf der Karte entfällt, den trägt der Abschnitt. */
  var _bcCss = null;
  function cockpitApp() {
    if (!window.BankCharts || typeof BankCharts.renderBankCockpit !== 'function') return '';
    var tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-3000px;top:0;width:1000px'; document.body.appendChild(tmp);
    try { BankCharts.renderBankCockpit(tmp, window.State); } catch (e) { tmp.remove(); return ''; }
    var kopf = tmp.querySelector('.bc-head'); if (kopf) kopf.remove();
    var html = tmp.innerHTML; tmp.remove();
    if (!/bc-kpi/.test(html)) return '';
    if (_bcCss === null) {
      var r = [];
      [].forEach.call(document.styleSheets, function (sh) { var l; try { l = sh.cssRules; } catch (e) { return; }
        [].forEach.call(l || [], function (x) { if (x.selectorText && /\.bc-/.test(x.selectorText)) r.push(x.cssText); }); });
      var css = r.join(''), namen = {}, m, re = /var\((--[a-zA-Z0-9_-]+)/g;
      while ((m = re.exec(css))) namen[m[1]] = 1;
      var cs = getComputedStyle(document.documentElement), v = [];
      Object.keys(namen).forEach(function (n) { var w = cs.getPropertyValue(n); if (w && w.trim()) v.push(n + ':' + w.trim()); });
      _bcCss = '.dp-bc{' + v.join(';') + '}' + css + '.dp-bc{zoom:.84}.dp-bc .bc-card{break-inside:avoid;page-break-inside:avoid;box-shadow:none}'   /* v4790o · passt so unter die Phasen */;
    }
    return '<style>' + _bcCss + '</style><div class="dp-bc">' + html + '</div>';
  }
  function stressMatrix(B) {
    if (!window.BankCharts || typeof BankCharts.renderStressMatrix !== 'function') return '';
    var tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-3000px;top:0;width:700px;height:420px'; document.body.appendChild(tmp);
    try { BankCharts.renderStressMatrix(tmp, window.State); } catch (e) { tmp.remove(); return ''; }
    var sb = function (t) { return String(t || '').replace(/\s+/g, ' ').trim(); };
    var zellen = [].slice.call(tmp.querySelectorAll('.bc-matrix-cell')).map(function (c) {
      var v = c.querySelector('.bc-matrix-cell-val');
      return { wert: v ? sb(v.textContent) : '', /* v3180 · fuenf Baender (bank-charts.js _cellCls): s-good ab Gruen-Schwelle, s-ok bis Gelb-Schwelle, darunter s-warn/s-bad/s-critical */
        stufe: (c.className.match(/\bs-(good|ok|warn|bad|critical)\b/) || [])[1] || '', basis: /is-base/.test(c.className) };
    });
    var yr = [].slice.call(tmp.querySelectorAll('.bc-matrix-axis-y-row')).map(function (e) { return sb(e.textContent); });
    tmp.remove();
    if (zellen.length !== 25 || yr.length !== 5) return '';
    var BG = { good: '#E6F1EA', ok: '#F7F0DC', warn: '#F6E7E6', bad: '#F0D6D4', critical: '#E8C4C1', '': '#fff' };
    var sw = window.DealPilotSchwellen ? DealPilotSchwellen.get() : { dscrGruen: 1.2, dscrGelb: 1.0 };
    return '<div class="block"><h3>Belastungsprobe · DSCR je Szenario</h3><p class="sub">Jede Zelle ist der DSCR, wenn sich Zins und Miete gleichzeitig ändern. Zeilen: Zinsänderung. Spalten: Mietausfall bzw. Aufwertung. Werte unter 1,0 bedeuten, dass die Miete den Kapitaldienst nicht mehr deckt.</p>'
      + '<table><thead><tr><th>Zinsänderung</th>' + ['Miete −20 %', '−10 %', '±0 %', '+10 %', '+20 %'].map(function (t) { return '<th style="text-align:center">' + t + '</th>'; }).join('') + '</tr></thead><tbody>'
      + yr.map(function (n, r) {
        return '<tr><td>' + B.esc(n.replace(/\s*(Krise|Stress|Mittel|Heute|Erholung)\s*/, ' · $1')) + '</td>' + zellen.slice(r * 5, r * 5 + 5).map(function (z) {
          return '<td class="num" style="text-align:center;background:' + BG[z.stufe] + ';border:.6mm solid #fff;' + (z.basis ? 'box-shadow:inset 0 0 0 .5mm var(--gold-d);font-weight:600' : '') + '">' + B.esc(z.wert || '–') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table><p class="det">Grün ab ' + B.zahl(sw.dscrGruen, 2) + ' · Gelb ' + B.zahl(sw.dscrGelb, 2) + ' bis ' + B.zahl(sw.dscrGruen, 2) + ' · Rot unter ' + B.zahl(sw.dscrGelb, 2) + ' (je dunkler, desto tiefer). Der umrandete Wert ist der Ausgangsfall, gerechnet auf dem ersten vollen Jahr.</p></div>';
  }
  function pilotAnalyse(B, kurz, bank) {
    var ai = window._aiAnalysis || null, txt = window._aiText || '';
    var an = true; try { if (window.DealPilotPdfWahl && typeof DealPilotPdfWahl.pilotAn === 'function') an = DealPilotPdfWahl.pilotAn(); } catch (e) {}
    if (!(ai || txt) || !an) return '';
    var on = function (t) { try { return typeof window._dpPdfSectionOn !== 'function' || window._dpPdfSectionOn(t); } catch (e) { return true; } };
    /* v3180d · lange Texte duerfen umbrechen (break-inside:avoid liess halbe Seiten leer); Absaetze und Punkte bleiben ganz */
    /* v4390b · Marcel 24.11.2026: Abschnitt heißt „Gesamtbewertung“, darunter „Stärken“ und „Schwächen“, „Bankargumente“ heißt
       „Was für die Finanzierung spricht“. kopf: angezeigte Überschrift (leer = keine), t bleibt der Schlüssel der Abschnittswahl. */
    var block = function (t, x, kopf) { if (!x || !on(t)) return ''; var k = kopf == null ? t : kopf; return '<div class="fliess">' + (k ? '<h3>' + B.esc(k) + '</h3>' : '') + String(x).split(/\n+/).map(function (p) { p = klar(p); return p ? '<p>' + B.esc(p) + '</p>' : ''; }).join('') + '</div>'; };
    var liste = function (t, arr, kopf) { if (!arr || !arr.length || !on(t)) return ''; return '<div class="fliess"><h3>' + B.esc(kopf || t) + '</h3><ul>' + arr.slice(0, kurz ? 3 : 8).map(function (x) { return '<li>' + B.esc(klar(x)) + '</li>'; }).join('') + '</ul></div>'; };
    var qa = function (v) { if (!Array.isArray(v)) return v; return v.map(function (e) { return e && typeof e === 'object' ? (e.frage ? e.frage + '\n' : '') + (e.antwort || '') : String(e || ''); }).filter(Boolean).join('\n\n'); };
    if (!ai) return '<p>' + B.esc(klar(String(txt).replace(/\s+/g, ' ').slice(0, kurz ? 900 : 2400))) + '</p>';
    var h = '', urteil = ai.empfehlung || ai.recommendation || '', off = ai.kaufpreis_offerte || ai.offerte || ai.kaufpreisempfehlung, offBeg = null;
    if (off && typeof off === 'object') { offBeg = off.begruendung || null; off = off.empfohlen || off.betrag || off.wert || null; }
    var kz = [];
    /* v3181 · Marcel 04.11.2026: „im bank pdf steht ein urteil halten das muss raus. das bewerten wir nicht ob wir
       es halten. im bestand entscheiden wir das selber." Kein Urteil in Bank- und Kurzfassung und nie im Bestand;
       die Kaufpreis-Offerte (Verhandlungsposition) geht ebenfalls nicht an die Bank. */
    var bestand = false; try { bestand = !!(window.DpBestand && DpBestand.istBestand()); } catch (e) {}
    var ohneUrteil = bank || kurz || bestand;
    if (urteil && !ohneUrteil && on('Gesamtbewertung')) kz.push({ l: 'Urteil', v: klar(urteil).slice(0, 40), art: 'hi' });
    if (off && !bank && !kurz && !bestand && on('Kaufpreis-Offerte')) kz.push({ l: 'Kaufpreis-Offerte', v: typeof off === 'number' ? B.eur(off) : klar(off).slice(0, 40) });
    if (kz.length) h += B.kacheln(kz, true);
    var gb = ai.gesamtbewertung || ai.fazit_kurz;
    /* der Urteilssatz steckt auch im Text („sollte im Bestand gehalten werden") - _dpOhneUrteil nimmt ihn heraus (pdf.js v3018a) */
    if (gb && ohneUrteil && urteil && typeof window._dpOhneUrteil === 'function') gb = window._dpOhneUrteil(gb, urteil);
    /* auch die Handlungssaetze ohne das Urteilswort (gemessen Westerfeld: „… sollte im Bestand gehalten und stufenweise
       modernisiert werden") - ein Satz faellt, wenn er eine Handlung (halten, verkaufen, kaufen) mit sollte/empfehlen/geeignet verbindet */
    if (gb && ohneUrteil) gb = String(gb).split(/(?<=[.!?])\s+/).filter(function (x) {
      return !(/(halten|gehalten|verkauf|kaufen|gekauft|buy-&-hold|einstieg)/i.test(x) && /(sollte|empfehl|geeignet|lohnt|ratsam)/i.test(x));
    }).join(' ');
    if (!kurz) h += block('Gesamtbewertung', gb, '');
    /* v3180d · untereinander statt zweispaltig: im Blocksatz ohne Silbentrennung (Server-Chrome hat kein Trennwoerterbuch) rissen die schmalen Spalten Luecken */
    h += liste('Stärken', ai.staerken || ai.strengths) + liste('Risiken', ai.risiken || ai.schwaechen || ai.risks, 'Schwächen');
    if (!kurz && !bank && ai.risikoanalyse && typeof ai.risikoanalyse === 'object') {   /* v3180c · Bank: steht in Risiken und Belastungsprobe */
      var ra = ai.risikoanalyse;
      h += liste('Risikoanalyse', [ra.finanzierungsrisiko ? 'Finanzierungsrisiko: ' + ra.finanzierungsrisiko : null, ra.cashflow_stabilitaet ? 'Cashflow-Stabilität: ' + ra.cashflow_stabilitaet : null,
        ra.annahmen_abhaengigkeit ? 'Abhängigkeit von Annahmen: ' + ra.annahmen_abhaengigkeit : null, 'Gerechnete Schuldendeckung je Zins- und Mietszenario: siehe Belastungsprobe.'].filter(Boolean));
    }
    var best = false; try { best = !!(window.DpBestand && DpBestand.istBestand()); } catch (e) {}
    if (!best || kurz || bank) h += liste('Bankargumente', ai.bankargumente, 'Was für die Finanzierung spricht');
    var gedeckt = !best && typeof window._dpPdfGedeckt === 'function' && window._dpPdfGedeckt('Anschlussfinanzierung (Ankauf)', { phasen: true });
    /* v3180c · Bank: die Anschlussfinanzierung steht GERECHNET unter „Finanzierung in drei Phasen“ und „Zinsänderungsrisiko“ */
    if (!kurz && !bank && !gedeckt) h += block('Anschlussfinanzierung', [qa(ai.anschlussfinanzierung), best && ai.bankargumente && ai.bankargumente.length ? 'Was für die Finanzierung spricht:\n' + ai.bankargumente.map(function (x) { return '– ' + x; }).join('\n') : ''].filter(Boolean).join('\n'));
    if (!kurz) {
      if (!bank) h += block('Exit-Strategien', qa(ai.exit_strategien));   /* v3180c · Anlegerthema (Spekulationsfrist), nicht fuer die Bank */
      h += block('Lage & Markt', [ai.makrolage_recherche ? 'Makrolage: ' + ai.makrolage_recherche : '', ai.mikrolage_recherche ? 'Mikrolage: ' + ai.mikrolage_recherche : '', ai.kaufpreisniveau ? 'Kaufpreisniveau: ' + ai.kaufpreisniveau : ''].filter(Boolean).join('\n'));
      if (!bank && !bestand) h += block('Kaufpreis-Offerte', offBeg);
      /* v3180c · Bank: die Begruendung wiederholt die Gesamtbewertung (gemessen Westerfeld: beide beginnen mit Rendite und Cashflow) */
      if (ai.empfehlung_begruendung && !(bank && (ai.gesamtbewertung || ai.fazit_kurz))) h += block('Begründung des Urteils', typeof window._dpOhneUrteil === 'function' ? window._dpOhneUrteil(ai.empfehlung_begruendung, urteil) : ai.empfehlung_begruendung);
    }
    if (ai.fazit || ai.summary) { var fz = klar(ai.fazit || ai.summary); if (kurz && fz.length > 600) { var e2 = fz.slice(0, 600).lastIndexOf('. '); fz = e2 > 200 ? fz.slice(0, e2 + 1) : fz.slice(0, 600) + ' …'; } h += '<div class="hinweis">' + B.esc(fz) + '</div>'; }
    return h + '<p class="det">Erzeugt von einem Sprachmodell aus den erfassten Angaben – eine Einschätzung, keine Beratung.</p>';
  }
  function annahmenVoll(K, B, kurz) {
    var S = St(), dg = null; try { dg = window.DpDetailgrad && DpDetailgrad.annahmen ? DpDetailgrad.annahmen() : null; } catch (e) {}
    var z = [['Mietentwicklung', typeof window._dpPdfMiete === 'function' ? window._dpPdfMiete().text : B.pct(zahlAus('mietstg'), 1)], ['Kostensteigerung p. a.', B.pct(zahlAus('kostenstg'), 1)],
      ['Wertsteigerung p. a.', B.pct(zahlAus('wertstg'), 1)], ['Betrachtungszeitraum', S.btj ? S.btj + ' Jahre' : '–']];
    if (zahlAus('leerstand') != null) z.push(['Kalkulierter Leerstand p. a.', B.pct(zahlAus('leerstand'), 1)]);
    z.push(['Anschlusszins · Anschlusstilgung (Annahme)', B.pct(zahlAus('anschl_z'), 2) + ' · ' + B.pct(zahlAus('anschl_t'), 2)], ['Persönlicher Grenzsteuersatz', B.pct(zahlAus('grenz'), 2)],
      ['Gebäudeanteil am Kaufpreis', B.pct(zahlAus('geb_ant'), 0)], ['AfA-Satz Gebäude', zahlAus('afa_satz') != null ? B.pct(zahlAus('afa_satz'), 2) : (feld('afa_satz') || '–')], ['Grunderwerbsteuer (Land)', B.pct(zahlAus('gest_p'), 2)]);
    if (zahlAus('exit_bmy') != null) z.push(['Exit-Rendite (Verkaufsszenario)', B.pct(zahlAus('exit_bmy'), 1)]);
    if (da(S.wert_basis) !== null && S.wert_basis !== K.kp) z.push(['Wert-Anker der Wertsteigerung', (svwText(S.wert_basis_text) || (zahlAus('svwert') ? 'Verkehrswert' : 'Bankbewertung')) + ' · ' + B.eur(S.wert_basis)]);
    if (K.d1IsAussetzung) z.push(['Darlehenstyp', 'Tilgungsaussetzung mit Bausparvertrag']);
    var h = '<div class="block"><h3>Annahmen</h3>' + B.liste(z) + '</div>';
    if (dg && dg.stufe < 3 && (dg.zeilen.length || dg.neutral || dg.weitere)) {
      var schon = { mietstg: 1, wertstg: 1, kostenstg: 1, leerstand: 1, anschl_z: 1, anschl_t: 1, exit_bmy: 1, btj: 1, afa_satz: 1, geb_ant: 1, grenz: 1, gest_p: 1 };
      var dz = dg.zeilen.filter(function (x) { return !schon[x.id]; }).map(function (x) { return [x.label, x.wert + ' · ' + x.quelle]; });
      if (dg.neutral) dz.push(['Score-Merkmale ohne Angabe', dg.neutral + ' · neutral (60 Punkte)']);
      if (dg.weitere) dz.push(['Weitere ausgeblendete Angaben', dg.weitere + ' · im Objekt erfasst oder abgeleitet']);
      h += '<div class="block"><h3>Detailgrad ' + B.esc(dg.name) + ' · Werte aus Vorgaben</h3>' + B.liste(dz) + '</div>';
    }
    return h + '<div class="block"><h3>Grundlagen und Hinweise</h3><p>Alle Werte beruhen auf den im Objekt erfassten Angaben und den dort hinterlegten Annahmen (Mietentwicklung, Bewirtschaftungskosten, Zins und Tilgung). Sie sind eine Kalkulation, kein Wertgutachten nach § 194 BauGB und keine Anlage- oder Finanzierungsberatung. Der LTV bezieht sich auf '
      + B.esc(S.ltv_basis_label || 'die angegebene Bezugsgröße') + '.</p>'
      + (kurz ? '<p class="det">Kurzfassung: die Bankfassung enthält zusätzlich die Bewirtschaftung im Einzelnen, die drei Finanzierungsphasen, den Cashflow je Jahr, die Mieterliste, das Wertpotenzial, die Diagramme, die Belastungsprobe und den Vermögenszuwachs im Detail.</p>' : '') + '</div>';
  }

  async function investment(art) {
    /* v4580 · erst den Potenzial-Lauf abwarten: bei aufgeteilten Häusern hängt der maßgebende Wert (calc.js) an ihm. Danach neu rechnen,
       sonst nannte das PDF den Wertpuffer und den Vermögensaufbau noch zum Ertragswert des Hauses. */
    var PZ0 = window.DpPotenzial;
    try { if (PZ0 && PZ0.modell && PZ0.modell().aktiv) { await Promise.race([PZ0.rechnen(), new Promise(function (f) { setTimeout(f, 40000); })]); if (typeof window.calcNow === 'function') window.calcNow(); } } catch (e0) {}
    var B = D(), K = (window.State && State.kpis) || {}, o = objektKopf(), key = window._currentObjKey;
    var kurz = art === 'kurz', bank = art === 'bank';
    var name = kurz ? 'Investment Case · Kurzfassung' : 'Investment Case';   /* v3184: die vollständige Fassung ist die (frühere) Bankfassung */
    var SC = scoreDaten(K);
    var z = await Promise.all([basis(name), objektInfo(key, o.adresse)]);
    var c = z[0], info = z[1], fotos = info.fotos; c.zeile = o.adresse; o.seq = info.seq || o.seq;
    /* Wertpotenzial und Wert & Zielbild: dieselben Quellen und Fristen wie pdf-investment-bank.js */
    var PD = null, WZ = null, PZ = window.DpPotenzial;
    try { if (PZ && PZ.modell && PZ.modell().aktiv) { await Promise.race([PZ.rechnen(), new Promise(function (f) { setTimeout(f, 40000); })]); PD = PZ.pdfDaten(); } } catch (e) { PD = null; }
    try { if (window.DpPdfWertZielbild) WZ = await DpPdfWertZielbild.daten({ potenzial: PD }); } catch (e) { WZ = null; }
    var interp = null; try { var SCk = window.DealScore && DealScore.computeFromKpis ? DealScore.computeFromKpis(K) : null; if (SCk && SCk.score === SC.score) interp = SCk.interpretation; } catch (e) {}
    var S = [], nr = 0, ab = function (t) { nr++; return 'Abschnitt ' + nr; };
    S.push(B.deckblatt(c, { bild: fotos[0] || info.karte || null, eyebrow: name, titel: o.adresse, unter: [o.art, o.wfl ? B.zahl(o.wfl, 0) + ' m² Wohnfläche' : '', o.bj ? 'Baujahr ' + B.jahr(o.bj) : ''].filter(Boolean).join(' · '),
      kz: [{ l: 'Kaufpreis', v: B.eur(K.kp) }, { l: 'Gesamtinvestition', v: B.eur(K.gi) }, { l: 'Eigenkapital', v: B.eur(K.ek) }, { l: 'Bruttomietrendite', v: B.pct(K.bmy, 2), art: 'hi' }],
      meta: [['Objekt-Nr.', o.seq || '–'], ['Stand', c.stand], [SC.investor ? 'Investor Deal Score' : 'Deal Score', SC.score != null ? B.zahl(SC.score, 0) + ' · ' + (SC.label || '') + (scTeile(SC) ? ' (' + scTeile(SC) + ')' : '') : '–']],
      zitat: feld('thesis') || '', hinweisRechts: (bank || kurz) ? 'Finanzierungsunterlage' : 'Vertraulich' }));
    /* Überblick */
    S.push(B.seite(c, 'Überblick', B.abschnitt('Executive Summary', 'Investitionsüberblick', o.adresse + ' · ' + o.art)
      + '<div class="zwei"><div>' + B.scoreRing(SC.score, SC.label) + (scTeile(SC) ? '<p class="det">Investor Deal Score: ' + B.esc(scTeile(SC)) + '</p>' : '') + '</div><div>' + B.kacheln([{ l: 'CF n. St. Jahr 1', v: B.eurS(K.cf_ns), art: (K.cf_ns || 0) >= 0 ? 'gut' : 'schlecht' }, { l: 'CF n. St. Ende Zinsbindung', v: B.eurS(K.cf_ns_ezb) }]).replace('class="kz"', 'class="kz" style="grid-template-columns:1fr 1fr"') + '</div></div>'
      + '<h3>Kennzahlen</h3>' + kennzahlen12(K, B, SC) + (interp && !kurz ? '<div class="hinweis">Einordnung: ' + B.esc(String(interp).replace(/\s+/g, ' ')) + '</div>' : '')
      + (kurz ? '' : ansprechpartner(c, B))));
    /* Objekt und Finanzierung */
    var galerie = (!kurz && fotos.length > 1) ? '<h3>Objektfotos</h3><div class="galerie">' + fotos.slice(1, 5).map(function (f) { return '<img src="' + f + '" alt="">'; }).join('') + '</div>' : '';
    S.push(B.seite(c, 'Objekt und Finanzierung', B.abschnitt(ab(), 'Objekt und Finanzierung')
      + '<div class="kv">' + [['Objektart', o.art], ['Baujahr', B.jahr(o.bj)], ['Wohnfläche', o.wfl ? B.zahl(o.wfl, 0) + ' m²' : '–'], ['Grundstück', o.gs ? B.zahl(o.gs, 0) + ' m²' : '–'],
        ['Kaufdatum', B.datum(feld('kaufdat')) || '–'], ['Energieklasse', feld('ds2_energie') || '–']].map(function (k) { return '<div><span>' + k[0] + '</span><span>' + B.esc(k[1]) + '</span></div>'; }).join('') + '</div>'
      + finanzierungVoll(K, B, kurz) + (kurz ? '' : gesellschaft(B))));
    if (galerie || (!kurz && feld('ds2_energie'))) S.push(B.seite(c, 'Ansichten', B.abschnitt(ab(), 'Ansichten und Energie') + galerie + (feld('ds2_energie') ? '<h3>Energieeffizienz</h3>' + B.energieSkala(feld('ds2_energie')) : '')));
    /* Ertrag */
    S.push(B.seite(c, 'Ertrag und Cashflow', B.abschnitt(ab(), 'Von der Warmmiete zum Cashflow', 'Laufendes Jahr') + ertragKette(K, B)
      + (kurz ? steuerWirkung(K, B) + bankCockpit(B, true) + zuwachsKurz(B) : '<div class="zwei"><div>' + bewirtschaftungDetail(K, B) + '</div><div>' + steuerWirkung(K, B) + '</div></div>')));
    if (!kurz) {
      S.push(B.seite(c, 'Drei Phasen', B.abschnitt(ab(), 'Finanzierung in drei Phasen', 'Jahr 1, Ende der Zinsbindung und Anschlussfinanzierung') + dreiPhasen(K, B) + phasenVoll(K, B)));
      S.push(B.seite(c, 'Cashflow je Jahr', B.abschnitt(ab(), 'Cashflow je Jahr', (St().cfRows || []).length + ' Jahre') + cfJahre(B)));
      S.push(B.seite(c, 'Vermögensaufbau', B.abschnitt(ab(), 'Vermögensaufbau', 'Wert, Restschuld und Eigenkapital') + vermoegenVoll(K, B)));
      var ml = mieterliste(K, B);
      if (ml) S.push(B.seite(c, 'Einheiten und Zustand', B.abschnitt(ab(), 'Einheiten und Zustand') + ml));
    }
    var wz = wertZielbild(K, B, WZ, PD, kurz, bank);
    if (wz) {
      var mitZiel = WZ ? !WZ.ohneZiel : !!(PD && PD.hat_ziel !== false);
      S.push(B.seite(c, mitZiel ? 'Wert & Zielbild' : 'Wert & Potenzial', B.abschnitt(ab(), mitZiel ? 'Wert & Zielbild' : (PD ? 'Wert & Potenzial' : 'Wert je Verfahren'),
        'Was das Objekt nach den Verfahren der Immobilienwertermittlung wert ist, im Vergleich zum Kaufpreis' + (mitZiel ? ' – und wohin sich der Ertragswert mit Mieterhöhung und Zielbild entwickelt.' : '.')) + wz));
    }
    if (!kurz) {
      var bc = bankCockpit(B, false), sm = stressMatrix(B);
      if (bc || sm) S.push(B.seite(c, 'Bank-Cockpit und Belastungsprobe', B.abschnitt(ab(), 'Bank-Cockpit und Belastungsprobe', 'Schuldendienstdeckung und Beleihungsauslauf im Verlauf, DSCR unter Zins- und Mietstress') + bc + sm));
    }
    var pa = pilotAnalyse(B, kurz, bank);
    if (pa) S.push(B.seite(c, 'Gesamtbewertung', B.abschnitt(ab(), 'Gesamtbewertung') + pa));   /* v4390b */
    S.push(B.seite(c, 'Annahmen', B.abschnitt('Anhang', 'Annahmen und Hinweise') + annahmenVoll(K, B, kurz)));
    return B.dokument(name + ' · ' + o.adresse, S);
  }

  /* ── v4580 · MUSTER: Investment-PDF neu geordnet und Kurzfassung für die Bank ─────────────────────────────────────────
     Marcel 24.11.2026: „das Deckblatt können wir lassen … vernünftiges Inhaltsverzeichnis, sauber strukturieren, einen Überblick auch
     mit Bildern, mit der Energieeffizienz … Finanzierung in den Phasen … Kennzahlen, Cashflow je Jahr, die Projektion, die Graphen …
     mit den Tabellen … Einheiten und Zustand, Wert und Zielbild.“ Und zur Kurzfassung: eine Bank liest sie und sagt „könnten wir
     drüber nachdenken“, mit dem vollen PDF geht man ins Gespräch. Am 24.11. hat er eine ausgedünnte Fassung als „zu dünn“
     abgelehnt: die volle Fassung streicht NICHTS, sie ordnet nur. Erreichbar nur über DpDokumente.dokument('investment_muster' |
     'kurz_muster'), kein Knopf. Erst nach Marcels Freigabe der Muster ersetzt sie die bisherigen Fassungen. */
  function inhaltSeite(c, B, teile) {
    /* v4790e · Marcel 25.11.2026: „Bitte bei den PDFs das Inhaltsverzeichnis auf eine Seite.“ Ab 12 Einträgen ohne Unterzeile und mit engem
       Zeilenabstand, dann passen bis 26 Einträge auf eine Seite. Die Seitenzahlen setzt weiter der PDF-Dienst (data-dp-toc). */
    var eng = teile.length > 11, pad = eng ? 'padding-top:1.1mm;padding-bottom:1.1mm' : '';   /* v4870 · Kombi wie Kurzfassung: Unterzeile bleibt, nur enger */
    return B.seite(c, 'Inhalt', B.abschnitt('Investment Case', 'Inhalt')
      + '<table class="inhalt"><tbody>' + teile.map(function (t, i) {
        /* v4580g · Marcel: „die PDFs brauchen auch Seitenzahlen im Inhaltsverzeichnis.“ Der PDF-Dienst (pdf-dienst/server.js) zählt je
           Abschnitt (data-dp-abschnitt) die gedruckten Seiten und setzt die Startseite in data-dp-toc. Ohne Dienst bleibt die Spalte leer. */
        return '<tr><td class="num" style="width:12mm;color:var(--gold-d);font-weight:700;' + pad + '">' + (t[2] || (i + 1)) + '</td><td style="' + pad + '"><b>' + B.esc(t[0]) + '</b>' + (!t[1] ? '' : '<div class="det"' + (eng ? ' style="font-size:7pt;line-height:1.25;margin:.3mm 0 0"' : '') + '>' + B.esc(t[1]) + '</div>') + '</td>'
          + '<td class="r num" style="width:16mm;vertical-align:top;' + pad + '"><span data-dp-toc="' + B.esc(t[3] || '') + '"></span></td></tr>';
      }).join('') + '</tbody></table>');
  }
  function cfDiagramm(B) {
    var rows = St().cfRows || []; if (rows.length < 2) return '';
    return B.linien([
      { name: 'Cashflow vor Steuern', klasse: 'l1', werte: rows.map(function (r) { return { x: Number(r.cal || r.y), y: r.cfop_y }; }) },
      { name: 'Cashflow nach Steuern', klasse: 'l3', werte: rows.map(function (r) { return { x: Number(r.cal || r.y), y: r.cfns_y }; }) }
    ], { null: true, h: 150, fmt: function (v) { return B.zahl(v / 1000, 1) + ' T€'; }, titel: 'Cashflow je Jahr' });
  }
  function aufWert(WZ) { return ((WZ && WZ.verfahren) || []).filter(function (v) { return v.art === 'auf' && da(v.mitte) !== null; })[0] || null; }
  function aufteilungZeile(B, WZ) {
    var a = aufWert(WZ); if (!a) return '';
    return '<p class="det">In Wohnungseigentum aufgeteilt. Zusätzlich angegeben: Wert nach Aufteilung ' + B.esc(B.eur(a.mitte)) + ' (Vergleichswert je Wohnung nach Aufteilungskosten). Gerechnet wird mit dem Wert des Hauses als Ganzes.</p>';
  }
  function ersterSatz(t) { t = klar(t); var e = t.indexOf('. '); return e > 40 ? t.slice(0, e + 1) : t; }
  async function investmentMuster(art) {
    var kurz = art === 'kurz';
    var PZ0 = window.DpPotenzial;
    try { if (PZ0 && PZ0.modell && PZ0.modell().aktiv) { await Promise.race([PZ0.rechnen(), new Promise(function (f) { setTimeout(f, 40000); })]); if (typeof window.calcNow === 'function') window.calcNow(); } } catch (e0) {}
    var B = D(), K = (window.State && State.kpis) || {}, o = objektKopf(), key = window._currentObjKey, S0 = St();
    var name = kurz ? 'Investment Case · Kurzfassung' : 'Investment Case';
    var SC = scoreDaten(K);
    var z = await Promise.all([basis(name), objektInfo(key, o.adresse)]);
    var c = z[0], info = z[1], fotos = info.fotos; c.zeile = o.adresse; o.seq = info.seq || o.seq;
    var PD = null, WZ = null, PZ = window.DpPotenzial;
    try { if (PZ && PZ.modell && PZ.modell().aktiv) PD = PZ.pdfDaten(); } catch (e) { PD = null; }
    try { if (window.DpPdfWertZielbild) WZ = await DpPdfWertZielbild.daten({ potenzial: PD }); } catch (e) { WZ = null; }
    var mw = massgebend(B);
    var deck = B.deckblatt(c, { bild: fotos[0] || info.karte || null, eyebrow: name, titel: o.adresse, unter: [o.art, o.wfl ? B.zahl(o.wfl, 0) + ' m² Wohnfläche' : '', o.bj ? 'Baujahr ' + B.jahr(o.bj) : ''].filter(Boolean).join(' · '),
      kz: [{ l: 'Kaufpreis', v: B.eur(K.kp) }, mw ? { l: mw.name, v: B.eur(mw.wert), s: 'führendes Verfahren' } : { l: 'Gesamtinvestition', v: B.eur(K.gi) }, { l: 'Eigenkapital', v: B.eur(K.ek) }, { l: 'Bruttomietrendite', v: B.pct(K.bmy, 2), art: 'hi' }],
      meta: [['Objekt-Nr.', o.seq || '–'], ['Stand', c.stand], [SC.investor ? 'Investor Deal Score' : 'Deal Score', SC.score != null ? B.zahl(SC.score, 0) + ' · ' + (SC.label || '') + (scTeile(SC) ? ' (' + scTeile(SC) + ')' : '') : '–']],
      zitat: feld('thesis') || '', hinweisRechts: 'Finanzierungsunterlage' });
    var steck = '<div class="kv">' + [['Objektart', o.art], ['Baujahr', B.jahr(o.bj)], ['Wohnfläche', o.wfl ? B.zahl(o.wfl, 0) + ' m²' : '–'], ['Grundstück', o.gs ? B.zahl(o.gs, 0) + ' m²' : '–'],
      ['Kaufdatum', B.datum(feld('kaufdat')) || '–'], ['Energieklasse', feld('ds2_energie') || '–']].map(function (k) { return '<div><span>' + k[0] + '</span><span>' + B.esc(k[1]) + '</span></div>'; }).join('') + '</div>';
    var bild = fotos[0] || info.karte || null;
    var mpiV = (WZ && WZ.verfahren || []).filter(function (v) { return v.art === 'mpi' && da(v.mitte) !== null; })[0] || null;
    var kern9 = B.kacheln([
      mw ? { l: mw.name + ' · führend', v: B.eur(mw.wert), s: mw.det } : (mpiV ? { l: 'Marktpreisindikation', v: B.eur(mpiV.mitte), s: 'aus Angebotspreisen, kein Verkehrswert' } : null),
      { l: 'Kaufpreis', v: B.eur(K.kp), s: K.gi ? 'Gesamtinvestition ' + B.eur(K.gi) : '' },
      aufWert(WZ) ? { l: 'Wert nach Aufteilung', v: B.eur(aufWert(WZ).mitte), s: 'zusätzliche Angabe, rechnet nicht mit' } : null,
      { l: 'Kaltmiete p. a.', v: B.eur(K.nkm_j), s: 'Bruttomietrendite ' + B.pct(K.bmy, 2) },
      { l: 'DSCR', v: B.zahl(K.dscr, 2), s: 'Schuldendienstdeckung', art: K.dscr >= 1.2 ? 'gut' : 'schlecht' },
      { l: 'LTV', v: B.pct(K.ltv, 1), s: S0.ltv_basis_label ? 'auf ' + S0.ltv_basis_label : '' },
      { l: 'Eigenkapital', v: B.eur(K.ek), s: B.zahl(K.gi ? K.ek / K.gi * 100 : 0, 1) + ' % der Gesamtinvestition' },
      { l: 'Cashflow vor Steuern', v: B.eurS(K.cf_m), s: 'je Monat', art: (K.cf_m || 0) >= 0 ? 'gut' : 'schlecht' },
      { l: 'Cashflow nach Steuern', v: B.eurS(K.cf_ns), s: 'im Jahr', art: (K.cf_ns || 0) >= 0 ? 'gut' : 'schlecht' },
      scKachel(B, SC)
    ].filter(Boolean), true);
    var Sx = [deck];
    if (kurz) {
      /* Kurzfassung: Auf einen Blick, Kernaussagen mit Vermögensaufbau, Finanzierung mit DSCR und LTV, Annahmen */
      Sx.push(B.seite(c, 'Auf einen Blick', B.abschnitt('Kurzfassung', 'Auf einen Blick', o.adresse + ' · ' + o.art)
        + '<div class="zwei"><div>' + steck + (feld('ds2_energie') ? B.energieSkala(feld('ds2_energie')) : '') + '</div><div>'
        + (bild ? '<img class="karte" src="' + bild + '" alt="" style="height:58mm;width:100%;object-fit:cover">' : '') + '</div></div>'
        + '<h3>Die wichtigsten Zahlen</h3>' + kern9 + aufteilungZeile(B, WZ)));
      /* Punkte aus den gerechneten Zahlen, nicht aus dem KI-Text: der kann älter sein als die Zahlen (gemessen Westerfeldstr. 146:
         „Cashflow nach Steuer 6.447 €“ im Text, 4.936 € in der Kachel darüber). Eine Bank liest hier jede Zahl nach. */
      var pk = [], rk = [], sw0 = window.DealPilotSchwellen ? DealPilotSchwellen.get() : {}, dg = Number(sw0.dscrGruen) > 0 ? Number(sw0.dscrGruen) : 1.2;
      if (mw && K.kp && mw.wert > K.kp) pk.push('Der Kaufpreis liegt ' + B.eur(mw.wert - K.kp) + ' (' + B.pct((mw.wert - K.kp) / mw.wert * 100, 1) + ') unter dem ' + mw.name + '.');
      if (da(K.bmy) !== null) pk.push('Bruttomietrendite ' + B.pct(K.bmy, 2) + ' auf den Kaufpreis, Kaufpreisfaktor ' + B.zahl(K.fak, 1) + '.');
      if ((K.cf_m || 0) >= 0) pk.push('Die Miete trägt Zins, Tilgung und Bewirtschaftung: Cashflow vor Steuern ' + B.eurS(K.cf_m) + ' im Monat.');
      if (da(K.dscr) !== null && K.dscr >= dg) pk.push('DSCR ' + B.zahl(K.dscr, 2) + ', über der üblichen Schwelle von ' + B.zahl(dg, 2) + '.');
      if (mw && K.kp > mw.wert) rk.push('Der Kaufpreis liegt ' + B.pct((K.kp - mw.wert) / mw.wert * 100, 1) + ' über dem ' + mw.name + '.');
      if (!mw && mpiV && K.kp > mpiV.mitte) rk.push('Der Kaufpreis liegt ' + B.pct((K.kp - mpiV.mitte) / mpiV.mitte * 100, 1) + ' über der Marktpreisindikation (' + B.eur(mpiV.mitte) + ').');
      if (da(K.dscr) !== null && K.dscr < dg) rk.push('DSCR ' + B.zahl(K.dscr, 2) + ', unter der üblichen Schwelle von ' + B.zahl(dg, 2) + '.');
      if (da(K.ltv) !== null && K.ltv > 80) rk.push('Beleihungsauslauf ' + B.pct(K.ltv, 1) + (S0.ltv_basis_label ? ' auf ' + S0.ltv_basis_label : '') + (mw && mw.wert > 0 && zahlAus('d1') ? ', auf den ' + mw.name + ' ' + B.pct(zahlAus('d1') / mw.wert * 100, 1) : '') + '.');
      if (da(K.rate_an_m) !== null && da(K.cf_op_an) !== null) rk.push('Nach der Zinsbindung (Annahme ' + B.pct(zahlAus('anschl_z'), 2) + ') Rate ' + B.eur(K.rate_an_m) + ' im Monat, Cashflow vor Steuern ' + B.eurS(K.cf_op_an / 12) + ' im Monat.');
      var kernH = (WZ && WZ.kern && WZ.kern.length) ? B.kacheln(WZ.kern.filter(function (k) { return /\d/.test(k.wert_text || ''); }).slice(0, 6).map(function (k) { return { l: k.titel, v: k.wert_text || '' }; }), true) : '';
      var punkte = function (titel, arr) { return arr.length ? '<h3>' + titel + '</h3><ul>' + arr.map(function (x) { return '<li>' + B.esc(ersterSatz(x)) + '</li>'; }).join('') + '</ul>' : ''; };
      Sx.push(B.seite(c, 'Kernaussagen', B.abschnitt('Kurzfassung', 'Kernaussagen') + kernH + punkte('Was dafür spricht', pk) + punkte('Worauf zu achten ist', rk)
        + '<h3>Vermögensaufbau</h3>' + (gbKarte('_aufbauHtml') || '') + '<p class="det">Objektwert fortgeschrieben mit der angenommenen Wertsteigerung, keine Bewertung nach § 194 BauGB.</p>'));
      var dl = darlehen();
      var dlT = '<table class="dicht"><thead><tr><th>Darlehen</th><th class="r">Betrag</th><th class="r">Zins</th><th class="r">Tilgung</th><th class="r">Bindung</th><th class="r">Rate / Monat</th></tr></thead><tbody>'
        + dl.map(function (d) { return '<tr><td>' + B.esc(d.name) + '</td><td class="r num">' + B.eur(d.betrag) + '</td><td class="r num">' + B.pct(d.zins, 2) + '</td><td class="r num">' + B.pct(d.tilg, 2) + '</td><td class="r num">' + (d.bind ? B.zahl(d.bind, 0) + ' J.' : '–') + '</td><td class="r num">' + B.eur(d.rate, 0) + '</td></tr>'; }).join('')
        + '</tbody></table>';
      Sx.push(B.seite(c, 'Finanzierung', B.abschnitt('Kurzfassung', 'Finanzierung und Tragfähigkeit') + dlT + dreiPhasen(K, B) + bankCockpit(B, true)
        + '<p class="det">Mit dem vollständigen Investment Case gehen wir gern ins Gespräch: Einheiten, Wertermittlung, Cashflow je Jahr, Belastungsprobe und Annahmen im Einzelnen.</p>'));
      Sx.push(B.seite(c, 'Annahmen', B.abschnitt('Anhang', 'Annahmen') + annahmenVoll(K, B, true)));
      return B.dokument(name + ' · ' + o.adresse, Sx);
    }
    /* volle Fassung: dieselben Bausteine wie investment('voll'), neu geordnet, mit Inhaltsverzeichnis */
    _knapp = true;
    try {
      var T = [], P = [];
      var add = function (titel, unter, html) { if (!html) return; T.push([titel, unter, null, 'a' + (T.length + 1)]); P.push([titel, html]); };
      add('Überblick', 'Deal Score, Kennzahlen, Ansprechpartner', '<div class="zwei"><div>' + B.scoreRing(SC.score, SC.label) + (scTeile(SC) ? '<p class="det">Investor Deal Score: ' + B.esc(scTeile(SC)) + '</p>' : '') + '</div><div>'
        + B.kacheln([{ l: 'CF n. St. Jahr 1', v: B.eurS(K.cf_ns), art: (K.cf_ns || 0) >= 0 ? 'gut' : 'schlecht' }, { l: 'CF n. St. Ende Zinsbindung', v: B.eurS(K.cf_ns_ezb) }]).replace('class="kz"', 'class="kz" style="grid-template-columns:1fr 1fr"') + '</div></div>'
        + '<h3>Kennzahlen</h3>' + kennzahlen12(K, B, SC) + aufteilungZeile(B, WZ) + ansprechpartner(c, B));
      var gal = fotos.length > 1 ? '<h3>Objektfotos</h3><div class="galerie">' + fotos.slice(1, 5).map(function (f) { return '<img src="' + f + '" alt="">'; }).join('') + '</div>' : '';
      add('Objekt', 'Steckbrief, Ansichten, Energieeffizienz', steck + (bild ? '<img class="karte" src="' + bild + '" alt="" style="height:70mm;width:100%;object-fit:cover;margin-top:3mm">' : '') + gal
        + (feld('ds2_energie') ? '<h3>Energieeffizienz</h3>' + B.energieSkala(feld('ds2_energie')) : '') + gesellschaft(B));
      add('Einheiten und Zustand', 'Mieterliste, Ist gegen Soll, Modernisierung', mieterliste(K, B));
      add('Wert und Zielbild', 'Werte je Verfahren, Wert je Wohnung, Wertüberleitung, Kennzahlen je Stufe', wertZielbild(K, B, WZ, PD, false, false));
      add('Investition und Finanzierung', 'Investition, Darlehen, drei Phasen', finanzierungVoll(K, B, false)
        + '<h3 style="break-before:page;page-break-before:always">Finanzierung in drei Phasen</h3>' + dreiPhasen(K, B) + phasenVoll(K, B));
      add('Ertrag und Kennzahlen', 'Von der Warmmiete zum Cashflow, Bewirtschaftung, Steuer', ertragKette(K, B)
        + '<div class="zwei"><div>' + bewirtschaftungDetail(K, B) + '</div><div>' + steuerWirkung(K, B) + '</div></div>');
      add('Cashflow je Jahr', (St().cfRows || []).length + ' Jahre als Grafik und Tabelle', '<div class="block"><h3>Cashflow vor und nach Steuern</h3>' + cfDiagramm(B) + '</div>' + cfJahre(B));
      add('Projektion und Vermögen', 'Wert, Restschuld, Eigenkapital, Zuwachs, Exit', vermoegenVoll(K, B));
      var bc = bankCockpit(B, false), sm = stressMatrix(B);
      add('Bank-Cockpit und Belastungsprobe', 'DSCR und LTV im Verlauf, Zins- und Mietstress', (bc || '') + (sm || ''));
      add('Gesamtbewertung', 'Gesamtbewertung, Stärken, Schwächen, Lage und Markt', pilotAnalyse(B, false, false));
      var mark = function (html, k) { return html.replace('<section class="seite', '<section data-dp-abschnitt="' + k + '" class="seite'); };
      Sx.push(inhaltSeite(c, B, T.concat([['Annahmen und Hinweise', 'Annahmen, Grundlagen', 'A', 'anh']])));
      P.forEach(function (p, i) { Sx.push(mark(B.seite(c, p[0], B.abschnitt('Abschnitt ' + (i + 1), p[0]) + p[1]), 'a' + (i + 1))); });
      Sx.push(mark(B.seite(c, 'Annahmen', B.abschnitt('Anhang', 'Annahmen und Hinweise') + annahmenVoll(K, B, false)), 'anh'));
    } finally { _knapp = false; }
    return B.dokument(name + ' · ' + o.adresse, Sx);
  }

  /* ── v4790 · MUSTER: Investment-PDF im Deal-Check-Stil (Marcel 25.11.2026) ─────────────────────────────────────────────
     „Ich finde das PDF super gut gemacht für diesen Einzelcheck … genau so für unser Investment-PDF … Kurzfassung … mit
     Inhaltsverzeichnis und Seitenzahlen … Gesamtbewertung … Finanzierung … mit der Langfassung kombinieren.“ Zusatz: bei
     Ertrags- und Sachwert fehlt der Rechenweg. Drei Fassungen, nur über DpDokumente.dokument('iv_a_muster'|'iv_b_muster'|
     'iv_c_muster'), kein Knopf, bis Marcel wählt. Alle Zahlen aus State.kpis, den Kernen (DpEkRendite, DealScore2, DpPotenzial)
     und dem letzten Stufe-3-Bericht (cross_check.*.staffel), nichts neu gerechnet. */
  function stufe3Bericht() {
    var key = window._currentObjKey; if (!key) return Promise.resolve(null);
    var hol = function (q) { return api('/marktbericht/objects/history?' + q).then(function (h) { return (h && h.history) || []; }).catch(function () { return []; }); };
    return Promise.all([hol('key=' + encodeURIComponent('dp:' + key)), hol('ref=' + encodeURIComponent(key))]).then(function (z) {
      var l = z[0].concat(z[1]).filter(function (x) { return x && x.report_id; });
      l.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      var x = l.filter(function (h) { return String(h.wert_stufe || '') === '3'; })[0] || l[0];
      if (!x) return null;
      return api('/marktbericht/reports/one?id=' + encodeURIComponent(x.report_id)).then(function (r) {
        var p = r && (r.data || r.payload); if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
        if (p && x.created_at && !p.created_at) p._erstellt = x.created_at;
        return p && p.cross_check && p.cross_check.available ? p : null;
      }).catch(function () { return null; });
    });
  }
  /* Rechenweg je gerechnetem Verfahren: Zeilen des Kerns, Herkunft je Parameter, fehlende Zeilen fallen weg.
     kurz: ohne Erläuterungszeilen (Kurzfassung eine Seite), sonst mit Erläuterung je Zeile (Kombi). */
  function rechenweg(B, p, kurz) {
    if (!p) return '';
    var c = p.cross_check || {}, ew = c.ertragswert || {}, sw = c.sachwert || {}, bw = c.bodenwert || {}, lv = p.land_value || {};
    var z = function (v, d) { return da(v) === null ? '' : B.zahl(v, d); };
    var ohneDetail = function (rows) { return rows.map(function (x) { return { pos: x.pos, wert: x.wert, faktor: x.faktor, summe: x.summe }; }); };
    var h = '';
    var bwRows = (bw.schritte || []).map(function (x) { return { pos: x.pos, detail: kurz ? '' : x.detail, wert: x.wert }; });
    if (bwRows.length && da(bw.wert) !== null) bwRows.push({ pos: '= Bodenwert', wert: bw.wert, summe: true });
    if (bwRows.length) h += '<div class="block"><h3>Bodenwert</h3>' + B.staffel(bwRows, bwRows.map(function (x, i) {
      return i === 0 ? 'Bodenrichtwert ' + z(lv.value_sqm, 0) + ' €/m², amtlich' + (lv.stichtag ? ', Stichtag ' + B.datum(lv.stichtag) : '') : (i === bwRows.length - 1 ? '§ 40 ImmoWertV' : '');
    })) + '</div>';
    if (Array.isArray(ew.staffel) && ew.staffel.length && da(ew.value_eur) !== null) {
      var ewQ = ew.staffel.map(function (x) {
        var t = String(x.pos || '');
        if (/^Rohertrag/.test(t)) return 'marktüblich erzielbar' + (da(ew.miete_qm) !== null ? ', ' + z(ew.miete_qm, 2) + ' €/m²' : '');
        if (/Bewirtschaftungskosten/.test(t)) return 'Anlage 3 ImmoWertV bzw. Modell des Ausschusses';
        if (/Bodenwertverzinsung/.test(t)) return 'Liegenschaftszins ' + z(ew.liegenschaftszins_pct, 2) + ' %' + (ew.liegenschaftszins_stufe ? ', Stufe ' + ew.liegenschaftszins_stufe : '');
        if (/Barwertfaktor/.test(t)) return '§ 34 ImmoWertV, Restnutzungsdauer ' + z(ew.restnutzungsdauer_jahre, 1) + ' Jahre';
        if (/Ertragswert/.test(t)) return '§ 28 ImmoWertV';
        return '';
      });
      h += '<div class="block"><h3>Ertragswert</h3>' + B.staffel(kurz ? ohneDetail(ew.staffel) : ew.staffel, ewQ) + '</div>';
    }
    if (Array.isArray(sw.staffel) && sw.staffel.length && da(sw.value_eur) !== null) {
      var swQ = sw.staffel.map(function (x) {
        var t = String(x.pos || '');
        if (/Normalherstellungskosten/.test(t)) return 'NHK 2010, Anlage 4 ImmoWertV';
        if (/Baupreisindex/.test(t)) return 'Baupreisindex zum Stichtag';
        if (/Alterswertminderung/.test(t)) return '§ 38 ImmoWertV, Restnutzungsdauer ' + z(sw.restnutzungsdauer_jahre, 0) + ' von ' + z(sw.gesamtnutzungsdauer_jahre, 0) + ' Jahren';
        if (/Sachwertfaktor/.test(t)) return sw.sachwertfaktor ? 'amtlicher Sachwertfaktor' + (sw.sachwertfaktor.stufe ? ', Stufe ' + sw.sachwertfaktor.stufe : '') : '';
        if (/marktangepasst/.test(t)) return '§ 39 ImmoWertV';
        return '';
      });
      h += '<div class="block"><h3>Sachwert</h3>' + B.staffel(kurz ? ohneDetail(sw.staffel) : sw.staffel, swQ)
        + (sw.sachwertfaktor ? '' : '<p class="det">Für diesen Ort liegt kein Sachwertfaktor vor. Ausgewiesen ist der vorläufige Sachwert ohne Marktanpassung.</p>') + '</div>';
    }
    if (!h) return '';
    var erst = p.created_at || p._erstellt;
    return h + '<p class="det">Zeilen und Werte aus dem DealPilot-Marktbericht der Stufe 3' + (erst ? ' vom ' + B.datum(erst) : '') + '. Stufe A ist ein amtlicher Wert des zuständigen Gutachterausschusses, Stufen darunter sind im Marktbericht einzeln begründet. Indikativ, kein Verkehrswertgutachten nach § 194 BauGB.</p>';
  }
  /* Mietpotenzial nach der App-Regel (DpPotenzial: Bestand über den Kappungspfad bis zum Oberwert, Neuvermietung Oberwert × 1,10 bei Bremse) */
  function mietpotenzial(B, PD) {
    if (!PD || !PD.wohnungen || !PD.wohnungen.length) return '';
    var t = '<table class="dicht"><thead><tr><th>Wohnung</th><th class="r">Fläche</th><th class="r">Ist</th><th class="r">Erhöhung bis (§ 558)</th><th class="r">Zielbild</th></tr></thead><tbody>'
      + PD.wohnungen.map(function (w) { return '<tr><td>' + B.esc(w.we || '') + '</td><td class="r num">' + (w.wfl ? B.zahl(w.wfl, 0) + ' m²' : '–') + '</td><td class="r num">' + B.esc(w.ist) + '</td><td class="r num">' + B.esc(String(w.soll || '').replace(/ ·.*$/, '')) + '</td><td class="r num">' + B.esc(w.ziel) + '</td></tr>'; }).join('')
      + '</tbody></table>';
    var kz = (PD.kennzahlen || []).slice(0, 3).map(function (k) { var werte = PD.spalten.map(function (s) { var v = ''; try { v = k[1](s); } catch (e) { v = ''; } return v; }); if (!werte.some(function (v) { return /\d/.test(v || ''); })) return ''; return '<tr><td>' + B.esc(k[0]) + '</td>' + werte.map(function (v) { return '<td class="r num">' + B.esc(v || '–') + '</td>'; }).join('') + '</tr>'; }).join('');
    var kzT = kz ? '<h3 style="margin-top:5mm">Je Stufe</h3><table class="dicht"><thead><tr><th></th>' + PD.spalten.map(function (s) { return '<th class="r">' + B.esc((PD.titel && PD.titel[s]) || s) + '</th>'; }).join('') + '</tr></thead><tbody>' + kz + '</tbody></table>' : '';
    var li = [];
    if (PD.satz_bank) li.push(klar(PD.satz_bank));
    if (PD.kappung) li.push(klar(PD.kappung));
    li.push('Orientierung, keine Rechtsberatung.');
    return '<p class="sub">Was rechtlich höchstens drin ist, aus Investorensicht: im Bestand bis zum Oberwert der Mietspiegelspanne über die Kappungsgrenze, bei Neuvermietung bis 10 % über dem Oberwert, wo die Mietpreisbremse gilt.</p>'
      + t + kzT + '<ul style="margin-top:4mm">' + li.map(function (x) { return '<li>' + B.esc(x) + '</li>'; }).join('') + '</ul>';
  }
  function ekRenditeSeite(B, K) {
    var r = K.ekr4; if (!r || r.k1 == null) return '';
    var hz = (window.DpEkRendite && DpEkRendite.hebelZeilen) ? DpEkRendite.hebelZeilen(r.hebel) : [];
    return B.kacheln([
      { l: 'Nach Steuer mit Vermögensdelta', v: B.pct(r.k4 != null ? r.k4 : r.k2, 1), s: 'Hauptkennzahl', art: 'hi' },
      { l: 'Operativ', v: B.pct(r.k1, 1), s: 'Überschuss plus Tilgung' },
      { l: 'Nach Steuer', v: B.pct(r.k2, 1), s: 'mit Steuerwirkung' },
      { l: 'Vor Steuer mit Delta', v: r.k3 != null ? B.pct(r.k3, 1) : '–', s: 'mit Wertzuwachs im Jahr' }
    ], true)
      + B.liste([['Eigenkapital', B.eur(r.ek)], ['Überschuss nach Kapitaldienst im Jahr', B.eurS(r.cf_op)], ['Tilgung im Jahr', B.eur((r.tilg || 0) + (r.bspar || 0))],
        ['Steuerwirkung im Jahr', B.eurS(-(r.steuer || 0))], ['Vermögensdelta im Jahr', r.delta_pa == null ? 'ohne Bewertung' : B.eurS(r.delta_pa), { art: 'ende' }]])
      + (hz.length ? '<h3>Hebel</h3><ul>' + hz.map(function (x) { return '<li>' + B.esc(x) + '</li>'; }).join('') + '</ul>' : '')
      + '<p class="det">Alle vier Stufen geteilt durch das Eigenkapital. Der Wertzuwachs ist eine Annahme und geht in keinen Score ein.</p>';
  }
  /* v4870 · Marcel 25.11.2026: bei den Gruppen des Investor Deal Score die zugrunde liegenden Kennzahlen mit Wert und Punkten.
     Quelle ist der Score-Kern selbst (dealscore2: investment/finanzierung.gruppen[].kpis, categories[].breakdown), hier wird nichts gerechnet. */
  function idsGruppen(B, ds2) {
    if (!ds2 || !ds2.investment || !ds2.finanzierung || !ds2.categories) return '';
    var bd = {};
    Object.keys(ds2.categories).forEach(function (k) { (ds2.categories[k].breakdown || []).forEach(function (b) { bd[b.name] = b; }); });
    function wert(b) {
      if (!b || b.applied === false || b.value == null || typeof b.value === 'object') return 'keine Angabe';
      if (typeof b.value === 'string') { var w = b.value.replace(/_/g, ' '); return w.charAt(0).toUpperCase() + w.slice(1); }
      var u = String(b.unit || '').trim();
      if (u === '%') return B.pct(b.value, Math.abs(b.value) < 10 ? 2 : 1);
      if (u === '€') return B.eurS(b.value);
      return B.zahl(b.value, Math.abs(b.value) < 10 ? 2 : 0) + (u ? ' ' + u : '');
    }
    function gruppe(g) {
      var zeilen = (g.kpis || []).map(function (n) {
        var b = bd[n], ok = b && b.applied !== false && typeof b.value !== 'object', p = ok ? Math.max(0, Math.min(100, Math.round(b.points))) : null;
        var balken = p === null ? '' : '<div style="height:1.6mm;background:rgba(42,39,39,.08);border-radius:1mm;margin-top:.6mm"><div style="height:100%;width:' + p + '%;background:var(--wl-c9a84c,#C9A84C);border-radius:1mm"></div></div>';
        return '<tr><td style="padding:1mm 1.5mm 1mm 0">' + B.esc(n) + balken + '</td><td class="r num" style="padding:1mm 1.5mm;white-space:nowrap">' + B.esc(wert(b)) + '</td><td class="r num" style="padding:1mm 0;white-space:nowrap;' + (p === null ? 'color:rgba(42,39,39,.5)' : '') + '">' + (p === null ? '–' : p) + '</td></tr>';
      }).join('');
      return '<div style="break-inside:avoid;margin:0 0 3mm"><div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:.3mm solid var(--wl-c9a84c,#C9A84C);padding-bottom:.8mm;margin-bottom:.6mm"><b>' + B.esc(g.name) + '</b><span class="num"><b>' + B.zahl(g.score, 0) + '</b> / 100</span></div>'
        + '<table class="dicht" style="width:100%"><thead><tr><th>Kennzahl</th><th class="r">Wert</th><th class="r">Punkte</th></tr></thead><tbody>' + zeilen + '</tbody></table></div>';
    }
    var sp = function (titel, t) { return '<div><h3>' + titel + ' ' + B.zahl(t.score, 0) + ' / 100</h3>' + t.gruppen.map(gruppe).join('') + '</div>'; };
    return '<div class="zwei">' + sp('Investment-Score', ds2.investment) + sp('Finanzierungs-Score', ds2.finanzierung) + '</div>'
      + '<p class="det">Punkte von 0 bis 100 je Kennzahl aus dem Score-Kern der App, je Gruppe gewichtet. „keine Angabe“: die Kennzahl fehlt am Objekt und zählt nicht mit.</p>';
  }
  function investorScoreSeite(B, SC) {
    var r = null; try { r = typeof window._dpComputeDS2Cached === 'function' ? window._dpComputeDS2Cached() : window._dpLastDS2Result; } catch (e) { r = null; }
    var kat = r && (r.categories || r.kategorien);
    var GN = { rendite: 'Rendite', finanzierung: 'Finanzierung', risiko: 'Risiko und Zustand', lage: 'Lage und Markt', upside: 'Potenzial' };
    var arr = Array.isArray(kat) ? kat : (kat && typeof kat === 'object' ? Object.keys(kat).map(function (k) { var x = kat[k] || {}; return { name: x.label || x.name || GN[k] || k, score: x.score }; }) : []);
    arr = arr.map(function (x) { var n = String(x.name || x.label || ''); return { name: GN[n] || n, score: x.score }; });
    var dsT = '<div class="zwei"><div><h3>Deal Score</h3>' + B.scoreRing(SC.score, SC.label) + '<p class="det">Bewertet das Objekt: Cashflow, Rendite, Beleihung, Schuldendienst und Potenzial, wie im Quick-Check.</p></div>'
      + '<div><h3>Investor Deal Score</h3>' + (r && r.score != null ? B.scoreRing(r.score, r.label) : '<p>–</p>') + '<p class="det">Bewertet das Objekt für das Investmentprofil, mit der EK-Rendite nach Steuer.</p></div></div>';
    var kt = arr.length ? '<h3>Investor Deal Score je Gruppe</h3><table class="dicht"><thead><tr><th>Gruppe</th><th class="r">Punkte</th></tr></thead><tbody>' + arr.map(function (x) { return '<tr><td>' + B.esc(x.name || x.label || '') + '</td><td class="r num">' + (da(x.score) === null ? '–' : B.zahl(x.score, 0) + ' / 100') + '</td></tr>'; }).join('') + '</tbody></table>' : '';
    return dsT + kt;
  }
  /* Lagekarte mit Haus-Pin (lagekarte.js pin:haus, wie Portfolio-Cockpit und Deal-Check), unabhängig vom Foto */
  function pinKarte(adresse) {
    if (!adresse || !window.DpLagekarte) return Promise.resolve(null);
    return api('/marktbericht/geocode?address=' + encodeURIComponent(adresse)).then(function (g) {
      return DpLagekarte.bild(g && g.lat, g && g.lon, { breite: 760, hoehe: 427, pin: 'haus' }).then(function (lk) { return lk ? lk.src : null; });
    }).catch(function () { return null; });
  }
  /* Kurze Gesamtbewertung für Fassung A und C: Gesamturteil, je bis zu drei Stärken und Schwächen, Lage und Markt in zwei Punkten.
     Die ausführliche Fassung (Risikoanalyse, Anschluss, Exit) steht in der Kombi. */
  function kuerzen(t, n) { t = klar(t).replace(/\s+/g, ' '); if (t.length <= n) return t; var e = t.slice(0, n).lastIndexOf('. '); return e > n / 3 ? t.slice(0, e + 1) : t.slice(0, n).replace(/\s+\S*$/, '') + ' …'; }
  function gesamtKompakt(B, bank) {
    var ai = window._aiAnalysis || null; if (!ai) return pilotAnalyse(B, true, bank);
    var gb = ai.gesamtbewertung || ai.fazit_kurz || '';
    gb = String(gb).split(/(?<=[.!?])\s+/).filter(function (x) { return !(/(halten|gehalten|verkauf|kaufen|gekauft|einstieg)/i.test(x) && /(sollte|empfehl|geeignet|lohnt|ratsam)/i.test(x)); }).join(' ');
    var lm = [ai.mikrolage_recherche ? 'Mikrolage: ' + kuerzen(ai.mikrolage_recherche, 260) : '', ai.makrolage_recherche ? 'Makrolage: ' + kuerzen(ai.makrolage_recherche, 260) : '', ai.kaufpreisniveau ? 'Kaufpreisniveau: ' + kuerzen(ai.kaufpreisniveau, 220) : ''].filter(Boolean);
    var pa = pilotAnalyse(B, true, bank); if (!bank) pa = pa.replace(/<div class="fliess"><h3>Was für die Finanzierung spricht<\/h3>[\s\S]*?<\/ul><\/div>/, '');   /* steht in der Bankfassung */
    return (gb ? '<p>' + B.esc(kuerzen(gb, 900)) + '</p>' : '') + pa
      + (lm.length ? '<h3>Lage und Markt</h3><ul>' + lm.map(function (x) { return '<li>' + B.esc(x) + '</li>'; }).join('') + '</ul>' : '');
  }
  /* Kundentext ohne Gedankenstriche und Semikolons (Marcel 08.11.): nur im Text zwischen Tags, nie in Stil oder Attributen.
     Ein einzelnes „–“ als Platzhalter für „kein Wert“ bleibt. */
  function ohneStriche(html) {
    /* v4790m · <style>-Blöcke (Bank-Cockpit) bleiben unberührt, sonst würde aus „a; b“ im CSS „a, b“ */
    return String(html).split(/(<style[^>]*>[^<]*<\/style>)/).map(function (teil) { return /^<style/.test(teil) ? teil : ohneStricheText(teil); }).join('');
  }
  function ohneStricheText(html) {
    return String(html).replace(/>([^<]+)</g, function (m, t) {
      return '>' + t.replace(/\s[–—]\s/g, ', ').replace(/^\s*[–—]\s+(?=\S)/, '').replace(/(&[#a-zA-Z0-9]+;)|;\s/g, function (x, ent) { return ent || ', '; }) + '<';   /* v4790l · Entitäten wie &amp; bleiben */
    });
  }
  /* v4860 · Marcel 25.11.2026 (Investment-PDF „mit den neuen Zahlen“): Die KI nennt die Marktpreisindikation des Marktberichts
     „Marktwert“. Maßgebend ist aber der Wert des Hauses als Ganzes (Entscheidung 24.11.), und die Marktpreisindikation ist
     kein Verkehrswert. Im Investment-PDF heißt sie deshalb im KI-Text „Marktpreis“ (gleiches Geschlecht, Sätze bleiben
     grammatisch). Nur die KI-Texte, nie die eigenen Beschriftungen. Die Ursache sitzt im Prompt (openaiService). */
  function kiBegriffe(v) {
    if (typeof v === 'string') return v.replace(/Marktwert(e?s)?(?![a-zäöüß])/g, function (m, g) { return g ? 'Marktpreises' : 'Marktpreis'; }).replace(/Marktwerte(?![a-zäöüß])/g, 'Marktpreise');
    if (Array.isArray(v)) return v.map(kiBegriffe);
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = kiBegriffe(v[k]); }); return o; }
    return v;
  }
  async function investmentNeu(fassung) {
    var alt = window._aiAnalysis;
    try { if (alt) window._aiAnalysis = kiBegriffe(alt); return await investmentNeuInnen(fassung); }
    finally { window._aiAnalysis = alt; }
  }
  async function investmentNeuInnen(fassung) {
    /* v4790b · Reihenfolge (Marcel 25.11.): erst das Objekt, dann Miete, Finanzierung, Wert, Rendite, Steuer; Fazit mit den
       Kernaussagen am Schluss vor Quellen und Methodik. Der Deal Score steht mit seinen Teilscores auf „Auf einen Blick“,
       keine eigene Seite. */
    var bankF = fassung === 'c', kombi = fassung === 'b';
    var PZ0 = window.DpPotenzial;
    try { if (PZ0 && PZ0.modell && PZ0.modell().aktiv) { await Promise.race([PZ0.rechnen(), new Promise(function (f) { setTimeout(f, 40000); })]); if (typeof window.calcNow === 'function') window.calcNow(); } } catch (e0) {}
    var B = D(), K = (window.State && State.kpis) || {}, o = objektKopf(), key = window._currentObjKey, S0 = St();
    var name = bankF ? 'Investment Case · Bankfassung' : kombi ? 'Investment Case' : 'Investment Case · Kurzfassung';
    var SC = scoreDaten(K);
    /* v4860 · am Score steht die Stufe wie in der App („69 Solide“), nicht die Empfehlung des Investor-Profils („Verhandeln“) */
    try { if (SC && SC.score != null && window.ScoreTier && ScoreTier.stufe) SC.label = ScoreTier.stufe(SC.score).wort; } catch (eT) {}
    var z = await Promise.all([basis(name), objektInfo(key, o.adresse), stufe3Bericht(), pinKarte(o.adresse)]);
    var c = z[0], info = z[1], fotos = info.fotos, P3 = z[2]; if (z[3]) info.karte = z[3]; c.zeile = o.adresse; o.seq = info.seq || o.seq;
    var PD = null, WZ = null, PZ = window.DpPotenzial;
    try { if (PZ && PZ.modell && PZ.modell().aktiv) PD = PZ.pdfDaten(); } catch (e) { PD = null; }
    try { if (window.DpPdfWertZielbild) WZ = await DpPdfWertZielbild.daten({ potenzial: PD }); } catch (e) { WZ = null; }
    var WZo = WZ ? Object.assign({}, WZ, { kern: [] }) : WZ;   /* Kernaussagen stehen im Fazit am Schluss */
    var mw = massgebend(B);
    var mpiV = (WZ && WZ.verfahren || []).filter(function (v) { return v.art === 'mpi' && da(v.mitte) !== null; })[0] || null;
    var sw0 = window.DealPilotSchwellen ? DealPilotSchwellen.get() : {}, dg = Number(sw0.dscrGruen) > 0 ? Number(sw0.dscrGruen) : 1.2;
    /* Marcel 25.11.2026: der Investor Deal Score steht immer mit zwei Scores (Investment und Finanzierung), der Deal Score nicht zusätzlich */
    var ds2 = null; try { ds2 = typeof window._dpComputeDS2Cached === 'function' ? window._dpComputeDS2Cached() : window._dpLastDS2Result; } catch (e) { ds2 = null; }
    var IG = ds2 && ds2.gesamt ? ds2.gesamt : null, II = ds2 && ds2.investment, IF = ds2 && ds2.finanzierung;
    var idsKz = IG ? { l: 'Investor Deal Score', v: B.zahl(IG.score, 0) + ' / 100', s: igWort(IG) || '' } : { l: 'Deal Score', v: SC.score ? B.zahl(SC.score, 0) + ' / 100' : '–', s: SC.label || '' };
    var Sx = [B.deckblatt(c, { bild: fotos[0] || info.karte || null, eyebrow: name, titel: o.adresse, unter: [o.art, o.wfl ? B.zahl(o.wfl, 0) + ' m² Wohnfläche' : '', o.bj ? 'Baujahr ' + B.jahr(o.bj) : '', K.kp ? 'Kaufpreis ' + B.eur(K.kp) : ''].filter(Boolean).join(' · '),
      kz: [mw ? { l: mw.name + ', führend', v: B.eur(mw.wert) } : { l: 'Gesamtinvestition', v: B.eur(K.gi) }, idsKz, { l: 'Cashflow vor Steuern', v: B.eurS(K.cf_m), s: 'im Monat nach Finanzierung', art: (K.cf_m || 0) >= 0 ? 'gut' : 'schlecht' }, { l: 'DSCR', v: B.zahl(K.dscr, 2), s: 'volles Jahr, heutige Eingaben' }],
      meta: [['Objekt-Nr.', o.seq || '–'], ['Stand', c.stand], ['Bewertungsstichtag', S0.wert_anker && S0.wert_anker.datum ? B.datum(S0.wert_anker.datum) : '–']],
      hinweisRechts: bankF ? 'Finanzierungsunterlage' : 'Investment Case' })];
    var T = [], P = [];
    var add = function (titel, unter, html, teil) { if (!html) return; T.push([titel, unter, teil]); P.push([titel, html, teil]); };
    var punkte = function (titel, arr) { return arr.length ? '<h3>' + titel + '</h3><ul>' + arr.map(function (x) { return '<li>' + B.esc(x) + '</li>'; }).join('') + '</ul>' : ''; };
    /* Punkte aus den gerechneten Zahlen, nicht aus dem KI-Text (der kann älter sein als die Zahlen) */
    var pk = [], rk = [];
    if (mw && K.kp && mw.wert > K.kp) pk.push('Der Kaufpreis liegt ' + B.eur(mw.wert - K.kp) + ' (' + B.pct((mw.wert - K.kp) / mw.wert * 100, 1) + ') unter dem ' + mw.name + '.');
    if (mw && K.kp > mw.wert) rk.push('Der Kaufpreis liegt ' + B.pct((K.kp - mw.wert) / mw.wert * 100, 1) + ' über dem ' + mw.name + '.');
    if (da(K.bmy) !== null) pk.push('Bruttomietrendite ' + B.pct(K.bmy, 2) + ', Kaufpreisfaktor ' + B.zahl(K.fak, 1) + '.');
    if ((K.cf_m || 0) >= 0) pk.push('Nach Zins und Tilgung bleiben im Monat ' + B.eurS(K.cf_m) + ' vor Steuern.'); else rk.push('Nach Zins und Tilgung fehlen im Monat ' + B.eur(-K.cf_m) + ' vor Steuern.');
    if (da(K.dscr) !== null) (K.dscr >= dg ? pk : rk).push('DSCR ' + B.zahl(K.dscr, 2) + (K.dscr >= dg ? ', über' : ', unter') + ' der üblichen Schwelle von ' + B.zahl(dg, 2) + '.');
    if (da(K.rate_an_m) !== null && da(K.cf_op_an) !== null) rk.push('Nach der Zinsbindung (Annahme ' + B.pct(zahlAus('anschl_z'), 2) + ') Rate ' + B.eur(K.rate_an_m) + ' im Monat, Cashflow vor Steuern ' + B.eurS(K.cf_op_an / 12) + ' im Monat.');
    if (!bankF && K.ekr4 && K.ekr4.k4 != null) pk.push('EK-Rendite nach Steuer mit Vermögensdelta ' + B.pct(K.ekr4.k4, 1) + ', operativ ' + B.pct(K.ekr4.k1, 1) + '.');
    if (PD && PD.satz_bank) pk.push(klar(PD.satz_bank));

    /* 1 · Auf einen Blick, mit Deal Score und den Teilscores des Investor Deal Score */
    var GN = { rendite: 'Rendite', finanzierung: 'Finanzierung', risiko: 'Risiko und Zustand', lage: 'Lage und Markt', upside: 'Potenzial' };
    var kat = ds2 && (ds2.categories || ds2.kategorien), teil = [];
    if (ds2 && ds2.investment && ds2.finanzierung && ds2.investment.gruppen) teil = ds2.investment.gruppen.concat(ds2.finanzierung.gruppen || []).map(function (g) { return { l: g.name, v: B.zahl(g.score, 0), s: 'von 100' }; });   /* v4870 */
    else if (kat && typeof kat === 'object') teil = (Array.isArray(kat) ? kat : Object.keys(kat).map(function (k) { var x = kat[k] || {}; return { name: x.label || x.name || k, score: x.score }; }))
      .map(function (x) { var n = String(x.name || x.label || ''); return { l: GN[n] || n, v: da(x.score) === null ? '–' : B.zahl(x.score, 0), s: 'von 100' }; });
    var scoreBlock = IG ? '<div class="zwei"><div>' + B.scoreRing(IG.score, igWort(IG), 'Investor Deal Score von 100') + '<p class="det">Investor Deal Score: das Objekt aus Sicht des Investmentprofils, in zwei Scores. Rendite mit der EK-Rendite nach Steuer.</p></div><div>'
      + B.kacheln([{ l: 'Investment-Score', v: B.zahl(II.score, 0) + ' / 100', s: (II.stufe || '') + (II.anteil != null ? ' · Anteil ' + B.pct(II.anteil, 1) : '') },
        { l: 'Finanzierungs-Score', v: B.zahl(IF.score, 0) + ' / 100', s: (IF.stufe || '') + (IF.gedeckelt && IF.deckel ? ' · gedeckelt: ' + IF.deckel : '') }]).replace('class="kz"', 'class="kz" style="grid-template-columns:1fr 1fr"')
      + '</div></div>' + (teil.length ? '<h3>Gruppen des Investor Deal Score</h3>' + B.kacheln(teil, true) : '') : B.scoreRing(SC.score, SC.label);
    add('Auf einen Blick', 'Die wichtigsten Zahlen, Investor Deal Score mit Investment- und Finanzierungs-Score',
      B.kacheln([
        { l: 'Kaufpreis', v: B.eur(K.kp), s: K.gi ? 'Gesamtinvestition ' + B.eur(K.gi) : '' },
        mw ? { l: mw.name + ', führend', v: B.eur(mw.wert), s: mw.det } : null,
        mpiV ? { l: 'Marktpreisindikation', v: B.eur(mpiV.mitte), s: 'aus Angebotspreisen, kein Verkehrswert' } : null,
        aufWert(WZ) ? { l: 'Wert nach Aufteilung', v: B.eur(aufWert(WZ).mitte), s: 'zusätzlich, rechnet nicht mit' } : null,
        { l: 'Bruttomietrendite', v: B.pct(K.bmy, 2), s: 'Faktor ' + B.zahl(K.fak, 1) },
        { l: 'Nettomietrendite', v: B.pct(K.nmy, 2), s: 'auf Gesamtinvestition' },
        { l: 'Cashflow vor Steuern', v: B.eurS(K.cf_m), s: 'im Monat nach Finanzierung', art: (K.cf_m || 0) >= 0 ? 'gut' : 'schlecht' },
        { l: 'DSCR', v: B.zahl(K.dscr, 2), s: 'volles Jahr', art: K.dscr >= dg ? 'gut' : 'schlecht' },
        (!bankF && K.ekr4 && K.ekr4.haupt != null) ? { l: 'EK-Rendite', v: B.pct(K.ekr4.haupt, 1), s: 'nach Steuer mit Vermögensdelta' } : { l: 'LTV', v: B.pct(K.ltv, 1), s: S0.ltv_basis_label ? 'auf ' + S0.ltv_basis_label : '' }
      ].filter(Boolean), true) + '<h3>Investor Deal Score</h3>' + scoreBlock, 1);

    /* v4870 · Investor Deal Score im Detail: Kennzahlen je Gruppe mit Wert und Punkten (alle Fassungen) */
    if (IG) add('Investor Deal Score im Detail', 'Kennzahlen je Gruppe mit Wert und Punkten', idsGruppen(B, ds2), 1);
    /* 2 · Objekt */
    var steck = '<div class="kv">' + [['Objektart', o.art], ['Baujahr', B.jahr(o.bj)], ['Wohnfläche', o.wfl ? B.zahl(o.wfl, 0) + ' m²' : '–'], ['Grundstück', o.gs ? B.zahl(o.gs, 0) + ' m²' : '–'],
      ['Kaufdatum', B.datum(feld('kaufdat')) || '–'], ['Energieklasse', feld('ds2_energie') || '–']].map(function (k) { return '<div><span>' + k[0] + '</span><span>' + B.esc(k[1]) + '</span></div>'; }).join('') + '</div>';
    var gal = fotos.length > 1 ? '<h3>Ansichten</h3><div class="galerie">' + fotos.slice(1, 5).map(function (f) { return '<img src="' + f + '" alt="">'; }).join('') + '</div>' : '';
    add('Objekt und Lage', 'Steckbrief, Lagekarte, Energieeffizienz', steck
      + (info.karte ? '<img class="karte" src="' + info.karte + '" alt="" style="height:80mm;width:100%;object-fit:cover;margin-top:3mm">' : '')
      + (feld('ds2_energie') ? '<h3>Energieeffizienz</h3>' + B.energieSkala(feld('ds2_energie')) : '') + gal, 1);

    /* 3 · Miete: Mieterliste und Obergrenze zusammen, damit die Seite trägt */
    var mp = mietpotenzial(B, PD), ml = mieterliste(K, B), iS = ml.indexOf('<div class="block"><h3>Ist gegen Soll');
    /* Mieterliste und Obergrenzen-Tabelle doppeln Wohnung, Fläche und Ist: im Überblick nur Ist gegen Soll plus Obergrenze, die volle Mieterliste in der Vertiefung */
    add('Miete und Obergrenze', 'Ist gegen Soll, was rechtlich höchstens drin ist', mp ? (iS >= 0 ? ml.slice(iS) : '') + '<h3 style="margin-top:6mm">Mietpotenzial und Obergrenze</h3>' + mp : ml, 1);
    var mlB = (kombi && mp && iS > 0) ? ml.slice(0, iS) : '';   /* v4790k · Mieterliste steht in Teil B vor dem Ertrag statt allein auf einer Seite */

    /* 4 · Finanzierung */
    var dl = darlehen();
    var dlT = dl.length ? '<table class="dicht"><thead><tr><th>Darlehen</th><th class="r">Betrag</th><th class="r">Zins</th><th class="r">Tilgung</th><th class="r">Bindung</th><th class="r">Rate / Monat</th></tr></thead><tbody>'
      + dl.map(function (d) { return '<tr><td>' + B.esc(d.name) + '</td><td class="r num">' + B.eur(d.betrag) + '</td><td class="r num">' + B.pct(d.zins, 2) + '</td><td class="r num">' + B.pct(d.tilg, 2) + '</td><td class="r num">' + (d.bind ? B.zahl(d.bind, 0) + ' J.' : '–') + '</td><td class="r num">' + B.eur(d.rate, 0) + '</td></tr>'; }).join('') + '</tbody></table>' : '';
    var cpA = cockpitApp();   /* v4790n · Bank-Cockpit auf derselben Seite wie die Phasen, es passt darunter */
    add('Finanzierung und Anschluss', 'Darlehen, Rate und Cashflow je Phase, DSCR und LTV im Verlauf', dlT + dreiPhasen(K, B) + (cpA ? '<h3 style="margin-top:6mm">DSCR und LTV im Verlauf</h3>' + cpA : bankCockpit(B, true)), 1);
    if (bankF) {
      var bc = bankCockpit(B, false), sm = stressMatrix(B), d1 = zahlAus('d1') || K.d_total || 0;
      add('Sicherheiten und Belastungsprobe', 'Objektwert und Beleihung, DSCR je Zins- und Mietszenario', '<h3>Sicherheiten</h3>' + B.liste([['Objektwert, maßgebend', mw ? B.eur(mw.wert) : '–', { det: mw ? mw.det : 'kein Marktbericht, Kaufpreis als Bezug' }], ['Kaufpreis', B.eur(K.kp)], ['Darlehen', B.eur(d1)],
        ['Beleihung auf den Objektwert', mw && mw.wert > 0 && d1 ? B.pct(d1 / mw.wert * 100, 1) : '–'], ['Beleihung laut Kalkulation', B.pct(K.ltv, 1), { det: S0.ltv_basis_label ? 'auf ' + S0.ltv_basis_label : '', art: 'ende' }]]) + (sm || ''), 1);
    }

    /* 5 · Wert und Rechenweg */
    _knapp = true;
    try { var rw = rechenweg(B, P3, !kombi); add(rw ? 'Wert, Verfahren und Rechenweg' : 'Wert und Verfahren', rw ? 'Werte je Verfahren, Wert je Stufe, Ertrags- und Sachwert Zeile für Zeile' : 'Werte je Verfahren und Wert je Stufe', wertZielbild(K, B, WZo, PD, true, bankF) + (rw ? '<h3 style="break-before:page;page-break-before:always">Rechenweg</h3>' + rw : ''), 1); } finally { _knapp = false; }

    /* 6 · Rendite und Steuer (nicht in der Bankfassung) */
    if (!bankF) add('EK-Rendite und Hebel', 'Vier Stufen, Hebel in beide Richtungen', ekRenditeSeite(B, K), 1);
    if (!bankF) add('Steuer im Überblick', 'Cashflow vor und nach Steuern, Steuerwirkung', '<div class="block"><h3>Cashflow vor und nach Steuern</h3>' + cfDiagramm(B) + '</div>' + steuerWirkung(K, B), 1);

    /* 7 · Vertiefung der Kombi */
    if (kombi) {
      _knapp = true;
      try {
        var smK = stressMatrix(B);
        add('Investition, Finanzierung und Belastungsprobe', 'Investition, Darlehen, Phasen im Einzelnen, DSCR je Zins- und Mietszenario', finanzierungVoll(K, B, false) + '<h3>Phasen im Einzelnen</h3>' + phasenVoll(K, B) + (smK || ''), 2);
        var kz12 = kennzahlen12(K, B, SC).replace(/<div class="hi"><div class="l">Deal Score<\/div><div class="v">[^<]*<\/div>(<div class="s">[^<]*<\/div>)?<\/div>/, '');
        add(mlB ? 'Einheiten, Ertrag und Cashflow je Jahr' : 'Ertrag, Kennzahlen und Cashflow je Jahr', (mlB ? 'Mieterliste, ' : '') + 'von der Warmmiete zum Cashflow, Bewirtschaftung, alle Kennzahlen, ' + (St().cfRows || []).length + ' Jahre als Tabelle', mlB + ertragKette(K, B) + bewirtschaftungDetail(K, B) + '<h3>Alle Kennzahlen</h3>' + kz12 + '<h3>Cashflow je Jahr</h3>' + cfJahre(B), 2);
        add('Projektion und Vermögen', 'Wert, Restschuld, Eigenkapital, Zuwachs, Exit', vermoegenVoll(K, B), 2);
        /* Wertüberleitung ohne erzwungenen Seitenumbruch, damit „Wert je Wohnung“ nicht allein auf einer Seite steht */
        add('Wert und Zielbild im Detail', 'Wert je Wohnung, Wertüberleitung, Kennzahlen je Stufe', wertZielbild(K, B, WZo, PD, false, false).replace('<h3 style="break-before:page;page-break-before:always">Wertüberleitung', '<h3 style="break-inside:avoid;margin-top:6mm">Wertüberleitung'), 2);
      } finally { _knapp = false; }
    }

    /* 8 · Gesamtbewertung und Fazit am Schluss */
    var kernL = (WZ && WZ.kern && WZ.kern.length) ? B.liste(WZ.kern.map(function (k) { return [k.titel, k.wert_text || '', { det: k.text ? klar(k.text) : '' }]; })) : '';
    add('Gesamtbewertung', kombi ? 'Gesamturteil, Stärken, Schwächen, Risikoanalyse, Anschluss, Exit, Lage und Markt' : 'Gesamturteil, Stärken, Schwächen, Lage und Markt', kombi ? pilotAnalyse(B, false, false) : gesamtKompakt(B, bankF), kombi ? 2 : 1);
    add('Fazit und Kernaussagen', 'Was dafür spricht, worauf zu achten ist, Kernaussagen', punkte('Was dafür spricht', pk) + punkte('Worauf zu achten ist', rk) + (kernL ? '<h3>Kernaussagen</h3>' + kernL : '')
      + '<div class="hinweis">Orientierung für die Entscheidung, keine Rechts-, Steuer- oder Finanzierungsberatung. Alle Werte sind indikativ.</div>', kombi ? 2 : 1);

    /* Kombi: Teil B (Vertiefung) steht immer hinter Teil A, die Reihenfolge innerhalb der Teile bleibt */
    if (kombi) { var ord = T.map(function (t, i) { return i; }).sort(function (a, b) { return ((T[a][2] || 1) - (T[b][2] || 1)) || (a - b); }); T = ord.map(function (i) { return T[i]; }); P = ord.map(function (i) { return P[i]; }); }
    var mark = function (html, k) { return html.replace('<section class="seite', '<section data-dp-abschnitt="' + k + '" class="seite'); };
    var nA = 0, nB = 0;
    var TT = T.map(function (t, i) { return [t[0], t[1], String(i + 1), 'a' + (i + 1)]; });   /* v4870 · Marcel: Kombi wie Kurzfassung, 1, 2, 3 statt A1/B1 */
    Sx.push(inhaltSeite(c, B, TT.concat([['Quellen, Methodik und Annahmen', 'Quellen, Methodik, Annahmen, Hinweise', 'Q', 'anh']])));
    P.forEach(function (p, i) {
      var eb = 'Abschnitt ' + (i + 1);
      Sx.push(mark(B.seite(c, p[0], B.abschnitt(eb, p[0]) + p[1]), 'a' + (i + 1)));
    });
    /* Quellen und Methodik immer am Schluss (Marcel 25.11.) */
    var quellen = ['Rendite, Cashflow, DSCR und Finanzierung rechnen die Rechenkerne der DealPilot-App, Monat für Monat wie ein Tilgungsplan.',
      'Die Wertermittlung folgt der ImmoWertV mit den Daten des zuständigen Gutachterausschusses, wo sie vorliegen. Werte aus Angebotspreisen sind als indikativ gekennzeichnet.',
      'Mietpotenzial und Obergrenze nach §§ 556d, 558 BGB mit der ortsüblichen Vergleichsmiete und der Kappungsgrenze der Gemeinde.',
      'Deal Score und Investor Deal Score aus denselben Kernen wie in der App und im Quick-Check.'];
    var qn = (P3 && P3.cross_check && P3.cross_check.quellen_nachweis) || [];
    qn.forEach(function (x) { if (x && x.vermerk) quellen.push((x.kennzahlen ? x.kennzahlen.join(', ') + ': ' : '') + x.vermerk); });
    if (info.karte) quellen.push('Kartengrundlage: © OpenStreetMap-Mitwirkende.');
    Sx.push(mark(B.seite(c, 'Quellen', B.abschnitt('Anhang', 'Quellen, Methodik und Annahmen')
      + '<div class="block"><h3>Quellen und Methodik</h3><ul>' + quellen.filter(function (x, i) { return quellen.indexOf(x) === i; }).map(function (x) { return '<li>' + B.esc(x) + '</li>'; }).join('') + '</ul></div>'
      + annahmenVoll(K, B, false)), 'anh'));
    return B.dokument(name + ' · ' + o.adresse, Sx.map(ohneStriche));
  }

  /* ── 4 · Kaufpreisaufteilung ─────────────────────────────────────── */
  /* v3184 · der Rechenlauf liegt in bmf-ausgabe.js (dieselbe Stelle wie Arbeitshilfe und XLSX). Die feste
     Wartezeit von 3,5 s vor dem Lauf entfällt, wenn für DIESES Objekt schon gerechnet ist. */
  function bmfBereit() {
    var fertig = window.DpBmfAusgabe ? window.DpBmfAusgabe.bereitstellen() : Promise.resolve();
    return fertig.then(function () {
      /* Schritt 5 rechnet Auswahl, Begründung und Vertragstext - auch wenn das Fenster nie offen war */
      try { if (window.DpBmfBodenabschlag) { window.DpBmfBodenabschlag.einhaengen(); window.DpBmfBodenabschlag.rechnen(); } } catch (e) {}
    });
  }
  function kaufpreisaufteilung() {
    var B = D(), o = objektKopf();
    return bmfBereit().then(function () { return Promise.all([basis('Kaufpreisaufteilung'), objektInfo(window._currentObjKey, o.adresse)]); }).then(function (zz) {
      var c = zz[0], info = zz[1]; c.zeile = o.adresse;
      var r = window._lastBmfResults || {}, w = function (k) { return r[k] && typeof r[k] === 'object' ? r[k].value : r[k]; };
      var z = (window._dpKpaZahlen && _dpKpaZahlen()) || {};
      /* v3184 · Marcel 05.11.2026: die gewählte Stufe (amtlich, konservativ, optimiert oder Jacoby) gilt -
         bis v3183 druckte das neue PDF nur die amtliche Zahl, Auswahl, Begründung und Vertragstext fehlten. */
      var T = window._dpKpaTexte || null;
      var abw = !!(T && T.wahl && T.wahl !== 'amtlich' && isFinite(T.gebPct));
      var gebPctG = abw ? T.gebPct : Number(w('gebaeudeanteil_prozent'));
      /* v3550 · das Datum, mit dem die Arbeitshilfe gerechnet hat (bmf-bodenabschlag.js _dpKpaStichtag: _lastBmfInputs.kaufdatum),
         auf dem Deckblatt und als erste Zeile der Herleitung; ohne Datum keine Zeile, nie ein leeres Feld „Stichtag“ (v1495/v1497). */
      var ST = (typeof window._dpKpaStichtag === 'function') ? window._dpKpaStichtag() : null;
      var S = [];
      S.push(B.deckblatt(c, { bild: info.fotos[0] || info.karte || null, eyebrow: abw && T.wahl === 'jacoby' ? 'Kaufpreisaufteilung nach der umgekehrten Ertragswertmethode (Jacoby)' : 'Kaufpreisaufteilung nach BMF-Arbeitshilfe', titel: o.adresse, unter: o.art + (o.bj ? ' · Baujahr ' + B.jahr(o.bj) : ''),
        wertLabel: 'Gebäudeanteil', wert: B.pct(gebPctG, 2),
        wertNeben: abw ? (B.esc(T.name) + '<br>amtlich ' + B.pct(w('gebaeudeanteil_prozent'), 2)) : ('Grund und Boden ' + B.eur(w('kaufpreisanteil_grund')) + '<br>Gebäude ' + B.eur(w('kaufpreisanteil_gebaeude'))),
        meta: [['Kaufpreis', B.eur(z.kp)]].concat(ST ? [[ST.label, ST.text]] : []).concat([['Stand', c.stand], ['Grundlage', (abw ? 'BMF-Arbeitshilfe · ' + (T.wahl === 'jacoby' ? 'Jacoby' : 'Bodenabschlag') : 'BMF-Arbeitshilfe') + (r._vorlage ? ' (' + r._vorlage + ')' : '')]]) }));   /* v3481 · Fassung der verwendeten Vorlage */
      S.push(B.seite(c, 'Herleitung', B.abschnitt('Abschnitt 1', 'Herleitung nach der Arbeitshilfe', 'Sach- und Ertragswert nach der Arbeitshilfe des Bundesministeriums der Finanzen; maßgeblich ist der höhere Bezug je Objektart.')
        + B.liste((ST ? [[ST.label + ' (Datum der Arbeitshilfe)', ST.text]] : []).concat([['Bodenwert', B.eur(w('bodenwert'))], ['Vorläufiger Sachwert', B.eur(w('sachwert_vorlaeufig'))], ['Marktangepasster Sachwert', B.eur(w('sachwert_marktangepasst'))],
          ['Vorläufiger Ertragswert', B.eur(w('ertragswert'))], ['Maßgebender Verkehrswert', B.eur(w('massgebender_verkehrswert')), { art: 'summe' }],
          ['Grund und Boden (Einzelwert)', B.eur(w('grund_boden_wert')), { art: 'ein' }], ['Gebäude (Einzelwert)', B.eur(w('gebaeude_wert')), { art: 'ein' }],
          ['Gebäudeanteil', B.pct(w('gebaeudeanteil_prozent'), 2), { art: 'ende' }]]))
        /* v3179b · kaufpreisanteil_* der BMF-Rechnung stehen auf den ANSCHAFFUNGSKOSTEN (Kaufpreis Immobilie +
           Erwerbsnebenkosten), nicht auf dem Kaufpreis. */
        + (function () {
          var akG = Number(w('kaufpreisanteil_grund')) || 0, akB = Number(w('kaufpreisanteil_gebaeude')) || 0, ak = akG + akB;
          var pct = Number(w('gebaeudeanteil_prozent')) || 0, kpI = Number(z.kpImmo) || 0;
          var vGeb = kpI * pct / 100, vBod = kpI - vGeb;
          return '<h3>Aufteilung der Anschaffungskosten (amtlich)</h3>' + B.liste([['Kaufpreis', B.eur(z.kp)], ['davon Inventar / Möblierung', B.eur(z.inventar), { art: 'ein' }], ['Kaufpreis Immobilie', B.eur(kpI), { art: 'summe' }],
            ['Erwerbsnebenkosten (anteilig)', B.eur(ak - kpI)], ['Anschaffungskosten', B.eur(ak), { art: 'summe' }],
            ['Anteil Grund und Boden (' + B.zahl(100 - pct, 2) + ' %)', B.eur(akG), { art: 'ein' }], ['Anteil Gebäude (' + B.zahl(pct, 2) + ' %) · AfA-Bemessungsgrundlage', B.eur(akB), { art: 'ende' }]])
            + (abw ? '' : '<h3>Aufteilung des Kaufpreises für den Kaufvertrag</h3>' + B.liste([['Grund und Boden', B.eur(vBod)], ['Gebäude', B.eur(vGeb)], ['Kaufpreis Immobilie', B.eur(kpI), { art: 'ende' }]])
              + '<div class="hinweis">Formulierungsvorschlag: „Vom Kaufpreis entfallen ' + B.eur(vGeb) + ' auf das Gebäude und ' + B.eur(vBod) + ' auf Grund und Boden' + (z.inventar ? '; ' + B.eur(z.inventar) + ' entfallen auf mitverkauftes Inventar' : '') + '." Die Aufteilung folgt der Arbeitshilfe des Bundesministeriums der Finanzen; keine Steuerberatung.</div>');
        })()));
      /* v3480 · Inhalt der frueheren „Anlage zur Steuererklaerung" (pdf-anlage-bmf.js, jsPDF): Anschaffungskosten
         im Einzelnen, Verprobung aller drei Verfahren, lineare AfA nach § 7 Abs. 4 EStG. Seit v3018d war dieses
         Dokument nur noch ueber _exportBmfPdfAlt erreichbar (ohne Aufrufer); die Weiche leitet generateBmfPdfAnlage
         jetzt hierher. Gerechnet wird nichts neu: Felder ak_*, Ergebnis der Arbeitshilfe, Afa.linearNachFertigstellung. */
      S.push((function () {
        var ak = [['Kaufpreis (laut Notarvertrag)', zahlAus('ak_kp')], ['Herstellungskosten Gebäude (§ 255 Abs. 2 HGB, zu 100 % Gebäude)', zahlAus('bmf_hk')], ['Grunderwerbsteuer', zahlAus('ak_grest')],
          ['Notar- und Gerichtskosten', zahlAus('ak_notar')], ['Grundbuchamt', zahlAus('ak_gba')], ['Maklergebühr', zahlAus('ak_makler')], ['Sonstige Erwerbsnebenkosten', zahlAus('ak_ji')],
          ['Fahrtkosten', zahlAus('ak_fahrt')], ['Verpflegungsmehraufwand', zahlAus('ak_verpfl')], ['Unterkunft', zahlAus('ak_hotel')], ['Wertgutachten / Sachverständige', zahlAus('ak_gutachten')],
          ['Anwaltskosten (Kaufvorgang)', zahlAus('ak_anwalt')], ['Sonstiges (Vermessung, Energieausweis)', zahlAus('ak_sonst')],
          /* v3511 · Kosten der Kaufpreisaufteilung als Anschaffungsnebenkosten (Vorgabe, kpa-kosten.js) */
          [window.DpKpaKosten ? DpKpaKosten.TEXT_ANK : 'Gutachten zur Kaufpreisaufteilung', window.DpKpaKosten ? DpKpaKosten().ank : 0],
          /* v3986 · F14 Gesamt-Flow 22.11.2026: die Sanierung stand hier IMMER als anschaffungsnahe Herstellungskosten - auch
             unter der 15-%-Grenze, wo sie Erhaltungsaufwand ist (Reiter Sanierung: „Unter Grenze, sofort abziehbar“). Dann gesondert. */
          ['Anschaffungsnahe Herstellkosten (§ 6 Abs. 1 Nr. 1a EStG)', _sanUnterGrenze() ? 0 : zahlAus('ak_ahk')]];
        var akZ = ak.filter(function (x, i) { return i === 0 || (x[1] && x[1] > 0); });
        var akSum = akZ.reduce(function (s, x) { return s + (x[1] || 0); }, 0);
        var akTab = akZ.length > 1 || akSum > 0 ? '<h3>Anschaffungskosten im Einzelnen</h3>' + B.liste(akZ.map(function (x, i) { return [x[0], B.eur(x[1] || 0, 2), i ? { art: 'ein' } : {}]; })
          .concat([[(zahlAus('bmf_hk') > 0 ? 'Anschaffungs- und Herstellungskosten gesamt' : 'Anschaffungskosten gesamt') + ' (Eingaben im Reiter Anschaffungskosten)', B.eur(akSum, 2), { art: 'summe' }]])) : '';
        if (_sanUnterGrenze() && zahlAus('ak_ahk') > 0) akTab += '<p class="det">Sanierung ' + B.eur(zahlAus('ak_ahk'), 2) + ': ' + (function () { var A = window._dpAnschaffungsnah(); return A.wahl === 'auto' ? 'unter der 15-%-Grenze des § 6 Abs. 1 Nr. 1a EStG' : 'als Erhaltungsaufwand gewählt'; })() + ', sofort als Werbungskosten abziehbar. Sie gehört nicht zu den Anschaffungskosten.</p>';   /* v3986 · F14 */
        /* v3510 · Marcel 16.11.2026: „wo ist das Gutachten drin in den Anschaffungskosten von 549 Euro?" Kosten,
           die erst die Abschreibung ermitteln (#kpa_kosten), stehen gesondert - nicht in den Anschaffungskosten. */
        /* v3511 · nur „sofort abziehbar" steht gesondert; als Anschaffungsnebenkosten steht sie oben in der Liste */
        var kpaO = window.DpKpaKosten ? DpKpaKosten() : { ank: 0, sofort: 0 };
        if (kpaO.ank > 0) akTab += '<p class="det">Das Gutachten zur Kaufpreisaufteilung wurde vor dem Kauf beauftragt, sein Ergebnis geht in den Kaufvertrag ein. Es zählt deshalb zu den Anschaffungsnebenkosten und teilt sich wie diese auf Grund und Boden und Gebäude auf.</p>';
        if (kpaO.sofort > 0) akTab += '<h3>Gesondert, nicht in den Anschaffungskosten</h3>' + B.liste([[DpKpaKosten.TEXT_SOFORT, B.eur(kpaO.sofort, 2), { art: 'ende' }]])
          + '<p class="det">Angesetzt sind alle Anschaffungsnebenkosten des Erwerbs (Grunderwerbsteuer, Notar, Grundbuch, Makler, Fahrten zur Besichtigung, ein Wertgutachten zur Kaufentscheidung). Kosten, die erst nach dem Kauf die Abschreibung ermitteln, stehen gesondert und sind im Kaufjahr als Werbungskosten abziehbar.</p>';
        var vgw = w('vergleichswert'); if (!B.istZahl(vgw)) vgw = null;
        var sw = B.istZahl(w('sachwert_marktangepasst')) ? w('sachwert_marktangepasst') : w('sachwert_vorlaeufig'), ew = w('ertragswert'), vw = w('massgebender_verkehrswert');
        var nah = function (a, b2) { return B.istZahl(a) && B.istZahl(b2) && Math.abs(a - b2) < 1; };
        var mass = nah(vw, ew) ? 'ew' : nah(vw, vgw) ? 'vgw' : nah(vw, sw) ? 'sw' : '';
        var verp = '<h3>Bewertungsverfahren (Verprobung)</h3>' + B.liste([
          ['Ertragswertverfahren' + (mass === 'ew' ? ' · maßgebend' : ''), B.eur(ew, 2), mass === 'ew' ? { art: 'summe' } : {}],
          ['Sachwertverfahren (marktangepasst)' + (mass === 'sw' ? ' · maßgebend' : ''), B.eur(sw, 2), mass === 'sw' ? { art: 'summe' } : {}],
          ['Vergleichswertverfahren' + (mass === 'vgw' ? ' · maßgebend' : ''), vgw != null ? B.eur(vgw, 2) : 'nicht angewandt', mass === 'vgw' ? { art: 'summe' } : { det: vgw != null ? '' : 'kein Vergleichsfaktor' }]])
          + '<p class="det">Alle drei Verfahren rechnet die Arbeitshilfe; maßgebend ist das nach ihrer Logik gewählte (bekannte Miete: Ertragswert, Vergleichsfaktor: Vergleichswert, sonst Sachwert).</p>';
        var lin = (window.Afa && Afa.linearNachFertigstellung) ? Afa.linearNachFertigstellung(o.bj) : null;
        var hk = zahlAus('bmf_hk') || 0, basisG = (Number(w('kaufpreisanteil_gebaeude')) || 0) + hk;
        var afaT = '';
        if (lin && basisG > 0) {
          var sel = document.getElementById('afa_satz'), opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
          var gew = sel ? window.Afa.parseSelectValue(sel.value) : null, eig = !!(opt && opt.hasAttribute('data-eigen'));
          afaT = '<h3>Lineare AfA (§ 7 Abs. 4 EStG)</h3>' + B.liste([
            ['AfA-Bemessungsgrundlage Gebäude' + (hk > 0 ? ' (einschließlich Herstellungskosten)' : ''), B.eur(basisG, 2), { art: 'summe' }],
            ['Satz nach Fertigstellung', B.pct(lin.satz, 1), { det: (lin.buchst === 'a' ? 'Fertigstellung nach 2022' : lin.buchst === 'c' ? 'Fertigstellung vor 1925' : 'Fertigstellung 1925 bis 2022') + ' · § 7 Abs. 4 Satz 1 Nr. 2 Buchst. ' + lin.buchst + ' EStG · ' + lin.jahre + ' Jahre' }],
            ['Jährliche AfA nach Fertigstellung', B.eur(basisG * lin.satz / 100, 2), { art: 'ende' }]]
            .concat(gew && gew.methode === 'linear' && Math.abs(gew.satzPct - lin.satz) > 1e-9 ? [['Im Objekt gewählt' + (eig ? ' (eigener Satz, § 7 Abs. 4 Satz 2 EStG)' : ''), B.pct(gew.satzPct, 2), { det: 'jährlich ' + B.eur(basisG * gew.satzPct / 100, 2) }]] : []))
            + afa1925(B, { baujahr: o.bj, afa_satz: sel ? sel.value : '', afa_eigen: eig ? '1' : '', _kpis_afa_geb_basis: basisG }, false).replace(' Die Beträge dieses Blatts sind mit 2,0 % gerechnet.', '');
        }
        return B.seite(c, 'Anschaffungskosten und AfA', B.abschnitt('Anlage zur Steuererklärung', 'Anschaffungskosten, Verprobung und AfA', 'Nachvollziehbarkeit gegenüber dem Finanzamt; keine Steuerberatung.') + akTab + verp + afaT);
      })());
      if (abw) {
        /* v3991 · F13 Gesamt-Flow 22.11.2026: „+146 €“ neben 4.176 und 4.323 €. Unterschied aus den gezeigten, auf Euro gerundeten Werten */
        var d = function (a, b) { var x = Math.round(b) - Math.round(a); return Math.abs(x) < 0.5 ? '' : (x > 0 ? '+ ' : '− ') + B.eur(Math.abs(x)); };
        var basisAlt = T.gebAmtlich + (T.basis - T.geb) * (T.gebPctAmtlich / (T.gebPct || 1));
        S.push(B.seite(c, 'Gewählte Aufteilung', B.abschnitt('Abschnitt 2', 'Gewählte Aufteilung', T.name + ' – neben dem Ergebnis der Arbeitshilfe, die unverändert bleibt.')
          + '<table><thead><tr><th>Position</th><th class="r">Arbeitshilfe</th><th class="r">Gewählt</th><th class="r">Unterschied</th></tr></thead><tbody>'
          + [['Kaufpreis Immobilie (ohne Inventar)', T.immoKp, T.immoKp], ['davon Grund und Boden', T.bodenAmtlich, T.boden], ['davon Gebäude', T.gebAmtlich, T.geb]].map(function (x) {
            return '<tr><td>' + B.esc(x[0]) + '</td><td class="r num">' + B.eur(x[1]) + '</td><td class="r num">' + B.eur(x[2]) + '</td><td class="r num">' + d(x[1], x[2]) + '</td></tr>';
          }).join('')
          + '<tr class="summe"><td>Gebäudeanteil</td><td class="r num">' + B.pct(T.gebPctAmtlich, 2) + '</td><td class="r num">' + B.pct(T.gebPct, 2) + '</td><td class="r num">+ ' + B.zahl(T.gebPct - T.gebPctAmtlich, 2) + ' Pkt.</td></tr>'
          + '<tr><td>AfA-Bemessungsgrundlage Gebäude (mit anteiligen Nebenkosten)</td><td class="r num">' + B.eur(basisAlt) + '</td><td class="r num">' + B.eur(T.basis) + '</td><td class="r num">' + d(basisAlt, T.basis) + '</td></tr>'
          + '<tr class="ende"><td>AfA je Jahr bei ' + B.pct(T.satz, 2) + '</td><td class="r num">' + B.eur(basisAlt * T.satz / 100) + '</td><td class="r num">' + B.eur(T.afa) + '</td><td class="r num">' + d(basisAlt * T.satz / 100, T.afa) + '</td></tr>'
          + '</tbody></table>'
          /* v3188 · Marcel: „wenn wir die umgekehrte Ertragswertmethode nach Jacoby machen … passen wir unser PDF an und
             können da reinschreiben nach Jacoby die Kaufpreisaufteilung“ - der Rechenweg des Servers (jacobyService) Zeile für Zeile */
          + (T.wahl === 'jacoby' && T.jacoby ? (function () {
              var j = T.jacoby, sch = Array.isArray(j.schritte) ? j.schritte : [];
              var wert = function (x) { var v = Number(x.wert); if (x.einheit === '%') return B.pct(v, 2); if (Math.abs(v) < 100 && /faktor/i.test(String(x.text))) return B.zahl(v, 4); return B.eur(v); };
              return '<h3>Herleitung nach der umgekehrten Ertragswertmethode (Jacoby)</h3>'
                + '<p>Liegenschaftszinssatz ' + B.esc(String(j.lzs_pct).replace(".", ",")) + ' %' + (j.lzs_stufe ? ' (Stufe ' + B.esc(j.lzs_stufe) + ')' : '') + (j.ausschuss ? ', ' + B.esc(j.ausschuss) : '')
                + ' · Restnutzungsdauer ' + B.esc(j.rnd_jahre) + ' Jahre' + (j.gnd_jahre ? ' (Gesamtnutzungsdauer ' + B.esc(j.gnd_jahre) + ' Jahre)' : '') + '.</p>'
                + (sch.length ? '<table><tbody>' + sch.map(function (x, i) { return '<tr' + (i === sch.length - 1 ? ' class="ende"' : '') + '><td>' + B.esc(x.text) + '</td><td class="r num">' + wert(x) + '</td></tr>'; }).join('') + '</tbody></table>' : '')
                + '<div class="hinweis">Die umgekehrte Ertragswertmethode ist für vermietete Objekte zulässig (BFH, Urteil vom 20.09.2022, IX R 12/21). Ihre Wahl muss sachlich begründet werden.' + (j.hinweis ? ' ' + B.esc(j.hinweis) : '') + '</div>';
            })() : '')
          + (T.grund ? '<h3>Begründung</h3><p>' + B.esc(T.grund) + '</p>' : '<div class="hinweis" style="border-left-color:var(--rot)">Für die Abweichung von der Arbeitshilfe ist noch keine Begründung eingetragen. Ohne sie kann das Finanzamt die Aufteilung der Arbeitshilfe ansetzen.</div>')
          /* v3481 · Marcel 16.11.2026: „Abschreibung je Aufteilung“ wie in der klassischen Fassung (Wilhelm-Busch-Str.):
             Pauschale 2 % und jedes Jahr der Spanne aus Schritt 5 („Restnutzungsdauer von / bis“), amtlich gegen gewählt.
             Bis v3480 nur die gewählte Spalte und nur mit Spanne. */
          + (function () {
              var linP = (window.Afa && Afa.linearNachFertigstellung && Afa.linearNachFertigstellung(o.bj)) || { satz: 2 };   /* nach Fertigstellung, nicht fest 2 % */
              var zeilen = [[linP.satz, 'gesetzliche Pauschale']];
              var von = Math.round(Number(T.rndVon) || 0), bis = Math.round(Number(T.rndBis) || 0);
              if (von && bis && bis > von && bis - von <= 25) { for (var n = von; n <= bis; n++) zeilen.push([100 / n, 'Restnutzungsdauer ' + n + ' Jahre']); }
              else if (von) zeilen.push([100 / von, 'Restnutzungsdauer ' + von + ' Jahre']);
              var dd = function (a, b) { var x = Math.round(b) - Math.round(a); return x === 0 ? '0 €' : (x > 0 ? '+' : '−') + B.zahl(Math.abs(x), 0) + ' €'; };
              return '<h3>Abschreibung je Aufteilung</h3><table><thead><tr><th>AfA-Satz</th><th class="r">Arbeitshilfe</th><th class="r">Gewählt</th><th class="r">Unterschied</th></tr></thead><tbody>'
                + zeilen.map(function (z) { return '<tr><td>' + B.pct(z[0], 2) + ' · ' + B.esc(z[1]) + '</td><td class="r num">' + B.eur(basisAlt * z[0] / 100) + '</td><td class="r num">' + B.eur(T.basis * z[0] / 100) + '</td><td class="r num">' + dd(basisAlt * z[0] / 100, T.basis * z[0] / 100) + '</td></tr>'; }).join('')
                + '</tbody></table><p class="det">AfA je Jahr auf die jeweilige Bemessungsgrundlage. Die Pauschale von ' + B.pct(linP.satz, 2) + ' folgt § 7 Abs. 4 Satz 1 Nr. 2 EStG (nach dem Jahr der Fertigstellung)'
                + (zeilen.length > 1 ? '; ein höherer Satz aus einer kürzeren Nutzungsdauer folgt § 7 Abs. 4 Satz 2 EStG und setzt deren Nachweis voraus, in der Regel ein Gutachten zur Restnutzungsdauer' : '') + '.</p>';
            })()));
      }
      if (T && T.klausel) {
        S.push(B.seite(c, 'Vertragstext und Begründung', B.abschnitt('Abschnitt ' + (abw ? 3 : 2), 'Text für den Kaufvertrag', 'Wortlaut für die Urkunde; die Begründung darunter ist für Rückfragen des Finanzamts.')
          + '<div class="zitat" style="white-space:pre-line">' + B.esc(T.klausel.trim()) + '</div>'
          + (T.hinweis ? '<p class="det">' + B.esc(T.hinweis) + '</p>' : '')
          + (T.zusatz ? '<h3>Ergänzende Begründung</h3><div class="fliess" style="white-space:pre-line">' + B.esc(T.zusatz.replace(/^Ergänzende Begründung[^\n]*\n+/, '')) + '</div>' : '')
          + '<div class="hinweis">Keine Steuerberatung. Die Anerkennung der Aufteilung hängt von ihrer wirtschaftlichen Plausibilität und der Prüfung durch das Finanzamt ab.</div>'));
      }
      return B.dokument('Kaufpreisaufteilung · ' + o.adresse, S);
    });
  }

  /* ── 5 · Finanzamt (Werbungskosten), wahlweise mit Anlage V ─────────
     v3180 · Marcel 04.11.2026: „Werbungskosten müssen untereinander stehen und wir haben auch eine
     fassung mit Anlage V das müsste auch angepasst werden." Einnahmen, Werbungskosten und Ergebnis
     stehen jetzt in EINER Spalte untereinander. Die Anlage-V-Fassung setzt je Jahr ein Blatt mit der
     Zeilenzuordnung dahinter - dieselbe Zuordnung wie werbungskosten-pdf.js (_renderAnlageVPage):
     AnlageV<Jahr>.felder, Ersatzjahr mit Vorbehalt vor der ersten Zahl, Kennzeichen * und °,
     § 7b getrennt in Zeile 38, Summe Zeile 83, Ueberschuss Zeile 85. */
  /* v3920 · Die Gliederung kommt aus dem Kern (AnlageVKern.BLOECKE, js/anlage-v-kern.js): Bloecke A bis F mit
     denselben Zeilentexten und Zeilennummern wie das Steuerformular. Bis v3910 stand hier eine eigene Liste
     „1. Finanzierungskosten" bis „6. Anschaffungsnahe Herstellungskosten / Erhaltung" (WK, WK_NAME).
     WK_FELDER sind dieselben 24 Steuerzeilen wie dort (die Spalten von tax_records ohne Kaltmiete und Umlagen),
     die Summe der Werbungskosten rechnet unveraendert: Summe dieser Felder plus Wirkung der Angaben der Anlage V. */
  function wkFelder() { return (window.AnlageVKern && AnlageVKern.BASIS ? AnlageVKern.BASIS : []).filter(function (f) { return f !== 'einnahmen_km' && f !== 'einnahmen_nk'; }); }
  function satzFelder() { return wkFelder().concat(['einnahmen_km', 'einnahmen_nk']); }
  function wkBasis(v) { return wkFelder().reduce(function (a, f) { return a + (Number(v[f]) || 0); }, 0); }
  function anteilZeile(B, w) {
    return w.anteilMinus > 0.005 ? ['Nicht abzugsfähiger Anteil der Werbungskosten aus B bis E (verhältnismäßige Zuordnung, abzugsfähig ' + String(Math.round(w.anteil * 100) / 100).replace('.', ',') + ' %)', B.eurS(-w.anteilMinus, 2), { art: 'ein' }] : null;
  }
  /* Aufstellung nach den Bloecken A bis F als Zeilen fuer B.liste. Einnahmen (A) und Werbungskosten (B bis E) mit
     Zwischensumme je Block, F (Angaben zum Objekt) ohne. Betraege aus v, nichts neu gerechnet. */
  function blockZeilen(B, jahr, v, opt, nurBloecke) {
    var K = window.AnlageVKern; if (!K || !K.aufstellungBloecke) return { zeilen: [], A: null };
    var A = K.aufstellungBloecke(jahr, v, opt), z = [];
    A.bloecke.forEach(function (bl) {
      if (nurBloecke && nurBloecke.indexOf(bl.k) < 0) return;
      z.push([bl.k + ' · ' + bl.titel, bl.mitSumme ? B.eurS(bl.summe, 2) : '', { art: 'summe', det: bl.bereich ? 'Anlage V ' + jahr + ', Zeilen ' + bl.bereich[0] + ' bis ' + bl.bereich[1] : '' }]);
      bl.rows.forEach(function (r) {
        var w = r.flag ? (Math.round(r.betrag) === 1 ? '1 = Ja' : Math.round(r.betrag) === 2 ? '2 = Nein' : String(Math.round(r.betrag)))
          : (r.einheit && r.einheit !== '€') ? B.zahl(r.betrag, 2) + ' ' + r.einheit : B.eurS(r.betrag, 2);
        z.push([(A.mitNummern && r.nr != null ? 'Z. ' + r.nr + ' · ' : '') + (r.davon ? '   ' : '') + r.text, w, { art: 'ein' }]);
      });
    });
    return { zeilen: z, A: A };
  }

  /* v3480 · Veranlagungsart des Jahres - derselbe Weg wie die Steuerrechnung (Tax.optionen: der
     Steuerzeitraum des Jahres vor dem Investmentprofil). Fehlte bis v3472 in jedem Steuer-PDF. */
  function veranlagung(jahr) {
    try {
      var T = (typeof Tax !== 'undefined') ? Tax : window.Tax;
      if (!T || typeof T.optionen !== 'function') return null;
      var o = T.optionen(null, jahr) || {};
      var k = Number(o.kist) > 0 ? 'Kirchensteuer ' + String(Math.round(Number(o.kist) * 100)) + ' %' : 'ohne Kirchensteuer';
      return { art: o.splitting ? 'Zusammenveranlagung (Splitting, § 32a Abs. 5 EStG)' : 'Einzelveranlagung', kurz: o.splitting ? 'Zusammenveranlagung' : 'Einzelveranlagung',
               kist: k, quelle: o.quelle === 'zeitraum' ? 'laut Steuerzeitraum ' + jahr : 'laut Investmentprofil' };
    } catch (e) { return null; }
  }
  /* v3480 · Warnung AfA-Satz vor 1925 im Dokument - Regel in afa-engine.js. d = Objektdaten (gespeichert). */
  function afa1925(B, d, corp) {
    try {
      if (!window.Afa || typeof Afa.pruefeSatzFertigstellung !== 'function') return '';
      var r = Afa.pruefeSatzFertigstellung({ baujahr: d.baujahr, afaSatz: d.afa_satz, eigen: !!String(d.afa_eigen || '').trim(), basis: Number(d._kpis_afa_geb_basis) || null, gesellschaft: !!corp });
      return r.warnen ? '<div class="hinweis" style="border-left-color:var(--rot);background:#FAF0EC"><b>' + B.esc(r.titel) + '.</b> ' + B.esc(r.text) + ' Die Beträge dieses Blatts sind mit 2,0 % gerechnet.</div>' : '';
    } catch (e) { return ''; }
  }
  /* v3480 · Ertragsteuer einer Gesellschaft je Objekt (Kanzlei N-04, Marcel 16.11.2026): ein Verlust
     bringt KEINE Erstattung - er wird mit Gewinnen der Gesellschaft verrechnet oder vorgetragen.
     Bis v3472 stand dort „+ x €“ unter „Belastung −“, also eine Erstattung. */
  function steuerZeileGes(B, steuer, ergebnis) {
    var s = Number(steuer) || 0, e = Number(ergebnis) || 0;
    if (s > 0.5) return ['Ertragsteuer der Gesellschaft auf dieses Objekt (KSt, Soli, GewSt)', B.eurS(-s, 0), { farbe: 1 }];
    if (e < 0) return ['Ertragsteuer der Gesellschaft auf dieses Objekt', '0 €', { det: 'Verlust ' + B.eur(-e, 2) + ' – keine Erstattung: er mindert das Ergebnis der Gesellschaft und wird mit ihren Gewinnen verrechnet, sonst als Verlustvortrag fortgeführt (§ 8 Abs. 1 KStG i. V. m. § 10d EStG, § 10a GewStG).' }];
    return ['Ertragsteuer der Gesellschaft auf dieses Objekt', '0 €'];
  }

  /* v3800 · Die Zuordnung kommt aus EINEM Kern (js/anlage-v-kern.js), dieselbe wie im Werbungskosten-PDF und
     im Tooltip. STRENG: nur die Abschrift des Jahres. Bis v3800 nahm dieses Blatt fuer 2026 die Nummern von 2025
     (mit rotem Vorbehalt) und schrieb „Zeile 32/38/83/85" fest - fuer jedes andere Formularjahr alte Nummern.
     Ohne Abschrift steht statt des Blatts ein Satz, warum es fehlt. */
  function anlageVQuelle(jahr) {
    var K = window.AnlageVKern; return K && K.tabelle(jahr) ? { T: K.tabelle(jahr), jahr: jahr, ersatz: null } : null;
  }
  function anlageVFehlt(B, jahr) {
    var K = window.AnlageVKern, j = K ? K.jahre() : [];
    return '<div class="hinweis"><b>Anlage V ' + jahr + ': Zuordnung noch nicht verfügbar.</b> Der amtliche Vordruck für das Veranlagungsjahr ' + jahr
      + ' ist in DealPilot noch nicht abgeschrieben. Zeilennummern und Kennzahlen ändern sich je Jahr, deshalb druckt DealPilot keine Nummern eines anderen Jahres'
      + (j.length ? ' (abgeschrieben: ' + j.join(', ') + ')' : '') + '. Die Beträge in der Aufstellung gelten unverändert.</div>';
  }
  /* weitere Angaben der Anlage V als Zeilen der Aufstellung und ihre Wirkung (dieselbe Rechnung wie tax.js) */
  function avAufstellung(v, wkVoll) {
    /* v3920 · die Zeilen stehen jetzt in den Bloecken A bis F (blockZeilen), hier bleibt die Wirkung (dieselbe Rechnung wie tax.js) */
    var K = window.AnlageVKern;
    if (!K) return { w: { ein: 0, wk: 0, kuerzung: 0, anteil: 100, anteilMinus: 0 } };
    return { w: K.wirkung(v, wkVoll) };
  }
  function anlageVBlatt(B, jahr, tot) {
    var K = window.AnlageVKern; if (!K || !tot) return '';
    /* v3920 · Zeilentexte aus der Gliederung A bis F im Kern (dieselben wie im Steuerformular), Bloecke A bis F in
       derselben Reihenfolge, Summe der Einnahmen nach A, Summe der Werbungskosten und Ueberschuss nach E.
       Betraege und Zeilennummern unveraendert aus K.aufstellung. Bis v3910 eigene Bezeichnungen (WK_NAME). */
    var R = K.aufstellung(jahr, tot); if (!R) return anlageVFehlt(B, jahr);
    var zl = function (nr, kz, text, betrag, o) { return '<tr class="' + ((o && o.art) || '') + '"><td class="num" style="width:17mm">' + (nr == null ? '' : 'Zeile ' + B.esc(nr)) + '</td><td class="num det" style="width:13mm">' + (kz ? 'Kz ' + B.esc(kz) : '') + '</td><td>' + B.esc(text) + '</td><td class="r num' + ((o && o.farbe) || '') + '">' + (betrag == null ? '' : B.esc((o && o.einheit && o.einheit !== '€') ? B.zahl(betrag, 0) + ' ' + o.einheit : B.eur(betrag, 2))) + '</td></tr>'; };
    var titel = {}; (K.BLOECKE || []).forEach(function (b) { titel[b.k] = b.k + ' · ' + b.titel; });
    var im = function (liste, k) { return liste.filter(function (e) { return e.block === k; }); };
    var h = '';
    if (R.hinweise.length) h += R.hinweise.map(function (x) { return '<div class="hinweis">' + B.esc(x) + '</div>'; }).join('');
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(function (k) {
      var L = k === 'A' ? im(R.einnahmen, k) : im(R.wk, k), I = im(R.info, k), mitZ = k === 'F' && R.zurechnung;
      var zeilen = L.map(function (e) { return zl(e.zeile, e.kz, (e.teil ? '   ' : '') + e.text, e.betrag, e.teil ? { art: 'ein' } : null); })
        .concat(I.map(function (e) { return zl(e.zeile, e.kz, e.text, e.betrag, { einheit: e.einheit }); }));
      if (k === 'A') zeilen.push(zl(R.summeEinnahmen.zeile, null, 'Summe der Einnahmen', R.summeEinnahmen.betrag, { art: 'summe' }));
      /* v3800b · Zeile 86: Zurechnung Person A / Person B */
      if (mitZ) zeilen.push(zl(R.zurechnung.zeile, R.zurechnung.kz, 'Zurechnung des Überschusses: Person A (' + B.esc(String(R.zurechnung.pct).replace('.', ',')) + ' %)', R.zurechnung.a)
        + (R.zurechnung.pct < 100 ? zl(null, null, 'Person B (' + B.esc(String(Math.round((100 - R.zurechnung.pct) * 100) / 100).replace('.', ',')) + ' %)', R.zurechnung.b) : ''));
      if (k === 'E' && !R.wk.length) zeilen.push('<tr><td colspan="4" class="det">Keine Position mit Betrag erfasst.</td></tr>');
      if (zeilen.length) h += '<h3>' + B.esc(titel[k] || k) + '</h3><table><tbody>' + zeilen.join('') + '</tbody></table>';
      if (k === 'B' && R.afaHinweis) h += '<p class="det">' + B.esc(R.afaHinweis.text) + '</p>';
      if (k === 'E') {
        h += '<p class="det">Ohne Zeichen: die Kostenart steht wörtlich in der Überschrift der Formularzeile (Abschrift). * steht in keiner spezielleren Zeile, das Formular führt dafür „Sonstige Kosten“. ° folgt aus der Art des Aufwands, nicht aus dem Formulartext, Begründung unten.</p>';
        if (R.sach.length) h += '<div class="block"><h3>° Zuordnung aus der Art des Aufwands, bitte prüfen</h3>' + R.sach.map(function (x) { return '<p class="det">' + B.esc(x) + '</p>'; }).join('') + '</div>';
        if (R.ohne.length) h += '<div class="block"><h3>Ohne Zeilenzuordnung, bitte steuerlich prüfen</h3><p class="det">Diese Beträge sind erfasst und in der Summe enthalten. Die Zeile wäre eine steuerfachliche Entscheidung und keine Abschrift aus dem Formular.</p><table><tbody>'
          + R.ohne.map(function (o) { return zl(null, null, o.text + (o.grund ? ', ' + o.grund : ''), o.betrag); }).join('') + '</tbody></table></div>';
        h += '<table style="margin-top:4mm"><tbody>' + zl(R.summeWk.zeile, null, 'Summe der Werbungskosten', R.summeWk.betrag, { art: 'summe' })
          + zl(R.ueberschuss.zeile, null, 'Überschuss (Einnahmen Zeile ' + R.summeEinnahmen.zeile + ' abzüglich Werbungskosten Zeile ' + R.summeWk.zeile + ')', R.ueberschuss.betrag, { art: 'ende', farbe: R.ueberschuss.betrag < 0 ? ' neg' : ' pos' }) + '</tbody></table>';
        if (R.kuerzung) h += '<p class="det">' + B.esc(R.kuerzung.text) + '</p>';
      }
    });
    if (R.nichtErfasst.length) h += '<div class="block"><h3>Im Formular selbst auszufüllen</h3>' + R.nichtErfasst.map(function (n) { return '<p class="det">Zeile ' + n.zeile + ' · ' + B.esc(String(n.text || '').replace(/`/g, '')) + '</p>'; }).join('') + '</div>';
    return h + '<p class="det">Dieselben Zahlen wie die Aufstellung, sortiert nach den Blöcken A bis F des Steuerformulars und den Zeilen des amtlichen Formulars Anlage V ' + R.jahr + ' (' + B.esc(R.formular || '') + (R.stand ? ', Stand ' + B.esc(R.stand) : '') + '). Keine Steuerberatung.</p>';
  }
  /* v3181 · opt.jahr = ein Jahr (Index wie fa-pdf-year), opt.alle = alle Jahre (wie „all-years", hoechstens 15) */
  function finanzamt(jahre, mitAnlageV, opt) {
    opt = opt || {};
    var alle = (State.cfRows || []).slice(0, 15);
    var B = D(), o = objektKopf(), rows = opt.alle ? alle : (Number.isInteger(opt.jahr) && alle[opt.jahr]) ? [alle[opt.jahr]] : alle.slice(0, jahre || 3);
    var idx0 = (Number.isInteger(opt.jahr) && !opt.alle && alle[opt.jahr]) ? opt.jahr : 0;
    /* v3268 · Halter GmbH/UG: „Betriebsausgaben", keine Anlage V (Einkuenfte aus
       Gewerbebetrieb, § 8 Abs. 2 KStG). GbR: Werbungskosten plus Feststellung § 180 AO. */
    var bg = (window._dpBegriff ? window._dpBegriff() : { corp: false, wort: 'Werbungskosten' });
    if (bg.corp) mitAnlageV = false;
    var name = bg.corp ? 'Betriebsausgaben · Gesellschaft' : (mitAnlageV ? 'Werbungskosten · Anlage V' : 'Werbungskosten · Finanzamt');
    var _hId = feld('halter'), _hName = '';
    try { var _hm = (_hId && _hId !== 'privat' && window.DealPilotMandanten) ? DealPilotMandanten.get(_hId) : null; _hName = (_hm && _hm.id === _hId) ? _hm.name : ''; } catch (_eH) {}
    return Promise.all([basis(name), objektInfo(window._currentObjKey, o.adresse)]).then(function (zz) {
      var c = zz[0], info = zz[1]; c.zeile = o.adresse;
      var S = [], ges = [];
      var _sel = document.getElementById('afa_satz'), _opt = _sel && _sel.selectedIndex >= 0 ? _sel.options[_sel.selectedIndex] : null;
      var _afaH = afa1925(B, { baujahr: feld('baujahr'), afa_satz: feld('afa_satz'), afa_eigen: (_opt && _opt.hasAttribute('data-eigen')) ? '1' : '',
        _kpis_afa_geb_basis: (State._afaStempel && State._afaStempel.geb) || null }, bg.corp);   /* v3480 */
      var _vl0 = bg.corp ? null : veranlagung(rows.length ? rows[0].cal : new Date().getFullYear());
      S.push(B.deckblatt(c, { bild: info.fotos[0] || info.karte || null, eyebrow: bg.corp ? 'Aufstellung Betriebsausgaben · Objekt in der Gesellschaft' : ('Aufstellung Werbungskosten' + (mitAnlageV ? ' mit Zuordnung zur Anlage V' : ' · Anlage V')), titel: o.adresse, unter: o.art + ' · vermietet',
        meta: [['Veranlagungsjahre', rows.map(function (r) { return r.cal; }).join(', ')], ['Stand', c.stand], ['Eigentümer', _hName || (_hId && _hId !== 'privat' ? _hId : (c.marke.name || c.marke.company || ''))]]
          .concat(_vl0 ? [['Veranlagung', _vl0.kurz + (rows.length > 1 ? ' (' + rows[0].cal + ')' : '')]] : []) }));
      rows.forEach(function (row, i) {
        var t = _computeYearTotal(row.cal, i + idx0) || {}, v = t.values || {};
        var ein = (Number(v.einnahmen_km) || 0) + (Number(v.einnahmen_nk) || 0);
        var summe = wkBasis(v);
        /* v3800 · weitere Angaben der Anlage V (dieselbe Wirkung wie in tax.js) */
        var _avA = avAufstellung(v, summe);
        ein += _avA.w.ein;
        /* v3920 · Bloecke A bis E wie das Steuerformular, F (Angaben zum Objekt) am Ende */
        var _bo = { corp: bg.corp, afaArt: t.afaArt || null, erhG: t.erhG, afaSonder7b: t.afaSonder7b, erhV: t.erhV };
        var tab = blockZeilen(B, row.cal, v, _bo, ['A', 'B', 'C', 'D', 'E']).zeilen;
        var _anZ = anteilZeile(B, _avA.w); if (_anZ) tab.push(_anZ);
        summe += _avA.w.wk;
        tab.push(['Summe ' + bg.wort + ' ' + row.cal, B.eur(summe, 2), { art: 'summe' }]);
        if (_avA.w.kuerzung > 0.005) tab.push(['Kürzung wegen verbilligter Vermietung (§ 21 Abs. 2 EStG)', B.eurS(_avA.w.kuerzung, 2), { det: 'Die Werbungskosten stehen im Formular in voller Höhe, das Finanzamt kürzt sie.' }]);
        var _erg = ein - summe + _avA.w.kuerzung;
        tab.push([bg.corp ? 'Beitrag zum Ergebnis der Gesellschaft (vor Steuern)' : 'Einkünfte aus Vermietung und Verpachtung', B.eurS(_erg, 2), { art: 'ende', farbe: 1 }]);
        /* v3480 · Gesellschaft: kein „Erstattung +“ bei Verlust (N-04); privat: Veranlagungsart des Jahres */
        if (bg.corp) tab.push(steuerZeileGes(B, row.tax_y, _erg));
        else {
          tab.push(['Steuerwirkung (Erstattung +, Belastung −)', B.eurS(-(row.tax_y || 0), 0), { farbe: 1 }]);
          var _vl = veranlagung(row.cal);
          if (_vl) tab.push(['Veranlagung ' + row.cal, _vl.kurz, { det: _vl.art + ' · ' + _vl.kist + ' · ' + _vl.quelle }]);
        }
        blockZeilen(B, row.cal, v, _bo, ['F']).zeilen.forEach(function (x) { tab.push(x); });   /* v3920 */
        ges.push([String(row.cal), B.eur(ein, 2), B.eur(summe, 2), B.eurS(_erg, 2)]);
        /* v3268 · GbR: gesonderte und einheitliche Feststellung § 180 AO */
        var _fs = (!bg.corp && window._dpGbrFeststellung) ? window._dpGbrFeststellung(row.cal, _erg) : null;
        var _fsHtml = _fs ? '<h3>Gesonderte und einheitliche Feststellung (§ 180 AO) · ' + B.esc(_fs.name || 'GbR') + '</h3><table><thead><tr><th>Gesellschafter</th><th class="r">Anteil</th><th class="r">Einkünfte</th></tr></thead><tbody>'
          + '<tr class="summe"><td>Einkünfte der GbR (V+V' + (_fs.objekte > 1 ? ', ' + _fs.objekte + ' Objekte' : '') + ')</td><td class="r num">100 %</td><td class="r num">' + B.eurS(_fs.einkuenfte, 2) + '</td></tr>'
          + _fs.zeilen.map(function (z) { return '<tr><td>' + B.esc(z.name) + '</td><td class="r num">' + String(Math.round(z.anteilPct * 100) / 100).replace('.', ',') + ' %</td><td class="r num">' + B.eurS(z.betrag, 2) + '</td></tr>'; }).join('')
          + '</tbody></table><p class="det">In die Einkommensteuer des Nutzers geht nur sein Anteil (' + B.eurS(_fs.eigenerBetrag, 2) + ').'
          + (_fs.vollstaendig ? '' : ' Die Anteile ergeben zusammen ' + String(Math.round(_fs.summePct * 100) / 100).replace('.', ',') + ' % — bitte die weiteren Gesellschafter im Mandanten ergänzen.')
          + ' Sonderwerbungskosten und Ergänzungsbilanzen einzelner Gesellschafter sind nicht abgebildet. Keine Steuerberatung.</p>' : '';
        S.push(B.seite(c, 'Jahr ' + row.cal, B.abschnitt('Veranlagungsjahr ' + row.cal, (bg.corp ? 'Betriebseinnahmen und Betriebsausgaben ' : 'Einnahmen und Werbungskosten ') + row.cal, o.adresse) + _afaH + B.liste(tab) + _fsHtml
          + (bg.corp ? '<p class="det" style="margin-top:3mm">Die Kosten der Gesellschaft selbst (Buchführung, Jahresabschluss, IHK, Kontoführung) stehen nicht hier, sondern in der Steuer der Gesellschaft (Einstellungen › Mandanten). Eine Anlage V gibt es für eine GmbH/UG nicht. '
            + ((window.DealPilotUeberfuehrungKern && DealPilotUeberfuehrungKern.HINWEIS_VERKAUF_GES) || '') + '</p>' : '')));
        if (mitAnlageV) { var av = anlageVBlatt(B, row.cal, t); if (av) S.push(B.seite(c, 'Anlage V ' + row.cal, B.abschnitt('Anlage V · Zuordnung', 'Veranlagungsjahr ' + row.cal, 'Dieselben Zahlen, sortiert nach den Zeilen des amtlichen Formulars') + av)); }
      });
      S.push(B.seite(c, 'Übersicht', B.abschnitt('Übersicht', 'Alle Jahre im Vergleich') + '<table><thead><tr><th>Jahr</th><th class="r">Einnahmen</th><th class="r">' + bg.wort + '</th><th class="r">' + (bg.corp ? 'Ergebnis' : 'Einkünfte') + '</th></tr></thead><tbody>'
        + ges.map(function (g) { return '<tr><td class="num">' + g[0] + '</td><td class="r num">' + g[1] + '</td><td class="r num">' + g[2] + '</td><td class="r num">' + g[3] + '</td></tr>'; }).join('') + '</tbody></table>'
        + '<p class="det" style="margin-top:3mm">' + (mitAnlageV ? 'Die Zuordnung zu den Zeilen der Anlage V steht je Jahr auf einem eigenen Blatt.' : 'Zuordnung zur Anlage V nach den Zeilen des jeweiligen Veranlagungsjahres: Fassung „mit Anlage V“.') + ' Keine Steuerberatung.</p>'));
      return B.dokument(name + ' · ' + o.adresse, S);
    });
  }

  /* ── 5b · Steuer-Mappe (v3471, Portfolio: mehrere Objekte, ein Veranlagungsjahr) ──
     Marcel 16.11.2026: „du hast da die alten Vorlagen genommen. Das darf gar nicht sein.“
     Gemessen: der Knopf „Steuer-Mappe erstellen“ im Portfolio-Cockpit (dashboard.js steuerMappe)
     rief exportSteuerMappePDF (werbungskosten-pdf.js, jsPDF) — dok-weiche.js umhuellte sie nicht.
     Jetzt dasselbe Dokument im einheitlichen Design. Quelle sind die GESPEICHERTEN Steuersaetze des
     Jahres (GET /tax-records), nicht das gerade geoeffnete Objekt: eine Mappe ueber mehrere Objekte
     darf keines in den Editor laden. Die Spalten von tax_records heissen wie die Felder der WK-Liste,
     die Zuordnung zur Anlage V ist dieselbe Funktion wie im Einzel-PDF (anlageVBlatt).
     opt: { jahr, anlageV (Vorgabe an), ids: [object_id …] (Vorgabe: alle mit Satz im Jahr) } */
  function steuermappe(opt) {
    opt = opt || {};
    var jahr = parseInt(opt.jahr, 10) || (new Date().getFullYear() - 1);
    var mitAV = opt.anlageV !== false;
    var B = D(), num = function (x) { var n = Number(x); return isFinite(n) ? n : 0; };
    var deIso = function (iso) { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? String(iso).slice(8, 10) + '.' + String(iso).slice(5, 7) + '.' + String(iso).slice(0, 4) : ''; };
    /* v3700 · P2: opt.kunde = client_id: Steuer-Mappe eines Kunden beim Partner, aus den fuer ihn weitergefuehrten Objekten,
       gebaut mit SEINEM Steuerprofil (DpSteuerKontext.mit). Ohne Profil keine Mappe, nie mit den Daten des Partners. */
    var kunde = /^[0-9a-f-]{36}$/i.test(String(opt.kunde || '')) ? String(opt.kunde) : null;
    return Promise.all([basis('Steuer-Mappe ' + jahr), api('/tax-records?from=' + jahr + '&to=' + jahr + (kunde ? '&kunde=' + encodeURIComponent(kunde) : '')),
      kunde ? api('/partner/kunden/' + encodeURIComponent(kunde) + '/steuerprofil') : null]).then(function (zz) {
      var sp = zz[2], prof = sp && sp.aktuell && sp.aktuell.profil;
      if (kunde && !prof) throw nutzerFehler('Für diesen Kunden liegt kein Steuerprofil vor. Ohne seine freigegebenen Steuerdaten erstellt DealPilot keine Steuer-Mappe.');
      var c = zz[0], saetze = ((zz[1] && zz[1].records) || []).filter(function (s) { return Number(s.year) === jahr; });
      if (Array.isArray(opt.ids) && opt.ids.length) saetze = saetze.filter(function (s) { return opt.ids.indexOf(s.object_id) >= 0; });
      if (!saetze.length) throw nutzerFehler('Für ' + jahr + ' sind keine Steuersätze gespeichert.');
      return Promise.all(saetze.map(function (s) { return api('/objects/' + encodeURIComponent(s.object_id)).catch(function () { return null; }); })).then(function (objs) {
        var gesSt = {};   /* v3701 · G-05: Steuerreihe je Gesellschaft (halterId -> DpGesSteuer.reihe), vor bauen() geholt */
        /* v3702 · opt.halter: Steuer-Mappe EINER Gesellschaft (Marcel 18.11.2026: „ein Dokument, wo dann alles zusammen draufsteht“) */
        var gesMappe = (opt.halter && opt.halter !== 'privat') ? String(opt.halter) : null, gesName = null;
        if (gesMappe) {
          var _ix = []; objs.forEach(function (oo, i) { var dd = (oo && (oo.object || oo) && (oo.object || oo).data) || {}; if (String(dd.halter || 'privat') === gesMappe) _ix.push(i); });
          if (!_ix.length) throw nutzerFehler('Für ' + jahr + ' gibt es keine gespeicherten Jahreswerte von Objekten dieser Gesellschaft. Objekte der Gesellschaft öffnen und speichern, dann erneut erstellen.');
          saetze = _ix.map(function (i) { return saetze[i]; }); objs = _ix.map(function (i) { return objs[i]; });
          try { var _gm = DealPilotMandanten.get(gesMappe); gesName = _gm && _gm.name; } catch (eG) {}
        }
        var bauen = function () {   /* v3700 · synchron, damit der Kontext des Kunden genau diesen Lauf umfasst */
        var eintr = saetze.map(function (s, i) {
          var o = objs[i] && (objs[i].object || objs[i]), d = (o && o.data) || {};
          var adr = [[d.str, d.hnr].filter(Boolean).join(' '), [d.plz, d.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || (o && o.name) || 'Objekt';
          var hId = String(d.halter || 'privat'), m = null;
          try { m = (hId !== 'privat' && window.DealPilotMandanten) ? DealPilotMandanten.get(hId) : null; if (m && m.id !== hId) m = null; } catch (e) { m = null; }
          var corp = !!(m && window.DealPilotMandanten && DealPilotMandanten.isCorp && DealPilotMandanten.isCorp(m.rechtsform));
          var v = {}; satzFelder().forEach(function (f) { v[f] = num(s[f]); });
          /* v3800 · weitere Angaben der Anlage V aus dem gespeicherten Satz (tax_records.anlage_v) */
          var avS = (s.anlage_v && typeof s.anlage_v === 'object') ? s.anlage_v : {};
          if (window.AnlageVKern) AnlageVKern.SCHLUESSEL.forEach(function (k) { v[k] = num(avS[k]); });
          var ein = v.einnahmen_km + v.einnahmen_nk, wk = wkBasis(v);
          var avA = avAufstellung(v, wk); ein += avA.w.ein; wk += avA.w.wk;
          return { s: s, d: d, adr: adr, art: OBJART[d.objart] || d.objart || 'Immobilie', halter: m ? m.name : 'Privat', corp: corp, v: v, ein: ein, wk: wk, erg: ein - wk + avA.w.kuerzung, avA: avA, avS: avS,
                   kauf: d.kaufdat || '', vermerk: (function () {
                     if (String(d.obj_herkunft || '') === 'ueberfuehrung') return 'Aus dem Privatbestand überführt zum ' + deIso(d.halter_seit || d.kaufdat) + '. Anschaffungskosten und AfA der Gesellschaft gelten ab diesem Stichtag.'
                       + (String(d.halter_seit || d.kaufdat || '').slice(0, 4) === String(jahr) ? ' ' + jahr + ' ist das Jahr des Wechsels: die Beträge decken nur die Monate ab dem Stichtag.' : '');
                     if (d.ueberf_ende) return 'In eine Gesellschaft überführt zum ' + deIso(d.ueberf_ende) + '; privat zählen nur die Monate davor.'
                       + (String(d.ueberf_ende).slice(0, 4) === String(jahr) ? ' ' + jahr + ' ist das Jahr des Wechsels.' : '');
                     return '';
                   })() };
        }).sort(function (a, b) { return String(a.kauf || '9999').localeCompare(String(b.kauf || '9999')) || a.adr.localeCompare(b.adr); });
        var priv = eintr.filter(function (e) { return !e.corp; }), ges = eintr.filter(function (e) { return e.corp; });
        var vl = priv.length ? veranlagung(jahr) : null;   /* v3480 */
        var S = [];
        S.push(B.deckblatt(c, { bild: null, eyebrow: gesMappe ? 'Steuer-Mappe der Gesellschaft · Geschäftsjahr ' + jahr : 'Steuer-Mappe · Veranlagungsjahr ' + jahr, titel: gesMappe ? 'Steuer-Mappe ' + (gesName || 'der Gesellschaft') + ' ' + jahr : 'Steuer-Mappe ' + jahr,
          unter: priv.length && ges.length ? 'Vermietung und Verpachtung (Anlage V) und Objekte in Gesellschaften' : (ges.length ? 'Objekte in Gesellschaften · Betriebsausgaben' : 'Vermietung und Verpachtung · Anlage V · § 21 EStG'),
          meta: [['Veranlagungsjahr', String(jahr)], ['Objekte', String(eintr.length)], ['Stand', c.stand]].concat(vl ? [['Veranlagung', vl.kurz], ['Kirchensteuer', vl.kist.replace('Kirchensteuer ', '')]] : []) }));
        /* Inhalt */
        S.push(B.seite(c, 'Inhalt', B.abschnitt('Steuer-Mappe ' + jahr, 'Enthaltene Objekte', 'In der Reihenfolge des Kaufs')
          + '<table><thead><tr><th>Nr.</th><th>Objekt</th><th>Halter</th><th>Kauf</th><th class="r">Einnahmen</th><th class="r">' + (ges.length && !priv.length ? 'Betriebsausgaben' : 'Kosten') + '</th><th class="r">Ergebnis</th></tr></thead><tbody>'
          + eintr.map(function (e, i) { return '<tr><td class="num">' + (i + 1) + '</td><td>' + B.esc(e.adr) + '<div class="det">' + B.esc(e.art) + '</div></td><td>' + B.esc(e.halter) + '</td><td class="num">' + B.esc(deIso(e.kauf)) + '</td><td class="r num">' + B.eur(e.ein, 2) + '</td><td class="r num">' + B.eur(e.wk, 2) + '</td><td class="r num">' + B.eurS(e.erg, 2) + '</td></tr>'; }).join('')
          + '</tbody></table><p class="det" style="margin-top:3mm">Je Objekt folgen die Aufstellung' + (mitAV && priv.length ? ' und für Objekte im Privatvermögen die Zuordnung zu den Zeilen der Anlage V' : '') + '. Quelle sind die je Objekt und Jahr gespeicherten Steuersätze. Keine Steuererklärung und keine Steuerberatung.</p>'));
        eintr.forEach(function (e, i) {
          /* v3920 · Bloecke A bis E wie das Steuerformular, F (Angaben zum Objekt) am Ende der Seite */
          var _bo = { corp: e.corp, afaArt: e.avS._afa || null, erhG: num(e.avS._erhG), afaSonder7b: e.s.afa_sonder_7b != null ? num(e.s.afa_sonder_7b) : null, erhV: e.avS._erhV || null };
          var tab = blockZeilen(B, jahr, e.v, _bo, ['A', 'B', 'C', 'D', 'E']).zeilen;
          var _anZ = anteilZeile(B, e.avA.w); if (_anZ) tab.push(_anZ);
          tab.push(['Summe ' + (e.corp ? 'Betriebsausgaben' : 'Werbungskosten') + ' ' + jahr, B.eur(e.wk, 2), { art: 'summe' }]);
          if (e.avA.w.kuerzung > 0.005) tab.push(['Kürzung wegen verbilligter Vermietung (§ 21 Abs. 2 EStG)', B.eurS(e.avA.w.kuerzung, 2), { det: 'Die Werbungskosten stehen im Formular in voller Höhe, das Finanzamt kürzt sie.' }]);
          tab.push([e.corp ? 'Beitrag zum Ergebnis der Gesellschaft (vor Steuern)' : 'Einkünfte aus Vermietung und Verpachtung', B.eurS(e.erg, 2), { art: 'ende', farbe: 1 }]);
          if (!e.corp) {
            if (vl) tab.push(['Veranlagung ' + jahr, vl.kurz, { det: vl.art + ' · ' + vl.kist + ' · ' + vl.quelle }]);   /* v3480 */
            if (e.s.base_income != null) {
              /* v3481 · gespeicherter Satz gegen den HEUTIGEN Steuerzeitraum: wurde Veranlagung oder zvE danach
                 geaendert, rechnet der Satz mit dem alten Stand - das sagen, statt still zu mischen */
              var _zq = null; try { _zq = window._dpZveFuerJahr ? window._dpZveFuerJahr(jahr) : null; } catch (eZ) {}
              var _abw = _zq && _zq.quelle !== 'ersatz' && _zq.zve > 0 && Math.abs(_zq.zve - num(e.s.base_income)) > 1;
              tab.push(['Zu versteuerndes Einkommen ohne dieses Objekt (Steuerzeitraum ' + jahr + (vl && /Zusammen/.test(vl.kurz) ? ', gemeinsam' : '') + ')', B.eur(num(e.s.base_income), 0),
                _abw ? { det: 'Der Steuerzeitraum ' + jahr + ' führt heute ' + B.eur(_zq.zve, 0) + '. Der Jahreswert wurde vorher gespeichert – Objekt öffnen und speichern, dann rechnen Steuerwirkung und Grenzsteuersatz mit dem heutigen Stand.' } : {}]);
            }
            if (e.s.marginal_tax_rate != null) tab.push(['Grenzsteuersatz', B.pct(num(e.s.marginal_tax_rate) * 100, 2)]);
          }
          /* v3480 · Gesellschaft: ein Verlust ist keine Erstattung (N-04) */
          /* v3701 · G-05: die Steuer zahlt die Gesellschaft auf alle ihre Objekte zusammen - je Objekt nur der Beitrag */
          if (e.corp && gesSt[String(e.d.halter)]) tab.push(['Ertragsteuer', 'in der Gesellschaft', { det: 'Die Gesellschaft zahlt Körperschaftsteuer, Soli und Gewerbesteuer auf das Ergebnis aller ihrer Objekte zusammen, nach Kosten der Gesellschaft und Verlustvortrag. Siehe Zusammenfassung „Gesellschaften“.' }]);
          else if (e.s.tax_delta != null) tab.push(e.corp ? steuerZeileGes(B, num(e.s.tax_delta), e.erg) : ['Steuerwirkung (Erstattung +, Belastung −)', B.eurS(-num(e.s.tax_delta), 0), { farbe: 1 }]);
          if (Math.abs(num(e.s.immo_result) - e.erg) > 1) tab.push(['Gespeichertes Ergebnis des Steuersatzes (weicht ab – Satz neu speichern)', B.eurS(num(e.s.immo_result), 2)]);
          blockZeilen(B, jahr, e.v, _bo, ['F']).zeilen.forEach(function (x) { tab.push(x); });   /* v3920 */
          S.push(B.seite(c, 'Objekt ' + (i + 1) + ' · ' + jahr, B.abschnitt('Objekt ' + (i + 1) + ' · ' + e.halter + (e.corp ? ' · Betriebsvermögen' : ' · Privatvermögen'), (e.corp ? 'Betriebseinnahmen und Betriebsausgaben ' : 'Einnahmen und Werbungskosten ') + jahr, e.adr)
            + (e.vermerk ? '<div class="hinweis">' + B.esc(e.vermerk) + '</div>' : '') + afa1925(B, e.d, e.corp) + B.liste(tab)
            + (e.corp ? '<p class="det" style="margin-top:3mm">Eine Anlage V gibt es für eine GmbH/UG nicht (Einkünfte aus Gewerbebetrieb, § 8 Abs. 2 KStG). Die Kosten der Gesellschaft selbst stehen im Jahresabschluss der Gesellschaft.</p>' : '')));
          if (mitAV && !e.corp) {
            var tot = { values: e.v, einnahmen: e.ein, werbungskosten: e.wk, ergebnis: e.erg,
                        afaLinear: e.s.afa_linear != null ? num(e.s.afa_linear) : null, afaSonder7b: e.s.afa_sonder_7b != null ? num(e.s.afa_sonder_7b) : null, auto: { afa: e.v.afa },
                        erhV: e.avS._erhV || null, erhG: num(e.avS._erhG), zeUngeteilt: num(e.avS._zeUngeteilt),   /* v3800 */
                        einheiten: e.avS._einheiten || null, afaArt: e.avS._afa || null, kaufjahr: num(e.avS._kj) || null, av7h: e.avS._av7h || null,
                        verbilligt: e.avS._vb ? { grund: String(e.avS._vb) } : null };   /* v3800b */
            var av = anlageVBlatt(B, jahr, tot);
            if (av) S.push(B.seite(c, 'Anlage V · Objekt ' + (i + 1), B.abschnitt('Anlage V · Zuordnung · Objekt ' + (i + 1), 'Veranlagungsjahr ' + jahr, e.adr) + av));
          }
        });
        /* v3480 · Gesellschaft: Spalte „Ertragsteuer“, ein Verlust zeigt 0 € statt einer Erstattung (N-04) */
        var summe = function (L, wort, gesSpalte) {
          if (!L.length) return '';
          var st = function (e) { return gesSpalte ? Math.max(0, num(e.s.tax_delta)) : num(e.s.tax_delta); };
          var _gemeinsam = !!(gesSpalte && Object.keys(gesSt).length);   /* v3701 · G-05: Steuer steht je Gesellschaft darunter */
          var a = L.reduce(function (x, e) { return [x[0] + e.ein, x[1] + e.wk, x[2] + e.erg, x[3] + st(e)]; }, [0, 0, 0, 0]);
          return '<h3>' + wort + '</h3><table><thead><tr><th>Objekt</th><th class="r">Einnahmen</th><th class="r">Kosten</th><th class="r">Ergebnis</th><th class="r">' + (gesSpalte ? 'Ertragsteuer' : 'Steuerwirkung') + '</th></tr></thead><tbody>'
            + L.map(function (e) { return '<tr><td>' + B.esc(e.adr) + '</td><td class="r num">' + B.eur(e.ein, 2) + '</td><td class="r num">' + B.eur(e.wk, 2) + '</td><td class="r num">' + B.eurS(e.erg, 2) + '</td><td class="r num">' + (_gemeinsam ? '–' : (gesSpalte && !(st(e) > 0.5) ? '0 €' : B.eurS(-st(e), 0))) + '</td></tr>'; }).join('')
            + '<tr class="summe"><td>Summe (' + L.length + ')</td><td class="r num">' + B.eur(a[0], 2) + '</td><td class="r num">' + B.eur(a[1], 2) + '</td><td class="r num">' + B.eurS(a[2], 2) + '</td><td class="r num">' + (_gemeinsam ? '–' : (gesSpalte && !(a[3] > 0.5) ? '0 €' : B.eurS(-a[3], 0))) + '</td></tr></tbody></table>'
            + (gesSpalte && L.some(function (e) { return e.erg < 0; }) ? '<p class="det">Ein Verlust eines Objekts begründet keine Erstattung: er wird in der Gesellschaft mit Gewinnen verrechnet, sonst als Verlustvortrag fortgeführt (§ 8 Abs. 1 KStG i. V. m. § 10d EStG, § 10a GewStG). Die Steuer der Gesellschaft insgesamt steht im Jahresabschluss.</p>' : '');
        };
        S.push(B.seite(c, 'Zusammenfassung', B.abschnitt('Zusammenfassung', (gesMappe ? 'Geschäftsjahr ' : 'Veranlagungsjahr ') + jahr)
          + summe(priv, 'Privatvermögen · Einkünfte aus Vermietung und Verpachtung') + (vl ? '<p class="det">Veranlagung ' + jahr + ': ' + B.esc(vl.art) + ', ' + B.esc(vl.kist) + ' (' + B.esc(vl.quelle) + ').</p>' : '') + summe(ges, 'Gesellschaften · Ergebnis vor Steuern je Objekt', true)
          + (function () {   /* v3701 · G-05: Steuer je Gesellschaft, dieselbe Rechnung wie der Jahresabschluss */
            var ids = Object.keys(gesSt); if (!ids.length) return '';
            return '<h3>Gesellschaften · Steuer ' + jahr + ' (alle Objekte der Gesellschaft)</h3><table><thead><tr><th>Gesellschaft</th><th class="r">Ergebnis vor Steuern</th><th class="r">KSt + Soli</th><th class="r">GewSt</th><th class="r">Steuer</th><th class="r">Verlustvortrag danach</th></tr></thead><tbody>'
              + ids.map(function (h) {
                  var z = (gesSt[h] || []).filter(function (x) { return x.jahr === jahr; })[0]; if (!z) return '';
                  var m = null; try { m = DealPilotMandanten.get(h); } catch (eM) {}
                  return '<tr><td>' + B.esc((m && m.name) || h) + '<div class="det">' + z.objekte + ' Objekte, Kosten der Gesellschaft enthalten</div></td><td class="r num">' + B.eurS(z.erg, 2) + '</td><td class="r num">' + B.eur(z.kst, 0) + '</td><td class="r num">' + B.eur(z.gewst, 0) + '</td><td class="r num">' + (z.steuer > 0.5 ? B.eurS(-z.steuer, 0) : '0 €') + '</td><td class="r num">' + B.eur(z.vortragNach, 0) + '</td></tr>';
                }).join('')
              + '</tbody></table>'
              + ids.map(function (h) {   /* v3702a · Ueberleitung Objekte -> Gesellschaft */
                  var z = (gesSt[h] || []).filter(function (x) { return x.jahr === jahr; })[0];
                  if (!z || z.summeObjekte == null) return '';
                  var m = null; try { m = DealPilotMandanten.get(h); } catch (eM) {}
                  return '<h3>Überleitung ' + jahr + (ids.length > 1 ? ' · ' + B.esc((m && m.name) || h) : '') + '</h3><table><tbody>'
                    + '<tr><td>Summe der Beiträge aller Objekte</td><td class="r num">' + B.eurS(z.summeObjekte, 2) + '</td></tr>'
                    + '<tr><td>− Kosten der Gesellschaft (Buchführung, Abschluss, Beiträge)</td><td class="r num">' + B.eurS(-z.kosten, 2) + '</td></tr>'
                    + (z.gdZins ? '<tr><td>− Zinsen auf Gesellschafterdarlehen</td><td class="r num">' + B.eurS(-z.gdZins, 2) + '</td></tr>' : '')
                    + '<tr class="summe"><td>= Ergebnis vor Steuern der Gesellschaft</td><td class="r num">' + B.eurS(z.erg, 2) + '</td></tr></tbody></table>'
                    + (z.gdZins ? '<p class="det">Die Zinsen auf das Gesellschafterdarlehen sind Betriebsausgabe der Gesellschaft und beim Gesellschafter Einkünfte aus Kapitalvermögen (§ 20 Abs. 1 Nr. 7 EStG). Sie stehen deshalb nicht bei einem einzelnen Objekt. Für die Gewerbesteuer wird ein Viertel der Entgelte für Schulden über dem Freibetrag hinzugerechnet (§ 8 Nr. 1 GewStG).</p>' : '');
                }).join('')
              + (gesMappe && gesSt[gesMappe] ? '<h3>Entwicklung Ergebnis, Steuer und Verlustvortrag</h3><table><thead><tr><th>Geschäftsjahr</th><th class="r">Ergebnis vor Steuern</th><th class="r">KSt + Soli</th><th class="r">GewSt</th><th class="r">Steuer</th><th class="r">Verlustvortrag danach</th></tr></thead><tbody>'
                  + gesSt[gesMappe].filter(function (x) { return x.jahr <= jahr; }).map(function (x) { return '<tr' + (x.jahr === jahr ? ' class="summe"' : '') + '><td>' + x.jahr + (x.ist ? ' · Ist laut Kanzlei' : '') + '</td><td class="r num">' + B.eurS(x.erg, 2) + '</td><td class="r num">' + B.eur(x.kst, 0) + '</td><td class="r num">' + B.eur(x.gewst, 0) + '</td><td class="r num">' + (x.steuer > 0.5 ? B.eurS(-x.steuer, 0) : '0 €') + '</td><td class="r num">' + B.eur(x.vortragNach, 0) + '</td></tr>'; }).join('')
                  + '</tbody></table>' : '')
              + '<p class="det">Die Gesellschaft wird als Ganzes besteuert (§ 8 Abs. 1 KStG, § 7 GewStG). Ergebnis vor Steuern ist die Summe der Beiträge aller ihrer Objekte abzüglich der Kosten der Gesellschaft, die Steuer gilt nach Verlustvortrag (§ 10d EStG, § 10a GewStG). Dieselbe Rechnung steht im Jahresabschluss.</p>';
          })()
          + '<p class="det" style="margin-top:3mm">Die Steuerwirkung ist je Objekt gerechnet (Steuer mit und ohne dieses Objekt beim zu versteuernden Einkommen des Steuerzeitraums). Die Summe ist deshalb eine Näherung: die Progression mehrerer Objekte zusammen weicht davon ab. '
          + (ges.length ? 'Privatvermögen und Gesellschaften sind getrennte Steuersubjekte und werden nicht zusammengezählt. ' : '') + 'Keine Steuererklärung und keine Steuerberatung.</p>'));
        return B.dokument(gesMappe ? 'Steuer-Mappe ' + (gesName || 'Gesellschaft') + ' ' + jahr : 'Steuer-Mappe ' + jahr, S);
        };
        /* v3701 · G-05: vor dem Bau die Steuerreihe je Gesellschaft holen. v3700 · P2: im Kundenkontext die Gesellschaft DES
           KUNDEN (seine weitergefuehrten Objekte, sein Steuerprofil), damit die Mappe beim Partner Zahl fuer Zahl der des Kunden gleicht */
        var _gesH = [];
        var _imK = function (f) { return (kunde && window.DpSteuerKontext) ? DpSteuerKontext.mit(prof, f, { kunde: sp.kunde, kundennummer: sp.kundennummer, client_id: kunde, profil_id: sp.aktuell.id, fassung: sp.aktuell.fassung, stand_am: sp.aktuell.zuletzt_am }) : f(); };
        if (window.DpGesSteuer) _imK(function () { objs.forEach(function (oo) {
          var dd = (oo && (oo.object || oo) && (oo.object || oo).data) || {}, h = String(dd.halter || 'privat');
          try { var mm = h !== 'privat' && window.DealPilotMandanten ? DealPilotMandanten.get(h) : null; if (mm && mm.id === h && DealPilotMandanten.isCorp(mm.rechtsform) && _gesH.indexOf(h) < 0) _gesH.push(h); } catch (eH) {}
        }); });
        var _gOpt = kunde ? { kunde: kunde, profil: prof } : undefined;
        if (_gesH.length) return Promise.all(_gesH.map(function (h) { return DpGesSteuer.reihe(h, jahr, _gOpt).then(function (r) { if (r) gesSt[h] = r; }).catch(function () {}); })).then(function () { return _imK(bauen); });
        return _imK(bauen);
      });
    });
  }

  /* ── 5c · Jahresabschluss einer Gesellschaft (v3480, Backlog N165) ──
     Bis v3472 nur jsPDF (gesellschaft-abschluss.js exportAbschlussPDF), die Weiche umging ihn.
     Gerechnet wird NICHTS neu: _gaDaten() und _gaRechnen() sind dieselben Funktionen wie im alten
     PDF (Restschuld, Vortrag, Steuer ueber den Kern der Ueberfuehrung); die Erlaeuterungstexte kommen
     aus _gaSteuerHinweis / _gaAusgleichText. opt: { halter, jahr } */
  function jahresabschluss(opt) {
    /* v3810 · Marcel 19.11.2026 nach dem Kanzleitermin: auf keinen Fall eine Bilanz ausgeben. */
    if (!opt || !opt._erlaubt) return Promise.reject(nutzerFehler('Eine Bilanz oder einen Jahresabschluss gibt DealPilot nicht aus. Den erstellt deine Kanzlei. Die steuerliche Einschätzung der Gesellschaft steht in der Steuer-Mappe der Gesellschaft.'));
    opt = opt || {};
    var halter = String(opt.halter || ''), jahr = parseInt(opt.jahr, 10) || (new Date().getFullYear() - 1);
    var B = D();
    if (typeof window._gaDaten !== 'function' || typeof window._gaRechnen !== 'function' || typeof window._computeYearTotal !== 'function') return Promise.reject(nutzerFehler('Abschluss-Modul nicht geladen – Seite neu laden.'));
    var reg = null; try { reg = (typeof _steuerRegime === 'function') ? _steuerRegime(halter) : null; } catch (e) {}
    if (reg && reg.anlageV) return Promise.reject(nutzerFehler('Jahresabschluss gibt es nur für Gesellschaften — ' + reg.name + ' ist ' + reg.art));
    return window._gaDaten(halter, jahr).then(function (daten) {
      if (!daten.objekte.length) throw nutzerFehler('Dieser Gesellschaft ist kein Objekt zugeordnet.');
      var rech = window._gaRechnen(halter, jahr, daten);
      var name = (rech.mandant && rech.mandant.name) || 'Gesellschaft';
      return basis('Jahresabschluss ' + jahr).then(function (c) {
        c.zeile = name + ' · Geschäftsjahr ' + jahr;
        var g = rech.guv, b = rech.bilanz, ident = (rech.mandant && rech.mandant.ident) || {}, S = [];
        var e0 = function (v) { return B.eur(Math.round(Number(v) || 0), 0); };
        var s0 = function (v) { return B.eurS(Math.round(Number(v) || 0), 0); };
        var fehl = function (v) { return v ? String(v) : 'nicht hinterlegt'; };
        var rf = (rech.mandant && window.DealPilotMandanten && DealPilotMandanten.rfLabel) ? DealPilotMandanten.rfLabel(rech.mandant.rechtsform) : '–';
        var satzTxt = B.zahl(rech.steuersatz * 100, 3) + ' %' + (rech.erwStatus && rech.erwStatus.aktiv ? ' · erweiterte Kürzung § 9 GewStG' : (rech.regime && rech.regime.erw_kuerzung === true ? ' · erweiterte Kürzung beantragt, Prüfpunkte offen' : ''));
        S.push(B.deckblatt(c, { bild: null, eyebrow: 'Jahresabschluss · Geschäftsjahr ' + jahr, titel: name, unter: 'Bilanz und Gewinn- und Verlustrechnung · Einkünfte aus Gewerbebetrieb (§ 8 Abs. 2 KStG)',
          wertLabel: g.jahresueberschuss < 0 ? 'Jahresfehlbetrag ' + jahr : 'Jahresüberschuss ' + jahr, wert: s0(g.jahresueberschuss),
          wertNeben: 'Ergebnis vor Steuern ' + B.esc(s0(g.ergebnisVorSteuern)) + '<br>Bilanzsumme ' + B.esc(e0(b.summeAktiva)) + '<br>' + daten.objekte.length + ' Objekt' + (daten.objekte.length === 1 ? '' : 'e'),
          meta: [['Rechtsform', rf], ['Geschäftsjahr', '01.01.–31.12.' + jahr], ['Stand', c.stand]],
          zitat: 'Diese Auswertung fasst zusammen, was DealPilot über die Objekte dieser Gesellschaft führt, und stellt es in der Gliederung des HGB dar. Sie ist kein aufgestellter Jahresabschluss im Sinne der §§ 242 ff. HGB und ersetzt weder die Buchführung noch die Beratung: sie kennt nur die Geschäftsvorfälle, die in DealPilot erfasst sind. Was darüber hinaus über das Konto der Gesellschaft läuft, steht als „Verrechnungskonto Gesellschafter“ in der Bilanz.' }));
        /* Gesellschaft und Objekte */
        S.push(B.seite(c, 'Gesellschaft', B.abschnitt('Abschnitt 1', 'Gesellschaft und Objekte', 'Stammdaten aus Einstellungen › Mandanten')
          + B.liste([['Name', name], ['Rechtsform', rf], ['Steuernummer', fehl(ident.steuernummer)], ['Finanzamt', fehl(ident.finanzamt)], ['Handelsregister', fehl(ident.handelsregister)],
            ['USt-IdNr.', fehl(ident.ustid)], ['Anschrift', fehl([ident.strasse, ident.ort].filter(Boolean).join(', '))], ['Steuersatz', satzTxt, { umbruch: 1 }]])
          + '<h3>Objekte der Gesellschaft (' + daten.objekte.length + ')</h3><table><thead><tr><th>Nr.</th><th>Objekt</th><th class="r">Buchwert 31.12.</th></tr></thead><tbody>'
          + daten.objekte.map(function (o, i) {
              return '<tr><td class="num">' + (i + 1) + '</td><td>' + B.esc(o.name) + (o.basisIstVerkehrswert ? '<div class="det">aus dem Privatbestand überführt</div>' : '') + '</td><td class="r num">'
                + (o.satz ? e0(Math.max(0, o.akGebaeude - o.kumAfaGebaeude) + o.akGrund) : 'kein Steuersatz für ' + jahr) + '</td></tr>';
            }).join('') + '</tbody></table>'));
        /* GuV */
        var guvZ = [['1. Umsatzerlöse', e0(g.umsatz), { det: 'Kaltmieten und umgelegte Nebenkosten aller Objekte' }],
          ['5. Grundstücksaufwendungen', s0(-g.grundstueck), { det: 'Betriebskosten und Erhaltungsaufwand' }],
          ['6. Personalaufwand', s0(-g.personal), { det: 'Geschäftsführergehalt aus den Kosten der Gesellschaft' }],
          ['7. Abschreibungen', s0(-g.afa), { det: 'Gebäude linear und § 7b, bewegliche Wirtschaftsgüter, anschaffungsnahe Herstellkosten' }],
          ['8. Sonstige betriebliche Aufwendungen', s0(-g.sonstige), { det: 'Verwaltung der Objekte, dazu die Kosten der Gesellschaft ohne Personal' }],
          ['13. Zinsen und ähnliche Aufwendungen', s0(-g.zinsen), { det: 'Zinsen und Finanzierungsnebenkosten' }],
          ['Ergebnis vor Steuern', s0(g.ergebnisVorSteuern), { art: 'summe', farbe: 1 }],
          ['14. Steuern vom Einkommen und vom Ertrag', s0(-g.steuern), { det: (window._gaSteuerHinweis ? _gaSteuerHinweis(rech) : '') }],
          [g.jahresueberschuss < 0 ? 'Jahresfehlbetrag' : 'Jahresüberschuss', s0(g.jahresueberschuss), { art: 'ende', farbe: 1 }]];
        var kostenH = rech.befunde.kostenFehlen
          ? '<div class="hinweis" style="border-left-color:var(--rot);background:#FAF0EC"><b>Kosten der Gesellschaft fehlen.</b> Für ' + jahr + ' sind keine Kosten der Gesellschaft erfasst. Steuerberatung für den Jahresabschluss, Kammerbeiträge, Kontoführung und ein etwaiges Geschäftsführergehalt fehlen damit vollständig. Der Jahresüberschuss oben ist deshalb zu hoch, und die Bilanz geht in gleicher Höhe nicht auf. Nachzutragen unter Einstellungen › Mandanten.</div>'
          : '<h3>Darin enthalten: Kosten der Gesellschaft</h3>' + B.liste((rech.kosten.arten || []).filter(function (a) { return a.betrag; }).map(function (a) { return [a.t, e0(a.betrag)]; }).concat([['Summe', e0(rech.kosten.summe), { art: 'summe' }]]));
        var ohneH = rech.befunde.ohneSatz.length ? '<div class="hinweis" style="border-left-color:var(--rot);background:#FAF0EC">Für ' + rech.befunde.ohneSatz.length + ' Objekt' + (rech.befunde.ohneSatz.length === 1 ? '' : 'e') + ' liegt für ' + jahr + ' kein Steuersatz vor: ' + B.esc(rech.befunde.ohneSatz.join(', ')) + '. Diese Objekte sind in der GuV mit null enthalten, stehen in der Bilanz aber mit ihrem Buchwert — die Rechnung ist deshalb unvollständig.</div>' : '';
        S.push(B.seite(c, 'Gewinn- und Verlustrechnung', B.abschnitt('Abschnitt 2', 'Gewinn- und Verlustrechnung', 'Gesamtkostenverfahren · § 275 Abs. 2 HGB · 01.01.–31.12.' + jahr) + B.liste(guvZ, ['Position', 'Betrag']) + kostenH + ohneH));
        /* Bilanz */
        var seiteT = function (titel, z) { return '<div><table><thead><tr><th>' + B.esc(titel) + '</th><th class="r">Betrag</th></tr></thead><tbody>' + z.map(function (x) {
          return '<tr class="' + (x[2] || '') + '"><td>' + B.esc(x[0]) + (x[3] ? '<div class="det">' + B.esc(x[3]) + '</div>' : '') + '</td><td class="r num">' + (x[1] == null ? '' : B.esc(x[1])) + '</td></tr>'; }).join('') + '</tbody></table></div>'; };
        var vd = b.vortragDetails, nV = vd && vd.jahre ? vd.jahre.length : 0;
        var vTxt = !nV ? 'Anfangsbestand aus den Stammdaten — kein Vorjahr erfasst' : 'Anfangsbestand aus den Stammdaten + Ergebnisse ' + vd.jahre[0].jahr + (vd.jahre[nV - 1].jahr !== vd.jahre[0].jahr ? '–' + vd.jahre[nV - 1].jahr : '') + ' (' + e0(b.vortragAusVorjahren) + ')' + (vd.gekappt ? ' · nur die letzten 15 Jahre' : '');
        var akt = [['A. Anlagevermögen', null, 'summe'], ['I. Grundstücke', e0(b.akGrund), '', 'Anschaffungskosten, nicht abgeschrieben'],
          ['II. Gebäude', e0(b.bwGebaeude), '', 'AK ' + e0(b.akGebaeude) + ' abzüglich kumulierter AfA ' + e0(b.kumAfaGebaeude)]];
        if (b.akBwg > 0) akt.push(['III. Betriebs- und Geschäftsausstattung', e0(b.bwBwg), '', 'AK ' + e0(b.akBwg) + ' abzüglich ' + e0(b.kumAfaBwg)]);
        akt.push(['B. Umlaufvermögen', null, 'summe'], ['Guthaben bei Kreditinstituten', e0(b.bank), '', 'Eröffnungsbestand aus den Stammdaten — die laufenden Zahlungen des Jahres sind DealPilot nicht bekannt']);
        if (b.ausgleich < 0) akt.push(['Forderungen gegen Gesellschafter', e0(-b.ausgleich), '', 'Ausgleichsposten — siehe Erläuterung unten']);
        akt.push(['Summe Aktiva', e0(b.summeAktiva), 'ende']);
        var pas = [['A. Eigenkapital', null, 'summe'], ['I. Gezeichnetes Kapital', e0(b.stammkapital)], [b.gewinnvortrag < 0 ? 'II. Verlustvortrag' : 'II. Gewinnvortrag', s0(b.gewinnvortrag), '', vTxt],
          [b.jahresueberschuss < 0 ? 'III. Jahresfehlbetrag' : 'III. Jahresüberschuss', s0(b.jahresueberschuss)],
          ['B. Rückstellungen', null, 'summe'], ['Steuerrückstellung', e0(b.steuerrueckstellung), '', 'Ertragsteuern des Jahres, in voller Höhe als noch nicht gezahlt angesetzt — Vorauszahlungen sind nicht bekannt'],
          ['C. Verbindlichkeiten', null, 'summe'], ['gegenüber Kreditinstituten', e0(b.darlehen), '', 'Restschuld zum 31.12. aus den Darlehensangaben der Objekte'], ['Gesellschafterdarlehen', e0(b.gesdar)]];
        if (b.ausgleich > 0) pas.push(['Verrechnungskonto Gesellschafter', e0(b.ausgleich), '', 'Ausgleichsposten — siehe Erläuterung unten']);
        pas.push(['Summe Passiva', e0(b.summePassiva), 'ende']);
        var ist = Math.abs(b.summeAktiva - b.summePassiva) < 1, aus = window._gaAusgleichText ? _gaAusgleichText(b) : { text: '', fehlt: [] };
        S.push(B.seite(c, 'Bilanz', B.abschnitt('Abschnitt 3', 'Bilanz zum 31.12.' + jahr, 'Gliederung nach § 266 HGB, verkürzt')
          + '<div class="zwei">' + seiteT('Aktiva', akt) + seiteT('Passiva', pas) + '</div>'
          + '<div class="hinweis"' + (aus.fehlt.length ? ' style="border-left-color:var(--rot);background:#FAF0EC"' : '') + '><b>Warum ein Verrechnungskonto und keine stille Korrektur.</b> ' + B.esc(aus.text) + '</div>'
          + (ist ? '' : '<div class="hinweis" style="border-left-color:var(--rot);background:#FAF0EC"><b>Achtung:</b> Die Summen weichen um ' + e0(b.summeAktiva - b.summePassiva) + ' voneinander ab. Das ist ein Fehler in der Rechnung, kein Datenmangel.</div>')));
        /* Anlagenspiegel */
        var sAk = 0, sKum = 0, sBw = 0, sRs = 0;
        var zeilenA = daten.objekte.map(function (o) {
          var bw = Math.max(0, o.akGebaeude - o.kumAfaGebaeude); sAk += o.akGebaeude; sKum += o.kumAfaGebaeude; sBw += bw; sRs += o.restschuld.summe;
          var fu = [];
          if (o.basisIstVerkehrswert) fu.push('AfA-Bemessungsgrundlage ist der Verkehrswert bei Überführung');
          if (o.akAktiviert) fu.push('einschließlich aktivierter anschaffungsnaher Herstellkosten ' + e0(o.akAktiviert));
          if (o.jahreErfasst.length) fu.push('AfA kumuliert aus den Jahren ' + o.jahreErfasst[0] + '–' + o.jahreErfasst[o.jahreErfasst.length - 1]);
          if (o.restschuld.vorbehalt.length) fu.push(o.restschuld.vorbehalt.join('; '));
          var a25 = ''; try { var r25 = window.Afa && Afa.pruefeSatzFertigstellung ? Afa.pruefeSatzFertigstellung({ baujahr: o.data.baujahr, afaSatz: o.data.afa_satz, eigen: !!String(o.data.afa_eigen || '').trim(), gesellschaft: true }) : null; if (r25 && r25.warnen) a25 = 'AfA-Satz prüfen: Fertigstellung vor 1925, gewählt 2,0 % statt 2,5 % (§ 7 Abs. 4 Satz 1 Nr. 2 Buchst. c EStG)'; } catch (eA) {}   /* v3480 */
          if (a25) fu.push(a25);
          return '<tr><td>' + B.esc(o.name) + (fu.length ? '<div class="det">' + B.esc(fu.join(' · ')) + '</div>' : '') + '</td><td class="r num">' + e0(o.akGebaeude) + '</td><td class="r num">' + e0(o.kumAfaGebaeude) + '</td><td class="r num">' + e0(bw) + '</td><td class="r num">' + (o.restschuld.bekannt ? e0(o.restschuld.summe) : 'kein Darlehen') + '</td></tr>';
        });
        var p = rech.befunde.probe;
        var pt = 'Der gespeicherte Steuersatz eines Objekts führt die Restschuld nicht. Sie wird deshalb hier aus den Darlehensangaben des Objekts gerechnet: Annuitätendarlehen mit monatlicher Zahlung, Beginn laut Darlehensvertrag. Nicht enthalten sind Sondertilgungen, tilgungsfreie Anlaufzeiten und eine Anschlussfinanzierung zu anderen Konditionen.'
          + (p ? ' Gegenprobe am geöffneten Objekt gegen den Rechenkern der App: ' + e0(p.eigen) + ' hier, ' + e0(p.kern) + ' dort — Abweichung ' + B.zahl(p.abweichung * 100, 2) + ' %' + (p.ok ? '. Die Rechnung stimmt mit dem Rechenkern überein.' : '. Das ist zu viel: die Restschuld in dieser Bilanz ist nicht belegt.')
               : ' Eine Gegenprobe gegen den Rechenkern war nicht möglich, weil für ' + jahr + ' kein geöffnetes Objekt mit Cashflow-Reihe vorlag. Die Restschuld ist damit gerechnet, aber nicht geprüft.');
        S.push(B.seite(c, 'Anlagenspiegel', B.abschnitt('Abschnitt 4', 'Anlagenspiegel und Nachweise', 'Je Objekt · § 268 Abs. 2 HGB · zum 31.12.' + jahr)
          + '<table><thead><tr><th>Objekt</th><th class="r">AK Gebäude</th><th class="r">Kum. AfA</th><th class="r">Buchwert</th><th class="r">Restschuld</th></tr></thead><tbody>' + zeilenA.join('')
          + '<tr class="summe"><td>Summe</td><td class="r num">' + e0(sAk) + '</td><td class="r num">' + e0(sKum) + '</td><td class="r num">' + e0(sBw) + '</td><td class="r num">' + e0(sRs) + '</td></tr></tbody></table>'
          + '<h3>Worauf die Restschuld beruht</h3><p>' + B.esc(pt) + '</p>'
          + (rech.befunde.restUnbekannt.length ? '<div class="hinweis" style="border-left-color:var(--rot);background:#FAF0EC">Ohne Darlehensangaben und deshalb mit null angesetzt: ' + B.esc(rech.befunde.restUnbekannt.join(', ')) + '. Ist eines dieser Objekte finanziert, fehlt die Verbindlichkeit in der Bilanz und der Ausgleichsposten ist entsprechend zu hoch.</div>' : '')
          + '<p class="det" style="margin-top:3mm">Keine Steuerberatung und kein aufgestellter Jahresabschluss nach §§ 242 ff. HGB.</p>'));
        return B.dokument('Jahresabschluss ' + jahr + ' · ' + name, S);
      });
    });
  }

  /* ── 6 · Track Record (Portfolio) ────────────────────────────────── */
  function nachIds(objs, opt, nurGewonnen) {
    var ids = opt && Array.isArray(opt.ids) && opt.ids.length ? opt.ids : null;
    return (objs || []).filter(function (o) { return o && o.data && (ids ? ids.indexOf(o.id) >= 0 : (!nurGewonnen || o.data._deal_won)); });
  }
  /* v3217 · W-20: Fotos je Objekt nach der Wahl im Track Record (opt.fotos = {id: [Index …]}),
     ohne Wahl alle. Mit „vorher“/„nachher“ (data._foto_meta) entstehen Paare. */
  function trFotos(o, opt) {
    var d = o.data || {}, f = Array.isArray(d._photos) ? d._photos : [], meta = Array.isArray(d._foto_meta) ? d._foto_meta : [];
    var w = opt && opt.fotos && Array.isArray(opt.fotos[o.id]) ? opt.fotos[o.id] : null;
    return f.map(function (src, i) { var m = meta[i] || {}; return { src: src, i: i, rolle: m.rolle || '', datum: m.datum || '' }; })
      .filter(function (x) { return typeof x.src === 'string' && x.src && (!w || w.indexOf(x.i) >= 0); });
  }
  function monatDe(ym) { return /^\d{4}-\d{2}$/.test(ym || '') ? ym.slice(5) + '/' + ym.slice(0, 4) : ''; }
  function vorherNachher(B, fotos) {
    var v = fotos.filter(function (x) { return x.rolle === 'vorher'; }), n = fotos.filter(function (x) { return x.rolle === 'nachher'; });
    var paare = Math.min(v.length, n.length);
    if (!paare) return '';
    var h = '<h3>Vorher / Nachher</h3>';
    for (var i = 0; i < paare; i++) {
      h += '<div class="vn"><figure><img src="' + v[i].src + '" alt=""><figcaption>Vorher' + (v[i].datum ? ' · ' + monatDe(v[i].datum) : '') + '</figcaption></figure>'
        + '<figure><img src="' + n[i].src + '" alt=""><figcaption>Nachher' + (n[i].datum ? ' · ' + monatDe(n[i].datum) : '') + '</figcaption></figure></div>';
    }
    return h;
  }
  /* v3217 · W-11: Vermögensaufstellung, Haushaltsrechnung und Verlauf (vermoegen.js) - nur, wenn erfasst */
  /* v3226 · opt.voll (eigenes PDF „Vermögen & Haushalt“): Verlauf mit Liquide und Überschuss; opt.schluss = HTML ans Ende der letzten Seite */
  function vermoegenSeiten(B, c, V, opt) {
    if (!V || !V.hatDaten) return [];
    opt = opt || {};
    var S = V.S, d = V.daten, out = [];
    var P = function (art, kat) { return d.posten.filter(function (p) { return (art === 'schuld' ? p.art === 'schuld' : p.art !== 'schuld') && (!kat || p.kat === kat || (kat === 'sonstiges' && ['bank', 'depot'].indexOf(p.kat) < 0)); }); };
    var ein = function (p) { return [p.name || V.katName(p.art === 'schuld' ? V.KAT_S : V.KAT_V, p.kat), B.eur(V.betrag(p.betrag)), { art: 'ein', det: p.kommentar || '' }]; };
    var t = [['Liquide Vermögensgegenstände', B.eur(S.liquide), { art: 'summe' }]];
    P('v', 'bank').concat(P('v', 'depot')).forEach(function (p) { t.push(ein(p)); });
    t.push(['Nicht-liquide Vermögensgegenstände', B.eur(S.nichtLiquide), { art: 'summe' }]);
    if (S.immoListe.length) {
      t.push(['Immobilienvermögen', B.eur(S.immo), { art: 'ein' }]);
      S.immoListe.forEach(function (x) { t.push([x.name, B.eur(x.wert), { art: 'ein', det: x.quelle + (x.ort ? ' · ' + x.ort : '') }]); });
    }
    P('v', 'sonstiges').forEach(function (p) { t.push(ein(p)); });
    t.push(['Brutto-Vermögen', B.eur(S.brutto), { art: 'ende' }]);
    var u = [['Immobiliendarlehen (Restschuld heute)', B.eur(S.immoSchuld), { art: 'summe' }]];
    S.immoListe.forEach(function (x) { if (x.rest > 0) u.push([x.name, B.eur(x.rest), { art: 'ein' }]); });
    if (P('schuld').length) { u.push(['Weitere Verbindlichkeiten', B.eur(S.schuldenPosten), { art: 'summe' }]); P('schuld').forEach(function (p) { u.push(ein(p)); }); }
    u.push(['Summe Verbindlichkeiten', B.eur(S.schulden), { art: 'ende' }]);
    var bilanz = [['Vermögensgegenstände', B.eur(S.brutto)], ['Verbindlichkeiten', B.eurS(-S.schulden)], ['Netto-Vermögen', B.eur(S.netto), { art: 'ende' }]];
    out.push(B.seite(c, 'Vermögen', B.abschnitt('Vermögensverhältnisse', 'Vermögensaufstellung', 'Stand ' + c.stand + ' · Immobilien aus dem Bestand, bewertet zum ' + (d.immo.wertansatz === 'marktwert' ? 'Marktwert, wo erfasst (sonst Kaufpreis)' : 'Kaufpreis') + ', Restschuld heute')
      + B.kacheln([{ l: 'Brutto-Vermögen', v: B.eur(S.brutto) }, { l: 'Verbindlichkeiten', v: B.eur(S.schulden) }, { l: 'Netto-Vermögen', v: B.eur(S.netto), art: S.netto >= 0 ? 'gut' : 'schlecht' }, { l: 'Beleihung', v: S.ltv != null ? B.pct(S.ltv, 1) : '–', s: 'Verbindlichkeiten ÷ Brutto' }])
      + '<div class="zwei"><div><h3>Vermögen</h3>' + B.liste(t) + '</div><div><h3>Verbindlichkeiten</h3>' + B.liste(u) + '<h3>Vermögensaufstellung</h3>' + B.liste(bilanz) + '</div></div>'));
    var E = d.haushalt.filter(function (p) { return p.art !== 'aus'; }), A = d.haushalt.filter(function (p) { return p.art === 'aus'; });
    var hz = function (p, liste) { return [p.name || V.katName(liste, p.kat), B.eur(V.betrag(p.betrag)), { art: 'ein', det: [V.katName(liste, p.kat), p.kommentar].filter(Boolean).join(' · ') }]; };
    var st = (d.staende || []).slice().sort(function (a, b) { return String(a.datum).localeCompare(String(b.datum)); });
    var haus = '';
    if (E.length || A.length) {
      var h = [['Einnahmen', B.eur(S.einnahmen), { art: 'summe' }]].concat(E.map(function (p) { return hz(p, V.KAT_E); }))
        .concat([['Ausgaben', B.eur(S.ausgaben), { art: 'summe' }]]).concat(A.map(function (p) { return hz(p, V.KAT_A); }))
        .concat([['Überschuss / Monat', B.eurS(S.ueberschuss), { art: 'ende', farbe: 1 }]]);
      haus = B.abschnitt('Haushaltsrechnung', 'Einnahmen und Ausgaben je Monat') + B.liste(h);
    }
    var verlauf = '';
    if (st.length) {
      var tag = function (iso) { return Math.round(Date.parse(String(iso).slice(0, 10)) / 86400000); };
      var reihe = function (k) { return st.map(function (x) { return { x: tag(x.datum), y: x.summen ? x.summen[k] : null }; }); };
      var grafik = st.length >= 2 ? B.linien([{ name: 'Brutto-Vermögen', klasse: 'l1', werte: reihe('brutto') }, { name: 'Verbindlichkeiten', klasse: 'l2', werte: reihe('schulden') }, { name: 'Netto-Vermögen', klasse: 'l3', werte: reihe('netto') }],
        { titel: 'Vermögensentwicklung', null: true, xfmt: function (x) { var dt = new Date(x * 86400000); return ('0' + dt.getUTCDate()).slice(-2) + '.' + ('0' + (dt.getUTCMonth() + 1)).slice(-2) + '.' + String(dt.getUTCFullYear()).slice(2); } }) : '';
      verlauf = B.abschnitt('Entwicklung', 'Vermögensentwicklung', st.length + ' gespeicherte Stände · ' + B.datum(st[0].datum) + ' bis ' + B.datum(st[st.length - 1].datum)) + grafik
        + '<table class="dicht" style="margin-top:3mm"><thead><tr><th>Stand</th><th class="r">Brutto</th><th class="r">Verbindl.</th><th class="r">Netto</th>' + (opt.voll ? '<th class="r">Liquide</th><th class="r">Überschuss / M.</th>' : '') + '<th>Maßnahmen / Kommentar</th></tr></thead><tbody>'
        + st.slice().reverse().map(function (x) { var z = x.summen || {}; return '<tr><td class="num">' + B.datum(x.datum) + '</td><td class="r num">' + B.eur(z.brutto) + '</td><td class="r num">' + B.eur(z.schulden) + '</td><td class="r num">' + B.eur(z.netto) + '</td>'
          + (opt.voll ? '<td class="r num">' + B.eur(z.liquide) + '</td><td class="r num">' + B.eurS(z.ueberschuss) + '</td>' : '') + '<td>' + B.esc(x.kommentar || '') + '</td></tr>'; }).join('')
        + '</tbody></table>';
    }
    if (haus || verlauf) out.push(B.seite(c, 'Haushalt und Verlauf', haus + (haus && verlauf ? '<div style="height:6mm"></div>' : '') + verlauf + (opt.schluss || '')));
    else if (opt.schluss) out[out.length - 1] = out[out.length - 1].replace('<div class="fuss">', function () { return opt.schluss + '<div class="fuss">'; });
    return out;
  }

  /* ── 6b · Vermögen & Haushalt (v3226, eigenes PDF) ───────────────────
     Marcel 08.11.2026: „gibt es da ein vernünftiges PDF, um das auch runterzuladen, im Design wie die anderen PDFs?“
     Dieselben Zahlen wie die Ansicht (vermoegen.js fuerDokument → berechnen): hier wird nichts neu gerechnet
     außer Wert − Restschuld je Objekt, wie die Ansicht es zeigt. Die Seiten Vermögen, Haushalt und Verlauf
     sind dieselben wie im Track Record (vermoegenSeiten). */
  function vermoegenDok() {
    var B = D();
    var vP = (window.DpVermoegen && typeof DpVermoegen.fuerDokument === 'function') ? DpVermoegen.fuerDokument() : Promise.reject(new Error('Vermögen & Haushalt ist nicht geladen'));
    return Promise.all([basis('Vermögen & Haushalt'), vP]).then(function (z) {
      var c = z[0], V = z[1], S = V.S, d = V.daten, m = c.marke || {};
      var person = V.name || m.name || '';
      var st = (d.staende || []).slice().sort(function (a, b) { return String(a.datum).localeCompare(String(b.datum)); });
      var letzter = st.length ? st[st.length - 1] : null;
      var wa = d.immo.wertansatz === 'marktwert' ? 'Marktwert, wo erfasst (sonst Kaufpreis)' : 'Kaufpreis';
      c.zeile = 'Eigene Angaben · Stand ' + c.stand;
      var HINWEIS = 'Eigene Angaben, nicht geprüft. Immobilien aus dem DealPilot-Bestand, bewertet zum ' + wa
        + ', Restschuld zum heutigen Tag. Keine Anlage-, Steuer- oder Finanzierungsberatung.';
      var Sx = [];
      Sx.push(B.deckblatt(c, { bild: null, portrait: V.foto, eyebrow: 'Vermögen & Haushalt', titel: person || m.company || 'Vermögensaufstellung',
        unter: 'Vermögensaufstellung, Haushaltsrechnung und Entwicklung',
        kz: [{ l: 'Brutto-Vermögen', v: B.eur(S.brutto), s: 'liquide ' + B.eur(S.liquide) }, { l: 'Verbindlichkeiten', v: B.eur(S.schulden) }, { l: 'Netto-Vermögen', v: B.eur(S.netto), art: 'hi' }, { l: 'Überschuss / Monat', v: B.eurS(S.ueberschuss), art: S.ueberschuss >= 0 ? 'gut' : 'schlecht' }],
        meta: [['Stand', c.stand], ['Beleihung', S.ltv != null ? B.pct(S.ltv, 1) : '–'], ['Letzter gespeicherter Stand', letzter ? B.datum(letzter.datum) : 'noch keiner']],
        zitat: HINWEIS }));
      /* v3226a: mit Objekten im Bestand ist das PDF nie leer - vorher sagte Seite 2 „Noch keine Angaben“, waehrend das Deckblatt 1 Mio. Netto zeigte */
      if (!V.hatDaten && !(S.immoListe && S.immoListe.length)) {
        Sx.push(B.seite(c, 'Vermögen', B.abschnitt('Vermögen & Haushalt', 'Noch keine Angaben erfasst')
          + '<div class="hinweis">Unter Ansichten › Vermögen &amp; Haushalt trägst du Konten, Depot, weitere Verbindlichkeiten und die Haushaltsrechnung ein. Die Immobilien kommen automatisch aus deinen Objekten im Bestand.</div>'));
        return B.dokument('Vermögen und Haushalt' + (person ? ' · ' + person : ''), Sx);
      }
      if (S.immoListe.length) {
        Sx.push(B.seite(c, 'Immobilien', B.abschnitt('Vermögensverhältnisse', 'Immobilien im Bestand', 'Wertansatz ' + wa + ' · Restschuld heute')
          + B.kacheln([{ l: 'Objekte', v: B.zahl(S.immoListe.length, 0) }, { l: 'Immobilienwert', v: B.eur(S.immo) }, { l: 'Restschuld', v: B.eur(S.immoSchuld) }, { l: 'Eigenkapital', v: B.eur(S.immo - S.immoSchuld), art: 'hi' }])
          + '<table><thead><tr><th>Objekt</th><th>Wertansatz</th><th class="r">Wert</th><th class="r">Restschuld</th><th class="r">Eigenkapital</th></tr></thead><tbody>'
          + S.immoListe.map(function (x) { return '<tr><td>' + B.esc(x.name || '') + (x.ort ? '<div class="det">' + B.esc(x.ort) + '</div>' : '') + '</td><td>' + B.esc(x.quelle || '') + '</td><td class="r num">' + B.eur(x.wert) + '</td><td class="r num">' + B.eur(x.rest) + '</td><td class="r num">' + B.eur(x.wert - (x.rest || 0)) + '</td></tr>'; }).join('')
          + '<tr class="ende"><td>Summe Immobilien</td><td></td><td class="r num">' + B.eur(S.immo) + '</td><td class="r num">' + B.eur(S.immoSchuld) + '</td><td class="r num">' + B.eur(S.immo - S.immoSchuld) + '</td></tr></tbody></table>'));
      }
      vermoegenSeiten(B, c, V, { voll: true, schluss: '<div class="hinweis">' + B.esc(HINWEIS) + '</div>' }).forEach(function (x) { Sx.push(x); });
      return B.dokument('Vermögen und Haushalt' + (person ? ' · ' + person : ''), Sx);
    });
  }
  function trackRecord(opt) {
    var B = D();
    var vP = (window.DpVermoegen && typeof DpVermoegen.fuerDokument === 'function') ? DpVermoegen.fuerDokument().catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([basis('Track Record'), getAllObjectsData(), vP]).then(function (z) {
      var c = z[0], objs = nachIds(z[1], opt, true), V = z[2];
      c.zeile = 'Portfolio · ' + objs.length + ' Objekte';
      var sum = function (f) { return objs.reduce(function (a, o) { return a + (Number(f(o)) || 0); }, 0); };
      var kp = sum(function (o) { return o.kpis && o.kpis.kp; }), wfl = sum(function (o) { return parseFloat(String(o.data.wfl || '').replace(',', '.')); });
      var cf = sum(function (o) { return o.kpis && o.kpis.cf_ns_yearly; }), dl = sum(function (o) { return o.kpis && o.kpis.d_total; });
      var S = [];
      /* v3217 · W-5: Profilfoto und Name auf dem Deckblatt */
      var person = V && V.name ? V.name : '';
      S.push(B.deckblatt(c, { bild: null, portrait: V && V.foto, eyebrow: 'Track Record', titel: (c.marke.company || person || 'Portfolio'), unter: (person && person !== (c.marke.company || person) ? person + ' · ' : '') + 'Portfolio-Übersicht und Performance',
        kz: [{ l: 'Objekte', v: B.zahl(objs.length, 0) }, { l: 'Kaufpreise gesamt', v: B.eur(kp) }, { l: 'Wohnfläche', v: B.zahl(wfl, 0) + ' m²' }, { l: 'Cashflow n. St. / Jahr', v: B.eurS(cf), art: 'hi' }],
        meta: [['Darlehen gesamt', B.eur(dl)], ['Stand', c.stand], (V && V.hatDaten ? ['Netto-Vermögen', B.eur(V.S.netto)] : ['Ø Bruttorendite', B.pct(objs.length ? sum(function (o) { return o.kpis && o.kpis.bmy; }) / objs.length : null, 2)])] }));
      S.push(B.seite(c, 'Objekte', B.abschnitt('Übersicht', 'Objekte im Bestand') + '<table><thead><tr><th>Objekt</th><th>Art</th><th class="r">Fläche</th><th class="r">Kaufpreis</th><th class="r">Bruttorendite</th><th class="r">CF n. St./J.</th><th class="r">DSCR</th></tr></thead><tbody>'
        + objs.map(function (o) { var d = o.data, k = o.kpis || {}; return '<tr><td>' + B.esc([d.str, d.hnr].filter(Boolean).join(' ')) + '<div class="det">' + B.esc([d.plz, d.ort].filter(Boolean).join(' ')) + '</div></td><td>' + B.esc(d.objart || '') + '</td><td class="r num">' + B.zahl(parseFloat(String(d.wfl || '').replace(',', '.')), 0) + ' m²</td><td class="r num">' + B.eur(k.kp) + '</td><td class="r num">' + B.pct(k.bmy, 2) + '</td><td class="r num' + ((k.cf_ns_yearly || 0) >= 0 ? ' pos' : ' neg') + '">' + B.eurS(k.cf_ns_yearly) + '</td><td class="r num">' + B.zahl(k.dscr, 2) + '</td></tr>'; }).join('')
        + '</tbody></table>'));
      vermoegenSeiten(B, c, V).forEach(function (x) { S.push(x); });
      objs.forEach(function (o) {
        var d = o.data, k = o.kpis || {}, adr = [[d.str, d.hnr].filter(Boolean).join(' '), [d.plz, d.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        var F = trFotos(o, opt), haupt = F.length ? F[0].src : (opt && opt.fotos && Array.isArray(opt.fotos[o.id]) ? null : d._thumb);
        var vn = vorherNachher(B, F);
        var rest = F.slice(1).filter(function (x) { return !vn || (x.rolle !== 'vorher' && x.rolle !== 'nachher'); }).slice(0, 4);
        S.push(B.seite(c, adr, '<div class="zwei"><div>' + (haupt ? '<img class="karte" src="' + haupt + '" alt="" style="height:52mm;object-fit:cover">' : '') + '</div><div>'
          + B.abschnitt(d.objart || '', adr) + '<div class="kv" style="grid-template-columns:1fr">' + [['Kaufdatum', B.datum(d.kaufdat) || '–'], ['Wohnfläche', B.zahl(parseFloat(String(d.wfl || '').replace(',', '.')), 0) + ' m²'], ['Baujahr', B.jahr(d.baujahr)], ['Kaufpreis', B.eur(k.kp)], ['Darlehen', B.eur(k.d_total)]]
            .map(function (x) { return '<div><span>' + x[0] + '</span><span class="num">' + x[1] + '</span></div>'; }).join('') + '</div></div></div>'
          + B.kacheln([{ l: 'Bruttorendite', v: B.pct(k.bmy, 2) }, { l: 'CF n. St. / Monat', v: B.eurS(k.cf_ns_monthly), art: (k.cf_ns_monthly || 0) >= 0 ? 'gut' : 'schlecht' }, { l: 'DSCR', v: B.zahl(k.dscr, 2) }, { l: 'Rate / Monat', v: B.eur(k.rate_total_m) }])
          + (d.thesis ? '<h3>Investmentthese</h3><p>' + B.esc(d.thesis) + '</p>' : '')
          + vn
          + (rest.length ? '<div class="galerie">' + rest.map(function (x) { return '<img src="' + x.src + '" alt="">'; }).join('') + '</div>' : '')));
      });
      return B.dokument('Track Record · ' + (c.marke.company || ''), S);
    });
  }

  /* ── 7 · Bankexport (Portfolio, quer) ────────────────────────────── */
  function bankexport(opt) {
    var B = D();
    return Promise.all([basis('Bankexport · alle Darlehen'), getAllObjectsData()]).then(function (z) {
      var c = z[0], objs = nachIds(z[1], opt, true);
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

  /* ── Selbstauskunft (v3184, Demo) ───────────────────────────────────
     Marcel 05.11.2026: „ein PDF … wo wir eine Selbstauskunft, die könnten wir ja direkt ausfüllen."
     Aufbau wie die Selbstauskunft der Banken für eine Immobilienfinanzierung: Person, Beschäftigung,
     Einnahmen, Ausgaben, Vermögen, Verbindlichkeiten, Erklärung. Vorbefüllt wird nur, was DealPilot
     belegt weiß: der Immobilienbestand (gewonnene Objekte), seine Darlehen mit Restschuld und Rate,
     die Mieteinnahmen und das Vorhaben des offenen Objekts. Alles Persönliche bleibt ein leeres Feld -
     DealPilot führt keine Gehalts-, Ausweis- oder Familiendaten und erfindet keine. */
  function selbstauskunft(opt) {
    var B = D();
    return Promise.all([basis('Selbstauskunft'), getAllObjectsData()]).then(function (z) {
      var c = z[0], objs = nachIds(z[1], opt, true), m = c.marke || {};
      var rows = (typeof _buildBankExportRows === 'function' ? _buildBankExportRows(objs) : []) || [];
      var zahl = function (v) { var n = parseFloat(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
      c.zeile = 'Entwurf zum Ergänzen · Stand ' + c.stand;
      var leer = '<td style="border-bottom:1px solid var(--line);height:8mm"></td>';
      var feldTab = function (titel, felder) {
        return '<h3>' + titel + '</h3><table style="table-layout:fixed"><thead><tr><th style="width:40%"></th><th style="width:30%">Antragsteller 1</th><th style="width:30%">Antragsteller 2</th></tr></thead><tbody>'
          + felder.map(function (f) { return '<tr><td>' + B.esc(f[0]) + '</td>' + (f[1] != null ? '<td class="num">' + B.esc(f[1]) + '</td>' : leer) + leer + '</tr>'; }).join('') + '</tbody></table>';
      };
      var adr = [m.address, ((m.plz || '') + ' ' + (m.city || '')).trim()].filter(Boolean).join(', ');
      var S = [];
      S.push(B.seite(c, 'Person und Einkommen', B.abschnitt('Selbstauskunft', 'Angaben zur Person', 'Für die Finanzierungsanfrage – bitte vollständig ausfüllen, Nachweise beifügen und unterschreiben.')
        + '<div class="hinweis">Entwurf aus DealPilot. Vorausgefüllt ist nur, was im Konto belegt ist (Immobilienbestand, Darlehen, Mieten). Alle übrigen Angaben trägst du selbst ein; die Bank verlangt dazu Nachweise.</div>'
        + feldTab('Person', [['Name, Vorname', m.name || null], ['Geburtsname'], ['Geburtsdatum, Geburtsort'], ['Staatsangehörigkeit'], ['Familienstand, Güterstand'], ['Anschrift', adr || null], ['Wohnhaft dort seit'], ['Telefon, E-Mail', [m.phone, m.email].filter(Boolean).join(' · ') || null], ['Kinder (Anzahl, Alter)'], ['Steuer-ID']])
        + feldTab('Beschäftigung', [['Beruf'], ['Arbeitgeber'], ['Beschäftigt seit'], ['Befristet / Probezeit'], ['Selbstständig seit (falls zutreffend)']])));
      var mieteM = objs.reduce(function (a, o) { return a + zahl(o.data && o.data.nkm); }, 0);
      var rateM = rows.reduce(function (a, r) { return a + (Number(r.kapitaldienst) || 0); }, 0);
      var restS = rows.reduce(function (a, r) { return a + (Number(r.akt_restschuld) || 0); }, 0);
      var kpS = objs.reduce(function (a, o) { return a + (Number(o.kpis && o.kpis.kp) || 0); }, 0);
      S.push(B.seite(c, 'Einnahmen und Ausgaben', B.abschnitt('Selbstauskunft', 'Monatliche Einnahmen und Ausgaben', 'Beträge je Monat in Euro.')
        + feldTab('Einnahmen', [['Nettoeinkommen aus Beschäftigung'], ['Einkünfte aus Selbstständigkeit (netto)'], ['Mieteinnahmen kalt (Bestand)', mieteM ? B.eur(mieteM) : null], ['Kindergeld'], ['Sonstige Einnahmen']])
        + feldTab('Ausgaben', [['Miete der eigenen Wohnung'], ['Lebenshaltung'], ['Versicherungen, Altersvorsorge'], ['Raten Immobiliendarlehen (Bestand)', rateM ? B.eur(rateM) : null], ['Raten sonstiger Kredite, Leasing'], ['Unterhaltszahlungen'], ['Sonstige Ausgaben']])));
      var immo = '<h3>Immobilienvermögen</h3>' + (objs.length
        ? '<table class="dicht"><thead><tr><th>Objekt</th><th class="r">Wohnfläche</th><th class="r">Kaufpreis</th><th class="r">Verkehrswert heute</th><th class="r">Kaltmiete / Monat</th></tr></thead><tbody>'
          + objs.map(function (o) { var d = o.data || {};
              return '<tr><td>' + B.esc([d.str, d.hnr].filter(Boolean).join(' ')) + '<div class="det">' + B.esc([d.plz, d.ort].filter(Boolean).join(' ')) + '</div></td><td class="r num">' + B.zahl(zahl(d.wfl), 0) + ' m²</td><td class="r num">' + B.eur(o.kpis && o.kpis.kp) + '</td>' + leer + '<td class="r num">' + B.eur(zahl(d.nkm)) + '</td></tr>'; }).join('')
          + '<tr class="ende"><td>Summe</td><td></td><td class="r num">' + B.eur(kpS) + '</td><td></td><td class="r num">' + B.eur(mieteM) + '</td></tr></tbody></table>'
        : '<p class="det">Kein Objekt im Bestand (gewonnene Deals).</p>');
      var dar = '<h3>Verbindlichkeiten aus Immobiliendarlehen</h3>' + (rows.length
        ? '<table class="dicht"><thead><tr><th>Objekt</th><th>Bank</th><th class="r">Ursprungsbetrag</th><th class="r">Restschuld heute</th><th class="r">Rate / Monat</th><th>Zinsbindung bis</th></tr></thead><tbody>'
          + rows.map(function (r) { return '<tr><td>' + B.esc([r.strasse, r.hnr].filter(function (x) { return x && x !== '–'; }).join(' ')) + '</td><td>' + B.esc(r.bank || '') + '</td><td class="r num">' + B.eur(r.darl_summe) + '</td><td class="r num">' + B.eur(r.akt_restschuld) + '</td><td class="r num">' + B.eur(r.kapitaldienst) + '</td><td class="num">' + B.esc(r.laufzeit || '') + '</td></tr>'; }).join('')
          + '<tr class="ende"><td>Summe</td><td></td><td></td><td class="r num">' + B.eur(restS) + '</td><td class="r num">' + B.eur(rateM) + '</td><td></td></tr></tbody></table>'
        : '<p class="det">Keine Darlehen im Bestand erfasst.</p>');
      S.push(B.seite(c, 'Vermögen und Verbindlichkeiten', B.abschnitt('Selbstauskunft', 'Vermögen und Verbindlichkeiten', 'Bestand aus DealPilot; Verkehrswerte und übriges Vermögen bitte selbst eintragen.')
        + immo + feldTab('Weiteres Vermögen', [['Bankguthaben, Tagesgeld'], ['Wertpapiere, Depots'], ['Bausparverträge (Guthaben)'], ['Lebens-/Rentenversicherungen (Rückkaufwert)'], ['Sonstiges Vermögen']])
        + dar + feldTab('Weitere Verbindlichkeiten', [['Ratenkredite (Restschuld)'], ['Dispositionskredit'], ['Bürgschaften'], ['Sonstige Verbindlichkeiten']])));
      /* Das Vorhaben: das gerade offene Objekt, sofern es nicht schon zum Bestand gehört */
      var key = window._currentObjKey, imBestand = objs.some(function (o) { return o.id === key; });
      var kp = zahlAus('kp'), dl = darlehen().reduce(function (a, x) { return a + (x.betrag || 0); }, 0);
      var vorhaben = (!imBestand && key && kp) ? '<h3>Finanzierungsvorhaben</h3>' + B.liste([['Objekt', objektKopf().adresse], ['Kaufpreis', B.eur(kp)], ['Darlehenswunsch', dl ? B.eur(dl) : '–', { art: 'summe' }]]) : '';
      S.push(B.seite(c, 'Erklärung', B.abschnitt('Selbstauskunft', 'Vorhaben und Erklärung') + vorhaben
        + '<h3>Erklärung</h3><p>Ich/Wir versichere(n), dass die vorstehenden Angaben vollständig und richtig sind. Mir/Uns ist bekannt, dass unrichtige oder unvollständige Angaben zur Ablehnung oder Kündigung einer Finanzierung führen können. Gegen mich/uns laufen keine Zwangsvollstreckungsmaßnahmen, eine Vermögensauskunft wurde nicht abgegeben.</p>'
        + '<table style="margin-top:14mm"><tbody><tr><td style="width:30%;border-top:1px solid var(--ink)">Ort, Datum</td><td style="width:5%"></td><td style="border-top:1px solid var(--ink)">Unterschrift Antragsteller 1</td><td style="width:5%"></td><td style="border-top:1px solid var(--ink)">Unterschrift Antragsteller 2</td></tr></tbody></table>'));
      return B.dokument('Selbstauskunft · ' + (m.name || m.company || ''), S);
    });
  }

  /* ── Einstieg ────────────────────────────────────────────────────── */
  var TYPEN = {
    /* v5060 · Marcel 26.11.2026: die drei neuen Fassungen gehen live, alle drei zur Auswahl (Kombi Standard). Die bisherigen
       Schluessel liefern jetzt die neuen Fassungen (auch Telegram-Bot und PDF-Dienst: investment = Kombi, bank = Bankfassung,
       kurz = Kurzfassung); die alten Fassungen bleiben als *_alt fuer einen Rueckweg ohne Knopf. */
    investment: function () { return investmentNeu('b'); }, investment_alt: function () { return investment('voll'); }, investment_muster: function () { return investmentMuster('voll'); }, kurz_muster: function () { return investmentMuster('kurz'); }, iv_a_muster: function () { return investmentNeu('a'); }, iv_b_muster: function () { return investmentNeu('b'); }, iv_c_muster: function () { return investmentNeu('c'); },   /* v4790 · Muster, kein Knopf */   /* v4580 · Muster, kein Knopf */
    bank: function () { return investmentNeu('c'); }, kurz: function () { return investmentNeu('a'); },
    bank_alt: function () { return investment('bank'); }, kurz_alt: function () { return investment('kurz'); },
    kaufpreisaufteilung: kaufpreisaufteilung, finanzamt: function (o) { return finanzamt(3, false, o); }, finanzamt_anlagev: function (o) { return finanzamt(3, true, o); }, trackrecord: trackRecord, bankexport: bankexport, selbstauskunft: selbstauskunft,
    steuermappe: steuermappe,   /* v3471 · Steuer-Mappe im einheitlichen Design */
    jahresabschluss: jahresabschluss,   /* v3480 · Jahresabschluss der Gesellschaft */
    vermoegen: vermoegenDok   /* v3226 · Vermögen & Haushalt */
  };
  function dokument(typ, opt) {
    if (!TYPEN[typ]) return Promise.reject(new Error('Unbekanntes Dokument: ' + typ));
    /* v3700 · P2: Kundenstand ohne freigegebene Steuerdaten: kein Steuerdokument (es truege keine oder eine fremde Steuerzahl) */
    try { if (/^(finanzamt|finanzamt_anlagev)$/.test(typ) && window.DpSteuerKontext && DpSteuerKontext.gesperrt()) return Promise.reject(nutzerFehler('Steuerdaten nicht freigegeben. Für diesen Kundenstand erstellt DealPilot kein Steuerdokument.')); } catch (e) {}
    try { if (typeof window.calcNow === 'function' && /investment|bank|kurz|finanzamt|kaufpreis/.test(typ)) window.calcNow(); } catch (e) {}
    return TYPEN[typ](opt || {});
  }
  window.DpDokumente = {
    VERSION: 'v4380', TYPEN: Object.keys(TYPEN), dokument: dokument,
    oeffnen: function (typ, opt) { return dokument(typ, opt).then(function (h) { D().vorschau(h, typ); }); }
  };
})();
