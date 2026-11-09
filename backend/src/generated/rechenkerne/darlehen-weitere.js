/* ═══ v3215 · W-17 · WEITERE DARLEHEN (Darlehen III, IV, …) ═════════════════
 *
 * Umsetzungswunsch W-17 (Entwicklungspartner, Staging 07.11.2026): im Reiter
 * Finanzierung beliebig viele Darlehen. Darlehen I und II bleiben, wie sie
 * sind - daneben steht eine Liste „Weitere Darlehen", gespeichert als JSON im
 * versteckten Feld #darlehen_weitere (storage.js FIELDS + Leerliste).
 *
 * DIESE DATEI IST EIN RECHENKERN. Sie liest kein DOM, keine Einstellung und
 * kein localStorage - die Liste und die Daten (Basisjahr, Monate in Jahr 1)
 * kommen als Parameter. Deshalb wird sie mit tools/rechenkerne-spiegeln.mjs
 * ins Backend-Image gespiegelt (deal-kpis.js liest sie dort ueber window).
 *
 * Ein Eintrag (so steht er im Feld):
 *   { bez: 'KfW 261', betrag: 50000, zins: 3.1, tilg: 2, art: 'annuitaet',
 *     bindj: 10, start_jahr: 2028 }
 *   art        'annuitaet' (Default) | 'tilgungsaussetzung' (reines
 *              Zinsdarlehen ohne Tilgungstraeger, Restschuld bleibt - wie
 *              Darlehen II mit Tilgungsaussetzung)
 *   bindj      Zinsbindung in Jahren (nur Anzeige und Restschuld am Ende der
 *              Bindung). Danach laeuft das Darlehen mit seiner Rate weiter
 *              (durchfinanziert) - wie Darlehen II ohne eigene Anschlussfinanzierung.
 *   start_jahr optional. Leer oder <= Basisjahr: das Darlehen gehoert zur
 *              Kauffinanzierung (Darlehenssumme, LTV, Rate heute) und beginnt
 *              wie Darlehen I (dieselben Monate im Jahr 1). Spaeter: es wird
 *              erst ab dem 1. Januar dieses Jahres ausgezahlt und zaehlt nur
 *              in der Projektion (Zins, Tilgung, Restschuld je Jahr).
 *
 * Gerechnet wird Monat fuer Monat wie _jahrMonatlich() in calc.js (v3029):
 *   Zins_m = Restschuld x Zins / 12, Tilgung_m = min(Restschuld, Rate - Zins_m).
 * ═══════════════════════════════════════════════════════════════════════════ */
