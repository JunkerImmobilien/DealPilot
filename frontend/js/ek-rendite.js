/* v4610 · EK-Rendite in vier Kennzahlen (Marcel 25.11.2026).
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
    return { ek: s.ek, k1: s.b1 / s.ek * 100, k2: s.b2 / s.ek * 100, k3: s.b3 / s.ek * 100, k4: s.b4 / s.ek * 100,
             haupt: s.b4 / s.ek * 100, mit_delta: s.n3 };
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
    ].join('\n');
  }

  var api = { rechne: rechne, portfolio: portfolio, tooltip: tooltip, version: 'v4610' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DpEkRendite = api;
})(typeof window !== 'undefined' ? window : globalThis);
