/* partner-kunden.js · v3357 — Partner-Cockpit und „Mein Partner“ (Konzept Dateien/Mandantenkonzept/Mandantenkonzept-Partner-2026-11-13.md)
 *
 * v3390 · Das Partner-Cockpit ist kein Fenster mehr, sondern eine Hauptansicht im Arbeitsbereich (Marcel 15.11.2026:
 *   „im Arbeitsbereich angezeigt … nicht die Tabbar von Objekt bis Deal-Aktion, sondern nur das Partner-Cockpit“).
 *   Die Reiterleiste nav.tabs schwenkt um: ihre .tab-Knoepfe werden per html[data-pk-offen] ausgeblendet, davor steht
 *   #dppk-tabzeile mit den Cockpit-Reitern (Klasse dppk-tab, NIE .tab - ui.js/main.js/pdf.js zaehlen .tab nach Index).
 *   Die Optik der Reiter wird beim Oeffnen von einem echten .tab abgelesen (getComputedStyle), damit sie in jedem
 *   Skin und jeder Layout-Variante gleich aussieht. Angemeldet im Register DealPilotAnsichten als 'partner'.
 *   Reiter „Verwaltung“ (v3392): eigene Oberflaeche fuer Plaetze, Marke, Abrechnung; die Logik (Pool, Staffel, Stripe-Kauf,
 *   Marken-Formular und Speichern) kommt aus reseller-portal.js. Uebersicht, Freigaben, Übergeben stehen dort NICHT.
 *   „Mein Partner“ (Kundenseite) bleibt ein Fenster.
 *
 * Backend: /api/v1/partner/* (Partnerseite), /api/v1/mein-partner/* (Kundenseite), services/partnerKunden.js.
 *
 *   - Zwei Eintraege unter „Aktionen“ (index.html, .sb-act-partner / .sb-act-meinpartner), sichtbar nur mit Klasse dp-frei
 *   - Partner-Cockpit: Kunden und Plaetze, Einladen, Code einloesen, Stufe und Rechte, Platzentzug, Kundenstaende, Aufgaben, Meldungen
 *   - Mein Partner: Senden (einzeln, mehrere, Bestand), Sendungen, Aufgaben, Verbindung, Verbindungscode
 *   - Bestaetigung jeder Verbindung durch den Kunden (Band + Fenster), auch fuer Einladungslinks bestehender Konten
 *   - Rechte des Partnerplatzes wirken in der App (Knoepfe weg, Funktionen gesperrt), Stufe begrenzt den Detailgrad
 *   - Kundenstand beim Partner: Band „nur lesen“, Speichern ausgesetzt
 *
 * v3460 · Schalter „E-Mail an den Kunden bei Rückmeldung“ im Kundendialog (beide Zugangsarten, reseller_clients.mail_rueckmeldung,
 *   Vorgabe an). Link aus der Mail: ?dp_partner=aufgaben oeffnet nach der Anmeldung Mein Partner › Aufgaben.
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
    var R = [
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
      /* v3640 · Rueckfrage des Kunden (offen mit Antwort) sichtbar anders als erledigt; Kundennummer als ruhiges Etikett */
      '#dppk-ov .pk-chip.frage{background:#EAF1F8;border-color:#BCD0E6;color:#2F5D8A}',
      '#dppk-ov .pk-nr{display:inline-block;font:600 11px "JetBrains Mono",monospace;letter-spacing:.03em;color:#6B5A2A;background:#FBF6E9;border:1px solid #E2D7BE;border-radius:5px;padding:1px 6px;margin-right:6px;vertical-align:1px;white-space:nowrap}',
      '.pk-fehlen{border:1px solid #E3C2BF;background:#F8ECEB;color:#94433E;border-radius:8px;padding:8px 10px;font-size:12.5px;line-height:1.5;margin:6px 0}',
      '.pk-fehlen button{border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;font:600 12.5px Inter,sans-serif;padding:0}',
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
      '#dppk-ks .dppk-ks-text{flex:1 1 260px;min-width:0}',
      '#dppk-ks .dppk-ks-knoepfe,#dppk-ks .dppk-anm-knoepfe{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '#dppk-ks .pk-btn2{border:1px solid #D9CFB8;background:#fff;color:#2A2727;border-radius:8px;padding:6px 10px;font:600 12px Inter,sans-serif;cursor:pointer;white-space:nowrap}',
      '#dppk-ks .pk-btn2.gold{background:' + G + ';border-color:' + G + ';color:#fff}',
      '#dppk-ks .pk-btn2[disabled]{opacity:.5;cursor:default}',
      '@media (max-width:640px){#dppk-ks{margin:6px 8px;padding:8px 10px}#dppk-ks .pk-btn{margin-left:0}#dppk-ks .pk-btn2,#dppk-ks .pk-btn{min-height:36px}}',
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
    ];
    /* v3390 · Arbeitsbereich: dieselben Bausteine wie im Fenster, nur unter #dppk-ab (eine Liste, zwei Anker) */
    var ab = R.filter(function (x) { return x.indexOf('#dppk-ov .') === 0 || x.indexOf('#dppk-ov label') === 0; })
      .map(function (x) { return x.split('#dppk-ov').join('#dppk-ab'); });
    s.textContent = R.concat(ab, [
      /* v3640c · RND-Bausteine (css/rnd-styles.css) auch im Arbeitsbereich: dieselbe Huelle, nur ohne Ueberlagerung */
      '.rnd-wiz-overlay.rnd-hub.dppk-hub-inline{position:static !important;inset:auto !important;background:none !important;backdrop-filter:none !important;padding:0 !important;z-index:auto !important;animation:none !important;display:block !important}',
      '.dppk-hub-inline .rnd-wiz-modal{max-width:none !important;max-height:none !important;box-shadow:none !important}',
      '.dppk-hub .dppk-hub-reiter[hidden]{display:none !important}',
      '.dppk-hub .dppk-hub-reiter{display:flex;flex-direction:column;gap:14px}',
      '#dppk-hub-kunde .rnd-wiz-modal{max-width:760px}',
      'html:not(#rnd-nie) .rnd-wiz-overlay.rnd-hub.dppk-hub .rnd-hub-zeile{padding:8px 0 !important}',
      '.dppk-hub .rnd-hub-chips.dppk-fest .rnd-hub-chip{cursor:default !important}',
      '.dppk-hub .rnd-hub-chips.dppk-fest .rnd-hub-chip:not(:has(input:checked)){opacity:.55}',
      'html:not([data-pk-offen]) #dppk-ab{display:none !important}',
      'html[data-pk-offen] nav.tabs > :not(#dppk-tabzeile){display:none !important}',
      /* v3450 · Marcel 15.11.: „Im Partner-Cockpit steht immer die Pille Ist · heute | Soll · Ankauf-Stand …“ - alles, was zum
         geladenen Objekt gehoert, steht hinter dem Cockpit nicht (nach „← Objekte“ wieder da, die Regel haengt nur am Attribut) */
      'html[data-pk-offen] .main-col .body > .sec{display:none !important}',   /* v3452 · ein Objekt, das im Hintergrund laedt, stellt .sec wieder auf display:'' */
      'html[data-pk-offen] #ank-ansicht-host,html[data-pk-offen] #dppk-ks,html[data-pk-offen] #dppk-anm-liste,html[data-pk-offen] #dppk-anm-layer{display:none !important}',
      /* gemessen 15.11. bei offenem Cockpit (1280 px, Objekt mit Ankauf-Stand): im Kopf standen weiter Objektnummer, Anschrift,
         „Gespeichert …“, „Ziel 8 %“ und „21 / 24 Felder“ des zuletzt geladenen Objekts. Das Kontingent bleibt, es gehoert zum Konto. */
      'html[data-pk-offen] #hdr-obj-num,html[data-pk-offen] .hdr-v61-row1 > .hdr-sep,html[data-pk-offen] #hdr-obj,html[data-pk-offen] #hdr-autosave,html[data-pk-offen] .hdr-ziel-mini,html[data-pk-offen] #hdr-completeness,html[data-pk-offen] .tabs-status-badge,html[data-pk-offen] #hdr-toggle-btn,html[data-pk-offen] header.hdr [class*="score"]{display:none !important}',
      'html:not([data-pk-offen]) #dppk-hdr-titel{display:none !important}',
      '#dppk-hdr-titel{font:600 15px "Space Grotesk",Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
      '#dppk-hdr-titel small{font:500 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin-right:8px}',
      'html:not([data-pk-offen]) #dppk-tabzeile{display:none !important}',
      '#dppk-tabzeile{display:flex;align-items:stretch;flex:0 0 auto;min-width:0}',
      '#dppk-tabzeile .dppk-tab{display:flex;align-items:center;gap:6px;border:0;border-bottom:1px solid transparent;background:transparent;cursor:pointer;white-space:nowrap;flex:0 0 auto;font-family:Inter,sans-serif}',
      '#dppk-tabzeile .dppk-tab svg{flex:0 0 auto}',
      '#dppk-tabzeile .dppk-zurueck{opacity:.8}',
      '#dppk-tabzeile .dppk-zurueck svg{transform:scaleX(-1)}',
      '#dppk-tabzeile .dppk-trenner{flex:0 0 1px;align-self:center;height:18px;background:currentColor;opacity:.2;margin:0 6px}',
      '#dppk-tabzeile .pk-zahl{display:inline-block;min-width:17px;height:17px;line-height:17px;border-radius:9px;background:#B8625C;color:#fff;font:600 10px Inter,sans-serif;text-align:center;padding:0 5px}',
      '#dppk-ab{display:block;padding:14px 0 20px;font-family:Inter,system-ui,sans-serif}',
      '#dppk-ab .pk-box{width:auto;box-shadow:none;background:#FDFCFA;border:1px solid #EDE2C6;border-radius:14px;margin:0;color:#2A2727;overflow:hidden}',
      '#dppk-ab .pk-kopf{background:transparent;color:#2A2727;border-bottom-color:#EDE6D6;display:flex;align-items:flex-end;gap:12px;padding:18px 22px 14px;border-bottom:1px solid #EDE6D6;flex-wrap:wrap}',
      '#dppk-ab .pk-kopf h2{margin:0;flex:1 1 240px;min-width:0;font:600 22px "Space Grotesk",Inter,sans-serif;color:#2A2727}',
      '#dppk-ab .pk-kopf .pk-sub{display:block;font:500 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:' + G + ';margin-bottom:3px}',
      '#dppk-ab .pk-kopf .pk-titel2{font:500 13px Inter,sans-serif;color:#7A7370}',
      '#dppk-ab .pk-inhalt{padding:20px 22px 24px}',
      '#dppk-ab .pk-spalten{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}',
      '#dppk-ab .pk-karte{border:1px solid #EDE6D6;border-radius:12px;background:#fff;padding:14px 16px}',
      '#dppk-ab .pk-karte h3{margin:0 0 10px;font:600 15px "Space Grotesk",Inter,sans-serif;color:#2A2727}',
      '#dppk-ab .pk-karte .pk-zeile{border-color:#F0EADC}',
      '#dppk-ab .pk-mehr{border:0;background:none;color:#7A6020;font:600 12.5px Inter,sans-serif;cursor:pointer;padding:4px 0}',
      '#dppk-ab .pk-fuss{display:flex;gap:8px;justify-content:flex-end;margin-top:6px;flex-wrap:wrap}',
      '#dppk-ab .pk-spalten + .pk-karte,#dppk-ab .pk-karte + .pk-karte.pk-marke{margin-top:16px}',
      '#dppk-ab .pk-kachel-knopf{text-align:left;cursor:pointer;font:inherit;color:inherit;width:100%}',
      '#dppk-ab .pk-kachel-knopf:hover{border-color:' + G + '}',
      '#dppk-ab .pk-ansteht{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid #EDE6D6;border-radius:10px;background:#fff;padding:11px 12px;margin-bottom:8px;font:500 13.5px Inter,sans-serif;color:#2A2727;cursor:pointer}',
      '#dppk-ab .pk-ansteht span{flex:1;min-width:0}',
      '#dppk-ab .pk-ansteht i{font-style:normal;font-size:18px;color:#7A6020}',
      '#dppk-ab .pk-ansteht:hover{border-color:' + G + '}',
      '#dppk-ab .pk-hinweis .pk-mehr{padding:0;font-size:13px}',
      '#dppk-ab .pk-drei{grid-template-columns:repeat(3,1fr);margin-bottom:10px}',
      '#dppk-ab .pk-balken{height:8px;border-radius:5px;background:#EFE9DC;overflow:hidden}',
      '#dppk-ab .pk-balken i{display:block;height:100%;background:#3FA56C}',
      '#dppk-ab .pk-klein{font-size:12px;line-height:1.5;color:#7A7370;margin:8px 0}',
      '#dppk-ab .pk-kauf{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '#dppk-ab .pk-seg{display:inline-flex;border:1px solid #D9CFB8;border-radius:8px;overflow:hidden}',
      '#dppk-ab .pk-seg button{border:0;background:#fff;padding:8px 12px;font:600 12.5px Inter,sans-serif;color:#6B6460;cursor:pointer}',
      '#dppk-ab .pk-seg button.an{background:' + G + ';color:#fff}',
      '#dppk-ab .pk-stepper{display:inline-flex;border:1px solid #D9CFB8;border-radius:8px;overflow:hidden}',
      '#dppk-ab .pk-stepper button{width:34px;border:0;background:#FBF8F1;font:600 16px Inter,sans-serif;color:#2A2727;cursor:pointer}',
      '#dppk-ab .pk-stepper input{width:56px;border:0;text-align:center;font:600 14px "JetBrains Mono",monospace;padding:7px 0;-moz-appearance:textfield}',
      '#dppk-ab .pk-preis{margin-left:auto;text-align:right;font:400 12.5px Inter,sans-serif;color:#7A7370}',
      '#dppk-ab .pk-preis b{display:block;font:600 18px "Space Grotesk",Inter,sans-serif;color:#2A2727}',
      '#dppk-ab .pk-preis small{display:block}',
      '#dppk-ab .pk-filter{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}',
      '#dppk-ab .pk-filter button{border:1px solid #D9CFB8;background:#fff;border-radius:16px;padding:5px 11px;font:600 12px Inter,sans-serif;color:#4A4440;cursor:pointer}',
      '#dppk-ab .pk-filter button.an{background:#2A2727;border-color:#2A2727;color:#FDFCFA}',
      '#dppk-ab .pk-kundenkopf{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0 0 10px}',
      '#dppk-ab .pk-kundenkopf b{font:600 15px "Space Grotesk",Inter,sans-serif}',
      '#dppk-ab .pk-kundenkopf small{color:#7A7370;font-size:12px}',
      /* Marken-Formular aus reseller-portal.js (loadBranding) in Cockpit-Optik */
      '#dppk-ab .pk-marke .rp-intro{font-style:normal;font-size:13px;color:#7A7370;margin:0 0 12px}',
      '#dppk-ab .pk-marke .rp-panel{border:1px solid #EDE6D6;border-radius:10px;padding:14px 16px;margin-top:12px;background:#FDFCFA}',
      '#dppk-ab .pk-marke .rp-label{font:600 11px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370;margin:18px 0 6px}',
      '#dppk-ab .pk-marke .rp-fl{font:600 12px Inter,sans-serif;letter-spacing:0;text-transform:none;color:#4A4440;margin-bottom:6px}',
      '#dppk-ab .pk-marke .rp-checkout{background:' + G + ';color:#fff;border:1px solid ' + G + ';border-radius:8px;padding:9px 16px;font:600 13px Inter,sans-serif;cursor:pointer}',
      '#dppk-ab .pk-marke .rp-act{border:1px solid #D9CFB8;background:#fff;border-radius:8px;padding:6px 10px;font:600 12px Inter,sans-serif;cursor:pointer}',
      '#dppk-ab .pk-marke .rp-act.remove{color:#B8625C;border-color:#E3C2BF}',
      '#dppk-ab .pk-marke input[type=file]{max-width:100%}',
      '@media (max-width:640px){#dppk-ab{padding:6px 0 20px}#dppk-ab .pk-box{border-radius:10px}#dppk-ab .pk-kopf{padding:14px 14px 10px}#dppk-ab .pk-kopf h2{font-size:19px}#dppk-ab .pk-inhalt{padding:14px}#dppk-ab .pk-spalten{grid-template-columns:1fr}#dppk-ab .pk-preis{margin-left:0;text-align:left}#dppk-ab .pk-marke .rp-panel > div[style*="display:flex"]{flex-wrap:wrap}#dppk-ab .pk-marke .rp-panel > div[style*="display:flex"] > div{flex:1 1 100% !important;width:auto !important}#dppk-ab .pk-marke #rp-b-logo-prev{flex-wrap:wrap}}'
    ]).join('\n');
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

  /* ════ v3390 · PARTNER-COCKPIT IM ARBEITSBEREICH ═════════════════════════
     Muster wie vermoegen.js (v3217): eigene Sektion in .main-col, sichtbar nur mit html[data-pk-offen],
     Geschwister schliesst das Register DealPilotAnsichten (ui.js v1905). Anders als dort bleibt nav.tabs
     stehen und zeigt die Cockpit-Reiter. */
  /* v3640b · Marcel 17.11.2026: „Können wir ‚Mein Partner‘ genau so darstellen wie das Partner-Cockpit und auch mit den
     Freigaben, also im Arbeitsbereich? Gleiches Design. Dann brauchen wir das unter Einstellungen nicht mehr.“
     Derselbe Arbeitsbereich (#dppk-ab, Reiter in nav.tabs) mit PK.art 'kunde': eigene Reiter (k_*), dieselben Karten. */
  var PK = { offen: false, aktiv: 'uebersicht', art: 'partner', aktivJe: { partner: 'uebersicht', kunde: 'k_senden' } };
  var REITER_ICO = { uebersicht: 'layout', kunden: 'user', einladen: 'mail', staende: 'folderOpen', aufgaben: 'clipboard', meldungen: 'info', verwaltung: 'settings', uebergeben: 'handshake',
    k_senden: 'upload', k_sendungen: 'folderOpen', k_aufgaben: 'clipboard', k_freigaben: 'shieldCheck', k_verbindung: 'link', k_verbinden: 'link' };
  function kundeReiterListe() {
    var m = S.kunde || {};
    if (!m.verbunden) return [{ k: 'k_verbinden', t: 'Verbinden', zahl: (m.anfragen || []).length || 0 }];
    var offen = (m.aufgaben || []).filter(function (a) { return a.status !== 'erledigt' && a.status !== 'abgelehnt'; }).length;
    return [{ k: 'k_senden', t: 'An Partner senden' }, { k: 'k_sendungen', t: 'Meine Sendungen' }, { k: 'k_aufgaben', t: 'Aufgaben', zahl: offen },
      { k: 'k_freigaben', t: 'Freigaben' }, { k: 'k_verbindung', t: 'Verbindung' }];
  }
  function ico(n, g) { try { return window.Icons && Icons[n] ? Icons[n]({ size: g || 15 }) : ''; } catch (e) { return ''; } }
  function reiterListe() {
    if (PK.art === 'kunde') return kundeReiterListe();
    var c = S.partner || { kunden: [], anfragen: [] };
    var neu = (c.kunden || []).reduce(function (a, k) { return a + (k.neu || 0); }, 0);
    var l = [{ k: 'uebersicht', t: 'Übersicht' }, { k: 'kunden', t: 'Kunden & Plätze', zahl: (c.anfragen || []).length || 0 }, { k: 'einladen', t: 'Einladen' },
      /* v3500 · Marcel 16.11.2026: „Objekt an Kunden übergeben“ wieder erreichbar (seit v3392 ohne Einstieg) */
      { k: 'uebergeben', t: 'Übergeben' },
      { k: 'staende', t: 'Freigegeben', zahl: neu }, { k: 'aufgaben', t: 'Aufgaben' }, { k: 'meldungen', t: 'Meldungen', zahl: c.meldungen_ungelesen || 0 }];
    if (window.DealPilotResellerPortal && typeof DealPilotResellerPortal.markeZeichnen === 'function') l.push({ k: 'verwaltung', t: 'Verwaltung' });
    return l;
  }
  /* Optik der Reiter vom echten .tab ablesen (Skin, Layout-Variante, hell/dunkel) - nicht nachbauen */
  function tabStilAblesen(nav) {
    var n = nav.querySelector('.tab:not(.active)'), a = nav.querySelector('.tab.active') || n;
    if (!n) return;
    var P = ['color', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-transform', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'min-height', 'border-bottom-width', 'border-bottom-style', 'background-color', 'border-top-left-radius', 'border-top-right-radius'];
    var A = ['color', 'font-weight', 'border-bottom-color', 'background-color', 'background-image', 'box-shadow'];
    function regeln(el, liste) { var cs = getComputedStyle(el); return liste.map(function (p) { var v = cs.getPropertyValue(p); return v ? p + ':' + v + ' !important' : ''; }).filter(Boolean).join(';'); }
    var t = '#dppk-tabzeile .dppk-tab{' + regeln(n, P) + ';border-bottom-color:transparent !important}' +
      '#dppk-tabzeile .dppk-tab.an{' + regeln(a, A) + '}' +
      '#dppk-tabzeile .dppk-tab:hover{color:' + getComputedStyle(a).getPropertyValue('color') + ' !important}';
    var st = document.getElementById('dppk-tabstil');
    if (!st) { st = document.createElement('style'); st.id = 'dppk-tabstil'; document.head.appendChild(st); }
    st.textContent = t;
  }
  function tabzeile() {
    var nav = document.querySelector('nav.tabs'); if (!nav) return;
    var z = document.getElementById('dppk-tabzeile');
    if (!z) { z = document.createElement('div'); z.id = 'dppk-tabzeile'; z.setAttribute('role', 'tablist'); }
    z.setAttribute('aria-label', PK.art === 'kunde' ? 'Mein Partner' : 'Partner-Cockpit');
    if (z.parentNode !== nav) nav.insertBefore(z, nav.firstChild);
    z.innerHTML = '<button type="button" class="dppk-tab dppk-zurueck" data-pk-zurueck="1" title="Zurück zu den Objekten">' + ico('arrowRight', 14) + '<span>Objekte</span></button><span class="dppk-trenner" aria-hidden="true"></span>' +
      reiterListe().map(function (x) {
        return '<button type="button" role="tab" class="dppk-tab' + (x.k === PK.aktiv ? ' an' : '') + '" data-pk-reiter="' + x.k + '" aria-selected="' + (x.k === PK.aktiv) + '">' + ico(REITER_ICO[x.k]) +
          '<span>' + esc(x.t) + '</span>' + (x.zahl ? '<span class="pk-zahl">' + x.zahl + '</span>' : '') + '</button>';
      }).join('');
    z.querySelector('[data-pk-zurueck]').onclick = function () { zurueckZuObjekten(); };
    [].forEach.call(z.querySelectorAll('[data-pk-reiter]'), function (b) { b.onclick = function () { reiterWahl(b.getAttribute('data-pk-reiter')); }; });
    var an = z.querySelector('.dppk-tab.an');
    if (an && nav.scrollWidth > nav.clientWidth) { try { var r = an.getBoundingClientRect(), rn = nav.getBoundingClientRect(); if (r.right > rn.right || r.left < rn.left) nav.scrollLeft += r.left - rn.left - 40; } catch (e) {} }
  }
  function abSektion() {
    var s = document.getElementById('dppk-ab'); if (s) return s;
    /* v3391 · in .body (der Behaelter der .sec, 1320 px, eigener Rand) - direkt in .main-col blieb .body als 90 px hohe Leerflaeche darueber stehen */
    var mc = document.querySelector('.main-col > .body') || document.querySelector('.main-col'); if (!mc) return null;
    s = document.createElement('section'); s.id = 'dppk-ab'; s.setAttribute('aria-label', 'Partner-Cockpit');
    s.innerHTML = '<div class="pk-box"><div class="pk-kopf"><h2><span class="pk-sub">Partner-Cockpit</span><span class="pk-titel"></span></h2><span class="pk-titel2"></span></div><div class="pk-inhalt"></div></div>';
    mc.appendChild(s);
    return s;
  }
  var TITEL = { uebersicht: ['Übersicht', 'Was heute ansteht'], kunden: ['Kunden & Plätze', 'Verbindungen, Stufe und Rechte'], einladen: ['Kunden einladen', 'Per E-Mail oder Verbindungscode'],
    staende: ['Von Kunden freigegeben', 'Nur lesen, Übernehmen legt eine eigene Kopie an'], aufgaben: ['Aufgaben', 'Bitten an deine Kunden'], meldungen: ['Meldungen', ''],
    verwaltung: ['Verwaltung', 'Plätze, Marke und Abrechnung'], uebergeben: ['Objekt an Kunden übergeben', 'Dein durchgerechnetes Objekt per E-Mail, der Kunde bekommt eine Kopie'],
    /* v3640b · Mein Partner (Kunde) */
    k_senden: ['An Partner senden', 'Als Kopie, deine Originale bleiben bei dir'], k_sendungen: ['Meine Sendungen', 'Was beim Partner liegt'],
    k_aufgaben: ['Aufgaben', 'Bitten und Rückmeldungen deines Partners'], k_freigaben: ['Freigaben', 'Was dein Partner sieht und was dein Zugang darf'],
    k_verbindung: ['Verbindung', 'Zugang, Kundennummer, Trennen'], k_verbinden: ['Mit einem Partner verbinden', 'Verbindungscode für deinen Berater'] };
  function zeichnen() {
    var s = abSektion(); if (!s) return;
    var t = TITEL[PK.aktiv] || ['', ''];
    s.setAttribute('aria-label', PK.art === 'kunde' ? 'Mein Partner' : 'Partner-Cockpit');
    s.querySelector('.pk-sub').textContent = PK.art === 'kunde' ? 'Mein Partner' : 'Partner-Cockpit';
    s.querySelector('.pk-titel').textContent = t[0];
    var name = PK.art === 'kunde' ? (S.kunde && S.kunde.verbunden ? S.kunde.verbunden.partner_name : '') : (S.partner && S.partner.partner && S.partner.partner.name);
    s.querySelector('.pk-titel2').textContent = (name ? name + (t[1] ? ' · ' : '') : '') + t[1];
    var el = s.querySelector('.pk-inhalt');
    el.innerHTML = '<div class="pk-leer">Lädt …</div>';
    var k = PK.aktiv;
    if (k === 'k_senden') return sendenZeichnen(el);
    if (k === 'k_sendungen') return sendungenZeichnen(el);
    if (k === 'k_aufgaben') return kundeAufgabenZeichnen(el);
    if (k === 'k_freigaben') return freigabenZeichnen(el);
    if (k === 'k_verbindung') return verbindungZeichnen(el);
    if (k === 'k_verbinden') return verbindenZeichnen(el);
    if (k === 'uebersicht') return uebersichtZeichnen(el);
    if (k === 'kunden') return kundenZeichnen(el);
    if (k === 'einladen') return einladenZeichnen(el);
    if (k === 'staende') return staendeZeichnen(el);
    if (k === 'aufgaben') return aufgabenZeichnen(el);
    if (k === 'meldungen') return meldungenZeichnen(el);
    if (k === 'verwaltung') return verwaltungZeichnen(el);
    if (k === 'uebergeben') return uebergebenZeichnen(el);
  }
  function reiterWahl(k) {
    PK.aktiv = k || (PK.art === 'kunde' ? 'k_senden' : 'uebersicht');
    PK.aktivJe[PK.art] = PK.aktiv;
    tabzeile(); zeichnen();
    try { var mc = document.querySelector('.main-col'); if (mc) mc.scrollTop = 0; window.scrollTo(0, 0); } catch (e) {}
  }
  function cockpitOeffnen(startReiter) {
    return api('/partner/cockpit').then(function (c) {
      /* v3620 · Auftragsverarbeitungsvertrag: ohne aktuelle Zustimmung einmal fragen, ohne Abschluss kein Cockpit */
      if (c && c.avv && c.avv.aktuell === false && window.DpAvv && typeof DpAvv.einholen === 'function') {
        return DpAvv.einholen(c.avv).then(function (ok) {
          if (!ok) { toast('Das Partner-Cockpit öffnet sich, sobald der Auftragsverarbeitungsvertrag abgeschlossen ist.'); return; }
          c.avv.aktuell = true; cockpitZeigen(c, startReiter);
        });
      }
      cockpitZeigen(c, startReiter);
    }, function (e) { toast(e && e.status === 403 ? 'Das Partner-Cockpit gibt es mit dem Partner-Plan.' : fehlerText(e)); });
  }
  function cockpitZeigen(c, startReiter) {
    S.partner = c; menuePflegen();
    arbeitsbereichZeigen('partner', c.partner && c.partner.name || '', startReiter);
  }
  /* v3640b · ein Arbeitsbereich fuer beide Seiten: art 'partner' (Cockpit) oder 'kunde' (Mein Partner) */
  function arbeitsbereichZeigen(art, kopfName, startReiter) {
    {
      PK.art = art;
      try { if (window._currentObjKey && typeof window.saveObj === 'function') window.saveObj({ silent: true }); } catch (e) {}
      try { if (document.body.classList.contains('qc-standalone-active') && typeof window.exitQuickCheckMode === 'function') window.exitQuickCheckMode(); } catch (e) {}
      try { if (typeof window.closeSettings === 'function' && document.querySelector('.settings-overlay.open, #settings-overlay.open')) window.closeSettings(); } catch (e) {}
      var nav = document.querySelector('nav.tabs');
      if (nav) tabStilAblesen(nav);   /* VOR dem Ausblenden der .tab ablesen */
      if (window.DealPilotAnsichten) window.DealPilotAnsichten.abraeumen('partner');
      if (nav) nav.style.display = '';   /* der Schliesser von 'single' blendet nav.tabs aus - hier bleibt sie, mit anderen Reitern */
      var alt = document.getElementById('dppk-ov'); if (alt) alt.remove();
      document.documentElement.setAttribute('data-pk-offen', '1');
      try {   /* v3450 · im Kopf statt Objektnummer und Anschrift der Name des Cockpits */
        var zeile = document.querySelector('header.hdr .hdr-v61-row1'), ht = document.getElementById('dppk-hdr-titel');
        if (zeile && !ht) { ht = document.createElement('span'); ht.id = 'dppk-hdr-titel'; var vor = zeile.querySelector('#hdr-obj-num'); zeile.insertBefore(ht, vor || zeile.firstChild); }
        if (ht) ht.innerHTML = '<small>' + (art === 'kunde' ? 'Mein Partner' : 'Partner-Cockpit') + '</small>' + esc(kopfName || '');
      } catch (e) {}
      PK.offen = true;
      var s = abSektion(); if (s) s.style.display = '';
      var erlaubt = reiterListe().map(function (x) { return x.k; });
      var ziel = startReiter && erlaubt.indexOf(startReiter) >= 0 ? startReiter : (erlaubt.indexOf(PK.aktivJe[art]) >= 0 ? PK.aktivJe[art] : erlaubt[0]);
      reiterWahl(ziel);
    }
  }
  function cockpitSchliessen() {
    if (!PK.offen) return;
    PK.offen = false;
    document.documentElement.removeAttribute('data-pk-offen');
  }
  function zurueckZuObjekten() {
    PK.zurueckMarke = 0;   /* v3452a · der Nutzer will ins Objekt, nicht wieder ins Cockpit */
    cockpitSchliessen();
    if (typeof window.setMainView === 'function') window.setMainView('single');
  }
  var NUR_FENSTER = ['partner-cockpit', 'mein-partner', 'settings', 'help', 'feedback', 'hub-import', 'hub-export', 'pdf', 'csv', 'export-csv', 'import-excel', 'import-json', 'export-json'];   /* wie ui.js sbActionsAction _nurFenster */
  if (window.DealPilotAnsichten) window.DealPilotAnsichten.melde('partner', cockpitSchliessen);
  window.addEventListener('dp:object-ready', function () { if (PK.offen && !PK.hintergrund) zurueckZuObjekten(); });
  document.addEventListener('click', function (e) {
    try { if (PK.hintergrund && e.target && e.target.closest && e.target.closest('.sb-card, .sb-act-item, nav.tabs .tab, #dppk-tabzeile [data-pk-zurueck]')) PK.zurueckMarke = 0; } catch (x) {}
    if (!PK.offen) return;
    var t = e.target && e.target.closest ? e.target.closest('.sb-card, .sb-act-item') : null;
    if (!t) return;
    /* Fenster (Einstellungen, Hilfe, Import …) lassen das Cockpit stehen; alles, was die Ansicht wechselt, geht
       ueber die Objektansicht - dann findet jede Folgeansicht (Quick-Check, Track Record …) den Normalzustand vor */
    if (!t.classList.contains('sb-card')) {
      var m = /sbActionsAction\('([^']+)'\)/.exec(t.getAttribute('onclick') || ''), act = t.getAttribute('data-act') || (m && m[1]) || '';
      if (!act || NUR_FENSTER.indexOf(act) >= 0) return;   /* ohne erkennbare Aktion (Wünsche, Tour): stehen lassen */
    }
    zurueckZuObjekten();
  }, true);

  function neuLaden(el) {
    return api('/partner/cockpit').then(function (c) {
      S.partner = c; menuePflegen();
      if (PK.offen) { tabzeile(); zeichnen(); } else if (el) kundenZeichnen(el);
    });
  }

  /* v3392 · Marcel 15.11.: „etwas doppelt … Der Flow muss einfach sein.“ Ein Weg je Aufgabe:
     Übersicht zeigt nur Zahlen und was ansteht (jede Zeile fuehrt in ihren Reiter), keine Listen, keine Knoepfe.
     Einladen nur im Reiter Einladen, Plaetze/Marke/Abo nur im Reiter Verwaltung. */
  function platzZahlen(c) {
    var p = c.pool || {};
    var gekauft = p.gekauft != null ? p.gekauft : null;
    var belegt = p.zugewiesen != null ? p.zugewiesen + (p.reserviert || 0) : c.kunden.filter(function (k) { return k.hat_platz; }).length;
    return { gekauft: gekauft, belegt: belegt, frei: p.frei != null ? p.frei : (gekauft != null ? Math.max(0, gekauft - belegt) : null) };
  }
  function uebersichtZeichnen(el) {
    var c = S.partner, pz = platzZahlen(c);
    var verb = c.kunden.filter(function (k) { return !k.getrennt_am; }).length;
    var neu = c.kunden.reduce(function (a, k) { return a + (k.neu || 0); }, 0);
    var wartet = c.anfragen.length + (c.einladungen || []).length;
    var ohnePlatz = c.kunden.filter(function (k) { return !k.getrennt_am && k.platz_art === 'platz' && !k.hat_platz && !k.entzug_frist_bis; }).length;
    function kachel(z, t, ziel) { return '<button type="button" class="pk-kachel pk-kachel-knopf" data-geh="' + ziel + '"><span>' + t + '</span><b>' + z + '</b></button>'; }
    var h = '<div class="pk-kacheln">' +
      kachel(pz.belegt + ' / ' + (pz.gekauft != null ? pz.gekauft : '–'), 'Plätze belegt', 'verwaltung') +
      kachel(verb, 'Kunden verbunden', 'kunden') +
      kachel(neu, 'Neue Kundenstände', 'staende') +
      kachel(c.meldungen_ungelesen || 0, 'Ungelesene Meldungen', 'meldungen') + '</div>';
    var an = [];
    if (wartet) an.push(['kunden', wartet + (wartet === 1 ? ' Anfrage wartet' : ' Anfragen warten') + ' auf Bestätigung des Kunden']);
    c.kunden.filter(function (k) { return k.neu; }).forEach(function (k) { an.push(['staende', k.neu + (k.neu === 1 ? ' neuer Stand' : ' neue Stände') + ' von ' + k.display_name]); });
    if (ohnePlatz) an.push([pz.frei ? 'kunden' : 'verwaltung', ohnePlatz + (ohnePlatz === 1 ? ' Kunde wartet' : ' Kunden warten') + ' auf einen Platz' + (pz.frei ? '' : ', es ist keiner frei')]);
    if (c.meldungen_ungelesen) an.push(['meldungen', c.meldungen_ungelesen + (c.meldungen_ungelesen === 1 ? ' ungelesene Meldung' : ' ungelesene Meldungen')]);
    if (!verb && !wartet) an.push(['einladen', 'Noch keine Kunden. Lade deinen ersten Kunden ein']);
    h += '<div class="pk-karte"><h3>Was ansteht</h3>' + (an.length ? an.map(function (x) {
      return '<button type="button" class="pk-ansteht" data-geh="' + x[0] + '"><span>' + esc(x[1]) + '</span><i aria-hidden="true">›</i></button>';
    }).join('') : '<div class="pk-leer">Alles erledigt.</div>') + '</div>';
    el.innerHTML = h;
    [].forEach.call(el.querySelectorAll('[data-geh]'), function (b) { b.onclick = function () { reiterWahl(b.getAttribute('data-geh')); }; });
  }

  function einladenZeichnen(el) {
    el.innerHTML = '<div class="pk-spalten">' +
      '<div class="pk-karte" data-form="mail"><h3>Per E-Mail einladen</h3>' + EINLADEN_HTML + '<div class="pk-fuss"><button type="button" class="pk-btn gold">Einladen</button></div></div>' +
      '<div class="pk-karte" data-form="code"><h3>Verbindungscode eingeben</h3>' + CODE_HTML + '<div class="pk-fuss"><button type="button" class="pk-btn gold">Anfrage senden</button></div></div></div>';
    [['mail', einladenSenden], ['code', codeSenden]].forEach(function (p) {
      var f = el.querySelector('[data-form="' + p[0] + '"]'), b = f.querySelector('.pk-fuss .pk-btn');
      b.onclick = function () {
        b.disabled = true;
        Promise.resolve(p[1](f, null)).then(function (r) { b.disabled = false; if (r !== false) PK.offen && reiterWahl('kunden'); }, function (e) { b.disabled = false; toast(fehlerText(e)); });
      };
    });
  }

  /* ── Verwaltung (v3392): Plaetze, Marke, Abrechnung - eigene Oberflaeche, Logik aus reseller-portal.js ── */
  var VERW = { iv: 'monthly', qty: 5 };
  /* v3630i · Marcel 17.11.2026: „Mir gefällt das mit der Strecke nicht." Eine Verwaltung ist
     keine Abfolge. Deshalb keine Schrittleiste mehr (v3630f, hubAufbauen), sondern
     Einstellungen: links eine feste Liste der Bereiche mit Symbol und einer Zeile Stand,
     rechts der Inhalt. Kein Zurueck/Weiter, keine Nummern. Am Handy steht die Liste
     oben (eine Spalte). Optik wie die Karten des Cockpits (.pk-karte: Rand #EDE6D6,
     Radius 12, Titel Space Grotesk 15/600).
     Die Marken-Teile baut reseller-portal.js loadBranding() in Huellen [data-marke-teil];
     hier werden sie in ihre Bereiche gehaengt. Die Speicher-Leiste steht fest unten. */
  var VERW_BEREICHE = [
    ['marke', 'Marke', 'badge'],
    ['logo', 'Logo', 'image'],
    ['farben', 'Farben', 'sparkles'],
    ['dokumente', 'Dokumente', 'fileText'],
    ['plaetze', 'Plätze & Abo', 'creditCard']
  ];
  function verwaltungZeichnen(el) {
    var rp = window.DealPilotResellerPortal;
    if (!rp || typeof rp.markeZeichnen !== 'function') { el.innerHTML = '<div class="pk-leer">Die Verwaltung ist gerade nicht geladen. Bitte die Seite neu laden.</div>'; return; }
    verwStil();
    var akt = PK.verwBereich || 'marke';
    el.innerHTML = '<div class="pk-verw" id="dppk-verw">' +
      '<nav class="pk-verw-liste" aria-label="Bereiche der Verwaltung">' + VERW_BEREICHE.map(function (b) {
        return '<button type="button" class="pk-verw-punkt' + (b[0] === akt ? ' an' : '') + '" data-bereich="' + b[0] + '" aria-current="' + (b[0] === akt) + '">' +
          '<span class="pk-verw-ico">' + ico(b[2], 17) + '</span><span class="pk-verw-txt"><b>' + esc(b[1]) + '</b><small data-stand="' + b[0] + '">…</small></span>' +
          '<span class="pk-verw-mini" data-mini="' + b[0] + '" aria-hidden="true"></span></button>';   /* v3630k · kleine Vorschau je Bereich */
      }).join('') + '</nav>' +
      '<div class="pk-verw-inhalt">' + VERW_BEREICHE.map(function (b) {
        var inner = b[0] === 'plaetze'
          ? '<div class="pk-spalten">' +
              '<div class="pk-karte" data-v="plaetze"><h3>Plätze</h3><div class="pk-leer">Lädt …</div></div>' +
              '<div class="pk-karte" data-v="abo"><h3>Abrechnung</h3><div class="pk-leer">Lädt …</div></div></div>'
          : '<div class="pk-marke" data-v-ziel="' + b[0] + '"><div class="pk-leer">Lädt …</div></div>';
        return '<section class="pk-verw-bereich" data-bereich-inhalt="' + b[0] + '"' + (b[0] === akt ? '' : ' hidden') + '>' + inner + '</section>';
      }).join('') + '</div></div>';
    var box = el.querySelector('#dppk-verw');
    var wahl = function (k) {
      PK.verwBereich = k;
      [].forEach.call(box.querySelectorAll('.pk-verw-punkt'), function (b) { var an = b.getAttribute('data-bereich') === k; b.classList.toggle('an', an); b.setAttribute('aria-current', String(an)); });
      [].forEach.call(box.querySelectorAll('[data-bereich-inhalt]'), function (s) { s.hidden = s.getAttribute('data-bereich-inhalt') !== k; });
      if (window.innerWidth <= 760) { try { box.querySelector('.pk-verw-inhalt').scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {} }
    };
    [].forEach.call(box.querySelectorAll('.pk-verw-punkt'), function (b) { b.onclick = function () { wahl(b.getAttribute('data-bereich')); }; });
    plaetzeZeichnen(box.querySelector('[data-v="plaetze"]'));
    aboZeichnen(box.querySelector('[data-v="abo"]'));
    var lager = document.createElement('div'); lager.className = 'pk-marke'; lager.hidden = true; box.appendChild(lager);
    var stand = function () { verwListeAktualisieren(box); };
    /* v3630k · Plaetze-Vorschau: Balken belegt/frei aus dem Pool */
    try {
      if (rp.poolHolen) rp.poolHolen().then(function (pl) {
        var m = box.querySelector('[data-mini="plaetze"]'), st = box.querySelector('[data-stand="plaetze"]');
        var ges = pl.gekauft || 0, bel = (pl.zugewiesen || 0) + (pl.reserviert || 0), ant = ges ? Math.min(100, Math.round(bel / ges * 100)) : 0;
        if (st) st.textContent = ges ? bel + ' von ' + ges + ' Plätzen belegt' : 'Noch keine Plätze';
        if (m) m.innerHTML = '<span class="pk-verw-balken"><i style="width:' + ant + '%"></i></span><span class="pk-verw-zahl">' + bel + '/' + ges + '</span>';
      }, function () {});
    } catch (e) {}
    var verteilen = function () {
      VERW_BEREICHE.forEach(function (b) {
        var ziel = box.querySelector('[data-v-ziel="' + b[0] + '"]'), teil = lager.querySelector('[data-marke-teil="' + b[0] + '"]');
        if (ziel && teil) { ziel.innerHTML = ''; ziel.appendChild(teil); }
      });
      var leiste = lager.querySelector('[data-marke-teil="leiste"]');
      if (leiste) {
        leiste.removeAttribute('style'); leiste.className = 'pk-marke dppk-verw-leiste'; box.appendChild(leiste);
        /* links buendig mit der Inhaltsspalte (die Schiene ist je Darstellung verschieden breit) */
        var links = function () { var mc = box.getBoundingClientRect(); var x = window.innerWidth > 900 ? Math.max(0, Math.round(box.closest('.main-col') ? box.closest('.main-col').getBoundingClientRect().left : 0)) : 0; document.documentElement.style.setProperty('--dppk-verw-links', x + 'px'); };
        links(); if (!PK._verwLinks) { PK._verwLinks = true; window.addEventListener('resize', function () { if (document.getElementById('dppk-verw')) links(); }); }
      }
      if (!lager.querySelector('[data-marke-teil]') && lager.textContent.trim()) {
        var z0 = box.querySelector('[data-v-ziel="marke"]'); if (z0) { z0.innerHTML = ''; z0.appendChild(lager); lager.hidden = false; }
      }
      stand();
    };
    /* Stand-Zeilen links folgen jeder Aenderung (reseller-portal.js meldet dp:marke-stand) */
    if (!PK._verwStandHoerer) { PK._verwStandHoerer = true; window.addEventListener('dp:marke-stand', function () { var b = document.getElementById('dppk-verw'); if (b) verwListeAktualisieren(b); }); }
    try {
      Promise.resolve(rp.markeZeichnen(lager)).then(verteilen, function (e) {
        var z = box.querySelector('[data-v-ziel="marke"]'); if (z) z.innerHTML = '<div class="pk-leer">' + esc(fehlerText(e)) + '</div>';
      });
    } catch (e) {
      var z = box.querySelector('[data-v-ziel="marke"]'); if (z) z.innerHTML = '<div class="pk-leer">' + esc(fehlerText(e)) + '</div>';
    }
  }
  function verwListeAktualisieren(box) {
    var rp = window.DealPilotResellerPortal; if (!rp || !box) return;
    try {
      var z = rp.markeStand ? rp.markeStand() : null;
      if (z) Object.keys(z).forEach(function (k) { if (k === 'plaetze') return; var s = box.querySelector('[data-stand="' + k + '"]'); if (s) s.textContent = z[k]; });
      var v = rp.markeVorschau ? rp.markeVorschau() : null;
      if (v) Object.keys(v).forEach(function (k) { var m = box.querySelector('[data-mini="' + k + '"]'); if (m && m.innerHTML !== v[k]) m.innerHTML = v[k]; });
    } catch (e) {}
  }
  function verwStil() {
    if (document.getElementById('dppk-verw-stil')) return;
    var s = document.createElement('style'); s.id = 'dppk-verw-stil';
    s.textContent = [
      '.pk-verw{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px;align-items:start;padding-bottom:84px}',
      '.pk-verw-liste{position:sticky;top:12px;display:flex;flex-direction:column;gap:4px;border:1px solid #EDE6D6;border-radius:12px;background:#fff;padding:8px}',
      '.pk-verw-punkt{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;border:0;border-radius:9px;background:none;padding:10px 10px;cursor:pointer;color:#2A2727;font:inherit}',
      '.pk-verw-punkt:hover{background:#FBF6E9}',
      '.pk-verw-punkt.an{background:#F6F0E1;box-shadow:inset 3px 0 0 ' + G + '}',
      '.pk-verw-ico{flex:none;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#F4EEDF;color:#4A4440}',
      '.pk-verw-punkt.an .pk-verw-ico{background:' + G + ';color:#fff}',
      '.pk-verw-txt{min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.pk-verw-txt b{font:600 14px "Space Grotesk",Inter,sans-serif}',
      '.pk-verw-txt small{font:400 11.5px/1.35 Inter,sans-serif;color:#7A7370;white-space:normal}',
      '.pk-verw-bereich[hidden]{display:none !important}',
      /* v3630k · Werte des Reiters Objekt, gemessen mit getComputedStyle (1440 px): Titel wie #s0 > h2.sec-title,
         Unterzeile wie .sec-desc, Karte wie .card (1 px Gold 22 %, Radius 2, Innen 20, kein Schatten), Kopf .ct.ct-pro
         (JetBrains Mono 10/700, 1,2 px, #6B645A), Beschriftung .f > label (Inter 11/500, rgba(42,39,39,.85), 4 px),
         Felder kommen aus style.css + einheitlich.css (#dppk-verw steht dort in jeder Liste). */
      '#dppk-verw .dp-verw-titel{position:relative;margin:0;padding:0 0 0 14px;font:700 24px/36px "Space Grotesk",system-ui,sans-serif;letter-spacing:-.3px !important;color:#2A2727}',
      '#dppk-verw .dp-verw-titel::before{content:"";position:absolute;left:0;top:6px;width:3px;height:24px;border-radius:2px;background:linear-gradient(180deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-9a7f33, #9a7f33))}',
      '#dppk-verw .dp-verw-desc{margin:3px 0 18px;font:400 12px/1.5 Inter,system-ui,sans-serif;color:#625C59}',
      /* gemessen nach v3630k: eine spaetere Kartenregel setzte #E6E1D6 - deshalb !important */
      '#dppk-verw .card.dp-verw-karte{background:#fff !important;border:1px solid color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 22%,transparent) !important;border-radius:2px !important;box-shadow:none !important;padding:20px !important;margin:0 0 16px}',
      '#dppk-verw .ct.ct-pro.dp-verw-ct{display:flex;align-items:center;gap:8px;font:700 10px "JetBrains Mono",ui-monospace,monospace;letter-spacing:1.2px;text-transform:uppercase;color:#6B645A !important;padding:0 0 10px;margin:16px 0 12px;border-bottom:1px solid #EDE6D6}',
      '#dppk-verw .card > .ct.ct-pro.dp-verw-ct:first-child{margin-top:0}',
      '#dppk-verw .ct.ct-pro.dp-verw-ct .rp-b-std{margin-left:auto !important;text-transform:none;letter-spacing:0;font:500 11px Inter,sans-serif}',
      '#dppk-verw .ct.ct-pro.dp-verw-ct b{font-family:Inter,sans-serif;letter-spacing:0;text-transform:none;color:#2A2727}',
      '#dppk-verw input[type=text],#dppk-verw input[type=email]{padding:0 11px !important}',
      '#dppk-verw .dp-verw-lbl{display:block;margin:0 0 4px;font:500 11px/20px Inter,system-ui,sans-serif;color:rgba(42,39,39,.85)}',
      '#dppk-verw .dp-verw-hint{font:italic 400 10.5px/1.5 Inter,system-ui,sans-serif;color:rgba(42,39,39,.68)}',
      '#dppk-verw .dp-verw-hint b{font-style:normal}',
      /* Knoepfe: Inter 13/500, 38 px, Radius 8 (einheitlich.css .btn); Hauptknopf wie .oab-act im Boarding Pass */
      '.pk-marke .dp-verw-btn{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 16px;border:1px solid color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 30%,transparent);border-radius:8px;background:#fff;color:#2A2727;font:500 13px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.03)}',
      '.pk-marke .dp-verw-btn:hover{border-color:color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 60%,transparent)}',
      '.pk-marke .dp-verw-btn-haupt{background:#0A0A0A;border-color:#0A0A0A;color:var(--wl-e8cc7a, #E8CC7A);font-weight:600}',
      '.pk-marke .dp-verw-btn-haupt:hover{background:#1c1a17;border-color:#1c1a17}',
      '.pk-marke .dp-verw-btn-weg{color:#B8625C;border-color:rgba(184,98,92,.35);margin-left:8px}',
      /* Ablageflaeche statt nacktem Datei-Knopf */
      '#dppk-verw .dp-verw-ablage{display:flex;align-items:center;gap:12px;padding:14px 16px;margin:6px 0 10px;border:1.5px dashed color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 45%,transparent);border-radius:2px;background:#FBF9F4;cursor:pointer;font:400 12.5px/1.45 Inter,sans-serif;color:#2A2727;transition:background .15s,border-color .15s}',
      '#dppk-verw .dp-verw-ablage:hover,#dppk-verw .dp-verw-ablage.ueber{background:color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 8%,#fff);border-color:var(--wl-c9a84c, #C9A84C)}',
      '#dppk-verw .dp-verw-ablage small{display:block;font:italic 400 10.5px/1.5 Inter,sans-serif;color:rgba(42,39,39,.68)}',
      '#dppk-verw .dp-verw-ablage-ico{flex:none;width:38px;height:38px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 40%,transparent);color:var(--wl-b8932f, #b8932f);background:#fff}',
      '#dppk-verw .dp-verw-ablage-klein{padding:10px 12px}',
      '#dppk-verw .dp-verw-datei{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}',
      '#dppk-verw #rp-b-logo-x{margin-left:0}',
      /* Liste links: Vorschau rechts im Eintrag */
      '.pk-verw-punkt{align-items:center}',
      '.pk-verw-mini{flex:none;margin-left:auto;display:flex;align-items:center;gap:4px;min-width:66px;justify-content:flex-end}',
      '.pk-verw-mini img{image-rendering:auto}',
      '.pk-verw-balken{display:block;width:40px;height:6px;border-radius:3px;background:#EDE6D6;overflow:hidden}',
      '.pk-verw-balken i{display:block;height:100%;background:#3FA56C}',
      '.pk-verw-zahl{font:600 10px "JetBrains Mono",monospace;color:#6B645A}',
      '.pk-verw-inhalt .pk-karte.pk-marke{padding:16px 20px}',
      '.pk-verw-inhalt [data-marke-teil] > div:first-child{margin-top:0 !important}',
      /* Speicher-Leiste: fest am unteren Bildschirmrand, ueber der Inhaltsspalte */
      '.dppk-verw-leiste{position:fixed;bottom:0;right:0;left:var(--dppk-verw-links,248px);z-index:60;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 96px calc(12px + env(safe-area-inset-bottom)) 24px;background:#fff;border-top:1px solid #EDE6D6;box-shadow:0 -6px 16px rgba(0,0,0,.06)}',
      '.dppk-verw-leiste #rp-b-stand{margin-left:6px}',
      '@media (max-width:900px){.dppk-verw-leiste{left:0}}',
      '@media (max-width:760px){.pk-verw{grid-template-columns:1fr;gap:12px}.pk-verw-liste{position:static;padding:6px}.pk-verw-punkt{padding:8px}.pk-verw-inhalt .pk-karte.pk-marke{padding:14px}.dppk-verw-leiste{padding:10px 72px calc(10px + env(safe-area-inset-bottom)) 14px}.dppk-verw-leiste #rp-b-stand{flex:1 1 100%;margin:0}}'
    ].join('');
    document.head.appendChild(s);
  }
  /* v3500 · Übergeben: Oberfläche und Logik aus reseller-portal.js (loadUebergaben/uebSenden/uebVorpruefung, v3317), hier nur das Ziel */
  function uebergebenZeichnen(el) {
    var rp = window.DealPilotResellerPortal;
    if (!rp || typeof rp.uebergabeZeichnen !== 'function') { el.innerHTML = '<div class="pk-leer">Übergeben ist gerade nicht geladen. Bitte die Seite neu laden.</div>'; return; }
    el.innerHTML = '<div class="pk-karte pk-ueberg"><div class="pk-ueberg-form"><div class="pk-leer">Lädt …</div></div></div>';
    try { rp.uebergabeZeichnen(el.querySelector('.pk-ueberg-form')); } catch (e) { el.querySelector('.pk-ueberg-form').innerHTML = '<div class="pk-leer">' + esc(fehlerText(e)) + '</div>'; }
  }
  function portalOeffnen() {
    if (window.Sub && typeof Sub.openPortal === 'function') return Sub.openPortal().catch(function (e) { toast(fehlerText(e)); });
    toast('Das Abo-Portal ist gerade nicht erreichbar.');
  }
  /* v3610 · laeuft ein Stripe-Abo (Partner-Plan mit Plaetzen), werden die Plaetze DORT geaendert:
     eine Zielzahl, nach unten begrenzt auf belegt + reserviert (POST /reseller/plaetze). Ohne Abo bleibt der Platz-Kauf. */
  function plaetzeZeichnen(k) {
    api('/reseller/abo').then(function (r) {
      if (r && r.abo && ['active', 'trialing', 'past_due'].indexOf(r.abo.status) >= 0) return plaetzeImAbo(k, r);
      plaetzeKaufen(k);
    }, function () { plaetzeKaufen(k); });
  }
  function plaetzeImAbo(k, r) {
    var p = r.pool || {}, abo = r.abo, min = r.mindest || 0, iv = abo.intervall === 'yearly' ? 'yearly' : 'monthly';
    var belegt = (p.zugewiesen || 0) + (p.reserviert || 0), tot = p.gekauft || 0, anteil = tot ? Math.round(belegt / tot * 100) : 0;
    var ziel = abo.plaetze, PP = window.DpPartnerPlan, ein = iv === 'yearly' ? 'Jahr' : 'Monat';
    k.innerHTML = '<h3>Plätze</h3>' +
      '<div class="pk-kacheln pk-drei"><div class="pk-kachel"><span>Gebucht</span><b>' + tot + '</b></div><div class="pk-kachel"><span>Belegt</span><b>' + belegt + '</b></div><div class="pk-kachel"><span>Frei</span><b>' + (p.frei || 0) + '</b></div></div>' +
      '<div class="pk-balken" aria-hidden="true"><i style="width:' + anteil + '%"></i></div>' +
      (p.reserviert ? '<p class="pk-klein">' + p.reserviert + ' davon für eine Objekt-Übergabe vorgemerkt.</p>' : '') +
      '<div class="pk-gruppe">Plätze ändern</div>' +
      '<div class="pk-kauf"><div class="pk-stepper"><button type="button" data-d="-1" aria-label="weniger">−</button><input type="number" min="' + min + '" max="500" value="' + ziel + '" aria-label="Anzahl Plätze"><button type="button" data-d="1" aria-label="mehr">+</button></div>' +
      '<div class="pk-preis"></div></div>' +
      '<p class="pk-klein" data-v="hinweis"></p>' +
      '<p class="pk-klein">Weniger als ' + min + ' geht nicht: so viele Plätze sind belegt oder für eine Übergabe vorgemerkt. Mehr Plätze werden sofort anteilig berechnet, weniger als Gutschrift auf die nächste Rechnung.</p>' +
      (abo.gekuendigt ? '<p class="pk-klein"><b>Dein Abo ist zum ' + datum(abo.periodenende) + ' gekündigt.</b> Plätze lassen sich erst nach einer Wiederaufnahme im Abo-Portal ändern.</p>' : '') +
      '<div class="pk-fuss"><button type="button" class="pk-btn gold" data-a="uebernehmen"' + (abo.gekuendigt ? ' disabled' : '') + '>Plätze übernehmen</button></div>';
    var inp = k.querySelector('.pk-stepper input'), knopf = k.querySelector('[data-a="uebernehmen"]');
    function preis() {
      ziel = Math.max(min, Math.min(500, parseInt(inp.value, 10) || 0)); inp.value = ziel;
      var aenderung = ziel - abo.plaetze;
      k.querySelector('[data-v="hinweis"]').textContent = aenderung === 0 ? 'Unverändert ' + ziel + ' Plätze.' : (aenderung > 0 ? '+' + aenderung : String(aenderung)) + ' gegenüber heute (' + abo.plaetze + ').';
      knopf.disabled = !!abo.gekuendigt || aenderung === 0;
      if (PP && typeof PP.angebotHolen === 'function') PP.angebotHolen().then(function (a) {
        var sum = PP.platzSumme(a, iv, ziel), satz = ziel ? PP.platzSatz(a.platz[iv].stufen, ziel) : 0;
        k.querySelector('.pk-preis').innerHTML = '<b>' + PP.eur(sum) + '</b> je ' + ein + '<small>' + (ziel ? PP.eur(satz) + ' je Platz' : 'keine Plätze') + '</small>';
      }, function () {});
    }
    [].forEach.call(k.querySelectorAll('.pk-stepper button'), function (b) { b.onclick = function () { inp.value = (parseInt(inp.value, 10) || 0) + Number(b.getAttribute('data-d')); preis(); }; });
    inp.oninput = function () { if (inp.value !== '') preis(); };
    knopf.onclick = function () {
      knopf.disabled = true;
      api('/reseller/plaetze', { method: 'POST', body: { anzahl: ziel } }).then(function (x) {
        toast('Plätze geändert: ' + (x && x.pool ? x.pool.gekauft : ziel) + ' gebucht.');
        plaetzeZeichnen(k);
      }, function (e) { knopf.disabled = false; toast(fehlerText(e)); });
    };
    preis();
  }
  function plaetzeKaufen(k) {
    var rp = window.DealPilotResellerPortal;
    rp.poolHolen().then(function (p) {
      var belegt = (p.zugewiesen || 0) + (p.reserviert || 0), tot = p.gekauft || 0, anteil = tot ? Math.round(belegt / tot * 100) : 0;
      k.innerHTML = '<h3>Plätze</h3>' +
        '<div class="pk-kacheln pk-drei"><div class="pk-kachel"><span>Gekauft</span><b>' + tot + '</b></div><div class="pk-kachel"><span>Belegt</span><b>' + belegt + '</b></div><div class="pk-kachel"><span>Frei</span><b>' + (p.frei || 0) + '</b></div></div>' +
        '<div class="pk-balken" aria-hidden="true"><i style="width:' + anteil + '%"></i></div>' +
        (p.reserviert ? '<p class="pk-klein">' + p.reserviert + ' davon für eine Objekt-Übergabe vorgemerkt.</p>' : '') +
        '<div class="pk-gruppe">Plätze dazukaufen</div>' +
        '<div class="pk-kauf"><div class="pk-seg" role="group"><button type="button" data-iv="monthly">Monatlich</button><button type="button" data-iv="yearly">Jährlich</button></div>' +
        '<div class="pk-stepper"><button type="button" data-d="-1" aria-label="weniger">−</button><input type="number" min="1" max="500" value="' + VERW.qty + '" aria-label="Anzahl Plätze"><button type="button" data-d="1" aria-label="mehr">+</button></div>' +
        '<div class="pk-preis"></div></div>' +
        '<p class="pk-klein">' + rp.staffelText() + '. Der Stückpreis gilt für alle Plätze. Im Partner-Paket ist kein Platz enthalten.</p>' +
        '<div class="pk-fuss"><button type="button" class="pk-btn" data-a="portal">Plätze reduzieren</button><button type="button" class="pk-btn gold" data-a="kasse">Zur Kasse</button></div>';
      var inp = k.querySelector('.pk-stepper input');
      function preis() {
        VERW.qty = Math.max(1, Math.min(500, parseInt(inp.value, 10) || 1)); inp.value = VERW.qty;
        var satz = rp.staffelSatz(VERW.qty, VERW.iv), ein = VERW.iv === 'yearly' ? 'Jahr' : 'Monat';
        k.querySelector('.pk-preis').innerHTML = '<b>' + (satz * VERW.qty).toLocaleString('de-DE') + ' €</b> je ' + ein + '<small>' + satz + ' € je Platz</small>';
        [].forEach.call(k.querySelectorAll('.pk-seg button'), function (b) { b.classList.toggle('an', b.getAttribute('data-iv') === VERW.iv); });
      }
      [].forEach.call(k.querySelectorAll('.pk-seg button'), function (b) { b.onclick = function () { VERW.iv = b.getAttribute('data-iv'); preis(); }; });
      [].forEach.call(k.querySelectorAll('.pk-stepper button'), function (b) { b.onclick = function () { inp.value = (parseInt(inp.value, 10) || 1) + Number(b.getAttribute('data-d')); preis(); }; });
      inp.oninput = function () { if (inp.value !== '') preis(); };
      k.querySelector('[data-a="kasse"]').onclick = function () { rp.seatsKaufen(VERW.qty, VERW.iv); };
      k.querySelector('[data-a="portal"]').onclick = portalOeffnen;
      preis();
    }, function (e) { k.innerHTML = '<h3>Plätze</h3><div class="pk-leer">' + esc(fehlerText(e)) + '</div>'; });
  }
  function aboZeichnen(k) {
    var holen = window.Sub && typeof Sub.getCurrent === 'function' ? Sub.getCurrent() : Promise.resolve(null);
    Promise.resolve(holen).then(function (s) {
      s = s || {};
      var plan = String(s.plan_id || '').toLowerCase() === 'partner' ? 'Partner' : (s.plan_label || s.plan_id || 'Partner');
      var bis = s.current_period_end || s.period_end || null;
      var iv = s.billing_interval || s.interval || '';
      k.innerHTML = '<h3>Abrechnung</h3>' +
        '<div class="pk-zeile"><div class="pk-name"><b>' + esc(plan) + '-Plan</b><small>' + (iv === 'yearly' ? 'jährlich' : iv === 'monthly' ? 'monatlich' : 'aktiv') + (bis ? ', läuft bis ' + datum(bis) : '') + '</small></div><span class="pk-chip gruen">aktiv</span></div>' +
        (s.cancel_at_period_end ? '<p class="pk-klein"><b>Gekündigt zum ' + datum(bis) + '.</b> Danach laufen deine Kunden mit Partnerplatz in die Frist.</p>' : '') +
        '<p class="pk-klein">Rechnungen und Zahlungsart stehen im Abo-Portal.</p>' +
        /* v3610 · eigener Knopf mit den Folgen fuer die Kunden (partner-plan-kauf.js) */
        '<div class="pk-fuss"><button type="button" class="pk-btn" data-a="kuendigen">Partner-Plan kündigen</button><button type="button" class="pk-btn gold" data-a="portal">Abo und Rechnungen</button></div>';
      k.querySelector('[data-a="portal"]').onclick = portalOeffnen;
      k.querySelector('[data-a="kuendigen"]').onclick = function () { if (window.DpPartnerPlan) DpPartnerPlan.kuendigenDialog(); else portalOeffnen(); };
    }, function (e) { k.innerHTML = '<h3>Abrechnung</h3><div class="pk-leer">' + esc(fehlerText(e)) + '</div>'; });
  }

  function kundenZeichnen(el) {
    var c = S.partner, pz = platzZahlen(c);
    /* v3392 · keine Kacheln (stehen in der Übersicht), Einladen nur im Reiter Einladen; im Fenster bleiben die Knoepfe */
    var h = PK.offen
      ? '<div class="pk-hinweis">Plätze: ' + pz.belegt + ' von ' + (pz.gekauft != null ? pz.gekauft : '–') + ' belegt, ' + (pz.frei != null ? pz.frei : '–') + ' frei. <button type="button" class="pk-mehr" data-geh="verwaltung">Plätze verwalten</button> · <button type="button" class="pk-mehr" data-geh="einladen">Kunden einladen</button></div>'
      : '<div class="pk-leiste"><button type="button" class="pk-btn gold" data-a="einladen">Kunden einladen</button><button type="button" class="pk-btn" data-a="code">Verbindungscode eingeben</button></div>';
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
    if (!c.kunden.length) h += '<div class="pk-leer">Noch keine Kunden. Lade einen Kunden ein oder lass dir seinen Verbindungscode geben (Reiter Einladen).</div>';
    h += c.kunden.map(function (k) {
      var getrennt = !!k.getrennt_am;
      var status = getrennt ? '<span class="pk-chip grau">getrennt</span>' : k.entzug_frist_bis ? '<span class="pk-chip rot">Frist bis ' + datum(k.entzug_frist_bis) + '</span>' : '<span class="pk-chip gruen">verbunden</span>';
      var zug = k.platz_art === 'platz' ? '<span class="pk-chip">Partnerplatz' + (k.hat_platz ? '' : ', noch ohne Platz') + '</span>' : '<span class="pk-chip grau">eigener Plan</span>';
      var info = k.platz_art === 'platz' ? (STUFEN[k.stufe] || 'Fortgeschritten') + ', ' + (k.marke === 'dealpilot' ? 'Marke DealPilot' : 'deine Marke') : 'Stufe und Rechte wählt der Kunde';
      var knoepfe = getrennt ? '' : (k.platz_art === 'platz'
        ? '<button type="button" class="pk-btn klein" data-ein="' + k.id + '">Stufe und Rechte</button>' + (k.hat_platz || k.entzug_frist_bis ? '' : '<button type="button" class="pk-btn klein" data-platz="' + k.id + '">Platz zuweisen</button>')
        : '<button type="button" class="pk-btn klein" data-ein="' + k.id + '">Notiz und E-Mail</button><button type="button" class="pk-btn klein rot" data-trenn="' + k.id + '">Trennen</button>');
      return '<div class="pk-zeile"><div class="pk-name"><b>' + nrEtikett(k.kundennummer) + esc(k.display_name) + '</b><small>' + esc(k.email) + ' · ' + esc(info) + (k.sendungen ? ' · ' + k.sendungen + (k.sendungen === 1 ? ' Objekt gesendet' : ' Objekte gesendet') : '') + (k.neu ? ', ' + k.neu + ' neu' : '') + '</small></div>' + zug + status + knoepfe + '</div>';
    }).join('');
    el.innerHTML = h;
    var _e = el.querySelector('[data-a="einladen"]'), _c = el.querySelector('[data-a="code"]');
    if (_e) _e.onclick = function () { einladenDialog(el); };
    if (_c) _c.onclick = function () { codeDialog(el); };
    [].forEach.call(el.querySelectorAll('[data-geh]'), function (b) { b.onclick = function () { reiterWahl(b.getAttribute('data-geh')); }; });
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

  var EINLADEN_HTML = '<div class="pk-hinweis">Hat die Adresse schon ein DealPilot-Konto, bekommt der Kunde eine Anfrage in seiner App und bestätigt sie dort. Sonst geht eine Einladung per E-Mail raus.</div>' +
    '<label class="pk-feld">Name des Kunden<input type="text" id="pk-e-name" maxlength="120"></label>' +
    '<label class="pk-feld">E-Mail<input type="email" id="pk-e-mail" maxlength="200"></label>' +
    '<label class="pk-wahl"><input type="radio" name="pk-e-art" value="platz" checked><span><b>Mit Partnerplatz</b>Du bezahlst seinen Zugang und bestimmst Stufe, Rechte und Marke. Hat er ein eigenes Abo, wird er ohne Platz verbunden.</span></label>' +
    '<label class="pk-wahl"><input type="radio" name="pk-e-art" value="eigen"><span><b>Ohne Platz</b>Der Kunde nutzt seinen eigenen Plan und schickt dir nur, was er freigibt.</span></label>';
  var CODE_HTML = '<div class="pk-hinweis">Den Code erzeugt dein Kunde in DealPilot unter „Mein Partner“ bzw. in den Einstellungen. Er gilt 24 Stunden und nur einmal. Danach bestätigt der Kunde die Verbindung in seiner App.</div>' +
    '<label class="pk-feld">Code<input type="text" id="pk-c-code" maxlength="12" placeholder="XXXX-XXXX" style="text-transform:uppercase;font-family:&quot;JetBrains Mono&quot;,monospace;letter-spacing:.1em"></label>' +
    '<label class="pk-feld">Name des Kunden (für deine Liste)<input type="text" id="pk-c-name" maxlength="120"></label>' +
    '<label class="pk-wahl"><input type="checkbox" id="pk-c-platz" checked><span><b>Partnerplatz mitgeben</b>Nur wenn der Kunde kein eigenes Abo hat.</span></label>';
  function einladenSenden(d, el) {
    var name = wert(d, '#pk-e-name'), mail = wert(d, '#pk-e-mail');
    if (!String(name).trim() || !/@/.test(String(mail))) { toast('Bitte Name und E-Mail eintragen.'); return false; }
    var art = (d.querySelector('input[name="pk-e-art"]:checked') || {}).value;
    return api('/partner/einladen', { method: 'POST', body: { name: name, email: mail, platz_mitgeben: art !== 'eigen' } }).then(function () { toast('Einladung gesendet.'); return neuLaden(el); });
  }
  function codeSenden(d, el) {
    return api('/partner/code', { method: 'POST', body: { code: wert(d, '#pk-c-code'), name: wert(d, '#pk-c-name'), platz_mitgeben: wert(d, '#pk-c-platz') } })
      .then(function () { toast('Anfrage gesendet. Der Kunde bestätigt sie in seiner App.'); return neuLaden(el); });
  }
  function einladenDialog(el) {
    dialog('Kunden einladen', EINLADEN_HTML, [{ t: 'Abbrechen' }, { t: 'Einladen', c: 'gold', fn: function (d) { return einladenSenden(d, el); } }]);
  }
  function codeDialog(el) {
    dialog('Verbindungscode eingeben', CODE_HTML, [{ t: 'Abbrechen' }, { t: 'Anfrage senden', c: 'gold', fn: function (d) { return codeSenden(d, el); } }]);
  }

  /* v3640 · Kundennummer je Partner (K-JJJJ-NNN, vom Backend vergeben, hier aenderbar) */
  function nrEtikett(nr) { return nr ? '<span class="pk-nr">' + esc(nr) + '</span>' : ''; }
  function kundeNrVon(clientId) {
    var k = S.partner && (S.partner.kunden || []).filter(function (x) { return x.id === clientId; })[0];
    return k ? k.kundennummer || null : null;
  }
  function nrFeld(k) {
    return '<label class="pk-feld">Kundennummer<input type="text" id="pk-k-nr" maxlength="30" value="' + esc(k.kundennummer || '') + '" placeholder="K-' + new Date().getFullYear() + '-001">' +
      '<small style="display:block;font-size:11.5px;color:#7A7370;margin-top:3px">Vergibt DealPilot fortlaufend je Jahr. Du kannst sie ändern, sie muss bei dir eindeutig sein.</small></label>';
  }
  /* v3460 · Mail bei Rueckmeldung - je Kunde, Vorgabe an (NULL/undefined aus aelterem Stand = an) */
  function mailSchalter(k) {
    return '<div class="pk-gruppe">Benachrichtigung</div>' +
      '<label class="pk-schalter"><span>E-Mail an den Kunden bei Rückmeldung<small>Wenn du Anmerkungen mit „Zurück an Kunden“ zurückgibst, bekommt er eine E-Mail in deiner Marke mit Objekt, Zahl der Anmerkungen und deinem Begleittext. Vorgabe an.</small></span>' +
      '<input type="checkbox" id="pk-k-mailrm"' + (k.mail_rueckmeldung !== false ? ' checked' : '') + '></label>';
  }
  /* ── v3640c · Fenster im Stil des RND-Rechners (Marcel 17.11.2026: „Unter Stufen und Rechte ist das Modal sehr lang.
     Kann man das so machen wie das Modal der RND? Auch das Design?“). DIESELBEN Bausteine wie rnd-wizard.js und
     gutachterpartner.js (css/rnd-styles.css, v3258): .rnd-wiz-overlay.rnd-hub, .rnd-wiz-modal, .rnd-wiz-header,
     Schrittleiste .rnd-wiz-steps/.rnd-hub-schritt mit .rnd-hub-nr/.rnd-hub-kurz, Balken, .rnd-hub-karte, .rnd-hub-zeile,
     .rnd-hub-chip, .rnd-wiz-field, Fuss .rnd-wiz-footer.rnd-hub-nav. rnd-wizard.js selbst bleibt unberuehrt.
     Reiter sind frei anklickbar (nichts wird gerechnet), gespeichert wird einmal unten.
     o: { id, titel, sub, reiter: [{ kurz, titel, html }], knoepfe: [{ t, pri, fn(box) }], inline: Element|null, start } */
  function hubAufbauen(o) {
    stil();
    var alt = o.id ? document.getElementById(o.id) : null; if (alt) alt.remove();
    var box = document.createElement('div'); if (o.id) box.id = o.id;
    box.className = 'rnd-wiz-overlay rnd-hub dppk-hub' + (o.inline ? ' dppk-hub-inline' : '');
    box.innerHTML = '<div class="rnd-wiz-modal"' + (o.inline ? '' : ' role="dialog" aria-modal="true"') + ' aria-label="' + esc(o.titel) + '">' +
      '<div class="rnd-wiz-header"><div class="rnd-wiz-title"><h2>' + esc(o.titel) + '</h2><p class="rnd-wiz-sub" data-hub-sub></p></div>' +
      (o.inline ? '' : '<button type="button" class="rnd-wiz-close" aria-label="Schließen">&times;</button>') + '</div>' +
      '<div class="rnd-wiz-progress rnd-hub-leiste"><div class="rnd-wiz-steps rnd-hub-schritte" data-hub-schritte></div>' +
      '<div class="rnd-hub-balken"><div class="rnd-wiz-progress-bar" data-hub-balken></div></div></div>' +
      '<div class="rnd-wiz-body" data-hub-inhalt>' + o.reiter.map(function (r, i) { return '<div class="dppk-hub-reiter" data-hub-r="' + i + '"' + (i ? ' hidden' : '') + '>' + r.html + '</div>'; }).join('') + '</div>' +
      '<div class="rnd-wiz-footer rnd-hub-nav"><button type="button" class="rnd-wiz-btn rnd-wiz-btn-sec rnd-hub-zurueck" data-hub-zurueck>← Zurück</button>' +
      '<div class="rnd-wiz-counter" data-hub-zaehler></div>' +
      (o.knoepfe || []).map(function (k, i) { return '<button type="button" class="rnd-wiz-btn ' + (k.pri ? 'rnd-wiz-btn-pri' : 'rnd-wiz-btn-sec') + '" data-hub-k="' + i + '">' + esc(k.t) + '</button>'; }).join('') +
      '<button type="button" class="rnd-wiz-btn rnd-wiz-btn-sec rnd-hub-weiter" data-hub-weiter>Weiter →</button></div></div>';
    if (o.inline) { o.inline.innerHTML = ''; o.inline.appendChild(box); } else document.body.appendChild(box);
    var akt = 0, n = o.reiter.length;
    function zu() { box.remove(); document.removeEventListener('keydown', esc1, true); }
    function esc1(e) { if (e.key === 'Escape' && document.body.contains(box) && !document.getElementById('dppk-dlg')) zu(); }
    function zeigen(i) {
      akt = Math.max(0, Math.min(n - 1, i));
      [].forEach.call(box.querySelectorAll('[data-hub-r]'), function (d) { d.hidden = +d.getAttribute('data-hub-r') !== akt; });
      var l = box.querySelector('[data-hub-schritte]'); l.innerHTML = '';
      o.reiter.forEach(function (r, ri) {
        var b = document.createElement('button'); b.type = 'button';
        b.className = 'rnd-wiz-step rnd-hub-schritt' + (ri === akt ? ' active' : '') + (ri < akt ? ' done' : '');
        b.innerHTML = '<span class="rnd-hub-nr">' + (ri + 1) + '</span><em class="rnd-hub-kurz">' + esc(r.kurz) + '</em>';
        b.title = r.titel; if (ri === akt) b.setAttribute('aria-current', 'step');
        b.onclick = function () { zeigen(ri); };
        l.appendChild(b);
      });
      box.querySelector('[data-hub-balken]').style.width = (n > 1 ? akt / (n - 1) * 100 : 100) + '%';
      box.querySelector('[data-hub-sub]').textContent = (o.sub ? o.sub + ' · ' : '') + o.reiter[akt].titel;
      box.querySelector('[data-hub-zaehler]').textContent = 'Reiter ' + (akt + 1) + ' von ' + n;
      box.querySelector('[data-hub-zurueck]').style.visibility = akt > 0 ? 'visible' : 'hidden';
      box.querySelector('[data-hub-weiter]').style.visibility = akt < n - 1 ? 'visible' : 'hidden';
      var inh = box.querySelector('[data-hub-inhalt]'); if (inh) inh.scrollTop = 0;
    }
    box.querySelector('[data-hub-zurueck]').onclick = function () { zeigen(akt - 1); };
    box.querySelector('[data-hub-weiter]').onclick = function () { zeigen(akt + 1); };
    var x = box.querySelector('.rnd-wiz-close'); if (x) x.onclick = zu;
    if (!o.inline) { box.addEventListener('click', function (e) { if (e.target === box) e.stopPropagation(); }); document.addEventListener('keydown', esc1, true); }   /* wie der RND-Rechner: daneben klicken schliesst nicht */
    [].forEach.call(box.querySelectorAll('[data-hub-k]'), function (b) {
      var k = o.knoepfe[+b.getAttribute('data-hub-k')];
      b.onclick = function () {
        if (!k.fn) return zu();
        b.disabled = true;
        Promise.resolve(k.fn(box)).then(function (r) { b.disabled = false; if (r !== false && !o.inline) zu(); }, function (e) { b.disabled = false; toast(fehlerText(e)); });
      };
    });
    zeigen(o.start || 0);
    box._zu = zu; box._zeigen = zeigen;
    return box;
  }
  function hubZeile(titel, text, rechts) {
    return '<div class="rnd-hub-zeile"><div class="rnd-hub-zeile-text"><b>' + esc(titel) + '</b>' + (text ? '<span>' + esc(text) + '</span>' : '') + '</div>' + (rechts || '') + '</div>';
  }
  function hubChips(name, werte, wahl, gesperrt) {
    return '<div class="rnd-hub-chips' + (gesperrt ? ' dppk-fest' : '') + '">' + werte.map(function (w) {
      return '<label class="rnd-hub-chip"><input type="radio" name="' + name + '" value="' + esc(w[0]) + '"' + (String(w[0]) === String(wahl) ? ' checked' : '') + (gesperrt ? ' disabled' : '') + '>' + esc(w[1]) + '</label>';
    }).join('') + '</div>';
  }
  var STUFEN_TEXT = { 1: 'Kennzahlen, Cashflow und Score. Die wichtigsten Felder.', 2: 'Zusätzlich Finanzierung im Detail, Steuer und Mietentwicklung.', 3: 'Alle Felder, dazu die Wertermittlung im Marktbericht.' };
  /* Inhalt der Reiter „Stufe“, „Rechte“, „Kontingente & Netzwerk“, „Marke“ - beim Partner zum Einstellen, beim Kunden
     (Mein Partner › Freigaben) dieselben Karten nur lesend (gesperrt) */
  function freigabeReiter(k, partnerName, gesperrt) {
    var r = k.rechte_wirksam || k.rechte || {};
    var fest = gesperrt ? '<p class="rnd-hub-hinweis">Das legt dein Partner fest.</p>' : '';
    return [
      { kurz: 'Stufe', titel: 'Detailgrad der App', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Stufe</h3>' + fest + '<div class="rnd-wiz-mod-list">' +
        [1, 2, 3].map(function (s) { return hubZeile(STUFEN[s], STUFEN_TEXT[s], hubChips('pk-k-stufe', [[s, (k.stufe || 2) === s ? 'gewählt' : 'wählen']], (k.stufe || 2), gesperrt)); }).join('') + '</div></section>' },
      { kurz: 'Rechte', titel: 'Was der Platz darf', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Rechte des Platzes</h3>' +
        (gesperrt ? fest : '<p class="rnd-hub-hinweis">Ein Platz umfasst höchstens den Investor-Plan. Hier schaltest du Teile ab.</p>') + '<div class="rnd-wiz-mod-list">' +
        RECHTE_TEXT.filter(function (x) { return !/^e_/.test(x[0]); }).map(function (x) { return hubZeile(x[1], x[2], hubChips('pk-r-' + x[0], [['an', 'an'], ['aus', 'aus']], r[x[0]] !== false ? 'an' : 'aus', gesperrt)); }).join('') + '</div></section>' },
      /* gemessen 17.11.2026 bei 1582 x 832: zehn Rechte in einem Reiter brauchten 710 px bei 553 px Platz - die drei
         Einstellungs-Rechte stehen deshalb im eigenen Reiter */
      { kurz: 'Einstellungen', titel: 'Was der Kunde in den Einstellungen ändern darf', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Einstellungen</h3>' + fest + '<div class="rnd-wiz-mod-list">' +
        RECHTE_TEXT.filter(function (x) { return /^e_/.test(x[0]); }).map(function (x) { return hubZeile(x[1], x[2], hubChips('pk-r-' + x[0], [['an', 'an'], ['aus', 'aus']], r[x[0]] !== false ? 'an' : 'aus', gesperrt)); }).join('') + '</div></section>' },
      { kurz: 'Kontingente', titel: 'Marktberichte und Partnernetzwerk', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Kontingente</h3>' + fest +
        '<div class="rnd-wiz-grid rnd-hub-felder"><div class="rnd-wiz-field"><label for="pk-k-mb">Marktberichte je Monat</label><input type="number" id="pk-k-mb" min="0" max="10" placeholder="wie Investor" value="' + (k.kontingent && k.kontingent.marktbericht != null ? k.kontingent.marktbericht : '') + '"' + (gesperrt ? ' disabled' : '') + '>' +
        '<span class="rnd-wiz-hint">Höchstens 10, leer heißt wie im Investor-Plan.</span></div></div></section>' +
        '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Partnernetzwerk</h3><div class="rnd-wiz-mod-list">' +
        hubZeile('Partnernetzwerk zeigen', 'Makler, Finanzierer und Gutachter aus deinem Netzwerk. Vorgabe aus.', hubChips('pk-k-netz', [['an', 'an'], ['aus', 'aus']], k.netzwerk ? 'an' : 'aus', gesperrt)) + '</div></section>' },
      { kurz: 'Marke', titel: 'In welcher Marke der Kunde die App sieht', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Marke beim Kunden</h3>' + fest + '<div class="rnd-wiz-mod-list">' +
        hubZeile(gesperrt ? 'Marke deines Partners' : 'Deine Marke', partnerName || '', hubChips('pk-k-marke', [['partner', k.marke !== 'dealpilot' ? 'gewählt' : 'wählen']], k.marke !== 'dealpilot' ? 'partner' : '', gesperrt)) +
        hubZeile('DealPilot', '', hubChips('pk-k-marke', [['dealpilot', k.marke === 'dealpilot' ? 'gewählt' : 'wählen']], k.marke === 'dealpilot' ? 'dealpilot' : '', gesperrt)) + '</div></section>' }
    ];
  }
  function chipWert(box, name) { var x = box.querySelector('input[name="' + name + '"]:checked'); return x ? x.value : null; }
  function kundeReiter(k) {
    return { kurz: 'Kunde', titel: 'Kundennummer, Notiz und E-Mail', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Kunde</h3>' +
      '<div class="rnd-wiz-grid rnd-hub-felder"><div class="rnd-wiz-field"><label for="pk-k-nr">Kundennummer</label><input type="text" id="pk-k-nr" maxlength="30" value="' + esc(k.kundennummer || '') + '" placeholder="K-' + new Date().getFullYear() + '-001">' +
      '<span class="rnd-wiz-hint">Vergibt DealPilot fortlaufend je Jahr. Du kannst sie ändern, sie muss bei dir eindeutig sein.</span></div>' +
      '<div class="rnd-wiz-field"><label>Zugang</label><input type="text" disabled value="' + (k.platz_art === 'platz' ? 'Partnerplatz' : 'eigener Plan') + ', ' + esc(k.email || '') + '"></div>' +
      '<div class="rnd-wiz-field rnd-wiz-col-2"><label for="pk-k-notiz">Notiz (nur dein Team)</label><textarea id="pk-k-notiz" maxlength="2000" rows="3">' + esc(k.notiz || '') + '</textarea></div></div></section>' +
      '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Benachrichtigung</h3><div class="rnd-wiz-mod-list">' +
      hubZeile('E-Mail an den Kunden bei Rückmeldung', 'Bei „Zurück an Kunden“ eine E-Mail in deiner Marke mit Objekt, Zahl der Anmerkungen und Begleittext.', hubChips('pk-k-mailrm', [['an', 'an'], ['aus', 'aus']], k.mail_rueckmeldung !== false ? 'an' : 'aus')) +
      '</div></section>' };
  }
  function kundeDialog(el, id) {
    var k = S.partner.kunden.filter(function (x) { return x.id === id; })[0]; if (!k) return;
    var platz = k.platz_art === 'platz';
    var reiter = [kundeReiter(k)];
    if (platz) {
      reiter = reiter.concat(freigabeReiter(k, S.partner.partner.name, false));
      reiter.push({ kurz: 'Platz', titel: 'Partnerplatz entziehen', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Platz</h3><p class="rnd-hub-hinweis"><strong>Platz entziehen:</strong> der Kunde bekommt 30 Tage Frist zum Export oder für ein eigenes Abo. Danach werden seine Verbindungen getrennt und sein Konto gelöscht.</p>' +
        '<div><button type="button" class="pk-btn rot" data-hub-entzug style="border:1px solid #B8625C;background:#B8625C;color:#fff;border-radius:7px;padding:8px 14px;font:600 13px Inter,sans-serif;cursor:pointer">Platz entziehen …</button></div></section>' });
    } else {
      reiter.push({ kurz: 'Freigaben', titel: 'Stufe, Rechte und Marke', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Eigener Plan</h3><p class="rnd-hub-hinweis">Der Kunde bezahlt selbst. Stufe, Rechte und Marke bestimmt er in seiner App unter Mein Partner › Freigaben. Du siehst nur, was er dir sendet.</p></section>' });
    }
    var box = hubAufbauen({ id: 'dppk-hub-kunde', titel: (platz ? 'Stufe und Rechte · ' : 'Kunde · ') + (k.kundennummer ? k.kundennummer + ' · ' : '') + k.display_name, sub: platz ? 'Partnerplatz' : 'Eigener Plan', reiter: reiter,
      knoepfe: [{ t: 'Speichern', pri: true, fn: function (b) {
        var body = { kundennummer: wert(b, '#pk-k-nr'), notiz: wert(b, '#pk-k-notiz'), mail_rueckmeldung: chipWert(b, 'pk-k-mailrm') !== 'aus' };
        if (platz) {
          var rechte = {}; RECHTE_TEXT.forEach(function (x) { rechte[x[0]] = chipWert(b, 'pk-r-' + x[0]) !== 'aus'; });
          var mb = wert(b, '#pk-k-mb');
          Object.assign(body, { stufe: chipWert(b, 'pk-k-stufe'), marke: chipWert(b, 'pk-k-marke'), rechte: rechte, netzwerk: chipWert(b, 'pk-k-netz') === 'an', kontingent: mb === '' ? {} : { marktbericht: Number(mb) } });
        }
        return api('/partner/kunden/' + id, { method: 'PUT', body: body }).then(function () { toast('Gespeichert.'); neuLaden(el); });
      } }] });
    var ez = box.querySelector('[data-hub-entzug]'); if (ez) ez.onclick = function () { box._zu(); entzugDialog(el, k); };
    return box;
  }
  /* v3460 · Zeilen fuer den Pruefer: der Schalter steht in beiden Zugangsarten im Reiter Kunde (kundeReiter), gespeichert als mail_rueckmeldung */

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
      /* v3392 · Marcel 15.11.: „Unter Freigegeben fehlt mir, von welchem Kunden was freigegeben wurde.“
         Je Kunde ein Kopf (Name, E-Mail, Art des Zugangs), je Stand Objekt mit Anschrift, Art und Datum; Kundenfilter. */
      var g = {}, reihe = [];
      l.forEach(function (x) { var s = x.client_id || x.kunde; if (!g[s]) { g[s] = []; reihe.push(s); } g[s].push(x); });
      if (PK.filter && !g[PK.filter]) PK.filter = null;
      function adresse(x) { var a = [[x.str, x.hnr].filter(Boolean).join(' '), [x.plz, x.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '); return a || x.name || x.seq_no || 'Objekt'; }
      var h = reihe.length > 1 ? '<div class="pk-filter" role="group" aria-label="Kunde"><button type="button" data-f=""' + (PK.filter ? '' : ' class="an"') + '>Alle Kunden</button>' +
        reihe.map(function (s) { var neu = g[s].filter(function (x) { return !x.gelesen_am; }).length; return '<button type="button" data-f="' + esc(s) + '"' + (PK.filter === s ? ' class="an"' : '') + '>' + esc((g[s][0].kunde_nr ? g[s][0].kunde_nr + ' · ' : '') + (g[s][0].kunde || g[s][0].kunde_email)) + (neu ? ' · ' + neu + ' neu' : '') + '</button>'; }).join('') + '</div>' : '';
      h += reihe.filter(function (s) { return !PK.filter || PK.filter === s; }).map(function (s) {
        var e = g[s], k = e[0];
        return '<div class="pk-karte" style="margin-bottom:14px"><div class="pk-kundenkopf"><b>' + nrEtikett(k.kunde_nr) + esc(k.kunde || k.kunde_email) + '</b><small>' + esc([k.kunde ? k.kunde_email : '', k.kunde_platz_art === 'platz' ? 'Partnerplatz' : 'eigener Plan', e.length + (e.length === 1 ? ' Objekt freigegeben' : ' Objekte freigegeben'), k.getrennt_am ? 'getrennt' : ''].filter(Boolean).join(' · ')) + '</small></div>' +
          e.map(function (x) {
            var art = (x.ueber_bestand || x.deal_won ? 'Bestand' : 'Ankauf') + (x.objart ? ', ' + x.objart : '');
            var stand = x.stand_nr > 1 ? 'Stand ' + x.stand_nr + ', aktualisiert' : 'erster Stand';
            return '<div class="pk-zeile"><div class="pk-name"><b>' + esc(adresse(x)) + '</b><small>' + esc([art, stand, 'freigegeben am ' + datum(x.stand_am)].join(' · '))   /* seq_no der Kopie (K-…) sagt dem Partner nichts */ + '</small></div>' +
              (x.gelesen_am ? '' : '<span class="pk-chip gruen">neu</span>') +
              (x.anm_offen ? '<span class="pk-chip">' + x.anm_offen + ' Anmerkung' + (x.anm_offen === 1 ? '' : 'en') + ' beim Kunden</span>' : '') +
              /* v3640 · Rueckfrage (offen mit Antwort des Kunden) eigener Chip, erledigt gruen */
              (x.anm_rueckfrage ? '<span class="pk-chip frage">' + x.anm_rueckfrage + (x.anm_rueckfrage === 1 ? ' Rückfrage' : ' Rückfragen') + '</span>' : '') +
              (x.anm_erledigt ? '<span class="pk-chip gruen">' + x.anm_erledigt + ' erledigt</span>' : '') +
              (x.anm_entwurf ? '<span class="pk-chip grau">' + x.anm_entwurf + ' Entwurf' + (x.anm_entwurf === 1 ? '' : 'e') + '</span>' : '') +
              (x.uebernommen_id ? '<span class="pk-chip grau" title="Schon als eigenes Objekt übernommen">übernommen als ' + esc(x.uebernommen_seq || 'Objekt') + '</span>' : '') +
              '<button type="button" class="pk-btn klein gold" data-laden="' + x.kopie_object_id + '" data-s="' + x.share_id + '">Ansehen</button>' +
              '<button type="button" class="pk-btn klein" data-ueb="' + x.share_id + '">' + (x.uebernommen_id ? 'Erneut übernehmen' : 'Als eigenes Objekt übernehmen') + '</button></div>';
          }).join('') + '</div>';
      }).join('');
      el.innerHTML = h;
      [].forEach.call(el.querySelectorAll('[data-f]'), function (b) { b.onclick = function () { PK.filter = b.getAttribute('data-f') || null; staendeZeichnen(el); }; });
      [].forEach.call(el.querySelectorAll('[data-laden]'), function (b) {
        b.onclick = function () {
          api('/partner/kundenstaende/' + b.getAttribute('data-s') + '/geoeffnet', { method: 'POST' }).catch(function () {});
          PK.herkunft = PK.offen ? PK.aktiv : 'staende';   /* v3450 · fuer „Zurück zum Partner-Cockpit“ */
          var ov = document.getElementById('dppk-ov'); if (ov) ov.remove();
          try { if (typeof setMainView === 'function') setMainView('single'); } catch (e) {}
          if (typeof window.loadSaved === 'function') window.loadSaved(b.getAttribute('data-laden'));
        };
      });
      [].forEach.call(el.querySelectorAll('[data-ueb]'), function (b) {
        b.onclick = function () {
          var x = l.filter(function (y) { return y.share_id === b.getAttribute('data-ueb'); })[0] || {};
          uebernehmenDialog(x, function () { staendeZeichnen(el); });
        };
      });
    }, function (e) { el.innerHTML = '<div class="pk-leer">' + esc(fehlerText(e)) + '</div>'; });
  }

  /* v3640 · Übernehmen mit Kundenbezug. Gibt es zu diesem Kundenstand schon ein übernommenes Objekt: Rückfrage,
     Vorgabe „Bestehendes aktualisieren“ (Nummer, Halter und Deal-Status bleiben), sonst neue Kopie. */
  function uebernehmenDialog(x, danach) {
    var kunde = (x.kunde_nr ? x.kunde_nr + ' · ' : '') + (x.kunde || 'Kunde');
    function los(modus) {
      return api('/partner/kundenstaende/' + x.share_id + '/uebernehmen', { method: 'POST', body: { modus: modus } }).then(function (r) {
        toast((r.modus === 'aktualisiert' ? 'Aktualisiert: ' : 'Übernommen als ') + (r.seq_no || 'neues Objekt') + ', Kunde ' + kunde + '.');
        try { if (typeof window.renderSaved === 'function') window.renderSaved({ forceFresh: true }); } catch (e) {}
        if (danach) danach(r);
        return r;
      });
    }
    if (x.uebernommen_id) {
      return dialog('Erneut übernehmen', '<p>Diesen Kundenstand hast du schon übernommen, als <b>' + esc(x.uebernommen_seq || 'Objekt') + '</b>.</p>' +
        '<div class="pk-hinweis"><b>Bestehendes Objekt aktualisieren</b> übernimmt den neuen Stand des Kunden in dein Objekt. Objektnummer, Halter und Deal-Status bleiben. <b>Neue Kopie</b> legt ein weiteres Objekt an.</div>',
        [{ t: 'Abbrechen' }, { t: 'Neue Kopie', fn: function () { return los('neu'); } }, { t: 'Bestehendes aktualisieren', c: 'gold', fn: function () { return los('aktualisieren'); } }]);
    }
    return dialog('Als eigenes Objekt übernehmen', '<p>DealPilot legt eine eigene, bearbeitbare Kopie unter deinen Objekten an. Sie trägt den Kunden <b>' + esc(kunde) + '</b>, in der Objektliste kannst du danach nach Kunde sortieren und filtern. Sie bleibt bei dir, auch wenn der Kunde seinen Stand zurückzieht.</p>',
      [{ t: 'Abbrechen' }, { t: 'Übernehmen', c: 'gold', fn: function () { return los('aktualisieren'); } }]);
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
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + a.kunden.map(function (k) { var s = AUFG_STATUS[k.status] || [k.status, 'grau']; return '<span class="pk-chip ' + s[1] + '" title="' + esc(k.abgelehnt_grund || '') + '">' + esc((k.kundennummer ? k.kundennummer + ' ' : '') + k.display_name) + ': ' + s[0] + '</span>'; }).join('') + '</div></div>';
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
        return '<div class="pk-zeile"><div class="pk-name"><b>' + esc(m.text || m.art) + '</b><small>' + (m.kunde_nr ? esc(m.kunde_nr) + ' · ' : '') + new Date(m.erstellt_am).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</small></div>' + (m.gelesen_am ? '' : '<span class="pk-chip gruen">neu</span>') + '</div>';
      }).join('') : '<div class="pk-leer">Keine Meldungen.</div>';
      if (l.some(function (m) { return !m.gelesen_am; })) api('/partner/meldungen/gelesen', { method: 'POST' }).then(function () { if (S.partner) S.partner.meldungen_ungelesen = 0; menuePflegen(); }).catch(function () {});
    });
  }

  /* ════ MEIN PARTNER (Kunde) ═════════════════════════════════════════════ */
  /* v3640b · im Arbeitsbereich wie das Partner-Cockpit (vorher eigenes Fenster #dppk-ov). start: 'senden' | 'sendungen' |
     'aufgaben' | 'freigaben' | 'verbindung' (alte Namen bleiben gueltig, Aufrufer in messe-drehbuch.js und Mails) */
  function meinPartnerOeffnen(start) {
    return api('/mein-partner').then(function (m) {
      S.kunde = m; menuePflegen(); rechteAnwenden();
      var alt = document.getElementById('dppk-ov'); if (alt) alt.remove();
      arbeitsbereichZeigen('kunde', m.verbunden ? m.verbunden.partner_name : 'Mit einem Partner verbinden', start ? (/^k_/.test(start) ? start : 'k_' + start) : null);
    }, function (e) { toast(fehlerText(e)); });
  }

  /* v3640b · Reiter Freigaben (Kunde): dieselben Karten wie der Partner-Dialog „Stufe und Rechte“ (freigabeReiter), beim
     Partnerplatz nur lesend („legt dein Partner fest“), beim eigenen Plan waehlt der Kunde die Marke selbst. */
  function freigabenZeichnen(el) {
    var v = S.kunde && S.kunde.verbunden; if (!v) return verbindenZeichnen(el);
    var platz = v.platz_art === 'platz';
    var ueber = { kurz: 'Überblick', titel: 'Was dein Partner sieht', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Dein Partner sieht</h3><div class="rnd-wiz-mod-list">' +
      hubZeile('Nur, was du sendest', 'Objekte gehen als Kopie an ' + v.partner_name + '. Deine übrigen Objekte sieht er nie.', '') +
      hubZeile('Anmerkungen und Aufgaben', 'Er kann dir Rückmeldungen und Bitten schicken, du antwortest in deinem Objekt.', '') +
      hubZeile('Zugang', platz ? 'Partnerplatz, dein Partner bezahlt und legt Stufe, Rechte und Marke fest.' : 'Eigener Plan, du bezahlst selbst und bestimmst alles.', '') +
      (v.kundennummer ? hubZeile('Deine Kundennummer', v.kundennummer, '') : '') + '</div></section>' };
    var reiter = [ueber], knoepfe = [];
    if (platz) reiter = reiter.concat(freigabeReiter(v, v.partner_name, true));
    else {
      reiter.push({ kurz: 'Marke', titel: 'In welcher Marke du die App siehst', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Marke</h3><p class="rnd-hub-hinweis">Das bestimmst du selbst. Die Marke wechselt beim nächsten Laden.</p><div class="rnd-wiz-mod-list">' +
        hubZeile('DealPilot', '', hubChips('pk-m', [['dealpilot', v.marke !== 'partner' ? 'gewählt' : 'wählen']], v.marke !== 'partner' ? 'dealpilot' : '')) +
        hubZeile('Marke von ' + v.partner_name, '', hubChips('pk-m', [['partner', v.marke === 'partner' ? 'gewählt' : 'wählen']], v.marke === 'partner' ? 'partner' : '')) + '</div></section>' });
      reiter.push({ kurz: 'Rechte', titel: 'Stufe und Rechte', html: '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Stufe und Rechte</h3><p class="rnd-hub-hinweis">Mit eigenem Plan gilt dein Plan. Dein Partner schaltet nichts ab.</p></section>' });
      knoepfe.push({ t: 'Speichern', pri: true, fn: function (b) { var w = chipWert(b, 'pk-m'); return api('/mein-partner/marke', { method: 'PUT', body: { marke: w } }).then(function () { toast('Gespeichert. Die Marke wechselt beim nächsten Laden.'); if (S.kunde && S.kunde.verbunden) S.kunde.verbunden.marke = w; }); } });
    }
    hubAufbauen({ titel: platz ? 'Freigaben deines Partnerplatzes' : 'Freigaben', sub: v.partner_name, reiter: reiter, knoepfe: knoepfe, inline: el });
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
      var fehlt = fehlenJeObjekt();   /* v3640 */
      el.innerHTML = '<div class="pk-hinweis">Gesendet wird eine <b>Kopie</b> wie ein Export. ' + esc(v.partner_name) + ' sieht nur, was du sendest, nie deine übrigen Objekte. Senden ändert den Status des Objekts nicht. Erneut senden ersetzt den Stand beim Partner, zurückziehen löscht ihn dort.</div>' +
        '<label class="pk-schalter" style="border:1px solid #EDE6D6;border-radius:10px;padding:10px 12px;margin-bottom:10px;background:#fff"><span><b>Gesamter Bestand</b><small>alle ' + l.length + ' Objekte</small></span><input type="checkbox" id="pk-s-alle"></label>' +
        (l.length ? l.map(function (o) {
          var g = gesendet[o.id], f = fehlt[o.id], ch = !f && (vorwahl ? vorwahl(o) : false);
          return '<label class="pk-zeile" style="cursor:' + (f ? 'default' : 'pointer') + '"><input type="checkbox" data-obj="' + o.id + '"' + (ch ? ' checked' : '') + (f ? ' disabled data-gesperrt="1"' : '') + ' style="width:18px;height:18px;accent-color:' + G + '"><div class="pk-name"><b>' + esc(o.name || o.seq_no || 'Objekt') + '</b><small>' + esc([o.seq_no, o.ort].filter(Boolean).join(' · ')) + '</small>' +
            (f ? fehlenHinweis(f) : '') + '</div>' +
            (o.deal_won ? '<span class="pk-chip">Bestand</span>' : o.deal_lost ? '<span class="pk-chip grau">verloren</span>' : '<span class="pk-chip grau">Ankauf</span>') +
            (g ? '<span class="pk-chip ' + (g.seitdem_geaendert ? 'rot' : 'gruen') + '">Stand ' + g.stand_nr + ' vom ' + datum(g.stand_am) + (g.seitdem_geaendert ? ', seitdem geändert' : '') + '</span>' : '') + '</label>';
        }).join('') : '<div class="pk-leer">Du hast noch keine Objekte.</div>') +
        '<div class="pk-leiste" style="margin-top:12px"><button type="button" class="pk-btn gold" data-a="senden">An Partner senden</button></div>';
      var alle = el.querySelector('#pk-s-alle');
      alle.onchange = function () { [].forEach.call(el.querySelectorAll('[data-obj]'), function (x) { if (!x.disabled) x.checked = alle.checked; }); };
      fehlenKnoepfe(el);
      el.querySelector('[data-a="senden"]').onclick = function () {
        var ids = [].filter.call(el.querySelectorAll('[data-obj]'), function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-obj'); });
        if (!ids.length) return toast('Bitte mindestens ein Objekt wählen.');
        sendenDialog(ids, alle.checked, null, function () { meinPartnerOeffnen('sendungen'); });
      };
    });
  }

  /* v3640 · Senden nur, wenn jede Anmerkung des Partners bearbeitet ist (erledigt oder mit Antwort/Rückfrage).
     Das Backend sperrt (409 anmerkungen_offen mit fehlen[]), hier wird es vorher sichtbar: Objekt ausgegraut,
     Hinweis „Noch 2 Anmerkungen ohne Bearbeitung“ und Sprung zur ersten. */
  function fehlenJeObjekt() {
    var m = {}; ((S.kunde && S.kunde.anmerkungen_fehlen) || []).forEach(function (x) {
      var e = m[x.objekt_id] || (m[x.objekt_id] = { n: 0, aufgabe_id: x.aufgabe_id }); e.n += x.n;
    });
    return m;
  }
  function fehlenText(n) { return n === 1 ? 'Noch 1 Anmerkung ohne Bearbeitung' : 'Noch ' + n + ' Anmerkungen ohne Bearbeitung'; }
  function fehlenHinweis(f) {
    return '<div class="pk-fehlen">' + fehlenText(f.n) + '. Erledige sie oder schreib eine Antwort oder Rückfrage, dann kannst du senden. ' +
      (f.aufgabe_id ? '<button type="button" data-fehlen-zu="' + esc(f.aufgabe_id) + '">Zu den Anmerkungen</button>' : '') + '</div>';
  }
  function fehlenKnoepfe(el) {
    [].forEach.call(el.querySelectorAll('[data-fehlen-zu]'), function (b) {
      b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); var d = document.getElementById('dppk-dlg'); if (d) d.remove(); if (window.DpAnmerkungen) DpAnmerkungen.kundeOeffnen(b.getAttribute('data-fehlen-zu')); };
    });
  }
  /* Stand der Anmerkungen frisch holen: wer gerade geantwortet hat, soll nicht am alten Stand haengen */
  function sendenDialog(ids, bestand, aufgabeId, danach) {
    return api('/mein-partner').then(function (m) { if (m && m.verbunden) S.kunde = m; }, function () {})
      .then(function () { return sendenDialogZeigen(ids, bestand, aufgabeId, danach); });
  }
  function sendenDialogZeigen(ids, bestand, aufgabeId, danach) {
    var v = S.kunde.verbunden;
    var fehlt = fehlenJeObjekt(), gesperrt = ids.filter(function (id) { return fehlt[id]; });
    if (gesperrt.length && !bestand) {
      var f0 = fehlt[gesperrt[0]], n = gesperrt.reduce(function (a, id) { return a + fehlt[id].n; }, 0);
      var d0 = dialog('Erst die Anmerkungen bearbeiten', '<div class="pk-fehlen">' + fehlenText(n) + '. Dein Partner hat dir Anmerkungen zurückgegeben. Erledige jede oder schreib eine Antwort oder Rückfrage, dann kannst du senden. ' +
        (f0.aufgabe_id ? '<button type="button" data-fehlen-zu="' + esc(f0.aufgabe_id) + '">Zu den Anmerkungen</button>' : '') + '</div>', [{ t: 'Schließen' }]);
      fehlenKnoepfe(d0);
      return d0;
    }
    dialog('An Partner senden', '<p>' + (bestand ? 'Dein gesamter Bestand (' + ids.length + ' Objekte) geht' : (ids.length === 1 ? 'Ein Objekt geht' : ids.length + ' Objekte gehen')) + ' als Kopie an <b>' + esc(v.partner_name) + '</b>.</p>' +
      (bestand && gesperrt.length ? '<div class="pk-fehlen">' + (gesperrt.length === 1 ? '1 Objekt bleibt' : gesperrt.length + ' Objekte bleiben') + ' zurück, weil dort noch Anmerkungen ohne Bearbeitung stehen.</div>' : '') +
      '<div class="pk-hinweis">Dein Partner kann die Kopie laden, rechnen, PDFs erstellen und als eigenes Objekt übernehmen. Eine übernommene Kopie bleibt bei ihm, auch wenn du später zurückziehst. Deine Originale ändert er nie.</div>',
      [{ t: 'Abbrechen' }, { t: 'Senden', c: 'gold', fn: function () {
        return api('/mein-partner/senden', { method: 'POST', body: bestand ? { bestand: true, aufgabe_id: aufgabeId } : { object_ids: ids, aufgabe_id: aufgabeId } })
          .then(function (r) { toast(r.gesendet + (r.gesendet === 1 ? ' Objekt' : ' Objekte') + ' gesendet.' + (r.uebersprungen ? ' ' + r.uebersprungen + ' mit offenen Anmerkungen nicht.' : '')); if (danach) danach(); },
            function (e) { if (e && e.data && e.data.error === 'anmerkungen_offen') { api('/mein-partner').then(function (m) { S.kunde = m; }).catch(function () {}); } throw e; });
      } }]);
  }

  function sendungenZeichnen(el) {
    var l = S.kunde.sendungen || [];
    var fehlt = fehlenJeObjekt();   /* v3640 */
    el.innerHTML = l.length ? l.map(function (s) {
      var f = fehlt[s.object_id];
      return '<div class="pk-zeile"><div class="pk-name"><b>' + esc(s.name || s.seq_no || 'Objekt') + '</b><small>Stand ' + s.stand_nr + ' vom ' + datum(s.stand_am) + (s.gelesen_am ? ' · vom Partner geöffnet' : ' · noch nicht geöffnet') + '</small>' + (f ? fehlenHinweis(f) : '') + '</div>' +
        (s.seitdem_geaendert ? '<span class="pk-chip rot">seitdem geändert</span>' : '<span class="pk-chip gruen">aktuell</span>') +
        '<button type="button" class="pk-btn klein" data-neu="' + s.object_id + '"' + (f ? ' disabled title="' + esc(fehlenText(f.n)) + '"' : '') + '>Neuen Stand senden</button><button type="button" class="pk-btn klein rot" data-zz="' + s.id + '">Zurückziehen</button></div>';
    }).join('') : '<div class="pk-leer">Du hast noch nichts gesendet.</div>';
    fehlenKnoepfe(el);
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
      /* v3450 · Rückmeldung des Partners zu einem gesendeten Objekt: Anmerkungen am eigenen Objekt ansehen */
      if (a.art === 'rueckmeldung') return '<div class="pk-zeile" style="display:block"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="pk-name"><b>' + esc(a.titel) + '</b><small>' +
          (a.anmerkungen || 0) + (a.anmerkungen === 1 ? ' Anmerkung' : ' Anmerkungen') + (a.anmerkungen_offen ? ', ' + a.anmerkungen_offen + ' offen' : ', alle erledigt') + (a.stand_nr ? ' · zu Stand ' + a.stand_nr : '') + '</small></div><span class="pk-chip ' + s[1] + '">' + s[0] + '</span></div>' +
        (a.text ? '<p style="margin:8px 0;font-size:13px;line-height:1.5">' + esc(a.text) + '</p>' : '') +
        '<div class="pk-leiste" style="margin:8px 0 0"><button type="button" class="pk-btn klein gold" data-rm="' + a.id + '">Im Objekt ansehen</button></div></div>';
      return '<div class="pk-zeile" style="display:block"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="pk-name"><b>' + esc(a.titel) + '</b><small>' + (a.faellig_am ? 'fällig ' + datum(a.faellig_am) : 'ohne Frist') + '</small></div><span class="pk-chip ' + s[1] + '">' + s[0] + '</span></div>' +
        (a.text ? '<p style="margin:8px 0;font-size:13px;line-height:1.5">' + esc(a.text) + '</p>' : '') +
        (a.status === 'erledigt' || a.status === 'abgelehnt' ? '' : '<div class="pk-leiste" style="margin:8px 0 0">' +
          (a.status !== 'in_arbeit' ? '<button type="button" class="pk-btn klein" data-st="in_arbeit" data-id="' + a.id + '">Ich bin dran</button>' : '') +
          '<button type="button" class="pk-btn klein gold" data-send="' + a.id + '" data-f="' + esc(a.objektfilter) + '">Erledigt und senden</button>' +
          '<button type="button" class="pk-btn klein" data-st="erledigt" data-id="' + a.id + '">Erledigt ohne Senden</button>' +
          '<button type="button" class="pk-btn klein rot" data-ab="' + a.id + '">Ablehnen</button></div>') + '</div>';
    }).join('') : '<div class="pk-leer">Keine Aufgaben von deinem Partner.</div>';
    l.forEach(function (a) { if (a.status === 'offen') api('/mein-partner/aufgaben/' + a.id, { method: 'POST', body: { status: 'gesehen' } }).catch(function () {}); });
    [].forEach.call(el.querySelectorAll('[data-rm]'), function (b) { b.onclick = function () { if (window.DpAnmerkungen) DpAnmerkungen.kundeOeffnen(b.getAttribute('data-rm')); }; });
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
    el.innerHTML = '<div class="pk-hinweis">' + zug + ' Verbunden seit ' + datum(v.verbunden_am) + '.' + (v.kundennummer ? ' Deine Kundennummer bei ' + esc(v.partner_name) + ': <b>' + esc(v.kundennummer) + '</b>.' : '') + ' Was dein Zugang darf, steht unter <button type="button" class="pk-mehr" data-geh-k="k_freigaben">Freigaben</button>.</div>' +
      (v.entzug_frist_bis ? '<div class="pk-hinweis rot">Dein Partnerplatz wurde entzogen. Bis <b>' + datum(v.entzug_frist_bis) + '</b> kannst du deine Daten exportieren oder ein eigenes Abo abschließen, dann bleibt alles erhalten. Ohne eigenes Abo werden danach dein Konto und deine Daten gelöscht.</div>' : '') +
      (aus.length ? '<div class="pk-gruppe">Von deinem Partner ausgeschaltet</div><div style="font-size:13px;line-height:1.6">' + aus.map(esc).join(', ') + '</div>' : '') +
      '<div class="pk-gruppe">Verbindung</div><div class="pk-leiste">' + (v.entzug_frist_bis || v.platz_art === 'platz' ? '<button type="button" class="pk-btn" data-a="abo">Eigenes Abo abschließen</button>' : '') +
      '<button type="button" class="pk-btn" data-a="export">Meine Daten exportieren</button><button type="button" class="pk-btn rot" data-a="trennen">Verbindung trennen</button></div>';
    var gk = el.querySelector('[data-geh-k]'); if (gk) gk.onclick = function () { reiterWahl(gk.getAttribute('data-geh-k')); };   /* v3640b · Marke steht jetzt unter Freigaben */
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
      /* v3640b · auch ohne Verbindung (Verbindungscode), nur nicht fuer Partnerkonten - die Einstellungen fuehren nicht mehr dorthin */
      k.classList.toggle('dp-frei', !!(m && (m.verbunden || (S.partnerGeladen && !S.partner))));
      k.classList.toggle('dp-punkt', offen);
    }
    if (PK.offen && document.getElementById('dppk-tabzeile')) tabzeile();   /* v3390 · Zahlen an den Reitern */
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
    if (!ks) { if (alt) alt.remove(); try { if (window.DpAnmerkungen && DpAnmerkungen._zustand.modus === 'partner') DpAnmerkungen.ende(); } catch (e) {} return; }
    stil();
    if (alt && alt.getAttribute('data-share') === String(ks.share_id) && alt.getAttribute('data-stand') === String(ks.stand_nr)) return;   /* v3450 · nicht bei jedem Takt neu bauen */
    if (!alt) {
      alt = document.createElement('div'); alt.id = 'dppk-ks';
      var ziel = document.querySelector('.main-col .body') || document.querySelector('.main-col') || document.body;
      ziel.insertBefore(alt, ziel.firstChild);
    }
    /* v3450 · Marcel 15.11.: Zurück ins Cockpit, Anmerkungen (partner-anmerkungen.js), Übernehmen */
    alt.setAttribute('data-share', ks.share_id); alt.setAttribute('data-stand', ks.stand_nr);
    var ksNr = kundeNrVon(ks.client_id);   /* v3640 */
    alt.innerHTML = '<span class="dppk-ks-text"><b>Kundenstand von ' + (ksNr ? esc(ksNr) + ' · ' : '') + esc(ks.kunde || 'Kunde') + '</b>, Stand ' + esc(ks.stand_nr) + ' vom ' + datum(ks.stand_am) + '. Nur lesen, Änderungen werden nicht gespeichert.</span>' +
      '<span class="dppk-ks-knoepfe"><button type="button" class="pk-btn2" data-ks-a="zurueck">← Zurück zum Partner-Cockpit</button></span>' +
      '<button type="button" class="pk-btn">Als eigenes Objekt übernehmen</button>';
    alt.querySelector('[data-ks-a="zurueck"]').onclick = function () { kundenstandVerlassen(ks); };
    try { if (window.DpAnmerkungen && S.partner) DpAnmerkungen.partnerBanner(alt.querySelector('.dppk-ks-knoepfe'), ks); } catch (e) {}
    alt.querySelector('.pk-btn').onclick = function () {
      /* v3640 · derselbe Dialog wie in Freigegeben (Rückfrage bei schon übernommenem Stand) */
      api('/partner/kundenstaende').then(function (r) {
        var x = (r.kundenstaende || []).filter(function (y) { return y.share_id === ks.share_id; })[0] || { share_id: ks.share_id, kunde: ks.kunde, kunde_nr: ksNr };
        uebernehmenDialog(x, function (u) { if (u && u.object_id && typeof window.loadSaved === 'function') window.loadSaved(u.object_id); });
      }, function (e) { toast(fehlerText(e)); });
    };
  }
  /* v3450 · „← Zurück zum Partner-Cockpit“: Kundenkopie verlassen ohne Speichern (saveObj ist fuer Kundenstaende
     ohnehin gesperrt), Entwuerfe bleiben auf dem Server. Das zuletzt geladene EIGENE Objekt wird wieder geladen, damit
     hinter dem Cockpit keine Kundenkopie liegt; danach das Cockpit im Herkunftsreiter, in Freigegeben beim Kunden. */
  function kundenstandVerlassen(ks) {
    var reiter = PK.herkunft && TITEL[PK.herkunft] ? PK.herkunft : 'staende';
    if (reiter === 'staende' && ks && ks.client_id) PK.filter = ks.client_id;
    try { if (window.DpAnmerkungen) DpAnmerkungen.ende(); } catch (e) {}
    /* v3452 · gemessen 15.11.: wer erst lud und dann das Cockpit oeffnete, wartete bis zu 8 s (loadSaved sichert
       vorher) und bekam das Cockpit danach von dp:object-ready wieder zugeklappt. Jetzt: Cockpit sofort, das eigene
       Objekt laedt dahinter; solange gilt dp:object-ready nicht als Wechsel ins Objekt. */
    /* v3452a · gemessen: loadSaved stellt beim Laden selbst auf die Objektansicht um (setMainView) und schliesst so das
       Cockpit. Darum: ist es nach dem Laden zu und hat der Nutzer seitdem nichts anderes angeklickt, wieder oeffnen. */
    var ziel = PK.letztesEigenes, marke = PK.zurueckMarke = Date.now();
    cockpitOeffnen(reiter);
    if (ziel && ziel !== window._currentObjKey && typeof window.loadSaved === 'function') {
      PK.hintergrund = true;
      var frei = function () {
        setTimeout(function () {
          PK.hintergrund = false;
          if (PK.zurueckMarke === marke && !PK.offen) cockpitOeffnen(reiter);
        }, 900);
      };
      Promise.resolve(window.loadSaved(ziel)).then(frei, frei);
    }
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
    var neu = function () {
      try { if (!window._dppkKundenstand && window._currentObjKey) PK.letztesEigenes = window._currentObjKey; } catch (e) {}   /* v3450 */
      var r = alt.apply(this, arguments); Promise.resolve(r).then(function () { setTimeout(kundenstandPruefen, 50); }); return r;
    };
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

  /* ── Einstellungen: nur noch ein Verweis (v3640b, Marcel 17.11.2026: „Dann brauchen wir das unter Einstellungen nicht
     mehr.“). Verbindungscode, Freigaben und Trennen stehen unter Aktionen › Mein Partner. */
  function einstellungenErgaenzen() {
    var pane = document.querySelector('.st-pane[data-pane="account"]');
    if (!pane || pane.querySelector('#dppk-st')) return;
    var p = S.partner; if (p) return;   /* ein Partnerkonto verbindet sich nicht als Kunde */
    var c = document.createElement('p'); c.id = 'dppk-st'; c.className = 'hint';
    c.setAttribute('style', 'margin:14px 0 0;font:400 12.5px Inter,sans-serif');
    c.innerHTML = 'Mein Partner findest du jetzt unter <a href="#" data-mp="1">Aktionen › Mein Partner</a>.';
    c.querySelector('[data-mp]').onclick = function (e) { e.preventDefault(); try { if (typeof window.closeSettings === 'function') window.closeSettings(); } catch (x) {} meinPartnerOeffnen(); };
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
          PK.herkunft = 'staende';   /* v3450 · aus der Seitenleiste: zurueck in Freigegeben */
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
  /* v3460 · ?dp_partner=aufgaben (Link aus der Rueckmeldungs-Mail). Sofort gemerkt und aus der Adresse genommen,
     damit die Anmeldung ihn nicht verliert; eingeloest, sobald /mein-partner geladen ist. */
  (function () {
    try {
      var q = new URLSearchParams(location.search), w = q.get('dp_partner');
      if (w === 'aufgaben') { sessionStorage.setItem('dppk_ziel', w); q.delete('dp_partner'); history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q.toString() : '') + location.hash); }
    } catch (e) {}
  })();
  function zielEinloesen(m) {
    var z = null; try { z = sessionStorage.getItem('dppk_ziel'); sessionStorage.removeItem('dppk_ziel'); } catch (e) {}
    if (z === 'aufgaben' && m && m.verbunden) setTimeout(function () { meinPartnerOeffnen('aufgaben'); }, 600);
  }
  var _gestartet = false;
  function start() {
    if (_gestartet) return;
    var t = null; try { t = localStorage.getItem('ji_token'); } catch (e) {}
    if (!t || !window.Auth || !Auth.apiCall) return;
    _gestartet = true;
    stil();
    api('/mein-partner').then(function (m) { S.kunde = m; menuePflegen(); rechteAnwenden(); bandPflegen(); partnerzeile(); zielEinloesen(m); }).catch(function () {});
    api('/partner/cockpit').then(function (c) { S.partner = c; S.partnerGeladen = true; menuePflegen(); sbGruppe(); }).catch(function () { S.partner = null; S.partnerGeladen = true; menuePflegen(); });
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

  window.DpPartnerKunden = { cockpitOeffnen: cockpitOeffnen, cockpitSchliessen: cockpitSchliessen, sendenDialog: sendenDialog, kundenstandVerlassen: kundenstandVerlassen, reiterWahl: function (k) { if (PK.offen && PK.art === 'partner') reiterWahl(k); else cockpitOeffnen(k); }, meinPartnerOeffnen: meinPartnerOeffnen, einladungFragen: einladungFragen, darf: darf, _state: S };
  window.DpMeinPartner = { einladungFragen: einladungFragen };
})();
