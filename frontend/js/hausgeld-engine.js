/* hausgeld-engine.js — zentrale Hausgeld-Schaetzung (Single Source of Truth)
   Marker dpfk-hg-v1.
   Fachlich: In DE gibt es KEINE offizielle Formel/Statistik fuers Hausgeld; jede WEG legt es
   individuell fest. Daher Schaetzung ueber marktuebliche Richtwerte je Wohnflaeche, NICHT ueber
   den Kaufpreis. Echte Werte (Inserat / Nutzereingabe) haben immer Vorrang vor der Schaetzung.
   Richtwerte sind zentral in Hausgeld.CONFIG konfigurierbar.

   Verbraucher (analog window.Dscr.compute()): Investmentprofil getHausgeldMonthly, QC-Defaults,
   qcSaveAsObject. Alle sollen kuenftig window.Hausgeld.estimate() nutzen statt eigener Formeln. */
(function () {
  'use strict';

  var CONFIG = {
    /* Richtwerte €/m² je Baujahr-Bereich (ab Jahr absteigend geprueft). std = Standardwert. */
    richtwerte: [
      { abJahr: 2015, min: 2.50, max: 3.00, std: 2.75 },
      { abJahr: 2000, min: 3.00, max: 3.50, std: 3.25 },
      { abJahr: 1980, min: 3.50, max: 4.50, std: 4.00 },
      { abJahr: 0,    min: 4.00, max: 6.00, std: 5.00 }   /* vor 1980 */
    ],
    stdOhneBaujahr: 3.50,
    zuschlag: {
      aufzug: 0.30,
      tiefgarage: 0.20,
      gemeinschaft: 0.75,          /* Bereich +0.50..+1.00, Standard 0.75 */
      gemeinschaftMin: 0.50,
      gemeinschaftMax: 1.00
    },
    abschlag: { energieAB: 0.20 },   /* Energieeffizienzklasse A oder B */
    /* Schaetzung wird auf diesen Faktor-Bereich begrenzt (nur wenn KEIN echter Wert vorliegt). */
    clampMin: 2.00,
    clampMax: 8.00,
    /* Plausibilitaets-Schwellen (Faktor €/m²): <niedrigUnter / .. / >erhoehtBis */
    plausibilitaet: { niedrigUnter: 2.00, normalBis: 5.00, erhoehtBis: 7.00 },
    /* Fallback ueber Kaufpreis (ungenau): jaehrlich = KP * satz. */
    kaufpreisSatzPA: 0.012,          /* 1,2 % p.a. */
    /* Wenn Inserat- UND Nutzerwert vorliegen: 'zuletzt' = zuletzt geaenderter gewinnt (per Ts),
       'eingabe'/'inserat' = feste Praeferenz. Fallback ohne Timestamps = tieBreakFallback. */
    konflikt: 'zuletzt',
    tieBreakFallback: 'eingabe'
  };

  function num(v) {
    if (v == null) return NaN;
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v).trim().replace(/[^\d,.\-]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') !== -1) { s = s.replace(/\./g, '').replace(',', '.'); }
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function fmtEur(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ','); }
  function fmtFlae(n) { var r = Math.round(n * 10) / 10; return (r % 1 === 0 ? String(r) : r.toFixed(1).replace('.', ',')); }

  function richtwertFuerBaujahr(bj) {
    var j = num(bj);
    if (!isFinite(j) || j <= 0) return null;          /* kein Baujahr */
    var arr = CONFIG.richtwerte;
    for (var i = 0; i < arr.length; i++) { if (j >= arr[i].abJahr) return arr[i]; }
    return arr[arr.length - 1];
  }

  function plaus(faktor) {
    var p = CONFIG.plausibilitaet, key, label, hint = null;
    if (faktor < p.niedrigUnter)      { key = 'niedrig'; label = 'ungewoehnlich niedrig'; hint = 'Ungewoehnlich niedriges Hausgeld \u2014 bitte pruefen.'; }
    else if (faktor <= p.normalBis)   { key = 'normal';  label = 'normaler Bereich'; }
    else if (faktor <= p.erhoehtBis)  { key = 'erhoeht'; label = 'erhoehter Bereich'; }
    else                              { key = 'hoch';    label = 'aussergewoehnlich hoch'; hint = 'Aussergewoehnlich hohe Kosten moeglich (z. B. hohe Ruecklagenbildung oder besondere Ausstattung).'; }
    return { key: key, label: label, faktor: round2(faktor), hint: hint };
  }

  function istEnergieAB(ek) {
    if (!ek) return false;
    var c = String(ek).trim().toUpperCase().charAt(0);
    return c === 'A' || c === 'B';
  }

  function basisErgebnis(monatlich, wfl, methode, isEstimate) {
    return {
      monatlich: round2(monatlich),
      jaehrlich: round2(monatlich * 12),
      methode: methode,                                /* 'inserat'|'eingabe'|'wohnflaeche'|'kaufpreis'|'keine' */
      isEstimate: !!isEstimate,
      ungenau: false,
      faktor: (isFinite(wfl) && wfl > 0) ? round2(monatlich / wfl) : null,
      grundlageText: '',
      plausibilitaet: null
    };
  }

  function estimate(opts) {
    opts = opts || {};
    var wfl = num(opts.wohnflaeche);
    var kp  = num(opts.kaufpreis);
    var inserat = num(opts.inseratHausgeld);
    var eigen   = num(opts.userHausgeld);
    var eigenOk   = isFinite(eigen) && eigen > 0;
    var inseratOk = isFinite(inserat) && inserat > 0;

    /* Prioritaet 1/2: echte Werte schlagen die Schaetzung. Bei Konflikt (beide vorhanden)
       entscheidet CONFIG.konflikt='zuletzt' der spaeter geaenderte Wert (per Timestamp). */
    if (eigenOk || inseratOk) {
      var pick;
      if (eigenOk && inseratOk) {
        if (CONFIG.konflikt === 'eingabe' || CONFIG.konflikt === 'inserat') {
          pick = CONFIG.konflikt;
        } else {
          var te = num(opts.userHausgeldTs), ti = num(opts.inseratHausgeldTs);
          if (isFinite(te) || isFinite(ti)) {
            pick = ((isFinite(te) ? te : -Infinity) >= (isFinite(ti) ? ti : -Infinity)) ? 'eingabe' : 'inserat';
          } else {
            pick = CONFIG.tieBreakFallback;   /* keine Timestamps -> Default */
          }
        }
      } else {
        pick = eigenOk ? 'eingabe' : 'inserat';
      }
      var val = (pick === 'eingabe') ? eigen : inserat;
      var rr = basisErgebnis(val, wfl, pick, false);
      rr.grundlageText = (pick === 'eingabe')
        ? ('Hausgeld manuell eingegeben: ' + Math.round(rr.monatlich) + ' \u20ac/Monat')
        : ('Hausgeld aus Inserat \u00fcbernommen: ' + Math.round(rr.monatlich) + ' \u20ac/Monat');
      if (rr.faktor != null) rr.plausibilitaet = plaus(rr.faktor);
      return rr;
    }

    /* Prioritaet 3: Schaetzung ueber Wohnflaeche. */
    if (isFinite(wfl) && wfl > 0) {
      var rw = richtwertFuerBaujahr(opts.baujahr);
      var faktor = rw ? rw.std : CONFIG.stdOhneBaujahr;
      if (opts.aufzug)     faktor += CONFIG.zuschlag.aufzug;
      if (opts.tiefgarage) faktor += CONFIG.zuschlag.tiefgarage;
      if (opts.gemeinschaft) {
        faktor += (typeof opts.gemeinschaft === 'number')
          ? Math.min(Math.max(opts.gemeinschaft, CONFIG.zuschlag.gemeinschaftMin), CONFIG.zuschlag.gemeinschaftMax)
          : CONFIG.zuschlag.gemeinschaft;
      }
      if (istEnergieAB(opts.energieklasse)) faktor -= CONFIG.abschlag.energieAB;

      var clamped = Math.min(Math.max(faktor, CONFIG.clampMin), CONFIG.clampMax);
      var monatlich = round2(wfl * clamped);
      var res = basisErgebnis(monatlich, wfl, 'wohnflaeche', true);
      res.faktor = round2(clamped);
      res.faktorRoh = round2(faktor);
      res.baujahrBereich = rw || null;
      res.grundlageText = 'Gesch\u00e4tztes Hausgeld: ' + Math.round(monatlich) + ' \u20ac/Monat ('
        + fmtFlae(wfl) + ' m\u00b2 \u00d7 ' + fmtEur(clamped) + ' \u20ac/m\u00b2)';
      res.plausibilitaet = plaus(clamped);
      return res;
    }

    /* Prioritaet 4: Fallback ueber Kaufpreis (ungenau). */
    if (isFinite(kp) && kp > 0) {
      var m = round2((kp * CONFIG.kaufpreisSatzPA) / 12);
      var r = basisErgebnis(m, NaN, 'kaufpreis', true);
      r.ungenau = true;
      r.grundlageText = 'Hausgeld gesch\u00e4tzt anhand des Kaufpreises, da keine Fl\u00e4chenangabe vorhanden war.';
      r.plausibilitaet = { key: 'kaufpreis', label: 'kaufpreisbasierte Schaetzung (ungenau)', faktor: null,
        hint: 'Hausgeld haengt normalerweise nicht vom Kaufpreis ab \u2014 nur grobe Annaeherung.' };
      return r;
    }

    var leer = basisErgebnis(NaN, NaN, 'keine', true);
    leer.grundlageText = 'Kein Hausgeld berechenbar (weder Wohnfl\u00e4che noch Kaufpreis).';
    return leer;
  }

  window.Hausgeld = {
    estimate: estimate,
    CONFIG: CONFIG,
    _plaus: plaus,
    _richtwert: richtwertFuerBaujahr,
    _num: num
  };
})();
