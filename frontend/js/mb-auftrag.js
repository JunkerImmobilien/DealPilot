/* mb-auftrag.js - v2174
 * ═════════════════════════════════════════════════════════════════════
 * DER MARKTBERICHT LAEUFT IM HINTERGRUND WEITER.
 *
 * Marcel am 13.10.2026: „wird dem Kunden dann ein Modal angezeigt mit
 * Progressbar, dass der Bericht in Arbeit ist und auch der Fortschritt?
 * Kann man es so machen, dass er, wenn man das Modal schliesst, im
 * Hintergrund weiter erstellt wird und irgendwo dann gemeldet wird, dass
 * er nun zur Verfuegung steht und man den dann oeffnen kann?"
 *
 * GEMESSEN vorher: der Abruf aus dem Tab Objekt zeigte einen Dreh-Kreis
 * ohne Balken und ohne Schliessen (_mbSpinner) und war EIN blockierender
 * Request. Echte Schrittmeldungen gab es nur in der Marktbericht-App.
 *
 * Jetzt nimmt der Tab Objekt denselben Streaming-Weg wie die
 * Marktbericht-App (/reports/generate-stream, NDJSON). Dieses Modul ist
 * nur die Anzeige und das Gedaechtnis:
 *
 *   start()    oeffnet das Modal und merkt den Auftrag (auch ueber ein
 *              Neuladen hinweg, ohne Ergebnis)
 *   schritt()  hakt die Etappe ab, die der Server WIRKLICH gemeldet hat
 *   fertig()   meldet per Hinweis und Pille, wenn das Modal zu war
 *   fehler()   sagt, was schiefging
 *
 * Der Balken zeigt abgehakte Etappen, keine erfundene Zeit: acht Etappen,
 * jede mit dem Muster der Servermeldung, die sie abschliesst.
 *
 * SCHLIESST MAN DEN TAB, rechnet der Server trotzdem zu Ende und bucht
 * erst bei einem Ergebnis ab (Proxy generate-stream liest die done-Zeile
 * nach dem Stream). Beim naechsten Laden sieht dieses Modul im Verlauf
 * nach und meldet den Bericht als fertig.
 * ═════════════════════════════════════════════════════════════════════
 */
