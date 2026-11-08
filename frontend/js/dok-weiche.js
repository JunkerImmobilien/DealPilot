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

  var NAMEN = { investment: 'Investment Case', bank: 'Investment Case', selbstauskunft: 'Selbstauskunft', kurz: 'Kurzfassung', kaufpreisaufteilung: 'Kaufpreisaufteilung',
    finanzamt: 'Werbungskosten', finanzamt_anlagev: 'Werbungskosten mit Anlage V', trackrecord: 'Track Record', bankexport: 'Bankexport',
    vermoegen: 'Vermögen & Haushalt' };   /* v3226 */

  function design() {
    try { var v = window.DealPilotPdfWahl && DealPilotPdfWahl.vorgabe(); return v && v.design === 'klassisch' ? 'klassisch' : 'neu'; } catch (e) { return 'neu'; }
  }
  /* wie pdf.js (TR7-trial): Wasserzeichen, wenn das Limit es verlangt oder die Testphase läuft */
  function wasserzeichen() {
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
    herunterladen(await r.blob(), dateiname(r, art));
    return true;
  }

  /** art: Schlüssel aus DpDokumente.TYPEN; opt: {jahr, alle, ids}; objekt: an das offene Objekt gebunden */
  async function erzeugen(art, opt, objekt) {
    var key = window._currentObjKey;
    if (objekt && !key) { hinweis('Bitte zuerst ein Objekt öffnen.'); return; }
    hinweis((NAMEN[art] || 'Dokument') + ' wird erstellt …');
    try { if (await schnell(art, opt)) { hinweis('✓ ' + (NAMEN[art] || 'Dokument') + ' erstellt'); return; } } catch (e) {}
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
  (function warten() { if (umhuellen() < 4 && versuche++ < 40) setTimeout(warten, 250); })();

  window.DpDokWeiche = {
    aktiv: aktiv, design: design, erzeugen: erzeugen,
    selbstauskunft: function () { return erzeugen('selbstauskunft', {}, false); },   /* v3184 · Demo */
    /** für pdf-wahl.js: Investment-Familie (art 'voll'|'bank'|'kurz') */
    investment: function (art) {
      if (art === 'voll') {
        if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;
        if (!tor('investment', 'Investment-PDF')) return;
        /* v3184 · Marcel 05.11.2026: nur noch zwei Fassungen - vollständig und kurz. Die vollständige ist die
           frühere Bankfassung (18-24 Seiten, ohne Urteil); 'investment' bleibt für Bot und Altaufrufer stehen. */
        return erzeugen('bank', {}, true);
      }
      if (!tor('investment', art === 'kurz' ? 'Kurzfassung' : 'Bankfassung')) return;
      return erzeugen(art === 'kurz' ? 'kurz' : 'bank', {}, true);
    }
  };
})();
