/* ═══════════════════════════════════════════════════════════════════════════
   ui-varianten.js — v1082 · Backlog Punkt 2 (Darstellungs-Modal)
   Vorlage: design/mockups/dp-darstellung-panel.html (abgenommen 2026-08-05)

   Diese Datei war seit 20260801 in index.html:3466 verlinkt und existierte
   nicht — der zweite der beiden 404 aus dem Backlog.

   WAS SIE TUT
     Panel rechts angedockt, App links live. Jede Aenderung wirkt sofort,
     weil Form ueber Attribute am <html> laeuft (data-ui-theme / -cards /
     -surface) und Farbe ueber die vorhandene Whitelabel-Tokenebene. Es gibt
     deshalb KEIN zweites gerendertes Abbild, das auseinanderlaufen koennte
     — die laufende App IST die Vorschau.

   WAS SIE BEWUSST NICHT TUT
     Sie faerbt nichts selbst. Jede Flaeche steht in css/ui-varianten.css.
     Hier stehen nur Zustand, Speicherung und die Bedienung.

   ZWINGEND (Backlog)
     * "dealpilot", "standard" und "auto" sind die Istzustaende und tragen
       KEIN Attribut. Das Attribut wird bei ihnen ENTFERNT, nicht gesetzt —
       wer nicht umschaltet, bekommt die App bitgenau wie heute.
     * Farben erst ab Partner. Die Sektion bleibt fuer alle SICHTBAR und
       wird ausgegraut. Sichtbar gesperrt ist ehrlicher als versteckt.
     * Gold-Literale stehen als var(--wl-<hex>, #<hex>), damit
       tools/gold-audit.py keine neue Fundstelle bekommt.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotUiVarianten) return;

  var LSK = 'dp_user_settings';

  /* Die abgenommenen sechs. "dealpilot" steht bewusst mit key:'' — leer
     heisst "kein Attribut", und genau das ist die Zusicherung aus dem
     Backlog, dass ohne Umschalten nichts anders ist. */
  var THEMES = [
    { key: '',         name: 'DealPilot', sub: 'Obsidian & Gold' },
    { key: 'kontor',   name: 'Kontor',    sub: 'Rein weiß'   },
    { key: 'panel',    name: 'Panel',     sub: 'Kühl'        },
    { key: 'kanzlei',  name: 'Kanzlei',   sub: 'Serife'           },
    { key: 'boarding', name: 'Boarding',  sub: 'Creme'            },
    { key: 'konsole',  name: 'Konsole',   sub: 'Dicht, Mono'      }
  ];
  var CARDS = [
    { key: 'kompakt',  name: 'Kompakt',  sub: 'Meiste'      },
    { key: '',         name: 'Standard', sub: 'Foto & KPI'  },
    { key: 'wallet',   name: 'Wallet',   sub: 'Farbkopf'    }
  ];
  var SURFACE = [
    { key: '',       name: 'Passend', sub: 'Folgt der Vorlage' },
    { key: 'light',  name: 'Weiß', sub: 'Auch im Dunkeln' }
  ];
  var AKZENTE  = ['#C9A84C', '#1F4E79', '#0F6E6E', '#7B2D3B', '#3A4250', '#5B7C3A'];
  var GRUNDFARBEN = ['#050505', '#0B1220', '#16110B', '#0D1512', '#1C2027', '#241C16'];

  /* ── Speicherung ──────────────────────────────────────────────────────
     Dasselbe Feld wie DealPilotBgMode (settings.js:2915) — ein JSON unter
     dp_user_settings statt eines weiteren Einzelschluessels. */
  function load() {
    try { return JSON.parse(localStorage.getItem(LSK) || '{}') || {}; } catch (e) { return {}; }
  }
  function save(patch) {
    var s = load();
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    try { localStorage.setItem(LSK, JSON.stringify(s)); } catch (e) {}
  }
  function get(feld, erlaubt) {
    var v = load()[feld] || '';
    for (var i = 0; i < erlaubt.length; i++) { if (erlaubt[i].key === v) return v; }
    return '';
  }

  /* ── Attribute am <html> ──────────────────────────────────────────────
     Leerer Wert -> Attribut ENTFERNEN. Ein data-ui-theme="" wuerde in CSS
     naemlich auf [data-ui-theme] matchen und den Istzustand kippen. */
  function attr(name, wert) {
    var r = document.documentElement;
    if (wert) r.setAttribute(name, wert); else r.removeAttribute(name);
  }
  function anwenden() {
    attr('data-ui-theme',   get('ui_theme',   THEMES));
    attr('data-ui-cards',   get('ui_cards',   CARDS));
    attr('data-ui-surface', get('ui_surface', SURFACE));
  }

  /* ── Plan-Schranke ────────────────────────────────────────────────────
     Nur die FARBEN haengen am Partner-Plan. Vorlagen, Kartenmodus und
     Kartenflaeche darf jeder — das ist Bequemlichkeit, keine Leistung. */
  function istPartner() {
    try {
      var p = window.DealPilotConfig && DealPilotConfig.pricing;
      return !!(p && p.currentKey && p.currentKey() === 'partner');
    } catch (e) { return false; }
  }

  /* ── Farben ───────────────────────────────────────────────────────────
     Unveraendert ueber die vorhandene Tokenebene. Kein neues Feld, keine
     zweite Wahrheit. */
  function farbenAnwenden(accent, obsidian) {
    try {
      if (window.DealPilotWhitelabel && DealPilotWhitelabel.apply) {
        DealPilotWhitelabel.apply({ accent: accent, obsidian: obsidian });
      }
    } catch (e) {}
  }

  /* ── Panel-Optik ──────────────────────────────────────────────────────
     Das Panel ist das Werkzeug und sieht in JEDER Vorlage gleich aus —
     sonst veraendert sich beim Umschalten das Bedienelement mit und man
     verliert den Vergleichsmassstab. Deshalb feste Werte, bewusst NICHT
     ueber die --uv-Tokens. */
  var CSS = [
    '#dpuv-panel{position:fixed;top:0;right:0;bottom:0;width:376px;max-width:92vw;z-index:2147482000;',
      'display:flex;flex-direction:column;background:#FDFCFA;color:#1a1712;',
      'border-left:1px solid rgba(0,0,0,.14);box-shadow:-18px 0 46px -26px rgba(0,0,0,.6);',
      'font-family:Inter,system-ui,sans-serif;transform:translateX(100%);transition:transform .22s ease}',
    '#dpuv-panel.open{transform:translateX(0)}',
    '#dpuv-h{flex:0 0 auto;padding:15px 18px;border-bottom:1px solid #E9E4D9;display:flex;align-items:flex-start;gap:11px}',
    '#dpuv-h h2{font-family:"Cormorant Garamond",Georgia,serif;font-size:22px;font-weight:600;margin:0;flex:1;color:#1a1712}',
    '#dpuv-h p{font-size:11.5px;color:#8b8577;font-style:italic;margin:2px 0 0}',
    '#dpuv-x{width:44px;height:44px;border-radius:7px;border:1px solid #E0DACB;background:#fff;color:#5c574d;',
      'cursor:pointer;flex:none;font-size:15px;line-height:1}',
    '#dpuv-b{flex:1 1 auto;overflow-y:auto;padding:16px 18px 20px}',
    '.dpuv-g+.dpuv-g{margin-top:20px}',
    '.dpuv-g h3{font-family:"JetBrains Mono",monospace;font-size:9.5px;font-weight:700;letter-spacing:.17em;',
      'text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33);margin:0}',
    '.dpuv-g .dpuv-hint{font-size:11px;color:#8b8577;font-style:italic;margin:3px 0 0;line-height:1.5}',
    '.dpuv-seg{display:grid;gap:7px;margin-top:9px;grid-template-columns:1fr 1fr 1fr}',
    '.dpuv-seg.c2{grid-template-columns:1fr 1fr}',
    '.dpuv-sgb{padding:9px 8px;border:1px solid #E0DACB;border-radius:7px;background:#fff;cursor:pointer;',
      'text-align:center;transition:.14s;min-height:44px}',
    '.dpuv-sgb:hover{border-color:var(--wl-c9a84c, #C9A84C)}',
    '.dpuv-sgb b{display:block;font-size:12px;font-weight:600;color:#1a1712}',
    '.dpuv-sgb small{display:block;font-size:9.5px;color:#8b8577;margin-top:2px}',
    '.dpuv-sgb.on{background:var(--wl-fbf6e9, #FBF6E9);border-color:var(--wl-c9a84c, #C9A84C);',
      'box-shadow:0 0 0 1px var(--wl-c9a84c, #C9A84C)}',
    '.dpuv-lock{position:relative;margin-top:9px}',
    '.dpuv-lock.locked>.dpuv-inner{filter:grayscale(.7);opacity:.42;pointer-events:none}',
    '.dpuv-lockbar{display:none;margin-top:10px;padding:11px 12px;border:1px dashed var(--wl-e8d9a8, #E8D9A8);',
      'border-radius:8px;background:var(--wl-faf5e8, #FAF5E8);gap:10px;align-items:flex-start}',
    '.dpuv-lock.locked+.dpuv-lockbar{display:flex}',
    '.dpuv-lockbar b{display:block;font-size:12px;font-weight:600;color:#5c4a18}',
    '.dpuv-lockbar span{display:block;font-size:11px;line-height:1.5;color:#8b8577;margin-top:2px}',
    '.dpuv-lbl{font-size:11px;font-weight:600;color:#5c574d;margin-bottom:6px}',
    '.dpuv-swrow{display:flex;gap:7px;flex-wrap:wrap}',
    '.dpuv-sw{width:44px;height:44px;border-radius:8px;border:2px solid #E0DACB;cursor:pointer;padding:0;transition:.14s}',
    '.dpuv-sw.on{border-color:#1a1712;box-shadow:0 0 0 3px rgba(201,168,76,.3)}',
    '#dpuv-f{flex:0 0 auto;display:flex;gap:8px;padding:12px 18px;border-top:1px solid #E9E4D9;background:#F6F3EC}',
    '.dpuv-pf{flex:1;font-size:12.5px;font-weight:600;padding:12px;border-radius:8px;cursor:pointer;min-height:44px;',
      'border:1px solid #DCD5C4;background:#fff;color:#3d382f}',
    '.dpuv-pf.gold{background:var(--wl-c9a84c, #C9A84C);border-color:var(--wl-c9a84c, #C9A84C);color:#1a1407}',
    '#dpuv-back{position:fixed;inset:0;z-index:2147481999;background:rgba(0,0,0,.28);opacity:0;',
      'pointer-events:none;transition:opacity .22s}',
    '#dpuv-back.on{opacity:1;pointer-events:auto}',
    /* Handy: Blatt von unten statt Spalte von rechts — bei 390px waere eine
       376px-Spalte der ganze Schirm und die Live-Vorschau waere weg. */
    '@media (max-width:700px){',
      '#dpuv-panel{top:auto;left:0;width:auto;max-width:none;height:78vh;border-left:0;',
        'border-top:1px solid rgba(0,0,0,.14);border-radius:14px 14px 0 0;transform:translateY(100%)}',
      '#dpuv-panel.open{transform:translateY(0)}}',
    '@media (prefers-reduced-motion:reduce){#dpuv-panel,#dpuv-back{transition:none}}'
  ].join('');

  function cssEinspritzen() {
    if (document.getElementById('dpuv-styles')) return;
    var st = document.createElement('style');
    st.id = 'dpuv-styles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function segHtml(id, liste, aktiv, spalten) {
    return '<div class="dpuv-seg' + (spalten === 2 ? ' c2' : '') + '" id="' + id + '">' +
      liste.map(function (o) {
        return '<button type="button" class="dpuv-sgb' + (o.key === aktiv ? ' on' : '') +
          '" data-v="' + esc(o.key) + '"><b>' + esc(o.name) + '</b><small>' + esc(o.sub) + '</small></button>';
      }).join('') + '</div>';
  }
  function swHtml(id, farben, aktiv) {
    return '<div class="dpuv-swrow" id="' + id + '">' +
      farben.map(function (h) {
        return '<button type="button" class="dpuv-sw' + (h.toLowerCase() === String(aktiv).toLowerCase() ? ' on' : '') +
          '" data-v="' + esc(h) + '" style="background:' + esc(h) + '" aria-label="' + esc(h) + '"></button>';
      }).join('') + '</div>';
  }

  function bauen() {
    cssEinspritzen();
    if (document.getElementById('dpuv-panel')) return;

    var s = load();
    var back = document.createElement('div');
    back.id = 'dpuv-back';
    document.body.appendChild(back);

    var p = document.createElement('aside');
    p.id = 'dpuv-panel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Darstellung');
    p.innerHTML =
      '<div id="dpuv-h"><div style="flex:1"><h2>Darstellung</h2>' +
        '<p>Jede Änderung wirkt sofort — dahinter siehst du das Ergebnis.</p></div>' +
        '<button type="button" id="dpuv-x" aria-label="Schließen">✕</button></div>' +
      '<div id="dpuv-b">' +
        '<div class="dpuv-g"><h3>App-Darstellung</h3>' +
          '<p class="dpuv-hint">Aufbau, Dichte und Typografie der gesamten Oberfläche.</p>' +
          segHtml('dpuv-theme', THEMES, get('ui_theme', THEMES)) + '</div>' +
        '<div class="dpuv-g"><h3>Objektkarten</h3>' +
          '<p class="dpuv-hint">Wie viel jede Karte in der Objektliste zeigt.</p>' +
          segHtml('dpuv-cards', CARDS, get('ui_cards', CARDS)) + '</div>' +
        '<div class="dpuv-g"><h3>Kartenfläche</h3>' +
          '<p class="dpuv-hint">Karten folgen der Vorlage oder bleiben weiß.</p>' +
          segHtml('dpuv-surface', SURFACE, get('ui_surface', SURFACE), 2) + '</div>' +
        '<div class="dpuv-g"><h3>Farben</h3>' +
          '<p class="dpuv-hint">Akzent und Grundfarbe für App, PDF und Mails.</p>' +
          '<div class="dpuv-lock" id="dpuv-lock"><div class="dpuv-inner">' +
            '<div class="dpuv-lbl">Akzent</div>' +
            swHtml('dpuv-acc', AKZENTE, s.ui_accent || '#C9A84C') +
            '<div class="dpuv-lbl" style="margin-top:14px">Grundfarbe (Obsidian)</div>' +
            swHtml('dpuv-obs', GRUNDFARBEN, s.ui_obsidian || '#050505') +
          '</div></div>' +
          '<div class="dpuv-lockbar"><div><b>Farben ab Partner</b>' +
            '<span>Akzent und Grundfarbe gehören zum Partner-Paket und gelten dann ' +
            'auch für alle Mandanten.</span></div></div>' +
        '</div>' +
      '</div>' +
      '<div id="dpuv-f"><button type="button" class="dpuv-pf" id="dpuv-reset">Zurücksetzen</button>' +
        '<button type="button" class="dpuv-pf gold" id="dpuv-done">Fertig</button></div>';
    document.body.appendChild(p);

    /* Segmente */
    function segBinden(id, feld, liste, nachher) {
      var host = document.getElementById(id);
      host.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('.dpuv-sgb') : null;
        if (!b) return;
        host.querySelectorAll('.dpuv-sgb').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var patch = {}; patch[feld] = b.getAttribute('data-v') || '';
        save(patch); anwenden();
        if (nachher) nachher();
      });
    }
    segBinden('dpuv-theme',   'ui_theme',   THEMES);
    segBinden('dpuv-cards',   'ui_cards',   CARDS);
    segBinden('dpuv-surface', 'ui_surface', SURFACE);

    /* Farbfelder */
    function swBinden(id, feld) {
      var host = document.getElementById(id);
      host.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('.dpuv-sw') : null;
        if (!b) return;
        host.querySelectorAll('.dpuv-sw').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var v = b.getAttribute('data-v');
        var patch = {}; patch[feld] = v; save(patch);
        var st = load();
        farbenAnwenden(st.ui_accent || '#C9A84C', st.ui_obsidian || '#050505');
      });
    }
    swBinden('dpuv-acc', 'ui_accent');
    swBinden('dpuv-obs', 'ui_obsidian');

    document.getElementById('dpuv-x').addEventListener('click', schliessen);
    document.getElementById('dpuv-done').addEventListener('click', schliessen);
    back.addEventListener('click', schliessen);
    document.getElementById('dpuv-reset').addEventListener('click', function () {
      save({ ui_theme: '', ui_cards: '', ui_surface: '', ui_accent: '#C9A84C', ui_obsidian: '#050505' });
      anwenden();
      farbenAnwenden('#C9A84C', '#050505');
      [['dpuv-theme', ''], ['dpuv-cards', ''], ['dpuv-surface', '']].forEach(function (pair) {
        document.querySelectorAll('#' + pair[0] + ' .dpuv-sgb').forEach(function (x) {
          x.classList.toggle('on', (x.getAttribute('data-v') || '') === pair[1]);
        });
      });
      [['dpuv-acc', '#c9a84c'], ['dpuv-obs', '#050505']].forEach(function (pair) {
        document.querySelectorAll('#' + pair[0] + ' .dpuv-sw').forEach(function (x) {
          x.classList.toggle('on', (x.getAttribute('data-v') || '').toLowerCase() === pair[1]);
        });
      });
      try { if (typeof toast === 'function') toast('Darstellung zurückgesetzt'); } catch (e) {}
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && p.classList.contains('open')) schliessen();
    });
  }

  function gateSetzen() {
    var l = document.getElementById('dpuv-lock');
    if (l) l.classList.toggle('locked', !istPartner());
  }

  function oeffnen() {
    bauen();
    gateSetzen();
    var p = document.getElementById('dpuv-panel'), b = document.getElementById('dpuv-back');
    if (!p) return;
    /* v1082c: Hier stand requestAnimationFrame. Gemessen: in einem
       gedrosselten Tab feuert rAF NICHT (rafGefeuert=false nach 700ms) —
       das Panel waere dann gar nicht aufgegangen. Ein erzwungener Reflow
       tut dasselbe fuer die Transition, aber synchron und ohne Zeitplaner:
       offsetWidth lesen zwingt den Browser, den Startzustand zu setzen,
       bevor die Klasse den Zielzustand bringt. */
    void p.offsetWidth;
    p.classList.add('open');
    if (b) b.classList.add('on');
  }
  function schliessen() {
    var p = document.getElementById('dpuv-panel'), b = document.getElementById('dpuv-back');
    if (p) p.classList.remove('open');
    if (b) b.classList.remove('on');
  }

  /* ── Boot ─────────────────────────────────────────────────────────────
     Die Attribute so frueh wie moeglich setzen. Der Inline-Boot im <head>
     von index.html macht das bereits vor dem ersten Paint; dieser Aufruf
     ist das zweite Netz, falls der Inline-Boot einmal fehlt. */
  anwenden();

  /* Der Plan steht beim Laden noch nicht fest — nachziehen, wenn er kommt.
     dp:plan-ready statt Timer oder Polling (CLAUDE.md). */
  window.addEventListener('dp:plan-ready', gateSetzen);

  window.DealPilotUiVarianten = {
    open:  oeffnen,
    close: schliessen,
    apply: anwenden,
    themes: THEMES
  };

  /* Zugang aus den Einstellungen. settings.js:3395 wrappt
     _dpOpenFromSettings und BRICHT AB, wenn currentKey() !== 'partner' —
     damit waeren Vorlagen und Kartenmodus ploetzlich Partner-Funktionen.
     Die Pruefung wandert deshalb hierher auf die Farbsektion (gateSetzen).
     Der Wrapper wird nicht entfernt, sondern ueberschrieben: diese Datei
     laedt nach settings.js, also gilt diese Zuweisung. */
  window._dpOpenFromSettings = function () {
    try { if (typeof closeSettings === 'function') closeSettings(); } catch (e) {}
    setTimeout(oeffnen, 140);
  };
})();
