/* ═══════════════════════════════════════════════════════════════════════
   pdf-text-sauber.js · v2970 — EINE Bereinigung fuer jeden Text, der in
   ein jsPDF-Dokument geht (alle PDFs der App, Marktbericht, Handbuch).

   Marcel 27.10.2026 (Investment-PDF per Telegram): ganze Zeilen gesperrt
   („D i e  g e p l a n t e …") und ueber den Rand, Zahlen zerstoert
   („- 2 4 4 / €", „2 , 9 8 / %").

   Gemessen (jsPDF 2.5.1, Helvetica = Standardschrift, WinAnsi):
     · Kommt in einem String EIN Zeichen vor, das WinAnsi nicht kennt,
       schreibt jsPDF den GANZEN String als UTF-16 (je Zeichen zwei Bytes).
       Die Standardschrift liest die Bytes einzeln: vor jedem Zeichen steht
       ein NUL - das ist die Sperrung -, und U+202F (schmales geschuetztes
       Leerzeichen, setzt die KI gern zwischen Zahl und Einheit) wird zu
       0x20 0x2F = Leerzeichen + „/". Daher „2,98/%".
     · splitTextToSize rechnet die Breite mit den echten Zeichen - gesetzt
       wird aber die doppelte Zahl Glyphen. Die Zeile laeuft rechts raus.
     · Intl.NumberFormat('de-DE') liefert U+00A0 und €: beides WinAnsi,
       beides unschaedlich. Der Ausloeser ist der KI-Text (U+202F, U+2212).

   Deshalb wird nicht an jeder Stelle einzeln bereinigt, sondern an der
   Quelle: jedes jsPDF-Dokument bekommt beim Anlegen (Ereignis
   „initialized") eine bereinigende Huelle um text, splitTextToSize,
   getTextWidth und getStringUnitWidth. Breite und Satz sehen damit
   denselben String. Bleibt nur WinAnsi uebrig - € bleibt (0x80).

   Voraussetzung: es gibt im Projekt keine eingebettete Unicode-Schrift
   (kein addFont/addFileToVFS, gemessen 27.10.2026). Kommt eine dazu, muss
   sie hier ausgenommen werden - sonst verliert sie ihre Sonderzeichen.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpPdfText) return;

  /* Die 27 Zeichen, die WinAnsi zusaetzlich zu Latin-1 auf 0x80-0x9F legt. */
  var WINANSI_EXTRA = '\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D'
    + '\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178';

  var ERSATZ = {
    '\u202F': '\u00A0', '\u2007': '\u00A0', '\u2060': '',                 /* geschuetzt bleibt geschuetzt */
    '\u2000': ' ', '\u2001': ' ', '\u2002': ' ', '\u2003': ' ', '\u2004': ' ', '\u2005': ' ',
    '\u2006': ' ', '\u2008': ' ', '\u2009': ' ', '\u200A': ' ', '\u205F': ' ', '\u3000': ' ',
    '\u2028': '\n', '\u2029': '\n',
    '\u200B': '', '\u200C': '', '\u200D': '', '\uFEFF': '', '\u00AD': '', '\uFE0F': '', '\uFE0E': '',
    '\u2212': '-', '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2015': '\u2014', '\u2043': '-',
    '\u201B': '\u2019', '\u201F': '\u201D', '\u2032': '\'', '\u2033': '"', '\u2035': '\'',
    '\u2192': '->', '\u2190': '<-', '\u2194': '<->', '\u21D2': '=>', '\u2191': '', '\u2193': '',
    '\u2264': '<=', '\u2265': '>=', '\u2248': '~', '\u2260': '!=', '\u2243': '~',
    '\u2215': '/', '\u2044': '/', '\u2217': '*', '\u22C5': '\u00B7', '\u2219': '\u00B7',
    '\u2713': '', '\u2714': '', '\u2717': '', '\u2718': '', '\u25CF': '\u2022', '\u25AA': '\u2022',
    '\u25E6': '\u2022', '\u2023': '\u2022',
    '\u2070': '0', '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9',
    '\u2081': '1', '\u2082': '2', '\u2083': '3'
  };

  function _winAnsi(c) {
    var n = c.charCodeAt(0);
    return (n >= 0x20 && n < 0x7F) || n === 0x0A || n === 0x0D || n === 0x09
      || (n >= 0xA0 && n <= 0xFF) || WINANSI_EXTRA.indexOf(c) >= 0;
  }

  /** Text WinAnsi-fest machen. Nicht-Strings gehen unveraendert zurueck. */
  function sauber(s) {
    if (typeof s !== 'string' || !s) return s;
    /* schneller Weg: alles schon WinAnsi */
    if (!/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/.test(s)) return s;
    var aus = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (_winAnsi(c)) { aus += c; continue; }
      if (Object.prototype.hasOwnProperty.call(ERSATZ, c)) { aus += ERSATZ[c]; continue; }
      var code = c.charCodeAt(0);
      if (code >= 0xD800 && code <= 0xDBFF) { i++; continue; }   /* Emoji u. a. (Ersatzpaar) */
      if (code < 0x20) continue;                                   /* Steuerzeichen */
      /* Akzentbuchstaben ausserhalb Latin-1 (\u0142, \u0151, \u010D \u2026): Grundbuchstabe */
      var zer = '';
      try { zer = c.normalize('NFKD').replace(/[\u0300-\u036F]/g, ''); } catch (e) {}
      if (zer && zer !== c) {
        var ok = true;
        for (var k = 0; k < zer.length; k++) if (!_winAnsi(zer.charAt(k))) { ok = false; break; }
        if (ok) { aus += zer; continue; }
      }
      /* sonst weglassen: lieber ein fehlendes Zeichen als eine gesperrte Zeile */
    }
    return aus;
  }

  function _tief(t) {
    if (typeof t === 'string') return sauber(t);
    if (Array.isArray(t)) return t.map(_tief);
    return t;
  }

  function _huelle(doc) {
    if (!doc || doc.__dpTextSauber) return;
    doc.__dpTextSauber = true;
    var text = doc.text, split = doc.splitTextToSize, breite = doc.getTextWidth, einheit = doc.getStringUnitWidth;
    if (typeof text === 'function') {
      doc.text = function (a, b, c) {
        var args = Array.prototype.slice.call(arguments);
        if (typeof a === 'number' && typeof b === 'number') args[2] = _tief(c);   /* alte Form text(x, y, s) */
        else args[0] = _tief(a);
        return text.apply(this, args);
      };
    }
    /* v2990 · BREITE OHNE UNTERSCHNEIDUNG. jsPDF misst mit den Kerning-Paaren der
       Standardschrift („Te" -120, „Ve" -80 …), setzt den Text aber OHNE sie. Jedes
       Wort mit einem solchen Paar war gemessen schmaler als gesetzt; wer Woerter
       einzeln setzt (Marktbericht-Fliesstext, _mbLayoutRuns), verlor so den Wortabstand:
       „Vergleichsangebotesowie", „Trendfortschreibungzu" (Bericht Am Markt 9,
       Kabelsketal, 27.10.2026). Gemessen jsPDF 2.5.1, 9,5 pt: „Tagen" 9,02 mm
       gemessen gegen 9,42 mm gesetzt, der Wortabstand ist 0,93 mm. Gemessen wird
       deshalb wie gesetzt wird: ohne Kerning. */
    var _ohneKern = function (d, o) {
      var r = {}; for (var k in (o || {})) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k];
      if (!r.kerning) r.kerning = {};
      if (!r.widths && !r.fontName && !r.fontStyle) {
        try { var U = d.internal.getFont().metadata.Unicode; if (U && U.widths) r.widths = U.widths; } catch (e) {}
        if (!r.widths) delete r.kerning;   /* ohne Breitentabelle nimmt splitTextToSize sonst gar keine */
      }
      return r;
    };
    if (typeof split === 'function') {
      doc.splitTextToSize = function (s, w, o) {
        var args = Array.prototype.slice.call(arguments); args[0] = _tief(s);
        args[2] = _ohneKern(this, o);
        return split.apply(this, args);
      };
    }
    if (typeof breite === 'function') {
      doc.getTextWidth = function (s) { return breite.call(this, sauber(s)); };   /* ruft this.getStringUnitWidth, also ohne Kerning */
    }
    if (typeof einheit === 'function') {
      doc.getStringUnitWidth = function (s, o) {
        var r = {}; for (var k in (o || {})) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k];
        if (!r.kerning) r.kerning = {};
        return einheit.call(this, sauber(s), r);
      };
    }
  }

  function _anmelden() {
    var J = global.jspdf && global.jspdf.jsPDF;
    if (!J || !J.API || !Array.isArray(J.API.events)) return false;
    if (J.API.__dpTextSauberAngemeldet) return true;
    J.API.__dpTextSauberAngemeldet = true;   /* eigener Name: J.API wird auf jedes Dokument kopiert */
    J.API.events.push(['initialized', function () { _huelle(this); }]);
    return true;
  }

  global.DpPdfText = { sauber: sauber, huelle: _huelle, anmelden: _anmelden };
  _anmelden();
})(typeof window !== 'undefined' ? window : globalThis);
