/* ═══════════════════════════════════════════════════════════════════════
   dok-weiche.js · v3181 — die einheitlichen Dokumente an ALLEN Knöpfen

   Marcel am 04.11.2026: „dann bitte die neuen pdfs an allen stellen ab jetzt
   benutzen. die anderen in den Einstellungen als einstellungen zum auswählen."

   Vorgabe ist das einheitliche Design (dp-dokumente.js). Wer die bisherigen
   jsPDF-Fassungen will, stellt in Einstellungen › Darstellung › PDF-Export
   „Dokument-Design: Klassisch" ein (pdf_vorgabe.design, pdf-wahl.js). Dieselbe
   Angabe liest das Backend für den Bot (telegramPdfService NEU_FUER).

   Umhüllt werden die Exportfunktionen selbst, nicht die Knöpfe - wie pdf-wahl.js:
   so erreicht die Weiche jeden Aufrufer (Seitenmenü, Deal-Aktion, Dashboard-Karte,
   Steuer-Reiter, Track Record, Bankexport).

     exportPDF / exportPDFBank      über pdf-wahl.js fuehreAus  -> investment | bank | kurz
     exportPDFKaufpreisaufteilung   -> kaufpreisaufteilung
     exportWerbungskostenPDF(mode)  -> finanzamt | finanzamt_anlagev (Haken fa-pdf-anlagev)
     exportTrackRecordPDF(objects)  -> trackrecord (die übergebenen Objekte)
     exportGlobalBankPDF()          -> bankexport (die Objekte der Bankexport-Ansicht)

   Die Sperren der alten Wege gelten unverändert und laufen VOR dem neuen Weg
   (Paywall, Plan, DpPdfPruefung.tor). Wo der Plan ein Wasserzeichen verlangt
   (Free, Testphase), bleibt der klassische Weg - nur er stempelt.

   Erzeugt wird als echtes PDF im PDF-Dienst (POST /rechenkerne/dok-pdf): er lädt
   das GESPEICHERTE Objekt, deshalb wird vorher still gespeichert. Ohne PDF-Dienst
   (oder bei einem Fehler) öffnet die Vorschau mit „Drucken / als PDF speichern".
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpDokWeiche) return;

  var NAMEN = { investment: 'Investment Case', bank: 'Investment Case', selbstauskunft: 'Selbstauskunft', kurz: 'Kurzfassung', kompakt: 'Kompaktfassung', kaufpreisaufteilung: 'Kaufpreisaufteilung',
    finanzamt: 'Werbungskosten', finanzamt_anlagev: 'Werbungskosten mit Anlage V', trackrecord: 'Track Record', bankexport: 'Bankexport',
    vermoegen: 'Vermögen & Haushalt', steuermappe: 'Steuer-Mappe', jahresabschluss: 'Jahresabschluss' };   /* v3480 */   /* v3471 */   /* v3226 */

  function design() {
    try { var v = window.DealPilotPdfWahl && DealPilotPdfWahl.vorgabe(); return v && v.design === 'klassisch' ? 'klassisch' : 'neu'; } catch (e) { return 'neu'; }
  }
  /* wie pdf.js (TR7-trial): Wasserzeichen, wenn das Limit es verlangt oder die Testphase läuft */
  function wasserzeichen() {
    /* v3337 · dieselbe Entscheidung wie pdf.js: Sub.wasserzeichenNoetig() (unbekannter Plan ist kein Free) */
    try { if (typeof Sub !== 'undefined' && typeof Sub.wasserzeichenNoetig === 'function') return Sub.wasserzeichenNoetig(); } catch (e) {}
    try {
      var trial = typeof Sub !== 'undefined' && Sub.isTrial && Sub.isTrial();
      var lim = window.DealPilotConfig && DealPilotConfig.pricing ? DealPilotConfig.pricing.current().limits : { watermark: true };
      return lim.watermark !== false || !!trial;
    } catch (e) { return true; }
  }
  function aktiv() { return design() === 'neu' && !!window.DpDokumente && !wasserzeichen(); }
  function hinweis(t) { try { if (typeof window.toast === 'function') window.toast(t); } catch (e) {} }
  function basis() { try { if (window.Auth && typeof Auth.getApiBase === 'function') return Auth.getApiBase(); } catch (e) {} return typeof window.getApiBase === 'function' ? window.getApiBase() : '/api/v1'; }
  function istUuid(k) { return /^[0-9a-f-]{36}$/i.test(String(k || '')); }

  function herunterladen(blob, name) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob);
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000);
  }
  function dateiname(r, art) {
    var cd = r.headers.get('content-disposition') || '', m = cd.match(/filename\*=UTF-8''([^;]+)/i);
    try { if (m) return decodeURIComponent(m[1]); } catch (e) {}
    return 'DealPilot-' + art + '.pdf';
  }

  /* v3183 · der schnelle Weg: die App baut das Dokument selbst (rund 0,5 s, Objekt ist schon gerechnet) und der
     PDF-Dienst druckt es nur (ohne Skript, ohne Netz). Vorher startete er fuer jedes PDF die ganze App neu (12-30 s). */
  /* ── v4370 · Kombi: Investment-PDF plus der letzte Marktbericht des Objekts ──────────────
     Der Marktbericht entsteht in seiner eigenen Engine (marktbericht-app/app.js exportPdf), offscreen im iframe wie
     deal-action-boarding.js _mbEnginePdf, aber mit ?autopdf=bytes: die Engine schickt das PDF als Bytes zurück, statt
     es zu speichern. Zusammengefügt wird im Browser mit pdf-lib 1.17.1 (vendor/cdn, nur bei Bedarf geladen). */
  function letzterBericht(key) {
    if (window.DpGrafikenPdf && DpGrafikenPdf.letzterBericht) return DpGrafikenPdf.letzterBericht(key);   /* v4370e · eine Stelle */
    if (!key || !window.Auth || !Auth.apiCall) return Promise.resolve(null);
    return Auth.apiCall('/marktbericht/objects/history?key=' + encodeURIComponent('dp:' + key), { method: 'GET' }).then(function (d) {
      var h = ((d && d.history) || []).filter(function (x) { return x && x.report_id; });
      h.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      return h.length ? h[h.length - 1] : null;
    }).catch(function () { return null; });
  }
  function berichtBytes(rid) {
    return new Promise(function (ok, nein) {
      var fr = document.createElement('iframe'), fertig = false, to = null;
      fr.setAttribute('aria-hidden', 'true');
      fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:2000px;border:0;visibility:hidden';
      function ende() { if (fertig) return; fertig = true; window.removeEventListener('message', an); if (to) clearTimeout(to); setTimeout(function () { try { fr.remove(); } catch (e) {} }, 1500); }
      function an(ev) {
        if (ev.origin !== location.origin || ev.source !== fr.contentWindow || !ev.data) return;
        if (ev.data.type === 'mbv-pdf-bytes' && ev.data.bytes) { ende(); ok(ev.data.bytes); }
        else if (ev.data.type === 'mbv-pdf-fail') { ende(); nein(new Error(ev.data.error || 'Marktbericht-PDF fehlgeschlagen')); }
      }
      window.addEventListener('message', an);
      to = setTimeout(function () { ende(); nein(new Error('Zeitüberschreitung beim Marktbericht')); }, 90000);
      fr.src = '/marktbericht-app/index.html?v=4370&theme=light&autopdf=bytes&report=' + encodeURIComponent(rid);
      document.body.appendChild(fr);
    });
  }
  function pdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    return new Promise(function (ok, nein) {
      var s = document.createElement('script'); s.src = '/vendor/cdn/pdf-lib/1.17.1/pdf-lib.min.js';
      s.onload = function () { window.PDFLib ? ok(window.PDFLib) : nein(new Error('pdf-lib fehlt')); }; s.onerror = function () { nein(new Error('pdf-lib nicht ladbar')); };
      document.head.appendChild(s);
    });
  }
  async function anhaengen(blob, mbBytes) {
    var L = await pdfLib();
    var a = await L.PDFDocument.load(await blob.arrayBuffer()), b = await L.PDFDocument.load(mbBytes);
    var seiten = await a.copyPages(b, b.getPageIndices());
    seiten.forEach(function (p) { a.addPage(p); });
    return new Blob([await a.save()], { type: 'application/pdf' });
  }
  /* opt.mitMarktbericht: den Bericht parallel zum Dokument erzeugen; scheitert er, kommt das Dokument allein mit Hinweis */
  function berichtVorbereiten(opt) {
    if (!opt || !opt.mitMarktbericht) return null;
    /* v4370e · nur der letzte Bericht und nur, wenn er zum Objektstand passt (DpGrafikenPdf.berichtPruefen) */
    return letzterBericht(window._currentObjKey).then(function (h) {
      var p = window.DpGrafikenPdf && DpGrafikenPdf.berichtPruefen ? DpGrafikenPdf.berichtPruefen(h) : { ok: !!h, grund: 'Kein Marktbericht zum Objekt' };
      if (!p.ok) throw new Error(p.grund);
      return berichtBytes(h.report_id);
    });
  }

  async function schnell(art, opt) {
    var html = await window.DpDokumente.dokument(art, opt || {});
    var d = new DOMParser().parseFromString(html, 'text/html'), f = d.querySelector('.fuss');
    var fuss = f ? [].map.call(f.children, function (x) { return x.textContent; }) : [];
    var t = ''; try { t = localStorage.getItem('ji_token') || ''; } catch (e) {}
    var r = await fetch(basis() + '/rechenkerne/html-pdf', { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
      body: JSON.stringify({ html: html.replace('</style>', '.fuss{display:none}</style>'), titel: d.title || NAMEN[art], fuss: fuss }) });
    if (r.status === 401) { hinweis('Sitzung abgelaufen – bitte neu anmelden.'); return true; }
    if (!r.ok || !/pdf/.test(r.headers.get('content-type') || '')) return false;
    var blob = await r.blob(), name = dateiname(r, art);
    if (opt && opt._mb) {   /* v4370 · Kombi */
      try { blob = await anhaengen(blob, await opt._mb); name = name.replace(/\.pdf$/i, '') + '-mit-Marktbericht.pdf'; }
      catch (e) { hinweis('Marktbericht nicht angehängt: ' + (e && e.message || 'Fehler') + ' Das Dokument kommt ohne ihn.'); }
    }
    herunterladen(blob, name);
    return true;
  }

  /** art: Schlüssel aus DpDokumente.TYPEN; opt: {jahr, alle, ids}; objekt: an das offene Objekt gebunden */
  async function erzeugen(art, opt, objekt) {
    var key = window._currentObjKey;
    if (objekt && !key) { hinweis('Bitte zuerst ein Objekt öffnen.'); return; }
    hinweis((NAMEN[art] || 'Dokument') + ' wird erstellt …');
    var _mbp = berichtVorbereiten(opt); if (_mbp) { _mbp.catch(function () {}); opt = Object.assign({}, opt, { _mb: _mbp }); delete opt.mitMarktbericht; }   /* v4370 */
    try { if (await schnell(art, opt)) { hinweis('✓ ' + (NAMEN[art] || 'Dokument') + ' erstellt'); return; } }
    catch (e) { if (e && e.dpNutzer) { hinweis(e.message); return; } }   /* v3480 · „kein Objekt“, „kein Steuersatz“: PDF-Dienst und Vorschau wuerden nur dasselbe sagen */
    if (objekt) { try { if (typeof window.saveObj === 'function') await window.saveObj({ silent: true }); } catch (e) {} }
    var name = NAMEN[art] || 'Dokument';
    if (!objekt || istUuid(key)) {
      hinweis(name + ' wird über den PDF-Dienst erstellt …');
      try {
        var t = ''; try { t = localStorage.getItem('ji_token') || ''; } catch (e) {}
        var r = await fetch(basis() + '/rechenkerne/dok-pdf', { method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
          body: JSON.stringify({ art: art, objekt_id: objekt ? key : null, optionen: opt || {} }) });
        if (r.status === 401) { hinweis('Sitzung abgelaufen – bitte neu anmelden.'); return; }
        if (r.ok && /pdf/.test(r.headers.get('content-type') || '')) {
          herunterladen(await r.blob(), dateiname(r, art));
          hinweis('✓ ' + name + ' erstellt');
          return;
        }
      } catch (e) {}
    }
    /* Rückfall: dieselbe Fassung als Vorschau mit „Drucken / als PDF speichern" */
    hinweis(name + ': Vorschau – über „Drucken / als PDF speichern" sichern.');
    return window.DpDokumente.oeffnen(art, opt || {});
  }

  /* ── Umhüllen ─────────────────────────────────────────────────────── */
  var alt = {};
  function huelle(fn, neu) {
    var f = window[fn];
    if (typeof f !== 'function' || f.__dok) return !!(f && f.__dok);
    alt[fn] = f;
    var w = function () { if (!aktiv()) return alt[fn].apply(this, arguments); return neu.apply(this, arguments); };
    w.__dok = true;
    window[fn] = w;
    return true;
  }
  function tor(was, titel) { return !window.DpPdfPruefung || window.DpPdfPruefung.tor(was, titel); }

  function umhuellen() {
    var n = 0;
    n += huelle('exportPDFKaufpreisaufteilung', function () {
      if (!tor('kaufpreisaufteilung', 'Kaufpreisaufteilung')) return;
      return erzeugen('kaufpreisaufteilung', {}, true);
    }) ? 1 : 0;
    n += huelle('exportWerbungskostenPDF', function (mode) {
      if (typeof Plan !== 'undefined' && Plan.can && !Plan.can('werbungskosten_pdf')) return alt.exportWerbungskostenPDF.apply(this, arguments);   /* die alte Funktion zeigt die Sperre */
      if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;
      if (!window.State || !State.cfRows || !State.cfRows.length) { hinweis('Bitte erst Werte eingeben'); return; }
      if (!tor('steuer', 'Werbungskosten-PDF')) return;
      if (mode === undefined || mode === null) { var sel = document.getElementById('fa-pdf-year'); mode = sel ? sel.value : '0'; }
      if (mode === 'single-year') mode = '0';
      var opt = (mode === 'all' || mode === 'all-years') ? { alle: true } : { jahr: Math.max(0, parseInt(mode, 10) || 0) };
      var av = document.getElementById('fa-pdf-anlagev');
      return erzeugen(av && av.checked ? 'finanzamt_anlagev' : 'finanzamt', opt, true);
    }) ? 1 : 0;
    /* v3471 · Steuer-Mappe im Portfolio-Cockpit (dashboard.js steuerMappe). Bis v3470 lief sie IMMER
       ueber die jsPDF-Fassung in werbungskosten-pdf.js - Marcel 16.11.2026: „du hast da die alten
       Vorlagen genommen“. Sperren wie die alte Funktion; „klassisch“ und Wasserzeichen nehmen den alten Weg (aktiv()). */
    n += huelle('exportSteuerMappePDF', function (jahr, opt) {
      if (typeof Plan !== 'undefined' && Plan.can && !Plan.can('werbungskosten_pdf')) return alt.exportSteuerMappePDF.apply(this, arguments);
      if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;
      opt = opt || {};
      return erzeugen('steuermappe', { jahr: parseInt(jahr, 10) || (new Date().getFullYear() - 1), anlageV: opt.anlageV !== false, ids: opt.objectIds || null }, false);
    }) ? 1 : 0;
    /* v3480 · Jahresabschluss der GmbH/UG (Knopf an der Mandantenkarte, mandanten.js openJahresabschluss).
       Bis v3472 immer jsPDF (gesellschaft-abschluss.js). Sperren wie dort; gerechnet wird mit denselben
       _gaDaten/_gaRechnen. „klassisch“ und Wasserzeichen nehmen den alten Weg (aktiv()). */
    n += huelle('exportAbschlussPDF', function (halterId, jahr) {
      if (typeof Plan !== 'undefined' && Plan.can && !Plan.can('werbungskosten_pdf')) return alt.exportAbschlussPDF.apply(this, arguments);   /* die alte Funktion zeigt die Sperre */
      if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;
      return erzeugen('jahresabschluss', { halter: halterId, jahr: parseInt(jahr, 10) || (new Date().getFullYear() - 1) }, false);
    }) ? 1 : 0;
    /* v3480 · die fruehere „Anlage zur Steuererklaerung“ des BMF-Rechners (pdf-anlage-bmf.js). Ihr Inhalt
       steht seit v3480 in der Kaufpreisaufteilung (Seite „Anschaffungskosten und AfA“) - EIN Dokument. */
    n += huelle('generateBmfPdfAnlage', function () {
      if (!tor('kaufpreisaufteilung', 'Kaufpreisaufteilung')) return;
      return erzeugen('kaufpreisaufteilung', {}, true);
    }) ? 1 : 0;
    n += huelle('exportTrackRecordPDF', function (objects) {
      if (typeof Plan !== 'undefined' && Plan.key && Plan.key() === 'starter') return alt.exportTrackRecordPDF.apply(this, arguments);   /* Sperre der alten Funktion */
      if (!objects || !objects.length) return;
      /* v3217 · W-20: die Fotowahl aus der Track-Record-Ansicht (storage.js _trFotoStreifen) reist mit */
      var fw = null; try { fw = window._trFotoWahl || JSON.parse(localStorage.getItem('dp_tr_fotowahl') || 'null'); } catch (e) { fw = null; }
      return erzeugen('trackrecord', { ids: objects.map(function (o) { return o && o.id; }).filter(Boolean), fotos: fw || null }, false);
    }) ? 1 : 0;
    n += huelle('exportGlobalBankPDF', function () {
      var d = window._bankexportData;
      if (!d) return;
      return erzeugen('bankexport', { ids: (d.objects || []).map(function (o) { return o && o.id; }).filter(Boolean) }, false);
    }) ? 1 : 0;
    return n;
  }
  var versuche = 0;
  (function warten() { if (umhuellen() < 7 && versuche++ < 40) setTimeout(warten, 250); })();   /* v3480: 7 Funktionen */

  window.DpDokWeiche = {
    aktiv: aktiv, design: design, erzeugen: erzeugen, letzterBericht: letzterBericht,   /* v4370 */
    selbstauskunft: function () { return erzeugen('selbstauskunft', {}, false); },   /* v3184 · Demo */
    /** für pdf-wahl.js: Investment-Familie (art 'voll'|'bank'|'kurz') */
    investment: function (art, zusatz) {
      if (art === 'voll') {
        if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;
        if (!tor('investment', 'Investment-PDF')) return;
        /* v3184 · Marcel 05.11.2026: nur noch zwei Fassungen - vollständig und kurz. Die vollständige ist die
           frühere Bankfassung (18-24 Seiten, ohne Urteil); 'investment' bleibt für Bot und Altaufrufer stehen. */
        return erzeugen('bank', zusatz || {}, true);
      }
      if (!tor('investment', art === 'kurz' ? 'Kurzfassung' : art === 'kompakt' ? 'Kompaktfassung' : 'Bankfassung')) return;
      return erzeugen(art === 'kurz' ? 'kurz' : art === 'kompakt' ? 'kompakt' : 'bank', zusatz || {}, true);   /* v4370 · kompakt, Kombi */
    }
  };
})();
