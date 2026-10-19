/* ════════════════════════════════════════════════════════════════════
   potenzial.js · v2430 — MIETERHÖHUNG UND ZIELBILD
   ════════════════════════════════════════════════════════════════════
   Marcel 19.10.2026: „Der Investor zeigt der Bank das versteckte Kapital
   im Haus." Je Wohnung bis zu drei Mieten:

     Ist           was heute gezahlt wird
     Soll-Miete    normale Mieterhöhung, der Mieter BLEIBT (§ 558 BGB:
                   bis zur Vergleichsmiete, frühestens 15 Monate nach der
                   letzten Erhöhung, höchstens Kappungsgrenze; dazu § 559
                   für Modernisierung im bewohnten Zustand)
     Zielbild      nach Umbau oder Neuvermietung

   Soll und Zielbild sind freiwillig („kann, nicht muss"). Ohne Angabe sieht
   niemand etwas Neues.

   WAS HIER NICHT STEHT — mit Absicht:
   · Kein Ertragswert. Er kommt aus dem Marktbericht-Dienst
     (POST /marktbericht/potenzial), derselbe Kern und dieselbe Parameter-
     Auflösung wie im Bericht Stufe 3; hier wird nur die Miete je Stufe und
     der Gewinn an Modernisierungspunkten zusammengestellt.
   · Keine Restnutzungsdauer. Sie rechnet derselbe Dienst nach Anlage 2.
   · Keine zweite Punktetabelle. Punkte je Gewerk kommen aus
     DpMfhEinheiten (rnd-calc.js MOD_ELEMENTS).
   · Kein Score, kein Verkehrswert: beide rechnen weiter mit dem Bestand.

   Kennzeichnung überall: „Potenzialwert nach Mieterhöhung bzw. Zielbild,
   keine Verkehrswertermittlung".

   Persistenz: MFH je Wohnung in `_dpMfh.einheiten[]` (Felder `soll`,
   `soll_ab`, `vgl_qm`, `ziel_qm`, `ziel_wann`, `massnahmen[]`), am Objekt
   die Felder `zb_*` (storage.js FIELDS), das letzte Ergebnis in
   `window._dpPotenzial` (storage.js `_potenzial`).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpPotenzial) return;

  var KENNZEICHNUNG = 'Potenzialwert nach Mieterhöhung bzw. Zielbild, keine Verkehrswertermittlung.';
  var KAPP_URL = 'js/data/kappungsgrenzen.json';
  var AUFTEILUNG_JE_WE = 1800;   /* Vorbelegung: Notar, Grundbuch, Teilungserklärung, Abgeschlossenheit */
  var PRAEFIX = { '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP', '08': 'BW',
                  '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH' };
  /* Maßnahmen-Katalog. `gewerk` verweist auf Anlage 2 ImmoWertV (rnd-calc.js
     MOD_ELEMENTS); ohne Gewerk trägt die Maßnahme keine Punkte. `einheit`:
     kann eine einzelne Wohnung das allein? Dach, Fassade, Heizung und
     Leitungen gehören dem Haus (dieselbe Teilung wie mfh-einheiten.js). */
  var MASSNAHMEN = [
    { id: 'bad',        t: 'Bad',                 gewerk: 'baeder',      einheit: true },
    { id: 'fenster',    t: 'Fenster',             gewerk: 'fenster',     einheit: true },
    { id: 'boeden',     t: 'Böden/Innenausbau',   gewerk: 'innenausbau', einheit: true },
    { id: 'grundriss',  t: 'Grundriss',           gewerk: 'grundriss',   einheit: true },
    { id: 'elektrik',   t: 'Elektrik',            gewerk: null,          einheit: true, hinweis: 'Leitungssysteme zählen nach Anlage 2 für das ganze Haus' },
    { id: 'renovierung', t: 'Renovierung',        gewerk: null,          einheit: true },
    { id: 'kueche',     t: 'Küche',               gewerk: null,          einheit: true },
    { id: 'dach',       t: 'Dach',                gewerk: 'dach',        einheit: false },
    { id: 'fassade',    t: 'Fassade/Dämmung',     gewerk: 'aussenwand',  einheit: false },
    { id: 'heizung',    t: 'Heizung',             gewerk: 'heizung',     einheit: false },
    { id: 'leitungen',  t: 'Leitungen',           gewerk: 'leitungen',   einheit: false },
    { id: 'sonst',      t: 'Sonstiges',           gewerk: null,          einheit: true }
  ];

  function el(id) { return document.getElementById(id); }
  function wert(id) { var e = el(id); return e ? String(e.value == null ? '' : e.value).trim() : ''; }
  function zahl(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).trim(); if (!s) return 0;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(s) : parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(n) { return (n == null || !isFinite(n)) ? '—' : Math.round(n).toLocaleString('de-DE') + ' €'; }
  function eur2(n) { return (n == null || !isFinite(n)) ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
  function pct(n, d) { return (n == null || !isFinite(n)) ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }) + ' %'; }
  function dez(n, d) { return (n == null || !isFinite(n)) ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  var MON = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  function monatText(ym) { if (!/^\d{4}-\d{2}/.test(ym || '')) return ''; return MON[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); }
  function heuteYm() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

  /* ── Kappungsgrenze (§ 558 Abs. 3 BGB) ───────────────────────────────
     Die Liste der Landesverordnungen pflegt ein eigener Erntestrang
     (frontend/js/data/kappungsgrenzen.json, Prüfer tools/kappungsgrenzen-
     pruefen.mjs). Hier wird sie nur GELESEN. Fehlt sie, ist die Gemeinde
     unbekannt oder das Land unsicher, gilt das Gesetz (20 %) — mit dem
     Hinweis, es zu prüfen. Eine eigene Angabe am Objekt geht vor. */
  var _kapp = null, _kappLauf = null;
  function kappungLaden() {
    if (_kappLauf) return _kappLauf;
    _kappLauf = (typeof fetch === 'function'
      ? fetch(KAPP_URL, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
      : Promise.resolve(null))
      .catch(function () { return null; })
      .then(function (d) { _kapp = (d && d.laender) ? d : null; return _kapp; });
    return _kappLauf;
  }
  function deDatum(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('.') : ''; }
  function kappung(ags) {
    var eigen = zahl(wert('zb_kappung_pct')) || zahl(window._dpMfh && window._dpMfh.kappung_pct);
    if (eigen === 15 || eigen === 20) return { pct: eigen, herkunft: 'eigen', pruefen: false, text: 'Kappungsgrenze ' + eigen + ' % in 3 Jahren (eigene Angabe).' };
    var std = function (warum) {
      return { pct: 20, herkunft: 'auffang', pruefen: true,
        text: 'Kappungsgrenze 20 % in 3 Jahren (§ 558 Abs. 3 BGB) — ' + warum + ', bitte prüfen.' };
    };
    if (!_kapp) return std('die Liste der Landesverordnungen liegt nicht vor');
    var a = String(ags || '').replace(/\D/g, '');
    if (a.length !== 8) return std('Gemeinde noch nicht ermittelt');
    var land = PRAEFIX[a.slice(0, 2)], L = land && _kapp.laender[land];
    if (!L) return std('Land nicht in der Liste');
    var heute = new Date().toISOString().slice(0, 10);
    var std2 = Number(_kapp.standard_kappung_pct) || 20;
    /* Name der Verordnung fuer den Kundentext: die amtliche Kurzform in
       Klammern (z. B. „Mieterschutzverordnung NRW"), sonst bis „vom". */
    var voll = String(L.verordnung || ''), kl = /\(([^)]+)\)/.exec(voll);
    var vo = kl ? kl[1].split(/\s[–—-]\s/)[0] : voll.split(' vom ')[0];
    var g = (Array.isArray(L.gemeinden) ? L.gemeinden : []).filter(function (x) { return x && x.ags === a; })[0];
    var pruef = L.unsicher ? ' — Landesliste unsicher, bitte prüfen.' : '.';
    /* Die Liste vereinigt Kappung und Mietpreisbremse: ein Eintrag mit
       kappung15 = false ist KEINE 15-%-Gemeinde. */
    if (g && g.kappung15) {
      var bis = g.kappung_gueltig_bis || L.gueltig_bis || null;
      if (bis && bis < heute) {
        return { pct: std2, herkunft: 'ausgelaufen', pruefen: true, url: L.url || null,
          text: 'Kappungsgrenze ' + std2 + ' % in 3 Jahren: die Verordnung (' + vo + ') ist am ' + deDatum(bis) + ' ausgelaufen, bitte prüfen.' };
      }
      return { pct: 15, herkunft: 'verordnung', pruefen: !!L.unsicher, url: L.url || null, verordnung: vo,
        text: 'Kappungsgrenze 15 % in 3 Jahren: ' + (g.name || 'die Gemeinde') + ' steht in der ' + vo
          + (L.fundstelle ? ' (' + L.fundstelle + (bis ? ', gültig bis ' + deDatum(bis) : '') + ')' : '') + pruef };
    }
    return { pct: std2, herkunft: 'gesetz', pruefen: !!L.unsicher,
      text: 'Kappungsgrenze ' + std2 + ' % in 3 Jahren: Gemeinde nicht in der Landesverordnung (von DealPilot gesetzt)'
        + (L.unsicher ? ' — Landesliste unsicher, bitte prüfen.' : '. Eigene Angabe möglich.') };
  }

  /* ── Gemeindeschlüssel ────────────────────────────────────────────────
     Kommt aus dem Marktbericht-Dienst (/wertparameter/zinssatz, dieselbe
     Auflösung PLZ → Gemeinde wie im Bericht) und reist mit dem Ergebnis im
     Objekt, damit die Kappungsgrenze beim nächsten Öffnen ohne Abruf steht. */
  var _agsLauf = {};
  function agsJetzt() { var p = window._dpPotenzial; return (p && p.ags && p.plz === wert('plz')) ? p.ags : null; }
  function agsHolen() {
    var plz = wert('plz');
    if (!plz) return Promise.resolve(null);
    var schon = agsJetzt(); if (schon) return Promise.resolve(schon);
    if (_agsLauf[plz]) return _agsLauf[plz];
    if (!window.Auth || typeof Auth.apiCall !== 'function') return Promise.resolve(null);
    _agsLauf[plz] = Auth.apiCall('/marktbericht/wertparameter/zinssatz', { method: 'POST',
      body: { object: { plz: plz, ort: wert('ort'), objart: wert('objart'), baujahr: wert('baujahr'), einheiten: wert('einheiten'), wfl: wert('wfl') } } })
      .then(function (r) {
        var a = r && r.ags ? String(r.ags) : null;
        if (a) { window._dpPotenzial = Object.assign({}, window._dpPotenzial || {}, { ags: a, plz: plz }); }
        return a;
      }).catch(function () { return null; });
    return _agsLauf[plz];
  }

  /* ── Punkte (Anlage 2) ─────────────────────────────────────────────── */
  function M() { return window.DpMfhEinheiten || {}; }
  function maxP(g) { return (M().maxPunkte ? M().maxPunkte(g) : 2); }
  function katalog(id) { return MASSNAHMEN.filter(function (m) { return m.id === id; })[0] || null; }
  /** Heutige Punkte eines Gewerks: in der Wohnung (eigen, sonst Haus) oder am Objekt. */
  function punkteJetzt(gewerk, e, geb) {
    var MM = M();
    if (e && MM.punkteVon) return MM.punkteVon(gewerk, (e.mod && e.mod[gewerk]) || (geb && geb[gewerk]) || '0');
    if (MM.punkteObjekt) return MM.punkteObjekt(gewerk, wert('mod_' + gewerk));
    return 0;
  }
  /** Gewinn an Punkten aus einer Maßnahmenliste: je Gewerk höchstens bis zum
      Anlage-2-Maximum, nie doppelt gezählt. */
  function punkteGewinn(liste, e, geb, nurBewohnt) {
    var je = {};
    (liste || []).forEach(function (m) {
      if (nurBewohnt && !m.bewohnt) return;
      var k = katalog(m.id); var g = k && k.gewerk;
      if (!g) return;
      je[g] = Math.max(0, maxP(g) - punkteJetzt(g, e, geb));
    });
    return Object.keys(je).reduce(function (a, g) { return a + je[g]; }, 0);
  }

  /* ── Maßnahmen einer Wohnung: alte Felder → neue Liste ────────────────
     Bis v2429 trug eine Wohnung EIN Textfeld `massnahme` und EINE Zahl
     `kosten`. Sie werden beim Lesen zur Liste; beim Speichern schreibt das
     Wohnungsfenster beide alten Felder mit (Titel verbunden, Summe), damit
     jeder alte Leser (Summenzeile, Bank-PDF, Prompt) weiter stimmt. */
  function massnahmenVon(e) {
    if (!e) return [];
    if (Array.isArray(e.massnahmen)) return e.massnahmen.filter(function (m) { return m && (m.id || m.t); });
    var t = String(e.massnahme || '').trim(), k = zahl(e.kosten);
    if (!t && !k) return [];
    return [{ id: 'sonst', t: t || 'Maßnahme', k: k, bewohnt: false, alt: true }];
  }
  function massnahmenSpiegeln(e) {
    var l = massnahmenVon(e);
    e.massnahmen = l.map(function (m) { var c = Object.assign({}, m); delete c.alt; return c; });
    e.massnahme = l.map(function (m) { return m.t; }).join(', ');
    var k = l.reduce(function (a, m) { return a + zahl(m.k); }, 0);
    e.kosten = k ? String(Math.round(k)) : '';
    return e;
  }

  /* ── § 558 / § 559: die Soll-Miete einer Wohnung ─────────────────────── */
  function plusMonate(iso, n) {
    var m = /^(\d{4})-(\d{2})/.exec(iso || ''); if (!m) return null;
    var j = +m[1], mo = +m[2] - 1 + n; j += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
    return j + '-' + String(mo + 1).padStart(2, '0');
  }
  function umlage559(liste, istM, wfl) {
    var k = (liste || []).filter(function (m) { return m.bewohnt; }).reduce(function (a, m) { return a + zahl(m.k); }, 0);
    if (!(k > 0) || !(wfl > 0)) return { monat: 0, kosten: 0 };
    var roh = k * 0.08 / 12;
    var kappeQm = (istM > 0 && istM / wfl < 7) ? 2 : 3;
    var deckel = kappeQm * wfl;
    return { monat: Math.min(roh, deckel), kosten: k, gedeckelt: roh > deckel, kappe_qm: kappeQm };
  }
  /**
   * Soll-Miete einer Wohnung (€/Monat) samt Herkunft.
   * e: { ist, wfl, status, soll, soll_ab, vgl_qm, mv_letzte_erhoehung, massnahmen }
   * ctx: { kapp: {pct,text}, vgl_qm }
   */
  function sollFuer(e, ctx) {
    ctx = ctx || {};
    var ist = zahl(e.ist), wfl = zahl(e.wfl);
    var r = { miete: null, herkunft: null, grenze: null, ab: null, ab_text: '', hinweise: [] };
    if (e.status === 'leer' || !(ist > 0)) { r.grund = 'leer'; return r; }
    var u = umlage559(massnahmenVon(e), ist, wfl);
    /* Termin: eigene Angabe vor der Frist aus dem Mietvertrag. */
    var letzte = String(e.mv_letzte_erhoehung || '');
    var frist = letzte ? plusMonate(letzte, 15) : null;
    var ab = /^\d{4}-\d{2}/.test(e.soll_ab || '') ? String(e.soll_ab).slice(0, 7) : frist;
    if (ab && ab < heuteYm()) ab = heuteYm();
    r.ab = ab;
    r.ab_text = ab ? (ab <= heuteYm() ? 'sofort' : monatText(ab)) : (letzte ? '' : 'sofort (letzte Erhöhung nicht eingetragen)');
    r.ab_herkunft = /^\d{4}-\d{2}/.test(e.soll_ab || '') ? 'eigene Angabe' : (frist ? '15 Monate nach der letzten Erhöhung (§ 558 Abs. 1 BGB)' : null);
    var eigen = zahl(e.soll);
    if (eigen > 0) {
      r.miete = eigen; r.herkunft = 'eigene Angabe';
      var kc = ctx.kapp && ctx.kapp.pct ? ist * (1 + ctx.kapp.pct / 100) + u.monat : null;
      if (kc && eigen > kc + 0.5) r.hinweise.push('liegt über der Kappungsgrenze (' + ctx.kapp.pct + ' % in 3 Jahren)');
      return r;
    }
    var vgl = zahl(e.vgl_qm) || zahl(ctx.vgl_qm);
    var m558 = ist;
    if (vgl > 0 && wfl > 0) {
      var ziel = vgl * wfl, kappe = ist * (1 + ((ctx.kapp && ctx.kapp.pct) || 20) / 100);
      m558 = Math.max(ist, Math.min(ziel, kappe));
      r.grenze = (kappe < ziel) ? 'Kappungsgrenze ' + ((ctx.kapp && ctx.kapp.pct) || 20) + ' %' : 'Vergleichsmiete';
      r.vgl_qm = vgl; r.vgl_herkunft = zahl(e.vgl_qm) ? 'eigene Angabe' : (ctx.vgl_herkunft || 'am Objekt');
    }
    if (m558 <= ist + 0.01 && !(u.monat > 0)) {
      r.grund = vgl > 0 ? 'Die Miete liegt schon an der Vergleichsmiete.' : 'Keine Vergleichsmiete eingetragen.';
      return r;
    }
    r.miete = Math.round((m558 + u.monat) * 100) / 100;
    r.herkunft = u.monat > 0 ? (m558 > ist ? 'gerechnet (§ 558 und § 559)' : 'gerechnet (§ 559)') : 'gerechnet (§ 558)';
    if (u.monat > 0) r.umlage559 = u;
    return r;
  }

  /* ── Das Modell: Wohnungen und Stufen ───────────────────────────────── */
  function objektVgl() {
    var v = zahl(wert('zb_vgl_qm'));
    if (v > 0) return { qm: v, herkunft: 'eigene Angabe (Tab Objekt)' };
    v = zahl(wert('ds2_marktmiete'));
    if (v > 0) return { qm: v, herkunft: 'Marktmiete (Tab Miete)' };
    v = zahl(wert('me_soll'));
    if (v > 0) return { qm: v, herkunft: 'Soll-Mietspiegel (Tab Miete)' };
    return { qm: 0, herkunft: null };
  }
  function artMitEinheiten() { return !!(M().artMitEinheiten && M().artMitEinheiten()); }
  function objektMassnahmen() { try { var l = JSON.parse(wert('zb_massnahmen') || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }

  /**
   * modell(opts) — rechnet nichts Wertrechtliches, stellt zusammen.
   * opts.einheiten / gebaeude / aufgeteilt / aufteilungskosten: Arbeitsstand
   * des MFH-Fensters (sonst der gespeicherte `_dpMfh`).
   */
  function modell(opts) {
    opts = opts || {};
    var ags = agsJetzt();
    var kapp = kappung(ags);
    var vg = objektVgl();
    var ctx = { kapp: kapp, vgl_qm: vg.qm, vgl_herkunft: vg.herkunft };
    var D = window._dpMfh || {};
    var liste = opts.einheiten || (artMitEinheiten() && Array.isArray(D.einheiten) ? D.einheiten : null);
    var geb = opts.gebaeude || D.gebaeude || {};
    var out = { art: liste && liste.length ? 'mfh' : 'einzel', kappung: kapp, vgl: vg, wohnungen: [],
                hat_soll: false, hat_ziel: false, kennzeichnung: KENNZEICHNUNG };
    if (liste && liste.length) {
      var flSum = 0;
      out.wohnungen = liste.map(function (e, i) { return { e: e, i: i }; }).filter(function (o) { return o.e && (zahl(o.e.wfl) > 0 || zahl(o.e.ist) > 0); }).map(function (o) {
        var e = o.e, i = o.i;
        var wfl = zahl(e.wfl), ist = e.status === 'leer' ? 0 : zahl(e.ist);
        var ml = massnahmenVon(e);
        var s = sollFuer(e, ctx);
        var zielQm = zahl(e.ziel_qm);
        var zielM = zielQm > 0 && wfl > 0 ? zielQm * wfl : 0;
        var kAlle = ml.reduce(function (a, m) { return a + zahl(m.k); }, 0);
        var kBew = ml.filter(function (m) { return m.bewohnt; }).reduce(function (a, m) { return a + zahl(m.k); }, 0);
        flSum += wfl;
        if (s.miete != null && s.miete > ist) out.hat_soll = true;
        if (zielM > 0 || ml.length) out.hat_ziel = true;
        return { i: i, nr: e.nr || String(i + 1), lage: e.lage || '', art: e.art || 'wohnen', wfl: wfl, zimmer: zahl(e.zimmer) || null,
          status: e.status || 'vermietet', ist: ist, soll: s, ziel: zielM || null, ziel_qm: zielQm || null, ziel_wann: e.ziel_wann || '',
          massnahmen: ml, kosten: kAlle, kosten_bewohnt: kBew, mea: zahl(e.mea_anteil) || null,
          plus_soll: Math.min(20, punkteGewinn(ml, e, geb, true)), plus_ziel: Math.min(20, punkteGewinn(ml, e, geb, false)),
          vgl_qm: s.vgl_qm || null };
      });
      out.wfl = flSum;
      out.aufgeteilt = opts.aufgeteilt != null ? !!opts.aufgeteilt : !!D.aufgeteilt;
      var nWohnen = out.wohnungen.filter(function (w) { return w.art !== 'gewerbe'; }).length;
      var ak = opts.aufteilungskosten != null ? opts.aufteilungskosten : D.aufteilungskosten;
      out.aufteilungskosten = (ak != null && String(ak).trim() !== '') ? zahl(ak) : nWohnen * AUFTEILUNG_JE_WE;
      out.aufteilungskosten_herkunft = (ak != null && String(ak).trim() !== '') ? 'eigene Angabe'
        : 'Vorbelegung ' + AUFTEILUNG_JE_WE.toLocaleString('de-DE') + ' € je Wohnung (Notar, Grundbuch, Teilungserklärung, Abgeschlossenheit) — bitte prüfen';
    } else {
      var wflO = zahl(wert('wfl')), istO = zahl(wert('nkm'));
      var eO = { ist: istO, wfl: wflO, status: istO > 0 ? 'vermietet' : 'leer',
        soll: zahl(wert('zb_soll_qm')) > 0 && wflO > 0 ? zahl(wert('zb_soll_qm')) * wflO : 0,
        soll_ab: wert('zb_soll_ab'), vgl_qm: 0, mv_letzte_erhoehung: wert('mv_letzte_erhoehung'),
        massnahmen: objektMassnahmen() };
      var sO = sollFuer(eO, ctx);
      var zQ = zahl(wert('zb_ziel_qm'));
      var mlO = eO.massnahmen;
      out.wfl = wflO;
      out.wohnungen = [{ i: 0, nr: '', lage: '', art: 'wohnen', wfl: wflO, status: eO.status, ist: istO, soll: sO,
        ziel: zQ > 0 && wflO > 0 ? zQ * wflO : null, ziel_qm: zQ || null, ziel_wann: wert('zb_ziel_wann'),
        massnahmen: mlO, kosten: mlO.reduce(function (a, m) { return a + zahl(m.k); }, 0),
        kosten_bewohnt: mlO.filter(function (m) { return m.bewohnt; }).reduce(function (a, m) { return a + zahl(m.k); }, 0),
        plus_soll: Math.min(20, punkteGewinn(mlO, null, null, true)), plus_ziel: Math.min(20, punkteGewinn(mlO, null, null, false)) }];
      if (sO.miete != null && sO.miete > istO) out.hat_soll = true;
      if (zQ > 0 || mlO.length) out.hat_ziel = true;
    }
    /* Summen je Stufe. Mieterhöhung: Mieter bleiben (Leerstand bleibt leer).
       Zielbild: Zielmiete, sonst Soll, sonst Ist. */
    var W = out.wohnungen, fl = out.wfl || 0;
    function gew(k) { return fl > 0 ? W.reduce(function (a, w) { return a + (w[k] || 0) * w.wfl; }, 0) / fl : 0; }
    var istS = W.reduce(function (a, w) { return a + w.ist; }, 0);
    var sollS = W.reduce(function (a, w) { return a + ((w.soll && w.soll.miete != null && w.soll.miete > w.ist) ? w.soll.miete : w.ist); }, 0);
    var zielS = W.reduce(function (a, w) { return a + (w.ziel != null ? w.ziel : ((w.soll && w.soll.miete > w.ist) ? w.soll.miete : w.ist)); }, 0);
    out.stufen = {
      bestand: { miete_m: istS, kosten: 0, plus: 0 },
      mieterhoehung: out.hat_soll ? { miete_m: sollS, kosten: W.reduce(function (a, w) { return a + w.kosten_bewohnt; }, 0),
        plus: Math.round(gew('plus_soll') * 10) / 10 } : null,
      zielbild: out.hat_ziel ? { miete_m: zielS, kosten: W.reduce(function (a, w) { return a + w.kosten; }, 0),
        plus: Math.round(gew('plus_ziel') * 10) / 10 } : null
    };
    out.aktiv = !!(out.hat_soll || out.hat_ziel);
    return out;
  }

  /* ── Abruf beim Marktbericht-Dienst ─────────────────────────────────── */
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); }
  function auftrag(m, opts) {
    var obj = (window.DealPilotMB && typeof window.DealPilotMB.inputs === 'function') ? window.DealPilotMB.inputs() : null;
    if (!obj) return null;
    if (opts && opts.einheiten) {
      obj._mfh_einheiten = opts.einheiten.map(function (e) {
        return { art: e.art || 'wohnen', wfl: e.wfl, ist: e.ist, soll: e.soll, status: e.status || 'vermietet',
                 nutzung_gew: e.nutzung_gew || null, markt_qm: e.markt_qm || null };
      });
    }
    var istW = function (w) { return w.art === 'gewerbe' ? 0 : 1; };
    var wohnMiete = function (k) {
      return m.wohnungen.reduce(function (a, w) {
        if (!istW(w)) return a;
        var x = k === 'bestand' ? w.ist : (k === 'mieterhoehung'
          ? ((w.soll && w.soll.miete > w.ist) ? w.soll.miete : w.ist)
          : (w.ziel != null ? w.ziel : ((w.soll && w.soll.miete > w.ist) ? w.soll.miete : w.ist)));
        return a + x;
      }, 0) * 12;
    };
    var varianten = [];
    ['mieterhoehung', 'zielbild'].forEach(function (k) {
      var s = m.stufen[k]; if (!s) return;
      varianten.push({ key: k, miete_wohnen_jahr: Math.round(wohnMiete(k)), mod_punkte_plus: s.plus, kosten: Math.round(s.kosten) });
    });
    var body = { object: obj, varianten: varianten };
    if (m.art === 'mfh') {
      body.wohnungen = m.wohnungen.map(function (w) {
        var sm = (w.soll && w.soll.miete > w.ist) ? w.soll.miete : w.ist;
        return { nr: w.nr, art: w.art, wfl: w.wfl, mea_pct: w.mea || null,
          miete_jahr: { bestand: Math.round(w.ist * 12), mieterhoehung: Math.round(sm * 12),
                        zielbild: Math.round((w.ziel != null ? w.ziel : sm) * 12) } };
      });
      body.aufteilung = { aktiv: !!m.aufgeteilt, kosten_eur: Math.round(m.aufteilungskosten || 0), kosten_herkunft: m.aufteilungskosten_herkunft };
    }
    return body;
  }
  var _lauf = null;
  /** Ertragswerte holen. Gibt das Ergebnis zurück; legt es mit seinem
      Prüfwert in `window._dpPotenzial` ab (reist mit dem Objekt). */
  function rechnen(opts) {
    opts = opts || {};
    return kappungLaden().then(function () { return agsHolen(); }).then(function () {
      var m = modell(opts);
      if (!m.aktiv) return null;
      var body = auftrag(m, opts);
      if (!body) return null;
      var h = hash(JSON.stringify(body));
      var alt = window._dpPotenzial;
      if (!opts.erzwingen && alt && alt.hash === h && alt.ergebnis && alt.ergebnis.verfuegbar) return alt.ergebnis;
      if (_lauf && _lauf.h === h) return _lauf.p;
      if (!window.Auth || typeof Auth.apiCall !== 'function') return null;
      var key = window._currentObjKey || null;
      var p = Auth.apiCall('/marktbericht/potenzial', { method: 'POST', body: body }).then(function (r) {
        _lauf = null;
        if (!r) return null;
        /* Gehört das Ergebnis noch zum offenen Objekt? Sonst verwerfen. */
        if ((window._currentObjKey || null) !== key) return r;
        window._dpPotenzial = { hash: h, stand: new Date().toISOString(), ags: r.ags || agsJetzt(), plz: wert('plz'),
          ergebnis: r, zusammenfassung: zusammenfassung(m, r) };
        try { window.dispatchEvent(new CustomEvent('dp:potenzial', { detail: { ergebnis: r } })); } catch (e) {}
        return r;
      }, function (e) { _lauf = null; return { verfuegbar: false, grund: (e && e.message) || 'Dienst nicht erreichbar' }; });
      _lauf = { h: h, p: p };
      return p;
    });
  }
  /** Das gespeicherte Ergebnis, wenn es zum heutigen Stand passt. */
  function ergebnis(opts) {
    var p = window._dpPotenzial;
    if (!p || !p.ergebnis) return null;
    try { var m = modell(opts); var b = auftrag(m, opts); if (b && hash(JSON.stringify(b)) === p.hash) return p.ergebnis; } catch (e) {}
    return null;
  }
  function ergebnisVeraltet() { var p = window._dpPotenzial; return !!(p && p.ergebnis) && !ergebnis(); }

  /** Ergebnis einer Wohnung (Originalindex in der Einheitenliste). Der Dienst
      fuehrt nur Wohnungen mit Flaeche, in derselben Reihenfolge. */
  function wohnungErgebnis(r, m, idx) {
    if (!r || !Array.isArray(r.wohnungen) || !m) return null;
    var mitFl = m.wohnungen.filter(function (w) { return w.wfl > 0; });
    for (var n = 0; n < mitFl.length; n++) if (mitFl[n].i === idx) return r.wohnungen[n] || null;
    return null;
  }

  /* ── Kennzahlen je Stufe (dieselben Kerne wie die Tafel Ist gegen Soll) ── */
  function kennzahlen(m) {
    var K = (window.State && window.State.kpis) || {};
    var ze = zahl(wert('ze'));
    var kp = K.kp || zahl(wert('kp'));
    var out = {};
    var istM = m.stufen.bestand.miete_m;
    /* Bestand = die Zahlen des Objekts selbst (calc.js), nicht nachgerechnet. */
    var basisNkm = zahl(wert('nkm')) || istM;
    ['bestand', 'mieterhoehung', 'zielbild'].forEach(function (k) {
      var s = m.stufen[k]; if (!s) return;
      /* Stufe = Miete des Objekts plus der Zuwachs aus den Wohnungen - so
         stehen alle Spalten auf derselben Basis, auch wenn das Feld
         Nettokaltmiete von der Summe der Wohnungen abweicht. */
      var nkm = k === 'bestand' ? basisNkm : basisNkm + (s.miete_m - istM);
      var bmy = (window.DealKpis && kp > 0) ? window.DealKpis.compute({ kp: kp + (s.kosten || 0), nkm: nkm, ze: ze }).bmy : null;
      var dscr = k === 'bestand' ? (K.dscr != null ? K.dscr : null)
        : ((window.Dscr && window.Dscr.compute) ? window.Dscr.compute({ nkm_j: nkm * 12, ze_j: ze * 12, zins_j: K.zins_j, tilg_j: K.tilg_j,
            bsv_j: K.d1IsAussetzung ? (K.bspar_j || 0) : 0, bwk_cf: K.bwk_cf }).brutto : null);
      if (dscr === 0 && !(K.zins_j > 0 || K.tilg_j > 0)) dscr = null;   /* v2430a: ohne Darlehen kein DSCR (die Kerne liefern 0) */
      var cfB = K.cf_op != null ? K.cf_op / 12 : null;
      out[k] = { miete_j: nkm * 12, miete_qm: m.wfl > 0 ? nkm / m.wfl : null, bmy: bmy, dscr: dscr,
        cf_m: cfB == null ? null : cfB + (nkm - basisNkm), kosten: s.kosten || 0, plus: s.plus || 0 };
    });
    return out;
  }
  function ankaufKurz() {
    var AK = window.DealPilotAnkauf, st = null;
    try { st = AK && AK.stand ? AK.stand() : null; } catch (e) {}
    var k = st && st.kurz ? st.kurz : null;
    if (!k) return null;
    var nkm = zahl(k.nkm);
    return { stichtag: st.stichtag || null, miete_j: nkm ? nkm * 12 : null, miete_qm: zahl(k._nkm_qm) || null,
      bmy: k._kpis_bmy != null ? Number(k._kpis_bmy) : null, dscr: k._kpis_dscr != null ? Number(k._kpis_dscr) : null,
      cf_m: k._kpis_cf_vs != null ? Number(k._kpis_cf_vs) / 12 : null };
  }

  /* Für Prompt, Portfolio-Pilot und PDF: das Wesentliche in einem Satz Zahlen. */
  function zusammenfassung(m, r) {
    var kz = kennzahlen(m), h = (r && r.haus) || {};
    var z = { stand: new Date().toISOString().slice(0, 10), art: m.art, kennzeichnung: KENNZEICHNUNG,
      kappung: { pct: m.kappung.pct, text: m.kappung.text }, stufen: {} };
    ['bestand', 'mieterhoehung', 'zielbild'].forEach(function (k) {
      if (!m.stufen[k]) return;
      z.stufen[k] = { kaltmiete_monat: Math.round(m.stufen[k].miete_m), kaltmiete_jahr: Math.round(m.stufen[k].miete_m * 12),
        kosten: Math.round(m.stufen[k].kosten || 0), punkte_plus: m.stufen[k].plus || 0,
        bmy: kz[k] && kz[k].bmy != null ? Math.round(kz[k].bmy * 100) / 100 : null,
        dscr: kz[k] && kz[k].dscr != null ? Math.round(kz[k].dscr * 100) / 100 : null,
        ertragswert: h[k] ? h[k].wert : null, rnd: h[k] ? h[k].rnd : null };
    });
    if (r && r.aufteilung && r.aufteilung.je_stufe) {
      z.aufteilung = { kosten: r.aufteilung.kosten_eur, je_stufe: r.aufteilung.je_stufe,
        zins_etw: r.aufteilung.zins && r.aufteilung.zins.bestand ? r.aufteilung.zins.bestand.pct : null };
    }
    z.wohnungen = m.wohnungen.slice(0, 30).map(function (w) {
      return { nr: w.nr, lage: w.lage, wfl: w.wfl, status: w.status, ist: Math.round(w.ist),
        soll: w.soll && w.soll.miete != null ? Math.round(w.soll.miete) : null, soll_ab: w.soll ? w.soll.ab_text || null : null,
        soll_herkunft: w.soll ? w.soll.herkunft : null, ziel: w.ziel != null ? Math.round(w.ziel) : null, ziel_wann: w.ziel_wann || null,
        massnahmen: w.massnahmen.map(function (x) { return x.t + (zahl(x.k) ? ' ' + Math.round(zahl(x.k)) + ' €' : '') + (x.bewohnt ? ' (bewohnt, § 559)' : ''); }).join(', ') || null,
        kosten: Math.round(w.kosten) || 0 };
    });
    return z;
  }
  function pilotPayload() {
    var m = modell(); if (!m.aktiv) return null;
    var r = ergebnis();
    var z = zusammenfassung(m, r);
    z.ertragswert_gerechnet = !!(r && r.verfuegbar);
    if (r && r.basis) z.zins = { pct: r.basis.lzs_pct, stufe: r.basis.lzs_stufe };
    return z;
  }

  /* ── Darstellung: die Tafel „Ankauf · Bestand · Zielbild" ───────────── */
  function stilEinhaengen() {
    if (el('dp-pot-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-pot-stil';
    s.textContent = [
      '.dp-pot{font:400 13px/1.5 Inter,system-ui,sans-serif;color:#1d1a14}',
      '.dp-pot .dp-pot-leg{display:flex;flex-wrap:wrap;gap:12px;font:500 11px "JetBrains Mono",monospace;color:#6c6450;margin:0 0 8px}',
      '.dp-pot .dp-pot-leg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}',
      '.dp-pot table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}',
      '.dp-pot th,.dp-pot td{padding:6px 8px;text-align:right;border-bottom:1px solid #E6DCC2;white-space:nowrap}',
      '.dp-pot th:first-child,.dp-pot td:first-child{text-align:left;white-space:normal}',
      '.dp-pot thead th{font:500 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6c6450}',
      '.dp-pot .c-soll{color:#3d6fa8}.dp-pot .c-ziel{color:#2f7d55}',
      '.dp-pot td.c-soll,.dp-pot td.c-ziel{font-weight:600}',
      '.dp-pot .dp-pot-scroll{overflow-x:auto}',
      '.dp-pot .dp-pot-hin{font-size:11.5px;color:#6c6450;margin:8px 0 0}',
      '.dp-pot .dp-pot-kz{font:500 11px "JetBrains Mono",monospace;color:#2f7d55;border:1px solid #2f7d55;border-radius:999px;padding:1px 8px;margin-left:8px;white-space:nowrap}',
      '.dp-pot .dp-pot-knopf{border:1px solid var(--wl-c9a84c, #C9A84C);background:#fff;color:#1d1a14;border-radius:8px;padding:6px 12px;font:600 12px Inter,sans-serif;cursor:pointer}',
      '.dp-pot .dp-pot-knopf:focus-visible{outline:2px solid var(--wl-c9a84c, #C9A84C);outline-offset:2px}',
      '.dp-pot tr.dp-pot-sum td{font-weight:700;border-top:2px solid #E6DCC2}'
    ].join('');
    document.head.appendChild(s);
  }
  var LEG = '<div class="dp-pot-leg"><span><i style="background:#8a8272"></i>Ist / Bestand</span><span><i style="background:#3d6fa8"></i>Mieterhöhung · Mieter bleibt</span><span><i style="background:#2f7d55"></i>Zielbild · nach Umbau</span></div>';
  function tafelHtml(o) {
    o = o || {};
    stilEinhaengen();
    var m = modell(); if (!m.aktiv) return '';
    var r = ergebnis();
    var kz = kennzahlen(m), A = o.ohneAnkauf ? null : ankaufKurz();
    var cols = [];
    if (A) cols.push({ k: 'ankauf', t: 'Ankauf', c: '' });
    cols.push({ k: 'bestand', t: 'Bestand', c: '' });
    if (m.stufen.mieterhoehung) cols.push({ k: 'mieterhoehung', t: 'Mieterhöhung', c: 'c-soll' });
    if (m.stufen.zielbild) cols.push({ k: 'zielbild', t: 'Zielbild', c: 'c-ziel' });
    var H = (r && r.verfuegbar && r.haus) || {};
    function v(k, f) { if (k === 'ankauf') return f(A, 'ankauf'); return f(kz[k], k); }
    var rows = [
      ['Kaltmiete p. a.', function (x) { return x ? eur(x.miete_j) : '—'; }],
      ['Kaltmiete €/m² (Ø)', function (x) { return x && x.miete_qm ? eur2(x.miete_qm) : '—'; }],
      ['Bruttomietrendite (auf Kaufpreis + Maßnahmen)', function (x) { return x && x.bmy != null ? pct(x.bmy) : '—'; }],
      ['Cashflow / Monat (vor Steuer)', function (x) { return x && x.cf_m != null ? eur(x.cf_m) : '—'; }],
      ['DSCR', function (x) { return x && x.dscr != null ? dez(x.dscr, 2) : '—'; }],
      ['Maßnahmenkosten', function (x, k) { return k === 'ankauf' || !x ? '—' : (x.kosten ? eur(x.kosten) : '—'); }],
      ['Modernisierungspunkte (Anlage 2)', function (x, k) { var h = H[k]; return h && h.mod_punkte != null ? dez(h.mod_punkte, 1).replace(',0', '') + (x && x.plus ? ' (+' + dez(x.plus, 1).replace(',0', '') + ')' : '') : (x && x.plus ? '+' + dez(x.plus, 1).replace(',0', '') : '—'); }],
      ['Restnutzungsdauer', function (x, k) { var h = H[k]; return h && h.rnd != null ? dez(h.rnd, 0) + ' J.' : '—'; }],
      ['Ertragswert', function (x, k) { var h = H[k]; return h && h.wert != null ? '<b>' + eur(h.wert) + '</b>' : '—'; }]
    ];
    var html = '<div class="dp-pot">' + LEG + '<div class="dp-pot-scroll"><table><thead><tr><th>Kennzahl</th>'
      + cols.map(function (c) { return '<th class="' + c.c + '">' + c.t + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.map(function (row) {
          return '<tr><td>' + row[0] + '</td>' + cols.map(function (c) { return '<td class="' + c.c + '">' + v(c.k, row[1]) + '</td>'; }).join('') + '</tr>';
        }).join('');
    if (H.bestand && H.bestand.wert != null && (H.zielbild || H.mieterhoehung)) {
      var top = H.zielbild || H.mieterhoehung, ks = (m.stufen.zielbild || m.stufen.mieterhoehung).kosten || 0;
      html += '<tr class="dp-pot-sum"><td>Wertzuwachs nach Kosten</td>' + cols.map(function (c) {
        if (c.k === 'ankauf' || c.k === 'bestand') return '<td></td>';
        var h = H[c.k], kk = m.stufen[c.k].kosten || 0;
        return '<td class="' + c.c + '">' + (h && h.wert != null ? (h.wert - H.bestand.wert - kk >= 0 ? '+' : '') + eur(h.wert - H.bestand.wert - kk) : '—') + '</td>';
      }).join('') + '</tr>';
      void top; void ks;
    }
    html += '</tbody></table></div>';
    if (r && r.verfuegbar && r.aufteilung && r.aufteilung.je_stufe && r.aufteilung.je_stufe.bestand) html += aufteilungHtml(m, r, cols);
    html += '<p class="dp-pot-hin">' + KENNZEICHNUNG + ' Score und Verkehrswert rechnen mit dem Bestand. '
      + (r && r.verfuegbar && r.basis ? 'Liegenschaftszins ' + pct(r.basis.lzs_pct) + (r.basis.lzs_stufe ? ' (Stufe ' + esc(r.basis.lzs_stufe) + ')' : '')
          + ', Bewirtschaftung, Gesamtnutzungsdauer und Bodenwert wie im Marktbericht Stufe 3; je Stufe wechseln Miete und Restnutzungsdauer (Anlage 2 ImmoWertV). ' : '')
      + 'Cashflow und DSCR bei gleicher Finanzierung und gleichen Kosten. ' + esc(m.kappung.text) + '</p>';
    if (!r || !r.verfuegbar) {
      var grund = window._dpPotenzial && window._dpPotenzial.ergebnis && !window._dpPotenzial.ergebnis.verfuegbar ? window._dpPotenzial.ergebnis.grund : '';
      html += '<p class="dp-pot-hin">' + (ergebnisVeraltet() ? 'Die Angaben haben sich geändert — die Ertragswerte sind neu zu rechnen. ' : (grund ? esc(grund) + ' ' : ''))
        + '<button type="button" class="dp-pot-knopf" data-dp-pot-rechnen="1">Ertragswerte rechnen</button></p>';
    }
    return html + '</div>';
  }
  function aufteilungHtml(m, r, cols) {
    var a = r.aufteilung, H = r.haus;
    var sc = cols.filter(function (c) { return c.k !== 'ankauf'; });
    var z = function (t, f) { return '<tr><td>' + t + '</td>' + sc.map(function (c) { return '<td class="' + c.c + '">' + f(c.k) + '</td>'; }).join('') + '</tr>'; };
    var n = m.wohnungen.filter(function (w) { return w.art !== 'gewerbe'; }).length;
    var zi = a.zins && a.zins.bestand && a.zins.bestand.pct != null ? pct(a.zins.bestand.pct) : '—';
    return '<div class="dp-pot-scroll" style="margin-top:12px"><table><thead><tr><th>Aufteilung</th>' + sc.map(function (c) { return '<th class="' + c.c + '">' + c.t + '</th>'; }).join('') + '</tr></thead><tbody>'
      + z('Haus als Ganzes', function (k) { return H[k] ? eur(H[k].wert) : '—'; })
      + z(n + ' Eigentumswohnungen (Summe, Zins ' + zi + ')', function (k) { var s = a.je_stufe[k]; return s ? eur(s.summe) + (s.vollstaendig ? '' : '*') : '—'; })
      + z('− Kosten der Aufteilung', function () { return eur(-a.kosten_eur); })
      + '<tr class="dp-pot-sum"><td>Aufteilungspotenzial</td>' + sc.map(function (c) { var s = a.je_stufe[c.k]; return '<td class="' + c.c + '">' + (s ? (s.potenzial >= 0 ? '+' : '') + eur(s.potenzial) : '—') + '</td>'; }).join('') + '</tr>'
      + '</tbody></table></div><p class="dp-pot-hin">' + esc(a.hinweis || '') + ' Kosten der Aufteilung: ' + esc(m.aufteilungskosten_herkunft || a.kosten_herkunft || '') + '.</p>';
  }

  /* ── Daten für beide PDFs (Bank und Investment) ─────────────────────── */
  function pdfDaten() {
    var m = modell(); if (!m.aktiv) return null;
    var r = ergebnis();
    var kz = kennzahlen(m), H = (r && r.verfuegbar && r.haus) || {};
    var S = m.stufen;
    var d = { kennzeichnung: KENNZEICHNUNG, art: m.art, kappung: m.kappung.text,
      spalten: ['bestand'].concat(S.mieterhoehung ? ['mieterhoehung'] : []).concat(S.zielbild ? ['zielbild'] : []),
      titel: { bestand: 'Bestand', mieterhoehung: 'Mieterhöhung', zielbild: 'Zielbild' } };
    var mehr1 = S.mieterhoehung ? (S.mieterhoehung.miete_m - S.bestand.miete_m) * 12 : 0;
    var mehr2 = S.zielbild ? (S.zielbild.miete_m - (S.mieterhoehung ? S.mieterhoehung.miete_m : S.bestand.miete_m)) * 12 : 0;
    var abs = m.wohnungen.map(function (w) { return w.soll && w.soll.ab && w.soll.miete > w.ist ? w.soll.ab : null; }).filter(Boolean).sort();
    d.satz_bank = (S.mieterhoehung ? 'Ohne Mieterwechsel ist ' + (abs.length ? 'ab ' + monatText(abs[0]) + ' ' : '') + 'ein Mehrertrag von ' + eur(mehr1) + ' p. a. erreichbar' : 'Eine Mieterhöhung im Bestand ist nicht angesetzt')
      + (S.zielbild ? (S.mieterhoehung ? ', mit den geplanten Maßnahmen weitere ' : '; mit den geplanten Maßnahmen ') + eur(mehr2) + ' p. a.' : '.')
      + (S.zielbild && S.zielbild.kosten ? ' Maßnahmenkosten ' + eur(S.zielbild.kosten) + '.' : '');
    d.satz_invest = 'Drei Stufen der Mietentwicklung mit Ertragswert je Stufe' + (r && r.aufteilung ? ' und der Wirkung einer Aufteilung in Eigentumswohnungen.' : '.');
    d.wohnungen = m.wohnungen.map(function (w) {
      return { we: (w.nr ? w.nr + ' ' : '') + (w.lage || ''), wfl: w.wfl, ist: w.ist > 0 ? eur(w.ist) : (w.status === 'leer' ? 'leer' : '—'),
        soll: w.soll && w.soll.miete > w.ist ? eur(w.soll.miete) + (w.soll.ab ? ' · ' + (w.soll.ab <= heuteYm() ? 'sofort' : monatText(w.soll.ab)) : '') : '—',   /* v2430a: kurz - lange Termintexte liefen im PDF in die Nachbarspalten */
        ziel: w.ziel != null ? eur(w.ziel) : '—',
        massnahmen: w.massnahmen.map(function (x) { return x.t; }).join(', ') || '—' };
    });
    d.kennzahlen = [
      ['Kaltmiete p. a.', function (k) { return eur(kz[k].miete_j); }],
      ['Bruttomietrendite', function (k) { return kz[k].bmy != null ? pct(kz[k].bmy) : '—'; }],
      ['DSCR', function (k) { return kz[k].dscr != null ? dez(kz[k].dscr, 2) : '—'; }],
      ['Maßnahmenkosten', function (k) { return kz[k].kosten ? eur(kz[k].kosten) : '—'; }],
      ['Restnutzungsdauer', function (k) { return H[k] && H[k].rnd != null ? dez(H[k].rnd, 0) + ' J.' : '—'; }],
      [m.art === 'mfh' ? 'Ertragswert (Haus als Ganzes)' : 'Ertragswert', function (k) { return H[k] && H[k].wert != null ? eur(H[k].wert) : '—'; }]
    ].map(function (z) { return [z[0]].concat(d.spalten.map(z[1])); });
    if (r && r.verfuegbar && r.aufteilung && r.aufteilung.je_stufe && r.aufteilung.je_stufe.bestand) {
      var n = m.wohnungen.filter(function (w) { return w.art !== 'gewerbe'; }).length;
      d.kennzahlen.push(['nach Aufteilung (' + n + ' ETW, abzgl. ' + eur(r.aufteilung.kosten_eur) + ')'].concat(d.spalten.map(function (k) {
        var s = r.aufteilung.je_stufe[k]; return s ? eur(s.summe - r.aufteilung.kosten_eur) : '—'; })));
    }
    d.fuss = KENNZEICHNUNG + ' Verkehrswert nach ImmoWertV und Score rechnen mit dem Bestand.'
      + (r && r.verfuegbar && r.basis ? ' Liegenschaftszins ' + pct(r.basis.lzs_pct) + ' (Haus)'
        + (r.aufteilung && r.aufteilung.zins && r.aufteilung.zins.bestand && r.aufteilung.zins.bestand.pct != null ? ' bzw. ' + pct(r.aufteilung.zins.bestand.pct) + ' (Wohnungseigentum)' : '')
        + ', Restnutzungsdauer nach Modernisierungspunkten (Anlage 2 ImmoWertV).' : ' Ertragswerte nicht gerechnet.')
      + ' ' + m.kappung.text;
    d.gerechnet = !!(r && r.verfuegbar);
    return d;
  }

  /* ── Mietentwicklung: Soll je Wohnung und ihr Startjahr ─────────────── */
  function sollFuerMietentwicklung(e, basisJahr) {
    if (!e || e.status === 'leer') return null;
    var vg = objektVgl();
    var s = sollFuer(e, { kapp: kappung(agsJetzt()), vgl_qm: vg.qm });
    if (s.miete == null || !(s.miete > zahl(e.ist))) return null;
    var idx = null;
    var D = window._dpMfh || {};
    var jEig = /^\d{4}-\d{2}/.test(e.soll_ab || '') ? +String(e.soll_ab).slice(0, 4) : null;
    var jFrist = s.ab ? +s.ab.slice(0, 4) : null;
    var jObj = Math.round(Number(D.sollAbJahr) || 0);
    var by = basisJahr || new Date().getFullYear();
    if (jEig) idx = jEig - by;
    else if (jObj > 0) { var jo = jObj >= 1900 ? jObj : by + jObj; idx = Math.max(jo, jFrist || 0) - by; }
    else if (jFrist && e.mv_letzte_erhoehung) idx = jFrist - by;
    if (idx == null) return { miete: s.miete, jahrIndex: null };
    return { miete: s.miete, jahrIndex: Math.max(1, idx) };
  }

  /* ── Tab Objekt: „Mieterhöhung und Zielbild (optional)" ──────────────── */
  function chipsHtml(liste, mitPunkte, e, geb, fuerEinheit) {
    return '<div class="dp-zb-chips">' + MASSNAHMEN.filter(function (k) { return fuerEinheit ? k.einheit : true; }).map(function (k) {
      var m = (liste || []).filter(function (x) { return x.id === k.id; })[0];
      var p = k.gewerk ? Math.max(0, maxP(k.gewerk) - punkteJetzt(k.gewerk, e, geb)) : 0;
      return '<button type="button" class="dp-zb-chip' + (m ? ' on' : '') + '" data-zb-chip="' + k.id + '" aria-pressed="' + (m ? 'true' : 'false') + '"'
        + ' title="' + esc(k.gewerk ? (p ? '+' + p + ' Modernisierungspunkte (Anlage 2)' : 'Gewerk schon voll modernisiert — keine weiteren Punkte') : (k.hinweis || 'ohne Modernisierungspunkte')) + '">'
        + esc(k.t) + (mitPunkte && k.gewerk && p ? ' <em>+' + p + ' P.</em>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function massnahmenZeilen(liste) {
    return (liste || []).map(function (m, i) {
      return '<div class="dp-zb-mz" data-zb-i="' + i + '"><span class="dp-zb-mt">' + esc(m.t) + '</span>'
        + '<label><span>Kosten €</span><input data-zb-k="' + i + '" inputmode="decimal" value="' + esc(m.k ? String(Math.round(zahl(m.k))) : '') + '" placeholder="0"></label>'
        + '<label class="dp-zb-bew" title="Modernisierung im bewohnten Zustand: Umlage 8 % der Kosten im Jahr (§ 559 BGB), gedeckelt 3 €/m² (2 €/m² unter 7 €/m²) in 6 Jahren — zählt zur Soll-Miete"><input type="checkbox" data-zb-b="' + i + '"' + (m.bewohnt ? ' checked' : '') + '> bewohnt (§ 559)</label>'
        + (m.id === 'sonst' ? '<label><span>Bezeichnung</span><input data-zb-t="' + i + '" value="' + esc(m.t) + '"></label>' : '')
        + '</div>';
    }).join('');
  }
  function chipStil() {
    if (el('dp-zb-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-zb-stil';
    s.textContent = [
      '.dp-zb-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}',
      '.dp-zb-chip{font:500 12px Inter,sans-serif;border:1px solid #E6DCC2;border-radius:999px;padding:4px 10px;background:#fff;color:#2A2727;cursor:pointer}',
      '.dp-zb-chip em{font-style:normal;color:#6c6450;margin-left:2px}',
      /* v2430b: style.css faerbt Knoepfe in Karten golden (gemessen: Rahmen Gold 30 %, Grund weiss) -
         der gewaehlte Chip war vom freien nicht zu unterscheiden. Darum mit Anker und !important. */
      '#zb-karte .dp-zb-chip.on,#mfh-we-ov .dp-zb-chip.on,.dp-zb-chip.on{border-color:#2f7d55 !important;color:#2f7d55 !important;background:color-mix(in srgb,#2f7d55 9%,#fff) !important;font-weight:600 !important}',
      '.dp-zb-chip:focus-visible{outline:2px solid var(--wl-c9a84c, #C9A84C);outline-offset:2px}',
      '.dp-zb-mz{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:flex-end;padding:6px 0;border-bottom:1px dashed #E6DCC2;font-size:12.5px}',
      '.dp-zb-mz .dp-zb-mt{font-weight:600;min-width:110px}',
      '.dp-zb-mz label{display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:#6B6356}',
      '.dp-zb-mz label.dp-zb-bew{flex-direction:row;align-items:center;gap:6px;color:#2A2727}',
      '.dp-zb-mz input:not([type=checkbox]){width:110px;border:1px solid #E6E0D3;border-radius:8px;padding:5px 8px;font:13px Inter,sans-serif}',
      '.dp-zb-sum{font-size:12.5px;color:#6B6356;margin-top:8px}',
      '.dp-zb-sum b.c-soll{color:#3d6fa8}.dp-zb-sum b.c-ziel{color:#2f7d55}'
    ].join('');
    document.head.appendChild(s);
  }
  /** Chips und Kostenzeilen an einen Wirt binden. liste: Array (wird verändert). */
  function massnahmenBinden(host, liste, opts) {
    opts = opts || {};
    chipStil();
    function zeichne() {
      host.innerHTML = chipsHtml(liste, true, opts.e || null, opts.geb || null, !!opts.fuerEinheit)
        + '<div class="dp-zb-mliste">' + massnahmenZeilen(liste) + '</div>';
      host.querySelectorAll('[data-zb-chip]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-zb-chip'), k = katalog(id);
          var i = -1; liste.forEach(function (m, n) { if (m.id === id) i = n; });
          if (i >= 0) liste.splice(i, 1); else liste.push({ id: id, t: k ? k.t : id, k: 0, bewohnt: false });
          zeichne(); if (opts.geaendert) opts.geaendert();
        };
      });
      host.querySelectorAll('[data-zb-k]').forEach(function (inp) {
        inp.oninput = function () { liste[+inp.getAttribute('data-zb-k')].k = zahl(inp.value); if (opts.geaendert) opts.geaendert(true); };
      });
      host.querySelectorAll('[data-zb-b]').forEach(function (cb) {
        cb.onchange = function () { liste[+cb.getAttribute('data-zb-b')].bewohnt = !!cb.checked; if (opts.geaendert) opts.geaendert(true); };
      });
      host.querySelectorAll('[data-zb-t]').forEach(function (inp) {
        inp.oninput = function () { liste[+inp.getAttribute('data-zb-t')].t = inp.value || 'Sonstiges'; if (opts.geaendert) opts.geaendert(true); };
      });
    }
    zeichne();
    return zeichne;
  }

  var _objListe = null;
  function objektKarte() {
    var karte = el('zb-karte'); if (!karte) return;
    /* v2430b · die Gemeinde gleich holen (Leseroute, kein Kontingent) - sonst
       stand bis zum ersten Rechnen „20 %, Gemeinde noch nicht ermittelt". */
    if (!agsJetzt() && wert('plz')) agsHolen().then(function (a) { if (a) { try { objektSumme(); } catch (e) {} } });
    var mfh = artMitEinheiten() && window._dpMfh && Array.isArray(window._dpMfh.einheiten) && window._dpMfh.einheiten.length;
    var sumHost = el('zb-mfh-summe'), einzel = el('zb-einzel');
    if (mfh) {
      if (einzel) einzel.style.display = 'none';
      if (sumHost) {
        var m = modell();
        sumHost.style.display = '';
        sumHost.innerHTML = '<p class="sec-desc" style="margin:0 0 8px">Beim Mehrfamilienhaus stehen Soll-Miete und Zielbild je Wohnung — hier nur die Summe <b>aus den Wohnungen</b>. Ändern im Fenster „Einheiten erfassen" (Wohnung anklicken).</p>'
          + '<div class="dp-zb-sum">Ist <b>' + eur(m.stufen.bestand.miete_m) + '</b>/Monat'
          + (m.stufen.mieterhoehung ? ' · Mieterhöhung <b class="c-soll">' + eur(m.stufen.mieterhoehung.miete_m) + '</b>/Monat' : '')
          + (m.stufen.zielbild ? ' · Zielbild <b class="c-ziel">' + eur(m.stufen.zielbild.miete_m) + '</b>/Monat · Maßnahmen ' + eur(m.stufen.zielbild.kosten) : '')
          + (m.aktiv ? '' : ' · noch keine Soll-Miete oder kein Zielbild eingetragen') + '</div>';
      }
      return;
    }
    if (sumHost) sumHost.style.display = 'none';
    if (einzel) einzel.style.display = '';
    var host = el('zb-massnahmen-host'), fld = el('zb_massnahmen');
    if (!host || !fld) return;
    _objListe = objektMassnahmen();
    massnahmenBinden(host, _objListe, { geaendert: function () {
      fld.value = _objListe.length ? JSON.stringify(_objListe) : '';
      objektSumme();
    } });
    objektSumme();
  }
  function objektSumme() {
    var host = el('zb-summe'); if (!host) return;
    var m = modell(), w = m.wohnungen[0] || {};
    var s = w.soll || {};
    var vor = el('zb-soll-vorschlag');
    if (vor) vor.innerHTML = s.herkunft && s.herkunft !== 'eigene Angabe' && s.miete
      ? 'DealPilot rechnet vor: <b>' + eur2(s.miete / (m.wfl || 1)) + '/m²</b> (' + esc(s.grenze || s.herkunft) + ')' + (s.ab_text ? ', erreichbar ' + esc(s.ab_text) : '') + '. Eigene Angabe überschreibt.'
      : (s.grund && s.grund !== 'leer' ? esc(s.grund) : (s.hinweise && s.hinweise.length ? 'Hinweis: ' + esc(s.hinweise.join(', ')) : ''));
    host.innerHTML = !m.aktiv ? 'Ohne Angaben bleibt alles beim Bestand.'
      : 'Ist <b>' + eur(m.stufen.bestand.miete_m) + '</b>/Monat'
        + (m.stufen.mieterhoehung ? ' · Mieterhöhung <b class="c-soll">' + eur(m.stufen.mieterhoehung.miete_m) + '</b>/Monat' : '')
        + (m.stufen.zielbild ? ' · Zielbild <b class="c-ziel">' + eur(m.stufen.zielbild.miete_m) + '</b>/Monat' + (m.stufen.zielbild.kosten ? ' · Maßnahmen ' + eur(m.stufen.zielbild.kosten) : '') + (m.stufen.zielbild.plus ? ' · +' + dez(m.stufen.zielbild.plus, 1).replace(',0', '') + ' Modernisierungspunkte' : '') : '')
        + '<br>' + esc(m.kappung.text) + ' Die Ertragswerte stehen in der Pilot-Analyse (Reiter „Ankauf · Bestand · Zielbild") und in beiden PDFs.';
  }
  function bindeObjektFelder() {
    ['zb_soll_qm', 'zb_ziel_qm', 'zb_soll_ab', 'zb_vgl_qm', 'zb_ziel_wann', 'nkm', 'wfl', 'ds2_marktmiete', 'me_soll', 'mv_letzte_erhoehung'].forEach(function (id) {
      var e = el(id); if (!e || e._dpZb) return; e._dpZb = true;
      e.addEventListener('input', function () { objektSumme(); });
      e.addEventListener('change', function () { objektSumme(); });
    });
  }
  function start() {
    kappungLaden().then(function () { objektKarte(); });
    bindeObjektFelder();
    objektKarte();
    var a = el('objart'); if (a && !a._dpZb) { a._dpZb = true; a.addEventListener('change', objektKarte); }
    /* me_modus ist ein verstecktes Feld: setzt es die Übernahme aus Sprache
       oder Import, folgt der Modus (Knöpfe, Rechnung) hier. */
    var mm = el('me_modus');
    if (mm && !mm._dpZb) {
      mm._dpZb = true;
      var folgen = function () { var ME = window.MietEntwicklung; if (ME && ME.setMode && ME.getMode && mm.value && ME.getMode() !== mm.value) ME.setMode(mm.value); };
      mm.addEventListener('input', folgen); mm.addEventListener('change', folgen);
    }
    /* Der Knopf „Ertragswerte rechnen" steht in fremden Ansichten (Pilot-
       Analyse) — ein delegierter Behandler erreicht jede. */
    document.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-dp-pot-rechnen]') : null;
      if (!b) return;
      b.disabled = true; b.textContent = 'wird gerechnet …';
      rechnen({ erzwingen: true }).then(function (r) {
        var host = b.closest('[data-dp-pot-wirt]');
        if (host) host.innerHTML = tafelHtml();
        else { b.disabled = false; b.textContent = (r && r.verfuegbar) ? 'gerechnet — Ansicht neu öffnen' : 'nicht verfügbar'; }
        if (r && !r.verfuegbar && typeof window.toast === 'function') window.toast('Ertragswert: ' + (r.grund || 'nicht verfügbar'));
      });
    });
  }
  window.addEventListener('dp:object-ready', function () { setTimeout(objektKarte, 300); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ── Sprache / geführte Eingabe: Wohnungen aus einer Antwort ───────────
     voice-import.js fragt beim MFH freiwillig je Wohnung nach Fläche, Ist,
     Soll-Miete, Zielmiete und letzter Erhöhung (Katalogfeld `mfh_wohnungen`,
     Format „Nr | Lage | m² | Ist €/Monat | Soll €/Monat | Ziel €/m² |
     letzte Erhöhung", eine Zeile je Wohnung; JSON geht auch). Hier wird
     daraus `_dpMfh.einheiten` — bestehende Wohnungen (gleiche Nummer oder
     Lage) werden ergänzt, nie geleert. */
  var MONATE = { jan: 1, feb: 2, 'mär': 3, mar: 3, mrz: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
  function datumAus(t) {
    t = String(t || '').trim().toLowerCase(); if (!t) return '';
    var m = /(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(t);
    if (m) return m[1] + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+(m[3] || 1)).padStart(2, '0');
    m = /(?:(\d{1,2})\.)?(\d{1,2})[.\/](\d{4})/.exec(t);
    if (m) return m[3] + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+(m[1] || 1)).padStart(2, '0');
    m = /([a-zäöü]{3})[a-zäöü]*\.?\s*(\d{4})/.exec(t);
    if (m && MONATE[m[1]]) return m[2] + '-' + String(MONATE[m[1]]).padStart(2, '0') + '-01';
    m = /(\d{4})/.exec(t); if (m) return m[1] + '-01-01';
    return '';
  }
  function wohnungenAusText(roh) {
    var zeilen = [];
    try { var j = typeof roh === 'string' ? JSON.parse(roh) : roh; if (Array.isArray(j)) zeilen = j; } catch (e) { zeilen = []; }
    if (!zeilen.length) {
      zeilen = String(roh || '').split(/\n|;/).map(function (z) { return z.trim(); }).filter(Boolean).map(function (z) {
        var t = z.split('|').map(function (x) { return x.trim(); });
        return { nr: t[0], lage: t[1], wfl: t[2], ist: t[3], soll: t[4], ziel_qm: t[5], letzte: t[6] };
      });
    }
    var D = window._dpMfh && Array.isArray(window._dpMfh.einheiten) ? window._dpMfh : { einheiten: [], gebaeude: {} };
    var n = 0;
    zeilen.forEach(function (w) {
      if (!w) return;
      var nr = String(w.nr || '').replace(/^(we|wohnung|nr\.?)\s*/i, '').trim(), lage = String(w.lage || '').trim();
      var zz = function (v) { var x = zahl(String(v == null ? '' : v).replace(/[^\d,.\-]/g, '')); return x > 0 ? x : 0; };
      if (!nr && !lage && !zz(w.wfl) && !zz(w.ist)) return;
      var e = D.einheiten.filter(function (x) { return (nr && String(x.nr || '') === nr) || (lage && String(x.lage || '').toLowerCase() === lage.toLowerCase()); })[0];
      if (!e) { e = { nr: nr || String(D.einheiten.length + 1), lage: lage, art: 'wohnen', status: 'vermietet' }; D.einheiten.push(e); }
      if (lage && !e.lage) e.lage = lage;
      if (zz(w.wfl)) e.wfl = String(zz(w.wfl)).replace('.', ',');
      if (zz(w.ist)) { e.ist = String(Math.round(zz(w.ist))); e.status = 'vermietet'; }
      else if (/leer/i.test(String(w.ist || ''))) e.status = 'leer';
      if (zz(w.soll)) e.soll = String(Math.round(zz(w.soll)));
      if (zz(w.ziel_qm)) e.ziel_qm = String(zz(w.ziel_qm)).replace('.', ',');
      var dt = datumAus(w.letzte || w.letzte_erhoehung || w.mv_letzte_erhoehung);
      if (dt) e.mv_letzte_erhoehung = dt;
      n++;
    });
    if (n) {
      window._dpMfh = D;
      try { if (M().knopf) M().knopf(); } catch (e) {}
      try { objektKarte(); } catch (e) {}
    }
    return n;
  }

  window.DpPotenzial = {
    wohnungenAusText: wohnungenAusText, _datumAus: datumAus,
    KENNZEICHNUNG: KENNZEICHNUNG, MASSNAHMEN: MASSNAHMEN, AUFTEILUNG_JE_WE: AUFTEILUNG_JE_WE,
    kappung: kappung, kappungLaden: kappungLaden, agsHolen: agsHolen,
    massnahmenVon: massnahmenVon, massnahmenSpiegeln: massnahmenSpiegeln, massnahmenBinden: massnahmenBinden,
    punkteGewinn: punkteGewinn, sollFuer: sollFuer, umlage559: umlage559,
    modell: modell, rechnen: rechnen, ergebnis: ergebnis, ergebnisVeraltet: ergebnisVeraltet,
    wohnungErgebnis: wohnungErgebnis, kennzahlen: kennzahlen, tafelHtml: tafelHtml, pdfDaten: pdfDaten, pilotPayload: pilotPayload,
    sollFuerMietentwicklung: sollFuerMietentwicklung, objektKarte: objektKarte,
    _hash: hash, _auftrag: auftrag
  };
})();
