/* ═══════════════════════════════════════════════════════════════════════
   qc-score-weg.js · v4720 (einzelcheck-6, 25.11.2026)
   DER Weg vom Objekt zum Deal Score, wie ihn der Quick-Check geht.

   Marcel 25.11.2026 zum Deal-Check-Bericht (Herford, 43 „So nicht kaufen“):
   „dass wir das wie im Quick Check dann bewerten. Und nicht nochmal irgendwie
   was Gesondertes.“ Bis hierher stand die Abbildung Objekt → DealKpis →
   DealScore.computeFromKpis nur als Inline-Skript in quickcheck-app.html
   (_dpPilotScore). Der Deal-Check der Landing rechnete daneben eine eigene
   Fassung (Wertpuffer pauschal 5 % des Kaufpreises, mstg 1,5) und zeigte im
   Bericht den Investor Deal Score (DealScore2, 12 von 24 Kennzahlen).

   Jetzt rufen BEIDE diese eine Funktion. Gerechnet wird hier nichts Eigenes:
   DealKpis.compute und DealScore.computeFromKpis sind die Kerne der App.
   Diese Datei bildet nur ab (welches Feld wohin), damit die Abbildung nicht
   zweimal existiert. Ein Kern liest keine Einstellungen: Leerstand,
   Nebenkostensatz, Marktwert und Mietpotenzial bekommt sie als Parameter.

   Eingabe p:
     kp, nk (Euro), san, nkm, ze, leerstand_pct, bwk_ul, bwk_nul (Euro/Jahr),
     d1 (Darlehen), zins, tilg, ek, marktwert (Euro, sonst 0),
     miet_potenzial_pct (zulässige Steigerung der Bestandsmiete, sonst null),
     zustand
   Ausgabe { k (DealKpis), K (Score-Eingaben), r (computeFromKpis) } oder null.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  function zahl(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function rechne(p) {
    var DK = root.DealKpis, DS = root.DealScore;
    if (!DK || typeof DK.compute !== 'function' || !DS || typeof DS.computeFromKpis !== 'function') return null;
    p = p || {};
    var kp = zahl(p.kp), san = Math.max(0, zahl(p.san));
    var k = DK.compute({ kp: kp, nk: zahl(p.nk), san: san, nkm: zahl(p.nkm), ze: zahl(p.ze), leerstand_pct: zahl(p.leerstand_pct),
      bwk_ul: zahl(p.bwk_ul), bwk_nul: zahl(p.bwk_nul), d1: zahl(p.d1), d1z: zahl(p.zins), d1t: zahl(p.tilg),
      ek: zahl(p.ek), svw: 0, afa: 0, grenz: 0,
      /* qc-v2546a: LTV gegen den Kaufpreis (ekInklNkLtv false, svw 0), dieselbe Basis wie im Quick-Check */
      ekInklNkLtv: false });
    var mw = zahl(p.marktwert);
    var K = { kp: kp, cf_m: k.cf_m, nmy: k.nmy, ltv: k.ltv, dscr: k.dscr, wp_kpi: (mw > kp ? mw - kp : 0),
      miet_potenzial_pct: (p.miet_potenzial_pct != null && isFinite(Number(p.miet_potenzial_pct))) ? Number(p.miet_potenzial_pct) : null,
      zustand: p.zustand || null, san: san };
    return { k: k, K: K, r: DS.computeFromKpis(K) };
  }
  var api = { rechne: rechne, version: 'v4720' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DpQcScore = api;
})(typeof window !== 'undefined' ? window : globalThis);
