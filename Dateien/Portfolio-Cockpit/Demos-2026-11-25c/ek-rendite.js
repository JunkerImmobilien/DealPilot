/* v4610 · EK-Rendite in vier Kennzahlen (Marcel 25.11.2026). v4620 · Hebeleffekt hebel().
 *
 * EINE Stelle rechnet alle vier, jede Anzeige liest von hier:
 *   1  operativ                       (Überschuss + Tilgung) / EK
 *   2  nach Steuer                    (Überschuss + Tilgung - Steuer) / EK   (Steuer negativ = Erstattung)
 *   3  vor Steuer mit Vermögensdelta  (Überschuss + Tilgung + Delta p.a.) / EK
 *   4  nach Steuer mit Vermögensdelta (Überschuss nach Steuer + Tilgung + Delta p.a.) / EK   HAUPTKENNZAHL
 *
 * Überschuss = Cashflow vor Steuer NACH Kapitaldienst (calc.js cf_op). Tilgung und
 * Bauspar-Sparrate sind Vermögensaufbau und zählen deshalb wieder dazu.
 *
 * Vermögensdelta (Marcel: „Differenz ursprüngliches Darlehen zur aktuellen Bewertung“):
 *   Bestand  = aktuelle Bewertung - ursprüngliches Darlehen - eingesetztes EK
 *            = aktuelle Bewertung - Gesamtfinanzierung (Kaufpreis + Nebenkosten + Sanierung).
 *   Der Bestand ist keine Jahresgröße. Für die Jahresrendite gilt:
 *     - liegen zwischen Übergang und Bewertungsstichtag mindestens 12 Monate:
 *       Delta je Haltejahr (tatsächliche Entwicklung seit Kauf),
 *     - sonst (Ankauf, frischer Kauf, Bewertung zum Kaufzeitpunkt):
 *       Bewertung x Wertsteigerungsannahme (erstes Jahr); das einmalige Delta
 *       (Einkaufsvorteil oder Nebenkosten) steht nur in der Übersicht.
 *
 * Ein Kern liest NIE Einstellungen oder DOM: alles kommt als Parameter.
 */
