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
      '#dp-pilot{position:fixed;left:14px;top:auto;bottom:14px;width:54px;height:86px;z-index:10060;cursor:pointer;transition:left .9s cubic-bezier(.45,0,.3,1),top .9s cubic-bezier(.45,0,.3,1),width .3s,height .3s;filter:drop-shadow(0 8px 10px rgba(0,0,0,.35))}',
      '#dp-pilot .pf-wrap{display:block;width:100%;height:100%}#dp-pilot svg.pf{width:100%;height:100%;display:block}',
      '#dp-pilot.ruht{width:46px;height:73px}',
      '#dp-pilot.aus.ruht{display:none}',
      '#dp-pilot.buste{width:38px;height:38px;border-radius:50%;overflow:hidden;background:#141210;border:2px solid ' + G + ';filter:none;box-shadow:0 4px 12px rgba(0,0,0,.35)}',
      '#dp-pilot.buste .pf-wrap{width:64px;height:103px;margin:-2px 0 0 -12px}',
      '#dp-pilot.buste .schatten{display:none}',
      '#dp-pilot.ruht:hover{transform:translateY(-2px)}',
      '#dp-pilot.ruht:not(.buste)::after{content:"F1";position:absolute;right:-10px;top:0;font:700 9px "JetBrains Mono",monospace;color:#1a1407;background:' + GH + ';border-radius:5px;padding:1px 4px;opacity:0;transition:opacity .2s}',
      '#dp-pilot.ruht:hover::after{opacity:1}',
      '.dp-pilot-spur{position:fixed;width:7px;height:7px;border-radius:50%;background:' + GH + ';z-index:10059;pointer-events:none;animation:dpp-spur .8s ease-out forwards}',
      '@keyframes dpp-spur{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(.2)}}',
      '.dp-pilot-spot{box-shadow:0 0 0 3px ' + G + ',0 0 0 10px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 22%, transparent) !important;border-radius:10px;transition:box-shadow .3s}',
      '#dp-tower{position:fixed;z-index:10058;width:min(440px,calc(100vw - 24px));max-height:min(78vh,640px);display:none;flex-direction:column;background:#141210;color:#f3ead0;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent);border-radius:16px;box-shadow:0 30px 80px -20px rgba(0,0,0,.65);font:400 13.5px/1.5 Inter,system-ui,sans-serif}',
      '#dp-tower.an{display:flex;animation:dpt-auf .28s cubic-bezier(.2,1.2,.4,1)}',
      '@keyframes dpt-auf{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}',
      '#dp-tower .k{display:flex;align-items:center;gap:8px;padding:12px 14px 8px}',
      '#dp-tower .k .u{flex:1;font:500 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:' + GH + '}',
      '#dp-tower kbd{font:600 11px "JetBrains Mono",monospace;background:#26211b;color:#e8dcc0;border:1px solid #3a3227;border-radius:5px;padding:1px 6px}',
      '#dp-tower .zu{background:none;border:0;color:#b9ad8f;font-size:20px;line-height:1;cursor:pointer;padding:0 4px}',
      '#dp-tower .rumpf{overflow:auto;padding:0 14px 12px}',
      '#dp-tower .feld{margin:2px 0 10px;padding:11px 12px;border-radius:11px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 10%, transparent);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent)}',
      '#dp-tower .feld .t{font:600 14px "Space Grotesk",sans-serif;color:' + GH + '}',
      '#dp-tower .feld .t small{font:500 10.5px "JetBrains Mono",monospace;color:#b9ad8f;margin-left:6px}',
      '#dp-tower .feld p{margin:5px 0 0;color:#e4dccb}',
      '#dp-tower .feld ul{margin:6px 0 0;padding-left:17px;color:#cdbf9f;font-size:12.5px}',
      '#dp-tower input.frage{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);background:#0b0a09;color:#f3ead0;font:500 14px Inter,sans-serif}',
      '#dp-tower input.frage:focus{outline:2px solid ' + G + ';outline-offset:0}',
      '#dp-tower ul.tr{list-style:none;margin:8px 0 0;padding:0}',
      '#dp-tower ul.tr li{padding:8px 9px;border-radius:9px;cursor:pointer;display:flex;gap:9px;align-items:flex-start}',
      '#dp-tower ul.tr li:hover,#dp-tower ul.tr li.sel{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 14%, transparent)}',
      '#dp-tower .art{flex:0 0 auto;min-width:52px;text-align:center;font:600 9.5px/1.7 "JetBrains Mono",monospace;padding:0 5px;border-radius:5px;background:#2a251d;color:' + GH + ';text-transform:uppercase;letter-spacing:.05em}',
      '#dp-tower .art.aktion{background:#1f2a22;color:#8fd3a9}#dp-tower .art.ablauf{background:#2a2230;color:#d6b8e8}',
      '#dp-tower .tx b{display:block;font-weight:600;font-size:13px;color:#f3ead0}#dp-tower .tx span{font-size:12px;color:#b9ad8f}',
      '#dp-tower .leer{color:#9a917e;font-size:12.5px;padding:8px 2px}',
      '#dp-tower .antw{margin-top:10px;padding:11px 12px;border-radius:11px;background:#0b0a09;border:1px solid #2c2720;color:#ece5d6}',
      '#dp-tower .antwbox .antw{margin:10px 0 2px}#dp-tower .antw.sofort{border-color:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent)}',
      '#dp-tower .antw .enter{float:right;text-transform:none;letter-spacing:0;color:#7f7663}',
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
      '@media (max-width:640px){#dp-tower{left:8px !important;right:8px;width:auto;top:auto !important;bottom:8px;max-height:min(74vh,calc(100vh - 110px))}#dp-tower input.frage{font-size:16px !important}#dp-tower .fuss .h{display:none}}',
      '#dp-tower ul.tr li{text-align:left}#dp-tower .tx{flex:1 1 auto;min-width:0}',
      '@media (prefers-reduced-motion:reduce){#dp-pilot{transition:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ── Das Pilot-Männchen: pilot-figur.js (DealPilotFigur) ───────────── */

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
  var FUELL = ' ich du er sie es wir ihr man der die das den dem des ein eine einen einem einer und oder aber wie was wo wann warum wer ist sind bin war wird werden kann koennen muss soll mit von zu zum zur im in an am auf fuer bei aus ob wenn dann dass nicht kein keine mir mich mein meine dein deine hier da so auch noch schon nur mal bitte gibt habe hat haben ';
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
    /* Fuellwoerter tragen nichts: gemessen zog „was“ EK-Rendite und
       Zinsrisiko vor die richtigen Treffer. */
    var w = nq.split(' ').filter(function (x) { return x.length >= 2 && FUELL.indexOf(' ' + x + ' ') < 0; });
    if (!w.length) return [];
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
    pilot.innerHTML = '<span class="pf-wrap">' + (window.DealPilotFigur ? DealPilotFigur.svg({}) : '') + '</span>';
    if (window.DealPilotFigur) DealPilotFigur.css();
    pilot.addEventListener('click', function () { tower && tower.classList.contains('an') ? schliessen() : rufen(); });
    tower = document.createElement('div'); tower.id = 'dp-tower'; tower.setAttribute('role', 'dialog'); tower.setAttribute('aria-label', 'Tower');
    tower.innerHTML = '<div class="k"><span class="u">Tower · Pilot hört</span><kbd>Esc</kbd><button class="zu" type="button" aria-label="Schließen">×</button></div>'
      + '<div class="rumpf"><div class="feldbox"></div>'
      + '<input class="frage" type="text" autocomplete="off" placeholder="Was liegt an? — z. B. „Ankauf einfrieren“, „DSCR“, „Anlage V“">'
      + '<div class="antwbox"></div><ul class="tr"></ul>'
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
  /* ── Ort: wo der Pilot ruht (Einstellungen → Hilfe & Pilot) ─────────
     Marcel, 13.10.2026: „mach es doch so, dass ich das einstellen kann …
     Standard so wie du denkst." Standard ist die Seitenleiste: gemessen
     liegen dort zwischen den Reitern (bis y 491) und dem Nutzerfeld (ab
     y 832) gut 330 px freier, dunkler Grund. Fehlt der Platz (Leiste
     eingeklappt, Handy), fällt er auf den nächsten Ort zurück. */
  var ORTE = [
    { id: 'seite', t: 'Seitenleiste', d: 'steht im freien Platz über deinem Nutzerfeld' },
    { id: 'kopf', t: 'Kopfleiste', d: 'nur Kopf und Mütze neben dem Hilfe-Symbol' },
    { id: 'haupt', t: 'Hauptbereich', d: 'unten am linken Rand des Inhalts' },
    { id: 'aus', t: 'Nur auf F1', d: 'unsichtbar, bis du ihn rufst' }
  ];
  function ort() {
    try { var o = localStorage.getItem('dp_pilot_ort'); if (ORTE.some(function (x) { return x.id === o; })) return o; } catch (e) {}
    return 'seite';
  }
  function setOrt(o) {
    try { localStorage.setItem('dp_pilot_ort', o); } catch (e) {}
    if (pilot) { pilot.classList.toggle('aus', o === 'aus'); pilot.classList.add('ruht'); heimSetzen(false); }
    document.querySelectorAll('[data-pilot-ort]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-pilot-ort') === o); });
  }
  /* Abschnitt für Einstellungen → Allgemein, unter „Tooltip-Hilfe“. Gleiche
     Knopfform wie dort (.dp-tt-mode-toggle), damit er nicht fremd aussieht. */
  function einstellungenHtml() {
    var a = ort();
    return '<hr class="dvd"><h3 class="set-section-h">Pilot · Hilfe auf F1</h3>'
      + '<p class="hint" style="margin-bottom:10px">Drück F1 oder ? — der Pilot erklärt das Feld, auf dem du gerade bist, und beantwortet Fragen. Hier stellst du ein, wo er wartet.</p>'
      + '<div class="dp-tt-mode-toggle">' + ORTE.map(function (o) {
        return '<button type="button" class="dp-tt-mode-btn' + (o.id === a ? ' active' : '') + '" data-pilot-ort="' + o.id + '" onclick="DealPilotPilot.setOrt(\'' + o.id + '\')">'
          + esc(o.t) + (o.id === 'seite' ? ' · Standard' : '') + '<span class="dp-tt-mode-btn-label">' + esc(o.d) + '</span></button>';
      }).join('') + '</div>'
      + '<p class="hint" style="margin-top:8px;color:var(--muted)">Auf dem Handy sitzt er immer als runder Knopf unten links. Die Wahl gilt für dieses Gerät.</p>';
  }
  function figur(k, an) { if (window.DealPilotFigur && pilot) DealPilotFigur.zustand(pilot, k, an); }
  function zeigeArm(rect) { var w = pilot && pilot.querySelector('.pf-wrap'); if (w && window.DealPilotFigur) DealPilotFigur.zeigeAuf(w, rect); }

  function ruhePlatz() {
    var o = ort();
    if (innerWidth <= 640) return { x: 12, y: innerHeight - 38 - 16, buste: true };
    if (o === 'kopf') {
      var h = document.querySelector('.hdr-icon-btn[title="Hilfe"]'), hr = h && h.getBoundingClientRect();
      if (hr && hr.width) return { x: hr.left - 46, y: hr.top + (hr.height - 38) / 2, buste: true };
    }
    if (o === 'seite') {
      var n = document.querySelector('.dpl-teil-nutzer'), sch = n && n.closest('.dpl-schiene');
      var nr = n && n.getBoundingClientRect();
      if (sch && nr && nr.width > 120) {
        var unten = 0;
        [].forEach.call(sch.children, function (c) {
          if (c === n) return;
          var r = c.getBoundingClientRect();
          if (r.height >= 12 && r.bottom <= nr.top + 1) unten = Math.max(unten, r.bottom);
        });
        if (nr.top - unten >= 100) { var sr = sch.getBoundingClientRect(); return { x: sr.left + sr.width / 2 - 23, y: nr.top - 73 - 10, buste: false }; }
      }
    }
    var mc = document.querySelector('.main-col'), m = mc && mc.getBoundingClientRect();
    return { x: (m && m.width > 300) ? m.left + 10 : 14, y: innerHeight - 73 - 12, buste: false };
  }
  function heimSetzen(sofort) {
    if (!pilot || !pilot.classList.contains('ruht')) return;
    /* Handy: liegt ein Fenster über seinem Platz (Hilfe, Einstellungen,
       Atlas), tritt er zurück - gemessen lag er in den Einstellungen auf
       390 px über der Zeile „Auto-Save" neben „Abbrechen". */
    if (innerWidth <= 640) {
      var pr = pilot.getBoundingClientRect(), unter = null;
      try { unter = document.elementsFromPoint(pr.left + pr.width / 2, pr.top + pr.height / 2).filter(function (x) { return !pilot.contains(x); })[0]; } catch (e) {}
      var deck = unter && unter.closest && unter.closest('.global-view-overlay, .modal-backdrop, #dp-atlas, [role="dialog"]');
      pilot.style.visibility = deck ? 'hidden' : '';
    } else pilot.style.visibility = '';
    var p = ruhePlatz();
    var x = Math.round(p.x) + 'px', y = Math.round(p.y) + 'px';
    if (pilot.style.left === x && pilot.style.top === y && pilot.classList.contains('buste') === p.buste) return;
    if (sofort) pilot.style.transition = 'none';
    pilot.classList.toggle('buste', p.buste);
    pilot.style.bottom = 'auto'; pilot.style.left = x; pilot.style.top = y;
    if (sofort) { void pilot.offsetWidth; pilot.style.transition = ''; }
  }
  function heim() {
    if (!pilot) return;
    figur('zeigt', false); figur('erklaert', false); figur('winkt', false);
    var unterwegs = !pilot.classList.contains('ruht');
    pilot.classList.add('ruht');
    if (!unterwegs) { heimSetzen(true); return; }
    var p = ruhePlatz();
    laufeZu(p.x, p.y, function () { if (pilot.classList.contains('ruht')) pilot.classList.toggle('buste', p.buste); });
  }
  /* Er LÄUFT hin — über weite Strecken mit Spur. */
  var _lt = null;
  function laufeZu(x, y, fertig) {
    var r = pilot.getBoundingClientRect();
    pilot.classList.remove('buste');
    x = Math.round(Math.max(6, Math.min(innerWidth - 60, x)));
    y = Math.round(Math.max(6, Math.min(innerHeight - 92, y)));
    var dist = Math.hypot(x - r.left, y - r.top);
    var w = pilot.querySelector('.pf-wrap');
    if (dist > 4) {
      if (w) w.classList.toggle('links', x > r.left);
      figur('zeigt', false); figur('laeuft');
      if (dist > 280) spur(r.left, r.top, x, y);
    }
    pilot.style.bottom = 'auto'; pilot.style.left = x + 'px'; pilot.style.top = y + 'px';
    clearTimeout(_lt);
    _lt = setTimeout(function () { figur('laeuft', false); if (w) w.classList.remove('links'); if (fertig) fertig(); }, dist > 4 ? 920 : 0);
  }
  var setzePilot = laufeZu;
  function platziere(zielEl) {
    var mobil = innerWidth <= 640;
    var r = zielEl ? zielEl.getBoundingClientRect() : null;
    var sichtbar = !!(r && r.width && r.bottom > 0 && r.top < innerHeight);
    var px, py;
    /* Handy: er steht AUF der Oberkante des Bodenblatts, links - nicht auf dem Kopf der App. */
    if (mobil) { var tb = tower.getBoundingClientRect(); px = 18; py = Math.max(8, (tb.top || innerHeight * 0.3) - 82); }
    else if (sichtbar) { px = r.right + 8; py = r.top - 30; if (px > innerWidth - 70) px = r.left - 62; }
    else { px = innerWidth - 530; py = 80; }
    pilot.classList.remove('ruht');
    laufeZu(px, py, function () { if (sichtbar) zeigeArm(r); });
    if (mobil) return;
    var tw = Math.min(440, innerWidth - 24), th = Math.min(innerHeight * 0.78, 640);
    var tx = r ? (r.right + 70 + tw < innerWidth ? r.right + 70 : Math.max(12, r.left - tw - 10)) : innerWidth - tw - 24;
    var unter = false;
    if (r && tx < 12) { tx = Math.max(12, Math.min(innerWidth - tw - 12, r.left)); unter = true; }
    var ty = r ? Math.max(12, Math.min(innerHeight - th - 12, r.top - 20)) : 80;
    if (unter) ty = Math.min(innerHeight - th - 12, r.bottom + 12);
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
    figur('zeigt', false); figur('winkt', false); void pilot.offsetWidth; figur('winkt'); figur('erklaert', !!f);
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
    sofort(q);
    ul.innerHTML = _treffer.map(function (e, i) {
      return '<li data-i="' + i + '"><span class="art ' + e.art + '">' + ART[e.art] + '</span><span class="tx"><b>' + esc(e.t) + '</b><span>' + esc(kurz(e.b, 110)) + '</span></span></li>';
    }).join('') || '<li class="leer" style="cursor:default">Nichts Passendes in Hilfe, Feldern und Abläufen — frag den Piloten (KI) unten.</li>';
  }
  /* Marcel, 13.10.2026: „die Hilfe muss direkt, wenn ich was eingebe …
     die Antwort zeigen." Der beste Treffer steht als Antwort OBEN, ohne
     Klick; die Liste darunter hält die übrigen. Enter fragt die KI —
     ihre Antwort ersetzt die Sofort-Antwort an derselben Stelle. */
  var _kiLaeuft = false, _sofortT = null;
  function sofort(q) {
    if (_kiLaeuft) return;
    clearTimeout(_sofortT);
    var box = tower.querySelector('.antwbox');
    if (norm(q).length < 3) { box.innerHTML = ''; return; }
    _sofortT = setTimeout(function () {
      var e = _treffer.filter(function (x) { return x.art !== 'aktion'; })[0] || _treffer[0];
      if (!e) { box.innerHTML = '<div class="antw"><div class="q">Keine Sofort-Antwort</div>In Hilfe, Feldern und Abläufen steht dazu nichts. Drück Enter — dann fragt der Pilot die KI.</div>'; return; }
      antworte(e, true);
    }, 140);
  }
  function waehle(i) {
    var lis = tower.querySelectorAll('ul.tr li[data-i]'); if (!lis.length) return;
    _sel = (i + lis.length) % lis.length;
    lis.forEach(function (li, j) { li.classList.toggle('sel', j === _sel); });
    lis[_sel].scrollIntoView({ block: 'nearest' });
  }
  function knopf(text, ziel) { return '<button type="button" data-ziel="' + esc(JSON.stringify(ziel)) + '">' + esc(text) + '</button>'; }
  function antworte(e, auto) {
    if (!e) return;
    var k = '';
    if (e.art === 'aktion') { if (!auto) { fliegeNach(e.ziel); return; } k += knopf('Öffnen →', e.ziel); }
    if (e.art === 'feld') k += knopf('Zeig mir das Feld →', e.ziel);
    if (e.art === 'hilfe' || e.art === 'glossar') k += knopf('In der Hilfe öffnen →', e.ziel);
    if (e.art === 'ablauf') { k += knopf('Im Prozess-Atlas zeigen →', e.ziel); if (e.nav) k += knopf('Hinfliegen →', e.nav); }
    tower.querySelector('.antwbox').innerHTML = '<div class="antw' + (auto ? ' sofort' : '') + '"><div class="q">' + (auto ? 'Sofort-Antwort · ' : '') + esc(ART[e.art] + (e.thema ? ' · ' + e.thema : '')) + (auto ? '<span class="enter">Enter fragt die KI</span>' : '') + '</div><b>' + esc(e.t) + '</b><div>' + esc(e.b) + '</div>'
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
    btn.disabled = true; figur('erklaert'); _kiLaeuft = true;
    tower.querySelector('.rumpf').scrollTop = 0;
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
      .then(function () { btn.disabled = false; _kiLaeuft = false; tower.querySelector('.rumpf').scrollTop = 0; });
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
        pilot.classList.remove('ruht');
        laufeZu(r.right + 6, r.top - 40, function () { zeigeArm(r); });
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

  function start() {
    bauen();
    pilot.classList.toggle('aus', ort() === 'aus');
    heimSetzen(true);
    setTimeout(function () { heimSetzen(true); }, 1500);
    /* Die Seitenleiste baut sich nach dem Laden noch um (Objekte, Score) —
       der Ruheplatz wird deshalb nachgemessen, nicht einmal gesetzt. */
    setInterval(function () { heimSetzen(false); }, 1200);
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { heimSetzen(true); }, 200); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.DealPilotPilot = { rufen: rufen, schliessen: schliessen, suche: suche, fliegeNach: fliegeNach, neuIndex: function () { _index = null; },
    ort: ort, setOrt: setOrt, ORTE: ORTE, einstellungenHtml: einstellungenHtml };
})();
