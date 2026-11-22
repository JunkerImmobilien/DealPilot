/* teamplatz-staffel.js · v3947 — DIE EINE QUELLE der Teamplatz-Preise (Marcel 22.11.2026)
 *
 * Ein Teamplatz ist ein weiterer Login im Partnerkonto (Berater der Kanzlei). Der Inhaber ist im
 * Partner-Plan enthalten (99 € im Monat). Entscheidung Marcel 22.11.2026, je 20 € über dem Vorschlag A
 * (Dateien/Mandantenkonzept/Teamplaetze-Preisvorschlag-2026-11-19.html):
 *
 *     Login            Monat    Jahr (11 Monatsbeiträge, „ein Monat frei“, wie Partner-Plan 99 → 1.089)
 *     2. bis 4.          59 €    649 €
 *     5. bis 9.          49 €    539 €
 *     ab dem 10.         39 €    429 €
 *
 * Abgerechnet als EIN Stripe-Preis je Intervall, tiers_mode 'graduated' (jeder Platz zum Satz SEINER Stufe,
 * anders als die Kundenplätze mit 'volume'), Menge = Teamplätze ohne Inhaber. Die Stripe-Stufe zählt die
 * Teamplätze, nicht die Logins: up_to = bis_login − 1.
 *
 * Wer liest diese Datei:
 *   frontend/index.html                    Preisfenster (partner-plan-kauf.js) und Partner-Cockpit (partner-kunden.js)
 *   frontend/landing/teamplatz-rechner.js  Landing preise.html › Partner › Teamplätze (lädt sie vom App-Host)
 *   tools/stripe-teamplatz-preis-anlegen.mjs  legt die zwei Stripe-Preise aus GENAU diesen Stufen an
 *   tools/teamplatz-pruefen.mjs            Hand-Tabelle, Landing-Rückfall, Stripe-Skript, Gegenproben
 * Das Backend rechnet nicht mit dieser Datei, es liest die Stufen aus Stripe (partnerPlanKauf.angebot()).
 * Kein Kern im Sinne von CLAUDE.md (wird nicht ins Backend-Image gespiegelt), liest keine Einstellungen.
 * Preise ändern = hier ändern, neue Version, Stripe-Skript mit neuem lookup_key, Prüfer laufen lassen.
 */
(function (root, fabrik) {
  var api = fabrik();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DpTeamplatz = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var STUFEN = [
    { von_login: 2,  bis_login: 4,    monat: 59, jahr: 649 },
    { von_login: 5,  bis_login: 9,    monat: 49, jahr: 539 },
    { von_login: 10, bis_login: null, monat: 39, jahr: 429 }
  ];
  var FREIMONATE = 1;   /* Jahr = (12 − 1) Monatsbeiträge, Prüfer hält es fest */
  var LOOKUP = { monthly: 'dp_teamplatz_monat', yearly: 'dp_teamplatz_jahr' };
  var VERSION = 'v3947';

  function iv(x) { return x === 'yearly' || x === 'jahr' || x === 'j' ? 'yearly' : 'monthly'; }
  function feld(x) { return iv(x) === 'yearly' ? 'jahr' : 'monat'; }
  function anzahl(n) { var x = parseInt(n, 10); return Number.isFinite(x) && x > 0 ? x : 0; }

  /** Stufen in Stripe-Form (Cent, up_to in Teamplätzen). */
  function stripeStufen(intervall) {
    var f = feld(intervall);
    return STUFEN.map(function (s) { return { bis: s.bis_login == null ? null : s.bis_login - 1, cent: s[f] * 100 }; });
  }

  /** Graduierte Summe in Cent über beliebige Stufen [{bis, cent}] (bis = letzter Platz der Stufe, null = offen).
   *  Dieselbe Rechnung wie Stripe 'graduated' und partnerPlanKauf.staffelSumme(…, 'graduated'). */
  function summeAusStufen(stufen, plaetze) {
    var n = anzahl(plaetze), rest = n, unten = 0, summe = 0;
    if (!n || !stufen || !stufen.length) return 0;
    for (var i = 0; i < stufen.length && rest > 0; i++) {
      var oben = stufen[i].bis == null ? Infinity : Number(stufen[i].bis);
      var k = Math.max(0, Math.min(rest, oben - unten));
      summe += k * (Number(stufen[i].cent) || 0) + (k > 0 ? (Number(stufen[i].pauschal) || 0) : 0);
      rest -= k; unten = oben;
    }
    return summe;
  }
  /** Satz (Cent) des n-ten Teamplatzes. */
  function satzAusStufen(stufen, platzNr) {
    var n = anzahl(platzNr); if (!n || !stufen || !stufen.length) return 0;
    for (var i = 0; i < stufen.length; i++) { if (stufen[i].bis == null || n <= Number(stufen[i].bis)) return Number(stufen[i].cent) || 0; }
    return Number(stufen[stufen.length - 1].cent) || 0;
  }

  /** Summe der Teamplätze in Euro (ganze Zahl). teamplaetze = Logins ohne Inhaber. */
  function teamSumme(teamplaetze, intervall) { return summeAusStufen(stripeStufen(intervall), teamplaetze) / 100; }
  /** Summe der Teamplätze für eine Zahl Logins MIT Inhaber. */
  function summeLogins(logins, intervall) { return teamSumme(Math.max(0, anzahl(logins) - 1), intervall); }
  /** Satz in Euro für den Login Nr. login (1 = Inhaber = 0, im Partner-Plan). */
  function satzLogin(login, intervall) { var l = anzahl(login); return l <= 1 ? 0 : satzAusStufen(stripeStufen(intervall), l - 1) / 100; }
  /** Niedrigster Satz („weitere Logins ab …“). */
  function ab(intervall) { var f = feld(intervall); return Math.min.apply(null, STUFEN.map(function (s) { return s[f]; })); }
  /** Text der Stufe, z. B. „2. bis 4. Login“ / „ab dem 10. Login“. */
  function stufenName(s) { return s.bis_login == null ? 'ab dem ' + s.von_login + '. Login' : s.von_login + '. bis ' + s.bis_login + '. Login'; }

  return {
    VERSION: VERSION, STUFEN: STUFEN, FREIMONATE: FREIMONATE, LOOKUP: LOOKUP,
    stripeStufen: stripeStufen, summeAusStufen: summeAusStufen, satzAusStufen: satzAusStufen,
    teamSumme: teamSumme, summeLogins: summeLogins, satzLogin: satzLogin, ab: ab, stufenName: stufenName, intervall: iv
  };
});
