/* v4930 · Adressprüfung für eingelesene Unterlagen (Marcel 25.11.2026: „wenn wir da schon Westerfeldstraße 146 haben
   und dieses Exposé ist eine ganz andere Adresse, das müssen wir direkt ablehnen und blocken“).
   EINE Stelle für alle Einlesewege (Belege, Unterlagen und Rechnungen, Dokument-Import, Beleg-Leser).
   Ergebnis von pruefen(dokAdresse, objektAdresse):
     'gleich'     Straße und Hausnummer (bzw. PLZ) passen nach Normalisierung
     'anders'     Straße, Hausnummer oder PLZ widersprechen sich  → Unterlage blocken
     'unbekannt'  zu wenig Angaben auf einer Seite (keine Anschrift im Dokument oder kein Objekt) → nicht blocken
   Läuft auch unter node (module.exports) für tools/beleg-adresse-pruefen.mjs. */
(function (root) {
  'use strict';

  function basis(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[‐-―]/g, '-');
  }
  /* Straßenname ohne Hausnummer, „Straße/Strasse/Str.“ vereinheitlicht, Satzzeichen und Leerraum weg */
  function strNorm(s) {
    return basis(s)
      .replace(/\bstr\.?(?=\s|$|\d)/g, 'strasse').replace(/str\.(?=\S)/g, 'strasse')
      .replace(/strasse\b/g, 'str').replace(/str\.?$/g, 'str')
      .replace(/\bpl\.(?=\s|$)/g, 'platz')
      .replace(/[^a-z0-9]/g, '');
  }
  /* Hausnummern einer Anschrift: „12“, „12a“, „12-14“ (12,13,14), „12/14“, „12 und 14“ → Liste der Zahlen */
  function nummern(s) {
    var t = basis(s), out = [];
    var bereich = t.match(/(\d{1,4})\s*[a-z]?\s*(?:-|bis)\s*(\d{1,4})/);
    if (bereich) { var a = +bereich[1], b = +bereich[2]; if (b >= a && b - a <= 40) { for (var i = a; i <= b; i++) out.push(i); return out; } }
    (t.match(/\d{1,4}/g) || []).forEach(function (n) { out.push(+n); });
    return out;
  }
  /* Freitext-Anschrift „Musterweg 7a, 32052 Herford“ → { str, hnr, plz, ort } */
  function zerlegen(text) {
    var t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!t) return null;
    var plz = (t.match(/(^|\D)(\d{5})(\D|$)/) || [])[2] || '';
    var teile = t.split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
    var strTeil = '';
    for (var i = 0; i < teile.length; i++) { if (!/^\d{5}\b/.test(teile[i])) { strTeil = teile[i]; break; } }
    var ort = '';
    if (plz) { var mo = t.match(new RegExp(plz + '\\s+([^,;\\d]+)')); if (mo) ort = mo[1].trim(); }
    var m = strTeil.match(/^(.*?[a-zäöüß.])\s*(\d{1,4}\s*[a-zA-Z]?(?:\s*(?:-|\/|bis|und)\s*\d{1,4}\s*[a-zA-Z]?)*)\s*$/i);
    var str = m ? m[1].trim() : (/\d{5}/.test(strTeil) ? '' : strTeil);
    var hnr = m ? m[2].trim() : '';
    if (!str && !plz) return null;
    return { str: str, hnr: hnr, plz: plz, ort: ort };
  }
  function alsAdresse(x) {
    if (!x) return null;
    if (typeof x === 'string') return zerlegen(x);
    var str = String(x.str || x.strasse || '').trim(), hnr = String(x.hnr || x.hausnummer || '').trim();
    if (str && !hnr) { var z = zerlegen(str); if (z && z.hnr) { str = z.str; hnr = z.hnr; } }
    var a = { str: str, hnr: hnr, plz: String(x.plz || '').trim(), ort: String(x.ort || '').trim() };
    return (a.str || a.plz) ? a : null;
  }
  function text(a) {
    if (!a) return '';
    var z1 = ((a.str || '') + ' ' + (a.hnr || '')).trim(), z2 = ((a.plz || '') + ' ' + (a.ort || '')).trim();
    return z1 && z2 ? z1 + ', ' + z2 : (z1 || z2);
  }
  function pruefen(dok, obj) {
    var d = alsAdresse(dok), o = alsAdresse(obj);
    if (!d || !o) return { urteil: 'unbekannt', dok: d, obj: o };
    var res = function (u, grund) { return { urteil: u, grund: grund || '', dok: d, obj: o, dokText: text(d), objText: text(o) }; };
    var plzAnders = !!(d.plz && o.plz && d.plz !== o.plz);
    var ortAnders = !!(d.ort && o.ort && strNorm(d.ort).slice(0, 6) !== strNorm(o.ort).slice(0, 6));
    if (d.str && o.str) {
      var ds = strNorm(d.str), os = strNorm(o.str);
      if (!ds || !os) return res('unbekannt');
      var gleicheStr = ds === os || (ds.length >= 6 && os.indexOf(ds) >= 0) || (os.length >= 6 && ds.indexOf(os) >= 0);
      if (!gleicheStr) return res('anders', 'strasse');
      var dn = nummern(d.hnr), on = nummern(o.hnr);
      if (dn.length && on.length && !dn.some(function (n) { return on.indexOf(n) >= 0; })) return res('anders', 'hausnummer');
      /* gleiche Straße und Nummer: eine andere PLZ im selben Ort ist eher ein Tippfehler → nicht blocken, nur Hinweis */
      if (plzAnders && ortAnders) return res('anders', 'ort');
      return plzAnders ? res('unbekannt', 'plz') : res('gleich');
    }
    /* nur PLZ/Ort vergleichbar: blocken nur, wenn PLZ UND Ort widersprechen */
    if (plzAnders && (ortAnders || !d.ort || !o.ort)) return res('anders', 'plz');
    return res('unbekannt');
  }
  /* Anschrift des OBJEKTS aus einem Auslese-Ergebnis. Nie Absender, Rechnungs- oder Firmenadresse:
     gelesen werden nur Felder, deren Schema ausdrücklich das Objekt bzw. den Leistungsort meint. */
  function ausAuslese(ext) {
    ext = ext || {};
    var o = (ext.objekt && typeof ext.objekt === 'object') ? ext.objekt : {};
    var kand = [o.adresse, ext.objekt_adresse, ext.objekt_anschrift, ext.leistungsort, ext.adresse, ext.lage];
    for (var i = 0; i < kand.length; i++) { if (typeof kand[i] === 'string' && kand[i].trim().length > 3) {
      var a = zerlegen(kand[i]); if (a) { if (!a.plz && ext.plz) a.plz = String(ext.plz); if (!a.ort && ext.ort) a.ort = String(ext.ort); return a; } } }
    if (ext.strasse || ext.plz) return alsAdresse({ str: ext.strasse, hnr: ext.hausnummer, plz: ext.plz, ort: ext.ort });
    return null;
  }
  /* Anschrift des geöffneten Objekts aus dem Formular */
  function objekt() {
    if (typeof document === 'undefined') return null;
    var g = function (id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };
    return alsAdresse({ str: g('str'), hnr: g('hnr'), plz: g('plz'), ort: g('ort') });
  }
  function meldung(r) {
    return 'Diese Unterlage gehört zu ' + (r.dokText || text(r.dok)) + ', das Objekt ist ' + (r.objText || text(r.obj)) + '. Nicht übernommen.';
  }
  /* Bestand = gewonnenes Objekt. Dort werden aus Exposé, Marktbericht oder Gutachten keine Objektdaten übernommen. */
  function istBestand() {
    if (typeof window === 'undefined') return false;
    try { if (window.DealPilotDealAction && typeof window.DealPilotDealAction.isWon === 'function' && window.DealPilotDealAction.isWon()) return true; } catch (e) {}
    var w = document.getElementById('_deal_won_state'); if (w && w.value === 'true') return true;
    var d = window._currentObjData; return !!(d && (d._deal_won === true || d._deal_won === 'true'));
  }
  var api = { pruefen: pruefen, zerlegen: zerlegen, ausAuslese: ausAuslese, objekt: objekt, meldung: meldung, text: text,
    istBestand: istBestand, strNorm: strNorm, nummern: nummern, version: 'v4930' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpAdressPruefung = api;
})(typeof window !== 'undefined' ? window : null);