(function (global) {
  'use strict';

  var MERKER = 'dp_mb_auftraege';
  var ETAPPEN = [
    { t: 'Standort ermitteln',   m: /^(Standort|geocode)/ },
    { t: 'Vergleichspreise',     m: /^Vergleichspreise/ },
    { t: 'Vergleichsmieten',     m: /^Vergleichsmieten/ },
    { t: 'Mikrolage',            m: /^Mikrolage/ },
    { t: 'Makrolage',            m: /^(Makrolage|macro:)/ },
    { t: 'Strukturdaten (Zensus)', m: /^Strukturdaten/ },
    { t: 'Bodenrichtwert',       m: /^Bodenrichtwert/ },
    { t: 'Bewertung und Bericht', m: /^(persist|Marktdaten verrechnet|DONE)/ }
  ];
  var STUFE = { 1: 'Marktpreisindikation', 2: 'Erweiterte Marktpreisindikation', 3: 'Wertermittlung nach ImmoWertV' };

  var auftraege = [];          /* {id,key,ref,label,stufe,start,status,erledigt[],warte,payload,gesehen,fehler} */
  var offen = null;            /* id des Auftrags im Modal */
  var uhr = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function finde(id) { for (var i = 0; i < auftraege.length; i++) if (auftraege[i].id === id) return auftraege[i]; return null; }
  function sichern() {
    try {
      localStorage.setItem(MERKER, JSON.stringify(auftraege.filter(function (a) { return !a.gesehen; })
        .map(function (a) { return { id: a.id, key: a.key, ref: a.ref, label: a.label, stufe: a.stufe, start: a.start, status: a.status }; })));
    } catch (e) {}
  }

  /* ── Darstellung ─────────────────────────────────────────────────── */
  function css() {
    if (document.getElementById('dp-mba-css')) return;
    var st = document.createElement('style'); st.id = 'dp-mba-css';
    st.textContent = [
      '#dp-mba{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(5,5,5,.55);padding:16px}',
      '#dp-mba .k{width:100%;max-width:440px;background:#141210;color:#F2ECDC;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent);border-radius:16px;padding:20px 22px;box-shadow:0 24px 70px -18px rgba(0,0,0,.7);font:400 13px/1.5 Inter,system-ui,sans-serif}',
      '#dp-mba .ue{font:600 11px/1.4 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--wl-e8cc7a, #E8CC7A)}',
      '#dp-mba .ti{font:600 17px/1.35 "Space Grotesk",sans-serif;margin:4px 0 2px}',
      '#dp-mba .ad{color:#A8A299;font-size:12.5px;margin-bottom:14px}',
      '#dp-mba .bal{height:8px;border-radius:5px;background:rgba(242,236,220,.1);overflow:hidden}',
      '#dp-mba .bal i{display:block;height:100%;width:0;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));transition:width .35s ease}',
      '#dp-mba .st{display:flex;justify-content:space-between;margin:7px 0 12px;font:500 11.5px/1.4 "JetBrains Mono",monospace;color:#A8A299}',
      '#dp-mba ul{list-style:none;margin:0 0 16px;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:5px 14px}',
      '#dp-mba li{font-size:12.5px;color:#7d776c;display:flex;gap:7px;align-items:center}',
      '#dp-mba li.ok{color:#E8E2D4}#dp-mba li .p{width:14px;flex:0 0 14px;text-align:center}',
      '#dp-mba li.ok .p{color:#3FA56C}#dp-mba li.jetzt .p{color:var(--wl-c9a84c, #C9A84C)}',
      '#dp-mba .warte{margin:-4px 0 12px;padding:8px 11px;border-radius:9px;background:rgba(201,168,76,.12);color:var(--wl-e8cc7a, #E8CC7A);font-size:12.5px}',
      '#dp-mba .fe{margin:0 0 12px;padding:9px 12px;border-radius:9px;background:rgba(184,98,92,.18);color:#F0B4AE;font-size:12.5px}',
      '#dp-mba .fu{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap}',
      '#dp-mba .hi{color:#8b8678;font-size:11.5px;flex:1 1 180px}',
      '#dp-mba button{border:0;border-radius:10px;padding:10px 15px;cursor:pointer;font:600 13px/1.2 "Space Grotesk",sans-serif}',
      '#dp-mba .b1{background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));color:#1a1407}',
      /* v2174b: gemessen lag sie unten links ueber dem Nutzerbereich (sb-user-icons). Unten mittig liegt nur scrollbarer Inhalt; 76 px halten sie ueber dem Toast (bottom 20 px). */
      '#dp-mba-pille{position:fixed;left:50%;transform:translateX(-50%);bottom:76px;z-index:9990;display:flex;flex-direction:column;align-items:center;gap:6px;max-width:calc(100vw - 32px)}',
      '#dp-mba-pille button{display:flex;align-items:center;gap:8px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 50%, transparent);background:#141210;color:#F2ECDC;border-radius:999px;padding:8px 14px;cursor:pointer;font:500 12.5px/1.3 Inter,system-ui,sans-serif;box-shadow:0 10px 28px -10px rgba(0,0,0,.6);max-width:100%;text-align:left}',
      '#dp-mba-pille button b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#dp-mba-pille button.fertig{border-color:#3FA56C}',
      '#dp-mba-pille button.fehler{border-color:#B8625C}',
      '#dp-mba-pille .dreh{width:12px;height:12px;flex:0 0 12px;border:2px solid rgba(201,168,76,.3);border-top-color:var(--wl-c9a84c, #C9A84C);border-radius:50%;animation:dpmbadreh .8s linear infinite}',
      '@keyframes dpmbadreh{to{transform:rotate(360deg)}}'
    ].join('');
    document.head.appendChild(st);
  }

  function dauer(a) {
    var s = Math.max(0, Math.round(((a.ende || Date.now()) - a.start) / 1000));
    return (s >= 60 ? Math.floor(s / 60) + ' min ' : '') + (s % 60) + ' s';
  }

  function modalZeichnen() {
    var a = finde(offen);
    var host = document.getElementById('dp-mba');
    if (!a) { if (host) host.parentNode.removeChild(host); if (uhr) { clearInterval(uhr); uhr = null; } return; }
    css();
    if (!host) {
      host = document.createElement('div'); host.id = 'dp-mba';
      host.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('[data-mba]') : null;
        if (!b) return;
        var was = b.getAttribute('data-mba');
        if (was === 'hintergrund' || was === 'schliessen') schliessen();
        if (was === 'ansehen') { var x = finde(offen); schliessen(); if (x) ansehen(x.id); }
      });
      document.body.appendChild(host);
    }
    var n = a.erledigt.length, proz = Math.round(n / ETAPPEN.length * 100);
    var lauf = a.status === 'laeuft';
    var html = '<div class="k" role="dialog" aria-label="Marktbericht in Arbeit">'
      + '<div class="ue">Marktbericht · Stufe ' + esc(a.stufe) + '</div>'
      + '<div class="ti">' + (lauf ? esc(STUFE[a.stufe] || 'Bericht') + ' wird erstellt'
          : a.status === 'fertig' ? '✓ Bericht ist fertig' : 'Bericht nicht erstellt') + '</div>'
      + '<div class="ad">' + esc(a.label || '') + '</div>'
      + '<div class="bal"><i style="width:' + (a.status === 'fertig' ? 100 : proz) + '%"></i></div>'
      + '<div class="st"><span>' + (a.status === 'fertig' ? ETAPPEN.length : n) + ' von ' + ETAPPEN.length + ' Etappen</span><span>' + dauer(a) + '</span></div>'
      + (lauf && a.warte ? '<div class="warte">' + esc(a.warte) + '</div>' : '')
      + (a.status === 'fehler' ? '<div class="fe">' + esc(a.fehler || 'Fehler') + '</div>' : '')
      + '<ul>' + ETAPPEN.map(function (e, i) {
          var ok = a.status === 'fertig' || a.erledigt.indexOf(i) >= 0;
          var jetzt = lauf && !ok && i === naechste(a);
          var ohne = a.ohne && a.ohne[i];
          return '<li class="' + (ohne ? '' : ok ? 'ok' : jetzt ? 'jetzt' : '') + '"><span class="p">' + (ohne ? '–' : ok ? '✓' : jetzt ? '●' : '○') + '</span>' + esc(e.t) + (ohne ? ' · nicht im Umfang' : '') + '</li>';
        }).join('') + '</ul>'
      + '<div class="fu">'
      + (lauf ? '<span class="hi">Du kannst weiterarbeiten — der Bericht wird im Hintergrund fertig, und du bekommst eine Meldung.</span>'
              + '<button type="button" class="b1" data-mba="hintergrund">Im Hintergrund weiter</button>'
              : '<span class="hi"></span>'
              + (a.status === 'fertig' && !a.angewandt ? '<button type="button" class="b1" data-mba="ansehen">Bericht öffnen</button>' : '')
              + '<button type="button" class="b1" data-mba="schliessen">Schließen</button>')
      + '</div></div>';
    host.innerHTML = html;
    if (lauf && !uhr) uhr = setInterval(modalZeichnen, 1000);
    if (!lauf && uhr) { clearInterval(uhr); uhr = null; }
  }
  function naechste(a) { for (var i = 0; i < ETAPPEN.length; i++) if (a.erledigt.indexOf(i) < 0) return i; return -1; }

  function schliessen() {
    offen = null; modalZeichnen(); pilleZeichnen();
  }

  function pilleZeichnen() {
    css();
    var p = document.getElementById('dp-mba-pille');
    var zeigen = auftraege.filter(function (a) { return !a.gesehen && a.id !== offen; });
    if (!zeigen.length) { if (p) p.parentNode.removeChild(p); return; }
    if (!p) {
      p = document.createElement('div'); p.id = 'dp-mba-pille';
      p.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('[data-mba-id]') : null;
        if (!b) return;
        var a = finde(b.getAttribute('data-mba-id'));
        if (!a) return;
        if (a.status === 'laeuft' || a.status === 'fehler') { offen = a.id; if (a.status === 'fehler') a.gesehen = true; modalZeichnen(); pilleZeichnen(); sichern(); }
        else ansehen(a.id);
      });
      document.body.appendChild(p);
    }
    p.innerHTML = zeigen.map(function (a) {
      var t = a.status === 'laeuft' ? '<span class="dreh"></span>Marktbericht in Arbeit · <b>' + esc(a.label) + '</b>'
        : a.status === 'fertig' ? '✓ Marktbericht fertig · <b>' + esc(a.label) + '</b> — öffnen'
        : '⚠ Marktbericht nicht erstellt · <b>' + esc(a.label) + '</b>';
      return '<button type="button" class="' + (a.status === 'laeuft' ? '' : a.status) + '" data-mba-id="' + esc(a.id) + '">' + t + '</button>';
    }).join('');
  }

  /* Den fertigen Bericht oeffnen: liegt er schon auf der Karte (gleiches
     Objekt), dorthin scrollen. Sonst das Objekt laden und das Ergebnis
     uebernehmen - es gehoert zu DIESEM Objekt, nicht zum gerade offenen. */
  function ansehen(id) {
    var a = finde(id); if (!a) return;
    a.gesehen = true; sichern(); pilleZeichnen();
    function zurKarte() {
      try { if (typeof global.switchTab === 'function') global.switchTab(0); } catch (e) {}
      setTimeout(function () {
        var h = document.getElementById('dp-mb-host');
        if (h && h.scrollIntoView) h.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 250);
    }
    if (a.angewandt && global._currentObjKey === a.key) { zurKarte(); return; }
    function uebernehmen() {
      if (a.payload && global.DealPilotMB && DealPilotMB.uebernehmen(a.payload)) { a.angewandt = true; zurKarte(); return; }
      /* Ergebnis nicht mehr im Speicher (Seite neu geladen): es liegt im
         Marktbericht-Verlauf dieses Objekts. */
      if (typeof global.openMarktberichtView === 'function') global.openMarktberichtView();
      else if (typeof global.toast === 'function') toast('Der Bericht liegt im Marktbericht-Verlauf dieses Objekts.');
    }
    if (global._currentObjKey === a.key) { uebernehmen(); return; }
    if (typeof global.loadSaved !== 'function' || !a.key) return;
    var fertig = false;
    var horch = function () {
      if (fertig || global._currentObjKey !== a.key) return;
      fertig = true; global.removeEventListener('dp:object-ready', horch);
      setTimeout(uebernehmen, 400);
    };
    global.addEventListener('dp:object-ready', horch);
    try { global.loadSaved(a.key); } catch (e) {}
  }

  /* ── Schnittstelle fuer dealpilot-mb.js ──────────────────────────── */
  function start(o) {
    var a = { id: 'mba' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      key: o.key || null, ref: o.ref || null, label: o.label || 'Objekt', stufe: o.stufe || 1,
      start: Date.now(), status: 'laeuft', erledigt: [], warte: null };
    auftraege.push(a); offen = a.id; sichern(); modalZeichnen(); pilleZeichnen();
    return a.id;
  }
  function schritt(id, msg) {
    var a = finde(id); if (!a || a.status !== 'laeuft') return;
    msg = String(msg || '');
    var w = msg.match(/^Warteschlange[^\d]*(\d+)/);
    if (w) a.warte = 'In der Warteschlange — Platz ' + w[1] + '. Gleich geht es los.';
    /* v2174: im Schnellmodus (Stufe 1) gibt es keine Makrolage - gemessen,
       der Stream meldet sie dort nicht. Sie zaehlt dann als „nicht im Umfang". */
    if (/^SCHNELL-MODUS/.test(msg)) { a.ohne = a.ohne || {}; a.ohne[4] = true; if (a.erledigt.indexOf(4) < 0) a.erledigt.push(4); }
    for (var i = 0; i < ETAPPEN.length; i++) {
      if (a.erledigt.indexOf(i) < 0 && ETAPPEN[i].m.test(msg)) { a.erledigt.push(i); a.warte = null; }
    }
    if (offen === id) modalZeichnen();
  }
  function fertig(id, o) {
    var a = finde(id); if (!a) return;
    a.status = 'fertig'; a.ende = Date.now(); a.erledigt = ETAPPEN.map(function (_, i) { return i; });
    a.angewandt = !!(o && o.angewandt); a.payload = (o && o.payload) || null;
    if (offen === id) {
      /* Modal noch offen: der Nutzer hat zugesehen - kurz „fertig" zeigen,
         dann schliessen. Gemeldet werden muss nichts mehr. */
      a.gesehen = a.angewandt; modalZeichnen();
      if (a.angewandt) setTimeout(function () { if (offen === id) schliessen(); }, 1400);
    } else if (typeof global.toast === 'function') {
      toast('✓ Marktbericht fertig: ' + a.label + ' — unten links öffnen');
    }
    sichern(); pilleZeichnen();
  }
  function fehler(id, msg) {
    var a = finde(id); if (!a) return;
    a.status = 'fehler'; a.ende = Date.now(); a.fehler = msg || 'Unbekannter Fehler';
    if (offen === id) modalZeichnen(); else if (typeof global.toast === 'function') toast('⚠ Marktbericht nicht erstellt: ' + a.fehler);
    sichern(); pilleZeichnen();
  }
  /* Ein Auftrag ohne Ergebnis (Kontingent leer, keine Daten) - nur
     schliessen, die Meldung macht der Aufrufer. */
  function abbrechen(id) {
    var a = finde(id); if (!a) return;
    auftraege = auftraege.filter(function (x) { return x.id !== id; });
    if (offen === id) offen = null;
    modalZeichnen(); pilleZeichnen(); sichern();
  }

  /* ── Nach einem Neuladen: was lief, als die Seite zuging? ──────────
     Der Server rechnet weiter. Im Verlauf des Objekts steht der Bericht,
     sobald er fertig ist - dort wird nachgesehen, bis zu 15 Minuten. */
  function nachsehen() {
    var alt = [];
    try { alt = JSON.parse(localStorage.getItem(MERKER) || '[]') || []; } catch (e) { alt = []; }
    alt.forEach(function (x) {
      if (finde(x.id)) return;
      var a = { id: x.id, key: x.key, ref: x.ref, label: x.label, stufe: x.stufe, start: x.start,
        status: x.status === 'fertig' ? 'fertig' : 'laeuft', erledigt: [], payload: null };
      if (Date.now() - a.start > 24 * 3600 * 1000) return;
      auftraege.push(a);
      if (a.status === 'laeuft') pruefen(a, 0);
    });
    pilleZeichnen();
  }
  function pruefen(a, n) {
    if (typeof Auth === 'undefined' || !Auth.apiCall || !a.key) return;
    Auth.apiCall('/marktbericht/objects/history?key=' + encodeURIComponent('dp:' + a.key), { method: 'GET' })
      .then(function (d) {
        var neu = ((d && d.history) || []).some(function (h) { return h && new Date(h.created_at).getTime() >= a.start - 5000; });
        if (neu) { a.status = 'fertig'; a.ende = Date.now(); sichern(); pilleZeichnen(); return; }
        if (Date.now() - a.start > 15 * 60 * 1000) { a.status = 'fehler'; a.fehler = 'Kein Ergebnis im Verlauf gefunden.'; sichern(); pilleZeichnen(); return; }
        setTimeout(function () { pruefen(a, n + 1); }, 15000);
      })
      .catch(function () { if (n < 40) setTimeout(function () { pruefen(a, n + 1); }, 15000); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(nachsehen, 2500); });
  else setTimeout(nachsehen, 2500);

  global.MbAuftrag = { start: start, schritt: schritt, fertig: fertig, fehler: fehler, abbrechen: abbrechen,
    liste: function () { return auftraege.slice(); }, ETAPPEN: ETAPPEN };
})(window);
