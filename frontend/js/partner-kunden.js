/* partner-kunden.js · v3357 — Partner-Cockpit und „Mein Partner“ (Konzept Dateien/Mandantenkonzept/Mandantenkonzept-Partner-2026-11-13.md)
 *
 * Backend: /api/v1/partner/* (Partnerseite), /api/v1/mein-partner/* (Kundenseite), services/partnerKunden.js.
 *
 *   - Zwei Eintraege unter „Aktionen“ (index.html, .sb-act-partner / .sb-act-meinpartner), sichtbar nur mit Klasse dp-frei
 *   - Partner-Cockpit: Kunden und Plaetze, Einladen, Code einloesen, Stufe und Rechte, Platzentzug, Kundenstaende, Aufgaben, Meldungen
 *   - Mein Partner: Senden (einzeln, mehrere, Bestand), Sendungen, Aufgaben, Verbindung, Verbindungscode
 *   - Bestaetigung jeder Verbindung durch den Kunden (Band + Fenster), auch fuer Einladungslinks bestehender Konten
 *   - Rechte des Partnerplatzes wirken in der App (Knoepfe weg, Funktionen gesperrt), Stufe begrenzt den Detailgrad
 *   - Kundenstand beim Partner: Band „nur lesen“, Speichern ausgesetzt
 *   - Partnerzeile in der Status-Tafel (deal-action-boarding.js), setzt keinen Status
 * Kundentexte: nur Punkt und Komma.
 */
