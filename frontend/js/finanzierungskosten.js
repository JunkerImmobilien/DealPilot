/* ═══ v3992 · DISAGIO UND BEREITSTELLUNGSZINSEN JE DARLEHEN ═══════════════════
 *
 * Marcel 23.11.2026 (Gesamt-Flow F6): Disagio (Auszahlungskurs) und
 * Bereitstellungszinsen sollen erfasst und eingerechnet werden können, erst ab
 * Detailgrad Experte und für ALLE Darlehen (I, II und die weiteren). Die
 * Sondertilgung ist dagegen nur ein vertragliches Recht und wird NICHT
 * eingerechnet (Feld d1_st_pct/d2_st_pct ist reine Angabe).
 *
 * DIESE DATEI IST EIN RECHENKERN. Sie liest kein DOM, keine Einstellung, kein
 * localStorage. calc.js reicht die Darlehen als Liste herein und bekommt je
 * Kalenderjahr zurück, was Steuer und Cashflow trifft. Ohne Eingabe (Kurs leer
 * oder 100, kein Bereitstellungszins) ist alles 0 und kein Ergebnis ändert sich.
 *
 * Eingabe je Darlehen:
 *   { name, betrag (Nennbetrag €), kurs (Auszahlungskurs %, leer = 100),
 *     bindj (Zinsbindung Jahre), aus ('MM.JJJJ' | 'TT.MM.JJJJ' | ISO, Auszahlung),
 *     zusage (Vertragsdatum, Beginn der bereitstellungsfreien Zeit),
 *     bz_frei (bereitstellungsfreie Monate), bz_satz (% je Monat) }
 *
 * DISAGIO (Damnum) · Nennbetrag × (100 − Kurs) %. Es mindert die Auszahlung,
 *   der Rest kommt aus Eigenkapital (cf im Jahr der Auszahlung). Zins, Rate und
 *   Restschuld laufen auf den Nennbetrag weiter (so rechnet die Bank).
 *   Steuer: Werbungskosten (Schuldzinsen, § 9 Abs. 1 S. 3 Nr. 1 EStG).
 *   Sofort im Jahr der Auszahlung, wenn marktüblich: höchstens 5 % bei einer
 *   Zinsbindung von mindestens 5 Jahren (§ 11 Abs. 2 S. 4 EStG, BMF-Schreiben
 *   vom 20.10.2003, BStBl I 2003, 546, Rz. 15). Sonst verteilt über die
 *   Zinsbindung, Monat für Monat ab Auszahlung (§ 11 Abs. 2 S. 3 EStG).
 * BEREITSTELLUNGSZINSEN · Nennbetrag × Satz je Monat für jeden Monat zwischen
 *   Ende der bereitstellungsfreien Zeit (Zusage + frei) und Auszahlung. Gerechnet
 *   wird mit voller Auszahlung zum Auszahlungstermin (Teilauszahlungen kennt der
 *   Kern nicht). Steuer: Werbungskosten im Jahr der Zahlung, Cashflow ebenso.
 *
 * Jahre vor `abJahr` (Beginn der Projektion) werden auf abJahr gelegt, damit
 * nichts verloren geht (vorab entstandene Werbungskosten).
 * ═══════════════════════════════════════════════════════════════════════════ */
