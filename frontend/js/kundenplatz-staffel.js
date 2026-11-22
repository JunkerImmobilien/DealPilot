/* kundenplatz-staffel.js · v3960 — DIE EINE QUELLE der Partner-Preise im Frontend (Marcel 22.11.2026)
 *
 * Partner-Plan und Kundenplaetze, so wie Stripe sie abrechnet (gemessen 17.11.2026 in der Sandbox,
 * backend/src/services/partnerPlanKauf.js im Kopf, tools/partner-seats-webhook-pruefen.mjs T_M / T_J):
 *
 *     Partner-Plan            99 € im Monat     1.089 € im Jahr (11 Monatsbeitraege, „ein Monat frei“)
 *     Kundenplatz  1 bis 9    19 €              209 €
 *                 10 bis 24   15 €              165 €
 *                 ab 25       12 €              132 €
 *
 * Kundenplaetze rechnen tiers_mode 'VOLUME': ALLE Plaetze zum Satz der erreichten Stufe (10 Plaetze 150 €,
 * 9 Plaetze 171 €), anders als die Teamplaetze in teamplatz-staffel.js ('graduated').
 *
 * Wer liest diese Datei:
 *   frontend/index.html                   Preisfenster (partner-plan-kauf.js): Rueckfall, solange Stripe nicht
 *                                         geantwortet hat, und Abgleich mit GET /subscription/partner/angebot
 *   frontend/landing/partner-pakete.js    Landing preise.html › Partner & Whitelabel, vier Pakete (laedt sie vom App-Host)
 *   tools/teamplatz-pruefen.mjs           Abschnitt K bis M: gegen partnerPlanKauf.js (lookup_keys, staffelSumme volume),
 *                                         die Sandbox-Messung, partner.html, reseller-portal.js, Landing-Rueckfall
 * Abgerechnet wird IMMER der Stripe-Preis. Das Backend rechnet nicht mit dieser Datei, es liest Stripe.
 * Kein Kern im Sinne von CLAUDE.md (wird nicht ins Backend-Image gespiegelt), liest keine Einstellungen.
 * Preise aendern = in Stripe UND hier, neue Version, Buster ziehen, Pruefer laufen lassen.
 */
(function (root, fabrik) {
  var api = fabrik();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DpKundenplatz = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var PLAN = { monat: 99, jahr: 1089 };
  var STUFEN = [
    { von: 1,  bis: 9,    monat: 19, jahr: 209 },
    { von: 10, bis: 24,   monat: 15, jahr: 165 },
    { von: 25, bis: null, monat: 12, jahr: 132 }
  ];
  var MODUS = 'volume';
  var FREIMONATE = 1;     /* Jahr = (12 − 1) Monatsbeitraege */
  var MAX = 500;          /* = partnerPlanKauf.MAX_PLAETZE */
  var LOOKUP = {
    plan:  { monthly: 'dp_plan_partner_monthly', yearly: 'dp_plan_partner_yearly' },
    platz: { monthly: 'dp_seat_monthly',         yearly: 'dp_seat_yearly' }
  };
  var VERSION = 'v3960';

  function iv(x) { return x === 'yearly' || x === 'jahr' || x === 'j' ? 'yearly' : 'monthly'; }
  function feld(x) { return iv(x) === 'yearly' ? 'jahr' : 'monat'; }
  function anzahl(n) { var x = parseInt(n, 10); return Number.isFinite(x) && x > 0 ? Math.min(MAX, x) : 0; }

  /** Partner-Plan in Euro. */
  function plan(intervall) { return PLAN[feld(intervall)]; }
  /** Stufen in Stripe-Form (Cent, bis = letzter Platz der Stufe, null = offen), wie angebot().platz[iv].stufen. */
  function stripeStufen(intervall) {
    var f = feld(intervall);
    return STUFEN.map(function (s) { return { bis: s.bis, cent: s[f] * 100 }; });
  }
  /** Index der Stufe fuer n Plaetze (n <= 0: erste Stufe). */
  function stufe(n) {
    var x = anzahl(n);
    for (var i = 0; i < STUFEN.length; i++) { if (STUFEN[i].bis == null || x <= STUFEN[i].bis) return i; }
    return STUFEN.length - 1;
  }
  /** Satz je Platz in Euro bei n Plaetzen (Volume: alle zum Satz der erreichten Stufe), 0 bei 0 Plaetzen. */
  function satz(n, intervall) { return anzahl(n) ? STUFEN[stufe(n)][feld(intervall)] : 0; }
  /** Summe der Kundenplaetze in Euro. */
  function summe(n, intervall) { return anzahl(n) * satz(n, intervall); }
  /** Niedrigster Satz („ab 12 €“). */
  function ab(intervall) { var f = feld(intervall); return Math.min.apply(null, STUFEN.map(function (s) { return s[f]; })); }
  /** Text der Stufe, z. B. „1 bis 9 Kunden“ / „ab 25 Kunden“. */
  function stufenName(s) { return s.bis == null ? 'ab ' + s.von + ' Kunden' : s.von + ' bis ' + s.bis + ' Kunden'; }

  /** Stimmen Stripe-Angebot (GET /subscription/partner/angebot) und diese Quelle ueberein? Liefert eine Liste der
   *  Abweichungen (leer = gleich). Das Preisfenster zeigt bei Abweichung den Stripe-Preis (der wird abgebucht). */
  function abweichungen(a) {
    var abw = [];
    if (!a || !a.plan || !a.platz) return ['kein Angebot'];
    ['monthly', 'yearly'].forEach(function (k) {
      if (Number(a.plan[k]) !== plan(k) * 100) abw.push('Plan ' + k + ' ' + a.plan[k]);
      var p = a.platz[k];
      if (!p || p.tiers_mode !== MODUS) { abw.push('Modus ' + k + ' ' + (p && p.tiers_mode)); return; }
      var soll = stripeStufen(k), ist = p.stufen || [];
      if (ist.length !== soll.length) { abw.push('Stufen ' + k); return; }
      soll.forEach(function (s, i) {
        var b = ist[i].bis == null || ist[i].bis === 'inf' ? null : Number(ist[i].bis);
        if (b !== s.bis || Number(ist[i].cent) !== s.cent || Number(ist[i].pauschal || 0) !== 0) abw.push('Stufe ' + k + ' ' + i);
      });
    });
    return abw;
  }

  return {
    VERSION: VERSION, PLAN: PLAN, STUFEN: STUFEN, MODUS: MODUS, FREIMONATE: FREIMONATE, MAX: MAX, LOOKUP: LOOKUP,
    plan: plan, stripeStufen: stripeStufen, stufe: stufe, satz: satz, summe: summe, ab: ab, stufenName: stufenName,
    abweichungen: abweichungen, intervall: iv
  };
});
