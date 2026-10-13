'use strict';
/* ═════════════════════════════════════════════════════════════════════
   pilot-tower.js — v2188 · Der Pilot auf Tastendruck („Tower")

   Marcel, 13.10.2026: „Vielleicht auch einen kleinen animierten Piloten,
   den wir immer rufen können, an jeder Stelle der App, über einen
   Tastenkürzel bzw. Hotkey, und dann werden die Fragen beantwortet oder
   das Feld erklärt." Nach der Demo (hilfe-demo.html, v2187): „Der Pilot
   muss ein kleines Pilot-Männchen sein. Ja, die Richtung passt, setz das um."

   Was dieses Modul tut:
   · F1 (überall) oder ? (wenn nicht gerade getippt wird) ruft den Piloten.
     Er fliegt zu dem Feld, auf dem Maus oder Cursor gerade stehen, und
     öffnet daneben den Tower.
   · Der Tower erklärt das Feld — mit DEMSELBEN Text wie die Hover-Hilfe
     (DealPilotFeldHilfe.textFuer, also tooltip-content.js), nicht mit
     einem zweiten Text. Zwei Erklärungen für ein Feld laufen auseinander.
   · Darunter die Frage. Sofort-Antworten kommen ohne KI aus vier
     Quellen: Feld-Erklärungen (DpTooltips), Hilfe-Themen (help.js),
     Abläufe (prozess-atlas.js) und Aktionen (wohin man springen kann).
   · „Den Piloten fragen" schickt die Frage an /ai/copilot — mit den
     besten Treffern als Auszug, damit die KI die App-Hilfe kennt.
   · Im Quick-Check-Fenster (eigenes Dokument, iframe) läuft dieselbe
     Datei als Brücke: sie fängt die Taste ab und ruft den Piloten des
     Elternfensters (Memory: iframe-erbt-nichts).
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DealPilotPilot) return;

  /* ── Brücke im iframe ─────────────────────────────────────────────── */
  var eltern = null;
  try { if (window.parent && window.parent !== window && window.parent.DealPilotPilot) eltern = window.parent.DealPilotPilot; } catch (e) { eltern = null; }
  function tippt(el) {
    if (!el) return false;
    var t = (el.tagName || '').toUpperCase();
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  }
  function beschrift(el) {
    if (!el) return '';
    try { if (el.labels && el.labels[0]) return el.labels[0].textContent.replace(/\s+/g, ' ').trim(); } catch (e) {}
    var f = el.closest && el.closest('.f, .qc-field, .field, label');
    var lab = f && f.querySelector && f.querySelector('label');
    return (lab ? lab.textContent : (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder'))) || '').replace(/\s+/g, ' ').trim();
  }
  if (eltern) {
    var _letzt = null;
    document.addEventListener('mouseover', function (e) { _letzt = e.target; }, true);
    document.addEventListener('keydown', function (e) {
      var ae = document.activeElement;
      if (e.key === 'F1' || (e.key === '?' && !tippt(ae))) {
        e.preventDefault();
        var el = tippt(ae) ? ae : _letzt;
        var titel = beschrift(el);
        try { eltern.rufen({ titel: titel, quelle: 'Quick-Check' }); } catch (x) {}
      }
    }, true);
    window.DealPilotPilot = { bruecke: true };
    return;
  }

  /* ── Hilfsmittel ──────────────────────────────────────────────────── */
  var G = 'var(--wl-c9a84c, #C9A84C)', GH = 'var(--wl-e8cc7a, #E8CC7A)', GL = 'var(--wl-b8932f, #b8932f)';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ohneTags(s) { var d = document.createElement('div'); d.innerHTML = String(s || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9%§ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function kurz(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + ' …' : s; }

  /* ── CSS ──────────────────────────────────────────────────────────── */
  function css() {
    if (document.getElementById('dp-pilot-css')) return;
    var st = document.createElement('style'); st.id = 'dp-pilot-css';
    st.textContent = [
      '#dp-pilot{position:fixed;left:14px;bottom:14px;width:62px;height:76px;z-index:10060;cursor:pointer;transition:left .75s cubic-bezier(.3,1.25,.45,1),top .75s cubic-bezier(.3,1.25,.45,1),bottom .75s,width .3s,height .3s;filter:drop-shadow(0 8px 12px rgba(0,0,0,.35))}',
      '#dp-pilot.ruht{width:46px;height:56px;opacity:.92}',
      '#dp-pilot:hover{opacity:1}',
      '#dp-pilot svg{width:100%;height:100%;overflow:visible}',
      '#dp-pilot .koerper{animation:dpp-schweben 2.8s ease-in-out infinite;transform-origin:40px 60px}',
      '#dp-pilot.fliegt .koerper{animation:dpp-fliegen .75s ease-in-out}',
      '#dp-pilot .schal{animation:dpp-schal .9s ease-in-out infinite alternate;transform-origin:30px 58px}',
      '#dp-pilot .auge{animation:dpp-blink 4.2s infinite;transform-origin:center;transform-box:fill-box}',
      '#dp-pilot .arm-r{transform-origin:55px 62px;transition:transform .3s}',
      '#dp-pilot.winkt .arm-r{animation:dpp-winken .45s ease-in-out 4 alternate}',
      '#dp-pilot.zeigt .arm-r{transform:rotate(-115deg)}',
      '#dp-pilot .brille{transition:transform .35s}',
      '#dp-pilot.denkt .brille{transform:translateY(7px)}',
      '#dp-pilot .haut{fill:#F1C9A5}#dp-pilot .kappe{fill:#4a3423}#dp-pilot .kappe2{fill:#36261a}',
      '#dp-pilot .jacke{fill:#2b241f}#dp-pilot .gold{fill:' + G + '}#dp-pilot .goldh{fill:' + GH + '}',
      '#dp-pilot .glas{fill:#bfe3f0}#dp-pilot .tinte{fill:#1a1714}#dp-pilot .wange{fill:#e9a38b;opacity:.55}',
      '#dp-pilot .mund{fill:none;stroke:#7a3b2a;stroke-width:1.6;stroke-linecap:round}',
      '#dp-pilot .gurt{fill:none;stroke:' + GL + ';stroke-width:2}',
      '@keyframes dpp-schweben{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-5px) rotate(2deg)}}',
      '@keyframes dpp-fliegen{0%{transform:rotate(0)}30%{transform:rotate(-14deg) scale(1.05)}100%{transform:rotate(0)}}',
      '@keyframes dpp-schal{from{transform:skewY(-6deg) scaleX(1)}to{transform:skewY(6deg) scaleX(1.12)}}',
      '@keyframes dpp-blink{0%,93%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}',
      '@keyframes dpp-winken{from{transform:rotate(-100deg)}to{transform:rotate(-150deg)}}',
      '.dp-pilot-spur{position:fixed;width:7px;height:7px;border-radius:50%;background:' + GH + ';z-index:10059;pointer-events:none;animation:dpp-spur .8s ease-out forwards}',
      '@keyframes dpp-spur{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(.2)}}',
      '.dp-pilot-spot{box-shadow:0 0 0 3px ' + G + ',0 0 0 10px rgba(201,168,76,.22) !important;border-radius:10px;transition:box-shadow .3s}',
      '#dp-tower{position:fixed;z-index:10058;width:min(440px,calc(100vw - 24px));max-height:min(78vh,640px);display:none;flex-direction:column;background:#141210;color:#f3ead0;border:1px solid rgba(201,168,76,.45);border-radius:16px;box-shadow:0 30px 80px -20px rgba(0,0,0,.65);font:400 13.5px/1.5 Inter,system-ui,sans-serif}',
      '#dp-tower.an{display:flex;animation:dpt-auf .28s cubic-bezier(.2,1.2,.4,1)}',
      '@keyframes dpt-auf{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}',
      '#dp-tower .k{display:flex;align-items:center;gap:8px;padding:12px 14px 8px}',
      '#dp-tower .k .u{flex:1;font:500 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:' + GH + '}',
      '#dp-tower kbd{font:600 11px "JetBrains Mono",monospace;background:#26211b;color:#e8dcc0;border:1px solid #3a3227;border-radius:5px;padding:1px 6px}',
      '#dp-tower .zu{background:none;border:0;color:#b9ad8f;font-size:20px;line-height:1;cursor:pointer;padding:0 4px}',
      '#dp-tower .rumpf{overflow:auto;padding:0 14px 12px}',
      '#dp-tower .feld{margin:2px 0 10px;padding:11px 12px;border-radius:11px;background:rgba(201,168,76,.10);border:1px solid rgba(201,168,76,.3)}',
      '#dp-tower .feld .t{font:600 14px "Space Grotesk",sans-serif;color:' + GH + '}',
      '#dp-tower .feld .t small{font:500 10.5px "JetBrains Mono",monospace;color:#b9ad8f;margin-left:6px}',
      '#dp-tower .feld p{margin:5px 0 0;color:#e4dccb}',
      '#dp-tower .feld ul{margin:6px 0 0;padding-left:17px;color:#cdbf9f;font-size:12.5px}',
      '#dp-tower input.frage{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid rgba(201,168,76,.4);background:#0b0a09;color:#f3ead0;font:500 14px Inter,sans-serif}',
      '#dp-tower input.frage:focus{outline:2px solid ' + G + ';outline-offset:0}',
      '#dp-tower ul.tr{list-style:none;margin:8px 0 0;padding:0}',
      '#dp-tower ul.tr li{padding:8px 9px;border-radius:9px;cursor:pointer;display:flex;gap:9px;align-items:flex-start}',
      '#dp-tower ul.tr li:hover,#dp-tower ul.tr li.sel{background:rgba(201,168,76,.14)}',
      '#dp-tower .art{flex:0 0 auto;min-width:52px;text-align:center;font:600 9.5px/1.7 "JetBrains Mono",monospace;padding:0 5px;border-radius:5px;background:#2a251d;color:' + GH + ';text-transform:uppercase;letter-spacing:.05em}',
      '#dp-tower .art.aktion{background:#1f2a22;color:#8fd3a9}#dp-tower .art.ablauf{background:#2a2230;color:#d6b8e8}',
      '#dp-tower .tx b{display:block;font-weight:600;font-size:13px;color:#f3ead0}#dp-tower .tx span{font-size:12px;color:#b9ad8f}',
      '#dp-tower .leer{color:#9a917e;font-size:12.5px;padding:8px 2px}',
      '#dp-tower .antw{margin-top:10px;padding:11px 12px;border-radius:11px;background:#0b0a09;border:1px solid #2c2720;color:#ece5d6}',
      '#dp-tower .antw .q{font:500 10.5px "JetBrains Mono",monospace;color:#9a917e;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}',
      '#dp-tower .knoepfe{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}',
      '#dp-tower .knoepfe button,#dp-tower .fuss button{border:1px solid ' + G + ';background:transparent;color:' + GH + ';border-radius:8px;padding:6px 10px;font:600 12px Inter,sans-serif;cursor:pointer}',
      '#dp-tower .frag{margin-top:10px;width:100%;padding:10px;border:0;border-radius:10px;background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');color:#1a1407;font:600 13px "Space Grotesk",sans-serif;cursor:pointer}',
      '#dp-tower .frag:disabled{opacity:.6;cursor:wait}',
      '#dp-tower .fuss{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:10px 14px;border-top:1px solid #2a251d}',
      '#dp-tower .fuss .h{flex:1;font-size:11px;color:#8f8672;min-width:140px}',
      '#dp-tower .punkte span{display:inline-block;width:6px;height:6px;border-radius:50%;background:' + G + ';margin-right:4px;animation:dpt-p 1s infinite}',
      '#dp-tower .punkte span:nth-child(2){animation-delay:.15s}#dp-tower .punkte span:nth-child(3){animation-delay:.3s}',
      '@keyframes dpt-p{0%,100%{opacity:.25}50%{opacity:1}}',
      '@media (max-width:640px){#dp-tower{left:8px !important;right:8px;width:auto;top:auto !important;bottom:8px;max-height:72vh}#dp-pilot.ruht{bottom:72px}}',
      '@media (prefers-reduced-motion:reduce){#dp-pilot .koerper,#dp-pilot .schal,#dp-pilot .auge{animation:none}#dp-pilot{transition:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ── Das Pilot-Männchen ───────────────────────────────────────────── */
  var SVG = '<svg viewBox="0 0 80 100" aria-hidden="true"><g class="koerper">'
    /* Schal, weht nach hinten */
    + '<path class="schal goldh" d="M30 57 C18 55 10 60 2 56 C8 63 18 63 29 62 Z"/>'
    /* Beine + Stiefel */
    + '<rect class="jacke" x="29" y="80" width="8" height="12" rx="3"/><rect class="jacke" x="43" y="80" width="8" height="12" rx="3"/>'
    + '<rect class="kappe2" x="27" y="89" width="12" height="6" rx="3"/><rect class="kappe2" x="41" y="89" width="12" height="6" rx="3"/>'
    /* Jacke */
    + '<path class="jacke" d="M24 64 Q40 54 56 64 L58 84 Q40 90 22 84 Z"/>'
    + '<path class="gurt" d="M27 66 L40 82 L53 66"/><rect class="gold" x="39" y="64" width="2.4" height="20" rx="1"/>'
    + '<circle class="goldh" cx="47" cy="72" r="2.4"/>'
    /* linker Arm */
    + '<path class="jacke" d="M25 65 Q17 72 20 80 L25 79 Q24 73 29 69 Z"/><circle class="haut" cx="22" cy="80" r="3.4"/>'
    /* rechter Arm (winkt / zeigt) */
    + '<g class="arm-r"><path class="jacke" d="M53 64 Q63 70 61 79 L56 78 Q57 72 51 69 Z"/><circle class="haut" cx="59" cy="79" r="3.4"/></g>'
    /* Schal-Knoten */
    + '<path class="gold" d="M30 57 Q40 62 50 57 L50 61 Q40 66 30 61 Z"/>'
    /* Kopf */
    + '<circle class="haut" cx="40" cy="38" r="19"/>'
    + '<circle class="wange" cx="29" cy="44" r="3"/><circle class="wange" cx="51" cy="44" r="3"/>'
    + '<ellipse class="auge tinte" cx="33.5" cy="39" rx="2.3" ry="2.8"/><ellipse class="auge tinte" cx="46.5" cy="39" rx="2.3" ry="2.8"/>'
    + '<path class="mund" d="M34 47 Q40 52 46 47"/>'
    /* Fliegerkappe mit Ohrklappen */
    + '<path class="kappe" d="M20 37 Q19 16 40 15 Q61 16 60 37 Q56 27 40 26 Q24 27 20 37 Z"/>'
    + '<path class="kappe" d="M20 34 Q16 44 21 51 L26 49 Q23 42 24 35 Z"/><path class="kappe" d="M60 34 Q64 44 59 51 L54 49 Q57 42 56 35 Z"/>'
    + '<path class="kappe2" d="M40 15 L40 26" stroke="#2a1d12" stroke-width="1.4"/>'
    /* Fliegerbrille */
    + '<g class="brille"><rect class="kappe2" x="22" y="24" width="36" height="3.2" rx="1.6"/>'
    + '<circle class="gold" cx="32" cy="25.5" r="6.2"/><circle class="glas" cx="32" cy="25.5" r="4.4"/>'
    + '<circle class="gold" cx="48" cy="25.5" r="6.2"/><circle class="glas" cx="48" cy="25.5" r="4.4"/>'
    + '<circle cx="30.4" cy="24" r="1.3" fill="#fff" opacity=".8"/><circle cx="46.4" cy="24" r="1.3" fill="#fff" opacity=".8"/></g>'
    + '</g></svg>';

  /* ── Wissen: vier Quellen, eine Liste ─────────────────────────────── */
  var AKTIONEN = [
    { t: 'Quick-Check starten', b: 'Ein Objekt in einer Minute einordnen: Adresse, Preis, Miete — Ampel, Score und Verhandlungs-Empfehlung.', ziel: { aktion: 'quickcheck' }, w: 'schnell pruefen inserat bewerten' },
    { t: 'Neues Objekt anlegen', b: 'Startet die Datenaufnahme für ein neues Objekt.', ziel: { aktion: 'new' }, w: 'anlegen hinzufuegen objekt neu' },
    { t: 'Marktbericht abrufen', b: 'Marktpreisindikation (Stufe 1/2) oder Wertermittlung nach ImmoWertV (Stufe 3) für das geöffnete Objekt.', ziel: { aktion: 'marktbericht' }, w: 'marktwert verkehrswert bewertung gutachten' },
    { t: 'Portfolio-Cockpit öffnen', b: 'Alle Objekte zusammen: Cashflow, Vermögen, Kennzahlen.', ziel: { aktion: 'cockpit' }, w: 'portfolio uebersicht bestand alle' },
    { t: 'Bankexport', b: 'Die Unterlagen für die Finanzierungsanfrage zusammenstellen.', ziel: { aktion: 'bankexport' }, w: 'bank finanzierung pdf kredit' },
    { t: 'Einstellungen', b: 'Investment-Profil, Standardwerte, Bewirtschaftung je Objektart, Score-Gewichte, Darstellung.', ziel: { aktion: 'settings' }, w: 'profil standardwerte einstellen' },
    { t: 'Prozess-Atlas öffnen', b: 'Alle Abläufe als Netzplan — vom Quick-Check bis zum Steuerjahr.', ziel: { atlas: '' }, w: 'ablauf prozess netzplan schritt' },
    { t: 'App-Tour starten', b: 'Schritt für Schritt durch alle Reiter.', ziel: { fn: 'helpStartTour' }, w: 'tour einfuehrung rundgang' },
    { t: 'Ganze Hilfe öffnen', b: 'Kennzahlen, Finanzierung, Steuer, Glossar, Häufige Fragen.', ziel: { fn: 'showHelp' }, w: 'hilfe handbuch glossar faq' }
  ];
  var _index = null;
  function index() {
    if (_index) return _index;
    var L = [];
    AKTIONEN.forEach(function (a) { L.push({ art: 'aktion', t: a.t, b: a.b, ziel: a.ziel, such: norm(a.t + ' ' + a.w) }); });
    try {
      var C = (window.DpTooltips && window.DpTooltips.content) || {};
      Object.keys(C).forEach(function (k) {
        var c = C[k]; if (!c || !c.title) return;
        var b = ohneTags(c.body);
        L.push({ art: 'feld', t: c.title, b: b, ziel: { tip: k }, such: norm(c.title + ' ' + b + ' ' + (c.paragraph || '')) });
      });
    } catch (e) {}
    try {
      var H = window.DealPilotHilfe && window.DealPilotHilfe.themen ? window.DealPilotHilfe.themen() : [];
      H.forEach(function (th) {
        (th.sections || []).forEach(function (s) {
          var b = ohneTags(String(s.body || '').replace(/\n/g, ' '));
          L.push({ art: th.id === 'glossar' ? 'glossar' : 'hilfe', t: s.h, b: b, thema: th.title, ziel: { hilfe: th.id, h: s.h }, such: norm(s.h + ' ' + th.title + ' ' + b) });
        });
      });
    } catch (e) {}
    try {
      var A = window.DealPilotAtlas && window.DealPilotAtlas.stationen ? window.DealPilotAtlas.stationen() : [];
      A.forEach(function (s) {
        var b = s.d + (s.unter && s.unter.length ? ' Schritte: ' + s.unter.map(function (u) { return u[0]; }).join(' · ') : '');
        L.push({ art: 'ablauf', t: s.t, b: b, thema: s.prozess, ziel: { atlas: s.pid, station: s.id }, nav: s.ziel, such: norm(s.t + ' ' + s.k + ' ' + s.prozess + ' ' + b + ' ' + (s.ein || []).join(' ') + ' ' + (s.aus || []).join(' ')) });
      });
    } catch (e) {}
    _index = L;
    return L;
  }
  function suche(q, n) {
    var L = index(), nq = norm(q);
    if (nq.length < 2) return [];
    var w = nq.split(' ').filter(function (x) { return x.length >= 2; });
    var res = [];
    L.forEach(function (e) {
      var tn = norm(e.t), p = 0, alle = true;
      w.forEach(function (x) {
        var stamm = x.length > 5 ? x.slice(0, x.length - 1) : x;
        if (tn.indexOf(stamm) >= 0) p += 6;
        else if (e.such.indexOf(stamm) >= 0) p += 2;
        else alle = false;
      });
      if (!p) return;
      if (alle) p += 4;
      if (tn === nq) p += 10;
      if (e.art === 'aktion') p += 1;
      res.push({ e: e, p: p });
    });
    res.sort(function (a, b) { return b.p - a.p; });
    return res.slice(0, n || 7).map(function (r) { return r.e; });
  }

  /* ── Elemente ─────────────────────────────────────────────────────── */
  var pilot, tower, _letzt = null, _feld = null, _verlauf = [], _treffer = [], _sel = -1;
  function bauen() {
    if (pilot) return;
    css();
    pilot = document.createElement('div'); pilot.id = 'dp-pilot'; pilot.className = 'ruht';
    pilot.title = 'Pilot rufen — F1 oder ?'; pilot.setAttribute('role', 'button'); pilot.setAttribute('aria-label', 'Pilot rufen (F1)');
    pilot.innerHTML = SVG;
    pilot.addEventListener('click', function () { tower && tower.classList.contains('an') ? schliessen() : rufen(); });
    tower = document.createElement('div'); tower.id = 'dp-tower'; tower.setAttribute('role', 'dialog'); tower.setAttribute('aria-label', 'Tower');
    tower.innerHTML = '<div class="k"><span class="u">Tower · Pilot hört</span><kbd>Esc</kbd><button class="zu" type="button" aria-label="Schließen">×</button></div>'
      + '<div class="rumpf"><div class="feldbox"></div>'
      + '<input class="frage" type="text" autocomplete="off" placeholder="Was liegt an? — z. B. „Ankauf einfrieren“, „DSCR“, „Anlage V“">'
      + '<ul class="tr"></ul><div class="antwbox"></div>'
      + '<button class="frag" type="button">Den Piloten fragen (KI)</button></div>'
      + '<div class="fuss"><span class="h">Sofort-Antworten kommen aus Hilfe, Feld-Erklärungen und Abläufen. F1 oder ? ruft mich überall.</span>'
      + '<button type="button" data-f="atlas">Prozess-Atlas</button><button type="button" data-f="hilfe">Ganze Hilfe</button></div>';
    document.body.appendChild(tower);
    document.body.appendChild(pilot);
    tower.querySelector('.zu').addEventListener('click', schliessen);
    var inp = tower.querySelector('.frage');
    inp.addEventListener('input', function () { zeigeTreffer(inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); waehle(_sel + (e.key === 'ArrowDown' ? 1 : -1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (_sel >= 0 && _treffer[_sel]) antworte(_treffer[_sel]); else fragen(); }
    });
    tower.querySelector('ul.tr').addEventListener('click', function (e) {
      var li = e.target.closest('li[data-i]'); if (li) antworte(_treffer[+li.getAttribute('data-i')]);
    });
    tower.querySelector('.frag').addEventListener('click', fragen);
    tower.querySelector('.fuss').addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]'); if (!b) return;
      if (b.getAttribute('data-f') === 'atlas') fliegeNach({ atlas: '' }); else fliegeNach({ fn: 'showHelp' });
    });
    tower.querySelector('.antwbox').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ziel]'); if (!b) return;
      try { fliegeNach(JSON.parse(b.getAttribute('data-ziel'))); } catch (x) {}
    });
  }

  /* ── Feld unter Maus / Cursor ─────────────────────────────────────── */
  function feldVon(el) {
    if (!el || !el.closest) return null;
    if (tower && tower.contains(el)) return null;
    var f = el.closest('.f');
    if (f && window.DealPilotFeldHilfe && typeof window.DealPilotFeldHilfe.textFuer === 'function') {
      var d = null; try { d = window.DealPilotFeldHilfe.textFuer(f); } catch (e) {}
      if (d && (d.titel || d.body)) return { el: f, titel: d.titel, body: d.body, zusatz: d.zusatz, wofuer: d.wofuer || [], gepflegt: d.gepflegt };
    }
    var tip = el.closest('[data-tip-id]') || (el.querySelector && el.querySelector(':scope > .dp-tip[data-tip-id]'));
    var C = window.DpTooltips && window.DpTooltips.content;
    if (tip && C && C[tip.getAttribute('data-tip-id')]) {
      var c = C[tip.getAttribute('data-tip-id')];
      return { el: tip.closest('.f, .card, .kpi, div') || tip, titel: c.title, body: ohneTags(c.body), wofuer: [] };
    }
    var t = el.closest('[title], [aria-label]');
    if (t && t !== document.body && !t.closest('#dp-pilot')) {
      var tx = t.getAttribute('title') || t.getAttribute('aria-label');
      if (tx && tx.length > 3) return { el: t, titel: kurz(tx, 60), body: tx.length > 60 ? tx : '', wofuer: [] };
    }
    return null;
  }

  /* ── Fliegen ──────────────────────────────────────────────────────── */
  function spur(x0, y0, x1, y1) {
    for (var i = 1; i <= 7; i++) {
      (function (i) {
        setTimeout(function () {
          var d = document.createElement('div'); d.className = 'dp-pilot-spur';
          var f = i / 8; d.style.left = (x0 + (x1 - x0) * f + 28) + 'px'; d.style.top = (y0 + (y1 - y0) * f - Math.sin(f * Math.PI) * 40 + 40) + 'px';
          document.body.appendChild(d); setTimeout(function () { d.remove(); }, 850);
        }, i * 70);
      })(i);
    }
  }
  function setzePilot(x, y) {
    var r = pilot.getBoundingClientRect();
    pilot.style.bottom = 'auto';
    if (!pilot.style.top) { pilot.style.top = r.top + 'px'; pilot.style.left = r.left + 'px'; void pilot.offsetWidth; }
    spur(r.left, r.top, x, y);
    pilot.classList.remove('fliegt'); void pilot.offsetWidth; pilot.classList.add('fliegt');
    pilot.style.left = Math.max(6, Math.min(innerWidth - 70, x)) + 'px';
    pilot.style.top = Math.max(6, Math.min(innerHeight - 84, y)) + 'px';
  }
  function heim() {
    if (!pilot) return;
    pilot.classList.add('ruht'); pilot.classList.remove('zeigt', 'denkt');
    var r = pilot.getBoundingClientRect();
    spur(r.left, r.top, 14, innerHeight - 70);
    pilot.style.left = '14px'; pilot.style.top = (innerHeight - (innerWidth <= 640 ? 128 : 70)) + 'px';
    setTimeout(function () { if (pilot.classList.contains('ruht')) { pilot.style.top = ''; pilot.style.bottom = ''; pilot.style.left = ''; } }, 800);
  }
  function platziere(zielEl) {
    var mobil = innerWidth <= 640;
    var r = zielEl ? zielEl.getBoundingClientRect() : null;
    var px, py;
    if (r && r.width && r.bottom > 0 && r.top < innerHeight) { px = r.right + 6; py = r.top - 62; if (px > innerWidth - 80) px = r.left - 70; }
    else { px = innerWidth - 470; py = 90; }
    if (mobil) { px = innerWidth - 74; py = Math.max(8, innerHeight * 0.28 - 84); }
    setzePilot(px, py);
    if (mobil) return;
    var tw = Math.min(440, innerWidth - 24), th = Math.min(innerHeight * 0.78, 640);
    var tx = r ? (r.right + 74 + tw < innerWidth ? r.right + 74 : Math.max(12, r.left - tw - 10)) : innerWidth - tw - 24;
    if (r && tx < 12) tx = Math.max(12, Math.min(innerWidth - tw - 12, r.left));
    var ty = r ? Math.max(12, Math.min(innerHeight - th - 12, r.top - 20)) : 80;
    if (r && tx === Math.max(12, Math.min(innerWidth - tw - 12, r.left))) ty = Math.min(innerHeight - th - 12, r.bottom + 12);
    tower.style.left = tx + 'px'; tower.style.top = Math.max(12, ty) + 'px';
  }

  /* ── Öffnen / Schließen ───────────────────────────────────────────── */
  function rufen(von) {
    bauen();
    document.querySelectorAll('.dp-pilot-spot').forEach(function (x) { x.classList.remove('dp-pilot-spot'); });
    var ae = document.activeElement;
    var f = null;
    if (von && von.titel) {
      f = { el: null, titel: von.titel, body: '', wofuer: [], quelle: von.quelle };
      var C = window.DpTooltips && window.DpTooltips.content, nt = norm(von.titel);
      if (C) Object.keys(C).some(function (k) { if (C[k] && norm(C[k].title) === nt) { f.body = ohneTags(C[k].body); return true; } return false; });
    } else {
      f = (ae && ae !== document.body && feldVon(ae)) || feldVon(_letzt);
    }
    _feld = f;
    var box = tower.querySelector('.feldbox');
    if (f) {
      var w = (f.wofuer || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
      box.innerHTML = '<div class="feld"><div class="t">' + esc(f.titel) + (f.zusatz ? '<small>' + esc(f.zusatz) + '</small>' : '') + (f.quelle ? '<small>' + esc(f.quelle) + '</small>' : '') + '</div>'
        + (f.body ? '<p>' + esc(f.body) + '</p>' : '<p style="color:#b9ad8f">Zu diesem Feld gibt es noch keinen gepflegten Text — frag mich unten, ich schaue in Hilfe und Abläufen nach.</p>')
        + (w ? '<ul>' + w + '</ul>' : '') + '</div>';
      if (f.el) f.el.classList.add('dp-pilot-spot');
    } else box.innerHTML = '';
    pilot.classList.remove('ruht');
    tower.classList.add('an');
    tower.querySelector('.antwbox').innerHTML = '';
    var inp = tower.querySelector('.frage'); inp.value = '';
    zeigeTreffer('');
    platziere(f && f.el);
    pilot.classList.remove('winkt'); void pilot.offsetWidth; pilot.classList.add('winkt');
    setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }, 80);
  }
  function schliessen() {
    if (!tower) return;
    tower.classList.remove('an');
    document.querySelectorAll('.dp-pilot-spot').forEach(function (x) { x.classList.remove('dp-pilot-spot'); });
    heim();
  }

  /* ── Treffer und Antworten ────────────────────────────────────────── */
  var ART = { aktion: 'Aktion', feld: 'Feld', hilfe: 'Hilfe', glossar: 'Glossar', ablauf: 'Ablauf' };
  function zeigeTreffer(q) {
    var ul = tower.querySelector('ul.tr');
    if (norm(q).length < 2) {
      _treffer = [];
      if (_feld) {
        _treffer = suche(_feld.titel, 4).filter(function (e) { return e.art !== 'feld' || norm(e.t) !== norm(_feld.titel); });
      }
      if (!_treffer.length) _treffer = index().filter(function (e) { return e.art === 'aktion'; }).slice(0, 5);
    } else _treffer = suche(q, 8);
    _sel = -1;
    ul.innerHTML = _treffer.map(function (e, i) {
      return '<li data-i="' + i + '"><span class="art ' + e.art + '">' + ART[e.art] + '</span><span class="tx"><b>' + esc(e.t) + '</b><span>' + esc(kurz(e.b, 110)) + '</span></span></li>';
    }).join('') || '<li class="leer" style="cursor:default">Nichts Passendes in Hilfe, Feldern und Abläufen — frag den Piloten (KI) unten.</li>';
  }
  function waehle(i) {
    var lis = tower.querySelectorAll('ul.tr li[data-i]'); if (!lis.length) return;
    _sel = (i + lis.length) % lis.length;
    lis.forEach(function (li, j) { li.classList.toggle('sel', j === _sel); });
    lis[_sel].scrollIntoView({ block: 'nearest' });
  }
  function knopf(text, ziel) { return '<button type="button" data-ziel="' + esc(JSON.stringify(ziel)) + '">' + esc(text) + '</button>'; }
  function antworte(e) {
    if (!e) return;
    var k = '';
    if (e.art === 'aktion') { fliegeNach(e.ziel); return; }
    if (e.art === 'feld') k += knopf('Zeig mir das Feld →', e.ziel);
    if (e.art === 'hilfe' || e.art === 'glossar') k += knopf('In der Hilfe öffnen →', e.ziel);
    if (e.art === 'ablauf') { k += knopf('Im Prozess-Atlas zeigen →', e.ziel); if (e.nav) k += knopf('Hinfliegen →', e.nav); }
    tower.querySelector('.antwbox').innerHTML = '<div class="antw"><div class="q">' + esc(ART[e.art] + (e.thema ? ' · ' + e.thema : '')) + '</div><b>' + esc(e.t) + '</b><div>' + esc(e.b) + '</div>'
      + (k ? '<div class="knoepfe">' + k + '</div>' : '') + '</div>';
  }

  function kiText(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }
  function kontext() {
    try { if (typeof window._buildAIPayload === 'function') { var p = window._buildAIPayload(); if (p && typeof p === 'object') { var c = Object.assign({}, p); delete c.userApiKey; delete c.apiKey; delete c.openai_api_key; return c; } } } catch (e) {}
    return {};
  }
  function fragen() {
    var inp = tower.querySelector('.frage'), btn = tower.querySelector('.frag');
    var q = inp.value.trim();
    if (!q && _feld) q = 'Erklär mir das Feld „' + _feld.titel + '“ und worauf ich achten muss.';
    if (!q) { inp.focus(); return; }
    var box = tower.querySelector('.antwbox');
    var auszug = suche(q, 6).map(function (e) { return { art: ART[e.art], titel: e.t, text: kurz(e.b, 900) }; });
    if (_feld) auszug.unshift({ art: 'Feld unter dem Cursor', titel: _feld.titel, text: kurz((_feld.body || '') + ' ' + (_feld.wofuer || []).join('; '), 900) });
    if (!(window.Auth && Auth.apiCall && (!Auth.isApiMode || Auth.isApiMode()))) {
      box.innerHTML = '<div class="antw">Die KI-Antwort braucht eine Anmeldung. Die Treffer oben kommen ohne KI.</div>'; return;
    }
    btn.disabled = true; pilot.classList.add('denkt');
    box.innerHTML = '<div class="antw"><div class="q">Pilot denkt nach</div><span class="punkte"><span></span><span></span><span></span></span></div>';
    Auth.apiCall('/ai/copilot', { method: 'POST', body: { message: q, context: kontext(), history: _verlauf.slice(-8), hilfe: auszug, quelle: 'tower' } })
      .then(function (d) {
        var a = (d && (d.reply || d.answer || d.text)) || '';
        if (!a) throw new Error('leere Antwort');
        _verlauf.push({ role: 'user', content: q }, { role: 'assistant', content: a });
        var k = auszug.length ? suche(q, 2).filter(function (e) { return e.art !== 'aktion'; }).map(function (e) {
          return knopf(e.art === 'ablauf' ? 'Ablauf: ' + kurz(e.t, 28) : kurz(e.t, 32) + ' →', e.ziel);
        }).join('') : '';
        box.innerHTML = '<div class="antw"><div class="q">Pilot · ' + esc(kurz(q, 60)) + '</div><div>' + kiText(a) + '</div>' + (k ? '<div class="knoepfe">' + k + '</div>' : '') + '</div>';
      })
      .catch(function (e) {
        var m = e && e.status === 429 ? 'Das Tageslimit für KI-Fragen ist erreicht — morgen geht es weiter. Die Sofort-Antworten oben funktionieren weiter.'
          : 'Die KI konnte gerade nicht antworten (' + esc((e && e.message) || 'Fehler') + '). Die Sofort-Antworten oben funktionieren ohne KI.';
        box.innerHTML = '<div class="antw">' + m + '</div>';
      })
      .then(function () { btn.disabled = false; pilot.classList.remove('denkt'); });
  }

  /* ── Hinfliegen: Reiter, Aktion, Feld, Hilfe, Atlas ───────────────── */
  function reiterFuer(el) {
    var tabs = document.querySelectorAll('.tab[data-target-sec]');
    for (var i = 0; i < tabs.length; i++) {
      var sec = document.getElementById(tabs[i].getAttribute('data-target-sec'));
      if (sec && sec.contains(el)) return tabs[i];
    }
    return null;
  }
  function zeigeAuf(el) {
    if (!el) return;
    var tab = reiterFuer(el);
    if (tab && !tab.classList.contains('active')) tab.click();
    setTimeout(function () {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
      setTimeout(function () {
        document.querySelectorAll('.dp-pilot-spot').forEach(function (x) { x.classList.remove('dp-pilot-spot'); });
        el.classList.add('dp-pilot-spot');
        var r = el.getBoundingClientRect();
        pilot.classList.remove('ruht'); pilot.classList.add('zeigt');
        setzePilot(r.right + 4, r.top - 60);
        setTimeout(function () { el.classList.remove('dp-pilot-spot'); if (!tower.classList.contains('an')) heim(); }, 3800);
      }, 450);
    }, tab ? 260 : 0);
  }
  function fliegeNach(z) {
    if (!z) return;
    tower.classList.remove('an');
    if (z.atlas != null) {
      heim();
      if (window.DealPilotAtlas && DealPilotAtlas.oeffne) DealPilotAtlas.oeffne(z.atlas || null, z.station || null);
      return;
    }
    if (z.hilfe) { heim(); if (window.DealPilotHilfe && DealPilotHilfe.oeffne) DealPilotHilfe.oeffne(z.hilfe, z.h); else if (window.showHelp) showHelp(); return; }
    if (z.aktion) { heim(); if (typeof window.sbActionsAction === 'function') window.sbActionsAction(z.aktion); return; }
    if (z.fn) { heim(); if (typeof window[z.fn] === 'function') window[z.fn](); return; }
    if (z.tab) {
      var t = document.querySelector('.tab[data-target-sec="' + z.tab + '"]');
      if (t) { t.click(); setTimeout(function () { var s = document.getElementById(z.tab); if (s) zeigeAuf(s.querySelector('.card') || s); }, 300); } else heim();
      return;
    }
    var el = null;
    if (z.tip) { var b = document.querySelector('.dp-tip[data-tip-id="' + z.tip + '"]'); el = b && (b.closest('.f') || b.closest('.card') || b); }
    if (z.feld) { var x = document.getElementById(z.feld); el = x && (x.closest('.f') || x); }
    if (el) zeigeAuf(el);
    else {
      heim();
      if (window.showToast) try { showToast('Dieses Feld ist im geöffneten Objekt gerade nicht zu sehen.'); } catch (e) {}
    }
  }

  /* ── Tasten ───────────────────────────────────────────────────────── */
  document.addEventListener('mouseover', function (e) { if (!tower || !tower.contains(e.target)) _letzt = e.target; }, true);
  document.addEventListener('keydown', function (e) {
    var ae = document.activeElement;
    var imTower = tower && tower.contains(ae);
    if (e.key === 'F1' || (e.key === '?' && !tippt(ae) && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault();
      if (tower && tower.classList.contains('an') && imTower) { schliessen(); return; }
      rufen();
    } else if (e.key === 'Escape' && tower && tower.classList.contains('an')) {
      e.stopPropagation(); schliessen();
    }
  }, true);
  document.addEventListener('mousedown', function (e) {
    if (tower && tower.classList.contains('an') && !tower.contains(e.target) && !pilot.contains(e.target)) schliessen();
  }, true);

  function start() { bauen(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.DealPilotPilot = { rufen: rufen, schliessen: schliessen, suche: suche, fliegeNach: fliegeNach, neuIndex: function () { _index = null; } };
})();
