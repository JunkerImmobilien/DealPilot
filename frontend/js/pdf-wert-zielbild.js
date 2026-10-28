/* ═══════════════════════════════════════════════════════════════════════
   pdf-wert-zielbild.js · v2830 — Segment „Wert & Zielbild" fuer alle PDFs
   (Investment hell, Investment Obsidian, Bankfassung)

   Marcel 22.10.2026: die Werte je Verfahren gehoeren ins Exposé -
   Marktpreisindikation (untere / Mitte / obere, mit und ohne Abschlag),
   Ertragswert, Sachwert, Vergleichswert, Kaufpreis - und dazu Ist, Soll
   und Zielbild.

   RECHNET NICHTS. Quellen, in dieser Rangfolge:
     1. window.DpWertZielbild.daten()  (Tab Bewertung, baut ein anderer
        Strang; Vertrag unten). Liefert er `verfahren` oder `stufen`, gelten
        die - sonst die Quellen 2 und 3.
     2. Der letzte Marktbericht des Objekts (GET /marktbericht/objects/
        history) - genau die Felder, die js/wertvergleich.js (v2810) in der
        Pilot-Analyse gegenueberstellt. Die Erklaertexte kommen aus
        DpWertvergleich.html() selbst, damit App und PDF dasselbe sagen.
     3. Ist / Soll / Zielbild: DpPotenzial.pdfDaten().bruecke (Ertragswert
        je Stufe aus dem Marktbericht-Dienst, dieselben Zahlen wie die Seite
        Wertpotenzial).
   Ohne Marktbericht UND ohne Stufen entfaellt das Segment still.

   Vertrag: wert-zielbild.js v2840 (DpWertZielbild.laden() -> daten()),
   uebersetzt in ausWertZielbild(): wert.verfahren -> Zeilen der Tabelle,
   zielbild.stufen[k].ertragswert -> Ist / Soll / Zielbild, kernaussagen ->
   Kernaussagen. Fehlt das Modul, gelten die Quellen 2 und 3.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpPdfWertZielbild) return;

  function zahl(v) { if (v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function eur(v) { var n = zahl(v); return n == null ? '-' : Math.round(n).toLocaleString('de-DE') + ' €'; }
  function teur(v) { return Math.round(v / 1000).toLocaleString('de-DE') + ' T€'; }
  function pz(v) { return (v > 0 ? '+' : (v < 0 ? '-' : '')) + Math.abs(v).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'; }
  /* Text aus der Oberflaeche: nur, was die Standardschrift kennt (Latin-1 + €) */
  function sauber(t) {
    return String(t == null ? '' : t).replace(/[−‑‒–—]/g, '-').replace(/[  ­]/g, ' ')
      .replace(/[„“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x00-\xFF€]/g, '').replace(/\s+/g, ' ').trim();
  }
  function kaufpreis() {
    try { var k = global.State && global.State.kpis && global.State.kpis.kp; if (k > 0) return k; } catch (e) {}
    var el = document.getElementById('kp'); if (!el) return null;
    var s = String(el.value || '').replace(/[^\d,.-]/g, '');
    var n = Number(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) && n > 0 ? n : null;
  }

  /* Letzter Marktbericht des Objekts - derselbe Abruf wie ui.js _dpLoadVerlauf (GET, kostenfrei). */
  function letzterBericht() {
    var key = (typeof global._currentObjKey === 'string' && global._currentObjKey) ? global._currentObjKey : null;
    if (!key || !global.Auth || typeof global.Auth.apiCall !== 'function') return Promise.resolve(null);
    var p = global.Auth.apiCall('/marktbericht/objects/history?key=' + encodeURIComponent('dp:' + key), { method: 'GET' })
      .then(function (d) {
        var l = null;
        ((d && d.history) || []).forEach(function (h) { if (h && h.market_value != null && (!l || new Date(h.created_at) >= new Date(l.created_at))) l = h; });
        return l;
      }, function () { return null; });
    return Promise.race([p, new Promise(function (f) { setTimeout(function () { f(null); }, 8000); })]);
  }

  /* Werte je Verfahren - dieselbe Auswahl wie wertvergleich.js html() */
  function ausBericht(h) {
    var mw = zahl(h.market_value); if (mw == null) return [];
    var ab = zahl(h.angebot_abschlag_pct), roh = zahl(h.market_value_roh), mitAb = ab != null && ab > 0 && roh != null;
    var fu = String(h.fuehrend || '');
    var ew = zahl(h.ertragswert_eur), sw = zahl(h.sachwert_eur), swVorl = !!h.sachwert_vorlaeufig || h.sw_marktangepasst === false;
    var vw = zahl(h.irw_vergleichswert_eur);
    if (vw == null && h.vergleichsfaktor_amtlich) vw = zahl(h.vergleichswert_eur);
    var v = [];
    v.push({ art: 'mpi', name: 'Marktpreisindikation', sub: mitAb ? 'nach ' + ab.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' % Abschlag auf Angebotspreise' : 'aus Angebotspreisen vergleichbarer Objekte',
      unten: zahl(h.market_value_low), mitte: mw, oben: zahl(h.market_value_high), fuehrend: fu === 'vergleichswert' && vw == null });
    if (mitAb) v.push({ art: 'roh', name: 'ohne Abschlag', sub: 'Angebotsniveau, wie ausgeschrieben', unten: zahl(h.market_value_roh_low), mitte: roh, oben: zahl(h.market_value_roh_high) });
    if (ew != null) v.push({ art: 'ew', name: /vorläufig/.test(h.ertragswert_bezeichnung || '') ? 'Ertragswert (vorläufig)' : 'Ertragswert',
      sub: zahl(h.ertragswert_von_eur) != null ? 'Spanne aus dem Liegenschaftszins' : '', unten: zahl(h.ertragswert_von_eur), mitte: ew, oben: zahl(h.ertragswert_bis_eur), fuehrend: fu === 'ertragswert' });
    if (sw != null) v.push({ art: 'sw', name: swVorl ? 'Sachwert (nur Plausibilität)' : 'Sachwert', sub: swVorl ? 'Herstellungskosten ohne Marktanpassung, kein Marktwert' : '', mitte: sw, ohneAbw: swVorl, /* v2979 */ fuehrend: fu === 'sachwert' });
    if (vw != null) v.push({ art: 'vw', name: 'Vergleichswert', sub: h.irw_vergleichswert_eur != null ? 'aus dem Immobilienrichtwert' : 'amtlicher Vergleichsfaktor aus Kaufpreisen' + (h.vergleich_ausschuss ? ' · ' + String(h.vergleich_ausschuss).replace(/^Der Gutachterausschuss für Grundstückswerte /, 'GAA ') : ''), mitte: vw, fuehrend: fu === 'vergleichswert' });
    return v;
  }

  /* Erklaertexte aus wertvergleich.js - App und PDF sagen dasselbe */
  function texteAusBericht(h) {
    try {
      if (!global.DpWertvergleich || typeof global.DpWertvergleich.html !== 'function') return [];
      var box = document.createElement('div');
      box.innerHTML = global.DpWertvergleich.html(h);
      var aus = [], akt = null;
      [].forEach.call(box.querySelectorAll('h4.dp-wv-h, p.dp-pa-p'), function (e) {
        if (e.tagName === 'H4') { akt = { h: sauber(e.textContent), p: [] }; aus.push(akt); }
        else if (akt) akt.p.push(sauber(e.textContent));
      });
      return aus.filter(function (a) { return a.p.length; });
    } catch (e) { return []; }
  }

  function stufenAusPotenzial(PD) {
    var B = PD && PD.bruecke; if (!B) return [];
    var j = PD.jahre || {}, s = [{ titel: 'Ist (Bestand)', wert: B.bestand }];
    if (B.mieterhoehung != null) s.push({ titel: 'Soll (Mieterhöhung' + (j.mieterhoehung ? ' ' + j.mieterhoehung : '') + ')', wert: B.mieterhoehung });
    if (B.zielbild != null) s.push({ titel: 'Zielbild' + (j.zielbild ? ' ' + j.zielbild : ''), wert: B.zielbild, kosten: B.kosten || null });
    return s;
  }

  /**
   * Alle Daten fuer das Segment. o.potenzial = DpPotenzial.pdfDaten() (optional).
   * Rueckgabe null, wenn nichts vorliegt.
   */
  /* Vertrag von wert-zielbild.js (v2840, Tab Bewertung) in die Form dieses
     Segments uebersetzen. Nichts wird gerechnet, nur umbenannt. */
  var ART = { mpi: 'mpi', mpi_roh: 'roh', ertragswert: 'ew', sachwert: 'sw', vergleichswert: 'vw', kaufpreis: 'kp' };
  function ausWertZielbild(D) {
    if (!D) return null;
    var X = {};
    if (D.wert && D.wert.verfahren && D.wert.verfahren.length) {
      X.verfahren = D.wert.verfahren.filter(function (v) { return ART[v.schluessel] && ART[v.schluessel] !== 'kp'; }).map(function (v) {
        return { art: ART[v.schluessel], name: v.name, sub: v.zusatz || '', unten: v.unten, mitte: v.mitte, oben: v.oben, fuehrend: !!v.fuehrend };
      });
      if (D.wert.bericht_datum) X.stand = 'Marktbericht vom ' + new Date(D.wert.bericht_datum).toLocaleDateString('de-DE');
    }
    var Z = D.zielbild;
    if (Z && Z.stufen && !Z.ertragswert_gesperrt) {
      var VOR = { bestand: 'Ist · ', mieterhoehung: 'Soll · ', zielbild: '' };
      X.stufen = (Z.spalten || []).map(function (k) {
        var s = Z.stufen[k] || {};
        /* v2836 · Marktpreisindikation je Stufe mit Abschlag und ohne (v2842) */
        return { titel: (VOR[k] || '') + ((Z.titel && Z.titel[k]) || k), wert: s.ertragswert, kosten: k === 'bestand' ? null : s.kosten,
          mpi: s.marktpreisindikation != null ? s.marktpreisindikation : null, mpiAb: s.mpi_abschlag_pct != null ? s.mpi_abschlag_pct : null,
          mpiOhne: s.mpi_ohne_abschlag != null ? s.mpi_ohne_abschlag : null };
      });
      if (Z.kurz_ausblick) X.ausblick = Z.kurz_ausblick;
      /* v2834 · Sanierungsstau je Stufe (v2854, potenzial.js): der fertige Satz der Stufe */
      var gesehen = {};
      X.stau = (Z.spalten || []).map(function (k) {
        var st = Z.stufen[k] && Z.stufen[k].sanierungsstau;
        if (!st || !st.satz || gesehen[st.satz]) return null;
        gesehen[st.satz] = 1;
        return { titel: (Z.titel && Z.titel[k]) || k, satz: st.satz };
      }).filter(Boolean);
      if (Z.kennzeichnung) X.hinweis = 'Marktpreisindikation, Ertrags- und Sachwert sind indikativ nach ImmoWertV-Logik, kein Gutachten nach § 194 BauGB. ' + Z.kennzeichnung
        + (Z.ertragswert_veraltet ? ' Die Angaben wurden seit der letzten Rechnung geändert.' : '');
    }
    X.kern = (D.kernaussagen || []).filter(function (k) { return k && k.titel && (k.wert_text || k.text); });
    return X;
  }

  function daten(o) {
    o = o || {};
    var extern = null;
    try {
      var WZ = global.DpWertZielbild;
      if (WZ && typeof WZ.laden === 'function') extern = WZ.laden();
      else if (WZ && typeof WZ.daten === 'function') extern = WZ.daten();
    } catch (e) { extern = null; }
    var roh = Promise.race([Promise.resolve(extern), new Promise(function (f) { setTimeout(function () { f(null); }, 8000); })]);
    extern = roh.then(ausWertZielbild, function () { return null; });
    /* v2900 · die Erklaertexte aus DEMSELBEN Bericht wie die Seite: hat
       DpWertZielbild ihn schon geladen (bericht()), wird nicht ein zweites Mal
       abgerufen. Sonst konnten Tabelle und Text aus zwei Abrufen stammen. */
    var bericht = roh.then(function () {
      try { var WZ = global.DpWertZielbild, h = WZ && typeof WZ.bericht === 'function' ? WZ.bericht() : null; if (h) return h; } catch (e) {}
      return letzterBericht();
    }, function () { return letzterBericht(); });
    return Promise.all([extern, bericht]).then(function (r) {
      var X = r[0] || {}, h = r[1];
      return ohneZiel(o, baue(X, h));   /* v3018d */
    });
    function baue(X, h) {
      var verf = (X.verfahren && X.verfahren.length) ? X.verfahren : (h ? ausBericht(h) : []);
      var stufen = (X.stufen && X.stufen.length) ? X.stufen : stufenAusPotenzial(o.potenzial);
      stufen = stufen.filter(function (s) { return zahl(s.wert) != null; });
      if (!verf.length && !stufen.length) return null;
      var kp = kaufpreis();
      var stand = X.stand || (h && h.created_at ? 'Marktbericht vom ' + new Date(h.created_at).toLocaleDateString('de-DE') : '');
      return {
        verfahren: verf.filter(function (v) { return zahl(v.mitte) != null; }),
        stufen: stufen, kaufpreis: kp, stand: sauber(stand),
        /* v2992 · Abschlag und Wert ohne Abschlag des gespeicherten Berichts - fuer den Hinweis unter den Stufen */
        berichtAb: h ? zahl(h.angebot_abschlag_pct) : null, berichtOhne: h ? zahl(h.market_value_roh) : null,
        berichtDatum: h && h.created_at ? new Date(h.created_at).toLocaleDateString('de-DE') : null,
        texte: h ? texteAusBericht(h) : [], kern: X.kern || [], stau: X.stau || [], ausblick: sauber(X.ausblick || ''),
        /* v2833 · der Hinweis zu Mieterhoehung/Zielbild ist Marcels Wortlaut aus
           potenzial.js (KENNZEICHNUNG, v2870) - nie ein eigener Text */
        hinweis: sauber(X.hinweis || ('Marktpreisindikation, Ertrags- und Sachwert sind indikativ nach ImmoWertV-Logik, kein Gutachten nach § 194 BauGB.'
          + (stufen.length && global.DpPotenzial && global.DpPotenzial.KENNZEICHNUNG ? ' ' + global.DpPotenzial.KENNZEICHNUNG : '')))
      };
    }
  }

  /* v3018d · Marcel 28.10.2026: „wenn wir kein Zielbild angegeben haben, das auch nicht im PDF
     steht." Gemessen an Lindenallee 2026-1123 (Mieterhoehung ja, Zielbild nein): Kernaussagen
     „Maßnahmen: 0 € (keine eingetragen)" und „Wertzuwachs nach Kosten: 0 €", die Legende
     „(Ist, Soll, Zielbild)", der Ausblick „Mieterhöhung und Zielbild unterstellen …" und
     „Zielbild offen". Zielbild angegeben = DpPotenzial (hat_ziel); der Text geht durch
     DpPotenzial.ohneZielbild - dieselbe Stelle wie pdf.js und die Bankfassung. */
  function hatZiel(o) {
    var PD = o && o.potenzial;
    if (PD && typeof PD.hat_ziel === 'boolean') return PD.hat_ziel;
    try { var P = global.DpPotenzial; if (P && typeof P.modell === 'function') return !!P.modell().hat_ziel; } catch (e) {}
    return true;   /* unbekannt: nichts wegnehmen */
  }
  function ohneZiel(o, d) {
    if (!d || hatZiel(o)) return d;
    var P = global.DpPotenzial, oz = P && typeof P.ohneZielbild === 'function' ? P.ohneZielbild : function (s) { return s; };
    d.ohneZiel = true;
    d.stufen = (d.stufen || []).filter(function (s) { return !/Zielbild/.test(String(s.titel || '')); });
    d.texte = (d.texte || []).map(function (a) { return { h: a.h, p: a.p.map(oz).filter(Boolean) }; })
      .filter(function (a) { return a.p.length && !/Zielbild/.test(a.h); });
    d.kern = (d.kern || []).filter(function (k) { return !/^(Maßnahmen|Wertzuwachs nach Kosten)|Zielbild/.test(String(k.titel || '')); })
      .map(function (k) { return k.text ? Object.assign({}, k, { text: oz(k.text) }) : k; });
    d.stau = (d.stau || []).filter(function (s) { return !/Zielbild/.test(String(s.titel || '')); });
    d.ausblick = oz(d.ausblick || '');
    d.hinweis = oz(d.hinweis || '');
    return d;
  }

  /* glatte Achse */
  function achse(min, max) {
    var sp = max - min || max || 1, roh = sp / 4, p = Math.pow(10, Math.floor(Math.log(roh) / Math.LN10));
    var schritt = [1, 2, 2.5, 5, 10].map(function (f) { return f * p; }).filter(function (s) { return s >= roh; })[0] || roh;
    var a = Math.floor(min / schritt) * schritt, b = Math.ceil(max / schritt) * schritt;
    if (b - a < schritt) b = a + schritt;
    var t = []; for (var v = a; v <= b + schritt / 2; v += schritt) t.push(v);
    return { min: a, max: b, ticks: t };
  }

  /**
   * Segment zeichnen. o: { x, y, breite, unten, neueSeite() -> y, stil: 'bank'|'invest',
   *   f: { gold, goldD, goldL, tinte, grau, linie, kopfGrund, kopfText, streifen }, ueberschrift(t) -> y }
   * Rueckgabe: y.
   */
  /* v2900 · o.teile: nur diese Teile zeichnen (Vorgabe: alle) -
       verfahren, landschaft, stufen (Tafel), stufenText (Ausblick, Sanierungsstau),
       mpiZeile (Marktpreisindikation je Stufe ohne Abschlag als Satz - fuer den Fall,
       dass die Tafel wegfaellt, weil die Seite Wertpotenzial dieselben Stufen zeigt),
       kern, texte, hinweis. So zeichnen beide PDFs Wertpotenzial und Wert & Zielbild
       als EINEN Abschnitt, ohne die Stufen zweimal. */
  var ALLE_TEILE = ['verfahren', 'landschaft', 'stufen', 'stufenText', 'kern', 'texte', 'hinweis'];
  function zeichne(doc, d, o) {
    var x = o.x, B = o.breite, y = o.y, f = o.f, unten = o.unten;
    var BS = global.DpPdfBlocksatz;
    var teile = o.teile || ALLE_TEILE, T = function (k) { return teile.indexOf(k) >= 0; };
    function platz(h) { if (y + h > unten) { y = o.neueSeite(); return true; } return false; }
    /* Abstand vor jeder Zwischenueberschrift, ausser oben auf der Seite */
    var erste = true;
    function ueber(t) { if (!erste) y += 4; erste = false; platz(16); y = o.ueberschrift ? o.ueberschrift(t, y) : y; }
    function setT(c) { doc.setTextColor(c[0], c[1], c[2]); }

    /* ── 1. Tabelle der Verfahren ─────────────────────────────── */
    var V = d.verfahren.slice();
    if (d.kaufpreis) V.push({ art: 'kp', name: 'Kaufpreis', sub: 'Angabe im Objekt', mitte: d.kaufpreis });
    var mpi = d.verfahren.filter(function (v) { return v.art === 'mpi'; })[0];
    if (V.length && T('verfahren')) {
      ueber('Werte je Verfahren' + (d.stand ? ' · ' + d.stand : ''));
      var sp = [['Wert', 50, 'l'], ['untere', 22], ['Mitte / Wert', 25], ['obere', 22], ['zum Markt', 18], ['zum Kaufpreis', 21]];
      var fak = B / sp.reduce(function (a, s) { return a + s[1]; }, 0);
      var kopf = function () {
        var cx = x, rh = 6.4;
        if (o.stil === 'invest') { doc.setFillColor(f.kopfGrund[0], f.kopfGrund[1], f.kopfGrund[2]); doc.rect(x, y, B, rh, 'F'); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); setT(o.stil === 'invest' ? f.kopfText : [110, 110, 110]);
        sp.forEach(function (s, i) {
          var bw = s[1] * fak;
          if (i === 0) doc.text(s[0], cx + 2, y + 4.3); else doc.text(s[0], cx + bw - 2, y + 4.3, { align: 'right' });
          cx += bw;
        });
        if (o.stil !== 'invest') { doc.setDrawColor(f.gold[0], f.gold[1], f.gold[2]); doc.setLineWidth(0.5); doc.line(x, y + rh, x + B, y + rh); doc.setLineWidth(0.2); }
        y += rh;
      };
      platz(10 + V.length * 9);
      kopf();
      V.forEach(function (v, n) {
        var rh = v.sub ? 8.6 : 6.4;
        if (platz(rh)) kopf();
        if (o.stil === 'invest' && n % 2 === 0) { doc.setFillColor(f.streifen[0], f.streifen[1], f.streifen[2]); doc.rect(x, y, B, rh, 'F'); }
        if (v.fuehrend) { doc.setFillColor(f.gold[0], f.gold[1], f.gold[2]); doc.rect(x, y, 1.2, rh, 'F'); }
        var cx = x, fett = v.art === 'kp' || v.fuehrend;
        doc.setFont('helvetica', fett ? 'bold' : 'normal'); doc.setFontSize(8.4); setT(f.tinte);
        doc.text(sauber(v.name) + (v.fuehrend ? '  (führend)' : ''), x + 2.5, y + 4.2);
        if (v.sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); setT(f.grau); doc.text(sauber(v.sub), x + 2.5, y + 7.3); }
        var dM = (mpi && v.art !== 'mpi' && v.art !== 'roh' && !v.ohneAbw) ? (v.mitte - mpi.mitte) / mpi.mitte * 100 : null;
        var dK = (d.kaufpreis && v.art !== 'kp' && !v.ohneAbw) ? (v.mitte - d.kaufpreis) / d.kaufpreis * 100 : null;
        var werte = ['', v.unten != null ? eur(v.unten) : '', eur(v.mitte), v.oben != null ? eur(v.oben) : '', dM != null ? pz(dM) : '', dK != null ? pz(dK) : ''];
        werte.forEach(function (w, i) {
          var bw = sp[i][1] * fak;
          if (i > 0 && w) {
            doc.setFont('helvetica', i === 2 ? 'bold' : 'normal'); doc.setFontSize(8.4); setT(i >= 4 ? f.grau : f.tinte);
            doc.text(w, cx + bw - 2, y + 4.2, { align: 'right' });
          }
          cx += bw;
        });
        doc.setDrawColor(f.linie[0], f.linie[1], f.linie[2]); doc.setLineWidth(0.15); doc.line(x, y + rh, x + B, y + rh); doc.setLineWidth(0.2);
        y += rh;
      });
      y += 2;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); setT(f.grau);
      doc.text('zum Markt / zum Kaufpreis: Abweichung der Mitte von der Marktpreisindikation bzw. vom Kaufpreis.', x, y + 1.5);
      y += 6;
    }

    /* ── 2. Grafik: alle Werte auf einer Achse ───────────────── */
    var G = V.map(function (v) { return { name: v.name, unten: v.unten, mitte: v.mitte, oben: v.oben, art: v.art }; });
    /* Ertragswert je Stufe; der Bestand entfaellt, wenn er dem Ertragswert der Zeile darueber gleicht */
    var ewZ = d.verfahren.filter(function (v) { return v.art === 'ew'; })[0];
    d.stufen.forEach(function (s, i) {
      if (i === 0 && ewZ && Math.abs(zahl(s.wert) - ewZ.mitte) <= ewZ.mitte * 0.005) return;
      G.push({ name: 'Ertragswert ' + s.titel, mitte: zahl(s.wert), art: 'stufe' });
    });
    G = G.filter(function (g) { return g.art !== 'kp'; });
    if (T('landschaft') && (G.length >= 2 || (G.length && d.kaufpreis))) {
      var alle = [];
      G.forEach(function (g) { [g.unten, g.mitte, g.oben].forEach(function (w) { if (zahl(w) != null) alle.push(w); }); });
      if (d.kaufpreis) alle.push(d.kaufpreis);
      var A = achse(Math.min.apply(null, alle) * 0.97, Math.max.apply(null, alle) * 1.03);
      var rh2 = 6.2, lw = 50, gx = x + lw, gw = B - lw - 4, hoehe = G.length * rh2 + 14;
      ueber('Wertlandschaft');
      platz(hoehe + 6);
      var px = function (w) { return gx + (w - A.min) / (A.max - A.min) * gw; };
      var y0 = y + 2;
      /* Raster */
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4);
      A.ticks.forEach(function (t) {
        doc.setDrawColor(f.linie[0], f.linie[1], f.linie[2]); doc.setLineWidth(0.15);
        doc.line(px(t), y0, px(t), y0 + G.length * rh2);
        setT(f.grau); doc.text(teur(t), px(t), y0 + G.length * rh2 + 4, { align: 'center' });
      });
      G.forEach(function (g, i) {
        var yy = y0 + i * rh2, ym = yy + rh2 / 2;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); setT(f.tinte);
        var nm = sauber(g.name); while (nm.length > 3 && doc.getTextWidth(nm) > lw - 3) nm = nm.slice(0, -2);
        doc.text(nm, x, ym + 1.2);
        var c = g.art === 'stufe' ? f.goldD : (g.art === 'roh' ? f.grau : f.gold);
        if (zahl(g.unten) != null && zahl(g.oben) != null) {
          var cL = f.goldL || f.linie;
          doc.setFillColor(cL[0], cL[1], cL[2]); doc.rect(px(g.unten), ym - 1.5, Math.max(0.4, px(g.oben) - px(g.unten)), 3, 'F');
        }
        doc.setFillColor(c[0], c[1], c[2]);
        doc.circle(px(g.mitte), ym, 1.25, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); setT(f.tinte);
        var lab = teur(g.mitte), lx = px(g.mitte) + 2.2, al = 'left';
        var rechts = zahl(g.oben) != null ? px(g.oben) : px(g.mitte);
        if (rechts + 2.2 + doc.getTextWidth(lab) > gx + gw) { lx = (zahl(g.unten) != null ? px(g.unten) : px(g.mitte)) - 2.2; al = 'right'; }
        else lx = rechts + 2.2;
        doc.text(lab, lx, ym + 1.1, { align: al });
      });
      if (d.kaufpreis) {
        var kx = px(d.kaufpreis);
        doc.setDrawColor(f.tinte[0], f.tinte[1], f.tinte[2]); doc.setLineWidth(0.35);
        try { doc.setLineDashPattern([1, 0.8], 0); } catch (e) {}
        doc.line(kx, y0 - 1.5, kx, y0 + G.length * rh2);
        try { doc.setLineDashPattern([], 0); } catch (e) {}
        doc.setLineWidth(0.2);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); setT(f.tinte);
        doc.text('Kaufpreis ' + teur(d.kaufpreis), kx, y0 - 2.4, { align: 'center' });
      }
      y = y0 + G.length * rh2 + 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); setT(f.grau);
      doc.text('Punkt: Mitte bzw. Wert · Band: untere bis obere Zahl · gestrichelt: Kaufpreis' + (d.stufen.length ? (d.ohneZiel ? ' · dunkle Punkte: Ertragswert je Stufe (Ist, Soll)' : ' · dunkle Punkte: Ertragswert je Stufe (Ist, Soll, Zielbild)') : ''), x, y);
      y += 6;
    }

    /* ── 3. Ist / Soll / Zielbild ─────────────────────────────── */
    if (d.stufen.length && T('mpiZeile')) {
      var ohne = d.stufen.filter(function (s) { return zahl(s.mpiOhne) != null; });
      if (ohne.length) {
        y = BS.absatz(doc, 'Marktpreisindikation je Stufe ohne Abschlag (Angebotsniveau): ' + ohne.map(function (s) { return sauber(s.titel) + ' ' + eur(s.mpiOhne); }).join(' · ') + '.',
          { x: x, y: y + 2.4, breite: B, zeile: 3.7, unten: unten, neueSeite: function () { return o.neueSeite(); },
            stil: function () { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); setT(f.text || f.tinte); } }) - 2.4 + 3;
      }
    }
    if (d.stufen.length && T('stufen')) {
      ueber(d.ohneZiel ? 'Ist · Soll' : 'Ist · Soll · Zielbild');   /* v3018d */
      var mitMpi = d.stufen.some(function (s) { return zahl(s.mpi) != null; });
      var sp3 = mitMpi ? [['Stufe', 58, 'l'], ['Ertragswert', 28], ['zum Kaufpreis', 24], ['Marktpreisindikation', 38], ['Maßnahmen', 26]]
        : [['Stufe', 70, 'l'], ['Ertragswert', 32], ['zum Kaufpreis', 30], ['Maßnahmen', 32]];
      var fk3 = B / sp3.reduce(function (a, s) { return a + s[1]; }, 0);
      var rh3 = mitMpi ? 8.6 : 6.4;
      platz(8 + d.stufen.length * rh3);
      var cx3 = x;
      if (o.stil === 'invest') { doc.setFillColor(f.kopfGrund[0], f.kopfGrund[1], f.kopfGrund[2]); doc.rect(x, y, B, 6.4, 'F'); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); setT(o.stil === 'invest' ? f.kopfText : [110, 110, 110]);
      sp3.forEach(function (s, i) { var bw = s[1] * fk3; if (i === 0) doc.text(s[0], cx3 + 2, y + 4.3); else doc.text(s[0], cx3 + bw - 2, y + 4.3, { align: 'right' }); cx3 += bw; });
      if (o.stil !== 'invest') { doc.setDrawColor(f.gold[0], f.gold[1], f.gold[2]); doc.setLineWidth(0.5); doc.line(x, y + 6.4, x + B, y + 6.4); doc.setLineWidth(0.2); }
      y += 6.4;
      d.stufen.forEach(function (s, n) {
        if (o.stil === 'invest' && n % 2 === 0) { doc.setFillColor(f.streifen[0], f.streifen[1], f.streifen[2]); doc.rect(x, y, B, rh3, 'F'); }
        var dk = d.kaufpreis ? (s.wert - d.kaufpreis) / d.kaufpreis * 100 : null;
        var w = [sauber(s.titel), eur(s.wert), dk != null ? pz(dk) : ''].concat(mitMpi ? [zahl(s.mpi) != null ? eur(s.mpi) : ''] : []).concat([zahl(s.kosten) ? eur(s.kosten) : '']);
        if (mitMpi && zahl(s.mpi) != null) {
          /* „nach x % Abschlag · ohne y €" klein unter der Zahl */
          var unterM = (zahl(s.mpiAb) != null ? 'nach ' + Number(s.mpiAb).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' % Abschlag' : '')
            + (zahl(s.mpiOhne) != null ? (zahl(s.mpiAb) != null ? ' · ' : '') + 'ohne ' + eur(s.mpiOhne) : '');
          if (unterM) {
            var bxM = 0; for (var q = 0; q < 4; q++) bxM += sp3[q][1] * fk3;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); setT(f.grau);
            doc.text(sauber(unterM), x + bxM - 2, y + 7.5, { align: 'right' });
          }
        }
        var cx = x;
        w.forEach(function (t, i) {
          var bw = sp3[i][1] * fk3;
          doc.setFont('helvetica', i === 1 ? 'bold' : 'normal'); doc.setFontSize(8.4); setT(i === 2 ? f.grau : f.tinte);
          if (i === 0) doc.text(t, cx + 2, y + 4.3); else if (t) doc.text(t, cx + bw - 2, y + 4.3, { align: 'right' });
          cx += bw;
        });
        doc.setDrawColor(f.linie[0], f.linie[1], f.linie[2]); doc.setLineWidth(0.15); doc.line(x, y + rh3, x + B, y + rh3); doc.setLineWidth(0.2);
        y += rh3;
      });
      /* v2992 · Parkstr. 9: Tabelle oben „nach 5,0 % Abschlag, ohne 482.000" (Bericht vom
         25.10.), Stufen „nach 6,2 % · ohne 487.000" - die Stufen rechnen mit den Angeboten
         vom Tag der PDF. Zwei Zahlen auf einer Seite brauchen ihren Grund daneben. */
      var _sb = d.stufen[0] || {};
      if (mitMpi && d.berichtAb != null && ((zahl(_sb.mpiAb) != null && Math.abs(zahl(_sb.mpiAb) - d.berichtAb) >= 0.05)
          || (zahl(_sb.mpiOhne) != null && d.berichtOhne != null && Math.abs(zahl(_sb.mpiOhne) - d.berichtOhne) >= 500))) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(6.8); setT(f.grau);
        var _hz = doc.splitTextToSize(sauber('Die Stufen sind mit den Angebotspreisen vom ' + new Date().toLocaleDateString('de-DE')
          + ' neu gerechnet; die Werte je Verfahren oben stammen aus dem Marktbericht' + (d.berichtDatum ? ' vom ' + d.berichtDatum : '')
          + '. Abschlag und Angebotsniveau können deshalb leicht abweichen.'), B);
        platz(_hz.length * 3 + 2);
        doc.text(_hz, x, y + 3.2); y += _hz.length * 3 + 1;
      }
      y += 5;
    }
    if (d.stufen.length && T('stufenText')) {
      /* v2836 · kurzer Ausblick-Hinweis (DpWertZielbild.zielbild.kurz_ausblick) */
      if (d.ausblick) {
        y += 1.6;
        y = BS.absatz(doc, d.ausblick, { x: x, y: y + 2.4, breite: B, zeile: 3.7, unten: unten,
          neueSeite: function () { return o.neueSeite(); }, stil: function () { doc.setFont('helvetica', 'italic'); doc.setFontSize(7.6); setT(f.grau); } }) - 2.4;
      }
      /* v2834 · Satz zum Sanierungsstau unter der Tafel */
      (d.stau || []).forEach(function (s) {
        y += 1.6;
        y = BS.absatz(doc, 'Sanierungsstau · ' + sauber(s.titel) + ': ' + sauber(s.satz), { x: x, y: y + 2.4, breite: B, zeile: 3.7, unten: unten,
          neueSeite: function () { return o.neueSeite(); }, stil: function () { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); setT(f.text || f.tinte); } }) - 2.4;
      });
      if (d.ausblick || (d.stau || []).length) y += 5;
    }

    /* ── 4. Erklaerung (aus wertvergleich.js) und Hinweis ───── */
    var stil = function () { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2); setT(f.text || f.tinte); };
    /* Kernaussagen der Einfach-Ansicht (DpWertZielbild.kernaussagen) */
    if (d.kern && d.kern.length && T('kern')) {
      ueber('Kernaussagen');
      d.kern.forEach(function (k) {
        platz(10);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.4); setT(f.tinte);
        /* „Heute · Miete im Jahr: 38.340 € Miete im Jahr" - die Einheit steht schon im Titel */
        var tt = sauber(k.titel), wt = sauber(k.wert_text || ''), tail = tt.split(' · ').pop(), vg = sauber(k.vergleich_text || '');
        if (tail && wt.length > tail.length && wt.slice(-tail.length) === tail) wt = wt.slice(0, -tail.length).trim();
        var kopf2 = tt + (wt ? ':  ' + wt : '') + (vg ? '  (' + vg + ')' : '');   /* v2836: Vergleich gegen heute */
        doc.splitTextToSize(kopf2, B).forEach(function (zz) { doc.text(zz, x, y); y += 4.3; });
        if (k.text) {
          y = BS.absatz(doc, sauber(k.text), { x: x, y: y, breite: B, zeile: 4.1, unten: unten, neueSeite: function () { return o.neueSeite(); }, stil: stil });
        }
        y += 1.8;
      });
      y += 2;
    }
    (T('texte') ? d.texte : []).forEach(function (t) {
      platz(18);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); setT(f.tinte);
      doc.text(t.h, x, y); y += 4.8;
      t.p.forEach(function (p) {
        y = BS ? BS.absatz(doc, p, { x: x, y: y, breite: B, zeile: 4.1, unten: unten, neueSeite: function () { return o.neueSeite(); }, stil: stil })
          : (stil(), doc.text(doc.splitTextToSize(p, B), x, y), y + 4.1 * doc.splitTextToSize(p, B).length);
        y += 1.8;
      });
      y += 1.5;
    });
    if (d.hinweis && T('hinweis')) {
      var stil2 = function () { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); setT(f.grau); };
      y = BS ? BS.absatz(doc, d.hinweis, { x: x, y: y + 1, breite: B, zeile: 3.5, unten: unten, neueSeite: function () { return o.neueSeite(); }, stil: stil2 }) : y;
    }
    return y + 2;
  }

  global.DpPdfWertZielbild = { daten: daten, zeichne: zeichne, ausBericht: ausBericht, letzterBericht: letzterBericht };
})(window);
