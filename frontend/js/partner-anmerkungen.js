/* partner-anmerkungen.js · v3450 — Anmerkungen am Kundenstand (Partner) und Rueckmeldung am Original (Kunde)
 *
 * Marcel 15.11.2026: „Wenn ich mir als Partner ein freigegebenes Objekt anschaue und noch nicht uebernommen habe,
 * moechte ich vielleicht Anmerkungen machen und dem Kunden wieder zurueckschicken … wie bei unserem Mechaniker etwas
 * auswaehlen und markieren und dazu etwas schreiben. Der Kunde bekommt das dann passend.“
 *
 * Partner (Banner des Kundenstands, partner-kunden.js kundenstandPruefen):
 *   „Feld markieren“ -> Klick auf Eingabefeld, Kachel oder Abschnitt (alle Reiter) -> Fenster am Element: Text (Diktat),
 *   Art, bei Eingabefeldern ein Vorschlagswert. „Anmerkung“ = frei, ohne Feld. Goldrahmen mit Nummer an jeder Stelle,
 *   Seitenliste, Klick springt hin. „Zurueck an Kunden (n)“ buendelt die Entwuerfe zu einer Aufgabe (Backend
 *   services/partnerAnmerkungen.js, art 'rueckmeldung').
 * Kunde (Mein Partner › Aufgaben › „Im Objekt ansehen“): sein ORIGINAL-Objekt, dieselben Rahmen und dieselbe Liste,
 *   je Anmerkung „Erledigt“ und Antwort, „Vorschlag übernehmen“ nur auf Klick. Alles erledigt -> Aufgabe erledigt.
 *
 * Feldbezug: feld_id (id des Eingabefelds) vor selektor (Pfad ab dem naechsten Vorfahren mit id). Findet sich keins
 * von beiden (neuer Stand, anderer Detailgrad), bleibt die Anmerkung als freie in der Liste - nie ein falsches Feld.
 * Kundentexte: nur Punkt und Komma.
 * v3490 · Feldbeschriftung: Feldcontainer .f vor .row/section (Wohnfläche hiess „Straße“).
 * v3640 · Marcel 17.11.2026: „Besteht die Möglichkeit bei den Anmerkungen auch Bildausschnitte mitzuschicken und Sachen zu
 *   markieren? Das Zurückschicken zur Kanzlei sollte auch nur möglich sein, wenn alle Anmerkungen bearbeitet oder erledigt
 *   sind. Es kann auch eine Rückfrage dazu sein, aber man muss was gemacht haben.“
 *   Bild: im Anmerkungsfenster „Bildausschnitt“ (Bereich der Ansicht aufziehen, html2canvas liegt schon im Projekt fuer
 *   pdf.js) oder „Bild einfügen“ (Zwischenablage oder Datei, Rueckfall). Markieren im Bildfenster: Rechteck, Pfeil,
 *   Freihand in Rot, Rückgängig. Gespeichert als WebP (sonst PNG/JPEG) bis rund 400 KB an der Anmerkung (bild), der Kunde
 *   sieht es gross aufklappbar und kann zur Antwort selbst ein Bild anhaengen (bild_antwort).
 *   Senden: ohneBearbeitung() = offen ohne Antwort/Rueckfrage. Solange eine solche steht, ist „Erneut senden“ aus, mit
 *   Hinweis und Sprung zur naechsten. Dieselbe Regel sperrt im Backend (partnerKunden.senden, 409 anmerkungen_offen).
 *   Rueckfrage (offen mit Antwort) ist beim Partner ein eigener blauer Chip, erledigt gruen.
 */
