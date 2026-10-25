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

  var VERSION = 'v2945';
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
        /* v2945 · der Anker der Wertsteigerung (calc.js wert_basis) kann am Bericht haengen -
           ohne Verkehrswert im Formular nach dem Laden einmal neu rechnen */
        try { var S = global.State || {}; if (letzt && S.wert_basis_quelle && S.wert_basis_quelle !== 'verkehrswert' && typeof global.calc === 'function') global.calc(); } catch (e) {}
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

  /* ── Mehrertrag und Wertzuwachs nach Kosten je Stufe ──────────────────
     v2950 · EINE Stelle für beide Ableitungen: das offene Objekt (zielDaten)
     und das gespeicherte (zielbildFuer, Portfolio-Cockpit) nehmen dieselbe. */
  function mehrUndZuwachs(st) {
    var B = st.bestand || {}, mehr = {}, zuw = {};
    ['mieterhoehung', 'zielbild'].forEach(function (k) {
      if (!st[k]) { mehr[k] = null; zuw[k] = null; return; }
      mehr[k] = st[k].miete_jahr != null && B.miete_jahr != null ? st[k].miete_jahr - B.miete_jahr : null;
      zuw[k] = st[k].ertragswert != null && B.ertragswert != null ? st[k].ertragswert - B.ertragswert - (st[k].kosten || 0) : null;
    });
    return { mehr: mehr, zuw: zuw };
  }

  /* ── v2950 · Zielbild eines GESPEICHERTEN Objekts (Portfolio-Cockpit) ──
     Vorbild DealPilotAnkauf.abweichungFuer(daten): eine Funktion auf dem
     Datensatz, nicht auf dem offenen Formular. Gelesen wird, was potenzial.js
     beim letzten Lauf am Objekt abgelegt hat (`_potenzial.zusammenfassung`,
     storage.js) - gerechnet wird nichts neu. Ob der Lauf noch zum heutigen
     Formular passt (Prüfwert), lässt sich ohne offenes Formular nicht sagen;
     deshalb reist sein Datum mit (`stand`). null ohne Mieterhöhung/Zielbild. */
  function zielbildFuer(d) {
    var p = d && d._potenzial, z = p && p.zusammenfassung, S = z && z.stufen;
    if (!S || !S.bestand || (!S.mieterhoehung && !S.zielbild)) return null;
    var st = {};
    ['bestand', 'mieterhoehung', 'zielbild'].forEach(function (k) {
      var s = S[k]; if (!s) return;
      st[k] = { miete_jahr: zahl(s.kaltmiete_jahr), kosten: zahl(s.kosten) || 0,
        ertragswert: z.ertragswert_gesperrt ? null : zahl(s.ertragswert), jahr: zahl(s.jahr),
        marktpreisindikation: zahl(s.marktpreisindikation_angebote), rnd: zahl(s.rnd) };   /* v2951 */
    });
    var mz = mehrUndZuwachs(st);
    var topK = st.zielbild ? 'zielbild' : 'mieterhoehung';
    return { stand: (p.stand || z.stand || '').slice(0, 10) || null, art: z.art || null, stufen: st, top: topK,
      mehrertrag_jahr: mz.mehr, wertzuwachs_nach_kosten: mz.zuw, ertragswert_gesperrt: !!z.ertragswert_gesperrt,
      kennzeichnung: z.kennzeichnung || null };
  }

  /* ── v2951 · WARUM ein gespeichertes Objekt im Portfolio-Vergleich fehlt
     oder nur teilweise zählt. Marcel 25.10.2026: „warum gewisse Objekte nicht
     mit drin sind in der Auswertung". Gelesen wird nur, was am Objekt liegt. */
  function zielbildGrund(d) {
    var p = d && d._potenzial, z = p && p.zusammenfassung, S = z && z.stufen;
    if (!p || !p.ergebnis) return { code: 'kein_lauf', text: 'Noch nicht erfasst: Im Objekt sind weder Soll-Miete noch Zielbild eingetragen (Bewertung › Mieterhöhung und Zielbild).' };
    if (!z || !S || !S.bestand) return { code: 'ohne_stufen', text: 'Die Berechnung ist älter und hat noch keine Stufen – im Objekt einmal neu rechnen.' };
    if (!S.mieterhoehung && !S.zielbild) return { code: 'ohne_ziel', text: 'Weder Soll-Miete noch Zielbild eingetragen – es gibt nichts zu vergleichen.' };
    if (z.ertragswert_gesperrt) return { code: 'stufe3', text: 'Ertragswert je Stufe nur mit DealPilot Stufe 3 – Miete und Maßnahmen zählen, der Wert nicht.' };
    var T = S.zielbild || S.mieterhoehung;
    if (S.bestand.ertragswert == null || T.ertragswert == null) return { code: 'ohne_ew', text: 'Ertragswert noch nicht gerechnet – im Objekt unter Bewertung kostenlos rechnen.' };
    if (!S.zielbild) return { code: 'nur_mh', text: 'Nur Mieterhöhung erfasst, kein Zielbild – zählt mit der Mieterhöhung als höchster Stufe.' };
    return null;
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
    var mz = mehrUndZuwachs(st), mehr = mz.mehr, zuw = mz.zuw;
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
    /* v2936 · ZUERST DIE STUFE BESTAND. Bis v2935 gewann der gespeicherte Marktbericht -
       gemessen Parkstr. 9: Kachel 487.000 € „ohne Abschlag" (Bericht vom Oktober, noch ohne
       Abschlag gerechnet), die Stufen darunter 375.000 € nach 5,8 % Abschlag. Zwei
       Marktpreisindikationen auf derselben Seite. Der Bericht ist nur noch Rueckfall. */
    var _bOk = B && B.marktpreisindikation != null;
    var mw = _bOk ? B.marktpreisindikation : (W ? W.marktpreisindikation.mitte : null);
    var ab = _bOk ? B.mpi_abschlag_pct : (W ? W.abschlag_pct : null);
    var ohne = _bOk ? B.mpi_ohne_abschlag : (W ? (W.ohne_abschlag ? W.ohne_abschlag.mitte : null) : null);
    if (mw != null) {
      var kp = W ? W.kaufpreis : kaufpreis();
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
    if (!k || (_autoVersucht[k] || 0) >= 2 || _autoLaeuft || !PZ || typeof PZ.rechnen !== 'function') return;
    _autoVersucht[k] = (_autoVersucht[k] || 0) + 1; _autoLaeuft = true;
    /* gemessen v2843: sofort beim Laden gerechnet passte der Auftrag nicht mehr zum fertig
       geladenen Formular (Hash ungleich, Tafel blieb „veraltet"). Darum erst nach 1,5 s,
       und ein zweiter Versuch, wenn das Ergebnis danach nicht zum Stand passt. */
    setTimeout(function () {
      if (key() !== k) { _autoLaeuft = false; _autoVersucht[k] = 0; return; }
      var fertig = function () {
        _autoLaeuft = false;
        var ok = false; try { ok = !!PZ.ergebnis(); } catch (e) {}
        if (!ok && key() === k) { setTimeout(autoRechnen, 1500); return; }
        try { einfachNeu(); } catch (e) {} karteBald(false);
      };
      try { PZ.rechnen({ erzwingen: true }).then(fertig, fertig); } catch (e) { fertig(); }
    }, 1500);
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
      /* v2944 · Brücke zum Vermögenszuwachs */
      '.dp-wz-bruecke{border-left:3px solid var(--wl-c9a84c, #C9A84C);background:#FBF6E9;border-radius:0 8px 8px 0;padding:10px 14px;margin:0 0 4px}',
      '.dp-wz-bruecke p{font:400 13px/1.6 Inter,system-ui,sans-serif;color:#2A2727;margin:0 0 6px;max-width:90ch}.dp-wz-bruecke p:last-child{margin:0}',
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
      '@media (max-width:420px){.dp-wz-k.wert{grid-column:1 / -1}}',
      /* v2910 · Genau auf dem Handy (Marcel 23.10.2026: „Handy-Ansicht bauen“). Gemessen bei 390 px:
         Parkstr. 9 3.903 px, davon Stufentafel 995, Ankauf gegen Bestand 784, zwei Pilot-Karten 866.
         Jeder Block klappt ≤ 640 px zu (Kopf mit Titel), lange Absätze stehen hinter „weiterlesen“,
         die Kartenzeilen der Tafeln sind enger. Am Schreibtisch ändert sich nichts: dort ist der
         Kopf unsichtbar und jeder Block offen. */
      '.dp-si-bk,.dp-si-mehr{display:none}',
      '@media (max-width:640px){'
        + '[data-dp-si-modus] .dp-si-bk{display:flex;align-items:center;gap:8px;width:100%;text-align:left;font:600 12.5px/1.3 Inter,system-ui,sans-serif;color:#2A2727;background:#fff;border:1px solid #E6DCC2;border-radius:10px;padding:11px 12px;min-height:44px;cursor:pointer;margin:0 0 8px}'
        + '[data-dp-si-modus] .dp-si-bk small{display:block;font:400 11px/1.35 Inter,sans-serif;color:#6B645A;margin-top:2px}'
        + '[data-dp-si-modus] .dp-si-bk i{margin-left:auto;font-style:normal;font:600 11px Inter,sans-serif;color:var(--wl-b8932f, #b8932f);white-space:nowrap}'
        + '[data-dp-si-block][data-zu="1"]>.dp-si-bi{display:none}'
        + '[data-dp-si-block][data-zu="0"]>.dp-si-bk{border-color:var(--wl-c9a84c, #C9A84C)}'
        + '[data-dp-si-modus] p.dp-si-lang:not(.offen){display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}'
        + '[data-dp-si-modus] .dp-si-mehr{display:inline-block;font:600 12px Inter,sans-serif;border:0;background:none;color:var(--wl-b8932f, #b8932f);padding:6px 0;min-height:32px;cursor:pointer;text-decoration:underline}'
        + '[data-dp-si-modus] table.dptk tbody td{padding:1px 0 !important;font-size:12px !important;line-height:1.35 !important}'
        + '[data-dp-si-modus] table.dptk tbody td:first-child{padding-bottom:4px !important;margin-bottom:2px}'
        + '[data-dp-si-modus] table.abw-tafel td,[data-dp-si-modus] table.abw-tafel th{padding-top:5px !important;padding-bottom:5px !important}'
        + '}'
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
      + '<div data-dp-si-teil="genau">' + nav + klappbar(genauHtml) + '</div></div>';
  }
  /* v2910 · jeden Block der Genau-Ansicht in einen Klappkasten legen (wirksam nur ≤ 640 px, siehe stil()).
     Der Inhalt bleibt unverändert im DOM - nur zugeklappt; die Sprungleiste öffnet den Block, in dem ihr
     Ziel liegt. Titel: die Überschrift des Blocks (.dp-pa-sec, .abw-kopf). */
  function klappbar(html) {
    try {
      var box = document.createElement('div'); box.innerHTML = html;
      var bloecke = [].filter.call(box.children, function (c) { return c.tagName !== 'STYLE' && c.tagName !== 'SCRIPT' && (c.textContent || '').trim(); });
      if (bloecke.length < 1) return html;
      [].forEach.call(box.querySelectorAll('p.dp-pa-p'), function (p) {
        if ((p.textContent || '').length < 260 || p.closest('details')) return;   /* in einem <details> ist er schon zugeklappt */
        p.classList.add('dp-si-lang');
        var b = document.createElement('button'); b.type = 'button'; b.className = 'dp-si-mehr btn-clean'; b.setAttribute('data-dp-si-mehr', '1'); b.textContent = 'weiterlesen';
        p.parentNode.insertBefore(b, p.nextSibling);
      });
      bloecke.forEach(function (c, i) {
        var kopfEl = c.querySelector('.dp-pa-sec, .abw-kopf, h4, h3');
        var titel = kopfEl ? (kopfEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        if (!titel) titel = 'Abschnitt ' + (i + 1);
        if (titel.length > 70) titel = titel.slice(0, 68) + ' …';
        var sec = document.createElement('section'); sec.setAttribute('data-dp-si-block', '1'); sec.setAttribute('data-zu', '1');
        var k = document.createElement('button'); k.type = 'button'; k.className = 'dp-si-bk btn-clean'; k.setAttribute('data-dp-si-klapp', '1'); k.setAttribute('aria-expanded', 'false');
        k.innerHTML = '<span>' + esc(titel) + '</span><i>aufklappen</i>';
        var inn = document.createElement('div'); inn.className = 'dp-si-bi';
        c.parentNode.insertBefore(sec, c); inn.appendChild(c); sec.appendChild(k); sec.appendChild(inn);
      });
      return box.innerHTML;
    } catch (e) { return html; }
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
    return h + brueckeHtml(D);
  }
  /* v2944 · Brücke zum Vermögenszuwachs (Marcel 25.10.2026: „wenn das verschiedene
     Betrachtungsweisen sind, müssen wir das erklären?"). Gemessen an Westerfeldstr. 140:
     hier Ertragswert 740.000 € und Zielbild +23.000 € nach Kosten, darunter schreibt der
     Vermögenszuwachs 567.000 € (Feld Verkehrswert) mit 2 % fort - drei Zahlen für „heute",
     und keine Zeile sagte, warum. Diese Brücke RECHNET NICHTS: sie liest State.wert_basis,
     State.wstg und State._vz (calc.js) und nennt den Unterschied. */
  function brueckeHtml(D) {
    var S = global.State || {}, VZ = S._vz || null;
    var basis = zahl(S.wert_basis), wstg = zahl(S.wstg);
    if (!VZ || basis == null || basis <= 0) return '';
    var anker = { verkehrswert: 'dem Verkehrswert aus dem Reiter Objekt', marktbericht: 'dem ' + (S.wert_basis_text || 'Wert aus dem Marktbericht'),
      bankbewertung: 'der Bankbewertung', kaufpreis: 'dem Kaufpreis' }[S.wert_basis_quelle] || 'dem Wert von heute';
    var jahre = zahl(VZ.btj);
    var t = '<div class="dp-wz-h">Und der Vermögenszuwachs?</div><div class="dp-wz-bruecke">'
      + '<p><b>Zwei Fragen, zwei Rechnungen.</b> Diese Karte fragt: <i>Was ist das Objekt heute wert, und was nach den Maßnahmen?</i> '
      + 'Der Vermögenszuwachs direkt darunter fragt: <i>Was baust du in ' + esc(jahre != null ? jahre : '') + ' Jahren auf?</i> '
      + 'Er beginnt bei ' + esc(anker) + ' (' + esc(eur(basis)) + '), schreibt ihn mit ' + esc(dez(wstg != null ? wstg * 100 : null, 1)) + ' % im Jahr fort '
      + 'und zählt Tilgung, Cashflow und Steuer dazu.</p>';
    var Z = D.zielbild, W = D.wert;
    var zw = Z && Z.wertzuwachs_nach_kosten ? zahl(Z.wertzuwachs_nach_kosten.zielbild) : null;
    if (zw != null) t += '<p><b>Das Zielbild steckt dort nicht drin.</b> Setzt du die Maßnahmen um, kämen ' + esc(eurVz(zw)) + ' Wertzuwachs nach Kosten hinzu (Ertragswert Zielbild − heute − Maßnahmen). Die Mieten im Vermögenszuwachs steigen nur mit der allgemeinen Mietsteigerung.</p>';
    var ew = W && W.ertragswert ? zahl(W.ertragswert.wert) : null;
    if (ew != null && Math.abs(ew - basis) / basis > 0.05) {
      var d = (ew - basis) / basis * 100;
      t += '<p><b>Anderer Ausgangswert.</b> Der Ertragswert hier (' + esc(eur(ew)) + ') liegt ' + esc(dez(Math.abs(d), 1)) + ' % ' + (d > 0 ? 'über' : 'unter') + ' dem Ausgangswert des Vermögenszuwachses. '
        + (S.wert_basis_quelle === 'verkehrswert' ? 'Ein eingetragener Verkehrswert im Reiter Objekt hat Vorrang vor dem Marktbericht.' : '') + '</p>';
    }
    return t + '</div>';
  }
  /* v2945 · Zielbild als Plan-Zeile im Vermögenszuwachs (Marcel 25.10.2026: „ja, wenn das
     Sinn macht"). Die Summe aus calc.js (State._vz.verm_zuwachs) bleibt UNVERÄNDERT - an ihr
     hängen Equity Multiple, Bank-Wasserfall und beide PDFs. Hier steht nur eine zweite,
     klar als Plan markierte Summe darunter, zum Anhaken, je Objekt gemerkt. */
  function vzZielbild(D) {
    var karteVz = document.getElementById('card-vermoegen-zuwachs'), ges = document.getElementById('vz-gesamt');
    var alt = document.getElementById('vz-zielbild-host');
    var Z = D && D.zielbild, zw = Z && Z.wertzuwachs_nach_kosten ? zahl(Z.wertzuwachs_nach_kosten.zielbild) : null;
    var VZ = (global.State || {})._vz, summe = VZ ? zahl(VZ.verm_zuwachs) : null;
    if (!karteVz || !ges || zw == null || summe == null) { if (alt) alt.remove(); return; }
    var mk = 'dp_vz_zielbild:' + (key() || ''), an = false;
    try { an = localStorage.getItem(mk) === '1'; } catch (e) {}
    var host = alt || document.createElement('div'); host.id = 'vz-zielbild-host';
    var zeileGes = ges.closest('.kv');
    if (!alt && zeileGes) zeileGes.parentNode.insertBefore(host, zeileGes.nextSibling);
    var jahr = Z.jahre && Z.jahre.zielbild ? ' ' + Z.jahre.zielbild : '';
    host.innerHTML = '<label class="kv" style="cursor:pointer"><span><input type="checkbox" data-dp-vz-ziel="1"' + (an ? ' checked' : '') + ' style="margin:0 6px 0 0;vertical-align:-2px">'
      + 'Zielbild' + esc(jahr) + ' einrechnen <span class="cf-hint">(Plan · Ertragswert Zielbild − heute − Maßnahmen)</span></span>'
      + '<span class="kv-v ' + (zw >= 0 ? 'c-green' : 'c-red') + '">' + esc(eurVz(zw)) + '</span></label>'
      + (an ? '<div class="kv kv-result"><span><b>Netto-Vermögenszuwachs mit Zielbild</b> <span class="cf-hint">(Plan; Wertzuwachs zum heutigen Stand, ohne Fortschreibung, ohne Finanzierung der Maßnahmen und ohne Mehrmiete im Cashflow)</span></span>'
        + '<span class="kv-v c-gold">' + esc(eurVz(summe + zw)) + '</span></div>' : '');
    var cb = host.querySelector('[data-dp-vz-ziel]');
    cb.addEventListener('change', function () { try { localStorage.setItem(mk, cb.checked ? '1' : '0'); } catch (e) {} vzZielbild(daten()); });
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
  /* v2944 · Platz (Marcel 25.10.2026): „Wert & Zielbild zwischen DealScore und Investor
     DealScore würde ich eher bei Vermögenszuwachs hinpacken." Die Karte steht jetzt
     unmittelbar VOR #card-vermoegen-zuwachs (statisches HTML in s6, wird von keinem
     Renderer neu gezeichnet - der Beobachter auf #dpsh-mount aus v2841 entfällt).
     Ohne die Vermögenszuwachs-Karte: vor der Kennzahlen-Bewertung, sonst ans Ende. */
  var _karte = null;
  function platz(c) {
    var sec = document.getElementById('s6'); if (!sec || !c) return;
    c.style.margin = '';
    var ziel = document.getElementById('card-vermoegen-zuwachs') || document.getElementById('kpi-eval-card');
    if (ziel && sec.contains(ziel)) { if (c.nextElementSibling !== ziel) ziel.parentNode.insertBefore(c, ziel); }
    else if (c.parentNode !== sec) sec.appendChild(c);
  }
  function karte() {
    var sec = document.getElementById('s6'); if (!sec) return;
    var c = document.getElementById('card-wert-zielbild') || _karte;
    var D = daten();
    if (!D) { if (c) c.remove(); _karte = null; vzZielbild(null); return; }
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
    vzZielbild(D);
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
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-dp-si-knopf],[data-dp-si-sprung],[data-dp-wz-erkl],[data-target-sec="s6"],[data-dp-si-klapp],[data-dp-si-mehr]') : null;
    if (!t) return;
    if (t.hasAttribute('data-dp-si-klapp')) {   /* v2910 */
      var bl = t.closest('[data-dp-si-block]'); if (!bl) return;
      var auf = bl.getAttribute('data-zu') === '1';
      bl.setAttribute('data-zu', auf ? '0' : '1'); t.setAttribute('aria-expanded', String(auf));
      var ii = t.querySelector('i'); if (ii) ii.textContent = auf ? 'zuklappen' : 'aufklappen';
      return;
    }
    if (t.hasAttribute('data-dp-si-mehr')) {   /* v2910 */
      var pp = t.previousElementSibling; if (!pp) return;
      var offen = pp.classList.toggle('offen'); t.textContent = offen ? 'weniger' : 'weiterlesen';
      return;
    }
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
      if (ziel) {
        /* v2910 · zugeklappten Block erst öffnen - in einen versteckten Block springt kein scrollIntoView */
        var blz = ziel.closest('[data-dp-si-block]');
        if (blz && blz.getAttribute('data-zu') === '1') { var kb = blz.querySelector(':scope > [data-dp-si-klapp]'); if (kb) kb.click(); }
        var k = ziel.closest('.dp-pa-card, .abw-tafel-host') || ziel; try { k.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (e) {}
      }
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

  /* v2900 · der geladene Bericht selbst - das PDF nimmt seine Erklaertexte daraus
     statt aus einem zweiten Abruf (pdf-wert-zielbild.js daten()) */
  function bericht() { return (_hist.key && _hist.key === key()) ? _hist.eintrag : null; }
  global.DpWertZielbild = { VERSION: VERSION, daten: daten, laden: laden, bericht: bericht, karte: karte, potenzialHost: potenzialHost,
    einfachHtml: einfachHtml, reiterHtml: reiterHtml, _wertDaten: wertDaten, zielbildFuer: zielbildFuer, zielbildGrund: zielbildGrund };
})(window);
