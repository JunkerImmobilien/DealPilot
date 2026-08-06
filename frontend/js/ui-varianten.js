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
    { key: 'wallet',   name: 'Wallet',   sub: 'Farbkopf'    },
    /* v1095 — Vorlage design/mockups/handy2.jpg, Auszug aus der
       Mobile-Fassung (MA-Pakete). Goldene Zeile, Ring links,
       Stufen-Abzeichen rechts, aufklappbar wie "kompakt". */
    { key: 'stapel',   name: 'Stapel',   sub: 'Handy-Optik' }
  ];
  var SURFACE = [
    { key: '',       name: 'Passend', sub: 'Folgt der Vorlage' },
    { key: 'light',  name: 'Weiß', sub: 'Auch im Dunkeln' }
  ];
  /* v1082f · GOLD_STD ist ein DATENwert, kein Stilwert — und deshalb bewusst
     ein rohes Literal.
     Es ist der Ausgangs-Akzent, den DealPilotWhitelabel.apply() gesetzt
     bekommt, wenn jemand "DealPilot-Gold" waehlt oder zuruecksetzt. Die
     Tokenform var(--wl-c9a84c, …) und die Hilfsfunktion window._wlc() liefern
     beide den BEREITS UMGEFAERBTEN Ton — genau den, den wir hier ersetzen
     wollen. Wer auf das Goldfeld tippt, meint DealPilot-Gold, nicht "die
     Farbe, die gerade eingestellt ist".
     Deshalb steht das Literal hier EINMAL statt siebenmal: tools/gold-audit.py
     meldet dadurch eine Fundstelle in dieser Datei statt sieben, und die eine
     ist erklaerbar. */
  var GOLD_STD = '#C9A84C';
  var OBSIDIAN_STD = '#050505';

  var AKZENTE  = [GOLD_STD, '#1F4E79', '#0F6E6E', '#7B2D3B', '#3A4250', '#5B7C3A'];
  var GRUNDFARBEN = [OBSIDIAN_STD, '#0B1220', '#16110B', '#0D1512', '#1C2027', '#241C16'];

  /* ── v1098 · Die Bereiche aus dem alten Panel ─────────────────────────
     Backlog Punkt 1: die beiden Darstellungs-Panels zusammenlegen.
     Diese sechs Farbzeilen standen bisher im alten #dp-tb-panel
     (settings.js:3175-3184) unter "Chrome (Hell)" und "Karten". Sie werden
     UMGEHAENGT, nicht neu gebaut: dieselben globalen Handler, dieselben
     localStorage-Schluessel.

     WARUM DIE ALTEN SCHLUESSEL BLEIBEN MUESSEN (Backlog, "Fallen"): das
     neue Panel speichert sonst alles als ein JSON unter dp_user_settings —
     aber darstellung-reseller.js liest in seiner MAP (:40) genau diese
     Einzelschluessel, um die Marke eines Partners an dessen Mandanten
     durchzureichen. Ein zweites Format haette den Mandanten-Abgleich still
     abgehaengt. */
  var BEREICHE = [
    { fn: '_dpDispHeader',  ls: 'dp_hdr_ui',     def: '#EAE4D6', label: 'Kopfleiste + Logo' },
    { fn: '_dpDispSide',    ls: 'dp_side_ui',    def: '#EAE4D6', label: 'Objektleiste + Band' },
    { fn: '_dpDispText',    ls: 'dp_text_ui',    def: '#1A1A1A', label: 'Text' },
    { fn: '_dpDispHero',    ls: 'dp_hero_ui',    def: GOLD_STD,  label: 'Score-Karte' },
    { fn: '_dpDispKpi',     ls: 'dp_kpi_ui',     def: '#F6F2E9', label: 'KPI-Karten' },
    { fn: '_dpDispObj',     ls: 'dp_obj_ui',     def: '#F6F2E9', label: 'Objektkarten' }
    /* NICHT hier: _dpDispTabText und _dpDispObjText. Die liefert
       _dpLogoBlock() (settings.js:3386) bereits selbst als eigenen Block
       "Text-Feintuning" — beim ersten Anlauf standen sie dadurch doppelt
       im Panel. Im Bild gesehen, nicht im Code vermutet. */
  ];

  var SCHRIFTEN = [
    { key: 'inter',   name: 'Inter',   sub: 'Neutral' },
    { key: 'grotesk', name: 'Grotesk', sub: 'Marke'   },
    { key: 'serif',   name: 'Serif',   sub: 'Klassisch' },
    { key: 'system',  name: 'System',  sub: 'Gerät'   }
  ];
  var GROESSEN = [
    { key: '0.92', name: 'A−', sub: 'Kompakt' },
    { key: '1',    name: 'A',  sub: 'Normal'  },
    { key: '1.08', name: 'A+', sub: 'Größer'  }
  ];
  /* v1098 · "Form" — Marcels Zusatz zum Backlog-Punkt. Der Radius steckte
     bisher nur als --uv-r/--uv-rs IN der Vorlage und war nicht waehlbar.
     Leerer Schluessel heisst wie ueberall: kein Attribut, die Vorlage
     entscheidet. */
  var FORMEN = [
    { key: 'kantig', name: 'Kantig', sub: 'Ohne Radius' },
    { key: '',       name: 'Passend', sub: 'Folgt der Vorlage' },
    { key: 'rund',   name: 'Rund',   sub: 'Weiche Ecken' }
  ];

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
    attr('data-ui-form',    get('ui_form',    FORMEN));   /* v1098 */
  }

  /* ── Plan-Schranke ────────────────────────────────────────────────────
     Nur die FARBEN haengen am Partner-Plan. Vorlagen, Kartenmodus und
     Kartenflaeche darf jeder — das ist Bequemlichkeit, keine Leistung. */
  function istPartner() {
    /* v1098: Erst Plan.can('reseller') — das ist dasselbe Tor, das
       darstellung-reseller.js:48 benutzt, und der Backlog nennt es
       ausdruecklich. Vorher stand hier nur currentKey()==='partner'.
       GEMESSEN, dass das eine zweite Wahrheit war: mit gestubbtem
       currentKey blieb die Marke gesperrt, der Reseller-Umschalter darin
       aber sichtbar — die beiden Tests waren verschiedener Meinung.
       currentKey bleibt als Rueckfall, falls Plan noch nicht geladen ist:
       im Zweifel sperren, nicht oeffnen. */
    try {
      if (window.Plan && typeof Plan.can === 'function') return !!Plan.can('reseller');
    } catch (e) {}
    try {
      var p = window.DealPilotConfig && DealPilotConfig.pricing;
      return !!(p && p.currentKey && p.currentKey() === 'partner');
    } catch (e) {}
    return false;
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
    '.dpuv-sw.on{border-color:#1a1712;box-shadow:0 0 0 3px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent)}',
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
    '@media (prefers-reduced-motion:reduce){#dpuv-panel,#dpuv-back{transition:none}}',

    /* ── v1098 · Farbzeilen und Stilbruecke ───────────────────────────────
       Die Farbzeile ist neu, aber sie traegt dieselbe Klasse .dp-tb-row wie
       im alten Panel — damit passen die umgehaengten Bloecke (_dpLogoBlock,
       _dpResBlock, _dpResSave) ohne Aenderung hinein. Die liefern fertiges
       HTML mit den alten Klassen; die Vorgabe im Backlog lautet
       ausdruecklich "umgehaengt, nicht neu gebaut". Also kommt die Optik
       hierher, statt dass drueben etwas angefasst wird. */
    '#dpuv-b .dp-tb-row{display:flex;align-items:center;justify-content:space-between;gap:10px;',
      'padding:7px 0;font-size:12px;color:#3d382f}',
    '#dpuv-b .dp-tb-row+.dp-tb-row{border-top:1px solid #EFEBE1}',
    /* 44px, nicht 30 — im 390er-iframe gemessen: acht Farbfelder lagen
       unter der Mindestgroesse fuer Trefferflaechen, die das Panel sonst
       ueberall einhaelt (.dpuv-sgb, .dpuv-sw, .dpuv-pf: min-height 44). */
    '#dpuv-b .dp-tb-row input[type=color]{width:56px;height:44px;padding:2px;border:1px solid #E0DACB;',
      'border-radius:7px;background:#fff;cursor:pointer;flex:none}',
    '#dpuv-b .dp-tb-row input[type=range]{flex:1;max-width:150px}',
    '#dpuv-b .dp-tb-sec{margin-top:14px}',
    '#dpuv-b .dp-tb-sec>b{display:block;font-family:"JetBrains Mono",monospace;font-size:9.5px;',
      'font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8b8577;margin:0 0 7px}',
    '#dpuv-b .dp-tt-mode-toggle{display:flex;gap:7px;flex-wrap:wrap}',
    '#dpuv-b .dp-tt-mode-btn{flex:1 1 auto;min-height:44px;padding:9px 8px;border:1px solid #E0DACB;',
      'border-radius:7px;background:#fff;color:#3d382f;font-size:12px;font-weight:600;cursor:pointer}',
    '#dpuv-b .dp-tt-mode-btn.active{background:var(--wl-fbf6e9, #FBF6E9);',
      'border-color:var(--wl-c9a84c, #C9A84C);box-shadow:0 0 0 1px var(--wl-c9a84c, #C9A84C)}',
    '#dpuv-b .btn{min-height:44px;border-radius:8px;border:1px solid #DCD5C4;background:#fff;',
      'color:#3d382f;font-size:12.5px;font-weight:600;cursor:pointer;padding:11px}',
    '#dpuv-b .dp-tb-sec img{max-width:100%;height:auto}'
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

  /* ── v1098 · Eine Farbzeile, exakt nach dem Muster aus settings.js:3166 ──
     Dort heisst sie ci(fn, lsKey, default, label) und ist eine <input
     type="color"> mit oninput. Der Backlog nennt sie als Vorlage, weil die
     Handler global sind und bereits funktionieren. Einziger Unterschied:
     hier wird der Wert per Listener gebunden statt per oninput-Attribut —
     inline-Handler haetten sonst als Text im HTML gestanden. */
  function farbzeile(b) {
    var wert = '';
    try { wert = localStorage.getItem(b.ls) || b.def; } catch (e) { wert = b.def; }
    return '<label class="dp-tb-row"><span>' + esc(b.label) + '</span>' +
      '<input type="color" value="' + esc(wert) + '" data-fn="' + esc(b.fn) + '" data-ls="' + esc(b.ls) + '"></label>';
  }

  /* Die umgehaengten Bloecke liefern Leerstring, wenn kein Partner —
     das Ausblenden erledigt sich damit von selbst (Backlog, Schritt 4). */
  function fremdBlock(name) {
    try { return (typeof window[name] === 'function') ? (window[name]() || '') : ''; } catch (e) { return ''; }
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
        /* v1098 · "Form" — frei fuer jeden. Radius ist Bequemlichkeit,
           keine Marke, und faellt damit unter dieselbe Ueberlegung wie
           Vorlage und Kartenmodus. */
        '<div class="dpuv-g"><h3>Form</h3>' +
          '<p class="dpuv-hint">Wie weich Karten, Felder und Knöpfe an den Ecken sind. ' +
            'Wirkt zusammen mit einer Vorlage — „DealPilot" behält seine eigenen Ecken.</p>' +
          segHtml('dpuv-form', FORMEN, get('ui_form', FORMEN)) + '</div>' +
        '<div class="dpuv-g"><h3>Schrift</h3>' +
          '<p class="dpuv-hint">Schriftfamilie und Textgröße der gesamten Oberfläche.</p>' +
          '<div class="dp-tt-mode-toggle" id="dpuv-font">' +
            SCHRIFTEN.map(function (f) {
              return '<button type="button" class="dp-tt-mode-btn" data-v="' + esc(f.key) + '">' + esc(f.name) + '</button>';
            }).join('') + '</div>' +
          '<div class="dp-tt-mode-toggle" id="dpuv-size" style="margin-top:7px">' +
            GROESSEN.map(function (g) {
              return '<button type="button" class="dp-tt-mode-btn" data-v="' + esc(g.key) + '">' + esc(g.name) + '</button>';
            }).join('') + '</div></div>' +

        /* ── Marke ────────────────────────────────────────────────────────
           Backlog Punkt 1. Alles, was die MARKE ausmacht, an einer Stelle:
           Akzent, Grundfarbe, die acht Bereiche und das Logo. Schrift und
           Form stehen bewusst DARUEBER und ausserhalb der Sperre — sie sind
           Bequemlichkeit, keine Marke.
           Der Reseller-Umschalter steht ganz oben im Abschnitt, weil er
           bestimmt, WEN alles Folgende betrifft (mich oder meine
           Mandanten). */
        '<div class="dpuv-g"><h3>Marke</h3>' +
          '<p class="dpuv-hint">Farben und Logo für App, PDF und Mails.</p>' +
          '<div class="dpuv-lock" id="dpuv-lock"><div class="dpuv-inner">' +
            '<div id="dpuv-res">' + fremdBlock('_dpResBlock') + '</div>' +
            '<div class="dpuv-lbl" style="margin-top:12px">Akzent</div>' +
            swHtml('dpuv-acc', AKZENTE, s.ui_accent || GOLD_STD) +
            '<div class="dpuv-lbl" style="margin-top:14px">Grundfarbe (Obsidian)</div>' +
            swHtml('dpuv-obs', GRUNDFARBEN, s.ui_obsidian || OBSIDIAN_STD) +
            '<div class="dp-tb-sec" id="dpuv-bereiche"><b>Einzelne Bereiche</b>' +
              '<p class="dpuv-hint" style="margin:0 0 6px">Übersteuert die Vorlage. ' +
              'Wirkt zusammen mit einer Vorlage — „DealPilot" behält seine eigenen Flächen.</p>' +
              BEREICHE.map(farbzeile).join('') + '</div>' +
            '<div id="dpuv-logo">' + fremdBlock('_dpLogoBlock') + '</div>' +
            '<div id="dpuv-ressave">' + fremdBlock('_dpResSave') + '</div>' +
          '</div></div>' +
          '<div class="dpuv-lockbar"><div><b>Marke ab Partner</b>' +
            '<span>Farben und Logo gehören zum Partner-Paket und gelten dann ' +
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
        /* v1085: Wer eine Vorlage waehlt, setzt damit auch die Helligkeit —
           sonst zeigt der Skin-Schalter in den Einstellungen anschliessend
           etwas anderes an als die App. */
        if (feld === 'ui_theme') { try { skinNachziehen(); } catch (e) {} }
        if (nachher) nachher();
      });
    }
    segBinden('dpuv-theme',   'ui_theme',   THEMES);
    segBinden('dpuv-cards',   'ui_cards',   CARDS);
    segBinden('dpuv-surface', 'ui_surface', SURFACE);
    segBinden('dpuv-form',    'ui_form',    FORMEN);      /* v1098 */

    /* ── v1098 · Bereichsfarben ───────────────────────────────────────────
       Ein Listener am Abschnitt statt acht an den Feldern. Der Handler ist
       der GLOBALE aus settings.js — er setzt die CSS-Variable UND schreibt
       den alten Einzelschluessel. Deshalb wird hier nichts zusaetzlich
       gespeichert: zwei Speicherorte fuer denselben Wert waeren genau die
       zweite Wahrheit, vor der der Backlog warnt. */
    var bereiche = document.getElementById('dpuv-bereiche');
    if (bereiche) bereiche.addEventListener('input', function (ev) {
      var el = ev.target;
      if (!el || el.type !== 'color') return;
      var fn = el.getAttribute('data-fn');
      try { if (typeof window[fn] === 'function') window[fn](el.value); } catch (e) {}
    });

    /* ── Schrift und Groesse ──────────────────────────────────────────────
       Ebenfalls die globalen Handler (_dpDispFont/_dpDispSize), die ihre
       Werte selbst unter dp_font_ui / dp_zoom_ui ablegen. */
    function knopfReihe(id, ls, fn, standard) {
      var host = document.getElementById(id);
      if (!host) return;
      var aktiv = standard;
      try { aktiv = localStorage.getItem(ls) || standard; } catch (e) {}
      host.querySelectorAll('.dp-tt-mode-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-v') === String(aktiv));
      });
      host.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('.dp-tt-mode-btn') : null;
        if (!b) return;
        host.querySelectorAll('.dp-tt-mode-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        try { if (typeof window[fn] === 'function') window[fn](b.getAttribute('data-v')); } catch (e) {}
      });
    }
    knopfReihe('dpuv-font', 'dp_font_ui', '_dpDispFont', 'inter');
    knopfReihe('dpuv-size', 'dp_zoom_ui', '_dpDispSize', '1');

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
        farbenAnwenden(st.ui_accent || GOLD_STD, st.ui_obsidian || OBSIDIAN_STD);
      });
    }
    swBinden('dpuv-acc', 'ui_accent');
    swBinden('dpuv-obs', 'ui_obsidian');

    document.getElementById('dpuv-x').addEventListener('click', schliessen);
    document.getElementById('dpuv-done').addEventListener('click', schliessen);
    back.addEventListener('click', schliessen);
    document.getElementById('dpuv-reset').addEventListener('click', function () {
      save({ ui_theme: '', ui_cards: '', ui_surface: '', ui_form: '', ui_accent: GOLD_STD, ui_obsidian: OBSIDIAN_STD });
      anwenden();
      try { skinNachziehen(); } catch (e) {}   /* v1085: auch beim Zuruecksetzen */
      farbenAnwenden(GOLD_STD, OBSIDIAN_STD);
      /* v1098: Die Bereiche, Schrift und Groesse liegen in den ALTEN
         Einzelschluesseln — dafuer gibt es _dpDispReset (settings.js:3116),
         den zustaendigen Rueckbau. Nicht nachgebaut, sondern gerufen. */
      try { if (typeof window._dpDispReset === 'function') window._dpDispReset(); } catch (e) {}

      /* v1111: Beim MANDANTEN eines Partners heisst "Zuruecksetzen" nicht
         "DealPilot-Standard", sondern "zurueck auf die Marke meines
         Partners". Sonst raeumt der Rueckbau gerade das weg, was der
         Partner vorgibt — bis zum naechsten Laden, dann kommt es wieder.
         Das sah aus wie ein Fehler und war einer.
         Der Marker muss mit weg, sonst gilt die Marke als "schon gesehen"
         und der Komfort-Teil wuerde nicht neu gesetzt. */
      if (istMandant()) {
        try { localStorage.removeItem('dp_wl_display_seen'); } catch (e) {}
        try {
          if (window.DealPilotMandantBranding && DealPilotMandantBranding.reapply) {
            DealPilotMandantBranding.reapply();
          }
        } catch (e) {}
      }
      var bb = document.getElementById('dpuv-bereiche');
      if (bb) BEREICHE.forEach(function (def) {
        var f = bb.querySelector('input[data-ls="' + def.ls + '"]');
        if (f) f.value = def.def;
      });
      [['dpuv-font', 'inter'], ['dpuv-size', '1']].forEach(function (pair) {
        document.querySelectorAll('#' + pair[0] + ' .dp-tt-mode-btn').forEach(function (x) {
          x.classList.toggle('active', x.getAttribute('data-v') === pair[1]);
        });
      });
      [['dpuv-theme', ''], ['dpuv-cards', ''], ['dpuv-surface', ''], ['dpuv-form', '']].forEach(function (pair) {
        document.querySelectorAll('#' + pair[0] + ' .dpuv-sgb').forEach(function (x) {
          x.classList.toggle('on', (x.getAttribute('data-v') || '') === pair[1]);
        });
      });
      [['dpuv-acc', GOLD_STD.toLowerCase()], ['dpuv-obs', OBSIDIAN_STD.toLowerCase()]].forEach(function (pair) {
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

  /* ── v1111 · Bin ich Mandant eines Partners? ─────────────────────────
     dp_wl_cache existiert AUSSCHLIESSLICH bei einem reseller_client — das
     Backend liefert es fuer Owner null (mandant-branding.js:230). Es ist
     damit das gecachte Kennzeichen "Mandant eines Partners", und die
     Handy-Sperre nutzt es bereits genau so. */
  function istMandant() {
    try {
      var v = localStorage.getItem('dp_wl_cache');
      return !!(v && v !== 'null' && v !== '{}');
    } catch (e) { return false; }
  }

  function gateSetzen() {
    var l = document.getElementById('dpuv-lock');
    if (!l) return;
    /* Gesperrt ist der Abschnitt Marke fuer ZWEI Gruppen, aus verschiedenen
       Gruenden — deshalb auch zwei Texte:
         kein Partner   -> die Marke gehoert zum Partner-Paket
         Mandant        -> die Marke gehoert dem Partner, nicht ihm
       Ein Partner, der selbst Mandant waere, bleibt Partner: die
       Partner-Pruefung kommt zuerst. */
    var partner = istPartner();
    var mandant = !partner && istMandant();
    l.classList.toggle('locked', !partner);
    var bar = document.querySelector('.dpuv-lockbar');
    if (bar) {
      bar.innerHTML = mandant
        ? '<div><b>Von deinem Partner vorgegeben</b><span>Farben und Logo kommen aus dem ' +
          'Branding deines Partners und gelten für alle seine Mandanten. Vorlage, Karten, ' +
          'Form und Schrift kannst du frei wählen.</span></div>'
        : '<div><b>Marke ab Partner</b><span>Farben und Logo gehören zum Partner-Paket und ' +
          'gelten dann auch für alle Mandanten.</span></div>';
    }
  }

  /* ── v1098 · Die umgehaengten Bloecke auffrischen ─────────────────────
     GEMESSEN, warum das noetig ist: darstellung-reseller.js repaint()
     (:107) sucht ZUERST das alte Panel und ruft dessen panelHtmlRebuild().
     Das alte Panel bleibt vorerst bestehen (Backlog, Schritt 1: nichts
     loeschen) — also greift dort immer der erste Zweig und der neue
     Abschnitt bliebe stehen, wie er war. Beim Umschalten "Mich /
     Meine Mandanten" haette er den falschen Zustand gezeigt.

     Deshalb hier ein eigener Aufbau der drei Fremdbloecke. Er laeuft bei
     jedem Oeffnen und zusaetzlich hinter _dpDispTarget — umhuellt nach dem
     Hausmuster aus settings.js:3469, das Original bleibt unangetastet. */
  function markeAuffrischen() {
    [['dpuv-res', '_dpResBlock'], ['dpuv-logo', '_dpLogoBlock'], ['dpuv-ressave', '_dpResSave']]
      .forEach(function (paar) {
        var host = document.getElementById(paar[0]);
        if (host) host.innerHTML = fremdBlock(paar[1]);
      });
    /* Die Farbfelder tragen den Wert, der beim Bauen galt. Nach einem
       Wechsel auf die Mandanten-Ansicht steht in den Einzelschluesseln
       etwas anderes — also nachziehen, sonst zeigt das Feld die alte Farbe
       und ein Klick darauf schriebe sie zurueck. */
    var b = document.getElementById('dpuv-bereiche');
    if (b) BEREICHE.forEach(function (def) {
      var f = b.querySelector('input[data-ls="' + def.ls + '"]');
      if (!f) return;
      var v = ''; try { v = localStorage.getItem(def.ls) || def.def; } catch (e) { v = def.def; }
      f.value = v;
    });
  }

  /* ── v1098 · Luecke im Zuruecksetzen, gemessen ────────────────────────
     _dpDispReset (settings.js:3116) raeumt acht Schluessel weg, aber NICHT
     dp_kpi_ui, dp_obj_ui, dp_hero_ui, dp_tabtext_ui und dp_objtext_ui —
     die fuenf Karten- und Textfarben bleiben stehen und werden beim
     naechsten Start aus dem Boot-Block (settings.js:3213) wieder gesetzt.
     "Zuruecksetzen" hat also nie ganz zurueckgesetzt.

     Behoben per Umhuellung statt im neuen Panel umgangen: so ist der
     Defekt in BEIDEN Panels weg und settings.js bleibt unangetastet. */
  function resetUmhuellen() {
    if (window.__dpuvResetHook) return;
    var orig = window._dpDispReset;
    if (typeof orig !== 'function') return;
    window.__dpuvResetHook = true;
    window._dpDispReset = function () {
      try {
        ['dp_kpi_ui', 'dp_obj_ui', 'dp_hero_ui', 'dp_tabtext_ui', 'dp_objtext_ui']
          .forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
        ['--dp-kpi-card', '--dp-obj-card', '--dp-hero-card', '--dp-tab-text', '--dp-obj-text']
          .forEach(function (v) { document.body.style.removeProperty(v); });
        bereicheRaeumen();          /* v1104: auch den eigenen Namensraum */
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  }

  /* ── v1101 · Die Logo-Regler unter einer Vorlage ──────────────────────
     GEMESSEN, und es ist ein Fehler von v1082:

       ohne Vorlage   Groesse 60% -> Logo 159x29, 140% -> 266x49   wirkt
       mit "konsole"  Groesse 60% -> 130x24, 140% -> 130x24        tot
                      Ausrichtung left/right -> justify bleibt flex-start

     Ursache sind meine eigenen Regeln aus dem kompakten Logo-Kopf:
       height: calc(26px * var(--dp-logo-scale, 1))   <- setzt NIEMAND
       justify-content: flex-start !important          <- haelt den Regler fest

     Der Kommentar daneben behauptete sogar "der Groessenregler bleibt
     wirksam: --dp-logo-w skaliert die Hoehe mit". Das war falsch: der
     Regler setzt --dp-logo-w (eine Breite in Prozent), gelesen wurde
     --dp-logo-scale. Zwei Namen, kein Bezug.

     Und es ist DERSELBE Fehler wie in v1080 ("justify-content stand fest
     auf center und hat den Ausrichtungs-Regler still totgelegt") — nur
     eine Ebene hoeher, in der Vorlage statt im Grundstil.

     Behoben ohne settings.js anzufassen: die beiden globalen Handler
     werden umhuellt und setzen zusaetzlich zwei Variablen, die die
     Vorlagenregeln lesen koennen — --dp-logo-scale als reine ZAHL (px mal
     Zahl geht in jedem Browser, anders als eine Division durch Prozent)
     und --dp-logo-justify als flex-tauglicher Wert. */
  function logoUmhuellen() {
    if (window.__dpuvLogoHook) return;
    window.__dpuvLogoHook = true;
    var JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };
    function scaleSetzen(v) {
      var z = parseFloat(v);
      if (!isFinite(z) || z <= 0) z = 100;
      document.body.style.setProperty('--dp-logo-scale', String(z / 100));
    }
    function justifySetzen(a) {
      document.body.style.setProperty('--dp-logo-justify', JUSTIFY[a] || 'flex-start');
    }
    var origSize = window._dpDispLogoSize;
    if (typeof origSize === 'function') {
      window._dpDispLogoSize = function (v) { var r = origSize.apply(this, arguments); scaleSetzen(v); return r; };
    }
    var origAlign = window._dpDispLogoAlign;
    if (typeof origAlign === 'function') {
      window._dpDispLogoAlign = function (a) { var r = origAlign.apply(this, arguments); justifySetzen(a); return r; };
    }
    var origLogoReset = window._dpDispLogoReset;
    if (typeof origLogoReset === 'function') {
      window._dpDispLogoReset = function () {
        var r = origLogoReset.apply(this, arguments);
        document.body.style.removeProperty('--dp-logo-scale');
        document.body.style.removeProperty('--dp-logo-justify');
        return r;
      };
    }
    /* Beim Start einmal nachziehen — settings.js:3293 liest die alten
       Schluessel schon selbst, die neuen Variablen kennt es nicht. */
    try {
      var w = localStorage.getItem('dp_logo_w'); if (w) scaleSetzen(w);
      var al = localStorage.getItem('dp_logo_align'); if (al) justifySetzen(al);
    } catch (e) {}
  }

  /* ── v1102 · Die drei Chrome-Farben ueberlebten das Neuladen nicht ─────
     GEMESSEN: der Boot-Block in settings.js:3213 stellt nur drei der sechs
     Bereichsfarben wieder her —

       var m = {dp_kpi_ui:'--dp-kpi-card', dp_obj_ui:'--dp-obj-card',
                dp_hero_ui:'--dp-hero-card'}

     dp_hdr_ui, dp_side_ui und dp_text_ui fehlen dort. Wer die Kopfleiste
     oder die Objektleiste einfaerbt, sieht die Farbe bis zum naechsten
     Neuladen — danach ist sie weg, obwohl sie gespeichert IST. Das war
     schon vor dem Zusammenlegen so und faellt jetzt auf, weil die Regler
     im neuen Panel ueberhaupt erst wirken (siehe ui-varianten.css). */
  function chromeFarbenBooten() {
    var m = { dp_hdr_ui: '--dp-header-bg', dp_side_ui: '--dp-side-bg', dp_text_ui: '--dp-text' };
    Object.keys(m).forEach(function (k) {
      try { var v = localStorage.getItem(k); if (v) document.body.style.setProperty(m[k], v); } catch (e) {}
    });
  }

  /* ── v1104 · Ein eigener Namensraum fuer die Bereichsfarben ───────────
     v1102 liess die Flaechen var(--dp-header-bg, var(--uv-chrome)) lesen.
     Das war falsch, und der Fehler war im Bild sofort da: beim Wechsel
     UEBER DAS PANEL wurden Kopf und Tab-Leiste in allen vier hellen
     Vorlagen schwarz.

     GEMESSEN, warum: --dp-header-bg hat ZWEI Bedeutungen. Der Regler setzt
     ihn als Nutzerwert inline am body — aber style.css setzt ihn auch
     selbst:

       body.dp-chrome-hell { --dp-header-bg: #0a0a0a }   (v927-headerblack)

     Und v1085 koppelt den Skin an die Vorlage, eine helle Vorlage schaltet
     also dp-chrome-hell ein. Mein "Nutzer-Vorrang" las damit den
     Skin-Wert. Ueber setAttribute war nichts zu sehen, weil dabei kein
     Skin nachgezogen wird — nur der echte Bedienweg zeigte es.

     Deshalb bekommen die Bereichsfarben einen eigenen Namen: --dpuv-*.
     Den setzt ausschliesslich der Regler, niemand sonst. Die alten
     --dp-*-Tokens werden weiter mitgeschrieben, damit der Hell-Skin und
     der Mandanten-Abgleich unveraendert weiterlaufen. */
  var BEREICH_VARS = {
    _dpDispHeader: '--dpuv-header-bg',
    _dpDispSide:   '--dpuv-side-bg',
    _dpDispText:   '--dpuv-text',
    _dpDispKpi:    '--dpuv-kpi-card',
    _dpDispObj:    '--dpuv-obj-card',
    _dpDispHero:   '--dpuv-hero-card'
  };
  var BEREICH_LS = {
    dp_hdr_ui:     '--dpuv-header-bg',
    dp_side_ui:    '--dpuv-side-bg',
    dp_text_ui:    '--dpuv-text',
    dp_kpi_ui:     '--dpuv-kpi-card',
    dp_obj_ui:     '--dpuv-obj-card',
    dp_hero_ui:    '--dpuv-hero-card'
  };
  function bereicheUmhuellen() {
    if (window.__dpuvBereichHook) return;
    window.__dpuvBereichHook = true;
    Object.keys(BEREICH_VARS).forEach(function (fn) {
      var orig = window[fn];
      if (typeof orig !== 'function') return;
      window[fn] = function (h) {
        var r = orig.apply(this, arguments);
        try { if (h) document.body.style.setProperty(BEREICH_VARS[fn], h); } catch (e) {}
        return r;
      };
    });
    /* Beim Start aus den gespeicherten Werten nachziehen. */
    Object.keys(BEREICH_LS).forEach(function (k) {
      try { var v = localStorage.getItem(k); if (v) document.body.style.setProperty(BEREICH_LS[k], v); } catch (e) {}
    });
  }
  /* Der Rueckbau muss die neuen Namen mitnehmen — sonst bliebe die Farbe
     nach "Zuruecksetzen" stehen, obwohl der Schluessel weg ist. */
  function bereicheRaeumen() {
    Object.keys(BEREICH_LS).forEach(function (k) {
      try { document.body.style.removeProperty(BEREICH_LS[k]); } catch (e) {}
    });
  }

  function targetUmhuellen() {
    if (window.__dpuvTargetHook) return;          /* Waechter gegen Ringschluss */
    var orig = window._dpDispTarget;
    if (typeof orig !== 'function') return;
    window.__dpuvTargetHook = true;
    window._dpDispTarget = function (t) {
      var r;
      try { r = orig.apply(this, arguments); } catch (e) {}
      /* _dpDispTarget laedt ueber das Netz und faerbt erst danach um —
         deshalb nicht sofort, sondern nachgelagert auffrischen. */
      [120, 600, 1400].forEach(function (ms) { setTimeout(markeAuffrischen, ms); });
      return r;
    };
  }

  function oeffnen() {
    bauen();
    gateSetzen();
    markeAuffrischen();      /* v1098: Reseller-Zustand und Logo sind aeusserer Zustand */
    targetUmhuellen();       /* v1098: erst hier, damit reseller-portal.js sicher geladen ist */
    resetUmhuellen();
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

  /* ── Kopplung an den Skin-Schalter ────────────────────────────────────
     v1085 · Backlog: "Der Skin-Schalter Hell/Obsidian existiert bereits
     separat. Entweder er verschwindet, oder er wird an die Darstellung
     gekoppelt. Sonst laufen beide auseinander."

     ENTSCHIEDEN: koppeln, NICHT loeschen. Drei Gruende:
       * body.dp-chrome-hell traegt 105 gewachsene Regeln. Die zu entfernen
         waere ein eigenes Vorhaben mit eigener Pruefstrecke, kein Nebenzug.
       * darstellung-reseller.js:29 und mandant-branding.js:156 rufen
         _dpDispSkin, um die Marke eines Partners an dessen Mandanten
         durchzureichen. Faellt die Funktion weg, bricht das Whitelabel.
       * Gemessen stoeren sich beide nicht — html[data-ui-theme] (0,2,1)
         liegt ueber body.dp-chrome-hell (0,2,0), die Vorlage gewinnt. Das
         Problem ist nicht Kollision, sondern AUSEINANDERLAUFEN: "Hell"
         schalten und "Konsole" waehlen ergab Konsole, der Schalter wirkte
         folgenlos.

     Ab hier gibt es eine Wahrheit: Skin und Vorlage ziehen einander nach.
     Umhuellt wird nach dem Muster aus settings.js:3469 — das Verhalten der
     Originalfunktion bleibt unangetastet, es kommt nur etwas dahinter. */
  var HELLE = ['kontor', 'panel', 'kanzlei', 'boarding'];
  var _sync = false;   /* Waechter: sonst rufen sich beide Seiten im Kreis */

  function istHell(theme) { return HELLE.indexOf(theme) >= 0; }

  /* Vorlage -> Skin-Merker nachziehen. */
  function skinNachziehen() {
    if (_sync) return;
    var theme = get('ui_theme', THEMES);
    var soll = istHell(theme) ? 'hell' : 'obsidian';
    var ist = '';
    try { ist = (localStorage.getItem('dp_chrome_hell') === '1') ? 'hell' : 'obsidian'; } catch (e) {}
    if (soll === ist) return;
    _sync = true;
    try { if (typeof window._dpDispSkin === 'function') window._dpDispSkin(soll); } catch (e) {}
    _sync = false;
  }

  /* Skin -> Vorlage nachziehen. Nur wenn die aktuelle Vorlage der neuen
     Helligkeit widerspricht — wer "Hell" schaltet und schon auf "Panel"
     steht, soll Panel behalten und nicht nach Kontor geworfen werden. */
  function vorlageNachziehen(hell) {
    if (_sync) return;
    var theme = get('ui_theme', THEMES);
    if (hell && istHell(theme)) return;
    if (!hell && !istHell(theme)) return;
    _sync = true;
    save({ ui_theme: hell ? 'kontor' : '' });
    anwenden();
    _sync = false;
    /* Wenn das Panel offen ist, muss die Markierung mitgehen — sonst zeigt
       es eine Vorlage an, die nicht mehr gilt. */
    try {
      var host = document.getElementById('dpuv-theme');
      if (host) {
        var jetzt = get('ui_theme', THEMES);
        host.querySelectorAll('.dpuv-sgb').forEach(function (x) {
          x.classList.toggle('on', (x.getAttribute('data-v') || '') === jetzt);
        });
      }
    } catch (e) {}
  }

  (function koppeln() {
    var alt = window._dpDispSkin;
    if (typeof alt !== 'function') return;
    window._dpDispSkin = function (v) {
      var r = alt.apply(this, arguments);
      try { vorlageNachziehen(v === 'hell'); } catch (e) {}
      return r;
    };
  })();

  /* ── Boot ─────────────────────────────────────────────────────────────
     Die Attribute so frueh wie moeglich setzen. Der Inline-Boot im <head>
     von index.html macht das bereits vor dem ersten Paint; dieser Aufruf
     ist das zweite Netz, falls der Inline-Boot einmal fehlt. */
  anwenden();

  /* v1101: Die Logo-Umhuellung muss beim START laufen, nicht erst beim
     Oeffnen des Panels — die gespeicherte Groesse und Ausrichtung wirken
     ja sofort, nicht erst wenn jemand die Einstellungen aufmacht.
     settings.js baut seine Handler beim Laden auf; diese Datei laedt
     danach, der Zugriff ist also sicher. */
  /* v1102c: resetUmhuellen gehoert ebenfalls hierher, NICHT nach oeffnen().
     GEMESSEN: _dpDispReset vor dem ersten Oeffnen des Panels gerufen liess
     dp_obj_ui, dp_kpi_ui und dp_hero_ui stehen — die Umhuellung, die genau
     diese Luecke schliesst (v1098), war zu dem Zeitpunkt noch nicht
     installiert. Ein Rueckbau muss aber immer vollstaendig sein, egal von
     wo er ausgeloest wird. */
  function startAufbau() { logoUmhuellen(); chromeFarbenBooten(); bereicheUmhuellen(); resetUmhuellen(); }
  if (document.body) startAufbau();
  else document.addEventListener('DOMContentLoaded', startAufbau);

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
