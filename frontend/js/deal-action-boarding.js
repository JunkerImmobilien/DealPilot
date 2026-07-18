/* W33-wl-token: Gold-Literale zeigen auf die Whitelabel-Ebene
   (var(--wl-<hex>, #<hex>)). Ohne Whitelabel greift der Fallback. */
/* ============================================================================
   DealPilot v852 – deal-action-boarding.js  (NEU, additiv)
   Deal-Aktion (#s8) im Boarding-Cockpit-Stil:
     - Cockpit-Hero: DOPPELRING (aussen gruen = Readiness, innen gold) +
       Startbahn als FORTLAUFENDER Fortschrittsbalken (erste n Segmente gruen)
       + Departure-Tafel (ruft DealPilotDealAction.setStatus, Hidden-Inputs hier).
     - Exporte-Smartklappe: exportPDF / exportBmfPdf / exportTrackRecordPDF.
     - Bordkarte & Unterlagen + Datenraum (DealPilotDatenraum).
     - Netzwerk-Rails (384px-Karten) aus GET /api/v1/network-cards:
       Designer-Felder (hintergrund, kante_stil/farbe, akzent, verified, usp,
       antwortzeit), ANFORDERUNGS-GATE (readycheck100 / dr_objekt / dr_persoenlich;
       gesperrter CTA + Beheben-Links) und LEAD-SHEET (zeigt Mitgabe transparent,
       POST /:id/lead mit checks + Eckdaten + Datenraum-Links).
   CSS injiziert (<style id="dab-styles">, alles auf #s8 gescopt; Lead-Sheet .dabm-*
   haengt an body und ist separat gescopt). Frontend-only. Idempotent.
   ============================================================================ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function token() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function currentObjId() {
    try {
      /* v869: window._currentObjKey ist das echte App-Global fuers aktive Objekt */
      if (typeof window._currentObjKey === 'string' && window._currentObjKey) return window._currentObjKey;
      var o = window._currentObjData; return o ? (o.id || o._id || '') : '';
    } catch (e) { return ''; }
  }
  function toast(m) { try { if (typeof window.toast === 'function') window.toast(m); } catch (e) {} }
  function gv(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }
  function gt(id) { var e = document.getElementById(id); return e ? String(e.textContent || '').trim() : ''; }

  var ICO = {
    gate: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18"/><path d="M5 4h13l-3 4 3 4H5"/></svg>',
    dl: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 10l5 5 5-5M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>',
    chL: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    chR: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/></svg>',
    plane: '\u2708'
  };

  var REQ_DEFS = {
    readycheck100: 'Grundfelder-Check 100\u2009%',
    dr_objekt: 'Datenraum Objekt verkn\u00fcpft',
    dr_persoenlich: 'Datenraum pers\u00f6nlich verkn\u00fcpft'
  };

  var _cards = [];   // geladene Karten (by id)

  /* ────────────────── Departure-Tafel (Status) ────────────────── */
  function statusTafel() {
    var rows = [
      ['open', 'Offen', 'Boarding', 'Deal in Pr\u00fcfung'],
      ['won', 'Gewonnen', 'Abgeflogen', 'Deal gewonnen \u2014 Objekt im Bestand'],
      ['lost', 'Verloren', 'Gestrichen', 'Deal nicht zustande gekommen']
    ].map(function (d) {
      return '<div class="da-status-tile dab-row" data-status="' + d[0] + '" role="button" tabindex="0"' +
        ' onclick="DealPilotDealAction.setStatus(\'' + d[0] + '\')"' +
        ' onkeydown="if(event.key===\'Enter\'||event.key===\' \')DealPilotDealAction.setStatus(\'' + d[0] + '\')">' +
        '<span class="dab-row-dot"></span>' +
        '<div class="dab-row-x"><div class="dab-row-main">' + d[1] + '</div><div class="dab-row-sub">' + d[3] + '</div></div>' +
        '<div class="dab-row-flip">' + d[2].toUpperCase() + '</div>' +
        '</div>';
    }).join('');
    return '<div class="dab-tafel">' +
      '<div class="dab-tafel-bar"><span class="l">DEPARTURES \u00b7 DEAL-STATUS</span><span class="r" id="da-status-sub">Markiere den Deal als gewonnen oder verloren.</span></div>' +
      '<div class="dab-tafel-rows">' + rows + '</div>' +
      '<span id="da-status-label" style="display:none">Status: In Pr\u00fcfung</span>' +
      '<input type="hidden" id="_deal_won_state" value="false">' +
      '<input type="hidden" id="_deal_won_at_state" value="">' +
      '<input type="hidden" id="_deal_lost_state" value="false">' +
      '</div>';
  }

  /* ────────────────── Kopf-Markup ────────────────── */
  function buildTop() {
    var docs =
      docRow('invest', 'Investment-PDF', 'Business-Case, bank-fertig: Kaufpreis, Finanzierung, Cashflow, DSCR/LTV, Stress-Test.', true) +
      faRow() +
      docRow('track', 'Track Record', 'Auswahl-Ansicht \u00f6ffnen: gewonnene Deals filtern, Einzel- oder Sammel-PDF erzeugen.', false);

    return '' +
      '<div class="dab-cockpit" id="dab-cockpit">' +
        '<div class="dab-strip"><div class="dab-strip-l"><span class="dot"></span>Bereit f\u00fcr die Bank</div><div class="dab-pill" id="dab-ready-pill">\u2013</div></div>' +
        '<div class="dab-body">' +
          '<div id="dab-readiness-host"><div class="dab-rc-load">Vorflug-Check l\u00e4dt \u2026</div></div>' +
          '<div class="dab-perf"></div>' +
          '<div class="dab-sthead"><div class="dab-route">Objekt \u2192 Abschluss</div><div class="dab-title" id="dab-abtitle">Bereit zum Abflug</div></div>' +
          '<div class="dab-status-grid">' + statusTafel() + '<div id="dab-share-slot"></div></div>' +
        '</div>' +
      '</div>' +

      band('doc', 'Dokumente &amp; Exporte', 'Bank-fertige PDFs') +
      '<div class="dab-panel"><div class="dab-smart open" id="dab-smart">' +
        '<div class="dab-smart-head" onclick="DealActionBoarding.toggleSmart()">' +
          '<div class="dab-smart-ic">' + ICO.dl + '</div>' +
          '<div><div class="dab-smart-t">PDFs herunterladen</div><div class="dab-smart-s">Investment, Finanzamt (Steuer) &amp; Track Record \u2014 mit den aktuellen Objektdaten</div></div>' +
          '<div class="dab-smart-chev"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></div>' +
        '</div>' +
        '<div class="dab-smart-body">' + docs + '</div>' +
      '</div></div>' +

      band('doc', 'Marktberichte', 'Erzeugte Berichte als PDF') +
      '<div class="dab-panel"><div id="dab-mb-host" class="dab-mb-host"><div class="dab-mb-empty">L\u00e4dt \u2026</div></div></div>' +
      '<div id="dab-uew-slot"></div>' +

      band('doc2', 'Bordkarte &amp; Unterlagen', 'Bankgespr\u00e4ch vorbereiten') +
      '<div class="dab-panel">' +
        '<div class="dab-cols">' +
          '<div><div class="dab-ct">Pers\u00f6nliche Unterlagen</div><ul class="dab-list"><li>Personalausweis (Kopie)</li><li>Letzte 3 Gehaltsabrechnungen</li><li>Steuerbescheide 2 Jahre</li><li>SCHUFA-Selbstauskunft</li><li>Verm\u00f6gen &amp; Verbindlichkeiten</li></ul></div>' +
          '<div><div class="dab-ct">Objekt-Unterlagen</div><ul class="dab-list"><li>Expos\u00e9 / Verkaufsanzeige</li><li>Aktueller Grundbuchauszug</li><li>Wohnfl\u00e4chenberechnung</li><li>Nebenkostenabrechnungen</li><li>Bei WEG: Teilungserkl\u00e4rung</li></ul></div>' +
        '</div>' +
        '<div id="dab-dr-host" class="dab-dr-host"></div>' +
      '</div>' +

      band('net', 'Dein Netzwerk', 'Gepr\u00fcfte Partner \u2014 Objektdaten gehen mit') +
      '<div class="dab-panel" id="dab-rails-host"><div class="dab-net-load">L\u00e4dt Partner \u2026</div></div>';
  }

  function band(ic, t, s) {
    var icons = {
      doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
      doc2: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
      net: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 15c2.5.3 4.5 2 4.5 5"/>'
    };
    return '<div class="dab-band"><div class="dab-band-ic"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (icons[ic] || '') + '</svg></div><div class="dab-band-t">' + t + '</div><div class="dab-band-s">' + s + '</div></div>';
  }

  function docRow(which, name, desc, gold) {
    var badge = gold ? ' <span class="dab-doc-badge">Empfohlen</span>' : '';
    var ic = which === 'invest'
      ? '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>'
      : which === 'bmf'
        ? '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 14l6-6M9.5 9h.01M14.5 14h.01"/>'
        : '<path d="M12 2l2.5 5 5.5.8-4 3.9 1 5.5L12 15l-5 2.9 1-5.5-4-3.9 5.5-.8z"/>';
    return '<div class="dab-doc-row"><div class="dab-doc-icb"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ic + '</svg></div>' +
      '<div class="dab-doc-x"><div class="dab-doc-n">' + name + badge + '</div><div class="dab-doc-d">' + desc + '</div></div>' +
      '<div class="dab-doc-act"><button class="dab-doc-btn' + (gold ? ' gold' : '') + '" onclick="DealActionBoarding.exportDoc(\'' + which + '\')">' + ICO.dl + 'PDF</button></div></div>';
  }

  /* v854: Finanzamt-PDF = Steuerformular (exportWerbungskostenPDF) mit Jahr-Auswahl */
  function faRow() {
    return '<div class="dab-doc-row"><div class="dab-doc-icb"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 14l6-6M9.5 9h.01M14.5 14h.01"/></svg></div>' +
      '<div class="dab-doc-x"><div class="dab-doc-n">Finanzamt-PDF (Steuerformular)</div><div class="dab-doc-d">Werbungskosten-Aufschl\u00fcsselung f\u00fcr die Anlage V \u2014 Steuerjahr w\u00e4hlen oder Gesamt\u00fcbersicht \u00fcber alle Jahre.</div></div>' +
      '<div class="dab-doc-act" style="display:flex;gap:8px;align-items:center;flex-shrink:0">' +
      '<select id="dab-fa-year" class="dab-fa-year" onfocus="DealActionBoarding.fillFaYears()" title="Steuerjahr f\u00fcr das Finanzamt-PDF"></select>' +
      '<button class="dab-doc-btn" onclick="DealActionBoarding.exportDoc(\'bmf\')">' + ICO.dl + 'PDF</button></div></div>';
  }
  function fillFaYears() {
    var sel = document.getElementById('dab-fa-year');
    if (!sel) return;
    var rows = (window.State && Array.isArray(window.State.cfRows)) ? window.State.cfRows.slice(0, 15) : [];
    var cur = sel.value;
    var opts = rows.map(function (r, i) { return '<option value="' + i + '">' + r.cal + '</option>'; });
    opts.push('<option value="all">Alle Jahre</option>');
    sel.innerHTML = opts.join('');
    if (cur !== '' && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur;
  }
  /* v854: Junker-Gutachten-Karte -> bestehendes Gutachten-Modal */
  function gutachtenModal() {
    try {
      if (window.DealPilotDealAction && typeof window.DealPilotDealAction.openExpert === 'function') {
        return window.DealPilotDealAction.openExpert();
      }
    } catch (e) {}
    toast('Gutachten-Anfrage derzeit nicht verf\u00fcgbar.');
  }

  function railHead(key, farbe, label) {
    var k = esc(key);
    return '<div class="dab-rail-head"><span class="dab-rh-dot" style="background:' + esc(farbe) + '"></span><span class="dab-rh-n" style="color:' + esc(farbe) + ';filter:brightness(.72)">' + esc(label) + '</span>' +
      '<div class="dab-rail-arrows"><button type="button" class="dab-rail-arr" onclick="DealActionBoarding.railScroll(\'dab-rail-' + k + '\',-1)" aria-label="zur\u00fcck">' + ICO.chL + '</button>' +
      '<button type="button" class="dab-rail-arr" onclick="DealActionBoarding.railScroll(\'dab-rail-' + k + '\',1)" aria-label="weiter">' + ICO.chR + '</button></div></div>';
  }

  /* ────────────────── Readiness: Doppelring + fortlaufende Startbahn ────────────────── */
  function renderReadiness(d) {
    var host = document.getElementById('dab-readiness-host');
    if (!host || !d) return;
    var total = d.total || 0, filled = d.filled || 0, pct = d.percent | 0;
    // Startbahn = Fortschrittsbalken: erste `filled` Segmente gruen, Rest dunkel
    var segs = '';
    for (var i = 0; i < total; i++) segs += '<div class="dab-seg' + (i < filled ? ' lit' : '') + '"></div>';
    var R1 = 40, R2 = 31;
    var c1 = 2 * Math.PI * R1, o1 = (c1 * (1 - pct / 100)).toFixed(1), c2 = 2 * Math.PI * R2;
    var chips;
    if (d.missing && d.missing.length) {
      // v856: kompakte Chips mit INLINE-Style (CSS-KOMMT-NICHT-AN-Garantie)
      var chipStyle = 'font-family:var(--dab-fs),sans-serif;font-size:10px;font-weight:600;padding:3px 10px;border-radius:99px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;color:#6fd6a0;background:rgba(111,214,160,.12);border:1px solid rgba(111,214,160,.45);line-height:1.4';
      chips = '<div class="dab-chips"><span class="dab-chips-lbl">Fehlt (Grundfeld):</span>' +
        d.missing.map(function (m) {
          return '<button type="button" class="dab-chip" style="' + chipStyle + '" onclick="DealPilotReadyCheck.jump(\'' + esc(m.key) + '\')"><span style="width:5px;height:5px;border-radius:50%;background:currentColor;box-shadow:0 0 4px currentColor;flex-shrink:0"></span>' + esc(m.name) + '</button>';
        }).join('') + '</div>';
    } else {
      chips = '<div class="dab-allset">\u2713 Alle Grundfelder vollst\u00e4ndig \u2014 startklar f\u00fcr die Bank</div>';
    }
    host.innerHTML =
      '<div class="dab-rowflex"><div class="dab-donut"><svg width="96" height="96" viewBox="0 0 96 96">' +
        '<circle cx="48" cy="48" r="40" fill="none" stroke="rgba(111,214,160,.15)" stroke-width="7"/>' +
        '<circle class="ring" cx="48" cy="48" r="40" fill="none" stroke="var(--dab-m2)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + c1.toFixed(1) + '" stroke-dashoffset="' + o1 + '"/>' +
        '<circle cx="48" cy="48" r="31" fill="none" style="stroke:color-mix(in srgb,var(--gold,#C9A84C) 20%,transparent)" stroke-width="5"/>' +
        '<circle cx="48" cy="48" r="31" fill="none" stroke="var(--dab-gold)" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + c2.toFixed(1) + '" stroke-dashoffset="0"/>' +
      '</svg><div class="dab-donut-v"><b>' + pct + '</b><span>/ 100</span><small>FELDER ' + filled + ' / ' + total + '</small></div></div>' +
      '<div class="dab-rmain"><div class="dab-kick">Vorflug-Check</div><div class="dab-rtitle">Bereit f\u00fcr die Bank?</div><div class="dab-count"><b>' + filled + '</b> / ' + total + ' Grundfelder bef\u00fcllt</div>' +
        '<div class="dab-runway"><div class="dab-track">' + segs + '</div><div class="dab-plane" style="left:' + pct + '%">' + ICO.plane + '</div><div class="dab-rgate">' + ICO.gate + '</div></div>' +
      '</div></div>' +
      '<div class="dab-cap"><b>Grundfelder f\u00fcr die Bank-Bewertung</b> \u2014 nur diese Felder z\u00e4hlen in die Readiness. Weitere Angaben (Ausstattung, Historie, Fotos) sind hilfreich, flie\u00dfen aber <b>nicht</b> in diese Bewertung ein.</div>' +
      chips;
    // v857: Chip-Styles per setProperty('important') erzwingen (schlaegt JEDE CSS-Regel)
    try {
      host.querySelectorAll('.dab-chip').forEach(function (b) {
        b.style.setProperty('background', 'rgba(111,214,160,.12)', 'important');
        b.style.setProperty('color', '#6fd6a0', 'important');
        b.style.setProperty('border', '1px solid rgba(111,214,160,.45)', 'important');
        b.style.setProperty('font-size', '10px', 'important');
        b.style.setProperty('padding', '3px 10px', 'important');
        b.style.setProperty('min-height', '0', 'important');
        b.style.setProperty('border-radius', '99px', 'important');
      });
    } catch (e) {}
    var pill = document.getElementById('dab-ready-pill');
    if (pill) pill.textContent = pct + ' %' + (d.missing && d.missing.length ? '' : ' \u00b7 STARTKLAR \u2713');
    var ck = document.getElementById('dab-cockpit');
    if (ck) ck.classList.toggle('ready', !(d.missing && d.missing.length));
    // Gates haengen am ReadyCheck -> mit aktualisieren
    try { refreshGates(); } catch (e) {}
  }

  /* ────────────────── Anforderungs-Gate ────────────────── */
  function anfOf(card) {
    var a = card.anforderungen || {};
    if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = {}; } }
    return a;
  }
  function mitOf(card) {
    var m = card.mitgabe || {};
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = {}; } }
    return m;
  }
  function checkStates() {
    var st = { readycheck100: false, dr_objekt: false, dr_persoenlich: false };
    try {
      if (window.DealPilotReadyCheck && window.DealPilotReadyCheck.getData) {
        var d = window.DealPilotReadyCheck.getData();
        st.readycheck100 = !!(d && d.total > 0 && d.missing.length === 0);
      }
    } catch (e) {}
    try {
      if (window.DealPilotDatenraum && window.DealPilotDatenraum.getCompletionForRequest) {
        var c = window.DealPilotDatenraum.getCompletionForRequest(currentObjId(), 'bank');
        if (c) {
          st.dr_objekt = !!(c.objekt && c.objekt.hatOrdner);
          st.dr_persoenlich = !!(c.persoenlich && c.persoenlich.hatOrdner);
        }
      }
    } catch (e) {}
    return st;
  }
  /* v890-cdoc: Bestaetigung eigener Pflichtdokumente (localStorage je Karte+Objekt) */
  function _cdocSlug(x){ return String(x||'').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40); }
  function _cdocStoreKey(cid, obj){ return 'dp_ncd_' + (cid|0) + '_' + (obj||''); }
  function _cdocConfirmed(cid, obj){ try { var v = JSON.parse(localStorage.getItem(_cdocStoreKey(cid,obj))||'[]'); return Array.isArray(v)?v:[]; } catch(e){ return []; } }
  function toggleCustomDoc(cid, slug, on){
    var obj = currentObjId(); var set = _cdocConfirmed(cid,obj); var i = set.indexOf(slug);
    if (on && i<0) set.push(slug); else if (!on && i>=0) set.splice(i,1);
    try { localStorage.setItem(_cdocStoreKey(cid,obj), JSON.stringify(set)); } catch(e){}
    refreshGates();
  }
  function reqList(card) {
    var anf = anfOf(card), st = checkStates(), out = [];
    Object.keys(REQ_DEFS).forEach(function (k) {
      if (anf[k] === true) out.push({ key: k, label: REQ_DEFS[k], ok: !!st[k] });
    });
    /* v889-docs: waehlbare Pflichtdokumente */
    if (Array.isArray(anf.docs) && anf.docs.length) {
      var conf = [];
      try { if (window.DealPilotDatenraum && window.DealPilotDatenraum.getConfirmedDocKeys) conf = window.DealPilotDatenraum.getConfirmedDocKeys(currentObjId()) || []; } catch (e) {}
      var miss = anf.docs.filter(function (k) { return conf.indexOf(k) < 0; });
      out.push({ key: 'docs', label: 'Pflichtdokumente (' + (anf.docs.length - miss.length) + '/' + anf.docs.length + ' best\u00e4tigt)', ok: miss.length === 0 });
    }
    /* v890-cdoc: eigene Pflichtdokumente (Nutzer bestaetigt manuell) */
    var _cds = Array.isArray(anf.custom_docs) ? anf.custom_docs : [];
    if (_cds.length) {
      var _conf = _cdocConfirmed(card.id, currentObjId());
      _cds.forEach(function (lbl) {
        var sl = _cdocSlug(lbl);
        out.push({ key: 'cdoc:' + sl, label: lbl, ok: _conf.indexOf(sl) >= 0, custom: true, cid: card.id, slug: sl });
      });
    }
    return out;
  }
  function gateHtml(card) {
    var reqs = reqList(card);
    var locked = reqs.some(function (r) { return !r.ok; });
    var reqBox = '';
    if (reqs.length) {
      reqBox = '<div class="dab-req"><div class="dab-req-t">' + ICO.lock + ' Voraussetzungen f\u00fcr die Anfrage</div><ul>' +
        reqs.map(function (r) {
          var fix;
          if (r.custom) {
            fix = '<label class="dab-cdoc"><input type="checkbox" ' + (r.ok ? 'checked' : '') + ' onchange="DealActionBoarding.toggleCustomDoc(' + (r.cid | 0) + ',\'' + r.slug + '\',this.checked)"> bestätigt</label>';
          } else {
            fix = r.ok ? '' : '<span class="dab-req-fix" onclick="DealActionBoarding.fixReq(\'' + r.key + '\')">Beheben</span>';
          }
          return '<li class="' + (r.ok ? 'ok' : 'no') + '"><span class="ic">' + (r.ok ? '✓' : '✕') + '</span>' + esc(r.label) + fix + '</li>';
        }).join('') + '</ul></div>';
    }
    var cta;
    if (locked) {
      cta = '<button class="dab-bp-cta locked" type="button"><span class="dab-bp-cta-t">' + ICO.lock + ' Anfrage gesperrt</span><span class="dab-bp-cta-s">erst Voraussetzungen erf\u00fcllen</span></button>';
    } else if ((card.cta_aktion || 'lead') === 'link' && card.cta_url) {
      /* v871: CTA oeffnet Partner-Seite; Klick wird als Lead gezaehlt */
      cta = '<button class="dab-bp-cta" type="button" style="--acc:' + esc(card.akzent || 'var(--wl-c9a84c, #C9A84C)') + '" onclick="DealActionBoarding.linkOut(' + (card.id | 0) + ')"><span class="dab-bp-cta-t">' + esc(card.cta_label || 'Zur Anfrage') + '</span><span class="dab-bp-cta-s">\u00f6ffnet Partner-Seite</span></button>';
    } else if ((card.cta_aktion || 'lead') === 'gutachten_modal') {
      // v854: DealPilot-internes Gutachten-Modal statt Lead-Mail
      cta = '<button class="dab-bp-cta" type="button" style="--acc:' + esc(card.akzent || 'var(--wl-c9a84c, #C9A84C)') + '" onclick="DealActionBoarding.gutachtenModal()"><span class="dab-bp-cta-t">' + esc(card.cta_label || 'Gutachten anfragen') + '</span><span class="dab-bp-cta-s">Details direkt angeben</span></button>';
    } else {
      cta = '<button class="dab-bp-cta" type="button" style="--acc:' + esc(card.akzent || 'var(--wl-c9a84c, #C9A84C)') + '" onclick="DealActionBoarding.leadSheet(' + (card.id | 0) + ',this)"><span class="dab-bp-cta-t">' + esc(card.cta_label || 'Anfrage senden') + '</span><span class="dab-bp-cta-s">kostenlos &amp; unverbindlich</span></button>';
    }
    return reqBox + cta;
  }
  function refreshGates() {
    document.querySelectorAll('#s8 .dab-gatewrap').forEach(function (w) {
      if (w.getAttribute('data-sent') === '1') return;
      var id = parseInt(w.getAttribute('data-cid'), 10);
      var card = _cards.filter(function (c) { return c.id === id; })[0];
      if (card) w.innerHTML = gateHtml(card);
    });
  }
  function fixReq(key) {
    if (key === 'readycheck100') {
      try {
        var d = window.DealPilotReadyCheck.getData();
        if (d && d.missing.length) { window.DealPilotReadyCheck.jump(d.missing[0].key); return; }
      } catch (e) {}
    }
    try { window.DealPilotDealAction.openDatenraumSettings(); } catch (e) {}
  }

  /* ────────────────── Netzwerk laden + Karten ────────────────── */
  var _cats = [];
  function loadNetwork() {
    var headers = {};
    var t = token(); if (t) headers['Authorization'] = 'Bearer ' + t;
    fetch('/api/v1/network-cards', { headers: headers })
      .then(function (r) {
        if (r.status === 401) {
          /* v870: abgelaufene Sitzung ehrlich melden statt "Noch keine Partner" */
          var h = document.getElementById('dab-rails-host');
          if (h) h.innerHTML = '<div class="dab-net-load">Sitzung abgelaufen \u2014 bitte einmal neu anmelden (Seite neu laden), dann erscheint dein Netzwerk wieder.</div>';
          return null;
        }
        return r.ok ? r.json() : { cards: [], categories: [] };
      })
      .then(function (data) {
        if (data === null) return;
        _cards = (data && data.cards) || [];
        _cats = (data && data.categories) || [];
        buildRails();
      })
      .catch(function () {
        var h = document.getElementById('dab-rails-host');
        if (h) h.innerHTML = '<div class="dab-net-load">Netzwerk aktuell nicht erreichbar.</div>';
      });
  }
  /* v878-rotate: Netzwerk-Karten mischen + rotieren */
  var _dabRotTimer = null, _dabRotPaused = false;
  function _dabShuffle(a){ for (var i=a.length-1;i>0;i--){ var j=(Math.random()*(i+1))|0, t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function _dabStartRotate(){
    if (_dabRotTimer){ clearInterval(_dabRotTimer); _dabRotTimer=null; }
    try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch(e){}
    var rails = document.querySelectorAll('#s8 .dab-rail');
    rails.forEach(function(rail){
      rail.addEventListener('mouseenter', function(){ _dabRotPaused = true; });
      rail.addEventListener('mouseleave', function(){ _dabRotPaused = false; });
    });
    _dabRotTimer = setInterval(function(){
      if (_dabRotPaused) return;
      var s8 = document.getElementById('s8'); if (!s8 || s8.offsetParent === null) return;
      document.querySelectorAll('#s8 .dab-rail').forEach(function(rail){
        var cards = rail.querySelectorAll('.dab-bp:not(.dab-bp-ad)');
        if (cards.length < 2) return;
        if (rail.getAttribute('data-sliding') === '1') return;
        var first = cards[0], ad = rail.querySelector('.dab-bp-ad');
        var cs = window.getComputedStyle(rail);
        var gap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
        var dx = first.getBoundingClientRect().width + gap;
        if (!(dx > 0)) { if (ad) { rail.insertBefore(first, ad); } else { rail.appendChild(first); } return; }
        /* v890-rotate: weiches Slide (leicht weiter gleiten), dann lautlos umsortieren */
        rail.setAttribute('data-sliding', '1');
        rail.style.transition = 'transform .7s cubic-bezier(.33,0,.2,1)';
        rail.style.transform = 'translateX(-' + dx + 'px)';
        var done = function(){
          if (rail.getAttribute('data-sliding') !== '1') return;
          rail.removeEventListener('transitionend', done);
          rail.style.transition = 'none';
          rail.style.transform = 'translateX(0)';
          if (ad) { rail.insertBefore(first, ad); } else { rail.appendChild(first); }
          void rail.offsetWidth;
          rail.removeAttribute('data-sliding');
        };
        rail.addEventListener('transitionend', done);
        setTimeout(function(){ if (rail.getAttribute('data-sliding') === '1') done(); }, 900);
      });
    }, 10000);
  }
  function buildRails() {
    var host = document.getElementById('dab-rails-host');
    if (!host) return;
    var cats = _cats && _cats.length ? _cats.slice() : [
      { key: 'finanzierung', label: 'Finanzierung & Banken', farbe: '#5a9bc4' },
      { key: 'gutachter', label: 'Gutachter & Sachverst\u00e4ndige', farbe: 'var(--wl-c9a84c, #C9A84C)' }
    ];
    var html = '';
    cats.forEach(function (cat) {
      var cs = _cards.filter(function (c) { return c.kategorie === cat.key; });
      if (!cs.length) return;
      _dabShuffle(cs); /* v878-rotate: gemischte Startreihenfolge */
      var farbe = cat.farbe || 'var(--wl-c9a84c, #C9A84C)';
      html += railHead(cat.key, farbe, cat.label || cat.key);
      html += '<div class="dab-rail" id="dab-rail-' + esc(cat.key) + '">' +
        cs.map(function (c) { return cardHtml(c, farbe); }).join('') + adCard(farbe) + '</div>';
    });
    host.innerHTML = html || '<div class="dab-net-load">Noch keine Partner hinterlegt.</div>';
    host.querySelectorAll('.dab-rail').forEach(function (el) {
      el.addEventListener('scroll', function () { updArrows(el.id); }, { passive: true });
      el.addEventListener('wheel', function (ev) {
        if (el.scrollWidth <= el.clientWidth + 4) return;
        if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) { el.scrollLeft += ev.deltaY; ev.preventDefault(); }
      }, { passive: false });
      updArrows(el.id);
    });
    _dabStartRotate();
  }
  function bgAttrs(card) {
    var bg = card.hintergrund || 'weiss';
    if (bg === 'bild' && card.hintergrund_bild) {
      // v856: Schleier-Deckkraft pro Karte einstellbar (0 = Bild pur, 100 = fast weiss)
      var a = Math.max(0, Math.min(100, parseInt(card.hintergrund_deckkraft, 10) >= 0 ? parseInt(card.hintergrund_deckkraft, 10) : 85)) / 100;
      return { cls: '', style: "background:linear-gradient(rgba(255,255,255," + a.toFixed(2) + "),rgba(255,255,255," + (a * 0.92).toFixed(2) + ")),url('" + String(card.hintergrund_bild).replace(/'/g, '') + "') center/cover;" };
    }
    if (bg === 'custom' && card.hintergrund_farbe) {
      return { cls: '', style: 'background:' + esc(card.hintergrund_farbe) + ';' };
    }
    return { cls: ' dab-bg-' + esc(bg), style: '' };
  }
  function edgeHtml(card) {
    var stil = card.kante_stil || 'k1';
    var farbe = card.kante_farbe || '';
    var st = farbe ? ' style="--kante:' + esc(farbe) + '"' : '';
    return '<div class="dab-edge dab-edge-' + esc(stil) + '"' + st + '></div>';
  }
  function cardHtml(c, defAcc) {
    var acc = c.akzent || defAcc;
    var tags = [];
    try { tags = Array.isArray(c.tags) ? c.tags : (c.tags ? JSON.parse(c.tags) : []); } catch (e) { tags = []; }
    var tagH = tags.slice(0, 4).map(function (t) { return '<span class="dab-bp-tag">' + esc(t) + '</span>'; }).join('');
    var lsrc = c.logo_data || c.logo_url;
    var lz = Math.max(50, Math.min(300, parseInt(c.logo_zoom, 10) || 100));
    var lx = Math.max(0, Math.min(100, parseInt(c.logo_x, 10) || 50));
    var ly = Math.max(0, Math.min(100, parseInt(c.logo_y, 10) || 50));
    var logo = lsrc
      ? '<img src="' + esc(lsrc) + '" alt="" style="width:100%;height:100%;object-fit:cover;background:' + esc(c.logo_bg || '#fff') + ';object-position:' + lx + '% ' + ly + '%;transform:scale(' + (lz / 100) + ');transform-origin:' + lx + '% ' + ly + '%">'
      : '<div class="dab-bp-mono" style="background:' + esc(acc) + '">' + esc((c.kuerzel || (c.name || '?').slice(0, 2)).toUpperCase()) + '</div>';
    var ver = c.verified
      ? '<span class="dab-bp-ver">' + ICO.check + ' Gepr\u00fcft</span>' : '';
    var web = '';
    if (c.website) {
      var wurl = /^https?:\/\//i.test(c.website) ? c.website : 'https://' + c.website;
      var wdom = String(c.website).replace(/^https?:\/\//i, '').replace(/\/$/, '');
      web = '<a class="dab-bp-web" href="' + esc(wurl) + '" target="_blank" rel="noopener">' + ICO.globe + ' ' + esc(wdom) + '</a>';
    }
    var meta = '';
    if (c.usp || c.antwortzeit) {
      meta = '<div class="dab-bp-meta">' +
        (c.usp ? '<span class="dab-bp-usp">' + esc(c.usp) + '</span>' : '<span></span>') +
        (c.antwortzeit ? '<span class="dab-bp-resp">' + ICO.clock + ' ' + esc(c.antwortzeit) + '</span>' : '') +
        '</div>';
    }
    var bg = bgAttrs(c);
    return '<article class="dab-bp' + bg.cls + '" style="--acc:' + esc(acc) + ';' + (c.kante_farbe ? '--stubbg:' + esc(c.kante_farbe) + ';' : '') + bg.style + '">' + /* v879-stub-farbe */
      '<div class="dab-bp-l"><div class="dab-bp-top"><div class="dab-bp-logo">' + logo + '</div>' +
        '<div><div class="dab-bp-name">' + esc(c.name || '') + ver + '</div><div class="dab-bp-role">' + esc(c.rolle || '') + '</div></div></div>' +
        '<div class="dab-bp-tags">' + tagH + '</div>' +
        '<div class="dab-bp-desc">' + esc(c.beschreibung || '') + '</div>' +
        web + meta +
        '<div class="dab-gatewrap" data-cid="' + (c.id | 0) + '">' + gateHtml(c) + '</div>' +
      '</div>' +
      edgeHtml(c) +
      '<div class="dab-bp-stub"><div class="dab-bp-code">' + esc((c.kuerzel || 'DP').toUpperCase()) + '</div><div class="dab-bp-barcode"></div><div class="dab-bp-lbl">BOARDING</div></div>' +
      '</article>';
  }
  function adCard(acc) {
    return '<article class="dab-bp dab-bp-ad" style="--acc:' + esc(acc) + '"><div class="dab-bp-l"><div class="dab-bp-adbadge">Freier Sitzplatz</div>' +
      '<div class="dab-bp-adic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg></div>' +
      '<div class="dab-bp-adt">Ihr Platz vor kaufbereiten Investoren</div><div class="dab-bp-ads">Genau im Moment der Finanzierungs- und Gutachten-Entscheidung. Qualifizierte Leads, keine Streuverluste.</div>' +
      '<button class="dab-bp-cta" type="button" onclick="DealActionBoarding.partnerInterest()"><span class="dab-bp-cta-t">Partner werden</span><span class="dab-bp-cta-s">Konditionen anfragen</span></button></div>' +
      '<div class="dab-edge dab-edge-k1"></div>' +
      '<div class="dab-bp-stub dab-bp-stub-ad"><div class="dab-bp-plus">+</div><div class="dab-bp-lbl">FREI</div></div></article>';
  }

  /* ────────────────── Lead-Sheet + Versand ────────────────── */
  function eckdaten() {
    var kp = gv('kp'), wfl = gv('wfl'), bj = gv('baujahr');
    var dscr = gt('kpi-dscr'), ltv = gt('kpi-ltv');
    var out = {};
    if (kp) out.kaufpreis = kp + ' \u20ac';
    if (wfl) out.wohnflaeche = wfl + ' m\u00b2';
    if (bj) out.baujahr = bj;
    if (dscr && dscr !== '\u2014') out.dscr = dscr;
    if (ltv && ltv !== '\u2014') out.ltv = ltv;
    return out;
  }
  function adresse() {
    var a = [gv('str'), gv('hnr')].filter(Boolean).join(' ');
    var b = [gv('plz'), gv('ort')].filter(Boolean).join(' ');
    return [a, b].filter(Boolean).join(', ');
  }
  function drInfo() {
    var out = { pers_url: '', obj_url: '', snippet: '' };
    try {
      var DR = window.DealPilotDatenraum;
      if (!DR) return out;
      var c = DR.getCompletionForRequest(currentObjId(), 'bank');
      if (c) {
        if (c.persoenlich && c.persoenlich.hatOrdner) out.pers_url = c.persoenlich.slot.url || '';
        if (c.objekt && c.objekt.hatOrdner) out.obj_url = c.objekt.slot.url || '';
      }
      if (DR.buildBankSnippet) out.snippet = DR.buildBankSnippet(currentObjId(), 'bank') || '';
    } catch (e) {}
    return out;
  }
  function ensureMask() {
    if (document.getElementById('dab-lead-mask')) return;
    var div = document.createElement('div');
    div.id = 'dab-lead-mask';
    div.className = 'dabm-mask';
    div.addEventListener('click', function (ev) { if (ev.target === div) closeSheet(); });
    div.innerHTML =
      '<div class="dabm-card"><div class="dabm-head"><span class="t">Anfrage senden</span></div>' +
      '<div class="dabm-body">' +
        '<div class="dabm-p" id="dabm-title">Anfrage</div>' +
        '<div class="dabm-sub">Der Partner erh\u00e4lt deine Anfrage per E-Mail und meldet sich direkt bei dir.</div>' +
        '<div class="dabm-inc"><div class="ct">Das geht automatisch mit</div><ul id="dabm-list"></ul></div>' +
        '<div class="dabm-note">Kostenlos &amp; unverbindlich. Keine Weitergabe an Dritte \u2014 nur an diesen Partner.</div>' +
        '<div class="dabm-actions"><button class="dabm-go" id="dabm-go" type="button">Jetzt anfragen</button><button class="dabm-x" type="button" onclick="DealActionBoarding.closeSheet()">Abbrechen</button></div>' +
      '</div></div>';
    document.body.appendChild(div);
  }
  var _sheetBtn = null;
  function leadSheet(cardId, btn) {
    var card = _cards.filter(function (c) { return c.id === cardId; })[0];
    if (!card) return;
    ensureMask();
    _sheetBtn = btn;
    var mit = mitOf(card);
    var items = [];
    var addr = adresse();
    if (mit.objekt) items.push('Objekt: ' + (addr || 'aktuelles Objekt'));
    if (mit.objekt_voll) items.push('Ganzes Objekt als .dpk-Datei (alle Werte inkl. Finanzierung)'); /* v891-dpk */
    if (mit.eckdaten) items.push('Eckdaten: Kaufpreis, Wohnfl\u00e4che, DSCR, LTV');
    if (mit.kontakt) items.push('Deine Kontakt-E-Mail f\u00fcr die R\u00fcckmeldung');
    if (mit.dr_persoenlich) items.push('Link: Datenraum pers\u00f6nlich');
    if (mit.dr_objekt) items.push('Link: Datenraum Objekt');
    if (!items.length) items.push('Nur deine Anfrage \u2014 keine Objektdaten');
    document.getElementById('dabm-title').textContent = 'Anfrage an ' + (card.name || 'Partner');
    document.getElementById('dabm-list').innerHTML = items.map(function (t) {
      return '<li><span class="ic">' + ICO.check + '</span>' + esc(t) + '</li>';
    }).join('');
    document.getElementById('dabm-go').onclick = function () { sendLead(card); };
    document.getElementById('dab-lead-mask').classList.add('show');
  }
  function closeSheet() {
    var m = document.getElementById('dab-lead-mask');
    if (m) m.classList.remove('show');
  }
  function sendLead(card) {
    closeSheet();
    var btn = _sheetBtn;
    var mit = mitOf(card);
    var body = {
      object_ref: currentObjId(),
      mit_bilder: (function(){try{return localStorage.getItem('dp_export_photos')!=='0';}catch(e){return true;}})(), /* v893r-mitbilder */
      adresse: mit.objekt ? adresse() : '',
      eckdaten: mit.eckdaten ? eckdaten() : {},
      dr: (mit.dr_persoenlich || mit.dr_objekt) ? drInfo() : {},
      checks: checkStates()
    };
    var headers = { 'Content-Type': 'application/json' };
    var t = token(); if (t) headers['Authorization'] = 'Bearer ' + t;
    fetch('/api/v1/network-cards/' + (card.id | 0) + '/lead', {
      method: 'POST', headers: headers, body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 409) return r.json().then(function (j) {
        toast('Anfrage gesperrt: ' + ((j && j.missing) || []).join(', '));
        refreshGates();
        throw new Error('gate');
      });
      if (!r.ok) throw new Error('http');
      return r.json();
    }).then(function () {
      if (btn) {
        var wrap = btn.closest('.dab-gatewrap');
        if (wrap) {
          wrap.setAttribute('data-sent', '1');
          wrap.innerHTML = '<button class="dab-bp-cta sent" type="button"><span class="dab-bp-cta-t">Anfrage gesendet \u2713</span><span class="dab-bp-cta-s">der Partner meldet sich</span></button>';
        }
      }
      toast('Anfrage an ' + (card.name || 'Partner') + ' gesendet ' + ICO.plane);
    }).catch(function (e) {
      if (e && e.message === 'gate') return;
      toast('Anfrage konnte nicht gesendet werden.');
    });
  }
  function partnerInterest() { /* v893n-partner */
    toast('Danke f\u00fcr das Interesse \u2014 Marcel wird informiert.');
    try {
      fetch('/api/v1/network-cards/partner-interest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }, body: '{}' }).catch(function () {});
    } catch (e) {}
  }

  /* ────────────────── Exporte ────────────────── */
  function exportDoc(which) {
    try {
      if (which === 'invest' && typeof window.exportPDF === 'function') return window.exportPDF();
      if (which === 'bmf') {
        // v854: Steuerformular-PDF (Anlage V) statt Kaufpreisaufteilung
        if (typeof window.exportWerbungskostenPDF === 'function') {
          var sel = document.getElementById('dab-fa-year');
          var mode = (sel && sel.value !== '') ? sel.value : '0';
          return window.exportWerbungskostenPDF(mode);
        }
        toast('Finanzamt-PDF-Modul nicht geladen.');
        return;
      }
      if (which === 'track') {
        // v854: Auswahl-Modal (Won-Filter, Einzel-/Sammel-PDF) statt Blind-Export
        if (typeof window.showTrackRecordView === 'function') return window.showTrackRecordView();
        toast('Track-Record-Ansicht nicht verf\u00fcgbar.');
        return;
      }
      toast('Export nicht verf\u00fcgbar.');
    } catch (e) { toast('Export fehlgeschlagen.'); }
  }

  /* ────────────────── Rails / Smartklappe / Datenraum ────────────────── */
  function railScroll(id, dir) {
    var el = document.getElementById(id); if (!el) return;
    var max = Math.max(0, el.scrollWidth - el.clientWidth);
    var target = Math.max(0, Math.min(max, el.scrollLeft + dir * 462));
    try { el.scrollTo({ left: target, behavior: 'smooth' }); }
    catch (e) { el.scrollLeft = target; }
    setTimeout(function () { updArrows(id); }, 380);
  }
  function updArrows(id) {
    // v855: nie disabled (Deadlock bei verstecktem Tab) - nur optisch dimmen
    var el = document.getElementById(id); if (!el) return;
    var head = el.previousElementSibling; if (!head) return;
    var b = head.querySelectorAll('.dab-rail-arr'); if (b.length < 2) return;
    var max = el.scrollWidth - el.clientWidth;
    b[0].classList.toggle('dim', el.scrollLeft <= 2);
    b[1].classList.toggle('dim', max <= 4 || el.scrollLeft >= max - 2);
  }
  function toggleSmart() { var s = document.getElementById('dab-smart'); if (s) s.classList.toggle('open'); }
  function mountDatenraum() {
    var host = document.getElementById('dab-dr-host');
    if (!host) return;
    var oid = currentObjId();
    /* v873: beim Tab-Aufbau kann der Objekt-Key noch fehlen — kurz nachfassen */
    if (!oid) {
      mountDatenraum._try = (mountDatenraum._try || 0) + 1;
      if (mountDatenraum._try <= 4) setTimeout(mountDatenraum, 900);
    } else {
      mountDatenraum._try = 0;
    }
    /* v873: Verknuepfungs-Status sichtbar (persoenlich / Objekt) */
    var _pOk = false, _oOk = false;
    try {
      if (oid && window.DealPilotDatenraum && window.DealPilotDatenraum.getCompletionForRequest) {
        var _st = window.DealPilotDatenraum.getCompletionForRequest(oid, 'bank');
        _pOk = !!(_st && _st.persoenlich && _st.persoenlich.hatOrdner);
        _oOk = !!(_st && _st.objekt && _st.objekt.hatOrdner);
      }
    } catch (e) {}
    function drChip(ok, lbl) {
      return '<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:600;margin-right:6px;' +
        (ok ? 'background:rgba(63,165,108,.14);color:#2f7d52;border:1px solid rgba(63,165,108,.4)'
            : 'background:rgba(0,0,0,.04);color:#8a8378;border:1px solid #ddd6c8') + '">' +
        (ok ? '\u2713' : '\u2715') + ' ' + lbl + '</span>';
    }
    var drChips = '<div style="margin-top:7px">' + drChip(_pOk, 'Pers\u00f6nlich verkn\u00fcpft') + drChip(_oOk, 'Objekt verkn\u00fcpft') + '</div>';
    var drBtnLabel = (_pOk && _oOk) ? 'Verwalten' : 'Einrichten';
    var inner = '';
    try {
      if (window.DealPilotDatenraum && typeof window.DealPilotDatenraum.renderDealActionPanel === 'function') {
        inner = window.DealPilotDatenraum.renderDealActionPanel(oid, 'bank') || '';
      }
    } catch (e) { inner = ''; }
    host.innerHTML =
      '<div class="dab-dr-link"><div class="dab-dr-ic"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a8 3 0 0 0 16 0 8 3 0 0 0-16 0z"/><path d="M4 7v10a8 3 0 0 0 16 0V7"/><path d="M4 12a8 3 0 0 0 16 0"/></svg></div>' +
        '<div class="dab-dr-x"><div class="dab-dr-t">Datenraum verkn\u00fcpfen</div><div class="dab-dr-s">Pers\u00f6nlicher + Objekt-Datenraum \u2014 werden Bank-Anfragen automatisch beigef\u00fcgt und schalten Partner-Anfragen frei.</div>' + drChips + '</div>' +
        '<button class="dab-dr-btn" type="button" onclick="DealPilotDealAction.openDatenraumSettings()">' + drBtnLabel + '</button></div>' +
      (inner ? '<div class="dab-dr-panel">' + inner + '</div>' : '');
  }

  window._dabDrRefresh = mountDatenraum;  /* v874: Live-Refresh nach Haekchen-Klick */

  /* ────────────────── afterRender ────────────────── */
  function afterRender() {
    injectCss();
    try { if (window.DealPilotDealAction && window.DealPilotDealAction.initStatusSync) window.DealPilotDealAction.initStatusSync(); } catch (e) {}
    try { if (window.DealPilotReadyCheck && window.DealPilotReadyCheck.getData) renderReadiness(window.DealPilotReadyCheck.getData()); } catch (e) {}
    try { if (window.DealPilotReadyCheck && window.DealPilotReadyCheck.refresh) window.DealPilotReadyCheck.refresh(); } catch (e) {}
    try { fillFaYears(); } catch (e) {}
    try { mountDatenraum(); } catch (e) {}
    try {
      var _uw = document.getElementById('dpuew-stage'), _usl = document.getElementById('dab-uew-slot');
      if (_uw && _usl && _uw.parentNode !== _usl) _usl.appendChild(_uw);
    } catch (e) {}
    try { if (typeof window._dpDealShareRefresh === 'function') setTimeout(window._dpDealShareRefresh, 350); } catch (e) {}
    try { loadNetwork(); } catch (e) {}
    try { mountMarktberichte(); } catch (e) {}
  }

  function injectCss() {
    if (document.getElementById('dab-styles')) return;
    var st = document.createElement('style');
    st.id = 'dab-styles';
    st.textContent = DAB_CSS;
    document.head.appendChild(st);
  }

  /* v871: Partner-Link oeffnen + Klick als Lead zaehlen (fire-and-forget) */
  function linkOut(cardId) {
    var card = null;
    for (var i = 0; i < _cards.length; i++) { if ((_cards[i].id | 0) === (cardId | 0)) { card = _cards[i]; break; } }
    if (!card || !card.cta_url) return;
    try {
      var headers = { 'Content-Type': 'application/json' };
      var t = token(); if (t) headers['Authorization'] = 'Bearer ' + t;
      fetch('/api/v1/network-cards/' + (cardId | 0) + '/click', {
        method: 'POST', headers: headers,
        body: JSON.stringify({ object_ref: currentObjId() || '' })
      }).catch(function () {});
    } catch (e) {}
    var u = String(card.cta_url);
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    window.open(u, '_blank', 'noopener');
  }

  /* v895g-mbreports: Marktberichte je Objekt in Deal-Aktion + PDF aus report_md (jsPDF) */
  function _mbReportPdf(reportMd, meta) {
    var NS = window.jspdf || window.jsPDF || {};
    var JS = NS.jsPDF || NS;
    var doc = new JS({ unit: 'pt', format: 'a4' });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var m = 48, y = m, maxw = W - 2 * m;
    function nl(h) { y += h; if (y > H - m) { doc.addPage(); y = m; } }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(30, 30, 30);
    doc.text('Marktbericht', m, y); nl(20);
    if (meta && meta.date) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120); doc.text(meta.date, m, y); nl(18); }
    String(reportMd || 'Kein Berichtstext.').replace(/\r/g, '').split('\n').forEach(function (ln) {
      ln = ln.replace(/\*\*/g, '').replace(/^\s*[-*]\s+/, '\u2022 ');
      var h1 = ln.match(/^#\s+(.*)/), h2 = ln.match(/^##\s+(.*)/), h3 = ln.match(/^###\s+(.*)/);
      if (h1) { nl(8); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(154, 125, 40); doc.text(h1[1].replace(/^[A-Z]\d?\)\s*/, ''), m, y); nl(18); return; }
      if (h2) { nl(6); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(60, 60, 60); doc.text(h2[1].replace(/^[A-Z]\d?\)\s*/, ''), m, y); nl(15); return; }
      if (h3) { doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(80, 80, 80); doc.text(h3[1], m, y); nl(14); return; }
      if (!ln.trim()) { nl(7); return; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      doc.splitTextToSize(ln, maxw).forEach(function (w) { doc.text(w, m, y); nl(13.5); });
    });
    return doc;
  }
  function _mbInjectCss() {
    if (document.getElementById('dab-mb-css')) return;
    var st = document.createElement('style'); st.id = 'dab-mb-css';
    /* v942-mbrow: Look = .dab-doc-row (44er Kachel, Haarlinie rgba(42,39,39,.1)).
       Gold ueber --dab-gold* -> zeigt seit W5 auf --gold, dreht also beim
       Partner-Mandanten mit. Kein hartes rgba(201,168,76,..) mehr. */
    st.textContent = '#s8 .dab-mb-host{padding:6px 2px}#s8 .dab-mb-empty{color:#8a8378;font-size:13px;padding:8px 2px}'
      + '#s8 .dab-mb-row{display:flex;align-items:center;gap:14px;padding:14px 4px;border-top:1px solid rgba(42,39,39,.1)}'
      + '#s8 .dab-mb-row:first-child{border-top:none}'
      + '#s8 .dab-mb-icb{width:44px;height:44px;border-radius:11px;background:#F8F6F1;border:1px solid rgba(42,39,39,.12);display:flex;align-items:center;justify-content:center;color:var(--dab-gold3);flex-shrink:0}'
      + '#s8 .dab-mb-main{flex:1;min-width:0}'
      + '#s8 .dab-mb-l1{display:flex;align-items:center;gap:8px;margin-bottom:3px}'
      + '#s8 .dab-mb-kz{font-family:var(--dab-fs);font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#1a1508;background:var(--dab-run);border-radius:4px;padding:2px 6px;white-space:nowrap}'
      + '#s8 .dab-mb-kz.none{background:none;border:1px dashed rgba(42,39,39,.28);color:#8a8378}'
      + '#s8 .dab-mb-addr{font-size:13.5px;font-weight:600;color:#2A2727;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '#s8 .dab-mb-d{font-family:var(--dab-fm);font-size:11px;color:#8a8378;font-weight:400}'
      + '#s8 .dab-mb-mv{font-family:var(--dab-fm);font-size:14.5px;font-weight:700;color:#2A2727;white-space:nowrap;text-align:right}'
      + '#s8 .dab-mb-mv small{display:block;font-family:var(--dab-fs);font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--dab-gold3);margin-top:2px}'
      + '#s8 .dab-mb-mv.nod{color:#8a8378;font-weight:500;font-size:11.5px}'
      + '@media(max-width:600px){#s8 .dab-mb-row{flex-wrap:wrap}#s8 .dab-mb-mv{text-align:left}}'
      /* v965-mbcss: der gefaltete Rest + der Knopf. Gold ueber --dab-gold*, wie
         der Rest der Sektion — dreht beim Partner-Mandanten mit. */
      + '#s8 .dab-mb-more{display:none}'
      + '#s8 .dab-mb-host.mb-open .dab-mb-more{display:block}'
      + '#s8 .dab-mb-tog{display:block;width:100%;margin-top:8px;padding:9px 4px;background:none;'
        + 'border:1px dashed rgba(42,39,39,.22);border-radius:9px;cursor:pointer;'
        + 'font-family:var(--dab-fs);font-size:11.5px;font-weight:700;letter-spacing:.4px;'
        + 'text-transform:uppercase;color:var(--dab-gold3)}'
      + '#s8 .dab-mb-tog:hover{background:#F8F6F1;border-style:solid}'
      + '#s8 .dab-mb-tog .lbl-less{display:none}'
      + '#s8 .dab-mb-host.mb-open .dab-mb-tog .lbl-more{display:none}'
      + '#s8 .dab-mb-host.mb-open .dab-mb-tog .lbl-less{display:inline}'
      /* v966-delcss: Loeschen-Knopf. Grau in Ruhe, rot erst beim Hover — wer
         trifft, trifft absichtlich. Rot = Statusfarbe, bleibt hart. */
      + '#s8 .dab-mb-del{margin-left:6px;width:34px;height:34px;flex:0 0 auto;border:1px solid rgba(42,39,39,.16);'
        + 'border-radius:9px;background:none;color:#9a9288;font-size:14px;line-height:1;cursor:pointer}'
      + '#s8 .dab-mb-del:hover{color:#B8625C;border-color:#B8625C;background:#FBF3F2}';
    document.head.appendChild(st);
  }
  /* v942-mbrow: eigenes Icon — die ICO-Tabelle traegt kein Dokument-Symbol. */
  var _DAB_MB_DOC = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">'
    + '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>';
  /* v946-objready: EINMAL registrieren, nicht bei jedem Rendern neu.
   * afterRender() laeuft genau einmal (Z.731) — wenn _currentObjKey da noch
   * nicht steht, blieb "Kein Objekt aktiv." bis zum Hard-Reload stehen.
   * Jetzt zeichnet das Band neu, sobald storage.js den Schluessel meldet. */
  window._dabMbRefresh = function () { try { mountMarktberichte(); } catch (e) {} };
  if (!window._dabMbBound) {
    window._dabMbBound = 1;
    window.addEventListener('dp:object-ready', function () { window._dabMbRefresh(); });
  }

  async function mountMarktberichte() {
    var host = document.getElementById('dab-mb-host'); if (!host) return;
    _mbInjectCss();
    var id = currentObjId();
    if (!id) {
      /* Kein Dead-End mehr: dp:object-ready holt uns hier wieder raus. */
      host.innerHTML = '<div class="dab-mb-empty">Kein Objekt aktiv \u2014 links ein Objekt \u00f6ffnen.</div>';
      return;
    }
    host.innerHTML = '<div class="dab-mb-empty">Marktberichte werden geladen \u2026</div>';
    try {
      var t = token(); var res = await fetch('/api/v1/marktbericht/objects/history?ref=' + encodeURIComponent(id), { headers: t ? { Authorization: 'Bearer ' + t } : {} });
      var j = await res.json();
      var reps = ((j && j.history) || []).filter(function (h) { return h && h.report_id != null; });
      if (!reps.length) { host.innerHTML = '<div class="dab-mb-empty">Noch keine Marktberichte f\u00fcr dieses Objekt \u2014 im Bewertung-Tab einen erstellen.</div>'; return; }
      reps.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      /* v942-mbrow: Kuerzel + Adresse + Datum + Marktwert statt nacktem Timestamp.
       * Alle vier Werte liegen seit jeher in mb.object_snapshots — sie wurden nur
       * nie durchgereicht (api.js SELECT) und nie gerendert. KEIN Filter hier:
       * das Band heisst "zu diesem Objekt", da gehoert genau eins hin. */
      /* v965-mbfold
       * ────────────────────────────────────────────────────────
       * Bis hierher wurde JEDER Bericht gerendert. Wer an einem Tag sechsmal
       * erzeugt, bekommt sechs Zeilen mit derselben Adresse und schiebt sich
       * alles darunter aus dem Bild. Die 3 neuesten stehen offen (reps ist eine
       * Zeile davor absteigend sortiert), der Rest liegt gefaltet darunter.
       * Kein Filter, kein Verlust: aufgeklappt ist alles wieder da.
       */
      var _row = function (h) {
        var d = new Date(h.created_at); var ds = d.toLocaleDateString('de-DE') + ' \u00b7 ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        var kz = h.object_label
          ? '<span class="dab-mb-kz">' + String(h.object_label).replace(/</g, '&lt;') + '</span>'
          : '<span class="dab-mb-kz none">ohne Objekt</span>';
        var addr = String(h.address || 'Adresse unbekannt').replace(/</g, '&lt;');
        var mv = (h.market_value != null && h.market_value !== '')
          ? '<div class="dab-mb-mv">' + new Intl.NumberFormat('de-DE').format(Math.round(h.market_value)) + ' \u20ac<small>Marktwert</small></div>'
          : '<div class="dab-mb-mv nod">keine Daten</div>';
        return '<div class="dab-mb-row"><span class="dab-mb-icb">' + _DAB_MB_DOC + '</span>'
          + '<div class="dab-mb-main"><div class="dab-mb-l1">' + kz + '<span class="dab-mb-addr">' + addr + '</span></div>'
          + '<div class="dab-mb-d">' + ds + '</div></div>' + mv
          + '<button class="dab-doc-btn" onclick="DealActionBoarding.downloadReport(' + (h.report_id | 0) + ')">' + ICO.dl + 'PDF</button>'
          /* v966-delbtn: endgueltiges Loeschen — Rueckfrage in deleteReport(). */
          + '<button class="dab-mb-del" title="Bericht endg\u00fcltig l\u00f6schen" onclick="DealActionBoarding.deleteReport(' + (h.report_id | 0) + ')">\u2715</button></div>';
      };
      /* v965-mbfold-join: 3 offen, Rest in einen eigenen Block. */
      var OFFEN = 3;
      var _head = reps.slice(0, OFFEN).map(_row).join('');
      var _rest = reps.slice(OFFEN);
      var _tail = '';
      if (_rest.length) {
        _tail = '<div class="dab-mb-more">' + _rest.map(_row).join('') + '</div>'
          + '<button type="button" class="dab-mb-tog" onclick="DealActionBoarding.toggleReports(this)">'
          + '<span class="lbl-more">' + _rest.length + ' weitere anzeigen</span>'
          + '<span class="lbl-less">weniger anzeigen</span></button>';
      }
      host.className = 'dab-mb-host';
      host.innerHTML = _head + _tail;
    } catch (e) { host.innerHTML = '<div class="dab-mb-empty">Konnte Marktberichte nicht laden.</div>'; }
  }
  /* v949-realpdf
   * ────────────────────────────────────────────────────────────────────────
   * Bis v948 baute _mbReportPdf() hier ein eigenes A4 aus dem Markdown-Fliesstext
   * des Berichts. Der ECHTE Marktbericht entsteht in marktbericht-app/app.js
   * (exportPdf, 11x addPage/addImage: Deckblatt, Karten, Tachos, Diagramme).
   * Der Mandant bekam eine Textabschrift und hielt sie fuer seinen Bericht.
   * Jetzt fragen wir die echte Engine — Offscreen-iframe, Muster MA27/W27.
   */
  function _mbEnginePdf(rid) {
    return new Promise(function (resolve, reject) {
      var fr = document.createElement('iframe');
      fr.setAttribute('aria-hidden', 'true');
      fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:2000px;border:0;visibility:hidden';
      var done = false, to = null;
      function cleanup() {
        if (done) return; done = true;
        window.removeEventListener('message', onMsg);
        if (to) clearTimeout(to);
        setTimeout(function () { try { fr.remove(); } catch (e) {} }, 1500); /* save() braucht den Kontext noch */
      }
      function onMsg(ev) {
        if (!ev.data) return;
        if (ev.data.type === 'mbv-pdf-done') { cleanup(); resolve(); }
        else if (ev.data.type === 'mbv-pdf-fail') { cleanup(); reject(new Error(ev.data.error || 'Engine-Fehler')); }
      }
      window.addEventListener('message', onMsg);
      /* Der Bericht ist gross (Karten, Charts) — 90 s statt eines knappen Timers.
       * Der Timer ist hier kein Rennen um Daten, sondern eine Notbremse gegen
       * ein iframe, das gar nichts mehr meldet. */
      to = setTimeout(function () { cleanup(); reject(new Error('Zeitueberschreitung')); }, 90000);
      fr.src = '/marktbericht-app/index.html?v=949&theme=light&autopdf=1&report=' + encodeURIComponent(rid);
      document.body.appendChild(fr);
    });
  }

  /* v966-delreport
   * Loescht einen Marktbericht ENDGUELTIG (Entscheidung 17.07.: "komplett in
   * der db loeschen"). Der Proxy setzt user_id aus dem Token (v942-userbind),
   * das mb-backend prueft den Besitz am Snapshot und loescht in einer
   * Transaktion ueber alle sechs Tabellen. 404 -> fremder oder unbekannter
   * Bericht, nichts geloescht.
   * Die Rueckfrage nennt Adresse+Datum der Zeile, damit niemand den falschen
   * von sechs gleich aussehenden Eintraegen trifft. */
  async function deleteReport(rid) {
    try {
      var row = null;
      try {
        var btns = document.querySelectorAll('#dab-mb-host .dab-mb-del');
        for (var i = 0; i < btns.length; i++) {
          if ((btns[i].getAttribute('onclick') || '').indexOf('(' + rid + ')') >= 0) { row = btns[i].closest('.dab-mb-row'); break; }
        }
      } catch (e) {}
      var was = '';
      if (row) {
        var a = row.querySelector('.dab-mb-addr'); var d = row.querySelector('.dab-mb-d');
        was = '\n\n' + ((a && a.textContent) || '') + '\n' + ((d && d.textContent) || '');
      }
      if (!window.confirm('Diesen Marktbericht endg\u00fcltig l\u00f6schen?' + was + '\n\nDas kann nicht r\u00fcckg\u00e4ngig gemacht werden.')) return;
      var t = token();
      var res = await fetch('/api/v1/marktbericht/reports/' + (rid | 0), {
        method: 'DELETE',
        headers: t ? { Authorization: 'Bearer ' + t } : {}
      });
      if (!res.ok) {
        var err = null; try { err = await res.json(); } catch (e) {}
        toast('L\u00f6schen fehlgeschlagen' + (err && err.error ? ': ' + err.error : ' (' + res.status + ')'));
        return;
      }
      toast('Marktbericht gel\u00f6scht.');
      try { window._dabMbRefresh(); } catch (e) {}
    } catch (e) {
      toast('L\u00f6schen fehlgeschlagen: ' + e.message);
    }
  }

  async function downloadReport(rid) {
    try {
      try {
        toast('Marktbericht wird erzeugt \u2026');
        await _mbEnginePdf(rid);
        return;   /* echte Engine hat geliefert */
      } catch (e) {
        try { console.warn('[dab] Engine-PDF fehlgeschlagen, Rueckfall auf Kurzfassung:', e.message); } catch (x) {}
      }
      /* Rueckfall: die alte Textabschrift. Der Nutzer MUSS erfahren, dass er
       * nicht den vollen Bericht hat — sonst legt er die Kurzfassung der Bank vor. */
      var t = token(); var res = await fetch('/api/v1/marktbericht/reports/one?id=' + encodeURIComponent(rid), { headers: t ? { Authorization: 'Bearer ' + t } : {} });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var out = await res.json();
      var doc = _mbReportPdf(out.report_md, {});
      doc.save('Marktbericht-Kurzfassung.pdf');
      toast('\u26a0 Nur die Textfassung \u2014 der vollst\u00e4ndige Bericht konnte nicht erzeugt werden. Im Tab Bewertung erneut versuchen.');
    } catch (e) { alert('Marktbericht-PDF fehlgeschlagen: ' + e.message); }
  }

  /* v965-mbtog: klappt den Rest der Marktberichte auf/zu. Nur eine Klasse am
   * Host — kein Fetch, kein Re-Render, der Zustand ueberlebt kein Neuladen der
   * Liste, und genau das ist gewollt: nach dem Tab-Wechsel wieder eingeklappt. */
  function toggleReports(btn) {
    var host = document.getElementById('dab-mb-host');
    if (host) host.classList.toggle('mb-open');
    if (btn) btn.blur();
  }
  window.DealActionBoarding = {
    toggleReports: toggleReports,
    linkOut: linkOut,
    buildTop: buildTop,
    afterRender: afterRender,
    renderReadiness: renderReadiness,
    railScroll: railScroll,
    toggleSmart: toggleSmart,
    exportDoc: exportDoc,
    fillFaYears: fillFaYears,
    gutachtenModal: gutachtenModal,
    leadSheet: leadSheet,
    closeSheet: closeSheet,
    fixReq: fixReq,
    toggleCustomDoc: toggleCustomDoc,
    partnerInterest: partnerInterest,
    downloadReport: downloadReport,
    deleteReport: deleteReport /* v966-delexport */
  };

  /* ────────────────── Styles ────────────────── */
  var DAB_CSS = [
    /* W5-dabgold: die --dab-*-Variablen waren ein eigener Namensraum, der --gold
   ignorierte -> Deal-Aktion blieb gold, waehrend der Rest der App den Reseller-
   Akzent trug. Jetzt erben sie vom globalen Token (Fallback = DealPilot-Gold). */
    '#s8{--dab-ob:#0a0a0a;--dab-m2:#6fd6a0;--dab-glow:rgba(111,214,160,.5);--dab-gold:var(--gold,#C9A84C);--dab-goldhi:var(--gold-hi,#E8CC7A);--dab-gold3:var(--gold-3,#9a7f33);--dab-green:#3FA56C;--dab-red:#B86250;--dab-run:linear-gradient(110deg,var(--gold-hi,#E8CC7A),var(--gold,#C9A84C) 55%,var(--gold-lo,#b8932f));--dab-fd:"Cormorant Garamond",serif;--dab-fs:"Space Grotesk",sans-serif;--dab-fm:"JetBrains Mono",monospace;}',
    '#s8 .dab-cockpit{background:radial-gradient(120% 90% at 50% -10%,#17181a 0%,var(--dab-ob) 55%);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 20%, transparent);border-radius:18px;overflow:hidden;margin:0 0 24px;box-shadow:0 14px 50px rgba(0,0,0,.16);transition:box-shadow .5s}',
    '#s8 .dab-cockpit.ready{box-shadow:0 14px 50px rgba(0,0,0,.16),0 0 40px var(--dab-glow)}',
    '#s8 .dab-strip{position:relative;overflow:hidden;background:var(--dab-run);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}',
    '#s8 .dab-strip::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(125deg,rgba(255,255,255,.12) 0 1px,transparent 1px 11px);pointer-events:none}',
    '#s8 .dab-strip>*{position:relative;z-index:1}', /* v879-banner-struktur */
    '#s8 .dab-strip-l{display:flex;align-items:center;gap:9px;font-family:var(--dab-fs);font-size:11px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;color:#1a1508}',
    '#s8 .dab-strip-l .dot{width:8px;height:8px;border-radius:50%;background:#2e7d4f;box-shadow:0 0 7px #3FA56C}',
    '#s8 .dab-pill{font-family:var(--dab-fm);font-size:11px;font-weight:700;color:#fff;background:#161310;border:1px solid rgba(255,255,255,.14);padding:4px 13px;border-radius:99px;transition:.3s}',
    '#s8 .dab-cockpit.ready .dab-pill{color:var(--dab-m2);border-color:var(--dab-m2);box-shadow:0 0 12px rgba(111,214,160,.3)}',
    '#s8 .dab-body{padding:24px 26px 26px}',
    '#s8 .dab-rc-load{font-family:var(--dab-fm);font-size:12px;color:rgba(255,255,255,.5);padding:6px 0}',
    '#s8 .dab-net-load{font-family:var(--dab-fm);font-size:12px;color:#7A7370;padding:6px 0}',
    '#s8 .dab-kick{font-family:var(--dab-fs);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--dab-gold);font-weight:700}',
    '#s8 .dab-rtitle{font-family:var(--dab-fd);font-size:26px;font-weight:700;color:#f6f2e8;line-height:1.05;margin-top:2px}',
    '#s8 .dab-count{font-family:var(--dab-fm);font-size:11.5px;color:rgba(255,255,255,.55);margin-top:5px}#s8 .dab-count b{color:var(--dab-m2)}',
    '#s8 .dab-rowflex{display:flex;gap:22px;align-items:center;flex-wrap:wrap}#s8 .dab-rmain{flex:1;min-width:240px}',
    /* Doppelring */
    '#s8 .dab-donut{width:96px;height:96px;flex-shrink:0;position:relative}',
    '#s8 .dab-donut svg{transform:rotate(-90deg)}',
    '#s8 .dab-donut .ring{transition:stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)}',
    '#s8 .dab-donut-v{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}',
    '#s8 .dab-donut-v b{font-family:var(--dab-fs);font-size:25px;font-weight:700;color:#fff;text-shadow:0 0 14px rgba(111,214,160,.35)}',
    '#s8 .dab-donut-v span{font-family:var(--dab-fm);font-size:8.5px;color:rgba(255,255,255,.45);margin-top:2px}',
    '#s8 .dab-donut-v small{font-family:var(--dab-fm);font-size:6.5px;letter-spacing:.6px;color:var(--dab-goldhi);margin-top:3px}',
    /* Startbahn */
    '#s8 .dab-runway{position:relative;height:40px;margin-top:15px}',
    '#s8 .dab-track{position:absolute;left:0;right:34px;top:22px;height:10px;display:flex;gap:3px}',
    '#s8 .dab-seg{flex:1;border-radius:2px;background:rgba(255,255,255,.07);transition:background .45s,box-shadow .45s}',
    '#s8 .dab-seg.lit{background:var(--dab-m2);box-shadow:0 0 7px var(--dab-glow)}',
    '#s8 .dab-rgate{position:absolute;right:0;top:11px;color:var(--dab-m2)}',
    '#s8 .dab-plane{position:absolute;top:2px;left:0;transform:translateX(-50%);font-size:22px;color:var(--dab-m2);filter:drop-shadow(0 0 8px var(--dab-glow));transition:left .7s cubic-bezier(.4,0,.2,1)}',
    '#s8 .dab-cap{font-size:11.5px;color:rgba(255,255,255,.45);line-height:1.5;margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.07)}#s8 .dab-cap b{color:rgba(255,255,255,.72)}',
    '#s8 .dab-chips{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:10px}',
    '#s8 .dab-chips-lbl{font-family:var(--dab-fs);font-size:9.5px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.4)}',
    '#s8 .dab-chip{font-family:var(--dab-fs);font-size:11px;font-weight:600;padding:5px 12px;border-radius:99px;cursor:pointer;transition:.16s;display:inline-flex;align-items:center;gap:6px;color:var(--dab-m2);background:rgba(111,214,160,.1);border:1px solid rgba(111,214,160,.4)}',
    '#s8 .dab-chip:hover{background:rgba(111,214,160,.22)}#s8 .dab-chip .x{width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 5px currentColor}',
    '#s8 .dab-allset{font-family:var(--dab-fs);font-size:12.5px;font-weight:600;color:var(--dab-m2);margin-top:10px}',
    '#s8 #dab-uew-slot .da-stage{margin-top:6px}',
    '#s8 #dab-uew-slot .da-stage-head{position:relative;overflow:hidden}', /* v882-uew-struktur */
    '#s8 #dab-uew-slot .da-stage-head::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(125deg,rgba(255,255,255,.12) 0 1px,transparent 1px 11px);pointer-events:none}',
    '#s8 #dab-uew-slot .da-stage-head>*{position:relative;z-index:1}',
    '#s8 .dab-status-grid{display:grid;grid-template-columns:1.15fr 1fr;gap:16px;align-items:stretch}',
    '@media(max-width:900px){#s8 .dab-status-grid{grid-template-columns:1fr}}',
    '#s8 #dab-share-slot{display:block;min-width:0}',
    '#s8 #dab-share-slot > div{margin:0 !important;height:100%;box-sizing:border-box}',
    '#s8 .dab-perf{height:0;border-top:1.5px dashed color-mix(in srgb,var(--gold,#C9A84C) 28%,transparent);margin:24px -26px;position:relative}',
    '#s8 .dab-perf::before,#s8 .dab-perf::after{content:"";position:absolute;top:-9px;width:18px;height:18px;border-radius:50%;background:var(--dab-ob)}',
    '#s8 .dab-perf::before{left:-9px}#s8 .dab-perf::after{right:-9px}',
    '#s8 .dab-sthead{margin-bottom:14px}',
    '#s8 .dab-route{font-family:var(--dab-fm);font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.45)}',
    '#s8 .dab-title{font-family:var(--dab-fd);font-size:26px;font-weight:700;color:#f7f3ea;line-height:1.05;margin-top:3px}',
    /* Departure-Tafel */
    '#s8 .dab-tafel{background:#FDFCFA;border-radius:14px;overflow:hidden;box-shadow:0 5px 22px rgba(0,0,0,.28)}',
    '#s8 .dab-tafel-bar{background:#1b1815;padding:9px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}',
    '#s8 .dab-tafel-bar .l{font-family:var(--dab-fm);font-size:10px;letter-spacing:2.4px;color:var(--dab-goldhi)}',
    '#s8 .dab-tafel-bar .r{font-family:var(--dab-fm);font-size:10px;color:rgba(255,255,255,.5);text-align:right}',
    '#s8 .dab-tafel-rows{padding:6px}',
    '#s8 .dab-row{display:flex;align-items:center;gap:14px;padding:13px 12px;border-radius:10px;cursor:pointer;transition:.16s}',
    '#s8 .dab-row+.dab-row{border-top:1px solid rgba(42,39,39,.1)}#s8 .dab-row:hover{background:#F8F6F1}',
    '#s8 .dab-row-dot{width:11px;height:11px;border-radius:50%;background:rgba(42,39,39,.18);flex-shrink:0}',
    '#s8 .dab-row-x{flex:1;min-width:0}#s8 .dab-row-main{font-family:var(--dab-fs);font-size:15px;font-weight:700;color:#2A2727}#s8 .dab-row-sub{font-size:11.5px;color:#7A7370}',
    '#s8 .dab-row-flip{font-family:var(--dab-fm);font-size:12px;font-weight:700;letter-spacing:2px;background:#1b1815;color:#fff;padding:7px 11px;border-radius:6px;min-width:122px;text-align:center}',
    '#s8 .dab-row.active{background:#F8F6F1}',
    '#s8 .dab-row.active[data-status="open"] .dab-row-dot{background:var(--dab-gold);box-shadow:0 0 8px var(--dab-gold)}#s8 .dab-row.active[data-status="open"] .dab-row-flip{background:var(--dab-gold);color:#1a1508}',
    '#s8 .dab-row.active[data-status="won"] .dab-row-dot{background:var(--dab-green);box-shadow:0 0 8px var(--dab-green)}#s8 .dab-row.active[data-status="won"] .dab-row-flip{background:var(--dab-green);color:#fff}',
    '#s8 .dab-row.active[data-status="lost"] .dab-row-dot{background:var(--dab-red);box-shadow:0 0 8px var(--dab-red)}#s8 .dab-row.active[data-status="lost"] .dab-row-flip{background:var(--dab-red);color:#fff}',
    /* Baender / Panels */
    '#s8 .dab-band{position:relative;overflow:hidden;display:flex;align-items:center;margin:28px 0 0;background:var(--dab-run);border-radius:11px 11px 0 0;padding:12px 16px}',
    '#s8 .dab-band::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(125deg,rgba(255,255,255,.12) 0 1px,transparent 1px 11px);pointer-events:none}',
    '#s8 .dab-band>*{position:relative;z-index:1}',
    '#s8 .dab-band-ic{width:27px;height:27px;border-radius:50%;background:#0d0d0d;display:flex;align-items:center;justify-content:center;color:var(--dab-goldhi);flex-shrink:0;margin-right:11px}',
    '#s8 .dab-band-t{font-family:var(--dab-fs);font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#1a1508}',
    '#s8 .dab-band-s{font-size:11px;color:rgba(26,21,8,.62);margin-left:auto}',
    '#s8 .dab-panel{background:#fff;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 22%, transparent);border-top:none;border-radius:0 0 13px 13px;padding:19px;box-shadow:0 2px 14px rgba(42,39,39,.05);margin-bottom:6px}',
    '#s8 .dab-smart-head{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none}',
    '#s8 .dab-smart-ic{width:40px;height:40px;border-radius:11px;background:var(--dab-run);display:flex;align-items:center;justify-content:center;color:#1a1508;flex-shrink:0;box-shadow:0 3px 10px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent)}',
    '#s8 .dab-smart-t{font-family:var(--dab-fs);font-size:14.5px;font-weight:700}#s8 .dab-smart-s{font-size:11.5px;color:#7A7370;margin-top:1px}',
    '#s8 .dab-smart-chev{margin-left:auto;color:var(--dab-gold3);transition:transform .25s}#s8 .dab-smart.open .dab-smart-chev{transform:rotate(180deg)}',
    '#s8 .dab-smart-body{max-height:0;overflow:hidden;transition:max-height .35s ease}#s8 .dab-smart.open .dab-smart-body{max-height:560px}',
    '#s8 .dab-doc-row{display:flex;align-items:center;gap:14px;padding:14px 4px;border-top:1px solid rgba(42,39,39,.1)}#s8 .dab-doc-row:first-child{margin-top:14px}',
    '#s8 .dab-doc-icb{width:44px;height:44px;border-radius:11px;background:#F8F6F1;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 25%, transparent);display:flex;align-items:center;justify-content:center;color:var(--dab-gold3);flex-shrink:0;transition:.2s}',
    '#s8 .dab-doc-row:hover .dab-doc-icb{border-color:var(--dab-gold);box-shadow:0 0 12px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 18%, transparent)}',
    '#s8 .dab-doc-x{flex:1;min-width:0}#s8 .dab-doc-n{font-family:var(--dab-fs);font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:#2A2727}',
    '#s8 .dab-doc-badge{font-family:var(--dab-fs);font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#1a1508;background:var(--dab-run);padding:2px 8px;border-radius:5px}',
    '#s8 .dab-doc-d{font-size:12px;color:#7A7370;margin-top:3px;line-height:1.45}',
    '#s8 .dab-fa-year{border:1.5px solid rgba(42,39,39,.12);border-radius:9px;padding:8px 9px;font-family:var(--dab-fs);font-size:12.5px;font-weight:600;color:#2A2727;background:#fff;cursor:pointer;min-width:86px}',
    '#s8 .dab-doc-btn{display:inline-flex;align-items:center;gap:7px;background:#fff;color:#2A2727;border:1.5px solid rgba(42,39,39,.1);border-radius:9px;padding:9px 16px;font-family:var(--dab-fs);font-size:12.5px;font-weight:700;cursor:pointer;transition:.15s;flex-shrink:0}',
    '#s8 .dab-doc-btn:hover{border-color:var(--dab-gold);color:var(--dab-gold3);transform:translateY(-1px)}',
    '#s8 .dab-doc-btn.gold{background:var(--dab-run);color:#1a1508;border:none;box-shadow:0 3px 12px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent)}',
    '@media(max-width:560px){#s8 .dab-doc-row{flex-wrap:wrap}}',
    '#s8 .dab-cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}',
    '#s8 .dab-ct{font-family:var(--dab-fs);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--dab-gold3);margin-bottom:9px}',
    '#s8 .dab-list{list-style:none;display:flex;flex-direction:column;gap:7px;margin:0;padding:0}',
    '#s8 .dab-list li{font-size:13px;padding-left:22px;position:relative;color:#2A2727}',
    '#s8 .dab-list li::before{content:"";position:absolute;left:0;top:6px;width:8px;height:8px;border-radius:2px;border:1.5px solid var(--dab-gold);opacity:.6}',
    '#s8 .dab-dr-host{margin-top:16px}',
    '#s8 .dab-dr-link{display:flex;align-items:center;gap:13px;padding:14px 15px;background:#F8F6F1;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 25%, transparent);border-radius:11px}',
    '#s8 .dab-dr-ic{width:38px;height:38px;border-radius:10px;background:#fff;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);display:flex;align-items:center;justify-content:center;color:var(--dab-gold3);flex-shrink:0}',
    '#s8 .dab-dr-x{flex:1;min-width:0}#s8 .dab-dr-t{font-family:var(--dab-fs);font-size:13.5px;font-weight:700;color:#2A2727}#s8 .dab-dr-s{font-size:11.5px;color:#7A7370;margin-top:1px}',
    '#s8 .dab-dr-btn{flex-shrink:0;background:#2A2727;color:#fff;border:none;border-radius:9px;padding:10px 17px;font-family:var(--dab-fs);font-size:12.5px;font-weight:700;cursor:pointer}',
    '@media(max-width:560px){#s8 .dab-dr-link{flex-wrap:wrap}#s8 .dab-dr-btn{width:100%}#s8 .dab-cols{grid-template-columns:1fr}}',
    '#s8 .dab-dr-panel{margin-top:12px}',
    /* Rails */
    '#s8 .dab-rail-head{display:flex;align-items:center;gap:9px;margin:16px 0 10px}',
    '#s8 .dab-rail-head:first-of-type{margin-top:0}',
    '#s8 .dab-rh-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
    '#s8 .dab-rh-n{font-family:var(--dab-fs);font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}',
    '#s8 .dab-rail-arrows{margin-left:auto;display:flex;gap:6px}',
    '#s8 .dab-rail-arr{width:33px;height:33px;border-radius:9px;border:1px solid rgba(42,39,39,.1);background:#fff;color:var(--dab-gold3);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}',
    '#s8 .dab-rail-arr:hover{border-color:var(--dab-gold);background:#F8F6F1}',
    '#s8 .dab-rail-arr.dim{opacity:.35}',
    '#s8 .dab-rail{display:flex;gap:14px;overflow-x:auto;scroll-behavior:smooth;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;padding:4px 2px 8px}',
    '#s8 .dab-rail::-webkit-scrollbar{height:0}',
    /* Boarding-Pass */
    '#s8 .dab-bp{position:relative;flex:0 0 448px;scroll-snap-align:start;display:flex;background:var(--bpbg,#fff);color:#2A2727;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 24%, transparent);border-radius:15px;overflow:hidden;box-shadow:0 4px 16px rgba(42,39,39,.07);transition:border-color .2s,box-shadow .2s,transform .2s}',
    '#s8 .dab-bp:hover{border-color:var(--dab-gold);box-shadow:0 12px 30px rgba(42,39,39,.12),0 0 22px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 12%, transparent);transform:translateY(-3px)}',
    '#s8 .dab-bp-l{flex:1;padding:16px;display:flex;flex-direction:column;min-width:0}',
    '#s8 .dab-bp-top{display:flex;align-items:center;gap:11px;margin-bottom:10px}',
    '#s8 .dab-bp-logo{width:92px;height:92px;border-radius:14px;flex-shrink:0;overflow:hidden;border:1px solid rgba(42,39,39,.1)}',
    '#s8 .dab-bp-mono{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--dab-fs);font-weight:700;font-size:30px}',
    '#s8 .dab-bp-name{font-family:var(--dab-fs);font-size:14px;font-weight:700;line-height:1.15;display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
    '#s8 .dab-bp-ver{display:inline-flex;align-items:center;gap:3px;font-size:8.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--dab-green);background:rgba(63,165,108,.1);border:1px solid rgba(63,165,108,.3);border-radius:99px;padding:2px 7px}',
    '#s8 .dab-bp-role{font-size:10.5px;color:var(--bpmut,#7A7370);margin-top:2px}',
    '#s8 .dab-bp-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:9px}',
    '#s8 .dab-bp-tag{font-family:var(--dab-fm);font-size:9px;padding:2px 7px;border-radius:5px;background:var(--bptag,#F8F6F1);color:var(--bptagfg,#9a7f33);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 22%, transparent);white-space:nowrap}',
    '#s8 .dab-bp-desc{font-size:11.5px;color:var(--bpmut,#7A7370);line-height:1.5;flex:1;margin-bottom:9px}',
    '#s8 .dab-bp-web{display:inline-flex;align-items:center;gap:5px;font-family:var(--dab-fm);font-size:9.5px;color:var(--dab-gold3);text-decoration:none;margin-bottom:8px;align-self:flex-start}',
    '#s8 .dab-bp-web:hover{text-decoration:underline;color:var(--dab-gold)}',
    '#s8 .dab-bp-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:11px;flex-wrap:wrap}',
    '#s8 .dab-bp-usp{font-family:var(--dab-fs);font-size:10px;font-weight:700}',
    '#s8 .dab-bp-resp{display:inline-flex;align-items:center;gap:4px;font-family:var(--dab-fm);font-size:9.5px;color:var(--dab-green);background:rgba(63,165,108,.09);border-radius:5px;padding:2px 7px}',
    '#s8 .dab-bp-cta{border:none;border-radius:9px;padding:9px 10px;font-family:var(--dab-fs);cursor:pointer;transition:.18s;background:linear-gradient(110deg,var(--acc),color-mix(in srgb,var(--acc) 70%,#000));color:#fff;display:flex;flex-direction:column;align-items:center;gap:1px;width:100%;box-shadow:0 3px 10px color-mix(in srgb,var(--acc) 35%,transparent)}',
    '#s8 .dab-bp-cta:hover{transform:translateY(-1px)}',
    '#s8 .dab-bp-cta.sent{background:var(--dab-green);cursor:default}#s8 .dab-bp-cta.sent:hover{transform:none}',
    '#s8 .dab-bp-cta.locked{background:#e7e2d8;color:#9a948a;box-shadow:none;cursor:not-allowed}#s8 .dab-bp-cta.locked:hover{transform:none}',
    '#s8 .dab-bp-cta-t{font-size:12.5px;font-weight:700;display:inline-flex;align-items:center;gap:6px}',
    '#s8 .dab-bp-cta-s{font-size:9px;font-weight:500;opacity:.85}',
    /* Anforderungs-Box */
    '#s8 .dab-req{background:var(--bpreq,#F8F6F1);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 22%, transparent);border-radius:9px;padding:9px 11px;margin-bottom:11px}',
    '#s8 .dab-req-t{font-family:var(--dab-fs);font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--dab-gold3);margin-bottom:6px;display:flex;align-items:center;gap:6px}',
    '#s8 .dab-req ul{list-style:none;display:flex;flex-direction:column;gap:4px;margin:0;padding:0}',
    '#s8 .dab-req li{font-size:10.5px;display:flex;align-items:center;gap:7px;color:var(--bpmut,#7A7370)}',
    '#s8 .dab-req li .ic{width:14px;height:14px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;font-weight:700}',
    '#s8 .dab-req li.ok .ic{background:rgba(63,165,108,.12);color:var(--dab-green)}',
    '#s8 .dab-req li.no .ic{background:rgba(184,98,80,.12);color:var(--dab-red)}',
    '#s8 .dab-req li.ok{color:#2A2727}',
    '#s8 .dab-req-fix{margin-left:auto;font-family:var(--dab-fs);font-size:9px;font-weight:700;color:var(--dab-gold3);background:#fff;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);border-radius:6px;padding:2px 8px;cursor:pointer}',
    /* v890: eigene Pflichtdokumente + weiche Rotation */
    '#s8 .dab-req li .dab-cdoc{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-family:var(--dab-fs);font-size:9px;font-weight:700;color:var(--dab-gold3);cursor:pointer;white-space:nowrap}',
    '#s8 .dab-req li .dab-cdoc input{width:13px;height:13px;accent-color:var(--dab-green,#3FA56C);cursor:pointer}',
    '#s8 .dab-rail{will-change:transform}',
    /* Abrisskanten */
    '#s8 .dab-edge{position:relative;width:0;flex-shrink:0}',
    '#s8 .dab-edge-k1{border-left:2px dashed var(--kante,rgba(42,39,39,.16))}',
    '#s8 .dab-edge-k1::before,#s8 .dab-edge-k1::after{content:"";position:absolute;left:-8px;width:14px;height:14px;border-radius:50%;background:#FDFCFA;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 15%, transparent)}',
    '#s8 .dab-edge-k1::before{top:-7px}#s8 .dab-edge-k1::after{bottom:-7px}',
    '#s8 .dab-edge-k2{width:9px;background:var(--kante,var(--acc));-webkit-mask:conic-gradient(from 120deg at 100% 50%,#000 0 120deg,transparent 0) 0 0/100% 9px repeat-y;mask:conic-gradient(from 120deg at 100% 50%,#000 0 120deg,transparent 0) 0 0/100% 9px repeat-y;opacity:.9}',
    '#s8 .dab-edge-k3{width:10px;background-image:radial-gradient(circle at 50% 50%,#FDFCFA 2.6px,transparent 2.7px),linear-gradient(var(--kante,rgba(42,39,39,.10)),var(--kante,rgba(42,39,39,.10)));background-size:10px 12px,1.5px 100%;background-position:0 0,center;background-repeat:repeat-y,no-repeat}',
    '#s8 .dab-edge-k4{width:9px;background:var(--kante,var(--acc));-webkit-mask:radial-gradient(circle at 0 50%,transparent 4.5px,#000 5px) 0 0/9px 13px repeat-y;mask:radial-gradient(circle at 0 50%,transparent 4.5px,#000 5px) 0 0/9px 13px repeat-y;opacity:.85}',
    /* Hintergruende */
    '#s8 .dab-bg-creme{--bpbg:#FDFCFA;--bptag:#fff}',
    '#s8 .dab-bg-obsidian{--bpbg:linear-gradient(150deg,#141416,#0a0a0a);color:#f6f2e8;--bpmut:rgba(255,255,255,.55);--bptag:rgba(255,255,255,.06);--bptagfg:var(--wl-e8cc7a, #E8CC7A);--bpreq:rgba(255,255,255,.05);border-color:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent)}',
    '#s8 .dab-bg-obsidian .dab-bp-name,#s8 .dab-bg-obsidian .dab-bp-usp,#s8 .dab-bg-obsidian .dab-req li.ok{color:#f6f2e8}',
    '#s8 .dab-bg-obsidian .dab-bp-stub{background:rgba(255,255,255,.05)}#s8 .dab-bg-obsidian .dab-bp-barcode{--bar:var(--wl-e8cc7a, #E8CC7A)}',
    '#s8 .dab-bg-goldtint{--bpbg:linear-gradient(160deg,#fffdf6,#f6eed6);--bptag:#fff}',
    '#s8 .dab-bg-accgrad{--bpbg:linear-gradient(155deg,color-mix(in srgb,var(--acc) 10%,#fff),#fff 55%);--bptag:#fff}',
    '#s8 .dab-bg-muster{--bpbg:#fff;background-image:repeating-linear-gradient(125deg,color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 5%, transparent) 0 1px,transparent 1px 11px)}',
    /* Stub */
    '#s8 .dab-bp-stub{width:58px;flex-shrink:0;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;background:var(--stubbg,#F8F6F1);color:var(--acc)}',
    '#s8 .dab-bp-code{writing-mode:vertical-rl;font-family:var(--dab-fm);font-size:10px;font-weight:700;letter-spacing:2.5px;color:var(--acc)}',
    '#s8 .dab-bp-barcode{width:26px;height:44px;background:repeating-linear-gradient(0deg,var(--bar,#2A2727) 0 1.5px,transparent 1.5px 3px,var(--bar,#2A2727) 3px 5.5px,transparent 5.5px 7px);opacity:.55;border-radius:2px}',
    '#s8 .dab-bp-lbl{writing-mode:vertical-rl;font-family:var(--dab-fs);font-size:7.5px;letter-spacing:1.6px;color:var(--bpmut,#7A7370);text-transform:uppercase}',
    /* Werbe-Karte */
    '#s8 .dab-bp-ad{border-style:dashed;background:linear-gradient(160deg,#fffdf6,#f6eed6)}',
    '#s8 .dab-bp-adbadge{font-family:var(--dab-fs);font-size:8.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--dab-gold3);background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 14%, transparent);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);padding:3px 9px;border-radius:99px;align-self:flex-start;margin-bottom:9px}',
    '#s8 .dab-bp-adic{width:44px;height:44px;border-radius:12px;background:#fff;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);display:flex;align-items:center;justify-content:center;color:var(--dab-gold);margin-bottom:8px}',
    '#s8 .dab-bp-adt{font-family:var(--dab-fs);font-size:13.5px;font-weight:700;color:#2A2727;line-height:1.2;margin-bottom:5px}',
    '#s8 .dab-bp-ads{font-size:10.5px;color:#7A7370;line-height:1.5;flex:1;margin-bottom:11px}',
    '#s8 .dab-bp-ad .dab-bp-cta{background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));color:#1a1508}',
    '#s8 .dab-bp-stub-ad{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 6%, transparent)}',
    '#s8 .dab-bp-plus{color:var(--acc);font-size:20px;font-family:var(--dab-fs);font-weight:700}',
    '@media(max-width:600px){#s8 .dab-bp{flex-basis:352px}#s8 .dab-row-flip{min-width:92px}}',
    /* Lead-Sheet (an body) */
    '.dabm-mask{position:fixed;inset:0;background:rgba(10,10,10,.55);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:9990;padding:16px}',
    '.dabm-mask.show{display:flex}',
    '.dabm-card{width:100%;max-width:430px;background:#FDFCFA;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.4);font-family:Inter,sans-serif;color:#2A2727}',
    '.dabm-head{background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));padding:13px 18px}',
    '.dabm-head .t{font-family:"Space Grotesk",sans-serif;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#1a1508}',
    '.dabm-body{padding:18px}',
    '.dabm-p{font-family:"Cormorant Garamond",serif;font-size:21px;font-weight:700;line-height:1.15;margin-bottom:4px}',
    '.dabm-sub{font-size:12px;color:#7A7370;margin-bottom:14px}',
    '.dabm-inc{background:#fff;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 25%, transparent);border-radius:11px;padding:12px 14px;margin-bottom:14px}',
    '.dabm-inc .ct{font-family:"Space Grotesk",sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33);margin-bottom:7px}',
    '.dabm-inc ul{list-style:none;display:flex;flex-direction:column;gap:6px;margin:0;padding:0}',
    '.dabm-inc li{font-size:12.5px;display:flex;align-items:center;gap:8px}',
    '.dabm-inc li .ic{color:#3FA56C;flex-shrink:0;display:inline-flex}',
    '.dabm-note{font-size:10.5px;color:#7A7370;margin-bottom:14px;line-height:1.5}',
    '.dabm-actions{display:flex;gap:9px}',
    '.dabm-go{flex:1;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));color:#1a1508;border:none;border-radius:10px;padding:12px;font-family:"Space Grotesk",sans-serif;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent)}',
    '.dabm-x{background:#fff;color:#7A7370;border:1.5px solid rgba(42,39,39,.1);border-radius:10px;padding:12px 16px;font-family:"Space Grotesk",sans-serif;font-size:13px;font-weight:600;cursor:pointer}'
  ].join('\n');
})();
