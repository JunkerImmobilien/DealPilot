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
    try { var o = window._currentObjData; return o ? (o.id || o._id || '') : ''; } catch (e) { return ''; }
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
      docRow('bmf', 'Finanzamt-PDF (Steuer)', 'AfA, Sonder-AfA \u00a7 7b und Steuerlast \u2014 f\u00fcr das aktuell gew\u00e4hlte Steuerjahr, direkt f\u00fcrs Finanzamt.', false) +
      docRow('track', 'Track Record', 'Kennzahlen &amp; Historie f\u00fcr dieses Objekt \u2014 als Referenz f\u00fcrs Bankgespr\u00e4ch.', false);

    return '' +
      '<div class="dab-cockpit" id="dab-cockpit">' +
        '<div class="dab-strip"><div class="dab-strip-l"><span class="dot"></span>Bereit f\u00fcr die Bank</div><div class="dab-pill" id="dab-ready-pill">\u2013</div></div>' +
        '<div class="dab-body">' +
          '<div id="dab-readiness-host"><div class="dab-rc-load">Vorflug-Check l\u00e4dt \u2026</div></div>' +
          '<div class="dab-perf"></div>' +
          '<div class="dab-sthead"><div class="dab-route">Objekt \u2192 Abschluss</div><div class="dab-title" id="dab-abtitle">Bereit zum Abflug</div></div>' +
          statusTafel() +
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

      band('doc2', 'Bordkarte &amp; Unterlagen', 'Bankgespr\u00e4ch vorbereiten') +
      '<div class="dab-panel">' +
        '<div class="dab-cols">' +
          '<div><div class="dab-ct">Pers\u00f6nliche Unterlagen</div><ul class="dab-list"><li>Personalausweis (Kopie)</li><li>Letzte 3 Gehaltsabrechnungen</li><li>Steuerbescheide 2 Jahre</li><li>SCHUFA-Selbstauskunft</li><li>Verm\u00f6gen &amp; Verbindlichkeiten</li></ul></div>' +
          '<div><div class="dab-ct">Objekt-Unterlagen</div><ul class="dab-list"><li>Expos\u00e9 / Verkaufsanzeige</li><li>Aktueller Grundbuchauszug</li><li>Wohnfl\u00e4chenberechnung</li><li>Nebenkostenabrechnungen</li><li>Bei WEG: Teilungserkl\u00e4rung</li></ul></div>' +
        '</div>' +
        '<div id="dab-dr-host" class="dab-dr-host"></div>' +
      '</div>' +

      band('net', 'Dein Netzwerk', 'Gepr\u00fcfte Partner \u2014 Objektdaten gehen mit') +
      '<div class="dab-panel">' +
        railHead('fin', '#5a9bc4', '#3f7699', 'Finanzierung &amp; Banken') +
        '<div class="dab-rail" id="dab-rail-fin"><div class="dab-net-load">L\u00e4dt Partner \u2026</div></div>' +
        railHead('gut', '#C9A84C', '#9a7f33', 'Gutachter &amp; Sachverst\u00e4ndige') +
        '<div class="dab-rail" id="dab-rail-gut"></div>' +
      '</div>';
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

  function railHead(key, dot, txt, label) {
    return '<div class="dab-rail-head"><span class="dab-rh-dot" style="background:' + dot + '"></span><span class="dab-rh-n" style="color:' + txt + '">' + label + '</span>' +
      '<div class="dab-rail-arrows"><button class="dab-rail-arr" onclick="DealActionBoarding.railScroll(\'dab-rail-' + key + '\',-1)" aria-label="zur\u00fcck">' + ICO.chL + '</button>' +
      '<button class="dab-rail-arr" onclick="DealActionBoarding.railScroll(\'dab-rail-' + key + '\',1)" aria-label="weiter">' + ICO.chR + '</button></div></div>';
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
      chips = '<div class="dab-chips"><span class="dab-chips-lbl">Fehlt (Grundfeld):</span>' +
        d.missing.map(function (m) {
          return '<button type="button" class="dab-chip" onclick="DealPilotReadyCheck.jump(\'' + esc(m.key) + '\')"><span class="x"></span>' + esc(m.name) + '</button>';
        }).join('') + '</div>';
    } else {
      chips = '<div class="dab-allset">\u2713 Alle Grundfelder vollst\u00e4ndig \u2014 startklar f\u00fcr die Bank</div>';
    }
    host.innerHTML =
      '<div class="dab-rowflex"><div class="dab-donut"><svg width="96" height="96" viewBox="0 0 96 96">' +
        '<circle cx="48" cy="48" r="40" fill="none" stroke="rgba(111,214,160,.15)" stroke-width="7"/>' +
        '<circle class="ring" cx="48" cy="48" r="40" fill="none" stroke="var(--dab-m2)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + c1.toFixed(1) + '" stroke-dashoffset="' + o1 + '"/>' +
        '<circle cx="48" cy="48" r="31" fill="none" stroke="rgba(201,168,76,.2)" stroke-width="5"/>' +
        '<circle cx="48" cy="48" r="31" fill="none" stroke="var(--dab-gold)" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + c2.toFixed(1) + '" stroke-dashoffset="0"/>' +
      '</svg><div class="dab-donut-v"><b>' + pct + '</b><span>/ 100</span><small>FELDER ' + filled + ' / ' + total + '</small></div></div>' +
      '<div class="dab-rmain"><div class="dab-kick">Vorflug-Check</div><div class="dab-rtitle">Bereit f\u00fcr die Bank?</div><div class="dab-count"><b>' + filled + '</b> / ' + total + ' Grundfelder bef\u00fcllt</div>' +
        '<div class="dab-runway"><div class="dab-track">' + segs + '</div><div class="dab-plane" style="left:' + pct + '%">' + ICO.plane + '</div><div class="dab-rgate">' + ICO.gate + '</div></div>' +
      '</div></div>' +
      '<div class="dab-cap"><b>Grundfelder f\u00fcr die Bank-Bewertung</b> \u2014 nur diese Felder z\u00e4hlen in die Readiness. Weitere Angaben (Ausstattung, Historie, Fotos) sind hilfreich, flie\u00dfen aber <b>nicht</b> in diese Bewertung ein.</div>' +
      chips;
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
  function reqList(card) {
    var anf = anfOf(card), st = checkStates(), out = [];
    Object.keys(REQ_DEFS).forEach(function (k) {
      if (anf[k] === true) out.push({ key: k, label: REQ_DEFS[k], ok: !!st[k] });
    });
    return out;
  }
  function gateHtml(card) {
    var reqs = reqList(card);
    var locked = reqs.some(function (r) { return !r.ok; });
    var reqBox = '';
    if (reqs.length) {
      reqBox = '<div class="dab-req"><div class="dab-req-t">' + ICO.lock + ' Voraussetzungen f\u00fcr die Anfrage</div><ul>' +
        reqs.map(function (r) {
          var fix = r.ok ? '' :
            '<span class="dab-req-fix" onclick="DealActionBoarding.fixReq(\'' + r.key + '\')">Beheben</span>';
          return '<li class="' + (r.ok ? 'ok' : 'no') + '"><span class="ic">' + (r.ok ? '\u2713' : '\u2715') + '</span>' + r.label + fix + '</li>';
        }).join('') + '</ul></div>';
    }
    var cta = locked
      ? '<button class="dab-bp-cta locked" type="button"><span class="dab-bp-cta-t">' + ICO.lock + ' Anfrage gesperrt</span><span class="dab-bp-cta-s">erst Voraussetzungen erf\u00fcllen</span></button>'
      : '<button class="dab-bp-cta" type="button" style="--acc:' + esc(card.akzent || '#C9A84C') + '" onclick="DealActionBoarding.leadSheet(' + (card.id | 0) + ',this)"><span class="dab-bp-cta-t">' + esc(card.cta_label || 'Anfrage senden') + '</span><span class="dab-bp-cta-s">kostenlos &amp; unverbindlich</span></button>';
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
  function loadNetwork() {
    var headers = {};
    var t = token(); if (t) headers['Authorization'] = 'Bearer ' + t;
    fetch('/api/v1/network-cards', { headers: headers })
      .then(function (r) { return r.ok ? r.json() : { cards: [] }; })
      .then(function (data) {
        _cards = (data && data.cards) || [];
        fillRail('dab-rail-fin', _cards.filter(function (c) { return c.kategorie === 'finanzierung'; }), '#5a9bc4');
        fillRail('dab-rail-gut', _cards.filter(function (c) { return c.kategorie === 'gutachter'; }), '#C9A84C');
      })
      .catch(function () {
        var f = document.getElementById('dab-rail-fin'); if (f) f.innerHTML = '<div class="dab-net-load">Netzwerk aktuell nicht erreichbar.</div>';
      });
  }
  function fillRail(id, cards, defAcc) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!cards.length) { el.innerHTML = '<div class="dab-net-load">Noch keine Partner hinterlegt.</div>'; return; }
    el.innerHTML = cards.map(function (c) { return cardHtml(c, defAcc); }).join('') + adCard(defAcc);
    updArrows(id);
  }
  function bgAttrs(card) {
    var bg = card.hintergrund || 'weiss';
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
    var logo = c.logo_url
      ? '<img src="' + esc(c.logo_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;background:#fff">'
      : '<div class="dab-bp-mono" style="background:' + esc(acc) + '">' + esc((c.kuerzel || (c.name || '?').slice(0, 2)).toUpperCase()) + '</div>';
    var ver = c.verified
      ? '<span class="dab-bp-ver">' + ICO.check + ' Gepr\u00fcft</span>' : '';
    var meta = '';
    if (c.usp || c.antwortzeit) {
      meta = '<div class="dab-bp-meta">' +
        (c.usp ? '<span class="dab-bp-usp">' + esc(c.usp) + '</span>' : '<span></span>') +
        (c.antwortzeit ? '<span class="dab-bp-resp">' + ICO.clock + ' ' + esc(c.antwortzeit) + '</span>' : '') +
        '</div>';
    }
    var bg = bgAttrs(c);
    return '<article class="dab-bp' + bg.cls + '" style="--acc:' + esc(acc) + ';' + bg.style + '">' +
      '<div class="dab-bp-l"><div class="dab-bp-top"><div class="dab-bp-logo">' + logo + '</div>' +
        '<div><div class="dab-bp-name">' + esc(c.name || '') + ver + '</div><div class="dab-bp-role">' + esc(c.rolle || '') + '</div></div></div>' +
        '<div class="dab-bp-tags">' + tagH + '</div>' +
        '<div class="dab-bp-desc">' + esc(c.beschreibung || '') + '</div>' +
        meta +
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
  function partnerInterest() { toast('Danke f\u00fcr das Interesse \u2014 Marcel wird informiert.'); }

  /* ────────────────── Exporte ────────────────── */
  function exportDoc(which) {
    try {
      if (which === 'invest' && typeof window.exportPDF === 'function') return window.exportPDF();
      if (which === 'bmf' && typeof window.exportBmfPdf === 'function') return window.exportBmfPdf();
      if (which === 'track' && typeof window.exportTrackRecordPDF === 'function') {
        var o = window._currentObjData;
        return window.exportTrackRecordPDF(o ? [o] : []);
      }
      toast('Export nicht verf\u00fcgbar.');
    } catch (e) { toast('Export fehlgeschlagen.'); }
  }

  /* ────────────────── Rails / Smartklappe / Datenraum ────────────────── */
  function railScroll(id, dir) {
    var el = document.getElementById(id); if (!el) return;
    el.scrollBy({ left: dir * 398, behavior: 'smooth' });
    setTimeout(function () { updArrows(id); }, 350);
  }
  function updArrows(id) {
    var el = document.getElementById(id); if (!el) return;
    var head = el.previousElementSibling; if (!head) return;
    var b = head.querySelectorAll('.dab-rail-arr'); if (b.length < 2) return;
    b[0].disabled = el.scrollLeft <= 2;
    b[1].disabled = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
  }
  function toggleSmart() { var s = document.getElementById('dab-smart'); if (s) s.classList.toggle('open'); }
  function mountDatenraum() {
    var host = document.getElementById('dab-dr-host');
    if (!host) return;
    var oid = currentObjId();
    var inner = '';
    try {
      if (window.DealPilotDatenraum && typeof window.DealPilotDatenraum.renderDealActionPanel === 'function') {
        inner = window.DealPilotDatenraum.renderDealActionPanel(oid, 'bank') || '';
      }
    } catch (e) { inner = ''; }
    host.innerHTML =
      '<div class="dab-dr-link"><div class="dab-dr-ic"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a8 3 0 0 0 16 0 8 3 0 0 0-16 0z"/><path d="M4 7v10a8 3 0 0 0 16 0V7"/><path d="M4 12a8 3 0 0 0 16 0"/></svg></div>' +
        '<div class="dab-dr-x"><div class="dab-dr-t">Datenraum verkn\u00fcpfen</div><div class="dab-dr-s">Pers\u00f6nlicher + Objekt-Datenraum \u2014 werden Bank-Anfragen automatisch beigef\u00fcgt und schalten Partner-Anfragen frei.</div></div>' +
        '<button class="dab-dr-btn" type="button" onclick="DealPilotDealAction.openDatenraumSettings()">Einrichten</button></div>' +
      (inner ? '<div class="dab-dr-panel">' + inner + '</div>' : '');
  }

  /* ────────────────── afterRender ────────────────── */
  function afterRender() {
    injectCss();
    try { if (window.DealPilotDealAction && window.DealPilotDealAction.initStatusSync) window.DealPilotDealAction.initStatusSync(); } catch (e) {}
    try { if (window.DealPilotReadyCheck && window.DealPilotReadyCheck.getData) renderReadiness(window.DealPilotReadyCheck.getData()); } catch (e) {}
    try { if (window.DealPilotReadyCheck && window.DealPilotReadyCheck.refresh) window.DealPilotReadyCheck.refresh(); } catch (e) {}
    try { mountDatenraum(); } catch (e) {}
    try { loadNetwork(); } catch (e) {}
  }

  function injectCss() {
    if (document.getElementById('dab-styles')) return;
    var st = document.createElement('style');
    st.id = 'dab-styles';
    st.textContent = DAB_CSS;
    document.head.appendChild(st);
  }

  window.DealActionBoarding = {
    buildTop: buildTop,
    afterRender: afterRender,
    renderReadiness: renderReadiness,
    railScroll: railScroll,
    toggleSmart: toggleSmart,
    exportDoc: exportDoc,
    leadSheet: leadSheet,
    closeSheet: closeSheet,
    fixReq: fixReq,
    partnerInterest: partnerInterest
  };

  /* ────────────────── Styles ────────────────── */
  var DAB_CSS = [
    '#s8{--dab-ob:#0a0a0a;--dab-m2:#6fd6a0;--dab-glow:rgba(111,214,160,.5);--dab-gold:#C9A84C;--dab-goldhi:#E8CC7A;--dab-gold3:#9a7f33;--dab-green:#3FA56C;--dab-red:#B86250;--dab-run:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);--dab-fd:"Cormorant Garamond",serif;--dab-fs:"Space Grotesk",sans-serif;--dab-fm:"JetBrains Mono",monospace;}',
    '#s8 .dab-cockpit{background:radial-gradient(120% 90% at 50% -10%,#17181a 0%,var(--dab-ob) 55%);border:1px solid rgba(201,168,76,.2);border-radius:18px;overflow:hidden;margin:0 0 24px;box-shadow:0 14px 50px rgba(0,0,0,.16);transition:box-shadow .5s}',
    '#s8 .dab-cockpit.ready{box-shadow:0 14px 50px rgba(0,0,0,.16),0 0 40px var(--dab-glow)}',
    '#s8 .dab-strip{background:var(--dab-run);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}',
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
    '#s8 .dab-perf{height:0;border-top:1.5px dashed rgba(201,168,76,.28);margin:24px -26px;position:relative}',
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
    '#s8 .dab-band{display:flex;align-items:center;margin:28px 0 0;background:var(--dab-run);border-radius:11px 11px 0 0;padding:12px 16px}',
    '#s8 .dab-band-ic{width:27px;height:27px;border-radius:50%;background:#0d0d0d;display:flex;align-items:center;justify-content:center;color:var(--dab-goldhi);flex-shrink:0;margin-right:11px}',
    '#s8 .dab-band-t{font-family:var(--dab-fs);font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#1a1508}',
    '#s8 .dab-band-s{font-size:11px;color:rgba(26,21,8,.62);margin-left:auto}',
    '#s8 .dab-panel{background:#fff;border:1px solid rgba(201,168,76,.22);border-top:none;border-radius:0 0 13px 13px;padding:19px;box-shadow:0 2px 14px rgba(42,39,39,.05);margin-bottom:6px}',
    '#s8 .dab-smart-head{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none}',
    '#s8 .dab-smart-ic{width:40px;height:40px;border-radius:11px;background:var(--dab-run);display:flex;align-items:center;justify-content:center;color:#1a1508;flex-shrink:0;box-shadow:0 3px 10px rgba(201,168,76,.3)}',
    '#s8 .dab-smart-t{font-family:var(--dab-fs);font-size:14.5px;font-weight:700}#s8 .dab-smart-s{font-size:11.5px;color:#7A7370;margin-top:1px}',
    '#s8 .dab-smart-chev{margin-left:auto;color:var(--dab-gold3);transition:transform .25s}#s8 .dab-smart.open .dab-smart-chev{transform:rotate(180deg)}',
    '#s8 .dab-smart-body{max-height:0;overflow:hidden;transition:max-height .35s ease}#s8 .dab-smart.open .dab-smart-body{max-height:560px}',
    '#s8 .dab-doc-row{display:flex;align-items:center;gap:14px;padding:14px 4px;border-top:1px solid rgba(42,39,39,.1)}#s8 .dab-doc-row:first-child{margin-top:14px}',
    '#s8 .dab-doc-icb{width:44px;height:44px;border-radius:11px;background:#F8F6F1;border:1px solid rgba(201,168,76,.25);display:flex;align-items:center;justify-content:center;color:var(--dab-gold3);flex-shrink:0;transition:.2s}',
    '#s8 .dab-doc-row:hover .dab-doc-icb{border-color:var(--dab-gold);box-shadow:0 0 12px rgba(201,168,76,.18)}',
    '#s8 .dab-doc-x{flex:1;min-width:0}#s8 .dab-doc-n{font-family:var(--dab-fs);font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:#2A2727}',
    '#s8 .dab-doc-badge{font-family:var(--dab-fs);font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#1a1508;background:var(--dab-run);padding:2px 8px;border-radius:5px}',
    '#s8 .dab-doc-d{font-size:12px;color:#7A7370;margin-top:3px;line-height:1.45}',
    '#s8 .dab-doc-btn{display:inline-flex;align-items:center;gap:7px;background:#fff;color:#2A2727;border:1.5px solid rgba(42,39,39,.1);border-radius:9px;padding:9px 16px;font-family:var(--dab-fs);font-size:12.5px;font-weight:700;cursor:pointer;transition:.15s;flex-shrink:0}',
    '#s8 .dab-doc-btn:hover{border-color:var(--dab-gold);color:var(--dab-gold3);transform:translateY(-1px)}',
    '#s8 .dab-doc-btn.gold{background:var(--dab-run);color:#1a1508;border:none;box-shadow:0 3px 12px rgba(201,168,76,.3)}',
    '@media(max-width:560px){#s8 .dab-doc-row{flex-wrap:wrap}}',
    '#s8 .dab-cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}',
    '#s8 .dab-ct{font-family:var(--dab-fs);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--dab-gold3);margin-bottom:9px}',
    '#s8 .dab-list{list-style:none;display:flex;flex-direction:column;gap:7px;margin:0;padding:0}',
    '#s8 .dab-list li{font-size:13px;padding-left:22px;position:relative;color:#2A2727}',
    '#s8 .dab-list li::before{content:"";position:absolute;left:0;top:6px;width:8px;height:8px;border-radius:2px;border:1.5px solid var(--dab-gold);opacity:.6}',
    '#s8 .dab-dr-host{margin-top:16px}',
    '#s8 .dab-dr-link{display:flex;align-items:center;gap:13px;padding:14px 15px;background:#F8F6F1;border:1px solid rgba(201,168,76,.25);border-radius:11px}',
    '#s8 .dab-dr-ic{width:38px;height:38px;border-radius:10px;background:#fff;border:1px solid rgba(201,168,76,.3);display:flex;align-items:center;justify-content:center;color:var(--dab-gold3);flex-shrink:0}',
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
    '#s8 .dab-rail-arr:disabled{opacity:.3;cursor:default;background:#fff;color:#7A7370}',
    '#s8 .dab-rail{display:flex;gap:14px;overflow-x:auto;scroll-behavior:smooth;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:4px 2px 8px}',
    '#s8 .dab-rail::-webkit-scrollbar{height:0}',
    /* Boarding-Pass */
    '#s8 .dab-bp{position:relative;flex:0 0 384px;scroll-snap-align:start;display:flex;background:var(--bpbg,#fff);color:#2A2727;border:1px solid rgba(201,168,76,.24);border-radius:15px;overflow:hidden;box-shadow:0 4px 16px rgba(42,39,39,.07);transition:border-color .2s,box-shadow .2s,transform .2s}',
    '#s8 .dab-bp:hover{border-color:var(--dab-gold);box-shadow:0 12px 30px rgba(42,39,39,.12),0 0 22px rgba(201,168,76,.12);transform:translateY(-3px)}',
    '#s8 .dab-bp-l{flex:1;padding:16px;display:flex;flex-direction:column;min-width:0}',
    '#s8 .dab-bp-top{display:flex;align-items:center;gap:11px;margin-bottom:10px}',
    '#s8 .dab-bp-logo{width:46px;height:46px;border-radius:11px;flex-shrink:0;overflow:hidden;border:1px solid rgba(42,39,39,.1)}',
    '#s8 .dab-bp-mono{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--dab-fs);font-weight:700;font-size:16px}',
    '#s8 .dab-bp-name{font-family:var(--dab-fs);font-size:14px;font-weight:700;line-height:1.15;display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
    '#s8 .dab-bp-ver{display:inline-flex;align-items:center;gap:3px;font-size:8.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--dab-green);background:rgba(63,165,108,.1);border:1px solid rgba(63,165,108,.3);border-radius:99px;padding:2px 7px}',
    '#s8 .dab-bp-role{font-size:10.5px;color:var(--bpmut,#7A7370);margin-top:2px}',
    '#s8 .dab-bp-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:9px}',
    '#s8 .dab-bp-tag{font-family:var(--dab-fm);font-size:9px;padding:2px 7px;border-radius:5px;background:var(--bptag,#F8F6F1);color:var(--bptagfg,#9a7f33);border:1px solid rgba(201,168,76,.22);white-space:nowrap}',
    '#s8 .dab-bp-desc{font-size:11.5px;color:var(--bpmut,#7A7370);line-height:1.5;flex:1;margin-bottom:9px}',
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
    '#s8 .dab-req{background:var(--bpreq,#F8F6F1);border:1px solid rgba(201,168,76,.22);border-radius:9px;padding:9px 11px;margin-bottom:11px}',
    '#s8 .dab-req-t{font-family:var(--dab-fs);font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--dab-gold3);margin-bottom:6px;display:flex;align-items:center;gap:6px}',
    '#s8 .dab-req ul{list-style:none;display:flex;flex-direction:column;gap:4px;margin:0;padding:0}',
    '#s8 .dab-req li{font-size:10.5px;display:flex;align-items:center;gap:7px;color:var(--bpmut,#7A7370)}',
    '#s8 .dab-req li .ic{width:14px;height:14px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;font-weight:700}',
    '#s8 .dab-req li.ok .ic{background:rgba(63,165,108,.12);color:var(--dab-green)}',
    '#s8 .dab-req li.no .ic{background:rgba(184,98,80,.12);color:var(--dab-red)}',
    '#s8 .dab-req li.ok{color:#2A2727}',
    '#s8 .dab-req-fix{margin-left:auto;font-family:var(--dab-fs);font-size:9px;font-weight:700;color:var(--dab-gold3);background:#fff;border:1px solid rgba(201,168,76,.35);border-radius:6px;padding:2px 8px;cursor:pointer}',
    /* Abrisskanten */
    '#s8 .dab-edge{position:relative;width:0;flex-shrink:0}',
    '#s8 .dab-edge-k1{border-left:2px dashed var(--kante,rgba(42,39,39,.16))}',
    '#s8 .dab-edge-k1::before,#s8 .dab-edge-k1::after{content:"";position:absolute;left:-8px;width:14px;height:14px;border-radius:50%;background:#FDFCFA;border:1px solid rgba(201,168,76,.15)}',
    '#s8 .dab-edge-k1::before{top:-7px}#s8 .dab-edge-k1::after{bottom:-7px}',
    '#s8 .dab-edge-k2{width:9px;background:var(--kante,var(--acc));-webkit-mask:conic-gradient(from 120deg at 100% 50%,#000 0 120deg,transparent 0) 0 0/100% 9px repeat-y;mask:conic-gradient(from 120deg at 100% 50%,#000 0 120deg,transparent 0) 0 0/100% 9px repeat-y;opacity:.9}',
    '#s8 .dab-edge-k3{width:10px;background-image:radial-gradient(circle at 50% 50%,#FDFCFA 2.6px,transparent 2.7px),linear-gradient(var(--kante,rgba(42,39,39,.10)),var(--kante,rgba(42,39,39,.10)));background-size:10px 12px,1.5px 100%;background-position:0 0,center;background-repeat:repeat-y,no-repeat}',
    '#s8 .dab-edge-k4{width:9px;background:var(--kante,var(--acc));-webkit-mask:radial-gradient(circle at 0 50%,transparent 4.5px,#000 5px) 0 0/9px 13px repeat-y;mask:radial-gradient(circle at 0 50%,transparent 4.5px,#000 5px) 0 0/9px 13px repeat-y;opacity:.85}',
    /* Hintergruende */
    '#s8 .dab-bg-creme{--bpbg:#FDFCFA;--bptag:#fff}',
    '#s8 .dab-bg-obsidian{--bpbg:linear-gradient(150deg,#141416,#0a0a0a);color:#f6f2e8;--bpmut:rgba(255,255,255,.55);--bptag:rgba(255,255,255,.06);--bptagfg:#E8CC7A;--bpreq:rgba(255,255,255,.05);border-color:rgba(201,168,76,.35)}',
    '#s8 .dab-bg-obsidian .dab-bp-name,#s8 .dab-bg-obsidian .dab-bp-usp,#s8 .dab-bg-obsidian .dab-req li.ok{color:#f6f2e8}',
    '#s8 .dab-bg-obsidian .dab-bp-stub{background:rgba(255,255,255,.05)}#s8 .dab-bg-obsidian .dab-bp-barcode{--bar:#E8CC7A}',
    '#s8 .dab-bg-goldtint{--bpbg:linear-gradient(160deg,#fffdf6,#f6eed6);--bptag:#fff}',
    '#s8 .dab-bg-accgrad{--bpbg:linear-gradient(155deg,color-mix(in srgb,var(--acc) 10%,#fff),#fff 55%);--bptag:#fff}',
    '#s8 .dab-bg-muster{--bpbg:#fff;background-image:repeating-linear-gradient(125deg,rgba(201,168,76,.05) 0 1px,transparent 1px 11px)}',
    /* Stub */
    '#s8 .dab-bp-stub{width:58px;flex-shrink:0;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;background:var(--stubbg,#F8F6F1);color:var(--acc)}',
    '#s8 .dab-bp-code{writing-mode:vertical-rl;font-family:var(--dab-fm);font-size:10px;font-weight:700;letter-spacing:2.5px;color:var(--acc)}',
    '#s8 .dab-bp-barcode{width:26px;height:44px;background:repeating-linear-gradient(0deg,var(--bar,#2A2727) 0 1.5px,transparent 1.5px 3px,var(--bar,#2A2727) 3px 5.5px,transparent 5.5px 7px);opacity:.55;border-radius:2px}',
    '#s8 .dab-bp-lbl{writing-mode:vertical-rl;font-family:var(--dab-fs);font-size:7.5px;letter-spacing:1.6px;color:var(--bpmut,#7A7370);text-transform:uppercase}',
    /* Werbe-Karte */
    '#s8 .dab-bp-ad{border-style:dashed;background:linear-gradient(160deg,#fffdf6,#f6eed6)}',
    '#s8 .dab-bp-adbadge{font-family:var(--dab-fs);font-size:8.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--dab-gold3);background:rgba(201,168,76,.14);border:1px solid rgba(201,168,76,.3);padding:3px 9px;border-radius:99px;align-self:flex-start;margin-bottom:9px}',
    '#s8 .dab-bp-adic{width:44px;height:44px;border-radius:12px;background:#fff;border:1px solid rgba(201,168,76,.3);display:flex;align-items:center;justify-content:center;color:var(--dab-gold);margin-bottom:8px}',
    '#s8 .dab-bp-adt{font-family:var(--dab-fs);font-size:13.5px;font-weight:700;color:#2A2727;line-height:1.2;margin-bottom:5px}',
    '#s8 .dab-bp-ads{font-size:10.5px;color:#7A7370;line-height:1.5;flex:1;margin-bottom:11px}',
    '#s8 .dab-bp-ad .dab-bp-cta{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#1a1508}',
    '#s8 .dab-bp-stub-ad{background:rgba(201,168,76,.06)}',
    '#s8 .dab-bp-plus{color:var(--acc);font-size:20px;font-family:var(--dab-fs);font-weight:700}',
    '@media(max-width:600px){#s8 .dab-bp{flex-basis:320px}#s8 .dab-row-flip{min-width:92px}}',
    /* Lead-Sheet (an body) */
    '.dabm-mask{position:fixed;inset:0;background:rgba(10,10,10,.55);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:9990;padding:16px}',
    '.dabm-mask.show{display:flex}',
    '.dabm-card{width:100%;max-width:430px;background:#FDFCFA;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.4);font-family:Inter,sans-serif;color:#2A2727}',
    '.dabm-head{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);padding:13px 18px}',
    '.dabm-head .t{font-family:"Space Grotesk",sans-serif;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#1a1508}',
    '.dabm-body{padding:18px}',
    '.dabm-p{font-family:"Cormorant Garamond",serif;font-size:21px;font-weight:700;line-height:1.15;margin-bottom:4px}',
    '.dabm-sub{font-size:12px;color:#7A7370;margin-bottom:14px}',
    '.dabm-inc{background:#fff;border:1px solid rgba(201,168,76,.25);border-radius:11px;padding:12px 14px;margin-bottom:14px}',
    '.dabm-inc .ct{font-family:"Space Grotesk",sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9a7f33;margin-bottom:7px}',
    '.dabm-inc ul{list-style:none;display:flex;flex-direction:column;gap:6px;margin:0;padding:0}',
    '.dabm-inc li{font-size:12.5px;display:flex;align-items:center;gap:8px}',
    '.dabm-inc li .ic{color:#3FA56C;flex-shrink:0;display:inline-flex}',
    '.dabm-note{font-size:10.5px;color:#7A7370;margin-bottom:14px;line-height:1.5}',
    '.dabm-actions{display:flex;gap:9px}',
    '.dabm-go{flex:1;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#1a1508;border:none;border-radius:10px;padding:12px;font-family:"Space Grotesk",sans-serif;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(201,168,76,.35)}',
    '.dabm-x{background:#fff;color:#7A7370;border:1.5px solid rgba(42,39,39,.1);border-radius:10px;padding:12px 16px;font-family:"Space Grotesk",sans-serif;font-size:13px;font-weight:600;cursor:pointer}'
  ].join('\n');
})();
