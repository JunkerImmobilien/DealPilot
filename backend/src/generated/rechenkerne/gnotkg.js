'use strict';
/* ════════════════════════════════════════════════════════════════════════
   gnotkg.js — v3088 · Notar und Grundbuchamt nach Gebührenordnung

   Marcel 02.11.2026: „wenn die Kaufnebenkosten so dynamisch sind, könnten wir
   das auch anpassen … dass das dynamisch ansteigt." Notar und Grundbuchamt
   rechnen nach dem Gerichts- und Notarkostengesetz (GNotKG). Die Gebühren sind
   GESETZLICH festgelegt, § 125 GNotKG verbietet abweichende Vereinbarungen -
   jeder Notar in Deutschland rechnet für denselben Fall dieselbe Gebühr.
   Sie steigen mit dem Wert, aber langsamer als er, deshalb sinkt der Anteil
   am Kaufpreis mit dem Preis.

   Tabelle B (§ 34 Abs. 2 GNotKG, Anlage 2; gelesen auf gesetze-im-internet.de
   am 02.11.2026): bis 500 € 15 €, dann je angefangene Stufe:
     bis 2.000 € je 500 € +4 · bis 10.000 € je 1.000 € +6 · bis 25.000 € je 3.000 € +8
     bis 50.000 € je 5.000 € +10 · bis 200.000 € je 15.000 € +27
     bis 500.000 € je 30.000 € +50 · bis 5 Mio. € je 50.000 € +80
   Gegenprobe Anlage 2: 100.000 → 273 · 200.000 → 435 · 300.000 → 635 ·
   500.000 → 935 · 1.000.000 → 1.735.

   Gerechnete Posten (der übliche Wohnungs- oder Hauskauf mit Finanzierung):
     Notar      Beurkundung Kaufvertrag 2,0 (KV 21100) · Vollzug 0,5 (KV 22110)
                · Betreuung 0,5 (KV 22200) auf den Kaufpreis; Grundschuld 1,0
                (KV 21200) auf das Darlehen; Auslagen pauschal 60 € (ANNAHME:
                Post, Abrufe, Kopien); alles zzgl. 19 % USt.
     Grundbuch  Vormerkung 0,5 (KV 14150) · Eigentumsumschreibung 1,0 (KV 14110)
                auf den Kaufpreis; Grundschuld 1,0 (KV 14121) auf das Darlehen;
                keine USt.
   Ohne Darlehen (Barkauf) entfällt die Grundschuld.
   Ein Kern liest NIE Einstellungen - Kaufpreis und Darlehen kommen als Parameter.
   ════════════════════════════════════════════════════════════════════════ */
(function (root) {
  var STUFEN = [[2000, 500, 4], [10000, 1000, 6], [25000, 3000, 8], [50000, 5000, 10],
                [200000, 15000, 27], [500000, 30000, 50], [5000000, 50000, 80]];
  var UST = 0.19, AUSLAGEN = 60;

  function tabelleB(wert) {
    var w = Number(wert);
    if (!isFinite(w) || w <= 0) return 0;
    var geb = 15, unten = 500;
    for (var i = 0; i < STUFEN.length && w > unten; i++) {
      var oben = STUFEN[i][0], schritt = STUFEN[i][1], plus = STUFEN[i][2];
      var bis = Math.min(w, oben);
      geb += Math.ceil((bis - unten) / schritt) * plus;
      unten = oben;
    }
    return geb;
  }
  function r2(x) { return Math.round(x * 100) / 100; }

  function notar(kp, darlehen) {
    var k = Number(kp), d = Number(darlehen) || 0;
    if (!isFinite(k) || k <= 0) return null;
    var gk = tabelleB(k), netto = 3.0 * gk + (d > 0 ? tabelleB(d) : 0) + AUSLAGEN;
    var eur = Math.round(netto * (1 + UST));
    return { eur: eur, pct: r2(eur / k * 100), netto: Math.round(netto) };
  }
  function grundbuch(kp, darlehen) {
    var k = Number(kp), d = Number(darlehen) || 0;
    if (!isFinite(k) || k <= 0) return null;
    var eur = Math.round(1.5 * tabelleB(k) + (d > 0 ? tabelleB(d) : 0));
    return { eur: eur, pct: r2(eur / k * 100) };
  }
  var api = { tabelleB: tabelleB, notar: notar, grundbuch: grundbuch,
    quelle: 'GNotKG § 34 Tabelle B, KV 21100/22110/22200/21200 und 14110/14150/14121' };
  root.DealPilotGnotkg = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
