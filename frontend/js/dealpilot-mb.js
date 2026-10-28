'use strict';
/* W31-wl-token: Whitelabel-Farbe zur Laufzeit aufloesen.
   Canvas und SVG-Praesentationsattribute verstehen KEIN var() — dort geht es nur so.
   Ohne Whitelabel liefert _wlc() das Literal zurueck -> Optik unveraendert.
   Idempotent global: mehrere Module duerfen das laden. */
if (!window._wlc) {
  window._wlc = function (h) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--wl-' + h.slice(1).toLowerCase());
      v = (v || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    } catch (e) {}
    return h;
  };
  window._wlrgba = function (a) {
    var h = window._wlc('#C9A84C');
    return 'rgba(' + parseInt(h.substr(1, 2), 16) + ',' + parseInt(h.substr(3, 2), 16) + ',' + parseInt(h.substr(5, 2), 16) + ',' + a + ')';
  };
}

/* ============================================================================
   v542 · DealPilot-Marktbewertung — Objekt-Tab (eigenstaendiges Render)
   ----------------------------------------------------------------------------
   Freigegebenes Layout: volle Breite, Tachos links (gross), rechte Steuer-Rail
   mit Spanne (Unten/Ø/Oben) + "In Felder übernehmen", Spanne in Zahlen (weiss)
   unter jedem Tacho, einklappbar per Chevron (wie PriceHubble/Sprengnetter).
   Eigenes gescoptes CSS (Praefix dpx-) -> keine Kollision; schmale Basis-Karte
   (marktbewertung-card) bleibt fuer QC/Modul unberuehrt.
   Abruf: v539-Proxy /reports/from-dealpilot (fast=2 L). Snapshot -> #_mb_state
   (JSONB) fuer Pilot-Analyse + Restore.
   Übernehmen: Marktwert->#svwert (Verkehrswert), Marktmiete €/m²->#ds2_marktmiete
   (wie applyAvm; #nkm wird NICHT angefasst).
   ============================================================================ */
