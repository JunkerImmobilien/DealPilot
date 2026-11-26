/* haus-check-ablauf.js · v5130 KK6 · Haus-Check: vom bezahlten Bericht (Landing) bzw. vom Marktbericht des Objekts (App)
   zum PDF. Rechnet NICHTS selbst: Haus-Score, Leistbarkeit und Kaufen oder mieten kommen aus js/eigennutzer-kern.js,
   Wert, Beleihungswert und Umfeld aus dem Backend (POST /public/hauscheck/bericht bzw. /marktbericht/hauscheck-objekt),
   das Dokument aus js/haus-check-pdf.js.

   DpHausCheckAblauf.html({ e, d, bericht, adresse }) -> Promise<html>
     e        Eingaben wie der Demo-Adapter: { kp, wfl, bj, ek, netto, plz, objektart, zustand, weg }
     d        Marktdaten aus DpEigennutzerKern.daten(plz, bj, wfl)
     bericht  { wert, belw, umfeld, karte } aus dem Backend (Weißliste)
   DpHausCheckAblauf.laden(blob, name)   speichert ein PDF im Browser
   Das Netto-Einkommen bleibt im Browser (nur Kern und Dokument). */
(function (root) {
  'use strict';
  function wertFuerKern(W) { return W && W.verfuegbar && W.betrag > 0 ? { betrag: W.betrag } : null; }
  function foerderung(e) {
    var F = root.DpFoerderung; if (!F || typeof F.passend !== 'function') return [];
    try {
      var f = F.passend({ nutzung: 'eigen', kauf: true, baujahr: e.bj, energieklasse: e.energieklasse || null, massnahmen: [] });
      return (f.liste || []).map(function (x) { return { name: x.name, satz: [x.warum, x.betrag].filter(Boolean).join(' ') }; });
    } catch (err) { return []; }
  }
  function html(o) {
    var E = root.DpEigennutzerKern, P = root.DpHausCheck;
    if (!E || !P) return Promise.reject(new Error('Kern oder PDF-Baustein fehlt'));
    var e = Object.assign({}, o.e || {}), b = o.bericht || {};
    e.wert = wertFuerKern(b.wert);
    var r = E.rechne(e, o.d || {});
    if (!r || !r.ok) return Promise.reject(new Error((r && r.hinweis) || 'Der Haus-Check rechnet nur für Einfamilien-, Zweifamilien-, Doppel- und Reihenhaus und die Eigentumswohnung.'));
    var haus = r.kern || r;
    return P.dokument({
      haus: haus,
      wert: b.wert && b.wert.verfuegbar ? b.wert : (b.wert || null),
      belw: b.belw && b.belw.verfuegbar ? b.belw : null,
      umfeld: b.umfeld || null,
      karte: b.karte || null,
      /* pp6 · Lage, Vergleichsmiete und Angebotspreise am Ort aus derselben Berichtsantwort (bisher ungenutzt) */
      lage: b.lage || null, vmiete: b.vergleichsmiete || null, markt: b.markt || null, stichtag: b.stichtag || null,
      anrechnung: o.anrechnung || null,
      objekt: { adresse: o.adresse || ((e.plz || '') + ' ' + ((o.d && o.d.gebiet) || '')).trim(), objektart: String(e.objektart || 'efh').toLowerCase(),
        baujahr: e.bj, wfl: e.wfl, kaufpreis: e.kp, energieklasse: e.energieklasse || null, unterlagen: e.unterlagen || [], foerderung: foerderung(e),
        gsfl: e.gsfl || null, keller: e.keller || null, geschosse: e.geschosse || null, dach: e.dach || null, ausst: e.ausst || null, ek: e.ek || 0, str: e.str || '' }
    }).then(function (h) { return { html: h, haus: haus, r: r, anrechnung: o.anrechnung || null }; });
  }
  function laden(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'DealPilot Haus-Check.pdf';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  root.DpHausCheckAblauf = { html: html, laden: laden, version: 'v5150pp6' };
})(typeof window !== 'undefined' ? window : this);
