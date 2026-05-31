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
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'
  };
  function svg(name, size, stroke) { var p = ICO[name] || ''; var s = size || 14; return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="' + (stroke || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }

  function mainInputs() { return { plz: val('plz'), ort: val('ort'), str: val('str'), hnr: val('hnr'), objektart: val('objart'), wfl: val('wfl'), baujahr: val('baujahr'), kp: val('kp') }; }
  var REQUIRED = {
    pricehubble: [['plz', 'PLZ'], ['ort', 'Ort'], ['str', 'Straße'], ['hnr', 'Hausnummer'], ['objektart', 'Objektart'], ['wfl', 'Wohnfläche']],
    sprengnetter: [['plz', 'PLZ'], ['ort', 'Ort'], ['objektart', 'Objektart'], ['wfl', 'Wohnfläche']]
  };
  function missingFor(p) { var i = mainInputs(); return (REQUIRED[p] || []).filter(function (f) { return !i[f[0]] || String(i[f[0]]).trim() === ''; }).map(function (f) { return f[1]; }); }

  /* ── CSS (exakte QuickCheck-Klassen, scoped) ───────────────────── */
  function injectCss() {
    if ($('oab-style')) return;
    var P = '#' + MOUNT_ID + ' ';
    var css = [
      '[data-v365-top]{display:none!important}',
      P + '.actions{display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap;align-items:center;padding:14px 18px;background:var(--white,#fff);border:1px solid rgba(201,168,76,0.18);border-radius:10px;box-shadow:0 1px 3px rgba(42,39,39,0.04)}',
      P + '.actions-label{font-size:10.5px;font-weight:700;color:var(--gold-3,#9a7f33);letter-spacing:.14em;text-transform:uppercase;margin-right:6px}',
      P + '.qc7-sources{display:inline-flex;flex-wrap:wrap;gap:8px;align-items:center}',
      P + ".qc7-src{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid rgba(42,39,39,0.18);border-radius:10px;background:#fff;cursor:pointer;font:500 13px/1 'DM Sans',system-ui,sans-serif;color:var(--ch,#2A2727);transition:border-color .15s ease,background .15s ease,box-shadow .15s ease;user-select:none}",
      P + '.qc7-src:hover{border-color:rgba(201,168,76,0.55)}',
      P + '.qc7-src input{display:none}',
      P + '.qc7-src .qc7-box{width:18px;height:18px;flex-shrink:0;border:2px solid rgba(42,39,39,0.28);border-radius:5px;display:inline-flex;align-items:center;justify-content:center;transition:background .15s ease,border-color .15s ease}',
      P + '.qc7-src .qc7-box svg{width:12px;height:12px;opacity:0;transition:opacity .12s ease}',
      P + '.qc7-src.on{border-color:var(--gold,#C9A84C);background:rgba(201,168,76,0.10);box-shadow:0 1px 0 rgba(201,168,76,0.25)}',
      P + '.qc7-src.on .qc7-box{background:var(--gold,#C9A84C);border-color:var(--gold,#C9A84C)}',
      P + '.qc7-src.on .qc7-box svg{opacity:1}',
      P + '.qc7-src .qc7-ic{display:inline-flex;color:var(--gold-3,#9a7f33)}',
      P + '.qc6-seg{display:inline-flex;border:1px solid rgba(201,168,76,0.45);border-radius:10px;overflow:hidden;background:rgba(248,246,241,0.6)}',
      P + ".qc6-seg button{appearance:none;border:0;background:transparent;padding:7px 14px;font:600 13px/1 'DM Sans',system-ui,sans-serif;color:var(--ch2,#6b6660);cursor:pointer;transition:background .18s ease,color .18s ease;white-space:nowrap}",
      P + '.qc6-seg button + button{border-left:1px solid rgba(201,168,76,0.25)}',
      P + '.qc6-seg button:hover{color:var(--ch,#2A2727)}',
      P + '.qc6-seg button.sel{background:var(--gold,#C9A84C)!important;color:#fff!important}',  /* sichtbar */
      P + '.qc6-seg-wrap{display:inline-flex;align-items:center;gap:8px}',
      P + ".qc6-seg-lbl{font:600 12px/1 'DM Sans',system-ui,sans-serif;color:var(--ch2,#6b6660);letter-spacing:.02em}",
      P + '.qc6-run{display:inline-flex;align-items:center;gap:6px}',
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
      P + '.avmx.collapsed .avmx-min svg{transform:rotate(-90deg)}',
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
      P + '.avmx-cols{display:grid;grid-template-columns:1fr 1px 1fr;gap:16px;align-items:start;padding:2px 0 2px}',
      P + '.avmx-col{min-width:0}',
      P + '.avmx-div{background:rgba(201,168,76,0.30);width:1px;align-self:stretch}',
      P + '.avmx-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;padding-top:7px;border-top:1px solid rgba(201,168,76,0.18)}',
      P + '.avmx-disc{font-size:10.5px;color:var(--muted,#7A7370)}',
      P + '.avmx-apply{margin:0}',
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
      '.oabi-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid rgba(42,39,39,0.08)}',
      '.oabi-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid var(--border,#E7E2DC);border-radius:8px;background:#fff;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;color:var(--ch,#2A2727)}',
      '.oabi-btn.primary{background:linear-gradient(135deg,var(--gold,#C9A84C),var(--gold-d,#9a7f33));color:#fff;border-color:transparent}',
      '.oabi-btn[disabled]{opacity:.5;cursor:not-allowed}',
      '.oab-missing-hl{outline:2px solid #E5A847;border-radius:6px}',
      '.oab-note{font-size:11px;color:var(--muted,#7A7370);margin-top:2px}',
      '#ki-lage-min{width:28px;height:28px;border:1px solid var(--border,#E7E2DC);border-radius:7px;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:var(--ch2,#6b6660);margin-left:8px;vertical-align:middle;transition:transform .2s}',
      '#ki-lage-btn{margin-left:auto}',
      '#ki-lage-min.collapsed svg{transform:rotate(-90deg)}'
    ].join('\n');
    var st = document.createElement('style'); st.id = 'oab-style'; st.textContent = css; document.head.appendChild(st);
  }

  /* ── Leiste (ohne KI-Recherche) ────────────────────────────────── */
  function srcLabel(value, icoName, text, disabled) {
    return '<label class="qc7-src" data-src="' + value + '"' + (disabled ? ' title="AVM derzeit deaktiviert"' : '') + '>' +
      '<input type="checkbox" value="' + value + '"' + (disabled ? ' disabled' : '') + '>' +
      '<span class="qc7-box">' + svg('check', 12, '#fff') + '</span>' +
      '<span class="qc7-ic">' + svg(icoName, 14) + '</span> ' + text + '</label>';
  }
  function render() {
    var mount = $(MOUNT_ID); if (!mount) return;
    var avmOff = !(_avmHealth && _avmHealth.available);
    mount.innerHTML =
      '<div class="actions" id="oab-bar">' +
        '<span class="actions-label">Aktionen</span>' +
        '<span class="qc7-sources">' +
          srcLabel('import', 'upload', 'Exposé/Marktbericht importieren', false) +
          srcLabel('pricehubble', 'building', 'PriceHubble', avmOff) +
          srcLabel('sprengnetter', 'chart', 'Sprengnetter', avmOff) +
        '</span>' +
        '<span class="qc6-seg-wrap"><span class="qc6-seg-lbl">Spanne</span>' +
          '<span class="qc6-seg" id="oab-seg">' +
            '<button type="button" data-span="low">Unten</button>' +
            '<button type="button" data-span="mid" class="sel">Ø</button>' +
            '<button type="button" data-span="high">Oben</button>' +
          '</span></span>' +
        '<button type="button" class="btn primary qc6-run" id="oab-run"><span class="ico">' + svg('zap', 14, '#fff') + '</span> Abrufen</button>' +
      '</div>' +
      (avmOff ? '<div class="oab-note" style="margin:-6px 0 12px">AVM (PriceHubble/Sprengnetter) ist derzeit deaktiviert — Import funktioniert.</div>' : '') +
      '<div class="oab-prog" id="oab-prog" style="display:none"></div>' +
      '<div class="oab-results" id="oab-results"></div>';
    mount.querySelectorAll('.qc7-src input').forEach(function (cb) { cb.addEventListener('change', function () { var l = cb.closest('.qc7-src'); if (l) l.classList.toggle('on', cb.checked); }); });
    mount.querySelectorAll('#oab-seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        _span = b.getAttribute('data-span') || 'mid';
        mount.querySelectorAll('#oab-seg button').forEach(function (x) { x.classList.toggle('sel', x === b); });
        renderResults();
      });
    });
    $('oab-run').addEventListener('click', runSelected);
    renderResults();
  }
  function selectedSources() { var out = [], m = $(MOUNT_ID); if (!m) return out; m.querySelectorAll('.qc7-src input:checked').forEach(function (c) { out.push(c.value); }); return out; }
  function setProg(t) { var p = $('oab-prog'); if (p) { p.style.display = t ? '' : 'none'; p.textContent = t || ''; } }

  async function runSelected() {
    var srcs = selectedSources();
    if (!srcs.length) { toast('Bitte mindestens eine Quelle auswählen'); return; }
    var order = ['import', 'pricehubble', 'sprengnetter'];
    var ordered = order.filter(function (s) { return srcs.indexOf(s) !== -1; });
    var btn = $('oab-run'); if (btn) btn.disabled = true;
    for (var i = 0; i < ordered.length; i++) {
      var s = ordered[i];
      try {
        if (s === 'import') { setProg('Import …'); openCombinedImport(); }
        else if (s === 'pricehubble' || s === 'sprengnetter') { setProg((s === 'pricehubble' ? 'PriceHubble' : 'Sprengnetter') + ' …'); await avmFetch(s); }
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
  async function avmFetch(provider) {
    var miss = missingFor(provider);
    if (miss.length) { highlightMissing(provider); toast('⚠ ' + (provider === 'pricehubble' ? 'PriceHubble' : 'Sprengnetter') + ' braucht: ' + miss.join(', ')); return; }
    try {
      var res = await fetch('/api/v1/avm/' + provider, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }, body: JSON.stringify({ inputs: mainInputs() }) });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        if (data && data.needs_credits) toast('⚠ Nicht genug Credits (' + (data.required || '?') + ' nötig)');
        else if (data && data.missing_fields) { highlightMissing(provider); toast('⚠ Fehlt: ' + data.missing_fields.join(', ')); }
        else if (data && data.disabled) toast('AVM ist derzeit deaktiviert.');
        else toast('⚠ AVM-Abruf fehlgeschlagen' + (data && data.message ? ': ' + data.message : ''));
        return;
      }
      if (data && data.result) { _avm[data.result.provider] = data.result; renderResults(); toast('✓ ' + data.result.provider + (data.mode === 'stub' ? ' (Demo — kostenlos)' : ' (−' + (data.cost || 0) + ' Credits)')); }
    } catch (e) { toast('⚠ Netzwerkfehler beim AVM-Abruf'); }
  }
  function pickMW(r) { return _span === 'low' ? r.low : _span === 'high' ? r.high : r.marktwert; }
  function pickMM(r) { return _span === 'low' ? r.marktmieteLow : _span === 'high' ? r.marktmieteHigh : r.marktmieteCold; }
  function spanLabel() { return _span === 'low' ? 'Unten' : _span === 'high' ? 'Oben' : 'Durchschnitt'; }
  function spanRow(lo, mid, hi) {
    function piece(v, sel) { return sel ? '<b>' + fmt0(v) + ' €</b>' : fmt0(v) + ' €'; }
    return 'Spanne ' + piece(lo, _span === 'low') + ' – ' + piece(mid, _span === 'mid') + ' – ' + piece(hi, _span === 'high');
  }
  function renderResults() {
    var host = $('oab-results'); if (!host) return;
    var provs = Object.keys(_avm);
    if (!provs.length) { host.innerHTML = ''; return; }
    host.innerHTML = provs.map(function (p) { return renderCard(_avm[p]); }).join('');
    host.querySelectorAll('[data-apply]').forEach(function (b) { b.addEventListener('click', function () { applyAvm(_avm[b.getAttribute('data-apply')]); }); });
    host.querySelectorAll('[data-min]').forEach(function (b) { b.addEventListener('click', function () { var pr = b.getAttribute('data-min'); _collapsed[pr] = !_collapsed[pr]; renderResults(); }); });
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
    var chip = '';
    if (r.scoreMicro != null || r.scoreMacro != null || r.wertentwicklung != null) {
      var parts = [];
      if (r.scoreMicro != null) parts.push('Mikro ' + r.scoreMicro);
      if (r.scoreMacro != null) parts.push('Makro ' + r.scoreMacro);
      if (r.wertentwicklung != null) parts.push('Wertentw. ' + (r.wertentwicklung >= 0 ? '+' : '') + r.wertentwicklung.toFixed(1) + '%/J');
      chip = '<div class="avmx-chip">' + parts.map(escH).join(' · ') + '</div>';
    }
    var mwSub = [];
    if (mwSqm) mwSub.push(fmt0(mwSqm) + ' €/m²');
    if (diff != null) mwSub.push('<span style="color:' + dCol + '">' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '% vs. Kaufpreis · ' + escH(dLbl) + '</span>');
    return '<div class="avmx' + (isSpr ? ' is-spr' : '') + (coll ? ' collapsed' : '') + '">' +
      '<div class="avmx-head">' +
        '<span class="avmx-eye">Marktbewertung ·</span><span class="avmx-prov">' + escH(r.provider) + '</span>' +
        '<span class="avmx-conf">' + escH(r.conf || 'AVM') + (r.mode === 'stub' ? ' · Demo' : '') + '</span>' +
        '<button type="button" class="avmx-min" data-min="' + escH(r.provider) + '" title="' + (coll ? 'Aufklappen' : 'Minimieren') + '">' + svg('chevron', 16) + '</button>' +
      '</div>' +
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
        '</div>' +
        '<div class="avmx-actions">' +
          '<span class="avmx-disc">Marktpreisindikation — kein Gutachten n. § 194 BauGB</span>' +
          '<button type="button" class="btn primary avmx-apply" data-apply="' + escH(r.provider) + '"><span class="ico">' + svg('download', 14, '#fff') + '</span> In Felder übernehmen (' + spanLabel() + ')</button>' +
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
  function markSvwertAvm() {
    var sv = $('svwert'); if (!sv) return;
    var fld = sv.closest ? sv.closest('.f') : null;
    var hint = fld ? fld.querySelector('.cf-hint') : null;
    if (!hint) return;
    if (!hint._orig) hint._orig = hint.textContent;
    hint.textContent = '(Marktpreisindikation · AVM — kein Verkehrswert n. § 194 BauGB)';
    hint.title = 'Der übernommene Wert stammt aus einer AVM-Markteinschätzung (PriceHubble/Sprengnetter), nicht aus einem Verkehrswertgutachten nach § 194 BauGB. Bei manueller Eingabe wird die Bezeichnung automatisch zurückgesetzt.';
    hint.style.color = 'var(--gold-3,#9a7f33)';
    if (!sv._avmResetBound) {
      sv._avmResetBound = true;
      sv.addEventListener('input', function _r() { try { if (hint._orig) hint.textContent = hint._orig; hint.removeAttribute('title'); hint.style.color = ''; } catch (e) {} sv.removeEventListener('input', _r); sv._avmResetBound = false; });
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
  var _merged = {};   // id -> { label, value(display), raw, source, kind, emptyOnly }
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
    if (d.verkehrswert) addRow('svwert', 'Marktpreisindikation (AVM)', fmt0(d.verkehrswert) + ' €', d.verkehrswert, S, 'input');
    if (d.energie_label) addRow('ds2_energie', 'Energieklasse', String(d.energie_label).toUpperCase(), String(d.energie_label).toUpperCase(), S, 'select', false);
    // Marktmiete €/m²
    var mmq = numDe(d.marktmiete_qm), mmm = numDe(d.marktmiete_monat), wfl = numDe(d.wohnflaeche);
    var mm = (mmq != null) ? mmq : ((mmm != null && wfl) ? mmm / wfl : null);
    if (mm != null) addRow('ds2_marktmiete', 'Marktmiete (€/m²)', mm.toFixed(2).replace('.', ',') + ' €/m²', mm.toFixed(2).replace('.', ','), S, 'input');
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
  }

  var _files = [];   // { name, text, type, userType, cache, status, row }
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
  function renderMergedTable() {
    var host = $('oabi-result'); if (!host) return;
    var keys = Object.keys(_merged);
    var ab = $('oabi-apply');
    if (!keys.length) { host.innerHTML = '<p style="color:var(--muted,#7A7370);font-style:italic;margin-top:10px">Noch keine Werte erkannt.</p>'; if (ab) ab.disabled = true; return; }
    host.innerHTML = addressWarning() + '<table class="oabi-tbl"><tbody>' + keys.map(function (id) {
      var it = _merged[id];
      return '<tr><td style="width:34px"><input type="checkbox" data-id="' + escH(id) + '" checked></td><td>' + escH(it.label) + '</td><td><b>' + escH(it.value) + '</b></td><td class="src">' + escH(it.source) + '</td></tr>';
    }).join('') + '</tbody></table>';
    if (ab) ab.disabled = false;
  }
  function openCombinedImport() {
    _merged = {}; _files = [];
    var ov = document.createElement('div'); ov.className = 'oabi-ov'; ov.id = 'oabi-ov';
    ov.innerHTML =
      '<div class="oabi-modal">' +
        '<div class="oabi-head"><span style="color:var(--gold,#C9A84C)">' + svg('upload', 22) + '</span><h3>Exposé &amp; Marktbericht importieren</h3></div>' +
        '<div class="oabi-sub">Mehrere PDFs gleichzeitig anhängen — Typ wird automatisch erkannt (inkl. OCR bei Scan-/Grafik-PDFs) und ist pro Datei umstellbar. Alle Werte werden zusammengeführt (Marktbericht führt bei Konflikt).</div>' +
        '<div class="oabi-body">' +
          '<div class="oabi-drop" id="oabi-drop">📁 PDFs auswählen oder hierher ziehen<br><span style="font-size:11px;color:var(--muted,#7A7370)">mehrere Dateien möglich · max 10 MB je Datei</span>' +
            '<input type="file" id="oabi-input" accept="application/pdf,.pdf" multiple style="display:none"></div>' +
          '<div class="oabi-files" id="oabi-files"></div><div id="oabi-result"></div>' +
        '</div>' +
        '<div class="oabi-foot"><button type="button" class="oabi-btn" id="oabi-cancel">Schließen</button>' +
          '<button type="button" class="oabi-btn primary" id="oabi-apply" disabled><span style="display:inline-flex">' + svg('download', 14, '#fff') + '</span> Ausgewählte übernehmen</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    function close() { var x = $('oabi-ov'); if (x) x.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
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
  async function ensureExtract(f) {
    if (f.cache[f.type]) return;
    f.status = 'reading'; renderFileRow(f);
    try { f.cache[f.type] = await callExtract(f.text, f.type === 'market'); f.status = 'ok'; }
    catch (e) { f.status = 'err'; }
    renderFileRow(f);
  }
  async function onTypeChange(f, v) {
    f.userType = (v === 'auto') ? null : v;
    f.type = f.userType || (detectMarket({ name: f.name }, f.text) ? 'market' : 'expose');
    await ensureExtract(f); recompute(); renderMergedTable();
  }
  async function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList).filter(function (f) { return /\.pdf$/i.test(f.name) && f.size <= 10 * 1024 * 1024; });
    if (!files.length) { toast('Bitte gültige PDF-Dateien (max 10 MB) wählen.'); return; }
    var filesHost = $('oabi-files');
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var row = document.createElement('div'); row.className = 'oabi-file'; filesHost.appendChild(row);
      var f = { name: file.name, text: '', type: 'expose', userType: null, cache: {}, status: 'reading', row: row };
      _files.push(f); renderFileRow(f);
      try {
        f.text = await extractTextFull(file, function (m) { setStatus(f, m); });
        if (!f.text || f.text.replace(/\s/g, '').length < 50) { f.status = 'err'; renderFileRow(f); continue; }
        f.type = detectMarket(file, f.text) ? 'market' : 'expose';
        await ensureExtract(f);
      } catch (e) { f.status = 'err'; renderFileRow(f); }
    }
    recompute(); renderMergedTable();
  }
  function applyMerged() {
    var ov = $('oabi-ov'); if (!ov) return;
    var n = 0, _applied = [];
    ov.querySelectorAll('.oabi-tbl input[type="checkbox"]:checked').forEach(function (cb) {
      var id = cb.getAttribute('data-id'), it = _merged[id]; if (!it) return;
      if (it.kind === 'star') { if (it.raw > 0 && window.StarRating && typeof StarRating.setRating === 'function') { StarRating.setRating(id, it.raw); n++; _applied.push(id); } return; }
      if (it.kind === 'select') { if (setSelectSmart(id, it.raw, it.emptyOnly)) { n++; _applied.push(id); } return; }
      setInput(id, it.raw); if (id === 'svwert' && it.source === 'Marktbericht') markSvwertAvm(); n++; _applied.push(id);
    });
    try { if (typeof window._v236MarkQcLoaded === 'function' && _applied.length) window._v236MarkQcLoaded(_applied); } catch (e) {}
    try { if (typeof window.calc === 'function') window.calc(); } catch (e) {}
    try { if (typeof window.renderDealScore2 === 'function') window.renderDealScore2(); } catch (e) {}
    ov.remove();
    toast('✓ ' + n + ' Werte aus Import übernommen');
  }

  /* ── KI-Lage-Karte minimierbar machen (ohne ki-lage.js zu aendern) ── */
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
    injectCss(); render(); enhanceKiLage();
    fetch('/api/v1/avm/health').then(function (r) { return r.json(); }).then(function (h) { _avmHealth = h || { available: false }; render(); }).catch(function () { _avmHealth = { available: false }; render(); });
  }
  var _tries = 0;
  function autoInit() { if ($(MOUNT_ID)) { init(); return; } if (_tries++ < 40) setTimeout(autoInit, 250); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInit); else setTimeout(autoInit, 0);
  window.addEventListener('load', autoInit);
  window.ObjectActions = { init: init, render: render, openImport: openCombinedImport, enhanceKiLage: enhanceKiLage };
})();