(function (global) {
  var HOST_ID = 'dp-mb-host';
  var STATE_ID = '_mb_state';
  var GC = { cx: 52, cy: 50, r: 39 };
  var GID = 0;
  var D = null;          // gemappte Kartendaten
  var mode = 'med';      // low | med | high
  var collapsed = false;
  var lastJson = '';
  var gz = {};           // gauge hosts

  /* ── Helfer ── */
  function tok() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function $(id) { return document.getElementById(id); }
  function vIn(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function numDe(x) { if (x == null || x === '') return null; var n = parseFloat(String(x).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isNaN(n) ? null : n; }
  function fmt0(n) { try { return new Intl.NumberFormat('de-DE').format(Math.round(n)); } catch (e) { return String(Math.round(n)); } }
  function deNum(n, d) { try { return new Intl.NumberFormat('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(n); } catch (e) { return String(n); } }
  function eur(n) { return fmt0(n) + ' €'; }
  function toast(m) { try { if (typeof global.toast === 'function') return global.toast(m); } catch (e) {} try { console.log('[dp-mb]', m); } catch (e) {} }

  /* ── CSS einmalig injizieren (Praefix dpx-) ── */
  function injectCss() { /* v751-light */
    if ($('dpx-style')) return;
    var css =
      '#' + HOST_ID + '{width:100%;margin-top:14px}' +
      '.dpx{display:flex;flex-direction:column;border:1px solid var(--wl-ece2c8, #ece2c8);border-left:5px solid #0c0b09;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 6px 20px -13px rgba(110,82,18,.45);font-family:"Inter",system-ui,sans-serif}' +
      '.dpx *{box-sizing:border-box}' +
      /*v877-no-hatch*/'.dpx .dpx-head{position:relative;display:flex;align-items:center;gap:9px;height:46px;padding:0 14px;overflow:hidden;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 58%,var(--wl-b8932f, #b8932f))}' +
      '.dpx .dpx-head::after{content:"";position:absolute;inset:0;background:linear-gradient(157deg,rgba(255,255,255,.5),rgba(255,255,255,0) 46%)}' +
      '.dpx .dpx-head>*{position:relative;z-index:1}' +
      '.dpx .dpx-logo{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:15px}.dpx .dpx-logo .d{color:#0c0b09}.dpx .dpx-logo .p{color:#0c0b09}' +
      '.dpx .dpx-eyebrow{font:800 10px/1 "Space Grotesk",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#5c4a18}' +
      '.dpx .dpx-conf{margin-left:auto;font:700 10px/1 "JetBrains Mono",monospace;color:var(--wl-e8cc7a, #E8CC7A);background:#0c0b09;border-radius:999px;padding:4px 10px;white-space:nowrap}' +
      '#' + HOST_ID + ' .dpx-chev{width:26px;height:26px;border:1px solid rgba(12,11,9,.3)!important;border-radius:7px;background:rgba(12,11,9,.08)!important;color:#0c0b09!important;display:grid;place-items:center;cursor:pointer;flex:0 0 auto}#' + HOST_ID + ' .dpx-chev svg{transition:transform .25s}#' + HOST_ID + ' .dpx.collapsed .dpx-chev svg{transform:rotate(180deg)!important}' +
      '.dpx .dpx-perf{position:relative;height:0;border-top:1.5px dashed color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 55%, transparent);margin:0 12px}' +
      '.dpx .dpx-body{display:flex;flex-direction:column;padding:12px 14px 0}' +
      '.dpx .dpx-vals{display:flex;gap:14px}' +
      '.dpx .dpx-vb{flex:1;min-width:0}' +
      '.dpx .dpx-lab{font:700 7px/1 "Space Grotesk",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#a59c86}' +
      '.dpx .dpx-val{font-family:"Cormorant Garamond",Georgia,serif;font-size:24px;font-weight:700;line-height:1;margin-top:4px;color:#2A2727}' +
      '.dpx .dpx-mw .dpx-val{background:linear-gradient(110deg,var(--wl-b8932f, #b8932f),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-9a7f33, #9a7f33));-webkit-background-clip:text;background-clip:text;color:transparent}' +
      '.dpx .dpx-sqm{font:9.5px/1.3 "JetBrains Mono",monospace;color:#7A7370;margin-top:4px;min-height:13px;display:block}' +
      '.dpx .dpx-spn{font:10px/1.3 "JetBrains Mono",monospace;color:#7A7370;margin-top:5px}.dpx .dpx-spn .l{font:700 7px/1 "Space Grotesk",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#a59c86;margin-right:5px}.dpx .dpx-spn .sel{color:var(--wl-9a7f33, #9a7f33);font-weight:800}.dpx .dpx-spn .sep{margin:0 4px;opacity:.5}' +
      '.dpx .dpx-f3{display:flex;gap:7px;margin-top:11px}' +
      '.dpx .dpx-fi{flex:1;border:1px solid var(--wl-efe7d2, #efe7d2);border-radius:9px;padding:6px 8px;min-width:0;background:#fffdf8}' +
      '.dpx .dpx-fi .k{font:700 6.5px/1 "Space Grotesk",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#a59c86}' +
      '.dpx .dpx-fi .v{font:700 11px/1.25 "JetBrains Mono",monospace;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#2A2727}' +
      '.dpx .dpx-lage{margin-top:11px;min-height:26px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
      '.dpx .dpx-lchip{font:700 9.5px/1 "JetBrains Mono",monospace;padding:4px 9px;border-radius:999px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 14%, transparent);color:var(--wl-9a7f33, #9a7f33)}' +
      '.dpx .dpx-spanrow{display:flex;align-items:center;gap:8px;margin-top:12px}' +
      '.dpx .dpx-spanlbl{font:600 11px/1 "DM Sans",sans-serif;color:#6b6660}' +
      '#' + HOST_ID + ' .dpx-seg{display:inline-flex;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);border-radius:11px;overflow:hidden;background:rgba(248,246,241,.7)}#' + HOST_ID + ' .dpx-seg button{appearance:none;border:0;background:transparent;padding:7px 13px;font:600 12.5px/1 "DM Sans",sans-serif;color:#6b6660!important;cursor:pointer}#' + HOST_ID + ' .dpx-seg button+button{border-left:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 25%, transparent)}#' + HOST_ID + ' .dpx-seg button.on{background:linear-gradient(180deg,var(--wl-d4b65a, #d4b65a),var(--wl-bd9c3f, #bd9c3f))!important;color:#fff!important}' +
      '.dpx .dpx-foot{display:flex;align-items:center;gap:10px;padding:12px 14px 6px}' +
      '#' + HOST_ID + ' .dpx-apply{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none!important;border-radius:11px;padding:9px 14px;font:700 12px/1 "DM Sans",sans-serif;color:#2c2410!important;cursor:pointer;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 60%,var(--wl-b8932f, #b8932f))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 4px 13px -7px rgba(160,120,20,.55)}.dpx .dpx-apply svg{width:14px;height:14px;flex:0 0 auto}' +
      '.dpx .dpx-legal{padding:7px 14px 12px;font:9px/1.3 "JetBrains Mono",monospace;color:#b3ab98;text-align:center}' +
      '.dpx.collapsed .dpx-perf,.dpx.collapsed .dpx-body,.dpx.collapsed .dpx-foot,.dpx.collapsed .dpx-legal{display:none}';
    var st = document.createElement('style'); st.id = 'dpx-style'; st.textContent = css; document.head.appendChild(st);
  }

  /* Tacho-Helfer unten bleiben definiert (im hellen Layout ungenutzt) */
  function pt(cx, cy, r, d) { var a = d * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
  function arc(cx, cy, r, d1, d2) { var p1 = pt(cx, cy, r, d1), p2 = pt(cx, cy, r, d2); return 'M ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' A ' + r + ' ' + r + ' 0 0 1 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1); }
  function tachoSvg() {
    var cx = GC.cx, cy = GC.cy, r = GC.r, fid = 'dpxf' + (GID++);
    return '<svg viewBox="0 0 104 60"><defs><filter id="' + fid + '" filterUnits="userSpaceOnUse" x="-4" y="-4" width="112" height="68"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<path d="' + arc(cx, cy, r, 180, 124) + '" stroke="#D9685F" stroke-width="6.5" fill="none" stroke-linecap="round" filter="url(#' + fid + ')"/>' +
      '<path d="' + arc(cx, cy, r, 118, 62) + '" stroke="' + window._wlc('#D9B45A') + '" stroke-width="6.5" fill="none" stroke-linecap="round" filter="url(#' + fid + ')"/>' +
      '<path d="' + arc(cx, cy, r, 56, 0) + '" stroke="#43B77C" stroke-width="6.5" fill="none" stroke-linecap="round" filter="url(#' + fid + ')"/>' +
      '<line class="ndl" x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - (r - 4)) + '" stroke="#fff" stroke-width="2.8" stroke-linecap="round" filter="url(#' + fid + ')"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + window._wlc('#C9A84C') + '" stroke="#040405" stroke-width="2"/><circle cx="' + cx + '" cy="' + cy + '" r="1.9" fill="#fff"/></svg>';
  }
  function setNeedle(h, frac) { if (!h) return; var ln = h.querySelector('.ndl'); if (!ln) return; var p = pt(GC.cx, GC.cy, GC.r - 4, 172 - Math.max(0, Math.min(1, frac)) * 164); ln.setAttribute('x2', p[0].toFixed(2)); ln.setAttribute('y2', p[1].toFixed(2)); }
  function countUp(el, to) { if (!el) return; var from = el._cur || 0, t0 = performance.now(); (function s(t) { var p = Math.min(1, (t - t0) / 650), e = 1 - Math.pow(1 - p, 3); el.textContent = eur(from + (to - from) * e); if (p < 1) requestAnimationFrame(s); else el._cur = to; })(performance.now()); }

  /* ── beweglicher Partikel-Hintergrund (aus Original-Karte portiert) ── */
  function particles(canvas) {
    if (!canvas || canvas._dpxOn) return; canvas._dpxOn = true;
    var x = canvas.getContext('2d'); var w, h, ps; var DP = Math.min(2, global.devicePixelRatio || 1);
    function size() { var r = canvas.getBoundingClientRect(); /* v635-canvas-guard: plausibilitaetspruefung gegen 67M-Canvas (Infinity/NaN/Riesenwerte) */ if (!r.width || !r.height || !isFinite(r.width) || !isFinite(r.height) || r.width > 4000 || r.height > 4000) return; w = r.width; h = r.height; canvas.width = Math.max(1, Math.min(4000, Math.round(w * DP))); canvas.height = Math.max(1, Math.min(4000, Math.round(h * DP))); x.setTransform(DP, 0, 0, DP, 0, 0);
      var n = Math.max(12, Math.min(34, Math.floor(w * h / 9000))); ps = Array.from({ length: n }, function () { return { x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .15, vy: (Math.random() - .5) * .15, r: Math.random() * 1.3 + .4, o: Math.random() * .5 + .16, g: Math.random() > .45 }; }); }
    function loop() {
      if (!canvas.isConnected) { canvas._dpxOn = false; return; } // gestoppt, wenn Karte ersetzt
      if (w) { x.clearRect(0, 0, w, h);
        for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++) { var a = ps[i], b = ps[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy); if (d < 76) { x.strokeStyle = window._wlrgba((1 - d / 76) * .12); x.lineWidth = .55; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } }
        for (var k = 0; k < ps.length; k++) { var p = ps[k]; p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fillStyle = p.g ? 'rgba(232,199,102,' + p.o + ')' : 'rgba(205,205,215,' + (p.o * .45) + ')'; x.fill(); } }
      requestAnimationFrame(loop);
    }
    if ('ResizeObserver' in global) new ResizeObserver(size).observe(canvas); else global.addEventListener('resize', size);
    size(); loop();
  }

  /* ── Daten ── */
  function objId() {
    /* v942-objid
     * ────────────────────────────────────────────────────────────────────
     * BUG bis v941: bmf-modal.js:53 deklariert `function _currentObjectId()`
     * auf oberster Ebene -> window._currentObjectId IST die Funktion. Eine
     * Funktion ist immer truthy, also gewann sie hier -> String(fn) lieferte
     * ihren QUELLTEXT. 65 Snapshots in mb.object_snapshots trugen als
     * object_key `dp:function _currentObjectId(){...}`, alle Objekte in
     * einem Topf, der Marktwert-Verlauf zeigte die Vermischung.
     * FIX: _currentObjKey zuerst (das ist laut Projekt-Invariante das
     * EINZIGE verlaessliche Global und fehlte hier komplett), und alles,
     * was keine brauchbare Zeichenkette ist, fliegt raus.
     */
    if (typeof global._currentObjKey === 'string' && global._currentObjKey) return global._currentObjKey;
    var c = [global.currentObjectId, global._currentObjectId, global.currentObjId, (global.State && (global.State.objectId || global.State.id))];
    for (var i = 0; i < c.length; i++) {
      var v = c[i];
      if (typeof v === 'function' || typeof v === 'object') continue;
      if (v == null || v === '') continue;
      var s = String(v);
      if (!s || s.indexOf('function') === 0) continue;
      return s;
    }
    var el = $('obj-id') || $('object-id'); if (el && el.value) return String(el.value);
    return null;
  }
  /* v1444 · Backlog v22 Punkt 17/18: die Karte schickte 8 Felder - ohne Zustand
     rechnete die Marktpreisindikation jedes Objekt als „gepflegt", ohne Ausstattung
     als „normal". Der DealPilotObjectMapper versteht das ganze Objekt; mit geht,
     was im Formular steht (leere Felder nicht). */
  var ZUSATZ = ['ds2_zustand', 'ausst', 'ds2_energie', 'modernis', 'gsfl', 'einheiten', 'zimmer', 'etage', 'vermstand',
    'eq_heating', 'eq_windows', 'eq_floor', 'eq_bath', 'eq_guest_wc', 'eq_store_room', 'eq_walls', 'eq_roof', 'eq_elevator',
    /* v1851 · N4: alles, was der Mapper seit v1851 liest - vorher kam vom
       Block Wertermittlung KEIN Feld an (gemessen 04.10.2026). Dazu nkm, brw,
       mea und das Erbbaurecht, die der Mapper schon immer las und die die
       Karte nie schickte. */
    'nkm', 'brw', 'mea', 'erbpacht', 'erbbauzins', 'erb_restlz', 'nutzungsart', 'garagen', 'stellpl_aussen', 'balkon_flae', 'bad_anz',
    'baustatus', 'bgf', 'standardstufe', 'grundriss', 'mod_punkte', 'sachwertfaktor', 'uk_flaeche' /* v2282 */, 'wgfz_objekt' /* v2361 */, 'vgf_wohnlage', 'vgf_ausstattung' /* v3008 */, 'nhk_haus', 'nhk_geschosse', 'nhk_dach',
    'hinterland_qm', 'hinterland_eur_qm', 'hinterland_rentierlich', 'garagen_bgf_qm', 'garagen_stufe', 'aussenanlagen_pct', 'aussenanlagen',
    'ausst_aussenwaende', 'ausst_dach', 'ausst_fenster', 'ausst_innenwaende', 'ausst_decken', 'ausst_fussboeden', 'ausst_sanitaer', 'ausst_heizung', 'ausst_technik',
    'bes_bauteile', 'btl_gauben', 'btl_balkone', 'btl_vordach', 'btl_terrassen', 'btl_sonstige',
    'lzs_pct', 'brw_anpassung_pct', 'brw_anpassung_grund', 'stellplatz_miete_monat',
    'wertermittlungsstichtag' /* v3010 · leer = heute; der Mapper laesst nur JJJJ-MM-TT durch */,
    'mikrolage', 'makrolage', 'ds2_bevoelkerung', 'ds2_nachfrage', 'ds2_entwicklung', 'ds2_wertsteigerung', 'ds2_mietausfall',
    /* v2241 · Die acht Bauteile der Anlage 2. Ohne sie zaehlte der Mapper
       `mod_angaben` immer 0 — und 0 Punkte aus acht Antworten „Keine/Nie"
       (ein Befund) sahen aus wie „nichts erfasst" (eine Luecke). Leere
       Auswahl („– keine Angabe –") reist weiter NICHT mit. */
    'mod_dach', 'mod_fenster', 'mod_leitungen', 'mod_heizung', 'mod_aussenwand', 'mod_baeder', 'mod_innenausbau', 'mod_grundriss',
    /* v2241 · Sanierungskosten (Reiter Investition) — im Bericht als
       besonderes objektspezifisches Grundstuecksmerkmal (§ 8 Abs. 3
       ImmoWertV) nach der Marktanpassung abgezogen. `san_ust` sagt, ob
       der Betrag brutto oder netto eingetragen ist. */
    'san', 'san_ust',
    /* v2952 · Kaufdatum: ab zwölf Monaten Bestand gilt die Ankauf-Sanierung als ausgeführt (Mapper bomAus) */
    'kaufdat',
    /* v2988 · Kann-Feld „Sanierung ausgeführt am": gesetzt entscheidet das Datum über den bOM (Mapper sanStatus) */
    'san_ausgefuehrt',
    /* v2660 · E7: Etagen im Gebaeude (Umrechnung des Immobilienrichtwerts); E2: Restlaufzeit der Mietabweichung am Einzelobjekt */
    'etagen_ges', 'mv_befristet_bis', 'mv_kuendigungsverzicht_bis', 'mv_abw_jahre'];
  function inputs() {
    var o = { plz: vIn('plz'), ort: vIn('ort'), str: vIn('str'), hnr: vIn('hnr'), objektart: vIn('objart'), objart: vIn('objart'), wfl: numDe(vIn('wfl')), baujahr: numDe(vIn('baujahr')), kp: numDe(vIn('kp')) };
    var art = String(o.objart || '').toUpperCase(), OA = window.DealPilotObjektart;
    ZUSATZ.forEach(function (id) {
      var el = $(id);
      /* v1851: ein Haekchen hat .value "on", ob gesetzt oder nicht - der
         Mapper liest `erbpacht` als Wahrheit und haette JEDES Objekt zum
         Erbbaurecht gemacht. Nur ein gesetztes Haekchen reist mit. */
      if (el && el.type === 'checkbox') { if (el.checked) o[id] = true; return; }
      var v = vIn(id); if (v == null || String(v).trim() === '') return;
      if (OA && OA.passt && OA.passt(art, id) === false) return;   /* v1437: nur was zur Art passt */
      /* v3027 · Mit erfassten Einheiten (mind. 2) gelten deren Verträge - die ausgeblendeten
         Objekt-Mietvertragsfelder bleiben gespeichert, rechnen aber nicht mit. */
      if (/^mv_/.test(id) && window.DealPilotMietvertragObjekt && window.DealPilotMietvertragObjekt.einheitenGelten()) return;
      o[id] = v;
    });
    /* v2210 · Die Einheiten des MFH-Konfigurators reisten nie mit - der
       Bericht kannte nur ihre ANZAHL. Damit bekam eine Gewerbeflaeche den
       Wohnmietansatz. Jetzt geht eine schlanke Liste mit (kein Bild, kein
       Mietername): Art, Flaeche, Ist/Soll, Status, Gewerbe-Nutzung, Marktmiete. */
    try {
      var m = window._dpMfh;
      if (m && Array.isArray(m.einheiten) && m.einheiten.length) {
        o._mfh_einheiten = m.einheiten.map(function (e) {
          /* v2820 · Nummer und Lage reisen mit: ohne sie nannte die Nutzungsart-Nachfrage
                   im Bericht „GE 1" statt der Einheit, wie sie im Formular heisst */
          return { nr: e.nr || null, lage: e.lage || null, art: e.art || 'wohnen', wfl: e.wfl, ist: e.ist, soll: e.soll, status: e.status || 'vermietet',
                   nutzung_gew: e.nutzung_gew || null, markt_qm: e.markt_qm || null,
                   /* v2600 · E2/E3 · Restlaufzeit der Mietabweichung, waehlbarer Leerstandsabzug */
                   mv_art: e.mv_art || null, mv_befristet_bis: e.mv_befristet_bis || null, mv_kuendigungsverzicht_bis: e.mv_kuendigungsverzicht_bis || null,
                   mv_abw_jahre: e.mv_abw_jahre || null, leer_abzug: e.leer_abzug === true, leer_monate: e.leer_monate || null, herrichtung_eur: e.herrichtung_eur || null };
        });
      }
    } catch (e) {}
    /* v2483 · beim MFH mit erfassten Einheiten sind DEREN flaechengewichtete Punkte die
       Punkte des Hauses (Anlage 2) - auch wenn das Feld mod_punkte noch den alten Stand
       traegt (gespeichert vor v2483, oder nach einer Aenderung der acht mod_*-Felder).
       Eine Punktzahl, eine Restnutzungsdauer: Bericht, Wertpotenzial, Mieterliste. */
    try {
      var _hp = (window.DpMfhEinheiten && typeof window.DpMfhEinheiten.hausPunkte === 'function') ? window.DpMfhEinheiten.hausPunkte() : null;
      if (_hp && _hp.punkte != null) o.mod_punkte = String(_hp.punkte);
    } catch (e) {}
    /* v2367 · eigener Abschlag auf Angebotspreise (Investmentprofil) - nur wenn gesetzt;
       sonst waehlt der Marktbericht selbst (oertliche Kauffaelle oder Marktdurchschnitt). */
    /* v2490 · eine Stelle fuer beide Abrufe: DealPilotAbschlag.eigen() (auch im QC-iframe) */
    try { var _A = window.DealPilotAbschlag, _ab = (_A && _A.eigen) ? _A.eigen() : null;
      if (_ab != null) o.angebot_abschlag_pct = _ab; } catch (e) {}
    return o;
  }

  function mapCard(d) {
    d = d || {};
    var mv = (d.valuation && d.valuation.market_value) || {};
    var rent = d.rent || {};
    var vin = (d.valuation && d.valuation.inputs) || {};
    var area = (d.ref && d.ref.living_area) || numDe(vIn('wfl')) || 0;
    var out = { area: area };
    /* v2254: aus welcher Stufe die Karte stammt (1/2 Indikation, 3 Wertermittlung) */
    out.stufe = Number((d.ref && d.ref.wert_stufe) || (d.meta && d.meta.wert_stufe) || d.wert_stufe || 0) || null;
    out.rating = (d.deal_score && d.deal_score.rating) ? d.deal_score.rating : 'Indikation';
    out.conf = { label: mv.confidence_label || 'Indikation', pct: mv.confidence_pct != null ? mv.confidence_pct : 0 };
    /* v746-mikro-label: Label (wie Pilot) + Score auf 0-10-Skala statt Rohwert 0-100 */
    function _v746lbl(raw) {
      if (raw == null) return '–';
      var s = raw / 10;
      var w = s >= 8 ? 'Sehr gut' : s >= 6 ? 'Gut' : s >= 4 ? 'Durchschnittlich' : s >= 2 ? 'Schwach' : 'Sehr schwach';
      return w + ' · ' + s.toFixed(1).replace('.', ',');
    }
    out.mikro = (d.micro && d.micro.score != null) ? _v746lbl(d.micro.score) : '–';
    out.makro = (d.macro && d.macro.score != null) ? _v746lbl(d.macro.score) : '–';
    /* ══ v1964 · DIE HERKUNFT GEHOERT AN DEN WERT ══════════════════════
       Marcel am 08.10.2026: „Unter Lage und Einschaetzung muss die Quelle
       dran, woher wir das bezogen haben und aus welchem Bericht."

       Beides liegt im Bericht und wurde bisher nur nicht mitgenommen:
       `meta.provenance` fuehrt je Kategorie Beschriftung, Quelle und
       Vertrauensgrad, und der Bericht hat ein Datum.

       > Die Quelle wird am ORT mitgefuehrt, nicht am Wert allein -
       > sonst verschwindet sie genau dann, wenn der Wert aus einem
       > anderen Lauf stammt.

       Die Quellennamen sind bewusst die ANONYMISIERTEN aus der
       provenance ("Infrastrukturdaten", "Marktdaten"), nicht die
       technischen aus `meta.sources` - CLAUDE.md: Bewertungspartner nie
       namentlich nach aussen. */
    out.quelle_lage = (function () {
      try {
        var pv = (d.meta && d.meta.provenance) || [];
        var tr = pv.filter(function (x) {
          return x && /mikrolage|standort|infrastruktur/i.test(String(x.label || ''));
        });
        var namen = [];
        tr.forEach(function (x) {
          var s = String(x.source || '').trim();
          if (s && namen.indexOf(s) < 0) namen.push(s);
        });
        return namen.length ? namen.join(' · ') : null;
      } catch (e) { return null; }
    })();
    out.bericht_datum = (function () {
      try {
        var r = (d.meta && (d.meta.created_at || d.meta.stand)) || d.created_at || null;
        return r ? new Date(r).toLocaleDateString('de-DE') : null;
      } catch (e) { return null; }
    })();
    out.microRaw = (d.micro && d.micro.score != null) ? d.micro.score : null;
    out.macroRaw = (d.macro && d.macro.score != null) ? d.macro.score : null;
    out.trendRaw = (d.price_trend_pct != null) ? d.price_trend_pct : null;
    /* v1316: was bisher im Bericht liegenblieb */
    out.bevRaw = (d.bevoelkerung_trend_pct != null) ? d.bevoelkerung_trend_pct : null;
    out.tageRaw = (d.days_on_market != null) ? d.days_on_market
                : (d.market_dynamics && d.market_dynamics.days_on_market != null) ? d.market_dynamics.days_on_market : null;
    /* v1323: Marktkontext und Erbbaurecht wandern mit in die Karte -
       von dort holt ui.js sie fuer die Pilot-Analyse und den Co-Pilot.
       Ohne diese zwei Zeilen bleibt beides im Bericht liegen. */
    out.marktkontext = d.marktkontext || null;
    out.erbbaurecht = d.erbbaurecht || null;
    out.trend = (d.price_trend_pct != null) ? ((d.price_trend_pct >= 0 ? '+' : '') + deNum(d.price_trend_pct, 1) + '%/J') : '–';
    if (mv.estimated != null) {
      out.mw = { low: mv.low != null ? mv.low : Math.round(mv.estimated * 0.9), med: mv.estimated, high: mv.high != null ? mv.high : Math.round(mv.estimated * 1.1), sqm: (mv.basis_median_sqm != null) ? (deNum(mv.basis_median_sqm, 0) + ' €/m²') : (area ? (deNum(Math.round(mv.estimated / area), 0) + ' €/m²') : '') }; /* v892-sqm */
    }
    var rsqm = rent.median_per_sqm != null ? rent.median_per_sqm : (vin.market_rent_sqm != null ? vin.market_rent_sqm : null);
    if (rsqm != null && area) {
      var lo = rent.q25_per_sqm != null ? rent.q25_per_sqm : rsqm * 0.9;
      var hi = rent.q75_per_sqm != null ? rent.q75_per_sqm : rsqm * 1.1;
      out.mm = { low: Math.round(lo * area), med: Math.round(rsqm * area), high: Math.round(hi * area), sqm: deNum(rsqm, 2) + ' €/m² kalt' };
    }
    /* v783-compare: Vergleichsobjekte aus sale.comparables (Feldnamen an avm-section angleichen) */
    try {
      var _cmp = (d.sale && Array.isArray(d.sale.comparables)) ? d.sale.comparables : null;
      if (_cmp && _cmp.length) {
        out.compare = _cmp.slice(0, 10).map(function (c) {
          return {
            distance: (c.distance_m != null) ? c.distance_m : null,
            livingArea: (c.living_area != null) ? c.living_area : null,
            constructionYear: (c.build_year != null) ? c.build_year : null,
            value: (c.price != null) ? c.price : null,
            ppsm: (c.price_per_sqm != null) ? c.price_per_sqm : null,
            similarity: null
          };
        });
      }
    } catch (e) {}
    /* v2237 · Angebotspreise -> realistischer Marktwert (Satz aus den Einstellungen,
       sonst recherchierter Marktdurchschnitt). Zwilling: dealpilot-mb.js / -qc.js */
    /* v2367 · Zieht der Marktbericht den Abschlag schon selbst ab (angebot_abschlag),
       uebernimmt die Karte ihn nur - nie ein zweites Mal abziehen. */
    try {
      var _ab = mv && mv.angebot_abschlag;
      if (_ab && _ab.pct != null) {
        out.abschlag = { pct: _ab.pct, roh: { low: _ab.roh && _ab.roh.low, med: _ab.roh && _ab.roh.estimated, high: _ab.roh && _ab.roh.high },
                         quelle: /eigene/.test(_ab.herkunft || '') ? 'dein Wert' : (/rtlich/.test(_ab.herkunft || '') ? 'örtliche Kauffälle' : 'Marktdurchschnitt'),
                         kurz: _ab.kurz || null };   /* v2672 · Ausschuss + Jahrgang fuer die Fusszeile */
      }
    } catch (e) {}
    try { if (global.DealPilotAbschlag) global.DealPilotAbschlag.anwenden(out); } catch (e) {}
    return out;
  }

  /* ── Host ── */
  function host() {
    var h = $(HOST_ID); if (h) return h;
    h = document.createElement('div'); h.id = HOST_ID;
    var a = $('oab-results') || $('obj-action-bar');
    if (a && a.parentNode) a.parentNode.insertBefore(h, a); else document.body.appendChild(h);
    return h;
  }

  function spanLabel() { return mode === 'low' ? 'Unten' : mode === 'high' ? 'Oben' : 'Ø'; }
  function frac(o) { return (o[mode] - o.low) / ((o.high - o.low) || 1); }
  function spnHtml(o) {
    function piece(val, k) { return '<span class="' + (mode === k ? 'sel' : '') + '">' + eur(val) + '</span>'; }
    return '<span class="l">Spanne</span>' + piece(o.low, 'low') + '<span class="sep">–</span>' + piece(o.med, 'med') + '<span class="sep">–</span>' + piece(o.high, 'high');
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1322 · Der Erbbau-Hinweis stand im falschen Weg
     ═══════════════════════════════════════════════════════════════════
     v1313b hat ihn in `applyAvm()` gebaut — und das ist der Weg von
     Sprengnetter und PriceHubble. Genau die beiden bieten wir nicht an
     („die preise für die bewertungspartner nehmen wir raus", Marcel,
     11.09.2026). Der Weg, den Marcel benutzt, ist DIESE Karte.

     Bei der Abnahme aufgefallen: `_oabApplyExternal` nimmt einen NAMEN
     und holt `_avm[name]` — ein durchgereichtes Ergebnisobjekt landet
     nirgends. Der Hinweis war damit nicht nur am falschen Ort, er war
     auf dem genutzten Weg überhaupt nicht erreichbar.

     Steht direkt unter dem Marktwert, weil er genau ihn einordnet: was
     die Karte zeigt, ist Volleigentum. Kein Bewertungspartner nimmt das
     Erbbaurecht entgegen — gemessen gegen GeoMap, 400 „Unrecognized
     field" für jede Schreibweise. */
  function erbZeileHtml() {
    try {
      if (!global.DealPilotErbbau || !global.DealPilotErbbau.istAn()) return '';
      var r = global.DealPilotErbbau.rechnen();
      var G = 'var(--wl-c9a84c, #C9A84C)';
      var kopf = '<b>Erbbaurecht:</b> Der Marktwert oben ist <b>Volleigentum</b> — das Grundstück ist nicht dabei. ';
      var rest;
      if (r && r.ok) {
        rest = 'Abschlag nach § 50 ImmoWertV: <b>'
          + Math.round(r.abschlag).toLocaleString('de-DE') + ' € · '
          + r.abschlagPct.toFixed(1).replace('.', ',') + ' %</b>. '
          + 'Wertpuffer, Wertsteigerung und Deal Score rechnen bereits damit.';
      } else {
        rest = 'Für den Abschlag fehlen noch Angaben — siehe Reiter <b>Objekt</b>, Grund &amp; Boden.';
      }
      return '<div class="dpx-erb" style="margin:8px 0 0;padding:8px 10px;border-radius:9px;font-size:11px;line-height:1.5;'
        + 'border:1px solid ' + G + ';background:var(--gold-bg, rgba(201,168,76,.08))">' + kopf + rest + '</div>';
    } catch (e) { return ''; }
  }

  /* ══ v2254 · MARKTWERTINDIKATION IST KEIN VERKEHRSWERT ═══════════════
     Marcel am 15.10.2026: „Wenn wir die Marktpreisindikation mit dem
     Angebotspreis und dem Abschlag übernehmen, ist das nicht der
     Verkehrswert. Erst wenn wir Stufe 3 rechnen, sollte dort Verkehrswert
     stehen - und auch welche Stufe bzw. amtlich. Automatisch."

     Die Beschriftung von #svwert folgt der HERKUNFT des eingetragenen
     Werts, nicht dem Feld:
       · Wert gleich einer Spannen-Zahl dieser Karte (oder dem bei der
         Uebernahme vermerkten Wert `sv`) -> Stufe der Karte
           Stufe 1/2 -> „Marktwertindikation" (Angebotspreise mit Abschlag)
           Stufe 3   -> „Verkehrswert", Stufe 3 · amtliche Wertermittlung
       · sonst (von Hand, Gutachten) -> die Beschriftung aus dem HTML.
     Gelesen wird bei jedem Zeichnen und bei jeder Eingabe - nach dem Laden
     eines Objekts stimmt sie also ohne eigenen Merker. */
  /* ══ v2255 · DIE KARTE IST NIE DER VERKEHRSWERT ═════════════════════
     GEMESSEN am 15.10.2026 (Sachsenstraße 18, Stufe-3-Bericht 213): die
     Karte zeigt auch nach Stufe 3 den Marktwert aus ANGEBOTSPREISEN
     (246.000 roh, 232.000 nach 5,8 % Abschlag). Über „übernehmen" stand
     danach „Verkehrswert (Stufe 3 · amtliche Wertermittlung)" über einer
     Zahl, die keine Wertermittlung ist - die amtlichen Werte (Ertragswert
     218.000, vorläufiger Sachwert 165.632) kommen nur über den Verlauf
     (#oe-vw, objekt-reiter.js), und dort fiel die Beschriftung auf den
     HTML-Text zurück. Jetzt:
       · Kartenzahl         -> immer Marktwertindikation (Stufe der Karte,
                               aber nur 1/2 genannt)
       · Vermerk `sv` mit amtlich:true (Ertrags-/Sachwert aus dem Verlauf)
                            -> Verkehrswert, Stufe 3
       · Vermerk ohne amtlich (Quick Boarding, Marktwert aus dem Verlauf)
                            -> Marktwertindikation
     Rückgabe { amtlich, stufe, art } oder null. */
  function _svHerkunft() {
    var sv = $('svwert'); if (!sv) return null;
    var v = numDe(sv.value); if (!(v > 0)) return null;
    try {
      var s = JSON.parse(($(STATE_ID) || {}).value || 'null');
      if (s && s.sv && Math.abs(Number(s.sv.wert) - v) <= 1) {
        if (s.sv.amtlich) return { amtlich: true, stufe: 3, art: s.sv.art || null };
        var st0 = Number(s.sv.stufe) || 0;
        return { amtlich: false, stufe: (st0 >= 1 && st0 <= 2) ? st0 : null, art: s.sv.art || null };
      }
    } catch (e) {}
    if (D && D.mw) {
      var ks = ['low', 'med', 'high'];
      for (var i = 0; i < ks.length; i++) {
        var w = Number(D.mw[ks[i]]);
        if (isFinite(w) && Math.abs(Math.round(w) - v) <= 1) {
          var st1 = Number(D.stufe) || 1;
          return { amtlich: false, stufe: st1 <= 2 ? st1 : null, art: null };
        }
      }
    }
    return null;
  }
  /* v2996 · fuer calc.js: woher der Wert im Feld stammt (Vermerk der Uebernahme) */
  try { global._dpSvHerkunftMb = _svHerkunft; } catch (e) {}
  function _svLabel() {
    var sv = $('svwert'); if (!sv) return;
    /* v2996 · eine ausdruecklich gewaehlte Herkunft geht vor - Gutachten/Bank sind dann der Wert */
    var _sel = $('svw_herkunft');
    if (_sel && _sel.value && (_sel.value === 'gutachten' || _sel.value === 'bank')) {
      var _f0 = sv.closest ? sv.closest('.f') : null, _l0 = _f0 ? _f0.querySelector('label') : null;
      if (_l0 && _l0._svMark) {
        for (var _i0 = 0; _i0 < _l0.childNodes.length; _i0++) { var _n0 = _l0.childNodes[_i0]; if (_n0.nodeType === 3 && _n0.nodeValue && _n0.nodeValue.trim()) { if (_l0._svOrigTxt != null) _n0.nodeValue = _l0._svOrigTxt; break; } }
        var _h0 = _l0.querySelector('.cf-hint'); if (_h0 && _h0._svOrig != null) { _h0.textContent = _h0._svOrig; _h0.style.color = ''; }
        _l0.style.color = ''; _l0._svMark = false; _l0._svSchl = null;
      }
      return;
    }
    var fld = sv.closest ? sv.closest('.f') : null;
    var lbl = fld ? fld.querySelector('label') : null; if (!lbl) return;
    var hint = lbl.querySelector('.cf-hint');
    var tn = null;
    for (var i = 0; i < lbl.childNodes.length; i++) { var n = lbl.childNodes[i]; if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) { tn = n; break; } }
    if (lbl._svOrigTxt == null && tn) lbl._svOrigTxt = tn.nodeValue;
    if (hint && hint._svOrig == null) hint._svOrig = hint.textContent;
    var st = _svHerkunft();
    if (st == null) {
      if (!lbl._svMark) return;          /* nur zuruecknehmen, was wir gesetzt haben */
      if (tn && lbl._svOrigTxt != null) tn.nodeValue = lbl._svOrigTxt;
      if (hint && hint._svOrig != null) { hint.textContent = hint._svOrig; hint.style.color = ''; }
      lbl.style.color = ''; lbl._svMark = false; lbl._svSchl = null; lbl.removeAttribute('data-sv-stufe'); lbl.removeAttribute('data-sv-art');
      if (lbl._svOrigTitle != null) lbl.title = lbl._svOrigTitle;
      return;
    }
    if (lbl._svOrigTitle == null) lbl._svOrigTitle = lbl.title || '';
    if (!st.amtlich) lbl.title = lbl._svOrigTitle;
    /* v2255: data-sv-stufe = 3 (amtlich), 1/2 (Indikation dieser Stufe),
       0 (Indikation aus einem Stufe-3-Bericht oder ohne Stufe) */
    var schl = (st.amtlich ? 'a' : 'i') + (st.stufe || 0) + (st.art || '');
    if (lbl._svSchl === schl) return;
    if (st.amtlich) {
      if (tn) tn.nodeValue = 'Verkehrswert ';
      if (hint) { hint.textContent = '(Stufe 3 · amtliche Wertermittlung nach ImmoWertV)'; hint.style.color = ''; }
      lbl.style.color = '';
      lbl.title = st.art ? ('Übernommen: ' + st.art + ' aus der Wertermittlung (Stufe 3)') : lbl.title;
    } else {
      if (tn) tn.nodeValue = 'Marktwertindikation ';
      if (hint) {
        hint.textContent = '(' + (st.stufe ? 'Stufe ' + st.stufe + ' · ' : '') + 'aus Angebotspreisen mit Abschlag — kein Verkehrswert n. § 194 BauGB)';
        hint.style.color = 'var(--gold-3,#9a7f33)';
      }
      lbl.style.color = 'var(--gold-3,#9a7f33)';
    }
    lbl._svMark = true; lbl._svSchl = schl;
    lbl.setAttribute('data-sv-stufe', String(st.amtlich ? 3 : (st.stufe || 0)));
    lbl.setAttribute('data-sv-art', st.amtlich ? 'amtlich' : 'indikation');
  }
  try {
    document.addEventListener('input', function (e) { if (e.target && e.target.id === 'svwert') _svLabel(); }, true);
    setInterval(_svLabel, 1500);   /* Laden eines Objekts, Werte von anderen Wegen */
  } catch (e) {}

  function render() { /* v752-bridge */
    try { _svLabel(); } catch (e) {}
    if (!D) return;
    persistLight();
    /* Section-Renderer (avm-section.js) uebernimmt die Darstellung; eigener Host bleibt leer. */
    if (global.AvmSection && typeof global.AvmSection.setDealpilot === 'function') {
      try { var h0 = $(HOST_ID); if (h0) h0.innerHTML = ''; } catch (e) {}
      global.AvmSection.setDealpilot(D, mode, {
        apply: applyToFields,
        setMode: function (m) { mode = (m === 'mid') ? 'med' : m; persistLight(); },
        report: function () { try { run(); } catch (e) {} }
      });
      return;
    }
    _renderLegacy();
  }

  function _renderLegacy() { /* v751-light Fallback, falls AvmSection fehlt */
    if (!D) return;
    injectCss();
    var h = host();
    var hasMw = !!D.mw, hasMm = !!D.mm;
    h.innerHTML =
      '<div class="dpx' + (collapsed ? ' collapsed' : '') + '" id="dpx-card">' +
        '<div class="dpx-head"><span class="dpx-logo"><span class="d">Deal</span><span class="p">Pilot</span></span>' +
          '<span class="dpx-eyebrow">Marktbewertung</span>' +
          '<span class="dpx-conf">Aussagekraft: ' + ((D.conf && D.conf.label) || '\u2013') + '</span></div>' +
        '<div class="dpx-body"><div class="dpx-vals">' +
          (hasMw ? '<div class="dpx-vb dpx-mw"><span class="dpx-lab">Marktwert</span><div class="dpx-val" id="dpx-v-mw">\u2013</div></div>' : '') +
          (hasMm ? '<div class="dpx-vb dpx-mm"><span class="dpx-lab">Marktmiete (kalt)</span><div class="dpx-val" id="dpx-v-mm">\u2013</div></div>' : '') +
        '</div><div class="dpx-spanrow"><div class="dpx-seg" id="dpx-seg">' +
          '<button data-k="low"' + (mode === 'low' ? ' class="on"' : '') + '>Unten</button>' +
          '<button data-k="med"' + (mode === 'med' ? ' class="on"' : '') + '>\u00d8</button>' +
          '<button data-k="high"' + (mode === 'high' ? ' class="on"' : '') + '>Oben</button></div></div>' +
          '<button class="dpx-apply" id="dpx-apply"><span id="dpx-applytxt"></span></button>' +
        erbZeileHtml() + '</div></div>';
    var seg = $('dpx-seg');
    if (seg) seg.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { mode = b.dataset.k; persistLight(); paint(); }); });
    var ap = $('dpx-apply'); if (ap) ap.addEventListener('click', applyToFields);
    paint();
  }

  function paint() {

    if (!D) return;
    if (D.mw) { var e1 = $('dpx-v-mw'); if (e1) e1.textContent = eur(D.mw[mode]); var s1 = $('dpx-s-mw'); if (s1) s1.innerHTML = spnHtml(D.mw); }
    if (D.mm) { var e2 = $('dpx-v-mm'); if (e2) e2.textContent = eur(D.mm[mode]); var s2 = $('dpx-s-mm'); if (s2) s2.innerHTML = spnHtml(D.mm); }
    var hv = $('dpx-hvals');
    if (hv) {
      var hp = [];
      if (D.mw) hp.push('MW ' + fmt0(D.mw[mode]) + ' \u20ac');
      if (D.mm) hp.push('Miete ' + fmt0(D.mm[mode]) + ' \u20ac');
      hv.innerHTML = hp.join(' \u00b7 ');
    }
    var t = $('dpx-applytxt'); if (t) t.textContent = 'In Felder \u00fcbernehmen (' + spanLabel() + ')';
  }

  /* \u2500\u2500 In Felder \u00fcbernehmen (wie applyAvm: svwert + ds2_marktmiete \u20ac/m\u00b2) \u2500\u2500 */
  function setInput(id, val) { var el = $(id); if (!el || val == null || val === '') return; el.value = val; try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }
  /* v2515: Werte aus dem Marktbericht sind gemessen - die Herkunft je Lage-Feld wird mitgeschrieben (ki-lage.js) */
  function _herkGemessen(id) { try { if (global.DpLageHerkunft) global.DpLageHerkunft.setze(id, 'gemessen'); } catch (e) {} }
  function setSel(id, v) { var el = $(id); if (!el || !v) return; el.value = v; try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} if (String(el.value) === String(v)) _herkGemessen(id); }
  /* ═══════════════════════════════════════════════════════════════════
     v1316 · Die erweiterte Marktpreisindikation füllt jetzt aus, was sie
             weiss — und tut es von selbst
     ═══════════════════════════════════════════════════════════════════
     Marcels Frage: „wenn ich ganz am anfang die erweiterte
     marktpreisindikation ausgewählt habe sollte er auch die daten für
     bevölkerung micro und makrolage haben warum füllt er das nicht
     automatisch aus? fehlen ihm werte?"

     GEMESSEN: es fehlten keine Werte. Destatis liefert die
     Bevölkerungsentwicklung (Kreis Herford +0,152 %/Jahr, live geprüft),
     GeoMap die Angebotsdauer. Beides stand im Bericht — und blieb dort.
     `mapCard()` las nur micro.score, macro.score und price_trend_pct;
     alles andere fiel unter den Tisch. Und selbst diese drei landeten
     erst im Formular, wenn jemand „In Felder übernehmen" drückte.

     ds2_entwicklung bleibt bewusst AUSSEN VOR. Das Feld fragt nach
     Entwicklungsmöglichkeiten AM OBJEKT — Ausbau, Aufstockung, Teilung.
     Der Marktbericht liefert eine Markt-Einschätzung („steigend",
     „stabil"). Das ist nicht dasselbe, und es sieht nur so aus. */

  /* Bevölkerungsentwicklung in %/Jahr -> die fünf Stufen des Feldes.
     Die Schwellen sind bewusst eng: unter einem halben Prozent im Jahr
     ist ein Ort weder wachsend noch schrumpfend, er steht. */
  /* ══ v2177 · EINE SCHWELLENKETTE FUER DIE LAGE ═══════════════════════
     Hier standen eigene Grenzen (Score/10: 8/6/4/2, Bevoelkerung 1,0/0,3),
     die „Lage analysieren" (v2175, LageMessungService.SCHWELLEN) andere
     (Makro 75/60/45/30, Mikro 85/75/55/35, Bevoelkerung 0,8/0,2). Derselbe
     Ort bekam je nach Weg ein anderes Wort. Marcel hat am 13.10.2026 die
     Ketten von LageMessungService abgenommen („ja das passt so") - sie
     gelten jetzt hier genauso. Wer eine aendert, aendert BEIDE. */
  function _stufeMakro(sc) { if (sc == null || !isFinite(sc)) return null; return sc >= 75 ? 'sehr_gut' : sc >= 60 ? 'gut' : sc >= 45 ? 'durchschnittlich' : sc >= 30 ? 'schwach' : 'sehr_schwach'; }
  function _stufeMikro(sc) { if (sc == null || !isFinite(sc)) return null; return sc >= 85 ? 'sehr_gut' : sc >= 75 ? 'gut' : sc >= 55 ? 'durchschnittlich' : sc >= 35 ? 'schwach' : 'sehr_schwach'; }
  /* v3007 · die Wertsteigerungs-Schwelle stand zweimal lokal (autoLage, applyToFields);
     jetzt EINE Stelle, auch fuer den Abgleich in ki-lage.js (lageStufen.wert). */
  function _wertStufe(p) { return p >= 3 ? 'sehr_hoch' : p >= 2 ? 'hoch' : p >= 1 ? 'mittel' : p > 0 ? 'niedrig' : 'keines'; }
  function _bevStufe(pctProJahr) {
    if (pctProJahr == null || !isFinite(pctProJahr)) return null;
    if (pctProJahr >= 0.8) return 'stark_wachsend';
    if (pctProJahr >= 0.2) return 'wachsend';
    if (pctProJahr >= -0.2) return 'stabil';
    if (pctProJahr >= -0.8) return 'leicht_fallend';
    return 'stark_fallend';
  }

  /* Angebotsdauer in Tagen -> Nachfrage. Kurz im Schaufenster heisst:
     es wird gekauft. Die Schwellen folgen denen im Marktbericht
     (MarketInsightsService: <=60 hoch, <=120 mittel). */
  function _nachfrageStufe(tage) {
    if (tage == null || !isFinite(tage)) return null;
    if (tage <= 30) return 'sehr_stark';
    if (tage <= 60) return 'stark';
    if (tage <= 120) return 'mittel';
    if (tage <= 200) return 'schwach';
    return 'sehr_schwach';
  }
  /* ═══ v1316 · Die Einstufungen wandern von selbst ins Formular ═══════
     Marcels eigentliche Frage war nicht „kann er das", sondern „warum
     macht er es nicht von allein". Die Antwort war: weil jemand auf „In
     Felder übernehmen" drücken musste — für ALLES, auch für Zahlen, die
     gar keine Entscheidung verlangen.

     Die Trennung, die jetzt gilt:

       AUTOMATISCH   Makrolage, Mikrolage, Bevölkerung, Nachfrage,
                     Wertsteigerung. Das sind Einstufungen. Es gibt keine
                     Spanne zu wählen, keine zweite Meinung einzuholen —
                     die Zahl ist die Zahl.

       PER KNOPF     Verkehrswert und Marktmiete. An denen hängt die
                     Spannen-Wahl (niedrig / mittel / hoch), und die ist
                     eine Entscheidung des Nutzers. Sie ihm abzunehmen
                     hiesse, ihm eine Zahl unterzuschieben.

     LEERE FELDER NUR. Was schon dasteht, bleibt stehen — auch wenn es
     aus einem alten Abruf kommt. Wer von Hand „Sehr gut" gewählt hat,
     soll das nicht beim nächsten Abruf still verlieren. */
  function setSelLeer(id, v) {
    var el = $(id);
    if (!el || !v) return false;
    if (String(el.value || '').trim() !== '') return false;   /* steht schon */
    el.value = v;
    if (String(el.value || '') !== String(v)) return false;   /* Option gibt es nicht */
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    _herkGemessen(id);   /* v2515 */
    return true;
  }

  function autoLage() {
    if (!D) return 0;
    var lc = function (sc) { return sc >= 8 ? 'sehr_gut' : sc >= 6 ? 'gut' : sc >= 4 ? 'durchschnittlich' : sc >= 2 ? 'schwach' : 'sehr_schwach'; };
    var wc = _wertStufe;
    var gesetzt = [];
    if (D.macroRaw != null && setSelLeer('makrolage', _stufeMakro(D.macroRaw))) gesetzt.push('Makrolage');
    if (D.microRaw != null && setSelLeer('mikrolage', _stufeMikro(D.microRaw))) gesetzt.push('Mikrolage');
    if (D.trendRaw != null && setSelLeer('ds2_wertsteigerung', wc(D.trendRaw))) gesetzt.push('Wertsteigerung');
    var b = _bevStufe(D.bevRaw);
    if (b && setSelLeer('ds2_bevoelkerung', b)) gesetzt.push('Bevölkerung');
    var n = _nachfrageStufe(D.tageRaw);
    if (n && setSelLeer('ds2_nachfrage', n)) gesetzt.push('Nachfrage');
    if (!gesetzt.length) return 0;
    try { if (typeof global.calc === 'function') global.calc(); } catch (e) {}
    try { if (typeof global.renderDealScore2 === 'function') global.renderDealScore2(); } catch (e) {}
    try { toast('✓ ' + gesetzt.join(' + ') + ' automatisch übernommen'); } catch (e) {}
    return gesetzt.length;
  }

  function applyToFields() {
    if (!D) return; var applied = [];
    if (D.mw) { setInput('svwert', fmt0(D.mw[mode])); applied.push('Marktpreisindikation');
      /* v2996 · die Kartenzahl ist eine Marktpreisindikation aus Angeboten, kein Verkehrswert */
      try { var _hs = $('svw_herkunft'); if (_hs) { _hs.value = 'indikation'; _hs.dispatchEvent(new Event('change', { bubbles: true })); } } catch (e) {} }
    if (D.mm) {
      var area = D.area || numDe(vIn('wfl')) || 0;
      var sqm = area ? (D.mm[mode] / area) : null;
      if (sqm) { setInput('ds2_marktmiete', sqm.toFixed(2).replace('.', ',')); applied.push('Marktmiete €/m²'); }
    }
    var lc = function (sc) { return sc >= 8 ? 'sehr_gut' : sc >= 6 ? 'gut' : sc >= 4 ? 'durchschnittlich' : sc >= 2 ? 'schwach' : 'sehr_schwach'; };
    var wc = _wertStufe;
    if (D.macroRaw != null) { setSel('makrolage', _stufeMakro(D.macroRaw)); applied.push('Makrolage'); }
    if (D.microRaw != null) { setSel('mikrolage', _stufeMikro(D.microRaw)); applied.push('Mikrolage'); }
    if (D.trendRaw != null) { var _w = wc(D.trendRaw); if (_w) { setSel('ds2_wertsteigerung', _w); applied.push('Wertsteigerung'); } }
    /* v1316: die beiden, die es schon gab, aber nie ankamen. */
    var _bev = _bevStufe(D.bevRaw);
    if (_bev) { setSel('ds2_bevoelkerung', _bev); applied.push('Bevölkerung'); }
    var _nf = _nachfrageStufe(D.tageRaw);
    if (_nf) { setSel('ds2_nachfrage', _nf); applied.push('Nachfrage'); }
    try { if (typeof global.calc === 'function') global.calc(); } catch (e) {}
    try { if (typeof global.renderDealScore2 === 'function') global.renderDealScore2(); } catch (e) {}
    toast('✓ ' + (applied.join(' + ') || 'Werte') + ' übernommen (' + spanLabel() + ')');
  }

  /* ── Persistenz (#_mb_state -> JSONB) ── */
  function snapshot(extra) {
    /* v2168: die Karte traegt, zu welchem Objekt sie gehoert */
    return Object.assign({ ts: Date.now(), card: D, mode: mode, collapsed: collapsed,
      fuer: { key: global._currentObjKey || null, wfl: numDe(vIn('wfl')) || null } }, extra || {});
  }
  /* v969c: Vorwahl-Spanne aus dem Uebernehmen (einmalig konsumiert, ueberlebt .run()) */
  function _prefSpan() { try { var p = localStorage.getItem('dp_mb_pref_span'); if (p === 'low' || p === 'med' || p === 'high') { localStorage.removeItem('dp_mb_pref_span'); return p; } } catch (e) {} return null; }
  function persistLight() { // nur Zustand (mode/collapsed) ohne neuen Abruf
    var el = $(STATE_ID); if (!el || !el.value) return;
    try { var s = JSON.parse(el.value); s.mode = mode; s.collapsed = collapsed; el.value = JSON.stringify(s); lastJson = el.value; el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  function persistFull(extra) {
    var el = $(STATE_ID); if (!el) return;
    try { el.value = JSON.stringify(snapshot(extra)); lastJson = el.value; el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  function restore() {
    var el = $(STATE_ID);
    if (!el || !el.value) { var h = $(HOST_ID); if (h) h.innerHTML = ''; D = null; return; }
    if (el.value === lastJson) return;
    lastJson = el.value;
    var s = null; try { s = JSON.parse(el.value); } catch (e) { return; }
    if (!s || !s.card) return;
    /* v2168 · FREMDE KARTEN VERWERFEN. Bis v2168 wanderte die Karte des
       vorigen Objekts in jedes geladene ohne eigene (storage.js resetFields).
       Neue Karten tragen ihr Objekt (fuer.key); alte nur ihre Flaeche -
       weicht die um mehr als 15 % von der Wohnflaeche ab, ist es nicht
       DIESE Karte. Kein Treffer heisst kein Wert. */
    try {
      var _k = global._currentObjKey || null, _w = numDe(vIn('wfl')) || 0;
      var _fremd = (s.fuer && s.fuer.key && _k && s.fuer.key !== _k);
      var _fl = (s.card && (s.card.area || (s.fuer && s.fuer.wfl))) || 0;
      if (!_fremd && !(s.fuer && s.fuer.key) && _fl > 0 && _w > 0 && Math.abs(_fl - _w) / _w > 0.15) _fremd = true;
      if (_fremd) {
        try { console.warn('[v2168] Marktbericht-Karte verworfen: gehoert zu einem anderen Objekt (Flaeche ' + _fl + ' gegen ' + _w + ' m²)'); } catch (x) {}
        el.value = ''; lastJson = ''; D = null; var _h = $(HOST_ID); if (_h) _h.innerHTML = '';
        if (global.AvmSection && typeof global.AvmSection.setDealpilot === 'function') global.AvmSection.setDealpilot(null);
        return;
      }
    } catch (e) {}
    var c = s.card;
    if (!c.mw && !c.mm && (c.marktwert || c.miete)) { // v540/v541-Snapshot -> v542-Form migrieren
      c = { rating: c.rating || 'Indikation', conf: c.confidence || { label: '–', pct: 0 },
            mikro: (c.meta && c.meta.mikro) || '–', makro: (c.meta && c.meta.makro) || '–', trend: (c.meta && c.meta.trend) || '–',
            mw: c.marktwert || null, mm: c.miete || null, area: numDe(vIn('wfl')) || 0 };
    }
    /* v1964a: eine WIEDERHERGESTELLTE Karte kam nie durch mapCard - sie
       wurde beim Berichtslauf serialisiert. Die Herkunft steht deshalb
       nicht drin, der ZEITSTEMPEL aber schon. Das Datum laesst sich also
       nachtragen, die Quelle nicht: sie erscheint ab dem naechsten
       Bericht. Lieber die halbe Angabe als eine erfundene. */
    if (c && !c.bericht_datum && s.ts) {
      try { c.bericht_datum = new Date(s.ts).toLocaleDateString('de-DE'); } catch (e) {}
    }
    D = c; mode = s.mode || _prefSpan() || 'med'; collapsed = true; /* v564-collapsed-default; v969c */ render();
  }

  /* v772-dpmb-stub: DealPilot-Marktbewertung Demo bei AVM_MODE=stub (kein Microservice/Kerosin). */
  var _dpmbHC=null,_dpmbHT=0;
  function _dpmbHealth(){ return new Promise(function(resolve){
    var now=Date.now();
    if(_dpmbHC!==null && (now-_dpmbHT)<60000){ resolve(_dpmbHC); return; }
    fetch('/api/v1/avm/health',{headers:{'Authorization':'Bearer '+tok()}}).then(function(r){return r.json();})
      .then(function(h){ _dpmbHC=h||{}; _dpmbHT=Date.now(); resolve(_dpmbHC); })
      .catch(function(){ _dpmbHC={}; _dpmbHT=Date.now(); resolve(_dpmbHC); });
  }); }
  function _dpmbStubPayload(i){
    var wfl=(i&&i.wfl)||70, sqm=2600, est=Math.round(wfl*sqm), rsqm=9.2;
    return { valuation:{ market_value:{ estimated:est, low:Math.round(est*0.9), high:Math.round(est*1.1), confidence_label:'Gut', confidence_pct:78, basis_median_sqm:sqm } },
      rent:{ median_per_sqm:rsqm, q25_per_sqm:rsqm*0.9, q75_per_sqm:rsqm*1.1 },
      micro:{ score:72 }, macro:{ score:65 }, price_trend_pct:2.4,
      deal_score:{ rating:'Solide' }, ref:{ living_area:wfl } };
  }
  function _mbSpinner(on) { /* v782-spinner */
    var ID='dp-mb-spin';
    if (on) {
      if (document.getElementById(ID)) return;
      if (!document.getElementById('dp-mb-spin-css')) {
        var st=document.createElement('style'); st.id='dp-mb-spin-css';
        st.textContent='#'+ID+'{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(12,11,9,.45)}'+
          '#'+ID+' .b{background:#fff;border-radius:14px;padding:22px 26px;display:flex;flex-direction:column;align-items:center;gap:13px;box-shadow:0 20px 60px -16px rgba(0,0,0,.5)}'+
          '#'+ID+' .sp{width:34px;height:34px;border:3px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 25%, transparent);border-top-color:var(--wl-c9a84c, #C9A84C);border-radius:50%;animation:dpmbspin .8s linear infinite}'+
          '#'+ID+' .t{font:600 13.5px/1.4 "DM Sans",sans-serif;color:#1b1815}@keyframes dpmbspin{to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
      }
      var o=document.createElement('div'); o.id=ID;
      o.innerHTML='<div class="b"><div class="sp"></div><div class="t">Marktdaten werden geladen …</div></div>';
      document.body.appendChild(o);
    } else { var e=document.getElementById(ID); if (e&&e.parentNode) e.parentNode.removeChild(e); }
  }
  /* v1851 · N4: die Stufe kommt vom Aufrufer. Ohne Angabe bleibt es die
     schnelle Marktpreisindikation (fast = Stufe 1, wie bisher). Stufe 2
     und 3 schicken `wert_stufe`; der Proxy rechnet sie ab (_stufeAus) und
     prueft das Kontingent je Art (mpi_plus, wev) - ein Geldweg, derselbe
     wie beim Sprechlauf. Stufe 3 ist damit zum ersten Mal aus der
     Haupt-App erreichbar (Marcels Entscheidung vom 04.10.2026). */
  async function run(opts) {
    var stufe = (opts && opts.stufe >= 1 && opts.stufe <= 3) ? Math.round(opts.stufe) : 1;
    var i = inputs();
    if (!i.plz && !i.ort) { toast('Bitte mindestens PLZ oder Ort ausfüllen'); return; }
    var _dph = await _dpmbHealth();
    if (false && _dph && _dph.mode === 'stub') { /* v892-dp-live: DealPilot ruft IMMER den Microservice (entkoppelt von AVM_MODE) */
      var _p = _dpmbStubPayload(i);
      D = mapCard(_p); mode = 'med'; collapsed = false; /* v830-mb-expanded: nach Abruf offen */
      render();
      persistFull({ object_key:null, cost:0, market_value:_p.valuation.market_value, micro:_p.micro.score, macro:_p.macro.score, price_trend_pct:_p.price_trend_pct });
      toast('\u2713 DealPilot-Marktbewertung (Demo)');
      return;
    }
    var ref = objId();
    /* ══ v2174 · STREAMING, MODAL MIT ETAPPEN, HINTERGRUND ═══════════════
       Marcel am 13.10.2026: „wird dem Kunden dann ein Modal angezeigt mit
       Progressbar ... und wenn man das Modal schliesst, im Hintergrund
       weiter erstellt ... und irgendwo dann gemeldet".
       Bis v2173: Dreh-Kreis ohne Balken, EIN blockierender Request an
       /reports/from-dealpilot. Jetzt derselbe Streaming-Weg wie die
       Marktbericht-App (/reports/generate-stream nimmt ein DealPilot-Objekt
       an und bucht erst nach dem Ergebnis ab - auch wenn der Browser die
       Verbindung verliert). Anzeige und Gedaechtnis: mb-auftrag.js.
       DAS ERGEBNIS GEHOERT DEM OBJEKT, FUER DAS ES GEHOLT WURDE: wechselt
       der Nutzer inzwischen das Objekt, landet es NICHT im gerade offenen,
       sondern wartet in der Meldung, bis er es oeffnet. */
    var key = global._currentObjKey || null;
    var label = ([i.str, i.hnr].filter(Boolean).join(' ') + (i.ort ? ', ' + i.ort : '')).trim() || (i.plz || 'Objekt');
    var M = global.MbAuftrag || null;
    var job = M ? M.start({ key: key, ref: ref, label: label, stufe: stufe }) : null;
    if (!M) _mbSpinner(true);
    try {
      var res = await fetch('/api/v1/marktbericht/reports/generate-stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok() },
        body: JSON.stringify(stufe >= 2 ? { wert_stufe: stufe, external_ref: ref, object: i }
                                        : { fast: true, external_ref: ref, object: i })
      });
      if (!res.ok || !res.body) {
        var data = await res.json().catch(function () { return {}; });
        if (M) M.abbrechen(job);
        /* v1187: nannte Liter. Der Server schickt seit v1183 die ART mit
           (mpi | mpi_plus | wev) — sie wird jetzt benannt, damit der Nutzer
           weiss, WELCHE Bewertung fehlt. */
        if (data && (data.needs_credits || data.error === 'kein_kontingent')) {
          var _artName = { mpi: 'Marktpreisindikation', mpi_plus: 'erweiterte Marktpreisindikation', wev: 'Wertermittlung' };
          toast('⚠ Keine ' + (_artName[data.art] || 'Bewertung') + ' mehr frei — im Marktbericht nachkaufbar');
        }
        else toast('⚠ DealPilot-Marktbewertung fehlgeschlagen' + (data && (data.error || data.message) ? ': ' + (data.message || data.error) : ''));
        return;
      }
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '', result = null, fehlerText = null;
      for (;;) {
        var r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        var nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          var line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          var ev = null; try { ev = JSON.parse(line); } catch (x) { continue; }
          if (ev.type === 'step' && M) M.schritt(job, ev.msg);
          else if (ev.type === 'done') result = ev.result;
          else if (ev.type === 'error') fehlerText = ev.error || 'Fehler';
        }
      }
      if (!result) {
        if (M) M.fehler(job, fehlerText || 'Keine Antwort vom Marktbericht-Dienst.');
        else toast('⚠ DealPilot-Marktbewertung fehlgeschlagen' + (fehlerText ? ': ' + fehlerText : ''));
        return;
      }
      var payload = result.data || result;
      var _mv = payload.valuation && payload.valuation.market_value;
      if (!(_mv && _mv.estimated > 0)) {
        /* derselbe Massstab wie der Proxy: ohne Marktwert wird nicht abgebucht */
        if (M) M.fehler(job, 'Für diese Adresse liegen aktuell keine Marktdaten vor — es wurde nichts abgebucht.');
        else toast('⚠ Für diese Adresse liegen aktuell keine Marktdaten vor — es wurde nichts abgebucht');
        return;
      }
      if ((global._currentObjKey || null) !== key) {
        if (M) M.fertig(job, { angewandt: false, payload: result });
        return;
      }
      D = mapCard(payload); mode = (_prefSpan() || 'med'); collapsed = false; /* v830-mb-expanded; v969c: Vorwahl-Spanne */
      if (D && !D.stufe) D.stufe = stufe;   /* v2254: die angefragte Stufe */
      render();
      /* v1316: die Einstufungen wandern jetzt von selbst ins Formular -
         nur in leere Felder, und nur die, an denen keine Spannen-Wahl
         haengt. Verkehrswert und Marktmiete bleiben beim Knopf. */
      try { autoLage(); } catch (e) {}
      persistFull({
        object_key: result.object_key || null, cost: 0,
        market_value: (payload.valuation && payload.valuation.market_value) || null,
        micro: payload.micro ? payload.micro.score : null,
        macro: payload.macro ? payload.macro.score : null,
        price_trend_pct: payload.price_trend_pct != null ? payload.price_trend_pct : null
      });
      try { global.dispatchEvent(new CustomEvent('dp:mb-ready', { detail: { object_key: result.object_key || null } })); } catch (e) {}
      /* v2174: hier stand „(−N L)" - die Einheit Liter ist seit v1183 abgeschafft. */
      if (M) M.fertig(job, { angewandt: true });
      else toast('✓ DealPilot-Marktbewertung');
      try { if (global.AiCredits && typeof global.AiCredits.refreshAvm === 'function') setTimeout(global.AiCredits.refreshAvm, 400); } catch (e) {}
    } catch (e) {
      if (M) M.fehler(job, 'Netzwerkfehler: ' + (e && e.message ? e.message : 'unbekannt'));
      else toast('⚠ Netzwerkfehler bei der DealPilot-Marktbewertung');
    }
    finally { if (!M) _mbSpinner(false); }
  }

  /* v1862 · Ein Ergebnis, das WOANDERS geholt wurde (geführte Eingabe,
     Sprechlauf), landet hier auf der Karte — gemessen am 04.10.2026: der
     Dialog holte die Marktpreisindikation, setzte `_mbGeholt`, die
     Pre-Flight-Kette übersprang ihren Abruf, und die Karte blieb leer.
     Bezahlt, aber nicht angezeigt. `data` ist die Antwort des Proxys
     ({data, object_key, cost}) oder der nackte Bericht. */
  function uebernehmen(data) {
    data = data || {};
    var payload = data.data || data;
    if (!payload || (!payload.valuation && !payload.rent)) return false;
    D = mapCard(payload); mode = (_prefSpan() || 'med'); collapsed = false;
    render();
    try { autoLage(); } catch (e) {}
    persistFull({
      object_key: data.object_key || null, cost: (typeof data.cost === 'number' ? data.cost : (data.charged || data.liters || 0)),
      market_value: (payload.valuation && payload.valuation.market_value) || null,
      micro: payload.micro ? payload.micro.score : null,
      macro: payload.macro ? payload.macro.score : null,
      price_trend_pct: payload.price_trend_pct != null ? payload.price_trend_pct : null
    });
    try { if (global.AiCredits && typeof global.AiCredits.refreshAvm === 'function') setTimeout(global.AiCredits.refreshAvm, 400); } catch (e) {}
    /* v1862b · wer auf den Bericht wartet (Reiter Objekt: Verkehrswert-Übernahme,
       Leiste), erfährt es hier — statt erst beim nächsten Objektwechsel. */
    try { global.dispatchEvent(new CustomEvent('dp:mb-ready', { detail: { object_key: data.object_key || null } })); } catch (e) {}
    return true;
  }

  function watch() {
    var el = $(STATE_ID);
    if (el) { el.addEventListener('input', restore); el.addEventListener('change', restore); }
    setInterval(restore, 1200);
    restore();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();

  global.DealPilotMB = { lageStufen: { makro: _stufeMakro, mikro: _stufeMikro, bev: function (p) { return _bevStufe(p); }, nachfrage: function (t) { return _nachfrageStufe(t); }, wert: function (p) { return _wertStufe(p); } }, /* v2177, wert v3007 */ run: run, restore: restore, inputs: inputs, uebernehmen: uebernehmen, /* v1862: ein Sammler, eine Karte */ letzter: function () { return D || null; }, /* v1851: letzte Karte fuer die Lage-Gegenueberstellung */ /* v752-api */
    getData: function () { return (D && D.mw) ? { D: D, mode: mode } : null; },
    setMode: function (m) { mode = (m === 'mid') ? 'med' : m; try { persistLight(); } catch (e) {} },
    apply: applyToFields,
    /* v1316: Pruefhaken. Ein echter Abruf kostet Guthaben - ohne diese
       beiden laesst sich die Zuordnung nur durch Bezahlen messen. */
    _erbZeile: erbZeileHtml,   /* v1322 */
    _mapCard: mapCard,
    _autoLage: function (payload) { if (payload) D = mapCard(payload); return autoLage(); } };
})(window);
