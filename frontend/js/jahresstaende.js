/* ══════════════════════════════════════════════════════════════════════
 * jahresstaende.js — v2989 · Jahresstände · Rechenstand · Zielerreichung
 *
 * Marcel 27.10.2026 („ja das kannst du machen"): ein Objekt im Bestand hat
 * bisher zwei Zeitpunkte - den eingefrorenen Ankauf (`_ankauf`, ankauf.js)
 * und heute. Es fehlten:
 *
 *   JAHRESSTÄNDE   je Kalenderjahr ein kleiner Kennzahlen-Stand (nicht der
 *                  ganze Datensatz): dieselben Kennzahlen wie `_ankauf.kurz`
 *                  plus Restschuld je Darlehen, Wert laut letztem Marktbericht,
 *                  Datum und Rechenstand. Feld `_jahresstaende` im Objekt.
 *                  Der jüngste Stand eines Jahres ersetzt den älteren
 *                  desselben Jahres; Vorjahre bleiben eingefroren.
 *   RECHENSTAND    mit welcher App-Version die Zahlen gerechnet wurden
 *                  (`_ankauf.version`, `_jahresstaende[].version`). Sonst
 *                  steckt eine spätere Kernkorrektur unsichtbar in der
 *                  Abweichung.
 *   ZIELERREICHUNG je Hebel Ankauf → heute → Ziel in Prozent, nur mit
 *                  vorliegenden Zahlen, sonst „fehlt: …".
 *
 * ── WAS HIER NICHT PASSIERT ─────────────────────────────────────────
 *
 * **Dieses Modul rechnet keine Kennzahl neu.** Wie ankauf.js liest es die
 * persistierten Kennzahlen (`_kpis_*`, über DealPilotAnkauf.kurzfassung),
 * die Projektion aus calc.js (State.cfRows), Fristen und Restschuld aus
 * bestand-analyse.js (DpBestand), die Zielbild-Miete aus DpPotenzial und
 * den Marktbericht aus DpWertZielbild. Neu gerechnet werden nur Quotienten
 * (Prozent der Zielerreichung) aus diesen Zahlen.
 *
 * Plan gegen Ist braucht die Projektion DES ANKAUFS. Die wird seit v2989
 * beim Festschreiben mit eingefroren (`_ankauf.plan`). Ältere Stände haben
 * sie nicht - dann entfällt der Hebel. Die alte Projektion mit dem heutigen
 * Kern nachzurechnen, wäre genau der Fehler aus dem Kopf von ankauf.js.
 *
 * ── WANN EIN JAHRESSTAND ENTSTEHT ───────────────────────────────────
 *
 * Beim Speichern (storage.js saveObj ruft beimSpeichern) und per Knopf
 * „Stand festhalten" - NIE beim Laden (Memory loaddata-speichert-sofort).
 * Nur mit Ankauf-Stand, nie in der Soll-Ansicht, nur wenn die Kennzahlen
 * für DIESES Objekt gerechnet sind (State.kpis._fuer).
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var VERSION = 'v2989';

  /* Vorschlag (Aufgabe 4): kleiner Ring „Ziel NN %" im Objektkopf neben dem
     Deal Score, nur im Bestand. false schaltet ihn ab. */
  var ZIEL_RING_IM_KOPF = true;

  /* Die Rechenkerne, deren Buster den Rechenstand bilden. Jede Änderung an
     einem davon zieht laut CLAUDE.md den Buster hoch - der höchste ist damit
     der Stand der Rechnung. */
  var RECHENKERNE = ['calc.js', 'deal-kpis.js', 'dscr-engine.js', 'dealscore.js', 'dealscore2.js', 'score-tiers.js',
    'tax.js', 'afa-engine.js', 'hausgeld-engine.js', 'schwellen.js', 'mietentwicklung.js', 'anteilig-recalc.js'];

  /* Ab dieser Version führt ein Ankauf-Stand seinen Rechenstand. */
  var AB_VERSION = 'v2989';

  /* Ampel der Gesamtzahl (Vorschlag, nicht Marcels Entscheidung). */
  var AMPEL = [{ ab: 75, farbe: '#3FA56C', wort: 'auf Kurs' }, { ab: 40, farbe: 'var(--wl-c9a84c, #C9A84C)', wort: 'unterwegs' }, { ab: -Infinity, farbe: '#B8625C', wort: 'hinter dem Ziel' }];

  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  /* `Number(null)` ist 0 - erst auf Abwesenheit prüfen (CLAUDE.md) */
  function zahl(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim();
    if (/^-?\d+\.\d{1,2}$/.test(s)) return parseFloat(s);   /* „3.5" ist ein Dezimalpunkt */
    var n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function r2(x) { return istZahl(x) ? Math.round(x * 100) / 100 : null; }
  function r0(x) { return istZahl(x) ? Math.round(x) : null; }
  function S() { return global.State || {}; }
  function AK() { return global.DealPilotAnkauf || null; }

  /* ── Rechenstand ─────────────────────────────────────────────────── */
  function versionsZahl(v) { var m = /v?(\d+)/.exec(String(v || '')); return m ? +m[1] : null; }
  function rechenstand() {
    try {
      var doc = global.document;
      if (!doc || !doc.querySelectorAll) return null;
      var sk = doc.querySelectorAll('script[src]'), kerne = {}, best = null, bestN = -1;
      for (var i = 0; i < sk.length; i++) {
        var src = String(sk[i].getAttribute ? sk[i].getAttribute('src') : sk[i].src || '');
        var m = /(?:^|\/)([a-z0-9_-]+\.js)\?v=([^&"']+)/i.exec(src);
        if (!m || RECHENKERNE.indexOf(m[1]) < 0) continue;
        kerne[m[1]] = m[2];
        var n = versionsZahl(m[2]);
        if (n != null && /^v/.test(m[2]) && n > bestN) { bestN = n; best = m[2]; }
      }
      return best ? { version: best, kerne: kerne } : null;
    } catch (e) { return null; }
  }
  /* Satz für Abweichungstafel und Zielerreichung - leer, wenn gleich. */
  function rechenstandSatz(ankauf, heute) {
    if (!ankauf) return '';
    var h = heute === undefined ? rechenstand() : heute;
    var hv = h && h.version ? h.version : null;
    if (!ankauf.version) {
      return 'Rechenstand des Ankaufs unbekannt (vor ' + AB_VERSION + ')' + (hv ? ', heute ' + hv : '')
        + ' — Abweichungen können auch aus Rechenänderungen stammen.';
    }
    if (hv && hv === ankauf.version) return '';
    return 'Ankauf gerechnet mit Stand ' + ankauf.version + (hv ? ', heute ' + hv : '')
      + ' — Abweichungen können auch aus Rechenänderungen stammen.';
  }

  /* Die Projektion zum Zeitpunkt des Festschreibens (calc.js State.cfRows),
     klein: je Jahr Miete, Cashflow vor/nach Steuer, Restschuld. Nur wenn die
     Kennzahlen für dieses Objekt gerechnet sind. */
  function kpisPassen() {
    var k = S().kpis;
    if (!k) return false;
    var key = global._currentObjKey;
    if (!key) return false;
    return k._fuer === undefined || String(k._fuer || '') === String(key);
  }
  function planJetzt() {
    try {
      if (!kpisPassen()) return null;
      var rows = S().cfRows;
      if (!Array.isArray(rows) || !rows.length) return null;
      return rows.slice(0, 40).filter(function (r) { return r && istZahl(r.cal); }).map(function (r) {
        return { cal: r.cal, nkm_y: r0(r.nkm_y), cfop_y: r0(r.cfop_y), cfns_y: r0(r.cfns_y), rs: r0(r.rs) };
      });
    } catch (e) { return null; }
  }
  /* Für ankauf.js: was beim Festschreiben zusätzlich eingefroren wird. */
  function festschreibAnhang() {
    var r = rechenstand();
    return { version: r ? r.version : null, kerne: r ? r.kerne : null, plan: planJetzt() };
  }

  /* ── Jahresstände ────────────────────────────────────────────────── */
  function zeileHeute(jahr) {
    var rows = S().cfRows;
    if (!Array.isArray(rows)) return null;
    for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].cal === jahr) return rows[i];
    return null;
  }
  function marktbericht() {
    try {
      var W = global.DpWertZielbild, b = W && W.bericht ? W.bericht() : null;
      if (!b || b.market_value == null) return null;
      var w = Number(b.market_value);
      if (!isFinite(w) || w <= 0) return null;
      var d = b.created_at ? new Date(b.created_at) : null;
      return { wert: w, stand: d && !isNaN(d) ? d.toISOString().slice(0, 10) : null };
    } catch (e) { return null; }
  }
  /* Kennzahlen eines Datensatzes - die Kurzfassung aus ankauf.js (EINE Quelle)
     plus Restschuld (Projektion, laufendes Jahr), Marktbericht und Eigenkapital. */
  function kennzahlen(daten, datum) {
    var A = AK(), kz = {};
    if (A && typeof A.kurzfassung === 'function') { try { kz = A.kurzfassung(daten) || {}; } catch (e) { kz = {}; } }
    var jahr = (datum || new Date()).getFullYear();
    var z = kpisPassen() ? zeileHeute(jahr) : null;
    kz.rs_gesamt = z && istZahl(z.rs) ? r0(z.rs) : null;
    kz.rs_d1 = z && istZahl(z.rs_d1) ? r0(z.rs_d1) : null;
    kz.rs_d2 = z && istZahl(z.rs_d2) ? r0(z.rs_d2) : null;
    kz.rs_jahr = z ? jahr : null;
    var mb = marktbericht();
    kz.wert_mb = mb ? r0(mb.wert) : null;
    kz.wert_mb_stand = mb ? mb.stand : null;
    var k = S().kpis || {};
    kz.ek = zahl(daten && daten.ek);
    if (kz.ek == null && kpisPassen() && istZahl(k.ek)) kz.ek = r0(k.ek);
    return kz;
  }
  function neuerStand(daten, datum) {
    datum = datum || new Date();
    var r = rechenstand();
    return { jahr: datum.getFullYear(), am: datum.toISOString(), version: r ? r.version : null, kz: kennzahlen(daten, datum) };
  }
  /* Rein: der Stand ersetzt den desselben Jahres, alle anderen bleiben
     unberührt. Rückgabe ist eine NEUE Liste, nach Jahr sortiert. */
  function einfuegen(liste, stand) {
    var aus = (Array.isArray(liste) ? liste : []).filter(function (s) { return s && istZahl(s.jahr) && s.jahr !== stand.jahr; });
    aus.push(stand);
    aus.sort(function (a, b) { return a.jahr - b.jahr; });
    return aus;
  }
  function sollAnsicht() {
    try { var AA = global.DealPilotAnkaufAnsicht; return !!(AA && typeof AA.aktiv === 'function' && AA.aktiv()); } catch (e) { return true; }
  }
  /* Aus saveObj (storage.js), direkt nach collectData(). `data` ist der
     Datensatz, der gleich gespeichert wird. Gibt true zurück, wenn ein Stand
     gesetzt wurde. Schreibt nur in `data` und in _currentObjData (damit der
     nächste collectData() die Liste wieder mitnimmt). */
  function beimSpeichern(data, opts) {
    try {
      if (!data || typeof data !== 'object') return false;
      if (opts && opts._vorAnkauf) return false;            /* Sicherung vor dem Umschalten */
      if (!data._ankauf || !data._ankauf.daten) return false;   /* nur im Bestand (gewonnen + Ankauf-Stand) */
      if (sollAnsicht()) return false;
      if (!kpisPassen()) return false;                      /* Kennzahlen eines anderen Objekts */
      var st = neuerStand(data, new Date());
      var liste = einfuegen(data._jahresstaende, st);
      data._jahresstaende = liste;
      try { if (global._currentObjData) global._currentObjData._jahresstaende = liste; } catch (e) {}
      setTimeout(kopfRing, 50);
      return true;
    } catch (e) { return false; }
  }
  function liste() {
    var d = global._currentObjData;
    return d && Array.isArray(d._jahresstaende) ? d._jahresstaende : [];
  }
  function festhalten() {
    if (sollAnsicht()) { if (typeof global.toast === 'function') global.toast('ℹ In der Soll-Ansicht wird kein Stand festgehalten.'); return; }
    if (!(AK() && AK().vorhanden())) { if (typeof global.toast === 'function') global.toast('ℹ Jahresstände gibt es nur im Bestand (mit Ankauf-Stand).'); return; }
    if (typeof global.saveObj !== 'function') return;
    Promise.resolve(global.saveObj()).then(function () {
      mount();
      if (typeof global.toast === 'function') global.toast('✓ Stand ' + new Date().getFullYear() + ' festgehalten');
    }, function () {});
  }

  /* ── Zielerreichung: die Rechnung (rein, testbar) ─────────────────
     e = {
       ankauf:  { nkm, d_summe, ek, ltv, plan_cf, plan_jahr, version },
       heute:   { nkm, rs, rs_jahr, cf_vs, wert, wert_stand, gi },
       ziel:    { nkm, rs, rs_ende, netto },
       fristen: [{ wort, ende (ISO), monate }],
       jahresstaende: [...]
     }
     Prozent = (heute − Ankauf) ÷ (Ziel − Ankauf). Fehlt eine der drei Zahlen,
     steht der Hebel mit „fehlt: …" da und zählt nicht. */
  function anteil(a, h, z) {
    if (!istZahl(a) || !istZahl(h) || !istZahl(z) || z === a) return null;
    return (h - a) / (z - a) * 100;
  }
  function rechne(e) {
    e = e || {};
    var A = e.ankauf || {}, H = e.heute || {}, Z = e.ziel || {}, hebel = [];
    function fehltListe(paare) { return paare.filter(function (p) { return !istZahl(p[1]); }).map(function (p) { return p[0]; }); }

    /* Miete */
    (function () {
      var f = fehltListe([['Miete beim Ankauf', A.nkm], ['Miete heute', H.nkm], ['Zielbild-Miete (Zielbild anlegen)', Z.nkm]]);
      var h = { id: 'miete', wort: 'Miete', einheit: 'eur_m', ankauf: A.nkm, heute: H.nkm, ziel: Z.nkm, zaehlt: true, fehlt: f };
      if (!f.length && !(Z.nkm > A.nkm)) h.fehlt = ['Zielbild-Miete über der Ankaufsmiete'];
      if (!h.fehlt.length) h.pct = anteil(A.nkm, H.nkm, Z.nkm);
      h.text = 'Kaltmiete je Monat: (heute − Ankauf) ÷ (Zielbild − Ankauf)';
      hebel.push(h);
    })();

    /* Entschuldung: getilgter Anteil gegen das, was bis zum Ende der Zinsbindung getilgt sein soll */
    (function () {
      var f = fehltListe([['Darlehenssumme beim Ankauf', A.d_summe], ['Restschuld heute (Projektion)', H.rs], ['Restschuld zum Ende der Zinsbindung', Z.rs]]);
      var h = { id: 'entschuldung', wort: 'Entschuldung', einheit: 'eur', ankauf: A.d_summe, heute: H.rs, ziel: Z.rs, zaehlt: true, fehlt: f };
      if (!f.length && !(A.d_summe > Z.rs)) h.fehlt = ['Tilgung bis zum Ende der Zinsbindung'];
      if (!h.fehlt.length) {
        h.pct = anteil(A.d_summe, H.rs, Z.rs);
        h.getilgt_pct = A.d_summe > 0 ? (A.d_summe - H.rs) / A.d_summe * 100 : null;
      }
      h.ltv_ankauf = istZahl(A.ltv) ? A.ltv : null;
      h.ltv_heute = istZahl(H.rs) && H.wert > 0 ? H.rs / H.wert * 100 : null;
      h.text = 'getilgt seit Kauf ÷ getilgt bis Ende Zinsbindung' + (Z.rs_ende ? ' (' + Z.rs_ende + ')' : '');
      hebel.push(h);
    })();

    /* Eigenkapitalaufbau: Nettovermögen (Marktpreis − Restschuld) gegen eingesetztes EK */
    (function () {
      var f = fehltListe([['eingesetztes Eigenkapital', A.ek], ['Marktpreisindikation (Marktbericht abrufen)', H.wert], ['Restschuld heute (Projektion)', H.rs]]);
      var netto = istZahl(H.wert) && istZahl(H.rs) ? H.wert - H.rs : null;
      var h = { id: 'ek', wort: 'Eigenkapitalaufbau', einheit: 'eur', ankauf: A.ek, heute: netto, ziel: istZahl(Z.netto) ? Z.netto : null, zaehlt: false, fehlt: f };
      if (!f.length && A.ek > 0) {
        h.vielfaches = netto / A.ek;
        if (istZahl(Z.netto) && Z.netto > A.ek) { h.pct = anteil(A.ek, netto, Z.netto); h.zaehlt = true; }
        else h.ohne_ziel = 'kein Zielwert (Ertragswert des Zielbilds fehlt) — Stand: ' + (Math.round(h.vielfaches * 100) / 100).toLocaleString('de-DE') + '-faches des Eigenkapitals';
      }
      h.text = 'Nettovermögen (Marktpreis − Restschuld) gegen eingesetztes EK' + (istZahl(Z.netto) ? '; Ziel: Ertragswert Zielbild − Restschuld' : '');
      hebel.push(h);
    })();

    /* Plan gegen Ist: Cashflow v. St., wie beim Ankauf für dieses Jahr projiziert */
    (function () {
      if (!istZahl(A.plan_cf)) return;   /* ohne eingefrorene Projektion: weglassen (ankauf.js-Kopf) */
      var f = fehltListe([['Cashflow heute', H.cf_vs]]);
      var h = { id: 'plan', wort: 'Plan gegen Ist (Cashflow v. St. ' + (A.plan_jahr || '') + ')', einheit: 'eur', ankauf: null, heute: H.cf_vs, ziel: A.plan_cf, zaehlt: true, fehlt: f };
      if (!f.length) {
        if (A.plan_cf > 0) h.pct = H.cf_vs / A.plan_cf * 100;
        else { h.zaehlt = false; h.ohne_ziel = 'Plan ≤ 0 — Abweichung ' + (H.cf_vs - A.plan_cf >= 0 ? '+' : '') + Math.round(H.cf_vs - A.plan_cf).toLocaleString('de-DE') + ' €'; }
      }
      h.text = 'Ist ÷ Plan des Ankaufs für das laufende Jahr';
      hebel.push(h);
    })();

    /* Rendite seit Ankauf: Σ Cashflow n. St. aus den Jahresständen + Wertzuwachs, auf das EK */
    (function () {
      var js = Array.isArray(e.jahresstaende) ? e.jahresstaende : [];
      var cfs = js.map(function (s) { return s && s.kz ? zahl(s.kz._kpis_cf_ns) : null; }).filter(istZahl);
      var h = { id: 'rendite', wort: 'Rendite seit Ankauf', einheit: 'pct', zaehlt: false, fehlt: [] };
      if (js.length < 2) h.fehlt.push('ab dem zweiten Jahresstand (bisher ' + js.length + ')');
      else {
        h.fehlt = fehltListe([['eingesetztes Eigenkapital', A.ek], ['Marktpreisindikation (Marktbericht abrufen)', H.wert], ['Gesamtinvestition', H.gi]]);
        if (!cfs.length) h.fehlt.push('Cashflow in den Jahresständen');
      }
      if (!h.fehlt.length && A.ek > 0) {
        h.cf_summe = cfs.reduce(function (s, x) { return s + x; }, 0);
        h.wertzuwachs = H.wert - H.gi;
        h.heute = (h.cf_summe + h.wertzuwachs) / A.ek * 100;
        h.cf_jahre = cfs.length;
      }
      h.text = 'Summe der Jahres-Cashflows n. St. aus den Jahresständen + Wertzuwachs (Marktpreis − Gesamtinvestition), auf das EK';
      hebel.push(h);
    })();

    /* Fristen - Countdown, keine Prozent im Mittel */
    var fristen = (Array.isArray(e.fristen) ? e.fristen : []).filter(function (f) { return f && f.wort; });

    var gezaehlt = hebel.filter(function (h) { return h.zaehlt && istZahl(h.pct); });
    var gesamt = gezaehlt.length
      ? gezaehlt.reduce(function (s, h) { return s + Math.max(0, Math.min(100, h.pct)); }, 0) / gezaehlt.length : null;
    var ampel = null;
    if (istZahl(gesamt)) for (var i = 0; i < AMPEL.length; i++) if (gesamt >= AMPEL[i].ab) { ampel = AMPEL[i]; break; }
    return { hebel: hebel, fristen: fristen, gesamt: gesamt, anzahl: gezaehlt.length, ampel: ampel,
             woraus: gezaehlt.map(function (h) { return h.wort; }) };
  }

  /* ── Zielerreichung: die Zahlen aus der laufenden App sammeln ────── */
  function iso(d) { return d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : null; }
  function sammeln(datum) {
    datum = datum || new Date();
    var A = AK(), a = A && A.stand ? A.stand() : null;
    if (!a) return null;
    var ad = a.daten || {}, kurzA = a.kurz || {};
    var heuteD = {};
    try { heuteD = typeof global.collectData === 'function' ? global.collectData() : {}; } catch (e) { heuteD = {}; }
    var kzH = kennzahlen(heuteD, datum);
    var B = global.DpBestand, x = null, an = null;
    try { x = B && B.exit ? B.exit(datum) : null; } catch (e) { x = null; }
    try { an = B && B.anschluss ? B.anschluss(datum) : null; } catch (e) { an = null; }
    /* Ankauf */
    var d1 = zahl(ad.d1), d2 = (ad._d2_enabled === true || ad._d2_enabled === 'true') ? zahl(ad.d2) : 0;
    var dSumme = istZahl(d1) ? d1 + (istZahl(d2) ? d2 : 0) : null;
    var planJahr = datum.getFullYear(), planCf = null;
    if (Array.isArray(a.plan)) a.plan.forEach(function (p) { if (p && p.cal === planJahr && istZahl(p.cfop_y)) planCf = p.cfop_y; });
    var ankauf = { nkm: zahl(kurzA.nkm != null ? kurzA.nkm : ad.nkm), d_summe: dSumme, ek: zahl(ad.ek), ltv: zahl(kurzA._kpis_ltv),
      plan_cf: planCf, plan_jahr: planJahr, version: a.version || null };
    if (!istZahl(ankauf.ek)) ankauf.ek = kzH.ek;   /* das eingesetzte EK ist dieselbe Eingabe */
    /* heute */
    var heute = { nkm: zahl(heuteD.nkm), rs: x && istZahl(x.restschuld) ? x.restschuld : kzH.rs_gesamt, rs_jahr: x ? x.restschuld_jahr : kzH.rs_jahr,
      cf_vs: zahl(heuteD._kpis_cf_vs), wert: x && istZahl(x.marktwert) ? x.marktwert : kzH.wert_mb,
      wert_stand: x && x.marktwert_stand ? iso(x.marktwert_stand) : kzH.wert_mb_stand, gi: x ? x.gesamtinvestition : null };
    /* Ziel */
    var ziel = { nkm: null, rs: null, rs_ende: null, netto: null };
    try {
      var PZ = global.DpPotenzial, m = PZ && PZ.modell ? PZ.modell() : null;
      if (m && m.aktiv && m.stufen && m.stufen.zielbild && PZ.kennzahlen) {
        var kz = PZ.kennzahlen(m);
        if (kz && kz.zielbild && istZahl(kz.zielbild.miete_j)) ziel.nkm = kz.zielbild.miete_j / 12;
        var pp = PZ.pilotPayload ? PZ.pilotPayload() : null;
        var ew = pp && pp.stufen && pp.stufen.zielbild ? pp.stufen.zielbild.ertragswert : null;
        if (istZahl(ew) && istZahl(heute.rs)) ziel.netto = ew - heute.rs;
      }
    } catch (e) {}
    var fristen = [];
    if (an && Array.isArray(an.darlehen)) {
      var rsZ = 0, alle = true, enden = [];
      an.darlehen.forEach(function (d) {
        if (istZahl(d.restschuld)) rsZ += d.restschuld; else alle = false;
        if (d.ende) { enden.push(d.ende); fristen.push({ wort: 'Ende Zinsbindung ' + d.name, ende: iso(d.ende), monate: d.monate_bis_ende }); }
      });
      if (alle && an.darlehen.length) { ziel.rs = rsZ; ziel.rs_ende = enden.length ? enden.map(function (d) { return d.getFullYear(); }).join(' / ') : null; }
    }
    if (x && x.frist_ende) fristen.push({ wort: 'Ende Zehnjahresfrist (§ 23 EStG)', ende: iso(x.frist_ende), monate: x.monate_bis_frist });
    return { ankauf: ankauf, heute: heute, ziel: ziel, fristen: fristen, jahresstaende: liste(), kz_heute: kzH, daten_heute: heuteD };
  }
  function zielerreichung(datum) {
    try {
      if (!global.DpBestand || !global.DpBestand.istBestand()) return null;
      var e = sammeln(datum);
      return e ? Object.assign(rechne(e), { eingabe: e }) : null;
    } catch (err) { return null; }
  }
  /* Für den Pilot (ui.js → bestand.zielerreichung). Der Prompt-Teil in
     openaiService.js wird nachgezogen (Journal v2989). */
  function payload(datum) {
    var z = zielerreichung(datum);
    if (!z) return null;
    return {
      gesamt_pct: r0(z.gesamt), aus_hebeln: z.woraus, ampel: z.ampel ? z.ampel.wort : null,
      hebel: z.hebel.map(function (h) {
        return { hebel: h.wort, prozent: r0(h.pct), ankauf: r2(h.ankauf), heute: r2(h.heute), ziel: r2(h.ziel),
          fehlt: h.fehlt && h.fehlt.length ? h.fehlt : null, ohne_ziel: h.ohne_ziel || null };
      }),
      fristen: z.fristen.map(function (f) { return { frist: f.wort, ende: f.ende, monate: f.monate }; }),
      jahresstaende: z.eingabe.jahresstaende.map(function (s) { return { jahr: s.jahr, version: s.version, kz: s.kz }; }),
      rechenstand_ankauf: z.eingabe.ankauf.version || 'unbekannt (vor ' + AB_VERSION + ')'
    };
  }

  /* ── Anzeige ─────────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return istZahl(x) ? Math.round(x).toLocaleString('de-DE') + ' €' : '–'; }
  function pctTxt(x) { return istZahl(x) ? Math.round(x).toLocaleString('de-DE') + ' %' : '–'; }
  function pct2(x) { return istZahl(x) ? x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %' : '–'; }
  function zahl2(x) { return istZahl(x) ? x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'; }
  function datumDe(isoS) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoS || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : '–'; }
  function farbe(p) { if (!istZahl(p)) return '#6B645A'; for (var i = 0; i < AMPEL.length; i++) if (p >= AMPEL[i].ab) return AMPEL[i].farbe; return '#B8625C'; }

  function stil() {
    var doc = global.document;
    if (!doc || !doc.getElementById || doc.getElementById('dp-ziel-stil') || !doc.createElement || !doc.head) return;
    var s = doc.createElement('style'); s.id = 'dp-ziel-stil';
    s.textContent = [
      '.dp-ziel{font:400 12.5px/1.5 Inter,system-ui,sans-serif}',
      '.dp-ziel-kopf{display:flex;align-items:center;gap:14px;margin:0 0 10px}',
      '.dp-ziel-zahl{font:600 26px/1 "Space Grotesk",Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '.dp-ziel-satz{font:400 12px/1.45 Inter,sans-serif;color:#6B645A}',
      '.dp-ziel-h{display:grid;grid-template-columns:minmax(120px,190px) minmax(0,1fr) 56px;gap:4px 12px;align-items:center;padding:6px 0;border-top:1px solid rgba(128,128,128,.18)}',
      '.dp-ziel-h b{font-weight:600}',
      '.dp-ziel-bar{position:relative;height:8px;border-radius:4px;background:rgba(128,128,128,.18);overflow:hidden}',
      '.dp-ziel-bar>i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}',
      '.dp-ziel-p{text-align:right;font:600 12.5px "JetBrains Mono",monospace;font-variant-numeric:tabular-nums}',
      '.dp-ziel-w{grid-column:2 / -1;font:400 11.5px/1.4 Inter,sans-serif;color:#6B645A}',
      '.dp-ziel-f{grid-column:2 / -1;font:400 11.5px/1.4 Inter,sans-serif;color:#6B645A}',
      '.dp-ziel table.dp-wv-tafel{margin-top:6px}',
      '.dp-ziel .abw-tafel th,.dp-ziel .abw-tafel td{font-size:12.5px;padding:5px 8px}',
      '.dp-ziel-knopf{margin-top:8px}',
      '.hdr-ziel-mini{display:inline-flex;align-items:center;gap:5px;margin-left:10px;cursor:pointer;font:600 11px "JetBrains Mono",monospace;white-space:nowrap}',
      '.hdr-ziel-mini svg{flex:0 0 auto}',
      '@media (max-width:640px){.dp-ziel-h{grid-template-columns:minmax(0,1fr) 56px}.dp-ziel-bar{grid-column:1 / -1;grid-row:2}.dp-ziel-w,.dp-ziel-f{grid-column:1 / -1}.hdr-ziel-mini{display:none!important}}'
    ].join('\n');
    doc.head.appendChild(s);
  }

  function wertTxt(h, v) {
    if (h.einheit === 'eur_m') return istZahl(v) ? Math.round(v).toLocaleString('de-DE') + ' €/Monat' : '–';
    if (h.einheit === 'pct') return pct2(v);
    return eur(v);
  }
  function hebelHtml(h) {
    var p = h.pct, breite = istZahl(p) ? Math.max(0, Math.min(100, p)) : 0;
    var weg = '';
    if (h.id === 'rendite') {
      weg = istZahl(h.heute) ? 'Cashflow n. St. aus ' + h.cf_jahre + ' Jahresständen ' + eur(h.cf_summe) + ' + Wertzuwachs ' + eur(h.wertzuwachs) + ' = <b>' + pct2(h.heute) + '</b> auf das Eigenkapital' : '';
    } else if (h.id === 'plan') {
      weg = 'Plan ' + eur(h.ziel) + ' · Ist ' + eur(h.heute);
    } else {
      weg = 'Ankauf ' + wertTxt(h, h.ankauf) + ' → heute <b>' + wertTxt(h, h.heute) + '</b> → Ziel ' + wertTxt(h, h.ziel);
      if (h.id === 'entschuldung' && istZahl(h.getilgt_pct)) weg += ' · getilgt ' + pctTxt(h.getilgt_pct);
      if (h.id === 'entschuldung' && (istZahl(h.ltv_ankauf) || istZahl(h.ltv_heute))) weg += ' · LTV ' + pct2(h.ltv_ankauf) + ' → ' + pct2(h.ltv_heute) + (istZahl(h.ltv_heute) ? ' (Restschuld ÷ Marktpreisindikation)' : '');
    }
    var rechts = istZahl(p) ? pctTxt(p) : (h.id === 'rendite' && istZahl(h.heute) ? pct2(h.heute) : '–');
    return '<div class="dp-ziel-h" data-dp-ziel-hebel="' + esc(h.id) + '"><b>' + esc(h.wort) + '</b>'
      + '<div class="dp-ziel-bar" title="' + esc(h.text || '') + '">' + (istZahl(p) ? '<i style="width:' + breite.toFixed(1) + '%;background:' + farbe(p) + '"></i>' : '') + '</div>'
      + '<span class="dp-ziel-p">' + rechts + '</span>'
      + (h.fehlt && h.fehlt.length ? '<div class="dp-ziel-f"><b>fehlt:</b> ' + h.fehlt.map(esc).join(' · ') + '</div>'
          : '<div class="dp-ziel-w">' + weg + (h.ohne_ziel ? ' · ' + esc(h.ohne_ziel) : '') + (h.zaehlt ? '' : ' <i>(nicht in der Gesamtzahl)</i>') + '</div>')
      + '</div>';
  }

  /* Die Jahresstände als Tabelle: Ankauf · Jahre · heute */
  var ZEILEN = [
    { k: 'nkm', w: 'Nettokaltmiete / Monat', f: eur },
    { k: '_kpis_miete_j', w: 'Jahresmiete', f: eur },
    { k: '_kpis_cf_vs', w: 'Cashflow v. Steuer p. a.', f: eur },
    { k: '_kpis_cf_ns', w: 'Cashflow n. Steuer p. a.', f: eur },
    { k: '_kpis_dscr', w: 'DSCR', f: zahl2 },
    { k: '_kpis_ltv', w: 'LTV', f: pct2 },
    { k: '_ds2_score', w: 'DealScore', f: function (x) { return istZahl(x) ? String(Math.round(x)) : '–'; } },
    { k: 'rs_gesamt', w: 'Restschuld (Projektion)', f: eur },
    { k: 'rs_d1', w: '· Darlehen 1', f: eur },
    { k: 'rs_d2', w: '· Darlehen 2', f: eur },
    { k: 'wert_mb', w: 'Wert laut Marktbericht', f: eur }
  ];
  function tabelleHtml(e) {
    var A = AK(), a = A && A.stand ? A.stand() : null;
    if (!a) return '';
    var spalten = [];
    var kA = {};
    try { kA = Object.assign({}, a.kurz || {}); if (A.kurzfassung && a.daten) { var neu = A.kurzfassung(a.daten); for (var q in neu) if (kA[q] == null) kA[q] = neu[q]; } } catch (x) {}
    kA.rs_gesamt = e.ankauf.d_summe;   /* beim Ankauf: die Darlehenssumme */
    spalten.push({ kopf: 'Ankauf', unter: datumDe(a.stichtag) + ' · ' + (a.version || 'Stand ?'), kz: kA });
    (e.jahresstaende || []).forEach(function (s) { spalten.push({ kopf: String(s.jahr), unter: datumDe(String(s.am || '').slice(0, 10)) + ' · ' + (s.version || '?'), kz: s.kz || {} }); });
    var kH = Object.assign({}, e.kz_heute || {});
    kH.nkm = zahl(e.daten_heute && e.daten_heute.nkm);
    var rv = rechenstand();
    spalten.push({ kopf: 'heute', unter: 'live · ' + (rv ? rv.version : '?'), kz: kH });
    var zeilen = ZEILEN.filter(function (z) { return spalten.some(function (s) { return istZahl(zahl(s.kz[z.k])); }); });
    return '<table class="abw-tafel dp-wv-tafel"><thead><tr><th>Kennzahl</th>'
      + spalten.map(function (s) { return '<th class="abw-zahl">' + esc(s.kopf) + '<div class="dp-pa-herk">' + esc(s.unter) + '</div></th>'; }).join('')
      + '</tr></thead><tbody>'
      + zeilen.map(function (z) {
          return '<tr><td class="abw-wort">' + z.w + '</td>' + spalten.map(function (s) { return '<td class="abw-zahl">' + z.f(zahl(s.kz[z.k])) + '</td>'; }).join('') + '</tr>';
        }).join('')
      + '</tbody></table>';
  }

  function html(datum) {
    var z = zielerreichung(datum);
    if (!z) return '';
    stil();
    var e = z.eingabe;
    var kopf = '<div class="dp-ziel-kopf">'
      + '<span class="dp-ziel-zahl" style="color:' + (z.ampel ? z.ampel.farbe : '#6B645A') + '">' + (istZahl(z.gesamt) ? pctTxt(z.gesamt) : '–') + '</span>'
      + '<span class="dp-ziel-satz">' + (z.anzahl
          ? '<b>Zielerreichung ' + esc(z.ampel.wort) + '</b> — Mittel aus ' + z.anzahl + (z.anzahl === 1 ? ' Hebel' : ' Hebeln') + ' mit Zielwert (' + z.woraus.map(esc).join(', ') + '), je Hebel auf 0–100 % begrenzt.'
          : 'Noch keine Gesamtzahl: kein Hebel hat Ankauf, heute und Ziel zugleich.') + '</span></div>';
    var satz = rechenstandSatz({ version: e.ankauf.version });
    var fr = z.fristen.length ? '<div class="dp-ziel-h"><b>Fristen</b><div class="dp-ziel-w" style="grid-column:2 / -1">'
      + z.fristen.map(function (f) { return esc(f.wort) + ': <b>' + datumDe(f.ende) + '</b>' + (f.monate != null ? (f.monate <= 0 ? ' (abgelaufen)' : ' (noch ' + f.monate + ' Monate)') : ''); }).join(' · ')
      + '</div></div>' : '';
    var n = e.jahresstaende.length;
    return '<div class="dp-pa-card dp-ziel" data-dp-ziel="1" style="margin-bottom:12px">'
      + '<div class="dp-pa-sec"><span>ZIELERREICHUNG</span></div>'
      + kopf
      + z.hebel.map(hebelHtml).join('') + fr
      + (satz ? '<div class="dp-pa-fuss" style="margin-top:8px">' + esc(satz) + '</div>' : '')
      + '<h4 class="dp-wv-h" style="margin:14px 0 4px">Jahresstände</h4>'
      + tabelleHtml(e)
      + '<div class="dp-pa-fuss">' + (n ? n + (n === 1 ? ' Jahresstand' : ' Jahresstände') + ' festgehalten. ' : 'Noch kein Jahresstand festgehalten. ')
      + 'Je Kalenderjahr gilt der zuletzt gespeicherte Stand; Vorjahre bleiben eingefroren. Gespeichert wird beim normalen Speichern im Bestand.</div>'
      + '<button type="button" class="btn-clean dp-ziel-knopf" onclick="DpJahresstaende.festhalten()">Stand ' + new Date().getFullYear() + ' festhalten</button>'
      + '</div>';
  }

  /* Füllt alle Platzhalter [data-dp-ziel-host] (Pilot-Analyse, Reiter si). */
  var _laedt = false;
  function mount() {
    var doc = global.document;
    if (!doc || !doc.querySelectorAll) return;
    var hs = doc.querySelectorAll('[data-dp-ziel-host]');
    for (var i = 0; i < hs.length; i++) { try { hs[i].innerHTML = html(); } catch (e) { hs[i].innerHTML = ''; } }
    var W = global.DpWertZielbild;
    if (hs.length && !_laedt && W && W.laden && !(W.bericht && W.bericht())) {
      _laedt = true;
      try { W.laden().then(function () { _laedt = false; if (W.bericht && W.bericht()) { mount(); kopfRing(); } }, function () { _laedt = false; }); } catch (e) { _laedt = false; }
    }
    kopfRing();
  }

  /* ── Ring im Objektkopf (Vorschlag) ─────────────────────────────── */
  function kopfRing() {
    var doc = global.document;
    if (!doc || !doc.getElementById) return;
    var el = doc.getElementById('hdr-ziel-mini');
    var z = ZIEL_RING_IM_KOPF ? zielerreichung() : null;
    if (!z || !istZahl(z.gesamt)) { if (el) el.style.display = 'none'; return; }
    var row = doc.querySelector ? doc.querySelector('.hdr-v61-row1') : null;
    if (!el) {
      if (!row) return;
      stil();
      el = doc.createElement('span');
      el.id = 'hdr-ziel-mini'; el.className = 'hdr-ziel-mini';
      var nach = doc.getElementById('hdr-score-mini') || doc.getElementById('hdr-completeness');
      if (nach && nach.parentNode === row) row.insertBefore(el, nach.nextSibling);
      else { var sp = row.querySelector('.hdr-spacer'); if (sp) row.insertBefore(el, sp); else row.appendChild(el); }
      el.addEventListener('click', oeffnen);
    }
    var p = Math.max(0, Math.min(100, z.gesamt)), u = 2 * Math.PI * 10, f = z.ampel ? z.ampel.farbe : '#6B645A';
    el.style.display = '';
    el.title = 'Zielerreichung ' + Math.round(z.gesamt) + ' % aus ' + z.anzahl + (z.anzahl === 1 ? ' Hebel' : ' Hebeln') + ' (' + z.woraus.join(', ') + ') — klicken für Details';
    el.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="rgba(128,128,128,.3)" stroke-width="3"/>'
      + '<circle cx="12" cy="12" r="10" fill="none" style="stroke:' + f + '" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + (u * p / 100).toFixed(2) + ' ' + u.toFixed(2) + '" transform="rotate(-90 12 12)"/></svg>'
      + '<span>Ziel ' + Math.round(z.gesamt) + ' %</span>';
  }
  function oeffnen() {
    try {
      var doc = global.document, t = doc.querySelector('.tab[data-target-sec="s5"]');
      if (t) t.click();
      setTimeout(function () {
        var b = doc.querySelector('.dp-pa-tab[onclick*="\'si\'"]');
        if (b && typeof global._dpPaTab === 'function') global._dpPaTab('si', b);
      }, 350);
    } catch (e) {}
  }

  if (global.addEventListener) {
    global.addEventListener('dp:object-ready', function () { setTimeout(kopfRing, 1500); setTimeout(kopfRing, 4000); });
    global.addEventListener('dp:potenzial', function () { setTimeout(kopfRing, 200); });
    global.addEventListener('dp:mb-ready', function () { setTimeout(kopfRing, 200); });
  }

  global.DpJahresstaende = {
    VERSION: VERSION, AB_VERSION: AB_VERSION, ZIEL_RING_IM_KOPF: ZIEL_RING_IM_KOPF, RECHENKERNE: RECHENKERNE,
    rechenstand: rechenstand, rechenstandSatz: rechenstandSatz, festschreibAnhang: festschreibAnhang, planJetzt: planJetzt,
    kennzahlen: kennzahlen, neuerStand: neuerStand, einfuegen: einfuegen, beimSpeichern: beimSpeichern, liste: liste, festhalten: festhalten,
    rechne: rechne, sammeln: sammeln, zielerreichung: zielerreichung, payload: payload,
    html: html, tabelleHtml: tabelleHtml, mount: mount, kopfRing: kopfRing
  };
})(window);
