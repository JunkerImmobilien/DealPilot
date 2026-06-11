'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   DealPilot v369 — Objekt-Tab Aktionsleiste

   ÄNDERUNGEN ggü. v367:
   - KOMBI-IMPORT FIX: Antwort-Shape { extracted:{…} } korrekt auspacken,
     echte Backend-Feldnamen (lage_einkaufen, verkehrswert, wertentwicklung_*…),
     + manueller Typ-Umschalter pro Datei (Auto/Exposé/Marktbericht).
   - AVM-CARD wie QuickCheck: Spanne unten–Ø–oben (gewählte gold), €/m²,
     ±% vs. Kaufpreis + Label, Marktmiete kalt — + "In Felder übernehmen" +
     minimierbar (Chevron).
   - Spanne-Segmented: gewählte Option sichtbar (gold, !important).
   - KI-Recherche aus der Leiste entfernt (eigene KI-Lage-Karte bleibt).
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  var MOUNT_ID = 'obj-action-bar';
  var _span = 'mid';
  var _avm = {};
  var _avmHealth = null;
  var _collapsed = {};
  var _oabiDone = null;  /* v393: Kombi-Flow Completion */
  var _qcMode = false;            /* v418: Import aus dem Quick-Check */
  var _qcPendingMerged = {};      /* v418: Bucket B+C -> beim qc-save ins Objekt */
  var OBJ2QC = { str:'qc_str', hnr:'qc_hnr', plz:'qc_plz', ort:'qc_ort', wfl:'qc_wfl', baujahr:'qc_bj', zimmer:'qc_zimmer', objart:'qc_objektart', kp:'qc_kp', nkm:'qc_nkm', hg_ul:'qc_hg', ek:'qc_ek', ds2_energie:'qc_energieklasse', stellpl_aussen:'qc_stellplatz',
    /* v506-obj2qc: Finanzierung + Mieten-Einzelposten (Sprachaufzeichnung) */
    d1z:'qc_zins', d1t:'qc_tilg', ze_stp:'qc_nkm_stp', ze_kueche:'qc_nkm_kueche', ze_sonst:'qc_nkm_sonst' };  /* v418: Bucket A */

  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e ? (e.value || '').trim() : ''; }
  function toast(m) { try { if (typeof window.toast === 'function') return window.toast(m); } catch (e) {} try { console.log('[obj-actions]', m); } catch (e) {} }
  function token() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function fmt0(n) { try { return new Intl.NumberFormat('de-DE').format(Math.round(n)); } catch (e) { return String(n); } }
  function escH(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function numDe(v) { if (v == null || v === '') return null; var n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isNaN(n) ? null : n; }

  var ICO = {
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="8" y2="6"/><line x1="12" y1="6" x2="12" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    chevron: '<polyline points="6 9 12 15 18 9"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
    analyze: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="21" y1="21" x2="15.2" y2="15.2"/><line x1="8" y1="11.5" x2="8" y2="9.5"/><line x1="10.5" y1="11.5" x2="10.5" y2="7.5"/><line x1="13" y1="11.5" x2="13" y2="10"/>'
  };
  function svg(name, size, stroke) { var p = ICO[name] || ''; var s = size || 14; return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="' + (stroke || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }

  function mainInputs() { /* v438-num-fix: numerische Felder als Zahl senden (73.31 darf nicht zu 7331 werden) */ return { plz: val('plz'), ort: val('ort'), str: val('str'), hnr: val('hnr'), objektart: val('objart'), wfl: numDe(val('wfl')), baujahr: numDe(val('baujahr')), kp: numDe(val('kp')) }; }
  var REQUIRED = {
    pricehubble: [['plz', 'PLZ'], ['ort', 'Ort'], ['str', 'Straße'], ['hnr', 'Hausnummer'], ['objektart', 'Objektart'], ['wfl', 'Wohnfläche']],
    sprengnetter: [['plz', 'PLZ'], ['ort', 'Ort'], ['objektart', 'Objektart'], ['wfl', 'Wohnfläche']]
  };
  function missingFor(p) { var i = mainInputs(); return (REQUIRED[p] || []).filter(function (f) { return !i[f[0]] || String(i[f[0]]).trim() === ''; }).map(function (f) { return f[1]; }); }

  /* ── CSS (exakte QuickCheck-Klassen, scoped) ───────────────────── */
  function injectCss() {
    /* v600-reinject: veraltetes oab-style ersetzen statt blind behalten */
    var _old = $('oab-style');
    if (_old) {
      if (_old.textContent && _old.textContent.indexOf('E8CC7A') > -1) return;
      if (_old.parentNode) _old.parentNode.removeChild(_old);
    }
    var P = '#' + MOUNT_ID + ' ';
    var css = [
      '[data-v365-top]{display:none!important}',
      P + '.actions{display:flex;gap:10px;margin:0 0 14px;flex-wrap:wrap;align-items:center;padding:13px 16px;background:linear-gradient(180deg,#ffffff,#fdfbf6);border:1px solid rgba(201,168,76,0.30);border-radius:14px;box-shadow:0 1px 2px rgba(42,39,39,0.04),0 10px 24px -16px rgba(201,168,76,0.55)}',
      P + '.actions-label{font-size:10.5px;font-weight:700;color:var(--gold-3,#9a7f33);letter-spacing:.14em;text-transform:uppercase;margin-right:6px}',
      P + '.qc7-sources{display:inline-flex;flex-wrap:wrap;gap:8px;align-items:center}',
      P + ".qc7-src{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border:1px solid rgba(42,39,39,0.16);border-radius:11px;background:#fff;cursor:pointer;font:600 13px/1 'DM Sans',system-ui,sans-serif;color:var(--ch,#2A2727);transition:border-color .15s ease,background .15s ease,box-shadow .15s ease,transform .12s ease;user-select:none}",
      P + '.qc7-src:hover{border-color:rgba(201,168,76,0.6);box-shadow:0 4px 12px -6px rgba(201,168,76,0.45);transform:translateY(-1px)}',
      P + '.dp-pf-tile[data-src="import"]{border-color:rgba(201,168,76,0.5);box-shadow:0 2px 10px -5px rgba(201,168,76,0.45)}',
      P + '.qc7-src input{display:none}',
      P + '.qc7-src .qc7-box{width:18px;height:18px;flex-shrink:0;border:2px solid rgba(42,39,39,0.26);border-radius:6px;display:inline-flex;align-items:center;justify-content:center;transition:background .15s ease,border-color .15s ease}',
      P + '.qc7-src .qc7-box svg{width:12px;height:12px;opacity:0;transition:opacity .12s ease}',
      P + '.qc7-src.on{border-color:var(--gold,#C9A84C);background:linear-gradient(180deg,rgba(201,168,76,0.16),rgba(201,168,76,0.06));box-shadow:0 2px 8px -3px rgba(201,168,76,0.45)}',
      P + '.qc7-src.on .qc7-box{background:var(--gold,#C9A84C);border-color:var(--gold,#C9A84C)}',
      P + '.qc7-src.on .qc7-box svg{opacity:1}',
      P + '.qc7-src .qc7-ic{display:inline-flex;color:var(--gold-3,#9a7f33)}',
      P + ".oab-act{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border:1px solid rgba(42,39,39,0.16);border-radius:11px;background:#fff;cursor:pointer;font:600 13px/1 'DM Sans',system-ui,sans-serif;color:var(--ch,#2A2727);transition:border-color .15s ease,background .15s ease,box-shadow .15s ease,transform .12s ease}",
      P + '.oab-act:hover{border-color:rgba(201,168,76,0.6);box-shadow:0 4px 12px -6px rgba(201,168,76,0.45);transform:translateY(-1px)}',
      P + '.oab-act .qc7-ic{display:inline-flex}',
      P + '#oab-run{margin-left:auto}',  /* v394: Abrufen rechts */
      P + '#oab-run.dp-pf-launch{background:linear-gradient(180deg,#E8CC7A,#C9A84C);color:#1a1407;border:none;box-shadow:0 2px 6px -2px rgba(0,0,0,.30);transform:none}',  /* v599-gold */
      P + '#oab-run.dp-pf-launch:hover,#oab-run.dp-pf-launch:focus,#oab-run.dp-pf-launch:active{background:linear-gradient(180deg,#E8CC7A,#C9A84C);color:#1a1407;border:none;box-shadow:0 2px 6px -2px rgba(0,0,0,.30);transform:none;filter:brightness(1.04);opacity:1}',  /* v599-gold */
      '#brw-ai-btn{display:none!important}',  /* v389: BRW-Schaetzen dauerhaft aus (ueberlebt Re-Render) */
      P + '.qc6-seg{display:inline-flex;border:1px solid rgba(201,168,76,0.4);border-radius:11px;overflow:hidden;background:rgba(248,246,241,0.7)}',
      P + ".qc6-seg button{appearance:none;border:0;background:transparent;padding:7px 14px;font:600 13px/1 'DM Sans',system-ui,sans-serif;color:var(--ch2,#6b6660);cursor:pointer;transition:background .18s ease,color .18s ease;white-space:nowrap}",
      P + '.qc6-seg button + button{border-left:1px solid rgba(201,168,76,0.25)}',
      P + '.qc6-seg button:hover{color:var(--ch,#2A2727)}',
      P + '.qc6-seg button.sel{background:linear-gradient(180deg,#d4b65a,#bd9c3f)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.25)}',  /* sichtbar */
      P + '.avmx-spancol{display:flex;align-items:center}',
      P + '.avmx-spanbox{display:flex;flex-direction:column;gap:6px;align-items:flex-start;justify-content:center}',  /* v393: Spanne rechts neben Marktmiete */
      P + '.qc6-seg-wrap{display:inline-flex;align-items:center;gap:8px}',
      P + ".qc6-seg-lbl{font:600 12px/1 'DM Sans',system-ui,sans-serif;color:var(--ch2,#6b6660);letter-spacing:.02em}",
      P + ".qc6-run{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border:0;border-radius:11px;background:linear-gradient(180deg,#d4b65a,#bd9c3f);color:#fff;font:700 13px/1 'DM Sans',system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px -5px rgba(189,156,63,0.7);transition:transform .12s ease,box-shadow .15s ease,filter .15s ease}",
      P + '.qc6-run:hover{transform:translateY(-1px);box-shadow:0 8px 22px -6px rgba(189,156,63,0.85);filter:brightness(1.05)}',
      P + '.qc6-run .ico{display:inline-flex;align-items:center}',
      P + '.qc6-run .ico svg{width:16px;height:16px}',
      P + '.avmx-logo{height:24px;width:auto;max-width:175px;object-fit:contain;vertical-align:middle;margin-left:5px;background:#fff;border:1px solid rgba(42,39,39,0.10);border-radius:7px;padding:4px 11px;box-shadow:0 1px 2px rgba(42,39,39,0.06)}',
      P + ".oab-credit-hint{display:inline-flex;align-items:center;gap:8px;margin:-4px 2px 12px;padding:8px 12px;font:500 12px/1.3 'DM Sans',system-ui,sans-serif;color:var(--ch2,#6b6660);background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.22);border-radius:9px}",
      P + '.oab-credit-hint b{color:var(--ch,#2A2727);font-weight:700}',
      P + '.oab-credit-dot{width:7px;height:7px;border-radius:50%;background:var(--gold,#C9A84C);flex-shrink:0;box-shadow:0 0 0 3px rgba(201,168,76,0.18)}',
      P + '.qc6-seg-wrap{display:inline-flex;align-items:center;gap:8px;margin-left:auto}',
      P + ".btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--white,#fff);border:1px solid var(--border,#E7E2DC);border-radius:6px;font:inherit;font-size:12.5px;font-weight:500;color:var(--ch,#2A2727);cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;position:relative}",
      P + '.btn.primary{background:linear-gradient(135deg,var(--gold,#C9A84C),var(--gold-d,#9a7f33));color:#fff;border-color:transparent}',
      P + '.btn.primary:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(201,168,76,0.40)}',
      P + '.btn[disabled]{opacity:.45;cursor:not-allowed}',
      P + '.btn .ico{display:inline-flex;align-items:center}',
      P + '.oab-prog{margin:0 0 12px;font-size:12.5px;color:var(--muted,#7A7370)}',
      P + '.oab-results{display:grid;gap:12px;margin:0 0 14px}',
      /* AVM-Card QuickCheck-Look */
      P + '.avmx{position:relative;background:linear-gradient(135deg,#FDFCF8 0%,#FAF5E8 100%);border:1.5px solid rgba(201,168,76,0.45);border-radius:14px;padding:0;overflow:hidden}',
      P + '.avmx.is-spr{background:linear-gradient(135deg,#FDFCF8 0%,#F7EFD8 100%)}',
      P + '.avmx-head{display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid rgba(201,168,76,0.18)}',
      P + '.avmx-eye{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-3,#9a7f33)}',
      P + '.avmx-prov{font-size:15px;font-weight:700;color:var(--ch,#2A2727)}',
      P + '.avmx-conf{margin-left:auto;font-size:11px;font-weight:700;padding:3px 11px;border-radius:999px;background:rgba(63,165,108,0.15);color:#2E7D4F;text-transform:uppercase;letter-spacing:.04em}',
      P + '.avmx-min{margin-left:8px;width:26px;height:26px;border:1px solid var(--border,#E7E2DC);border-radius:7px;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:var(--ch2,#6b6660);transition:transform .2s}',
      P + '.avmx.collapsed .avmx-min svg{transform:rotate(180deg)}',
      P + '.avmx-body{padding:6px 16px 10px}',
      P + '.avmx.collapsed .avmx-body{display:none}',
      P + '.avmx-chip{display:inline-flex;gap:10px;flex-wrap:wrap;margin:4px 0 2px;padding:4px 10px;background:rgba(255,255,255,0.6);border:1px solid rgba(201,168,76,0.25);border-radius:7px;font-size:11.5px;color:var(--ch2,#6b6660)}',
      P + '.avmx-block{padding:12px 0;border-bottom:1px solid rgba(42,39,39,0.07)}',
      P + '.avmx-block:last-of-type{border-bottom:0}',
      P + '.avmx-bl-l{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--gold-3,#9a7f33);display:flex;align-items:center;gap:5px;margin-bottom:3px}',
      P + ".avmx-big{font-family:'Cormorant Garamond',Georgia,serif;font-size:23px;font-weight:700;color:var(--ch,#2A2727);line-height:1;letter-spacing:-.01em}",
      P + '.avmx-cur{font-size:18px;font-weight:600;opacity:.7}',
      P + '.avmx-span{font-size:12px;color:var(--ch2,#6b6660);margin-left:8px}',
      P + '.avmx-span b{color:var(--gold-3,#9a7f33)}',
      P + '.avmx-sub{font-size:11.5px;color:var(--ch2,#6b6660);margin-top:3px}',
      P + '.avmx-foot{padding:10px 18px;border-top:1px solid rgba(201,168,76,0.18);font-size:11px;color:var(--muted,#7A7370);text-align:center}',
      P + '.avmx-cols{display:grid;grid-template-columns:1fr 1px 1fr 1px auto;gap:16px;align-items:start;padding:2px 0 2px}',
      P + '.avmx-col{min-width:0}',
      P + '.avmx-div{background:rgba(201,168,76,0.30);width:1px;align-self:stretch}',
      P + '.avmx-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;padding-top:7px;border-top:1px solid rgba(201,168,76,0.18)}',
      P + '.avmx-disc{font-size:10.5px;color:var(--muted,#7A7370)}',
      P + ".avmx-apply{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border:1px solid rgba(201,168,76,0.50);border-radius:10px;background:#fff;color:var(--gold-3,#9a7f33);font:600 12.5px/1 'DM Sans',system-ui,sans-serif;cursor:pointer;margin:0;transition:background .15s ease,border-color .15s ease}",
      P + '.avmx-apply:hover{background:rgba(201,168,76,0.08);border-color:var(--gold,#C9A84C)}',
      '.oabi-warn{margin:10px 0 4px;padding:9px 12px;background:rgba(229,168,71,0.12);border:1px solid rgba(229,168,71,0.5);border-radius:8px;font-size:12px;color:#9C7223;line-height:1.45}',
      P + '.avmx-apply{margin:12px 0 2px}',
      /* combined import modal */
      '.oabi-ov{position:fixed;inset:0;background:rgba(20,18,16,0.55);z-index:10001;display:flex;align-items:center;justify-content:center;padding:18px}',
      ".oabi-modal{background:var(--surface,#F8F6F1);border:1px solid rgba(201,168,76,0.35);border-radius:16px;width:min(740px,100%);max-height:90vh;overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,0.28);font-family:'DM Sans',system-ui,sans-serif}",
      '.oabi-head{display:flex;align-items:center;gap:12px;padding:18px 20px 8px}',
      '.oabi-head h3{margin:0;font-size:17px;color:var(--ch,#2A2727)}',
      '.oabi-sub{font-size:12px;color:var(--muted,#7A7370);padding:0 20px 6px}',
      '.oabi-body{padding:8px 20px 20px}',
      '.oabi-drop{border:2px dashed rgba(201,168,76,0.45);border-radius:12px;padding:26px;text-align:center;background:rgba(201,168,76,0.04);cursor:pointer;color:var(--ch,#2A2727)}',
      '.oabi-drop.drag{background:rgba(201,168,76,0.12);border-color:var(--gold,#C9A84C)}',
      '.oabi-files{margin:12px 0;display:grid;gap:6px}',
      '.oabi-file{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:6px 10px;background:#fff;border:1px solid var(--border,#E7E2DC);border-radius:8px}',
      '.oabi-file .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      ".oabi-file select{font:inherit;font-size:11.5px;padding:3px 6px;border:1px solid var(--border,#E7E2DC);border-radius:6px;background:#fff}",
      '.oabi-st{font-size:11px;color:var(--muted,#7A7370);min-width:64px;text-align:right}',
      '.oabi-tbl{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}',
      '.oabi-tbl td{padding:7px 8px;border-bottom:1px solid rgba(42,39,39,0.07)}',
      '.oabi-tbl .src{font-size:10.5px;color:#9a7f33}',
      '.oabi-span{display:inline-flex;margin-left:8px;border:1px solid rgba(201,168,76,0.45);border-radius:7px;overflow:hidden;vertical-align:middle}',
      ".oabi-spbtn{padding:2px 7px;border:0;border-right:1px solid rgba(201,168,76,0.30);background:#fff;cursor:pointer;font:600 11px/1.4 'DM Sans',system-ui,sans-serif;color:var(--ch2,#6b6660)}",
      '.oabi-spbtn:last-child{border-right:0}',
      '.oabi-spbtn.on{background:var(--gold,#C9A84C);color:#fff}',
      '.oabi-addr{margin:10px 0 4px;padding:10px 12px;background:rgba(229,168,71,0.10);border:1px solid rgba(229,168,71,0.45);border-radius:8px}',
      '.oabi-addr-h{font-size:12px;font-weight:700;color:#9C7223;margin-bottom:6px}',
      ".oabi-addr-opt{display:block;font-size:12.5px;color:var(--ch,#2A2727);padding:3px 0;cursor:pointer;font-family:'DM Sans',system-ui,sans-serif}",
      '.oabi-addr-opt .src{font-size:10.5px;color:#9a7f33}',
      '.oabi-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid rgba(42,39,39,0.08)}',
      '.oabi-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid var(--border,#E7E2DC);border-radius:8px;background:#fff;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;color:var(--ch,#2A2727)}',
      '.oabi-btn.primary{background:linear-gradient(135deg,var(--gold,#C9A84C),var(--gold-d,#9a7f33));color:#fff;border-color:transparent}',
      '.oabi-btn[disabled]{opacity:.5;cursor:not-allowed}',
      '.oab-missing-hl{outline:2px solid #E5A847;border-radius:6px}',
      '.oab-note{font-size:11px;color:var(--muted,#7A7370);margin-top:2px}',
      '#ki-lage-min{width:28px;height:28px;border:1px solid var(--border,#E7E2DC);border-radius:7px;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:var(--ch2,#6b6660);margin-left:8px;vertical-align:middle;transition:transform .2s}',
      '#ki-lage-btn{margin-left:auto}',
      '.qc7-logo{height:16px;width:auto;max-width:120px;object-fit:contain;display:inline-block;vertical-align:middle;mix-blend-mode:multiply}',
      '#ki-lage-box.ki-lage-box{padding:10px 16px !important;margin-top:10px !important}',
      '#ki-lage-box .ki-lage-header{margin-bottom:4px !important}',
      '#ki-lage-box .ki-lage-empty{margin:0 !important;padding:2px 0 0 !important;font-size:12px !important;line-height:1.35 !important}',
      '#ki-lage-min.collapsed svg{transform:rotate(-90deg)}'
    ].join('\n');
    var st = document.createElement('style'); st.id = 'oab-style'; st.textContent = css; document.head.appendChild(st);
  }

  /* ── Leiste (ohne KI-Recherche) ────────────────────────────────── */
  function srcLabel(value, icoName, text, disabled) {
    return '<label class="qc7-src" data-src="' + value + '"' + (disabled ? ' title="Marktradar derzeit deaktiviert"' : '') + '>' +
      '<input type="checkbox" value="' + value + '"' + (disabled ? ' disabled' : '') + '>' +
      '<span class="qc7-box">' + svg('check', 12, '#fff') + '</span>' +
      '<span class="qc7-ic">' + svg(icoName, 14) + '</span> ' + text + '</label>';
  }
  function srcLabelImg(value, img, alt, disabled) {
    return '<label class="qc7-src" data-src="' + value + '"' + (disabled ? ' title="Marktradar derzeit deaktiviert"' : '') + '>' +
      '<input type="checkbox" value="' + value + '"' + (disabled ? ' disabled' : '') + '>' +
      '<span class="qc7-box">' + svg('check', 12, '#fff') + '</span>' +
      '<img class="qc7-logo" src="' + img + '" alt="' + alt + '" title="' + alt + '">' + '</label>';
  }
  function render() {
    var mount = $(MOUNT_ID); if (!mount) return;
    var avmOff = !(_avmHealth && _avmHealth.available);
    var _doc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
    var _mic = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>';
    var _plane = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>';
    // PRE-FLIGHT-Kachel mit verstecktem Checkbox-Input (Logik unveraendert) + LED an .on
    function pfTileLogo(value, inner, disabled, title) {
      return '<label class="dp-pf-tile' + (disabled ? ' dp-pf-disabled' : '') + '" data-src="' + value + '"' + (title ? ' title="' + title + '"' : '') + '>' +
        '<input type="checkbox" value="' + value + '"' + (disabled ? ' disabled' : '') + ' style="display:none">' +
        inner + '<span class="dp-pf-led"></span></label>';
    }
    function pfTileTool(value, icoSvg, label, title) {
      return '<label class="dp-pf-tile tool" data-src="' + value + '"' + (title ? ' title="' + title + '"' : '') + '>' +
        '<input type="checkbox" value="' + value + '" style="display:none">' +
        '<span class="dp-pf-ic">' + icoSvg + '</span><span class="dp-pf-lbl">' + label + '</span>' +
        '<span class="dp-pf-led"></span></label>';
    }
    var _phInner = '<span class="dp-pf-logo"><img src="img/pricehubble.jpg" alt="PriceHubble"></span>';
    var _snInner = '<span class="dp-pf-logo"><img src="img/sprengnetter.jpg" alt="Sprengnetter"></span>';
    var _dpInner = '<span class="dp-pf-logo dp">Deal<b>Pilot</b></span>';
      var _qrSvg = '<svg class="dp-qr" viewBox="0 0 37 37" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-label="QR DealPilot"><rect width="37" height="37" fill="#fff"/><path d="M4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM8 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM13 4h1v1h-1zM17 4h1v1h-1zM20 4h1v1h-1zM22 4h1v1h-1zM23 4h1v1h-1zM24 4h1v1h-1zM26 4h1v1h-1zM27 4h1v1h-1zM28 4h1v1h-1zM29 4h1v1h-1zM30 4h1v1h-1zM31 4h1v1h-1zM32 4h1v1h-1zM4 5h1v1h-1zM10 5h1v1h-1zM14 5h1v1h-1zM15 5h1v1h-1zM16 5h1v1h-1zM19 5h1v1h-1zM24 5h1v1h-1zM26 5h1v1h-1zM32 5h1v1h-1zM4 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM13 6h1v1h-1zM14 6h1v1h-1zM15 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM23 6h1v1h-1zM26 6h1v1h-1zM28 6h1v1h-1zM29 6h1v1h-1zM30 6h1v1h-1zM32 6h1v1h-1zM4 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1zM10 7h1v1h-1zM12 7h1v1h-1zM17 7h1v1h-1zM18 7h1v1h-1zM21 7h1v1h-1zM23 7h1v1h-1zM26 7h1v1h-1zM28 7h1v1h-1zM29 7h1v1h-1zM30 7h1v1h-1zM32 7h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM12 8h1v1h-1zM13 8h1v1h-1zM14 8h1v1h-1zM17 8h1v1h-1zM23 8h1v1h-1zM24 8h1v1h-1zM26 8h1v1h-1zM28 8h1v1h-1zM29 8h1v1h-1zM30 8h1v1h-1zM32 8h1v1h-1zM4 9h1v1h-1zM10 9h1v1h-1zM12 9h1v1h-1zM13 9h1v1h-1zM16 9h1v1h-1zM17 9h1v1h-1zM18 9h1v1h-1zM19 9h1v1h-1zM21 9h1v1h-1zM22 9h1v1h-1zM26 9h1v1h-1zM32 9h1v1h-1zM4 10h1v1h-1zM5 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM8 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM12 10h1v1h-1zM14 10h1v1h-1zM16 10h1v1h-1zM18 10h1v1h-1zM20 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM26 10h1v1h-1zM27 10h1v1h-1zM28 10h1v1h-1zM29 10h1v1h-1zM30 10h1v1h-1zM31 10h1v1h-1zM32 10h1v1h-1zM12 11h1v1h-1zM13 11h1v1h-1zM16 11h1v1h-1zM18 11h1v1h-1zM20 11h1v1h-1zM22 11h1v1h-1zM23 11h1v1h-1zM24 11h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM7 12h1v1h-1zM8 12h1v1h-1zM9 12h1v1h-1zM10 12h1v1h-1zM13 12h1v1h-1zM14 12h1v1h-1zM16 12h1v1h-1zM21 12h1v1h-1zM22 12h1v1h-1zM23 12h1v1h-1zM26 12h1v1h-1zM27 12h1v1h-1zM28 12h1v1h-1zM29 12h1v1h-1zM30 12h1v1h-1zM4 13h1v1h-1zM6 13h1v1h-1zM7 13h1v1h-1zM9 13h1v1h-1zM11 13h1v1h-1zM14 13h1v1h-1zM16 13h1v1h-1zM17 13h1v1h-1zM20 13h1v1h-1zM21 13h1v1h-1zM22 13h1v1h-1zM23 13h1v1h-1zM24 13h1v1h-1zM26 13h1v1h-1zM27 13h1v1h-1zM28 13h1v1h-1zM32 13h1v1h-1zM4 14h1v1h-1zM8 14h1v1h-1zM9 14h1v1h-1zM10 14h1v1h-1zM11 14h1v1h-1zM12 14h1v1h-1zM13 14h1v1h-1zM14 14h1v1h-1zM16 14h1v1h-1zM17 14h1v1h-1zM18 14h1v1h-1zM19 14h1v1h-1zM20 14h1v1h-1zM24 14h1v1h-1zM25 14h1v1h-1zM28 14h1v1h-1zM7 15h1v1h-1zM8 15h1v1h-1zM11 15h1v1h-1zM12 15h1v1h-1zM15 15h1v1h-1zM16 15h1v1h-1zM17 15h1v1h-1zM19 15h1v1h-1zM20 15h1v1h-1zM24 15h1v1h-1zM25 15h1v1h-1zM27 15h1v1h-1zM29 15h1v1h-1zM31 15h1v1h-1zM4 16h1v1h-1zM8 16h1v1h-1zM9 16h1v1h-1zM10 16h1v1h-1zM11 16h1v1h-1zM12 16h1v1h-1zM16 16h1v1h-1zM18 16h1v1h-1zM19 16h1v1h-1zM21 16h1v1h-1zM24 16h1v1h-1zM29 16h1v1h-1zM30 16h1v1h-1zM5 17h1v1h-1zM9 17h1v1h-1zM11 17h1v1h-1zM16 17h1v1h-1zM20 17h1v1h-1zM21 17h1v1h-1zM22 17h1v1h-1zM23 17h1v1h-1zM24 17h1v1h-1zM25 17h1v1h-1zM26 17h1v1h-1zM27 17h1v1h-1zM28 17h1v1h-1zM32 17h1v1h-1zM4 18h1v1h-1zM5 18h1v1h-1zM6 18h1v1h-1zM10 18h1v1h-1zM11 18h1v1h-1zM12 18h1v1h-1zM13 18h1v1h-1zM15 18h1v1h-1zM19 18h1v1h-1zM20 18h1v1h-1zM22 18h1v1h-1zM25 18h1v1h-1zM26 18h1v1h-1zM27 18h1v1h-1zM28 18h1v1h-1zM29 18h1v1h-1zM30 18h1v1h-1zM5 19h1v1h-1zM7 19h1v1h-1zM8 19h1v1h-1zM11 19h1v1h-1zM12 19h1v1h-1zM14 19h1v1h-1zM18 19h1v1h-1zM19 19h1v1h-1zM23 19h1v1h-1zM28 19h1v1h-1zM31 19h1v1h-1zM4 20h1v1h-1zM6 20h1v1h-1zM9 20h1v1h-1zM10 20h1v1h-1zM11 20h1v1h-1zM12 20h1v1h-1zM15 20h1v1h-1zM16 20h1v1h-1zM21 20h1v1h-1zM23 20h1v1h-1zM29 20h1v1h-1zM30 20h1v1h-1zM4 21h1v1h-1zM9 21h1v1h-1zM15 21h1v1h-1zM17 21h1v1h-1zM18 21h1v1h-1zM20 21h1v1h-1zM21 21h1v1h-1zM22 21h1v1h-1zM23 21h1v1h-1zM24 21h1v1h-1zM25 21h1v1h-1zM26 21h1v1h-1zM27 21h1v1h-1zM28 21h1v1h-1zM30 21h1v1h-1zM32 21h1v1h-1zM4 22h1v1h-1zM7 22h1v1h-1zM10 22h1v1h-1zM11 22h1v1h-1zM13 22h1v1h-1zM15 22h1v1h-1zM17 22h1v1h-1zM18 22h1v1h-1zM19 22h1v1h-1zM26 22h1v1h-1zM27 22h1v1h-1zM28 22h1v1h-1zM30 22h1v1h-1zM4 23h1v1h-1zM6 23h1v1h-1zM11 23h1v1h-1zM12 23h1v1h-1zM14 23h1v1h-1zM17 23h1v1h-1zM19 23h1v1h-1zM20 23h1v1h-1zM23 23h1v1h-1zM24 23h1v1h-1zM25 23h1v1h-1zM27 23h1v1h-1zM28 23h1v1h-1zM31 23h1v1h-1zM4 24h1v1h-1zM7 24h1v1h-1zM8 24h1v1h-1zM10 24h1v1h-1zM11 24h1v1h-1zM16 24h1v1h-1zM18 24h1v1h-1zM21 24h1v1h-1zM23 24h1v1h-1zM24 24h1v1h-1zM25 24h1v1h-1zM26 24h1v1h-1zM27 24h1v1h-1zM28 24h1v1h-1zM30 24h1v1h-1zM31 24h1v1h-1zM32 24h1v1h-1zM12 25h1v1h-1zM14 25h1v1h-1zM15 25h1v1h-1zM20 25h1v1h-1zM21 25h1v1h-1zM22 25h1v1h-1zM24 25h1v1h-1zM28 25h1v1h-1zM29 25h1v1h-1zM30 25h1v1h-1zM31 25h1v1h-1zM32 25h1v1h-1zM4 26h1v1h-1zM5 26h1v1h-1zM6 26h1v1h-1zM7 26h1v1h-1zM8 26h1v1h-1zM9 26h1v1h-1zM10 26h1v1h-1zM19 26h1v1h-1zM20 26h1v1h-1zM23 26h1v1h-1zM24 26h1v1h-1zM26 26h1v1h-1zM28 26h1v1h-1zM29 26h1v1h-1zM30 26h1v1h-1zM4 27h1v1h-1zM10 27h1v1h-1zM12 27h1v1h-1zM13 27h1v1h-1zM14 27h1v1h-1zM15 27h1v1h-1zM16 27h1v1h-1zM18 27h1v1h-1zM19 27h1v1h-1zM24 27h1v1h-1zM28 27h1v1h-1zM31 27h1v1h-1zM32 27h1v1h-1zM4 28h1v1h-1zM6 28h1v1h-1zM7 28h1v1h-1zM8 28h1v1h-1zM10 28h1v1h-1zM12 28h1v1h-1zM13 28h1v1h-1zM14 28h1v1h-1zM16 28h1v1h-1zM21 28h1v1h-1zM24 28h1v1h-1zM25 28h1v1h-1zM26 28h1v1h-1zM27 28h1v1h-1zM28 28h1v1h-1zM30 28h1v1h-1zM4 29h1v1h-1zM6 29h1v1h-1zM7 29h1v1h-1zM8 29h1v1h-1zM10 29h1v1h-1zM12 29h1v1h-1zM13 29h1v1h-1zM17 29h1v1h-1zM18 29h1v1h-1zM20 29h1v1h-1zM21 29h1v1h-1zM22 29h1v1h-1zM29 29h1v1h-1zM30 29h1v1h-1zM31 29h1v1h-1zM32 29h1v1h-1zM4 30h1v1h-1zM6 30h1v1h-1zM7 30h1v1h-1zM8 30h1v1h-1zM10 30h1v1h-1zM12 30h1v1h-1zM13 30h1v1h-1zM14 30h1v1h-1zM17 30h1v1h-1zM19 30h1v1h-1zM21 30h1v1h-1zM23 30h1v1h-1zM25 30h1v1h-1zM26 30h1v1h-1zM27 30h1v1h-1zM28 30h1v1h-1zM29 30h1v1h-1zM30 30h1v1h-1zM31 30h1v1h-1zM4 31h1v1h-1zM10 31h1v1h-1zM13 31h1v1h-1zM14 31h1v1h-1zM15 31h1v1h-1zM16 31h1v1h-1zM23 31h1v1h-1zM24 31h1v1h-1zM26 31h1v1h-1zM28 31h1v1h-1zM29 31h1v1h-1zM31 31h1v1h-1zM4 32h1v1h-1zM5 32h1v1h-1zM6 32h1v1h-1zM7 32h1v1h-1zM8 32h1v1h-1zM9 32h1v1h-1zM10 32h1v1h-1zM12 32h1v1h-1zM15 32h1v1h-1zM17 32h1v1h-1zM18 32h1v1h-1zM19 32h1v1h-1zM21 32h1v1h-1zM23 32h1v1h-1zM26 32h1v1h-1zM27 32h1v1h-1zM28 32h1v1h-1zM30 32h1v1h-1z" fill="#141210"/></svg>';
    mount.innerHTML =
      '<div class="dp-pf-scroll"><div class="dp-pfbar" id="oab-bar">' +
        '<span class="dp-pf-stripe"></span>' +
        '<div class="dp-pf-lead"><span class="bp">BOARDING PASS</span><span class="k">PRE-FLIGHT</span><span class="s">DealPilot \u00b7 Boarding</span></div><span class="dp-pf-perf"></span>' + /* v572-leadtext */
        '<div class="dp-pf-seg"><span class="dp-pf-grouplbl">Marktbewertung</span><div class="dp-pf-row">' +
          pfTileLogo('pricehubble', _phInner, avmOff, avmOff ? 'Marktradar derzeit deaktiviert' : 'PriceHubble') +
          pfTileLogo('sprengnetter', _snInner, avmOff, avmOff ? 'Marktradar derzeit deaktiviert' : 'Sprengnetter') +
          pfTileLogo('dealpilot', _dpInner, false, 'Marktpreisbewertung') +
        '</div></div>' +
        '<div class="dp-pf-sep"></div>' +
        '<div class="dp-pf-seg"><span class="dp-pf-grouplbl">Daten einlesen</span><div class="dp-pf-row">' +
          pfTileTool('import', _doc, 'Expos\u00e9 / Marktbericht', '') +
          (window.VoiceImport ? pfTileTool('voice', _mic, 'Sprachaufzeichnung', 'Objekt frei einsprechen \u2014 1 L Kerosin') : '') +
        '</div></div>' +
        '<a class="dp-pf-qr" href="https://dealpilot.junker-immobilien.io" target="_blank" rel="noopener" title="DealPilot \u00f6ffnen">' + _qrSvg + '<span class="dp-pf-scan">Scan \u203a</span></a>' + '<span class="dp-pf-rz"><span class="dp-pf-bc"></span>' + '<button type="button" class="dp-pf-launch oab-act" id="oab-run"><span class="dp-pf-ic">' + _plane + '</span> Abrufen</button>' + '</span>' +
      '</div></div>' +
      '<div class="oab-credit-hint" id="oab-credit-hint" style="display:none"></div>' +
      (avmOff ? '<div class="oab-note" style="margin:-6px 0 12px">Marktradar (PriceHubble/Sprengnetter) ist derzeit deaktiviert \u2014 Import funktioniert.</div>' : '') +
      '<div class="oab-prog" id="oab-prog" style="display:none"></div>' +
      '<div class="oab-results" id="oab-results"></div>';
    // v570-pf: initial .on synchronisieren (DealPilot default aktiv) + LED-Kopplung sicherstellen
    try {
      mount.querySelectorAll('.dp-pf-tile').forEach(function (t) {
        var cb = t.querySelector('input[type=checkbox]');
        if (!cb) return;
        if (t.getAttribute('data-src') === 'dealpilot' && !cb.disabled) { cb.checked = true; }
        t.classList.toggle('on', cb.checked);
        if (!cb._v570bound) { cb._v570bound = 1; cb.addEventListener('change', function () { t.classList.toggle('on', cb.checked); try { updateCreditHint(); } catch (e) {} }); }
      });
    } catch (e) {}
    /* v570-pf: alter qc7-src-Listener ersetzt durch dp-pf-tile-Bind im Render */
    $('oab-run').addEventListener('click', runSelected);
    renderResults(); updateCreditHint();
  }
  function updateCreditHint() {
    var el = $('oab-credit-hint'); if (!el) return;
    var sel = selectedSources();
    /* v503-kerosin-hint: Liter statt "Credits" — Saetze gemaess Backend
       (avm.js COST: PriceHubble 40 L, Sprengnetter 20 L; ai.js extract-voice 1 L).
       Frontend zeigt nur an, abgerechnet wird serverseitig. */
    var KEROSIN_L = { voice: 1, pricehubble: 40, sprengnetter: 20 };
    var billed = sel.filter(function (s) { return KEROSIN_L[s] != null; });
    if (!billed.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
    var demo = !!(_avmHealth && _avmHealth.mode === 'stub');
    var _total = 0;
    var parts = billed.map(function (s) {
      var L = KEROSIN_L[s]; _total += L;
      var nm = s === 'voice' ? 'Sprachauswertung' : (s === 'pricehubble' ? 'PriceHubble' : 'Sprengnetter');
      return '<b>' + L + '\u00a0L</b> ' + nm;
    }).join(' + ');
    var txt = 'Beim <b>Abrufen</b> ' + (billed.length > 1 ? 'werden ' : 'wird ') + parts + ' Kerosin verbraucht' + (billed.length > 1 ? ' (' + _total + '\u00a0L gesamt)' : '') + '.';
    if (demo && billed.some(function (s) { return s !== 'voice'; })) txt += ' <span style="opacity:.75">Marktradar im Demo-Modus aktuell kostenlos.</span>';
    el.innerHTML = '<span class="oab-credit-dot"></span>' + txt;
    el.style.display = '';
  }
  function selectedSources() { var out = [], m = $(MOUNT_ID); if (!m) return out; m.querySelectorAll('.dp-pf-tile input:checked').forEach(function (c) { out.push(c.value); }); return out; }
  function setProg(t) { var p = $('oab-prog'); if (p) { p.style.display = t ? '' : 'none'; p.textContent = t || ''; } }

  async function runSelected() {
    var srcs = selectedSources();
    if (!srcs.length) { toast('Bitte mindestens eine Quelle auswählen'); return; }
    var order = ['voice', 'import', 'pricehubble', 'sprengnetter', 'dealpilot'];  /* v503-voice-first */
    var ordered = order.filter(function (s) { return srcs.indexOf(s) !== -1; });
    var btn = $('oab-run'); if (btn) btn.disabled = true;
    for (var i = 0; i < ordered.length; i++) {
      var s = ordered[i];
      try {
        if (s === 'voice') { setProg('Sprachaufzeichnung …'); await new Promise(function (res) { if (window.VoiceImport) { window.VoiceImport.open(res); } else { res(); } }); }  /* v503-voice-run */
        else if (s === 'import') { setProg('Import …'); await new Promise(function (res) { openCombinedImport(res); }); }
        else if (s === 'pricehubble' || s === 'sprengnetter') { setProg((s === 'pricehubble' ? 'PriceHubble' : 'Sprengnetter') + ' …'); await avmFetch(s); }
        else if (s === 'dealpilot') { setProg('DealPilot-Marktbewertung …'); try { if (window.DealPilotMB) await window.DealPilotMB.run(); } catch (e) {} }
      } catch (e) { try { console.warn('[obj-actions] step', s, e); } catch (_) {} }
    }
    setProg(''); if (btn) btn.disabled = false;
  }

  /* ════════════════════ AVM ══════════════════════════════════════ */
  function highlightMissing(p) {
    document.querySelectorAll('.oab-missing-hl').forEach(function (el) { el.classList.remove('oab-missing-hl'); });
    var inp = mainInputs(), first = null;
    (REQUIRED[p] || []).forEach(function (f) { if (!inp[f[0]]) { var el = $(f[0] === 'objektart' ? 'objart' : f[0]); if (el) { el.classList.add('oab-missing-hl'); if (!first) first = el; } } });
    if (first && first.scrollIntoView) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function missingPairs(provider) {
    var i = mainInputs();
    return (REQUIRED[provider] || []).filter(function (f) { return !i[f[0]] || String(i[f[0]]).trim() === ''; });
  }
  function promptMissing(provider) {
    var pairs = missingPairs(provider);
    if (provider === 'sprengnetter') {  /* v393: Straße+Hausnummer immer abfragen, wenn fehlend */
      var _mi = mainInputs();
      [['str', 'Straße'], ['hnr', 'Hausnummer']].forEach(function (f) {
        if ((!_mi[f[0]] || String(_mi[f[0]]).trim() === '') && !pairs.some(function (p) { return p[0] === f[0]; })) pairs.push(f);
      });
    }
    if (!pairs.length) { avmFetch(provider); return; }
    /* v441-inline-missing: kein Modal mehr – Pflichtfelder inline rot markieren */
    try { document.querySelectorAll('.oab-missing-hl').forEach(function(el){ el.classList.remove('oab-missing-hl'); }); } catch (e) {}
    var _firstM441 = null;
    pairs.forEach(function (f) {
      var el = $(f[0] === 'objektart' ? 'objart' : f[0]);
      if (el) { el.classList.add('oab-missing-hl'); if (!_firstM441) _firstM441 = el; }
    });
    if (_firstM441 && _firstM441.scrollIntoView) _firstM441.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Bitte die markierten Pflichtfelder ausf\u00fcllen');
    return;

    var pName = provider === 'pricehubble' ? 'PriceHubble' : 'Sprengnetter';
    var ov = document.createElement('div'); ov.className = 'oabi-ov'; ov.id = 'oab-miss-ov';
    var rows = pairs.map(function (f) {
      var key = f[0], label = f[1];
      if (key === 'objektart') {
        var sel = document.getElementById('objart');
        var opts = sel ? sel.innerHTML : '<option value="">–</option>';
        return '<div class="f"><label>' + escH(label) + '</label><select data-mf="objart">' + opts + '</select></div>';
      }
      return '<div class="f"><label>' + escH(label) + '</label><input type="text" data-mf="' + key + '" value="' + escH(val(key) || '') + '"></div>';
    }).join('');
    ov.innerHTML =
      '<div class="oabi-modal" style="max-width:440px">' +
        '<div class="oabi-head"><span style="color:var(--gold,#C9A84C)">' + svg('analyze', 20) + '</span><h3>Fehlende Angaben — ' + pName + '</h3></div>' +
        '<div class="oabi-sub">Diese Pflichtfelder braucht der Abruf. Eintragen und „Weiter".</div>' +
        '<div class="oabi-body"><div class="g2">' + rows + '</div></div>' +
        '<div class="oabi-foot"><button type="button" class="oabi-btn" id="oab-miss-cancel">Abbrechen</button>' +
          '<button type="button" class="oabi-btn primary" id="oab-miss-go">Weiter</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    var objSel = ov.querySelector('select[data-mf="objart"]');
    if (objSel) { var cur = document.getElementById('objart'); if (cur) objSel.value = cur.value; }
    function close() { var x = $('oab-miss-ov'); if (x) x.remove(); }
    $('oab-miss-cancel').addEventListener('click', close);
    $('oab-miss-go').addEventListener('click', function () {
      ov.querySelectorAll('[data-mf]').forEach(function (el) {
        var id = el.getAttribute('data-mf'), v = el.value;
        if (v != null && String(v).trim() !== '') setInput(id, v);
      });
      close();
      avmFetch(provider);
    });
  }
  async function avmFetch(provider) {
    var miss = missingFor(provider);
    if (miss.length) { promptMissing(provider); return; }
    try {
      var res = await fetch('/api/v1/avm/' + provider, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }, body: JSON.stringify({ inputs: mainInputs() }) });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        if (data && data.needs_credits) toast('⚠ Nicht genug Credits (' + (data.required || '?') + ' nötig)');
        else if (data && data.missing_fields) { promptMissing(provider); }
        else if (data && data.disabled) toast('Marktradar ist derzeit deaktiviert.');
        else toast('⚠ Marktradar-Abruf fehlgeschlagen' + (data && data.message ? ': ' + data.message : ''));
        return;
      }
      if (data && data.result) { _avm[data.result.provider] = data.result; renderResults(); persistAvmState(); toast('✓ ' + data.result.provider + (data.mode === 'stub' ? ' (Demo — kostenlos)' : ' (−' + (data.cost || 0) + ' Credits)')); /* v435-credit-refresh: Header-Marktcredit-Pille live aktualisieren */ if (data.mode !== 'stub') { try { setTimeout(function(){ if (window.AiCredits && typeof window.AiCredits.refreshAvm === 'function') window.AiCredits.refreshAvm(); }, 400); } catch (e) {} } }
    } catch (e) { toast('⚠ Netzwerkfehler beim Marktradar-Abruf'); }
  }
  function pickMW(r) { return _span === 'low' ? r.low : _span === 'high' ? r.high : r.marktwert; }
  function pickMM(r) { return _span === 'low' ? r.marktmieteLow : _span === 'high' ? r.marktmieteHigh : r.marktmieteCold; }
  function spanLabel() { return _span === 'low' ? 'Unten' : _span === 'high' ? 'Oben' : 'Durchschnitt'; }
  function spanRow(lo, mid, hi) {
    function piece(v, sel) { return sel ? '<b>' + fmt0(v) + ' €</b>' : fmt0(v) + ' €'; }
    return 'Spanne ' + piece(lo, _span === 'low') + ' – ' + piece(mid, _span === 'mid') + ' – ' + piece(hi, _span === 'high');
  }
  function applyAvmHealth() {
    var m = $(MOUNT_ID); if (!m) return;
    var off = !(_avmHealth && _avmHealth.available);
    ['pricehubble', 'sprengnetter'].forEach(function (p) {
      var lab = m.querySelector('.dp-pf-tile[data-src="' + p + '"]'); if (!lab) return;
      var cb = lab.querySelector('input'); if (cb) cb.disabled = off;
      if (off) lab.setAttribute('title', 'Marktradar derzeit deaktiviert'); else lab.removeAttribute('title');
      lab.style.opacity = off ? '0.55' : '';
    });
    var note = m.querySelector('.oab-note'); if (!off && note) note.remove();
    try { updateCreditHint(); } catch (e) {}
  }
  function persistAvmState() {
    try {
      var el = document.getElementById('_avm_state');
      if (!el) return;
      el.value = JSON.stringify({ avm: _avm, collapsed: _collapsed });
      el.dispatchEvent(new Event('input', { bubbles: true }));  /* v392: -> Auto-Save persistiert ins JSONB */
    } catch (e) {}
  }
  function restoreAvmState() {
    var el = document.getElementById('_avm_state'), st = null;
    try { if (el && el.value) st = JSON.parse(el.value); } catch (e) {}
    _avm = (st && st.avm && typeof st.avm === 'object') ? st.avm : {};
    _collapsed = (st && st.collapsed && typeof st.collapsed === 'object') ? st.collapsed : {};
    renderResults();
  }
  function renderResults() {
    var host = $('oab-results'); if (!host) return;
    var provs = Object.keys(_avm);
    if (!provs.length) { host.innerHTML = ''; return; }
    host.innerHTML = provs.map(function (p) { return renderCard(_avm[p]); }).join('');
    host.querySelectorAll('[data-apply]').forEach(function (b) { b.addEventListener('click', function () { applyAvm(_avm[b.getAttribute('data-apply')]); }); });
    host.querySelectorAll('[data-min]').forEach(function (b) { b.addEventListener('click', function () { var pr = b.getAttribute('data-min'); _collapsed[pr] = !_collapsed[pr]; renderResults(); persistAvmState(); }); });
    host.querySelectorAll('[data-span]').forEach(function (b) { b.addEventListener('click', function () { _span = b.getAttribute('data-span') || 'mid'; renderResults(); }); });
  }
  function renderCard(r) {
    var isSpr = (r.provider === 'Sprengnetter');
    var wfl = numDe(val('wfl')) || 0, kp = numDe(val('kp')) || 0;
    var mw = pickMW(r), mm = pickMM(r);
    var mwSqm = wfl ? (mw / wfl) : (r.eurPerSqm || null);
    var mmSqm = wfl ? (mm / wfl) : (r.marktmieteEurSqm || null);
    var diff = (kp && mw) ? ((mw - kp) / kp * 100) : null;
    var dLbl = diff == null ? '' : (diff <= -10 ? 'Sehr teuer' : diff <= -3 ? 'Teuer' : diff < 3 ? 'Marktgerecht' : diff < 10 ? 'Günstig' : 'Sehr günstig');
    var dCol = diff == null ? 'var(--muted,#7A7370)' : (diff < -3 ? '#B8625C' : diff > 3 ? '#3FA56C' : 'var(--gold-3,#9a7f33)');
    var coll = !!_collapsed[r.provider];
    var _provImg = r.provider === 'PriceHubble' ? 'img/pricehubble.jpg' : (r.provider === 'Sprengnetter' ? 'img/sprengnetter.jpg' : '');
    var _provHtml = _provImg ? ('<img class="avmx-logo" src="' + _provImg + '" alt="' + escH(r.provider) + '">') : ('<span class="avmx-prov">' + escH(r.provider) + '</span>');
    var chip = '';
    if (r.scoreMicro != null || r.scoreMacro != null || r.wertentwicklung != null) {
      var parts = [];
      if (r.scoreMicro != null) parts.push('Mikro ' + r.scoreMicro);
      if (r.scoreMacro != null) parts.push('Makro ' + r.scoreMacro);
      if (r.wertentwicklung != null) parts.push('Wertentw. ' + (r.wertentwicklung >= 0 ? '+' : '') + r.wertentwicklung.toFixed(1) + '%/J');
      chip = '<div class="avmx-chip">' + parts.map(escH).join(' · ') + '</div>';
    }
    var spanCtl = '<div class="avmx-spanbox"><span class="qc6-seg-lbl">Spanne</span>' +
      '<span class="qc6-seg">' +
        '<button type="button" data-span="low"' + (_span === 'low' ? ' class="sel"' : '') + '>Unten</button>' +
        '<button type="button" data-span="mid"' + (_span === 'mid' ? ' class="sel"' : '') + '>Ø</button>' +
        '<button type="button" data-span="high"' + (_span === 'high' ? ' class="sel"' : '') + '>Oben</button>' +
      '</span></div>';
    var mwSub = [];
    if (mwSqm) mwSub.push(fmt0(mwSqm) + ' €/m²');
    if (diff != null) mwSub.push('<span style="color:' + dCol + '">' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '% vs. Kaufpreis · ' + escH(dLbl) + '</span>');
    if (r.fairpriceLabel) mwSub.push('Sprengnetter-Preislabel: ' + escH(r.fairpriceLabel));  /* v388 */
    return '<div class="avmx' + (isSpr ? ' is-spr' : '') + (coll ? ' collapsed' : '') + '">' +
      '<div class="avmx-head">' +
        '<span class="avmx-hlogo">' + _provHtml + '</span>' +
        '<span class="avmx-eye">Marktbewertung</span>' +
        '<span class="avmx-hdiv"></span>' +
        '<span class="avmx-hvals">' +
          '<span class="avmx-hv"><span class="hl">Marktwert</span><span class="hb">' + fmt0(mw) + ' €</span>' + (mwSqm ? '<span class="hs">· ' + fmt0(mwSqm) + ' €/m²</span>' : '') + '</span>' +
          (mm ? '<span class="avmx-hv"><span class="hl">Miete</span><span class="hb">' + fmt0(mm) + ' €</span></span>' : '') +
        '</span>' +
        '<span class="avmx-htier">' + escH(r.conf || 'AVM') + (r.mode === 'stub' ? ' · DEMO (fiktive Werte)' : '') + '</span>' +
        '<button type="button" class="avmx-min" data-min="' + escH(r.provider) + '" title="' + (coll ? 'Aufklappen' : 'Minimieren') + '">' + svg('chevron', 16) + '</button>' +
      '</div>' + /* v576-avmxhead */
      '<div class="avmx-body">' + chip +
        '<div class="avmx-cols">' +
          '<div class="avmx-col">' +
            '<div class="avmx-bl-l">' + svg('home', 13) + ' Marktwert</div>' +
            '<div><span class="avmx-big">' + fmt0(mw) + ' <span class="avmx-cur">€</span></span></div>' +
            '<div class="avmx-span">' + spanRow(r.low, r.marktwert, r.high) + '</div>' +
            (mwSub.length ? '<div class="avmx-sub">' + mwSub.join(' · ') + '</div>' : '') +
          '</div>' +
          '<div class="avmx-div"></div>' +
          '<div class="avmx-col">' +
            '<div class="avmx-bl-l">' + svg('home', 13) + ' Marktmiete (kalt)</div>' +
            '<div><span class="avmx-big">' + fmt0(mm) + ' <span class="avmx-cur">€</span></span></div>' +
            '<div class="avmx-span">' + spanRow(r.marktmieteLow, r.marktmieteCold, r.marktmieteHigh) + '</div>' +
            (mmSqm ? '<div class="avmx-sub">' + mmSqm.toFixed(2).replace('.', ',') + ' €/m² kalt</div>' : '') +
          '</div>' +
          '<div class="avmx-div"></div>' +
          '<div class="avmx-col avmx-spancol">' + spanCtl + '</div>' +
        '</div>' +
        '<div class="avmx-actions">' +
          '<span class="avmx-disc">Marktpreisindikation — kein Gutachten n. § 194 BauGB</span>' +
          '<button type="button" class="avmx-apply" data-apply="' + escH(r.provider) + '"><span class="ico">' + svg('download', 13, '#9a7f33') + '</span> In Felder übernehmen (' + spanLabel() + ')</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  function setSelIfEmpty(id, v) { var el = $(id); if (!el || !v || el.value) return; el.value = v; try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }
  function setInput(id, v) { var el = $(id); if (!el || v == null || v === '') return; el.value = v; try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }
  function applyAvm(r) {
    if (!r) return;
    var mw = pickMW(r), mm = pickMM(r), wfl = numDe(val('wfl')) || 0, _ap = [];
    if (mw) { setInput('svwert', fmt0(mw)); markSvwertAvm(); _ap.push('svwert'); }
    var mmSqm = (mm && wfl) ? (mm / wfl) : r.marktmieteEurSqm;
    if (mmSqm) { setInput('ds2_marktmiete', mmSqm.toFixed(2).replace('.', ',')); _ap.push('ds2_marktmiete'); }
    if (r.wertentwicklung != null) { var p = r.wertentwicklung; setSelIfEmpty('ds2_wertsteigerung', p >= 3 ? 'sehr_hoch' : p >= 2 ? 'hoch' : p >= 1 ? 'mittel' : p > 0 ? 'niedrig' : 'keines'); _ap.push('ds2_wertsteigerung'); }
    function lc(s) { return s >= 8 ? 'sehr_gut' : s >= 6 ? 'gut' : s >= 4 ? 'durchschnittlich' : s >= 2 ? 'schwach' : 'sehr_schwach'; }
    if (r.scoreMacro != null) { setSelIfEmpty('makrolage', lc(r.scoreMacro)); _ap.push('makrolage'); }
    if (r.scoreMicro != null) { setSelIfEmpty('mikrolage', lc(r.scoreMicro)); _ap.push('mikrolage'); }
    try { if (typeof window._v236MarkQcLoaded === 'function' && _ap.length) window._v236MarkQcLoaded(_ap); } catch (e) {}
    try { if (typeof window.calc === 'function') window.calc(); } catch (e) {}
    try { if (typeof window.renderDealScore2 === 'function') window.renderDealScore2(); } catch (e) {}
    toast('✓ ' + r.provider + '-Werte übernommen (' + spanLabel() + ')');
  }

  /* ════════════════ KOMBINIERTER IMPORT (OCR + volles Mapping) ════ */
  function ensurePdfJs() {
    return new Promise(function (resolve, reject) {
      if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
      var sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      sc.onload = function () { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {} resolve(window.pdfjsLib); };
      sc.onerror = function () { reject(new Error('pdf.js konnte nicht geladen werden')); };
      document.head.appendChild(sc);
    });
  }
  function ensureTesseract() {
    return new Promise(function (resolve, reject) {
      if (window.Tesseract) { resolve(); return; }
      var sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js';
      sc.onload = function () { window.Tesseract ? resolve() : reject(new Error('Tesseract n/a')); };
      sc.onerror = function () { reject(new Error('tesseract.js konnte nicht geladen werden')); };
      document.head.appendChild(sc);
    });
  }
  async function extractPdfTextRaw(file) {
    await ensurePdfJs();
    var ab = await file.arrayBuffer();
    var pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
    var parts = [];
    for (var i = 1; i <= pdf.numPages; i++) { var page = await pdf.getPage(i); var c = await page.getTextContent(); parts.push(c.items.map(function (it) { return it.str; }).join(' ')); }
    return parts.join('\n\n');
  }
  // OCR-Fallback (wie Original-Import): bis zu 6 Seiten, deutsch
  async function extractOCR(file, statusCb) {
    await ensurePdfJs(); await ensureTesseract();
    var ab = await file.arrayBuffer();
    var pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
    var maxPages = Math.min(pdf.numPages, 6);
    if (statusCb) statusCb('OCR-Engine lädt …');
    var worker = await window.Tesseract.createWorker('deu', 1, { logger: function (m) { if (m && m.status === 'recognizing text' && statusCb) statusCb('OCR ' + Math.round((m.progress || 0) * 100) + ' %'); } });
    var all = [];
    try {
      for (var i = 1; i <= maxPages; i++) {
        if (statusCb) statusCb('OCR Seite ' + i + '/' + maxPages);
        var page = await pdf.getPage(i);
        var vp = page.getViewport({ scale: 2.0 });
        var cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        var res = await worker.recognize(cv);
        if (res && res.data && res.data.text) all.push(res.data.text);
      }
    } finally { try { await worker.terminate(); } catch (e) {} }
    return all.join('\n\n');
  }
  async function extractTextFull(file, statusCb) {
    var text = await extractPdfTextRaw(file);
    if (!text || text.replace(/\s/g, '').length < 50) { try { text = await extractOCR(file, statusCb); } catch (e) { text = text || ''; } }
    return (text || '').slice(0, 12000);
  }
  function detectMarket(file, text) {
    var fn = (file && file.name || '').toLowerCase();
    if (/markt|verkehrswert|pricehubble|sprengnetter|gutachten|\bavm\b|bewertung|wertermittlung/.test(fn)) return true;
    if (/expose|exposé|immoscout|scout24|kleinanzeige/.test(fn)) return false;
    var t = (text || '').toLowerCase();
    var strong = ['pricehubble', 'price hubble', 'sprengnetter', 'marktwerteinschätzung', 'marktwert-einschätzung',
      'marktwertermittlung', 'wertermittlung', 'marktpreisindikation', 'bewertungsbericht', 'marktbericht',
      'immobilienbewertung', 'mcmakler', 'realbest'];
    if (strong.some(function (kw) { return t.indexOf(kw) >= 0; })) return true;
    // Schwächere Signale (inkl. Abkürzungen) — ab 2 Treffern = Marktbericht
    var weak = ['marktwert', 'mikrolage', 'makrolage', 'mikro ', 'makro ', 'wertentwicklung', 'wertentw',
      'bodenrichtwert', 'konfidenz', 'lagebewertung', 'marktmiete', '€/m²', 'eur/m²', 'preis pro m²',
      'spanne', 'prognose', 'wertsteigerung', 'bevölkerungsentwicklung', 'nachfrageindikator'];
    var hits = weak.reduce(function (n, kw) { return n + (t.indexOf(kw) >= 0 ? 1 : 0); }, 0);
    return hits >= 2;
  }
  async function callExtract(text, isMarket) {
    var res = await fetch('/api/v1/ai/' + (isMarket ? 'extract-market-data' : 'extract-expose'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }, body: JSON.stringify({ text: text }) });
    var j = await res.json().catch(function () { return {}; });
    return (j && j.extracted) ? j.extracted : (j || {});
  }

  /* ── svwert-Label: §194 ↔ Marktpreisindikation (AVM) ── */
  function _firstTextNode(el) {
    if (!el) return null;
    for (var i = 0; i < el.childNodes.length; i++) { var n = el.childNodes[i]; if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) return n; }
    return null;
  }
  function markSvwertAvm() {  /* v396: Label-Wort + Hinweis */
    var sv = $('svwert'); if (!sv) return;
    var fld = sv.closest ? sv.closest('.f') : null;
    var hint = fld ? fld.querySelector('.cf-hint') : null;
    var lbl = fld ? fld.querySelector('label') : null;
    var tn = _firstTextNode(lbl);
    if (hint) {
      if (!hint._orig) hint._orig = hint.textContent;
      hint.textContent = '(Marktpreisindikation · AVM — kein Verkehrswert n. § 194 BauGB)';
      hint.title = 'Der übernommene Wert stammt aus einer AVM-Markteinschätzung (PriceHubble/Sprengnetter), nicht aus einem Verkehrswertgutachten nach § 194 BauGB. Bei manueller Eingabe wird die Bezeichnung automatisch zurückgesetzt.';
      hint.style.color = 'var(--gold-3,#9a7f33)';
    }
    if (tn) { if (lbl._origTxt == null) lbl._origTxt = tn.nodeValue; tn.nodeValue = 'Marktpreis '; }
    if (lbl) lbl.style.color = 'var(--gold-3,#9a7f33)';
    if (!sv._avmResetBound) {
      sv._avmResetBound = true;
      sv.addEventListener('input', function _r() {
        try {
          if (hint && hint._orig) { hint.textContent = hint._orig; hint.removeAttribute('title'); hint.style.color = ''; }
          var t2 = _firstTextNode(lbl);
          if (t2 && lbl._origTxt != null) t2.nodeValue = lbl._origTxt;
          if (lbl) lbl.style.color = '';
        } catch (e) {}
        sv.removeEventListener('input', _r); sv._avmResetBound = false;
      });
    }
  }

  /* ── Helfer fürs Mapping ── */
  function setSelectSmart(id, val, emptyOnly) {
    var el = $(id); if (!el || val == null || val === '') return false;
    if (emptyOnly && el.value) return false;
    var raw = String(val).trim().toLowerCase();
    for (var i = 0; i < el.options.length; i++) {
      var o = el.options[i], ov = (o.value || '').toLowerCase(), ot = (o.text || '').toLowerCase();
      if (ov === raw || ot === raw || (raw && ot && ot.indexOf(raw) >= 0) || (raw && ot && raw.indexOf(ot) >= 0)) { el.selectedIndex = i; try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} return true; }
    }
    return false;
  }
  var QUAL_SCALE = { 5: ['luxus', 'luxuri'], 4: ['gehoben', 'hochwertig'], 3: ['normal'], 2: ['standard'], 1: ['einfach', 'schlicht'] };
  var ZUST_SCALE = { 5: ['neu', 'kürzlich modernis', 'kuerzlich modernis', 'erstbezug', 'kernsaniert'], 4: ['gehobenes niveau', 'gehoben'], 3: ['gut in stand', 'gepflegt', 'gut'], 2: ['renovierungsbed'], 1: ['stark sanier', 'sanierungsbed'] };
  function starFromText(s, scale) { if (s == null) return 0; var t = String(s).trim().toLowerCase(); var ord = [5, 4, 3, 2, 1]; for (var i = 0; i < ord.length; i++) { var k = ord[i], a = scale[k]; if (a) { for (var j = 0; j < a.length; j++) { if (t.indexOf(a[j]) >= 0) return k; } } } return 0; }
  function pretty(v) { return String(v == null ? '' : v).replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function lageAvg(d) { var sum = 0, c = 0; ['lage_einkaufen', 'lage_bildung', 'lage_gastronomie', 'lage_gesundheit', 'lage_freizeit'].forEach(function (k) { var n = numDe(d[k]); if (n != null) { sum += (n > 5 ? n / 2 : n); c++; } }); return c >= 3 ? (sum / c) : null; }
  function lageCat(avg) { return avg >= 4.5 ? 'sehr_gut' : avg >= 3.5 ? 'gut' : avg >= 2.5 ? 'durchschnittlich' : avg >= 1.5 ? 'schwach' : 'sehr_schwach'; }

  /* ── Merge (Zeilen mit kind: input|select|star) ── */
  var _merged = {};   // id -> { label, value(display), raw, source, kind, emptyOnly, range? }
  var _addrChoice = null;
  function addRow(id, label, display, raw, source, kind, emptyOnly) {
    if (display == null || display === '' || raw == null || raw === '' || raw === 0 && kind === 'star') return;
    if (_merged[id] && _merged[id].source === 'Marktbericht' && source !== 'Marktbericht') return;
    _merged[id] = { label: label, value: display, raw: raw, source: source, kind: kind || 'input', emptyOnly: !!emptyOnly };
  }
  var DS2_ENUMS = {
    makrolage: ['sehr_schwach','schwach','durchschnittlich','gut','sehr_gut'],
    mikrolage: ['sehr_schwach','schwach','durchschnittlich','gut','sehr_gut'],
    ds2_bevoelkerung: ['stark_wachsend','wachsend','stabil','leicht_fallend','stark_fallend'],
    ds2_nachfrage: ['sehr_stark','stark','mittel','schwach','sehr_schwach'],
    ds2_wertsteigerung: ['sehr_hoch','hoch','mittel','niedrig','keines'],
    ds2_entwicklung: ['mehrere','eine_starke','begrenzt','kaum','keine']
  };
  function validEnum(id, v) { if (v == null) return null; var t = String(v).trim().toLowerCase().replace(/\s+/g,'_'); var a = DS2_ENUMS[id]; return (a && a.indexOf(t) >= 0) ? t : null; }
  function mergeMarket(d) {
    var S = 'Marktbericht';
    // Adresse → str/hnr + plz/ort
    if (d.adresse) {
      var s0 = String(d.adresse).split(',')[0].trim(), m = s0.match(/^(.+?)\s+(\d+\w*)$/);
      if (m) { addRow('str', 'Straße', m[1], m[1], S, 'input'); addRow('hnr', 'Hausnummer', m[2], m[2], S, 'input'); }
      else addRow('str', 'Straße', s0, s0, S, 'input');
    }
    addRow('plz', 'PLZ', d.plz, d.plz, S, 'input'); addRow('ort', 'Ort', d.ort, d.ort, S, 'input');
    addRow('wfl', 'Wohnfläche', d.wohnflaeche, d.wohnflaeche, S, 'input'); addRow('baujahr', 'Baujahr', d.baujahr, d.baujahr, S, 'input');
    addRow('zimmer', 'Zimmer', d.zimmer, d.zimmer, S, 'input');
    if (d.objektart) addRow('objart', 'Objektart', d.objektart, d.objektart, S, 'select', false);
    if (d.verkehrswert) { addRow('svwert', 'Marktpreisindikation (AVM)', fmt0(d.verkehrswert) + ' €', d.verkehrswert, S, 'input'); attachRange('svwert', numDe(d.verkehrswert_min), numDe(d.verkehrswert), numDe(d.verkehrswert_max), 'eur'); }
    if (d.energie_label) addRow('ds2_energie', 'Energieklasse', String(d.energie_label).toUpperCase(), String(d.energie_label).toUpperCase(), S, 'select', false);
    // Marktmiete €/m²
    var mmq = numDe(d.marktmiete_qm), mmm = numDe(d.marktmiete_monat), wfl = numDe(d.wohnflaeche);
    var mm = (mmq != null) ? mmq : ((mmm != null && wfl) ? mmm / wfl : null);
    if (mm != null) { addRow('ds2_marktmiete', 'Marktmiete (€/m²)', mm.toFixed(2).replace('.', ',') + ' €/m²', mm.toFixed(2).replace('.', ','), S, 'input'); attachRange('ds2_marktmiete', numDe(d.marktmiete_qm_min), mm, numDe(d.marktmiete_qm_max), 'qm'); }
    // Makro-/Mikrolage: DIREKT aus Bericht (bevorzugt), sonst aus Lage-Sub-Scores ableiten
    var maD = validEnum('makrolage', d.makrolage), miD = validEnum('mikrolage', d.mikrolage);
    var la = lageAvg(d), laCat = (la != null) ? lageCat(la) : null;
    var maV = maD || laCat, miV = miD || laCat;
    if (maV) addRow('makrolage', 'Makrolage' + (maD ? '' : ' (aus Lage-Scores)'), pretty(maV), maV, S, 'select', true);
    if (miV) addRow('mikrolage', 'Mikrolage' + (miD ? '' : ' (aus Lage-Scores)'), pretty(miV), miV, S, 'select', true);
    // Wertsteigerung: direkt, sonst aus Prognose
    var wD = validEnum('ds2_wertsteigerung', d.wertsteigerung), pg = numDe(d.prognose_naechstes_jahr_pct);
    var wV = wD || ((pg != null) ? (pg >= 3 ? 'sehr_hoch' : pg >= 2 ? 'hoch' : pg >= 1 ? 'mittel' : pg > 0 ? 'niedrig' : 'keines') : null);
    if (wV) addRow('ds2_wertsteigerung', 'Wertsteigerung' + (wD ? '' : ' (aus Prognose)'), pretty(wV), wV, S, 'select', true);
    // Bevölkerungsentwicklung: direkt, sonst aus Wanderungssaldo
    var bD = validEnum('ds2_bevoelkerung', d.bevoelkerung_entwicklung), ws = numDe(d.wanderungssaldo);
    var bV = bD || ((ws != null) ? (ws >= 8 ? 'stark_wachsend' : ws >= 2 ? 'wachsend' : ws > -2 ? 'stabil' : ws > -8 ? 'leicht_fallend' : 'stark_fallend') : null);
    if (bV) addRow('ds2_bevoelkerung', 'Bevölkerungsentwicklung' + (bD ? '' : ' (aus Wanderungssaldo)'), pretty(bV), bV, S, 'select', true);
    // Nachfrage: direkt, sonst aus Tage am Markt
    var nD = validEnum('ds2_nachfrage', d.nachfrage), tg = numDe(d.markt_tage_auf_dem_markt);
    var nV = nD || ((tg != null) ? (tg <= 30 ? 'sehr_stark' : tg <= 60 ? 'stark' : tg <= 120 ? 'mittel' : tg <= 200 ? 'schwach' : 'sehr_schwach') : null);
    if (nV) addRow('ds2_nachfrage', 'Nachfrage' + (nD ? '' : ' (aus Tage am Markt)'), pretty(nV), nV, S, 'select', true);
    // Entwicklungsmöglichkeiten: nur direkt aus Bericht (keine Ableitungsquelle)
    var eD = validEnum('ds2_entwicklung', d.entwicklung);
    if (eD) addRow('ds2_entwicklung', 'Entwicklungsmöglichkeiten', pretty(eD), eD, S, 'select', true);
    // Stammdaten
    addRow('bad_anz', 'Badezimmer', d.badezimmer, d.badezimmer, S, 'input'); addRow('etage', 'Etage', d.etage, d.etage, S, 'input');
    addRow('etagen_ges', 'Anzahl Etagen', d.etagen, d.etagen, S, 'input'); addRow('modernis', 'Modernisierungsjahr', d.modernisierungsjahr || d.sanierungsjahr, d.modernisierungsjahr || d.sanierungsjahr, S, 'input');
    addRow('garagen', 'Garagenplätze', d.garagen, d.garagen, S, 'input'); addRow('stellpl_aussen', 'Außenstellplätze', d.stellplatz_aussen, d.stellplatz_aussen, S, 'input');
    addRow('balkon_flae', 'Balkon/Terrasse (m²)', d.balkon_flaeche, d.balkon_flaeche, S, 'input');
    // Qualität → Sterne
    [['qual_kueche', 'Küche · Qualität', d.kueche_qualitaet], ['qual_bad', 'Bad · Qualität', d.bad_qualitaet], ['qual_boden', 'Boden · Qualität', d.boden_qualitaet], ['qual_fenster', 'Fenster · Qualität', d.fenster_qualitaet]].forEach(function (q) { var n = starFromText(q[2], QUAL_SCALE); if (n > 0) addRow(q[0], q[1], n + ' ★', n, S, 'star'); });
    // Zustand → Sterne
    [['rate_kueche', 'Küche · Zustand', d.kueche_zustand], ['rate_bad', 'Bad · Zustand', d.bad_zustand], ['rate_boden', 'Boden · Zustand', d.boden_zustand], ['rate_fenster', 'Fenster · Zustand', d.fenster_zustand]].forEach(function (q) { var n = starFromText(q[2], ZUST_SCALE); if (n > 0) addRow(q[0], q[1], n + ' ★', n, S, 'star'); });
  }
  function mergeExpose(d) {
    var S = 'Exposé';
    if (d.adresse) {
      var s0 = String(d.adresse).split(',')[0].trim(), m = s0.match(/^(.+?)\s+(\d+\w*)$/);
      if (m) { addRow('str', 'Straße', m[1], m[1], S, 'input'); addRow('hnr', 'Hausnummer', m[2], m[2], S, 'input'); }
      else addRow('str', 'Straße', s0, s0, S, 'input');
    }
    addRow('plz', 'PLZ', d.plz, d.plz, S, 'input'); addRow('ort', 'Ort', d.ort, d.ort, S, 'input');
    addRow('wfl', 'Wohnfläche', d.wohnflaeche, d.wohnflaeche, S, 'input'); addRow('baujahr', 'Baujahr', d.baujahr, d.baujahr, S, 'input');
    addRow('zimmer', 'Zimmer', d.zimmer, d.zimmer, S, 'input');
    if (d.objektart) addRow('objart', 'Objektart', d.objektart, d.objektart, S, 'select', false);
    addRow('kp', 'Kaufpreis', d.kaufpreis ? fmt0(d.kaufpreis) + ' €' : null, d.kaufpreis, S, 'input');
    addRow('nkm', 'Nettokaltmiete', d.nettokaltmiete ? fmt0(d.nettokaltmiete) + ' €' : null, d.nettokaltmiete, S, 'input');
    addRow('hg_ul', 'Hausgeld', d.hausgeld, d.hausgeld, S, 'input');
    addRow('inst', 'Instandhaltung', d.instandhaltung, d.instandhaltung, S, 'input');
    addRow('ek', 'Eigenkapital', d.eigenkapital, d.eigenkapital, S, 'input');
    addRow('verwaltung', 'Verwaltung', d.verwaltung, d.verwaltung, S, 'input');
    addRow('nk_pct', 'Kaufnebenkosten %', d.kaufnebenkosten, d.kaufnebenkosten, S, 'input');
    if (d.energieklasse) addRow('ds2_energie', 'Energieklasse', String(d.energieklasse).toUpperCase(), String(d.energieklasse).toUpperCase(), S, 'select', false);
    if (d.sanierungsjahr) addRow('modernis', 'Modernisierungsjahr', d.sanierungsjahr, d.sanierungsjahr, S, 'input');
    if (d.stellplatz) { var _sp = String(d.stellplatz).toLowerCase(); if (_sp.indexOf('kein') < 0) { if (/tiefgarage|garage|duplex/.test(_sp)) addRow('garagen', 'Garagenpl\u00e4tze', '1', '1', S, 'input'); else if (/stellplatz|au\u00dfen|aussen|parkplatz|carport|freiplatz/.test(_sp)) addRow('stellpl_aussen', 'Au\u00dfenstellpl\u00e4tze', '1', '1', S, 'input'); } }
  }

  var _files = [];   // { name, text, type, userType, cache, status, row, file }
  var _importPhotos = [];   // v402: aus Exposé-PDFs extrahierte Bilder (dataURLs, max 6)
  function recompute() {
    _merged = {};
    _files.filter(function (f) { return f.type === 'expose' && f.cache.expose; }).forEach(function (f) { mergeExpose(f.cache.expose); });
    _files.filter(function (f) { return f.type === 'market' && f.cache.market; }).forEach(function (f) { mergeMarket(f.cache.market); });
  }
  function _norm(x){ return String(x==null?'':x).trim().toLowerCase().replace(/\s+/g,' '); }
  function addressWarning() {
    var orte = {}, plzs = {}, adrs = {};
    _files.forEach(function (f) {
      var d = f.cache[f.type]; if (!d) return;
      if (d.ort) orte[_norm(d.ort)] = d.ort;
      if (d.plz) plzs[_norm(d.plz)] = d.plz;
      if (d.adresse) adrs[_norm(String(d.adresse).split(',')[0])] = d.adresse;
    });
    var msgs = [];
    var oK = Object.keys(orte); if (oK.length > 1) msgs.push('Orte: ' + oK.map(function(k){return orte[k];}).join(' vs. '));
    var pK = Object.keys(plzs); if (pK.length > 1) msgs.push('PLZ: ' + pK.map(function(k){return plzs[k];}).join(' vs. '));
    var aK = Object.keys(adrs); if (aK.length > 1) msgs.push('Straßen: ' + aK.map(function(k){return adrs[k];}).join(' vs. '));
    if (!msgs.length) return '';
    return '<div class="oabi-warn">\u26A0 <b>Unterschiedliche Adressen erkannt</b> — gehören die PDFs wirklich zum selben Objekt? (' + escH(msgs.join(' · ')) + ')</div>';
  }
  function fmtRange(v, fmt) { if (fmt === 'eur') return fmt0(v) + ' €'; if (fmt === 'qm') return v.toFixed(2).replace('.', ',') + ' €/m²'; return String(v); }
  function applySpan(it, sp) {
    if (!it.range) return; it.range.cur = sp; var v = it.range[sp];
    if (it.range.fmt === 'eur') { it.raw = v; it.value = fmt0(v) + ' €'; }
    else if (it.range.fmt === 'qm') { it.raw = v.toFixed(2).replace('.', ','); it.value = it.raw + ' €/m²'; }
    else { it.raw = v; it.value = String(v); }
  }
  function attachRange(id, minV, midV, maxV, fmt) {
    var it = _merged[id]; if (!it) return;
    if (minV == null || midV == null || maxV == null || !(minV < maxV)) return;
    it.range = { min: minV, mid: midV, max: maxV, cur: 'mid', fmt: fmt }; applySpan(it, 'mid');
  }
  function spanToggle(id, cur) {
    return '<span class="oabi-span">' + [['min', 'Unten'], ['mid', 'Ø'], ['max', 'Oben']].map(function (p) {
      return '<button type="button" class="oabi-spbtn' + (p[0] === cur ? ' on' : '') + '" data-id="' + escH(id) + '" data-sp="' + p[0] + '">' + p[1] + '</button>';
    }).join('') + '</span>';
  }
  /* Adress-Auswahl bei mehreren Objekten */
  function _fileAddr(f) {
    var d = f.cache[f.type]; if (!d) return null;
    var str = '', hnr = '';
    if (d.adresse) { var s0 = String(d.adresse).split(',')[0].trim(); var m = s0.match(/^(.+?)\s+(\d+\w*)$/); if (m) { str = m[1]; hnr = m[2]; } else str = s0; }
    if (!str && !d.plz && !d.ort) return null;
    return { str: str, hnr: hnr, plz: d.plz || '', ort: d.ort || '', source: (f.type === 'market' ? 'Marktbericht' : 'Exposé') };
  }
  function addressOptions() {
    var seen = {}, out = [];
    _files.forEach(function (f) { var a = _fileAddr(f); if (!a) return; var key = _norm(a.str) + '|' + _norm(a.plz) + '|' + _norm(a.ort); if (seen[key]) return; seen[key] = 1; a.key = key; a.label = (a.str + (a.hnr ? ' ' + a.hnr : '') + ', ' + a.plz + ' ' + a.ort).replace(/^,\s*|,\s*$/g, '').trim(); out.push(a); });
    return out;
  }
  function renderMergedTable() {
    var host = $('oabi-result'); if (!host) return;
    var ab = $('oabi-apply');
    // Adress-Auswahl: bei mehreren Objekten Radio anbieten; gewählte Adresse überschreibt str/hnr/plz/ort
    var addrHtml = '', addrOpts = addressOptions();
    if (addrOpts.length > 1) {
      if (!_addrChoice || !addrOpts.some(function (o) { return o.key === _addrChoice; })) {
        var pref = addrOpts.filter(function (o) { return o.source === 'Marktbericht'; })[0] || addrOpts[0];
        _addrChoice = pref.key;
      }
      var ch = addrOpts.filter(function (o) { return o.key === _addrChoice; })[0];
      if (ch) {
        if (ch.str) _merged['str'] = { label: 'Straße', value: ch.str, raw: ch.str, source: ch.source, kind: 'input' };
        if (ch.hnr) _merged['hnr'] = { label: 'Hausnummer', value: ch.hnr, raw: ch.hnr, source: ch.source, kind: 'input' };
        if (ch.plz) _merged['plz'] = { label: 'PLZ', value: ch.plz, raw: ch.plz, source: ch.source, kind: 'input' };
        if (ch.ort) _merged['ort'] = { label: 'Ort', value: ch.ort, raw: ch.ort, source: ch.source, kind: 'input' };
      }
      addrHtml = '<div class="oabi-addr"><div class="oabi-addr-h">\u26A0 Unterschiedliche Adressen erkannt — welche gilt?</div>' +
        addrOpts.map(function (o) {
          return '<label class="oabi-addr-opt"><input type="radio" name="oabi-addr" value="' + escH(o.key) + '"' + (o.key === _addrChoice ? ' checked' : '') + '> ' + escH(o.label) + ' <span class="src">(' + escH(o.source) + ')</span></label>';
        }).join('') + '</div>';
    }
    var keys = Object.keys(_merged);
    var hasPhotos = !!(_importPhotos && _importPhotos.length);
    if (!keys.length && !hasPhotos) { host.innerHTML = '<p style="color:var(--muted,#7A7370);font-style:italic;margin-top:10px">Noch keine Werte erkannt.</p>'; if (ab) ab.disabled = true; return; }
    var photoRow = '';
    if (hasPhotos) {
      var thumbs = _importPhotos.slice(0, 6).map(function (src) { return '<img src="' + src + '" alt="" style="width:30px;height:30px;object-fit:cover;border-radius:4px;margin-right:3px;vertical-align:middle">'; }).join('');
      photoRow = '<tr><td style="width:34px"><input type="checkbox" data-photos="1" checked></td><td>\uD83D\uDDBC Bilder</td><td><b>' + _importPhotos.length + '</b> aus PDF \u2014 in Objektfotos &uebernehmen; ' + thumbs + '</td><td class="src">Expos\u00e9</td></tr>';
    }
    host.innerHTML = addrHtml + '<table class="oabi-tbl"><tbody>' + photoRow + keys.map(function (id) {
      var it = _merged[id];
      var valCell = it.range ? ('<b class="oabi-vnum">' + escH(it.value) + '</b>' + spanToggle(id, it.range.cur)) : ('<b>' + escH(it.value) + '</b>');
      return '<tr><td style="width:34px"><input type="checkbox" data-id="' + escH(id) + '" checked></td><td>' + escH(it.label) + '</td><td>' + valCell + '</td><td class="src">' + escH(it.source) + (_qcMode ? (OBJ2QC[id] ? ' <span style="color:#2A8C5A;font-weight:600">\u2192 Quick-Check</span>' : ' <span style="color:#9a7f33;font-weight:600">\u2192 Vollobjekt</span>') : '') + '</td></tr>';
    }).join('') + '</tbody></table>';
    if (ab) ab.disabled = false;
    // Range-Toggle-Handler
    host.querySelectorAll('.oabi-spbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id'), sp = b.getAttribute('data-sp'), it = _merged[id]; if (!it || !it.range) return;
        applySpan(it, sp);
        var tr = b.closest('tr'); var nv = tr ? tr.querySelector('.oabi-vnum') : null; if (nv) nv.textContent = it.value;
        if (tr) tr.querySelectorAll('.oabi-spbtn').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
    // Adress-Radio-Handler
    host.querySelectorAll('input[name="oabi-addr"]').forEach(function (r) {
      r.addEventListener('change', function () { _addrChoice = r.value; renderMergedTable(); });
    });
  }
  function _fireOabiDone() { var d = _oabiDone; _oabiDone = null; if (typeof d === 'function') { try { setTimeout(d, 0); } catch (e) { d(); } } }
  function openCombinedImport(onDone, opts) {
    _oabiDone = (typeof onDone === 'function') ? onDone : null;
    _qcMode = !!(opts && opts.target === 'qc');  /* v418 */
    _qcPendingMerged = {};
    _merged = {}; _files = []; _importPhotos = [];
    var ov = document.createElement('div'); ov.className = 'oabi-ov'; ov.id = 'oabi-ov';
    ov.innerHTML =
      '<div class="oabi-modal">' +
        '<div class="oabi-head"><span style="color:var(--gold,#C9A84C)">' + svg('upload', 22) + '</span><h3>Exposé &amp; Marktbericht importieren</h3></div>' +
        '<div class="oabi-sub">Mehrere PDFs gleichzeitig anhängen — Typ wird automatisch erkannt (inkl. OCR bei Scan-/Grafik-PDFs) und ist pro Datei umstellbar. Alle Werte werden zusammengeführt (Marktbericht führt bei Konflikt).</div>' +
        '<div class="oabi-body">' +
          '<div class="oabi-drop" id="oabi-drop">📁 PDFs auswählen oder hierher ziehen<br><span style="font-size:11px;color:var(--muted,#7A7370)">mehrere Dateien möglich · max 100 MB je Datei</span>' +
            '<input type="file" id="oabi-input" accept="application/pdf,.pdf" multiple style="display:none"></div>' +
          '<div class="oabi-files" id="oabi-files"></div><div id="oabi-result"></div>' +
        '</div>' +
        '<div class="oabi-foot"><button type="button" class="oabi-btn" id="oabi-cancel">Schließen</button>' +
          '<button type="button" class="oabi-btn primary" id="oabi-apply" disabled><span style="display:inline-flex">' + svg('download', 14, '#fff') + '</span> Ausgewählte übernehmen</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    function close() { var x = $('oabi-ov'); if (x) x.remove(); _fireOabiDone(); }
    $('oabi-cancel').addEventListener('click', close);
    var drop = $('oabi-drop'), input = $('oabi-input');
    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); });
    input.addEventListener('change', function (e) { if (e.target.files) handleFiles(e.target.files); });
    $('oabi-apply').addEventListener('click', applyMerged);
  }
  function setStatus(f, txt) { var st = f.row.querySelector('.oabi-st'); if (st) st.textContent = txt; }
  function renderFileRow(f) {
    f.row.innerHTML =
      '<span class="nm">' + (f.status === 'ok' ? '✓ ' : f.status === 'err' ? '⚠ ' : '⏳ ') + escH(f.name) + '</span>' +
      '<select ' + (f.status === 'reading' ? 'disabled' : '') + '><option value="auto"' + (f.userType ? '' : ' selected') + '>Auto</option>' +
        '<option value="market"' + (f.userType === 'market' || (!f.userType && f.type === 'market') ? ' selected' : '') + '>Marktbericht</option>' +
        '<option value="expose"' + (f.userType === 'expose' || (!f.userType && f.type === 'expose') ? ' selected' : '') + '>Exposé</option></select>' +
      '<span class="oabi-st">' + (f.status === 'reading' ? 'lese …' : f.status === 'err' ? 'kein Text' : (f.type === 'market' ? 'Marktbericht' : 'Exposé')) + '</span>';
    var sel = f.row.querySelector('select');
    if (sel) sel.addEventListener('change', function () { onTypeChange(f, sel.value); });
  }
  // Typklassifizierung: 'market' | 'expose' | 'unknown' (Stichwort-Vorfilter, Rest entscheidet der Inhalt)
  function classifyType(file, text) {
    var fn = (file && file.name || '').toLowerCase();
    if (/markt|verkehrswert|pricehubble|sprengnetter|gutachten|\bavm\b|bewertung|wertermittlung/.test(fn)) return 'market';
    if (/expose|exposé|immoscout|scout24|kleinanzeige/.test(fn)) return 'expose';
    if (detectMarket({ name: '' }, text)) return 'market';
    var t = (text || '').toLowerCase();
    var marketHits = ['marktwert', 'mikrolage', 'makrolage', 'mikro ', 'makro ', 'wertentwicklung', 'bodenrichtwert', 'konfidenz', 'marktmiete', '€/m²', 'spanne', 'wertsteigerung'].reduce(function (n, kw) { return n + (t.indexOf(kw) >= 0 ? 1 : 0); }, 0);
    var exposeHits = ['kaufpreis', 'courtage', 'provision', 'maklerprovision', 'objektbeschreibung', 'besichtigung', 'immobilienscout', 'provisionsfrei'].reduce(function (n, kw) { return n + (t.indexOf(kw) >= 0 ? 1 : 0); }, 0);
    if (exposeHits >= 2 && marketHits === 0) return 'expose';
    return 'unknown';
  }
  // Marktbericht-typische Felder im Extraktionsergebnis? (valuation-spezifisch, in Exposés nicht vorhanden)
  function hasMarketSignals(d) {
    if (!d) return false;
    var keys = ['verkehrswert', 'preis_pro_qm', 'makrolage', 'mikrolage', 'lage_einkaufen', 'lage_bildung', 'lage_gastronomie', 'lage_gesundheit', 'lage_freizeit', 'marktmiete_qm', 'marktmiete_monat', 'wertentwicklung_1jahr_pct', 'wertentwicklung_3jahre_pct', 'bevoelkerung_entwicklung', 'nachfrage', 'wertsteigerung', 'entwicklung', 'wanderungssaldo', 'markt_tage_auf_dem_markt'];
    for (var i = 0; i < keys.length; i++) { var v = d[keys[i]]; if (v != null && v !== '') return true; }
    return false;
  }
  // Typ auflösen: bei klarem Befund direkt; bei 'unknown' erst Marktbericht versuchen und per Inhalt bestätigen, sonst Exposé.
  async function resolveType(f) {
    if (f.userType) { f.type = f.userType; await ensureExtract(f); return; }
    var cls = classifyType({ name: f.name }, f.text);
    if (cls === 'market' || cls === 'expose') { f.type = cls; await ensureExtract(f); return; }
    setStatus(f, 'Typ prüfen…');
    f.type = 'market'; await ensureExtract(f);
    if (f.cache.market && hasMarketSignals(f.cache.market)) return;   // bestätigt Marktbericht
    f.type = 'expose'; await ensureExtract(f);                        // sonst Exposé
  }
  async function ensureExtract(f) {
    if (f.cache[f.type]) return;
    f.status = 'reading'; renderFileRow(f);
    try { f.cache[f.type] = await callExtract(f.text, f.type === 'market'); f.status = 'ok'; }
    catch (e) { f.status = 'err'; }
    renderFileRow(f);
  }
  async function onTypeChange(f, v) {
    f.userType = (v === 'auto') ? null : v;
    await resolveType(f); recompute(); renderMergedTable();
  }
  async function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList).filter(function (f) { return /\.pdf$/i.test(f.name) && f.size <= 100 * 1024 * 1024; });
    if (!files.length) { toast('Bitte gültige PDF-Dateien (max 100 MB) wählen.'); return; }
    var filesHost = $('oabi-files');
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var row = document.createElement('div'); row.className = 'oabi-file'; filesHost.appendChild(row);
      var f = { name: file.name, file: file, text: '', type: 'expose', userType: null, cache: {}, status: 'reading', row: row };
      _files.push(f); renderFileRow(f);
      try {
        f.text = await extractTextFull(file, function (m) { setStatus(f, m); });
        if (!f.text || f.text.replace(/\s/g, '').length < 50) { f.status = 'err'; renderFileRow(f); continue; }
        await resolveType(f);
      } catch (e) { f.status = 'err'; renderFileRow(f); }
    }
    recompute(); renderMergedTable();
    _extractImportPhotos();  /* v402: Exposé-Bilder asynchron nachladen */
  }
  async function _extractImportPhotos() {
    if (!window.PdfImport || typeof window.PdfImport.extractImages !== 'function') { _importPhotos = []; return; }
    var expFiles = _files.filter(function (f) { return f.type === 'expose' && f.file; });
    if (!expFiles.length) { if (_importPhotos.length) { _importPhotos = []; renderMergedTable(); } return; }
    var all = [];
    for (var i = 0; i < expFiles.length && all.length < 6; i++) {
      try { var imgs = await window.PdfImport.extractImages(expFiles[i].file); if (imgs && imgs.length) all = all.concat(imgs); } catch (e) {}
    }
    _importPhotos = all.slice(0, 6);
    renderMergedTable();
  }
  function applyMerged() {
    var ov = $('oabi-ov'); if (!ov) return;
    if (_qcMode) { return applyMergedQc(ov); }  /* v418 */
    var n = 0, _applied = [];
    ov.querySelectorAll('.oabi-tbl input[type="checkbox"]:checked').forEach(function (cb) {
      var id = cb.getAttribute('data-id'), it = _merged[id]; if (!it) return;
      if (it.kind === 'star') { if (it.raw > 0 && window.StarRating && typeof StarRating.setRating === 'function') { StarRating.setRating(id, it.raw); n++; _applied.push(id); } return; }
      if (it.kind === 'select') { if (setSelectSmart(id, it.raw, it.emptyOnly)) { n++; _applied.push(id); } return; }
      setInput(id, it.raw); if (id === 'svwert' && it.source === 'Marktbericht') markSvwertAvm(); n++; _applied.push(id);
    });
    try {
      var pcb = ov.querySelector('.oabi-tbl input[data-photos="1"]:checked');
      if (pcb && _importPhotos && _importPhotos.length && typeof window.dpSetImgs === 'function') {
        var photoObjs = _importPhotos.slice(0, 6).map(function (src, i) { return { src: src, name: 'expose_' + (i + 1) + '.jpg' }; });
        window.dpSetImgs(photoObjs); n += photoObjs.length;
      }
    } catch (e) {}
    try { if (typeof window._v236MarkQcLoaded === 'function' && _applied.length) window._v236MarkQcLoaded(_applied); } catch (e) {}
    try { if (typeof window.calc === 'function') window.calc(); } catch (e) {}
    try { if (typeof window.renderDealScore2 === 'function') window.renderDealScore2(); } catch (e) {}
    ov.remove(); _fireOabiDone();
    toast('✓ ' + n + ' Werte aus Import übernommen');
  }

  // v418: QC-Modus — angehakte Zeilen splitten. Bucket A (qc_-Feld) -> zurueck an
  // den iframe (qcData). Bucket B+C (kein qc_-Feld) -> _qcPendingMerged stashen +
  // pendingList melden (Anzeige im Save-Transfer-Modal). Schreibt NICHTS in Objektfelder.
  function applyMergedQc(ov) {
    var qcData = {}, pendingList = [];
    ov.querySelectorAll('.oabi-tbl input[type="checkbox"]:checked').forEach(function (cb) {
      var id = cb.getAttribute('data-id'); if (!id) return;
      var it = _merged[id]; if (!it) return;
      var q = OBJ2QC[id];
      if (q) { qcData[q] = it.raw; }
      else {
        _qcPendingMerged[id] = it;
        pendingList.push({ key: id, label: it.label, value: it.value, target: id, source: it.source });
      }
    });
    /* v506-qc-derive: QC-spezifische Umrechnungen */
    try {
      // Hausgeld: qc_hg verlangt GESAMT (Label 'Hausgeld / Monat inkl. ...'),
      // Quelle liefert hg_ul/hg_nul getrennt -> Summe + Split-Prozent.
      var _hgU = _merged['hg_ul'], _hgN = _merged['hg_nul'];
      var _hgUOn = _hgU && ov.querySelector('.oabi-tbl input[data-id="hg_ul"]:checked');
      var _hgNOn = _hgN && ov.querySelector('.oabi-tbl input[data-id="hg_nul"]:checked');
      if (_hgUOn || _hgNOn) {
        var _u = _hgUOn ? (numDe(_hgU.raw) || 0) : 0;
        var _n = _hgNOn ? (numDe(_hgN.raw) || 0) : 0;
        var _ges = _u + _n;
        if (_ges > 0) {
          qcData['qc_hg'] = String(Math.round(_ges));
          if (_n > 0) qcData['qc_hg_split'] = String(Math.round(_n / _ges * 100));
          delete _qcPendingMerged['hg_nul'];
          pendingList = pendingList.filter(function (x) { return x.key !== 'hg_nul'; });
        }
      }
      // Mieten: bei Einzelposten geht die Kaltmiete als GRUNDmiete rein,
      // qc_nkm summiert das iframe selbst (mieteAddUp im Result-Handler).
      if ((qcData['qc_nkm_stp'] != null || qcData['qc_nkm_kueche'] != null || qcData['qc_nkm_sonst'] != null) && qcData['qc_nkm'] != null) {
        qcData['qc_nkm_grund'] = qcData['qc_nkm'];
        delete qcData['qc_nkm'];
      }
    } catch (e) {}
    var photos = [];
    try {
      var pcb = ov.querySelector('.oabi-tbl input[data-photos="1"]:checked');
      if (pcb && _importPhotos && _importPhotos.length) photos = _importPhotos.slice(0, 6);
    } catch (e) {}
    var done = _oabiDone; _oabiDone = null;
    ov.remove();
    if (typeof done === 'function') { try { done({ qcData: qcData, pendingList: pendingList, photos: photos }); } catch (e) {} }
  }
  // v418: beim qc-save aufgerufen — Bucket B+C aus dem Stash ins frisch angelegte
  // Objekt schreiben (gleiche Schreiblogik wie applyMerged), gefiltert nach den im
  // Transfer-Modal angehakten Targets. Danach Stash leeren.
  function applyQcPending(targets) {
    var n = 0, applied = [];
    Object.keys(_qcPendingMerged).forEach(function (id) {
      if (targets && !targets[id]) return;
      var it = _qcPendingMerged[id]; if (!it) return;
      if (it.kind === 'star') { if (it.raw > 0 && window.StarRating && typeof StarRating.setRating === 'function') { StarRating.setRating(id, it.raw); n++; applied.push(id); } return; }
      if (it.kind === 'select') { if (setSelectSmart(id, it.raw, it.emptyOnly)) { n++; applied.push(id); } return; }
      setInput(id, it.raw); if (id === 'svwert') { try { markSvwertAvm(); } catch (e) {} } n++; applied.push(id);
    });
    _qcPendingMerged = {};
    try { if (typeof window._v236MarkQcLoaded === 'function' && applied.length) window._v236MarkQcLoaded(applied); } catch (e) {}
    try { if (typeof window.calc === 'function') window.calc(); } catch (e) {}
    try { if (typeof window.renderDealScore2 === 'function') window.renderDealScore2(); } catch (e) {}
    return n;
  }
  /* ── KI-Lage-Karte minimierbar machen (ohne ki-lage.js zu aendern) ── */
  function syncObjExtra() {
    var ids = ['zimmer','bad_anz','etage','etagen_ges','modernis','garagen','stellpl_aussen','balkon_flae'];
    var tg = document.getElementById('obj-extra-toggle'), wrap = document.getElementById('obj-extra-wrap');
    if (tg && wrap) {
      var anyVal = ids.some(function (id) { var e = document.getElementById(id); return e && e.value != null && String(e.value).trim() !== ''; });
      if (!tg._dpAccWired) {  /* v396: Aufklapp-Header statt Checkbox */
        tg._dpAccWired = true;
        tg._dpSetOpen = function (open) {
          wrap.style.display = open ? '' : 'none';
          tg.setAttribute('aria-expanded', open ? 'true' : 'false');
          var ch = tg.querySelector('.obj-extra-chev'); if (ch) ch.style.transform = open ? 'rotate(90deg)' : '';
        };
        var _tog = function () { tg._dpSetOpen(wrap.style.display === 'none'); };
        tg.addEventListener('click', _tog);
        tg.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _tog(); } });
      }
      if (typeof tg._dpSetOpen === 'function') tg._dpSetOpen(anyVal);  /* default zu, offen nur wenn Daten vorhanden */
    }
    var obj = document.getElementById('objart'), ew = document.getElementById('einheiten-wrap');
    if (obj && ew) {
      if (!obj._dpEinhWired) { obj._dpEinhWired = true; obj.addEventListener('change', function () { syncObjExtra(); }); }
      ew.style.display = (['MFH','GESCH','GEW','HOTEL'].indexOf(obj.value) >= 0) ? '' : 'none';
    }
  }
  function syncQzStars() {  /* v397: STERNE-Block einklappbar (Standard zu) */
    var tg = document.getElementById('qz-stars-toggle');
    var rows = document.getElementById('qz-stars-rows');
    if (!tg || !rows) return;
    var footer = rows.parentNode ? rows.parentNode.querySelector('.qz-footer') : null;
    var ids = ['rate_kueche','rate_bad','rate_boden','rate_fenster','qual_kueche','qual_bad','qual_boden','qual_fenster'];
    var anyRated = ids.some(function (id) { var e = document.getElementById(id); return e && parseFloat(e.value) > 0; });
    if (!tg._dpQzWired) {
      tg._dpQzWired = true;
      tg._dpQzSet = function (open) {
        rows.style.display = open ? '' : 'none';
        if (footer) footer.style.display = open ? '' : 'none';
        tg.setAttribute('aria-expanded', open ? 'true' : 'false');
        var ch = tg.querySelector('.qz-acc-chev'); if (ch) ch.style.transform = open ? 'rotate(90deg)' : '';
      };
      var _t = function () { tg._dpQzSet(rows.style.display === 'none'); };
      tg.addEventListener('click', _t);
      tg.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _t(); } });
    }
    if (typeof tg._dpQzSet === 'function') tg._dpQzSet(anyRated);
  }
  function clearAvm() {  /* v398: AVM-Karte + svwert-Label vollstaendig zuruecksetzen (z.B. nach Loeschen) */
    _avm = {}; _collapsed = {};
    var el = document.getElementById('_avm_state'); if (el) el.value = '';
    try { renderResults(); } catch (e) {}
    try {
      var sv = $('svwert'); if (sv) {
        var fld = sv.closest ? sv.closest('.f') : null;
        var hint = fld ? fld.querySelector('.cf-hint') : null, lbl = fld ? fld.querySelector('label') : null;
        if (hint && hint._orig) { hint.textContent = hint._orig; hint.removeAttribute('title'); hint.style.color = ''; }
        var tn = _firstTextNode(lbl); if (tn && lbl && lbl._origTxt != null) tn.nodeValue = lbl._origTxt;
        if (lbl) lbl.style.color = '';
      }
    } catch (e) {}
  }
  function enhanceObjektdaten() {
    syncObjExtra(); syncQzStars();
    if (typeof window.loadData === 'function' && !window.loadData._dpObjWrap) {
      var _ld = window.loadData;
      window.loadData = function () { var r = _ld.apply(this, arguments); try { setTimeout(function(){ syncObjExtra(); syncQzStars(); restoreAvmState(); }, 0); } catch (e) {} return r; };
      window.loadData._dpObjWrap = true;
    }
    if (typeof window.newObj === 'function' && !window._dpObjNewWrap) {
      window._dpObjNewWrap = true;
      var _no = window.newObj;
      window.newObj = function () { var r = _no.apply(this, arguments); try { setTimeout(function(){ syncObjExtra(); syncQzStars(); _avm = {}; _collapsed = {}; var el = document.getElementById('_avm_state'); if (el) el.value = ''; renderResults(); }, 0); } catch (e) {} return r; };
    }
  }
  function enhanceKiLage() {
    var btn = $('ki-lage-btn'); var body = $('ki-lage-body');
    if (!btn || !body || $('ki-lage-min')) return;
    var m = document.createElement('button');
    m.type = 'button'; m.id = 'ki-lage-min'; m.title = 'Aufklappen';
    m.innerHTML = svg('chevron', 16);
    function setOpen(open) { body.style.display = open ? '' : 'none'; m.classList.toggle('collapsed', !open); m.title = open ? 'Minimieren' : 'Aufklappen'; }
    m.addEventListener('click', function () { setOpen(body.style.display === 'none'); });
    // Buttons getauscht: Chevron NACH "Lage analysieren" (rechts außen)
    if (btn.nextSibling) btn.parentNode.insertBefore(m, btn.nextSibling); else btn.parentNode.appendChild(m);
    // Kompakt: leeren Platzhalter einklappen; beim Analysieren automatisch aufklappen
    var txt = (body.textContent || '').trim();
    if (txt.length < 140) setOpen(false);
    btn.addEventListener('click', function () { setOpen(true); });
  }

  /* ── Init ──────────────────────────────────────────────────────── */
  function init() {
    if (!$(MOUNT_ID)) return;
    injectCss(); render(); enhanceKiLage(); enhanceObjektdaten(); restoreAvmState();
    fetch('/api/v1/avm/health').then(function (r) { return r.json(); }).then(function (h) { _avmHealth = h || { available: false }; applyAvmHealth(); }).catch(function () { _avmHealth = { available: false }; applyAvmHealth(); });
  }
  var _tries = 0;
  function autoInit() { if ($(MOUNT_ID)) { init(); return; } if (_tries++ < 40) setTimeout(autoInit, 250); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInit); else setTimeout(autoInit, 0);
  window.addEventListener('load', autoInit);
  window.ObjectActions = { init: init, render: render, openImport: openCombinedImport, enhanceKiLage: enhanceKiLage, syncObjExtra: syncObjExtra, clearAvm: clearAvm, applyQcPending: applyQcPending,
    /* v503-voice-bridge: Sprach-Ergebnisliste ueber die Import-Mechanik (gleiche Optik,
       gleicher Schreibweg inkl. Sterne + QC-Bucket-Logik). */
    _voice: {
      reset: function () { _merged = {}; _files = []; _importPhotos = []; _addrChoice = null; },
      setMode: function (qc, done) { _qcMode = !!qc; _qcPendingMerged = {}; _oabiDone = (typeof done === 'function') ? done : null; },
      addRow: addRow,
      render: renderMergedTable,
      apply: applyMerged
    } };
})();

/* v570-pf: PRE-FLIGHT Aktionsleiste (Markup), Logik/IDs/data-src/.on unveraendert */