(function () {
  'use strict';
  if (window.DpPartnerKunden) return;

  var G = 'var(--wl-c9a84c, #C9A84C)';
  var S = { kunde: null, partner: null, objekte: null };

  function api(pfad, opt) { return window.Auth && Auth.apiCall ? Auth.apiCall(pfad, opt || { method: 'GET' }) : Promise.reject(new Error('kein_auth')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function datum(d) { if (!d) return ''; var x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  function toast(t) { try { if (typeof window.toast === 'function') return window.toast(t); } catch (e) {} try { console.log('[partner]', t); } catch (e) {} }
  function fehlerText(e) { return (e && e.data && (e.data.detail || e.data.message)) || (e && e.message) || 'Das hat nicht geklappt.'; }

  /* ── Stil ─────────────────────────────────────────────────────────────── */
  function stil() {
    if (document.getElementById('dppk-stil')) return;
    var s = document.createElement('style'); s.id = 'dppk-stil';
    s.textContent = [
      '.sb-act-partner:not(.dp-frei),.sb-act-meinpartner:not(.dp-frei){display:none !important}',
      '.sb-act-item .sb-act-punkt{display:none}',
      '.sb-act-item.dp-punkt .sb-act-punkt{display:inline-block;width:7px;height:7px;border-radius:50%;background:#B8625C;margin-left:auto;flex:0 0 7px}',
      '#dppk-ov{position:fixed;inset:0;z-index:100050;background:rgba(5,5,5,.62);display:flex;align-items:flex-start;justify-content:center;padding:28px 16px;overflow:auto;font-family:Inter,system-ui,sans-serif}',
      '#dppk-ov .pk-box{background:#FDFCFA;border-radius:14px;width:min(1080px,100%);box-shadow:0 26px 70px rgba(0,0,0,.45);overflow:hidden;color:#2A2727}',
      '#dppk-ov .pk-kopf{background:#050505;color:#FDFCFA;display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:2px solid ' + G + '}',
      '#dppk-ov .pk-kopf h2{margin:0;font:600 18px "Space Grotesk",Inter,sans-serif;color:#FDFCFA;flex:1;min-width:0}',
      '#dppk-ov .pk-kopf .pk-sub{display:block;font:500 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:' + G + ';margin-bottom:2px}',
      '#dppk-ov .pk-zu{width:34px;height:34px;flex:0 0 34px;border-radius:8px;border:1px solid rgba(253,252,250,.25);background:transparent;color:#FDFCFA;font:400 20px/1 Inter,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}',
      '#dppk-ov .pk-zu:hover{border-color:' + G + ';color:' + G + '}',
      '#dppk-ov .pk-reiter{display:flex;gap:6px;flex-wrap:wrap;padding:12px 20px 0;border-bottom:1px solid #EDE6D6}',
      '#dppk-ov .pk-reiter button{border:0;background:transparent;padding:9px 12px;font:600 13px Inter,sans-serif;color:#6B6460;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;border-radius:0}',
      '#dppk-ov .pk-reiter button.an{color:#2A2727;border-bottom-color:' + G + '}',
      '#dppk-ov .pk-reiter .pk-zahl{display:inline-block;min-width:18px;height:18px;line-height:18px;border-radius:9px;background:#B8625C;color:#fff;font:600 10.5px Inter;text-align:center;padding:0 5px;margin-left:5px}',
      '#dppk-ov .pk-inhalt{padding:18px 20px 22px}',
      '#dppk-ov .pk-kacheln{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}',
      '#dppk-ov .pk-kachel{background:#FBF6E9;border:1px solid #EDE2C6;border-radius:10px;padding:10px 12px}',
      '#dppk-ov .pk-kachel b{display:block;font:600 22px "Space Grotesk",sans-serif;color:#2A2727}',
      '#dppk-ov .pk-kachel span{font:500 10.5px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#7A7370}',
      '#dppk-ov .pk-leiste{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}',
      '#dppk-ov .pk-btn{border:1px solid #D9CFB8;background:#fff;color:#2A2727;border-radius:8px;padding:8px 13px;font:600 13px Inter,sans-serif;cursor:pointer;line-height:1.2}',
      '#dppk-ov .pk-btn:hover{border-color:' + G + '}',
      '#dppk-ov .pk-btn.gold{background:' + G + ';border-color:' + G + ';color:#fff}',
      '#dppk-ov .pk-btn.rot{color:#B8625C;border-color:#E3C2BF}',
      '#dppk-ov .pk-btn.klein{padding:6px 10px;font-size:12px}',
      '#dppk-ov .pk-btn[disabled]{opacity:.5;cursor:default}',
      '#dppk-ov .pk-zeile{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 12px;border:1px solid #EDE6D6;border-radius:10px;background:#fff;margin-bottom:8px}',
      '#dppk-ov .pk-zeile .pk-name{flex:1 1 220px;min-width:0}',
      '#dppk-ov .pk-zeile .pk-name b{display:block;font:600 14px Inter,sans-serif;overflow-wrap:anywhere}',
      '#dppk-ov .pk-zeile .pk-name small{color:#7A7370;font-size:12px;overflow-wrap:anywhere}',
      '#dppk-ov .pk-chip{display:inline-block;border-radius:6px;padding:3px 8px;font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.04em;text-transform:uppercase;border:1px solid #E2D7BE;background:#FBF6E9;color:#6B5A2A;white-space:nowrap}',
      '#dppk-ov .pk-chip.gruen{background:#EAF5EE;border-color:#BFE0CB;color:#2C7A4E}',
      '#dppk-ov .pk-chip.rot{background:#F8ECEB;border-color:#E3C2BF;color:#94433E}',
      '#dppk-ov .pk-chip.grau{background:#F2F0EC;border-color:#E2DED6;color:#6B6460}',
      '#dppk-ov .pk-gruppe{font:600 11px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370;margin:16px 0 8px}',
      '#dppk-ov .pk-leer{color:#7A7370;font-style:italic;padding:8px 2px}',
      '#dppk-ov .pk-hinweis{background:#FBF6E9;border-left:3px solid ' + G + ';border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.5;margin-bottom:14px}',
      '#dppk-ov .pk-hinweis.rot{border-left-color:#B8625C;background:#FBF1F0}',
      '#dppk-ov label.pk-feld{display:block;margin-bottom:12px;font:600 12px Inter,sans-serif;color:#4A4440}',
      '#dppk-ov label.pk-feld input[type=text],#dppk-ov label.pk-feld input[type=email],#dppk-ov label.pk-feld input[type=number],#dppk-ov label.pk-feld input[type=date],#dppk-ov label.pk-feld select,#dppk-ov label.pk-feld textarea{display:block;width:100%;box-sizing:border-box;margin-top:5px;height:38px;border:1px solid #D9CFB8;border-radius:8px;padding:0 10px;font:400 14px Inter,sans-serif;background:#fff;color:#2A2727}',
      '#dppk-ov label.pk-feld textarea{height:84px;padding:8px 10px;resize:vertical}',
      '#dppk-ov .pk-wahl{display:flex;gap:10px;align-items:flex-start;border:1px solid #EDE6D6;border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#fff;cursor:pointer;font:400 13px Inter,sans-serif}',
      '#dppk-ov .pk-wahl input{margin-top:3px;accent-color:' + G + '}',
      '#dppk-ov .pk-wahl b{display:block;font-weight:600}',
      '#dppk-ov .pk-schalter{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #F0EADC;font:400 13px Inter,sans-serif}',
      '#dppk-ov .pk-schalter small{display:block;color:#7A7370}',
      '#dppk-ov .pk-schalter input{width:18px;height:18px;accent-color:' + G + ';flex:0 0 18px}',
      '#dppk-dlg{position:fixed;inset:0;z-index:100060;background:rgba(5,5,5,.5);display:flex;align-items:flex-start;justify-content:center;padding:44px 16px;overflow:auto;font-family:Inter,system-ui,sans-serif}',
      '#dppk-dlg .pk-box{background:#FDFCFA;border-radius:14px;width:min(560px,100%);box-shadow:0 26px 70px rgba(0,0,0,.45);overflow:hidden;color:#2A2727}',
      '#dppk-dlg .pk-kopf{background:#050505;color:#FDFCFA;display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:2px solid ' + G + '}',
      '#dppk-dlg .pk-kopf h3{margin:0;flex:1;font:600 16px "Space Grotesk",Inter,sans-serif;color:#FDFCFA}',
      '#dppk-dlg .pk-zu{width:34px;height:34px;flex:0 0 34px;border-radius:8px;border:1px solid rgba(253,252,250,.25);background:transparent;color:#FDFCFA;font:400 20px/1 Inter,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}',
      '#dppk-dlg .pk-inhalt{padding:16px 18px}',
      '#dppk-dlg .pk-fuss{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;border-top:1px solid #EDE6D6;background:#FBF8F1;flex-wrap:wrap}',
      '#dppk-dlg .pk-btn{border:1px solid #D9CFB8;background:#fff;color:#2A2727;border-radius:8px;padding:8px 13px;font:600 13px Inter,sans-serif;cursor:pointer}',
      '#dppk-dlg .pk-btn.gold{background:' + G + ';border-color:' + G + ';color:#fff}',
      '#dppk-dlg .pk-btn.rot{background:#B8625C;border-color:#B8625C;color:#fff}',
      '#dppk-dlg label.pk-feld{display:block;margin-bottom:12px;font:600 12px Inter,sans-serif;color:#4A4440}',
      '#dppk-dlg label.pk-feld input[type=text],#dppk-dlg label.pk-feld input[type=email],#dppk-dlg label.pk-feld input[type=number],#dppk-dlg label.pk-feld input[type=date],#dppk-dlg label.pk-feld select,#dppk-dlg label.pk-feld textarea{display:block;width:100%;box-sizing:border-box;margin-top:5px;height:38px;border:1px solid #D9CFB8;border-radius:8px;padding:0 10px;font:400 14px Inter,sans-serif;background:#fff;color:#2A2727}',
      '#dppk-dlg label.pk-feld textarea{height:84px;padding:8px 10px;resize:vertical}',
      '#dppk-dlg .pk-wahl{display:flex;gap:10px;align-items:flex-start;border:1px solid #EDE6D6;border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#fff;cursor:pointer;font:400 13px Inter,sans-serif}',
      '#dppk-dlg .pk-wahl input{margin-top:3px;accent-color:' + G + '}',
      '#dppk-dlg .pk-wahl b{display:block;font-weight:600}',
      '#dppk-dlg .pk-schalter{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #F0EADC;font:400 13px Inter,sans-serif}',
      '#dppk-dlg .pk-schalter small{display:block;color:#7A7370}',
      '#dppk-dlg .pk-schalter input{width:18px;height:18px;accent-color:' + G + ';flex:0 0 18px}',
      '#dppk-dlg .pk-gruppe{font:600 11px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370;margin:14px 0 6px}',
      '#dppk-dlg .pk-hinweis{background:#FBF6E9;border-left:3px solid ' + G + ';border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.5;margin-bottom:12px}',
      '#dppk-dlg .pk-hinweis.rot{border-left-color:#B8625C;background:#FBF1F0}',
      '#dppk-dlg .pk-code{font:600 28px "JetBrains Mono",monospace;letter-spacing:.12em;text-align:center;padding:14px;border:1px dashed ' + G + ';border-radius:10px;background:#FBF6E9;margin:6px 0 12px}',
      '#dppk-band{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:100040;max-width:min(720px,calc(100vw - 32px));width:max-content;background:#050505;color:#FDFCFA;border:1px solid ' + G + ';border-radius:12px;padding:12px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;box-shadow:0 14px 40px rgba(0,0,0,.4);font:400 13px Inter,sans-serif}',
      '#dppk-band b{color:' + G + '}',
      '#dppk-band .pk-btn{border:1px solid ' + G + ';background:' + G + ';color:#fff;border-radius:8px;padding:7px 12px;font:600 12.5px Inter,sans-serif;cursor:pointer}',
      '#dppk-band .pk-btn.leer{background:transparent;color:#FDFCFA;border-color:rgba(253,252,250,.3)}',
      '#dppk-ks{position:sticky;top:0;z-index:50;background:#FBF6E9;border:1px solid ' + G + ';border-radius:10px;margin:8px 12px;padding:9px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font:400 13px Inter,sans-serif;color:#2A2727}',
      '#dppk-ks b{font-weight:600}',
      '#dppk-ks .pk-btn{border:1px solid ' + G + ';background:' + G + ';color:#fff;border-radius:8px;padding:6px 11px;font:600 12px Inter,sans-serif;cursor:pointer;margin-left:auto}',
      '.dab-partnerzeile{display:flex;gap:10px;align-items:center;margin-top:8px;padding:10px 12px;border:1px dashed ' + G + ';border-radius:10px;cursor:pointer;font:400 13px Inter,sans-serif}',
      '.dab-partnerzeile b{font-weight:600}',
      '.dab-partnerzeile small{display:block;opacity:.75}',
      /* Rechte des Partnerplatzes: Knoepfe weg (Funktionen sind zusaetzlich gesperrt, siehe rechteAnwenden) */
      'body.dppk-aus-pdf [onclick*="exportPDF"],body.dppk-aus-pdf [onclick*="exportWerbungskostenPDF"],body.dppk-aus-pdf [onclick*="bsheetAction(\'pdf\')"],body.dppk-aus-pdf [data-act="pdf"],body.dppk-aus-pdf [data-act="trackrec"],body.dppk-aus-pdf [data-feature="track_record_pdf"],body.dppk-aus-pdf .da-bank-pdf-btn,body.dppk-aus-pdf .dp-rc-exp-btn{display:none !important}',
      'body.dppk-aus-bankpdf [data-act="bankexport"],body.dppk-aus-bankpdf .da-bank-pdf-btn{display:none !important}',
      'body.dppk-aus-markt [data-act="marktbericht"],body.dppk-aus-markt [onclick*="dpMbAbruf"]{display:none !important}',
      'body.dppk-aus-e_darstellung .st-tab[data-tab="darstellung"],body.dppk-aus-e_steuer .st-tab[data-tab="standardwerte"],body.dppk-aus-schluessel .st-tab[data-tab="api"]{display:none !important}',
      '@media (max-width:640px){#dppk-ov{padding:0}#dppk-ov .pk-box{border-radius:0;min-height:100vh}#dppk-ov .pk-inhalt{padding:14px}#dppk-ov .pk-reiter{padding:8px 14px 0;overflow-x:auto;flex-wrap:nowrap}#dppk-ov .pk-reiter button{white-space:nowrap}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Fenster ──────────────────────────────────────────────────────────── */
  function ansichtOeffnen(unter, titel, reiter, zeichne) {
    stil();
    var alt = document.getElementById('dppk-ov'); if (alt) alt.remove();
    var ov = document.createElement('div'); ov.id = 'dppk-ov';
    ov.innerHTML = '<div class="pk-box" role="dialog" aria-modal="true"><div class="pk-kopf"><h2><span class="pk-sub">' + esc(unter) + '</span>' + esc(titel) + '</h2>' +
      '<button type="button" class="pk-zu" aria-label="Schließen" title="Schließen">×</button></div>' +
      '<div class="pk-reiter"></div><div class="pk-inhalt"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.pk-zu').onclick = function () { ov.remove(); };
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.remove(); });
    var r = ov.querySelector('.pk-reiter'), inh = ov.querySelector('.pk-inhalt');
    var aktiv = reiter[0].k;
    function rein() {
      r.innerHTML = reiter.map(function (x) { return '<button type="button" data-k="' + x.k + '" class="' + (x.k === aktiv ? 'an' : '') + '">' + esc(x.t) + (x.zahl ? '<span class="pk-zahl">' + x.zahl + '</span>' : '') + '</button>'; }).join('');
      [].forEach.call(r.querySelectorAll('button'), function (b) { b.onclick = function () { aktiv = b.getAttribute('data-k'); rein(); }; });
      inh.innerHTML = '<div class="pk-leer">Lädt …</div>';
      zeichne(aktiv, inh, function (k) { if (k) aktiv = k; rein(); });
    }
    rein();
    return ov;
  }

  function dialog(titel, html, knoepfe) {
    stil();
    var alt = document.getElementById('dppk-dlg'); if (alt) alt.remove();
    var d = document.createElement('div'); d.id = 'dppk-dlg';
    d.innerHTML = '<div class="pk-box" role="dialog" aria-modal="true"><div class="pk-kopf"><h3>' + esc(titel) + '</h3><button type="button" class="pk-zu" aria-label="Schließen" title="Schließen">×</button></div>' +
      '<div class="pk-inhalt">' + html + '</div><div class="pk-fuss"></div></div>';
    document.body.appendChild(d);
    var zu = function () { d.remove(); };
    d.querySelector('.pk-zu').onclick = zu;
    d.addEventListener('mousedown', function (e) { if (e.target === d) zu(); });
    var f = d.querySelector('.pk-fuss');
    (knoepfe || [{ t: 'Schließen' }]).forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pk-btn' + (k.c ? ' ' + k.c : ''); b.textContent = k.t;
      b.onclick = function () {
        if (!k.fn) return zu();
        b.disabled = true;
        Promise.resolve(k.fn(d)).then(function (r) { if (r !== false) zu(); else b.disabled = false; }, function (e) { b.disabled = false; toast(fehlerText(e)); });
      };
      f.appendChild(b);
    });
    var erst = d.querySelector('input,select,textarea'); if (erst) setTimeout(function () { try { erst.focus(); } catch (e) {} }, 30);
    return d;
  }
  function wert(d, sel) { var e = d.querySelector(sel); return e ? (e.type === 'checkbox' ? e.checked : e.value) : null; }

  /* ════ PARTNER-COCKPIT ═══════════════════════════════════════════════════ */
  var STUFEN = { 1: 'Einsteiger', 2: 'Fortgeschritten', 3: 'Experte' };
  var RECHTE_TEXT = [
    ['pdf', 'PDF-Download und Export', 'Aus blendet die Knöpfe überall aus, auch unter Aktionen.'],
    ['bankpdf', 'Bank-PDF und Bankexport', 'Finanzierungsunterlage für die Bank.'],
    ['markt', 'Marktbericht abrufen', 'Mit Monatskontingent, höchstens 10.'],
    ['ki', 'KI-Funktionen und Co-Pilot', 'Auswertungen, Investitionsthese, Co-Pilot.'],
    ['schluessel', 'Eigene Schlüssel', 'ImmoMetrica-Anbindung und eigener KI-Schlüssel, Kosten trägt der Kunde.'],
    ['telegram', 'Telegram-Bot', ''],
    ['senden', 'Objekte an dich senden', ''],
    ['e_steuer', 'Einstellungen: Standardwerte', 'Steuer und Vorgaben selbst ändern.'],
    ['e_finanz', 'Einstellungen: Finanzierungsvorgaben', ''],
    ['e_darstellung', 'Einstellungen: Darstellung', '']
  ];

  function cockpitOeffnen(startReiter) {
    return api('/partner/cockpit').then(function (c) {
      S.partner = c; menuePflegen();
      var reiter = [{ k: 'kunden', t: 'Kunden und Plätze', zahl: c.anfragen.length || 0 }, { k: 'staende', t: 'Von Kunden freigegeben', zahl: c.kunden.reduce(function (a, k) { return a + (k.neu || 0); }, 0) },
        { k: 'aufgaben', t: 'Aufgaben' }, { k: 'meldungen', t: 'Meldungen', zahl: c.meldungen_ungelesen || 0 }];
      if (startReiter) reiter.sort(function (a) { return a.k === startReiter ? -1 : 0; });
      ansichtOeffnen('Partner-Cockpit', c.partner.name, reiter, function (k, el, neu) {
        if (k === 'kunden') return kundenZeichnen(el, neu);
        if (k === 'staende') return staendeZeichnen(el);
        if (k === 'aufgaben') return aufgabenZeichnen(el);
        if (k === 'meldungen') return meldungenZeichnen(el, neu);
      });
    }, function (e) { toast(e && e.status === 403 ? 'Das Partner-Cockpit gibt es mit dem Partner-Plan.' : fehlerText(e)); });
  }
  function neuLaden(el) { return api('/partner/cockpit').then(function (c) { S.partner = c; menuePflegen(); kundenZeichnen(el); }); }

  function kundenZeichnen(el) {
    var c = S.partner, pool = c.pool || {};
    var belegt = c.kunden.filter(function (k) { return k.hat_platz; }).length;
    var verb = c.kunden.filter(function (k) { return !k.getrennt_am; }).length;
    var h = '<div class="pk-kacheln">' +
      '<div class="pk-kachel"><span>Plätze belegt</span><b>' + belegt + ' / ' + (pool.total != null ? pool.total : (pool.gesamt != null ? pool.gesamt : '–')) + '</b></div>' +
      '<div class="pk-kachel"><span>Kunden verbunden</span><b>' + verb + '</b></div>' +
      '<div class="pk-kachel"><span>Kundenstände</span><b>' + c.kunden.reduce(function (a, k) { return a + (k.sendungen || 0); }, 0) + '</b></div>' +
      '<div class="pk-kachel"><span>Offene Anfragen</span><b>' + c.anfragen.length + '</b></div></div>' +
      '<div class="pk-leiste"><button type="button" class="pk-btn gold" data-a="einladen">Kunden einladen</button><button type="button" class="pk-btn" data-a="code">Verbindungscode eingeben</button></div>';
    if (c.anfragen.length || (c.einladungen || []).length) {
      h += '<div class="pk-gruppe">Wartet auf Bestätigung des Kunden</div>';
      h += c.anfragen.map(function (a) {
        return '<div class="pk-zeile"><div class="pk-name"><b>' + esc(a.anzeige_name || a.email) + '</b><small>' + esc(a.email) + ' · ' + (a.quelle === 'code' ? 'per Code' : 'per Einladung') + ' · seit ' + datum(a.erstellt_am) + '</small></div>' +
          '<span class="pk-chip">' + (a.platz_mitgeben ? 'mit Platz' : 'ohne Platz') + '</span><button type="button" class="pk-btn klein" data-zz="' + a.id + '">Zurückziehen</button></div>';
      }).join('') + (c.einladungen || []).map(function (i) {
        return '<div class="pk-zeile"><div class="pk-name"><b>' + esc(i.display_name) + '</b><small>' + esc(i.email) + ' · Einladung an neue Adresse · bis ' + datum(i.expires_at) + '</small></div><span class="pk-chip grau">noch kein Konto</span></div>';
      }).join('');
    }
    h += '<div class="pk-gruppe">Kunden</div>';
    if (!c.kunden.length) h += '<div class="pk-leer">Noch keine Kunden. Lade einen Kunden ein oder lass dir seinen Verbindungscode geben.</div>';
    h += c.kunden.map(function (k) {
      var getrennt = !!k.getrennt_am;
      var status = getrennt ? '<span class="pk-chip grau">getrennt</span>' : k.entzug_frist_bis ? '<span class="pk-chip rot">Frist bis ' + datum(k.entzug_frist_bis) + '</span>' : '<span class="pk-chip gruen">verbunden</span>';
      var zug = k.platz_art === 'platz' ? '<span class="pk-chip">Partnerplatz' + (k.hat_platz ? '' : ', noch ohne Platz') + '</span>' : '<span class="pk-chip grau">eigener Plan</span>';
      var info = k.platz_art === 'platz' ? (STUFEN[k.stufe] || 'Fortgeschritten') + ', ' + (k.marke === 'dealpilot' ? 'Marke DealPilot' : 'deine Marke') : 'Stufe und Rechte wählt der Kunde';
      var knoepfe = getrennt ? '' : (k.platz_art === 'platz'
        ? '<button type="button" class="pk-btn klein" data-ein="' + k.id + '">Stufe und Rechte</button>' + (k.hat_platz || k.entzug_frist_bis ? '' : '<button type="button" class="pk-btn klein" data-platz="' + k.id + '">Platz zuweisen</button>')
        : '<button type="button" class="pk-btn klein" data-ein="' + k.id + '">Notiz</button><button type="button" class="pk-btn klein rot" data-trenn="' + k.id + '">Trennen</button>');
      return '<div class="pk-zeile"><div class="pk-name"><b>' + esc(k.display_name) + '</b><small>' + esc(k.email) + ' · ' + esc(info) + (k.sendungen ? ' · ' + k.sendungen + (k.sendungen === 1 ? ' Objekt gesendet' : ' Objekte gesendet') : '') + (k.neu ? ', ' + k.neu + ' neu' : '') + '</small></div>' + zug + status + knoepfe + '</div>';
    }).join('');
    el.innerHTML = h;
    el.querySelector('[data-a="einladen"]').onclick = function () { einladenDialog(el); };
    el.querySelector('[data-a="code"]').onclick = function () { codeDialog(el); };
    [].forEach.call(el.querySelectorAll('[data-zz]'), function (b) { b.onclick = function () { api('/partner/anfragen/' + b.getAttribute('data-zz') + '/zurueckziehen', { method: 'POST' }).then(function () { neuLaden(el); }); }; });
    [].forEach.call(el.querySelectorAll('[data-ein]'), function (b) { b.onclick = function () { kundeDialog(el, b.getAttribute('data-ein')); }; });
    [].forEach.call(el.querySelectorAll('[data-platz]'), function (b) { b.onclick = function () { api('/partner/kunden/' + b.getAttribute('data-platz') + '/platz', { method: 'POST' }).then(function () { toast('Platz zugewiesen.'); neuLaden(el); }, function (e) { toast(fehlerText(e)); }); }; });
    [].forEach.call(el.querySelectorAll('[data-trenn]'), function (b) {
      b.onclick = function () {
        var k = c.kunden.filter(function (x) { return x.id === b.getAttribute('data-trenn'); })[0];
        dialog('Verbindung trennen', '<p>Die Verbindung zu <b>' + esc(k.display_name) + '</b> wird getrennt. Sein Konto und sein Plan bleiben unverändert. Gesendete Kundenstände bleiben bei dir, markiert als nicht mehr verbunden.</p>',
          [{ t: 'Abbrechen' }, { t: 'Trennen', c: 'rot', fn: function () { return api('/partner/kunden/' + k.id + '/trennen', { method: 'POST' }).then(function () { toast('Verbindung getrennt.'); neuLaden(el); }); } }]);
      };
    });
  }

  function einladenDialog(el) {
    dialog('Kunden einladen',
      '<div class="pk-hinweis">Hat die Adresse schon ein DealPilot-Konto, bekommt der Kunde eine Anfrage in seiner App und bestätigt sie dort. Sonst geht eine Einladung per E-Mail raus.</div>' +
      '<label class="pk-feld">Name des Kunden<input type="text" id="pk-e-name" maxlength="120"></label>' +
      '<label class="pk-feld">E-Mail<input type="email" id="pk-e-mail" maxlength="200"></label>' +
      '<label class="pk-wahl"><input type="radio" name="pk-e-art" value="platz" checked><span><b>Mit Partnerplatz</b>Du bezahlst seinen Zugang und bestimmst Stufe, Rechte und Marke. Hat er ein eigenes Abo, wird er ohne Platz verbunden.</span></label>' +
      '<label class="pk-wahl"><input type="radio" name="pk-e-art" value="eigen"><span><b>Ohne Platz</b>Der Kunde nutzt seinen eigenen Plan und schickt dir nur, was er freigibt.</span></label>',
      [{ t: 'Abbrechen' }, { t: 'Einladen', c: 'gold', fn: function (d) {
        var name = wert(d, '#pk-e-name'), mail = wert(d, '#pk-e-mail');
        if (!String(name).trim() || !/@/.test(String(mail))) { toast('Bitte Name und E-Mail eintragen.'); return false; }
        var art = (d.querySelector('input[name="pk-e-art"]:checked') || {}).value;
        return api('/partner/einladen', { method: 'POST', body: { name: name, email: mail, platz_mitgeben: art !== 'eigen' } }).then(function () { toast('Einladung gesendet.'); neuLaden(el); });
      } }]);
  }

  function codeDialog(el) {
    dialog('Verbindungscode eingeben',
      '<div class="pk-hinweis">Den Code erzeugt dein Kunde in DealPilot unter „Mein Partner“ bzw. in den Einstellungen. Er gilt 24 Stunden und nur einmal. Danach bestätigt der Kunde die Verbindung in seiner App.</div>' +
      '<label class="pk-feld">Code<input type="text" id="pk-c-code" maxlength="12" placeholder="XXXX-XXXX" style="text-transform:uppercase;font-family:\'JetBrains Mono\',monospace;letter-spacing:.1em"></label>' +
      '<label class="pk-feld">Name des Kunden (für deine Liste)<input type="text" id="pk-c-name" maxlength="120"></label>' +
      '<label class="pk-wahl"><input type="checkbox" id="pk-c-platz" checked><span><b>Partnerplatz mitgeben</b>Nur wenn der Kunde kein eigenes Abo hat.</span></label>',
      [{ t: 'Abbrechen' }, { t: 'Anfrage senden', c: 'gold', fn: function (d) {
        return api('/partner/code', { method: 'POST', body: { code: wert(d, '#pk-c-code'), name: wert(d, '#pk-c-name'), platz_mitgeben: wert(d, '#pk-c-platz') } })
          .then(function () { toast('Anfrage gesendet. Der Kunde bestätigt sie in seiner App.'); neuLaden(el); });
      } }]);
  }

  function kundeDialog(el, id) {
    var k = S.partner.kunden.filter(function (x) { return x.id === id; })[0]; if (!k) return;
    if (k.platz_art !== 'platz') {
      return dialog('Notiz zu ' + k.display_name, '<div class="pk-hinweis">Der Kunde hat einen eigenen Plan. Stufe, Rechte und Marke bestimmt er selbst. Die Notiz sieht nur dein Team.</div>' +
        '<label class="pk-feld">Notiz<textarea id="pk-k-notiz" maxlength="2000">' + esc(k.notiz || '') + '</textarea></label>',
        [{ t: 'Abbrechen' }, { t: 'Speichern', c: 'gold', fn: function (d) { return api('/partner/kunden/' + id, { method: 'PUT', body: { notiz: wert(d, '#pk-k-notiz') } }).then(function () { neuLaden(el); }); } }]);
    }
    var r = k.rechte_wirksam || {};
    var html = '<div class="pk-gruppe">Stufe</div>' + [1, 2, 3].map(function (s) {
      var t = { 1: 'Kennzahlen, Cashflow und Score. Die wichtigsten Felder.', 2: 'Zusätzlich Finanzierung im Detail, Steuer und Mietentwicklung.', 3: 'Alle Felder, dazu die Wertermittlung im Marktbericht.' }[s];
      return '<label class="pk-wahl"><input type="radio" name="pk-k-stufe" value="' + s + '"' + ((k.stufe || 2) === s ? ' checked' : '') + '><span><b>' + STUFEN[s] + '</b>' + t + '</span></label>';
    }).join('') +
      '<div class="pk-gruppe">Marke beim Kunden</div>' +
      '<label class="pk-wahl"><input type="radio" name="pk-k-marke" value="partner"' + (k.marke !== 'dealpilot' ? ' checked' : '') + '><span><b>Deine Marke</b>' + esc(S.partner.partner.name) + '</span></label>' +
      '<label class="pk-wahl"><input type="radio" name="pk-k-marke" value="dealpilot"' + (k.marke === 'dealpilot' ? ' checked' : '') + '><span><b>DealPilot</b></span></label>' +
      '<div class="pk-gruppe">Rechte des Platzes</div><div style="font-size:12.5px;color:#7A7370;margin-bottom:4px">Ein Platz umfasst höchstens den Investor-Plan. Hier schaltest du einzelne Teile ab.</div>' +
      RECHTE_TEXT.map(function (x) { return '<label class="pk-schalter"><span>' + esc(x[1]) + (x[2] ? '<small>' + esc(x[2]) + '</small>' : '') + '</span><input type="checkbox" data-recht="' + x[0] + '"' + (r[x[0]] !== false ? ' checked' : '') + '></label>'; }).join('') +
      '<label class="pk-schalter"><span>Partnernetzwerk zeigen<small>Vorgabe aus.</small></span><input type="checkbox" id="pk-k-netz"' + (k.netzwerk ? ' checked' : '') + '></label>' +
      '<label class="pk-feld" style="margin-top:12px">Marktberichte je Monat (höchstens 10, leer = wie Investor)<input type="number" id="pk-k-mb" min="0" max="10" value="' + (k.kontingent && k.kontingent.marktbericht != null ? k.kontingent.marktbericht : '') + '"></label>' +
      '<label class="pk-feld">Notiz (nur dein Team)<textarea id="pk-k-notiz" maxlength="2000">' + esc(k.notiz || '') + '</textarea></label>' +
      '<div class="pk-gruppe">Platz</div><div class="pk-hinweis rot">Platz entziehen: der Kunde bekommt 30 Tage Frist zum Export oder für ein eigenes Abo. Danach werden seine Verbindungen getrennt und sein Konto gelöscht.</div>';
    dialog('Stufe und Rechte für ' + k.display_name, html, [
      { t: 'Platz entziehen', c: '', fn: function () { entzugDialog(el, k); } },
      { t: 'Abbrechen' },
      { t: 'Speichern', c: 'gold', fn: function (d) {
        var rechte = {}; [].forEach.call(d.querySelectorAll('[data-recht]'), function (x) { rechte[x.getAttribute('data-recht')] = x.checked; });
        var mb = wert(d, '#pk-k-mb');
        return api('/partner/kunden/' + id, { method: 'PUT', body: {
          stufe: (d.querySelector('input[name="pk-k-stufe"]:checked') || {}).value, marke: (d.querySelector('input[name="pk-k-marke"]:checked') || {}).value,
          rechte: rechte, netzwerk: wert(d, '#pk-k-netz'), kontingent: mb === '' ? {} : { marktbericht: Number(mb) }, notiz: wert(d, '#pk-k-notiz') } })
          .then(function () { toast('Gespeichert.'); neuLaden(el); });
      } }]);
  }

  function entzugDialog(el, k) {
    dialog('Platz entziehen', '<div class="pk-hinweis rot"><b>' + esc(k.display_name) + '</b> verliert den Partnerplatz. Der Platz ist für dich sofort wieder frei.<br>' +
      'Der Kunde bekommt 30 Tage Frist. In der Zeit kann er seine Daten exportieren oder ein eigenes Abo abschließen, dann bleibt alles erhalten.<br>' +
      'Ohne eigenes Abo werden nach der Frist seine Verbindungen (Schnittstellen, Telegram, ImmoMetrica) getrennt und sein Konto mit allen Daten gelöscht. Das lässt sich nicht rückgängig machen.<br>' +
      'Kundenstände, die er dir gesendet hat, bleiben bei dir.</div>' +
      '<label class="pk-feld">Zur Bestätigung den Namen eintippen: ' + esc(k.display_name) + '<input type="text" id="pk-x-name"></label>',
      [{ t: 'Abbrechen' }, { t: 'Platz entziehen', c: 'rot', fn: function (d) {
        return api('/partner/kunden/' + k.id + '/entzug', { method: 'POST', body: { bestaetigung: wert(d, '#pk-x-name') } }).then(function () { toast('Platz entzogen, die Frist läuft.'); neuLaden(el); });
      } }]);
  }

  function staendeZeichnen(el) {
    api('/partner/kundenstaende').then(function (r) {
      var l = r.kundenstaende || [];
      if (!l.length) { el.innerHTML = '<div class="pk-leer">Noch keine Kundenstände. Sobald ein Kunde Objekte sendet, stehen sie hier, getrennt nach Kunde. In deiner Objektliste tauchen sie nicht auf.</div>'; return; }
      var g = {}; l.forEach(function (x) { (g[x.kunde] = g[x.kunde] || []).push(x); });
      el.innerHTML = Object.keys(g).map(function (kn) {
        return '<div class="pk-gruppe">Von Kunden freigegeben › ' + esc(kn) + '</div>' + g[kn].map(function (x) {
          return '<div class="pk-zeile"><div class="pk-name"><b>' + esc(x.name || x.seq_no || 'Objekt') + '</b><small>' + esc([x.seq_no, x.ort].filter(Boolean).join(' · ')) + ' · Stand ' + x.stand_nr + ' vom ' + datum(x.stand_am) + (x.ueber_bestand ? ' · als Bestand gesendet' : '') + (x.getrennt_am ? ' · nicht mehr verbunden' : '') + '</small></div>' +
            (x.gelesen_am ? '' : '<span class="pk-chip gruen">neu</span>') + (x.deal_won ? '<span class="pk-chip">Bestand</span>' : '<span class="pk-chip grau">Ankauf</span>') +
            '<button type="button" class="pk-btn klein gold" data-laden="' + x.kopie_object_id + '" data-s="' + x.share_id + '">Laden</button>' +
            '<button type="button" class="pk-btn klein" data-ueb="' + x.share_id + '">Als eigenes Objekt übernehmen</button></div>';
        }).join('');
      }).join('');
      [].forEach.call(el.querySelectorAll('[data-laden]'), function (b) {
        b.onclick = function () {
          api('/partner/kundenstaende/' + b.getAttribute('data-s') + '/geoeffnet', { method: 'POST' }).catch(function () {});
          var ov = document.getElementById('dppk-ov'); if (ov) ov.remove();
          try { if (typeof setMainView === 'function') setMainView('single'); } catch (e) {}
          if (typeof window.loadSaved === 'function') window.loadSaved(b.getAttribute('data-laden'));
        };
      });
      [].forEach.call(el.querySelectorAll('[data-ueb]'), function (b) {
        b.onclick = function () {
          dialog('Als eigenes Objekt übernehmen', '<p>DealPilot legt eine eigene, bearbeitbare Kopie unter deinen Objekten an. Sie bleibt bei dir, auch wenn der Kunde seinen Stand zurückzieht.</p>',
            [{ t: 'Abbrechen' }, { t: 'Übernehmen', c: 'gold', fn: function () { return api('/partner/kundenstaende/' + b.getAttribute('data-ueb') + '/uebernehmen', { method: 'POST' }).then(function (r) { toast('Übernommen als ' + (r.seq_no || 'neues Objekt') + '.'); try { if (typeof renderSaved === 'function') renderSaved(); } catch (e) {} }); } }]);
        };
      });
    }, function (e) { el.innerHTML = '<div class="pk-leer">' + esc(fehlerText(e)) + '</div>'; });
  }

  var AUFG_STATUS = { offen: ['offen', 'grau'], gesehen: ['gesehen', 'grau'], in_arbeit: ['in Arbeit', ''], erledigt: ['erledigt', 'gruen'], abgelehnt: ['abgelehnt', 'rot'] };
  function aufgabenZeichnen(el) {
    api('/partner/aufgaben').then(function (r) {
      var l = r.aufgaben || [];
      var h = '<div class="pk-leiste"><button type="button" class="pk-btn gold" data-a="neu">Neue Aufgabe</button></div>';
      if (!l.length) h += '<div class="pk-leer">Noch keine Aufgaben. Zum Beispiel: „Steuerjahr fertigstellen und senden“ an alle Kunden.</div>';
      h += l.map(function (a) {
        var fertig = a.kunden.filter(function (k) { return k.status === 'erledigt'; }).length;
        return '<div class="pk-zeile" style="display:block"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="pk-name"><b>' + esc(a.titel) + '</b><small>' + (a.faellig_am ? 'fällig ' + datum(a.faellig_am) + ' · ' : '') + fertig + ' von ' + a.kunden.length + ' erledigt' + (a.status === 'abgeschlossen' ? ' · abgeschlossen' : '') + '</small></div>' +
          (a.status === 'aktiv' ? '<button type="button" class="pk-btn klein" data-er="' + a.id + '">Alle Offenen erinnern</button><button type="button" class="pk-btn klein" data-ab="' + a.id + '">Abschließen</button>' : '') + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + a.kunden.map(function (k) { var s = AUFG_STATUS[k.status] || [k.status, 'grau']; return '<span class="pk-chip ' + s[1] + '" title="' + esc(k.abgelehnt_grund || '') + '">' + esc(k.display_name) + ': ' + s[0] + '</span>'; }).join('') + '</div></div>';
      }).join('');
      el.innerHTML = h;
      el.querySelector('[data-a="neu"]').onclick = function () { aufgabeDialog(el); };
      [].forEach.call(el.querySelectorAll('[data-er]'), function (b) { b.onclick = function () { api('/partner/aufgaben/' + b.getAttribute('data-er') + '/erinnern', { method: 'POST', body: {} }).then(function (r) { toast(r.erinnert ? r.erinnert + ' Kunden erinnert.' : 'Heute schon erinnert.'); }); }; });
      [].forEach.call(el.querySelectorAll('[data-ab]'), function (b) { b.onclick = function () { api('/partner/aufgaben/' + b.getAttribute('data-ab') + '/abschliessen', { method: 'POST' }).then(function () { aufgabenZeichnen(el); }); }; });
    });
  }
  function aufgabeDialog(el) {
    var kunden = (S.partner.kunden || []).filter(function (k) { return !k.getrennt_am; });
    var jahr = new Date().getFullYear() - 1;
    dialog('Neue Aufgabe',
      '<label class="pk-feld">Vorlage<select id="pk-a-art"><option value="steuerjahr">Steuerjahr fertigstellen und senden</option><option value="bestand_senden">Bestand prüfen und senden</option><option value="frei">Freie Bitte</option></select></label>' +
      '<label class="pk-feld">Titel<input type="text" id="pk-a-titel" maxlength="200" value="Steuerjahr ' + jahr + ' fertigstellen"></label>' +
      '<label class="pk-feld">Text an die Kunden<textarea id="pk-a-text" maxlength="4000">Bitte alle Bestandsobjekte für das Steuerjahr ' + jahr + ' fertig machen und an uns senden.</textarea></label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="pk-feld">Steuerjahr<input type="number" id="pk-a-jahr" value="' + jahr + '"></label><label class="pk-feld">Fällig am<input type="date" id="pk-a-faellig"></label></div>' +
      '<label class="pk-feld">Welche Objekte<select id="pk-a-filter"><option value="bestand">nur Bestand</option><option value="alle">alle</option><option value="ankauf">nur Ankauf</option></select></label>' +
      '<div class="pk-gruppe">An welche Kunden</div><label class="pk-schalter"><span><b>Alle verbundenen Kunden</b></span><input type="checkbox" id="pk-a-alle" checked></label>' +
      kunden.map(function (k) { return '<label class="pk-schalter"><span>' + esc(k.display_name) + '</span><input type="checkbox" data-kunde="' + k.id + '" checked></label>'; }).join(''),
      [{ t: 'Abbrechen' }, { t: 'Senden', c: 'gold', fn: function (d) {
        var ids = [].filter.call(d.querySelectorAll('[data-kunde]'), function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-kunde'); });
        if (!ids.length) { toast('Bitte mindestens einen Kunden wählen.'); return false; }
        return api('/partner/aufgaben', { method: 'POST', body: { art: wert(d, '#pk-a-art'), titel: wert(d, '#pk-a-titel'), text: wert(d, '#pk-a-text'), steuerjahr: wert(d, '#pk-a-jahr'),
          faellig_am: wert(d, '#pk-a-faellig') || null, objektfilter: wert(d, '#pk-a-filter'), kunden: ids } }).then(function (r) { toast('Aufgabe an ' + r.kunden_anzahl + ' Kunden gesendet.'); aufgabenZeichnen(el); });
      } }]).querySelector('#pk-a-alle').onchange = function (e) { [].forEach.call(document.querySelectorAll('#dppk-dlg [data-kunde]'), function (x) { x.checked = e.target.checked; }); };
  }

  function meldungenZeichnen(el, neu) {
    api('/partner/meldungen').then(function (r) {
      var l = r.meldungen || [];
      el.innerHTML = l.length ? l.map(function (m) {
        return '<div class="pk-zeile"><div class="pk-name"><b>' + esc(m.text || m.art) + '</b><small>' + new Date(m.erstellt_am).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</small></div>' + (m.gelesen_am ? '' : '<span class="pk-chip gruen">neu</span>') + '</div>';
      }).join('') : '<div class="pk-leer">Keine Meldungen.</div>';
      if (l.some(function (m) { return !m.gelesen_am; })) api('/partner/meldungen/gelesen', { method: 'POST' }).then(function () { if (S.partner) S.partner.meldungen_ungelesen = 0; menuePflegen(); }).catch(function () {});
    });
  }

  /* ════ MEIN PARTNER (Kunde) ═════════════════════════════════════════════ */
  function meinPartnerOeffnen(start) {
    return api('/mein-partner').then(function (m) {
      S.kunde = m; menuePflegen(); rechteAnwenden();
      var v = m.verbunden;
      if (!v) {
        return ansichtOeffnen('Mein Partner', 'Mit einem Partner verbinden', [{ k: 'verbinden', t: 'Verbinden', zahl: m.anfragen.length }], function (k, el) { verbindenZeichnen(el); });
      }
      var offen = (m.aufgaben || []).filter(function (a) { return a.status !== 'erledigt' && a.status !== 'abgelehnt'; }).length;
      var reiter = [{ k: 'senden', t: 'An Partner senden' }, { k: 'sendungen', t: 'Meine Sendungen' }, { k: 'aufgaben', t: 'Aufgaben', zahl: offen }, { k: 'verbindung', t: 'Verbindung' }];
      if (start) reiter.sort(function (a) { return a.k === start ? -1 : 0; });
      ansichtOeffnen('Mein Partner', v.partner_name, reiter, function (k, el, neu) {
        if (k === 'senden') return sendenZeichnen(el, neu);
        if (k === 'sendungen') return sendungenZeichnen(el);
        if (k === 'aufgaben') return kundeAufgabenZeichnen(el);
        if (k === 'verbindung') return verbindungZeichnen(el);
      });
    }, function (e) { toast(fehlerText(e)); });
  }

  function objekteHolen() {
    return api('/objects?limit=500').then(function (r) { var l = Array.isArray(r) ? r : (r.items || r.objects || r.data || []); S.objekte = l; return l; });
  }

  function sendenZeichnen(el, neu, vorwahl) {
    var v = S.kunde.verbunden;
    if (v.entzug_frist_bis) { el.innerHTML = '<div class="pk-hinweis rot">Dein Partnerplatz wurde entzogen. Bis ' + datum(v.entzug_frist_bis) + ' kannst du deine Daten exportieren oder ein eigenes Abo abschließen. In der Zeit ist Senden nicht möglich.</div>'; return; }
    if (v.rechte && v.rechte.senden === false) { el.innerHTML = '<div class="pk-hinweis">Dein Partner hat das Senden für dein Konto ausgeschaltet.</div>'; return; }
    objekteHolen().then(function (l) {
      var gesendet = {}; (S.kunde.sendungen || []).forEach(function (s) { gesendet[s.object_id] = s; });
      el.innerHTML = '<div class="pk-hinweis">Gesendet wird eine <b>Kopie</b> wie ein Export. ' + esc(v.partner_name) + ' sieht nur, was du sendest, nie deine übrigen Objekte. Senden ändert den Status des Objekts nicht. Erneut senden ersetzt den Stand beim Partner, zurückziehen löscht ihn dort.</div>' +
        '<label class="pk-schalter" style="border:1px solid #EDE6D6;border-radius:10px;padding:10px 12px;margin-bottom:10px;background:#fff"><span><b>Gesamter Bestand</b><small>alle ' + l.length + ' Objekte</small></span><input type="checkbox" id="pk-s-alle"></label>' +
        (l.length ? l.map(function (o) {
          var g = gesendet[o.id], ch = vorwahl ? vorwahl(o) : false;
          return '<label class="pk-zeile" style="cursor:pointer"><input type="checkbox" data-obj="' + o.id + '"' + (ch ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:' + G + '"><div class="pk-name"><b>' + esc(o.name || o.seq_no || 'Objekt') + '</b><small>' + esc([o.seq_no, o.ort].filter(Boolean).join(' · ')) + '</small></div>' +
            (o.deal_won ? '<span class="pk-chip">Bestand</span>' : o.deal_lost ? '<span class="pk-chip grau">verloren</span>' : '<span class="pk-chip grau">Ankauf</span>') +
            (g ? '<span class="pk-chip ' + (g.seitdem_geaendert ? 'rot' : 'gruen') + '">Stand ' + g.stand_nr + ' vom ' + datum(g.stand_am) + (g.seitdem_geaendert ? ', seitdem geändert' : '') + '</span>' : '') + '</label>';
        }).join('') : '<div class="pk-leer">Du hast noch keine Objekte.</div>') +
        '<div class="pk-leiste" style="margin-top:12px"><button type="button" class="pk-btn gold" data-a="senden">An Partner senden</button></div>';
      var alle = el.querySelector('#pk-s-alle');
      alle.onchange = function () { [].forEach.call(el.querySelectorAll('[data-obj]'), function (x) { x.checked = alle.checked; }); };
      el.querySelector('[data-a="senden"]').onclick = function () {
        var ids = [].filter.call(el.querySelectorAll('[data-obj]'), function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-obj'); });
        if (!ids.length) return toast('Bitte mindestens ein Objekt wählen.');
        sendenDialog(ids, alle.checked, null, function () { meinPartnerOeffnen('sendungen'); });
      };
    });
  }

  function sendenDialog(ids, bestand, aufgabeId, danach) {
    var v = S.kunde.verbunden;
    dialog('An Partner senden', '<p>' + (bestand ? 'Dein gesamter Bestand (' + ids.length + ' Objekte)' : (ids.length === 1 ? 'Ein Objekt' : ids.length + ' Objekte')) + ' gehen als Kopie an <b>' + esc(v.partner_name) + '</b>.</p>' +
      '<div class="pk-hinweis">Dein Partner kann die Kopie laden, rechnen, PDFs erstellen und als eigenes Objekt übernehmen. Eine übernommene Kopie bleibt bei ihm, auch wenn du später zurückziehst. Deine Originale ändert er nie.</div>',
      [{ t: 'Abbrechen' }, { t: 'Senden', c: 'gold', fn: function () {
        return api('/mein-partner/senden', { method: 'POST', body: bestand ? { bestand: true, aufgabe_id: aufgabeId } : { object_ids: ids, aufgabe_id: aufgabeId } })
          .then(function (r) { toast(r.gesendet + (r.gesendet === 1 ? ' Objekt' : ' Objekte') + ' gesendet.'); if (danach) danach(); });
      } }]);
  }

  function sendungenZeichnen(el) {
    var l = S.kunde.sendungen || [];
    el.innerHTML = l.length ? l.map(function (s) {
      return '<div class="pk-zeile"><div class="pk-name"><b>' + esc(s.name || s.seq_no || 'Objekt') + '</b><small>Stand ' + s.stand_nr + ' vom ' + datum(s.stand_am) + (s.gelesen_am ? ' · vom Partner geöffnet' : ' · noch nicht geöffnet') + '</small></div>' +
        (s.seitdem_geaendert ? '<span class="pk-chip rot">seitdem geändert</span>' : '<span class="pk-chip gruen">aktuell</span>') +
        '<button type="button" class="pk-btn klein" data-neu="' + s.object_id + '">Neuen Stand senden</button><button type="button" class="pk-btn klein rot" data-zz="' + s.id + '">Zurückziehen</button></div>';
    }).join('') : '<div class="pk-leer">Du hast noch nichts gesendet.</div>';
    [].forEach.call(el.querySelectorAll('[data-neu]'), function (b) { b.onclick = function () { sendenDialog([b.getAttribute('data-neu')], false, null, function () { meinPartnerOeffnen('sendungen'); }); }; });
    [].forEach.call(el.querySelectorAll('[data-zz]'), function (b) {
      b.onclick = function () {
        dialog('Zurückziehen', '<p>Die Kopie beim Partner wird gelöscht. PDFs, die er schon heruntergeladen hat, oder eine Kopie, die er als eigenes Objekt übernommen hat, bleiben bei ihm.</p>',
          [{ t: 'Abbrechen' }, { t: 'Zurückziehen', c: 'rot', fn: function () { return api('/mein-partner/sendungen/' + b.getAttribute('data-zz') + '/zurueckziehen', { method: 'POST' }).then(function () { toast('Zurückgezogen.'); meinPartnerOeffnen('sendungen'); }); } }]);
      };
    });
  }

  function kundeAufgabenZeichnen(el) {
    var l = S.kunde.aufgaben || [];
    el.innerHTML = l.length ? l.map(function (a) {
      var s = AUFG_STATUS[a.status] || [a.status, 'grau'];
      return '<div class="pk-zeile" style="display:block"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="pk-name"><b>' + esc(a.titel) + '</b><small>' + (a.faellig_am ? 'fällig ' + datum(a.faellig_am) : 'ohne Frist') + '</small></div><span class="pk-chip ' + s[1] + '">' + s[0] + '</span></div>' +
        (a.text ? '<p style="margin:8px 0;font-size:13px;line-height:1.5">' + esc(a.text) + '</p>' : '') +
        (a.status === 'erledigt' || a.status === 'abgelehnt' ? '' : '<div class="pk-leiste" style="margin:8px 0 0">' +
          (a.status !== 'in_arbeit' ? '<button type="button" class="pk-btn klein" data-st="in_arbeit" data-id="' + a.id + '">Ich bin dran</button>' : '') +
          '<button type="button" class="pk-btn klein gold" data-send="' + a.id + '" data-f="' + esc(a.objektfilter) + '">Erledigt und senden</button>' +
          '<button type="button" class="pk-btn klein" data-st="erledigt" data-id="' + a.id + '">Erledigt ohne Senden</button>' +
          '<button type="button" class="pk-btn klein rot" data-ab="' + a.id + '">Ablehnen</button></div>') + '</div>';
    }).join('') : '<div class="pk-leer">Keine Aufgaben von deinem Partner.</div>';
    l.forEach(function (a) { if (a.status === 'offen') api('/mein-partner/aufgaben/' + a.id, { method: 'POST', body: { status: 'gesehen' } }).catch(function () {}); });
    [].forEach.call(el.querySelectorAll('[data-st]'), function (b) { b.onclick = function () { api('/mein-partner/aufgaben/' + b.getAttribute('data-id'), { method: 'POST', body: { status: b.getAttribute('data-st') } }).then(function () { meinPartnerOeffnen('aufgaben'); }); }; });
    [].forEach.call(el.querySelectorAll('[data-ab]'), function (b) {
      b.onclick = function () {
        dialog('Aufgabe ablehnen', '<label class="pk-feld">Ein Satz für deinen Partner<input type="text" id="pk-ab-grund" maxlength="300"></label>',
          [{ t: 'Abbrechen' }, { t: 'Ablehnen', c: 'rot', fn: function (d) { return api('/mein-partner/aufgaben/' + b.getAttribute('data-ab'), { method: 'POST', body: { status: 'abgelehnt', grund: wert(d, '#pk-ab-grund') } }).then(function () { meinPartnerOeffnen('aufgaben'); }); } }]);
      };
    });
    [].forEach.call(el.querySelectorAll('[data-send]'), function (b) {
      b.onclick = function () {
        var f = b.getAttribute('data-f'), aid = b.getAttribute('data-send');
        objekteHolen().then(function (l2) {
          var ids = l2.filter(function (o) { return f === 'alle' ? true : f === 'bestand' ? !!o.deal_won : (!o.deal_won && !o.deal_lost); }).map(function (o) { return o.id; });
          if (!ids.length) return toast('Keine passenden Objekte gefunden.');
          sendenDialog(ids, false, aid, function () { meinPartnerOeffnen('aufgaben'); });
        });
      };
    });
  }

  function verbindungZeichnen(el) {
    var v = S.kunde.verbunden;
    var zug = v.platz_art === 'platz'
      ? '<b>Partnerplatz.</b> ' + esc(v.partner_name) + ' bezahlt deinen Zugang und hat die Stufe <b>' + esc(v.stufe_text || 'Fortgeschritten') + '</b> gewählt.'
      : '<b>Eigener Plan.</b> Du bezahlst selbst. ' + esc(v.partner_name) + ' bestimmt nichts an deinem Konto.';
    var aus = v.rechte ? RECHTE_TEXT.filter(function (x) { return v.rechte[x[0]] === false; }).map(function (x) { return x[1]; }) : [];
    el.innerHTML = '<div class="pk-hinweis">' + zug + ' Verbunden seit ' + datum(v.verbunden_am) + '.</div>' +
      (v.entzug_frist_bis ? '<div class="pk-hinweis rot">Dein Partnerplatz wurde entzogen. Bis <b>' + datum(v.entzug_frist_bis) + '</b> kannst du deine Daten exportieren oder ein eigenes Abo abschließen, dann bleibt alles erhalten. Ohne eigenes Abo werden danach dein Konto und deine Daten gelöscht.</div>' : '') +
      (aus.length ? '<div class="pk-gruppe">Von deinem Partner ausgeschaltet</div><div style="font-size:13px;line-height:1.6">' + aus.map(esc).join(', ') + '</div>' : '') +
      (v.platz_art === 'eigen' ? '<div class="pk-gruppe">Marke</div><label class="pk-wahl"><input type="radio" name="pk-m" value="dealpilot"' + (v.marke !== 'partner' ? ' checked' : '') + '><span><b>DealPilot</b></span></label>' +
        '<label class="pk-wahl"><input type="radio" name="pk-m" value="partner"' + (v.marke === 'partner' ? ' checked' : '') + '><span><b>Marke von ' + esc(v.partner_name) + '</b></span></label>' : '') +
      '<div class="pk-gruppe">Verbindung</div><div class="pk-leiste">' + (v.entzug_frist_bis || v.platz_art === 'platz' ? '<button type="button" class="pk-btn" data-a="abo">Eigenes Abo abschließen</button>' : '') +
      '<button type="button" class="pk-btn" data-a="export">Meine Daten exportieren</button><button type="button" class="pk-btn rot" data-a="trennen">Verbindung trennen</button></div>';
    [].forEach.call(el.querySelectorAll('input[name="pk-m"]'), function (r) { r.onchange = function () { api('/mein-partner/marke', { method: 'PUT', body: { marke: r.value } }).then(function () { toast('Gespeichert. Die Marke wechselt beim nächsten Laden.'); }); }; });
    var abo = el.querySelector('[data-a="abo"]'); if (abo) abo.onclick = function () { var ov = document.getElementById('dppk-ov'); if (ov) ov.remove(); try { if (typeof showSettings === 'function') showSettings('plan'); } catch (e) {} };
    el.querySelector('[data-a="export"]').onclick = function () { try { if (typeof exportAllObjectsJson === 'function') exportAllObjectsJson(); else toast('Export unter Aktionen › Export.'); } catch (e) {} };
    el.querySelector('[data-a="trennen"]').onclick = function () {
      dialog('Verbindung trennen', '<p>Die Verbindung zu <b>' + esc(v.partner_name) + '</b> wird getrennt. ' + (v.platz_art === 'platz' ? 'Dein Partnerplatz endet sofort, dein Konto fällt auf den Plan von vorher zurück (sonst Free). Deine Daten bleiben erhalten.' : 'Dein Konto und dein Plan bleiben unverändert.') + ' Kundenstände, die du gesendet hast, bleiben beim Partner, markiert als nicht mehr verbunden.</p>',
        [{ t: 'Abbrechen' }, { t: 'Trennen', c: 'rot', fn: function () { return api('/mein-partner/trennen', { method: 'POST' }).then(function () { toast('Verbindung getrennt.'); var ov = document.getElementById('dppk-ov'); if (ov) ov.remove(); setTimeout(function () { location.reload(); }, 700); }); } }]);
    };
  }

  function verbindenZeichnen(el) {
    var m = S.kunde;
    var h = '';
    if (m.anfragen.length) h += '<div class="pk-gruppe">Anfragen</div>' + m.anfragen.map(function (a) { return '<div class="pk-zeile"><div class="pk-name"><b>' + esc(a.partner_name) + '</b><small>möchte sich mit dir verbinden · ' + datum(a.erstellt_am) + '</small></div><button type="button" class="pk-btn klein gold" data-anf="' + a.id + '">Ansehen</button></div>'; }).join('');
    h += '<div class="pk-gruppe">Verbindungscode für deinen Berater</div><div class="pk-hinweis">Erzeuge einen Code und gib ihn deinem Berater, zum Beispiel im Termin. Er gilt 24 Stunden und nur einmal. Danach siehst du hier eine Anfrage, die du bestätigst. Ohne deine Bestätigung entsteht keine Verbindung.</div>' +
      (m.code_gueltig_bis ? '<p style="font-size:13px">Ein Code ist gültig bis ' + new Date(m.code_gueltig_bis).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '. Ein neuer Code ersetzt ihn.</p>' : '') +
      '<div class="pk-leiste"><button type="button" class="pk-btn gold" data-a="code">Code erzeugen</button>' + (m.code_gueltig_bis ? '<button type="button" class="pk-btn" data-a="weg">Code löschen</button>' : '') + '</div>';
    el.innerHTML = h;
    [].forEach.call(el.querySelectorAll('[data-anf]'), function (b) { b.onclick = function () { anfrageDialog(m.anfragen.filter(function (a) { return a.id === b.getAttribute('data-anf'); })[0]); }; });
    el.querySelector('[data-a="code"]').onclick = function () {
      api('/mein-partner/code', { method: 'POST' }).then(function (r) {
        dialog('Dein Verbindungscode', '<div class="pk-code">' + esc(r.code) + '</div><p style="font-size:13px">Gültig bis ' + new Date(r.gueltig_bis).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '. Gib ihn nur deinem Berater. Er wird nicht noch einmal angezeigt.</p>', [{ t: 'Fertig', c: 'gold' }]);
        meinPartnerOeffnen();
      });
    };
    var w = el.querySelector('[data-a="weg"]'); if (w) w.onclick = function () { api('/mein-partner/code', { method: 'DELETE' }).then(function () { meinPartnerOeffnen(); }); };
  }

  function anfrageDialog(a) {
    if (!a) return;
    var platz = a.zugang === 'platz';
    dialog('Verbindung mit ' + a.partner_name,
      '<p><b>' + esc(a.partner_name) + '</b> möchte sich mit deinem DealPilot-Konto verbinden.</p>' +
      '<div class="pk-hinweis">' + (platz
        ? '<b>Partnerplatz.</b> Dein Partner bezahlt deinen Zugang (Investor-Umfang) und legt Stufe, Rechte und Marke fest. Er kann den Platz später entziehen, dann hast du 30 Tage Zeit für einen Export oder ein eigenes Abo.'
        : '<b>Eigener Plan.</b> Du behältst deinen Plan und alle Einstellungen. Dein Partner bestimmt nichts an deinem Konto.') + '</div>' +
      '<p style="font-size:13px;line-height:1.55">Dein Partner sieht <b>nur</b> Objekte, die du ihm ausdrücklich sendest, als Kopie. Er kann dir Aufgaben schicken. Du kannst die Verbindung jederzeit trennen.</p>',
      [{ t: 'Ablehnen', fn: function () { return api('/mein-partner/anfragen/' + a.id, { method: 'POST', body: { annehmen: false } }).then(function () { toast('Abgelehnt.'); bandPflegen(); }); } },
       { t: 'Verbindung bestätigen', c: 'gold', fn: function () { return api('/mein-partner/anfragen/' + a.id, { method: 'POST', body: { annehmen: true } }).then(function (r) { toast('Verbunden mit ' + r.partner_name + '.'); setTimeout(function () { location.reload(); }, 800); }); } }]);
  }

  /** Einladungslink eines bestehenden Kontos (reseller-portal.js handleInvite): erst fragen */
  function einladungFragen(token, info) {
    dialog('Einladung von ' + (info.brand_name || 'deinem Partner'),
      '<p><b>' + esc(info.brand_name || 'Dein Partner') + '</b> lädt dich ein, dein DealPilot-Konto zu verbinden.</p>' +
      '<div class="pk-hinweis">Dein Partner sieht nur Objekte, die du ihm ausdrücklich sendest, als Kopie. Hast du ein eigenes bezahltes Abo, bleibt es unverändert. Sonst bekommst du einen Partnerplatz, den dein Partner bezahlt. Du kannst die Verbindung jederzeit trennen.</div>',
      [{ t: 'Ablehnen', fn: function () { try { localStorage.removeItem('rp_invite_token'); } catch (e) {} urlAufraeumen(); } },
       { t: 'Verbindung bestätigen', c: 'gold', fn: function () {
         return api('/reseller-invite/accept', { method: 'POST', body: { token: token } }).then(function (r) {
           try { localStorage.removeItem('rp_invite_token'); } catch (e) {} urlAufraeumen();
           toast('Verbunden mit ' + (r && r.brand_name ? r.brand_name : 'deinem Partner') + '.'); setTimeout(function () { location.reload(); }, 800);
         });
       } }]);
  }
  function urlAufraeumen() { try { var q = new URLSearchParams(location.search); q.delete('rp_invite'); history.replaceState({}, '', location.pathname + (q.toString() ? '?' + q.toString() : '')); } catch (e) {} }

  /* ── Band (Anfrage, Aufgabe, Frist) ──────────────────────────────────── */
  function bandPflegen() {
    var b = document.getElementById('dppk-band'); if (b) b.remove();
    var m = S.kunde; if (!m) return;
    var gesehen = {}; try { gesehen = JSON.parse(sessionStorage.getItem('dppk_band_zu') || '{}'); } catch (e) {}
    var text = null, knopf = null, schl = null;
    if (m.anfragen && m.anfragen.length) { var a = m.anfragen[0]; schl = 'a' + a.id; text = '<b>' + esc(a.partner_name) + '</b> möchte sich mit dir verbinden.'; knopf = { t: 'Ansehen', fn: function () { anfrageDialog(a); } }; }
    else if (m.verbunden && m.verbunden.entzug_frist_bis) { schl = 'f'; text = 'Dein Partnerplatz endet. Frist bis <b>' + datum(m.verbunden.entzug_frist_bis) + '</b>.'; knopf = { t: 'Was jetzt?', fn: function () { meinPartnerOeffnen('verbindung'); } }; }
    else if (m.aufgaben && m.aufgaben.some(function (x) { return x.status === 'offen'; })) { var x = m.aufgaben.filter(function (y) { return y.status === 'offen'; })[0]; schl = 'g' + x.id; text = 'Neue Aufgabe von <b>' + esc(m.verbunden.partner_name) + '</b>: ' + esc(x.titel); knopf = { t: 'Öffnen', fn: function () { meinPartnerOeffnen('aufgaben'); } }; }
    if (!text || gesehen[schl]) return;
    stil();
    b = document.createElement('div'); b.id = 'dppk-band';
    b.innerHTML = '<span style="flex:1 1 240px">' + text + '</span><button type="button" class="pk-btn" data-a="go">' + esc(knopf.t) + '</button><button type="button" class="pk-btn leer" data-a="zu">Später</button>';
    document.body.appendChild(b);
    b.querySelector('[data-a="go"]').onclick = function () { b.remove(); knopf.fn(); };
    b.querySelector('[data-a="zu"]').onclick = function () { gesehen[schl] = 1; try { sessionStorage.setItem('dppk_band_zu', JSON.stringify(gesehen)); } catch (e) {} b.remove(); };
  }

  /* ── Aktionen-Eintraege ──────────────────────────────────────────────── */
  function menuePflegen() {
    stil();
    var p = document.querySelector('.sb-act-partner'), k = document.querySelector('.sb-act-meinpartner');
    if (p) { p.classList.toggle('dp-frei', !!S.partner); p.classList.toggle('dp-punkt', !!(S.partner && (S.partner.meldungen_ungelesen || S.partner.anfragen && 0))); }
    if (k) {
      var m = S.kunde, offen = !!(m && ((m.anfragen && m.anfragen.length) || (m.verbunden && (m.verbunden.entzug_frist_bis || (m.aufgaben || []).some(function (a) { return a.status === 'offen'; })))));
      k.classList.toggle('dp-frei', !!(m && m.verbunden));
      k.classList.toggle('dp-punkt', offen);
    }
  }

  /* ── Rechte des Partnerplatzes in der App ────────────────────────────── */
  var _wraps = false;
  function darf(recht) { var v = S.kunde && S.kunde.verbunden; return !(v && v.rechte && v.rechte[recht] === false); }
  function rechteAnwenden() {
    var v = S.kunde && S.kunde.verbunden;
    var b = document.body; if (!b) return;
    ['pdf', 'bankpdf', 'markt', 'ki', 'schluessel', 'telegram', 'senden', 'e_steuer', 'e_finanz', 'e_darstellung'].forEach(function (r) {
      b.classList.toggle('dppk-aus-' + r, !!(v && v.rechte && v.rechte[r] === false));
    });
    /* Stufe: der Detailgrad darf hoechstens so hoch sein, wie der Partner ihn gewaehlt hat */
    try {
      if (v && v.stufe && window.DpDetailgrad && typeof DpDetailgrad.stufe === 'function' && DpDetailgrad.stufe() > v.stufe) DpDetailgrad.setzen(v.stufe);
    } catch (e) {}
    if (_wraps) return; _wraps = true;
    function sperre(name, recht, text) {
      var alt = window[name]; if (typeof alt !== 'function' || alt._dppk) return;
      var neu = function () { if (!darf(recht)) { toast(text); return; } return alt.apply(this, arguments); };
      neu._dppk = true; window[name] = neu;
    }
    var T = 'Dein Partner hat diese Funktion für dein Konto ausgeschaltet.';
    setTimeout(function () {
      ['exportPDF', 'exportWerbungskostenPDF', 'showTrackRecordView'].forEach(function (n) { sperre(n, 'pdf', T); });
      sperre('showBankexportView', 'bankpdf', T);
      sperre('dpMbAbrufZeigen', 'markt', T);
    }, 1500);
    try {
      if (window.DpDetailgrad && typeof DpDetailgrad.setzen === 'function' && !DpDetailgrad.setzen._dppk) {
        var s0 = DpDetailgrad.setzen;
        DpDetailgrad.setzen = function (n) { var vv = S.kunde && S.kunde.verbunden; if (vv && vv.stufe && Number(n) > vv.stufe) { toast('Dein Partner hat die Stufe ' + (STUFEN[vv.stufe] || '') + ' gewählt.'); n = vv.stufe; } return s0.call(this, n); };
        DpDetailgrad.setzen._dppk = true;
      }
    } catch (e) {}
  }

  /* ── Kundenstand beim Partner: nur lesen ─────────────────────────────── */
  function kundenstandPruefen() {
    var d = null;
    try { d = window._currentObjData || null; } catch (e) {}
    var ks = d && d._kundenstand;
    window._dppkKundenstand = ks || null;
    var alt = document.getElementById('dppk-ks');
    if (!ks) { if (alt) alt.remove(); return; }
    stil();
    if (!alt) {
      alt = document.createElement('div'); alt.id = 'dppk-ks';
      var ziel = document.querySelector('.main-col .body') || document.querySelector('.main-col') || document.body;
      ziel.insertBefore(alt, ziel.firstChild);
    }
    alt.innerHTML = '<span><b>Kundenstand von ' + esc(ks.kunde || 'Kunde') + '</b>, Stand ' + esc(ks.stand_nr) + ' vom ' + datum(ks.stand_am) + '. Nur lesen, Änderungen werden nicht gespeichert.</span>' +
      '<button type="button" class="pk-btn">Als eigenes Objekt übernehmen</button>';
    alt.querySelector('.pk-btn').onclick = function () {
      api('/partner/kundenstaende/' + ks.share_id + '/uebernehmen', { method: 'POST' }).then(function (r) { toast('Übernommen als ' + (r.seq_no || 'neues Objekt') + '.'); if (typeof window.loadSaved === 'function') window.loadSaved(r.object_id); try { if (typeof renderSaved === 'function') renderSaved(); } catch (e) {} }, function (e) { toast(fehlerText(e)); });
    };
  }
  function speichernSperren() {
    if (typeof window.saveObj !== 'function' || window.saveObj._dppk) return false;
    var alt = window.saveObj;
    var neu = function () { if (window._dppkKundenstand) { return Promise.resolve(null); } return alt.apply(this, arguments); };
    for (var k in alt) { try { if (Object.prototype.hasOwnProperty.call(alt, k)) neu[k] = alt[k]; } catch (e) {} }
    neu._dppk = true; window.saveObj = neu; return true;
  }
  function ladenBeobachten() {
    if (typeof window.loadSaved !== 'function' || window.loadSaved._dppk) return false;
    var alt = window.loadSaved;
    var neu = function () { var r = alt.apply(this, arguments); Promise.resolve(r).then(function () { setTimeout(kundenstandPruefen, 50); }); return r; };
    neu._dppk = true; window.loadSaved = neu; return true;
  }

  /* ── Partnerzeile in der Status-Tafel ────────────────────────────────── */
  function partnerzeile() {
    var t = document.querySelector('.dab-tafel'); if (!t) return;
    var z = t.querySelector('.dab-partnerzeile');
    var v = S.kunde && S.kunde.verbunden;
    var id = window._currentObjKey;
    if (!v || !id || window._dppkKundenstand || v.entzug_frist_bis || !darf('senden')) { if (z) z.remove(); return; }
    var s = (S.kunde.sendungen || []).filter(function (x) { return x.object_id === id; })[0];
    var html = '<span class="dab-row-dot"></span><div><b>' + (s ? 'Neuen Stand an ' : 'An ') + esc(v.partner_name) + ' senden</b><small>' +
      (s ? 'Stand ' + s.stand_nr + ' vom ' + datum(s.stand_am) + ' liegt beim Partner' + (s.seitdem_geaendert ? ', seitdem geändert' : '') + '.' : 'Als Kopie, der Status des Objekts bleibt.') + '</small></div>';
    if (!z) {
      z = document.createElement('div'); z.className = 'dab-partnerzeile dab-row'; z.setAttribute('role', 'button'); z.tabIndex = 0;
      var anker = t.querySelector('#da-ankauf-frage'); (anker && anker.parentNode === t ? t.insertBefore(z, anker) : t.appendChild(z));
      z.onclick = function () { sendenDialog([window._currentObjKey], false, null, function () { api('/mein-partner').then(function (m) { S.kunde = m; partnerzeile(); }); }); };
      z.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') z.onclick(); };
    }
    if (z.innerHTML !== html) z.innerHTML = html;
  }

  /* ── Einstellungen: Zugang zum Verbindungscode auch ohne Verbindung ───── */
  function einstellungenErgaenzen() {
    var pane = document.querySelector('.st-pane[data-pane="account"]');
    if (!pane || pane.querySelector('#dppk-st')) return;
    var p = S.partner; if (p) return;   /* ein Partnerkonto verbindet sich nicht als Kunde */
    var c = document.createElement('div'); c.id = 'dppk-st';
    c.setAttribute('style', 'margin:16px 0;padding:12px 14px;border:1px solid #EDE2C6;border-radius:10px;background:#FBF6E9;font:400 13px Inter,sans-serif;color:#2A2727');
    var v = S.kunde && S.kunde.verbunden;
    c.innerHTML = '<b style="display:block;font:600 13px Inter;margin-bottom:4px">Partner</b>' + (v ? 'Verbunden mit ' + esc(v.partner_name) + '.' : 'Mit deinem Steuerberater, Makler oder Finanzierer verbinden, per Verbindungscode.') +
      ' <button type="button" style="margin-left:6px;border:1px solid #D9CFB8;background:#fff;border-radius:8px;padding:6px 11px;font:600 12px Inter;cursor:pointer">' + (v ? 'Mein Partner' : 'Verbindungscode erzeugen') + '</button>';
    c.querySelector('button').onclick = function () { meinPartnerOeffnen(); };
    pane.appendChild(c);
  }

  /* ── Seitenleiste des Partners: „Von Kunden freigegeben › Name“ (Konzept 5.4) ──
     Unter den eigenen Objekten, getrennt je Kunde, aufklappbar. Kundenstaende stehen nie in der Objektliste
     selbst (Backend schliesst sie aus), damit sie nicht mit eigenen Objekten verwechselt werden. */
  var _ksCache = null, _ksZeit = 0, _ksAuf = {};
  function sbGruppe() {
    if (!S.partner) return;
    var list = document.getElementById('sb-list'); if (!list || !list.parentNode) return;
    var jetzt = Date.now();
    var holen = (_ksCache && jetzt - _ksZeit < 60000) ? Promise.resolve(_ksCache) : api('/partner/kundenstaende').then(function (r) { _ksCache = r.kundenstaende || []; _ksZeit = Date.now(); return _ksCache; });
    holen.then(function (l) {
      var alt = document.getElementById('dppk-sbgruppe');
      if (!l.length) { if (alt) alt.remove(); return; }
      if (!alt) { alt = document.createElement('div'); alt.id = 'dppk-sbgruppe'; alt.setAttribute('style', 'margin:10px 0 6px;padding:0 4px'); }
      if (alt.parentNode !== list.parentNode || alt.previousSibling !== list) list.parentNode.insertBefore(alt, list.nextSibling);
      var g = {}; l.forEach(function (x) { (g[x.kunde] = g[x.kunde] || []).push(x); });
      alt.innerHTML = '<div style="font:600 10.5px JetBrains Mono,monospace;letter-spacing:.08em;text-transform:uppercase;color:' + G + ';margin:6px 6px 6px">Von Kunden freigegeben</div>' +
        Object.keys(g).map(function (kn) {
          var neu = g[kn].filter(function (x) { return !x.gelesen_am; }).length, auf = !!_ksAuf[kn];
          return '<div style="border:1px dashed color-mix(in srgb, ' + G + ' 55%, transparent);border-radius:10px;margin:0 0 8px;overflow:hidden">' +
            '<button type="button" data-kn="' + esc(kn) + '" style="width:100%;display:flex;align-items:center;gap:8px;background:transparent;border:0;color:inherit;padding:8px 10px;cursor:pointer;font:600 12.5px Inter,sans-serif;text-align:left">' +
            '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">› ' + esc(kn) + '</span>' + (neu ? '<span style="background:#3FA56C;color:#fff;border-radius:9px;padding:1px 7px;font:600 10.5px Inter">' + neu + ' neu</span>' : '') +
            '<span style="opacity:.7;font:500 11px Inter">' + g[kn].length + '</span></button>' +
            (auf ? g[kn].map(function (x) {
              return '<button type="button" data-ks="' + x.kopie_object_id + '" data-s="' + x.share_id + '" style="width:100%;display:block;text-align:left;background:transparent;border:0;border-top:1px solid rgba(255,255,255,.08);color:inherit;padding:7px 12px;cursor:pointer;font:400 12px Inter,sans-serif">' +
                '<b style="display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.name || x.seq_no || 'Objekt') + '</b><span style="opacity:.7">Stand ' + x.stand_nr + ' vom ' + datum(x.stand_am) + (x.gelesen_am ? '' : ' · neu') + '</span></button>';
            }).join('') : '') + '</div>';
        }).join('');
      [].forEach.call(alt.querySelectorAll('[data-kn]'), function (b) { b.onclick = function () { var k = b.getAttribute('data-kn'); _ksAuf[k] = !_ksAuf[k]; sbGruppe(); }; });
      [].forEach.call(alt.querySelectorAll('[data-ks]'), function (b) {
        b.onclick = function () {
          api('/partner/kundenstaende/' + b.getAttribute('data-s') + '/geoeffnet', { method: 'POST' }).then(function () { _ksZeit = 0; }).catch(function () {});
          try { if (typeof setMainView === 'function') setMainView('single'); } catch (e) {}
          if (typeof window.loadSaved === 'function') window.loadSaved(b.getAttribute('data-ks'));
        };
      });
    }).catch(function () {});
  }
  function renderBeobachten() {
    if (typeof window.renderSaved !== 'function' || window.renderSaved._dppk) return false;
    var alt = window.renderSaved;
    var neu = function () { var r = alt.apply(this, arguments); Promise.resolve(r).then(function () { setTimeout(sbGruppe, 30); }); return r; };
    for (var k in alt) { try { if (Object.prototype.hasOwnProperty.call(alt, k)) neu[k] = alt[k]; } catch (e) {} }
    neu._dppk = true; window.renderSaved = neu; return true;
  }

  /* ── Start ───────────────────────────────────────────────────────────── */
  var _gestartet = false;
  function start() {
    if (_gestartet) return;
    var t = null; try { t = localStorage.getItem('ji_token'); } catch (e) {}
    if (!t || !window.Auth || !Auth.apiCall) return;
    _gestartet = true;
    stil();
    api('/mein-partner').then(function (m) { S.kunde = m; menuePflegen(); rechteAnwenden(); bandPflegen(); partnerzeile(); }).catch(function () {});
    api('/partner/cockpit').then(function (c) { S.partner = c; menuePflegen(); sbGruppe(); }).catch(function () { S.partner = null; menuePflegen(); });
    var n = 0, iv = setInterval(function () { var a = speichernSperren(), b = ladenBeobachten(); renderBeobachten(); if ((a || window.saveObj && window.saveObj._dppk) && (b || window.loadSaved && window.loadSaved._dppk) || ++n > 40) clearInterval(iv); }, 500);
    new MutationObserver(function () {
      if (document.querySelector('.dab-tafel') && !document.querySelector('.dab-tafel .dab-partnerzeile') && S.kunde && S.kunde.verbunden) partnerzeile();
      if (document.querySelector('.st-pane[data-pane="account"]') && !document.getElementById('dppk-st')) einstellungenErgaenzen();
    }).observe(document.body, { childList: true, subtree: true });
    setInterval(function () { try { if (window._currentObjKey !== _letztesObj) { _letztesObj = window._currentObjKey; kundenstandPruefen(); partnerzeile(); } } catch (e) {} }, 1200);
  }
  var _letztesObj = null;
  function warteAufAnmeldung() { start(); if (!_gestartet) setTimeout(warteAufAnmeldung, 1500); }
  document.addEventListener('dp:plan-ready', start);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(warteAufAnmeldung, 800); }); else setTimeout(warteAufAnmeldung, 800);

  window.DpPartnerKunden = { cockpitOeffnen: cockpitOeffnen, meinPartnerOeffnen: meinPartnerOeffnen, einladungFragen: einladungFragen, darf: darf, _state: S };
  window.DpMeinPartner = { einladungFragen: einladungFragen };
})();