(function (root) {
  'use strict';
  function zahl(x) { var n = Number(x); return (x == null || x === '' || !isFinite(n)) ? null : n; }
  function jahreZwischen(a, b) {
    var da = a ? new Date(String(a).slice(0, 10)) : null, db = b ? new Date(String(b).slice(0, 10)) : null;
    if (!da || !db || isNaN(da) || isNaN(db)) return null;
    return (db - da) / (365.25 * 864e5);
  }

  /* p = { cf_op, steuer, tilg, bspar, ek, wert, darlehen0, uebergang, stichtag, wstg } */
  function rechne(p) {
    p = p || {};
    var ek = zahl(p.ek), cf = zahl(p.cf_op);
    if (ek == null || ek <= 100 || cf == null) return null;
    var tilg = Math.max(0, zahl(p.tilg) || 0), bspar = Math.max(0, zahl(p.bspar) || 0);
    var steuer = zahl(p.steuer) || 0;                 /* positiv = Nachzahlung, negativ = Erstattung */
    var aufbau = tilg + bspar;
    var basis1 = cf + aufbau, basis2 = cf - steuer + aufbau;

    var wert = zahl(p.wert), d0 = zahl(p.darlehen0) || 0, wstg = zahl(p.wstg) || 0;
    var delta = null, deltaPa = null, weg = null, jahre = null;
    if (wert != null && wert > 0) {
      delta = wert - d0 - ek;
      jahre = jahreZwischen(p.uebergang, p.stichtag);
      if (jahre != null && jahre >= 1) { deltaPa = delta / jahre; weg = 'seit_kauf'; }
      else { deltaPa = wert * wstg; weg = 'annahme'; }
    }
    function pct(x) { return x == null ? null : x / ek * 100; }
    var r = {
      ek: ek, cf_op: cf, steuer: steuer, tilg: tilg, bspar: bspar,
      wert: wert, darlehen0: d0, delta: delta, delta_pa: deltaPa, delta_weg: weg, haltejahre: jahre, wstg: wstg,
      k1: pct(basis1), k2: pct(basis2),
      k3: deltaPa == null ? null : pct(basis1 + deltaPa),
      k4: deltaPa == null ? null : pct(basis2 + deltaPa)
    };
    r.haupt = r.k4 != null ? r.k4 : r.k2;           /* ohne Bewertung: nach Steuer ohne Delta */
    r.haupt_art = r.k4 != null ? 'k4' : 'k2';
    return r;
  }

  /* Portfolio: EK-gewichtet = Summe der Euro-Größen / Summe EK */
  function portfolio(liste) {
    var s = { ek: 0, b1: 0, b2: 0, b3: 0, b4: 0, n3: 0 };
    (liste || []).forEach(function (r) {
      if (!r || !(r.ek > 0)) return;
      s.ek += r.ek; s.b1 += r.k1 * r.ek / 100; s.b2 += r.k2 * r.ek / 100;
      if (r.k4 != null) { s.b3 += r.k3 * r.ek / 100; s.b4 += r.k4 * r.ek / 100; s.n3++; }
      else { s.b3 += r.k1 * r.ek / 100; s.b4 += r.k2 * r.ek / 100; }
    });
    if (!(s.ek > 0)) return null;
    var out = { ek: s.ek, k1: s.b1 / s.ek * 100, k2: s.b2 / s.ek * 100, k3: s.b3 / s.ek * 100, k4: s.b4 / s.ek * 100,
             haupt: s.b4 / s.ek * 100, haupt_art: 'k4', mit_delta: s.n3, portfolio: true, anzahl: (liste || []).filter(function (r) { return r && r.ek > 0; }).length };
    /* v4620 · Hebel des Bestands: Euro-Summen der Objekte, die ihre Hebel-Eingaben tragen */
    var hs = { gi: 0, z: 0, d: 0, ertrag: 0, ek: 0, m2: 0, n: 0 };
    (liste || []).forEach(function (r) {
      if (!r || !(r.ek > 0) || !r.hebel_in || !r.hebel) return;
      var hi = r.hebel_in; if (!(hi.gi > 0) || !(hi.darlehen > 0) || hi.zins_j == null) return;
      hs.gi += hi.gi; hs.z += hi.zins_j; hs.d += hi.darlehen; hs.ek += r.ek; hs.n++;
      hs.ertrag += r.cf_op + hi.zins_j + r.tilg + r.bspar + (r.delta_pa == null ? 0 : r.delta_pa);
      hs.m2 += (r.hebel.wert_minus2 == null ? (r.k2 || 0) : r.hebel.wert_minus2) * r.ek / 100;
    });
    if (hs.n && hs.gi > 0 && hs.d > 0) {
      var gkr = hs.ertrag / hs.gi * 100, fkz = hs.z / hs.d * 100;
      out.hebel = { gkr: gkr, fk_zins: fkz, richtung: gkr >= fkz ? 'positiv' : 'negativ', verschuldung: hs.d / hs.ek,
                    kipp_zins: gkr, wert_minus2: hs.m2 / hs.ek * 100, objekte: hs.n };
    }
    return out;
  }

  /* v4620 · Hebeleffekt (Marcel 25.11.2026: „auch wenn das in die andere Richtung geht“).
     h = { gi, zins_j, darlehen, zins_anschluss }  (zins_anschluss in % p.a., optional)
     Gesamtkapitalrendite = (Überschuss + Zins + Tilgung/Bausparen + Delta p.a.) / Gesamtinvest,
     also das, was das Objekt ohne Finanzierung im Jahr erwirtschaftet. Liegt sie über dem
     Darlehenszins, hebt das Fremdkapital die EK-Rendite (positiv), liegt sie darunter, drückt es sie.
     Sensitivitäten rechnen NUR über rechne(), nichts doppelt. */
  function hebel(r, h) {
    if (!r || !h) return null;
    var gi = zahl(h.gi), zj = zahl(h.zins_j), dar = zahl(h.darlehen);
    if (gi == null || gi <= 0 || zj == null || dar == null || dar <= 0) return null;
    var dpa = r.delta_pa == null ? 0 : r.delta_pa;
    var gkr = (r.cf_op + zj + r.tilg + r.bspar + dpa) / gi * 100;
    var fkz = zj / dar * 100;
    /* Delta je Jahr als Satz auf den Wert: so rechnet rechne() über den Annahme-Weg genau dasselbe Delta */
    var wstgIst = (r.wert != null && r.wert > 0 && r.delta_pa != null) ? r.delta_pa / r.wert : (r.wstg || 0);
    function mit(over) {
      var p = { cf_op: r.cf_op, steuer: r.steuer, tilg: r.tilg, bspar: r.bspar, ek: r.ek, wert: r.wert,
                darlehen0: r.darlehen0, stichtag: null, wstg: wstgIst }, k;
      for (k in over) p[k] = over[k];
      return rechne(p);
    }
    var out = {
      gkr: gkr, fk_zins: fkz, richtung: gkr >= fkz ? 'positiv' : 'negativ',
      verschuldung: r.ek > 0 ? dar / r.ek : null,
      kipp_zins: gkr                       /* Darlehenszins, ab dem der Hebel negativ wird */
    };
    if (r.wert != null && r.wert > 0) {
      var s = mit({ wstg: -0.02 });                     /* Wert fällt 2 % im Jahr */
      out.wert_minus2 = s ? s.k4 : null;
      out.kipp_wert = -(r.cf_op - r.steuer + r.tilg + r.bspar) / r.wert * 100;   /* Wertänderung p.a., bei der Stufe 4 null wird */
    }
    var za = zahl(h.zins_anschluss);
    if (za != null && za > fkz + 0.05) {
      var mehr = dar * (za - fkz) / 100;               /* Mehrzins im Jahr, auf das heutige Darlehen gerechnet */
      var sz = mit({ cf_op: r.cf_op - mehr });
      out.zins_anschluss = za; out.mehrzins = mehr; out.ekr_anschluss = sz ? (sz.k4 != null ? sz.k4 : sz.k2) : null;
    }
    return out;
  }
  function hebelZeilen(hb) {
    if (!hb) return [];
    var z = [];
    z.push('Hebel ' + hb.richtung + ': Das Objekt erwirtschaftet ' + fP(hb.gkr) + ' auf das ganze Investment, das Darlehen kostet ' + fP(hb.fk_zins) + '.');
    z.push(hb.richtung === 'positiv'
      ? 'Jeder Euro Darlehen bringt mehr, als er kostet. Darum liegt die EK-Rendite über ' + fP(hb.gkr) + '.'
      : 'Das Darlehen kostet mehr, als das Objekt damit verdient. Darum liegt die EK-Rendite unter ' + fP(hb.gkr) + '.');
    if (hb.verschuldung != null) z.push('Auf 1 € Eigenkapital kommen ' + hb.verschuldung.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' € Darlehen. Der Hebel wirkt in beide Richtungen gleich stark.');
    if (hb.wert_minus2 != null) z.push('Fällt der Wert 2 % im Jahr, läge die EK-Rendite bei ' + fP(hb.wert_minus2) + '.');
    if (hb.kipp_wert != null) z.push(hb.kipp_wert < 0 ? 'Negativ wird sie erst, wenn der Wert mehr als ' + fP(-hb.kipp_wert) + ' im Jahr fällt.' : 'Ohne Wertsteigerung von mindestens ' + fP(hb.kipp_wert) + ' im Jahr ist sie negativ.');
    if (hb.ekr_anschluss != null) z.push('Mit ' + fP(hb.zins_anschluss) + ' Anschlusszins (' + fE(hb.mehrzins) + ' mehr Zins im Jahr, vor Steuerwirkung) läge sie bei ' + fP(hb.ekr_anschluss) + '.');
    z.push('Der Hebel kippt, wenn der Darlehenszins über ' + fP(hb.kipp_zins) + ' steigt.');
    return z;
  }

  /* Tooltip-Text (Kundentext: keine Gedankenstriche, keine Semikolons) */
  function fE(x) { return x == null ? 'k. A.' : Math.round(x).toLocaleString('de-DE') + ' €'; }
  function fP(x) { return x == null ? 'k. A.' : x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'; }
  function tooltip(r) {
    if (!r) return '';
    var st = r.steuer > 0 ? 'Steuernachzahlung ' + fE(r.steuer) : 'Steuererstattung ' + fE(-r.steuer);
    var dz = r.delta_pa == null ? 'ohne Bewertung kein Vermögensdelta'
      : (r.delta_weg === 'seit_kauf'
        ? 'Vermögensdelta ' + fE(r.delta) + ' (Bewertung ' + fE(r.wert) + ' minus Darlehen bei Kauf ' + fE(r.darlehen0) + ' minus Eigenkapital ' + fE(r.ek) + '), verteilt auf ' + r.haltejahre.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Jahre = ' + fE(r.delta_pa) + ' im Jahr'
        : 'Vermögensdelta im Jahr ' + fE(r.delta_pa) + ' (Bewertung ' + fE(r.wert) + ' mal ' + fP(r.wstg * 100) + ' Wertsteigerung). Einmalig heute ' + fE(r.delta) + ' (Bewertung minus Darlehen minus Eigenkapital)');
    return [
      'EK-Rendite in vier Stufen, Eigenkapital ' + fE(r.ek),
      '1 Operativ ' + fP(r.k1) + ': Überschuss ' + fE(r.cf_op) + ' plus Tilgung ' + fE(r.tilg + r.bspar),
      '2 Nach Steuer ' + fP(r.k2) + ': wie 1 mit ' + st,
      '3 Mit Vermögensdelta ' + fP(r.k3) + ': wie 1 plus ' + (r.delta_pa == null ? 'k. A.' : fE(r.delta_pa)),
      '4 Nach Steuer mit Vermögensdelta ' + fP(r.k4) + ': wie 2 plus ' + (r.delta_pa == null ? 'k. A.' : fE(r.delta_pa)) + ' (Hauptkennzahl)',
      dz
    ].concat(hebelZeilen(r.hebel)).join('\n');
  }

  var api = { rechne: rechne, portfolio: portfolio, tooltip: tooltip, hebel: hebel, hebelZeilen: hebelZeilen, version: 'v4620' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DpEkRendite = api;
})(typeof window !== 'undefined' ? window : globalThis);
