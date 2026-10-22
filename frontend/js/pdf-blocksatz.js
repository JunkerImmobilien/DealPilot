/* ═══════════════════════════════════════════════════════════════════════
   pdf-blocksatz.js · v2830 — Fliesstext im Blocksatz fuer alle PDFs

   Marcel 22.10.2026: „Die Texte sind nicht im Blocksatz, die Abstände
   passen nicht. Das müssen wirklich richtig gute Exposés sein."

   jsPDF 2.5 kennt `align:'justify'`, verteilt dabei aber auch die LETZTE
   Zeile eines Absatzes auf die volle Breite (ein Zweiwortrest steht dann
   mit 10 cm Luft zwischen den Woertern). Deshalb hier eine eigene
   Verteilung:
     · Umbruch weiter mit splitTextToSize (dieselbe Laufweite wie bisher,
       keine Silbentrennung - ein Wort wird nie geteilt),
     · jede Zeile ausser der letzten eines Absatzes auf die volle Breite,
       Wort fuer Wort gesetzt,
     · die letzte Zeile linksbuendig,
     · eine Zeile, deren Wortabstand mehr als das Vierfache eines normalen
       Leerzeichens braeuchte, bleibt linksbuendig (sonst entstehen
       „Gassen" - typisch bei einer Zeile mit zwei langen Woertern).
   Absaetze trennt ein Zeilenumbruch (\n); Leerzeilen bleiben Leerzeilen.

   Die Datei rechnet nichts und kennt keine Farben - Schrift, Groesse und
   Farbe setzt der Aufrufer vorher, wie bei doc.text.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpPdfBlocksatz) return;

  var MAX_DEHNUNG = 4;   /* Wortabstand hoechstens 4 x Leerzeichen */

  /** Text in Zeilen {t, ende, leer} zerlegen. Schrift muss gesetzt sein. */
  function zeilen(doc, text, breite) {
    var aus = [];
    String(text == null ? '' : text).replace(/\r/g, '').split('\n').forEach(function (abs) {
      var a = abs.replace(/[ \t]+/g, ' ').trim();
      if (!a) { aus.push({ t: '', ende: true, leer: true }); return; }
      var z = doc.splitTextToSize(a, breite);
      z.forEach(function (t, i) { aus.push({ t: String(t).trim(), ende: i === z.length - 1 }); });
    });
    return aus;
  }

  /** Eine Zeile setzen. z: {t, ende} oder String (dann linksbuendig). */
  function zeile(doc, z, x, y, breite, blocksatz) {
    var t = typeof z === 'string' ? z : z.t;
    if (!t) return;
    var ende = typeof z === 'string' ? true : !!z.ende;
    var w = t.split(' ').filter(Boolean);
    if (blocksatz === false || ende || w.length < 2) { doc.text(t, x, y); return; }
    var breiten = w.map(function (s) { return doc.getTextWidth(s); });
    var summe = breiten.reduce(function (a, b) { return a + b; }, 0);
    var luecke = (breite - summe) / (w.length - 1);
    var leer = doc.getTextWidth(' ') || 1;
    if (!(luecke > 0) || luecke > leer * MAX_DEHNUNG) { doc.text(t, x, y); return; }
    var cx = x;
    for (var i = 0; i < w.length; i++) {
      doc.text(w[i], cx, y);
      cx += breiten[i] + luecke;
    }
  }

  /**
   * Absatz setzen mit Seitenwechsel.
   *   o.x, o.y, o.breite, o.zeile (Zeilenabstand mm),
   *   o.unten (letzte erlaubte Grundlinie), o.neueSeite() -> neues y
   *     (muss danach die Schrift selbst wieder setzen oder o.stil angeben),
   *   o.stil() setzt Schrift/Farbe (vor dem ersten Satz und nach jedem
   *     Seitenwechsel), o.blocksatz (Vorgabe true), o.leerzeile (Hoehe einer
   *     Leerzeile, Vorgabe halber Zeilenabstand).
   * Rueckgabe: y unter der letzten Zeile.
   */
  function absatz(doc, text, o) {
    o = o || {};
    if (o.stil) o.stil();
    var y = o.y, lh = o.zeile || 4.2;
    var zz = zeilen(doc, text, o.breite);
    for (var i = 0; i < zz.length; i++) {
      var z = zz[i];
      if (z.leer) { y += (o.leerzeile != null ? o.leerzeile : lh * 0.5); continue; }
      if (o.unten != null && y > o.unten && typeof o.neueSeite === 'function') {
        y = o.neueSeite();
        if (o.stil) o.stil();
      }
      zeile(doc, z, o.x, y, o.breite, o.blocksatz !== false);
      y += lh;
    }
    return y;
  }

  global.DpPdfBlocksatz = { zeilen: zeilen, zeile: zeile, absatz: absatz, MAX_DEHNUNG: MAX_DEHNUNG };
})(window);