(function () {
  'use strict';
  if (window.DpAnmerkungen) return;

  var G = 'var(--wl-c9a84c, #C9A84C)';
  var ART = { hinweis: 'Hinweis', pruefen: 'Bitte prüfen', nachreichen: 'Bitte nachreichen' };
  var Z = { modus: null, share: null, ks: null, aufgabe: null, objekt: null, liste: [], markieren: false, takt: null, auf: true };

  function api(p, o) { return window.Auth && Auth.apiCall ? Auth.apiCall(p, o || { method: 'GET' }) : Promise.reject(new Error('kein_auth')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(t) { try { if (typeof window.toast === 'function') return window.toast(t); } catch (e) {} }
  function fehlerText(e) { return (e && e.data && (e.data.detail || e.data.message)) || (e && e.message) || 'Das hat nicht geklappt.'; }
  function klein() { return window.innerWidth < 700; }
  /** v3640 · offen und weder Antwort noch Bild zur Antwort: so eine Anmerkung sperrt das Senden (Backend dieselbe Regel) */
  function ohneBearbeitung(liste) {
    return (liste || []).filter(function (a) { return a && a.status === 'offen' && !(a.antwort && String(a.antwort).trim()) && !a.bild_antwort && !a.hat_bild_antwort; });
  }
  function istRueckfrage(a) { return a && a.status === 'offen' && ((a.antwort && String(a.antwort).trim()) || a.bild_antwort); }

  function stil() {
    if (document.getElementById('dppk-anm-stil')) return;
    var s = document.createElement('style'); s.id = 'dppk-anm-stil';
    s.textContent = [
      'body.dppk-markieren .main-col .body .sec *{cursor:crosshair !important}',
      '.dppk-anm-hover{outline:2px dashed ' + G + ' !important;outline-offset:2px !important}',
      '.dppk-anm-mark{outline:2px solid ' + G + ' !important;outline-offset:2px !important;border-radius:4px}',
      '.dppk-anm-blitz{animation:dppk-blitz 1.2s ease 2}',
      '@keyframes dppk-blitz{50%{outline-color:#B8625C;outline-width:4px}}',
      '#dppk-anm-layer{position:absolute;left:0;top:0;width:0;height:0;z-index:60;pointer-events:none}',
      '#dppk-anm-layer span{position:absolute;min-width:20px;height:20px;line-height:20px;border-radius:10px;background:' + G + ';color:#fff;font:700 11px Inter,sans-serif;text-align:center;padding:0 5px;box-shadow:0 1px 4px rgba(0,0,0,.3);pointer-events:auto;cursor:pointer}',
      '#dppk-anm-liste{position:fixed;right:12px;top:150px;bottom:16px;width:300px;z-index:10040;background:#FDFCFA;border:1px solid #E2D7BE;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;font:400 13px Inter,sans-serif;color:#2A2727}',
      '#dppk-anm-liste.zu{display:none}',
      '#dppk-anm-liste .al-kopf{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #EDE6D6}',
      '#dppk-anm-liste .al-kopf b{flex:1;font:600 14px "Space Grotesk",Inter,sans-serif}',
      '#dppk-anm-liste .al-zu{border:0;background:none;font:400 20px/1 Inter;cursor:pointer;color:#6B6460;width:30px;height:30px}',
      '#dppk-anm-liste .al-inhalt{overflow:auto;padding:10px 12px;flex:1}',
      '#dppk-anm-liste .al-eintrag{border:1px solid #EDE6D6;border-radius:10px;background:#fff;padding:9px 10px;margin-bottom:8px;cursor:pointer}',
      '#dppk-anm-liste .al-eintrag:hover{border-color:' + G + '}',
      '#dppk-anm-liste .al-nr{display:inline-block;min-width:20px;height:20px;line-height:20px;border-radius:10px;background:' + G + ';color:#fff;font:700 11px Inter;text-align:center;padding:0 5px;margin-right:6px}',
      '#dppk-anm-liste .al-ort{font-size:11.5px;color:#7A7370;margin:3px 0}',
      '#dppk-anm-liste .al-text{white-space:pre-wrap;line-height:1.45}',
      '#dppk-anm-liste .al-chip{display:inline-block;font:600 10px "JetBrains Mono",monospace;letter-spacing:.04em;text-transform:uppercase;border:1px solid #E2D7BE;border-radius:5px;padding:1px 6px;margin-left:4px;color:#6B5A2A;background:#FBF6E9}',
      '#dppk-anm-liste .al-chip.gruen{color:#2C7A4E;background:#EAF5EE;border-color:#BFE0CB}',
      '#dppk-anm-liste .al-chip.frage{color:#2F5D8A;background:#EAF1F8;border-color:#BCD0E6}',
      '#dppk-anm-liste .al-chip.rot{color:#94433E;background:#F8ECEB;border-color:#E3C2BF}',
      /* v3640 · Bild an der Anmerkung, Bildwerkzeug, Grossansicht */
      '.al-bild{display:block;margin:7px 0 2px;max-width:100%;max-height:140px;border:1px solid #E2D7BE;border-radius:8px;cursor:zoom-in;background:#fff}',
      '.al-bild-zeile{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0 2px}',
      '.al-bild-zeile img{max-width:120px;max-height:80px;border:1px solid #E2D7BE;border-radius:6px;cursor:zoom-in}',
      '.al-hinweis-rot{font-size:12px;color:#94433E;line-height:1.45}',
      '#dppk-bild-auswahl{position:fixed;inset:0;z-index:100090;cursor:crosshair;background:rgba(5,5,5,.18);touch-action:none}',
      '#dppk-bild-auswahl .ba-rahmen{position:absolute;border:2px solid #D8564C;background:rgba(216,86,76,.08);box-shadow:0 0 0 9999px rgba(5,5,5,.25)}',
      '#dppk-bild-auswahl .ba-hinweis{position:fixed;left:50%;top:12px;transform:translateX(-50%);background:#050505;color:#FDFCFA;border:1px solid ' + G + ';border-radius:10px;padding:8px 12px;font:500 13px Inter,sans-serif;pointer-events:none;max-width:calc(100vw - 24px)}',
      '#dppk-bild-ed{position:fixed;inset:0;z-index:100095;background:rgba(5,5,5,.72);display:flex;align-items:center;justify-content:center;padding:16px;font:400 13px Inter,sans-serif}',
      '#dppk-bild-ed .be-box{background:#FDFCFA;border-radius:12px;max-width:min(1100px,100%);max-height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 26px 70px rgba(0,0,0,.45)}',
      '#dppk-bild-ed .be-leiste{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:10px 12px;border-bottom:1px solid #EDE6D6}',
      '#dppk-bild-ed .be-leiste .al-btn.an{border-color:#D8564C;color:#B8433A;background:#FBEDEB}',
      '#dppk-bild-ed .be-flaeche{overflow:auto;padding:10px;background:#EEE9DE;display:flex;align-items:flex-start;justify-content:center;min-height:120px}',
      '#dppk-bild-ed canvas{max-width:100%;height:auto;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.2);touch-action:none;cursor:crosshair}',
      '#dppk-bild-ed .be-leer{padding:30px 20px;text-align:center;color:#6B6460;max-width:420px;line-height:1.5}',
      '#dppk-bild-ed .be-fuss{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;align-items:center;padding:10px 12px;border-top:1px solid #EDE6D6}',
      '#dppk-bild-gross{position:fixed;inset:0;z-index:100100;background:rgba(5,5,5,.82);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out}',
      '#dppk-bild-gross img{max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 18px 60px rgba(0,0,0,.6);background:#fff}',
      '#dppk-anm-liste .al-knoepfe{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}',
      '#dppk-anm-liste .al-fuss{padding:10px 12px;border-top:1px solid #EDE6D6;display:flex;gap:6px;flex-wrap:wrap}',
      '.al-btn{border:1px solid #D9CFB8;background:#fff;color:#2A2727;border-radius:8px;padding:6px 10px;font:600 12px Inter,sans-serif;cursor:pointer}',
      '.al-btn.gold{background:' + G + ';border-color:' + G + ';color:#fff}',
      '.al-btn.rot{color:#B8625C;border-color:#E3C2BF}',
      '.al-btn[disabled]{opacity:.5;cursor:default}',
      '#dppk-anm-fenster{position:fixed;z-index:100070;width:min(380px,calc(100vw - 24px));background:#FDFCFA;border:1px solid ' + G + ';border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.35);padding:12px 14px;font:400 13px Inter,sans-serif;color:#2A2727}',
      '#dppk-anm-fenster h4{margin:0 0 6px;font:600 14px "Space Grotesk",Inter,sans-serif}',
      '#dppk-anm-fenster .af-ort{font-size:12px;color:#7A7370;margin-bottom:8px}',
      '#dppk-anm-fenster textarea,#dppk-anm-fenster input[type=text]{width:100%;box-sizing:border-box;border:1px solid #D9CFB8;border-radius:8px;padding:8px 10px;font:400 13px Inter,sans-serif;background:#fff}',
      '#dppk-anm-fenster textarea{height:86px;resize:vertical}',
      '#dppk-anm-fenster .af-zeile{display:flex;gap:6px;align-items:flex-start}',
      '#dppk-anm-fenster .af-arten{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}',
      '#dppk-anm-fenster .af-arten label{border:1px solid #D9CFB8;border-radius:16px;padding:4px 10px;font:600 12px Inter;cursor:pointer}',
      '#dppk-anm-fenster .af-arten input{display:none}',
      '#dppk-anm-fenster .af-arten input:checked + span{color:#7A6020}',
      '#dppk-anm-fenster .af-arten label:has(input:checked){border-color:' + G + ';background:#FBF6E9}',
      '#dppk-anm-fenster .af-fuss{display:flex;gap:6px;justify-content:flex-end;margin-top:10px}',
      '#dppk-anm-hinweis{position:fixed;left:50%;transform:translateX(-50%);top:12px;z-index:100065;background:#050505;color:#FDFCFA;border:1px solid ' + G + ';border-radius:10px;padding:8px 12px;font:500 13px Inter,sans-serif;display:flex;gap:10px;align-items:center;max-width:calc(100vw - 24px)}',
      '@media (max-width:699px){#dppk-anm-liste{left:0;right:0;top:auto;bottom:0;width:auto;max-height:62vh;border-radius:14px 14px 0 0}#dppk-anm-fenster{left:12px !important;right:12px;top:auto !important;bottom:12px;width:auto}}',
      '@media print{#dppk-anm-liste,#dppk-anm-layer,#dppk-anm-fenster,#dppk-bild-ed,#dppk-bild-gross{display:none !important}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Feldbezug ─────────────────────────────────────────────────────────── */
  var ZIELE = 'input:not([type=hidden]),select,textarea,.kpi,.kpi-card,.dp-kachel,.sbcm,.card,.res-card,.box,fieldset,[class*="kachel"],section,[id]';
  function cssEsc(s) { try { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/([^\w-])/g, '\\$1'); } catch (e) { return s; } }
  function pfad(el) {
    var teile = [], e = el, n = 0;
    while (e && e.nodeType === 1 && n < 8) {
      if (e.id && e !== el) { teile.unshift('#' + cssEsc(e.id)); break; }
      var tag = e.tagName.toLowerCase(), p = e.parentElement, i = 1;
      if (p) { for (var s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === e.tagName) i++; }
      teile.unshift(tag + ':nth-of-type(' + i + ')');
      e = p; n++;
    }
    return teile.join(' > ');
  }
  function beschriftung(el) {
    /* v3452 · Kachel/Abschnitt: die eigene Ueberschrift, nicht die id (gemessen: „dpfk-band“) */
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      var u = el.querySelector('h1, h2, h3, h4, legend, .title, .card-title, .kpi-label, strong, b');
      var ut = u && (u.textContent || '').trim().replace(/\s+/g, ' ');
      if (ut) return ut.slice(0, 120);
      var erste = ((el.innerText || '').split(/[\r\n]+/).map(function (s) { return s.trim(); }).filter(Boolean)[0] || '').replace(/\u00ad/g, '');
      if (erste) return erste.slice(0, 80);
    }
    if (el.id) { var l = document.querySelector('label[for="' + cssEsc(el.id) + '"]'); if (l && l.textContent.trim()) return l.textContent.trim().replace(/\s+/g, ' ').slice(0, 120); }
    /* v3490 · .f zuerst: die Felder der App stehen als <div class="f"><label>…</label><div class="iw"><input></div></div>.
       Ohne .f griff erst .row/section, und dort steht als erstes Label „Straße“ - gemessen: Wohnfläche und Baujahr hiessen „Straße“. */
    var c = el.closest('label, .f, .field, .form-group, .fg, .inp-row, .row, .kpi, .card, fieldset, section');
    if (c) {
      var h = c.querySelector('label, legend, h2, h3, h4, .label, .lbl, .title, .kpi-label, .card-title');
      var t = (h && h !== el ? h.textContent : c.textContent) || '';
      t = t.trim().replace(/\s+/g, ' ');
      if (t) return t.slice(0, 120);
    }
    return (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || el.tagName.toLowerCase()).slice(0, 120);
  }
  function wertVon(el) {
    if (el.tagName === 'SELECT') { var o = el.options[el.selectedIndex]; return o ? o.text : el.value; }
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'ja' : 'nein';
    if ('value' in el && /INPUT|TEXTAREA/.test(el.tagName)) return el.value;
    return (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  }
  function reiterVon(sec) {
    if (!sec) return '';
    var t = document.querySelector('nav.tabs .tab[data-target-sec="' + sec + '"] .tab-lbl') || document.querySelector('nav.tabs .tab[data-target-sec="' + sec + '"]');
    return t ? t.textContent.trim() : sec;
  }
  function feldBeschreiben(el) {
    var sec = el.closest('.sec'); sec = sec && sec.id || null;
    var eingabe = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    return { sec: sec, reiter: reiterVon(sec), feld_id: el.id || null, selektor: el.id ? null : pfad(el), feld_label: beschriftung(el), wert_damals: wertVon(el), _eingabe: eingabe };
  }
  /** Rein: welches Element gehoert zur Anmerkung? Fehlt es, ist sie eine freie (Pruefer: tools/partner-anmerkungen-pruefen.mjs) */
  function zuordnen(a, doc) {
    doc = doc || document;
    if (!a || (!a.feld_id && !a.selektor)) return { el: null, art: 'frei', grund: 'ohne_feld' };
    var el = null;
    try { if (a.feld_id) el = doc.getElementById(a.feld_id); } catch (e) { el = null; }
    if (!el && a.selektor) { try { el = doc.querySelector(a.selektor); } catch (e) { el = null; } }
    if (!el) return { el: null, art: 'frei', grund: 'feld_fehlt' };
    if (a.sec && el.closest && !el.closest('#' + a.sec) && doc.getElementById && doc.getElementById(a.sec)) return { el: null, art: 'frei', grund: 'anderer_abschnitt' };
    return { el: el, art: 'feld' };
  }

  /* ── Rahmen und Nummern ────────────────────────────────────────────────── */
  function rahmenAus() {
    [].forEach.call(document.querySelectorAll('.dppk-anm-mark'), function (e) { e.classList.remove('dppk-anm-mark'); });
    var l = document.getElementById('dppk-anm-layer'); if (l) l.innerHTML = '';
  }
  function rahmenZeichnen() {
    rahmenAus();
    if (!Z.modus) return;
    var layer = document.getElementById('dppk-anm-layer');
    if (!layer) { layer = document.createElement('div'); layer.id = 'dppk-anm-layer'; document.body.appendChild(layer); }
    var sx = window.scrollX || 0, sy = window.scrollY || 0;
    Z.liste.forEach(function (a) {
      var z = zuordnen(a); a._frei = z.art === 'frei' && !!(a.feld_id || a.selektor);
      if (!z.el) return;
      z.el.classList.add('dppk-anm-mark');
      var r = z.el.getBoundingClientRect(); if (!r.width && !r.height) return;
      var b = document.createElement('span'); b.textContent = a.nr; b.title = ART[a.art] + ': ' + a.text;
      b.style.left = Math.max(0, r.right + sx - 12) + 'px'; b.style.top = Math.max(0, r.top + sy - 10) + 'px';
      if (a.status === 'erledigt') b.style.background = '#3FA56C';
      b.onclick = function () { listeOeffnen(); var x = document.querySelector('#dppk-anm-liste [data-id="' + a.id + '"]'); if (x) x.scrollIntoView({ block: 'nearest' }); };
      layer.appendChild(b);
    });
  }
  function hinspringen(a) {
    if (a.sec && typeof window._dpReiterZu === 'function') { try { window._dpReiterZu(a.sec); } catch (e) {} }
    setTimeout(function () {
      var z = zuordnen(a);
      if (!z.el) { toast('Das Feld gibt es in diesem Stand nicht mehr, die Anmerkung gilt allgemein.'); return; }
      try { z.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { z.el.scrollIntoView(); }
      z.el.classList.add('dppk-anm-blitz'); setTimeout(function () { z.el.classList.remove('dppk-anm-blitz'); }, 2600);
      if (klein()) listeZu();
      rahmenZeichnen();
    }, 250);
  }

  /* ── Seitenliste ───────────────────────────────────────────────────────── */
  function listeZu() { var l = document.getElementById('dppk-anm-liste'); if (l) l.classList.add('zu'); Z.auf = false; }
  function listeOeffnen() { Z.auf = true; listeZeichnen(); }
  function listeZeichnen() {
    stil();
    var l = document.getElementById('dppk-anm-liste');
    if (!Z.modus) { if (l) l.remove(); return; }
    if (!l) { l = document.createElement('aside'); l.id = 'dppk-anm-liste'; l.setAttribute('aria-label', 'Anmerkungen'); document.body.appendChild(l); }
    l.classList.toggle('zu', !Z.auf);
    var partner = Z.modus === 'partner';
    var entw = Z.liste.filter(function (a) { return a.status === 'entwurf'; }).length;
    var offen = Z.liste.filter(function (a) { return a.status === 'offen'; }).length;
    var titel = partner ? 'Anmerkungen' : 'Rückmeldung deines Partners';
    var ohne = ohneBearbeitung(Z.liste);   /* v3640 */
    l.innerHTML = '<div class="al-kopf"><b>' + titel + '</b><button type="button" class="al-zu" aria-label="Liste schließen">×</button></div><div class="al-inhalt">' +
      (Z.liste.length ? Z.liste.map(function (a) {
        var ort = a.feld_id || a.selektor ? (a._frei ? 'Feld nicht mehr vorhanden, gilt allgemein' : [a.reiter, a.feld_label].filter(Boolean).join(' › ')) : 'allgemein';
        var st = a.status === 'entwurf' ? '<span class="al-chip">Entwurf</span>' : a.status === 'erledigt' ? '<span class="al-chip gruen">erledigt</span>'
          : istRueckfrage(a) ? '<span class="al-chip frage">' + (partner ? 'Rückfrage' : 'beantwortet') + '</span>' : '<span class="al-chip' + (partner ? '' : ' rot') + '">offen</span>';   /* v3640 */
        var kn = '';
        if (partner && a.status === 'entwurf') kn = '<button type="button" class="al-btn" data-a="bearbeiten">Ändern</button><button type="button" class="al-btn rot" data-a="loeschen">Löschen</button>';
        if (!partner) kn = (a.status !== 'erledigt' ? '<button type="button" class="al-btn gold" data-a="erledigt">Erledigt</button>' : '<button type="button" class="al-btn" data-a="offen">Wieder offen</button>') +
          '<button type="button" class="al-btn" data-a="antwort">' + (a.antwort ? 'Antwort ändern' : 'Antworten') + '</button>' +
          (a.vorschlag && a.status !== 'erledigt' && !a._frei && (a.feld_id || a.selektor) ? '<button type="button" class="al-btn" data-a="vorschlag">Vorschlag übernehmen</button>' : '');
        return '<div class="al-eintrag" data-id="' + a.id + '"><div><span class="al-nr">' + a.nr + '</span><b>' + esc(ART[a.art] || 'Hinweis') + '</b>' + st + '</div>' +
          '<div class="al-ort">' + esc(ort) + (a.wert_damals ? ' · damals: ' + esc(a.wert_damals) : '') + '</div>' +
          '<div class="al-text">' + esc(a.text) + '</div>' +
          (a.vorschlag ? '<div class="al-ort">Vorschlag: <b>' + esc(a.vorschlag) + '</b></div>' : '') +
          (a.bild ? '<img class="al-bild" data-gross="bild" alt="Bildausschnitt zur Anmerkung ' + a.nr + '" src="' + esc(a.bild) + '">' : '') +
          (a.antwort ? '<div class="al-ort">' + (istRueckfrage(a) && partner ? 'Rückfrage des Kunden' : 'Antwort' + (partner ? ' des Kunden' : '')) + ': ' + esc(a.antwort) + '</div>' : '') +
          (a.bild_antwort ? '<img class="al-bild" data-gross="bild_antwort" alt="Bild zur Antwort" src="' + esc(a.bild_antwort) + '">' : '') +
          (kn ? '<div class="al-knoepfe">' + kn + '</div>' : '') + '</div>';
      }).join('') : '<div class="al-ort">' + (partner ? 'Noch keine Anmerkungen. Mit „Feld markieren“ eine Stelle wählen oder mit „Anmerkung“ etwas Allgemeines schreiben.' : 'Keine Anmerkungen.') + '</div>') +
      '</div><div class="al-fuss">' +
      (partner ? '<button type="button" class="al-btn" data-f="markieren">Feld markieren</button><button type="button" class="al-btn" data-f="frei">Anmerkung</button><button type="button" class="al-btn gold" data-f="zurueck"' + (entw ? '' : ' disabled') + '>Zurück an Kunden (' + entw + ')</button>'
        /* v3640 · Senden erst, wenn jede Anmerkung erledigt ist oder eine Antwort/Rückfrage traegt */
        : (ohne.length
            ? '<span class="al-hinweis-rot">' + (ohne.length === 1 ? 'Noch 1 Anmerkung ohne Bearbeitung' : 'Noch ' + ohne.length + ' Anmerkungen ohne Bearbeitung') + '. Erledige sie oder schreib eine Antwort oder Rückfrage.</span>' +
              '<button type="button" class="al-btn" data-f="naechste">Zur nächsten (' + ohne[0].nr + ')</button><button type="button" class="al-btn gold" data-f="senden" disabled title="Erst alle Anmerkungen bearbeiten">Erneut senden</button>'
            : '<span class="al-ort">' + (offen ? 'Alle bearbeitet, ' + offen + ' mit Rückfrage. ' : 'Alles erledigt. ') + 'Du kannst das Objekt jetzt erneut senden.</span><button type="button" class="al-btn gold" data-f="senden">Erneut senden</button>') +
          '<button type="button" class="al-btn" data-f="ende">Schließen</button>') + '</div>';
    l.querySelector('.al-zu').onclick = listeZu;
    [].forEach.call(l.querySelectorAll('.al-eintrag'), function (e) {
      var a = Z.liste.filter(function (x) { return x.id === e.getAttribute('data-id'); })[0];
      e.onclick = function (ev) {
        var gb = ev.target.closest('[data-gross]');
        if (gb) { ev.stopPropagation(); return grossZeigen(gb.getAttribute('src')); }   /* v3640 */
        var k = ev.target.closest('[data-a]');
        if (!k) return hinspringen(a);
        ev.stopPropagation(); aktion(k.getAttribute('data-a'), a);
      };
    });
    [].forEach.call(l.querySelectorAll('[data-f]'), function (b) {
      b.onclick = function () {
        var f = b.getAttribute('data-f');
        if (f === 'markieren') markierenStart(); else if (f === 'frei') fenster(null); else if (f === 'zurueck') zurueckDialog();
        else if (f === 'ende') ende(); else if (f === 'senden') erneutSenden();
        else if (f === 'naechste') { var n0 = ohneBearbeitung(Z.liste)[0]; if (n0) { var x0 = document.querySelector('#dppk-anm-liste [data-id="' + n0.id + '"]'); if (x0) { x0.scrollIntoView({ block: 'nearest' }); x0.classList.add('dppk-anm-blitz'); setTimeout(function () { x0.classList.remove('dppk-anm-blitz'); }, 2600); } hinspringen(n0); } }
      };
    });
    rahmenZeichnen();
    bannerZahl();
  }
  function aktion(was, a) {
    if (was === 'bearbeiten') return fenster(null, a);
    if (was === 'loeschen') return api('/partner/anmerkungen/' + a.id, { method: 'DELETE' }).then(laden, function (e) { toast(fehlerText(e)); });
    if (was === 'erledigt' || was === 'offen') return kundeSetzen(a, { status: was });
    if (was === 'antwort') return antwortFenster(a);
    if (was === 'vorschlag') {
      var z = zuordnen(a); if (!z.el || !/^(INPUT|SELECT|TEXTAREA)$/.test(z.el.tagName)) return toast('Das Feld gibt es hier nicht.');
      z.el.value = a.vorschlag;
      ['input', 'change'].forEach(function (t) { try { z.el.dispatchEvent(new Event(t, { bubbles: true })); } catch (e) {} });
      toast('Vorschlag übernommen: ' + a.vorschlag);
      hinspringen(a);
    }
  }

  /* ── Laden ─────────────────────────────────────────────────────────────── */
  function laden() {
    if (Z.modus === 'partner') return api('/partner/kundenstaende/' + Z.share + '/anmerkungen').then(function (r) { Z.liste = r.anmerkungen || []; listeZeichnen(); }, function (e) { toast(fehlerText(e)); });
    if (Z.modus === 'kunde') return api('/mein-partner/aufgaben/' + Z.aufgabe + '/anmerkungen').then(function (r) { Z.liste = r.anmerkungen || []; listeZeichnen(); }, function (e) { toast(fehlerText(e)); });
    return Promise.resolve();
  }
  function taktAn() {
    if (Z.takt) return;
    var letzt = '';
    Z.takt = setInterval(function () {
      if (!Z.modus) return;
      /* Objekt gewechselt? Dann gilt die Liste nicht mehr */
      var soll = Z.modus === 'partner' ? Z.objekt : Z.objekt;
      if (soll && window._currentObjKey && window._currentObjKey !== soll) return ende();
      var k = (document.querySelector('.sec.active') || {}).id + '|' + window.scrollY + '|' + window.innerWidth;
      if (k !== letzt) { letzt = k; rahmenZeichnen(); }
    }, 700);
  }

  /* ── Markieren ─────────────────────────────────────────────────────────── */
  var _hover = null;
  function zielVon(t) {
    if (!t || !t.closest) return null;
    if (t.closest('#dppk-anm-liste, #dppk-anm-fenster, #dppk-ks, #dppk-anm-hinweis, nav.tabs, header.hdr, aside.sidebar, #sidebar')) return null;
    if (!t.closest('.main-col .body')) return null;
    var e = t.closest(ZIELE);
    if (e && /^(LABEL|SPAN|B|I|SMALL)$/.test(e.tagName)) e = e.parentElement && e.parentElement.closest(ZIELE);
    if (e && e.classList && e.classList.contains('body')) return null;
    return e;
  }
  function beiBewegung(ev) {
    var e = zielVon(ev.target);
    if (_hover && _hover !== e) _hover.classList.remove('dppk-anm-hover');
    _hover = e; if (e) e.classList.add('dppk-anm-hover');
  }
  function beiKlick(ev) {
    var e = zielVon(ev.target); if (!e) return;
    ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    markierenEnde();
    fenster(e);
  }
  function beiTaste(ev) { if (ev.key === 'Escape') markierenEnde(); }
  function markierenStart() {
    stil(); Z.markieren = true; document.body.classList.add('dppk-markieren');
    if (klein()) listeZu();
    var h = document.getElementById('dppk-anm-hinweis');
    if (!h) { h = document.createElement('div'); h.id = 'dppk-anm-hinweis'; document.body.appendChild(h); }
    h.innerHTML = '<span>Tippe auf ein Feld, eine Kachel oder einen Abschnitt. Du kannst vorher den Reiter wechseln.</span><button type="button" class="al-btn">Abbrechen</button>';
    h.querySelector('button').onclick = markierenEnde;
    document.addEventListener('mouseover', beiBewegung, true);
    document.addEventListener('click', beiKlick, true);
    document.addEventListener('keydown', beiTaste, true);
  }
  function markierenEnde() {
    Z.markieren = false; document.body.classList.remove('dppk-markieren');
    var h = document.getElementById('dppk-anm-hinweis'); if (h) h.remove();
    if (_hover) { _hover.classList.remove('dppk-anm-hover'); _hover = null; }
    document.removeEventListener('mouseover', beiBewegung, true);
    document.removeEventListener('click', beiKlick, true);
    document.removeEventListener('keydown', beiTaste, true);
  }

  /* ── Fenster am Element ────────────────────────────────────────────────── */
  function fensterZu() { var f = document.getElementById('dppk-anm-fenster'); if (f) f.remove(); try { if (window.DealPilotDiktat && DealPilotDiktat.laeuft()) DealPilotDiktat.stoppen(); } catch (e) {} }
  function fenster(el, alt) {
    stil(); fensterZu();
    var f = el ? feldBeschreiben(el) : (alt ? { sec: alt.sec, reiter: alt.reiter, feld_id: alt.feld_id, selektor: alt.selektor, feld_label: alt.feld_label, wert_damals: alt.wert_damals, _eingabe: !!alt.vorschlag || !!alt.feld_id } : {});
    var d = document.createElement('div'); d.id = 'dppk-anm-fenster'; d.setAttribute('role', 'dialog');
    var art = alt ? alt.art : 'hinweis';
    d.innerHTML = '<h4>' + (alt ? 'Anmerkung ' + alt.nr + ' ändern' : (el ? 'Anmerkung zu diesem Feld' : 'Freie Anmerkung')) + '</h4>' +
      '<div class="af-ort">' + (f.feld_label ? esc([f.reiter, f.feld_label].filter(Boolean).join(' › ')) + (f.wert_damals ? ' · jetzt: ' + esc(String(f.wert_damals).slice(0, 80)) : '') : 'Ohne Feldbezug, gilt für das ganze Objekt.') + '</div>' +
      '<div class="af-zeile"><textarea id="dppk-anm-text" maxlength="2000" placeholder="Was soll der Kunde wissen oder tun?">' + esc(alt ? alt.text : '') + '</textarea></div>' +
      '<div class="af-arten" role="radiogroup">' + Object.keys(ART).map(function (k) { return '<label><input type="radio" name="dppk-anm-art" value="' + k + '"' + (k === art ? ' checked' : '') + '><span>' + ART[k] + '</span></label>'; }).join('') + '</div>' +
      (f._eingabe ? '<input type="text" id="dppk-anm-vorschlag" maxlength="500" placeholder="Vorschlag für den Wert (optional)" value="' + esc(alt && alt.vorschlag || '') + '">' : '') +
      '<div class="al-bild-zeile" data-bildzeile></div>' +
      '<div class="af-fuss"><button type="button" class="al-btn" data-x="zu">Abbrechen</button><button type="button" class="al-btn gold" data-x="ok">Speichern</button></div>';
    document.body.appendChild(d);
    var bild = { wert: alt ? (alt.bild || null) : null };   /* v3640 */
    bildZeile(d.querySelector('[data-bildzeile]'), bild, d);
    if (el && !klein()) {
      var r = el.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight;
      var x = Math.min(Math.max(12, r.left), window.innerWidth - w - 12), y = r.bottom + 8;
      if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
      d.style.left = x + 'px'; d.style.top = y + 'px';
    } else if (!klein()) { d.style.left = Math.round((window.innerWidth - d.offsetWidth) / 2) + 'px'; d.style.top = '120px'; }
    try { if (window.DealPilotDiktat) DealPilotDiktat.knopfAn('dppk-anm-text'); } catch (e) {}
    var ta = d.querySelector('#dppk-anm-text'); setTimeout(function () { try { ta.focus(); } catch (e) {} }, 30);
    d.querySelector('[data-x="zu"]').onclick = fensterZu;
    d.querySelector('[data-x="ok"]').onclick = function () {
      var text = ta.value.trim(); if (!text) return toast('Bitte einen Text eintragen.');
      var body = { text: text, art: (d.querySelector('input[name="dppk-anm-art"]:checked') || {}).value || 'hinweis' };
      var v = d.querySelector('#dppk-anm-vorschlag'); if (v) body.vorschlag = v.value.trim();
      if (alt) body.bild = bild.wert || null; else if (bild.wert) body.bild = bild.wert;   /* v3640 */
      var p;
      if (alt) p = api('/partner/anmerkungen/' + alt.id, { method: 'PUT', body: body });
      else { ['sec', 'reiter', 'feld_id', 'selektor', 'feld_label', 'wert_damals'].forEach(function (k) { if (f[k]) body[k] = String(f[k]); }); p = api('/partner/kundenstaende/' + Z.share + '/anmerkungen', { method: 'POST', body: body }); }
      this.disabled = true; var self = this;
      p.then(function () { fensterZu(); Z.auf = !klein() || Z.auf; return laden(); }, function (e) { self.disabled = false; toast(fehlerText(e)); });
    };
  }
  function antwortFenster(a) {
    stil(); fensterZu();
    var d = document.createElement('div'); d.id = 'dppk-anm-fenster';
    d.innerHTML = '<h4>Antwort zu Anmerkung ' + a.nr + '</h4><div class="af-ort">' + esc(a.text) + '</div><textarea id="dppk-anm-text" maxlength="2000" placeholder="Antwort oder Rückfrage an deinen Partner">' + esc(a.antwort || '') + '</textarea>' +
      '<div class="al-bild-zeile" data-bildzeile></div>' +
      '<div class="af-fuss"><button type="button" class="al-btn" data-x="zu">Abbrechen</button><button type="button" class="al-btn" data-x="nur">Als Rückfrage senden</button><button type="button" class="al-btn gold" data-x="erl">Antworten und erledigt</button></div>';
    document.body.appendChild(d);
    if (!klein()) { d.style.left = Math.round((window.innerWidth - d.offsetWidth) / 2) + 'px'; d.style.top = '120px'; }
    try { if (window.DealPilotDiktat) DealPilotDiktat.knopfAn('dppk-anm-text'); } catch (e) {}
    var bild = { wert: a.bild_antwort || null };   /* v3640 · Bild zur Antwort */
    bildZeile(d.querySelector('[data-bildzeile]'), bild, d);
    function body(extra) { var b = { antwort: d.querySelector('textarea').value }; if ((bild.wert || null) !== (a.bild_antwort || null)) b.bild_antwort = bild.wert || null; return Object.assign(b, extra || {}); }
    d.querySelector('[data-x="zu"]').onclick = fensterZu;
    d.querySelector('[data-x="nur"]').onclick = function () {
      var b = body(); if (!String(b.antwort || '').trim() && !bild.wert) return toast('Bitte eine Antwort oder Rückfrage schreiben.');
      kundeSetzen(a, b).then(fensterZu);
    };
    d.querySelector('[data-x="erl"]').onclick = function () { kundeSetzen(a, body({ status: 'erledigt' })).then(fensterZu); };
  }
  function kundeSetzen(a, body) {
    return api('/mein-partner/anmerkungen/' + a.id, { method: 'POST', body: body }).then(function (r) {
      if (r && r.alle_erledigt) toast('Alles erledigt. Dein Partner sieht es in seinen Meldungen.');
      return laden();
    }, function (e) { toast(fehlerText(e)); });
  }
  function zurueckDialog() {
    var entw = Z.liste.filter(function (a) { return a.status === 'entwurf'; });
    if (!entw.length) return;
    stil(); fensterZu();
    var d = document.createElement('div'); d.id = 'dppk-anm-fenster';
    d.innerHTML = '<h4>Zurück an ' + esc(Z.ks && Z.ks.kunde || 'den Kunden') + '</h4><div class="af-ort">' + entw.length + (entw.length === 1 ? ' Anmerkung geht' : ' Anmerkungen gehen') + ' als Aufgabe an den Kunden. Er sieht sie an seinem eigenen Objekt.' +
      /* v3460 · Mail je Kunde (Partner-Cockpit › Kunden › Stufe und Rechte bzw. Notiz und E-Mail) */
      (Z.ks && Z.ks.kunde_mail_rueckmeldung === false ? ' Eine E-Mail geht nicht mit, sie ist für diesen Kunden ausgeschaltet.' : ' Dazu bekommt er eine E-Mail mit Objekt, Zahl der Anmerkungen und deinem Begleittext.') + '</div>' +
      '<textarea id="dppk-anm-text" maxlength="2000" placeholder="Kurzer Begleittext (optional)"></textarea>' +
      '<div class="af-fuss"><button type="button" class="al-btn" data-x="zu">Abbrechen</button><button type="button" class="al-btn gold" data-x="ok">Zurückgeben</button></div>';
    document.body.appendChild(d);
    if (!klein()) { d.style.left = Math.round((window.innerWidth - d.offsetWidth) / 2) + 'px'; d.style.top = '120px'; }
    try { if (window.DealPilotDiktat) DealPilotDiktat.knopfAn('dppk-anm-text'); } catch (e) {}
    d.querySelector('[data-x="zu"]').onclick = fensterZu;
    d.querySelector('[data-x="ok"]').onclick = function () {
      this.disabled = true; var self = this;
      api('/partner/kundenstaende/' + Z.share + '/zurueck', { method: 'POST', body: { text: d.querySelector('textarea').value } })
        .then(function (r) {
          var ms = r.mail && r.mail.status, mt = ms === 'gesendet' || ms === 'dry_run' ? ' E-Mail ist raus.' : ms === 'testadresse' ? ' Testadresse, keine E-Mail verschickt.' : ms === 'fehler' ? ' Die E-Mail ging nicht raus, die Aufgabe steht trotzdem.' : '';
          fensterZu(); toast((r.anzahl === 1 ? '1 Anmerkung' : r.anzahl + ' Anmerkungen') + ' an ' + (Z.ks && Z.ks.kunde || 'den Kunden') + ' zurückgegeben.' + mt); return laden(); },
          function (e) { self.disabled = false; toast(fehlerText(e)); });
    };
  }
  function erneutSenden() {
    var id = Z.objekt;
    if (window.DpPartnerKunden && typeof DpPartnerKunden.sendenDialog === 'function' && id) DpPartnerKunden.sendenDialog([id], false, Z.aufgabe, function () { ende(); });
    else toast('Senden geht über Mein Partner › An Partner senden.');
  }

  /* ── Banner des Partners ───────────────────────────────────────────────── */
  function bannerZahl() {
    var b = document.querySelector('#dppk-ks [data-anm="zurueck"]'); if (!b) return;
    var n = Z.liste.filter(function (a) { return a.status === 'entwurf'; }).length;
    b.textContent = 'Zurück an Kunden (' + n + ')'; b.disabled = !n;
    var o = document.querySelector('#dppk-ks [data-anm="liste"]');
    if (o) o.textContent = 'Anmerkungen (' + Z.liste.length + ')';
  }
  /** partner-kunden.js ruft das beim Banner des Kundenstands */
  function partnerBanner(banner, ks) {
    if (!banner || !ks || !ks.share_id) return;
    stil();
    var neu = Z.modus !== 'partner' || Z.share !== ks.share_id;
    Z.modus = 'partner'; Z.share = ks.share_id; Z.ks = ks; Z.objekt = window._currentObjKey || null; Z.aufgabe = null;
    var h = document.createElement('span'); h.className = 'dppk-anm-knoepfe';
    h.innerHTML = '<button type="button" class="pk-btn2" data-anm="markieren">Feld markieren</button><button type="button" class="pk-btn2" data-anm="frei">Anmerkung</button>' +
      '<button type="button" class="pk-btn2" data-anm="liste">Anmerkungen (0)</button><button type="button" class="pk-btn2 gold" data-anm="zurueck" disabled>Zurück an Kunden (0)</button>';
    banner.appendChild(h);
    h.querySelector('[data-anm="markieren"]').onclick = markierenStart;
    h.querySelector('[data-anm="frei"]').onclick = function () { fenster(null); };
    h.querySelector('[data-anm="liste"]').onclick = function () { if (Z.auf && document.getElementById('dppk-anm-liste') && !document.getElementById('dppk-anm-liste').classList.contains('zu')) listeZu(); else listeOeffnen(); };
    h.querySelector('[data-anm="zurueck"]').onclick = zurueckDialog;
    if (neu) { Z.liste = []; Z.auf = !klein(); }
    taktAn();
    laden().then(function () { if (!Z.liste.length && !klein()) Z.auf = false; listeZeichnen(); });
  }

  /* ── Kunde: Rueckmeldung am Original ───────────────────────────────────── */
  function kundeOeffnen(aufgabeId) {
    return api('/mein-partner/aufgaben/' + aufgabeId + '/anmerkungen').then(function (r) {
      var oid = r.aufgabe && r.aufgabe.objekt_id;
      if (!oid) { toast('Das Objekt gibt es bei dir nicht mehr. Die Anmerkungen stehen in der Aufgabe.'); return; }
      var ov = document.getElementById('dppk-ov'); if (ov) ov.remove();
      try { if (typeof window.setMainView === 'function') window.setMainView('single'); } catch (e) {}
      var geladen = window._currentObjKey === oid ? Promise.resolve() : Promise.resolve(typeof window.loadSaved === 'function' ? window.loadSaved(oid) : null);
      return geladen.then(function () {
        Z.modus = 'kunde'; Z.aufgabe = aufgabeId; Z.share = null; Z.ks = null; Z.objekt = oid; Z.liste = r.anmerkungen || []; Z.auf = true;
        setTimeout(function () {
          Z.objekt = window._currentObjKey || oid;
          taktAn(); listeZeichnen();
          var erste = Z.liste.filter(function (a) { return a.status !== 'erledigt' && (a.feld_id || a.selektor); })[0];
          if (erste) hinspringen(erste);
        }, 600);
      });
    }, function (e) { toast(fehlerText(e)); });
  }

  function ende() {
    markierenEnde(); fensterZu(); rahmenAus();
    Z.modus = null; Z.liste = []; Z.share = null; Z.aufgabe = null; Z.objekt = null;
    var l = document.getElementById('dppk-anm-liste'); if (l) l.remove();
    if (Z.takt) { clearInterval(Z.takt); Z.takt = null; }
  }

  /* ── v3640 · Bild: Ausschnitt aufziehen, markieren, verkleinern ───────────────────────────────────── */
  var BILD_ZIEL = 400 * 1024;   /* Bytes; Backend-Deckel BILD_MAX 560000 Zeichen data:-URL */
  var ROT = '#D8564C';
  function bytesVon(url) { var i = String(url || '').indexOf(','); return i < 0 ? 0 : Math.floor((url.length - i - 1) * 3 / 4); }
  /** Rein (Pruefer): groesste Seite hoechstens max, Seitenverhaeltnis bleibt */
  function zielMass(w, h, max) { var f = Math.min(1, max / Math.max(w, h, 1)); return { w: Math.max(1, Math.round(w * f)), h: Math.max(1, Math.round(h * f)) }; }
  /** Leinwand -> data:-URL unter BILD_ZIEL: WebP mit sinkender Qualitaet, dann kleiner; ohne WebP (Safari alt) JPEG */
  function verkleinern(cv) {
    var groessen = [1600, 1280, 1024, 800, 640], quali = [0.86, 0.72, 0.58, 0.45];
    var letzt = null;
    for (var gi = 0; gi < groessen.length; gi++) {
      var m = zielMass(cv.width, cv.height, groessen[gi]);
      var c2 = document.createElement('canvas'); c2.width = m.w; c2.height = m.h;
      var x = c2.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, m.w, m.h); x.drawImage(cv, 0, 0, m.w, m.h);
      for (var qi = 0; qi < quali.length; qi++) {
        var u = c2.toDataURL('image/webp', quali[qi]);
        if (u.indexOf('data:image/webp') !== 0) u = c2.toDataURL('image/jpeg', quali[qi]);
        letzt = u;
        if (bytesVon(u) <= BILD_ZIEL) return u;
      }
    }
    return letzt;
  }
  /* v3640 · html2canvas 1.4.1 kennt color(srgb …), oklab() und oklch() nicht und bricht den GANZEN Ausschnitt ab
     („unsupported color function color“, gemessen 17.11.2026: 2.738 Werte auf der Objektseite, aus color-mix im CSS).
     In der KOPIE, die html2canvas zeichnet, werden sie in rgba() umgerechnet - die Seite selbst bleibt unberuehrt. */
  function kanal(x) { x = Math.max(0, Math.min(1, x)); x = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, x)) * 255); }
  function oklabRgb(L, a, b) {
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [kanal(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), kanal(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), kanal(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
  }
  /** Rein (Pruefer): ersetzt color(srgb …), oklab(), oklch() in einem berechneten CSS-Wert durch rgba() */
  function farbeUmrechnen(v) {
    if (!v || !/(color|oklab|oklch)\(/.test(v)) return v;
    function z(s) { s = String(s).trim(); return /%$/.test(s) ? parseFloat(s) / 100 : parseFloat(s); }
    function al(s) { return s == null ? 1 : z(s); }
    return v.replace(/color\(srgb\s+([-\d.e%]+)\s+([-\d.e%]+)\s+([-\d.e%]+)(?:\s*\/\s*([-\d.e%]+))?\)/g, function (_, r, g, b, a) {
      return 'rgba(' + Math.round(Math.max(0, Math.min(1, z(r))) * 255) + ', ' + Math.round(Math.max(0, Math.min(1, z(g))) * 255) + ', ' + Math.round(Math.max(0, Math.min(1, z(b))) * 255) + ', ' + al(a) + ')';
    }).replace(/oklab\(([-\d.e%]+)\s+([-\d.e%]+)\s+([-\d.e%]+)(?:\s*\/\s*([-\d.e%]+))?\)/g, function (_, L, a, b, A) {
      var c = oklabRgb(z(L), parseFloat(a), parseFloat(b)); return 'rgba(' + c.join(', ') + ', ' + al(A) + ')';
    }).replace(/oklch\(([-\d.e%]+)\s+([-\d.e%]+)\s+([-\d.e]+)(?:deg)?(?:\s*\/\s*([-\d.e%]+))?\)/g, function (_, L, C, H, A) {
      var h = parseFloat(H) * Math.PI / 180, c = oklabRgb(z(L), parseFloat(C) * Math.cos(h), parseFloat(C) * Math.sin(h)); return 'rgba(' + c.join(', ') + ', ' + al(A) + ')';
    }).replace(/color\([^()]*\)/g, 'rgba(0, 0, 0, 0)');   /* andere Farbraeume: lieber durchsichtig als gar kein Bild */
  }
  var FARB_EIGENSCHAFTEN = ['color', 'background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'outline-color', 'box-shadow', 'text-shadow', 'text-decoration-color', 'caret-color', 'column-rule-color', 'fill', 'stroke',
    /* v3640a4 · gemessen: auch hier steht color()/oklab(), html2canvas liest sie mit */
    'text-decoration', '-webkit-text-fill-color', '-webkit-text-stroke-color', 'text-emphasis-color', '-webkit-tap-highlight-color'];
  /* v3640a4 · Alles passiert in der KOPIE, die html2canvas zeichnet (die Seite bleibt unberuehrt). Gemessen 17.11.2026:
     - color()/oklab() auch in ::before/::after (91) und in text-decoration, -webkit-text-*-color
     - eine gesetzte Farbe loest in der Kopie eine Transition aus, deren Zwischenwert wieder oklab ist -> erst
       transition/animation aus, dann lesen, dann schreiben; Kinder mit color-mix(currentColor) aendern sich danach -> bis
       zu drei Durchgaenge, jeder erst lesen, dann schreiben (abwechselnd fror der Reiter ein)
     - Verlauf auf einem Element ohne Flaeche bricht html2canvas mit createPattern ab -> background-image none */
  function farbSatz(cs) {
    var satz = null;
    for (var k = 0; k < FARB_EIGENSCHAFTEN.length; k++) {
      var v = cs.getPropertyValue(FARB_EIGENSCHAFTEN[k]);
      if (v && /(color|oklab|oklch)\(/.test(v)) (satz || (satz = [])).push([FARB_EIGENSCHAFTEN[k], farbeUmrechnen(v)]);
    }
    return satz;
  }
  function farbenRetten(doc) {
    var win = doc.defaultView || window, r = doc.querySelector('[data-dp-wurzel]');
    if (!r) return;
    var liste = [r], e = r;
    while (e.parentElement) { e = e.parentElement; liste.push(e); }
    liste = liste.concat([].slice.call(r.querySelectorAll('*')));
    liste.forEach(function (el) { if (el.style) { el.style.setProperty('transition', 'none', 'important'); el.style.setProperty('animation', 'none', 'important'); } });
    var st = doc.createElement('style'); (doc.head || doc.documentElement).appendChild(st);
    var regeln = [];
    for (var lauf = 0; lauf < 3; lauf++) {
      var auftrag = [], neuePseudo = 0;
      liste.forEach(function (el, j) {
        var cs = win.getComputedStyle(el), s = farbSatz(cs);
        if (lauf === 0 && cs.backgroundImage !== 'none') { var rr = el.getBoundingClientRect(); if (rr.width < 1 || rr.height < 1) (s || (s = [])).push(['background-image', 'none']); }
        if (s) auftrag.push([el, s]);
        ['::before', '::after'].forEach(function (p) {
          var c = win.getComputedStyle(el, p);
          if (c.content === 'none' || c.content === 'normal') return;
          var x = farbSatz(c);
          if (lauf === 0 && c.backgroundImage !== 'none' && (parseFloat(c.width) < 1 || parseFloat(c.height) < 1)) (x || (x = [])).push(['background-image', 'none']);
          if (!x) return;
          neuePseudo++;
          var a = 'data-dp-p' + p.slice(2, 3);
          el.setAttribute(a, String(j));
          regeln.push('[' + a + '="' + j + '"]' + p + '{' + x.map(function (q) { return q[0] + ':' + q[1] + ' !important'; }).join(';') + '}');
        });
      });
      if (!auftrag.length && !neuePseudo) break;
      auftrag.forEach(function (a) { a[1].forEach(function (q) { try { a[0].style.setProperty(q[0], q[1], 'important'); } catch (x) {} }); });
      st.textContent = regeln.join(' ');
    }
  }
  /* Kleinster Vorfahr, der den ganzen Ausschnitt enthaelt: html2canvas zeichnet dann nur diesen Teilbaum
     (gemessen 17.11.2026: document.body mit 9.540 Elementen brauchte 25 s) */
  function wurzelFuer(rect) {
    var a = document.elementFromPoint(rect.x + 2, rect.y + 2), b = document.elementFromPoint(rect.x + rect.w - 2, rect.y + rect.h - 2);
    var w = a;
    while (w && w !== document.body && !(w.contains(b) && (function (r) { return r.left <= rect.x + 1 && r.top <= rect.y + 1 && r.right >= rect.x + rect.w - 1 && r.bottom >= rect.y + rect.h - 1; })(w.getBoundingClientRect()))) w = w.parentElement;
    return w || document.body;
  }
  function unsereFlaechen(el) { return !!(el && el.id && /^dppk-(anm-|bild-)/.test(el.id)); }
  /** Bereich der Ansicht aufziehen -> Leinwand (html2canvas) oder null */
  function ausschnitt() {
    return new Promise(function (fertig) {
      stil();
      var weg = [].filter.call(document.querySelectorAll('#dppk-anm-fenster,#dppk-anm-liste,#dppk-anm-layer'), function (e) { return e; });
      weg.forEach(function (e) { e.setAttribute('data-sicht', e.style.visibility || ''); e.style.visibility = 'hidden'; });
      var zurueck = function () { weg.forEach(function (e) { e.style.visibility = e.getAttribute('data-sicht') || ''; e.removeAttribute('data-sicht'); }); };
      var o = document.createElement('div'); o.id = 'dppk-bild-auswahl';
      o.innerHTML = '<div class="ba-hinweis">Bereich aufziehen, den du zeigen willst. Esc bricht ab.</div>';
      document.body.appendChild(o);
      var r = null, start = null;
      function taste(ev) { if (ev.key === 'Escape') { ende(null); } }
      function ende(rect) {
        document.removeEventListener('keydown', taste, true);
        o.remove();
        if (!rect || rect.w < 8 || rect.h < 8) { zurueck(); return fertig(null); }
        if (typeof window.html2canvas !== 'function') { zurueck(); toast('Bildausschnitt geht hier nicht. Füge ein Bildschirmfoto mit „Bild einfügen“ ein.'); return fertig(null); }
        /* kurz warten, bis die Auswahlflaeche wirklich weg ist */
        setTimeout(function () {
          var sx = window.scrollX || window.pageXOffset || 0, sy = window.scrollY || window.pageYOffset || 0;
          var wurzel = wurzelFuer(rect);
          wurzel.setAttribute('data-dp-wurzel', '1');
          toast('Ausschnitt wird aufgenommen …');
          window.html2canvas(wurzel, {
            x: rect.x + sx, y: rect.y + sy, width: rect.w, height: rect.h,
            scrollX: -sx, scrollY: -sy, windowWidth: document.documentElement.clientWidth, windowHeight: document.documentElement.clientHeight,
            scale: Math.min(window.devicePixelRatio || 1, 2), useCORS: true, logging: false, backgroundColor: '#ffffff', imageTimeout: 2500,
            ignoreElements: function (el) { return unsereFlaechen(el) || (el.tagName === 'IFRAME' && !el.contains(wurzel)); }, onclone: farbenRetten
          }).then(function (cv) { wurzel.removeAttribute('data-dp-wurzel'); zurueck(); fertig(cv); }, function (e) { wurzel.removeAttribute('data-dp-wurzel'); zurueck(); try { console.warn('[anmerkungen] Ausschnitt', e); } catch (x) {} toast('Der Ausschnitt ging nicht. Füge ein Bildschirmfoto mit „Bild einfügen“ ein.'); fertig(null); });
        }, 60);
      }
      o.addEventListener('pointerdown', function (ev) {
        ev.preventDefault(); start = { x: ev.clientX, y: ev.clientY };
        r = document.createElement('div'); r.className = 'ba-rahmen'; o.appendChild(r);
        try { o.setPointerCapture(ev.pointerId); } catch (e) {}
      });
      o.addEventListener('pointermove', function (ev) {
        if (!start || !r) return;
        var x = Math.min(start.x, ev.clientX), y = Math.min(start.y, ev.clientY), w = Math.abs(ev.clientX - start.x), h = Math.abs(ev.clientY - start.y);
        r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.width = w + 'px'; r.style.height = h + 'px';
      });
      o.addEventListener('pointerup', function (ev) {
        if (!start) return;
        var x = Math.min(start.x, ev.clientX), y = Math.min(start.y, ev.clientY), w = Math.abs(ev.clientX - start.x), h = Math.abs(ev.clientY - start.y);
        start = null; ende({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
      });
      document.addEventListener('keydown', taste, true);
    });
  }
  function bildLaden(src) { return new Promise(function (ok, nein) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = nein; i.src = src; }); }
  function dateiLesen(f) { return new Promise(function (ok, nein) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = nein; r.readAsDataURL(f); }); }
  /** Bildfenster: Grundbild (Leinwand oder Bild) + Rechteck/Pfeil/Freihand in Rot, Rueckgaengig; Ergebnis data:-URL oder null */
  function bearbeiten(grund) {
    return new Promise(function (fertig) {
      stil();
      var basis = null, striche = [], werkzeug = 'rechteck', zieht = null;
      var ed = document.createElement('div'); ed.id = 'dppk-bild-ed';
      ed.innerHTML = '<div class="be-box" role="dialog" aria-label="Bild markieren"><div class="be-leiste">' +
        '<b style="font:600 14px \'Space Grotesk\',Inter,sans-serif;margin-right:6px">Markieren</b>' +
        '<button type="button" class="al-btn an" data-w="rechteck">Rechteck</button><button type="button" class="al-btn" data-w="pfeil">Pfeil</button><button type="button" class="al-btn" data-w="frei">Freihand</button>' +
        '<button type="button" class="al-btn" data-b="undo">Rückgängig</button><span style="flex:1"></span>' +
        '<label class="al-btn" style="display:inline-block">Bild einfügen<input type="file" accept="image/png,image/jpeg,image/webp" hidden></label></div>' +
        '<div class="be-flaeche"></div><div class="be-fuss"><span class="al-ort" style="flex:1" data-groesse></span>' +
        '<button type="button" class="al-btn" data-b="abbr">Abbrechen</button><button type="button" class="al-btn gold" data-b="ok">Übernehmen</button></div></div>';
      document.body.appendChild(ed);
      var fl = ed.querySelector('.be-flaeche'), cv = document.createElement('canvas'), cx = cv.getContext('2d');
      function leer() { fl.innerHTML = '<div class="be-leer">Füge ein Bildschirmfoto ein (Strg+V) oder wähle oben eine Datei.</div>'; }
      function setzeGrund(src) {
        basis = src; striche = [];
        cv.width = src.width || src.naturalWidth; cv.height = src.height || src.naturalHeight;
        fl.innerHTML = ''; fl.appendChild(cv); zeichnen();
      }
      function linie() { return Math.max(3, Math.round(Math.max(cv.width, cv.height) / 260)); }
      function strich(s) {
        cx.save(); cx.strokeStyle = ROT; cx.fillStyle = ROT; cx.lineWidth = s.lw; cx.lineCap = 'round'; cx.lineJoin = 'round';
        if (s.art === 'rechteck') cx.strokeRect(Math.min(s.a.x, s.b.x), Math.min(s.a.y, s.b.y), Math.abs(s.b.x - s.a.x), Math.abs(s.b.y - s.a.y));
        else if (s.art === 'pfeil') {
          var w = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x), k = s.lw * 4.5;
          cx.beginPath(); cx.moveTo(s.a.x, s.a.y); cx.lineTo(s.b.x, s.b.y); cx.stroke();
          cx.beginPath(); cx.moveTo(s.b.x, s.b.y); cx.lineTo(s.b.x - k * Math.cos(w - 0.45), s.b.y - k * Math.sin(w - 0.45)); cx.lineTo(s.b.x - k * Math.cos(w + 0.45), s.b.y - k * Math.sin(w + 0.45)); cx.closePath(); cx.fill();
        } else if (s.art === 'frei' && s.p.length) { cx.beginPath(); cx.moveTo(s.p[0].x, s.p[0].y); s.p.forEach(function (q) { cx.lineTo(q.x, q.y); }); cx.stroke(); }
        cx.restore();
      }
      function zeichnen() {
        if (!basis) return;
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(basis, 0, 0, cv.width, cv.height);
        striche.forEach(strich); if (zieht) strich(zieht);
        var g = ed.querySelector('[data-groesse]'); if (g) g.textContent = cv.width + ' × ' + cv.height + ' px' + (striche.length ? ', ' + striche.length + (striche.length === 1 ? ' Markierung' : ' Markierungen') : '');
      }
      function punkt(ev) { var b = cv.getBoundingClientRect(); return { x: (ev.clientX - b.left) * cv.width / b.width, y: (ev.clientY - b.top) * cv.height / b.height }; }
      cv.addEventListener('pointerdown', function (ev) { if (!basis) return; ev.preventDefault(); var p = punkt(ev); zieht = { art: werkzeug, a: p, b: p, p: [p], lw: linie() }; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} });
      cv.addEventListener('pointermove', function (ev) { if (!zieht) return; var p = punkt(ev); zieht.b = p; if (zieht.art === 'frei') zieht.p.push(p); zeichnen(); });
      cv.addEventListener('pointerup', function () { if (!zieht) return; var s = zieht; zieht = null; if (s.art === 'frei' ? s.p.length > 1 : (Math.abs(s.b.x - s.a.x) + Math.abs(s.b.y - s.a.y) > 4)) striche.push(s); zeichnen(); });
      [].forEach.call(ed.querySelectorAll('[data-w]'), function (b) { b.onclick = function () { werkzeug = b.getAttribute('data-w'); [].forEach.call(ed.querySelectorAll('[data-w]'), function (x) { x.classList.toggle('an', x === b); }); }; });
      ed.querySelector('[data-b="undo"]').onclick = function () { striche.pop(); zeichnen(); };
      function einsetzen(url) { return bildLaden(url).then(setzeGrund, function () { toast('Das Bild ließ sich nicht lesen.'); }); }
      ed.querySelector('input[type=file]').onchange = function (ev) { var f = ev.target.files && ev.target.files[0]; if (f) dateiLesen(f).then(einsetzen); };
      function einfuegen(ev) {
        var it = ev.clipboardData && ev.clipboardData.items; if (!it) return;
        for (var i = 0; i < it.length; i++) if (it[i].type && it[i].type.indexOf('image/') === 0) { ev.preventDefault(); dateiLesen(it[i].getAsFile()).then(einsetzen); return; }
      }
      document.addEventListener('paste', einfuegen, true);
      function schluss(w) { document.removeEventListener('paste', einfuegen, true); ed.remove(); fertig(w); }
      ed.querySelector('[data-b="abbr"]').onclick = function () { schluss(null); };
      ed.querySelector('[data-b="ok"]').onclick = function () {
        if (!basis) return toast('Erst ein Bild aufnehmen oder einfügen.');
        striche.forEach(function () {}); zieht = null; zeichnen();
        var u = verkleinern(cv);
        if (!u || bytesVon(u) > BILD_ZIEL * 1.05) return toast('Das Bild ist zu groß, bitte einen kleineren Ausschnitt wählen.');
        schluss(u);
      };
      if (grund && typeof grund === 'string') einsetzen(grund); else if (grund) setzeGrund(grund); else leer();
    });
  }
  /** Bildzeile im Anmerkungs- bzw. Antwortfenster: Ausschnitt, Einfügen, Vorschau, Ändern, Entfernen */
  function bildZeile(z, bild, fensterEl) {
    if (!z) return;
    function neu() {
      z.innerHTML = bild.wert
        ? '<img alt="Bild zur Anmerkung" src="' + esc(bild.wert) + '" data-g="1"><button type="button" class="al-btn" data-bb="aendern">Markieren</button><button type="button" class="al-btn rot" data-bb="weg">Bild entfernen</button><span class="al-ort">' + Math.round(bytesVon(bild.wert) / 1024) + ' KB</span>'
        : '<button type="button" class="al-btn" data-bb="ausschnitt">Bildausschnitt</button><button type="button" class="al-btn" data-bb="einfuegen">Bild einfügen</button>';
      var g = z.querySelector('[data-g]'); if (g) g.onclick = function () { grossZeigen(bild.wert); };
      [].forEach.call(z.querySelectorAll('[data-bb]'), function (b) {
        b.onclick = function () {
          var w = b.getAttribute('data-bb');
          if (w === 'weg') { bild.wert = null; return neu(); }
          var p = w === 'ausschnitt' ? ausschnitt().then(function (cv) { return cv ? bearbeiten(cv) : null; })
            : w === 'aendern' ? bearbeiten(bild.wert) : bearbeiten(null);
          if (fensterEl) fensterEl.style.visibility = 'hidden';
          p.then(function (u) { if (fensterEl) fensterEl.style.visibility = ''; if (u) { bild.wert = u; neu(); } }, function () { if (fensterEl) fensterEl.style.visibility = ''; });
        };
      });
    }
    neu();
  }
  function grossZeigen(src) {
    if (!src) return; stil();
    var g = document.createElement('div'); g.id = 'dppk-bild-gross'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-label', 'Bild groß');
    g.innerHTML = '<img alt="Bild groß" src="' + esc(src) + '">';
    g.onclick = function () { g.remove(); };
    document.addEventListener('keydown', function k(ev) { if (ev.key === 'Escape') { g.remove(); document.removeEventListener('keydown', k, true); } }, true);
    document.body.appendChild(g);
  }

  window.DpAnmerkungen = { partnerBanner: partnerBanner, kundeOeffnen: kundeOeffnen, ende: ende, zuordnen: zuordnen, _zustand: Z, _feldBeschreiben: feldBeschreiben, _pfad: pfad,
    /* v3640 */ ohneBearbeitung: ohneBearbeitung, _farbeUmrechnen: farbeUmrechnen, istRueckfrage: istRueckfrage, _zielMass: zielMass, _bytesVon: bytesVon, BILD_ZIEL: BILD_ZIEL, _ausschnitt: ausschnitt, _bearbeiten: bearbeiten, _grossZeigen: grossZeigen };
})();