window.DpFinanzierungskosten = (function () {
  'use strict';

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

  /* Monat aus 'MM.JJJJ', 'TT.MM.JJJJ', 'JJJJ-MM(-TT)' → Index j*12 + (m-1), sonst null */
  function monat(s) {
    s = String(s == null ? '' : s).trim(); var m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})/))) return +m[1] * 12 + (+m[2] - 1);
    if ((m = s.match(/^\d{1,2}\.(\d{1,2})\.(\d{4})$/))) return +m[2] * 12 + (+m[1] - 1);
    if ((m = s.match(/^(\d{1,2})[.\/](\d{4})$/))) return +m[2] * 12 + (+m[1] - 1);
    return null;
  }
  function jahrVon(idx) { return Math.floor(idx / 12); }

  function einDarlehen(e, opt) {
    var betrag = zahl(e.betrag) || 0;
    var r = { name: e.name || '', dw: e.dw != null ? e.dw : null, betrag: betrag, kurs: null, disagio: 0, disagio_pct: 0, auszahlung_eur: betrag,
      sofort: null, disagio_jahre: null, bz_monate: 0, bz_eur: 0, bz_monat_eur: 0, jahre: {}, fehlt: [] };
    if (!(betrag > 0)) return r;
    var aus = monat(e.aus);
    if (aus == null && opt.ausErsatz != null) aus = opt.ausErsatz;
    var add = function (jahr, feld, eur) {
      if (!(eur > 0)) return;
      if (opt.abJahr && jahr < opt.abJahr) jahr = opt.abJahr;
      var z = r.jahre[jahr] || (r.jahre[jahr] = { disagio_wk: 0, bz_wk: 0, cf: 0 });
      z[feld] += eur;
    };
    /* Disagio */
    var kurs = zahl(e.kurs);
    if (kurs != null && kurs > 0 && kurs < 100) {
      r.kurs = kurs; r.disagio_pct = Math.round((100 - kurs) * 1000) / 1000;
      r.disagio = betrag * (100 - kurs) / 100; r.auszahlung_eur = betrag - r.disagio;
      var bindj = zahl(e.bindj); bindj = bindj > 0 ? Math.round(bindj) : 10;
      r.sofort = r.disagio_pct <= 5 + 1e-9 && bindj >= 5;
      if (aus == null) r.fehlt.push('aus');
      else {
        add(jahrVon(aus), 'cf', r.disagio);
        if (r.sofort) { add(jahrVon(aus), 'disagio_wk', r.disagio); r.disagio_jahre = 1; }
        else {
          var n = bindj * 12, je = r.disagio / n;
          for (var k = 0; k < n; k++) add(jahrVon(aus + k), 'disagio_wk', je);
          r.disagio_jahre = bindj;
        }
      }
    }
    /* Bereitstellungszinsen */
    var satz = zahl(e.bz_satz), frei = zahl(e.bz_frei);
    if (satz > 0) {
      var zus = monat(e.zusage);
      frei = frei > 0 ? Math.round(frei) : 0;
      if (zus == null) r.fehlt.push('zusage');
      if (aus == null) r.fehlt.push('aus');
      if (zus != null && aus != null) {
        r.bz_monat_eur = betrag * satz / 100;
        for (var mi = zus + frei; mi < aus; mi++) { r.bz_monate++; add(jahrVon(mi), 'bz_wk', r.bz_monat_eur); add(jahrVon(mi), 'cf', r.bz_monat_eur); }
        r.bz_eur = r.bz_monate * r.bz_monat_eur;
      }
    }
    r.fehlt = r.fehlt.filter(function (x, i, a) { return a.indexOf(x) === i; });
    return r;
  }

  /* liste: Darlehen wie oben · opt: { abJahr, ausErsatz (Monatsindex, wenn ein Darlehen keinen Termin hat) }
     → { liste: [...], jahre: { JJJJ: { disagio_wk, bz_wk, wk, cf } }, disagio, bz } */
  function berechnen(liste, opt) {
    opt = opt || {};
    var aus = { liste: [], jahre: {}, disagio: 0, bz: 0 };
    (Array.isArray(liste) ? liste : []).forEach(function (e) {
      if (!e) return;
      var r = einDarlehen(e, opt); aus.liste.push(r);
      aus.disagio += r.disagio; aus.bz += r.bz_eur;
      Object.keys(r.jahre).forEach(function (j) {
        var z = aus.jahre[j] || (aus.jahre[j] = { disagio_wk: 0, bz_wk: 0, wk: 0, cf: 0 });
        z.disagio_wk += r.jahre[j].disagio_wk; z.bz_wk += r.jahre[j].bz_wk; z.cf += r.jahre[j].cf;
        z.wk = z.disagio_wk + z.bz_wk;
      });
    });
    return aus;
  }

  /* Kundentext je Darlehen (ohne Gedankenstrich und Semikolon) */
  function text(r) {
    if (!r) return '';
    var eur = function (n) { return Math.round(n || 0).toLocaleString('de-DE') + ' €'; };
    var t = [];
    if (r.disagio > 0) {
      t.push('Auszahlung ' + eur(r.auszahlung_eur) + ' (Kurs ' + String(r.kurs).replace('.', ',') + ' %). Das Disagio von ' + eur(r.disagio) + ' kommt aus Eigenkapital.');
      if (r.fehlt.indexOf('aus') >= 0 && r.disagio_jahre == null) t.push('Ohne Auszahlungstermin ist es noch nicht eingerechnet.');
      else t.push(r.sofort ? 'Steuerlich sofort abziehbar im Jahr der Auszahlung (marktüblich bis 5 % bei mindestens 5 Jahren Zinsbindung).'
        : 'Steuerlich verteilt über ' + r.disagio_jahre + ' Jahre Zinsbindung (mehr als 5 % oder kürzere Zinsbindung).');
    }
    if (r.bz_monate > 0) t.push('Bereitstellungszinsen ' + r.bz_monate + ' Monate × ' + eur(r.bz_monat_eur) + ' = ' + eur(r.bz_eur) + ', Werbungskosten im Jahr der Zahlung.');
    else if (r.fehlt.indexOf('zusage') >= 0) t.push('Bereitstellungszinsen brauchen das Vertragsdatum (Bankdaten) und den Auszahlungstermin.');
    else if (r.fehlt.indexOf('aus') >= 0 && !(r.disagio > 0)) t.push('Bereitstellungszinsen brauchen den Auszahlungstermin.');
    return t.join(' ');
  }

  return { berechnen: berechnen, einDarlehen: einDarlehen, monat: monat, text: text, zahl: zahl };
})();