window.DpDarlehenWeitere = (function () {
  'use strict';

  /* Zahl aus Feld oder JSON: 50000, "50.000", "3,1", "3.1" (Punkt mit genau
     einer oder zwei Nachkommastellen ist ein Dezimalpunkt, sonst Tausender). */
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim().replace(/\s|€|%/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  /* Liste aus Feldwert (JSON-Text) oder Array, bereinigt. Eintraege ohne
     Betrag > 0 fallen heraus - sie rechnen nichts. */
  function lesen(raw) {
    var l = raw;
    if (typeof raw === 'string') {
      if (!raw.trim()) return [];
      try { l = JSON.parse(raw); } catch (e) { return []; }
    }
    if (!Array.isArray(l)) return [];
    var aus = [];
    l.forEach(function (e, i) {
      if (!e || typeof e !== 'object') return;
      var betrag = zahl(e.betrag);
      if (!(betrag > 0)) return;
      var art = e.art === 'tilgungsaussetzung' ? 'tilgungsaussetzung' : 'annuitaet';
      var zins = zahl(e.zins); if (!(zins >= 0)) zins = 0;
      var tilg = art === 'tilgungsaussetzung' ? 0 : zahl(e.tilg); if (!(tilg >= 0)) tilg = 0;
      var bindj = zahl(e.bindj); bindj = bindj > 0 ? Math.round(bindj) : null;
      var sj = zahl(e.start_jahr); sj = (sj >= 1900 && sj <= 2200) ? Math.round(sj) : null;
      aus.push({ nr: i, bez: String(e.bez == null ? '' : e.bez).trim(), betrag: betrag, zins: zins, tilg: tilg,
        art: art, bindj: bindj, start_jahr: sj });
    });
    return aus;
  }

  function name(e, i) { return e.bez || ('Darlehen ' + roemisch(3 + (i == null ? e.nr : i))); }
  function roemisch(n) {
    var r = '', t = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    t.forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } });
    return r;
  }

  /* Monatsrate (Zins + Tilgung) am Anfang; bei Tilgungsaussetzung nur Zins. */
  function rateM(e) { return e.betrag * (e.zins + e.tilg) / 100 / 12; }

  /* Gehoert das Darlehen zur Kauffinanzierung? */
  function abKauf(e, basisJahr) { return !e.start_jahr || !basisJahr || e.start_jahr <= basisJahr; }

  /* Summen der Darlehen, die mit dem Kauf laufen - fuer Darlehenssumme, LTV,
     Rate, Zins und Tilgung im ersten vollen Jahr (wie D1/D2: Betrag x Satz).
     opts.basisJahr (optional). */
  function anfang(raw, opts) {
    var l = lesen(raw), o = opts || {};
    var s = { n: 0, betrag: 0, rate_m: 0, zm: 0, tm: 0, zins_j: 0, tilg_j: 0, liste: [] };
    l.forEach(function (e) {
      if (!abKauf(e, o.basisJahr)) return;
      var r = rateM(e), zm = e.betrag * e.zins / 100 / 12;
      s.n++; s.betrag += e.betrag; s.rate_m += r; s.zm += zm; s.tm += (r - zm);
      s.liste.push(e);
    });
    s.zins_j = s.zm * 12; s.tilg_j = s.tm * 12;
    return s;
  }

  /* Erster Monat (0 = Januar des Basisjahres, Jahr 1 der Projektion). */
  function startMonat(e, o) {
    if (abKauf(e, o.basisJahr)) {
      var m1 = (o.monateJahr1 == null) ? 12 : Math.max(0, Math.min(12, o.monateJahr1));
      return 12 - m1;
    }
    return (e.start_jahr - o.basisJahr) * 12;
  }

  /* Ein Darlehen Monat fuer Monat bis Monat `bis` (exklusiv); ruft je Monat
     cb(monat, zins, tilg, restschuldDanach). Liefert die Restschuld danach. */
  function laufen(e, start, bis, cb) {
    var rs = 0, rate = rateM(e), z = e.zins / 100;
    for (var m = start; m < bis; m++) {
      if (m === start) rs = e.betrag;
      var zm = rs * z / 12;
      var tm = e.art === 'tilgungsaussetzung' ? 0 : Math.min(rs, Math.max(0, rate - zm));
      rs = Math.max(0, rs - tm);
      if (cb) cb(m, zm, tm, rs);
    }
    return bis > start ? rs : 0;
  }

  /* Plan je Projektionsjahr: [{ y, cal, zins, tilg, rs_ende, je: [...] }].
     opts: basisJahr (Kalenderjahr von Jahr 1), jahre, monateJahr1 (Monate
     der Kauffinanzierung im Jahr 1, Default 12 - wie D1 in calc.js). */
  function plan(raw, opts) {
    var l = lesen(raw), o = opts || {}, J = Math.max(0, Math.round(o.jahre || 0));
    var by = o.basisJahr || null;
    var zeilen = [];
    for (var y = 1; y <= J; y++) zeilen.push({ y: y, cal: by ? by + y - 1 : null, zins: 0, tilg: 0, rs_ende: 0, je: [] });
    l.forEach(function (e) {
      var st = by ? startMonat(e, { basisJahr: by, monateJahr1: o.monateJahr1 }) : startMonat(e, { monateJahr1: o.monateJahr1 });
      var je = zeilen.map(function () { return { zins: 0, tilg: 0, rs_ende: 0 }; });
      var rsLetzt = 0;
      laufen(e, st, J * 12, function (m, zm, tm, rs) {
        var j = Math.floor(m / 12); if (j < 0 || j >= J) return;
        je[j].zins += zm; je[j].tilg += tm; je[j].rs_ende = rs; rsLetzt = rs;
      });
      /* Jahre vor dem Start: Restschuld 0 (bleibt); danach fortgeschrieben */
      je.forEach(function (x, j) {
        var z = zeilen[j];
        z.zins += x.zins; z.tilg += x.tilg; z.rs_ende += x.rs_ende;
        z.je.push({ bez: name(e), zins: x.zins, tilg: x.tilg, rs_ende: x.rs_ende });
      });
    });
    return zeilen;
  }

  /* Summe der Restschulden nach `monate` Monaten ab Januar des Basisjahres. */
  function restNach(raw, monate, opts) {
    var l = lesen(raw), o = opts || {}, s = 0;
    l.forEach(function (e) {
      var st = startMonat(e, o);
      if (monate < st) return;   /* noch nicht ausgezahlt */
      s += (monate === st) ? e.betrag : laufen(e, st, monate);
    });
    return s;
  }

  /* Fuer Leser eines GESPEICHERTEN Objekts (Portfolio, Dashboard, Backend):
     Basisjahr wie calc.js - wirtschaftlicher Uebergang, sonst Kaufdatum
     (Jahreszahl aus ISO oder TT.MM.JJJJ). Liest nur das uebergebene Objekt. */
  function basisJahrAus(d) {
    var q = d ? (d.wirtschaftlicher_uebergang || d.kaufdat || '') : '';
    var m = String(q).match(/(19|20|21)\d{2}/);
    return m ? parseInt(m[0], 10) : null;
  }
  function ausObjekt(d) {
    return anfang(d ? d.darlehen_weitere : null, { basisJahr: basisJahrAus(d) });
  }

  /* Restschuld eines Eintrags am Ende SEINER Zinsbindung (ab Auszahlung). */
  function restBindungsende(e) {
    var n = lesen([e])[0]; if (!n) return 0;
    return laufen(n, 0, (n.bindj || 10) * 12);
  }

  /* v3256 · Monatsplan EINES Eintrags ab Auszahlung (Monat 0) fuer den Dialog
     „Tilgungsplan / Zinsplan ansehen" je weiterem Darlehen. Dieselbe Schleife
     laufen() wie plan() und restNach() - keine zweite Rechnung.
     Liefert [{ m, rate, zins, tilg, rs }]; rs = Restschuld nach dem Monat. */
  function monatsplan(e, monate) {
    var n = lesen([e])[0]; if (!n) return [];
    var bis = Math.max(0, Math.min(1200, Math.round(monate || 0)));
    var aus = [];
    laufen(n, 0, bis, function (m, zm, tm, rs) { aus.push({ m: m, rate: zm + tm, zins: zm, tilg: tm, rs: rs }); });
    return aus;
  }

  return {
    version: 'v3256',
    lesen: lesen, anfang: anfang, plan: plan, restNach: restNach, ausObjekt: ausObjekt, basisJahrAus: basisJahrAus,
    restBindungsende: restBindungsende, rateM: rateM, abKauf: abKauf, name: name, zahl: zahl,
    monatsplan: monatsplan
  };
})();
