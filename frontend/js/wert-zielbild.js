'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   wert-zielbild.js · v2840 — Segment „Wert & Zielbild" (Tab Bewertung) und
   Einfach-Ansicht von „Ankauf · Bestand · Zielbild" (Pilot-Analyse)

   Marcel 22.10.2026: „In der Pilot-Analyse bei Ankauf · Bestand · Zielbild
   haben wir sehr viele Informationen … oben einen Reiter: einfach und genau
   … Und die Sachen, die wichtig sind und in die Bewertung gehören, sollen
   auch im Tab Bewertung stehen – vor allem das Zielbild, und die Werte, wie
   viel die Wohnung wert ist, auch mit den Verfahren."

   RECHNET NICHTS NEU. Jede Zahl kommt aus einer vorhandenen Quelle:
   · Wert je Verfahren: der letzte Marktbericht des Objekts
     (GET /marktbericht/objects/history, dieselben Felder wie wertvergleich.js)
   · Miete, Kosten, Ertragswert je Stufe: DpPotenzial (modell, kennzahlen,
     pdfDaten, stufenWerte) — der Ertragswert dort kommt aus dem Marktbericht-
     Dienst, nie aus dem Frontend
   · Ankauf gegen Bestand: DealPilotAnkauf.abweichung()
   Abgeleitet werden nur Differenzen und Verhältnisse aus diesen Zahlen.

   ── window.DpWertZielbild.daten() ──────────────────────────────────────
   Reines Datenobjekt (keine DOM-Knoten, JSON-fähig), null-sicher: jedes
   Feld ist eine Zahl, ein Text oder null. Ohne Marktbericht-Wert UND ohne
   Soll-Miete/Zielbild gibt daten() null zurück. Für den PDF-Erzeuger.
   Den Marktbericht lädt daten() nicht selbst (synchron): laden() holt ihn
   (Promise, GET, kein Kontingent) und ruft danach erneut daten().

   {
     version:      'v2840',
     objekt_key:   String|null,
     stand:        'JJJJ-MM-TT' (heute),
     wert: null | {                       // aus dem letzten Marktbericht
       bericht_datum: ISO-String|null, bericht_id: Zahl|null,
       fuehrend: 'ertragswert'|'sachwert'|'vergleichswert'|null,
       fuehrend_grund: String|null,
       marktpreisindikation: { unten, mitte, oben }   (€, nach Abschlag),
       abschlag_pct: Zahl|null,           // Abschlag auf Angebotspreise
       abschlag_herkunft: 'örtlich gemessen …'|'aktueller Marktdurchschnitt'|'eigene Angabe'|null,
       ohne_abschlag: null | { unten, mitte, oben },
       ertragswert:   null | { wert, von, bis, vorlaeufig: Bool, lzs_pct, lzs_stufe },
       sachwert:      null | { wert, vorlaeufig: Bool, faktor },
       vergleichswert:null | { wert, art: 'immobilienrichtwert'|'vergleichsfaktor' },
       kaufpreis:     Zahl|null,          // Formular (State.kpis.kp, sonst Feld #kp)
       verfahren: [                        // fertige Zeilen in Anzeigereihenfolge
         { schluessel: 'mpi'|'mpi_roh'|'ertragswert'|'sachwert'|'vergleichswert'|'kaufpreis',
           name, zusatz, unten, mitte, oben, fuehrend: Bool, abw_zur_mpi_pct: Zahl|null }
       ],
       klartext: String                    // ein bis zwei Sätze, fest formuliert
     },
     zielbild: null | {                    // nur mit Soll-Miete oder Zielbild
       kennzeichnung: String,              // „Potenzialwert …, keine Verkehrswertermittlung."
       art: 'mfh'|…, spalten: ['bestand','mieterhoehung'?,'zielbild'?],
       titel: { bestand: 'Bestand 2026', … },   // mit Jahr, wie in den PDFs
       jahre: { ankauf, mieterhoehung, zielbild },
       stufen: { <stufe>: { miete_monat, miete_jahr, miete_qm, kosten, bmy, dscr, cf_monat,
                            ertragswert, rnd, marktpreisindikation,
                            mpi_abschlag_pct, mpi_ohne_abschlag,          // v2842: Abschlag auf Angebotspreise, Wert ohne Abschlag
                            sanierungsstau: null|{ stau, kosten, behoben, rest, satz } } },   // v2854
       mehrertrag_jahr:   { mieterhoehung, zielbild }   // gegen Bestand
       wertzuwachs_nach_kosten: { mieterhoehung, zielbild }   // EW Stufe − EW Bestand − Kosten
       ertragswert_quelle: 'lauf'|'abruf'|null, ertragswert_abruf_datum: 'TT.MM.JJJJ'|null,
       ertragswert_gesperrt: Bool,         // ohne Stufe 3
       ertragswert_veraltet: Bool,         // Angaben seit dem Lauf geändert
       lzs: null | { pct, stufe, etikett },
       satz: String,                       // Satz für die Bank (pdfDaten().satz_bank)
       kurz_ausblick: String               // v2842: Kurzfassung des Ausblick-Hinweises
     },
     ankauf: null | {                      // nur mit Ankauf-Stand
       stichtag: 'JJJJ-MM-TT'|null, vergleichbar, gesamt, besser, schlechter,
       dealscore: null | { ankauf, bestand },
       bewegt: [ { wort, einheit, ankauf, bestand, pct, richtung } ],  // die drei größten
       kern:   [ { wort, einheit: 'eur'|'zahl'|'score'|…, ankauf, bestand, richtung } ]  // Jahresmiete, Cashflow v. Steuer, DSCR, DealScore
     },
     kernaussagen: [                       // v2842: bis zu sechs Kacheln der Einfach-Ansicht
       { schluessel: 'miete'|'rendite'|'ertragswert'|'kosten'|'wert'|'mpi', titel, wert: Zahl|null,
         wert_text: String, vergleich_text: String (Vergleich zu heute), ton: 'pos'|'neg'|null, text: String }
     ]
   }
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  if (global.DpWertZielbild) return;

  var VERSION = 'v2840';
  var MERKER = 'dp_pa_si_ansicht';
  var _hist = { key: null, laedt: null, eintrag: null };

  function zahl(v) { if (v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function eur(v) { var n = zahl(v); return n == null ? '–' : Math.round(n).toLocaleString('de-DE') + ' €'; }
  function eurVz(v) { var n = zahl(v); return n == null ? '–' : (n > 0 ? '+ ' : (n < 0 ? '− ' : '')) + Math.round(Math.abs(n)).toLocaleString('de-DE') + ' €'; }
  function dez(v, st) { var n = zahl(v); return n == null ? '–' : n.toLocaleString('de-DE', { minimumFractionDigits: st, maximumFractionDigits: st }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function datum(iso) { try { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('de-DE'); } catch (e) { return ''; } }
  function key() { return (typeof global._currentObjKey === 'string' && global._currentObjKey) || null; }
  function abw(a, b) { return (a != null && b) ? (a - b) / b * 100 : null; }
  function rund1(v) { return v == null ? null : Math.round(v * 10) / 10; }

  /* ── Quellen ─────────────────────────────────────────────────────────── */
  function kaufpreis() {
    var K = global.State && global.State.kpis;
    if (K && zahl(K.kp) > 0) return zahl(K.kp);
    try {
      var el = document.getElementById('kp'); if (!el) return null;
      var s = String(el.value || '').replace(/[^\d,.-]/g, ''); if (!s) return null;
      var n = Number(s.replace(/\./g, '').replace(',', '.'));
      return isFinite(n) && n > 0 ? n : null;
    } catch (e) { return null; }
  }
  /** Marktbericht des aktuellen Objekts laden (GET, kein Kontingent). */
  function laden() {
    var k = key();
    if (!k || !global.Auth || typeof global.Auth.apiCall !== 'function') return Promise.resolve(daten());
    if (_hist.key === k && _hist.laedt) return _hist.laedt;
    if (_hist.key !== k) { _hist.key = k; _hist.eintrag = null; }
    _hist.laedt = global.Auth.apiCall('/marktbericht/objects/history?key=' + encodeURIComponent('dp:' + k), { method: 'GET' })
      .then(function (j) {
        if (key() !== k) return daten();
        var letzt = null;
        ((j && j.history) || []).forEach(function (h) { if (h && h.market_value != null && (!letzt || new Date(h.created_at) >= new Date(letzt.created_at))) letzt = h; });
        _hist.eintrag = letzt; _hist.laedt = null;
        return daten();
      }, function () { _hist.laedt = null; return daten(); });
    return _hist.laedt;
  }
  function herkunftAbschlag(q) {
    q = String(q || '');
    if (!q) return null;
    if (/rtlich/i.test(q)) return q.replace(/^örtlich gemessen:?\s*/i, 'örtlich gemessen: ');
    if (/dein|eigen/i.test(q)) return 'eigene Angabe';
    return 'aktueller Marktdurchschnitt';
  }

  /* ── Wert je Verfahren (Marktbericht) ───────────────────────────────── */
  function wertDaten(h) {
    if (!h || zahl(h.market_value) == null) return null;
    var mw = zahl(h.market_value), lo = zahl(h.market_value_low), hi = zahl(h.market_value_high);
    var ab = zahl(h.angebot_abschlag_pct), roh = zahl(h.market_value_roh);
    var mitAb = ab != null && ab > 0 && roh != null;
    var fu = /^(ertragswert|sachwert|vergleichswert)$/.test(String(h.fuehrend || '')) ? String(h.fuehrend) : null;
    var ew = zahl(h.ertragswert_eur), sw = zahl(h.sachwert_eur);
    var swVorl = !!h.sachwert_vorlaeufig || h.sw_marktangepasst === false;
    var vw = zahl(h.irw_vergleichswert_eur), vwArt = vw != null ? 'immobilienrichtwert' : null;
    if (vw == null && h.vergleichsfaktor_amtlich && zahl(h.vergleichswert_eur) != null) { vw = zahl(h.vergleichswert_eur); vwArt = 'vergleichsfaktor'; }
    var kp = kaufpreis();
    var D = {
      bericht_datum: h.created_at || null, bericht_id: zahl(h.report_id != null ? h.report_id : h.id),
      fuehrend: fu, fuehrend_grund: h.fuehrend_grund ? String(h.fuehrend_grund) : null,
      marktpreisindikation: { unten: lo, mitte: mw, oben: hi },
      abschlag_pct: ab, abschlag_herkunft: mitAb ? herkunftAbschlag(h.angebot_abschlag_herkunft) : null,
      ohne_abschlag: mitAb ? { unten: zahl(h.market_value_roh_low), mitte: roh, oben: zahl(h.market_value_roh_high) } : null,
      ertragswert: ew != null ? { wert: ew, von: zahl(h.ertragswert_von_eur), bis: zahl(h.ertragswert_bis_eur),
        vorlaeufig: /vorläufig/.test(String(h.ertragswert_bezeichnung || '')), lzs_pct: zahl(h.lzs_pct), lzs_stufe: h.lzs_stufe || null } : null,
      sachwert: sw != null ? { wert: sw, vorlaeufig: swVorl, faktor: zahl(h.sw_faktor) } : null,
      vergleichswert: vw != null ? { wert: vw, art: vwArt } : null,
      kaufpreis: kp, verfahren: []
    };
    var V = D.verfahren;
    function z(s, name, zusatz, u, m, o, f) { V.push({ schluessel: s, name: name, zusatz: zusatz || null, unten: u, mitte: m, oben: o, fuehrend: !!f, abw_zur_mpi_pct: s === 'mpi' ? null : rund1(abw(m, mw)) }); }
    z('mpi', 'Marktpreisindikation', mitAb ? 'nach ' + dez(ab, 1) + ' % Abschlag auf Angebotspreise' : 'aus Angebotspreisen vergleichbarer Objekte', lo, mw, hi, fu === 'vergleichswert' && vw == null);
    if (mitAb) z('mpi_roh', 'ohne Abschlag', 'Angebotsniveau, wie es im Markt ausgeschrieben ist', D.ohne_abschlag.unten, roh, D.ohne_abschlag.oben, false);
    if (ew != null) z('ertragswert', D.ertragswert.vorlaeufig ? 'Ertragswert (vorläufig)' : 'Ertragswert',
      D.ertragswert.lzs_pct != null ? 'Liegenschaftszins ' + dez(D.ertragswert.lzs_pct, 2) + ' %' + (D.ertragswert.lzs_stufe ? ', Stufe ' + D.ertragswert.lzs_stufe : '') : null,
      D.ertragswert.von, ew, D.ertragswert.bis, fu === 'ertragswert');
    if (sw != null) z('sachwert', swVorl ? 'Sachwert (vorläufig)' : 'Sachwert', swVorl ? 'ohne Sachwertfaktor, nicht an den Markt angepasst' : (D.sachwert.faktor != null ? 'mit Sachwertfaktor ' + dez(D.sachwert.faktor, 2) : null), null, sw, null, fu === 'sachwert');
    if (vw != null) z('vergleichswert', 'Vergleichswert', vwArt === 'immobilienrichtwert' ? 'aus dem Immobilienrichtwert' : 'mit amtlichem Vergleichsfaktor', null, vw, null, fu === 'vergleichswert');
    if (kp != null) z('kaufpreis', 'Kaufpreis', 'deine Angabe', null, kp, null, false);
    /* Klartext: führendes Verfahren und Lage des Kaufpreises - nur am Bericht Ablesbares */
    var VERF = { ertragswert: 'Ertragswert', sachwert: 'Sachwert', vergleichswert: 'Vergleichswert' };
    var t = [];
    var fuWert = fu === 'ertragswert' ? ew : (fu === 'sachwert' ? sw : (fu === 'vergleichswert' ? (vw != null ? vw : mw) : null));
    if (fu && fuWert != null) t.push('Führend ist der ' + VERF[fu] + ' mit ' + eur(fuWert) + ': an ihm misst sich der Preis, die übrigen Werte sind die Gegenprobe.');
    else t.push('Die Marktpreisindikation liegt bei ' + eur(mw) + (lo != null && hi != null ? ', vergleichbare Angebote zwischen ' + eur(lo) + ' und ' + eur(hi) : '') + '.');
    if (kp != null) {
      var dk = abw(kp, fuWert != null ? fuWert : mw);
      if (dk != null) t.push('Dein Kaufpreis von ' + eur(kp) + ' liegt ' + (Math.abs(dk) < 0.05 ? 'gleichauf mit dem ' : dez(Math.abs(dk), 1) + ' % ' + (dk < 0 ? 'unter dem ' : 'über dem '))
        + (fu && fuWert != null ? VERF[fu] : 'Mittelwert der Marktpreisindikation') + '.');
    }
    D.klartext = t.join(' ');
    return D;
  }

  /* ── Ist · Mieterhöhung · Zielbild (DpPotenzial) ─────────────────────── */
  function zielDaten() {
    var PZ = global.DpPotenzial; if (!PZ || typeof PZ.modell !== 'function') return null;
    var m = null; try { m = PZ.modell(); } catch (e) { m = null; }
    if (!m || !m.aktiv || !m.stufen || !m.stufen.bestand) return null;
    var kz = {}; try { kz = PZ.kennzahlen(m) || {}; } catch (e) { kz = {}; }
    var pd = null; try { pd = PZ.pdfDaten(); } catch (e) { pd = null; }
    var sw = null; try { sw = PZ.stufenWerte ? PZ.stufenWerte() : null; } catch (e) { sw = null; }
    var S = (sw && sw.S) || {};
    var spalten = ['bestand'].concat(m.stufen.mieterhoehung ? ['mieterhoehung'] : []).concat(m.stufen.zielbild ? ['zielbild'] : []);
    var st = {};
    spalten.forEach(function (k) {
      var s = m.stufen[k] || {}, x = kz[k] || {}, w = S[k] || {};
      st[k] = { miete_monat: zahl(s.miete_m) != null ? Math.round(s.miete_m) : null,
        miete_jahr: zahl(x.miete_j) != null ? Math.round(x.miete_j) : (zahl(s.miete_m) != null ? Math.round(s.miete_m * 12) : null),
        miete_qm: zahl(x.miete_qm) != null ? Math.round(x.miete_qm * 100) / 100 : null,
        kosten: zahl(s.kosten) || 0, bmy: zahl(x.bmy) != null ? Math.round(x.bmy * 100) / 100 : null,
        dscr: zahl(x.dscr) != null ? Math.round(x.dscr * 100) / 100 : null, cf_monat: zahl(x.cf_m) != null ? Math.round(x.cf_m) : null,
        ertragswert: zahl(w.ertragswert), rnd: zahl(w.rnd), marktpreisindikation: zahl(w.marktpreisindikation),
        /* v2842 · Abschlag und Wert ohne Abschlag; Sanierungsstau der Stufe (v2854) */
        mpi_abschlag_pct: zahl(w.mpi_abschlag_pct), mpi_ohne_abschlag: zahl(w.mpi_ohne_abschlag), sanierungsstau: w.sanierungsstau || null };
    });
    var B = st.bestand;
    var mehr = {}, zuw = {};
    ['mieterhoehung', 'zielbild'].forEach(function (k) {
      if (!st[k]) { mehr[k] = null; zuw[k] = null; return; }
      mehr[k] = st[k].miete_jahr != null && B.miete_jahr != null ? st[k].miete_jahr - B.miete_jahr : null;
      zuw[k] = st[k].ertragswert != null && B.ertragswert != null ? st[k].ertragswert - B.ertragswert - (st[k].kosten || 0) : null;
    });
    return {
      kennzeichnung: PZ.KENNZEICHNUNG || 'Die Ertragswerte nach Mieterhöhung und im Zielbild sind ein Ausblick: Sie unterstellen, dass die höhere Miete erzielt bzw. die Maßnahmen umgesetzt sind. Sie sind kein Verkehrswert nach § 194 BauGB zum heutigen Stichtag. Maßgeblich für den heutigen Wert ist der Ertragswert im Bestand.',
      art: m.art || null, spalten: spalten,
      titel: (pd && pd.titel) || { bestand: 'Bestand', mieterhoehung: 'Mieterhöhung', zielbild: 'Zielbild' },
      jahre: (pd && pd.jahre) || { ankauf: null, mieterhoehung: null, zielbild: null },
      stufen: st, mehrertrag_jahr: mehr, wertzuwachs_nach_kosten: zuw,
      ertragswert_quelle: sw && sw.quelle ? sw.quelle : null,
      ertragswert_abruf_datum: sw && sw.quelle === 'abruf' ? (sw.datum || null) : null,
      ertragswert_gesperrt: !!(sw && sw.gesperrt), ertragswert_veraltet: !!(sw && sw.veraltet),
      lzs: sw && sw.lzs ? { pct: zahl(sw.lzs.pct), stufe: sw.lzs.stufe || null, etikett: sw.lzs.etikett || null } : null,
      satz: pd && pd.satz_bank ? String(pd.satz_bank) : '',
      kurz_ausblick: PZ.KURZ_AUSBLICK || 'Ausblick: Mieterhöhung und Zielbild unterstellen die höhere Miete bzw. umgesetzte Maßnahmen – kein heutiger Verkehrswert.'
    };
  }

  /* ── Ankauf gegen Bestand ─────────────────────────────────────────────── */
  function ankaufDaten() {
    var AK = global.DealPilotAnkauf; if (!AK || typeof AK.vorhanden !== 'function') return null;
    var a = null; try { a = AK.vorhanden() ? AK.abweichung() : null; } catch (e) { a = null; }
    if (!a || !Array.isArray(a.zeilen)) return null;
    var Z = a.zeilen;
    var bewegt = Z.filter(function (z) { return z.richtung !== 'gleich' && z.wort !== 'DealScore' && z.pct != null && isFinite(z.pct); })
      .sort(function (x, y) { return Math.abs(y.pct) - Math.abs(x.pct); }).slice(0, 3)
      .map(function (z) { return { wort: z.wort, einheit: z.einheit, ankauf: zahl(z.ankauf), bestand: zahl(z.bestand), pct: rund1(z.pct), richtung: z.richtung }; });
    return { stichtag: a.stichtag || null, vergleichbar: Z.length, gesamt: (AK.KENNZAHLEN || []).length || null,
      besser: Z.filter(function (z) { return z.richtung === 'besser'; }).length,
      schlechter: Z.filter(function (z) { return z.richtung === 'schlechter'; }).length,
      dealscore: a.scoreAnkauf != null && a.scoreJetzt != null ? { ankauf: zahl(a.scoreAnkauf), bestand: zahl(a.scoreJetzt) } : null,
      bewegt: bewegt,
      kern: ['Jahresmiete', 'Cashflow v. Steuer', 'DSCR', 'DealScore'].map(function (w) { return Z.filter(function (z) { return z.wort === w; })[0]; }).filter(Boolean)
        .map(function (z) { return { wort: z.wort, einheit: z.wort === 'DealScore' ? 'score' : z.einheit, ankauf: zahl(z.ankauf), bestand: zahl(z.bestand), richtung: z.richtung }; }) };
  }
  function fmtE(v, e) {
    if (v == null) return '–';
    if (e === 'eur') return eur(v);
    if (e === 'pct') return dez(v, 2) + ' %';
    if (e === 'eurqm') return dez(v, 2) + ' €/m²';
    if (e === 'stk') return String(Math.round(v));
    return e === 'score' ? dez(v, 0) : dez(v, 2);
  }

  /* ── Kernaussagen (Einfach) ───────────────────────────────────────────── */
  /* v2842 · Marcel 22.10.2026: „zu dünn" - je Kachel die Zahl, der Vergleich zu heute und ein
     Satz: Miete, Rendite, Ertragswert, Maßnahmen, Wertzuwachs nach Kosten, Marktpreisindikation. */
  function pctTxt(v) { return dez(v, 2) + ' %'; }
  function delta(neu, alt, einheit) {
    if (neu == null || alt == null) return '';
    var d = neu - alt;
    if (einheit === 'pct') return (d >= 0 ? '+' : '−') + dez(Math.abs(d), 2) + ' %-Pkt.';
    return eurVz(d) + (alt ? ' (' + (d >= 0 ? '+' : '−') + dez(Math.abs(d / alt * 100), 1) + ' %)' : '');
  }
  function kernaussagen(Z, W) {
    var K = [];
    if (!Z) return K;
    var B = Z.stufen.bestand, M = Z.stufen.mieterhoehung, T = Z.stufen.zielbild, J = Z.jahre || {};
    var top = T || M, topK = T ? 'zielbild' : 'mieterhoehung';
    var alt = Z.ertragswert_quelle === 'abruf' ? 'Stand Abruf ' + (Z.ertragswert_abruf_datum || '') + ', veraltet – wird neu gerechnet' : '';
    var stufeWort = T ? 'Zielbild' + (J.zielbild ? ' ' + J.zielbild : '') : 'nach Mieterhöhung' + (J.mieterhoehung ? ' ' + J.mieterhoehung : '');
    if (!top) return K;
    K.push({ schluessel: 'miete', titel: 'Kaltmiete im Jahr · ' + stufeWort, wert: top.miete_jahr, wert_text: eur(top.miete_jahr),
      vergleich_text: 'heute ' + eur(B.miete_jahr) + ' · ' + delta(top.miete_jahr, B.miete_jahr), ton: 'pos',
      text: M && T ? 'Davon ' + eurVz(Z.mehrertrag_jahr.mieterhoehung) + ' ohne Mieterwechsel' + (J.mieterhoehung ? ' ab ' + J.mieterhoehung : '') + ', der Rest nach Umbau oder Neuvermietung.'
        : (M ? 'Ohne Mieterwechsel, bis zur Vergleichsmiete und innerhalb der Kappungsgrenze.' : 'Nach Umbau oder Neuvermietung.') });
    if (top.bmy != null) K.push({ schluessel: 'rendite', titel: 'Bruttomietrendite · ' + stufeWort, wert: top.bmy, wert_text: pctTxt(top.bmy),
      vergleich_text: B.bmy != null ? 'heute ' + pctTxt(B.bmy) + ' · ' + delta(top.bmy, B.bmy, 'pct') : '', ton: B.bmy != null ? (top.bmy >= B.bmy ? 'pos' : 'neg') : null,
      text: 'Jahresmiete auf Kaufpreis plus Maßnahmen' + (top.cf_monat != null ? '; Cashflow ' + eur(top.cf_monat) + ' im Monat' : '') + '.' });
    var stau = top.sanierungsstau;
    if (Z.ertragswert_gesperrt) K.push({ schluessel: 'ertragswert', titel: 'Ertragswert · ' + stufeWort, wert: null, wert_text: 'mit Stufe 3', vergleich_text: '',
      text: 'Den Ertragswert je Stufe rechnet DealPilot Stufe 3 (Wertermittlung nach ImmoWertV).' });
    else if (top.ertragswert != null && B.ertragswert != null) K.push({ schluessel: 'ertragswert', titel: 'Ertragswert · ' + stufeWort, wert: top.ertragswert, wert_text: eur(top.ertragswert),
      vergleich_text: 'heute ' + eur(B.ertragswert) + ' · ' + delta(top.ertragswert, B.ertragswert), ton: alt ? null : (top.ertragswert >= B.ertragswert ? 'pos' : 'neg'), veraltet: !!alt,
      text: alt ? alt + '.' : 'Ausblick' + (Z.lzs && Z.lzs.pct != null ? ' mit Liegenschaftszins ' + dez(Z.lzs.pct, 2) + ' %' : '')
        + (stau && stau.behoben > 0 ? '; ' + eur(stau.behoben) + ' Sanierungsstau durch die Maßnahmen behoben, Rest ' + eur(stau.rest || 0) : '') + '.' });
    else K.push({ schluessel: 'ertragswert', titel: 'Ertragswert · ' + stufeWort, wert: null, wert_text: 'noch nicht gerechnet', vergleich_text: '',
      text: 'Unter „Genau" mit „Ertragswerte rechnen" (ohne Kontingent).' });
    var kost = top.kosten || 0;
    K.push({ schluessel: 'kosten', titel: 'Maßnahmen', wert: kost, wert_text: eur(kost),
      vergleich_text: M && T && M.kosten ? 'davon ' + eur(M.kosten) + ' für die Mieterhöhung' : (kost ? 'bis ' + (T ? 'zum Zielbild' : 'zur Mieterhöhung') : 'keine eingetragen'),
      text: kost ? 'Kosten der Maßnahmen, ohne Finanzierung.' : 'Ohne Maßnahmen steigt nur die Miete.' });
    var zw = Z.wertzuwachs_nach_kosten[topK];
    if (!Z.ertragswert_gesperrt && zw != null) K.push({ schluessel: 'wert', titel: 'Wertzuwachs nach Kosten', wert: zw, wert_text: eurVz(zw), ton: alt ? null : (zw >= 0 ? 'pos' : 'neg'), veraltet: !!alt,
      vergleich_text: 'Ertragswert ' + (T ? 'Zielbild' : 'nach Erhöhung') + ' − heute − Maßnahmen',
      text: alt ? alt + '.' : (zw >= 0 ? 'Die Maßnahmen bringen mehr Ertragswert, als sie kosten.' : 'Die Maßnahmen kosten mehr, als sie an Ertragswert bringen.') });
    /* Marktpreisindikation heute - aus dem Marktbericht, sonst aus der Stufe Bestand; immer mit Abschlag */
    var mw = W ? W.marktpreisindikation.mitte : B.marktpreisindikation;
    var ab = W ? W.abschlag_pct : B.mpi_abschlag_pct;
    var ohne = W ? (W.ohne_abschlag ? W.ohne_abschlag.mitte : null) : B.mpi_ohne_abschlag;
    if (mw != null) {
      var kp = W ? W.kaufpreis : null;
      K.push({ schluessel: 'mpi', titel: 'Marktpreisindikation heute', wert: mw, wert_text: eur(mw),
        vergleich_text: (ab > 0 ? 'nach ' + dez(ab, 1) + ' % Abschlag' : 'ohne Abschlag') + (ohne != null && ab > 0 ? ' · ohne ' + eur(ohne) : ''),
        text: 'Aus Angebotspreisen am Ort; der Abschlag holt sie auf gezahlte Kaufpreise' + (kp != null ? '. Dein Kaufpreis ' + eur(kp) + ' liegt ' + dez(Math.abs((kp - mw) / mw * 100), 1) + ' % ' + (kp < mw ? 'darunter' : 'darüber') : '') + '.' });
    }
    return K;
  }

  /** Das Datenobjekt (siehe Kopf). null, wenn weder Wert noch Zielbild vorliegt. */
  /* v2843 · POST /marktbericht/potenzial kostet kein Kontingent (routes/marktbericht.js: „kein
     Bericht, kein Kontingent, keine KI"). Einmal je Objekt und Sitzung; das Ergebnis liegt nur im
     Speicher (window._dpPotenzial) und kommt erst mit dem nächsten Sichern des Objekts in die Datenbank. */
  var _autoVersucht = {}, _autoLaeuft = false;
  function autoRechnen() {
    var k = key(), PZ = global.DpPotenzial;
    if (!k || _autoVersucht[k] || _autoLaeuft || !PZ || typeof PZ.rechnen !== 'function') return;
    _autoVersucht[k] = 1; _autoLaeuft = true;
    setTimeout(function () {
      var fertig = function () { _autoLaeuft = false; try { einfachNeu(); } catch (e) {} karteBald(false); };
      try { PZ.rechnen({ erzwingen: true }).then(fertig, fertig); } catch (e) { fertig(); }
    }, 0);
  }
  function daten() {
    var W = null, Z = null, A = null;
    try { W = (_hist.key === key()) ? wertDaten(_hist.eintrag) : null; } catch (e) { W = null; }
    try { Z = zielDaten(); } catch (e) { Z = null; }
    try { A = ankaufDaten(); } catch (e) { A = null; }
    if (!W && !Z) return null;
    /* v2843 · Befund Rechenwege-Prüfer 22.10.2026: ohne aktuellen Lauf fiel die Tafel still auf
       den letzten Abruf „Marktpreise" zurück (Westerfeld: Zielbild 910.000 € aus dem Abruf vom
       20.10., vor der Bandkappung; der Kern rechnet heute 895.000 €). Ein solcher Stand ist
       veraltet und wird so genannt; der Lauf ist kostenlos und wird angestoßen (autoRechnen). */
    if (Z && !Z.ertragswert_gesperrt && Z.ertragswert_quelle !== 'lauf') {
      Z.ertragswert_veraltet = true;
      Z.ertragswert_hinweis = Z.ertragswert_quelle === 'abruf'
        ? 'Ertragswerte: Stand des Abrufs vom ' + (Z.ertragswert_abruf_datum || '') + ', veraltet – werden neu gerechnet (kostenlos).'
        : 'Ertragswerte noch nicht gerechnet – werden gerechnet (kostenlos).';
      autoRechnen();
    } else if (Z) Z.ertragswert_hinweis = null;
    var K = []; try { K = kernaussagen(Z, W); } catch (e) { K = []; }
    return { version: VERSION, objekt_key: key(), stand: new Date().toISOString().slice(0, 10), wert: W, zielbild: Z, ankauf: A, kernaussagen: K };
  }

  /* ── Gestaltung ───────────────────────────────────────────────────────── */
  /* Alle Knöpfe tragen .btn-clean: „.sec button:not(…)" in style.css (Z. 30576) setzt
     sonst Grund, Rahmen und Schrift mit !important - der gedrückte Umschalter sah aus
     wie der freie (gemessen v2840: Grund weiß statt Gold). .btn-clean ist dort ausgenommen. */
  function stil() {
    if (document.getElementById('dp-wz-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-wz-stil';
    s.textContent = [
      /* Umschalter Einfach | Genau (Pilot-Analyse) */
      '.dp-si-kopf{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 12px}',
      '.dp-si-um{display:inline-flex;border:1px solid color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 45%,transparent);border-radius:999px;padding:2px;background:#fff}',
      '.dp-si-um button{font:600 12px/1 Inter,system-ui,sans-serif;border:0;background:transparent;color:#6B645A;padding:7px 14px;border-radius:999px;cursor:pointer;min-height:30px}',
      '.dp-si-um button[aria-pressed="true"]{background:var(--wl-c9a84c, #C9A84C);color:#1d1a14}',
      '.dp-si-um button:focus-visible{outline:2px solid var(--wl-b8932f, #b8932f);outline-offset:2px}',
      '.dp-si-hin{font:400 11.5px/1.4 Inter,sans-serif;color:#6B645A}',
      '[data-dp-si-modus="einfach"] [data-dp-si-teil="genau"],[data-dp-si-modus="genau"] [data-dp-si-teil="einfach"]{display:none !important}',
      '[data-dp-si-modus] .dp-pa-card,[data-dp-si-modus] .abw-tafel-host,[data-dp-si-modus]{scroll-margin-top:130px}',
      '.dp-si-nav{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}',
      '.dp-si-nav button{font:500 11.5px Inter,sans-serif;border:1px solid #E6DCC2;border-radius:999px;background:#fff;color:#2A2727;padding:5px 11px;cursor:pointer}',
      '.dp-si-nav button:hover{border-color:var(--wl-c9a84c, #C9A84C)}',
      /* Kacheln (Einfach und Segment) */
      '.dp-wz-kacheln{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 12px}',
      '.dp-wz-k{border:1px solid #EDE6D6;border-top:3px solid #D9D2C3;border-radius:10px;padding:10px 12px;background:#fff;min-width:0}',
      '.dp-wz-k.ist{border-top-color:#2A2727}.dp-wz-k.soll{border-top-color:var(--wl-e8cc7a, #E8CC7A)}.dp-wz-k.ziel{border-top-color:var(--wl-b8932f, #b8932f)}',
      '.dp-wz-k.kosten{border-top-color:#C98A84}.dp-wz-k.wert{border-top-color:var(--wl-c9a84c, #C9A84C);background:#FBF6E9}',
      '.dp-wz-k .t{display:block;font:600 10px/1.2 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B645A;margin-bottom:4px}',
      '.dp-wz-k .w{display:block;font:700 18px/1.2 "Space Grotesk",Inter,sans-serif;color:#2A2727;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
      '.dp-wz-k .x{display:block;font:400 11.5px/1.45 Inter,sans-serif;color:#6B645A;margin-top:4px}',
      '.dp-wz-k .v{display:block;font:600 11.5px/1.4 Inter,sans-serif;color:#4a4436;margin-top:3px;font-variant-numeric:tabular-nums}',
      '.dp-wz-k .v.dp-wz-pos,.dp-wz-k .w.dp-wz-pos{color:#2f7d55}.dp-wz-k .v.dp-wz-neg,.dp-wz-k .w.dp-wz-neg{color:#B8625C}',
      '.dp-wz-k.alt .w{color:#8A8272;text-decoration:line-through;text-decoration-thickness:1px}.dp-wz-k.alt .x{color:#96690f;font-weight:600}',
      '.dp-wz-alt{font:600 11.5px/1.45 Inter,sans-serif;color:#96690f;background:rgba(201,150,40,.10);border:1px solid rgba(201,150,40,.4);border-radius:8px;padding:6px 10px;margin:0 0 10px}',
      '.dp-wz-ausblick{font:400 11.5px/1.5 Inter,sans-serif;color:#4a4436;background:#FBF6E9;border-left:3px solid var(--wl-c9a84c, #C9A84C);padding:6px 10px;margin:8px 0 10px}',
      '.dp-wz-klar{font:400 13px/1.6 Inter,system-ui,sans-serif;color:#2A2727;margin:0 0 10px;max-width:80ch}',
      '.dp-wz-klar b.dp-wz-pos{color:#2f7d55}.dp-wz-klar b.dp-wz-neg{color:#B8625C}',
      '.dp-wz-mehr{font:600 12px Inter,sans-serif;border:1px solid #E6DCC2;border-radius:8px;background:#fff;color:#2A2727;padding:6px 12px;cursor:pointer}',
      '.dp-wz-kenn{font:400 11px/1.5 Inter,sans-serif;color:#6B645A;margin:8px 0 0}',
      /* Segment im Tab Bewertung */
      '#card-wert-zielbild{color:#2A2727}',
      '#card-wert-zielbild .ct{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '#card-wert-zielbild .dp-wz-h{font:700 10px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#6B645A;margin:16px 0 8px}',
      '#card-wert-zielbild .dp-wz-h:first-child{margin-top:0}',
      '#card-wert-zielbild .dp-wz-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}',
      '#card-wert-zielbild table.dp-wz-t{width:100%;border-collapse:collapse;font:400 12.5px/1.4 Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums}',
      '#card-wert-zielbild .dp-wz-t th{font:600 9.5px/1.2 "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B645A;text-align:right;padding:6px 8px;border-bottom:1px solid #E6DCC2;white-space:nowrap}',
      '#card-wert-zielbild .dp-wz-t th:first-child,#card-wert-zielbild .dp-wz-t td:first-child{text-align:left}',
      '#card-wert-zielbild .dp-wz-t td{padding:7px 8px;border-bottom:1px solid #F0ECE4;text-align:right;white-space:nowrap;vertical-align:top}',
      '#card-wert-zielbild .dp-wz-t td:first-child{white-space:normal;min-width:130px}',
      '#card-wert-zielbild .dp-wz-t td small{display:block;font:400 10.5px/1.35 Inter,sans-serif;color:#8A8272;white-space:normal}',
      '#card-wert-zielbild .dp-wz-t tr.fu td{background:color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 8%,transparent)}',
      '#card-wert-zielbild .dp-wz-t tr.kp td{border-top:1.5px solid #2A2727}',
      '#card-wert-zielbild .dp-wz-t tr.sum td{font-weight:700;border-top:1.5px solid #2A2727}',
      '#card-wert-zielbild .dp-wz-t .dp-wz-pos{color:#2f7d55}#card-wert-zielbild .dp-wz-t .dp-wz-neg{color:#B8625C}',
      '#card-wert-zielbild .dp-wz-t th.c-soll{box-shadow:inset 0 -2px 0 var(--wl-e8cc7a, #E8CC7A)}#card-wert-zielbild .dp-wz-t th.c-ziel{box-shadow:inset 0 -2px 0 var(--wl-b8932f, #b8932f)}',
      '#card-wert-zielbild .dp-wz-tag{font:600 9px/1 "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;padding:2px 5px;border-radius:4px;border:1px solid color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 60%,transparent);color:var(--wl-b8932f, #b8932f);vertical-align:1px;margin-left:4px;white-space:nowrap}',
      '#card-wert-zielbild .dp-wz-kz{font:600 9.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#2f7d55;border:1px solid #2f7d55;border-radius:999px;padding:1px 8px;margin-left:auto;white-space:nowrap}',
      '#card-wert-zielbild .dp-wz-t td small.dp-wz-spm{display:none}',
      '@media (min-width:641px){#card-wert-zielbild table.dp-wz-verf{min-width:560px}#card-wert-zielbild table.dp-wz-stufen{min-width:440px}}',
      '@media (max-width:640px){#card-wert-zielbild .dp-wz-spc{display:none}#card-wert-zielbild .dp-wz-t td small.dp-wz-spm{display:block}#card-wert-zielbild .dp-wz-t td,#card-wert-zielbild .dp-wz-t th{white-space:normal}#card-wert-zielbild .dp-wz-t td:first-child{min-width:92px}}',
      '#card-wert-zielbild .dp-wz-quelle{font:400 11px/1.5 Inter,sans-serif;color:#6B645A;margin:6px 0 0}',
      '#card-wert-zielbild .dp-wz-quelle button{font:600 11px Inter,sans-serif;border:0;background:none;color:var(--wl-b8932f, #b8932f);padding:0;cursor:pointer;text-decoration:underline}',
      '#card-wert-zielbild details.dp-wz-det{margin-top:14px;border-top:1px solid #F0ECE4;padding-top:10px}',
      '#card-wert-zielbild details.dp-wz-det>summary{cursor:pointer;font:600 12.5px Inter,sans-serif;color:#2A2727;list-style-position:inside}',
      '#card-wert-zielbild #card-wertpotenzial{margin-top:10px}',
      '#card-wert-zielbild #card-wertpotenzial>.ct{display:none}',
      '#card-wertpotenzial .dp-pot-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font:500 11px/1.4 Inter,sans-serif;color:#6B645A;margin:0 0 8px}',
      '#card-wertpotenzial .dp-pot-leg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:0}',
      '@media (max-width:640px){.dp-wz-kacheln{grid-template-columns:repeat(2,minmax(0,1fr))}.dp-wz-k .w{font-size:15.5px}.dp-wz-k{padding:8px 10px}'
        + '#card-wert-zielbild .dp-wz-t th,#card-wert-zielbild .dp-wz-t td{padding:6px 4px;font-size:11.5px}#card-wert-zielbild .dp-wz-t td:first-child{min-width:92px}'
        + '#card-wert-zielbild .dp-wz-t th{font-size:9px;letter-spacing:.03em}}',
      '@media (max-width:420px){.dp-wz-k.wert{grid-column:1 / -1}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Einfach-Ansicht (Pilot-Analyse) ──────────────────────────────────── */
  var ART = { ist: 'ist', soll: 'soll', ziel: 'ziel', kosten: 'kosten', wert: 'wert', miete: 'ziel', rendite: 'soll', ertragswert: 'ziel', mpi: 'ist' };
  function kachelnHtml(K) {
    return '<div class="dp-wz-kacheln">' + K.map(function (k) {
      return '<div class="dp-wz-k ' + (ART[k.schluessel] || '') + (k.veraltet ? ' alt' : '') + '" data-dp-wz-kern="' + k.schluessel + '"' + (k.veraltet ? ' data-dp-wz-veraltet="1"' : '') + '><span class="t">' + esc(k.titel) + '</span>'
        + '<span class="w' + (k.ton && k.schluessel === 'wert' ? ' dp-wz-' + k.ton : '') + '">' + esc(k.wert_text) + '</span>'
        + (k.vergleich_text ? '<span class="v' + (k.ton ? ' dp-wz-' + k.ton : '') + '">' + esc(k.vergleich_text) + '</span>' : '')
        + '<span class="x">' + esc(k.text) + '</span></div>';
    }).join('') + '</div>';
  }
  function klartextZiel(Z) {
    var B = Z.stufen.bestand, M = Z.stufen.mieterhoehung, T = Z.stufen.zielbild, J = Z.jahre || {};
    var s = [];
    s.push('Heute bringt das Objekt <b>' + esc(eur(B.miete_jahr)) + '</b> Kaltmiete im Jahr.');
    if (M) s.push('Ohne Mieterwechsel lässt sich die Miete' + (J.mieterhoehung ? ' ab ' + J.mieterhoehung : '') + ' um <b>' + esc(eur(Z.mehrertrag_jahr.mieterhoehung)) + '</b> im Jahr anheben.');
    if (T) s.push('Im Zielbild, nach Umbau oder Neuvermietung, sind es <b>' + esc(eur(T.miete_jahr)) + '</b> im Jahr' + (T.kosten > 0 ? ', dafür fallen Maßnahmen von <b>' + esc(eur(T.kosten)) + '</b> an' : '') + '.');
    var top = T || M, topK = T ? 'zielbild' : 'mieterhoehung';
    if (top && !Z.ertragswert_gesperrt && Z.ertragswert_quelle === 'lauf' && top.ertragswert != null && B.ertragswert != null) {   /* v2843: nie mit veraltetem Abruf */
      var zw = Z.wertzuwachs_nach_kosten[topK];
      s.push('Der Ertragswert steigt von ' + esc(eur(B.ertragswert)) + ' auf <b>' + esc(eur(top.ertragswert)) + '</b>'
        + (zw != null ? '; nach Abzug der Kosten bleiben <b class="' + (zw >= 0 ? 'dp-wz-pos' : 'dp-wz-neg') + '">' + esc(eurVz(zw)) + '</b> Wertzuwachs' : '') + '.');
      if (Z.ertragswert_quelle === 'abruf') s.push('<span class="dp-si-hin">(Werte aus dem Abruf „Marktpreise" vom ' + esc(Z.ertragswert_abruf_datum || '') + '.)</span>');
    }
    return s.join(' ');
  }
  function klartextAnkauf(A) {
    if (!A) return '';
    var t = 'Gegenüber dem Ankauf' + (A.stichtag ? ' (Stand ' + esc(A.stichtag.split('-').reverse().join('.')) + ')' : '') + ' stehen <b>' + A.besser + '</b> von '
      + A.vergleichbar + ' Kennzahlen besser und <b>' + A.schlechter + '</b> schlechter.';
    if (A.bewegt.length) t += ' Am stärksten bewegt: ' + A.bewegt.map(function (z) {
      return esc(z.wort) + ' <b class="' + (z.richtung === 'besser' ? 'dp-wz-pos' : 'dp-wz-neg') + '">' + (z.pct > 0 ? '+' : '−') + esc(dez(Math.abs(z.pct), 0)) + ' %</b>';
    }).join(', ') + '.';
    if (A.dealscore && A.dealscore.ankauf !== A.dealscore.bestand) t += ' Der DealScore ging von ' + esc(dez(A.dealscore.ankauf, 0)) + ' auf ' + esc(dez(A.dealscore.bestand, 0)) + '.';
    return t;
  }
  /** opts.mitAnkauf: der Abgleich Ankauf gegen Bestand gehört in diese Ansicht. */
  function einfachHtml(opts) {
    opts = opts || {};
    stil();
    var D = daten();
    var Z = D && D.zielbild, A = opts.mitAnkauf && D ? D.ankauf : null;
    var h = '';
    if (Z) {
      h += (Z.ertragswert_hinweis ? '<div class="dp-wz-alt" data-dp-wz-alt="1">' + esc(Z.ertragswert_hinweis) + ' <button type="button" class="dp-pot-knopf btn-clean dp-wz-mehr" data-dp-pot-rechnen="1">Jetzt rechnen</button></div>' : '') + kachelnHtml(D.kernaussagen) + '<p class="dp-wz-klar">' + klartextZiel(Z) + '</p>';   /* v2843 */
    }
    if (A && !Z && A.kern.length) {
      /* Ankauf-Stand ohne Zielbild: die Kernzahlen Ankauf -> heute als Kacheln */
      h += '<div class="dp-wz-kacheln">' + A.kern.map(function (z) {
        return '<div class="dp-wz-k ' + (z.richtung === 'besser' ? 'ziel' : (z.richtung === 'schlechter' ? 'kosten' : 'ist')) + '"><span class="t">' + esc(z.wort) + '</span>'
          + '<span class="w">' + esc(fmtE(z.bestand, z.einheit)) + '</span><span class="x">beim Ankauf ' + esc(fmtE(z.ankauf, z.einheit)) + '</span></div>';
      }).join('') + '</div>';
    }
    if (A) h += '<p class="dp-wz-klar">' + klartextAnkauf(A) + '</p>';
    if (!h) return '';
    if (Z) h += '<p class="dp-wz-ausblick">' + esc(Z.kurz_ausblick) + '</p>';
    h += '<button type="button" class="dp-wz-mehr btn-clean" data-dp-si-knopf="genau">Alle Zahlen zeigen (Genau)</button>';
    return h;
  }
  function modus() { try { var v = localStorage.getItem(MERKER); return v === 'genau' ? 'genau' : 'einfach'; } catch (e) { return 'einfach'; } }
  /** Der ganze Reiterinhalt: Umschalter, Einfach, Genau (genauHtml = das Bisherige). */
  function reiterHtml(genauHtml, opts) {
    opts = opts || {};
    stil();
    var e = '';
    try { e = einfachHtml(opts); } catch (x) { e = ''; }
    /* v2842 · der Marktbericht (Marktpreisindikation mit und ohne Abschlag) lädt nach - dann die Kacheln neu */
    if (_hist.key !== key()) { try { laden().then(function () { einfachNeu(); }); } catch (x) {} }
    if (!e) return genauHtml;   /* nichts Einfaches zu sagen: wie bisher */
    var m = modus();
    var nav = '<div class="dp-si-nav" role="navigation" aria-label="Inhalt">'
      + (opts.mitPot ? '<button type="button" class="btn-clean" data-dp-si-sprung="[data-dp-pot-wirt]">Ist · Mieterhöhung · Zielbild</button><button type="button" class="btn-clean" data-dp-si-sprung="[data-dp-pot-markt]">Marktpreise</button>' : '')
      + (opts.mitAnkauf ? '<button type="button" class="btn-clean" data-dp-si-sprung=".abw-tafel-host">Ankauf gegen Bestand</button><button type="button" class="btn-clean" data-dp-si-sprung="[data-dp-si-pilot]">Pilot damals und heute</button>' : '')
      + '</div>';
    return '<div class="dp-si" data-dp-si-modus="' + m + '">'
      + '<div class="dp-si-kopf"><div class="dp-si-um" role="group" aria-label="Darstellung">'
      + '<button type="button" class="btn-clean" data-dp-si-knopf="einfach" aria-pressed="' + (m === 'einfach') + '">Einfach</button>'
      + '<button type="button" class="btn-clean" data-dp-si-knopf="genau" aria-pressed="' + (m === 'genau') + '">Genau</button></div>'
      + '<span class="dp-si-hin" data-dp-si-teil="einfach">Das Wichtigste auf einen Blick</span><span class="dp-si-hin" data-dp-si-teil="genau">Alle Zahlen, Eingaben und Abgleiche</span></div>'
      + '<div data-dp-si-teil="einfach"><div class="dp-pa-card" data-dp-si-einfach="' + (opts.mitAnkauf ? 'a' : '') + '">' + e + '</div></div>'
      + '<div data-dp-si-teil="genau">' + nav + genauHtml + '</div></div>';
  }
  function einfachNeu() {
    var h = document.querySelectorAll('[data-dp-si-einfach]');
    for (var i = 0; i < h.length; i++) { try { var t = einfachHtml({ mitAnkauf: h[i].getAttribute('data-dp-si-einfach') === 'a' }); if (t) h[i].innerHTML = t; } catch (e) {} }
  }

  /* ── Segment „Wert & Zielbild" im Tab Bewertung ───────────────────────── */
  function wertTafel(W) {
    var mw = W.marktpreisindikation.mitte;
    /* vier Spalten (nicht fünf): tabellen-karten.js baut ab fünf Spalten auf dem Handy Karten -
       hier stünden dann leere „untere/obere" untereinander. Die Spanne steht in einer Spalte. */
    var sp = function (v) { return v.unten != null && v.oben != null ? esc(eur(v.unten)) + ' – ' + esc(eur(v.oben)) : ''; };
    var t = '<div class="dp-wz-scroll"><table class="dp-wz-t dp-wz-verf"><thead><tr><th>Verfahren</th><th>Mitte / Wert</th><th class="dp-wz-spc">untere – obere</th><th>zur Markt&shy;preis&shy;indikation</th></tr></thead><tbody>';
    W.verfahren.forEach(function (v) {
      var d = v.abw_zur_mpi_pct;
      t += '<tr class="' + (v.fuehrend ? 'fu' : '') + (v.schluessel === 'kaufpreis' ? ' kp' : '') + '" data-dp-wz-verf="' + v.schluessel + '"><td>' + esc(v.name)
        + (v.fuehrend ? '<span class="dp-wz-tag">führend</span>' : '') + (v.zusatz ? '<small>' + esc(v.zusatz) + '</small>' : '') + '</td>'
        + '<td><b>' + esc(eur(v.mitte)) + '</b>' + (sp(v) ? '<small class="dp-wz-spm">' + sp(v) + '</small>' : '') + '</td><td class="dp-wz-spc">' + sp(v) + '</td>'
        + '<td>' + (d == null || mw == null ? '' : (d > 0 ? '+' : (d < 0 ? '−' : '±')) + esc(dez(Math.abs(d), 1)) + ' %') + '</td></tr>';
    });
    return t + '</tbody></table></div>';
  }
  function zielTafel(Z) {
    var cls = { bestand: '', mieterhoehung: 'c-soll', zielbild: 'c-ziel' };
    var sp = Z.spalten, S = Z.stufen;
    var ewDa = !Z.ertragswert_gesperrt && sp.some(function (k) { return S[k].ertragswert != null; });
    var zeile = function (t, klein, f, kl) {
      return '<tr' + (kl ? ' class="' + kl + '"' : '') + '><td>' + t + (klein ? '<small>' + klein + '</small>' : '') + '</td>' + sp.map(function (k) { var v = f(k); return '<td>' + (v == null || v === '' ? '–' : v) + '</td>'; }).join('') + '</tr>';
    };
    var t = '<div class="dp-wz-scroll"><table class="dp-wz-t dp-wz-stufen"><thead><tr><th>Kennzahl</th>'
      + sp.map(function (k) { return '<th class="' + cls[k] + '">' + esc(Z.titel[k] || k) + '</th>'; }).join('') + '</tr></thead><tbody>';
    t += zeile('Kaltmiete p. a.', '', function (k) { return S[k].miete_jahr != null ? esc(eur(S[k].miete_jahr)) + (S[k].miete_qm != null ? '<small>' + esc(dez(S[k].miete_qm, 2)) + ' €/m²</small>' : '') : null; });
    t += zeile('Maßnahmenkosten', '', function (k) { return k === 'bestand' ? '' : (S[k].kosten ? esc(eur(S[k].kosten)) : '0 €'); });
    if (ewDa) {
      t += zeile('Ertragswert', Z.lzs && Z.lzs.pct != null ? 'Liegenschaftszins ' + esc(dez(Z.lzs.pct, 2)) + ' %' + (Z.lzs.stufe ? ' · Stufe ' + esc(Z.lzs.stufe) : '') : '',
        function (k) { return S[k].ertragswert != null ? '<b>' + esc(eur(S[k].ertragswert)) + '</b>' + (S[k].rnd != null ? '<small>RND ' + esc(dez(S[k].rnd, 0)) + ' J.</small>' : '') : null; });
      if (sp.some(function (k) { return S[k].marktpreisindikation != null; })) {
        var abS = S.bestand.mpi_abschlag_pct;
        t += zeile('Marktpreisindikation', 'Angebote am Ort' + (abS > 0 ? ', nach ' + esc(dez(abS, 1)) + ' % Abschlag' : ''), function (k) {
          return S[k].marktpreisindikation != null ? esc(eur(S[k].marktpreisindikation)) + (S[k].mpi_ohne_abschlag != null ? '<small>ohne Abschlag ' + esc(eur(S[k].mpi_ohne_abschlag)) + '</small>' : '') : null; });
      }
      /* v2854 · Sanierungsstau je Stufe */
      if (sp.some(function (k) { return S[k].sanierungsstau; })) t += zeile('Sanierungsstau', 'durch die Maßnahmen der Stufe behoben', function (k) {
        var x = S[k].sanierungsstau; if (!x) return null;
        return x.behoben > 0 ? esc(eur(x.behoben)) + ' behoben<small>Rest ' + esc(eur(x.rest || 0)) + '</small>' : esc(eur(x.stau)) + ' offen'; });
      if (sp.length > 1) t += zeile('Wertzuwachs nach Kosten', 'Ertragswert der Stufe − Bestand − Maßnahmen', function (k) {
        if (k === 'bestand') return '';
        var v = Z.wertzuwachs_nach_kosten[k]; return v == null ? null : '<span class="' + (v >= 0 ? 'dp-wz-pos' : 'dp-wz-neg') + '">' + esc(eurVz(v)) + '</span>'; }, 'sum');
    }
    return t + '</tbody></table></div>';
  }
  function segmentOben(D) {
    var h = '';
    var W = D.wert, Z = D.zielbild;
    if (W) {
      h += '<div class="dp-wz-h">Was das Objekt wert ist · je Verfahren</div>' + wertTafel(W)
        + '<p class="dp-wz-klar" style="margin-top:8px">' + esc(W.klartext) + '</p>'
        + '<p class="dp-wz-quelle">Aus dem Marktbericht vom ' + esc(datum(W.bericht_datum))
        + (W.abschlag_pct != null && W.abschlag_herkunft ? ' · Abschlag ' + esc(dez(W.abschlag_pct, 1)) + ' % (' + esc(W.abschlag_herkunft) + ')' : '')
        + ' · indikativ nach ImmoWertV-Logik, kein Gutachten nach § 194 BauGB. '
        + '<button type="button" class="btn-clean" data-dp-wz-erkl="1">Warum die Werte auseinanderliegen</button></p>';
    }
    if (Z) {
      h += '<div class="dp-wz-h">Ist · Mieterhöhung · Zielbild</div>' + (Z.ertragswert_hinweis ? '<div class="dp-wz-alt" data-dp-wz-alt="1">' + esc(Z.ertragswert_hinweis) + ' <button type="button" class="dp-pot-knopf btn-clean dp-wz-mehr" data-dp-pot-rechnen="1">Jetzt rechnen</button></div>' : '') + kachelnHtml(D.kernaussagen) + zielTafel(Z)
        + (Z.ertragswert_quelle === 'abruf' ? '<p class="dp-wz-quelle">Ertragswerte je Stufe aus dem Abruf „Marktpreise" vom ' + esc(Z.ertragswert_abruf_datum || '') + (Z.ertragswert_veraltet ? '; die Angaben haben sich seitdem geändert' : '') + '.</p>' : '')
        + '<p class="dp-wz-quelle">' + esc(Z.kurz_ausblick) + ' Der Score rechnet ebenfalls mit dem Bestand.</p>';
    }
    return h;
  }
  function potenzialHost() {
    var c = document.getElementById('card-wert-zielbild') || _karte; if (!c) return null;
    var d = c.querySelector('details.dp-wz-det'); if (!d) return null;
    var h = d.querySelector('#card-wertpotenzial');
    if (h) return h;
    h = document.getElementById('card-wertpotenzial');
    if (h && h.parentNode) h.parentNode.removeChild(h);   /* alte Einzelkarte */
    h = document.createElement('div'); h.id = 'card-wertpotenzial'; d.appendChild(h);
    return h;
  }
  /* v2841 · Platz (Marcel 22.10.2026): direkt unter der obersten Score-Karte, vor der
     Kennzahlen-Bewertung. Gemessen im Auslieferungszustand: #dpsh-mount trägt zwei Karten
     (DealPilot Score 521 px, Investor Deal Score 540 px); hinter der ersten beginnt das
     Segment bei 1.440 × 900 auf y 768. dpsh-score-hero.js zeichnet den Mount per innerHTML
     neu - der Beobachter setzt die Karte danach wieder an ihren Platz (dieselbe Karte,
     kein Neubau). Ohne Score-Karte: vor der Kennzahlen-Bewertung. */
  var _karte = null, _mo = null, _moZiel = null;
  function platz(c) {
    var sec = document.getElementById('s6'); if (!sec || !c) return;
    var m = document.getElementById('dpsh-mount');
    var p1 = m ? m.querySelector(':scope > .dpsh-pass') : null;
    if (p1) {
      if (p1.nextElementSibling !== c) m.insertBefore(c, p1.nextSibling);
      c.style.margin = '0';
    } else {
      c.style.margin = '';
      var kpi = document.getElementById('kpi-eval-card');
      var ziel = (m && m.parentNode === sec) ? m.nextSibling : (kpi && kpi.parentNode === sec ? kpi : null);
      if (ziel) { if (ziel !== c && c.nextSibling !== ziel) sec.insertBefore(c, ziel); } else if (c.parentNode !== sec) sec.appendChild(c);
    }
    if (m && _moZiel !== m && typeof MutationObserver === 'function') {
      if (_mo) _mo.disconnect();
      _moZiel = m;
      _mo = new MutationObserver(function () {
        if (!_karte) return;
        var q = _moZiel.querySelector(':scope > .dpsh-pass');
        if (!_karte.isConnected || (q && q.nextElementSibling !== _karte)) platz(_karte);
      });
      _mo.observe(m, { childList: true });
    }
  }
  function karte() {
    var sec = document.getElementById('s6'); if (!sec) return;
    var c = document.getElementById('card-wert-zielbild') || _karte;
    var D = daten();
    if (!D) { if (c) c.remove(); _karte = null; return; }
    stil();
    if (!c) {
      c = document.createElement('div'); c.className = 'card'; c.id = 'card-wert-zielbild';
      c.innerHTML = '<div class="ct ct-pro"><span class="ct-ico"><svg width="22" height="22"><use href="#i-trending-up"/></svg></span>Wert &amp; Zielbild'
        + '<span class="dp-wz-kz" hidden>Potenzialwert</span></div><div data-dp-wz-oben="1"></div>'
        + '<details class="dp-wz-det" hidden><summary>Im Detail: Wohnungen, Wertüberleitung, Kennzahlen je Stufe</summary></details>';
      var alt = document.getElementById('card-wertpotenzial');
      if (alt && alt.parentNode === sec) alt.remove();
      var det = c.querySelector('details.dp-wz-det');
      det.addEventListener('toggle', function () { if (det.open && global.DpPotenzial) { try { global.DpPotenzial.bewertungKarte(); } catch (e) {} } });
    }
    _karte = c;
    platz(c);
    c.querySelector('[data-dp-wz-oben]').innerHTML = segmentOben(D);
    c.querySelector('.dp-wz-kz').hidden = !D.zielbild;
    var det2 = c.querySelector('details.dp-wz-det');
    det2.hidden = !D.zielbild;
    if (D.zielbild && global.DpPotenzial && !document.getElementById('card-wertpotenzial')) { try { global.DpPotenzial.bewertungKarte(); } catch (e) {} }
  }
  var _t = null;
  function karteBald(neuLaden) {
    clearTimeout(_t);
    _t = setTimeout(function () {
      if (neuLaden || _hist.key !== key()) laden().then(function () { try { karte(); } catch (e) {} }); else { try { karte(); } catch (e) {} }
    }, 150);
  }

  /* ── Verdrahtung ──────────────────────────────────────────────────────── */
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-dp-si-knopf],[data-dp-si-sprung],[data-dp-wz-erkl],[data-target-sec="s6"]') : null;
    if (!t) return;
    if (t.hasAttribute('data-dp-si-knopf')) {
      var m = t.getAttribute('data-dp-si-knopf') === 'genau' ? 'genau' : 'einfach';
      try { localStorage.setItem(MERKER, m); } catch (e) {}
      var w = t.closest('[data-dp-si-modus]');
      if (w) {
        w.setAttribute('data-dp-si-modus', m);
        w.querySelectorAll('.dp-si-um [data-dp-si-knopf]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-dp-si-knopf') === m)); });
        if (t.classList.contains('dp-wz-mehr')) { try { w.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (e) {} }
      }
      return;
    }
    if (t.hasAttribute('data-dp-si-sprung')) {
      var wr = t.closest('[data-dp-si-modus]'), ziel = wr ? wr.querySelector(t.getAttribute('data-dp-si-sprung')) : null;
      if (ziel) { var k = ziel.closest('.dp-pa-card, .abw-tafel-host') || ziel; try { k.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (e) {} }
      return;
    }
    if (t.hasAttribute('data-dp-wz-erkl')) {
      /* Erklärung steht in der Pilot-Analyse, Unterreiter „Wert & Marktpreis" (wertvergleich.js) */
      var reiter = Array.prototype.filter.call(document.querySelectorAll('.tab'), function (b) { return /Pilot-Analyse/.test(b.textContent); })[0];
      if (reiter) reiter.click();
      setTimeout(function () {
        var kn = Array.prototype.filter.call(document.querySelectorAll('#dp-pa-tab-wert'), function (b) { return b.getBoundingClientRect().width > 0; })[0];
        if (kn) { kn.click(); try { kn.scrollIntoView({ block: 'center' }); } catch (e) {} }
      }, 400);
      return;
    }
    karteBald(false);   /* Tab Bewertung geöffnet */
  });
  global.addEventListener('dp:object-ready', function () { _hist.key = null; _hist.eintrag = null; karteBald(true); });
  global.addEventListener('dp:potenzial', function () { karteBald(false); setTimeout(function () {
    einfachNeu();
    /* v2843 · auch die Tafel unter „Genau" auf den neuen Lauf (vorher stand dort weiter der Abruf) */
    var PZ = global.DpPotenzial;
    if (PZ && PZ.tafelHtml) Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pot-wirt]'), function (w) { try { w.innerHTML = PZ.tafelHtml(); } catch (e) {} });
  }, 0); });
  global.addEventListener('dp:potenzial-markt', function () { karteBald(false); einfachNeu(); });

  global.DpWertZielbild = { VERSION: VERSION, daten: daten, laden: laden, karte: karte, potenzialHost: potenzialHost,
    einfachHtml: einfachHtml, reiterHtml: reiterHtml, _wertDaten: wertDaten };
})(window);
