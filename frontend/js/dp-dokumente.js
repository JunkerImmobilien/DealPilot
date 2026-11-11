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
  function scoreDaten(K) {
    var SC = null, SCK = null;
    try { if (window.DealScore && typeof DealScore.computeFromKpis === 'function') SC = DealScore.computeFromKpis(K); } catch (e) {}
    try { SCK = window._dpPdfScore ? _dpPdfScore(K) : null; } catch (e) {}
    /* wie pdf-investment-bank.js v2992: die ZAHL ist der Score der Objektkarte; die Deutung nur, wenn derselbe Score sie liefert */
    if (SCK && SC && SCK.quelle !== 'kennzahlen') SC = { score: SCK.score, label: SCK.label };
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
      { l: 'EK-Rendite', v: B.pct(K.ekr, 2), s: 'p. a. vor Steuern' },
      { l: 'Interner Zinsfuß', v: da(K.irr) === null ? 'n. b.' : B.pct(K.irr, 2), s: 'IRR' },
      { l: 'Kaltmiete', v: B.eur(da(K.nkm_j) !== null ? K.nkm_j : (rows[1] && rows[1].nkm_y)), s: 'p. a. inkl. Zusatzeinnahmen' },
      { l: 'Equity Multiple', v: da(K.em) === null ? '–' : B.zahl(K.em, 1) + 'x', s: 'über die Haltedauer' },
      { l: 'Wertpuffer', v: B.eurS(K.wp_kpi), s: 'gegenüber Kaufpreis' },
      { l: 'Deal Score', v: SC.score ? B.zahl(SC.score, 0) + ' / 100' : '–', s: SC.label || '', art: 'hi' }
    ]);
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
    var svw = zahlAus('svwert');
    if (svw) {
      fin.push([S.svw_label || 'Wertangabe (Reiter Objekt)', B.eur(svw)]);
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
  function zuwachsKurz(B) {
    var S = St(), rows = S.cfRows || [], vz = S._vz || {};
    if (rows.length < 2 || da(vz.verm_zuwachs) === null || typeof B.wasserfall !== 'function') return '';
    return '<div class="block"><h3>Vermögenszuwachs über ' + rows.length + ' Jahre</h3>'
      + B.wasserfall([{ name: 'Tilgung', wert: vz.tilgung_kum, klasse: 'b1' }, { name: 'CF-Überschuss', wert: vz.cf_ueberschuss_konto, klasse: 'b2' },
        { name: 'Steuervorteil', wert: vz.steuervorteil, klasse: 'b2' }, { name: 'Wertsteigerung', wert: vz.wertsteig_kum, klasse: 'b2' }], 'Zuwachs')
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
    var h = '<div class="block">' + lin + '<p class="det">Der Objektwert ist eine Annahme aus der hinterlegten Wertsteigerung, keine Bewertung nach § 194 BauGB.</p></div>'
      + '<h3>Vermögenszuwachs im Detail</h3>' + tab(B, ['Jahr', 'Immobilienwert', 'Restschuld', 'Eigenkapital im Objekt', 'Zuwachs gegenüber heute'],
        jz.map(function (r) { return { w: [String(r.cal || r.y), B.eur(r.wert_y), B.eur(r.rs), B.eur(r.eq_y), B.eurS((r.eq_y || 0) - ek0)] }; }), 'dicht');
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
        + B.wasserfall([{ name: 'Tilgung', wert: vz.tilgung_kum, klasse: 'b1' }, { name: 'CF-Überschuss', wert: vz.cf_ueberschuss_konto, klasse: 'b2' },
          { name: 'Steuervorteil', wert: vz.steuervorteil, klasse: 'b2' }, { name: 'Wertsteigerung', wert: vz.wertsteig_kum, klasse: 'b2' }], 'Zuwachs');
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
  function wertSpannen(V, kp, B) {
    var werte = [].concat.apply([], V.map(function (v) { return [v.unten, v.mitte, v.oben]; })).concat([kp]).filter(function (x) { return da(x) !== null; });
    if (!werte.length) return '';
    var min = Math.min.apply(null, werte) * 0.92, max = Math.max.apply(null, werte) * 1.06, W = 520, L = 150, R = 14, zh = 22, H = V.length * zh + 30;
    var X = function (v) { return L + (v - min) / (max - min) * (W - L - R); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dg" role="img" aria-label="Werte je Verfahren">';
    V.forEach(function (v, i) {
      var y = 14 + i * zh, u = da(v.unten) !== null ? v.unten : v.mitte, o = da(v.oben) !== null ? v.oben : v.mitte;
      s += '<text x="0" y="' + (y + 4) + '" class="bt">' + B.esc(v.name + (v.fuehrend ? ' (führend)' : '')) + '</text>'
        + '<rect x="' + X(u).toFixed(1) + '" y="' + (y - 4) + '" width="' + Math.max(2, X(o) - X(u)).toFixed(1) + '" height="8" rx="2" class="' + (v.fuehrend ? 'b1' : 'f1') + '"/>'
        + '<circle cx="' + X(v.mitte).toFixed(1) + '" cy="' + y + '" r="3.2" class="b3"/>';
    });
    if (da(kp) !== null) s += '<line x1="' + X(kp).toFixed(1) + '" x2="' + X(kp).toFixed(1) + '" y1="4" y2="' + (H - 18) + '" class="l2"/><text x="' + X(kp).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="a">Kaufpreis ' + B.esc(B.zahl(kp / 1000, 0)) + ' T€</text>';
    return s + '</svg>';
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
      if (PD.bruecke && PZ && typeof PZ.ueberleitungZeilen === 'function') {
        var UZ = PZ.ueberleitungZeilen(PD.bruecke) || [], um = Math.max.apply(null, UZ.filter(function (z) { return z.schritt; }).map(function (z) { return Math.abs(z.w); }).concat([1]));
        var farbe = { bestand: '#2A2727', kosten: 'var(--rot)', soll: 'color-mix(in srgb,var(--gold) 55%,#fff)', ziel: 'var(--gold-d)' };
        /* v3181 · Marcel: Seitenumbruch vor der Wertueberleitung (sie riss sonst zwischen zwei Seiten) */
        h += '<h3 style="break-before:page;page-break-before:always">Wertüberleitung · Ertragswert je Stufe</h3><table><tbody>' + UZ.map(function (z) {
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
          + '<p class="det">' + B.esc(klar((PD.aufteilung_hinweis ? 'Aufteilung: ' + PD.aufteilung_hinweis + ' ' : '') + (PD.fuss || ''))) + '</p></div>';
      }
    } else if (WZ && WZ.stufen && WZ.stufen.length) {
      h += '<h3>Ertragswert je Stufe</h3>' + tab(B, ['Stufe', 'Ertragswert', 'Maßnahmen', 'Marktpreisindikation'], WZ.stufen.map(function (s) { return [s.titel, B.eur(s.wert), s.kosten ? B.eur(s.kosten) : '–', s.mpi != null ? B.eur(s.mpi) : '–']; }));
    }
    if (WZ) {
      if (WZ.ausblick) h += '<div class="hinweis">' + B.esc(klar(WZ.ausblick)) + '</div>';
      (WZ.stau || []).forEach(function (s) { h += '<p><b>Sanierungsstau ' + B.esc(s.titel) + ':</b> ' + B.esc(klar(s.satz)) + '</p>'; });
      if (WZ.kern && WZ.kern.length) h += '<div class="block"><h3>Kernaussagen</h3>' + B.liste(WZ.kern.map(function (k) { return [k.titel, k.wert_text || '', { det: k.text ? klar(k.text) : '' }]; })) + '</div>';
      /* v3180c · Bankfassung ohne die Erklaertexte des Marktberichts (Methodik) - die Zahlen stehen in den Tabellen darueber */
      if (!kurz && !bank) (WZ.texte || []).forEach(function (t) { h += '<div class="block"><h3>' + B.esc(t.h) + '</h3>' + t.p.map(function (x) { return '<p>' + B.esc(klar(x)) + '</p>'; }).join('') + '</div>'; });
      /* v3180c · die Kennzeichnung steht schon im Fuss der Stufen-Tabelle (PD.fuss) - nicht zweimal */
      if (WZ.hinweis && !(PD && PD.fuss && !kurz)) h += '<p class="det">' + B.esc(klar(WZ.hinweis)) + '</p>';
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
    if (kurz) return '<div class="zwei"><div class="block"><h3>DSCR im Verlauf</h3>' + dscr + '</div><div class="block"><h3>LTV im Verlauf</h3>' + ltv + '</div></div>';
    return '<div class="block"><h3>Schuldendienstdeckung (DSCR) im Verlauf</h3>' + B.kacheln([{ l: 'DSCR Jahr 1', v: B.zahl(CD.dscrToday, 2), s: 'erstes volles Jahr' }, { l: 'DSCR Ende Zinsbindung', v: B.zahl(CD.dscrEzb, 2), s: CD.bindj ? 'Jahr ' + CD.bindj : '' }, { l: 'DSCR Ende', v: B.zahl(CD.dscrEnd, 2), s: 'Betrachtungsende' }], true) + dscr + '</div>'
      + '<div class="block"><h3>Beleihungsauslauf (LTV) im Verlauf</h3>' + B.kacheln([{ l: 'LTV heute', v: B.pct(CD.ltvToday, 1) }, { l: 'LTV Ende Zinsbindung', v: B.pct(CD.ltvEzb, 1), s: CD.bindj ? 'Jahr ' + CD.bindj : '' }, { l: 'LTV Ende', v: B.pct(CD.ltvEnd, 1), s: 'Betrachtungsende' }], true) + ltv + '</div>';
  }
  /* Belastungsprobe: die Matrix rechnet BankCharts (HTML), hier werden ihre 25 Zellen ausgelesen - wie pdf-investment-bank.js */
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
    var block = function (t, x) { if (!x || !on(t)) return ''; return '<div class="fliess"><h3>' + B.esc(t) + '</h3>' + String(x).split(/\n+/).map(function (p) { p = klar(p); return p ? '<p>' + B.esc(p) + '</p>' : ''; }).join('') + '</div>'; };
    var liste = function (t, arr) { if (!arr || !arr.length || !on(t)) return ''; return '<div class="fliess"><h3>' + B.esc(t) + '</h3><ul>' + arr.slice(0, kurz ? 3 : 8).map(function (x) { return '<li>' + B.esc(klar(x)) + '</li>'; }).join('') + '</ul></div>'; };
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
    if (!kurz) h += block('Gesamtbewertung', gb);
    /* v3180d · untereinander statt zweispaltig: im Blocksatz ohne Silbentrennung (Server-Chrome hat kein Trennwoerterbuch) rissen die schmalen Spalten Luecken */
    h += liste('Stärken', ai.staerken || ai.strengths) + liste('Risiken', ai.risiken || ai.schwaechen || ai.risks);
    if (!kurz && !bank && ai.risikoanalyse && typeof ai.risikoanalyse === 'object') {   /* v3180c · Bank: steht in Risiken und Belastungsprobe */
      var ra = ai.risikoanalyse;
      h += liste('Risikoanalyse', [ra.finanzierungsrisiko ? 'Finanzierungsrisiko: ' + ra.finanzierungsrisiko : null, ra.cashflow_stabilitaet ? 'Cashflow-Stabilität: ' + ra.cashflow_stabilitaet : null,
        ra.annahmen_abhaengigkeit ? 'Abhängigkeit von Annahmen: ' + ra.annahmen_abhaengigkeit : null, 'Gerechnete Schuldendeckung je Zins- und Mietszenario: siehe Belastungsprobe.'].filter(Boolean));
    }
    var best = false; try { best = !!(window.DpBestand && DpBestand.istBestand()); } catch (e) {}
    if (!best || kurz || bank) h += liste('Bankargumente', ai.bankargumente);
    var gedeckt = !best && typeof window._dpPdfGedeckt === 'function' && window._dpPdfGedeckt('Anschlussfinanzierung (Ankauf)', { phasen: true });
    /* v3180c · Bank: die Anschlussfinanzierung steht GERECHNET unter „Finanzierung in drei Phasen“ und „Zinsänderungsrisiko“ */
    if (!kurz && !bank && !gedeckt) h += block('Anschlussfinanzierung', [qa(ai.anschlussfinanzierung), best && ai.bankargumente && ai.bankargumente.length ? 'Argumente für die Bank:\n' + ai.bankargumente.map(function (x) { return '– ' + x; }).join('\n') : ''].filter(Boolean).join('\n'));
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
    if (da(S.wert_basis) !== null && S.wert_basis !== K.kp) z.push(['Wert-Anker der Wertsteigerung', (S.wert_basis_text || (zahlAus('svwert') ? 'Verkehrswert' : 'Bankbewertung')) + ' · ' + B.eur(S.wert_basis)]);
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
      meta: [['Objekt-Nr.', o.seq || '–'], ['Stand', c.stand], ['Deal Score', SC.score != null ? B.zahl(SC.score, 0) + ' · ' + (SC.label || '') : '–']],
      zitat: feld('thesis') || '', hinweisRechts: (bank || kurz) ? 'Finanzierungsunterlage' : 'Vertraulich' }));
    /* Überblick */
    S.push(B.seite(c, 'Überblick', B.abschnitt('Executive Summary', 'Investitionsüberblick', o.adresse + ' · ' + o.art)
      + '<div class="zwei"><div>' + B.scoreRing(SC.score, SC.label) + '</div><div>' + B.kacheln([{ l: 'CF n. St. Jahr 1', v: B.eurS(K.cf_ns), art: (K.cf_ns || 0) >= 0 ? 'gut' : 'schlecht' }, { l: 'CF n. St. Ende Zinsbindung', v: B.eurS(K.cf_ns_ezb) }]).replace('class="kz"', 'class="kz" style="grid-template-columns:1fr 1fr"') + '</div></div>'
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
    if (pa) S.push(B.seite(c, 'Pilot-Analyse', B.abschnitt(ab(), 'Pilot-Analyse') + pa));
    S.push(B.seite(c, 'Annahmen', B.abschnitt('Anhang', 'Annahmen und Hinweise') + annahmenVoll(K, B, kurz)));
    return B.dokument(name + ' · ' + o.adresse, S);
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
      var S = [];
      S.push(B.deckblatt(c, { bild: info.fotos[0] || info.karte || null, eyebrow: abw && T.wahl === 'jacoby' ? 'Kaufpreisaufteilung nach der umgekehrten Ertragswertmethode (Jacoby)' : 'Kaufpreisaufteilung nach BMF-Arbeitshilfe', titel: o.adresse, unter: o.art + (o.bj ? ' · Baujahr ' + B.jahr(o.bj) : ''),
        wertLabel: 'Gebäudeanteil', wert: B.pct(gebPctG, 2),
        wertNeben: abw ? (B.esc(T.name) + '<br>amtlich ' + B.pct(w('gebaeudeanteil_prozent'), 2)) : ('Grund und Boden ' + B.eur(w('kaufpreisanteil_grund')) + '<br>Gebäude ' + B.eur(w('kaufpreisanteil_gebaeude'))),
        meta: [['Kaufpreis', B.eur(z.kp)], ['Stand', c.stand], ['Grundlage', abw ? 'BMF-Arbeitshilfe · ' + (T.wahl === 'jacoby' ? 'Jacoby' : 'Bodenabschlag') : 'BMF-Arbeitshilfe']] }));
      S.push(B.seite(c, 'Herleitung', B.abschnitt('Abschnitt 1', 'Herleitung nach der Arbeitshilfe', 'Sach- und Ertragswert nach der Arbeitshilfe des Bundesministeriums der Finanzen; maßgeblich ist der höhere Bezug je Objektart.')
        + B.liste([['Bodenwert', B.eur(w('bodenwert'))], ['Vorläufiger Sachwert', B.eur(w('sachwert_vorlaeufig'))], ['Marktangepasster Sachwert', B.eur(w('sachwert_marktangepasst'))],
          ['Vorläufiger Ertragswert', B.eur(w('ertragswert'))], ['Maßgebender Verkehrswert', B.eur(w('massgebender_verkehrswert')), { art: 'summe' }],
          ['Grund und Boden (Einzelwert)', B.eur(w('grund_boden_wert')), { art: 'ein' }], ['Gebäude (Einzelwert)', B.eur(w('gebaeude_wert')), { art: 'ein' }],
          ['Gebäudeanteil', B.pct(w('gebaeudeanteil_prozent'), 2), { art: 'ende' }]])
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
      if (abw) {
        var d = function (a, b) { var x = b - a; return Math.abs(x) < 0.5 ? '' : (x > 0 ? '+ ' : '− ') + B.eur(Math.abs(x)); };
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
          + (T.rndVon ? (function () {
              var von = Math.round(T.rndVon), bis = Math.round(T.rndBis || T.rndVon), jj = [];
              for (var n = Math.min(von, bis); n <= Math.max(von, bis) && jj.length < 12; n++) jj.push(n);
              return '<h3>AfA bei nachgewiesener Restnutzungsdauer (§ 7 Abs. 4 Satz 2 EStG)</h3><table><thead><tr><th>Nutzungsdauer</th><th class="r">AfA-Satz</th><th class="r">AfA je Jahr</th></tr></thead><tbody>'
                + jj.map(function (n, i) { return '<tr' + (i === jj.length - 1 ? ' class="ende"' : '') + '><td>' + n + ' Jahre</td><td class="r num">' + B.pct(100 / n, 2) + '</td><td class="r num">' + B.eur(T.basis / n) + '</td></tr>'; }).join('')
                + '</tbody></table><div class="hinweis">Eine kürzere als die gesetzliche Nutzungsdauer setzt einen Nachweis voraus, in der Regel ein Gutachten zur Restnutzungsdauer.</div>';
            })() : '')));
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
  var WK = [['1. Finanzierungskosten', [['schuldzinsen', 'Schuldzinsen'], ['kontofuehrung', 'Kontoführungsgebühren'], ['bereitstellung', 'Bereitstellungszinsen'], ['notar_grundschuld', 'Notar / Grundschuld (anteilig)'], ['vermittlung', 'Vermittlungsprovision Darlehen'], ['finanz_sonst', 'Sonstiges (Finanzierung)']]],
    ['2. Betriebskosten', [['nk_umlf', 'Umlagefähige Nebenkosten (durchlaufend)'], ['nk_n_umlf', 'Nicht umlagefähige Nebenkosten'], ['betr_sonst', 'Sonstige Betriebskosten']]],
    ['3. Verwaltungskosten', [['hausverwaltung', 'Hausverwaltung / Mietsonderverwaltung'], ['steuerber', 'Steuerberatung'], ['porto', 'Porto, Büromaterial'], ['verw_sonst', 'Sonstiges (Verwaltung)']]],
    ['4. Sonstige Kosten', [['fahrtkosten', 'Fahrtkosten zur Immobilie'], ['verpflegung', 'Verpflegungsmehraufwand'], ['hotel', 'Übernachtungskosten'], ['inserat', 'Inseratskosten'], ['gericht', 'Gerichts- / Anwaltskosten'], ['telefon', 'Telefon / Internet'], ['sonst_kosten', 'Sonstiges (Leerstand u. a.)']]],
    ['5. Absetzung für Abnutzung (AfA)', [['afa', 'AfA Gebäude (linear)'], ['sonst_bewegl_wg', 'AfA bewegliche Wirtschaftsgüter']]],
    ['6. Anschaffungsnahe Herstellungskosten / Erhaltung', [['anschaffungsnah', 'Anschaffungsnah (§ 6 Abs. 1 Nr. 1a EStG)'], ['erhaltungsaufwand', 'Erhaltungsaufwand']]]];
  var WK_NAME = {}; WK.forEach(function (g) { g[1].forEach(function (f) { WK_NAME[f[0]] = f[1]; }); });
  WK_NAME.einnahmen_km = 'Mieteinnahmen (kalt)'; WK_NAME.einnahmen_nk = 'Umlagen / Nebenkosten';

  function anlageVQuelle(jahr) {
    var t = function (j) { var x = window['AnlageV' + j]; return x && x.zeilen && x.felder ? x : null; };
    if (t(jahr)) return { T: t(jahr), jahr: jahr, ersatz: null };
    var k = Object.keys(window).filter(function (n) { return /^AnlageV\d{4}$/.test(n); }).map(function (n) { return +n.slice(7); }).filter(function (j) { return j < jahr; }).sort(function (a, b) { return b - a; });
    for (var i = 0; i < k.length; i++) if (t(k[i])) return { T: t(k[i]), jahr: k[i], ersatz: k[i] };
    return null;
  }
  function anlageVBlatt(B, jahr, tot) {
    var Q = anlageVQuelle(jahr); if (!Q || !tot) return '';
    var T = Q.T, v = tot.values || {}, z = [], sach = [], ohne = [], hinweisAfa = null;
    var zl = function (nr, kz, text, betrag, o) { return '<tr class="' + ((o && o.art) || '') + '"><td class="num" style="width:17mm">' + B.esc(nr) + '</td><td class="num det" style="width:13mm">' + (kz ? 'Kz ' + B.esc(kz) : '') + '</td><td>' + B.esc(text) + '</td><td class="r num' + ((o && o.farbe) || '') + '">' + (betrag == null ? '' : B.esc(B.eur(betrag, 2))) + '</td></tr>'; };
    var h = Q.ersatz ? '<div class="hinweis" style="border-left-color:var(--rot);background:#FAF0EC"><b>Zeilennummern aus einem anderen Formularjahr.</b> Für das Veranlagungsjahr ' + jahr + ' lag bei Erstellung keine amtliche Anlage V vor. Die Zeilennummern und Kennzahlen stammen aus dem Formular ' + Q.ersatz + '. Sie ändern sich je Veranlagungsjahr – vor dem Übertragen am aktuellen Vordruck prüfen. Die Beträge sind davon nicht berührt.</div>' : '';
    h += '<h3>Einnahmen</h3><table><tbody>';
    ['einnahmen_km', 'einnahmen_nk'].forEach(function (f) { var a = T.felder[f]; if (a && a.zeile != null) h += zl('Zeile ' + a.zeile, (T.zeilen[a.zeile] || {}).kz, WK_NAME[f], v[f] || 0); });
    h += zl('Zeile 32', null, 'Summe der Einnahmen', tot.einnahmen, { art: 'summe' }) + '</tbody></table>';
    h += '<h3>Werbungskosten</h3><table><tbody>';
    var summe = 0;
    Object.keys(T.felder).forEach(function (f) {
      if (f === 'einnahmen_km' || f === 'einnahmen_nk') return;
      var a = T.felder[f], betrag = v[f] || 0;
      if (a.zeile == null) { if (betrag) ohne.push({ f: f, betrag: betrag, grund: a.grund }); return; }
      if (!betrag) return;
      var kz = (T.zeilen[a.zeile] || {}).kz, mark = a.quelle === 'sachlogik' ? ' °' : a.quelle === 'auffang' ? ' *' : '';
      if (f === 'afa') {
        var lin = tot.afaLinear, son = tot.afaSonder7b, eigen = v.afa === (tot.auto && tot.auto.afa);
        if (son != null && son > 0 && eigen && lin != null) {
          z.push([a.zeile, zl('Zeile ' + a.zeile, kz, 'AfA Gebäude (linear, ohne § 7b)', lin) + zl('Zeile 38', (T.zeilen[38] || {}).kz, 'Sonderabschreibung § 7b EStG', son)]);
          hinweisAfa = 'Die Gebäude-AfA von ' + B.eur(betrag) + ' enthält eine Sonderabschreibung nach § 7b EStG. Zeile 35 nimmt laut Formular nur den Betrag „ohne die Zeilen 36 bis 41“ auf, deshalb steht der § 7b-Anteil getrennt in Zeile 38.';
          summe += betrag; return;
        }
        if (son == null) hinweisAfa = 'Ob in dieser Gebäude-AfA eine Sonderabschreibung nach § 7b EStG steckt, geht aus dem Steuersatz nicht hervor. Zeile 35 nimmt laut Formular nur den Betrag „ohne die Zeilen 36 bis 41“ auf: enthält die AfA einen § 7b-Anteil, gehört dieser in Zeile 38.';
      }
      z.push([a.zeile, zl('Zeile ' + a.zeile, kz, (WK_NAME[f] || f) + mark, betrag)]);
      if (a.quelle === 'sachlogik' && a.grund) sach.push('Zeile ' + a.zeile + ' · ' + (WK_NAME[f] || f) + ' – ' + a.grund);
      summe += betrag;
    });
    z.sort(function (x, y) { return x[0] - y[0]; });
    h += (z.length ? z.map(function (x) { return x[1]; }).join('') : '<tr><td colspan="4" class="det">Keine Position mit Betrag erfasst.</td></tr>') + '</tbody></table>';
    if (hinweisAfa) h += '<p class="det">' + B.esc(hinweisAfa) + '</p>';
    h += '<p class="det">Ohne Zeichen: die Kostenart steht wörtlich in der Überschrift der Formularzeile (Abschrift). * steht in keiner spezielleren Zeile; das Formular führt dafür „Sonstige Kosten“. ° folgt aus der Art des Aufwands, nicht aus dem Formulartext – Begründung unten.</p>';
    if (sach.length) h += '<div class="block"><h3>° Zuordnung aus der Art des Aufwands – bitte prüfen</h3>' + sach.map(function (s) { return '<p class="det">' + B.esc(s) + '</p>'; }).join('') + '</div>';
    if (ohne.length) h += '<div class="block"><h3>Ohne Zeilenzuordnung – bitte steuerlich prüfen</h3><p class="det">Diese Beträge sind erfasst und in der Summe enthalten. Die Zeile wäre eine steuerfachliche Entscheidung und keine Abschrift aus dem Formular.</p><table><tbody>'
      + ohne.map(function (o) { return zl('–', null, (WK_NAME[o.f] || o.f) + (o.grund ? ' – ' + o.grund : ''), o.betrag); }).join('') + '</tbody></table></div>';
    h += '<table style="margin-top:4mm"><tbody>' + zl('Zeile 83', null, 'Summe der Werbungskosten', tot.werbungskosten, { art: 'summe' })
      + zl('Zeile 85', null, 'Überschuss (Einnahmen Zeile 32 abzüglich Werbungskosten Zeile 83)', tot.ergebnis, { art: 'ende', farbe: tot.ergebnis < 0 ? ' neg' : ' pos' }) + '</tbody></table>';
    var ne = (T.nicht_erfasst || []).filter(function (n) { return !(n.zeile === 38 && hinweisAfa && /getrennt/.test(hinweisAfa)); });
    if (ne.length) h += '<div class="block"><h3>Formularzeilen, die DealPilot nicht führt</h3>' + ne.map(function (n) { return '<p class="det">Zeile ' + n.zeile + ' – ' + B.esc(String(n.text || '').replace(/`/g, '')) + '</p>'; }).join('') + '</div>';
    return h + '<p class="det">Dieselben Zahlen wie die Aufstellung, sortiert nach den Zeilen des amtlichen Formulars Anlage V ' + Q.jahr + '. Keine Steuerberatung.</p>';
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
      S.push(B.deckblatt(c, { bild: info.fotos[0] || info.karte || null, eyebrow: bg.corp ? 'Aufstellung Betriebsausgaben · Objekt in der Gesellschaft' : ('Aufstellung Werbungskosten' + (mitAnlageV ? ' mit Zuordnung zur Anlage V' : ' · Anlage V')), titel: o.adresse, unter: o.art + ' · vermietet',
        meta: [['Veranlagungsjahre', rows.map(function (r) { return r.cal; }).join(', ')], ['Stand', c.stand], ['Eigentümer', _hName || (_hId && _hId !== 'privat' ? _hId : (c.marke.name || c.marke.company || ''))]] }));
      rows.forEach(function (row, i) {
        var t = _computeYearTotal(row.cal, i + idx0) || {}, v = t.values || {};
        var ein = (Number(v.einnahmen_km) || 0) + (Number(v.einnahmen_nk) || 0);
        var tab = [['Mieteinnahmen (kalt)', B.eur(v.einnahmen_km, 2)], ['Umlagen / Nebenkosten', B.eur(v.einnahmen_nk, 2)], ['Einnahmen gesamt', B.eur(ein, 2), { art: 'summe' }]];
        var summe = 0;
        WK.forEach(function (g) {
          var s = g[1].reduce(function (a, f) { return a + (Number(v[f[0]]) || 0); }, 0); if (!s) return;
          tab.push([g[0], B.eur(s, 2), { art: 'summe' }]);
          g[1].forEach(function (f) { if (Number(v[f[0]])) tab.push([f[1], B.eur(v[f[0]], 2), { art: 'ein' }]); });
          summe += s;
        });
        tab.push(['Summe ' + bg.wort + ' ' + row.cal, B.eur(summe, 2), { art: 'summe' }]);
        tab.push([bg.corp ? 'Beitrag zum Ergebnis der Gesellschaft (vor Steuern)' : 'Einkünfte aus Vermietung und Verpachtung', B.eurS(ein - summe, 2), { art: 'ende', farbe: 1 }]);
        tab.push([bg.corp ? 'Ertragsteuer der Gesellschaft (KSt + Soli + GewSt, Belastung −)' : 'Steuerwirkung (Erstattung +, Belastung −)', B.eurS(-(row.tax_y || 0), 0), { farbe: 1 }]);
        ges.push([String(row.cal), B.eur(ein, 2), B.eur(summe, 2), B.eurS(ein - summe, 2)]);
        /* v3268 · GbR: gesonderte und einheitliche Feststellung § 180 AO */
        var _fs = (!bg.corp && window._dpGbrFeststellung) ? window._dpGbrFeststellung(row.cal, ein - summe) : null;
        var _fsHtml = _fs ? '<h3>Gesonderte und einheitliche Feststellung (§ 180 AO) · ' + B.esc(_fs.name || 'GbR') + '</h3><table><thead><tr><th>Gesellschafter</th><th class="r">Anteil</th><th class="r">Einkünfte</th></tr></thead><tbody>'
          + '<tr class="summe"><td>Einkünfte der GbR (V+V' + (_fs.objekte > 1 ? ', ' + _fs.objekte + ' Objekte' : '') + ')</td><td class="r num">100 %</td><td class="r num">' + B.eurS(_fs.einkuenfte, 2) + '</td></tr>'
          + _fs.zeilen.map(function (z) { return '<tr><td>' + B.esc(z.name) + '</td><td class="r num">' + String(Math.round(z.anteilPct * 100) / 100).replace('.', ',') + ' %</td><td class="r num">' + B.eurS(z.betrag, 2) + '</td></tr>'; }).join('')
          + '</tbody></table><p class="det">In die Einkommensteuer des Nutzers geht nur sein Anteil (' + B.eurS(_fs.eigenerBetrag, 2) + ').'
          + (_fs.vollstaendig ? '' : ' Die Anteile ergeben zusammen ' + String(Math.round(_fs.summePct * 100) / 100).replace('.', ',') + ' % — bitte die weiteren Gesellschafter im Mandanten ergänzen.')
          + ' Sonderwerbungskosten und Ergänzungsbilanzen einzelner Gesellschafter sind nicht abgebildet. Keine Steuerberatung.</p>' : '';
        S.push(B.seite(c, 'Jahr ' + row.cal, B.abschnitt('Veranlagungsjahr ' + row.cal, (bg.corp ? 'Betriebseinnahmen und Betriebsausgaben ' : 'Einnahmen und Werbungskosten ') + row.cal, o.adresse) + B.liste(tab) + _fsHtml
          + (bg.corp ? '<p class="det" style="margin-top:3mm">Die Kosten der Gesellschaft selbst (Buchführung, Jahresabschluss, IHK, Kontoführung) stehen nicht hier, sondern im Jahresabschluss der Gesellschaft. Eine Anlage V gibt es für eine GmbH/UG nicht. '
            + ((window.DealPilotUeberfuehrungKern && DealPilotUeberfuehrungKern.HINWEIS_VERKAUF_GES) || '') + '</p>' : '')));
        if (mitAnlageV) { var av = anlageVBlatt(B, row.cal, t); if (av) S.push(B.seite(c, 'Anlage V ' + row.cal, B.abschnitt('Anlage V · Zuordnung', 'Veranlagungsjahr ' + row.cal, 'Dieselben Zahlen, sortiert nach den Zeilen des amtlichen Formulars') + av)); }
      });
      S.push(B.seite(c, 'Übersicht', B.abschnitt('Übersicht', 'Alle Jahre im Vergleich') + '<table><thead><tr><th>Jahr</th><th class="r">Einnahmen</th><th class="r">' + bg.wort + '</th><th class="r">' + (bg.corp ? 'Ergebnis' : 'Einkünfte') + '</th></tr></thead><tbody>'
        + ges.map(function (g) { return '<tr><td class="num">' + g[0] + '</td><td class="r num">' + g[1] + '</td><td class="r num">' + g[2] + '</td><td class="r num">' + g[3] + '</td></tr>'; }).join('') + '</tbody></table>'
        + '<p class="det" style="margin-top:3mm">' + (mitAnlageV ? 'Die Zuordnung zu den Zeilen der Anlage V steht je Jahr auf einem eigenen Blatt.' : 'Zuordnung zur Anlage V nach den Zeilen des jeweiligen Veranlagungsjahres: Fassung „mit Anlage V“.') + ' Keine Steuerberatung.</p>'));
      return B.dokument(name + ' · ' + o.adresse, S);
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
    investment: function () { return investment('voll'); }, bank: function () { return investment('bank'); }, kurz: function () { return investment('kurz'); },
    kaufpreisaufteilung: kaufpreisaufteilung, finanzamt: function (o) { return finanzamt(3, false, o); }, finanzamt_anlagev: function (o) { return finanzamt(3, true, o); }, trackrecord: trackRecord, bankexport: bankexport, selbstauskunft: selbstauskunft,
    vermoegen: vermoegenDok   /* v3226 · Vermögen & Haushalt */
  };
  function dokument(typ, opt) {
    if (!TYPEN[typ]) return Promise.reject(new Error('Unbekanntes Dokument: ' + typ));
    try { if (typeof window.calcNow === 'function' && /investment|bank|kurz|finanzamt|kaufpreis/.test(typ)) window.calcNow(); } catch (e) {}
    return TYPEN[typ](opt || {});
  }
  window.DpDokumente = {
    VERSION: 'v3184', TYPEN: Object.keys(TYPEN), dokument: dokument,
    oeffnen: function (typ, opt) { return dokument(typ, opt).then(function (h) { D().vorschau(h, typ); }); }
  };
})();
