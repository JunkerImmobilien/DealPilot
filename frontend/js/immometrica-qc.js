'use strict';
/* W30-wl-token: Gold-Literale zeigen auf die Whitelabel-Ebene
   (var(--wl-<hex>, #<hex>)). Ohne Whitelabel greift der Fallback = unveraendert. */
/* immometrica-qc.js — laeuft IM QuickCheck-iframe.
   Haengt den ImmoMetrica-Chip zur Laufzeit an #qc7-sources (kein Markup-Patch),
   nutzt den Picker im Parent (window.parent.ImmoMetricaImport) und schreibt die
   ausgewaehlten Felder in die qc_-Felder. Re-injiziert nach Bar-Re-Render. */
(function () {
  var P = window.parent;
  var ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h11M4 12h11M4 18h7"/><circle cx="19" cy="6" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>';

  /* v660-qcbar-parity: EINE autoritative Regel statt der widerspruechlichen
     #qc7-sources-Bloecke (v570-v578). Ziel = identische EINZEILIGE Karte wie der
     Objekt-Tab: kein Eigen-Scroll, kein gequetschter Lead, kein Umbruch der
     Reisszone (Barcode + Abrufen). Statt umbrechen -> Kacheln duerfen leicht
     schrumpfen (min-width:0), bis Lead + Gruppen + QR + Reisszone in EINE Zeile
     passen. Fixe Teile (~450px) « Container (~1235px) -> kein Ueberlauf.
     Nur Desktop (min-width:769px) -> Mobile-Umbruch (v636) bleibt unberuehrt.
     Per <style> zur Laufzeit angehaengt -> gewinnt ueber die statischen Bloecke. */
  function injectParityCss() {
    if (document.getElementById('dp-qc-parity')) return;
    var css = [
      '@media(min-width:769px){',
      '  .actions:has(#qc7-sources){overflow:visible !important}',
      /* Strang1 (v664): .container-Seitenpadding (22px) raus -> Score, PRE-FLIGHT-Karte
         und Formular sitzen alle buendig auf voller Breite (874px). Dadurch braucht
         die Bar KEINEN Full-Bleed mehr -> margin 0, width 100%. */
      '  body:has(#qc7-sources) .container{padding-left:0 !important;padding-right:0 !important}',
      '  #qc7-sources.dp-pfbar{overflow:hidden !important;flex-wrap:nowrap !important;gap:0 !important;column-gap:0 !important;row-gap:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important}',
      '  #qc7-sources .dp-pf-lead{flex:0 0 auto !important;min-width:auto !important}',
      '  #qc7-sources .dp-pf-rz{flex:0 0 auto !important}',
      /* Segmente + Kacheln behalten NATUERLICHE Breite (Objekt-Tab schrumpft nicht):
         kein min-width:0, kein Schrumpfen -> Tool-Kachel ~184px wie SOLL */
      '  #qc7-sources .dp-pf-seg{flex:0 0 auto !important}',
      '  #qc7-sources .dp-pf-row{min-width:auto !important}',
      '  #qc7-sources .dp-pf-tile{flex:0 0 auto !important;min-width:auto !important}',
      '  #qc7-sources .dp-pf-launch{flex:0 0 auto !important;align-self:center !important;margin-left:auto !important;padding-top:10px !important;padding-bottom:10px !important}',
      '}',
      /* Abrufen-Button = goldenes Pill wie Objekt-Tab (v601 ist nur auf #obj-action-bar
         gescoped; QC fiel auf die weisse v597-Regel zurueck). Gilt auch auf Mobile. */
      '#qc7-sources .dp-pf-launch,#qc7-sources .dp-pf-launch:hover,#qc7-sources .dp-pf-launch:focus,#qc7-sources .dp-pf-launch:active{background:linear-gradient(180deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C)) !important;color:#1a1407 !important;border:none !important;box-shadow:0 2px 6px -2px rgba(0,0,0,.30) !important;filter:none !important;opacity:1 !important}',
      '#qc7-sources .dp-pf-launch:hover{filter:brightness(1.04) !important}',
      '#qc7-sources .dp-pf-launch .dp-pf-ic,#qc7-sources .dp-pf-launch .dp-pf-ic svg{color:#1a1407 !important;stroke:#1a1407 !important}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'dp-qc-parity';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  // dp-Feld (vom Picker) -> QC-Feld-ID
  var MAP = {
    kp: 'qc_kp', wfl: 'qc_wfl', baujahr: 'qc_bj', nkm: 'qc_nkm',
    str: 'qc_str', hnr: 'qc_hnr', plz: 'qc_plz', ort: 'qc_ort', objart: 'qc_objektart',
  };

  function setQc(qcId, v) {
    var el = document.getElementById(qcId);
    if (!el || v == null || v === '') return false;
    el.value = v;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    return true;
  }

  /* v2199 · Hinweis unter dem Strassenfeld, solange das Inserat keine
     Anschrift fuehrt. Tippt jemand eine Strasse ein, verschwindet er. */
  function _ortskernHinweis(el, wo) {
    var feld = el.closest ? el.closest('.field') : el.parentNode;
    var alt = document.getElementById('qc-ortskern-hinweis'); if (alt) alt.remove();
    el.placeholder = wo ? 'nicht veröffentlicht' : 'Dresdenstraße';
    if (!wo || !feld) return;
    var h = document.createElement('div');
    h.id = 'qc-ortskern-hinweis';
    h.style.cssText = 'font-size:11px;line-height:1.35;color:#665C49;margin-top:4px';
    h.textContent = 'Inserat ohne Straße — Marktpreis und Bodenrichtwert vom Ortskern ' + wo + '. Straße nachtragen macht es genauer.';
    feld.appendChild(h);
    if (!el._v2199) {
      el._v2199 = 1;
      el.addEventListener('input', function () {
        if (String(el.value || '').trim()) { delete el.dataset.ortskern; var x = document.getElementById('qc-ortskern-hinweis'); if (x) x.remove(); }
      });
    }
  }

  function fillQc(picked) {
    if (!picked) return;
    var n = 0;
    /* v2199 · Kommt eine neue Anschrift (PLZ oder Ort), gehoeren Strasse und
       Nummer dazu - auch wenn das Inserat sie nicht nennt. Sonst bliebe die
       Strasse des vorherigen Objekts neben dem neuen Ort stehen. */
    var _str = document.getElementById('qc_str');
    if ((picked.plz || picked.ort) && !picked.str) {
      ['qc_str', 'qc_hnr'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.value) { el.value = ''; try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }
      });
      /* Inserat ohne Anschrift: die Strassen-Pflicht gilt als erfuellt, der
         Ortskern steht sichtbar am Feld (quickcheck-app.html completeness). */
      if (_str) { _str.dataset.ortskern = '1'; _ortskernHinweis(_str, [picked.plz, picked.ort].filter(Boolean).join(' ')); }
    } else if (_str && picked.str) {
      delete _str.dataset.ortskern; _ortskernHinweis(_str, null);
    }
    Object.keys(MAP).forEach(function (k) {
      if (picked[k] != null && picked[k] !== '') { if (setQc(MAP[k], picked[k])) n++; }
    });
    try { if (typeof mieteAddUp === 'function') mieteAddUp(); } catch (e) {}
    try { if (typeof showToast === 'function') showToast('\u2713 ' + n + ' Felder aus ImmoMetrica \u00fcbernommen'); } catch (e) {}
    try { console.log('[immometrica-qc] gefuellt:', n, 'Felder'); } catch (e) {}
  }

  function ready(cb) {
    if (P && P.ImmoMetricaImport && typeof P.ImmoMetricaImport.isReady === 'function') P.ImmoMetricaImport.isReady(cb);
    else cb(false);
  }

  function injectTile(bar) {
    if (!bar || bar.querySelector('[data-src="immometrica"]')) return;
    var tile = document.createElement('label');
    tile.className = 'qc7-src dp-pf-tile tool dp-pf-disabled';
    tile.setAttribute('data-src', 'immometrica');
    tile.id = 'qc-imo-tile';
    tile.title = 'ImmoMetrica: Zug\u00e4nge erforderlich \u2014 Einstellungen';
    tile.innerHTML = '<input type="checkbox" value="immometrica" style="display:none" disabled>' +
      '<span class="dp-pf-ic">' + ICON + '</span><span class="dp-pf-lbl">ImmoMetrica</span><span class="dp-pf-led"></span>';
    // Platzierung: direkt NACH dem Voice-(bzw. Import-)Tile in der "Daten einlesen"-Reihe,
    // NICHT ans Bar-Ende (sonst landet es hinter Barcode/Abrufen).
    var anchorTile = bar.querySelector('[data-src="voice"]') || bar.querySelector('[data-src="import"]');
    if (anchorTile && anchorTile.parentNode) { anchorTile.parentNode.insertBefore(tile, anchorTile.nextSibling); }
    else { bar.appendChild(tile); }
    // Paritaet zum Objekt-Tab: Voice-Label "Sprachaufzeichnung" -> "Sprache"
    try {
      var vl = bar.querySelector('[data-src="voice"] .dp-pf-lbl');
      if (vl && /Sprachaufzeichnung/i.test(vl.textContent)) vl.textContent = 'Sprache';
    } catch (e) {}
    var _cb = tile.querySelector('input[type=checkbox]');
    ready(function (ok) {
      if (ok) { tile.classList.remove('dp-pf-disabled'); tile.title = 'Aus ImmoMetrica importieren'; if (_cb) _cb.disabled = false; }
    });
    // v667: Klick = Lampe an/aus (kein Direkt-Open). Bei deaktiviert -> Hinweis.
    tile.addEventListener('click', function () {
      if (tile.classList.contains('dp-pf-disabled')) {
        try { if (typeof showToast === 'function') showToast('ImmoMetrica: bitte Zugang in den Einstellungen speichern'); } catch (e) {}
      }
    });
    // LED + Credit-Hinweis wie die anderen Quellen (nutzt QcApp.toggleSource, falls vorhanden)
    if (_cb) _cb.addEventListener('change', function () {
      tile.classList.toggle('on', _cb.checked);
      try { if (window.QcApp && typeof window.QcApp.toggleSource === 'function') window.QcApp.toggleSource(_cb); } catch (e) {}
    });
  }

  function findBarAndInject() {
    var bar = document.getElementById('qc7-sources');
    if (bar) injectTile(bar);
    return !!bar;
  }

  // v667: fillQc fuer den QC-Abruf-Schritt (_runSelected) exponieren
  try { window.ImmoMetricaQcFill = fillQc; } catch (e) {}

  // Initial: Parity-CSS sofort, dann warten bis die Leiste existiert
  injectParityCss();
  var tries = 0;
  (function autoInit() {
    injectParityCss();
    if (findBarAndInject()) return;
    if (tries++ < 60) setTimeout(autoInit, 300);
  })();

  // Re-Injection, falls QC die Leiste neu rendert
  try {
    var obs = new MutationObserver(function () {
      var bar = document.getElementById('qc7-sources');
      if (bar && !bar.querySelector('[data-src="immometrica"]')) injectTile(bar);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
})();
